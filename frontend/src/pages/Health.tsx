import { useEffect, useState } from "react";
import { fetchBackendHealth, type BackendHealthResponse } from "@/lib/api";

const Health = () => {
  const [health, setHealth] = useState<BackendHealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    fetchBackendHealth()
      .then((response) => {
        if (active) setHealth(response);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <section className="w-full max-w-lg space-y-3 rounded-lg border bg-card p-6 text-card-foreground">
        <h1 className="text-2xl font-semibold">Health check</h1>
        <p role="status" aria-live="polite">
          {health ? "Backend is healthy." : error ? "Backend health check failed." : "Checking backend health..."}
        </p>
        {health && <pre className="overflow-auto text-sm">{JSON.stringify(health, null, 2)}</pre>}
        {error && <p className="break-words text-sm text-destructive">{error}</p>}
      </section>
    </main>
  );
};

export default Health;
