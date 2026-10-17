// Computermodstandere: forskning, produktion, diplomati og enheder. Også bystater og barbarer.
'use strict';

function aiChooseResearch(cv) {
  if (cv.barb) return;
  const opts = Object.keys(TECHS).filter(k => canResearch(cv, k));
  if (!opts.length) { cv.research = null; return; }
  const war = G.civs.some(o => o.alive && !o.barb && atWar(cv.id, o.id));
  const milTechs = new Set(Object.values(UNITS).map(u => u.tech).filter(Boolean));
  let best = null, bs = Infinity;
  for (const k of opts) {
    let s = techCost(cv, k) * (0.7 + Math.random() * 0.6);
    if (war && milTechs.has(k)) s *= 0.7;
    if (k === 'spaceflight' || k === 'rocketry') s *= 0.6;
    if (s < bs) { bs = s; best = k; }
  }
  cv.research = best;
}

function landMilTypes(cv) {
  return Object.keys(UNITS).filter(k => { const U = UNITS[k]; return hasTech(cv, U.tech) && !unitObsolete(cv, k) && U.str > 0 && k !== 'scout' && !U.domain && !U.gp; });
}
function bestUnitFor(cv, role) {
  const avail = landMilTypes(cv);
  if (!avail.length) return 'warrior';
  if (role === 'def') {
    avail.sort((a, b) => (UNITS[b].ranged ? 0 : UNITS[b].str) - (UNITS[a].ranged ? 0 : UNITS[a].str));
    return avail[0];
  }
  const power = k => Math.max(UNITS[k].str, UNITS[k].ranged || 0);
  const r = Math.random();
  const byCls = cls => avail.filter(k => cls.includes(UNITS[k].cls)).sort((a, b) => power(b) - power(a))[0];
  if (r < 0.25) return byCls(['siege']) || byCls(['ranged']) || avail[0];
  if (r < 0.45) return byCls(['ranged']) || avail[0];
  if (r < 0.7) return byCls(['mounted', 'armor']) || byCls(['melee']);
  return byCls(['melee', 'armor']) || avail[0];
}
function bestShip(cv) {
  const s = Object.keys(UNITS).filter(k => UNITS[k].domain === 'sea' && hasTech(cv, UNITS[k].tech) && !unitObsolete(cv, k));
  s.sort((a, b) => Math.max(UNITS[b].str, UNITS[b].ranged || 0) - Math.max(UNITS[a].str, UNITS[a].ranged || 0));
  return s[0] || null;
}

function maxCitiesFor() { return Math.round(G.w * G.h / (majors().length * 100)) + 2; }
function anyWar(cid) { return G.civs.some(o => o.alive && !o.barb && atWar(cid, o.id)); }

function aiChooseBuild(c) {
  const cv = civ(c.civ);
  const opts = buildOptions(c).filter(o => o.ok);
  const has = (kind, key) => opts.some(o => o.kind === kind && o.key === key);
  const set = (kind, key) => { c.build = { kind, key }; return true; };
  const cs = civCities(c.civ), us = civUnits(c.civ);
  const war = anyWar(c.civ);
  const garrison = us.filter(u => isMil(u) && !isSea(u) && u.x === c.x && u.y === c.y).length;
  const mil = us.filter(u => isMil(u) && u.type !== 'scout').length;

  if (cv.minor) {
    if (garrison < 2 + (war ? 1 : 0)) return set('unit', bestUnitFor(cv, 'def'));
    for (const k of ['walls', 'temple', 'granary', 'library', 'market', 'aqueduct', 'arena', 'university']) if (has('bld', k)) return set('bld', k);
    if (mil < 4) return set('unit', bestUnitFor(cv, 'def'));
    return set('proj', 'wealth');
  }

  const settlers = us.filter(u => u.type === 'settler').length + cs.filter(o => o.build && o.build.key === 'settler').length;
  const workers = us.filter(u => u.type === 'worker').length + cs.filter(o => o.build && o.build.key === 'worker').length;
  const ships = us.filter(isSea).length + cs.filter(o => o.build && o.build.kind === 'unit' && UNITS[o.build.key].domain === 'sea').length;
  const caravans = us.filter(u => u.type === 'caravan').length + cs.filter(o => o.build && o.build.key === 'caravan').length;

  if (has('proj', 'spaceship') && !cs.some(o => o !== c && o.build && o.build.key === 'spaceship')) return set('proj', 'spaceship');
  if (garrison < 1) return set('unit', bestUnitFor(cv, 'def'));
  if (war && garrison < 2 && c.pop >= 3) return set('unit', bestUnitFor(cv, 'def'));
  if (c.unhappy > 0) for (const k of ['temple', 'market', 'arena', 'cathedral']) if (has('bld', k)) return set('bld', k);
  if (cs.length + settlers < maxCitiesFor() && c.pop >= 2 && settlers < 2 && (c.capital || c.pop >= 3) && Math.random() < 0.8) return set('unit', 'settler');
  if (workers < Math.ceil(cs.length * 0.8)) return set('unit', 'worker');
  if (war && mil < cs.length * 3) {
    const sh = bestShip(cv);
    if (sh && cityCoastal(c) && ships < Math.ceil(cs.filter(cityCoastal).length * 0.7) && Math.random() < 0.3) return set('unit', sh);
    return set('unit', bestUnitFor(cv, 'atk'));
  }
  if (has('unit', 'caravan') && caravans < 1 && cs.length >= 2 && routesOf(c).length < maxRoutes(c) && Math.random() < 0.25) return set('unit', 'caravan');
  if (!war && mil < cs.length * 1.5 + eraOf(cv) && Math.random() < 0.5 * cv.aggression) return set('unit', bestUnitFor(cv, Math.random() < 0.5 ? 'atk' : 'def'));
  const sh = bestShip(cv);
  if (sh && cityCoastal(c) && ships < Math.ceil(cs.filter(cityCoastal).length * 0.4) && Math.random() < 0.15) return set('unit', sh);
  const wonders = opts.filter(o => o.kind === 'wonder');
  if (wonders.length && Math.random() < 0.3) { const w = pick(wonders); return set('wonder', w.key); }
  const order = ['granary', 'watermill', 'library', 'market', 'temple', 'harbor', 'workshop', 'walls', 'aqueduct', 'arena', 'university', 'bank', 'cathedral', 'barracks', 'factory', 'powerplant', 'lab'];
  for (const k of order) {
    if (!has('bld', k)) continue;
    if (k === 'walls' && !war && Math.random() < 0.6) continue;
    if (k === 'aqueduct' && c.pop < 6) continue;
    if ((k === 'arena' || k === 'cathedral') && c.pop < 5) continue;
    if (k === 'barracks' && cv.aggression < 1) continue;
    return set('bld', k);
  }
  if (mil < cs.length * 3 + eraOf(cv)) return set('unit', bestUnitFor(cv, 'atk'));
  return set('proj', 'wealth');
}

function closestCityDist(a, b) {
  let d = Infinity;
  for (const x of civCities(a)) for (const y of civCities(b)) d = Math.min(d, dist(x.x, x.y, y.x, y.y));
  return d;
}

function aiAcceptPeace(cv, other) {
  const since = G.turn - G.warSince[cv.id][other];
  if (cv.minor) return !cv.allyWars.includes(other) && since >= 5;
  if (since < 6) return false;
  const ratio = milPower(cv.id) / (milPower(other) + 1);
  return ratio < 1.1 || Math.random() < 0.35;
}

function aiDiplomacy(cv) {
  const h = human();
  for (const o of G.civs) {
    if (!o.alive || o.id === cv.id || o.barb || !G.met[cv.id][o.id]) continue;
    const ratio = milPower(cv.id) / (milPower(o.id) + 1);
    if (o.minor) {
      if (atWar(cv.id, o.id)) {
        if (G.turn - G.warSince[cv.id][o.id] > 15 && Math.random() < 0.05 && aiAcceptPeace(o, cv.id)) makePeace(cv.id, o.id);
      } else if (cv.aggression > 1.1 && G.turn > 60 && ratio > 3 && Math.random() < 0.004 && closestCityDist(cv.id, o.id) <= 8 && o.ally == null) {
        declareWar(cv.id, o.id);
      }
      continue;
    }
    if (!atWar(cv.id, o.id)) {
      if (G.turn < 35 || G.turn - G.warSince[cv.id][o.id] < 20) continue;
      if (closestCityDist(cv.id, o.id) > 18) continue;
      const p = 0.02 * cv.aggression * (o.human ? DIFFICULTY[G.difficulty].ai : 1);
      if (ratio > 1.3 && Math.random() < p) declareWar(cv.id, o.id);
    } else {
      const since = G.turn - G.warSince[cv.id][o.id];
      if (since < 12) continue;
      if ((ratio < 0.8 && Math.random() < 0.12) || Math.random() < 0.015) {
        if (o.human) {
          if (!G.offers.some(f => f.from === cv.id && f.type === 'peace')) G.offers.push({ type: 'peace', from: cv.id });
        } else if (aiAcceptPeace(o, cv.id)) makePeace(cv.id, o.id);
      }
    }
  }
  // gaver til bystater
  if (cv.gold > 180 && Math.random() < 0.08) {
    const ms = G.civs.filter(m => m.minor && m.alive && G.met[cv.id][m.id] && !atWar(cv.id, m.id) && (m.inf[cv.id] || 0) < 70);
    if (ms.length) {
      ms.sort((a, b) => closestCityDist(cv.id, a.id) - closestCityDist(cv.id, b.id));
      const m = ms[0];
      giftMinor(cv, m, 100);
      if (m.ally === G.human || (m.inf[G.human] || 0) >= 30) notify(G.human, `${cv.name} har givet en gave til ${m.name}.`, null, 'info');
    }
  }
  // teknologihandel med andre AI'er
  for (const o of majors()) {
    if (o.id <= cv.id || o.human || !canTradeTech(cv.id, o.id) || Math.random() > 0.015) continue;
    const a = techsFor(cv, o), b = techsFor(o, cv);
    if (a.length && b.length) { const ka = pick(a), kb = pick(b); o.techs.push(ka); cv.techs.push(kb); if (o.research === ka) o.research = null; if (cv.research === kb) cv.research = null; }
  }
  // tilbud til spilleren
  if (canTradeTech(cv.id, h.id) && Math.random() < 0.02 && !G.offers.some(f => f.from === cv.id)) {
    const sell = techsFor(cv, h).filter(k => aiWillSell(cv, h, k));
    const buy = techsFor(h, cv).filter(k => cv.gold >= aiBuyPrice(cv, k) + 30);
    if (sell.length && (Math.random() < 0.5 || !buy.length)) {
      const k = pick(sell);
      G.offers.push({ type: 'sellTech', from: cv.id, tech: k, price: techPrice(h, k) });
    } else if (buy.length) {
      const k = pick(buy);
      G.offers.push({ type: 'buyTech', from: cv.id, tech: k, price: aiBuyPrice(cv, k) });
    }
  }
}

// Vælg mål for hæren og samlingsby
function planArmy(cv) {
  const A = cv.ai;
  const enemies = G.civs.filter(o => o.alive && !o.barb && atWar(cv.id, o.id)).map(o => o.id);
  if (!enemies.length || !civCities(cv.id).length) { A.target = null; A.launched = false; return; }
  let tgt = A.target != null ? cityById(A.target) : null;
  if (!tgt || !enemies.includes(tgt.civ)) {
    let best = null, bd = Infinity;
    for (const c of G.cities) {
      if (!enemies.includes(c.civ)) continue;
      const d = Math.min(...civCities(cv.id).map(o => dist(o.x, o.y, c.x, c.y)));
      const v = d + c.pop * 0.3 - (civ(c.civ).minor ? -3 : 0);
      if (v < bd) { bd = v; best = c; }
    }
    if (!best) { A.target = null; return; }
    tgt = best; A.target = best.id; A.launched = false; A.since = G.turn;
    const st = civCities(cv.id).sort((a, b) => dist(a.x, a.y, best.x, best.y) - dist(b.x, b.y, best.x, best.y))[0];
    A.stage = st.id;
  }
  const stage = cityById(A.stage);
  if (!stage || stage.civ !== cv.id) { A.target = null; return; }
  const army = G.units.filter(u => u.civ === cv.id && isMil(u) && !isSea(u) && u.type !== 'scout');
  A.atStage = army.filter(u => dist(u.x, u.y, stage.x, stage.y) <= 2).length;
  A.nearTarget = army.filter(u => dist(u.x, u.y, tgt.x, tgt.y) <= 5).length;
  const need = 3 + eraOf(cv);
  if (!A.launched && (A.atStage >= need || G.turn - A.since > 18)) A.launched = true;
  if (A.launched && A.nearTarget === 0 && A.atStage < 2 && G.turn - A.since > 25) { A.launched = false; A.since = G.turn; }
}

// Veje fra hovedstaden til de andre byer
function planRoads(cv) {
  const cap = capitalOf(cv.id);
  cv.ai.roads = [];
  if (!cap || !hasTech(cv, 'wheel')) return;
  const probe = { type: 'worker', civ: cv.id, x: cap.x, y: cap.y };
  for (const c of civCities(cv.id)) {
    if (c === cap || dist(c.x, c.y, cap.x, cap.y) > 14) continue;
    const p = findPath(probe, idx(c.x, c.y));
    if (!p) continue;
    for (const j of p) {
      const t = G.tiles[j];
      if (!t.road && !isWater(j) && !cityAt(j) && (t.owner === cv.id || t.owner < 0)) cv.ai.roads.push(j);
    }
  }
}

function aiPlay(cv) {
  if (!cv.ai) cv.ai = {};
  if (cv.minor) { aiPlayMinor(cv); return; }
  aiDiplomacy(cv);
  planArmy(cv);
  if (G.turn % 10 === cv.id % 10 || !cv.ai.roads) planRoads(cv);
  const reserved = new Set();
  const units = civUnits(cv.id).slice();
  const garrisonIds = new Set();
  for (const c of civCities(cv.id)) {
    const threat = G.units.some(u => atWar(cv.id, u.civ) && isMil(u) && dist(u.x, u.y, c.x, c.y) <= 5);
    const need = 1 + (threat ? 1 : 0) + (c.pop >= 8 ? 1 : 0);
    const here = units.filter(u => isMil(u) && !isSea(u) && u.x === c.x && u.y === c.y && u.type !== 'scout')
      .sort((a, b) => UNITS[b.type].str - UNITS[a.type].str);
    here.slice(0, need).forEach(u => garrisonIds.add(u.id));
    c.aiNeed = Math.max(0, need - here.length);
  }
  for (const u of units) {
    if (!G.units.includes(u)) continue;
    if (u.type === 'settler') aiSettler(u);
    else if (u.type === 'worker') aiWorker(u, reserved);
    else if (u.type === 'caravan') aiCaravan(u);
    else if (UNITS[u.type].gp) aiGreatPerson(u, cv);
    else if (isSea(u)) aiShip(u, cv);
    else aiMilitary(u, cv, garrisonIds.has(u.id));
    if (G.over) return;
  }
  for (const c of civCities(cv.id)) if (!c.build) aiChooseBuild(c);
  aiSpendGold(cv);
}

function aiSpendGold(cv) {
  const war = anyWar(cv.id);
  const reserve = 60 + civCities(cv.id).length * 10;
  // opgradér enheder først i krig
  if (war || cv.gold > reserve * 3) {
    for (const u of civUnits(cv.id)) {
      const k = upgradeTarget(u);
      if (!k || G.tiles[idx(u.x, u.y)].owner !== cv.id) continue;
      const cost = upgradeCost(u, k);
      if (cv.gold - cost < reserve) continue;
      cv.gold -= cost; u.type = k;
    }
  }
  const cands = civCities(cv.id).filter(c => c.build && c.build.kind !== 'proj' && c.build.kind !== 'wonder')
    .map(c => {
      const b = c.build; let pr = 1;
      if (b.kind === 'unit' && b.key === 'settler') pr = 3;
      else if (b.kind === 'unit' && war) pr = 2.5;
      else if (b.kind === 'bld') pr = 1.5;
      return { c, pr, cost: buyCost(c) };
    }).sort((a, b) => b.pr / b.cost - a.pr / a.cost);
  for (const o of cands) {
    if (cv.gold - o.cost < reserve) continue;
    if (o.c.build.key === 'settler' && o.c.pop < 2) continue;
    cv.gold -= o.cost; o.c.prod = buildCost(o.c.build);
  }
}

function aiSettler(u) {
  if (civCities(u.civ).length === 0 && canFoundCity(u)) { foundCity(u); return; }
  if (u.target != null && !siteValid(u.target, u.civ)) u.target = null;
  if (u.target == null) {
    let best = null, bs = -Infinity;
    const cs = civCities(u.civ);
    for (const j of tilesInRadius(u.x, u.y, 11)) {
      if (!siteValid(j, u.civ)) continue;
      const [jx, jy] = xy(j);
      const d = dist(jx, jy, u.x, u.y);
      const near = cs.length ? Math.min(...cs.map(c => dist(c.x, c.y, jx, jy))) : 0;
      const s = siteScore(j, G.tiles) - d * 1.3 - Math.max(0, near - 5) * 2 - (isWater(idx(u.x, u.y)) ? 0 : 0);
      if (s > bs) { bs = s; best = j; }
    }
    u.target = best;
    if (best == null) { if (canFoundCity(u)) foundCity(u); return; }
  }
  if (idx(u.x, u.y) === u.target) { if (canFoundCity(u)) foundCity(u); else u.target = null; return; }
  const path = findPath(u, u.target);
  if (!path) { u.target = null; return; }
  u.path = path; followPath(u); u.path = null;
  if (G.units.includes(u) && idx(u.x, u.y) === u.target && canFoundCity(u) && u.moves > 0) foundCity(u);
}

function siteValid(j, cid) {
  if (!landPassable(j)) return false;
  const t = G.tiles[j];
  if (t.owner >= 0 && t.owner !== cid) return false;
  if (t.t === 'snow' || campAt(j)) return false;
  const [x, y] = xy(j);
  if (G.cities.some(c => dist(c.x, c.y, x, y) < 4)) return false;
  if (G.units.some(u => u.civ !== cid && u.x === x && u.y === y)) return false;
  if (G.units.some(u => u.civ === cid && u.type === 'settler' && u.target === j && !(u.x === x && u.y === y))) return false;
  return true;
}

function workPlanFor(u, j) {
  const t = G.tiles[j];
  if (t.res && canWorkAt(u, 'mine', j) && (t.res === 'iron' || t.res === 'gold' || t.res === 'gems')) return 'mine';
  if (t.t === 'hills' && canWorkAt(u, 'mine', j)) return 'mine';
  if (canWorkAt(u, 'farm', j)) return 'farm';
  if ((t.t === 'jungle') && canWorkAt(u, 'chop', j)) return 'chop';
  const roads = civ(u.civ).ai && civ(u.civ).ai.roads;
  if (roads && roads.includes(j) && canWorkAt(u, 'road', j)) return 'road';
  if (canWorkAt(u, 'road', j) && t.imp) return 'road';
  return null;
}

function aiWorker(u, reserved) {
  reserved = reserved || new Set();
  if (u.work) return;
  const danger = G.units.some(v => atWar(u.civ, v.civ) && isMil(v) && dist(v.x, v.y, u.x, u.y) <= 2);
  if (danger) {
    const c = civCities(u.civ).sort((a, b) => dist(a.x, a.y, u.x, u.y) - dist(b.x, b.y, u.x, u.y))[0];
    if (c) { const p = findPath(u, idx(c.x, c.y)); if (p) { u.path = p; followPath(u); u.path = null; } }
    return;
  }
  const here = idx(u.x, u.y);
  const cv = civ(u.civ);
  const roads = (cv.ai && cv.ai.roads) || [];
  const isUseful = (j) => civCities(u.civ).some(c => c.worked.includes(j)) || roads.includes(j);
  if (u.target === here || u.target == null) {
    const plan = G.tiles[here].owner === u.civ || roads.includes(here) ? workPlanFor(u, here) : null;
    if (plan && isUseful(here)) { startWork(u, plan); u.target = null; return; }
  }
  if (u.target != null && !workPlanFor(u, u.target)) u.target = null;
  if (u.target == null) {
    let best = null, bs = -Infinity;
    const cands = new Set(roads);
    for (const c of civCities(u.civ)) for (const j of cityWorkable(c)) cands.add(j);
    for (const j of cands) {
      if (reserved.has(j)) continue;
      if (G.units.some(v => v !== u && v.type === 'worker' && v.civ === u.civ && (v.target === j || (v.work && idx(v.x, v.y) === j)))) continue;
      const plan = workPlanFor(u, j);
      if (!plan) continue;
      const worked = civCities(u.civ).some(c => c.worked.includes(j));
      if (!worked && !roads.includes(j)) continue;
      let s = (plan === 'mine' ? 6 : plan === 'farm' ? 5 : roads.includes(j) ? 4 : 2) + (G.tiles[j].res ? 3 : 0) + (worked ? 3 : 0);
      s -= distI(j, here) * 0.8;
      if (s > bs) { bs = s; best = j; }
    }
    u.target = best;
  }
  if (u.target == null) return;
  reserved.add(u.target);
  if (u.target === here) { const plan = workPlanFor(u, here); if (plan) { startWork(u, plan); u.target = null; } return; }
  const path = findPath(u, u.target);
  if (!path) { u.target = null; return; }
  u.path = path; followPath(u); u.path = null;
  if (G.units.includes(u) && idx(u.x, u.y) === u.target && u.moves > 0) { const plan = workPlanFor(u, u.target); if (plan) { startWork(u, plan); u.target = null; } }
}

function aiCaravan(u) {
  const c = routeHere(u);
  if (c) { establishRoute(u, c); return; }
  let tgt = u.target != null ? cityById(u.target) : null;
  if (!tgt || !routeTargetOk(u, tgt)) {
    const cands = routeCandidates(u);
    tgt = cands.length ? cands[0].c : null;
    u.target = tgt ? tgt.id : null;
  }
  if (!tgt) return;
  const adj = neighbors(tgt.x, tgt.y).filter(j => canEnter(u, j)).sort((a, b) => distI(a, idx(u.x, u.y)) - distI(b, idx(u.x, u.y)));
  const goal = tgt.civ === u.civ ? idx(tgt.x, tgt.y) : adj[0];
  if (goal == null) { u.target = null; return; }
  const p = findPath(u, goal);
  if (!p) { u.target = null; return; }
  u.path = p; followPath(u); u.path = null;
  if (G.units.includes(u)) { const c2 = routeHere(u); if (c2) establishRoute(u, c2); }
}

function aiGreatPerson(u, cv) {
  if (u.type === 'gp_sci' || u.type === 'gp_mer') { if (gpActionOk(u)) useGreatPerson(u); return; }
  if (u.type === 'gp_eng') {
    if (gpActionOk(u)) { const c = cityAt(idx(u.x, u.y)); if (c.build.kind === 'wonder' || c.build.kind === 'bld' || Math.random() < 0.2) { useGreatPerson(u); return; } }
    const tgt = civCities(cv.id).find(c => c.build && c.build.kind === 'wonder') || capitalOf(cv.id);
    if (tgt) moveToward(u, idx(tgt.x, tgt.y), 0);
    return;
  }
  if (u.type === 'gp_gen') {
    const A = cv.ai;
    let goal = null;
    if (A.target != null && A.launched) {
      const tgt = cityById(A.target);
      const near = tgt && G.units.filter(v => v.civ === cv.id && isMil(v) && !isSea(v)).sort((a, b) => dist(a.x, a.y, tgt.x, tgt.y) - dist(b.x, b.y, tgt.x, tgt.y))[1];
      if (near) goal = idx(near.x, near.y);
    } else if (A.stage != null && cityById(A.stage)) { const s = cityById(A.stage); goal = idx(s.x, s.y); }
    else { const c = capitalOf(cv.id); if (c) goal = idx(c.x, c.y); }
    if (goal != null && goal !== idx(u.x, u.y)) moveToward(u, goal, 0);
  }
}

function tryAttacks(u) {
  const T = UNITS[u.type];
  const range = T.ranged ? T.range : 1;
  let best = null, bs = -Infinity;
  for (const j of tilesInRadius(u.x, u.y, range)) {
    if (!canAttack(u, j)) continue;
    const tg = enemyTarget(u, j);
    if (tg.civilians) { if (bs < 50) { bs = 50; best = j; } continue; }
    const pv = combatPreview(u, j);
    let s;
    if (pv.ranged) s = pv.expD + (pv.unit && pv.unit.hp <= pv.expD ? 40 : 0) + (pv.city ? 5 : 0);
    else {
      if (pv.city && pv.city.hp <= 0) s = 100;
      else if (pv.expA >= u.hp - 5) s = -1;
      else s = pv.expD - pv.expA * 1.1 + (pv.unit && pv.unit.hp <= pv.expD ? 30 : 0);
      if (pv.city && pv.city.hp > 60 && pv.expD < 25) s -= 15;
    }
    if (s > bs) { bs = s; best = j; }
  }
  if (best != null && bs > 4) { attack(u, best); return true; }
  return false;
}

function moveToward(u, target, stopDist) {
  const path = findPath(u, target, { attack: true });
  if (!path) return false;
  const [tx, ty] = xy(target);
  while (path.length && u.moves > 0 && G.units.includes(u)) {
    if (dist(u.x, u.y, tx, ty) <= stopDist) break;
    const next = path[0];
    if (!canEnter(u, next)) break;
    stepUnit(u, next); path.shift();
  }
  return true;
}

function nearestCamp(u, maxD) {
  let best = null, bd = maxD + 1;
  for (const k of G.camps) { const [x, y] = xy(k.i); const d = dist(x, y, u.x, u.y); if (d < bd) { bd = d; best = k; } }
  return best;
}

function aiMilitary(u, cv, isGarrison) {
  if (u.moves <= 0) return;
  const T = UNITS[u.type];
  const here = idx(u.x, u.y);
  if (u.hp < 45 && !isGarrison) {
    if (tryAttacks(u)) return;
    const c = civCities(u.civ).sort((a, b) => dist(a.x, a.y, u.x, u.y) - dist(b.x, b.y, u.x, u.y))[0];
    if (c && dist(c.x, c.y, u.x, u.y) > 0) { moveToward(u, idx(c.x, c.y), 0); return; }
    u.fort = true; return;
  }
  if (tryAttacks(u)) return;
  if (isGarrison) { u.fort = true; return; }
  const enemies = G.civs.filter(o => o.alive && atWar(cv.id, o.id)).map(o => o.id);
  // forsvar egne byer mod nære fjender (også barbarer)
  let intercept = null, idist = 99;
  for (const v of G.units) {
    if (!enemies.includes(v.civ) || !isMil(v) || isSea(v)) continue;
    const nearOwn = civCities(cv.id).some(c => dist(c.x, c.y, v.x, v.y) <= 4);
    if (!nearOwn) continue;
    const d = dist(u.x, u.y, v.x, v.y);
    if (d < idist && d <= 8) { idist = d; intercept = idx(v.x, v.y); }
  }
  if (intercept != null) { moveToward(u, intercept, T.ranged ? T.range : 1); if (G.units.includes(u)) tryAttacks(u); return; }
  const A = cv.ai;
  if (A.target != null) {
    const tgt = cityById(A.target), stage = cityById(A.stage);
    if (tgt && !A.launched && stage) {
      if (dist(u.x, u.y, stage.x, stage.y) > 1) moveToward(u, idx(stage.x, stage.y), 1);
      u.fort = true; return;
    }
    if (tgt && A.launched) {
      moveToward(u, idx(tgt.x, tgt.y), T.ranged ? T.range : 1);
      if (G.units.includes(u)) tryAttacks(u);
      return;
    }
  }
  // ryd barbarlejre i nærheden
  const camp = nearestCamp(u, 8);
  if (camp && u.type !== 'scout') { moveToward(u, camp.i, 0); if (G.units.includes(u)) tryAttacks(u); return; }
  if (u.type === 'scout' && G.turn < 80) {
    if (u.target == null || here === u.target || Math.random() < 0.1) {
      const cands = [];
      for (let k = 0; k < 30; k++) {
        const j = Math.floor(Math.random() * G.tiles.length);
        if (landPassable(j) && distI(j, here) > 5 && distI(j, here) < 18) cands.push(j);
      }
      u.target = cands.length ? cands[0] : null;
    }
    if (u.target != null) { const p = findPath(u, u.target); if (p) { u.path = p; followPath(u); u.path = null; } else u.target = null; }
    return;
  }
  const needy = civCities(cv.id).filter(c => c.aiNeed > 0).sort((a, b) => dist(a.x, a.y, u.x, u.y) - dist(b.x, b.y, u.x, u.y))[0];
  if (needy) { needy.aiNeed--; if (dist(needy.x, needy.y, u.x, u.y) > 0) moveToward(u, idx(needy.x, needy.y), 0); u.fort = true; return; }
  if (!cityAt(here) || embarked(u)) {
    const c = civCities(cv.id).sort((a, b) => dist(a.x, a.y, u.x, u.y) - dist(b.x, b.y, u.x, u.y))[0];
    if (c && (dist(c.x, c.y, u.x, u.y) > 2 || embarked(u))) moveToward(u, idx(c.x, c.y), 1);
  }
  u.fort = true;
}

function aiShip(u, cv) {
  if (u.moves <= 0) return;
  if (tryAttacks(u)) return;
  const T = UNITS[u.type];
  const enemies = G.civs.filter(o => o.alive && atWar(cv.id, o.id)).map(o => o.id);
  if (enemies.length) {
    let best = null, bd = 14;
    for (const v of G.units) if (enemies.includes(v.civ) && (isSea(v) || embarked(v))) { const d = dist(u.x, u.y, v.x, v.y); if (d < bd) { bd = d; best = idx(v.x, v.y); } }
    if (best == null) for (const c of G.cities) if (enemies.includes(c.civ) && cityCoastal(c)) { const d = dist(u.x, u.y, c.x, c.y); if (d < bd) { bd = d; best = idx(c.x, c.y); } }
    if (best != null) { moveToward(u, best, T.ranged ? T.range : 1); if (G.units.includes(u)) tryAttacks(u); return; }
  }
  const ct = cityAt(idx(u.x, u.y));
  if (!ct || ct.civ !== cv.id) {
    const c = civCities(cv.id).filter(cityCoastal).sort((a, b) => dist(a.x, a.y, u.x, u.y) - dist(b.x, b.y, u.x, u.y))[0];
    if (c) moveToward(u, idx(c.x, c.y), 0);
  }
  u.fort = true;
}

// ---------- Bystater ----------
function aiPlayMinor(cv) {
  for (const u of civUnits(cv.id).slice()) {
    if (!G.units.includes(u)) continue;
    if (u.type === 'settler') { aiSettler(u); continue; }
    if (UNITS[u.type].gp || !isMil(u)) continue;
    if (u.moves <= 0) continue;
    if (tryAttacks(u)) continue;
    const c = capitalOf(cv.id);
    if (!c) continue;
    let foe = null, fd = 4;
    for (const v of G.units) if (atWar(cv.id, v.civ) && isMil(v) && !isSea(v)) { const d = dist(v.x, v.y, c.x, c.y); if (d < fd) { fd = d; foe = idx(v.x, v.y); } }
    const inCity = G.units.filter(v => v.civ === cv.id && isMil(v) && v.x === c.x && v.y === c.y).length;
    if (foe != null && (inCity > 1 || !(u.x === c.x && u.y === c.y))) { moveToward(u, foe, 1); if (G.units.includes(u)) tryAttacks(u); continue; }
    if (!(u.x === c.x && u.y === c.y) && dist(u.x, u.y, c.x, c.y) > 1) moveToward(u, idx(c.x, c.y), 0);
    u.fort = true;
  }
  for (const c of civCities(cv.id)) if (!c.build) aiChooseBuild(c);
}

// ---------- Barbarer ----------
function aiBarbarians(cv) {
  for (const u of civUnits(cv.id).slice()) {
    if (!G.units.includes(u) || u.moves <= 0) continue;
    if (tryAttacks(u)) continue;
    let tgt = null, td = 9;
    for (const c of G.cities) { const d = dist(c.x, c.y, u.x, u.y); if (d < td) { td = d; tgt = idx(c.x, c.y); } }
    for (const v of G.units) {
      if (v.civ === cv.id || isSea(v) || embarked(v)) continue;
      const d = dist(v.x, v.y, u.x, u.y);
      if (d < td - (isMil(v) ? 0 : 2)) { td = d; tgt = idx(v.x, v.y); }
    }
    if (tgt != null) { moveToward(u, tgt, UNITS[u.type].ranged ? UNITS[u.type].range : 1); if (G.units.includes(u)) tryAttacks(u); continue; }
    // ellers streif rundt om lejren
    const home = u.camp != null && campAt(u.camp) ? u.camp : null;
    const opts = neighbors(u.x, u.y).filter(j => canEnter(u, j) && (home == null || distI(j, home) <= 4));
    if (opts.length) stepUnit(u, pick(opts));
  }
}
