/**
 * Production backend base URL (no path). In dev, leave empty to use Vite proxy.
 * Vercel / .env: value only — https://api.example.com — NOT "=https://..." (no leading =).
 */
function normalizeBackendOrigin(raw: string | undefined): string {
  if (raw == null) return "";
  let s = String(raw).trim();
  // Common mistake: pasting ".env line" into Vercel (e.g. "=https://host")
  while (s.startsWith("=")) s = s.slice(1).trim();
  s = s.replace(/\/+$/, "");
  return s;
}

export const BACKEND_ORIGIN = normalizeBackendOrigin(import.meta.env.VITE_BACKEND_ORIGIN as string | undefined);

export function apiUrl(path: string) {
  if (!path.startsWith("/")) path = `/${path}`;
  if (!BACKEND_ORIGIN) return path;
  return `${BACKEND_ORIGIN}${path}`;
}

