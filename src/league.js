import { LEAGUE } from './config.js';
import { loadProgress } from './storage.js';
import { scoreText } from './ui.js';

const $ = id => document.getElementById(id);

// The player's score against a fixed ladder of pilots kept on this device. Nothing here leaves the device.
function standings() {
  const { stars, del } = loadProgress(), total = Object.values(stars).reduce((sum, s) => sum + s, 0);
  const you = { name: 'You', score: total * LEAGUE.perStar + del * LEAGUE.perDelivery, you: true };
  const rows = [you, ...LEAGUE.pilots.map(([name, score]) => ({ name, score }))].sort((a, b) => b.score - a.score);
  return { rows, rank: rows.indexOf(you) + 1 };
}

export function openLeague() {
  const { rows, rank } = standings(), you = rows[rank - 1];
  $('leagueRank').textContent = `#${rank}`;
  $('leagueOf').textContent = `of ${rows.length} pilots · ${scoreText(you.score)} points`;
  $('leagueRows').innerHTML = rows.map((r, i) => `<li class="${r.you ? 'you' : ''}"><b>${i + 1}</b><span>${r.name}</span><em>${scoreText(r.score)}</em></li>`).join('');
  $('leagueHow').textContent = `${LEAGUE.perStar} points a star, ${LEAGUE.perDelivery} a delivery. Saved on this device`;
  // Rush Hour stands apart: its best is shown here, never added to the ladder's score
  const { rush } = loadProgress();
  $('leagueRush').hidden = !rush.runs;
  $('leagueRush').textContent = `Rush Hour best ${scoreText(rush.best)} · most drops ${rush.del}`;
  $('league').hidden = false;
  const body = $('league').querySelector('.pageBody'), mine = $('league').querySelector('.you');
  body.scrollTop = 0;
  // the player's row is brought up only when it starts below the fold, so the rank at the top stays in sight
  if (mine && mine.getBoundingClientRect().bottom > body.getBoundingClientRect().bottom) mine.scrollIntoView?.({ block: 'end' });
}

export function initLeague() {
  for (const id of ['openLeague', 'menuScores']) $(id).addEventListener('click', openLeague);
  $('leagueClose').addEventListener('click', () => { $('league').hidden = true; });
}
