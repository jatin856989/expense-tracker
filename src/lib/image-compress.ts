"use client";

/**
 * Downscales/re-encodes an image file client-side before it's sent to the
 * server (and on to Groq) — keeps a phone-camera photo well under the
 * server action body size limit and speeds up the vision API call. Returns
 * a `data:image/jpeg;base64,...` URL.
 */
export async function fileToCompressedDataUrl(file: File, maxDimension = 1600, quality = 0.85): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported in this browser.");
  ctx.drawImage(bitmap, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", quality);
}
