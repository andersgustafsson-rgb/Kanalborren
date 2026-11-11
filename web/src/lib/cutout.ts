/** Shared helpers for local background removal (imgly). */

/** Share cards are 1080 wide — larger source only slows ONNX. */
const CUTOUT_MAX_SIDE = 1280;

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

async function blobFromInput(input: Blob | string): Promise<Blob> {
  if (typeof input !== "string") return input;
  const res = await fetch(input);
  if (!res.ok) throw new Error("Kunde inte ladda foto");
  return res.blob();
}

/** Downscale huge phone photos before ONNX — same look on 1080 share cards. */
async function downscaleForCutout(blob: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(blob);
  try {
    const longSide = Math.max(bmp.width, bmp.height);
    if (longSide <= CUTOUT_MAX_SIDE) return blob;

    const scale = CUTOUT_MAX_SIDE / longSide;
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return blob;
    ctx.drawImage(bmp, 0, 0, w, h);

    const out = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92);
    });
    return out || blob;
  } finally {
    bmp.close();
  }
}

function canUseWebGpu(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

export async function removePhotoBackground(
  input: Blob | string,
  onProgress?: CutoutProgress,
): Promise<{ blob: Blob | null; error?: string }> {
  try {
    const { removeBackground } = await import("@imgly/background-removal");
    const source = await downscaleForCutout(await blobFromInput(input));
    const base = {
      model: "isnet_fp16" as const,
      output: { format: "image/png" as const, quality: 0.9 },
      progress: onProgress,
    };

    let blob: Blob;
    if (canUseWebGpu()) {
      try {
        blob = await removeBackground(source, { ...base, device: "gpu" });
      } catch (gpuErr) {
        console.warn("cutout gpu failed, retrying on cpu", gpuErr);
        blob = await removeBackground(source, { ...base, device: "cpu" });
      }
    } else {
      blob = await removeBackground(source, { ...base, device: "cpu" });
    }

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
