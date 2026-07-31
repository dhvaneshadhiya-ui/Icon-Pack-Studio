# CrestWall — install-profile Edge Function

Serves per-pack `.mobileconfig` web-clip profiles to entitled subscribers.
Mechanism verified on device (Obsidian Glass, 45 icons, iOS 26).

## Why two requests

The app's WKWebView cannot download configuration profiles. The in-app Safari
sheet (SFSafariViewController, what Despia's `window.open(url, '_blank')`
opens) **can** — Brass's flow proves it on device — but it is storage-isolated
from the webview, so it carries no Supabase session. Either way the profile
GET arrives unauthenticated:

```
[webview, authenticated]  POST /install-profile  { slug }      -> { url }
[Safari, anonymous]       GET  /install-profile?t=TOKEN        -> .mobileconfig
```

The token expires in 5 minutes and is single-use **with a 10-minute redemption
grace window** — iOS can fetch the profile URL more than once between "Allow"
and Settings → Install, so a hard single-use token would randomly break
installs. Re-fetches within the window serve the same profile; after it, the
link is spent.

## Deploy

```bash
supabase db push                                    # creates profile_tokens
supabase functions deploy install-profile --no-verify-jwt
```

`--no-verify-jwt` is required because the GET must be anonymous — the POST
verifies the JWT itself, in code.

Secrets (auto-present on Supabase): `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`. Optional: `PACKS_BUCKET` (default `packs`).

## Prerequisites

1. Tables `icon_packs`, `icon_pack_items` (see `CRESTWALL_INTEGRATION.md` §1)
   and `profile_tokens` (migration included here).
2. A `subscribers` table with `user_id`, `is_active`, `expires_at` — populated
   from RevenueCat webhooks. **`hasPremium()` in `index.ts` is the single place
   to adapt** if your schema differs. It fails closed by design.
3. Each pack folder in Storage must contain **`icons-profile/`** — the 180px
   PNG set. Icon Pack Studio emits it whenever you tick
   "Install profile (.mobileconfig)" on export. Without it the function has
   nothing to embed; it does no server-side image resizing on purpose.

## Client usage (Lovable + Despia)

```ts
import { openExternalBrowser } from '@/lib/native';

async function installPack(slug: string, labels?: string[]) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/install-profile`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session!.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ slug, labels }),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  const { url } = await res.json();

  // window.open('_blank') → SFSafariViewController: profile downloads work
  // there (Brass-verified). Do NOT use the app's own webview for this URL.
  window.open(url, '_blank');
}
```

Show the 4-step explainer **before** calling this, because everything after the
handoff happens outside your app:

1. Safari asks *"…is trying to download a configuration profile"* → **Allow**
2. Settings → **Profile Downloaded**
3. **Install** (top right) → passcode
4. Return to the Home Screen — the icons are there

The 5-minute token TTL is generous for that, but if a user stalls they just tap
Install again.

## Signing (optional, recommended later)

Unsigned profiles install fine but show a red **"Not Verified"**.

A competitor teardown showed the failure mode to avoid: they signed once with a
Let's Encrypt cert (90-day lifetime) and never re-signed, so every profile they
ever shipped now reads "Not Verified" anyway. **If you sign, sign at request
time** with the currently valid cert — store cert + key as function secrets and
rotate them with your renewal job, or the same thing happens to you.

CMS/PKCS#7 signing is possible in Deno via PKI.js. Treat it as a polish pass;
the flow works unsigned, and "Not Verified" is what shipping competitors
display today.

## One profile, not one per pack

Every pack ships under the **same** top-level `PayloadIdentifier`
(`app.crestwall.iconpack`). iOS treats a matching identifier as an *update*, so:

- Installing a new theme **replaces** the previous one — no duplicate icons, no
  growing list of profiles in Settings, nothing for the user to clean up.
- Settings shows exactly one entry, whose display name is the current pack.
- Removing it removes the whole theme in one action.

Payload UUIDs are derived from the **app name** (`stableUuid`), not the pack, so
a themed Instagram icon keeps the same UUID across every pack. iOS therefore
*updates* that web clip rather than deleting and re-adding it — which is what
lets icons re-skin in place instead of piling up at the end of the Home Screen.

Only make the identifier per-pack for genuine **add-on** packs (Studio export →
"Install alongside other packs"). Never for themes.

## Known limits (put these in the UI)

- Apps with **no URL scheme** cannot be web clips: Safari, Camera, Calculator,
  Translate, Measure, Freeform, Home. Expect ~5–10% of any pack.
- Web clips show **no notification badges**, and launching bounces briefly
  through the launcher.
- Original app icons stay in the App Library; users hide them manually.
- Removing the profile removes **all** its icons at once — which is a feature:
  it makes "uninstall this theme" a single action.
