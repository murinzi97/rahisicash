import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useI18n } from "../../i18n/index.tsx";
import type { Key } from "../../i18n/en.ts";
import type { ExportFormat } from "../../lib/exportFile.ts";

export type LoadState = "loading" | "ok" | "error";

/** Runs an async loader whenever `deps` change. The loader throws on failure. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let stale = false;
    setState("loading");
    fn().then((d) => { if (!stale) { setData(d); setState("ok"); } })
      .catch(() => { if (!stale) setState("error"); });
    return () => { stale = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);
  return { data, state, reload: () => setAttempt((n) => n + 1) };
}

export function LoadGate({ state, onRetry, errorKey, children }: {
  state: LoadState; onRetry: () => void; errorKey: Key; children: ReactNode;
}) {
  const { t } = useI18n();
  if (state === "loading") return <p className="muted">{t("common.loading")}</p>;
  if (state === "error") {
    return (
      <>
        <p className="error" role="alert">{t(errorKey)}</p>
        <button className="btn btn-outline btn-auto" type="button" onClick={onRetry}>{t("common.retry")}</button>
      </>
    );
  }
  return <>{children}</>;
}

export function Banner({ kind, text }: { kind: "ok" | "bad"; text: string }) {
  return <p className={"notice" + (kind === "bad" ? " notice-bad" : "")} role={kind === "bad" ? "alert" : "status"}>{text}</p>;
}

const KNOWN_ERRORS = new Set([
  "not_admin", "reason_required", "transaction_not_found", "already_voided", "already_paid_out",
  "agent_not_found", "nothing_to_pay", "amount_changed", "nothing_to_reset", "not_paid",
  "invalid_fee", "invalid_percent", "invalid_request", "unauthorized",
]);
/** Short error code from an Edge Function -> translation key. */
export function errKey(code: string): Key {
  return KNOWN_ERRORS.has(code) ? (`error.${code}` as Key) : "error.unknown";
}

export function Kv({ label, value, total }: { label: string; value: string; total?: boolean }) {
  return <div className={"kv" + (total ? " kv-total" : "")}><span>{label}</span><strong>{value}</strong></div>;
}

/** Column widths for the desktop grid are passed as the CSS variable --cols. */
export function colsStyle(cols: string): CSSProperties {
  return { ["--cols" as string]: cols } as CSSProperties;
}

/** From / To date inputs. The two always stay in order; an empty value is ignored. */
export function DateRange({ from, to, max, onChange }: {
  from: string; to: string; max: string; onChange: (from: string, to: string) => void;
}) {
  const { t } = useI18n();
  return (
    <>
      <input className="input" type="date" aria-label={t("report.from")} value={from} max={max}
             onChange={(e) => { const v = e.target.value; if (v) onChange(v, v > to ? v : to); }} />
      <input className="input" type="date" aria-label={t("report.to")} value={to} max={max}
             onChange={(e) => { const v = e.target.value; if (v) onChange(v < from ? v : from, v); }} />
    </>
  );
}

/** "Export" button that lets the admin choose between a CSV file and a PDF document. */
export function ExportMenu({ disabled, onPick }: { disabled: boolean; onPick: (format: ExportFormat) => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const pick = (f: ExportFormat) => { setOpen(false); onPick(f); };
  return (
    <div className="export-menu" ref={box}>
      <button className="btn-sm btn-outline" type="button" disabled={disabled} aria-haspopup="menu" aria-expanded={open}
              onClick={() => setOpen((o) => !o)}>
        {t("common.export")} <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="export-pop" role="menu">
          <button type="button" role="menuitem" onClick={() => pick("csv")}>{t("export.csv")}</button>
          <button type="button" role="menuitem" onClick={() => pick("pdf")}>{t("export.pdf")}</button>
        </div>
      )}
    </div>
  );
}
