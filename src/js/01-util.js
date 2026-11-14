// ---------- 01-util: rng, geometry, noise ----------
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const smooth = t => t * t * (3 - 2 * t);

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function gauss(rng) { let u = 0; while (u === 0) u = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * rng()); }
const pick = (arr, rng = Math.random) => arr[Math.floor(rng() * arr.length)];
function shuffle(arr, rng = Math.random) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function pointInPoly(p, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}
function polyBB(poly) { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (const p of poly) { if (p.x < a) a = p.x; if (p.y < b) b = p.y; if (p.x > c) c = p.x; if (p.y > d) d = p.y; } return [a, b, c, d]; }
function centroid(poly) { let x = 0, y = 0; for (const p of poly) { x += p.x; y += p.y; } return { x: x / poly.length, y: y / poly.length }; }
function polyRadius(poly, c) { let r = 0; for (const p of poly) r += dist(p, c); return r / poly.length; }

// Wobbly ellipse — the basic building block of greens, bunkers and ponds.
function blob(cx, cy, rx, ry, rng, n = 20, wob = 0.2, rot = 0) {
  const k1 = 2 + Math.floor(rng() * 2), k2 = 3 + Math.floor(rng() * 3), p1 = rng() * TAU, p2 = rng() * TAU;
  const pts = [], cr = Math.cos(rot), sr = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU;
    const w = 1 + wob * (0.6 * Math.sin(k1 * a + p1) + 0.4 * Math.sin(k2 * a + p2));
    const x = Math.cos(a) * rx * w, y = Math.sin(a) * ry * w;
    pts.push({ x: cx + x * cr - y * sr, y: cy + x * sr + y * cr });
  }
  return pts;
}
function chaikin(pts, iter = 2) {
  let p = pts;
  for (let k = 0; k < iter; k++) {
    const q = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      q.push({ x: a.x * .75 + b.x * .25, y: a.y * .75 + b.y * .25 }, { x: a.x * .25 + b.x * .75, y: a.y * .25 + b.y * .75 });
    }
    p = q;
  }
  return p;
}
function catmullRom(pts, step = 5) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const n = Math.max(2, Math.ceil(dist(p1, p2) / step));
    for (let j = 0; j < n; j++) {
      const t = j / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => .5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  out.push({ x: pts[pts.length - 1].x, y: pts[pts.length - 1].y });
  return out;
}
function cumLen(path) { const L = [0]; for (let i = 1; i < path.length; i++) L.push(L[i - 1] + dist(path[i - 1], path[i])); return L; }
function pointAtDist(path, L, d) {
  d = clamp(d, 0, L[L.length - 1]);
  let i = 1; while (i < L.length - 1 && L[i] < d) i++;
  const t = (d - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]);
  return { x: lerp(path[i - 1].x, path[i].x, t), y: lerp(path[i - 1].y, path[i].y, t), i };
}
function nearestIdx(path, p) { let bi = 0, bd = 1e9; for (let i = 0; i < path.length; i++) { const d = dist(path[i], p); if (d < bd) { bd = d; bi = i; } } return { i: bi, d: bd }; }
function rotatePt(p, o, a) { const c = Math.cos(a), s = Math.sin(a), x = p.x - o.x, y = p.y - o.y; return { x: o.x + x * c - y * s, y: o.y + x * s + y * c }; }

// Value noise with octaves; world-space so every render of a hole agrees.
function makeNoise(seed) {
  const r = mulberry32(seed), P = new Uint8Array(514), g = new Float32Array(256);
  const perm = shuffle([...Array(256).keys()], r);
  for (let i = 0; i < 514; i++) P[i] = perm[i & 255];
  for (let i = 0; i < 256; i++) g[i] = r();
  function n(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, X = xi & 255, Y = yi & 255;
    const a = g[P[P[X] + Y]], b = g[P[P[X + 1] + Y]], c = g[P[P[X] + Y + 1]], d = g[P[P[X + 1] + Y + 1]];
    const u = smooth(xf), v = smooth(yf);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  }
  return (x, y, oct = 3) => { let s = 0, amp = 1, f = 1, tot = 0; for (let o = 0; o < oct; o++) { s += n(x * f, y * f) * amp; tot += amp; amp *= .5; f *= 2; } return s / tot; };
}
