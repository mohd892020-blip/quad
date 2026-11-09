import { iceAt } from './alpine.js';
import { buzz, sfx } from './audio.js';
import { drawStandout } from './contrast.js';
import { AIRCRAFT, AUDIO, BOOST, BOOSTS, BOX, CARS, DRONE, EAGLES, EDGE, G, GROUND, HEALTH, HOLD, LAND, LOAD, ROPE, ROPE_CTL, SHADOW, SHOP, THIN_ICE } from './config.js';
import { garage, settings } from './storage.js';
import { addMark, ctx, glow, kickDust, showToast, view, X, Y } from './ui.js';
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
  if (st.level.noBoost) return;
  const c = BOOST, steer = keys.r - keys.l + keys.axis;
  const was = st.boosting;
  st.boosting = !!keys.boost && st.boost > 0 && !st.anchor && !st.landing && st.d.bat > 0;
  if (st.boosting) {
    st.boostDir = Math.sign(steer) || Math.sign(st.d.vx) || st.boostDir;
    st.boost = Math.max(0, st.boost - c.drain * dt);
    st.boostWait = c.refillDelay;
    st.d.bat = Math.max(0, st.d.bat - c.batteryDrain / currentModel().battery * (st.level.cold || 1) * dt);
    if (!was) sfx('whoosh');
  } else if (st.boostWait > 0) st.boostWait -= dt;
  else st.boost = Math.min(100, st.boost + c.refill * dt);
}

// Hold pins the drone where it was pressed; any new flight input hands control back.
// Controls already held when Hold was pressed count only once they have been let go.
export function stepHold(st, keys, canHold) {
  const tap = keys.holdTap, flying = keys.l || keys.r || keys.u || keys.sink || keys.axis;
  keys.holdTap = 0;
  if (st.anchor) {
    if (!flying) st.anchor.armed = true;
    if (tap || (flying && st.anchor.armed) || !st.has || st.d.bat <= 0) st.anchor = null;
  } else if (tap && canHold) st.anchor = { x: st.d.x, y: st.d.y, armed: false };
}

// Land works like Hold: any new flight input takes the drone back, and it ends on touching down.
export function stepLand(st, keys, pad) {
  const tap = keys.landTap, flying = keys.l || keys.r || keys.u || keys.sink || keys.axis;
  keys.landTap = 0;
  if (st.landing) {
    if (!flying) st.landing.armed = true;
    if (tap || (flying && st.landing.armed) || !pad) st.landing = null;
  } else if (tap && pad) st.landing = { x: pad.x, y: pad.y - DRONE.radius, armed: false };
}

// Over traffic the order waits above a vehicle under the customer, or one about to pass under them.
function trafficTop(st, T) {
  const c = BOOSTS.drop, r = BOX.padX * st.item.size;
  let top = Infinity;
  for (const car of st.cars ?? []) {
    const s = CARS.shapes[car.kind], band = GROUND + (s.lane ?? CARS.lane) - s.height - r - c.carClear;
    const gap = Math.abs(car.x - T.x) - s.length / 2 - r - c.carGap, closing = (car.x < T.x) === (st.carDir > 0);
    if (gap < 0 || (closing && gap < car.v * c.carSecs)) top = Math.min(top, band);
  }
  return top;
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Auto Drop flies Hold's own anchor and the rope, so everything that waits for Hold (hops, surprises, close calls,
// Boost, a ferry carrying the anchor) waits for it too. Its button, H, LAND or any new flight input hands control back;
// the drop is spent only by a handover.
export function stepAutoDrop(st, keys, canDrop, dt) {
  const tap = keys.dropTap, dr = st.drop, c = BOOSTS.drop;
  keys.dropTap = 0;
  if (!dr) {
    if (tap && canDrop) {
      st.anchor = { x: st.d.x, y: st.d.y, armed: false };
      st.drop = { t: st.order.t, at: st.t, y: st.d.y, bias: 0, aim: st.d.x };
      sfx('gate');
      buzz(c.buzz);
    }
    return;
  }
  // CANCEL lets go as RELEASE does; LAND takes over from it
  if (tap || st.landing) st.anchor = null;
  if (tap || st.landing || !st.anchor || !st.has || st.order?.t !== dr.t || st.d.bat <= 0 || st.falling || st.outcome || st.done) {
    st.drop = null;
    return;
  }
  // a drop that will not settle hands back on plain Hold, and is kept for another try
  if (st.t - dr.at > c.secs) {
    st.drop = null;
    showToast(BOOSTS.text.paused[0], BOOSTS.text.paused[1], true);
    return;
  }
  const o = st.order, a = st.anchor, T = o.t, d = st.d, bx = st.box, item = st.item, vT = T.vx ?? 0, low = st.level.rope ?? ROPE;
  // the aircraft stays between the shortest rope over the customer and `rope` above it, and clear of thin ice's wash
  const iceTop = iceAt(T.x) ? GROUND - THIN_ICE.wash - c.ice : Infinity;
  const floorY = Math.min(T.y - BOX.anchorY - low, iceTop), ceilY = Math.min(floorY, T.y - BOX.anchorY - Math.max(c.rope, low));
  const wantY = clamp(dr.y, ceilY, floorY);
  // where the wind leans the order, and how far Hold's spring trails the anchor in wind and on a ferry
  const lean = st.ropeLen * st.wind * BOX.windForce * item.wind / G;
  const lag = (HOLD.damp * vT - st.wind * DRONE.windForce) / HOLD.spring;
  const swing = bx.x - d.x - lean, calm = Math.abs(swing) < c.calm;
  if (calm && Math.abs(T.y - bx.y) < c.near) dr.bias = clamp(dr.bias + (T.x - bx.x) * c.ki * dt, -c.biasMax, c.biasMax);
  const wantX = T.x - lean + dr.bias, tooLow = d.y > floorY + c.slack;
  // the aim walks to the spot at a steady pace and rides a ferry; the anchor follows the order's swing to calm it
  if (!tooLow) dr.aim += vT * dt + clamp(wantX - dr.aim, -c.slew * dt, c.slew * dt);
  else dr.aim += vT * dt;
  a.x = dr.aim + lag + c.sway * swing;
  const lined = Math.abs(bx.x - T.x) < c.lineUp && calm;
  if (tooLow || a.y > wantY) a.y = Math.max(wantY, a.y - c.rise * dt);
  else if (lined) a.y = Math.min(wantY, a.y + c.sink * dt);
  // lined up at its height the rope pays out, easing into the touch; above traffic it waits for a gap
  const lowering = lined && Math.abs(d.y - wantY) < c.settle, boxTo = Math.min(T.y, trafficTop(st, T));
  const need = clamp(boxTo - (d.y + BOX.anchorY), low, ROPE_CTL.max);
  const rate = lowering ? Math.min(ROPE_CTL.speed, c.touch + c.ease * Math.abs(boxTo - bx.y)) : ROPE_CTL.speed;
  if (lowering || st.ropeLen > need) st.ropeLen = clamp(st.ropeLen + clamp(need - st.ropeLen, -rate * dt, rate * dt), low, ROPE_CTL.max);
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
  d.bat = Math.max(0, d.bat - dt * (c.batDrain + HOLD.drain * c.batDrainLift) * (1 + over * LOAD.drainGain) / currentModel().battery * (st.level.cold || 1));
}

function flyHeld(st, dt, over) {
  const d = st.d, c = DRONE, a = st.anchor;
  d.a += -d.a * Math.min(1, dt * c.tiltRate);
  d.vx += ((a.x - d.x) * HOLD.spring - d.vx * HOLD.damp + st.wind * c.windForce) * dt;
  d.vy += ((a.y - d.y) * HOLD.spring - d.vy * HOLD.damp) * dt;
  d.x += d.vx * dt;
  d.y += d.vy * dt;
  d.bat = Math.max(0, d.bat - dt * (c.batDrain + HOLD.drain * c.batDrainLift) * (1 + over * LOAD.drainGain) / currentModel().battery * (st.level.cold || 1));
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
    const powered = d.bat > 0 && !st.falling;
    const tgt = st.falling ? d.a + EAGLES.spin : (keys.r - keys.l + keys.axis) * c.tiltMax;
    d.a += (tgt - d.a) * Math.min(1, dt * c.tiltRate);
    const thr = powered ? (keys.u ? c.thrustLift * m.thrust : keys.sink ? c.thrustDown : c.thrustIdle) * G * (1 - over * LOAD.thrustLoss / m.thrust) : 0;
    // a parked drone sits on its gear, so wind cannot slide it off a pad
    const wind = st.onGround && !st.has ? 0 : st.wind * c.windForce;
    d.vx += (Math.sin(d.a) * thr * m.speed + wind) * dt;
    // beside a cliff the air itself lifts or sinks the aircraft
    d.vy += (G - Math.cos(d.a) * thr + (st.draft || 0)) * dt;
    if (st.boosting) d.vx += st.boostDir * BOOST.force * dt;
    const drag = Math.pow(c.dragX, dt);
    d.vx *= drag;
    d.vy *= Math.pow(c.dragY, dt);
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    if (powered && !st.docked) d.bat = Math.max(0, d.bat - dt * (c.batDrain + keys.u * c.batDrainLift) * (1 + over * LOAD.drainGain) / m.battery * (st.level.cold || 1));
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
        st.hitAt = st.t;
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
const SHADE = 'rgba(20,10,30,.22)', SHINE = 'rgba(255,255,255,.3)', GLASS = '#1c2b3a', LENS = '#4fa3c2', TPU = '#f08a24';

// An outline holds still, so it takes the rotors at their full sweep.
let plain = false;
const sweep = phase => (plain ? 1 : Math.abs(Math.sin(phase)));

// A prop seen edge-on: the faint blur of its whole sweep, the blade where it is now, and the nut on the hub.
function disc(g, x, y, r, phase, alpha = .55, tilt = 0) {
  g.fillStyle = `rgba(235,235,250,${alpha * .4})`;
  g.beginPath();
  g.ellipse(x, y, r + 2, 2.3, tilt, 0, 7);
  g.fill();
  g.fillStyle = `rgba(235,235,250,${alpha})`;
  g.beginPath();
  g.ellipse(x, y, r * sweep(phase) + 1.5, 1.6, tilt, 0, 7);
  g.fill();
  g.fillStyle = DARK;
  g.beginPath();
  g.ellipse(x, y, 1.8, 1.3, tilt, 0, 7);
  g.fill();
}

function led(g, col, x, y, r) {
  if (!view.lowQ && !plain) glow(g, col, x, y, r);
}

function dot(g, x, y, r) {
  g.beginPath();
  g.arc(x, y, r, 0, 7);
  g.fill();
}

// Fills a shape in its paint, lit from above: a bright lip along the top and a shaded underside.
function lit(g, paint, top, bottom, shape) {
  g.fillStyle = paint;
  g.beginPath();
  shape(g);
  g.fill();
  if (plain || view.lowQ) return;
  const h = bottom - top;
  g.save();
  g.clip();
  g.fillStyle = SHADE;
  g.fillRect(-60, top + h * .58, 120, h);
  g.fillStyle = SHINE;
  g.fillRect(-60, top, 120, Math.max(1, h * .14));
  g.restore();
}

// A motor bell standing on its mount, with the seam where it spins and light down one side.
function motor(g, x, top, w, h) {
  g.fillStyle = DARK;
  g.fillRect(x - w / 2, top, w, h);
  if (plain) return;
  g.fillStyle = '#6d6478';
  g.fillRect(x - w / 2, top + h * .4, w, .9);
  g.fillStyle = 'rgba(255,255,255,.2)';
  g.fillRect(x - w / 2 + .6, top, 1, h);
}

// A carbon tube between two points, with light catching its top.
function tube(g, x1, y1, x2, y2, w, col = METAL) {
  g.lineCap = 'round';
  g.strokeStyle = col;
  g.lineWidth = w;
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
  if (!plain) {
    g.strokeStyle = 'rgba(255,255,255,.18)';
    g.lineWidth = Math.max(.6, w * .28);
    g.beginPath();
    g.moveTo(x1, y1 - w * .26);
    g.lineTo(x2, y2 - w * .26);
    g.stroke();
  }
  g.lineCap = 'butt';
}

// A camera lens turned toward the player: a dark ring, the glass, and a glint.
function lens(g, x, y, r) {
  g.fillStyle = DARK;
  dot(g, x, y, r);
  g.fillStyle = GLASS;
  dot(g, x, y, r * .68);
  g.fillStyle = 'rgba(170,225,255,.85)';
  dot(g, x - r * .25, y - r * .25, r * .22);
}

const RED = '#ff3b3b', GREEN = '#4dff8a', WARM = 'rgba(255,240,200,.8)';

// Each frame is drawn in its own units around (0,0), nose toward +x; spin is the rotor phase.
const AIRFRAMES = {
  // a delivery quad: a rounded shell on tapered arms, the far pair of rotors seen behind it
  courier(g, spin) {
    tube(g, -10, -6, -18, -8, 2.4, '#3a3046');
    tube(g, 10, -6, 24, -8, 2.4, '#3a3046');
    motor(g, -18, -12, 4, 5);
    motor(g, 24, -12, 4, 5);
    disc(g, -18, -13, 13, spin + 2, .35);
    disc(g, 24, -13, 13, spin + 3.5, .35);
    g.fillStyle = METAL;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(s * 12, -5.5); g.lineTo(s * 30, -4); g.lineTo(s * 30, -1); g.lineTo(s * 12, 1);
      g.fill();
    }
    lit(g, '#e8492c', -9, 6, g => g.roundRect(-17, -9, 34, 15, 6));
    // GPS puck on top
    g.fillStyle = DARK;
    g.fillRect(-4, -10, 8, 1.4);
    g.fillStyle = '#f1ece6';
    g.beginPath();
    g.roundRect(-5, -12, 10, 2.6, 1.3);
    g.fill();
    // the slice on the side, with its crust
    g.fillStyle = '#ffc23d';
    g.beginPath();
    g.moveTo(-4.5, -3.5); g.lineTo(5, -3.5); g.lineTo(.25, 4);
    g.fill();
    g.fillStyle = '#d9861c';
    g.fillRect(-4.8, -4.6, 10.1, 1.4);
    // cooling slits at the back, the sensor window at the nose, the release under the belly
    g.fillStyle = 'rgba(40,10,10,.45)';
    for (const y of [-4.5, -2.5, -.5]) g.fillRect(-14.5, y, 4, .8);
    g.fillStyle = GLASS;
    g.beginPath();
    g.roundRect(10.5, -5, 5, 4, 1.5);
    g.fill();
    g.fillStyle = 'rgba(170,225,255,.7)';
    g.fillRect(11.5, -4.2, 1.6, .8);
    g.fillStyle = DARK;
    g.beginPath();
    g.roundRect(-7, 5, 14, 3.5, 1.5);
    g.fill();
    motor(g, -29, -10, 6, 7);
    motor(g, 29, -10, 6, 7);
    disc(g, -29, -11.5, 15, spin + 1.6);
    disc(g, 29, -11.5, 15, spin);
    led(g, RED, -29, -8, 11);
    led(g, GREEN, 29, -8, 11);
    led(g, WARM, -18, -9, 8);
    led(g, WARM, 24, -9, 8);
  },

  // a folding camera drone: the front arms fold out high, the back arms low, and the gimbal hangs under the nose
  miniFold(g, spin) {
    tube(g, -6, 0, -23.5, -8, 2.6, '#3c4553');
    tube(g, 6, -4, 23.5, -9, 2.6, '#3c4553');
    motor(g, -23.5, -12, 5, 7);
    motor(g, 23.5, -13, 5, 7);
    lit(g, '#8c97a6', -7, 4, g => {
      g.moveTo(-13, -1);
      g.quadraticCurveTo(-13, -7, -7, -7);
      g.lineTo(6, -7);
      g.quadraticCurveTo(11, -7, 14, -2);
      g.quadraticCurveTo(14.5, 4, 9, 4);
      g.lineTo(-9, 4);
      g.quadraticCurveTo(-13, 4, -13, -1);
    });
    // battery seam, the hinges the arms swing on, and the obstacle sensors at both ends
    g.fillStyle = 'rgba(30,36,48,.45)';
    g.fillRect(-10, -4.6, 15, .8);
    g.fillStyle = '#3c4553';
    dot(g, -6, 0, 1.8);
    dot(g, 6, -4, 1.8);
    g.fillStyle = GLASS;
    g.beginPath();
    g.ellipse(11.8, -2.4, 1.4, 1.1, 0, 0, 7);
    g.ellipse(-12, -2.2, .9, 1.1, 0, 0, 7);
    g.fill();
    // gimbal yoke and camera
    g.fillStyle = DARK;
    g.fillRect(8, 3.5, 2, 2.5);
    lit(g, '#3c4553', 5.5, 10.5, g => g.roundRect(5, 5.5, 8, 5, 2));
    lens(g, 9.5, 8, 2);
    disc(g, -23.5, -13, 11, spin);
    disc(g, 23.5, -14, 11, spin + 1);
    led(g, RED, -23.5, -10, 8);
    led(g, GREEN, 23.5, -11, 8);
  },

  // an enterprise hexacopter: three depths of arms around a hexagonal hub, a GPS mast and a camera underneath
  hexa(g, spin) {
    for (const [x, y, a, w] of [[16, -15, .3, 1.8], [26, -13, .42, 2.2], [35, -11, .55, 2.6]]) {
      for (const s of [-1, 1]) {
        tube(g, s * 6, -5, s * x, y + 5, w);
        motor(g, s * x, y + 1, 3.5 + w * .6, 4.5);
        disc(g, s * x, y, 11, spin + s * x, a);
      }
    }
    tube(g, -4, -12, -4, -20, 1.2, DARK);
    g.fillStyle = '#e9eef2';
    g.beginPath();
    g.roundRect(-7.5, -22, 7, 2.6, 1.3);
    g.fill();
    lit(g, '#2f8f8a', -11, 8, g => {
      g.moveTo(-17, -1); g.lineTo(-9, -11); g.lineTo(9, -11); g.lineTo(17, -1); g.lineTo(9, 8); g.lineTo(-9, 8);
      g.closePath();
    });
    g.strokeStyle = 'rgba(10,40,40,.35)';
    g.lineWidth = .8;
    g.beginPath();
    g.moveTo(-12, -1); g.lineTo(-6.5, -7.5); g.lineTo(6.5, -7.5); g.lineTo(12, -1); g.lineTo(6.5, 5); g.lineTo(-6.5, 5);
    g.closePath();
    g.stroke();
    // the battery slotted in on top, with its charge lights
    g.fillStyle = '#2b3a3c';
    g.beginPath();
    g.roundRect(-9, -13.5, 18, 3.5, 1);
    g.fill();
    g.fillStyle = '#7ef0c8';
    for (const x of [3, 5, 7]) g.fillRect(x - .5, -12.5, 1, 1);
    g.fillStyle = DARK;
    g.fillRect(-1, 8, 2, 1.5);
    lit(g, '#3d4a52', 9, 13, g => g.roundRect(-4.5, 9, 9, 4.5, 1.8));
    lens(g, 1.5, 11.25, 1.8);
    led(g, RED, -35, -8, 9);
    led(g, GREEN, 35, -8, 9);
    led(g, WARM, 0, -13, 9);
  },

  // a coaxial X8: a cargo bay on a pair of tubes, one motor above and one below the end of each
  x8(g, spin) {
    for (const s of [-1, 1]) {
      const x = s * 31;
      tube(g, s * 14, -6, x, -6, 4);
      g.fillStyle = DARK;
      g.fillRect(s * 21 - 1.5, -8.5, 3, 5);
      motor(g, x, -14, 6, 6);
      motor(g, x, -4, 6, 5.5);
      disc(g, x, -15, 15, spin + x);
      disc(g, x, 2.5, 15, spin + x + 1.4, .4);
    }
    lit(g, '#4f5d75', -11, 9, g => g.roundRect(-18, -11, 36, 20, 3));
    // two doors with their handles, a shipping label, and hazard stripes along the bottom
    g.strokeStyle = 'rgba(20,24,36,.55)';
    g.lineWidth = .9;
    g.strokeRect(-14, -7.5, 28, 11);
    g.beginPath();
    g.moveTo(0, -7.5); g.lineTo(0, 3.5);
    g.stroke();
    g.fillStyle = DARK;
    g.fillRect(-3, -3, 1.4, 3);
    g.fillRect(1.6, -3, 1.4, 3);
    g.fillStyle = '#e9eef2';
    g.fillRect(-12, -6, 7, 4.5);
    g.fillStyle = 'rgba(30,30,40,.7)';
    for (const x of [-11.3, -10, -9.2, -8, -7.3, -6.4]) g.fillRect(x, -5.2, .5, 2.6);
    g.fillStyle = '#ffc23d';
    for (let x = -15; x <= 9; x += 6) {
      g.beginPath();
      g.moveTo(x, 8.5); g.lineTo(x + 3, 8.5); g.lineTo(x + 5.5, 5); g.lineTo(x + 2.5, 5);
      g.fill();
    }
    g.fillStyle = '#e9eef2';
    g.beginPath();
    g.roundRect(-4, -13.5, 8, 2.5, 1.2);
    g.fill();
    led(g, RED, -31, -11, 10);
    led(g, GREEN, 31, -11, 10);
  },

  // a five-inch racer: carbon plates on red standoffs, the FPV camera up front,
  // an action camera tilted on a soft mount and the video antenna at the back
  fpv(g, spin) {
    tube(g, -11.5, -3, -18, -13, 1.2, DARK);
    g.fillStyle = '#2a2a30';
    dot(g, -18.5, -14, 1.8);
    g.fillStyle = TPU;
    g.fillRect(-13.5, -4.5, 3.5, 2.5);
    g.fillStyle = '#c8452f';
    g.fillRect(-8, -8, 1.4, 6);
    g.fillRect(6.5, -8, 1.4, 6);
    g.fillStyle = '#2c6e49';
    g.fillRect(-5, -6.5, 9, 4);
    g.fillStyle = '#e8492c';
    g.beginPath();
    g.roundRect(8.5, -8, 6, 6, 1.5);
    g.fill();
    lens(g, 13.5, -5, 2.4);
    g.fillStyle = '#17171d';
    g.fillRect(-24, -2, 48, 3);
    g.fillRect(-10, -9.5, 19, 1.6);
    if (!plain) {
      g.fillStyle = 'rgba(255,255,255,.14)';
      g.fillRect(-24, -2, 48, .8);
    }
    g.save();
    g.translate(0, -9.5);
    g.rotate(-.3);
    g.fillStyle = TPU;
    g.fillRect(-4, -1.5, 8, 1.5);
    lit(g, '#2a2a30', -8, -1.5, g => g.roundRect(-5, -8, 10, 6.5, 1.2));
    g.fillStyle = DARK;
    g.beginPath();
    g.roundRect(4.5, -6.8, 2.2, 4, .6);
    g.fill();
    g.fillStyle = LENS;
    g.fillRect(6.2, -6.2, .7, 2.8);
    g.fillStyle = RED;
    g.fillRect(-3.6, -7.4, 1.2, .9);
    g.restore();
    motor(g, -23, -7, 5, 5);
    motor(g, 23, -7, 5, 5);
    disc(g, -23, -8.5, 12, spin, .55, -.28);
    disc(g, 23, -8.5, 12, spin + 1, .55, -.28);
    led(g, RED, -23, -5, 8);
    led(g, GREEN, 23, -5, 8);
  },

  // an industrial lifter: thick hull, folding carbon arms with warning bands, big finned motors and a winch
  heavy(g, spin) {
    tube(g, -36, -4, 36, -4, 6);
    for (const s of [-1, 1]) {
      lit(g, '#d9a321', -8, 0, g => g.roundRect(s * 22 - 3, -8, 6, 8, 1));
      g.fillStyle = '#ffc23d';
      for (const x of [27, 30.5]) g.fillRect(s * x - .8, -7, 1.6, 6);
      g.fillStyle = DARK;
      g.beginPath();
      g.roundRect(s * 30 - 3.5, -1.5, 7, 3, 1);
      g.fill();
      motor(g, s * 36, -14, 9, 8);
      if (!plain) {
        g.fillStyle = 'rgba(255,255,255,.13)';
        for (let i = 0; i < 4; i++) g.fillRect(s * 36 - 3.5 + i * 2.2, -13, .7, 5.5);
      }
      disc(g, s * 36, -15.5, 21, spin + (s > 0 ? 1 : 0));
    }
    lit(g, '#d9a321', -12, 9, g => g.roundRect(-20, -12, 40, 21, 4));
    g.fillStyle = 'rgba(90,60,10,.55)';
    g.fillRect(-20, 3, 40, 1.2);
    g.fillRect(-4, -12, 1, 15);
    for (let i = 0; i < 4; i++) g.fillRect(7, -8.5 + i * 2.2, 9, 1);
    g.fillStyle = '#f6e7bd';
    g.fillRect(-16, -8.5, 8, 5);
    g.fillStyle = 'rgba(60,40,8,.6)';
    g.fillRect(-15, -7.3, 6, .8);
    g.fillRect(-15, -5.6, 4, .8);
    g.strokeStyle = DARK;
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(-7, -12); g.lineTo(-6, -15); g.lineTo(6, -15); g.lineTo(7, -12);
    g.stroke();
    tube(g, -15, -12, -16.5, -18, 1, DARK);
    tube(g, -12, -12, -12.5, -17, 1, DARK);
    g.fillStyle = DARK;
    g.beginPath();
    g.roundRect(-6, 8.5, 12, 4, 1.5);
    g.fill();
    g.fillStyle = '#8a8296';
    g.fillRect(-4, 10, 8, 1);
    led(g, RED, -36, -11, 12);
    led(g, GREEN, 36, -11, 12);
  },

  // a quadplane: lift motors on booms ahead of and behind the wing, twin fins, a pusher at the tail
  vtol(g, spin) {
    tube(g, -33, -4, 26, -4, 2.4, '#8d96a4');
    g.fillStyle = '#e8492c';
    g.beginPath();
    g.moveTo(-34, -4); g.lineTo(-37.5, -13); g.lineTo(-32.5, -13); g.lineTo(-28, -4);
    g.fill();
    motor(g, -24, -9.5, 5, 5);
    motor(g, 22.5, -9.5, 5, 5);
    g.fillStyle = DARK;
    g.fillRect(-23.5, -1.5, 3, 3);
    g.fillStyle = 'rgba(240,240,255,.2)';
    g.beginPath();
    g.ellipse(-24.5, .5, 1.8, 10, 0, 0, 7);
    g.fill();
    g.fillStyle = 'rgba(240,240,255,.5)';
    g.beginPath();
    g.ellipse(-24.5, .5, 1.3, 8.5 * sweep(spin * .8) + 1.5, 0, 0, 7);
    g.fill();
    lit(g, '#eef1f6', -5, 6.5, g => {
      g.moveTo(-21, 0);
      g.quadraticCurveTo(-18, -5, -6, -5);
      g.lineTo(16, -4);
      g.quadraticCurveTo(28, -3, 29, 1.5);
      g.quadraticCurveTo(28, 6, 16, 6.5);
      g.lineTo(-8, 6.5);
      g.quadraticCurveTo(-18, 6, -21, 0);
    });
    g.fillStyle = LENS;
    g.beginPath();
    g.ellipse(17, -2.2, 6, 2.4, 0, 0, 7);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,.55)';
    g.fillRect(14, -3.4, 4, .8);
    // the wing seen end-on, rounded edge forward
    g.fillStyle = '#c9ced8';
    g.beginPath();
    g.moveTo(-10, -3);
    g.quadraticCurveTo(-2, -7.5, 5, -4.8);
    g.quadraticCurveTo(7.5, -3.3, 4, -2.6);
    g.quadraticCurveTo(-3, -1.8, -10, -3);
    g.fill();
    g.fillStyle = DARK;
    g.fillRect(28.5, .8, 3.5, .7);
    g.fillRect(13.5, 6, 1.6, 1.5);
    g.fillStyle = '#3c4553';
    dot(g, 14.3, 9, 2.6);
    lens(g, 15, 9, 1.4);
    disc(g, -24, -11, 13, spin);
    disc(g, 22.5, -11, 13, spin + 1);
    led(g, RED, -35, -12, 8);
    led(g, GREEN, 29, 1, 8);
  },

  // a cinewhoop: props inside ducts, a cinema camera riding on top, the FPV camera at the front
  whoop(g, spin) {
    lit(g, '#2f3540', -8, 5, g => g.roundRect(-11, -8, 22, 13, 4));
    g.fillStyle = '#ffc23d';
    g.fillRect(-11, -1.5, 22, 1.6);
    lens(g, 10, -2.5, 2.8);
    tube(g, -9, -6, -13, -12, 1, DARK);
    g.fillStyle = TPU;
    g.fillRect(-4, -10, 9, 2);
    lit(g, '#1f2228', -16.5, -10, g => g.roundRect(-6, -16.5, 12, 6.5, 1.5));
    g.fillStyle = DARK;
    g.beginPath();
    g.roundRect(5.5, -15.5, 3.5, 4.5, .8);
    g.fill();
    g.fillStyle = LENS;
    g.fillRect(8.4, -14.8, .8, 3);
    g.fillStyle = RED;
    g.fillRect(-4.5, -15.5, 1.2, .9);
    for (const x of [-25, 25]) {
      lit(g, '#3a4250', -11, -3, g => g.roundRect(x - 15, -11, 30, 8, 4));
      g.fillStyle = '#161a21';
      g.beginPath();
      g.ellipse(x, -11, 13.5, 2.4, 0, 0, 7);
      g.fill();
      disc(g, x, -11.3, 12, spin + x, .5);
      g.strokeStyle = '#566173';
      g.lineWidth = 1.2;
      g.beginPath();
      g.ellipse(x, -11, 14, 2.6, 0, 0, Math.PI);
      g.stroke();
    }
    led(g, RED, -25, -6, 9);
    led(g, GREEN, 25, -6, 9);
  },

  // an inspection drone inside a geodesic cage, with a work light at the front
  cage(g, spin) {
    g.strokeStyle = 'rgba(139,149,163,.45)';
    g.lineWidth = 1.1;
    g.beginPath();
    g.ellipse(0, 0, 16, 6, 0, Math.PI, Math.PI * 2);
    g.moveTo(13.2, -9);
    g.ellipse(0, -9, 13.2, 3.4, 0, 0, Math.PI, true);
    g.moveTo(13.2, 9);
    g.ellipse(0, 9, 13.2, 3.4, 0, 0, Math.PI, true);
    g.stroke();
    motor(g, -7, -4, 3, 2);
    motor(g, 7, -4, 3, 2);
    disc(g, -7, -5, 8, spin, .55);
    disc(g, 7, -5, 8, spin + 1, .55);
    lit(g, '#e8492c', -3, 5, g => g.roundRect(-7, -3, 14, 8, 2));
    g.fillStyle = DARK;
    g.fillRect(-3, 5, 6, 2.5);
    g.fillStyle = '#fff6dc';
    g.beginPath();
    g.roundRect(5.5, -1.5, 2.5, 4.5, 1);
    g.fill();
    lens(g, 2.5, 1.5, 1.6);
    g.strokeStyle = '#8b95a3';
    g.lineWidth = 1.6;
    g.beginPath();
    g.arc(0, 0, 16, 0, 7);
    g.moveTo(16, 0);
    g.ellipse(0, 0, 16, 6, 0, 0, Math.PI);
    g.moveTo(13.2, -9);
    g.ellipse(0, -9, 13.2, 3.4, 0, 0, Math.PI);
    g.moveTo(13.2, 9);
    g.ellipse(0, 9, 13.2, 3.4, 0, 0, Math.PI);
    g.moveTo(0, -16);
    g.ellipse(0, 0, 8, 16, 0, -Math.PI / 2, Math.PI * 1.5);
    g.stroke();
    g.fillStyle = '#5d6673';
    for (const [x, y] of [[16, 0], [-16, 0], [0, -16], [0, 16], [13.2, -9], [-13.2, -9], [13.2, 9], [-13.2, 9]]) dot(g, x, y, 1.1);
    led(g, WARM, 8, .5, 10);
    led(g, RED, -11, -11, 7);
    led(g, GREEN, 11, -11, 7);
  },

  // a crop sprayer: a tall tank with its level window, drooping folded arms,
  // stacked rotors with a nozzle under each, and a terrain radar at the front
  agri(g, spin) {
    for (const s of [-1, 1]) {
      const x = s * 31;
      tube(g, s * 8, -10, x, -6, 3);
      g.fillStyle = DARK;
      dot(g, s * 17, -8.2, 2);
      motor(g, x, -13, 6, 6);
      motor(g, x, -5, 5, 5);
      g.fillStyle = '#7cc28f';
      g.fillRect(x - 1, 0, 2, 3);
      g.fillStyle = DARK;
      g.fillRect(x - 1.6, 3, 3.2, 1.2);
      disc(g, x, -14, 12, spin + x);
      disc(g, x, .5, 12, spin + x + 1.4, .4);
    }
    lit(g, '#e9eef2', -15, 6, g => g.roundRect(-11, -15, 22, 21, 5));
    g.fillStyle = '#7cc28f';
    g.fillRect(-11, -7, 22, 5);
    g.fillStyle = 'rgba(30,50,60,.28)';
    g.beginPath();
    g.roundRect(4, -12, 3.5, 15, 1.5);
    g.fill();
    g.fillStyle = '#5fae74';
    g.fillRect(4.5, -3, 2.5, 5.5);
    g.fillStyle = 'rgba(30,50,60,.5)';
    for (const y of [-9, -6, -3]) g.fillRect(2.6, y, 1.2, .6);
    g.fillStyle = DARK;
    g.beginPath();
    g.roundRect(-3.5, -17.5, 7, 3, 1);
    g.fill();
    g.fillRect(-12, 6, 3, 3);
    g.fillRect(9, 6, 3, 3);
    g.beginPath();
    g.roundRect(-4, 6, 8, 3, 1);
    g.fill();
    g.fillStyle = '#3c4553';
    g.beginPath();
    g.ellipse(11, 2, 2.4, 3.6, 0, -Math.PI / 2, Math.PI / 2);
    g.fill();
    led(g, RED, -31, -11, 9);
    led(g, GREEN, 31, -11, 9);
  },

  // a tandem-rotor lifter: a long hull with a tall pylon at the back, a short one at the nose, engines beside the back one
  tandem(g, spin) {
    lit(g, '#4d7097', -14, -5, g => {
      g.moveTo(-29, -5); g.lineTo(-25, -14); g.lineTo(-19, -14); g.lineTo(-15, -5);
      g.closePath();
    });
    lit(g, '#4d7097', -11, -5, g => {
      g.moveTo(17, -5); g.lineTo(20, -11); g.lineTo(24, -11); g.lineTo(27, -5);
      g.closePath();
    });
    g.fillStyle = DARK;
    g.fillRect(-23, -16, 2, 2.5);
    g.fillRect(21, -13, 2, 2.5);
    disc(g, -22, -15.5, 19, spin, .5);
    disc(g, 22, -12.5, 19, spin + 1, .5);
    lit(g, '#46658a', -10, -5, g => g.roundRect(-14, -10, 10, 5, 2));
    g.fillStyle = DARK;
    g.fillRect(-4.8, -9.3, 1, 3);
    lit(g, '#5a7fa6', -6, 6, g => g.roundRect(-30, -6, 60, 12, 6));
    lit(g, '#4a6c90', 3, 7, g => g.roundRect(-16, 3, 22, 4, 2));
    g.fillStyle = '#bfe0f2';
    g.beginPath();
    g.moveTo(16, -4); g.lineTo(23, -4);
    g.quadraticCurveTo(28, -3, 29, .5);
    g.lineTo(16, .5);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(30,45,70,.55)';
    g.fillRect(20, -4, .8, 4.5);
    g.fillRect(24.5, -3.6, .8, 4.1);
    g.fillStyle = '#bfe0f2';
    for (const x of [-21, -15, -9, -3, 3]) {
      g.beginPath();
      g.roundRect(x, -3, 3, 2.6, .8);
      g.fill();
    }
    g.strokeStyle = 'rgba(20,30,50,.45)';
    g.lineWidth = .8;
    g.strokeRect(9, -3.5, 4, 7.5);
    g.beginPath();
    g.moveTo(-29.5, 1); g.lineTo(-25, 5.5);
    g.stroke();
    led(g, RED, -30, 0, 8);
    led(g, GREEN, 30, 0, 8);
  },

  // a quad tiltrotor: a front and a back wing, each with a nacelle that swings forward with speed
  tilt(g, spin, pose) {
    g.fillStyle = '#e8492c';
    g.beginPath();
    g.moveTo(-28, 0); g.lineTo(-34, -11); g.lineTo(-25, -11); g.lineTo(-19, -1);
    g.fill();
    lit(g, '#d8dde6', -6, 5, g => {
      g.moveTo(-30, 0);
      g.quadraticCurveTo(-8, -8, 22, -4);
      g.quadraticCurveTo(30, 0, 22, 4);
      g.quadraticCurveTo(-8, 7, -30, 0);
    });
    g.fillStyle = '#c3c9d3';
    g.fillRect(-35, -1.2, 10, 1.4);
    g.fillStyle = LENS;
    g.beginPath();
    g.moveTo(12, -4.3); g.quadraticCurveTo(20, -4.6, 24, -1.5); g.lineTo(12, -1.5);
    g.closePath();
    g.fill();
    g.fillStyle = '#9fc6dd';
    for (const x of [-12, -7, -2, 3]) {
      g.beginPath();
      g.roundRect(x, -1.6, 2.4, 2, .6);
      g.fill();
    }
    g.fillStyle = '#e8492c';
    g.fillRect(-22, 2.2, 36, .8);
    const swing = pose.lean * 1.25;
    for (const x of [-16, 14]) {
      g.fillStyle = '#b3bac6';
      g.beginPath();
      g.ellipse(x, -3.5, 6.5, 1.4, 0, 0, 7);
      g.fill();
      g.save();
      g.translate(x, -3);
      g.rotate(swing);
      lit(g, '#5d6675', -10, 1, g => g.roundRect(-2.8, -10, 5.6, 11, 2.8));
      g.fillStyle = DARK;
      g.fillRect(-2.8, -5.5, 5.6, 1);
      g.fillStyle = '#e9edf3';
      g.beginPath();
      g.ellipse(0, -10.5, 2.2, 1.2, 0, 0, 7);
      g.fill();
      disc(g, 0, -11, 13, spin + x);
      g.restore();
    }
    led(g, RED, -32, -10, 7);
    led(g, GREEN, 26, -1, 7);
  },
};

// Where each aircraft carries its blinking strobes, red at the back and green at the front.
const STROBES = {
  courier: [-29, -3, 29, -3], miniFold: [-23.5, -5, 23.5, -6], hexa: [-35, -5.5, 35, -5.5], x8: [-33.5, -6, 33.5, -6],
  fpv: [-24.5, -.5, 24.5, -.5], heavy: [-36, -4, 36, -4], vtol: [-33, -4, 26, -4], whoop: [-25, -2.5, 25, -2.5],
  cage: [-16, 0, 16, 0], agri: [-33, -6, 33, -6], tandem: [-30, 0, 30, 0], tilt: [-30, 0, 28.5, 0],
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
  // a battery strapped under the frame, standing on foam pads
  belly(g) {
    g.fillStyle = '#3a3a40';
    g.fillRect(-9, 1, 18, 2);
    lit(g, '#ffc23d', 3, 12, g => g.roundRect(-10, 3, 20, 9, 1.5));
    g.fillStyle = '#26262c';
    g.fillRect(-10, 6, 20, 3);
    g.fillStyle = 'rgba(255,255,255,.55)';
    g.fillRect(-7, 7.2, 6, .6);
    g.fillStyle = '#e8492c';
    g.fillRect(-1.5, 1, 2.6, 11.5);
    g.strokeStyle = DARK;
    g.lineWidth = .9;
    g.beginPath();
    g.moveTo(-10, 4.5);
    g.quadraticCurveTo(-14, 5, -12.5, 9);
    g.stroke();
    g.fillStyle = DARK;
    g.beginPath();
    g.roundRect(-9, 12, 5, 3, 1);
    g.roundRect(4, 12, 5, 3, 1);
    g.fill();
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
  const [rx, ry, gx, gy] = STROBES[key] ?? STROBES.courier;
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
    g.fillRect(rx - 1.5, ry - 1.5, 3, 3);
    g.fillStyle = blink ? '#4dff8a' : '#1d5b33';
    g.fillRect(gx - 1.5, gy - 1.5, 3, 3);
  });
}
