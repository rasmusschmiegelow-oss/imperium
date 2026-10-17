// Computermodstandere: forskning, produktion, diplomati og enheder.
'use strict';

function aiChooseResearch(cv) {
  const opts = Object.keys(TECHS).filter(k => canResearch(cv, k));
  if (!opts.length) { cv.research = null; return; }
  const war = G.civs.some(o => o.alive && atWar(cv.id, o.id));
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

function bestUnitFor(cv, role) {
  const avail = Object.keys(UNITS).filter(k => hasTech(cv, UNITS[k].tech) && !unitObsolete(cv, k) && UNITS[k].str > 0 && k !== 'scout');
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

function maxCitiesFor() { return Math.round(G.w * G.h / (G.civs.length * 95)) + 2; }

function aiChooseBuild(c) {
  const cv = civ(c.civ);
  const opts = buildOptions(c).filter(o => o.ok);
  const has = (kind, key) => opts.some(o => o.kind === kind && o.key === key);
  const set = (kind, key) => { c.build = { kind, key }; return true; };
  const cs = civCities(c.civ), us = civUnits(c.civ);
  const war = G.civs.some(o => o.alive && atWar(c.civ, o.id));
  const garrison = us.filter(u => isMil(u) && u.x === c.x && u.y === c.y).length;
  const mil = us.filter(u => isMil(u) && u.type !== 'scout').length;
  const settlers = us.filter(u => u.type === 'settler').length + cs.filter(o => o.build && o.build.key === 'settler').length;
  const workers = us.filter(u => u.type === 'worker').length + cs.filter(o => o.build && o.build.key === 'worker').length;

  if (has('proj', 'spaceship') && !cs.some(o => o !== c && o.build && o.build.key === 'spaceship')) return set('proj', 'spaceship');
  if (garrison < 1) return set('unit', bestUnitFor(cv, 'def'));
  if (war && garrison < 2 && c.pop >= 3) return set('unit', bestUnitFor(cv, 'def'));
  if (cs.length + settlers < maxCitiesFor() && c.pop >= 2 && settlers < 2 && (c.capital || c.pop >= 3) && Math.random() < 0.8) return set('unit', 'settler');
  if (workers < Math.ceil(cs.length * 0.8)) return set('unit', 'worker');
  if (war && mil < cs.length * 3) return set('unit', bestUnitFor(cv, 'atk'));
  if (!war && mil < cs.length * 1.5 + eraOf(cv) && Math.random() < 0.5 * cv.aggression) return set('unit', bestUnitFor(cv, Math.random() < 0.5 ? 'atk' : 'def'));
  // vidundere
  const wonders = opts.filter(o => o.kind === 'wonder');
  if (wonders.length && Math.random() < 0.3) { const w = pick(wonders); return set('wonder', w.key); }
  const order = ['granary', 'library', 'market', 'temple', 'workshop', 'walls', 'aqueduct', 'university', 'bank', 'barracks', 'factory', 'powerplant', 'lab'];
  for (const k of order) {
    if (!has('bld', k)) continue;
    if (k === 'walls' && !war && Math.random() < 0.6) continue;
    if (k === 'aqueduct' && c.pop < 6) continue;
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
  if (since < 6) return false;
  const ratio = milPower(cv.id) / (milPower(other) + 1);
  return ratio < 1.1 || Math.random() < 0.35;
}

function aiDiplomacy(cv) {
  for (const o of G.civs) {
    if (!o.alive || o.id === cv.id || !G.met[cv.id][o.id]) continue;
    const ratio = milPower(cv.id) / (milPower(o.id) + 1);
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
          if (!G.offers) G.offers = [];
          if (!G.offers.some(f => f.from === cv.id)) G.offers.push({ from: cv.id, turn: G.turn });
        } else if (aiAcceptPeace(o, cv.id)) makePeace(cv.id, o.id);
      }
    }
  }
}

function aiPlay(cv) {
  aiDiplomacy(cv);
  const reserved = new Set();
  const units = civUnits(cv.id).slice();
  // garnisoner
  const garrisonIds = new Set();
  for (const c of civCities(cv.id)) {
    const threat = G.units.some(u => atWar(cv.id, u.civ) && isMil(u) && dist(u.x, u.y, c.x, c.y) <= 5);
    const need = 1 + (threat ? 1 : 0) + (c.pop >= 8 ? 1 : 0);
    const here = units.filter(u => isMil(u) && u.x === c.x && u.y === c.y && u.type !== 'scout')
      .sort((a, b) => UNITS[b.type].str - UNITS[a.type].str);
    here.slice(0, need).forEach(u => garrisonIds.add(u.id));
    c.aiNeed = Math.max(0, need - here.length);
  }
  for (const u of units) {
    if (!G.units.includes(u)) continue;
    if (u.type === 'settler') aiSettler(u);
    else if (u.type === 'worker') aiWorker(u, reserved);
    else aiMilitary(u, cv, garrisonIds.has(u.id));
    if (G.over) return;
  }
  for (const c of civCities(cv.id)) if (!c.build) aiChooseBuild(c);
  aiSpendGold(cv);
}

function aiSpendGold(cv) {
  const war = G.civs.some(o => o.alive && atWar(cv.id, o.id));
  const reserve = 60 + civCities(cv.id).length * 10;
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
  const cv = civ(u.civ);
  if (civCities(u.civ).length === 0 && canFoundCity(u)) { foundCity(u); return; }
  if (u.target != null) {
    const tgtOk = siteValid(u.target, u.civ);
    if (!tgtOk) u.target = null;
  }
  if (u.target == null) {
    let best = null, bs = -Infinity;
    for (const j of tilesInRadius(u.x, u.y, 10)) {
      if (!siteValid(j, u.civ)) continue;
      const d = distI(j, idx(u.x, u.y));
      const near = civCities(u.civ).length ? Math.min(...civCities(u.civ).map(c => dist(c.x, c.y, ...xy(j)))) : 0;
      const s = siteScore(j, G.tiles, G.w, G.h) - d * 1.3 - Math.max(0, near - 5) * 2;
      if (s > bs) { bs = s; best = j; }
    }
    u.target = best;
    if (best == null) { if (canFoundCity(u)) foundCity(u); return; }
  }
  if (idx(u.x, u.y) === u.target) { if (canFoundCity(u)) foundCity(u); else u.target = null; return; }
  const path = findPath(u, u.target);
  if (!path) { u.target = null; return; }
  u.path = path; followPath(u); u.path = null;
  if (idx(u.x, u.y) === u.target && canFoundCity(u) && u.moves > 0) foundCity(u);
  void cv;
}

function siteValid(j, cid) {
  if (!passable(j)) return false;
  const t = G.tiles[j];
  if (t.owner >= 0 && t.owner !== cid) return false;
  if (t.t === 'snow') return false;
  const [x, y] = xy(j);
  if (G.cities.some(c => dist(c.x, c.y, x, y) < 4)) return false;
  if (G.units.some(u => u.civ !== cid && u.x === x && u.y === y)) return false;
  if (G.units.some(u => u.civ === cid && u.type === 'settler' && u.target === j && !(u.x === x && u.y === y))) return false;
  return true;
}

function workPlanFor(u, j) {
  const t = G.tiles[j];
  if (t.res && canWorkAt(u, 'mine', j) && (t.res === 'iron' || t.res === 'gold')) return 'mine';
  if (t.t === 'hills' && canWorkAt(u, 'mine', j)) return 'mine';
  if (canWorkAt(u, 'farm', j) && t.t !== 'desert') return 'farm';
  if ((t.t === 'jungle') && canWorkAt(u, 'chop', j)) return 'chop';
  if (canWorkAt(u, 'road', j) && t.imp) return 'road';
  return null;
}

function aiWorker(u, reserved) {
  reserved = reserved || new Set();
  if (u.work) return;
  // farlig nærhed: flygt til nærmeste by
  const danger = G.units.some(v => atWar(u.civ, v.civ) && isMil(v) && dist(v.x, v.y, u.x, u.y) <= 2);
  if (danger) {
    const c = civCities(u.civ).sort((a, b) => dist(a.x, a.y, u.x, u.y) - dist(b.x, b.y, u.x, u.y))[0];
    if (c) { const p = findPath(u, idx(c.x, c.y)); if (p) { u.path = p; followPath(u); u.path = null; } }
    return;
  }
  const here = idx(u.x, u.y);
  if (u.target === here || u.target == null) {
    const plan = G.tiles[here].owner === u.civ ? workPlanFor(u, here) : null;
    if (plan && civCities(u.civ).some(c => c.worked.includes(here))) { startWork(u, plan); u.target = null; return; }
  }
  if (u.target != null && (G.tiles[u.target].owner !== u.civ || !workPlanFor(u, u.target))) u.target = null;
  if (u.target == null) {
    let best = null, bs = -Infinity;
    for (const c of civCities(u.civ)) {
      for (const j of c.worked.concat(cityWorkable(c))) {
        if (reserved.has(j)) continue;
        if (G.units.some(v => v !== u && v.type === 'worker' && v.civ === u.civ && (v.target === j || (v.work && idx(v.x, v.y) === j)))) continue;
        const plan = workPlanFor(u, j);
        if (!plan) continue;
        let s = (plan === 'mine' ? 6 : plan === 'farm' ? 5 : plan === 'chop' ? 2 : 2) + (G.tiles[j].res ? 3 : 0) + (c.worked.includes(j) ? 3 : 0);
        s -= distI(j, here) * 0.8;
        if (s > bs) { bs = s; best = j; }
      }
    }
    u.target = best;
  }
  if (u.target == null) return;
  reserved.add(u.target);
  if (u.target === here) { const plan = workPlanFor(u, here); if (plan) { startWork(u, plan); u.target = null; } return; }
  const path = findPath(u, u.target);
  if (!path) { u.target = null; return; }
  u.path = path; followPath(u); u.path = null;
  if (idx(u.x, u.y) === u.target && u.moves > 0) { const plan = workPlanFor(u, u.target); if (plan) { startWork(u, plan); u.target = null; } }
}

function tryAttacks(u) {
  const T = UNITS[u.type];
  const range = T.ranged ? T.range : 1;
  let best = null, bs = -Infinity;
  for (const j of tilesInRadius(u.x, u.y, range)) {
    if (!canAttack(u, j)) continue;
    const tg = enemyTarget(u, j);
    if (tg.civilians) { bs = 50; best = j; continue; }
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
  while (path.length && u.moves > 0) {
    const [tx, ty] = xy(target);
    if (dist(u.x, u.y, tx, ty) <= stopDist) break;
    const next = path[0];
    if (!canEnter(u, next)) break;
    stepUnit(u, next); path.shift();
  }
  return true;
}

function aiMilitary(u, cv, isGarrison) {
  if (u.moves <= 0) return;
  const T = UNITS[u.type];
  const here = idx(u.x, u.y);
  // hvil hvis skadet
  if (u.hp < 45 && !isGarrison) {
    if (tryAttacks(u)) return;
    const c = civCities(u.civ).sort((a, b) => dist(a.x, a.y, u.x, u.y) - dist(b.x, b.y, u.x, u.y))[0];
    if (c && dist(c.x, c.y, u.x, u.y) > 0) { moveToward(u, idx(c.x, c.y), 0); return; }
    u.fort = true; return;
  }
  if (tryAttacks(u)) return;
  if (isGarrison) { u.fort = true; return; }
  const enemies = G.civs.filter(o => o.alive && atWar(cv.id, o.id)).map(o => o.id);
  // forsvar egne byer mod nære fjender
  let intercept = null, idist = 99;
  for (const v of G.units) {
    if (!enemies.includes(v.civ) || !isMil(v)) continue;
    const nearOwn = civCities(cv.id).some(c => dist(c.x, c.y, v.x, v.y) <= 4);
    if (!nearOwn) continue;
    const d = dist(u.x, u.y, v.x, v.y);
    if (d < idist && d <= 8) { idist = d; intercept = idx(v.x, v.y); }
  }
  if (intercept != null) {
    moveToward(u, intercept, T.ranged ? T.range : 1);
    tryAttacks(u);
    return;
  }
  if (enemies.length) {
    let tgt = null, td = Infinity;
    for (const c of G.cities) {
      if (!enemies.includes(c.civ)) continue;
      const d = dist(u.x, u.y, c.x, c.y);
      if (d < td) { td = d; tgt = c; }
    }
    if (tgt && td < 30) {
      // vent på forstærkninger, hvis vi er alene langt fra
      const friends = G.units.filter(v => v.civ === u.civ && isMil(v) && dist(v.x, v.y, u.x, u.y) <= 3).length;
      if (td <= 5 && friends < 3 && tgt.hp > 50 && Math.random() < 0.6) { u.fort = true; return; }
      moveToward(u, idx(tgt.x, tgt.y), T.ranged ? T.range : 1);
      tryAttacks(u);
      return;
    }
  }
  // fred: spejdere udforsker, andre går til byer der mangler forsvar
  if (u.type === 'scout' && G.turn < 80) {
    if (u.target == null || idx(u.x, u.y) === u.target || Math.random() < 0.1) {
      const cands = [];
      for (let k = 0; k < 30; k++) {
        const j = Math.floor(Math.random() * G.tiles.length);
        if (passable(j) && distI(j, here) > 5 && distI(j, here) < 18) cands.push(j);
      }
      u.target = cands.length ? cands[0] : null;
    }
    if (u.target != null) { const p = findPath(u, u.target); if (p) { u.path = p; followPath(u); u.path = null; } else u.target = null; }
    return;
  }
  const needy = civCities(cv.id).filter(c => c.aiNeed > 0).sort((a, b) => dist(a.x, a.y, u.x, u.y) - dist(b.x, b.y, u.x, u.y))[0];
  if (needy) { needy.aiNeed--; if (dist(needy.x, needy.y, u.x, u.y) > 0) moveToward(u, idx(needy.x, needy.y), 0); u.fort = true; return; }
  const ct = cityAt(here);
  if (!ct) {
    const c = civCities(cv.id).sort((a, b) => dist(a.x, a.y, u.x, u.y) - dist(b.x, b.y, u.x, u.y))[0];
    if (c && dist(c.x, c.y, u.x, u.y) > 2) moveToward(u, idx(c.x, c.y), 1);
  }
  u.fort = true;
}
