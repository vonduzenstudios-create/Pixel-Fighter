#!/usr/bin/env python3
"""Print the voice casting (every speaker's Kokoro voice) and the English voices nobody uses yet.

Speakers live in src/audio/voicelines.json (announcer, default) and src/fighters/<id>/voice.json.
Run: python3 scripts/casting.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENGLISH = ['af_alloy', 'af_aoede', 'af_bella', 'af_heart', 'af_jessica', 'af_kore', 'af_nicole', 'af_nova', 'af_river',
           'af_sarah', 'af_sky', 'am_adam', 'am_echo', 'am_eric', 'am_fenrir', 'am_liam', 'am_michael', 'am_onyx',
           'am_puck', 'am_santa', 'bf_alice', 'bf_emma', 'bf_isabella', 'bf_lily', 'bm_daniel', 'bm_fable', 'bm_george',
           'bm_lewis']

speakers = {}
for path in [ROOT / 'src' / 'audio' / 'voicelines.json', *sorted((ROOT / 'src' / 'fighters').glob('*/voice.json'))]:
    speakers.update(json.loads(path.read_text())['speakers'])

print('| Speaker | Voice | Speed | Pitch |')
print('| --- | --- | --- | --- |')
for name, s in speakers.items():
    pitch = f"{s.get('pitch', 1)}" + (' + robot filter' if s.get('robot') else '')
    print(f"| {name} | `{s['voice']}` | {s.get('speed', 1.0)} | {pitch} |")
used = {s['voice'] for s in speakers.values()}
print('\nUnused English voices:', ', '.join(v for v in ENGLISH if v not in used) or 'none')
