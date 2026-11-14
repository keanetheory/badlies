Testing a new golf game here


A cheeky, pick-up-and-play golf game for the browser. One self-contained HTML page, no dependencies.

- **Formats:** Wolf, 9s, Matchplay, Foursomes, Pairs, Stableford (3, 6 or 9 holes)
- **Golfers and skills:** six golfers; Driving, Approach, Chipping, Sand play and Putting level 1–10 from the shots you hit
- **Rivals:** eight NPCs, each an agent with its own persona, shot-choice policy, mood, per-hole game plan and a deep bag of stock insults. They run entirely in the page and use no model calls
- **Course Forger:** turns OpenStreetMap golf data, a map screenshot, or a description into a playable, shaded hole

## Build and test

```
node build.mjs        # writes dist/index.html
node test/sim.mjs     # headless rounds in every format on every course
```

Open `dist/index.html` in a browser to play. The Course Forger's Claude-backed parts (screenshot survey, description layout) and cross-device saves only light up when the page is published as a Claude artifact
with the `sample` (images), `db` and `user` capabilities; everywhere else the game falls back to a keyword parser and localStorage.

## Layout

| File | What it does |
| --- | --- |
| `src/js/01-util.js` | RNG, geometry, noise |
| `src/js/02-course.js` | Hole model, procedural generator, built-in courses |
| `src/js/03-render.js` | The shaded course painter |
| `src/js/04-engine.js` | Shot and putting physics, skills, XP |
| `src/js/05-agents.js` | Rival personas, shot policy, game plans, insults, commentary |
| `src/js/06-round.js` | Formats, turn order, scoring (no DOM) |
| `src/js/07-forger.js` | Map-data importer, survey prompts, offline hole parser |
| `src/js/08-game.js` | Play screen: camera, swing meter, turns |
| `src/js/09-app.js` | Saves, menus, Course Forger screen, boot |
