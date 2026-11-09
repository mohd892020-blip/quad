import { buzz, clipLoading, clipOf, hushVoice, loadClip, sayClip, sfx, speak } from './audio.js';
import { CALL } from './config.js';
import { answerOrder } from './delivery.js';
import { homeName, homeOf } from './homes.js';
import { bandBottom, covers, modalOpen, view, X, Y } from './ui.js';
import { askLine, callerOf, clipName, greetLine, turnOf } from './voice.js';
import { rng } from './world.js';

// Every order comes in as a phone call. The card rings on the left under the HUD until the player answers it (a tap on
// the card or its button, or Enter); an order waits for its call (delivery.js), and the moment it is answered it is
// ready. The caller then says it in a recorded voice, a man's or a woman's as their title says, with the words showing
// as they are said; a missing line falls back to a babble made on the device. Rush rings once and lifts off as the
// answer. It runs once a frame in real time and only reads the game, except answerOrder.
let clock = 0, live = null, next = null, owner = null, calledFor = null, again = false, lastEnd = -Infinity, rect = null, measuredAt = 0, drop = 0, faint = false, east = false, back = false, nudged = false;
// what has been answered, so a Rush order never rings twice
const heard = new WeakSet();
// the aircraft's guard box and the card's two sides, filled in place
const plane = [0, 0, 0, 0], other = [0, 0, 0, 0], west = [0, 0, 0, 0];
const $ = id => document.getElementById(id);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const meets = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

// A caller's babble voice: its pitch by title, the rest from the household's place in the list, so neighbours sound apart.
export function voiceOf(h, c) {
  const v = CALL.voice, k = (h.i * 5 + v.offset) % v.steps, pitch = v.pitch[c.male ? 'm' : 'f'];
  return {
    hz: pitch[0] + (pitch[1] - pitch[0]) * k / (v.steps - 1),
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

// What a call is for: an order waiting on its call, or a Rush order once its shop starts on it.
const gateOf = st => (st.ticket && !st.ticket.answered ? st.ticket : st.rush && (st.prep || st.has) && !heard.has(st.stop) ? st.stop : null);

// The call an order brings: its caller (a couple's two take turns), the greeting and the request in that caller's
// recorded voice, and the line under the name while it rings. An order with nobody to call it never waits.
function callFor(st, gate, at) {
  const ticket = gate === st.ticket ? gate : null, s = st.stop, t = ticket?.air ? st.order.t : s.parcels?.[0].t ?? s.t;
  const item = ticket?.air ? st.item : s.parcels?.[0].item ?? s.item, h = homeOf(t);
  if (!h) {
    if (ticket) {
      console.warn('call: no caller for this order');
      answerOrder(st);
    }
    return null;
  }
  const turn = turnOf(st), c = callerOf(h, turn), rush = !!st.rush;
  const set = rush ? 'rush' : s.rescue ? 'rescue' : item.urgent ? 'urgent' : 'plain';
  const segs = [rush ? null : greetLine(c), askLine(set, item, h.i + turn)].filter(Boolean).map(text => ({ text, name: clipName(c.voice, text) }));
  const kind = rush ? 'rush' : ticket?.air ? (st.order.drop === 2 ? 'drop' : 'hand') : 'ring';
  const state = CALL.states[kind].replace('{home}', homeName(t, t === s.t ? s.place : null, true));
  return { h, c, t, gate, ticket, rush, segs, state, vo: voiceOf(h, c), at };
}

// the card's class: its phase, faint, the side it moved to (kept until the call is gone), and a shake
const show = phase => { $('call').className = phase + (faint ? ' faint' : '') + (east ? ' east' : '') + (nudged ? ' nudge' : ''); };

function ring() {
  const c = live.c, el = $('call');
  Object.assign(live, { phase: 'ring', rings: 1, nextRing: clock + CALL.ringEvery, seg: -1, pend: null, pendAt: null });
  $('callWho').textContent = c.who;
  $('callLine').textContent = live.state;
  $('callFace').textContent = c.initials;
  el.style.setProperty('--face', CALL.faces[live.h.i % CALL.faces.length]);
  $('callBtn').setAttribute('aria-label', `Answer call from ${c.who}`);
  faint = east = back = false;
  show('ring');
  el.hidden = false;
  rect = null;
  // decoded while it rings, so the voice is ready the moment it is answered
  for (const s of live.segs) loadClip(s.name);
  sfx(live.rush ? 'phoneQuick' : 'phone');
  if (!live.rush) buzz(CALL.buzz);
}

function answer() {
  live.phase = 'talk';
  heard.add(live.gate);
  if (live.ticket) answerOrder(owner);
  show('talk');
  $('callBtn').setAttribute('aria-label', 'End call');
  sfx('answer');
  startSeg(0);
}

// One line of the call: its recorded voice at the caller's rate, each word showing as the voice reaches where it starts
// in the line; with no recording, the babble's own timing. A line still decoding is waited for a moment. Muted, or with
// no sound at all, the words keep the same time.
function startSeg(i) {
  const s = live.segs[i], c = live.c, buf = clipOf(s.name);
  if (!buf && clipLoading(s.name) && clock - (live.pendAt ??= clock) < CALL.speech.wait) {
    live.pend = i;
    return;
  }
  live.pend = live.pendAt = null;
  const words = s.text.split(/\s+/).filter(Boolean);
  let secs, at;
  if (buf) {
    secs = buf.duration / c.rate;
    let from = 0;
    at = words.map(w => {
      const k = s.text.indexOf(w, from);
      from = k + w.length;
      return secs * k / s.text.length;
    });
    sayClip(buf, c.rate);
  } else {
    const plan = babblePlan(s.text, live.h, live.vo, Infinity);
    secs = plan.secs;
    at = plan.words.map(w => w.at);
    speak(plan, live.vo);
  }
  // one span a word, built as text, so a name can never become markup
  const line = $('callLine'), frag = document.createDocumentFragment();
  words.forEach((w, k) => {
    const span = document.createElement('span');
    span.textContent = k ? ` ${w}` : w;
    if (k) span.className = 'unsaid';
    frag.appendChild(span);
  });
  line.textContent = '';
  line.appendChild(frag);
  Object.assign(live, { seg: i, at, said: 1, spans: line.children, segAt: clock, segEnd: clock + secs });
  rect = null;
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

// the music steps back while a call rings loud or talks, not through a long quiet wait
export const callLive = () => !!live && (live.phase === 'talk' || (live.phase === 'ring' && live.rings <= CALL.loud));
// what the ringing card is for, so the HUD asks for an answer only once there is a call to answer
export const ringingFor = () => (live?.phase === 'ring' ? live.gate : null);

// The card's tap and Enter: answer a ringing call, end one that talks.
function press() {
  if (live?.phase === 'ring') answer();
  else if (live?.phase === 'talk') endCall(false);
}

export function stepCall(st, dt, paused, spot) {
  if (st !== owner) {
    endCall(true);
    next = null;
    calledFor = null;
    again = false;
    owner = st;
  }
  // a pause card, the map or a result card never sits on a call; an order not yet answered rings again once play goes on
  if (paused || st.done || st.outcome || st.wreck || st.falling || st.level.training) {
    if (live || next) {
      again = !!next || live.phase === 'ring';
      endCall(true);
      next = null;
      calledFor = null;
    }
    return;
  }
  clock += dt;
  const gate = gateOf(st);
  if (!gate) again = false;
  else if (gate !== calledFor) {
    calledFor = gate;
    const k = st.ticket === gate ? gate : null;
    next = callFor(st, gate, clock + (again ? CALL.resumeAt : k?.opening ? CALL.firstAt : k?.air ? CALL.airAt : st.rush ? CALL.rushAt : CALL.nextAt));
    again = false;
    if (live && live.phase === 'talk') endCall(false);
  }
  // waiting on the pad, the call comes at once
  if (next && st.prep?.call) next.at = Math.min(next.at, clock + CALL.padAt);
  // the last stretch to the customer belongs to the flying; a call waiting on its answer is never cut
  const o = st.order;
  if (st.has && !st.ticket && Math.abs(o.t.x - st.d.x) < Math.min(CALL.approach, CALL.approachShare * Math.abs(o.t.x - o.fromX))) {
    if (live && live.phase === 'talk') endCall(false, true);
    if (next?.rush) next = null;
  }
  if (!live && next && clock >= next.at && clock >= lastEnd + CALL.between) {
    live = next;
    next = null;
    ring();
  }
  // reaching for the controls before answering shakes the card too
  const n = ((st.prep?.call ? st.prep : st.ticket)?.nudge ?? 0) > 0;
  if (n !== nudged) {
    nudged = n;
    $('call').classList.toggle('nudge', n);
  }
  if (!live) return;
  if (live.phase === 'ring') {
    // its order gone (the mission moved on), it stops; Rush takes lifting off with the order as the answer
    if ((live.ticket && st.ticket !== live.ticket) || (live.rush && st.stop !== live.gate)) endCall(false, true);
    else if (live.rush && st.has && !st.docked) answer();
    else if (clock >= live.nextRing && live.rings < (live.rush ? CALL.rushRings : Infinity)) {
      live.rings++;
      sfx(live.rush ? 'phoneQuick' : live.rings <= CALL.loud ? 'phone' : 'phoneSoft');
      live.nextRing += live.rings < CALL.loud ? CALL.ringEvery : CALL.quietEvery;
    }
  } else if (live.phase === 'talk') {
    if (live.pend != null) startSeg(live.pend);
    if (live.pend == null) {
      const at = live.at, spoken = clock - live.segAt;
      while (live.said < live.spans.length && at[live.said] <= spoken) live.spans[live.said++].classList.remove('unsaid');
      if (clock >= live.segEnd + CALL.speech.join) {
        if (live.seg + 1 < live.segs.length) startSeg(live.seg + 1);
        else if (clock >= live.segEnd + CALL.linger) endCall(false);
      }
    }
  } else {
    // a fading card stays where it is and fades all the way
    if (clock >= live.outEnd) {
      $('call').hidden = true;
      live = null;
      rect = null;
    }
    return;
  }
  if (live && live.phase !== 'out') place(st, spot);
}

// Whether a card at r would cover the pointer or the flying aircraft (parked on its pad it is under the shop's note,
// and only the opening shot swings it by), and whether it would cover that note.
function blocks(r, st, spot) {
  const boxes = spot?.boxes;
  if (boxes) for (let i = 0; i < boxes.length; i++) if (meets(r, boxes[i])) return true;
  return !st.prep && meets(r, plane);
}
const onNote = r => !!covers.note && meets(r, covers.note);

// The card steps under a toast or the hangar's tip. Over the pointer or the aircraft it moves across to the right, where
// the screen is wide enough for that to clear them, and fades only while it still covers them; the shop's note moves
// aside from it by itself (drawPrepNote). A ringing card never fades: it is waiting on a tap.
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
  if (!east && over) {
    const right = (el.offsetParent?.clientWidth ?? view.W) - CALL.east;
    other[0] = right - (rect[2] - rect[0]);
    other[1] = rect[1];
    other[2] = right;
    other[3] = rect[3];
    if (other[0] > rect[0] + 1 && !blocks(other, st, spot)) {
      west[0] = rect[0];
      west[2] = rect[2];
      east = true;
      el.classList.add('east');
      rect = other.slice();
      measuredAt = clock;
      over = false;
    }
  } else if (east && over && !back && live.phase === 'talk') {
    // covering something over there while it talks, it goes back once to its own side if that is clear by now, so the
    // words are read at full strength
    west[1] = rect[1];
    west[3] = rect[3];
    if (!blocks(west, st, spot) && !onNote(west)) {
      back = true;
      east = false;
      el.classList.remove('east');
      rect = west.slice();
      measuredAt = clock;
      over = false;
    }
  }
  covers.card = rect;
  const dim = over && live.phase !== 'ring';
  if (dim !== faint) {
    faint = dim;
    el.classList.toggle('faint', dim);
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
