import { NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/serverAuth";
import { createServerClient } from "@/lib/supabase/server";

export interface AdminSession {
  userId: string;
  email: string | null;
}

/**
 * Resolve the current admin session from request cookies.
 * Returns the admin identity only when the logged-in user exists in the
 * `admin_users` table; otherwise null.
 *
 * Step 9: this replaces the temporary `ADMIN_TEMP_KEY` header check from Step 8.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const auth = await createAuthClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) return null;

  // Membership check uses the service-role client so it isn't limited by RLS.
  const admin = createServerClient();
  if (!admin) return null;
  const { data: row } = await admin
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!row) return null;
  return { userId: user.id, email: user.email ?? null };
}

/**
 * Guard for admin API route handlers. Returns either the admin session or a
 * ready-to-return 401/403 NextResponse. Every admin mutation verifies the
 * session server-side (the proxy is a coarse gate, not the source of truth).
 */
export async function requireAdmin(): Promise<
  { session: AdminSession } | { response: NextResponse }
> {
  const session = await getAdminSession();
  if (!session) {
    return {
      response: NextResponse.json(
        { error: "Admin authentication required." },
        { status: 401 }
      ),
    };
  }
  return { session };
}
