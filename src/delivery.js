import { sfx } from './audio.js';
import { BOX, CAMERA, DELIVERY, DEV, DRONE, HEADING, ITEMS, ORDERS, RESTAURANT, ROPE, ROPE_CTL, SHIFT, WIND } from './config.js';
import { ctx, pop, view, X, Y } from './ui.js';
import { genWorld, nearestShop, setTime, shopPad, world } from './world.js';

// The shift running right now; the delayed hint after a delivery lands on this one.
let current = null;
export const currentShift = () => current;

export function newGame() {
  genWorld((Math.random() * 1e9) | 0);
  const shop = world.shops[0], p = shopPad(shop);
  const st = {
    t: 0, shift: SHIFT, money: 0, del: 0, cam: { x: p.x - view.viewW * CAMERA.leadX, y: 0 },
    d: { x: p.x, y: p.y - DRONE.spawnAbovePad, vx: 0, vy: 0, a: 0, bat: 100 },
    box: { x: p.x, y: p.y - BOX.startAbovePad, px: p.x, py: p.y - BOX.startAbovePad },
    has: true, heat: 100, integ: 100, order: null, item: null, hold: 0, charge: 0,
    wind: 0, windT: 0, windNext: WIND.firstAt, pops: [], parts: [], shake: 0, over: false, running: true, acc: 0,
    dust: [], dustN: 0, onGround: false, ropeLen: ROPE, anchor: null, wrong: 0,
  };
  current = st;
  pickOrder(st, shop);
  return st;
}

function pickOrder(st, shop) {
  const d = st.del;
  const near = ORDERS.minDist + Math.min(d, ORDERS.maxSteps) * ORDERS.stepDist;
  const far = near + ORDERS.span + d * ORDERS.spanPerDelivery;
  let pool = world.targets.filter(t => {
    const gap = Math.abs(t.x - shop.x);
    return gap > near && gap < far;
  });
  if (!pool.length) pool = world.targets;
  const t = pool[(Math.random() * pool.length) | 0];
  const items = shop.shop.items;
  st.item = ITEMS[items[(Math.random() * items.length) | 0]];
  st.order = { t, start: st.t };
  st.heat = 100;
  st.integ = 100;
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

// Where the player should be heading: the customer, or the closest shop.
function goal(st) {
  if (st.has && st.order) return { x: st.order.t.x, y: st.order.t.y, label: 'Customer' };
  const shop = nearestShop(st.d.x), p = shopPad(shop);
  return { x: p.x, y: p.y - 20, label: shop.shop.name };
}

export function stepHeading(st, dt) {
  const c = HEADING, g = goal(st), gap = g.x - st.d.x;
  const astray = Math.abs(gap) > c.minDist && st.d.vx * Math.sign(gap) < -c.minSpeed;
  st.wrong += ((astray ? 1 : 0) - st.wrong) * Math.min(1, dt * c.fade);
}

export function autoDeliver(st) {
  if (st && st.running && st.has && st.order) deliver(st);
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
    st.has = false;
    st.integ = 0;
    pop(st, bx.x, bx.y - 30, 'Order ruined! Back to a shop', '#e8492c');
    st.shake = c.crashShake;
    sfx('spill');
    for (let i = 0; i < c.crashCrumbs; i++) {
      st.parts.push({ x: bx.x, y: bx.y, vx: (Math.random() - .5) * 200, vy: -Math.random() * 220, t: 0, crumb: 1 });
    }
  }
  const T = st.order && st.order.t;
  const reach = st.anchor ? c.holdReach : c.reach;
  if (T && Math.hypot(bx.x - T.x, bx.y - T.y) < reach && Math.hypot(d.vx, d.vy) < c.maxDroneSpeed) {
    st.hold += dt;
    if (st.hold > c.holdTime) deliver(st);
  } else st.hold = Math.max(0, st.hold - dt * c.holdDecay);
}

function deliver(st) {
  const c = DELIVERY, o = st.order, secs = st.t - o.start;
  const base = c.tipBase + st.heat * c.tipHeat + st.integ * c.tipBox + (secs < c.tipFastSecs ? c.tipFastBonus : secs < c.tipOkSecs ? c.tipOkBonus : 0);
  const tip = Math.round(st.item.urgent ? base * c.urgentTip : base);
  const stars = (st.heat > c.starHeat ? 1 : 0) + (st.integ > c.starBox ? 1 : 0) + (secs < c.starSecs ? 1 : 0);
  st.money += tip;
  st.del++;
  st.has = false;
  st.hold = 0;
  st.order = null;
  pop(st, o.t.x, o.t.y - 50, `+$${tip}  ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`, '#ffc23d');
  sfx('deliver');
  setTime(world.time + 1);
  setTimeout(() => {
    if (current && !current.over) pop(current, current.d.x, current.d.y - 40, 'Back to a shop for a new order', '#fff3df');
  }, c.hintDelay);
}

// Any shop pad charges the battery and hands over the next order.
export function stepShop(st, grounded, dt) {
  const d = st.d, bx = st.box, c = RESTAURANT, shop = nearestShop(d.x), p = shopPad(shop);
  if (grounded && Math.abs(d.x - p.x) < shop.w / 2 && d.y < p.y && d.y > p.y - c.padHeight) {
    d.bat = Math.min(100, d.bat + dt * c.chargeRate);
    if (!st.has) {
      st.charge += dt;
      if (st.charge > c.pickupTime) {
        st.has = true;
        st.charge = 0;
        pickOrder(st, shop);
        bx.x = bx.px = d.x + c.boxOffsetX;
        bx.y = bx.py = p.y - c.boxLift;
        pop(st, d.x, d.y - 30, 'New order!', '#4fc27c');
        sfx('pickup');
      }
    }
  } else st.charge = 0;
}

/* ---------- render ---------- */
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
