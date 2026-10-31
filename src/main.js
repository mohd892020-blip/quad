import { CAMERA, FIXED_DT, GROUND, HUD_INTERVAL, IDLE_SEED, MAX_FRAME_DT } from './config.js';
import { newGame, stepCargo, stepRestaurant, drawPointer, drawTarget } from './delivery.js';
import { drawDrone, stepDrone } from './drone.js';
import { initInput, keys } from './input.js';
import { drawRope, stepRope } from './rope.js';
import { ctx, drawFx, endShift, hideOverlay, hud, onStart, stepFx, view } from './ui.js';
import { drawCity, drawSky, genWorld, stepCamera, stepWind } from './world.js';

let st = null, hudT = 0, last = performance.now();

function step(dt) {
  st.t += dt;
  stepWind(st, dt);
  const grounded = stepDrone(st, keys, dt);
  if (st.has) {
    stepRope(st, dt);
    stepCargo(st, dt);
  }
  stepRestaurant(st, grounded, dt);
  if (st.t >= st.shift) endShift(st, 'خلصت الوردية');
  if (st.d.bat <= 0 && grounded) endShift(st, 'نفدت البطارية');
  stepCamera(st, dt);
  stepFx(st, dt);
}

function rememberPose() {
  const { cam, d, box, has } = st;
  st.prev = { camX: cam.x, camY: cam.y, x: d.x, y: d.y, a: d.a, boxX: box.x, boxY: box.y, has };
}

// A display faster than the physics gets frames with no new step, which would
// freeze the picture. Draw a blend of the last two steps; physics never sees it.
function blended() {
  const p = st.prev;
  if (!p) return st;
  const t = Math.min(1, st.acc / FIXED_DT), mix = (a, b) => a + (b - a) * t;
  return {
    ...st,
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
  const sh = s.shake;
  ctx.save();
  if (sh) ctx.translate((Math.random() - .5) * sh, (Math.random() - .5) * sh);
  drawCity(s);
  drawTarget(s);
  drawRope(s);
  drawDrone(s);
  drawFx(s);
  ctx.restore();
  drawPointer(s);
}

function loop(now) {
  const dt = Math.min(MAX_FRAME_DT, (now - last) / 1000);
  last = now;
  if (st.running) {
    st.acc += dt;
    while (st.acc >= FIXED_DT) {
      rememberPose();
      step(FIXED_DT);
      st.acc -= FIXED_DT;
      if (!st.running) break;
    }
    hudT += dt;
    if (hudT > HUD_INTERVAL) { hud(st); hudT = 0; }
  }
  render();
  requestAnimationFrame(loop);
}

function start() {
  st = newGame();
  hideOverlay();
  last = performance.now();
  hud(st);
}

// Idle demo city behind the start card, until the first shift starts.
const demo = { x: 0 };
function idle() {
  if (st) { requestAnimationFrame(loop); return; }
  ctx.setTransform(view.DPR, 0, 0, view.DPR, 0, 0);
  demo.x += CAMERA.idleSpeed;
  const fake = {
    cam: { x: demo.x - CAMERA.idleLead, y: GROUND + CAMERA.floorBelow - view.viewH },
    t: demo.x / CAMERA.idleTimeDiv, wind: 0,
  };
  view.cam = fake.cam;
  drawSky(fake);
  drawCity(fake);
  requestAnimationFrame(idle);
}

initInput();
onStart(start);
genWorld(IDLE_SEED);
idle();
