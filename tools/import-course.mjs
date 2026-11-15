// Course importer: turns the OpenStreetMap golf layout around a lat/long into a built-in Bad Lies course.
// Driven by the course-creator agent (.claude/agents/course-creator.md), but fine to run by hand.
//
//   node tools/import-course.mjs --at "51.2345, -0.5432" --id rabbit-warren --name "Rabbit Warren" [options]
//
// Options
//   --at "LAT, LON"     coordinates as copied from Google Maps (or use --lat and --lon)
//   --id ID             short slug for the course (letters, digits, dashes)
//   --name NAME         display name
//   --club CLUB         make it a club's home course: magpie, hightrees, rabbit, scarlet, darker
//   --theme THEME       lush (parkland, default), links or desert
//   --tag TEXT          one-line description shown on the course card
//   --radius M          search radius in metres around the point (default 1500)
//   --holes A-B         only keep holes whose ref is in this range, e.g. 1-9 or 10-18
//   --file PATH         use saved Overpass/GeoJSON data instead of fetching
//   --save PATH         also write the fetched data to PATH (reuse it with --file, e.g. after a dry run)
//   --dry-run           report what would be imported without writing anything
//   --rebuild           only regenerate src/js/02b-real-courses.js from courses/*.json
//   --remove ID         delete a course and regenerate
//
// Writes courses/raw/ID.osm.json (the fetched data, git-ignored), courses/ID.json (the packed course)
// and regenerates src/js/02b-real-courses.js, which the build inlines like any other source file.
// Courses with no usable map data can be built from a scorecard instead: see tools/scorecard-course.mjs.
import fs from 'node:fs';
import { P, CLUB_IDS, THEMES, BL, parseArgs, die, regenerate, checkHoles, report, writeCourse } from './course-lib.mjs';

// Public Overpass servers, tried in turn when one is busy.
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
const args = parseArgs(process.argv.slice(2));

if (args.rebuild) { regenerate(); process.exit(0); }
if (args.remove) {
  const id = String(args.remove); let gone = 0;
  for (const f of [`courses/${id}.json`, `courses/raw/${id}.osm.json`]) if (fs.existsSync(P(f))) { fs.unlinkSync(P(f)); gone++; }
  if (!gone) die(`no course called ${id}`);
  regenerate(); process.exit(0);
}

// ---- inputs ----
let lat = parseFloat(args.lat), lon = parseFloat(args.lon);
if (args.at) { const m = String(args.at).match(/(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)/); if (!m) die('--at should look like "51.2345, -0.5432"'); lat = +m[1]; lon = +m[2]; }
if (!args.file && !(Number.isFinite(lat) && Number.isFinite(lon))) die('give --at "LAT, LON" (or --lat and --lon), or --file');
if (Number.isFinite(lat) && (Math.abs(lat) > 90 || Math.abs(lon) > 180)) die('those coordinates are off the planet. Google Maps copies them as "latitude, longitude".');
const id = String(args.id || '').toLowerCase();
if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(id)) die('give --id as a short slug, e.g. rabbit-warren');
const name = String(args.name || '').trim() || die('give --name');
const club = args.club ? String(args.club) : null; if (club && !CLUB_IDS.includes(club)) die(`--club must be one of ${CLUB_IDS.join(', ')}`);
const theme = String(args.theme || 'lush'); if (!THEMES.includes(theme)) die(`--theme must be one of ${THEMES.join(', ')}`);
const radius = Math.max(200, Math.min(4000, parseInt(args.radius) || 1500));
let holeRange = null;
if (args.holes) { const m = String(args.holes).match(/^(\d+)-(\d+)$/); if (!m) die('--holes should look like 1-18'); holeRange = [+m[1], +m[2]]; }

// ---- fetch ----
const query = (la, lo, r) => `[out:json][timeout:90];
(
  way(around:${r},${la},${lo})[golf];
  relation(around:${r},${la},${lo})[golf];
  way(around:${r},${la},${lo})[natural~"^(water|wood|sand|scrub)$"];
  relation(around:${r},${la},${lo})[natural~"^(water|wood)$"];
  way(around:${r},${la},${lo})[landuse=forest];
  node(around:${r},${la},${lo})[natural=tree];
  way(around:${r},${la},${lo})[leisure=golf_course];
  relation(around:${r},${la},${lo})[leisure=golf_course];
);
out geom;`;
let raw;
if (args.file) raw = fs.readFileSync(String(args.file), 'utf8');
else {
  console.log(`Fetching OpenStreetMap golf data within ${radius} m of ${lat}, ${lon} ...`);
  let last = '';
  for (let t = 0; t < 6 && raw === undefined; t++) {
    const url = OVERPASS[t % OVERPASS.length];
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'badlies-course-importer/1.0' }, body: 'data=' + encodeURIComponent(query(lat, lon, radius)), signal: AbortSignal.timeout(120000) });
      if (res.ok) { raw = await res.text(); break; }
      last = `${new URL(url).host} returned ${res.status}`;
      if (res.status === 400) die(`${last}: ${(await res.text()).slice(0, 300)}`);
    } catch (e) { last = `${new URL(url).host}: ${e.message}`; }
    const wait = Math.min(40, 5 * 2 ** Math.floor(t / OVERPASS.length));
    console.log(`${last}; trying ${new URL(OVERPASS[(t + 1) % OVERPASS.length]).host} in ${wait}s ...`);
    await new Promise(r => setTimeout(r, wait * 1000));
  }
  if (raw === undefined) die(`every Overpass server was busy or unreachable (${last}). Try again in a few minutes.`);
}
if (args.save && !args.file) fs.writeFileSync(String(args.save), raw);
let data; try { data = JSON.parse(raw); } catch (e) { die('the map data is not valid JSON'); }
if (!data.elements) die('expected Overpass JSON with an "elements" array (GeoJSON files: pass them to the in-game Course Forger instead)');

// ---- keep only the course at the point ----
// Several courses can sit inside the search radius. Use the leisure=golf_course boundary that contains
// the point (or the nearest one) and drop features that fall outside it.
const ringsOf = e => e.geometry ? [e.geometry.map(g => [g.lon, g.lat])] : (e.members || []).filter(m => m.role === 'outer' && m.geometry).map(m => m.geometry.map(g => [g.lon, g.lat]));
const inRing = (p, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) c = !c; } return c; };
const ptsOf = e => e.type === 'node' ? [[e.lon, e.lat]] : ringsOf(e).flat();
const mid = pts => [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
const courseAreas = data.elements.filter(e => e.tags && e.tags.leisure === 'golf_course').map(e => ({ e, rings: ringsOf(e).filter(r => r.length > 3) })).filter(c => c.rings.length);
const notes = [];
let els = data.elements.filter(e => !(e.tags && e.tags.leisure === 'golf_course'));
let boundary = null;
if (Number.isFinite(lat) && courseAreas.length) {
  const here = [lon, lat];
  boundary = courseAreas.find(c => c.rings.some(r => inRing(here, r))) ||
    courseAreas.map(c => ({ c, d: Math.min(...c.rings.flat().map(p => Math.hypot(p[0] - lon, p[1] - lat))) })).sort((a, b) => a.d - b.d)[0].c;
  const inside = p => boundary.rings.some(r => inRing(p, r));
  const before = els.length;
  els = els.filter(e => { const pts = ptsOf(e); if (!pts.length) return false; return e.tags && e.tags.golf ? inside(mid(pts)) : pts.some(inside); });
  notes.push(`Course boundary: ${boundary.e.tags.name || '(unnamed)'} (${boundary.e.type} ${boundary.e.id}); kept ${els.length} of ${before} features.${courseAreas.length > 1 ? ` ${courseAreas.length - 1} other course(s) nearby were ignored: ${courseAreas.filter(c => c !== boundary).map(c => c.e.tags.name || c.e.type + ' ' + c.e.id).join(', ')}.` : ''}`);
} else notes.push('No golf course boundary (leisure=golf_course) found, so everything inside the radius was used. Check for holes from a neighbouring course.');
if (holeRange) {
  const before = els.filter(e => e.tags && e.tags.golf === 'hole').length;
  els = els.filter(e => !(e.tags && e.tags.golf === 'hole') || ((r => r >= holeRange[0] && r <= holeRange[1])(parseInt(e.tags.ref))));
  notes.push(`--holes ${holeRange.join('-')}: kept ${els.filter(e => e.tags && e.tags.golf === 'hole').length} of ${before} hole lines.`);
}
const counts = {}; for (const e of els) { const g = e.tags && (e.tags.golf || e.tags.natural || e.tags.landuse); if (g) counts[g] = (counts[g] || 0) + 1; }
const holeLines = els.filter(e => e.tags && e.tags.golf === 'hole');
const refs = holeLines.map(e => e.tags.ref).filter(Boolean), dupes = [...new Set(refs.filter((r, i) => refs.indexOf(r) !== i))];
const nums = refs.map(r => parseInt(r)).filter(Number.isFinite);
if (nums.length) {
  const [lo, hi] = holeRange || [1, Math.max(...nums) > 9 ? 18 : 9], missing = [];
  for (let n = lo; n <= hi; n++) if (!nums.includes(n)) missing.push(n);
  if (missing.length) notes.push(`Holes ${missing.join(', ')} aren't mapped as golf=hole lines in OpenStreetMap, so they're missing. The game numbers the rest 1 to ${holeLines.length} in order.`);
}
const oddPar = holeLines.filter(e => e.tags.par && !(+e.tags.par >= 3 && +e.tags.par <= 5));
if (oddPar.length) notes.push(`Ignored an unlikely mapped par on ${oddPar.map(e => `hole ${e.tags.ref || '?'} (par ${e.tags.par}, way ${e.id})`).join(', ')}; the par comes from the hole's length instead.`);
if (dupes.length) notes.push(`Duplicate hole refs ${dupes.join(', ')}: probably two loops or a neighbouring course. Narrow it with --holes or --radius.`);

// ---- convert ----
let holes, gnotes;
try { ({ holes, notes: gnotes } = BL.importGeo(JSON.stringify({ elements: els }))); } catch (e) { die(e.message + `\nFeatures found: ${JSON.stringify(counts)}`); }
notes.push(...gnotes);
if (holeLines.length > 18) notes.push(`${holeLines.length} hole lines found; only the first 18 by ref were kept.`);

// ---- check every hole is playable ----
const { rows, problems } = checkHoles(holes, theme);
report({ id, name, club, theme }, holes, rows, notes, problems, `Features: ${JSON.stringify(counts)}`);

if (args['dry-run']) { console.log('\nDry run: nothing written.'); process.exit(problems.length ? 2 : 0); }

// ---- write ----
fs.mkdirSync(P('courses/raw/'), { recursive: true });
fs.writeFileSync(P(`courses/raw/${id}.osm.json`), raw);   // kept locally (git-ignored) so a course can be re-imported offline
const tag = String(args.tag || `${holes.length} real holes, mapped by OpenStreetMap contributors.`);
const course = { id, name, theme, tag, club, source: { lat: Number.isFinite(lat) ? lat : null, lon: Number.isFinite(lon) ? lon : null, radius, boundary: boundary ? `${boundary.e.type}/${boundary.e.id}` : null, holes: holeRange ? holeRange.join('-') : null, fetched: new Date().toISOString().slice(0, 10), attribution: 'Map data © OpenStreetMap contributors, ODbL' }, holes: holes.map(BL.packHole) };
writeCourse(course);
process.exit(problems.length ? 2 : 0);
