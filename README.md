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
npm test         # checks CHANGELOG.md, every fighter/stage, online determinism
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
  forearm, thigh, shin, foot) from a `Look`. `src/gfx/rig.ts` poses them with forward
  kinematics, so every animation is a list of joint-angle keyframes (`src/game/anims.ts` and
  each fighter's own file). Hitboxes come from the posed fist or foot, so they always match
  what you see.
- `src/fighters/<id>/` holds everything about one fighter and `src/stages/<id>/` everything
  about one stage. Both are found automatically (`src/fighters/registry.ts`,
  `src/stages/registry.ts`, using Vite's `import.meta.glob`), so adding one never edits a
  shared file. See [Adding a fighter](#adding-a-fighter) and [Adding a stage](#adding-a-stage).
- `src/game/` is the engine: fight rules, fighters, projectiles, particles, the AI
  (`ai.ts` drives the CPU with the same inputs a player would press).
- `src/audio/` synthesises SFX with the Web Audio API (`specials.ts` is the shared library of
  special-move sounds) and runs a small tracker for the original music (`music.ts`).
- Voice lines (intros, finisher lines, announcer) are rendered with the open-source
  [Kokoro TTS](https://github.com/hexgrad/kokoro) model, using one of its stock voices per
  speaker, by `scripts/gen_voices.py` (setup steps are in the script). The announcer's calls
  are in `src/audio/voicelines.json`; each fighter's speaker and lines are in its own
  `voice.json`. After changing a line's text, re-run the script and commit the new MP3s. A
  line with no clip falls back to the browser's speech synthesis.

## Online versus

**Play → Versus → Online** finds an opponent over the internet: it joins a player who is already
waiting, or hosts a game and shows "Searching for game" until someone joins.
**Versus → Local** is two players on one computer, as before.

- `server/` is a tiny Node matchmaking server (put on Render with `render.yaml`; the click-by-click
  steps are in [server/README.md](server/README.md)). It pairs players and passes messages along.
  The game finds it through `src/net/config.ts` (or `?server=ws://localhost:8080` in the URL).
- `src/net/` is the netcode: **delay-based lockstep**. Both games run the whole fight, and only
  button presses travel between them: 11 buttons packed into 2 bytes per frame, sent as runs
  (a held button costs 3 bytes however long it's held), only when something changes or every
  third frame as a heartbeat. That's about 0.3 KB/s of game data each way (around 1.5 KB/s with
  network headers). Inputs go straight between the two browsers over WebRTC when the routers
  allow it, otherwise through the server.
- Every frame each game waits until it has both players' inputs for that frame, so the two
  fights stay identical. Your press is scheduled a few frames ahead (sized to the connection's
  ping) so it has time to arrive. Random rolls during an online fight come from a seed both
  games share (`seededRandom` in `src/core/rng.ts`); sounds keep their own randomness. Every two
  seconds the games compare a checksum of the fight and show OUT OF SYNC if they ever differ.
- **For fighter and stage code:** anything that changes the fight must only depend on the fight
  itself and the fighters' controllers. Don't read the keyboard, the clock or whether a voice
  line is still playing inside a fight step. `tests/online.test.ts` plays every fighter twice
  from the same seed and fails if the two runs ever differ.

## Adding a fighter

Make a folder `src/fighters/<id>/` (the folder name is the fighter's id). Nothing outside it
needs to change: `npm test` checks that it registers and builds.

| File | What goes in it |
| --- | --- |
| `index.ts` | Default-exports a `FighterModule` (`src/fighters/kit.ts`): `order` (select-screen position, lower first; pick a number not used yet), `make()` returning the `CharDef` (with `selectSet`, its character-select diorama from `SETS` in `src/scenes/sets.ts` or one of its own), and optionally `moveSounds`, `projectiles` and `fx`. |
| `fighter.ts` | The `CharDef`: name, `Look` and alt colours, specials and finisher, props, `intro`, `portrait`, `quotes` / `quotesVs` taunts, optional `scale`, `fatality` and `fatalityDraw`. |
| `intro.ts` | Optional round 1 entrance (`Intro`, see `src/game/intro.ts`). |
| `projectiles.ts` | Optional `ProjDef`s by kind name: stats, sounds, `update`, `draw`, `onHit`. Kind names must be unique across fighters. |
| `voice.json` | The fighter's Kokoro speaker (keyed by its id) and its lines, plus the announcer's `"<Name> wins"` line. |

Then generate the voice clips: `python3 scripts/casting.py` lists the voices already taken, pick
an unused one (or one with a clearly different pitch), and run `scripts/gen_voices.py --only
<id>-intro,...`. Commit the MP3s in `public/voices/`.

Tips:

- Copy a similar fighter's folder as a starting point (`lincoln` is the simplest; `irwin`
  and `fieri` have custom projectiles; `hawking` and `jackson` have custom finishers).
- `throwProj(kind, frame, height, sound)` in `src/fighters/kit.ts` is the standard throw.
- New sound cues go in `fx` in your `index.ts` and can then be named in `moveSounds` and
  projectile `sounds` (or call them directly). The test fails on any cue or `FX.name()` that
  does not exist, because a missing one freezes the game mid-fight.
- Outfit details the shared `Look` options can't draw go in `Look.paint` (per-part painting
  hooks), and props or sprites in your own folder, rather than in `chars/build.ts` or
  `gfx/props.ts`.
- Only touch the engine (`src/game/`) when the fighter needs a mechanic that does not exist
  yet, and keep that change generic so other fighters can use it.
- The What's new changelog is written by a nightly task; don't add lines to `CHANGELOG.md`.

## Adding a stage

Make a folder `src/stages/<id>/`:

| File | What goes in it |
| --- | --- |
| `index.ts` | Default-exports a `StageModule` (`src/game/stages.ts`): `order` (stage-select position), `name`, `make(bones)` returning the stage, and `songs` (name to song builder). |
| `stage.ts` | A class implementing `Arena` (`src/game/stages.ts`): `draw`, `drawFront`, `song`, the uppercut-finish `pit` or `pitLanding`, and optional `update`, `reset`, `bob`, `gravity`, `width`. |
| `song.ts` | The stage's original theme: a function returning a `Song` built with `line()` and `chordTones()` from `src/audio/music.ts`. A song can bring its own `instruments`. |

`npm test` builds every stage and composes every song.

## Voice casting

Each speaker has its own stock Kokoro voice: the announcer's in `src/audio/voicelines.json`,
each fighter's in its `voice.json`. A test fails if two speakers share a voice unless their
`pitch` differs by at least 0.1. Voice ids: `a`/`b` = American/British English, `f`/`m` =
female/male; other language packs such as `ff_siwis` (French) read the English lines with that
accent. Run `python3 scripts/casting.py` for the current casting table and the English voices
still unused.

Every American and British male voice is taken, so a new male fighter should use another
language pack that suits him (`em_alex` Spanish, `im_nicola` Italian, `pm_alex` Portuguese,
`hm_omega` / `hm_psi` Hindi, `jm_kumo` Japanese, `zm_yunjian` etc. Mandarin) or reuse a voice
with a clearly different pitch.
