import { buzz, sfx } from './audio.js';
import { DAILY, FX, GIFTS } from './config.js';
import { dailyLevel } from './levels.js';
import { nudgeShop } from './shop.js';
import { claimGift, dailyReward, dayNumber, loadProgress, saveSettings, settings } from './storage.js';
import { chapterIntro, openMissionCard, starText, view } from './ui.js';

// The map's side of today's mission and the gift calendar: the Today card and the gift button in the map bar, today's
// mission card and the calendar. All of it reads the save and the device's own clock, so it works offline.
const $ = id => document.getElementById(id);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// daylight goes unsaid, as on every other mission card
const TIMES = [' at sunset', ' at night', ''];
// the golden angle as a share of a turn, so no two paper pieces fly the same way
const GOLD = (3 - Math.sqrt(5)) / 2;

// Time left in the local date, a day number as a date to read (with its year when that is not this one, as after a clock
// set far ahead and put back), and a countdown in words.
const untilMidnight = (now = new Date()) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) - now;
function dateName(day) {
  const d = new Date(day * 864e5), y = d.getUTCFullYear();
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}${y === new Date().getFullYear() ? '' : `, ${y}`}`;
}
function clock(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60;
  return h ? `${h}h ${m}m` : m ? `${m}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`;
}
// Writes only on change: the countdowns run every second.
const write = (id, text) => { const el = $(id); if (el.textContent !== text) el.textContent = text; };

// A date's mission is built once: the map asks every second, and a date's mission never changes.
let built = { day: null, level: null };
const todayLevel = day => (built.day === day ? built.level : (built = { day, level: dailyLevel(day) }).level);

// Everything the map shows for a date, from the save alone. paid is the last date the daily paid, past today when the
// clock was set back, and then no run shows; last is the last date a gift was claimed.
function state(day = dayNumber()) {
  const { stars, daily: d, gifts: g } = loadProgress();
  return {
    day, earned: !!stars[DAILY.unlock], open: settings.dev || !!stars[DAILY.unlock], gifts: settings.dev || !!stars[GIFTS.unlock],
    done: d.day === day, ahead: d.day > day, paid: d.day, run: d.day >= day - 1 && d.day <= day ? d.streak : 0, best: d.best, stars: d.day === day ? d.stars : 0,
    reward: dailyReward(d.day === day - 1 ? d.streak + 1 : 1),
    waiting: day > g.day, behind: day < g.day, claimed: g.day === day, last: g.day, step: g.step, weeks: g.weeks, missed: g.day >= 0 && day - g.day > 1,
  };
}

let shownDay = null, timer = 0;

// The line under the Today card's prize: what is left of today, or when the next mission comes.
function timeText(s) {
  write('todayTime', !s.open ? `Pass Mission ${DAILY.unlock}` : s.ahead ? `Again on ${dateName(s.paid + 1)}` : s.done ? `New in ${clock(untilMidnight())}` : `${clock(untilMidnight())} left`);
}

// The Today card and the gift button, shown once mission GIFTS.unlock is passed. pop opens the calendar by itself, once a
// date, when a gift is waiting.
export function showToday(pop = false) {
  const s = state(), l = s.gifts ? todayLevel(s.day) : null, card = $('todayCard');
  shownDay = s.day;
  $('today').hidden = !l;
  $('levelsBar').classList.toggle('withToday', !!l);
  if (l) {
    const { theme, region } = l.daily, place = DAILY.places[region], locked = !s.open, quiet = s.done || s.ahead;
    card.className = locked ? 'locked' : quiet ? 'done' : 'ready';
    $('today').classList.toggle('devMark', s.open && !s.earned);
    card.style.setProperty('--zone', l.shop.zone.map);
    card.querySelector('.todayBadge use').setAttribute('href', `#s-${theme.sign}`);
    $('todayRun').textContent = s.run;
    $('todayRun').parentElement.hidden = locked || !s.run;
    $('todayKicker').textContent = `${s.done ? 'Done' : 'Today'} · ${place}`;
    $('todayName').textContent = theme.name;
    $('todayPrize').textContent = locked ? 'Locked' : s.done ? starText(s.stars) : s.ahead ? 'Played' : `$${s.reward}`;
    // the dot says today's mission is still to do
    card.querySelector('.dotNew').hidden = locked || quiet;
    card.setAttribute('aria-label', `Today's mission: ${theme.name}, ${place}. ${locked ? `Opens after Mission ${DAILY.unlock}` : s.done ? 'Done today' : s.ahead ? 'Played' : `Reward $${s.reward}`}`);
    timeText(s);
  }
  const gift = $('giftBtn'), ready = s.gifts && s.waiting;
  gift.hidden = !s.gifts;
  gift.classList.toggle('ready', ready);
  gift.querySelector('.dotNew').hidden = !ready;
  gift.setAttribute('aria-label', ready ? 'Daily gifts, a gift is waiting' : 'Daily gifts');
  if (pop && ready && settings.giftSeen < s.day) {
    settings.giftSeen = s.day;
    saveSettings();
    openGifts();
  }
  if (!timer) timer = setInterval(tick, DAILY.tick * 1000);
}

// Once a tick while the map is up: the countdowns, and on a new date its mission and gift. Nothing runs during a flight.
function tick() {
  if ($('levels').hidden) { clearInterval(timer); timer = 0; return; }
  if (dayNumber() !== shownDay) {
    // a new date while the map is up (a phone left on it overnight) is a first visit too, unless a card is open over it
    showToday(!document.querySelector('.modal:not([hidden])') && $('sheet').hidden);
    if (!$('gifts').hidden) renderGifts();
    return;
  }
  const s = state();
  if (!$('today').hidden) timeText(s);
  if (!$('gifts').hidden) whenText(s);
}

// Today's mission on the mission card: the place and hour over its name, its rule, the job and its dangers, then the run
// when there is one, and the reward on Start while it waits. Tomorrow's mission shows once today's is done, when it is
// the next thing to look forward to. Kept to a row or two more than a mission's, so Start stays near on a phone held
// sideways. Retries are free, so Start is always there once it is open.
function openToday() {
  const s = state(), l = todayLevel(s.day), next = s.done && dailyLevel(s.day + 1);
  if (!l) return;
  const { theme, region, time } = l.daily, days = n => `${n} ${n === 1 ? 'day' : 'days'}`;
  openMissionCard(l, {
    kicker: `${s.done ? 'Done today' : 'Today'} · ${DAILY.places[region]}${TIMES[time]}`, title: theme.name, best: s.stars, lock: s.earned ? 0 : DAILY.unlock,
    go: s.done || s.ahead ? 'Start' : `Start · $${s.reward} reward`, head: [['Rule', theme.note]],
    tail: [...(s.run ? [['Streak', `${days(s.run)} in a row${s.best > s.run ? `, best ${s.best}` : ''}`]] : []),
      ...(next ? [['Tomorrow', `${next.daily.theme.name}, ${DAILY.places[next.daily.region]}`]] : [])],
  });
}

// Under the claim button: what tomorrow brings, or when the next gift opens.
function whenText(s) {
  const n = GIFTS.days.length, left = clock(untilMidnight());
  write('giftWhen', s.behind ? `Your next gift opens on ${dateName(s.last + 1)}`
    : s.waiting ? `Tomorrow: $${GIFTS.days[(s.step + 1) % n]}`
    : s.step === 0 ? `A new week starts in ${left}`
    : `Day ${s.step + 1}: $${GIFTS.days[s.step]} in ${left}`);
}

// The week of gifts: the ones taken ticked, the one waiting glowing, tomorrow's named, the big one gold. got marks the
// tile just claimed, which bumps.
function renderGifts(got = -1) {
  const s = state(), n = GIFTS.days.length, full = s.claimed && s.step === 0 && s.weeks > 0;
  $('giftsWeek').textContent = `Week ${s.weeks + (full ? 0 : 1)}`;
  $('giftsNote').textContent = s.waiting && s.missed ? 'Welcome back. Your gift waited for you' : 'A gift for every day you play. A missed day just waits';
  $('giftDays').innerHTML = GIFTS.days.map((v, i) => {
    const done = full || i < s.step, now = s.waiting && i === s.step, soon = s.claimed && !full && i === s.step, big = i === n - 1;
    const cls = [done && 'done', now && 'now', big && 'big', i === got && 'got'].filter(Boolean).join(' ');
    return `<li class="${cls}"><small>${now ? 'Today' : soon ? 'Tomorrow' : `Day ${i + 1}`}${big ? '<span class="bigWord"> · Big gift</span>' : ''}</small><svg class="ico" aria-hidden="true"><use href="#i-${done ? 'check' : 'gift'}"/></svg><b>$${v}</b></li>`;
  }).join('');
  const claimBtn = $('giftClaim');
  claimBtn.disabled = !(s.gifts && s.waiting);
  claimBtn.textContent = s.waiting ? `Claim $${GIFTS.days[s.step]}` : s.behind ? 'Not yet' : 'Come back tomorrow';
  whenText(s);
}

export function openGifts() {
  renderGifts();
  $('gifts').hidden = false;
}

// Paper bursts from the claimed tile along a golden-angle spiral; each piece goes when it lands, and with the last one the
// tile settles among the days taken. A screen that asks for less motion gets none, and the tile settles at once.
export function paper(tile, count) {
  if (!tile) return;
  const settle = () => tile.classList.remove('got');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { settle(); return; }
  const c = GIFTS, paint = FX.confetti.paint;
  for (let i = 0; i < count; i++) {
    const k = (i * GOLD) % 1, a = k * 2 * Math.PI, r = c.spread * (c.inner + (1 - c.inner) * (1 - k)), p = document.createElement('i');
    p.className = 'paper';
    p.style.background = paint[i % paint.length];
    p.style.setProperty('--dx', `${Math.round(Math.cos(a) * r)}px`);
    p.style.setProperty('--dy', `${Math.round(Math.sin(a) * r - c.lift)}px`);
    p.style.setProperty('--r', `${Math.round(k * c.spin)}deg`);
    p.addEventListener('animationend', () => { p.remove(); if (!tile.querySelector('.paper')) settle(); });
    tile.appendChild(p);
  }
}

// One tap takes the waiting gift: the money, its tile bumps, paper flies, a chime and a buzz (if Vibration is on), and the
// note under Shop names the new money. A second tap finds nothing waiting.
function claim() {
  const s = state(), paid = s.gifts ? claimGift() : 0;
  if (!paid) { renderGifts(); return; }
  const big = s.step === GIFTS.days.length - 1 ? 1 : 0;
  renderGifts(s.step);
  paper($('giftDays').children[s.step], GIFTS.paper[big] >> (view.lowQ ? 1 : 0));
  sfx(big ? 'win' : 'gift');
  buzz(GIFTS.buzz[big]);
  const money = $('levelsMoney');
  money.textContent = `$${loadProgress().money}`;
  money.classList.remove('bump');
  void money.offsetWidth;
  money.classList.add('bump');
  showToday();
  nudgeShop();
}

export function initDaily() {
  $('todayCard').addEventListener('click', openToday);
  $('giftBtn').addEventListener('click', openGifts);
  $('giftClaim').addEventListener('click', claim);
  $('giftsClose').addEventListener('click', () => {
    $('gifts').hidden = true;
    // the money may now cover something new, and a chapter newly open introduces itself
    nudgeShop();
    chapterIntro();
  });
}
