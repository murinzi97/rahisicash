// Edge Function: pesapal-ipn
//
// Pesapal calls this address when a payment changes. We NEVER trust what
// the notification says. Instead we:
//   1. find our own record for the tracking id (unknown ids are ignored),
//   2. ask Pesapal directly for the real status of that order,
//   3. check the amount and currency,
//   4. update the transaction and write the ledger entries through the
//      database function confirm_payment, which is idempotent: however many
//      times Pesapal notifies us, a payment is booked exactly once.
//
// IMPORTANT: deploy this function with "Verify JWT" turned OFF. Pesapal is
// not a logged-in user and cannot send a login token. That is safe here
// because nothing in the request is believed: the status always comes from
// Pesapal itself, and requests for unknown orders never reach Pesapal.
//
// Secrets: PESAPAL_CONSUMER_KEY, PESAPAL_CONSUMER_SECRET,
// PESAPAL_BASE_URL (optional; default = Pesapal SANDBOX).
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TRACKING = /^[0-9a-zA-Z-]{8,64}$/;

Deno.serve(async (req) => {
  if (req.method !== "GET" && req.method !== "POST") return json(405, { error: "method_not_allowed" });

  // Pesapal sends OrderTrackingId and OrderMerchantReference (query string for GET).
  const q = new URL(req.url).searchParams;
  let trackingId = q.get("OrderTrackingId") ?? "";
  let merchantRef = q.get("OrderMerchantReference") ?? "";
  if (req.method === "POST" && !trackingId) {
    try {
      const b = await req.json();
      trackingId = String(b?.OrderTrackingId ?? b?.orderTrackingId ?? "");
      merchantRef = String(b?.OrderMerchantReference ?? b?.orderMerchantReference ?? "");
    } catch { /* no body */ }
  }
  if (!TRACKING.test(trackingId) || (merchantRef && !UUID.test(merchantRef))) {
    return json(400, { error: "bad_request" });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  // 1. Is this an order we created? Unknown ids are ignored (and cost us no Pesapal call).
  const known = await admin.from("payment_details")
    .select("transaction_id").eq("pesapal_tracking_id", trackingId).maybeSingle();
  if (known.error) return json(500, { error: "unknown" }); // Pesapal will retry
  if (!known.data) return json(404, { error: "unknown_order" });
  const txId = known.data.transaction_id as string;
  if (merchantRef && merchantRef.toLowerCase() !== txId.toLowerCase()) return json(404, { error: "unknown_order" });

  const audit = (action: string, details: Record<string, unknown>) =>
    admin.from("audit_log").insert({ actor_id: null, action, entity: "transaction", entity_id: txId, details });

  // 2. Ask Pesapal for the real status.
  let status: Record<string, unknown>;
  try {
    const token = await pesapalToken();
    status = await ppCall(
      "GET",
      `/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(trackingId)}`,
      undefined,
      token,
    );
  } catch (e) {
    console.error("status check failed:", (e as Error).message);
    return json(502, { error: "pesapal_unreachable" }); // Pesapal will retry
  }
  // Field names only (never values), so you can see in the logs what Pesapal returns.
  console.log("pesapal status fields:", Object.keys(status).join(","));

  const ack = () =>
    json(200, {
      orderNotificationType: "IPNCHANGE",
      orderTrackingId: trackingId,
      orderMerchantReference: txId,
      status: 200,
    });

  // The status must be about OUR order.
  if (typeof status.merchant_reference === "string" && status.merchant_reference.toLowerCase() !== txId.toLowerCase()) {
    await audit("payment_reference_mismatch", { tracking_id: trackingId });
    return ack();
  }

  // Pesapal status codes: 0 invalid / not paid yet, 1 completed, 2 failed, 3 reversed.
  const code = Number(status.status_code);

  if (code === 1) {
    const paid = Number(status.amount);
    if (status.currency !== "RWF" || !Number.isFinite(paid)) {
      await audit("payment_currency_or_amount_missing", { currency: status.currency ?? null });
      return ack(); // not booked; an admin must look at it
    }
    // Pesapal's fee is not part of its status reply, so it stays empty (null) for now.
    const res = await admin.rpc("confirm_payment", {
      p_tx: txId, p_tracking_id: trackingId, p_pesapal_fee: null, p_paid_amount: paid,
    });
    if (res.error) {
      if ((res.error.message ?? "").includes("amount_mismatch")) {
        await audit("payment_amount_mismatch", { paid_according_to_pesapal: paid });
        return ack();
      }
      console.error("confirm_payment failed:", res.error.message);
      return json(500, { error: "unknown" }); // Pesapal will retry
    }
    if (res.data === "voided") {
      // The client paid for a transaction the admin had already voided: needs a human (refund).
      await audit("payment_received_for_voided_transaction", { paid_according_to_pesapal: paid });
    }
    return ack();
  }

  if (code === 2) {
    await admin.rpc("mark_payment_status", { p_tx: txId, p_status: "failed" });
    return ack();
  }

  if (code === 3) {
    // Reversed by Pesapal after payment. Money moved, so a person decides what to do.
    await audit("payment_reversed_at_pesapal", { tracking_id: trackingId });
    return ack();
  }

  return ack(); // 0: nothing to do yet
});
