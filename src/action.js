import { buzz, sfx } from './audio.js';
import { BEACH, BOX, CARS, CLOSE, CONTRAST, DESERT, FIXED_DT, FOREST, FX, MISSION, MOUNTAIN, SNOW, DRONE, EAGLES, EDGE, G, GROUND, HAWKS, HEALTH, RIVAL, RUSH, SURPRISE } from './config.js';
import { currentModel, drawAirframe } from './drone.js';
import { callerAt } from './homes.js';
import { confetti, ctx, glow, hud, kickDust, noticeUp, placeName, pop, shade, showToast, view, X, Y } from './ui.js';
import { nearby, roofAt, world } from './world.js';

const lerp = (st, q, k) => q['p' + k] + (q[k] - q['p' + k]) * (st.blend ?? 1);

export const hawkCount = tier => (tier < HAWKS.from ? 0 : tier < HAWKS.twoFrom ? 1 : tier < HAWKS.threeFrom ? 2 : 3);
export const eagleCount = n => (n < EAGLES.first || n % EAGLES.every !== EAGLES.at ? 0 : n < EAGLES.twoFrom ? 1 : 2);
export const rivalSpeed = tier => Math.min(RIVAL.speedMax, RIVAL.speed + (tier - RIVAL.from) * RIVAL.speedPerDelivery);
export const carSpeed = tier => Math.min(CARS.speedMax, CARS.speedMin + tier * CARS.speedPerLevel);

const roadKind = i => (i % CARS.bikeEvery === 1 ? 'bike' : i % CARS.vanEvery === 2 ? 'van' : 'car');

// Traffic is under way from the moment a level opens. Each vehicle loops within its own stretch.
export function planTraffic(st) {
  const c = CARS, level = st.level, speed = carSpeed(level.tier);
  const fill = (lo, hi, v, kindOf, gap = 1) => {
    for (let x = lo, i = 0; x < hi; x += (c.spacing + Math.random() * c.spacingRange) * gap, i++) {
      const kind = kindOf(i);
      st.cars.push({ x, px: x, v, lo, hi, kind, paint: c.paint[i % c.paint.length], taxi: kind === 'car' && i % c.taxiEvery === 0 });
    }
  };
  st.cars = [];
  st.carDir = level.n % 2 ? 1 : -1;
  st.jam = false;
  if (level.calm) return;
  if (level.beach) for (const [a, b] of BEACH.sea) fill(a, b, speed * c.boatSpeed, () => 'boat');
  else if (level.desert) {
    fill(DESERT.from, DESERT.to, speed * c.buggySpeed, () => 'buggy', DESERT.trafficGap);
    fill(DESERT.from, DESERT.to, speed * c.camelSpeed, () => 'camel', DESERT.trafficGap);
  } else if (level.mountain) {
    fill(MOUNTAIN.from, MOUNTAIN.to, speed * c.buggySpeed, () => 'jeep', MOUNTAIN.trafficGap);
    fill(MOUNTAIN.from, MOUNTAIN.to, speed * c.camelSpeed, () => 'goat', MOUNTAIN.trafficGap);
  } else if (level.snow) {
    fill(SNOW.from, SNOW.to, speed * c.buggySpeed, () => 'sled', SNOW.trafficGap);
    fill(SNOW.from, SNOW.to, speed * c.camelSpeed * 1.4, () => 'deer', SNOW.trafficGap);
  } else if (level.forest) {
    fill(FOREST.from, FOREST.to, speed * c.buggySpeed, () => 'jeep', FOREST.trafficGap);
    fill(FOREST.from, FOREST.to, speed * c.camelSpeed * 1.4, () => 'deer', FOREST.trafficGap);
  } else fill(EDGE.left, BEACH.from, speed, roadKind);
}

// Returns true on the step a car meets the drone or the order. That car stops dead
// and the rest of the road brakes behind it.
export function stepTraffic(st, dt) {
  const c = CARS, { d, box } = st;
  const touches = (car, x, y, r) => {
    const s = c.shapes[car.kind];
    return Math.abs(x - car.x) < s.length / 2 + r && y + r > GROUND + (s.lane ?? c.lane) - s.height;
  };
  let met = false;
  for (const car of st.cars) {
    car.px = car.x;
    if (st.jam) car.v = Math.max(0, car.v - c.brake * dt);
    car.x += st.carDir * car.v * dt;
    if (car.x > car.hi || car.x < car.lo) car.x = car.px = car.x - st.carDir * (car.hi - car.lo);
    if (st.jam || st.wreck || st.level.training) continue;
    if (touches(car, d.x, d.y, DRONE.radius) || (st.has && touches(car, box.x, box.y, BOX.padX * st.item.size))) {
      car.v = 0;
      st.jam = met = true;
    }
  }
  if (met) {
    st.shake = Math.max(st.shake, c.shake);
    kickDust(st, d.x, GROUND, c.dust);
    sfx('crash');
  }
  return met;
}

// Lays out the hawks and rival for a job that has just started.
export function planMission(st, shop) {
  const t = st.order.next?.t ?? st.order.t, tier = st.tier, from = st.d.x, span = t.x - from;
  st.hawks = [];
  for (let i = 0; i < st.level.hawks; i++) {
    const x = from + span * (HAWKS.pathMin + Math.random() * HAWKS.pathRange), y = roofAt(x, HAWKS.orbit) - HAWKS.lift;
    st.hawks.push({ homeX: x, homeY: y, x, y, px: x, py: y, state: 'circle', t: 0, phase: Math.random() * 7 });
  }

  // an eagle guards the last leg, so a route has its order to lose on the way home
  st.eagles = [];
  const lastLeg = st.stopAt === st.level.stops.length - 1;
  for (let i = 0; lastLeg && i < (st.level.eagles ?? 0); i++) {
    const x = from + span * (EAGLES.pathMin + Math.random() * EAGLES.pathRange), y = roofAt(x, EAGLES.orbit) - EAGLES.lift;
    st.eagles.push({ homeX: x, homeY: y, x, y, px: x, py: y, state: 'soar', t: 0, phase: Math.random() * 7, aim: 0, pass: 0, tore: false });
  }

  st.rival = null;
  if (st.stop.rival) {
    const x = shop.x + shop.w / 2, y = shop.top - RIVAL.padLift;
    st.rival = {
      x, y, px: x, py: y,
      wait: RIVAL.delayMin + Math.random() * RIVAL.delayRange,
      speed: st.level.rivalSpeed,
    };
  }
}

export function clearAction(st) {
  st.rival = null;
  st.ring = st.gust = null;
  for (const h of st.hawks) if (h.state !== 'flee') { h.state = 'flee'; h.t = 0; }
  for (const e of st.eagles) if (e.state !== 'flee' && e.state !== 'dead') { e.state = 'flee'; e.t = 0; }
}

function stepHawks(st, dt) {
  const c = HAWKS, bx = st.box, d = st.d;
  for (const h of st.hawks) {
    h.px = h.x;
    h.py = h.y;
    h.t += dt;
    if (h.state === 'circle') {
      h.x = h.homeX + Math.cos(h.t * c.circleRate + h.phase) * c.orbit;
      h.y = h.homeY + Math.sin(h.t * c.circleRate * 2 + h.phase) * c.orbit * .3;
      if (st.has && !st.ticket && Math.hypot(bx.x - h.x, bx.y - h.y) < c.trigger) {
        h.state = 'dive';
        h.t = 0;
        pop(st, h.x, h.y - 26, 'Hawk!', '#ff7a5c');
        sfx('hawk');
      }
    } else if (h.state === 'dive') {
      const dist = Math.hypot(bx.x - h.x, bx.y - h.y) || 1;
      h.near = Math.min(h.near ?? Infinity, dist);
      h.x += (bx.x - h.x) / dist * c.diveSpeed * dt;
      h.y += (bx.y - h.y) / dist * c.diveSpeed * dt;
      if (Math.hypot(d.x - h.x, d.y - h.y) < c.shooDist) {
        h.state = 'flee';
        h.t = 0;
        pop(st, h.x, h.y - 24, 'Shoo!', '#4fc27c');
        st.hp = Math.max(0, st.hp - HEALTH.hawkHit / currentModel().tough);
      } else if (dist < c.hitDist) {
        h.state = 'flee';
        h.t = 0;
        st.integ -= c.damage;
        st.shake = Math.max(st.shake, c.hitShake);
        pop(st, h.x, h.y - 24, 'Snatched!', '#e8492c');
        st.hitAt = st.t;
        sfx('box');
      } else if (h.t > c.diveTime) {
        h.state = 'flee';
        h.t = 0;
        if (h.near < CLOSE.hawkGap) closeCall(st);
      }
    } else {
      h.x += c.fleeX * dt * Math.sign(h.x - d.x || 1);
      h.y -= c.fleeY * dt;
    }
  }
  st.hawks = st.hawks.filter(h => h.state !== 'flee' || h.t < c.fleeTime);
}

function markPrey(st, e) {
  const c = EAGLES;
  e.state = 'mark';
  e.t = 0;
  e.tore = false;
  e.near = Infinity;
  sfx('eagle');
  if (e.pass) return;
  pop(st, e.x, e.y - c.reach, 'EAGLE!', '#ff5a3c');
  showToast('Eagle!', 'Dodge it. One hit brings you down', false);
}

function killEagle(st, e) {
  const c = EAGLES;
  e.state = 'dead';
  e.t = 0;
  e.vx = Math.cos(e.aim) * c.deadKick;
  e.vy = -c.deadKick;
  for (let i = 0; i < c.feathers; i++) {
    st.parts.push({ x: e.x, y: e.y, vx: (Math.random() - .5) * 260, vy: -Math.random() * 200, t: 0, crumb: 1, col: c.feather });
  }
}

// Returns true on the step an eagle reaches the aircraft.
export function stepEagles(st, dt) {
  const c = EAGLES, d = st.d, bx = st.box;
  let struck = false;
  for (const e of st.eagles) {
    e.px = e.x;
    e.py = e.y;
    e.t += dt;
    const gap = Math.hypot(d.x - e.x, d.y - e.y), want = Math.atan2(d.y - e.y, d.x - e.x);
    if (e.state === 'soar') {
      e.x = e.homeX + Math.cos(e.t * c.circleRate + e.phase) * c.orbit;
      e.y = e.homeY + Math.sin(e.t * c.circleRate * 2 + e.phase) * c.orbit * .3;
      if (st.has && !st.ticket && gap < c.trigger) markPrey(st, e);
    } else if (e.state === 'mark') {
      e.aim = want;
      e.y -= c.markRise * dt;
      if (e.t > c.markTime) {
        e.state = 'dive';
        e.t = 0;
        sfx('whoosh');
      }
    } else if (e.state === 'dive') {
      e.near = Math.min(e.near, gap);
      const off = Math.atan2(Math.sin(want - e.aim), Math.cos(want - e.aim)), limit = c.turnRate * dt;
      e.aim += Math.max(-limit, Math.min(limit, off));
      e.x += Math.cos(e.aim) * c.diveSpeed * dt;
      e.y += Math.sin(e.aim) * c.diveSpeed * dt;
      if (gap < c.hitDist && !st.wreck && !st.falling) {
        struck = true;
        killEagle(st, e);
      } else if (st.has && !e.tore && Math.hypot(bx.x - e.x, bx.y - e.y) < c.boxDist) {
        e.tore = true;
        st.integ -= c.damage;
        st.shake = Math.max(st.shake, c.hitShake);
        pop(st, e.x, e.y - 24, 'Torn!', '#e8492c');
        st.hitAt = st.t;
        sfx('box');
      } else if (Math.abs(off) > Math.PI / 2 || e.t > c.diveTime) {
        e.state = 'climb';
        e.t = 0;
        if (e.near < CLOSE.eagleGap && !e.tore) closeCall(st);
      }
    } else if (e.state === 'climb') {
      e.x += Math.cos(e.aim) * c.climbSpeed * dt;
      e.y -= c.climbRise * dt;
      if (e.t > c.climbTime) {
        if (++e.pass < c.passes && st.has) markPrey(st, e);
        else {
          e.state = 'flee';
          e.t = 0;
        }
      }
    } else if (e.state === 'dead') {
      e.vy += G * dt;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
    } else {
      e.x += c.fleeX * dt * Math.sign(e.x - d.x || 1);
      e.y -= c.fleeY * dt;
    }
  }
  st.eagles = st.eagles.filter(e => (e.state === 'dead' ? e.t < c.deadLife && e.y < GROUND : e.state !== 'flee' || e.t < c.fleeTime));
  return struck;
}

// Moves the rival over the rooftops; returns true on the step it reaches the customer.
function stepRival(st, dt) {
  const r = st.rival;
  if (!r) return false;
  r.px = r.x;
  r.py = r.y;
  if (r.wait > 0) {
    r.wait -= dt;
    return false;
  }
  const c = RIVAL, T = st.order.t, gap = T.x - r.x, step = r.speed * dt, close = Math.abs(gap) < c.approach;
  r.x += Math.max(-step, Math.min(step, gap));
  const wantY = close ? T.y - c.hover : roofAt(r.x + Math.sign(gap) * c.lookAhead, c.lookAhead) - c.clearance;
  r.y += (wantY - r.y) * Math.min(1, dt * c.climb);
  return Math.abs(gap) < c.arrive && Math.abs(r.y - (T.y - c.hover)) < c.arriveY;
}

export function stepAction(st, dt) {
  stepHawks(st, dt);
  return stepRival(st, dt);
}

/* ---------- close calls ---------- */
// What a close call or a ring banks, as the player reads it: dollars in a mission, points in Rush.
const prize = (st, v) => (st.rush ? `+${v * RUSH.points.perBonus}` : `+$${v}`);

// Slipping past danger at speed without a touch pays into the order: a few times a mission at most, never twice
// within the cooldown, and only while the player is flying the order, not on Hold or Land. The danger is already
// behind when it counts, so the words ride over the aircraft where the player is looking.
function closeCall(st) {
  const c = CLOSE, o = st.order;
  if (!st.has || !o || st.anchor || st.landing || st.falling || st.outcome || st.done || st.level.training) return;
  if (st.close.n >= c.perMission || st.t - st.close.at < c.cooldown) return;
  st.close.n++;
  st.close.at = st.t;
  o.bonus += c.bonus;
  pop(st, st.d.x, st.d.y - c.popLift, `${prize(st, c.bonus)} Close call`, c.color, FX.popSize, false, true);
  sfx('close');
}

// How far a point is from a rectangle, zero inside it.
const rectGap = (x, y, R) => Math.hypot(x - Math.max(R.x, Math.min(x, R.x + R.w)), y - Math.max(R.y, Math.min(y, R.y + R.h)));

// A pass starts in the band at speed and counts once clear again; it is spent by a touch, a hit, or lingering in the
// band past maxNear, and then waits for the way to be clear before another can start.
function pass(st, key, band, fast, clear, touched) {
  const cl = st.close, p = cl[key];
  if (p === 'spent') {
    if (clear) cl[key] = null;
  } else if (!p) {
    if (band && fast && !touched) cl[key] = { at: st.t, near: 0 };
  } else {
    if (band) p.near += FIXED_DT;
    if (touched || st.hitAt >= p.at || p.near > CLOSE.maxNear || st.t - p.at > CLOSE.maxPass) cl[key] = 'spent';
    else if (clear) {
      cl[key] = null;
      closeCall(st);
    }
  }
}

// Whether a point of size k is within gap over a vehicle whose roof is at top.
const overCar = (car, s, top, gap, x, y, k) => Math.abs(x - car.x) < s.length / 2 + k && top - (y + k) >= 0 && top - (y + k) < gap;

// Walls and cables are passed at speed; a vehicle by staying just clear over it while it drives under.
export function stepCloseCalls(st) {
  const c = CLOSE, d = st.d, bx = st.box, cl = st.close;
  if (!st.has || !st.order || st.anchor || st.landing || st.falling || st.outcome || st.done || st.level.training) {
    // a pass starts only once the way has been clear in the player's hands, so flying off a roof right after a
    // handover on Hold, or the kick of a Double Run's first drop, never counts
    cl.wall = cl.cable = 'spent';
    for (const car of st.cars) car.close = null;
    return;
  }
  const fast = Math.hypot(d.vx, d.vy) >= c.speed;
  // the aircraft and the order on its rope, each by its own size
  const r = BOX.padX * st.item.size, home = st.order.shop;
  let gap = Infinity;
  for (const [x, y, k] of [[d.x, d.y, DRONE.radius], [bx.x, bx.y, r]]) {
    for (const R of nearby(x)) {
      // the ground is no danger, and leaving the shop the order came from is routine
      if (R.mat === 'ground' || (R.x === home.x && R.y === home.top)) continue;
      gap = Math.min(gap, rectGap(x, y, R) - k);
    }
  }
  pass(st, 'wall', gap < c.gap, fast, gap >= c.clear, gap < .5);
  let line = 0;
  for (const L of world.lines) {
    if (bx.x < L.minX - c.cableX || bx.x > L.maxX + c.cableX) continue;
    for (const p of L.pts) {
      const ax = Math.abs(p.x - bx.x), ay = Math.abs(p.y - bx.y);
      if (ax < BOX.lineReachX && ay < BOX.lineReachY) line = 2;
      else if (ax < c.cableX && ay < c.cableY) line = Math.max(line, 1);
    }
  }
  pass(st, 'cable', line === 1, fast, !line, line === 2);
  // most of a flight is high over the street, where only a pass under way needs closing
  const low = Math.max(d.y + DRONE.radius, bx.y + r) > GROUND - c.carHigh;
  for (const car of st.cars) {
    if (!low && car.close == null) continue;
    const s = CARS.shapes[car.kind], top = GROUND + (s.lane ?? CARS.lane) - s.height;
    const near = low && car.v > 0 && (overCar(car, s, top, c.carGap, d.x, d.y, DRONE.radius) || overCar(car, s, top, c.carGap, bx.x, bx.y, r));
    if (near) car.close ??= st.t;
    else if (car.close != null) {
      if (car.v > 0 && st.hitAt < car.close) closeCall(st);
      car.close = null;
    }
  }
}

/* ---------- surprises ---------- */
// A planned surprise waits until its order is far enough out, a few seconds into the leg with time to spare, and the
// customer still far off; one at a time, and never while a hawk or an eagle is coming in.
export function stepSurprises(st) {
  const c = SURPRISE, o = st.order;
  stepGust(st);
  stepRing(st);
  // a moved customer's old spot shows once it comes on screen, or before long anyway
  const m = o?.moved;
  if (m && m.seen == null && ((m.x > st.cam.x && m.x < st.cam.x + view.viewW) || st.t - m.at > c.move.seenBy)) m.seen = st.t;
  if (!st.has || !o || !o.surprises?.length || st.anchor || st.landing || st.falling || st.outcome || st.done || st.ring || st.gust) return;
  if (st.t - o.start < c.after || o.deadline - st.t < c.minLeft) return;
  if (st.hawks.some(h => h.state === 'dive') || st.eagles.some(e => e.state === 'mark' || e.state === 'dive' || e.state === 'climb')) return;
  const s = o.surprises[0], T = o.t, way = T.x - o.fromX, share = way ? (st.d.x - o.fromX) / way : 0;
  if (share < s.share) return;
  if (Math.abs(T.x - st.d.x) < c.approach) {
    o.surprises.shift();
    return;
  }
  if (s.kind === 'ring' ? launchRing(st, Math.sign(way)) : s.kind === 'gust' ? launchGust(st, s.dir) : moveCustomer(st, s.to)) o.surprises.shift();
}

// A golden ring a little ahead at the aircraft's height, lifted clear of the roofs. It waits while a hawk, an eagle or
// a cable is close to where it would stand.
function launchRing(st, dir) {
  const c = SURPRISE.ring, d = st.d, x = d.x + dir * c.ahead, y = Math.max(DRONE.ceiling + c.reach, Math.min(d.y - c.rise, roofAt(x, c.span) - c.clear));
  const close = (px, py) => Math.hypot(px - x, py - y) < c.keepOff;
  if ([...st.hawks, ...st.eagles].some(b => close(b.x, b.y) || close(b.homeX, b.homeY))) return false;
  if (world.lines.some(L => x > L.minX - c.keepOff && x < L.maxX + c.keepOff && L.pts.some(p => close(p.x, p.y)))) return false;
  st.ring = { x, y, born: st.t, end: st.t + c.life };
  st.note = { icon: 'ring', text: `Bonus ring ahead ${prize(st, c.bonus)}`, until: st.t + c.note };
  sfx('gate');
  return true;
}

// Taken or missed, the ring's note goes with it.
function stepRing(st) {
  const r = st.ring, c = SURPRISE.ring;
  if (!r) return;
  const taken = st.has && Math.hypot(st.d.x - r.x, st.d.y - r.y) < c.reach;
  if (!taken && st.t <= r.end && st.has) return;
  st.ring = null;
  if (st.note?.icon === 'ring') st.note = null;
  if (!taken) return;
  st.order.bonus += c.bonus;
  pop(st, st.d.x, st.d.y - c.popLift, `${prize(st, c.bonus)} Bonus ring`, '#ffc23d', FX.popSize, false, true);
  confetti(st, r.x, r.y, c.sparkle);
  sfx('ring');
  buzz(c.buzz);
}

// The warning shows first in the weather note, then the wind swings round for a moment. It waits for open air, so it
// never throws the aircraft straight into a wall, and for a toast on a narrow screen to clear, so the warning is seen.
function launchGust(st, dir) {
  const c = SURPRISE.gust;
  if (roofAt(st.d.x, c.open) - st.d.y < c.clear || noticeUp()) return false;
  // a wind already blowing this way hard would hide it, so it comes from the other side
  if (Math.sign(st.wind) === dir && Math.abs(st.wind) > c.flip * st.level.wind) dir = -dir;
  st.gust = { at: st.t + c.warn, end: st.t + c.warn + c.secs, dir, wind: 0, on: false };
  st.note = { icon: 'wind', text: `Gust coming ${dir > 0 ? '→' : '←'}`, until: st.gust.at };
  sfx('gust');
  return true;
}

// It swings the wind from where it stands when it arrives, by the same amount every time, never past the top.
function stepGust(st) {
  const g = st.gust, c = SURPRISE.gust;
  if (!g) return;
  if (!g.on && st.t >= g.at) {
    const top = c.top * st.level.wind;
    g.wind = Math.max(-top, Math.min(top, st.wind + g.dir * c.share * st.level.wind));
    g.on = true;
    sfx('whoosh');
  }
  // it dies down near the customer, so the last approach is never caught in it
  if (st.t >= g.end || !st.has || Math.abs(st.order.t.x - st.d.x) < SURPRISE.approach) st.gust = null;
}

// The customer steps over to the next rooftop or boat, and the clock gains more than the extra way takes. The tip and
// the time star leave out what the extra way takes at the same pace; a customer stepping closer adds none.
export function moveCustomer(st, to) {
  const c = SURPRISE.move, o = st.order, dx = to.x - o.t.x, extra = Math.ceil(c.base + Math.abs(dx) / MISSION.speed * c.pace);
  const further = Math.max(0, Math.abs(to.x - st.d.x) - Math.abs(o.t.x - st.d.x));
  o.moved = { x: o.t.x, y: o.t.y, at: st.t, seen: null };
  o.t = to;
  o.deadline += extra;
  o.limit += extra;
  o.added += extra;
  o.grace += Math.ceil(further / MISSION.speed * c.pace);
  st.hold = 0;
  showToast(`${callerAt(st.stop.t, st)?.who ?? 'The customer'} moved`, `To ${placeName(to)}, ${Math.round(Math.abs(dx) / 10)} m ${dx > 0 ? '→' : '←'} · +${extra}s`, true);
  sfx('gate');
  hud(st);
  return true;
}

/* ---------- render ---------- */
function paintBike(car, light, L, H) {
  ctx.fillStyle = '#16121c';
  ctx.beginPath();
  for (const x of [-L * .36, L * .36]) {
    ctx.moveTo(x + 6, -6);
    ctx.arc(x, -6, 6, 0, 7);
  }
  ctx.fill();
  ctx.fillStyle = shade(car.paint, light);
  ctx.fillRect(-L * .34, -11, L * .68, 5);
  ctx.fillStyle = shade('#26303f', light);
  ctx.fillRect(-L * .1, -H + 2, L * .26, H - 12);
  ctx.fillStyle = shade(car.paint, Math.max(.8, light));
  ctx.beginPath();
  ctx.arc(L * .1, -H + 1, 4.5, 0, 7);
  ctx.fill();
}

function paintBoat(car, light, L, H) {
  ctx.fillStyle = 'rgba(255,255,255,.6)';
  ctx.fillRect(-L * 1.1, -3, L * .6, 2);
  ctx.fillStyle = shade(car.paint, light);
  ctx.beginPath();
  ctx.moveTo(-L / 2, -H * .6);
  ctx.lineTo(L / 2, -H * .6);
  ctx.lineTo(L * .3, 0);
  ctx.lineTo(-L * .44, 0);
  ctx.fill();
  ctx.fillStyle = shade('#26303f', Math.max(.7, light));
  ctx.fillRect(-L * .04, -H, L * .22, H * .4);
}

function paintBuggy(car, light, L, H) {
  ctx.fillStyle = '#16121c';
  ctx.beginPath();
  for (const x of [-L * .34, L * .34]) {
    ctx.moveTo(x + 8, -8);
    ctx.arc(x, -8, 8, 0, 7);
  }
  ctx.fill();
  ctx.fillStyle = shade(car.paint, light);
  ctx.beginPath();
  ctx.moveTo(-L * .46, -9); ctx.lineTo(-L * .4, -H * .52); ctx.lineTo(L * .3, -H * .52); ctx.lineTo(L * .48, -10); ctx.lineTo(L * .3, -7); ctx.lineTo(-L * .3, -7);
  ctx.fill();
  ctx.strokeStyle = shade('#2b2233', Math.max(.7, light));
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-L * .34, -H * .5); ctx.lineTo(-L * .2, -H); ctx.lineTo(L * .12, -H); ctx.lineTo(L * .24, -H * .5);
  ctx.stroke();
}

// A snowmobile: a ski up front curling at the tip, a track under the seat, a cowl and a small windscreen.
function paintSled(car, light, L, H) {
  ctx.strokeStyle = shade('#2b2233', Math.max(.7, light));
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-L * .05, -1.5); ctx.lineTo(L * .4, -1.5); ctx.quadraticCurveTo(L * .5, -1.5, L * .5, -7);
  ctx.moveTo(L * .2, -1.5); ctx.lineTo(L * .2, -9);
  ctx.stroke();
  ctx.fillStyle = '#16121c';
  ctx.beginPath();
  ctx.roundRect(-L * .46, -9, L * .5, 8, 4);
  ctx.fill();
  ctx.fillStyle = shade('#c94a3a', light);
  ctx.beginPath();
  ctx.moveTo(-L * .44, -9); ctx.lineTo(-L * .4, -H * .45); ctx.lineTo(L * .05, -H * .5); ctx.lineTo(L * .36, -H * .36); ctx.lineTo(L * .44, -10); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade('#2b2233', light);
  ctx.fillRect(-L * .38, -H * .62, L * .3, H * .14);
  ctx.fillStyle = shade('#bfe0f2', light);
  ctx.beginPath();
  ctx.moveTo(L * .02, -H * .5); ctx.lineTo(L * .1, -H * .82); ctx.lineTo(L * .16, -H * .47); ctx.closePath();
  ctx.fill();
}

function paintCamel(car, light, L, H) {
  const body = shade('#c99a5e', light), step = Math.sin(car.x * .06) * 4;
  ctx.strokeStyle = body;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  for (const [x, swing] of [[-L * .3, step], [-L * .18, -step], [L * .16, -step], [L * .28, step]]) {
    ctx.moveTo(x, -H * .46);
    ctx.lineTo(x + swing, 0);
  }
  ctx.stroke();
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, -H * .54, L * .36, H * .19, 0, 0, 7);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-L * .04, -H * .74, L * .17, H * .17, 0, 0, 7);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(L * .32, -H * .56);
  ctx.quadraticCurveTo(L * .42, -H * .56, L * .4, -H * .88);
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.ellipse(L * .45, -H * .92, L * .1, H * .07, 0, 0, 7);
  ctx.fill();
}

// goat: a pale coat and short horns in place of antlers
function paintDeer(car, light, L, H, coat = '#9c6b44', goat = false) {
  const body = shade(coat, light), step = Math.sin(car.x * .09) * 5;
  ctx.strokeStyle = body;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (const [x, swing] of [[-L * .28, step], [-L * .16, -step], [L * .18, -step], [L * .3, step]]) {
    ctx.moveTo(x, -H * .5);
    ctx.lineTo(x + swing, 0);
  }
  ctx.stroke();
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, -H * .58, L * .36, H * .16, 0, 0, 7);
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(L * .3, -H * .62);
  ctx.lineTo(L * .4, -H * .9);
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.ellipse(L * .45, -H * .92, L * .09, H * .07, 0, 0, 7);
  ctx.fill();
  ctx.strokeStyle = shade('#5a3a26', light);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  if (goat) {
    ctx.moveTo(L * .42, -H);
    ctx.quadraticCurveTo(L * .36, -H * 1.12, L * .3, -H * 1.04);
    ctx.stroke();
    return;
  }
  ctx.moveTo(L * .4, -H);
  ctx.lineTo(L * .34, -H * 1.18);
  ctx.moveTo(L * .37, -H * 1.08);
  ctx.lineTo(L * .3, -H * 1.12);
  ctx.moveTo(L * .44, -H);
  ctx.lineTo(L * .5, -H * 1.18);
  ctx.stroke();
}

// A side-on vehicle drawn facing right; the scale flips it for the other direction.
function paintCar(car, light) {
  const c = CARS, { length: L, height: H } = c.shapes[car.kind], van = car.kind === 'van', body = car.taxi ? '#f2c230' : car.paint;
  if (car.kind === 'bike') { paintBike(car, light, L, H); return; }
  if (car.kind === 'boat') { paintBoat(car, light, L, H); return; }
  if (car.kind === 'buggy') { paintBuggy(car, light, L, H); return; }
  if (car.kind === 'camel') { paintCamel(car, light, L, H); return; }
  if (car.kind === 'jeep') { paintBuggy({ ...car, paint: '#3f6e4e' }, light, L, H); return; }
  if (car.kind === 'deer') { paintDeer(car, light, L, H); return; }
  if (car.kind === 'goat') { paintDeer(car, light, L, H, '#ece6da', true); return; }
  if (car.kind === 'sled') { paintSled(car, light, L, H); return; }
  ctx.fillStyle = shade(body, light);
  ctx.beginPath();
  if (van) {
    ctx.moveTo(-L / 2, -5); ctx.lineTo(-L / 2, -H); ctx.lineTo(L * .3, -H); ctx.lineTo(L / 2, -H * .5); ctx.lineTo(L / 2, -5);
  } else {
    ctx.moveTo(-L / 2, -5); ctx.lineTo(-L / 2, -H * .58); ctx.lineTo(-L * .28, -H * .62); ctx.lineTo(-L * .16, -H);
    ctx.lineTo(L * .16, -H); ctx.lineTo(L * .3, -H * .6); ctx.lineTo(L / 2, -H * .5); ctx.lineTo(L / 2, -5);
  }
  ctx.fill();
  ctx.fillStyle = shade('#26303f', Math.max(.7, light));
  if (van) ctx.fillRect(L * .1, -H + 4, L * .2, H * .36);
  else ctx.fillRect(-L * .12, -H + 3, L * .32, H * .3);
  if (car.taxi) {
    ctx.fillStyle = '#2b1b14';
    ctx.fillRect(-L * .09, -H - 4, L * .18, 4);
  }
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(L / 2 - 3, -H * .46, 3, 4);
  ctx.fillStyle = '#e8492c';
  ctx.fillRect(-L / 2, -H * .5, 3, 4);
  ctx.fillStyle = '#16121c';
  ctx.beginPath();
  for (const x of [-L * .3, L * .3]) {
    ctx.moveTo(x + 6, -5);
    ctx.arc(x, -5, 6, 0, 7);
  }
  ctx.fill();
}

export function drawCars(st) {
  if (!st.cars) return;
  const S = view.S, c = CARS, pal = world.pal, flash = Math.sin(st.t * c.flashRate) > 0;
  for (const car of st.cars) {
    const s = c.shapes[car.kind], sx = X(lerp(st, car, 'x')), reach = s.length * 1.6 * S, y = Y(GROUND + (s.lane ?? c.lane));
    if (sx < -reach || sx > view.W + reach) continue;
    ctx.save();
    ctx.translate(sx, y);
    ctx.scale(S * st.carDir, S);
    paintCar(car, pal.light);
    if (st.jam && !car.v) {
      ctx.fillStyle = flash ? '#ffc23d' : '#7a5a1e';
      ctx.fillRect(-s.length / 2, -s.height * .32, 4, 4);
      ctx.fillRect(s.length / 2 - 4, -s.height * .32, 4, 4);
    }
    ctx.restore();
    if (pal.windowGlow > .5 && !view.lowQ && car.kind !== 'boat' && car.kind !== 'camel' && car.kind !== 'deer' && car.kind !== 'goat') glow(ctx, 'rgba(255,233,168,.55)', sx + st.carDir * (s.length / 2 + 12) * S, y - s.height * .4 * S, 26 * S);
  }
}

export function drawHawks(st) {
  const S = view.S;
  for (const h of st.hawks) {
    const hx = lerp(st, h, 'x'), hy = lerp(st, h, 'y'), sx = X(hx), sy = Y(hy);
    if (sx < -40 || sx > view.W + 40) continue;
    const wing = Math.sin(st.t * (h.state === 'dive' ? 26 : 14) + h.phase) * 9 * S;
    const face = h.state === 'circle' ? -Math.sin(st.t * HAWKS.circleRate + h.phase) : (h.x >= h.px ? 1 : -1);
    ctx.strokeStyle = '#4a3324';
    ctx.lineWidth = 3 * S;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx - 15 * S, sy - wing);
    ctx.quadraticCurveTo(sx - 6 * S, sy - 4 * S, sx, sy);
    ctx.quadraticCurveTo(sx + 6 * S, sy - 4 * S, sx + 15 * S, sy - wing);
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.fillStyle = '#6b4a30';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 1 * S, 8 * S, 3.5 * S, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#ffc23d';
    ctx.fillRect(sx + Math.sign(face || 1) * 8 * S - 1.5 * S, sy, 3 * S, 2.5 * S);
  }
}

// A broad wing from the shoulder, drawn side on, splitting into finger feathers at the tip. lift is 1 at the top of the beat.
function eagleWing(lift, col) {
  const y = -6 - 34 * lift, x = -16;
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(11, -3);
  ctx.quadraticCurveTo(7, y * .7, x + 9, y);
  ctx.lineTo(x + 4, y - 7);
  ctx.lineTo(x + 2, y + 1);
  ctx.lineTo(x - 4, y - 4);
  ctx.lineTo(x - 3, y + 5);
  ctx.lineTo(x - 10, y + 1);
  ctx.lineTo(x - 6, y + 10);
  ctx.quadraticCurveTo(-17, y * .35, -13, -2);
  ctx.closePath();
  ctx.fill();
}

// Facing +x: dark body, white head and fanned white tail, a hooked yellow beak and talons that come forward to strike.
function paintEagle(st, e, lift, hunting) {
  eagleWing(lift * .86 + .1, '#2a1d14');
  ctx.fillStyle = '#efe9dc';
  ctx.beginPath();
  ctx.moveTo(-16, -3);
  ctx.lineTo(-34, -8);
  ctx.lineTo(-37, -1);
  ctx.lineTo(-34, 6);
  ctx.lineTo(-16, 3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#3b2a1d';
  ctx.beginPath();
  ctx.moveTo(22, -5);
  ctx.quadraticCurveTo(8, -11, -15, -5);
  ctx.lineTo(-20, 0);
  ctx.quadraticCurveTo(0, 9, 21, 4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#f2b632';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const reach = hunting ? 8 : 2;
  ctx.moveTo(0, 5);
  ctx.lineTo(reach, 12);
  ctx.moveTo(-6, 5);
  ctx.lineTo(reach - 6, 12);
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.fillStyle = '#f4efe4';
  ctx.beginPath();
  ctx.arc(21, -3, 7.5, 0, 7);
  ctx.fill();
  ctx.fillStyle = '#f2b632';
  ctx.beginPath();
  ctx.moveTo(26, -7);
  ctx.quadraticCurveTo(37, -7, 35.5, 2);
  ctx.quadraticCurveTo(33, -1, 26.5, -1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = hunting ? '#e8201c' : '#2a1d14';
  ctx.beginPath();
  ctx.arc(24, -5, 1.7, 0, 7);
  ctx.fill();
  eagleWing(lift, '#4a3424');
}

export function drawEagles(st) {
  const S = view.S, c = EAGLES, d = st.d;
  for (const e of st.eagles) {
    const sx = X(lerp(st, e, 'x')), sy = Y(lerp(st, e, 'y')), reach = c.reach * c.scale * S * 1.2, dead = e.state === 'dead';
    if (sx < -reach || sx > view.W + reach) continue;
    const hunting = e.state === 'mark' || e.state === 'dive', stoop = e.state === 'dive', level = e.state === 'soar' || e.state === 'flee' || e.state === 'climb';
    const heading = level ? 0 : e.aim, face = e.state === 'soar' ? (-Math.sin(e.t * c.circleRate + e.phase) >= 0 ? 1 : -1) : (e.x >= e.px ? 1 : -1);
    const beat = Math.sin(st.t * (hunting ? c.stoopFlap : c.flap) + e.phase), lift = dead ? -.3 : stoop ? .12 + beat * .04 : .4 + beat * .6;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(face * S * c.scale, S * c.scale);
    ctx.rotate(dead ? e.t * c.deadSpin : face > 0 ? heading : Math.PI - heading);
    if (e.state === 'mark' && !view.lowQ) glow(ctx, 'rgba(255,70,50,.55)', 0, 0, 60);
    paintEagle(st, e, lift, hunting);
    ctx.restore();
  }
  const prey = st.eagles.find(e => e.state === 'mark' || e.state === 'dive');
  if (!prey || st.wreck || st.outcome || st.done) return;
  // like a hit marker, an arc around the aircraft points the way the danger is coming from, on screen or off it
  const x = X(d.x), y = Y(d.y), a = Math.atan2(prey.y - d.y, prey.x - d.x), r = Math.max(c.alarmMin, c.alarmRadius * S);
  ctx.save();
  ctx.globalAlpha = .55 + .45 * Math.sin(st.t * c.alarmRate);
  ctx.lineCap = 'round';
  ctx.lineWidth = c.alarmWidth;
  ctx.strokeStyle = c.alarmColor;
  ctx.beginPath();
  ctx.arc(x, y, r, a - c.alarmSpread, a + c.alarmSpread);
  ctx.stroke();
  ctx.restore();
}

// The bonus ring: gold and breathing, a fine arc running down its time. It fades in, says BONUS for a moment, and
// blinks as it runs out.
export function drawRing(st) {
  const r = st.ring, c = SURPRISE.ring;
  if (!r) return;
  const S = view.S, x = X(r.x), y = Y(r.y), R = (c.reach + Math.sin(st.t * 5) * c.pulse) * S, left = r.end - st.t, age = st.t - r.born;
  if (x < -R * 2 || x > view.W + R * 2) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, age / c.fade) * (left < c.blink ? .55 + .45 * Math.sin(st.t * 18) : 1);
  if (!view.lowQ) glow(ctx, `rgba(${c.color},.45)`, x, y, R * 1.5);
  ctx.lineWidth = c.line * S;
  ctx.strokeStyle = `rgb(${c.color})`;
  ctx.beginPath();
  ctx.arc(x, y, R, 0, 7);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,243,223,.9)';
  ctx.beginPath();
  ctx.arc(x, y, R + c.line * S, -Math.PI / 2, -Math.PI / 2 + Math.max(0, left / c.life) * Math.PI * 2);
  ctx.stroke();
  if (age < c.label) {
    ctx.font = '800 12px Tajawal,sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(20,15,40,.85)';
    ctx.strokeText('BONUS', x, y - R - 10);
    ctx.fillStyle = '#ffd879';
    ctx.fillText('BONUS', x, y - R - 10);
  }
  ctx.restore();
}

export function drawRival(st) {
  const r = st.rival;
  if (!r) return;
  const sx = X(lerp(st, r, 'x')), sy = Y(lerp(st, r, 'y')), S = view.S;
  if (sx < -60 || sx > view.W + 60) return;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(S * RIVAL.scale, S * RIVAL.scale);
  drawAirframe(ctx, 'fpv', st.t);
  ctx.fillStyle = '#e8492c';
  ctx.fillRect(-24, -2, 48, 3);
  ctx.restore();
  ctx.font = `${Math.round(13 * S)}px Lalezar,Tajawal,sans-serif`;
  ctx.textAlign = 'center';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(20,15,40,.8)';
  ctx.strokeText('RIVAL', sx, sy - 22 * S);
  ctx.fillStyle = '#ff7a5c';
  ctx.fillText('RIVAL', sx, sy - 22 * S);
}

export function drawBoost(st) {
  if (!st.boosting) return;
  const S = view.S, dir = st.boostDir, x = X(st.d.x), y = Y(st.d.y), tail = 34 * CONTRAST.scale;
  ctx.strokeStyle = 'rgba(255,243,223,.5)';
  ctx.lineWidth = 2 * S;
  ctx.beginPath();
  for (const [off, len] of [[-9, 34], [0, 48], [9, 30]]) {
    ctx.moveTo(x - dir * tail * S, y + off * S);
    ctx.lineTo(x - dir * (tail + len) * S, y + off * S);
  }
  ctx.stroke();
}
