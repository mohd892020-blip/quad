const BEST_KEY = 'pizzaBest';
const SETTINGS_KEY = 'pizzaSettingsV1';

export const settings = { controls: 'joystick', plane: 'courier', dev: false };

try {
  Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {});
} catch (_) {}

export function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (_) {}
}

// Returns the best score from before this shift and saves the new one if it beat it.
export function updateBest(money) {
  let best = 0;
  try {
    best = +localStorage.getItem(BEST_KEY) || 0;
    if (money > best) localStorage.setItem(BEST_KEY, money);
  } catch (_) {}
  return best;
}
