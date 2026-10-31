const BEST_KEY = 'pizzaBest';

// Returns the best score from before this shift and saves the new one if it beat it.
export function updateBest(money) {
  let best = 0;
  try {
    best = +localStorage.getItem(BEST_KEY) || 0;
    if (money > best) localStorage.setItem(BEST_KEY, money);
  } catch (_) {}
  return best;
}
