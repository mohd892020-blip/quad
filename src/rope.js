import { BOX, G, ROPE } from './config.js';
import { ctx, pop, shade, view, X, Y } from './ui.js';
import { world } from './world.js';

// The box is a single verlet point hanging from the drone.
export function stepRope(st, dt) {
  const d = st.d, bx = st.box, c = BOX;
  let vx = bx.x - bx.px, vy = bx.y - bx.py;
  bx.px = bx.x;
  bx.py = bx.y;
  vx *= c.damping;
  vy *= c.damping;
  bx.x += vx + st.wind * c.windForce * dt * dt;
  bx.y += vy + G * dt * dt;

  const ax = d.x, ay = d.y + c.anchorY;
  const dx = bx.x - ax, dy = bx.y - ay, dist = Math.hypot(dx, dy);
  if (dist > ROPE) {
    const k = (dist - ROPE) / dist;
    bx.x -= dx * k * c.pullBox;
    bx.y -= dy * k * c.pullBox;
    d.x += dx * k * c.pullDrone;
    d.y += dy * k * c.pullDrone;
  }

  for (const R of world.colliders) {
    const e = { x: R.x - c.padX, y: R.y - c.padY, w: R.w + c.padX * 2, h: R.h + c.padY * 2 };
    if (bx.x > e.x && bx.x < e.x + e.w && bx.y > e.y && bx.y < e.y + e.h) {
      const pens = [[bx.x - e.x, -1, 0], [e.x + e.w - bx.x, 1, 0], [bx.y - e.y, 0, -1], [e.y + e.h - bx.y, 0, 1]].sort((a, b) => a[0] - b[0])[0];
      const vvx = (bx.x - bx.px) / dt, vvy = (bx.y - bx.py) / dt, vn = -(vvx * pens[1] + vvy * pens[2]);
      bx.x += pens[1] * pens[0];
      bx.y += pens[2] * pens[0];
      if (vn > c.hitSpeed) {
        st.integ -= (vn - c.hitSpeed) * c.hitDamage;
        if (vn > c.bigHitSpeed) {
          st.shake = Math.max(st.shake, c.bigHitShake);
          pop(st, bx.x, bx.y - 20, 'آخ العلبة!', '#e8492c');
        }
      }
      // kill normal velocity, friction on tangent
      const tvx = vvx * (pens[1] ? 0 : 1) * c.friction, tvy = vvy * (pens[2] ? 0 : 1) * c.friction;
      bx.px = bx.x - tvx * dt;
      bx.py = bx.y - tvy * dt;
    }
  }

  for (const L of world.lines) {
    for (const p of L.pts) {
      if (Math.abs(p.x - bx.x) < c.lineReachX && Math.abs(p.y - bx.y) < c.lineReachY) {
        st.integ -= dt * c.lineDamage;
        bx.px += (bx.x - bx.px) * c.lineDrag;
        break;
      }
    }
  }

  const rvx = (bx.x - bx.px) / dt - d.vx, rvy = (bx.y - bx.py) / dt - d.vy, rv = Math.hypot(rvx, rvy);
  if (rv > c.swingSpeed) st.integ -= dt * (rv - c.swingSpeed) * c.swingDamage;
}

export function drawRope(st) {
  if (!st.has) return;
  const d = st.d, bx = st.box, S = view.S;
  const ax = X(d.x), ay = Y(d.y + BOX.anchorY);
  const dist = Math.hypot(bx.x - d.x, bx.y - d.y - BOX.anchorY);
  ctx.strokeStyle = '#1d1420';
  ctx.lineWidth = 1.6 * S;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  if (dist < ROPE - 2) {
    const sag = (ROPE - dist) * .7;
    ctx.quadraticCurveTo((ax + X(bx.x)) / 2, (ay + Y(bx.y)) / 2 + sag * S, X(bx.x), Y(bx.y - 5));
  } else ctx.lineTo(X(bx.x), Y(bx.y - 5));
  ctx.stroke();

  const ang = Math.atan2(bx.x - d.x, (bx.y) - (d.y + BOX.anchorY));
  ctx.save();
  ctx.translate(X(bx.x), Y(bx.y));
  ctx.rotate(-ang * .6);
  const dmg = 1 - st.integ / 100;
  ctx.fillStyle = shade('#d9a86a', 1 - dmg * .35);
  ctx.fillRect(-13 * S, -5 * S, 26 * S, 10 * S);
  ctx.fillStyle = '#e8492c';
  ctx.fillRect(-13 * S, -5 * S, 26 * S, 2.5 * S);
  ctx.fillStyle = 'rgba(60,30,20,.6)';
  ctx.beginPath();
  ctx.arc(0, 1 * S, 3 * S, 0, 7);
  ctx.fill();
  if (dmg > .4) {
    ctx.strokeStyle = '#5a3a24';
    ctx.lineWidth = 1 * S;
    ctx.beginPath();
    ctx.moveTo(-8 * S, -3 * S);
    ctx.lineTo(-2 * S, 3 * S);
    ctx.lineTo(4 * S, -2 * S);
    ctx.stroke();
  }
  ctx.restore();
}
