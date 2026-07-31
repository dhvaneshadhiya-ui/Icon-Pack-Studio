# The Shortcuts installer — what's actually possible

Salvaged and corrected from the original CrestWall icon-pack plan.

---

## ⚠️ The "Create Shortcut" action does not exist

The original plan's Phase 3.3 builds an installer around:

> **Action 5d: Create Shortcut** — Name: `Open [name]`, Icon: the downloaded
> image, Action: **Open App**

**There is no such action in iOS Shortcuts.** A shortcut cannot create another
shortcut, cannot set another shortcut's icon, and cannot add anything to the
Home Screen. Those are UI-only operations, deliberately restricted by Apple —
programmatic Home Screen icon creation would be a phishing vector (fake
"banking app" icons).

The plan half-knows this: Step 3.4 admits *"Apple requires the user to tap Add
to Home Screen for each icon individually. There is no fully automated bulk
install."* — which contradicts Action 5d. Don't build Phase 3 as written; you'd
lose hours in the Shortcuts editor looking for an action that isn't there.

**The three real options, ranked:**

| Approach | Automation level | Notes |
|---|---|---|
| Manual per-app Shortcuts | none — ~30 s/icon | Universal, zero risk. What every icon pack sells today |
| **Bulk-download shortcut** (below) | saves the *download* step only | Real, buildable, good Gumroad value-add |
| Configuration profile / web clips | genuine one-tap-ish | See `CRESTWALL_INTEGRATION.md` §5. Installs outside the app, review risk |

---

## The bulk-download installer (this one works)

It can't create icons, but it *can* fetch every PNG from your manifest and drop
them into a named photo album — so the buyer's Photos picker is pre-loaded and
correctly ordered when they do the manual Shortcuts loop. Every action below is
real.

**Prerequisite:** export the pack with a **CDN base URL** filled in (Export tab),
so `manifest.json` contains absolute `url` fields. Upload the folder first, and
never move it — existing installers break if the path changes.

### Actions, in order

1. **Text** → your manifest URL
   `https://cdn.crestwall.app/icon-packs/jello-dark/manifest.json`
2. **Get Contents of URL** (input: the Text above)
3. **Get Dictionary Value** → Get **Value** for key `icons` in *Contents of URL*
4. **Repeat with Each Item** (input: the dictionary value from step 3)
   - 4a. **Get Dictionary Value** → key `url` in *Repeat Item*
   - 4b. **Get Contents of URL** (input: 4a)
   - 4c. **Save to Photo Album** (input: 4b, album: your pack name)
5. **Show Notification** → "Jello Dark — 120 icons saved to Photos. Open
   Shortcuts and follow the guide to apply them."

Notes:
- Create the album manually once, or use **Create Album** first; "Save to Photo
  Album" won't invent one reliably.
- Order is preserved by `sort` in the manifest, so the album matches your
  install guide's order.
- Expect one Photos permission prompt on first run.
- 120 downloads takes ~1–2 minutes on decent Wi-Fi. Warn the user.

### Sharing it

Shortcuts → **⋯** → **Share** → **Copy iCloud Link** →
`https://www.icloud.com/shortcuts/…`

Put that link in the Gumroad product and the CrestWall pack row
(`shortcut_url`). One caveat the original plan missed: **iCloud shortcut links
can expire or be revoked**, and users on locked-down devices may be blocked
from untrusted shortcuts. Always ship the raw PNGs in the ZIP as the fallback —
the shortcut is a convenience, never the only delivery path.

---

## What the original plan got right (keep these)

- **Original reinterpretations, never copied logos** — matches our commercial
  safety rule; the Studio's "Swap → generic glyphs" button enforces it.
- **Stable URLs forever.** Moving the CDN folder breaks every installer already
  in users' hands. Version by pack slug, never reorganise.
- **Slug-based filenames.** Now in the manifest as a `slug` field per icon.
- **Legibility check at real size** — a 1024px icon can be mush at 120px.
  Use the Preview tab (icons render at true home-screen scale) before export.
- **Safe zone.** Our default glyph scale (~50% of tile) sits well inside the
  840/1024 safe area, so nothing clips under iOS masking.
- **Ship a 10-icon proof of concept first**, before committing to 120.

## What the plan's timeline assumed vs. now

| Phase | Original estimate | With Icon Pack Studio |
|---|---|---|
| Concept & palette | 2–4 h | minutes (style presets / theme prompts) |
| Master component + first 10 | 4–6 h | minutes |
| Full 80–120 icon set | **2–3 days** | one click ("Add all 163 catalog apps") |
| Wallpapers | 3–4 h | one click (Wallpapers tab) |
| Marketing assets | 4–6 h | one click (cover + mockup in the ZIP) |
| Manifest + upload | 2–3 h | included in export; upload only |
| Shortcuts installer | 2–3 h | 2–3 h (unchanged — still manual) |
| Testing | 2–3 h | 2–3 h (unchanged — test on device) |
| **Total** | **5–7 days** | **~half a day**, mostly testing |

The remaining real work is exactly what `LOVABLE_PROMPTS.md` covers: the app
catalog UI and the install flow.
