import React, { useEffect, useMemo, useState } from 'react';
import { downloadBlob } from './svg.js';
import {
  WALLPAPER_SIZES, WALLPAPER_STYLES, WALLPAPER_PALETTES,
  wallpaperArt, renderWallpaperArtPng,
} from './wallpapers.js';
import {
  ASPECTS, WALLPAPER_PRESETS, generateWallpapers, loadGallery, saveGallery,
} from './aiWallpapers.js';
import { composeDepth, depthAdvice, CLOCK_BAND } from './depth.js';
import { normalizeImage } from './svg.js';

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
  const [prompt, setPrompt] = useState(
    'A breathtaking 4K phone wallpaper: a lone mountain range under drifting clouds, cinematic light, ultra high detail, vertical composition, no text, no logos, no watermark'
  );
  const [presetName, setPresetName] = useState('');
  const [aspect, setAspect] = useState('Portrait');
  const [count, setCount] = useState(2);
  const [aiStatus, setAiStatus] = useState('');
  const [gallery, setGallery] = useState([]);
  const [refs, setRefs] = useState([]); // reference image dataURLs (max 4)
  const refsInput = React.useRef(null);
  const onRefs = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    const added = [];
    for (const f of files.slice(0, 4 - refs.length)) added.push(await normalizeImage(f, 1536));
    setRefs((r) => [...r, ...added].slice(0, 4));
  };

  useEffect(() => {
    loadGallery().then(setGallery);
  }, []);

  // ---- depth mode state --------------------------------------------------
  const [subject, setSubject] = useState(null);   // dataURL cut-out
  const [subjPos, setSubjPos] = useState({ x: 0.5, y: 0.45, scale: 0.85 });
  const [bgSource, setBgSource] = useState('art'); // 'art' | 'gallery'
  const [bgStyle, setBgStyle] = useState('Mesh');
  const [bgImage, setBgImage] = useState(null);
  const [depthBusy, setDepthBusy] = useState('');
  const subjRef = React.useRef(null);

  const advice = depthAdvice(subject ? { ...subjPos, url: subject } : null);

  const onSubject = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setSubject(await normalizeImage(f, 2048));
  };

  const exportDepth = async () => {
    setDepthBusy('Composing…');
    try {
      const blob = await composeDepth({
        background: bgSource === 'gallery' && bgImage
          ? { kind: 'image', url: bgImage }
          : { kind: 'art', p, style: bgStyle },
        subject: subject ? { url: subject, ...subjPos } : null,
        W, H,
      });
      downloadBlob(blob, `${sanitize(name)}-Depth-${W}x${H}.png`);
    } finally {
      setDepthBusy('');
    }
  };


  const run = async () => {
    setAiStatus('Starting…');
    const added = [];
    try {
      await generateWallpapers({
        prompt,
        aspect,
        count,
        refs,
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
          {[['design', 'Design'], ['ai', 'AI Studio'], ['depth', 'Depth']].map(([m, label]) => (
            <button key={m} className={mode === m ? 'active' : ''} onClick={() => setMode(m)}>
              {label}
            </button>
          ))}
        </div>

        <div className="field">
          <label>Set name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        {mode === 'depth' ? (
          <>
            <h3>Subject</h3>
            <input ref={subjRef} type="file" accept="image/png,image/*" hidden onChange={onSubject} />
            <button className="btn" onClick={() => subjRef.current?.click()}>
              {subject ? 'Replace cut-out…' : 'Upload subject cut-out…'}
            </button>
            <p className="note">
              A PNG with a transparent background works best — a person, animal or object with
              clean edges. Flat abstract art will not segment.
            </p>
            {subject && (
              <>
                <div className="field">
                  <label>Size {Math.round(subjPos.scale * 100)}%</label>
                  <input type="range" min="0.3" max="1.3" step="0.02" value={subjPos.scale}
                    onChange={(e) => setSubjPos({ ...subjPos, scale: +e.target.value })} />
                </div>
                <div className="field">
                  <label>Vertical {Math.round(subjPos.y * 100)}%</label>
                  <input type="range" min="0.1" max="0.9" step="0.01" value={subjPos.y}
                    onChange={(e) => setSubjPos({ ...subjPos, y: +e.target.value })} />
                </div>
                <div className="field">
                  <label>Horizontal {Math.round(subjPos.x * 100)}%</label>
                  <input type="range" min="0.1" max="0.9" step="0.01" value={subjPos.x}
                    onChange={(e) => setSubjPos({ ...subjPos, x: +e.target.value })} />
                </div>
                <button className="btn small danger" onClick={() => setSubject(null)}>Remove subject</button>
              </>
            )}
            <h3>Background</h3>
            <div className="seg">
              {[['art', 'Generated'], ['gallery', 'From gallery']].map(([k, l]) => (
                <button key={k} className={bgSource === k ? 'active' : ''} onClick={() => setBgSource(k)}>{l}</button>
              ))}
            </div>
            {bgSource === 'art' ? (
              <div className="field" style={{ marginTop: 8 }}>
                <label>Style</label>
                <select value={bgStyle} onChange={(e) => setBgStyle(e.target.value)}>
                  {WALLPAPER_STYLES.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </div>
            ) : gallery.length ? (
              <div className="wp-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 8 }}>
                {gallery.slice(0, 9).map((g) => (
                  <img key={g.id} src={g.url} alt="" onClick={() => setBgImage(g.url)}
                    style={{ width: '100%', borderRadius: 6, cursor: 'pointer', display: 'block',
                      outline: bgImage === g.url ? '2px solid var(--accent)' : 'none' }} />
                ))}
              </div>
            ) : (
              <p className="note">Generate wallpapers in AI Studio first.</p>
            )}
            <div className="field" style={{ marginTop: 10 }}>
              <label>Size</label>
              <select value={sizeKey} onChange={(e) => setSizeKey(e.target.value)}>
                {Object.entries(WALLPAPER_SIZES).map(([k, [w, h]]) => (
                  <option key={k} value={k}>{k} · {w}×{h}</option>
                ))}
              </select>
            </div>
            <h3>Export</h3>
            <button className="btn primary" disabled={!!depthBusy || !subject} onClick={exportDepth}>
              {depthBusy || 'Download depth wallpaper'}
            </button>
            <p className={advice.ok ? (advice.warn ? 'warn' : 'note') : 'warn'}>{advice.msg}</p>
          </>
        ) : mode === 'design' ? (
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
            <h3>Prompt</h3>
            <textarea
              className="prompt"
              style={{ minHeight: 150 }}
              value={prompt}
              placeholder="describe anything — this is sent to the model verbatim"
              onChange={(e) => { setPrompt(e.target.value); setPresetName(''); }}
            />
            <p className="note">
              Free-form: any subject, any style, any wording. The starting points below just fill
              this box — edit or replace it however you like.
            </p>
            <h3>Reference images</h3>
            <input ref={refsInput} type="file" accept="image/*" multiple hidden onChange={onRefs} />
            <button className="btn" disabled={refs.length >= 4} onClick={() => refsInput.current?.click()}>
              {refs.length ? `Add more (${refs.length}/4)` : 'Upload references…'}
            </button>
            {refs.length > 0 && (
              <div className="ref-strip">
                {refs.map((r, i) => (
                  <div key={i} className="ref-thumb">
                    <img src={r} alt="" />
                    <button onClick={() => setRefs(refs.filter((_, j) => j !== i))}>×</button>
                  </div>
                ))}
              </div>
            )}
            <p className="note">
              Optional — the model uses them for style, palette or composition (reverse-engineering
              a look). With references, generation goes through the images/edits endpoint.
            </p>
            <h3>Starting points</h3>
            <div className="preset-list">
              {WALLPAPER_PRESETS.map((q) => (
                <button
                  key={q.name}
                  className={presetName === q.name ? 'active' : ''}
                  onClick={() => {
                    setPresetName(q.name);
                    setPrompt(q.prompt.replace('{subject}', 'SUBJECT'));
                  }}
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
          {mode === 'depth' ? (
            <>
              <h2>Depth effect</h2>
              <p className="note">
                iOS lifts a photo's subject in front of the Lock Screen clock. It performs the
                segmentation itself — our job is composition: the subject must <em>cross</em> the
                guide band without blanketing it.
              </p>
              <div className="depth-stage">
                <div className="depth-phone">
                  <div
                    className="depth-bg"
                    dangerouslySetInnerHTML={
                      bgSource === 'gallery' && bgImage
                        ? { __html: `<img src="${bgImage}" alt=""/>` }
                        : { __html: wallpaperArt(p, bgStyle, 360, 640, 'depth-pv') }
                    }
                  />
                  <div
                    className="depth-band"
                    style={{ top: `${CLOCK_BAND.top * 100}%`, height: `${(CLOCK_BAND.bottom - CLOCK_BAND.top) * 100}%` }}
                  >
                    <span>clock band — subject must cross this</span>
                  </div>
                  <div className="depth-clock">9:41</div>
                  {subject && (
                    <img
                      className="depth-subject"
                      src={subject}
                      alt=""
                      style={{
                        left: `${subjPos.x * 100}%`,
                        top: `${subjPos.y * 100}%`,
                        width: `${subjPos.scale * 100}%`,
                      }}
                    />
                  )}
                </div>
              </div>
              <p className="note">
                The clock is drawn <em>behind</em> the subject here to mirror what iOS does. Export
                is a flat PNG — iOS re-derives the lift when the wallpaper is set.
              </p>
            </>
          ) : mode === 'design' ? (
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
                Write any prompt you like — the starting points on the left are optional. Results are
                kept here between sessions; download the ones worth keeping.
              </p>
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
