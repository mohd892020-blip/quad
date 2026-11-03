import { drawBoost, drawCars, drawEagles, drawHawks, drawRival, stepAction, stepEagles, stepTraffic } from './action.js';
import { initAudio, sfx, updateRotor } from './audio.js';
import { beginChallenge, drawChallenge, drawWeather, stepChallenge } from './challenge.js';
import { stepContrast } from './contrast.js';
import { drawCloudsBack, drawCloudsFront, drawFallBehind, drawFallFront, drawFog, drawHighClouds, drawOvercast, stepClouds } from './weather.js';
import { updateMusic } from './music.js';
import { BEACH, CAMERA, CITY_SEED, DRONE, DUST, FIXED_DT, GROUND, HANGAR, HUD_INTERVAL, MAX_FRAME_DT, MUSIC, QUALITY } from './config.js';
import { settings as picked } from './storage.js';
import { initLeague } from './league.js';
import { buildLevels } from './levels.js';
import {
  autoDeliver, chargeDrone, drawBatteryCue, drawHalos, drawOrderTime, drawPointer, drawPrep, drawTarget, explode, failMission, hangarHint, newGame, prepareFirstOrder, restrain, stepHealth, stepCargo,
  stepMission, stepShop, strikeDown, zones,
} from './delivery.js';
import { currentModel, drawAirframe, drawDrone, drawShadow, rotorLoad, stepBoost, stepDrone, stepHold, stepLand } from './drone.js';
import { beginTraining, drawLesson, stepTraining, trainingLevel } from './training.js';
import { initInput, keys, PARKED } from './input.js';
import { drawRope, stepRope, stepRopeLength } from './rope.js';
import { initShop } from './shop.js';
import { drawSandstorm, touchesSink } from './desert.js';
import { touchesRiver } from './forest.js';
import { stepDraft, touchesIce } from './alpine.js';
import { drawShotBars, stepCamera } from './camera.js';
import { touchesSea } from './seaside.js';
import { loadProgress, settings } from './storage.js';
import {
  ctx, drawFx, drawMarks, frost, hideModals, hideOverlay, hud, initLevels, initSheet, kickDust, levelsOpen, lowerQuality, measureHud, modalOpen, onDevActions, onStart,
  previewCanvas, raiseQuality, setZoom, shakeOffset, sheetOpen, showActions, showHangarTip, showKeyHints, showLesson, showLevels, showResult, stepFx, view,
} from './ui.js';
import { world, drawCity, drawMap, drawSky, dropSprites, genWorld, stepClock, stepWind } from './world.js';

let st = null, hudT = 0, last = performance.now(), levels = [];
const pace = { t: 0, n: 0, even: 0, last: 0, easy: 0, raised: false, tried: false };

const controls = () => (st.prep?.opening || st.falling ? PARKED : keys);

export function step(dt) {
  st.t += dt;
  stepClock(dt);
  stepChallenge(st, dt);
  stepWind(st, dt);
  stepDraft(st);
  if (stepTraffic(st, dt)) failMission(st, 'Traffic stopped', st.has);
  stepHealth(st, dt);
  if (stepEagles(st, dt) && st.has) strikeDown(st);
  if (st.wreck) {
    stepCamera(st, dt);
    stepFx(st, dt);
    return;
  }
  const zone = zones(st), pilot = controls();
  if (st.prep?.opening) restrain(st, keys);
  keys.sink = keys.dn || (keys.rd && !zone.rope) ? 1 : 0;
  stepHold(st, pilot, zone.hold);
  stepLand(st, pilot, zone.land);
  stepRopeLength(st, pilot, zone, dt);
  stepBoost(st, pilot, dt);
  const fall = st.d.vy;
  const grounded = stepDrone(st, pilot, dt);
  if (grounded && !st.onGround && fall > DUST.minSpeed) kickDust(st, st.d.x, st.d.y + DRONE.radius, fall);
  st.onGround = grounded;
  if (grounded && st.falling) explode(st);
  if (st.has) {
    stepRope(st, dt);
    stepCargo(st, dt);
  }
  stepMission(st, dt);
  if (stepAction(st, dt) && st.has) failMission(st, 'The rival got there first');
  stepShop(st, grounded, dt);
  const lost = st.outcome || st.done ? null : touchesSea(st) ? 'Lost at sea' : touchesSink(st) ? 'Lost in quicksand' : touchesRiver(st) ? 'Lost in the river' : touchesIce(st) ? 'Through the ice' : null;
  if (lost) {
    kickDust(st, st.d.x, GROUND, BEACH.splash);
    sfx('box');
    failMission(st, lost, st.has);
  }
  if (st.lesson) stepTraining(st, zone, dt);
  stepCamera(st, dt);
  stepFx(st, dt);
  stepContrast(st, dt);
  stepClouds(st, dt);
}

function rememberPose() {
  const { t, cam, d, box, has } = st;
  st.prev = { t, camX: cam.x, camY: cam.y, camZ: cam.z, x: d.x, y: d.y, a: d.a, boxX: box.x, boxY: box.y, has };
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
    cam: { ...st.cam, x: mix(p.camX, st.cam.x), y: mix(p.camY, st.cam.y), z: mix(p.camZ ?? st.cam.z, st.cam.z) },
    d: { ...st.d, x: mix(p.x, st.d.x), y: mix(p.y, st.d.y), a: mix(p.a, st.d.a) },
    // a box picked up this step teleported to the drone, so it has nothing to blend from
    box: p.has ? { ...st.box, x: mix(p.boxX, st.box.x), y: mix(p.boxY, st.box.y) } : st.box,
  };
}

function render() {
  const s = blended();
  ctx.setTransform(view.DPR, 0, 0, view.DPR, 0, 0);
  setZoom(s.cam.z || 1, st.cam.sharp || 1);
  view.cam = s.cam;
  drawSky(s);
  drawHighClouds(s);
  drawOvercast(s);
  ctx.save();
  if (s.shake) ctx.translate(...shakeOffset(s));
  drawCity(s);
  drawCars(s);
  drawFog(s);
  drawFallBehind(s);
  drawChallenge(s);
  drawMarks(s);
  drawHalos(s);
  if (!s.wreck) drawShadow(s);
  drawTarget(s);
  drawLesson(s);
  drawRival(s);
  drawCloudsBack(s);
  drawRope(s);
  drawBoost(s);
  drawDrone(s);
  drawCloudsFront(s);
  drawFallFront(s);
  drawPrep(s);
  drawHawks(s);
  drawEagles(s);
  drawFx(s);
  drawSandstorm(s);
  drawWeather(s);
  ctx.restore();
  drawShotBars(s);
  drawPointer(s);
  drawBatteryCue(s);
  drawOrderTime(s);
}

let previewAt = 0;
function drawPreview(time) {
  if (time - previewAt < HANGAR.previewEvery) return;
  previewAt = time;
  const c = previewCanvas(), g = c.getContext('2d'), k = c.height / HANGAR.previewHeight;
  g.setTransform(k, 0, 0, k, c.width / 2, c.height / 2);
  g.clearRect(-c.width, -c.height, c.width * 2, c.height * 2);
  drawAirframe(g, settings.plane, time);
}

// Finds the sharpest picture the device keeps up with, and moves further the further off it is.
function watchPace(frame) {
  const c = QUALITY;
  if (frame > c.maxFrameGap || picked.picture === 'saver') return;
  if (Math.abs(frame - pace.last) < c.evenGap) pace.even++;
  pace.last = frame;
  pace.t += frame;
  pace.n++;
  if (pace.t < c.window) return;
  // a sharp picture only gives way when the game is close to unplayable
  const avg = pace.t / pace.n, capped = avg < c.capFrame && pace.even / pace.n > c.evenShare, slow = avg > (picked.picture === 'sharp' ? c.awfulFrame : c.slowFrame) && !capped, { raised } = pace;
  pace.t = pace.n = pace.even = 0;
  pace.raised = false;
  if (slow) {
    pace.easy = 0;
    pace.tried = true;
    lowerQuality(avg > c.awfulFrame && !raised ? 2 : 1);
  } else if (avg >= c.easyFrame) {
    pace.easy = 0;
    return;
  } else if (pace.tried || ++pace.easy < c.calm) return;
  else {
    pace.tried = true;
    pace.raised = raiseQuality();
  }
  dropSprites();
}
function loop(now) {
  const frame = (now - last) / 1000;
  const dt = Math.min(MAX_FRAME_DT, frame);
  last = now;
  const paused = modalOpen();
  frost(paused && !levelsOpen());
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
  updateRotor(!paused && !st.wreck && !st.falling && st.d.bat > 0, rotorLoad(st, controls()), currentModel());
  updateMusic(musicState(paused));
  requestAnimationFrame(loop);
}

function start(level) {
  st = newGame(level);
  hideModals();
  last = performance.now();
  pace.t = pace.n = pace.even = 0;
  showLesson();
  beginChallenge(st);
  if (level.training) beginTraining(st);
  else {
    showKeyHints();
    prepareFirstOrder(st);
  }
  hud(st);
  measureHud();
  drawMap(st);
}

// Walking out on an order in the air costs the same as ruining it.
function leave() {
  if (st?.has) failMission(st, 'Left the mission', true);
}

// Idle demo city behind the start card, until play begins.
const demo = { x: 0, at: performance.now() };
// What the music follows: where the mission is, the time of day, and how the flight is going.
function musicState(paused) {
  const l = st.level, d = st.d, o = st.has ? st.order : null, left = o ? o.deadline - st.t : Infinity;
  return {
    active: !st.done && !st.outcome, paused, place: l.beach ? 'beach' : l.desert ? 'desert' : l.forest ? 'forest' : 'city', time: Math.floor(world.palKey) % 3,
    alt: Math.max(0, Math.min(1, (GROUND - d.y) / MUSIC.altSpan)), speed: Math.min(1, Math.hypot(d.vx, d.vy) / MUSIC.fastSpeed), wind: l.wind ? Math.min(1, Math.abs(st.wind) / l.wind) : 0,
    danger: Math.max(left < MUSIC.lateSecs ? 1 - left / MUSIC.lateSecs : 0, st.batWarn > 1 ? 1 : st.batWarn ? .5 : 0), boosting: st.boosting, holding: !!st.anchor,
  };
}

function idle(now = demo.at) {
  if (st) { requestAnimationFrame(loop); return; }
  updateMusic({ active: false, paused: false, place: 'city', time: Math.floor(world.palKey) % 3, alt: .3, speed: 0, wind: 0, danger: 0 });
  const frame = (now - demo.at) / 1000, dt = Math.min(MAX_FRAME_DT, frame);
  demo.at = now;
  if (!levelsOpen()) {
    watchPace(frame);
    ctx.setTransform(view.DPR, 0, 0, view.DPR, 0, 0);
    setZoom(1, 1);
    demo.x += CAMERA.idleSpeed * dt;
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
