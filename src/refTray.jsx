import React, { createContext, useContext, useEffect, useState } from 'react';
import { normalizeImage } from './svg.js';

// App-wide reference images: drag & drop anywhere, paste (⌘V) anywhere, or
// use any "add references" button. Both AI surfaces read from this tray.
const Ctx = createContext(null);
export const useRefTray = () => useContext(Ctx);

const MAX_REFS = 4;

export function RefTrayProvider({ children }) {
  const [refs, setRefs] = useState([]);

  const addFiles = async (files) => {
    const images = [...files].filter((f) => f.type?.startsWith('image/'));
    if (!images.length) return 0;
    const added = [];
    for (const f of images) added.push(await normalizeImage(f, 1536));
    setRefs((r) => [...r, ...added].slice(0, MAX_REFS));
    return images.length;
  };

  useEffect(() => {
    const onPaste = (e) => {
      const files = [...(e.clipboardData?.items || [])]
        .filter((it) => it.kind === 'file' && it.type.startsWith('image/'))
        .map((it) => it.getAsFile())
        .filter(Boolean);
      if (files.length) {
        e.preventDefault();
        addFiles(files);
      }
    };
    const onDragOver = (e) => {
      if ([...(e.dataTransfer?.types || [])].includes('Files')) e.preventDefault();
    };
    const onDrop = (e) => {
      const files = e.dataTransfer?.files;
      if (files?.length) {
        e.preventDefault();
        addFiles(files);
      }
    };
    window.addEventListener('paste', onPaste);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('paste', onPaste);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  const remove = (i) => setRefs((r) => r.filter((_, j) => j !== i));
  const clear = () => setRefs([]);

  return (
    <Ctx.Provider value={{ refs, addFiles, remove, clear, max: MAX_REFS }}>
      {children}
      {refs.length > 0 && (
        <div className="ref-tray">
          <span className="ref-tray-label">References ({refs.length}/{MAX_REFS})</span>
          {refs.map((r, i) => (
            <div key={i} className="ref-thumb">
              <img src={r} alt="" />
              <button onClick={() => remove(i)}>×</button>
            </div>
          ))}
          <button className="ref-tray-clear" onClick={clear}>clear</button>
        </div>
      )}
    </Ctx.Provider>
  );
}
