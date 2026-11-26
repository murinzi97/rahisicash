// Edge Function: admin-set-agent-status
// Approve, reject, suspend or reactivate an agent.
//
// Safety: (1) the caller must send a valid login token, (2) the database
// function re-checks that this user is an ACTIVE ADMIN and that the status
// change is allowed, and (3) every change is written to the audit log.
// The service role key lives only here, as an Edge Function secret.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = ["active", "rejected", "suspended"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Who is calling? Ask Supabase to validate the token they sent.
  const authHeader = req.headers.get("Authorization") ?? "";
  const asUser = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await asUser.auth.getUser();
  if (userErr || !userData.user) return json(401, { error: "unauthorized" });

  let body: { agent_id?: unknown; status?: unknown; note?: unknown };
  try { body = await req.json(); } catch { return json(400, { error: "bad_request" }); }

  const agentId = typeof body.agent_id === "string" ? body.agent_id : "";
  const status = typeof body.status === "string" ? body.status : "";
  const note = typeof body.note === "string" ? body.note.slice(0, 200) : null;
  if (!UUID.test(agentId) || !STATUSES.includes(status)) return json(400, { error: "bad_request" });

  const admin = createClient(url, service);
  const { error } = await admin.rpc("set_agent_status", {
    p_actor: userData.user.id, p_agent: agentId, p_status: status, p_note: note,
  });

  if (error) {
    const m = error.message ?? "";
    if (m.includes("not_admin")) return json(403, { error: "not_admin" });
    if (m.includes("invalid_transition")) return json(409, { error: "invalid_transition" });
    if (m.includes("agent_not_found")) return json(404, { error: "agent_not_found" });
    return json(500, { error: "unknown" });
  }
  return json(200, { ok: true });
});
