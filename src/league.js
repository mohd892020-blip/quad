import { LEAGUE, ONLINE } from './config.js';
import { loadProgress, online, saveOnline } from './storage.js';
import { checkName, nameChars, onlineReady, readBoard, sendScore } from './online.js';
import { scoreText } from './ui.js';

const $ = id => document.getElementById(id);
// names come from other players; the rules allow only safe letters, but nothing from the board is trusted as markup
const safe = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const NAME_RULE = `${ONLINE.name.min} to ${ONLINE.name.max} English letters, numbers or spaces`;
const row = (place, name, score, you) => `<li class="${you ? 'you' : ''}"><b>${place}</b><span>${safe(name)}</span><em>${scoreText(score)}</em></li>`;

const myScore = () => {
  const { stars, del } = loadProgress(), total = Object.values(stars).reduce((sum, s) => sum + s, 0);
  return total * LEAGUE.perStar + del * LEAGUE.perDelivery;
};

// The player's score against a fixed ladder of pilots kept on this device. Nothing here leaves the device.
function standings() {
  const you = { name: 'You', score: myScore(), you: true };
  const rows = [you, ...LEAGUE.pilots.map(([name, score]) => ({ name, score }))].sort((a, b) => b.score - a.score);
  return { rows, rank: rows.indexOf(you) + 1 };
}

function showRank(rank, of, score) {
  $('leagueRank').textContent = `#${rank}`;
  $('leagueOf').textContent = `of ${scoreText(of)} pilot${of === 1 ? '' : 's'} · ${scoreText(score)} points`;
}

function showLadder() {
  const { rows, rank } = standings();
  showRank(rank, rows.length, rows[rank - 1].score);
  $('leagueRows').innerHTML = rows.map((r, i) => row(i + 1, r.name, r.score, r.you)).join('');
  $('leagueHow').textContent = `${LEAGUE.perStar} points a star, ${LEAGUE.perDelivery} a delivery. Saved on this device`;
}

function status(text, bad = false) {
  $('leagueStatus').textContent = text;
  $('leagueStatus').classList.toggle('bad', bad);
}

// the name form while there is no nickname (or it is being changed), the nickname and Change once there is
function showName(editing = false) {
  const asking = editing || !online.name;
  $('nameForm').hidden = !asking;
  $('nameShow').hidden = asking;
  $('nameNow').textContent = online.name;
  $('leagueNote').hidden = !asking;
  if (asking) $('nameInput').value = online.name;
  // a player already on the board saves a new nickname rather than joining
  $('nameJoin').textContent = online.name ? 'Save' : 'Join';
}

// brings the player's row up only when it starts below the fold, so the rank at the top stays in sight
function revealMine() {
  const body = $('league').querySelector('.pageBody'), mine = $('league').querySelector('.you');
  if (mine && mine.getBoundingClientRect().bottom > body.getBoundingClientRect().bottom) mine.scrollIntoView?.({ block: 'end' });
}

// Each look at the world board gets a number, so an answer that comes back after a newer look is dropped.
let look = 0;
async function showWorld() {
  const mine = ++look;
  let score = myScore();
  status('Loading the world board…');
  try {
    if (online.name && score > online.sent) await sendScore(online.name, score);
    // the board may hold more than this device has now, after a progress reset
    score = Math.max(score, online.sent);
    const board = await readBoard(score), { rows, total } = board;
    if (mine !== look) return;
    // the board's own row wins over this device's count when it is higher
    const own = rows.find(r => r.uid === online.uid), inTop = !!own;
    let { rank } = board;
    if (own && own.score > score) {
      score = own.score;
      rank = rows.indexOf(own) + 1;
      online.sent = Math.max(online.sent, own.score);
      saveOnline();
    }
    showRank(rank, Math.max(total, rank), score);
    // the result card's teaser reads this between visits: the pilot just above, or the last of the top when out of it
    const ahead = inTop ? rows[rows.indexOf(own) - 1] : rows[rows.length - 1];
    online.board = { rank, total: Math.max(total, rank), above: ahead && rank > 1 ? { name: ahead.name, score: ahead.score, top: !inTop } : null };
    saveOnline();
    $('leagueRows').innerHTML = rows.map((r, i) => row(i + 1, r.name, r.score, r.uid === online.uid)).join('')
      + (inTop ? '' : `<li class="gap">⋯</li>${row(rank, online.name, score, true)}`);
    $('leagueHow').textContent = `${LEAGUE.perStar} points a star, ${LEAGUE.perDelivery} a delivery. World board`;
    status(rows.length ? '' : 'Be the first pilot on the world board');
    revealMine();
  } catch (_) {
    if (mine !== look) return;
    showLadder();
    status('Offline. Showing the pilots on this device', true);
  }
}

export function openLeague() {
  showLadder();
  // Rush Hour stands apart: its best is shown here, never added to the ladder's score
  const { rush } = loadProgress();
  $('leagueRush').hidden = !rush.runs;
  $('leagueRush').textContent = `Rush Hour best ${scoreText(rush.best)} · most drops ${rush.del}`;
  const world = onlineReady();
  $('leagueOnline').hidden = !world;
  $('leagueNote').hidden = true;
  $('league').hidden = false;
  $('league').querySelector('.pageBody').scrollTop = 0;
  revealMine();
  if (!world) return;
  showName();
  if (online.name) showWorld();
  else status('Join the world board to race real pilots');
}

async function join(e) {
  e.preventDefault();
  const { name, error } = checkName($('nameInput').value);
  if (error) {
    status(error === 'rude' ? 'Please pick a friendlier nickname' : `Use ${NAME_RULE}`, true);
    return;
  }
  $('nameInput').blur();
  const before = online.name;
  online.name = name;
  online.sent = -1;
  showName();
  await showWorld();
  // the first send failed: keep the form so the player can try again
  if (online.sent < 0) {
    online.name = before;
    saveOnline();
    showName(true);
    $('nameInput').value = name;
  }
}

// The High Score button on a result card, won or lost: where the player stands and who is next to pass, so the board is
// worth a look. On this device's ladder a climb since the last card is called out; the world board answers from its last
// visit, as asking it at every card would cost a wait.
let lastRank = 0;
const passLine = (gap, name) => `${scoreText(gap)} points to pass ${name}${gap <= LEAGUE.perStar ? '. One star does it' : ''}`;
function scoreTease() {
  const score = myScore();
  if (onlineReady()) {
    const b = online.board, a = b?.above;
    if (!online.name) return { title: 'Join the world High Score', line: 'Race real pilots for the top spot' };
    if (!b) return { title: 'World High Score', line: 'See where you stand among real pilots' };
    if (b.rank === 1) return { title: '#1 in the world', line: 'Defend your crown' };
    const gap = a ? a.score - score : 0, line = !a ? 'Climb the world board'
      : gap < 0 ? `You may have passed ${a.top ? `into the top ${ONLINE.top}` : a.name}. Check now`
      : a.top ? `${scoreText(gap)} points to reach the top ${ONLINE.top}` : passLine(gap, a.name);
    return { title: `#${scoreText(b.rank)} of ${scoreText(b.total)} pilots`, line };
  }
  const { rows, rank } = standings(), up = lastRank > 0 && rank < lastRank;
  lastRank = rank;
  if (rank === 1) return { title: up ? 'NEW #1!' : '#1 on High Score', line: 'Defend your crown', up };
  const ahead = rows[rank - 2];
  return { title: up ? `UP TO #${rank}!` : `#${rank} on High Score`, line: passLine(ahead.score - score, ahead.name), up };
}

export function teaseScores(show) {
  const btn = $('resultScores');
  btn.hidden = !show;
  if (!show) return;
  const { title, line, up } = scoreTease();
  btn.querySelector('b').textContent = title;
  btn.querySelector('small').textContent = line;
  btn.classList.toggle('up', !!up);
  btn.setAttribute('aria-label', `High Score. ${title}. ${line}`);
}

export function initLeague() {
  if (!onlineReady()) lastRank = standings().rank;
  $('resultScores').addEventListener('click', openLeague);
  for (const id of ['openLeague', 'menuScores']) $(id).addEventListener('click', openLeague);
  $('leagueClose').addEventListener('click', () => { $('league').hidden = true; });
  $('nameInput').maxLength = ONLINE.name.max;
  // anything but English letters, digits and spaces never reaches the field
  $('nameInput').addEventListener('input', () => {
    const field = $('nameInput'), kept = nameChars(field.value);
    if (kept !== field.value) field.value = kept;
  });
  $('nameForm').addEventListener('submit', join);
  $('nameEdit').addEventListener('click', () => { showName(true); $('nameInput').focus(); });
}
