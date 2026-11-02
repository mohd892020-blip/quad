import { BOX, CITY, DESERT, DRONE, GROUND } from './config.js';
import { drawPalm, kiosk } from './seaside.js';
import { ctx, glow, shade, view, X, Y } from './ui.js';
import { world, zoneAt } from './world.js';

// The open desert past the coast: dunes, rock and quicksand, with only three stalls built on it.
// Like the coast it is laid by hand in DESERT, so its levels read the same on every run.
export const sinkAt = x => DESERT.sinks.some(([a, b]) => x > a && x < b);

export function touchesSink(st) {
  const { d, box } = st, surface = GROUND - 1;
  return (sinkAt(d.x) && d.y + DRONE.radius >= surface) || (st.has && sinkAt(box.x) && box.y + BOX.padY * st.item.size >= surface);
}

// Rock is drawn and struck like a building, so it gets the same depth and cached image.
function rock(x, w, h, idx) {
  return { x, w, h, top: GROUND - h, zone: zoneAt(x), col: DESERT.rockColor, idx, bal: [], tank: null, dish: null, lit: [], cols: 0, rows: 0, rock: true };
}

export function buildDesert(firstIdx) {
  const c = DESERT, kiosks = c.kiosks.map((s, i) => kiosk(s, firstIdx + i, c)), rocks = [], solids = [], targets = [];
  const spot = (x, y, kind) => targets.push({ x, y: y - c.targetLift, kind });
  const add = (x, w, h) => {
    const b = rock(x, w, h, firstIdx + kiosks.length + rocks.length);
    rocks.push(b);
    solids.push({ x, y: b.top, w, h, mat: 'rock' });
  };
  for (const b of kiosks) solids.push({ x: b.x, y: b.top, w: b.w, h: b.h, mat: 'wall' });
  for (const m of c.mesas) {
    add(m.x, m.w, m.h);
    spot(m.x + m.w / 2, GROUND - m.h, 'rock');
  }
  for (const a of c.arches) {
    add(a.x, c.archLeg, a.h);
    add(a.x + a.w - c.archLeg, c.archLeg, a.h);
    solids.push({ x: a.x, y: GROUND - a.h - c.archTop, w: a.w, h: c.archTop, mat: 'rock' });
    spot(a.x + a.w / 2, GROUND - a.h - c.archTop, 'rock');
  }
  for (const x of c.cacti) solids.push({ x: x - c.cactusW / 2, y: GROUND - c.cactusH, w: c.cactusW, h: c.cactusH, mat: 'cactus' });
  for (const x of c.camps) spot(x, GROUND, 'camp');
  for (const x of c.oases) spot(x, GROUND, 'oasis');
  return { kiosks, rocks, solids, targets };
}

const lit = (hex, time) => shade(hex, time.light);

// One range of dunes. par slows its drift with the camera; rise lifts it out of the beach.
function dune(par, height, swell, col) {
  const { W, S, cam } = view, c = DESERT, base = Y(GROUND), left = Math.max(0, X(c.from)), step = c.duneStep * S;
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(left, base);
  for (let sx = left; sx < W + step; sx += step) {
    const x = cam.x + sx / S, u = cam.x * par + sx / S, rise = Math.min(1, (x - c.from) / c.duneRise);
    ctx.lineTo(sx, base - rise * (height + swell * Math.sin(u / c.duneLong) + swell * .4 * Math.sin(u / c.duneShort)) * S);
  }
  ctx.lineTo(W, base);
  ctx.fill();
}

// The far dunes, in front of the sea and behind everything that stands on the sand.
export function drawDunes() {
  const c = DESERT, time = world.pal;
  if (X(c.from) >= view.W) return;
  dune(c.farDrift, c.farH, c.farSwell, time.duneFar);
  dune(c.nearDrift, c.nearH, c.nearSwell, time.duneNear);
}

// A dark pit with sand sliding in toward the middle. The trail crosses it in front, on a plank bridge.
function drawSink(a, b, st, time) {
  const S = view.S, c = DESERT, y = Y(GROUND + c.pitY), mid = (X(a) + X(b)) / 2, half = (X(b) - X(a)) / 2, deep = c.pitH * S;
  ctx.fillStyle = shade(time.dune, c.sinkShade);
  ctx.beginPath();
  ctx.ellipse(mid, y, half, deep, 0, 0, 7);
  ctx.fill();
  ctx.strokeStyle = shade(time.dune, c.sinkLine);
  ctx.lineWidth = 2 * S;
  ctx.beginPath();
  for (let i = 0; i < c.sinkRings; i++) {
    const k = 1 - ((st.t * c.sinkRate + i / c.sinkRings) % 1);
    ctx.moveTo(mid + half * k, y);
    ctx.ellipse(mid, y, half * k, deep * k, 0, 0, 7);
  }
  ctx.stroke();
  ctx.fillStyle = lit('#a87c50', time);
  ctx.fillRect(X(a), Y(GROUND + c.deckY), X(b) - X(a), c.deckH * S);
  ctx.fillStyle = lit('#7f5b38', time);
  for (let x = a; x < b; x += c.plank) ctx.fillRect(X(x), Y(GROUND + c.deckY), 2 * S, c.deckH * S);
  for (const x of [a - c.signGap, b + c.signGap]) {
    ctx.fillStyle = lit('#8f6a44', time);
    ctx.fillRect(X(x) - 1.5 * S, Y(GROUND - c.signH), 3 * S, c.signH * S);
    ctx.fillStyle = lit('#ffc23d', time);
    ctx.save();
    ctx.translate(X(x), Y(GROUND - c.signH));
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-7 * S, -7 * S, 14 * S, 14 * S);
    ctx.restore();
  }
}

function drawCactus(x, time) {
  const S = view.S, c = DESERT, h = c.cactusH, y = GROUND;
  ctx.strokeStyle = lit('#3f7d4f', time);
  ctx.lineCap = 'round';
  ctx.lineWidth = 11 * S;
  ctx.beginPath();
  ctx.moveTo(X(x), Y(y));
  ctx.lineTo(X(x), Y(y - h + 5));
  ctx.stroke();
  ctx.lineWidth = 7 * S;
  ctx.beginPath();
  ctx.moveTo(X(x), Y(y - h * .48));
  ctx.quadraticCurveTo(X(x - 15), Y(y - h * .48), X(x - 15), Y(y - h * .74));
  ctx.moveTo(X(x), Y(y - h * .36));
  ctx.quadraticCurveTo(X(x + 15), Y(y - h * .36), X(x + 15), Y(y - h * .6));
  ctx.stroke();
  ctx.lineCap = 'butt';
}

function drawTent(x, time) {
  const S = view.S, c = DESERT, w = c.tentW, h = c.tentH, y = GROUND, left = x + c.tentAt;
  ctx.fillStyle = lit('#e8dcc0', time);
  ctx.beginPath();
  ctx.moveTo(X(left - w / 2), Y(y));
  ctx.lineTo(X(left), Y(y - h));
  ctx.lineTo(X(left + w / 2), Y(y));
  ctx.fill();
  ctx.fillStyle = lit('#b4553a', time);
  ctx.beginPath();
  ctx.moveTo(X(left - 12), Y(y));
  ctx.lineTo(X(left), Y(y - h * .62));
  ctx.lineTo(X(left + 12), Y(y));
  ctx.fill();
  ctx.fillStyle = lit('#b4553a', time);
  ctx.fillRect(X(left - w * .24), Y(y - h * .44), w * .48 * S, 4 * S);
  const fire = left + w / 2 + 18;
  ctx.fillStyle = '#ff9a3c';
  ctx.beginPath();
  ctx.arc(X(fire), Y(y - 4), 4 * S, 0, 7);
  ctx.fill();
  if (time.windowGlow > .3 && !view.lowQ) glow(ctx, 'rgba(255,170,80,.55)', X(fire), Y(y - 6), 34 * S);
}

function drawOasis(x, st, time) {
  const S = view.S, c = DESERT;
  ctx.fillStyle = time.sea;
  ctx.beginPath();
  ctx.ellipse(X(x + c.poolAt), Y(GROUND + 8), c.poolW / 2 * S, 7 * S, 0, 0, 7);
  ctx.fill();
  drawPalm(x + c.poolAt - c.poolW * .4, st, time);
  drawPalm(x + c.poolAt + c.poolW * .36, st, time);
}

function drawLintel(a, time) {
  const S = view.S, c = DESERT, y = GROUND - a.h - c.archTop;
  ctx.fillStyle = lit(c.rockColor, time);
  ctx.fillRect(X(a.x), Y(y), a.w * S, c.archTop * S);
  ctx.fillStyle = lit(c.rockCap, time);
  ctx.fillRect(X(a.x), Y(y), a.w * S, 6 * S);
  ctx.fillStyle = 'rgba(60,25,10,.18)';
  ctx.fillRect(X(a.x), Y(y + c.archTop - 6), a.w * S, 6 * S);
}

// The ground of the desert, painted over the coast's sand, and what stands on it.
export function drawDesert(st) {
  const { W, H, S } = view, c = DESERT, time = world.pal, x0 = X(c.from);
  if (x0 >= W) return;
  const seen = x => X(x) > -c.seen * S && X(x) < W + c.seen * S, y = Y(GROUND), left = Math.max(0, x0);
  ctx.fillStyle = time.dune;
  ctx.fillRect(left, y, W - left, H);
  ctx.strokeStyle = shade(time.dune, c.rippleShade);
  ctx.lineWidth = 1.5 * S;
  ctx.beginPath();
  for (const off of c.ripples) {
    for (let sx = left; sx <= W; sx += c.duneStep * S) {
      const wy = y + (off + Math.sin((view.cam.x + sx / S) / c.rippleLong + off) * 2) * S;
      if (sx === left) ctx.moveTo(sx, wy);
      else ctx.lineTo(sx, wy);
    }
  }
  ctx.stroke();
  for (const [a, b] of c.sinks) if (seen(a) || seen(b)) drawSink(a, b, st, time);
  for (const x of c.oases) if (seen(x)) drawOasis(x, st, time);
  for (const x of c.camps) if (seen(x)) drawTent(x, time);
  for (const x of c.cacti) if (seen(x)) drawCactus(x, time);
  for (const a of c.arches) if (seen(a.x) || seen(a.x + a.w)) drawLintel(a, time);
}

// The stronger the wind, the thicker the air: gusts cut how far the player can see.
export function drawSandstorm(st) {
  if (!st.level.desert) return;
  const { W, H, S } = view, c = DESERT, blow = Math.min(1, Math.abs(st.wind) / st.level.wind), storm = (blow - c.stormFrom) / (1 - c.stormFrom);
  if (storm <= 0) return;
  ctx.fillStyle = `rgba(${c.stormColor},${c.stormHaze * storm})`;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = `rgba(${c.stormColor},${c.stormLine * storm})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0, n = view.lowQ ? c.stormGrains / 2 : c.stormGrains; i < n; i++) {
    const y = (i * 137) % H, x = ((i * 311 + st.t * st.wind * 4) % W + W) % W, len = (30 + i % 5 * 14) * S;
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.sign(st.wind) * len, y + 2);
  }
  ctx.stroke();
}
