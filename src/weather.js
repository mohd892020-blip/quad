import { CLOUDS, EDGE, GROUND, WEATHER } from './config.js';
import { ctx, view, X, Y } from './ui.js';
import { rng, world } from './world.js';

// Clouds at flying height are clusters of soft puffs. The aircraft pushes the puffs it flies into, they thin as they
// spread, its rotors leave mist behind, and each puff drifts back into place once it is left alone.
export function planClouds(st) {
  const c = CLOUDS, r = rng(c.seed + (st.level.n || 0) * 97), clouds = [];
  for (let x = EDGE.left + r() * c.spacing; x < EDGE.right; x += c.spacing + r() * c.spacingRange) {
    if (r() > (st.level.clouds ?? c.amount)) continue;
    const n = c.puffs[0] + Math.floor(r() * (c.puffs[1] - c.puffs[0])), y = c.heightMin + r() * (c.heightMax - c.heightMin), puffs = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r(), spread = c.spread * (.25 + .75 * r());
      puffs.push({
        ox: Math.cos(a) * spread, oy: Math.sin(a) * spread * c.flat, r: c.puffR[0] + r() * (c.puffR[1] - c.puffR[0]),
        dx: 0, dy: 0, vx: 0, vy: 0, front: r() < c.frontShare,
      });
    }
    clouds.push({ x, y, puffs });
  }
  st.clouds = clouds;
  st.mist = [];
}

export function stepClouds(st, dt) {
  const c = CLOUDS, d = st.d, speed = Math.hypot(d.vx, d.vy);
  let inside = false;
  for (const cl of st.clouds) {
    cl.x += (c.drift + st.wind * c.windDrift) * dt;
    // a cloud far from the aircraft rests, unless it is still drifting back together
    if (Math.abs(cl.x - d.x) > c.awake && !cl.stirred) continue;
    cl.stirred = false;
    for (const p of cl.puffs) {
      const px = cl.x + p.ox + p.dx, py = cl.y + p.oy + p.dy, gx = px - d.x, gy = py - d.y, dist = Math.hypot(gx, gy) || 1, reach = p.r + c.reach;
      if (dist < reach) {
        // pushed out from the aircraft, and down by its rotors
        const k = (1 - dist / reach) * c.push;
        p.vx += (gx / dist * k + d.vx * c.carry) * dt;
        p.vy += (gy / dist * k + c.wash * k + d.vy * c.carry) * dt;
        if (dist < p.r * c.inside) inside = true;
      }
      p.vx += (-p.dx * c.spring - p.vx * c.damp) * dt;
      p.vy += (-p.dy * c.spring - p.vy * c.damp) * dt;
      p.dx += p.vx * dt;
      p.dy += p.vy * dt;
      if (Math.abs(p.dx) + Math.abs(p.dy) > c.settled) cl.stirred = true;
    }
  }
  // mist trails the rotors while the aircraft cuts through
  if (inside && speed > c.mist.minSpeed && !view.lowQ && st.mist.length < c.mist.max && Math.random() < dt * c.mist.rate) {
    st.mist.push({ x: d.x + (Math.random() - .5) * 30, y: d.y + 6, vx: -d.vx * .25 + (Math.random() - .5) * 30, vy: c.mist.sink + Math.random() * 20, t: 0 });
  }
  for (const m of st.mist) {
    m.t += dt;
    m.x += m.vx * dt;
    m.y += m.vy * dt;
  }
  st.mist = st.mist.filter(m => m.t < c.mist.life);
}

// One soft puff with a solid core and a long fade, built once for each tint the sky passes through.
const puffs = new Map();
function puffSprite(color) {
  let s = puffs.get(color);
  if (s) return s;
  s = document.createElement('canvas');
  s.width = s.height = 96;
  const g = s.getContext('2d'), grad = g.createRadialGradient(48, 48, 0, 48, 48, 48), [r, gr, b] = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
  for (const [at, a] of CLOUDS.falloff) grad.addColorStop(at, `rgba(${r},${gr},${b},${a})`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 96, 96);
  puffs.set(color, s);
  return s;
}

// A cloud is painted whole into its own image, shade first and light on top, so overlapping puffs read as one body
// instead of a pile of discs. The image is only repainted when the puffs move, the sky changes tint, or the zoom does.
function cloudImage(cl, front) {
  const c = CLOUDS, k = view.sharp * Math.min(view.DPR, c.density), tint = world.pal.cloud, key = front ? 'front' : 'back';
  const halfW = c.spread + c.puffR[1] + c.margin, halfH = c.spread * c.flat + c.puffR[1] + c.margin;
  let pose = 0;
  for (const p of cl.puffs) if (p.front === front) pose += Math.round((Math.abs(p.dx) + Math.abs(p.dy)) * 4);
  const im = cl[key];
  if (im && im.k === k && im.tint === tint && im.pose === pose) return im;
  const canvas = im?.canvas ?? document.createElement('canvas'), w = Math.ceil(halfW * 2 * k), h = Math.ceil(halfH * 2 * k);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const g = canvas.getContext('2d'), light = puffSprite(tint), shade = puffSprite(world.pal.cloudShade);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, w, h);
  g.setTransform(k, 0, 0, k, halfW * k, halfH * k);
  for (const [sprite, lift] of [[shade, c.shadeDrop], [light, -c.lightLift]]) {
    for (const p of cl.puffs) {
      if (p.front !== front) continue;
      const moved = Math.hypot(p.dx, p.dy), size = p.r * 2 + moved * c.swell;
      g.globalAlpha = Math.max(c.thinMin, 1 - moved / (p.r * c.thin));
      g.drawImage(sprite, p.ox + p.dx - size / 2, p.oy + p.dy + p.r * lift - size / 2, size, size);
    }
  }
  g.globalAlpha = 1;
  return (cl[key] = { canvas, k, tint, pose, halfW, halfH });
}

function drawPuffs(st, front) {
  const c = CLOUDS, { W, S } = view, alpha = c.alpha * world.pal.cloudAlpha;
  if (front && view.lowQ) return;
  for (const cl of st.clouds) {
    const sx = X(cl.x), reach = (c.spread + c.puffR[1] + c.margin) * S;
    if (sx < -reach || sx > W + reach) continue;
    const im = cloudImage(cl, front);
    ctx.globalAlpha = alpha * (front ? c.frontAlpha : 1);
    ctx.drawImage(im.canvas, sx - im.halfW * S, Y(cl.y) - im.halfH * S, im.halfW * 2 * S, im.halfH * 2 * S);
  }
  if (front) {
    const sprite = puffSprite(world.pal.cloud);
    for (const m of st.mist) {
      const size = (c.mist.size + m.t * c.mist.grow) * S;
      ctx.globalAlpha = alpha * c.mist.alpha * (1 - m.t / c.mist.life);
      ctx.drawImage(sprite, X(m.x) - size / 2, Y(m.y) - size / 2, size, size);
    }
  }
  ctx.globalAlpha = 1;
}

export const drawCloudsBack = st => drawPuffs(st, false);
export const drawCloudsFront = st => drawPuffs(st, true);

// Long, flat clouds far off in the sky, each painted once per tint, drifting much slower than the city.
const high = new Map();
function highImage(i, tint, shadeTint) {
  const key = i + tint;
  let im = high.get(key);
  if (im) return im;
  // the body fills the middle of the image, so no puff is ever cut by its edge
  const c = CLOUDS.high, r = rng(c.seed + i), canvas = document.createElement('canvas'), body = c.width, bodyH = c.width * c.flat;
  const w = body * (1 + c.pad * 2), h = bodyH * (1 + c.pad * 4), left = body * c.pad, top = bodyH * c.pad * 2;
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d'), light = puffSprite(tint), shade = puffSprite(shadeTint), parts = [];
  for (let k = 0; k < c.parts; k++) {
    const pw = body * (.3 + r() * .25), ph = bodyH * (.55 + r() * .4);
    parts.push([left + body * (.12 + .76 * k / (c.parts - 1)) - pw / 2, top + bodyH * (.62 - r() * .3) - ph / 2, pw, ph]);
  }
  for (const [x, y, pw, ph] of parts) g.drawImage(shade, x, y + ph * .12, pw, ph);
  for (const [x, y, pw, ph] of parts) g.drawImage(light, x, y - ph * .06, pw, ph);
  im = { canvas, w, h };
  high.set(key, im);
  if (high.size > 60) high.delete(high.keys().next().value);
  return im;
}

export function drawHighClouds(st) {
  const c = CLOUDS.high, { W, H, S } = view, span = W + c.width * S * 2;
  ctx.globalAlpha = c.alpha * world.pal.cloudAlpha;
  for (let i = 0; i < c.count; i++) {
    const im = highImage(i, world.pal.cloud, world.pal.cloudShade), scale = S * (.7 + (i % 3) * .2);
    const x = ((i * span / c.count - st.cam.x * c.drift - st.t * c.speed) % span + span) % span - c.width * S;
    const y = H * (c.top + (c.bottom - c.top) * ((i * .37) % 1));
    ctx.drawImage(im.canvas, x, y, im.w * scale, im.h * scale);
  }
  ctx.globalAlpha = 1;
}

/* ---------- the mission's weather ---------- */
// A mission keeps its weather: snow on the snowfield and on chosen missions, rain, fog, or low cloud, which planClouds
// packs through level.clouds. Snow and rain fall in screen space in three layers, each sliding against the camera at
// its own depth, so the near ones rush past the lens and the far ones barely drift. Fog closes in to a clearing around
// the aircraft, lies thickest on the ground, and drifts through in banks.
export function weatherFor(n, l) {
  return WEATHER.kinds.find(k => WEATHER[k].missions.includes(n)) ?? (l.snow ? 'snow' : null);
}

const fract = v => v - Math.floor(v), hash = i => fract(Math.sin(i * 127.1 + 311.7) * 43758.5453), wrap = (v, span) => ((v % span) + span) % span;

// The sky goes grey before anything falls: a veil of grey, darker as the light goes. A plain fill, since blend modes
// over the whole screen cost a slow phone a frame.
export function drawOvercast(st) {
  const a = WEATHER[st.level.weather]?.overcast;
  if (!a) return;
  const k = Math.min(1, world.pal.light), [r, g, b] = WEATHER.dim.split(',').map(v => Math.round(v * k));
  ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
  ctx.fillRect(0, 0, view.W, view.H);
}

// near draws the layer that passes in front of the aircraft; otherwise the two behind it.
function drawFall(st, near) {
  const kind = st.level.weather;
  if (kind !== 'snow' && kind !== 'rain') return;
  const c = WEATHER[kind], { W, H, S, cam } = view, pad = c.pad * S, spanW = W + pad * 2, spanH = H + pad * 2, t = st.t, snow = kind === 'snow';
  const n = Math.round(c.count * (view.lowQ ? c.lowShare : 1)), lean = st.wind * c.lean;
  for (const L of near ? [2] : [0, 1]) {
    const depth = c.depth[L], size = c.size[L] * S * depth;
    ctx.beginPath();
    for (let i = L; i < n; i += 3) {
      const fall = c.fall * (1 - c.spread / 2 + hash(i) * c.spread) * depth;
      let x = wrap(hash(i + .5) * spanW + t * st.wind * c.windShare * depth * S - cam.x * S * depth, spanW) - pad;
      const y = wrap(hash(i + .25) * spanH + t * fall * S - cam.y * S * depth, spanH) - pad;
      if (snow) {
        x += Math.sin(t * c.swayRate + i) * c.sway * depth * S;
        ctx.moveTo(x + size, y);
        ctx.arc(x, y, size, 0, 7);
      } else {
        ctx.moveTo(x, y);
        ctx.lineTo(x + lean * c.long * depth * S, y + c.long * depth * S);
      }
    }
    if (snow) {
      ctx.fillStyle = `rgba(${c.color},${c.alpha[L]})`;
      ctx.fill();
    } else {
      ctx.strokeStyle = `rgba(${c.color},${c.alpha[L]})`;
      ctx.lineWidth = size;
      ctx.stroke();
    }
  }
  if (!near || snow) return;
  // rain lands: small rings open on the ground, fixed to it as the camera passes
  const gy = Y(GROUND);
  if (gy > H + 4 || gy < 0) return;
  ctx.strokeStyle = `rgba(${c.color},${c.splashAlpha})`;
  ctx.lineWidth = S;
  for (let k = 0; k < c.splashes; k++) {
    const ph = fract(t * c.splashRate * (.7 + hash(k + 7) * .6) + hash(k + 9)), x = wrap(hash(k + 3) * W * 4 - cam.x * S, W);
    ctx.globalAlpha = 1 - ph;
    ctx.beginPath();
    ctx.ellipse(x, gy, (1.5 + ph * c.splashSize) * S, (.6 + ph * c.splashSize * .3) * S, 0, 0, 7);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export const drawFallBehind = st => drawFall(st, false);
export const drawFallFront = st => drawFall(st, true);

const hexOf = tone => `#${tone.split(',').map(v => (+v).toString(16).padStart(2, '0')).join('')}`;

// The fog's clearing and its low band are gradients painted once for each tint into small images, then stretched into
// place: a gradient filled across the whole screen every frame costs a slow phone its frame rate.
const fogParts = { tone: null, hole: null, band: null };
function fogImages(tone) {
  if (fogParts.tone === tone) return fogParts;
  const f = WEATHER.fog, n = f.sprite, hole = fogParts.hole ?? document.createElement('canvas'), band = fogParts.band ?? document.createElement('canvas');
  hole.width = hole.height = n;
  let g = hole.getContext('2d');
  const veil = g.createRadialGradient(n / 2, n / 2, n / 2 * f.core, n / 2, n / 2, n / 2);
  veil.addColorStop(0, `rgba(${tone},${f.near})`);
  veil.addColorStop(1, `rgba(${tone},${f.thick})`);
  g.clearRect(0, 0, n, n);
  g.fillStyle = veil;
  g.fillRect(0, 0, n, n);
  band.width = 1;
  band.height = n;
  g = band.getContext('2d');
  const low = g.createLinearGradient(0, 0, 0, n);
  low.addColorStop(0, `rgba(${tone},0)`);
  low.addColorStop(1, `rgba(${tone},${f.low})`);
  g.clearRect(0, 0, 1, n);
  g.fillStyle = low;
  g.fillRect(0, 0, 1, n);
  return Object.assign(fogParts, { tone, hole, band });
}

// Over the world and under everything the player steers by: the aircraft, its order, the pads and the markers.
export function drawFog(st) {
  if (st.level.weather !== 'fog') return;
  const f = WEATHER.fog, { W, H, S, cam } = view, tone = world.pal.mistTone, x = X(st.d.x), y = Y(st.d.y), r = f.clear * S, { hole, band } = fogImages(tone);
  // thick everywhere but the square around the aircraft, where the clearing fades in. The square sits on whole pixels
  // and the image is read from inside its border, so no seam shows where the two meet.
  ctx.fillStyle = `rgba(${tone},${f.thick})`;
  const L = Math.round(x - r), T = Math.round(y - r), side = Math.round(r * 2), R = L + side, B = T + side;
  ctx.fillRect(-20, -20, W + 40, Math.max(0, T + 20));
  ctx.fillRect(-20, B, W + 40, Math.max(0, H + 20 - B));
  ctx.fillRect(-20, T, Math.max(0, L + 20), side);
  ctx.fillRect(R, T, Math.max(0, W + 20 - R), side);
  ctx.drawImage(hole, 1, 1, f.sprite - 2, f.sprite - 2, L, T, side, side);
  const gy = Y(GROUND), top = Y(GROUND - f.lowH);
  if (top < H) {
    ctx.drawImage(band, -20, top, W + 40, gy - top);
    ctx.fillStyle = `rgba(${tone},${f.low})`;
    ctx.fillRect(-20, gy, W + 40, Math.max(0, H - gy + 20));
  }
  const sprite = puffSprite(hexOf(tone)), bw = f.bankW * S, bh = bw * f.bankFlat;
  ctx.globalAlpha = f.bankAlpha;
  for (let i = 0; i < f.banks; i++) {
    const bx = wrap(hash(i) * (W + bw) * 3 + st.t * f.drift * (1 + hash(i + 2)) * S - cam.x * S * f.bankDepth, W + bw) - bw;
    ctx.drawImage(sprite, bx, Y(GROUND - f.bankLow - hash(i + 5) * f.bankHigh) - bh / 2, bw, bh);
  }
  ctx.globalAlpha = 1;
}
