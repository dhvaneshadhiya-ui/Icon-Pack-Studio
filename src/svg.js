import { icons } from 'lucide';
import { isBrand, brandOf, isAppGlyph, appGlyphOf } from './model.js';

// ---------------------------------------------------------------------------
// Shared color helpers
// ---------------------------------------------------------------------------

// Darken (negative amt) or lighten a #rrggbb color.
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v * (1 + amt))));
  const [r, g, b] = [f(n >> 16), f((n >> 8) & 255), f(n & 255)];
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// White or near-black, whichever contrasts with the background.
export function pickText(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lum = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 150 ? '#111111' : '#ffffff';
}

export function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

// ---------------------------------------------------------------------------
// Style variants (Apple's three icon rendering modes)
// ---------------------------------------------------------------------------

export function darkStyle(style) {
  return { ...style, c1: shade(style.c1, -0.6), c2: shade(style.c2, -0.6) };
}
export function darkIcon(icon) {
  if (!icon.ov?.c1) return icon;
  return { ...icon, ov: { ...icon.ov, c1: shade(icon.ov.c1, -0.6), c2: shade(icon.ov.c2 ?? icon.ov.c1, -0.6) } };
}
export function monoStyle(style) {
  return {
    ...style,
    bgType: 'solid',
    c1: '#1c1c1e',
    c2: '#1c1c1e',
    glyphColor: '#ffffff',
    overlay: 'none',
    grain: false,
    ring: false,
    glyphShadow: false,
    pattern: 'none',
  };
}
export function monoIcon(icon) {
  if (!icon.ov) return icon;
  const { c1, c2, glyphColor, ...rest } = icon.ov;
  return { ...icon, ov: rest }; // keep size/rotation, drop colors
}

// ---------------------------------------------------------------------------
// Background patterns (drawn in glyphColor at low opacity)
// ---------------------------------------------------------------------------
function patternDefs(s, S, uidStr) {
  const id = `pt-${uidStr}`;
  const col = s.glyphColor;
  const u = S * 0.075;
  let inner = '';
  if (s.pattern === 'dots') {
    inner = `<circle cx="${u / 2}" cy="${u / 2}" r="${S * 0.007}" fill="${col}"/>`;
  } else if (s.pattern === 'stripes') {
    inner = `<path d="M ${-u} ${u * 2} L ${u * 2} ${-u}" stroke="${col}" stroke-width="${S * 0.006}"/>
             <path d="M 0 ${u * 2} L ${u * 2} 0" stroke="${col}" stroke-width="${S * 0.006}"/>`;
  } else if (s.pattern === 'grid') {
    inner = `<path d="M ${u} 0 V ${u} M 0 ${u} H ${u}" stroke="${col}" stroke-width="${S * 0.005}"/>`;
  } else {
    return null;
  }
  return {
    defs: `<pattern id="${id}" width="${u}" height="${u}" patternUnits="userSpaceOnUse">${inner}</pattern>`,
    rect: `<rect width="${S}" height="${S}" fill="url(#${id})" opacity="0.13"/>`,
  };
}

// ---------------------------------------------------------------------------
// Icon tile SVG
// ---------------------------------------------------------------------------

// Build the inner markup of a lucide glyph (children of the 24x24 svg).
function glyphMarkup(name) {
  const node = icons[name] || icons.Circle;
  return node
    .map(([tag, attrs]) => {
      const a = Object.entries(attrs)
        .filter(([k]) => k !== 'key')
        .map(([k, v]) => `${k}="${v}"`)
        .join(' ');
      return `<${tag} ${a}/>`;
    })
    .join('');
}

// Full SVG for one icon tile. `uidStr` keeps defs ids unique when many SVGs
// are inlined on the same page.
export function iconSvg(icon, style, size = 1024, uidStr = 'x') {
  const s = { ...style, ...(icon.ov || {}) };
  const S = size;
  const gid = `bg-${uidStr}`;
  let defs = '';
  let bgFill = s.c1;

  if (s.bgType === 'linear') {
    const a = ((s.angle || 0) * Math.PI) / 180;
    const x2 = 50 + Math.sin(a) * 50;
    const y2 = 50 - Math.cos(a) * 50;
    defs += `<linearGradient id="${gid}" x1="${100 - x2}%" y1="${100 - y2}%" x2="${x2}%" y2="${y2}%">
      <stop offset="0%" stop-color="${s.c1}"/><stop offset="100%" stop-color="${s.c2}"/></linearGradient>`;
    bgFill = `url(#${gid})`;
  } else if (s.bgType === 'radial') {
    defs += `<radialGradient id="${gid}" cx="50%" cy="32%" r="85%">
      <stop offset="0%" stop-color="${s.c1}"/><stop offset="100%" stop-color="${s.c2}"/></radialGradient>`;
    bgFill = `url(#${gid})`;
  }

  const pat = patternDefs(s, S, uidStr);
  if (pat) defs += pat.defs;

  let glyphFilter = '';
  if (s.glyphShadow) {
    defs += `<filter id="gs-${uidStr}" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="${S * 0.012}" stdDeviation="${S * 0.016}" flood-color="#000000" flood-opacity="0.5"/></filter>`;
    glyphFilter = ` filter="url(#gs-${uidStr})"`;
  }

  let content = '';
  if (icon.image) {
    if (icon.imageMode === 'contain') {
      const pad = S * (1 - (s.glyphScale ?? 0.5)) * 0.5;
      content = `<image href="${icon.image}" x="${pad}" y="${pad}" width="${S - 2 * pad}" height="${S - 2 * pad}" preserveAspectRatio="xMidYMid meet"/>`;
    } else {
      content = `<image href="${icon.image}" x="0" y="0" width="${S}" height="${S}" preserveAspectRatio="xMidYMid slice"/>`;
    }
  } else {
    const box = S * (s.glyphScale ?? 0.5);
    const t = (S - box) / 2;
    const brand = isBrand(icon.glyph) ? brandOf(icon.glyph) : null;
    const appG = isAppGlyph(icon.glyph) ? appGlyphOf(icon.glyph) : null;
    if (appG) {
      // Arcticons body: 48x48 viewBox, stroke="currentColor", no stroke-width
      const k = box / 48;
      const rot = s.rotation ? `<g transform="rotate(${s.rotation} 24 24)">` : '<g>';
      content = `<g transform="translate(${t} ${t}) scale(${k})"${glyphFilter} color="${s.glyphColor}"
        fill="none" stroke-width="${(s.strokeWidth ?? 2) * 1.4}" stroke-linecap="round" stroke-linejoin="round">${rot}${appG.body}</g></g>`;
    } else {
      const k = box / 24;
      const rot = s.rotation ? `<g transform="rotate(${s.rotation} 12 12)">` : '<g>';
      const body = brand
        ? `${rot}<path d="${brand.path}" fill="${s.glyphColor}"/></g>`
        : `${rot}${glyphMarkup(icon.glyph)}</g>`;
      content = brand
        ? `<g transform="translate(${t} ${t}) scale(${k})"${glyphFilter}>${body}</g>`
        : `<g transform="translate(${t} ${t}) scale(${k})"${glyphFilter} fill="none" stroke="${s.glyphColor}"
      stroke-width="${s.strokeWidth ?? 2}" stroke-linecap="round" stroke-linejoin="round">${body}</g>`;
    }
  }

  let overlay = '';
  if (s.overlay === 'gloss') {
    overlay = `<path d="M0 0 H${S} V${S * 0.42} Q ${S / 2} ${S * 0.56} 0 ${S * 0.42} Z" fill="#ffffff" opacity="0.09"/>`;
  } else if (s.overlay === 'vignette') {
    defs += `<radialGradient id="vg-${uidStr}" cx="50%" cy="50%" r="72%">
      <stop offset="60%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.35"/></radialGradient>`;
    overlay = `<rect width="${S}" height="${S}" fill="url(#vg-${uidStr})"/>`;
  }

  let extras = '';
  if (s.grain) {
    defs += `<filter id="gn-${uidStr}">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/>
    </filter>`;
    extras += `<rect width="${S}" height="${S}" filter="url(#gn-${uidStr})" opacity="0.07"/>`;
  }
  if (s.ring) {
    const inset = S * 0.045;
    extras += `<rect x="${inset}" y="${inset}" width="${S - 2 * inset}" height="${S - 2 * inset}"
      rx="${S * 0.18}" fill="none" stroke="${s.glyphColor}" stroke-opacity="0.5" stroke-width="${Math.max(1, S * 0.007)}"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
    <defs>${defs}</defs>
    <rect width="${S}" height="${S}" fill="${bgFill}"/>
    ${pat ? pat.rect : ''}
    ${content}${overlay}${extras}</svg>`;
}

// ---------------------------------------------------------------------------
// Rasterization
// ---------------------------------------------------------------------------

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function svgToPng(svg, w, h) {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    return await new Promise((res) => canvas.toBlob(res, 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Rasterize one icon to a PNG blob at the given size.
export async function renderIconPng(icon, style, size) {
  return svgToPng(iconSvg(icon, style, size, `exp-${icon.id}-${size}`), size, size);
}

// Downscale/re-encode an uploaded or AI image so localStorage stays sane.
export async function normalizeImage(blobOrDataUrl, max = 1024) {
  const src =
    typeof blobOrDataUrl === 'string' ? blobOrDataUrl : URL.createObjectURL(blobOrDataUrl);
  const img = await loadImage(src);
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.round(img.width * k);
  const h = Math.round(img.height * k);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);
  if (typeof blobOrDataUrl !== 'string') URL.revokeObjectURL(src);
  return canvas.toDataURL('image/webp', 0.9);
}

// ---------------------------------------------------------------------------
// 4K wallpapers derived from the pack palette (CrestWall pairing)
// ---------------------------------------------------------------------------

export const WALLPAPER_VARIANTS = ['Gradient', 'Glow', 'Pattern', 'Minimal'];

export function wallpaperSvg(style, variant, W = 2160, H = 3840, uidStr = 'wp') {
  const s = style;
  let defs = '';
  let body = '';
  if (variant === 'Gradient') {
    defs += `<linearGradient id="g-${uidStr}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${s.c1}"/><stop offset="100%" stop-color="${shade(s.c2, -0.25)}"/></linearGradient>`;
    body = `<rect width="${W}" height="${H}" fill="url(#g-${uidStr})"/>`;
  } else if (variant === 'Glow') {
    defs += `<radialGradient id="g-${uidStr}" cx="50%" cy="28%" r="90%">
      <stop offset="0%" stop-color="${s.c1}"/><stop offset="100%" stop-color="${shade(s.c2, -0.55)}"/></radialGradient>`;
    body = `<rect width="${W}" height="${H}" fill="url(#g-${uidStr})"/>`;
  } else if (variant === 'Pattern') {
    const bg = shade(s.c1, -0.25);
    const u = W * 0.05;
    defs += `<pattern id="p-${uidStr}" width="${u}" height="${u}" patternUnits="userSpaceOnUse">
      <circle cx="${u / 2}" cy="${u / 2}" r="${W * 0.004}" fill="${s.glyphColor}"/></pattern>`;
    body = `<rect width="${W}" height="${H}" fill="${bg}"/>
      <rect width="${W}" height="${H}" fill="url(#p-${uidStr})" opacity="0.12"/>`;
  } else {
    defs += `<radialGradient id="v-${uidStr}" cx="50%" cy="45%" r="80%">
      <stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.3"/></radialGradient>`;
    body = `<rect width="${W}" height="${H}" fill="${s.c1}"/><rect width="${W}" height="${H}" fill="url(#v-${uidStr})"/>`;
  }
  let grain = '';
  if (s.grain) {
    defs += `<filter id="gn-${uidStr}">
      <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/></filter>`;
    grain = `<rect width="${W}" height="${H}" filter="url(#gn-${uidStr})" opacity="0.05"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>${defs}</defs>${body}${grain}</svg>`;
}

export async function renderWallpaperPng(style, variant, W = 2160, H = 3840) {
  return svgToPng(wallpaperSvg(style, variant, W, H, `wp-${variant}`), W, H);
}

// ---------------------------------------------------------------------------
// Home-screen mockup PNG (App Store / listing marketing shots)
// ---------------------------------------------------------------------------

// Embed an icon tile inside a bigger SVG with rounded-corner clipping.
function tileMarkup(icon, style, x, y, T, uidStr) {
  const inner = iconSvg(icon, style, T, uidStr).replace(
    '<svg xmlns="http://www.w3.org/2000/svg" ',
    `<svg x="${x}" y="${y}" `
  );
  return `<clipPath id="cp-${uidStr}"><rect x="${x}" y="${y}" width="${T}" height="${T}" rx="${T * 0.225}"/></clipPath>
    <g clip-path="url(#cp-${uidStr})">${inner}</g>`;
}

export function mockupSvg(pack, wall, opts = {}) {
  const W = opts.width ?? 1290;
  const H = opts.height ?? 2796;
  const labels = opts.labels ?? true;
  const s = pack.style;
  const iconsGrid = pack.icons.slice(0, 24);
  const dock = pack.icons.slice(0, 4);

  let defs = `<linearGradient id="wall" x1="0%" y1="0%" x2="60%" y2="100%">
    <stop offset="0%" stop-color="${wall.c1}"/><stop offset="100%" stop-color="${wall.c2}"/></linearGradient>`;
  let body = `<rect width="${W}" height="${H}" fill="url(#wall)"/>`;

  // status bar
  body += `<text x="${W * 0.12}" y="${H * 0.045}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif"
    font-size="${W * 0.042}" font-weight="600" fill="#ffffff">9:41</text>`;

  const T = W * 0.14;
  const margin = W * 0.077;
  const gap = (W - 2 * margin - 4 * T) / 3;
  const rowPitch = T + (labels ? W * 0.075 : W * 0.045);
  const y0 = H * 0.085;

  iconsGrid.forEach((ic, i) => {
    const x = margin + (i % 4) * (T + gap);
    const y = y0 + Math.floor(i / 4) * rowPitch;
    body += tileMarkup(ic, s, x, y, T, `m${i}`);
    if (labels) {
      body += `<text x="${x + T / 2}" y="${y + T + W * 0.035}" text-anchor="middle"
        font-family="system-ui, -apple-system, sans-serif" font-size="${W * 0.024}" fill="#ffffff"
        opacity="0.95">${ic.label.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`;
    }
  });

  // dock
  const dockH = T + W * 0.06;
  const dockY = H - dockH - W * 0.05;
  body += `<rect x="${margin * 0.55}" y="${dockY}" width="${W - margin * 1.1}" height="${dockH}"
    rx="${dockH * 0.28}" fill="#ffffff" opacity="0.2"/>`;
  const dockGap = (W - margin * 1.1 - 4 * T) / 5;
  dock.forEach((ic, i) => {
    const x = margin * 0.55 + dockGap + i * (T + dockGap);
    body += tileMarkup(ic, s, x, dockY + W * 0.03, T, `d${i}`);
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>${defs}</defs>${body}</svg>`;
}

export async function renderMockupPng(pack, wall, opts = {}) {
  const W = opts.width ?? 1290;
  const H = opts.height ?? 2796;
  return svgToPng(mockupSvg(pack, wall, opts), W, H);
}

// ---------------------------------------------------------------------------
// Marketing cover: gradient board with a grid of the first icons + pack name.
// ---------------------------------------------------------------------------
export async function renderCoverPng(pack) {
  const W = 1600;
  const H = 1200;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#17181d');
  g.addColorStop(1, '#2b2e38');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const iconsToShow = pack.icons.slice(0, 8);
  const tile = 240;
  const gap = 56;
  const cols = 4;
  const rows = Math.ceil(iconsToShow.length / cols);
  const gridW = cols * tile + (cols - 1) * gap;
  const x0 = (W - gridW) / 2;
  const y0 = 190;

  for (let i = 0; i < iconsToShow.length; i++) {
    const png = await renderIconPng(iconsToShow[i], pack.style, tile);
    const img = await loadImage(URL.createObjectURL(png));
    const x = x0 + (i % cols) * (tile + gap);
    const y = y0 + Math.floor(i / cols) * (tile + gap + 10);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, tile, tile, tile * 0.23);
    ctx.clip();
    ctx.drawImage(img, x, y, tile, tile);
    ctx.restore();
  }

  ctx.fillStyle = '#f4f4f5';
  ctx.font = '600 64px -apple-system, "SF Pro Display", Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(pack.name, W / 2, 110);
  ctx.fillStyle = '#a1a1aa';
  ctx.font = '400 30px -apple-system, Inter, sans-serif';
  ctx.fillText(`${pack.icons.length} iOS app icons · 1024px`, W / 2, y0 + rows * (tile + gap + 10) + 30);

  return await new Promise((res) => canvas.toBlob(res, 'image/png'));
}
