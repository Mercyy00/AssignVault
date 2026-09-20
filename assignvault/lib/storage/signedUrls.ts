import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type DB = SupabaseClient<Database>;

export type PrivateBucket = "raw-uploads" | "templates";

/**
 * Create a short-lived signed URL for a private storage object. Both buckets
 * (raw-uploads, templates) are private, so admins can only view files through
 * a signed URL minted server-side with the service-role client.
 *
 * @param expiresInSeconds default 300 (5 minutes) — deliberately short so links
 *   pasted or logged elsewhere expire quickly.
 */
export async function createSignedUrl(
  supabase: DB,
  bucket: PrivateBucket,
  path: string,
  expiresInSeconds = 300
): Promise<{ url: string | null; error: string | null }> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (error) return { url: null, error: error.message };
  return { url: data?.signedUrl ?? null, error: null };
}

/**
 * Download a private object into a Buffer (for server-side processing such as
 * rendering a docx preview with mammoth or running test-generate).
 */
export async function downloadObject(
  supabase: DB,
  bucket: PrivateBucket,
  path: string
): Promise<{ buffer: Buffer | null; error: string | null }> {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error) return { buffer: null, error: error.message };
  if (!data) return { buffer: null, error: "No data returned from storage." };
  const arrayBuffer = await data.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), error: null };
}
