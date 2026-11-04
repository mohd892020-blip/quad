import { drawCityLife, drawSkyline, paintRoof } from './skyline.js';
import { BEACH, BIRDS, CELL, CITY, CLOCK, DESERT, FOREST, GROUND, MOUNTAIN, SNOW, GROUND_BOX, ORDERS, PEOPLE, PERSPECTIVE, SHOPS, SPRITE, TIMES, WIND, ZONES } from './config.js';
import { buildDesert, drawDesert, drawDunes } from './desert.js';
import { buildForest, drawWoods, drawWoodsBehind } from './forest.js';
import { buildAlpine, drawHigh, drawHighBehind } from './alpine.js';
import { buildSeaside, drawSeaBehind, drawShore } from './seaside.js';
import { ctx, glow, shade, view, X, Y } from './ui.js';

const CLOTHES = ['#e8492c', '#f2efe6', '#4fa3c2', '#ffc23d', '#7cc28f', '#d97aa8', '#3f5f8f', '#fafafa'];
const SHIRTS = ['#e8492c', '#4fa3c2', '#ffc23d', '#7cc28f', '#d97aa8', '#f2efe6', '#5a6b8c'];

export const world = {
  B: [], solids: [], cells: [], edge: [], lines: [], targets: [], shops: [], rigs: [], kiosks: [], seaTargets: [], camps: [], sandTargets: [], pads: [],
  far1: [], far2: [], people: [], flocks: [], span: 1, clock: 0, pal: null, palKey: -1, live: new Set(),
};

export function rng(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function hash(i) {
  const s = Math.sin(i * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

export function zoneAt(x) {
  let zone = ZONES[0];
  for (const z of ZONES) if (x >= z.from) zone = z;
  return zone;
}

// The green pad on a shop roof: landing here orders the job and charges the battery.
export function shopPad(b) {
  return { x: b.x + CITY.padInset, y: b.top };
}

// Any pad charges, in the city, on the coast or in the desert.
export function nearestShop(x) {
  let best = world.pads[0];
  for (const b of world.pads) if (Math.abs(b.x + b.w / 2 - x) < Math.abs(best.x + best.w / 2 - x)) best = b;
  return best;
}

// Everything solid near x, in generation order with the ground last. A rect sits in
// every cell it comes within CELL.margin of, so one lookup covers anything that can touch.
export function nearby(x) {
  return world.cells[Math.floor((x - CELL.base) / CELL.size)] || world.edge;
}

// The highest solid surface within reach of x.
export function roofAt(x, reach) {
  let top = GROUND;
  for (const px of [x - reach, x, x + reach]) {
    for (const R of nearby(px)) if (R.x <= x + reach && R.x + R.w >= x - reach && R.y < top) top = R.y;
  }
  return top;
}

export function indexColliders(solids) {
  const ground = { x: GROUND_BOX.x, y: GROUND, w: GROUND_BOX.w, h: GROUND_BOX.h, mat: 'ground' };
  const cells = [];
  const cellOf = x => Math.max(0, Math.floor((x - CELL.base) / CELL.size));
  for (const R of solids) {
    for (let i = cellOf(R.x - CELL.margin); i <= cellOf(R.x + R.w + CELL.margin); i++) (cells[i] = cells[i] || []).push(R);
  }
  const last = cellOf(ground.x + ground.w);
  for (let i = 0; i <= last; i++) (cells[i] = cells[i] || []).push(ground);
  world.cells = cells;
  world.edge = [ground];
}

export function genWorld(seed) {
  const c = CITY, r = rng(seed);
  const B = [], solids = [], lines = [], targets = [], shops = [], rigs = [];

  const mk = (x, w, h) => {
    const top = GROUND - h, zone = zoneAt(x);
    const b = { x, w, h, top, zone, col: zone.stones[(r() * zone.stones.length) | 0], idx: B.length, bal: [], tank: null, dish: null, lit: [] };
    const cols = Math.max(c.minCols, Math.floor((w - c.sideMargin) / c.cellW));
    const rows = Math.max(c.minRows, Math.floor((h - c.roofMargin) / c.floorH));
    b.cols = cols; b.rows = rows;
    for (let i = 0; i < cols * rows; i++) b.lit.push(r() < c.litChance ? (r() < c.brightChance ? 2 : 1) : 0);
    B.push(b);
    solids.push({ x, y: top, w, h, mat: 'wall' });
    return b;
  };
  const mkShop = (x, h) => {
    const b = mk(x, c.restaurant.w, h);
    b.shop = SHOPS[shops.length % SHOPS.length];
    shops.push(b);
    return b;
  };

  mk(c.leftBuilding.x, c.leftBuilding.w, c.leftBuilding.h);
  const rest = mkShop(c.restaurant.x, c.restaurant.h);

  let x = rest.x + rest.w + c.firstGap, nextShop = rest.x + c.shopEvery;
  while (x < c.endX) {
    const z = zoneAt(x);
    if (x >= nextShop) {
      const b = mkShop(x, c.restaurant.h + r() * c.shopHRange);
      nextShop += c.shopEvery;
      x += b.w + c.gapMin + r() * z.gapRange;
      continue;
    }
    const w = z.widthMin + r() * z.widthRange, h = z.heightMin + r() * z.heightRange, b = mk(x, w, h);
    if (r() < z.tankChance) {
      const tw = c.tankW + r() * c.tankWRange;
      b.tank = { x: b.x + c.tankInset + r() * (w - c.tankSlack - (tw - c.tankW)), y: b.top - c.tankH, w: tw, h: c.tankH, mat: 'tank' };
      solids.push(b.tank);
    }
    if (r() < z.dishChance) {
      b.dish = { x: b.x + w - c.dishInset, y: b.top };
      solids.push({ x: b.dish.x - c.dishW / 2, y: b.top - c.dishH, w: c.dishW, h: c.dishH, mat: 'dish' });
    }
    if (w > c.rigMinW) {
      const mx = b.x + w / 2;
      if (h > c.craneMinH && r() < z.craneChance) {
        const mastH = c.craneMastHMin + r() * c.craneMastHRange, jibY = b.top - mastH, jibX = mx - c.craneJibLen / 2;
        const mast = { x: mx - c.craneMastW / 2, y: jibY, w: c.craneMastW, h: mastH, mat: 'steel' };
        const jib = { x: jibX, y: jibY, w: c.craneJibLen, h: c.craneJibH, mat: 'steel' };
        solids.push(mast, jib);
        rigs.push({ kind: 'crane', mast, jib });
      } else if (r() < z.towerChance) {
        const towerH = c.towerHMin + r() * c.towerHRange;
        const mast = { x: mx - c.towerW / 2, y: b.top - towerH, w: c.towerW, h: towerH, mat: 'steel' };
        solids.push(mast);
        rigs.push({ kind: 'tower', mast });
      }
    }
    if (h > c.balconyMinH) {
      const n = h > c.balconyTwoH ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const side = r() < .5 ? -1 : 1;
        const fl = c.balconyMinFloor + ((r() * (b.rows - c.balconyMinFloor)) | 0);
        const y = GROUND - fl * c.floorH - c.balconyDrop;
        if (y < b.top + c.balconyRoofGap) continue;
        const bw = c.balconyW;
        const bal = { x: side > 0 ? b.x + w : b.x - bw, y, w: bw, h: c.balconyH, side, fl, b };
        b.bal.push(bal);
        solids.push({ x: bal.x, y: bal.y, w: bw, h: c.balconyH, mat: 'balcony' });
        targets.push({ x: bal.x + bw / 2, y: bal.y - c.targetLift, kind: 'bal', fl, b, side, bal });
      }
    }
    targets.push({
      x: b.tank && b.tank.x < b.x + w / 2 ? b.x + w - c.roofTargetInset : b.x + c.roofTargetInset,
      y: b.top - c.targetLift, kind: 'roof', b,
    });
    x += w + c.gapMin + r() * z.gapRange;
  }

  for (let i = 1; i < B.length - 1; i++) {
    const a = B[i], d = B[i + 1], z = a.zone, gap = (a.x + a.w + d.x) / 2;
    // a customer in the street needs a clear drop between the two buildings
    if (a.shop || a.h < z.lineMinH || d.h < z.lineMinH || r() >= z.lineChance) {
      targets.push({ x: gap, y: GROUND - c.targetLift, kind: 'street', b: a });
      continue;
    }
    {
      const ya = Math.max(a.top, d.top) + c.lineDropMin + r() * c.lineDropRange, yb = ya + (r() - .5) * c.lineTilt;
      const p0 = { x: a.x + a.w, y: ya }, p1 = { x: d.x, y: yb };
      const pts = [];
      for (let k = 0; k <= c.linePoints; k++) {
        const t = k / c.linePoints;
        pts.push({ x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t + Math.sin(t * Math.PI) * c.lineSag });
      }
      const power = r() < z.powerChance, clothes = [];
      if (!power) {
        for (let k = c.clothFirst; k < c.clothLast; k += c.clothStep + ((r() * c.clothStepRange) | 0)) {
          clothes.push({
            k, kind: CLOTH_KINDS[(r() * CLOTH_KINDS.length) | 0], c: CLOTHES[(r() * CLOTHES.length) | 0],
            h: c.clothHMin + r() * c.clothHRange, w: c.clothWMin + r() * c.clothWRange,
          });
        }
      }
      lines.push({ pts, clothes, power, minX: p0.x, maxX: p1.x });
    }
  }

  // the rope must be able to reach a customer: nothing solid in their spot or just over it, and no line through it
  const o = ORDERS;
  const blocked = t => solids.some(R => {
    if (R.mat === 'wall' || (t.bal && R.y === t.bal.y && R.x === t.bal.x)) return false;
    const over = t.x > R.x - o.clearX && t.x < R.x + R.w + o.clearX && R.y + R.h <= t.y + c.targetLift && t.y - (R.y + R.h) < o.clearAbove;
    const inside = t.x > R.x - o.insideX && t.x < R.x + R.w + o.insideX && t.y > R.y - o.insideY && t.y < R.y + R.h && R.y < t.y;
    return over || inside;
  }) || lines.some(L => L.pts.some(p => Math.abs(p.x - t.x) < o.lineX && Math.abs(p.y - t.y) < o.lineY));
  const reachable = targets.filter(t => !blocked(t));

  const far1 = [], far2 = [];
  for (let i = 0; i < c.farCount; i++) {
    far1.push({ w: c.far1WMin + r() * c.far1WRange, h: c.far1HMin + r() * c.far1HRange, d: r() < c.far1DomeChance });
    far2.push({ w: c.far2WMin + r() * c.far2WRange, h: c.far2HMin + r() * c.far2HRange, m: r() < c.far2MinaretChance });
  }

  const span = c.endX - c.leftBuilding.x;
  const people = [], flocks = [];
  for (let i = 0; i < span / PEOPLE.spacing; i++) {
    people.push({
      x: r() * span, speed: (r() < .5 ? -1 : 1) * (PEOPLE.speedMin + r() * PEOPLE.speedRange),
      shirt: SHIRTS[(r() * SHIRTS.length) | 0], phase: r() * 7,
    });
  }
  for (let i = 0; i < span / BIRDS.spacing; i++) {
    flocks.push({
      x: c.leftBuilding.x + r() * span, y: GROUND - c.heightMin - BIRDS.heightMin - r() * BIRDS.heightRange,
      n: BIRDS.countMin + ((r() * BIRDS.countRange) | 0), phase: r() * 7,
    });
  }

  const coast = buildSeaside(B.length);
  B.push(...coast.kiosks);
  solids.push(...coast.solids);
  const sand = buildDesert(B.length);
  B.push(...sand.kiosks, ...sand.rocks);
  solids.push(...sand.solids);
  const woods = buildForest(B.length);
  B.push(...woods.kiosks, ...woods.cabins);
  solids.push(...woods.solids);
  const high = buildAlpine(B.length);
  B.push(...high.mountKiosks, ...high.snowKiosks, ...high.B);
  solids.push(...high.solids);
  lines.push(...high.lines);

  dropSprites();
  indexColliders(solids);
  Object.assign(world, {
    B, solids, lines, targets: reachable, shops, rigs, far1, far2, people, flocks, span, kiosks: coast.kiosks, seaTargets: coast.targets,
    camps: sand.kiosks, sandTargets: sand.targets, lodges: woods.kiosks, forestTargets: woods.targets, pines: woods.pines,
    mountShops: high.mountKiosks, mountTargets: high.mountTargets, snowShops: high.snowKiosks, snowTargets: high.snowTargets, snowPines: high.snowPines,
    pads: [...shops, ...coast.kiosks, ...sand.kiosks, ...woods.kiosks, ...high.mountKiosks, ...high.snowKiosks],
  });
}

export function dropSprites() {
  for (const b of world.live) b.sprite = null;
  world.live.clear();
}

export function mixHex(a, b, t) {
  const n = parseInt(a.slice(1), 16), m = parseInt(b.slice(1), 16);
  const ch = sh => Math.round((n >> sh & 255) + ((m >> sh & 255) - (n >> sh & 255)) * t);
  return `#${((1 << 24) + (ch(16) << 16) + (ch(8) << 8) + ch(0)).toString(16).slice(1)}`;
}

function blendTimes(a, b, t) {
  const num = k => a[k] + (b[k] - a[k]) * t, col = k => mixHex(a[k], b[k], t);
  return {
    sky: a.sky.map(([at, c], i) => [at, mixHex(c, b.sky[i][1], t)]),
    lit: a.lit.map((c, i) => mixHex(c, b.lit[i], t)),
    stars: num('stars'), discCut: num('discCut'), light: num('light'), extraLit: num('extraLit'), windowGlow: num('windowGlow'), signGlow: num('signGlow'),
    cloud: col('cloud'), cloudShade: col('cloudShade'), cloudAlpha: num('cloudAlpha'), disc: col('disc'), discShade: col('discShade'), far1: col('far1'), far2: col('far2'), ground: col('ground'), walk: col('walk'), sea: col('sea'), sand: col('sand'),
    dune: col('dune'), duneNear: col('duneNear'), duneFar: col('duneFar'),
    peakFar: col('peakFar'), peakNear: col('peakNear'), snowCap: col('snowCap'), scree: col('scree'), snowFar: col('snowFar'), snowNear: col('snowNear'), snowGround: col('snowGround'), ice: col('ice'),
    moss: col('moss'), hill: col('hill'), pineFar: col('pineFar'), pineNear: col('pineNear'), mistTone: t < .5 ? a.mistTone : b.mistTone,
  };
}

// The sky blends every frame it changes, but buildings are cached images, so the
// fade moves in small steps and refreshSprite repaints them one at a time.
export function setClock(seconds) {
  const c = CLOCK, span = c.hold + c.fade, n = TIMES.length, day = span * n;
  world.clock = (seconds % day + day) % day;
  const i = Math.floor(world.clock / span), into = world.clock - i * span;
  const t = into < c.hold ? 0 : Math.round((into - c.hold) / c.fade * c.steps) / c.steps;
  const key = i + t * .99;
  if (key === world.palKey) return;
  world.palKey = key;
  world.pal = blendTimes(TIMES[i], TIMES[(i + 1) % n], t);
}
setClock(CLOCK.startAt * (CLOCK.hold + CLOCK.fade));

export function stepClock(dt) {
  setClock(world.clock + dt);
}

export function stepWind(st, dt) {
  if (st.t > st.windNext) {
    let pick = Math.random();
    const kind = WIND.kinds.find(k => (pick -= k.chance) < 0) ?? WIND.kinds[WIND.kinds.length - 1];
    st.windT = (Math.random() < .5 ? -1 : 1) * (kind.from + Math.random() * (kind.to - kind.from)) * st.level.wind;
    st.windNext = st.t + WIND.gapMin + Math.random() * WIND.gapRange;
  }
  st.wind += (st.windT - st.wind) * Math.min(1, dt * WIND.follow);
}

/* ---------- render ---------- */
export function drawSky(st) {
  const { W, H, S } = view, time = world.pal;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  for (const [at, col] of time.sky) g.addColorStop(at, col);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  if (time.stars > .02) {
    ctx.fillStyle = `rgba(255,243,223,${time.stars})`;
    for (let i = 0; i < 50; i++) {
      const sx = ((i * 137.5 - st.cam.x * .05) % W + W) % W, sy = (i * 71) % (H * .45);
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }
  }
  const mx = W * .78 - st.cam.x * .02 * S, my = H * .16;
  ctx.fillStyle = time.disc;
  ctx.beginPath();
  ctx.arc(mx, my, 26 * S, 0, 7);
  ctx.fill();
  if (time.discCut > .02) {
    ctx.fillStyle = time.discShade;
    ctx.beginPath();
    ctx.arc(mx + 10 * S, my - 6 * S, 23 * S * time.discCut, 0, 7);
    ctx.fill();
  }
}

// Paints the parts of a building that do not change with the camera, in world units.
function paintBuilding(g, b) {
  const time = world.pal, c = CITY, z = b.zone, style = z.style;
  const L = b.x, T = b.top, Bt = GROUND + 60;
  g.fillStyle = shade(b.col, time.light);
  g.fillRect(L, T, b.w, Bt - T);
  g.fillStyle = shade(b.col, .85 * time.light);
  g.fillRect(L, T, b.w, 5);
  if (style !== 'tower' && !b.rock) {
    for (let y = T + c.floorH; y < GROUND; y += c.floorH) {
      g.fillStyle = 'rgba(0,0,0,.06)';
      g.fillRect(L, y, b.w, 1.5);
    }
  }
  const sill = shade(b.col, .6 * time.light);
  const gx = (b.w - b.cols * c.cellW) / 2 + 8 + (14 - z.winW) / 2;
  for (let r = 0; r < b.rows; r++) for (let col = 0; col < b.cols; col++) {
    const i = r * b.cols + col, wx = L + gx + col * c.cellW, wy = GROUND - (r + 1) * c.floorH + 10;
    if (wy < T + 8) continue;
    const lit = b.lit[i] || (hash(i + b.idx * 97) < time.extraLit ? 1 : 0);
    g.fillStyle = time.lit[lit];
    g.fillRect(wx, wy, z.winW, z.winH);
    if (style === 'old') {
      g.beginPath();
      g.arc(wx + z.winW / 2, wy, z.winW / 2, Math.PI, 0);
      g.fill();
    }
    if (time.windowGlow > .05 && lit) {
      g.globalAlpha = time.windowGlow;
      glow(g, 'rgba(255,190,110,.5)', wx + z.winW / 2, wy + z.winH / 2, 22);
      g.globalAlpha = 1;
    }
    if (style !== 'tower') {
      g.fillStyle = sill;
      g.fillRect(wx - 2, wy + z.winH, z.winW + 4, 2.5);
    }
  }
  if (style === 'village' || style === 'beach') {
    // a tiled cap across the top of the wall
    g.fillStyle = shade('#b4553a', time.light);
    g.beginPath();
    g.moveTo(L - 7, T + 20); g.lineTo(L + 10, T); g.lineTo(L + b.w - 10, T); g.lineTo(L + b.w + 7, T + 20);
    g.fill();
    g.fillStyle = 'rgba(0,0,0,.14)';
    for (let y = T + 6; y < T + 20; y += 6) g.fillRect(L - 4, y, b.w + 8, 1.5);
  }
  if (b.rock) {
    // worn bands of rock, and a paler cap where the sun lands
    g.fillStyle = shade(b.cap ?? DESERT.rockCap, time.light);
    g.fillRect(L, T, b.w, 7);
    g.fillStyle = 'rgba(60,25,10,.14)';
    for (let y = T + 26, i = 1; y < GROUND; y += 20 + hash(b.idx + i) * 28, i++) g.fillRect(L, y, b.w, 3 + hash(b.idx * 3 + i) * 6);
  } else if (style === 'alpine') {
    // a stone base under timber, and a slate roof
    g.fillStyle = 'rgba(30,25,25,.18)';
    for (let y = GROUND - 12; y > GROUND - b.h * .45; y -= 12) for (let x = L + ((y / 12) % 2) * 9; x < L + b.w; x += 18) g.fillRect(x, y, 16, 1.5);
    g.fillStyle = shade('#9c6b44', time.light);
    g.fillRect(L, T + 8, b.w, b.h * .5);
    g.fillStyle = 'rgba(40,20,10,.22)';
    for (let y = T + 18; y < T + 8 + b.h * .5; y += 10) g.fillRect(L, y, b.w, 2);
    g.fillStyle = shade('#5f6470', time.light);
    g.fillRect(L - 6, T - 4, b.w + 12, 12);
    if (b.hut) {
      g.fillStyle = time.lit[1];
      g.fillRect(L + b.w * .2, T + 20, 22, 18);
    }
  } else if (style === 'snow') {
    // timber walls and a deep load of snow on the roof
    g.fillStyle = 'rgba(40,20,10,.22)';
    for (let y = T + 14; y < GROUND; y += 11) g.fillRect(L, y, b.w, 2);
    g.fillStyle = shade('#f4f8fc', time.light);
    g.fillRect(L - 6, T - 8, b.w + 12, 14);
    for (let x = L; x < L + b.w; x += 14) g.fillRect(x, T + 6, 5, 6 + (x * 7 % 9));
    if (b.chalet) {
      g.fillStyle = shade('#3a2618', time.light);
      g.fillRect(L + b.w * .62, GROUND - 46, 24, 46);
      g.fillStyle = time.lit[1];
      g.fillRect(L + b.w * .18, GROUND - b.h * .62, 26, 20);
    }
  } else if (style === 'forest') {
    // log walls and a roof of turf
    g.fillStyle = 'rgba(40,20,10,.22)';
    for (let y = T + 14; y < GROUND; y += 11) g.fillRect(L, y, b.w, 2);
    g.fillStyle = shade('#5f8f45', time.light);
    g.fillRect(L - 4, T - 6, b.w + 8, 10);
    g.fillStyle = shade('#46703a', time.light);
    for (let x = L - 2; x < L + b.w; x += 9) g.fillRect(x, T - 9, 3, 4);
    if (b.cabin) {
      g.fillStyle = shade('#3a2618', time.light);
      g.fillRect(L + b.w * .62, GROUND - 46, 24, 46);
      g.fillStyle = time.lit[1];
      g.fillRect(L + b.w * .18, GROUND - b.h * .62, 26, 20);
    }
  } else if (style === 'desert') {
    // a striped cloth shade over the stall's door
    for (let x = L + 12, i = 0, y = GROUND - 64; x < L + b.w - 12; x += 16, i++) {
      g.fillStyle = shade(i % 2 ? '#f2efe6' : '#b4553a', time.light);
      g.fillRect(x, y, Math.min(16, L + b.w - 12 - x), 12);
    }
  }
  if (style === 'souk' && !b.shop) {
    // striped market awning over the street
    const y = GROUND - 44;
    for (let x = L, i = 0; x < L + b.w; x += 14, i++) {
      g.fillStyle = shade(i % 2 ? '#f2efe6' : ['#e8492c', '#2f8f8a', '#d9a321'][b.idx % 3], time.light);
      g.fillRect(x, y, Math.min(14, L + b.w - x), 13);
    }
  }
  if (style === 'tower') {
    g.fillStyle = `rgba(255,255,255,${.1 * time.light})`;
    g.beginPath();
    g.moveTo(L, T + 120); g.lineTo(L + b.w, T); g.lineTo(L + b.w, T + 90); g.lineTo(L, T + 210);
    g.fill();
  }
  if (b.shop) {
    g.fillStyle = '#2b1b14';
    g.fillRect(L + 20, GROUND - 50, b.w - 40, 50);
    // the glow stays on the wall: past it the sprite is transparent and would smear
    g.save();
    g.beginPath();
    g.rect(L, T, b.w, Bt - T);
    g.clip();
    g.globalAlpha = time.signGlow;
    glow(g, b.shop.glow, L + b.w / 2, T + 31, 85);
    g.restore();
    g.fillStyle = 'rgba(32,18,20,.88)';
    g.fillRect(L + b.w / 2 - 72, T + 15, 144, 32);
    g.font = '22px Lalezar, Tajawal, sans-serif';
    g.textAlign = 'center';
    g.fillStyle = '#ffe9dc';
    g.fillText(b.shop.name, L + b.w / 2, T + 39);
    const p = shopPad(b);
    g.strokeStyle = 'rgba(79,194,124,.9)';
    g.lineWidth = 3;
    g.setLineDash([8, 6]);
    g.strokeRect(p.x - 50, p.y - 4, 100, 4);
    g.setLineDash([]);
    g.fillStyle = '#4fc27c';
    g.font = '700 11px Tajawal,sans-serif';
    g.fillText('Pickup + Charge', p.x, p.y - 10);
  }
  if (b.tank) {
    const t = b.tank;
    g.fillStyle = '#7d8a96';
    g.fillRect(t.x + 4, t.y + 16, 3, 10);
    g.fillRect(t.x + t.w - 7, t.y + 16, 3, 10);
    g.fillStyle = '#e9e4dc';
    g.beginPath();
    g.ellipse(t.x + t.w / 2, t.y + 9, t.w / 2, 9, 0, 0, 7);
    g.fill();
    g.fillStyle = '#c8c1b5';
    g.fillRect(t.x, t.y + 8, t.w, 3);
  }
  if (b.dish) {
    g.strokeStyle = '#ddd';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(b.dish.x, b.dish.y);
    g.lineTo(b.dish.x, b.dish.y - 12);
    g.stroke();
    g.fillStyle = '#eee';
    g.beginPath();
    g.ellipse(b.dish.x - 3, b.dish.y - 16, 8, 4, -.6, 0, 7);
    g.fill();
  }
  for (const bl of b.bal) {
    g.fillStyle = shade(b.col, .7 * time.light);
    g.fillRect(bl.x, bl.y, bl.w, 8);
    g.strokeStyle = 'rgba(40,30,30,.75)';
    g.lineWidth = 1.5;
    g.beginPath();
    for (let k = 0; k <= bl.w; k += 6) { g.moveTo(bl.x + k, bl.y); g.lineTo(bl.x + k, bl.y - 14); }
    g.moveTo(bl.x, bl.y - 14);
    g.lineTo(bl.x + bl.w, bl.y - 14);
    g.stroke();
  }
  paintRoof(g, b);
}

// painted for the camera's closest shot, so a glide between shots never repaints them
const spriteK = () => view.sharp * Math.min(view.DPR, SPRITE.maxDensity);

// Each visible building is kept as a ready image, so a frame only blits it.
function paintSprite(b) {
  const k = spriteK(), p = SPRITE, reuse = b.sprite && b.spriteK === k;
  const s = reuse ? b.sprite : document.createElement('canvas');
  if (!reuse) {
    s.width = Math.ceil((b.w + p.padX * 2) * k);
    s.height = Math.ceil((GROUND + 60 - b.top + p.padTop) * k);
  }
  const g = s.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, s.width, s.height);
  g.setTransform(k, 0, 0, k, (p.padX - b.x) * k, (p.padTop - b.top) * k);
  paintBuilding(g, b);
  b.sprite = s;
  b.spriteK = k;
  b.spritePal = world.palKey;
  world.live.add(b);
  return s;
}

// Any sprite draws true to size, scaled to the zoom, so only a missing one must be painted now; one from an older fade
// step or another zoom is brought up to date by refreshSprite, nearest first.
const spriteOf = b => b.sprite ?? paintSprite(b);

// One repaint a frame, nearest first: this keeps buildings ready before they scroll in
// and spreads a fade step over several frames, so neither lands as one long frame.
function refreshSprite(vpx) {
  const k = spriteK();
  let next = null, best = view.viewW / 2 + SPRITE.ahead;
  for (const b of world.B) {
    const gap = Math.abs(b.x + b.w / 2 - vpx);
    if (gap < best && !(b.sprite && b.spriteK === k && b.spritePal === world.palKey)) {
      next = b;
      best = gap;
    }
  }
  if (next) paintSprite(next);
}

function drawBuildings() {
  const { W, S, viewW, viewH } = view, p = SPRITE, light = world.pal.light;
  const vpx = view.cam.x + viewW / 2, vpy = view.cam.y + viewH * PERSPECTIVE.eyeY, f = PERSPECTIVE.depth;
  const back = (x, y) => [X(vpx + (x - vpx) * f), Y(vpy + (y - vpy) * f)];
  refreshSprite(vpx);
  const vis = world.B.filter(b => X(b.x + b.w) > -120 && X(b.x) < W + 120)
    .sort((a, b) => Math.abs(b.x + b.w / 2 - vpx) - Math.abs(a.x + a.w / 2 - vpx));
  for (const b of vis) {
    const L = b.x, Rt = b.x + b.w, T = b.top, Bt = GROUND + 60;
    // side face toward vanishing point
    ctx.fillStyle = shade(b.col, .55 * light);
    ctx.beginPath();
    if (b.x + b.w / 2 > vpx) {
      const [x1, y1] = back(L, T), [x2, y2] = back(L, Bt);
      ctx.moveTo(X(L), Y(T)); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(X(L), Y(Bt));
    } else {
      const [x1, y1] = back(Rt, T), [x2, y2] = back(Rt, Bt);
      ctx.moveTo(X(Rt), Y(T)); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(X(Rt), Y(Bt));
    }
    ctx.fill();
    // roof (visible when below eye level)
    if (T > vpy) {
      const [a1, a2] = back(L, T), [b1, b2] = back(Rt, T);
      ctx.fillStyle = shade(b.col, .78 * light);
      ctx.beginPath();
      ctx.moveTo(X(L), Y(T)); ctx.lineTo(a1, a2); ctx.lineTo(b1, b2); ctx.lineTo(X(Rt), Y(T));
      ctx.fill();
    }
    const s = spriteOf(b);
    ctx.drawImage(s, X(L - p.padX), Y(T - p.padTop), s.width * S / b.spriteK, s.height * S / b.spriteK);
  }
  for (const b of world.live) {
    if (Math.abs(b.x - vpx) > viewW + p.evictMargin) { b.sprite = null; world.live.delete(b); }
  }
}

function drawRigs(st) {
  const { W, S } = view;
  for (const rig of world.rigs) {
    const m = rig.mast, reach = rig.jib ? rig.jib : m;
    if (X(reach.x + reach.w) < -40 || X(reach.x) > W + 40) continue;
    ctx.fillStyle = rig.kind === 'crane' ? '#e0a52c' : '#8b95a3';
    ctx.fillRect(X(m.x), Y(m.y), m.w * S, m.h * S);
    ctx.strokeStyle = 'rgba(30,22,30,.55)';
    ctx.lineWidth = 1 * S;
    ctx.beginPath();
    for (let y = m.y + 10; y < m.y + m.h; y += 16) {
      ctx.moveTo(X(m.x), Y(y));
      ctx.lineTo(X(m.x + m.w), Y(y + 8));
    }
    ctx.stroke();
    if (rig.jib) {
      const j = rig.jib;
      ctx.fillStyle = '#e0a52c';
      ctx.fillRect(X(j.x), Y(j.y), j.w * S, j.h * S);
      ctx.fillStyle = '#5a6470';
      ctx.fillRect(X(j.x), Y(j.y + j.h), 22 * S, 14 * S);
      ctx.strokeStyle = '#2b2233';
      ctx.beginPath();
      ctx.moveTo(X(j.x + j.w - 24), Y(j.y + j.h));
      ctx.lineTo(X(j.x + j.w - 24), Y(j.y + j.h + 46));
      ctx.stroke();
    } else glow(ctx, '#ff3b3b', X(m.x + m.w / 2), Y(m.y), (8 + 5 * Math.abs(Math.sin(st.t * 2))) * S);
  }
}

// Each piece is a path in pixels from the line down; f pushes the hem sideways.
const CLOTH = {
  shirt(w, h, f) {
    ctx.moveTo(-w * .26, 0);
    ctx.lineTo(-w * .62, h * .16); ctx.lineTo(-w * .48, h * .36); ctx.lineTo(-w * .28, h * .24);
    ctx.lineTo(-w * .28 + f, h); ctx.lineTo(w * .28 + f, h);
    ctx.lineTo(w * .28, h * .24); ctx.lineTo(w * .48, h * .36); ctx.lineTo(w * .62, h * .16);
    ctx.lineTo(w * .26, 0);
    ctx.quadraticCurveTo(0, h * .14, -w * .26, 0);
  },
  pants(w, h, f) {
    ctx.moveTo(-w * .36, 0); ctx.lineTo(w * .36, 0);
    ctx.lineTo(w * .42 + f, h * 1.25); ctx.lineTo(w * .1 + f, h * 1.25);
    ctx.lineTo(0, h * .36);
    ctx.lineTo(-w * .1 + f, h * 1.25); ctx.lineTo(-w * .42 + f, h * 1.25);
  },
  dress(w, h, f) {
    ctx.moveTo(-w * .2, 0); ctx.lineTo(w * .2, 0); ctx.lineTo(w * .24, h * .38);
    ctx.quadraticCurveTo(w * .5 + f * .5, h * .8, w * .52 + f, h * 1.2);
    ctx.quadraticCurveTo(f, h * 1.12, -w * .52 + f, h * 1.2);
    ctx.quadraticCurveTo(-w * .5 + f * .5, h * .8, -w * .24, h * .38);
  },
  towel(w, h, f) {
    ctx.moveTo(-w * .5, 0); ctx.lineTo(w * .5, 0); ctx.lineTo(w * .5 + f, h);
    ctx.quadraticCurveTo(f, h - w * .12, -w * .5 + f, h);
  },
  socks(w, h, f) {
    for (const x of [-w * .3, w * .12]) {
      ctx.moveTo(x, 0); ctx.lineTo(x + w * .18, 0); ctx.lineTo(x + w * .18 + f * .4, h * .42);
      ctx.lineTo(x + w * .34 + f * .4, h * .5); ctx.lineTo(x + w * .3 + f * .4, h * .62); ctx.lineTo(x + f * .4, h * .55);
    }
  },
};
const CLOTH_KINDS = Object.keys(CLOTH);

function drawCloth(c, p, st) {
  const S = view.S, w = c.w * S, h = c.h * S;
  const f = (Math.sin(st.t * 2.6 + c.k) * 1.6 + st.wind * .03) * S;
  ctx.save();
  ctx.translate(X(p.x), Y(p.y));
  ctx.rotate(Math.sin(st.t * 1.4 + c.k * 2) * .035 + st.wind * .0012);
  ctx.beginPath();
  CLOTH[c.kind](w, h, f);
  ctx.closePath();
  ctx.fillStyle = shade(c.c, world.pal.light);
  ctx.fill();
  if (!view.lowQ && c.kind !== 'socks') {
    // a soft fold down one side: the same shape, narrower, so it stays inside the cloth
    if (c.kind === 'towel') {
      ctx.fillStyle = 'rgba(255,255,255,.45)';
      ctx.fillRect(-w * .5 + f * .62, h * .62, w, h * .1);
    }
    ctx.translate(w * .14, 0);
    ctx.scale(.5, 1);
    ctx.beginPath();
    CLOTH[c.kind](w, h, f);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0,0,0,.13)';
    ctx.fill();
  }
  ctx.restore();
  ctx.save();
  ctx.translate(X(p.x), Y(p.y));
  ctx.fillStyle = '#b98f5e';
  for (const x of c.kind === 'socks' ? [-w * .21, w * .21] : [-w * .24, w * .24]) ctx.fillRect(x - 1.1 * S, -3 * S, 2.2 * S, 6 * S);
  ctx.restore();
}

function drawLines(st) {
  const { W, S } = view;
  for (const L of world.lines) {
    if (X(L.maxX) < -20 || X(L.minX) > W + 20) continue;
    ctx.strokeStyle = L.power ? 'rgba(16,14,20,.95)' : shade('#d8d2c4', world.pal.light);
    ctx.lineWidth = (L.power ? 2 : 1.3) * S;
    ctx.beginPath();
    L.pts.forEach((p, i) => i ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y)));
    ctx.stroke();
    if (L.power) {
      ctx.fillStyle = '#7ad0ff';
      for (const i of [3, 7, 11]) ctx.fillRect(X(L.pts[i].x) - 2 * S, Y(L.pts[i].y) - 2 * S, 4 * S, 4 * S);
    }
    if (!L.power) {
      ctx.fillStyle = '#3a3038';
      for (const p of [L.pts[0], L.pts[L.pts.length - 1]]) ctx.fillRect(X(p.x) - 2.5 * S, Y(p.y) - 2.5 * S, 5 * S, 5 * S);
    }
    for (const c of L.clothes) drawCloth(c, L.pts[c.k], st);
  }
}

function drawPeople(st) {
  const { W, S, lowQ } = view, c = PEOPLE, y = GROUND + c.sidewalk + c.height, span = world.span;
  const left = CITY.leftBuilding.x;
  for (let i = 0; i < world.people.length; i += lowQ ? 2 : 1) {
    const p = world.people[i];
    const x = left + ((p.x + st.t * p.speed) % span + span) % span, sx = X(x);
    if (sx < -20 || sx > W + 20) continue;
    const walk = Math.sin(st.t * c.walkRate + p.phase) * 4;
    ctx.strokeStyle = '#1d1420';
    ctx.lineWidth = 2 * S;
    ctx.beginPath();
    ctx.moveTo(sx, Y(y - 8)); ctx.lineTo(X(x + walk), Y(y));
    ctx.moveTo(sx, Y(y - 8)); ctx.lineTo(X(x - walk), Y(y));
    ctx.stroke();
    ctx.fillStyle = p.shirt;
    ctx.fillRect(sx - 3 * S, Y(y - 17), 6 * S, 10 * S);
    ctx.fillStyle = '#e0b48c';
    ctx.beginPath();
    ctx.arc(sx, Y(y - 20), 3 * S, 0, 7);
    ctx.fill();
  }
}

function drawBirds(st) {
  if (view.lowQ) return;
  const { W, S } = view, c = BIRDS;
  ctx.strokeStyle = world.pal.stars > .3 ? 'rgba(240,235,225,.75)' : 'rgba(40,40,55,.8)';
  ctx.lineWidth = 1.4 * S;
  ctx.beginPath();
  for (const f of world.flocks) {
    const cx = f.x + Math.cos(st.t * c.speed + f.phase) * c.radius, cy = f.y + Math.sin(st.t * c.speed * 2 + f.phase) * 18;
    if (X(cx) < -80 || X(cx) > W + 80) continue;
    for (let i = 0; i < f.n; i++) {
      const bx = X(cx + hash(i + f.phase) * 60 - 30), by = Y(cy + hash(i * 3 + f.phase) * 30 - 15);
      const wing = Math.sin(st.t * c.flap + i) * 3 * S;
      ctx.moveTo(bx - 4 * S, by - wing);
      ctx.lineTo(bx, by);
      ctx.lineTo(bx + 4 * S, by - wing);
    }
  }
  ctx.stroke();
}

// The strip map: zones as bands, then shops, the customer, and the player on top.
export function drawMap(st) {
  const c = document.getElementById('map'), w = view.mapW, h = view.mapH;
  // the strip covers the stretch of world the mission is flown in
  const level = st.level, [left, right] = level.snow ? [SNOW.from, SNOW.to] : level.mountain ? [MOUNTAIN.from, MOUNTAIN.to] : level.forest ? [FOREST.from, FOREST.to] : level.desert ? [DESERT.from, DESERT.to] : level.beach ? [BEACH.from, BEACH.to] : [CITY.leftBuilding.x, BEACH.from];
  const k = view.DPR, span = right - left;
  if (c.width !== Math.round(w * k)) {
    c.width = Math.round(w * k);
    c.height = Math.round(h * k);
  }
  const g = c.getContext('2d'), mx = x => (x - left) / span * w;
  g.setTransform(k, 0, 0, k, 0, 0);
  g.clearRect(0, 0, w, h);
  ZONES.forEach((z, i) => {
    const a = Math.max(0, mx(z.from)), b = i + 1 < ZONES.length ? mx(ZONES[i + 1].from) : w;
    g.fillStyle = z.map;
    g.globalAlpha = .45;
    g.fillRect(a, 0, b - a - 1, h);
    g.globalAlpha = 1;
  });
  const dot = (x, col, r) => {
    g.fillStyle = col;
    g.strokeStyle = '#140f2a';
    g.lineWidth = 1;
    g.beginPath();
    g.arc(mx(x), h / 2, r, 0, 7);
    g.fill();
    g.stroke();
  };
  if (st.order?.next) dot(st.order.next.t.x, '#e8492c', h / 2 - 1);
  if (st.order) dot(st.order.t.x, '#e8492c', h / 2);
  else dot(st.stop.shop.x + st.stop.shop.w / 2, '#ffc23d', h / 2);
  if (st.rival) dot(st.rival.x, '#ff3b3b', h / 2 - 1);
  g.fillStyle = '#fff';
  g.fillRect(mx(st.d.x) - 1.5, 0, 3, h);
}

export function drawCity(st) {
  const { W, H } = view, time = world.pal, coast = X(BEACH.from);
  // the skyline ends at the coast; only then is it worth a clip
  ctx.save();
  if (coast < W) {
    ctx.beginPath();
    ctx.rect(0, 0, Math.max(0, coast), H);
    ctx.clip();
  }
  drawSkyline(st);
  ctx.restore();
  drawSeaBehind();
  drawDunes();
  drawWoodsBehind();
  drawHighBehind();
  ctx.fillStyle = time.ground;
  ctx.fillRect(0, Y(GROUND), W, H);
  drawBuildings();
  drawRigs(st);
  drawCityLife(st);
  ctx.fillStyle = time.walk;
  ctx.fillRect(0, Y(GROUND + PEOPLE.sidewalk), W, H);
  drawShore(st);
  drawDesert(st);
  drawWoods(st);
  drawHigh(st);
  drawLines(st);
  drawPeople(st);
  drawBirds(st);
}
