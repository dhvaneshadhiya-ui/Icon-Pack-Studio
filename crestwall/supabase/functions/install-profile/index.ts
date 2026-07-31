// CrestWall — icon pack install profile (.mobileconfig) generator.
//
// Two modes:
//   POST /install-profile          (Authorization: Bearer <supabase jwt>)
//        body: { slug, labels? }   -> { url }   short-lived download URL
//   GET  /install-profile?t=TOKEN  (no auth — this is opened in Safari)
//        -> the .mobileconfig itself
//
// Why the two-step dance: iOS only installs configuration profiles from real
// Safari, and Safari does not carry the webview's auth state. So the app (which
// IS authenticated) mints a single-use token, then asks Despia to open Safari
// at the GET URL carrying that token.
//
// Deploy:  supabase functions deploy install-profile --no-verify-jwt
//          (JWT is verified manually below, because GET must be anonymous)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const BUCKET = Deno.env.get('PACKS_BUCKET') ?? 'packs';
const TOKEN_TTL_SECONDS = 300; // 5 minutes: enough to switch to Safari

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

// ---------------------------------------------------------------------------
// URL schemes. Keep in sync with IconPackStudio/src/urlSchemes.js — apps with
// no scheme (Safari, Camera, Calculator) cannot become web clips.
// ---------------------------------------------------------------------------
const URL_SCHEMES: Record<string, string> = {
  Phone: 'mobilephone://', Messages: 'messages://', Mail: 'message://',
  Photos: 'photos-redirect://', Settings: 'App-prefs://', Maps: 'maps://',
  Music: 'music://', Calendar: 'calshow://', Clock: 'clock-alarm://',
  Notes: 'mobilenotes://', Reminders: 'x-apple-reminderkit://',
  Weather: 'weather://', Wallet: 'shoebox://', Health: 'x-apple-health://',
  'App Store': 'itms-apps://', Podcasts: 'podcasts://', FaceTime: 'facetime://',
  Files: 'shareddocuments://', Books: 'ibooks://', Fitness: 'fitnessapp://',
  Shortcuts: 'shortcuts://', Contacts: 'contacts://',
  Instagram: 'instagram://', X: 'twitter://', Facebook: 'fb://',
  TikTok: 'snssdk1128://', Snapchat: 'snapchat://', WhatsApp: 'whatsapp://',
  Telegram: 'tg://', Messenger: 'fb-messenger://', Threads: 'barcelona://',
  Reddit: 'reddit://', Pinterest: 'pinterest://', LinkedIn: 'linkedin://',
  Discord: 'discord://', Signal: 'sgnl://', WeChat: 'weixin://',
  YouTube: 'youtube://', Netflix: 'nflx://', Spotify: 'spotify://',
  Twitch: 'twitch://', SoundCloud: 'soundcloud://', Shazam: 'shazam://',
  Gmail: 'googlegmail://', Chrome: 'googlechrome://', Google: 'google://',
  'Google Maps': 'comgooglemaps://', 'Google Drive': 'googledrive://',
  'Google Photos': 'googlephotos://', ChatGPT: 'chatgpt://',
  Notion: 'notion://', Slack: 'slack://', Zoom: 'zoomus://',
  Teams: 'msteams://', Outlook: 'ms-outlook://',
  PayPal: 'paypal://', Venmo: 'venmo://', Paytm: 'paytm://',
  PhonePe: 'phonepe://', Amazon: 'com.amazon.mobile.shopping://',
  eBay: 'ebay://', Flipkart: 'flipkart://', 'Uber Eats': 'ubereats://',
  Zomato: 'zomato://', Swiggy: 'swiggy://',
  Uber: 'uber://', Lyft: 'lyft://', Airbnb: 'airbnb://', Waze: 'waze://',
  Strava: 'strava://', Tinder: 'tinder://', Firefox: 'firefox://',
};

// One shared identifier for every pack: iOS treats a matching top-level
// PayloadIdentifier as an UPDATE, so installing a new theme replaces the old
// one instead of stacking duplicate icons. Never make this per-pack.
const PROFILE_ID = 'app.crestwall.iconpack';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Deterministic UUID from a name (v5-shaped). Keyed on the APP name, not the
// pack, so switching themes re-skins each icon in place rather than removing
// and re-appending it at the end of the Home Screen.
async function stableUuid(name: string): Promise<string> {
  const data = new TextEncoder().encode(`crestwall-iconpack:${name}`);
  const buf = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  const h = [...buf.slice(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`.toUpperCase();
}

const b64 = (bytes: Uint8Array) => {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// ---------------------------------------------------------------------------
// POST — mint a single-use download token (called from the authenticated app)
// ---------------------------------------------------------------------------
async function mintToken(req: Request): Promise<Response> {
  const auth = req.headers.get('Authorization') ?? '';
  const jwt = auth.replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'missing bearer token' }, 401);

  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData?.user) return json({ error: 'invalid session' }, 401);
  const user = userData.user;

  const { slug, labels } = await req.json().catch(() => ({}));
  if (!slug) return json({ error: 'slug required' }, 400);

  const { data: pack } = await admin
    .from('icon_packs')
    .select('id, slug, name, is_free, published_at')
    .eq('slug', slug)
    .maybeSingle();
  if (!pack || !pack.published_at) return json({ error: 'pack not found' }, 404);

  // Entitlement: free packs are open; everything else needs premium.
  if (!pack.is_free && !(await hasPremium(user.id))) {
    return json({ error: 'premium required' }, 403);
  }

  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const expires = new Date(Date.now() + TOKEN_TTL_SECONDS * 1000).toISOString();
  const { error: insErr } = await admin.from('profile_tokens').insert({
    token, user_id: user.id, pack_id: pack.id,
    labels: Array.isArray(labels) && labels.length ? labels : null,
    expires_at: expires,
  });
  if (insErr) return json({ error: 'could not create token' }, 500);

  const url = `${new URL(req.url).origin}${new URL(req.url).pathname}?t=${token}`;
  return json({ url, expiresAt: expires });
}

// Replace with however CrestWall records subscription state. If you sync
// RevenueCat webhooks into a `subscribers` table, this is the only place to
// touch. Fail CLOSED — never default to granting access.
async function hasPremium(userId: string): Promise<boolean> {
  const { data, error } = await admin
    .from('subscribers')
    .select('is_active, expires_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return false;
  if (!data.is_active) return false;
  return !data.expires_at || new Date(data.expires_at) > new Date();
}

// ---------------------------------------------------------------------------
// GET — redeem the token and stream the profile (opened in Safari)
// ---------------------------------------------------------------------------
async function serveProfile(req: Request): Promise<Response> {
  const token = new URL(req.url).searchParams.get('t');
  if (!token) return json({ error: 'missing token' }, 400);

  const { data: row } = await admin
    .from('profile_tokens')
    .select('token, pack_id, labels, expires_at, used_at')
    .eq('token', token)
    .maybeSingle();

  if (!row) return html('Link not found', 'Request a new install link from the app.');
  if (new Date(row.expires_at) < new Date()) {
    return html('Link expired', 'Install links last 5 minutes. Tap Install again in CrestWall.');
  }
  // NOT strictly single-use: iOS can fetch the profile URL more than once
  // between "Allow" and Settings → Install. Allow re-fetches for a short
  // grace window after first redemption, then treat the link as spent.
  const GRACE_MS = 10 * 60 * 1000;
  if (row.used_at && Date.now() - new Date(row.used_at).getTime() > GRACE_MS) {
    return html('Link already used', 'Each install link works once. Tap Install again in CrestWall.');
  }

  const { data: pack } = await admin
    .from('icon_packs').select('id, slug, name').eq('id', row.pack_id).maybeSingle();
  if (!pack) return html('Pack unavailable', 'Please try again later.');

  let q = admin.from('icon_pack_items').select('label, file, sort').eq('pack_id', pack.id);
  if (row.labels?.length) q = q.in('label', row.labels);
  const { data: items } = await q.order('sort');
  if (!items?.length) return html('Nothing to install', 'This pack has no icons yet.');

  const payloads: string[] = [];
  for (const item of items) {
    const scheme = URL_SCHEMES[item.label];
    if (!scheme) continue; // no URL scheme -> cannot be a web clip
    // 180px set exported by Icon Pack Studio, so no server-side resizing.
    const { data: file } = await admin.storage
      .from(BUCKET).download(`${pack.slug}/icons-profile/${item.file}`);
    if (!file) continue;
    const icon = b64(new Uint8Array(await file.arrayBuffer()));
    const id = item.label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    payloads.push(`
		<dict>
			<key>PayloadType</key><string>com.apple.webClip.managed</string>
			<key>PayloadVersion</key><integer>1</integer>
			<key>PayloadIdentifier</key><string>${PROFILE_ID}.${id}</string>
			<key>PayloadUUID</key><string>${await stableUuid(item.label)}</string>
			<key>PayloadDisplayName</key><string>${esc(item.label)}</string>
			<key>Label</key><string>${esc(item.label)}</string>
			<key>URL</key><string>${esc(scheme)}</string>
			<key>Icon</key><data>${icon}</data>
			<key>IsRemovable</key><true/>
			<key>Precomposed</key><true/>
			<key>FullScreen</key><true/>
		</dict>`);
  }

  if (!payloads.length) return html('Nothing to install', 'None of these apps support custom icons.');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>PayloadContent</key>
	<array>${payloads.join('')}
	</array>
	<key>PayloadType</key><string>Configuration</string>
	<key>PayloadVersion</key><integer>1</integer>
	<key>PayloadIdentifier</key><string>${PROFILE_ID}</string>
	<key>PayloadUUID</key><string>${crypto.randomUUID().toUpperCase()}</string>
	<key>PayloadDisplayName</key><string>${esc(pack.name)} Icons</string>
	<key>PayloadOrganization</key><string>CrestWall</string>
	<key>PayloadDescription</key><string>Adds ${payloads.length} ${esc(pack.name)} icons to your Home Screen. Remove this profile any time to remove them all.</string>
	<key>PayloadRemovalDisallowed</key><false/>
</dict>
</plist>
`;

  // Start the redemption clock on first successful serve (keep the original
  // timestamp on re-fetches within the grace window).
  if (!row.used_at) {
    await admin.from('profile_tokens')
      .update({ used_at: new Date().toISOString() }).eq('token', token);
  }

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/x-apple-aspen-config',
      'Content-Disposition': `attachment; filename="${pack.slug}.mobileconfig"`,
      'Cache-Control': 'no-store',
    },
  });
}

// Safari sees these, so return readable HTML rather than JSON.
function html(title: string, body: string) {
  return new Response(
    `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
     <style>body{font:17px -apple-system,sans-serif;padding:2rem;color:#111}h1{font-size:1.3rem}</style>
     <h1>${title}</h1><p>${body}</p>`,
    { status: 410, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    if (req.method === 'POST') return await mintToken(req);
    if (req.method === 'GET') return await serveProfile(req);
    return json({ error: 'method not allowed' }, 405);
  } catch (e) {
    console.error(e);
    return json({ error: 'server error' }, 500);
  }
});
