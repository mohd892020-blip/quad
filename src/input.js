import { JOY } from './config.js';
import { settings } from './storage.js';

// l/r/u/rd/ru are held states, axis is the joystick in -1..1, holdTap is a one-shot press.
export const keys = { l: 0, r: 0, u: 0, rd: 0, ru: 0, boost: 0, axis: 0, holdTap: 0 };

const km = {
  ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'u', KeyW: 'u', Space: 'u',
  ArrowDown: 'rd', KeyS: 'rd', KeyQ: 'ru', KeyE: 'ru',
  ShiftLeft: 'boost', ShiftRight: 'boost', KeyB: 'boost',
};

const HELD = ['lt', 'rt', 'up', 'boost', 'ropeDown', 'ropeUp'];
const coarse = () => matchMedia('(pointer:coarse)').matches;
const $ = id => document.getElementById(id);

export function applyControls() {
  if (!coarse()) return;
  const joy = settings.controls === 'joystick';
  $('joy').hidden = !joy;
  $('arrows').hidden = joy;
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
  keys.l = keys.r = keys.u = keys.rd = keys.ru = keys.boost = keys.axis = 0;
  finger = null;
  $('knob').style.transform = '';
  for (const id of HELD) $(id).classList.remove('on');
}

function bindJoystick() {
  const joy = $('joy'), knob = $('knob');
  const move = e => {
    const r = joy.getBoundingClientRect(), reach = r.width / 2 - JOY.knobInset;
    const v = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / reach));
    keys.axis = Math.abs(v) < JOY.dead ? 0 : v;
    knob.style.transform = `translateX(${v * reach}px)`;
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
  $('keys').hidden = touch;
  document.body?.classList.toggle('desk', !touch);
  applyControls();

  addEventListener('keydown', e => {
    if (e.target?.tagName === 'INPUT') return;
    if (e.code === 'KeyH' && !e.repeat) keys.holdTap = 1;
    const k = km[e.code];
    if (k) { keys[k] = 1; e.preventDefault(); }
  });
  addEventListener('keyup', e => {
    const k = km[e.code];
    if (k) { keys[k] = 0; e.preventDefault(); }
  });

  [['lt', 'l'], ['rt', 'r'], ['up', 'u'], ['boost', 'boost'], ['ropeDown', 'rd'], ['ropeUp', 'ru']].forEach(([id, k]) => bindHeld(id, k));
  bindJoystick();
  // a second finger never produces a click, and this button is pressed while steering
  $('hold').addEventListener('pointerdown', e => {
    e.preventDefault();
    keys.holdTap = 1;
  });
  lockPage();

  addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) releaseAll();
  });
}
