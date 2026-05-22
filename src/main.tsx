import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { AnalyticsBoundary, init as initAnalytics } from "./analytics";

// Bootstrap the analytics capture layer once, before the app tree mounts
// (design item 11). `init()` is idempotent, so a stray re-entry is harmless.
initAnalytics();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AnalyticsBoundary>
      <App />
    </AnalyticsBoundary>
  </StrictMode>,
);
