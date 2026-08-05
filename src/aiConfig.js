// Single source of truth for the OpenAI-compatible API settings, shared by
// the Settings panel, AI icon generation and AI wallpapers.
export const CFG_KEY = 'iconPackStudio.ai.v2';

const DEFAULTS = {
  endpoint: 'https://api.openai.com/v1/images/generations',
  model: 'gpt-image-2',
  // OpenAI retires sora-2 + /v1/videos on 2026-09-24; editable so the
  // replacement model/endpoint can be dropped in without a code change
  videoModel: 'sora-2',
  key: '',
};

export function loadAiCfg() {
  try {
    const stored = JSON.parse(localStorage.getItem(CFG_KEY)) || {};
    if (!stored.key) {
      const old = JSON.parse(localStorage.getItem('iconPackStudio.ai.v1')) || {};
      if (old.key) stored.key = old.key;
    }
    return { ...DEFAULTS, ...stored };
  } catch {
    return { ...DEFAULTS };
  }
}

// Local servers (LocalAI/ComfyUI/our mflux server) need no API key.
export function isLocalEndpoint(endpoint) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(endpoint || '');
}

export function saveAiCfg(patch) {
  const next = { ...loadAiCfg(), ...patch };
  localStorage.setItem(CFG_KEY, JSON.stringify(next));
  return next;
}
