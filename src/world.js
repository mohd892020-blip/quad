import { CAMERA, CITY, G, GROUND, GROUND_BOX, PERSPECTIVE, WIND } from './config.js';
import { ctx, shade, view, X, Y } from './ui.js';

const STONES = ['#c9a27a', '#b8916c', '#d4b08a', '#a98463', '#c09673', '#d8bb98'];
const CLOTHES = ['#e8492c', '#f2efe6', '#4fa3c2', '#ffc23d', '#7cc28f', '#d97aa8'];

export const world = { B: [], solids: [], colliders: [], lines: [], targets: [], rest: null, far1: [], far2: [] };

function rng(a) {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function restPad() {
  return { x: world.rest.x + world.rest.w / 2, y: world.rest.top };
}

export function genWorld(seed) {
  const c = CITY, r = rng(seed);
  const B = [], solids = [], lines = [], targets = [];

  const mk = (x, w, h) => {
    const top = GROUND - h;
    const b = { x, w, h, top, col: STONES[(r() * STONES.length) | 0], idx: B.length, bal: [], tank: null, dish: null, lit: [] };
    const cols = Math.max(c.minCols, Math.floor((w - c.sideMargin) / c.cellW));
    const rows = Math.max(c.minRows, Math.floor((h - c.roofMargin) / c.floorH));
    b.cols = cols; b.rows = rows;
    for (let i = 0; i < cols * rows; i++) b.lit.push(r() < c.litChance ? (r() < c.brightChance ? 2 : 1) : 0);
    B.push(b);
    solids.push({ x, y: top, w, h });
    return b;
  };

  mk(c.leftBuilding.x, c.leftBuilding.w, c.leftBuilding.h);
  const rest = mk(c.restaurant.x, c.restaurant.w, c.restaurant.h);
  rest.isRest = true;

  let x = rest.x + rest.w + c.firstGap;
  while (x < c.endX) {
    const w = c.widthMin + r() * c.widthRange, h = c.heightMin + r() * c.heightRange, b = mk(x, w, h);
    if (r() < c.tankChance) {
      b.tank = { x: b.x + c.tankInset + r() * (w - c.tankSlack), y: b.top - c.tankH, w: c.tankW, h: c.tankH };
      solids.push(b.tank);
    }
    if (r() < c.dishChance) b.dish = { x: b.x + w - c.dishInset, y: b.top };
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
        solids.push({ x: bal.x, y: bal.y, w: bw, h: c.balconyH });
        targets.push({ x: bal.x + bw / 2, y: bal.y - c.targetLift, kind: 'bal', fl, b, side, bal });
      }
    }
    targets.push({
      x: b.tank && b.tank.x < b.x + w / 2 ? b.x + w - c.roofTargetInset : b.x + c.roofTargetInset,
      y: b.top - c.targetLift, kind: 'roof', b,
    });
    x += w + c.gapMin + r() * c.gapRange;
  }

  for (let i = 1; i < B.length - 1; i++) {
    const a = B[i], d = B[i + 1];
    if (a.isRest || a.h < c.lineMinH || d.h < c.lineMinH) continue;
    if (r() < c.lineChance) {
      const ya = Math.max(a.top, d.top) + c.lineDropMin + r() * c.lineDropRange, yb = ya + (r() - .5) * c.lineTilt;
      const p0 = { x: a.x + a.w, y: ya }, p1 = { x: d.x, y: yb };
      const pts = [];
      for (let k = 0; k <= c.linePoints; k++) {
        const t = k / c.linePoints;
        pts.push({ x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t + Math.sin(t * Math.PI) * c.lineSag });
      }
      const clothes = [];
      for (let k = c.clothFirst; k < c.clothLast; k += c.clothStep + ((r() * c.clothStepRange) | 0)) {
        clothes.push({
          k, c: CLOTHES[(r() * CLOTHES.length) | 0],
          h: c.clothHMin + r() * c.clothHRange, w: c.clothWMin + r() * c.clothWRange,
        });
      }
      lines.push({ pts, clothes });
    }
  }

  const far1 = [], far2 = [];
  for (let i = 0; i < c.farCount; i++) {
    far1.push({ w: c.far1WMin + r() * c.far1WRange, h: c.far1HMin + r() * c.far1HRange, d: r() < c.far1DomeChance });
    far2.push({ w: c.far2WMin + r() * c.far2WRange, h: c.far2HMin + r() * c.far2HRange, m: r() < c.far2MinaretChance });
  }

  const colliders = solids.concat([{ x: GROUND_BOX.x, y: GROUND, w: GROUND_BOX.w, h: GROUND_BOX.h }]);
  Object.assign(world, { B, solids, colliders, lines, targets, rest, far1, far2 });
}

export function stepWind(st, dt) {
  if (st.t > st.windNext) {
    st.windT = Math.random() < WIND.calmChance ? 0
      : (Math.random() - .5) * 2 * (WIND.base + Math.min(st.del, WIND.maxDeliveries) * WIND.perDelivery);
    st.windNext = st.t + WIND.gapMin + Math.random() * WIND.gapRange;
  }
  st.wind += (st.windT - st.wind) * Math.min(1, dt * WIND.follow);
}

export function stepCamera(st, dt) {
  const { viewW, viewH } = view, d = st.d;
  const cx = d.x - viewW * CAMERA.leadX + d.vx * CAMERA.lookAhead;
  st.cam.x += (cx - st.cam.x) * Math.min(1, dt * CAMERA.follow);
  const baseY = GROUND + CAMERA.floorBelow - viewH;
  const cy = Math.min(baseY, d.y - viewH * CAMERA.leadY);
  st.cam.y += (cy - st.cam.y) * Math.min(1, dt * CAMERA.follow);
  st.shake = Math.max(0, st.shake - dt * CAMERA.shakeDecay);
}

/* ---------- render ---------- */
export function drawSky(st) {
  const { W, H, S } = view;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#140f2a'); g.addColorStop(.45, '#3b2452'); g.addColorStop(.8, '#b4505a'); g.addColorStop(1, '#f0a259');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,243,223,.7)';
  for (let i = 0; i < 50; i++) {
    const sx = ((i * 137.5 - st.cam.x * .05) % W + W) % W, sy = (i * 71) % (H * .45);
    ctx.fillRect(sx, sy, 1.5, 1.5);
  }
  const mx = W * .78 - st.cam.x * .02 * S, my = H * .16;
  ctx.fillStyle = '#fff1d0';
  ctx.beginPath();
  ctx.arc(mx, my, 26 * S, 0, 7);
  ctx.fill();
  ctx.fillStyle = '#3b2452';
  ctx.beginPath();
  ctx.arc(mx + 10 * S, my - 6 * S, 23 * S, 0, 7);
  ctx.fill();
}

function drawFar(st, arr, par, col, baseOff, scale) {
  const { W, S } = view;
  ctx.fillStyle = col;
  let x = 0;
  const tot = arr.reduce((s, b) => s + b.w + 6, 0);
  const off = ((st.cam.x * par) % tot + tot) % tot;
  const gy = Y(GROUND) - baseOff * S;
  for (let rep = -1; rep < 3; rep++) {
    x = rep * tot - off;
    for (const b of arr) {
      const sx = x * S, w = b.w * S * scale, h = b.h * S * scale;
      if (sx < W + 50 && sx + w > -50) {
        ctx.fillRect(sx, gy - h, w, h + baseOff * S + 400);
        if (b.d) {
          ctx.beginPath();
          ctx.arc(sx + w / 2, gy - h, w * .32, Math.PI, 0);
          ctx.fill();
          ctx.fillRect(sx + w * .48, gy - h - w * .55, w * .04, w * .25);
        }
        if (b.m) ctx.fillRect(sx + w * .4, gy - h - 60 * S * scale, w * .2, 60 * S * scale);
      }
      x += b.w + 6;
    }
  }
}

function drawBuildings() {
  const { W, S, viewW, viewH } = view;
  const vpx = view.cam.x + viewW / 2, vpy = view.cam.y + viewH * PERSPECTIVE.eyeY, f = PERSPECTIVE.depth;
  const back = (x, y) => [X(vpx + (x - vpx) * f), Y(vpy + (y - vpy) * f)];
  const vis = world.B.filter(b => X(b.x + b.w) > -120 && X(b.x) < W + 120)
    .sort((a, b) => Math.abs(b.x + b.w / 2 - vpx) - Math.abs(a.x + a.w / 2 - vpx));
  for (const b of vis) {
    const L = b.x, Rt = b.x + b.w, T = b.top, Bt = GROUND + 60;
    // side face toward vanishing point
    ctx.fillStyle = shade(b.col, .55);
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
      ctx.fillStyle = shade(b.col, .78);
      ctx.beginPath();
      ctx.moveTo(X(L), Y(T)); ctx.lineTo(a1, a2); ctx.lineTo(b1, b2); ctx.lineTo(X(Rt), Y(T));
      ctx.fill();
    }
    // front
    ctx.fillStyle = b.col;
    ctx.fillRect(X(L), Y(T), b.w * S, (Bt - T) * S);
    ctx.fillStyle = shade(b.col, .85);
    ctx.fillRect(X(L), Y(T), b.w * S, 5 * S);
    for (let y = T + CITY.floorH; y < GROUND; y += CITY.floorH) {
      ctx.fillStyle = 'rgba(0,0,0,.06)';
      ctx.fillRect(X(L), Y(y), b.w * S, 1.5 * S);
    }
    // windows
    const gx = (b.w - b.cols * CITY.cellW) / 2 + 8;
    for (let r = 0; r < b.rows; r++) for (let c = 0; c < b.cols; c++) {
      const lit = b.lit[r * b.cols + c];
      const wx = L + gx + c * CITY.cellW, wy = GROUND - (r + 1) * CITY.floorH + 10;
      if (wy < T + 8) continue;
      ctx.fillStyle = lit === 2 ? '#ffd27a' : lit === 1 ? '#f2a65a' : '#4a3a52';
      ctx.fillRect(X(wx), Y(wy), 14 * S, 20 * S);
      ctx.fillStyle = shade(b.col, .6);
      ctx.fillRect(X(wx - 2), Y(wy + 20), 18 * S, 2.5 * S);
    }
    if (b.isRest) {
      ctx.fillStyle = '#2b1b14';
      ctx.fillRect(X(L + 20), Y(GROUND - 50), b.w * S - 40 * S, 50 * S);
      ctx.save();
      ctx.font = `${Math.round(22 * S)}px Lalezar, Tajawal, sans-serif`;
      ctx.textAlign = 'center';
      ctx.direction = 'rtl';
      ctx.shadowColor = '#ff5a3c';
      ctx.shadowBlur = 14 * S;
      ctx.fillStyle = '#ffd9c9';
      ctx.fillText('بيتزا أبو سمير', X(L + b.w / 2), Y(T + 40));
      ctx.restore();
      const p = restPad();
      ctx.strokeStyle = 'rgba(79,194,124,.9)';
      ctx.lineWidth = 3 * S;
      ctx.setLineDash([8 * S, 6 * S]);
      ctx.strokeRect(X(p.x - 50), Y(p.y - 4), 100 * S, 4 * S);
      ctx.setLineDash([]);
      ctx.fillStyle = '#4fc27c';
      ctx.font = `700 ${Math.round(11 * S)}px Tajawal,sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('شحن + استلام', X(p.x), Y(p.y - 10));
    }
    if (b.tank) {
      const t = b.tank;
      ctx.fillStyle = '#7d8a96';
      ctx.fillRect(X(t.x + 4), Y(t.y + 16), 3 * S, 10 * S);
      ctx.fillRect(X(t.x + t.w - 7), Y(t.y + 16), 3 * S, 10 * S);
      ctx.fillStyle = '#e9e4dc';
      ctx.beginPath();
      ctx.ellipse(X(t.x + t.w / 2), Y(t.y + 9), t.w / 2 * S, 9 * S, 0, 0, 7);
      ctx.fill();
      ctx.fillStyle = '#c8c1b5';
      ctx.fillRect(X(t.x), Y(t.y + 8), t.w * S, 3 * S);
    }
    if (b.dish) {
      ctx.strokeStyle = '#ddd';
      ctx.lineWidth = 2 * S;
      ctx.beginPath();
      ctx.moveTo(X(b.dish.x), Y(b.dish.y));
      ctx.lineTo(X(b.dish.x), Y(b.dish.y - 12));
      ctx.stroke();
      ctx.fillStyle = '#eee';
      ctx.beginPath();
      ctx.ellipse(X(b.dish.x - 3), Y(b.dish.y - 16), 8 * S, 4 * S, -.6, 0, 7);
      ctx.fill();
    }
    for (const bl of b.bal) {
      ctx.fillStyle = shade(b.col, .7);
      ctx.fillRect(X(bl.x), Y(bl.y), bl.w * S, 8 * S);
      ctx.strokeStyle = 'rgba(40,30,30,.75)';
      ctx.lineWidth = 1.5 * S;
      ctx.beginPath();
      for (let k = 0; k <= bl.w; k += 6) { ctx.moveTo(X(bl.x + k), Y(bl.y)); ctx.lineTo(X(bl.x + k), Y(bl.y - 14)); }
      ctx.moveTo(X(bl.x), Y(bl.y - 14));
      ctx.lineTo(X(bl.x + bl.w), Y(bl.y - 14));
      ctx.stroke();
    }
  }
}

function drawLines(st) {
  const { S } = view;
  for (const L of world.lines) {
    ctx.strokeStyle = 'rgba(30,22,30,.8)';
    ctx.lineWidth = 1.3 * S;
    ctx.beginPath();
    L.pts.forEach((p, i) => i ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y)));
    ctx.stroke();
    for (const c of L.clothes) {
      const p = L.pts[c.k];
      const sw = Math.sin(st.t * 2 + c.k) * st.wind * .01;
      ctx.save();
      ctx.translate(X(p.x), Y(p.y));
      ctx.rotate(sw * .6);
      ctx.fillStyle = c.c;
      ctx.fillRect(-c.w / 2 * S, 0, c.w * S, c.h * S);
      ctx.restore();
    }
  }
}

export function drawCity(st) {
  const { W, H } = view;
  drawFar(st, world.far2, .25, '#2c1d40', 40, .9);
  drawFar(st, world.far1, .5, '#3d2849', 10, 1);
  ctx.fillStyle = '#2a1d2c';
  ctx.fillRect(0, Y(GROUND), W, H);
  drawBuildings();
  drawLines(st);
}
