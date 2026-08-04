import { icons } from 'lucide';
import * as simpleIcons from 'simple-icons';
import { APP_GLYPHS } from './appGlyphs.js';

let nextId = 1;
export const uid = () => `i${nextId++}_${Math.random().toString(36).slice(2, 7)}`;

// ---------------------------------------------------------------------------
// Glyph sources
//  - Lucide (stroke glyphs, generic symbols) referenced by PascalCase name
//  - simple-icons (official brand marks, filled paths) referenced as "si:slug"
//    NOTE: brand marks are trademarks of their owners. Fine for personal
//    home screens; for commercial packs prefer "inspired" generic glyphs.
// ---------------------------------------------------------------------------
export const BRANDS = {};
for (const v of Object.values(simpleIcons)) {
  if (v && v.slug && v.path) BRANDS[v.slug] = { title: v.title, path: v.path, hex: v.hex };
}
export const GLYPH_NAMES = Object.keys(icons).sort();
export const BRAND_NAMES = Object.keys(BRANDS).sort();

export const isBrand = (name) => typeof name === 'string' && name.startsWith('si:');
export const brandOf = (name) => BRANDS[name.slice(3)];
// 'ag:' = Arcticons app glyph (stroke-based line marks, see appGlyphs.js)
export const isAppGlyph = (name) => typeof name === 'string' && name.startsWith('ag:');
export const appGlyphOf = (name) => APP_GLYPHS[name.slice(3)];
export const APP_GLYPH_NAMES = Object.keys(APP_GLYPHS).sort();

export function resolveGlyph(...candidates) {
  for (const c of candidates) {
    if (!c) continue;
    if (isBrand(c) ? brandOf(c) : isAppGlyph(c) ? appGlyphOf(c) : icons[c]) return c;
  }
  return 'Circle';
}

// ---------------------------------------------------------------------------
// App catalog: [label, preferredGlyph, fallbackGlyph]
// Preferred is usually the official brand mark; fallback is a lucide glyph
// that evokes the app when the brand mark isn't available (or for
// "inspired, not official" packs).
// ---------------------------------------------------------------------------
export const APP_CATALOG = [
  {
    cat: 'Apple & System',
    apps: [
      ['Phone', 'Phone'],
      ['Messages', 'MessageCircle'],
      ['Mail', 'Mail'],
      ['Safari', 'Compass'],
      ['Camera', 'Camera'],
      ['Photos', 'Image'],
      ['Settings', 'Settings'],
      ['Maps', 'Map'],
      ['Music', 'Music'],
      ['Calendar', 'Calendar'],
      ['Clock', 'Clock'],
      ['Notes', 'StickyNote'],
      ['Reminders', 'ListChecks'],
      ['Weather', 'CloudSun'],
      ['Calculator', 'Calculator'],
      ['Wallet', 'Wallet'],
      ['Health', 'HeartPulse'],
      ['App Store', 'si:appstore', 'Store'],
      ['Podcasts', 'Podcast'],
      ['FaceTime', 'Video'],
      ['Files', 'Folder'],
      ['Home', 'House'],
      ['Books', 'BookOpen'],
      ['Fitness', 'Dumbbell'],
      ['Find My', 'MapPin'],
      ['Shortcuts', 'Command'],
      ['Translate', 'Languages'],
      ['Voice Memos', 'Mic'],
      ['Stocks', 'TrendingUp'],
      ['News', 'Newspaper'],
      ['Apple TV', 'si:appletv', 'Tv'],
      ['Contacts', 'BookUser'],
      ['Measure', 'Ruler'],
      ['Freeform', 'PenTool'],
    ],
  },
  {
    cat: 'Social',
    apps: [
      ['Instagram', 'si:instagram', 'Camera'],
      ['X', 'si:x', 'X'],
      ['Facebook', 'si:facebook', 'ThumbsUp'],
      ['TikTok', 'si:tiktok', 'Music2'],
      ['Snapchat', 'si:snapchat', 'Ghost'],
      ['WhatsApp', 'si:whatsapp', 'MessageSquare'],
      ['Telegram', 'si:telegram', 'Send'],
      ['Messenger', 'si:messenger', 'MessagesSquare'],
      ['Threads', 'si:threads', 'AtSign'],
      ['Reddit', 'si:reddit', 'MessagesSquare'],
      ['Pinterest', 'si:pinterest', 'Pin'],
      ['LinkedIn', 'Linkedin', 'Briefcase'],
      ['Discord', 'si:discord', 'Headphones'],
      ['Signal', 'si:signal', 'MessageCircle'],
      ['WeChat', 'si:wechat', 'MessageCircle'],
      ['Viber', 'si:viber', 'Phone'],
      ['Line', 'si:line', 'MessageCircle'],
      ['Tumblr', 'si:tumblr', 'Type'],
      ['BeReal', 'si:bereal', 'Camera'],
      ['Clubhouse', 'si:clubhouse', 'Mic'],
    ],
  },
  {
    cat: 'Entertainment',
    apps: [
      ['YouTube', 'si:youtube', 'MonitorPlay'],
      ['Netflix', 'si:netflix', 'Clapperboard'],
      ['Spotify', 'si:spotify', 'Disc3'],
      ['Prime Video', 'ag:amazon-prime-video', 'Play'],
      ['Disney+', 'ag:disney', 'Sparkles'],
      ['Hulu', 'ag:hulu', 'Tv'],
      ['Max', 'si:hbomax', 'Film'],
      ['Twitch', 'si:twitch', 'Radio'],
      ['SoundCloud', 'si:soundcloud', 'AudioWaveform'],
      ['Shazam', 'si:shazam', 'AudioLines'],
      ['Audible', 'si:audible', 'BookHeadphones'],
      ['Crunchyroll', 'si:crunchyroll', 'Popcorn'],
      ['Plex', 'si:plex', 'MonitorPlay'],
      ['VLC', 'si:vlcmediaplayer', 'Cone'],
      ['Steam', 'si:steam', 'Gamepad2'],
      ['PlayStation', 'si:playstation', 'Gamepad2'],
      ['Epic Games', 'si:epicgames', 'Gamepad2'],
      ['Roblox', 'si:roblox', 'Boxes'],
      ['Kindle', 'ag:kindle', 'BookOpen'],
      ['Goodreads', 'si:goodreads', 'Library'],
    ],
  },
  {
    cat: 'Google & Productivity',
    apps: [
      ['Gmail', 'si:gmail', 'AtSign'],
      ['Chrome', 'si:googlechrome', 'Globe'],
      ['Google', 'si:google', 'Search'],
      ['Google Maps', 'si:googlemaps', 'MapPin'],
      ['Google Drive', 'si:googledrive', 'HardDrive'],
      ['Google Photos', 'si:googlephotos', 'Images'],
      ['Google Docs', 'si:googledocs', 'FileText'],
      ['Google Sheets', 'si:googlesheets', 'Table'],
      ['Gemini', 'si:googlegemini', 'Sparkles'],
      ['ChatGPT', 'ag:openai-chatgpt', 'Bot'],
      ['Claude', 'si:claude', 'Sparkles'],
      ['Notion', 'si:notion', 'NotebookPen'],
      ['Slack', 'Slack', 'Hash'],
      ['Zoom', 'si:zoom', 'Video'],
      ['Teams', 'ag:microsoft-teams', 'Users'],
      ['Outlook', 'ag:microsoft-outlook', 'Mail'],
      ['Dropbox', 'si:dropbox', 'Box'],
      ['Evernote', 'si:evernote', 'StickyNote'],
      ['Todoist', 'si:todoist', 'ListChecks'],
      ['Trello', 'si:trello', 'Kanban'],
      ['Asana', 'si:asana', 'CircleDot'],
      ['Canva', 'ag:canva', 'Palette'],
      ['Figma', 'si:figma', 'PenTool'],
      ['GitHub', 'si:github', 'GitBranch'],
      ['1Password', 'si:1password', 'KeyRound'],
      ['Duolingo', 'si:duolingo', 'Bird'],
    ],
  },
  {
    cat: 'Finance',
    apps: [
      ['PayPal', 'si:paypal', 'Banknote'],
      ['Venmo', 'si:venmo', 'Banknote'],
      ['Cash App', 'si:cashapp', 'DollarSign'],
      ['Google Pay', 'si:googlepay', 'Banknote'],
      ['Paytm', 'si:paytm', 'IndianRupee'],
      ['PhonePe', 'si:phonepe', 'IndianRupee'],
      ['Wise', 'si:wise', 'ArrowLeftRight'],
      ['Revolut', 'si:revolut', 'CreditCard'],
      ['Coinbase', 'si:coinbase', 'Bitcoin'],
      ['Binance', 'si:binance', 'Bitcoin'],
      ['Robinhood', 'si:robinhood', 'TrendingUp'],
      ['Stripe', 'si:stripe', 'CreditCard'],
      ['Banking', 'Landmark'],
      ['Crypto', 'Bitcoin'],
    ],
  },
  {
    cat: 'Shopping & Food',
    apps: [
      ['Amazon', 'ag:amazon', 'Package'],
      ['eBay', 'si:ebay', 'Tag'],
      ['Etsy', 'si:etsy', 'HandHeart'],
      ['AliExpress', 'si:aliexpress', 'ShoppingBag'],
      ['Flipkart', 'ag:flipkart', 'ShoppingCart'],
      ['Shein', 'ag:shein', 'Shirt'],
      ['Temu', 'ag:temu', 'ShoppingBag'],
      ['Myntra', 'ag:myntra', 'Shirt'],
      ['Uber Eats', 'si:ubereats', 'UtensilsCrossed'],
      ['DoorDash', 'si:doordash', 'Bike'],
      ['Zomato', 'si:zomato', 'UtensilsCrossed'],
      ['Swiggy', 'si:swiggy', 'Pizza'],
      ['Starbucks', 'si:starbucks', 'Coffee'],
      ["McDonald's", 'si:mcdonalds', 'Beef'],
      ['Shopping', 'ShoppingBag'],
    ],
  },
  {
    cat: 'Travel & Transport',
    apps: [
      ['Uber', 'si:uber', 'CarTaxiFront'],
      ['Lyft', 'si:lyft', 'CarFront'],
      ['Airbnb', 'si:airbnb', 'TentTree'],
      ['Booking', 'si:bookingdotcom', 'BedDouble'],
      ['Expedia', 'si:expedia', 'Plane'],
      ['TripAdvisor', 'si:tripadvisor', 'Binoculars'],
      ['Waze', 'si:waze', 'Navigation'],
      ['Flights', 'Plane'],
      ['Trains', 'TrainFront'],
      ['Car', 'Car'],
    ],
  },
  {
    cat: 'Health & Lifestyle',
    apps: [
      ['Strava', 'si:strava', 'Activity'],
      ['Nike', 'si:nike', 'Footprints'],
      ['Fitbit', 'si:fitbit', 'Watch'],
      ['MyFitnessPal', 'Salad'],
      ['Headspace', 'si:headspace', 'Brain'],
      ['Calm', 'ag:calm', 'Moon'],
      ['Meditation', 'Flower2'],
      ['Tinder', 'si:tinder', 'Flame'],
      ['Bumble', 'ag:bumble', 'Hexagon'],
      ['Hinge', 'ag:hinge', 'HeartHandshake'],
      ['Period Tracker', 'CalendarHeart'],
      ['Sleep', 'MoonStar'],
      ['Water', 'GlassWater'],
      ['Running', 'Footprints'],
    ],
  },
  {
    cat: 'Utilities',
    apps: [
      ['NordVPN', 'si:nordvpn', 'ShieldCheck'],
      ['Speedtest', 'si:speedtest', 'Gauge'],
      ['Authenticator', 'ShieldCheck'],
      ['Scanner', 'ScanLine'],
      ['Flashlight', 'Flashlight'],
      ['QR Reader', 'QrCode'],
      ['Email', 'Mail'],
      ['Browser', 'Globe'],
      ['Firefox', 'si:firefox', 'Flame'],
      ['Arc', 'si:arc', 'Rainbow'],
    ],
  },
];

// Flat list (backward compatible shape: [label, glyph])
export const APP_PRESETS = APP_CATALOG.flatMap(({ apps }) =>
  apps.map(([label, glyph, fb]) => [label, resolveGlyph(glyph, fb)])
);

// ---------------------------------------------------------------------------
// Commercial safety
// Brand marks (si:) and Arcticons app marks (ag:) both *depict* trademarks,
// regardless of artwork licence. Packs that are sold (Gumroad) or shipped
// inside an App Store binary should use the catalog's generic lucide fallback
// instead. See PROMPT_PLAYBOOK.md §6.
// ---------------------------------------------------------------------------

// A few lucide glyphs are themselves brand shapes; no generic swap exists, so
// we surface them as a residual warning rather than silently "fixing" them.
export const BRANDISH_LUCIDE = new Set([
  'Instagram', 'Facebook', 'Youtube', 'Twitter', 'Github', 'Chrome',
  'Slack', 'Linkedin', 'Twitch', 'Figma', 'Apple', 'Codepen', 'Dribbble',
]);

export const isTrademarkGlyph = (g) =>
  isBrand(g) || isAppGlyph(g) || BRANDISH_LUCIDE.has(g);

// The generic, non-trademark glyph the catalog defines for an app, if any.
export function genericGlyphFor(label) {
  for (const { apps } of APP_CATALOG) {
    const hit = apps.find(([l]) => l === label);
    if (!hit) continue;
    const [, pref, fb] = hit;
    const candidate = fb ?? (isTrademarkGlyph(pref) ? null : pref);
    return candidate && icons[candidate] && !BRANDISH_LUCIDE.has(candidate)
      ? candidate
      : null;
  }
  return null;
}

// { swappable, residual } counts for the current pack (images are exempt —
// AI/imported art is the user's own).
export function auditTrademarks(pack) {
  let swappable = 0;
  let residual = 0;
  for (const ic of pack.icons) {
    if (ic.image || !isTrademarkGlyph(ic.glyph)) continue;
    if (genericGlyphFor(ic.label)) swappable++;
    else residual++;
  }
  return { swappable, residual };
}

// Generic icons ship without a target app by design — the buyer points them
// at their own choice via Shortcuts. Importers must not demand a registry
// match for these.
export const GENERIC_LABELS = new Set([
  'Banking', 'Crypto', 'Shopping', 'Flights', 'Trains', 'Car', 'Meditation',
  'Period Tracker', 'Sleep', 'Water', 'Running', 'Authenticator', 'Scanner',
  'Flashlight', 'QR Reader', 'Email', 'Browser',
]);

export function makeIcon(label, glyph, fallback) {
  return {
    id: uid(),
    label,
    glyph: resolveGlyph(glyph, fallback),
    image: null, // dataURL when imported or AI-generated
    imageMode: 'cover', // 'cover' | 'contain'
    ov: {}, // optional per-icon style overrides: c1, c2, glyphColor
  };
}

export function defaultPack() {
  const picks = [
    ...APP_CATALOG[0].apps.slice(0, 16), // system
    ...APP_CATALOG[1].apps.slice(0, 8), // social
  ];
  return {
    name: 'Midnight Minimal',
    style: {
      bgType: 'linear', // 'solid' | 'linear' | 'radial'
      c1: '#0f172a',
      c2: '#334155',
      angle: 135,
      glyphColor: '#e2e8f0',
      glyphScale: 0.48,
      strokeWidth: 1.6,
      overlay: 'none', // 'none' | 'gloss' | 'vignette'
    },
    icons: picks.map(([label, glyph, fb]) => makeIcon(label, glyph, fb)),
  };
}

import { loadStoredPack, storePack } from './storage.js';

export async function loadPack() {
  try {
    const pack = await loadStoredPack();
    if (!pack || !pack.icons || !pack.style) return defaultPack();
    // One-time upgrade: packs saved before brand glyphs existed get the
    // official mark for any catalog app still on a generic lucide glyph.
    const preferred = new Map(
      APP_CATALOG.flatMap(({ apps }) => apps.map(([l, g, f]) => [l, resolveGlyph(g, f)]))
    );
    for (const ic of pack.icons) {
      const want = preferred.get(ic.label);
      const wantIsMark = want && (isBrand(want) || isAppGlyph(want));
      const hasMark = isBrand(ic.glyph) || isAppGlyph(ic.glyph);
      if (wantIsMark && !ic.image && !hasMark) ic.glyph = want;
    }
    return pack;
  } catch {
    return defaultPack();
  }
}

export function savePack(pack) {
  return storePack(pack); // async; resolves false only if all storage fails
}

export const STYLE_PRESETS = [
  { name: 'Midnight', bgType: 'linear', c1: '#0f172a', c2: '#334155', angle: 135, glyphColor: '#e2e8f0' },
  { name: 'Sunset', bgType: 'linear', c1: '#f97316', c2: '#db2777', angle: 160, glyphColor: '#fff7ed' },
  { name: 'Sage', bgType: 'solid', c1: '#8a9a8b', c2: '#8a9a8b', angle: 0, glyphColor: '#f3f4ee' },
  { name: 'Ocean', bgType: 'radial', c1: '#38bdf8', c2: '#1e3a8a', angle: 0, glyphColor: '#f0f9ff' },
  { name: 'Cream', bgType: 'solid', c1: '#f5f0e8', c2: '#f5f0e8', angle: 0, glyphColor: '#7c6a4f' },
  { name: 'Noir', bgType: 'solid', c1: '#111111', c2: '#111111', angle: 0, glyphColor: '#d4af37' },
  { name: 'Bubblegum', bgType: 'linear', c1: '#f9a8d4', c2: '#c4b5fd', angle: 120, glyphColor: '#581c87' },
  { name: 'Forest', bgType: 'linear', c1: '#14532d', c2: '#166534', angle: 90, glyphColor: '#bbf7d0' },
];
