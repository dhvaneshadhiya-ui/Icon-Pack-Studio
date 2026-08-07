import React from 'react';
import { Composition } from 'remotion';
import { LiveWallpaper } from './LiveWallpaper.jsx';

export const RemotionRoot = () => (
  <>
    <Composition
      id="live-wallpaper"
      component={LiveWallpaper}
      durationInFrames={150}   // 5 s @ 30fps; overridden per render
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{ src: '', effect: 'Zoom in' }}
    />
  </>
);
