import React, { useState } from 'react';
import { normalizeImage } from './svg.js';
import { IconTile } from './App.jsx';

const CFG_KEY = 'iconPackStudio.ai.v2';

// Every theme follows the same anatomy — see PROMPT_PLAYBOOK.md:
// [role] + [subject with {app}] + [style system] + [composition] + [negatives]
export const THEME_PROMPTS = [
  {
    name: 'Electric Orchard (neon glass 3D)',
    prompt:
      'A single square iOS app icon in the "Electric Orchard" theme: a symbol representing {app}, built as an original layered translucent-glass 3D object. Deep near-black plum background (#171021); electric lime #C8FF39, amber #FFB545, pale lilac #E5D8FF, and a restrained fuchsia highlight. One centered, bold, instantly recognizable silhouette with generous safe margins; refined top lighting, crisp specular highlights, subtle refraction, soft internal shadow. Square full-bleed composition, legible at 60px. No text, no letters, no official logos, no trademarks, no UI, no watermark, no border, no pre-applied rounded-corner mask.',
  },
  {
    name: 'Aurum Noir (black & gold)',
    prompt:
      'A single iOS app icon representing "{app}". Matte charcoal-black background with a subtle dark vignette. One centered symbol that clearly evokes {app}, drawn as elegant thin gold line art (metallic gold #D4AF37) with a faint golden glow. Luxurious, minimal, consistent margins (symbol fills ~50% of tile). Square full-bleed composition, flat front view. No text, no letters, no words, no border, no rounded corners.',
  },
  {
    name: 'Liquid Glass (iOS 26 style)',
    prompt:
      'A single iOS app icon representing "{app}". A translucent frosted-glass symbol of {app} floating above a soft vibrant gradient background, with realistic glass refraction, specular highlights on the top edges, and a soft drop shadow. Inspired by Apple Liquid Glass design language. Clean, centered, symbol fills ~55% of tile. Square full-bleed composition. No text, no letters, no border.',
  },
  {
    name: 'Pastel Dream',
    prompt:
      'A single iOS app icon representing "{app}". Soft pastel gradient background (blush pink to lavender). One centered rounded symbol evoking {app} in creamy white with a gentle inner shadow, soft matte 3D feel like whipped cream. Cute, calm, cohesive. Symbol fills ~50% of tile. Square full-bleed composition. No text, no letters, no border.',
  },
  {
    name: 'Neon Cyber',
    prompt:
      'A single iOS app icon representing "{app}". Deep navy-black background with a faint grid. One centered neon-glow outline symbol of {app} in electric cyan and magenta, like a glowing sign at night, slight bloom. Futuristic and consistent. Symbol fills ~50% of tile. Square full-bleed composition. No text, no letters, no border.',
  },
  {
    name: 'Clay 3D',
    prompt:
      'A single iOS app icon representing "{app}". Soft matte clay 3D render of a symbol evoking {app}, pastel color palette, smooth rounded shapes, studio lighting from above, subtle soft shadows, claymorphism style. Centered, symbol fills ~55% of tile, plain light background. Square full-bleed composition. No text, no letters, no border.',
  },
  {
    name: 'Minimal Line (light)',
    prompt:
      'A single iOS app icon representing "{app}". Warm off-white paper background. One centered ultra-minimal thin black line symbol evoking {app}, single consistent stroke weight, generous whitespace, Japanese minimalism. Symbol fills ~45% of tile. Square full-bleed composition. No text, no letters, no border, no shadows.',
  },
  {
    name: 'Retro 77',
    prompt:
      'A single iOS app icon representing "{app}". 1977 retro palette (burnt orange, mustard, cream, brown), subtle paper grain texture. One centered bold geometric symbol evoking {app} with rounded corners and offset retro stripes. Warm, nostalgic, cohesive. Symbol fills ~55% of tile. Square full-bleed composition. No text, no letters, no border.',
  },
  {
    name: 'Watercolor Botanical',
    prompt:
      'A single iOS app icon representing "{app}". Soft watercolor wash background in sage green and cream. One centered hand-painted watercolor symbol evoking {app} with delicate botanical accents (tiny leaves), artistic but clean. Symbol fills ~50% of tile. Square full-bleed composition. No text, no letters, no border.',
  },
];

function loadCfg() {
  const defaults = {
    endpoint: 'https://api.openai.com/v1/images/generations',
    model: 'gpt-image-2',
    key: '',
    prompt: THEME_PROMPTS[0].prompt,
  };
  try {
    const stored = JSON.parse(localStorage.getItem(CFG_KEY)) || {};
    // carry the key over from the v1 config if present
    if (!stored.key) {
      const old = JSON.parse(localStorage.getItem('iconPackStudio.ai.v1')) || {};
      if (old.key) stored.key = old.key;
    }
    return { ...defaults, ...stored };
  } catch {
    return defaults;
  }
}

export default function AITab({ pack, updateIcon }) {
  const [cfg, setCfg] = useState(loadCfg);
  const [running, setRunning] = useState(false);
  const [refs, setRefs] = useState([]); // style reference dataURLs (max 4)
  const refsInput = React.useRef(null);
  const [progress, setProgress] = useState('');
  const [errors, setErrors] = useState([]);

  const set = (patch) => {
    const next = { ...cfg, ...patch };
    setCfg(next);
    localStorage.setItem(CFG_KEY, JSON.stringify(next));
  };

  const generate = async (targets) => {
    setRunning(true);
    setErrors([]);
    const errs = [];
    for (let i = 0; i < targets.length; i++) {
      const ic = targets[i];
      setProgress(`Generating ${i + 1}/${targets.length}: ${ic.label}…`);
      try {
        let res;
        const promptText = cfg.prompt.replaceAll('{app}', ic.label);
        if (refs.length) {
          // style references ride along on every icon via the edits endpoint
          const fd = new FormData();
          fd.append('model', cfg.model);
          fd.append('prompt', promptText);
          fd.append('n', '1');
          fd.append('size', '1024x1024');
          for (let r = 0; r < refs.length; r++) {
            fd.append('image[]', await (await fetch(refs[r])).blob(), `ref-${r}.png`);
          }
          res = await fetch(cfg.endpoint.replace(/generations$/, 'edits'), {
            method: 'POST',
            headers: { Authorization: `Bearer ${cfg.key}` },
            body: fd,
          });
        } else {
          res = await fetch(cfg.endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.key}` },
            body: JSON.stringify({ model: cfg.model, prompt: promptText, n: 1, size: '1024x1024' }),
          });
        }
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
        }
        const data = await res.json();
        const item = data.data?.[0];
        let dataUrl;
        if (item?.b64_json) {
          dataUrl = `data:image/png;base64,${item.b64_json}`;
        } else if (item?.url) {
          const blob = await (await fetch(item.url)).blob();
          dataUrl = await normalizeImage(blob);
        } else {
          throw new Error('No image in response');
        }
        updateIcon(ic.id, { image: await normalizeImage(dataUrl), imageMode: 'cover' });
      } catch (e) {
        errs.push(`${ic.label}: ${e.message}`);
        setErrors([...errs]);
      }
    }
    setProgress(targets.length ? 'Done.' : '');
    setRunning(false);
  };

  const missing = pack.icons.filter((i) => !i.image);
  const generated = pack.icons.filter((i) => i.image);

  return (
    <div className="content">
      <div className="ai-form">
        <h2>AI icon generation</h2>
        <p className="note">
          Uses an OpenAI-compatible image API. Your API key is stored only in this browser
          (localStorage) and requests go directly from your browser to the endpoint below.
        </p>
        <div className="field">
          <label>Endpoint</label>
          <input type="text" value={cfg.endpoint} onChange={(e) => set({ endpoint: e.target.value })} />
        </div>
        <div className="field">
          <label>Model</label>
          <input type="text" value={cfg.model} onChange={(e) => set({ model: e.target.value })} />
        </div>
        <div className="field">
          <label>API key</label>
          <input
            type="password"
            placeholder="Paste your own key"
            value={cfg.key}
            onChange={(e) => set({ key: e.target.value })}
          />
        </div>
        <h3>Style prompt — <code>{'{app}'}</code> becomes each icon's name</h3>
        <select
          className="glyph-search"
          value=""
          onChange={(e) => {
            const t = THEME_PROMPTS.find((t) => t.name === e.target.value);
            if (t) set({ prompt: t.prompt });
          }}
        >
          <option value="">Load a theme prompt…</option>
          {THEME_PROMPTS.map((t) => (
            <option key={t.name} value={t.name}>{t.name}</option>
          ))}
        </select>
        <textarea className="prompt" value={cfg.prompt} onChange={(e) => set({ prompt: e.target.value })} />
        <h3>Style references (optional, applied to every icon)</h3>
        <input
          ref={refsInput} type="file" accept="image/*" multiple hidden
          onChange={async (e) => {
            const files = [...(e.target.files || [])];
            e.target.value = '';
            const added = [];
            for (const f of files.slice(0, 4 - refs.length)) added.push(await normalizeImage(f, 1536));
            setRefs((r) => [...r, ...added].slice(0, 4));
          }}
        />
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
        <button
          className="btn primary"
          disabled={running || !cfg.key || missing.length === 0}
          onClick={() => generate(missing)}
        >
          Generate {missing.length} icons without images
        </button>
        <button
          className="btn"
          disabled={running || !cfg.key || pack.icons.length === 0}
          onClick={() => confirm('Regenerate ALL icons? Existing AI images and uploads will be replaced.') && generate(pack.icons)}
        >
          Regenerate all {pack.icons.length}
        </button>
        {!cfg.key && <p className="warn">Paste your API key above to enable generation.</p>}
        {progress && <div className="progress">{progress}</div>}
        {errors.map((e, i) => (
          <p className="warn" key={i}>{e}</p>
        ))}
        {generated.length > 0 && (
          <>
            <h3>Generated / imported ({generated.length})</h3>
            <div className="thumb-strip">
              {generated.map((ic) => (
                <IconTile key={ic.id} icon={ic} style={pack.style} tag="ai" />
              ))}
            </div>
            <button
              className="btn danger"
              disabled={running}
              onClick={() =>
                confirm('Remove images from all icons and go back to glyphs?') &&
                generated.forEach((ic) => updateIcon(ic.id, { image: null }))
              }
            >
              Clear all images
            </button>
          </>
        )}
      </div>
    </div>
  );
}
