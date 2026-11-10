import { drawBoost, drawCars, drawEagles, drawHawks, drawRing, drawRival, stepAction, stepCloseCalls, stepEagles, stepSurprises, stepTraffic } from './action.js';
import { initAudio, sfx, updateRotor } from './audio.js';
import { callLive, initCall, stepCall } from './call.js';
import { dropHint, initBoosts, markFlight } from './boosts.js';
import { beginChallenge, drawChallenge, drawWeather, stepChallenge } from './challenge.js';
import { stepContrast } from './contrast.js';
import { drawCloudsBack, drawCloudsFront, drawFallBehind, drawFallFront, drawFog, drawHighClouds, drawOvercast, stepClouds } from './weather.js';
import { updateMusic } from './music.js';
import { BEACH, CAMERA, CITY_SEED, CLOCK, DRONE, DUST, FIXED_DT, GROUND, HUD_INTERVAL, MAX_FRAME_DT, MUSIC, PERFECT, QUALITY, RUSH } from './config.js';
import { notePlay, saveSettings, settings as picked } from './storage.js';
import { initLeague } from './league.js';
import { drawHover, initMenu, menuFloor, menuOpen, showMenu } from './menu.js';
import { initDaily } from './daily.js';
import { beginRush, initRush, rushLevel, stepRush } from './rush.js';
import { nameHomes } from './homes.js';
import { buildLevels, surprisesFor } from './levels.js';
import {
  autoDeliver, breakStreak, chargeDrone, drawBatteryCue, goal, drawHalos, drawOrderTime, drawPointer, drawPrep, drawTarget, explode, failMission, hangarHint, newGame, prepareFirstOrder, restrain, stepHealth, stepCargo,
  stepMission, stepShop, streak, strikeDown, zones,
} from './delivery.js';
import { currentModel, drawDrone, drawShadow, rotorLoad, stepAutoDrop, stepBoost, stepDrone, stepHold, stepLand } from './drone.js';
import { beginTraining, drawLesson, stepTraining, trainingLevel } from './training.js';
import { initInput, keys, PARKED } from './input.js';
import { drawRope, stepRope, stepRopeLength } from './rope.js';
import { drawHangar, initShop, shopOpen } from './shop.js';
import { drawSandstorm, touchesSink } from './desert.js';
import { touchesRiver } from './forest.js';
import { stepDraft, touchesIce } from './alpine.js';
import { stepCamera } from './camera.js';
import { drawForeground } from './skyline.js';
import { touchesSea } from './seaside.js';
import { loadProgress, settings } from './storage.js';
import {
  ctx, drawAltimeter, drawFx, drawMarks, frost, hideModals, hideOverlay, hud, initLevels, initSheet, kickDust, levelsOpen, lowerQuality, measureHud, resize, modalOpen, onDevActions, onStart,
  pagesOpen, raiseQuality, resetWeatherNote, setZoom, shakeOffset, showActions, showHangarTip, showKeyHints, showLesson, showLevels, showResult, stepFx, view,
} from './ui.js';
import { world, drawCity, drawMap, drawSky, dropSprites, genWorld, setClock, stepClock, stepWind } from './world.js';

let st = null, hudT = 0, last = performance.now(), levels = [], spot = null;
// how many times each mission has been started this session, so each try draws its own surprises
const tries = {};
const pace = { t: 0, n: 0, even: 0, last: 0, easy: 0, raised: false, tried: false };

// an order waiting on its call holds the aircraft: the opening one and a later stop's on their pad, one handed on in the air
const waits = () => st.prep?.opening || st.prep?.call || st.ticket?.air;
const controls = () => (waits() || st.falling ? PARKED : keys);
// while it waits, no action button shows, since none would do anything
const STILL = { rope: false, hold: false, land: null };

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
  // once a mission has failed the aircraft holds still where it is until the card shows
  const held = st.outcome && !st.outcome.passed && !st.falling;
  const zone = zones(st), pilot = held ? PARKED : controls();
  if (waits()) restrain(st, keys);
  keys.sink = keys.dn || (keys.rd && !zone.rope) ? 1 : 0;
  stepHold(st, pilot, zone.hold);
  stepLand(st, pilot, zone.land);
  stepAutoDrop(st, pilot, zone, dt);
  // Auto Drop works the rope itself
  if (!st.drop) stepRopeLength(st, pilot, zone, dt);
  stepBoost(st, pilot, dt);
  const fall = st.d.vy;
  if (held) st.d.vx = st.d.vy = 0;
  const grounded = held ? st.onGround : stepDrone(st, pilot, dt);
  if (grounded && !st.onGround && fall > DUST.minSpeed) kickDust(st, st.d.x, st.d.y + DRONE.radius, fall);
  st.onGround = grounded;
  if (grounded && st.falling) explode(st);
  if (st.has) {
    stepRope(st, dt);
    stepCargo(st, dt);
  }
  stepMission(st, dt);
  stepRush(st);
  if (stepAction(st, dt) && st.has) failMission(st, 'The rival got there first');
  stepSurprises(st);
  stepCloseCalls(st);
  // anything that struck this step ends the run of clean deliveries, until the mission is decided
  if (st.hitAt === st.t && !st.outcome && !st.done) breakStreak(st);
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
  setZoom(s.cam.z || 1);
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
  drawRing(s);
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
  drawForeground(s);
  drawPrep(s);
  drawHawks(s);
  drawEagles(s);
  drawFx(s);
  drawSandstorm(s);
  drawWeather(s);
  ctx.restore();
  const spot = drawPointer(s);
  drawAltimeter(s, goal(s));
  drawBatteryCue(s);
  drawOrderTime(s);
  return spot;
}

// Finds the sharpest picture the device keeps up with, and moves further the further off it is.
function watchPace(frame) {
  const c = QUALITY;
  if (frame > c.maxFrameGap || picked.picture === 'saver') return;
  // the first seconds of a mission paint its buildings, and say nothing about the phone
  if (pace.warm > 0) { pace.warm -= frame; return; }
  if (Math.abs(frame - pace.last) < c.evenGap) pace.even++;
  pace.last = frame;
  pace.t += frame;
  pace.n++;
  if (pace.t < c.window) return;
  // a sharp picture only gives way when the game is close to unplayable
  const avg = pace.t / pace.n, capped = avg < c.capFrame && pace.even / pace.n > c.evenShare, slow = avg > (picked.picture === 'sharp' ? c.awfulFrame : c.slowFrame) && !capped, { raised } = pace;
  pace.t = pace.n = pace.even = 0;
  pace.raised = false;
  // the first slow stretch costs the extra detail, for good on this phone; only after that the sharpness
  if (!picked.lite && avg > c.slowFrame && !capped) {
    picked.lite = true;
    saveSettings();
    pace.easy = 0;
    resize();
  } else if (slow) {
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

// A perfect drop slows the world for a moment of real time, easing back at the end. Physics still steps at FIXED_DT;
// only fewer steps run, so every clock in the game slows with it.
function timeRate(dt) {
  if (!st.slow) return 1;
  const c = PERFECT, k = 1 - st.slow / c.slowSecs;
  st.slow = Math.max(0, st.slow - dt);
  return k < c.easeFrom ? c.slowRate : c.slowRate + (1 - c.slowRate) * (k - c.easeFrom) / (1 - c.easeFrom);
}

function loop(now) {
  const frame = (now - last) / 1000;
  const dt = Math.min(MAX_FRAME_DT, frame);
  last = now;
  const paused = modalOpen();
  frost(paused && !levelsOpen());
  if (!paused) watchPace(frame);
  if (shopOpen()) drawHangar(now / 1000);
  if (!paused) {
    st.acc += dt * timeRate(dt);
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
      showResult(outcome, st.level, !st.level.daily && !st.level.rush && st.level.n < levels.length);
    }
  }
  // a paused scene does not change, so the last picture stands until the canvas is resized
  if (!paused || view.dirty) {
    spot = render();
    view.dirty = false;
  }
  // the incoming call runs on real time, so a perfect drop's slow motion never stretches it
  stepCall(st, dt, paused, paused ? null : spot);
  const still = waits(), zone = still ? STILL : zones(st);
  showActions(zone, !still && !!st.anchor, !still && !!st.landing, st.boosting, !still && !!st.drop);
  if (zone.drop) dropHint();
  showHangarTip(paused ? null : hangarHint(st));
  updateRotor(!paused && !st.wreck && !st.falling && st.d.bat > 0, rotorLoad(st, controls()), currentModel());
  updateMusic(musicState(paused));
}

function start(level) {
  // Rush starts a fresh run from its card, the pause card's Retry and the result card's Retry alike
  if (level.rush) level = rushLevel();
  // the teasers count numbered missions played, retries included
  if (!level.daily && !level.rush && !level.training) notePlay();
  st = newGame(level);
  markFlight(st);
  resetWeatherNote();
  // most missions open in daylight; a few keep the sunset or the night, and today's mission picks its own hour
  setClock((level.rush ? RUSH.hour : level.daily ? level.daily.time : CLOCK.night.includes(level.n) ? 1 : CLOCK.sunset.includes(level.n) ? 0 : 2) * (CLOCK.hold + CLOCK.fade));
  hideModals();
  last = performance.now();
  pace.t = pace.n = pace.even = 0;
  pace.warm = QUALITY.warmup;
  showLesson();
  beginChallenge(st);
  if (level.training) beginTraining(st);
  else {
    showKeyHints();
    st.plan = level.rush ? [] : surprisesFor(level, (tries[level.n] = (tries[level.n] ?? -1) + 1));
    prepareFirstOrder(st);
    if (level.rush) beginRush(st);
  }
  hud(st);
  measureHud();
  drawMap(st);
}

// Walking out on an order in the air costs the same as ruining it.
function leave() {
  // walking out of a Rush run ends it there: its score and pay so far still count, and nothing is charged
  if (st?.rush && !st.done && !st.outcome) {
    breakStreak(st, true);
    failMission(st, 'Left the run');
    return;
  }
  // walking out of a mission that has not been passed ends the run too, quietly, and the badge goes with it
  if (st?.has) {
    breakStreak(st, true);
    failMission(st, 'Left the mission', true);
  } else if (st && !st.done && !st.outcome?.passed) {
    breakStreak(st, true);
    hud(st);
  }
}

// The demo city drifting behind the front screens.
const demo = { x: 0, at: performance.now() };
// the front screens' music: quiet, in the city, at the hour the scene shows
const QUIET = { active: false, paused: false, place: 'city', time: 0, alt: .3, speed: 0, wind: 0, danger: 0 };
const quiet = () => ({ ...QUIET, time: Math.floor(world.palKey) % 3 });
// What the music follows: where the mission is, the time of day, and how the flight is going.
function musicState(paused) {
  const l = st.level, d = st.d, o = st.has ? st.order : null, r = st.rush, left = r?.end != null ? r.end - st.t : o ? o.deadline - st.t : Infinity;
  return {
    active: !st.done && !st.outcome, paused, place: l.beach ? 'beach' : l.desert ? 'desert' : l.forest ? 'forest' : l.mountain ? 'mountain' : l.snow ? 'snow' : 'city', time: Math.floor(world.palKey) % 3,
    // a mission keeps its own music through a pause and its result card; once it is over and the maps are open, they take over
    mission: !st.done || !levelsOpen(), challenge: !!l.challenge || (r?.level ?? 0) >= RUSH.hotFrom,
    alt: Math.max(0, Math.min(1, (GROUND - d.y) / MUSIC.altSpan)), speed: Math.min(1, Math.hypot(d.vx, d.vy) / MUSIC.fastSpeed), wind: l.wind ? Math.min(1, Math.abs(st.wind) / l.wind) : 0,
    danger: Math.max(left < MUSIC.lateSecs ? 1 - left / MUSIC.lateSecs : 0, st.batWarn > 1 ? 1 : st.batWarn ? .5 : 0), boosting: st.boosting, holding: !!st.anchor,
    call: callLive(),
  };
}

// The front screens' scene: the demo city drifting by and, on the menu, the aircraft hovering; a mission left behind
// the menu neither steps nor draws, and its rotor goes quiet.
function demoFrame(now) {
  const frame = (now - demo.at) / 1000, dt = Math.min(MAX_FRAME_DT, frame);
  demo.at = last = now;
  updateMusic(quiet());
  if (st) updateRotor(false, 0, currentModel());
  frost(false);
  if (!levelsOpen() && !pagesOpen()) {
    watchPace(frame);
    ctx.setTransform(view.DPR, 0, 0, view.DPR, 0, 0);
    setZoom(1);
    demo.x += CAMERA.idleSpeed * dt;
    const fake = {
      cam: { x: demo.x - CAMERA.idleLead, y: GROUND + Math.max(CAMERA.floorBelow, menuOpen() ? menuFloor() : 0) - view.viewH },
      t: demo.x / CAMERA.idleTimeDiv, wind: 0,
    };
    view.cam = fake.cam;
    drawSky(fake);
    drawCity(fake);
    if (menuOpen()) drawHover(now / 1000);
  }
  if (shopOpen()) drawHangar(now / 1000);
}

// One driver for every frame: the front screens' scene until a mission is in play, then the mission.
function frame(now) {
  if (!st || menuOpen()) demoFrame(now);
  else {
    demo.at = now;
    loop(now);
  }
  requestAnimationFrame(frame);
}

initInput();
initAudio();
initSheet();
// a purchase mid-mission comes off the mission's own copy of the money too, or its next save would hand it back; an order
// aboard holds back what ruining it costs (as failMission charges it), so the Shop cannot spend that charge away
initShop(price => { if (st) st.money = Math.max(0, st.money - price); },
  () => (st?.has && !st.outcome && !st.level.training && !st.level.daily && !st.rush ? Math.min(st.money, st.item.price) : 0));
initLeague();
initDaily();
initRush();
initCall();
initBoosts();
onStart(() => {
  hideOverlay();
  // a brand new player flies the lessons first
  if (settings.trained || loadProgress().del) showLevels();
  else start(trainingLevel());
});
onDevActions(() => autoDeliver(st), () => chargeDrone(st));
genWorld(CITY_SEED);
levels = buildLevels();
// every customer spot gets its household before any card or call names one
nameHomes(levels);
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
  stake: () => (st.has && !st.level.daily && !st.rush ? Math.min(st.money, st.item.price) : 0),
  // the run walking out would end, and the run as it stands for the mission card
  combo: () => (st.level.training || st.done || st.outcome?.passed ? 0 : streak.n),
  streak: () => streak.n,
  level: () => st.level,
  rush: () => st.rush,
});
// Back waits while a finished mission's result card is on its way
initMenu(levels, { busy: () => !!st?.outcome });
showMenu();
// building sprites hold shop signs, so repaint them once the web fonts arrive
document.fonts?.ready.then(dropSprites);
requestAnimationFrame(frame);
