// ---------- 06-round: formats, turn order, scoring. No DOM in here. ----------
const FORMATS = {
  strokeplay: { name: 'Strokeplay', n: 4, low: true, blurb: 'Count every shot. Lowest total wins. Golf at its simplest, and its most honest.', rules: 'Strokeplay: every shot counts. Lowest total over the round wins.' },
  stableford: { name: 'Stableford', n: 4, blurb: 'Points for not being terrible. Par is 2, birdie 3, and a double bogey gets you nothing but sympathy. You against all eight rivals.', rules: 'Stableford points: bogey 1, par 2, birdie 3, eagle 4. Most points wins.' },
  matchplay: { name: 'Matchplay', n: 2, blurb: 'One on one. Win holes, not friends.', rules: 'Head-to-head matchplay: lowest score wins each hole.' },
  wolf: { name: 'Wolf', n: 4, blurb: 'Each hole someone is the Wolf. After the tee shots the Wolf picks a partner, or goes it alone like a hero. Or an idiot.', rules: 'Wolf: the Wolf picks a partner after tee shots (2 points each if they win, 3 each to the other pair if they lose) or goes alone (4 points for a win, 1 each to the other three for a loss).' },
  nines: { name: '9s', n: 3, blurb: 'Three players, nine points a hole. Best score takes 5, middle 3, worst 1. Ties split.', rules: 'Nines: 9 points per hole split 5-3-1 by score, ties shared.' },
  foursomes: { name: 'Foursomes', n: 4, teams: true, blurb: 'Two a side, one ball, alternate shots. Blame is shared. Mostly with your partner.', rules: 'Foursomes matchplay: partners alternate shots with one ball.' },
  pairs: { name: 'Pairs', n: 4, teams: true, blurb: 'Two a side, everyone plays their own ball, best score counts. Let your partner carry you.', rules: 'Better-ball pairs matchplay: the best score on each side counts.' },
};
const MATCH_FORMATS = ['matchplay', 'foursomes', 'pairs'];
const TAPIN = .6;
const parSoFar = R => R.results.reduce((a, r) => a + r.par, 0);
const toParText = d => d === 0 ? 'E' : d > 0 ? '+' + d : String(d);
const toParWords = d => d === 0 ? 'level par' : d > 0 ? `${d} over par` : `${-d} under par`;

function newRound(cfg) {
  const R = { fmt: cfg.format, holes: cfg.holes, total: cfg.total, theme: cfg.theme, courseName: cfg.courseName, players: cfg.players, field: cfg.field || [], hi: 0, up: 0, over: false, rng: mulberry32(cfg.seed || 1), results: [] };
  R.strokes = R.players.map(() => []); R.pts = R.players.map(() => 0); R.fieldPts = R.field.map(() => 0);
  R.teams = FORMATS[R.fmt].teams ? [[0, 1], [2, 3]] : null;
  for (const p of [...R.players, ...R.field]) { p.tiltNow = 0; p.heat = 0; p.plan = 'steady'; p.wolfLean = null; }
  return R;
}
function startHole(R) {
  const h = R.h = R.holes[R.hi % R.holes.length];
  const wa = R.rng() * TAU, wm = R.rng() * R.rng() * (THEMES[R.theme] || THEMES.lush).wind + 1;
  R.wind = { x: Math.cos(wa) * wm, y: Math.sin(wa) * wm, mph: Math.round(wm), ang: wa };
  const mk = (owner, hitters) => ({ owner, hitters, pos: { ...h.tee }, lie: 'tee', strokes: 0, shots: 0, holed: false });
  R.balls = R.fmt === 'foursomes' ? [mk(0, [0, 1]), mk(2, [2, 3])] : R.players.map((p, i) => mk(i, [i]));
  R.wolf = R.fmt === 'wolf' ? { idx: R.hi % 4, partner: null, decided: false } : null;
  return h;
}
const hitterOf = (R, b) => b.hitters.length === 1 ? b.hitters[0] : b.hitters[(R.hi + b.shots) % 2];
function nextBall(R) {
  const live = R.balls.filter(b => !b.holed); if (!live.length) return null;
  return live.find(b => b.shots === 0) || live.reduce((a, b) => dist(a.pos, R.h.pin) >= dist(b.pos, R.h.pin) ? a : b);
}
const needsWolfCall = R => !!R.wolf && !R.wolf.decided && R.balls.every(b => b.shots > 0);
function setWolf(R, partner) { R.wolf.partner = partner; R.wolf.decided = true; }

function applyShot(R, ball, res) {
  const h = R.h;
  ball.shots++; ball.strokes += 1 + res.penalty; ball.pos = { ...res.end }; ball.lie = res.lie;
  if (res.holed) ball.holed = true;
  else if (ball.lie === 'green' && dist(ball.pos, h.pin) < TAPIN) { ball.strokes++; ball.holed = true; res.tapin = true; ball.pos = { ...h.pin }; }
  if (!ball.holed && ball.strokes >= h.par + 4) { ball.strokes = h.par + 4; ball.holed = true; ball.pickedUp = res.pickedUp = true; }
  if (ball.holed && ball.strokes > h.par + 4) ball.strokes = h.par + 4;
  return res;
}
function puttRes(h, from, ang, d) {
  const pr = simulatePutt(h, from, ang, d);
  return { from: { ...from }, land: pr.end, end: pr.end, lie: pr.lie, penalty: pr.penalty, holed: pr.holed, event: pr.event, pts: pr.pts, putt: true, minD: pr.minD };
}
function npcShot(R, ball, pl) {
  const h = R.h, plan = npcPlan(pl, h, ball, R.wind), ex = npcExec(pl, plan.cat, ball.lie, R.rng), before = dist(ball.pos, h.pin);
  const res = plan.cat === 'putt' ? puttRes(h, ball.pos, plan.ang + ex.ang, plan.d * ex.power) : resolveShot(h, { ...ball.pos }, ball.lie, plan.target, ex, plan.cat, R.wind);
  res.cat = plan.cat; res.before = before; res.who = pl;
  return applyShot(R, ball, res);
}
// Play one player around the current hole with nobody watching (the Stableford field, fast-forward, tests).
function soloHole(R, pl) {
  const b = { owner: -1, hitters: [0], pos: { ...R.h.tee }, lie: 'tee', strokes: 0, shots: 0, holed: false };
  let guard = 0; while (!b.holed && guard++ < 30) npcShot(R, b, pl);
  return b.strokes;
}

const stablefordPts = (par, s) => Math.max(0, 2 + par - s);
function ninesSplit(s) {
  const o = [0, 1, 2].sort((a, b) => s[a] - s[b]), [a, b, c] = o.map(i => s[i]), p = [0, 0, 0];
  const give = a === b && b === c ? [3, 3, 3] : a === b ? [4, 4, 1] : b === c ? [5, 2, 2] : [5, 3, 1];
  o.forEach((i, k) => p[i] = give[k]); return p;
}
function matchText(up, left) { return up === 0 ? 'All square' : Math.abs(up) > left && left > 0 ? `${Math.abs(up)} & ${left}` : `${Math.abs(up)} ${up > 0 ? 'up' : 'down'}`; }

function finishHole(R) {
  const h = R.h, par = h.par, P = R.players, me = P[0];
  const s = P.map((p, i) => (R.fmt === 'foursomes' ? R.balls[i < 2 ? 0 : 1] : R.balls[i]).strokes);
  s.forEach((v, i) => R.strokes[i].push(v));
  const out = { hole: R.hi + 1, par, strokes: s, delta: P.map(() => 0), headline: '', sub: '' };
  const names = idx => idx.map(i => i === 0 ? 'you' : P[i].short).join(' & ');
  if (R.fmt === 'strokeplay') {
    s.forEach((v, i) => { out.delta[i] = v; R.pts[i] += v; });
    out.headline = `${SCORE_NAME(s[0] - par)}. You’re ${toParWords(R.pts[0] - parSoFar(R) - par)} for the round.`;
  } else if (R.fmt === 'stableford') {
    s.forEach((v, i) => { out.delta[i] = stablefordPts(par, v); R.pts[i] += out.delta[i]; });
    R.field.forEach((p, i) => { const v = soloHole(R, p); R.fieldPts[i] += stablefordPts(par, v); moodAfterHole(p, v - par); });
    out.headline = `${SCORE_NAME(s[0] - par)}. ${out.delta[0]} point${out.delta[0] === 1 ? '' : 's'}.`;
  } else if (R.fmt === 'nines') {
    out.delta = ninesSplit(s); out.delta.forEach((v, i) => R.pts[i] += v);
    out.headline = `You take ${out.delta[0]} of the 9.`;
  } else if (R.fmt === 'wolf') {
    const w = R.wolf, A = w.partner >= 0 && w.partner !== null ? [w.idx, w.partner] : [w.idx], B = [0, 1, 2, 3].filter(i => !A.includes(i));
    const a = Math.min(...A.map(i => s[i])), b = Math.min(...B.map(i => s[i])), lone = A.length === 1;
    if (a < b) A.forEach(i => out.delta[i] = lone ? 4 : 2); else if (b < a) B.forEach(i => out.delta[i] = lone ? 1 : 3);
    out.delta.forEach((v, i) => R.pts[i] += v);
    const wn = w.idx === 0 ? 'You' : P[w.idx].short;
    out.headline = a === b ? 'Hole halved. Nobody scores.' : a < b ? (lone ? `${wn} went alone and won. 4 points.` : `The Wolf pack (${names(A)}) wins it.`) : (lone ? `Lone Wolf ${wn} got eaten. 1 each to the rest.` : `${names(B)} beat the Wolf. 3 each.`);
    out.headline = out.headline.replace(/^you/, 'You');
  } else {
    const a = R.teams ? Math.min(s[0], s[1]) : s[0], b = R.teams ? Math.min(s[2], s[3]) : s[1];
    if (a < b) R.up++; else if (b < a) R.up--;
    const left = R.total - R.hi - 1;
    out.headline = a < b ? 'You win the hole.' : b < a ? 'You lose the hole.' : 'Halved.';
    out.sub = matchText(R.up, left) + (left > 0 && Math.abs(R.up) <= left ? ` with ${left} to play` : '');
    if (Math.abs(R.up) > left) R.over = true;
  }
  P.forEach((p, i) => { if (i > 0) moodAfterHole(p, s[i] - par); });
  R.results.push(out);
  if (R.hi + 1 >= R.total) R.over = true;
  return out;
}
function statusText(R) {
  if (MATCH_FORMATS.includes(R.fmt)) return matchText(R.up, R.total - R.hi);
  if (R.fmt === 'stableford') return `${R.pts[0]} pts`;
  if (R.fmt === 'strokeplay') { const par = parSoFar(R); return R.players.map((p, i) => `${i === 0 ? 'You' : p.short} ${toParText(R.pts[i] - par)}`).join('  '); }
  return R.players.map((p, i) => `${i === 0 ? 'You' : p.short} ${R.pts[i]}`).join('  ');
}
// Final table: [{name, score, human, npc}] best first (fewest strokes first in strokeplay), plus a verdict for the human.
function standings(R) {
  let rows;
  if (MATCH_FORMATS.includes(R.fmt)) {
    const left = R.total - R.results.length, txt = matchText(R.up, left);
    return { match: true, won: R.up > 0, tied: R.up === 0, text: R.up === 0 ? 'All square' : `${R.up > 0 ? 'You win' : 'You lose'} ${txt.replace(/ (up|down)$/, R.up > 0 ? ' up' : ' down')}`, rows: [] };
  }
  rows = R.players.map((p, i) => ({ name: p.name, score: R.pts[i], human: i === 0, id: p.id }));
  R.field.forEach((p, i) => rows.push({ name: p.name, score: R.fieldPts[i], human: false, id: p.id }));
  const low = !!FORMATS[R.fmt].low;
  rows.sort((a, b) => low ? a.score - b.score : b.score - a.score);
  const mine = rows.find(r => r.human).score, rank = rows.filter(r => low ? r.score < mine : r.score > mine).length + 1;
  return { match: false, low, par: parSoFar(R), rows, rank, won: rank === 1, tied: rank === 1 && rows.filter(r => r.score === mine).length > 1 };
}
