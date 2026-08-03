// CrestWall — Despia Home Widget SVG endpoint.
//
// Despia widgets are remote SVGs: the app registers
//   widget://https://crestwall.app/w?...&refresh=30
// and iOS re-fetches this endpoint on that interval, re-rendering the Home
// Screen widget even while the app is closed. (Despia docs: fixed 360x169
// canvas, Content-Type image/svg+xml, Cache-Control no-store, keep the SVG
// simple, XML-escape everything.)
//
// Stateless by design: the palette rides in the query string, baked in by the
// CrestWall app when the user picks a pack — no DB round trip per refresh.
//
//   GET /widget-svg?type=date&c1=%230B0D12&c2=%231C2230&fg=%23E6EBF5
//       &bg=linear&angle=135&pattern=dots&name=Obsidian%20Glass
//   GET /widget-svg?type=quote&text=make%20it%20yours&...palette
//   GET /widget-svg?type=art&...palette
//
// Deploy: supabase functions deploy widget-svg --no-verify-jwt
// (public by design — it renders only what the query string describes)

const W = 360;
const H = 169;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const HEX = /^#[0-9a-fA-F]{6}$/;
const color = (v: string | null, fallback: string) =>
  v && HEX.test(v) ? v : fallback;

function background(p: {
  bg: string; c1: string; c2: string; angle: number; pattern: string; fg: string;
}): { defs: string; body: string } {
  let defs = '';
  let fill = p.c1;
  if (p.bg === 'linear') {
    const a = (p.angle * Math.PI) / 180;
    const x2 = 50 + Math.sin(a) * 50;
    const y2 = 50 - Math.cos(a) * 50;
    defs += `<linearGradient id="bg" x1="${100 - x2}%" y1="${100 - y2}%" x2="${x2}%" y2="${y2}%">
      <stop offset="0%" stop-color="${p.c1}"/><stop offset="100%" stop-color="${p.c2}"/></linearGradient>`;
    fill = 'url(#bg)';
  } else if (p.bg === 'radial') {
    defs += `<radialGradient id="bg" cx="50%" cy="30%" r="95%">
      <stop offset="0%" stop-color="${p.c1}"/><stop offset="100%" stop-color="${p.c2}"/></radialGradient>`;
    fill = 'url(#bg)';
  }
  let body = `<rect width="${W}" height="${H}" fill="${fill}"/>`;
  if (p.pattern === 'dots') {
    defs += `<pattern id="pt" width="13" height="13" patternUnits="userSpaceOnUse">
      <circle cx="6.5" cy="6.5" r="1.2" fill="${p.fg}"/></pattern>`;
    body += `<rect width="${W}" height="${H}" fill="url(#pt)" opacity="0.12"/>`;
  } else if (p.pattern === 'stripes') {
    defs += `<pattern id="pt" width="13" height="13" patternUnits="userSpaceOnUse">
      <path d="M -13 26 L 26 -13" stroke="${p.fg}" stroke-width="1"/>
      <path d="M 0 26 L 26 0" stroke="${p.fg}" stroke-width="1"/></pattern>`;
    body += `<rect width="${W}" height="${H}" fill="url(#pt)" opacity="0.12"/>`;
  } else if (p.pattern === 'grid') {
    defs += `<pattern id="pt" width="13" height="13" patternUnits="userSpaceOnUse">
      <path d="M 13 0 V 13 M 0 13 H 13" stroke="${p.fg}" stroke-width="0.8"/></pattern>`;
    body += `<rect width="${W}" height="${H}" fill="url(#pt)" opacity="0.12"/>`;
  }
  return { defs, body };
}

export function render(url: URL): string {
  const type = url.searchParams.get('type') ?? 'date';
  const p = {
    c1: color(url.searchParams.get('c1'), '#0B0D12'),
    c2: color(url.searchParams.get('c2'), '#1C2230'),
    fg: color(url.searchParams.get('fg'), '#E6EBF5'),
    bg: url.searchParams.get('bg') ?? 'linear',
    angle: Math.max(0, Math.min(360, Number(url.searchParams.get('angle') ?? 135) || 135)),
    pattern: url.searchParams.get('pattern') ?? 'none',
  };
  const { defs, body } = background(p);
  const dim = 0.65;
  let content = '';

  if (type === 'date') {
    // re-rendered on every refresh, so the date stays current
    const now = new Date();
    const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });
    const day = String(now.getDate());
    const month = now.toLocaleDateString('en-US', { month: 'long' });
    content = `
      <text x="24" y="52" font-family="-apple-system, 'SF Pro Display', sans-serif"
        font-size="17" font-weight="600" fill="${p.fg}" fill-opacity="${dim}">${esc(weekday)}</text>
      <text x="22" y="118" font-family="-apple-system, 'SF Pro Display', sans-serif"
        font-size="64" font-weight="700" fill="${p.fg}">${esc(day)}</text>
      <text x="24" y="146" font-family="-apple-system, 'SF Pro Display', sans-serif"
        font-size="17" font-weight="500" fill="${p.fg}" fill-opacity="${dim}">${esc(month)}</text>`;
    const name = url.searchParams.get('name');
    if (name) {
      content += `<text x="${W - 24}" y="${H - 23}" text-anchor="end"
        font-family="-apple-system, sans-serif" font-size="11" letter-spacing="1.5"
        fill="${p.fg}" fill-opacity="0.4">${esc(name.toUpperCase())}</text>`;
    }
  } else if (type === 'quote') {
    const text = (url.searchParams.get('text') ?? 'make it yours').slice(0, 120);
    const lines = text.split('|').map((l) => l.trim()).filter(Boolean).slice(0, 3);
    const fs = Math.min(26, 200 / Math.max(...lines.map((l) => l.length), 1) * 2.2);
    const y0 = H / 2 - ((lines.length - 1) * fs * 1.3) / 2 + fs * 0.35;
    content = lines
      .map(
        (l, i) => `<text x="${W / 2}" y="${y0 + i * fs * 1.3}" text-anchor="middle"
        font-family="Georgia, serif" font-style="italic" font-size="${fs}"
        fill="${p.fg}">${esc(l)}</text>`
      )
      .join('');
  } else {
    // 'art' — quiet panel: ring + pack monogram
    const name = url.searchParams.get('name') ?? '';
    content = `<rect x="10" y="10" width="${W - 20}" height="${H - 20}" rx="16"
      fill="none" stroke="${p.fg}" stroke-opacity="0.35" stroke-width="1.5"/>`;
    if (name) {
      content += `<text x="${W / 2}" y="${H / 2 + 6}" text-anchor="middle"
        font-family="-apple-system, sans-serif" font-size="15" letter-spacing="4"
        fill="${p.fg}" fill-opacity="0.8">${esc(name.toUpperCase())}</text>`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>${defs}</defs>${body}${content}</svg>`;
}

Deno.serve((req: Request) => {
  try {
    const svg = render(new URL(req.url));
    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    console.error(e);
    return new Response('<svg xmlns="http://www.w3.org/2000/svg" width="360" height="169"/>', {
      status: 200,
      headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' },
    });
  }
});
