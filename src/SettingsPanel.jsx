import React, { useState } from 'react';
import { loadAiCfg, saveAiCfg } from './aiConfig.js';

export default function SettingsPanel({ onClose }) {
  const [cfg, setCfg] = useState(loadAiCfg);
  const set = (patch) => setCfg((c) => ({ ...c, ...patch }));
  const save = () => {
    saveAiCfg({ endpoint: cfg.endpoint, model: cfg.model, key: cfg.key });
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
