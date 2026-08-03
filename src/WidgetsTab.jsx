import React, { useMemo, useState } from 'react';
import { WIDGET_SIZES, widgetSvg, renderWidgetPng, downloadBlob } from './svg.js';
import { scriptableWidget } from './scriptable.js';

const sanitize = (s) => s.replace(/[^\w\- ]/g, '').trim().replace(/\s+/g, '-') || 'pack';

export default function WidgetsTab({ pack }) {
  const [type, setType] = useState('art');
  const [glyph, setGlyph] = useState(pack.icons.find((i) => !i.image)?.glyph ?? 'Sparkles');
  const [text, setText] = useState('make it\nyours');
  const [busy, setBusy] = useState('');

  const opts = { type, glyph: type === 'art' ? glyph : undefined, text };
  const previews = useMemo(
    () =>
      Object.keys(WIDGET_SIZES).map((k) => [
        k,
        widgetSvg(pack.style, k, opts, `prev-${k}-${type}`),
      ]),
    [pack.style, type, glyph, text]
  );

  const dl = async (sizeKey) => {
    setBusy(sizeKey);
    try {
      const png = await renderWidgetPng(pack.style, sizeKey, opts);
      downloadBlob(png, `${sanitize(pack.name)}-widget-${sizeKey}.png`);
    } finally {
      setBusy('');
    }
  };

  const dlScriptable = () => {
    const { filename, content } = scriptableWidget(pack);
    downloadBlob(new Blob([content], { type: 'application/json' }), filename);
  };

  const glyphChoices = [...new Set(pack.icons.filter((i) => !i.image).map((i) => i.glyph))];

  return (
    <div className="main">
      <div className="sidebar">
        <h3>Widget type</h3>
        <div className="seg">
          {[['art', 'Art'], ['quote', 'Quote']].map(([t, label]) => (
            <button key={t} className={type === t ? 'active' : ''} onClick={() => setType(t)}>
              {label}
            </button>
          ))}
        </div>
        {type === 'art' && (
          <>
            <h3>Motif</h3>
            <select className="glyph-search" value={glyph} onChange={(e) => setGlyph(e.target.value)}>
              {glyphChoices.map((g) => (
                <option key={g} value={g}>{g.replace(/^si:|^ag:/, '')}</option>
              ))}
            </select>
          </>
        )}
        {type === 'quote' && (
          <>
            <h3>Text</h3>
            <textarea
              className="prompt"
              style={{ minHeight: 60 }}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </>
        )}
        <h3>Live widget</h3>
        <button className="btn primary" onClick={dlScriptable}>
          Download Scriptable widget
        </button>
        <p className="note">
          A real clock/date/battery widget in this pack's palette, for the free
          Scriptable app. Static PNGs below install via Widgetsmith or
          WidgetClub photo widgets.
        </p>
      </div>
      <div className="content">
        <div className="wp-wrap">
          <h2>Matching widgets</h2>
          <p className="note">
            Styled from “{pack.name}” — background, pattern, grain and ring settings all carry over.
            iOS rounds the corners; PNGs are intentionally square-edged.
          </p>
          <div className="wg-grid">
            {previews.map(([k, svg]) => (
              <div className="wp-card" key={k}>
                <div
                  className="wg-preview"
                  style={{ aspectRatio: `${WIDGET_SIZES[k].w} / ${WIDGET_SIZES[k].h}` }}
                  dangerouslySetInnerHTML={{ __html: svg }}
                />
                <div className="wp-row">
                  <span>{k} · {WIDGET_SIZES[k].w}×{WIDGET_SIZES[k].h}</span>
                  <button className="btn small" disabled={busy === k} onClick={() => dl(k)}>
                    {busy === k ? 'Rendering…' : 'Download'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
