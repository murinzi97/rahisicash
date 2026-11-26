// Rahisi Cash: minimal Pesapal API 3.0 client (access token + JSON calls).
// Used by `create-payment` and `pesapal-ipn`. Each function holds an identical
// copy of this file (so you can paste a single file into the Supabase editor);
// `npm test` fails if a copy drifts from this one.
//
// Secrets come from Edge Function environment variables, never from the app:
//   PESAPAL_CONSUMER_KEY, PESAPAL_CONSUMER_SECRET
//   PESAPAL_BASE_URL (optional; default is the SANDBOX)
//     sandbox:    https://cybqa.pesapal.com/pesapalv3
//     production: https://pay.pesapal.com/v3

const PP_BASE = (Deno.env.get("PESAPAL_BASE_URL") ?? "https://cybqa.pesapal.com/pesapalv3").replace(/\/+$/, "");

let ppTokenCache: { token: string; expires: number } | null = null;

/** One JSON call to Pesapal. Throws a short error code, never the secrets or the response body. */
async function ppCall(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  token?: string,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${PP_BASE}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  let json: Record<string, unknown> = {};
  try { json = await res.json(); } catch { /* the reply was not JSON */ }
  if (!res.ok) throw new Error(`pesapal_http_${res.status}`);
  const err = json.error as { code?: string; message?: string } | null | undefined;
  if (err && (err.code || err.message)) {
    // Pesapal's own explanation helps find the bad field. It never contains our secrets.
    console.error("pesapal said:", String(err.message ?? "").slice(0, 300));
    throw new Error(`pesapal_error_${err.code ?? "unknown"}`);
  }
  return json;
}

/** Pesapal tokens last about 5 minutes; we reuse one for 4. */
async function pesapalToken(): Promise<string> {
  if (ppTokenCache && ppTokenCache.expires > Date.now()) return ppTokenCache.token;
  const key = Deno.env.get("PESAPAL_CONSUMER_KEY");
  const secret = Deno.env.get("PESAPAL_CONSUMER_SECRET");
  if (!key || !secret) throw new Error("pesapal_not_configured");
  const r = await ppCall("POST", "/api/Auth/RequestToken", { consumer_key: key, consumer_secret: secret });
  const token = typeof r.token === "string" ? r.token : "";
  if (!token) throw new Error("pesapal_no_token");
  ppTokenCache = { token, expires: Date.now() + 4 * 60 * 1000 };
  return token;
}
