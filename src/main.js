import { drawBoost, drawCars, drawHawks, drawRival, stepAction, stepTraffic } from './action.js';
import { initAudio, sfx, updateRotor } from './audio.js';
import { BEACH, CAMERA, CITY_SEED, DRONE, DUST, FIXED_DT, GROUND, HANGAR, HUD_INTERVAL, MAX_FRAME_DT, QUALITY } from './config.js';
import { initLeague } from './league.js';
import { buildLevels } from './levels.js';
import {
  autoDeliver, chargeDrone, drawBatteryCue, drawHalos, drawHeading, drawOrderTime, drawPointer, drawPrep, drawTarget, failMission, hangarHint, newGame, stepHealth, stepCargo, stepHeading, stepMission,
  stepShop, zones,
} from './delivery.js';
import { currentModel, drawAirframe, drawDrone, drawShadow, rotorLoad, stepBoost, stepDrone, stepHold, stepLand } from './drone.js';
import { beginTraining, drawLesson, stepTraining, trainingLevel } from './training.js';
import { initInput, keys } from './input.js';
import { drawRope, stepRope, stepRopeLength } from './rope.js';
import { initShop } from './shop.js';
import { drawSandstorm, touchesSink } from './desert.js';
import { touchesSea } from './seaside.js';
import { loadProgress, settings } from './storage.js';
import {
  ctx, drawFx, drawMarks, hideModals, hideOverlay, hud, initLevels, initSheet, kickDust, levelsOpen, lowerQuality, lowestTier, measureHud, modalOpen, onDevActions, onStart,
  previewCanvas, shakeOffset, sheetOpen, showActions, showHangarTip, showLesson, showLevels, showResult, stepFx, view,
} from './ui.js';
import { drawCity, drawMap, drawSky, dropSprites, genWorld, stepCamera, stepClock, stepWind } from './world.js';

let st = null, hudT = 0, last = performance.now(), levels = [];
const pace = { t: 0, n: 0 };

function step(dt) {
  st.t += dt;
  stepClock(dt);
  stepWind(st, dt);
  if (stepTraffic(st, dt)) failMission(st, 'Traffic stopped', st.has);
  stepHealth(st, dt);
  if (st.wreck) {
    stepCamera(st, dt);
    stepFx(st, dt);
    return;
  }
  const zone = zones(st);
  stepHold(st, keys, zone.hold);
  stepLand(st, keys, zone.land);
  stepRopeLength(st, keys, zone, dt);
  stepBoost(st, keys, dt);
  const fall = st.d.vy;
  const grounded = stepDrone(st, keys, dt);
  if (grounded && !st.onGround && fall > DUST.minSpeed) kickDust(st, st.d.x, st.d.y + DRONE.radius, fall);
  st.onGround = grounded;
  if (st.has) {
    stepRope(st, dt);
    stepCargo(st, dt);
  }
  stepMission(st, dt);
  if (stepAction(st, dt) && st.has) failMission(st, 'The rival got there first');
  stepShop(st, grounded, dt);
  const lost = st.outcome || st.done ? null : touchesSea(st) ? 'Lost at sea' : touchesSink(st) ? 'Lost in quicksand' : null;
  if (lost) {
    kickDust(st, st.d.x, GROUND, BEACH.splash);
    sfx('box');
    failMission(st, lost, st.has);
  }
  if (st.lesson) stepTraining(st, zone, dt);
  stepHeading(st, dt);
  stepCamera(st, dt);
  stepFx(st, dt);
}

function rememberPose() {
  const { t, cam, d, box, has } = st;
  st.prev = { t, camX: cam.x, camY: cam.y, x: d.x, y: d.y, a: d.a, boxX: box.x, boxY: box.y, has };
}

// A display faster than the physics gets frames with no new step, which would
// freeze the picture. Draw a blend of the last two steps; physics never sees it.
function blended() {
  const p = st.prev;
  if (!p) return st;
  const t = Math.min(1, st.acc / FIXED_DT), mix = (a, b) => a + (b - a) * t;
  return {
    ...st,
    blend: t,
    t: mix(p.t, st.t),
    cam: { x: mix(p.camX, st.cam.x), y: mix(p.camY, st.cam.y) },
    d: { ...st.d, x: mix(p.x, st.d.x), y: mix(p.y, st.d.y), a: mix(p.a, st.d.a) },
    // a box picked up this step teleported to the drone, so it has nothing to blend from
    box: p.has ? { ...st.box, x: mix(p.boxX, st.box.x), y: mix(p.boxY, st.box.y) } : st.box,
  };
}

function render() {
  const s = blended();
  ctx.setTransform(view.DPR, 0, 0, view.DPR, 0, 0);
  view.cam = s.cam;
  drawSky(s);
  ctx.save();
  if (s.shake) ctx.translate(...shakeOffset(s));
  drawCity(s);
  drawCars(s);
  drawMarks(s);
  drawHalos(s);
  if (!s.wreck) drawShadow(s);
  drawTarget(s);
  drawLesson(s);
  drawRival(s);
  drawRope(s);
  drawBoost(s);
  drawDrone(s);
  drawPrep(s);
  drawHawks(s);
  drawHeading(s);
  drawFx(s);
  drawSandstorm(s);
  ctx.restore();
  drawPointer(s);
  drawBatteryCue(s);
  drawOrderTime(s);
}

function drawPreview(time) {
  const c = previewCanvas(), g = c.getContext('2d'), k = c.height / HANGAR.previewHeight;
  g.setTransform(k, 0, 0, k, c.width / 2, c.height / 2);
  g.clearRect(-c.width, -c.height, c.width * 2, c.height * 2);
  drawAirframe(g, settings.plane, time);
}

// Steps quality down when the device cannot keep up.
function watchPace(frame) {
  if (lowestTier() || frame > QUALITY.maxFrameGap) return;
  pace.t += frame;
  pace.n++;
  if (pace.t < QUALITY.window) return;
  if (pace.t / pace.n > QUALITY.slowFrame) {
    lowerQuality();
    dropSprites();
  }
  pace.t = pace.n = 0;
}

function loop(now) {
  const frame = (now - last) / 1000;
  const dt = Math.min(MAX_FRAME_DT, frame);
  last = now;
  const paused = modalOpen();
  if (!paused) watchPace(frame);
  if (sheetOpen()) drawPreview(now / 1000);
  if (!paused) {
    st.acc += dt;
    while (st.acc >= FIXED_DT) {
      rememberPose();
      step(FIXED_DT);
      st.acc -= FIXED_DT;
    }
    hudT += dt;
    if (hudT > HUD_INTERVAL) { hud(st); drawMap(st); hudT = 0; }
    if (st.outcome && st.t >= st.outcome.at) {
      const outcome = st.outcome;
      st.outcome = null;
      st.done = true;
      showResult(outcome, st.level, st.level.n < levels.length);
    }
  }
  // a paused scene does not change, so the last picture stands until the canvas is resized
  if (!paused || view.dirty) {
    render();
    view.dirty = false;
  }
  showActions(zones(st), !!st.anchor, !!st.landing, st.boosting);
  showHangarTip(paused ? null : hangarHint(st));
  updateRotor(!paused && !st.wreck && st.d.bat > 0, rotorLoad(st, keys), currentModel());
  requestAnimationFrame(loop);
}

function start(level) {
  st = newGame(level);
  hideModals();
  last = performance.now();
  pace.t = pace.n = 0;
  showLesson();
  if (level.training) beginTraining(st);
  hud(st);
  measureHud();
  drawMap(st);
}

// Walking out on an order in the air costs the same as ruining it.
function leave() {
  if (st?.has) failMission(st, 'Left the mission', true);
}

// Idle demo city behind the start card, until play begins.
const demo = { x: 0 };
function idle() {
  if (st) { requestAnimationFrame(loop); return; }
  if (!levelsOpen()) {
    ctx.setTransform(view.DPR, 0, 0, view.DPR, 0, 0);
    demo.x += CAMERA.idleSpeed;
    const fake = {
      cam: { x: demo.x - CAMERA.idleLead, y: GROUND + CAMERA.floorBelow - view.viewH },
      t: demo.x / CAMERA.idleTimeDiv, wind: 0,
    };
    view.cam = fake.cam;
    drawSky(fake);
    drawCity(fake);
  }
  if (sheetOpen()) drawPreview(performance.now() / 1000);
  requestAnimationFrame(idle);
}

initInput();
initAudio();
initSheet();
initShop();
initLeague();
onStart(() => {
  hideOverlay();
  // a brand new player flies the lessons first
  if (settings.trained || loadProgress().del) showLevels();
  else start(trainingLevel());
});
onDevActions(() => autoDeliver(st), () => chargeDrone(st));
genWorld(CITY_SEED);
levels = buildLevels();
initLevels(levels, {
  play: start,
  leave,
  retry() {
    leave();
    start(st.level);
  },
  training() {
    leave();
    hideOverlay();
    start(trainingLevel());
  },
  stake: () => (st.has ? Math.min(st.money, st.item.price) : 0),
  level: () => st.level,
});
// building sprites hold shop signs, so repaint them once the web fonts arrive
document.fonts?.ready.then(dropSprites);
idle();
