import { DRONE, G } from './config.js';
import { ctx, pop, view, X, Y } from './ui.js';
import { world } from './world.js';

function circleRect(o, r, R) {
  const cx = Math.max(R.x, Math.min(o.x, R.x + R.w)), cy = Math.max(R.y, Math.min(o.y, R.y + R.h));
  const dx = o.x - cx, dy = o.y - cy, d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return null;
  const d = Math.sqrt(d2);
  if (d < 1e-4) {
    const opts = [[o.x - R.x, -1, 0], [R.x + R.w - o.x, 1, 0], [o.y - R.y, 0, -1], [R.y + R.h - o.y, 0, 1]].sort((a, b) => a[0] - b[0])[0];
    return { nx: opts[1], ny: opts[2], p: opts[0] + r };
  }
  return { nx: dx / d, ny: dy / d, p: r - d };
}

// Returns whether the drone is resting on something this step.
export function stepDrone(st, keys, dt) {
  const d = st.d, c = DRONE;
  const powered = d.bat > 0;
  const tgt = (keys.r - keys.l) * c.tiltMax;
  d.a += (tgt - d.a) * Math.min(1, dt * c.tiltRate);
  const thr = powered ? (keys.u ? c.thrustLift : c.thrustIdle) * G : 0;
  d.vx += (Math.sin(d.a) * thr + st.wind * c.windForce) * dt;
  d.vy += (G - Math.cos(d.a) * thr) * dt;
  const drag = Math.pow(c.dragX, dt);
  d.vx *= drag;
  d.vy *= Math.pow(c.dragY, dt);
  d.x += d.vx * dt;
  d.y += d.vy * dt;
  if (powered) d.bat = Math.max(0, d.bat - dt * (c.batDrain + keys.u * c.batDrainLift));
  if (d.y < c.ceiling) { d.y = c.ceiling; d.vy = Math.max(0, d.vy); }

  let grounded = false;
  const dr = { x: d.x, y: d.y };
  for (const R of world.colliders) {
    const hit = circleRect(dr, c.radius, R);
    if (!hit) continue;
    dr.x += hit.nx * hit.p;
    dr.y += hit.ny * hit.p;
    const vn = d.vx * hit.nx + d.vy * hit.ny;
    if (vn < 0) {
      const sp = Math.abs(vn);
      if (sp > c.hitSpeed) {
        st.shake = Math.min(c.hitShakeMax, sp / c.hitShakeDiv);
        if (st.has) st.integ -= sp * c.hitDamage;
        pop(st, d.x, d.y - 24, 'طاخ!', '#ffc23d');
      }
      d.vx -= c.bounce * vn * hit.nx;
      d.vy -= c.bounce * vn * hit.ny;
    }
    if (hit.ny < c.groundNormal) {
      grounded = true;
      d.vx *= Math.pow(c.groundFriction, dt);
    }
  }
  d.x = dr.x;
  d.y = dr.y;
  return grounded;
}

export function drawDrone(st) {
  const d = st.d, S = view.S;
  ctx.save();
  ctx.translate(X(d.x), Y(d.y));
  ctx.rotate(d.a);
  ctx.scale(S, S);
  const spin = Math.abs(Math.sin(st.t * 55));
  // back rotors (depth)
  ctx.fillStyle = '#3a3046';
  ctx.fillRect(-20, -11, 4, 6);
  ctx.fillRect(22, -11, 4, 6);
  ctx.fillStyle = 'rgba(220,220,240,.35)';
  ctx.beginPath();
  ctx.ellipse(-18, -13, 13 * spin + 2, 2, 0, 0, 7);
  ctx.ellipse(24, -13, 13 * (1 - spin) + 2, 2, 0, 0, 7);
  ctx.fill();
  // arms
  ctx.fillStyle = '#2b2233';
  ctx.fillRect(-30, -4, 60, 4);
  // body
  ctx.fillStyle = '#e8492c';
  ctx.beginPath();
  ctx.roundRect(-16, -8, 32, 14, 5);
  ctx.fill();
  ctx.fillStyle = '#ffc23d';
  ctx.beginPath();
  ctx.moveTo(-4, -3);
  ctx.lineTo(5, -3);
  ctx.lineTo(.5, 4);
  ctx.fill();
  ctx.fillStyle = '#1d1420';
  ctx.fillRect(-10, 6, 20, 3);
  // front motors & rotors
  ctx.fillStyle = '#1d1420';
  ctx.fillRect(-32, -9, 6, 7);
  ctx.fillRect(26, -9, 6, 7);
  ctx.fillStyle = 'rgba(240,240,255,.55)';
  ctx.beginPath();
  ctx.ellipse(-29, -11, 15 * (1 - spin) + 2, 2.4, 0, 0, 7);
  ctx.ellipse(29, -11, 15 * spin + 2, 2.4, 0, 0, 7);
  ctx.fill();
  const blink = (st.t * 2 % 1) < .15;
  ctx.fillStyle = blink ? '#ff3b3b' : '#6b1d1d';
  ctx.fillRect(-33, -3, 3, 3);
  ctx.fillStyle = blink ? '#4dff8a' : '#1d5b33';
  ctx.fillRect(30, -3, 3, 3);
  ctx.restore();
}
