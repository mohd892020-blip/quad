import { CAMERA, GROUND, SHOTS } from './config.js';
import { settings } from './storage.js';
import { ctx, view } from './ui.js';

// The camera works in shots. The player picks one (Chase, Wide, Close, Cinema) or lets Auto direct: close near a
// pickup or a drop, wide at speed, chase in between. Every mission opens on a wide shot while the first order is
// made, and a delivery ends on a slow push in. A change of shot glides with an ease in and out, the aircraft keeps
// its place on screen while the lens moves, and thin cinema bars slide in and back out as it goes.
const ease = t => (t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export const chosenShot = () => (SHOTS[settings.camera]?.name ? settings.camera : SHOTS.start);

// Auto cuts by where the flight is, and holds each shot a while so it never flickers between two.
function direct(st) {
  const a = SHOTS.auto, d = st.d, cam = st.cam, shop = st.stop?.shop;
  const to = st.has && st.order ? st.order.t : shop ? { x: shop.x + shop.w / 2 } : null;
  const shot = (to && Math.abs(to.x - d.x) < a.near) || st.prep ? 'close' : Math.abs(d.vx) > a.fast ? 'wide' : 'chase';
  if (shot !== cam.cut && st.t - (cam.cutAt ?? -Infinity) > a.hold) {
    cam.cut = shot;
    cam.cutAt = st.t;
  }
  return cam.cut;
}

function wanted(st) {
  if (st.outcome?.passed) return 'outro';
  if (st.prep?.opening) return 'intro';
  const pick = chosenShot();
  return pick === 'auto' ? direct(st) : pick;
}

// A shot's framing now; the cinema shot breathes.
function frame(name, t) {
  const s = SHOTS[name];
  return { zoom: s.zoom * (1 + Math.sin(t * (s.breatheRate ?? 0)) * (s.breathe ?? 0)), leadX: s.leadX, ahead: s.ahead, leadY: s.leadY, follow: s.follow };
}

export function stepCamera(st, dt) {
  const cam = st.cam, d = st.d, want = wanted(st);
  if (want !== cam.shot) {
    // the first shot of a mission is simply there; later ones glide from wherever the last glide had got to
    cam.from = cam.now ?? null;
    cam.shot = want;
    cam.at = st.t;
  }
  const to = frame(want, st.t), k = cam.from ? ease(Math.min(1, (st.t - cam.at) / SHOTS.blend)) : 1;
  const p = k < 1 ? Object.fromEntries(Object.keys(to).map(key => [key, cam.from[key] + (to[key] - cam.from[key]) * k])) : to;
  if (k >= 1) cam.from = null;
  cam.now = p;
  cam.move = k < 1 ? Math.sin(k * Math.PI) : 0;
  // the lens moves about the aircraft, so a zoom never throws it across the screen
  const S0 = view.base * (cam.z ?? p.zoom), S = view.base * p.zoom;
  if (S0 !== S) {
    cam.x = d.x - (d.x - cam.x) * S0 / S;
    cam.y = d.y - (d.y - cam.y) * S0 / S;
  }
  cam.z = p.zoom;
  cam.sharp = SHOTS[want].zoom;
  const viewW = view.W / S, viewH = view.H / S, follow = Math.min(1, dt * p.follow);
  cam.x += (d.x - viewW * p.leadX + d.vx * p.ahead - cam.x) * follow;
  // on touch screens the street stops above the thumb controls instead of sliding under them
  const baseY = GROUND + Math.max(CAMERA.floorBelow, view.floorPx / S) - viewH;
  // keep the drone clear of the HUD, which fills much of a short screen
  const lead = Math.max(p.leadY, (view.top + CAMERA.hudGap) / view.H);
  cam.y += (Math.min(baseY, d.y - viewH * lead) - cam.y) * follow;
  st.shake = Math.max(0, st.shake - dt * CAMERA.shakeDecay);
}

// Thin bars close in from the top and bottom while a shot glides, and open again as it lands.
export function drawShotBars(st) {
  const k = st.cam.move;
  if (!k) return;
  const h = view.H * SHOTS.bars * k;
  ctx.fillStyle = SHOTS.barColor;
  ctx.fillRect(0, 0, view.W, h);
  ctx.fillRect(0, view.H - h, view.W, h);
}
