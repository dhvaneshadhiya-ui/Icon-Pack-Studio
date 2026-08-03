// iOS URL schemes for web-clip icons (com.apple.webClip.managed).
//
// Confidence levels — URL schemes are undocumented and change without notice.
// ALWAYS verify on a real device before shipping a pack.
//   'verified' — confirmed launching the correct app on a real device
//                (device test, iOS 26, 2026-07-31 — Obsidian Glass profile)
//   'high'     — widely used, stable for years
//   'medium'   — works but has changed historically, or is version-sensitive
//   null       — no known scheme; the app cannot be a web clip (skip it)
//
// Stock Apple apps are the weak spot: several (Safari, Camera, Calculator)
// have no public scheme at all and simply cannot be themed this way.

export const URL_SCHEMES = {
  // ---- Apple / system -----------------------------------------------------
  Phone: ['mobilephone://', 'verified'], // Brass uses bare tel: which is for dialing numbers, not opening the app
  Messages: ['messages://', 'verified'], // confirmed in the wild
  Mail: ['message://', 'verified'],
  Safari: [null, null], // no scheme — Safari cannot be opened by URL scheme
  Camera: [null, null], // NO working scheme — Brass ships camera:// anyway and that icon does nothing (user-observed)
  Photos: ['photos-redirect://', 'verified'],
  Settings: ['App-prefs://', 'verified'],
  Maps: ['maps://', 'verified'],
  Music: ['music://', 'verified'],
  Calendar: ['calshow://', 'verified'],
  Clock: ['clock-alarm://', 'verified'],
  Notes: ['mobilenotes://', 'verified'],
  Reminders: ['x-apple-reminderkit://', 'verified'],
  Weather: ['weather://', 'verified'],
  Calculator: [null, null], // calc:// failed device test 2026-08-03 (removed by Apple ~iOS 16) — Shortcuts-only
  Wallet: ['shoebox://', 'verified'],
  Health: ['x-apple-health://', 'verified'],
  'App Store': ['itms-apps://', 'verified'],
  Podcasts: ['podcasts://', 'verified'],
  FaceTime: ['facetime://', 'verified'], // may prompt a call on some versions
  Files: ['shareddocuments://', 'verified'],
  Books: ['ibooks://', 'verified'],
  'Find My': ['findmy://', 'medium'], // same at-risk class as failed gist schemes — presume dead until a confirmed tap
  Shortcuts: ['shortcuts://', 'high'],
  'Apple TV': ['videos://', 'medium'],
  Contacts: [null, null], // BOTH contact:// and contacts:// failed device test 2026-08-03 — Shortcuts-only
  'Voice Memos': ['voicememos://', 'medium'],
  Stocks: ['stocks://', 'medium'],
  News: ['applenews://', 'medium'],
  Fitness: ['fitnessapp://', 'verified'],
  Translate: [null, null], // translate:// failed device test 2026-08-03
  Measure: [null, null], // measure:// failed device test 2026-08-03
  Freeform: ['freeform://', 'medium'], // same at-risk class as failed gist schemes — presume dead until a confirmed tap
  Home: [null, null], // x-hm:// failed device test 2026-08-03 — Shortcuts-only

  // ---- Social -------------------------------------------------------------
  Instagram: ['instagram://', 'verified'], // confirmed in the wild
  X: ['twitter://', 'verified'],
  Facebook: ['fb://', 'verified'],
  TikTok: ['snssdk1128://', 'verified'],
  Snapchat: ['snapchat://', 'verified'],
  WhatsApp: ['whatsapp://', 'verified'],
  Telegram: ['tg://', 'verified'],
  Messenger: ['fb-messenger://', 'verified'],
  Threads: ['barcelona://', 'verified'],
  Reddit: ['reddit://', 'verified'],
  Pinterest: ['pinterest://', 'high'],
  LinkedIn: ['linkedin://', 'high'],
  Discord: ['discord://', 'verified'],
  Signal: ['sgnl://', 'medium'],
  WeChat: ['weixin://', 'high'],
  Viber: ['viber://', 'high'],
  Line: ['line://', 'high'],
  Tumblr: ['tumblr://', 'medium'],
  BeReal: ['bereal://', 'medium'],
  Clubhouse: ['clubhouse://', 'medium'],

  // ---- Entertainment ------------------------------------------------------
  YouTube: ['youtube://', 'verified'],
  Netflix: ['nflx://', 'verified'],
  Spotify: ['spotify://', 'verified'],
  'Prime Video': ['aiv://', 'medium'],
  'Disney+': ['disneyplus://', 'medium'],
  Hulu: ['hulu://', 'medium'],
  Max: ['hbomax://', 'medium'],
  Twitch: ['twitch://', 'verified'],
  SoundCloud: ['soundcloud://', 'high'],
  Shazam: ['shazam://', 'high'],
  Audible: ['audible://', 'medium'],
  Crunchyroll: ['crunchyroll://', 'medium'],
  Plex: ['plex://', 'medium'],
  VLC: ['vlc://', 'medium'],
  Steam: ['steam://', 'medium'],
  PlayStation: [null, null], // playstationapp:// FAILED device test 2026-08-03 — https fallback only
  'Epic Games': [null, null],
  Roblox: ['roblox://', 'medium'],
  Kindle: ['kindle://', 'medium'],
  Goodreads: ['goodreads://', 'medium'],

  // ---- Google & productivity ---------------------------------------------
  Gmail: ['googlegmail://', 'verified'],
  Chrome: ['googlechrome://', 'verified'],
  Google: ['google://', 'high'],
  'Google Maps': ['comgooglemaps://', 'verified'],
  'Google Drive': ['googledrive://', 'high'],
  'Google Photos': ['googlephotos://', 'high'],
  'Google Docs': ['googledocs://', 'medium'],
  'Google Sheets': ['googlesheets://', 'medium'],
  Gemini: ['google-gemini://', 'medium'],
  ChatGPT: ['chatgpt://', 'verified'],
  Claude: ['claude://', 'medium'],
  Notion: ['notion://', 'verified'],
  Slack: ['slack://', 'verified'],
  Zoom: ['zoomus://', 'verified'],
  Teams: ['msteams://', 'high'],
  Outlook: ['ms-outlook://', 'high'],
  Dropbox: ['dbapi-1://', 'medium'],
  Evernote: ['evernote://', 'medium'],
  Todoist: ['todoist://', 'medium'],
  Trello: ['trello://', 'medium'],
  Asana: ['asana://', 'medium'],
  Canva: ['canva://', 'medium'],
  Figma: ['figma://', 'medium'],
  GitHub: ['github://', 'medium'],
  '1Password': ['onepassword://', 'medium'],
  Duolingo: ['duolingo://', 'medium'],

  // ---- Finance ------------------------------------------------------------
  PayPal: ['paypal://', 'verified'],
  Venmo: ['venmo://', 'high'],
  'Cash App': ['cashme://', 'medium'],
  'Google Pay': ['gpay://', 'medium'],
  Paytm: ['paytm://', 'high'],
  PhonePe: ['phonepe://', 'high'],
  Wise: ['transferwise://', 'medium'], // wise:// FAILED device test 2026-08-03; legacy-name scheme is the remaining candidate
  Revolut: ['revolut://', 'medium'],
  Coinbase: ['coinbase://', 'medium'],
  Binance: ['binance://', 'medium'],
  Robinhood: ['robinhood://', 'medium'],
  Stripe: [null, null],

  // ---- Shopping & food ----------------------------------------------------
  Amazon: ['com.amazon.mobile.shopping://', 'verified'],
  eBay: ['ebay://', 'high'],
  Etsy: ['etsy://', 'medium'],
  AliExpress: ['aliexpress://', 'medium'],
  Flipkart: ['flipkart://', 'high'],
  Shein: [null, null], // shein:// FAILED device test 2026-08-03 — https fallback only
  Temu: ['temu://', 'medium'],
  Myntra: ['myntra://', 'medium'],
  'Uber Eats': ['ubereats://', 'high'],
  DoorDash: ['doordash://', 'medium'],
  Zomato: ['zomato://', 'high'],
  Swiggy: ['swiggy://', 'high'],
  Starbucks: ['starbucks://', 'medium'],
  "McDonald's": ['mcdonalds://', 'medium'],

  // ---- Travel & transport -------------------------------------------------
  Uber: ['uber://', 'verified'],
  Lyft: ['lyft://', 'high'],
  Airbnb: ['airbnb://', 'high'],
  Booking: ['booking://', 'medium'],
  Expedia: ['expedia://', 'medium'],
  TripAdvisor: ['tripadvisor://', 'medium'],
  Waze: ['waze://', 'high'],

  // ---- Health & lifestyle -------------------------------------------------
  Strava: ['strava://', 'high'],
  Nike: ['nikeplus://', 'medium'],
  Fitbit: ['fitbit://', 'medium'],
  MyFitnessPal: ['mfp://', 'medium'],
  Headspace: ['headspace://', 'medium'],
  Calm: ['calm://', 'medium'],
  Tinder: ['tinder://', 'high'],
  Bumble: ['bumble://', 'medium'],
  Hinge: ['hinge://', 'medium'],

  // ---- Utilities ----------------------------------------------------------
  NordVPN: ['nordvpn://', 'medium'],
  Speedtest: ['speedtest://', 'medium'],
  Firefox: ['firefox://', 'high'],
  Arc: ['arc://', 'medium'],
};

export function schemeFor(label) {
  const hit = URL_SCHEMES[label];
  return hit && hit[0] ? { url: hit[0], confidence: hit[1] } : null;
}
