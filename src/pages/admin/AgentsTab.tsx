import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase.ts";
import { callFunction } from "../../lib/api.ts";
import { formatPhone } from "../../lib/phone.ts";
import { useI18n } from "../../i18n/index.tsx";
import { Modal } from "../../components/Modal.tsx";
import { Avatar } from "../../components/Avatar.tsx";
import type { AgentStatus } from "../../lib/types.ts";
import type { Key } from "../../i18n/en.ts";

interface AgentRow {
  id: string; full_name: string; phone: string | null;
  id_number: string | null; id_type: "national_id" | "passport" | null;
  avatar_path: string | null; status: AgentStatus; created_at: string; anonymized_at: string | null;
}
interface KycFile { id: string; url: string; isPdf: boolean; kind: "id_document" | "selfie" }
type Filter = "all" | AgentStatus;
const FILTERS: Filter[] = ["all", "pending", "active", "suspended", "rejected"];
const PILL: Record<AgentStatus, string> = {
  pending: "pill-warn", active: "pill-ok", suspended: "pill-bad", rejected: "pill-bad",
};

export default function AgentsTab() {
  const { t, lang } = useI18n();
  const [rows, setRows] = useState<AgentRow[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<Key | null>(null);
  const [confirm, setConfirm] = useState<{ agent: AgentRow; to: "rejected" | "suspended" } | null>(null);
  const [note, setNote] = useState("");
  const [deleting, setDeleting] = useState<AgentRow | null>(null);
  const [kyc, setKyc] = useState<{ agent: AgentRow; files: KycFile[] | null; failed: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoadFailed(false);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, phone, id_number, id_type, avatar_path, status, created_at, anonymized_at")
      .eq("role", "agent")
      .order("created_at", { ascending: false });
    if (error) { setLoadFailed(true); return; }
    setRows(data as AgentRow[]);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function setStatus(agent: AgentRow, to: AgentStatus, noteText?: string) {
    setBusy(agent.id);
    setMessage(null);
    const res = await callFunction("admin-set-agent-status", {
      agent_id: agent.id, status: to, note: noteText?.trim() || undefined,
    });
    setBusy(null);
    if (res.error) {
      const key = `error.${res.error}` as Key;
      setMessage(["error.not_admin", "error.invalid_transition", "error.agent_not_found"].includes(key) ? key : "error.unknown");
    }
    setConfirm(null);
    setNote("");
    await load();
  }

  async function deleteAgent(agent: AgentRow) {
    setBusy(agent.id);
    setMessage(null);
    const res = await callFunction("admin-delete-agent", { agent_id: agent.id });
    setBusy(null);
    setDeleting(null);
    if (res.error) {
      const key = `error.${res.error}` as Key;
      setMessage(["error.not_admin", "error.agent_not_found", "error.balance_not_zero", "error.pending_payments"].includes(key) ? key : "error.unknown");
    }
    await load();
  }

  async function openKyc(agent: AgentRow) {
    setKyc({ agent, files: null, failed: false });
    const { data, error } = await supabase
      .from("kyc_documents").select("id, storage_path, kind").eq("agent_id", agent.id)
      .order("kind", { ascending: true });
    if (error) { setKyc({ agent, files: null, failed: true }); return; }
    const files: KycFile[] = [];
    for (const d of data ?? []) {
      const signed = await supabase.storage.from("kyc").createSignedUrl(d.storage_path, 300);
      if (signed.error || !signed.data) { setKyc({ agent, files: null, failed: true }); return; }
      files.push({ id: d.id, url: signed.data.signedUrl, isPdf: d.storage_path.toLowerCase().endsWith(".pdf"), kind: d.kind });
    }
    setKyc({ agent, files, failed: false });
  }

  const date = (iso: string) =>
    new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", { dateStyle: "medium", timeZone: "Africa/Kigali" }).format(new Date(iso));
  const shown = (rows ?? []).filter((r) => filter === "all" || r.status === filter);

  return (
    <section>
      <h1 className="page-title">{t("agents.title")}</h1>
      <div className="chips" role="group">
        {FILTERS.map((f) => (
          <button key={f} type="button" className={"chip" + (filter === f ? " is-on" : "")} onClick={() => setFilter(f)}>
            {f === "all" ? t("agents.filterAll") : t(`status.${f}` as Key)}
          </button>
        ))}
      </div>

      {message && <p className="error" role="alert">{t(message)}</p>}
      {loadFailed && (
        <p className="error" role="alert">
          {t("agents.loadError")}{" "}
          <button type="button" className="link-btn" onClick={() => void load()}>{t("common.retry")}</button>
        </p>
      )}
      {rows === null && !loadFailed && <p className="muted">{t("common.loading")}</p>}
      {rows !== null && shown.length === 0 && (
        <p className="muted">{rows.length === 0 ? t("agents.empty") : t("agents.emptyFilter")}</p>
      )}

      {shown.length > 0 && (
        <div className="agent-list">
          <div className="agent-head">
            <span>{t("agents.col.name")}</span><span>{t("agents.col.contact")}</span>
            <span>{t("agents.col.status")}</span><span>{t("agents.col.joined")}</span>
            <span className="right">{t("agents.col.actions")}</span>
          </div>
          {shown.map((a) => (
            <article key={a.id} className="agent-row card">
              <span className="name-cell"><Avatar path={a.avatar_path} name={a.full_name} size={44} /><strong>{a.full_name}</strong></span>
              <span className="muted">{formatPhone(a.phone)}<br />{a.id_type ? `${t(`register.idType.${a.id_type}` as Key)}: ` : ""}{a.id_number ?? ""}</span>
              <span><span className={`pill ${PILL[a.status]}`}>{t(`status.${a.status}` as Key)}</span></span>
              <span className="muted">{date(a.created_at)}</span>
              <span className="row-actions">
                <button type="button" className="btn-sm btn-outline" onClick={() => void openKyc(a)}>{t("action.viewKyc")}</button>
                {a.status === "pending" && (<>
                  <button type="button" className="btn-sm btn-danger" disabled={busy === a.id} onClick={() => setConfirm({ agent: a, to: "rejected" })}>{t("action.reject")}</button>
                  <button type="button" className="btn-sm" disabled={busy === a.id} onClick={() => void setStatus(a, "active")}>{t("action.approve")}</button>
                </>)}
                {a.status === "active" && (
                  <button type="button" className="btn-sm btn-danger" disabled={busy === a.id} onClick={() => setConfirm({ agent: a, to: "suspended" })}>{t("action.suspend")}</button>
                )}
                {a.status === "suspended" && (
                  <button type="button" className="btn-sm" disabled={busy === a.id} onClick={() => void setStatus(a, "active")}>{t("action.reactivate")}</button>
                )}
                {!a.anonymized_at && (
                  <button type="button" className="btn-sm btn-danger" disabled={busy === a.id} onClick={() => setDeleting(a)}>{t("action.delete")}</button>
                )}
              </span>
            </article>
          ))}
        </div>
      )}

      {confirm && (
        <Modal title={t(confirm.to === "rejected" ? "confirm.rejectTitle" : "confirm.suspendTitle")} onClose={() => setConfirm(null)}>
          <p className="subtle">{t(confirm.to === "rejected" ? "confirm.rejectText" : "confirm.suspendText", { name: confirm.agent.full_name })}</p>
          <label className="label" htmlFor="note">{t("confirm.note")}</label>
          <input id="note" className="input" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={() => setConfirm(null)}>{t("common.cancel")}</button>
            <button type="button" className="btn btn-danger-solid" disabled={busy === confirm.agent.id}
                    onClick={() => void setStatus(confirm.agent, confirm.to, note)}>
              {t(confirm.to === "rejected" ? "action.reject" : "action.suspend")}
            </button>
          </div>
        </Modal>
      )}

      {deleting && (
        <Modal title={t("confirm.deleteTitle")} onClose={() => { if (busy !== deleting.id) setDeleting(null); }}>
          <p className="subtle">{t("confirm.deleteText", { name: deleting.full_name })}</p>
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" disabled={busy === deleting.id} onClick={() => setDeleting(null)}>{t("common.cancel")}</button>
            <button type="button" className="btn btn-danger-solid" disabled={busy === deleting.id} onClick={() => void deleteAgent(deleting)}>{t("action.delete")}</button>
          </div>
        </Modal>
      )}

      {kyc && (
        <Modal title={`${t("kyc.title")}: ${kyc.agent.full_name}`} onClose={() => setKyc(null)}>
          {kyc.failed && <p className="error" role="alert">{t("kyc.loadError")}</p>}
          {!kyc.failed && kyc.files === null && <p className="muted">{t("common.loading")}</p>}
          {kyc.files?.length === 0 && <p className="muted">{t("kyc.none")}</p>}
          {kyc.files?.map((f) => (
            <figure key={f.id} className="kyc-item">
              <figcaption className="label">{t(f.kind === "selfie" ? "kyc.selfie" : "kyc.document")}</figcaption>
              {f.isPdf
                ? <a className="link-bold" href={f.url} target="_blank" rel="noopener noreferrer">{t("kyc.openPdf")}</a>
                : <img className="kyc-img" src={f.url} alt={t(f.kind === "selfie" ? "kyc.selfie" : "kyc.document")} />}
            </figure>
          ))}
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={() => setKyc(null)}>{t("common.close")}</button>
          </div>
        </Modal>
      )}
    </section>
  );
}
