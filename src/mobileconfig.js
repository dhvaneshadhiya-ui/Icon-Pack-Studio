// Generates an iOS configuration profile (.mobileconfig) of web clips — the
// mechanism competitor icon-pack apps use for "one-tap" install. Each web clip
// becomes a Home Screen icon whose artwork is your PNG and whose URL is the
// target app's URL scheme.
//
// Structure verified against a shipping product's installed profile:
//   PayloadType com.apple.webClip.managed, URL "instagram://",
//   IsRemovable true, FullScreen true.
import { renderIconPng } from './svg.js';
import { schemeFor } from './urlSchemes.js';

// Icons are embedded as base64, so keep them small — a 50-icon profile at
// 1024px would be ~40 MB and iOS chokes. 180px is the Home Screen render size.
const ICON_PX = 180;

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function blobToBase64(blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  const CHUNK = 0x8000; // avoid arg-count limits on large icons
  for (let i = 0; i < buf.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, buf.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

// Deterministic UUID derived from a name (UUID-v5 shaped).
//
// Why it matters: iOS treats an incoming payload whose PayloadUUID matches an
// installed one as an *update* rather than remove-then-add. Deriving the UUID
// from the app name — not the pack — means switching themes re-skins each icon
// in place instead of deleting every icon and appending new ones at the end of
// the Home Screen. (The TOP-LEVEL PayloadUUID is random per build on purpose:
// each generated profile is a fresh revision of the same profile identity.)
async function stableUuid(name) {
  const data = new TextEncoder().encode(`crestwall-iconpack:${name}`);
  const buf = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  const h = [...buf.slice(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`.toUpperCase();
}

/**
 * Build a .mobileconfig for every icon in the pack that has a known URL scheme.
 * Returns { xml, included, skipped } — skipped lists apps with no scheme, which
 * must fall back to the manual Shortcuts method.
 */
export async function buildMobileConfig(pack, opts = {}) {
  const org = opts.organization || 'CrestWall';
  const root = opts.identifier || 'app.crestwall.iconpack';
  const packSlug = (pack.name || 'pack').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  // Default: one shared top-level identifier, so installing any pack REPLACES
  // the previously installed one (iOS treats a matching PayloadIdentifier as an
  // update). `coexist: true` gives the pack its own identifier so it installs
  // alongside — only useful for genuine add-on packs.
  const idBase = opts.coexist ? `${root}.${packSlug}` : root;
  const minConfidence = opts.minConfidence || 'medium'; // 'high' to be strict

  const payloads = [];
  const included = [];
  const skipped = [];

  for (const ic of pack.icons) {
    const s = schemeFor(ic.label);
    if (!s || (minConfidence === 'high' && s.confidence !== 'high')) {
      skipped.push(ic.label);
      continue;
    }
    const png = await renderIconPng(ic, pack.style, ICON_PX);
    const b64 = await blobToBase64(png);
    payloads.push(`
		<dict>
			<key>PayloadType</key>
			<string>com.apple.webClip.managed</string>
			<key>PayloadVersion</key>
			<integer>1</integer>
			<key>PayloadIdentifier</key>
			<string>${esc(idBase)}.${esc(ic.label.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}</string>
			<key>PayloadUUID</key>
			<string>${await stableUuid(ic.label)}</string>
			<key>PayloadDisplayName</key>
			<string>${esc(ic.label)}</string>
			<key>Label</key>
			<string>${esc(ic.label)}</string>
			<key>URL</key>
			<string>${esc(s.url)}</string>
			<key>Icon</key>
			<data>${b64}</data>
			<key>IsRemovable</key>
			<true/>
			<key>Precomposed</key>
			<true/>
			<key>FullScreen</key>
			<true/>
		</dict>`);
    included.push({ label: ic.label, url: s.url, confidence: s.confidence });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>PayloadContent</key>
	<array>${payloads.join('')}
	</array>
	<key>PayloadType</key>
	<string>Configuration</string>
	<key>PayloadVersion</key>
	<integer>1</integer>
	<key>PayloadIdentifier</key>
	<string>${esc(idBase)}</string>
	<key>PayloadUUID</key>
	<string>${crypto.randomUUID().toUpperCase()}</string>
	<key>PayloadDisplayName</key>
	<string>${esc(pack.name)} Icons</string>
	<key>PayloadOrganization</key>
	<string>${esc(org)}</string>
	<key>PayloadDescription</key>
	<string>Adds ${included.length} ${esc(pack.name)} icons to your Home Screen. Remove this profile any time to remove them all.</string>
	<key>PayloadRemovalDisallowed</key>
	<false/>
</dict>
</plist>
`;

  return { xml, included, skipped };
}
