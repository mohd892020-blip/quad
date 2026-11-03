import { MUSIC } from './config.js';
import { audioGraph } from './audio.js';
import { settings } from './storage.js';

// Calm music made on the fly, so it needs no files. A soft pad holds the chords, a bass marks the bars and a light
// voice plays arpeggios over them. Time of day picks the mode, the place picks the voice and key, height opens the
// filter, speed thickens the arpeggio, wind stirs the pad, and danger adds a quiet pulse. Moments of play get phrases.
const SCALES = {
  ionian: [0, 2, 4, 5, 7, 9, 11], lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10], hijaz: [0, 1, 4, 5, 7, 8, 10],
};
const hz = m => 440 * 2 ** ((m - 69) / 12);

let out = null, padFilter = null, beat = 0, nextAt = 0, chordAt = -1, pads = [], wanted = MUSIC.menu, cues = [];

function build(g) {
  out = g.ac.createGain();
  out.gain.value = 0;
  padFilter = g.ac.createBiquadFilter();
  padFilter.type = 'lowpass';
  padFilter.frequency.value = MUSIC.pad.cut[0];
  padFilter.connect(out);
  out.connect(g.bus);
}

// The scale and chord for a bar: the place may own the mode outright, otherwise the time of day picks it.
function harmony(s, bar) {
  const place = MUSIC.places[s.place] ?? MUSIC.places.city, mode = place.mode ?? MUSIC.times[s.time], scale = SCALES[mode];
  const degree = MUSIC.progressions[mode === 'ionian' || mode === 'lydian' || mode === 'mixolydian' ? 'bright' : 'dark'][bar % 4];
  const note = d => place.root + scale[d % 7] + 12 * Math.floor(d / 7);
  return { place, note, chord: [0, 2, 4, 6].map(k => note(degree + k)), root: note(degree) };
}

function voice(ac, kind, freq, at, len, level, dest) {
  const v = MUSIC.voices[kind], o = ac.createOscillator(), g = ac.createGain();
  o.type = v.wave;
  o.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(level, at + v.attack);
  g.gain.exponentialRampToValueAtTime(.0005, at + v.attack + len * v.decay);
  o.connect(g).connect(dest);
  o.start(at);
  o.stop(at + v.attack + len * v.decay + .05);
  o.onended = () => { o.disconnect(); g.disconnect(); };
  if (v.overtone) {
    const o2 = ac.createOscillator(), g2 = ac.createGain();
    o2.frequency.setValueAtTime(freq * v.overtone, at);
    g2.gain.setValueAtTime(level * v.overtoneLevel, at);
    g2.gain.exponentialRampToValueAtTime(.0005, at + len * v.overtoneDecay);
    o2.connect(g2).connect(dest);
    o2.start(at);
    o2.stop(at + len * v.overtoneDecay + .05);
    o2.onended = () => { o2.disconnect(); g2.disconnect(); };
  }
}

// A held chord, faded in under the last one and out once the next has taken over.
function padChord(ac, chord, at, len) {
  const c = MUSIC.pad;
  for (const p of pads) {
    p.g.gain.cancelScheduledValues(at);
    p.g.gain.setTargetAtTime(0, at, c.release);
    for (const o of p.o) o.stop(at + c.release * 6);
  }
  pads = chord.slice(0, 3).map(m => {
    const g = ac.createGain(), o = [-c.detune, c.detune].map(d => {
      const x = ac.createOscillator();
      x.type = 'triangle';
      x.frequency.value = hz(m - 12);
      x.detune.value = d;
      x.connect(g);
      x.start(at);
      x.onended = () => x.disconnect();
      return x;
    });
    g.gain.setValueAtTime(0, at);
    g.gain.setTargetAtTime(c.level, at, c.attack);
    g.connect(padFilter);
    return { g, o };
  });
}

function playBeat(g, s, at) {
  const c = MUSIC, ac = g.ac, step = beat % c.steps, bar = Math.floor(beat / c.steps), h = harmony(s, bar), spb = 60 / c.tempo / 2;
  if (step === 0 && bar !== chordAt) {
    chordAt = bar;
    padChord(ac, h.chord, at, spb * c.steps);
  }
  if (step % 4 === 0) voice(ac, 'bass', hz(h.root - 24), at, spb * 3, c.bass * (s.active ? 1 : .6), out);
  // the arpeggio fills in with speed and climbs with height; a held aircraft keeps it sparse
  const busy = s.active ? c.arp.base + c.arp.speed * s.speed - (s.holding ? c.arp.holdCut : 0) : c.arp.menu;
  if (c.arp.pattern[step] && Math.random() < busy) {
    const lift = Math.round(s.alt * c.arp.climb) * 12, tone = h.chord[(beat * c.arp.walk) % 4] + 12 + lift;
    voice(ac, h.place.voice, hz(tone), at, spb * 2.2, c.arp.level, out);
  }
  if (s.danger > 0 && step % 2 === 0) voice(ac, 'pulse', hz(h.root - 36), at, spb, c.pulse * s.danger, out);
  // phrases for moments of play land on the beat, in the key of the moment
  for (const cue of cues.splice(0)) {
    const notes = c.cues[cue] ?? [];
    notes.forEach(([deg, off], i) => voice(ac, h.place.voice, hz(h.note(deg) + 12), at + off * spb, spb * 2, c.cueLevel, out));
  }
}

export function musicCue(name) {
  if (out && settings.music !== false) cues.push(name);
}

// Called every frame with what the game is doing; schedules a little ahead so timing never stutters.
export function updateMusic(s) {
  const g = audioGraph();
  if (!g) return;
  if (!out) build(g);
  const c = MUSIC, ac = g.ac, now = ac.currentTime, on = settings.music !== false && ac.state === 'running';
  wanted = s;
  const level = !on ? 0 : (s.active ? c.level : c.menuLevel) * (s.paused ? c.pausedShare : 1);
  out.gain.setTargetAtTime(level, now, c.fade);
  padFilter.frequency.setTargetAtTime(c.pad.cut[0] + (c.pad.cut[1] - c.pad.cut[0]) * (s.alt ?? 0) + Math.sin(now * c.pad.windRate) * c.pad.windWobble * (s.wind ?? 0) + (s.boosting ? c.pad.boostLift : 0), now, .4);
  if (!on) return;
  if (nextAt < now) nextAt = now + .05;
  while (nextAt < now + c.ahead) {
    playBeat(g, wanted, nextAt);
    nextAt += 60 / c.tempo / 2;
    beat++;
  }
}
