import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr";
import { Database } from "@/types/database";

/**
 * Browser Supabase client using anon key.
 * Only used for authenticated admin features (Step 9).
 */
export function createBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  return createSupabaseBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}
