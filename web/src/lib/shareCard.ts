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

/** Prefer bitmap via fetch — avoids crossOrigin cache failures when switching looks. */
async function loadBitmap(src: string | Blob): Promise<ImageBitmap> {
  try {
    if (typeof src === "string") {
      const res = await fetch(src);
      if (!res.ok) throw new Error("Kunde inte ladda bild");
      return await createImageBitmap(await res.blob());
    }
    return await createImageBitmap(src);
  } catch {
    throw new Error("Kunde inte ladda bild");
  }
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

type ContentBounds = { sx: number; sy: number; sw: number; sh: number };

/**
 * Find the solid subject inside a cutout. Soft ML-halos (alpha 1–40) are ignored
 * so a small person in a large transparent frame still zooms up.
 */
function findSolidContentBounds(
  src: ImageBitmap,
  alphaMin = 72,
  padPx = 16,
): ContentBounds {
  const fullW = src.width;
  const fullH = src.height;
  const fallback = { sx: 0, sy: 0, sw: fullW, sh: fullH };

  // Scan a downscaled copy — faster on phone, less halo noise.
  const maxSide = 480;
  const scanScale = Math.min(1, maxSide / Math.max(fullW, fullH));
  const pw = Math.max(1, Math.round(fullW * scanScale));
  const ph = Math.max(1, Math.round(fullH * scanScale));
  const probe = document.createElement("canvas");
  probe.width = pw;
  probe.height = ph;
  const pctx = probe.getContext("2d", { willReadFrequently: true });
  if (!pctx) return fallback;
  pctx.clearRect(0, 0, pw, ph);
  pctx.drawImage(src, 0, 0, pw, ph);
  const { data } = pctx.getImageData(0, 0, pw, ph);

  let minX = pw;
  let minY = ph;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < ph; y++) {
    const row = y * pw;
    for (let x = 0; x < pw; x++) {
      if (data[(row + x) * 4 + 3] >= alphaMin) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return fallback;

  const inv = 1 / scanScale;
  let sx = Math.floor(minX * inv);
  let sy = Math.floor(minY * inv);
  let ex = Math.ceil((maxX + 1) * inv);
  let ey = Math.ceil((maxY + 1) * inv);
  sx = Math.max(0, sx - padPx);
  sy = Math.max(0, sy - padPx);
  ex = Math.min(fullW, ex + padPx);
  ey = Math.min(fullH, ey + padPx);
  return { sx, sy, sw: Math.max(1, ex - sx), sh: Math.max(1, ey - sy) };
}

/**
 * Fit the cutout under the logo. Zoom only when the person is a small
 * island in a mostly empty cutout — a close-up that already fills the
 * photo is shown whole, without extra crop.
 */
function drawSubject(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  content: ContentBounds,
  fullW: number,
  fullH: number,
) {
  const fill = Math.min(content.sw / fullW, content.sh / fullH);
  const src = fill < 0.72 ? content : { sx: 0, sy: 0, sw: fullW, sh: fullH };

  const top = 210;
  const bottom = 1220;
  const maxH = bottom - top;
  const maxW = SHARE_W - 64;
  const scale = Math.min(maxW / src.sw, maxH / src.sh);
  const w = src.sw * scale;
  const h = src.sh * scale;
  const x = (SHARE_W - w) / 2;
  const y = top + (maxH - h) / 2;
  ctx.drawImage(img, src.sx, src.sy, src.sw, src.sh, x, y, w, h);
  return { x, y, w, h };
}

async function loadTrimmedCutout(cutout: Blob): Promise<{
  bmp: ImageBitmap;
  content: ContentBounds;
  closeExtra: () => void;
}> {
  const raw = await loadBitmap(cutout);
  const content = findSolidContentBounds(raw);
  return { bmp: raw, content, closeExtra: () => raw.close() };
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
  // Title case brush look (matches ChatGPT mock: "Abborre", not "ABBORRE")
  const species = meta.species.trim();
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
    (species ? 130 : 0) +
    (length || weight ? 90 : 0) +
    52 +
    (place ? 48 : 0) +
    36;
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

  let y = top + 4;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  if (species) {
    ctx.font =
      "700 118px 'Permanent Marker', 'Segoe Print', cursive, system-ui";
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 4;
    ctx.fillText(species, left, y);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    y += 120;
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
      y += badge.h + 26;
    } else if (weight) {
      const badge = drawLengthBadge(ctx, weight, left, y);
      y += badge.h + 26;
    }
    ctx.textBaseline = "top";
  }

  ctx.font = "600 28px Inter, Segoe UI, system-ui, sans-serif";
  ctx.fillStyle = "rgba(244,247,250,0.92)";
  drawCalendarIcon(ctx, left, y + 2, "#13BFC5");
  ctx.fillText(date, left + 30, y);
  y += 46;

  if (place) {
    ctx.font = "600 28px Inter, Segoe UI, system-ui, sans-serif";
    ctx.fillStyle = "#00D5E8";
    drawPinIcon(ctx, left, y - 2, "#00D5E8");
    ctx.fillText(place, left + 30, y);
  }
}

async function ensureFonts() {
  try {
    await Promise.all([
      document.fonts.load("700 118px 'Permanent Marker'"),
      document.fonts.load("700 44px Rajdhani"),
      document.fonts.load("600 28px Inter"),
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

  const photoImg = await loadBitmap(input.photo);
  const logoImg = await loadBitmap(LOGO_SRC).catch(() => null);

  if (input.mode === "photo") {
    drawCover(
      ctx,
      photoImg,
      0,
      0,
      SHARE_W,
      SHARE_H,
      photoImg.width,
      photoImg.height,
    );
    if (logoImg) {
      const lw = 360;
      const lh = (logoImg.height / logoImg.width) * lw;
      ctx.drawImage(logoImg, (SHARE_W - lw) / 2, 48, lw, lh);
    }
    drawMeta(ctx, input.meta, { bottomSafe: 48, withScrim: true });
  } else if (input.mode === "template") {
    const tpl = await loadBitmap(TEMPLATE_SRC);
    try {
      drawCover(ctx, tpl, 0, 0, SHARE_W, SHARE_H, tpl.width, tpl.height);
      if (input.cutout) {
        const cut = await loadTrimmedCutout(input.cutout);
        try {
          drawSubject(ctx, cut.bmp, cut.content, cut.bmp.width, cut.bmp.height);
        } finally {
          cut.closeExtra();
        }
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
          photoImg.width,
          photoImg.height,
        );
        ctx.restore();
      }
      drawMeta(ctx, input.meta, { bottomSafe: 120, withScrim: false });
    } finally {
      tpl.close();
    }
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
      photoImg.width,
      photoImg.height,
    );
    ctx.filter = "blur(18px) brightness(0.82)";
    ctx.drawImage(small, 0, 0, SHARE_W, SHARE_H);
    ctx.filter = "none";

    if (input.cutout) {
      const cut = await loadTrimmedCutout(input.cutout);
      try {
        drawSubject(ctx, cut.bmp, cut.content, cut.bmp.width, cut.bmp.height);
      } finally {
        cut.closeExtra();
      }
    } else {
      drawCover(
        ctx,
        photoImg,
        0,
        0,
        SHARE_W,
        SHARE_H,
        photoImg.width,
        photoImg.height,
      );
    }
    if (logoImg) {
      const lw = 560;
      const lh = (logoImg.height / logoImg.width) * lw;
      ctx.drawImage(logoImg, (SHARE_W - lw) / 2, 28, lw, lh);
    }
    drawMeta(ctx, input.meta, { bottomSafe: 48, withScrim: true });
  }

  photoImg.close();
  logoImg?.close();

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

const THUMB_W = 360;
const THUMB_H = 450;

/** Full card, then downscale for look picker thumbnails. */
export async function composeShareThumb(input: {
  mode: ShareMode;
  photo: Blob;
  cutout: Blob | null;
  meta: ShareCatchMeta;
}): Promise<Blob> {
  const full = await composeShareCard(input);
  const bmp = await createImageBitmap(full);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = THUMB_W;
    canvas.height = THUMB_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas saknas");
    ctx.drawImage(bmp, 0, 0, THUMB_W, THUMB_H);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Kunde inte skapa bild"))),
        "image/jpeg",
        0.82,
      );
    });
    return blob;
  } finally {
    bmp.close();
  }
}

export function downloadShareBlob(
  blob: Blob,
  filename = "kanalhugget-fangst.jpg",
) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2500);
}

/** Windows Chrome Web Share often hangs — only use native share on phones. */
function prefersNativeShare(): boolean {
  if (typeof navigator === "undefined") return false;
  const uaData = (
    navigator as Navigator & {
      userAgentData?: { mobile?: boolean };
    }
  ).userAgentData;
  if (typeof uaData?.mobile === "boolean") return uaData.mobile;
  if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) return true;
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(hover: none) and (pointer: coarse)").matches
  );
}

export async function shareOrDownloadBlob(
  blob: Blob,
  filename = "kanalhugget-fangst.jpg",
): Promise<"shared" | "downloaded"> {
  const file = new File([blob], filename, { type: "image/jpeg" });
  const canShare =
    prefersNativeShare() &&
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

  downloadShareBlob(blob, filename);
  return "downloaded";
}
