import { BOX, DRONE, FOREST, GROUND } from './config.js';
import { kiosk } from './seaside.js';
import { ctx, glow, ridgePoints, shade, view, X, Y } from './ui.js';
import { rng, world, zoneAt } from './world.js';

// The forest past the desert: tall pines that sway with the wind, sod-roofed cabins, houses up in the trees, a lookout
// tower and a river crossed on a log bridge. Landmarks are laid by hand in FOREST; the pines grow from a seed around them.
export const riverAt = x => FOREST.rivers.some(([a, b]) => x > a && x < b);

export function touchesRiver(st) {
  const { d, box } = st, surface = GROUND - 1;
  return (riverAt(d.x) && d.y + DRONE.radius >= surface) || (st.has && riverAt(box.x) && box.y + BOX.padY * st.item.size >= surface);
}

const cabin = (x, w, h, idx) => ({ x, w, h, top: GROUND - h, zone: zoneAt(x), col: FOREST.logColor, idx, bal: [], tank: null, dish: null, lit: [], cols: 0, rows: 0, cabin: true });

// A pine's solid parts: its trunk, and the core of each tier of needles, narrower than the drawn tier so a brush is fair.
function pineSolids(t) {
  const c = FOREST, solids = [{ x: t.x - c.trunkW / 2, y: GROUND - t.h * c.trunkShare, w: c.trunkW, h: t.h * c.trunkShare, mat: 'wood' }];
  for (const [base, top, half] of tiers(t)) solids.push({ x: t.x - half * c.core, y: top + (base - top) * c.coreFrom, w: half * c.core * 2, h: (base - top) * (1 - c.coreFrom), mat: 'tree' });
  return solids;
}

// Each tier as [base y, top y, half width], bottom first.
function tiers(t) {
  const c = FOREST, out = [];
  for (let i = 0; i < c.tiers; i++) {
    const base = GROUND - t.h * (c.tierFrom + i * c.tierStep), top = base - t.h * c.tierTall;
    out.push([base, top, t.w / 2 * (1 - i * c.tierShrink)]);
  }
  return out;
}

// Pines grow from a seed every pineGap to pineGap + pineGapRange inside a region, clear of the stretches in keep.
export function growPines(c, keep) {
  const r = rng(c.seed), pines = [];
  for (let x = c.from + c.edge; x < c.to - c.edge; x += c.pineGap + r() * c.pineGapRange) {
    const t = { x, h: c.pineH[0] + r() * (c.pineH[1] - c.pineH[0]), w: c.pineW[0] + r() * (c.pineW[1] - c.pineW[0]), phase: r() * 7 };
    if (keep.some(([a, b]) => x + t.w / 2 > a && x - t.w / 2 < b)) continue;
    t.solids = pineSolids(t);
    pines.push(t);
  }
  return pines;
}

export function buildForest(firstIdx) {
  const c = FOREST, kiosks = c.kiosks.map((s, i) => kiosk(s, firstIdx + i, c)), cabins = [], solids = [], targets = [], pines = [];
  const spot = (x, y, kind) => targets.push({ x, y: y - c.targetLift, kind });
  for (const b of kiosks) solids.push({ x: b.x, y: b.top, w: b.w, h: b.h, mat: 'wood' });
  for (const k of c.cabins) {
    const b = cabin(k.x, k.w, k.h, firstIdx + kiosks.length + cabins.length);
    cabins.push(b);
    solids.push({ x: b.x, y: b.top, w: b.w, h: b.h, mat: 'wood' });
    spot(b.x + b.w * .6, b.top, 'cabin');
  }
  for (const h of c.treehouses) {
    const deck = GROUND - h.h;
    solids.push({ x: h.x - c.houseTrunk / 2, y: deck - c.crownLift - c.crownH, w: c.houseTrunk, h: h.h + c.crownLift + c.crownH, mat: 'wood' });
    solids.push({ x: h.x - c.deckBack, y: deck, w: c.deckBack + c.deckOut, h: c.deckH, mat: 'wood' });
    solids.push({ x: h.x - c.crownW / 2, y: deck - c.crownLift - c.crownH, w: c.crownW, h: c.crownH, mat: 'tree' });
    spot(h.x + c.deckOut - c.deckEdge, deck, 'treehouse');
  }
  for (const x of c.lookouts) {
    const top = GROUND - c.lookoutH, half = c.lookoutW / 2;
    solids.push({ x: x - half, y: top, w: c.lookoutW, h: c.plankH, mat: 'wood' });
    solids.push({ x: x - half, y: top + c.plankH, w: c.legW, h: c.lookoutH - c.plankH, mat: 'wood' }, { x: x + half - c.legW, y: top + c.plankH, w: c.legW, h: c.lookoutH - c.plankH, mat: 'wood' });
    spot(x, top, 'lookout');
  }
  for (const x of c.clearings) spot(x, GROUND, 'clearing');
  // the pines grow where nothing else stands and no customer needs a clear way down
  const keep = [...c.kiosks.map(k => [k.x - c.clear, k.x + 240 + c.clear]), ...c.cabins.map(k => [k.x - c.clear, k.x + k.w + c.clear]),
    ...c.treehouses.map(h => [h.x - c.crownW, h.x + c.deckOut + c.clear]), ...c.lookouts.map(x => [x - c.clear, x + c.clear]), ...c.clearings.map(x => [x - c.clear, x + c.clear]),
    ...c.rivers.map(([a, b]) => [a - c.clear / 2, b + c.clear / 2])];
  pines.push(...growPines(c, keep));
  for (const t of pines) solids.push(...t.solids);
  return { kiosks, cabins, solids, targets, pines };
}

const lit = (hex, time) => shade(hex, time.light);

// A range of hills or treetops behind the forest. par slows its drift; rise lifts it out of the plain at the edge.
function ridge(par, height, swell, col, teeth) {
  const { W, S, cam } = view, c = FOREST, base = Y(GROUND), left = Math.max(0, X(c.from)), right = Math.min(W, X(c.to));
  if (right <= left) return;
  const pts = ridgePoints(par, c.ridgeStep, left, right);
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], base);
  for (const [sx, u] of pts) {
    const x = cam.x + sx / S, rise = Math.min(1, (x - c.from) / c.rise, (c.to - x) / c.rise);
    const tooth = teeth ? (Math.abs(((u / teeth) % 2 + 2) % 2 - 1)) * teeth * .9 : 0;
    ctx.lineTo(sx, base - Math.max(0, rise) * (height + swell * Math.sin(u / c.ridgeLong) + tooth) * S);
  }
  ctx.lineTo(pts[pts.length - 1][0], base);
  ctx.fill();
}

// Far hills, then two lines of pine tops, each nearer one drifting faster.
export function drawWoodsBehind() {
  const c = FOREST, time = world.pal;
  if (X(c.from) >= view.W || X(c.to) <= 0) return;
  ridge(c.hillDrift, c.hillH, c.hillSwell, time.hill, 0);
  ridge(c.farDrift, c.farH, c.farSwell, time.pineFar, c.farTeeth);
  if (!view.lowQ) ridge(c.nearDrift, c.nearH, c.nearSwell, time.pineNear, c.nearTeeth);
}

// snow: each tier wears a white cap
export function drawPine(t, st, time, snow = false) {
  const c = FOREST, S = view.S, sway = Math.sin(st.t * c.swayRate + t.phase) * c.sway + st.wind * c.windSway;
  ctx.fillStyle = lit(c.barkColor, time);
  ctx.fillRect(X(t.x - c.trunkW / 2), Y(GROUND - t.h * c.trunkShare), c.trunkW * S, t.h * c.trunkShare * S);
  tiers(t).forEach(([base, top, half], i) => {
    const lean = sway * (i + 1) / c.tiers;
    ctx.fillStyle = shade(c.needles, time.light * (c.tierLight + i * c.tierLighten));
    ctx.beginPath();
    ctx.moveTo(X(t.x - half + lean * .3), Y(base));
    ctx.lineTo(X(t.x + half + lean * .3), Y(base));
    ctx.lineTo(X(t.x + lean), Y(top));
    ctx.fill();
    if (!snow) return;
    const cap = top + (base - top) * c.snowCap;
    ctx.fillStyle = shade('#f4f8fc', time.light);
    ctx.beginPath();
    ctx.moveTo(X(t.x + lean), Y(top));
    ctx.lineTo(X(t.x - half * c.snowCap + lean * .6), Y(cap));
    ctx.lineTo(X(t.x + half * c.snowCap + lean * .6), Y(cap));
    ctx.fill();
  });
}

function drawTreehouse(h, st, time) {
  const c = FOREST, S = view.S, deck = GROUND - h.h, sway = Math.sin(st.t * c.swayRate + h.x) * c.sway * .5 + st.wind * c.windSway * .5;
  ctx.fillStyle = lit(c.barkColor, time);
  ctx.fillRect(X(h.x - c.houseTrunk / 2), Y(deck - c.crownLift - c.crownH / 2), c.houseTrunk * S, (h.h + c.crownLift + c.crownH / 2) * S);
  ctx.fillStyle = lit('#a87c50', time);
  ctx.fillRect(X(h.x - c.deckBack), Y(deck), (c.deckBack + c.deckOut) * S, c.deckH * S);
  ctx.fillStyle = lit('#7f5b38', time);
  for (let x = h.x - c.deckBack; x < h.x + c.deckOut; x += 16) ctx.fillRect(X(x), Y(deck - 14), 2 * S, 14 * S);
  ctx.fillRect(X(h.x - c.deckBack), Y(deck - 14), (c.deckBack + c.deckOut) * S, 2 * S);
  // a little hut against the trunk, then the leafy crown over it
  ctx.fillStyle = lit('#9c6b44', time);
  ctx.fillRect(X(h.x - c.deckBack + 6), Y(deck - 44), 40 * S, 44 * S);
  ctx.fillStyle = lit('#3f6e4e', time);
  for (const [dx, dy, r] of c.crownPuffs) {
    ctx.beginPath();
    ctx.arc(X(h.x + dx + sway), Y(deck - c.crownLift - c.crownH / 2 + dy), r * S, 0, 7);
    ctx.fill();
  }
}

function drawLookout(x, time) {
  const c = FOREST, S = view.S, top = GROUND - c.lookoutH, half = c.lookoutW / 2;
  ctx.fillStyle = lit('#8f6a44', time);
  ctx.fillRect(X(x - half), Y(top), c.legW * S, c.lookoutH * S);
  ctx.fillRect(X(x + half - c.legW), Y(top), c.legW * S, c.lookoutH * S);
  ctx.strokeStyle = lit('#8f6a44', time);
  ctx.lineWidth = 2 * S;
  ctx.beginPath();
  for (let y = top + 20; y < GROUND - 10; y += 34) {
    ctx.moveTo(X(x - half + c.legW), Y(y));
    ctx.lineTo(X(x + half - c.legW), Y(y + 28));
  }
  ctx.stroke();
  ctx.fillStyle = lit('#b98a56', time);
  ctx.fillRect(X(x - half - 4), Y(top), (c.lookoutW + 8) * S, c.plankH * S);
}

function drawRiver(a, b, st, time) {
  const { S, H } = view, c = FOREST, y = Y(GROUND);
  ctx.fillStyle = time.sea;
  ctx.fillRect(X(a), y, X(b) - X(a), H);
  ctx.strokeStyle = 'rgba(255,255,255,.45)';
  ctx.lineWidth = 1.5 * S;
  ctx.beginPath();
  for (let k = 0; k < 3; k++) {
    const x0 = a + ((st.t * c.flow + k * (b - a) / 3) % (b - a));
    ctx.moveTo(X(x0), y + (6 + k * 5) * S);
    ctx.lineTo(X(Math.min(b, x0 + 30)), y + (6 + k * 5) * S);
  }
  ctx.stroke();
  // the trail crosses on logs laid side by side
  ctx.fillStyle = lit('#8a5a3a', time);
  ctx.fillRect(X(a), Y(GROUND + c.bridgeY), X(b) - X(a), c.bridgeH * S);
  ctx.fillStyle = lit('#6b4428', time);
  for (let x = a; x < b; x += 12) ctx.fillRect(X(x), Y(GROUND + c.bridgeY), 2 * S, c.bridgeH * S);
}

function drawClearing(x, time) {
  const S = view.S;
  ctx.fillStyle = lit('#c79a5a', time);
  ctx.fillRect(X(x - 34), Y(GROUND - 6), 68 * S, 6 * S);
  ctx.fillStyle = lit('#9c6b44', time);
  ctx.fillRect(X(x - 30), Y(GROUND - 4), 4 * S, 4 * S);
  ctx.fillRect(X(x + 26), Y(GROUND - 4), 4 * S, 4 * S);
}

// The forest floor, painted over the plain, and everything that stands on it, with a low mist in the trees.
export function drawWoods(st) {
  const { W, H, S } = view, c = FOREST, time = world.pal, x0 = X(c.from), x1 = X(c.to);
  if (x0 >= W || x1 <= 0) return;
  const seen = x => X(x) > -c.seen * S && X(x) < W + c.seen * S, y = Y(GROUND), left = Math.max(0, x0), right = Math.min(W, x1);
  ctx.fillStyle = time.moss;
  ctx.fillRect(left, y, right - left, H);
  ctx.fillStyle = shade(time.moss, .82);
  ctx.fillRect(left, y + 10 * S, right - left, 4 * S);
  for (const [a, b] of c.rivers) if (seen(a) || seen(b)) drawRiver(a, b, st, time);
  for (const x of c.clearings) if (seen(x)) drawClearing(x, time);
  for (const x of c.lookouts) if (seen(x)) drawLookout(x, time);
  for (const h of c.treehouses) if (seen(h.x)) drawTreehouse(h, st, time);
  for (const t of world.pines) if (seen(t.x)) drawPine(t, st, time);
  if (!view.lowQ) {
    const mist = ctx.createLinearGradient(0, Y(GROUND - c.mistH), 0, y);
    mist.addColorStop(0, 'rgba(255,255,255,0)');
    mist.addColorStop(1, `rgba(${time.mistTone},${c.mistAlpha})`);
    ctx.fillStyle = mist;
    ctx.fillRect(left, Y(GROUND - c.mistH), right - left, c.mistH * S);
  }
  if (time.windowGlow > .3 && !view.lowQ) for (const k of c.cabins) if (seen(k.x)) glow(ctx, 'rgba(255,190,110,.5)', X(k.x + k.w * .3), Y(GROUND - k.h * .45), 40 * S);
}
