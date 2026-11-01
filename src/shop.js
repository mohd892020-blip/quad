import { sfx } from './audio.js';
import { AIRCRAFT, HANGAR, SHOP } from './config.js';
import { drawAirframe } from './drone.js';
import { garage, loadProgress, owns, saveGarage, saveProgress, saveSettings, settings } from './storage.js';
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
  return `<div class="shopRow"><canvas data-plane="${a.key}" width="144" height="72" aria-hidden="true"></canvas><p><b>${a.name}</b><small class="${badge.stat}">${badge.text}</small></p>${action}</div>`;
}

function drawTiles() {
  for (const c of $('shopPlanes').querySelectorAll('canvas')) {
    const g = c.getContext('2d'), k = c.height / HANGAR.previewHeight;
    g.setTransform(k, 0, 0, k, c.width / 2, c.height / 2);
    drawAirframe(g, c.dataset.plane, 0);
  }
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
  $('openShop').addEventListener('click', () => {
    render();
    $('shop').hidden = false;
  });
  $('shopClose').addEventListener('click', () => { $('shop').hidden = true; });
  $('shop').addEventListener('click', act);
}
