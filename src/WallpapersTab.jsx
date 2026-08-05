import React, { useEffect, useMemo, useState } from 'react';
import { downloadBlob } from './svg.js';
import {
  WALLPAPER_SIZES, WALLPAPER_STYLES, WALLPAPER_PALETTES,
  wallpaperArt, renderWallpaperArtPng,
} from './wallpapers.js';
import {
  ASPECTS, WALLPAPER_PRESETS, PARALLAX_SPEC, generateWallpapers, loadGallery, saveGallery,
} from './aiWallpapers.js';
import { composeDepth, CLOCK_BAND, DEPTH_PROMPT_TEMPLATE, DEPTH_SPEC } from './depth.js';
import { OUTPUT_SIZES, renderAtSize } from './upscale.js';
import { LIVE_EFFECTS, LIVE_DURATIONS, drawLiveFrame, recordLiveWallpaper } from './liveWallpaper.js';
import { VIDEO_SECONDS, VIDEO_COST_PER_SEC, generateVideo, smoothLoop } from './aiVideo.js';
import { normalizeImage } from './svg.js';
import { useRefTray } from './refTray.jsx';
import { loadAiCfg, isLocalEndpoint } from './aiConfig.js';

const sanitize = (s) => s.replace(/[^\w\- ]/g, '').trim().replace(/\s+/g, '-') || 'wallpaper';

export default function WallpapersTab({ pack, initialMode }) {
  const [mode, setMode] = useState(initialMode || 'design'); // 'design' | 'ai' | 'depth' | 'live'
  const tray = useRefTray();
  const refs = tray?.refs ?? [];

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
  const [outSize, setOutSize] = useState('iPhone 4K · 2160×3840');
  const refsInput = React.useRef(null);
  const onRefs = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    await tray.addFiles(files);
  };

  useEffect(() => {
    loadGallery().then(setGallery);
  }, []);

  const addToGallery = (entry) => {
    setGallery((g) => {
      const next = [entry, ...g];
      saveGallery(next);
      return next;
    });
  };

  // ---- depth mode state --------------------------------------------------
  const [depthPrompt, setDepthPrompt] = useState(DEPTH_PROMPT_TEMPLATE);
  const [depthStatus, setDepthStatus] = useState('');
  const [bgImage, setBgImage] = useState(null); // selected wallpaper shown in the preview
  const [subject, setSubject] = useState(null); // optional manual cut-out
  const [subjPos, setSubjPos] = useState({ x: 0.5, y: 0.45, scale: 0.85 });
  const [bgStyle, setBgStyle] = useState('Mesh');
  const [depthBusy, setDepthBusy] = useState('');
  const subjRef = React.useRef(null);

  const runDepth = async () => {
    setDepthStatus('Starting…');
    try {
      await generateWallpapers({
        prompt: depthPrompt,
        aspect: 'Portrait',
        count: 1,
        refs,
        onProgress: setDepthStatus,
        onImage: (entry) => {
          addToGallery({ ...entry, depth: true });
          setBgImage(entry.url); // straight into the clock-band preview
        },
      });
      setDepthStatus('Done — check the composition against the clock band.');
    } catch (e) {
      setDepthStatus(e.message);
    }
  };

  const saveDepth = async () => {
    if (!bgImage) return;
    setDepthBusy('Rendering…');
    try {
      const target = OUTPUT_SIZES[outSize];
      const blob = await renderAtSize(bgImage, target);
      const suffix = target ? `${target[0]}x${target[1]}` : 'orig';
      downloadBlob(blob, `${sanitize(name)}-Depth-${suffix}.png`);
    } finally {
      setDepthBusy('');
    }
  };

  // ---- live mode state ---------------------------------------------------
  const [liveSource, setLiveSource] = useState('still'); // 'still' | 'ai'
  const [videoPrompt, setVideoPrompt] = useState(
    'A cinematic live wallpaper: [SUBJECT] with gentle looping motion — slow drift, breathing light, subtle atmosphere. Single continuous shot, no cuts, no camera shake, vertical composition framed for a phone screen. The final frame closely matches the first for a seamless loop. No text, no logos, no watermark.'
  );
  const [videoSeconds, setVideoSeconds] = useState(4);
  const [videoUrl, setVideoUrl] = useState(null);
  const [videoStatus, setVideoStatus] = useState('');
  const [loopStatus, setLoopStatus] = useState('');
  const [liveSrc, setLiveSrc] = useState(null);
  const [liveEffect, setLiveEffect] = useState('Zoom in');
  const [liveSeconds, setLiveSeconds] = useState(5);
  const [liveStatus, setLiveStatus] = useState('');
  const liveInput = React.useRef(null);
  const liveCanvas = React.useRef(null);

  useEffect(() => {
    if (mode !== 'live' || liveSource !== 'still' || !liveSrc || !liveCanvas.current) return;
    const canvas = liveCanvas.current;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    let raf;
    img.onload = () => {
      const loop = (now) => {
        drawLiveFrame(ctx, img, liveEffect, (now / 1000 % liveSeconds) / liveSeconds, canvas.width, canvas.height);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    };
    img.src = liveSrc;
    return () => cancelAnimationFrame(raf);
  }, [mode, liveSource, liveSrc, liveEffect, liveSeconds]);

  const onLiveUpload = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setLiveSrc(await normalizeImage(f, 2048));
  };

  const runVideo = async () => {
    setVideoStatus('Starting…');
    try {
      const blob = await generateVideo({
        prompt: videoPrompt,
        seconds: videoSeconds,
        onProgress: setVideoStatus,
      });
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      setVideoUrl(URL.createObjectURL(blob));
      setVideoStatus('Done — preview on the right. Loop it or download as-is.');
    } catch (e) {
      setVideoStatus(e.message);
    }
  };

  const downloadVideo = async () => {
    const blob = await (await fetch(videoUrl)).blob();
    downloadBlob(blob, `${sanitize(name)}-Live-sora.mp4`);
  };

  const makeLoop = async () => {
    setLoopStatus('Preparing…');
    try {
      const { blob, ext } = await smoothLoop({ src: videoUrl, fade: 1, onProgress: setLoopStatus });
      downloadBlob(blob, `${sanitize(name)}-Live-loop.${ext}`);
      setLoopStatus(ext === 'mp4'
        ? 'Saved seamless loop MP4 — convert with intoLive on the phone.'
        : 'Saved WebM loop — convert to MP4 before intoLive.');
    } catch (e) {
      setLoopStatus(e.message);
    }
  };

  const recordLive = async () => {
    setLiveStatus('Preparing…');
    try {
      const { blob, ext } = await recordLiveWallpaper({
        imageUrl: liveSrc,
        effect: liveEffect,
        seconds: liveSeconds,
        onProgress: setLiveStatus,
      });
      downloadBlob(blob, `${sanitize(name)}-Live-${liveEffect.replace(/\s+/g, '')}.${ext}`);
      setLiveStatus(ext === 'mp4'
        ? 'Saved MP4 — AirDrop it to your phone and convert with intoLive.'
        : 'Saved WebM (this browser can\'t mux MP4) — convert to MP4 before intoLive.');
    } catch (e) {
      setLiveStatus(e.message);
    }
  };

  const onSubject = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setSubject(await normalizeImage(f, 2048));
  };

  const exportComposed = async () => {
    setDepthBusy('Composing…');
    try {
      const blob = await composeDepth({
        background: bgImage ? { kind: 'image', url: bgImage } : { kind: 'art', p, style: bgStyle },
        subject: subject ? { url: subject, ...subjPos } : null,
        W, H,
      });
      downloadBlob(blob, `${sanitize(name)}-Depth-composed-${W}x${H}.png`);
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
          addToGallery(entry);
        },
      });
      setAiStatus(`Done — ${added.length} added.`);
    } catch (e) {
      setAiStatus(e.message);
    }
  };

  const dlAi = async (entry) => {
    const target = OUTPUT_SIZES[outSize];
    const blob = await renderAtSize(entry.url, target);
    const suffix = target ? `${target[0]}x${target[1]}` : entry.id.slice(0, 6);
    downloadBlob(blob, `${sanitize(name)}-AI-${suffix}-${entry.id.slice(0, 4)}.png`);
  };
  const removeAi = (id) => {
    setGallery((g) => {
      const next = g.filter((x) => x.id !== id);
      saveGallery(next);
      return next;
    });
  };

  const sizeSelect = (
    <div className="field">
      <label>Save size</label>
      <select value={outSize} onChange={(e) => setOutSize(e.target.value)}>
        {Object.keys(OUTPUT_SIZES).map((k) => <option key={k} value={k}>{k}</option>)}
      </select>
    </div>
  );

  return (
    <div className="main">
      <div className="sidebar">
        <div className="seg" style={{ marginBottom: 14 }}>
          {[['design', 'Design'], ['ai', 'AI Studio'], ['depth', 'Depth'], ['live', 'Live']].map(([m, label]) => (
            <button key={m} className={mode === m ? 'active' : ''} onClick={() => setMode(m)}>
              {label}
            </button>
          ))}
        </div>

        <div className="field">
          <label>Set name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        {mode === 'live' ? (
          <>
            <div className="seg" style={{ marginBottom: 10 }}>
              {[['still', 'Animate a still'], ['ai', 'AI video (prompt)']].map(([k, l]) => (
                <button key={k} className={liveSource === k ? 'active' : ''} onClick={() => setLiveSource(k)}>{l}</button>
              ))}
            </div>
            {liveSource === 'ai' ? (
              <>
                <h3>Video prompt</h3>
                <textarea
                  className="prompt"
                  style={{ minHeight: 190 }}
                  value={videoPrompt}
                  onChange={(e) => setVideoPrompt(e.target.value)}
                />
                <p className="note">
                  Replace <code>[SUBJECT]</code>. Keep the loop language — motion that returns to
                  its start is what makes a usable live wallpaper.
                </p>
                <div className="field">
                  <label>Length</label>
                  <select value={videoSeconds} onChange={(e) => setVideoSeconds(+e.target.value)}>
                    {VIDEO_SECONDS.map((n) => (
                      <option key={n} value={n}>{n} s · ~${(n * VIDEO_COST_PER_SEC).toFixed(2)}</option>
                    ))}
                  </select>
                </div>
                <button className="btn primary" disabled={/Starting|Rendering|Downloading/.test(videoStatus)} onClick={runVideo}>
                  {/Starting|Rendering|Downloading/.test(videoStatus) ? videoStatus : `Generate ${videoSeconds}s video`}
                </button>
                {videoStatus && !/Starting|Rendering|Downloading/.test(videoStatus) && <p className="note">{videoStatus}</p>}
                {videoUrl && (
                  <>
                    <h3>Export</h3>
                    <button className="btn primary" disabled={/Preparing|Looping/.test(loopStatus)} onClick={makeLoop}>
                      {/Preparing|Looping/.test(loopStatus) ? loopStatus : 'Make seamless loop + download'}
                    </button>
                    <button className="btn" onClick={downloadVideo}>Download as generated</button>
                    {loopStatus && !/Preparing|Looping/.test(loopStatus) && <p className="note">{loopStatus}</p>}
                    <p className="note">
                      The loop pass crossfades the tail into the head (1 s), so the clip repeats
                      with no visible seam — worth it unless the raw clip already loops cleanly.
                    </p>
                  </>
                )}
                <p className="note">
                  Uses your saved key via /v1/videos (sora-2, 720×1280, $0.10/s). OpenAI retires
                  this API Sep 24, 2026 — the video model is editable in ⚙ Settings.
                </p>
              </>
            ) : (
            <>
            <h3>Source image</h3>
            <input ref={liveInput} type="file" accept="image/*" hidden onChange={onLiveUpload} />
            <button className="btn" onClick={() => liveInput.current?.click()}>
              {liveSrc ? 'Replace image…' : 'Upload a wallpaper…'}
            </button>
            {gallery.length > 0 && (
              <>
                <p className="note" style={{ marginTop: 8 }}>…or pick from the gallery:</p>
                <div className="wp-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                  {gallery.slice(0, 9).map((g) => (
                    <img key={g.id} src={g.url} alt="" onClick={() => setLiveSrc(g.url)}
                      style={{ width: '100%', borderRadius: 6, cursor: 'pointer', display: 'block',
                        outline: liveSrc === g.url ? '2px solid var(--accent)' : 'none' }} />
                  ))}
                </div>
              </>
            )}
            <h3>Motion</h3>
            <div className="field">
              <label>Effect</label>
              <select value={liveEffect} onChange={(e) => setLiveEffect(e.target.value)}>
                {Object.keys(LIVE_EFFECTS).map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <p className="note">{LIVE_EFFECTS[liveEffect]}</p>
            <div className="field">
              <label>Loop length</label>
              <select value={liveSeconds} onChange={(e) => setLiveSeconds(+e.target.value)}>
                {LIVE_DURATIONS.map((n) => <option key={n} value={n}>{n} s</option>)}
              </select>
            </div>
            <h3>Record</h3>
            <button className="btn primary" disabled={!liveSrc || /Recording|Preparing/.test(liveStatus)} onClick={recordLive}>
              {/Recording|Preparing/.test(liveStatus) ? liveStatus : `Record ${liveSeconds}s loop (1080×1920)`}
            </button>
            {liveStatus && !/Recording|Preparing/.test(liveStatus) && <p className="note">{liveStatus}</p>}
            <p className="note">
              Records the preview in real time to a seamless loop — the last frame matches the
              first. On the phone: intoLive (or any Live-Photo converter) → set as Lock Screen
              wallpaper. For real video footage, <code>tools/live-wallpaper.sh</code> still handles
              trimming and looping.
            </p>
            </>
            )}
          </>
        ) : mode === 'depth' ? (
          <>
            <h3>Depth prompt</h3>
            <textarea
              className="prompt"
              style={{ minHeight: 220 }}
              value={depthPrompt}
              onChange={(e) => setDepthPrompt(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button className="btn small" onClick={() => setDepthPrompt(DEPTH_PROMPT_TEMPLATE)}>
                House template
              </button>
              <button
                className="btn small"
                title="Append the compact depth spec to whatever is in the box"
                onClick={() => setDepthPrompt((t) => `${t.trim()} ${DEPTH_SPEC}`)}
              >
                + spec suffix
              </button>
            </div>
            <p className="note">
              Replace <code>[SUBJECT]</code> with your subject. References in the tray
              ({refs.length}/4) ride along. Generates a single flat image composed for the
              Depth Effect — iOS does the segmentation itself when the wallpaper is set.
            </p>
            <button className="btn primary" disabled={/Generating|Starting/.test(depthStatus)} onClick={runDepth}>
              {/Generating|Starting/.test(depthStatus) ? depthStatus : 'Generate depth wallpaper'}
            </button>
            {depthStatus && !/Generating|Starting/.test(depthStatus) && <p className="note">{depthStatus}</p>}

            <h3>Save</h3>
            {sizeSelect}
            <button className="btn primary" disabled={!bgImage || !!depthBusy} onClick={saveDepth}>
              {depthBusy || 'Save previewed wallpaper'}
            </button>
            {!bgImage && <p className="note">Generate above, or pick a wallpaper from the gallery strip.</p>}

            {gallery.length > 0 && (
              <>
                <h3>From gallery</h3>
                <div className="wp-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                  {gallery.slice(0, 9).map((g) => (
                    <img key={g.id} src={g.url} alt="" onClick={() => setBgImage(g.url)}
                      style={{ width: '100%', borderRadius: 6, cursor: 'pointer', display: 'block',
                        outline: bgImage === g.url ? '2px solid var(--accent)' : 'none' }} />
                  ))}
                </div>
              </>
            )}

            <details style={{ marginTop: 14 }}>
              <summary>Manual compose (optional)</summary>
              <p className="note">
                Only for assembling a cut-out over a background by hand — the AI prompt above is
                the production path.
              </p>
              <input ref={subjRef} type="file" accept="image/png,image/*" hidden onChange={onSubject} />
              <button className="btn" onClick={() => subjRef.current?.click()}>
                {subject ? 'Replace cut-out…' : 'Upload subject cut-out…'}
              </button>
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
                  <button className="btn" disabled={!!depthBusy} onClick={exportComposed}>
                    {depthBusy || 'Download composed PNG'}
                  </button>
                </>
              )}
            </details>
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
              style={{ minHeight: 170 }}
              value={prompt}
              placeholder="describe anything — this is sent to the model verbatim"
              onChange={(e) => { setPrompt(e.target.value); setPresetName(''); }}
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button
                className="btn small"
                title="Append the parallax composition spec (iOS Perspective Zoom): fg/bg separation + edge bleed"
                onClick={() => setPrompt((t) => `${t.trim()} ${PARALLAX_SPEC}`)}
              >
                + parallax spec
              </button>
              <button
                className="btn small"
                title="Append the depth-effect spec (subject's top edge crosses the clock area)"
                onClick={() => setPrompt((t) => `${t.trim()} ${DEPTH_SPEC}`)}
              >
                + depth spec
              </button>
            </div>
            <p className="note">
              Free-form: any subject, any style, any wording. The starting points below just fill
              this box — edit or replace it however you like. For parallax, save at a
              “Parallax” size (20% bleed for the tilt shift).
            </p>
            <h3>Reference images ({refs.length}/4)</h3>
            <input ref={refsInput} type="file" accept="image/*" multiple hidden onChange={onRefs} />
            <button className="btn" disabled={refs.length >= 4} onClick={() => refsInput.current?.click()}>
              {refs.length ? 'Add more…' : 'Upload references…'}
            </button>
            <p className="note">
              Or drag &amp; drop / paste (⌘V) images anywhere in the app — they land in the tray
              at the bottom and are sent with every generation (images/edits endpoint).
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
            {sizeSelect}
            <button className="btn primary" disabled={/Generating|Starting/.test(aiStatus)} onClick={run}>
              {/Generating|Starting/.test(aiStatus) ? aiStatus : `Generate ${count}`}
            </button>
            {aiStatus && !/Generating|Starting/.test(aiStatus) && <p className="note">{aiStatus}</p>}
            <p className="note">
              The model generates at 1024×1536; “Save size” upscales on download (4K for
              CrestWall). Endpoint, model and key live in ⚙ Settings.{' '}
              {isLocalEndpoint(loadAiCfg().endpoint)
                ? 'Local model — free, unmetered, and slower (a few minutes per image).'
                : '~$0.03–0.06 per image.'}
            </p>
          </>
        )}
      </div>

      <div className="content">
        <div className="wp-wrap">
          {mode === 'live' ? (
            <>
              <h2>Live wallpaper</h2>
              <p className="note">
                {liveSource === 'ai'
                  ? 'Describe the motion, generate a clip with your OpenAI key, then loop-smooth it into a wallpaper-ready file.'
                  : 'Pick a still, choose a motion, watch the loop — then record it as a video file. The loop is seamless by construction (every effect ends exactly where it starts).'}
              </p>
              {liveSource === 'ai' ? (
                videoUrl ? (
                  <div className="depth-stage">
                    <div className="depth-phone">
                      <video src={videoUrl} autoPlay muted loop playsInline
                        style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover', borderRadius: 'inherit' }} />
                    </div>
                  </div>
                ) : (
                  <p className="note">Write a prompt on the left and generate — the clip previews here on repeat.</p>
                )
              ) : liveSrc ? (
                <div className="depth-stage">
                  <div className="depth-phone">
                    <canvas ref={liveCanvas} width={360} height={640}
                      style={{ width: '100%', height: '100%', display: 'block', borderRadius: 'inherit' }} />
                  </div>
                </div>
              ) : (
                <p className="note">Upload a wallpaper or pick one from the gallery to start.</p>
              )}
              <p className="note">
                Live Photos can't be created programmatically (Apple restriction) — the export is
                a loop video; the free intoLive app pairs it into a Live Photo in one tap.
              </p>
            </>
          ) : mode === 'depth' ? (
            <>
              <h2>Depth-effect wallpaper</h2>
              <p className="note">
                iOS segments the subject itself and slides the clock <em>behind</em> its upper
                edge. So a depth wallpaper is one well-composed flat image: subject slightly below
                center, upper 35–45% mostly clean, only the subject's top edge crossing the clock
                area — exactly what the house prompt asks for. Use this preview to verify the
                composition before shipping.
              </p>
              <div className="depth-stage">
                <div className="depth-phone">
                  <div
                    className="depth-bg"
                    dangerouslySetInnerHTML={
                      bgImage
                        ? { __html: `<img src="${bgImage}" alt=""/>` }
                        : { __html: wallpaperArt(p, bgStyle, 360, 640, 'depth-pv') }
                    }
                  />
                  <div
                    className="depth-band"
                    style={{ top: `${CLOCK_BAND.top * 100}%`, height: `${(CLOCK_BAND.bottom - CLOCK_BAND.top) * 100}%` }}
                  >
                    <span>clock area — subject's top edge should cross this</span>
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
                Checklist: clear subject/background separation · top edge crosses the clock area
                without hiding too many numbers (iOS disables depth if it does) · nothing important
                behind the Dynamic Island · no large widgets planned near the top.
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
                Write any prompt you like — the starting points on the left are optional. Results
                are kept here between sessions; “Save” downloads at the size picked on the left
                (up to 4K).
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
                        <span>{g.depth ? 'depth · ' : ''}{new Date(g.at).toLocaleDateString()}</span>
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
