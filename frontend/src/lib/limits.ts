export const MAX_MINISTERS = (() => {
  const raw = (import.meta as any)?.env?.VITE_MAX_MINISTERS;
  const n = Number(raw ?? 3);
  if (!Number.isFinite(n)) return 3;
  return Math.max(0, Math.floor(n));
})();

