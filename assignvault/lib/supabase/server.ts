import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/database";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/**
 * Service-role Supabase client for server-side API routes and data queries.
 * NEVER import this file into Client Components.
 */
export function createServerClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    // Return null or client with dummy URL if not configured yet
    return null;
  }

  return createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
