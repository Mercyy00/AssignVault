import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Load .env.local if present
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx !== -1) {
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const targetId = process.argv[2];

  let query = supabase
    .from("templates")
    .select("id, assignment_id, status, created_at, assignments(number, subjects(slug, name))")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (targetId) {
    query = query.eq("id", targetId);
  }

  const { data: pending, error } = await query;

  if (error) {
    console.error("Error fetching templates:", error);
    process.exit(1);
  }

  if (!pending || pending.length === 0) {
    console.log("No pending templates found to approve.");
    return;
  }

  const toApprove = pending[0];
  const subjectName = toApprove.assignments?.subjects?.name || "Unknown";
  const assignNum = toApprove.assignments?.number || "?";

  console.log(`Approving template: ${toApprove.id}`);
  console.log(`Assignment: ${subjectName} - Assignment ${assignNum}`);

  const { error: updateError } = await supabase
    .from("templates")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      needs_review: false,
    })
    .eq("id", toApprove.id);

  if (updateError) {
    console.error("Failed to approve template:", updateError);
    process.exit(1);
  }

  console.log("Template successfully approved!");
  console.log("You can now open http://localhost:3005/download and generate your personalized assignment.");
}

main();
