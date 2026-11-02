import { sfx } from './audio.js';
import { BLACKOUT, FERRY, GROUND, RADAR, STORM } from './config.js';
import { drawHalos, drawTarget, failMission } from './delivery.js';
import { ctx, shade, showBoost, showToast, view, X, Y } from './ui.js';
import { world } from './world.js';

// The last missions each add one rule of their own. A stop names its rule, so a route can change rule from order to
// order; the rules that only set the stage (a vase, a low battery, a long rope) are laid out in levels.js.
export function beginChallenge(st) {
  const { challenge, noBoost, stops } = st.level, t = stops[0].t;
  showBoost(!noBoost);
  if (t.ferry) t.x = t.home;
  if (challenge) showToast(challenge.name, challenge.note, true);
}

// Gusts swap sides every couple of seconds, far quicker than the wind of any other mission.
function storm(st, dt) {
  const c = STORM;
  if (!st.gusting || st.t > st.windNext) {
    st.gusting = true;
    st.windT = (st.windT > 0 ? -1 : 1) * st.level.wind * (c.gustMin + Math.random() * (1 - c.gustMin));
    st.windNext = st.t + c.gapMin + Math.random() * c.gapRange;
  }
  st.wind += (st.windT - st.wind) * Math.min(1, dt * c.follow);
  st.flash = Math.max(0, (st.flash ?? 0) - dt * c.boltFade);
  if (st.t > (st.boltAt ?? 0)) {
    st.flash = st.boltAt ? 1 : 0;
    st.boltAt = st.t + c.boltGap + Math.random() * c.boltRange;
    if (st.flash) sfx('thunder');
  }
}

// Above the line the radar counts up; a moment below takes it back down.
function radar(st, dt) {
  const c = RADAR;
  st.radar = st.d.y < st.stop.ceiling && st.has ? (st.radar ?? 0) + dt : Math.max(0, (st.radar ?? 0) - dt * c.fade);
  if (st.radar >= c.grace) {
    st.radar = 0;
    failMission(st, 'Spotted by radar', true);
  }
}

// The ferry shuttles along the bay; an aircraft on Hold rides along with it.
function ferry(st, dt) {
  const c = FERRY, t = st.stop.t;
  t.dir ||= 1;
  const step = t.dir * c.speed * dt;
  t.x += step;
  if (st.anchor) st.anchor.x += step;
  if (t.x > c.to || t.x < c.from) t.dir = -t.dir;
}

const RULES = { storm, radar, ferry };

export function stepChallenge(st, dt) {
  if (!st.outcome && !st.done) RULES[st.stop.twist]?.(st, dt);
}

function drawFerry(st) {
  const c = FERRY, S = view.S, t = st.stop.t, time = world.pal, left = t.x - c.w / 2, deck = GROUND - c.deckH, x = X(left);
  if (x > view.W + 40 || x + c.w * S < -40) return;
  ctx.fillStyle = shade('#f2efe6', time.light);
  ctx.beginPath();
  ctx.moveTo(x, Y(deck));
  ctx.lineTo(X(left + c.w), Y(deck));
  ctx.lineTo(X(left + c.w - c.bow), Y(GROUND + c.draft));
  ctx.lineTo(X(left + c.bow), Y(GROUND + c.draft));
  ctx.fill();
  ctx.fillStyle = shade('#3f6fb0', time.light);
  ctx.fillRect(x, Y(deck + c.stripe), c.w * S, c.stripeH * S);
  // the wheelhouse stands at the end the customer is not on
  ctx.fillStyle = shade('#e0a52c', time.light);
  ctx.fillRect(x + c.cabinAt * S, Y(deck - c.cabinH), c.cabinW * S, c.cabinH * S);
  ctx.fillStyle = shade('#26303f', Math.max(.7, time.light));
  ctx.fillRect(x + (c.cabinAt + 6) * S, Y(deck - c.cabinH + 6), (c.cabinW - 12) * S, 9 * S);
}

function drawRadarLine(st) {
  const c = RADAR, S = view.S, y = Y(st.stop.ceiling), alert = Math.min(1, (st.radar ?? 0) / c.grace);
  if (y < 0 || y > view.H) return;
  ctx.strokeStyle = alert ? '#ffffff' : '#ff4a3a';
  ctx.lineWidth = c.line * S;
  ctx.setLineDash([c.dash * S, c.dash * .7 * S]);
  ctx.lineDashOffset = -st.t * c.dashRate * S;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(view.W, y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = `800 ${c.text}px Tajawal,sans-serif`;
  ctx.textAlign = 'left';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(20,15,40,.85)';
  ctx.strokeText('RADAR', c.edge, y - 6);
  ctx.fillStyle = '#ff7a5c';
  ctx.fillText('RADAR', c.edge, y - 6);
  if (!alert) return;
  ctx.fillStyle = `rgba(232,73,44,${c.tint * alert})`;
  ctx.fillRect(0, 0, view.W, view.H);
}

// Under the aircraft, in the world.
export function drawChallenge(st) {
  const tw = st.stop.twist;
  if (tw === 'ferry') drawFerry(st);
  else if (tw === 'radar' && st.has) drawRadarLine(st);
}

function drawRain(st) {
  const c = STORM, { W, H, S } = view, n = view.lowQ ? c.rain / 2 : c.rain, lean = st.wind * c.rainLean;
  ctx.fillStyle = `rgba(18,22,40,${c.shade})`;
  ctx.fillRect(-20, -20, W + 40, H + 40);
  ctx.strokeStyle = c.rainColor;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = ((i * 173 + st.t * st.wind * c.rainDrift) % W + W) % W, y = (i * 97 + st.t * c.rainFall * (1 + i % 3 * .2)) % H;
    ctx.moveTo(x, y);
    ctx.lineTo(x + lean * S, y + c.rainLong * S);
  }
  ctx.stroke();
  if (st.flash) {
    ctx.fillStyle = `rgba(235,240,255,${c.boltAlpha * st.flash})`;
    ctx.fillRect(-20, -20, W + 40, H + 40);
  }
}

// The power is out: the dark stops only where the aircraft's lights reach, and the pad and customer still show.
function drawBlackout(st) {
  const c = BLACKOUT, { W, H } = view, x = X(st.d.x), y = Y(st.d.y), r = Math.max(c.minReach, c.reach * view.S);
  const dark = ctx.createRadialGradient(x, y, r * c.clear, x, y, r);
  dark.addColorStop(0, c.open);
  dark.addColorStop(1, c.shut);
  ctx.fillStyle = dark;
  ctx.fillRect(-20, -20, W + 40, H + 40);
  drawHalos(st);
  drawTarget(st);
}

// Over everything in the scene.
export function drawWeather(st) {
  const tw = st.stop.twist;
  if (tw === 'storm') drawRain(st);
  else if (tw === 'blackout') drawBlackout(st);
}
