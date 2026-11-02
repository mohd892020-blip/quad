import { clearAction, planMission, planTraffic } from './action.js';
import { sfx } from './audio.js';
import { standout } from './contrast.js';
import {
  AIRCRAFT, BATTERY, CAMERA, CONTRAST, DELIVERY, DEV, DOUBLE, DRONE, FIXED_DT, FX, HANGAR, HEALTH, LAND, LEVELS, MISSION, ORDER_TIME, ORDERS, POINTER, PREP, RESTAURANT, RIVAL, ROPE, ROPE_CTL, WIND,
} from './config.js';
import { currentModel } from './drone.js';
import { loadProgress, owns, saveProgress, settings } from './storage.js';
import { addMark, blast, clockText, ctx, glow, hud, placeName, pop, puff, showToast, view, X, Y } from './ui.js';
import { mixHex, nearby, nearestShop, shopPad, world } from './world.js';

let current = null;
export const currentShift = () => current;

// A level starts on its shop's pad.
export function newGame(level) {
  const shop = level.shop, p = shopPad(shop), saved = loadProgress();
  const st = {
    t: 0, money: saved.money, del: saved.del, level, tier: level.tier, stop: level.stops[0], stopAt: 0, earned: { stars: 3, tip: 0, beat: 0 }, outcome: null, done: false, cam: { x: p.x - view.viewW * CAMERA.leadX, y: 0 },
    d: { x: p.x, y: p.y - DRONE.radius, vx: 0, vy: 0, a: 0, bat: level.startBat ?? 100 },
    box: { x: p.x, y: p.y, px: p.x, py: p.y },
    has: false, heat: 100, integ: 100, order: null, item: null, hold: 0, readyAt: 0,
    wind: 0, windT: 0, windNext: WIND.firstAt, pops: [], parts: [], shake: 0, acc: 0,
    dust: [], dustN: 0, onGround: true, ropeLen: level.rope ?? ROPE, anchor: null,
    boost: 100, boosting: false, boostDir: 1, boostWait: 0, hawks: [], rival: null, prep: null,
    hp: 100, wreck: 0, lastHit: null, smokeDue: 0, marks: [], smoke: [], blasts: [], batWarn: 0, charging: false, ready: 0,
    leg: { t: 0, x: p.x }, charge: 0, standout: standout(),
  };
  planTraffic(st);
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
  st.order = { t, shop, start: st.t, deadline: st.t + limit, limit, drop: parcels ? 1 : 0, next: parcels ? parcels[1] : null };
  st.heat = 100;
  st.integ = 100;
  st.has = true;
  st.leg = { t: st.t, x: st.d.x };
  st.ropeLen = st.level.rope ?? ROPE;
  st.box.x = st.box.px = st.d.x + RESTAURANT.boxOffsetX;
  st.box.y = st.box.py = p.y - RESTAURANT.boxLift;
  planMission(st, shop);
  sfx('pickup');
  if (parcels) showToast('Double Run', `${parcels[0].item.label} first, then ${parcels[1].item.label}`, true);
  hud(st);
}

// A level opens on the pad with the shop starting on its first order, which takes the item's own prep time.
export function prepareFirstOrder(st) {
  const { shop, item } = st.stop;
  st.prep = { shop, item, left: item.prep };
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
  st.money -= cost;
  endMission(st);
  if (cost) saveProgress(st.del, st.money);
  if (training) showToast('Try again', reason, false);
  else finish(st, { passed: false, why: reason, cost });
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
  st.hold = 0;
  st.d.vy -= c.kick;
  st.box.py = st.box.y + c.boxKick * FIXED_DT;
  showToast('First drop done', `Next: ${item.label} to ${placeName(t)}`, true);
}

function passMission(st) {
  if (st.level.training) {
    cheer(st, st.order.t);
    endMission(st);
    sfx('deliver');
    finish(st, { passed: true, training: true });
    hud(st);
    return;
  }
  const c = DELIVERY, o = st.order, item = st.item, secs = st.t - o.start;
  const base = c.tipBase + st.heat * c.tipHeat + st.integ * c.tipBox + (secs < c.tipFastSecs ? c.tipFastBonus : secs < c.tipOkSecs ? c.tipOkBonus : 0);
  const beat = st.rival ? RIVAL.bonus : 0;
  const tip = Math.round(item.urgent ? base * c.urgentTip : base) + beat;
  const fresh = item.heat && !item.spoils ? st.heat > c.starHeat : secs / o.limit < c.starTimeShare;
  const stars = 1 + (st.integ > c.starBox ? 1 : 0) + (fresh ? 1 : 0);
  const made = st.earned, next = st.level.stops[st.stopAt + 1];
  made.stars = Math.min(made.stars, stars);
  made.tip += tip;
  made.beat += beat;
  st.money += tip;
  st.del++;
  pop(st, o.t.x, o.t.y - c.popLift, `+$${tip}`, '#ffc23d');
  sfx('deliver');
  if (o.next) {
    dropLower(st);
    saveProgress(st.del, st.money);
    hud(st);
    return;
  }
  if (st.leg) st.leg.via = o.t.x;
  endMission(st);
  if (next) {
    showToast(`Stop ${++st.stopAt} done`, `Next: ${next.item.label} at ${next.shop.shop.name}`, true);
    st.stop = next;
    saveProgress(st.del, st.money);
  } else {
    saveProgress(st.del, st.money, st.level.n, made.stars);
    cheer(st, o.t);
    finish(st, { passed: true, ...made });
  }
  hud(st);
}

// Landing on a green pad orders a job; the shop needs the item's prep time to make it,
// and taking off first cancels the order. A running job ends on time or power.
export function stepMission(st, dt) {
  const d = st.d, c = MISSION;
  st.ready = Math.max(0, st.ready - dt);
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
  if (!parked || st.t < st.readyAt) {
    st.prep = null;
    return;
  }
  if (!st.prep) {
    const { item } = st.stop;
    st.prep = { shop, item, left: item.prep };
    hud(st);
  }
  st.prep.left -= dt;
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
  const c = HANGAR, named = key => AIRCRAFT.find(a => a.key === key);
  const pick = item.weight >= c.heavyFrom ? ['heavy', `Heavy load: try ${named('heavy').name}`]
    : item.fragile >= c.fragileFrom ? ['cage', `Fragile order: try ${named('cage').name}`]
    : item.urgent ? ['fpv', `Urgent: try ${named('fpv').name}`]
    : item.wind >= c.windyFrom ? ['hexa', `Catches the wind: try ${named('hexa').name}`]
    : null;
  if (pick) return pick[0] === settings.plane ? null : owns(pick[0]) ? pick[1] : `${pick[1]} from the Shop`;
  if (st.del % c.rotate !== 0) return null;
  const next = AIRCRAFT[(st.del / c.rotate + 1) % AIRCRAFT.length];
  return next.key === settings.plane || !owns(next.key) ? null : `Try the ${next.name}`;
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
function goal(st) {
  if (st.lesson?.goal) return st.lesson.goal;
  if (st.has && st.order) return { x: st.order.t.x, y: st.order.t.y, label: 'Customer' };
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
  const T = st.order.t, reach = st.anchor ? c.holdReach : c.reach;
  if (Math.hypot(bx.x - T.x, bx.y - T.y) < reach && Math.hypot(d.vx, d.vy) < c.maxDroneSpeed) {
    st.hold += dt;
    if (st.hold > c.holdTime) passMission(st);
  } else st.hold = Math.max(0, st.hold - dt * c.holdDecay);
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

function explode(st) {
  const c = HEALTH, d = st.d, hit = st.lastHit;
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

// Each slice of the ring wears the colour of its place along the stages.
let ringInk = null;
function ringPaint() {
  const c = PREP;
  ringInk = ringInk || Array.from({ length: c.slices }, (_, i) => {
    const at = i / (c.slices - 1), k = c.stages.findIndex(s => s[0] >= at), [a, from] = c.stages[Math.max(0, k - 1)], [b, to] = c.stages[k];
    return mixHex(from, to, b > a ? (at - a) / (b - a) : 0);
  });
  return ringInk;
}

// The ring filling around the aircraft while the shop makes the order. Once loaded it stands whole for a moment, spreading as it fades.
export function drawPrep(st) {
  const p = st.prep, c = PREP;
  if (!p && !st.ready) return;
  const S = view.S, x = X(st.d.x), y = Y(st.d.y), fade = p ? 1 : st.ready / c.flash, done = p ? 1 - p.left / p.item.prep : 1, turn = Math.PI * 2, top = -Math.PI / 2;
  const r = Math.max(c.minRadius, (currentModel().span * CONTRAST.scale + c.gap) * S) + (1 - fade) * c.flashGrow * S, w = Math.max(c.minWidth, c.width * S);
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.lineWidth = w + c.edge * 2;
  ctx.strokeStyle = c.track;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 7);
  ctx.stroke();
  ctx.lineWidth = w;
  if (p) {
    const paint = ringPaint(), end = top + done * turn;
    for (let i = 0; i < c.slices && i / c.slices < done; i++) {
      ctx.strokeStyle = paint[i];
      ctx.beginPath();
      ctx.arc(x, y, r, top + i / c.slices * turn, Math.min(end, top + (i + 1) / c.slices * turn + c.lap));
      ctx.stroke();
    }
    ctx.fillStyle = c.ink;
    ctx.beginPath();
    ctx.arc(x + Math.cos(end) * r, y + Math.sin(end) * r, w * .62, 0, 7);
    ctx.fill();
  } else {
    ctx.strokeStyle = c.stages[c.stages.length - 1][1];
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 7);
    ctx.stroke();
  }
  const text = p ? `${Math.ceil(p.left)}s` : 'Ready', ty = Math.max(view.top + c.text, y - r - w / 2 - c.textGap);
  ctx.font = `800 ${c.text}px Tajawal,sans-serif`;
  ctx.textAlign = 'center';
  ctx.lineWidth = 3;
  ctx.strokeStyle = c.track;
  ctx.strokeText(text, x, ty);
  ctx.fillStyle = c.ink;
  ctx.fillText(text, x, ty);
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
  // customer
  const cx = t.kind === 'bal' ? t.x + (t.side > 0 ? -12 : 12) : t.x + 22, cy = t.y + 11;
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

// A bold arrow circling the drone. It stays close to where the player is already
// looking, so it can never slide under the controls or the HUD.
export function drawPointer(st) {
  if (st.wreck || st.outcome || st.done) return;
  const { W, S } = view, c = POINTER, g = goal(st), sx = X(g.x), sy = Y(g.y), m = c.safeMargin;
  if (sx > m && sx < W - m && sy > view.top + m && sy < view.bottom - m) return;
  const dx = X(st.d.x), dy = Y(st.d.y), ang = Math.atan2(sy - dy, sx - dx);
  const r = Math.max(c.orbit * S, c.orbit * .8) + Math.sin(st.t * 5) * c.bob;
  const clampY = y => Math.max(view.top + m, Math.min(view.bottom - m, y));
  const px = Math.max(m, Math.min(W - m, dx + Math.cos(ang) * r)), py = clampY(dy + Math.sin(ang) * r);
  const z = c.size;
  ctx.save();
  ctx.globalAlpha = c.alpha;
  ctx.translate(px, py);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(z, 0);
  ctx.lineTo(-z * .7, -z * .75);
  ctx.lineTo(-z * .3, 0);
  ctx.lineTo(-z * .7, z * .75);
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.lineWidth = c.line;
  ctx.strokeStyle = 'rgba(20,15,40,.6)';
  ctx.stroke();
  ctx.fillStyle = st.has ? '#ffc23d' : '#4fc27c';
  ctx.fill();
  ctx.restore();
  const text = `${Math.round(Math.hypot(g.x - st.d.x, g.y - st.d.y) / 10)} m`;
  ctx.font = `800 ${c.textSize}px Tajawal,sans-serif`;
  ctx.textAlign = 'center';
  const tw = ctx.measureText(text).width / 2 + 8 || 30;
  const lx = Math.max(tw, Math.min(W - tw, px)), ly = clampY(py + (py > dy ? 1 : -1) * (z + c.textSize));
  ctx.globalAlpha = c.alpha;
  ctx.lineWidth = c.line;
  ctx.strokeStyle = 'rgba(20,15,40,.7)';
  ctx.strokeText(text, lx, ly);
  ctx.fillStyle = '#fff3df';
  ctx.fillText(text, lx, ly);
  ctx.globalAlpha = 1;
}
