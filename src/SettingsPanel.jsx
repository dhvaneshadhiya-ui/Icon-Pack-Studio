import React, { useState } from 'react';
import { loadAiCfg, saveAiCfg } from './aiConfig.js';

// Image providers with OpenAI-compatible /v1/images/generations endpoints.
// Different providers = different content policies: dark/edgy-but-legal themes
// that OpenAI over-blocks generally work on FLUX hosts or a local server.
const PROVIDER_PRESETS = [
  {
    name: 'OpenAI · gpt-image-2 (default)',
    endpoint: 'https://api.openai.com/v1/images/generations',
    model: 'gpt-image-2',
    note: 'Best quality + reference-image support. Strictest content policy.',
  },
  {
    name: 'Together AI · FLUX.1 schnell (best for blocked themes)',
    endpoint: 'https://api.together.xyz/v1/images/generations',
    model: 'black-forest-labs/FLUX.1-schnell',
    note: 'Same FLUX model as the local one but hosted: ~2 s per image, ~$0.003 each, and zero load on this Mac. Permissive on dark/gothic/action themes. Needs a Together API key.',
  },
  {
    name: 'Local · FLUX.1-schnell (offline, this Mac)',
    endpoint: 'http://localhost:8080/v1/images/generations',
    model: 'flux.1-schnell-4bit',
    note: 'No key, no filter, no cost, works offline — but it holds ~9 GB while rendering, so the Mac gets sluggish: ~3 min at "Portrait (fast)", ~6 min at full Portrait. Prefer Together for blocked themes unless you need offline or absolute privacy. Start with local-ai/run.sh.',
  },
];

export default function SettingsPanel({ onClose }) {
  const [cfg, setCfg] = useState(loadAiCfg);
  const [presetNote, setPresetNote] = useState('');
  const set = (patch) => setCfg((c) => ({ ...c, ...patch }));
  const activePreset = PROVIDER_PRESETS.find(
    (p) => p.endpoint === cfg.endpoint && p.model === cfg.model
  );
  const save = () => {
    const ring = { ...(cfg.keyring || {}) };
    try { ring[new URL(cfg.endpoint).host] = cfg.key; } catch {}
    saveAiCfg({ endpoint: cfg.endpoint, model: cfg.model, videoModel: cfg.videoModel, key: cfg.key, keyring: ring });
    onClose(true);
  };

  return (
    <div className="settings-overlay" onClick={() => onClose(false)}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <h2>Settings</h2>
        <h3>OpenAI image API</h3>
        <p className="note">
          Used by AI icons, AI wallpapers and Depth. Stored only in this browser
          (localStorage) — requests go straight from your browser to the endpoint.
        </p>
        <div className="field">
          <label>Provider</label>
          <select
            value={activePreset?.name ?? ''}
            onChange={(e) => {
              const p = PROVIDER_PRESETS.find((x) => x.name === e.target.value);
              if (p) {
                // each provider remembers its own key (keyring by endpoint host)
                const host = new URL(p.endpoint).host;
                const ring = { ...(cfg.keyring || {}) };
                try { ring[new URL(cfg.endpoint).host] = cfg.key; } catch {}
                set({ endpoint: p.endpoint, model: p.model, keyring: ring, key: ring[host] ?? '' });
                setPresetNote(p.note);
              }
            }}
          >
            {!activePreset && <option value="">Custom…</option>}
            {PROVIDER_PRESETS.map((p) => (
              <option key={p.name} value={p.name}>{p.name}</option>
            ))}
          </select>
        </div>
        {(presetNote || activePreset) && (
          <p className="note">{presetNote || activePreset?.note}</p>
        )}
        <div className="field">
          <label>API key</label>
          <input
            type="password"
            placeholder="sk-…"
            value={cfg.key}
            onChange={(e) => set({ key: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Model</label>
          <input type="text" value={cfg.model} onChange={(e) => set({ model: e.target.value })} />
        </div>
        <div className="field">
          <label>Endpoint</label>
          <input type="text" value={cfg.endpoint} onChange={(e) => set({ endpoint: e.target.value })} />
        </div>
        <div className="field">
          <label>Video model</label>
          <input type="text" value={cfg.videoModel || 'sora-2'} onChange={(e) => set({ videoModel: e.target.value })} />
        </div>
        <p className="note">
          Video generation uses the same key via /v1/videos ($0.10/s). OpenAI retires sora-2 on
          Sep 24, 2026 — swap the model name here when a replacement ships.
        </p>
        <p className="note">
          {cfg.key ? '✓ Key saved — all AI surfaces use it automatically.' : 'No key yet — generation is disabled until you add one.'}
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="btn primary" onClick={save}>Save</button>
          <button className="btn" onClick={() => onClose(false)}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
