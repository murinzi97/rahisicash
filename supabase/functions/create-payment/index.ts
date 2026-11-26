// Edge Function: create-payment
//
// An ACTIVE AGENT asks for a withdrawal. This function:
//   1. checks who is calling (login token) and their role/status in the database,
//   2. validates every input,
//   3. calculates the fees HERE, from the current fee_settings (the app's own
//      numbers are never trusted, and are not even accepted),
//   4. creates the transaction, registers the order with Pesapal for total_paid,
//   5. returns the payment link.
//
// Two modes:
//   { dry_run: true, amount }  -> only returns the fee breakdown (the live
//                                 preview on the form). Writes nothing.
//   { request_id, amount, client_name, client_phone, client_email?, client_language }
//                              -> creates the payment. `request_id` is a random id
//                                 made by the app for each attempt, so a double tap
//                                 or a retry never creates two payments.
//
// Secrets (set under Edge Functions -> Secrets, never in the app):
//   PESAPAL_CONSUMER_KEY, PESAPAL_CONSUMER_SECRET, APP_URL
//   PESAPAL_BASE_URL (optional; default = Pesapal SANDBOX)
// Supabase adds SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY itself.
// Leave "Verify JWT" ON for this function.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// ---------------------------------------------------------------------
// Shared code. These blocks are identical copies of the files named in
// the comments. `npm test` fails if a copy and its source ever differ.
// ---------------------------------------------------------------------

// BEGIN shared: fees (copy of supabase/functions/_shared/fees.ts)
// Rahisi Cash: fee calculation.
// Pure functions, no imports. Used by the `create-payment` Edge Function
// (the only place fees are ever calculated) and by the admin preview.
//
// All money values are whole RWF (integers). Percentages may have up to
// 2 decimals (for example 1.5). Maths is done in integers (hundredths of a
// percent) so floating-point error can never change a fee.

interface FeeSettings {
  commissionPercent: number; // agent commission, % of the amount
  systemFeePercent: number; // Rahisi Cash system fee, % of the amount
}

interface FeeResult {
  amount: number;
  commission_percent: number;
  system_fee_percent: number;
  agent_commission: number;
  system_fee: number;
  total_fee: number;
  total_paid: number; // charged to the client = amount + total_fee
  agent_owed: number; // owed to the agent = amount + agent_commission
}

const MAX_AMOUNT = 100_000_000; // safety cap, RWF

/** Percent -> hundredths of a percent, as an integer (1.5% -> 150). */
function toBasisPoints(pct: number, label: string): number {
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    throw new RangeError(`${label} must be between 0 and 100`);
  }
  const bp = Math.round(pct * 100);
  if (Math.abs(bp - pct * 100) > 1e-6) {
    throw new RangeError(`${label} can have at most 2 decimals`);
  }
  return bp;
}

/** amount * basisPoints / 10000, rounded to the nearest RWF (0.5 rounds up). */
function percentOf(amount: number, bp: number): number {
  return Math.floor((amount * bp + 5000) / 10000);
}

function calculateFees(amount: number, s: FeeSettings): FeeResult {
  if (!Number.isInteger(amount) || amount <= 0 || amount > MAX_AMOUNT) {
    throw new RangeError("amount must be a whole number of RWF greater than 0");
  }
  const cBp = toBasisPoints(s.commissionPercent, "commissionPercent");
  const sBp = toBasisPoints(s.systemFeePercent, "systemFeePercent");

  // 1. Round the commission and the combined fee separately.
  const commissionRounded = percentOf(amount, cBp);
  const totalRounded = percentOf(amount, cBp + sBp);

  // 2. System fee = combined fee minus the rounded commission, so the
  //    parts always add up exactly (no 1 RWF drift from double rounding).
  const agent_commission = commissionRounded;
  const system_fee = totalRounded - commissionRounded;
  const total_fee = totalRounded;
  return {
    amount,
    commission_percent: s.commissionPercent,
    system_fee_percent: s.systemFeePercent,
    agent_commission,
    system_fee,
    total_fee,
    total_paid: amount + total_fee,
    agent_owed: amount + agent_commission,
  };
}
// END shared: fees

// BEGIN shared: phone (copy of the marked block in src/lib/phone.ts)
const RW = /^7[2389]\d{7}$/;   // Rwanda: 72, 73, 78, 79 + 7 digits
const CD = /^[89]\d{8}$/;      // DR Congo mobile: 8 or 9 + 8 digits (9 digits in all)

function clean(input: string): string {
  return input.replace(/[\s\-().]/g, "");
}

/**
 * Agent phones: Rwanda (+250) or DR Congo (+243).
 * With a country code (+, 00, or a leading 250/243) the code decides.
 * Without one, the number is read as local: 07x is Rwanda, 08x/09x is DR Congo.
 * Operator prefixes are not checked for DR Congo (sources disagree on them).
 */
function normalizeAgentPhone(input: string): string | null {
  let d = clean(input);
  let intl = false;
  if (d.startsWith("+")) { d = d.slice(1); intl = true; }
  else if (d.startsWith("00")) { d = d.slice(2); intl = true; }

  if (d.startsWith("250") && (intl || d.length === 12)) {
    return RW.test(d.slice(3)) ? `+${d}` : null;
  }
  if (d.startsWith("243") && (intl || d.length === 12)) {
    return CD.test(d.slice(3)) ? `+${d}` : null;
  }
  if (intl) return null;

  if (d.startsWith("0")) d = d.slice(1);
  if (RW.test(d)) return `+250${d}`;
  if (CD.test(d)) return `+243${d}`;
  return null;
}

/**
 * CLIENT phones (the customer who pays the link) can be from ANY country.
 * - "+..." or "00..." : international format. Rwanda and DR Congo numbers get the
 *   same strict checks as agents; every other country is checked as E.164 only
 *   (7 to 15 digits, no leading 0). This cannot tell whether a number really
 *   exists in that country.
 * - No country code: read as a Rwandan or Congolese local number (07x / 08x / 09x).
 *   Anything else must be typed with its country code.
 */
function normalizeClientPhone(input: string): string | null {
  let d = clean(input);
  let intl = false;
  if (d.startsWith("+")) { d = d.slice(1); intl = true; }
  else if (d.startsWith("00")) { d = d.slice(2); intl = true; }

  if (!intl) return normalizeAgentPhone(input);

  if (d.startsWith("250") || d.startsWith("243")) return normalizeAgentPhone(`+${d}`);
  return /^[1-9]\d{6,14}$/.test(d) ? `+${d}` : null;
}
// END shared: phone

// BEGIN shared: pesapal (copy of supabase/functions/_shared/pesapal.ts)
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
// END shared: pesapal

// ---------------------------------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Smallest withdrawal in RWF. The app shows the same number (src/lib/withdrawal.ts). */
const MIN_AMOUNT = 1000;
/** Rate limit: at most this many NEW payments per agent in the window. */
const RATE_MAX = 10;
const RATE_WINDOW_MINUTES = 10;

const countryOf = (phone: string) => (phone.startsWith("+250") ? "RW" : phone.startsWith("+243") ? "CD" : "");

/** Numeric postal code: the PESAPAL_BILLING_POSTAL_CODE secret if it is a number, else a placeholder. */
function postalFields(): Record<string, number> {
  const raw = (Deno.env.get("PESAPAL_BILLING_POSTAL_CODE") ?? "").trim();
  const n = /^\d{1,9}$/.test(raw) ? Number(raw) : 250;
  return { postal_code: n, zip_code: n };
}

/** The Pesapal IPN id is registered once and remembered in app_config. */
async function getIpnId(admin: ReturnType<typeof createClient>, token: string, supabaseUrl: string): Promise<string> {
  const ipnUrl = Deno.env.get("PESAPAL_IPN_URL") ?? `${supabaseUrl}/functions/v1/pesapal-ipn`;
  const key = `pesapal_ipn_id|${PP_BASE}|${ipnUrl}`;
  const found = await admin.from("app_config").select("value").eq("key", key).maybeSingle();
  if (found.data?.value) return found.data.value as string;

  const r = await ppCall("POST", "/api/URLSetup/RegisterIPN", { url: ipnUrl, ipn_notification_type: "GET" }, token);
  const id = typeof r.ipn_id === "string" ? r.ipn_id : "";
  if (!id) throw new Error("pesapal_no_ipn_id");
  await admin.from("app_config").upsert({ key, value: id, updated_at: new Date().toISOString() });
  return id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const appUrl = (Deno.env.get("APP_URL") ?? "").replace(/\/+$/, "");

  // 1. Who is calling? Supabase validates the token.
  const asUser = createClient(url, anon, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: userData, error: userErr } = await asUser.auth.getUser();
  if (userErr || !userData.user) return json(401, { error: "unauthorized" });
  const uid = userData.user.id;

  // Role and status come from the database, never from the request.
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const me = await admin.from("profiles").select("role, status").eq("id", uid).maybeSingle();
  if (!me.data || me.data.role !== "agent" || me.data.status !== "active") {
    return json(403, { error: "not_active_agent" });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(400, { error: "invalid_request" }); }
  if (typeof body !== "object" || body === null) return json(400, { error: "invalid_request" });

  // 2. The amount, then the fees (calculated here, from the newest fee_settings row).
  const amount = body.amount;
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
    return json(400, { error: "invalid_amount" });
  }
  const fs = await admin.from("fee_settings")
    .select("commission_percent, system_fee_percent")
    .order("id", { ascending: false }).limit(1).maybeSingle();
  if (fs.error || !fs.data) return json(500, { error: "server_misconfigured" });

  let fees: FeeResult;
  try {
    fees = calculateFees(amount, {
      commissionPercent: Number(fs.data.commission_percent),
      systemFeePercent: Number(fs.data.system_fee_percent),
    });
  } catch {
    return json(500, { error: "server_misconfigured" });
  }
  // The agent sees only these four numbers, never the system fee split.
  const quote = {
    amount: fees.amount,
    total_fee: fees.total_fee,
    total_paid: fees.total_paid,
    agent_owed: fees.agent_owed,
  };
  if (body.dry_run === true) return json(200, { quote });

  // 3. Validate the rest of the input.
  const requestId = typeof body.request_id === "string" ? body.request_id : "";
  if (!UUID.test(requestId)) return json(400, { error: "invalid_request" });

  const name = typeof body.client_name === "string" ? body.client_name.trim().replace(/\s+/g, " ") : "";
  if (name.length < 2 || name.length > 120) return json(400, { error: "invalid_name" });

  const phone = typeof body.client_phone === "string" ? normalizeClientPhone(body.client_phone) : null;
  if (!phone) return json(400, { error: "invalid_phone" });

  let email: string | null = null;
  if (body.client_email !== undefined && body.client_email !== null && body.client_email !== "") {
    const e = typeof body.client_email === "string" ? body.client_email.trim() : "";
    if (e.length > 254 || !EMAIL.test(e)) return json(400, { error: "invalid_email" });
    email = e;
  }

  const lang = body.client_language;
  if (lang !== "en" && lang !== "fr") return json(400, { error: "invalid_language" });

  if (!appUrl) return json(500, { error: "server_misconfigured" });

  // 4. Same request_id seen before? Return that payment instead of making another.
  const prior = await admin.from("transactions")
    .select("id, status, payment_link, amount, agent_commission, total_fee, total_paid")
    .eq("agent_id", uid).eq("request_id", requestId).maybeSingle();
  if (prior.data) {
    const p = prior.data;
    if (p.payment_link) {
      return json(200, {
        transaction_id: p.id,
        payment_link: p.payment_link,
        status: p.status,
        quote: { amount: p.amount, total_fee: p.total_fee, total_paid: p.total_paid, agent_owed: p.amount + p.agent_commission },
      });
    }
    return json(p.status === "failed" ? 502 : 409, {
      error: p.status === "failed" ? "payment_provider_error" : "in_progress",
    });
  }

  // 5. Rate limit (counts payments created by this agent in the last few minutes).
  const since = new Date(Date.now() - RATE_WINDOW_MINUTES * 60_000).toISOString();
  const recent = await admin.from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", uid).gte("created_at", since);
  if ((recent.count ?? 0) >= RATE_MAX) return json(429, { error: "rate_limited" });

  // 6. Create the transaction. All fee fields are stored, so later fee changes never alter it.
  const ins = await admin.from("transactions").insert({
    agent_id: uid,
    client_name: name,
    client_phone: phone,
    client_email: email,
    client_language: lang,
    amount: fees.amount,
    commission_percent: fees.commission_percent,
    system_fee_percent: fees.system_fee_percent,
    agent_commission: fees.agent_commission,
    system_fee: fees.system_fee,
    total_fee: fees.total_fee,
    total_paid: fees.total_paid,
    request_id: requestId,
  }).select("id").single();
  if (ins.error || !ins.data) {
    if (ins.error?.code === "23505") return json(409, { error: "in_progress" }); // a parallel duplicate
    console.error("transaction insert failed:", ins.error?.code);
    return json(500, { error: "unknown" });
  }
  const txId = ins.data.id as string;

  // 7. Register the order with Pesapal. Pesapal charges the client total_paid.
  let link = "";
  try {
    const token = await pesapalToken();
    const ipnId = await getIpnId(admin, token, url);
    // Pesapal rejects an empty middle name (even though its docs say optional) and wants a last name,
    // so: first word = first name, last word = last name, words in between = middle name.
    const parts = name.split(" ");
    const firstName = parts[0];
    const lastName = parts.length > 1 ? parts[parts.length - 1] : firstName;
    const middleName = parts.length > 2 ? parts.slice(1, -1).join(" ") : "-";
    const order = await ppCall("POST", "/api/Transactions/SubmitOrderRequest", {
      id: txId, // our merchant reference
      currency: "RWF",
      amount: fees.total_paid,
      // shown to the client on Pesapal's page, so it follows the language chosen for this withdrawal
      description: lang === "fr" ? "Retrait Rahisi Cash" : "Rahisi Cash withdrawal",
      callback_url: `${appUrl}/pay/done?lang=${lang}`,
      cancellation_url: `${appUrl}/pay/done?lang=${lang}&cancelled=1`,
      notification_id: ipnId,
      billing_address: {
        email_address: email ?? "",
        phone_number: phone,
        country_code: countryOf(phone) || "RW", // other countries: Pesapal needs a value, so use the merchant's
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        // We do not collect an address, so Pesapal's billing form is filled with these defaults
        // and the client only has to enter the card. Optional secrets override them.
        line_1: Deno.env.get("PESAPAL_BILLING_LINE_1") || "Kigali",
        // Pesapal rejects empty billing fields ("... cannot be null or empty"), so every one gets a value.
        line_2: Deno.env.get("PESAPAL_BILLING_LINE_2") || "-",
        city: Deno.env.get("PESAPAL_BILLING_CITY") || "Kigali",
        state: "KGL", // Pesapal allows at most 3 characters
        // Pesapal documents postal_code and zip_code as NUMBERS (Rwanda has no postal codes,
        // so a placeholder is used unless a number is set in the optional secret).
        ...postalFields(),
      },
    }, token);

    const redirect = typeof order.redirect_url === "string" ? order.redirect_url : "";
    const tracking = typeof order.order_tracking_id === "string" ? order.order_tracking_id : "";
    if (!redirect.startsWith("https://") || !tracking) throw new Error("pesapal_bad_order_reply");
    link = redirect;

    // Remember Pesapal's tracking id BEFORE the client can pay, so the IPN can find this order.
    const det = await admin.from("payment_details")
      .upsert({ transaction_id: txId, pesapal_tracking_id: tracking }, { onConflict: "transaction_id" });
    if (det.error) throw new Error("payment_details_failed");
  } catch (e) {
    console.error("pesapal order failed:", (e as Error).message);
    await admin.rpc("mark_payment_status", { p_tx: txId, p_status: "failed" });
    return json(502, { error: "payment_provider_error" });
  }

  const upd = await admin.from("transactions").update({ payment_link: link }).eq("id", txId);
  if (upd.error) console.error("could not store payment_link:", upd.error.code);

  return json(200, { transaction_id: txId, payment_link: link, status: "pending", quote });
});
