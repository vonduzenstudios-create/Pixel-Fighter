# Pixel Fighter

A browser fighting game tech demo in the style of 16-bit console fighters. Every pixel of art,
every sound effect and every note of music is generated in code at load time. The only files
are the spoken voice lines in `public/voices/`, rendered from text by a script (see below).

- **1 stage:** The Thorn Gorge, a plank bridge over a pit of spikes under a blood moon
- **4 fighters:** Abe Lincoln, Nikola Tesla, Joan of Arc and Blackbeard
- **CPU opponent** with Easy, Normal and Hard
- Best of three rounds, a finishing move per fighter, and a stage finish into the spike pit

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static build in dist/
npm test         # checks CHANGELOG.md
```

Pushing to `main` deploys to GitHub Pages through `.github/workflows/deploy.yml`
(set **Settings → Pages → Source** to **GitHub Actions** once).

## What's new

`CHANGELOG.md` lists the notable changes, one section per day. The game bundles it into the
**What's new** screen on the title menu, and the build also makes a standalone `whats-new.html`
page. A nightly task adds new days by itself, so you don't need to edit it by hand.

## Controls

| Action      | Gamepad          | Keyboard (P1) | Keyboard (P2)          |
|-------------|------------------|---------------|------------------------|
| Move        | D-pad / stick    | W A S D       | Arrow keys             |
| Low punch   | A                | U             | `[` or Numpad 4        |
| High punch  | X                | I             | `]` or Numpad 5        |
| Low kick    | B                | J             | `;` or Numpad 1        |
| High kick   | Y                | K             | `'` or Numpad 2        |
| Block       | LB, RB, LT, RT   | L or Space    | `/` or Numpad 0        |
| Start/pause | Start            | Enter         | `\`                    |

Holding back also blocks. In menus, A or Start confirms and B (or Esc) goes back. Commands below are written for a fighter facing right
(F = toward the opponent, B = away, D = down).

### Everyone

| Move                    | Command                            |
|-------------------------|------------------------------------|
| Uppercut (launches up)  | D + HP                             |
| Roundhouse (launches)   | B + HK                             |
| Sweep (knockdown)       | B + LK                             |
| Crouching attacks       | D + LP, D + LK, D + HK             |
| Judo throw (close, swaps sides) | F + LP                     |
| Pit drop (stage finish) | D + HP while the opponent is dazed |

### Specials and finishers

| Fighter     | Move                   | Command                  |
|-------------|------------------------|--------------------------|
| Lincoln     | Stovepipe Boomerang    | D, DF, F + P             |
|             | Rail Splitter          | B, B + HP                |
|             | Log Roll               | B, F + LK                |
|             | *Emancipation Cleave*  | F, B, F + HP (close)     |
| Tesla       | Coil Bolt              | D, DF, F + P             |
|             | Wireless Step          | D, DB, B + K             |
|             | Alternating Field      | Mash LP (or B, B + LP)   |
|             | *Grand Discharge*      | D, F, D + LP             |
| Joan of Arc | Holy Flame             | D, DF, F + P             |
|             | Banner Charge          | B, F + HK                |
|             | Ascension Blade        | F, D, DF + HP            |
|             | *Purifying Pyre*       | F, D, F + HK (mid range) |
| Blackbeard  | Cannon Volley          | D, DF, F + P             |
|             | Powder Keg             | D, DB, B + LK            |
|             | Cutlass Cyclone        | Mash HK (or D, D + HK)   |
|             | *Powder Keg Surprise*  | B, B, F + LP (close)     |

Finishers (in italics) work in the deciding round when "END THEM!" appears.

"Mash" moves fire when you tap the button four times within half a second; the first taps
come out as normal attacks and the flurry cancels them. Chuck Norris, Bruce Lee, Ali, Bob Ross,
Tesla and Blackbeard each have one. Motion commands are forgiving: a diagonal counts for the
direction beside it, and the steps can be spread over about half a second.

## How it's built

TypeScript + Vite + plain Canvas 2D at a native 256×224 resolution, scaled up with crisp pixels.

- `src/gfx/painter.ts` paints pixel sprites with shape primitives, auto-shading and outlines.
- `src/chars/build.ts` paints each fighter as separate jointed parts (head, torso, upper arm,
  forearm, thigh, shin, foot). `src/gfx/rig.ts` poses them with forward kinematics, so every
  animation is a list of joint-angle keyframes in `src/game/anims.ts` and `src/chars/roster.ts`.
  Hitboxes come from the posed fist or foot, so they always match what you see.
- `src/game/stage.ts` builds the parallax stage and the spike pit.
- `src/audio/` synthesises SFX with the Web Audio API and runs a small tracker for the
  original music.
- Voice lines (intros, finisher lines, announcer) are listed in `src/audio/voicelines.json`
  and rendered with the open-source [Kokoro TTS](https://github.com/hexgrad/kokoro) model,
  using one of its stock voices per speaker, by `scripts/gen_voices.py` (setup steps are in
  the script). After changing a line's text, re-run the script and commit the new MP3s. A line
  with no clip falls back to the browser's speech synthesis.
- `src/game/ai.ts` drives the CPU with the same inputs a player would press.
