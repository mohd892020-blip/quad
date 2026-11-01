const PROGRESS_KEY = 'pizzaCityV1';
const SETTINGS_KEY = 'pizzaSettingsV1';

export const settings = { controls: 'joystick', plane: 'courier', dev: false };

try {
  Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {});
} catch (_) {}

export function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (_) {}
}

export function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(PROGRESS_KEY));
    if (saved && Number.isFinite(saved.del) && Number.isFinite(saved.money)) return { del: saved.del, money: saved.money };
  } catch (_) {}
  return { del: 0, money: 0 };
}

export function saveProgress(del, money) {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify({ del, money })); } catch (_) {}
}
