import { AIRCRAFT } from './config.js';

const PROGRESS_KEY = 'pizzaCityV1';
const SETTINGS_KEY = 'pizzaSettingsV1';
const GARAGE_KEY = 'pizzaGarageV1';
const SKIPS_KEY = 'pizzaSkipsV1';

const STICK = { size: 'medium', feel: 'normal', fade: 'solid', origin: 'fixed', hand: 'right' };
export const settings = { controls: 'joystick', plane: 'courier', dev: false, muted: false, music: true, vibration: true, comboSeen: false, camera: 'chase', tier: null, lite: false, sideways: false, shopSeen: [], picture: 'sharp', trained: false, stick: STICK };

try {
  Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {});
} catch (_) {}
if (!Array.isArray(settings.shopSeen)) settings.shopSeen = [];
settings.stick = { ...STICK, ...(settings.stick && typeof settings.stick === 'object' ? settings.stick : null) };

// Real fails in a row on each mission, the missions skipped, and the missions passed since the last skip.
export const skips = { fails: {}, skipped: [], since: 0 };
try {
  const saved = JSON.parse(localStorage.getItem(SKIPS_KEY));
  for (const [n, v] of Object.entries(saved?.fails ?? {})) if (Number.isInteger(+n) && Number.isInteger(v) && v > 0) skips.fails[n] = v;
  if (Array.isArray(saved?.skipped)) skips.skipped = saved.skipped.filter(Number.isInteger);
  if (Number.isInteger(saved?.since) && saved.since >= 0) skips.since = saved.since;
} catch (_) {}

export function saveSkips() {
  try { localStorage.setItem(SKIPS_KEY, JSON.stringify(skips)); } catch (_) {}
}

// A pass clears the run of fails and counts toward the next skip; a real fail adds to the run.
export function noteResult(n, passed, real) {
  if (passed) {
    delete skips.fails[n];
    skips.since++;
  } else if (real) skips.fails[n] = (skips.fails[n] || 0) + 1;
  saveSkips();
}

// What the player has bought. It lives in memory, so flight code never touches storage.
export const garage = { owned: [], parts: {}, version: 0 };
try {
  const saved = JSON.parse(localStorage.getItem(GARAGE_KEY));
  if (Array.isArray(saved?.owned)) garage.owned = saved.owned.filter(k => typeof k === 'string');
  for (const [k, v] of Object.entries(saved?.parts ?? {})) if (Number.isInteger(v) && v > 0) garage.parts[k] = v;
} catch (_) {}

export function saveGarage() {
  garage.version++;
  try { localStorage.setItem(GARAGE_KEY, JSON.stringify({ owned: garage.owned, parts: garage.parts })); } catch (_) {}
}

export const bought = key => key === AIRCRAFT[0].key || garage.owned.includes(key);
export const owns = key => settings.dev || bought(key);
if (!owns(settings.plane)) settings.plane = AIRCRAFT[0].key;

export function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (_) {}
}

// Each field stands alone, so one bad value cannot cost the rest of a save.
const count = v => (Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);
const clean = saved => ({
  del: count(saved?.del),
  money: count(saved?.money),
  stars: Object.fromEntries(Object.entries(saved?.stars && typeof saved.stars === 'object' ? saved.stars : {})
    .filter(([n, s]) => Number.isInteger(+n) && +n > 0 && [1, 2, 3].includes(s))),
});

// With storage blocked, progress still lasts as long as the page does.
let session = null;

export function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(PROGRESS_KEY));
    if (saved) return clean(saved);
  } catch (_) {}
  return clean(session);
}

// Keeps each level's best star count alongside deliveries and money.
export function saveProgress(del, money, level, stars) {
  const best = loadProgress().stars;
  if (level) best[level] = Math.max(best[level] || 0, stars);
  session = { del, money, stars: best };
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(session)); } catch (_) {}
}
