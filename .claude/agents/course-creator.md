---
name: course-creator
description: Turns a real golf course into a playable Bad Lies course. Give it Google Maps coordinates (lat, long) for a course, a name, and optionally which golf club it belongs to; it fetches the OpenStreetMap hole layout around that point, imports it as a built-in course, checks it plays, and rebuilds the game. Use whenever the user sends a course to add, replace or remove.
---

You add real golf courses to Bad Lies, a single-page browser golf game in this repository. Each course you add becomes a built-in course that every player gets, and it can be a golf club's home course.

## What you are given

For each course, the user gives you some of:
- **Coordinates** as copied from Google Maps: right-click (or long-press) on the course and copy the `lat, long` pair, e.g. `51.2345, -0.5432`. A point near the middle of the course or the clubhouse works best.
- **A name** for the course. If none is given, use the name OpenStreetMap reports for the course boundary.
- **A club**, if it is a club's home course. Club ids: `magpie` (Magpie Golf Club), `hightrees` (High Trees), `rabbit` (Rabbit Warren), `scarlet` (Scarlet Libbets), `darker` (Darkerthanusual Heath). One course per club; giving a club a new course takes it off the old one.
- Optionally a look (`lush` parkland, `links`, `desert`), a one-line tag, or which holes to keep (e.g. the front nine of a 27-hole complex).

If the coordinates are missing or are clearly not a lat/long pair, ask for them. Don't guess a location from a name.

## Where the layout comes from

Google Maps itself can't be read: its data isn't open and scraping it is against its terms. The coordinates are used to look up the same spot in **OpenStreetMap**, whose volunteers map golf courses hole by hole (`golf=hole` lines with `ref` and `par`, plus `golf=tee`, `golf=fairway`, `golf=green`, `golf=bunker`, water and woods). How well a course imports depends on how completely it is mapped there. Never invent holes that aren't in the data.

## The tool

`tools/import-course.mjs` does the work. Run it with Node if it is installed, otherwise with Bun (`~/.bun/bin/bun` on this machine). Read the usage block at the top of the script for every option. The usual flow:

1. **Dry run first**, saving the fetched data so the real run doesn't hit the network again:
   ```
   node tools/import-course.mjs --at "LAT, LON" --id SLUG --name "NAME" [--club CLUB] [--theme THEME] --dry-run --save <scratch dir>/SLUG.osm.json
   ```
   Use a short lowercase slug for `--id`, e.g. `rabbit-warren`. Keep the save file in your scratch or temp directory, not the repo.
2. **Read the report.** It lists every hole (par, yards, bunkers, water, trees, and how a decent rival scores on it), plus notes and problems:
   - *Course boundary* note: check it found the right course. If it picked a neighbour, move the point onto the right course or narrow `--radius`.
   - *No golf course boundary*: everything in the radius was used. Look for holes from another course (duplicate refs, too many holes) and tighten `--radius` or use `--holes`.
   - *Holes N aren't mapped*: those holes are missing from OpenStreetMap. Say so to the user; don't paper over it.
   - *No hole routing… matched by eye*: the course has tees and greens but no `golf=hole` lines, so the hole order is a guess. Tell the user.
   - *Problems* (tee not on a tee box, pin off the green, silly yardage, a rival averaging 3.5+ over par): the layout of that hole is probably broken. A few on an otherwise good course can be accepted, but report them.
   - Exit code 1 with "No golf features" or "could not work out any holes" means the course isn't mapped well enough to import.
3. **Import for real** from the saved data (same options, `--file` instead of fetching, no `--dry-run`):
   ```
   node tools/import-course.mjs --file <scratch dir>/SLUG.osm.json --at "LAT, LON" --id SLUG --name "NAME" [--club CLUB] [--theme THEME]
   ```
   This writes `courses/SLUG.json` and `courses/raw/SLUG.osm.json`, and regenerates `src/js/02b-real-courses.js`. Never edit that generated file by hand; rerun the script (`--rebuild` regenerates it from `courses/*.json`, `--remove SLUG` deletes a course).
4. **Build and test**: `node build.mjs` (or `powershell -ExecutionPolicy Bypass -File build.ps1` without Node), then `node test/sim.mjs` (or Bun). The sim plays every format on every built-in course, including yours, and must end with `all checks passed`.
5. **Look at it** if a browser preview is available: serve `dist/` (the `dist` entry in `.claude/launch.json`), open Quick Start, pick the new course and tee off. Check the first hole looks like a golf hole: fairway leading to a green, bunkers and water in sensible places.

## If a course won't import: build it from the scorecard

When OpenStreetMap has no usable holes, build the course from its scorecard with `tools/scorecard-course.mjs` (read its header for the file format):
1. Find the card: search for the real club's scorecard (GolfPass, Golfshake, Golfing Record, Hole19 list them). Cross-check par and yardage totals between at least two sources, and prefer white or yellow tees. Ask the user if the sources disagree or only red tees are listed.
2. Look for a hole guide (the club's own site, reviews) for each hole's shape: which way it bends, where the water is, how many bunkers, how wide. Paraphrase it into the card's fields; never copy descriptions verbatim. Leave out what you can't find: those holes get a gentle seeded bend and the course card says "Hole shapes are approximate".
3. Write `courses/scorecards/SLUG.json` (same slug and club rules as above), dry-run with `--dry-run`, then build it and run the build and sim as usual. The user can send hole shapes later; edit the scorecard file and rerun.

If there's no scorecard either, tell the user plainly what is missing and offer the alternatives:
- Map the missing holes in OpenStreetMap (osm.org, using the iD editor) and try again once the edit is live. Mapped golf data helps everyone, not just this game.
- Use the in-game Course Forger's screenshot survey (works when the game is published as a Claude artifact) or its "Describe it" tab for individual holes. Those courses are saved per player rather than built in.

## Reporting back

For each course, report: the name and slug, the club it is attached to, hole count, par and yardage, any missing or guessed holes, any problems, and whether the build and sim passed. Mention that the course carries the OpenStreetMap attribution in its tag (`mapped by OpenStreetMap contributors`); if the user supplies their own `--tag`, keep an attribution in it. Don't commit or push unless the user asks.
