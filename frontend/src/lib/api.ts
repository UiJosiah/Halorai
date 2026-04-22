export type UploadedItem = {
  id: string;
  url: string;
  originalName: string;
};

import { apiUrl } from "@/lib/config";
import { log } from "@/lib/logger";

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const started = performance.now();
  try {
    const res = await fetch(input, init);
    const durMs = Math.round(performance.now() - started);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const requestId = res.headers.get("x-request-id") || undefined;
      let msg = text || `Request failed (${res.status})`;
      try {
        const parsed = JSON.parse(text) as unknown;
        if (parsed && typeof parsed === "object" && "error" in (parsed as any) && typeof (parsed as any).error === "string") {
          msg = (parsed as any).error;
        }
      } catch {
        // ignore
      }

      // Make provider/rate-limit errors user-friendly.
      const low = msg.toLowerCase();
      if (res.status === 429 || low.includes("resource_exhausted") || low.includes("rate limit") || low.includes("quota")) {
        msg = "AI limit reached right now. Please wait a bit and try again.";
      }
      log("error", "api.request_failed", {
        url: String(input),
        method: init?.method || "GET",
        status: res.status,
        durationMs: durMs,
        requestId,
        body: msg,
      });
      throw new Error(requestId ? `${msg} (requestId: ${requestId})` : msg);
    }
    log("info", "api.request_ok", {
      url: String(input),
      method: init?.method || "GET",
      status: res.status,
      durationMs: durMs,
    });
    return (await res.json()) as T;
  } catch (e: unknown) {
    const durMs = Math.round(performance.now() - started);
    log("error", "api.request_exception", {
      url: String(input),
      method: init?.method || "GET",
      durationMs: durMs,
      message: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}

export async function saveEventDetails(payload: unknown): Promise<{ id: string }> {
  return await requestJson<{ id: string }>(apiUrl("/api/event-details"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function uploadLogos(files: File[]): Promise<UploadedItem[]> {
  const fd = new FormData();
  for (const f of files) fd.append("files", f);
  const res = await requestJson<{ items: UploadedItem[] }>(apiUrl("/api/uploads/logos"), { method: "POST", body: fd });
  return res.items;
}

export async function deleteLogo(id: string): Promise<void> {
  await requestJson<{ ok: boolean }>(apiUrl(`/api/uploads/logos/${id}`), { method: "DELETE" });
}

export async function uploadMinisterImages(files: File[]): Promise<UploadedItem[]> {
  const fd = new FormData();
  for (const f of files) fd.append("files", f);
  const res = await requestJson<{ items: UploadedItem[] }>(apiUrl("/api/uploads/ministers"), { method: "POST", body: fd });
  return res.items;
}

export async function deleteMinisterImage(id: string): Promise<void> {
  await requestJson<{ ok: boolean }>(apiUrl(`/api/uploads/ministers/${id}`), { method: "DELETE" });
}

export type AiTextResponse = { model: string; text: string };

export async function aiGenerateText(prompt: string, model?: string): Promise<AiTextResponse> {
  return await requestJson<AiTextResponse>(apiUrl("/api/ai/text"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(model ? { prompt, model } : { prompt }),
  });
}

export type AiImageResponse = { model: string; images: { mimeType: string; base64: string }[] };

export type AiImageReference = { mimeType: string; base64: string };

/** Text-to-image, or image-to-image when `referenceImages` is non-empty (same `/api/ai/image` route). */
export async function aiGenerateImage(payload: {
  prompt: string;
  model?: string;
  aspectRatio?: string;
  numberOfImages?: number;
  referenceImages?: AiImageReference[];
}): Promise<AiImageResponse> {
  const body: Record<string, unknown> = {
    prompt: payload.prompt,
    aspectRatio: payload.aspectRatio ?? "9:16",
    numberOfImages: payload.numberOfImages ?? 1,
  };
  if (payload.model) body.model = payload.model;
  if (payload.referenceImages?.length) body.referenceImages = payload.referenceImages;

  return await requestJson<AiImageResponse>(apiUrl("/api/ai/image"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export type AiFlyerResponse = {
  model: string;
  template?: { bucket: string; file: string; title?: string };
  images: { mimeType: string; base64: string }[];
};

export async function aiGenerateFlyer(payload: {
  eventDetails: unknown;
  concept?: string;
  message?: string;
  ministersMeta?: { name: string; title: string }[];
  /** User-selected 9:16 background from Step 3ii (required for flyer composition). */
  backgroundImage: File;
  logos?: File[];
  ministers?: File[];
}): Promise<AiFlyerResponse> {
  const fd = new FormData();
  fd.append("eventDetails", JSON.stringify(payload.eventDetails ?? {}));
  fd.append("backgroundImage", payload.backgroundImage);
  if (payload.concept) fd.append("concept", payload.concept);
  if (payload.message) fd.append("message", payload.message);
  if (payload.ministersMeta?.length) fd.append("ministersMeta", JSON.stringify(payload.ministersMeta));
  for (const f of payload.logos ?? []) fd.append("logos", f);
  for (const f of payload.ministers ?? []) fd.append("ministers", f);

  return await requestJson<AiFlyerResponse>(apiUrl("/api/ai/flyer"), { method: "POST", body: fd });
}

