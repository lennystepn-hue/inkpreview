import "@fontsource/unbounded/600.css";
import "@fontsource/unbounded/800.css";
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/700.css";
import "./styles/theme.css";

import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import { consumeAuthRedirect } from "./lib/auth";

// If we just came back from Google, store the session token before the app boots.
consumeAuthRedirect();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
