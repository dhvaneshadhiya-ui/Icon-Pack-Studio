import React, { useEffect, useMemo, useState } from 'react';
import { downloadBlob } from './svg.js';
import {
  WALLPAPER_SIZES, WALLPAPER_STYLES, WALLPAPER_PALETTES,
  wallpaperArt, renderWallpaperArtPng,
} from './wallpapers.js';
import {
  ASPECTS, WALLPAPER_PRESETS, generateWallpapers, loadGallery, saveGallery,
} from './aiWallpapers.js';

const sanitize = (s) => s.replace(/[^\w\- ]/g, '').trim().replace(/\s+/g, '-') || 'wallpaper';

export default function WallpapersTab({ pack }) {
  const [mode, setMode] = useState('design'); // 'design' | 'ai'

  // ---- design mode state -------------------------------------------------
  const [p, setP] = useState({
    c1: pack.style.c1,
    c2: pack.style.c2 ?? pack.style.c1,
    accent: pack.style.glyphColor,
    angle: pack.style.angle ?? 135,
    grain: !!pack.style.grain,
  });
  const [sizeKey, setSizeKey] = useState('iPhone 4K');
  const [name, setName] = useState(pack.name);
  const [busy, setBusy] = useState('');
  const set = (patch) => setP((prev) => ({ ...prev, ...patch }));
  const [W, H] = WALLPAPER_SIZES[sizeKey];

  const previews = useMemo(
    () => WALLPAPER_STYLES.map((s) => [s, wallpaperArt(p, s, 360, 640, `pv-${s}`)]),
    [p]
  );

  const dl = async (styleName) => {
    setBusy(styleName);
    try {
      downloadBlob(
        await renderWallpaperArtPng(p, styleName, sizeKey),
        `${sanitize(name)}-${styleName}-${W}x${H}.png`
      );
    } finally {
      setBusy('');
    }
  };
  const dlAll = async () => {
    for (const s of WALLPAPER_STYLES) {
      setBusy(s);
      downloadBlob(
        await renderWallpaperArtPng(p, s, sizeKey),
        `${sanitize(name)}-${s}-${W}x${H}.png`
      );
    }
    setBusy('');
  };

  // ---- AI mode state -----------------------------------------------------
  const [subject, setSubject] = useState('a lone mountain range under drifting clouds');
  const [preset, setPreset] = useState(WALLPAPER_PRESETS[0]);
  const [aspect, setAspect] = useState('Portrait');
  const [count, setCount] = useState(2);
  const [aiStatus, setAiStatus] = useState('');
  const [gallery, setGallery] = useState([]);

  useEffect(() => {
    loadGallery().then(setGallery);
  }, []);

  const finalPrompt = preset.prompt.replace('{subject}', subject || 'an abstract composition');

  const run = async () => {
    setAiStatus('Starting…');
    const added = [];
    try {
      await generateWallpapers({
        prompt: finalPrompt,
        aspect,
        count,
        onProgress: setAiStatus,
        onImage: (entry) => {
          added.push(entry);
          setGallery((g) => {
            const next = [entry, ...g];
            saveGallery(next);
            return next;
          });
        },
      });
      setAiStatus(`Done — ${added.length} added.`);
    } catch (e) {
      setAiStatus(e.message);
    }
  };

  const dlAi = async (entry) => {
    const blob = await (await fetch(entry.url)).blob();
    downloadBlob(blob, `${sanitize(name)}-AI-${entry.id.slice(0, 6)}.png`);
  };
  const removeAi = (id) => {
    setGallery((g) => {
      const next = g.filter((x) => x.id !== id);
      saveGallery(next);
      return next;
    });
  };

  return (
    <div className="main">
      <div className="sidebar">
        <div className="seg" style={{ marginBottom: 14 }}>
          {[['design', 'Design'], ['ai', 'AI Studio']].map(([m, label]) => (
            <button key={m} className={mode === m ? 'active' : ''} onClick={() => setMode(m)}>
              {label}
            </button>
          ))}
        </div>

        <div className="field">
          <label>Set name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        {mode === 'design' ? (
          <>
            <div className="field">
              <label>Size</label>
              <select value={sizeKey} onChange={(e) => setSizeKey(e.target.value)}>
                {Object.entries(WALLPAPER_SIZES).map(([k, [w, h]]) => (
                  <option key={k} value={k}>{k} · {w}×{h}</option>
                ))}
              </select>
            </div>

            <h3>Palette</h3>
            <div className="presets">
              {WALLPAPER_PALETTES.map((q) => (
                <button
                  key={q.name}
                  title={q.name}
                  style={{ background: `linear-gradient(140deg, ${q.c1}, ${q.c2})` }}
                  onClick={() => set({ c1: q.c1, c2: q.c2, accent: q.accent })}
                >
                  <span>{q.name}</span>
                </button>
              ))}
            </div>
            <div className="field" style={{ marginTop: 10 }}>
              <label>Base</label>
              <input type="color" value={p.c1} onChange={(e) => set({ c1: e.target.value })} />
            </div>
            <div className="field">
              <label>Deep</label>
              <input type="color" value={p.c2} onChange={(e) => set({ c2: e.target.value })} />
            </div>
            <div className="field">
              <label>Accent</label>
              <input type="color" value={p.accent} onChange={(e) => set({ accent: e.target.value })} />
            </div>
            <div className="field">
              <label>Angle {p.angle}°</label>
              <input type="range" min="0" max="360" value={p.angle} onChange={(e) => set({ angle: +e.target.value })} />
            </div>
            <div className="field">
              <label>Grain</label>
              <input type="checkbox" checked={p.grain} onChange={(e) => set({ grain: e.target.checked })} />
            </div>
            <button
              className="btn small"
              onClick={() => set({ c1: pack.style.c1, c2: pack.style.c2 ?? pack.style.c1, accent: pack.style.glyphColor })}
            >
              Match icon pack colors
            </button>

            <h3>Export</h3>
            <button className="btn primary" disabled={!!busy} onClick={dlAll}>
              {busy ? `Rendering ${busy}…` : `Download all ${WALLPAPER_STYLES.length}`}
            </button>
          </>
        ) : (
          <>
            <h3>Idea</h3>
            <textarea
              className="prompt"
              style={{ minHeight: 64 }}
              value={subject}
              placeholder="what the wallpaper shows…"
              onChange={(e) => setSubject(e.target.value)}
            />
            <h3>Style</h3>
            <div className="preset-list">
              {WALLPAPER_PRESETS.map((q) => (
                <button
                  key={q.name}
                  className={preset.name === q.name ? 'active' : ''}
                  onClick={() => setPreset(q)}
                >
                  {q.name} <span>{q.hint}</span>
                </button>
              ))}
            </div>
            <div className="field" style={{ marginTop: 10 }}>
              <label>Aspect</label>
              <select value={aspect} onChange={(e) => setAspect(e.target.value)}>
                {Object.entries(ASPECTS).map(([k, v]) => (
                  <option key={k} value={k}>{k} · {v}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Images</label>
              <select value={count} onChange={(e) => setCount(+e.target.value)}>
                {[1, 2, 4].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <button className="btn primary" disabled={/Generating|Starting/.test(aiStatus)} onClick={run}>
              {/Generating|Starting/.test(aiStatus) ? aiStatus : `Generate ${count}`}
            </button>
            {aiStatus && !/Generating|Starting/.test(aiStatus) && <p className="note">{aiStatus}</p>}
            <p className="note">
              Uses the endpoint, model and key from the AI Generate tab. ~$0.03–0.06 per image.
            </p>
          </>
        )}
      </div>

      <div className="content">
        <div className="wp-wrap">
          {mode === 'design' ? (
            <>
              <h2>Wallpapers</h2>
              <p className="note">
                Ten procedural styles at {W}×{H}, generated from the palette on the left —
                independent of any icon pack. Use “Match icon pack colors” for a set that pairs
                with a theme.
              </p>
              <div className="wp-grid">
                {previews.map(([s, svg]) => (
                  <div className="wp-card" key={s}>
                    <div className="wp-preview" dangerouslySetInnerHTML={{ __html: svg }} />
                    <div className="wp-row">
                      <span>{s}</span>
                      <button className="btn small" disabled={!!busy} onClick={() => dl(s)}>
                        {busy === s ? '…' : 'Download'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <h2>AI wallpaper studio</h2>
              <p className="note">
                Pick a style, describe the subject, generate a batch. Results are kept here between
                sessions — download the ones you like.
              </p>
              <details style={{ margin: '10px 0' }}>
                <summary className="note" style={{ cursor: 'pointer' }}>Show the full prompt being sent</summary>
                <p className="note" style={{ background: 'var(--panel)', padding: 10, borderRadius: 8 }}>{finalPrompt}</p>
              </details>
              {gallery.length === 0 ? (
                <p className="note">No wallpapers yet — generate a batch to fill the gallery.</p>
              ) : (
                <div className="wp-grid">
                  {gallery.map((g) => (
                    <div className="wp-card" key={g.id}>
                      <div className="wp-preview">
                        <img src={g.url} alt="" style={{ width: '100%', display: 'block' }} />
                      </div>
                      <div className="wp-row">
                        <span>{new Date(g.at).toLocaleDateString()}</span>
                        <span style={{ display: 'flex', gap: 6 }}>
                          <button className="btn small" onClick={() => dlAi(g)}>Save</button>
                          <button className="btn small danger" onClick={() => removeAi(g.id)}>×</button>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
