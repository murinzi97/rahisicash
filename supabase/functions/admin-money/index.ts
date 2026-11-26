// Edge Function: admin-money
// Every admin action that changes money or settings goes through here, so the
// service role key never reaches the browser. One function = one thing to deploy.
//
//   action "void_transaction"  { transaction_id, reason }
//   action "create_payout"     { agent_id, date (YYYY-MM-DD), expected_total }
//   action "reset_balance"     { confirm: "RESET" }
//   action "set_fees"          { commission_percent, system_fee_percent }
//   action "set_pesapal_fee"   { transaction_id, fee (number, or null to clear) }
//
// Order of work for every call:
//  1. Verify the caller's login token.
//  2. Check the caller is an ACTIVE ADMIN (assert_admin in the database; the role is
//     never taken from the request).
//  3. Validate the input here, then call the database function, which does the money
//     work in one transaction and writes the audit_log entry (who, what, when).
// Leave "Verify JWT" ON.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** Safety cap against typing 200 instead of 2. Change here and in src/lib/adminFees.ts. */
const MAX_PERCENT = 20;

/** Database exception text -> [HTTP status, short error code the app translates]. */
const KNOWN: [string, number][] = [
  ["not_admin", 403], ["reason_required", 400], ["transaction_not_found", 404],
  ["already_voided", 409], ["already_paid_out", 409], ["agent_not_found", 404],
  ["nothing_to_pay", 409], ["amount_changed", 409], ["nothing_to_reset", 409],
  ["not_paid", 409], ["invalid_fee", 400],
];
function failure(message: string): Response {
  for (const [code, status] of KNOWN) if (message.includes(code)) return json(status, { error: code });
  console.error("admin-money database error:", message);
  return json(500, { error: "unknown" });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const url = Deno.env.get("SUPABASE_URL")!;
  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: userData, error: userErr } = await asUser.auth.getUser();
  if (userErr || !userData.user) return json(401, { error: "unauthorized" });
  const adminId = userData.user.id;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(400, { error: "invalid_request" }); }
  if (typeof body !== "object" || body === null) return json(400, { error: "invalid_request" });

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const who = await admin.rpc("assert_admin", { p_actor: adminId });
  if (who.error) return failure(who.error.message ?? "");

  switch (body.action) {
    case "void_transaction": {
      const id = typeof body.transaction_id === "string" ? body.transaction_id : "";
      const reason = typeof body.reason === "string" ? body.reason.trim().replace(/\s+/g, " ") : "";
      if (!UUID.test(id)) return json(400, { error: "invalid_request" });
      if (reason.length < 3) return json(400, { error: "reason_required" });
      if (reason.length > 300) return json(400, { error: "invalid_request" });
      const r = await admin.rpc("void_transaction", { p_actor: adminId, p_tx: id, p_reason: reason });
      return r.error ? failure(r.error.message ?? "") : json(200, { ok: true });
    }

    case "create_payout": {
      const agent = typeof body.agent_id === "string" ? body.agent_id : "";
      const date = typeof body.date === "string" ? body.date : "";
      const expected = body.expected_total;
      if (!UUID.test(agent) || !DAY.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
        return json(400, { error: "invalid_request" });
      }
      if (typeof expected !== "number" || !Number.isInteger(expected) || expected <= 0) {
        return json(400, { error: "invalid_request" });
      }
      const r = await admin.rpc("create_payout", {
        p_actor: adminId, p_agent: agent, p_date: date, p_expected_total: expected,
      });
      return r.error ? failure(r.error.message ?? "") : json(200, { payout_id: r.data });
    }

    case "reset_balance": {
      // The typed word is checked here as well as in the dialog.
      if (body.confirm !== "RESET") return json(400, { error: "invalid_request" });
      const r = await admin.rpc("reset_system_balance", { p_actor: adminId });
      return r.error ? failure(r.error.message ?? "") : json(200, { reset_amount: r.data });
    }

    case "set_fees": {
      const c = body.commission_percent;
      const s = body.system_fee_percent;
      const ok = (v: unknown): v is number =>
        typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= MAX_PERCENT &&
        Math.abs(Math.round(v * 100) - v * 100) < 1e-6; // at most 2 decimals
      if (!ok(c) || !ok(s)) return json(400, { error: "invalid_percent" });
      const r = await admin.rpc("set_fee_settings", { p_actor: adminId, p_commission: c, p_system: s });
      return r.error ? failure(r.error.message ?? "") : json(200, { ok: true });
    }

    case "set_pesapal_fee": {
      const id = typeof body.transaction_id === "string" ? body.transaction_id : "";
      const fee = body.fee;
      if (!UUID.test(id)) return json(400, { error: "invalid_request" });
      if (fee !== null && (typeof fee !== "number" || !Number.isFinite(fee) || fee < 0 || fee > 100_000_000)) {
        return json(400, { error: "invalid_fee" });
      }
      const r = await admin.rpc("set_pesapal_fee", { p_actor: adminId, p_tx: id, p_fee: fee });
      return r.error ? failure(r.error.message ?? "") : json(200, { ok: true });
    }

    default:
      return json(400, { error: "invalid_request" });
  }
});
