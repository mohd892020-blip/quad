# Piper's half of scripts/voices.mjs: reads the list it wrote, records each line in its voice, and saves it small for the
# phone: silence trimmed, levelled, faded at both ends, mono Ogg/Opus. Run it with -I, from the project root:
#   python -I scripts/voices.py <list.json> <models dir> <out dir>
import json
import os
import sys

import numpy as np
import soundfile as sf
import soxr
from piper import PiperVoice, SynthesisConfig

listing, models, out = sys.argv[1:4]
with open(listing, encoding='utf-8') as f:
    job = json.load(f)
make = job['make']
voices = {}
db = lambda x: 10 ** (x / 20)

for clip in job['clips']:
    model = clip['model']
    if model not in voices:
        voices[model] = PiperVoice.load(os.path.join(models, f'{model}.onnx'))
    voice = voices[model]
    rate = voice.config.sample_rate
    audio = np.concatenate([c.audio_float_array for c in voice.synthesize(clip['text'], SynthesisConfig(length_scale=make['pace']))]).astype(np.float32)
    # quieter than trim below the peak counts as silence, and pad of it stays at each end
    loud = np.where(np.abs(audio) > np.abs(audio).max() * db(make['trim']))[0]
    keep = int(make['pad'] * rate)
    audio = audio[max(0, loud[0] - keep):loud[-1] + keep + 1]
    audio *= db(make['rms']) / max(1e-9, float(np.sqrt(np.mean(audio ** 2))))
    peak = float(np.abs(audio).max())
    if peak > db(make['peak']):
        audio *= db(make['peak']) / peak
    edge = min(int(make['fade'] * rate), len(audio) // 2)
    ramp = np.linspace(0, 1, edge, dtype=np.float32)
    audio[:edge] *= ramp
    audio[len(audio) - edge:] *= ramp[::-1]
    audio = soxr.resample(audio, rate, make['rate'])
    sf.write(os.path.join(out, clip['file']), audio, make['rate'], format='OGG', subtype='OPUS', compression_level=make['squeeze'])
    print(f"{clip['file']} {len(audio) / make['rate']:.2f}s", flush=True)
