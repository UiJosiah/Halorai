import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  fetchPluginFlyerResult,
  fetchPluginFlyerResults,
  type PluginFlyerResultResponse,
} from "@/lib/api";

/**
 * Standalone viewer for Photoshop UXP exports — not wired into create-design flow.
 * Bookmark /plugin-preview and refresh to see the latest upload.
 */
export default function PluginPreview() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("id") || "";

  const [items, setItems] = useState<PluginFlyerResultResponse[]>([]);
  const [current, setCurrent] = useState<PluginFlyerResultResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { items: list } = await fetchPluginFlyerResults(12);
      setItems(list);
      setError(null);

      if (!list.length) {
        setCurrent(null);
        return;
      }

      if (selectedId) {
        try {
          setCurrent(await fetchPluginFlyerResult(selectedId));
          return;
        } catch {
          // fall through to latest
        }
      }

      setCurrent(list[0]);
      if (!selectedId && list[0]?.id) {
        setSearchParams({ id: list[0].id }, { replace: true });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load exports.");
      setCurrent(null);
    }
  }, [selectedId, setSearchParams]);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(t);
  }, [load]);

  return (
    <div className="min-h-screen bg-[hsl(0,0%,7%)] text-[hsl(0,0%,92%)]">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-xl font-semibold">Photoshop plugin export</h1>
        <p className="mt-1 text-sm text-[hsl(0,0%,55%)]">
          Latest flyer from the UXP plugin. This page auto-refreshes every 5 seconds.
        </p>

        {error && (
          <p className="mt-4 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        )}

        <div className="mt-6 rounded-xl bg-[hsl(0,0%,12%)] p-4">
          {!current ? (
            <p className="py-16 text-center text-sm text-[hsl(0,0%,45%)]">
              No exports yet. Photoshop dev should POST the flat PNG/JPG to{" "}
              <code className="text-[hsl(0,0%,70%)]">/api/plugin/flyer-result</code>.
            </p>
          ) : (
            <>
              <img
                src={current.url}
                alt="Plugin export"
                className="w-full rounded-lg bg-black"
              />
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[hsl(0,0%,50%)]">
                {current.template && <span>{current.template}</span>}
                <span>{new Date(current.created_at).toLocaleString()}</span>
                <a
                  href={current.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-violet-400 hover:underline"
                >
                  Open full image
                </a>
              </div>
            </>
          )}
        </div>

        {items.length > 1 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {items.map((it) => (
              <button
                key={it.id}
                type="button"
                onClick={() => setSearchParams({ id: it.id })}
                className={`overflow-hidden rounded-md border-2 p-0 ${
                  current?.id === it.id ? "border-violet-500" : "border-transparent opacity-70 hover:opacity-100"
                }`}
              >
                <img src={it.url} alt="" className="h-[72px] w-[72px] object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
