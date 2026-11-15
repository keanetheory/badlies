// ---------- 07-forger: the course agent ----------
// Three ways in, one way out (a playable hole in yards, ready for the shaded renderer):
//   A. map data  — GeoJSON or Overpass JSON with OpenStreetMap golf tags (exact geometry, whole course at once)
//   B. screenshot — a satellite or map image of one hole, surveyed by the vision model
//   C. description — a sentence or two, laid out by the model (or by a keyword parser when offline)
const YD = 1.09361;

// ---- A. map data ----
function geoFeatures(text) {
  const j = JSON.parse(text), out = [];
  const add = (tags, type, coords) => {
    if (!tags) return;
    if (type === 'Point') out.push({ tags, kind: 'pt', pts: [coords] });
    else if (type === 'LineString') out.push({ tags, kind: coords.length > 3 && coords[0][0] === coords[coords.length - 1][0] && coords[0][1] === coords[coords.length - 1][1] && tags.golf !== 'hole' ? 'poly' : 'line', pts: coords });
    else if (type === 'Polygon') out.push({ tags, kind: 'poly', pts: coords[0] });
    else if (type === 'MultiPolygon') coords.forEach(c => out.push({ tags, kind: 'poly', pts: c[0] }));
  };
  if (j.elements) {
    for (const e of j.elements) {
      if (e.type === 'node' && e.lat != null) add(e.tags, 'Point', [e.lon, e.lat]);
      else if (e.geometry) add(e.tags, 'LineString', e.geometry.map(g => [g.lon, g.lat]));
      else if (e.members) e.members.filter(m => m.role === 'outer' && m.geometry).forEach(m => add(e.tags, 'Polygon', [m.geometry.map(g => [g.lon, g.lat])]));
    }
  } else {
    const fs = j.type === 'FeatureCollection' ? j.features : j.type === 'Feature' ? [j] : [];
    for (const f of fs) if (f.geometry) add(f.properties && (f.properties.tags || f.properties), f.geometry.type, f.geometry.coordinates);
  }
  return out;
}
function geoClass(t) {
  const g = t.golf;
  if (g === 'hole') return 'hole';
  if (g === 'fairway' || g === 'green' || g === 'bunker' || g === 'tee') return g;
  if (g === 'water_hazard' || g === 'lateral_water_hazard' || t.natural === 'water' || t.waterway === 'riverbank') return 'water';
  if (t.natural === 'sand') return 'bunker';
  if (t.natural === 'wood' || t.landuse === 'forest' || t.natural === 'scrub') return 'wood';
  if (t.natural === 'tree') return 'tree';
  return null;
}
function distToPolyline(p, line) {
  let best = 1e9;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i], b = line[i + 1], dx = b.x - a.x, dy = b.y - a.y, t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
    best = Math.min(best, Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t));
  }
  return best;
}
function fillTrees(poly, rng, limit, keep) {
  const bb = polyBB(poly), out = [];
  for (let y = bb[1]; y < bb[3]; y += 9) for (let x = bb[0]; x < bb[2]; x += 9) {
    const p = { x: x + rng() * 7, y: y + rng() * 7 };
    if (out.length < limit && pointInPoly(p, poly) && (!keep || keep(p))) out.push({ x: p.x, y: p.y, r: lerp(4, 7.5, rng()) });
  }
  return out;
}
function importGeo(text) {
  const feats = geoFeatures(text).map(f => ({ ...f, cls: geoClass(f.tags) })).filter(f => f.cls);
  if (!feats.length) throw new Error('No golf features in that data. It needs OpenStreetMap tags like golf=green, golf=fairway, golf=hole.');
  let lat0 = 0, lon0 = 0, n = 0;
  for (const f of feats) for (const c of f.pts) { lon0 += c[0]; lat0 += c[1]; n++; }
  lat0 /= n; lon0 /= n;
  const kx = Math.cos(lat0 * Math.PI / 180) * 111320 * YD, ky = 110540 * YD;
  for (const f of feats) { f.xy = f.pts.map(c => ({ x: (c[0] - lon0) * kx, y: -(c[1] - lat0) * ky })); f.c = centroid(f.xy); }
  const of = c => feats.filter(f => f.cls === c);
  let lines = of('hole').filter(f => f.kind === 'line' && f.xy.length >= 2).map(f => ({ line: f.xy, tags: f.tags }));
  const notes = [];
  if (!lines.length) {
    // No routing in the data: pair each green with the tee whose corridor holds the most fairway.
    const greens = of('green'), tees = of('tee'), fw = of('fairway'), cand = [];
    for (const g of greens) for (const t of tees) {
      const d = dist(g.c, t.c); if (d < 85 || d > 620) continue;
      const seg = [t.c, g.c], cover = fw.filter(f => distToPolyline(f.c, seg) < 40).length;
      cand.push({ g, t, score: cover * 10 + (d < 250 && !cover ? 4 : 0) - Math.abs(d - 380) / 200 });
    }
    cand.sort((a, b) => b.score - a.score);
    const used = new Set();
    for (const c of cand) { if (used.has(c.g) || used.has(c.t) || c.score <= 0) continue; used.add(c.g); used.add(c.t); lines.push({ line: [c.t.c, c.g.c], tags: {} }); }
    if (lines.length) notes.push('No hole routing in the data, so tees were matched to greens by eye. Check the order.');
  }
  if (!lines.length) throw new Error('Found golf features but could not work out any holes. Include golf=hole lines, or at least tees and greens.');
  lines.sort((a, b) => (parseInt(a.tags.ref) || 99) - (parseInt(b.tags.ref) || 99));
  const holes = [];
  for (const [k, { line, tags }] of lines.slice(0, 18).entries()) {
    const tee = line[0], end = line[line.length - 1], rot = -Math.PI / 2 - Math.atan2(end.y - tee.y, end.x - tee.x);
    const R = p => rotatePt(p, tee, rot), near = (f, d) => f.xy.some(p => distToPolyline(p, line) < d);
    const rng = mulberry32(1234 + k * 17);
    let greens = of('green').filter(f => f.kind === 'poly' && dist(f.c, end) < 45).sort((a, b) => dist(a.c, end) - dist(b.c, end)).slice(0, 1).map(f => f.xy.map(R));
    if (!greens.length) { const e = R(end); greens = [blob(e.x, e.y, 13, 12, rng, 22, .12)]; }
    // Trust a mapped par only if it's a real one (3-5); otherwise work it out from the length.
    const len = cumLen(line).pop(), tp = parseInt(tags.par), par = tp >= 3 && tp <= 5 ? tp : (len < 250 ? 3 : len < 470 ? 4 : 5);
    const h = { name: tags.name || `Hole ${tags.ref || k + 1}`, par, seed: 500 + k * 31, tee: R(tee), pin: centroid(greens[0]), path: line.map(R), greens, autoTrees: 0, yards: Math.round(len),
      fairways: of('fairway').filter(f => f.kind === 'poly' && near(f, 30)).map(f => f.xy.map(R)),
      bunkers: of('bunker').filter(f => f.kind === 'poly' && near(f, 55)).map(f => f.xy.map(R)),
      waters: of('water').filter(f => f.kind === 'poly' && near(f, 70)).map(f => f.xy.map(R)), trees: [] };
    // Use a mapped tee box only if the hole line actually starts on it; otherwise finalizeHole draws one.
    const teeBox = of('tee').filter(f => f.kind === 'poly' && dist(f.c, tee) < 25 && pointInPoly(tee, f.xy))[0]; if (teeBox) h.teeBox = teeBox.xy.map(R);
    if (!h.fairways.length && par > 3) { const p = catmullRom(h.path, 4), L = cumLen(p), T = L[L.length - 1]; h.fairways = [ribbon(p, L, Math.min(80, T * .25), T - 10, () => 17)]; }
    const woods = of('wood').filter(f => f.kind === 'poly' && near(f, 90)).map(f => f.xy.map(R));
    const singles = of('tree').map(f => R(f.xy[0])).filter(p => distToPolyline(p, h.path) < 80);
    finalizeHole(h);
    const off = { x: h.tee.x - R(tee).x, y: h.tee.y - R(tee).y }, mv = p => ({ x: p.x + off.x, y: p.y + off.y });
    const clear = p => p.x > 2 && p.y > 2 && p.x < h.w - 2 && p.y < h.h - 2 && surfaceAt(h, p) === 'rough';
    for (const w of woods) h.trees.push(...fillTrees(w.map(mv), rng, 220 - h.trees.length, clear));
    for (const s of singles) { const p = mv(s); if (clear(p)) h.trees.push({ x: p.x, y: p.y, r: 5 }); }
    if (!h.trees.length) { h.autoTrees = .5; scatterTrees(h, rng, .5); }
    h.trees.sort((a, b) => a.y - b.y);
    holes.push(h);
  }
  return { holes, notes };
}
const OVERPASS_QUERY = (lat, lon) => `[out:json][timeout:25];
(
  way(around:1400,${lat},${lon})[golf];
  way(around:1400,${lat},${lon})[natural~"water|wood|sand"];
  node(around:1400,${lat},${lon})[natural=tree];
);
out geom;`;

// ---- B and C. surveyed specs ----
const SPEC_SHAPE = `{"name":"short cheeky name for the hole","par":3|4|5,"yards":number,
"tee":[x,y],"green":{"center":[x,y],"radius":number},
"centerline":[[x,y],...],            // 2 to 5 points from tee to green following the intended line of play
"fairways":[[[x,y],...]],            // polygon outlines, 8 to 24 points each
"bunkers":[{"center":[x,y],"radius":number}],
"water":[[[x,y],...]],               // polygon outlines
"woods":[[[x,y],...]],               // polygon outlines of tree cover
"notes":"one sentence on what you saw or assumed"}`;
function surveyPrompt(mode, extra) {
  const head = mode === 'image'
    ? `You are a golf course surveyor. The attached image is a satellite photo or map screenshot (for example from Google Maps) showing a golf hole. Trace the single most prominent complete hole.\nUse normalized image coordinates: x from 0 (left edge) to 1 (right edge), y from 0 (top edge) to 1 (bottom edge). Radii are fractions of the image width.`
    : `You are a golf course architect. Lay out one golf hole from this description: "${extra}".\nDraw on a canvas where x runs 0 (left) to 1 (right) and y runs 0 (top) to 1 (bottom). The canvas is half as wide as it is tall. Put the tee near the bottom and the green near the top, and use most of the height. Radii are fractions of the canvas width.`;
  return `${head}
Estimate "yards" as the playing length from tee to green centre (par 3: 100-240, par 4: 280-470, par 5: 480-600)${mode === 'image' ? ', using any scale bar, or typical fairway widths of 30-45 yards, to judge it' : ''}.
Fairway outlines should be believable shapes that stop short of the tee and run up to the green. Greens are about 25-35 yards across. Leave a list empty if the feature is absent.${mode === 'image' && extra ? `\nThe player adds: "${extra}".` : ''}
Reply with only JSON in this shape:
${SPEC_SHAPE}`;
}
function specToHole(spec, aspect, seed) {
  const P = a => ({ x: Number(a[0]) * aspect, y: Number(a[1]) });
  const ok = a => Array.isArray(a) && a.length >= 2 && isFinite(a[0]) && isFinite(a[1]);
  if (!spec || !ok(spec.tee) || !spec.green || !ok(spec.green.center)) throw new Error('The survey came back without a tee and a green. Try a clearer picture or description.');
  const tee0 = P(spec.tee), g0 = P(spec.green.center);
  let line = (Array.isArray(spec.centerline) ? spec.centerline.filter(ok).map(P) : []);
  if (line.length < 2 || dist(line[0], tee0) > dist(line[line.length - 1], tee0)) line = [tee0, g0];
  line[0] = tee0; line[line.length - 1] = g0;
  const rawLen = cumLen(line).pop() || 1e-6;
  const par = [3, 4, 5].includes(spec.par) ? spec.par : 4;
  const yards = clamp(Number(spec.yards) || { 3: 160, 4: 390, 5: 520 }[par], 90, 620), k = yards / rawLen;
  const rot = -Math.PI / 2 - Math.atan2(g0.y - tee0.y, g0.x - tee0.x);
  const W = p => { const q = rotatePt(p, tee0, rot); return { x: (q.x - tee0.x) * k, y: (q.y - tee0.y) * k }; };
  const polys = list => (Array.isArray(list) ? list : []).filter(pl => Array.isArray(pl) && pl.filter(ok).length >= 3).map(pl => chaikin(pl.filter(ok).map(P).map(W), 2));
  const rng = mulberry32(seed), gc = W(g0), gr = clamp((Number(spec.green.radius) || .03) * aspect * k, 9, 20);
  const h = { name: String(spec.name || 'Mystery Hole').slice(0, 40), par, seed, yards: Math.round(yards), tee: { x: 0, y: 0 }, pin: { x: gc.x + (rng() - .5) * gr * .6, y: gc.y + (rng() - .5) * gr * .6 }, path: line.map(W),
    greens: [blob(gc.x, gc.y, gr * lerp(.92, 1.15, rng()), gr * lerp(.92, 1.15, rng()), rng, 24, .12, rng() * TAU)], fairways: polys(spec.fairways), waters: polys(spec.water), trees: [], autoTrees: 0, blurb: String(spec.notes || '').slice(0, 160),
    bunkers: (Array.isArray(spec.bunkers) ? spec.bunkers : []).filter(b => b && ok(b.center)).slice(0, 14).map(b => { const c = W(P(b.center)), r = clamp((Number(b.radius) || .012) * aspect * k, 3.5, 11); return blob(c.x, c.y, r * lerp(1, 1.4, rng()), r, rng, 16, .2, rng() * TAU); }) };
  if (!h.fairways.length && par > 3) { const p = catmullRom(h.path, 4), L = cumLen(p), T = L[L.length - 1]; h.fairways = [ribbon(p, L, Math.min(80, T * .25), T - gr + 3, () => 18)]; }
  const woods = polys(spec.woods);
  finalizeHole(h);
  const mv = p => ({ x: p.x + h.tee.x, y: p.y + h.tee.y }); // finalizeHole translated everything; the tee was the origin
  const clear = p => p.x > 2 && p.y > 2 && p.x < h.w - 2 && p.y < h.h - 2 && surfaceAt(h, p) === 'rough' && distToPolyline(p, h.path) > 16;
  for (const w of woods) h.trees.push(...fillTrees(w.map(mv), rng, 200 - h.trees.length, clear));
  if (h.trees.length < 12) scatterTrees(h, rng, .6);
  h.trees.sort((a, b) => a.y - b.y);
  return h;
}
// Offline architect: enough keyword sense to turn "long par 5, dogleg right, water left" into a hole.
function describeLocally(text, seed) {
  const t = text.toLowerCase(), num = re => { const m = t.match(re); return m ? parseInt(m[1]) : null; };
  let par = num(/par[\s-]*([345])/), yards = num(/(\d{2,3})\s*(?:yards|yard|yds|yd|y\b)/);
  if (!par) par = yards ? (yards < 250 ? 3 : yards < 470 ? 4 : 5) : /short|little|tiny/.test(t) ? 3 : /long|monster|three[- ]shot/.test(t) ? 5 : 4;
  const big = /sharp|severe|hard|big/.test(t) ? 85 : 50;
  const dog = /dog\s*-?\s*leg|bend|turn|curv/.test(t) ? (/left/.test(t.split(/dog|bend|turn|curv/)[1] || t) ? -big : big) : 0;
  const side = s => new RegExp(`(water|lake|pond|creek|sea|ocean)[^.]{0,24}${s}|${s}[^.]{0,24}(water|lake|pond|creek|sea|ocean)`).test(t);
  const water = /island|carry|front|over (the )?(water|lake|pond)/.test(t) ? 'front' : /creek|stream|burn|ditch|cross/.test(t) ? 'cross' : side('left') ? 'left' : side('right') ? 'right' : /water|lake|pond/.test(t) ? pick(['left', 'right', 'front'], mulberry32(seed)) : 'none';
  const sandy = /bunker|sand|trap|beach/.test(t);
  return makeHole({ seed, par, len: yards ? clamp(yards, 90, 600) : undefined, dogleg: dog, dogleg2: /double|s-shape|snake/.test(t) ? -dog || 50 : 0, water,
    hw: /tight|narrow|skinny/.test(t) ? 13 : /wide|generous|open/.test(t) ? 24 : undefined, bunkers: /no bunker/.test(t) ? 0 : sandy ? (/lots|many|loads|surround|riddled/.test(t) ? 4 : 3) : 1, fbunkers: sandy && par > 3 ? 2 : undefined,
    greenR: /tiny|small green|postage/.test(t) ? 9.5 : /huge|big green|massive green/.test(t) ? 17 : undefined, trees: /no trees|links|open|treeless/.test(t) ? .1 : /forest|wood|tree-lined|trees/.test(t) ? 1.4 : .8,
    name: text.split(/[.,;]/)[0].trim().slice(0, 32) || 'Homemade Hole', blurb: 'Built from your description without the model, so I went by keywords.' });
}
async function downscale(file, maxPx = 1400) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('That file would not open as an image.')); i.src = url; });
    const k = Math.min(1, maxPx / Math.max(img.width, img.height)), cv = document.createElement('canvas');
    cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    const blob = await new Promise(ok => cv.toBlob(ok, 'image/jpeg', .85));
    return { blob, aspect: img.width / img.height };
  } finally { URL.revokeObjectURL(url); }
}
