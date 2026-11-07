import { carSpeed, eagleCount, hawkCount, rivalSpeed } from './action.js';
import { BEACH, BOX, CHALLENGES, CITY, DAILY, DESERT, FOREST, MOUNTAIN, SNOW, DOUBLE, DRONE, FERRY, GATES, GROUND, HANGAR, ITEMS, JET, LEVELS, RADAR, RIVAL, ROPE, ROPE_CTL, STOPS, SURPRISE, THIN_ICE, WEATHER, WIND } from './config.js';
import { targetsFor, timeLimit } from './delivery.js';
import { weatherFor } from './weather.js';
import { nearby, rng, roofAt, shopPad, world } from './world.js';

// Customers at the level of the wheels, where a drop has to be timed between the traffic.
const ON_THE_ROAD = ['street', 'camp', 'oasis', 'clearing', 'basecamp', 'igloo'];
const stopCount = n => (n >= STOPS.threeFrom ? 3 : n >= STOPS.twoFrom ? 2 : 1);

// The route carries on from the shop closest to the last customer.
function nextShop(t, left, shops) {
  const others = shops.filter(s => s !== left && s !== t.b), gap = s => Math.abs(s.x + s.w / 2 - t.x);
  return others.reduce((best, s) => (gap(s) < gap(best) ? s : best));
}

// The drone and its load need a clear way down near a customer, wide enough to keep off the walls.
export function wayDown(t, item) {
  const need = Math.max(DRONE.radius, BOX.padX * item.size) * 2 + LEVELS.wayMargin, left = t.x - ROPE_CTL.zoneX - need, right = t.x + ROPE_CTL.zoneX + need;
  const solids = [left, t.x, right].flatMap(nearby).filter(R => R.y < t.y - ROPE).sort((a, b) => a.x - b.x);
  let edge = left;
  for (const R of solids) {
    if (R.x - edge >= need) return true;
    edge = Math.max(edge, R.x + R.w);
  }
  return right - edge >= need;
}

// Two orders tied on one rope fly as a single load: their weights add up, and the worst of the rest counts.
function tiePair(a, b) {
  return {
    key: 'double', parts: [a, b], label: a === b ? `${a.label} x2` : `${a.label} + ${b.label}`, price: a.price + b.price, prep: Math.max(a.prep, b.prep) + DOUBLE.prepExtra,
    weight: a.weight + b.weight, size: Math.max(a.size, b.size) * DOUBLE.stack, fragile: Math.max(a.fragile, b.fragile), heat: Math.max(a.heat, b.heat), wind: Math.max(a.wind, b.wind),
    urgent: a.urgent || b.urgent,
  };
}

// One shop, two customers along the same way out, the nearer one first. Each run comes from the next shop whose
// pair is light enough to lift. It has its own random stream, so the levels around it stay exactly as they were.
function doubleRun(n) {
  const c = DOUBLE, pick = rng(LEVELS.seed + n), pairOf = s => [0, 1].map(k => ITEMS[s.shop.items[k % s.shop.items.length]]);
  const shops = world.shops.filter(s => pairOf(s).reduce((sum, i) => sum + i.weight, 0) <= c.maxWeight);
  const shop = shops[Math.floor((n - c.first) / c.every) % shops.length];
  const [a, b] = pairOf(shop), item = tiePair(a, b), x = shop.x + shop.w / 2, within = (gap, lo, span) => gap > lo && gap < lo + span;
  const fits = t => t.b !== shop && (t.kind === 'roof' || (t.kind === 'bal' && item.size <= LEVELS.balconyMaxSize)) && wayDown(t, item);
  for (const dir of [1, -1]) {
    const near = world.targets.filter(t => within((t.x - x) * dir, c.near, c.nearSpan) && fits(t));
    const first = near[(pick() * near.length) | 0];
    const far = first ? world.targets.filter(t => within((t.x - first.x) * dir, c.gap, c.gapSpan) && fits(t)) : [];
    if (!far.length) continue;
    const last = far[(pick() * far.length) | 0], dist = Math.abs(last.x - x);
    return {
      shop, item, t: first, dist: Math.abs(first.x - x), limit: timeLimit(item, dist) + c.extraTime, rival: false,
      parcels: [{ item: a, t: first, dist: Math.abs(first.x - x) }, { item: b, t: last, dist }],
    };
  }
  return null;
}

// The red line stands clear above the tallest thing between two points.
function radarLine(a, b) {
  const lo = Math.min(a, b) - RADAR.clear, hi = Math.max(a, b) + RADAR.clear;
  return world.solids.reduce((top, R) => (R.x < hi && R.x + R.w > lo ? Math.min(top, R.y) : top), GROUND) - RADAR.clear;
}

// Each map's shops and its customers. Only the city's customers need a clear way down between the buildings.
const MAPS = {
  city: () => [world.shops, world.targets], beach: () => [world.kiosks, world.seaTargets], desert: () => [world.camps, world.sandTargets],
  forest: () => [world.lodges, world.forestTargets], mountain: () => [world.mountShops, world.mountTargets], snow: () => [world.snowShops, world.snowTargets],
};

// Customers that come with their rule: the ferry, on its own lane and at its own speed when a mission names them, and an
// angler on a frozen lake who stands on the ice and reaches up.
const RIDERS = {
  ferry: c => {
    const lane = FERRY.lanes[c.ride], start = lane?.start ?? FERRY.start;
    return { x: start, home: start, y: GROUND - FERRY.deckH - FERRY.targetLift, kind: 'ferry', ferry: true, ...(lane && { from: lane.from ?? FERRY.from, to: lane.to ?? FERRY.to }), ...(c.speed && { speed: c.speed }) };
  },
  ice: c => {
    const [a, b] = SNOW.lakes[c.lake ?? 0];
    return { x: (a + b) / 2, y: GROUND - THIN_ICE.lift, stand: GROUND, kind: 'ice' };
  },
};

// Rings between the shop and the customer, low and high in turn, each lifted clear of whatever stands near it.
function gateLine(a, b) {
  const c = GATES, out = [];
  for (let i = 0; i < c.count; i++) {
    const x = a + (b - a) * (c.from + (c.to - c.from) * i / (c.count - 1));
    out.push({ x, y: Math.min(GROUND - c.bands[i % 2], roofAt(x, c.span) - c.clear) });
  }
  return out;
}

// A challenge has its own random stream too, so the generated levels stay exactly as they were. A customer that comes
// with its rule draws nothing from it, as the ferry never did. A route may cross maps (map is then a list, and a leg
// names its own), a handed-on leg starts at the last customer, and a hop leg knows where its customer will go.
const sells = (s, key) => s.shop.items.includes(key) || !!s.shop.extra?.includes(key);

function challengeLevel(c, n) {
  const pick = rng(LEVELS.seed + n), tier = n - 1, rules = c.stops ?? [c.key], maps = [].concat(c.map), stops = [];
  for (let k = 0, shop = MAPS[maps[0]]()[0][c.shop]; k < rules.length; k++) {
    const twist = rules[k], leg = { ...c, ...c.legs?.[k] }, map = c.legs?.[k]?.map ?? maps[0], [shops, spots] = MAPS[map](), city = map === 'city', prev = stops[k - 1];
    // a leg on the next map leaves from that map's shop closest to the last customer; a handed-on one from the customer
    if (!shops.includes(shop)) shop = nextShop(prev.t, shop, shops);
    if (leg.handOn) shop = prev.shop;
    // an order always comes from a shop that sells it; extra lists the special goods only challenges send
    else if (leg.item && !sells(shop, leg.item)) shop = shops.filter(s => sells(s, leg.item)).sort((a, b) => Math.abs(a.x - shop.x) - Math.abs(b.x - shop.x))[0] ?? shop;
    const item = ITEMS[leg.item ?? shop.shop.items[0]], x = leg.handOn ? prev.t.x : shop.x + shop.w / 2;
    let t = RIDERS[twist]?.(leg);
    if (!t) {
      const fits = spots.filter(s => {
        const gap = Math.abs(s.x - x);
        return s.b !== shop && s !== prev?.t && gap > leg.near && gap < leg.far && leg.kinds.includes(s.kind) && (s.kind !== 'bal' || item.size <= LEVELS.balconyMaxSize) && (!city || wayDown(s, item));
      });
      t = fits[(pick() * fits.length) | 0];
    }
    const dist = Math.abs(t.x - x), dir = Math.sign(t.x - x);
    const stop = {
      shop, item, t, dist, limit: timeLimit(item, dist) + (c.extra ?? 0), rival: false, twist, ceiling: twist === 'radar' ? radarLine(x, t.x) : null,
      gates: twist === 'gates' ? gateLine(x, t.x) : null, jet: twist === 'jet' ? { line: radarLine(x, t.x) - JET.gap, dir } : null, wall: twist === 'avalanche' ? { from: x, dir } : null,
    };
    // the new rules ride on the stop only where they apply, so missions 1-55 build exactly as before
    if (leg.handOn) stop.handOn = true;
    if (twist === 'bullseye') stop.bull = true;
    if (twist === 'rescue' || leg.rescue) stop.rescue = true;
    if (leg.place) stop.place = leg.place;
    if (twist === 'gale') stop.gale = -dir;
    // the customer's two steps, fixed here so every try is the same; the rival flag comes after, so a race may hop too
    if (twist === 'hop') {
      const one = stepOver({ [map]: true }, stop), two = one && stepOver({ [map]: true }, { ...stop, t: one }, [t]);
      stop.hops = [one, two].filter(Boolean);
    }
    stops.push(stop);
    shop = nextShop(t, shop, shops);
  }
  stops[stops.length - 1].rival = !!c.rival;
  const is = m => maps.includes(m), beach = is('beach'), snow = is('snow');
  // music, the map strip, traffic, drafts, the cold and the level card all read these flags
  const l = {
    n, tier, shop: stops[0].shop, stops, beach, desert: is('desert'), forest: is('forest'), mountain: is('mountain'), snow, cold: snow ? SNOW.cold : 1,
    hawks: c.hawks, eagles: c.eagles ?? 0, rival: !!c.rival, rivalSpeed: c.rivalSpeed ?? rivalSpeed(tier), street: false, carSpeed: carSpeed(tier), wind: c.wind,
    challenge: c, startBat: c.startBat, noBoost: c.noBoost, rope: c.rope, calm: beach || rules.includes('ice'),
  };
  // a route across regions: the strip map spans them and the card names them
  if (maps.length > 1) Object.assign(l, { regions: maps, span: [ends(maps[0])[0], ends(maps[maps.length - 1])[1]] });
  return l;
}

// How far a stop's leg runs from its shop's pad to its customer.
const legOf = s => Math.abs(s.t.x - shopPad(s.shop).x);

// Where a customer on a rooftop or a boat can step over to: the closest spot of the same kind a step away, about as
// high and not on the shop, with a clear way down for this order in the city. A balcony rail or a drop at street level
// is no place to be sent by surprise, the other open maps have no such spot close enough, and a short leg is past the
// approach before a move could happen; skip names spots it may not go back to.
function stepOver(l, s, skip = []) {
  const c = SURPRISE.move, gap = t => Math.abs(t.x - s.t.x), city = !l.beach && !l.desert && !l.forest && !l.mountain && !l.snow;
  const pool = l.beach ? world.seaTargets : city ? world.targets : [];
  if (s.parcels || s.rival || !c.kinds.includes(s.t.kind) || legOf(s) < SURPRISE.approach + c.room) return null;
  return pool.filter(t => t !== s.t && !skip.includes(t) && t.kind === s.t.kind && (!t.b || (t.b !== s.t.b && t.b !== s.shop)) && gap(t) >= c.step[0] && gap(t) <= c.step[1]
    && Math.abs(t.y - s.t.y) <= c.rise && (!city || wayDown(t, s.item))).sort((a, b) => gap(a) - gap(b))[0] ?? null;
}

// One try's surprises, from a stream of their own seeded by the mission and the try, so the route, limits and physics
// stay exactly as they were and a retry can bring something new. Each names its stop, its kind, how far out it waits,
// and where a gust blows or a customer goes.
export function surprisesFor(l, attempt) {
  const c = SURPRISE, pick = rng(c.seed + l.n * 977 + attempt * 7919);
  if (!c.on || l.training || l.challenge || l.daily || l.n < c.from || l.n > c.to) return [];
  const legs = l.stops.length, roll = pick(), out = [];
  const count = roll < c.counts[0] ? 0 : roll < c.counts[0] + c.counts[1] || l.n < c.twoFrom || legs < 2 ? 1 : 2;
  // the few missions where a customer can step over usually lead with it, so it is met often enough
  const moves = l.n >= c.first.move ? l.stops.map(s => stepOver(l, s)) : [], movable = moves.flatMap((to, k) => (to ? [k] : []));
  const lead = count > 0 && movable.length > 0 && pick() < c.move.chance, first = lead ? movable[(pick() * movable.length) | 0] : (pick() * legs) | 0;
  for (let i = 0; i < count; i++) {
    const k = i ? (first + 1 + ((pick() * (legs - 1)) | 0)) % legs : first, s = l.stops[k], to = moves[k];
    const kinds = ['ring', ...(l.n >= c.first.gust && !s.rival ? ['gust'] : []), ...(to ? ['move'] : [])].filter(kind => !out.some(o => o.kind === kind));
    if (!kinds.length) break;
    const kind = !i && lead ? 'move' : kinds[(pick() * kinds.length) | 0];
    // a move waits no later than spare short of the approach, so it always has room to happen
    const last = kind === 'move' ? Math.min(c.share[1], 1 - (c.approach + c.move.spare) / legOf(s)) : c.share[1];
    out.push({ stop: k, kind, share: c.share[0] + pick() * (last - c.share[0]), ...(kind === 'gust' ? { dir: pick() < .5 ? -1 : 1 } : kind === 'move' ? { to } : {}) });
  }
  return out;
}

/* ---------- today's mission ---------- */
const mod = (a, b) => ((a % b) + b) % b;
// Day 0, 1 January 1970, was a Thursday; Monday is 0.
export const weekday = day => mod(day + 3, 7);
// A date's theme and region: the weekday names the theme, and the region steps on one a day, so a theme meets a new
// region each week.
export function dailyTheme(day) {
  const c = DAILY, wd = weekday(day);
  return { theme: c.themes[wd], region: c.regions[mod(wd + Math.floor((day + 3) / 7), c.regions.length)] };
}
const OPEN = { beach: BEACH, desert: DESERT, forest: FOREST, mountain: MOUNTAIN, snow: SNOW };
// Where a map starts and ends, the city's as the strip map draws it.
const ends = m => (m === 'city' ? [CITY.leftBuilding.x, BEACH.from] : [OPEN[m].from, OPEN[m].to]);
// Nothing solid straight over the customer, where an aircraft coming down would only settle on top of it.
export const openSky = t => !nearby(t.x).some(R => R.y + R.h <= t.y && R.x < t.x + DRONE.radius && R.x + R.w > t.x - DRONE.radius && R.y < GROUND);
// The first order a theme asks of a shop: its first two items tied on one rope, or its most delicate one; null when it
// has none.
function themeOrder(theme, shop) {
  const menu = shop.shop.items.map(k => ITEMS[k]);
  if (theme.pair) {
    const a = menu[0], b = menu[1 % menu.length], w = a.weight + b.weight;
    return w >= theme.pair[0] && w <= theme.pair[1] ? tiePair(a, b) : null;
  }
  if (theme.fragile) {
    const i = [...menu].sort((x, y) => y.fragile - x.fragile)[0];
    return i.fragile >= theme.fragile ? i : null;
  }
  return null;
}
// One try at a date's mission in a region, from the date's own stream, so missions 1-55 stay exactly as they were; null
// when a stop finds no fair customer. Today's mission is the same for everyone, so every customer is a fair one.
function dailyTry(day, attempt, region) {
  const c = DAILY, { theme } = dailyTheme(day), open = OPEN[region], [shops, spots] = MAPS[region]();
  const pick = rng(c.seed + day * c.mix + attempt * c.retry), tier = c.tier;
  const count = theme.stops ?? (pick() < c.two ? 2 : 1), reach = Math.floor(tier / count);
  const starts = shops.filter(s => !(theme.pair || theme.fragile) || themeOrder(theme, s)), stops = [];
  if (!starts.length) return null;
  for (let k = 0, shop = starts[(pick() * starts.length) | 0]; k < count; k++) {
    const x = shop.x + shop.w / 2, race = k === count - 1 && !!theme.rival;
    // an order that catches the wind flies only where the wind is gentle, never in a race or under a cut clock, and a cut
    // clock never comes with an urgent order, which is tight enough already
    const fair = i => (ITEMS[i].wind < HANGAR.windyFrom || (!race && !theme.clock && (!open || open.windBoost <= c.calm))) && !(theme.clock && ITEMS[i].urgent);
    const menu = shop.shop.items.filter(fair);
    if (!menu.length) return null;
    const item = (!k && themeOrder(theme, shop)) || ITEMS[menu[(pick() * menu.length) | 0]];
    const heavy = item.weight >= HANGAR.heavyFrom, windy = item.wind >= HANGAR.windyFrom;
    const pool = open ? spots.filter(s => Math.abs(s.x - x) > open.minDist && wayDown(s, item))
      : targetsFor(shop, reach, LEVELS.maxDist).filter(s => (s.kind !== 'bal' || item.size <= LEVELS.balconyMaxSize) && wayDown(s, item));
    const fits = pool.filter(s => s.b !== shop && openSky(s) && !stops.some(p => p.t === s) && !c.avoid.includes(s.kind)
      && !(heavy && GROUND - s.y > c.heavyTop) && !(windy && c.perches.includes(s.kind)) && !(race && Math.abs(s.x - x) < c.rivalMin));
    if (!fits.length) return null;
    const t = fits[(pick() * fits.length) | 0], dist = Math.abs(t.x - x);
    stops.push({ shop, item, t, dist, limit: timeLimit(item, dist) * (theme.clock ?? 1), rival: race });
    shop = nextShop(t, shop, shops);
  }
  const time = theme.night ? 1 : pick() < c.day ? 2 : 0, skies = c.skies[region], is = r => region === r;
  const weather = is('snow') ? 'snow' : !theme.night && skies.length && pick() < c.weather ? skies[(pick() * skies.length) | 0] : null;
  // the same flags as a generated mission, so traffic, music, the map strip and the card read it as one; n is the day
  // number, past every mission, so nothing treats it as one (surprises, skips and saves check daily)
  const l = {
    n: day, tier, shop: stops[0].shop, stops, beach: is('beach'), desert: is('desert'), forest: is('forest'), mountain: is('mountain'), snow: is('snow'),
    cold: is('snow') ? SNOW.cold : 1, hawks: hawkCount(reach) + (theme.hawks ?? 0), eagles: 0, rival: !!theme.rival, rivalSpeed: rivalSpeed(tier),
    street: false, carSpeed: carSpeed(tier), wind: Math.round((WIND.base + Math.min(tier, WIND.maxDeliveries) * WIND.perDelivery) * (open ? open.windBoost : 1)),
    weather, daily: { day, theme, region, time, attempt },
  };
  if (weather === 'clouds') l.clouds = WEATHER.clouds.amount;
  return l;
}
// Today's mission for a day number: its region's tries first, then the city's, which has room for every theme.
export function dailyLevel(day) {
  const { region } = dailyTheme(day);
  for (const r of [region, 'city']) {
    for (let a = 0; a < DAILY.tries; a++) {
      const l = dailyTry(day, a, r);
      if (l) return l;
    }
  }
  return null;
}

// Levels are fixed: the same shops, orders and customers every time, so what the
// player reads on the level card is exactly what they will fly.
export function buildLevels() {
  const r = rng(LEVELS.seed), levels = [];
  const turns = {};
  for (let n = 1; n <= LEVELS.count; n++) {
    const tier = n - 1, count = stopCount(n), region = LEVELS.regions[n - 1];
    const beach = region === 'B', desert = region === 'D', forest = region === 'F', mountain = region === 'M', snow = region === 'S';
    // an open map has its own stalls and customers, and nothing tall to shelter from the wind
    const open = beach ? BEACH : desert ? DESERT : forest ? FOREST : mountain ? MOUNTAIN : snow ? SNOW : null;
    const shops = beach ? world.kiosks : desert ? world.camps : forest ? world.lodges : mountain ? world.mountShops : snow ? world.snowShops : world.shops;
    const spots = beach ? world.seaTargets : forest ? world.forestTargets : mountain ? world.mountTargets : snow ? world.snowTargets : world.sandTargets;
    // an open map takes its stalls in turn, one each time the missions come back to it
    const turn = open ? (turns[region] = (turns[region] ?? -1) + 1) : tier;
    const start = shops[turn % shops.length], stops = [];
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
    const run = n >= DOUBLE.first && n % DOUBLE.every === DOUBLE.at ? doubleRun(n) : null;
    const rival = race && !street && !run;
    stops[count - 1].rival = rival;
    levels.push({
      n, tier, shop: run ? run.shop : start, stops: run ? [run] : stops, beach, desert, forest, mountain, snow, cold: snow ? SNOW.cold : 1,
      hawks: hawkCount(reach),
      eagles: eagleCount(n),
      rival,
      rivalSpeed: rivalSpeed(tier),
      street: street && !run,
      carSpeed: carSpeed(tier),
      wind: Math.round((WIND.base + Math.min(tier, WIND.maxDeliveries) * WIND.perDelivery) * (open ? open.windBoost : 1)),
    });
  }
  CHALLENGES.forEach((c, i) => levels.push(challengeLevel(c, LEVELS.count + i + 1)));
  // the weather only dresses a mission; where it goes and what it asks stay the same
  for (const l of levels) {
    l.weather = weatherFor(l.n, l);
    if (l.weather === 'clouds') l.clouds = WEATHER.clouds.amount;
  }
  return levels;
}
