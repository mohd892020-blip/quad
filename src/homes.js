import { FERRY, HOMES, SNOW } from './config.js';
import { callerOf, HOUSEHOLDS, turnOf } from './voice.js';
import { world } from './world.js';

// Each customer spot has one household for the whole session, decided at load from the levels, with no randomness, so
// the same spot reads the same name on every device and in every mission.
const homes = HOUSEHOLDS;
const cities = HOMES.city.length;

// target → household index; world targets carry nothing of ours
const owner = new WeakMap();
// riders are built per level, so they are known by where they ride, and named the first time they are asked for
const riders = new Map();
const riderKey = t => (t.ferry ? `ferry:${t.home}` : t.kind === 'ice' ? `ice:${t.x}` : null);
const byX = list => [...list].sort((a, b) => a.x - b.x || a.y - b.y);

export function nameHomes(levels) {
  const used = new Set(), at = [0, 0], span = [[0, cities], [cities, homes.length - cities]];
  let warned = false;
  // the next unused household of a list (0 city, 1 country); one that runs out starts again, which only a much bigger
  // world would need
  const next = list => {
    const [from, count] = span[list];
    while (at[list] < count && used.has(from + at[list])) at[list]++;
    if (at[list] >= count && !warned) {
      warned = true;
      console.warn('homes: households ran out');
    }
    const i = from + (at[list]++ % count);
    used.add(i);
    return i;
  };
  for (const [n, k, sign] of HOMES.pins) {
    const t = levels[n - 1]?.stops[k]?.t, i = homes.findIndex(h => h.sign === sign);
    if (!t || !world.targets.includes(t) || owner.has(t) || i < 0 || used.has(i)) {
      console.warn('homes: pin skipped', n, k);
      continue;
    }
    owner.set(t, i);
    used.add(i);
  }
  for (const t of byX(world.targets)) if (!owner.has(t)) owner.set(t, next(0));
  for (const pool of [world.seaTargets, world.sandTargets, world.forestTargets, world.mountTargets, world.snowTargets]) {
    for (const t of byX(pool)) if (!owner.has(t)) owner.set(t, next(1));
  }
  const ferries = [...new Set([FERRY.start, ...Object.values(FERRY.lanes).map(l => l.start ?? FERRY.start)])];
  for (const x of ferries) riders.set(`ferry:${x}`, next(1));
  for (const [a, b] of SNOW.lakes) riders.set(`ice:${(a + b) / 2}`, next(1));
}

export function homeOf(t) {
  if (!t) return null;
  let i = owner.get(t);
  const key = i === undefined && riderKey(t);
  if (key && riders.has(key)) owner.set(t, (i = riders.get(key)));
  return homes[i] ?? null;
}

// A home's name: its sign in the city, the household and its spot out of town, a rider by where they ride. plate drops
// a balcony's floor, which the plate under the customer does not need.
export function homeName(t, place = null, plate = false) {
  const h = homeOf(t);
  if (!h) return null;
  if (place) return `${h.first} on the ${place}`;
  if (t.ferry) return `${h.first} on the ${HOMES.words.ferry}`;
  const name = h.sign ?? `${h.own} ${HOMES.words[t.kind]}`;
  return t.kind === 'bal' && !plate ? `${name}, floor ${t.fl}` : name;
}

// The caller of a target's household for this order: a couple's two take turns from order to order.
export const callerAt = (t, st) => {
  const h = homeOf(t);
  return h ? callerOf(h, turnOf(st)) : null;
};
