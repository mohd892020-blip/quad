import { toggleMute } from './audio.js';
import { AIRCRAFT, DEV, DUST, FX, G, MISSION, QUALITY, ROPE, ROPE_CTL, SHAKE, VIEW, WIND } from './config.js';
import { applyControls } from './input.js';
import { saveSettings, settings } from './storage.js';

const $ = id => document.getElementById(id);

const cv = $('c');
export const ctx = cv.getContext('2d');

/* ---------- view ---------- */
export const view = { W: 0, H: 0, DPR: 1, S: 1, viewW: 0, viewH: 0, cam: null, lowQ: false, top: 140 };

function resize() {
  // a hidden frame reports zero size; keep the last real one or the camera turns to NaN
  if (!innerWidth || !innerHeight) return;
  view.DPR = view.lowQ ? QUALITY.lowDPR : Math.min(VIEW.maxDPR, window.devicePixelRatio || 1);
  view.W = innerWidth;
  view.H = innerHeight;
  cv.width = Math.round(view.W * view.DPR);
  cv.height = Math.round(view.H * view.DPR);
  view.S = Math.min(view.H / VIEW.refH, view.W / VIEW.refW);
  view.viewW = view.W / view.S;
  view.viewH = view.H / view.S;
}
addEventListener('resize', resize);
resize();

export function setLowQ() {
  view.lowQ = true;
  resize();
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
export function pop(st, x, y, txt, col) {
  st.pops.push({ x, y, txt, col, t: 0 });
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

export function stepFx(st, dt) {
  const drag = Math.pow(DUST.drag, dt);
  for (const q of st.dust) {
    q.t += dt;
    q.vx *= drag;
    q.vy *= drag;
    q.x += (q.vx + st.wind * FX.steamDrift) * dt;
    q.y += q.vy * dt;
  }
  st.dust = st.dust.filter(q => q.t < q.life);
  for (const q of st.pops) q.t += dt;
  st.pops = st.pops.filter(q => q.t < FX.popLife);
  for (const q of st.parts) {
    q.t += dt;
    if (q.crumb) { q.vy += G * dt; q.x += q.vx * dt; }
    else q.x += st.wind * FX.steamDrift * dt;
    q.y += q.vy * dt;
  }
  st.parts = st.parts.filter(q => q.t < (q.crumb ? FX.crumbLife : FX.steamLife));
}

export function drawFx(st) {
  const { W, H, S } = view;
  for (const q of st.dust) {
    const age = q.t / q.life;
    ctx.fillStyle = `rgba(216,187,152,${DUST.alpha * (1 - age)})`;
    ctx.beginPath();
    ctx.arc(X(q.x), Y(q.y), (DUST.sizeStart + age * DUST.sizeGrow) * S, 0, 7);
    ctx.fill();
  }
  for (const q of st.parts) {
    if (q.crumb) {
      ctx.fillStyle = q.t < .6 ? '#ffc23d' : '#e8492c';
      ctx.fillRect(X(q.x), Y(q.y), 3 * S, 3 * S);
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
  ctx.textAlign = 'center';
  for (const q of st.pops) {
    ctx.globalAlpha = Math.min(1, 2 * (FX.popLife - q.t));
    ctx.font = `${Math.round(20 * S)}px Lalezar,Tajawal,sans-serif`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(20,15,40,.8)';
    ctx.strokeText(q.txt, X(q.x), Y(q.y - q.t * 40));
    ctx.fillStyle = q.col;
    ctx.fillText(q.txt, X(q.x), Y(q.y - q.t * 40));
  }
  ctx.globalAlpha = 1;
}

/* ---------- HUD ---------- */
export function hud(st) {
  $('money').firstChild.nodeValue = `$${st.money}`;
  $('del').textContent = `${st.del} ${st.del === 1 ? 'delivery' : 'deliveries'}${st.combo ? ` · x${st.combo}` : ''}`;
  const clock = $('clock'), o = st.has ? st.order : null;
  const left = o ? Math.max(0, o.deadline - st.t) : 0, whole = Math.ceil(left);
  clock.textContent = o ? `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}` : '--:--';
  clock.classList.toggle('low', !!o && left < MISSION.lowTime);
  $('bBat').firstChild.style.width = st.d.bat + '%';
  $('bHeat').firstChild.style.width = (o && st.item.heat ? st.heat : 0) + '%';
  $('bBox').firstChild.style.width = (o ? st.integ : 0) + '%';
  $('bBoost').firstChild.style.width = st.boost + '%';
  $('bRope').firstChild.style.width = (st.ropeLen - ROPE) / (ROPE_CTL.max - ROPE) * 100 + '%';
  const reach = WIND.base + WIND.maxDeliveries * WIND.perDelivery;
  $('windNeedle').style.left = 50 + Math.max(-1, Math.min(1, st.wind / reach)) * 50 + '%';
  view.top = $('hud').getBoundingClientRect().bottom || view.top;
  $('toast').style.top = view.top + 12 + 'px';
  if (o) {
    const t = o.t, item = st.item, dist = Math.round(Math.abs(t.x - st.d.x) / 10);
    const place = t.kind === 'bal' ? `Balcony, floor ${t.fl}` : t.kind === 'street' ? 'Street' : 'Rooftop';
    $('oTitle').textContent = item.urgent ? `${item.label} · URGENT` : item.label;
    $('oSub').textContent = `${o.shop.shop.name} → ${place} · ${dist} m`;
  } else {
    $('oTitle').textContent = 'Find a job';
    $('oSub').textContent = 'Fly into a yellow beacon on a shop roof';
  }
}

let toastTimer = 0;
export function showToast(title, detail, good) {
  const el = $('toast');
  $('toastTitle').textContent = title;
  $('toastWhy').textContent = detail;
  el.classList.toggle('bad', !good);
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, MISSION.toastMs);
}

export function hideOverlay() {
  $('overlay').hidden = true;
}

// Writes only on change: this runs every frame.
function show(id, on) {
  const el = $(id);
  if (el.hidden === on) el.hidden = !on;
}

export function showActions(zone, anchored) {
  show('ropeDown', zone.rope);
  show('ropeUp', zone.rope);
  show('hold', zone.hold || anchored);
  const hold = $('hold'), label = anchored ? 'Release' : 'Hold';
  if (hold.textContent !== label) {
    hold.textContent = label;
    hold.classList.toggle('on', anchored);
  }
}

/* ---------- settings ---------- */
export const sheetOpen = () => !$('sheet').hidden;
export const previewCanvas = () => $('preview');

function markControls() {
  $('ctlJoy').setAttribute('aria-pressed', settings.controls === 'joystick');
  $('ctlArrows').setAttribute('aria-pressed', settings.controls === 'arrows');
}

function markPlanes() {
  for (const b of $('planes').children) b.setAttribute('aria-pressed', b.dataset.key === settings.plane);
}

function setControls(mode) {
  settings.controls = mode;
  saveSettings();
  markControls();
  applyControls();
}

function showDev() {
  $('dev').hidden = !settings.dev;
  $('devForm').hidden = settings.dev;
  $('devMsg').textContent = settings.dev ? 'Developer mode is on.' : '';
}

export function initSheet() {
  const planes = $('planes');
  for (const a of AIRCRAFT) {
    const b = document.createElement('button');
    b.textContent = a.name;
    b.dataset.key = a.key;
    b.addEventListener('click', () => {
      settings.plane = a.key;
      saveSettings();
      markPlanes();
    });
    planes.appendChild(b);
  }
  markPlanes();
  markControls();
  showDev();
  $('gear').addEventListener('click', () => { $('sheet').hidden = false; });
  $('mute').classList.toggle('off', settings.muted);
  const flipMute = () => {
    toggleMute();
    $('mute').classList.toggle('off', settings.muted);
  };
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
    if (code.value === DEV.password) {
      settings.dev = true;
      saveSettings();
      showDev();
    } else $('devMsg').textContent = 'Wrong password. Try again.';
    code.value = '';
  });
}

export function onDevActions(auto, charge) {
  $('devAuto').addEventListener('click', auto);
  $('devCharge').addEventListener('click', charge);
}

export function onStart(fn) {
  $('start').addEventListener('click', fn);
}
