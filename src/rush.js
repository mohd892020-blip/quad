import { buzz, sfx } from './audio.js';
import { carSpeed } from './action.js';
import { DELIVERY, GROUND, HANGAR, ITEMS, LEVELS, RUSH, SURPRISE } from './config.js';
import { failMission } from './delivery.js';
import { openSky, wayDown } from './levels.js';
import { loadProgress, saveRush, settings } from './storage.js';
import { clockText, openMissionCard, pop, scoreText, showToast } from './ui.js';
import { rng, shopPad, world } from './world.js';

// Rush Hour: one order after another over the city, against one clock that every drop winds up again. The run keeps its
// record on st.rush, and its level object is built fresh for every run, so a retry starts clean. Nothing here runs at
// load, so the imports going round through delivery and ui are safe.
const $ = id => document.getElementById(id);
const centre = s => s.x + s.w / 2;
const levelAt = del => 1 + Math.floor(del / RUSH.every);

// A level's row; past the table the last row holds, with less time each level.
function levelOf(lv) {
  const L = RUSH.levels, last = L[L.length - 1];
  return lv <= L.length ? L[lv - 1] : { ...last, share: last.share * RUSH.fade ** (lv - L.length), note: RUSH.later };
}

// The next order: the closest shop with something on the level's menu, and a customer of the level, never the one just
// served nor on the shop itself, with a clear way down and open sky. A level that finds nobody looks wider.
function pickOrder(pick, x, lv, last, start = null) {
  const c = RUSH, row = levelOf(lv), menu = row.menu ? c.menus[row.menu] : null, ok = k => !menu || menu.includes(k);
  const shop = start ?? [...world.shops].sort((a, b) => Math.abs(centre(a) - x) - Math.abs(centre(b) - x)).find(s => s.shop.items.some(ok));
  const items = shop.shop.items.filter(ok), item = ITEMS[start ? shop.shop.items[0] : items[(pick() * items.length) | 0]];
  const kinds = pick() < row.street ? ['street'] : row.kinds, heavy = item.weight >= HANGAR.heavyFrom, mid = centre(shop);
  const fits = (near, far) => world.targets.filter(t => {
    const gap = Math.abs(t.x - mid);
    return t.b !== shop && t !== last && gap > near && gap < far && t.x < row.to && kinds.includes(t.kind)
      && (t.kind !== 'bal' || (item.size <= LEVELS.balconyMaxSize && item.wind < HANGAR.windyFrom && item.fragile < HANGAR.fragileFrom))
      && !(heavy && GROUND - t.y > c.heavyTop) && wayDown(t, item) && openSky(t);
  });
  let pool = fits(row.near, row.far);
  for (let k = 1; !pool.length && k <= c.widenTries; k++) pool = fits(row.near * (1 - c.widen * k), row.far * (1 + c.widen * k));
  // never measured to happen; a rooftop with a way down is always fair
  if (!pool.length) pool = world.targets.filter(t => t.b !== shop && t !== last && t.kind === 'roof' && wayDown(t, item));
  if (!pool.length) pool = world.targets.filter(t => t.b !== shop && t !== last);
  const t = pool[(pick() * pool.length) | 0];
  return { shop, item, t, dist: Math.abs(t.x - mid), limit: c.cap, rival: false };
}

// A drop may bring the game's own surprises: a bonus ring from one level, a gust from a later one.
function surprise(pick, lv) {
  const c = RUSH, s = SURPRISE.share, k = pick(), at = () => s[0] + pick() * (s[1] - s[0]);
  if (lv >= c.ring.from && k < c.ring.chance) return [{ stop: 0, kind: 'ring', share: at() }];
  if (lv >= c.gust.from && k < c.ring.chance + c.gust.chance) return [{ stop: 0, kind: 'gust', share: at(), dir: pick() < .5 ? -1 : 1 }];
  return [];
}

// The level's hawks and wind go on the run's own level object, read by planMission and stepWind as a mission's.
function applyLevel(st) {
  const row = levelOf(st.rush.level);
  Object.assign(st.level, { hawks: row.hawks, wind: row.wind });
}

// An eagle is a chance on each order from its level on, growing a level, and only for a player who has met eagles in
// the missions: a sure one on every order would be a wall, not a threat.
function eagleFor(r, lv) {
  const e = RUSH.eagle;
  return r.eagle && lv >= e.from && r.pick() < e.chance + e.step * (lv - e.from) ? 1 : 0;
}

// A fresh run: the city flags of a mission, its own random stream, and the first order at the first shop.
export function rushLevel() {
  const c = RUSH, row = levelOf(1), shop = world.shops[c.shop], pick = rng((Math.random() * 2 ** 31) | 0);
  return {
    n: 0, rush: true, pick, tier: c.tier, shop, beach: false, desert: false, forest: false, mountain: false, snow: false, cold: c.drain, weather: null,
    hawks: row.hawks, eagles: 0, wind: row.wind, rival: false, rivalSpeed: 0, street: false, calm: false, carSpeed: carSpeed(c.tier),
    stops: [pickOrder(pick, centre(shop), 1, null, shop)],
  };
}

// Called by start() after prepareFirstOrder: the record, a quicker opening load, and the toast that names the rule.
export function beginRush(st) {
  const { rush, stars } = loadProgress(), eagle = settings.dev || !!stars[RUSH.eagle.after];
  st.rush = { level: 1, score: 0, del: 0, perfect: 0, combo: 0, pay: 0, end: null, tick: Infinity, gain: null, banner: null, best: rush.best, pick: st.level.pick, eagle };
  st.plan = [];
  if (st.prep) st.prep.left = st.prep.full = Math.min(st.prep.left, RUSH.firstLoad);
  showToast('Rush Hour', RUSH.intro, true);
}

// An order on board (from startMission): the run clock starts with the first one and is every order's deadline; a fresh
// battery; close calls count again for each order.
export function rushLoaded(st) {
  const r = st.rush, o = st.order;
  r.end ??= st.t + RUSH.start;
  o.deadline = r.end;
  o.limit = RUSH.cap;
  st.d.bat = 100;
  st.close.n = 0;
}

// A drop (from passMission, after the combo has grown or broken): its points and pay at the level it was flown at, the
// next order at once, the time for it (its words rise under the points), a surprise and maybe an eagle for it, and the
// next level's toast a moment later.
export function rushDelivered(st, o, item, clean, perfect) {
  const c = RUSH, p = c.points, r = st.rush, f = c.combo[Math.min(st.combo.n, c.combo.length - 1)];
  const pts = Math.round((p.drop + (perfect ? p.perfect : 0) + o.bonus * p.perBonus) * (1 + (r.level - 1) * p.perLevel) * f * (item.urgent ? p.urgent : 1) / p.round) * p.round;
  r.score += pts;
  r.pay += c.pay.each + c.pay.perLevel * (r.level - 1) + (perfect ? c.pay.perfect : 0);
  r.del++;
  r.perfect += perfect ? 1 : 0;
  r.combo = Math.max(r.combo, st.combo.n);
  const lv = levelAt(r.del), next = pickOrder(r.pick, o.t.x, lv, o.t), pad = shopPad(next.shop).x;
  const way = Math.abs(o.t.x - pad) + Math.abs(next.t.x - pad);
  const add = Math.round((c.base + way / c.pace) * levelOf(lv).share) + (clean ? c.clean : 0) + (perfect ? c.perfect : 0);
  const secs = Math.max(0, Math.floor(Math.min(add, c.cap - (r.end - st.t)))), y = o.t.y - DELIVERY.popLift;
  r.end += secs;
  r.gain = { secs, at: st.t };
  r.tick = Infinity;
  pop(st, o.t.x, y, f > 1 ? `+${scoreText(pts)} COMBO ×${f}` : `+${scoreText(pts)}`, '#ffc23d');
  pop(st, o.t.x, y + c.gainPop.below, secs ? `+${secs}s` : 'MAX', c.gainInk, c.gainPop.size);
  st.stop = next;
  st.plan = surprise(r.pick, lv);
  if (lv > r.level) {
    r.level = lv;
    applyLevel(st);
    r.banner = { at: st.t + DELIVERY.noticeWait, lv };
  }
  st.level.eagles = eagleFor(r, lv);
}

// Each step, after stepMission: the clock runs out between orders too (with an order on board the order's own deadline
// ends it), the last seconds tick, and a new level is announced.
export function stepRush(st) {
  const r = st.rush, c = RUSH;
  if (!r || st.outcome || st.done || r.end == null) return;
  const left = r.end - st.t, s = Math.ceil(left);
  if (!st.has && left <= 0) {
    failMission(st, "Time's up");
    return;
  }
  if (s <= c.tickFrom && s < r.tick) {
    r.tick = s;
    sfx('tick');
  }
  if (r.banner && st.t >= r.banner.at) {
    showToast(`Rush level ${r.banner.lv}`, r.banner.lv === c.eagle.from && !r.eagle ? c.eagle.calm : levelOf(r.banner.lv).note, true, true);
    sfx('rush');
    buzz(c.levelBuzz);
    r.banner = null;
  }
}

// The run's end, once, from finish(): the pay and the record in one write (nothing to save before the first drop), and
// what the result card shows.
export function endRun(st, outcome) {
  const r = st.rush, pay = r.pay;
  const was = r.del ? saveRush(r.score, r.del, pay) : loadProgress().rush;
  return { ...outcome, rush: { score: r.score, del: r.del, perfect: r.perfect, combo: r.combo, level: r.level, pay, best: was.best, newBest: r.score > was.best } };
}

// The map's Rush Hour card: shown from mission showFrom, locked until mission unlock, then the best score.
export function showRushCard() {
  const c = RUSH, { stars, rush } = loadProgress(), earned = !!stars[c.unlock], open = settings.dev || earned, shown = settings.dev || earned || !!stars[c.showFrom], card = $('rushCard');
  card.hidden = !shown;
  if (!shown) return;
  card.className = !open ? 'locked' : rush.runs ? 'done' : 'ready';
  card.classList.toggle('devMark', open && !earned);
  $('rushBest').textContent = !open ? `Pass Mission ${c.unlock}` : rush.runs ? `Best ${scoreText(rush.best)}` : 'Play';
  $('rushNote').textContent = !open ? '' : rush.runs ? `Most drops ${rush.del}` : 'Endless deliveries';
  card.querySelector('.dotNew').hidden = !open || rush.runs > 0;
  card.setAttribute('aria-label', !open ? `Rush Hour. Opens after Mission ${c.unlock}` : rush.runs ? `Rush Hour. Best ${scoreText(rush.best)}` : 'Rush Hour. Endless deliveries');
}

// Its card: the rule, the clock, the levels, the battery and the pay, built from RUSH, with the best where stars stand.
function openRushCard() {
  const c = RUSH, { stars, rush } = loadProgress();
  openMissionCard(rushLevel(), {
    kicker: 'Endless · City', title: 'Rush Hour', mark: rush.runs ? `Best ${scoreText(rush.best)}` : 'No runs yet', go: 'Start Rush', lock: stars[c.unlock] ? 0 : c.unlock,
    rows: [
      ['Clock', `${clockText(c.start)} to start. Each drop adds time`],
      ['Bonus', `Clean drop +${c.clean}s, PERFECT +${c.clean + c.perfect}s`],
      ['Levels', `Every ${c.every} drops: farther, windier, less time`],
      ['Battery', 'Fresh at every pickup, and it lasts longer'],
      ['If ruined', 'The run ends. You keep its pay, no charge'],
      ['Pay', `$${c.pay.each} a drop, +$${c.pay.perLevel} a level, +$${c.pay.perfect} a PERFECT`],
      ...(rush.runs ? [['Most drops', `${rush.del}`]] : []),
    ],
  });
}

export function initRush() {
  document.documentElement.style.setProperty('--gainInk', RUSH.gainInk);
  $('rushCard').addEventListener('click', openRushCard);
}
