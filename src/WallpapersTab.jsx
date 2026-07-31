import React, { useMemo, useState } from 'react';
import { WALLPAPER_VARIANTS, wallpaperSvg, renderWallpaperPng, downloadBlob } from './svg.js';

const sanitize = (s) => s.replace(/[^\w\- ]/g, '').trim().replace(/\s+/g, '-') || 'pack';

function WallpaperCard({ pack, variant }) {
  const [busy, setBusy] = useState(false);
  // small preview (270x480) with the same generator as the 4K export
  const svg = useMemo(
    () => wallpaperSvg(pack.style, variant, 270, 480, `prev-${variant}`),
    [pack.style, variant]
  );

  const dl = async () => {
    setBusy(true);
    try {
      const png = await renderWallpaperPng(pack.style, variant);
      downloadBlob(png, `${sanitize(pack.name)}-Wallpaper-${variant}.png`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wp-card">
      <div className="wp-preview" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="wp-row">
        <span>{variant}</span>
        <button className="btn small" disabled={busy} onClick={dl}>
          {busy ? 'Rendering…' : 'Download 4K'}
        </button>
      </div>
    </div>
  );
}

export default function WallpapersTab({ pack }) {
  return (
    <div className="content">
      <div className="wp-wrap">
        <div>
          <h2>Matching wallpapers</h2>
          <p className="note">
            Four 4K wallpapers (2160×3840) generated from “{pack.name}”'s palette — pair them with
            the icon pack in CrestWall or bundle them in the Gumroad ZIP (Export tab has a checkbox).
            Grain follows the pack's grain setting.
          </p>
        </div>
        <div className="wp-grid">
          {WALLPAPER_VARIANTS.map((v) => (
            <WallpaperCard key={v} pack={pack} variant={v} />
          ))}
        </div>
      </div>
    </div>
  );
}
