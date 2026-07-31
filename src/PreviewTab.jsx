import React, { useState } from 'react';
import { IconTile } from './App.jsx';
import { renderMockupPng, downloadBlob, shade } from './svg.js';

const WALLPAPERS = [
  ['Slate', '#1e293b', '#0f172a'],
  ['Dawn', '#fca5a5', '#818cf8'],
  ['Meadow', '#065f46', '#10b981'],
  ['Dune', '#d6c7a1', '#8a6d3b'],
  ['Ink', '#18181b', '#3f3f46'],
  ['Blossom', '#fbcfe8', '#f9a8d4'],
];

const sanitize = (s) => s.replace(/[^\w\- ]/g, '').trim().replace(/\s+/g, '-') || 'pack';

export default function PreviewTab({ pack }) {
  // null = "match pack colors"
  const [wallIdx, setWallIdx] = useState(null);
  const [labels, setLabels] = useState(true);
  const [busy, setBusy] = useState(false);
  const gridIcons = pack.icons.slice(0, 24);
  const dockIcons = pack.icons.slice(0, 4);

  const wall =
    wallIdx == null
      ? { c1: shade(pack.style.c1, -0.2), c2: shade(pack.style.c2 ?? pack.style.c1, -0.55) }
      : { c1: WALLPAPERS[wallIdx][1], c2: WALLPAPERS[wallIdx][2] };
  const wallCss = `linear-gradient(160deg, ${wall.c1}, ${wall.c2})`;

  const dlMockup = async () => {
    setBusy(true);
    try {
      const png = await renderMockupPng(pack, wall, { labels });
      downloadBlob(png, `${sanitize(pack.name)}-mockup-1290x2796.png`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="main">
      <div className="sidebar">
        <h3>Wallpaper</h3>
        <div className="presets">
          <button
            title="Match pack colors"
            style={{ background: `linear-gradient(160deg, ${shade(pack.style.c1, -0.2)}, ${shade(pack.style.c2 ?? pack.style.c1, -0.55)})` }}
            onClick={() => setWallIdx(null)}
          >
            <span>Pack</span>
          </button>
          {WALLPAPERS.map(([name, c1, c2], i) => (
            <button
              key={name}
              title={name}
              style={{ background: `linear-gradient(160deg, ${c1}, ${c2})` }}
              onClick={() => setWallIdx(i)}
            >
              <span>{name}</span>
            </button>
          ))}
        </div>
        <h3>Options</h3>
        <div className="field">
          <label>App labels</label>
          <input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} />
        </div>
        <h3>Marketing shot</h3>
        <button className="btn primary" disabled={busy} onClick={dlMockup}>
          {busy ? 'Rendering…' : 'Download mockup PNG'}
        </button>
        <p className="note">
          1290×2796 home-screen render (App Store portrait size) with the selected wallpaper —
          drop it straight into a Gumroad listing or CrestWall screenshot.
        </p>
      </div>
      <div className="content">
        <div className="phone-wrap">
          <div className="phone">
            <div className="notch" />
            <div className="screen" style={{ background: wallCss }}>
              <div className="grid">
                {gridIcons.map((ic) => (
                  <div className="app" key={ic.id}>
                    <IconTile icon={ic} style={pack.style} tag="ph" />
                    {labels && <div className="lbl">{ic.label}</div>}
                  </div>
                ))}
              </div>
              <div className="dock">
                {dockIcons.map((ic) => (
                  <IconTile key={ic.id} icon={ic} style={pack.style} tag="dock" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
