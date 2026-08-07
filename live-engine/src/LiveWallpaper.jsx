import React from 'react';
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig, interpolate, random } from 'remotion';

// Every effect is a function of loop position t ∈ [0,1) and MUST satisfy
// f(0) === f(1) so the exported clip repeats with no visible seam.
// Frame-accurate here (unlike a realtime canvas capture), so the loop is exact.

const pingPong = (t) => (1 - Math.cos(2 * Math.PI * t)) / 2;

function Layer({ src, scale, x, y, blur, opacity = 1 }) {
  return (
    <AbsoluteFill style={{ opacity }}>
      <Img
        src={src}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${scale}) translate(${x}px, ${y}px)`,
          filter: blur ? `blur(${blur}px)` : undefined,
        }}
      />
    </AbsoluteFill>
  );
}

const PARTICLES = Array.from({ length: 40 }, (_, i) => ({
  x: random(`px${i}`),
  y: random(`py${i}`),
  amp: 0.015 + random(`pa${i}`) * 0.035,
  phase: random(`pp${i}`) * Math.PI * 2,
  size: 2 + random(`ps${i}`) * 5,
  alpha: 0.2 + random(`pl${i}`) * 0.45,
  cycles: 1 + Math.round(random(`pc${i}`) * 2), // integer → periodic over the loop
}));

export { EFFECTS } from './effects.mjs';

export const LiveWallpaper = ({ src, effect }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const t = (frame % durationInFrames) / durationInFrames;
  const p = pingPong(t);

  switch (effect) {
    case 'Zoom in':
      return <AbsoluteFill><Layer src={src} scale={1 + 0.09 * p} x={0} y={0} /></AbsoluteFill>;
    case 'Zoom out':
      return <AbsoluteFill><Layer src={src} scale={1.09 - 0.09 * p} x={0} y={0} /></AbsoluteFill>;
    case 'Drift up':
      return <AbsoluteFill><Layer src={src} scale={1.1} x={0} y={(p - 0.5) * height * 0.05} /></AbsoluteFill>;
    case 'Drift left':
      return <AbsoluteFill><Layer src={src} scale={1.1} x={(0.5 - p) * width * 0.06} y={0} /></AbsoluteFill>;
    case 'Breathe':
      return (
        <AbsoluteFill>
          <Layer src={src} scale={1 + 0.03 * p} x={0} y={0} />
          <AbsoluteFill style={{ background: '#fff', opacity: 0.05 * p }} />
        </AbsoluteFill>
      );
    case 'Light sweep': {
      // one full sweep per loop — periodic by construction
      const pos = interpolate(t, [0, 1], [-40, 140]);
      return (
        <AbsoluteFill>
          <Layer src={src} scale={1.02} x={0} y={0} />
          <AbsoluteFill
            style={{
              background: `linear-gradient(115deg, transparent ${pos - 22}%, rgba(255,255,255,0.16) ${pos}%, transparent ${pos + 22}%)`,
            }}
          />
        </AbsoluteFill>
      );
    }
    case 'Dust motes':
      return (
        <AbsoluteFill>
          <Layer src={src} scale={1.02} x={0} y={0} />
          {PARTICLES.map((m, i) => {
            const a = t * Math.PI * 2 * m.cycles + m.phase;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: (m.x + Math.sin(a) * m.amp) * width,
                  top: (m.y + Math.cos(a * 0.9 + 1.3) * m.amp) * height,
                  width: m.size,
                  height: m.size,
                  borderRadius: '50%',
                  background: '#fff',
                  opacity: m.alpha * (0.6 + 0.4 * Math.sin(a * 1.7)),
                  filter: 'blur(0.6px)',
                }}
              />
            );
          })}
        </AbsoluteFill>
      );
    case 'Parallax': {
      // background and foreground move at different rates — the illusion the
      // iOS Perspective Zoom effect creates, baked into the video
      const shift = (p - 0.5) * 2;
      return (
        <AbsoluteFill>
          <Layer src={src} scale={1.16} x={shift * width * 0.012} y={shift * height * 0.008} blur={3} />
          <AbsoluteFill style={{ maskImage: 'radial-gradient(ellipse 65% 55% at 50% 55%, #000 40%, transparent 78%)', WebkitMaskImage: 'radial-gradient(ellipse 65% 55% at 50% 55%, #000 40%, transparent 78%)' }}>
            <Layer src={src} scale={1.06} x={-shift * width * 0.028} y={-shift * height * 0.016} />
          </AbsoluteFill>
        </AbsoluteFill>
      );
    }
    case 'Depth pulse': {
      const s = 1 + 0.05 * p;
      return (
        <AbsoluteFill>
          <Layer src={src} scale={s * 1.12} x={0} y={0} blur={6} opacity={1} />
          <AbsoluteFill style={{ maskImage: 'radial-gradient(ellipse 60% 50% at 50% 52%, #000 45%, transparent 80%)', WebkitMaskImage: 'radial-gradient(ellipse 60% 50% at 50% 52%, #000 45%, transparent 80%)' }}>
            <Layer src={src} scale={s} x={0} y={0} />
          </AbsoluteFill>
        </AbsoluteFill>
      );
    }
    default:
      return <AbsoluteFill><Layer src={src} scale={1} x={0} y={0} /></AbsoluteFill>;
  }
};
