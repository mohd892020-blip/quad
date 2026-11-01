import { sfx } from './audio.js';
import { BOX, CITY, G, ROPE, ROPE_CTL } from './config.js';
import { ctx, kickDust, shade, view, X, Y } from './ui.js';
import { nearby, world } from './world.js';

// Pays the rope out over a customer; anywhere else it winds itself back in.
export function stepRopeLength(st, keys, zone, dt) {
  const dir = zone.rope ? keys.rd - keys.ru : -1;
  st.ropeLen = Math.max(ROPE, Math.min(ROPE_CTL.max, st.ropeLen + dir * ROPE_CTL.speed * dt));
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
        if (L.power) sfx('spark');
        break;
      }
    }
  }

  const rvx = (bx.x - bx.px) / dt - d.vx, rvy = (bx.y - bx.py) / dt - d.vy, rv = Math.hypot(rvx, rvy);
  if (rv > c.swingSpeed) st.integ -= dt * (rv - c.swingSpeed) * c.swingDamage * item.fragile;
}

const DRAW = {
  pizza(S, dmg) {
    ctx.fillStyle = shade('#d9a86a', 1 - dmg * .35);
    ctx.fillRect(-13 * S, -5 * S, 26 * S, 10 * S);
    ctx.fillStyle = '#e8492c';
    ctx.fillRect(-13 * S, -5 * S, 26 * S, 2.5 * S);
    ctx.fillStyle = 'rgba(60,30,20,.6)';
    ctx.beginPath();
    ctx.arc(0, 1 * S, 3 * S, 0, 7);
    ctx.fill();
  },
  falafel(S, dmg) {
    ctx.fillStyle = shade('#c9a06a', 1 - dmg * .35);
    ctx.fillRect(-9 * S, -7 * S, 18 * S, 14 * S);
    ctx.fillStyle = '#4fa35f';
    ctx.fillRect(-9 * S, -7 * S, 18 * S, 3 * S);
  },
  kunafa(S, dmg) {
    ctx.fillStyle = '#c0c4cc';
    ctx.fillRect(-14 * S, 1 * S, 28 * S, 4 * S);
    ctx.fillStyle = shade('#e8872c', 1 - dmg * .35);
    ctx.fillRect(-12 * S, -4 * S, 24 * S, 6 * S);
    ctx.fillStyle = '#7cc28f';
    ctx.fillRect(-6 * S, -5 * S, 3 * S, 2 * S);
    ctx.fillRect(3 * S, -5 * S, 3 * S, 2 * S);
  },
  coffee(S, dmg) {
    ctx.fillStyle = '#b08458';
    ctx.fillRect(-9 * S, 2 * S, 18 * S, 4 * S);
    ctx.fillStyle = shade('#f2efe6', 1 - dmg * .35);
    ctx.fillRect(-7 * S, -6 * S, 5 * S, 8 * S);
    ctx.fillRect(2 * S, -6 * S, 5 * S, 8 * S);
  },
  cake(S, dmg) {
    ctx.fillStyle = shade('#f7d7e0', 1 - dmg * .35);
    ctx.fillRect(-12 * S, -7 * S, 24 * S, 14 * S);
    ctx.fillStyle = '#d97aa8';
    ctx.fillRect(-2 * S, -7 * S, 4 * S, 14 * S);
    ctx.fillRect(-12 * S, -2 * S, 24 * S, 4 * S);
  },
  medicine(S, dmg) {
    ctx.fillStyle = shade('#f7f7f4', 1 - dmg * .35);
    ctx.fillRect(-9 * S, -7 * S, 18 * S, 14 * S);
    ctx.fillStyle = '#e8492c';
    ctx.fillRect(-2 * S, -5 * S, 4 * S, 10 * S);
    ctx.fillRect(-5 * S, -2 * S, 10 * S, 4 * S);
  },
  flowers(S, dmg) {
    ctx.fillStyle = shade('#4fa35f', 1 - dmg * .35);
    ctx.fillRect(-2 * S, -2 * S, 4 * S, 10 * S);
    for (const [x, y, col] of [[-6, -5, '#e8492c'], [0, -8, '#ffc23d'], [6, -5, '#d97aa8']]) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x * S, y * S, 4 * S, 0, 7);
      ctx.fill();
    }
  },
  watermelon(S, dmg) {
    ctx.fillStyle = shade('#3f9a52', 1 - dmg * .35);
    ctx.beginPath();
    ctx.ellipse(0, 0, 13 * S, 9 * S, 0, 0, 7);
    ctx.fill();
    ctx.strokeStyle = '#2a6b39';
    ctx.lineWidth = 1.5 * S;
    ctx.beginPath();
    for (const x of [-6, 0, 6]) { ctx.moveTo(x * S, -8 * S); ctx.lineTo(x * S, 8 * S); }
    ctx.stroke();
  },
  tv(S, dmg) {
    ctx.fillStyle = '#20202a';
    ctx.fillRect(-13 * S, -8 * S, 26 * S, 16 * S);
    ctx.fillStyle = shade('#4fa3c2', 1 - dmg * .5);
    ctx.fillRect(-11 * S, -6 * S, 22 * S, 12 * S);
  },
};

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
  const dmg = 1 - st.integ / 100, s = S * item.size;
  DRAW[item.key](s, dmg);
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
