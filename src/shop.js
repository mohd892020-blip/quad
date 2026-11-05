import { sfx } from './audio.js';
import { AIRCRAFT, HANGAR, SHOP } from './config.js';
import { drawAirframe } from './drone.js';
import { bought, garage, loadProgress, owns, saveGarage, saveProgress, saveSettings, settings } from './storage.js';
import { badgeFor, markPlanes } from './ui.js';

const $ = id => document.getElementById(id);
const pipLevels = SHOP.partPrices.length;

function pay(price) {
  const { del, money } = loadProgress();
  if (money < price) return false;
  saveProgress(del, money - price);
  sfx('pickup');
  return true;
}

const buyButton = (price, money, data) => `<button class="go" ${data} ${money < price ? 'disabled' : ''}>$${price}</button>`;

function partRow(p, money) {
  const level = Math.min(garage.parts[p.key] || 0, pipLevels), price = SHOP.partPrices[level];
  const pips = '●'.repeat(level) + '○'.repeat(pipLevels - level);
  return `<div class="shopRow"><p><b>${p.name}</b><small>${p.note}</small></p><span>${pips}</span>${level < pipLevels ? buyButton(price, money, `data-part="${p.key}"`) : '<em>Max</em>'}</div>`;
}

function planeRow(a, money) {
  const badge = badgeFor(a);
  const action = settings.plane === a.key ? '<em>Flying</em>'
    : owns(a.key) ? `<button class="ghost" data-use="${a.key}">Use</button>`
    : buyButton(SHOP.aircraft[a.key], money, `data-buy="${a.key}"`);
  return `<div class="shopRow${bought(a.key) ? '' : owns(a.key) ? ' devMark' : ''}"><canvas data-plane="${a.key}" width="144" height="72" aria-hidden="true"></canvas><p><b>${a.name}</b><small class="${badge.stat}">${badge.text}</small></p>${action}</div>`;
}

function drawTiles() {
  for (const c of $('shopPlanes').querySelectorAll('canvas')) {
    const g = c.getContext('2d'), k = c.height / HANGAR.previewHeight;
    g.setTransform(k, 0, 0, k, c.width / 2, c.height / 2);
    drawAirframe(g, c.dataset.plane, 0);
  }
}

// What the money buys now: the next level of each part and every aircraft not yet owned, cheapest first.
function affordable(money) {
  const parts = SHOP.parts.filter(p => (garage.parts[p.key] || 0) < pipLevels)
    .map(p => ({ key: `part:${p.key}:${garage.parts[p.key] || 0}`, name: p.name, price: SHOP.partPrices[garage.parts[p.key] || 0] }));
  const planes = AIRCRAFT.filter(a => !owns(a.key) && SHOP.aircraft[a.key]).map(a => ({ key: `plane:${a.key}`, name: `the ${a.name}`, price: SHOP.aircraft[a.key] }));
  return [...parts, ...planes].filter(i => i.price <= money).sort((a, b) => a.price - b.price);
}

// When the money first covers something new, a soft note under the Shop button says what; opening the shop settles it.
export function nudgeShop() {
  const { money } = loadProgress(), fresh = affordable(money).filter(i => !settings.shopSeen.includes(i.key)), note = $('shopNudge'), btn = $('openShop');
  btn.classList.toggle('nudge', fresh.length > 0);
  if (!fresh.length) { note.hidden = true; return; }
  // one part and one aircraft when both are in reach, so the note shows the range on offer
  const part = fresh.find(i => i.key.startsWith('part')), plane = fresh.find(i => i.key.startsWith('plane')), pick = part && plane ? [part, plane] : fresh.slice(0, SHOP.nudgeNames);
  const names = pick.map(i => i.name).join(' or ') + (fresh.length > pick.length ? ' and more' : '');
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

function render() {
  const { money } = loadProgress();
  $('shopMoney').textContent = `$${money}`;
  $('levelsMoney').textContent = `$${money}`;
  $('shopParts').innerHTML = SHOP.parts.map(p => partRow(p, money)).join('');
  $('shopPlanes').innerHTML = AIRCRAFT.map(a => planeRow(a, money)).join('');
  drawTiles();
}

function act(e) {
  const b = e.target.closest?.('button');
  if (!b || b.disabled) return;
  const { part, buy, use } = b.dataset;
  if (part) {
    const level = garage.parts[part] || 0;
    if (!pay(SHOP.partPrices[level])) return;
    garage.parts[part] = level + 1;
    saveGarage();
  } else if (buy) {
    if (!pay(SHOP.aircraft[buy])) return;
    garage.owned.push(buy);
    saveGarage();
  }
  if (buy || use) {
    settings.plane = buy || use;
    saveSettings();
    markPlanes();
  }
  render();
}

export function initShop() {
  const open = () => {
    render();
    $('shop').hidden = false;
    settleNudge();
  };
  $('openShop').addEventListener('click', open);
  $('shopNudge').addEventListener('click', open);
  $('shopClose').addEventListener('click', () => {
    $('shop').hidden = true;
    nudgeShop();
  });
  $('shop').addEventListener('click', act);
  // a turned phone moves the Shop button, so the note under it follows
  addEventListener('resize', () => { if (!$('levels').hidden) nudgeShop(); });
}
