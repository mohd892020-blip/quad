import { sfx } from './audio.js';
import { AIRCRAFT, BOX, CARGO, CITY, CONTRAST, DOUBLE, G, ITEMS, ROPE, ROPE_CTL } from './config.js';
import { currentModel } from './drone.js';
import { ctx, kickDust, shade, view, X, Y } from './ui.js';
import { nearby, world } from './world.js';

// Pays the rope out over a customer; anywhere else it winds itself back in.
export function stepRopeLength(st, keys, zone, dt) {
  const dir = zone.rope ? keys.rd - keys.ru : -1;
  st.ropeLen = Math.max(st.level.rope ?? ROPE, Math.min(ROPE_CTL.max, st.ropeLen + dir * ROPE_CTL.speed * dt));
}

// Past the limit the load is walked back toward it and loses the speed carrying it higher, measured against the drone.
function limitSwing(st, dt) {
  const c = BOX, bx = st.box, d = st.d, ax = d.x, ay = d.y + c.anchorY, rx = bx.x - ax, ry = bx.y - ay, r = Math.hypot(rx, ry), ang = Math.atan2(rx, ry), over = Math.abs(ang) - c.swingLimit;
  if (over <= 0 || r < st.ropeLen * c.swingFree) return;
  const side = Math.sign(ang), back = ang - side * Math.min(over, c.swingBack * dt), tx = side * Math.cos(back), ty = -side * Math.sin(back);
  let vx = bx.x - bx.px, vy = bx.y - bx.py;
  const rising = (vx - d.vx * dt) * tx + (vy - d.vy * dt) * ty;
  if (rising > 0) {
    vx -= tx * rising;
    vy -= ty * rising;
  }
  bx.x = ax + Math.sin(back) * r;
  bx.y = ay + Math.cos(back) * r;
  bx.px = bx.x - vx;
  bx.py = bx.y - vy;
}

// The load is a single verlet point hanging from the drone. Pizza is the baseline:
// its item factors are all 1, which leaves the prototype's numbers untouched.
export function stepRope(st, dt) {
  const d = st.d, bx = st.box, c = BOX, item = st.item;
  let vx = bx.x - bx.px, vy = bx.y - bx.py;
  bx.px = bx.x;
  bx.py = bx.y;
  vx *= c.damping;
  vy *= c.damping;
  bx.x += vx + st.wind * c.windForce * item.wind * dt * dt;
  bx.y += vy + G * dt * dt;

  const ax = d.x, ay = d.y + c.anchorY;
  const dx = bx.x - ax, dy = bx.y - ay, dist = Math.hypot(dx, dy);
  let pullX = 0, pullY = 0;
  if (dist > st.ropeLen) {
    const k = (dist - st.ropeLen) / dist;
    const pullDrone = c.pullDrone * item.weight, pullBox = c.pullBox - (pullDrone - c.pullDrone);
    pullX = -dx * k * pullBox;
    pullY = -dy * k * pullBox;
    bx.x += pullX;
    bx.y += pullY;
    d.x += dx * k * pullDrone;
    d.y += dy * k * pullDrone;
  }
  limitSwing(st, dt);

  const padX = c.padX * item.size, padY = c.padY * item.size;
  for (const R of nearby(bx.x)) {
    const e = { x: R.x - padX, y: R.y - padY, w: R.w + padX * 2, h: R.h + padY * 2 };
    if (bx.x > e.x && bx.x < e.x + e.w && bx.y > e.y && bx.y < e.y + e.h) {
      const pens = [[bx.x - e.x, -1, 0], [e.x + e.w - bx.x, 1, 0], [bx.y - e.y, 0, -1], [e.y + e.h - bx.y, 0, 1]].sort((a, b) => a[0] - b[0])[0];
      const vvx = (bx.x - bx.px) / dt, vvy = (bx.y - bx.py) / dt, vn = -(vvx * pens[1] + vvy * pens[2]);
      bx.x += pens[1] * pens[0];
      bx.y += pens[2] * pens[0];
      // a sturdy load only feels the wall: the rope's share of the speed comes off
      const dragged = item.fragile >= c.snagFragile ? 0 : Math.min(0, pullX * pens[1] + pullY * pens[2]) / dt, knock = vn + dragged;
      if (knock > c.hitSpeed) {
        st.integ -= (knock - c.hitSpeed) * c.hitDamage * item.fragile;
        if (knock > c.bigHitSpeed) {
          st.hitAt = st.t;
          st.shake = Math.max(st.shake, c.bigHitShake);
          kickDust(st, bx.x, bx.y, knock * .5);
          sfx('box');
        }
      }
      // kill normal velocity, friction on tangent
      const tvx = vvx * (pens[1] ? 0 : 1) * c.friction, tvy = vvy * (pens[2] ? 0 : 1) * c.friction;
      bx.px = bx.x - tvx * dt;
      bx.py = bx.y - tvy * dt;
    }
  }

  for (const L of world.lines) {
    if (bx.x < L.minX - c.lineReachX || bx.x > L.maxX + c.lineReachX) continue;
    for (const p of L.pts) {
      if (Math.abs(p.x - bx.x) < c.lineReachX && Math.abs(p.y - bx.y) < c.lineReachY) {
        st.integ -= dt * c.lineDamage * item.fragile * (L.power ? CITY.powerDamage : 1);
        bx.px += (bx.x - bx.px) * c.lineDrag;
        if (L.power) {
          sfx('spark');
          st.hitAt = st.t;
        }
        break;
      }
    }
  }

  const rvx = (bx.x - bx.px) / dt - d.vx, rvy = (bx.y - bx.py) / dt - d.vy, rv = Math.hypot(rvx, rvy);
  if (rv > c.swingSpeed) st.integ -= dt * (rv - c.swingSpeed) * c.swingDamage * item.fragile;
}

const BOX_DRAW_GAP = DOUBLE.drawGap;

// One filled shape, its path laid down by trace.
function solid(col, trace) {
  ctx.fillStyle = col;
  ctx.beginPath();
  trace();
  ctx.fill();
}

const dot = (x, y, r) => () => ctx.arc(x, y, r, 0, 7);
const oval = (x, y, rx, ry, turn = 0) => () => ctx.ellipse(x, y, rx, ry, turn, 0, 7);
const rounded = (x, y, w, h, r) => () => ctx.roundRect(x, y, w, h, r);
const shape = (...pts) => () => {
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
};

function line(col, width, trace) {
  ctx.strokeStyle = col;
  ctx.lineWidth = width;
  ctx.beginPath();
  trace();
  ctx.stroke();
}

function bloom(x, y, r, petal, heart) {
  for (let i = 0; i < 5; i++) {
    const a = i * 1.257 - 1.57;
    solid(petal, dot(x + Math.cos(a) * r * .6, y + Math.sin(a) * r * .6, r * .55));
  }
  solid(heart, dot(x, y, r * .4));
}

function takeawayCup(x, worn) {
  solid(worn('#f7f3ea'), shape(x - 5, -7, x + 5, -7, x + 3.6, 6, x - 3.6, 6));
  solid(worn('#a8744a'), shape(x - 4.6, -3.2, x + 4.6, -3.2, x + 4, 2, x - 4, 2));
  solid('#2b2233', rounded(x - 5.8, -9.6, 11.6, 3.2, 1.2));
  solid('#3a3046', rounded(x - 3.8, -11.6, 7.6, 2.4, 1));
}

// Each order is drawn in its own units around (0,0), about 26 wide, so its shape says what it is before any label does.
// worn darkens the goods as they take knocks.
const DRAW = {
  // a flat delivery box with the pizza printed on its lid
  pizza(worn) {
    solid(worn('#b98a4e'), rounded(-14, -2, 28, 9, 1.5));
    solid(worn('#e0b071'), shape(-11, -8.5, 11, -8.5, 14, -1, -14, -1));
    solid('#f2c14e', oval(0, -4.8, 8.4, 3));
    solid('#e8492c', oval(0, -4.8, 7, 2.3));
    solid('#f2c14e', oval(.6, -5, 5.2, 1.6));
    for (const [x, y] of [[-3.6, -5.2], [.2, -3.9], [3.6, -5.4], [-.4, -6]]) solid('#a92b1c', oval(x, y, 1.3, .7));
    solid('#e8492c', () => ctx.rect(-14, .8, 28, 2.4));
    solid('rgba(70,36,16,.55)', rounded(-4, 4.4, 8, 1.3, .6));
  },
  // a pita wrap in paper, with the falafel showing at the top
  falafel(worn) {
    solid(worn('#e8cb96'), oval(0, -3, 11, 7));
    solid('#5fb36b', shape(-9, -3, -7, -7, -4, -4, -1, -8, 2, -4, 5, -8, 7, -4, 9, -3, 0, 2));
    solid(worn('#8a5a2e'), dot(-4.8, -3.4, 3.8));
    solid(worn('#9c6a36'), dot(3.8, -4, 4));
    solid(worn('#7c4f27'), dot(-.4, -.8, 3.6));
    solid(worn('#f4efe4'), shape(-10.5, -.4, -3, 2, 3, 2, 10.5, -.4, 7, 11, -7, 11));
    solid('#4fa35f', shape(-9.3, 3, 9.3, 3, 8.6, 5.4, -8.6, 5.4));
    line('rgba(70,50,30,.3)', .8, () => { ctx.moveTo(-4, 7); ctx.lineTo(2, 11); });
  },
  // a round tray of kunafa, gold threads on top and pistachio in the middle
  kunafa(worn) {
    solid('#7f8691', oval(0, 6, 15.5, 5));
    solid('#c0c4cc', oval(0, 4.6, 15.5, 5));
    solid(worn('#c96a1e'), () => { ctx.ellipse(0, 3.4, 12.8, 4, 0, 0, Math.PI); ctx.ellipse(0, -2.4, 12.8, 4, 0, Math.PI, 0); ctx.closePath(); });
    solid(worn('#f0932f'), oval(0, -2.4, 12.8, 4));
    line('#ffc06a', .9, () => {
      for (const k of [-.75, -.3, .2, .65]) {
        ctx.moveTo(-9 - k, -2.4 + k * 3.4);
        ctx.quadraticCurveTo(0, -5 + k * 5, 9 + k, -2.4 + k * 3.4);
      }
    });
    solid('#fff3df', oval(0, -2.4, 4.2, 1.5));
    for (const [x, y] of [[-1.6, -2.6], [.3, -2], [1.7, -2.8], [-.4, -3.1]]) solid('#6fb97f', dot(x, y, .75));
  },
  // two takeaway cups in a card carrier
  coffee(worn) {
    takeawayCup(-6.6, worn);
    takeawayCup(6.6, worn);
    solid(worn('#b08458'), shape(-13.5, 2, 13.5, 2, 12, 9.5, -12, 9.5));
    solid('rgba(70,36,16,.5)', rounded(-8, 4.6, 16, 1.5, .7));
  },
  // two tiers on a plate, iced, with a cherry on the top
  cake(worn) {
    solid('#e9e4dc', oval(0, 9.4, 15, 2.4));
    solid(worn('#f7c9d6'), rounded(-12.5, -.5, 25, 10, 2));
    solid(worn('#fbdfe7'), rounded(-8, -8, 16, 8, 2));
    const icing = worn('#fffaf4');
    solid(icing, shape(-12.5, -.5, 12.5, -.5, 12.5, 2, 9.6, 2, 8.6, 4.6, 7, 2, 2.6, 2, 1.4, 5.4, -.2, 2, -5.4, 2, -6.6, 4, -8, 2, -12.5, 2));
    solid(icing, shape(-8, -8, 8, -8, 8, -6, 5.4, -6, 4.4, -3.8, 3.2, -6, -2.4, -6, -3.6, -3.4, -5, -6, -8, -6));
    solid('#d97aa8', () => ctx.rect(-12.5, 6.2, 25, 1.8));
    solid('#e8492c', dot(0, -10.4, 2.5));
    solid('rgba(255,255,255,.75)', dot(-.8, -11.2, .7));
  },
  // a first aid case with a handle, read by its red cross
  medicine(worn) {
    line('#8b929d', 2.2, () => ctx.roundRect(-4.6, -11.4, 9.2, 6.4, 2.4));
    solid(worn('#f7f7f4'), rounded(-13, -7.5, 26, 17, 3.2));
    solid(worn('#d9dbd8'), rounded(-13, 6, 26, 3.5, 2));
    solid('#e8492c', () => { ctx.rect(-2.3, -5.4, 4.6, 12); ctx.rect(-6, -1.7, 12, 4.6); });
    solid('#8b929d', () => { ctx.rect(-11, -8.4, 3.4, 2); ctx.rect(7.6, -8.4, 3.4, 2); });
  },
  // a wooden aid crate, roped twice, with a red cross on its label
  supplies(worn) {
    solid(worn('#b98a4e'), rounded(-13, -9, 26, 18, 2));
    line('#7a5530', 1.4, () => { ctx.moveTo(-13, -3); ctx.lineTo(13, -3); ctx.moveTo(-13, 3); ctx.lineTo(13, 3); });
    solid('#6b4a2a', () => { ctx.rect(-7, -9, 2.4, 18); ctx.rect(4.6, -9, 2.4, 18); });
    solid('#f7f7f4', rounded(-4, -4.5, 8, 9, 1.5));
    solid('#e8492c', () => { ctx.rect(-1, -3.5, 2, 7); ctx.rect(-3, -1, 6, 2); });
  },
  // a bouquet in a paper cone, tied with a ribbon
  flowers(worn) {
    solid('#3f8f50', oval(-9.5, -4, 5.4, 2.2, -.7));
    solid('#3f8f50', oval(9.5, -4, 5.4, 2.2, .7));
    solid('#3f8f50', oval(0, -13, 2.2, 4.6));
    solid(worn('#f4e6d0'), shape(-10.5, -3.5, 10.5, -3.5, 2.6, 12, -2.6, 12));
    solid(worn('#e3cfb1'), shape(1, -3.5, 10.5, -3.5, 2.6, 12, 1, 12));
    bloom(-6, -6.4, 6, '#e8492c', '#ffc23d');
    bloom(6.2, -6.8, 6, '#d97aa8', '#fff3df');
    bloom(0, -10, 6.4, '#ffc23d', '#e8492c');
    solid('#e8492c', () => ctx.rect(-3.6, 5.4, 7.2, 2.2));
    solid('#e8492c', shape(0, 6.4, -5, 11, -2.6, 11));
    solid('#e8492c', shape(0, 6.4, 5, 11, 2.6, 11));
  },
  // a whole melon, stripes and all, with a wedge cut out to show the red
  watermelon(worn) {
    solid(worn('#3f9a52'), oval(0, 0, 14.5, 10.5));
    line('#215e35', 2, () => {
      for (const k of [-.72, -.26, .2]) {
        ctx.moveTo(k * 11, -9.8);
        ctx.bezierCurveTo(k * 16, -4, k * 11, 3, k * 14, 9.6);
      }
    });
    solid('#f4f1dc', () => { ctx.moveTo(1, 1); ctx.ellipse(0, 0, 14.5, 10.5, 0, -1.45, .28); ctx.closePath(); });
    solid(worn('#e8493c'), () => { ctx.moveTo(1.6, .6); ctx.ellipse(0, 0, 12.8, 9, 0, -1.36, .2); ctx.closePath(); });
    for (const [x, y] of [[4.4, -4.4], [8, -2.4], [6.2, .2], [9.8, -5]]) solid('#2b1b14', oval(x, y, .95, .6, .8));
    solid('rgba(255,255,255,.3)', oval(-6.4, -4.6, 4, 1.8, -.5));
  },
  // the set in its shipping carton, LCD printed on the side
  tv(worn) {
    const ink = '#3a2415';
    solid(worn('#c99a63'), rounded(-13.5, -9.5, 27, 19, 1.4));
    solid(worn('#b5854f'), () => ctx.rect(-13.5, -9.5, 27, 3));
    solid('#e8d6ac', () => ctx.rect(-2.4, -9.5, 4.8, 5));
    solid('rgba(70,36,16,.16)', () => ctx.rect(9.6, -6.5, 3.9, 16));
    line(ink, 1.1, () => ctx.roundRect(-10.5, -5.2, 21, 11.6, 1.2));
    solid(ink, () => { ctx.rect(-2.2, 6.4, 4.4, 1); ctx.rect(-4.6, 7.4, 9.2, .9); });
    ctx.fillStyle = ink;
    ctx.font = '10px Lalezar,Tajawal,sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('LCD', 0, 1.2);
  },
  // blown glass, so most of what shows is light on its edges
  vase(worn) {
    const glass = () => {
      ctx.moveTo(-5, -12);
      ctx.lineTo(5, -12);
      ctx.quadraticCurveTo(3, -5, 9, 2);
      ctx.quadraticCurveTo(10.5, 11, 0, 11);
      ctx.quadraticCurveTo(-10.5, 11, -9, 2);
      ctx.quadraticCurveTo(-3, -5, -5, -12);
    };
    solid(worn('#a8e0ea'), glass);
    solid('rgba(46,134,171,.5)', () => { ctx.moveTo(-9.4, 3); ctx.quadraticCurveTo(0, 6, 9.4, 3); ctx.quadraticCurveTo(10.5, 11, 0, 11); ctx.quadraticCurveTo(-10.5, 11, -9.4, 3); });
    line('rgba(26,96,120,.8)', .9, glass);
    solid('#e7fbff', oval(0, -12, 5.2, 1.5));
    line('#ffc23d', 1.4, () => { ctx.moveTo(-5, -4.6); ctx.quadraticCurveTo(0, -3, 5, -4.6); });
    solid('rgba(255,255,255,.85)', oval(-4.8, 3.4, 1.1, 4, .2));
  },
  // two scoops in a waffle cone
  icecream(worn) {
    const cone = shape(-7.8, -2, 7.8, -2, 0, 15);
    solid(worn('#d9a86a'), cone);
    ctx.save();
    ctx.beginPath();
    cone();
    ctx.clip();
    line('#a97a3c', .8, () => {
      for (const k of [-12, -6, 0, 6, 12]) {
        ctx.moveTo(k - 5, -2);
        ctx.lineTo(k + 5, 15);
        ctx.moveTo(k + 5, -2);
        ctx.lineTo(k - 5, 15);
      }
    });
    ctx.restore();
    solid(worn('#f7d78f'), dot(3.8, -5, 5.2));
    solid(worn('#fbe7ef'), dot(-3.4, -4.4, 5.4));
    solid(worn('#f4a6c0'), dot(.2, -9.6, 5.2));
    solid('rgba(255,255,255,.6)', oval(-1.6, -11.4, 1.8, 1, -.5));
    solid('#e8492c', dot(.8, -15, 2.1));
  },
};

// Every aircraft against every order, worked out once: fit is how much smaller than CARGO.drawScale the order is drawn so
// the aircraft's silhouette stays CARGO.ratio times the order's (never narrower than its box), and carry whether, drawn
// so, the aircraft is still CARGO.bigRatio times it.
let cargoTable = null;
function cargoRow(planeKey, item) {
  if (!cargoTable) {
    cargoTable = new Map();
    for (const m of AIRCRAFT) {
      const A = m.area * (CONTRAST.scale * (m.grow ?? 1)) ** 2, row = new Map();
      for (const i of Object.values(ITEMS)) {
        const s = i.size * CARGO.drawScale, floor = Math.min(1, 2 * BOX.padX / (i.art[0] * CARGO.drawScale));
        const fit = Math.min(1, Math.max(floor, Math.sqrt(A / (CARGO.ratio * i.art[1] * s * s))));
        row.set(i.key, { fit, carry: A / (i.art[1] * (s * fit) ** 2) >= CARGO.bigRatio });
      }
      cargoTable.set(m.key, row);
    }
  }
  return (cargoTable.get(planeKey) ?? cargoTable.get(AIRCRAFT[0].key)).get(item.key);
}
// an order the table does not know is drawn and carried as before
export const cargoFit = (planeKey, item) => cargoRow(planeKey, item)?.fit ?? 1;
export const canCarry = (planeKey, item) => (item.parts ? item.parts.every(p => canCarry(planeKey, p)) : cargoRow(planeKey, item)?.carry ?? true);

// A hanging order is drawn CARGO.drawScale times its box, so it reads on a phone, and f of that next to a small aircraft,
// shrunk about its own bottom so a set-down order still sits on the roof. Its share of the box's size still sets how it flies.
function paintOrder(key, size, dmg, f = 1) {
  const k = view.S * size * CARGO.drawScale;
  ctx.save();
  ctx.translate(0, ITEMS[key].art[2] * k * (1 - f));
  ctx.scale(k * f, k * f);
  DRAW[key](hex => shade(hex, 1 - dmg * .35));
  ctx.restore();
}

// An order drawn on its own at scale k around (0,0), for the front screen.
export function drawCargoAt(key, k) { ctx.save(); ctx.scale(k, k); DRAW[key](hex => hex); ctx.restore(); }

export function drawRope(st) {
  if (!st.has) return;
  const d = st.d, bx = st.box, S = view.S, item = st.item;
  const ax = X(d.x), ay = Y(d.y + BOX.anchorY);
  const dist = Math.hypot(bx.x - d.x, bx.y - d.y - BOX.anchorY);
  ctx.strokeStyle = '#1d1420';
  ctx.lineWidth = 1.6 * S;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  if (dist < st.ropeLen - 2) {
    const sag = (st.ropeLen - dist) * .7;
    ctx.quadraticCurveTo((ax + X(bx.x)) / 2, (ay + Y(bx.y)) / 2 + sag * S, X(bx.x), Y(bx.y - 5));
  } else ctx.lineTo(X(bx.x), Y(bx.y - 5));
  ctx.stroke();

  const ang = Math.atan2(bx.x - d.x, (bx.y) - (d.y + BOX.anchorY));
  ctx.save();
  ctx.translate(X(bx.x), Y(bx.y));
  ctx.rotate(-ang * .6);
  const dmg = 1 - st.integ / 100, s = S * item.size, plane = currentModel().key;
  // two tied orders hang one over the other, the next to come off at the bottom
  if (item.parts) {
    const gap = BOX_DRAW_GAP * S * CARGO.drawScale;
    for (const [part, y] of [[item.parts[1], -gap], [item.parts[0], gap]]) {
      ctx.save();
      ctx.translate(0, y);
      paintOrder(part.key, part.size, dmg, cargoFit(plane, ITEMS[part.key]));
      ctx.restore();
    }
  } else paintOrder(item.key, item.size, dmg, cargoFit(plane, ITEMS[item.key]));
  if (dmg > .4) {
    ctx.strokeStyle = '#5a3a24';
    ctx.lineWidth = 1 * s;
    ctx.beginPath();
    ctx.moveTo(-8 * s, -3 * s);
    ctx.lineTo(-2 * s, 3 * s);
    ctx.lineTo(4 * s, -2 * s);
    ctx.stroke();
  }
  ctx.restore();
}
