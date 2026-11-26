import { supabase } from "./supabase.ts";

// Profile pictures live in the PRIVATE 'kyc' bucket, so they are shown through
// short-lived signed links. Only the agent themself and admins can create one
// (storage policy). Links are cached for 50 of their 60 minutes.
const cache = new Map<string, { url: string; expires: number }>();

export async function avatarUrl(path: string): Promise<string | null> {
  const hit = cache.get(path);
  if (hit && hit.expires > Date.now()) return hit.url;
  const { data, error } = await supabase.storage.from("kyc").createSignedUrl(path, 3600);
  if (error || !data) return null;
  cache.set(path, { url: data.signedUrl, expires: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
}
