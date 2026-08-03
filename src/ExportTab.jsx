import React, { useRef, useState } from 'react';
import JSZip from 'jszip';
import {
  renderIconPng, renderCoverPng, renderWallpaperPng, renderMockupPng, renderWidgetPng,
  despiaWidgetSvg, WALLPAPER_VARIANTS, WIDGET_SIZES,
  darkStyle, darkIcon, monoStyle, monoIcon, shade,
} from './svg.js';
import { buildMobileConfig } from './mobileconfig.js';
import { scriptableWidget } from './scriptable.js';

const sanitize = (s) => s.replace(/[^\w\- ]/g, '').trim().replace(/\s+/g, '-') || 'icon';

function readme(pack) {
  return `${pack.name}
${'='.repeat(pack.name.length)}

Thank you for downloading this icon pack! It contains ${pack.icons.length} app icons
as 1024x1024 PNG files, ready to use on your iPhone or iPad home screen.

HOW TO APPLY THE ICONS (iOS)
----------------------------
1. Save the icon images to your Photos or Files app.
2. Open the built-in "Shortcuts" app.
3. Tap "+" to create a new shortcut, choose "Open App", and pick the app
   (e.g. Instagram).
4. Tap the shortcut name > "Add to Home Screen".
5. Tap the icon thumbnail > "Choose Photo" (or "Choose File") and select the
   matching icon from this pack.
6. Name it and tap "Add". Repeat for each app.
7. Optional: hide the original app icons in the App Library so only the new
   ones show.

WHAT'S INSIDE
-------------
- icons/           the icon set (1024px PNG)
- icons-dark/      dark-mode variant (if included)
- icons-mono/      monochrome variant (if included)
- wallpapers/      matching 4K wallpapers (if included)
- widgets/         matching widget images + a live Scriptable widget
                   (PNGs: use any photo-widget app like Widgetsmith or
                   WidgetClub; .scriptable: import into the free Scriptable
                   app, then add a Scriptable widget to your Home Screen)
- preview-homescreen.png   how the pack looks applied (if included)

NOTES
-----
- iOS rounds the corners automatically — the PNGs are intentionally square.
- Icons open apps via Shortcuts; the first tap may briefly show a banner
  depending on your iOS version.

CREDITS
-------
Some app symbols adapted from Arcticons (https://arcticons.onnno.nl), CC BY 4.0.

Enjoy your new home screen!
`;
}

function download(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

export default function ExportTab({ pack, setPack }) {
  const [sizes, setSizes] = useState({ 1024: true, 512: false, 256: false });
  const [extras, setExtras] = useState({ cover: true, readme: true, wallpapers: true, widgets: true, mockup: true, manifest: true, profile: false, lovable: false });
  const [variants, setVariants] = useState({ dark: false, mono: false });
  const [baseUrl, setBaseUrl] = useState('');
  const [busy, setBusy] = useState('');
  const [profileReport, setProfileReport] = useState(null);
  const importRef = useRef(null);

  const toggle = (obj, setObj, k) => setObj({ ...obj, [k]: !obj[k] });

  const exportZip = async () => {
    const chosen = Object.entries(sizes).filter(([, v]) => v).map(([k]) => +k);
    if (!chosen.length) return;
    const zip = new JSZip();
    const root = zip.folder(sanitize(pack.name));
    // mode name -> [style transform, icon transform]
    const modes = [['', (s) => s, (i) => i]];
    if (variants.dark) modes.push(['-dark', darkStyle, darkIcon]);
    if (variants.mono) modes.push(['-mono', monoStyle, monoIcon]);
    const total = pack.icons.length * chosen.length * modes.length;
    let done = 0;
    for (const [suffix, fs, fi] of modes) {
      const style = fs(pack.style);
      for (const size of chosen) {
        const base = chosen.length > 1 ? `icons-${size}` : 'icons';
        const folder = root.folder(`${base}${suffix}`);
        const used = new Set();
        for (const ic of pack.icons) {
          setBusy(`Rendering ${++done}/${total}…`);
          let name = sanitize(ic.label);
          while (used.has(name)) name += '-2';
          used.add(name);
          folder.file(`${name}.png`, await renderIconPng(fi(ic), style, size));
        }
      }
    }
    if (extras.wallpapers) {
      const wf = root.folder('wallpapers');
      for (const v of WALLPAPER_VARIANTS) {
        setBusy(`Rendering wallpaper: ${v}…`);
        wf.file(`Wallpaper-${v}.png`, await renderWallpaperPng(pack.style, v));
      }
    }
    if (extras.widgets) {
      const wgf = root.folder('widgets');
      const motif = pack.icons.find((i) => !i.image)?.glyph;
      for (const k of Object.keys(WIDGET_SIZES)) {
        setBusy(`Rendering widget: ${k}…`);
        wgf.file(`widget-${k}.png`, await renderWidgetPng(pack.style, k, { type: 'art', glyph: motif }));
      }
      const sw = scriptableWidget(pack);
      wgf.file(sw.filename, sw.content);
      // Despia live-widget template — upload to packs/<slug>/widget-template.svg
      wgf.file(
        'widget-template.svg',
        despiaWidgetSvg(pack.style, { type: 'date', glyph: motif, sample: false })
      );
    }
    if (extras.mockup) {
      setBusy('Rendering home-screen preview…');
      const wall = { c1: shade(pack.style.c1, -0.2), c2: shade(pack.style.c2 ?? pack.style.c1, -0.55) };
      root.file('preview-homescreen.png', await renderMockupPng(pack, wall, { labels: true }));
    }
    if (extras.cover) {
      setBusy('Rendering cover…');
      root.file('cover.png', await renderCoverPng(pack));
    }
    if (extras.lovable) {
      // CrestWall/Lovable admin bundle: app_key-named PNGs in light/dark/mono
      // folders, 512px masters + 180px profile embeds — matches rev. 3's
      // uploader ("folder of PNGs named instagram.png") and needs no
      // server-side resizing.
      const appKey = (l) => l.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const styleSets = [
        ['light', (s) => s, (i) => i],
        ['dark', darkStyle, darkIcon],
        ['mono', monoStyle, monoIcon],
      ];
      const lf = root.folder('lovable-bundle');
      let ldone = 0;
      const ltotal = pack.icons.length * styleSets.length * 2;
      for (const [styleKey, fs, fi] of styleSets) {
        const style = fs(pack.style);
        const f512 = lf.folder(styleKey);
        const f180 = lf.folder(`${styleKey}-180`);
        for (const ic of pack.icons) {
          setBusy(`Lovable bundle ${++ldone}/${ltotal}…`);
          f512.file(`${appKey(ic.label)}.png`, await renderIconPng(fi(ic), style, 512));
          ldone++;
          f180.file(`${appKey(ic.label)}.png`, await renderIconPng(fi(ic), style, 180));
        }
      }
      // widgets travel INSIDE the bundle so one folder-drag carries everything
      // the admin importer needs (.scriptable deliberately excluded — it's a
      // Gumroad artifact, not a CrestWall asset)
      const bundleMotif = pack.icons.find((i) => !i.image)?.glyph;
      const wgb = lf.folder('widgets');
      for (const k of Object.keys(WIDGET_SIZES)) {
        setBusy(`Lovable bundle widget: ${k}…`);
        wgb.file(`widget-${k}.png`, await renderWidgetPng(pack.style, k, { type: 'art', glyph: bundleMotif }));
      }
      wgb.file(
        'widget-template.svg',
        despiaWidgetSvg(pack.style, { type: 'date', glyph: bundleMotif, sample: false })
      );
      lf.file(
        'pack.json',
        JSON.stringify(
          {
            slug: sanitize(pack.name).toLowerCase(),
            name: pack.name,
            icon_count: pack.icons.length,
            items: pack.icons.map((ic, i) => ({ app_key: appKey(ic.label), default_label: ic.label, sort_order: i })),
            widgets: Object.keys(WIDGET_SIZES).map((k) => `widgets/widget-${k}.png`),
            widget_template: 'widgets/widget-template.svg',
          },
          null,
          2
        )
      );
    }
    if (extras.profile) {
      setBusy('Building install profile…');
      const { xml, included, skipped } = await buildMobileConfig(pack, { coexist: extras.coexist });
      root.file(`${sanitize(pack.name)}.mobileconfig`, xml);
      // 180px set so the CrestWall Edge Function can embed icons without
      // doing any server-side image processing (see supabase/functions/).
      const pf = root.folder('icons-profile');
      for (const ic of pack.icons) {
        pf.file(`${sanitize(ic.label)}.png`, await renderIconPng(ic, pack.style, 180));
      }
      setProfileReport({ included: included.length, skipped });
    }
    if (extras.readme) root.file('README.txt', readme(pack));
    if (extras.manifest) {
      // CrestWall ingestion manifest — see CRESTWALL_INTEGRATION.md
      const used = new Set();
      // trailing-slash-normalised CDN root, e.g. https://cdn.example.com/icon-packs/aurum-noir
      const root2 = baseUrl.trim().replace(/\/+$/, '');
      const iconDir = chosen.length > 1 ? `icons-${Math.max(...chosen)}` : 'icons';
      const items = pack.icons.map((ic, i) => {
        let name = sanitize(ic.label);
        while (used.has(name)) name += '-2';
        used.add(name);
        const slug = name.toLowerCase();
        return {
          label: ic.label,
          slug,
          file: `${name}.png`,
          sort: i,
          // absolute URL lets the Shortcuts installer fetch icons directly
          ...(root2 ? { url: `${root2}/${iconDir}/${name}.png` } : {}),
        };
      });
      root.file(
        'manifest.json',
        JSON.stringify(
          {
            format: 'crestwall-iconpack/1',
            name: pack.name,
            slug: sanitize(pack.name).toLowerCase(),
            ...(baseUrl.trim() ? { baseUrl: baseUrl.trim().replace(/\/+$/, '') } : {}),
            iconCount: pack.icons.length,
            palette: { c1: pack.style.c1, c2: pack.style.c2, glyph: pack.style.glyphColor },
            // actual folder names, mirroring the render loop above
            sets: modes.flatMap(([suffix]) =>
              chosen.map((size) => `${chosen.length > 1 ? `icons-${size}` : 'icons'}${suffix}`)
            ),
            sizes: chosen,
            icons: items,
            wallpapers: extras.wallpapers ? WALLPAPER_VARIANTS.map((v) => `Wallpaper-${v}.png`) : [],
          },
          null,
          2
        )
      );
    }
    setBusy('Zipping…');
    const blob = await zip.generateAsync({ type: 'blob' });
    download(blob, `${sanitize(pack.name)}.zip`);
    setBusy('');
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
    download(blob, `${sanitize(pack.name)}.iconpack.json`);
  };

  const importJson = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data.icons || !data.style) throw new Error('not a pack file');
      setPack(data);
    } catch {
      alert('That file is not a valid .iconpack.json export.');
    }
    e.target.value = '';
  };

  return (
    <div className="content">
      <div className="export-card">
        <h2>Export “{pack.name}”</h2>
        <p className="note">{pack.icons.length} icons will be rendered as square PNGs (iOS rounds the corners itself).</p>

        <h3>Sizes</h3>
        <div className="checks">
          {Object.keys(sizes).map((k) => (
            <label key={k}>
              <input type="checkbox" checked={sizes[k]} onChange={() => toggle(sizes, setSizes, k)} /> {k}px
              {k === '1024' ? ' (standard)' : ''}
            </label>
          ))}
        </div>

        <h3>Appearance variants</h3>
        <div className="checks">
          <label>
            <input type="checkbox" checked={variants.dark} onChange={() => toggle(variants, setVariants, 'dark')} /> Dark mode set
          </label>
          <label>
            <input type="checkbox" checked={variants.mono} onChange={() => toggle(variants, setVariants, 'mono')} /> Mono set (white on graphite)
          </label>
        </div>
        <p className="note">Matches Apple's Default / Dark / Mono icon rendering modes — a premium differentiator.</p>

        <h3>Extras</h3>
        <div className="checks">
          <label>
            <input type="checkbox" checked={extras.cover} onChange={() => toggle(extras, setExtras, 'cover')} /> Marketing cover
          </label>
          <label>
            <input type="checkbox" checked={extras.wallpapers} onChange={() => toggle(extras, setExtras, 'wallpapers')} /> 4K wallpapers (4)
          </label>
          <label>
            <input type="checkbox" checked={extras.widgets} onChange={() => toggle(extras, setExtras, 'widgets')} /> Widgets (3 + live)
          </label>
          <label>
            <input type="checkbox" checked={extras.mockup} onChange={() => toggle(extras, setExtras, 'mockup')} /> Home-screen preview
          </label>
          <label>
            <input type="checkbox" checked={extras.readme} onChange={() => toggle(extras, setExtras, 'readme')} /> Install guide
          </label>
          <label>
            <input type="checkbox" checked={extras.manifest} onChange={() => toggle(extras, setExtras, 'manifest')} /> CrestWall manifest
          </label>
          <label>
            <input type="checkbox" checked={extras.profile} onChange={() => toggle(extras, setExtras, 'profile')} /> Install profile (.mobileconfig)
          </label>
          <label>
            <input type="checkbox" checked={extras.lovable} onChange={() => toggle(extras, setExtras, 'lovable')} /> Lovable bundle (CrestWall admin)
          </label>
        </div>
        {extras.profile && (
          <>
            <p className="note">
              One-tap web-clip installer. Only apps with a known URL scheme are included —
              Safari, Camera and Calculator have none and stay manual. Unsigned profiles show
              a red “Not Verified”.
            </p>
            <div className="checks">
              <label>
                <input
                  type="checkbox"
                  checked={!!extras.coexist}
                  onChange={() => toggle(extras, setExtras, 'coexist')}
                />{' '}
                Install alongside other packs (add-on pack)
              </label>
            </div>
            <p className="note">
              {extras.coexist
                ? 'This pack gets its own profile — icons stack with any theme already installed. Use only for genuine add-ons.'
                : 'Default: installing this pack replaces any previously installed CrestWall theme, and re-skins icons in place.'}
            </p>
          </>
        )}
        {profileReport && (
          <p className="note">
            Profile: {profileReport.included} icons included
            {profileReport.skipped.length > 0 &&
              `, ${profileReport.skipped.length} skipped (no URL scheme): ${profileReport.skipped.slice(0, 6).join(', ')}${profileReport.skipped.length > 6 ? '…' : ''}`}
          </p>
        )}
        {extras.manifest && (
          <>
            <div className="field" style={{ marginTop: 10 }}>
              <label>CDN base URL</label>
              <input
                type="text"
                placeholder="https://cdn.example.com/icon-packs/my-pack"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                style={{ maxWidth: 300, width: 300 }}
              />
            </div>
            <p className="note">
              Optional. Where this pack's folder will live once uploaded. Fills each manifest entry
              with an absolute <code>url</code> so a Shortcuts installer can fetch icons directly.
            </p>
          </>
        )}

        <button className="btn primary" disabled={!!busy || pack.icons.length === 0} onClick={exportZip}>
          {busy || 'Download ZIP'}
        </button>

        <h3>Project backup</h3>
        <p className="note">Save the editable project (styles, glyphs, images) to re-open or share later.</p>
        <button className="btn" onClick={exportJson}>Export project file</button>
        <input ref={importRef} type="file" accept=".json,application/json" hidden onChange={importJson} />
        <button className="btn" onClick={() => importRef.current?.click()}>Import project file…</button>
      </div>
    </div>
  );
}
