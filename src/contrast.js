import { AIRCRAFT, BEACH, CONTRAST, DESERT, DRONE, GROUND } from './config.js';
import { seaAt } from './seaside.js';
import { settings } from './storage.js';
import { ctx, view, X, Y } from './ui.js';
import { world } from './world.js';

// A few times a second this reads what stands behind the aircraft from the scene itself and picks the ink of its
// faint rim. A paint close to that backdrop shifts a little and the rim comes up, so it never melts into the scene.
const rgb = hex => [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map(v => parseInt(v, 16));
const lin = v => {
  const c = v / 255;
  return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
};

// Oklab: distances here match how far apart two colours look. [0] is lightness, 0 to 1.
function look([r, g, b]) {
  const R = lin(r), G = lin(g), B = lin(b), root = Math.cbrt;
  const l = root(.4122 * R + .5363 * G + .0514 * B), m = root(.2119 * R + .6807 * G + .1074 * B), s = root(.0883 * R + .2817 * G + .63 * B);
  return [.2105 * l + .7936 * m - .0041 * s, 1.9779 * l - 2.4286 * m + .4506 * s, .0259 * l + .7828 * m - .8087 * s];
}

function skyAt(y) {
  const stops = world.pal.sky, at = Math.max(0, Math.min(1, Y(y) / view.H));
  const i = Math.max(0, stops.findIndex(s => s[0] >= at) - 1), [a, from] = stops[i], [b, to] = stops[i + 1], f = (at - a) / (b - a), p = rgb(from), q = rgb(to);
  return p.map((v, k) => v + (q[k] - v) * f);
}

// What the player sees behind a point: a wall where one stands, then the ground, the far scenery, or the sky.
export function behind(x, y) {
  const c = CONTRAST, time = world.pal, wall = world.B.find(b => x >= b.x && x <= b.x + b.w && y >= b.top);
  if (wall) return rgb(wall.col).map(v => v * time.light);
  if (y >= GROUND - c.groundGap) return rgb(x >= DESERT.from ? time.dune : x < BEACH.from ? time.ground : seaAt(x) ? time.sea : time.sand);
  if (x >= DESERT.from) {
    if (y >= GROUND - DESERT.nearH) return rgb(time.duneNear);
    if (y >= GROUND - DESERT.farH) return rgb(time.duneFar);
  } else if (x >= BEACH.from) {
    if (y >= GROUND - BEACH.horizon) return rgb(time.sea);
  } else if (y >= GROUND - c.skyline) return rgb(time.far1);
  return skyAt(y);
}

// How close a paint is to a backdrop, as the share of the full shift it should get.
export function shiftFor(paint, back) {
  const c = CONTRAST, a = look(rgb(paint)), b = look(back), gap = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  return { gap, share: Math.max(0, Math.min(1, (c.near - gap) / (c.near - c.far))), ink: b[0] > c.midLight ? c.dark : c.light };
}

// edge runs from dark ink at 0 to light ink at 1, so the rim fades across instead of flipping.
export const standout = () => ({ k: 0, aim: 0, ink: CONTRAST.dark, want: CONTRAST.dark, wait: 0, edge: 0 });

export function stepContrast(st, dt) {
  const c = CONTRAST, p = st.standout, m = AIRCRAFT.find(a => a.key === settings.plane) || AIRCRAFT[0];
  p.wait -= dt;
  if (p.wait <= 0) {
    const s = shiftFor(m.paint, behind(st.d.x, st.d.y));
    p.wait = c.every;
    p.aim = s.share;
    p.want = s.ink;
  }
  // a new ink waits for the old shift to fade, so the colour never jumps
  p.k += ((p.want === p.ink ? p.aim : 0) - p.k) * Math.min(1, dt * c.rate);
  if (p.k < c.rest) p.ink = p.want;
  p.edge += ((p.want === c.light ? 1 : 0) - p.edge) * Math.min(1, dt * c.rate);
}

const sheet = document.createElement('canvas'), mask = document.createElement('canvas');
const RIM = [[1, 0], [-1, 0], [0, 1], [0, -1], [.7, .7], [-.7, .7], [.7, -.7], [-.7, -.7]];
const RIMS_KEPT = 48;
const rims = new Map();

function fit(c, side) {
  if (c.width !== side) c.width = c.height = side;
  const g = c.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  g.clearRect(0, 0, side, side);
  return g;
}

// A rim is cut from the aircraft once for each ink and kept, so a frame only stamps one image.
function rimOf(look, ink, side, lay) {
  const key = `${look}|${ink}|${side}`;
  let s = rims.get(key);
  if (s) return s;
  if (rims.size >= RIMS_KEPT) rims.clear();
  const g = fit(mask, side), r = CONTRAST.rimPx * view.DPR;
  lay(g);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = ink;
  g.fillRect(0, 0, side, side);
  s = document.createElement('canvas');
  s.width = s.height = side;
  const out = s.getContext('2d');
  for (const [x, y] of RIM) out.drawImage(mask, x * r, y * r);
  rims.set(key, s);
  return s;
}

// flat(g) draws the aircraft's outline around (0,0) in world units, the same every time for one look; live(g) draws it now.
export function drawStandout(st, a, look, flat, live) {
  const c = CONTRAST, p = st.standout, sx = X(st.d.x), sy = Y(st.d.y), S = view.S * c.scale, D = view.DPR;
  // the feet stay where the body touches down, however large the aircraft is drawn
  const foot = (1 - 1 / c.scale) * DRONE.radius, side = Math.ceil(c.box * S * D), mid = side / 2, size = side / D, k = S * D;
  const lay = (g, tilt, paint) => {
    g.setTransform(k, 0, 0, k, mid, mid);
    g.rotate(tilt);
    g.translate(0, -foot);
    paint(g);
    g.setTransform(1, 0, 0, 1, 0, 0);
  };
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(a);
  const strength = c.rimIdle + (c.rimNear - c.rimIdle) * p.k;
  for (const [ink, share] of [[c.dark, 1 - p.edge], [c.light, p.edge]]) {
    if (share < c.rest) continue;
    ctx.globalAlpha = share * strength;
    ctx.drawImage(rimOf(look, ink, side, g => lay(g, 0, flat)), -size / 2, -size / 2, size, size);
  }
  ctx.globalAlpha = 1;
  if (p.k < c.rest) {
    ctx.scale(S, S);
    ctx.translate(0, -foot);
    live(ctx);
    ctx.restore();
    return;
  }
  ctx.restore();
  const g = fit(sheet, side);
  lay(g, a, live);
  g.globalCompositeOperation = 'source-atop';
  g.globalAlpha = (p.ink === c.light ? c.tintLight : c.tintDark) * p.k;
  g.fillStyle = p.ink;
  g.fillRect(0, 0, side, side);
  ctx.drawImage(sheet, sx - size / 2, sy - size / 2, size, size);
}
