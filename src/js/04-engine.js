// ---------- 04-engine: shots, putting physics, skills ----------
const SKILLS = ['drive', 'approach', 'chip', 'sand', 'putt'];
const SKILL_NAME = { drive: 'Driving', approach: 'Approach', chip: 'Chipping', sand: 'Sand play', putt: 'Putting' };
const LIE_NAME = { tee: 'Tee', fairway: 'Fairway', rough: 'Rough', sand: 'Bunker', trees: 'Trees', green: 'Green' };
const MAX_LEVEL = 10;
const xpNeed = lvl => 60 + 40 * lvl;

function shotCat(h, ball) {
  if (ball.lie === 'green') return 'putt';
  if (ball.lie === 'sand') return 'sand';
  if (ball.shots === 0 && h.par > 3) return 'drive';
  return dist(ball.pos, h.pin) < 55 ? 'chip' : 'approach';
}
function maxDist(p, cat, lie) {
  const s = p.skills; let m;
  if (cat === 'drive') m = 205 + 8 * s.drive;
  else if (cat === 'approach') m = 178 + 5 * s.approach;
  else if (cat === 'chip') m = 70;
  else if (cat === 'sand') m = 95 + 7 * s.sand;
  else m = 60;
  if (lie === 'rough') m *= .88; else if (lie === 'trees') m *= .55;
  return m;
}
// One standard deviation of angle (radians) and distance (fraction) for a player on a kind of shot.
function sigma(p, cat, lie) {
  const L = p.skills[cat]; let a, d;
  if (cat === 'drive') { a = 7 - .5 * L; d = .06 - .003 * L; }
  else if (cat === 'approach') { a = 6.6 - .48 * L; d = .1 - .007 * L; }
  else if (cat === 'chip') { a = 6 - .4 * L; d = .2 - .014 * L; }
  else if (cat === 'sand') { a = 9 - .6 * L; d = .28 - .02 * L; }
  else { a = 2.6 - .2 * L; d = .15 - .011 * L; }
  const k = lie === 'rough' ? 1.3 : lie === 'trees' ? 1.6 : 1;
  return { a: a * k * Math.PI / 180, d: d * k };
}
function clubName(cat, d, max) {
  if (cat === 'putt') return 'Putter';
  if (cat === 'sand') return 'Sand wedge';
  if (cat === 'chip') return d < 25 ? 'Chip' : 'Pitch';
  if (cat === 'drive') return d > max * .86 ? 'Driver' : d > max * .74 ? '3-wood' : 'Hybrid';
  const t = [[212, '3-wood'], [196, 'Hybrid'], [182, '4-iron'], [171, '5-iron'], [160, '6-iron'], [149, '7-iron'], [138, '8-iron'], [126, '9-iron'], [110, 'Pitching wedge'], [92, 'Gap wedge'], [72, 'Sand wedge']];
  for (const [y, n] of t) if (d > y) return n;
  return 'Lob wedge';
}
const ROLL = { drive: .12, approach: .06, chip: .4, sand: .25 };

// Full-swing shot. exec = { power: 1 is "as intended", ang: radians off line }.
function resolveShot(h, from, lie, target, exec, cat, wind) {
  const D = Math.hypot(target.x - from.x, target.y - from.y) || .01;
  const th = Math.atan2(target.y - from.y, target.x - from.x) + exec.ang, ux = Math.cos(th), uy = Math.sin(th);
  const total = D * exec.power, rf = ROLL[cat], carry = total * (1 - rf);
  let roll = total * rf;
  const wk = (cat === 'chip' || cat === 'sand') ? .002 : .0045;
  const land = { x: from.x + ux * carry + wind.x * carry * wk, y: from.y + uy * carry + wind.y * carry * wk };
  const res = { from, land, end: land, lie: 'rough', penalty: 0, holed: false, event: 'ok', carry, total };
  const s0 = surfaceAt(h, land);
  if (s0 === 'ob') { res.event = 'ob'; res.penalty = 1; res.end = { ...from }; res.lie = lie; return res; }
  if (s0 === 'water') return wetDrop(h, res, from, land, lie);
  if (s0 === 'trees') { res.lie = 'trees'; res.event = 'trees'; return res; }
  if (s0 === 'sand') { res.lie = 'sand'; return res; }
  if (s0 === 'green' && dist(land, h.pin) < .25) { res.holed = true; res.end = { ...h.pin }; res.lie = 'green'; return res; }
  if (s0 === 'rough') roll *= .35;
  let pos = { ...land }, cur = s0;
  const n = Math.ceil(roll), step = n ? roll / n : 0;
  for (let i = 0; i < n; i++) {
    const nx = { x: pos.x + ux * step, y: pos.y + uy * step }, s = surfaceAt(h, nx);
    if (s === 'ob') break;
    if (s === 'water') { res.end = nx; return wetDrop(h, res, pos, nx, lie); }
    pos = nx; cur = s;
    if (s === 'sand' || s === 'trees') break;
    if (s === 'green' && dist(pos, h.pin) < .2 && (n - i) * step < 2.2) { res.holed = true; pos = { ...h.pin }; break; }
    if (s === 'rough' && (n - i) > 2) i++; // rough eats roll twice as fast
  }
  res.end = pos; res.lie = cur; if (cur === 'trees') res.event = 'trees';
  return res;
}
function wetDrop(h, res, dry, wetPt, lie) {
  // walk back from the splash until we find land, then two more yards for the drop
  let p = { ...wetPt }; const dx = dry.x - wetPt.x, dy = dry.y - wetPt.y, L = Math.hypot(dx, dy) || 1;
  let k = 0; while (k < L + 4 && ['water', 'ob'].includes(surfaceAt(h, p))) { k += 1; p = { x: wetPt.x + dx / L * k, y: wetPt.y + dy / L * k }; }
  k += 2; p = { x: wetPt.x + dx / L * k, y: wetPt.y + dy / L * k };
  let s = surfaceAt(h, p); if (s === 'water' || s === 'ob') { p = { ...res.from }; s = lie; }
  res.splash = { ...wetPt }; res.end = p; res.lie = s === 'trees' ? 'rough' : s; res.penalty = 1; res.event = 'water';
  return res;
}

// Putting: a little rolling-ball sim with friction and a constant green slope.
const PUTT_A = 2.0, CUP_R = .1, CUP_V = 2.7;
function simulatePutt(h, from, ang, d) {
  const v0 = Math.sqrt(2 * PUTT_A * Math.max(.05, d));
  let x = from.x, y = from.y, vx = Math.cos(ang) * v0, vy = Math.sin(ang) * v0;
  const pts = [{ x, y }], dt = .01; let minD = 1e9, holed = false, on = true;
  for (let i = 0; i < 2500; i++) {
    const sp = Math.hypot(vx, vy); if (sp < .06) break;
    if (i % 12 === 0) on = surfaceAt(h, { x, y }) === 'green';
    const fr = on ? PUTT_A : PUTT_A * 3.2;
    vx += (-fr * vx / sp + (on ? h.slope.x : 0)) * dt; vy += (-fr * vy / sp + (on ? h.slope.y : 0)) * dt;
    if (vx * Math.cos(ang) + vy * Math.sin(ang) < 0 && sp < .3) break; // don't trickle back uphill forever
    x += vx * dt; y += vy * dt;
    const dp = Math.hypot(x - h.pin.x, y - h.pin.y); if (dp < minD) minD = dp;
    if (dp < CUP_R && sp < CUP_V) { holed = true; x = h.pin.x; y = h.pin.y; pts.push({ x, y }); break; }
    if (i % 2 === 0) pts.push({ x, y });
  }
  const end = { x, y }; let lie = holed ? 'green' : surfaceAt(h, end), penalty = 0;
  if (lie === 'water' || lie === 'ob') { penalty = 1; lie = 'green'; pts.push({ ...from }); return { pts, end: { ...from }, holed: false, lie, penalty, minD, event: 'water' }; }
  if (lie === 'trees') lie = 'rough';
  return { pts, end, holed, lie, penalty, minD, event: 'ok' };
}
// What a competent caddie would tell you: the line and weight that give the ball its best chance.
function bestPuttAim(h, from) {
  const base = Math.atan2(h.pin.y - from.y, h.pin.x - from.x), D = dist(from, h.pin);
  let best = null;
  const tryIt = (off, mult) => {
    const r = simulatePutt(h, from, base + off, D * mult + .3), score = r.holed ? -1 + Math.abs(mult - 1.06) * .1 : dist(r.end, h.pin) + r.minD;
    if (!best || score < best.score) best = { score, ang: base + off, d: D * mult + .3 };
  };
  for (let a = -8; a <= 8; a++) for (const m of [.85, .95, 1.05, 1.15, 1.3]) tryIt(a * .035, m);
  const c = { ...best };
  for (let a = -3; a <= 3; a++) for (const m of [-.04, 0, .04]) tryIt(c.ang - base + a * .009, (c.d - .3) / D + m);
  return best;
}

// How good was that, 0..1? Drives the XP award.
function shotQuality(h, cat, before, res) {
  const rem = res.holed ? 0 : dist(res.end, h.pin);
  if (res.penalty) return 0;
  if (cat === 'drive') return res.lie === 'fairway' ? clamp(.6 + res.total / 600, 0, 1) : res.lie === 'rough' ? .4 : res.lie === 'green' ? 1 : .15;
  if (cat === 'approach') return res.holed ? 1 : res.lie === 'green' ? clamp(1 - rem / 26, .5, 1) : res.lie === 'fairway' ? .35 : .2;
  if (cat === 'chip') return res.holed ? 1 : clamp(1 - (rem - 1.5) / 9, .1, 1);
  if (cat === 'sand') return res.holed ? 1 : res.lie === 'green' ? clamp(1 - rem / 20, .6, 1) : res.lie === 'sand' ? .05 : .45;
  return res.holed ? clamp(.75 + before / 20, 0, 1) : rem < .8 ? .6 : rem < 2 ? .35 : .15;
}
function addXp(sk, cat, amount) {
  // sk = { drive:{lvl,xp}, ... }; returns true on a level-up
  const s = sk[cat]; if (s.lvl >= MAX_LEVEL) return false;
  s.xp += amount; let up = false;
  while (s.lvl < MAX_LEVEL && s.xp >= xpNeed(s.lvl)) { s.xp -= xpNeed(s.lvl); s.lvl++; up = true; }
  if (s.lvl >= MAX_LEVEL) s.xp = 0;
  return up;
}
const levels = sk => Object.fromEntries(SKILLS.map(k => [k, sk[k].lvl]));
