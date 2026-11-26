# Kestrel Ridge

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/cryoras/makefun-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/cryoras/makefun-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

A small plane. A wide-open sky. An original 3D flight game built for
the make.fun "best flight game" bounty — static files only, no build step, no
network request. The valley is rendered in real 3D with three.js (vendored
locally, no CDN): a heightfield terrain mesh, an instanced pine forest, a
continuous river, the airfield, and a propeller plane with a smooth chase
camera; a Canvas 2D renderer remains as the fallback when WebGL is
unavailable.

Fly the Kestrel, a little propeller plane, over a procedural ridge valley with
a river, a pine-dotted ridgeline and one airfield (Runway 36). Chase view or
cockpit view, lit instruments, three sorties.

## Play

Serve `game/` with any static server and open it in a desktop browser:

```sh
node serve.ts        # then open http://localhost:8080
```

## Controls

| Input | Action |
| --- | --- |
| Arrows / WASD | Steer (pitch + roll) |
| Shift / Ctrl | Throttle up / down |
| Mouse | Gentle steering (move), short throttle boost (click) |
| Space / click | Confirm / start |
| 1 / 2 / 3 | Pick a sortie on the title screen |
| C | Chase / cockpit camera |
| P / Esc | Pause |
| M | Mute |
| R | Restart |

## Sorties

1. **Ring Run** — thread eight gold rings in order, then bring it home to
   Runway 36.
2. **Precision Landing** — one circuit, then land on the centreline as gently
   as you can. Touchdown softness and centreline accuracy score.
3. **Free Flight** — explore the valley and find your own way down before the
   fuel runs out.

Fuel burns with throttle, hard impacts damage the hull, and a stall will drop
you out of the sky. Landings are judged on vertical speed, alignment and
where you touch down.

## Screenshots

`?shot=start|play|land|end&seed=N` stages a deterministic scene (autopilot
flies the real rules) for screenshots; `window.__shotReady` is set when it is
painted. The four screenshots in `screenshots/` were taken that way in
Chromium at 1280×800.

## The Hairline figure

The title screen embeds a Hairline isometric line figure — a pocket airfield
(runway, control tower, hangar, little plane; the pointer lifts the plane) —
built with the `hairline-create` skill from
[hairline](https://github.com/lucasmarkes/hairline). Its source is
`airfield.js` (see `AIRFIELD-REVIEW.md`); the built page is vendored at
`game/vendor/hairline-airfield.html`.

## Layout

- `main.ts` — entrypoint: copies `game/` + `screenshots/` to `/output` and
  writes `dossier.json` with the vendored make.fun library.
- `game/index.html` — page + title screen (embeds the Hairline figure).
- `game/src/` — one file per job: `config`, `random`, `terrain`, `physics`,
  `input`, `audio`, `render` (Canvas 2D fallback), `render3d` (three.js
  scene), `hud`, `missions`, `shots`, `main`.
- `game/vendor/hairline-airfield.html` — vendored Hairline figure page.
- `game/vendor/three.module.js` + `three.core.js` — vendored three.js r187
  (MIT), loaded locally; the game makes zero external requests.
- `screenshots/` — four real renders of the game (1280×800 JPEG).

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>

## License

MIT — see `LICENSE`.
