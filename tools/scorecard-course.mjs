// Builds a built-in course from a scorecard, for courses with no usable OpenStreetMap layout.
// Each hole is laid out by the game's own hole generator from its par and yardage, plus whatever is
// known about its shape (dogleg, water, bunkers, width). Unknown shapes get a gentle seeded bend.
//
//   node tools/scorecard-course.mjs courses/scorecards/magpie.json [--dry-run]
//   node tools/scorecard-course.mjs --all [--dry-run]      every file in courses/scorecards/
//
// Scorecard file:
// {
//   "id": "magpie", "name": "Magpie Golf Club", "club": "magpie", "theme": "lush", "tee": "Yellow",
//   "tag": "optional card text", "sources": ["where the card came from"],
//   "defaults": { "width": "wide", "green": "small", "bunkers": 1, "fbunkers": 0, "trees": 0.6, "bend": 20 },
//   "holes": [
//     { "par": 4, "yards": 260, "si": 17,
//       "shape": "straight | left | right | hard-left | hard-right | left-right | right-left",
//       "water": "none | left | right | front | cross",
//       "bunkers": 2, "fbunkers": 1, "width": "narrow | normal | wide", "green": "small | normal | large",
//       "trees": 1, "name": "optional", "blurb": "optional" }
//   ]
// }
// Anything left out of a hole falls back to "defaults", then to the generator's own choice.
import fs from 'node:fs';
import { P, CLUB_IDS, THEMES, BL, parseArgs, die, checkHoles, report, writeCourse } from './course-lib.mjs';

const args = parseArgs(process.argv.slice(2));
const target = process.argv.slice(2).find(a => !a.startsWith('--') && a.endsWith('.json'));
const files = args.all ? fs.readdirSync(P('courses/scorecards/')).filter(f => f.endsWith('.json')).map(f => 'courses/scorecards/' + f) : target ? [target] : die('give a scorecard file, or --all');

const SHAPES = { straight: [0, 0], left: [-40, 0], right: [40, 0], 'hard-left': [-75, 0], 'hard-right': [75, 0], 'left-right': [-40, 55], 'right-left': [40, -55] };
const WIDTH = { narrow: 14, wide: 23 }, GREEN = { small: 10, large: 16 }, WATER = ['none', 'left', 'right', 'front', 'cross'];

function build(card) {
  const id = String(card.id || '').toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(id)) die('"id" should be a short slug, e.g. rabbit-warren');
  if (!card.name) die(`${id}: "name" is missing`);
  if (card.club && !CLUB_IDS.includes(card.club)) die(`${id}: "club" must be one of ${CLUB_IDS.join(', ')}`);
  const theme = card.theme || 'lush'; if (!THEMES.includes(theme)) die(`${id}: "theme" must be one of ${THEMES.join(', ')}`);
  if (!Array.isArray(card.holes) || !card.holes.length || card.holes.length > 18) die(`${id}: "holes" needs 1 to 18 holes`);
  const D = card.defaults || {}, notes = [], guessed = [], specs = [];
  const maxSi = Math.max(...card.holes.map(h => h.si || 0));
  const holes = card.holes.map((c, k) => {
    if (![3, 4, 5].includes(c.par)) die(`${id} hole ${k + 1}: par must be 3, 4 or 5`);
    if (!(c.yards >= 60 && c.yards <= 700)) die(`${id} hole ${k + 1}: yards must be between 60 and 700`);
    const water = c.water || D.water || 'none'; if (!WATER.includes(water)) die(`${id} hole ${k + 1}: water must be one of ${WATER.join(', ')}`);
    const seed = (BL.hashStr(id) + k * 131) >>> 0, rng = mulberry(seed ^ 0x5bd1e995);
    let dog, dog2;
    if (c.shape) { if (!SHAPES[c.shape]) die(`${id} hole ${k + 1}: shape must be one of ${Object.keys(SHAPES).join(', ')}`); [dog, dog2] = SHAPES[c.shape]; }
    else { const b = D.bend ?? 25; dog = (rng() * 2 - 1) * b; dog2 = (rng() * 2 - 1) * b * .8; guessed.push(k + 1); }
    if (c.par === 3) { dog *= .2; dog2 = 0; }
    const width = c.width || D.width, green = c.green || D.green;
    const blurb = c.blurb ?? (c.si === 1 ? 'Stroke index 1. The hardest hole on the card.' : c.si && c.si === maxSi && maxSi > 1 ? 'The easiest hole on the card, allegedly.' : '');
    const spec = { par: c.par, len: c.yards, name: c.name || `Hole ${k + 1}`, blurb, seed, dogleg: dog, dogleg2: dog2, water,
      hw: WIDTH[width], greenR: GREEN[green], bunkers: c.bunkers ?? D.bunkers, fbunkers: c.fbunkers ?? D.fbunkers, trees: c.trees ?? D.trees ?? 1 };
    for (const k2 of Object.keys(spec)) if (spec[k2] === undefined) delete spec[k2];
    specs.push(spec);
    return BL.makeHole({ ...spec });
  });
  if (guessed.length) notes.push(`No shape given for hole${guessed.length === 1 ? '' : 's'} ${guessed.join(', ')}, so ${guessed.length === 1 ? 'it gets' : 'they get'} a gentle seeded bend.`);
  return { id, theme, holes, specs, notes, guessed };
}
// Tiny local RNG so a hole's guessed bend doesn't depend on the generator's internal draws.
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

let worst = 0;
for (const f of files) {
  let card; try { card = JSON.parse(fs.readFileSync(f.startsWith('courses/') ? P(f) : f, 'utf8')); } catch (e) { die(`${f}: ${e.message}`); }
  const { id, theme, holes, specs, notes, guessed } = build(card);
  const { rows, problems } = checkHoles(holes, theme);
  report({ id, name: card.name, club: card.club, theme }, holes, rows, notes, problems, `From the ${card.tee || 'club'} tees on the scorecard.`);
  if (problems.length) worst = 2;
  if (args['dry-run']) { console.log('Dry run: nothing written.'); continue; }
  const n = holes.length;
  const tag = card.tag || `${n} holes from the club scorecard${guessed.length ? `. Hole shapes are approximate.` : ' and hole guide.'}`;
  writeCourse({ id, name: card.name, theme, tag, club: card.club || null, source: { scorecard: card.tee || null, sources: card.sources || [], built: new Date().toISOString().slice(0, 10), approximateShapes: guessed }, specs });
}
process.exit(worst);
