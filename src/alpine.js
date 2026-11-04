import { BOX, DRONE, GROUND, MOUNTAIN, SNOW } from './config.js';
import { drawPine, growPines } from './forest.js';
import { kiosk } from './seaside.js';
import { ctx, glow, ridgePoints, shade, view, X, Y } from './ui.js';
import { mixHex, world, zoneAt } from './world.js';

// The high country past the forest. The mountains have crags to deliver onto, stone huts, a cable car, and currents of
// air that lift or sink an aircraft beside the cliffs. The snowfield has snowy pines, chalets, a ski lift and frozen
// lakes whose thin ice takes whatever touches it; the cold also drains the battery faster. Both are laid by hand.
export const iceAt = x => SNOW.lakes.some(([a, b]) => x > a && x < b);

export function touchesIce(st) {
  const { d, box } = st, surface = GROUND - 1;
  return (iceAt(d.x) && d.y + DRONE.radius >= surface) || (st.has && iceAt(box.x) && box.y + BOX.padY * st.item.size >= surface);
}

// The air beside a cliff: negative lifts the aircraft, positive pulls it down, fading to nothing at the column's edge.
export function draftAt(x) {
  for (const f of MOUNTAIN.drafts) {
    const off = Math.abs(x - f.x) / (f.w / 2);
    if (off < 1) return f.v * (1 - off * off);
  }
  return 0;
}

const block = (c, x, w, h, idx, extra) => ({ x, w, h, top: GROUND - h, zone: zoneAt(x), col: c.wallColor, idx, bal: [], tank: null, dish: null, lit: [], cols: 0, rows: 0, ...extra });

// A cable between two pylons, sagging in the middle, kept as a line the order can catch on.
function cable(a, b, ha, hb, sag) {
  const pts = [];
  for (let k = 0; k <= 16; k++) {
    const t = k / 16;
    pts.push({ x: a + (b - a) * t, y: GROUND - ha + (ha - hb) * t + Math.sin(t * Math.PI) * sag });
  }
  return { pts, clothes: [], power: false, cable: true, minX: a, maxX: b };
}

function pylons(c, list, solids) {
  for (const { a, b, ha, hb } of list) {
    solids.push({ x: a - c.pylonW / 2, y: GROUND - ha, w: c.pylonW, h: ha, mat: 'steel' }, { x: b - c.pylonW / 2, y: GROUND - hb, w: c.pylonW, h: hb, mat: 'steel' });
  }
}

export function buildAlpine(firstIdx) {
  const m = MOUNTAIN, s = SNOW, B = [], solids = [], lines = [];
  const mountKiosks = m.kiosks.map((k, i) => kiosk(k, firstIdx + i, m)), mountTargets = [], snowTargets = [];
  for (const b of mountKiosks) solids.push({ x: b.x, y: b.top, w: b.w, h: b.h, mat: 'wall' });
  const add = (c, x, w, h, extra, mat = 'wall') => {
    const b = block(c, x, w, h, firstIdx + m.idxGap * 2 + B.length, extra);
    B.push(b);
    solids.push({ x, y: b.top, w, h, mat });
    return b;
  };
  for (const r of m.crags) {
    const b = add(m, r.x, r.w, r.h, { rock: true, col: m.rockColor, cap: m.rockCap }, 'rock');
    mountTargets.push({ x: b.x + b.w / 2, y: b.top - m.targetLift, kind: 'crag' });
  }
  for (const h of m.huts) {
    const b = add(m, h.x, h.w, h.h, { hut: true });
    mountTargets.push({ x: b.x + b.w * .55, y: b.top - m.targetLift, kind: 'hut' });
  }
  for (const x of m.camps) mountTargets.push({ x, y: GROUND - m.targetLift, kind: 'basecamp' });
  pylons(m, m.cables, solids);
  for (const k of m.cables) {
    lines.push(cable(k.a, k.b, k.ha, k.hb, m.sag));
    mountTargets.push({ x: k.a, y: GROUND - k.ha - m.pylonTop - m.targetLift, kind: 'station' });
    solids.push({ x: k.a - m.stationW / 2, y: GROUND - k.ha - m.pylonTop, w: m.stationW, h: m.pylonTop, mat: 'steel' });
  }

  const snowKiosks = s.kiosks.map((k, i) => kiosk(k, firstIdx + m.idxGap + i, s));
  for (const b of snowKiosks) solids.push({ x: b.x, y: b.top, w: b.w, h: b.h, mat: 'wood' });
  for (const h of s.chalets) {
    const b = add(s, h.x, h.w, h.h, { chalet: true }, 'wood');
    snowTargets.push({ x: b.x + b.w * .5, y: b.top - s.targetLift, kind: 'chalet' });
  }
  for (const x of s.igloos) snowTargets.push({ x, y: GROUND - s.targetLift, kind: 'igloo' });
  pylons(s, [s.lift], solids);
  lines.push(cable(s.lift.a, s.lift.b, s.lift.ha, s.lift.hb, s.sag));
  snowTargets.push({ x: s.lift.b, y: GROUND - s.lift.hb - s.pylonTop - s.targetLift, kind: 'station' });
  solids.push({ x: s.lift.b - s.stationW / 2, y: GROUND - s.lift.hb - s.pylonTop, w: s.stationW, h: s.pylonTop, mat: 'steel' });
  const keep = [...s.kiosks.map(k => [k.x - s.clear, k.x + 240 + s.clear]), ...s.chalets.map(k => [k.x - s.clear, k.x + k.w + s.clear]), ...s.igloos.map(x => [x - s.clear, x + s.clear]),
    ...s.lakes.map(([a, b]) => [a - 20, b + 20]), [s.lift.a - s.clear, s.lift.a + s.clear], [s.lift.b - s.clear, s.lift.b + s.clear], ...s.snowmen.map(x => [x - 40, x + 40])];
  const pines = growPines(s, keep);
  for (const t of pines) solids.push(...t.solids);
  return { B, solids, lines, mountKiosks, mountTargets, snowKiosks, snowTargets, snowPines: pines };
}

const lit = (hex, time) => shade(hex, time.light);

// A mountain range: a long swell with sharp teeth, rising out of the land before it. The rock pales into the haze
// toward its foot.
function range(c, par, height, swell, teeth, col, cap, haze) {
  const { W, S, cam } = view, base = Y(GROUND), left = Math.max(0, X(c.from)), right = Math.min(W, X(c.to));
  if (right <= left) return;
  const pts = ridgePoints(par, c.ridgeStep, left, right).map(([sx, u]) => {
    const x = cam.x + sx / S, rise = Math.max(0, Math.min(1, (x - c.from) / c.rise, (c.to - x) / c.rise));
    const tooth = Math.abs(((u / teeth) % 2 + 2) % 2 - 1) * teeth * 1.6 + Math.sin(u / (teeth * 2.7)) * teeth * .5;
    return [sx, rise * (height + swell * Math.sin(u / c.ridgeLong) + tooth), u];
  });
  const fade = ctx.createLinearGradient(0, base - (height + swell + teeth * 2) * S, 0, base);
  fade.addColorStop(0, col);
  fade.addColorStop(1, mixHex(col, haze, c.haze));
  ctx.fillStyle = fade;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], base);
  for (const [sx, h] of pts) ctx.lineTo(sx, base - h * S);
  ctx.lineTo(pts[pts.length - 1][0], base);
  ctx.fill();
  if (!cap) return;
  // snow lies in a ragged band along the ridge wherever it rises above the snow line
  ctx.fillStyle = cap;
  ctx.beginPath();
  const line = height * c.snowLine;
  let top = [], low = [];
  const lay = () => {
    if (top.length > 1) {
      ctx.moveTo(...top[0]);
      for (const p of top) ctx.lineTo(...p);
      for (let i = low.length - 1; i >= 0; i--) ctx.lineTo(...low[i]);
      ctx.closePath();
    }
    top = [];
    low = [];
  };
  for (const [x, h, u] of pts) {
    if (h > line) {
      const depth = Math.min(h - line, c.capDepth * (.6 + .25 * Math.sin(u / 11) + .15 * Math.sin(u / 4.3)));
      top.push([x, base - h * S]);
      low.push([x, base - (h - depth) * S]);
    } else lay();
  }
  lay();
  ctx.fill();
}

export function drawHighBehind() {
  const m = MOUNTAIN, s = SNOW, time = world.pal;
  if (X(m.from) < view.W && X(m.to) > 0) {
    range(m, m.farDrift, m.farH, m.farSwell, m.farTeeth, time.peakFar, time.snowCap, time.far2);
    range(m, m.nearDrift, m.nearH, m.nearSwell, m.nearTeeth, time.peakNear, null, time.far2);
  }
  if (X(s.from) < view.W && X(s.to) > 0) {
    range(s, s.farDrift, s.farH, s.farSwell, s.farTeeth, time.peakFar, time.snowCap, time.far2);
    range(s, s.nearDrift, s.nearH, s.nearSwell, s.nearTeeth, time.snowFar, time.snowCap, time.far2);
  }
}

function drawPylon(x, h, c, time) {
  const S = view.S;
  ctx.fillStyle = lit('#5f6470', time);
  ctx.fillRect(X(x - c.pylonW / 2), Y(GROUND - h), c.pylonW * S, h * S);
  ctx.fillRect(X(x - c.pylonW * 2), Y(GROUND - h), c.pylonW * 4 * S, 5 * S);
}

function drawStation(x, h, c, time) {
  const S = view.S, top = GROUND - h - c.pylonTop;
  ctx.fillStyle = lit('#8a8f9a', time);
  ctx.fillRect(X(x - c.stationW / 2), Y(top), c.stationW * S, c.pylonTop * S);
  ctx.fillStyle = lit('#c94a3a', time);
  ctx.fillRect(X(x - c.stationW / 2 - 6), Y(top), (c.stationW + 12) * S, 6 * S);
}

// The car or chair rides the cable back and forth.
function drawRider(k, st, c, time, chair) {
  const S = view.S, t = (Math.sin(st.t * c.riderRate) + 1) / 2, x = k.a + (k.b - k.a) * t, y = GROUND - k.ha + (k.ha - k.hb) * t + Math.sin(t * Math.PI) * c.sag;
  ctx.strokeStyle = lit('#3a3f4a', time);
  ctx.lineWidth = 1.5 * S;
  ctx.beginPath();
  ctx.moveTo(X(x), Y(y));
  ctx.lineTo(X(x), Y(y + c.hang));
  ctx.stroke();
  ctx.fillStyle = lit(chair ? '#3f6fb0' : '#c94a3a', time);
  if (chair) ctx.fillRect(X(x - 10), Y(y + c.hang), 20 * S, 5 * S);
  else {
    ctx.beginPath();
    ctx.roundRect(X(x - 16), Y(y + c.hang), 32 * S, 22 * S, 4 * S);
    ctx.fill();
    ctx.fillStyle = lit('#bfe0f2', time);
    ctx.fillRect(X(x - 12), Y(y + c.hang + 4), 24 * S, 8 * S);
  }
}

function drawDraft(f, st) {
  const S = view.S, up = f.v < 0;
  ctx.strokeStyle = 'rgba(255,255,255,.28)';
  ctx.lineWidth = 1.5 * S;
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const x = f.x + (i / 6 - .5) * f.w * .8, span = MOUNTAIN.draftTall, y = GROUND - ((i * 97 + st.t * Math.abs(f.v) * (up ? 1 : -1)) % span + span) % span;
    ctx.moveTo(X(x), Y(y));
    ctx.lineTo(X(x), Y(y + (up ? 24 : -24)));
  }
  ctx.stroke();
}

function drawSnowman(x, time) {
  const S = view.S;
  ctx.fillStyle = lit('#f4f8fc', time);
  for (const [dy, r] of [[-10, 10], [-27, 8], [-40, 6]]) {
    ctx.beginPath();
    ctx.arc(X(x), Y(GROUND + dy), r * S, 0, 7);
    ctx.fill();
  }
  ctx.fillStyle = '#e8792c';
  ctx.fillRect(X(x + 4), Y(GROUND - 41), 6 * S, 2 * S);
}

function drawIgloo(x, time) {
  const S = view.S;
  ctx.fillStyle = lit('#e9f1f8', time);
  ctx.beginPath();
  ctx.arc(X(x - 30), Y(GROUND), 28 * S, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = lit('#9fb4c8', time);
  ctx.beginPath();
  ctx.arc(X(x - 30), Y(GROUND), 8 * S, Math.PI, 0);
  ctx.fill();
}

function ground(c, col, st) {
  // the snowfield lies on past the end of the world, so a wide shot never finds bare ground beyond it
  const { W, H, S } = view, x0 = X(c.from), x1 = X(c.groundTo ?? c.to);
  if (x0 >= W || x1 <= 0) return null;
  const left = Math.max(0, x0), right = Math.min(W, x1), y = Y(GROUND);
  ctx.fillStyle = col;
  ctx.fillRect(left, y, right - left, H);
  ctx.fillStyle = shade(col, .86);
  ctx.fillRect(left, y + 9 * S, right - left, 3 * S);
  return { seen: x => X(x) > -c.seen * S && X(x) < W + c.seen * S, left, right };
}

export function drawHigh(st) {
  const m = MOUNTAIN, s = SNOW, time = world.pal, S = view.S;
  const mg = ground(m, time.scree, st);
  if (mg) {
    for (const f of m.drafts) if (mg.seen(f.x)) drawDraft(f, st);
    for (const k of m.cables) {
      if (!mg.seen(k.a) && !mg.seen(k.b)) continue;
      drawPylon(k.a, k.ha, m, time);
      drawPylon(k.b, k.hb, m, time);
      drawStation(k.a, k.ha, m, time);
      drawRider(k, st, m, time, false);
    }
    for (const x of m.camps) if (mg.seen(x)) {
      ctx.fillStyle = lit('#e0a52c', time);
      ctx.beginPath();
      ctx.moveTo(X(x - 70), Y(GROUND));
      ctx.lineTo(X(x - 40), Y(GROUND - 34));
      ctx.lineTo(X(x - 10), Y(GROUND));
      ctx.fill();
    }
  }
  const sg = ground(s, time.snowGround, st);
  if (sg) {
    for (const [a, b] of s.lakes) {
      if (!sg.seen(a) && !sg.seen(b)) continue;
      ctx.fillStyle = time.ice;
      ctx.fillRect(X(a), Y(GROUND), (b - a) * S, view.H);
      ctx.strokeStyle = 'rgba(255,255,255,.6)';
      ctx.lineWidth = 1.2 * S;
      ctx.beginPath();
      for (let x = a + 20; x < b - 20; x += 46) { ctx.moveTo(X(x), Y(GROUND + 4)); ctx.lineTo(X(x + 18), Y(GROUND + 12)); ctx.lineTo(X(x + 10), Y(GROUND + 22)); }
      ctx.stroke();
      ctx.fillStyle = lit('#c94a3a', time);
      for (const x of [a - 18, b + 18]) {
        ctx.fillRect(X(x) - S, Y(GROUND - 30), 2 * S, 30 * S);
        ctx.fillRect(X(x), Y(GROUND - 30), 12 * S, 8 * S);
      }
    }
    if (sg.seen(s.lift.a) || sg.seen(s.lift.b)) {
      drawPylon(s.lift.a, s.lift.ha, s, time);
      drawPylon(s.lift.b, s.lift.hb, s, time);
      drawStation(s.lift.b, s.lift.hb, s, time);
      drawRider(s.lift, st, s, time, true);
    }
    for (const x of s.igloos) if (sg.seen(x)) drawIgloo(x, time);
    for (const x of s.snowmen) if (sg.seen(x)) drawSnowman(x, time);
    for (const t of world.snowPines) if (sg.seen(t.x)) drawPine(t, st, time, true);
    if (time.windowGlow > .3 && !view.lowQ) for (const k of s.chalets) if (sg.seen(k.x)) glow(ctx, 'rgba(255,190,110,.5)', X(k.x + k.w * .3), Y(GROUND - k.h * .45), 40 * S);
  }
}

// Called each step: the air near a cliff pushes the aircraft up or down.
export function stepDraft(st) {
  st.draft = st.level.mountain ? draftAt(st.d.x) : 0;
}
