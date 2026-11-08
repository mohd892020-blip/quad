import { buzz, hushVoice, sfx, speak } from './audio.js';
import { CALL } from './config.js';
import { homeName, homeOf } from './homes.js';
import { bandBottom, covers, modalOpen, view, X, Y } from './ui.js';
import { rng } from './world.js';

// Every order comes in as a phone call: a card rings on the left under the HUD, answers itself (or a tap or Enter does),
// and the caller says what they want in a babble made on the device while the words show one by one. It runs once a
// frame in real time from the loop and only reads the game, so it never moves the flight; a pause ends it (a call not
// yet answered rings again after), and it never shows on the last stretch to the customer.
let clock = 0, live = null, queue = [], held = [], owner = null, calledFor = null, lastEnd = -Infinity, rect = null, measuredAt = 0, drop = 0, faint = false, east = false;
// the aircraft's guard box and the card's other side, filled in place each frame
const plane = [0, 0, 0, 0], other = [0, 0, 0, 0];
const $ = id => document.getElementById(id);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const meets = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

// A caller's voice from their household's place in the list, so the five on the first missions all sound apart.
export function voiceOf(h) {
  const v = CALL.voice, k = (h.i * 5 + v.offset) % v.steps;
  return {
    hz: v.pitch[0] + (v.pitch[1] - v.pitch[0]) * k / (v.steps - 1),
    speed: v.speed[0] + (v.speed[1] - v.speed[0]) * ((h.i * 3) % 4) / 3,
    shift: 1 + (((h.i * 7) % 5) - 2) * v.shift,
  };
}

// The babble for a line: a syllable for each vowel group (one to three a word), a pause after punctuation, the line's
// first syllable a little up, a question rising and an exclamation falling at its end. A line longer than room speeds
// up to maxSpeedUp, and the syllables that still do not end in time are dropped whole (cut counts them), so the voice
// never stops inside one. The same line from the same caller always sounds the same.
export function babblePlan(text, h, v, room) {
  const c = CALL.voice, r = rng(CALL.seed + h.i * 97 + text.length), dur = c.syll / v.speed, syl = [], words = [];
  let at = 0;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const n = clamp((word.match(/[aeiouy]+/gi) || []).length, 1, 3), ask = word.endsWith('?'), bang = word.endsWith('!');
    words.push({ at });
    for (let k = 0; k < n; k++) {
      const up = (syl.length ? 0 : c.lift) + (ask ? c.rise : 0) - (bang && k === n - 1 ? c.fall : 0);
      const hz = v.hz * 2 ** ((up + (r() - .5) * c.wobble) / 12), [f1, f2] = c.vowels[(r() * c.vowels.length) | 0];
      syl.push({ at, dur, hz, f1, f2 });
      at += dur;
    }
    at += /[,.!?]$/.test(word) ? c.pause : c.gap;
  }
  const natural = syl.length ? syl[syl.length - 1].at + dur : 0;
  let s = 1, kept = syl, secs = natural;
  if (natural > room) {
    s = Math.min(natural / room, c.maxSpeedUp);
    for (const x of syl) { x.at /= s; x.dur /= s; }
    kept = syl.filter(x => x.at + x.dur <= room + 1e-9);
    const end = kept[kept.length - 1];
    secs = end ? end.at + end.dur : 0;
    for (const w of words) w.at = Math.min(w.at / s, secs);
  }
  return { secs, syl: kept, words, fast: s, cut: syl.length - kept.length };
}

// What the caller asks for, in their words: one item, or a tied pair as two of one or one and another.
const one = i => CALL.ask[i.key]?.[0] ?? `a ${i.label.toLowerCase()}`;
const ask = item => (item.parts ? (item.parts[0] === item.parts[1] ? CALL.ask[item.parts[0].key]?.[1] ?? `two of ${one(item.parts[0])}` : `${one(item.parts[0])} and ${one(item.parts[1])}`) : one(item));
const cap = s => s[0].toUpperCase() + s.slice(1);
const fill = (tpl, h, item, prev, home = '') => tpl.replace('{who}', h.first).replace('{prev}', prev ?? '').replace('{Ask}', cap(ask(item))).replace('{ask}', ask(item)).replace('{home}', home);

// The calls an order brings: one for each customer, a Double Run's second one waiting. A later stop's call is shorter,
// a handed-on order's caller says who passes it on, and Rush keeps them quick.
export function callsFor(st) {
  if (st.level.training) return [];
  const s = st.stop, rush = !!st.level.rush, prev = homeOf(st.level.stops[st.stopAt - 1]?.t)?.first;
  const list = s.parcels ? s.parcels.map((p, k) => ({ t: p.t, item: p.item, k })) : [{ t: s.t, item: s.item, k: 0 }];
  return list.flatMap(({ t, item, k }) => {
    const h = homeOf(t);
    if (!h) return [];
    const kind = rush ? 'rush' : s.handOn ? 'hand' : st.stopAt > 0 || k > 0 ? 'short' : 'first';
    const set = CALL.lines[kind === 'rush' ? 'rush' : s.rescue ? 'rescue' : item.urgent && (kind === 'first' || kind === 'short') ? 'urgent' : kind];
    const v = (h.i + (rush ? st.rush?.del ?? 0 : st.level.n - 1 + st.stopAt)) % set.length, vo = voiceOf(h);
    const say = text => {
      const talk = clamp(babblePlan(text, h, vo, Infinity).secs + CALL.linger, ...CALL.kinds[kind].talk);
      return { text, talk, plan: babblePlan(text, h, vo, talk - CALL.linger) };
    };
    // a line too long to show, or to say whole in its time, gives way to the short one of its kind
    let line = say(fill(set[v], h, item, prev));
    if (line.text.length > CALL.maxChars || line.plan.cut) line = say(fill(CALL.lines.tight[rush ? 'rush' : item.urgent ? 'urgent' : 'plain'], h, item, prev));
    const home = homeName(t, t === s.t ? s.place : null, true);
    const state = fill(k > 0 ? CALL.states.waiting : CALL.states.ring, h, item, prev, home);
    return [{ h, t, item, kind, ...line, state, ring: CALL.kinds[kind].ring, vo }];
  });
}

// Initials for the avatar: a couple's home both of theirs ("Bill & Louise Home" B&L), otherwise the caller's ("Tara" T,
// "Anna Miller" AM).
function initials(h) {
  const words = (h.sign ?? h.own).split(' '), amp = words.indexOf('&');
  if (amp > 0 && words[amp + 1]) return `${words[amp - 1][0]}&${words[amp + 1][0]}`.toUpperCase();
  return h.caller.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

// the card's class: its phase, faint, and the side it moved to, which it keeps until the call is gone
const show = phase => { $('call').className = phase + (faint ? ' faint' : '') + (east ? ' east' : ''); };

function ring(c) {
  Object.assign(c, { phase: 'ring', start: clock, answerAt: clock + c.ring, nextRing: clock + CALL.ringEvery, said: 1 });
  $('callWho').textContent = c.h.caller;
  $('callLine').textContent = c.state;
  $('callFace').textContent = initials(c.h);
  const el = $('call');
  el.style.setProperty('--face', CALL.faces[c.h.i % CALL.faces.length]);
  faint = east = false;
  show('ring');
  el.hidden = false;
  $('callBtn').setAttribute('aria-label', 'Answer call');
  rect = null;
  sfx(c.kind === 'rush' ? 'phoneQuick' : 'phone');
  if (c.kind !== 'rush') buzz(CALL.buzz);
}

function answer() {
  Object.assign(live, { phase: 'talk', answeredAt: clock, talkEnd: clock + live.talk });
  show('talk');
  $('callBtn').setAttribute('aria-label', 'End call');
  // one span a word, each shown as the voice reaches it; built as text, so a name can never become markup
  const line = $('callLine'), frag = document.createDocumentFragment();
  live.text.split(/\s+/).filter(Boolean).forEach((w, k) => {
    const span = document.createElement('span');
    span.textContent = k ? ` ${w}` : w;
    if (k) span.className = 'unsaid';
    frag.appendChild(span);
  });
  line.textContent = '';
  line.appendChild(frag);
  live.spans = line.children;
  rect = null;
  sfx('answer');
  speak(live.plan, live.vo);
}

// hard: gone at once (a pause, a new mission, the mission decided); otherwise it fades, quietly on the approach.
function endCall(hard, quiet = false) {
  if (!live) return;
  hushVoice();
  faint = false;
  covers.card = null;
  if (hard) {
    $('call').hidden = true;
    live = null;
    rect = null;
    lastEnd = clock;
  } else {
    if (live.phase !== 'out' && !quiet) sfx('hangup');
    live.phase = 'out';
    live.outEnd = clock + CALL.fade;
    show('out');
    // the next call waits for this card to be gone, so it reads as a new ring
    lastEnd = live.outEnd;
  }
}

export const callLive = () => !!live && live.phase !== 'out';

// The card's tap and Enter: answer a ringing call, end one that talks.
function press() {
  if (live?.phase === 'ring') answer();
  else if (live?.phase === 'talk') endCall(false);
}

export function stepCall(st, dt, paused, spot) {
  if (st !== owner) {
    endCall(true);
    queue = [];
    held = [];
    calledFor = null;
    owner = st;
  }
  // a pause card, the map or a result card never sits on a call; a pause keeps the calls not yet answered for after
  if (paused || st.done || st.outcome || st.wreck || st.falling || st.level.training) {
    if (live || queue.length) {
      held = paused ? (live?.phase === 'ring' ? [live, ...queue] : queue) : [];
      endCall(true);
      queue = [];
    } else if (!paused) held = [];
    return;
  }
  clock += dt;
  if (held.length) {
    for (const c of held) queue.push({ ...c, at: clock + CALL.laterAt });
    held = [];
  }
  // the order comes in: a shop starts making it, or a customer ties the next one on; the stop object marks it, so landing
  // again never calls twice, and Rush's fresh stop for each order always rings
  if (calledFor !== st.stop && (st.prep || (st.has && st.stop.handOn))) {
    calledFor = st.stop;
    const at = clock + (st.prep?.opening ? CALL.firstAt : st.prep ? CALL.laterAt : CALL.handAt);
    for (const c of callsFor(st)) queue.push({ ...c, at });
  }
  // the last stretch to the customer belongs to the flying
  const o = st.order;
  if (st.has && Math.abs(o.t.x - st.d.x) < Math.min(CALL.approach, CALL.approachShare * Math.abs(o.t.x - o.fromX))) {
    queue = [];
    if (live && live.phase !== 'out') endCall(false, true);
  }
  if (!live && queue[0] && clock >= queue[0].at && clock >= lastEnd + CALL.between) ring((live = queue.shift()));
  if (!live) return;
  if (live.phase === 'ring') {
    if (clock >= live.nextRing && live.nextRing + CALL.ringTail < live.answerAt) {
      sfx(live.kind === 'rush' ? 'phoneQuick' : 'phone');
      live.nextRing += CALL.ringEvery;
    }
    if (clock >= live.answerAt) answer();
  } else if (live.phase === 'talk') {
    const words = live.plan.words, spoken = clock - live.answeredAt;
    while (live.said < live.spans.length && (words[live.said]?.at ?? 0) <= spoken) live.spans[live.said++].classList.remove('unsaid');
    if (clock >= live.talkEnd) endCall(false);
  } else {
    // a fading card stays where it is and fades all the way
    if (clock >= live.outEnd) {
      $('call').hidden = true;
      live = null;
      rect = null;
    }
    return;
  }
  if (live.phase !== 'out') place(st, spot);
}

// Whether a card at r would cover the pointer or the flying aircraft (parked on its pad it is under the shop's note,
// and only the opening shot swings it by), and whether it would cover that note.
function blocks(r, st, spot) {
  const boxes = spot?.boxes;
  if (boxes) for (let i = 0; i < boxes.length; i++) if (meets(r, boxes[i])) return true;
  return !st.prep && meets(r, plane);
}
const onNote = r => !!covers.note && meets(r, covers.note);

// The card steps under a toast or the hangar's tip. Over the pointer, the aircraft or the shop's note it moves across to
// the right once, where the screen is wide enough for that to clear them, and fades only while it still covers the
// pointer or the aircraft; a note it still covers gives way under it.
function place(st, spot) {
  const el = $('call'), d = Math.max(0, bandBottom() + CALL.gap - (view.top + CALL.below));
  if (d !== drop) {
    // it steps down at once, so a toast that just came never shows under it, and back up smoothly
    el.classList.toggle('snap', d > drop);
    drop = d;
    el.style.setProperty('--callDrop', `${d}px`);
    rect = null;
  }
  // layout offsets, so the entry animation and the drop's transform never skew them; read twice a second at most
  if (!rect || clock - measuredAt > CALL.remeasure) {
    rect = [el.offsetLeft, el.offsetTop + drop, el.offsetLeft + el.offsetWidth, el.offsetTop + drop + el.offsetHeight];
    measuredAt = clock;
  }
  const g = CALL.guard, x = X(st.d.x), y = Y(st.d.y);
  plane[0] = x - g.x;
  plane[1] = y - g.up;
  plane[2] = x + g.x;
  plane[3] = y + g.down;
  let over = blocks(rect, st, spot);
  if (!east && (over || onNote(rect))) {
    const right = (el.offsetParent?.clientWidth ?? view.W) - CALL.east;
    other[0] = right - (rect[2] - rect[0]);
    other[1] = rect[1];
    other[2] = right;
    other[3] = rect[3];
    if (other[0] > rect[0] + 1 && !blocks(other, st, spot) && (over || !onNote(other))) {
      east = true;
      el.classList.add('east');
      rect = other.slice();
      measuredAt = clock;
      over = false;
    }
  }
  covers.card = rect;
  if (over !== faint) {
    faint = over;
    el.classList.toggle('faint', over);
  }
}

export function initCall() {
  const el = $('call');
  el.style.setProperty('--callFaint', CALL.faint);
  el.style.setProperty('--callEast', `${CALL.east}px`);
  // pointerdown, so the card never takes focus and a second finger works while the first steers
  el.addEventListener('pointerdown', e => {
    e.preventDefault();
    press();
  });
  // a real tap already answered on pointerdown; only a keyboard or assistive click (detail 0) counts here
  el.addEventListener('click', e => { if (e.detail === 0) press(); });
  // Enter, as H is Hold; the flight keys are never taken
  addEventListener('keydown', e => {
    if ((e.code === 'Enter' || e.code === 'NumpadEnter') && !e.repeat && e.target?.tagName !== 'INPUT' && live && live.phase !== 'out' && !modalOpen()) {
      e.preventDefault();
      press();
    }
  });
  addEventListener('resize', () => { rect = null; });
}
