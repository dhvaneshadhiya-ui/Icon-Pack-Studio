import React from 'react';

const CARDS = [
  ['🎨', 'Icon pack', 'Design icons from ~5,200 glyphs — styles, gradients, finishes.', ['design']],
  ['🤖', 'AI icon pack', 'Batch-generate painted icons with gpt-image-2 + theme prompts.', ['design', 'ai']],
  ['🌄', 'Wallpapers', 'Ten procedural styles from any palette, up to 4K.', ['wallpapers', 'design']],
  ['✨', 'AI wallpapers', 'Free-form prompts + references. Depth & parallax specs. 4K saves.', ['wallpapers', 'ai']],
  ['🕰️', 'Depth wallpaper', 'Lock Screen depth-effect composition — subject crosses the clock.', ['wallpapers', 'depth']],
  ['🎞️', 'Live wallpaper', 'Animate any still into a seamless loop video, in the browser.', ['wallpapers', 'live']],
  ['🧩', 'Widgets', 'Matching widget art, live Scriptable widgets, launchers.', ['widgets']],
  ['📦', 'Export', 'ZIPs, CrestWall bundles, install profiles, mockups.', ['export']],
];

export default function HomeTab({ go }) {
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
            <button key={title} className="home-card" onClick={() => go(...dest)}>
              <span className="home-emoji">{emoji}</span>
              <span className="home-title">{title}</span>
              <span className="home-blurb">{blurb}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
