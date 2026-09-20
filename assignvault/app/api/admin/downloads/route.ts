import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security/adminAuth";
import { createServerClient } from "@/lib/supabase/server";
import { listDownloads, downloadsToCsv } from "@/lib/admin/reportsDownloads";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/downloads?subject=&batch=&roll=&format=csv
 * Returns the downloads log (admin-only — roll numbers are personal data).
 * With `format=csv`, streams a CSV attachment instead of JSON.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const supabase = createServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Server database configuration is missing" }, { status: 500 });
  }

  const url = new URL(request.url);
  const subjectSlug = url.searchParams.get("subject") || undefined;
  const batchName = url.searchParams.get("batch") || undefined;
  const roll = url.searchParams.get("roll") || undefined;
  const format = url.searchParams.get("format");

  const rows = await listDownloads(supabase, { subjectSlug, batchName, roll });

  if (format === "csv") {
    const csv = downloadsToCsv(rows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv;charset=utf-8",
        "Content-Disposition": `attachment; filename="downloads_${new Date().toISOString().slice(0, 10)}.csv"`,
        // Never let a proxy/CDN cache admin data.
        "Cache-Control": "no-store, private",
      },
    });
  }

  return NextResponse.json(
    { rows },
    { headers: { "Cache-Control": "no-store, private" } }
  );
}
