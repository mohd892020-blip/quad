import { ITEMS, ROPE, TRAINING } from './config.js';
import { saveSettings, settings } from './storage.js';
import { ctx, showLesson, view, X, Y } from './ui.js';
import { shopPad, world } from './world.js';

// Training is a level with nothing against the player: no clock, wind, hawks or rival, and a
// lost order only goes back a step. Each step teaches one thing and ends when the player does it.
const c = TRAINING;
const ring = st => {
  const p = shopPad(st.level.shop);
  return { x: p.x + c.ringX, y: p.y - c.ringY, label: 'Ring' };
};
const pad = st => {
  const p = shopPad(st.level.shop);
  return { x: p.x, y: p.y - c.padLift, label: st.level.shop.shop.name };
};

const STEPS = [
  {
    title: 'Take off', touch: 'Hold LIFT to climb above the roof.', keys: 'Hold ↑ or Space to climb above the roof.', teach: ['up'],
    done: st => st.d.y < shopPad(st.level.shop).y - c.climb,
  },
  {
    title: 'Steer', touch: 'Slide the stick right and fly into the ring.', keys: 'Hold → and fly into the ring.', teach: ['joy', 'arrows'], goal: ring,
    done: st => {
      const g = ring(st);
      return Math.hypot(st.d.x - g.x, st.d.y - g.y) < c.ringReach;
    },
  },
  {
    title: 'Boost', touch: 'Hold BOOST for a burst of speed.', keys: 'Hold Shift for a burst of speed.', teach: ['boost'],
    done: st => st.lesson.boosted > c.boostFor,
  },
  {
    title: 'Land', touch: 'Fly back to the green pad, then let go of LIFT and settle on it.', keys: 'Fly back to the green pad, then let go of ↑ and settle on it.', goal: pad,
    done: st => !!st.prep,
  },
  { title: 'Pick up', touch: 'Stay on the pad while the shop makes the order.', keys: 'Stay on the pad while the shop makes the order.', done: st => st.has },
  {
    title: 'Carry', touch: 'The order swings on its rope, so fly smoothly to the customer.', keys: 'The order swings on its rope, so fly smoothly to the customer.',
    done: (st, zone) => zone.rope,
  },
  {
    title: 'Lower the rope', touch: 'Hold Rope ▼ to let the order down.', keys: 'Hold ↓ to let the order down.', teach: ['ropeDown'],
    done: st => st.ropeLen > ROPE + c.rope,
  },
  {
    title: 'Hold still', touch: 'Line up over the customer, then tap Hold to pin the aircraft.', keys: 'Line up over the customer, then press H to pin the aircraft.', teach: ['hold'],
    done: st => !!st.anchor,
  },
  { title: 'Deliver', touch: 'Keep the order at the customer until the circle fills.', keys: 'Keep the order at the customer until the circle fills.', teach: ['ropeDown'], done: () => false },
];
const LAND = STEPS.findIndex(s => s.title === 'Land');

export function trainingLevel() {
  const shop = world.shops[0], x = shop.x + shop.w / 2;
  const t = world.targets.filter(q => q.kind === 'roof' && q.b !== shop && q.x > x).sort((a, b) => a.x - b.x)[0];
  return { training: true, n: 0, tier: 0, shop, stops: [{ shop, item: { ...ITEMS.pizza, prep: c.prep }, t, dist: Math.abs(t.x - x) }], hawks: 0, rival: false, wind: 0 };
}

function enter(st, i) {
  const step = STEPS[i], touch = matchMedia('(pointer:coarse)').matches;
  st.lesson.i = i;
  showLesson(`Step ${i + 1} of ${STEPS.length}`, step.title, touch ? step.touch : step.keys, step.teach || []);
}

export function beginTraining(st) {
  st.lesson = { i: 0, boosted: 0, goal: null };
  // once seen, it never opens on its own again; settings has it for a second go
  settings.trained = true;
  saveSettings();
  enter(st, 0);
}

export function stepTraining(st, zone, dt) {
  const l = st.lesson;
  if (st.outcome || st.done) return;
  st.d.bat = 100;
  if (st.boosting) l.boosted += dt;
  // a cancelled or lost order sends the player back to the pad
  if (l.i > LAND && !st.has && !st.prep) enter(st, LAND);
  const step = STEPS[l.i];
  l.goal = step.goal ? step.goal(st) : null;
  if (step.done(st, zone)) enter(st, l.i + 1);
}

export function drawLesson(st) {
  const g = st.lesson?.goal;
  if (!g || g.label !== 'Ring') return;
  const S = view.S, pulse = .5 + .5 * Math.sin(st.t * 5);
  ctx.strokeStyle = `rgba(255,194,61,${.55 + .45 * pulse})`;
  ctx.lineWidth = 4 * S;
  ctx.beginPath();
  ctx.arc(X(g.x), Y(g.y), (c.ringReach + pulse * 4) * S, 0, 7);
  ctx.stroke();
}
