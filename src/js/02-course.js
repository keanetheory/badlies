// ---------- 02-course: hole model, generator, built-in courses ----------
// A hole lives in yards. x runs right, y runs down; the tee sits near the bottom, the green near the top.
// { name, par, yards, w, h, tee, pin, path[], fairways[], greens[], bunkers[], waters[], trees[{x,y,r}], teeBox, slope{x,y}, seed }

function ribbon(path, L, d0, d1, hwFn) {
  const left = [], right = [];
  const n = Math.max(3, Math.ceil((d1 - d0) / 6));
  for (let k = 0; k <= n; k++) {
    const t = k / n, d = lerp(d0, d1, t);
    const p = pointAtDist(path, L, d), a = pointAtDist(path, L, d - 2), b = pointAtDist(path, L, d + 2);
    const tl = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = -(b.y - a.y) / tl, ny = (b.x - a.x) / tl;
    const hw = hwFn(d) * clamp(.3 + Math.sqrt(Math.min(t, 1 - t) * 6), 0, 1);
    left.push({ x: p.x + nx * hw, y: p.y + ny * hw });
    right.push({ x: p.x - nx * hw, y: p.y - ny * hw });
  }
  return chaikin(left.concat(right.reverse()), 2);
}

function makeHole(o) {
  const rng = mulberry32(o.seed), par = o.par;
  const len = o.len || { 3: lerp(125, 172, rng()), 4: lerp(330, 425, rng()), 5: lerp(480, 540, rng()) }[par];
  const dog = o.dogleg || 0, dog2 = o.dogleg2 || 0;
  let ctrl;
  if (par === 3) ctrl = [{ x: 0, y: 0 }, { x: dog * .3, y: -len * .5 }, { x: dog, y: -len }];
  else if (par === 4) ctrl = [{ x: 0, y: 0 }, { x: dog * .04, y: -len * .3 }, { x: dog * .3, y: -len * .58 }, { x: dog, y: -len * .9 }];
  else ctrl = [{ x: 0, y: 0 }, { x: dog * .08, y: -len * .24 }, { x: dog * .8, y: -len * .5 }, { x: dog + dog2 * .3, y: -len * .74 }, { x: dog + dog2, y: -len * .96 }];
  let path = catmullRom(ctrl, 4), L = cumLen(path);
  const k = len / L[L.length - 1];
  path = path.map(p => ({ x: p.x * k, y: p.y * k })); L = cumLen(path);
  const tee = path[0], gc = path[path.length - 1];
  const pe = path[path.length - 4], endAng = Math.atan2(gc.y - pe.y, gc.x - pe.x);
  const gr = o.greenR || lerp(11, 15, rng());
  const h = { name: o.name || 'Unnamed', par, seed: o.seed, tee: { ...tee }, path, fairways: [], greens: [], bunkers: [], waters: [], trees: [], autoTrees: o.trees ?? 1, blurb: o.blurb || '' };
  h.greens.push(blob(gc.x, gc.y, gr * lerp(.9, 1.2, rng()), gr * lerp(.9, 1.2, rng()), rng, 24, .13, rng() * TAU));
  const pa = rng() * TAU, pr = gr * .45 * Math.sqrt(rng());
  h.pin = { x: gc.x + Math.cos(pa) * pr, y: gc.y + Math.sin(pa) * pr };

  const hw0 = o.hw || lerp(15, 21, rng()), ph1 = rng() * TAU, ph2 = rng() * TAU;
  const hwAt = d => hw0 * (1 + .18 * Math.sin(d / 45 + ph1) + .1 * Math.sin(d / 23 + ph2));
  const fStart = par > 3 ? (o.carry || lerp(62, 88, rng())) : len - gr - 28;
  h.fairways.push(ribbon(path, L, fStart, len - gr + 3, par > 3 ? hwAt : () => 9));

  const normalAt = d => { const a = pointAtDist(path, L, d - 2), b = pointAtDist(path, L, d + 2), tl = Math.hypot(b.x - a.x, b.y - a.y) || 1; return { p: pointAtDist(path, L, d), nx: -(b.y - a.y) / tl, ny: (b.x - a.x) / tl, ang: Math.atan2(b.y - a.y, b.x - a.x) }; };

  // water first, so sand can avoid it
  const wt = o.water || 'none';
  if (wt === 'left' || wt === 'right') {
    const side = wt === 'left' ? -1 : 1; // the normal points right of travel
    const d = par === 3 ? len - gr - 8 : len * lerp(.48, .68, rng());
    const rx = lerp(22, 32, rng()), ry = par === 3 ? lerp(26, 36, rng()) : lerp(40, 60, rng());
    const q = normalAt(d), off = (par === 3 ? gr : hwAt(d)) + rx * .74;
    h.waters.push(blob(q.p.x + q.nx * side * off, q.p.y + q.ny * side * off, rx, ry, rng, 26, .16, q.ang + Math.PI / 2));
  } else if (wt === 'front') {
    const ry = par === 3 ? Math.min(len * .26, 38) : lerp(12, 17, rng());
    const q = normalAt(len - gr - ry - 7);
    h.waters.push(blob(q.p.x, q.p.y, lerp(34, 46, rng()), ry, rng, 26, .14, q.ang + Math.PI / 2));
  } else if (wt === 'cross') {
    const q = normalAt(len * lerp(.55, .64, rng()));
    h.waters.push(blob(q.p.x, q.p.y, 95, 5.5, rng, 30, .12, q.ang + Math.PI / 2 + lerp(-.25, .25, rng())));
  }
  const wet = p => h.waters.some(w => pointInPoly(p, w));

  const front = endAng + Math.PI;
  const nG = o.bunkers ?? 1 + Math.floor(rng() * 3);
  for (let i = 0; i < nG; i++) {
    const side = i % 2 ? 1 : -1, ang = front + side * lerp(.85, 2.3, rng()), br = lerp(4.5, 7.5, rng());
    const c = { x: gc.x + Math.cos(ang) * (gr * 1.08 + br * .8), y: gc.y + Math.sin(ang) * (gr * 1.08 + br * .8) };
    if (!wet(c)) h.bunkers.push(blob(c.x, c.y, br * lerp(1, 1.5, rng()), br, rng, 16, .22, ang + Math.PI / 2));
  }
  const nF = par > 3 ? (o.fbunkers ?? Math.floor(rng() * 3)) : 0;
  for (let i = 0; i < nF; i++) {
    const d = clamp(i === 0 ? lerp(215, 262, rng()) : len - lerp(95, 125, rng()), fStart + 40, len - 62);
    const q = normalAt(d), side = rng() < .5 ? 1 : -1, off = hwAt(d) + 4;
    const c = { x: q.p.x + q.nx * side * off, y: q.p.y + q.ny * side * off };
    if (!wet(c)) h.bunkers.push(blob(c.x, c.y, lerp(5, 7, rng()), lerp(8, 12, rng()), rng, 16, .2, q.ang + Math.PI / 2));
  }
  return finalizeHole(h);
}

function finalizeHole(h) {
  const rng = mulberry32(((h.seed || 7) ^ 0x9e3779b9) >>> 0);
  if (h.path.length < 8) h.path = catmullRom(h.path, 4);
  if (!h.teeBox) {
    const a = Math.atan2(h.path[1].y - h.path[0].y, h.path[1].x - h.path[0].x);
    h.teeBox = [[-6, -4.5], [6, -4.5], [6, 4.5], [-6, 4.5]].map(([x, y]) => rotatePt({ x: h.tee.x + x, y: h.tee.y + y }, h.tee, a));
  }
  const bb = [1e9, 1e9, -1e9, -1e9];
  const ext = p => { if (p.x < bb[0]) bb[0] = p.x; if (p.y < bb[1]) bb[1] = p.y; if (p.x > bb[2]) bb[2] = p.x; if (p.y > bb[3]) bb[3] = p.y; };
  [h.tee, h.pin, ...h.path].forEach(ext);
  for (const set of [h.fairways, h.greens, h.bunkers]) for (const poly of set) poly.forEach(ext);
  const m = 38; let minx = bb[0] - m, maxx = bb[2] + m; const miny = bb[1] - m, maxy = bb[3] + m;
  if (maxx - minx < 170) { const c = (minx + maxx) / 2; minx = c - 85; maxx = c + 85; }
  const T = p => ({ x: p.x - minx, y: p.y - miny });
  h.tee = T(h.tee); h.pin = T(h.pin); h.path = h.path.map(T); h.teeBox = h.teeBox.map(T);
  for (const k of ['fairways', 'greens', 'bunkers', 'waters']) h[k] = h[k].map(poly => poly.map(T));
  h.trees = (h.trees || []).map(t => ({ x: t.x - minx, y: t.y - miny, r: t.r }));
  h.w = maxx - minx; h.h = maxy - miny;
  if (!h.slope) { const a = rng() * TAU, mg = lerp(.1, .36, rng()); h.slope = { x: Math.cos(a) * mg, y: Math.sin(a) * mg }; }
  prepHole(h);
  if (h.autoTrees) scatterTrees(h, rng, h.autoTrees);
  return h;
}

// Recompute the derived bits (bounding boxes, path lengths). Call after loading a saved hole.
function prepHole(h) {
  for (const k of ['fairways', 'greens', 'bunkers', 'waters']) for (const poly of h[k]) poly.bb = polyBB(poly);
  h.teeBox.bb = polyBB(h.teeBox);
  h.L = cumLen(h.path);
  h.yards = h.yards || Math.round(h.L[h.L.length - 1]);
  h.greenC = centroid(h.greens[0]); h.greenR = polyRadius(h.greens[0], h.greenC);
  return h;
}

function inAny(polys, p) {
  for (const poly of polys) { const b = poly.bb; if (p.x < b[0] || p.x > b[2] || p.y < b[1] || p.y > b[3]) continue; if (pointInPoly(p, poly)) return true; }
  return false;
}
function surfaceAt(h, p) {
  if (p.x < 0 || p.y < 0 || p.x > h.w || p.y > h.h) return 'ob';
  if (inAny(h.greens, p)) return 'green';
  if (inAny(h.bunkers, p)) return 'sand';
  if (inAny(h.waters, p)) return 'water';
  if (inAny([h.teeBox], p)) return 'tee';
  if (inAny(h.fairways, p)) return 'fairway';
  for (const t of h.trees) { const dx = p.x - t.x, dy = p.y - t.y, r = t.r * .75; if (dx * dx + dy * dy < r * r) return 'trees'; }
  return 'rough';
}

function scatterTrees(h, rng, density) {
  const noise = makeNoise((h.seed || 3) + 77), target = Math.min(170, h.w * h.h / 650 * density);
  for (let tries = 0; tries < target * 7 && h.trees.length < target; tries++) {
    const p = { x: lerp(3, h.w - 3, rng()), y: lerp(3, h.h - 3, rng()) };
    if (noise(p.x / 48, p.y / 48, 2) < .5) continue;
    if (nearestIdx(h.path, p).d < 24) continue;
    let ok = surfaceAt(h, p) === 'rough';
    for (let a = 0; ok && a < 6; a++) ok = surfaceAt(h, { x: clamp(p.x + Math.cos(a) * 9, 0, h.w), y: clamp(p.y + Math.sin(a) * 9, 0, h.h) }) === 'rough';
    if (ok) h.trees.push({ x: p.x, y: p.y, r: lerp(3.5, 7.5, rng()) });
  }
  h.trees.sort((a, b) => a.y - b.y);
}

// Compact JSON for saved custom holes.
function packHole(h) {
  const keep = { name: h.name, par: h.par, yards: h.yards, w: h.w, h: h.h, seed: h.seed, tee: h.tee, pin: h.pin, path: h.path, fairways: h.fairways, greens: h.greens, bunkers: h.bunkers, waters: h.waters, trees: h.trees, teeBox: h.teeBox, slope: h.slope, blurb: h.blurb || '' };
  return JSON.parse(JSON.stringify(keep, (k, v) => typeof v === 'number' ? Math.round(v * 10) / 10 : v));
}
function unpackHole(o) { const h = JSON.parse(JSON.stringify(o)); h.slope = h.slope || { x: .2, y: .1 }; return prepHole(h); }

// ---------- built-in courses ----------
const THEMES = {
  lush: { label: 'Parkland', wind: 12, trees: 1 },
  links: { label: 'Links', wind: 22, trees: .12 },
  desert: { label: 'Desert', wind: 9, trees: .45 },
};
const SODDEN = [
  { par: 4, name: 'The Handshake', blurb: 'Wide open. If you miss this fairway, golf may not be your sport.', seed: 101, len: 355, dogleg: 10, hw: 22, bunkers: 1, fbunkers: 0 },
  { par: 3, name: 'Wet Sock', blurb: 'All carry over the pond. Bring a spare ball. Bring several.', seed: 202, len: 142, water: 'front', bunkers: 1 },
  { par: 5, name: 'Long Walk, Short Temper', blurb: 'Three good shots. You have maybe one.', seed: 303, len: 505, dogleg: 45, dogleg2: -30, fbunkers: 2, bunkers: 2 },
  { par: 4, name: 'Sandy\u2019s Revenge', blurb: 'More beach than a package holiday.', seed: 404, len: 372, dogleg: -25, bunkers: 3, fbunkers: 2 },
  { par: 4, name: 'The Lawyer', blurb: 'Bends the truth, hard left, around the lake.', seed: 505, len: 395, dogleg: -75, water: 'left', bunkers: 1, fbunkers: 1 },
  { par: 3, name: 'Postage Due', blurb: 'A tiny green wearing a necklace of sand.', seed: 606, len: 128, greenR: 10, bunkers: 3 },
  { par: 5, name: 'Ego Check', blurb: 'The creek says lay up. Your ego says otherwise.', seed: 707, len: 528, dogleg: -40, dogleg2: 55, water: 'cross', bunkers: 2, fbunkers: 1 },
  { par: 4, name: 'The In-Law', blurb: 'Narrow, unforgiving, and it remembers everything.', seed: 808, len: 408, dogleg: 30, hw: 14, water: 'right', bunkers: 2, fbunkers: 1 },
  { par: 4, name: 'Last Orders', blurb: 'The bar is watching from the terrace. No pressure.', seed: 909, len: 418, dogleg: 55, water: 'front', bunkers: 2, fbunkers: 1 },
];
const PROC_NAMES = {
  links: ['Gorse Code', 'Sideways Rain', 'The Kilt Lifter', 'Pot Luck', 'Hell\u2019s Half Acre', 'Wee Beastie', 'Marram Karma', 'The Long Sulk', 'Haar Haar'],
  desert: ['Dry Heave', 'Cactus Tax', 'Mirage', 'Snake Eyes', 'The Timeshare', 'Sunstroke', 'Tumbleweed', 'Buzzard\u2019s Buffet', 'Last Chance Saloon'],
};
function procSpecs(theme, seed) {
  const rng = mulberry32(seed), pars = [4, 3, 5, 4, 4, 3, 5, 4, 4], waters = ['none', 'none', 'left', 'right', 'front', 'cross', 'none'];
  return pars.map((par, i) => ({
    par, name: PROC_NAMES[theme][i], seed: seed + i * 131, dogleg: par === 3 ? lerp(-8, 8, rng()) : lerp(-70, 70, rng()), dogleg2: lerp(-50, 50, rng()),
    water: theme === 'links' ? (rng() < .2 ? 'cross' : 'none') : (rng() < (theme === 'desert' ? .3 : .5) ? pick(waters, rng) : 'none'),
    bunkers: theme === 'links' ? 2 + Math.floor(rng() * 3) : 1 + Math.floor(rng() * 3), fbunkers: par > 3 ? Math.floor(rng() * (theme === 'links' ? 4 : 3)) : 0,
    trees: THEMES[theme].trees,
  }));
}
const BUILTIN = [
  { id: 'sodden', name: 'Sodden Hollow Golf & Regret Club', theme: 'lush', tag: 'Parkland. Damp. Judgemental members.', specs: SODDEN },
  { id: 'windy', name: 'Windy Bottom Links', theme: 'links', tag: 'No trees, no shelter, no mercy from the wind.', specs: procSpecs('links', 4242) },
  { id: 'mirage', name: 'Cactus Jack\u2019s Mirage Dunes', theme: 'desert', tag: 'Miss the grass and you are playing off the surface of Mars.', specs: procSpecs('desert', 9191) },
];
const holeCache = {};
function getCourse(id, customs) {
  const b = BUILTIN.find(c => c.id === id);
  // Built-ins are either generated from specs or imported from map data (packed holes, see 02b-real-courses).
  if (b) { if (!holeCache[id]) holeCache[id] = b.packed ? b.packed.map(unpackHole) : b.specs.map(makeHole); return { id, name: b.name, theme: b.theme, tag: b.tag, club: b.club, holes: holeCache[id] }; }
  const c = (customs || []).find(c => c.id === id);
  if (!c) return getCourse('sodden');
  if (!holeCache[id]) holeCache[id] = c.holes.map(unpackHole);
  return { id, name: c.name, theme: c.theme || 'lush', tag: 'Forged by you. Blame accordingly.', holes: holeCache[id], custom: true };
}
