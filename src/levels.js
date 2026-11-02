import { carSpeed, hawkCount, rivalSpeed } from './action.js';
import { BEACH, BOX, DESERT, DRONE, ITEMS, LEVELS, RIVAL, ROPE, ROPE_CTL, STOPS, WIND } from './config.js';
import { targetsFor, timeLimit } from './delivery.js';
import { nearby, rng, world } from './world.js';

// Customers at the level of the wheels, where a drop has to be timed between the traffic.
const ON_THE_ROAD = ['street', 'camp', 'oasis'];
const stopCount = n => (n >= STOPS.threeFrom ? 3 : n >= STOPS.twoFrom ? 2 : 1);

// The route carries on from the shop closest to the last customer.
function nextShop(t, left, shops) {
  const others = shops.filter(s => s !== left && s !== t.b), gap = s => Math.abs(s.x + s.w / 2 - t.x);
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
    const tier = n - 1, count = stopCount(n), beach = n % BEACH.every === 0, desert = n >= DESERT.first && n % DESERT.every === DESERT.at;
    // an open map has its own stalls and customers, and nothing tall to shelter from the wind
    const open = beach ? BEACH : desert ? DESERT : null, shops = beach ? world.kiosks : desert ? world.camps : world.shops, spots = beach ? world.seaTargets : world.sandTargets;
    const start = shops[Math.floor(tier / (open ? open.every : 1)) % shops.length], stops = [];
    // a route shares out the flying of one long order, so its stops ask for the reach of an earlier tier
    const reach = Math.floor(tier / count), visit = Math.floor(tier / world.shops.length);
    for (let k = 0, shop = start; k < count; k++) {
      // shops with several items take turns, so every item appears across the levels
      const items = shop.shop.items, item = ITEMS[items[(visit + k) % items.length]];
      // a load this big cannot be lowered past a balcony rail
      const fits = open ? spots.filter(c => Math.abs(c.x - (shop.x + shop.w / 2)) > open.minDist)
        : targetsFor(shop, reach, LEVELS.maxDist).filter(c => (c.kind !== 'bal' || item.size <= LEVELS.balconyMaxSize) && wayDown(c, item));
      const t = fits[(r() * fits.length) | 0], dist = Math.abs(t.x - (shop.x + shop.w / 2));
      stops.push({ shop, item, t, dist, limit: timeLimit(item, dist), rival: false });
      shop = nextShop(t, shop, shops);
    }
    // timing a street drop between the cars is threat enough without a race
    const street = stops.some(s => ON_THE_ROAD.includes(s.t.kind)), race = tier >= RIVAL.from && r() < RIVAL.chance;
    const rival = race && !street;
    stops[count - 1].rival = rival;
    levels.push({
      n, tier, shop: start, stops, beach, desert,
      hawks: hawkCount(reach),
      rival,
      rivalSpeed: rivalSpeed(tier),
      street,
      carSpeed: carSpeed(tier),
      wind: Math.round((WIND.base + Math.min(tier, WIND.maxDeliveries) * WIND.perDelivery) * (open ? open.windBoost : 1)),
    });
  }
  return levels;
}
