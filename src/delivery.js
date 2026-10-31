import { BOX, CAMERA, DELIVERY, DRONE, ORDERS, RESTAURANT, SHIFT, WIND } from './config.js';
import { ctx, pop, view, X, Y } from './ui.js';
import { genWorld, restPad, world } from './world.js';

const NAMES = ['أم خليل', 'أبو رامي', 'الست سهى', 'عائلة النتشة', 'مكتب المحامي', 'أبو العبد', 'طالب جامعة', 'أم يوسف', 'دكتور سامر', 'الحاجّة فاطمة'];

// The shift running right now; the delayed hint after a delivery lands on this one.
let current = null;

export function newGame() {
  genWorld((Math.random() * 1e9) | 0);
  const p = restPad();
  const st = {
    t: 0, shift: SHIFT, money: 0, del: 0, cam: { x: p.x - view.viewW * CAMERA.leadX, y: 0 },
    d: { x: p.x, y: p.y - DRONE.spawnAbovePad, vx: 0, vy: 0, a: 0, bat: 100 },
    box: { x: p.x, y: p.y - BOX.startAbovePad, px: p.x, py: p.y - BOX.startAbovePad },
    has: true, heat: 100, integ: 100, order: null, hold: 0, charge: 0,
    wind: 0, windT: 0, windNext: WIND.firstAt, pops: [], parts: [], shake: 0, over: false, running: true, acc: 0,
  };
  current = st;
  pickOrder(st);
  return st;
}

function pickOrder(st) {
  const d = st.del;
  const minX = world.rest.x + ORDERS.minDist + Math.min(d, ORDERS.maxSteps) * ORDERS.stepDist;
  const maxX = minX + ORDERS.span + d * ORDERS.spanPerDelivery;
  let pool = world.targets.filter(t => t.x > minX && t.x < maxX);
  if (!pool.length) pool = world.targets;
  const t = pool[(Math.random() * pool.length) | 0];
  st.order = { t, name: NAMES[(Math.random() * NAMES.length) | 0], start: st.t };
  st.heat = 100;
  st.integ = 100;
}

// Everything the carried pizza does each step after the rope has moved it.
export function stepCargo(st, dt) {
  const d = st.d, bx = st.box, c = DELIVERY;
  st.heat = Math.max(0, st.heat - dt * c.heatLoss);
  if (Math.random() < dt * c.steamRate && st.heat > c.steamMinHeat) {
    st.parts.push({ x: bx.x + (Math.random() - .5) * 14, y: bx.y - 8, vy: -30 - Math.random() * 20, t: 0 });
  }
  if (st.integ <= 0) {
    st.has = false;
    st.integ = 0;
    pop(st, bx.x, bx.y - 30, 'انقلبت البيتزا! ارجع للمطعم', '#e8492c');
    st.shake = c.crashShake;
    for (let i = 0; i < c.crashCrumbs; i++) {
      st.parts.push({ x: bx.x, y: bx.y, vx: (Math.random() - .5) * 200, vy: -Math.random() * 220, t: 0, crumb: 1 });
    }
  }
  const T = st.order && st.order.t;
  if (T && Math.hypot(bx.x - T.x, bx.y - T.y) < c.reach && Math.hypot(d.vx, d.vy) < c.maxDroneSpeed) {
    st.hold += dt;
    if (st.hold > c.holdTime) deliver(st);
  } else st.hold = Math.max(0, st.hold - dt * c.holdDecay);
}

function deliver(st) {
  const c = DELIVERY, o = st.order, secs = st.t - o.start;
  const tip = Math.round(c.tipBase + st.heat * c.tipHeat + st.integ * c.tipBox + (secs < c.tipFastSecs ? c.tipFastBonus : secs < c.tipOkSecs ? c.tipOkBonus : 0));
  const stars = (st.heat > c.starHeat ? 1 : 0) + (st.integ > c.starBox ? 1 : 0) + (secs < c.starSecs ? 1 : 0);
  st.money += tip;
  st.del++;
  st.has = false;
  st.hold = 0;
  st.order = null;
  pop(st, o.t.x, o.t.y - 50, `+₪${tip}  ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`, '#ffc23d');
  setTimeout(() => {
    if (current && !current.over) pop(current, current.d.x, current.d.y - 40, 'ارجع للمطعم لطلب جديد', '#fff3df');
  }, c.hintDelay);
}

// Restaurant pad: charge + reload.
export function stepRestaurant(st, grounded, dt) {
  const d = st.d, bx = st.box, c = RESTAURANT, p = restPad();
  if (grounded && Math.abs(d.x - p.x) < world.rest.w / 2 && d.y < p.y && d.y > p.y - c.padHeight) {
    d.bat = Math.min(100, d.bat + dt * c.chargeRate);
    if (!st.has) {
      st.charge += dt;
      if (st.charge > c.pickupTime) {
        st.has = true;
        st.charge = 0;
        pickOrder(st);
        bx.x = bx.px = d.x + c.boxOffsetX;
        bx.y = bx.py = p.y - c.boxLift;
        pop(st, d.x, d.y - 30, 'طلب جديد!', '#4fc27c');
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

export function drawPointer(st) {
  const { W, H } = view;
  let tx, ty, label;
  if (st.has && st.order) {
    tx = st.order.t.x; ty = st.order.t.y; label = st.order.name;
  } else {
    const p = restPad();
    tx = p.x; ty = p.y - 20; label = 'المطعم';
  }
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
  ctx.font = '700 13px Tajawal,sans-serif';
  ctx.textAlign = 'center';
  ctx.direction = 'rtl';
  ctx.fillStyle = '#fff3df';
  ctx.fillText(`${label} · ${dist} م`, Math.max(70, Math.min(W - 70, px)), py + (py > H / 2 ? -22 : 30));
}
