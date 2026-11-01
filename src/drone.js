import { sfx } from './audio.js';
import { DRONE, G, LOAD, SHADOW } from './config.js';
import { ctx, glow, kickDust, view, X, Y } from './ui.js';
import { nearby } from './world.js';

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
  // an empty drone flies like one carrying pizza, the weight every factor is measured from
  const over = st.has ? st.item.weight - 1 : 0;
  const powered = d.bat > 0;
  const tgt = (keys.r - keys.l) * c.tiltMax;
  d.a += (tgt - d.a) * Math.min(1, dt * c.tiltRate);
  const thr = powered ? (keys.u ? c.thrustLift : c.thrustIdle) * G * (1 - over * LOAD.thrustLoss) : 0;
  d.vx += (Math.sin(d.a) * thr + st.wind * c.windForce) * dt;
  d.vy += (G - Math.cos(d.a) * thr) * dt;
  const drag = Math.pow(c.dragX, dt);
  d.vx *= drag;
  d.vy *= Math.pow(c.dragY, dt);
  d.x += d.vx * dt;
  d.y += d.vy * dt;
  if (powered) d.bat = Math.max(0, d.bat - dt * (c.batDrain + keys.u * c.batDrainLift) * (1 + over * LOAD.drainGain));
  if (d.y < c.ceiling) { d.y = c.ceiling; d.vy = Math.max(0, d.vy); }

  let grounded = false;
  const dr = { x: d.x, y: d.y };
  for (const R of nearby(dr.x)) {
    const hit = circleRect(dr, c.radius, R);
    if (!hit) continue;
    dr.x += hit.nx * hit.p;
    dr.y += hit.ny * hit.p;
    const vn = d.vx * hit.nx + d.vy * hit.ny;
    if (vn < 0) {
      const sp = Math.abs(vn);
      if (sp > c.hitSpeed) {
        st.shake = Math.min(c.hitShakeMax, sp / c.hitShakeDiv);
        if (st.has) st.integ -= sp * c.hitDamage * st.item.fragile;
        kickDust(st, d.x, d.y, sp * .5);
        sfx('crash');
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

// Soft shadow on the nearest surface below; fades out and widens with height.
export function drawShadow(st) {
  const d = st.d, S = view.S, c = SHADOW;
  let floor = null;
  for (const R of nearby(d.x)) {
    if (d.x >= R.x && d.x <= R.x + R.w && R.y >= d.y && (!floor || R.y < floor.y)) floor = R;
  }
  if (!floor) return;
  const h = floor.y - d.y, alpha = c.alpha * (1 - h / c.maxHeight);
  if (alpha <= 0) return;
  const r = c.radius + h * c.radiusGrow;
  ctx.save();
  ctx.beginPath();
  ctx.rect(X(floor.x), Y(floor.y - r), floor.w * S, r * S);
  ctx.clip();
  ctx.fillStyle = `rgba(20,12,24,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(X(d.x), Y(floor.y - c.lift), r * S, r * c.flat * S, 0, 0, 7);
  ctx.fill();
  ctx.restore();
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
  // LEDs on the rotors
  if (!view.lowQ) {
    const pulse = 9 + spin * 4;
    glow(ctx, '#ff3b3b', -29, -8, pulse);
    glow(ctx, '#4dff8a', 29, -8, pulse);
    glow(ctx, 'rgba(255,240,200,.8)', -18, -9, pulse * .7);
    glow(ctx, 'rgba(255,240,200,.8)', 24, -9, pulse * .7);
  }
  ctx.restore();
}
