# Lovable prompt sequence — Icon Packs in CrestWall

Paste these **one at a time**, in order, verifying each before moving on.
Lovable degrades badly when given a whole feature in one prompt; it also
invents plausible-looking APIs for anything it doesn't know — which is exactly
what would happen with Despia. Prompt 2 exists to contain that.

Companion docs: `CRESTWALL_INTEGRATION.md` (architecture, phases, review risks).

---

## Before you start

1. Connect **Supabase** to the Lovable project (Lovable → Integrations).
2. In Supabase Storage, create a **public** bucket named `packs`.
3. Upload one exported pack so there's real data to build against:
   `packs/aurum-noir/` ← the unzipped Studio export (manifest.json, cover.png,
   preview-homescreen.png, icons/, wallpapers/).

---

## Prompt 1 — Database schema

```
Add these tables to Supabase via a migration. Do not build any UI yet.

create table icon_packs (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  tagline text,
  palette jsonb,
  icon_count int not null default 0,
  sets text[] default '{icons}',
  is_free boolean default false,
  sort int default 0,
  published_at timestamptz
);

create table icon_pack_items (
  pack_id uuid references icon_packs on delete cascade,
  label text not null,
  file text not null,
  sort int default 0,
  primary key (pack_id, label)
);

create table user_pack_installs (
  user_id uuid references auth.users on delete cascade,
  pack_id uuid references icon_packs on delete cascade,
  done_labels text[] default '{}',
  updated_at timestamptz default now(),
  primary key (user_id, pack_id)
);

RLS:
- icon_packs and icon_pack_items: readable by any authenticated user (locked
  packs must still be visible as teasers; access control happens at download).
- user_pack_installs: users can only select/insert/update rows where
  user_id = auth.uid().

Then seed one row for testing:
insert into icon_packs (slug, name, tagline, icon_count, is_free, published_at)
values ('aurum-noir', 'Aurum Noir', 'Black and gold luxury icons', 56, false, now());
```

## Prompt 2 — Native bridge wrapper (do NOT skip)

> This is the important one. It quarantines every native call into one file so
> Lovable never guesses Despia's API across the codebase. You paste the real
> Despia calls into this single file afterwards.

```
Create src/lib/native.ts — a single wrapper module for all native-bridge calls,
with web fallbacks so every feature is testable in the browser preview.

Export exactly these:

- isNativeApp(): boolean
- saveImageToPhotos(url: string): Promise<boolean>
- openExternalBrowser(url: string): Promise<void>
- openShortcutsApp(): Promise<void>
- hasPremiumEntitlement(): Promise<boolean>

Implementation rules:
- Each native call site must be ONE line marked exactly:
  // TODO(despia): replace with the real Despia SDK call
- Every function must have a working web fallback so the app runs in preview:
  - isNativeApp: check for a window flag, default false
  - saveImageToPhotos: trigger a normal browser download, return true
  - openExternalBrowser: window.open(url, '_blank')
  - openShortcutsApp: console.warn no-op
  - hasPremiumEntitlement: read localStorage 'debug_premium' === 'true'
- saveImageToPhotos must never throw; it returns false on failure.

Architectural rule for the whole project: no other file may call a native or
bridge API directly. Everything goes through src/lib/native.ts.

Also create src/lib/native.README.md listing each TODO and what to paste there.
```

**After this prompt:** open `src/lib/native.ts`, replace the five TODO lines
with the real calls from your Despia dashboard docs, and test in TestFlight
before building further (this is the Week 0 spike from the integration doc).

## Prompt 3 — Packs gallery

```
Add a route /icon-packs titled "Icon Packs", linked in the main navigation next
to Wallpapers.

Data: select from icon_packs where published_at is not null, ordered by sort asc,
then published_at desc.

UI: reuse the existing card and grid components from the wallpapers gallery so
it matches the app. Each card shows:
- cover image from Supabase storage path packs/{slug}/cover.png
- the pack name and "{icon_count} icons"
- a "FREE" badge when is_free is true; otherwise a small lock icon when
  hasPremiumEntitlement() from src/lib/native.ts returns false

All images must use loading="lazy". Tapping a card routes to /icon-packs/{slug}.
Keep it simple — no filtering or search yet.
```

## Prompt 4 — Pack detail page

```
Add route /icon-packs/:slug.

Load the icon_packs row by slug and its icon_pack_items ordered by sort.

Layout, top to bottom:
1. Hero image: packs/{slug}/preview-homescreen.png, full width, rounded corners.
2. Title, tagline, "{icon_count} icons".
3. Icon preview: horizontal scrolling strip of the first 12 items, each image
   from packs/{slug}/icons/{file}, rendered as a 64px rounded square.
4. "Matching wallpapers" row reusing the existing wallpaper cell component,
   images from packs/{slug}/wallpapers/.
5. Primary CTA button, full width, sticky at the bottom:
   - if the pack is_free or hasPremiumEntitlement() is true: "Install icons",
     routing to /icon-packs/{slug}/install
   - otherwise: "Unlock with Premium", opening the existing paywall

Tint the page accent colour using the palette jsonb column when present.
Lazy load all images.
```

## Prompt 5 — Install checklist (the primary flow)

```
Add route /icon-packs/:slug/install — a checklist that walks the user through
applying icons one at a time via the iOS Shortcuts app.

Header: progress "12 of 56 applied" plus a progress bar.

Body: one row per icon_pack_items entry, showing the icon thumbnail, the app
name, and a checkmark when done. Tapping a row:
1. calls saveImageToPhotos() from src/lib/native.ts with
   packs/{slug}/icons/{file}
2. copies the app label to the clipboard
3. calls openShortcutsApp()
4. optimistically marks the row done

Persist done labels to user_pack_installs (upsert done_labels for the current
user and pack). Marking done must work offline-optimistically and sync after.

Long-pressing or a small "undo" affordance un-marks a row.

At the top, a collapsible "How this works" card with 3 short steps:
Open App action → Add to Home Screen → choose the saved photo.

Do not attempt to automate Shortcuts — iOS provides no API for it. The goal is
to make the manual loop fast and impossible to lose your place in.
```

## Prompt 6 — Batch save with resume

```
On /icon-packs/:slug/install add a secondary "Save all icons to Photos" button.

Behaviour:
- Pre-flight sheet first: "CrestWall will save {n} icons to your Photos" with
  Cancel / Continue, because the first save triggers the iOS permission prompt.
- Then loop the icons sequentially, awaiting each saveImageToPhotos() call —
  never fire them in parallel. Show "Saving 12/56…" with a progress bar.
- Track which labels saved successfully in component state and persist it, so
  if the run stops early the button becomes "Save remaining 12".
- Never show a success screen without verifying the saved count matches.
```

## Prompt 7 — Free starter pack + paywall wiring

```
Ensure locked packs are fully browsable: the gallery and detail page must render
for everyone, and only the install route requires entitlement.

If a user opens /icon-packs/{slug}/install without entitlement and the pack is
not is_free, redirect to the existing paywall with the pack cover as background.

Add a "Start free" card at the top of the gallery pointing at the pack where
is_free is true.
```

## Prompt 8 — Analytics

```
Track these PostHog events (PostHog is already integrated):
- pack_viewed { slug }
- pack_install_opened { slug }
- icon_applied { slug, label }
- pack_batch_save_started { slug, count }
- pack_batch_save_completed { slug, saved, total }
- paywall_shown_from_pack { slug }
```

---

## What NOT to ask Lovable to do

- **Don't ask it to write Despia integration code.** It will invent an API that
  looks right and fails silently on device. Prompt 2 + your paste is the path.
- **Don't ask it to build the `.mobileconfig` generator yet.** That's a Supabase
  Edge Function and a separate spike (integration doc §5), gated behind a
  remote flag.
- **Don't ask it to resize or process icon images.** They ship pre-rendered
  from Icon Pack Studio at the sizes you exported.
- **Don't have it build a CMS.** Publishing a pack is: upload the folder to
  Storage, insert one row. If that gets tedious after ~10 packs, ask for a
  small admin page then — not now.

## Publishing a new pack (repeatable checklist)

1. Icon Pack Studio → Design → **Swap → generic glyphs** (commercial safety).
2. Export ZIP with: 1024px + 256px, wallpapers, cover, home-screen preview,
   CrestWall manifest.
3. Unzip → upload folder to Supabase Storage as `packs/<slug>/`.
4. Insert the `icon_packs` row + `icon_pack_items` rows from `manifest.json`
   (the manifest's `icons` array maps 1:1 to the items table).
5. Set `published_at` → send the OneSignal push.
