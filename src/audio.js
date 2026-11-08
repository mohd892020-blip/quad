import { AUDIO, CALL } from './config.js';
import { saveSettings, settings } from './storage.js';

let ac = null, output, master, bus, filter, air, oscs, noiseBuf, voices = 0, nextUpdate = 0, speaking = null;
const lastPlayed = {}, aimed = new Map();

function makeNoise() {
  noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const data = noiseBuf.getChannelData(0);
  // a sine hash here keeps the sign of its sine, which is a loud steady tone near 3 kHz
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
}

function build() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  const c = AUDIO;
  ac = new AC({ latencyHint: c.latency });
  makeNoise();

  // everything goes through one limiter so stacked sounds cannot clip
  bus = ac.createDynamicsCompressor();
  bus.threshold.value = c.limiter.threshold;
  bus.ratio.value = c.limiter.ratio;
  bus.attack.value = c.limiter.attack;
  bus.release.value = c.limiter.release;
  output = ac.createGain();
  output.gain.value = settings.muted ? 0 : 1;
  bus.connect(output).connect(ac.destination);
  master = ac.createGain();
  master.gain.value = 0;
  // phone speakers peak around 3 kHz, so the rotor stays under that; one-shots keep their edge
  const soft = ac.createBiquadFilter();
  soft.type = 'lowpass';
  soft.frequency.value = c.softCut;
  master.connect(soft).connect(bus);

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

// Browsers only allow sound after a user gesture, and a touch only counts once the finger
// lifts, so this keeps listening until the context is really running.
export function initAudio() {
  const gestures = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'];
  const stop = () => gestures.forEach(n => removeEventListener(n, unlock));
  const unlock = () => {
    if (!ac) try { build(); } catch (_) { ac = null; }
    if (!ac) return stop();
    wake()?.then?.(() => { if (ac.state === 'running') stop(); });
  };
  gestures.forEach(n => addEventListener(n, unlock));
  document.addEventListener('visibilitychange', () => {
    if (!ac) return;
    if (document.hidden) ac.suspend();
    else wake();
  });
}

function wake() {
  return ac.resume()?.catch?.(() => {});
}

// The live context and the limiter every sound passes through, once the player has woken the audio.
export const audioGraph = () => (ac ? { ac, bus } : null);

export function toggleMute() {
  settings.muted = !settings.muted;
  saveSettings();
  if (output) output.gain.value = settings.muted ? 0 : 1;
}

function aim(param, value) {
  if (aimed.get(param) === value) return;
  aimed.set(param, value);
  const t = ac.currentTime;
  param.cancelScheduledValues(t);
  param.setTargetAtTime(value, t, AUDIO.smooth);
}

// Called every frame, but the graph is only touched every updateEvery seconds and each
// update clears what was queued, so automation events cannot pile up and stall the audio.
export function updateRotor(active, throttle, model) {
  const now = performance.now() / 1000, c = AUDIO;
  if (!ac || now < nextUpdate) return;
  nextUpdate = now + c.updateEvery;
  if (ac.state !== 'running' && !document.hidden) wake();
  const mix = (a, b) => a + (b - a) * throttle;
  // filters follow the motor pitch, so a small fast prop sounds thin and a big one deep
  const tone = Math.sqrt(model.hz[0] / c.idleHz);
  // high pitches sit where the ear and a phone speaker are keenest, so they play quieter
  const trim = Math.min(1, (c.idleHz / model.hz[0]) ** c.pitchTrim);
  aim(master.gain, active ? mix(c.idleGain, c.liftGain) * trim : 0);
  aim(filter.frequency, Math.min(c.maxCut, mix(c.idleCut, c.liftCut) * tone));
  aim(air.frequency, Math.min(c.maxNoiseHz, mix(c.noiseHz, c.noiseLiftHz) * tone));
  for (const o of oscs) aim(o.frequency, Math.min(c.maxHz, mix(model.hz[0], model.hz[1])));
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
  boom: t => { burst(t, .7, 1, 240); tone(90, 32, t, .6, .8, 'sine'); },
  hawk: t => tone(1900, 900, t, .32, .35),
  eagle: t => { tone(1500, 620, t, .6, .4, 'sawtooth'); tone(1180, 520, t + .07, .5, .28); },
  battery: t => { tone(880, 880, t, .1, .3); tone(660, 660, t + .13, .16, .3); },
  win: t => { tone(523, 523, t, .16, .4); tone(659, 659, t + .14, .16, .4); tone(784, 784, t + .28, .16, .4); tone(1047, 1047, t + .42, .4, .45); },
  lose: t => { tone(392, 370, t, .24, .4); tone(311, 294, t + .22, .24, .4); tone(233, 196, t + .44, .5, .45, 'sawtooth'); },
  gate: t => tone(1180, 1480, t, .1, .35),
  creak: t => tone(240, 170, t, .14, .3, 'sawtooth'),
  thunder: t => { burst(t + .08, .9, .6, 170); tone(72, 38, t, .7, .4, 'sine'); },
  // a delivery plays deliver, then the combo chime (k raises it with the run), then the perfect sparkle: six voices at most
  combo: (t, k) => tone(784 * k, 1175 * k, t + .2, .16, .3),
  comboLost: t => tone(523, 262, t, .3, .22, 'sine'),
  perfect: t => { tone(1047, 1047, t + .3, .1, .35); tone(1319, 1319, t + .38, .1, .35); tone(1568, 1568, t + .46, .34, .42); },
  gust: t => burst(t, .9, .3, 600, 'bandpass'),
  ring: t => { tone(1320, 1760, t, .12, .35); tone(1760, 2640, t + .08, .2, .3); },
  close: t => { burst(t, .14, .35, 1800, 'bandpass'); tone(880, 1320, t + .05, .1, .28); },
  // a claimed gift: four notes climbing, four voices
  gift: t => { tone(784, 784, t, .1, .35); tone(1047, 1047, t + .08, .1, .35); tone(1319, 1319, t + .16, .1, .35); tone(1568, 2093, t + .24, .38, .42); },
  // Rush Hour: a tick for each of the clock's last seconds, and three notes climbing for a new rush level
  tick: t => tone(1568, 1568, t, .05, .25),
  rush: t => { tone(784, 784, t, .09, .35); tone(1175, 1175, t + .08, .09, .35); tone(1568, 2093, t + .16, .28, .4); },
  // a purchase: a bright two-note ring
  buy: t => { tone(988, 988, t, .07, .35); tone(1319, 1976, t + .07, .22, .4); },
  // a shut mission: two soft low taps
  locked: t => { tone(330, 300, t, .06, .22, 'sine'); tone(262, 247, t + .07, .08, .2, 'sine'); },
  // an incoming call: a phone's four-note trill, quicker in Rush, a lift as it answers and a drop as it hangs up (ring is
  // the bonus ring's)
  phone: t => { tone(1319, 1319, t, .08, .28, 'sine'); tone(1568, 1568, t + .09, .08, .28, 'sine'); tone(1319, 1319, t + .18, .08, .28, 'sine'); tone(1760, 1760, t + .27, .12, .3, 'sine'); },
  phoneQuick: t => { tone(1568, 1568, t, .07, .26, 'sine'); tone(1976, 1976, t + .08, .1, .28, 'sine'); },
  answer: t => tone(880, 1320, t, .06, .22, 'sine'),
  hangup: t => tone(620, 410, t, .1, .18, 'sine'),
};

// A short buzz where the phone has one and the player wants it; the app hands it to Android itself.
export function buzz(ms) {
  if (settings.vibration === false) return;
  try {
    if (window.PizzaScreen?.buzz) window.PizzaScreen.buzz(ms);
    else navigator.vibrate?.(ms);
  } catch (_) {}
}
export const canBuzz = () => !!(window.PizzaScreen?.buzz || navigator.vibrate);

// Short one-shots; repeats of one sound inside sfxGap are dropped so contact does not buzz. k shifts a sound's pitch.
export function sfx(name, k = 1) {
  if (!ac || ac.state !== 'running') return;
  const t = ac.currentTime;
  if (t - (lastPlayed[name] ?? -1) < AUDIO.sfxGap) return;
  lastPlayed[name] = t;
  SOUNDS[name](t, k);
}

// A caller's voice: one saw through two vowel filters and a soft body, its pitch and vowels set syllable by syllable from
// the plan, under one envelope. It is one voice through the limiter, so the mute silences it and nothing leaves the
// device; muted, nothing is built at all.
export function speak(plan, v) {
  hushVoice();
  if (!ac || ac.state !== 'running' || settings.muted || voices >= AUDIO.maxVoices || !plan.syl.length) return;
  const c = CALL.voice, t0 = ac.currentTime + .03;
  const o = ac.createOscillator(), f1 = ac.createBiquadFilter(), f2 = ac.createBiquadFilter(), lp = ac.createBiquadFilter(), mix = ac.createGain(), env = ac.createGain(), out = ac.createGain();
  o.type = 'sawtooth';
  f1.type = f2.type = 'bandpass';
  f1.Q.value = c.q[0];
  f2.Q.value = c.q[1];
  lp.type = 'lowpass';
  lp.frequency.value = c.body;
  mix.gain.value = c.bodyMix;
  env.gain.value = 0;
  out.gain.value = c.level * AUDIO.sfxGain;
  o.connect(f1).connect(env);
  o.connect(f2).connect(env);
  o.connect(lp).connect(mix).connect(env);
  env.connect(out).connect(bus);
  // each release ends a little before the next syllable starts: back to back, float rounding can put that start a hair
  // before the ramp's end, and the gain then holds at full and drops in one sample
  for (const s of plan.syl) {
    const a = t0 + s.at;
    o.frequency.setValueAtTime(s.hz, a);
    f1.frequency.setValueAtTime(s.f1 * v.shift, a);
    f2.frequency.setValueAtTime(s.f2 * v.shift, a);
    env.gain.setValueAtTime(0, a);
    env.gain.linearRampToValueAtTime(1, a + c.attack);
    env.gain.setValueAtTime(1, a + s.dur * (1 - c.release));
    env.gain.linearRampToValueAtTime(0, a + s.dur * (1 - c.edge));
  }
  voices++;
  finish(o, [f1, f2, lp, mix, env, out]);
  o.start(t0);
  o.stop(t0 + plan.secs + .05);
  speaking = { o, env };
}

// A call cut short: the voice fades in a moment from wherever its envelope stands, instead of clicking off. A plain
// cancel mid-ramp would snap back to the last set value first, so the value is held (by hand where the browser can't).
export function hushVoice() {
  if (!speaking) return;
  const { o, env } = speaking;
  speaking = null;
  try {
    const now = ac.currentTime;
    if (env.gain.cancelAndHoldAtTime) env.gain.cancelAndHoldAtTime(now);
    else {
      const v = env.gain.value;
      env.gain.cancelScheduledValues(now);
      env.gain.setValueAtTime(v, now);
    }
    env.gain.setTargetAtTime(0, now, .015);
    o.stop(now + .08);
  } catch (_) {}
}
