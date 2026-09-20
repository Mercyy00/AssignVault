import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { hashIp, checkRateLimit } from "@/lib/security/rateLimit";
import { selectBestTemplate } from "@/lib/templates/select";
import { fillTemplate } from "@/lib/docx/fill";
import { getDate } from "@/lib/data/batchDates";
import { resolveDownloadDate } from "@/lib/dates/dateUtils";
import {
  firstNameSchema,
  middleNameSchema,
  surnameSchema,
  rollNumberSchema,
  folderNameSchema,
} from "@/lib/validation";
import { z } from "zod";

export const dynamic = "force-dynamic";

const generateSchema = z.object({
  subject: z.string().min(1, "Please select a subject"),
  assignmentNumber: z.union([z.string(), z.number()]).transform((v) => Number(v)),
  batch: z.string().min(1, "Please select your practical batch"),
  firstName: firstNameSchema,
  middleName: middleNameSchema,
  surname: surnameSchema,
  rollNumber: rollNumberSchema,
  folderName: folderNameSchema.optional().or(z.literal("")),
  // Optional: a valid custom date always overrides the batch date. When
  // omitted, the published batch date is used, else the request fails clearly.
  customDate: z.string().optional().or(z.literal("")),
});

export async function POST(request: NextRequest) {
  try {
    // 1. IP Hashing & Rate Limiting (20 generates per IP per hour)
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : "127.0.0.1";
    const ipHash = hashIp(ip);

    const rateCheck = checkRateLimit(ipHash, 20, 60 * 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error:
            "Generation limit reached. You can generate at most 20 documents per hour. Please try again later.",
        },
        { status: 429 }
      );
    }

    // 2. Parse and validate JSON body
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "Invalid JSON request body" },
        { status: 400 }
      );
    }

    // Support legacy fullName if passed
    if (!body.firstName && !body.surname && body.fullName) {
      const parts = String(body.fullName).trim().split(/\s+/);
      if (parts.length === 1) {
        body.firstName = parts[0];
        body.surname = parts[0];
      } else if (parts.length === 2) {
        body.firstName = parts[0];
        body.surname = parts[1];
      } else {
        body.firstName = parts[0];
        body.middleName = parts.slice(1, -1).join(" ");
        body.surname = parts[parts.length - 1];
      }
    }

    const parseResult = generateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0].message },
        { status: 400 }
      );
    }

    const {
      subject: subjectSlug,
      assignmentNumber,
      batch: batchNameOrId,
      firstName,
      middleName,
      surname,
      rollNumber,
      folderName,
      customDate,
    } = parseResult.data;

    // 3. Connect to Supabase
    const supabase = createServerClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Server database configuration is missing" },
        { status: 500 }
      );
    }

    // 4. Resolve Subject, Assignment, and Batch
    const { data: subjectRecord } = await supabase
      .from("subjects")
      .select("id, name")
      .eq("slug", subjectSlug)
      .maybeSingle();

    if (!subjectRecord) {
      return NextResponse.json(
        { error: "Selected subject was not found in the catalog." },
        { status: 404 }
      );
    }

    const { data: assignmentRecord } = await supabase
      .from("assignments")
      .select("id, number")
      .eq("subject_id", subjectRecord.id)
      .eq("number", assignmentNumber)
      .maybeSingle();

    if (!assignmentRecord) {
      return NextResponse.json(
        { error: "Selected assignment was not found in the catalog." },
        { status: 404 }
      );
    }

    const isBatchUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        batchNameOrId
      );
    const batchQuery = supabase.from("batches").select("id, name");
    const { data: batchRecord } = await (isBatchUuid
      ? batchQuery.eq("id", batchNameOrId)
      : batchQuery.eq("name", batchNameOrId)
    ).maybeSingle();

    if (!batchRecord) {
      return NextResponse.json(
        { error: "Selected practical batch was not found." },
        { status: 404 }
      );
    }

    // 4b. Resolve the submission date: custom overrides the stored batch date,
    // otherwise the batch date is used, otherwise fail with a clear message.
    const storedBatchDate = await getDate(
      supabase,
      batchRecord.id,
      assignmentRecord.id
    );
    const resolvedDate = resolveDownloadDate({
      customDate,
      batchDate: storedBatchDate,
    });
    if (!resolvedDate.date) {
      return NextResponse.json(
        { error: resolvedDate.error || "A submission date is required." },
        { status: 400 }
      );
    }

    // 5. Select Best Approved Template
    const template = await selectBestTemplate(supabase, assignmentRecord.id);
    if (!template || !template.file_path) {
      return NextResponse.json(
        {
          error:
            "No approved template is available for this assignment yet. Be the first to upload it!",
        },
        { status: 404 }
      );
    }

    // 6. Download template .docx from Supabase storage
    const { data: templateBlob, error: downloadErr } = await supabase.storage
      .from("templates")
      .download(template.file_path);

    if (downloadErr || !templateBlob) {
      console.error("Storage download failed:", downloadErr);
      return NextResponse.json(
        { error: "Failed to retrieve the document template from storage." },
        { status: 500 }
      );
    }

    const templateArrayBuffer = await templateBlob.arrayBuffer();
    const templateBuffer = Buffer.from(templateArrayBuffer);

    // 7. Personalize template using fill engine
    let filledBuffer: Buffer;
    try {
      filledBuffer = await fillTemplate(
        templateBuffer,
        {
          firstName,
          middleName: middleName || "",
          surname,
          rollNumber,
          batch: batchRecord.name,
          customDate: resolvedDate.date,
          folderName: folderName || "assign",
        },
        {
          watermark: process.env.REFERENCE_WATERMARK === "true",
        }
      );
    } catch (fillError) {
      console.error("Fill engine error:", fillError);
      // Log failure in audit log
      await supabase.from("audit_log").insert({
        action: "template_fill_failed",
        details: {
          template_id: template.id,
          roll_number: rollNumber,
          error: fillError instanceof Error ? fillError.message : "Unknown error",
        },
      });

      return NextResponse.json(
        { error: "Failed to personalize document safely. Please contact support." },
        { status: 500 }
      );
    }

    // 8. Log successful download in downloads_log
    await supabase.from("downloads_log").insert({
      template_id: template.id,
      batch_id: batchRecord.id,
      downloader_roll: rollNumber,
      ip_hash: ipHash,
    });

    // 9. Format sanitized download filename: {Subject}_A{number}_{Roll}.docx
    const safeSubject = subjectRecord.name.replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeRoll = rollNumber.replace(/[^a-zA-Z0-9_-]/g, "");
    const downloadFilename = `${safeSubject}_A${assignmentRecord.number}_${safeRoll}.docx`;

    // 10. Stream file as binary attachment
    return new NextResponse(new Uint8Array(filledBuffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${downloadFilename}"`,
        "X-Template-Id": template.id,
      },
    });
  } catch (error) {
    console.error("Unexpected error in /api/generate:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during document generation." },
      { status: 500 }
    );
  }
}
