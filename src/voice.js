import { CALL, HOMES, ITEMS } from './config.js';

// Who calls and what they say, in which recorded voice. The game and scripts/voices.mjs (which records every line ahead of
// time) share it, so it reads nothing but config.js.
let untitled = 0;

// A caller from their line in HOMES: the title picks a man's or a woman's voice, and the household's place in the list
// picks which one and its rate (a couple's two differ by title, so they never share a voice).
function person(text, i) {
  let words = text.split(' '), g = HOMES.titles[words[0]];
  if (!g) {
    untitled++;
    console.warn('homes: no title', text);
    words = ['Ms.', ...words];
    g = HOMES.titles['Ms.'];
  }
  const [title, first, ...family] = words, male = g === 'm', list = CALL.speech.voices[male ? 'm' : 'f'], rates = CALL.speech.rates;
  return {
    title, first, who: `${title} ${first}`, male, initials: (first[0] + (family.length ? family[family.length - 1][0] : '')).toUpperCase(),
    voice: list[i % list.length], rate: rates[i % rates.length],
  };
}

export const HOUSEHOLDS = [
  ...HOMES.city.map(([sign, ...callers]) => ({ sign, callers })),
  ...HOMES.country.map(([name, ...callers]) => ({ name, own: name.startsWith('The ') && name.endsWith('s') ? `${name}'` : `${name}'s`, callers })),
];
HOUSEHOLDS.forEach((h, i) => {
  h.i = i;
  h.callers = h.callers.map(c => person(c, i));
  h.first = h.callers[0].first;
});

export const untitledCallers = () => untitled;
export const callerOf = (h, turn) => h.callers[turn % h.callers.length];
// whose turn it is, so a couple's two are picked at random: a number drawn once for each stop of a flight (or each
// drop of a Rush run) and kept, so the call, the HUD and the plate name the same one. 2520 shares out evenly over any
// household of up to ten.
const turns = new WeakMap();
export const turnOf = st => {
  let all = turns.get(st);
  if (!all) turns.set(st, (all = []));
  return (all[st.rush ? st.rush.del : st.stopAt] ??= Math.floor(Math.random() * 2520));
};

// What the caller asks for, in their words: one item, or a tied pair as two of one or one and another.
const one = i => CALL.ask[i.key]?.[0] ?? `a ${i.label.toLowerCase()}`;
export const askOf = item => (item.parts ? (item.parts[0] === item.parts[1] ? CALL.ask[item.parts[0].key]?.[1] ?? `two of ${one(item.parts[0])}` : `${one(item.parts[0])} and ${one(item.parts[1])}`) : one(item));
const cap = s => s[0].toUpperCase() + s.slice(1);
const fill = (tpl, item) => tpl.replace('{Ask}', () => cap(askOf(item))).replace('{ask}', () => askOf(item));

export const greetLine = c => CALL.lines.greet.replace('{who}', c.who);
export const askLine = (set, item, pick) => fill(CALL.lines[set][pick % CALL.lines[set].length], item);
// how a line is read out: a title in full, so the voice never spells "Ms."
export const spoken = text => text.replace(/\bM[rs]\./g, t => CALL.speech.say[t]);
export const clipName = (voice, text) => `${voice}-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.ogg`;

// Every line the game can ask for, once each by file name: each caller's greeting in their own voice, and every request
// of every kind for every item in every voice.
export function allClips() {
  const clips = new Map(), add = (voice, shown) => {
    const file = clipName(voice, shown);
    if (!clips.has(file)) clips.set(file, { file, voice, model: CALL.speech.models[voice], text: spoken(shown), shown });
  };
  for (const h of HOUSEHOLDS) for (const c of h.callers) add(c.voice, greetLine(c));
  const v = CALL.speech.voices;
  for (const voice of [...v.f, ...v.m]) {
    for (const set of ['plain', 'urgent', 'rescue', 'rush']) {
      for (const item of Object.values(ITEMS)) {
        if (set === 'urgent' && !item.urgent) continue;
        CALL.lines[set].forEach((_, k) => add(voice, askLine(set, item, k)));
      }
    }
  }
  return [...clips.values()];
}
