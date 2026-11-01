import { carSpeed, hawkCount, rivalSpeed } from './action.js';
import { BOX, DRONE, ITEMS, LEVELS, RIVAL, ROPE, ROPE_CTL, STOPS, WIND } from './config.js';
import { targetsFor, timeLimit } from './delivery.js';
import { nearby, rng, world } from './world.js';

const stopCount = n => (n >= STOPS.threeFrom ? 3 : n >= STOPS.twoFrom ? 2 : 1);

// The route carries on from the shop closest to the last customer.
function nextShop(t, left) {
  const others = world.shops.filter(s => s !== left && s !== t.b), gap = s => Math.abs(s.x + s.w / 2 - t.x);
  return others.reduce((best, s) => (gap(s) < gap(best) ? s : best));
}

// The drone and its load need a clear way down near a customer, wide enough to keep off the walls.
function wayDown(t, item) {
  const need = Math.max(DRONE.radius, BOX.padX * item.size) * 2 + LEVELS.wayMargin, left = t.x - ROPE_CTL.zoneX - need, right = t.x + ROPE_CTL.zoneX + need;
  const solids = [left, t.x, right].flatMap(nearby).filter(R => R.y < t.y - ROPE).sort((a, b) => a.x - b.x);
  let edge = left;
  for (const R of solids) {
    if (R.x - edge >= need) return true;
    edge = Math.max(edge, R.x + R.w);
  }
  return right - edge >= need;
}

// Levels are fixed: the same shops, orders and customers every time, so what the
// player reads on the level card is exactly what they will fly.
export function buildLevels() {
  const r = rng(LEVELS.seed), levels = [];
  for (let n = 1; n <= LEVELS.count; n++) {
    const tier = n - 1, count = stopCount(n), start = world.shops[tier % world.shops.length], stops = [];
    // a route shares out the flying of one long order, so its stops ask for the reach of an earlier tier
    const reach = Math.floor(tier / count), visit = Math.floor(tier / world.shops.length);
    for (let k = 0, shop = start; k < count; k++) {
      // shops with several items take turns, so every item appears across the levels
      const items = shop.shop.items, item = ITEMS[items[(visit + k) % items.length]];
      // a load this big cannot be lowered past a balcony rail
      const fits = targetsFor(shop, reach, LEVELS.maxDist).filter(c => (c.kind !== 'bal' || item.size <= LEVELS.balconyMaxSize) && wayDown(c, item));
      const t = fits[(r() * fits.length) | 0], dist = Math.abs(t.x - (shop.x + shop.w / 2));
      stops.push({ shop, item, t, dist, limit: timeLimit(item, dist), rival: false });
      shop = nextShop(t, shop);
    }
    // a street customer brings traffic, and traffic is threat enough without a race
    const traffic = stops.some(s => s.t.kind === 'street'), race = tier >= RIVAL.from && r() < RIVAL.chance;
    const rival = race && !traffic;
    stops[count - 1].rival = rival;
    levels.push({
      n, tier, shop: start, stops,
      hawks: hawkCount(reach),
      rival,
      rivalSpeed: rivalSpeed(tier),
      traffic,
      carSpeed: carSpeed(tier),
      wind: WIND.base + Math.min(tier, WIND.maxDeliveries) * WIND.perDelivery,
    });
  }
  return levels;
}
