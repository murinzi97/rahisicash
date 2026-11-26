// Edge Function: admin-delete-agent
// An ADMIN deletes an agent. Agents can never delete their own account.
// Personal data is erased; financial records are kept (anonymized).
//
// Order of work:
//  1. Verify the caller's login token and that the caller is an ACTIVE ADMIN.
//  2. anonymize_agent (database): refuses while money is still owed to the agent or
//     payments are still pending (error codes balance_not_zero / pending_payments).
//     It blanks name, phone and ID number and removes the KYC document records.
//  3. Write the audit entry naming the admin who did it.
//  4. Remove the agent's files (ID document and selfie) from the private 'kyc' bucket.
//  5. Remove the agent's login. Profile and transactions stay (anonymized).
// Leave "Verify JWT" ON. The service role key exists only as an Edge Function secret.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  let body: { agent_id?: unknown };
  try { body = await req.json(); } catch { return json(400, { error: "bad_request" }); }
  const agentId = typeof body.agent_id === "string" ? body.agent_id : "";
  if (!UUID.test(agentId)) return json(400, { error: "bad_request" });

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  // The caller must be an active admin (checked here, not trusted from the browser).
  const who = await admin.rpc("assert_admin", { p_actor: adminId });
  if (who.error) {
    if ((who.error.message ?? "").includes("not_admin")) return json(403, { error: "not_admin" });
    return json(500, { error: "unknown" });
  }

  // The target must be a real, not-yet-deleted agent.
  const target = await admin.from("profiles").select("role, anonymized_at").eq("id", agentId).maybeSingle();
  if (target.error) return json(500, { error: "unknown" });
  if (!target.data || target.data.role !== "agent" || target.data.anonymized_at) {
    return json(404, { error: "agent_not_found" });
  }

  const anon = await admin.rpc("anonymize_agent", { p_agent: agentId });
  if (anon.error) {
    const m = anon.error.message ?? "";
    if (m.includes("balance_not_zero")) return json(409, { error: "balance_not_zero" });
    if (m.includes("pending_payments")) return json(409, { error: "pending_payments" });
    console.error("anonymize_agent failed:", m);
    return json(500, { error: "unknown" });
  }

  // From here on the data is already anonymized, so a failure is safe to retry.
  await admin.from("audit_log").insert({
    actor_id: adminId, action: "agent_deleted_by_admin", entity: "profile", entity_id: agentId, details: {},
  });
  const files = await admin.storage.from("kyc").list(agentId, { limit: 100 });
  if (!files.error && files.data?.length) {
    const rm = await admin.storage.from("kyc").remove(files.data.map((f) => `${agentId}/${f.name}`));
    if (rm.error) console.error("could not remove KYC files:", rm.error.message);
  }
  await admin.from("profiles").update({ avatar_path: null, id_type: null }).eq("id", agentId);

  const del = await admin.auth.admin.deleteUser(agentId);
  if (del.error) {
    console.error("deleteUser failed:", del.error.message);
    return json(500, { error: "unknown" });
  }
  return json(200, { ok: true });
});
