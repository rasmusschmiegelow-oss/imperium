// Det, der gør Imperium til sit eget spil: årstider, dynastier, sagaer og helte, verdenskriser og eftermæle.
'use strict';

// ---------- Årstider og vejr ----------
const SEASONS = [
  { key: 'spring', name: 'Forår', desc: 'Smeltevandet giver +1 mad i alle byer.' },
  { key: 'summer', name: 'Sommer', desc: 'Lange dage. Intet særligt.' },
  { key: 'autumn', name: 'Efterår', desc: 'Høst: +1 mad for hver farm, byen arbejder (højst +3).' },
  { key: 'winter', name: 'Vinter', desc: 'Mindre mad, sne i nord og syd gør marchen tung og kold, og polarhavene fryser til is.' },
];
function seasonIdx(turn) {
  if (G && G.crisis && G.crisis.key === 'winter' && G.crisis.left > 0) return 3;
  return ((turn == null ? G.turn : turn) - 1) % 4;
}
function season() { return SEASONS[seasonIdx()]; }
function isWinter() { return seasonIdx() === 3; }
function tileLat(i) {
  const [x, y] = xy(i);
  if (G.mapType === 'earth') return earthLatLon(x, y, G.w, G.h)[0];
  return 90 - (y + 0.5) * 180 / G.h;
}
function snowAt(i) {
  if (!isWinter()) return false;
  const t = G.tiles[i];
  if (TERRAIN[t.t].water || t.t === 'desert') return false;
  return Math.abs(tileLat(i)) >= 38 || t.t === 'tundra' || t.t === 'mountain';
}
function iceAt(i) {
  if (!isWinter()) return false;
  const t = G.tiles[i];
  if (!TERRAIN[t.t].water) return false;
  const a = Math.abs(tileLat(i));
  return t.t === 'coast' ? a >= 50 : a >= 58;
}
// Justering af en bys mad. net er overskuddet før årstiden. Vinteren sulter aldrig en by ihjel alene.
function seasonFoodAdj(c, net) {
  const s = seasonIdx();
  if (s === 2) return locustAdj(c, net, Math.min(3, c.worked.filter(j => G.tiles[j].imp === 'farm').length));
  if (s === 3) {
    let pen = c.blds.includes('granary') ? 0 : 1;
    if (Math.abs(tileLat(idx(c.x, c.y))) >= 45) pen++;
    if (G.crisis && G.crisis.key === 'winter' && crisisHits(c.civ)) pen++;
    return locustAdj(c, net, -Math.min(pen, Math.max(0, net)));
  }
  return locustAdj(c, net, s === 0 ? 1 : 0);
}
function locustAdj(c, net, adj) {
  if (!(G.crisis && G.crisis.key === 'locust' && crisisHits(c.civ))) return adj;
  return adj - Math.min(2, Math.max(0, net + adj));
}
// Kulde: enheder i sne eller på is uden for eget land mister liv om vinteren
function winterCold(cid) {
  if (!isWinter()) return;
  for (const u of civUnits(cid)) {
    if (isSea(u) || isAir(u)) continue;
    const i = idx(u.x, u.y);
    if (cityAt(i) || G.tiles[i].owner === cid) continue;
    const loss = iceAt(i) ? 10 : snowAt(i) ? 6 : 0;
    if (loss) u.hp = Math.max(15, u.hp - loss);
  }
}

// ---------- Dynasti og arvefølge ----------
const TRAITS = {
  kriger: { name: 'Krigerisk', desc: '+10 % styrke til alle enheder', fx: { str: 0.1 } },
  bygherre: { name: 'Bygherre', desc: '+1 produktion i hver by', fx: { cityProd: 1 } },
  laerd: { name: 'Lærd', desc: '+10 % forskning', fx: { sci: 0.1 } },
  from: { name: 'From', desc: '+1 tro i hver by', fx: { cityFaith: 1 } },
  kobmand: { name: 'Købmand', desc: '+12 % guld', fx: { gold: 0.12 } },
  elsket: { name: 'Elsket', desc: '+1 tilfredshed i hver by', fx: { happy: 1 } },
  kunst: { name: 'Kunstelsker', desc: '+1 kultur i hver by', fx: { cityCulture: 1 } },
  robust: { name: 'Robust', desc: 'Lever længe', fx: {}, life: 14 },
  grusom: { name: 'Grusom', desc: '+10 % styrke, men −1 tilfredshed i hver by', fx: { str: 0.1, happy: -1 }, bad: true },
  odsel: { name: 'Ødsel', desc: '−10 % guld, men +1 kultur i hver by', fx: { gold: -0.1, cityCulture: 1 }, bad: true },
  svag: { name: 'Svag', desc: '−1 produktion i hver by', fx: { cityProd: -1 }, bad: true },
  sygelig: { name: 'Sygelig', desc: 'Lever kort', fx: {}, life: -14, bad: true },
};
const PERS_TRAIT = { erobrer: 'kriger', bygmester: 'bygherre', handelsmand: 'kobmand', videnskab: 'laerd', diplomat: 'elsket', from: 'from' };
const RULER_NAMES = {
  dk: ['Gorm', 'Harald', 'Svend', 'Knud', 'Valdemar', 'Erik', 'Margrete', 'Christoffer', 'Christian', 'Frederik', 'Thyra', 'Dagmar', 'Ingeborg', 'Hans', 'Olav'],
  rome: ['Tiberius', 'Claudius', 'Vespasian', 'Titus', 'Trajan', 'Hadrian', 'Marcus Aurelius', 'Livia', 'Agrippina', 'Konstantin', 'Theodosius', 'Julia', 'Aurelian'],
  egypt: ['Ramses', 'Thutmosis', 'Amenhotep', 'Hatshepsut', 'Nefertiti', 'Ptolemaios', 'Seti', 'Akhenaton', 'Khufu', 'Ahmose', 'Tausret', 'Kleopatra'],
  china: ['Liu Bang', 'Wu', 'Taizong', 'Wu Zetian', 'Yongle', 'Kangxi', 'Qianlong', 'Hongwu', 'Gaozu', 'Wen', 'Jing', 'Zhenzong'],
  aztec: ['Itzcoatl', 'Ahuitzotl', 'Tizoc', 'Axayacatl', 'Cuauhtémoc', 'Cuitláhuac', 'Chimalpopoca', 'Huitzilihuitl', 'Acamapichtli', 'Montezuma'],
  mongol: ['Ögedei', 'Güyük', 'Möngke', 'Kublai', 'Tolui', 'Börte', 'Chabi', 'Mandukhai', 'Dayan', 'Altan', 'Batu', 'Djengis'],
  greece: ['Solon', 'Kleisthenes', 'Leonidas', 'Alexander', 'Filip', 'Aspasia', 'Themistokles', 'Lykurgos', 'Gorgo', 'Pyrrhos', 'Demetrios', 'Perikles'],
};
const ROMAN = ['', '', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X', ' XI', ' XII'];
function rulerLife(traits) {
  let l = 34 + Math.random() * 22;
  for (const t of traits) l += TRAITS[t].life || 0;
  return Math.round(Math.max(12, l) * paceK());
}
function randomTraits(cv, n, first) {
  const goods = Object.keys(TRAITS).filter(k => !TRAITS[k].bad && k !== first);
  const bads = Object.keys(TRAITS).filter(k => TRAITS[k].bad);
  const out = first ? [first] : [];
  while (out.length < n) {
    const pool = Math.random() < 0.3 ? bads : goods;
    const k = pick(pool.filter(x => !out.includes(x)));
    if (k) out.push(k);
  }
  return out;
}
function regnalName(cv, base) {
  const used = (cv.dynasty || []).filter(r => r.base === base).length + (cv.ruler && cv.ruler.base === base ? 1 : 0);
  return base + (ROMAN[used + 1] ?? ` ${used + 1}`);
}
function makeRuler(cv, base, traits) {
  return { base, name: regnalName(cv, base), traits, since: G.turn, life: rulerLife(traits) };
}
function heirsFor(cv) {
  const names = RULER_NAMES[cv.key] || ['Arving'];
  const out = [];
  const taken = new Set();
  for (let k = 0; k < 3; k++) {
    let base = pick(names);
    for (let t = 0; t < 5 && taken.has(base); t++) base = pick(names);
    taken.add(base);
    out.push({ base, traits: randomTraits(cv, 2) });
  }
  return out;
}
function traitFx(cv) {
  const fx = {};
  if (cv && cv.ruler) for (const t of cv.ruler.traits) { const T = TRAITS[t]; if (T) for (const f in T.fx) fx[f] = (fx[f] || 0) + T.fx[f]; }
  if (cv && cv.relic && RELICS[cv.relic] && RELICS[cv.relic].fx) for (const f in RELICS[cv.relic].fx) fx[f] = (fx[f] || 0) + RELICS[cv.relic].fx[f];
  return fx;
}
function crown(cv, heir, note) {
  if (cv.ruler) cv.dynasty.push({ base: cv.ruler.base, name: cv.ruler.name, traits: cv.ruler.traits, from: cv.ruler.since, to: G.turn });
  cv.ruler = makeRuler(cv, heir.base, heir.traits);
  cv.stats.rulers++;
  cv.ga.pts += 40;
  chron(cv.id, 'ruler', `${cv.ruler.name} blev kronet som hersker over ${cv.name}${note ? ` ${note}` : ''}.`);
}
function rulerTurn(cv) {
  if (!cv.ruler) return;
  if (G.turn - cv.ruler.since < cv.ruler.life) return;
  const old = cv.ruler;
  chron(cv.id, 'ruler', `${old.name} af ${cv.name} døde efter ${G.turn - old.since} ture på tronen.`);
  const heirs = heirsFor(cv);
  if (cv.human) {
    crown(cv, heirs[0], 'som den ældste arving');
    notify(cv.id, `${old.name} er død. ${cv.ruler.name} har overtaget tronen. Du kan vælge en anden arving.`, null, 'warn');
    G.offers.push({ type: 'heir', from: cv.id, to: cv.id, old: old.name, heirs });
  } else {
    const best = heirs.slice().sort((a, b) => a.traits.filter(t => TRAITS[t].bad).length - b.traits.filter(t => TRAITS[t].bad).length)[0];
    crown(cv, best);
  }
}
// Spilleren vælger en yngre arving i stedet for den ældste: det giver arvestrid i hovedstaden
function chooseHeir(cv, heir) {
  const prevName = cv.ruler.name;
  cv.ruler = null;
  cv.ruler = makeRuler(cv, heir.base, heir.traits);
  const cap = capitalOf(cv.id);
  if (cap) { cap.unrest = Math.max(cap.unrest || 0, 4); cap.unrestWhy = 'Arvestrid'; }
  chron(cv.id, 'ruler', `Hoffet forbigik ${prevName} og satte ${cv.ruler.name} på tronen. Det gav uro i ${cap ? cap.name : 'hovedstaden'}.`);
}

// ---------- Sagaer, helte og bytilnavne ----------
const EPITHETS = ['Jernhånd', 'den Frygtløse', 'Ulvebane', 'Stormbringer', 'den Kloge', 'Skjoldbryder', 'den Røde', 'Ørneøje', 'Bjørneklo', 'den Ubøjelige', 'Lynsværd', 'den Tavse', 'Blodøkse', 'den Unge', 'Stålhjerte', 'Ravneven'];
function heroName(cv) {
  const names = RULER_NAMES[cv.key] || ['Kriger'];
  return `${pick(names)} ${pick(EPITHETS)}`;
}
function makeHero(u, why) {
  const cv = civ(u.civ);
  u.hero = heroName(cv);
  u.saga = [why || `Blev en helt efter ${u.kills} sejre.`];
  cv.stats.heroes++;
  chron(u.civ, 'hero', `${u.hero}, en ${cv.adj} ${UNITS[u.type].name.toLowerCase()}, blev en helt efter ${u.kills} sejre. Skjaldene begyndte at synge om ${u.hero.split(' ')[0]}.`);
  notify(u.civ, `${u.hero} er blevet en helt! Helte er 20 % stærkere og giver enheder ved siden af +10 % styrke.`, idx(u.x, u.y), 'good');
}
function onKill(winner, loser, i) {
  if (!winner || !isMajor(civ(winner.civ))) return;
  winner.kills = (winner.kills || 0) + 1;
  civ(winner.civ).stats.kills++;
  const where = cityNear(i);
  if (winner.hero) {
    winner.saga.push(`Fældede en ${civ(loser.civ).adj} ${UNITS[loser.type].name.toLowerCase()}${where ? ` ved ${where}` : ''} i ${yearLabel(G.turn)}.`.replace('..', '.'));
    if (winner.saga.length > 7) winner.saga.splice(1, 1);
  } else if (winner.kills >= 3 && isMil(winner) && !isAir(winner)) makeHero(winner);
  if (loser.hero) chron(loser.civ, 'hero', `Sagaen om ${loser.hero} endte${where ? ` ved ${where}` : ''}, hvor helten faldt for en ${civ(winner.civ).adj} ${UNITS[winner.type].name.toLowerCase()}.`);
}
function cityNear(i) {
  let best = null, bd = 5;
  const [x, y] = xy(i);
  for (const c of G.cities) { const d = dist(c.x, c.y, x, y); if (d < bd) { bd = d; best = c; } }
  return best ? best.name : null;
}
function heroStrength(u) {
  let m = u.hero ? 0.2 : 0;
  if (G.units.some(h => h.hero && h !== u && h.civ === u.civ && dist(h.x, h.y, u.x, u.y) <= 1)) m += 0.1;
  return m;
}
function rulerName(cv) { return cv.ruler ? cv.ruler.name : leaderOf(cv).name; }
function cityTitle(c) { return c.epithet ? `${c.name} ${c.epithet}` : c.name; }
function checkEpithets(cid) {
  for (const c of civCities(cid)) {
    if (c.epithet) continue;
    let e = null, why = '';
    const wonders = Object.values(G.wonders).filter(id => id === c.id).length;
    const holy = Object.values(G.religions).some(r => r.holy === c.id);
    if ((c.repelled || 0) >= 3) { e = 'den Uindtagelige'; why = `efter at have slået ${c.repelled} angreb tilbage`; }
    else if (wonders >= 3) { e = 'den Prægtige'; why = `for sine ${wonders} vidundere`; }
    else if (holy && c.pop >= 8) { e = 'den Hellige'; why = 'som troens hellige by'; }
    else if (c.pop >= 16) { e = 'den Store'; why = `med ${c.pop} indbyggere`; }
    else if ((c.captures || 0) >= 2) { e = 'den Omstridte'; why = `efter at have skiftet hersker ${c.captures} gange`; }
    if (!e) continue;
    c.epithet = e;
    civ(cid).stats.epithets++;
    chron(cid, 'city', `${c.name} fik tilnavnet ${e} ${why}.`);
    notify(cid, `${c.name} kaldes nu ${cityTitle(c)}.`, idx(c.x, c.y), 'good');
  }
}

// ---------- Krøniken ----------
function chron(cid, kind, text) {
  if (!G.chron) G.chron = [];
  if (cid >= 0 && !isMajor(civ(cid))) return;
  G.chron.push({ turn: G.turn, civ: cid, kind, text, era: cid >= 0 ? eraOf(civ(cid)) : worldEra() });
  if (G.chron.length > 600) G.chron.splice(0, G.chron.length - 600);
}
function eraTurn(cv) {
  const e = eraOf(cv);
  if (cv.lastEra == null) { cv.lastEra = e; return; }
  if (e > cv.lastEra) { cv.lastEra = e; chron(cv.id, 'era', `${cv.name} trådte ind i ${ERAS[e].toLowerCase()}.`); }
}

// ---------- Verdenskriser ----------
const CRISES = {
  winter: { name: 'Den Store Vinter', icon: 'season_winter', turns: 10, text: 'Asken fra et vulkanudbrud har formørket himlen. Det er vinter overalt, og maden slipper op.', hit: 'Hver tur er vinter, og byer uden fyldte kornlagre mister ekstra mad.' },
  plague: { name: 'Den Sorte Død', icon: 'ev_plague', turns: 10, text: 'En pest breder sig langs handelsvejene og rammer alle folk.', hit: 'Store byer kan miste indbyggere hver tur.' },
  comet: { name: 'Kometen', icon: 'comet', turns: 8, text: 'En lysende komet står på himlen. Folk ser den som et dårligt varsel.', hit: '−2 tilfredshed i alle byer.' },
  flood: { name: 'Stormfloden', icon: 'ev_flood', turns: 8, text: 'Kæmpebølger skyller ind over kysterne.', hit: '−30 % produktion i kystbyer.' },
  locust: { name: 'Græshoppesværmen', icon: 'locust', turns: 8, text: 'Sværme af græshopper æder markerne tomme.', hit: '−2 mad i alle byer, dog aldrig under nul.' },
};
const GENEROSITY = { diplomat: 0.8, from: 0.65, bygmester: 0.5, videnskab: 0.5, handelsmand: 0.4, erobrer: 0.2 };
function crisisShare() { const c = G.crisis; return c ? Math.ceil(c.need / Math.max(1, majors().filter(x => x.alive).length) / 10) * 10 : 0; }
// Rammes dette folk? Den, der har givet sin andel, er beskyttet.
function crisisHits(cid) { const c = G.crisis; return !!(c && c.left > 0 && (c.gave[cid] || 0) < crisisShare()); }
function crisisGive(cv, gold) {
  const c = G.crisis;
  if (!c || c.left <= 0 || cv.gold < gold || gold <= 0) return false;
  cv.gold -= gold;
  c.gave[cv.id] = (c.gave[cv.id] || 0) + gold;
  c.pot += gold;
  cv.stats.crisis += gold;
  if (c.pot >= c.need) endCrisis(true);
  return true;
}
function startCrisis() {
  const key = pick(Object.keys(CRISES));
  const n = majors().filter(x => x.alive).length;
  G.crisis = { key, left: Math.round(CRISES[key].turns * Math.max(1, paceK())), need: Math.round((70 + 55 * worldEra()) * n / 10) * 10, pot: 0, gave: {}, start: G.turn };
  const C = CRISES[key];
  chron(-1, 'crisis', `${C.name} ramte verden. ${C.text}`);
  notify(-1, `Verdenskrise: ${C.name}. ${C.text} Alle folk kan bidrage til en fælles indsats. Den, der giver sin andel (${crisisShare()} guld), er beskyttet.`, null, 'bad');
}
function endCrisis(won) {
  const c = G.crisis, C = CRISES[c.key];
  const share = crisisShare();
  const helpers = majors().filter(x => x.alive && (c.gave[x.id] || 0) >= share);
  const top = majors().filter(x => x.alive && c.gave[x.id]).sort((a, b) => c.gave[b.id] - c.gave[a.id])[0];
  if (won) {
    chron(-1, 'crisis', `${C.name} blev overvundet i fællesskab${top ? `. Mest gav ${top.name}` : ''}.`);
    notify(-1, `${C.name} er overvundet takket være den fælles indsats.${top ? ` ${top.name} gav mest (${c.gave[top.id]} guld).` : ''}`, null, 'good');
  } else {
    chron(-1, 'crisis', `${C.name} ebbede ud efter ${G.turn - c.start} ture.`);
    notify(-1, `${C.name} er forbi.`, null, 'info');
  }
  for (const a of majors()) {
    if (!a.alive) continue;
    for (const b of helpers) if (b.id !== a.id) remember(a.id, b.id, 'crisis', 10, 'Hjalp verden i krisen', 60);
    for (const b of majors()) if (b.alive && b.id !== a.id && !(c.gave[b.id]) && b.gold > share * 2) remember(a.id, b.id, 'crisisfail', -8, 'Svigtede verden i krisen', 50);
  }
  if (top) { top.stats.crisisWins++; top.ga.pts += 120; }
  G.crisis = null;
  G.nextCrisis = G.turn + Math.round((70 + Math.random() * 45) * paceK());
}
function crisisTick() {
  if (G.crisis) {
    const c = G.crisis;
    // computerens bidrag
    const share = crisisShare();
    for (const cv of majors()) {
      if (!cv.alive || cv.human || (c.gave[cv.id] || 0) >= share) continue;
      if (cv.gold >= share * 1.4 && Math.random() < (GENEROSITY[cv.pers] || 0.4)) crisisGive(cv, share);
      if (!G.crisis) return;
    }
    if (c.key === 'plague') for (const ct of G.cities) if (ct.pop >= 5 && crisisHits(ct.civ) && isMajor(civ(ct.civ)) && Math.random() < 0.1) { ct.pop--; notify(ct.civ, `Den Sorte Død har kostet ${ct.name} en indbygger.`, idx(ct.x, ct.y), 'bad'); }
    c.left--;
    if (c.left <= 0) endCrisis(false);
    return;
  }
  if (G.nextCrisis == null) G.nextCrisis = Math.round((55 + Math.random() * 40) * paceK());
  if (G.turn >= G.nextCrisis) startCrisis();
}
function crisisCity(c, r) {
  const cr = G.crisis;
  if (!cr || cr.left <= 0 || !crisisHits(c.civ)) return;
  if (cr.key === 'flood' && cityCoastal(c)) r.pm -= 0.3;
}

// ---------- Eftermæle og arvestykker ----------
const LEGACY_KEY = 'imperium-legacy-v1';
const RELICS = {
  ravne: { name: 'Odins ravne', need: 0, desc: 'Ravnene viser dig landet omkring din startplads.', icon: 'relic_ravens' },
  jelling: { name: 'Jellingstenen', need: 150, desc: '+2 kultur i hovedstaden hele spillet.', icon: 'relic_stone', fx: { capitalCulture: 2 } },
  horn: { name: 'Guldhornene', need: 350, desc: '+80 guld ved start og +1 guld i hver by.', icon: 'relic_horn', fx: { cityGold: 1 } },
  svaerd: { name: 'Arvesværdet', need: 600, desc: 'Din første kriger er en helt fra starten.', icon: 'relic_sword' },
  krone: { name: 'Kongekronen', need: 900, desc: 'Din første hersker har tre gode træk og lever længe.', icon: 'relic_crown' },
  skib: { name: 'Skibssætningen', need: 1300, desc: 'Du starter med Sejlads og Keramik.', icon: 'relic_ship' },
  lur: { name: 'Bronzelurerne', need: 1800, desc: '+1 tilfredshed i alle byer, og du er tæt på din første guldalder.', icon: 'relic_lur', fx: { happy: 1 } },
};
function legacyBook() {
  try { const v = JSON.parse(localStorage.getItem(LEGACY_KEY)); if (v && v.games) return v; } catch (e) { /* intet gemt */ }
  return { total: 0, games: [] };
}
function relicUnlocked(k) { return legacyBook().total >= RELICS[k].need; }
function applyRelic(cv, k) {
  if (!RELICS[k] || !relicUnlocked(k)) return;
  cv.relic = k;
  const us = civUnits(cv.id);
  const st = us.find(u => u.type === 'settler') || us[0];
  if (k === 'ravne' && st) { const ex = G.exploredBy[cv.id]; for (const j of tilesInRadius(st.x, st.y, 7)) ex[j] = 1; }
  if (k === 'horn') cv.gold += 80;
  if (k === 'svaerd') { const w = us.find(u => u.type === 'warrior'); if (w) { w.kills = 0; w.hero = heroName(cv); w.saga = ['Bar Arvesværdet fra fædrenes høj.']; cv.stats.heroes++; } }
  if (k === 'krone' && cv.ruler) { cv.ruler.traits = randomTraits(cv, 3, cv.ruler.traits[0]).map(t => TRAITS[t].bad ? 'robust' : t).filter((t, n, a) => a.indexOf(t) === n); while (cv.ruler.traits.length < 3) cv.ruler.traits.push(pick(['elsket', 'bygherre', 'laerd'].filter(t => !cv.ruler.traits.includes(t)))); cv.ruler.life += Math.round(20 * paceK()); }
  if (k === 'skib') for (const t of ['pottery', 'sailing']) if (!cv.techs.includes(t)) cv.techs.push(t);
  if (k === 'lur') cv.ga.pts = Math.round(goldenNeed(cv) * 0.7);
}
const LEGACY_CATS = {
  war: { name: 'Erobring', calc: (cv) => cv.stats.kills + cv.stats.captured * 15 },
  culture: { name: 'Kultur', calc: (cv) => Math.round((cv.cultureTotal || 0) / 60) + Object.values(G.wonders).filter(id => { const c = cityById(id); return c && c.civ === cv.id; }).length * 20 + (cv.policies || []).length * 4 },
  science: { name: 'Viden', calc: (cv) => cv.techs.length * 4 },
  faith: { name: 'Tro', calc: (cv) => { const r = civReligion(cv.id); return r ? 40 + followers(r) * 3 : 0; } },
  unity: { name: 'Fællesskab', calc: (cv) => Math.round(cv.stats.crisis / 10) + cv.stats.crisisWins * 30 + G.civs.filter(m => m.minor && m.ally === cv.id).length * 15 },
  saga: { name: 'Sagaer', calc: (cv) => cv.stats.heroes * 15 + cv.stats.epithets * 12 },
  dynasty: { name: 'Dynasti', calc: (cv) => cv.stats.rulers * 6 + (cv.ga.count || 0) * 10 },
};
const EPITAPHS = {
  war: (n) => `Her hviler ${n}. Deres sværd gjorde jorden stille.`,
  culture: (n) => `Her hviler ${n}. Deres sange og stene står endnu.`,
  science: (n) => `Her hviler ${n}. De så længere end alle andre.`,
  faith: (n) => `Her hviler ${n}. Deres tro brændte som et fyrtårn.`,
  unity: (n) => `Her hviler ${n}. Da verden frøs, delte de deres brød.`,
  saga: (n) => `Her hviler ${n}. Skjaldene synger stadig om deres helte.`,
  dynasty: (n) => `Her hviler ${n}. Kronen gik i arv i mange slægtled.`,
};
function legacyOf(cv) {
  const cats = {};
  let sum = 0;
  for (const k in LEGACY_CATS) { const v = Math.max(0, Math.round(LEGACY_CATS[k].calc(cv))); cats[k] = v; sum += v; }
  const o = G.over;
  const won = o && o.winner === cv.id;
  const bonus = won ? 200 : cv.alive ? 50 : 0;
  const top = Object.keys(cats).sort((a, b) => cats[b] - cats[a])[0];
  return { cats, bonus, total: sum + bonus, top, epitaph: EPITAPHS[top](cv.name), won };
}
function recordLegacy(cv) {
  if (!G.gameId) G.gameId = Math.random().toString(36).slice(2, 10);
  const L = legacyOf(cv);
  const book = legacyBook();
  const id = G.gameId + ':' + cv.id;
  if (book.games.some(g => g.id === id)) return { L, book, fresh: false };
  const before = book.total;
  book.games.unshift({ id, civ: cv.name, color: cv.color, ruler: cv.ruler ? cv.ruler.name : '', result: L.won ? 'Sejr' : cv.alive ? 'Overlevede' : 'Faldt', turn: G.turn, year: yearLabel(G.turn), score: L.total, epitaph: L.epitaph, date: new Date().toISOString().slice(0, 10) });
  book.games = book.games.slice(0, 40);
  book.total += L.total;
  try { localStorage.setItem(LEGACY_KEY, JSON.stringify(book)); } catch (e) { /* ingen lager */ }
  const unlocked = Object.keys(RELICS).filter(k => RELICS[k].need > before && RELICS[k].need <= book.total);
  return { L, book, fresh: true, unlocked };
}

// ---------- Tur og tilstand ----------
function sagaTurn(cv) {
  if (!isMajor(cv)) return;
  rulerTurn(cv);
  checkEpithets(cv.id);
  eraTurn(cv);
  winterCold(cv.id);
}
function ensureSagaState() {
  if (!G.chron) G.chron = [];
  if (G.crisis === undefined) G.crisis = null;
  if (!G.gameId) G.gameId = Math.random().toString(36).slice(2, 10);
  for (const cv of G.civs) {
    if (!isMajor(cv)) continue;
    if (!cv.stats) cv.stats = { kills: 0, captured: 0, heroes: 0, epithets: 0, crisis: 0, crisisWins: 0, rulers: 0 };
    if (!cv.dynasty) cv.dynasty = [];
    if (!cv.ruler) {
      const L = leaderOf(cv);
      cv.ruler = makeRuler(cv, L.name, randomTraits(cv, 2, PERS_TRAIT[cv.pers] || 'elsket'));
      cv.ruler.name = L.name;
      cv.stats.rulers = 1;
    }
  }
}
