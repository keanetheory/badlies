// ---------- 05-agents: the eight rivals, their shot policy, game plans and insults ----------
// Every rival is an agent that runs entirely in the page, with no model calls:
//   1. a persona (skills, appetite for risk, how badly they tilt, how well they read wind)
//   2. a shot policy that samples outcomes for candidate targets and picks the one that suits their nerve
//   3. a game plan re-made every hole from the state of the match and their mood (attack, steady, safe; Wolf leanings)
//   4. a deep bag of stock insults, dealt without repeats until the bag runs dry
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

// ---------- more stock insults ----------
// needle: the human hit a bad one. grudge: the human hit a good one. brag / sulk: their own good and bad shots.
// tee: said on the tee. win / lose: parting shot after finishing ahead of, or behind, the human.
const MORE_LINES = {
  chad: {
    needle: ['That\u2019s a write-off, champ. Tax purposes only.', 'Your swing\u2019s in a bear market.', 'I\u2019d short that shot if I could.', 'You\u2019re diversifying into the trees, I see.', 'Bro. Just, bro.'],
    grudge: ['Okay, okay. Somebody ate their protein.', 'I taught you that. Indirectly.', 'Decent. I\u2019d still fade you long term.', 'Lucky bounce. Markets correct, champ.'],
    brag: ['Bang. That\u2019s generational wealth off the tee.', 'Scale that. You can\u2019t. I can.', 'Somebody clip that for my investors.', 'Nuked it. Nobody is surprised.'],
    sulk: ['That was a strategic loss.', 'I\u2019m pivoting. That shot was a beta.', 'This club is defective. I\u2019m suing.', 'Not my fault. Supply chain issue.'],
    tee: ['Stand back, champ. This one\u2019s going to the moon.', 'Let\u2019s make this interesting. Loser buys the round.', 'I\u2019m feeling bullish.', 'Watch and learn. Mostly watch.', 'Driver. Always driver.'],
    win: ['Scoreboard, champ. Read it and weep into your spreadsheet.', 'Winners win. I don\u2019t make the rules, I just dominate them.', 'Good effort. I\u2019ll send you my course on mindset.'],
    lose: ['Doesn\u2019t count. I was on a call.', 'I let you have that. Networking.', 'Small sample size, champ. Run it back.'],
  },
  peggy: {
    needle: ['Never mind, dear. Some people take up bowls.', 'I believe that one is in a different parish.', 'How adventurous of you.', 'You do find the most interesting parts of the course.', 'Oh, were you aiming? I couldn\u2019t tell.'],
    grudge: ['How nice. Was that on purpose?', 'Well, I never. And I usually have.', 'Splendid. Do try to look less surprised.', 'One good shot does not a golfer make, but still.'],
    brag: ['I shan\u2019t apologise for competence.', 'That\u2019s how it was done in my day. And today, evidently.', 'Do keep up, dear.', 'Dead straight. I do find it restful.'],
    sulk: ['Most irregular.', 'I shall be writing to the committee.', 'The ball is clearly faulty.', 'We shall say no more about it.'],
    tee: ['Shall we? Some of us have bridge at four.', 'Do hit away, dear. I\u2019ll catch you up on the green.', 'Lovely hole, this. I\u2019ve birdied it since before you were born.', 'Mind the water, dear. It minds you.', 'No rush. Well. A little rush.'],
    win: ['Thank you for the game, dear. Most restful.', 'Never mind. You hit it ever so far, in several directions.', 'Same time next week? I do enjoy an easy afternoon.'],
    lose: ['Well played, dear. I shall be having words with my putter.', 'Enjoy it. I have a long memory and a tee time on Thursday.', 'How lovely for you. Truly. Lovely.'],
  },
  gary: {
    needle: ['I didn\u2019t see that. Neither did you. Agreed?', 'Drop one by my ball, I won\u2019t tell.', 'Rough luck. I\u2019ve got a foot wedge you can borrow.', 'That\u2019s a lost ball. Unless it isn\u2019t. Up to you.', 'We\u2019ll call it winter rules.'],
    grudge: ['Hang on, what ball are you playing?', 'You\u2019ve been having lessons. That\u2019s basically cheating.', 'Good. Annoyingly good. Noted in pencil.', 'Lovely strike. Shame about the scorecard I\u2019m keeping.'],
    brag: ['That\u2019s a four. Don\u2019t count, just trust me.', 'Inside the leather. Any leather.', 'All skill. No witnesses, but all skill.', 'Pick it up, that\u2019s good. I said so.'],
    sulk: ['I wasn\u2019t ready. That was a rehearsal.', 'Improved my lie? I never. It improved itself.', 'Putting that down as a three.', 'Ground under repair, that. Definitely.'],
    tee: ['Usual stakes? I\u2019ll keep score.', 'First tee mulligans are in the rules. Somewhere.', 'Gimmes inside six feet today, yeah?', 'I\u2019ll go off the forward tees. Bad knee.', 'Nobody\u2019s counting practice swings, are they?'],
    win: ['By my card, I win. By any other card, don\u2019t look at any other card.', 'A fair result, fairly recorded, by me.', 'Unlucky. You owe me a tenner. We said a tenner.'],
    lose: ['I make it a tie, actually. Let me recount.', 'There\u2019ll be a stewards\u2019 enquiry.', 'You win on the day. I win on appeal.'],
  },
  margot: {
    needle: ['Amateur.', 'I see the problem. It\u2019s all of it.', 'That is not a shot. That is a cry for help.', 'Tempo. You have none.', 'Fascinating. Like watching a car alarm.'],
    grudge: ['Fine. Once.', 'Statistically, that had to happen eventually.', 'Not terrible.', 'I\u2019ll allow it.'],
    brag: ['Flag. Hunted.', 'Routine.', 'I could do that with a rental set.', 'That\u2019s the standard. Meet it.'],
    sulk: ['Recalibrating.', 'That was the wind. I don\u2019t miss.', 'Delete that.', 'A rare data point. Ignore it.'],
    tee: ['Try to keep up.', 'I\u2019ve played this hole in my sleep. I shot 3.', 'Hit it. Find it. Hit it again. Simple.', 'Quiet on the tee.', 'This won\u2019t take long.'],
    win: ['As expected.', 'Thank you for the practice round.', 'You lost to the better player. There\u2019s no shame in it. Some, but not much.'],
    lose: ['Enjoy it. It will not happen twice.', 'I\u2019ll be on the range until dark. You should worry.', 'Noted. Filed. Remembered.'],
  },
  tom: {
    needle: ['That\u2019ll need a search party.', 'I\u2019ll be fixing that divot till Thursday.', 'The course always wins.', 'I\u2019ve seen worse. Not today, but I have.', 'Nature is healing. Not your swing, though.'],
    grudge: ['Aye. Fine shot. Shame about what comes next.', 'The grass was kind to you there.', 'Don\u2019t smile. It tempts fate.', 'I\u2019ll admit it. Quietly.'],
    brag: ['Forty years I\u2019ve known that slope.', 'The course owed me that one.', 'A wee bit of joy. I don\u2019t trust it.', 'I raked it, I escaped it.'],
    sulk: ['Of course it did.', 'The moles are laughing at me.', 'I should have stayed in the shed.', 'Hope is a young man\u2019s game.'],
    tee: ['It\u2019ll rain by the turn. It always does.', 'Mind my fairways.', 'Somebody\u2019s going in that bunker. I just raked it.', 'Another hole. Another disappointment.', 'After you. I\u2019m in no hurry to suffer.'],
    win: ['I won. It brings me no joy. Nothing does.', 'The course and I had an understanding today.', 'Well. That\u2019s that. Back to the shed.'],
    lose: ['Beaten on my own course. Fitting.', 'I expected nothing and I\u2019m still let down.', 'Well played. Replace your divots on the way out.'],
  },
  bunny: {
    needle: ['Chat is going wild. Not in a good way.', 'That\u2019s a carousel post: swipe for disaster.', 'It\u2019s giving beginner.', 'We love a learning moment, guys.', 'Hashtag pray for them.'],
    grudge: ['Ugh, that was actually content.', 'Okay, main character energy. Briefly.', 'Not you stealing my thumbnail.', 'Fine, I\u2019ll tag you.'],
    brag: ['Link in bio for how I did that.', 'That\u2019s going viral. I can feel it.', 'Ring light off, putter on.', 'Slay. Literally slay.'],
    sulk: ['No. Delete. We reshoot.', 'My followers did not see that.', 'The algorithm made me do it.', 'That\u2019s between me and my close friends list.'],
    tee: ['Hi guys, welcome back to the channel.', 'Wait, let me get my good side.', 'Everyone say hi to my opponent. They\u2019re about to lose.', 'Quick one for the story, then I\u2019ll hit.', 'Outfit\u2019s a ten. Swing\u2019s a maybe.'],
    win: ['And that\u2019s a wrap, guys. Winner winner.', 'Thanks for being in my video. You were great as the loser.', 'GG. Posting this immediately.'],
    lose: ['We\u2019re not uploading this one.', 'It\u2019s fine. Losing is very relatable.', 'Okay but my outfit won.'],
  },
  rev: {
    needle: ['Lost, like a sheep. A very wayward sheep.', 'There is a time to reap and a time to reload.', 'Wide is the path that leads to the rough.', 'I\u2019ve heard confessions less painful than that.', 'Fear not. Though I would, from there.'],
    grudge: ['Hallelujah. Let\u2019s not make a habit of it.', 'Verily, that was struck.', 'The meek may inherit the earth, but you got the green.', 'I see you\u2019ve been saying your prayers.'],
    brag: ['My cup runneth over. So does this one, with my ball.', 'Ask, and it shall be given.', 'A righteous strike.', 'I walk through the valley of the bunkers and fear no evil.'],
    sulk: ['Heavens to Betsy.', 'I am being tested.', 'That one\u2019s going in Sunday\u2019s sermon.', 'Flipping Nora. Forgive me.'],
    tee: ['Let us play.', 'May your ball fly straight. Mine will.', 'Peace be with you. And a slice also.', 'Thou shalt not covet thy neighbour\u2019s drive.', 'A brisk pace, please. Evensong is at six.'],
    win: ['The Lord works in mysterious ways. I work in fairways.', 'Go in peace. And perhaps take a lesson.', 'Blessed is the winner. Which is me. Humbly.'],
    lose: ['Pride goeth before a fall. Do watch your step.', 'I forgive you. Eventually.', 'A humbling. I shall reflect on it, at length, from the pulpit.'],
  },
  kev: {
    needle: ['Skipped like a scratched CD.', 'That\u2019s a remix nobody asked for.', 'Lost that one in the mix, mate.', 'Bit pitchy.', 'Wrong genre. That was jazz.'],
    grudge: ['Tune! Absolute tune.', 'That slaps. Annoyingly.', 'Rewind! Selecta!', 'Fair play. Drinks are still on you.'],
    brag: ['Crowd goes wild. I am the crowd.', 'Hands in the air for that one.', 'Out of the sand like it\u2019s the main stage.', 'That\u2019s the drop.'],
    sulk: ['Feedback on the mic. My bad.', 'Buffering.', 'That was the support act.', 'Skip. Next song.'],
    tee: ['Speaker on. Vibes on. Let\u2019s go.', 'Anyone want a cold one before we tee off?', 'This hole\u2019s a banger.', 'No plan. Never had one. Fore!', 'I\u2019ll hit when the beat drops.'],
    win: ['Winner stays on the decks. Good game, mate.', 'Vibes beat talent. Science.', 'I wasn\u2019t even keeping score. Did I win? Mint.'],
    lose: ['You won the golf. I won the afternoon.', 'Good set, mate. Encore next week?', 'Lost? Didn\u2019t notice. Great tunes though.'],
  },
};
for (const n of NPCS) for (const [k, v] of Object.entries(MORE_LINES[n.id])) n.lines[k] = (n.lines[k] || []).concat(v);

// Deal a line the rival hasn't used yet; reshuffle that pile once it is empty.
function cannedLine(npc, kind, rng = Math.random) {
  const used = npc._used = npc._used || {}, pool = npc.lines[kind];
  let left = pool.filter(l => !(used[kind] || []).includes(l));
  if (!left.length) { used[kind] = []; left = pool; }
  const l = pick(left, rng); (used[kind] = used[kind] || []).push(l);
  return l;
}
// The rival's plan for the next hole. lead = how far ahead they are (holes or points), left = holes still to play.
function planHole(pl, lead, left, points) {
  const big = points ? left * 1.5 : left * .6;
  if (lead < 0 && -lead >= big) { pl.plan = 'attack'; pl.wolfLean = 'lone'; }
  else if (lead > 0 && lead >= big) { pl.plan = 'safe'; pl.wolfLean = 'partner'; }
  else if ((pl.tiltNow || 0) > .5) { pl.plan = 'attack'; pl.wolfLean = 'lone'; }
  else { pl.plan = 'steady'; pl.wolfLean = null; }
  return pl.plan;
}

// Claude is used only by the Course Forger (screenshot survey and described holes), never by the rivals.
const AI = {
  sample: null, denied: false,
  async init() { try { if (typeof window !== 'undefined' && window.claude && window.claude.use) this.sample = await window.claude.use('sample'); } catch (e) { this.sample = null; } },
};
