import { sfx } from './audio.js';
import { AUDIO, BOOST, DRONE, G, HOLD, LOAD, SHADOW } from './config.js';
import { settings } from './storage.js';
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

// How hard the motors are working, for the rotor sound.
export function rotorLoad(st, keys) {
  const base = st.anchor ? AUDIO.holdLoad : keys.u ? 1 : 0;
  return base + Math.abs(st.d.a) * AUDIO.tiltLoad + (st.boosting ? AUDIO.boostLoad : 0);
}

// Boost energy empties fast and comes back on its own after a short rest.
export function stepBoost(st, keys, dt) {
  const c = BOOST, steer = keys.r - keys.l + keys.axis;
  const was = st.boosting;
  st.boosting = !!keys.boost && st.boost > 0 && !st.anchor && st.d.bat > 0;
  if (st.boosting) {
    st.boostDir = Math.sign(steer) || Math.sign(st.d.vx) || st.boostDir;
    st.boost = Math.max(0, st.boost - c.drain * dt);
    st.boostWait = c.refillDelay;
    st.d.bat = Math.max(0, st.d.bat - c.batteryDrain * dt);
    if (!was) sfx('whoosh');
  } else if (st.boostWait > 0) st.boostWait -= dt;
  else st.boost = Math.min(100, st.boost + c.refill * dt);
}

// Hold pins the drone where it was pressed; any flight input hands control back.
export function stepHold(st, keys, canHold) {
  const tap = keys.holdTap;
  keys.holdTap = 0;
  if (st.anchor) {
    if (tap || keys.l || keys.r || keys.u || keys.axis || !st.has || st.d.bat <= 0) st.anchor = null;
  } else if (tap && canHold) st.anchor = { x: st.d.x, y: st.d.y };
}

function flyHeld(st, dt, over) {
  const d = st.d, c = DRONE, a = st.anchor;
  d.a += -d.a * Math.min(1, dt * c.tiltRate);
  d.vx += ((a.x - d.x) * HOLD.spring - d.vx * HOLD.damp + st.wind * c.windForce) * dt;
  d.vy += ((a.y - d.y) * HOLD.spring - d.vy * HOLD.damp) * dt;
  d.x += d.vx * dt;
  d.y += d.vy * dt;
  d.bat = Math.max(0, d.bat - dt * (c.batDrain + HOLD.drain * c.batDrainLift) * (1 + over * LOAD.drainGain));
}

// Returns whether the drone is resting on something this step.
export function stepDrone(st, keys, dt) {
  const d = st.d, c = DRONE;
  // an empty drone flies like one carrying pizza, the weight every factor is measured from
  const over = st.has ? st.item.weight - 1 : 0;
  if (st.anchor) flyHeld(st, dt, over);
  else {
    const powered = d.bat > 0;
    const tgt = (keys.r - keys.l + keys.axis) * c.tiltMax;
    d.a += (tgt - d.a) * Math.min(1, dt * c.tiltRate);
    const thr = powered ? (keys.u ? c.thrustLift : c.thrustIdle) * G * (1 - over * LOAD.thrustLoss) : 0;
    d.vx += (Math.sin(d.a) * thr + st.wind * c.windForce) * dt;
    d.vy += (G - Math.cos(d.a) * thr) * dt;
    if (st.boosting) d.vx += st.boostDir * BOOST.force * dt;
    const drag = Math.pow(c.dragX, dt);
    d.vx *= drag;
    d.vy *= Math.pow(c.dragY, dt);
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    if (powered) d.bat = Math.max(0, d.bat - dt * (c.batDrain + keys.u * c.batDrainLift) * (1 + over * LOAD.drainGain));
  }
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

const DARK = '#1d1420', METAL = '#2b2233';

function disc(g, x, y, r, phase, alpha = .55, tilt = 0) {
  g.fillStyle = `rgba(235,235,250,${alpha})`;
  g.beginPath();
  g.ellipse(x, y, r * Math.abs(Math.sin(phase)) + 2, 2.3, tilt, 0, 7);
  g.fill();
}

function led(g, col, x, y, r) {
  if (!view.lowQ) glow(g, col, x, y, r);
}

const RED = '#ff3b3b', GREEN = '#4dff8a', WARM = 'rgba(255,240,200,.8)';

// Each frame is drawn in its own units around (0,0); spin is the rotor phase.
const AIRFRAMES = {
  courier(g, spin) {
    const s = Math.abs(Math.sin(spin));
    // back rotors (depth)
    g.fillStyle = '#3a3046';
    g.fillRect(-20, -11, 4, 6);
    g.fillRect(22, -11, 4, 6);
    g.fillStyle = 'rgba(220,220,240,.35)';
    g.beginPath();
    g.ellipse(-18, -13, 13 * s + 2, 2, 0, 0, 7);
    g.ellipse(24, -13, 13 * (1 - s) + 2, 2, 0, 0, 7);
    g.fill();
    // arms
    g.fillStyle = METAL;
    g.fillRect(-30, -4, 60, 4);
    // body
    g.fillStyle = '#e8492c';
    g.beginPath();
    g.roundRect(-16, -8, 32, 14, 5);
    g.fill();
    g.fillStyle = '#ffc23d';
    g.beginPath();
    g.moveTo(-4, -3);
    g.lineTo(5, -3);
    g.lineTo(.5, 4);
    g.fill();
    g.fillStyle = DARK;
    g.fillRect(-10, 6, 20, 3);
    // front motors & rotors
    g.fillRect(-32, -9, 6, 7);
    g.fillRect(26, -9, 6, 7);
    g.fillStyle = 'rgba(240,240,255,.55)';
    g.beginPath();
    g.ellipse(-29, -11, 15 * (1 - s) + 2, 2.4, 0, 0, 7);
    g.ellipse(29, -11, 15 * s + 2, 2.4, 0, 0, 7);
    g.fill();
    led(g, RED, -29, -8, 11);
    led(g, GREEN, 29, -8, 11);
    led(g, WARM, -18, -9, 8);
    led(g, WARM, 24, -9, 8);
  },

  // slim body on angled arms folded out from the shoulders, with a camera gimbal
  miniFold(g, spin) {
    g.strokeStyle = '#3c4553';
    g.lineWidth = 3;
    g.lineCap = 'round';
    g.beginPath();
    for (const [x, y] of [[-8, -2], [8, -2]]) { g.moveTo(x, y); g.lineTo(x * 3, -9); }
    g.stroke();
    g.lineCap = 'butt';
    g.fillStyle = '#8c97a6';
    g.beginPath();
    g.roundRect(-12, -6, 24, 10, 4);
    g.fill();
    g.fillStyle = '#3c4553';
    g.fillRect(-12, -2, 24, 2);
    g.fillStyle = DARK;
    g.fillRect(-26, -12, 5, 6);
    g.fillRect(21, -12, 5, 6);
    g.beginPath();
    g.arc(0, 7, 3.5, 0, 7);
    g.fill();
    g.fillStyle = '#4fa3c2';
    g.beginPath();
    g.arc(0, 7, 1.6, 0, 7);
    g.fill();
    disc(g, -24, -14, 11, spin);
    disc(g, 24, -14, 11, spin + 1);
    led(g, RED, -24, -11, 8);
    led(g, GREEN, 24, -11, 8);
  },

  // six rotors on a wide bar around a hexagonal shell
  hexa(g, spin) {
    g.fillStyle = METAL;
    g.fillRect(-36, -5, 72, 3);
    for (const [x, y, a] of [[-16, -15, .32], [16, -15, .32], [-26, -13, .42], [26, -13, .42], [-35, -11, .55], [35, -11, .55]]) {
      g.fillStyle = DARK;
      g.fillRect(x - 2.5, y + 2, 5, -y - 4);
      disc(g, x, y, 11, spin + x, a);
    }
    g.fillStyle = '#2f8f8a';
    g.beginPath();
    g.moveTo(-17, -1); g.lineTo(-9, -11); g.lineTo(9, -11); g.lineTo(17, -1); g.lineTo(9, 9); g.lineTo(-9, 9);
    g.closePath();
    g.fill();
    g.fillStyle = '#bff0e6';
    g.fillRect(-5, -5, 10, 7);
    led(g, RED, -35, -8, 9);
    led(g, GREEN, 35, -8, 9);
    led(g, WARM, 0, -13, 9);
  },

  // boxy cargo bay with two rotors stacked on every arm
  x8(g, spin) {
    g.fillStyle = METAL;
    g.fillRect(-33, -7, 66, 4);
    for (const x of [-31, 31]) {
      g.fillStyle = DARK;
      g.fillRect(x - 3, -18, 6, 14);
      disc(g, x, -19, 15, spin + x);
      disc(g, x, -11, 15, spin + x + 1.4, .4);
    }
    g.fillStyle = '#4f5d75';
    g.fillRect(-18, -10, 36, 19);
    g.fillStyle = '#ffc23d';
    for (let x = -18; x < 18; x += 8) g.fillRect(x, 5, 4, 4);
    g.strokeStyle = '#2d3545';
    g.lineWidth = 1.4;
    g.strokeRect(-14, -7, 28, 10);
    led(g, RED, -31, -14, 10);
    led(g, GREEN, 31, -14, 10);
  },

  // flat carbon plate, strapped battery and forward-raked props
  fpv(g, spin) {
    g.fillStyle = '#17171d';
    g.fillRect(-24, -2, 48, 3);
    g.fillStyle = '#ffc23d';
    g.fillRect(-9, -9, 18, 7);
    g.fillStyle = DARK;
    g.fillRect(-2, -10, 3, 9);
    g.strokeStyle = DARK;
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(-12, -2);
    g.lineTo(-20, -15);
    g.stroke();
    g.fillStyle = '#e8492c';
    g.beginPath();
    g.arc(13, -3, 3, 0, 7);
    g.fill();
    g.fillStyle = DARK;
    g.fillRect(-26, -7, 5, 6);
    g.fillRect(21, -7, 5, 6);
    disc(g, -23, -9, 12, spin, .55, -.28);
    disc(g, 23, -9, 12, spin + 1, .55, -.28);
    led(g, RED, -23, -6, 8);
    led(g, GREEN, 23, -6, 8);
  },

  // wide yellow frame, thick hull, big rotors and landing skids
  heavy(g, spin) {
    g.strokeStyle = METAL;
    g.lineWidth = 2.4;
    g.beginPath();
    g.moveTo(-14, 8); g.lineTo(-24, 15); g.moveTo(14, 8); g.lineTo(24, 15);
    g.moveTo(-30, 15); g.lineTo(-16, 15); g.moveTo(16, 15); g.lineTo(30, 15);
    g.stroke();
    g.fillStyle = METAL;
    g.fillRect(-38, -7, 76, 6);
    g.fillStyle = '#ffc23d';
    for (let x = -38; x < 38; x += 12) g.fillRect(x, -7, 6, 6);
    g.fillStyle = '#d9a321';
    g.beginPath();
    g.roundRect(-20, -11, 40, 20, 3);
    g.fill();
    g.fillStyle = '#7a5b12';
    g.fillRect(-20, 3, 40, 3);
    g.fillStyle = DARK;
    g.fillRect(-40, -13, 8, 7);
    g.fillRect(32, -13, 8, 7);
    disc(g, -36, -15, 21, spin);
    disc(g, 36, -15, 21, spin + 1);
    led(g, RED, -36, -11, 12);
    led(g, GREEN, 36, -11, 12);
  },

  // a fixed wing with lift pods and a pusher prop at the tail
  vtol(g, spin) {
    g.fillStyle = '#c9ced8';
    g.beginPath();
    g.moveTo(-40, -3); g.lineTo(40, -3); g.lineTo(30, 1); g.lineTo(-30, 1);
    g.closePath();
    g.fill();
    g.fillStyle = '#eef1f6';
    g.beginPath();
    g.ellipse(0, 1, 26, 6.5, 0, 0, 7);
    g.fill();
    g.fillStyle = '#4fa3c2';
    g.beginPath();
    g.ellipse(14, -1, 7, 3, 0, 0, 7);
    g.fill();
    g.fillStyle = '#e8492c';
    g.beginPath();
    g.moveTo(-26, 0); g.lineTo(-33, -13); g.lineTo(-24, -13); g.lineTo(-17, 0);
    g.closePath();
    g.fill();
    g.fillStyle = METAL;
    g.fillRect(-25, -9, 5, 7);
    g.fillRect(20, -9, 5, 7);
    disc(g, -22.5, -11, 13, spin);
    disc(g, 22.5, -11, 13, spin + 1);
    disc(g, 26, 1, 3, spin * .3, .3);
    g.fillStyle = 'rgba(240,240,255,.45)';
    g.beginPath();
    g.ellipse(-29, 1, 1.6, 8 * Math.abs(Math.sin(spin)) + 2, 0, 0, 7);
    g.fill();
    led(g, RED, -38, -2, 8);
    led(g, GREEN, 38, -2, 8);
  },
};

export function drawAirframe(g, key, t) {
  (AIRFRAMES[key] || AIRFRAMES.courier)(g, t * 55);
}

export function drawDrone(st) {
  const d = st.d;
  ctx.save();
  ctx.translate(X(d.x), Y(d.y));
  ctx.rotate(d.a);
  ctx.scale(view.S, view.S);
  drawAirframe(ctx, settings.plane, st.t);
  const blink = (st.t * 2 % 1) < .15;
  ctx.fillStyle = blink ? '#ff3b3b' : '#6b1d1d';
  ctx.fillRect(-33, -3, 3, 3);
  ctx.fillStyle = blink ? '#4dff8a' : '#1d5b33';
  ctx.fillRect(30, -3, 3, 3);
  ctx.restore();
}
