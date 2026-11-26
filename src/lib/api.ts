import { supabase } from "./supabase.ts";

export type ApiResult<T> = { data: T; error?: undefined } | { data?: undefined; error: string };

/** Calls an Edge Function. On failure returns the short error code the function sent. */
export async function callFunction<T>(name: string, body: unknown): Promise<ApiResult<T>> {
  const { data, error } = await supabase.functions.invoke(name, { body: body as Record<string, unknown> });
  if (!error) return { data: data as T };
  let code = "unknown";
  const ctx = (error as { context?: Response }).context;
  if (ctx && typeof ctx.json === "function") {
    try {
      const j = (await ctx.json()) as { error?: string };
      if (j?.error) code = j.error;
    } catch { /* keep "unknown" */ }
  }
  return { error: code };
}
