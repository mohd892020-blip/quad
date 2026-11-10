import { sfx } from './audio.js';
import { AIRCRAFT, HANGAR, SHOP, TEASE } from './config.js';
import { drawAirframe } from './drone.js';
import { boosts, bought, garage, loadProgress, owns, saveBoosts, saveGarage, saveProgress, saveSettings, settings } from './storage.js';
import { badgeFor, fitBar, refreshPause } from './ui.js';

const $ = id => document.getElementById(id);
const pipLevels = SHOP.partPrices.length;

// The Shop: a hangar of every aircraft, one picked and shown large with its one action, and the upgrades on a tab of
// their own. What is picked and which tab shows last only while the Shop is open.
let tab = 'planes', pick = null, spend = () => {}, reserve = () => 0;
const price = key => SHOP.aircraft[key] ?? 0;
// cheapest first; the sort is stable, so equal prices keep the fleet's order and the free Courier leads
const order = () => [...AIRCRAFT].sort((a, b) => price(a.key) - price(b.key));
export const shopOpen = () => !$('shop').hidden;
const known = key => AIRCRAFT.some(a => a.key === key);

function pay(cost) {
  const { del, money } = loadProgress();
  if (money - reserve() < cost) return false;
  saveProgress(del, money - cost);
  sfx('buy');
  // a mission in flight keeps its own copy of the money and saves it back, so it is told what was spent
  spend(cost);
  return true;
}

const buyButton = (price, money, data) => `<button class="go" ${data} ${money < price ? 'disabled' : ''}>$${price}</button>`;

function partRow(p, money) {
  money -= reserve();
  const level = Math.min(garage.parts[p.key] || 0, pipLevels), price = SHOP.partPrices[level];
  const pips = '●'.repeat(level) + '○'.repeat(pipLevels - level);
  return `<div class="shopRow"><p><b>${p.name}</b><small>${p.note}</small></p><span>${pips}</span>${level < pipLevels ? buyButton(price, money, `data-part="${p.key}"`) : '<em>Max</em>'}</div>`;
}

// What a tile and the big picture say about an aircraft: flying it, owned, or its price, dimmed when the money falls short.
// An order aboard holds back what ruining it would cost, so spending in the Shop cannot dodge that charge.
function tagFor(a, money) {
  if (settings.plane === a.key) return { cls: 'flying', text: 'Flying' };
  if (owns(a.key)) return { cls: 'owned', text: 'Owned' };
  return { cls: price(a.key) <= money - reserve() ? '' : 'short', text: `$${price(a.key)}` };
}

function tile(a, money) {
  const badge = badgeFor(a), tag = tagFor(a, money);
  return `<button class="tile${owns(a.key) && !bought(a.key) ? ' devMark' : ''}" data-pick="${a.key}" aria-pressed="${a.key === pick}" aria-label="${a.name}, ${badge.text}, ${tag.text}"><canvas width="${HANGAR.tile[0]}" height="${HANGAR.tile[1]}" aria-hidden="true"></canvas><span class="tag ${tag.cls}">${tag.text}</span><b>${a.name}</b><small class="badge ${badge.stat}">${badge.text}</small></button>`;
}

function drawTiles() {
  for (const c of $('shopPlanes').querySelectorAll('canvas')) {
    const h = HANGAR, g = c.getContext('2d'), k = c.height / h.previewHeight * h.tileFill;
    g.setTransform(k, 0, 0, k, c.width / 2, c.height / 2 + h.tileDrop * k);
    drawAirframe(g, c.closest('[data-pick]').dataset.pick, 0);
  }
}

// Bars against the best in the fleet, with a tick where the aircraft being flown stands.
function stats(m) {
  const flying = AIRCRAFT.find(a => a.key === settings.plane);
  const rows = [['Power', 'thrust'], ['Speed', 'speed'], ['Battery', 'battery'], ['Toughness', 'tough']];
  return rows.map(([label, stat]) => {
    const top = Math.max(...AIRCRAFT.map(a => a[stat]));
    return `<span>${label}</span><i><b style="width:${m[stat] / top * 100}%"></b>${flying && flying !== m ? `<u style="left:${flying[stat] / top * 100}%"></u>` : ''}</i>`;
  }).join('') + `<span>Sound</span><em>${HANGAR.pitch.find(([hz]) => m.hz[0] < hz)[1]}</em>`;
}

function detail(money) {
  const m = AIRCRAFT.find(a => a.key === pick), badge = badgeFor(m), tag = tagFor(m, money), act = $('hangarAct');
  $('pickName').textContent = m.name;
  $('pickBadge').textContent = badge.text;
  $('pickBadge').className = `badge ${badge.stat}`;
  $('pickTag').textContent = tag.text;
  $('pickTag').className = `tag ${tag.cls}`;
  $('planeNote').textContent = m.note;
  $('planeStats').innerHTML = stats(m);
  act.className = 'go wide';
  if (settings.plane === m.key) {
    act.textContent = 'Flying';
    act.disabled = true;
    act.dataset.act = '';
    act.classList.add('flying');
  } else if (owns(m.key)) {
    act.textContent = 'Use';
    act.disabled = false;
    act.dataset.act = 'use';
  } else if (price(m.key) <= money - reserve()) {
    act.textContent = `Buy $${price(m.key)}`;
    act.disabled = false;
    act.dataset.act = 'buy';
  } else {
    act.textContent = price(m.key) > money ? `Need $${price(m.key) - money} more` : 'Deliver the order first';
    act.disabled = true;
    act.dataset.act = '';
  }
}

// The big picture is drawn at the screen's own sharpness, up to a cap, and only while the Aircraft tab shows.
function sizeStage() {
  const c = $('preview'), d = Math.min(devicePixelRatio || 1, HANGAR.stageDpr);
  c.width = Math.round(c.clientWidth * d);
  c.height = Math.round(c.clientHeight * d);
  drawnAt = 0;
}

// A pick rebuilds the tiles, so a keyboard player's place moves to the new copy of what had focus.
function render() {
  const { money } = loadProgress(), had = document.activeElement?.closest?.('#shop [data-pick], #shop [data-part]');
  const keep = had && (had.dataset.pick ? `[data-pick="${had.dataset.pick}"]` : `[data-part="${had.dataset.part}"]`);
  for (const id of ['shopMoney', 'levelsMoney', 'menuMoney']) $(id).textContent = `$${money}`;
  $('tabPlanes').setAttribute('aria-selected', String(tab === 'planes'));
  $('tabParts').setAttribute('aria-selected', String(tab === 'parts'));
  $('hangar').hidden = tab !== 'planes';
  $('partsPanel').hidden = tab !== 'parts';
  $('shopParts').innerHTML = SHOP.parts.map(p => partRow(p, money)).join('');
  $('shopPlanes').innerHTML = order().map(a => tile(a, money)).join('');
  drawTiles();
  detail(money);
  if (keep) $('shop').querySelector(keep)?.focus({ preventScroll: true });
}

function act(e) {
  const b = e.target.closest?.('button');
  if (!b || b.disabled) return;
  if (b.getAttribute('role') === 'tab') {
    tab = b.id === 'tabParts' ? 'parts' : 'planes';
    render();
    if (tab === 'planes') sizeStage();
    return;
  }
  if (b.dataset.pick) {
    pick = b.dataset.pick;
    render();
    $('hangarDetail').scrollIntoView?.({ block: 'nearest' });
    return;
  }
  const { part } = b.dataset, what = b.id === 'hangarAct' ? b.dataset.act : '';
  if (part) {
    const level = garage.parts[part] || 0;
    if (!pay(SHOP.partPrices[level])) return;
    garage.parts[part] = level + 1;
    saveGarage();
  } else if (what === 'buy' || what === 'use') {
    if (what === 'buy') {
      if (owns(pick) || !pay(price(pick))) return;
      garage.owned.push(pick);
      saveGarage();
    }
    settings.plane = pick;
    saveSettings();
  } else return;
  render();
  if (what === 'buy') {
    const t = $('pickTag');
    t.classList.remove('bump');
    void t.offsetWidth;
    t.classList.add('bump');
  }
}

// What the money buys now: the next level of each part and every aircraft not yet owned, cheapest first.
function affordable(money) {
  const parts = SHOP.parts.filter(p => (garage.parts[p.key] || 0) < pipLevels)
    .map(p => ({ key: `part:${p.key}:${garage.parts[p.key] || 0}`, name: p.name, price: SHOP.partPrices[garage.parts[p.key] || 0] }));
  const planes = AIRCRAFT.filter(a => !owns(a.key) && SHOP.aircraft[a.key]).map(a => ({ key: `plane:${a.key}`, name: `the ${a.name}`, price: SHOP.aircraft[a.key] }));
  return [...parts, ...planes].filter(i => i.price <= money).sort((a, b) => a.price - b.price);
}
export const freshNow = () => affordable(loadProgress().money).filter(i => !settings.shopSeen.includes(i.key));

// When the money first covers something new, the menu's Shop button glows once and keeps a dot until the Shop is
// opened. On the map a soft note under the Shop button says what, as one of the teasers: only for what no teaser has
// named yet, at most once every shop.every missions played (shared with the result card's Shop pill), and kept for that
// visit to the map (visit is true as the map opens), hidden while a card covers it; its button glows once with it.
// Opening the Shop settles it. All of it waits until the Shop's introduction mission is passed.
let noted = null;
const COVERS = ['levelCard', 'boostCard', 'gifts', 'chapterCard', 'adCard'];
export function nudgeShop(visit = false) {
  const { money, stars } = loadProgress(), fresh = settings.dev || stars[TEASE.shop.intro] ? freshNow() : [], note = $('shopNudge'), btn = $('openShop');
  const news = fresh.filter(i => !boosts.named.includes(i.key)), p = boosts.plays;
  if (visit) noted = null;
  if (!$('levels').hidden && !noted && news.length && p - boosts.last.shop >= TEASE.shop.every && boosts.rest.shop <= p) {
    noted = news.map(i => i.key);
    boosts.named = [...new Set([...boosts.named, ...noted])];
    boosts.last.shop = p;
    saveBoosts();
  }
  // still in reach and not yet seen in the Shop
  const shown = noted ? fresh.filter(i => noted.includes(i.key)) : [];
  $('menuShop').classList.toggle('nudge', news.length > 0);
  $('openShop').classList.toggle('nudge', shown.length > 0);
  $('menuShop').querySelector('.dotNew').hidden = !fresh.length;
  // the bubble belongs to the map, under no card
  if ($('levels').hidden || !shown.length || COVERS.some(id => !$(id).hidden)) { note.hidden = true; return; }
  // one part and one aircraft when both are in reach, so the note shows the range on offer
  const part = shown.find(i => i.key.startsWith('part')), plane = shown.find(i => i.key.startsWith('plane')), pick = part && plane ? [part, plane] : shown.slice(0, SHOP.nudgeNames);
  const names = pick.map(i => i.name).join(' or ') + (shown.length > pick.length ? ' and more' : '');
  note.textContent = `You have $${money}. Enough for ${names} in the Shop`;
  note.hidden = false;
  // the bubble hangs under the Shop button, kept on screen; it is measured from the left edge, since a fixed bubble left
  // where a turned phone's screen now ends would be measured squeezed
  note.style.left = '0px';
  const b = btn.getBoundingClientRect(), w = note.offsetWidth, mid = b.left + b.width / 2, left = Math.max(12, Math.min(innerWidth - w - 12, mid - w / 2));
  note.style.left = `${left}px`;
  note.style.top = `${b.bottom + 10}px`;
  note.style.setProperty('--tip', `${mid - left}px`);
}

function settleNudge() {
  const { money } = loadProgress();
  settings.shopSeen = [...new Set([...settings.shopSeen, ...affordable(money).map(i => i.key)])];
  saveSettings();
  nudgeShop();
}

// Opens on a tab with an aircraft picked: the one asked for, else the one being flown.
export function openShop({ tab: t = 'planes', pick: p = null } = {}) {
  tab = t;
  // a save may name an aircraft no longer in the fleet (a developer owns every key), so the pick falls back to a real one
  pick = known(p) ? p : known(settings.plane) ? settings.plane : AIRCRAFT[0].key;
  $('shop').hidden = false;
  $('shop').querySelector('.pageBody').scrollTop = 0;
  render();
  if (tab === 'planes') sizeStage();
  settleNudge();
}

// The note's own button opens on Upgrades when only parts are new; read before settleNudge marks them seen. A developer
// owns every aircraft, so only parts are ever new there, and the hangar opens first.
export function openFromNudge() {
  const f = freshNow();
  openShop({ tab: !settings.dev && f.length && f.every(i => i.key.startsWith('part')) ? 'parts' : 'planes' });
}

// the picked aircraft hovering over a soft shadow with its rotors turning, a few times a second
let drawnAt = 0;
export function drawHangar(time) {
  if (tab !== 'planes' || !pick || time - drawnAt < HANGAR.previewEvery) return;
  drawnAt = time;
  const h = HANGAR, c = $('preview'), g = c.getContext('2d'), m = AIRCRAFT.find(a => a.key === pick), lift = Math.sin(time * 2 * Math.PI / h.bobSecs) * h.bob;
  // fitted by height, and by width too, so a wide aircraft on a narrow phone clears the name in the corner
  const k = Math.min(c.height / h.previewHeight, c.width * h.stageFill / (2 * m.span));
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, c.width, c.height);
  g.setTransform(k, 0, 0, k, c.width / 2, c.height / 2);
  g.fillStyle = h.shadow;
  g.beginPath();
  g.ellipse(0, h.floor, h.shadowW - lift, h.shadowH, 0, 0, 2 * Math.PI);
  g.fill();
  g.translate(0, lift);
  drawAirframe(g, pick, time);
}

// onSpend hears what a purchase cost; onReserve says how much of the money an order aboard holds back.
export function initShop(onSpend, onReserve) {
  spend = onSpend || spend;
  reserve = onReserve || reserve;
  for (const id of ['openShop', 'shopNudge', 'menuShop']) $(id).addEventListener('click', openFromNudge);
  $('pauseHangar').addEventListener('click', () => openShop());
  // the in-flight hint names an aircraft ("try Heavy Lifter from the Shop"), so the hangar opens with it picked
  $('hangarTip').addEventListener('click', () => openShop({ pick: AIRCRAFT.find(a => $('hangarTip').textContent.includes(a.name))?.key }));
  $('shopClose').addEventListener('click', () => {
    $('shop').hidden = true;
    nudgeShop();
    // the pause card under it shows the money and what leaving costs, which a purchase changes
    refreshPause();
  });
  $('shop').addEventListener('click', act);
  // a turned phone moves the Shop button, so the note under it follows, and an open Shop sizes its picture again; a turn
  // fires several resizes in a row, so the work waits for the next frame and is done once there
  let fitting = 0;
  addEventListener('resize', () => {
    cancelAnimationFrame(fitting);
    fitting = requestAnimationFrame(() => {
      if (!$('levels').hidden) {
        fitBar();
        nudgeShop();
      }
      if (shopOpen() && tab === 'planes') sizeStage();
    });
  });
}
