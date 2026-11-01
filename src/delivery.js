import { clearAction, planMission } from './action.js';
import { sfx } from './audio.js';
import {
  BOX, CAMERA, CITY_SEED, DELIVERY, DEV, DRONE, HEADING, ITEMS, MISSION, ORDERS, RESTAURANT, RINGS, RIVAL, ROPE, ROPE_CTL, WIND,
} from './config.js';
import { loadProgress, saveProgress } from './storage.js';
import { ctx, glow, hud, pop, showToast, view, X, Y } from './ui.js';
import { genWorld, nearestShop, setTime, shopBeacon, shopPad, world } from './world.js';

let current = null;
export const currentShift = () => current;

export function newGame() {
  genWorld(CITY_SEED);
  const shop = world.shops[0], p = shopPad(shop), saved = loadProgress();
  const st = {
    t: 0, money: saved.money, del: saved.del, cam: { x: p.x - view.viewW * CAMERA.leadX, y: 0 },
    d: { x: p.x, y: p.y - DRONE.radius, vx: 0, vy: 0, a: 0, bat: 100 },
    box: { x: p.x, y: p.y, px: p.x, py: p.y },
    has: false, heat: 100, integ: 100, order: null, item: null, hold: 0, readyAt: 0,
    wind: 0, windT: 0, windNext: WIND.firstAt, pops: [], parts: [], shake: 0, acc: 0,
    dust: [], dustN: 0, onGround: true, ropeLen: ROPE, anchor: null, wrong: 0,
    boost: 100, boosting: false, boostDir: 1, boostWait: 0, combo: 0, rings: [], ringsHit: 0, hawks: [], rival: null, lastX: p.x,
  };
  current = st;
  return st;
}

const canServe = (t, del) => t.kind === 'roof' || (t.kind === 'bal' ? del >= MISSION.balconyFrom : del >= MISSION.streetFrom);

function pickTarget(st, shop) {
  const d = st.del;
  const near = ORDERS.minDist + Math.min(d, ORDERS.maxSteps) * ORDERS.stepDist;
  const far = near + ORDERS.span + d * ORDERS.spanPerDelivery;
  const shopX = shop.x + shop.w / 2;
  const open = world.targets.filter(t => t.b !== shop && canServe(t, d));
  let pool = open.filter(t => {
    const gap = Math.abs(t.x - shopX);
    return gap > near && gap < far;
  });
  if (!pool.length) pool = open;
  return pool[(Math.random() * pool.length) | 0];
}

export function startMission(st, shop) {
  const m = MISSION, t = pickTarget(st, shop), items = shop.shop.items;
  const item = ITEMS[items[(Math.random() * items.length) | 0]];
  const dist = Math.abs(t.x - st.d.x);
  let limit = m.baseTime + dist / m.speed + Math.max(0, item.weight - 1) * m.heavyTime;
  if (item.urgent) limit *= m.urgentTime;
  st.item = item;
  st.order = { t, shop, start: st.t, deadline: st.t + limit, limit };
  st.heat = 100;
  st.integ = 100;
  st.has = true;
  st.ropeLen = ROPE;
  st.box.x = st.box.px = st.d.x;
  st.box.y = st.box.py = st.d.y + BOX.anchorY + ROPE;
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

export function failMission(st, why) {
  st.combo = 0;
  endMission(st);
  showToast('MISSION FAILED', why, false);
  hud(st);
}

function passMission(st) {
  const c = DELIVERY, o = st.order, secs = st.t - o.start;
  const base = c.tipBase + st.heat * c.tipHeat + st.integ * c.tipBox + (secs < c.tipFastSecs ? c.tipFastBonus : secs < c.tipOkSecs ? c.tipOkBonus : 0);
  const beat = st.rival ? RIVAL.bonus : 0;
  const tip = Math.round(st.item.urgent ? base * c.urgentTip : base) + st.ringsHit * RINGS.tipEach + beat;
  st.money += tip;
  st.del++;
  endMission(st);
  showToast('MISSION PASSED', beat ? `+$${tip} · Rival beaten` : `+$${tip}`, true);
  pop(st, o.t.x, o.t.y - 50, `+$${tip}`, '#ffc23d');
  sfx('deliver');
  setTime(world.time + 1);
  saveProgress(st.del, st.money);
  hud(st);
}

export const missionLeft = st => Math.max(0, st.order.deadline - st.t);

// Starts a job on entering a beacon, and ends one that has run out of time or power.
export function stepMission(st) {
  const d = st.d;
  if (st.has) {
    if (st.t >= st.order.deadline) failMission(st, "Time's up");
    else if (d.bat <= 0) failMission(st, 'Battery dead');
    return;
  }
  if (st.t < st.readyAt) return;
  const shop = nearestShop(d.x), b = shopBeacon(shop);
  if (Math.hypot(d.x - b.x, d.y - b.y) < MISSION.beaconRadius) startMission(st, shop);
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
  const shop = nearestShop(st.d.x), b = shopBeacon(shop);
  return { x: b.x, y: b.y, label: shop.shop.name };
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
  if (st) st.d.bat = DEV.chargeTo;
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
    failMission(st, 'Order ruined');
    return;
  }
  const T = st.order.t, reach = st.anchor ? c.holdReach : c.reach;
  if (Math.hypot(bx.x - T.x, bx.y - T.y) < reach && Math.hypot(d.vx, d.vy) < c.maxDroneSpeed) {
    st.hold += dt;
    if (st.hold > c.holdTime) passMission(st);
  } else st.hold = Math.max(0, st.hold - dt * c.holdDecay);
}

// Any shop roof charges. A dead drone on the ground with no job is carried to the closest shop.
export function stepShop(st, grounded, dt) {
  const d = st.d, c = RESTAURANT, shop = nearestShop(d.x);
  if (grounded && Math.abs(d.x - (shop.x + shop.w / 2)) < shop.w / 2 && d.y < shop.top && d.y > shop.top - c.padHeight) {
    d.bat = Math.min(100, d.bat + dt * c.chargeRate);
    return;
  }
  if (d.bat <= 0 && grounded && !st.has) {
    const p = shopPad(shop);
    d.x = p.x;
    d.y = p.y - DRONE.radius;
    d.vx = d.vy = d.a = 0;
    d.bat = 100;
    st.prev = null;
    st.cam.x = d.x - view.viewW * CAMERA.leadX;
    showToast('Back at the shop', `${shop.shop.name} recharged you`, true);
  }
}

/* ---------- render ---------- */
export function drawBeacons(st) {
  if (st.has || st.t < st.readyAt) return;
  const { W, S } = view, pulse = .5 + .5 * Math.sin(st.t * 4);
  for (const shop of world.shops) {
    const b = shopBeacon(shop), sx = X(b.x);
    if (sx < -80 || sx > W + 80) continue;
    const r = MISSION.beaconRadius;
    const shaft = ctx.createLinearGradient(0, Y(b.y - 240), 0, Y(shop.top));
    shaft.addColorStop(0, 'rgba(255,194,61,0)');
    shaft.addColorStop(1, `rgba(255,194,61,${.28 + .14 * pulse})`);
    ctx.fillStyle = shaft;
    ctx.fillRect(sx - r * .55 * S, Y(b.y - 240), r * 1.1 * S, (240 + shop.top - b.y) * S);
    ctx.strokeStyle = `rgba(255,194,61,${.55 + .45 * pulse})`;
    ctx.lineWidth = 3 * S;
    ctx.beginPath();
    ctx.ellipse(sx, Y(b.y), (r - 6 + pulse * 6) * S, (r - 6 + pulse * 6) * S, 0, 0, 7);
    ctx.stroke();
    if (!view.lowQ) glow(ctx, '#ffc23d', sx, Y(b.y), r * .9 * S);
  }
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

export function drawPointer(st) {
  const { W, H } = view;
  const { x: tx, y: ty, label } = goal(st);
  const sx = X(tx), sy = Y(ty), m = 56;
  if (sx > m && sx < W - m && sy > 140 && sy < H - m) return;
  const cx = W / 2, cy = H / 2, ang = Math.atan2(sy - cy, sx - cx);
  const px = Math.max(m, Math.min(W - m, sx)), py = Math.max(150, Math.min(H - 120, sy));
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(ang);
  ctx.fillStyle = st.has ? '#ffc23d' : '#4fc27c';
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-8, -11);
  ctx.lineTo(-8, 11);
  ctx.fill();
  ctx.restore();
  const dist = Math.round(Math.hypot(tx - st.d.x, ty - st.d.y) / 10);
  const text = `${label} · ${dist} m`, tx2 = Math.max(70, Math.min(W - 70, px)), ty2 = py + (py > H / 2 ? -22 : 30);
  ctx.font = '700 13px Tajawal,sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(20,15,40,.8)';
  ctx.strokeText(text, tx2, ty2);
  ctx.fillStyle = '#fff3df';
  ctx.fillText(text, tx2, ty2);
}

