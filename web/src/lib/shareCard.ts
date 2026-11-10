export const SHARE_W = 1080;
export const SHARE_H = 1350;

export type ShareMode = "photo" | "template" | "blur";

export type ShareCatchMeta = {
  species: string;
  lengthCm: number | null;
  caughtAt: string; // ISO or display-ready
  placeName: string | null;
  showPlace: boolean;
};

const TEMPLATE_SRC = "/share/templates/malmo-kanal-dusk.jpg";
const LOGO_SRC = "/brand/kanalhugget-logo.png";

function loadImage(src: string | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Kunde inte ladda bild"));
    if (typeof src === "string") {
      img.crossOrigin = "anonymous";
      img.src = src;
    } else {
      img.src = URL.createObjectURL(src);
    }
  });
}

/** Cover-draw image into rect (center crop). */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  iw: number,
  ih: number,
) {
  const scale = Math.max(dw / iw, dh / ih);
  const sw = dw / scale;
  const sh = dh / scale;
  const sx = (iw - sw) / 2;
  const sy = (ih - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

/** Contain-draw (fit inside) centered, returns drawn box. */
function drawContain(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  iw: number,
  ih: number,
  pad = 0,
) {
  const boxW = dw - pad * 2;
  const boxH = dh - pad * 2;
  const scale = Math.min(boxW / iw, boxH / ih);
  const w = iw * scale;
  const h = ih * scale;
  const x = dx + (dw - w) / 2;
  const y = dy + (dh - h) / 2;
  ctx.drawImage(img, x, y, w, h);
  return { x, y, w, h };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function formatDateSv(isoOrDate: string): string {
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return isoOrDate;
  return d.toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function drawMeta(
  ctx: CanvasRenderingContext2D,
  meta: ShareCatchMeta,
  opts: { bottomSafe: number; withScrim: boolean },
) {
  const species = meta.species.trim().toUpperCase();
  const length =
    meta.lengthCm != null && Number.isFinite(meta.lengthCm)
      ? `${String(meta.lengthCm).replace(".", ",")} cm`
      : null;
  const date = formatDateSv(meta.caughtAt);
  const place =
    meta.showPlace && meta.placeName?.trim() ? meta.placeName.trim() : null;

  const blockH =
    120 +
    (length ? 70 : 0) +
    44 +
    (place ? 40 : 0) +
    36;
  const top = SHARE_H - opts.bottomSafe - blockH;

  if (opts.withScrim) {
    const grd = ctx.createLinearGradient(0, top - 40, 0, SHARE_H);
    grd.addColorStop(0, "rgba(6, 23, 43, 0)");
    grd.addColorStop(0.35, "rgba(6, 23, 43, 0.55)");
    grd.addColorStop(1, "rgba(6, 23, 43, 0.88)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, top - 40, SHARE_W, SHARE_H - (top - 40));
  }

  let y = top + 24;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  if (species) {
    ctx.font = "800 92px Rajdhani, Segoe UI, system-ui, sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 4;
    ctx.fillText(species, 64, y);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    y += 100;
  }

  if (length) {
    ctx.font = "700 48px Rajdhani, Segoe UI, system-ui, sans-serif";
    const tw = ctx.measureText(length).width;
    const padX = 28;
    const padY = 12;
    const bx = 64;
    const by = y;
    const bw = tw + padX * 2;
    const bh = 48 + padY * 2;
    ctx.fillStyle = "#00D5E8";
    roundRect(ctx, bx, by, bw, bh, 18);
    ctx.fill();
    ctx.fillStyle = "#06172B";
    ctx.fillText(length, bx + padX, by + padY - 2);
    y += bh + 28;
  }

  ctx.font = "600 32px Inter, Segoe UI, system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillText(date, 64, y);
  y += 44;

  if (place) {
    ctx.font = "600 30px Inter, Segoe UI, system-ui, sans-serif";
    ctx.fillStyle = "#13BFC5";
    ctx.fillText(place, 64, y);
  }
}

async function ensureFonts() {
  try {
    await Promise.all([
      document.fonts.load("800 92px Rajdhani"),
      document.fonts.load("700 48px Rajdhani"),
      document.fonts.load("600 32px Inter"),
    ]);
  } catch {
    /* system fonts fallback */
  }
}

export async function composeShareCard(input: {
  mode: ShareMode;
  photo: Blob;
  cutout: Blob | null;
  meta: ShareCatchMeta;
}): Promise<Blob> {
  await ensureFonts();
  const canvas = document.createElement("canvas");
  canvas.width = SHARE_W;
  canvas.height = SHARE_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas saknas");

  const photoImg = await loadImage(input.photo);
  const logoImg = await loadImage(LOGO_SRC).catch(() => null);

  if (input.mode === "photo") {
    drawCover(
      ctx,
      photoImg,
      0,
      0,
      SHARE_W,
      SHARE_H,
      photoImg.naturalWidth,
      photoImg.naturalHeight,
    );
    if (logoImg) {
      const lw = 360;
      const lh = (logoImg.naturalHeight / logoImg.naturalWidth) * lw;
      ctx.drawImage(logoImg, (SHARE_W - lw) / 2, 48, lw, lh);
    }
    drawMeta(ctx, input.meta, { bottomSafe: 48, withScrim: true });
  } else if (input.mode === "template") {
    const tpl = await loadImage(TEMPLATE_SRC);
    drawCover(
      ctx,
      tpl,
      0,
      0,
      SHARE_W,
      SHARE_H,
      tpl.naturalWidth,
      tpl.naturalHeight,
    );
    if (input.cutout) {
      const cut = await loadImage(input.cutout);
      drawContain(
        ctx,
        cut,
        0,
        160,
        SHARE_W,
        SHARE_H - 420,
        cut.naturalWidth,
        cut.naturalHeight,
        40,
      );
    } else {
      // Fallback: soft photo plate if cutout missing
      ctx.save();
      roundRect(ctx, 80, 220, SHARE_W - 160, 620, 28);
      ctx.clip();
      drawCover(
        ctx,
        photoImg,
        80,
        220,
        SHARE_W - 160,
        620,
        photoImg.naturalWidth,
        photoImg.naturalHeight,
      );
      ctx.restore();
    }
    drawMeta(ctx, input.meta, { bottomSafe: 120, withScrim: false });
  } else {
    // blur: soft photo as bg + sharp cutout on top
    const small = document.createElement("canvas");
    small.width = Math.round(SHARE_W / 4);
    small.height = Math.round(SHARE_H / 4);
    const sctx = small.getContext("2d");
    if (!sctx) throw new Error("Canvas saknas");
    drawCover(
      sctx,
      photoImg,
      0,
      0,
      small.width,
      small.height,
      photoImg.naturalWidth,
      photoImg.naturalHeight,
    );
    ctx.filter = "blur(18px) brightness(0.82)";
    ctx.drawImage(small, 0, 0, SHARE_W, SHARE_H);
    ctx.filter = "none";

    if (input.cutout) {
      const cut = await loadImage(input.cutout);
      drawContain(
        ctx,
        cut,
        0,
        140,
        SHARE_W,
        SHARE_H - 400,
        cut.naturalWidth,
        cut.naturalHeight,
        48,
      );
    } else {
      // No cutout — fall back to sharp photo (still shareable)
      drawCover(
        ctx,
        photoImg,
        0,
        0,
        SHARE_W,
        SHARE_H,
        photoImg.naturalWidth,
        photoImg.naturalHeight,
      );
    }
    if (logoImg) {
      const lw = 320;
      const lh = (logoImg.naturalHeight / logoImg.naturalWidth) * lw;
      ctx.drawImage(logoImg, (SHARE_W - lw) / 2, 40, lw, lh);
    }
    drawMeta(ctx, input.meta, { bottomSafe: 48, withScrim: true });
  }

  // Strip EXIF by re-encoding from canvas pixels only.
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Kunde inte skapa bild"))),
      "image/jpeg",
      0.92,
    );
  });
  return blob;
}

export async function shareOrDownloadBlob(
  blob: Blob,
  filename = "kanalhugget-fangst.jpg",
): Promise<"shared" | "downloaded"> {
  const file = new File([blob], filename, { type: "image/jpeg" });
  const canShare =
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    (!navigator.canShare || navigator.canShare({ files: [file] }));

  if (canShare) {
    try {
      await navigator.share({
        files: [file],
        title: "KanalHugget",
        text: "Min fångst i KanalHugget",
      });
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        return "shared";
      }
      /* fall through to download */
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  return "downloaded";
}
