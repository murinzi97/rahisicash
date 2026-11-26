import type { Key } from "../i18n/en.ts";
import type { TxStatus } from "./withdrawal.ts";

export type StatusFilter = "all" | "paid" | "unpaid" | "voided";

/** Which database statuses each report filter shows. "Unpaid" = not paid and not voided. */
export const FILTER_STATUSES: Record<StatusFilter, TxStatus[] | null> = {
  all: null,
  paid: ["paid"],
  unpaid: ["pending", "failed", "expired"],
  voided: ["voided"],
};

export type PillClass = "pill-ok" | "pill-warn" | "pill-bad";

/** Badge colour and label. Paid = green; waiting/unpaid = amber; failed, expired, voided = red. */
export function pillFor(status: TxStatus, where: "order" | "report"): [PillClass, Key] {
  switch (status) {
    case "paid": return ["pill-ok", "status.paid"];
    case "pending": return ["pill-warn", where === "order" ? "status.waiting" : "status.unpaid"];
    case "failed": return ["pill-bad", "status.failed"];
    case "expired": return ["pill-bad", "status.expired"];
    default: return ["pill-bad", "status.voided"];
  }
}
