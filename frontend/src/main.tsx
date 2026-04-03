import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import ErrorBoundary from "@/components/ErrorBoundary";
import { initGlobalErrorCapture, log } from "@/lib/logger";

initGlobalErrorCapture();
log("info", "app.start");

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
