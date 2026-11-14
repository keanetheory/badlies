// ---------- 08-game: the play screen ----------
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ABORT = Symbol('abort');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const G = { R: null, run: 0, cam: { x: 0, y: 0, s: 1 }, camT: { x: 0, y: 0, s: 1 }, turn: null, anim: null, fx: [], img: null, green: null, skip: false, overview: false, cw: 0, ch: 0, cyU: 0, dpr: 1, xp: {}, onEnd: null, hooks: {} };
const TOP_PAD = 104, BOTTOM_PAD = 190;

function resizeCanvas() {
  const cv = $('cv'); G.cw = cv.clientWidth || 360; G.ch = cv.clientHeight || 640; G.dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(G.cw * G.dpr); cv.height = Math.round(G.ch * G.dpr);
  G.cyU = TOP_PAD + Math.max(120, G.ch - TOP_PAD - BOTTOM_PAD) / 2;
}
function frame(pts, pad = 22, minSpan = 60, snap = false) {
  let a = 1e9, b = 1e9, c = -1e9, d = -1e9;
  for (const p of pts) { if (!p) continue; a = Math.min(a, p.x); b = Math.min(b, p.y); c = Math.max(c, p.x); d = Math.max(d, p.y); }
  const bw = Math.max(c - a + pad * 2, minSpan), bh = Math.max(d - b + pad * 2, minSpan), uh = Math.max(120, G.ch - TOP_PAD - BOTTOM_PAD);
  G.camT = { x: (a + c) / 2, y: (b + d) / 2, s: clamp(Math.min(G.cw / bw, uh / bh), .4, 60) };
  if (snap) G.cam = { ...G.camT };
}

// ---------- drawing ----------
function ballColor(b) { const R = G.R, p = R.players[b.owner]; return p.human ? '#ffffff' : p.color; }
function drawBall(c, x, y, r, col, ring) {
  c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(x + r * .5, y + r * .55, r, r * .7, 0, 0, TAU); c.fill();
  c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  c.lineWidth = 1.5; c.strokeStyle = 'rgba(0,0,0,.65)'; c.stroke();
  if (ring) { c.strokeStyle = '#FF4F8B'; c.lineWidth = 2; c.beginPath(); c.arc(x, y, r + 4, 0, TAU); c.stroke(); }
}
function tag(c, x, y, text) {
  c.font = '600 12px "Bricolage Grotesque", system-ui, sans-serif'; const w = c.measureText(text).width + 12;
  c.fillStyle = 'rgba(6,20,12,.8)'; c.beginPath(); c.roundRect(x - w / 2, y - 30, w, 18, 6); c.fill();
  c.fillStyle = '#EAF6E2'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, x, y - 20.5);
}
function animState(a, now) {
  const e = Math.max(0, now - a.t0), r = a.res;
  if (r.putt) { const i = Math.min(r.pts.length - 1, Math.floor(e / 1000 * a.rate / .02)); return { p: r.pts[i], z: 0, done: i >= r.pts.length - 1 }; }
  if (e < a.flight) { const t = e / a.flight; return { p: { x: lerp(r.from.x, a.land.x, t), y: lerp(r.from.y, a.land.y, t) }, z: Math.sin(Math.PI * t) }; }
  const t = Math.min(1, (e - a.flight) / a.roll), k = 1 - (1 - t) * (1 - t);
  if (r.event === 'water' || r.event === 'ob') return { p: a.land, z: 0, hide: true, done: t >= 1, landed: true };
  return { p: { x: lerp(a.land.x, r.end.x, k), y: lerp(a.land.y, r.end.y, k) }, z: 0, done: t >= 1, landed: true };
}
function draw(now) {
  const c = G.ctx, R = G.R, h = R && R.h; if (!h || !G.img) return;
  const { cw, ch, dpr } = G, s = G.cam.s, ox = cw / 2 - G.cam.x * s, oy = G.cyU - G.cam.y * s, P = p => ({ x: ox + p.x * s, y: oy + p.y * s });
  c.setTransform(dpr, 0, 0, dpr, 0, 0); c.fillStyle = G.outer || '#0b2114'; c.fillRect(0, 0, cw, ch);
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  c.drawImage(G.img.cv, ox, oy, h.w * s, h.h * s);
  if (s > 5.5 && G.green) { const g = G.green; c.drawImage(g.cv, ox + g.x0 * s, oy + g.y0 * s, g.w * s, g.h * s); }
  c.strokeStyle = 'rgba(255,255,255,.6)'; c.setLineDash([2, 8]); c.lineWidth = 2; c.strokeRect(ox, oy, h.w * s, h.h * s); c.setLineDash([]);

  // the pin
  const pp = P(h.pin), pole = clamp(s * 3.2, 24, 60), wave = Math.sin(now / 260) * 2;
  c.fillStyle = '#0a160e'; c.beginPath(); c.ellipse(pp.x, pp.y, Math.max(2.4, CUP_R * 1.3 * s), Math.max(1.8, CUP_R * 1.05 * s), 0, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(pp.x, pp.y); c.lineTo(pp.x + pole * .5, pp.y + pole * .32); c.stroke();
  c.strokeStyle = '#f4f4ec'; c.lineWidth = 2; c.beginPath(); c.moveTo(pp.x, pp.y); c.lineTo(pp.x, pp.y - pole); c.stroke();
  c.fillStyle = '#FF4F8B'; c.beginPath(); c.moveTo(pp.x, pp.y - pole); c.quadraticCurveTo(pp.x + pole * .3, pp.y - pole * .95 + wave, pp.x + pole * .55, pp.y - pole * .78); c.lineTo(pp.x, pp.y - pole * .58); c.closePath(); c.fill();

  // aiming aids
  const T = G.turn;
  if (T && T.mode !== 'fly') {
    const bp = P(T.ball.pos), tp = P(T.target);
    if (T.cat !== 'putt') {
      c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = 1.5; c.setLineDash([4, 7]); c.beginPath(); c.arc(bp.x, bp.y, T.max * s, 0, TAU); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 2; c.setLineDash([7, 6]); c.beginPath(); c.moveTo(bp.x, bp.y); c.lineTo(tp.x, tp.y); c.stroke(); c.setLineDash([]);
    } else if (T.preview) {
      c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.5; c.setLineDash([3, 6]); c.beginPath(); c.moveTo(bp.x, bp.y); c.lineTo(tp.x, tp.y); c.stroke();
      c.strokeStyle = '#FFD23F'; c.lineWidth = 3; c.setLineDash([2, 7]); c.lineCap = 'round'; c.beginPath();
      T.preview.forEach((p, i) => { const q = P(p); i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y); }); c.stroke(); c.setLineDash([]); c.lineCap = 'butt';
    }
    c.fillStyle = 'rgba(255,79,139,.3)'; c.strokeStyle = '#fff'; c.lineWidth = 2.5; c.beginPath(); c.arc(tp.x, tp.y, 12, 0, TAU); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(tp.x - 5, tp.y); c.lineTo(tp.x + 5, tp.y); c.moveTo(tp.x, tp.y - 5); c.lineTo(tp.x, tp.y + 5); c.stroke();
  }
  // balls at rest
  const br = clamp(s * .5, 4, 7.5), active = T ? T.ball : G.anim ? G.anim.ball : G.npcBall;
  for (const b of [...R.balls].sort((x, y) => (x === active) - (y === active))) {
    if (G.anim && G.anim.ball === b) continue;
    if (b.holed || (b.shots === 0 && b !== active)) continue; // nobody needs to see four balls queueing on the tee
    const q = P(b.pos); drawBall(c, q.x, q.y, br, ballColor(b), b === active);
    if (b === G.npcBall && G.npcName) tag(c, q.x, q.y, G.npcName);
  }
  // ball in motion
  if (G.anim) {
    const a = G.anim, st = animState(a, now);
    if (st.landed && !a.landed) { a.landed = true; if (a.res.event === 'water') G.fx.push({ p: a.land, t0: now }); }
    if (!st.hide) { const q = P(st.p), lift = st.z * Math.min(110, 14 + a.res.carry * .22 * Math.max(1, s)); if (lift > 1) { c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(q.x, q.y, br, br * .6, 0, 0, TAU); c.fill(); } drawBall(c, q.x, q.y - lift, br * (1 + st.z * .5), ballColor(a.ball), false); if (a.name) tag(c, q.x, q.y - lift, a.name); }
    if (st.done) { G.anim = null; a.done(); }
  }
  G.fx = G.fx.filter(f => now - f.t0 < 700);
  for (const f of G.fx) { const q = P(f.p), t = (now - f.t0) / 700; c.strokeStyle = `rgba(255,255,255,${1 - t})`; c.lineWidth = 2.5; c.beginPath(); c.ellipse(q.x, q.y, 6 + t * 26, 3 + t * 13, 0, 0, TAU); c.stroke(); }
}
function tick(now) {
  if (G.running) requestAnimationFrame(tick);
  const dt = Math.min(.05, (now - (G.last || now)) / 1000); G.last = now;
  const k = 1 - Math.pow(.002, dt); G.cam.x = lerp(G.cam.x, G.camT.x, k); G.cam.y = lerp(G.cam.y, G.camT.y, k); G.cam.s = lerp(G.cam.s, G.camT.s, k);
  const T = G.turn;
  if (T && (T.mode === 'power' || T.mode === 'acc')) {
    if (T.mode === 'power') { T.pos += T.dir * T.speed * dt; if (T.pos >= 1.15) { T.pos = 1.15; T.dir = -1; } if (T.pos <= 0 && T.dir < 0) { T.mode = 'aim'; T.pos = 0; refreshControls(); } }
    else { T.pos -= T.speed * dt; if (T.pos <= -.1) { T.pos = -.1; lockStrike(); } }
    paintMeter();
  }
  draw(now);
}
function startLoop() { if (!G.running) { G.running = true; G.last = 0; requestAnimationFrame(tick); } }
function stopLoop() { G.running = false; }

// ---------- HUD ----------
let toastTimer = 0, chirpTimer = 0;
function toast(html, ms = 2600) { const t = $('toast'); t.innerHTML = html; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms); }
const chirpQ = [];
function chirp(pl, line, ai) { chirpQ.push({ pl, line, ai }); if (chirpQ.length > 3) chirpQ.shift(); if (!chirpTimer) nextChirp(); }
function nextChirp() {
  const el = $('chirp'), q = chirpQ.shift();
  if (!q) { el.classList.remove('show'); chirpTimer = 0; return; }
  el.innerHTML = `<b><i class="dot" style="background:${q.pl.color}"></i>${esc(q.pl.short)}</b>${esc(q.line)}`;
  el.classList.add('show'); chirpTimer = setTimeout(nextChirp, 2400 + q.line.length * 28);
}
function paintMeter() {
  const T = G.turn, m = $('meter'); if (!T) return;
  const pct = v => (v + .1) / 1.25 * 100;
  m.querySelector('.m-needle').style.left = pct(T.pos) + '%';
  m.querySelector('.m-fill').style.width = pct(T.mode === 'acc' ? T.power : T.pos) + '%';
}
function refreshControls() {
  const T = G.turn, sw = $('swing'), m = $('meter');
  if (!T || T.mode === 'fly') { sw.classList.add('hidden'); m.classList.add('hidden'); return; }
  sw.classList.remove('hidden'); m.classList.remove('hidden'); $('skip').classList.add('hidden');
  m.classList.toggle('idle', T.mode === 'aim');
  const putt = T.cat === 'putt', L = G.R.players[0].skills[T.cat], za = (.03 + .004 * L) / 1.25 * 100;
  const acc = m.querySelector('.m-acc'), tgt = m.querySelector('.m-tgt');
  acc.style.display = putt ? 'none' : ''; m.querySelector('.m-l').style.display = putt ? 'none' : '';
  acc.style.left = (8 - za) + '%'; acc.style.width = za * 2 + '%'; tgt.style.left = (88 - 2.8) + '%'; tgt.style.width = '5.6%';
  sw.textContent = T.mode === 'aim' ? (putt ? 'Putt' : 'Swing') : T.mode === 'power' ? 'Set power' : 'Strike!';
  if (T.mode === 'aim') { T.pos = 0; m.querySelector('.m-needle').style.left = '8%'; m.querySelector('.m-fill').style.width = '0'; }
}
function slopeWord() { const m = Math.hypot(G.R.h.slope.x, G.R.h.slope.y); return m < .17 ? 'gentle' : m < .27 ? 'sneaky' : 'vicious'; }
function setWindBox(putting) {
  const R = G.R, box = $('h-windbox'); box.classList.toggle('slope', putting);
  if (putting) { $('h-arrow').style.transform = `rotate(${Math.atan2(R.h.slope.y, R.h.slope.x)}rad)`; $('h-wind').textContent = `${slopeWord()} slope`; }
  else { $('h-arrow').style.transform = `rotate(${R.wind.ang}rad)`; $('h-wind').textContent = `${R.wind.mph} mph`; }
}
function updateInfo() {
  const T = G.turn, h = G.R.h; if (!T) return;
  const dT = dist(T.ball.pos, T.target), dP = dist(T.ball.pos, h.pin), first = !G.hooks.seenHint;
  if (T.cat === 'putt') $('shotinfo').innerHTML = `<b>Putter</b> ${Math.round(dP * 3)} ft to the hole<br><span>${first ? 'Drag the target until the yellow line finds the hole, then tap for power.' : `Aiming ${Math.round(dT * 3)} ft. The slope is ${slopeWord()}.`}</span>`;
  else $('shotinfo').innerHTML = `<b>${clubName(T.cat, dT, T.max)}</b> ${Math.round(dT)} yd<br><span>${first ? 'Drag the target. Tap Swing, then tap for power, then again on the strike line.' : `${LIE_NAME[T.ball.lie] || 'Rough'}, ${Math.round(dP)} yd to the pin`}</span>`;
}
function updateHud() {
  const R = G.R, h = R.h;
  $('h-no').textContent = `${R.hi + 1}. ${h.name}`; $('h-meta').textContent = `Par ${h.par}, ${h.yards} yd`;
  let f = FORMATS[R.fmt].name;
  if (R.wolf) { const w = R.wolf, n = i => i === 0 ? 'you' : R.players[i].short; f = !w.decided ? `Wolf: ${n(w.idx)}` : w.partner >= 0 ? `Wolf ${n(w.idx)} + ${n(w.partner)}` : `Lone Wolf: ${n(w.idx)}`; }
  if (R.teams) f += ` with ${R.players[1].short}`;
  $('h-fmt').textContent = f; $('h-status').textContent = statusText(R);
}
function modal(html) {
  return new Promise(res => {
    const el = document.createElement('div'); el.className = 'modal'; el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
    el.addEventListener('click', e => { const b = e.target.closest('[data-val]'); if (b) { el.remove(); res(b.dataset.val); } });
    $('s-play').appendChild(el); const b = el.querySelector('[data-val]'); if (b) b.focus({ preventScroll: true });
  });
}

// ---------- the human's shot ----------
function defaultTarget(h, ball, cat, max) {
  const d = dist(ball.pos, h.pin);
  if (cat === 'putt' || d <= max) return { ...h.pin };
  const i0 = nearestIdx(h.path, ball.pos).i; let best = null;
  for (let i = i0 + 1; i < h.path.length; i++) { const p = h.path[i]; if (dist(ball.pos, p) <= max * .95 && dist(p, h.pin) < d && surfaceAt(h, p) === 'fairway') best = p; }
  return best ? { ...best } : { x: ball.pos.x + (h.pin.x - ball.pos.x) / d * max * .95, y: ball.pos.y + (h.pin.y - ball.pos.y) / d * max * .95 };
}
function aimCamera(snap) {
  const T = G.turn, h = G.R.h; if (!T) return;
  if (G.overview) frame([h.tee, h.pin, ...h.path], 30, 80, snap);
  else if (T.cat === 'putt') frame([T.ball.pos, h.pin], 3, 9, snap);
  else frame([T.ball.pos, T.target0, dist(T.ball.pos, h.pin) < T.max * 1.5 ? h.pin : null], 30, 70, snap);
}
function puttPreview(T) {
  const h = G.R.h, b = T.ball.pos, pr = simulatePutt(h, b, Math.atan2(T.target.y - b.y, T.target.x - b.x), dist(b, T.target) + .3);
  T.preview = pr.pts.slice(0, Math.max(2, Math.ceil(pr.pts.length * clamp(.35 + .065 * G.R.players[0].skills.putt, 0, 1))));
}
function setTarget(w) {
  const T = G.turn, b = T.ball.pos, d = dist(b, w) || .01, lim = T.cat === 'putt' ? 55 : T.max, mn = T.cat === 'putt' ? .4 : 4, k = clamp(d, mn, lim) / d;
  T.target = { x: b.x + (w.x - b.x) * k, y: b.y + (w.y - b.y) * k };
  if (T.cat === 'putt') puttPreview(T);
  updateInfo();
}
function humanShot(ball) {
  return new Promise(resolve => {
    const R = G.R, h = R.h, me = R.players[0], cat = shotCat(h, ball), max = maxDist(me, cat, ball.lie);
    const T = G.turn = { ball, cat, max, mode: 'aim', resolve, pos: 0, dir: 1, power: 1, acc: 0, sg: sigma(me, cat, ball.lie), speed: 1.25 / (1.05 + .05 * me.skills[cat]) };
    T.target = T.target0 = defaultTarget(h, ball, cat, max);
    if (cat === 'putt') puttPreview(T);
    G.skip = false; G.npcBall = null; setWindBox(cat === 'putt'); aimCamera(); updateInfo(); refreshControls();
  });
}
function onSwing() {
  const T = G.turn; if (!T) return;
  if (T.mode === 'aim') { T.mode = 'power'; T.pos = 0; T.dir = 1; refreshControls(); }
  else if (T.mode === 'power') { T.power = Math.max(.08, T.pos); if (T.cat === 'putt') fire(); else { T.mode = 'acc'; refreshControls(); } }
  else if (T.mode === 'acc') lockStrike();
}
function lockStrike() { const T = G.turn; if (!T || T.mode !== 'acc') return; T.acc = T.pos; fire(); }
async function fire() {
  const T = G.turn, R = G.R, h = R.h, ball = T.ball, sg = T.sg, rnd = Math.random, run = G.run; let res;
  T.mode = 'fly'; refreshControls(); G.hooks.seenHint = true;
  const before = dist(ball.pos, h.pin);
  if (T.cat === 'putt') {
    const b = ball.pos, base = Math.atan2(T.target.y - b.y, T.target.x - b.x);
    res = puttRes(h, b, base + gauss(rnd) * sg.a * .5, (dist(b, T.target) + .3) * T.power * (1 + gauss(rnd) * sg.d * .3));
  } else {
    const ang = clamp(T.acc / .055, -3, 3) * sg.a * .9 + gauss(rnd) * sg.a * .4 + (T.power > 1.04 ? gauss(rnd) * sg.a * (T.power - 1) * 8 : 0);
    res = resolveShot(h, { ...ball.pos }, ball.lie, T.target, { power: T.power * (1 + gauss(rnd) * sg.d * .45), ang }, T.cat, R.wind);
    res.duff = T.power < .45;
  }
  res.cat = T.cat; res.before = before;
  const q = shotQuality(h, T.cat, before, res);
  applyShot(R, ball, res);
  await animate(ball, res, false);
  if (G.run !== run) return;
  let msg = sassFor(res, ball, h);
  const gain = G.hooks.xp ? G.hooks.xp(T.cat, Math.round(8 + 28 * q)) : null;
  if (gain) msg += `<br><small>${SKILL_NAME[T.cat]} is now level ${gain}. Look at you.</small>`;
  toast(msg, gain ? 3600 : 2600);
  heckle(res);
  G.turn = null; updateHud(); T.resolve();
}
function sassFor(res, ball, h) {
  const s = k => pick(SASS[k]);
  if (res.pickedUp) return s('pickup');
  if (res.holed) return ball.strokes === 1 ? s('ace') : !res.putt ? s('chipin') : res.before > 8 ? s('bomb') : s('holed');
  if (res.tapin) return res.putt ? s('tapin') : s('close');
  if (res.event === 'water') return s('water');
  if (res.event === 'ob') return s('ob');
  if (res.duff) return s('duff');
  if (res.putt && res.lie === 'green') { const gone = dist(res.from, res.end); return gone < res.before - .4 ? s('short') : res.minD < .35 ? s('long') : s('wide'); }
  if (res.lie === 'green') return dist(res.end, h.pin) < 3 ? s('close') : s('green');
  return s(res.lie === 'trees' ? 'trees' : res.lie === 'sand' ? 'sand' : res.lie === 'fairway' ? 'fairway' : 'rough');
}
// A rival passes comment on the human's shot.
function heckle(res) {
  const R = G.R, npcs = R.players.filter(p => !p.human); if (!npcs.length) return;
  const bad = res.penalty || res.lie === 'sand' || res.lie === 'trees' || res.duff || res.pickedUp, good = (res.holed && res.before > 3) || (res.tapin && !res.putt);
  if ((bad || good) && Math.random() < .5) { const p = pick(npcs); chirp(p, cannedLine(p, bad ? 'needle' : 'grudge')); }
}
function animate(ball, res, npc, name) {
  if (npc && G.skip) return Promise.resolve();
  return new Promise(done => {
    const h = G.R.h, land = res.event === 'water' && res.splash ? res.splash : (res.land || res.end);
    if (res.putt) frame([res.from, h.pin, res.end], 3, 9); else frame([res.from, land, res.end, dist(res.end, h.pin) < 90 ? h.pin : null], 26, 70);
    G.anim = { ball, res, land, t0: performance.now(), flight: res.putt ? 0 : clamp(450 + res.carry * 4.5, 500, 1700) * (npc ? .6 : 1), roll: res.putt ? 0 : Math.min(750, 260 + dist(land, res.end) * 18), rate: npc ? 2.6 : 1.5, done, name };
  });
}

// ---------- rivals' shots ----------
async function npcTurn(ball, pl, run) {
  const R = G.R, h = R.h, live = () => { if (G.run !== run) throw ABORT; };
  G.npcBall = ball; G.npcName = pl.short;
  $('swing').classList.add('hidden'); $('meter').classList.add('hidden'); $('skip').classList.toggle('hidden', G.skip);
  $('shotinfo').innerHTML = `<b style="color:${pl.color}">${esc(pl.name)}</b><br><span>${G.skip ? 'Fast-forwarding the others.' : `${LIE_NAME[ball.lie] || 'Rough'}, ${ball.lie === 'green' ? Math.round(dist(ball.pos, h.pin) * 3) + ' ft' : Math.round(dist(ball.pos, h.pin)) + ' yd'} out.`}</span>`;
  if (!G.skip) { setWindBox(ball.lie === 'green'); if (ball.lie === 'green') frame([ball.pos, h.pin], 3, 9); else frame([ball.pos, h.pin], 30, 70); await sleep(420); live(); }
  const res = npcShot(R, ball, pl);
  await animate(ball, res, true, pl.short); live();
  G.npcBall = null; G.npcName = null;
  const good = (res.holed && res.before > 2.5) || (res.tapin && !res.putt), bad = res.penalty || res.pickedUp || (res.putt && !res.holed && !res.tapin && res.before < 2.5);
  if (!G.skip && (good || bad) && Math.random() < .45) chirp(pl, cannedLine(pl, good ? 'brag' : 'sulk'));
  if (!G.skip) { await sleep(res.holed || res.tapin ? 380 : 180); live(); }
  updateHud();
}
async function wolfCall(run) {
  const R = G.R, h = R.h, w = R.wolf, wolf = R.players[w.idx], n = i => i === 0 ? 'you' : R.players[i].short;
  let choice;
  if (wolf.human) {
    const rows = R.players.map((p, i) => i === 0 ? '' : `<button class="btn" data-val="${i}">Partner with ${esc(p.short)} <span class="note">(${LIE_NAME[R.balls[i].lie] || 'rough'}, ${Math.round(dist(R.balls[i].pos, h.pin))} yd out${R.balls[i].strokes > 1 ? ', lying ' + R.balls[i].strokes : ''})</span></button>`).join('');
    choice = +(await modal(`<p class="kicker">You’re the Wolf</p><h3>Pick your pack</h3><p>You are ${LIE_NAME[R.balls[0].lie] || 'in the rough'}, ${Math.round(dist(R.balls[0].pos, h.pin))} yd out. Win with a partner for 2 points each, or go alone for 4.</p>${rows}<button class="btn pink" data-val="-1">Go lone wolf</button>`));
  } else {
    choice = npcWolfChoice(wolf, w.idx, R.players, R.balls, h);
    toast(choice < 0 ? `${esc(wolf.short)} is going lone wolf. Bold.` : `${esc(wolf.short)} is the Wolf and picks ${choice === 0 ? 'you. Don’t let it go to your head' : esc(n(choice))}.`, 3000);
    await sleep(G.skip ? 0 : 1500);
  }
  if (G.run !== run) throw ABORT;
  setWolf(R, choice); updateHud();
}

// ---------- game plans and tee-box chat ----------
function rivalsPlan() {
  const R = G.R, left = R.total - R.hi, points = !MATCH_FORMATS.includes(R.fmt), npcs = [];
  R.players.forEach((p, i) => {
    if (p.human) return; npcs.push(p);
    const lead = points ? R.pts[i] - Math.max(...R.pts.filter((v, j) => j !== i)) : (R.teams && i === 1 ? R.up : -R.up);
    planHole(p, lead, left, points);
  });
  const talkers = shuffle(npcs).slice(0, R.hi === 0 ? 2 : Math.random() < .65 ? 1 : 0);
  talkers.forEach(p => chirp(p, cannedLine(p, 'tee')));
}

// ---------- hole and round flow ----------
async function playHole(run) {
  const R = G.R, live = () => { if (G.run !== run) throw ABORT; }, me = R.players[0];
  const h = startHole(R);
  G.img = renderHole(h, R.theme); G.green = renderGreen(h, R.theme); G.outer = { lush: '#143820', links: '#4d4c2a', desert: '#7a5c38' }[R.theme] || '#143820';
  G.turn = null; G.anim = null; G.npcBall = null; G.skip = false; G.overview = false; $('b-view').classList.remove('on');
  frame([h.tee, h.pin, ...h.path], 30, 80, true); updateHud(); setWindBox(false);
  $('shotinfo').innerHTML = ''; $('swing').classList.add('hidden'); $('meter').classList.add('hidden'); $('skip').classList.add('hidden');
  let extra = '';
  if (R.fmt === 'wolf') extra = R.wolf.idx === 0 ? 'You’re the Wolf this hole. Watch the tee shots, then choose.' : `${esc(R.players[R.wolf.idx].short)} is the Wolf this hole. Hit a good one and you might get picked.`;
  if (R.fmt === 'foursomes') extra = R.hi % 2 === 0 ? `You tee off. ${esc(R.players[1].short)} plays the next one.` : `${esc(R.players[1].short)} tees off. You get whatever is left.`;
  await modal(`<p class="kicker">Hole ${R.hi + 1} of ${R.total}</p><h3>${esc(h.name)}</h3><p><b>Par ${h.par}, ${h.yards} yards.</b> Wind ${R.wind.mph} mph.</p>${h.blurb ? `<p>${esc(h.blurb)}</p>` : ''}${extra ? `<p class="note">${extra}</p>` : ''}<button class="btn pink big" data-val="go">Tee it up</button>`);
  live();
  rivalsPlan();
  for (;;) {
    if (needsWolfCall(R)) await wolfCall(run);
    const b = nextBall(R); if (!b) break;
    const pl = R.players[hitterOf(R, b)];
    if (pl.human) { await humanShot(b); live(); await sleep(650); live(); }
    else await npcTurn(b, pl, run);
  }
  const out = finishHole(R);
  if (G.hooks.holeDone) G.hooks.holeDone(out);
  updateHud(); G.skip = false; $('skip').classList.add('hidden'); $('shotinfo').innerHTML = '';
  const pointsy = !MATCH_FORMATS.includes(R.fmt);
  const rows = R.players.map((p, i) => `<tr class="${i === 0 ? 'me' : ''}"><td>${i === 0 ? 'You' : esc(p.short)}</td><td>${out.strokes[i]}</td><td>${SCORE_NAME(out.strokes[i] - out.par)}</td>${pointsy ? `<td>${out.delta[i] ? '+' + out.delta[i] : '0'}</td>` : ''}</tr>`).join('');
  await modal(`<p class="kicker">${esc(h.name)}, par ${h.par}</p><h3>${esc(out.headline)}</h3>${out.sub ? `<p><b>${esc(out.sub)}</b></p>` : ''}<p>${SCORE_SASS(out.strokes[0] - out.par)}</p><table class="sc"><tr><th></th><th>Shots</th><th></th>${pointsy ? '<th>Pts</th>' : ''}</tr>${rows}</table><button class="btn pink big" data-val="go">${R.over ? 'See the damage' : 'Next hole'}</button>`);
  live(); R.hi++;
}
async function playRound(R) {
  const run = ++G.run; G.R = R; G.xp = {}; chirpQ.length = 0;
  resizeCanvas(); startLoop();
  try { while (!R.over) await playHole(run); } catch (e) { if (e !== ABORT) throw e; return; }
  stopLoop(); if (G.onEnd) G.onEnd(R, run);
}
function scorecardHtml(R) {
  const n = R.results.length, head = R.results.map(r => `<th>${r.hole}</th>`).join(''), pars = R.results.map(r => `<td>${r.par}</td>`).join('');
  const rows = R.players.map((p, i) => `<tr class="${i === 0 ? 'me' : ''}"><td>${i === 0 ? 'You' : esc(p.short)}</td>${R.strokes[i].map((s, k) => `<td class="${s < R.results[k].par ? 'u' : s > R.results[k].par ? 'o' : ''}">${s}</td>`).join('')}<td><b>${R.strokes[i].reduce((a, b) => a + b, 0) || ''}</b></td>${MATCH_FORMATS.includes(R.fmt) ? '' : `<td><b>${R.pts[i]}</b></td>`}</tr>`).join('');
  return n ? `<div class="scwrap"><table class="sc"><tr><th>Hole</th>${head}<th>Tot</th>${MATCH_FORMATS.includes(R.fmt) ? '' : '<th>Pts</th>'}</tr><tr class="o"><td>Par</td>${pars}<td>${R.results.reduce((a, r) => a + r.par, 0)}</td>${MATCH_FORMATS.includes(R.fmt) ? '' : '<td></td>'}</tr>${rows}</table></div>` : '<p class="note">Nothing on the card yet. Go and hit something.</p>';
}
function quitRound() { G.run++; G.turn = null; G.anim = null; stopLoop(); document.querySelectorAll('#s-play .modal').forEach(m => m.remove()); }

function bindPlay() {
  const cv = $('cv'); G.ctx = cv.getContext('2d');
  const world = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left - G.cw / 2) / G.cam.s + G.cam.x, y: (e.clientY - r.top - G.cyU) / G.cam.s + G.cam.y }; };
  cv.addEventListener('pointerdown', e => { const T = G.turn; if (!T) return; if (T.mode === 'aim') { G.drag = true; try { cv.setPointerCapture(e.pointerId); } catch (_) {} setTarget(world(e)); } else onSwing(); });
  cv.addEventListener('pointermove', e => { if (G.drag && G.turn && G.turn.mode === 'aim') setTarget(world(e)); });
  const up = () => { G.drag = false; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  $('swing').addEventListener('click', onSwing);
  $('skip').addEventListener('click', () => { G.skip = true; $('skip').classList.add('hidden'); if (G.anim) { const a = G.anim; G.anim = null; a.done(); } });
  window.addEventListener('resize', () => { if (!$('s-play').classList.contains('hidden')) { resizeCanvas(); aimCamera(); } });
  // Inside an embedding iframe (itch.io), Space and the arrow keys would otherwise scroll the host page.
  cv.addEventListener('pointerdown', () => { try { window.focus(); } catch (_) {} });
  window.addEventListener('keydown', e => {
    if (!$('s-play').classList.contains('hidden') && (e.code === 'Space' || e.code.startsWith('Arrow')) && !/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(e.target.tagName)) e.preventDefault();
    const T = G.turn; if (!T || $('s-play').classList.contains('hidden') || document.querySelector('#s-play .modal')) return;
    if (e.code === 'Space' || e.code === 'Enter') { if (e.target === $('swing')) return; e.preventDefault(); onSwing(); }
    else if (T.mode === 'aim' && e.code.startsWith('Arrow')) {
      e.preventDefault(); const b = T.ball.pos, st = T.cat === 'putt' ? .25 : 3; let a = Math.atan2(T.target.y - b.y, T.target.x - b.x), d = dist(b, T.target);
      if (e.code === 'ArrowLeft') a -= st / Math.max(d, 4); if (e.code === 'ArrowRight') a += st / Math.max(d, 4); if (e.code === 'ArrowUp') d += st; if (e.code === 'ArrowDown') d -= st;
      setTarget({ x: b.x + Math.cos(a) * d, y: b.y + Math.sin(a) * d });
    }
  });
}
