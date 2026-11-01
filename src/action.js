import { sfx } from './audio.js';
import { BOX, CARS, DRONE, EDGE, GROUND, HAWKS, HEALTH, RIVAL } from './config.js';
import { currentModel, drawAirframe } from './drone.js';
import { ctx, glow, kickDust, pop, shade, view, X, Y } from './ui.js';
import { roofAt, world } from './world.js';

const lerp = (st, q, k) => q['p' + k] + (q[k] - q['p' + k]) * (st.blend ?? 1);

export const hawkCount = tier => (tier < HAWKS.from ? 0 : tier < HAWKS.twoFrom ? 1 : tier < HAWKS.threeFrom ? 2 : 3);
export const rivalSpeed = tier => Math.min(RIVAL.speedMax, RIVAL.speed + (tier - RIVAL.from) * RIVAL.speedPerDelivery);
export const carSpeed = tier => Math.min(CARS.speedMax, CARS.speedMin + tier * CARS.speedPerLevel);

// The cars are on the road from the moment a street level opens.
export function planTraffic(st) {
  const c = CARS, level = st.level;
  st.cars = [];
  st.carDir = level.n % 2 ? 1 : -1;
  st.jam = false;
  if (!level.traffic) return;
  for (let x = EDGE.left, i = 0; x < EDGE.right; x += c.spacing + Math.random() * c.spacingRange, i++) {
    st.cars.push({ x, px: x, v: carSpeed(level.tier), paint: c.paint[i % c.paint.length], van: i % c.vanEvery === 1, taxi: i % c.taxiEvery === 2 });
  }
}

// Returns true on the step a car meets the drone or the order. That car stops dead
// and the rest of the road brakes behind it.
export function stepTraffic(st, dt) {
  const c = CARS, { d, box } = st, top = GROUND + c.lane - c.height, span = EDGE.right - EDGE.left;
  const touches = (car, x, y, r) => Math.abs(x - car.x) < c.length / 2 + r && y + r > top;
  let met = false;
  for (const car of st.cars) {
    car.px = car.x;
    if (st.jam) car.v = Math.max(0, car.v - c.brake * dt);
    car.x += st.carDir * car.v * dt;
    if (car.x > EDGE.right || car.x < EDGE.left) car.x = car.px = car.x - st.carDir * span;
    if (st.jam || st.wreck) continue;
    if (touches(car, d.x, d.y, DRONE.radius) || (st.has && touches(car, box.x, box.y, BOX.padX * st.item.size))) {
      car.v = 0;
      st.jam = met = true;
    }
  }
  if (met) {
    st.shake = Math.max(st.shake, c.shake);
    kickDust(st, d.x, GROUND, c.dust);
    sfx('crash');
  }
  return met;
}

// Lays out the hawks and rival for a job that has just started.
export function planMission(st, shop) {
  const t = st.order.t, tier = st.tier, from = st.d.x, span = t.x - from;
  st.hawks = [];
  for (let i = 0; i < st.level.hawks; i++) {
    const x = from + span * (HAWKS.pathMin + Math.random() * HAWKS.pathRange), y = roofAt(x, HAWKS.orbit) - HAWKS.lift;
    st.hawks.push({ homeX: x, homeY: y, x, y, px: x, py: y, state: 'circle', t: 0, phase: Math.random() * 7 });
  }

  st.rival = null;
  if (st.stop.rival) {
    const x = shop.x + shop.w / 2, y = shop.top - RIVAL.padLift;
    st.rival = {
      x, y, px: x, py: y,
      wait: RIVAL.delayMin + Math.random() * RIVAL.delayRange,
      speed: rivalSpeed(tier),
    };
  }
}

export function clearAction(st) {
  st.rival = null;
  for (const h of st.hawks) if (h.state !== 'flee') { h.state = 'flee'; h.t = 0; }
}

function stepHawks(st, dt) {
  const c = HAWKS, bx = st.box, d = st.d;
  for (const h of st.hawks) {
    h.px = h.x;
    h.py = h.y;
    h.t += dt;
    if (h.state === 'circle') {
      h.x = h.homeX + Math.cos(h.t * c.circleRate + h.phase) * c.orbit;
      h.y = h.homeY + Math.sin(h.t * c.circleRate * 2 + h.phase) * c.orbit * .3;
      if (st.has && Math.hypot(bx.x - h.x, bx.y - h.y) < c.trigger) {
        h.state = 'dive';
        h.t = 0;
        pop(st, h.x, h.y - 26, 'Hawk!', '#ff7a5c');
        sfx('hawk');
      }
    } else if (h.state === 'dive') {
      const dist = Math.hypot(bx.x - h.x, bx.y - h.y) || 1;
      h.x += (bx.x - h.x) / dist * c.diveSpeed * dt;
      h.y += (bx.y - h.y) / dist * c.diveSpeed * dt;
      if (Math.hypot(d.x - h.x, d.y - h.y) < c.shooDist) {
        h.state = 'flee';
        h.t = 0;
        pop(st, h.x, h.y - 24, 'Shoo!', '#4fc27c');
        st.hp = Math.max(0, st.hp - HEALTH.hawkHit / currentModel().tough);
      } else if (dist < c.hitDist) {
        h.state = 'flee';
        h.t = 0;
        st.integ -= c.damage;
        st.shake = Math.max(st.shake, c.hitShake);
        pop(st, h.x, h.y - 24, 'Snatched!', '#e8492c');
        sfx('box');
      } else if (h.t > c.diveTime) {
        h.state = 'flee';
        h.t = 0;
      }
    } else {
      h.x += c.fleeX * dt * Math.sign(h.x - d.x || 1);
      h.y -= c.fleeY * dt;
    }
  }
  st.hawks = st.hawks.filter(h => h.state !== 'flee' || h.t < c.fleeTime);
}

// Moves the rival over the rooftops; returns true on the step it reaches the customer.
function stepRival(st, dt) {
  const r = st.rival;
  if (!r) return false;
  r.px = r.x;
  r.py = r.y;
  if (r.wait > 0) {
    r.wait -= dt;
    return false;
  }
  const c = RIVAL, T = st.order.t, gap = T.x - r.x, step = r.speed * dt, close = Math.abs(gap) < c.approach;
  r.x += Math.max(-step, Math.min(step, gap));
  const wantY = close ? T.y - c.hover : roofAt(r.x + Math.sign(gap) * c.lookAhead, c.lookAhead) - c.clearance;
  r.y += (wantY - r.y) * Math.min(1, dt * c.climb);
  return Math.abs(gap) < c.arrive && Math.abs(r.y - (T.y - c.hover)) < c.arriveY;
}

export function stepAction(st, dt) {
  stepHawks(st, dt);
  return stepRival(st, dt);
}

/* ---------- render ---------- */
// A side-on car drawn facing right; the scale flips it for the other direction.
function paintCar(car, light) {
  const c = CARS, L = c.length, H = c.height, body = car.taxi ? '#f2c230' : car.paint;
  ctx.fillStyle = shade(body, light);
  ctx.beginPath();
  if (car.van) {
    ctx.moveTo(-L / 2, -5); ctx.lineTo(-L / 2, -H); ctx.lineTo(L * .3, -H); ctx.lineTo(L / 2, -H * .5); ctx.lineTo(L / 2, -5);
  } else {
    ctx.moveTo(-L / 2, -5); ctx.lineTo(-L / 2, -H * .58); ctx.lineTo(-L * .28, -H * .62); ctx.lineTo(-L * .16, -H);
    ctx.lineTo(L * .16, -H); ctx.lineTo(L * .3, -H * .6); ctx.lineTo(L / 2, -H * .5); ctx.lineTo(L / 2, -5);
  }
  ctx.fill();
  ctx.fillStyle = shade('#26303f', Math.max(.7, light));
  if (car.van) ctx.fillRect(L * .1, -H + 4, L * .2, H * .36);
  else ctx.fillRect(-L * .12, -H + 3, L * .32, H * .3);
  if (car.taxi) {
    ctx.fillStyle = '#2b1b14';
    ctx.fillRect(-L * .09, -H - 4, L * .18, 4);
  }
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(L / 2 - 3, -H * .46, 3, 4);
  ctx.fillStyle = '#e8492c';
  ctx.fillRect(-L / 2, -H * .5, 3, 4);
  ctx.fillStyle = '#16121c';
  ctx.beginPath();
  for (const x of [-L * .3, L * .3]) {
    ctx.moveTo(x + 6, -5);
    ctx.arc(x, -5, 6, 0, 7);
  }
  ctx.fill();
}

export function drawCars(st) {
  if (!st.cars) return;
  const S = view.S, c = CARS, pal = world.pal, flash = Math.sin(st.t * c.flashRate) > 0, y = Y(GROUND + c.lane);
  for (const car of st.cars) {
    const sx = X(lerp(st, car, 'x')), reach = c.length * S;
    if (sx < -reach || sx > view.W + reach) continue;
    ctx.save();
    ctx.translate(sx, y);
    ctx.scale(S * st.carDir, S);
    paintCar(car, pal.light);
    if (st.jam && !car.v) {
      ctx.fillStyle = flash ? '#ffc23d' : '#7a5a1e';
      ctx.fillRect(-c.length / 2, -c.height * .32, 4, 4);
      ctx.fillRect(c.length / 2 - 4, -c.height * .32, 4, 4);
    }
    ctx.restore();
    if (pal.windowGlow > .5 && !view.lowQ) glow(ctx, 'rgba(255,233,168,.55)', sx + st.carDir * (c.length / 2 + 12) * S, y - c.height * .4 * S, 26 * S);
  }
}

export function drawHawks(st) {
  const S = view.S;
  for (const h of st.hawks) {
    const hx = lerp(st, h, 'x'), hy = lerp(st, h, 'y'), sx = X(hx), sy = Y(hy);
    if (sx < -40 || sx > view.W + 40) continue;
    const wing = Math.sin(st.t * (h.state === 'dive' ? 26 : 14) + h.phase) * 9 * S;
    const face = h.state === 'circle' ? -Math.sin(st.t * HAWKS.circleRate + h.phase) : (h.x >= h.px ? 1 : -1);
    ctx.strokeStyle = '#4a3324';
    ctx.lineWidth = 3 * S;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx - 15 * S, sy - wing);
    ctx.quadraticCurveTo(sx - 6 * S, sy - 4 * S, sx, sy);
    ctx.quadraticCurveTo(sx + 6 * S, sy - 4 * S, sx + 15 * S, sy - wing);
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.fillStyle = '#6b4a30';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 1 * S, 8 * S, 3.5 * S, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#ffc23d';
    ctx.fillRect(sx + Math.sign(face || 1) * 8 * S - 1.5 * S, sy, 3 * S, 2.5 * S);
  }
}

export function drawRival(st) {
  const r = st.rival;
  if (!r) return;
  const sx = X(lerp(st, r, 'x')), sy = Y(lerp(st, r, 'y')), S = view.S;
  if (sx < -60 || sx > view.W + 60) return;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(S * RIVAL.scale, S * RIVAL.scale);
  drawAirframe(ctx, 'fpv', st.t);
  ctx.fillStyle = '#e8492c';
  ctx.fillRect(-24, -2, 48, 3);
  ctx.restore();
  ctx.font = `${Math.round(13 * S)}px Lalezar,Tajawal,sans-serif`;
  ctx.textAlign = 'center';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(20,15,40,.8)';
  ctx.strokeText('RIVAL', sx, sy - 22 * S);
  ctx.fillStyle = '#ff7a5c';
  ctx.fillText('RIVAL', sx, sy - 22 * S);
}

export function drawBoost(st) {
  if (!st.boosting) return;
  const S = view.S, dir = st.boostDir, x = X(st.d.x), y = Y(st.d.y);
  ctx.strokeStyle = 'rgba(255,243,223,.5)';
  ctx.lineWidth = 2 * S;
  ctx.beginPath();
  for (const [off, len] of [[-9, 34], [0, 48], [9, 30]]) {
    ctx.moveTo(x - dir * 34 * S, y + off * S);
    ctx.lineTo(x - dir * (34 + len) * S, y + off * S);
  }
  ctx.stroke();
}
