/**
 * One-time script to create the first admin user (or promote an existing one).
 *
 * Usage:
 *   node scripts/add-admin.mjs <email> <password>
 *
 * It uses the Supabase service-role key to:
 *   1. Create an auth user with the given email + password (email pre-confirmed),
 *      or reuse the existing user with that email.
 *   2. Insert that user's id into the `admin_users` table.
 *
 * After running this once, disable public sign-ups in the Supabase dashboard:
 *   Authentication -> Providers -> Email -> turn OFF "Allow new users to sign up".
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Load .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i !== -1 && !process.env[t.slice(0, i).trim()]) {
      process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const email = process.argv[2];
const password = process.argv[3];
if (!email || !password) {
  console.error("Usage: node scripts/add-admin.mjs <email> <password>");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  // 1. Try to create the user (pre-confirmed). If they already exist, find them.
  let userId = null;
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (created?.user) {
    userId = created.user.id;
    console.log(`Created auth user ${email} (${userId}).`);
  } else if (createErr) {
    console.log(`createUser said: ${createErr.message}. Looking up existing user…`);
    // Page through existing users to find the email.
    const { data: list, error: listErr } = await supabase.auth.admin.listUsers({
      perPage: 1000,
    });
    if (listErr) {
      console.error("Failed to list users:", listErr.message);
      process.exit(1);
    }
    const found = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!found) {
      console.error("Could not create or find that user.");
      process.exit(1);
    }
    userId = found.id;
    console.log(`Found existing auth user ${email} (${userId}).`);
  }

  // 2. Insert into admin_users (idempotent).
  const { error: insertErr } = await supabase
    .from("admin_users")
    .upsert({ user_id: userId }, { onConflict: "user_id" });
  if (insertErr) {
    console.error("Failed to add to admin_users:", insertErr.message);
    process.exit(1);
  }

  console.log(`\n✅ ${email} is now an admin.`);
  console.log(
    "\nReminder: disable public sign-ups in Supabase → Authentication → Providers → Email."
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
