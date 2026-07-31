# Icon Pack Studio

A local web app for conceptualizing, designing, and exporting sellable iOS
app-icon packs — feeding [CrestWall](https://apps.apple.com/in/app/crestwall-4k-wallpapers/id6764855583)
premium content and Gumroad products.

## Run

```bash
npm install
npm run dev   # http://localhost:5173
```

## What it does

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
