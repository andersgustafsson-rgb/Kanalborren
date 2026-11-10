export const SHARE_W = 1080;
export const SHARE_H = 1350;

export type ShareMode = "photo" | "template" | "blur";

export type ShareCatchMeta = {
  species: string;
  lengthCm: number | null;
  weightKg: number | null;
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

function drawTrackedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  tracking: number,
) {
  let cursor = x;
  for (const ch of text) {
    ctx.fillText(ch, cursor, y);
    cursor += ctx.measureText(ch).width + tracking;
  }
  return cursor - x;
}

/** Soft “brush” pill for length — slightly skewed teal badge. */
function drawLengthBadge(
  ctx: CanvasRenderingContext2D,
  label: string,
  x: number,
  y: number,
) {
  ctx.font = "700 44px Rajdhani, Segoe UI, system-ui, sans-serif";
  const tw = ctx.measureText(label).width;
  const padX = 34;
  const padY = 14;
  const w = tw + padX * 2;
  const h = 44 + padY * 2;
  const skew = 14;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + skew, y);
  ctx.lineTo(x + w + skew * 0.35, y);
  ctx.quadraticCurveTo(x + w + skew + 8, y + h / 2, x + w + skew * 0.2, y + h);
  ctx.lineTo(x + 4, y + h);
  ctx.quadraticCurveTo(x - 6, y + h / 2, x + skew, y);
  ctx.closePath();
  ctx.fillStyle = "#00D5E8";
  ctx.shadowColor = "rgba(0, 213, 232, 0.35)";
  ctx.shadowBlur = 18;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#06172B";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + padX + skew * 0.35, y + h / 2 + 1);
  ctx.restore();
  return { h, w: w + skew };
}

function drawPinIcon(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(10, 9, 8, Math.PI, 0);
  ctx.lineTo(10, 22);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#06172B";
  ctx.beginPath();
  ctx.arc(10, 9, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCalendarIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.2;
  roundRect(ctx, x, y + 3, 20, 16, 3);
  ctx.stroke();
  ctx.fillRect(x + 4, y, 2.5, 6);
  ctx.fillRect(x + 13.5, y, 2.5, 6);
  ctx.beginPath();
  ctx.moveTo(x + 2, y + 9);
  ctx.lineTo(x + 18, y + 9);
  ctx.stroke();
  ctx.restore();
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
  const weight =
    meta.weightKg != null && Number.isFinite(meta.weightKg)
      ? `${String(meta.weightKg).replace(".", ",")} kg`
      : null;
  const date = formatDateSv(meta.caughtAt);
  const place =
    meta.showPlace && meta.placeName?.trim() ? meta.placeName.trim() : null;

  const blockH =
    (species ? 118 : 0) +
    (length || weight ? 86 : 0) +
    52 +
    (place ? 48 : 0) +
    40;
  const top = SHARE_H - opts.bottomSafe - blockH;
  const left = 56;

  if (opts.withScrim) {
    const grd = ctx.createLinearGradient(0, top - 80, 0, SHARE_H);
    grd.addColorStop(0, "rgba(6, 23, 43, 0)");
    grd.addColorStop(0.28, "rgba(6, 23, 43, 0.45)");
    grd.addColorStop(1, "rgba(6, 23, 43, 0.92)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, top - 80, SHARE_W, SHARE_H - (top - 80));
  }

  let y = top + 8;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  if (species) {
    ctx.font = "italic 800 104px Rajdhani, Segoe UI, system-ui, sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = "rgba(0,0,0,0.65)";
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 5;
    drawTrackedText(ctx, species, left, y, 3.5);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    y += 112;
  }

  if (length || weight) {
    if (length) {
      const badge = drawLengthBadge(ctx, length, left, y);
      if (weight) {
        ctx.font = "700 36px Rajdhani, Segoe UI, system-ui, sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.textBaseline = "middle";
        ctx.fillText(weight, left + badge.w + 18, y + badge.h / 2);
      }
      y += badge.h + 28;
    } else if (weight) {
      const badge = drawLengthBadge(ctx, weight, left, y);
      y += badge.h + 28;
    }
    ctx.textBaseline = "top";
  }

  ctx.font = "600 30px Inter, Segoe UI, system-ui, sans-serif";
  ctx.fillStyle = "rgba(244,247,250,0.92)";
  drawCalendarIcon(ctx, left, y + 2, "#13BFC5");
  ctx.fillText(date, left + 30, y);
  y += 48;

  if (place) {
    ctx.font = "600 30px Inter, Segoe UI, system-ui, sans-serif";
    ctx.fillStyle = "#00D5E8";
    drawPinIcon(ctx, left, y - 2, "#00D5E8");
    ctx.fillText(place, left + 30, y);
  }
}

async function ensureFonts() {
  try {
    await Promise.all([
      document.fonts.load("italic 800 104px Rajdhani"),
      document.fonts.load("700 44px Rajdhani"),
      document.fonts.load("600 30px Inter"),
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
