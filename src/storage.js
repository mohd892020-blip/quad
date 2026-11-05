import { AIRCRAFT, DAILY, GIFTS } from './config.js';

const PROGRESS_KEY = 'pizzaCityV1';
const SETTINGS_KEY = 'pizzaSettingsV1';
const GARAGE_KEY = 'pizzaGarageV1';
const SKIPS_KEY = 'pizzaSkipsV1';

const STICK = { size: 'medium', feel: 'normal', fade: 'solid', origin: 'fixed', hand: 'right' };
export const settings = { controls: 'joystick', plane: 'courier', dev: false, muted: false, music: true, vibration: true, comboSeen: false, camera: 'chase', tier: null, lite: false, sideways: false, shopSeen: [], picture: 'sharp', trained: false, stick: STICK, giftSeen: -1 };

try {
  Object.assign(settings, JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {});
} catch (_) {}
if (!Array.isArray(settings.shopSeen)) settings.shopSeen = [];
// the last date the gift calendar opened by itself
if (!Number.isInteger(settings.giftSeen)) settings.giftSeen = -1;
settings.stick = { ...STICK, ...(settings.stick && typeof settings.stick === 'object' ? settings.stick : null) };

// Real fails in a row on each mission, the missions skipped, and the missions passed since the last skip.
export const skips = { fails: {}, skipped: [], since: 0 };
try {
  const saved = JSON.parse(localStorage.getItem(SKIPS_KEY));
  for (const [n, v] of Object.entries(saved?.fails ?? {})) if (Number.isInteger(+n) && Number.isInteger(v) && v > 0) skips.fails[n] = v;
  if (Array.isArray(saved?.skipped)) skips.skipped = saved.skipped.filter(Number.isInteger);
  if (Number.isInteger(saved?.since) && saved.since >= 0) skips.since = saved.since;
} catch (_) {}

export function saveSkips() {
  try { localStorage.setItem(SKIPS_KEY, JSON.stringify(skips)); } catch (_) {}
}

// A pass clears the run of fails and counts toward the next skip; a real fail adds to the run.
export function noteResult(n, passed, real) {
  if (passed) {
    delete skips.fails[n];
    skips.since++;
  } else if (real) skips.fails[n] = (skips.fails[n] || 0) + 1;
  saveSkips();
}

// What the player has bought. It lives in memory, so flight code never touches storage.
export const garage = { owned: [], parts: {}, version: 0 };
try {
  const saved = JSON.parse(localStorage.getItem(GARAGE_KEY));
  if (Array.isArray(saved?.owned)) garage.owned = saved.owned.filter(k => typeof k === 'string');
  for (const [k, v] of Object.entries(saved?.parts ?? {})) if (Number.isInteger(v) && v > 0) garage.parts[k] = v;
} catch (_) {}

export function saveGarage() {
  garage.version++;
  try { localStorage.setItem(GARAGE_KEY, JSON.stringify({ owned: garage.owned, parts: garage.parts })); } catch (_) {}
}

export const bought = key => key === AIRCRAFT[0].key || garage.owned.includes(key);
export const owns = key => settings.dev || bought(key);
if (!owns(settings.plane)) settings.plane = AIRCRAFT[0].key;

export function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (_) {}
}

// Each field stands alone, so one bad value cannot cost the rest of a save.
const count = v => (Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);
const whole = (v, low) => (Number.isInteger(v) && v >= low ? v : low);
const clean = saved => ({
  del: count(saved?.del),
  money: count(saved?.money),
  stars: Object.fromEntries(Object.entries(saved?.stars && typeof saved.stars === 'object' ? saved.stars : {})
    .filter(([n, s]) => Number.isInteger(+n) && +n > 0 && [1, 2, 3].includes(s))),
  // today's mission: the last date its reward paid, the days in a row up to it, the longest run, and that date's best stars
  daily: { day: whole(saved?.daily?.day, -1), streak: whole(saved?.daily?.streak, 0), best: whole(saved?.daily?.best, 0), stars: [1, 2, 3].includes(saved?.daily?.stars) ? saved.daily.stars : 0 },
  // the gift calendar: the last date a gift was claimed, the next of the week's gifts, and the weeks completed
  gifts: { day: whole(saved?.gifts?.day, -1), step: Math.min(GIFTS.days.length - 1, whole(saved?.gifts?.step, 0)), weeks: whole(saved?.gifts?.weeks, 0) },
  // Rush Hour: the best score, the most drops in one run, and the runs that delivered anything
  rush: { best: count(saved?.rush?.best), del: count(saved?.rush?.del), runs: count(saved?.rush?.runs) },
});

// With storage blocked, progress still lasts as long as the page does. Once a write fails (storage that reads but is full)
// the page's own record is the newer one, so what storage still holds cannot offer a paid gift or reward again.
let session = null, stale = false;

export function loadProgress() {
  if (!stale) {
    try {
      const saved = JSON.parse(localStorage.getItem(PROGRESS_KEY));
      if (saved) return clean(saved);
    } catch (_) {}
  }
  return clean(session);
}

// One write holds the whole record, so money and the mark of what paid it are never saved apart.
function writeProgress(p) {
  session = p;
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
    stale = false;
  } catch (_) { stale = true; }
}

// Keeps each level's best star count alongside deliveries and money; today's mission and the gifts ride along untouched.
export function saveProgress(del, money, level, stars) {
  const saved = loadProgress();
  if (level) saved.stars[level] = Math.max(saved.stars[level] || 0, stars);
  writeProgress({ ...saved, del, money });
}

// The local calendar date as a whole day number: the same on every device that shows that date, one more each midnight.
export const dayNumber = (now = new Date()) => Math.round(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 864e5);

// What the first pass of a date pays on the run of days it makes: a little more each day in a row, up to the cap.
export const dailyReward = run => DAILY.reward.base + DAILY.reward.step * Math.min(Math.max(0, run - 1), DAILY.reward.cap);

// The mission made for `day` pays on its first pass, once: only a date after the last one paid and never one past today,
// so a clock set back finds nothing to pay and one set forward pays that date alone. The run grows on the date after the
// last one paid and starts again at 1 otherwise; nothing is ever taken back. A later pass of the paid date keeps its best
// stars. The money and the mark go in one write.
export function payDaily(day, del, money, stars) {
  const saved = loadProgress(), d = saved.daily;
  if (day > d.day && day <= dayNumber()) {
    const run = day === d.day + 1 ? d.streak + 1 : 1, reward = dailyReward(run);
    writeProgress({ ...saved, del, money: money + reward, daily: { day, streak: run, best: Math.max(d.best, run), stars } });
    return { reward, run };
  }
  writeProgress({ ...saved, del, money, daily: day === d.day ? { ...d, stars: Math.max(d.stars, stars) } : d });
  return { reward: 0, run: 0 };
}

// The calendar's next gift waits on any date after the last one claimed: a missed day only waits, a date at or before the
// last claim never pays, and after the seventh gift the week starts again. What it paid, or 0.
export function claimGift() {
  const saved = loadProgress(), g = saved.gifts, day = dayNumber();
  if (day <= g.day) return 0;
  const amount = GIFTS.days[g.step], last = g.step === GIFTS.days.length - 1;
  writeProgress({ ...saved, money: saved.money + amount, gifts: { day, step: last ? 0 : g.step + 1, weeks: g.weeks + (last ? 1 : 0) } });
  return amount;
}

// A run's end: its pay and the best score and most drops, in one write, so the money and the record that paid it never
// part. Returns the record as it was before, for the result card.
export function saveRush(score, del, pay) {
  const saved = loadProgress(), r = saved.rush;
  writeProgress({ ...saved, money: saved.money + pay, rush: { best: Math.max(r.best, score), del: Math.max(r.del, del), runs: r.runs + 1 } });
  return r;
}
