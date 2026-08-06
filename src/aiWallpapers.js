// AI wallpaper generation — Higgsfield/OpenArt-style studio: style presets,
// aspect ratios, batch runs, and a persisted results gallery.
import { normalizeImage } from './svg.js';
import { kvGet, kvSet } from './storage.js';
import { isLocalEndpoint } from './aiConfig.js';

const AI_CFG = 'iconPackStudio.ai.v2';
const GALLERY = 'iconPackStudio.wallpaperGallery.v1';

export const ASPECTS = {
  Portrait: '1024x1536',
  'Portrait (fast)': '768x1152',  // ~2x faster on the local model, same look after upscale
  Square: '1024x1024',
  Landscape: '1536x1024',
};

// Each preset is a full prompt with {subject} substituted from the idea box.
export const WALLPAPER_PRESETS = [
  {
    name: 'Aurora',
    hint: 'flowing northern lights',
    prompt:
      'A breathtaking phone wallpaper: {subject}, rendered as luminous aurora borealis ribbons of teal, violet and rose flowing across a deep midnight sky, soft atmospheric glow, subtle star field, gentle film grain, calm empty space in the upper third for the clock. Vertical composition, ultra high detail, no text, no logos, no people, no watermark.',
  },
  {
    name: 'Liquid Chrome',
    hint: 'molten metal 3D',
    prompt:
      'A premium phone wallpaper: {subject}, formed from flowing liquid chrome and iridescent molten metal, mirror-like reflections, soft studio lighting, dark background, cinematic depth of field, octane render quality. Vertical composition, ultra high detail, no text, no logos, no watermark.',
  },
  {
    name: 'Cosmic',
    hint: 'nebula and deep space',
    prompt:
      'An awe-inspiring phone wallpaper: {subject}, set in a vast cosmic nebula of magenta, cyan and gold dust clouds, distant galaxies, scattered stars, deep black space, volumetric light. Vertical composition, ultra high detail, no text, no logos, no watermark.',
  },
  {
    name: 'Minimal Zen',
    hint: 'calm negative space',
    prompt:
      'A minimalist phone wallpaper: {subject}, extremely simple, vast negative space, muted warm neutral palette, one quiet focal element in the lower third, soft natural light, subtle paper texture, Japanese minimalism. Vertical composition, no text, no logos, no watermark.',
  },
  {
    name: 'Neon City',
    hint: 'cyberpunk night',
    prompt:
      'A cyberpunk phone wallpaper: {subject}, drenched in neon magenta and electric cyan, rain-slick reflections, glowing signage bokeh, dark moody atmosphere, cinematic anamorphic lighting, blade-runner mood. Vertical composition, ultra high detail, no text, no logos, no watermark.',
  },
  {
    name: 'Watercolor',
    hint: 'painted washes',
    prompt:
      'An artistic phone wallpaper: {subject}, painted in delicate watercolor washes on textured cotton paper, soft bleeding pigments, muted pastel palette, generous white space, hand-made feel. Vertical composition, no text, no logos, no watermark.',
  },
  {
    name: 'Botanical',
    hint: 'nature macro',
    prompt:
      'A serene phone wallpaper: {subject}, macro botanical photography, dewy leaves and petals, shallow depth of field, soft diffused morning light, rich greens and creams, natural bokeh. Vertical composition, ultra high detail, no text, no logos, no watermark.',
  },
  {
    name: 'Abstract 3D',
    hint: 'geometric render',
    prompt:
      'A modern phone wallpaper: {subject}, abstract 3D geometric forms, soft matte clay materials, pastel gradient background, gentle studio shadows, clean composition, C4D render aesthetic. Vertical composition, ultra high detail, no text, no logos, no watermark.',
  },
  {
    name: 'Analog Film',
    hint: 'vintage photography',
    prompt:
      'A nostalgic phone wallpaper: {subject}, shot on 35mm analog film, warm faded tones, natural grain, gentle light leaks, soft focus falloff, 1970s color palette. Vertical composition, no text, no logos, no watermark.',
  },
  {
    name: 'Liquid Glass',
    hint: 'translucent layers',
    prompt:
      'A premium phone wallpaper: {subject}, built from layered translucent frosted glass panes, refraction and caustic light, specular highlights, deep tinted background, Apple design language. Vertical composition, ultra high detail, no text, no logos, no watermark.',
  },
];

// House spec for parallax wallpapers (iOS Perspective Zoom / launcher
// scrolling): append to any prompt. Parallax crops inward as the phone tilts,
// so the image needs bleed on every edge and nothing important near them.
export const PARALLAX_SPEC =
  'Composed for phone parallax (iOS Perspective Zoom): a clear foreground subject in front of a distant background with strong depth separation between planes. Keep the subject and all important detail well inside the frame with generous bleed on every edge — the frame shifts as the phone tilts, so nothing meaningful near the edges. Layered depth, atmospheric perspective. Vertical composition. Wallpaper quality. Ultra high detail. No text, no logos, no watermark.';

/** Turn an opaque fetch failure into something the user can act on. */
export function unreachable(url, err) {
  if (isLocalEndpoint(url)) {
    return 'Can\'t reach the local model server at localhost:8080. Start it with local-ai/run.sh, or switch provider in ⚙ Settings.';
  }
  return `Couldn't reach ${new URL(url).host} — check your connection, the endpoint in ⚙ Settings, or whether that host allows browser requests (CORS). (${err.message})`;
}

export function readAiConfig() {
  try {
    return JSON.parse(localStorage.getItem(AI_CFG)) || {};
  } catch {
    return {};
  }
}

/**
 * Generate `count` wallpapers. Calls back per image so the gallery fills
 * progressively rather than waiting for the whole batch.
 */
export async function generateWallpapers({ prompt, aspect, count = 1, refs = [], refStrength, onImage, onProgress }) {
  const cfg = readAiConfig();
  const genUrl = cfg.endpoint || 'https://api.openai.com/v1/images/generations';
  if (!cfg.key && !isLocalEndpoint(genUrl)) throw new Error('Add your API key in ⚙ Settings first.');
  const size = ASPECTS[aspect] ?? ASPECTS.Portrait;
  // reference images require the edits endpoint (multipart), mirroring the
  // ChatGPT + reference workflow used for CrestWall wallpapers
  const editUrl = genUrl.replace(/generations$/, 'edits');
  const out = [];
  for (let i = 0; i < count; i++) {
    onProgress?.(`Generating ${i + 1}/${count}…`);
    let res;
    try {
      if (refs.length) {
        const fd = new FormData();
        fd.append('model', cfg.model || 'gpt-image-2');
        fd.append('prompt', prompt);
        fd.append('n', '1');
        fd.append('size', size);
        // only our local server understands this; OpenAI would reject it
        if (isLocalEndpoint(genUrl) && refStrength != null) {
          fd.append('image_strength', String(refStrength));
        }
        for (let r = 0; r < refs.length; r++) {
          fd.append('image[]', await (await fetch(refs[r])).blob(), `ref-${r}.png`);
        }
        res = await fetch(editUrl, {
          method: 'POST',
          headers: { Authorization: `Bearer ${cfg.key}` }, // browser sets multipart boundary
          body: fd,
        });
      } else {
        res = await fetch(genUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.key}` },
          body: JSON.stringify({ model: cfg.model || 'gpt-image-2', prompt, n: 1, size }),
        });
      }
    } catch (e) {
      // a network-level failure surfaces as the useless "Load failed"
      throw new Error(unreachable(genUrl, e));
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
    const item = (await res.json()).data?.[0];
    let url;
    if (item?.b64_json) url = `data:image/png;base64,${item.b64_json}`;
    else if (item?.url) url = await normalizeImage(await (await fetch(item.url)).blob(), 2048);
    else throw new Error('No image in response');
    const entry = { id: crypto.randomUUID(), url, prompt, aspect, refs: refs.length, at: Date.now() };
    out.push(entry);
    onImage?.(entry);
  }
  return out;
}

export async function loadGallery() {
  return (await kvGet(GALLERY)) ?? [];
}
export async function saveGallery(items) {
  // cap so IndexedDB doesn't grow without bound
  return kvSet(GALLERY, items.slice(0, 60));
}
