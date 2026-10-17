// Riget og verden: regeringsformer, erfaring og forfremmelser, ruiner og naturvidundere,
// strategiske ressourcer og diplomatiske relationer.
'use strict';

// Sørg for at ældre gemte spil og nye spil har alle felter
function ensureRealmState() {
  const n = G.civs.length;
  const mat = (v) => Array.from({ length: n }, () => Array.from({ length: n }, () => (typeof v === 'function' ? v() : v)));
  if (!G.ob) G.ob = mat(0);
  if (!G.pact) G.pact = mat(false);
  if (!G.mem) G.mem = mat(() => ({}));
  if (!G.natSeen) G.natSeen = [];
  for (const c of G.civs) { if (!c.gov) c.gov = 'despotism'; if (c.anarchy == null) c.anarchy = 0; }
  for (const u of G.units) { if (u.xp == null) u.xp = 0; if (!u.promos) u.promos = []; }
}

// ---------- Regeringsformer ----------
function gov(cv) { return GOVS[cv.gov] || GOVS.despotism; }
function govsAvailable(cv) { return Object.keys(GOVS).filter(k => !GOVS[k].hidden && hasTech(cv, GOVS[k].tech)); }
function canAdopt(cv, k) { return cv.gov !== k && cv.gov !== 'anarchy' && govsAvailable(cv).includes(k); }
function anarchyTurns(cv) { return isMajor(cv) && civHasWonder(cv.id, 'pyramids') ? 1 : 2; }
function adoptGov(cv, k) {
  if (!canAdopt(cv, k)) return false;
  const turns = anarchyTurns(cv);
  cv.nextGov = k; cv.gov = 'anarchy'; cv.anarchy = turns; cv.govChanged = G.turn;
  notify(cv.id, `Revolution! Efter ${turns} ture med anarki bliver ${GOVS[k].name} indført.`, null, 'warn');
  if (!cv.human && G.met[G.human][cv.id]) notify(G.human, `${cv.name} gennemgår en revolution og skifter til ${GOVS[k].name}.`, null, 'info');
  assignAllTiles();
  return true;
}
function tickGovernment(cv) {
  if (cv.gov !== 'anarchy') return;
  cv.anarchy--;
  if (cv.anarchy <= 0) {
    cv.gov = cv.nextGov || 'despotism'; cv.nextGov = null;
    notify(cv.id, `${GOVS[cv.gov].name} er indført.`, null, 'good');
    assignAllTiles();
  }
}
function warWithMajor(cid) { return majors().some(o => o.alive && o.id !== cid && atWar(cid, o.id)); }

// ---------- Erfaring og forfremmelser ----------
function unitLevel(u) { let l = 0; for (const t of XP_LEVELS) if ((u.xp || 0) >= t) l++; return l; }
function nextXp(u) { return XP_LEVELS.find(t => (u.xp || 0) < t) || null; }
function promoPending(u) { return Math.max(0, unitLevel(u) - (u.promos || []).length); }
function promoOptions(u) {
  const T = UNITS[u.type];
  const have = u.promos || [];
  return Object.keys(PROMOS).filter(k => {
    const P = PROMOS[k];
    if (have.includes(k) || !P.cls.includes(T.cls)) return false;
    if (P.req && !have.includes(P.req)) return false;
    if (P.ranged && !T.ranged) return false;
    return true;
  });
}
function applyPromo(u, k) {
  if (!promoPending(u) || !promoOptions(u).includes(k)) return false;
  u.promos.push(k);
  u.hp = Math.min(100, u.hp + 25);
  return true;
}
function gainXp(u, n, vsBarb) {
  if (!u || !G.units.includes(u) || !isMil(u)) return;
  if (vsBarb && (u.xp || 0) >= 30) return;
  u.xp = (u.xp || 0) + n;
  if (!u.promos) u.promos = [];
  if (promoPending(u)) {
    if (civ(u.civ).human) { if (!u.toldPromo) { u.toldPromo = true; notify(u.civ, `Din ${UNITS[u.type].name.toLowerCase()} kan forfremmes.`, idx(u.x, u.y), 'good'); } }
    else aiPromote(u);
  }
}
const AI_PROMO_ORDER = {
  melee: ['drill1', 'cover', 'shock', 'siege', 'drill2', 'woods', 'medic', 'drill3', 'march'],
  mounted: ['shock', 'mobility', 'drill1', 'siege', 'drill2', 'cover', 'woods', 'drill3'],
  armor: ['shock', 'drill1', 'mobility', 'siege', 'drill2', 'cover', 'drill3'],
  ranged: ['accuracy', 'drill1', 'range', 'cover', 'drill2', 'woods', 'medic', 'drill3'],
  siege: ['accuracy', 'siege', 'range', 'drill1', 'cover', 'drill2', 'drill3'],
  naval: ['accuracy', 'drill1', 'mobility', 'siege', 'range', 'drill2', 'drill3'],
};
function aiPromote(u) {
  while (promoPending(u)) {
    const opts = promoOptions(u);
    if (!opts.length) break;
    const order = AI_PROMO_ORDER[UNITS[u.type].cls] || [];
    applyPromo(u, order.find(k => opts.includes(k)) || opts[0]);
  }
}
function hasPromo(u, k) { return !!(u.promos && u.promos.includes(k)); }
function unitRange(u) { return (UNITS[u.type].range || 1) + (hasPromo(u, 'range') ? 1 : 0); }
const OPEN_TERRAIN = ['grass', 'plains', 'desert', 'tundra', 'snow'];
// ctx: { tile: målfeltet (angreb) eller eget felt (forsvar), vsCity, vsRanged }
function promoBonus(u, role, ctx) {
  const P = u.promos || [];
  if (!P.length || !ctx) return 0;
  let m = 0.15 * P.filter(p => p.startsWith('drill')).length;
  const tt = ctx.tile != null ? G.tiles[ctx.tile] : null;
  if (role !== 'def' && P.includes('shock') && tt && OPEN_TERRAIN.includes(tt.t) && !ctx.vsCity) m += 0.25;
  if (P.includes('woods') && tt && ['forest', 'jungle', 'hills'].includes(tt.t)) m += 0.33;
  if (role === 'def' && P.includes('cover') && ctx.vsRanged) m += 0.33;
  if (role !== 'def' && P.includes('siege') && ctx.vsCity) m += 0.33;
  if (role === 'ranged' && P.includes('accuracy')) m += 0.25;
  return m;
}
function extraHeal(u) {
  let h = 0;
  const i = idx(u.x, u.y);
  if (G.tiles[i].nat === 'fountain') return 100;
  if (G.units.some(v => v.civ === u.civ && hasPromo(v, 'medic') && dist(v.x, v.y, u.x, u.y) <= 1)) h += 10;
  return h;
}

// ---------- Strategiske ressourcer ----------
let STRAT = {};
function resVisible(res, cv) { const R = RESOURCES[res]; return !R || !R.reveal || !!(cv && hasTech(cv, R.reveal)); }
function computeStrat() {
  STRAT = {};
  for (const t of G.tiles) {
    if (t.owner < 0 || !t.res || !RESOURCES[t.res].strat) continue;
    const cv = civ(t.owner);
    if (!resVisible(t.res, cv)) continue;
    const o = STRAT[t.owner] || (STRAT[t.owner] = {});
    o[t.res] = (o[t.res] || 0) + 2;
  }
}
function stratSupply(cid, res) { return (STRAT[cid] && STRAT[cid][res]) || 0; }
function stratUsed(cid, res) { let n = 0; for (const u of G.units) if (u.civ === cid && UNITS[u.type].needs === res) n++; return n; }
function stratAvail(cid, res) { return stratSupply(cid, res) - stratUsed(cid, res); }
function hasStratFor(cid, type, replacing) {
  const need = UNITS[type].needs;
  if (!need) return true;
  if (civ(cid).barb) return true;
  const freed = replacing && UNITS[replacing.type].needs === need ? 1 : 0;
  return stratAvail(cid, need) + freed >= 1;
}
function stratShort(u) { const need = UNITS[u.type].needs; return !!(need && !civ(u.civ).barb && stratAvail(u.civ, need) < 0); }

// ---------- Ruiner og naturvidundere ----------
function placeRuinsAndWonders(starts) {
  const size = MAPSIZES[Object.keys(MAPSIZES).find(k => MAPSIZES[k].w === G.w)] || MAPSIZES.medium;
  const farFromStarts = (i, d) => starts.every(s => s == null || distI(s, i) >= d);
  // naturvidundere
  const keys = shuffle(Object.keys(NATURAL)).slice(0, size.natural || 5);
  for (const k of keys) {
    const N = NATURAL[k];
    for (let tries = 0; tries < 400; tries++) {
      const i = Math.floor(Math.random() * G.tiles.length);
      const t = G.tiles[i];
      if (!N.on.includes(t.t) || t.nat || t.res) continue;
      if (N.river && !t.river) continue;
      if (k === 'reef' && !neighborsI(i).some(j => !isWater(j))) continue;
      const [, y] = xy(i);
      if (y < 2 || y > G.h - 3) continue;
      if (!farFromStarts(i, 4)) continue;
      if (G.tiles.some((o, j) => o.nat && distI(i, j) < 8)) continue;
      t.nat = k;
      break;
    }
  }
  // ruiner
  const n = Math.round(G.w * G.h / 110);
  let placed = 0;
  for (let tries = 0; tries < n * 40 && placed < n; tries++) {
    const i = Math.floor(Math.random() * G.tiles.length);
    const t = G.tiles[i];
    if (!landPassable(i) || t.t === 'snow' || t.nat || t.ruin) continue;
    if (!farFromStarts(i, 4)) continue;
    if (G.tiles.some((o, j) => o.ruin && distI(i, j) < 4)) continue;
    t.ruin = true; placed++;
  }
}

// Sørg for at hvert folk har heste og jern i nærheden af start
function ensureStartResources(starts, nMajor) {
  for (let k = 0; k < nMajor; k++) {
    const s = starts[k]; if (s == null) continue;
    const [sx, sy] = xy(s);
    const area = tilesInRadius(sx, sy, 4).filter(j => j !== s && distI(j, s) >= 2);
    const has = (res) => area.some(j => G.tiles[j].res === res);
    if (!has('horses')) {
      const j = shuffle(area.filter(j => ['plains', 'grass'].includes(G.tiles[j].t) && !G.tiles[j].res && !G.tiles[j].nat))[0];
      if (j != null) G.tiles[j].res = 'horses';
    }
    if (!has('iron')) {
      let j = shuffle(area.filter(j => G.tiles[j].t === 'hills' && !G.tiles[j].res && !G.tiles[j].nat))[0];
      if (j == null) { j = shuffle(area.filter(j => ['plains', 'grass'].includes(G.tiles[j].t) && !G.tiles[j].res && !G.tiles[j].nat && !G.tiles[j].river))[0]; if (j != null) G.tiles[j].t = 'hills'; }
      if (j != null) G.tiles[j].res = 'iron';
    }
  }
  // nok kul og olie i verden
  for (const res of ['coal', 'oil']) {
    const want = Math.round(G.w * G.h / 140);
    let have = G.tiles.filter(t => t.res === res).length;
    for (let tries = 0; tries < 3000 && have < want; tries++) {
      const i = Math.floor(Math.random() * G.tiles.length);
      const t = G.tiles[i];
      if (t.res || t.nat || !RESOURCES[res].on.includes(t.t)) continue;
      t.res = res; have++;
    }
  }
}

const RUIN_UNITS = ['warrior', 'archer', 'spearman', 'horseman'];
function claimRuin(u, i) {
  const t = G.tiles[i];
  t.ruin = false;
  const cv = civ(u.civ);
  const at = i;
  const nearCity = civCities(u.civ).filter(c => dist(c.x, c.y, u.x, u.y) <= 8).sort((a, b) => dist(a.x, a.y, u.x, u.y) - dist(b.x, b.y, u.x, u.y))[0];
  const techs = Object.keys(TECHS).filter(k => canResearch(cv, k) && TECHS[k].era <= 1).sort((a, b) => TECHS[a].cost - TECHS[b].cost);
  const opts = [['gold', 5], ['map', 2], ['unit', 2]];
  if (techs.length && (cv.ruinTechs || 0) < 2) opts.push(['tech', 3]);
  if (isMil(u)) opts.push(['xp', 2]);
  if (nearCity) opts.push(['pop', 2]);
  if (G.turn > 15 && !civCities(u.civ).some(c => dist(c.x, c.y, u.x, u.y) <= 4)) opts.push(['barb', 1]);
  let r = Math.random() * opts.reduce((a, o) => a + o[1], 0), kind = 'gold';
  for (const [k, w] of opts) { r -= w; if (r <= 0) { kind = k; break; } }
  let text = '';
  if (kind === 'gold') { const g = 30 + Math.floor(Math.random() * 50); cv.gold += g; text = `I ruinerne fandt I ${g} guld.`; }
  else if (kind === 'tech') { const k = techs[0]; cv.techs.push(k); cv.ruinTechs = (cv.ruinTechs || 0) + 1; if (cv.research === k) cv.research = null; text = `Gamle skrifter i ruinerne lærte jer ${TECHS[k].name}!`; }
  else if (kind === 'map') {
    if (cv.human) for (const j of tilesInRadius(u.x, u.y, 7)) G.explored[j] = 1;
    text = 'I ruinerne lå et gammelt kort over egnen.';
  } else if (kind === 'unit') {
    const avail = RUIN_UNITS.filter(k => hasTech(cv, UNITS[k].tech) && hasStratFor(cv.id, k));
    const k = avail.length ? avail[avail.length - 1] : 'warrior';
    createUnit(cv.id, k, u.x, u.y).moves = 0;
    text = `En gruppe overlevende slutter sig til jer som ${UNITS[k].name.toLowerCase()}.`;
  } else if (kind === 'xp') { gainXp(u, 15); text = 'Enheden lærte meget af at udforske ruinerne (+15 erfaring).'; }
  else if (kind === 'pop') { nearCity.pop++; text = `Nomader fra ruinerne har slået sig ned i ${nearCity.name} (+1 indbygger).`; }
  else if (kind === 'barb') {
    const spots = neighborsI(i).filter(j => landPassable(j) && !unitsAt(j).length && !cityAt(j));
    for (const j of spots.slice(0, 2)) { const [x, y] = xy(j); createUnit(G.barb, barbUnitType(), x, y).moves = 0; }
    text = 'Ruinerne var et barbarskjul! Barbarer dukker op.';
  }
  notify(cv.id, text, at, kind === 'barb' ? 'bad' : 'good');
  if (cv.human && typeof SFX !== 'undefined') SFX.play(kind === 'barb' ? 'bad' : 'coin');
  if (kind === 'map' || kind === 'unit') updateVisibility();
}

function natAt(i) { const k = G.tiles[i].nat; return k ? NATURAL[k] : null; }
function civNatHappy(cid) {
  const out = [];
  for (const t of G.tiles) if (t.nat && t.owner === cid && NATURAL[t.nat].happy) out.push(NATURAL[t.nat].name);
  return out;
}
function checkNatDiscovery() {
  if (!VIS) return;
  for (let i = 0; i < G.tiles.length; i++) {
    const t = G.tiles[i];
    if (!t.nat || !VIS[i] || G.natSeen.includes(t.nat)) continue;
    G.natSeen.push(t.nat);
    human().gold += 25;
    notify(G.human, `Du har opdaget naturvidunderet ${NATURAL[t.nat].name}! Dine opdagelsesrejsende bringer 25 guld hjem.`, i, 'good');
  }
}

// ---------- Diplomati: holdninger, minder og aftaler ----------
function remember(a, b, key, v, text, cap = 60) {
  if (a === b || !G.mem || !isMajor(civ(a)) || !isMajor(civ(b))) return;
  const m = G.mem[a][b];
  const e = m[key];
  if (e) { e.v = clamp(e.v + v, -cap, cap); e.turn = G.turn; e.text = text; }
  else m[key] = { v: clamp(v, -cap, cap), text, turn: G.turn };
}
function decayMemory() {
  if (G.turn % 2) return;
  for (const row of G.mem) for (const m of row) for (const k in m) {
    const e = m[k];
    e.v += e.v > 0 ? -1 : 1;
    if (Math.abs(e.v) < 1) delete m[k];
  }
}
function hasOB(a, b) { return !!(G.ob && G.ob[a][b] > G.turn); }
function hasPact(a, b) { return !!(G.pact && G.pact[a][b]); }
function commonEnemy(a, b) {
  return majors().find(c => c.alive && c.id !== a && c.id !== b && atWar(a, c.id) && atWar(b, c.id)) || null;
}
// Hvad synes a om b?
function attitude(a, b) {
  const reasons = [];
  if (G.mem && G.mem[a] && G.mem[a][b]) for (const k in G.mem[a][b]) { const e = G.mem[a][b][k]; reasons.push([e.text, Math.round(e.v)]); }
  const A = civ(a), B = civ(b);
  if (atWar(a, b)) reasons.push(['I krig med os', -30]);
  if (hasPact(a, b)) reasons.push(['Forsvarspagt', 15]);
  else if (hasOB(a, b)) reasons.push(['Åbne grænser', 5]);
  const ce = commonEnemy(a, b);
  if (ce) reasons.push([`Fælles fjende: ${ce.name}`, 15]);
  if (A.gov === B.gov && A.gov !== 'despotism' && A.gov !== 'anarchy') reasons.push(['Samme styreform', 6]);
  if (closestCityDist(a, b) <= 5) reasons.push(['Tætte grænser', -10]);
  const routes = G.routes.filter(r => { const x = cityById(r.a), y = cityById(r.b); return x && y && ((x.civ === a && y.civ === b) || (x.civ === b && y.civ === a)); }).length;
  if (routes) reasons.push(['Handelsruter mellem os', Math.min(15, routes * 5)]);
  if (!atWar(a, b) && G.turn > 40 && (!G.warSince[a][b] || G.turn - G.warSince[a][b] > 50)) reasons.push(['Langvarig fred', 8]);
  if (G.turn > 100 && score(b) > score(a) * 1.5) reasons.push(['Misundelse over jeres magt', -10]);
  if (A.aggression > 1.2) reasons.push(['Krigerisk natur', -6]);
  else if (A.aggression < 0.8) reasons.push(['Fredelig natur', 6]);
  const s = clamp(reasons.reduce((x, r) => x + r[1], 0), -100, 100);
  return { score: s, reasons: reasons.filter(r => r[1] !== 0) };
}
function attitudeInfo(s) { return ATTITUDES.find(a => s >= a.min); }

function signOB(a, b, turns = 30) { G.ob[a][b] = G.ob[b][a] = G.turn + turns; }
function cancelOB(a, b) { G.ob[a][b] = G.ob[b][a] = 0; remember(b, a, 'cancel', -10, 'Opsagde en aftale med os'); }
function signPact(a, b) { G.pact[a][b] = G.pact[b][a] = true; signOB(a, b, 30); }
function cancelPact(a, b) { G.pact[a][b] = G.pact[b][a] = false; remember(b, a, 'cancel', -15, 'Opsagde en aftale med os'); }

// Kaldes når a erklærer krig mod b
function onWarDeclared(a, b, viaPact) {
  if (!G.ob) return;
  G.ob[a][b] = G.ob[b][a] = 0;
  if (G.pact[a][b]) { G.pact[a][b] = G.pact[b][a] = false; remember(b, a, 'betray', -30, 'Brød vores forsvarspagt'); }
  if (!isMajor(civ(a)) || !isMajor(civ(b))) {
    if (civ(b).minor) for (const c of majors()) if (c.id !== a && (civ(b).inf[c.id] || 0) >= 30) remember(c.id, a, 'bully', -10, 'Angreb vores venner blandt bystaterne');
    return;
  }
  remember(b, a, 'war', -35, 'Erklærede krig mod os');
  if (viaPact) return;
  for (const c of majors()) {
    if (!c.alive || c.id === a || c.id === b) continue;
    if (hasPact(c.id, b) && !atWar(c.id, a)) {
      remember(c.id, a, 'warfriend', -20, 'Angreb vores allierede');
      declareWar(c.id, a, true, true);
      notify(-1, `${c.name} ærer sin forsvarspagt med ${civ(b).name} og erklærer krig mod ${civ(a).name}.`, null, c.id === G.human || a === G.human ? 'bad' : 'info');
    }
  }
}

// ---------- AI: regering og diplomati ----------
function aiGovernment(cv) {
  if (cv.gov === 'anarchy') return;
  if (cv.govChanged && G.turn - cv.govChanged < 60) return;
  const av = govsAvailable(cv);
  const war = warWithMajor(cv.id);
  const pref = war || cv.aggression > 1.25 ? ['communism', 'monarchy', 'democracy', 'republic', 'despotism'] : ['democracy', 'republic', 'communism', 'monarchy', 'despotism'];
  const ranked = pref.filter(k => av.includes(k));
  // skift kun hvis den nuværende ikke er blandt de to bedste
  if (ranked.length && !ranked.slice(0, 2).includes(cv.gov)) adoptGov(cv, ranked[0]);
}

function aiRelations(cv) {
  const h = human();
  for (const o of majors()) {
    if (!o.alive || o.id === cv.id || !G.met[cv.id][o.id] || atWar(cv.id, o.id)) continue;
    const att = attitude(cv.id, o.id).score;
    if (o.human) {
      if (!hasOB(cv.id, o.id) && att >= 10 && Math.random() < 0.012 && !G.offers.some(f => f.from === cv.id)) G.offers.push({ type: 'ob', from: cv.id });
      else if (!hasPact(cv.id, o.id) && att >= 35 && G.turn > 40 && Math.random() < 0.006 && !G.offers.some(f => f.from === cv.id)) G.offers.push({ type: 'pact', from: cv.id });
      // fælles krig
      const foe = majors().find(e => e.alive && e.id !== h.id && atWar(cv.id, e.id) && !atWar(h.id, e.id) && G.met[h.id][e.id] && !hasPact(h.id, e.id));
      if (foe && att >= 15 && Math.random() < 0.01 && cv.gold >= 60 && !G.offers.some(f => f.from === cv.id)) G.offers.push({ type: 'jointwar', from: cv.id, target: foe.id, gold: Math.min(150, Math.floor(cv.gold * 0.5)) });
      // krav
      const ratio = milPower(cv.id) / (milPower(o.id) + 1);
      if (att <= -15 && ratio > 1.8 && closestCityDist(cv.id, o.id) <= 10 && G.turn > 30 && Math.random() < 0.008 && o.gold >= 60 && !G.offers.some(f => f.from === cv.id)) {
        G.offers.push({ type: 'demand', from: cv.id, gold: Math.round(Math.min(o.gold * 0.5, 80 + eraOf(cv) * 40)) });
      }
    } else if (o.id > cv.id) {
      const back = attitude(o.id, cv.id).score;
      if (!hasOB(cv.id, o.id) && att >= 10 && back >= 10 && Math.random() < 0.02) signOB(cv.id, o.id);
      if (!hasPact(cv.id, o.id) && att >= 25 && back >= 25 && (commonEnemy(cv.id, o.id) || G.turn > 120) && Math.random() < 0.01) signPact(cv.id, o.id);
    }
  }
  // OB udløber stille for AI'er; spilleren får besked i ui
}

// Vil AI'en sige ja til spillerens forslag?
function aiAnswer(ai, kind, p, extra) {
  const att = attitude(ai.id, p.id).score;
  if (atWar(ai.id, p.id)) return { ok: false, why: 'Vi er i krig.' };
  if (kind === 'ob') {
    const planning = ai.ai && ai.ai.target != null && cityById(ai.ai.target) && cityById(ai.ai.target).civ === p.id;
    if (planning) return { ok: false, why: 'Det passer os ikke lige nu.' };
    return att >= 0 ? { ok: true } : { ok: false, why: 'Vi stoler ikke nok på jer.' };
  }
  if (kind === 'pact') {
    if (att >= 30) return { ok: true };
    return { ok: false, why: att >= 10 ? 'Vi kender ikke hinanden godt nok endnu.' : 'Vi stoler ikke nok på jer.' };
  }
  if (kind === 'jointwar') {
    const t = civ(extra.target);
    if (!t || !t.alive || t.id === ai.id) return { ok: false, why: 'Det giver ikke mening.' };
    if (atWar(ai.id, t.id)) return { ok: false, why: `Vi er allerede i krig med ${t.name}.` };
    if (hasPact(ai.id, t.id)) return { ok: false, why: `Vi har en forsvarspagt med ${t.name}.` };
    const toT = attitude(ai.id, t.id).score;
    const need = 24 - Math.floor((extra.gold || 0) / 20) + (toT > 0 ? toT : toT / 2);
    if (att >= need && att >= 10) return { ok: true };
    return { ok: false, why: toT >= 20 ? `Vi er venner med ${t.name}.` : 'Det er ikke prisen værd for os.' };
  }
  return { ok: false, why: '' };
}
