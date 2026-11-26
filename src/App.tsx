import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { configured } from "./lib/supabase.ts";
import { routeFor, startRoute, type Area } from "./lib/routing.ts";
import { hasWelcomed } from "./lib/welcome.ts";
import { useAuth } from "./auth/AuthProvider.tsx";
import { useI18n } from "./i18n/index.tsx";
import { Splash } from "./components/Controls.tsx";
import Welcome from "./pages/Welcome.tsx";
import Login from "./pages/Login.tsx";
import Register from "./pages/Register.tsx";
import Pending from "./pages/Pending.tsx";
import Blocked from "./pages/Blocked.tsx";
import AgentHome from "./pages/AgentHome.tsx";
import NewWithdrawal from "./pages/NewWithdrawal.tsx";
import PaymentPage from "./pages/PaymentPage.tsx";
import Report from "./pages/Report.tsx";
import Profile from "./pages/Profile.tsx";
import PayDone from "./pages/PayDone.tsx";
import AdminPortal from "./pages/AdminPortal.tsx";
import Contact from "./pages/Contact.tsx";
import Privacy from "./pages/Privacy.tsx";

/** Shows its page only if this person belongs in `area`; otherwise sends them where they belong. */
function Gate({ area, children }: { area: Area; children: ReactNode }) {
  const { session, profile, loading } = useAuth();
  if (loading) return <Splash />;
  const dest = routeFor(Boolean(session), profile);
  return dest === area ? <>{children}</> : <Navigate to={dest} replace />;
}

function Root() {
  const { session, profile, loading } = useAuth();
  if (loading) return <Splash />;
  return <Navigate to={startRoute(Boolean(session), profile, hasWelcomed())} replace />;
}

export default function App() {
  const { t } = useI18n();
  if (!configured) {
    return (
      <main className="screen center-col">
        <h1 className="page-title">{t("setup.title")}</h1>
        <p className="subtle">{t("setup.text")}</p>
      </main>
    );
  }
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Root />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/login" element={<Gate area="/login"><Login /></Gate>} />
        <Route path="/register" element={<Register />} />
        <Route path="/pending" element={<Gate area="/pending"><Pending /></Gate>} />
        <Route path="/blocked" element={<Gate area="/blocked"><Blocked /></Gate>} />
        <Route path="/agent" element={<Gate area="/agent"><AgentHome /></Gate>} />
        <Route path="/agent/new" element={<Gate area="/agent"><NewWithdrawal /></Gate>} />
        <Route path="/agent/pay/:id" element={<Gate area="/agent"><PaymentPage /></Gate>} />
        <Route path="/agent/report" element={<Gate area="/agent"><Report /></Gate>} />
        <Route path="/agent/profile" element={<Gate area="/agent"><Profile /></Gate>} />
        <Route path="/pay/done" element={<PayDone />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/admin" element={<Gate area="/admin"><AdminPortal /></Gate>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
