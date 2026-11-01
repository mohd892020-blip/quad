import { toggleMute } from './audio.js';
import { AIRCRAFT, BADGE, DEV, DUST, FX, G, HEALTH, LEVELS, MISSION, POINTER, QUALITY, ROPE, ROPE_CTL, SHAKE, VIEW, WIND } from './config.js';
import { applyControls } from './input.js';
import { loadProgress, saveSettings, settings } from './storage.js';

const $ = id => document.getElementById(id);

const cv = $('c');
export const ctx = cv.getContext('2d');

/* ---------- view ---------- */
export const view = { W: 0, H: 0, DPR: 1, S: 1, viewW: 0, viewH: 0, cam: null, lowQ: false, top: 140, bottom: 600, floorGap: 0 };

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
const placeName = t => (t.kind === 'bal' ? `Balcony, floor ${t.fl}` : t.kind === 'street' ? 'Street' : 'Rooftop');

export function hud(st) {
  const tag = st.level ? `Level ${st.level.n} · ` : '';
  $('money').firstChild.nodeValue = `$${st.money}`;
  $('del').textContent = `${st.del} ${st.del === 1 ? 'delivery' : 'deliveries'}`;
  const clock = $('clock'), o = st.has ? st.order : null;
  const left = o ? Math.max(0, o.deadline - st.t) : st.prep ? st.prep.left : 0, whole = Math.ceil(left);
  clock.textContent = o || st.prep ? `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}` : '--:--';
  clock.classList.toggle('low', !!o && left < MISSION.lowTime);
  $('bBat').firstChild.style.width = st.d.bat + '%';
  $('bHp').firstChild.style.width = st.hp + '%';
  $('bHeat').firstChild.style.width = (o && st.item.heat ? st.heat : 0) + '%';
  $('bBox').firstChild.style.width = (o ? st.integ : 0) + '%';
  $('bBoost').firstChild.style.width = st.boost + '%';
  $('bRope').firstChild.style.width = (st.ropeLen - ROPE) / (ROPE_CTL.max - ROPE) * 100 + '%';
  const reach = WIND.base + WIND.maxDeliveries * WIND.perDelivery;
  $('windNeedle').style.left = 50 + Math.max(-1, Math.min(1, st.wind / reach)) * 50 + '%';
  view.top = $('hud').getBoundingClientRect().bottom || view.top;
  const tops = [$('boost'), $('up')].map(e => e.getBoundingClientRect().top).filter(Boolean);
  view.bottom = tops.length ? Math.min(...tops) - 8 : view.H - POINTER.bottomGap;
  view.floorGap = matchMedia('(pointer:coarse)').matches ? (view.H - view.bottom) / view.S : 0;
  $('toast').style.top = view.top + 12 + 'px';
  if (o) {
    const t = o.t, item = st.item, dist = Math.round(Math.abs(t.x - st.d.x) / 10);
    $('oTitle').textContent = `${tag}${item.urgent ? `${item.label} · URGENT` : item.label}`;
    $('oSub').textContent = `${o.shop.shop.name} → ${placeName(t)} · ${dist} m`;
  } else if (st.prep) {
    $('oTitle').textContent = `${tag}Preparing ${st.prep.item.label}`;
    $('oSub').textContent = `${st.prep.shop.shop.name} · Stay on the pad`;
  } else if (st.level) {
    $('oTitle').textContent = `Level ${st.level.n}`;
    $('oSub').textContent = `Land on the green pad at ${st.level.shop.shop.name}`;
  } else {
    $('oTitle').textContent = 'Free Roam';
    $('oSub').textContent = 'Land on the green pad of any shop';
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

export function showActions(zone, anchored, boosting) {
  const boost = $('boost');
  if (boost.classList.contains('on') !== boosting) boost.classList.toggle('on', boosting);
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
const MODALS = ['levels', 'levelCard', 'resultCard'];
export const modalOpen = () => sheetOpen() || MODALS.some(id => !$(id).hidden);

/* ---------- levels ---------- */
let levelList = [], acts = {}, picked = null, resultLevel = null;
const starText = n => '★'.repeat(n) + '☆'.repeat(3 - n);
const clockText = s => `${Math.floor(Math.ceil(s) / 60)}:${String(Math.ceil(s) % 60).padStart(2, '0')}`;
// The first level without a star is the furthest one open.
function reachedLevel(stars) {
  let n = 1;
  while (stars[n]) n++;
  return n;
}

export function hideModals() {
  for (const id of MODALS) $(id).hidden = true;
}

export function showLevels() {
  hideModals();
  const { stars, money } = loadProgress(), open = reachedLevel(stars), gap = LEVELS.rowGap;
  const height = (levelList.length + 1) * gap;
  const spot = l => ({ x: 50 + Math.sin(l.n * .85) * 30, y: height - l.n * gap });
  const road = levelList.map(l => { const p = spot(l); return `${p.x},${p.y}`; }).join(' ');
  const nodes = levelList.map(l => {
    const p = spot(l), best = stars[l.n] || 0;
    const state = l.n > open ? 'locked' : l.n === open ? 'next' : 'done';
    return `<button class="node ${state}" data-n="${l.n}" style="left:${p.x}%;top:${p.y}px;--zone:${l.shop.zone.map}" aria-label="Level ${l.n}"><b>${l.n}</b><small>${best ? starText(best) : ''}</small></button>`;
  }).join('');
  const path = $('levelsPath');
  path.style.height = height + 'px';
  path.innerHTML = `<svg viewBox="0 0 100 ${height}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${road}"/></svg>${nodes}`;
  $('levelsMoney').textContent = `$${money}`;
  $('levels').hidden = false;
  const scroll = $('levelsScroll');
  scroll.scrollTop = height - open * gap - (scroll.clientHeight || 0) / 2;
}

function openLevelCard(n) {
  const l = levelList[n - 1], { stars } = loadProgress(), open = reachedLevel(stars), i = l.item;
  picked = l;
  $('levelTitle').textContent = `Level ${n}`;
  $('levelBest').textContent = stars[n] ? starText(stars[n]) : '☆☆☆';
  const rows = [
    ['Order', i.urgent ? `${i.label} · urgent` : i.label], ['Shop', `${l.shop.shop.name}, ${l.shop.zone.name}`], ['Preparing', `${i.prep} s`],
    ['Customer', `${placeName(l.t)}, ${Math.round(l.dist / 10)} m`], ['Time', clockText(l.limit)], ['If ruined', `-$${i.price}`],
    ['Wind', `up to ${l.wind}`], ['Hawks', l.hawks || 'None'], ['Rival', l.rival ? `Yes, speed ${l.rivalSpeed}` : 'None'],
  ];
  $('levelRows').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  const locked = n > open;
  $('levelPlay').disabled = locked;
  $('levelPlay').textContent = locked ? `Finish level ${open} first` : 'Start';
  $('levelCard').hidden = false;
}

export function showResult(o, level, hasNext) {
  resultLevel = level;
  const card = $('resultCard');
  card.classList.toggle('bad', !o.passed);
  $('resultTitle').textContent = o.passed ? 'MISSION PASSED' : 'MISSION FAILED';
  $('resultStars').textContent = o.passed ? starText(o.stars) : '';
  $('resultWhy').textContent = o.passed ? `+$${o.tip}${o.beat ? ' · Rival beaten' : ''}` : o.cost ? `${o.why} · -$${o.cost}` : o.why;
  $('resultNext').hidden = !o.passed || !hasNext;
  card.hidden = false;
}

export function initLevels(levels, handlers) {
  levelList = levels;
  acts = handlers;
  $('levelsPath').addEventListener('click', e => {
    const n = e.target.closest?.('[data-n]')?.dataset.n;
    if (n) openLevelCard(+n);
  });
  $('levelClose').addEventListener('click', () => { $('levelCard').hidden = true; });
  $('levelPlay').addEventListener('click', () => acts.play(picked));
  $('freeRoam').addEventListener('click', () => acts.play(null));
  $('levelsGear').addEventListener('click', () => { $('sheet').hidden = false; });
  $('toMap').addEventListener('click', showLevels);
  $('resultNext').addEventListener('click', () => acts.play(levelList[resultLevel.n]));
  $('resultRetry').addEventListener('click', () => acts.play(resultLevel));
  $('resultMap').addEventListener('click', showLevels);
}
export const previewCanvas = () => $('preview');

function markControls() {
  $('ctlJoy').setAttribute('aria-pressed', settings.controls === 'joystick');
  $('ctlArrows').setAttribute('aria-pressed', settings.controls === 'arrows');
}

// Read from the numbers, so a rebalanced model gets a true badge without touching this.
function badgeFor(m) {
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

function markPlanes() {
  for (const b of $('planes').children) b.setAttribute('aria-pressed', b.dataset.key === settings.plane);
  const m = AIRCRAFT.find(a => a.key === settings.plane) || AIRCRAFT[0];
  $('planeNote').textContent = m.note;
  const rows = [['Power', m.thrust, 1.6], ['Speed', m.speed, 1.7], ['Battery', m.battery, 1.4], ['Toughness', m.tough, 1.9]];
  const pitch = m.hz[0] < 90 ? 'Deep rumble' : m.hz[0] < 160 ? 'Steady hum' : m.hz[0] < 250 ? 'Light buzz' : 'High whine';
  $('planeStats').innerHTML = rows.map(([name, v, top]) => `<span>${name}</span><i><b style="width:${v / top * 100}%"></b></i>`).join('') + `<span>Sound</span><em>${pitch}</em>`;
}

// A pulsing dot on settings, plus the shop's suggestion while the order is made.
let tipText = null;
export function showHangarTip(text) {
  if (text === tipText) return;
  tipText = text;
  const tip = $('hangarTip');
  tip.hidden = !text;
  if (text) {
    tip.textContent = text;
    tip.style.top = view.top + 76 + 'px';
    $('gear').classList.add('dot');
  }
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
    const b = document.createElement('button'), badge = badgeFor(a);
    b.innerHTML = `${a.name}<small class="${badge.stat}">${badge.text}</small>`;
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
  const openSheet = () => {
    $('sheet').hidden = false;
    $('gear').classList.remove('dot');
  };
  $('gear').classList.add('dot');
  $('gear').addEventListener('click', openSheet);
  $('hangarTip').addEventListener('click', openSheet);
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
