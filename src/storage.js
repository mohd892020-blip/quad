const PROGRESS_KEY = 'pizzaCityV1';
const SETTINGS_KEY = 'pizzaSettingsV1';

export const settings = { controls: 'joystick', plane: 'courier', dev: false, muted: false, quality: 0 };

try {
  Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {});
} catch (_) {}

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
