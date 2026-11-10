/** Shared helpers for local background removal (imgly). */

export async function looksLikeFailedCutout(blob: Blob): Promise<boolean> {
  if (blob.size < 2_000) return true;
  try {
    const bmp = await createImageBitmap(blob);
    const w = Math.min(64, bmp.width);
    const h = Math.min(64, bmp.height);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bmp.close();
      return false;
    }
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const { data } = ctx.getImageData(0, 0, w, h);
    let opaque = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 24) opaque += 1;
    }
    const ratio = opaque / (w * h);
    return ratio < 0.02 || ratio > 0.98;
  } catch {
    return false;
  }
}

export type CutoutProgress = (key: string, current: number, total: number) => void;

export async function removePhotoBackground(
  input: Blob | string,
  onProgress?: CutoutProgress,
): Promise<{ blob: Blob | null; error?: string }> {
  try {
    const { removeBackground } = await import("@imgly/background-removal");
    const blob = await removeBackground(input, {
      model: "isnet_fp16",
      output: { format: "image/png", quality: 0.9 },
      progress: onProgress,
    });
    if (await looksLikeFailedCutout(blob)) {
      return {
        blob: null,
        error:
          "Friläggningen blev för dålig — använder foto utan cutout i stället.",
      };
    }
    return { blob };
  } catch (e) {
    console.warn("removePhotoBackground", e);
    return {
      blob: null,
      error:
        e instanceof Error
          ? `Kunde inte frilägga: ${e.message}`
          : "Kunde inte frilägga",
    };
  }
}
