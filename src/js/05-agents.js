// ---------- 05-agents: the eight rivals and the brains that drive them ----------
// Every rival is an agent with three layers:
//   1. a persona (skills, appetite for risk, how badly they tilt, how well they read wind)
//   2. a local policy that picks each shot by sampling outcomes for candidate targets (instant, works offline)
//   3. a language-model "brain" with its own memory that sets strategy for the hole, makes Wolf calls and talks back
const NPCS = [
  { id: 'chad', name: 'Chad Bunkerman', short: 'Chad', color: '#ff7a45', bio: 'Crypto evangelist with a monster drive and a 40-putt habit. Calls everyone champ.', voice: 'loud, overconfident, finance-bro slang, never admits fault', skills: { drive: 8, approach: 5, chip: 3, sand: 4, putt: 3 }, aggr: .9, tilt: .8, savvy: .4,
    lines: { needle: ['Tough break, champ. Want me to invoice you for that lesson?', 'That shot just got delisted.', 'I\u2019ve seen better swings on a playground.'], grudge: ['Okay champ, don\u2019t get used to it.', 'Beginner\u2019s luck is still luck, I guess.', 'Fine. That was adequate.'], brag: ['Absolute rocket. Somebody call air traffic control.', 'That\u2019s what peak performance looks like, people.', 'I\u2019d say sorry, but I\u2019m not.'], sulk: ['The wind moved. Everyone saw the wind move.', 'These greens are clearly broken.', 'My caddie app gave me the wrong number.'] } },
  { id: 'peggy', name: 'Dame Peggy Thwaite', short: 'Peggy', color: '#b48cf2', bio: 'Club champion nine times, most recently last week. Hits it 150 yards, dead straight, forever.', voice: 'genteel, withering, backhanded compliments', skills: { drive: 3, approach: 6, chip: 8, sand: 6, putt: 9 }, aggr: .2, tilt: .15, savvy: .9,
    lines: { needle: ['Oh dear. Never mind, it\u2019s a lovely day for a walk.', 'Bold choice, aiming there.', 'I had a swing like that once. Then I took a lesson.'], grudge: ['Well done, dear. Even a stopped clock, and so on.', 'Goodness. Do that again and I shall have to start trying.', 'Lovely. Who taught you that, and why did they stop?'], brag: ['Fairways and greens, dear. It isn\u2019t complicated.', 'Straight down the middle. How dull for you.', 'One does one\u2019s best.'], sulk: ['I blame the new groundskeeper.', 'That hasn\u2019t happened since 1987.', 'Hmph. Write that down as a practice shot.'] } },
  { id: 'gary', name: 'Gary \u201cGimme\u201d Lunt', short: 'Gary', color: '#ffd23f', bio: 'Has never holed a putt under four feet because he has never attempted one. Keeps his own scorecard. In pencil.', voice: 'shifty, cheerful, always negotiating the rules', skills: { drive: 5, approach: 5, chip: 5, sand: 5, putt: 5 }, aggr: .5, tilt: .4, savvy: .6,
    lines: { needle: ['That\u2019s gone, but I\u2019d have given you it.', 'Unlucky. Call it a practice one? I always do.', 'I\u2019ll put you down for a five. Ish.'], grudge: ['Nice. Suspiciously nice. Checking your ball.', 'Good shot. I wasn\u2019t looking, but good shot.', 'Alright, no need to show off.'], brag: ['And that\u2019s a gimme from there, obviously.', 'Textbook. Don\u2019t check which textbook.', 'Count it. Quickly, before anyone looks.'], sulk: ['Didn\u2019t count. Someone coughed.', 'I\u2019m taking a mulligan. Club rules. My club.', 'That was my provisional, actually.'] } },
  { id: 'margot', name: 'Margot Steele', short: 'Margot', color: '#7fc8f8', bio: 'Ex-tour pro. Lost her card, kept the contempt. Hits irons like she is signing a warrant.', voice: 'ice-cold, clipped, clinical', skills: { drive: 7, approach: 9, chip: 6, sand: 7, putt: 6 }, aggr: .6, tilt: .3, savvy: .95,
    lines: { needle: ['Interesting. Wrong, but interesting.', 'I\u2019ve seen that shot before. On a blooper reel.', 'You\u2019ll find it. Eventually.'], grudge: ['Acceptable.', 'Hm. So you can play. Noted.', 'Do it under pressure and I\u2019ll be impressed.'], brag: ['As intended.', 'That\u2019s called a golf shot. Take notes.', 'Pin high. Obviously.'], sulk: ['The yardage book is wrong.', 'Unacceptable. From me, I mean. From you it would be normal.', 'We do not speak of that one.'] } },
  { id: 'tom', name: 'Old Tom Morose', short: 'Old Tom', color: '#9fb39a', bio: 'Greenkeeper here for forty years. Knows every blade of grass and resents most of them. Best bunker player alive, by necessity.', voice: 'gloomy, fatalistic, bone dry', skills: { drive: 5, approach: 6, chip: 7, sand: 9, putt: 6 }, aggr: .35, tilt: .2, savvy: 1,
    lines: { needle: ['Aye, I knew that was coming. We all did.', 'The pond thanks you for your donation.', 'It only gets worse from here, you know.'], grudge: ['Good shot. It won\u2019t last.', 'Enjoy it. Joy is fleeting.', 'Well. Even the rain stops sometimes.'], brag: ['Out of trouble again. Story of my life.', 'Not bad for a man with no hope.', 'I\u2019d smile, but I\u2019ve forgotten how.'], sulk: ['Typical.', 'I mowed that myself. Betrayed by my own work.', 'This is what I get for hoping.'] } },
  { id: 'bunny', name: 'Bunny Valentina', short: 'Bunny', color: '#ff4f8b', bio: 'Golf influencer with 2.1 million followers. Films every shot twice. Streaky as a cheap window, but the putter runs hot.', voice: 'bubbly, performative, narrates to her followers', skills: { drive: 6, approach: 4, chip: 5, sand: 3, putt: 8 }, aggr: .7, tilt: .6, savvy: .3,
    lines: { needle: ['Ooh, can I post that? My followers love a fail.', 'Don\u2019t worry, I\u2019ll put a nice filter on it.', 'Guys, we do not swing like that. Like and subscribe.'], grudge: ['Okay, that one\u2019s going in the reel.', 'Wait, do that again, I wasn\u2019t recording.', 'Obsessed. Slightly annoyed, but obsessed.'], brag: ['And that\u2019s the thumbnail, guys.', 'Sponsors, you know where to find me.', 'Putter\u2019s hot. Somebody check the smoke alarm.'], sulk: ['We\u2019re cutting that from the vlog.', 'The lighting threw me off.', 'That one\u2019s for the bloopers. Members only.'] } },
  { id: 'rev', name: 'Reverend Niblick', short: 'The Rev', color: '#e8e2d0', bio: 'Vicar of St Andrew-in-the-Rough. Steady as a pew. Forgives everything except slow play.', voice: 'sanctimonious, gentle, swears only in biblical euphemism', skills: { drive: 4, approach: 7, chip: 7, sand: 5, putt: 7 }, aggr: .3, tilt: .25, savvy: .8,
    lines: { needle: ['The Lord giveth, and the pond taketh away.', 'I shall pray for your swing. It will need more than one.', 'Forgiveness is divine. That shot was not.'], grudge: ['A miracle. I know one when I see one.', 'Bless you. That can only be divine intervention.', 'Well struck. Pride comes before a fall, mind.'], brag: ['Straight and narrow, as it is written.', 'Somebody up there likes me.', 'Blessed are the fairway finders.'], sulk: ['Oh, sugar and sandals.', 'Forgive me, Father, for I have shanked.', 'Well, that was a test of faith.'] } },
  { id: 'kev', name: 'DJ Sandtrap', short: 'Kev', color: '#3fe0c5', bio: 'Real name Kev. Brings a speaker, a cooler and no plan. Gets up and down from everywhere. Vibes first, score second.', voice: 'laid-back, chaotic, party energy', skills: { drive: 7, approach: 5, chip: 4, sand: 8, putt: 4 }, aggr: .8, tilt: .1, savvy: .5,
    lines: { needle: ['Big swing, no ding. Shake it off.', 'That one\u2019s still dropping, mate. Like my new single.', 'Rough\u2019s a vibe. You\u2019ll love it in there.'], grudge: ['Oi oi! That\u2019s a banger.', 'Proper shot. Play that one back.', 'Alright, who let you get good?'], brag: ['Beach to green, baby. Greatest hits.', 'Drop the beat, then drop the putt.', 'Vibes are immaculate.'], sulk: ['Wrong tempo. My fault. Mostly.', 'Needs more bass.', 'We don\u2019t talk about that. Next track.'] } },
];

const GOLFERS = [
  { id: 'barry', name: 'Barry Mulligan', color: '#ff4f8b', tag: 'Big off the tee. Bigger off the fairway.', skills: { drive: 5, approach: 2, chip: 2, sand: 2, putt: 3 } },
  { id: 'fliss', name: 'Fliss Divot', color: '#7fc8f8', tag: 'Irons like lasers. Putts like she\u2019s posting a letter.', skills: { drive: 3, approach: 5, chip: 3, sand: 2, putt: 1 } },
  { id: 'mo', name: 'Mo Chippendale', color: '#ffd23f', tag: 'Gets up and down from the car park.', skills: { drive: 2, approach: 3, chip: 5, sand: 3, putt: 2 } },
  { id: 'sandy', name: 'Sandy Trapp', color: '#f2c488', tag: 'Lives in bunkers. Pays rent.', skills: { drive: 3, approach: 2, chip: 3, sand: 5, putt: 2 } },
  { id: 'pip', name: 'Pip Yips', color: '#b48cf2', tag: 'Putts like a dream. The rest is a nightmare.', skills: { drive: 2, approach: 2, chip: 3, sand: 2, putt: 5 } },
  { id: 'alex', name: 'Alex Average', color: '#3fe0c5', tag: 'Aggressively fine at everything.', skills: { drive: 3, approach: 3, chip: 3, sand: 3, putt: 3 } },
];

// The house commentator. Speaks only about the human, and never kindly.
const SASS = {
  fairway: ['Fairway. Don\u2019t let it go to your head.', 'Short grass. Who are you and what have you done with you?', 'Down the middle. Suspicious.', 'Fairway. Frame it.'],
  rough: ['Rough. It\u2019s called that for a reason.', 'In the cabbage. Bring a strimmer.', 'The long stuff. Again.', 'Rough. Technically still golf.'],
  sand: ['Beach day.', 'Bunker. Should have packed a bucket and spade.', 'Sand. It was right there and you still walked into it.', 'In the trap. The trap is delighted.'],
  water: ['Splash. That ball had a family.', 'Wet. Add one stroke, subtract some dignity.', 'The fish thank you for your contribution.', 'Water. Brave of you to bring your good balls.'],
  ob: ['Out of bounds. Somewhere, a car alarm.', 'That\u2019s gone. Reload, and maybe aim this time.', 'OB. The neighbours send their regards.'],
  trees: ['Timber. You\u2019re in jail.', 'Trees are ninety percent air. You found the other ten.', 'In the woods. Say hi to the squirrels.'],
  close: ['Stiff. Who\u2019s been practising?', 'That\u2019s a tap-in. Even for you.', 'Dart. Take a bow, quietly.'],
  green: ['On the dance floor. Can\u2019t hear the music yet, though.', 'Green. Two putts from here, three if we\u2019re honest.', 'Putting surface. Low bar, cleared.'],
  holed: ['Drained it.', 'Bottom of the cup. Act like you\u2019ve been there.', 'In. The crowd, such as it is, goes mild.'],
  bomb: ['From downtown. Absolutely filthy.', 'That\u2019s obscene. Do it again.', 'Holed from another postcode.'],
  chipin: ['Chip-in! Pure luck. Glorious, glorious luck.', 'Holed it from off the green. Nobody will believe you.'],
  short: ['Never up, never in.', 'Short. The hole is further away than that. It always is.', 'Does your putter work?'],
  long: ['Whoa. Brakes exist.', 'That one had places to be.', 'Past the hole and still rolling, emotionally.'],
  wide: ['Read that like a foreign menu.', 'Break? What break?', 'Close. Horseshoes close.'],
  tapin: ['Tap-in. Even you can\u2019t miss that.', 'Knocked in. Gary would have given you it anyway.'],
  duff: ['Chunked it. The planet moved further than the ball.', 'Fat. Replace your divot. And your swing.', 'That went nowhere, with conviction.'],
  pickup: ['That\u2019s the limit. Pick it up, we\u2019ve all seen enough.'],
  ace: ['Hole in one! Drinks are on you. That\u2019s the rule.'],
};
const SCORE_NAME = d => d <= -3 ? 'Albatross' : d === -2 ? 'Eagle' : d === -1 ? 'Birdie' : d === 0 ? 'Par' : d === 1 ? 'Bogey' : d === 2 ? 'Double bogey' : d === 3 ? 'Triple bogey' : 'A big number';
const SCORE_SASS = d => d <= -2 ? 'Eagle. Check the card, then check it again.' : d === -1 ? 'Birdie. Buy yourself something nice.' : d === 0 ? 'Par. Boring. Lovely, boring par.' : d === 1 ? 'Bogey. The people\u2019s score.' : d === 2 ? 'Double. We don\u2019t need to talk about it.' : 'A number so big it needs planning permission.';

// ---------- local policy ----------
const TRIALS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [.7, .7], [-.7, -.7], [.7, -.7], [-.7, .7], [0, 1.8], [0, -1.8]];
function shotCost(h, r) {
  if (r.holed) return -25;
  const rem = dist(r.end, h.pin), lp = { green: -8, fairway: 0, tee: 0, rough: 9, sand: 26, trees: 30 }[r.lie] || 0;
  return (r.lie === 'green' ? rem * .6 : rem) + lp + (r.event === 'water' ? 55 : r.event === 'ob' ? 75 : 0);
}
function npcPlan(pl, h, ball, wind) {
  const cat = shotCat(h, ball);
  if (cat === 'putt') { const b = bestPuttAim(h, ball.pos); return { cat, ang: b.ang, d: b.d }; }
  const from = ball.pos, max = maxDist(pl, cat, ball.lie), dPin = dist(from, h.pin), sg = sigma(pl, cat, ball.lie);
  const toward = (p, d) => { const L = dist(from, p) || 1; return { x: from.x + (p.x - from.x) / L * d, y: from.y + (p.y - from.y) / L * d }; };
  const cands = [];
  if (dPin <= max) { cands.push({ ...h.pin }, { ...h.greenC }); } else cands.push(toward(h.pin, max * .97));
  const i0 = nearestIdx(h.path, from).i;
  for (let i = i0 + 2; i < h.path.length; i += 3) { const p = h.path[i], d = dist(from, p); if (d <= max * .98 && d > Math.min(60, max * .4) && dist(p, h.pin) < dPin - 15) cands.push({ ...p }); }
  const aggr = clamp(pl.aggr + (pl.plan === 'attack' ? .25 : pl.plan === 'safe' ? -.25 : 0) + (pl.tiltNow || 0) * .2, 0, 1.2);
  const wk = (cat === 'chip' || cat === 'sand') ? .002 : .0045;
  let best = null;
  for (const c of cands) {
    const carry = dist(from, c) * (1 - ROLL[cat]);
    let aim = { x: c.x - wind.x * carry * wk * pl.savvy, y: c.y - wind.y * carry * wk * pl.savvy };
    if (dist(from, aim) > max) aim = toward(aim, max);
    let sum = 0, sq = 0;
    for (const [g1, g2] of TRIALS) { const v = shotCost(h, resolveShot(h, from, ball.lie, aim, { power: 1 + g1 * sg.d, ang: g2 * sg.a }, cat, wind)); sum += v; sq += v * v; }
    const mean = sum / TRIALS.length, sd = Math.sqrt(Math.max(0, sq / TRIALS.length - mean * mean));
    const score = mean + (.8 - aggr) * sd;
    if (!best || score < best.score) best = { score, target: aim };
  }
  return { cat, target: best.target };
}
function npcExec(pl, cat, lie, rng) {
  const sg = sigma(pl, cat, lie), m = 1 + (pl.tiltNow || 0) * .25 - (pl.heat || 0) * .08;
  let power = 1 + gauss(rng) * sg.d * m; const ang = gauss(rng) * sg.a * m;
  if (cat !== 'putt' && rng() < .012 * (11 - pl.skills[cat]) / 5) power *= .55;
  return { power, ang };
}
function moodAfterHole(pl, diff) {
  if (diff >= 2) { pl.tiltNow = Math.min(1, (pl.tiltNow || 0) + pl.tilt * .5); pl.heat = 0; }
  else if (diff <= -1) { pl.tiltNow = Math.max(0, (pl.tiltNow || 0) - .3); pl.heat = Math.min(1, (pl.heat || 0) + .5); }
  else { pl.tiltNow = (pl.tiltNow || 0) * .6; pl.heat = (pl.heat || 0) * .5; }
}
// Wolf call: returns the index of the chosen partner, or -1 to go alone.
function npcWolfChoice(wolf, wolfIdx, players, balls, h) {
  const q = (b, p) => -dist(b.pos, h.pin) - ({ fairway: 0, tee: 0, green: -20, rough: 12, sand: 30, trees: 40 }[b.lie] || 0) - b.strokes * 40 + SKILLS.reduce((s, k) => s + p.skills[k], 0);
  let bi = -1, bq = -1e9;
  players.forEach((p, i) => { if (i !== wolfIdx) { const v = q(balls[i], p); if (v > bq) { bq = v; bi = i; } } });
  const mine = q(balls[wolfIdx], wolf), lean = wolf.wolfLean === 'lone' ? 25 : wolf.wolfLean === 'partner' ? -25 : 0;
  return (mine + (wolf.aggr - .6) * 50 + lean > bq + 12) ? -1 : bi;
}

// ---------- language-model brains ----------
const AI = {
  sample: null, enabled: true, denied: false, coolUntil: 0, calls: 0,
  async init() { try { if (typeof window !== 'undefined' && window.claude && window.claude.use) this.sample = await window.claude.use('sample'); } catch (e) { this.sample = null; } },
  ok() { return this.enabled && !!this.sample && !this.denied && Date.now() > this.coolUntil; },
  status() { return !this.sample ? 'offline' : this.denied ? 'declined' : !this.enabled ? 'off' : Date.now() < this.coolUntil ? 'resting' : 'live'; },
  fail(e) { const c = e && e.code; if (c === 'not_granted') this.denied = true; else this.coolUntil = Date.now() + (c === 'rate_limited' ? 120000 : 25000); },
  async json(prompt, opts) { if (!this.ok()) return null; this.calls++; try { return await this.sample.json(prompt, { modelTier: 'quick', cache: false, ...opts }); } catch (e) { this.fail(e); return null; } },
};
class Brain {
  constructor(npc) { this.npc = npc; this.memory = []; this.said = []; }
  note(s) { this.memory.push(s); if (this.memory.length > 8) this.memory.shift(); }
  async think(ctx) {
    const n = this.npc;
    const prompt = `You are the mind of one computer-controlled golfer in Bad Lies, a cheeky, irreverent golf video game. Stay fully in character.

Character: ${n.name}. ${n.bio}
Voice: ${n.voice}.
Your skills out of 10: driving ${n.skills.drive}, approach ${n.skills.approach}, chipping ${n.skills.chip}, sand ${n.skills.sand}, putting ${n.skills.putt}.
Your temperament: risk appetite ${Math.round(n.aggr * 10)}/10.

The human player is ${ctx.human}. Format: ${ctx.format}. ${ctx.rules}
Standings: ${ctx.standings}
${ctx.moment}
Your memory of this round, oldest first: ${this.memory.length ? this.memory.join(' | ') : 'nothing yet'}
Your history with ${ctx.human}: ${ctx.history}
Lines you have already used (do not repeat or rephrase them): ${this.said.length ? this.said.join(' | ') : 'none'}

Decide how you will play, then say one line of banter. The line is at most 16 words, sounds like you, and needles ${ctx.human} or reacts to the round. Keep it playful: no slurs, no swearing stronger than "bloody", nothing about anyone's body, gender, race, age or religion.

Reply with only this JSON: {"strategy":"attack" or "steady" or "safe","wolf":"lone" or "partner","line":"..."}`;
    const r = await AI.json(prompt);
    if (!r || typeof r.line !== 'string') return null;
    const line = r.line.replace(/^["\u201c]|["\u201d]$/g, '').slice(0, 140);
    this.said.push(line); if (this.said.length > 6) this.said.shift();
    return { strategy: ['attack', 'steady', 'safe'].includes(r.strategy) ? r.strategy : 'steady', wolf: r.wolf === 'lone' ? 'lone' : 'partner', line };
  }
}
function cannedLine(npc, kind, rng = Math.random) { return pick(npc.lines[kind], rng); }
