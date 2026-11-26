import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** False until .env is filled in (the app then shows a setup message). */
export const configured = Boolean(url && key);

// Only the public (anon/publishable) key belongs here. The service role key
// must never appear anywhere in this app.
export const supabase = createClient(url ?? "http://localhost", key ?? "missing", {
  auth: { persistSession: true, autoRefreshToken: true },
});
