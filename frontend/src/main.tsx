import "@fontsource/unbounded/600.css";
import "@fontsource/unbounded/800.css";
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/pirata-one/400.css";
import "./styles/theme.css";

import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import { consumeAuthRedirect } from "./lib/auth";
import { initConsentedAnalytics } from "./lib/consent";
import { initObservability } from "./lib/observability";
import { captureRef } from "./lib/referral";

// Opt-in error monitoring (no-op unless VITE_SENTRY_DSN is set).
void initObservability();
// Persist a ?ref= invite code (credited to the referrer when this user signs in).
captureRef();
// If we just came back from Google, store the session token before the app boots.
consumeAuthRedirect();
// Load Google Analytics only if the user previously consented.
initConsentedAnalytics();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
