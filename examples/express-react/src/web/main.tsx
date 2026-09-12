import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App.js";
import { ErrorBoundary } from "./components/ErrorBoundary.js";
import { SessionProvider } from "./session.js";
import "./styles.css";

const container = document.getElementById("root");
if (container === null) {
  throw new Error("No #root element in index.html.");
}

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <SessionProvider>
        <App />
      </SessionProvider>
    </ErrorBoundary>
  </StrictMode>,
);
