// Profetier, rigets magtfaktioner, togter til sagnsteder og runesten.
'use strict';

// ---------- Kilder til bonusser (hersker, arvestykke, gaver, sagnsteder og faktioner) ----------
function fxSources(cv) {
  const out = [];
  if (!cv || !isMajor(cv)) return out;
  const tf = traitFx(cv);
  if (Object.keys(tf).length) out.push({ name: `Herskeren ${cv.ruler ? cv.ruler.name : ''}`.trim(), fx: tf });
  if (cv.relic && RELICS[cv.relic] && RELICS[cv.relic].fx) out.push({ name: RELICS[cv.relic].name, fx: RELICS[cv.relic].fx });
  for (const b of cv.boons || []) if (!b.until || b.until > G.turn) out.push(b);
  for (const k of cv.legends || []) if (LEGENDS[k].fx) out.push({ name: LEGENDS[k].name, fx: LEGENDS[k].fx });
  for (const s of factionFx(cv)) out.push(s);
  if (cv.god && GODS[cv.god]) out.push({ name: `Skytsgud: ${GODS[cv.god].name}`, fx: GODS[cv.god].fx });
  return out;
}
function wondersOf(cid) { return Object.values(G.wonders).filter(id => { const c = cityById(id); return c && c.civ === cid; }).length; }
function addBoon(cv, name, fx, turns) { cv.boons.push({ name, fx, until: turns ? G.turn + Math.round(turns * paceK()) : 0 }); }

// ---------- Profetier ----------
const PROPHECIES = {
  wonders: { turns: 45, text: () => 'To vidundere skal rejses i dit rige.', base: (cv) => wondersOf(cv.id), done: (cv, p) => wondersOf(cv.id) - p.base >= 2 },
  cities: { turns: 35, text: () => 'Dit rige skal vokse med tre byer.', base: (cv) => civCities(cv.id).length, done: (cv, p) => civCities(cv.id).length - p.base >= 3 },
  hero: { turns: 40, text: () => 'En helt skal rejse sig blandt dine krigere.', base: (cv) => cv.stats.heroes, done: (cv, p) => cv.stats.heroes > p.base },
  techs: { turns: 35, text: () => 'Dine lærde skal gøre fire opdagelser.', base: (cv) => cv.techs.length, done: (cv, p) => cv.techs.length - p.base >= 4 },
  peace: { turns: 30, text: () => 'Ingen krig må føres mod eller af dit folk.', cond: (cv) => !warWithMajor(cv.id), base: () => 0, done: (cv, p) => G.turn >= p.until, fail: (cv) => warWithMajor(cv.id) },
  conquest: { turns: 40, text: () => 'En fremmed by skal falde for dine hære.', base: (cv) => cv.stats.captured, done: (cv, p) => cv.stats.captured > p.base },
  golden: { turns: 45, text: () => 'En guldalder skal oprinde over dit folk.', cond: (cv) => !inGoldenAge(cv), base: (cv) => cv.ga.count || 0, done: (cv, p) => (cv.ga.count || 0) > p.base },
  treasure: { turns: 30, text: (p) => `Din statskasse skal rumme ${p.amt} guld.`, amt: (cv) => Math.round((300 + eraOf(cv) * 150) / 50) * 50, base: () => 0, done: (cv, p) => cv.gold >= p.amt },
  metropolis: { turns: 35, text: (p) => `En af dine byer skal nå ${p.amt} indbyggere.`, amt: (cv) => Math.max(...civCities(cv.id).map(c => c.pop), 3) + 3, base: () => 0, done: (cv, p) => civCities(cv.id).some(c => c.pop >= p.amt) },
  legend: { turns: 50, text: () => 'Dit folk skal finde et af verdens sagnsteder.', cond: () => Object.values(G.legends || {}).some(l => l.found == null), base: (cv) => cv.legends.length, done: (cv, p) => cv.legends.length > p.base },
};
const BOONS = {
  gp: { name: 'En stor personlighed', give: (cv) => { const cap = capitalOf(cv.id); if (!cap) return null; const ut = GP_TYPES[pick(Object.keys(GP_TYPES))]; createUnit(cv.id, ut, cap.x, cap.y); return `en stor personlighed (${UNITS[ut].name.toLowerCase()}) i ${cap.name}`; } },
  golden: { name: 'En guldalder', give: (cv) => { startGoldenAge(cv, 'Profetien gik i opfyldelse.'); return 'en guldalder'; } },
  tech: { name: 'En gratis teknologi', give: (cv) => { const o = Object.keys(TECHS).filter(k => canResearch(cv, k)); if (!o.length) { cv.gold += 200; return '200 guld'; } const k = cv.research && o.includes(cv.research) ? cv.research : pick(o); cv.techs.push(k); if (cv.research === k) cv.research = null; return TECHS[k].name; } },
  gold: { name: 'En skat af guld', give: (cv) => { const g = 150 + eraOf(cv) * 100; cv.gold += g; return `${g} guld`; } },
  blessing: { name: 'Gudernes velsignelse (+1 tilfredshed i alle byer i 40 ture)', give: (cv) => { addBoon(cv, 'Gudernes velsignelse', { happy: 1 }, 40); return 'gudernes velsignelse'; } },
  war: { name: 'Krigsgudens gunst (+15 % styrke i 30 ture)', give: (cv) => { addBoon(cv, 'Krigsgudens gunst', { str: 0.15 }, 30); return 'krigsgudens gunst'; } },
};
function prophecyOptions(cv) {
  const keys = shuffle(Object.keys(PROPHECIES).filter(k => !PROPHECIES[k].cond || PROPHECIES[k].cond(cv))).slice(0, 3);
  return keys.map(k => { const P = PROPHECIES[k]; const o = { key: k, reward: pick(Object.keys(BOONS)), turns: Math.round(P.turns * paceK()) }; if (P.amt) o.amt = P.amt(cv); return o; });
}
function prophecyText(p) { return PROPHECIES[p.key].text(p); }
function acceptProphecy(cv, o) {
  const P = PROPHECIES[o.key];
  cv.prophecy = { key: o.key, reward: o.reward, amt: o.amt, base: P.base(cv), until: G.turn + o.turns, since: G.turn };
  chron(cv.id, 'prophecy', `Oraklet spåede ${cv.name}: ${prophecyText(o).replace(/\.$/, '')}.`);
}
function offerProphecy(cv) {
  const opts = prophecyOptions(cv);
  if (!opts.length) return;
  if (cv.human) G.offers.push({ type: 'prophecy', from: cv.id, to: cv.id, options: opts });
  else acceptProphecy(cv, pick(opts));
}
function prophecyTurn(cv) {
  const e = eraOf(cv);
  if (!cv.prophecy && (cv.prophEra == null ? G.turn >= 6 : e > cv.prophEra || G.turn >= (cv.prophNext || 0))) { cv.prophEra = e; cv.prophNext = G.turn + Math.round(45 * paceK()); offerProphecy(cv); return; }
  const p = cv.prophecy;
  if (!p) return;
  const P = PROPHECIES[p.key];
  if (P.fail && P.fail(cv)) return failProphecy(cv);
  if (P.done(cv, p)) {
    const what = BOONS[p.reward].give(cv);
    cv.prophecy = null; cv.stats.prophecies = (cv.stats.prophecies || 0) + 1; cv.prophNext = G.turn + Math.round(20 * paceK());
    chron(cv.id, 'prophecy', `Oraklets spådom gik i opfyldelse for ${cv.name}, og guderne gav ${what}.`);
    notify(cv.id, `Profetien er gået i opfyldelse! Guderne giver dig ${what}.`, null, 'good');
    return;
  }
  if (G.turn > p.until) failProphecy(cv);
}
function failProphecy(cv) {
  cv.prophecy = null;
  cv.prophNext = G.turn + Math.round(20 * paceK());
  addBoon(cv, 'Oraklets vrede', { happy: -1 }, 10);
  chron(cv.id, 'prophecy', `${cv.name} opfyldte ikke oraklets spådom, og folket frygtede gudernes vrede.`);
  notify(cv.id, 'Profetien slog fejl. Oraklets vrede giver −1 tilfredshed i alle byer i 10 ture.', null, 'bad');
}

// ---------- Rigets magtfaktioner ----------
const FACTIONS = {
  warriors: { name: 'Krigerne', icon: 'fac_warriors', likes: 'krig, sejre, kaserner og en stor hær', loyal: { fx: { str: 0.1 }, desc: '+10 % styrke' }, angry: { fx: { str: -0.1 }, desc: '−10 % styrke' } },
  merchants: { name: 'Købmændene', icon: 'fac_merchants', likes: 'handelsruter, markeder, aftaler, fred og en fyldt statskasse', loyal: { fx: { gold: 0.1 }, desc: '+10 % guld' }, angry: { fx: { gold: -0.1 }, desc: '−10 % guld' } },
  priests: { name: 'Præsterne', icon: 'fac_priests', likes: 'templer, religion og fromme herskere', loyal: { fx: { faithMul: 0.2, cityCulture: 1 }, desc: '+20 % tro og +1 kultur i hver by' }, angry: { fx: { happy: -1 }, desc: '−1 tilfredshed i alle byer' } },
  farmers: { name: 'Bønderne', icon: 'fac_farmers', likes: 'farme, kornkamre, mætte byer og fred', loyal: { fx: { cityFood: 1 }, desc: '+1 mad i alle byer' }, angry: { fx: { cityFood: -1 }, desc: '−1 mad i alle byer' } },
};
function factionReasons(cv, k) {
  const r = [];
  const cs = civCities(cv.id);
  const n = Math.max(1, cs.length);
  const war = warWithMajor(cv.id);
  const count = (b) => cs.filter(c => c.blds.includes(b)).length;
  const pols = (t) => (cv.policies || []).filter(p => POLICIES[p].tree === t).length;
  if (k === 'warriors') {
    if (war) r.push(['Krig', 12]);
    if (cv.fac.recentKills > 0.5) r.push(['Sejre i felten', Math.min(15, Math.round(cv.fac.recentKills * 3))]);
    if (count('barracks')) r.push(['Kaserner', Math.min(9, count('barracks') * 3)]);
    const mil = civUnits(cv.id).filter(u => isMil(u)).length / n;
    if (mil >= 2) r.push(['Stor hær', 6]); else if (mil < 1) r.push(['For lille hær', -10]);
    const lastWar = Math.max(0, ...majors().filter(o => o.id !== cv.id).map(o => G.warSince[cv.id][o.id] || 0));
    if (!war && G.turn - lastWar > 40 * paceK() && G.turn > 40) r.push(['Lang fred', -10]);
    if (pols('honor')) r.push(['Ære-politikker', pols('honor') * 4]);
    if (cv.ruler && cv.ruler.traits.includes('kriger')) r.push(['Krigerisk hersker', 6]);
  } else if (k === 'merchants') {
    const routes = G.routes.filter(x => { const a = cityById(x.a); return a && a.civ === cv.id; }).length;
    if (routes) r.push(['Handelsruter', Math.min(16, routes * 4)]);
    const mk = count('market') + count('bank');
    if (mk) r.push(['Markeder og banker', Math.min(10, mk * 2)]);
    if (cv.gold > 300) r.push(['Fyldt statskasse', 6]); else if (cv.gold < 30) r.push(['Tom statskasse', -8]);
    if (war) r.push(['Krig skader handlen', -10]);
    const ob = majors().filter(o => o.id !== cv.id && hasOB(cv.id, o.id)).length;
    if (ob) r.push(['Åbne grænser', Math.min(9, ob * 3)]);
    if (pols('commerce')) r.push(['Handels-politikker', pols('commerce') * 4]);
    if (cv.ruler && cv.ruler.traits.includes('kobmand')) r.push(['Købmand på tronen', 6]);
  } else if (k === 'priests') {
    const t = count('shrine') + count('temple') + count('cathedral');
    if (t) r.push(['Helligdomme og templer', Math.min(14, t * 2)]);
    if (civReligion(cv.id)) r.push(['Egen religion', 10]);
    const cap = capitalOf(cv.id);
    if (cap && cap.rel) r.push(['Hovedstaden har en tro', 4]);
    if (pols('piety')) r.push(['Fromheds-politikker', pols('piety') * 4]);
    if (pols('rationalism')) r.push(['Rationalisme', -pols('rationalism') * 5]);
    if (cv.ruler && cv.ruler.traits.includes('from')) r.push(['From hersker', 8]);
    if (cv.ruler && cv.ruler.traits.includes('grusom')) r.push(['Grusom hersker', -6]);
  } else if (k === 'farmers') {
    const farms = cs.reduce((a, c) => a + c.worked.filter(j => G.tiles[j].imp === 'farm').length, 0);
    if (farms) r.push(['Farme', Math.min(12, farms)]);
    if (count('granary')) r.push(['Kornkamre', Math.min(8, count('granary') * 2)]);
    const starving = cs.filter(c => cityYields(c).foodNet < 0).length;
    if (starving) r.push(['Sultne byer', -Math.min(16, starving * 4)]);
    if (G.crisis && crisisHits(cv.id) && ['winter', 'locust', 'plague'].includes(G.crisis.key)) r.push(['Verdenskrisen', -10]);
    if (war) r.push(['Udskrivning til hæren', -6]);
    const unh = cs.reduce((a, c) => a + (c.unhappy || 0), 0);
    if (unh) r.push(['Utilfredse borgere', -Math.min(16, unh * 2)]);
    if (cv.ruler && cv.ruler.traits.includes('elsket')) r.push(['Elsket hersker', 6]);
  }
  return r;
}
function factionTarget(cv, k) { return clamp(50 + factionReasons(cv, k).reduce((a, x) => a + x[1], 0), 0, 100); }
function factionMood(v) { return v >= 70 ? 'loyal' : v <= 30 ? 'angry' : 'calm'; }
function factionFx(cv) {
  const out = [];
  if (!cv.fac) return out;
  for (const k in FACTIONS) {
    const m = factionMood(cv.fac.l[k]);
    if (m === 'loyal') out.push({ name: `Loyale ${FACTIONS[k].name.toLowerCase()}`, fx: FACTIONS[k].loyal.fx });
    if (m === 'angry') out.push({ name: `Utilfredse ${FACTIONS[k].name.toLowerCase()}`, fx: FACTIONS[k].angry.fx });
  }
  return out;
}
function factionTurn(cv) {
  const f = cv.fac;
  const kills = cv.stats.kills - (f.killsSeen || 0);
  f.killsSeen = cv.stats.kills;
  f.recentKills = f.recentKills * 0.9 + kills;
  for (const k in FACTIONS) {
    const before = factionMood(f.l[k]);
    f.l[k] = Math.round((f.l[k] + (factionTarget(cv, k) - f.l[k]) * 0.12) * 10) / 10;
    const after = factionMood(f.l[k]);
    if (before !== after && cv.human) {
      if (after === 'loyal') notify(cv.id, `${FACTIONS[k].name} er loyale: ${FACTIONS[k].loyal.desc}.`, null, 'good');
      else if (after === 'angry') notify(cv.id, `${FACTIONS[k].name} er utilfredse: ${FACTIONS[k].angry.desc}. De ønsker ${FACTIONS[k].likes}.`, null, 'warn');
    }
    if (f.l[k] <= 15 && (f.cool[k] || 0) < G.turn && capitalOf(cv.id)) {
      f.cool[k] = G.turn + Math.round(20 * paceK());
      const cap = capitalOf(cv.id);
      if (cv.human) G.offers.push({ type: 'event', from: cv.id, to: cv.id, key: 'fac_' + k, city: cap.id });
      else { const ch = eventChoices(EVENTS['fac_' + k], cv, cap).filter(x => x.ok); EVENTS['fac_' + k].choices[ch[0].n].go(cv, cap); }
    }
  }
}
function facAdd(cv, k, v) { cv.fac.l[k] = clamp(cv.fac.l[k] + v, 0, 100); }

Object.assign(EVENTS, {
  fac_warriors: { title: 'Kupforsøg', icon: 'fac_warriors', cond: () => false,
    text: (cv) => `Krigerne er trætte af ${rulerName(cv)} og mumler om et nyt styre.`,
    choices: [
      { label: () => 'Giv hæren sold (100 guld)', ok: (cv) => cv.gold >= 100, go: (cv) => { cv.gold -= 100; facAdd(cv, 'warriors', 35); return 'Hæren er blevet betalt og bliver på sin post.'; } },
      { label: () => 'Slå kuppet ned (du mister en enhed, uro i hovedstaden)', go: (cv, c) => { const u = civUnits(cv.id).filter(isMil).sort((a, b) => UNITS[b.type].str - UNITS[a.type].str)[0]; if (u) killUnit(u); c.unrest = 3; c.unrestWhy = 'Kupforsøg'; cv.fac.l.warriors = 35; return 'Kuppet blev slået ned, men det kostede.'; } },
      { label: () => 'Giv efter (krigerne vælger en ny hersker)', go: (cv) => { const h = heirsFor(cv).find(x => x.traits.includes('kriger')) || { base: pick(RULER_NAMES[cv.key] || ['Hærføreren']), traits: ['kriger', 'grusom'] }; if (!h.traits.includes('kriger')) h.traits[0] = 'kriger'; crown(cv, h, 'af hæren'); cv.fac.l.warriors = 65; return `${cv.ruler.name} er sat på tronen af hæren.`; } },
    ] },
  fac_merchants: { title: 'Handelsstrejke', icon: 'fac_merchants', cond: () => false,
    text: () => 'Købmændene har lukket deres boder og nægter at betale skat.',
    choices: [
      { label: () => 'Køb dem tilbage (120 guld)', ok: (cv) => cv.gold >= 120, go: (cv) => { cv.gold -= 120; facAdd(cv, 'merchants', 35); return 'Boderne er åbne igen.'; } },
      { label: () => 'Sænk skatterne (−20 % guld i 10 ture)', go: (cv) => { addBoon(cv, 'Lavere skatter', { gold: -0.2 }, 10); facAdd(cv, 'merchants', 40); return 'Købmændene jubler over de lave skatter.'; } },
      { label: () => 'Ignorer dem (−25 % guld i 10 ture)', go: (cv) => { addBoon(cv, 'Handelsstrejke', { gold: -0.25 }, 10); facAdd(cv, 'merchants', 10); return 'Strejken trækker ud.'; } },
    ] },
  fac_priests: { title: 'Kætteri', icon: 'fac_priests', cond: () => false,
    text: () => 'Præsterne prædiker mod hoffet og kalder herskeren gudløs.',
    choices: [
      { label: () => 'Giv templerne en gave (80 tro eller 80 guld)', ok: (cv) => cv.faith >= 80 || cv.gold >= 80, go: (cv) => { if (cv.faith >= 80) cv.faith -= 80; else cv.gold -= 80; facAdd(cv, 'priests', 35); return 'Præsterne velsigner igen hoffet.'; } },
      { label: () => 'Giv dem indflydelse (−10 % forskning i 15 ture)', go: (cv) => { addBoon(cv, 'Præsternes magt', { sci: -0.1 }, 15); facAdd(cv, 'priests', 40); return 'Præsterne har fået sæde i rådet.'; } },
      { label: () => 'Tving dem til tavshed (uro i hovedstaden)', go: (cv, c) => { c.unrest = 4; c.unrestWhy = 'Kætteri'; cv.fac.l.priests = 30; return 'Præsterne er tavse, men folket er uroligt.'; } },
    ] },
  fac_farmers: { title: 'Bondeoprør', icon: 'fac_farmers', cond: () => false,
    text: () => 'Bønderne har grebet høtyvene og marcherer mod hovedstaden.',
    choices: [
      { label: () => 'Eftergiv skatten (80 guld)', ok: (cv) => cv.gold >= 80, go: (cv) => { cv.gold -= 80; facAdd(cv, 'farmers', 35); return 'Bønderne er vendt hjem til markerne.'; } },
      { label: () => 'Send hæren (oprørerne angriber)', go: (cv, c) => { let n = 0; for (const j of neighbors(c.x, c.y)) { if (n >= 2) break; if (landPassable(j) && !unitsAt(j).length && !cityAt(j)) { const [x, y] = xy(j); createUnit(G.barb, barbUnitType(), x, y); n++; } } cv.fac.l.farmers = 30; return `${n} flokke af oprørere står uden for ${c.name}.`; } },
      { label: () => 'Del kornlagrene ud (hovedstaden mister sin mad)', go: (cv, c) => { c.food = 0; facAdd(cv, 'farmers', 30); return `Kornet fra ${c.name} er delt ud.`; } },
    ] },
});

// ---------- Sagnsteder, rygter og togter ----------
const LEGENDS = {
  atlantis: { name: 'Atlantis', on: ['ocean'], icon: 'leg_atlantis', desc: 'Den sunkne by giver to gratis teknologier.', sea: true, give: (cv) => { const got = []; for (let n = 0; n < 2; n++) { const o = Object.keys(TECHS).filter(k => canResearch(cv, k)); if (!o.length) break; const k = pick(o); cv.techs.push(k); if (cv.research === k) cv.research = null; got.push(TECHS[k].name); } return got.length ? got.join(' og ') : 'gamle skrifter'; } },
  eldorado: { name: 'El Dorado', on: ['jungle', 'forest'], icon: 'leg_eldorado', desc: 'Den gyldne by giver 400 guld.', give: (cv) => { cv.gold += 400; return '400 guld'; } },
  valhalla: { name: 'Valhallas Port', on: ['tundra', 'snow'], icon: 'leg_valhalla', desc: '+10 % styrke til alle dine enheder for altid.', fx: { str: 0.1 } },
  avalon: { name: 'Avalon', on: ['coast'], icon: 'leg_avalon', desc: '+1 tilfredshed i alle dine byer for altid.', sea: true, fx: { happy: 1 } },
  shangrila: { name: 'Shangri-La', on: ['hills'], icon: 'leg_shangrila', desc: '+2 forskning i hver by for altid.', fx: { citySci: 2 } },
  yggdrasil: { name: 'Yggdrasil', on: ['forest', 'grass'], icon: 'leg_yggdrasil', desc: '+1 tro og +1 kultur i hver by for altid.', fx: { cityFaith: 1, cityCulture: 1 } },
};
const DIRS = ['øst', 'nordøst', 'nord', 'nordvest', 'vest', 'sydvest', 'syd', 'sydøst'];
function placeLegends(starts) {
  G.legends = {};
  const far = (i, d) => starts.every(s => s == null || distI(s, i) >= d);
  for (const k of shuffle(Object.keys(LEGENDS))) {
    const L = LEGENDS[k];
    for (let tries = 0; tries < 600; tries++) {
      const i = Math.floor(Math.random() * G.tiles.length);
      const t = G.tiles[i];
      if (!L.on.includes(t.t) || t.nat || t.res || t.ruin || t.legend || t.owner >= 0) continue;
      if (k === 'shangrila' && !neighborsI(i).some(j => G.tiles[j].t === 'mountain')) continue;
      if (k === 'avalon' && !neighborsI(i).some(j => !isWater(j))) continue;
      if (!far(i, tries < 400 ? 9 : 6)) continue;
      if (Object.values(G.legends).some(l => distI(l.i, i) < 8)) continue;
      t.legend = k;
      G.legends[k] = { i, found: null };
      break;
    }
  }
}
function dirTo(from, to) {
  const [x1, y1] = xy(from), [x2, y2] = xy(to);
  let dx = x2 - x1;
  if (dx > G.w / 2) dx -= G.w; if (dx < -G.w / 2) dx += G.w;
  const a = Math.atan2(-(y2 - y1) * 0.87, dx);
  return DIRS[(Math.round(a / (Math.PI / 4)) + 8) % 8];
}
function distWord(d) { return d < 12 ? 'ikke langt' : d < 25 ? 'langt' : 'meget langt'; }
function spreadRumor(cv) {
  const cap = capitalOf(cv.id);
  if (!cap) return;
  const open = Object.keys(G.legends || {}).filter(k => G.legends[k].found == null && !cv.rumors[k]);
  if (!open.length) return;
  const k = pick(open), L = G.legends[k];
  const ci = idx(cap.x, cap.y);
  const area = pick(tilesInRadius(...xy(L.i), 3));
  cv.rumors[k] = { turn: G.turn, area };
  if (cv.human) notify(cv.id, `Rygter fortæller om ${LEGENDS[k].name} ${distWord(distI(ci, L.i))} mod ${dirTo(ci, L.i)}. Søgeområdet er vist på kortet.`, area, 'info');
}
function discoverLegend(cid, k, how) {
  const L = G.legends && G.legends[k];
  const cv = civ(cid);
  if (!L || L.found != null || !isMajor(cv)) return false;
  L.found = cid; L.turn = G.turn;
  cv.legends.push(k);
  const D = LEGENDS[k];
  const what = D.give ? D.give(cv) : D.desc.replace(/\.$/, '').toLowerCase();
  chron(cid, 'legend', `${cv.name} fandt ${D.name}${how ? ` ${how}` : ''}, og skjaldene kvad om det i mange år.`);
  notify(-1, `${cv.name} har fundet sagnstedet ${D.name}!`, L.i, cv.human ? 'good' : 'info');
  if (cv.human) notify(cid, `${D.name}: ${D.desc}${D.give ? ` Du fik ${what}.` : ''}`, L.i, 'good');
  for (const o of majors()) if (o.id !== cid && o.exp && o.exp.key === k) { notify(o.id, `Din ekspedition kom for sent: ${cv.name} har allerede fundet ${D.name}. Den vender hjem med 60 guld.`, null, 'warn'); o.gold += 60; o.exp = null; }
  return true;
}
function expeditionCost(cv, k) {
  const cap = capitalOf(cv.id);
  if (!cap) return Infinity;
  return Math.round((50 + distI(idx(cap.x, cap.y), G.legends[k].i) * 4) / 10) * 10;
}
function expeditionOk(cv, k) {
  if (cv.exp || !cv.rumors[k] || G.legends[k].found != null) return false;
  if (LEGENDS[k].sea && !cv.techs.includes('sailing')) return false;
  return cv.gold >= expeditionCost(cv, k);
}
function sendExpedition(cv, k) {
  if (!expeditionOk(cv, k)) return false;
  const cap = capitalOf(cv.id);
  const d = distI(idx(cap.x, cap.y), G.legends[k].i);
  cv.gold -= expeditionCost(cv, k);
  const total = Math.max(3, Math.ceil(d / 5) + 2);
  cv.exp = { key: k, left: total, total, risk: 0.3, home: cap.id, asked: false };
  chron(cv.id, 'legend', `${cv.name} sendte et togt af sted for at finde ${LEGENDS[k].name}.`);
  return true;
}
function expeditionTurn(cv) {
  const e = cv.exp;
  if (!e) return;
  if (G.legends[e.key].found != null) { cv.exp = null; return; }
  e.left--;
  if (!e.asked && e.left <= Math.floor(e.total / 2)) {
    e.asked = true;
    const key = pick(['exp_storm', 'exp_natives', 'exp_mutiny']);
    const home = cityById(e.home) || capitalOf(cv.id);
    if (home) {
      if (cv.human) G.offers.push({ type: 'event', from: cv.id, to: cv.id, key, city: home.id });
      else { const ch = eventChoices(EVENTS[key], cv, home).filter(x => x.ok); EVENTS[key].choices[pick(ch).n].go(cv, home); }
    }
  }
  if (!cv.exp || e.left > 0) return;
  cv.exp = null;
  if (Math.random() > e.risk) discoverLegend(cv.id, e.key, 'med et togt');
  else {
    chron(cv.id, 'legend', `Togtet mod ${LEGENDS[e.key].name} vendte aldrig hjem.`);
    notify(cv.id, `Togtet mod ${LEGENDS[e.key].name} er forsvundet sporløst.`, null, 'bad');
  }
}
Object.assign(EVENTS, {
  exp_storm: { title: 'Storm på togtet', icon: 'ev_flood', cond: () => false,
    text: (cv) => `Dit togt mod ${LEGENDS[cv.exp.key].name} er ramt af en voldsom storm.`,
    choices: [
      { label: () => 'Søg i læ (togtet tager 2 ture mere, mindre risiko)', go: (cv) => { cv.exp.left += 2; cv.exp.risk = Math.max(0.05, cv.exp.risk - 0.12); return 'Togtet ventede stormen af.'; } },
      { label: () => 'Fortsæt gennem stormen (større risiko)', go: (cv) => { cv.exp.risk += 0.15; return 'Togtet kæmper sig videre.'; } },
    ] },
  exp_natives: { title: 'Fremmede folk', icon: 'ev_refugees', cond: () => false,
    text: (cv) => `Dit togt mod ${LEGENDS[cv.exp.key].name} har mødt et fremmed folk, der kender egnen.`,
    choices: [
      { label: () => 'Byt gaver med dem (40 guld, meget mindre risiko)', ok: (cv) => cv.gold >= 40, go: (cv) => { cv.gold -= 40; cv.exp.risk = Math.max(0.05, cv.exp.risk - 0.2); return 'De fremmede viser vejen.'; } },
      { label: () => 'Tving dem til at vise vejen (hurtigere, større risiko)', go: (cv) => { cv.exp.left = Math.max(1, cv.exp.left - 1); cv.exp.risk += 0.1; return 'Togtet presser på med tvungne guider.'; } },
      { label: () => 'Gå uden om dem (togtet tager 2 ture mere)', go: (cv) => { cv.exp.left += 2; return 'Togtet tager en omvej.'; } },
    ] },
  exp_mutiny: { title: 'Mytteri', icon: 'ev_rebels', cond: () => false,
    text: (cv) => `Mændene på togtet mod ${LEGENDS[cv.exp.key].name} vil hjem.`,
    choices: [
      { label: () => 'Lov dem en andel af skatten (50 guld)', ok: (cv) => cv.gold >= 50, go: (cv) => { cv.gold -= 50; cv.exp.risk = Math.max(0.05, cv.exp.risk - 0.1); return 'Mændene sejler videre med nyt mod.'; } },
      { label: () => 'Straf anførerne (større risiko)', go: (cv) => { cv.exp.risk += 0.1; return 'Mytteriet er slået ned, men stemningen er dårlig.'; } },
      { label: () => 'Vend om (togtet opgives)', go: (cv) => { cv.exp = null; return 'Togtet er vendt hjem med uforrettet sag.'; } },
    ] },
});
function aiExpedition(cv) {
  if (cv.exp || Math.random() > 0.05) return;
  const k = Object.keys(cv.rumors).find(x => expeditionOk(cv, x) && cv.gold > expeditionCost(cv, x) * 1.6);
  if (k) sendExpedition(cv, k);
}

// ---------- Runesten ----------
const RUNE_MAP = { a: 'ᛅ', b: 'ᛒ', c: 'ᚴ', d: 'ᛏ', e: 'ᛁ', f: 'ᚠ', g: 'ᚴ', h: 'ᚼ', i: 'ᛁ', j: 'ᛁ', k: 'ᚴ', l: 'ᛚ', m: 'ᛘ', n: 'ᚾ', o: 'ᚢ', p: 'ᛒ', q: 'ᚴ', r: 'ᚱ', s: 'ᛋ', t: 'ᛏ', u: 'ᚢ', v: 'ᚢ', w: 'ᚢ', x: 'ᚴᛋ', y: 'ᚢ', z: 'ᛋ', 'æ': 'ᛅ', 'ø': 'ᚢ', 'å': 'ᚬ', 'é': 'ᛁ', 'ö': 'ᚢ', 'ü': 'ᚢ' };
function toRunes(text) {
  return [...String(text).toLowerCase()].map(ch => RUNE_MAP[ch] || (/\s/.test(ch) ? '᛫' : /[.,:;!?]/.test(ch) ? '᛬' : '')).join('').replace(/᛫+/g, '᛫');
}
function runeCost(cv) { return 40 + 20 * civCities(cv.id).filter(c => c.rune).length; }
function canRaiseRune(cv, c) { return c.civ === cv.id && !c.rune && cv.techs.includes('writing') && cv.gold >= runeCost(cv); }
function cleanRuneText(t) { return String(t || '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120); }
function raiseRune(cv, c, text) {
  const tx = cleanRuneText(text);
  if (!tx || !canRaiseRune(cv, c)) return false;
  cv.gold -= runeCost(cv);
  c.rune = { text: tx, turn: G.turn, ruler: rulerName(cv) };
  cv.stats.runes = (cv.stats.runes || 0) + 1;
  chron(cv.id, 'rune', `I ${c.name} rejste ${rulerName(cv)} en runesten: “${tx}”`);
  return true;
}
function runeSuggestion(cv, c) {
  const r = rulerName(cv);
  const last = (G.chron || []).slice().reverse().find(e => e.civ === cv.id && ['hero', 'wonder', 'ruler', 'legend', 'war', 'prophecy'].includes(e.kind));
  const hero = G.units.find(u => u.civ === cv.id && u.hero);
  if (hero && Math.random() < 0.5) return `${r} rejste denne sten efter ${hero.hero}, der vandt ${hero.kills || 0} slag.`;
  if (last && last.kind === 'wonder') return `${r} lod denne sten rejse, da det store værk stod færdigt.`;
  if (cv.dynasty.length) return `${r} rejste denne sten efter ${cv.dynasty[cv.dynasty.length - 1].name}, sin forgænger.`;
  return `${r} rejste denne sten til minde om ${c.name}s folk.`;
}
function aiRunes(cv) {
  if (!cv.techs.includes('writing') || cv.gold < 200 || Math.random() > 0.03) return;
  const c = civCities(cv.id).find(x => !x.rune);
  if (c) raiseRune(cv, c, runeSuggestion(cv, c));
}

// ---------- Tur og tilstand ----------
function folkTurn(cv) {
  if (!isMajor(cv)) return;
  cv.boons = cv.boons.filter(b => !b.until || b.until > G.turn);
  prophecyTurn(cv);
  factionTurn(cv);
  expeditionTurn(cv);
  if (G.turn > 12 && G.turn - (cv.lastRumor || 0) >= Math.round(22 * paceK()) && Math.random() < 0.15) { cv.lastRumor = G.turn; spreadRumor(cv); }
  if (!cv.human) { aiExpedition(cv); aiRunes(cv); }
}
function ensureFolkState() {
  for (const cv of G.civs) {
    if (!isMajor(cv)) continue;
    if (!cv.boons) cv.boons = [];
    if (!cv.legends) cv.legends = [];
    if (!cv.rumors) cv.rumors = {};
    if (cv.prophecy === undefined) cv.prophecy = null;
    if (cv.exp === undefined) cv.exp = null;
    if (!cv.fac) cv.fac = { l: { warriors: 50, merchants: 50, priests: 50, farmers: 50 }, cool: {}, recentKills: 0, killsSeen: cv.stats ? cv.stats.kills : 0 };
  }
  if (!G.legends) placeLegends([...G.cities.map(c => idx(c.x, c.y)), ...G.units.filter(u => u.type === 'settler').map(u => idx(u.x, u.y))]);
  if (G.chronId == null) G.chronId = (G.chron || []).length;
  ensureMythState();
}
