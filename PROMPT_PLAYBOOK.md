# Icon Pack Prompt Playbook (GPT Image 2)

How to write prompts that produce a *cohesive, sellable* iOS icon pack — using the
**Aurum Noir** theme as the worked example. Use it with the app's **AI Generate** tab
(endpoint `https://api.openai.com/v1/images/generations`, model `gpt-image-2`).

---

## 1. The anatomy of an icon prompt

Every good icon prompt has 5 parts, always in this order:

```
[1 ROLE]        A single iOS app icon representing "{app}".
[2 SUBJECT]     One centered symbol that clearly evokes {app} …
[3 STYLE SYSTEM] …drawn as elegant thin gold line art (#D4AF37) on matte
                charcoal-black, faint golden glow…            ← THE THEME
[4 COMPOSITION] Symbol fills ~50% of tile, consistent margins,
                square full-bleed composition, flat front view.
[5 NEGATIVES]   No text, no letters, no words, no border, no rounded corners.
```

Why each part matters:

- **ROLE** — "A single iOS app icon" anchors the model to the icon domain (centered
  object, simple silhouette). Without it you get illustrations, not icons.
- **SUBJECT with `{app}`** — the Studio replaces `{app}` with each icon's name, so
  one prompt generates the whole pack. Say *"a symbol that evokes {app}"*, not
  *"the {app} logo"* — ideation beats official logos (and avoids trademark output
  refusals). GPT Image 2 knows a camera means Instagram, a paper plane means Telegram.
- **STYLE SYSTEM** — this is your theme, and it must be *identical in every
  generation*. Lock down: background (exact color), medium (line art / clay 3D /
  watercolor), palette (give hex codes), lighting, mood. Consistency is what makes
  it feel like a pack instead of 50 random images.
- **COMPOSITION** — "fills ~50% of tile" + "consistent margins" keeps optical size
  uniform across the pack. "Square full-bleed" matters because **iOS rounds the
  corners itself** — never ask for rounded corners or you get a squircle inside
  a square.
- **NEGATIVES** — GPT Image 2 loves writing the app name into icons. "No text, no
  letters, no words" is non-negotiable. Add "no border" and "no rounded corners"
  to every prompt.

## 2. Worked example — Aurum Noir

> A single iOS app icon representing "{app}". Matte charcoal-black background with
> a subtle dark vignette. One centered symbol that clearly evokes {app}, drawn as
> elegant thin gold line art (metallic gold #D4AF37) with a faint golden glow.
> Luxurious, minimal, consistent margins (symbol fills ~50% of tile). Square
> full-bleed composition, flat front view. No text, no letters, no words, no
> border, no rounded corners.

When `{app}` = "Camera" the model draws a gold-line camera; when `{app}` = "X" it
draws a bold X mark. Same background, same gold, same weight → cohesive pack.

**Per-app nudges.** For apps the model may interpret oddly, rename the icon in the
Studio to steer it (the label IS the prompt input):

| Instead of | Use as icon name | Why |
|---|---|---|
| X | X (letter X symbol) | avoids random abstract marks |
| TikTok | TikTok (musical note) | note reads instantly |
| Amazon | Amazon (delivery package) | avoids text-logo attempts |
| Netflix | Netflix (cinema clapperboard) | avoids the "N" wordmark |
| Threads | Threads (@ symbol coil) | little-known brand mark |

Rename before generating, then rename back after. (Or keep a "prompt name" habit:
`Label (symbol hint)` — everything in parentheses steers the image.)

## 3. The 8 built-in themes

The AI tab's "Load a theme prompt…" dropdown ships these, each following the same
anatomy — study how only part 3 (style system) changes:

1. **Aurum Noir** — black + gold line art (luxury)
2. **Liquid Glass** — frosted translucent glass, Apple's iOS 26 design language
3. **Pastel Dream** — blush/lavender, soft 3D cream
4. **Neon Cyber** — dark grid + cyan/magenta glow
5. **Clay 3D** — claymorphism, pastel studio render
6. **Minimal Line** — thin black ink on paper (light-mode packs sell well!)
7. **Retro 77** — burnt orange/mustard geometry, grain
8. **Watercolor Botanical** — sage washes + leaves

To invent your own: keep parts 1, 2, 4, 5 verbatim and rewrite only part 3.
Pick (a) a background treatment, (b) a medium, (c) 2–3 hex colors, (d) a mood word.

## 4. Batch workflow in the Studio

1. Design tab → build your app list (use "Add all catalog apps" or the category picker).
2. AI tab → paste your OpenAI key (stays in your browser), model `gpt-image-2`.
3. Load or write the theme prompt → **Generate N icons without images**.
4. Review the grid. Bad ones? Select the icon → Remove image → tweak its name with
   a symbol hint → regenerate just the missing ones (same button — it only fills gaps).
5. Export tab → ZIP (1024px + cover + README).

Cost reality check: GPT Image 2 runs roughly $0.03–$0.06/image, so a 50-icon pack
costs about **$1.50–$3.00 per full generation run**. Budget 1.5×–2× for retries.

## 5. Template vs AI — when to use which

- **Template mode** (glyphs): pixel-perfect consistency, official brand marks
  available, instant, free. Best for minimal/mono themes like Aurum Noir. This is
  how the bundled `packs/Aurum-Noir.iconpack.json` was made — import it from the
  Export tab to inspect.
- **AI mode**: textures and mediums glyphs can't do (clay, glass, watercolor,
  neon glow). Best for premium "artistic" packs. Less consistent — expect retries.
- **Hybrid** (strong sellers do this): AI for the 10 hero icons on your listing
  cover, template mode for full 100+ app coverage.

## 6. Trademark note (for selling)

Generic symbols (a camera, a chat bubble, a musical note) are safe. Official brand
marks (the real X logo, Instagram camera outline) are trademarks — fine for a
user's personal home screen, riskier to *sell* or to ship inside an App Store app.
For CrestWall and Gumroad packs, prefer "inspired" symbols — which, conveniently,
is also what AI generation naturally produces.
