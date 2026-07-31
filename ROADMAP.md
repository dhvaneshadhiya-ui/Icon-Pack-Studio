# Icon Pack Business Roadmap — CrestWall + Gumroad

Goal: turn Icon Pack Studio output into (a) a premium feature inside
**CrestWall – 4K Wallpapers** (App Store id 6764855583) and (b) standalone
Gumroad products.

---

## 1. What the research says

**Market (competitors).** ScreenKit (10M+ users) and Themify (2K+ icon packs)
dominate. Themify's pricing: $4.99/week, $6.99/month, $14.99/year, $15.99
lifetime. Their model: hundreds of themed packs behind one subscription, with
matching wallpapers + widgets sold as complete "themes" — icons alone rarely
carry an app; **icon packs + matching wallpapers do**. CrestWall already has the
wallpapers, which is a genuine edge: every icon pack should ship with 2–3
matching 4K wallpapers (the Studio's style presets map 1:1 to wallpaper
gradients).

**How installation works (two methods, both used by competitors):**
1. **Shortcuts method** — user creates an "Open App" shortcut per app with a
   custom photo. Free, safe, App Store–friendly, but manual (~30s per icon).
   Apps ship a step-by-step guide + the icons saved to Photos.
2. **Configuration-profile / web-clip method** — the app generates a `.mobileconfig`
   containing web clips whose icons are your PNGs and whose URLs are the target
   apps' URL schemes. One-tap "install profile" applies a whole pack in ~1 minute
   (this is ScreenKit/iScreen's "one-tap apply"). Caveats: iOS shows a scary
   profile-install flow, launches bounce through a URL scheme, and Apple has
   historically tightened this (iOS 14.5 broke earlier variants). Review risk is
   real but many live apps use it.

**Apple's design direction (Icon Composer).** iOS 26 icons are layered
**Liquid Glass** files with Default / Dark / Mono rendering modes, built in the
free Icon Composer tool (macOS 26.4+). Implications for us: (a) "Liquid Glass"
aesthetic packs are on-trend right now — we shipped a theme prompt for it;
(b) offering **Dark and Mono variants** of each pack is the premium
differentiator competitors barely do; (c) for real developer customers (B2B
angle), exporting Icon Composer–ready layered assets is a future niche.

## 2. Product plan for CrestWall

**Positioning:** "Wallpapers + matching icon packs = complete home screen
makeovers" — one subscription.

**Content model per pack (the SKU):**
- 50–100 icons at 1024px (Studio export)
- 2–3 matching 4K wallpapers (you already produce these)
- Cover/marketing image (Studio generates this)
- Install guide (Studio generates this)

**Delivery inside CrestWall (phased):**
- **Phase A — content drop (fastest, ship in days):** packs are premium gallery
  items; subscriber taps "Get pack" → icons save to Photos as an album + in-app
  Shortcuts tutorial (3 screens). Zero new infrastructure: it's the wallpaper
  pipeline with more images.
- **Phase B — guided installer:** in-app checklist that deep-links into
  Shortcuts, tracks which apps are done, "copy icon" one at a time. Better
  completion rates, still guideline-safe.
- **Phase C — one-tap profile install (evaluate):** server generates a signed
  `.mobileconfig` of web clips for the user's chosen apps. Prototype it, test
  App Store review appetite, keep Phase B as fallback. (Competitors do ship
  this; it's the main reason people pay.)

**Paywall:** icon packs are a premium-tier entitlement; 1 free "starter pack"
(8 icons) as the hook. Push notification per new pack drop ("New: Aurum Noir").

## 3. Gumroad plan

- **SKU shape:** single pack $6–$12; "mega bundle" (all packs) $19–$29;
  free mini-pack (10 icons) as email-list lead magnet.
- **Listing assets (all exportable from the Studio):** cover grid image, phone
  mockup screenshots (Preview tab screenshots), 3–5 close-up tiles, and the
  README install guide as the delivered file's centerpiece.
- **Catalog cadence:** 1 new themed pack/week; each theme also becomes a
  CrestWall drop → one production effort, two channels.
- **Cross-promo:** Gumroad buyers get a CrestWall promo code; CrestWall
  subscribers get packs "free" — frame the subscription as the better deal.

## 4. Production pipeline (weekly)

1. Pick theme (use the `icon-pack-themes` skill for ideation).
2. Studio: template pass for full 100-app coverage OR GPT Image 2 batch
   (~$2–3/run) for artistic themes; hybrid for hero icons.
3. Export ZIP + cover; render 2–3 matching wallpapers (Higgsfield/existing
   wallpaper pipeline) in the same palette.
4. Package: Gumroad listing + CrestWall premium drop.
5. Save the `.iconpack.json` project file into `packs/` as the source of truth.

## 5. Legal / review cautions

- **Trademarks:** selling packs containing official brand marks (real X logo,
  Instagram glyph) invites takedowns — and App Store review may reject an app
  *shipping* branded icons. Use "inspired" generic symbols for commercial packs
  (see PROMPT_PLAYBOOK.md §6). Brand-mark mode stays a personal-use feature.
- **App Store:** profile-install flows need careful review handling (clear
  user consent screens, no private APIs). Shortcuts guidance is always safe.
- **AI output:** GPT Image 2 output is fine for commercial use under OpenAI
  terms; keep prompts free of brand names if the pack is for sale (use symbol
  descriptions instead).

## 6. Next build steps for Icon Pack Studio (in priority order)

1. **Wallpaper generator tab** — render 4K wallpapers from the pack's palette
   (trivial: same gradient engine at 2160×3840). Direct CrestWall synergy.
2. **Dark / Mono variant export** — one click derives dark-bg and monochrome
   versions of the whole pack (Apple's three rendering modes).
3. **CrestWall bundle export** — a JSON manifest + folder layout matching
   whatever CrestWall's content CMS expects (needs that spec from you).
4. **Phone-mockup PNG export** — turn the Preview tab into downloadable
   marketing screenshots at App Store / Gumroad sizes.
5. **`.mobileconfig` generator (Phase C spike)** — web-clip profile builder
   with a curated URL-scheme database for top 100 apps.
