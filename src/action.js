import { sfx } from './audio.js';
import { HAWKS, RINGS, RIVAL } from './config.js';
import { drawAirframe } from './drone.js';
import { ctx, glow, pop, view, X, Y } from './ui.js';
import { roofAt } from './world.js';

const lerp = (st, q, k) => q['p' + k] + (q[k] - q['p' + k]) * (st.blend ?? 1);

// Lays out the rings, hawks and rival for a job that has just started.
export function planMission(st, shop) {
  const t = st.order.t, del = st.del, from = st.d.x, span = t.x - from;
  const count = Math.min(RINGS.max, RINGS.min + Math.floor(del / RINGS.perDeliveries), Math.floor(Math.abs(span) / RINGS.spacing));
  st.rings = [];
  for (let i = 1; i <= count; i++) {
    const x = from + span * i / (count + 1);
    const y = Math.max(RINGS.ceiling, roofAt(x, RINGS.radius * 2) - RINGS.lift - Math.random() * RINGS.liftRange);
    st.rings.push({ x, y, done: false });
  }
  st.ringsHit = 0;

  const hawks = del < HAWKS.from ? 0 : del < HAWKS.twoFrom ? 1 : del < HAWKS.threeFrom ? 2 : 3;
  st.hawks = [];
  for (let i = 0; i < hawks; i++) {
    const x = from + span * (HAWKS.pathMin + Math.random() * HAWKS.pathRange), y = roofAt(x, HAWKS.orbit) - HAWKS.lift;
    st.hawks.push({ homeX: x, homeY: y, x, y, px: x, py: y, state: 'circle', t: 0, phase: Math.random() * 7 });
  }

  st.rival = null;
  if (del >= RIVAL.from && Math.random() < RIVAL.chance) {
    const x = shop.x + shop.w / 2, y = shop.top - RIVAL.padLift;
    st.rival = {
      x, y, px: x, py: y,
      wait: RIVAL.delayMin + Math.random() * RIVAL.delayRange,
      speed: Math.min(RIVAL.speedMax, RIVAL.speed + (del - RIVAL.from) * RIVAL.speedPerDelivery),
    };
  }
}

export function clearAction(st) {
  st.rings = [];
  st.rival = null;
  for (const h of st.hawks) if (h.state !== 'flee') { h.state = 'flee'; h.t = 0; }
}

function stepRings(st) {
  const d = st.d;
  for (const r of st.rings) {
    if (r.done || (st.lastX - r.x) * (d.x - r.x) > 0) continue;
    r.done = true;
    if (Math.abs(d.y - r.y) < RINGS.radius) {
      st.combo++;
      st.ringsHit++;
      const reward = RINGS.reward * st.combo;
      st.money += reward;
      pop(st, r.x, r.y - 40, `+$${reward}  x${st.combo}`, '#ffc23d');
      sfx('ring');
    } else if (st.combo) {
      st.combo = 0;
      pop(st, r.x, r.y - 40, 'Combo lost', '#c9b8d6');
    }
  }
  st.lastX = d.x;
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
  stepRings(st);
  stepHawks(st, dt);
  return stepRival(st, dt);
}

/* ---------- render ---------- */
// A ring is split so the drone can fly through it: back half before, front half after.
export function drawRings(st, front) {
  const { W, S } = view, c = RINGS, rx = c.radius * .42 * S, ry = c.radius * S;
  ctx.lineWidth = 5 * S;
  for (const r of st.rings) {
    if (r.done) continue;
    const sx = X(r.x), sy = Y(r.y);
    if (sx < -60 || sx > W + 60) continue;
    if (!front && !view.lowQ) glow(ctx, 'rgba(255,194,61,.3)', sx, sy, ry * 1.2);
    ctx.strokeStyle = front ? '#ffd86b' : '#c8922a';
    ctx.beginPath();
    ctx.ellipse(sx, sy, rx, ry, 0, front ? -Math.PI / 2 : Math.PI / 2, front ? Math.PI / 2 : Math.PI * 1.5);
    ctx.stroke();
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
