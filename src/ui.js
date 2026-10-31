import { FX, G, VIEW } from './config.js';
import { updateBest } from './storage.js';

const $ = id => document.getElementById(id);

const cv = $('c');
export const ctx = cv.getContext('2d');

/* ---------- view ---------- */
export const view = { W: 0, H: 0, DPR: 1, S: 1, viewW: 0, viewH: 0, cam: null };

function resize() {
  view.DPR = Math.min(VIEW.maxDPR, window.devicePixelRatio || 1);
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

export const X = x => (x - view.cam.x) * view.S;
export const Y = y => (y - view.cam.y) * view.S;

export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = n >> 8 & 255, b = n & 255;
  r = Math.round(r * f); g = Math.round(g * f); b = Math.round(b * f);
  return `rgb(${r},${g},${b})`;
}

/* ---------- popups and particles ---------- */
export function pop(st, x, y, txt, col) {
  st.pops.push({ x, y, txt, col, t: 0 });
}

export function stepFx(st, dt) {
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
  ctx.direction = 'rtl';
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
  $('money').firstChild.nodeValue = `₪${st.money}`;
  $('del').textContent = `${st.del} ${st.del === 1 ? 'توصيلة' : 'توصيلات'}`;
  const left = Math.max(0, st.shift - st.t);
  $('clock').textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
  $('bBat').firstChild.style.width = st.d.bat + '%';
  $('bHeat').firstChild.style.width = (st.has ? st.heat : 0) + '%';
  $('bBox').firstChild.style.width = (st.has ? st.integ : 0) + '%';
  if (st.has && st.order) {
    const t = st.order.t;
    $('oTitle').textContent = `${st.order.name}`;
    $('oSub').textContent = `عمارة ${t.b.idx} · ${t.kind === 'bal' ? `بلكونة الطابق ${t.fl}` : 'على السطح'}`;
  } else {
    $('oTitle').textContent = 'ارجع للمطعم';
    $('oSub').textContent = 'انزل على السطح الأخضر لتستلم الطلب الجاي';
  }
}

export function hideOverlay() {
  $('overlay').hidden = true;
}

export function endShift(st, why) {
  if (st.over) return;
  st.over = true;
  st.running = false;
  const best = updateBest(st.money);
  $('endTitle').textContent = why;
  $('endMoney').textContent = `₪${st.money}`;
  $('endDel').textContent = `${st.del} توصيلات`;
  $('endBest').textContent = st.money > best ? 'رقم قياسي جديد!' : `أفضل نتيجة: ₪${best}`;
  $('cardStart').hidden = true;
  $('cardEnd').hidden = false;
  $('overlay').hidden = false;
}

export function onStart(fn) {
  $('start').addEventListener('click', fn);
  $('again').addEventListener('click', fn);
}
