import React, { useEffect, useMemo, useState } from 'react';
import { loadPack, savePack } from './model.js';
import { iconSvg } from './svg.js';
import { RefTrayProvider } from './refTray.jsx';
import HomeTab from './HomeTab.jsx';
import SettingsPanel from './SettingsPanel.jsx';
import DesignTab from './DesignTab.jsx';
import PreviewTab from './PreviewTab.jsx';
import WallpapersTab from './WallpapersTab.jsx';
import WidgetsTab from './WidgetsTab.jsx';
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
  ['home', 'Home'],
  ['design', 'Design'],
  ['preview', 'Preview'],
  ['wallpapers', 'Wallpapers'],
  ['widgets', 'Widgets'],
  ['ai', 'AI Generate'],
  ['export', 'Export'],
];

export default function App() {
  const [pack, setPack] = useState(null);
  const [tab, setTab] = useState('home');
  const [storageFull, setStorageFull] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cfgVersion, setCfgVersion] = useState(0); // bump to remount AI surfaces after settings change
  const [wallMode, setWallMode] = useState(null); // initial sub-mode when arriving from Home
  const [wallSeq, setWallSeq] = useState(0);
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

  const go = (dest, mode) => {
    if (dest === 'wallpapers') {
      setWallMode(mode || null);
      setWallSeq((n) => n + 1);
    }
    setTab(dest);
  };

  return (
    <RefTrayProvider>
      <div className="app">
        <div className="topbar">
          <div className="logo" style={{ cursor: 'pointer' }} onClick={() => setTab('home')}>
            Icon Pack <span>Studio</span>
          </div>
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
              <button key={id} className={tab === id ? 'active' : ''} onClick={() => go(id)}>
                {label}
              </button>
            ))}
            <button className="gear" title="Settings (API key)" onClick={() => setSettingsOpen(true)}>⚙</button>
          </div>
        </div>
        {tab === 'home' && <HomeTab go={go} />}
        {tab === 'design' && (
          <DesignTab pack={pack} setPack={setPack} updateStyle={updateStyle} updateIcon={updateIcon} />
        )}
        {tab === 'preview' && <PreviewTab pack={pack} />}
        {tab === 'wallpapers' && (
          <WallpapersTab key={`${wallSeq}-${cfgVersion}`} pack={pack} initialMode={wallMode} />
        )}
        {tab === 'widgets' && <WidgetsTab pack={pack} />}
        {tab === 'ai' && (
          <AITab key={cfgVersion} pack={pack} updateIcon={updateIcon} openSettings={() => setSettingsOpen(true)} />
        )}
        {tab === 'export' && <ExportTab pack={pack} setPack={setPack} />}
        {settingsOpen && (
          <SettingsPanel
            onClose={(saved) => {
              setSettingsOpen(false);
              if (saved) setCfgVersion((n) => n + 1);
            }}
          />
        )}
      </div>
    </RefTrayProvider>
  );
}
