# CrestWall × Icon Pack Studio — Detailed Integration Spec

Stack: **Lovable** (React + Supabase: Postgres, Storage, Edge Functions) wrapped by
**Despia** (native iOS bridge: RevenueCat in-app purchases, OneSignal push,
save-to-Photos, share sheet, external browser, haptics).

> Where this doc names a Despia capability, wire it using the exact call from the
> Despia docs for your plan tier — the capability set below (IAP, push, media
> save, external browser) is what Despia advertises; the call names vary by SDK
> version, so don't hard-code from memory.

---

## 0. Webview realities (read first)

CrestWall is a **web app in a native wrapper**, so the icon-pack feature lives
or dies on four bridge calls. Confirm each exists in your Despia tier *before*
building the UI — the fallbacks are much worse products.

| Need | Why a webview can't do it alone | If Despia lacks it |
|---|---|---|
| **Save image → Photos** | `<a download>` and JS blob saves don't reach the iOS camera roll from a WKWebView | Dead end for Shortcuts flow. Fallback: "Open in Safari" and let users long-press each icon — bad, but shippable |
| **Open external Safari** | Profile installs and some schemes are blocked inside webviews | Phase C impossible; Phase A/B unaffected |
| **RevenueCat IAP** | Web checkout inside the app = guideline 3.1.1 rejection | No paid packs on iOS |
| **Open `shortcuts://`** | Custom-scheme navigation from a webview is often swallowed | Show a "now open Shortcuts manually" step |

**Three consequences that change the plan:**

1. **Batch-saving 50 icons is the fragile part.** Each save is a separate
   bridge round-trip, the first one triggers the iOS permission prompt, and a
   backgrounded webview can stall mid-loop. Save **on demand, one icon at a
   time** (the Phase B pattern) as the *primary* path, and treat "save all" as
   a convenience that resumes where it left off. This inverts the original
   phasing: build the checklist early, not later.
2. **Payload size matters.** 50 × 1024px PNG ≈ 40 MB per pack over mobile data.
   Display **256px thumbnails** in the grid (Supabase Storage image
   transformations, `?width=256`, Pro-plan feature — otherwise export a
   `thumbs/` set from the Studio) and fetch the 1024px original only at save
   time. Lazy-load (`loading="lazy"`) and virtualize long grids; 163 full-size
   images in a webview grid will crash on older devices.
3. **Cache-bust the pack list.** Wrapper webviews cache aggressively — a new
   drop can stay invisible for days. Version the query or send a
   cache-invalidating param with each push.

### Guideline 3.1.1 — the narrow Gumroad rule

Selling the same packs on Gumroad is fine: Gumroad is a separate storefront on
its own domain, not part of the CrestWall web app, so there is no shared-code
problem. The rule is only about what the **iOS build** displays:

- Never render a Gumroad/Stripe link, "buy on our website" upsell, or non-IAP
  pricing inside the wrapper. In-app, packs unlock via RevenueCat only.
- This matters if the Lovable app is also served as a public website that
  cross-promotes Gumroad. If so, detect the wrapper (Despia injects a UA
  marker / bridge object — confirm the exact signal in their docs), set a
  global `IS_IOS_APP` flag, and hide those CTAs behind it.
- If the web app is *only* ever loaded inside the wrapper and Gumroad is
  marketed separately, no detection is needed — just keep the two surfaces
  from linking to each other in-app.

---

## 0. Content pipeline (Studio → Supabase)

Every pack exported from Icon Pack Studio now includes **`manifest.json`**
(Export tab → "CrestWall manifest" checkbox). Upload flow per pack:

1. Studio → Download ZIP (icons at 1024, dark/mono if wanted, 4 wallpapers,
   cover, preview, manifest).
2. Unzip into Supabase Storage bucket `packs/<slug>/…` (layout below). The
   Lovable app reads ONLY the manifest + files; no per-pack code.

```
packs/
  aurum-noir/
    manifest.json
    cover.png                  ← gallery card
    preview-homescreen.png     ← detail page hero
    icons/Phone.png …          ← 1024px squares
    icons-dark/… icons-mono/…  ← optional variant sets
    wallpapers/Wallpaper-Gradient.png …  ← 2160×3840
```

`manifest.json` shape (produced by the Studio):

```json
{
  "format": "crestwall-iconpack/1",
  "name": "Aurum Noir",
  "slug": "aurum-noir",
  "iconCount": 56,
  "palette": { "c1": "#1a1a1f", "c2": "#09090b", "glyph": "#d4af37" },
  "sets": ["icons", "icons-dark", "icons-mono"],
  "icons": [ { "label": "Phone", "file": "Phone.png" }, … ],
  "wallpapers": ["Wallpaper-Gradient.png", "Wallpaper-Glow.png", …]
}
```

## 1. Supabase schema

```sql
create table icon_packs (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,          -- storage folder name
  name text not null,
  tagline text,                       -- listing blurb
  palette jsonb,                      -- from manifest (theme the detail page)
  icon_count int not null,
  sets text[] default '{icons}',
  is_free boolean default false,      -- the 8-icon starter hook
  sort int default 0,
  published_at timestamptz            -- null = draft
);

create table icon_pack_items (        -- filled from manifest on publish
  pack_id uuid references icon_packs on delete cascade,
  label text not null,
  file text not null,
  sort int default 0,
  primary key (pack_id, label)
);

create table user_pack_installs (     -- Phase B progress tracking
  user_id uuid references auth.users on delete cascade,
  pack_id uuid references icon_packs on delete cascade,
  done_labels text[] default '{}',
  updated_at timestamptz default now(),
  primary key (user_id, pack_id)
);
```

RLS: `icon_packs`/`icon_pack_items` readable by all authenticated users
(gating is at the *download* action, not the listing — locked packs should be
visible teasers). `user_pack_installs` scoped to `auth.uid()`.

Publish step = tiny Edge Function or manual SQL: read manifest from Storage,
upsert `icon_packs` + `icon_pack_items`, set `published_at`.

## 2. Paywall (RevenueCat via Despia)

- Entitlement: reuse CrestWall's existing premium entitlement — icon packs are
  a **feature of the same subscription**, not a second SKU (that's the whole
  positioning: wallpapers + icons, one sub).
- Gate: "Get pack" button checks entitlement from the RevenueCat bridge;
  locked → your existing paywall screen with the pack's cover as backdrop.
- Hook: exactly one pack with `is_free = true` (a trimmed 8-icon starter set —
  export a duplicate Studio pack with only 8 icons rather than gating files
  server-side; simpler and review-safe).
- Server hardening (optional, Phase B+): move pack files to a private bucket
  and serve via an Edge Function that checks a RevenueCat webhook-synced
  `subscribers` table; Phase A can ship with public-read files because the app
  UI is the only discovery surface.

## 3. Phase A — content drop (ship in days)

UI (Lovable prompts, reusing wallpaper components):
1. **Packs gallery tab**: grid of `cover.png` cards + name + icon count +
   lock/free badge. Order by `sort`.
2. **Pack detail page**: `preview-homescreen.png` hero, horizontal icon strip
   (first ~12 from `icon_pack_items`), matching wallpapers row (reuse the
   existing wallpaper cell component — they're just wallpapers), "Get pack" CTA.
   Tint the page from `palette`.
3. **Get pack flow** (entitled users):
   - Loop over icon URLs → Despia save-to-Photos call per image, with a
     progress bar ("Saving 12/56…"). Throttle ~150 ms between saves; first save
     triggers the iOS Photos permission prompt — explain it in a pre-flight
     sheet ("CrestWall will save 56 icons to your Photos").
   - **Webview hardening (required):** keep a `savedLabels` array in state and
     persist it per pack, so a stalled or backgrounded loop resumes instead of
     restarting; await each bridge call rather than firing 50 in parallel; show
     a "Save remaining 12" button if the run ends short. Never assume the loop
     completed — verify count before showing the success screen.
   - Then save the wallpapers the same way (already-solved flow in CrestWall).
   - Finish screen → "How to apply" button → 3-screen Shortcuts tutorial
     (static images/Lottie: create shortcut → Add to Home Screen → choose
     photo). Include a "Watch 60-sec video" link if you host one.
   - iOS albums: saving into a named album ("Aurum Noir") needs a native
     capability — if the Despia save call doesn't support albums, skip albums;
     recency in Photos is fine for the picker.
4. **Push per drop** (OneSignal via Despia): "New pack: Aurum Noir 🖤✨" deep
   link to the pack page (Despia route/deep-link param). Send at your
   wallpaper-drop cadence.

Definition of done: a subscriber goes from push → pack page → 56 icons +
3 wallpapers in Photos → tutorial, with zero new backend beyond the two tables.

## 4. Phase B — guided installer (better completion)

Problem: Shortcuts setup is repetitive; completion collapses after ~5 icons.

- **Checklist screen** per pack: rows of icon thumb + app name + "Done" state
  (persist in `user_pack_installs.done_labels`, optimistic local update).
- Row tap flow: ① copy the app name to clipboard (shortcut naming), ② Despia
  save/copy the single icon image, ③ deep link `shortcuts://create-shortcut`
  (opens Shortcuts' new-shortcut screen; iOS offers no API to prefill an
  Open-App shortcut with a custom icon — the checklist's job is to make the
  manual loop mindless), ④ on return, auto-mark the row done (app-resume
  event) with an undo toast.
- Add a "batch prep" toggle: pre-save all icons first (Phase A flow), so the
  Shortcuts picker is just "most recent photos" every time.
- Milestone nudges: local notification if a pack sits <30% installed after a
  day ("6 of 56 icons applied — finish your Aurum Noir setup").

## 5. Phase C — one-tap install via configuration profile ✅ CONFIRMED + BUILT

**No longer a spike.** Structure verified against a shipping competitor's
installed profile (Brass), and the generator is implemented in Icon Pack Studio
(`src/mobileconfig.js`, Export tab → "Install profile (.mobileconfig)").
Output validates with `plutil -lint`.

Confirmed payload shape (matches the competitor byte-for-byte in structure):

| Key | Value |
|---|---|
| `PayloadType` | `com.apple.webClip.managed` (one dict per app) |
| `URL` | the app's URL scheme, e.g. `instagram://`, `messages://` |
| `Label` | app name shown under the icon |
| `Icon` | `<data>` base64 PNG (render at ~180px — see below) |
| `IsRemovable` | `true` → shows "Removable: Yes" |
| `FullScreen` | `true` |
| `Precomposed` | `true` (stops iOS adding legacy gloss) |

### Two findings from the competitor teardown

1. **They serve the profile from `localhost`.** The Safari prompt reads
   *"localhost is trying to download a configuration profile"* — meaning the app
   runs a tiny on-device HTTP server and points Safari at it. That's a *native*
   capability; a Despia webview can't do it. **You don't need it:** serve the
   profile from a Supabase Edge Function on your own domain instead. The only
   difference is the prompt says `crestwall.app` rather than `localhost` — which
   looks *more* trustworthy, not less. Their reason for localhost is likely
   on-device generation from the user's selection.
2. **Their profile shows a red "Not Verified" because their signing certificate
   expired** (Let's Encrypt `brass.digital`, expired 4 Feb 2026). Let's Encrypt
   certs last 90 days. If you sign, **sign at generation time** inside the Edge
   Function using the current auto-renewed cert — never pre-sign a static file,
   or every pack you ever shipped goes red on renewal day. Unsigned also works
   (also red); signing correctly is what gets you the green "Verified".

### Sizing

Icons embed as base64, so profile size is the constraint: 45 icons at 180px
≈ 1.9 MB, which is fine. The same pack at 1024px would be ~40 MB and iOS will
choke. The Studio renders profile icons at 180px (Home Screen render size).

### Apps that cannot be included

Several stock apps have **no URL scheme** and must stay on the manual Shortcuts
path: Safari, Camera, Calculator, Translate, Measure, Freeform, Home. The
generator skips them and reports which were skipped. Design packs knowing
~5–10% of icons won't be profile-installable, and say so in the UI.

- **Edge Function** `install-profile`:
  - Input: pack slug + selected app labels (+ auth check).
  - Builds profile XML: one `com.apple.webClip.managed` payload per app —
    `Label` = app name, `Icon` = base64 of the 1024 PNG (downscale to ~180 px
    first; profiles with 50 full-res icons get huge), `URL` = the app's URL
    scheme, `IsRemovable` = true, `Precomposed` = true.
  - Maintain a `url_schemes` table (label → scheme): `instagram://`,
    `youtube://`, `fb://`, `x://` (fallback `https://` universal links when no
    scheme exists — those bounce through Safari).
  - Response: `Content-Type: application/x-apple-aspen-config`.
- **Signing** (optional but worth it): S/MIME-sign the profile with an SSL
  cert (`openssl smime -sign`) so iOS shows "Verified" green instead of red
  "Not Signed". Unsigned still installs.
- **Despia handoff (corrected after Brass teardown)**: the app's own WKWebView
  silently drops profile downloads — but **SFSafariViewController works**.
  Brass's download prompt fires inside the in-app Safari sheet (✕ chrome,
  device-verified), because SFSafariViewController is rendered by the real
  Safari engine out-of-process. In Despia, `window.open(url, '_blank')` opens
  exactly that sheet — so no external-Safari switch is needed, and the user
  returns to the app with one tap on ✕. Do NOT whitelist the profile domain in
  the Despia Editor (whitelisting forces external Safari and worsens the flow);
  keep that as a fallback only if some iOS version breaks the sheet.
- **It is not literally one tap on modern iOS.** Since iOS 12.2 the real flow
  is: Safari → "This website is trying to download a configuration profile" →
  Allow → **Settings → General → VPN & Device Management → Install** → passcode.
  Four steps outside your app. Write the explainer honestly and show a
  screenshot per step, or support tickets will follow.
- **Review-risk containment**: ship behind a remote flag (Supabase
  `app_config` row) — OFF in the review build, staged rollout after approval;
  keep Phase B as the always-available path. Competitors (iScreen, Icon
  Themer) ship this mechanism publicly, but Apple has tightened it before
  (iOS 14.5) — treat as enhancement, never the only path.
- Caveats to display honestly: web-clip "apps" open with a brief bounce; app
  badges (notification dots) don't show on web clips; original icons should be
  hidden in App Library manually.

## 5b. Home Screen widgets (Despia Home Widgets — real widgets, corrected)

Earlier drafts said the wrapper can't ship widgets. **Wrong**: Despia has a
[Home Widgets module](https://setup.despia.com/native-features/home-widgets),
and its model fits our stack perfectly — the widget is a **remote SVG** that
iOS re-fetches on an interval:

```
widget://https://crestwall.app/w?type=date&c1=%230B0D12&…&refresh=30
```

- Endpoint built: `crestwall/supabase/functions/widget-svg/` — stateless
  (palette rides in the query string, baked in when the user picks a pack),
  returns `image/svg+xml` + `Cache-Control: no-store`, all inputs XML-escaped
  and hex-validated. Types: `date` (re-renders with current date each
  refresh), `quote` (`|` = line break), `art`. Canvas fixed 360×169 per
  Despia's spec.
- UX: pack detail page gains "Add matching widget" → pick type → app
  registers the `widget://` URL via the scheme. Theme switch = re-register
  with the new palette params.
- **One-time native setup required** (NOT OTA): App Groups + bundle id in
  Apple Developer, enable the widget target in the Despia Editor, rebuild and
  resubmit the binary once. After that, widget designs/content are fully
  server-driven.
- Constraints (from Despia docs): iOS only; fixed size; keep SVG simple (CSS
  animation ignored); refresh interval is a minimum, iOS may stretch it under
  battery pressure — so no clocks, dates are the finest safe granularity;
  data:/blob: URLs rejected (must be plain HTTPS).

**Live widgets are pushed to Lovable as data, not code.** The Studio designs
the full 360×169 widget (any styling it can render, including glyph motifs)
and exports `widget-template.svg` containing `{TOKEN}` placeholders
(`{WEEKDAY} {WEEKDAY_SHORT} {DAY} {MONTH} {MONTH_SHORT} {YEAR}`). Upload it
to `packs/<slug>/widget-template.svg`; the widget-svg function's template
mode (`?pack=<slug>`) fetches it (5-min in-memory cache), substitutes live
values on every refresh, and serves it. Registration URL:

```
widget://https://crestwall.app/w?pack=obsidian-glass&refresh=30
```

New widget design = new file upload. No function change, no app change, no
resubmission. The parameter mode (§ above) remains the no-template fallback.

Widgets for people *without* CrestWall (Gumroad buyers) remain the static
PNG + Scriptable route the Studio's Widgets tab exports.

## 6. Analytics & KPIs (PostHog is already connected)

Events: `pack_viewed`, `pack_download_started/completed` (with icon_count),
`tutorial_completed`, `installer_row_done` (Phase B), `profile_install_started`
(Phase C), `paywall_shown_from_pack`, `sub_started_from_pack`.

KPIs: pack→paywall conversion, paywall→sub conversion attributed to packs,
median icons-applied per pack (Phase B target: 3× Phase A), pack-drop push
open rate vs wallpaper drops.

## 7. Rollout

**Week 0 — bridge spike (half a day, do this first).** Ship a hidden test route
in the web app that fires each bridge call once: save one image to Photos, open
Safari externally, read the RevenueCat entitlement, open `shortcuts://`. Run it
in a TestFlight build. Everything below assumes these four work; if
save-to-Photos doesn't, stop and solve that before writing any UI.

Week 1: schema + gallery/detail pages + single-icon save + tutorial; seed with
Aurum Noir, Obsidian Glass, one free 8-icon starter. Ship with the **checklist
installer** (formerly Phase B) as the primary flow — in a webview it is both
more reliable and higher-completion than a 50-image batch.
Week 2: "save all" batch convenience with resume; push automation on publish;
PostHog events; 2 new packs (weekly cadence begins — each also a Gumroad SKU,
hidden behind `IS_IOS_APP`).
Week 3–4: progress persistence + nudges; App Store screenshots refresh
("NEW: Icon Packs") using Studio's mockup exports.
Month 2: Phase C spike behind flag; measure completion delta vs the checklist.

Content note: for packs shipped **inside** CrestWall, use inspired/generic
glyphs (not `si:` brand marks) — an App Store binary distributing trademarked
logos as decorative content is a rejection/takedown magnet (see
PROMPT_PLAYBOOK.md §6). Arcticons-based (`ag:`) marks are line
*interpretations* and CC-BY-licensed — safer, credit them in the app's
licenses screen.
