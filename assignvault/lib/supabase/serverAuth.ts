import { createServerClient as createSsrClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { Database } from "@/types/database";

/**
 * Cookie-bound Supabase client for reading the admin's auth session inside
 * Server Components and Route Handlers. Uses the ANON key + the request cookies
 * (NOT the service role key), so it reflects the logged-in user.
 *
 * In Next 16 `cookies()` is async, so this factory is async too.
 */
export async function createAuthClient() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  return createSsrClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // The `setAll` method can throw inside a pure Server Component
          // (no response to mutate). The proxy refreshes the session, so this
          // is safe to ignore here.
        }
      },
    },
  });
}
