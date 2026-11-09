// Records every caller line the game can say into voices/, ahead of time, with Piper text-to-speech, so the app speaks
// with no internet. Piper and its voice models stay outside the project: set PIPER_PY to a Python that has piper-tts,
// soundfile and soxr, and PIPER_MODELS to the folder of the .onnx voices named in CALL.speech.models, then
//   npm run voices          records only the lines not in voices/ yet (and removes the ones no longer said)
//   npm run voices -- --all records every line again
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CALL } from '../src/config.js';
import { allClips, HOUSEHOLDS, untitledCallers } from '../src/voice.js';

const fail = why => {
  console.error(`voices: ${why}`);
  process.exit(1);
};
if (untitledCallers() > 0) fail(`${untitledCallers()} callers have no Mr. or Ms.`);
for (const h of HOUSEHOLDS) if (h.callers.length > 1 && new Set(h.callers.map(c => c.title)).size < h.callers.length) fail(`${h.sign ?? h.name}: a couple needs a Mr. and a Ms.`);
const clips = allClips(), long = clips.filter(c => c.shown.length > CALL.maxChars);
if (long.length) fail(`longer than ${CALL.maxChars} characters: ${long.map(c => c.shown).join(' | ')}`);

const dir = 'voices', all = process.argv.includes('--all');
mkdirSync(dir, { recursive: true });
const missing = clips.filter(c => all || !existsSync(join(dir, c.file)));
if (missing.length) {
  const { PIPER_PY: py, PIPER_MODELS: models } = process.env;
  if (!py || !models) fail('set PIPER_PY and PIPER_MODELS to record');
  const list = join(tmpdir(), `flying-pizza-voices-${process.pid}.json`);
  writeFileSync(list, JSON.stringify({ make: CALL.speech.make, clips: missing }));
  const run = spawnSync(py, ['-I', join('scripts', 'voices.py'), list, models, dir], { stdio: 'inherit' });
  rmSync(list, { force: true });
  if (run.status !== 0) fail('piper failed');
}
// a line no longer said goes, so the page never carries it
const wanted = new Set(clips.map(c => c.file));
for (const f of readdirSync(dir)) if (f.endsWith('.ogg') && !wanted.has(f)) rmSync(join(dir, f));
const lost = clips.filter(c => !existsSync(join(dir, c.file)));
if (lost.length) fail(`not recorded: ${lost.map(c => c.file).join(', ')}`);

const per = {};
let total = 0;
for (const c of clips) {
  const bytes = statSync(join(dir, c.file)).size, v = (per[c.voice] ??= { n: 0, bytes: 0 });
  v.n++;
  v.bytes += bytes;
  total += bytes;
}
for (const [voice, v] of Object.entries(per)) console.log(`${voice.padEnd(9)} ${String(v.n).padStart(4)} lines ${(v.bytes / 1024).toFixed(1)} kB`);
console.log(`voices: ${clips.length} lines, ${(total / 1024).toFixed(1)} kB (${total} bytes) of ${CALL.speech.budget}${missing.length ? `, ${missing.length} recorded now` : ''}`);
if (total > CALL.speech.budget) fail('over the budget');
