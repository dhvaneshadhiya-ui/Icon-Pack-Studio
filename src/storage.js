// IndexedDB-backed project storage. localStorage caps at ~5 MB, which a pack
// full of AI images blows past; IndexedDB holds hundreds of MB.
const DB = 'iconPackStudio';
const STORE = 'kv';
const PACK_KEY = 'pack';
const LEGACY_LS_KEY = 'iconPackStudio.pack.v1';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// generic KV access (used by the AI wallpaper gallery)
export async function kvGet(key) {
  try { return await idbGet(key); } catch { return null; }
}
export async function kvSet(key, val) {
  try { await idbSet(key, val); return true; } catch { return false; }
}

async function idbGet(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, val) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readwrite').objectStore(STORE).put(val, key);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

// Returns the stored pack object, migrating any legacy localStorage copy
// (and freeing its quota) the first time.
export async function loadStoredPack() {
  try {
    const fromIdb = await idbGet(PACK_KEY);
    if (fromIdb) {
      try { localStorage.removeItem(LEGACY_LS_KEY); } catch {}
      return fromIdb;
    }
  } catch {
    // IndexedDB unavailable — fall through to localStorage
  }
  try {
    const raw = localStorage.getItem(LEGACY_LS_KEY);
    if (raw) {
      const pack = JSON.parse(raw);
      try {
        await idbSet(PACK_KEY, pack);
        localStorage.removeItem(LEGACY_LS_KEY); // free the quota hog
      } catch {}
      return pack;
    }
  } catch {}
  return null;
}

export async function storePack(pack) {
  try {
    await idbSet(PACK_KEY, pack);
    return true;
  } catch {
    // last-ditch fallback for environments without IndexedDB
    try {
      localStorage.setItem(LEGACY_LS_KEY, JSON.stringify(pack));
      return true;
    } catch {
      return false;
    }
  }
}
