/** One reference image per attach control — avoids overloading the image model. */
export function pickSingleImageFile(list: FileList | null): File | null {
  if (!list?.length) return null;
  const f = list[0];
  return f.type.startsWith("image/") ? f : null;
}
