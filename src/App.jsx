import React, { useEffect, useMemo, useState } from 'react';
import { loadPack, savePack } from './model.js';
import { iconSvg } from './svg.js';
import DesignTab from './DesignTab.jsx';
import PreviewTab from './PreviewTab.jsx';
import WallpapersTab from './WallpapersTab.jsx';
import AITab from './AITab.jsx';
import ExportTab from './ExportTab.jsx';

export function IconTile({ icon, style, tag = 't' }) {
  const svg = useMemo(
    () => iconSvg(icon, style, 256, `${icon.id}-${tag}`),
    [icon, style, tag]
  );
  return <div className="tile" dangerouslySetInnerHTML={{ __html: svg }} />;
}

const TABS = [
  ['design', 'Design'],
  ['preview', 'Preview'],
  ['wallpapers', 'Wallpapers'],
  ['ai', 'AI Generate'],
  ['export', 'Export'],
];

export default function App() {
  const [pack, setPack] = useState(null);
  const [tab, setTab] = useState('design');
  const [storageFull, setStorageFull] = useState(false);
  const loaded = pack != null;

  useEffect(() => {
    loadPack().then(setPack);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(async () => setStorageFull(!(await savePack(pack))), 400);
    return () => clearTimeout(t);
  }, [pack, loaded]);

  if (!loaded) return null;

  const updateStyle = (patch) => setPack((p) => ({ ...p, style: { ...p.style, ...patch } }));
  const updateIcon = (id, patch) =>
    setPack((p) => ({
      ...p,
      icons: p.icons.map((ic) => (ic.id === id ? { ...ic, ...patch } : ic)),
    }));

  return (
    <div className="app">
      <div className="topbar">
        <div className="logo">Icon Pack <span>Studio</span></div>
        <input
          className="packname"
          value={pack.name}
          onChange={(e) => setPack((p) => ({ ...p, name: e.target.value }))}
          aria-label="Pack name"
        />
        {storageFull && (
          <span className="warn" title="Too many embedded images for browser storage. Export your work to keep it.">
            ⚠ autosave paused (storage full)
          </span>
        )}
        <div className="tabs">
          {TABS.map(([id, label]) => (
            <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'design' && (
        <DesignTab pack={pack} setPack={setPack} updateStyle={updateStyle} updateIcon={updateIcon} />
      )}
      {tab === 'preview' && <PreviewTab pack={pack} />}
      {tab === 'wallpapers' && <WallpapersTab pack={pack} />}
      {tab === 'ai' && <AITab pack={pack} updateIcon={updateIcon} />}
      {tab === 'export' && <ExportTab pack={pack} setPack={setPack} />}
    </div>
  );
}
