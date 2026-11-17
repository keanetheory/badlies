Testing a new golf game here


A cheeky, pick-up-and-play golf game for the browser. One self-contained HTML page, no dependencies.

- **Formats:** Strokeplay, Wolf, 9s, Matchplay, Foursomes, Pairs, Stableford (3, 6 or 9 holes)
- **Golfers and skills:** six golfers; Driving, Approach, Chipping, Sand play and Putting level 1–10 from the shots you hit
- **Rivals:** eight NPCs, each an agent with its own persona, shot-choice policy, mood, per-hole game plan and a deep bag of stock insults. They run entirely in the page and use no model calls
- **Quick start:** pick a course and how many partners, and play strokeplay straight away
- **Golf clubs and money:** bet up to £5 a round (everyone in the group matches it, winner takes the pot) and pay subs every 10 rounds at one of five clubs
- **Course Forger:** turns OpenStreetMap golf data, a map screenshot, or a description into a playable, shaded hole

## Build and test

```
node build.mjs        # writes dist/index.html
node test/sim.mjs     # headless rounds in every format on every course
node test/routes.mjs  # mapped hole routes, doglegs and landing corridors
```

Open `dist/index.html` in a browser to play. The Course Forger's Claude-backed parts (screenshot survey, description layout) and cross-device saves only light up when the page is published as a Claude artifact
with the `sample` (images), `db` and `user` capabilities; everywhere else the game falls back to a keyword parser and localStorage.

## Adding real courses

`tools/import-course.mjs` fetches the OpenStreetMap golf layout around a Google Maps lat/long and adds it as a built-in course, optionally as a golf club's home course. The `course-creator` agent (`.claude/agents/course-creator.md`) drives it: send it coordinates, a name and a club.

```
node tools/import-course.mjs --at "51.2345, -0.5432" --id rabbit-warren --name "Rabbit Warren" --club rabbit --dry-run
```

Courses OpenStreetMap hasn't mapped can be built from their scorecard instead (`courses/scorecards/*.json`, see `tools/scorecard-course.mjs`): par, yardage and whatever is known about each hole's shape.

```
node tools/scorecard-course.mjs --all
```

Imported courses live in `courses/*.json` and are compiled into `src/js/02b-real-courses.js` (generated; don't edit it).
Map data © OpenStreetMap contributors, ODbL.

Magpie, High Trees, Rabbit Warren and Darkerthanusual Heath use routes traced from the supplied course overview maps. Their editable configurations are in `courses/scorecards/`; rebuild with `node tools/scorecard-course.mjs --all`. A hole's `route` is an ordered list of `[x, y]` image points from tee to green, including each bend. The generator rotates the opening shot upwards and scales the route to the existing card yardage, then creates the fairway along it. These are approximate playable reconstructions: widths, bunkers, trees and water shapes are illustrative rather than surveyed terrain. Rabbit Warren keeps nine physical holes, matching the map's paired 1/10–9/18 numbering.

## Publishing on itch.io

1. Build: `node build.mjs`, or without Node: `powershell -ExecutionPolicy Bypass -File build.ps1`.
   Either writes `dist/badlies-itch.zip` with `index.html` at its root.
2. On itch.io, create a new project with **Kind of project: HTML** and upload the zip.
   Tick **This file will be played in the browser**.
3. Embed options:
   - Viewport: **960 × 640** (the game resizes to fit any size, so another size is fine)
   - **Mobile friendly** on, orientation **Default**; the layout works in portrait and landscape
   - **Fullscreen button** on
   - Leave **Automatically start on page load** off so the click-to-play button gives the frame keyboard focus
   - SharedArrayBuffer support is not needed

On itch the game runs in its offline mode: rivals, the map-data importer and the keyword hole parser all work.
The screenshot survey in the Course Forger needs a Claude artifact host and stays unavailable.
Saves go to localStorage, so they stay in the player's browser for itch.io and are not shared across devices.
The page loads its two display fonts from Google Fonts and falls back to system fonts if that request is blocked.

## Layout

| File | What it does |
| --- | --- |
| `src/js/01-util.js` | RNG, geometry, noise |
| `src/js/02-course.js` | Hole model, procedural generator, built-in courses |
| `src/js/02b-real-courses.js` | Courses imported from OpenStreetMap (generated) |
| `src/js/03-render.js` | The shaded course painter |
| `src/js/04-engine.js` | Shot and putting physics, skills, XP |
| `src/js/05-agents.js` | Rival personas, shot policy, game plans, insults, commentary |
| `src/js/06-round.js` | Formats, turn order, scoring, wager pot (no DOM) |
| `src/js/07-forger.js` | Map-data importer, survey prompts, offline hole parser |
| `src/js/08-game.js` | Play screen: camera, swing meter, turns |
| `src/js/09-app.js` | Saves, menus, golf clubs and wallet, Course Forger screen, boot |
| `tools/import-course.mjs` | Real-course importer (OpenStreetMap) used by the course-creator agent |
| `tools/scorecard-course.mjs` | Builds a course from a scorecard when the map data is missing |
| `tools/course-lib.mjs` | Shared checks and output for both course tools |
