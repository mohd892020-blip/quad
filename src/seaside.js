import { BEACH, BOX, CITY, DRONE, GROUND } from './config.js';
import { ctx, shade, view, X, Y } from './ui.js';
import { world, zoneAt } from './world.js';

// The open coast past the city: sand, sea and an island, with nothing tall in the way.
// The layout is laid by hand in BEACH, so its levels read the same on every run.
export const seaAt = x => BEACH.sea.some(([a, b]) => x > a && x < b);

export function touchesSea(st) {
  const { d, box } = st, surface = GROUND - 1;
  return (seaAt(d.x) && d.y + DRONE.radius >= surface) || (st.has && seaAt(box.x) && box.y + BOX.padY * st.item.size >= surface);
}

export function kiosk(spot, idx, c = BEACH) {
  const w = CITY.restaurant.w, b = {
    x: spot.x, w, h: c.kioskH, top: GROUND - c.kioskH, zone: zoneAt(spot.x), col: c.kioskColor, idx, bal: [], tank: null, dish: null, lit: [], cols: 0, rows: 0, shop: spot.shop,
  };
  return b;
}

// Everything on the coast: what can be struck, who can be served, and what is only scenery.
export function buildSeaside(firstIdx) {
  const c = BEACH, solids = [], targets = [], kiosks = c.kiosks.map((s, i) => kiosk(s, firstIdx + i));
  const deck = GROUND - c.deckH;
  for (const b of kiosks) solids.push({ x: b.x, y: b.top, w: b.w, h: b.h, mat: 'wall' });
  for (const x of c.towers) {
    const y = GROUND - c.towerH, half = c.towerW / 2;
    solids.push({ x: x - half, y, w: c.towerW, h: c.plankH, mat: 'wood' });
    solids.push({ x: x - half, y: y + c.plankH, w: c.legW, h: c.towerH - c.plankH, mat: 'wood' }, { x: x + half - c.legW, y: y + c.plankH, w: c.legW, h: c.towerH - c.plankH, mat: 'wood' });
    targets.push({ x, y: y - c.targetLift, kind: 'tower' });
  }
  for (const p of c.piers) {
    solids.push({ x: p.x, y: deck, w: p.w, h: c.plankH, mat: 'wood' });
    targets.push({ x: p.x + p.w - c.pierEnd, y: deck - c.targetLift, kind: 'pier' });
  }
  for (const b of c.boats) {
    solids.push({ x: b.x, y: deck, w: b.w, h: c.deckH, mat: 'wood' });
    solids.push({ x: b.x + b.w * c.mastAt, y: deck - c.mastH, w: c.mastW, h: c.mastH, mat: 'wood' });
    targets.push({ x: b.x + b.w * c.boatSpot, y: deck - c.targetLift, kind: 'boat' });
  }
  for (const x of c.towels) targets.push({ x, y: GROUND - c.targetLift, kind: 'sand' });
  return { kiosks, solids, targets };
}

const lit = (hex, time) => shade(hex, time.light);

// The far water, and a headland that closes off the skyline where the city ends.
export function drawSeaBehind() {
  const { W, H, S } = view, c = BEACH, time = world.pal, x0 = X(c.from);
  if (x0 >= W) return;
  const left = Math.max(0, x0), top = Y(GROUND - c.horizon);
  ctx.fillStyle = time.sea;
  ctx.fillRect(left, top, W - left, Math.max(H, Y(GROUND)) - top);
  ctx.fillStyle = time.far1;
  ctx.beginPath();
  ctx.ellipse(x0, Y(GROUND), c.headland * S, c.headlandH * S, 0, 0, 7);
  ctx.fill();
}

function drawWaves(st, a, b) {
  const { W, S } = view, c = BEACH, y = Y(GROUND), left = Math.max(0, X(a)), right = Math.min(W, X(b));
  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.lineWidth = 2 * S;
  ctx.beginPath();
  for (let x = left; x <= right; x += c.waveStep * S) {
    const wy = y + Math.sin(x / S / c.waveLength + st.t * c.waveRate) * c.waveHeight * S;
    if (x === left) ctx.moveTo(x, wy);
    else ctx.lineTo(x, wy);
  }
  ctx.stroke();
}

function drawTower(x, time) {
  const c = BEACH, S = view.S, half = c.towerW / 2, y = GROUND - c.towerH;
  ctx.fillStyle = lit('#b98a56', time);
  ctx.fillRect(X(x - half), Y(y), c.towerW * S, c.plankH * S);
  ctx.fillRect(X(x - half), Y(y), c.legW * S, c.towerH * S);
  ctx.fillRect(X(x + half - c.legW), Y(y), c.legW * S, c.towerH * S);
  ctx.fillStyle = lit('#e8492c', time);
  ctx.fillRect(X(x - half + 8), Y(y - c.flagH), 3 * S, c.flagH * S);
  ctx.beginPath();
  ctx.moveTo(X(x - half + 11), Y(y - c.flagH));
  ctx.lineTo(X(x - half + 28), Y(y - c.flagH + 6));
  ctx.lineTo(X(x - half + 11), Y(y - c.flagH + 12));
  ctx.fill();
}

function drawPier(p, time) {
  const c = BEACH, S = view.S, deck = GROUND - c.deckH;
  ctx.fillStyle = lit('#8f6a44', time);
  for (let x = p.x + c.pileGap / 2; x < p.x + p.w; x += c.pileGap) ctx.fillRect(X(x), Y(deck), c.legW * S, (c.deckH + c.pileDrop) * S);
  ctx.fillStyle = lit('#b98a56', time);
  ctx.fillRect(X(p.x), Y(deck), p.w * S, c.plankH * S);
}

function drawBoat(b, st, time) {
  const c = BEACH, S = view.S, bob = Math.sin(st.t * c.bobRate + b.x) * c.bob, deck = GROUND - c.deckH + bob;
  ctx.fillStyle = lit(b.paint, time);
  ctx.beginPath();
  ctx.moveTo(X(b.x), Y(deck));
  ctx.lineTo(X(b.x + b.w), Y(deck));
  ctx.lineTo(X(b.x + b.w * .86), Y(deck + c.deckH + c.pileDrop));
  ctx.lineTo(X(b.x + b.w * .12), Y(deck + c.deckH + c.pileDrop));
  ctx.fill();
  ctx.fillStyle = lit('#f2efe6', time);
  ctx.fillRect(X(b.x), Y(deck), b.w * S, 3 * S);
  const mast = b.x + b.w * c.mastAt;
  ctx.fillStyle = lit('#8f6a44', time);
  ctx.fillRect(X(mast), Y(deck - c.mastH), c.mastW * S, c.mastH * S);
  ctx.fillStyle = lit('#f2efe6', time);
  ctx.beginPath();
  ctx.moveTo(X(mast + c.mastW), Y(deck - c.mastH));
  ctx.lineTo(X(mast + c.mastW + b.w * .3), Y(deck - c.mastH * .2));
  ctx.lineTo(X(mast + c.mastW), Y(deck - c.mastH * .2));
  ctx.fill();
}

export function drawPalm(x, st, time) {
  const c = BEACH, S = view.S, top = GROUND - c.palmH, sway = Math.sin(st.t * 1.2 + x) * 3;
  ctx.strokeStyle = lit('#8f6a44', time);
  ctx.lineWidth = 6 * S;
  ctx.beginPath();
  ctx.moveTo(X(x), Y(GROUND));
  ctx.quadraticCurveTo(X(x + 10), Y(GROUND - c.palmH * .5), X(x + sway), Y(top));
  ctx.stroke();
  ctx.strokeStyle = lit('#3a8f6b', time);
  ctx.lineWidth = 5 * S;
  ctx.beginPath();
  for (const lean of [-1, -.45, .45, 1]) {
    ctx.moveTo(X(x + sway), Y(top));
    ctx.quadraticCurveTo(X(x + sway + lean * 22), Y(top - 16), X(x + sway + lean * 42), Y(top + 12));
  }
  ctx.stroke();
}

function drawUmbrella(x, time, i) {
  const S = view.S, y = GROUND, top = y - BEACH.umbrellaH;
  ctx.fillStyle = lit('#8f6a44', time);
  ctx.fillRect(X(x), Y(top), 2 * S, BEACH.umbrellaH * S);
  ctx.fillStyle = lit(BEACH.umbrellaPaint[i % BEACH.umbrellaPaint.length], time);
  ctx.beginPath();
  ctx.arc(X(x), Y(top), 26 * S, Math.PI, 0);
  ctx.fill();
}

// The ground of the coast, painted over the street once the city has been drawn.
export function drawShore(st) {
  const { W, H } = view, c = BEACH, time = world.pal, x0 = X(c.from);
  if (x0 >= W) return;
  const seen = x => X(x) > -c.seen * view.S && X(x) < W + c.seen * view.S, y = Y(GROUND);
  ctx.fillStyle = time.sand;
  ctx.fillRect(Math.max(0, x0), y, W, H);
  ctx.fillStyle = time.sea;
  for (const [a, b] of c.sea) {
    if (X(b) < 0 || X(a) > W) continue;
    ctx.fillRect(X(a), y, X(b) - X(a), H);
    drawWaves(st, a, b);
  }
  for (const p of c.piers) if (seen(p.x) || seen(p.x + p.w)) drawPier(p, time);
  for (const b of c.boats) if (seen(b.x)) drawBoat(b, st, time);
  for (const x of c.towers) if (seen(x)) drawTower(x, time);
  for (const x of c.palms) if (seen(x)) drawPalm(x, st, time);
  c.umbrellas.forEach((x, i) => { if (seen(x)) drawUmbrella(x, time, i); });
}
