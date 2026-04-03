import { apiUrl } from "@/lib/config";

export type ClientLogLevel = "debug" | "info" | "warn" | "error";

function nowIso() {
  return new Date().toISOString();
}

async function postLog(record: Record<string, unknown>) {
  try {
    await fetch(apiUrl("/api/client-logs"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    });
  } catch {
    // Never throw from logging.
  }
}

export function log(level: ClientLogLevel, message: string, context?: Record<string, unknown>) {
  const record = {
    type: "client-log",
    level,
    message,
    context: context ?? {},
    time: nowIso(),
    url: typeof window !== "undefined" ? window.location.href : undefined,
    ua: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
  };

  // Console first (always).
  // eslint-disable-next-line no-console
  (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(message, context ?? {});

  // Remote log (best-effort).
  void postLog(record);
}

export function initGlobalErrorCapture() {
  if (typeof window === "undefined") return;

  window.addEventListener("error", (ev) => {
    const err = ev.error as unknown;
    log("error", "window.error", {
      message: ev.message,
      filename: ev.filename,
      lineno: ev.lineno,
      colno: ev.colno,
      stack: err instanceof Error ? err.stack : undefined,
    });
  });

  window.addEventListener("unhandledrejection", (ev) => {
    const reason = ev.reason as unknown;
    log("error", "unhandledrejection", {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });
}

