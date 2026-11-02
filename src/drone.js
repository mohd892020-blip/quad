import { sfx } from './audio.js';
import { drawStandout } from './contrast.js';
import { AIRCRAFT, AUDIO, BOOST, DRONE, EDGE, G, HEALTH, HOLD, LAND, LOAD, SHADOW, SHOP } from './config.js';
import { garage, settings } from './storage.js';
import { addMark, ctx, glow, kickDust, view, X, Y } from './ui.js';
import { nearby, roofAt } from './world.js';

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

// The chosen aircraft with the bought parts fitted. Flight asks every step, so it is kept until either changes.
const fit = { plane: null, version: -1, model: null };
export function currentModel() {
  if (fit.plane !== settings.plane || fit.version !== garage.version) {
    const model = { ...(AIRCRAFT.find(a => a.key === settings.plane) || AIRCRAFT[0]) };
    for (const p of SHOP.parts) model[p.stat] *= 1 + p.gain * Math.min(garage.parts[p.key] || 0, SHOP.partPrices.length);
    Object.assign(fit, { plane: settings.plane, version: garage.version, model });
  }
  return fit.model;
}

// How hard the motors are working, for the rotor sound.
export function rotorLoad(st, keys) {
  const base = st.anchor || st.landing ? AUDIO.holdLoad : keys.u ? 1 : 0;
  return base + Math.abs(st.d.a) * AUDIO.tiltLoad + (st.boosting ? AUDIO.boostLoad : 0);
}

// Boost energy empties fast and comes back on its own after a short rest.
export function stepBoost(st, keys, dt) {
  const c = BOOST, steer = keys.r - keys.l + keys.axis;
  const was = st.boosting;
  st.boosting = !!keys.boost && st.boost > 0 && !st.anchor && !st.landing && st.d.bat > 0;
  if (st.boosting) {
    st.boostDir = Math.sign(steer) || Math.sign(st.d.vx) || st.boostDir;
    st.boost = Math.max(0, st.boost - c.drain * dt);
    st.boostWait = c.refillDelay;
    st.d.bat = Math.max(0, st.d.bat - c.batteryDrain / currentModel().battery * dt);
    if (!was) sfx('whoosh');
  } else if (st.boostWait > 0) st.boostWait -= dt;
  else st.boost = Math.min(100, st.boost + c.refill * dt);
}

// Hold pins the drone where it was pressed; any new flight input hands control back.
// Controls already held when Hold was pressed count only once they have been let go.
export function stepHold(st, keys, canHold) {
  const tap = keys.holdTap, flying = keys.l || keys.r || keys.u || keys.axis;
  keys.holdTap = 0;
  if (st.anchor) {
    if (!flying) st.anchor.armed = true;
    if (tap || (flying && st.anchor.armed) || !st.has || st.d.bat <= 0) st.anchor = null;
  } else if (tap && canHold) st.anchor = { x: st.d.x, y: st.d.y, armed: false };
}

// Land works like Hold: any new flight input takes the drone back, and it ends on touching down.
export function stepLand(st, keys, pad) {
  const tap = keys.landTap, flying = keys.l || keys.r || keys.u || keys.axis;
  keys.landTap = 0;
  if (st.landing) {
    if (!flying) st.landing.armed = true;
    if (tap || (flying && st.landing.armed) || !pad) st.landing = null;
  } else if (tap && pad) st.landing = { x: pad.x, y: pad.y - DRONE.radius, armed: false };
}

function flyLanding(st, dt, over) {
  const d = st.d, c = DRONE, L = LAND, a = st.landing, gap = a.x - d.x, lined = Math.abs(gap) < L.lineUp;
  // anything tall on the way is climbed before crossing
  const wall = !lined && d.y + c.radius > roofAt(d.x + Math.sign(gap) * L.look, L.look) - L.clear;
  const across = wall ? 0 : Math.max(-L.across, Math.min(L.across, gap * L.pull));
  const sink = wall ? -L.speed : lined ? Math.min(L.speed, L.touch + (a.y - d.y) * L.ease) : 0;
  d.a += -d.a * Math.min(1, dt * c.tiltRate);
  d.vx += ((across - d.vx) * L.follow + st.wind * c.windForce) * dt;
  d.vy += (sink - d.vy) * L.follow * dt;
  d.x += d.vx * dt;
  d.y += d.vy * dt;
  d.bat = Math.max(0, d.bat - dt * (c.batDrain + HOLD.drain * c.batDrainLift) * (1 + over * LOAD.drainGain) / currentModel().battery);
}

function flyHeld(st, dt, over) {
  const d = st.d, c = DRONE, a = st.anchor;
  d.a += -d.a * Math.min(1, dt * c.tiltRate);
  d.vx += ((a.x - d.x) * HOLD.spring - d.vx * HOLD.damp + st.wind * c.windForce) * dt;
  d.vy += ((a.y - d.y) * HOLD.spring - d.vy * HOLD.damp) * dt;
  d.x += d.vx * dt;
  d.y += d.vy * dt;
  d.bat = Math.max(0, d.bat - dt * (c.batDrain + HOLD.drain * c.batDrainLift) * (1 + over * LOAD.drainGain) / currentModel().battery);
}

// A hard impact costs health by speed and by what was hit, and scars the spot.
function strike(st, R, speed, x, y) {
  const c = HEALTH;
  st.hp = Math.max(0, st.hp - (speed - c.hitSpeed) * c.perSpeed * (c.materials[R.mat] ?? 1) / currentModel().tough);
  st.lastHit = { x, y, t: st.t, R };
  if (speed > c.markSpeed) addMark(st, x, y, c.markCrash, 0, R);
}

// Returns whether the drone is resting on something this step.
export function stepDrone(st, keys, dt) {
  const d = st.d, c = DRONE, m = currentModel();
  // an empty drone flies like one carrying pizza, the weight every factor is measured from
  const over = st.has ? st.item.weight - 1 : 0;
  if (st.anchor) flyHeld(st, dt, over);
  else if (st.landing) flyLanding(st, dt, over);
  else {
    const powered = d.bat > 0;
    const tgt = (keys.r - keys.l + keys.axis) * c.tiltMax;
    d.a += (tgt - d.a) * Math.min(1, dt * c.tiltRate);
    const thr = powered ? (keys.u ? c.thrustLift * m.thrust : c.thrustIdle) * G * (1 - over * LOAD.thrustLoss / m.thrust) : 0;
    // a parked drone sits on its gear, so wind cannot slide it off a pad
    const wind = st.onGround && !st.has ? 0 : st.wind * c.windForce;
    d.vx += (Math.sin(d.a) * thr * m.speed + wind) * dt;
    d.vy += (G - Math.cos(d.a) * thr) * dt;
    if (st.boosting) d.vx += st.boostDir * BOOST.force * dt;
    const drag = Math.pow(c.dragX, dt);
    d.vx *= drag;
    d.vy *= Math.pow(c.dragY, dt);
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    if (powered && !st.docked) d.bat = Math.max(0, d.bat - dt * (c.batDrain + keys.u * c.batDrainLift) * (1 + over * LOAD.drainGain) / m.battery);
  }
  if (d.y < c.ceiling) { d.y = c.ceiling; d.vy = Math.max(0, d.vy); }
  if (d.x < EDGE.left) { d.x = EDGE.left; d.vx = Math.max(0, d.vx); }
  if (d.x > EDGE.right) { d.x = EDGE.right; d.vx = Math.min(0, d.vx); }

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
      if (sp > HEALTH.hitSpeed) strike(st, R, sp, dr.x - hit.nx * c.radius, dr.y - hit.ny * c.radius);
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

// An outline holds still, so it takes the rotors at their full sweep.
let plain = false;
const sweep = phase => (plain ? 1 : Math.abs(Math.sin(phase)));

function disc(g, x, y, r, phase, alpha = .55, tilt = 0) {
  g.fillStyle = `rgba(235,235,250,${alpha})`;
  g.beginPath();
  g.ellipse(x, y, r * sweep(phase) + 2, 2.3, tilt, 0, 7);
  g.fill();
}

function led(g, col, x, y, r) {
  if (!view.lowQ && !plain) glow(g, col, x, y, r);
}

const RED = '#ff3b3b', GREEN = '#4dff8a', WARM = 'rgba(255,240,200,.8)';

// Each frame is drawn in its own units around (0,0); spin is the rotor phase.
const AIRFRAMES = {
  courier(g, spin) {
    const s = sweep(spin), rest = plain ? 1 : 1 - s;
    // back rotors (depth)
    g.fillStyle = '#3a3046';
    g.fillRect(-20, -11, 4, 6);
    g.fillRect(22, -11, 4, 6);
    g.fillStyle = 'rgba(220,220,240,.35)';
    g.beginPath();
    g.ellipse(-18, -13, 13 * s + 2, 2, 0, 0, 7);
    g.ellipse(24, -13, 13 * rest + 2, 2, 0, 0, 7);
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
    g.ellipse(-29, -11, 15 * rest + 2, 2.4, 0, 0, 7);
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
    g.ellipse(-29, 1, 1.6, 8 * sweep(spin) + 2, 0, 0, 7);
    g.fill();
    led(g, RED, -38, -2, 8);
    led(g, GREEN, 38, -2, 8);
  },

  // ducts wrap the props, so there are no bare tips to strike
  whoop(g, spin) {
    g.fillStyle = '#2f3540';
    g.beginPath();
    g.roundRect(-11, -8, 22, 13, 4);
    g.fill();
    g.fillStyle = '#ffc23d';
    g.fillRect(-11, -1, 22, 2);
    g.fillStyle = DARK;
    g.beginPath();
    g.arc(10, -2, 3, 0, 7);
    g.fill();
    for (const x of [-25, 25]) {
      disc(g, x, -9, 12, spin + x, .5);
      g.fillStyle = '#3a4250';
      g.beginPath();
      g.roundRect(x - 15, -11, 30, 8, 4);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,.14)';
      g.fillRect(x - 12, -9, 24, 1.5);
    }
    led(g, RED, -25, -7, 9);
    led(g, GREEN, 25, -7, 9);
  },

  // a whole-body roll cage around a small quad
  cage(g, spin) {
    disc(g, -7, -5, 8, spin, .55);
    disc(g, 7, -5, 8, spin + 1, .55);
    g.fillStyle = '#e8492c';
    g.fillRect(-7, -3, 14, 8);
    g.fillStyle = DARK;
    g.fillRect(-2, 5, 4, 3);
    g.strokeStyle = '#8b95a3';
    g.lineWidth = 1.6;
    g.beginPath();
    g.arc(0, 0, 16, 0, 7);
    g.moveTo(0, -16);
    g.ellipse(0, 0, 7, 16, 0, -Math.PI / 2, Math.PI * 1.5);
    g.moveTo(16, 0);
    g.ellipse(0, 0, 16, 6, 0, 0, Math.PI * 2);
    g.stroke();
    led(g, RED, -11, -11, 7);
    led(g, GREEN, 11, -11, 7);
  },

  // a tall spray tank on drooping arms with stacked rotors
  agri(g, spin) {
    g.strokeStyle = METAL;
    g.lineWidth = 3;
    g.beginPath();
    for (const s of [-1, 1]) { g.moveTo(s * 8, -10); g.lineTo(s * 31, -5); }
    g.stroke();
    for (const x of [-31, 31]) {
      g.fillStyle = DARK;
      g.fillRect(x - 2.5, -16, 5, 12);
      disc(g, x, -17, 12, spin + x);
      disc(g, x, -10, 12, spin + x + 1.4, .4);
    }
    g.fillStyle = '#e9eef2';
    g.beginPath();
    g.roundRect(-10, -14, 20, 20, 5);
    g.fill();
    g.fillStyle = '#7cc28f';
    g.fillRect(-10, -7, 20, 7);
    g.fillStyle = DARK;
    g.fillRect(-12, 6, 3, 3);
    g.fillRect(9, 6, 3, 3);
    led(g, RED, -31, -12, 9);
    led(g, GREEN, 31, -12, 9);
  },

  // one long hull under two big rotors, like a small Chinook
  tandem(g, spin) {
    g.fillStyle = METAL;
    g.fillRect(-23.5, -14, 3.5, 10);
    g.fillRect(20, -11, 3.5, 7);
    disc(g, -22, -15, 19, spin, .5);
    disc(g, 22, -12, 19, spin + 1, .5);
    g.fillStyle = '#5a7fa6';
    g.beginPath();
    g.roundRect(-30, -6, 60, 12, 6);
    g.fill();
    g.fillStyle = '#bfe0f2';
    g.fillRect(14, -3, 10, 5);
    g.fillStyle = 'rgba(255,255,255,.2)';
    g.fillRect(-26, -4, 34, 2);
    led(g, RED, -30, 0, 8);
    led(g, GREEN, 30, 0, 8);
  },

  // a slim fuselage whose nacelles swing forward with speed
  tilt(g, spin, pose) {
    g.fillStyle = '#d8dde6';
    g.beginPath();
    g.moveTo(-30, 0);
    g.quadraticCurveTo(-8, -8, 22, -4);
    g.quadraticCurveTo(30, 0, 22, 4);
    g.quadraticCurveTo(-8, 7, -30, 0);
    g.fill();
    g.fillStyle = '#e8492c';
    g.beginPath();
    g.moveTo(-28, 0); g.lineTo(-34, -11); g.lineTo(-25, -11); g.lineTo(-19, -1);
    g.fill();
    g.fillStyle = '#4fa3c2';
    g.fillRect(12, -3, 8, 3);
    const swing = pose.lean * 1.25;
    for (const x of [-16, 14]) {
      g.save();
      g.translate(x, -3);
      g.rotate(swing);
      g.fillStyle = METAL;
      g.fillRect(-2.5, -9, 5, 10);
      disc(g, 0, -10, 13, spin + x);
      g.restore();
    }
    led(g, RED, -32, -10, 7);
    led(g, GREEN, 26, -1, 7);
  },
};

const legs = (g, draw) => {
  g.strokeStyle = METAL;
  g.lineWidth = 2.4;
  g.lineCap = 'round';
  g.beginPath();
  for (const s of [-1, 1]) draw(s);
  g.stroke();
  g.lineCap = 'butt';
};

// The base under each airframe; feet end at y 15, the drone's contact radius.
const GEAR = {
  arched: g => legs(g, s => {
    g.moveTo(s * 12, 4);
    g.quadraticCurveTo(s * 27, 7, s * 20, 14);
    g.moveTo(s * 16, 14.5); g.lineTo(s * 24, 14.5);
  }),
  stubs: g => legs(g, s => { g.moveTo(s * 22, -6); g.lineTo(s * 22, 14); }),
  tlegs: g => legs(g, s => {
    g.moveTo(s * 20, 2); g.lineTo(s * 20, 14);
    g.moveTo(s * 12, 14.5); g.lineTo(s * 28, 14.5);
  }),
  skids: g => legs(g, s => {
    g.moveTo(s * 13, 5); g.lineTo(s * 17, 14.5);
    g.moveTo(0, 14.5); g.lineTo(s * 30, 14.5);
  }),
  tall: g => legs(g, s => {
    g.moveTo(s * 11, 4); g.lineTo(s * 25, 14);
    g.moveTo(s * 21, 14.5); g.lineTo(s * 30, 14.5);
  }),
  belly(g) {
    g.fillStyle = '#17171d';
    g.fillRect(-8, 1, 16, 14);
    g.fillStyle = 'rgba(255,255,255,.12)';
    g.fillRect(-8, 6, 16, 2);
  },
  retract(g, fold) {
    for (const s of [-1, 1]) {
      g.save();
      g.translate(s * 10, 2);
      g.rotate(-s * fold * 1.25);
      legs(g, () => {});
      g.beginPath();
      g.moveTo(0, 0); g.lineTo(s * 12, 6); g.lineTo(s * 12, 12.5);
      g.moveTo(s * 7, 12.5); g.lineTo(s * 17, 12.5);
      g.stroke();
      g.restore();
    }
  },
  none() {},
};

const FLAT = { fold: 0, lean: 0 };

export function drawAirframe(g, key, t, pose = FLAT) {
  const m = AIRCRAFT.find(a => a.key === key) || AIRCRAFT[0];
  GEAR[m.gear](g, pose.fold);
  AIRFRAMES[m.key](g, t * 55, pose);
}

export function drawDrone(st) {
  if (st.wreck) return;
  const d = st.d, blink = (st.t * 2 % 1) < .15, key = settings.plane, moving = currentModel().gear === 'retract';
  // retracting legs tuck up away from the ground; tilting rotors lean into the speed
  const fold = Math.max(0, Math.min(1, (roofAt(d.x, 20) - d.y - 40) / 60)), pose = { fold, lean: Math.max(-1, Math.min(1, d.vx / 300)) };
  // the rim of an aircraft that changes shape follows it in a few steps
  const held = moving ? { fold: Math.round(fold * 2) / 2, lean: Math.round(pose.lean * 2) / 2 } : FLAT;
  drawStandout(st, d.a, `${key}/${held.fold}/${held.lean}`, g => {
    plain = true;
    drawAirframe(g, key, 0, held);
    plain = false;
  }, g => {
    drawAirframe(g, key, st.t, pose);
    g.fillStyle = blink ? '#ff3b3b' : '#6b1d1d';
    g.fillRect(-33, -3, 3, 3);
    g.fillStyle = blink ? '#4dff8a' : '#1d5b33';
    g.fillRect(30, -3, 3, 3);
  });
}
