// Standalone wallpaper engine — procedural 4K wallpapers that don't depend on
// an icon pack. Ten styles, device-accurate sizes, all rendered as SVG so they
// scale losslessly to any resolution.
import { svgToPng, shade } from './svg.js';

export const WALLPAPER_SIZES = {
  'iPhone 4K': [2160, 3840],
  'iPhone Pro Max': [1290, 2796],
  'iPhone Pro': [1179, 2556],
  'iPad Pro 12.9"': [2048, 2732],
  'Desktop 4K': [3840, 2160],
};

export const WALLPAPER_STYLES = [
  'Gradient', 'Glow', 'Mesh', 'Aurora', 'Waves',
  'Blobs', 'Rays', 'Duotone', 'Pattern', 'Minimal',
];

// p: { c1, c2, accent, grain, angle }
export function wallpaperArt(p, styleName, W, H, uid = 'w') {
  const c1 = p.c1;
  const c2 = p.c2 ?? shade(p.c1, -0.4);
  const accent = p.accent ?? '#ffffff';
  const S = Math.min(W, H);
  let defs = '';
  let body = '';

  const softBlur = (id, amount) =>
    `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="${amount}"/></filter>`;

  switch (styleName) {
    case 'Gradient': {
      const a = ((p.angle ?? 135) * Math.PI) / 180;
      const x2 = 50 + Math.sin(a) * 50;
      const y2 = 50 - Math.cos(a) * 50;
      defs += `<linearGradient id="g-${uid}" x1="${100 - x2}%" y1="${100 - y2}%" x2="${x2}%" y2="${y2}%">
        <stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient>`;
      body = `<rect width="${W}" height="${H}" fill="url(#g-${uid})"/>`;
      break;
    }
    case 'Glow': {
      defs += `<radialGradient id="g-${uid}" cx="50%" cy="26%" r="85%">
        <stop offset="0%" stop-color="${shade(c1, 0.15)}"/>
        <stop offset="55%" stop-color="${c1}"/>
        <stop offset="100%" stop-color="${shade(c2, -0.5)}"/></radialGradient>`;
      body = `<rect width="${W}" height="${H}" fill="url(#g-${uid})"/>`;
      break;
    }
    case 'Mesh': {
      // several oversized soft radial blooms — the "mesh gradient" look
      defs += softBlur(`b-${uid}`, S * 0.18);
      const pts = [
        [0.2, 0.15, c1, 0.75],
        [0.85, 0.28, accent, 0.5],
        [0.15, 0.7, c2, 0.8],
        [0.8, 0.85, shade(c1, 0.25), 0.6],
      ];
      body = `<rect width="${W}" height="${H}" fill="${shade(c2, -0.35)}"/>
        <g filter="url(#b-${uid})">` +
        pts.map(([x, y, col, o]) =>
          `<ellipse cx="${W * x}" cy="${H * y}" rx="${S * 0.55}" ry="${S * 0.5}" fill="${col}" opacity="${o}"/>`
        ).join('') + `</g>`;
      break;
    }
    case 'Aurora': {
      defs += softBlur(`b-${uid}`, S * 0.09);
      defs += `<linearGradient id="a1-${uid}" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="${c1}" stop-opacity="0"/>
        <stop offset="50%" stop-color="${accent}" stop-opacity="0.85"/>
        <stop offset="100%" stop-color="${c2}" stop-opacity="0"/></linearGradient>`;
      const band = (yOff, amp, op) =>
        `<path d="M ${-W * 0.1} ${H * yOff}
           C ${W * 0.25} ${H * (yOff - amp)}, ${W * 0.6} ${H * (yOff + amp)}, ${W * 1.1} ${H * (yOff - amp * 0.5)}
           L ${W * 1.1} ${H * (yOff + 0.16)}
           C ${W * 0.6} ${H * (yOff + amp + 0.16)}, ${W * 0.25} ${H * (yOff - amp + 0.16)}, ${-W * 0.1} ${H * (yOff + 0.16)} Z"
           fill="url(#a1-${uid})" opacity="${op}"/>`;
      body = `<rect width="${W}" height="${H}" fill="${shade(c2, -0.55)}"/>
        <g filter="url(#b-${uid})">${band(0.3, 0.1, 0.9)}${band(0.5, 0.13, 0.6)}${band(0.68, 0.08, 0.45)}</g>`;
      break;
    }
    case 'Waves': {
      defs += `<linearGradient id="g-${uid}" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient>`;
      let layers = '';
      for (let i = 0; i < 5; i++) {
        const y = H * (0.45 + i * 0.11);
        const amp = H * 0.05;
        layers += `<path d="M 0 ${y}
          C ${W * 0.3} ${y - amp}, ${W * 0.7} ${y + amp}, ${W} ${y - amp * 0.4}
          L ${W} ${H} L 0 ${H} Z" fill="${accent}" opacity="${0.06 + i * 0.05}"/>`;
      }
      body = `<rect width="${W}" height="${H}" fill="url(#g-${uid})"/>${layers}`;
      break;
    }
    case 'Blobs': {
      defs += softBlur(`b-${uid}`, S * 0.05);
      const blobs = [
        [0.25, 0.22, 0.3, c1],
        [0.75, 0.4, 0.24, accent],
        [0.35, 0.72, 0.28, shade(c1, 0.2)],
        [0.82, 0.82, 0.18, c2],
      ];
      body = `<rect width="${W}" height="${H}" fill="${shade(c2, -0.45)}"/>
        <g filter="url(#b-${uid})">` +
        blobs.map(([x, y, r, col]) =>
          `<circle cx="${W * x}" cy="${H * y}" r="${S * r}" fill="${col}" opacity="0.6"/>`
        ).join('') + `</g>`;
      break;
    }
    case 'Rays': {
      defs += `<radialGradient id="g-${uid}" cx="50%" cy="0%" r="120%">
        <stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${shade(c2, -0.4)}"/></radialGradient>`;
      defs += softBlur(`b-${uid}`, S * 0.03);
      let rays = '';
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI - Math.PI / 2;
        const x = W / 2 + Math.cos(a) * W * 1.4;
        const y = Math.sin(a) * H * 1.4;
        rays += `<path d="M ${W / 2} ${-H * 0.05} L ${x} ${y} L ${x + W * 0.06} ${y} Z"
          fill="${accent}" opacity="${i % 2 ? 0.05 : 0.09}"/>`;
      }
      body = `<rect width="${W}" height="${H}" fill="url(#g-${uid})"/>
        <g filter="url(#b-${uid})">${rays}</g>`;
      break;
    }
    case 'Duotone': {
      const a = ((p.angle ?? 135) * Math.PI) / 180;
      body = `<rect width="${W}" height="${H}" fill="${c1}"/>
        <path d="M 0 ${H} L ${W} ${H * 0.35} L ${W} ${H} Z" fill="${c2}"/>
        <path d="M 0 ${H} L ${W} ${H * 0.55} L ${W} ${H} Z" fill="${accent}" opacity="0.18"/>`;
      break;
    }
    case 'Pattern': {
      const u = S * 0.055;
      defs += `<linearGradient id="g-${uid}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient>`;
      defs += `<pattern id="p-${uid}" width="${u}" height="${u}" patternUnits="userSpaceOnUse">
        <circle cx="${u / 2}" cy="${u / 2}" r="${S * 0.004}" fill="${accent}"/></pattern>`;
      body = `<rect width="${W}" height="${H}" fill="url(#g-${uid})"/>
        <rect width="${W}" height="${H}" fill="url(#p-${uid})" opacity="0.16"/>`;
      break;
    }
    default: { // Minimal
      defs += `<radialGradient id="v-${uid}" cx="50%" cy="42%" r="78%">
        <stop offset="50%" stop-color="#000" stop-opacity="0"/>
        <stop offset="100%" stop-color="#000" stop-opacity="0.38"/></radialGradient>`;
      body = `<rect width="${W}" height="${H}" fill="${c1}"/>
        <rect width="${W}" height="${H}" fill="url(#v-${uid})"/>`;
    }
  }

  let grain = '';
  if (p.grain) {
    defs += `<filter id="n-${uid}">
      <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" stitchTiles="stitch"/>
      <feColorMatrix type="saturate" values="0"/></filter>`;
    grain = `<rect width="${W}" height="${H}" filter="url(#n-${uid})" opacity="0.07"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>${defs}</defs>${body}${grain}</svg>`;
}

export async function renderWallpaperArtPng(p, styleName, sizeKey) {
  const [W, H] = WALLPAPER_SIZES[sizeKey] ?? WALLPAPER_SIZES['iPhone 4K'];
  return svgToPng(wallpaperArt(p, styleName, W, H, `x-${styleName}`), W, H);
}

// Curated starting palettes for wallpaper-first work (not icon-pack presets)
export const WALLPAPER_PALETTES = [
  { name: 'Nightfall', c1: '#1e1b4b', c2: '#0f172a', accent: '#818cf8' },
  { name: 'Ember', c1: '#7c2d12', c2: '#18181b', accent: '#fb923c' },
  { name: 'Mint', c1: '#065f46', c2: '#022c22', accent: '#6ee7b7' },
  { name: 'Blush', c1: '#be185d', c2: '#4c0519', accent: '#fbcfe8' },
  { name: 'Arctic', c1: '#0e7490', c2: '#082f49', accent: '#a5f3fc' },
  { name: 'Sand', c1: '#d6c7a1', c2: '#78350f', accent: '#fef3c7' },
  { name: 'Mono', c1: '#3f3f46', c2: '#09090b', accent: '#d4d4d8' },
  { name: 'Violet', c1: '#6d28d9', c2: '#2e1065', accent: '#e9d5ff' },
];
