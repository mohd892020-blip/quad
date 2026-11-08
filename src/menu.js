import { AIRCRAFT, BOX, MENU } from './config.js';
import { drawAirframe } from './drone.js';
import { drawCargoAt } from './rope.js';
import { nudgeShop } from './shop.js';
import { loadProgress, settings } from './storage.js';
import { ctx, glow, hideModals, openSheet, reachedLevel, view } from './ui.js';

// The front screen and the way back from every other: Play Game, Shop, Settings and High Score over the drifting city,
// the aircraft the player flies hovering with a pizza on its rope, and one Back for the arrows, Escape and the phone's own
// Back button.
const $ = id => document.getElementById(id);
export const menuOpen = () => !$('overlay').hidden;
let room = null, floor = 0, still = false, count = 0, busy = () => false;

// the stage is read when the menu shows and when the screen changes, never every frame; on an upright screen the choices
// stand under the aircraft, so the street is raised into them and the rooftops show above them
const measure = () => {
  const r = $('menuStage').getBoundingClientRect(), n = $('menuNav').getBoundingClientRect();
  room = r.width && r.height ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
  floor = innerWidth <= innerHeight && n.height ? Math.max(0, innerHeight - n.top - n.height * MENU.groundAt) : 0;
};
// how far above the screen's foot the menu's street runs, in world units
export const menuFloor = () => floor / view.S;

export function showMenu() {
  hideModals();
  $('sheet').hidden = true;
  $('overlay').hidden = false;
  $('wrap').classList.add('home');
  const { stars, del, money } = loadProgress(), next = reachedLevel(stars);
  $('menuMoney').textContent = `$${money}`;
  $('menuNext').textContent = !settings.trained && !del ? 'Learn to fly first' : next > count ? 'Replay for stars' : `Mission ${next}`;
  measure();
  nudgeShop();
}

export function drawHover(time) {
  if (!room) return;
  const c = MENU, m = AIRCRAFT.find(a => a.key === settings.plane) ?? AIRCRAFT[0], D = view.DPR, T = 2 * Math.PI, move = still ? 0 : 1;
  const k = Math.min(c.maxScale, c.fill * Math.min(room.w / (2 * m.span), room.h / c.tall));
  const x = room.x + room.w / 2, y = room.y + room.h / 2 - c.raise * k + move * Math.sin(time * T / c.bobSecs) * c.bob * k;
  ctx.setTransform(D, 0, 0, D, 0, 0);
  glow(ctx, c.glow, x, y, m.span * k * c.glowSize);
  ctx.setTransform(D * k, 0, 0, D * k, D * x, D * y);
  ctx.rotate(move * Math.sin(time * T / c.tiltSecs) * c.tilt);
  // the order hangs from under the body on its own beat, drawn first so the rope comes out from beneath the aircraft
  ctx.save();
  ctx.translate(0, BOX.anchorY);
  ctx.rotate(move * Math.sin(time * T / c.swingSecs) * c.swing);
  ctx.strokeStyle = c.ropeColor;
  ctx.lineWidth = c.ropeWidth;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, c.rope);
  ctx.stroke();
  ctx.translate(0, c.rope + c.hang);
  drawCargoAt(c.order, c.cargo);
  ctx.restore();
  drawAirframe(ctx, m.key, time);
  ctx.setTransform(D, 0, 0, D, 0, 0);
}

// Back: the topmost screen closes as its own arrow does (the pause card resumes, the result card leads to the map), the
// map goes back to the menu, a flight pauses. On the menu there is nowhere back to go, so the app may close.
const BACKS = [['sheet', 'sheetClose'], ['shop', 'shopClose'], ['league', 'leagueClose'], ['adCard', 'adClose'], ['chapterCard', 'chapterClose'], ['gifts', 'giftsClose'], ['levelCard', 'levelClose'], ['pauseCard', 'pauseBack'], ['resultCard', 'resultMap'], ['levels', 'levelsBack']];
export function goBack() {
  const top = BACKS.find(([id]) => !$(id).hidden);
  if (top) {
    $(top[1]).click();
    return 'back';
  }
  if (menuOpen()) return 'exit';
  // a finished mission waits for its result card, which Back would only cover with the pause card
  if (busy()) return 'back';
  $('toMap').click();
  return 'pause';
}

// busy says when Back should wait: a mission is over and its result card is on its way.
export function initMenu(levels, hooks = {}) {
  count = levels.length;
  busy = hooks.busy || busy;
  $('menuSettings').addEventListener('click', openSheet);
  $('levelsBack').addEventListener('click', showMenu);
  addEventListener('keydown', e => { if (e.code === 'Escape' && !e.repeat && e.target?.tagName !== 'INPUT') goBack(); });
  // the app's Back button asks here first
  globalThis.pizzaBack = goBack;
  still = !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (globalThis.ResizeObserver) new ResizeObserver(measure).observe($('menuStage'));
  addEventListener('resize', measure);
}
