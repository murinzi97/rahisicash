import { LegalLinks } from "../components/InfoPage.tsx";
import { useState } from "react";
import { useAuth } from "../auth/AuthProvider.tsx";
import { useI18n } from "../i18n/index.tsx";
import { LangSwitch, ThemeCycle } from "../components/Controls.tsx";
import AgentsTab from "./admin/AgentsTab.tsx";
import TransactionsTab from "./admin/TransactionsTab.tsx";
import DailyPayoutTab from "./admin/DailyPayoutTab.tsx";
import RevenueTab from "./admin/RevenueTab.tsx";
import BalancesTab from "./admin/BalancesTab.tsx";
import PayoutHistoryTab from "./admin/PayoutHistoryTab.tsx";
import BalanceTab from "./admin/BalanceTab.tsx";
import FeesTab from "./admin/FeesTab.tsx";
import type { Key } from "../i18n/en.ts";

const TABS: { id: string; label: Key }[] = [
  { id: "agents", label: "admin.tab.agents" },
  { id: "transactions", label: "admin.tab.transactions" },
  { id: "dailyPayout", label: "admin.tab.dailyPayout" },
  { id: "revenue", label: "admin.tab.revenue" },
  { id: "orders", label: "admin.tab.orders" },
  { id: "balances", label: "admin.tab.balances" },
  { id: "payoutHistory", label: "admin.tab.payoutHistory" },
  { id: "balance", label: "admin.tab.balance" },
  { id: "fees", label: "admin.tab.fees" },
];

export default function AdminPortal() {
  const { t } = useI18n();
  const { signOut } = useAuth();
  const [tab, setTab] = useState("agents");

  return (
    <div className="screen">
      <header className="admin-bar">
        <div className="admin-brand">
          <img src="/logo.png" alt="" height={30} />
          <strong>{t("admin.title")}</strong>
        </div>
        <div className="admin-tools">
          <ThemeCycle />
          <LangSwitch />
          <button className="link-btn" type="button" onClick={() => void signOut()}>
            {t("common.logout")}
          </button>
        </div>
      </header>
      <nav className="tabs" aria-label={t("admin.title")}>
        {TABS.map((x) => (
          <button key={x.id} type="button" className={"tab" + (tab === x.id ? " is-on" : "")}
                  aria-current={tab === x.id ? "page" : undefined} onClick={() => setTab(x.id)}>
            {t(x.label)}
          </button>
        ))}
      </nav>
      <main className="admin-body">
        {tab === "agents" && <AgentsTab />}
        {tab === "transactions" && <TransactionsTab mode="all" />}
        {tab === "orders" && <TransactionsTab mode="orders" />}
        {tab === "dailyPayout" && <DailyPayoutTab />}
        {tab === "revenue" && <RevenueTab />}
        {tab === "balances" && <BalancesTab />}
        {tab === "payoutHistory" && <PayoutHistoryTab />}
        {tab === "balance" && <BalanceTab />}
        {tab === "fees" && <FeesTab />}
      <LegalLinks />
    </main>
    </div>
  );
}
