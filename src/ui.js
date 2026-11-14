import { buzz, canBuzz, sfx, toggleMute } from './audio.js';
import { boostStrip, leaveTease, markDropKeys, resultBoost, showBoostBtn } from './boosts.js';
import { musicCue } from './music.js';
import { nudgeShop } from './shop.js';
import { paper, showToday } from './daily.js';
import { showRushCard } from './rush.js';
import { AIRCRAFT, ALTIMETER, BADGE, BOOST, BOOSTS, CALL, CARGO, CHAPTERS, COMBO, DAILY, DEV, DUST, FROST, FX, G, GATES, GIFTS, GROUND as G_LINE, HANGAR, HEALTH, JOY, KEY_HINT, LEVELS, LOCKS, MISSION, PERFECT, PICTURE, POINTER, QUALITY, RESCUE, RESULT, RUSH, SHAKE, SHOTS, SKIP, VIEW, WEATHER, WEATHER_HINT, WIND } from './config.js';
import { applyControls, touchUI } from './input.js';
import { ringingFor } from './call.js';
import { canCarry } from './rope.js';
import { callerAt, homeName } from './homes.js';
import { loadProgress, saveSettings, saveSkips, settings, skips } from './storage.js';

const $ = id => document.getElementById(id);

const cv = $('c');
// opaque: the sky covers every pixel, and the browser can skip blending the page behind it
export const ctx = cv.getContext('2d', { alpha: false });

// Phones from before 2022 draw without this.
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r = 0) {
    const c = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    this.moveTo(x + c, y);
    this.arcTo(x + w, y, x + w, y + h, c);
    this.arcTo(x + w, y + h, x, y + h, c);
    this.arcTo(x, y + h, x, y, c);
    this.arcTo(x, y, x + w, y, c);
    this.closePath();
  };
}

/* ---------- view ---------- */
// Where the picture starts: sharp at the top tier, saver at its own, auto where this phone last settled.
function firstTier() {
  if (settings.picture === 'saver') return PICTURE.saverTier;
  if (settings.picture !== 'auto') return 0;
  return Number.isInteger(settings.tier) ? Math.min(QUALITY.tiers.length - 1, Math.max(0, settings.tier)) : QUALITY.start;
}

export const view = {
  W: 0, H: 0, DPR: 1, S: 1, viewW: 0, viewH: 0, cam: null, lowQ: false, top: 140, bottom: 600, floorPx: 0, base: 1, sharp: 1, mapW: 300, mapH: 18,
  tier: firstTier(), dirty: true,
};

function resize() {
  // a hidden frame reports zero size; keep the last real one or the camera turns to NaN
  if (!innerWidth || !innerHeight) return;
  const tier = QUALITY.tiers[view.tier];
  view.DPR = Math.min(tier.dpr, window.devicePixelRatio || 1);
  // a phone found slow keeps its sharpness and drops the extra detail instead
  view.lowQ = !!tier.low || !!settings.lite;
  view.W = innerWidth;
  view.H = innerHeight;
  cv.width = Math.round(view.W * view.DPR);
  cv.height = Math.round(view.H * view.DPR);
  view.base = Math.min(view.H / VIEW.refH, view.W / VIEW.refW);
  setZoom(1);
  // the combo badge's numbers for the page: where a notice steps down below it, by how much, and how long it moves
  const wrap = $('wrap');
  wrap.classList.toggle('narrow', view.W < COMBO.wideFrom);
  wrap.style.setProperty('--comboStep', `${COMBO.step}px`);
  wrap.style.setProperty('--comboAnim', `${COMBO.anim}s`);
  view.dirty = true;
  applyControls();
  measureHud();
}

// The camera's zoom scales the whole picture. Cached images are painted for the closest shot, so a glide between
// shots only scales them and never repaints them.
export function setZoom(z) {
  view.S = view.base * z;
  view.sharp = view.base * SHOTS.sharpZoom;
  view.viewW = view.W / view.S;
  view.viewH = view.H / view.S;
}

// The altimeter on the right: a coloured scale from the street up, the aircraft's height on it with a pointer, the
// goal's height as a tick, and chevrons that show the climb or the drop.
export function drawAltimeter(st, goal) {
  const c = ALTIMETER, x = view.W - c.right - c.w, room = view.bottom - c.bottom - (view.top + c.top);
  const span = Math.min(room, Math.max(c.minH, room * c.share));
  if (span < c.minH || st.level.training) return;
  const mid = Math.max(view.top + c.top + span / 2, Math.min(view.bottom - c.bottom - span / 2, view.H / 2)), top = mid - span / 2, bottom = mid + span / 2;
  const at = h => bottom - Math.max(0, Math.min(1, h / c.max)) * span, scale = ctx.createLinearGradient(0, bottom, 0, top);
  for (const [k, col] of c.colors) scale.addColorStop(k, col);
  // the tube: a pale tint with a bright rim and a soft drop shadow
  ctx.save();
  ctx.shadowColor = 'rgba(10,8,30,.35)';
  ctx.shadowBlur = 10;
  ctx.fillStyle = c.glass;
  ctx.beginPath();
  ctx.roundRect(x - 4, top - 4, c.w + 8, span + 8, c.w / 2 + 4);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = c.rim;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.globalAlpha = c.alpha;
  ctx.fillStyle = scale;
  ctx.beginPath();
  ctx.roundRect(x, top, c.w, span, c.w / 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  // light caught down the tube's left side
  const shine = ctx.createLinearGradient(x - 4, 0, x + c.w + 4, 0);
  shine.addColorStop(0, `rgba(255,255,255,${c.gloss})`);
  shine.addColorStop(.45, 'rgba(255,255,255,0)');
  ctx.fillStyle = shine;
  ctx.beginPath();
  ctx.roundRect(x - 3, top - 3, c.w + 6, span + 6, c.w / 2 + 3);
  ctx.fill();
  if (goal) {
    const gy = at(G_LINE - goal.y);
    ctx.save();
    ctx.shadowColor = c.goal;
    ctx.shadowBlur = 8;
    ctx.fillStyle = c.goal;
    ctx.beginPath();
    ctx.roundRect(x - 6, gy - 2, c.w + 12, 4, 2);
    ctx.fill();
    ctx.restore();
  }
  const h = G_LINE - st.d.y, y = at(h), climb = -st.d.vy, rate = Math.min(1, Math.abs(climb) / c.fastClimb);
  if (rate > c.still) {
    const dir = climb > 0 ? -1 : 1;
    ctx.strokeStyle = climb > 0 ? c.up : c.down;
    ctx.globalAlpha = .35 + .65 * rate;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let i = 0; i < 2; i++) {
      const cy = y + dir * (12 + i * 7);
      ctx.moveTo(x - 2, cy - dir * 4);
      ctx.lineTo(x + c.w / 2, cy);
      ctx.lineTo(x + c.w + 2, cy - dir * 4);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // the height in a glass tag pointing at the tube
  const label = `${Math.max(0, Math.round(h / 10))} m`;
  ctx.font = '700 11px Tajawal,sans-serif';
  const tw = ctx.measureText(label).width + 14, tx = x - 8 - tw;
  ctx.fillStyle = c.tag;
  ctx.beginPath();
  ctx.roundRect(tx, y - 9, tw, 18, 9);
  ctx.moveTo(x - 9, y - 4);
  ctx.lineTo(x - 3, y);
  ctx.lineTo(x - 9, y + 4);
  ctx.fill();
  ctx.strokeStyle = c.rim;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(tx, y - 9, tw, 18, 9);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(label, tx + tw / 2, y + 4);
  ctx.textAlign = 'left';
}

// Phones play best on their side. A phone held upright is offered the turn, on the mission card, the pause card and as
// an icon in the flight's own top bar: the app turns itself, a browser goes full screen and locks sideways where it can,
// and otherwise a short note asks the player to turn the phone.
const turner = () => window.PizzaScreen;
async function playSideways(on) {
  settings.sideways = on;
  saveSettings();
  if (turner()) turner().sideways(on);
  else if (on) {
    try {
      await document.documentElement.requestFullscreen?.();
      await screen.orientation.lock('landscape');
    } catch (_) {
      showToast('Turn your phone sideways', 'The wide screen shows more of the way ahead', true);
    }
  } else {
    try { screen.orientation.unlock?.(); } catch (_) {}
  }
  markSideways();
}

export function markSideways() {
  const upright = innerHeight > innerWidth, locked = !!settings.sideways && !upright;
  for (const id of ['levelSideways', 'pauseSideways', 'hudSideways']) {
    const b = $(id), say = locked ? 'Play upright' : 'Play sideways';
    b.hidden = !touchUI() || (!upright && !locked);
    const words = b.querySelector('span');
    if (words) words.textContent = say;
    else b.setAttribute('aria-label', say);
  }
}

function buildSideways() {
  for (const id of ['levelSideways', 'pauseSideways', 'hudSideways']) $(id).addEventListener('click', () => playSideways(!(settings.sideways && innerWidth > innerHeight)));
  addEventListener('resize', markSideways);
  // the app remembers the turn between launches
  if (settings.sideways && turner()) turner().sideways(true);
  markSideways();
}

// Asking for layout is costly, so this runs when the HUD changes size, never on the HUD tick.
export function measureHud() {
  view.top = $('hud').getBoundingClientRect().bottom || view.top;
  const boost = $('boost').getBoundingClientRect().top, tops = [boost, $('up').getBoundingClientRect().top].filter(Boolean);
  view.bottom = tops.length ? Math.min(...tops) - 8 : view.H - POINTER.bottomGap;
  // on a short screen the rocker stands in the corner, so the street stops above the lower controls
  view.floorPx = touchUI() ? view.H - (view.W > view.H && boost ? boost - 8 : view.bottom) : 0;
  view.mapW = $('map').clientWidth || view.mapW;
  view.mapH = $('map').clientHeight || view.mapH;
  $('toast').style.top = view.top + 12 + 'px';
  $('lesson').style.top = view.top + 8 + 'px';
  $('call').style.top = view.top + CALL.below + 'px';
}
addEventListener('resize', resize);
export { resize };
addEventListener('orientationchange', () => setTimeout(resize, VIEW.turnDelay));
resize();
if (globalThis.ResizeObserver) {
  const watch = new ResizeObserver(measureHud);
  for (const id of ['hud', 'controls', 'map']) watch.observe($(id));
}

// One real step along the tiers, by 1 down or -1 up: on a low-density screen some look the same, so those are passed over.
function moveTier(by) {
  const c = QUALITY.tiers, look = i => `${Math.min(c[i].dpr, window.devicePixelRatio || 1)}${!!c[i].low}`, from = look(view.tier);
  let at = view.tier;
  while (c[at + by] && look(at) === from) at += by;
  if (look(at) === from || settings.picture === 'saver' || (settings.picture === 'sharp' && c[at].dpr < PICTURE.sharpFloor)) return false;
  view.tier = at;
  if (touchUI() && settings.picture === 'auto') {
    settings.tier = at;
    saveSettings();
  }
  resize();
  return true;
}
export function lowerQuality(steps) {
  while (steps-- && moveTier(1));
}
export const raiseQuality = () => moveTier(-1);

// Points along a far ridge sit at fixed places on the ridge, not on the screen, so its peaks keep their shape as the
// camera moves instead of shimmering. Each is [screen x, place along the ridge], from left to past right.
export function ridgePoints(par, stepU, left, right) {
  const { S, cam } = view, start = cam.x * par, pts = [];
  for (let u = Math.floor((start + left / S) / stepU) * stepU; ; u += stepU) {
    const sx = (u - start) * S;
    pts.push([sx, u]);
    if (sx >= right) return pts;
  }
}

export const X = x => (x - view.cam.x) * view.S;
export const Y = y => (y - view.cam.y) * view.S;

export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = n >> 8 & 255, b = n & 255;
  r = Math.round(r * f); g = Math.round(g * f); b = Math.round(b * f);
  return `rgb(${r},${g},${b})`;
}

// Soft light from a prebuilt sprite, far cheaper per frame than canvas shadowBlur.
const glows = new Map();
export function glow(g, color, x, y, r) {
  let s = glows.get(color);
  if (!s) {
    s = document.createElement('canvas');
    s.width = s.height = 64;
    const sg = s.getContext('2d'), grad = sg.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    sg.fillStyle = grad;
    sg.fillRect(0, 0, 64, 64);
    glows.set(color, s);
  }
  const op = g.globalCompositeOperation;
  g.globalCompositeOperation = 'lighter';
  g.drawImage(s, x - r, y - r, r * 2, r * 2);
  g.globalCompositeOperation = op;
}

// Smooth screen shake; follows the game clock instead of a dice roll per frame.
export function shakeOffset(st) {
  const c = SHAKE, sh = st.shake;
  const amp = sh * sh / (sh + c.soft) * c.amp * view.S;
  const wave = ([a, b]) => (Math.sin(st.t * a) + Math.sin(st.t * b) * c.secondWave) / (1 + c.secondWave);
  return [wave(c.freqX) * amp, wave(c.freqY) * amp];
}

/* ---------- popups and particles ---------- */
// size is before the screen's scale; a pop marked pump starts bigger and settles; one marked follow rides along with
// the aircraft where it was put, for a reward earned at speed that would otherwise be left behind off screen.
export function pop(st, x, y, txt, col, size = FX.popSize, pump = false, follow = false) {
  st.pops.push({ x, y, txt, col, size, pump, t: 0, ...(follow ? { fx: x - st.d.x, fy: y - st.d.y } : {}) });
}

// Cosmetic variation that stays out of the gameplay random stream.
function noise(i) {
  const s = Math.sin(i * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

export function kickDust(st, x, y, speed) {
  const c = DUST, n = Math.min(c.countMax, c.countMin + Math.floor(speed * c.countPerSpeed));
  for (let i = 0; i < n; i++) {
    const k = st.dustN++, side = noise(k) * 2 - 1;
    st.dust.push({
      x: x + side * c.spawnWidth, y,
      vx: side * c.spreadX * (.5 + .5 * noise(k + .5)),
      vy: -c.riseMin - noise(k + .25) * c.riseRange,
      t: 0, life: c.lifeMin + noise(k + .75) * c.lifeRange,
    });
  }
}

// Paper for a perfect drop, from the cosmetic stream, so the wind and the hawks still draw what they would have.
export function confetti(st, x, y, count) {
  const c = FX.confetti;
  for (let i = 0; i < count; i++) {
    const k = st.dustN++;
    st.parts.push({ x, y, vx: (noise(k) - .5) * c.spread, vy: -c.minLift - noise(k + .5) * c.lift, t: 0, crumb: 1, col: c.paint[i % c.paint.length] });
  }
}

// A scar left where the drone struck or blew up; bad ones keep burning for a while.
export function addMark(st, x, y, size, burn, surface) {
  st.marks.push({ x, y, size, burn, surface, seed: st.dustN++ });
  if (st.marks.length > HEALTH.markMax) st.marks.shift();
}

export function puff(st, x, y, fire) {
  const k = st.dustN++, side = noise(k) - .5;
  st.smoke.push({
    x: x + side * 10, y, vx: side * 22, vy: fire ? -60 - noise(k + .5) * 50 : -26 - noise(k + .5) * 22,
    t: 0, life: fire ? .35 + noise(k + .25) * .25 : .9 + noise(k + .25) * .7, fire,
  });
}

export function blast(st, x, y) {
  const c = HEALTH;
  st.blasts.push({ x, y, t: 0 });
  for (let i = 0; i < c.debris; i++) {
    const k = st.dustN++;
    st.parts.push({ x, y, vx: (noise(k) - .5) * 380, vy: -noise(k + .5) * 340, t: 0, crumb: 1 });
  }
  for (let i = 0; i < 10; i++) puff(st, x, y, i % 2 === 0);
}

export function stepFx(st, dt) {
  for (const q of st.smoke) {
    q.t += dt;
    q.x += (q.vx + st.wind * FX.steamDrift) * dt;
    q.y += q.vy * dt;
  }
  st.smoke = st.smoke.filter(q => q.t < q.life);
  for (const b of st.blasts) b.t += dt;
  st.blasts = st.blasts.filter(b => b.t < HEALTH.blastLife);
  for (const m of st.marks) {
    if (m.burn <= 0) continue;
    m.burn -= dt;
    if (noise(st.dustN++) < dt * HEALTH.smokeRate) puff(st, m.x, m.y, noise(st.dustN++) < .4);
  }
  const drag = Math.pow(DUST.drag, dt);
  for (const q of st.dust) {
    q.t += dt;
    q.vx *= drag;
    q.vy *= drag;
    q.x += (q.vx + st.wind * FX.steamDrift) * dt;
    q.y += q.vy * dt;
  }
  st.dust = st.dust.filter(q => q.t < q.life);
  for (const q of st.pops) {
    q.t += dt;
    if (q.fx != null) {
      q.x = st.d.x + q.fx;
      q.y = st.d.y + q.fy;
    }
  }
  st.pops = st.pops.filter(q => q.t < FX.popLife);
  for (const w of st.waves) w.t += dt;
  st.waves = st.waves.filter(w => w.t < PERFECT.wave.life);
  for (const q of st.parts) {
    q.t += dt;
    if (q.crumb) { q.vy += G * (q.col ? FX.confetti.gravity : 1) * dt; q.x += q.vx * dt; }
    else q.x += st.wind * FX.steamDrift * dt;
    q.y += q.vy * dt;
  }
  st.parts = st.parts.filter(q => q.t < (q.col ? FX.confetti.life : q.crumb ? FX.crumbLife : FX.steamLife));
}

export function drawMarks(st) {
  const { W, S } = view;
  for (const m of st.marks) {
    const sx = X(m.x), sy = Y(m.y), r = m.size * S;
    if (sx < -r * 2 || sx > W + r * 2) continue;
    // a scar stays on the thing it hit, never out in the air beside it
    const R = m.surface;
    ctx.save();
    ctx.beginPath();
    ctx.rect(X(R.x), Y(R.y), R.w * S, R.h * S);
    ctx.clip();
    ctx.fillStyle = 'rgba(18,12,14,.5)';
    ctx.beginPath();
    ctx.ellipse(sx, sy, r, r * .8, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(18,12,14,.8)';
    ctx.beginPath();
    ctx.ellipse(sx, sy, r * .5, r * .4, 0, 0, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(18,12,14,.7)';
    ctx.lineWidth = 1.2 * S;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = noise(m.seed + i * .37) * 6.28, len = r * (1 + noise(m.seed + i) * .8);
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(a) * len, sy + Math.sin(a) * len * .8);
    }
    ctx.stroke();
    ctx.restore();
  }
}

export function drawFx(st) {
  const { W, H, S } = view;
  for (const b of st.blasts) {
    const age = b.t / HEALTH.blastLife, r = HEALTH.blastRadius * (.3 + age * .9) * S, sx = X(b.x), sy = Y(b.y);
    ctx.fillStyle = `rgba(255,190,90,${.75 * (1 - age)})`;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, 7);
    ctx.fill();
    ctx.strokeStyle = `rgba(255,243,223,${.8 * (1 - age)})`;
    ctx.lineWidth = 3 * S;
    ctx.beginPath();
    ctx.arc(sx, sy, r * 1.25, 0, 7);
    ctx.stroke();
  }
  for (const q of st.smoke) {
    const age = q.t / q.life;
    ctx.fillStyle = q.fire ? `rgba(255,${120 + (1 - age) * 110 | 0},50,${.9 * (1 - age)})` : `rgba(60,56,62,${.55 * (1 - age)})`;
    ctx.beginPath();
    ctx.arc(X(q.x), Y(q.y), (q.fire ? 6 - age * 3 : 5 + age * 13) * S, 0, 7);
    ctx.fill();
  }
  for (const q of st.dust) {
    const age = q.t / q.life;
    ctx.fillStyle = `rgba(216,187,152,${DUST.alpha * (1 - age)})`;
    ctx.beginPath();
    ctx.arc(X(q.x), Y(q.y), (DUST.sizeStart + age * DUST.sizeGrow) * S, 0, 7);
    ctx.fill();
  }
  for (const q of st.parts) {
    if (q.crumb) {
      const size = (q.col ? FX.confetti.size : 3) * S;
      ctx.globalAlpha = q.col ? Math.min(1, (FX.confetti.life - q.t) * 3) : 1;
      ctx.fillStyle = q.col || (q.t < .6 ? '#ffc23d' : '#e8492c');
      ctx.fillRect(X(q.x), Y(q.y), size, size);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = `rgba(255,255,255,${.35 * (1 - q.t)})`;
      ctx.beginPath();
      ctx.arc(X(q.x), Y(q.y), (3 + q.t * 5) * S, 0, 7);
      ctx.fill();
    }
  }
  if (Math.abs(st.wind) > 30) {
    ctx.strokeStyle = 'rgba(255,243,223,.18)';
    ctx.lineWidth = 1.5;
    const n = Math.min(24, Math.abs(st.wind) / 6);
    for (let i = 0; i < n; i++) {
      const y = (i * 97) % H, x = ((i * 233 + st.t * st.wind * 3) % W + W) % W;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.sign(st.wind) * 40, y);
      ctx.stroke();
    }
  }
  // the gold wave of a perfect drop, spreading as it fades
  for (const w of st.waves) {
    const c = PERFECT.wave, k = w.t / c.life;
    ctx.strokeStyle = `rgba(${c.color},${1 - k})`;
    ctx.lineWidth = c.width * S;
    ctx.beginPath();
    ctx.arc(X(w.x), Y(w.y), (c.from + c.grow * k) * S, 0, 7);
    ctx.stroke();
  }
  ctx.textAlign = 'center';
  for (const q of st.pops) {
    const p = popSpot(q);
    ctx.globalAlpha = Math.min(1, 2 * (FX.popLife - q.t));
    ctx.font = p.font;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(20,15,40,.8)';
    ctx.strokeText(q.txt, p.x, p.y);
    ctx.fillStyle = q.col;
    ctx.fillText(q.txt, p.x, p.y);
  }
  ctx.globalAlpha = 1;
}

// Where a pop's words stand on screen as they rise, for drawing them and for labels that keep out of their way. Words
// that came up in sight stop under the HUD rather than slide beneath it on a short screen.
export function popSpot(q) {
  const grow = q.pump ? 1 + (FX.pump - 1) * Math.max(0, 1 - q.t / FX.pumpTime) : 1, size = Math.round((q.size ?? FX.popSize) * grow * view.S);
  const y = Y(q.y - q.t * FX.popRise);
  q.seen ??= Y(q.y) > view.top;
  return { x: X(q.x), y: q.seen ? Math.max(view.top + size, y) : y, size, font: `${size}px Lalezar,Tajawal,sans-serif` };
}

/* ---------- HUD ---------- */
const PLACES = { street: 'Street', roof: 'Rooftop', ferry: 'Ferry', boat: 'Boat', pier: 'Pier', tower: 'Lifeguard tower', sand: 'Beach', rock: 'Rock top', camp: 'Camp', oasis: 'Oasis', cabin: 'Cabin roof', treehouse: 'Treehouse', lookout: 'Lookout tower', clearing: 'Clearing', crag: 'Crag top', hut: 'Mountain hut', basecamp: 'Base camp', station: 'Lift station', chalet: 'Chalet roof', igloo: 'Igloo', ice: 'Frozen lake' };
// A customer's spot by the household who lives there; PLACES names a spot no household was given.
export const placeName = (t, stop = null) => homeName(t, stop?.place, false, stop) ?? (t.kind === 'bal' ? `Balcony, floor ${t.fl}` : PLACES[t.kind]);
// Where the order on board goes: the caller's home, or the caller at the spot they stepped over to ("Ms. Tara at Grace's").
export function goingTo(st) {
  const s = st.stop, o = st.order, home = s.parcels ? s.parcels[o.drop >= 2 ? 1 : 0].t : s.t;
  return o.t === home ? placeName(o.t, s) : `${callerAt(home, st)?.who ?? 'Customer'} at ${placeName(o.t)}`;
}

// The HUD ticks ten times a second and most of it has not moved, so only changes reach the page.
const shown = {};
function put(key, value, write) {
  if (shown[key] === value) return;
  shown[key] = value;
  write(value);
}
const text = (id, value) => put(id, value, v => { $(id).textContent = v; });
const bar = (id, percent) => put(id, Math.round(percent), v => { $(id).firstChild.style.transform = `scaleX(${v / 100})`; });

// What the weather is doing to the flight, so a hard hold reads as the sky's doing and not the player's.
function weatherNote(st) {
  const c = WEATHER_HINT, l = st.level;
  if (st.outcome || st.done || l.training) return null;
  // a surprise or the first combo says its piece at once, ahead of the weather
  if (st.note && st.t < st.note.until) return [st.note.icon, st.note.text, true];
  if (Math.abs(st.draft || 0) > c.draft) return st.draft < 0 ? ['wind', 'Updraft ↑ lifting you'] : ['wind', 'Downdraft ↓ pulling you down'];
  if (Math.abs(st.wind) > Math.max(c.gustMin, (l.wind || 0) * c.gust)) return ['wind', st.stop?.gale ? `Gale ${st.wind > 0 ? '→' : '←'} push through` : `Strong gusts ${st.wind > 0 ? '→' : '←'} hold steady`];
  if (st.t < c.intro && l.weather === 'fog') return ['mist', 'Fog. Follow the arrow'];
  if (st.t < c.intro && l.cold > 1) return ['cold', 'Cold air. The battery drains faster'];
  return null;
}

const note = { key: null, since: 0, last: -Infinity, shown: null };
export function showWeatherNote(st) {
  const n = weatherNote(st), c = WEATHER_HINT, chip = $('wxChip');
  if (n) {
    if (n[1] !== note.key) Object.assign(note, { key: n[1], icon: n[0], since: st.t });
    note.last = st.t;
    note.timed = !!n[2];
  }
  // weather lingers a moment as it settles, a surprise's note goes the moment it is over; on a narrow screen a toast
  // or the hangar's tip takes the same band, and says the more pressing thing
  const on = !!note.key && st.t - note.since >= (n?.[2] ? 0 : c.show) && st.t - note.last <= (note.timed ? 0 : c.linger) && !st.outcome && (view.W >= COMBO.wideFrom || ($('toast').hidden && $('hangarTip').hidden));
  if (on && note.shown !== note.key) {
    chip.querySelector('use').setAttribute('href', `#i-${note.icon}`);
    chip.classList.toggle('gold', note.icon === 'ring' || note.icon === 'flame');
    chip.querySelector('span').textContent = note.key;
    note.shown = note.key;
  }
  chip.classList.toggle('on', on);
}

export function resetWeatherNote() {
  Object.assign(note, { key: null, since: 0, last: -Infinity, shown: null });
  $('wxChip').classList.remove('on');
}

export function hud(st) {
  const legs = st.level.stops.length, o = st.has ? st.order : null, run = st.stop.parcels;
  // a narrow phone marks the ring count instead of naming it, so the customer still fits
  const rings = o && st.stop.gates, at = (o?.gate ?? 0) + 1, ring = rings && at <= rings.length ? `${view.W < GATES.narrow ? '◎' : 'Ring '}${at}/${rings.length} · ` : '';
  // under hudShort the word before a drop's or a stop's count goes too, so the home's name still fits
  const short = view.W < CALL.hudShort;
  const tag = (o?.drop ? `${short ? '' : 'Drop '}${o.drop}/${run.length} · ` : legs > 1 ? `${short ? '' : 'Stop '}${st.stopAt + 1}/${legs} · ` : '') + ring;
  const left = o ? Math.max(0, o.deadline - st.t) : st.prep ? st.prep.left : 0, whole = Math.ceil(left);
  const r = st.rush, flash = !!r?.gain && st.t - r.gain.at < RUSH.gainShow;
  if (r) {
    // the run's clock, before its first order too, and for a moment what the last drop added
    const runLeft = Math.max(0, (r.end ?? st.t + RUSH.start) - st.t);
    text('clock', flash ? (r.gain.secs ? `+${r.gain.secs}s` : 'MAX') : clockText(runLeft));
    put('clockLow', !flash && runLeft < MISSION.lowTime, v => { $('clock').classList.toggle('low', v); });
    text('rushPts', scoreText(r.score));
    text('rushLv', `Level ${r.level}`);
    put('rushBump', r.del, v => { $('rushScore').style.animationName = v ? (v % 2 ? 'comboBumpA' : 'comboBumpB') : 'none'; });
  } else {
    text('clock', (o || st.prep) && whole < Infinity ? `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}` : '--:--');
    put('clockLow', !!o && left < MISSION.lowTime, v => { $('clock').classList.toggle('low', v); });
  }
  put('clockGain', flash, v => { $('clock').classList.toggle('gain', v); });
  put('rushOn', !!r, v => { $('rushScore').hidden = !v; $('wrap').classList.toggle('rush', v); });
  // past the best mid-run, the score glows
  put('rushBest', !!r && r.best > 0 && r.score > r.best, v => { $('rushScore').classList.toggle('best', v); });
  bar('bBat', st.d.bat);
  text('batPct', `${Math.ceil(st.d.bat)}%`);
  put('batLow', st.batWarn > 0, v => { $('batPct').classList.toggle('low', v); });
  bar('bHp', st.hp);
  bar('bHeat', o && st.item.heat ? st.heat : 0);
  bar('bBox', o ? st.integ : 0);
  put('boost', Math.round(st.boost), v => { $('boostFill').style.setProperty('--fuel', v); });
  if (Math.abs(st.d.vx) > BOOST.flipSpeed) put('boostBack', st.d.vx < 0, v => { $('boost').classList.toggle('flipped', v); });
  const reach = WIND.base + WIND.maxDeliveries * WIND.perDelivery;
  put('wind', Math.round(50 + Math.max(-1, Math.min(1, st.wind / reach)) * 50), v => { $('windNeedle').style.transform = `translateX(${v}%)`; });
  showWeatherNote(st);
  showCombo(st);
  // an order waiting on its call names who to answer once the call rings (waiting on the pad, at once), ahead of the
  // order it will be; one answered in flight is ready for the landing
  const k = st.ticket, ask = k && !k.answered && (st.prep?.call || ringingFor() === k);
  const from = ask ? (k.air ? st.order.t : st.stop.parcels?.[0].t ?? st.stop.t) : null, caller = from && callerAt(from, st);
  const item = o && (o.drop ? run[o.drop - 1].item : st.item), who = st.prep && !run && callerAt(st.stop.t, st)?.who, shop = st.stop.shop.shop.name, label = st.stop.item.label;
  text('oTitle', st.outcome ? st.outcome.why || 'Delivered' : caller ? `${tag}${caller.who} is calling`
    : o ? `${tag}${item.label}${item.urgent ? (r ? ` · URGENT ×${RUSH.points.urgent}` : ' · URGENT') : ''} → ${goingTo(st)}`
    : st.prep && !st.prep.call ? `${tag}Preparing ${st.prep.item.label}${who ? ` for ${who}` : ''}`
    : st.level.training ? 'Training'
    : k?.answered ? `${tag}${label} ready · land at ${shop}${shop === label ? ' shop' : ''}`
    : `${tag}Land on the green pad at ${shop}`);
}

// The run of clean deliveries, under the HUD on the right. It bumps when it grows and shakes away when it breaks. On a
// narrow screen a toast or the shop's tip steps down below it, and narrower still it steps aside for the weather note.
let comboWas = 0, comboGone = 0;
function showCombo(st) {
  const c = COMBO, n = st.combo.n, el = $('combo'), wasOn = !!shown.comboOn;
  const room = view.W >= c.narrow || !$('wxChip').classList.contains('on');
  // it stays through a passed mission's last moments, where the run has just grown
  const on = n >= c.showFrom && room && !st.done && !(st.outcome && !st.outcome.passed) && !st.level.training;
  // a broken run keeps its number while it shakes away
  if (n >= c.showFrom) {
    const table = st.rush ? RUSH.combo : c.mult;
    put('combo', `${n}${st.rush ? 'r' : ''}`, () => {
      $('comboN').textContent = n;
      $('comboX').textContent = `×${table[Math.min(n, table.length - 1)]}`;
    });
  }
  put('comboOn', on, v => {
    el.classList.toggle('on', v);
    // a toast stepped down below the badge moves back up only once the badge has gone, never onto it
    clearTimeout(comboGone);
    if (v) $('wrap').classList.add('comboOn');
    else comboGone = setTimeout(() => $('wrap').classList.remove('comboOn'), c.anim * 1000);
  });
  // two names for one animation, so each rise restarts it without asking the page for layout
  if (n > comboWas && on) el.style.animationName = n % 2 ? 'comboBumpA' : 'comboBumpB';
  else if (n < comboWas && wasOn) el.style.animationName = 'comboLost';
  comboWas = n;
  // the first badge a player sees says what it is, once, while the mission is still being flown
  if (on && !settings.comboSeen && !st.outcome) {
    settings.comboSeen = true;
    saveSettings();
    st.note = { icon: 'flame', text: st.rush ? 'Clean drops in a row raise your score' : 'Clean drops in a row raise your tip', until: st.t + c.hint };
  }
}

// On a keyboard a level opens with the keys on show, and they fade out of the way.
const KEY_PANELS = ['keys', 'shiftHint'];
let hintTimer = 0;
export function showKeyHints() {
  if (touchUI()) return;
  clearTimeout(hintTimer);
  for (const id of KEY_PANELS) {
    const el = $(id);
    el.style.setProperty('--hint', `${KEY_HINT.secs}s`);
    el.classList.remove('brief');
    el.hidden = false;
    void el.offsetWidth;
    el.classList.add('brief');
  }
  hintTimer = setTimeout(() => { for (const id of KEY_PANELS) $(id).hidden = true; }, KEY_HINT.secs * 1000);
}

// The training panel, and a ring around the control it is talking about.
let taught = [];
export function showLesson(step, title, body, teach = []) {
  clearTimeout(hintTimer);
  for (const id of KEY_PANELS) $(id).classList.remove('brief');
  $('shiftHint').hidden = !teach.includes('boost') || touchUI();
  for (const id of taught) $(id).classList.remove('teach');
  taught = teach;
  for (const id of teach) $(id).classList.add('teach');
  $('lesson').hidden = !title;
  $('keys').hidden = !title || touchUI();
  if (!title) return;
  $('lessonStep').textContent = step;
  $('lessonTitle').textContent = title;
  $('lessonText').textContent = body;
}

// Whether a toast or the hangar's tip is up where, on a narrow screen, it hides the weather note; a surprise that
// needs its note waits.
export const noticeUp = () => view.W < COMBO.wideFrom && !($('toast').hidden && $('hangarTip').hidden);

// Where the toast and the hangar's tip end on screen, for the call card to step under. Each is measured once as it
// shows, without the combo's step, which the card takes by the same rule in the page's style.
const band = { toast: 0, tip: 0 };
export const bandBottom = () => Math.max(band.toast, band.tip);
// What the call card and the shop's order note cover on screen ([left, top, right, bottom] or null), so the card can
// move away from the note and the note can give way where the card still sits.
export const covers = { card: null, note: null };

let toastTimer = 0;
export function showToast(title, detail, good, gold = false) {
  const el = $('toast');
  $('toastTitle').textContent = title;
  $('toastWhy').textContent = detail;
  el.classList.toggle('bad', !good);
  el.classList.toggle('gold', gold);
  el.hidden = false;
  band.toast = view.top + 12 + el.offsetHeight;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; band.toast = 0; }, MISSION.toastMs);
}

export function showBoost(on) {
  $('boost').hidden = !on;
}

export function hideOverlay() {
  $('overlay').hidden = true;
  $('wrap').classList.remove('home');
}

// Writes only on change: this runs every frame.
function show(id, on) {
  const el = $(id);
  if (el.hidden === on) el.hidden = !on;
}

// A two-state button: its text changes with what it would do next.
function flip(id, on, idle, active) {
  const el = $(id), label = on ? active : idle, text = el.querySelector('span') || el;
  if (text.textContent === label) return;
  text.textContent = label;
  el.classList.toggle('on', on);
}

// While Auto Drop flies, it works the rope and Hold itself, so only its CANCEL shows.
export function showActions(zone, anchored, landing, boosting, dropping) {
  const boost = $('boost');
  if (boost.classList.contains('on') !== boosting) boost.classList.toggle('on', boosting);
  show('ropeDown', zone.rope && !dropping);
  show('ropeUp', zone.rope && !dropping);
  show('hold', (zone.hold || anchored) && !dropping);
  show('land', !!zone.land || landing);
  show('autoDrop', zone.drop || dropping);
  flip('hold', anchored, 'HOLD', 'RELEASE');
  flip('land', landing, 'LAND', 'CANCEL');
  flip('autoDrop', dropping, 'AUTO DROP', 'CANCEL');
}

/* ---------- settings ---------- */
export const sheetOpen = () => !$('sheet').hidden;
// Settings, the Shop and High Score cover the whole screen, so nothing behind them needs drawing.
export const pagesOpen = () => !$('sheet').hidden || !$('shop').hidden || !$('league').hidden;
export function openSheet() {
  // only a phone that can buzz is offered the switch
  $('vibeSection').hidden = !(touchUI() && canBuzz());
  $('sheet').hidden = false;
  $('sheet').querySelector('.pageBody').scrollTop = 0;
}
const MODALS = ['levels', 'levelCard', 'resultCard', 'pauseCard', 'shop', 'league', 'adCard', 'gifts', 'chapterCard', 'boostCard'];
export const modalOpen = () => sheetOpen() || MODALS.some(id => !$(id).hidden);
// The level map is opaque, so nothing behind it needs drawing.
export const levelsOpen = () => !$('levels').hidden;

// One draw when a screen opens, where a live blur of the scene costs a phone every frame the screen is up.
let frosted = false;
export function frost(on) {
  if (on === frosted) return;
  frosted = on;
  const f = $('frost');
  f.hidden = !on;
  if (!on) return;
  f.width = Math.ceil(view.W / FROST.shrink);
  f.height = Math.ceil(view.H / FROST.shrink);
  const g = f.getContext('2d', { alpha: false });
  g.imageSmoothingQuality = 'medium';
  g.drawImage(cv, 0, 0, f.width, f.height);
}

/* ---------- levels ---------- */
let levelList = [], acts = {}, picked = null, resultLevel = null;
export const starText = n => '★'.repeat(n) + '☆'.repeat(3 - n);
// A score as the player reads it: 12,340.
const scoreFmt = new Intl.NumberFormat('en-US');
export const scoreText = n => scoreFmt.format(n);
export const clockText = s => `${Math.floor(Math.ceil(s) / 60)}:${String(Math.ceil(s) % 60).padStart(2, '0')}`;
// The first level without a star is the furthest one open.
export function reachedLevel(stars) {
  let n = 1;
  while (stars[n] || skips.skipped.includes(n)) n++;
  return n;
}

// Whether mission n can be skipped for an ad: null before the offer applies, else ok or why it cannot be taken now.
// The offer stays hidden until it is earned, so it never invites a player to fail on purpose.
function skipState(n) {
  const c = SKIP, { stars } = loadProgress();
  if ((c.devOnly && !settings.dev) || (skips.fails[n] || 0) < c.afterFails || stars[n] || skips.skipped.includes(n) || n < c.from) return null;
  if (c.never.includes(n)) return { why: "Checkpoint mission. Can't be skipped" };
  const block = skipBlock(n), allowed = n >= c.challengeFrom ? c.challengePerBlock : c.perBlock;
  const used = skips.skipped.filter(k => skipBlock(k).id === block.id).length, waiting = skips.skipped.filter(k => !stars[k]).length;
  if (skips.skipped.length && skips.since < c.gap) return { why: `Pass ${c.gap - skips.since} more ${c.gap - skips.since === 1 ? 'mission' : 'missions'} to skip again` };
  if (waiting >= c.open) return { why: 'Clear a skipped mission to skip again' };
  if (used >= allowed) return { why: block.next > levelList.length ? 'No skips left in these missions' : `No skips left until Mission ${block.next}` };
  return { ok: true };
}

// Skips are counted in blocks of SKIP.blockSize missions, and each chapter starts a block of its own; next is the first
// mission after the block.
function skipBlock(n) {
  const size = SKIP.blockSize, from = CHAPTERS.filter(c => n >= c.from).pop()?.from ?? 1, i = Math.ceil((n - from + 1) / size);
  return { id: `${from}-${i}`, next: Math.min(from + i * size, CHAPTERS.find(c => c.from > n)?.from ?? Infinity) };
}

function showSkip(n) {
  const s = skipState(n), b = $('resultSkip');
  b.hidden = !s;
  if (!s) return;
  b.disabled = !s.ok;
  $('resultSkipNote').textContent = s.ok ? 'Watch an ad · no stars, tips or score' : s.why;
}

// A stand-in for a rewarded ad: it counts down, then Done hands over the reward its button names (a skip, a boost).
let adTimer = 0;
export function playAd(label, reward) {
  const card = $('adCard'), end = Date.now() + SKIP.adSecs * 1000;
  $('adDone').textContent = label;
  $('adDone').disabled = true;
  card.hidden = false;
  clearInterval(adTimer);
  const tick = () => {
    const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
    $('adCount').textContent = left ? `${left}` : '';
    $('adState').textContent = left ? 'Ad playing' : 'Reward ready';
    if (left) return;
    clearInterval(adTimer);
    $('adDone').disabled = false;
  };
  tick();
  adTimer = setInterval(tick, 250);
  // the reward is taken once, however fast the button is pressed again
  $('adDone').onclick = () => {
    $('adDone').onclick = null;
    card.hidden = true;
    reward();
  };
  $('adClose').onclick = () => {
    clearInterval(adTimer);
    card.hidden = true;
  };
}

// What a mission holds, read at a glance beside its number: its own rule first, then whatever is most likely to end it.
function signsFor(l) {
  return [
    l.challenge && [l.challenge.sign ?? (l.challenge.key === 'hawks' ? 'hawk' : l.challenge.key), l.challenge.name],
    l.eagles && ['eagle', 'Eagles'],
    l.stops[0].parcels && ['double', 'Double Run'],
    l.desert && ['desert', 'Desert'],
    l.forest && ['forest', 'Forest'],
    l.mountain && ['mountain', 'Mountains'],
    l.snow && ['snow', 'Snowfield'],
    l.beach && ['sea', 'Open sea'],
    l.rival && ['rival', 'Rival'],
    l.street && ['street', 'Street traffic'],
    l.stops.some(s => s.item.urgent) && ['urgent', 'Urgent order'],
    l.hawks && !l.challenge && ['hawk', 'Hawks'],
  ].filter(Boolean).slice(0, LEVELS.signs);
}

// The High Score button drops its word when it would wrap off the Shop's row; a turned screen asks again.
export function fitBar() {
  const bar = $('levelsBar'), last = !$('giftBtn').hidden ? $('giftBtn') : !$('boostBtn').hidden ? $('boostBtn') : $('openLeague');
  bar.classList.remove('tight');
  if (last.offsetTop > $('openShop').offsetTop + LEVELS.wrapSlack) bar.classList.add('tight');
}

export function hideModals() {
  for (const id of MODALS) $(id).hidden = true;
  $('toast').hidden = true;
  band.toast = 0;
  clearTimeout(toastTimer);
}

export function showLevels() {
  hideModals();
  const { stars, money } = loadProgress(), open = reachedLevel(stars), gap = LEVELS.rowGap, unlocked = n => settings.dev || n <= open;
  // a chapter's banner stands in its own gap below the chapter's first mission
  const lift = n => CHAPTERS.reduce((sum, c) => sum + (n >= c.from ? c.gap : 0), 0);
  const height = (levelList.length + 1) * gap + lift(levelList.length), rowY = n => height - n * gap - lift(n);
  const spot = l => ({ x: 50 + Math.sin(l.n * LEVELS.pathWave) * LEVELS.pathWidth, y: rowY(l.n) });
  const road = levelList.map(l => { const p = spot(l); return `${p.x},${p.y}`; }).join(' ');
  const nodes = levelList.map(l => {
    const p = spot(l), best = stars[l.n] || 0, skipped = !best && skips.skipped.includes(l.n);
    const state = !unlocked(l.n) ? 'locked' : l.n === open ? 'next' : 'done', signs = signsFor(l);
    const marks = signs.map(([key, name]) => `<i class="sign ${key}" title="${name}"><svg aria-hidden="true"><use href="#s-${key}"/></svg></i>`).join('');
    const shut = state === 'locked', label = [`Mission ${l.n}`, ...signs.map(s => s[1])].join(', ') + (shut ? `, locked. Pass Mission ${open} first` : '');
    const under = shut ? '<small class="lockMark"><svg aria-hidden="true"><use href="#i-lock"/></svg></small>' : `<small${skipped ? ' title="Skipped. Replay for stars"' : ''}>${best ? starText(best) : skipped ? '⏭ skipped' : ''}</small>`;
    return `<button class="node ${state}${p.x > 50 ? ' west' : ''}${l.n > open && unlocked(l.n) ? ' devMark' : ''}" data-n="${l.n}" style="left:${p.x}%;top:${p.y}px;--zone:${l.shop.zone.map}" aria-label="${label}"><b>${l.n}</b>${under}<span class="signs">${marks}</span></button>`;
  }).join('');
  const banners = CHAPTERS.filter(c => c.from <= levelList.length).map(c => {
    const shut = !unlocked(c.from);
    return `<button class="chapter${shut ? ' locked' : ''}" data-chapter="${c.n}" style="top:${(rowY(c.from - 1) + rowY(c.from)) / 2}px" aria-label="${c.kicker}, ${c.name}, ${shut ? c.locked : c.span}"><small>${c.kicker}</small><b>${c.name}</b><span>${shut ? `<svg class="lockIco" aria-hidden="true"><use href="#i-lock"/></svg>${c.locked}` : c.span}</span></button>`;
  }).join('');
  const path = $('levelsPath');
  path.style.height = height + 'px';
  path.innerHTML = `<svg viewBox="0 0 100 ${height}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${road}"/></svg>${banners}${nodes}`;
  $('levelsMoney').textContent = `$${money}`;
  $('levels').hidden = false;
  // the Today and Rush cards change the bar's height, so they come before the shop note is placed
  showToday(true);
  showRushCard();
  showBoostBtn();
  fitBar();
  chapterIntro();
  nudgeShop(true);
  const scroll = $('levelsScroll');
  scroll.scrollTop = rowY(open) - (scroll.clientHeight || 0) / 2;
}

// What a mission asks and what can end it, for its card: the job, the run, the cost of a ruined order, the dangers.
function missionRows(l) {
  const legs = l.stops, route = legs.length > 1;
  const order = i => (i.urgent ? `${i.label} · urgent` : i.label), to = (s, stop = s) => `${placeName(s.t, stop)}${s.bull ? ', small mark' : ''}, ${Math.round(s.dist / 10)} m${s.hops?.length ? `, moves ${s.hops.length > 1 ? 'twice' : 'once'}` : ''}`;
  const { item, shop, limit, parcels } = legs[0];
  const jobs = parcels
    ? [['Double Run', 'Two orders, one trip'], ['Shop', `${shop.shop.name}, ${shop.zone.name}`], ...parcels.map((p, k) => [`Drop ${k + 1}`, `${order(p.item)} to ${to(p, legs[0])}`]), ['Time', clockText(limit)]]
    : route
    ? legs.map((s, k) => [`Stop ${k + 1}`, `${order(s.item)} to ${to(s)}${s.handOn ? ', handed on' : ''}, ${clockText(s.limit)}`])
    : [['Order', order(item)], ['Shop', `${shop.shop.name}, ${shop.zone.name}`], ['Customer', to(legs[0])], ['Time', clockText(limit)]];
  // an order too big for the chosen aircraft is flown by the one lent for it, and the card says so first; otherwise a slow
  // aircraft is told before an avalanche, while there is still time to pick another
  const chosen = AIRCRAFT.find(a => a.key === settings.plane) ?? AIRCRAFT[0];
  const big = l.rush || l.training ? null : legs.flatMap(s => [s.item, ...(s.parcels ?? []).map(p => p.item)]).filter(Boolean).flatMap(i => i.parts ?? [i]).find(i => !canCarry(chosen.key, i));
  const plane = big ? AIRCRAFT.find(a => a.key === CARGO.lend) : chosen, chased = legs.some(s => s.twist === 'avalanche') && plane.speed < HANGAR.chaseSpeed;
  const flier = big ? [['Aircraft', `${big.label} too big for the ${chosen.name}. The ${plane.name} flies it`]]
    : chased ? [['Aircraft', plane.speed < HANGAR.boostFloor ? `${plane.name} is too slow for an avalanche, even with Boost. Pick a faster one` : `${plane.name} is slow for an avalanche. Boost, or pick a faster one`]] : [];
  return [
    ...flier,
    ...jobs, ...(legs.some(s => s.rescue) ? [['Rescue', `Hold steady ${RESCUE.hold} s over them`]] : []), ...(acts.streak() >= COMBO.showFrom ? [['Combo', `${acts.streak()} in a row, next clean tip ×${COMBO.mult[Math.min(acts.streak() + 1, COMBO.mult.length - 1)]}`]] : []),
    ['If ruined', l.daily ? 'Nothing. Retries are free' : route ? `up to -$${Math.max(...legs.map(s => s.item.price))}` : `-$${item.price}`],
    ...(l.weather ? [['Weather', WEATHER[l.weather].name]] : []), ['Wind', `up to ${l.wind}`], ['Hawks', l.hawks ? `${l.hawks}${route ? ' per stop' : ''}` : 'None'], ...(l.eagles ? [['Eagles', `${l.eagles}${route ? ', last stop' : ''}, one hit downs you`]] : []),
    ['Rival', l.rival ? `Yes${route ? ', last stop' : ''}, speed ${l.rivalSpeed}` : 'None'], ...(l.calm ? [] : [[l.beach ? 'Boats' : l.desert ? 'Buggies' : l.forest ? 'Jeeps and deer' : l.mountain ? 'Jeeps and goats' : l.snow ? 'Sleds and reindeer' : 'Cars', `${l.street ? (l.desert || l.forest || l.mountain || l.snow ? 'Crossing your drop' : 'On your street') : 'Yes'}, speed ${l.carSpeed}`]]),
    ...(l.regions ? [['Route', l.regions.map(r => DAILY.places[r]).join(' → ')]] : l.beach ? [['Danger', 'Open sea']] : l.desert ? [['Danger', 'Quicksand, sandstorms']] : l.forest ? [['Danger', 'Tall pines, the river']] : l.mountain ? [['Danger', 'Updrafts, downdrafts, the cable car']] : l.snow ? [['Danger', 'Thin ice. The cold drains the battery']] : []),
  ];
}

// A mission's card, from the map or today's mission: head rows first, then the job and its dangers, then tail rows; go
// is the Start button's word, and lock names the mission to pass first; rows replaces the job and its dangers, and mark
// the stars; boosts shows the strip of boosts over Start (the map's own missions only).
export function openMissionCard(l, { kicker = '', title, best = 0, head = [], tail = [], go = 'Start', lock = 0, rows = null, mark = null, boosts = false }) {
  picked = l;
  $('levelKicker').hidden = !kicker;
  $('levelKicker').textContent = kicker;
  $('levelTitle').textContent = title;
  $('levelBest').textContent = mark ?? starText(best);
  $('levelBest').classList.toggle('words', mark != null);
  $('levelRows').innerHTML = [...head, ...(rows ?? missionRows(l)), ...tail].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  const locked = !!lock && !settings.dev;
  $('levelPlay').disabled = locked;
  $('levelPlay').classList.toggle('devMark', !!lock && !locked);
  $('levelPlay').textContent = locked ? `Finish mission ${lock} first` : go;
  boostStrip(l, boosts && !locked);
  $('levelCard').hidden = false;
  // the map's Shop note waits under the card: one teaser a screen
  $('shopNudge').hidden = true;
}
function openLevelCard(n) {
  const l = levelList[n - 1], { stars } = loadProgress(), open = reachedLevel(stars), ch = CHAPTERS.filter(c => n >= c.from).pop();
  openMissionCard(l, { kicker: ch?.kicker ?? '', title: `Mission ${n}`, best: stars[n] || 0, head: l.challenge ? [['Challenge', l.challenge.name], ['Rule', l.challenge.note]] : [], lock: n > open ? open : 0, boosts: true });
}

// A chapter's card. Opened with the chapter open it counts as seen, so it comes by itself only once; go is what its
// button does after closing it, as starting the chapter's first mission.
function openChapter(c, go = null) {
  const open = settings.dev || reachedLevel(loadProgress().stars) >= c.from;
  if (open && settings.chapterSeen < c.n) {
    settings.chapterSeen = c.n;
    saveSettings();
  }
  $('chapterKicker').textContent = c.kicker;
  $('chapterName').textContent = c.name;
  $('chapterIntro').textContent = c.intro;
  $('chapterTags').innerHTML = c.tags.map(([key, text]) => `<li><i class="sign ${key}"><svg aria-hidden="true"><use href="#s-${key}"/></svg></i>${text}</li>`).join('');
  // a locked chapter's button reads as the locked level card's does, and the corner button closes the card
  const btn = $('chapterGo');
  btn.disabled = !open;
  btn.textContent = !open ? c.locked : go ? `Start Mission ${c.from}` : "Let's fly";
  btn.onclick = () => {
    $('chapterCard').hidden = true;
    go?.();
    nudgeShop();
  };
  $('chapterCard').hidden = false;
  nudgeShop();
}

// A chapter newly open on the map shows its card once, unless another card is up; the gift calendar's close asks again.
export function chapterIntro() {
  const open = reachedLevel(loadProgress().stars), c = CHAPTERS.filter(c => open >= c.from && settings.chapterSeen < c.n).pop();
  if (c && !$('levels').hidden && $('sheet').hidden && MODALS.every(id => id === 'levels' || $(id).hidden)) openChapter(c);
}

// The first mission of a chapter not yet introduced starts from the chapter's card.
function playLevel(l) {
  const c = !l.daily && !l.training && !l.rush && CHAPTERS.find(c => c.from === l.n);
  if (c && settings.chapterSeen < c.n) openChapter(c, () => acts.play(l));
  else acts.play(l);
}

// The money runs up to its total once the stars have landed.
// Each element keeps its own count, so a run's score and its pay can run up together.
function countUp(el, to, fmt = v => `+$${v}`, wait = RESULT.tallyDelay, span = RESULT.tally) {
  const from = performance.now() + wait;
  cancelAnimationFrame(el.tally);
  el.textContent = fmt(0);
  const tick = now => {
    const k = Math.max(0, Math.min(1, (now - from) / span));
    el.textContent = fmt(Math.round(to * (1 - (1 - k) ** 3)));
    if (k < 1) el.tally = requestAnimationFrame(tick);
  };
  el.tally = requestAnimationFrame(tick);
}

// A passed mission's line under the money: today's reward already taken, or what just opened on the map.
function passTip(o, level) {
  const { daily, gifts, rush } = loadProgress();
  if (level.daily) return o.reward ? '' : "Today's reward is already yours. A new mission comes at midnight";
  if (o.training) return '';
  if (level.n === DAILY.unlock && daily.day < 0) return "Today's Mission is open on the map";
  if (level.n === GIFTS.unlock && gifts.day < 0) return 'A daily gift is waiting on the map';
  if (level.n === RUSH.unlock && !rush.runs) return 'Rush Hour is open on the map';
  const ch = CHAPTERS.find(c => c.from === level.n + 1);
  if (ch && settings.chapterSeen < ch.n) return `${ch.kicker} is open: ${ch.name}`;
  if (level.n === levelList.length) {
    const { stars } = loadProgress(), c = CHAPTERS[CHAPTERS.length - 1], left = levelList.filter(l => (stars[l.n] || 0) < 3).length;
    return `${c.kicker} complete: ${c.name}. ${left ? `${left} ${left > 1 ? 'missions' : 'mission'} left for three stars` : 'Every mission at three stars'}`;
  }
  if (o.auto) return BOOSTS.text.usedTip;
  return '';
}

// A fail's tip: a rule's own word when the clock ran out on a rescue or a bullseye stop, else the way of failing's.
function failTip(o, level) {
  const s = level.stops?.[o.reached], rule = s?.rescue ? 'rescue' : s?.bull ? 'bullseye' : '';
  return (o.why === "TIME'S UP" && RESULT.ruleTips[rule]) || RESULT.tips[o.why] || '';
}

export function showResult(o, level, hasNext) {
  resultLevel = level;
  $('resultCard').classList.remove('rush', 'best');
  if (level.rush) return rushResult(o);
  const card = $('resultCard'), won = o.passed && !o.training, legs = level.stops.length, next = o.passed && hasNext, daily = !!level.daily;
  // a pass with nowhere further to go, today's mission or the last one, leads back to the map
  const lead = o.training || (o.passed && !next) ? 'resultMap' : next ? 'resultNext' : 'resultRetry';
  card.classList.toggle('bad', !o.passed);
  $('resultKicker').textContent = o.training ? 'Flight school' : daily ? "Today's Mission" : `Mission ${level.n}`;
  $('resultTitle').textContent = o.training ? 'TRAINING COMPLETE' : o.passed ? 'MISSION COMPLETE' : 'MISSION FAILED';
  const hero = $('resultStars'), earned = o.training ? 0 : o.stars || 0;
  hero.innerHTML = o.training ? `<div class="seal ok"><svg class="ico"><use href="#i-check"/></svg></div>`
    : [0, 1, 2].map(i => `<svg style="--n:${i}" viewBox="0 0 48 48"><use href="#i-star${i < earned ? '' : '-off'}"/></svg>`).join('');
  hero.setAttribute('aria-label', won ? `${o.stars} of 3 stars` : '');
  const rows = won ? [['Delivery tips', `+$${o.tip - o.beat - o.bonus}`], ...(o.bonus ? [['Combo and bonuses', `+$${o.bonus}`]] : []), ...(o.beat ? [['Rival beaten', `+$${o.beat}`]] : []),
    ...(o.reward ? [['Daily reward', `+$${o.reward}`]] : []), ...(o.auto ? [BOOSTS.text.usedRow] : []), ['Order condition', `${Math.round(o.integ)}%`], ['Flight time', clockText(o.secs)]]
    : o.passed ? []
    : [...(legs > 1 ? [['Reached', `Stop ${o.reached + 1} of ${legs}`]] : []), ...(o.cost ? [['Order lost', `-$${o.cost}`]] : [])];
  $('resultStats').innerHTML = rows.map(([k, v], i) => `<dt style="--n:${i}">${k}</dt><dd style="--n:${i}">${v}</dd>`).join('');
  $('resultStats').hidden = !rows.length;
  $('resultTotal').hidden = !won;
  $('resultSheet').hidden = !rows.length;
  // a won mission's line under the stars names its highlights, in gold; each keeps its number with it, and a card too
  // narrow for both carries the dot down with the second
  const shine = won ? [o.reward && (o.run > 1 ? `${o.run}-DAY\u00a0STREAK` : 'DAILY\u00a0DONE'), o.perfect && (o.perfect > 1 ? `PERFECT\u00a0×${o.perfect}` : 'PERFECT'), o.combo >= COMBO.showFrom && `COMBO\u00a0${o.combo}`].filter(Boolean).join(' ·\u00a0') : '';
  $('resultWhy').textContent = o.training ? 'You are ready for Mission 1' : o.passed ? shine : o.why;
  $('resultWhy').classList.toggle('shine', !!shine);
  $('resultTip').textContent = o.passed ? passTip(o, level) : failTip(o, level);
  $('resultTip').classList.toggle('note', o.passed);
  for (const id of ['resultMap', 'resultRetry']) $(id).className = id === lead ? 'go wide' : 'ghost round';
  $('resultNext').hidden = !next;
  if (o.passed || o.training || daily) $('resultSkip').hidden = true;
  else showSkip(level.n);
  resultBoost(o, level, next ? levelList[level.n] : null);
  card.hidden = false;
  sfx(o.passed ? 'win' : 'lose');
  musicCue(o.passed ? 'win' : 'lose');
  if (won) countUp($('resultMoney'), o.tip + (o.reward || 0));
}

// A run's card: the score counting up where the stars stand, what ended it under it, the run's numbers and its pay. Retry
// leads. A new best gets the rays, the win, then paper from the score and a buzz once the count lands.
function rushResult(o) {
  const card = $('resultCard'), r = o.rush, best = r.newBest, c = RUSH, hero = $('resultStars');
  card.classList.remove('bad');
  card.classList.add('rush');
  card.classList.toggle('best', best);
  $('resultKicker').textContent = 'Rush Hour';
  $('resultTitle').textContent = best ? 'NEW BEST!' : 'FINAL SCORE';
  hero.innerHTML = '<div class="rushHero"><b id="rushFinal">0</b><small>points</small></div>';
  hero.setAttribute('aria-label', `${r.score} points`);
  const rows = [['Deliveries', `${r.del}`], ['PERFECT drops', `${r.perfect}`], ['Longest combo', `${r.combo}`], ['Rush level', `${r.level}`],
    ...(best ? (r.best ? [['Old best', scoreText(r.best)]] : []) : [['Best score', scoreText(r.best)]])];
  $('resultStats').innerHTML = rows.map(([k, v], i) => `<dt style="--n:${i}">${k}</dt><dd style="--n:${i}">${v}</dd>`).join('');
  $('resultStats').hidden = false;
  $('resultSheet').hidden = false;
  $('resultTotal').hidden = !r.pay;
  $('resultWhy').textContent = o.why;
  $('resultWhy').classList.remove('shine');
  $('resultTip').textContent = o.why !== "TIME'S UP" ? RESULT.tips[o.why] || '' : r.del ? `Clean drops add ${c.clean}s to the clock, PERFECT drops ${c.clean + c.perfect}s` : c.firstTip;
  $('resultTip').classList.remove('note');
  $('resultRetry').className = 'go wide';
  $('resultMap').className = 'ghost round';
  $('resultNext').hidden = true;
  $('resultSkip').hidden = true;
  $('resultBoost').hidden = true;
  card.hidden = false;
  sfx(best ? 'win' : 'lose');
  musicCue(best ? 'win' : 'lose');
  if (r.pay) countUp($('resultMoney'), r.pay);
  countUp($('rushFinal'), r.score, scoreText, c.tallyDelay, c.tally);
  if (best) setTimeout(() => {
    if (card.hidden || !card.classList.contains('best')) return;
    paper(hero.firstChild, c.bestPaper >> (view.lowQ ? 1 : 0));
    buzz(c.bestBuzz);
  }, c.tallyDelay + c.tally);
}

// The map button pauses. Leaving with an order in the air costs what ruining it would.
function openPause() {
  const cost = acts.stake(), level = acts.level(), { money, del } = loadProgress(), combo = acts.combo() >= COMBO.showFrom, rush = acts.rush();
  $('pauseTitle').textContent = rush ? 'Rush Hour' : level.training ? 'Training' : level.daily ? "Today's Mission" : `Mission ${level.n}`;
  $('pauseStats').textContent = rush ? `${scoreText(rush.score)} points · ${rush.del} ${rush.del === 1 ? 'delivery' : 'deliveries'}` : `$${money} · ${del} ${del === 1 ? 'delivery' : 'deliveries'}`;
  $('pauseWhy').textContent = rush ? (rush.del ? 'Leaving ends the run. Your score still counts' : '')
    : cost ? `Leaving loses the order: -$${cost}${combo ? ' and your combo' : ''}` : combo ? 'Leaving ends your combo' : '';
  markDropKeys(level);
  $('pauseCard').hidden = false;
}
// the pause card's money and leaving cost are read when it opens, so a purchase made over it asks again
export function refreshPause() {
  if (!$('pauseCard').hidden) openPause();
}

// A shut mission shakes and names the one to pass; its card never opens.
function lockHint(node, open) {
  clearTimeout(node.tipTimer);
  node.querySelector('.tip')?.remove();
  const tip = document.createElement('span');
  tip.className = 'tip';
  tip.setAttribute('role', 'status');
  tip.textContent = `Pass Mission ${open} first`;
  node.append(tip);
  node.style.setProperty('--shake', `${LOCKS.shake}s`);
  node.classList.remove('shake');
  void node.offsetWidth;
  node.classList.add('shake', 'hinting');
  sfx('locked');
  buzz(LOCKS.buzz);
  node.tipTimer = setTimeout(() => {
    tip.remove();
    node.classList.remove('shake', 'hinting');
  }, LOCKS.hint * 1000);
}

export function initLevels(levels, handlers) {
  levelList = levels;
  acts = handlers;
  $('levelsPath').addEventListener('click', e => {
    const chapter = e.target.closest?.('[data-chapter]');
    if (chapter) {
      openChapter(CHAPTERS.find(c => c.n === +chapter.dataset.chapter));
      return;
    }
    const node = e.target.closest?.('[data-n]');
    if (!node) return;
    if (node.classList.contains('locked')) lockHint(node, reachedLevel(loadProgress().stars));
    else openLevelCard(+node.dataset.n);
  });
  // leaving a card or a result settles a teaser left untouched
  $('levelClose').addEventListener('click', () => {
    leaveTease();
    $('levelCard').hidden = true;
    nudgeShop();
  });
  // the chapter card only closes: it already counts as seen, and a card from Next leaves the result card under it
  $('chapterClose').addEventListener('click', () => {
    $('chapterCard').hidden = true;
    nudgeShop();
  });
  // a tap on the dim around a card goes back as its arrow does
  for (const [card, back] of [['levelCard', 'levelClose'], ['gifts', 'giftsClose'], ['chapterCard', 'chapterClose']]) {
    $(card).addEventListener('click', e => { if (e.target === e.currentTarget) $(back).click(); });
  }
  $('levelPlay').addEventListener('click', () => {
    leaveTease();
    playLevel(picked);
  });
  $('openTraining').addEventListener('click', () => {
    $('sheet').hidden = true;
    acts.training();
  });
  $('lessonSkip').addEventListener('click', () => {
    acts.leave();
    showLevels();
  });
  $('toMap').addEventListener('click', openPause);
  $('pauseBack').addEventListener('click', () => { $('pauseCard').hidden = true; });
  $('pauseRetry').addEventListener('click', acts.retry);
  $('pauseMap').addEventListener('click', () => {
    acts.leave();
    showLevels();
  });
  $('resultNext').addEventListener('click', () => {
    leaveTease();
    playLevel(levelList[resultLevel.n]);
  });
  $('resultRetry').addEventListener('click', () => {
    leaveTease();
    acts.play(resultLevel);
  });
  $('resultMap').addEventListener('click', () => {
    leaveTease();
    showLevels();
  });
  // the skip is granted once the ad is done, and the next mission opens
  $('resultSkip').addEventListener('click', () => {
    const n = resultLevel.n;
    playAd(BOOSTS.text.skip, () => {
      if (!skips.skipped.includes(n)) skips.skipped.push(n);
      skips.since = 0;
      delete skips.fails[n];
      saveSkips();
      if (levelList[n]) playLevel(levelList[n]);
      else showLevels();
    });
  });
}

function markPicture() {
  for (const b of $('pictureModes').children) b.setAttribute('aria-pressed', settings.picture === b.dataset.value);
}

// The camera button and the C key step through the shots, and the choice is kept for the next mission.
function markCamera() {
  const shot = SHOTS[settings.camera]?.name ? settings.camera : SHOTS.start;
  for (const b of $('camModes').children) b.setAttribute('aria-pressed', String(b.dataset.value === shot));
  // the button shows the shot it is on
  $('camBtn').querySelector('use').setAttribute('href', `#i-shot-${shot}`);
  $('camBtn').setAttribute('aria-label', `Camera: ${SHOTS[shot].name}. C to change`);
}

function showShot(name) {
  const chip = $('camChip');
  chip.textContent = SHOTS[name].name.toUpperCase();
  chip.style.setProperty('--hint', `${SHOTS.chip}s`);
  chip.hidden = false;
  chip.classList.remove('brief');
  void chip.offsetWidth;
  chip.classList.add('brief');
  clearTimeout(showShot.timer);
  showShot.timer = setTimeout(() => { chip.hidden = true; }, SHOTS.chip * 1000);
}

export function cycleShot() {
  const order = SHOTS.order, next = order[(order.indexOf(settings.camera) + 1) % order.length];
  settings.camera = next;
  saveSettings();
  markCamera();
  showShot(next);
}

function buildCamera() {
  for (const value of SHOTS.order) {
    const b = document.createElement('button');
    b.textContent = SHOTS[value].name;
    b.dataset.value = value;
    b.addEventListener('click', () => {
      settings.camera = value;
      saveSettings();
      markCamera();
    });
    $('camModes').appendChild(b);
  }
  markCamera();
  $('camBtn').addEventListener('click', cycleShot);
  addEventListener('keydown', e => {
    if (e.code === 'KeyC' && !e.repeat && e.target?.tagName !== 'INPUT' && $('overlay').hidden && !modalOpen()) cycleShot();
  });
}

// An On and Off pair for one setting; then runs after a change.
function buildSwitch(id, key, then = () => {}) {
  const mark = () => { for (const b of $(id).children) b.setAttribute('aria-pressed', String(settings[key] !== false) === b.dataset.value); };
  for (const [value, label] of [['true', 'On'], ['false', 'Off']]) {
    const b = document.createElement('button');
    b.textContent = label;
    b.dataset.value = value;
    b.addEventListener('click', () => {
      settings[key] = value === 'true';
      saveSettings();
      mark();
      then(settings[key]);
    });
    $(id).appendChild(b);
  }
  mark();
}

function buildPicture() {
  for (const [value, label] of PICTURE.modes) {
    const b = document.createElement('button');
    b.textContent = label;
    b.dataset.value = value;
    b.addEventListener('click', () => {
      settings.picture = value;
      saveSettings();
      view.tier = firstTier();
      resize();
      markPicture();
    });
    $('pictureModes').appendChild(b);
  }
  markPicture();
}

function markControls() {
  $('ctlJoy').setAttribute('aria-pressed', settings.controls === 'joystick');
  $('ctlArrows').setAttribute('aria-pressed', settings.controls === 'arrows');
  for (const row of $('stickOptions').children) {
    for (const b of row.lastChild.children) b.setAttribute('aria-pressed', settings.stick[row.dataset.key] === b.dataset.value);
  }
}

// One row of choices for each touch setting in config.
function buildStickOptions() {
  for (const o of JOY.options) {
    const row = document.createElement('div'), name = document.createElement('span'), seg = document.createElement('div');
    row.dataset.key = o.key;
    row.className = 'stickRow';
    name.textContent = o.label;
    seg.className = 'seg';
    for (const [value, label] of o.values) {
      const b = document.createElement('button');
      b.textContent = label;
      b.dataset.value = value;
      b.addEventListener('click', () => {
        settings.stick[o.key] = value;
        saveSettings();
        markControls();
        applyControls();
      });
      seg.appendChild(b);
    }
    row.appendChild(name);
    row.appendChild(seg);
    $('stickOptions').appendChild(row);
  }
}

// Read from the numbers, so a rebalanced model gets a true badge without touching this.
export function badgeFor(m) {
  let badge = { stat: 'all', text: BADGE.allRound }, top = 0;
  for (const [stat, [best, good]] of Object.entries(BADGE.stats)) {
    const fleet = AIRCRAFT.map(a => a[stat]), rank = 1 + fleet.filter(v => v > m[stat]).length;
    const lead = m[stat] / (fleet.reduce((sum, v) => sum + v, 0) / fleet.length);
    if (rank > BADGE.topRank || lead <= top) continue;
    top = lead;
    badge = { stat, text: rank === 1 ? best : good };
  }
  return badge;
}

// The shop's suggestion while the order is made; a tap opens the Shop's hangar with that aircraft picked.
let tipText = null;
export function showHangarTip(hint) {
  // a toast takes the same spot, and says the more pressing thing
  const text = $('toast').hidden ? hint : null;
  if (text === tipText) return;
  tipText = text;
  const tip = $('hangarTip');
  tip.hidden = !text;
  band.tip = 0;
  if (text) {
    tip.textContent = text;
    tip.style.top = view.top + HANGAR.tipGap + 'px';
    band.tip = view.top + HANGAR.tipGap + tip.offsetHeight;
  }
}

function setControls(mode) {
  settings.controls = mode;
  saveSettings();
  markControls();
  applyControls();
}

function showDev() {
  document.body.classList.toggle('dev', settings.dev);
  $('dev').hidden = !settings.dev;
  $('devForm').hidden = settings.dev;
  $('devMsg').textContent = settings.dev ? 'Developer mode is on.' : '';
}

export function initSheet() {
  buildStickOptions();
  markControls();
  buildPicture();
  buildCamera();
  buildSideways();
  buildSwitch('musicModes', 'music');
  // a buzz says what On means
  buildSwitch('vibeModes', 'vibration', on => on && buzz(PERFECT.buzz));
  showDev();
  $('gear').addEventListener('click', openSheet);
  $('mute').classList.toggle('off', settings.muted);
  // On and Off for every sound; M, the pause card's Sound and this switch stay in step
  const markSound = () => { for (const b of $('soundModes').children) b.setAttribute('aria-pressed', String((b.dataset.value === 'on') === !settings.muted)); };
  const flipMute = () => {
    toggleMute();
    $('mute').classList.toggle('off', settings.muted);
    markSound();
  };
  for (const [value, label] of [['on', 'On'], ['off', 'Off']]) {
    const b = document.createElement('button');
    b.textContent = label;
    b.dataset.value = value;
    b.addEventListener('click', () => { if ((value === 'on') === settings.muted) flipMute(); });
    $('soundModes').appendChild(b);
  }
  markSound();
  $('mute').addEventListener('click', flipMute);
  addEventListener('keydown', e => {
    if (e.code === 'KeyM' && !e.repeat && e.target?.tagName !== 'INPUT') flipMute();
  });
  $('sheetClose').addEventListener('click', () => { $('sheet').hidden = true; });
  $('ctlJoy').addEventListener('click', () => setControls('joystick'));
  $('ctlArrows').addEventListener('click', () => setControls('arrows'));
  $('devForm').addEventListener('submit', e => {
    e.preventDefault();
    const code = $('devCode');
    if (devHash(code.value) === DEV.hash) {
      settings.dev = true;
      saveSettings();
      showDev();
      if (levelsOpen()) showLevels();
    } else $('devMsg').textContent = 'Wrong password. Try again.';
    code.value = '';
  });
}

// A fingerprint of the developer password, so only the fingerprint is written in config.js.
function devHash(code) {
  const fnv = s => {
    let h = 0x811c9dc5;
    for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0;
    return h;
  };
  let h = `flying-parcel:${code}`;
  for (let i = 0; i < 2048; i++) h = fnv(`${h}:${i}`).toString(16);
  return h;
}

export function onDevActions(auto, charge) {
  $('devAuto').addEventListener('click', auto);
  $('devCharge').addEventListener('click', charge);
}

export function onStart(fn) {
  $('start').addEventListener('click', fn);
}
