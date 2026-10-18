// Religion, luftkrig, sejrsformer og historik.
'use strict';

function ensureWorldState() {
  if (!G.religions) G.religions = {};
  if (!G.hist) G.hist = [];
  if (!G.humans) G.humans = [G.human];
  if (!G.exploredBy) { G.exploredBy = {}; G.exploredBy[G.human] = G.explored; }
  if (!G.un) G.un = { next: null, last: null };
  for (const c of G.civs) {
    if (c.faith == null) c.faith = 0;
    if (c.cultureTotal == null) c.cultureTotal = 0;
    if (!c.log) c.log = [];
    if (!c.inbox) c.inbox = [];
  }
  for (const c of G.cities) { if (c.rel === undefined) c.rel = null; if (!c.relP) c.relP = {}; }
}

// ---------- Religion ----------
function civReligion(cid) { return Object.keys(G.religions).find(k => G.religions[k].founder === cid) || null; }
function religionCost() { return 60 + 50 * Object.keys(G.religions).length; }
function maxReligions() { return Math.min(Object.keys(RELIGIONS).length, Math.ceil(majors().length / 2) + 1); }
function canFoundReligion(cv) {
  return isMajor(cv) && !civReligion(cv.id) && cv.faith >= religionCost() && Object.keys(G.religions).length < maxReligions() && !!capitalOf(cv.id);
}
function religionSlotsLeft() { return maxReligions() - Object.keys(G.religions).length; }
function freeReligions() { return Object.keys(RELIGIONS).filter(k => !G.religions[k]); }
function foundReligion(cv, key, founderBelief, followerBelief) {
  if (!canFoundReligion(cv) || G.religions[key]) return false;
  const holy = capitalOf(cv.id);
  cv.faith -= religionCost();
  G.religions[key] = { key, founder: cv.id, holy: holy.id, beliefs: [founderBelief, followerBelief], founded: G.turn };
  holy.rel = key; holy.relP[key] = 500;
  notify(-1, `${cv.name} har grundlagt ${RELIGIONS[key].name} med ${holy.name} som hellig by.`, idx(holy.x, holy.y), cv.human ? 'good' : 'info');
  return true;
}
function aiFoundReligion(cv) {
  const key = pick(freeReligions());
  const f = pick(Object.keys(BELIEFS).filter(k => BELIEFS[k].kind === 'founder'));
  const fo = pick(Object.keys(BELIEFS).filter(k => BELIEFS[k].kind === 'follower'));
  foundReligion(cv, key, f, fo);
}
function hasBelief(rel, b) { return !!(rel && G.religions[rel] && G.religions[rel].beliefs.includes(b)); }
function followers(rel) { return G.cities.filter(c => c.rel === rel).length; }
function isHolyCity(c) { return !!(c.rel && G.religions[c.rel] && G.religions[c.rel].holy === c.id); }
function missionaryCost(cv) { return 70 + 15 * eraOf(cv); }
function canBuyMissionary(c) {
  const cv = civ(c.civ);
  const rel = civReligion(c.civ);
  return !!(rel && c.rel === rel && cv.faith >= missionaryCost(cv));
}
function buyMissionary(c) {
  const cv = civ(c.civ);
  if (!canBuyMissionary(c)) return null;
  cv.faith -= missionaryCost(cv);
  const u = createUnit(c.civ, 'missionary', c.x, c.y);
  u.charges = 2; u.rel = civReligion(c.civ);
  return u;
}
function spreadTarget(u) {
  if (u.type !== 'missionary' || !u.rel || !G.religions[u.rel]) return null;
  for (const c of G.cities) if (dist(c.x, c.y, u.x, u.y) <= 1 && c.rel !== u.rel && !civ(c.civ).barb && !atWar(u.civ, c.civ)) return c;
  return null;
}
function spreadReligion(u) {
  const c = spreadTarget(u);
  if (!c) return false;
  for (const k in c.relP) c.relP[k] = Math.max(0, c.relP[k] - 40);
  c.relP[u.rel] = (c.relP[u.rel] || 0) + 130;
  updateCityReligion(c);
  u.charges = (u.charges || 1) - 1;
  u.moves = 0;
  notify(u.civ, `Missionæren har prædiket ${RELIGIONS[u.rel].name} i ${c.name}.`, idx(c.x, c.y), 'good');
  if (c.civ !== u.civ) notify(c.civ, `Missionærer fra ${civ(u.civ).name} prædiker ${RELIGIONS[u.rel].name} i ${c.name}.`, idx(c.x, c.y), 'info');
  if (u.charges <= 0) killUnit(u);
  return true;
}
function updateCityReligion(c) {
  let best = c.rel, bv = c.rel ? (c.relP[c.rel] || 0) : 0;
  for (const k in c.relP) if (c.relP[k] > bv * 1.1 && c.relP[k] >= 50) { best = k; bv = c.relP[k]; }
  for (const k in G.religions) if (G.religions[k].holy === c.id) best = k;
  if (best !== c.rel) {
    const old = c.rel;
    c.rel = best;
    if (civ(c.civ).human) notify(c.civ, `${c.name} følger nu ${RELIGIONS[best].name}${old ? ` i stedet for ${RELIGIONS[old].name}` : ''}.`, idx(c.x, c.y), 'info');
  }
}
function processReligion() {
  const keys = Object.keys(G.religions);
  if (!keys.length) return;
  for (const c of G.cities) {
    if (civ(c.civ).barb) continue;
    for (const o of G.cities) {
      if (o === c || !o.rel) continue;
      const d = dist(c.x, c.y, o.x, o.y);
      if (d > 9) continue;
      let p = isHolyCity(o) ? 5 : 1 + (o.pop >= 6 ? 1 : 0);
      if (G.routes.some(r => (r.a === c.id && r.b === o.id) || (r.a === o.id && r.b === c.id))) p += 2;
      c.relP[o.rel] = Math.min(400, (c.relP[o.rel] || 0) + p);
    }
    updateCityReligion(c);
  }
}
// Religionens effekt på en by: { f, p (andel), sci, gold, faith, culture, happy, def }
function religionEffects(c) {
  const e = { f: 0, pm: 0, sci: 0, gold: 0, faith: 0, culture: 0, happy: 0, def: 0 };
  const r = c.rel;
  if (!r || !G.religions[r]) return e;
  e.happy += 1;
  if (hasBelief(r, 'monastery')) e.sci += 2;
  if (hasBelief(r, 'feasts')) e.happy += 1;
  if (hasBelief(r, 'fields')) e.f += 1;
  if (hasBelief(r, 'guilds')) e.pm += 0.1;
  if (hasBelief(r, 'peace')) e.def += 0.2;
  if (hasBelief(r, 'charity')) e.gold += 2;
  if (isHolyCity(c)) {
    const n = followers(r);
    if (hasBelief(r, 'tithe')) e.gold += n;
    if (hasBelief(r, 'pilgrim')) e.faith += n;
    if (hasBelief(r, 'council')) e.culture += Math.floor(n / 2);
  }
  return e;
}
function cityFaith(c) {
  let f = 0;
  for (const b of c.blds) f += BUILDINGS[b].faith || 0;
  for (const k in G.wonders) if (G.wonders[k] === c.id && WONDERS[k].faith) f += WONDERS[k].faith;
  for (const j of cityWorkable(c)) { const n = G.tiles[j].nat; if (n && NATURAL[n].faith) f += NATURAL[n].faith; }
  return f + religionEffects(c).faith;
}

// AI og religion
function aiReligion(cv) {
  if (canFoundReligion(cv)) aiFoundReligion(cv);
  const rel = civReligion(cv.id);
  if (!rel || cv.faith < missionaryCost(cv)) return;
  const need = G.cities.filter(c => c.rel !== rel && (c.civ === cv.id || (!atWar(cv.id, c.civ) && !civ(c.civ).barb && isMajor(civ(c.civ)))));
  if (!need.length || civUnits(cv.id).filter(u => u.type === 'missionary').length >= 2) return;
  const src = civCities(cv.id).filter(c => c.rel === rel)[0];
  if (src) buyMissionary(src);
}
function aiMissionary(u) {
  if (!u.rel || !G.religions[u.rel]) { killUnit(u); return; }
  if (spreadTarget(u)) { spreadReligion(u); return; }
  let tgt = u.target != null ? cityById(u.target) : null;
  if (!tgt || tgt.rel === u.rel || atWar(u.civ, tgt.civ)) {
    const cands = G.cities.filter(c => c.rel !== u.rel && !civ(c.civ).barb && !atWar(u.civ, c.civ))
      .sort((a, b) => (dist(a.x, a.y, u.x, u.y) - (a.civ === u.civ ? 6 : 0)) - (dist(b.x, b.y, u.x, u.y) - (b.civ === u.civ ? 6 : 0)));
    tgt = cands[0] || null;
    u.target = tgt ? tgt.id : null;
  }
  if (!tgt) return;
  const goal = tgt.civ === u.civ ? idx(tgt.x, tgt.y) : neighbors(tgt.x, tgt.y).filter(j => canEnter(u, j)).sort((a, b) => distI(a, idx(u.x, u.y)) - distI(b, idx(u.x, u.y)))[0];
  if (goal == null) { u.target = null; return; }
  const p = findPath(u, goal);
  if (!p) { u.target = null; return; }
  u.path = p; followPath(u); u.path = null;
  if (G.units.includes(u) && spreadTarget(u)) spreadReligion(u);
}

// ---------- Luftkrig ----------
function isAir(u) { return UNITS[u.type].domain === 'air'; }
function rebaseRange(u, toCity) {
  const base = UNITS[u.type].range * 2;
  return toCity && toCity.blds.includes('airport') && (() => { const here = cityAt(idx(u.x, u.y)); return here && here.blds.includes('airport'); })() ? 999 : base;
}
function rebaseTargets(u) {
  return civCities(u.civ).filter(c => !(c.x === u.x && c.y === u.y) && dist(c.x, c.y, u.x, u.y) <= rebaseRange(u, c));
}
function rebase(u, c) {
  if (!isAir(u) || u.moves <= 0 || !rebaseTargets(u).includes(c)) return false;
  recordAnim({ t: 'move', id: u.id, type: u.type, civ: u.civ, from: idx(u.x, u.y), to: idx(c.x, c.y) });
  u.x = c.x; u.y = c.y; u.moves = 0; u.fort = false;
  if (u.civ === G.human) updateVisibility();
  return true;
}
// Opsnapning: find en fjendtlig jager eller et luftværn, der dækker målfeltet
function interceptor(u, target) {
  const [tx, ty] = xy(target);
  let best = null, bs = 0;
  for (const v of G.units) {
    const V = UNITS[v.type];
    if (!V.intercept || !atWar(u.civ, v.civ) || v.intercepted === G.turn || v.hp < 30) continue;
    if (dist(v.x, v.y, tx, ty) > V.intercept) continue;
    const s = V.str * (0.5 + 0.5 * v.hp / 100);
    if (s > bs) { bs = s; best = v; }
  }
  return best;
}
// Kaldes før et luftangreb; returnerer false hvis flyet blev skudt ned
function airIntercept(u, target) {
  const v = interceptor(u, target);
  if (!v) return true;
  v.intercepted = G.turn;
  const A = UNITS[v.type].str * (0.5 + 0.5 * v.hp / 100);
  const D = UNITS[u.type].str * (0.5 + 0.5 * u.hp / 100) * (1 + promoBonus(u, 'def', { tile: target, vsRanged: true }));
  const d = dmgFor(A / D);
  u.hp -= d;
  recordAnim({ t: 'atk', civ: v.civ, from: idx(v.x, v.y), to: idx(u.x, u.y), dmg: d, back: 0 });
  if (u.hp <= 0) {
    killUnit(u);
    notify(u.civ, `Dit ${UNITS[u.type].name.toLowerCase()} blev skudt ned af ${civ(v.civ).adj} ${UNITS[v.type].name.toLowerCase()}.`, target, 'bad');
    notify(v.civ, `Din ${UNITS[v.type].name.toLowerCase()} skød et ${civ(u.civ).adj} ${UNITS[u.type].name.toLowerCase()} ned.`, idx(v.x, v.y), 'good');
    gainXp(v, 5);
    return false;
  }
  notify(u.civ, `Dit ${UNITS[u.type].name.toLowerCase()} blev ramt af luftforsvar (−${d} liv).`, target, 'warn');
  return true;
}
function aiAir(u, cv) {
  if (u.moves <= 0) return;
  if (u.hp < 50) { u.fort = true; return; }
  if (tryAttacks(u)) return;
  const enemies = G.civs.filter(o => o.alive && atWar(cv.id, o.id) && !o.barb).map(o => o.id);
  if (!enemies.length) { u.fort = true; return; }
  let best = null, bd = Infinity;
  for (const c of rebaseTargets(u)) {
    let d = Infinity;
    for (const e of G.cities) if (enemies.includes(e.civ)) d = Math.min(d, dist(c.x, c.y, e.x, e.y));
    if (d < bd) { bd = d; best = c; }
  }
  const here = cityAt(idx(u.x, u.y));
  let hd = Infinity;
  if (here) for (const e of G.cities) if (enemies.includes(e.civ)) hd = Math.min(hd, dist(here.x, here.y, e.x, e.y));
  if (best && bd + 2 < hd) rebase(u, best);
  else u.fort = true;
}

// ---------- Sejrsformer ----------
function cultureWonders(cid) { return Object.keys(G.wonders).filter(k => k !== 'un' && civHasWonder(cid, k)).length; }
function cultureProgress(cid) {
  const cv = civ(cid);
  return Math.min(1, cv.cultureTotal / VICTORY.culture) * 0.8 + Math.min(1, cultureWonders(cid) / VICTORY.cultureWonders) * 0.2;
}
function unOwner() { const id = G.wonders.un; if (id == null) return null; const c = cityById(id); return c ? c.civ : null; }
function unCandidates() {
  const own = unOwner();
  if (own == null) return [];
  const rival = majors().filter(c => c.alive && c.id !== own).sort((a, b) => score(b.id) - score(a.id))[0];
  return rival ? [own, rival.id] : [own];
}
// Hvem stemmer voter på?
function unVote(voter, cands) {
  const v = civ(voter);
  if (cands.includes(voter)) return voter;
  if (v.minor) {
    if (v.ally != null && cands.includes(v.ally)) return v.ally;
    return cands.slice().sort((a, b) => (v.inf[b] || 0) - (v.inf[a] || 0))[0];
  }
  if (v.human) {
    const ok = cands.filter(c => !atWar(voter, c));
    return (ok.length ? ok : cands).sort((a, b) => score(a) - score(b))[0];
  }
  return cands.slice().sort((a, b) => attitude(voter, b).score - attitude(voter, a).score)[0];
}
function unForecast() {
  const cands = unCandidates();
  const votes = {}; for (const c of cands) votes[c] = 0;
  const voters = G.civs.filter(c => c.alive && !c.barb);
  for (const v of voters) { const to = unVote(v.id, cands); if (to != null) votes[to]++; }
  return { cands, votes, total: voters.length, need: Math.floor(voters.length / 2) + 1 };
}
function processUN() {
  if (G.wonders.un == null) return;
  if (G.un.next == null) G.un.next = G.turn + VICTORY.unEvery;
  if (G.turn < G.un.next) return;
  G.un.next = G.turn + VICTORY.unEvery;
  const f = unForecast();
  G.un.last = { turn: G.turn, votes: f.votes, total: f.total };
  const txt = f.cands.map(c => `${civ(c).name} ${f.votes[c]}`).join(', ');
  const win = f.cands.find(c => f.votes[c] >= f.need);
  if (win != null) {
    G.over = { winner: win, how: 'diplomati' };
    notify(-1, `De Forenede Nationer har valgt ${civ(win).name} som verdensleder (${txt} af ${f.total} stemmer).`, null, civ(win).human ? 'good' : 'bad');
  } else notify(-1, `Afstemning i De Forenede Nationer: ${txt} af ${f.total} stemmer. Ingen fik flertal (${f.need} krævet).`, null, 'info');
}

// ---------- Historik og demografi ----------
function recordHistory() {
  const ms = majors();
  const row = { t: G.turn, s: [], m: [], k: [], p: [], c: [], u: [] };
  for (const c of ms) {
    const cs = civCities(c.id);
    row.s.push(c.alive ? score(c.id) : 0);
    row.m.push(c.alive ? Math.round(milPower(c.id)) : 0);
    row.k.push(c.techs.length);
    row.p.push(cs.reduce((a, x) => a + x.pop, 0));
    row.c.push(cs.length);
    row.u.push(Math.round(c.cultureTotal || 0));
  }
  G.hist.push(row);
}
function demographics(cid) {
  const ms = majors().filter(c => c.alive);
  const metric = (c) => {
    const cs = civCities(c.id);
    let prod = 0, sci = 0, gold = 0;
    for (const x of cs) { const y = cityYields(x); prod += y.p; sci += y.sci; gold += y.gold; }
    return {
      pop: cs.reduce((a, x) => a + x.pop, 0),
      land: G.tiles.filter(t => t.owner === c.id).length,
      prod, sci: Math.round(sci), gold: Math.round(gold),
      mil: Math.round(milPower(c.id)),
      cul: Math.round(c.cultureTotal || 0),
    };
  };
  const all = ms.map(c => ({ id: c.id, v: metric(c) }));
  const rows = [['pop', 'Befolkning'], ['land', 'Areal'], ['prod', 'Produktion'], ['sci', 'Forskning'], ['gold', 'Guld'], ['mil', 'Militær'], ['cul', 'Kultur i alt']];
  return rows.map(([k, name]) => {
    const vals = all.map(a => a.v[k]).sort((a, b) => b - a);
    const mine = (all.find(a => a.id === cid) || { v: {} }).v[k] || 0;
    return { key: k, name, mine, rank: vals.indexOf(mine) + 1, best: vals[0], avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length), worst: vals[vals.length - 1], n: vals.length };
  });
}
