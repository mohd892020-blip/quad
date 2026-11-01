import { clearAction, planMission } from './action.js';
import { sfx } from './audio.js';
import {
  AIRCRAFT, CAMERA, DELIVERY, DEV, DRONE, HANGAR, HEADING, HEALTH, ITEMS, LEVELS, MISSION, ORDERS, POINTER, RESTAURANT, RIVAL, ROPE, ROPE_CTL, WIND,
} from './config.js';
import { loadProgress, saveProgress, settings } from './storage.js';
import { addMark, blast, ctx, glow, hud, pop, puff, showToast, view, X, Y } from './ui.js';
import { nearby, nearestShop, shopPad, world } from './world.js';

let current = null;
export const currentShift = () => current;

// A level starts on its shop's pad; free roam starts at the first shop.
export function newGame(level = null) {
  const shop = level ? level.shop : world.shops[0], p = shopPad(shop), saved = loadProgress();
  const st = {
    t: 0, money: saved.money, del: saved.del, level, tier: level ? level.tier : saved.del, outcome: null, done: false, cam: { x: p.x - view.viewW * CAMERA.leadX, y: 0 },
    d: { x: p.x, y: p.y - DRONE.radius, vx: 0, vy: 0, a: 0, bat: 100 },
    box: { x: p.x, y: p.y, px: p.x, py: p.y },
    has: false, heat: 100, integ: 100, order: null, item: null, hold: 0, readyAt: 0,
    wind: 0, windT: 0, windNext: WIND.firstAt, pops: [], parts: [], shake: 0, acc: 0,
    dust: [], dustN: 0, onGround: true, ropeLen: ROPE, anchor: null, wrong: 0,
    boost: 100, boosting: false, boostDir: 1, boostWait: 0, hawks: [], rival: null, prep: null,
    hp: 100, wreck: 0, lastHit: null, smokeDue: 0, marks: [], smoke: [], blasts: [],
  };
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

const pickItem = shop => {
  const items = shop.shop.items;
  return ITEMS[items[(Math.random() * items.length) | 0]];
};

export function startMission(st, shop, item = pickItem(shop)) {
  const pool = st.level ? null : targetsFor(shop, st.tier);
  const t = st.level ? st.level.t : pool[(Math.random() * pool.length) | 0];
  const p = shopPad(shop), limit = timeLimit(item, Math.abs(t.x - st.d.x));
  st.item = item;
  st.order = { t, shop, start: st.t, deadline: st.t + limit, limit };
  st.heat = 100;
  st.integ = 100;
  st.has = true;
  st.ropeLen = ROPE;
  st.box.x = st.box.px = st.d.x + RESTAURANT.boxOffsetX;
  st.box.y = st.box.py = p.y - RESTAURANT.boxLift;
  planMission(st, shop);
  sfx('pickup');
  hud(st);
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
function finish(st, outcome) {
  st.outcome = { ...outcome, at: st.t + LEVELS.resultDelay };
}

// charged: the player wrecked the goods, so they pay the shop for them.
export function failMission(st, why, charged = false) {
  const cost = charged && st.item ? Math.min(st.money, st.item.price) : 0;
  st.money -= cost;
  endMission(st);
  if (cost) saveProgress(st.del, st.money);
  if (st.level) finish(st, { passed: false, why, cost });
  else showToast('MISSION FAILED', cost ? `${why} · -$${cost}` : why, false);
  hud(st);
}

function passMission(st) {
  const c = DELIVERY, o = st.order, item = st.item, secs = st.t - o.start;
  const base = c.tipBase + st.heat * c.tipHeat + st.integ * c.tipBox + (secs < c.tipFastSecs ? c.tipFastBonus : secs < c.tipOkSecs ? c.tipOkBonus : 0);
  const beat = st.rival ? RIVAL.bonus : 0;
  const tip = Math.round(item.urgent ? base * c.urgentTip : base) + beat;
  const fresh = item.heat ? st.heat > c.starHeat : secs / o.limit < c.starTimeShare;
  const stars = 1 + (st.integ > c.starBox ? 1 : 0) + (fresh ? 1 : 0);
  st.money += tip;
  st.del++;
  if (!st.level) st.tier = st.del;
  endMission(st);
  pop(st, o.t.x, o.t.y - 50, `+$${tip}`, '#ffc23d');
  sfx('deliver');
  saveProgress(st.del, st.money, st.level?.n, stars);
  if (st.level) finish(st, { passed: true, stars, tip, beat });
  else showToast('MISSION PASSED', beat ? `+$${tip} · Rival beaten` : `+$${tip}`, true);
  hud(st);
}

export const missionLeft = st => Math.max(0, st.order.deadline - st.t);

// Landing on a green pad orders a job; the shop needs the item's prep time to make it,
// and taking off first cancels the order. A running job ends on time or power.
export function stepMission(st, dt) {
  const d = st.d, c = MISSION;
  if (st.has) {
    if (st.t >= st.order.deadline) failMission(st, "Time's up");
    else if (d.bat <= 0) failMission(st, 'Battery dead');
    return;
  }
  if (st.level && (st.outcome || st.done)) {
    st.prep = null;
    return;
  }
  const shop = st.level ? st.level.shop : nearestShop(d.x), p = shopPad(shop);
  const parked = Math.abs(d.x - p.x) < c.padReach && d.y < p.y && d.y > p.y - DRONE.radius - c.padGap && Math.hypot(d.vx, d.vy) < c.padSpeed;
  if (!parked || st.t < st.readyAt) {
    st.prep = null;
    return;
  }
  if (!st.prep) {
    const item = st.level ? st.level.item : pickItem(shop);
    st.prep = { shop, item, left: item.prep };
    hud(st);
  }
  st.prep.left -= dt;
  if (st.prep.left <= 0) {
    const { item } = st.prep;
    st.prep = null;
    startMission(st, shop, item);
  }
}

// While the shop works, it may suggest an aircraft that suits the order better.
export function hangarHint(st) {
  const p = st.prep;
  if (!p) return null;
  const c = HANGAR, item = p.item, named = key => AIRCRAFT.find(a => a.key === key);
  const pick = item.weight >= c.heavyFrom ? ['heavy', `Heavy load: try ${named('heavy').name}`]
    : item.fragile >= c.fragileFrom ? ['cage', `Fragile order: try ${named('cage').name}`]
    : item.urgent ? ['fpv', `Urgent: try ${named('fpv').name}`]
    : item.wind >= c.windyFrom ? ['hexa', `Catches the wind: try ${named('hexa').name}`]
    : null;
  if (pick) return pick[0] === settings.plane ? null : pick[1];
  if (st.del % c.rotate !== 0) return null;
  const next = AIRCRAFT[(st.del / c.rotate + 1) % AIRCRAFT.length];
  return next.key === settings.plane ? null : `Try the ${next.name}`;
}

const NO_ZONE = { rope: false, hold: false };

// Where rope and hold controls apply: rope right above the customer, hold over a wider area.
export function zones(st) {
  if (!st.has || !st.order) return NO_ZONE;
  const c = ROPE_CTL, T = st.order.t, dx = Math.abs(T.x - st.d.x), dy = T.y - st.d.y;
  return {
    rope: dx < c.zoneX && dy > 0 && dy < c.zoneY,
    hold: dx < c.holdX && dy > -c.holdAbove && dy < c.holdY,
  };
}

// Where the player should be heading: the customer, or the closest job.
function goal(st) {
  if (st.has && st.order) return { x: st.order.t.x, y: st.order.t.y, label: 'Customer' };
  const shop = st.level ? st.level.shop : nearestShop(st.d.x), p = shopPad(shop);
  return { x: p.x, y: p.y - 20, label: shop.shop.name };
}

export function stepHeading(st, dt) {
  const c = HEADING, g = goal(st), gap = g.x - st.d.x;
  const astray = Math.abs(gap) > c.minDist && st.d.vx * Math.sign(gap) < -c.minSpeed;
  st.wrong += ((astray ? 1 : 0) - st.wrong) * Math.min(1, dt * c.fade);
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
  const T = st.order.t, reach = st.anchor ? c.holdReach : c.reach;
  if (Math.hypot(bx.x - T.x, bx.y - T.y) < reach && Math.hypot(d.vx, d.vy) < c.maxDroneSpeed) {
    st.hold += dt;
    if (st.hold > c.holdTime) passMission(st);
  } else st.hold = Math.max(0, st.hold - dt * c.holdDecay);
}

function carryToShop(st, shop) {
  const d = st.d, p = shopPad(shop);
  d.x = p.x;
  d.y = p.y - DRONE.radius;
  d.vx = d.vy = d.a = 0;
  d.bat = 100;
  st.hp = 100;
  st.anchor = null;
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
  d.vx = d.vy = 0;
  sfx('boom');
  if (st.has) failMission(st, 'Aircraft destroyed', true);
  else if (st.level) failMission(st, 'Aircraft destroyed');
  else showToast('MISSION FAILED', 'Aircraft destroyed', false);
}

// Smoke, then fire that burns on until the drone is repaired or explodes.
export function stepHealth(st, dt) {
  const c = HEALTH, d = st.d;
  if (st.wreck) {
    st.wreck = Math.max(0, st.wreck - dt);
    if (!st.wreck) carryToShop(st, nearestShop(d.x));
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

// Any shop roof charges and repairs. A dead drone on the ground with no job is carried to the closest shop.
export function stepShop(st, grounded, dt) {
  const d = st.d, c = RESTAURANT, shop = nearestShop(d.x);
  if (grounded && Math.abs(d.x - (shop.x + shop.w / 2)) < shop.w / 2 && d.y < shop.top && d.y > shop.top - c.padHeight) {
    d.bat = Math.min(100, d.bat + dt * c.chargeRate);
    st.hp = Math.min(100, st.hp + dt * HEALTH.repairRate);
    return;
  }
  if (d.bat <= 0 && grounded && !st.has) {
    carryToShop(st, shop);
  }
}

/* ---------- render ---------- */
// The soft column of light standing on each green pad while a job is free.
export function drawHalos(st) {
  if (st.has) return;
  const { W, S } = view, c = MISSION, pulse = .5 + .5 * Math.sin(st.t * 4);
  if (st.level && (st.outcome || st.done)) return;
  for (const shop of st.level ? [st.level.shop] : world.shops) {
    const p = shopPad(shop), sx = X(p.x);
    if (sx < -80 || sx > W + 80) continue;
    const top = Y(p.y - c.haloHeight), bottom = Y(p.y);
    const shaft = ctx.createLinearGradient(0, top, 0, bottom);
    shaft.addColorStop(0, 'rgba(255,194,61,0)');
    shaft.addColorStop(1, `rgba(255,194,61,${.28 + .14 * pulse})`);
    ctx.fillStyle = shaft;
    ctx.fillRect(sx - c.haloWidth / 2 * S, top, c.haloWidth * S, bottom - top);
    if (!view.lowQ) glow(ctx, '#ffc23d', sx, Y(p.y - 6), (34 + pulse * 8) * S);
  }
}

// The same ring as the delivery bar, filling while the shop makes the order.
export function drawPrep(st) {
  const p = st.prep;
  if (!p) return;
  const S = view.S, x = X(st.d.x), y = Y(st.d.y), done = 1 - p.left / p.item.prep;
  ctx.lineWidth = 4 * S;
  ctx.strokeStyle = 'rgba(255,255,255,.25)';
  ctx.beginPath();
  ctx.arc(x, y, 30 * S, 0, 7);
  ctx.stroke();
  ctx.strokeStyle = '#4fc27c';
  ctx.beginPath();
  ctx.arc(x, y, 30 * S, -Math.PI / 2, -Math.PI / 2 + done * Math.PI * 2);
  ctx.stroke();
  const text = `Preparing ${p.item.label}`;
  ctx.font = `${Math.round(16 * S)}px Lalezar,Tajawal,sans-serif`;
  ctx.textAlign = 'center';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(20,15,40,.8)';
  ctx.strokeText(text, x, y - 40 * S);
  ctx.fillStyle = '#fff3df';
  ctx.fillText(text, x, y - 40 * S);
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
export function drawHeading(st) {
  if (st.wrong < .03) return;
  const c = HEADING, S = view.S, g = goal(st), dir = Math.sign(g.x - st.d.x), y = Y(st.d.y);
  ctx.lineWidth = 3 * S;
  ctx.lineCap = 'round';
  for (let i = 0; i < c.chevrons; i++) {
    const x = X(st.d.x + dir * (c.offset + i * c.gap));
    ctx.strokeStyle = `rgba(255,243,223,${st.wrong * (.3 + .35 * (.5 + .5 * Math.sin(st.t * 6 - i)))})`;
    ctx.beginPath();
    ctx.moveTo(x - dir * 5 * S, y - 7 * S);
    ctx.lineTo(x + dir * 3 * S, y);
    ctx.lineTo(x - dir * 5 * S, y + 7 * S);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
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
  ctx.translate(px, py);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(z, 0);
  ctx.lineTo(-z * .7, -z * .75);
  ctx.lineTo(-z * .3, 0);
  ctx.lineTo(-z * .7, z * .75);
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 7;
  ctx.strokeStyle = 'rgba(20,15,40,.9)';
  ctx.stroke();
  ctx.fillStyle = st.has ? '#ffc23d' : '#4fc27c';
  ctx.fill();
  ctx.restore();
  const dist = Math.round(Math.hypot(g.x - st.d.x, g.y - st.d.y) / 10);
  const text = `${g.label} · ${dist} m`;
  ctx.font = '800 15px Tajawal,sans-serif';
  ctx.textAlign = 'center';
  const tw = ctx.measureText(text).width / 2 + 8 || 60;
  const lx = Math.max(tw, Math.min(W - tw, px)), ly = clampY(py + (py > dy ? 34 : -28));
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(20,15,40,.9)';
  ctx.strokeText(text, lx, ly);
  ctx.fillStyle = '#fff3df';
  ctx.fillText(text, lx, ly);
}
