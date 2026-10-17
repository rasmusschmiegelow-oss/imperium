// Spilregler: kort, enheder, byer, kamp, forskning og turgang.
'use strict';

let G = null;

// ---------- Hjælpefunktioner ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const rnd = () => Math.random();
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function idx(x, y) { return y * G.w + x; }
function xy(i) { return [i % G.w, Math.floor(i / G.w)]; }
function inb(x, y) { return x >= 0 && y >= 0 && x < G.w && y < G.h; }

const NB_EVEN = [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]];
const NB_ODD = [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]];
function neighbors(x, y) {
  const d = (y & 1) ? NB_ODD : NB_EVEN;
  const out = [];
  for (const [dx, dy] of d) { const nx = x + dx, ny = y + dy; if (inb(nx, ny)) out.push(idx(nx, ny)); }
  return out;
}
function cube(x, y) { const q = x - (y - (y & 1)) / 2; return [q, y, -q - y]; }
function dist(x1, y1, x2, y2) {
  const a = cube(x1, y1), b = cube(x2, y2);
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
}
function distI(i, j) { const [a, b] = xy(i), [c, d] = xy(j); return dist(a, b, c, d); }
function tilesInRadius(x, y, r) {
  const out = [];
  for (let yy = y - r; yy <= y + r; yy++)
    for (let xx = x - r - 1; xx <= x + r + 1; xx++)
      if (inb(xx, yy) && dist(x, y, xx, yy) <= r) out.push(idx(xx, yy));
  return out;
}

// ---------- Kortgenerering ----------
function makeNoise(R, w, h, scale) {
  const gw = Math.ceil(w / scale) + 3, gh = Math.ceil(h / scale) + 3;
  const g = new Float32Array(gw * gh);
  for (let i = 0; i < g.length; i++) g[i] = R();
  const sm = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = x / scale, fy = y / scale;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = sm(fx - x0), ty = sm(fy - y0);
    const a = g[y0 * gw + x0], b = g[y0 * gw + x0 + 1], c = g[(y0 + 1) * gw + x0], d = g[(y0 + 1) * gw + x0 + 1];
    return (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * ty;
  };
}

function generateTerrain(w, h, seed) {
  const R = mulberry32(seed);
  const n1 = makeNoise(R, w, h, 11), n2 = makeNoise(R, w, h, 5), n3 = makeNoise(R, w, h, 2.4);
  const m1 = makeNoise(R, w, h, 9), m2 = makeNoise(R, w, h, 3.5);
  const elev = new Float32Array(w * h), moist = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const px = x + 0.5 * (y & 1) + 1, py = y * 0.87 + 1;
    let e = n1(px, py) * 0.55 + n2(px, py) * 0.3 + n3(px, py) * 0.15;
    const dx = (x / (w - 1) - 0.5) * 2, dy = (y / (h - 1) - 0.5) * 2;
    const d = Math.max(Math.abs(dx) * 0.95, Math.abs(dy) * 1.05);
    e = e - Math.pow(d, 3) * 0.55 + 0.08;
    elev[y * w + x] = e;
    moist[y * w + x] = m1(px, py) * 0.7 + m2(px, py) * 0.3;
  }
  const sorted = Array.from(elev).sort((a, b) => a - b);
  const seaLevel = sorted[Math.floor(sorted.length * 0.56)];
  const mountLevel = sorted[Math.floor(sorted.length * 0.965)];
  const hillLevel = sorted[Math.floor(sorted.length * 0.89)];
  const tiles = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, e = elev[i], m = moist[i];
    const lat = Math.abs(y / (h - 1) - 0.5) * 2;
    let t;
    if (e < seaLevel) t = 'ocean';
    else if (e > mountLevel) t = 'mountain';
    else if (lat > 0.9) t = 'snow';
    else if (lat > 0.77) t = m > 0.6 ? 'forest' : 'tundra';
    else if (e > hillLevel) t = 'hills';
    else if (m < 0.33) t = lat < 0.6 ? 'desert' : 'plains';
    else if (m < 0.46) t = 'plains';
    else if (m < 0.62) t = 'grass';
    else t = lat < 0.32 ? 'jungle' : 'forest';
    tiles.push({ t, res: null, imp: null, road: false, owner: -1, city: -1, deco: Math.floor(R() * 1000) });
  }
  // kyst
  const tmpG = { w, h };
  const oldG = G; G = tmpG;
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i].t !== 'ocean') continue;
    const [x, y] = xy(i);
    if (neighbors(x, y).some(j => !TERRAIN[tiles[j].t].water)) tiles[i].t = 'coast';
  }
  // ressourcer
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i].t;
    const opts = Object.keys(RESOURCES).filter(k => RESOURCES[k].on.includes(t));
    if (opts.length && R() < (t === 'coast' ? 0.07 : 0.1)) tiles[i].res = opts[Math.floor(R() * opts.length)];
  }
  // landmasser
  const comp = new Int32Array(tiles.length).fill(-1);
  const sizes = [];
  for (let i = 0; i < tiles.length; i++) {
    if (comp[i] >= 0 || TERRAIN[tiles[i].t].water) continue;
    const id = sizes.length; let n = 0; const st = [i]; comp[i] = id;
    while (st.length) {
      const c = st.pop(); n++;
      const [x, y] = xy(c);
      for (const j of neighbors(x, y)) if (comp[j] < 0 && !TERRAIN[tiles[j].t].water) { comp[j] = id; st.push(j); }
    }
    sizes.push(n);
  }
  G = oldG;
  return { tiles, comp, sizes };
}

function siteScore(i, tiles, w, h) {
  const t = tiles[i];
  if (TERRAIN[t.t].water || t.t === 'mountain' || t.t === 'snow') return -1;
  const [x, y] = xy(i);
  let s = 0, coast = false;
  for (const j of tilesInRadius(x, y, 2)) {
    const tt = tiles[j]; const T = TERRAIN[tt.t];
    if (tt.owner >= 0 && tt.owner !== undefined && G.cities && tt.city >= 0 && j !== i) s -= 1;
    let f = T.f, p = T.p, tr = T.t;
    if (tt.res) { f += RESOURCES[tt.res].f; p += RESOURCES[tt.res].p; tr += RESOURCES[tt.res].t; }
    if (tt.t === 'ocean') { f -= 0.5; }
    s += f * 1.4 + p * 1.0 + tr * 0.5;
    if (tt.t === 'coast' && distI(i, j) === 1) coast = true;
  }
  if (coast) s += 2;
  if (t.t === 'hills') s += 2;
  if (t.t === 'grass' || t.t === 'plains') s += 1;
  return s;
}

function newGame(opts) {
  const size = MAPSIZES[opts.size];
  const w = size.w, h = size.h;
  let gen, seed;
  for (let tries = 0; tries < 20; tries++) {
    seed = Math.floor(Math.random() * 1e9);
    gen = generateTerrain(w, h, seed);
    const land = gen.sizes.reduce((a, b) => a + b, 0);
    const big = Math.max(...gen.sizes);
    if (big > land * 0.55) break;
  }
  const nAi = opts.opponents;
  const civKeys = [opts.civ, ...shuffle(CIVS.map(c => c.key).filter(k => k !== opts.civ)).slice(0, nAi)];
  G = {
    version: 1, w, h, seed, tiles: gen.tiles, units: [], cities: [], civs: [], turn: 1, nextId: 1,
    wonders: {}, human: 0, explored: new Array(w * h).fill(0), difficulty: opts.difficulty,
    war: [], met: [], warSince: [], over: null, log: [],
  };
  civKeys.forEach((k, n) => {
    const def = CIVS.find(c => c.key === k);
    G.civs.push({
      id: n, key: k, name: def.name, adj: def.adj, color: def.color, light: def.light,
      human: n === 0, techs: ['agriculture'], research: null, sci: 0, gold: 10, alive: true,
      cityNameIdx: 0, aggression: 0.6 + Math.random() * 0.8, sciRate: 0.6, everCity: false,
    });
  });
  const n = G.civs.length;
  for (let a = 0; a < n; a++) { G.war.push(new Array(n).fill(false)); G.met.push(new Array(n).fill(false)); G.warSince.push(new Array(n).fill(0)); G.met[a][a] = true; }
  // AI'er kender hinanden
  for (let a = 1; a < n; a++) for (let b = 1; b < n; b++) G.met[a][b] = true;

  // startpositioner på største landmasse
  const bigId = gen.sizes.indexOf(Math.max(...gen.sizes));
  let cands = [];
  for (let i = 0; i < gen.tiles.length; i++) {
    if (gen.comp[i] !== bigId) continue;
    const t = gen.tiles[i].t;
    if (!['grass', 'plains', 'hills'].includes(t)) continue;
    const [x, y] = xy(i);
    if (y < 3 || y > h - 4) continue;
    cands.push({ i, s: siteScore(i, gen.tiles, w, h) });
  }
  cands.sort((a, b) => b.s - a.s);
  cands = cands.slice(0, Math.max(40, Math.floor(cands.length * 0.5)));
  const starts = [];
  starts.push(pick(cands.slice(0, 15)).i);
  while (starts.length < n) {
    let best = null, bd = -1;
    for (const c of cands) {
      const md = Math.min(...starts.map(s => distI(s, c.i)));
      const v = md + c.s * 0.08;
      if (v > bd) { bd = v; best = c.i; }
    }
    starts.push(best);
  }
  G.civs.forEach((civ, k) => {
    const [x, y] = xy(starts[k]);
    createUnit(civ.id, 'settler', x, y);
    const nb = neighbors(x, y).filter(j => passable(j));
    const [wx, wy] = nb.length ? xy(nb[0]) : [x, y];
    createUnit(civ.id, 'warrior', wx, wy);
    const [sx, sy] = nb.length > 1 ? xy(nb[1]) : [wx, wy];
    createUnit(civ.id, 'scout', sx, sy);
    if (!civ.human && opts.difficulty === 'hard') createUnit(civ.id, 'warrior', x, y);
  });
  G.civs.forEach(c => { if (!c.human) aiChooseResearch(c); });
  updateVisibility();
  return G;
}

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ---------- Generelt ----------
function civ(id) { return G.civs[id]; }
function human() { return G.civs[G.human]; }
function hasTech(c, k) { return !k || c.techs.includes(k); }
function cityAt(i) { return G.cities.find(c => idx(c.x, c.y) === i) || null; }
function cityById(id) { return G.cities.find(c => c.id === id) || null; }
function unitsAt(i) { const [x, y] = xy(i); return G.units.filter(u => u.x === x && u.y === y); }
function unitById(id) { return G.units.find(u => u.id === id) || null; }
function civCities(cid) { return G.cities.filter(c => c.civ === cid); }
function civUnits(cid) { return G.units.filter(u => u.civ === cid); }
function isMil(u) { return UNITS[u.type].str > 0; }
function atWar(a, b) { return a !== b && G.war[a][b]; }
function passable(i) { const T = TERRAIN[G.tiles[i].t]; return !T.water && G.tiles[i].t !== 'mountain'; }
function yearOf(turn) {
  let y = -4000;
  for (let t = 1; t < turn; t++) y += t < 75 ? 40 : t < 135 ? 25 : t < 200 ? 15 : t < 270 ? 5 : 2;
  return y;
}
function yearLabel(turn) { const y = yearOf(turn); return y < 0 ? `${-y} f.Kr.` : `${y} e.Kr.`; }
function techCost(c, k) {
  const base = TECHS[k].cost;
  const mult = c.human ? 1 : 1 / DIFFICULTY[G.difficulty].ai;
  return Math.round(base * 2.2 * (1 + TECHS[k].era * 0.3) * (1 + 0.04 * Math.max(0, civCities(c.id).length - 3)) * mult);
}
function canResearch(c, k) { return !c.techs.includes(k) && TECHS[k].pre.every(p => c.techs.includes(p)); }
function eraOf(c) { return Math.max(...c.techs.map(t => TECHS[t].era)); }

function notify(cid, text, at, kind) {
  if (cid !== G.human && cid !== -1) return;
  const e = { turn: G.turn, text, at: at == null ? null : at, kind: kind || 'info' };
  G.log.push(e);
  if (G.log.length > 200) G.log.shift();
  if (typeof UI !== 'undefined') UI.toast(e);
}

// ---------- Enheder ----------
function createUnit(cid, type, x, y, vet) {
  const u = { id: G.nextId++, type, civ: cid, x, y, hp: 100, moves: UNITS[type].moves, fort: false, vet: !!vet,
    path: null, work: null, sleep: false, acted: false, auto: false };
  G.units.push(u);
  return u;
}
function killUnit(u) { G.units = G.units.filter(v => v !== u); if (typeof UI !== 'undefined' && UI.sel && UI.sel.unit === u.id) UI.sel = null; }

function moveCost(from, to) {
  const t = G.tiles[to];
  if (!passable(to)) return Infinity;
  const roadA = G.tiles[from].road || cityAt(from), roadB = t.road || cityAt(to);
  if (roadA && roadB) return 1 / 3;
  return TERRAIN[t.t].move;
}

// Kan enheden u gå ind på felt i (uden angreb)?
function canEnter(u, i) {
  if (!passable(i)) return false;
  const c = cityAt(i);
  if (c && c.civ !== u.civ) return false;
  for (const v of unitsAt(i)) {
    if (v.civ === u.civ) continue;
    if (atWar(u.civ, v.civ) && !isMil(v) && isMil(u)) continue; // fang civile
    return false;
  }
  return true;
}

// Fjendtligt mål på felt i?
function enemyTarget(u, i) {
  const c = cityAt(i);
  if (c && atWar(u.civ, c.civ)) return { city: c };
  const us = unitsAt(i).filter(v => v.civ !== u.civ && atWar(u.civ, v.civ));
  if (!us.length) return null;
  const mil = us.filter(isMil);
  if (mil.length) return { unit: bestDefender(mil, u) };
  return { civilians: us };
}

function findPath(u, target, opts = {}) {
  const start = idx(u.x, u.y);
  if (start === target) return [];
  const [tx, ty] = xy(target);
  const N = G.w * G.h;
  const g = new Float32Array(N).fill(Infinity);
  const came = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const heap = []; // [f, node]
  const push = (f, n) => { heap.push([f, n]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0]; const last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  g[start] = 0; push(dist(u.x, u.y, tx, ty) * 0.34, start);
  const isHuman = u.civ === G.human;
  const maxCost = opts.maxCost || Infinity;
  while (heap.length) {
    const [, cur] = pop();
    if (closed[cur]) continue;
    if (cur === target) {
      const path = []; let c = cur;
      while (c !== start) { path.push(c); c = came[c]; }
      return path.reverse();
    }
    closed[cur] = 1;
    if (g[cur] > maxCost) continue;
    const [cx, cy] = xy(cur);
    for (const nb of neighbors(cx, cy)) {
      if (closed[nb]) continue;
      const isTarget = nb === target;
      if (isHuman && !G.explored[nb]) continue;
      if (!canEnter(u, nb) && !(isTarget && opts.attack && enemyTarget(u, nb))) continue;
      const mc = moveCost(cur, nb);
      if (mc === Infinity) continue;
      const ng = g[cur] + mc;
      if (ng < g[nb]) {
        g[nb] = ng; came[nb] = cur;
        const [nx, ny] = xy(nb);
        push(ng + dist(nx, ny, tx, ty) * 0.34, nb);
      }
    }
  }
  return null;
}

// Antal ture for at gå en sti
function pathTurns(u, path) {
  let mv = u.moves, turns = mv > 0 ? 1 : 2, from = idx(u.x, u.y);
  if (mv <= 0) mv = UNITS[u.type].moves;
  for (const p of path) {
    if (mv <= 0) { turns++; mv = UNITS[u.type].moves; }
    mv -= moveCost(from, p); from = p;
  }
  return turns;
}

// Felter enheden kan nå denne tur
function reachable(u) {
  const res = new Set();
  if (u.moves <= 0) return res;
  const start = idx(u.x, u.y);
  const best = new Map([[start, u.moves]]);
  const q = [start];
  while (q.length) {
    const cur = q.shift(); const mv = best.get(cur);
    if (mv <= 0) continue;
    const [cx, cy] = xy(cur);
    for (const nb of neighbors(cx, cy)) {
      if (!canEnter(u, nb)) continue;
      if (u.civ === G.human && !G.explored[nb]) continue;
      const left = Math.max(0, mv - moveCost(cur, nb));
      if (!best.has(nb) || best.get(nb) < left) { best.set(nb, left); res.add(nb); q.push(nb); }
    }
  }
  return res;
}

function stepUnit(u, to) {
  const cost = moveCost(idx(u.x, u.y), to);
  u.moves = Math.max(0, u.moves - cost);
  if (u.moves < 0.01) u.moves = 0;
  const [x, y] = xy(to);
  u.x = x; u.y = y; u.fort = false; u.sleep = false; u.work = null;
  // fang fjendtlige civile
  for (const v of unitsAt(to)) {
    if (v.civ !== u.civ && atWar(u.civ, v.civ) && !isMil(v)) {
      const ot = v.civ;
      killUnit(v);
      const nt = v.type === 'settler' ? 'worker' : v.type;
      createUnit(u.civ, nt, x, y).moves = 0;
      notify(u.civ, `Du har taget en ${civ(ot).adj} ${UNITS[v.type].name.toLowerCase()} til fange.`, to);
      notify(ot, `${civ(u.civ).name} har taget din ${UNITS[v.type].name.toLowerCase()} til fange!`, to, 'bad');
    }
  }
  if (u.civ === G.human) updateVisibility();
  else meetCheck(u.civ, to);
}

// Følg u.path så langt bevægelsespoint rækker. Returnerer true hvis enheden nåede målet.
function followPath(u) {
  while (u.path && u.path.length && u.moves > 0) {
    const next = u.path[0];
    if (!canEnter(u, next)) {
      // prøv at finde en ny sti
      const goal = u.path[u.path.length - 1];
      const np = findPath(u, goal);
      if (!np || !np.length || !canEnter(u, np[0])) { u.path = null; return false; }
      u.path = np; continue;
    }
    stepUnit(u, next);
    u.path.shift();
  }
  if (u.path && !u.path.length) { u.path = null; return true; }
  return false;
}

// ---------- Kamp ----------
function unitStrength(u, role, opp, tileI) {
  const T = UNITS[u.type];
  let s = role === 'ranged' ? (T.ranged || 0) : T.str;
  let m = 1;
  if (u.vet) m += 0.25;
  if (role === 'def') {
    const tt = G.tiles[tileI];
    if (T.cls !== 'armor' && T.cls !== 'mounted') m += TERRAIN[tt.t].def;
    if (u.fort) m += 0.25;
    if (opp && T.antiMounted && ['mounted'].includes(UNITS[opp.type].cls)) m += 1;
  } else if (opp && opp.type && T.antiMounted && UNITS[opp.type].cls === 'mounted') m += 1;
  s *= m;
  s *= 0.5 + 0.5 * u.hp / 100;
  return Math.max(0.5, s);
}
function bestDefender(list, attacker) {
  let best = null, bs = -1;
  for (const v of list) {
    const s = unitStrength(v, 'def', attacker, idx(v.x, v.y));
    if (s > bs) { bs = s; best = v; }
  }
  return best;
}
function cityHasWalls(c) {
  if (c.blds.includes('walls')) return true;
  return G.wonders.greatwall != null && cityById(G.wonders.greatwall) && cityById(G.wonders.greatwall).civ === c.civ && eraOf(civ(c.civ)) < 3;
}
function cityStrength(c) {
  const gar = G.units.filter(u => u.x === c.x && u.y === c.y && u.civ === c.civ && isMil(u));
  const gs = gar.length ? Math.max(...gar.map(u => UNITS[u.type].str * (u.vet ? 1.25 : 1))) : 0;
  const eraB = eraOf(civ(c.civ)) * 4;
  let s = 6 + c.pop * 1.5 + gs * 0.7 + eraB;
  if (cityHasWalls(c)) s *= 2;
  if (G.tiles[idx(c.x, c.y)].t === 'hills') s *= 1.25;
  return s * (0.6 + 0.4 * c.hp / 100);
}
function dmgFor(r) { return Math.round(clamp(30 * Math.pow(r, 1.15) * (0.8 + Math.random() * 0.4), 1, 100)); }

// Forhåndsvisning af kamp: {a, d, dmgD, dmgA}
function combatPreview(u, i) {
  const tg = enemyTarget(u, i);
  if (!tg || tg.civilians) return null;
  const T = UNITS[u.type];
  const ranged = !!T.ranged;
  let A = unitStrength(u, ranged ? 'ranged' : 'atk', tg.unit, idx(u.x, u.y));
  let D;
  if (tg.city) {
    D = cityStrength(tg.city);
    if (T.cls === 'siege') A *= 1.5;
    if (T.cls === 'mounted') A *= 0.67;
  } else D = unitStrength(tg.unit, 'def', u, i);
  const r = A / D;
  return { A, D, ranged, city: tg.city, unit: tg.unit, expD: Math.round(30 * Math.pow(r, 1.15)), expA: ranged ? 0 : Math.round(30 * Math.pow(1 / r, 1.15)) };
}

function canAttack(u, i) {
  if (!isMil(u) || u.moves <= 0) return false;
  const T = UNITS[u.type];
  const tg = enemyTarget(u, i);
  if (!tg) return false;
  const d = dist(u.x, u.y, ...xy(i));
  if (T.ranged) return d <= T.range && !tg.civilians;
  return d === 1;
}

function attack(u, i) {
  const pv = combatPreview(u, i);
  const tg = enemyTarget(u, i);
  if (!tg) return;
  if (tg.civilians) { stepUnit(u, i); u.moves = 0; return; }
  const T = UNITS[u.type];
  const r = pv.A / pv.D;
  const dD = dmgFor(r);
  const dA = pv.ranged ? 0 : dmgFor(1 / r);
  u.moves = 0; u.fort = false; u.acted = true; u.sleep = false;
  const atkName = `${civ(u.civ).adj} ${T.name.toLowerCase()}`;
  if (tg.city) {
    const c = tg.city;
    c.hp = Math.max(pv.ranged ? 1 : 0, c.hp - dD);
    c.lastAttacked = G.turn;
    u.hp -= dA;
    meet(u.civ, c.civ);
    if (u.hp <= 0) {
      killUnit(u);
      notify(u.civ, `Din ${T.name.toLowerCase()} faldt i angrebet på ${c.name}.`, i, 'bad');
      notify(c.civ, `${c.name} slog et angreb fra en ${atkName} tilbage.`, i, 'good');
      return;
    }
    if (!pv.ranged && c.hp <= 0) captureCity(u, c);
    else {
      notify(u.civ, `Angreb på ${c.name}: byen mistede ${dD} liv${dA ? `, din enhed mistede ${dA}` : ''}.`, i);
      notify(c.civ, `${c.name} blev angrebet af en ${atkName} (−${dD} liv).`, i, 'bad');
    }
    return;
  }
  const d = tg.unit;
  meet(u.civ, d.civ);
  d.hp -= dD; u.hp -= dA;
  const defName = `${civ(d.civ).adj} ${UNITS[d.type].name.toLowerCase()}`;
  if (d.hp <= 0) {
    killUnit(d);
    notify(u.civ, `Din ${T.name.toLowerCase()} besejrede en ${defName}.`, i, 'good');
    notify(d.civ, `Din ${UNITS[d.type].name.toLowerCase()} blev dræbt af en ${atkName}.`, i, 'bad');
    if (Math.random() < 0.35) u.vet = true;
  } else {
    notify(u.civ, `Kamp: fjenden mistede ${dD} liv${dA ? `, din enhed mistede ${dA}` : ''}.`, i);
    notify(d.civ, `Din ${UNITS[d.type].name.toLowerCase()} blev angrebet af en ${atkName} (−${dD} liv).`, i, 'bad');
  }
  if (u.hp <= 0) {
    killUnit(u);
    notify(u.civ, `Din ${T.name.toLowerCase()} døde i kampen.`, i, 'bad');
    notify(d.civ, `Din ${UNITS[d.type].name.toLowerCase()} vandt en forsvarskamp.`, i, 'good');
    if (d.hp > 0 && Math.random() < 0.35) d.vet = true;
    return;
  }
  // nærkamp rykker frem hvis feltet er tomt
  if (!pv.ranged && d.hp <= 0 && !unitsAt(i).some(v => v.civ !== u.civ && isMil(v)) && !cityAt(i)) {
    const mv = u.moves; u.moves = 1; stepUnit(u, i); u.moves = 0; void mv;
  }
}

function captureCity(u, c) {
  const old = c.civ;
  const i = idx(c.x, c.y);
  for (const v of unitsAt(i)) if (v.civ !== u.civ) killUnit(v);
  u.moves = 1; stepUnit(u, i); u.moves = 0;
  c.civ = u.civ; c.capital = false; c.pop = Math.max(1, c.pop - 1); c.hp = 40; c.prod = 0; c.build = null;
  c.blds = c.blds.filter(b => b !== 'walls' && b !== 'barracks');
  for (const t of G.tiles) if (t.city === c.id) t.owner = u.civ;
  notify(u.civ, `Du har erobret ${c.name}!`, i, 'good');
  notify(old, `${c.name} er faldet til ${civ(u.civ).name}!`, i, 'bad');
  if (!civ(u.civ).human) aiChooseBuild(c);
  // ny hovedstad
  const oc = civCities(old);
  if (oc.length && !oc.some(x => x.capital)) oc.sort((a, b) => b.pop - a.pop)[0].capital = true;
  checkElimination(old, u.civ);
  assignAllTiles();
  if (u.civ === G.human || old === G.human) updateVisibility();
}

function checkElimination(cid, by) {
  const c = civ(cid);
  if (!c.alive) return;
  if (civCities(cid).length === 0 && !civUnits(cid).some(u => u.type === 'settler')) {
    c.alive = false;
    G.units.filter(u => u.civ === cid).forEach(killUnit);
    for (let o = 0; o < G.civs.length; o++) { G.war[o][cid] = G.war[cid][o] = false; }
    notify(-1, `${c.name} er blevet udslettet${by != null ? ` af ${civ(by).name}` : ''}.`, null, by === G.human ? 'good' : 'bad');
    checkVictory();
  }
}

// Byer skyder automatisk på nærmeste fjende
function cityStrikes(cid) {
  for (const c of civCities(cid)) {
    if (c.struckTurn === G.turn) continue;
    let best = null, bh = 999;
    for (const u of G.units) {
      if (!atWar(cid, u.civ) || !isMil(u)) continue;
      if (dist(c.x, c.y, u.x, u.y) > 2) continue;
      if (u.hp < bh) { bh = u.hp; best = u; }
    }
    if (!best) continue;
    c.struckTurn = G.turn;
    const A = cityStrength(c) * 0.75;
    const D = unitStrength(best, 'def', null, idx(best.x, best.y));
    const d = dmgFor(A / D);
    best.hp -= d;
    const bi = idx(best.x, best.y);
    if (best.hp <= 0) {
      killUnit(best);
      notify(cid, `${c.name} skød en ${civ(best.civ).adj} ${UNITS[best.type].name.toLowerCase()} ned.`, bi, 'good');
      notify(best.civ, `Din ${UNITS[best.type].name.toLowerCase()} blev dræbt af ${c.name}s forsvarsværker.`, bi, 'bad');
    } else {
      notify(best.civ, `${c.name} beskød din ${UNITS[best.type].name.toLowerCase()} (−${d} liv).`, bi, 'bad');
    }
  }
}

// ---------- Byer ----------
function cityNameFor(c) {
  const def = CIVS.find(x => x.key === c.key);
  const used = new Set(G.cities.map(x => x.name));
  for (let k = 0; k < def.cities.length; k++) {
    const n = def.cities[(c.cityNameIdx + k) % def.cities.length];
    if (!used.has(n)) { c.cityNameIdx += k + 1; return n; }
  }
  c.cityNameIdx++;
  return `Ny ${def.cities[c.cityNameIdx % def.cities.length]}`;
}

function canFoundCity(u) {
  if (u.type !== 'settler') return false;
  const i = idx(u.x, u.y);
  if (!passable(i)) return false;
  const t = G.tiles[i];
  if (t.owner >= 0 && t.owner !== u.civ) return false;
  return !G.cities.some(c => dist(c.x, c.y, u.x, u.y) < 3);
}

function foundCity(u) {
  const cv = civ(u.civ);
  const i = idx(u.x, u.y);
  const c = { id: G.nextId++, name: cityNameFor(cv), civ: u.civ, x: u.x, y: u.y, pop: 1, food: 0, prod: 0, build: null,
    blds: [], hp: 100, capital: civCities(u.civ).length === 0, culture: 0, nextBorder: 12, borderClaims: 0,
    worked: [], founded: G.turn, lastAttacked: -10, struckTurn: -1 };
  G.cities.push(c);
  killUnit(u);
  claimTile(i, c);
  for (const j of tilesInRadius(u.x, u.y, 1)) if (G.tiles[j].owner < 0) claimTile(j, c);
  G.tiles[i].road = true;
  if (G.tiles[i].t === 'forest' || G.tiles[i].t === 'jungle') G.tiles[i].t = 'plains';
  cv.everCity = true;
  assignAllTiles();
  if (cv.human) { updateVisibility(); notify(cv.id, `${c.name} er grundlagt.`, i, 'good'); }
  else aiChooseBuild(c);
  return c;
}

function claimTile(i, c) { G.tiles[i].owner = c.civ; G.tiles[i].city = c.id; }

function tileYield(i, c) {
  const t = G.tiles[i]; const T = TERRAIN[t.t];
  let f = T.f, p = T.p, tr = T.t;
  if (t.res) { const R = RESOURCES[t.res]; f += R.f; p += R.p; tr += R.t; }
  if (t.imp === 'farm') f += 1;
  if (t.imp === 'farm' && c && hasTech(civ(c.civ), 'industry')) f += 1;
  if (t.imp === 'mine') p += t.t === 'hills' ? 2 : 1;
  if (t.road && ['grass', 'plains', 'desert', 'tundra'].includes(t.t)) tr += 1;
  if (T.water && c && G.wonders.colossus === c.id) tr += 1;
  if (T.water && c && hasTech(civ(c.civ), 'astronomy')) f += 1;
  return { f, p, t: tr };
}

function cityWorkable(c) {
  return tilesInRadius(c.x, c.y, 3).filter(j => G.tiles[j].city === c.id && j !== idx(c.x, c.y));
}

function assignAllTiles() {
  const taken = new Set();
  for (const c of G.cities) {
    const cands = cityWorkable(c).filter(j => !taken.has(j) && !G.units.some(u => u.x === xy(j)[0] && u.y === xy(j)[1] && atWar(u.civ, c.civ)));
    const scored = cands.map(j => { const y = tileYield(j, c); return { j, s: y.f * 2.6 + y.p * 2 + y.t * 1.2 }; });
    scored.sort((a, b) => b.s - a.s);
    c.worked = scored.slice(0, c.pop).map(o => o.j);
    c.worked.forEach(j => taken.add(j));
  }
}

function civHasWonder(cid, k) { const id = G.wonders[k]; if (id == null) return false; const c = cityById(id); return c && c.civ === cid; }

function cityYields(c) {
  const cv = civ(c.civ);
  const ci = idx(c.x, c.y);
  const cy = tileYield(ci, c);
  let f = Math.max(2, cy.f), p = Math.max(1, cy.p), t = cy.t + 1;
  for (const j of c.worked) { const y = tileYield(j, c); f += y.f; p += y.p; t += y.t; }
  const unworked = Math.max(0, c.pop - c.worked.length); // specialister
  p += unworked; t += unworked;
  t += c.pop;
  if (c.capital) { t += 2; p += 1; }
  if (c.blds.includes('granary')) f += 2;
  if (civHasWonder(c.civ, 'gardens')) f += 1;
  let pm = 1;
  if (c.blds.includes('workshop')) pm += 0.25;
  if (c.blds.includes('factory')) pm += 0.5;
  if (c.blds.includes('powerplant')) pm += 0.5;
  if (G.wonders.pyramids === c.id) pm += 0.25;
  if (civHasWonder(c.civ, 'hoover')) pm += 0.25;
  let sm = 1;
  if (c.blds.includes('library')) sm += 0.5;
  if (c.blds.includes('university')) sm += 0.5;
  if (c.blds.includes('lab')) sm += 0.75;
  if (G.wonders.newton === c.id) sm += 1;
  let gm = 1;
  if (c.blds.includes('market')) gm += 0.5;
  if (c.blds.includes('bank')) gm += 0.5;
  const ai = cv.human ? 1 : DIFFICULTY[G.difficulty].ai;
  const prod = Math.round(p * pm * ai);
  let sci = t * cv.sciRate * sm * ai;
  if (G.wonders.library === c.id) sci += 8;
  const gold = t * (1 - cv.sciRate) * gm * ai;
  const foodNet = f - c.pop * 2;
  const cap = c.blds.includes('aqueduct') ? 30 : 8;
  let culture = 1 + (c.blds.includes('temple') ? 3 : 0) + (c.capital ? 1 : 0);
  culture += Object.values(G.wonders).filter(id => id === c.id).length * 2;
  return { f, p: prod, t, sci: Math.round(sci * 10) / 10, gold: Math.round(gold * 10) / 10, foodNet, need: growthNeed(c.pop), cap, culture };
}
function growthNeed(pop) { return Math.floor(15 + 7 * (pop - 1) + Math.pow(pop - 1, 1.7)); }

function buildCost(b) {
  if (!b) return 0;
  if (b.kind === 'unit') return UNITS[b.key].cost;
  if (b.kind === 'bld') return BUILDINGS[b.key].cost;
  if (b.kind === 'wonder') return WONDERS[b.key].cost;
  if (b.kind === 'proj') return PROJECTS[b.key].cost;
  return 0;
}
function buildName(b) {
  if (!b) return 'Intet';
  return (b.kind === 'unit' ? UNITS : b.kind === 'bld' ? BUILDINGS : b.kind === 'wonder' ? WONDERS : PROJECTS)[b.key].name;
}

function unitObsolete(cv, k) { const o = UNITS[k].obs; return o && cv.techs.includes(o); }

function buildOptions(c) {
  const cv = civ(c.civ);
  const out = [];
  for (const k in UNITS) {
    const U = UNITS[k];
    if (!hasTech(cv, U.tech) || unitObsolete(cv, k)) continue;
    out.push({ kind: 'unit', key: k, ok: k !== 'settler' || c.pop >= 2 });
  }
  for (const k in BUILDINGS) if (hasTech(cv, BUILDINGS[k].tech) && !c.blds.includes(k)) out.push({ kind: 'bld', key: k, ok: true });
  for (const k in WONDERS) if (hasTech(cv, WONDERS[k].tech) && G.wonders[k] == null) out.push({ kind: 'wonder', key: k, ok: !G.cities.some(o => o !== c && o.civ === c.civ && o.build && o.build.kind === 'wonder' && o.build.key === k) });
  for (const k in PROJECTS) if (hasTech(cv, PROJECTS[k].tech)) out.push({ kind: 'proj', key: k, ok: true });
  return out;
}

function buyCost(c) {
  if (!c.build || c.build.kind === 'proj') return Infinity;
  const left = Math.max(0, buildCost(c.build) - c.prod);
  const k = c.build.kind === 'wonder' ? 4 : 2;
  return Math.ceil(left * k + Math.pow(left, 1.15) * 0.3) + 10;
}

function processCity(c) {
  const cv = civ(c.civ);
  const y = cityYields(c);
  // vækst
  c.food += y.foodNet;
  if (c.food >= y.need) {
    if (c.pop < y.cap) {
      c.pop++; c.food = c.blds.includes('granary') ? Math.floor(y.need * 0.25) : 0;
      if (cv.human && (c.pop % 3 === 0)) notify(cv.id, `${c.name} er vokset til ${c.pop} indbyggere.`, idx(c.x, c.y));
    } else {
      c.food = y.need;
      if (cv.human && c.pop === 8 && !c.warnedAq) { c.warnedAq = true; notify(cv.id, `${c.name} kan ikke vokse mere uden en akvædukt.`, idx(c.x, c.y), 'warn'); }
    }
  } else if (c.food < 0) {
    if (c.pop > 1) { c.pop--; c.food = 0; notify(cv.id, `Hungersnød i ${c.name}! Byen mistede en indbygger.`, idx(c.x, c.y), 'bad'); }
    else c.food = 0;
  }
  // grænser
  c.culture += y.culture;
  if (c.culture >= c.nextBorder) {
    c.culture -= c.nextBorder;
    c.borderClaims++;
    c.nextBorder = Math.floor(12 + c.borderClaims * 5 + Math.pow(c.borderClaims, 1.4));
    expandBorder(c);
  }
  // liv
  c.hp = Math.min(100, c.hp + (G.turn - c.lastAttacked > 1 ? 15 : 6));
  // produktion
  if (!c.build) { if (!cv.human) aiChooseBuild(c); }
  if (!c.build) { return y; }
  if (c.build.kind === 'proj' && c.build.key === 'wealth') { cv.gold += y.p * 0.5; return y; }
  c.prod += y.p;
  const cost = buildCost(c.build);
  if (c.prod >= cost) {
    const b = c.build;
    if (b.kind === 'unit') {
      if (b.key === 'settler' && c.pop < 2) return y;
      c.prod -= cost;
      if (b.key === 'settler') c.pop--;
      const u = createUnit(c.civ, b.key, c.x, c.y, c.blds.includes('barracks') && isMil({ type: b.key }));
      u.moves = UNITS[b.key].moves;
      notify(cv.id, `${c.name} har færdiggjort: ${UNITS[b.key].name}.`, idx(c.x, c.y), 'good');
      c.build = null;
    } else if (b.kind === 'bld') {
      c.prod -= cost; c.blds.push(b.key); c.build = null;
      notify(cv.id, `${c.name} har bygget: ${BUILDINGS[b.key].name}.`, idx(c.x, c.y), 'good');
    } else if (b.kind === 'wonder') {
      if (G.wonders[b.key] != null) {
        notify(cv.id, `${WONDERS[b.key].name} er allerede bygget andetsteds. Produktionen er gemt.`, idx(c.x, c.y), 'warn');
        c.build = null;
      } else {
        c.prod -= cost; G.wonders[b.key] = c.id; c.build = null;
        notify(-1, `${civ(c.civ).name} har fuldført vidunderet ${WONDERS[b.key].name} i ${c.name}.`, idx(c.x, c.y), cv.human ? 'good' : 'info');
        for (const o of G.cities) if (o !== c && o.build && o.build.kind === 'wonder' && o.build.key === b.key) { o.build = null; notify(o.civ, `${o.name} kan ikke længere bygge ${WONDERS[b.key].name}.`, idx(o.x, o.y), 'warn'); }
      }
    } else if (b.kind === 'proj' && b.key === 'spaceship') {
      c.prod -= cost; c.build = null;
      G.over = { winner: c.civ, how: 'rum' };
      notify(-1, `${civ(c.civ).name}s rumskib er sendt mod Alpha Centauri!`, idx(c.x, c.y), cv.human ? 'good' : 'bad');
    }
    if (!c.build && !cv.human) aiChooseBuild(c);
    if (!c.build && cv.human) notify(cv.id, `${c.name} mangler noget at producere.`, idx(c.x, c.y), 'warn');
  }
  return y;
}

function expandBorder(c) {
  let best = -1, bs = -Infinity;
  for (const j of tilesInRadius(c.x, c.y, 3)) {
    const t = G.tiles[j];
    if (t.owner >= 0) continue;
    const [jx, jy] = xy(j);
    if (!neighbors(jx, jy).some(n => G.tiles[n].city === c.id)) continue;
    const y = tileYield(j, c);
    const s = y.f * 2 + y.p * 1.6 + y.t + (t.res ? 3 : 0) - distI(j, idx(c.x, c.y)) * 1.5 + Math.random();
    if (s > bs) { bs = s; best = j; }
  }
  if (best >= 0) { claimTile(best, c); assignAllTiles(); }
}

// ---------- Arbejdere ----------
const WORKS = {
  farm: { name: 'Byg farm', turns: 5 },
  mine: { name: 'Byg mine', turns: 6 },
  road: { name: 'Byg vej', turns: 3 },
  chop: { name: 'Ryd skov', turns: 4 },
};
function canWork(u, kind) { return canWorkAt(u, kind, idx(u.x, u.y)); }
function canWorkAt(u, kind, i) {
  if (u.type !== 'worker') return false;
  const t = G.tiles[i];
  const cv = civ(u.civ);
  if (!hasTech(cv, IMPROVEMENT_TECH[kind])) return false;
  if (t.owner >= 0 && t.owner !== u.civ) return false;
  if (cityAt(i) && kind !== 'chop') return false;
  if (kind === 'road') return !t.road;
  if (kind === 'chop') return t.t === 'forest' || t.t === 'jungle';
  if (kind === 'farm') return t.imp !== 'farm' && ['grass', 'plains', 'desert', 'tundra'].includes(t.t);
  if (kind === 'mine') return t.imp !== 'mine' && (t.t === 'hills' || t.res === 'iron' || t.res === 'gold' || t.t === 'desert');
  return false;
}
function startWork(u, kind) { u.work = { kind, left: WORKS[kind].turns }; u.moves = 0; u.path = null; u.fort = false; }
function progressWork(u) {
  if (!u.work) return;
  u.work.left--;
  if (u.work.left > 0) return;
  const i = idx(u.x, u.y), t = G.tiles[i];
  const k = u.work.kind;
  if (k === 'road') t.road = true;
  else if (k === 'farm') t.imp = 'farm';
  else if (k === 'mine') t.imp = 'mine';
  else if (k === 'chop') {
    t.t = t.t === 'jungle' ? 'grass' : 'plains';
    if (t.res && !RESOURCES[t.res].on.includes(t.t)) t.res = null;
    const near = civCities(u.civ).sort((a, b) => dist(a.x, a.y, u.x, u.y) - dist(b.x, b.y, u.x, u.y))[0];
    if (near && dist(near.x, near.y, u.x, u.y) <= 4) { near.prod += 20; notify(u.civ, `Tømmeret gav 20 produktion til ${near.name}.`, i); }
  }
  u.work = null;
  assignAllTiles();
}

// ---------- Synsfelt og kontakt ----------
let VIS = null;
function updateVisibility() {
  VIS = new Uint8Array(G.w * G.h);
  const h = G.human;
  for (const u of G.units) {
    if (u.civ !== h) continue;
    let r = u.type === 'scout' ? 3 : 2;
    if (G.tiles[idx(u.x, u.y)].t === 'hills') r++;
    for (const j of tilesInRadius(u.x, u.y, r)) { VIS[j] = 1; G.explored[j] = 1; }
  }
  for (const c of G.cities) {
    if (c.civ !== h) continue;
    for (const j of tilesInRadius(c.x, c.y, 3)) { VIS[j] = 1; G.explored[j] = 1; }
  }
  for (let j = 0; j < G.tiles.length; j++) if (G.tiles[j].owner === h) {
    VIS[j] = 1; G.explored[j] = 1;
    const [x, y] = xy(j); for (const n of neighbors(x, y)) { VIS[n] = 1; G.explored[n] = 1; }
  }
  // kontakt
  for (const u of G.units) if (u.civ !== h && VIS[idx(u.x, u.y)]) meet(h, u.civ);
  for (const c of G.cities) if (c.civ !== h && VIS[idx(c.x, c.y)]) meet(h, c.civ);
}
function meet(a, b) {
  if (a === b || G.met[a][b]) return;
  G.met[a][b] = G.met[b][a] = true;
  if (a === G.human || b === G.human) {
    const o = a === G.human ? b : a;
    notify(G.human, `Du har mødt ${civ(o).name}.`, null, 'info');
  }
}
function meetCheck(cid, i) {
  if (VIS && VIS[i]) meet(G.human, cid);
}

function declareWar(a, b) {
  if (G.war[a][b]) return;
  G.war[a][b] = G.war[b][a] = true;
  G.warSince[a][b] = G.warSince[b][a] = G.turn;
  meet(a, b);
  if (a === G.human) notify(G.human, `Du har erklæret krig mod ${civ(b).name}.`, null, 'bad');
  else if (b === G.human) notify(G.human, `${civ(a).name} har erklæret krig mod dig!`, null, 'bad');
  else if (G.met[G.human][a] || G.met[G.human][b]) notify(G.human, `${civ(a).name} har erklæret krig mod ${civ(b).name}.`, null, 'info');
}
function makePeace(a, b) {
  if (!G.war[a][b]) return;
  G.war[a][b] = G.war[b][a] = false;
  G.warSince[a][b] = G.warSince[b][a] = G.turn;
  if (a === G.human || b === G.human) notify(G.human, `Der er nu fred mellem dig og ${civ(a === G.human ? b : a).name}.`, null, 'good');
  else if (G.met[G.human][a] || G.met[G.human][b]) notify(G.human, `${civ(a).name} og ${civ(b).name} har sluttet fred.`, null, 'info');
  // fjern enheder fra fremmed territorium? De bliver stående.
}

function milPower(cid) {
  let s = 0;
  for (const u of G.units) if (u.civ === cid && isMil(u)) { const T = UNITS[u.type]; s += Math.max(T.str, T.ranged || 0) * (u.hp / 100); }
  return s + civCities(cid).length * 4;
}

function score(cid) {
  const cs = civCities(cid);
  const pop = cs.reduce((a, c) => a + c.pop, 0);
  const w = Object.values(G.wonders).filter(id => { const c = cityById(id); return c && c.civ === cid; }).length;
  return cs.length * 8 + pop * 4 + civ(cid).techs.length * 5 + w * 20;
}

// ---------- Turgang ----------
function beginCivTurn(cid) {
  const cv = civ(cid);
  if (!cv.alive) return;
  for (const u of civUnits(cid)) {
    if (u.work) progressWork(u);
    if (!u.acted && u.hp < 100) {
      const i = idx(u.x, u.y);
      const inCity = cityAt(i) && cityAt(i).civ === cid;
      u.hp = Math.min(100, u.hp + (inCity ? 25 : G.tiles[i].owner === cid ? 15 : 10));
    }
    u.acted = false;
    u.moves = u.work ? 0 : UNITS[u.type].moves;
  }
  assignAllTiles();
  let sci = 0, gold = 0;
  for (const c of civCities(cid)) { const y = processCity(c); sci += y.sci; gold += y.gold; }
  // forskning
  cv.sci += sci;
  if (cv.research) {
    const cost = techCost(cv, cv.research);
    if (cv.sci >= cost) {
      cv.sci -= cost;
      const k = cv.research;
      cv.techs.push(k); cv.research = null;
      notify(cid, `Dine lærde har opdaget ${TECHS[k].name}!`, null, 'good');
      if (!cv.human) aiChooseResearch(cv);
    }
  } else if (!cv.human) aiChooseResearch(cv);
  // økonomi
  cv.gold += gold - upkeep(cid);
  cv.lastIncome = Math.round((gold - upkeep(cid)) * 10) / 10;
  if (cv.gold < 0) {
    const mil = civUnits(cid).filter(u => isMil(u));
    if (mil.length) {
      const u = mil.sort((a, b) => UNITS[a.type].str - UNITS[b.type].str)[0];
      killUnit(u);
      notify(cid, `Statskassen er tom: en ${UNITS[u.type].name.toLowerCase()} er blevet hjemsendt.`, idx(u.x, u.y), 'bad');
    }
    cv.gold = 0;
  }
  cv.gold = Math.round(cv.gold * 10) / 10;
}

function upkeep(cid) {
  const cs = civCities(cid);
  const units = civUnits(cid).filter(u => u.type !== 'settler').length;
  const free = Math.max(3, cs.length * 2);
  let u = Math.max(0, units - free) * 1;
  const smith = civHasWonder(cid, 'adamsmith');
  for (const c of cs) for (const b of c.blds) { const k = BUILDINGS[b].upkeep; if (!(smith && k === 1)) u += k; }
  return u;
}

function civIncome(cid) {
  let sci = 0, gold = 0;
  for (const c of civCities(cid)) { const y = cityYields(c); sci += y.sci; gold += y.gold; }
  return { sci: Math.round(sci * 10) / 10, gold: Math.round((gold - upkeep(cid)) * 10) / 10 };
}

function endTurn() {
  if (G.over) return;
  const h = G.human;
  cityStrikes(h);
  for (const cv of G.civs) {
    if (cv.human || !cv.alive) continue;
    beginCivTurn(cv.id);
    aiPlay(cv);
    cityStrikes(cv.id);
    if (G.over) break;
  }
  G.turn++;
  beginCivTurn(h);
  // fortsæt kommandoer
  for (const u of civUnits(h)) {
    if (u.path) followPath(u);
    if (u.auto && u.type === 'worker' && !u.work) aiWorker(u);
  }
  updateVisibility();
  checkVictory();
}

function checkVictory() {
  if (G.over) return;
  const h = human();
  if (!h.alive || (civCities(h.id).length === 0 && h.everCity && !civUnits(h.id).some(u => u.type === 'settler'))) {
    h.alive = false;
    G.over = { winner: null, how: 'tab' }; return;
  }
  const others = G.civs.filter(c => !c.human && c.alive);
  if (!others.length) { G.over = { winner: h.id, how: 'erobring' }; return; }
  if (G.turn > 400) {
    const best = G.civs.filter(c => c.alive).sort((a, b) => score(b.id) - score(a.id))[0];
    G.over = { winner: best.id, how: 'point' };
  }
}

// ---------- Gem / indlæs ----------
const SAVE_KEY = 'imperium-save-v1';
function saveGame() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(G)); return true; } catch (e) { return false; }
}
function loadGame() {
  try {
    const s = localStorage.getItem(SAVE_KEY);
    if (!s) return null;
    G = JSON.parse(s);
    updateVisibility();
    return G;
  } catch (e) { return null; }
}
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
