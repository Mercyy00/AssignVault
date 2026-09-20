import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createServerClient } from "@/lib/supabase/server";
import { hashIp, checkRateLimit } from "@/lib/security/rateLimit";
import { verifyUploadedFile } from "@/lib/docx/verify";
import { extractDocxText, crossCheckUploaderDetails } from "@/lib/docx/extractText";
import { convertPdfToDocx } from "@/lib/converter/client";
import { templatize } from "@/lib/docx/templatize.ts";
import {
  fullNameSchema,
  rollNumberSchema,
  folderNameSchema,
} from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // 1. Get client IP and compute hashed IP
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : "127.0.0.1";
    const ipHash = hashIp(ip);

    // 2. Abuse Prevention: Rate Limiting
    const rateCheck = checkRateLimit(ipHash);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error:
            "Upload limit reached. You can upload at most 5 files per hour. Please wait a while before submitting again.",
        },
        { status: 429 }
      );
    }

    // 3. Parse multipart form data
    const formData = await request.formData();
    const honeypot = (formData.get("website") as string) || "";

    // If bot filled the honeypot, return simulated success without saving anything
    if (honeypot.trim().length > 0) {
      return NextResponse.json(
        {
          success: true,
          message: "Assignment submitted successfully for review.",
          status: "received",
        },
        { status: 200 }
      );
    }

    const subjectSlug = (formData.get("subject") as string) || "";
    const assignmentNumStr = (formData.get("assignmentNumber") as string) || "";
    const batchNameOrId = (formData.get("batch") as string) || "";
    const fullName = (formData.get("fullName") as string) || "";
    const rollNumber = (formData.get("rollNumber") as string) || "";
    const folderName = (formData.get("folderName") as string) || "";
    const fileDate = (formData.get("fileDate") as string) || "";
    const terminalOutput = (formData.get("terminalOutput") as string) || "";
    const file = formData.get("file") as File | null;

    // 4. Validate input fields using Zod schemas
    if (!subjectSlug) {
      return NextResponse.json({ error: "Please select a subject." }, { status: 400 });
    }

    const assignmentNumber = parseInt(assignmentNumStr, 10);
    if (isNaN(assignmentNumber) || assignmentNumber < 1) {
      return NextResponse.json({ error: "Please select a valid assignment number." }, { status: 400 });
    }

    if (!batchNameOrId) {
      return NextResponse.json({ error: "Please select your practical batch." }, { status: 400 });
    }

    const nameResult = fullNameSchema.safeParse(fullName);
    if (!nameResult.success) {
      return NextResponse.json({ error: nameResult.error.issues[0].message }, { status: 400 });
    }

    const rollResult = rollNumberSchema.safeParse(rollNumber);
    if (!rollResult.success) {
      return NextResponse.json({ error: rollResult.error.issues[0].message }, { status: 400 });
    }

    const folderResult = folderNameSchema.safeParse(folderName);
    if (!folderResult.success) {
      return NextResponse.json({ error: folderResult.error.issues[0].message }, { status: 400 });
    }

    if (!fileDate || isNaN(Date.parse(fileDate))) {
      return NextResponse.json({ error: "Please provide a valid document submission date." }, { status: 400 });
    }

    if (terminalOutput.length > 10000) {
      return NextResponse.json(
        { error: "Terminal output cannot exceed 10,000 characters." },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json({ error: "Please upload an assignment file (.docx or .pdf)." }, { status: 400 });
    }

    // 5. Convert file to buffer and verify authenticity & zip-bomb protection
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    const verification = await verifyUploadedFile(fileBuffer, file.name);
    if (!verification.isValid) {
      return NextResponse.json({ error: verification.error }, { status: 422 });
    }

    const sourceFormat = verification.format; // 'docx' | 'pdf'
    let convertedDocxBuffer: Buffer | null = null;
    let convertedDocxPath: string | null = null;

    // 6. Verification and Cross-Checking
    if (sourceFormat === "docx") {
      if (verification.zip) {
        const extracted = await extractDocxText(verification.zip);
        const crossCheck = crossCheckUploaderDetails(extracted.fullText, fullName, rollNumber);
        if (!crossCheck.passed) {
          return NextResponse.json({ error: crossCheck.error }, { status: 422 });
        }
      }
    } else if (sourceFormat === "pdf") {
      // Step 4: Convert PDF to DOCX via Python Microservice
      const convResult = await convertPdfToDocx(fileBuffer, file.name);
      if (!convResult.success) {
        return NextResponse.json(
          { error: convResult.error },
          { status: convResult.statusCode }
        );
      }

      convertedDocxBuffer = convResult.docxBuffer;

      // Verify converted DOCX authenticity & parts
      const docxVerification = await verifyUploadedFile(convertedDocxBuffer, "converted.docx");
      if (!docxVerification.isValid || !docxVerification.zip) {
        return NextResponse.json(
          { error: "Converted document verification failed. Please upload the original .docx if possible." },
          { status: 500 }
        );
      }

      // Cross-check student name and roll number in converted document text
      const extracted = await extractDocxText(docxVerification.zip);
      const crossCheck = crossCheckUploaderDetails(extracted.fullText, fullName, rollNumber);
      if (!crossCheck.passed) {
        return NextResponse.json({ error: crossCheck.error }, { status: 422 });
      }
    }

    // 7. Resolve Subject, Assignment, and Batch in Supabase Database
    const supabase = createServerClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Server database configuration is missing. Please contact support." },
        { status: 500 }
      );
    }

    // Fetch subject
    const { data: subjectRecord, error: subErr } = await supabase
      .from("subjects")
      .select("id")
      .eq("slug", subjectSlug)
      .maybeSingle();

    if (subErr || !subjectRecord) {
      return NextResponse.json({ error: "Selected subject was not found in the catalog." }, { status: 404 });
    }

    // Fetch assignment
    const { data: assignmentRecord, error: assignErr } = await supabase
      .from("assignments")
      .select("id")
      .eq("subject_id", subjectRecord.id)
      .eq("number", assignmentNumber)
      .maybeSingle();

    if (assignErr || !assignmentRecord) {
      return NextResponse.json({ error: "Selected assignment was not found in the catalog." }, { status: 404 });
    }

    // Fetch batch (by name or by UUID id)
    const isBatchUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        batchNameOrId
      );
    const batchQuery = supabase.from("batches").select("id, name");
    const { data: batchRecord, error: batchErr } = await (isBatchUuid
      ? batchQuery.eq("id", batchNameOrId)
      : batchQuery.eq("name", batchNameOrId)
    ).maybeSingle();

    if (batchErr || !batchRecord) {
      return NextResponse.json({ error: "Selected practical batch was not found." }, { status: 404 });
    }

    // 8. Generate Submission ID and Store File in Private Storage Bucket
    const submissionId = crypto.randomUUID();
    const storageFilePath = `${submissionId}/original.${sourceFormat}`;

    const { error: uploadError } = await supabase.storage
      .from("raw-uploads")
      .upload(storageFilePath, fileBuffer, {
        contentType:
          sourceFormat === "docx"
            ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            : "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload failed:", uploadError);
      return NextResponse.json(
        { error: `Storage upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // If PDF was converted, store converted.docx alongside original in raw-uploads
    if (sourceFormat === "pdf" && convertedDocxBuffer) {
      convertedDocxPath = `${submissionId}/converted.docx`;
      const { error: convUploadError } = await supabase.storage
        .from("raw-uploads")
        .upload(convertedDocxPath, convertedDocxBuffer, {
          contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          upsert: false,
        });

      if (convUploadError) {
        console.error("Converted DOCX upload failed:", convUploadError);
      }
    }

    // 9. Handle Duplicates: If a submission already exists for this roll + assignment + batch
    const { data: existingSubmissions } = await supabase
      .from("submissions")
      .select("id")
      .eq("uploader_roll", rollNumber)
      .eq("assignment_id", assignmentRecord.id)
      .eq("batch_id", batchRecord.id);

    if (existingSubmissions && existingSubmissions.length > 0) {
      for (const existing of existingSubmissions) {
        await supabase.from("audit_log").insert({
          action: "submission_superseded",
          details: {
            superseded_submission_id: existing.id,
            new_submission_id: submissionId,
            roll_number: rollNumber,
            assignment_id: assignmentRecord.id,
            batch_id: batchRecord.id,
          },
        });
      }
    }

    // 10. Insert new Submission Record
    const initialStatus = sourceFormat === "docx" ? "received" : "converted";

    const submissionData: Record<string, unknown> = {
      id: submissionId,
      assignment_id: assignmentRecord.id,
      batch_id: batchRecord.id,
      uploader_name: fullName,
      uploader_roll: rollNumber,
      uploader_folder: folderName,
      uploader_date: fileDate,
      terminal_output_text: terminalOutput || null,
      raw_file_path: storageFilePath,
      converted_docx_path: convertedDocxPath,
      source_format: sourceFormat,
      status: initialStatus,
      ip_hash: ipHash,
    };

    let { error: insertError } = await supabase
      .from("submissions")
      .insert(submissionData as never);

    if (insertError && insertError.message?.includes("converted_docx_path")) {
      delete submissionData.converted_docx_path;
      insertError = (
        await supabase.from("submissions").insert(submissionData as never)
      ).error;
    }

    if (insertError) {
      console.error("Database insert error:", insertError);
      return NextResponse.json(
        { error: `Failed to register submission: ${insertError.message}` },
        { status: 500 }
      );
    }

    // 11. Step 5 Template Engine: Generate Template from uploaded docx
    let templateId: string | null = null;
    let finalStatus = initialStatus;
    const docxToTemplatize = sourceFormat === "docx" ? fileBuffer : convertedDocxBuffer;

    if (docxToTemplatize) {
      try {
        const templatizeRes = await templatize(
          docxToTemplatize,
          {
            fullName,
            rollNumber,
            batch: (batchRecord as { id: string; name?: string }).name || batchNameOrId,
            folderName,
            fileDate,
          },
          {
            isConvertedFromPdf: sourceFormat === "pdf",
          }
        );

        templateId = crypto.randomUUID();
        const templateStoragePath = `${templateId}/template.docx`;

        // Upload generated template to private 'templates' bucket
        const { error: templateUploadErr } = await supabase.storage
          .from("templates")
          .upload(templateStoragePath, templatizeRes.templateBuffer, {
            contentType:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            upsert: false,
          });

        if (templateUploadErr) {
          console.error("Failed to upload template file:", templateUploadErr);
          await supabase
            .from("submissions")
            .update({
              status: "failed",
              error_message: `Template storage upload failed: ${templateUploadErr.message}`,
            } as never)
            .eq("id", submissionId);
          finalStatus = "failed";
        } else {
          // Insert row into templates table
          const { error: templateInsertErr } = await supabase
            .from("templates")
            .insert({
              id: templateId,
              submission_id: submissionId,
              assignment_id: assignmentRecord.id,
              batch_id: batchRecord.id,
              file_path: templateStoragePath,
              status: "pending",
              placeholder_counts: templatizeRes.report.placeholderCounts,
              requires_folder: templatizeRes.requiresFolder,
              warnings: templatizeRes.report.warnings,
              output_images: templatizeRes.report.outputImages,
              needs_review: templatizeRes.needsReview,
              converted_from_pdf: sourceFormat === "pdf",
            } as never);

          if (templateInsertErr) {
            console.error("Failed to insert template record:", templateInsertErr);
            await supabase
              .from("submissions")
              .update({
                status: "failed",
                error_message: `Template record insert failed: ${templateInsertErr.message}`,
              } as never)
              .eq("id", submissionId);
            finalStatus = "failed";
          } else {
            // Update submission status to 'templated'
            await supabase
              .from("submissions")
              .update({ status: "templated" } as never)
              .eq("id", submissionId);
            finalStatus = "templated";
          }
        }
      } catch (tmplErr) {
        console.error("Template engine error:", tmplErr);
        const errorMsg =
          tmplErr instanceof Error ? tmplErr.message : "Failed to generate template";
        await supabase
          .from("submissions")
          .update({ status: "failed", error_message: errorMsg } as never)
          .eq("id", submissionId);
        finalStatus = "failed";
      }
    }

    const successMessage =
      sourceFormat === "pdf"
        ? "PDF converted to Word format and template generated. Queued for review."
        : "Thanks! Your file was processed and is in the review queue.";

    return NextResponse.json(
      {
        success: true,
        submissionId,
        templateId,
        status: finalStatus,
        format: sourceFormat,
        message: successMessage,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Unexpected error in /api/upload:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while processing your upload. Please try again." },
      { status: 500 }
    );
  }
}
