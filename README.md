# Icon Pack Studio

The content creation hub for [CrestWall](https://apps.apple.com/in/app/crestwall-4k-wallpapers/id6764855583):
icon packs, wallpapers (static, AI-generated, depth-effect, live), and
widgets — designed and exported from one local web app, feeding CrestWall
premium content and Gumroad products.

The production pipeline: share an idea or reference images with the
`/icon-pack-themes` skill (the prompt engine) → paste the prompt and upload
the references in the Studio → gpt-image-2 generates → curate → publish.

## Run

```bash
npm install
npm run dev   # http://localhost:5173
```

## What it does

- **Home** — pick what to create (icons, AI icons, wallpapers, AI wallpapers,
  depth, live, widgets, export). OpenAI API key lives in ⚙ Settings, saved in
  the browser. Reference images can be dragged, dropped or pasted (⌘V)
  anywhere — they land in a shared tray and ride along with every AI
  generation.
- **Depth wallpapers** — single AI-generated image composed for Apple's
  Lock Screen Depth Effect (iOS segments the subject on device): subject
  slightly below center, upper 35–45% clean, top edge crossing the clock
  area. House prompt templates built in, with a clock-band preview to
  validate composition. Saves upscale to 1290×2796 or 4K 2160×3840.
- **Live wallpapers** — two in-app paths: animate any still into a seamless
  loop (7 canvas motion effects, recorded to MP4 at 1080×1920), or generate
  video from a prompt via OpenAI's Videos API (sora-2, $0.10/s, same key)
  with a crossfade loop-smoothing pass. Convert to a Live Photo with intoLive.
- **Design** — 163-app catalog, ~5,200 glyphs (lucide + simple-icons brand
  marks + Arcticons app marks), style presets, gradients/patterns/finishes,
  per-icon overrides, image import, AI contact-sheet slicing, and a
  commercial-safety audit that swaps trademarked marks for generic glyphs in
  one click.
- **Preview** — live iPhone home-screen mockup; exports 1290×2796 marketing
  shots.
- **Wallpapers** — 4K companion wallpapers generated from the pack palette.
- **AI Generate** — GPT Image 2 batch generation (bring your own key) with a
  theme-prompt library; `{app}` placeholder renders one prompt across the
  whole pack.
- **Export** — ZIP with 1024/512/256 px PNGs, dark & mono variant sets,
  cover, buyer install guide, CrestWall `manifest.json`, and a
  device-verified `.mobileconfig` web-clip installer (one-tap Home Screen
  install; URL-scheme database in `src/urlSchemes.js`).

## CrestWall integration

`crestwall/` contains the Supabase Edge Function that serves
entitlement-gated install profiles, plus its migration. Architecture, phased
rollout, and App Store considerations are documented in
[CRESTWALL_INTEGRATION.md](CRESTWALL_INTEGRATION.md); paste-ready build
prompts in [LOVABLE_PROMPTS.md](LOVABLE_PROMPTS.md).

## Docs

- [PROMPT_PLAYBOOK.md](PROMPT_PLAYBOOK.md) — writing icon prompts for GPT Image 2
- [ROADMAP.md](ROADMAP.md) — business plan (CrestWall + Gumroad)
- [SHORTCUTS_INSTALLER.md](SHORTCUTS_INSTALLER.md) — what iOS Shortcuts can and can't do
- `packs/` — editable pack project files (import via the Export tab)

## Credits

Some app symbols adapted from [Arcticons](https://arcticons.onnno.nl)
(CC BY 4.0). Brand marks from [simple-icons](https://simpleicons.org) are
trademarks of their owners — personal use only; commercial packs use the
generic-glyph swap.
