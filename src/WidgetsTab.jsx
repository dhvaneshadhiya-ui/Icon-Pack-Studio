import React, { useMemo, useState } from 'react';
import { WIDGET_SIZES, widgetSvg, renderWidgetPng, despiaWidgetSvg, downloadBlob } from './svg.js';
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

  const liveOpts = { type, glyph: type === 'art' ? glyph : undefined, text };
  const livePreview = useMemo(
    () => despiaWidgetSvg(pack.style, { ...liveOpts, type: type === 'quote' ? 'quote' : 'date', sample: true }),
    [pack.style, type, glyph, text]
  );
  const dlTemplate = () => {
    const svg = despiaWidgetSvg(pack.style, { ...liveOpts, type: type === 'quote' ? 'quote' : 'date', sample: false });
    downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), 'widget-template.svg');
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
          <h3 style={{ marginTop: 24 }}>CrestWall live widget (Despia)</h3>
          <p className="note">
            360×169 template with live-date tokens — upload as{' '}
            <code>packs/&lt;slug&gt;/widget-template.svg</code> and the widget-svg Edge Function
            fills in real values on every refresh. Preview shows today's date.
          </p>
          <div className="wp-card" style={{ maxWidth: 400 }}>
            <div
              className="wg-preview"
              style={{ aspectRatio: '360 / 169' }}
              dangerouslySetInnerHTML={{ __html: livePreview }}
            />
            <div className="wp-row">
              <span>live · 360×169</span>
              <button className="btn small" onClick={dlTemplate}>Download template</button>
            </div>
          </div>

          <h3 style={{ marginTop: 24 }}>Static widget images</h3>
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
