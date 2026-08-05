// Output sizing for AI wallpapers. gpt-image-2 tops out at 1024×1536, but
// CrestWall ships 4K — so we upscale on save: cover-crop to the target aspect,
// then progressive 2× resampling (imageSmoothingQuality: high) up to the
// target resolution.
export const OUTPUT_SIZES = {
  'Original (as generated)': null,
  'iPhone Pro Max · 1290×2796': [1290, 2796],
  'iPhone 4K · 2160×3840': [2160, 3840],
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function renderAtSize(dataUrl, target) {
  const img = await loadImage(dataUrl);
  if (!target) {
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    return new Promise((res) => c.toBlob(res, 'image/png'));
  }
  const [TW, TH] = target;
  // cover-crop the source to the target aspect, keeping the centre
  const k = Math.max(TW / img.width, TH / img.height);
  const sw = TW / k;
  const sh = TH / k;
  const sx = (img.width - sw) / 2;
  const sy = (img.height - sh) / 2;

  let canvas = document.createElement('canvas');
  canvas.width = Math.round(sw);
  canvas.height = Math.round(sh);
  let ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

  // progressive 2× steps preserve more detail than one big jump
  while (canvas.width * 2 < TW) {
    const next = document.createElement('canvas');
    next.width = canvas.width * 2;
    next.height = canvas.height * 2;
    const nctx = next.getContext('2d');
    nctx.imageSmoothingQuality = 'high';
    nctx.drawImage(canvas, 0, 0, next.width, next.height);
    canvas = next;
  }
  const out = document.createElement('canvas');
  out.width = TW;
  out.height = TH;
  const octx = out.getContext('2d');
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(canvas, 0, 0, TW, TH);
  return new Promise((res) => out.toBlob(res, 'image/png'));
}
