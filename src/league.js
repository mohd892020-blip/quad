import { LEAGUE } from './config.js';
import { loadProgress } from './storage.js';

const $ = id => document.getElementById(id);

// The player's score against a fixed ladder of computer pilots. Nothing here leaves the device.
function standings() {
  const { stars, del } = loadProgress(), total = Object.values(stars).reduce((sum, s) => sum + s, 0);
  const you = { name: 'You', score: total * LEAGUE.perStar + del * LEAGUE.perDelivery, you: true };
  const rows = [you, ...LEAGUE.pilots.map(([name, score]) => ({ name, score }))].sort((a, b) => b.score - a.score);
  return { rows, rank: rows.indexOf(you) + 1 };
}

export function initLeague() {
  $('openLeague').addEventListener('click', () => {
    const { rows, rank } = standings();
    $('leagueRank').textContent = `You are ${rank} of ${rows.length}`;
    $('leagueRows').innerHTML = rows.map((r, i) => `<li class="${r.you ? 'you' : ''}"><b>${i + 1}</b><span>${r.name}</span><em>${r.score}</em></li>`).join('');
    $('league').hidden = false;
  });
  $('leagueClose').addEventListener('click', () => { $('league').hidden = true; });
}
