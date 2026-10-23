#!/usr/bin/env python3
"""Render every spoken line with Kokoro TTS: src/audio/voicelines.json (announcer, default intro)
plus each fighter's src/fighters/<id>/voice.json.

Only Kokoro's stock voices are used (no cloning). Each speaker gets a voice, a speed and an
optional pitch shift or robot filter, then the clip is trimmed, peak-normalised and encoded
to a small mono MP3 in public/voices/.

Setup (once, ~350 MB of model files):
    python3 -m venv .kokoro && .kokoro/bin/pip install kokoro-onnx soundfile numpy
    mkdir -p .kokoro/models && cd .kokoro/models
    curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
    curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
Run (needs ffmpeg on PATH):
    .kokoro/bin/python scripts/gen_voices.py [--models .kokoro/models] [--only lincoln-intro,...]
"""
import argparse
import json
import subprocess
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = Path(__file__).resolve().parent.parent
MANIFESTS = [ROOT / 'src' / 'audio' / 'voicelines.json', *sorted((ROOT / 'src' / 'fighters').glob('*/voice.json'))]
OUT = ROOT / 'public' / 'voices'


def trim(samples: np.ndarray, sr: int, thresh=0.01, pad=0.04) -> np.ndarray:
    """Cut leading and trailing silence, keeping a short pad so consonants are not clipped."""
    loud = np.flatnonzero(np.abs(samples) > thresh)
    if loud.size == 0:
        return samples
    p = int(pad * sr)
    return samples[max(0, loud[0] - p): loud[-1] + p]


def filters(spk: dict, sr: int) -> str:
    fx = []
    pitch = spk.get('pitch', 1.0)
    if pitch != 1.0:
        # resample to shift pitch, then stretch time back so the speed setting still holds
        fx += [f'asetrate={int(sr * pitch)}', f'aresample={sr}', f'atempo={1 / pitch:.4f}']
    if spk.get('robot'):
        # flatten every FFT bin's phase: a monotone, buzzy speech-computer timbre
        fx += ["afftfilt=real='hypot(re,im)*sin(0)':imag='hypot(re,im)*cos(0)':win_size=512:overlap=0.75",
               'highpass=f=120', 'lowpass=f=5000']
    fx += ['afade=t=in:d=0.01']
    return ','.join(fx)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--models', default=str(ROOT / '.kokoro' / 'models'))
    ap.add_argument('--only', default='', help='comma separated file names to regenerate')
    args = ap.parse_args()

    m = {'speakers': {}, 'lines': []}
    for path in MANIFESTS:
        part = json.loads(path.read_text())
        m['speakers'].update(part['speakers'])
        m['lines'] += part['lines']
    only = {s for s in args.only.split(',') if s}
    models = Path(args.models)
    tts = Kokoro(str(models / 'kokoro-v1.0.onnx'), str(models / 'voices-v1.0.bin'))
    OUT.mkdir(parents=True, exist_ok=True)

    for line in m['lines']:
        if only and line['file'] not in only:
            continue
        spk = m['speakers'][line['who']]
        text = line.get('spoken', line['text'])
        samples, sr = tts.create(text, voice=spk['voice'], speed=spk.get('speed', 1.0), lang='en-us')
        samples = trim(np.asarray(samples, dtype=np.float32), sr)
        samples = samples / max(1e-6, np.abs(samples).max()) * 0.89 * spk.get('gain', 1.0)
        samples = np.clip(samples, -0.99, 0.99)
        dest = OUT / f"{line['file']}.mp3"
        with tempfile.NamedTemporaryFile(suffix='.wav') as tmp:
            sf.write(tmp.name, samples, sr)
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', tmp.name, '-af', filters(spk, sr),
                            '-ac', '1', '-ar', '24000', '-c:a', 'libmp3lame', '-b:a', '48k', str(dest)], check=True)
        print(f"{dest.relative_to(ROOT)}  {len(samples) / sr:.2f}s  {spk['voice']}  {text!r}")


if __name__ == '__main__':
    main()
