import { JOY } from './config.js';
import { settings } from './storage.js';

// l/r/u/dn/rd/ru are held states, axis is the joystick in -1..1, holdTap and landTap are one-shot presses.
// sink is worked out each step: the DOWN button, or the rope key anywhere the rope has nothing to do.
export const keys = { l: 0, r: 0, u: 0, dn: 0, sink: 0, rd: 0, ru: 0, boost: 0, axis: 0, holdTap: 0, landTap: 0 };

const km = {
  ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'u', KeyW: 'u', Space: 'u',
  ArrowDown: 'rd', KeyS: 'rd', KeyQ: 'ru', KeyE: 'ru',
  ShiftLeft: 'boost', ShiftRight: 'boost', KeyB: 'boost',
};

const HELD = ['lt', 'rt', 'up', 'down', 'boost', 'ropeDown', 'ropeUp'];
const coarse = () => matchMedia('(pointer:coarse)').matches;
const $ = id => document.getElementById(id);

export function applyControls() {
  if (!coarse()) return;
  const joy = settings.controls === 'joystick', { size, fade, hand } = settings.stick, panel = $('controls').style;
  $('joy').hidden = !joy;
  $('arrows').hidden = joy;
  panel.setProperty('--stick', JOY.sizes[size] ?? 1);
  panel.opacity = JOY.fades[fade] ?? 1;
  document.body.classList.toggle('lefty', hand === 'left');
}

function bindHeld(id, k) {
  const el = $(id);
  const on = e => {
    e.preventDefault();
    keys[k] = 1;
    el.classList.add('on');
    try { el.setPointerCapture(e.pointerId); } catch (_) {}
  };
  const off = () => { keys[k] = 0; el.classList.remove('on'); };
  el.addEventListener('pointerdown', on);
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(n => el.addEventListener(n, off));
  el.addEventListener('contextmenu', e => e.preventDefault());
}

let finger = null;

// Nothing stays pressed once the game loses the keyboard or the screen.
function releaseAll() {
  keys.l = keys.r = keys.u = keys.dn = keys.sink = keys.rd = keys.ru = keys.boost = keys.axis = 0;
  finger = null;
  $('knob').style.transform = '';
  for (const id of HELD) $(id).classList.remove('on');
}

function bindJoystick() {
  const joy = $('joy'), knob = $('knob');
  let origin = 0;
  const move = e => {
    const r = joy.getBoundingClientRect(), mid = r.left + r.width / 2, reach = r.width / 2 - knob.offsetWidth / 2 - JOY.knobGap;
    const v = Math.max(-1, Math.min(1, (e.clientX - origin) / reach)), bend = JOY.feels[settings.stick.feel] ?? 1;
    keys.axis = Math.abs(v) < JOY.dead ? 0 : Math.sign(v) * Math.abs(v) ** bend;
    knob.style.transform = `translateX(${Math.max(-reach, Math.min(reach, origin - mid + v * reach))}px)`;
  };
  const end = e => {
    if (e.pointerId !== finger) return;
    finger = null;
    keys.axis = 0;
    knob.style.transform = '';
  };
  joy.addEventListener('pointerdown', e => {
    e.preventDefault();
    finger = e.pointerId;
    const r = joy.getBoundingClientRect();
    origin = settings.stick.origin === 'thumb' ? e.clientX : r.left + r.width / 2;
    try { joy.setPointerCapture(finger); } catch (_) {}
    move(e);
  });
  joy.addEventListener('pointermove', e => { if (e.pointerId === finger) move(e); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(n => joy.addEventListener(n, end));
}

// The game owns the screen: no pinch zoom, double-tap zoom or page scroll, except inside settings.
function lockPage() {
  ['gesturestart', 'gesturechange', 'dblclick'].forEach(n => document.addEventListener(n, e => e.preventDefault()));
  document.addEventListener('touchmove', e => {
    if (!e.target.closest?.('#sheet,#levelsScroll,.modal')) e.preventDefault();
  }, { passive: false });
  addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
}

export function initInput() {
  const touch = coarse();
  $('controls').hidden = false;
  document.body?.classList.toggle('desk', !touch);
  applyControls();

  addEventListener('keydown', e => {
    if (e.target?.tagName === 'INPUT') return;
    if (e.code === 'KeyH' && !e.repeat) keys.holdTap = 1;
    if (e.code === 'KeyL' && !e.repeat) keys.landTap = 1;
    const k = km[e.code];
    if (k) { keys[k] = 1; e.preventDefault(); }
  });
  addEventListener('keyup', e => {
    const k = km[e.code];
    if (k) { keys[k] = 0; e.preventDefault(); }
  });

  [['lt', 'l'], ['rt', 'r'], ['up', 'u'], ['down', 'dn'], ['boost', 'boost'], ['ropeDown', 'rd'], ['ropeUp', 'ru']].forEach(([id, k]) => bindHeld(id, k));
  bindJoystick();
  // a second finger never produces a click, and these buttons are pressed while steering
  [['hold', 'holdTap'], ['land', 'landTap']].forEach(([id, k]) => $(id).addEventListener('pointerdown', e => {
    e.preventDefault();
    keys[k] = 1;
  }));
  lockPage();

  addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) releaseAll();
  });
}
