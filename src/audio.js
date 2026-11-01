import { AUDIO } from './config.js';

let ac = null, master, bus, filter, air, oscs, noiseBuf, state = '', voices = 0;
const lastPlayed = {};

function makeNoise() {
  noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.sin(i * 12.9898) * 43758.5453 % 1;
}

function build() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  const c = AUDIO;
  ac = new AC();
  makeNoise();

  // everything goes through one limiter so stacked sounds cannot clip
  bus = ac.createDynamicsCompressor();
  bus.threshold.value = c.limiter.threshold;
  bus.ratio.value = c.limiter.ratio;
  bus.attack.value = c.limiter.attack;
  bus.release.value = c.limiter.release;
  bus.connect(ac.destination);
  master = ac.createGain();
  master.gain.value = 0;
  master.connect(bus);

  // two detuned saws beat against each other like a pair of rotors
  filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = c.idleCut;
  const toneGain = ac.createGain();
  toneGain.gain.value = c.toneMix;
  filter.connect(toneGain).connect(master);
  oscs = [-c.detune, c.detune].map(detune => {
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = c.idleHz;
    o.detune.value = detune;
    o.connect(filter);
    o.start();
    return o;
  });

  // air rushing past the blades
  air = ac.createBiquadFilter();
  air.type = 'bandpass';
  air.frequency.value = c.noiseHz;
  air.Q.value = c.noiseQ;
  const airGain = ac.createGain();
  airGain.gain.value = c.noiseMix;
  const noise = ac.createBufferSource();
  noise.buffer = noiseBuf;
  noise.loop = true;
  noise.connect(air).connect(airGain).connect(master);
  noise.start();
}

// Browsers only allow sound after a user gesture.
export function initAudio() {
  const gestures = ['pointerdown', 'keydown'];
  const unlock = () => {
    gestures.forEach(n => removeEventListener(n, unlock));
    try { build(); } catch (_) { ac = null; }
    if (ac) ac.resume();
  };
  gestures.forEach(n => addEventListener(n, unlock));
  document.addEventListener('visibilitychange', () => {
    if (!ac) return;
    if (document.hidden) ac.suspend();
    else ac.resume();
  });
}

export function updateRotor(active, lift) {
  const next = active ? (lift ? 'lift' : 'idle') : 'off';
  if (!ac || next === state) return;
  state = next;
  const c = AUDIO, t = ac.currentTime, up = next === 'lift';
  master.gain.setTargetAtTime(next === 'off' ? 0 : up ? c.liftGain : c.idleGain, t, c.smooth);
  filter.frequency.setTargetAtTime(up ? c.liftCut : c.idleCut, t, c.smooth);
  air.frequency.setTargetAtTime(up ? c.noiseLiftHz : c.noiseHz, t, c.smooth);
  for (const o of oscs) o.frequency.setTargetAtTime(up ? c.liftHz : c.idleHz, t, c.smooth);
}

function finish(source, nodes) {
  source.onended = () => {
    voices--;
    source.disconnect();
    nodes.forEach(n => n.disconnect());
  };
}

function envelope(level, at, dur) {
  const g = ac.createGain();
  g.gain.setValueAtTime(level * AUDIO.sfxGain, at);
  g.gain.exponentialRampToValueAtTime(.001, at + dur);
  g.connect(bus);
  return g;
}

function tone(from, to, at, dur, level, type = 'triangle') {
  if (voices >= AUDIO.maxVoices) return;
  voices++;
  const o = ac.createOscillator(), g = envelope(level, at, dur);
  o.type = type;
  o.frequency.setValueAtTime(from, at);
  o.frequency.exponentialRampToValueAtTime(to, at + dur);
  o.connect(g);
  finish(o, [g]);
  o.start(at);
  o.stop(at + dur);
}

function burst(at, dur, level, cut, type = 'lowpass') {
  if (voices >= AUDIO.maxVoices) return;
  voices++;
  const n = ac.createBufferSource(), f = ac.createBiquadFilter(), g = envelope(level, at, dur);
  n.buffer = noiseBuf;
  f.type = type;
  f.frequency.value = cut;
  n.connect(f).connect(g);
  finish(n, [f, g]);
  n.start(at);
  n.stop(at + dur);
}

const SOUNDS = {
  crash: t => { burst(t, .22, .9, 420); tone(120, 50, t, .18, .5, 'sine'); },
  box: t => burst(t, .12, .55, 950),
  spill: t => { burst(t, .4, 1, 260); tone(200, 60, t, .35, .4, 'sawtooth'); },
  spark: t => burst(t, .09, .45, 3200, 'highpass'),
  deliver: t => { tone(660, 660, t, .12, .5); tone(990, 990, t + .1, .22, .5); },
  pickup: t => tone(520, 780, t, .14, .4),
  whoosh: t => burst(t, .3, .4, 1400, 'bandpass'),
  ring: t => { tone(880, 1320, t, .1, .4); tone(1320, 1760, t + .07, .14, .35); },
  hawk: t => tone(1900, 900, t, .32, .35, 'sawtooth'),
};

// Short one-shots; repeats of one sound inside sfxGap are dropped so contact does not buzz.
export function sfx(name) {
  if (!ac || ac.state !== 'running') return;
  const t = ac.currentTime;
  if (t - (lastPlayed[name] ?? -1) < AUDIO.sfxGap) return;
  lastPlayed[name] = t;
  SOUNDS[name](t);
}
