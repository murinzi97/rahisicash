import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase.ts";
import { callFunction } from "../../lib/api.ts";
import { MAX_PERCENT, parsePercent } from "../../lib/adminFees.ts";
import { calculateFees } from "../../lib/fees.ts";
import { PESAPAL_FEE_PERCENT, pesapalFee } from "../../lib/pesapal.ts";
import { formatRwf } from "../../lib/money.ts";
import { useI18n } from "../../i18n/index.tsx";
import type { Key } from "../../i18n/en.ts";
import { Banner, LoadGate, errKey, useLoad } from "./ui.tsx";

const PREVIEW_AMOUNT = 10000;
const show = (n: number) => String(n);

export default function FeesTab() {
  const { t, lang } = useI18n();
  const [commission, setCommission] = useState("");
  const [system, setSystem] = useState("");
  const [saved, setSaved] = useState<{ c: number; s: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ kind: "ok" | "bad"; key: Key } | null>(null);

  // The newest row is the current setting.
  const q = useLoad(async () => {
    const { data, error } = await supabase.from("fee_settings").select("commission_percent, system_fee_percent")
      .order("id", { ascending: false }).limit(1).single();
    if (error) throw error;
    return { c: Number(data.commission_percent), s: Number(data.system_fee_percent) };
  }, []);
  useEffect(() => {
    if (!q.data) return;
    setSaved(q.data);
    setCommission(show(q.data.c));
    setSystem(show(q.data.s));
  }, [q.data]);

  const c = parsePercent(commission);
  const s = parsePercent(system);
  const valid = c !== null && s !== null;
  const unchanged = valid && saved !== null && c === saved.c && s === saved.s;
  const preview = useMemo(() => (valid ? calculateFees(PREVIEW_AMOUNT, { commissionPercent: c, systemFeePercent: s }) : null), [valid, c, s]);

  async function save() {
    if (!valid) return;
    setBusy(true);
    setBanner(null);
    const res = await callFunction("admin-money", { action: "set_fees", commission_percent: c, system_fee_percent: s });
    setBusy(false);
    if (res.error) { setBanner({ kind: "bad", key: errKey(res.error) }); return; }
    setBanner({ kind: "ok", key: "admin.fees.saved" });
    setSaved({ c, s });
  }

  const invalidText = t("admin.fees.invalid", { max: String(MAX_PERCENT) });
  return (
    <>
      <h1 className="page-title">{t("admin.tab.fees")}</h1>
      <LoadGate state={q.state} onRetry={q.reload} errorKey="admin.fees.error">
        <div className="fees-grid">
          <section className="card card-pad">
            <div className="fees-fields">
              <div>
                <label className="label" htmlFor="fee-c">{t("admin.fees.commission")}</label>
                <div className="input-suffix">
                  <input id="fee-c" className="input" inputMode="decimal" value={commission} onChange={(e) => setCommission(e.target.value)} />
                  <span aria-hidden="true">%</span>
                </div>
                {c === null && <p className="field-error">{invalidText}</p>}
              </div>
              <div>
                <label className="label" htmlFor="fee-s">{t("admin.fees.system")}</label>
                <div className="input-suffix">
                  <input id="fee-s" className="input" inputMode="decimal" value={system} onChange={(e) => setSystem(e.target.value)} />
                  <span aria-hidden="true">%</span>
                </div>
                {s === null && <p className="field-error">{invalidText}</p>}
              </div>
            </div>
            <button className="btn" style={{ marginTop: 18 }} type="button" disabled={busy || !valid || unchanged} onClick={() => void save()}>
              {t("admin.fees.save")}
            </button>
            <p className="footnote" style={{ marginTop: 12 }}>{t("admin.fees.note")}</p>
            {banner && <div style={{ marginTop: 12 }}><Banner kind={banner.kind} text={t(banner.key)} /></div>}
          </section>

          <section className="breakdown" aria-live="polite">
            <p className="fees-preview-title">{t("admin.fees.preview", { amount: formatRwf(PREVIEW_AMOUNT, lang) })}</p>
            <div className="breakdown-row"><span>{t("admin.fees.charged")}</span><strong>{preview ? formatRwf(preview.total_paid, lang) : "—"}</strong></div>
            <div className="breakdown-row"><span>{t("admin.fees.agentOwed")}</span><strong>{preview ? formatRwf(preview.agent_owed, lang) : "—"}</strong></div>
            <div className="breakdown-sep" />
            <div className="breakdown-row"><span>{t("admin.fees.earns")}</span><strong>{preview ? formatRwf(preview.system_fee, lang) : "—"}</strong></div>
            <p className="fees-small" style={{ margin: "4px 0 0" }}>{t("admin.fees.beforePesapal")}</p>
            {preview && (
              <>
                <div className="breakdown-sep" />
                <div className="breakdown-row"><span>{t("admin.fees.pesapal", { pct: String(PESAPAL_FEE_PERCENT).replace(".", lang === "fr" ? "," : ".") })}</span><strong>{formatRwf(pesapalFee(preview.total_paid), lang)}</strong></div>
                <div className="breakdown-row"><span>{t("admin.fees.net")}</span><strong>{formatRwf(preview.system_fee - pesapalFee(preview.total_paid), lang)}</strong></div>
                {preview.system_fee < pesapalFee(preview.total_paid) && <p className="fees-small" role="alert" style={{ margin: "8px 0 0", fontWeight: 700 }}>{t("admin.fees.loss")}</p>}
              </>
            )}
          </section>
        </div>
      </LoadGate>
    </>
  );
}
