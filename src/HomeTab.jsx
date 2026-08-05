import React, { useState } from 'react';

const CARDS = [
  ['🎨', 'Icon pack', 'Design icons from ~5,200 glyphs — styles, gradients, finishes.', ['design']],
  ['🤖', 'AI icon pack', 'Batch-generate painted icons with gpt-image-2 + theme prompts.', ['ai']],
  ['🌄', 'Wallpapers', 'Ten procedural styles from any palette, up to 4K.', ['wallpapers', 'design']],
  ['✨', 'AI wallpapers', 'Free-form prompts + reference images. Save at 4K.', ['wallpapers', 'ai']],
  ['🕰️', 'Depth wallpaper', 'Lock Screen depth-effect composition — subject crosses the clock.', ['wallpapers', 'depth']],
  ['🎞️', 'Live wallpaper', 'Seamless-loop MOV kit from any video clip.', null],
  ['🧩', 'Widgets', 'Matching widget art, live Scriptable widgets, launchers.', ['widgets']],
  ['📦', 'Export', 'ZIPs, CrestWall bundles, install profiles, mockups.', ['export']],
];

export default function HomeTab({ go }) {
  const [liveOpen, setLiveOpen] = useState(false);

  return (
    <div className="content">
      <div className="home-wrap">
        <h2>What do you want to create?</h2>
        <p className="note">
          Everything here feeds CrestWall and Gumroad. Reference images can be dragged, dropped or
          pasted (⌘V) <em>anywhere</em> in the app — they land in the tray at the bottom and ride
          along with every AI generation. Set your OpenAI key once via ⚙ Settings (top right).
        </p>
        <div className="home-grid">
          {CARDS.map(([emoji, title, blurb, dest]) => (
            <button
              key={title}
              className="home-card"
              onClick={() => (dest ? go(...dest) : setLiveOpen((v) => !v))}
            >
              <span className="home-emoji">{emoji}</span>
              <span className="home-title">{title}</span>
              <span className="home-blurb">{blurb}</span>
            </button>
          ))}
        </div>
        {liveOpen && (
          <div className="home-live">
            <h3>Live wallpaper workflow</h3>
            <p className="note">
              Apple blocks programmatic Live-Photo wallpapers, so live wallpapers ship as a seamless
              loop MOV plus converter instructions (intoLive / Photos). Ask the
              <code> /icon-pack-themes</code> skill for a video prompt (4–6&nbsp;s, loopable motion,
              vertical), generate the clip, then run:
            </p>
            <pre className="home-code">./tools/live-wallpaper.sh input.mp4 "Name" 4</pre>
            <p className="note">
              Outputs a forward+reverse seamless loop, a still frame, a cover and a README — ready
              for CrestWall or Gumroad.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
