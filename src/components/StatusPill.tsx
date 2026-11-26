import { useI18n } from "../i18n/index.tsx";
import { pillFor } from "../lib/transactions.ts";
import type { TxStatus } from "../lib/withdrawal.ts";

export function StatusPill({ status, where }: { status: TxStatus; where: "order" | "report" }) {
  const { t } = useI18n();
  const [cls, key] = pillFor(status, where);
  return <span className={`pill ${cls}`}>{t(key)}</span>;
}
