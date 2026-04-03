import { PDFDocument } from "pdf-lib";

function safeName(input: string) {
  const base = (input || "flyer").trim().toLowerCase();
  const cleaned = base.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || "flyer";
}

function base64ToBytes(base64: string) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToBlob(bytes: Uint8Array, mimeType: string) {
  return new Blob([bytes], { type: mimeType });
}

async function blobToImageSize(blob: Blob): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    const loaded = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to read image"));
    });
    img.src = url;
    await loaded;
    return { width: img.naturalWidth || img.width, height: img.naturalHeight || img.height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function convertImageBlob(blob: Blob, targetMime: "image/png" | "image/jpeg", quality = 0.92) {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    const loaded = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to decode image"));
    });
    img.src = url;
    await loaded;

    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    ctx.drawImage(img, 0, 0, w, h);

    const outBlob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Failed to encode image"))),
        targetMime,
        targetMime === "image/jpeg" ? quality : undefined
      );
    });
    return outBlob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function downloadFlyer(opts: {
  flyer: { mimeType: string; base64: string };
  filenameBase: string;
  format: "png" | "jpg" | "pdf";
}) {
  const base = safeName(opts.filenameBase);
  const bytes = base64ToBytes(opts.flyer.base64);
  const sourceBlob = bytesToBlob(bytes, opts.flyer.mimeType || "image/png");

  if (opts.format === "png") {
    const blob = opts.flyer.mimeType === "image/png" ? sourceBlob : await convertImageBlob(sourceBlob, "image/png");
    triggerDownload(blob, `${base}.png`);
    return;
  }

  if (opts.format === "jpg") {
    const blob = opts.flyer.mimeType === "image/jpeg" ? sourceBlob : await convertImageBlob(sourceBlob, "image/jpeg", 0.95);
    triggerDownload(blob, `${base}.jpg`);
    return;
  }

  // PDF: embed image at its native resolution for clarity.
  // pdf-lib supports PNG/JPEG. Convert other types (e.g. webp) to PNG.
  const embeddable =
    opts.flyer.mimeType === "image/png" || opts.flyer.mimeType === "image/jpeg"
      ? sourceBlob
      : await convertImageBlob(sourceBlob, "image/png");

  const { width, height } = await blobToImageSize(embeddable);
  const imgBytes = new Uint8Array(await embeddable.arrayBuffer());

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([width, height]);

  const img =
    embeddable.type === "image/jpeg" ? await pdf.embedJpg(imgBytes) : await pdf.embedPng(imgBytes);

  page.drawImage(img, { x: 0, y: 0, width, height });

  const pdfBytes = await pdf.save();
  triggerDownload(new Blob([pdfBytes], { type: "application/pdf" }), `${base}.pdf`);
}

