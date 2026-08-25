import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PostHogProvider } from "@posthog/react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { migrateLocalStorage } from "./lib/local-storage-migration";
import { initPostHog, posthog } from "./lib/posthog";
import { LanguageProvider } from "./lib/i18n";
import { App } from "./App";
import "./index.css";

// Migrate localStorage keys from old "openacpui-*" prefix before React mounts
migrateLocalStorage();

// Initialize posthog-js (starts opted-out until settings confirm opt-in)
initPostHog();

// Analytics opt-in sync is deferred to after React mount (in App.tsx useEffect)
// to avoid firing IPC calls before first paint.

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PostHogProvider client={posthog}>
      <ErrorBoundary>
        <LanguageProvider>
          <App />
        </LanguageProvider>
      </ErrorBoundary>
    </PostHogProvider>
  </StrictMode>,
);
