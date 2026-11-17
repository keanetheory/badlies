// Route geometry regressions: real bends, playable endpoints and retained card lengths.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BL, P } from '../tools/course-lib.mjs';

const counts = { magpie: 9, 'rabbit-warren': 9, 'high-trees': 18, 'darkerthanusual-heath': 18 };
for (const [id, count] of Object.entries(counts)) {
  const card = JSON.parse(fs.readFileSync(P(`courses/scorecards/${id}.json`)));
  const course = JSON.parse(fs.readFileSync(P(`courses/${id}.json`)));
  assert.equal(course.specs.length, count);
  for (const [i, spec] of course.specs.entries()) {
    assert.deepEqual(spec.route, card.holes[i].route);
    const h = BL.makeHole(spec);
    assert.equal(h.yards, card.holes[i].yards);
    assert.equal(h.par, card.holes[i].par);
    assert.equal(BL.surfaceAt(h, h.tee), 'tee');
    assert.equal(BL.surfaceAt(h, h.pin), 'green');
    assert.ok(Math.abs(h.L.at(-1) - spec.len) < .001);
    for (const p of h.path) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= h.w && p.y >= 0 && p.y <= h.h);
    // The generated fairway must follow the route through its landing area.
    if (h.par > 3) for (let j = 0; j < h.path.length; j++) {
      if (h.L[j] > 100 && h.L[j] < h.yards - 30) {
        assert.ok(['fairway', 'water', 'sand', 'green'].includes(BL.surfaceAt(h, h.path[j])), `${id} ${i + 1}: disconnected fairway`);
      }
    }
  }
}
const base = { par: 4, len: 360, seed: 17, route: [[0, 0], [0, -200], [160, -200]] };
const right = BL.makeHole(base);
const left = BL.makeHole({ ...base, route: base.route.map(([x, y]) => [-x, y]) });
assert.ok(right.path.at(-1).x - right.tee.x > 100);
assert.ok(left.path.at(-1).x - left.tee.x < -100);
assert.throws(() => BL.makeHole({ ...base, route: [[0, 0], [0, 0]] }), /Repeated/);
console.log('PASS: 54 mapped routes, yardages, landing corridors and dogleg handedness.');
