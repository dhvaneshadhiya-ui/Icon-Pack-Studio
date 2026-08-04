import React, { useMemo, useRef, useState } from 'react';
import { icons } from 'lucide';
import { APP_CATALOG, BRANDS, BRAND_NAMES, GLYPH_NAMES, APP_GLYPH_NAMES, STYLE_PRESETS, isBrand, isAppGlyph, appGlyphOf, isTrademarkGlyph, genericGlyphFor, auditTrademarks, makeIcon, defaultPack, blankPack } from './model.js';
import { normalizeImage, shade, pickText } from './svg.js';
import { IconTile } from './App.jsx';

function GlyphButton({ name, active, onClick }) {
  const svg = useMemo(() => {
    if (isBrand(name)) {
      const b = BRANDS[name.slice(3)];
      return b ? `<svg viewBox="0 0 24 24"><path d="${b.path}" fill="currentColor"/></svg>` : '';
    }
    if (isAppGlyph(name)) {
      const g = appGlyphOf(name);
      return g
        ? `<svg viewBox="0 0 48 48" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${g.body}</svg>`
        : '';
    }
    const node = icons[name];
    if (!node) return '';
    const inner = node
      .map(([tag, attrs]) => {
        const a = Object.entries(attrs)
          .filter(([k]) => k !== 'key')
          .map(([k, v]) => `${k}="${v}"`)
          .join(' ');
        return `<${tag} ${a}/>`;
      })
      .join('');
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  }, [name]);
  return (
    <button
      className={active ? 'active' : ''}
      title={
        isBrand(name)
          ? `${BRANDS[name.slice(3)]?.title} (brand)`
          : isAppGlyph(name)
            ? `${appGlyphOf(name)?.title} (app glyph)`
            : name
      }
      onClick={onClick}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export default function DesignTab({ pack, setPack, updateStyle, updateIcon }) {
  const [selectedId, setSelectedId] = useState(pack.icons[0]?.id ?? null);
  const [glyphQuery, setGlyphQuery] = useState('');
  const [catalogQuery, setCatalogQuery] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [sheetCols, setSheetCols] = useState(4);
  const [sheetRows, setSheetRows] = useState(4);
  const fileRef = useRef(null);
  const sheetRef = useRef(null);
  const s = pack.style;
  const selected = pack.icons.find((i) => i.id === selectedId) || null;

  const audit = useMemo(() => auditTrademarks(pack), [pack]);

  const glyphMatches = useMemo(() => {
    const q = glyphQuery.trim().toLowerCase();
    if (!q) return GLYPH_NAMES.slice(0, 96);
    const appGlyphs = APP_GLYPH_NAMES.filter((s) => s.includes(q)).map((s) => `ag:${s}`);
    const brands = BRAND_NAMES.filter(
      (s) => s.includes(q) || BRANDS[s].title.toLowerCase().includes(q)
    ).map((s) => `si:${s}`);
    const lucide = GLYPH_NAMES.filter((n) => n.toLowerCase().includes(q));
    return [...appGlyphs, ...brands, ...lucide].slice(0, 96);
  }, [glyphQuery]);

  const addIcon = (label, glyph = 'Circle', fallback) => {
    const ic = makeIcon(label, glyph, fallback);
    setPack((p) => ({ ...p, icons: [...p.icons, ic] }));
    setSelectedId(ic.id);
  };

  const catalogMatches = useMemo(() => {
    const q = catalogQuery.trim().toLowerCase();
    if (!q) return [];
    const inPack = new Set(pack.icons.map((i) => i.label));
    return APP_CATALOG.flatMap(({ cat, apps }) =>
      apps
        .filter(([l]) => l.toLowerCase().includes(q) && !inPack.has(l))
        .map(([l, g, f]) => ({ cat, label: l, glyph: g, fb: f }))
    ).slice(0, 10);
  }, [catalogQuery, pack.icons]);

  const removeIcon = (id) => {
    setPack((p) => ({ ...p, icons: p.icons.filter((i) => i.id !== id) }));
    if (selectedId === id) setSelectedId(null);
  };

  // Slice an N×M contact sheet into tiles and assign them to icons in order.
  const onSheetUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
    const cw = img.width / sheetCols;
    const ch = img.height / sheetRows;
    const inset = Math.min(cw, ch) * 0.015; // skip divider lines between cells
    const tiles = [];
    for (let r = 0; r < sheetRows; r++) {
      for (let c = 0; c < sheetCols; c++) {
        const canvas = document.createElement('canvas');
        const out = 768;
        canvas.width = out;
        canvas.height = out;
        canvas.getContext('2d').drawImage(
          img,
          c * cw + inset, r * ch + inset, cw - 2 * inset, ch - 2 * inset,
          0, 0, out, out
        );
        tiles.push(canvas.toDataURL('image/webp', 0.9));
      }
    }
    URL.revokeObjectURL(img.src);
    setPack((p) => ({
      ...p,
      icons: p.icons.map((ic, i) =>
        i < tiles.length ? { ...ic, image: tiles[i], imageMode: 'cover' } : ic
      ),
    }));
    const applied = Math.min(tiles.length, pack.icons.length);
    if (tiles.length > pack.icons.length) {
      alert(`Applied ${applied} tiles to your ${pack.icons.length} icons (sheet had ${tiles.length}). Add more icons and re-import to use the rest.`);
    }
  };

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selected) return;
    const dataUrl = await normalizeImage(file);
    updateIcon(selected.id, { image: dataUrl });
    e.target.value = '';
  };

  const ovEnabled = selected && selected.ov?.c1 != null;

  return (
    <div className="main">
      <div className="sidebar">
        <h3>Style presets</h3>
        <div className="presets">
          {STYLE_PRESETS.map((p) => (
            <button
              key={p.name}
              title={p.name}
              style={{
                background:
                  p.bgType === 'solid'
                    ? p.c1
                    : `linear-gradient(${p.angle || 135}deg, ${p.c1}, ${p.c2})`,
              }}
              onClick={() =>
                updateStyle({ bgType: p.bgType, c1: p.c1, c2: p.c2, angle: p.angle, glyphColor: p.glyphColor })
              }
            >
              <span>{p.name}</span>
            </button>
          ))}
        </div>

        <h3>Background</h3>
        <div className="seg" style={{ marginBottom: 8 }}>
          {['solid', 'linear', 'radial'].map((t) => (
            <button key={t} className={s.bgType === t ? 'active' : ''} onClick={() => updateStyle({ bgType: t })}>
              {t}
            </button>
          ))}
        </div>
        <div className="field">
          <label>{s.bgType === 'solid' ? 'Color' : 'Color A'}</label>
          <input type="color" value={s.c1} onChange={(e) => updateStyle({ c1: e.target.value })} />
        </div>
        {s.bgType !== 'solid' && (
          <div className="field">
            <label>Color B</label>
            <input type="color" value={s.c2} onChange={(e) => updateStyle({ c2: e.target.value })} />
          </div>
        )}
        {s.bgType === 'linear' && (
          <div className="field">
            <label>Angle {s.angle}°</label>
            <input type="range" min="0" max="360" value={s.angle} onChange={(e) => updateStyle({ angle: +e.target.value })} />
          </div>
        )}
        <div className="field">
          <label>Pattern</label>
          <select value={s.pattern || 'none'} onChange={(e) => updateStyle({ pattern: e.target.value })}>
            {['none', 'dots', 'stripes', 'grid'].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <h3>Glyph</h3>
        <div className="field">
          <label>Color</label>
          <input type="color" value={s.glyphColor} onChange={(e) => updateStyle({ glyphColor: e.target.value })} />
        </div>
        <div className="field">
          <label>Size {Math.round(s.glyphScale * 100)}%</label>
          <input type="range" min="0.3" max="0.72" step="0.02" value={s.glyphScale} onChange={(e) => updateStyle({ glyphScale: +e.target.value })} />
        </div>
        <div className="field">
          <label>Weight {s.strokeWidth}</label>
          <input type="range" min="1" max="3" step="0.1" value={s.strokeWidth} onChange={(e) => updateStyle({ strokeWidth: +e.target.value })} />
        </div>

        <h3>Finish</h3>
        <div className="seg">
          {['none', 'gloss', 'vignette'].map((t) => (
            <button key={t} className={s.overlay === t ? 'active' : ''} onClick={() => updateStyle({ overlay: t })}>
              {t}
            </button>
          ))}
        </div>
        <div className="field" style={{ marginTop: 8 }}>
          <label>Grain texture</label>
          <input type="checkbox" checked={!!s.grain} onChange={(e) => updateStyle({ grain: e.target.checked })} />
        </div>
        <div className="field">
          <label>Inner ring</label>
          <input type="checkbox" checked={!!s.ring} onChange={(e) => updateStyle({ ring: e.target.checked })} />
        </div>
        <div className="field">
          <label>Glyph shadow</label>
          <input type="checkbox" checked={!!s.glyphShadow} onChange={(e) => updateStyle({ glyphShadow: e.target.checked })} />
        </div>

        <h3>Pack</h3>
        <div className="field">
          <input
            type="text"
            placeholder="New icon name…"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newLabel.trim()) {
                addIcon(newLabel.trim());
                setNewLabel('');
              }
            }}
          />
          <button
            className="btn small"
            style={{ marginTop: 0 }}
            disabled={!newLabel.trim()}
            onClick={() => {
              addIcon(newLabel.trim());
              setNewLabel('');
            }}
          >
            Add
          </button>
        </div>
        <input
          className="glyph-search"
          placeholder="Search catalog… (e.g. netflix)"
          value={catalogQuery}
          onChange={(e) => setCatalogQuery(e.target.value)}
        />
        {catalogMatches.length > 0 && (
          <div className="catalog-results">
            {catalogMatches.map(({ cat, label, glyph, fb }) => (
              <button
                key={label}
                onClick={() => {
                  addIcon(label, glyph, fb);
                  setCatalogQuery('');
                }}
              >
                {label} <span>{cat}</span>
              </button>
            ))}
          </div>
        )}
        {catalogQuery && catalogMatches.length === 0 && (
          <p className="note">No catalog match — type a name above and press Add to create it.</p>
        )}
        <select
          className="glyph-search"
          value=""
          onChange={(e) => {
            for (const { apps } of APP_CATALOG) {
              const preset = apps.find(([l]) => l === e.target.value);
              if (preset) {
                const ic = makeIcon(preset[0], preset[1], preset[2]);
                setPack((p) => ({ ...p, icons: [...p.icons, ic] }));
                setSelectedId(ic.id);
                return;
              }
            }
          }}
        >
          <option value="">Add app from catalog…</option>
          {APP_CATALOG.map(({ cat, apps }) => (
            <optgroup key={cat} label={cat}>
              {apps
                .filter(([l]) => !pack.icons.some((i) => i.label === l))
                .map(([l]) => (
                  <option key={l} value={l}>{l}</option>
                ))}
            </optgroup>
          ))}
        </select>
        <button
          className="btn"
          onClick={() => {
            const existing = new Set(pack.icons.map((i) => i.label));
            const missing = APP_CATALOG.flatMap(({ apps }) => apps).filter(([l]) => !existing.has(l));
            setPack((p) => ({ ...p, icons: [...p.icons, ...missing.map(([l, g, f]) => makeIcon(l, g, f))] }));
          }}
        >
          Add all {APP_CATALOG.reduce((n, c) => n + c.apps.length, 0)} catalog apps
        </button>
        <h3>Commercial safety</h3>
        {audit.swappable + audit.residual === 0 ? (
          <p className="note">✓ No trademarked marks — safe to sell.</p>
        ) : (
          <>
            <p className="warn">
              {audit.swappable + audit.residual} icons use brand marks. Fine for personal
              home screens; risky for Gumroad or an App Store build.
            </p>
            {audit.swappable > 0 && (
              <button
                className="btn"
                onClick={() =>
                  setPack((p) => ({
                    ...p,
                    icons: p.icons.map((ic) => {
                      if (ic.image || !isTrademarkGlyph(ic.glyph)) return ic;
                      const g = genericGlyphFor(ic.label);
                      return g ? { ...ic, glyph: g } : ic;
                    }),
                  }))
                }
              >
                Swap {audit.swappable} → generic glyphs
              </button>
            )}
            {audit.residual > 0 && (
              <p className="note">
                {audit.residual} have no generic alternative — replace by hand from the glyph
                search, or drop them from a commercial pack.
              </p>
            )}
          </>
        )}

        <h3>Contact sheet</h3>
        <div className="field">
          <label>Grid</label>
          <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="number" min="1" max="12" value={sheetCols} onChange={(e) => setSheetCols(+e.target.value || 1)} style={{ width: 52 }} />
            ×
            <input type="number" min="1" max="12" value={sheetRows} onChange={(e) => setSheetRows(+e.target.value || 1)} style={{ width: 52 }} />
          </span>
        </div>
        <input ref={sheetRef} type="file" accept="image/*" hidden onChange={onSheetUpload} />
        <button className="btn" onClick={() => sheetRef.current?.click()}>
          Import contact sheet…
        </button>
        <p className="note">
          Slices a grid image (e.g. an AI-generated 4×4 sheet) and assigns each tile to your icons
          in grid order. Tiles land as per-icon images.
        </p>
        <button
          className="btn"
          onClick={() => {
            if (confirm('Start a style-only project? Icons are cleared; the palette stays editable for wallpapers and widgets.')) {
              setPack((p) => ({ ...blankPack(), style: p.style }));
            }
          }}
        >
          Style-only project (no icons)
        </button>
        <p className="note">
          Wallpapers and widgets are generated from the palette alone — clear the icons to work on
          them without an icon pack.
        </p>
        <button
          className="btn danger"
          onClick={() => {
            if (confirm('Reset the whole pack to defaults? This discards all icons and styling.')) {
              setPack(defaultPack());
            }
          }}
        >
          Reset pack
        </button>
      </div>

      <div className="content">
        <div className="icon-grid">
          {pack.icons.map((ic) => (
            <div
              key={ic.id}
              className={`icon-cell ${ic.id === selectedId ? 'selected' : ''}`}
              onClick={() => setSelectedId(ic.id)}
            >
              <IconTile icon={ic} style={pack.style} tag="grid" />
              <div className="name">{ic.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rightbar">
        {!selected ? (
          <p className="note">Select an icon to edit it.</p>
        ) : (
          <>
            <h3>Icon</h3>
            <div className="field">
              <label>Name</label>
              <input type="text" value={selected.label} onChange={(e) => updateIcon(selected.id, { label: e.target.value })} />
            </div>

            <h3>Image</h3>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onUpload} />
            <button className="btn" onClick={() => fileRef.current?.click()}>
              {selected.image ? 'Replace image…' : 'Upload image…'}
            </button>
            {selected.image && (
              <>
                <div className="seg" style={{ margin: '8px 0' }}>
                  {['cover', 'contain'].map((m) => (
                    <button
                      key={m}
                      className={selected.imageMode === m ? 'active' : ''}
                      onClick={() => updateIcon(selected.id, { imageMode: m })}
                    >
                      {m === 'cover' ? 'Fill tile' : 'On background'}
                    </button>
                  ))}
                </div>
                <button className="btn danger" onClick={() => updateIcon(selected.id, { image: null })}>
                  Remove image (use glyph)
                </button>
              </>
            )}

            {!selected.image && (
              <>
                <h3>Glyph</h3>
                <input
                  className="glyph-search"
                  placeholder={`Search ${GLYPH_NAMES.length + BRAND_NAMES.length} glyphs & brands…`}
                  value={glyphQuery}
                  onChange={(e) => setGlyphQuery(e.target.value)}
                />
                <div className="glyph-list">
                  {glyphMatches.map((n) => (
                    <GlyphButton
                      key={n}
                      name={n}
                      active={selected.glyph === n}
                      onClick={() => updateIcon(selected.id, { glyph: n })}
                    />
                  ))}
                </div>
              </>
            )}

            <h3>Overrides</h3>
            <div className="field">
              <label>Size {Math.round((selected.ov.glyphScale ?? s.glyphScale) * 100)}%</label>
              <input
                type="range"
                min="0.3"
                max="0.72"
                step="0.02"
                value={selected.ov.glyphScale ?? s.glyphScale}
                onChange={(e) => updateIcon(selected.id, { ov: { ...selected.ov, glyphScale: +e.target.value } })}
              />
            </div>
            <div className="field">
              <label>Rotation {selected.ov.rotation ?? 0}°</label>
              <input
                type="range"
                min="-180"
                max="180"
                step="5"
                value={selected.ov.rotation ?? 0}
                onChange={(e) => {
                  const v = +e.target.value;
                  const { rotation, ...rest } = selected.ov;
                  updateIcon(selected.id, { ov: v === 0 ? rest : { ...rest, rotation: v } });
                }}
              />
            </div>
            {selected.ov.glyphScale != null && (
              <button
                className="btn small"
                onClick={() => {
                  const { glyphScale, ...rest } = selected.ov;
                  updateIcon(selected.id, { ov: rest });
                }}
              >
                Reset size to pack default
              </button>
            )}
            {isBrand(selected.glyph) && BRANDS[selected.glyph.slice(3)]?.hex && (
              <button
                className="btn"
                onClick={() => {
                  const hex = `#${BRANDS[selected.glyph.slice(3)].hex}`;
                  const dark = shade(hex, -0.35);
                  updateIcon(selected.id, { ov: { ...selected.ov, c1: hex, c2: dark, glyphColor: pickText(hex) } });
                }}
              >
                Use official brand colors
              </button>
            )}
            <div className="field">
              <label>Custom colors</label>
              <input
                type="checkbox"
                checked={ovEnabled}
                onChange={(e) => {
                  if (e.target.checked) {
                    updateIcon(selected.id, { ov: { ...selected.ov, c1: s.c1, c2: s.c2, glyphColor: s.glyphColor } });
                  } else {
                    const { c1, c2, glyphColor, ...rest } = selected.ov;
                    updateIcon(selected.id, { ov: rest });
                  }
                }}
              />
            </div>
            {ovEnabled && (
              <>
                <div className="field">
                  <label>Background A</label>
                  <input type="color" value={selected.ov.c1} onChange={(e) => updateIcon(selected.id, { ov: { ...selected.ov, c1: e.target.value } })} />
                </div>
                <div className="field">
                  <label>Background B</label>
                  <input type="color" value={selected.ov.c2} onChange={(e) => updateIcon(selected.id, { ov: { ...selected.ov, c2: e.target.value } })} />
                </div>
                <div className="field">
                  <label>Glyph</label>
                  <input type="color" value={selected.ov.glyphColor} onChange={(e) => updateIcon(selected.id, { ov: { ...selected.ov, glyphColor: e.target.value } })} />
                </div>
              </>
            )}

            <h3>Actions</h3>
            <button
              className="btn"
              onClick={() => {
                const copy = { ...selected, ...makeIcon(selected.label + ' copy', selected.glyph), image: selected.image, imageMode: selected.imageMode, ov: { ...selected.ov } };
                setPack((p) => ({ ...p, icons: [...p.icons, copy] }));
              }}
            >
              Duplicate
            </button>
            <button className="btn danger" onClick={() => removeIcon(selected.id)}>
              Delete icon
            </button>
          </>
        )}
      </div>
    </div>
  );
}
