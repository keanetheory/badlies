// ---------- 03-render: the faux-realistic shaded course painter ----------
// Everything is drawn in yards with the sun in the north-west, so lips, banks and canopies
// all throw shadows to the south-east. Noise is sampled in world space, which keeps the
// zoomed-in green patch consistent with the full-hole render.
const PALETTES = {
  lush: { rough: '#2e6a35', firstCut: '#3b7d3d', fairway: '#4c9a48', fringe: '#57a850', green: '#6cc062', tee: '#5cab54', sand: '#ead9a8', sandShade: 'rgba(120,92,40,.5)', water: ['#3b8fc4', '#1c5d94'], bank: 'rgba(24,50,30,.55)', tree: ['#18401f', '#24572a', '#34722f', '#4e8f3c'], shade: .55 },
  links: { rough: '#8b8a4e', firstCut: '#7d9150', fairway: '#6c9c4c', fringe: '#74aa52', green: '#82bf5e', tee: '#78ad55', sand: '#e6d29c', sandShade: 'rgba(110,84,36,.55)', water: ['#4a86a3', '#2a5a77'], bank: 'rgba(60,60,30,.5)', tree: ['#3d4a22', '#55662c', '#6f7f34', '#8c9a45'], shade: .7 },
  desert: { rough: '#c59a63', firstCut: '#7d9a4c', fairway: '#4f9a4a', fringe: '#59a852', green: '#6cc062', tee: '#5cab54', sand: '#f1e2bb', sandShade: 'rgba(140,96,50,.5)', water: ['#3aa0c0', '#1d6c92'], bank: 'rgba(110,80,45,.6)', tree: ['#3a4a22', '#566b2c', '#6f8436', '#93a652'], shade: .6 },
};
function tracePoly(c, poly) { c.beginPath(); c.moveTo(poly[0].x, poly[0].y); for (let i = 1; i < poly.length; i++) c.lineTo(poly[i].x, poly[i].y); c.closePath(); }
function stripes(c, cx, cy, R, band, ang, light, dark) {
  c.save(); c.translate(cx, cy); c.rotate(ang);
  const n = Math.ceil(R / band);
  for (let i = -n; i <= n; i++) { c.fillStyle = i & 1 ? light : dark; c.fillRect(-R, i * band, 2 * R, band + .05); }
  c.restore();
}

function renderRegion(h, theme, x0, y0, w, hh, S) {
  const T = PALETTES[theme] || PALETTES.lush;
  const cv = document.createElement('canvas'); cv.width = Math.ceil(w * S); cv.height = Math.ceil(hh * S);
  const c = cv.getContext('2d');
  c.setTransform(S, 0, 0, S, -x0 * S, -y0 * S); c.lineJoin = 'round';
  const cx = x0 + w / 2, cy = y0 + hh / 2, R = Math.hypot(w, hh);
  const noise = makeNoise((h.seed || 5) + 11);

  c.fillStyle = T.rough; c.fillRect(x0, y0, w, hh);

  // fairways: first cut halo, then striped mow
  for (const f of h.fairways) { tracePoly(c, f); c.strokeStyle = T.firstCut; c.lineWidth = 6; c.stroke(); }
  for (const f of h.fairways) {
    tracePoly(c, f); c.fillStyle = T.fairway; c.fill();
    c.save(); c.clip(); stripes(c, cx, cy, R, 9, .5, 'rgba(255,255,255,.075)', 'rgba(0,0,0,.05)'); c.restore();
  }
  // tee box
  tracePoly(c, h.teeBox); c.strokeStyle = T.firstCut; c.lineWidth = 2.5; c.stroke(); c.fillStyle = T.tee; c.fill();
  c.save(); c.clip(); stripes(c, cx, cy, R, 2, .2, 'rgba(255,255,255,.1)', 'rgba(0,0,0,.05)'); c.restore();

  // water: bank, depth gradient, inner bank shadow, glints
  const wr = mulberry32((h.seed || 5) + 5);
  for (const wtr of h.waters) {
    const bb = wtr.bb || polyBB(wtr);
    tracePoly(c, wtr); c.strokeStyle = T.bank; c.lineWidth = 3; c.stroke();
    const g = c.createLinearGradient(bb[0], bb[1], bb[2], bb[3]); g.addColorStop(0, T.water[1]); g.addColorStop(1, T.water[0]);
    c.fillStyle = g; c.fill();
    c.save(); c.clip();
    c.translate(1.6, 1.6); tracePoly(c, wtr); c.strokeStyle = 'rgba(5,25,50,.45)'; c.lineWidth = 4; c.stroke(); c.translate(-1.6, -1.6);
    c.strokeStyle = 'rgba(255,255,255,.2)'; c.lineWidth = .45; c.lineCap = 'round';
    const n = Math.min(60, (bb[2] - bb[0]) * (bb[3] - bb[1]) / 90);
    for (let i = 0; i < n; i++) { const x = lerp(bb[0], bb[2], wr()), y = lerp(bb[1], bb[3], wr()), l = lerp(2, 6, wr()); c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + l / 2, y - .7, x + l, y); c.stroke(); }
    c.restore();
  }

  // bunkers: grass lip, sand, shadow under the NW lip, sunlit SE face, rake lines
  for (const b of h.bunkers) {
    tracePoly(c, b); c.strokeStyle = 'rgba(20,48,24,.6)'; c.lineWidth = 2.4; c.stroke(); c.fillStyle = T.sand; c.fill();
    c.save(); c.clip();
    c.translate(1.3, 1.3); tracePoly(c, b); c.strokeStyle = T.sandShade; c.lineWidth = 2.6; c.stroke();
    c.translate(-2.4, -2.4); tracePoly(c, b); c.strokeStyle = 'rgba(255,252,235,.55)'; c.lineWidth = 1.6; c.stroke(); c.translate(1.1, 1.1);
    stripes(c, cx, cy, R, .7, -.4, 'rgba(255,255,255,.07)', 'rgba(90,70,30,.05)');
    c.restore();
  }

  // green: fringe collar, fine checker mow, slope shading
  for (const g of h.greens) {
    const bb = g.bb || polyBB(g);
    tracePoly(c, g); c.strokeStyle = T.fringe; c.lineWidth = 4.5; c.stroke(); c.fillStyle = T.green; c.fill();
    c.save(); c.clip();
    stripes(c, cx, cy, R, 2.6, .5, 'rgba(255,255,255,.07)', 'rgba(0,0,0,.035)');
    stripes(c, cx, cy, R, 2.6, .5 + Math.PI / 2, 'rgba(255,255,255,.05)', 'rgba(0,0,0,.03)');
    const gc = { x: (bb[0] + bb[2]) / 2, y: (bb[1] + bb[3]) / 2 }, r = Math.max(bb[2] - bb[0], bb[3] - bb[1]) / 2, sl = h.slope || { x: 0, y: 0 }, sm = Math.hypot(sl.x, sl.y) || 1;
    const lg = c.createLinearGradient(gc.x - sl.x / sm * r, gc.y - sl.y / sm * r, gc.x + sl.x / sm * r, gc.y + sl.y / sm * r);
    lg.addColorStop(0, 'rgba(255,255,220,.16)'); lg.addColorStop(1, 'rgba(0,30,10,.2)');
    c.fillStyle = lg; c.fillRect(bb[0], bb[1], bb[2] - bb[0], bb[3] - bb[1]);
    c.restore();
  }

  // relief: hillshade from a noise height field plus fine grain, blended over the turf
  const q = S > 6 ? 3 : 2, sw = Math.ceil(cv.width / q), sh = Math.ceil(cv.height / q);
  const sc = document.createElement('canvas'); sc.width = sw; sc.height = sh;
  const sx = sc.getContext('2d'), img = sx.createImageData(sw, sh), d = img.data, gr = mulberry32(99);
  for (let py = 0, i = 0; py < sh; py++) for (let px = 0; px < sw; px++, i += 4) {
    const wx = x0 + px * q / S, wy = y0 + py * q / S;
    const slope = noise((wx + 1.5) / 55, (wy + 1.5) / 55) - noise((wx - 1.5) / 55, (wy - 1.5) / 55);
    const mott = noise(wx / 9 + 40, wy / 9 + 40, 2) - .5;
    const v = clamp(128 - slope * 1100 + mott * 46 + (gr() - .5) * 16, 40, 215);
    d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
  }
  sx.putImageData(img, 0, 0);
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'overlay'; c.globalAlpha = T.shade; c.imageSmoothingEnabled = true;
  c.drawImage(sc, 0, 0, cv.width, cv.height); c.restore();

  // trees: all shadows first, then canopies back to front
  c.fillStyle = 'rgba(8,24,12,.3)';
  for (const t of h.trees) { c.beginPath(); c.ellipse(t.x + t.r * .55, t.y + t.r * .6, t.r * 1.05, t.r * .9, .6, 0, TAU); c.fill(); }
  const tr = mulberry32((h.seed || 5) + 23);
  for (const t of h.trees) {
    const lobes = theme === 'desert' ? 3 : 6;
    for (let k = 0; k < lobes; k++) { const a = tr() * TAU, o = t.r * .42 * tr(); c.fillStyle = T.tree[k < lobes / 2 ? 0 : 1]; c.beginPath(); c.arc(t.x + Math.cos(a) * o, t.y + Math.sin(a) * o, t.r * lerp(.5, .72, tr()), 0, TAU); c.fill(); }
    for (let k = 0; k < 4; k++) { const a = tr() * TAU, o = t.r * .35 * tr(); c.fillStyle = T.tree[k < 2 ? 2 : 3]; c.beginPath(); c.arc(t.x - t.r * .22 + Math.cos(a) * o, t.y - t.r * .24 + Math.sin(a) * o, t.r * lerp(.2, .38, tr()), 0, TAU); c.fill(); }
  }
  // soft vignette so the edge of the property reads as out of bounds
  c.setTransform(1, 0, 0, 1, 0, 0);
  if (x0 === 0 && y0 === 0) {
    const e = 14 * S; c.fillStyle = 'rgba(0,0,0,.16)';
    c.fillRect(0, 0, cv.width, e * .25); c.fillRect(0, cv.height - e * .25, cv.width, e * .25); c.fillRect(0, 0, e * .25, cv.height); c.fillRect(cv.width - e * .25, 0, e * .25, cv.height);
  }
  return cv;
}
function renderHole(h, theme) {
  const S = clamp(Math.floor(2600 / Math.max(h.w, h.h) * 10) / 10, 2, 4);
  return { cv: renderRegion(h, theme, 0, 0, h.w, h.h, S), S };
}
function renderGreen(h, theme) {
  const bb = h.greens[0].bb, m = 9, x0 = Math.max(0, bb[0] - m), y0 = Math.max(0, bb[1] - m), w = Math.min(h.w, bb[2] + m) - x0, hh = Math.min(h.h, bb[3] + m) - y0;
  return { cv: renderRegion(h, theme, x0, y0, w, hh, 14), S: 14, x0, y0, w, h: hh };
}
