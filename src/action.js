import { sfx } from './audio.js';
import { BEACH, BOX, CARS, CONTRAST, DESERT, FOREST, MOUNTAIN, SNOW, DRONE, EAGLES, EDGE, G, GROUND, HAWKS, HEALTH, RIVAL } from './config.js';
import { currentModel, drawAirframe } from './drone.js';
import { ctx, glow, kickDust, pop, shade, showToast, view, X, Y } from './ui.js';
import { roofAt, world } from './world.js';

const lerp = (st, q, k) => q['p' + k] + (q[k] - q['p' + k]) * (st.blend ?? 1);

export const hawkCount = tier => (tier < HAWKS.from ? 0 : tier < HAWKS.twoFrom ? 1 : tier < HAWKS.threeFrom ? 2 : 3);
export const eagleCount = n => (n < EAGLES.first || n % EAGLES.every !== EAGLES.at ? 0 : n < EAGLES.twoFrom ? 1 : 2);
export const rivalSpeed = tier => Math.min(RIVAL.speedMax, RIVAL.speed + (tier - RIVAL.from) * RIVAL.speedPerDelivery);
export const carSpeed = tier => Math.min(CARS.speedMax, CARS.speedMin + tier * CARS.speedPerLevel);

const roadKind = i => (i % CARS.bikeEvery === 1 ? 'bike' : i % CARS.vanEvery === 2 ? 'van' : 'car');

// Traffic is under way from the moment a level opens. Each vehicle loops within its own stretch.
export function planTraffic(st) {
  const c = CARS, level = st.level, speed = carSpeed(level.tier);
  const fill = (lo, hi, v, kindOf, gap = 1) => {
    for (let x = lo, i = 0; x < hi; x += (c.spacing + Math.random() * c.spacingRange) * gap, i++) {
      const kind = kindOf(i);
      st.cars.push({ x, px: x, v, lo, hi, kind, paint: c.paint[i % c.paint.length], taxi: kind === 'car' && i % c.taxiEvery === 0 });
    }
  };
  st.cars = [];
  st.carDir = level.n % 2 ? 1 : -1;
  st.jam = false;
  if (level.calm) return;
  if (level.beach) for (const [a, b] of BEACH.sea) fill(a, b, speed * c.boatSpeed, () => 'boat');
  else if (level.desert) {
    fill(DESERT.from, DESERT.to, speed * c.buggySpeed, () => 'buggy', DESERT.trafficGap);
    fill(DESERT.from, DESERT.to, speed * c.camelSpeed, () => 'camel', DESERT.trafficGap);
  } else if (level.mountain) {
    fill(MOUNTAIN.from, MOUNTAIN.to, speed * c.buggySpeed, () => 'jeep', MOUNTAIN.trafficGap);
    fill(MOUNTAIN.from, MOUNTAIN.to, speed * c.camelSpeed, () => 'goat', MOUNTAIN.trafficGap);
  } else if (level.snow) {
    fill(SNOW.from, SNOW.to, speed * c.buggySpeed, () => 'sled', SNOW.trafficGap);
    fill(SNOW.from, SNOW.to, speed * c.camelSpeed * 1.4, () => 'deer', SNOW.trafficGap);
  } else if (level.forest) {
    fill(FOREST.from, FOREST.to, speed * c.buggySpeed, () => 'jeep', FOREST.trafficGap);
    fill(FOREST.from, FOREST.to, speed * c.camelSpeed * 1.4, () => 'deer', FOREST.trafficGap);
  } else fill(EDGE.left, BEACH.from, speed, roadKind);
}

// Returns true on the step a car meets the drone or the order. That car stops dead
// and the rest of the road brakes behind it.
export function stepTraffic(st, dt) {
  const c = CARS, { d, box } = st;
  const touches = (car, x, y, r) => {
    const s = c.shapes[car.kind];
    return Math.abs(x - car.x) < s.length / 2 + r && y + r > GROUND + (s.lane ?? c.lane) - s.height;
  };
  let met = false;
  for (const car of st.cars) {
    car.px = car.x;
    if (st.jam) car.v = Math.max(0, car.v - c.brake * dt);
    car.x += st.carDir * car.v * dt;
    if (car.x > car.hi || car.x < car.lo) car.x = car.px = car.x - st.carDir * (car.hi - car.lo);
    if (st.jam || st.wreck || st.level.training) continue;
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
  const t = st.order.next?.t ?? st.order.t, tier = st.tier, from = st.d.x, span = t.x - from;
  st.hawks = [];
  for (let i = 0; i < st.level.hawks; i++) {
    const x = from + span * (HAWKS.pathMin + Math.random() * HAWKS.pathRange), y = roofAt(x, HAWKS.orbit) - HAWKS.lift;
    st.hawks.push({ homeX: x, homeY: y, x, y, px: x, py: y, state: 'circle', t: 0, phase: Math.random() * 7 });
  }

  // an eagle guards the last leg, so a route has its order to lose on the way home
  st.eagles = [];
  const lastLeg = st.stopAt === st.level.stops.length - 1;
  for (let i = 0; lastLeg && i < (st.level.eagles ?? 0); i++) {
    const x = from + span * (EAGLES.pathMin + Math.random() * EAGLES.pathRange), y = roofAt(x, EAGLES.orbit) - EAGLES.lift;
    st.eagles.push({ homeX: x, homeY: y, x, y, px: x, py: y, state: 'soar', t: 0, phase: Math.random() * 7, aim: 0, pass: 0, tore: false });
  }

  st.rival = null;
  if (st.stop.rival) {
    const x = shop.x + shop.w / 2, y = shop.top - RIVAL.padLift;
    st.rival = {
      x, y, px: x, py: y,
      wait: RIVAL.delayMin + Math.random() * RIVAL.delayRange,
      speed: st.level.rivalSpeed,
    };
  }
}

export function clearAction(st) {
  st.rival = null;
  for (const h of st.hawks) if (h.state !== 'flee') { h.state = 'flee'; h.t = 0; }
  for (const e of st.eagles) if (e.state !== 'flee' && e.state !== 'dead') { e.state = 'flee'; e.t = 0; }
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

function markPrey(st, e) {
  const c = EAGLES;
  e.state = 'mark';
  e.t = 0;
  e.tore = false;
  sfx('eagle');
  if (e.pass) return;
  pop(st, e.x, e.y - c.reach, 'EAGLE!', '#ff5a3c');
  showToast('Eagle!', 'Dodge it. One hit brings you down', false);
}

function killEagle(st, e) {
  const c = EAGLES;
  e.state = 'dead';
  e.t = 0;
  e.vx = Math.cos(e.aim) * c.deadKick;
  e.vy = -c.deadKick;
  for (let i = 0; i < c.feathers; i++) {
    st.parts.push({ x: e.x, y: e.y, vx: (Math.random() - .5) * 260, vy: -Math.random() * 200, t: 0, crumb: 1, col: c.feather });
  }
}

// Returns true on the step an eagle reaches the aircraft.
export function stepEagles(st, dt) {
  const c = EAGLES, d = st.d, bx = st.box;
  let struck = false;
  for (const e of st.eagles) {
    e.px = e.x;
    e.py = e.y;
    e.t += dt;
    const gap = Math.hypot(d.x - e.x, d.y - e.y), want = Math.atan2(d.y - e.y, d.x - e.x);
    if (e.state === 'soar') {
      e.x = e.homeX + Math.cos(e.t * c.circleRate + e.phase) * c.orbit;
      e.y = e.homeY + Math.sin(e.t * c.circleRate * 2 + e.phase) * c.orbit * .3;
      if (st.has && gap < c.trigger) markPrey(st, e);
    } else if (e.state === 'mark') {
      e.aim = want;
      e.y -= c.markRise * dt;
      if (e.t > c.markTime) {
        e.state = 'dive';
        e.t = 0;
        sfx('whoosh');
      }
    } else if (e.state === 'dive') {
      const off = Math.atan2(Math.sin(want - e.aim), Math.cos(want - e.aim)), limit = c.turnRate * dt;
      e.aim += Math.max(-limit, Math.min(limit, off));
      e.x += Math.cos(e.aim) * c.diveSpeed * dt;
      e.y += Math.sin(e.aim) * c.diveSpeed * dt;
      if (gap < c.hitDist && !st.wreck && !st.falling) {
        struck = true;
        killEagle(st, e);
      } else if (st.has && !e.tore && Math.hypot(bx.x - e.x, bx.y - e.y) < c.boxDist) {
        e.tore = true;
        st.integ -= c.damage;
        st.shake = Math.max(st.shake, c.hitShake);
        pop(st, e.x, e.y - 24, 'Torn!', '#e8492c');
        sfx('box');
      } else if (Math.abs(off) > Math.PI / 2 || e.t > c.diveTime) {
        e.state = 'climb';
        e.t = 0;
      }
    } else if (e.state === 'climb') {
      e.x += Math.cos(e.aim) * c.climbSpeed * dt;
      e.y -= c.climbRise * dt;
      if (e.t > c.climbTime) {
        if (++e.pass < c.passes && st.has) markPrey(st, e);
        else {
          e.state = 'flee';
          e.t = 0;
        }
      }
    } else if (e.state === 'dead') {
      e.vy += G * dt;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
    } else {
      e.x += c.fleeX * dt * Math.sign(e.x - d.x || 1);
      e.y -= c.fleeY * dt;
    }
  }
  st.eagles = st.eagles.filter(e => (e.state === 'dead' ? e.t < c.deadLife && e.y < GROUND : e.state !== 'flee' || e.t < c.fleeTime));
  return struck;
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
function paintBike(car, light, L, H) {
  ctx.fillStyle = '#16121c';
  ctx.beginPath();
  for (const x of [-L * .36, L * .36]) {
    ctx.moveTo(x + 6, -6);
    ctx.arc(x, -6, 6, 0, 7);
  }
  ctx.fill();
  ctx.fillStyle = shade(car.paint, light);
  ctx.fillRect(-L * .34, -11, L * .68, 5);
  ctx.fillStyle = shade('#26303f', light);
  ctx.fillRect(-L * .1, -H + 2, L * .26, H - 12);
  ctx.fillStyle = shade(car.paint, Math.max(.8, light));
  ctx.beginPath();
  ctx.arc(L * .1, -H + 1, 4.5, 0, 7);
  ctx.fill();
}

function paintBoat(car, light, L, H) {
  ctx.fillStyle = 'rgba(255,255,255,.6)';
  ctx.fillRect(-L * 1.1, -3, L * .6, 2);
  ctx.fillStyle = shade(car.paint, light);
  ctx.beginPath();
  ctx.moveTo(-L / 2, -H * .6);
  ctx.lineTo(L / 2, -H * .6);
  ctx.lineTo(L * .3, 0);
  ctx.lineTo(-L * .44, 0);
  ctx.fill();
  ctx.fillStyle = shade('#26303f', Math.max(.7, light));
  ctx.fillRect(-L * .04, -H, L * .22, H * .4);
}

function paintBuggy(car, light, L, H) {
  ctx.fillStyle = '#16121c';
  ctx.beginPath();
  for (const x of [-L * .34, L * .34]) {
    ctx.moveTo(x + 8, -8);
    ctx.arc(x, -8, 8, 0, 7);
  }
  ctx.fill();
  ctx.fillStyle = shade(car.paint, light);
  ctx.beginPath();
  ctx.moveTo(-L * .46, -9); ctx.lineTo(-L * .4, -H * .52); ctx.lineTo(L * .3, -H * .52); ctx.lineTo(L * .48, -10); ctx.lineTo(L * .3, -7); ctx.lineTo(-L * .3, -7);
  ctx.fill();
  ctx.strokeStyle = shade('#2b2233', Math.max(.7, light));
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-L * .34, -H * .5); ctx.lineTo(-L * .2, -H); ctx.lineTo(L * .12, -H); ctx.lineTo(L * .24, -H * .5);
  ctx.stroke();
}

// A snowmobile: a ski up front curling at the tip, a track under the seat, a cowl and a small windscreen.
function paintSled(car, light, L, H) {
  ctx.strokeStyle = shade('#2b2233', Math.max(.7, light));
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-L * .05, -1.5); ctx.lineTo(L * .4, -1.5); ctx.quadraticCurveTo(L * .5, -1.5, L * .5, -7);
  ctx.moveTo(L * .2, -1.5); ctx.lineTo(L * .2, -9);
  ctx.stroke();
  ctx.fillStyle = '#16121c';
  ctx.beginPath();
  ctx.roundRect(-L * .46, -9, L * .5, 8, 4);
  ctx.fill();
  ctx.fillStyle = shade('#c94a3a', light);
  ctx.beginPath();
  ctx.moveTo(-L * .44, -9); ctx.lineTo(-L * .4, -H * .45); ctx.lineTo(L * .05, -H * .5); ctx.lineTo(L * .36, -H * .36); ctx.lineTo(L * .44, -10); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade('#2b2233', light);
  ctx.fillRect(-L * .38, -H * .62, L * .3, H * .14);
  ctx.fillStyle = shade('#bfe0f2', light);
  ctx.beginPath();
  ctx.moveTo(L * .02, -H * .5); ctx.lineTo(L * .1, -H * .82); ctx.lineTo(L * .16, -H * .47); ctx.closePath();
  ctx.fill();
}

function paintCamel(car, light, L, H) {
  const body = shade('#c99a5e', light), step = Math.sin(car.x * .06) * 4;
  ctx.strokeStyle = body;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  for (const [x, swing] of [[-L * .3, step], [-L * .18, -step], [L * .16, -step], [L * .28, step]]) {
    ctx.moveTo(x, -H * .46);
    ctx.lineTo(x + swing, 0);
  }
  ctx.stroke();
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, -H * .54, L * .36, H * .19, 0, 0, 7);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-L * .04, -H * .74, L * .17, H * .17, 0, 0, 7);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(L * .32, -H * .56);
  ctx.quadraticCurveTo(L * .42, -H * .56, L * .4, -H * .88);
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.ellipse(L * .45, -H * .92, L * .1, H * .07, 0, 0, 7);
  ctx.fill();
}

// goat: a pale coat and short horns in place of antlers
function paintDeer(car, light, L, H, coat = '#9c6b44', goat = false) {
  const body = shade(coat, light), step = Math.sin(car.x * .09) * 5;
  ctx.strokeStyle = body;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (const [x, swing] of [[-L * .28, step], [-L * .16, -step], [L * .18, -step], [L * .3, step]]) {
    ctx.moveTo(x, -H * .5);
    ctx.lineTo(x + swing, 0);
  }
  ctx.stroke();
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, -H * .58, L * .36, H * .16, 0, 0, 7);
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(L * .3, -H * .62);
  ctx.lineTo(L * .4, -H * .9);
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.ellipse(L * .45, -H * .92, L * .09, H * .07, 0, 0, 7);
  ctx.fill();
  ctx.strokeStyle = shade('#5a3a26', light);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  if (goat) {
    ctx.moveTo(L * .42, -H);
    ctx.quadraticCurveTo(L * .36, -H * 1.12, L * .3, -H * 1.04);
    ctx.stroke();
    return;
  }
  ctx.moveTo(L * .4, -H);
  ctx.lineTo(L * .34, -H * 1.18);
  ctx.moveTo(L * .37, -H * 1.08);
  ctx.lineTo(L * .3, -H * 1.12);
  ctx.moveTo(L * .44, -H);
  ctx.lineTo(L * .5, -H * 1.18);
  ctx.stroke();
}

// A side-on vehicle drawn facing right; the scale flips it for the other direction.
function paintCar(car, light) {
  const c = CARS, { length: L, height: H } = c.shapes[car.kind], van = car.kind === 'van', body = car.taxi ? '#f2c230' : car.paint;
  if (car.kind === 'bike') { paintBike(car, light, L, H); return; }
  if (car.kind === 'boat') { paintBoat(car, light, L, H); return; }
  if (car.kind === 'buggy') { paintBuggy(car, light, L, H); return; }
  if (car.kind === 'camel') { paintCamel(car, light, L, H); return; }
  if (car.kind === 'jeep') { paintBuggy({ ...car, paint: '#3f6e4e' }, light, L, H); return; }
  if (car.kind === 'deer') { paintDeer(car, light, L, H); return; }
  if (car.kind === 'goat') { paintDeer(car, light, L, H, '#ece6da', true); return; }
  if (car.kind === 'sled') { paintSled(car, light, L, H); return; }
  ctx.fillStyle = shade(body, light);
  ctx.beginPath();
  if (van) {
    ctx.moveTo(-L / 2, -5); ctx.lineTo(-L / 2, -H); ctx.lineTo(L * .3, -H); ctx.lineTo(L / 2, -H * .5); ctx.lineTo(L / 2, -5);
  } else {
    ctx.moveTo(-L / 2, -5); ctx.lineTo(-L / 2, -H * .58); ctx.lineTo(-L * .28, -H * .62); ctx.lineTo(-L * .16, -H);
    ctx.lineTo(L * .16, -H); ctx.lineTo(L * .3, -H * .6); ctx.lineTo(L / 2, -H * .5); ctx.lineTo(L / 2, -5);
  }
  ctx.fill();
  ctx.fillStyle = shade('#26303f', Math.max(.7, light));
  if (van) ctx.fillRect(L * .1, -H + 4, L * .2, H * .36);
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
  const S = view.S, c = CARS, pal = world.pal, flash = Math.sin(st.t * c.flashRate) > 0;
  for (const car of st.cars) {
    const s = c.shapes[car.kind], sx = X(lerp(st, car, 'x')), reach = s.length * 1.6 * S, y = Y(GROUND + (s.lane ?? c.lane));
    if (sx < -reach || sx > view.W + reach) continue;
    ctx.save();
    ctx.translate(sx, y);
    ctx.scale(S * st.carDir, S);
    paintCar(car, pal.light);
    if (st.jam && !car.v) {
      ctx.fillStyle = flash ? '#ffc23d' : '#7a5a1e';
      ctx.fillRect(-s.length / 2, -s.height * .32, 4, 4);
      ctx.fillRect(s.length / 2 - 4, -s.height * .32, 4, 4);
    }
    ctx.restore();
    if (pal.windowGlow > .5 && !view.lowQ && car.kind !== 'boat' && car.kind !== 'camel' && car.kind !== 'deer' && car.kind !== 'goat') glow(ctx, 'rgba(255,233,168,.55)', sx + st.carDir * (s.length / 2 + 12) * S, y - s.height * .4 * S, 26 * S);
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

// A broad wing from the shoulder, drawn side on, splitting into finger feathers at the tip. lift is 1 at the top of the beat.
function eagleWing(lift, col) {
  const y = -6 - 34 * lift, x = -16;
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(11, -3);
  ctx.quadraticCurveTo(7, y * .7, x + 9, y);
  ctx.lineTo(x + 4, y - 7);
  ctx.lineTo(x + 2, y + 1);
  ctx.lineTo(x - 4, y - 4);
  ctx.lineTo(x - 3, y + 5);
  ctx.lineTo(x - 10, y + 1);
  ctx.lineTo(x - 6, y + 10);
  ctx.quadraticCurveTo(-17, y * .35, -13, -2);
  ctx.closePath();
  ctx.fill();
}

// Facing +x: dark body, white head and fanned white tail, a hooked yellow beak and talons that come forward to strike.
function paintEagle(st, e, lift, hunting) {
  eagleWing(lift * .86 + .1, '#2a1d14');
  ctx.fillStyle = '#efe9dc';
  ctx.beginPath();
  ctx.moveTo(-16, -3);
  ctx.lineTo(-34, -8);
  ctx.lineTo(-37, -1);
  ctx.lineTo(-34, 6);
  ctx.lineTo(-16, 3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#3b2a1d';
  ctx.beginPath();
  ctx.moveTo(22, -5);
  ctx.quadraticCurveTo(8, -11, -15, -5);
  ctx.lineTo(-20, 0);
  ctx.quadraticCurveTo(0, 9, 21, 4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#f2b632';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const reach = hunting ? 8 : 2;
  ctx.moveTo(0, 5);
  ctx.lineTo(reach, 12);
  ctx.moveTo(-6, 5);
  ctx.lineTo(reach - 6, 12);
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.fillStyle = '#f4efe4';
  ctx.beginPath();
  ctx.arc(21, -3, 7.5, 0, 7);
  ctx.fill();
  ctx.fillStyle = '#f2b632';
  ctx.beginPath();
  ctx.moveTo(26, -7);
  ctx.quadraticCurveTo(37, -7, 35.5, 2);
  ctx.quadraticCurveTo(33, -1, 26.5, -1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = hunting ? '#e8201c' : '#2a1d14';
  ctx.beginPath();
  ctx.arc(24, -5, 1.7, 0, 7);
  ctx.fill();
  eagleWing(lift, '#4a3424');
}

export function drawEagles(st) {
  const S = view.S, c = EAGLES, d = st.d;
  for (const e of st.eagles) {
    const sx = X(lerp(st, e, 'x')), sy = Y(lerp(st, e, 'y')), reach = c.reach * c.scale * S * 1.2, dead = e.state === 'dead';
    if (sx < -reach || sx > view.W + reach) continue;
    const hunting = e.state === 'mark' || e.state === 'dive', stoop = e.state === 'dive', level = e.state === 'soar' || e.state === 'flee' || e.state === 'climb';
    const heading = level ? 0 : e.aim, face = e.state === 'soar' ? (-Math.sin(e.t * c.circleRate + e.phase) >= 0 ? 1 : -1) : (e.x >= e.px ? 1 : -1);
    const beat = Math.sin(st.t * (hunting ? c.stoopFlap : c.flap) + e.phase), lift = dead ? -.3 : stoop ? .12 + beat * .04 : .4 + beat * .6;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(face * S * c.scale, S * c.scale);
    ctx.rotate(dead ? e.t * c.deadSpin : face > 0 ? heading : Math.PI - heading);
    if (e.state === 'mark' && !view.lowQ) glow(ctx, 'rgba(255,70,50,.55)', 0, 0, 60);
    paintEagle(st, e, lift, hunting);
    ctx.restore();
  }
  const prey = st.eagles.find(e => e.state === 'mark' || e.state === 'dive');
  if (!prey || st.wreck || st.outcome || st.done) return;
  // like a hit marker, an arc around the aircraft points the way the danger is coming from, on screen or off it
  const x = X(d.x), y = Y(d.y), a = Math.atan2(prey.y - d.y, prey.x - d.x), r = Math.max(c.alarmMin, c.alarmRadius * S);
  ctx.save();
  ctx.globalAlpha = .55 + .45 * Math.sin(st.t * c.alarmRate);
  ctx.lineCap = 'round';
  ctx.lineWidth = c.alarmWidth;
  ctx.strokeStyle = c.alarmColor;
  ctx.beginPath();
  ctx.arc(x, y, r, a - c.alarmSpread, a + c.alarmSpread);
  ctx.stroke();
  ctx.restore();
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
  const S = view.S, dir = st.boostDir, x = X(st.d.x), y = Y(st.d.y), tail = 34 * CONTRAST.scale;
  ctx.strokeStyle = 'rgba(255,243,223,.5)';
  ctx.lineWidth = 2 * S;
  ctx.beginPath();
  for (const [off, len] of [[-9, 34], [0, 48], [9, 30]]) {
    ctx.moveTo(x - dir * tail * S, y + off * S);
    ctx.lineTo(x - dir * (tail + len) * S, y + off * S);
  }
  ctx.stroke();
}
