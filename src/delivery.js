import { clearAction, planMission, planTraffic } from './action.js';
import { buzz, sfx } from './audio.js';
import { standout } from './contrast.js';
import { planClouds } from './weather.js';
import { musicCue } from './music.js';
import {
  AIRCRAFT, BATTERY, BOX, CAMERA, CARGO, COMBO, CONTRAST, DELIVERY, DEV, DOUBLE, DRONE, FIXED_DT, FX, HANGAR, HEALTH, LAND, LEVELS, MISSION, ORDER_TIME, ORDERS, PERFECT, POINTER, PREP, RESTAURANT, RIVAL, ROPE, SKIP, ROPE_CTL, SURPRISE, WIND,
} from './config.js';
import { currentModel } from './drone.js';
import { loadProgress, noteResult, owns, saveProgress, settings } from './storage.js';
import { addMark, blast, clockText, confetti, ctx, glow, hud, placeName, pop, puff, showToast, view, X, Y } from './ui.js';
import { mixHex, nearby, nearestShop, shopPad, world } from './world.js';

let current = null;
export const currentShift = () => current;

// The run of clean deliveries. It lives as long as the page, through every mission passed, and is never saved.
export const streak = { n: 0 };

// A hit, a ruined order or a mission not passed ends the run; training neither builds nor breaks it. A run the badge
// was showing ends on a falling note, unless the player walked out (quiet).
export function breakStreak(st, quiet = false) {
  if (st.level.training) return;
  if (streak.n >= COMBO.showFrom && !quiet) sfx('comboLost');
  streak.n = 0;
}

// A level starts on its shop's pad.
export function newGame(level) {
  const shop = level.shop, p = shopPad(shop), saved = loadProgress();
  const st = {
    t: 0, money: saved.money, del: saved.del, level, tier: level.tier, stop: level.stops[0], stopAt: 0, earned: { stars: 3, tip: 0, beat: 0, bonus: 0, perfect: 0, integ: 100, secs: 0 }, outcome: null, done: false, cam: { x: p.x - view.viewW * CAMERA.leadX, y: 0 },
    d: { x: p.x, y: p.y - DRONE.radius, vx: 0, vy: 0, a: 0, bat: level.startBat ?? 100 },
    box: { x: p.x, y: p.y, px: p.x, py: p.y },
    has: false, heat: 100, integ: 100, order: null, item: null, hold: 0, readyAt: 0,
    wind: 0, windT: 0, windNext: WIND.firstAt, pops: [], parts: [], shake: 0, acc: 0,
    dust: [], dustN: 0, onGround: true, ropeLen: level.rope ?? ROPE, anchor: null,
    boost: 100, boosting: false, boostDir: 1, boostWait: 0, hawks: [], eagles: [], falling: false, rival: null, prep: null,
    hp: 100, wreck: 0, lastHit: null, smokeDue: 0, marks: [], smoke: [], blasts: [], batWarn: 0, charging: false, ready: 0,
    leg: { t: 0, x: p.x }, charge: 0, standout: standout(),
    combo: streak, hitAt: -Infinity, close: { n: 0, at: -Infinity, wall: null, cable: null }, ring: null, gust: null, slow: 0, plan: [], note: null, notice: null, waves: [],
  };
  planTraffic(st);
  planClouds(st);
  current = st;
  return st;
}

const canServe = (t, del) => t.kind === 'roof' || (t.kind === 'bal' ? del >= MISSION.balconyFrom : del >= MISSION.streetFrom);

export function targetsFor(shop, tier, maxDist = Infinity) {
  const near = ORDERS.minDist + Math.min(tier, ORDERS.maxSteps) * ORDERS.stepDist;
  const far = Math.min(maxDist, near + ORDERS.span + tier * ORDERS.spanPerDelivery);
  const shopX = shop.x + shop.w / 2;
  const open = world.targets.filter(t => t.b !== shop && canServe(t, tier));
  const pool = open.filter(t => {
    const gap = Math.abs(t.x - shopX);
    return gap > near && gap < far;
  });
  return pool.length ? pool : open;
}

export function timeLimit(item, dist) {
  const m = MISSION, limit = m.baseTime + dist / m.speed + Math.max(0, item.weight - 1) * m.heavyTime;
  return item.urgent ? limit * m.urgentTime : limit;
}

export function startMission(st, shop, item) {
  const { t, parcels } = st.stop, p = shopPad(shop), limit = st.level.training ? Infinity : parcels || st.level.challenge ? st.stop.limit : timeLimit(item, Math.abs(t.x - st.d.x));
  st.item = item;
  const surprises = st.plan.filter(s => s.stop === st.stopAt).sort((a, b) => a.share - b.share);
  // bonus: close calls and rings banked on the way, paid with the tip; added: seconds a moved customer put on the clock;
  // grace: what the extra way takes, which the tip and the time star never count; hand: how calm the handover has
  // been, for a perfect drop
  st.order = { t, shop, start: st.t, deadline: st.t + limit, limit, drop: parcels ? 1 : 0, next: parcels ? parcels[1] : null, bonus: 0, added: 0, grace: 0, hand: null, fromX: st.d.x, surprises };
  st.heat = 100;
  st.integ = 100;
  st.has = true;
  st.picked = true;
  st.leg = { t: st.t, x: st.d.x };
  st.ropeLen = st.level.rope ?? ROPE;
  st.box.x = st.box.px = st.d.x + RESTAURANT.boxOffsetX;
  st.box.y = st.box.py = p.y - RESTAURANT.boxLift;
  planMission(st, shop);
  sfx('pickup');
  musicCue('pickup');
  if (parcels) showToast('Double Run', `${parcels[0].item.label} first, then ${parcels[1].item.label}`, true);
  hud(st);
}

// A level opens on the pad with the shop starting on its first order, which takes the item's own prep time.
// This one order holds the aircraft down until it is loaded.
export function prepareFirstOrder(st) {
  const { shop, item } = st.stop;
  st.prep = { shop, item, left: item.prep, opening: true, nudge: 0 };
}

// Reaching for the controls too soon only shakes the notice that says why nothing moves.
export function restrain(st, keys) {
  if (keys.l || keys.r || keys.u || keys.dn || keys.rd || keys.boost || keys.axis) st.prep.nudge = PREP.nudge;
  keys.holdTap = keys.landTap = 0;
}

function endMission(st) {
  st.has = false;
  st.order = null;
  st.item = null;
  st.hold = 0;
  st.anchor = null;
  st.readyAt = st.t + MISSION.cooldown;
  clearAction(st);
}

// A level ends on a result card, shown a moment later so the crash or delivery plays out.
// The first ending stands: a drone that burns out just after delivering has still delivered.
function finish(st, outcome) {
  if (st.outcome || st.done) return;
  // a quick restart is not a real try, so it never counts toward a skip
  if (!st.level.training) noteResult(st.level.n, outcome.passed, st.t >= SKIP.realSecs || st.picked);
  st.outcome = { ...outcome, at: st.t + (outcome.passed ? LEVELS.passDelay : LEVELS.resultDelay) };
}

// The moment before the result card is the reward: paper bursts up at the customer.
function cheer(st, { x, y }) {
  const c = FX.confetti;
  for (let i = 0; i < c.count; i++) {
    st.parts.push({ x, y, vx: (Math.random() - .5) * c.spread, vy: -c.minLift - Math.random() * c.lift, t: 0, crumb: 1, col: c.paint[i % c.paint.length] });
  }
}

// charged: the player wrecked the goods, so they pay the shop for them.
export function failMission(st, why, charged = false) {
  const training = st.level.training, cost = charged && st.item && !training ? Math.min(st.money, st.item.price) : 0, reason = why.toUpperCase();
  // a mission already decided stands: a car or a blast in a passed mission's last moments takes nothing from the run
  if (!st.outcome && !st.done) breakStreak(st);
  st.money -= cost;
  endMission(st);
  if (cost) saveProgress(st.del, st.money);
  if (training) showToast('Try again', reason, false);
  else finish(st, { passed: false, why: reason, cost, reached: st.stopAt });
  hud(st);
}

// The lower order comes off at its customer: the load goes light, the aircraft jumps and the rope swings.
// Hold stays on, so the jump settles before the player flies on.
function dropLower(st) {
  const c = DOUBLE, o = st.order, { item, t } = o.next;
  st.item = item;
  o.t = t;
  o.next = null;
  o.drop = 2;
  o.surprises = [];
  o.hand = null;
  // the jump leaves the order right over the roof at speed, which is no close call
  st.close.wall = st.close.cable = 'spent';
  st.hold = 0;
  st.d.vy -= c.kick;
  st.box.py = st.box.y + c.boxKick * FIXED_DT;
  notice(st, 'First drop done', `Next: ${item.label} to ${placeName(t)}`);
}

// The notice naming the next stop comes a moment after the delivery, so the tip and a perfect drop are read first;
// stepMission shows it, and a mission decided meanwhile drops it.
function notice(st, title, detail) {
  st.notice = { at: st.t + DELIVERY.noticeWait, title, detail };
}

function passMission(st) {
  if (st.level.training) {
    cheer(st, st.order.t);
    endMission(st);
    sfx('deliver');
  musicCue('deliver');
    finish(st, { passed: true, training: true });
    hud(st);
    return;
  }
  // a moved customer's extra way counts neither against the clock nor against the warmth of a hot order
  const c = DELIVERY, o = st.order, item = st.item, secs = st.t - o.start, fair = secs - o.grace, heat = Math.min(100, st.heat + o.grace * c.heatLoss * item.heat);
  const base = c.tipBase + heat * c.tipHeat + st.integ * c.tipBox + (fair < c.tipFastSecs ? c.tipFastBonus : fair < c.tipOkSecs ? c.tipOkBonus : 0);
  const beat = st.rival ? RIVAL.bonus : 0, care = Math.round(item.urgent ? base * c.urgentTip : base);
  // a clean delivery adds to the run, and the run raises the tip; the bonuses banked on the way are paid with it
  const P = PERFECT, h = o.hand, clean = st.integ >= COMBO.minInteg && st.hitAt < o.start;
  const perfect = clean && st.integ >= P.minInteg && Math.abs(st.box.x - o.t.x) <= P.centre && !!h && h.swing <= P.swing && h.fall <= P.fall && h.drone <= P.drone;
  // an order that arrives in poor shape ends the run on the same falling note as a hit
  if (!clean) breakStreak(st);
  streak.n = clean ? streak.n + 1 : 0;
  const mult = COMBO.mult[Math.min(streak.n, COMBO.mult.length - 1)], extra = Math.round(care * mult) - care + o.bonus;
  const tip = care + extra + beat;
  o.bonus = 0;
  const fresh = item.heat && !item.spoils ? heat > c.starHeat : fair / (o.limit - o.added) < c.starTimeShare;
  const stars = 1 + (st.integ > c.starBox ? 1 : 0) + (fresh ? 1 : 0);
  const made = st.earned, next = st.level.stops[st.stopAt + 1];
  made.stars = Math.min(made.stars, stars);
  made.tip += tip;
  made.beat += beat;
  made.bonus += extra;
  made.perfect += perfect ? 1 : 0;
  made.integ = Math.min(made.integ, st.integ);
  made.secs += secs;
  st.money += tip;
  st.del++;
  pop(st, o.t.x, o.t.y - c.popLift, mult > 1 ? `+$${tip} COMBO ×${mult}` : `+$${tip}`, '#ffc23d');
  sfx('deliver');
  // the chime climbs as the run grows, after the delivery's own two notes
  if (streak.n >= COMBO.showFrom) sfx('combo', 2 ** (COMBO.notes[Math.min(streak.n - COMBO.showFrom, COMBO.notes.length - 1)] / 12));
  if (perfect) perfectDrop(st, o.t, !!(o.next || next));
  musicCue('deliver');
  if (o.next) {
    dropLower(st);
    saveProgress(st.del, st.money);
    hud(st);
    return;
  }
  if (st.leg) st.leg.via = o.t.x;
  endMission(st);
  if (next) {
    notice(st, `Stop ${++st.stopAt} done`, `Next: ${next.item.label} at ${next.shop.shop.name}`);
    st.stop = next;
    saveProgress(st.del, st.money);
  } else {
    saveProgress(st.del, st.money, st.level.n, made.stars);
    cheer(st, o.t);
    finish(st, { passed: true, ...made, combo: streak.n });
  }
  hud(st);
}

// A perfect drop: time slows for a moment, a gold wave spreads from the customer, the words pop over the aircraft, a
// bright chime, a short buzz, and confetti unless the mission's own finish is about to throw it.
function perfectDrop(st, at, paper) {
  const p = PERFECT;
  st.slow = p.slowSecs;
  st.waves.push({ x: at.x, y: at.y, t: 0 });
  if (paper) confetti(st, at.x, at.y, view.lowQ ? p.confetti >> 1 : p.confetti);
  // over the aircraft and its order timer, clear of the tip at the customer
  pop(st, st.d.x, st.d.y - p.popLift, 'PERFECT!', p.color, p.popSize, true);
  sfx('perfect');
  buzz(p.buzz);
}

// Landing on a green pad orders a job; the shop needs the item's prep time to make it,
// and taking off first cancels the order. A running job ends on time or power.
export function stepMission(st, dt) {
  const d = st.d, c = MISSION;
  st.ready = Math.max(0, st.ready - dt);
  if (st.notice && st.t >= st.notice.at) {
    if (!st.outcome && !st.done) showToast(st.notice.title, st.notice.detail, true);
    st.notice = null;
  }
  if (st.has) {
    if (st.t >= st.order.deadline) failMission(st, "Time's up");
    else if (d.bat <= 0) failMission(st, 'Battery dead');
    return;
  }
  if (st.outcome || st.done) {
    st.prep = null;
    return;
  }
  const { shop } = st.stop, p = shopPad(shop);
  const parked = Math.abs(d.x - p.x) < c.padReach && d.y < p.y && d.y > p.y - DRONE.radius - c.padGap && Math.hypot(d.vx, d.vy) < c.padSpeed;
  if (!st.prep?.opening && (!parked || st.t < st.readyAt)) {
    st.prep = null;
    return;
  }
  if (!st.prep) {
    const { item } = st.stop;
    st.prep = { shop, item, left: item.prep, nudge: 0 };
    hud(st);
  }
  st.prep.left -= dt;
  st.prep.nudge = Math.max(0, st.prep.nudge - dt);
  if (st.prep.left <= 0) {
    const { item } = st.prep;
    st.prep = null;
    st.ready = PREP.flash;
    startMission(st, shop, item);
  }
}

// While the shop works, it may suggest an aircraft that suits the order better.
export function hangarHint(st) {
  // the first order's suggestion stands until the aircraft leaves the pad
  const item = st.prep?.item ?? (st.has && st.onGround && !st.stopAt ? st.item : null);
  if (!item || st.level.training) return null;
  const c = HANGAR, named = key => AIRCRAFT.find(a => a.key === key), pace = (named(settings.plane) ?? AIRCRAFT[0]).speed;
  // an avalanche catches a slow aircraft: Boost helps, and so does the fastest aircraft the player owns; the slowest
  // are caught even with Boost, so they hear only to switch (the Courier is always owned, so there is one to name)
  if (st.stop.twist === 'avalanche' && pace < c.chaseSpeed) {
    const quick = AIRCRAFT.filter(a => owns(a.key) && a.speed > pace).sort((a, b) => b.speed - a.speed)[0] ?? AIRCRAFT[0];
    return pace < c.boostFloor ? `Avalanche: too slow, take the ${quick.name}` : `Avalanche: Boost, or try the ${quick.name}`;
  }
  // with an avalanche on the route, it never suggests an aircraft slower than the one flying
  const chase = st.level.stops.some(s => s.twist === 'avalanche'), slower = key => chase && named(key).speed < pace;
  const pick = item.weight >= c.heavyFrom ? ['heavy', `Heavy load: try ${named('heavy').name}`]
    : item.fragile >= c.fragileFrom ? ['cage', `Fragile order: try ${named('cage').name}`]
    : item.urgent ? ['fpv', `Urgent: try ${named('fpv').name}`]
    : item.wind >= c.windyFrom ? ['hexa', `Catches the wind: try ${named('hexa').name}`]
    : null;
  if (pick) return pick[0] === settings.plane || slower(pick[0]) ? null : owns(pick[0]) ? pick[1] : `${pick[1]} from the Shop`;
  if (st.del % c.rotate !== 0) return null;
  const next = AIRCRAFT[(st.del / c.rotate + 1) % AIRCRAFT.length];
  return next.key === settings.plane || !owns(next.key) || slower(next.key) ? null : `Try the ${next.name}`;
}

const NO_ZONE = { rope: false, hold: false, land: null };

// The pad Land can take the drone to, from close by and at a sensible speed. For now only a developer has it.
function padBelow(st) {
  const d = st.d;
  if (!settings.dev || st.onGround || st.wreck || st.outcome || st.done || d.bat <= 0 || (!st.landing && Math.hypot(d.vx, d.vy) > LAND.maxSpeed)) return null;
  const p = shopPad(nearestShop(d.x)), drop = p.y - d.y;
  return Math.abs(d.x - p.x) < LAND.zoneX && drop > 0 && drop < LAND.zoneY ? p : null;
}

// Where rope and hold controls apply: rope right above the customer, hold over a wider area.
export function zones(st) {
  const land = padBelow(st);
  if (!st.has || !st.order) return land ? { ...NO_ZONE, land } : NO_ZONE;
  const c = ROPE_CTL, T = st.order.t, dx = Math.abs(T.x - st.d.x), dy = T.y - st.d.y;
  return {
    rope: dx < c.zoneX && dy > 0 && dy < c.zoneY,
    hold: dx < c.holdX && dy > -c.holdAbove && dy < c.holdY,
    land,
  };
}

// Where the player should be heading: the customer, or the closest job.
export function goal(st) {
  if (st.lesson?.goal) return st.lesson.goal;
  if (st.has && st.order) {
    // a route of rings points at the next ring until the last one is through
    const ring = st.stop.gates?.[st.order.gate ?? 0];
    return ring ? { x: ring.x, y: ring.y, label: 'Ring' } : { x: st.order.t.x, y: st.order.t.y, label: 'Customer' };
  }
  const { shop } = st.stop, p = shopPad(shop);
  return { x: p.x, y: p.y - 20, label: shop.shop.name };
}

export function autoDeliver(st) {
  if (st && st.has && st.order) passMission(st);
}

export function chargeDrone(st) {
  if (!st) return;
  st.d.bat = DEV.chargeTo;
  st.hp = 100;
}

// Everything the carried order does each step after the rope has moved it.
export function stepCargo(st, dt) {
  const d = st.d, bx = st.box, c = DELIVERY, item = st.item;
  st.heat = Math.max(0, st.heat - dt * c.heatLoss * item.heat);
  if (Math.random() < dt * c.steamRate && item.heat && st.heat > c.steamMinHeat) {
    st.parts.push({ x: bx.x + (Math.random() - .5) * 14, y: bx.y - 8, vy: -30 - Math.random() * 20, t: 0 });
  }
  if (st.integ <= 0) {
    st.integ = 0;
    st.shake = c.crashShake;
    sfx('spill');
    for (let i = 0; i < c.crashCrumbs; i++) {
      st.parts.push({ x: bx.x, y: bx.y, vx: (Math.random() - .5) * 200, vy: -Math.random() * 220, t: 0, crumb: 1 });
    }
    failMission(st, 'Order ruined', true);
    return;
  }
  if (item.spoils && st.heat <= 0) {
    failMission(st, item.spoils, true);
    return;
  }
  const o = st.order, T = o.t, reach = st.anchor ? c.holdReach : c.reach, speed = Math.hypot(d.vx, d.vy), near = Math.hypot(bx.x - T.x, bx.y - T.y) < reach && speed < c.maxDroneSpeed;
  // the order and the aircraft as the customer sees them, so a customer on the moving ferry counts the same
  const P = PERFECT, vx = T.vx ?? 0, swing = Math.abs((bx.x - bx.px) / dt - vx), fall = (bx.y - bx.py) / dt, drone = Math.hypot(d.vx - vx, d.vy);
  if (near) {
    // the wildest the handover has been: a perfect drop never swung, dropped or flew fast at any moment of it
    const h = (o.hand ??= { swing: 0, fall: 0, drone: 0 });
    h.swing = Math.max(h.swing, swing);
    h.fall = Math.max(h.fall, fall);
    h.drone = Math.max(h.drone, drone);
  }
  // the lane ticks show gold only while this drop would still count as perfect, read here from the physics
  const hand = o.hand;
  o.calm = st.integ >= P.minInteg && st.hitAt < o.start && Math.abs(bx.x - T.x) <= P.centre && swing <= P.swing && fall <= P.fall && drone <= P.drone
    && (!hand || (hand.swing <= P.swing && hand.fall <= P.fall && hand.drone <= P.drone));
  if (near) {
    st.hold += dt;
    if (st.hold > c.holdTime) passMission(st);
  } else {
    st.hold = Math.max(0, st.hold - dt * c.holdDecay);
    if (!st.hold) o.hand = null;
  }
}

function carryToShop(st, shop, rebuilt) {
  const d = st.d, p = shopPad(shop);
  d.x = p.x;
  d.y = p.y - DRONE.radius;
  d.vx = d.vy = d.a = 0;
  d.bat = 100;
  if (rebuilt) st.hp = 100;
  st.anchor = st.landing = null;
  st.prev = null;
  st.cam.x = d.x - view.viewW * CAMERA.leadX;
  showToast('Back at the shop', `${shop.shop.name} patched you up`, true);
}

// An eagle's strike kills the motors. The order is gone with it, and the aircraft falls burning until it meets something.
export function strikeDown(st) {
  const { box } = st;
  for (let i = 0; i < DELIVERY.crashCrumbs; i++) {
    st.parts.push({ x: box.x, y: box.y, vx: (Math.random() - .5) * 200, vy: -Math.random() * 220, t: 0, crumb: 1 });
  }
  st.falling = true;
  st.anchor = st.landing = null;
  st.boosting = false;
  st.hp = Math.min(st.hp, HEALTH.fireAt - 1);
  st.shake = HEALTH.blastShake;
  sfx('crash');
  failMission(st, 'Downed by an eagle', true);
}

export function explode(st) {
  const c = HEALTH, d = st.d, hit = st.lastHit;
  st.falling = false;
  blast(st, d.x, d.y);
  // the scar lands where it struck, or on the surface just below a blast in the open
  if (hit && st.t - hit.t < c.hitMemory) addMark(st, hit.x, hit.y, c.markBlast, c.markBurn, hit.R);
  else {
    const R = nearby(d.x).filter(k => d.x >= k.x && d.x <= k.x + k.w && k.y >= d.y).sort((a, b) => a.y - b.y)[0];
    if (R && R.y - d.y < c.surfaceReach) addMark(st, d.x, R.y, c.markBlast, c.markBurn, R);
  }
  st.wreck = c.respawnDelay;
  st.shake = c.blastShake;
  st.boosting = false;
  d.vx = d.vy = 0;
  sfx('boom');
  failMission(st, 'Aircraft destroyed', st.has);
}

// Smoke, then fire that burns on until the drone is repaired or explodes.
export function stepHealth(st, dt) {
  const c = HEALTH, d = st.d;
  if (st.wreck) {
    st.wreck = Math.max(0, st.wreck - dt);
    if (!st.wreck) carryToShop(st, nearestShop(d.x), true);
    return;
  }
  const burning = st.hp < c.fireAt;
  if (burning) st.hp = Math.max(0, st.hp - c.burnRate * dt);
  if (st.hp < c.smokeAt) {
    st.smokeDue += dt * (burning ? c.fireRate : c.smokeRate);
    while (st.smokeDue >= 1) {
      st.smokeDue--;
      puff(st, d.x, d.y - 8, burning && st.dustN % 2 === 0);
    }
  }
  if (st.hp <= 0) explode(st);
}

// A soft chime once when the battery runs low and once more when it is nearly out.
function stepBattery(st) {
  const c = BATTERY, secs = st.d.bat * currentModel().battery / (DRONE.batDrain + DRONE.batDrainLift);
  const warn = secs < c.criticalSecs ? 2 : secs < c.lowSecs ? 1 : 0;
  if (warn > st.batWarn && !st.outcome && !st.done) sfx('battery');
  st.batWarn = warn;
}

// The first pad after an order pays out its charge, measured against the fair time for the route flown.
function earnCharge(st) {
  const c = BATTERY, { d, leg } = st, via = leg.via ?? d.x;
  const fair = c.grace + (Math.abs(via - leg.x) + Math.abs(d.x - via)) / c.pace;
  const share = st.level.training ? 1 : Math.min(1, fair / (st.t - leg.t));
  st.charge = (100 - d.bat) * share;
  st.leg = null;
  if (share < 1) showToast('Slow trip', `This charge stops at ${Math.floor(d.bat + st.charge)}%`, false);
}

// Any shop roof repairs, and charges while there is charge to collect; parked on one, the motors rest.
// Out of power on the ground with no order ends the level; in training the closest shop fetches the drone.
export function stepShop(st, grounded, dt) {
  const d = st.d, c = RESTAURANT, shop = nearestShop(d.x);
  stepBattery(st);
  const onPad = grounded && Math.abs(d.x - (shop.x + shop.w / 2)) < shop.w / 2 && d.y < shop.top && d.y > shop.top - c.padHeight;
  st.docked = onPad;
  // a charge is earned by the trip, so an order waiting on the pad it was loaded on earns nothing yet
  if (st.leg && !onPad) st.leg.away = true;
  if (onPad && st.leg?.away && d.bat < BATTERY.chargingBelow) earnCharge(st);
  const gain = onPad ? Math.min(st.charge, dt * c.chargeRate, 100 - d.bat) : 0;
  st.charging = gain > 0;
  d.bat += gain;
  st.charge -= gain;
  if (onPad) st.hp = Math.min(100, st.hp + dt * HEALTH.repairRate);
  if (d.bat > 0 || !grounded || st.has || st.outcome || st.done) return;
  if (st.level.training) carryToShop(st, shop);
  else failMission(st, 'Battery dead');
}

/* ---------- render ---------- */
// The soft column of light standing on each green pad while a job is free.
export function drawHalos(st) {
  if (st.has) return;
  const { W, S } = view, c = MISSION, pulse = .5 + .5 * Math.sin(st.t * 4);
  if (st.outcome || st.done) return;
  const p = shopPad(st.stop.shop), sx = X(p.x);
  if (sx < -80 || sx > W + 80) return;
  const top = Y(p.y - c.haloHeight), bottom = Y(p.y);
  const shaft = ctx.createLinearGradient(0, top, 0, bottom);
  shaft.addColorStop(0, 'rgba(255,194,61,0)');
  shaft.addColorStop(1, `rgba(255,194,61,${.28 + .14 * pulse})`);
  ctx.fillStyle = shaft;
  ctx.fillRect(sx - c.haloWidth / 2 * S, top, c.haloWidth * S, bottom - top);
  if (!view.lowQ) glow(ctx, '#ffc23d', sx, Y(p.y - 6), (34 + pulse * 8) * S);
}

// Each tick of the ring wears the colour of its place along the stages.
let ringInk = null;
function ringPaint() {
  const c = PREP;
  ringInk = ringInk || Array.from({ length: c.ticks }, (_, i) => {
    const at = i / (c.ticks - 1), k = c.stages.findIndex(s => s[0] >= at), [a, from] = c.stages[Math.max(0, k - 1)], [b, to] = c.stages[k];
    return mixHex(from, to, b > a ? (at - a) / (b - a) : 0);
  });
  return ringInk;
}

// A fine ring of ticks around the aircraft while the shop makes the order, lighting up clockwise from the top over a
// faint sweep of light, so the scene still shows through. Once loaded it stands whole for a moment, spreading as it fades.
export function drawPrep(st) {
  const p = st.prep, c = PREP;
  if (!p && !st.ready) return;
  const S = view.S, x = X(st.d.x), y = Y(st.d.y), fade = p ? 1 : st.ready / c.flash, done = p ? 1 - p.left / p.item.prep : 1, step = Math.PI * 2 / c.ticks, top = -Math.PI / 2;
  const r = Math.max(c.minRadius, (currentModel().span * CONTRAST.scale + c.gap) * S) + (1 - fade) * c.flashGrow * S, w = Math.max(c.minWidth, c.width * S);
  const lit = Math.ceil(done * c.ticks), paint = ringPaint(), head = top + done * c.ticks * step;
  const tick = i => {
    const a = top + i * step;
    ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    ctx.arc(x, y, r, a, a + step * c.tick);
  };
  ctx.save();
  ctx.globalAlpha = fade * c.alpha;
  ctx.fillStyle = c.sweep;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, r, top, head);
  ctx.fill();
  ctx.lineWidth = w + c.edge * 2;
  ctx.strokeStyle = c.backing;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 7);
  ctx.stroke();
  ctx.lineWidth = w;
  ctx.strokeStyle = c.dim;
  ctx.beginPath();
  for (let i = lit; i < c.ticks; i++) tick(i);
  ctx.stroke();
  for (let i = 0; i < lit; i++) {
    ctx.strokeStyle = paint[p ? i : c.ticks - 1];
    ctx.beginPath();
    tick(i);
    ctx.stroke();
  }
  if (p && !view.lowQ) glow(ctx, c.spark, x + Math.cos(head) * r, y + Math.sin(head) * r, c.sparkSize);
  ctx.restore();
  drawPrepNote(st, x, y - r - w / 2 - c.note.gap, fade);
}

// Over the ring, against the open sky: what the shop is doing, and what that means for the player.
function drawPrepNote(st, x, bottom, fade) {
  const c = PREP.note, p = st.prep, nudge = p ? p.nudge / PREP.nudge : 0, name = p?.opening ? 'YOUR ORDER' : p?.item.label.toUpperCase();
  const title = p ? `PREPARING ${name}  ${Math.ceil(p.left)}s` : 'ORDER READY', sub = !p ? '' : p.opening ? 'Takeoff when it is ready' : 'Stay on the pad', h = sub ? c.tall : c.h;
  ctx.save();
  ctx.font = `800 ${c.title}px Tajawal,sans-serif`;
  const titleW = ctx.measureText(title).width;
  ctx.font = `700 ${c.sub}px Tajawal,sans-serif`;
  const w = Math.max(titleW, ctx.measureText(sub).width) + c.padX * 2;
  const cx = Math.max(w / 2 + 6, Math.min(view.W - w / 2 - 6, x)) + Math.sin(st.t * c.rate) * c.shake * nudge, y = Math.max(view.top + c.edge, bottom - h);
  ctx.globalAlpha = fade;
  ctx.fillStyle = c.fill;
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, y, w, h, c.radius);
  ctx.fill();
  if (nudge) {
    ctx.globalAlpha = fade * nudge;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#ffc23d';
    ctx.stroke();
    ctx.globalAlpha = fade;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${c.title}px Tajawal,sans-serif`;
  ctx.fillStyle = p ? '#ffd879' : '#7fe0a8';
  ctx.fillText(title, cx, y + (sub ? c.titleY : h / 2) + 1);
  if (sub) {
    ctx.font = `700 ${c.sub}px Tajawal,sans-serif`;
    ctx.fillStyle = PREP.ink;
    ctx.fillText(sub, cx, y + c.subY);
  }
  ctx.restore();
}

export function drawTarget(st) {
  const o = st.order;
  if (!o || !st.has) return;
  const S = view.S, t = o.t, pulse = .5 + .5 * Math.sin(st.t * 5);
  ctx.save();
  ctx.strokeStyle = `rgba(255,194,61,${.5 + .5 * pulse})`;
  ctx.lineWidth = 3 * S;
  ctx.beginPath();
  ctx.arc(X(t.x), Y(t.y), (20 + pulse * 5) * S, 0, 7);
  ctx.stroke();
  // the second customer of a Double Run waits as a faint ring
  if (o.next) {
    ctx.strokeStyle = 'rgba(255,194,61,.35)';
    ctx.beginPath();
    ctx.arc(X(o.next.t.x), Y(o.next.t.y), 20 * S, 0, 7);
    ctx.stroke();
  }
  // a customer who stepped over leaves a trail from where they stood, fading once the player has had it on screen
  const moved = o.moved, fade = !moved ? 0 : moved.seen == null ? 1 : 1 - (st.t - moved.seen) / SURPRISE.move.flash;
  if (fade > 0) {
    ctx.globalAlpha = fade * .7;
    ctx.setLineDash([6 * S, 6 * S]);
    ctx.lineWidth = 2 * S;
    ctx.strokeStyle = '#ffc23d';
    ctx.beginPath();
    ctx.arc(X(moved.x), Y(moved.y), 20 * S, 0, 7);
    ctx.moveTo(X(moved.x), Y(moved.y));
    ctx.lineTo(X(t.x), Y(t.y));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }
  // the lane of a perfect drop: a tick either side of the customer while the aircraft is over them, gold while the drop
  // would still count as perfect (stepCargo reads it from the physics, not from this blended picture)
  if (!st.level.training && zones(st).hold) {
    const P = PERFECT, q = P.cue;
    ctx.fillStyle = o.calm ? q.gold : q.dim;
    for (const side of [-1, 1]) ctx.fillRect(X(t.x + side * P.centre) - q.width / 2, Y(t.y - q.lift) - q.tick / 2, q.width, q.tick);
  }
  // customer
  const cx = t.kind === 'bal' ? t.x + (t.side > 0 ? -12 : 12) : t.x + 22, cy = t.stand ?? t.y + 11;
  ctx.fillStyle = '#2b1b14';
  ctx.fillRect(X(cx - 4), Y(cy - 24), 8 * S, 16 * S);
  ctx.beginPath();
  ctx.arc(X(cx), Y(cy - 29), 5 * S, 0, 7);
  ctx.fill();
  const wave = Math.sin(st.t * 8) * .5;
  ctx.strokeStyle = '#2b1b14';
  ctx.lineWidth = 2.5 * S;
  ctx.beginPath();
  ctx.moveTo(X(cx), Y(cy - 20));
  ctx.lineTo(X(cx + Math.sin(wave) * 10), Y(cy - 34));
  ctx.stroke();
  if (st.hold > 0) {
    ctx.strokeStyle = '#4fc27c';
    ctx.lineWidth = 4 * S;
    ctx.beginPath();
    ctx.arc(X(t.x), Y(t.y), 30 * S, -Math.PI / 2, -Math.PI / 2 + st.hold / DELIVERY.holdTime * Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

// Soft chevrons by the drone when it is flying away from where it should go.
// A small battery over the aircraft while it runs low, with the way to the closest shop.
// Green while it charges. Sizes are in pixels, so it stays readable on a phone.
export function drawBatteryCue(st) {
  const c = BATTERY, d = st.d, low = st.batWarn > 0, charging = st.charging;
  if (st.wreck || st.outcome || st.done || st.prep || !(low || charging)) return;
  const shop = nearestShop(d.x), gap = shop.x + shop.w / 2 - d.x, dist = Math.round(Math.abs(gap) / 10);
  const col = charging ? '#4fc27c' : st.batWarn > 1 ? '#ff7a5c' : '#ffc23d';
  const text = charging ? `Charging ${Math.ceil(d.bat)}%` : !st.leg && st.charge <= 0 ? 'Battery low' : Math.abs(gap) < c.shopReach ? 'Land here to charge' : gap > 0 ? `Charge at shop ${dist} m ▶` : `◀ Charge at shop ${dist} m`;
  const x = X(d.x), y = Math.max(view.top + 34, Y(d.y) - 30 * view.S - 10), w = 26, h = 12;
  ctx.save();
  ctx.globalAlpha = charging ? 1 : .8 + .2 * Math.sin(st.t * 4);
  ctx.lineWidth = 2;
  ctx.fillStyle = 'rgba(20,15,40,.8)';
  ctx.strokeStyle = col;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h / 2, w, h, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = col;
  ctx.fillRect(x + w / 2 + 1, y - 3, 3, 6);
  ctx.fillRect(x - w / 2 + 2, y - h / 2 + 2, Math.max(2, (w - 4) * d.bat / 100), h - 4);
  ctx.font = '800 13px Tajawal,sans-serif';
  ctx.textAlign = 'center';
  const half = ctx.measureText(text).width / 2 + 6, tx = Math.max(half, Math.min(view.W - half, x));
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(20,15,40,.85)';
  ctx.strokeText(text, tx, y - 14);
  ctx.fillStyle = '#fff3df';
  ctx.fillText(text, tx, y - 14);
  ctx.restore();
}

// The time left on the order and a bar running down with it, quiet over the aircraft and clear of the battery cue.
export function drawOrderTime(st) {
  const c = ORDER_TIME, o = st.order;
  if (!st.has || !o || o.limit === Infinity || st.wreck || st.outcome || st.done) return;
  const left = Math.max(0, o.deadline - st.t), low = left < MISSION.lowTime, cue = st.batWarn > 0 || st.charging;
  const x = Math.max(c.w / 2 + 4, Math.min(view.W - c.w / 2 - 4, X(st.d.x)));
  const y = Math.max(view.top + c.h, Y(st.d.y) - c.lift * view.S - (cue ? c.clearCue : c.gap));
  ctx.save();
  ctx.globalAlpha = low ? c.alpha + (1 - c.alpha) * Math.sin(st.t * c.pulse) : c.alpha;
  ctx.fillStyle = `rgba(20,15,40,${c.fill})`;
  ctx.beginPath();
  ctx.roundRect(x - c.w / 2, y - c.h / 2, c.w, c.h, c.h / 2);
  ctx.fill();
  ctx.font = `800 ${c.text}px Tajawal,sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = low ? '#ff9a84' : '#fff3df';
  ctx.fillText(clockText(left), x, y + c.textY);
  const share = left / o.limit, bar = c.barW * share, barX = x - c.barW / 2, barY = y + c.barY - c.barH / 2;
  ctx.fillStyle = `rgba(255,255,255,${c.track})`;
  ctx.beginPath();
  ctx.roundRect(barX, barY, c.barW, c.barH, c.barH / 2);
  ctx.fill();
  if (bar > 0) {
    ctx.fillStyle = c.stages.filter(([from]) => share >= from).pop()[1];
    ctx.beginPath();
    ctx.roundRect(barX, barY, bar, c.barH, c.barH / 2);
    ctx.fill();
  }
  ctx.restore();
}

// Where the pointer stands this frame, or null while it hides: the dart's spot and heading, its distance pill, and the
// screen boxes [left, top, right, bottom] the two take up, so a label on the screen can keep out of their way.
export function pointerSpot(st) {
  if (st.wreck || st.outcome || st.done || st.prep) return null;
  const { W, S } = view, c = POINTER, g = goal(st), sx = X(g.x), sy = Y(g.y), m = c.safeMargin;
  if (sx > m && sx < W - m && sy > view.top + m && sy < view.bottom - m) return null;
  // right over a customer in sight the handover is under way, and the dart would only cover them
  if (g.label === 'Customer' && sy < view.H && zones(st).hold) return null;
  const dx = X(st.d.x), dy = Y(st.d.y), ang = Math.atan2(sy - dy, sx - dx), z = c.size;
  const reach = st.has ? st.ropeLen + BOX.anchorY + BOX.padX * st.item.size * CARGO.drawScale : currentModel().span * CONTRAST.scale;
  const r = Math.max(c.minOrbit, reach * S + c.clear) + Math.sin(st.t * c.bobRate) * c.bob;
  const px = Math.max(m, Math.min(W - m, dx + Math.cos(ang) * r)), py = Math.max(view.top + m, Math.min(view.bottom - m, dy + Math.sin(ang) * r));
  const text = `${Math.round(Math.hypot(g.x - st.d.x, g.y - st.d.y) / 10)} m`;
  ctx.font = `800 ${c.textSize}px Tajawal,sans-serif`;
  const half = ctx.measureText(text).width / 2 + c.pillPad || 30, under = py + z + c.pillGap + c.pillH, lx = Math.max(half + 4, Math.min(W - half - 4, px));
  const top = under < view.bottom ? under - c.pillH : py - z - c.pillGap - c.pillH;
  // the dart from its tip back to the wings of the last chevron, turned to its heading
  const back = -z - c.chevronGap * c.chevrons - c.chevronSize, cos = Math.cos(ang), sin = Math.sin(ang);
  const ends = [[z * 1.3, 0], [-z * .8, -z * .9], [-z * .8, z * .9], [back, -c.chevronSize], [back, c.chevronSize]].map(([u, v]) => [px + u * cos - v * sin, py + u * sin + v * cos]);
  const xs = ends.map(e => e[0]), ys = ends.map(e => e[1]);
  const boxes = [[Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)], [lx - half, top, lx + half, top + c.pillH]];
  return { px, py, ang, text, lx, top, half, boxes };
}

// A faceted dart circling the aircraft, wide enough to clear its span and the swing of the order on the rope, with
// chevrons running out from behind it toward the goal. It stays near where the player is already looking, so it can
// never slide under the controls or the HUD.
export function drawPointer(st) {
  const p = pointerSpot(st);
  if (!p) return;
  const c = POINTER, { px, py, ang, text, lx, top, half } = p, z = c.size, [light, deep] = st.has ? c.customer : c.shop;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(ang);
  ctx.lineCap = ctx.lineJoin = 'round';
  ctx.strokeStyle = light;
  ctx.lineWidth = c.chevronWidth;
  for (let i = 0; i < c.chevrons; i++) {
    const x = -z - c.chevronGap * (i + 1), wave = 1 - ((st.t * c.flow + i / c.chevrons) % 1);
    ctx.globalAlpha = c.alpha * wave;
    ctx.beginPath();
    ctx.moveTo(x - c.chevronSize, -c.chevronSize);
    ctx.lineTo(x, 0);
    ctx.lineTo(x - c.chevronSize, c.chevronSize);
    ctx.stroke();
  }
  ctx.globalAlpha = c.alpha;
  const dart = () => {
    ctx.beginPath();
    ctx.moveTo(z * 1.3, 0);
    ctx.lineTo(-z * .8, -z * .9);
    ctx.lineTo(-z * .35, 0);
    ctx.lineTo(-z * .8, z * .9);
    ctx.closePath();
  };
  dart();
  ctx.lineWidth = c.rim + 2;
  ctx.strokeStyle = c.shade;
  ctx.stroke();
  ctx.fillStyle = deep;
  ctx.fill();
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.moveTo(z * 1.3, 0);
  ctx.lineTo(-z * .8, -z * .9);
  ctx.lineTo(-z * .35, 0);
  ctx.closePath();
  ctx.fill();
  dart();
  ctx.lineWidth = c.rim;
  ctx.strokeStyle = c.edge;
  ctx.stroke();
  ctx.restore();
  ctx.font = `800 ${c.textSize}px Tajawal,sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = c.pill;
  ctx.beginPath();
  ctx.roundRect(lx - half, top, half * 2, c.pillH, c.pillH / 2);
  ctx.fill();
  ctx.fillStyle = '#fff3df';
  ctx.fillText(text, lx, top + c.pillH / 2 + 1);
  ctx.textBaseline = 'alphabetic';
}
