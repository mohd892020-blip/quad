import { buzz, sfx } from './audio.js';
import { BOOSTS, CHAPTERS, SHOP, SKIP, TEASE } from './config.js';
import { dropAllowed, landAllowed } from './delivery.js';
import { touchUI } from './input.js';
import { freshNow, nudgeShop, openFromNudge } from './shop.js';
import { boosts, canGetDrop, dayNumber, grantDrop, grantLand, landReady, resetBoosts, saveBoosts, settings } from './storage.js';
import { playAd, showToast } from './ui.js';

// The boosts a rewarded ad buys (Auto Land for the day, one Auto Drop) and the golden teasers for everything a player can
// get: on the mission card, on the result card for the flight that comes next, and the map's Boosts card. Nothing here is
// offered in flight. ui.js imports this file and this file imports ui.js, so nothing at the top level reads the other's.
const $ = id => document.getElementById(id);
const text = BOOSTS.text;

// Ad offers wait for real ads, as the skip does; what a player already holds works either way.
export const adsOn = () => !BOOSTS.devOnly || settings.dev;
const devMark = () => BOOSTS.devOnly && settings.dev;

// A screen or flight with no teasers: today's mission, Rush Hour, training, a checkpoint, a chapter's first mission.
const quiet = l => !l || l.daily || l.rush || l.training || SKIP.never.includes(l.n) || CHAPTERS.some(c => c.from > 1 && c.from === l.n);
const owned = f => (f === 'land' ? landReady() : boosts.drop.have);
const canGet = f => (f === 'land' ? !landReady() : canGetDrop());
const allowed = (f, l) => (f === 'land' ? landAllowed(l) : dropAllowed(l));

// An ad teaser for mission l now: spaced from the last ad teaser and from its own, resting after being ignored, and never
// twice for one mission (its retries included) until another mission has had one.
function adOk(f, l) {
  const p = boosts.plays;
  return adsOn() && !quiet(l) && l.n >= TEASE.from && allowed(f, l) && !owned(f) && canGet(f) && boosts.rest[f] <= p
    && p - boosts.lastAd >= TEASE.adGap && p - boosts.last[f] >= TEASE.gap && boosts.adFor !== l.n;
}

// The teaser for a screen, or null. screen is 'card' (l, the card's mission), 'pass' (ctx.own passed, l the next mission
// or null) or 'fail' (l = ctx.own, for the retry). ctx: own, fail (the outcome), skip (Skip shows), fresh (what the
// money buys that the Shop has not shown). It only reads the save, the settings and the date.
export function teaseFor(screen, l, ctx = {}) {
  if (quiet(screen === 'card' ? l : ctx.own) || (screen === 'fail' && ctx.skip)) return null;
  const p = boosts.plays;
  for (const f of ['land', 'drop']) if (!boosts.seen[f] && l && l.n >= TEASE[f].intro && adOk(f, l)) return { f, intro: true, why: 'intro', l };
  if (screen === 'pass') {
    const items = (ctx.fresh ?? []).filter(i => !boosts.named.includes(i.key));
    if (items.length && ctx.own.n >= (boosts.seen.shop ? TEASE.from : TEASE.shop.intro) && p - boosts.last.shop >= TEASE.shop.every && boosts.rest.shop <= p) {
      return { f: 'shop', intro: !boosts.seen.shop, items, l };
    }
  }
  if (screen === 'fail') {
    const o = ctx.fail;
    if (boosts.seen.drop && o.over && !TEASE.drop.skipWhys.includes(o.why) && adOk('drop', l)) return { f: 'drop', intro: false, why: 'fail', l };
    if (boosts.seen.land && (o.why === 'BATTERY DEAD' || (o.pad && TEASE.land.padWhys.includes(o.why))) && adOk('land', l)) {
      return { f: 'land', intro: false, why: o.why === 'BATTERY DEAD' ? 'battFail' : 'padFail', l };
    }
    return null;
  }
  for (const f of ['land', 'drop']) if (l && boosts.seen[f] && TEASE[f].cards[l.n] && adOk(f, l)) return { f, intro: false, why: TEASE[f].cards[l.n], l };
  return null;
}

// The teaser on screen now, kept until its screen is left.
let shown = null;
export function showTease(t) {
  const p = boosts.plays;
  shown = t;
  boosts.seen[t.f] = true;
  boosts.last[t.f] = p;
  if (t.f === 'shop') boosts.named = [...new Set([...boosts.named, ...t.items.map(i => i.key)])];
  else {
    boosts.lastAd = p;
    boosts.adFor = t.l.n;
  }
  saveBoosts();
}

// A tap on the teaser takes it, whether or not the ad is watched to the end; ignored often enough in a row, it rests.
export function leaveTease(taken = false) {
  if (!shown) return;
  const f = shown.f;
  if (taken) boosts.ignored[f] = 0;
  else if (++boosts.ignored[f] >= TEASE.ignore) {
    boosts.ignored[f] = 0;
    boosts.rest[f] = boosts.plays + TEASE.rest;
  }
  saveBoosts();
  shown = null;
}

// What the teaser says: the feature's introduction, or why it helps on this mission.
const lineFor = t => (t.intro ? (t.f === 'land' ? text.landIntro : text.dropIntro) : (t.f === 'land' ? text.landWhy : text.dropWhy)[t.why].replace('{bat}', t.l.startBat ?? 100));
// one part and one aircraft when both are new, as the map's Shop note names them
function shopLine(items) {
  const part = items.find(i => i.key.startsWith('part')), plane = items.find(i => i.key.startsWith('plane')), pick = part && plane ? [part, plane] : items.slice(0, SHOP.nudgeNames);
  return text.shop.replace('{names}', pick.map(i => i.name).join(' or ') + (items.length > pick.length ? ' and more' : ''));
}
const nameOf = f => (f === 'land' ? text.land : text.drop);
const icon = id => `<svg class="ico" aria-hidden="true"><use href="#${id}"/></svg>`;

// The stand-in ad, then the boost: Auto Land for today, or one Auto Drop if none is held and one may be got today.
export function getBoost(f, then) {
  playAd(f === 'land' ? text.getLand : text.getDrop, () => {
    if (f === 'land') grantLand();
    else if (!grantDrop()) return;
    sfx('buy');
    buzz(BOOSTS.drop.buzz);
    then();
  });
}

// The strip over a mission card's Start: a green chip for each boost held that works there, and at most one gold teaser
// with its line. on is true only for the map's own missions, opened unlocked. A turned phone shows a green chip's tick
// alone (its word stays for screen readers) and keeps only an introduction's line and the Auto Drop's price.
export function boostStrip(l, on) {
  const el = $('levelBoosts');
  if (!on || !l || l.daily || l.rush || l.training) {
    el.hidden = true;
    el.innerHTML = '';
    return;
  }
  const t = teaseFor('card', l);
  if (t) showTease(t);
  const ready = word => `<span class="boostChip ready" title="${word}">${icon('i-check')}<span class="chipWord">${word}</span></span>`;
  const chips = [
    ...(landReady() && landAllowed(l) ? [ready(text.landReady)] : []),
    ...(boosts.drop.have && dropAllowed(l) ? [ready(text.dropReady)] : []),
  ];
  let notes = '';
  if (t) {
    const line = lineFor(t), drop = t.f === 'drop';
    chips.unshift(`<button class="boostChip tease" id="levelTease" aria-label="${nameOf(t.f)}, free with an ad. ${line}${drop ? `. ${text.fine}` : ''}">${t.intro ? `<b class="newTag">${text.newTag}</b>` : ''}${icon('i-ad')}${nameOf(t.f)}<em>${text.free}</em></button>`);
    notes = `<small class="teaseNote${t.intro ? ' intro' : ''}">${line}</small>${drop ? `<small class="teaseNote fine">${text.fine}</small>` : ''}`;
  }
  el.innerHTML = chips.join('') + notes;
  el.hidden = !chips.length;
  el.classList.toggle('devMark', devMark());
  if (t) $('levelTease').addEventListener('click', () => {
    leaveTease(true);
    getBoost(t.f, () => boostStrip(l, true));
  });
}

// The result card's pill, in the Skip button's place (the two never show together): an ad teaser for the flight that
// comes next, or the Shop's. Once the ad is watched it stays as a quiet green badge.
export function resultBoost(o, level, next) {
  const b = $('resultBoost');
  const t = o.training ? null : o.passed ? teaseFor('pass', next, { own: level, fresh: freshNow() })
    : teaseFor('fail', level, { own: level, fail: o, skip: !$('resultSkip').hidden });
  b.hidden = !t;
  b.onclick = null;
  if (!t) return;
  const [word, line, fine] = b.querySelectorAll('span, small'), shop = t.f === 'shop';
  b.querySelector('use').setAttribute('href', shop ? '#i-bag' : '#i-ad');
  word.textContent = shop ? shopLine(t.items) : t.intro ? `New: ${nameOf(t.f)}` : t.f === 'land' ? text.pillLand : text.pillDrop;
  line.textContent = shop ? text.shopGo : lineFor(t);
  line.hidden = false;
  fine.textContent = text.fine;
  fine.hidden = t.f !== 'drop';
  b.disabled = false;
  b.className = 'tease wide';
  b.classList.toggle('devMark', !shop && devMark());
  // the one soft glow plays again for each card
  b.classList.remove('tease');
  void b.offsetWidth;
  b.classList.add('tease');
  showTease(t);
  b.onclick = () => {
    leaveTease(true);
    if (shop) {
      openFromNudge();
      return;
    }
    getBoost(t.f, () => {
      b.onclick = null;
      b.disabled = true;
      b.classList.add('ready');
      b.querySelector('use').setAttribute('href', '#i-check');
      word.textContent = t.f === 'land' ? text.landReady : text.dropReady;
      line.hidden = fine.hidden = true;
    });
  };
}

// The map's Boosts button: there once a boost has been introduced or is held, with a still green dot while one is ready.
export function showBoostBtn() {
  const btn = $('boostBtn'), have = landReady() || boosts.drop.have;
  btn.hidden = !(adsOn() && (settings.dev || boosts.seen.land || boosts.seen.drop || have));
  btn.querySelector('.dotReady').hidden = !have;
  btn.classList.toggle('devMark', devMark());
}

// Every boost introduced so far, what it does and where, and getting it: buying any time before flying.
export function openBoosts() {
  const rows = [];
  if (settings.dev || boosts.seen.land || landReady()) {
    const act = landReady() ? `<em class="boostTag ready">${text.landUntil}</em>` : `<button class="go" data-get="land">${icon('i-ad')}${text.watch}</button>`;
    rows.push(`<div class="boostRow">${icon('i-land')}<p><b>${text.land}</b><small>${text.landLine}</small><small class="fine">${text.landWhere}</small></p>${act}</div>`);
  }
  if (settings.dev || boosts.seen.drop || boosts.drop.have) {
    const act = boosts.drop.have ? `<em class="boostTag ready">${text.dropReady}</em>` : canGetDrop() ? `<button class="go" data-get="drop">${icon('i-ad')}${text.watch}</button>` : `<em class="boostTag">${boosts.drop.day === dayNumber() ? text.dropNext : text.dropSoon}</em>`;
    rows.push(`<div class="boostRow">${icon('i-drop')}<p><b>${text.drop}</b><small>${text.dropLine}</small><small class="fine">${text.fine}</small><small class="fine">${text.dropWhere}</small></p>${act}</div>`);
  }
  if (settings.dev) rows.push(`<button class="ghost devMark" data-reset="1">${text.reset}</button>`);
  $('boostRows').innerHTML = rows.join('');
  $('boostCard').querySelector('.card').classList.toggle('devMark', devMark());
  $('boostCard').hidden = false;
  nudgeShop();
}

export function initBoosts() {
  $('boostBtn').addEventListener('click', openBoosts);
  $('boostClose').addEventListener('click', () => {
    $('boostCard').hidden = true;
    showBoostBtn();
    nudgeShop();
  });
  // a tap on the dim goes back as the arrow does
  $('boostCard').addEventListener('click', e => { if (e.target === e.currentTarget) $('boostClose').click(); });
  $('boostRows').addEventListener('click', e => {
    const b = e.target.closest?.('button');
    if (!b) return;
    if (b.dataset.get) getBoost(b.dataset.get, openBoosts);
    else if (b.dataset.reset) {
      resetBoosts();
      openBoosts();
      showBoostBtn();
    }
  });
  const root = document.documentElement.style;
  root.setProperty('--glow', `${TEASE.glow}s`);
  root.setProperty('--glowDelay', `${TEASE.glowDelay}s`);
}

// A flight's own controls: LAND and its keys stay a developer's (devOnly follows developer mode switched on mid-flight)
// unless this flight has Auto Land for the day, and the G key shows while an Auto Drop waits for a mission that takes it.
export function markFlight(st) {
  const own = st.autoLand;
  $('land').classList.toggle('devMark', !own);
  $('keyLand').classList.toggle('devMark', !own);
  for (const id of ['keyLand', 'pauseLand']) $(id).classList.toggle('devOnly', !own);
  $('pauseLand').querySelector('.devChip').hidden = own;
  markDropKeys(st.level);
}

// read again when the pause card opens, since a handover may have used the drop up
export function markDropKeys(level) {
  $('keyDrop').hidden = $('pauseDrop').hidden = !(dropAllowed(level) && boosts.drop.have);
}

// Usage help, once ever, the first time the AUTO DROP button shows. It is not an offer.
export function dropHint() {
  if (boosts.hint) return;
  boosts.hint = true;
  saveBoosts();
  showToast(...(touchUI() ? text.hint : text.hintKeys), true, true);
}
