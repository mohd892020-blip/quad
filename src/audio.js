import { AUDIO } from './config.js';

let ac = null, master, filter, oscs, state = '';

function noiseLoop() {
  const buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.sin(i * 12.9898) * 43758.5453 % 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  return src;
}

function build() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  const c = AUDIO;
  ac = new AC();
  master = ac.createGain();
  master.gain.value = 0;
  master.connect(ac.destination);

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
  const air = ac.createBiquadFilter();
  air.type = 'bandpass';
  air.frequency.value = c.noiseHz;
  air.Q.value = c.noiseQ;
  const airGain = ac.createGain();
  airGain.gain.value = c.noiseMix;
  const noise = noiseLoop();
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
  for (const o of oscs) o.frequency.setTargetAtTime(up ? c.liftHz : c.idleHz, t, c.smooth);
}
