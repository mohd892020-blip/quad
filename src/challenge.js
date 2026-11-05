import { iceAt } from './alpine.js';
import { sfx } from './audio.js';
import { AVALANCHE, BEACH, BLACKOUT, BOX, DRONE, FERRY, GATES, GROUND, JET, RADAR, SNOW, STORM, THIN_ICE } from './config.js';
import { drawHalos, drawTarget, failMission, pointerSpot } from './delivery.js';
import { ctx, kickDust, pop, popSpot, shade, showBoost, showToast, view, X, Y } from './ui.js';
import { world } from './world.js';

// The last missions each add one rule of their own. A stop names its rule, so a route can change rule from order to
// order; the rules that only set the stage (a vase, a low battery, a long rope) are laid out in levels.js.
export function beginChallenge(st) {
  const { challenge, noBoost, stops } = st.level, t = stops[0].t;
  showBoost(!noBoost);
  if (t.ferry) t.x = t.home;
  // a challenge, or today's mission, names its rule as it starts
  const intro = challenge ?? st.level.daily?.theme;
  if (intro) showToast(intro.name, intro.note, true);
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
  t.dir = t.dir || 1;
  const step = t.dir * c.speed * dt;
  t.x += step;
  // its speed, so a perfect drop on deck is judged as the customer riding it sees it
  t.vx = step / dt;
  if (st.anchor) st.anchor.x += step;
  if (t.x > c.to || t.x < c.from) t.dir = -t.dir;
}

// Rings in order, and only with the order on the rope: flying past the next one without going through it loses the order.
function gates(st) {
  const c = GATES, o = st.order, s = st.stop;
  if (!st.has || !o) return;
  const i = o.gate ?? 0, g = s.gates[i], dir = Math.sign(s.t.x - (s.shop.x + s.shop.w / 2)) || 1;
  if (!g) return;
  if (Math.hypot(st.d.x - g.x, st.d.y - g.y) < c.reach) {
    o.gate = st.gatesDone = i + 1;
    pop(st, g.x, g.y - c.reach - c.popLift, `Ring ${i + 1}/${s.gates.length}`, c.popColor);
    sfx('gate');
  } else if ((st.d.x - g.x) * dir > c.reach) failMission(st, 'Missed a ring', true);
}

// Above the line the jet stream carries the aircraft toward the customer at the mission's full wind; below it a share
// of that blows back. No wind of its own is ever drawn, and stepWind still eases into each change.
function jet(st) {
  const j = st.stop.jet;
  st.windT = (st.d.y < j.line ? 1 : -JET.headShare) * j.dir * st.level.wind;
  st.windNext = Infinity;
}

// Rotor wash low over a frozen lake cracks it; the cracks heal once the aircraft is back above the line.
function ice(st, dt) {
  const c = THIN_ICE, o = st.order;
  if (!st.has || !o) return;
  const low = iceAt(st.d.x) && GROUND - st.d.y < c.wash;
  // the angler steps back from the hole while the ice is cracking, so nothing is handed over from down there
  if (low) {
    o.crackX = st.d.x;
    st.hold = 0;
  }
  o.crack = low ? (o.crack ?? 0) + dt : Math.max(0, (o.crack ?? 0) - dt * c.fade);
  const creak = Math.floor(o.crack / c.creak);
  if (creak > (o.creak ?? 0)) sfx('creak');
  o.creak = creak;
  if (o.crack < c.grace) return;
  kickDust(st, o.crackX, GROUND, BEACH.splash);
  sfx('box');
  failMission(st, 'Through the ice', true);
}

// The avalanche waits a moment behind the shop, then rolls after the order. On the climb it spends itself: over the
// last stretch it slows at a steady rate and comes to rest short of the customer, so the handover is never a race.
function avalanche(st, dt) {
  const c = AVALANCHE, o = st.order, w = st.stop.wall;
  if (!st.has || !o) return;
  if (st.wall?.order !== o) st.wall = { order: o, x: w.from - w.dir * c.behind, wait: c.delay, dir: w.dir, pace: 1 };
  const a = st.wall;
  if (a.wait > 0) {
    a.wait -= dt;
    if (a.wait <= 0) sfx('thunder');
    return;
  }
  const left = (st.stop.t.x - a.dir * c.rest - a.x) * a.dir;
  a.pace = Math.min(1, Math.sqrt(Math.max(0, left) / c.spend));
  a.x += a.dir * (st.level.challenge.wallSpeed ?? c.speed) * a.pace * dt;
  if (Math.abs(st.d.x - a.x) < c.cue) st.shake = Math.max(st.shake, c.rumble * a.pace);
  if ((st.d.x - a.x) * a.dir > DRONE.radius && (st.box.x - a.x) * a.dir > BOX.padX * st.item.size) return;
  kickDust(st, st.d.x, st.d.y, c.dust);
  sfx('box');
  failMission(st, 'Caught by the avalanche', true);
}

const RULES = { storm, radar, ferry, gates, jet, ice, avalanche };

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

// The rings, each numbered: those passed fade to green, the next one pulses gold, the rest wait in white. Once the order
// is off the rope they keep the count it reached.
function drawGates(st) {
  const c = GATES, S = view.S, rings = st.stop.gates, at = st.order ? st.order.gate ?? 0 : st.gatesDone ?? 0, pulse = .5 + .5 * Math.sin(st.t * c.pulseRate);
  ctx.save();
  ctx.font = `800 ${c.text}px Tajawal,sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  rings.forEach((g, i) => {
    const next = i === at, r = (c.reach + (next ? pulse * c.pulse : 0)) * S, x = X(g.x), y = Y(g.y);
    if (x < -r - c.text * 2 || x > view.W + r + c.text * 2) return;
    ctx.strokeStyle = ctx.fillStyle = i < at ? c.done : next ? `rgba(${c.next},${c.nextAlpha + (1 - c.nextAlpha) * pulse})` : c.later;
    ctx.lineWidth = (next ? c.line : c.line * c.thin) * S;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 7);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = c.shadow;
    ctx.strokeText(String(i + 1), x, y - r - c.text);
    ctx.fillText(String(i + 1), x, y - r - c.text);
  });
  ctx.restore();
}

// Whether a box on screen keeps gap clear of the words of every pop.
function clearOfPops(st, l, t, r, b, gap) {
  return st.pops.every(q => {
    const p = popSpot(q);
    ctx.font = p.font;
    const half = ctx.measureText(q.txt).width / 2 + gap;
    return p.x + half < l || p.x - half > r || p.y + p.size * .3 + gap < t || p.y - p.size - gap > b;
  });
}

// Whether two screen boxes [left, top, right, bottom] stay gap apart.
const apart = (a, b, gap) => a[2] + gap < b[0] || a[0] - gap > b[2] || a[3] + gap < b[1] || a[1] - gap > b[3];

// The jet stream: a dashed line flowing the way it blows, and streaks of fast air above it. The label stands on the
// edge the wind comes from, away from the pointer, which leads downwind to the customer; while the line is above the
// screen or under the HUD, it waits just below the HUD and says how far up the line is. A pop drifting over it (a
// hawk's cry, say, as hawks fly near the line) moves it across the line or a row further out on the same edge, and only
// then to the other edge, and never onto the pointer's dart or its distance pill.
function drawJet(st) {
  const c = JET, { W, H, S } = view, j = st.stop.jet, y = Y(j.line), top = Y(j.line - c.band);
  if (top > H) return;
  ctx.save();
  if (y > view.top) {
    const n = view.lowQ ? c.streaks / 2 : c.streaks, lean = Math.sign(st.wind) || j.dir;
    ctx.strokeStyle = c.streak;
    ctx.lineWidth = 1.5 * S;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = ((i * 211 + st.t * st.wind * c.streakDrift * S) % W + W) % W, sy = top + (i * 53 % 97) / 97 * (y - top);
      ctx.moveTo(x, sy);
      ctx.lineTo(x + lean * c.streakLong * S, sy);
    }
    ctx.stroke();
  }
  if (y > view.top && y <= H) {
    ctx.strokeStyle = c.color;
    ctx.lineWidth = c.line * S;
    ctx.setLineDash([c.dash * S, c.dash * .7 * S]);
    ctx.lineDashOffset = -st.t * c.dashRate * j.dir * S;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (y - 6 > H) {
    ctx.restore();
    return;
  }
  const hidden = y - 6 - c.text < view.top, below = st.d.y > j.line, wind = j.dir < 0 ? W - c.edge : c.edge;
  const label = hidden && below ? `▲ JET STREAM ${Math.round((st.d.y - j.line) / 10)} m` : `JET STREAM ${j.dir > 0 ? '▶' : '◀'}`;
  // its rows: on the line, across it, then a row further out each way; under the HUD none of them shows
  const d = c.text + 6, rows = hidden ? [view.top + d, view.top + 2 * d, view.top + 3 * d] : [y - 6, y + d, y - 6 - d, y + 2 * d], font = `800 ${c.text}px Tajawal,sans-serif`;
  const aim = pointerSpot(st)?.boxes ?? [];
  ctx.font = font;
  // every row on the wind's edge comes before the other edge, so a pop moves the label a row, not across the screen
  const w = ctx.measureText(label).width, spots = [wind, W - wind].flatMap(x => rows.filter(r => r - c.text >= view.top).map(r => [x, r]));
  const spot = spots.find(([x, sy]) => {
    const l = x < W / 2 ? x : x - w, box = [l, sy - c.text, l + w, sy + c.text * .3];
    return clearOfPops(st, ...box, c.popGap) && aim.every(b => apart(box, b, c.popGap));
  });
  // with every spot under a pop or the pointer, the line goes unlabelled until one clears
  if (!spot) {
    ctx.restore();
    return;
  }
  const [lx, ly] = spot;
  ctx.font = font;
  ctx.textAlign = lx < W / 2 ? 'left' : 'right';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(20,15,40,.85)';
  ctx.strokeText(label, lx, ly);
  ctx.fillStyle = c.color;
  ctx.fillText(label, lx, ly);
  ctx.restore();
}

// The angler's hole in the ice and, while the order is on the rope, the pale zone the rotors must stay out of, with
// cracks spreading from under the aircraft as the ice gives.
function drawIce(st) {
  const c = THIN_ICE, S = view.S, t = st.stop.t, o = st.order, time = world.pal;
  ctx.save();
  ctx.fillStyle = shade(c.holeColor, time.light);
  ctx.beginPath();
  ctx.ellipse(X(t.x + c.holeAt), Y(GROUND + 3), c.hole * S, c.hole * .3 * S, 0, 0, 7);
  ctx.fill();
  if (st.has && o) {
    const lake = SNOW.lakes.find(([a, b]) => t.x > a && t.x < b), left = X(lake[0]), w = (lake[1] - lake[0]) * S, top = Y(GROUND - c.wash), crack = (o.crack ?? 0) / c.grace;
    const zone = ctx.createLinearGradient(0, top, 0, Y(GROUND));
    zone.addColorStop(0, c.zoneTop);
    zone.addColorStop(1, crack ? c.zoneAlert : c.zoneBottom);
    ctx.fillStyle = zone;
    ctx.fillRect(left, top, w, Y(GROUND) - top);
    ctx.strokeStyle = crack ? c.alert : c.color;
    ctx.lineWidth = c.line * S;
    ctx.setLineDash([c.dash * S, c.dash * .7 * S]);
    ctx.lineDashOffset = -st.t * c.dashRate * S;
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(left + w, top);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = `800 ${c.text}px Tajawal,sans-serif`;
    ctx.textAlign = 'left';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(20,15,40,.85)';
    ctx.strokeText('THIN ICE', left + c.edge, top - 6);
    ctx.fillStyle = crack ? c.alert : c.color;
    ctx.fillText('THIN ICE', left + c.edge, top - 6);
    if (crack > 0) {
      const cx = X(o.crackX), cy = Y(GROUND + 2), r = crack * c.crackLong * S;
      ctx.strokeStyle = c.crackColor;
      ctx.lineWidth = 1.5 * S;
      ctx.beginPath();
      for (let i = 0; i < c.cracks; i++) {
        const a = (i / c.cracks - .5) * Math.PI * .9;
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.sin(a) * r, cy + Math.abs(Math.cos(a)) * r * .12);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

// The avalanche over everything: a wall of snow haze behind a rolling front of white puffs and spray, the spray
// thinning out as it comes to rest. Off screen behind, a cue at the trailing edge says how far back it is, reddening as
// it closes while it still rolls.
function drawAvalanche(st) {
  const c = AVALANCHE, a = st.wall;
  if (!a) return;
  const { W, H, S } = view, front = X(a.x), dir = a.dir, time = world.pal, big = c.puffR[1] * S;
  ctx.save();
  if (dir > 0 ? front > -big : front < W + big) {
    ctx.beginPath();
    ctx.rect(-20, view.top, W + 40, H + 40);
    ctx.clip();
    ctx.globalAlpha = c.haze;
    ctx.fillStyle = time.snowNear;
    if (dir > 0) ctx.fillRect(-20, -20, Math.max(0, front) + 20, H + 40);
    else ctx.fillRect(Math.min(W, front), -20, W + 20 - Math.min(W, front), H + 40);
    ctx.globalAlpha = 1;
    ctx.fillStyle = shade(c.puff, time.light);
    const n = view.lowQ ? Math.ceil(c.puffs / 2) : c.puffs;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const r = (c.puffR[0] + (c.puffR[1] - c.puffR[0]) * (.5 + .5 * Math.sin(st.t * c.roll + i * 1.7))) * S, y = H * (i + .5) / n, x = front + dir * Math.sin(st.t * c.roll * 1.3 + i) * r * .3;
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, 7);
    }
    ctx.fill();
    ctx.beginPath();
    for (let i = 0; i < c.spray * a.pace; i++) {
      const x = front + dir * ((i * 37 + st.t * c.sprayRate) % c.sprayReach) * S, y = H * ((i * 61) % 100) / 100, r = (2 + i % 3) * S;
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, 7);
    }
    ctx.fill();
  } else if (!st.outcome && !st.done) {
    const gap = Math.abs(st.d.x - a.x), text = dir > 0 ? `◀ AVALANCHE ${Math.round(gap / 10)} m` : `AVALANCHE ${Math.round(gap / 10)} m ▶`;
    ctx.font = `800 ${c.text}px Tajawal,sans-serif`;
    ctx.textAlign = dir > 0 ? 'left' : 'right';
    ctx.textBaseline = 'middle';
    const x = dir > 0 ? c.edge : W - c.edge, y = H / 2;
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(20,15,40,.85)';
    ctx.strokeText(text, x, y);
    // a wall come to rest is no threat, so its cue stays calm however near
    ctx.fillStyle = gap < c.cue * 2 && a.pace > 0 ? c.warn : '#fff3df';
    ctx.fillText(text, x, y);
  }
  ctx.restore();
}

// Under the aircraft, in the world.
export function drawChallenge(st) {
  const tw = st.stop.twist;
  if (tw === 'ferry') drawFerry(st);
  else if (tw === 'radar' && st.has) drawRadarLine(st);
  else if (tw === 'gates') drawGates(st);
  else if (tw === 'jet') drawJet(st);
  else if (tw === 'ice') drawIce(st);
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
  else if (tw === 'avalanche') drawAvalanche(st);
}
