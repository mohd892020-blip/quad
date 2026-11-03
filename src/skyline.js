import { BEACH, CITY, GROUND, SKYLINE } from './config.js';
import { ctx, glow, shade, view, X, Y } from './ui.js';
import { mixHex, rng, world } from './world.js';

// The city's depth. Behind the street stand four strips that repeat without a seam: towers on the horizon, the old
// skyline, nearer blocks, and a midground of homes and shops. Each slides at its own share of the camera's pace, so
// the farthest barely move, and each is painted once for every step of the day and then only stamped. Close to the
// lens, trees, lamps, signs, a bridge and a rooftop edge rush past faster than the street. Rooftops carry their
// clutter, windows come and go after dark, red lights blink on the tallest roofs, neon flickers, and far flocks cross.
const fract = v => v - Math.floor(v), hash = i => fract(Math.sin(i * 127.1 + 311.7) * 43758.5453), wrap = (v, span) => ((v % span) + span) % span;
const pick = (r, [a, b]) => a + r() * (b - a);
const CITY_STYLES = new Set(['village', 'old', 'souk', 'tower']);

let strips = null, fgItems = null, budget = 0;

// Each layer's items, laid left to right through one period. The old skyline reuses the city's own far towers.
function layOut() {
  const c = SKYLINE, r = rng(c.seed);
  strips = c.layers.map((L, li) => {
    const src = L.key === 'far2' ? world.far2.slice(0, c.take) : L.key === 'far1' ? world.far1.slice(0, c.take) : null;
    const items = [];
    let x = 0;
    const n = src ? src.length : L.count;
    for (let i = 0; i < n; i++) {
      const it = src ? { w: src[i].w, h: src[i].h, dome: !!src[i].d, minaret: !!src[i].m } : { w: pick(r, L.w), h: pick(r, L.h) };
      it.x = x;
      it.seed = li * 1000 + i * 17;
      it.kind = L.kinds ? L.kinds[(r() * L.kinds.length) | 0] : 'block';
      it.stone = c.midStones[(r() * c.midStones.length) | 0];
      it.sign = L.key === 'mid' && r() < c.signChance ? { word: c.signs[(r() * c.signs.length) | 0], neon: c.neon[(r() * c.neon.length) | 0] } : null;
      items.push(it);
      x += it.w + (L.gap ? pick(r, L.gap) : 6);
    }
    const top = Math.max(...items.map(it => it.h)) * L.lift;
    return { L, items, P: x, top, bottom: L.base / L.scale + 8, canvas: null, pal: null, k: 0, lights: [], signs: [] };
  });
  const f = c.fg, fr = rng(c.seed + 1), total = f.kinds.reduce((s, k) => s + k[1], 0);
  fgItems = [];
  for (let x = CITY.leftBuilding.x * f.par; x < (BEACH.from - f.coastGap) * f.par; x += pick(fr, f.gap)) {
    let roll = fr() * total;
    const kind = f.kinds.find(k => (roll -= k[1]) < 0)?.[0] ?? f.kinds[0][0];
    fgItems.push({ x, kind, seed: fr() * 100, word: c.signs[(fr() * c.signs.length) | 0], neon: c.neon[(fr() * c.neon.length) | 0] });
  }
}

// The sky behind the far towers, at the height they stand against, so they fade into it whatever the hour.
function horizonOf(time) {
  const at = SKYLINE.skyAt, stops = time.sky, i = Math.max(1, stops.findIndex(([p]) => p >= at));
  const [p0, c0] = stops[i - 1], [p1, c1] = stops[Math.min(i, stops.length - 1)];
  return p1 > p0 ? mixHex(c0, c1, (at - p0) / (p1 - p0)) : c1;
}

function bodyOf(s, it, time) {
  const L = s.L;
  if (L.key === 'mid') return mixHex(shadeHex(it.stone, time.light), time.far1, SKYLINE.midHaze);
  const base = L.key === 'far1' ? time.far1 : time.far2;
  return L.haze ? mixHex(base, horizonOf(time), L.haze) : base;
}

function shadeHex(hex, f) {
  const n = parseInt(hex.slice(1), 16), ch = sh => Math.min(255, Math.round((n >> sh & 255) * f));
  return `#${((1 << 24) + (ch(16) << 16) + (ch(8) << 8) + ch(0)).toString(16).slice(1)}`;
}

// A grid of windows: dark by day, a share of them lit after dark.
function windows(g, it, body, time, s, cw, ch, ww, wh, from = 10) {
  const cols = Math.floor((it.w - 6) / cw), rows = Math.floor((it.h - from) / ch), ox = it.x + (it.w - cols * cw) / 2 + (cw - ww) / 2, dark = shade(body, .8);
  const share = time.extraLit + SKYLINE.litShare * time.windowGlow;
  for (let rr = 0; rr < rows; rr++) for (let cc = 0; cc < cols; cc++) {
    const i = it.seed + rr * 31 + cc, on = hash(i) < share;
    g.globalAlpha = on ? 1 : s.L.windows;
    g.fillStyle = on ? time.lit[hash(i + .5) < .4 ? 2 : 1] : dark;
    g.fillRect(ox + cc * cw, -from - (rr + 1) * ch + (ch - wh), ww, wh);
  }
  g.globalAlpha = 1;
}

function paintItem(g, s, it, time) {
  const L = s.L, body = bodyOf(s, it, time), { x, w, h } = it, light = SKYLINE.light;
  g.fillStyle = body;
  g.fillRect(x, -h, w, h + s.bottom);
  if (L.key === 'horizon') {
    if (it.kind === 'stepped') { g.fillRect(x + w * .15, -h * 1.1, w * .7, h * .1 + 1); g.fillRect(x + w * .3, -h * 1.17, w * .4, h * .07 + 1); }
    else if (it.kind === 'spire') { g.beginPath(); g.moveTo(x + w * .4, -h); g.lineTo(x + w / 2, -h * 1.28); g.lineTo(x + w * .6, -h); g.fill(); s.lights.push({ x: x + w / 2, y: -h * 1.28 }); }
    else if (it.kind === 'antenna') { g.fillRect(x + w / 2 - 1, -h * 1.2, 2, h * .2); s.lights.push({ x: x + w / 2, y: -h * 1.2 }); }
    else if (it.kind === 'crown') { g.beginPath(); g.moveTo(x, -h); g.lineTo(x + w * .2, -h * 1.08); g.lineTo(x + w * .8, -h * 1.08); g.lineTo(x + w, -h); g.fill(); }
    windows(g, it, body, time, s, 9, 11, 3, 4, 14);
  } else if (L.key === 'far2' || L.key === 'far1') {
    if (it.minaret) g.fillRect(x + w * .4, -h - 60, w * .2, 60);
    if (it.dome) {
      g.beginPath();
      g.arc(x + w / 2, -h, w * .32, Math.PI, 0);
      g.fill();
      g.fillRect(x + w * .48, -h - w * .55, w * .04, w * .25);
    }
    if (h > light.farH) { g.fillRect(x + w * .7, -h - 26, 2, 26); s.lights.push({ x: x + w * .7 + 1, y: -h - 26 }); }
    if (L.key === 'far1' && hash(it.seed + 3) < .4) { g.fillStyle = shade(body, .85); g.fillRect(x + w * .2, -h - 10, 14, 10); }
    windows(g, it, body, time, s, L.key === 'far1' ? 12 : 10, L.key === 'far1' ? 16 : 13, L.key === 'far1' ? 5 : 3, L.key === 'far1' ? 7 : 5, 12);
  } else {
    // a home or shop: windows with sills, a balcony or two, a striped awning, and sometimes a sign on the roof
    g.fillStyle = shade(body, .82);
    g.fillRect(x - 3, -h - 4, w + 6, 5);
    windows(g, it, body, time, s, 22, 30, 10, 14, 40);
    g.fillStyle = shade(body, .7);
    for (let fl = 1; fl * 30 + 50 < h; fl += 2) if (hash(it.seed + fl) < .5) {
      const bx = x + w * (.2 + hash(it.seed + fl + .3) * .4), by = -40 - fl * 30;
      g.fillRect(bx, by, 30, 3);
      for (let k = 0; k <= 30; k += 5) g.fillRect(bx + k, by - 8, 1, 8);
      g.fillRect(bx, by - 9, 30, 1.5);
    }
    for (let ax = x + 6, i = 0; ax < x + w - 6; ax += 12, i++) {
      g.fillStyle = shade(i % 2 ? '#f2efe6' : SKYLINE.awnings[it.seed % SKYLINE.awnings.length], time.light * .8);
      g.fillRect(ax, -36, Math.min(12, x + w - 6 - ax), 9);
    }
    if (it.sign) {
      const sw = Math.min(w - 10, 96), sx = x + (w - sw) / 2, sy = -h - 34;
      g.fillStyle = shade('#2a2233', time.light);
      g.fillRect(sx + 8, sy + 22, 3, 14);
      g.fillRect(sx + sw - 11, sy + 22, 3, 14);
      g.fillRect(sx, sy, sw, 24);
      g.font = `16px Lalezar, Tajawal, sans-serif`;
      g.textAlign = 'center';
      g.fillStyle = time.windowGlow > .3 ? it.sign.neon : shade('#f2efe6', time.light);
      g.fillText(it.sign.word, sx + sw / 2, sy + 18);
      s.signs.push({ x: sx + sw / 2, y: sy + 12, r: sw * .7, neon: it.sign.neon, seed: it.seed });
    }
  }
}

function paintStrip(s, k, time) {
  const top = s.top + SKYLINE.headroom, height = Math.ceil((top + s.bottom) * k), width = Math.ceil(s.P * k);
  const cv = s.canvas ?? document.createElement('canvas');
  if (cv.width !== width || cv.height !== height) { cv.width = width; cv.height = height; }
  const g = cv.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, width, height);
  g.setTransform(k, 0, 0, k, 0, top * k);
  s.lights = [];
  s.signs = [];
  for (const it of s.items) paintItem(g, s, it, time);
  Object.assign(s, { canvas: cv, pal: world.palKey, k, drawTop: top });
}

function drawStrip(s, st, time) {
  const L = s.L, S = view.S * L.scale, want = Math.min(view.sharp * L.scale * Math.min(view.DPR, L.density), SKYLINE.maxStrip / s.P);
  // a strip from an older step of the day still stamps fine; one is repainted a frame
  if (!s.canvas || ((s.pal !== world.palKey || s.k !== want) && budget-- > 0)) paintStrip(s, want, time);
  const off = wrap(st.cam.x * L.par / L.scale, s.P), y0 = Y(GROUND) - L.base * view.S, top = y0 - s.drawTop * S;
  const night = Math.max(time.stars, time.windowGlow), c = SKYLINE.light;
  for (let x = -off; x * S < view.W; x += s.P) {
    if ((x + s.P) * S < 0) continue;
    ctx.drawImage(s.canvas, x * S, top, s.P * S, (s.drawTop + s.bottom) * S);
    if (night < .3) continue;
    // red lights on the tallest roofs blink after dark, and neon signs flicker
    for (const p of s.lights) if (fract(st.t / c.blink + hash(p.x)) < c.on) {
      ctx.fillStyle = c.color;
      ctx.fillRect((x + p.x) * S - c.size / 2, y0 + p.y * S - c.size / 2, c.size, c.size);
    }
    for (const n of s.signs) {
      const f = hash(Math.floor(st.t * SKYLINE.flicker.rate) + n.seed) < SKYLINE.flicker.dip ? 1 : .3;
      ctx.globalAlpha = time.signGlow * f * night;
      glow(ctx, n.neon, (x + n.x) * S, y0 + n.y * S, n.r * S);
      ctx.globalAlpha = 1;
    }
  }
}

// Far flocks cross the sky above the skyline in the daytime.
function drawFlocks(st, time) {
  const c = SKYLINE.flocks, { W, H, S } = view;
  if (time.stars > .5) return;
  ctx.strokeStyle = c.color;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 0; i < c.count; i++) {
    const n = c.birds[0] + Math.floor(hash(i + 9) * (c.birds[1] - c.birds[0])), x0 = wrap(hash(i) * W * 2 + st.t * c.speed * S - st.cam.x * c.par * S, W + 160) - 80;
    const y0 = H * (c.top + hash(i + 3) * (c.bottom - c.top));
    for (let j = 0; j < n; j++) {
      const bx = x0 + j * 9 * (j % 2 ? 1 : -.6), by = y0 + j * 4, flap = Math.sin(st.t * 7 + i + j) * 1.6;
      ctx.moveTo(bx - 3, by - flap);
      ctx.lineTo(bx, by);
      ctx.lineTo(bx + 3, by - flap);
    }
  }
  ctx.stroke();
}

export function drawSkyline(st) {
  if (!strips) layOut();
  const time = world.pal;
  budget = 1;
  for (const s of strips) if (!view.lowQ || s.L.lowQ) drawStrip(s, st, time);
  drawFlocks(st, time);
}

// Clutter on the city's roofs, painted into each building's image: kept clear of the customer's spot, the water tank
// and the dish, so a drop never lands in it.
export function paintRoof(g, b) {
  if (!CITY_STYLES.has(b.zone?.style) || b.shop || b.rock || !b.cols) return;
  const c = SKYLINE.roof, time = world.pal, T = b.top, busy = [];
  const target = b.tank && b.tank.x < b.x + b.w / 2 ? b.x + b.w - CITY.roofTargetInset : b.x + CITY.roofTargetInset;
  busy.push([target - c.clear, target + c.clear]);
  if (b.tank) busy.push([b.tank.x - 6, b.tank.x + b.tank.w + 6]);
  if (b.dish) busy.push([b.dish.x - 14, b.dish.x + 10]);
  if (b.w > CITY.rigMinW) busy.push([b.x + b.w / 2 - 12, b.x + b.w / 2 + 12]);
  const free = (a, w) => a > b.x + 4 && a + w < b.x + b.w - 4 && !busy.some(([l, r]) => a < r && a + w > l);
  const n = c.props[0] + Math.floor(hash(b.idx * 7.3) * (c.props[1] - c.props[0] + 1));
  for (let i = 0; i < n; i++) {
    const kind = c.kinds[Math.floor(hash(b.idx * 13 + i) * c.kinds.length)], w = c.widths[kind];
    let at = null;
    for (let tries = 0; tries < 6 && at === null; tries++) {
      const x = b.x + 6 + hash(b.idx * 3 + i * 5 + tries) * (b.w - 12 - w);
      if (free(x, w)) at = x;
    }
    if (at === null) continue;
    busy.push([at - 4, at + w + 4]);
    paintProp(g, kind, at, T, w, b, time);
  }
}

function paintProp(g, kind, x, T, w, b, time) {
  const L = time.light;
  if (kind === 'ac') {
    g.fillStyle = shade('#c9ccd1', L); g.fillRect(x, T - 11, w, 11);
    g.fillStyle = shade('#6d727b', L); g.beginPath(); g.arc(x + w * .35, T - 5.5, 3.6, 0, 7); g.fill();
    g.fillRect(x + w * .65, T - 9, 1, 7); g.fillRect(x + w * .8, T - 9, 1, 7);
  } else if (kind === 'vent') {
    g.fillStyle = shade('#8a8f99', L); g.fillRect(x + 2, T - 16, 4, 16); g.fillRect(x, T - 18, 8, 3);
  } else if (kind === 'solar') {
    g.fillStyle = shade('#6d727b', L); g.fillRect(x + w - 5, T - 9, 2, 9);
    g.fillStyle = shade('#2c4a7a', L); g.beginPath(); g.moveTo(x, T - 2); g.lineTo(x + w, T - 12); g.lineTo(x + w, T - 9); g.lineTo(x, T + 1); g.fill();
    g.fillStyle = shade('#7fa6d8', L); for (let k = 6; k < w; k += 7) g.fillRect(x + k, T - 2 - k * 10 / w, 1, 3);
  } else if (kind === 'hut') {
    g.fillStyle = shade(b.col, .82 * L); g.fillRect(x, T - 22, w, 22);
    g.fillStyle = shade(b.col, .6 * L); g.fillRect(x - 2, T - 24, w + 4, 3);
    g.fillStyle = time.windowGlow > .3 ? time.lit[1] : shade('#3a2618', L); g.fillRect(x + w * .55, T - 16, 8, 16);
  } else if (kind === 'box') {
    g.fillStyle = shade('#9aa0a8', L); g.fillRect(x, T - 13, w, 13);
    g.fillStyle = shade('#e0b83a', L); g.fillRect(x + 2, T - 10, w - 4, 2);
  } else if (kind === 'plant') {
    g.fillStyle = shade('#b4553a', L); g.fillRect(x, T - 6, w, 6);
    g.fillStyle = shade('#4f8f45', L);
    for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(x + 4 + k * 7, T - 8 - (k % 2) * 2, 4.5, 0, 7); g.fill(); }
    g.fillStyle = shade('#ff8fb0', L); g.fillRect(x + 6, T - 12, 2, 2); g.fillRect(x + 15, T - 10, 2, 2);
  } else if (kind === 'antenna') {
    g.fillStyle = shade('#5f646e', L); g.fillRect(x + w / 2 - .75, T - 30, 1.5, 30);
    for (let k = 0; k < 3; k++) g.fillRect(x + w / 2 - (8 - k * 2), T - 26 + k * 6, (8 - k * 2) * 2, 1.2);
  }
}

// After dark a few windows in each building turn on and off, and red lights blink on the tallest roofs and masts.
export function drawCityLife(st) {
  const time = world.pal, c = CITY, tw = SKYLINE.twinkle, lt = SKYLINE.light, { S, W } = view;
  if (time.windowGlow < .3 && time.stars < .3) return;
  for (const b of world.B) {
    if (!CITY_STYLES.has(b.zone?.style) || !b.cols || b.rock) continue;
    const sx = X(b.x);
    if (sx > W || sx + b.w * S < 0) continue;
    const z = b.zone, gx = (b.w - b.cols * c.cellW) / 2 + 8 + (14 - z.winW) / 2;
    for (let k = 0; k < tw.per; k++) {
      const i = Math.floor(hash(b.idx * 13 + k) * b.cols * b.rows), rr = Math.floor(i / b.cols), col = i % b.cols, wy = GROUND - (rr + 1) * c.floorH + 10;
      if (wy < b.top + 8) continue;
      const on = Math.floor(st.t / tw.period + hash(b.idx + k * 3)) % 2 === 0;
      ctx.fillStyle = time.lit[on ? 2 : 0];
      ctx.fillRect(X(b.x + gx + col * c.cellW), Y(wy), z.winW * S, z.winH * S);
    }
    if (b.h > lt.minH && fract(st.t / lt.blink + hash(b.idx)) < lt.on) {
      ctx.fillStyle = lt.color;
      ctx.fillRect(X(b.x + 6) - lt.size, Y(b.top) - lt.size * 2, lt.size * 2, lt.size * 2);
      glow(ctx, 'rgba(255,60,48,.6)', X(b.x + 6), Y(b.top) - lt.size, 10 * S);
    }
  }
  for (const rig of world.rigs) {
    const m = rig.mast, x = X(m.x + m.w / 2);
    if (x < -20 || x > W + 20 || fract(st.t / lt.blink + hash(m.x)) >= lt.on) continue;
    ctx.fillStyle = lt.color;
    ctx.fillRect(x - lt.size, Y(m.y) - lt.size, lt.size * 2, lt.size * 2);
    glow(ctx, 'rgba(255,60,48,.6)', x, Y(m.y), 10 * S);
  }
}

// Near the lens: silhouettes that pass faster than the street, fading clear wherever the aircraft or its order is.
export function drawForeground(st) {
  if (!strips) layOut();
  const f = SKYLINE.fg, time = world.pal, { W, H } = view, S = view.S * f.scale, base = Y(GROUND) + f.drop * view.S;
  if (base - 40 * S > H) return;
  const col = mixHex(f.color, time.ground, f.tint), night = Math.max(time.windowGlow, time.stars);
  const spots = [[X(st.d.x), Y(st.d.y)]];
  if (st.has) spots.push([X(st.box.x), Y(st.box.y)]);
  for (const it of fgItems) {
    const sx = (it.x - st.cam.x * f.par) * view.S, span = f.widths[it.kind] * S;
    if (sx > W + 40 || sx + span < -40) continue;
    const top = base - f.heights[it.kind] * S;
    // the nearer the aircraft, the clearer the glass
    const gap = Math.min(...spots.map(([px, py]) => Math.hypot(Math.max(sx - px, 0, px - sx - span), Math.max(top - py, 0, py - base))));
    ctx.globalAlpha = f.fade + (f.alpha - f.fade) * Math.min(1, gap / (f.near * view.S));
    ctx.fillStyle = col;
    paintNear(it, sx, base, S, st, time, night);
  }
  ctx.globalAlpha = 1;
}

function paintNear(it, x, base, S, st, time, night) {
  const f = SKYLINE.fg, a = ctx.globalAlpha;
  if (it.kind === 'tree') {
    const sway = Math.sin(st.t * f.swayRate + it.seed) * (f.sway + Math.abs(st.wind || 0) * f.swayWind) * S;
    ctx.fillRect(x + 36 * S, base - 120 * S, 12 * S, 120 * S);
    ctx.beginPath();
    for (const [dx, dy, r] of [[42, -150, 46], [12, -126, 34], [72, -128, 36], [40, -186, 32]]) {
      ctx.moveTo(x + dx * S + sway * (-dy / 150) + r * S, base + dy * S);
      ctx.arc(x + dx * S + sway * (-dy / 150), base + dy * S, r * S, 0, 7);
    }
    ctx.fill();
  } else if (it.kind === 'lamp') {
    ctx.fillRect(x, base - 220 * S, 7 * S, 220 * S);
    ctx.fillRect(x, base - 220 * S, 40 * S, 5 * S);
    ctx.fillRect(x + 30 * S, base - 218 * S, 18 * S, 9 * S);
    if (night > .3) {
      ctx.globalAlpha = a * night;
      glow(ctx, 'rgba(255,214,140,.9)', x + 39 * S, base - 206 * S, 60 * S);
      ctx.globalAlpha = a;
    }
  } else if (it.kind === 'sign') {
    ctx.fillRect(x + 20 * S, base - 170 * S, 6 * S, 170 * S);
    ctx.fillRect(x + 140 * S, base - 170 * S, 6 * S, 170 * S);
    ctx.fillRect(x, base - 236 * S, 166 * S, 70 * S);
    ctx.font = `${30 * S}px Lalezar, Tajawal, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = night > .3 ? it.neon : shade('#f2efe6', Math.min(1, time.light) * .8);
    ctx.fillText(it.word, x + 83 * S, base - 190 * S);
    if (night > .3) {
      ctx.globalAlpha = a * night * time.signGlow;
      glow(ctx, it.neon, x + 83 * S, base - 200 * S, 110 * S);
      ctx.globalAlpha = a;
    }
  } else if (it.kind === 'bridge') {
    ctx.fillRect(x + 40 * S, base - 150 * S, 44 * S, 150 * S);
    ctx.fillRect(x + 440 * S, base - 150 * S, 44 * S, 150 * S);
    ctx.fillRect(x, base - 176 * S, 520 * S, 28 * S);
    for (let k = 0; k <= 520; k += 26) ctx.fillRect(x + k * S, base - 200 * S, 4 * S, 24 * S);
    ctx.fillRect(x, base - 202 * S, 520 * S, 4 * S);
  } else {
    // the edge of a roof right by the lens, with its railing, a mast and a dish
    ctx.fillRect(x, base - 90 * S, 360 * S, 90 * S);
    for (let k = 0; k <= 360; k += 20) ctx.fillRect(x + k * S, base - 116 * S, 3 * S, 26 * S);
    ctx.fillRect(x, base - 118 * S, 360 * S, 3 * S);
    ctx.fillRect(x + 250 * S, base - 260 * S, 4 * S, 170 * S);
    for (let k = 0; k < 3; k++) ctx.fillRect(x + (252 - 22 + k * 6) * S, base - (240 - k * 18) * S, (44 - k * 12) * S, 3 * S);
    ctx.beginPath();
    ctx.ellipse(x + 90 * S, base - 112 * S, 22 * S, 11 * S, -.5, 0, 7);
    ctx.fill();
  }
}
