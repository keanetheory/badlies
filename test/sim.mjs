// Headless smoke test: plays full rounds in every format with the human on autopilot.
import fs from 'node:fs'; import vm from 'node:vm';
const files = ['01-util', '02-course', '04-engine', '05-agents', '06-round'];
const src = files.map(f => fs.readFileSync(new URL(`../src/js/${f}.js`, import.meta.url), 'utf8')).join('\n') +
  '\n;globalThis.G={BUILTIN,getCourse,NPCS,GOLFERS,FORMATS,newRound,startHole,nextBall,hitterOf,needsWolfCall,setWolf,npcWolfChoice,npcShot,finishHole,standings,surfaceAt,MATCH_FORMATS,statusText};';
vm.runInThisContext(src);
const G = globalThis.G; let fail = 0;
const assert = (c, m) => { if (!c) { fail++; console.error('FAIL', m); } };
const mkNpc = n => ({ ...n, skills: { ...n.skills } });
for (const course of G.BUILTIN) {
  const C = G.getCourse(course.id);
  const lies = {}; let par = 0;
  for (const h of C.holes) {
    par += h.par;
    assert(G.surfaceAt(h, h.tee) === 'tee', `${h.name}: tee is on the tee box`);
    assert(G.surfaceAt(h, h.pin) === 'green', `${h.name}: pin is on the green`);
    assert(h.w > 100 && h.h > 100, 'sane bounds');
  }
  console.log(`\n${C.name}  par ${par}  ${C.holes.map(h => h.yards).join('/')} yd  trees ${C.holes.map(h => h.trees.length).join('/')}`);
  const per = {};
  for (const fmt of Object.keys(G.FORMATS)) {
    let wins = 0, N = 12;
    for (let k = 0; k < N; k++) {
      const me = { id: 'me', name: 'You', short: 'You', human: true, skills: { drive: 4, approach: 4, chip: 4, sand: 4, putt: 4 }, aggr: .5, tilt: .3, savvy: .6 };
      const others = G.NPCS.map(mkNpc).sort(() => Math.random() - .5), n = fmt === 'strokeplay' ? 2 + k % 3 : G.FORMATS[fmt].n;
      const R = G.newRound({ format: fmt, holes: C.holes, total: 9, theme: C.theme, players: [me, ...others.slice(0, n - 1)], field: fmt === 'stableford' ? others.slice(n - 1) : [], seed: 1000 * k + fmt.length });
      while (!R.over) {
        G.startHole(R); let guard = 0;
        for (;;) {
          if (G.needsWolfCall(R)) G.setWolf(R, G.npcWolfChoice(R.players[R.wolf.idx], R.wolf.idx, R.players, R.balls, R.h));
          const b = G.nextBall(R); if (!b) break;
          const res = G.npcShot(R, b, R.players[G.hitterOf(R, b)]);
          lies[res.lie] = (lies[res.lie] || 0) + 1;
          assert(++guard < 200, 'hole terminates');
          assert(Number.isFinite(b.pos.x) && Number.isFinite(b.pos.y), 'finite ball position');
        }
        const out = G.finishHole(R);
        R.players.forEach((p, i) => { (per[p.id] = per[p.id] || []).push(out.strokes[i] - out.par); });
        if (fmt === 'nines') assert(out.delta.reduce((a, b) => a + b, 0) === 9, 'nines sums to 9');
        if (fmt === 'strokeplay') { assert(out.strokes.length === n, 'strokeplay field size'); assert(typeof G.statusText(R) === 'string', 'strokeplay status'); }
        R.hi++;
      }
      const st = G.standings(R); if (st.won && !st.tied) wins++;
      if (fmt === 'strokeplay') assert(st.low && st.rows.every((r, j) => !j || st.rows[j - 1].score <= r.score), 'strokeplay sorts fewest strokes first');
    }
    console.log(`  ${fmt.padEnd(11)} autopilot human wins ${wins}/${N}`);
  }
  console.log('  avg vs par per hole:', Object.entries(per).map(([k, v]) => `${k} ${(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2)}`).join('  '));
  console.log('  where shots finish:', JSON.stringify(lies));
}
console.log(fail ? `\n${fail} FAILURES` : '\nall checks passed'); process.exit(fail ? 1 : 0);
