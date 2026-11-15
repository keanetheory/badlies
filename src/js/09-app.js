// ---------- 09-app: saves, menus, the Course Forger screen, boot ----------
const freshSkills = g => Object.fromEntries(SKILLS.map(k => [k, { lvl: g.skills[k], xp: 0 }]));
let save = { v: 1, golfer: null, golfers: {}, stats: { rounds: 0, wins: 0, holes: 0 }, h2h: {}, ai: true, t: 0, cash: 20, stake: 0, club: null, lastDaily: '' };
let courses = [];
const Store = {
  col: null, chains: {},
  async init() { try { const c = window.claude; if (!c || !c.use) return; const [db, user] = await Promise.all([c.use('db'), c.use('user')]); const id = user && await user.id(); if (db && id) this.col = db.collection('data/users/' + id); } catch (e) { this.col = null; } },
  put(key, data) { if (!this.col) return; const col = this.col; this.chains[key] = (this.chains[key] || Promise.resolve()).then(() => col.doc(key).set(data)).catch(() => {}); },
  del(key) { if (!this.col) return; const col = this.col; this.chains[key] = (this.chains[key] || Promise.resolve()).then(() => col.doc(key).delete()).catch(() => {}); },
  async pull() {
    if (!this.col) return null;
    try {
      const snap = await Promise.race([this.col.get(), sleep(10000).then(() => null)]); if (!snap) return null;
      const out = { courses: [] };
      for (const d of snap.docs) { const v = d.data(); if (!v) continue; if (d.id === 'career') out.career = v; else if (d.id.startsWith('course_')) out.courses.push(v); }
      return out;
    } catch (e) { return null; }
  },
};
function loadLocal() {
  try { const s = JSON.parse(localStorage.getItem('badlies.save') || 'null'); if (s && s.v === 1) save = Object.assign(save, s); } catch (e) {}
  try { const c = JSON.parse(localStorage.getItem('badlies.courses') || '[]'); if (Array.isArray(c)) courses = c; } catch (e) {}
}
function saveLocal() { save.t = Date.now(); try { localStorage.setItem('badlies.save', JSON.stringify(save)); } catch (e) {} }
function persist() { saveLocal(); Store.put('career', save); }
function saveCourses() { try { localStorage.setItem('badlies.courses', JSON.stringify(courses)); } catch (e) {} }
const golfer = () => GOLFERS.find(g => g.id === save.golfer);
const mySkills = () => save.golfers[save.golfer];
const initials = n => n.replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('');
const badge = (name, color) => `<span class="badge" style="background:${color}">${esc(initials(name))}</span>`;
const skillBars = (lv, xp) => `<div class="bars">${SKILLS.map(k => `<span>${SKILL_NAME[k]}</span><span class="bar"><i style="width:${lv[k] * 10}%"></i></span><b>${lv[k]}</b>${xp ? `<span class="note">next level</span><span class="bar xp"><i style="width:${xp[k].lvl >= MAX_LEVEL ? 100 : xp[k].xp / xpNeed(xp[k].lvl) * 100}%"></i></span><span class="note">${xp[k].lvl >= MAX_LEVEL ? 'max' : xp[k].xp + '/' + xpNeed(xp[k].lvl)}</span>` : ''}`).join('')}</div>`;

// ---------- golf clubs and money ----------
// Subs fall due every SUBS_EVERY rounds, counted from joining. Magpie and High Trees are free until your first win.
const CLUBS = [
  { id: 'magpie', name: 'Magpie Golf Club', fee: 0, freeUntilWin: true, color: '#3b3f4a', blurb: 'They’ll take anything shiny, including your ball if it stops near the car park.' },
  { id: 'hightrees', name: 'High Trees', fee: 0, freeUntilWin: true, color: '#2f7d4a', blurb: 'Named for the canopy. Famous for the ricochets.' },
  { id: 'rabbit', name: 'Rabbit Warren', fee: 50, color: '#a77b4f', blurb: 'The fairways are full of holes. Not the useful kind.' },
  { id: 'scarlet', name: 'Scarlet Libbets', fee: 100, color: '#c8243b', blurb: 'Red jackets, red faces, red ink on the card.' },
  { id: 'darker', name: 'Darkerthanusual Heath', fee: 250, color: '#3a2a4f', blurb: 'Gloomy, exclusive, and quietly furious about your shoes.' },
];
const FREE_CLUB_FEE = 25, SUBS_EVERY = 10, MAX_STAKE = 5, DAILY_BONUS = 5;
// £5 for each calendar day (the player's local date) the game is opened. Safe to call repeatedly.
let dailyNote = '';
function dailyBonus() {
  const d = new Date(), today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (save.lastDaily === today) return;
  save.lastDaily = today; save.cash = round2(save.cash + DAILY_BONUS); persist();
  dailyNote = `Daily allowance: ${money(DAILY_BONUS)} added. `;
}
const clubFee = c => c.freeUntilWin ? (save.stats.wins > 0 ? FREE_CLUB_FEE : 0) : c.fee;
const myClub = () => save.club && CLUBS.find(c => c.id === save.club.id);
const homeCourseOf = c => c && BUILTIN.find(b => b.club === c.id);
const feeText = c => c.freeUntilWin ? (save.stats.wins > 0 ? `${money(FREE_CLUB_FEE)} every ${SUBS_EVERY} rounds. The free ride ended with your first win.` : `Free until you win your first match, then ${money(FREE_CLUB_FEE)} every ${SUBS_EVERY} rounds.`) : `${money(c.fee)} every ${SUBS_EVERY} rounds.`;
function joinClub(id) {
  const c = CLUBS.find(x => x.id === id), fee = clubFee(c);
  if (!c || save.cash < fee || (save.club && save.club.id === id)) return;
  save.cash = round2(save.cash - fee); save.club = { id, due: save.stats.rounds + SUBS_EVERY }; persist();
}
// Called after each round. Pays subs when due; if the wallet can't cover them, drops to the cheapest club it can, or out.
function chargeSubs() {
  const c = myClub(); if (!c || save.stats.rounds < save.club.due) return '';
  const fee = clubFee(c);
  if (save.cash >= fee) { save.cash = round2(save.cash - fee); save.club.due += SUBS_EVERY; return fee ? `${c.name} took ${money(fee)} in subs. Next due after round ${save.club.due}.` : `${c.name} renewed your membership for nothing. Enjoy it while it lasts.`; }
  const alt = CLUBS.filter(x => x.id !== c.id && clubFee(x) <= save.cash).sort((a, b) => clubFee(a) - clubFee(b))[0];
  if (alt) { const f = clubFee(alt); save.cash = round2(save.cash - f); save.club = { id: alt.id, due: save.stats.rounds + SUBS_EVERY }; return `You couldn’t cover the ${money(fee)} subs at ${c.name}, so you’re now a member of ${alt.name}${f ? ` (${money(f)})` : ''}.`; }
  save.club = null; return `You couldn’t cover the ${money(fee)} subs at ${c.name}. Your membership has lapsed.`;
}
const stakeNow = () => Math.max(0, Math.min(save.stake || 0, Math.floor(save.cash)));
const stakesHtml = () => `<h3 class="sec">The stakes</h3><p class="note">Put up to ${money(MAX_STAKE)} on it. Everyone in your group matches your stake and the winner takes the pot. You have ${money(save.cash)}.</p>
  <div class="rowwrap">${[0, 1, 2, 3, 4, 5].map(n => `<button class="chip" data-act="stake" data-id="${n}" aria-pressed="${stakeNow() === n}" ${n > save.cash ? 'disabled' : ''} style="padding-left:14px">${n ? money(n) : 'No bet'}</button>`).join('')}</div>`;

// ---------- navigation ----------
const nav = [];
let U = { fmt: 'stableford', total: 6, course: 'sodden', rivals: [] };
let Q = { course: null, n: 0, golfer: null };   // Quick Start picks
const QUICK_HOLES = 6;
let lastCfg = null;   // what "Go again" replays
let F = { tab: 'words', holes: [], name: '', theme: 'lush', busy: false, msg: '', file: null, lat: '', sel: 0 };
let lastRound = null;
function show(screen) { for (const s of ['title', 'page', 'play']) $('s-' + s).classList.toggle('hidden', s !== screen); if (screen !== 'play') stopLoop(); }
function go(page, replace) {
  dailyNote = '';
  if (!replace) nav.push(page); else nav[nav.length - 1] = page;
  show('page'); renderPage(); $('s-page').scrollTop = 0;
}
function back() { nav.pop(); if (nav.length) { show('page'); renderPage(); } else home(); }
function home() { nav.length = 0; show('title'); dailyBonus(); titleFoot(); }
function titleFoot() {
  const g = golfer(), c = myClub();
  $('title-foot').textContent = dailyNote + (g ? `Playing as ${g.name}${c ? ` of ${c.name}` : ''}. ${money(save.cash)} in the wallet. ${save.stats.rounds} round${save.stats.rounds === 1 ? '' : 's'}, ${save.stats.wins} win${save.stats.wins === 1 ? '' : 's'}.` : 'No golfer yet. Pick one and start embarrassing yourself.');
}
const PAGES = {
  golfer: ['Pick your golfer', pageGolfer], setup: ['Set up the round', pageSetup], quick: ['Quick start', pageQuick], locker: ['Locker room', pageLocker],
  rivals: ['The rivals', pageRivals], club: ['Golf club', pageClub], forge: ['Course Forger', pageForge], result: ['The damage', pageResult],
};
function renderPage(keepScroll) {
  const p = nav[nav.length - 1], st = $('s-page').scrollTop; if (!p) return;
  $('page-title').textContent = PAGES[p][0]; $('page').innerHTML = PAGES[p][1]();
  if (PAGES[p][2]) PAGES[p][2]();
  if (keepScroll) $('s-page').scrollTop = st;
}

// ---------- pages ----------
function pageGolfer() {
  return `<p class="lede">Everyone starts bad at most things. Play shots, earn experience in that skill, get less bad.</p><div class="grid2">${GOLFERS.map(g => {
    const sk = save.golfers[g.id];
    return `<button class="pick" data-act="golfer" data-id="${g.id}" aria-pressed="${save.golfer === g.id}"><span class="who">${badge(g.name, g.color)}<span><h3>${esc(g.name)}</h3><span class="note">${esc(g.tag)}</span></span></span>${skillBars(sk ? levels(sk) : g.skills)}</button>`;
  }).join('')}</div>`;
}
const homeTag = c => { const m = myClub(); return m && c.club === m.id ? 'Your home course. ' : ''; };
const allCourses = () => [...BUILTIN.map(c => ({ id: c.id, name: c.name, tag: homeTag(c) + c.tag })), ...courses.map(c => ({ id: c.id, name: c.name, tag: `${c.holes.length} hole${c.holes.length === 1 ? '' : 's'}, forged by you.` }))];
function pageQuick() {
  const g = golfer() || GOLFERS.find(x => x.id === Q.golfer), ready = Q.course && Q.n;
  return `<p class="lede">New to all this? Play strokeplay: count every shot, and the lowest total wins. Pick a course and some company and I’ll sort out the rest.</p>
  <h3 class="sec">1. Pick a course</h3><div class="grid2">${allCourses().map(c => `<button class="pick" data-act="q-course" data-id="${esc(c.id)}" aria-pressed="${Q.course === c.id}"><h3>${esc(c.name)}</h3><span class="note">${esc(c.tag)}</span></button>`).join('')}</div>
  <h3 class="sec">2. How many playing partners?</h3><div class="rowwrap">${[1, 2, 3].map(n => `<button class="chip" data-act="q-n" data-id="${n}" aria-pressed="${Q.n === n}" style="padding-left:14px">${n} partner${n === 1 ? '' : 's'}</button>`).join('')}</div>
  <p class="note">I’ll pick them for you from whoever is loitering by the first tee.</p>
  ${stakesHtml()}
  <div class="card rowwrap" style="justify-content:space-between"><span class="who">${badge(g.name, g.color)}<span><b>You’ll play as ${esc(g.name)}</b><br><span class="note">${QUICK_HOLES} holes of strokeplay.</span></span></span><button class="btn small" data-act="go" data-to="golfer">Change golfer</button></div>
  <div class="sticky-cta"><button class="btn pink big" data-act="q-tee" ${ready ? '' : 'disabled'}>${!Q.course ? 'Pick a course first' : !Q.n ? 'Pick your partners' : 'Tee off'}</button></div>`;
}
function pageSetup() {
  const f = FORMATS[U.fmt], need = f.n - 1, all = allCourses();
  const who = U.fmt === 'stableford' ? 'Pick three to play alongside. The other five are out on the course too.' : U.fmt === 'strokeplay' ? 'Pick up to three playing partners.' : f.teams ? 'Pick three. The first one is your partner, so choose with your head.' : `Pick ${need === 1 ? 'your opponent' : need + ' opponents'}.`;
  return `<h3 class="sec">The game</h3><div class="grid2">${Object.entries(FORMATS).map(([id, x]) => `<button class="pick" data-act="fmt" data-id="${id}" aria-pressed="${U.fmt === id}"><h3>${x.name}</h3><span class="note">${x.blurb}</span></button>`).join('')}</div>
  <h3 class="sec">How long have you got?</h3><div class="rowwrap">${[3, 6, 9].map(n => `<button class="chip" data-act="len" data-id="${n}" aria-pressed="${U.total === n}" style="padding-left:14px">${n} holes</button>`).join('')}</div>
  <h3 class="sec">The course</h3><div class="grid2">${all.map(c => `<button class="pick" data-act="course" data-id="${esc(c.id)}" aria-pressed="${U.course === c.id}"><h3>${esc(c.name)}</h3><span class="note">${esc(c.tag)}</span></button>`).join('')}</div>
  <h3 class="sec">The company</h3><p class="note">${who} Leave it short and I’ll fill the gaps with whoever is loitering by the first tee.</p>
  <div class="rowwrap">${NPCS.map(n => { const i = U.rivals.indexOf(n.id); return `<button class="chip" data-act="rival" data-id="${n.id}" aria-pressed="${i >= 0}"><i class="dot" style="background:${n.color}"></i>${esc(n.short)}${i === 0 && f.teams ? ' (partner)' : ''}</button>`; }).join('')}</div>
  ${stakesHtml()}
  <div class="sticky-cta"><button class="btn pink big" data-act="tee">Tee off</button></div>`;
}
function pageLocker() {
  const g = golfer();
  if (!g) return `<p class="lede">No golfer in here yet. The lockers are empty and so is your trophy cabinet.</p><button class="btn pink big" data-act="go" data-to="golfer">Pick a golfer</button>`;
  const sk = mySkills(), s = save.stats;
  return `<div class="card"><div class="who">${badge(g.name, g.color)}<span><h3 style="font-size:1.6rem">${esc(g.name)}</h3><span class="note">${esc(g.tag)}</span></span></div>${skillBars(levels(sk), sk)}</div>
  <p class="note">Every shot you hit earns experience in its skill: tee shots for Driving, full shots for Approach, anything inside 55 yards for Chipping, bunker shots for Sand play, and putts for Putting. Better shots earn more. Higher levels hit it further and straighter, slow the swing meter and show more of the putting line.</p>
  <div class="card"><b>Career</b><p>${s.rounds} round${s.rounds === 1 ? '' : 's'} played, ${s.wins} won, ${s.holes} holes survived.</p></div>
  <div class="card"><b>Wallet and club</b><p>${money(save.cash)} in the wallet. ${myClub() ? `Member of ${esc(myClub().name)}, subs next due after round ${save.club.due}.` : 'Not a member of any club. Golf without somewhere to complain about it.'}</p></div>
  <div class="rowwrap"><button class="btn" data-act="go" data-to="golfer">Change golfer</button><button class="btn" data-act="go" data-to="club">Golf club</button><button class="btn pink" data-act="play">Play a round</button></div>`;
}
function pageRivals() {
  return `<p class="lede">Eight regulars, eight separate agents. Each one picks their own shots, re-plans every hole from the state of the match, tilts in their own way, and has plenty to say about your golf.</p>
  <div class="grid2">${NPCS.map(n => { const r = save.h2h[n.id]; return `<div class="card"><div class="who">${badge(n.name, n.color)}<span><h3 style="font-size:1.3rem">${esc(n.name)}</h3><span class="note">${r && r.w + r.l ? (r.w > r.l ? `You lead ${r.w}–${r.l}` : r.w < r.l ? `They lead ${r.l}–${r.w}` : `Level at ${r.w}–${r.l}`) : 'You haven’t met yet'}</span></span></div><p style="margin-top:8px">${esc(n.bio)}</p>${skillBars(n.skills)}<p class="note" style="margin-top:8px">Risk appetite ${Math.round(n.aggr * 10)}/10. Tilts ${n.tilt > .6 ? 'badly' : n.tilt > .3 ? 'a bit' : 'almost never'}. Reads the wind ${n.savvy > .8 ? 'like a book' : n.savvy > .45 ? 'well enough' : 'like a horoscope'}.</p></div>`; }).join('')}</div>`;
}
function pageClub() {
  const mine = myClub();
  return `<p class="lede">Every golfer needs a club to complain about. Subs are due every ${SUBS_EVERY} rounds. Miss a payment and you drop to a club you can afford, or out on your ear.</p>
  <div class="card"><b>${money(save.cash)} in the wallet.</b> ${mine ? `You’re a member of ${esc(mine.name)}. Next subs (${money(clubFee(mine))}) due after round ${save.club.due}; you’ve played ${save.stats.rounds}.` : 'You aren’t a member anywhere yet.'} Moving clubs means paying the new club’s subs straight away.</div>
  <div class="grid2">${CLUBS.map(c => {
    const fee = clubFee(c), home = homeCourseOf(c), here = mine && mine.id === c.id, short = round2(fee - save.cash);
    return `<div class="card"${here ? ' style="outline:3px solid var(--yellow)"' : ''}><div class="who">${badge(c.name, c.color)}<span><h3 style="font-size:1.3rem">${esc(c.name)}</h3><span class="note">${esc(feeText(c))}</span></span></div>
      <p style="margin-top:8px">${esc(c.blurb)}</p>${home ? `<p class="note">Home course: ${esc(home.name)}</p>` : ''}
      <div class="rowwrap" style="margin-top:8px">${here ? '<b>Your club</b>' : `<button class="btn small ${fee ? '' : 'pink'}" data-act="join" data-id="${c.id}" ${short > 0 ? 'disabled' : ''}>${fee ? `Join for ${money(fee)}` : 'Join for free'}</button>${short > 0 ? `<span class="note">You need ${money(short)} more.</span>` : ''}`}</div></div>`;
  }).join('')}</div>`;
}
function pageResult() {
  const L = lastRound; if (!L) return '';
  const { R, st, gains, ups, cash } = L;
  const head = st.tied ? 'A tie. Deeply unsatisfying.' : st.won ? 'You won. Insufferable.' : pick(['You lost. Shocking nobody.', 'Beaten. Again.', 'Well, you turned up.']);
  const place = `You finished ${['', '1st', '2nd', '3rd'][st.rank] || st.rank + 'th'} of ${st.rows.length}`;
  const line = st.match ? st.text + '.' : st.low ? `${place} on ${R.pts[0]} strokes, ${toParWords(R.pts[0] - st.par)}.` : `${place} with ${R.pts[0]} point${R.pts[0] === 1 ? '' : 's'}.`;
  const table = st.match ? '' : `<table class="sc"><tr><th>Player</th><th>${st.low ? 'Strokes' : 'Points'}</th></tr>${st.rows.map(r => `<tr class="${r.human ? 'me' : ''}"><td>${esc(r.human ? 'You' : r.name)}</td><td>${r.score}${st.low ? ` (${toParText(r.score - st.par)})` : ''}</td></tr>`).join('')}</table>`;
  const xp = SKILLS.filter(k => gains[k]).map(k => `<li><b>${SKILL_NAME[k]}</b> +${gains[k]} XP${ups.includes(k) ? `, now level ${mySkills()[k].lvl}` : ''}</li>`).join('');
  return `<h3 class="verdict">${head}</h3><p class="lede"><b>${esc(line)}</b> ${esc(FORMATS[R.fmt].name)} over ${R.results.length} hole${R.results.length === 1 ? '' : 's'} at ${esc(R.courseName)}.</p>
  <div class="quote"><p id="quote">${esc(L.quote.line)}</p><p class="note" id="quote-by">${esc(L.quote.by)}</p></div>
  ${table}<h3 class="sec">The card</h3>${scorecardHtml(R)}
  <h3 class="sec">The money</h3><p>${cash.stake ? (cash.share > 0 ? `You took ${money(cash.share)} from the ${money(cash.pot)} pot.` : `The ${money(cash.pot)} pot went elsewhere, and so did your ${money(cash.stake)}.`) : 'No money on this one.'} You have ${money(save.cash)}.</p>${cash.subs ? `<p class="note">${esc(cash.subs)}</p>` : ''}
  <h3 class="sec">What you learned</h3><ul style="margin:0;padding-left:20px">${xp || '<li>Nothing. Somehow.</li>'}${st.won && !st.tied ? '<li>Winner’s bonus: +25 XP in everything.</li>' : ''}</ul>
  <div class="rowwrap"><button class="btn pink big" data-act="again">Go again</button><button class="btn" data-act="home">Clubhouse</button></div>`;
}

// ---------- round start / end ----------
function teeOff() { startRound({ fmt: U.fmt, total: U.total, course: U.course, rivals: U.rivals.slice(), stake: stakeNow() }); }
function quickTee() {
  if (!Q.course || !Q.n) return;
  if (!golfer()) ACTS.golfer({ id: Q.golfer }, true);
  startRound({ fmt: 'strokeplay', total: QUICK_HOLES, course: Q.course, rivals: [], size: Q.n + 1, stake: stakeNow() });
}
// cfg: { fmt, total, course, rivals, size?, stake? }. size overrides the format's player count (strokeplay plays 2 to 4).
// The stake leaves the wallet at the first tee; walking off forfeits it.
function startRound(cfg) {
  if (!save.golfer) return go('golfer');
  lastCfg = cfg;
  const f = FORMATS[cfg.fmt], n = cfg.size || f.n, g = golfer(), C = getCourse(cfg.course, courses);
  let ids = cfg.rivals.slice(0, n - 1);
  for (const x of shuffle(NPCS)) if (ids.length < n - 1 && !ids.includes(x.id)) ids.push(x.id);
  const mk = n => ({ ...n, skills: { ...n.skills }, _used: {} });
  const me = { id: 'me', name: g.name, short: 'You', human: true, color: '#ffffff', skills: levels(mySkills()) };
  const R = newRound({ format: cfg.fmt, holes: C.holes, total: cfg.total, theme: C.theme, courseName: C.name, seed: Date.now() >>> 0, players: [me, ...ids.map(id => mk(NPCS.find(n => n.id === id)))], field: cfg.fmt === 'stableford' ? NPCS.filter(n => !ids.includes(n.id)).map(mk) : [] });
  R.stake = Math.max(0, Math.min(cfg.stake || 0, MAX_STAKE, Math.floor(save.cash)));
  if (R.stake) { save.cash = round2(save.cash - R.stake); persist(); }
  G.hooks.seenHint = save.stats.holes > 0;
  show('play'); playRound(R);
}
G.hooks.xp = (cat, amt) => { const sk = mySkills(), before = sk[cat].lvl; addXp(sk, cat, amt); G.xp[cat] = (G.xp[cat] || 0) + amt; saveLocal(); if (sk[cat].lvl > before) { G.R.players[0].skills[cat] = sk[cat].lvl; (G.ups = G.ups || []).push(cat); return sk[cat].lvl; } return null; };
G.hooks.holeDone = () => { save.stats.holes++; persist(); };
G.onEnd = (R, run) => {
  const st = standings(R), won = st.won && !st.tied, gains = { ...G.xp }, ups = (G.ups || []).slice(); G.ups = [];
  save.stats.rounds++; if (won) { save.stats.wins++; for (const k of SKILLS) { const b = mySkills()[k].lvl; addXp(mySkills(), k, 25); if (mySkills()[k].lvl > b) ups.push(k); } }
  R.players.forEach((p, i) => {
    if (p.human || (R.teams && i === 1)) return;
    const r = save.h2h[p.id] = save.h2h[p.id] || { w: 0, l: 0 }, d = st.match ? R.up : st.low ? R.pts[i] - R.pts[0] : R.pts[0] - R.pts[i];
    if (d > 0) r.w++; else if (d < 0) r.l++;
  });
  const share = potShare(R, R.stake); save.cash = round2(save.cash + share);
  const cash = { stake: R.stake, pot: R.stake * R.players.length, share, subs: chargeSubs() };
  persist();
  const rival = R.players[R.teams ? 2 : 1], q = { line: cannedLine(rival, won ? 'lose' : st.tied ? 'sulk' : 'win'), by: rival.name };
  lastRound = { R, st, gains, ups, quote: q, cash };
  nav.length = 0; go('result');
};

// ---------- Course Forger ----------
function sampleGeo() {
  // A pretend OpenStreetMap export, built from three house holes, so the importer has something to chew on.
  const C = getCourse('sodden'), lat0 = 51.2345, lon0 = -0.5432, kx = Math.cos(lat0 * Math.PI / 180) * 111320 * YD, ky = 110540 * YD, feats = [];
  [0, 1, 4].forEach((hi, k) => {
    const h = C.holes[hi], ll = p => [+(lon0 + (p.x + k * 320) / kx).toFixed(6), +(lat0 - p.y / ky).toFixed(6)], ring = poly => [[...poly.map(ll), ll(poly[0])]];
    const add = (tags, type, coordinates) => feats.push({ type: 'Feature', properties: tags, geometry: { type, coordinates } });
    add({ golf: 'hole', ref: String(k + 1), par: String(h.par), name: h.name }, 'LineString', h.path.filter((p, i) => i % 12 === 0 || i === h.path.length - 1).map(ll));
    h.fairways.forEach(p => add({ golf: 'fairway' }, 'Polygon', ring(p))); h.greens.forEach(p => add({ golf: 'green' }, 'Polygon', ring(p)));
    h.bunkers.forEach(p => add({ golf: 'bunker' }, 'Polygon', ring(p))); h.waters.forEach(p => add({ natural: 'water' }, 'Polygon', ring(p)));
    add({ golf: 'tee' }, 'Polygon', ring(h.teeBox)); h.trees.filter((t, i) => i % 2 === 0).forEach(t => add({ natural: 'tree' }, 'Point', ll(t)));
  });
  return JSON.stringify({ type: 'FeatureCollection', features: feats });
}
function pageForge() {
  const aiOk = AI.sample && !AI.denied, tabs = [['words', 'Describe it'], ['shot', 'Map screenshot'], ['data', 'Map data']];
  const ll = F.lat.match(/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
  let panel;
  if (F.tab === 'words') panel = `<p>Tell me about a hole and I’ll lay it out. Real or imaginary, I’m not fussy.</p><textarea id="f-words" placeholder="A 410-yard par 4 that doglegs left around a lake, with a tiny green ringed by bunkers.">${esc(F.words || '')}</textarea><button class="btn pink" data-act="f-words" ${F.busy ? 'disabled' : ''}>Design this hole</button>${aiOk ? '' : '<p class="note">Claude isn’t available in this view, so I’ll build it from keywords: par, yards, dogleg left or right, water, bunkers, tight, trees.</p>'}`;
  else if (F.tab === 'shot') panel = `<p>Open the course in Google Maps (satellite view is best), frame one hole so the tee and the green are both in shot, take a screenshot and hand it over. I’ll survey it and repaint it.</p>
    <div class="rowwrap"><button class="btn" data-act="f-pick-img">${F.file ? 'Change screenshot' : 'Choose a screenshot'}</button><span class="note">${F.file ? esc(F.file.name) : 'No file yet.'}</span></div>
    <input type="text" id="f-hint" placeholder="Anything I should know? e.g. plays bottom-left to top-right, about 410 yards" value="${esc(F.hint || '')}">
    <button class="btn pink" data-act="f-shot" ${F.busy || !F.file || !aiOk ? 'disabled' : ''}>Survey this hole</button>${aiOk ? '<p class="note">The screenshot is sent to Claude on your account to be traced. It isn’t stored anywhere else.</p>' : '<p class="note">Surveying a screenshot needs Claude’s eyes, which aren’t available in this view. The other two tabs still work.</p>'}`;
  else panel = `<p>For exact geometry, feed me OpenStreetMap data for the course. One paste can build all eighteen.</p>
    <ol style="margin:0;padding-left:20px;display:grid;gap:6px"><li>In Google Maps, long-press the clubhouse and copy the coordinates. Paste them here:<input type="text" id="f-lat" placeholder="51.2345, -0.5432" value="${esc(F.lat)}" style="margin-top:6px"></li>
    <li>Run this query at overpass-turbo.eu:<pre class="code" id="f-query">${esc(ll ? OVERPASS_QUERY(ll[1], ll[2]) : OVERPASS_QUERY('LAT', 'LON'))}</pre><button class="btn small" data-act="f-copy" style="margin-top:6px">Copy query</button></li>
    <li>Export as GeoJSON (or raw data), then paste it below or choose the file.</li></ol>
    <textarea id="f-geo" placeholder='{"type":"FeatureCollection","features":[...]}'>${esc(F.geo || '')}</textarea>
    <div class="rowwrap"><button class="btn pink" data-act="f-geo" ${F.busy ? 'disabled' : ''}>Build from map data</button><button class="btn" data-act="f-pick-geo">Choose a file</button><button class="btn" data-act="f-sample">Try the sample</button></div>`;
  const cur = F.holes[F.sel];
  const board = F.holes.length ? `<h3 class="sec">On the drawing board</h3>
    <div class="thumbs" id="f-thumbs">${F.holes.map((h, i) => `<figure data-act="f-sel" data-id="${i}" style="cursor:pointer;${i === F.sel ? 'font-weight:800' : ''}"><span data-thumb="${i}"></span>${i + 1}. ${esc(h.name)}</figure>`).join('')}</div>
    ${cur ? `<div class="card"><b>${esc(cur.name)}</b>, par ${cur.par}, ${cur.yards} yards. ${cur.bunkers.length} bunker${cur.bunkers.length === 1 ? '' : 's'}, ${cur.waters.length ? 'water in play' : 'no water'}, ${cur.trees.length} trees.${cur.blurb ? `<p class="note">${esc(cur.blurb)}</p>` : ''}<div class="rowwrap" style="margin-top:8px"><button class="btn small" data-act="f-del">Scrap this hole</button></div></div><div id="f-preview"></div>` : ''}
    <label><b>Course name</b><input type="text" id="f-name" value="${esc(F.name)}" placeholder="Royal Something-or-Other"></label>
    <div class="rowwrap"><b>Look</b>${Object.entries(THEMES).map(([id, t]) => `<button class="chip" style="padding-left:14px" data-act="f-theme" data-id="${id}" aria-pressed="${F.theme === id}">${t.label}</button>`).join('')}</div>
    <button class="btn yellow big" data-act="f-save">Save and play this course</button>` : '';
  const saved = courses.length ? `<h3 class="sec">Your courses</h3>${courses.map(c => `<div class="card rowwrap" style="justify-content:space-between"><span><b>${esc(c.name)}</b><br><span class="note">${c.holes.length} hole${c.holes.length === 1 ? '' : 's'}, ${THEMES[c.theme] ? THEMES[c.theme].label.toLowerCase() : 'parkland'}</span></span><span class="rowwrap"><button class="btn small pink" data-act="f-play" data-id="${esc(c.id)}">Play</button><button class="btn small" data-act="f-rm" data-id="${esc(c.id)}">Delete</button></span></div>`).join('')}` : '';
  return `<p class="lede">Hand me a real course and I’ll repaint it in the house style: striped fairways, shadowed bunkers, the lot. Then you can go and ruin it.</p>
  <div class="tabs">${tabs.map(([id, l]) => `<button class="chip" style="padding-left:14px" data-act="f-tab" data-id="${id}" aria-pressed="${F.tab === id}">${l}</button>`).join('')}</div>
  <div class="card" style="display:grid;gap:12px">${panel}${F.msg ? `<p role="status"><b>${esc(F.msg)}</b></p>` : ''}</div>${board}${saved}`;
}
PAGES.forge[2] = () => {
  F.holes.forEach((h, i) => { const slot = document.querySelector(`[data-thumb="${i}"]`); if (!slot) return; h._img = h._theme === F.theme && h._img ? h._img : renderRegion(h, F.theme, 0, 0, h.w, h.h, 1.2); h._theme = F.theme; const c = document.createElement('canvas'); c.width = h._img.width; c.height = h._img.height; c.getContext('2d').drawImage(h._img, 0, 0); slot.replaceWith(c); });
  const cur = F.holes[F.sel], box = $('f-preview');
  if (cur && box) { const r = renderHole(cur, F.theme).cv; r.className = 'preview'; const x = r.getContext('2d'), S = r.width / cur.w, p = cur.pin; x.setTransform(S, 0, 0, S, 0, 0); x.strokeStyle = '#fff'; x.lineWidth = 1; x.beginPath(); x.moveTo(p.x, p.y); x.lineTo(p.x, p.y - 12); x.stroke(); x.fillStyle = '#FF4F8B'; x.beginPath(); x.moveTo(p.x, p.y - 12); x.lineTo(p.x + 7, p.y - 9.5); x.lineTo(p.x, p.y - 7); x.fill(); box.appendChild(r); }
};
function forgeRead() { for (const [id, k] of [['f-words', 'words'], ['f-hint', 'hint'], ['f-lat', 'lat'], ['f-geo', 'geo'], ['f-name', 'name']]) if ($(id)) F[k] = $(id).value; }
function forgeAdd(holes, msg) { F.holes.push(...holes); F.holes = F.holes.slice(0, 18); F.sel = F.holes.length - 1; F.msg = msg; F.busy = false; renderPage(true); const b = $('f-preview'); if (b) b.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
function forgeFail(e) { F.busy = false; F.msg = (e && e.message) || 'That didn’t work. Try again with something clearer.'; renderPage(true); }
async function forgeWords() {
  forgeRead(); const text = (F.words || '').trim(); if (!text) { F.msg = 'Give me something to work with. A par and a shape will do.'; return renderPage(true); }
  F.busy = true; F.msg = 'Sketching…'; renderPage(true);
  const seed = hashStr(text) + F.holes.length;
  try {
    let h = null;
    if (AI.sample && !AI.denied) { try { const spec = await AI.sample.json(surveyPrompt('text', text.slice(0, 600)), { modelTier: 'default' }); h = specToHole(spec, .5, seed); } catch (e) { if (e && e.code === 'not_granted') AI.denied = true; } }
    if (!h) h = describeLocally(text, seed);
    forgeAdd([h], `Done: ${h.name}, par ${h.par}, ${h.yards} yards.`);
  } catch (e) { forgeFail(e); }
}
async function forgeShot() {
  forgeRead(); if (!F.file) return; F.busy = true; F.msg = 'Surveying. This takes a little while; I’m counting bunkers.'; renderPage(true);
  try {
    const { blob, aspect } = await downscale(F.file);
    const spec = await AI.sample.json(surveyPrompt('image', (F.hint || '').slice(0, 300)), { images: [blob], modelTier: 'default' });
    const h = specToHole(spec, aspect, hashStr(F.file.name + F.file.size));
    forgeAdd([h], `Surveyed: ${h.name}, par ${h.par}, about ${h.yards} yards.`);
  } catch (e) {
    const c = e && e.code; if (c === 'not_granted') AI.denied = true;
    forgeFail(c ? new Error(c === 'not_granted' ? 'No permission to use Claude, so no survey. The other tabs still work.' : c === 'rate_limited' ? 'Claude is catching its breath. Give it a minute and try again.' : c === 'images_unavailable' || c === 'image_rejected' ? 'That image couldn’t be sent. Try a smaller PNG or JPEG.' : 'The survey came back garbled. Try again, or frame the hole more tightly.') : e);
  }
}
function forgeGeo(text) {
  forgeRead(); const src = text || F.geo || ''; if (!src.trim()) { F.msg = 'Paste some map data first, or try the sample.'; return renderPage(true); }
  try { const { holes, notes } = importGeo(src); forgeAdd(holes, `Built ${holes.length} hole${holes.length === 1 ? '' : 's'} from the map data. ${notes.join(' ')}`); }
  catch (e) { forgeFail(e instanceof SyntaxError ? new Error('That isn’t valid JSON. Export GeoJSON or raw data from Overpass Turbo and paste the whole thing.') : e); }
}
function forgeSave() {
  forgeRead(); if (!F.holes.length) return;
  const c = { id: 'c' + Date.now().toString(36), name: (F.name || '').trim().slice(0, 48) || 'Unnamed Municipal', theme: F.theme, holes: F.holes.map(packHole) };
  courses.push(c); saveCourses(); Store.put('course_' + c.id, c);
  F = { ...F, holes: [], name: '', msg: '', sel: 0 }; U.course = c.id;
  if (!save.golfer) { G.afterGolfer = 'setup'; go('golfer'); } else go('setup');
}

// ---------- events ----------
const ACTS = {
  quick() { Q = { course: null, n: 0, golfer: pick(GOLFERS).id }; nav.length = 0; go('quick'); },
  'q-course'(d) { Q.course = d.id; renderPage(true); },
  'q-n'(d) { Q.n = +d.id; renderPage(true); },
  'q-tee': quickTee,
  stake(d) { save.stake = +d.id; saveLocal(); renderPage(true); },
  join(d) { joinClub(d.id); renderPage(true); },
  play() { if (!save.golfer) { nav.length = 0; go('golfer'); G.afterGolfer = 'setup'; } else { nav.length = 0; go('setup'); } },
  go(d) { go(d.to); }, back, home,
  golfer(d, quiet) { const g = GOLFERS.find(x => x.id === d.id); save.golfer = g.id; if (!save.golfers[g.id]) save.golfers[g.id] = freshSkills(g); persist(); if (quiet) return; if (G.afterGolfer) { const to = G.afterGolfer; G.afterGolfer = null; go(to, true); } else if (nav.length > 1) back(); else renderPage(true); },
  fmt(d) { U.fmt = d.id; U.rivals = U.rivals.slice(0, FORMATS[U.fmt].n - 1); renderPage(true); },
  len(d) { U.total = +d.id; renderPage(true); },
  course(d) { U.course = d.id; renderPage(true); },
  rival(d) { const i = U.rivals.indexOf(d.id), need = FORMATS[U.fmt].n - 1; if (i >= 0) U.rivals.splice(i, 1); else { U.rivals.push(d.id); if (U.rivals.length > need) U.rivals.shift(); } renderPage(true); },
  tee: teeOff, again() { if (lastCfg) startRound({ ...lastCfg, stake: stakeNow() }); else teeOff(); },
  async quit() { if (await modal(`<h3>Walking off?</h3><p>Your experience is safe. Your reputation is not.${G.R && G.R.stake ? ` Your ${money(G.R.stake)} stake stays in the pot.` : ''}</p><button class="btn" data-val="no">Keep playing</button><button class="btn pink" data-val="yes">Walk off</button>`) === 'yes') { quitRound(); persist(); home(); } },
  view() { G.overview = !G.overview; $('b-view').classList.toggle('on', G.overview); const h = G.R.h; if (G.turn) aimCamera(); else if (G.overview) frame([h.tee, h.pin, ...h.path], 30, 80); },
  card() { modal(`<h3>The card</h3><p class="note">${esc(FORMATS[G.R.fmt].name)} at ${esc(G.R.courseName)}. ${esc(statusText(G.R))}</p>${scorecardHtml(G.R)}<button class="btn pink" data-val="x">Back to it</button>`); },
  'f-tab'(d) { forgeRead(); F.tab = d.id; F.msg = ''; renderPage(true); },
  'f-words': forgeWords, 'f-shot': forgeShot, 'f-geo'() { forgeGeo(); },
  'f-sample'() { forgeGeo(sampleGeo()); },
  'f-pick-img'() { forgeRead(); $('file-img').click(); }, 'f-pick-geo'() { forgeRead(); $('file-geo').click(); },
  'f-copy'() { forgeRead(); const t = $('f-query').textContent; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => { F.msg = 'Query copied.'; renderPage(true); }, () => { F.msg = 'Couldn’t reach the clipboard. Select the query and copy it by hand.'; renderPage(true); }); },
  'f-sel'(d) { forgeRead(); F.sel = +d.id; renderPage(true); },
  'f-del'() { forgeRead(); F.holes.splice(F.sel, 1); F.sel = Math.max(0, F.sel - 1); F.msg = ''; renderPage(true); },
  'f-theme'(d) { forgeRead(); F.theme = d.id; renderPage(true); },
  'f-save': forgeSave,
  'f-play'(d) { U.course = d.id; if (!save.golfer) { G.afterGolfer = 'setup'; go('golfer'); } else go('setup'); },
  'f-rm'(d) { courses = courses.filter(c => c.id !== d.id); delete holeCache[d.id]; saveCourses(); Store.del('course_' + d.id); if (U.course === d.id) U.course = 'sodden'; renderPage(true); },
};
function boot() {
  loadLocal(); dailyBonus(); bindPlay(); titleFoot();
  document.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b && ACTS[b.dataset.act] && !b.disabled) ACTS[b.dataset.act](b.dataset); });
  document.addEventListener('change', e => { if (e.target.id === 'f-lat') { forgeRead(); renderPage(true); } });
  $('file-img').addEventListener('change', e => { F.file = e.target.files[0] || null; F.msg = ''; e.target.value = ''; renderPage(true); });
  $('file-geo').addEventListener('change', async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { F.geo = ''; forgeGeo(await f.text()); } catch (err) { forgeFail(err); } });
  // title backdrop: one of the house holes, painted by the same renderer the game uses
  setTimeout(() => { try { const h = getCourse('sodden').holes[4], r = renderRegion(h, 'lush', 0, 0, h.w, h.h, 2.2), bg = $('title-bg'); bg.width = r.width; bg.height = r.height; bg.getContext('2d').drawImage(r, 0, 0); } catch (e) {} }, 30);
  AI.init();
  Store.init().then(() => Store.pull()).then(remote => {
    if (!remote) return;
    if (remote.career && remote.career.v === 1 && (remote.career.t || 0) > (save.t || 0) && $('s-play').classList.contains('hidden')) { save = Object.assign(save, remote.career); saveLocal(); dailyBonus(); }
    for (const c of remote.courses) if (c && c.id && Array.isArray(c.holes) && !courses.some(x => x.id === c.id)) courses.push(c);
    saveCourses(); titleFoot(); if (nav.length && !$('s-page').classList.contains('hidden')) { forgeRead(); renderPage(true); }
  });
  window.__badlies = { G, AI, get save() { return save; }, importGeo, sampleGeo, describeLocally, specToHole, onSwing };
}
boot();
