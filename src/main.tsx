import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/theme.css";
import { I18nProvider } from "./i18n/index.tsx";
import { ThemeProvider } from "./theme/ThemeProvider.tsx";
import { AuthProvider } from "./auth/AuthProvider.tsx";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </I18nProvider>
  </StrictMode>,
);
