# Web-Clip Launch Compatibility Report

**Which apps can and cannot be launched by a configuration-profile icon theme —
and whether CrestWall's profiles are built correctly.**

Prepared 31 Jul 2026 · Sources: on-device testing (iOS 26, Obsidian Glass
profile), Brass profile teardown, community URL-scheme references.

---

## 1. Direct answer to the question

Your understanding is **mostly right, with one correction about the reason**.

A profile web clip is nothing more than a Home Screen bookmark: *tap → iOS
opens a URL*. It can launch an app **only if that app has registered a URL
scheme** (like `instagram://`). So:

- **Popular third-party apps** — almost always launchable. Registering a scheme
  is standard practice (marketing deep links depend on it).
- **Apple's stock apps** — a mixed bag. Many have schemes (Messages, Maps,
  Photos, Settings…), but several **register no scheme at all**, and no
  profile, from any vendor, can ever launch those.
- The limitation is **not** a "sandbox" restriction on the profile — the
  profile installs fine and the icon appears. The failure happens at *tap
  time*: iOS looks up who handles the URL, finds no app registered for it, and
  does nothing. That's also why there's no error message.

**Your observation decoded:** the non-launching Phone and Camera icons you saw
are Brass's, and your screenshots show exactly why (see §3). Camera was never
in our profile at all — we exclude apps that can't work.

## 2. Apps that CANNOT be launched by any profile

**Stock apps with no registered URL scheme (confirmed impossible):**

| App | Notes |
|---|---|
| **Safari** | No scheme. (`http://` links open *a page*, not the browser app cleanly) |
| **Camera** | No working scheme — see §3, Brass ships a dead icon for it |

> **Addendum (3 Aug 2026, device tap-test, iOS 26):** Translate
> (`translate://`), Measure (`measure://`) and Freeform (`freeform://`) —
> listed as impossible at the time of writing — now launch correctly and are
> device-verified. Also verified: Home `x-hm://`, Calculator `calc://`,
> Find My `findmy://`, Contacts `contact://`. Confirmed dead on device:
> `tips://`, `wise://`, `shein://`, `playstationapp://`.

**Third-party apps in our catalog with no known scheme:** Epic Games, Stripe.

**Generic icons** (Banking, Browser, Email, Shopping, Flights, Meditation,
etc.) are intentionally app-less — the buyer points them at their own bank/
browser via the Shortcuts method.

Everything above stays available through the **manual Shortcuts path** — which
is exactly why Brass's own UI says *"You'll need to manually set the remaining
11 icons using Shortcuts as they cannot be configured automatically."* Every
vendor has this list; the honest ones surface it.

## 3. What the Brass teardown revealed (your screenshots)

Two of Brass's payloads are **defective**, and they explain what you observed:

1. **Camera → `camera://`** — there is no such registered scheme. The icon
   installs, looks perfect, and does nothing when tapped. Shipping it anyway
   is a Brass bug, not an iOS inevitability.
2. **Phone → bare `tel:`** — `tel:` is Apple's *dialing* scheme, defined as
   `tel:` + a phone number; with no number there's nothing to dial. The
   correct app-open scheme is **`mobilephone://`**, which is what we use and
   what you device-verified.

Lesson: our policy (exclude what can't work, report it) beats their policy
(ship it broken).

## 4. Is our profile built correctly? — audit result

**Payload structure: correct**, byte-for-byte the same shape as the working
parts of Brass (`com.apple.webClip.managed`, scheme URL, 180px icon,
`IsRemovable`/`FullScreen`/`Precomposed`), and validated by `plutil`. The
install and launch chain is device-proven: 45/45 icons in your Obsidian Glass
test opened the right apps.

**Scheme database: 139 apps with schemes** (45 of them device-verified on
iOS 26), and this audit produced four upgrades, now live in
`src/urlSchemes.js` and the CrestWall registry seed:

| App | Was | Now | Why |
|---|---|---|---|
| Calculator | excluded | `calc://` | scheme exists after all |
| Home | excluded | `x-hm://` | scheme exists after all |
| Find My | `fmip1://` | `findmy://` | canonical modern scheme |
| Contacts | `contacts://` | `contact://` | canonical form (singular) |

**Please spot-check these four** next time you install a test profile —
they're the only unverified changes. Also worth a second tap if you're
thorough: FaceTime (`facetime://` may prompt a call on some iOS versions
rather than opening the app) and TikTok (`snssdk1128://` is their legacy
internal scheme).

## 5. Recommendations for the CrestWall UI

1. **Show the split before install.** "37 of 42 icons install automatically —
   these 5 (Safari, Camera…) are applied with a 30-second Shortcuts step."
   Brass buries this; making it explicit prevents "broken icon" reviews.
2. **Never ship a clip without a scheme** — the generator already enforces
   this (it skips and reports).
3. **The registry's `confidence` column is your safety valve.** Schemes are
   undocumented and Apple can change them (it has before — several broke in
   iOS 16). If a scheme dies, fix the registry row and every profile generated
   afterward is correct — no app update needed.
4. **Track `icon_tap_failures` indirectly**: you can't detect a dead web clip,
   so keep the manual-Shortcuts fallback visible in the app permanently.

## 6. Sources

- On-device verification: Obsidian Glass profile, 45 web clips, iOS 26 (all
  launched correctly — your test)
- Brass profile teardown: your Settings screenshots (`tel:`, `camera://`,
  "remaining 11 icons" notice)
- [iOS App URL Schemes gist (community canonical list)](https://gist.github.com/roachhd/c5d9c9dee45c73568daff94b343f5170)
- [Complete List of iOS URL Schemes for Apple Apps (Medium, maintained)](https://medium.com/@contact.jmeyers/complete-list-of-ios-url-schemes-for-apple-apps-and-services-always-updated-800c64f450f)
- [Apple: Phone Links (`tel:` requires a number)](https://developer.apple.com/library/archive/featuredarticles/iPhoneURLScheme_Reference/PhoneLinks/PhoneLinks.html)
- [Apple Developer Forums: stock-app schemes breaking in iOS 16](https://developer.apple.com/forums/thread/723348)
