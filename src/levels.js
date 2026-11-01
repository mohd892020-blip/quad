import { carSpeed, hawkCount, rivalSpeed } from './action.js';
import { ITEMS, LEVELS, RIVAL, WIND } from './config.js';
import { targetsFor, timeLimit } from './delivery.js';
import { rng, world } from './world.js';

// Levels are fixed: the same shop, order and customer every time, so what the
// player reads on the level card is exactly what they will fly.
export function buildLevels() {
  const r = rng(LEVELS.seed), levels = [];
  for (let n = 1; n <= LEVELS.count; n++) {
    const tier = n - 1, shop = world.shops[tier % world.shops.length];
    // shops with several items take turns, so every item appears across the levels
    const items = shop.shop.items, visit = Math.floor(tier / world.shops.length), item = ITEMS[items[visit % items.length]];
    // a load this big cannot be lowered past a balcony rail
    const fits = targetsFor(shop, tier, LEVELS.maxDist).filter(c => c.kind !== 'bal' || item.size <= LEVELS.balconyMaxSize);
    const t = fits[(r() * fits.length) | 0];
    const dist = Math.abs(t.x - (shop.x + shop.w / 2));
    // a street customer brings traffic, and traffic is threat enough without a race
    const traffic = t.kind === 'street', race = tier >= RIVAL.from && r() < RIVAL.chance;
    levels.push({
      n, tier, shop, item, t, dist,
      limit: timeLimit(item, dist),
      hawks: hawkCount(tier),
      rival: race && !traffic,
      rivalSpeed: rivalSpeed(tier),
      traffic,
      carSpeed: carSpeed(tier),
      wind: WIND.base + Math.min(tier, WIND.maxDeliveries) * WIND.perDelivery,
    });
  }
  return levels;
}
