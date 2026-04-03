export const BACKEND_ORIGIN = (import.meta.env.VITE_BACKEND_ORIGIN as string | undefined) || "";

export function apiUrl(path: string) {
  if (!path.startsWith("/")) path = `/${path}`;
  return `${BACKEND_ORIGIN}${path}`;
}

