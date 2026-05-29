export const MAX_ATTACH_IMAGES = 2;

export type AttachedImage = {
  id: string;
  file: File;
  previewUrl: string;
};

export function pickImageFiles(list: FileList | null, max = MAX_ATTACH_IMAGES): File[] {
  if (!list?.length) return [];
  const out: File[] = [];
  for (let i = 0; i < list.length && out.length < max; i++) {
    const f = list[i];
    if (f.type.startsWith("image/")) out.push(f);
  }
  return out;
}

export function createAttachedImages(files: File[], existingCount = 0): AttachedImage[] {
  const slots = Math.max(0, MAX_ATTACH_IMAGES - existingCount);
  return files.slice(0, slots).map((file) => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    previewUrl: URL.createObjectURL(file),
  }));
}

export function revokeAttachedImages(items: AttachedImage[]) {
  for (const item of items) URL.revokeObjectURL(item.previewUrl);
}
