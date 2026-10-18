// Spilregler: kort, enheder, byer, kamp, forskning, diplomati og turgang.
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
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// Kortet går rundt i x-retningen (som en globus)
function wrapX(x) { const w = G.w; return ((x % w) + w) % w; }
function idx(x, y) { return y * G.w + wrapX(x); }
function xy(i) { return [i % G.w, Math.floor(i / G.w)]; }
function inb(x, y) { return y >= 0 && y < G.h; }

const NB_EVEN = [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]];
const NB_ODD = [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]];
function neighbors(x, y) {
  const d = (y & 1) ? NB_ODD : NB_EVEN;
  const out = [];
  for (const [dx, dy] of d) { const ny = y + dy; if (ny >= 0 && ny < G.h) out.push(idx(x + dx, ny)); }
  return out;
}
function neighborsI(i) { const [x, y] = xy(i); return neighbors(x, y); }
function neighborDir(x, y, d) {
  const o = ((y & 1) ? NB_ODD : NB_EVEN)[d];
  const ny = y + o[1];
  return ny >= 0 && ny < G.h ? idx(x + o[0], ny) : -1;
}
function cube(x, y) { const q = x - (y - (y & 1)) / 2; return [q, y, -q - y]; }
function rawDist(x1, y1, x2, y2) {
  const a = cube(x1, y1), b = cube(x2, y2);
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
}
function dist(x1, y1, x2, y2) {
  const w = G.w;
  return Math.min(rawDist(x1, y1, x2, y2), rawDist(x1, y1, x2 - w, y2), rawDist(x1, y1, x2 + w, y2));
}
function distI(i, j) { const [a, b] = xy(i), [c, d] = xy(j); return dist(a, b, c, d); }
function tilesInRadius(x, y, r) {
  const out = [];
  for (let yy = y - r; yy <= y + r; yy++) {
    if (yy < 0 || yy >= G.h) continue;
    for (let xx = x - r - 1; xx <= x + r + 1; xx++)
      if (rawDist(x, y, xx, yy) <= r) out.push(idx(xx, yy));
  }
  return out;
}

// ---------- Kortgenerering ----------
// Støj der er periodisk i x, så kortets kanter mødes
function makeNoise(R, w, h, cells) {
  cells = Math.max(2, Math.round(cells));
  const scale = w / cells;
  const gw = cells, gh = Math.ceil(h / scale) + 3;
  const g = new Float32Array(gw * gh);
  for (let i = 0; i < g.length; i++) g[i] = R();
  const sm = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = x / scale, fy = y / scale;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = sm(fx - x0), ty = sm(fy - y0);
    const xa = ((x0 % gw) + gw) % gw, xb = (xa + 1) % gw;
    const a = g[y0 * gw + xa], b = g[y0 * gw + xb], c = g[(y0 + 1) * gw + xa], d = g[(y0 + 1) * gw + xb];
    const top = a + (b - a) * tx, bot = c + (d - c) * tx;
    return top + (bot - top) * ty;
  };
}

function generateTerrain(w, h, seed, mapType) {
  const R = mulberry32(seed);
  const isl = mapType === 'islands';
  const n1 = makeNoise(R, w, h, w / (isl ? 6 : 11)), n2 = makeNoise(R, w, h, w / (isl ? 3 : 5)), n3 = makeNoise(R, w, h, w / (isl ? 1.6 : 2.4));
  const m1 = makeNoise(R, w, h, w / 9), m2 = makeNoise(R, w, h, w / 3.5);
  const elev = new Float32Array(w * h), moist = new Float32Array(w * h);
  const c1 = R() * w, c2 = c1 + w / 2;
  const bump = (px, py, cx, rx, ry) => {
    let dx = Math.abs(px - cx) % w; dx = Math.min(dx, w - dx) / w;
    const dy = py / (h * 0.87) - 0.5;
    return Math.max(0, 1 - (dx / rx) ** 2 - (dy / ry) ** 2);
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const px = x + 0.5 * (y & 1), py = y * 0.87;
    let e = n1(px, py) * 0.55 + n2(px, py) * 0.3 + n3(px, py) * 0.15;
    if (mapType === 'pangaea') e += 0.5 * bump(px, py, c1, 0.4, 0.6) - 0.15;
    else if (mapType === 'continents') e += 0.5 * Math.max(bump(px, py, c1, 0.24, 0.55), bump(px, py, c2, 0.24, 0.55)) - 0.12;
    const dy = Math.abs(y / (h - 1) - 0.5) * 2;
    e -= Math.pow(dy, 4) * 0.5;
    elev[y * w + x] = e;
    moist[y * w + x] = m1(px, py) * 0.7 + m2(px, py) * 0.3;
  }
  let seaQ = isl ? 0.7 : mapType === 'pangaea' ? 0.62 : 0.6;
  let latArr = null;
  if (mapType === 'earth') {
    const ef = earthFields(w, h, (px, py) => n1(px, py) * 0.55 + n2(px, py) * 0.3 + n3(px, py) * 0.15, (px, py) => m1(px, py) * 0.7 + m2(px, py) * 0.3);
    elev.set(ef.elev); moist.set(ef.moist); latArr = ef.lats; seaQ = ef.seaQ;
  }
  const land = 1 - seaQ;
  const sorted = Array.from(elev).sort((a, b) => a - b);
  const q = (f) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * f))];
  const seaLevel = q(seaQ), mountLevel = q(1 - land * 0.07), hillLevel = q(1 - land * 0.26);
  const tiles = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, e = elev[i], m = moist[i];
    const lat = latArr ? latArr[i] : Math.abs(y / (h - 1) - 0.5) * 2;
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
    tiles.push({ t, res: null, imp: null, road: false, river: false, riverTo: -1, owner: -1, city: -1, deco: Math.floor(R() * 1000) });
  }
  const oldG = G; G = { w, h };
  // kyst
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i].t !== 'ocean') continue;
    if (neighborsI(i).some(j => !TERRAIN[tiles[j].t].water)) tiles[i].t = 'coast';
  }
  // floder løber ned ad bakke fra bakker og bjerge mod havet
  const isLand = (i) => !TERRAIN[tiles[i].t].water;
  const sources = [];
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i].t;
    if (t === 'hills' || (isLand(i) && t !== 'mountain' && neighborsI(i).some(j => tiles[j].t === 'mountain'))) sources.push(i);
  }
  const nRivers = Math.round(w * h / 75);
  for (let k = 0; k < nRivers && sources.length; k++) {
    const s = sources.splice(Math.floor(R() * sources.length), 1)[0];
    if (tiles[s].river || tiles[s].t === 'snow') continue;
    const path = []; const seen = new Set([s]); let cur = s; let end = -1; let reached = false;
    for (let step = 0; step < 30; step++) {
      path.push(cur);
      const nb = neighborsI(cur);
      const water = nb.find(j => !isLand(j));
      if (water != null) { end = water; reached = true; break; }
      const merge = nb.find(j => tiles[j].river && !seen.has(j));
      if (merge != null && step > 0) { end = merge; reached = true; break; }
      let best = -1, be = elev[cur] + 0.01;
      for (const j of nb) if (!seen.has(j) && tiles[j].t !== 'mountain' && elev[j] < be) { be = elev[j]; best = j; }
      if (best < 0) break;
      seen.add(best); cur = best;
    }
    if (path.length < 3 || !reached) continue;
    for (let n = 0; n < path.length; n++) { tiles[path[n]].river = true; tiles[path[n]].riverTo = n + 1 < path.length ? path[n + 1] : end; }
  }
  // ressourcer
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i].t;
    const opts = Object.keys(RESOURCES).filter(k => RESOURCES[k].on.includes(t));
    const ch = t === 'coast' ? 0.07 : t === 'ocean' ? 0.015 : 0.11;
    if (opts.length && R() < ch) tiles[i].res = opts[Math.floor(R() * opts.length)];
  }
  // landmasser
  const comp = new Int32Array(tiles.length).fill(-1);
  const sizes = [];
  for (let i = 0; i < tiles.length; i++) {
    if (comp[i] >= 0 || !isLand(i)) continue;
    const id = sizes.length; let n = 0; const st = [i]; comp[i] = id;
    while (st.length) {
      const c = st.pop(); n++;
      for (const j of neighborsI(c)) if (comp[j] < 0 && isLand(j)) { comp[j] = id; st.push(j); }
    }
    sizes.push(n);
  }
  G = oldG;
  return { tiles, comp, sizes };
}

function tileBaseYield(tt, cv) {
  const T = TERRAIN[tt.t];
  let f = T.f, p = T.p, tr = T.t;
  if (tt.res && resVisible(tt.res, cv)) { f += RESOURCES[tt.res].f; p += RESOURCES[tt.res].p; tr += RESOURCES[tt.res].t; }
  if (tt.river && !T.water) tr += 1;
  if (tt.nat) { const N = NATURAL[tt.nat]; f += N.f; p += N.p; tr += N.t; }
  return { f, p, t: tr };
}

function siteScore(i, tiles) {
  const t = tiles[i];
  if (TERRAIN[t.t].water || t.t === 'mountain' || t.t === 'snow') return -1;
  const [x, y] = xy(i);
  let s = 0, coast = false;
  for (const j of tilesInRadius(x, y, 2)) {
    const tt = tiles[j];
    if (tt.owner >= 0 && j !== i) s -= 1;
    const yy = tileBaseYield(tt);
    if (tt.t === 'ocean') yy.f -= 0.5;
    s += yy.f * 1.4 + yy.p * 1.0 + yy.t * 0.5;
    if (tt.res && RESOURCES[tt.res].lux) s += 2;
    if (tt.res && RESOURCES[tt.res].strat && !RESOURCES[tt.res].reveal) s += 1.5;
    if (tt.nat && j !== i) s += 4;
    if (tt.t === 'coast' && distI(i, j) === 1) coast = true;
  }
  if (coast) s += 2;
  if (t.river) s += 3;
  if (t.t === 'hills') s += 2;
  if (t.t === 'grass' || t.t === 'plains') s += 1;
  return s;
}

function makeCiv(id, fields) {
  return Object.assign({
    id, human: false, techs: ['agriculture'], research: null, sci: 0, gold: 10, alive: true,
    cityNameIdx: 0, aggression: 0.6 + Math.random() * 0.8, sciRate: 0.6, everCity: false,
    minor: false, barb: false, gpp: 0, gpNext: 100, gpCount: 0, gpw: { sci: 0, mer: 0, eng: 0, gen: 0 }, ai: {},
  }, fields);
}

function newGame(opts) {
  const size = MAPSIZES[opts.size];
  const mapType = opts.mapType || 'continents';
  const dims = mapType === 'earth' ? EARTH_SIZES[opts.size] : size;
  const w = dims.w, h = dims.h;
  let gen, seed;
  for (let tries = 0; tries < 25; tries++) {
    seed = Math.floor(Math.random() * 1e9);
    gen = generateTerrain(w, h, seed, mapType);
    const big = gen.sizes.filter(s => s >= 30).reduce((a, b) => a + b, 0);
    const landT = gen.sizes.reduce((a, b) => a + b, 0);
    if (mapType === 'earth' || (mapType === 'islands' ? gen.sizes.filter(s => s >= 14).length >= 4 : big > landT * 0.6)) break;
  }
  const humanKeys = (opts.humans && opts.humans.length ? opts.humans : [opts.civ]).filter((k, i, a) => a.indexOf(k) === i);
  const majorKeys = [...humanKeys, ...shuffle(CIVS.map(c => c.key).filter(k => !humanKeys.includes(k))).slice(0, opts.opponents)];
  const nMinor = opts.minors != null ? opts.minors : size.minors;
  const minorDefs = shuffle(MINORS.slice()).slice(0, nMinor);
  G = {
    version: 2, w, h, seed, mapType, tiles: gen.tiles, units: [], cities: [], civs: [], turn: 1, nextId: 1,
    wonders: {}, human: 0, explored: new Array(w * h).fill(0), difficulty: opts.difficulty,
    war: [], met: [], warSince: [], over: null, log: [], routes: [], camps: [], offers: [],
    tutorial: { on: opts.tutorial !== false, step: 0 },
    pace: PACES[opts.pace] ? opts.pace : 'standard',
    victories: Object.assign({ conquest: true, space: true, culture: true, diplo: true }, opts.victories || {}),
  };
  majorKeys.forEach((k, n) => {
    const def = CIVS.find(c => c.key === k);
    G.civs.push(makeCiv(n, { key: k, name: def.name, adj: def.adj, color: def.color, human: n < humanKeys.length }));
  });
  minorDefs.forEach(def => {
    const id = G.civs.length;
    G.civs.push(makeCiv(id, { key: def.key, name: def.name, adj: def.name, color: def.color, minor: true, mtype: def.type, inf: [], ally: null, allyWars: [], giftTimer: {}, aggression: 0 }));
  });
  G.barb = G.civs.length;
  G.civs.push(makeCiv(G.barb, { key: 'barb', name: BARB.name, adj: BARB.adj, color: BARB.color, barb: true, aggression: 2 }));
  const n = G.civs.length;
  for (let a = 0; a < n; a++) { G.war.push(new Array(n).fill(false)); G.met.push(new Array(n).fill(false)); G.warSince.push(new Array(n).fill(0)); G.met[a][a] = true; }
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
    if (a === b) continue;
    if (!G.civs[a].human && !G.civs[b].human) G.met[a][b] = true;
    if (a === G.barb || b === G.barb) G.war[a][b] = true;
  }
  for (const m of G.civs) if (m.minor) m.inf = new Array(n).fill(0);
  ensureRealmState();
  G.humans = humanKeys.map((k, i) => i);
  G.exploredBy = {};
  for (const id of G.humans) G.exploredBy[id] = new Array(w * h).fill(0);
  G.explored = G.exploredBy[0];
  ensureWorldState();

  // startpositioner
  const nStart = majorKeys.length + minorDefs.length;
  const minSize = mapType === 'islands' ? 12 : 25;
  let cands = [];
  for (let i = 0; i < gen.tiles.length; i++) {
    if (gen.comp[i] < 0 || gen.sizes[gen.comp[i]] < minSize) continue;
    const t = gen.tiles[i].t;
    if (!['grass', 'plains', 'hills'].includes(t)) continue;
    const [, y] = xy(i);
    if (y < 3 || y > h - 4) continue;
    cands.push({ i, s: siteScore(i, gen.tiles) + Math.min(gen.sizes[gen.comp[i]], 150) * 0.03 });
  }
  if (cands.length < nStart * 3) {
    for (let i = 0; i < gen.tiles.length; i++) if (gen.comp[i] >= 0 && ['grass', 'plains', 'hills', 'forest'].includes(gen.tiles[i].t)) cands.push({ i, s: siteScore(i, gen.tiles) });
  }
  cands.sort((a, b) => b.s - a.s);
  cands = cands.slice(0, Math.max(60, Math.floor(cands.length * 0.55)));
  const starts = [];
  if (mapType === 'earth') {
    const cset = new Set(cands.map(c => c.i));
    for (const cv of G.civs) {
      if (cv.barb) continue;
      const def = (cv.minor ? MINORS : CIVS).find(d => d.key === cv.key);
      let st = earthStart(def && def.lat, def && def.lon, starts, cset);
      if (st == null) {
        let best = null, bd = -1;
        for (const c of cands) { if (starts.includes(c.i)) continue; const md = starts.length ? Math.min(...starts.map(x => distI(x, c.i))) : 99; if (md > bd) { bd = md; best = c.i; } }
        st = best;
      }
      starts.push(st);
    }
  } else starts.push(pick(cands.slice(0, 15)).i);
  while (starts.length < nStart) {
    let best = null, bd = -1;
    for (const c of cands) {
      if (starts.includes(c.i)) continue;
      const md = Math.min(...starts.map(s => distI(s, c.i)));
      const v = md + c.s * (starts.length < majorKeys.length ? 0.08 : 0.02);
      if (v > bd) { bd = v; best = c.i; }
    }
    if (best == null) break;
    starts.push(best);
  }
  ensureStartResources(starts, majorKeys.length);
  placeRuinsAndWonders(starts);
  G.civs.forEach((cv, k) => {
    if (cv.barb || starts[k] == null) return;
    const [x, y] = xy(starts[k]);
    createUnit(cv.id, 'settler', x, y);
    const nb = neighbors(x, y).filter(j => landPassable(j));
    const [wx, wy] = nb.length ? xy(nb[0]) : [x, y];
    createUnit(cv.id, 'warrior', wx, wy);
    if (cv.minor) return;
    const [sx, sy] = nb.length > 1 ? xy(nb[1]) : [wx, wy];
    createUnit(cv.id, 'scout', sx, sy);
    if (!cv.human && opts.difficulty === 'hard') createUnit(cv.id, 'warrior', x, y);
  });
  G.civs.forEach(c => { if (!c.human && !c.barb) aiChooseResearch(c); });
  updateVisibility();
  return G;
}

// ---------- Generelt ----------
function civ(id) { return G.civs[id]; }
function human() { return G.civs[G.human]; }
function isMajor(c) { return !c.minor && !c.barb; }
function majors() { return G.civs.filter(isMajor); }
function hasTech(c, k) { return !k || c.techs.includes(k); }
function cityAt(i) { const [x, y] = xy(i); return G.cities.find(c => c.x === x && c.y === y) || null; }
function cityById(id) { return G.cities.find(c => c.id === id) || null; }
function unitsAt(i) { const [x, y] = xy(i); return G.units.filter(u => u.x === x && u.y === y); }
function unitById(id) { return G.units.find(u => u.id === id) || null; }
function civCities(cid) { return G.cities.filter(c => c.civ === cid); }
function civUnits(cid) { return G.units.filter(u => u.civ === cid); }
function capitalOf(cid) { return G.cities.find(c => c.civ === cid && c.capital) || civCities(cid)[0] || null; }
function isMil(u) { return UNITS[u.type].str > 0; }
function isSea(u) { return UNITS[u.type].domain === 'sea'; }
function isWater(i) { return !!TERRAIN[G.tiles[i].t].water; }
function embarked(u) { return !isSea(u) && isWater(idx(u.x, u.y)); }
function atWar(a, b) { return a !== b && G.war[a][b]; }
function landPassable(i) { return !isWater(i) && G.tiles[i].t !== 'mountain'; }
function cityCoastal(c) { return neighbors(c.x, c.y).some(j => isWater(j)); }
function freshWater(i) { return G.tiles[i].river || neighborsI(i).some(j => G.tiles[j].river); }
function campAt(i) { return G.camps.find(k => k.i === i) || null; }
function yearOf(turn) {
  const T = 1 + (turn - 1) / paceK();
  const rate = (t) => t < 75 ? 40 : t < 135 ? 25 : t < 200 ? 15 : t < 270 ? 5 : 2;
  let y = -4000, t = 1;
  for (; t + 1 <= T; t++) y += rate(t);
  y += rate(t) * (T - t);
  return Math.round(y);
}
function yearLabel(turn) { const y = yearOf(turn); return y < 0 ? `${-y} f.Kr.` : `${y} e.Kr.`; }
function techCost(c, k) {
  const base = TECHS[k].cost;
  const mult = c.human ? 1 : 1 / DIFFICULTY[G.difficulty].ai;
  return Math.round(base * 2.6 * (1 + TECHS[k].era * 0.4) * (1 + 0.04 * Math.max(0, civCities(c.id).length - 3)) * mult * paceK());
}
function canResearch(c, k) { return !c.techs.includes(k) && TECHS[k].pre.every(p => c.techs.includes(p)); }
function eraOf(c) { return Math.max(...c.techs.map(t => TECHS[t].era)); }
function worldEra() { return Math.max(0, ...majors().filter(c => c.alive).map(eraOf)); }

function notify(cid, text, at, kind) {
  const hs = G.humans || [G.human];
  const targets = cid === -1 ? hs : (G.civs[cid] && G.civs[cid].human ? [cid] : []);
  const e = { turn: G.turn, text, at: at == null ? null : at, kind: kind || 'info' };
  for (const h of targets) {
    const c = G.civs[h];
    if (!c.log) c.log = [];
    c.log.push(e); if (c.log.length > 200) c.log.shift();
    if (h === G.human) { G.log.push(e); if (G.log.length > 200) G.log.shift(); if (typeof UI !== 'undefined') UI.toast(e); }
    else (c.inbox || (c.inbox = [])).push(e);
  }
}
function humansWhoMet(a, b) { return (G.humans || [G.human]).filter(h => h !== a && h !== b && (G.met[h][a] || G.met[h][b])); }

// Begivenheder modstanderne laver inden for dit synsfelt (vises som animation)
const ANIM = { rec: false, events: [] };
function recordAnim(e) {
  if (!ANIM.rec || !VIS) return;
  if (!(VIS[e.from] || VIS[e.to])) return;
  ANIM.events.push(e);
}

// ---------- Enheder ----------
function createUnit(cid, type, x, y, vet) {
  const u = { id: G.nextId++, type, civ: cid, x: wrapX(x), y, hp: 100, moves: UNITS[type].moves, fort: false, vet: false,
    path: null, work: null, sleep: false, acted: false, auto: false, xp: vet ? 15 : 0, promos: [] };
  G.units.push(u);
  if (vet && !civ(cid).human) aiPromote(u);
  return u;
}
function killUnit(u) { G.units = G.units.filter(v => v !== u); if (typeof UI !== 'undefined' && UI.sel && UI.sel.unit === u.id) UI.sel = null; }

// Kan enheden overhovedet være på feltet (terræn og teknologi)?
function canTraverse(u, i) {
  const t = G.tiles[i], T = TERRAIN[t.t];
  if (UNITS[u.type].domain === 'air') { const c = cityAt(i); return !!(c && c.civ === u.civ); }
  if (isSea(u)) {
    if (T.water) return !(UNITS[u.type].coastOnly && t.t === 'ocean');
    const c = cityAt(i);
    return !!(c && c.civ === u.civ && cityCoastal(c));
  }
  if (!T.water) return t.t !== 'mountain';
  const cv = civ(u.civ);
  if (cv.barb || cv.minor) return false;
  return t.t === 'coast' ? hasTech(cv, 'sailing') : hasTech(cv, 'astronomy');
}

function moveCost(from, to, u) {
  if (!canTraverse(u, to)) return Infinity;
  if (isSea(u)) return 1;
  const wf = isWater(from), wt = isWater(to);
  if (wf !== wt) return 2; // ind- eller udskibning bruger resten af turen
  if (wt) return 1;
  const t = G.tiles[to];
  const roadA = G.tiles[from].road || cityAt(from), roadB = t.road || cityAt(to);
  if (roadA && roadB) return 1 / 3;
  return TERRAIN[t.t].move;
}

// Kan enheden u gå ind på felt i (uden angreb)?
function canEnter(u, i) {
  if (!canTraverse(u, i)) return false;
  const c = cityAt(i);
  if (c && c.civ !== u.civ) return false;
  if (!isMil(u) && campAt(i)) return false;
  const own = G.tiles[i].owner;
  if (own >= 0 && own !== u.civ && !atWar(u.civ, own) && isMajor(civ(own)) && isMajor(civ(u.civ)) && !hasOB(u.civ, own)
    && u.type !== 'caravan' && u.type !== 'gp_mer' && u.type !== 'missionary' && u.type !== 'spy' && G.tiles[idx(u.x, u.y)].owner !== own) return false;
  for (const v of unitsAt(i)) {
    if (v.civ === u.civ) continue;
    if (atWar(u.civ, v.civ) && !isMil(v) && isMil(u) && !isSea(u) && !isWater(i)) continue; // fang civile
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
  const mil = us.filter(v => isMil(v) && !isAir(v));
  if (mil.length) return { unit: bestDefender(mil, u) };
  if (us.some(isAir)) return null;
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
  const heap = [];
  const push = (f, n) => { heap.push([f, n]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0]; const last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  g[start] = 0; push(dist(u.x, u.y, tx, ty) * 0.34, start);
  const isHuman = u.civ === G.human;
  const maxCost = opts.maxCost || Infinity;
  let iter = 0;
  while (heap.length && iter++ < 9000) {
    const [, cur] = pop();
    if (closed[cur]) continue;
    if (cur === target) {
      const path = []; let c = cur;
      while (c !== start) { path.push(c); c = came[c]; }
      return path.reverse();
    }
    closed[cur] = 1;
    if (g[cur] > maxCost) continue;
    for (const nb of neighborsI(cur)) {
      if (closed[nb]) continue;
      const isTarget = nb === target;
      if (isHuman && !G.explored[nb]) continue;
      if (!canEnter(u, nb) && !(isTarget && opts.attack && enemyTarget(u, nb))) continue;
      const mc = moveCost(cur, nb, u);
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

function maxMoves(u) {
  return UNITS[u.type].moves + (hasPromo(u, 'mobility') ? 1 : 0);
}

// Antal ture for at gå en sti
function pathTurns(u, path) {
  let mv = u.moves, turns = 1, from = idx(u.x, u.y);
  if (mv <= 0) { mv = maxMoves(u); turns = 2; }
  for (const p of path) {
    if (mv <= 0) { turns++; mv = maxMoves(u); }
    const c = moveCost(from, p, u);
    mv -= c;
    if (!isSea(u) && isWater(from) !== isWater(p)) mv = 0;
    from = p;
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
    for (const nb of neighborsI(cur)) {
      if (!canEnter(u, nb)) continue;
      if (u.civ === G.human && !G.explored[nb]) continue;
      let left = Math.max(0, mv - moveCost(cur, nb, u));
      if (!isSea(u) && isWater(cur) !== isWater(nb)) left = 0;
      if (!best.has(nb) || best.get(nb) < left) { best.set(nb, left); res.add(nb); q.push(nb); }
    }
  }
  return res;
}

function stepUnit(u, to) {
  const from = idx(u.x, u.y);
  const cost = moveCost(from, to, u);
  u.moves = Math.max(0, u.moves - cost);
  if (!isSea(u) && isWater(from) !== isWater(to)) u.moves = 0;
  if (u.moves < 0.01) u.moves = 0;
  const [x, y] = xy(to);
  recordAnim({ t: 'move', id: u.id, type: u.type, civ: u.civ, from, to });
  u.x = x; u.y = y; u.fort = false; u.sleep = false; u.work = null;
  if (u.civ === G.human && u.type === 'scout') u.scouted = true;
  // fang fjendtlige civile
  for (const v of unitsAt(to)) {
    if (v.civ !== u.civ && atWar(u.civ, v.civ) && !isMil(v)) {
      const ot = v.civ;
      killUnit(v);
      if (!UNITS[v.type].gp && !UNITS[v.type].faith && !UNITS[v.type].spy && !civ(u.civ).barb) {
        const nt = v.type === 'settler' ? 'worker' : v.type;
        createUnit(u.civ, nt, x, y).moves = 0;
      }
      notify(u.civ, `Du har taget en ${civ(ot).adj} ${UNITS[v.type].name.toLowerCase()} til fange.`, to);
      notify(ot, `${civ(u.civ).name} har taget din ${UNITS[v.type].name.toLowerCase()} til fange!`, to, 'bad');
    }
  }
  // ødelæg barbarlejr
  const camp = campAt(to);
  if (camp && isMil(u) && !civ(u.civ).barb) {
    G.camps = G.camps.filter(k => k !== camp);
    G.campsGone = (G.campsGone || []).concat([{ i: camp.i, by: u.civ, turn: G.turn }]).slice(-30);
    civ(u.civ).gold += 25;
    notify(u.civ, 'Du har ødelagt en barbarlejr og fundet 25 guld.', to, 'good');
    gainXp(u, 5);
  }
  if (G.tiles[to].ruin && !isSea(u) && isMajor(civ(u.civ))) claimRuin(u, to);
  if (u.civ === G.human) updateVisibility();
  else meetCheck(u.civ, to);
}

function followPath(u) {
  while (u.path && u.path.length && u.moves > 0) {
    const next = u.path[0];
    if (!canEnter(u, next)) {
      const goal = u.path[u.path.length - 1];
      const np = findPath(u, goal);
      if (!np || !np.length || !canEnter(u, np[0])) { u.path = null; return false; }
      u.path = np; continue;
    }
    stepUnit(u, next);
    if (!G.units.includes(u)) return false;
    u.path && u.path.shift();
  }
  if (u.path && !u.path.length) { u.path = null; return true; }
  return false;
}

// ---------- Opgradering ----------
function upgradeTarget(u) {
  const cv = civ(u.civ);
  let best = null, k = UNITS[u.type].up;
  while (k && hasTech(cv, UNITS[k].tech)) { if (hasStratFor(u.civ, k, u)) best = k; k = UNITS[k].up; }
  return best;
}
function upgradeCost(u, k) { return Math.max(20, Math.round((UNITS[k].cost - UNITS[u.type].cost) * 2 + 20)); }
function canUpgrade(u) {
  const k = upgradeTarget(u);
  if (!k || u.moves <= 0) return false;
  if (G.tiles[idx(u.x, u.y)].owner !== u.civ) return false;
  return civ(u.civ).gold >= upgradeCost(u, k);
}
function doUpgrade(u) {
  const k = upgradeTarget(u);
  if (!k) return;
  civ(u.civ).gold -= upgradeCost(u, k);
  notify(u.civ, `${UNITS[u.type].name} er opgraderet til ${UNITS[k].name}.`, idx(u.x, u.y), 'good');
  u.type = k; u.moves = 0; u.fort = false;
}

// ---------- Kamp ----------
function generalNear(u) {
  return G.units.some(g => g.type === 'gp_gen' && g.civ === u.civ && dist(g.x, g.y, u.x, u.y) <= 2);
}
function riverCrossing(a, b) {
  const ta = G.tiles[a], tb = G.tiles[b];
  if (!tb.river || isWater(b) || isWater(a)) return false;
  return !(ta.river && (ta.riverTo === b || tb.riverTo === a));
}
function unitStrength(u, role, opp, tileI, ctx) {
  const T = UNITS[u.type];
  let s;
  if (role === 'def' && embarked(u)) s = 3 + 3 * eraOf(civ(u.civ));
  else s = role === 'ranged' ? (T.ranged || 0) : T.str;
  let m = 1;
  if (u.vet) m += 0.25;
  if (generalNear(u)) m += 0.25;
  if (role === 'def' && !embarked(u) && !isSea(u)) {
    const tt = G.tiles[tileI];
    if (T.cls !== 'armor' && T.cls !== 'mounted') m += TERRAIN[tt.t].def;
    if (tt.nat && NATURAL[tt.nat].def) m += NATURAL[tt.nat].def;
    if (u.fort) m += 0.25;
  }
  if (opp && opp.type && T.antiMounted && UNITS[opp.type].cls === 'mounted') m += 1;
  m += promoBonus(u, role, ctx || { tile: tileI });
  m += policyStrength(u, role, opp, tileI);
  if (stratShort(u)) m -= 0.25;
  s *= m;
  s *= 0.5 + 0.5 * u.hp / 100;
  return Math.max(0.5, s);
}
function bestDefender(list, attacker) {
  let best = null, bs = -1;
  for (const v of list) {
    const vi = idx(v.x, v.y);
    const s = unitStrength(v, 'def', attacker, vi, { tile: vi, vsRanged: !!(attacker && UNITS[attacker.type].ranged) });
    if (s > bs) { bs = s; best = v; }
  }
  return best;
}
function cityHasWalls(c) {
  if (c.blds.includes('walls')) return true;
  return civHasWonder(c.civ, 'greatwall') && eraOf(civ(c.civ)) < 3;
}
function cityStrength(c) {
  const gar = G.units.filter(u => u.x === c.x && u.y === c.y && u.civ === c.civ && isMil(u) && !isSea(u) && !isAir(u));
  const gs = gar.length ? Math.max(...gar.map(u => UNITS[u.type].str * (u.vet ? 1.25 : 1))) : 0;
  const eraB = eraOf(civ(c.civ)) * 2;
  let s = 3 + c.pop * 0.6 + gs + eraB;
  if (civ(c.civ).minor) s += 4;
  if (cityHasWalls(c)) s *= 1.5;
  if (G.tiles[idx(c.x, c.y)].t === 'hills') s *= 1.15;
  s *= 1 + religionEffects(c).def;
  return s * (0.6 + 0.4 * c.hp / 100);
}
function dmgFor(r) { return Math.round(clamp(30 * Math.pow(r, 1.15) * (0.8 + Math.random() * 0.4), 1, 100)); }

function combatPreview(u, i) {
  const tg = enemyTarget(u, i);
  if (!tg || tg.civilians) return null;
  const T = UNITS[u.type];
  const ranged = !!T.ranged;
  const from = idx(u.x, u.y);
  let A = unitStrength(u, ranged ? 'ranged' : 'atk', tg.unit, from, { tile: i, vsCity: !!tg.city });
  let D;
  const notes = [];
  if (tg.city) {
    D = cityStrength(tg.city);
    if (T.cls === 'siege' || T.bombard) { A *= 1.5; notes.push('Belejring +50 %'); }
    if (T.cls === 'mounted') { A *= 0.67; notes.push('Rytteri mod by −33 %'); }
  } else D = unitStrength(tg.unit, 'def', u, i, { tile: i, vsRanged: ranged });
  if (!ranged && riverCrossing(from, i)) { A *= 0.75; notes.push('Angreb over flod −25 %'); }
  if (generalNear(u)) notes.push('General +25 %');
  const pb = Math.round(promoBonus(u, ranged ? 'ranged' : 'atk', { tile: i, vsCity: !!tg.city }) * 100);
  if (pb) notes.push(`Forfremmelser +${pb} %`);
  if (stratShort(u)) notes.push(`Mangler ${RESOURCES[UNITS[u.type].needs].name.toLowerCase()} −25 %`);
  if (tg.unit && embarked(tg.unit)) notes.push('Målet er indskibet');
  const r = A / D;
  return { A, D, ranged, city: tg.city, unit: tg.unit, notes, expD: Math.round(30 * Math.pow(r, 1.15)), expA: ranged ? 0 : Math.round(30 * Math.pow(1 / r, 1.15)) };
}

function canAttack(u, i) {
  if (!isMil(u) || u.moves <= 0) return false;
  if (embarked(u)) return false;
  const T = UNITS[u.type];
  const tg = enemyTarget(u, i);
  if (!tg) return false;
  const [ix, iy] = xy(i);
  const d = dist(u.x, u.y, ix, iy);
  if (T.ranged) return d <= unitRange(u) && !tg.civilians;
  if (d !== 1) return false;
  if (tg.city) return isSea(u) ? cityCoastal(tg.city) : true;
  return isSea(u) ? isWater(i) : !isWater(i);
}

function attack(u, i) {
  const tg = enemyTarget(u, i);
  if (!tg) return;
  const from = idx(u.x, u.y);
  if (tg.civilians) {
    if (isWater(i)) {
      for (const v of tg.civilians) killUnit(v);
      notify(u.civ, 'Du har sænket fjendtlige civile enheder.', i, 'good');
      notify(tg.civilians[0].civ, `Dine indskibede civile enheder blev sænket af ${civ(u.civ).name}.`, i, 'bad');
      u.moves = 0;
    } else { stepUnit(u, i); u.moves = 0; }
    return;
  }
  if (isAir(u) && !airIntercept(u, i)) { u.moves = 0; return; }
  const pv = combatPreview(u, i);
  if (!pv) return;
  const T = UNITS[u.type];
  const r = pv.A / pv.D;
  const dD = dmgFor(r);
  const dA = pv.ranged ? 0 : dmgFor(1 / r);
  u.moves = 0; u.fort = false; u.acted = true; u.sleep = false;
  recordAnim({ t: 'atk', civ: u.civ, from, to: i, dmg: dD, back: dA });
  const atkName = `${civ(u.civ).adj} ${T.name.toLowerCase()}`;
  if (tg.city) {
    const c = tg.city;
    const floor = pv.ranged || isSea(u) ? 1 : 0;
    c.hp = Math.max(floor, c.hp - dD);
    c.lastAttacked = G.turn;
    u.hp -= dA;
    meet(u.civ, c.civ);
    if (u.hp <= 0) {
      killUnit(u);
      notify(u.civ, `Din ${T.name.toLowerCase()} faldt i angrebet på ${c.name}.`, i, 'bad');
      notify(c.civ, `${c.name} slog et angreb fra en ${atkName} tilbage.`, i, 'good');
      return;
    }
    gainXp(u, pv.ranged ? 2 : 3);
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
    addGreatPoints(civ(u.civ), 'gen', 3);
  } else {
    notify(u.civ, `Kamp: fjenden mistede ${dD} liv${dA ? `, din enhed mistede ${dA}` : ''}.`, i);
    notify(d.civ, `Din ${UNITS[d.type].name.toLowerCase()} blev angrebet af en ${atkName} (−${dD} liv).`, i, 'bad');
  }
  if (u.hp <= 0) {
    killUnit(u);
    notify(u.civ, `Din ${T.name.toLowerCase()} døde i kampen.`, i, 'bad');
    notify(d.civ, `Din ${UNITS[d.type].name.toLowerCase()} vandt en forsvarskamp.`, i, 'good');
    gainXp(d, 5, civ(u.civ).barb);
    addGreatPoints(civ(d.civ), 'gen', 3);
    return;
  }
  gainXp(u, pv.ranged ? 3 : (d.hp <= 0 ? 6 : 4), civ(d.civ).barb);
  if (d.hp > 0) gainXp(d, 3, civ(u.civ).barb);
  // nærkamp rykker frem hvis feltet er tomt
  if (!pv.ranged && d.hp <= 0 && !unitsAt(i).some(v => v.civ !== u.civ) && !cityAt(i) && canTraverse(u, i)) {
    u.moves = 1; stepUnit(u, i); u.moves = 0;
  }
}

function raidCity(u, c) {
  const owner = civ(c.civ);
  const loot = Math.min(Math.floor(owner.gold), 40 + c.pop * 5);
  owner.gold -= loot;
  if (c.pop > 1) c.pop--;
  c.hp = 30;
  u.moves = 0;
  notify(c.civ, `Barbarer har plyndret ${c.name}! De tog ${loot} guld, og byen mistede en indbygger.`, idx(c.x, c.y), 'bad');
}

function captureCity(u, c) {
  if (civ(u.civ).barb) { raidCity(u, c); return; }
  const old = c.civ;
  const i = idx(c.x, c.y);
  for (const v of unitsAt(i)) if (v.civ !== u.civ) killUnit(v);
  u.moves = 1; stepUnit(u, i); u.moves = 0;
  c.civ = u.civ; c.capital = false; c.pop = Math.max(1, c.pop - 1); c.hp = 40; c.prod = 0; c.build = null;
  c.locked = []; c.focus = 'balanced';
  c.blds = c.blds.filter(b => b !== 'walls' && b !== 'barracks');
  for (const t of G.tiles) if (t.city === c.id) t.owner = u.civ;
  notify(u.civ, `Du har erobret ${c.name}!`, i, 'good');
  notify(old, `${c.name} er faldet til ${civ(u.civ).name}!`, i, 'bad');
  remember(old, u.civ, 'city', -25, 'Erobrede vores byer', 80);
  if (!civ(u.civ).human) aiChooseBuild(c);
  const oc = civCities(old);
  if (oc.length && !oc.some(x => x.capital)) oc.sort((a, b) => b.pop - a.pop)[0].capital = true;
  validateRoutes();
  checkElimination(old, u.civ);
  assignAllTiles();
  if (u.civ === G.human || old === G.human) updateVisibility();
}

function checkElimination(cid, by) {
  const c = civ(cid);
  if (!c.alive || c.barb) return;
  if (civCities(cid).length === 0 && !civUnits(cid).some(u => u.type === 'settler')) {
    c.alive = false;
    G.units.filter(u => u.civ === cid).forEach(killUnit);
    for (let o = 0; o < G.civs.length; o++) { if (o !== G.barb) G.war[o][cid] = G.war[cid][o] = false; }
    notify(-1, `${c.minor ? 'Bystaten ' : ''}${c.name} er blevet udslettet${by != null ? ` af ${civ(by).name}` : ''}.`, null, by === G.human ? 'good' : 'bad');
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
    const D = unitStrength(best, 'def', null, idx(best.x, best.y), { tile: idx(best.x, best.y), vsRanged: true });
    const d = dmgFor(A / D);
    best.hp -= d;
    const bi = idx(best.x, best.y);
    recordAnim({ t: 'atk', civ: cid, from: idx(c.x, c.y), to: bi, dmg: d, back: 0 });
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
  if (c.minor) return civCities(c.id).length ? `${c.name} ${civCities(c.id).length + 1}` : c.name;
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
  if (!landPassable(i)) return false;
  const t = G.tiles[i];
  if (t.owner >= 0 && t.owner !== u.civ) return false;
  if (campAt(i) || t.nat) return false;
  return !G.cities.some(c => dist(c.x, c.y, u.x, u.y) < 3);
}

function foundCity(u) {
  const cv = civ(u.civ);
  const i = idx(u.x, u.y);
  const c = { id: G.nextId++, name: cityNameFor(cv), civ: u.civ, x: u.x, y: u.y, pop: 1, food: 0, prod: 0, build: null,
    blds: [], hp: 100, capital: civCities(u.civ).length === 0, culture: 0, nextBorder: 12, borderClaims: 0,
    worked: [], locked: [], focus: 'balanced', founded: G.turn, lastAttacked: -10, struckTurn: -1, unhappy: 0, rel: null, relP: {} };
  G.cities.push(c);
  killUnit(u);
  claimTile(i, c);
  for (const j of tilesInRadius(u.x, u.y, 1)) if (G.tiles[j].owner < 0) claimTile(j, c);
  G.tiles[i].road = true;
  if (G.tiles[i].t === 'forest' || G.tiles[i].t === 'jungle') G.tiles[i].t = 'plains';
  cv.everCity = true;
  for (const o of majors()) if (o.id !== cv.id && G.cities.some(x => x.civ === o.id && dist(x.x, x.y, c.x, c.y) <= 5)) remember(o.id, cv.id, 'settle', -6, 'Bosatte sig tæt på os', 24);
  assignAllTiles();
  if (cv.human) { updateVisibility(); notify(cv.id, `${c.name} er grundlagt.`, i, 'good'); if (typeof SFX !== 'undefined') SFX.play('city'); }
  else aiChooseBuild(c);
  return c;
}

function claimTile(i, c) { G.tiles[i].owner = c.civ; G.tiles[i].city = c.id; }

function tileYield(i, c) {
  const t = G.tiles[i]; const T = TERRAIN[t.t];
  const b = tileBaseYield(t, c ? civ(c.civ) : null);
  let f = b.f, p = b.p, tr = b.t;
  if (t.imp === 'farm') f += 1;
  if (t.imp === 'farm' && c && hasTech(civ(c.civ), 'industry')) f += 1;
  if (t.imp === 'mine') p += t.t === 'hills' ? 2 : 1;
  if (t.road && ['grass', 'plains', 'desert', 'tundra'].includes(t.t)) tr += 1;
  if (T.water && c && G.wonders.colossus === c.id) tr += 1;
  if (T.water && c && hasTech(civ(c.civ), 'astronomy')) f += 1;
  if (T.water && c && c.blds.includes('harbor')) f += 1;
  return { f, p, t: tr };
}

function cityWorkable(c) {
  return tilesInRadius(c.x, c.y, 3).filter(j => G.tiles[j].city === c.id && j !== idx(c.x, c.y));
}

// ---------- Tilfredshed ----------
let LUX = {};
function computeLux() {
  LUX = {};
  for (const t of G.tiles) {
    if (t.owner < 0 || !t.res || !RESOURCES[t.res].lux) continue;
    (LUX[t.owner] || (LUX[t.owner] = new Set())).add(t.res);
  }
}
function civLuxuries(cid) { return LUX[cid] ? [...LUX[cid]] : []; }

function cityHappiness(c) {
  const cv = civ(c.civ);
  const diff = DIFFICULTY[G.difficulty];
  let base = cv.human ? diff.content : cv.minor ? 6 : 4 + (diff.ai > 1 ? 1 : 0);
  const n = civCities(c.civ).length;
  const gv = gov(cv);
  const empire = cv.minor || gv.noEmpire ? 0 : Math.floor(Math.max(0, n - 3) / 3);
  const src = [[`Grundniveau`, base]];
  if (empire) src.push(['Rigets størrelse', -empire]);
  const era = eraOf(cv);
  const living = era >= 4 ? 2 : era >= 2 ? 1 : 0;
  if (living) src.push(['Bedre levevilkår', living]);
  for (const b of c.blds) if (BUILDINGS[b].happy) src.push([BUILDINGS[b].name, BUILDINGS[b].happy]);
  const lux = civLuxuries(c.civ).length;
  if (lux) src.push([`Luksusvarer (${lux})`, lux]);
  if (civHasWonder(c.civ, 'gardens')) src.push(['De Hængende Haver', 1]);
  if (G.units.some(u => u.civ === c.civ && u.x === c.x && u.y === c.y && isMil(u) && !isSea(u) && !isAir(u))) src.push(['Garnison', 1 + (gv.garrison || 0)]);
  if (c.unrest > 0) src.push([c.unrestWhy || 'Uro skabt af spioner', -3]);
  societyHappy(c, cv, src);
  const rh = religionEffects(c).happy;
  if (rh) src.push([`Religion: ${RELIGIONS[c.rel].name}`, rh]);
  if (gv.happy) src.push([gv.name, gv.happy]);
  if (gv.warWeary && warWithMajor(c.civ)) src.push(['Krigstræthed', -gv.warWeary]);
  const nh = civNatHappy(c.civ).length;
  if (nh) src.push([`Naturvidundere (${nh})`, nh]);
  const content = Math.max(0, src.reduce((a, s) => a + s[1], 0));
  const unhappy = Math.max(0, c.pop - content);
  return { content, unhappy, src };
}

// ---------- Fordeling af byfelter ----------
const FOCUS = {
  balanced: { name: 'Balanceret', w: [2.6, 2, 1.2] },
  food:     { name: 'Mad',        w: [4, 1.5, 1] },
  prod:     { name: 'Produktion', w: [1.8, 3.5, 1] },
  trade:    { name: 'Handel',     w: [1.8, 1.5, 3] },
};

function assignAllTiles() {
  computeLux();
  computeStrat();
  const taken = new Set();
  const enemyOn = new Set();
  for (const u of G.units) enemyOn.add(idx(u.x, u.y) + ':' + u.civ);
  for (const c of G.cities) {
    const h = cityHappiness(c);
    c.unhappy = h.unhappy;
    const workers = c.pop - h.unhappy;
    const ok = (j) => !taken.has(j) && !G.units.some(u => u.x === j % G.w && u.y === Math.floor(j / G.w) && atWar(u.civ, c.civ));
    const cands = cityWorkable(c).filter(ok);
    c.locked = (c.locked || []).filter(j => cands.includes(j));
    const chosen = c.locked.slice(0, workers);
    const fw = (FOCUS[c.focus] || FOCUS.balanced).w;
    const score = (j, w) => { const y = tileYield(j, c); return y.f * w[0] + y.p * w[1] + y.t * w[2]; };
    const rest = cands.filter(j => !chosen.includes(j)).sort((a, b) => score(b, fw) - score(a, fw));
    let pickN = rest.slice(0, Math.max(0, workers - chosen.length));
    // undgå sult med andre fokus
    const foodOf = (list) => list.reduce((a, j) => a + tileYield(j, c).f, 0) + Math.max(2, tileYield(idx(c.x, c.y), c).f) + (c.blds.includes('granary') ? 2 : 0);
    if (c.focus !== 'food' && foodOf(chosen.concat(pickN)) < c.pop * 2) {
      const w2 = [4, 1.5, 1];
      pickN = rest.sort((a, b) => score(b, w2) - score(a, w2)).slice(0, Math.max(0, workers - chosen.length));
    }
    c.worked = chosen.concat(pickN);
    c.worked.forEach(j => taken.add(j));
  }
}

function civHasWonder(cid, k) { const id = G.wonders[k]; if (id == null) return false; const c = cityById(id); return !!(c && c.civ === cid); }

// ---------- Handelsruter ----------
function routeValue(a, b) {
  const d = dist(a.x, a.y, b.x, b.y);
  let v = 2 + Math.floor(d / 4);
  if (a.civ !== b.civ) v = Math.round(v * 1.5);
  return v;
}
function routesOf(c) { return G.routes.filter(r => r.a === c.id || r.b === c.id); }
function maxRoutes(c) { return 1 + (policyFx(civ(c.civ)).maxRoutes || 0) + (c.blds.includes('market') ? 1 : 0) + (c.blds.includes('bank') ? 1 : 0); }
function routeTrade(c) {
  let t = 0;
  for (const r of routesOf(c)) {
    const a = cityById(r.a), b = cityById(r.b);
    if (a && b) t += routeValue(a, b);
  }
  return t;
}
function routeTargetOk(u, c) {
  const home = cityById(u.home);
  if (!home || home.civ !== u.civ || c === home) return false;
  const oc = civ(c.civ);
  if (oc.barb || atWar(u.civ, c.civ)) return false;
  if (dist(home.x, home.y, c.x, c.y) < 6) return false;
  if (G.routes.some(r => (r.a === home.id && r.b === c.id) || (r.a === c.id && r.b === home.id))) return false;
  return routesOf(home).length < maxRoutes(home) && routesOf(c).length < maxRoutes(c);
}
function routeCandidates(u) {
  const home = cityById(u.home);
  if (!home) return [];
  return G.cities.filter(c => routeTargetOk(u, c)).map(c => ({ c, v: routeValue(home, c) })).sort((a, b) => b.v - a.v);
}
function routeHere(u) {
  if (u.type !== 'caravan') return null;
  for (const c of G.cities) if (dist(c.x, c.y, u.x, u.y) <= 1 && routeTargetOk(u, c)) return c;
  return null;
}
function establishRoute(u, c) {
  const home = cityById(u.home);
  G.routes.push({ a: home.id, b: c.id, turn: G.turn });
  killUnit(u);
  const v = routeValue(home, c);
  notify(home.civ, `Handelsrute oprettet mellem ${home.name} og ${c.name} (+${v} handel til begge).`, idx(c.x, c.y), 'good');
  if (c.civ !== home.civ) notify(c.civ, `${civ(home.civ).name} har oprettet en handelsrute til ${c.name} (+${v} handel).`, idx(c.x, c.y), 'good');
  const oc = civ(c.civ);
  if (oc.minor) oc.inf[home.civ] = (oc.inf[home.civ] || 0) + 12;
  assignAllTiles();
}
function validateRoutes() {
  G.routes = G.routes.filter(r => {
    const a = cityById(r.a), b = cityById(r.b);
    if (!a || !b) return false;
    if (atWar(a.civ, b.civ)) {
      notify(a.civ, `Handelsruten mellem ${a.name} og ${b.name} er brudt på grund af krig.`, idx(b.x, b.y), 'warn');
      notify(b.civ, `Handelsruten mellem ${a.name} og ${b.name} er brudt på grund af krig.`, idx(a.x, a.y), 'warn');
      return false;
    }
    return true;
  });
}

// ---------- Byens udbytte ----------
function minorFoodBonus(cid) {
  let f = 0;
  for (const m of G.civs) if (m.minor && m.alive && m.mtype === 'sofart' && (m.inf[cid] || 0) >= 30) f += m.ally === cid ? 3 : 2;
  return f;
}

function cityYields(c) {
  const cv = civ(c.civ);
  const ci = idx(c.x, c.y);
  const cy = tileYield(ci, c);
  let f = Math.max(2, cy.f), p = Math.max(1, cy.p), t = cy.t + 1;
  for (const j of c.worked) { const y = tileYield(j, c); f += y.f; p += y.p; t += y.t; }
  const workers = c.pop - (c.unhappy || 0);
  const specialists = Math.max(0, workers - c.worked.length);
  p += specialists; t += specialists;
  t += workers;
  if (c.capital) { t += 2; p += 1; f += minorFoodBonus(c.civ); }
  const gv = gov(cv);
  if (c.capital && gv.capitalProd) p += gv.capitalProd;
  if (gv.cityTrade) t += gv.cityTrade;
  const routes = routeTrade(c);
  t += routes;
  if (c.blds.includes('granary')) f += 2;
  if (c.blds.includes('watermill')) p += 2;
  const re = religionEffects(c);
  const sx = societyCity(c, cv);
  f += re.f + sx.f; p += sx.p; t += sx.t;
  let pm = 1 + (gv.prod || 0) + re.pm + sx.pm;
  if (c.blds.includes('workshop')) pm += 0.25;
  if (c.blds.includes('factory')) pm += 0.5;
  if (c.blds.includes('powerplant')) pm += 0.5;
  if (G.wonders.pyramids === c.id) pm += 0.25;
  if (civHasWonder(c.civ, 'hoover')) pm += 0.25;
  let sm = 1 + (gv.sci || 0) + sx.sm;
  if (c.blds.includes('library')) sm += 0.5;
  if (c.blds.includes('university')) sm += 0.5;
  if (c.blds.includes('lab')) sm += 0.75;
  if (G.wonders.newton === c.id) sm += 1;
  let gm = 1 + (gv.gold || 0) + sx.gm;
  if (c.blds.includes('market')) gm += 0.5;
  if (c.blds.includes('bank')) gm += 0.5;
  const ai = cv.human ? 1 : DIFFICULTY[G.difficulty].ai;
  const prod = Math.round(p * pm * ai);
  let sci = t * cv.sciRate * sm * ai;
  if (G.wonders.library === c.id) sci += 8;
  sci += re.sci + sx.sci;
  if (cv.gov === 'anarchy') sci = 0;
  const gold = t * (1 - cv.sciRate) * gm * ai + re.gold + sx.gold;
  const foodNet = f - c.pop * 2;
  const cap = c.blds.includes('aqueduct') ? 30 : 8;
  let culture = 1 + (c.capital ? 1 : 0) + re.culture + sx.culture;
  for (const b of c.blds) culture += BUILDINGS[b].culture || 0;
  culture += Object.values(G.wonders).filter(id => id === c.id).length * 2;
  if (c.capital && gv.capitalCulture) culture += gv.capitalCulture;
  for (const j of cityWorkable(c)) { const k = G.tiles[j].nat; if (k && NATURAL[k].culture) culture += NATURAL[k].culture; }
  const faith = cityFaith(c);
  return { f, p: prod, t, routes, sci: Math.round(sci * 10) / 10, gold: Math.round(gold * 10) / 10, foodNet, need: growthNeed(c.pop), cap, culture, faith, unhappy: c.unhappy || 0 };
}
function growthNeed(pop) { return Math.floor((15 + 7 * (pop - 1) + Math.pow(pop - 1, 1.7)) * paceK()); }

function buildCost(b) {
  if (!b) return 0;
  const base = b.kind === 'unit' ? UNITS[b.key].cost : b.kind === 'bld' ? BUILDINGS[b.key].cost : b.kind === 'wonder' ? WONDERS[b.key].cost : b.kind === 'proj' ? PROJECTS[b.key].cost : 0;
  return Math.round(base * paceK());
}
function buildName(b) {
  if (!b) return 'Intet';
  return (b.kind === 'unit' ? UNITS : b.kind === 'bld' ? BUILDINGS : b.kind === 'wonder' ? WONDERS : PROJECTS)[b.key].name;
}

function unitObsolete(cv, k) { const o = UNITS[k].obs; return o && cv.techs.includes(o); }
function cityOnRiver(c) { return freshWater(idx(c.x, c.y)); }

function buildOptions(c) {
  const cv = civ(c.civ);
  const out = [];
  const coastal = cityCoastal(c);
  for (const k in UNITS) {
    const U = UNITS[k];
    if (U.gp || U.faith || !hasTech(cv, U.tech) || unitObsolete(cv, k)) continue;
    if (U.domain === 'sea' && !coastal) continue;
    if (cv.minor && (k === 'settler' || k === 'caravan')) continue;
    if (U.needs && !resVisible(U.needs, cv)) continue;
    const okRes = hasStratFor(c.civ, k);
    out.push({ kind: 'unit', key: k, ok: (k !== 'settler' || c.pop >= 2) && okRes,
      reason: !okRes ? `Kræver ${RESOURCES[U.needs].name.toLowerCase()} (${Math.max(0, stratAvail(c.civ, U.needs))} ledig af ${stratSupply(c.civ, U.needs)})` : k === 'settler' && c.pop < 2 ? 'Kræver 2 indbyggere' : null });
  }
  for (const k in BUILDINGS) {
    const B = BUILDINGS[k];
    if (!hasTech(cv, B.tech) || c.blds.includes(k)) continue;
    if (B.river && !cityOnRiver(c)) continue;
    if (B.coastal && !coastal) continue;
    out.push({ kind: 'bld', key: k, ok: true });
  }
  if (!cv.minor) for (const k in WONDERS) if (hasTech(cv, WONDERS[k].tech) && G.wonders[k] == null && !(k === 'un' && !victoryOn('diplo'))) out.push({ kind: 'wonder', key: k, ok: !G.cities.some(o => o !== c && o.civ === c.civ && o.build && o.build.kind === 'wonder' && o.build.key === k) });
  for (const k in PROJECTS) if (hasTech(cv, PROJECTS[k].tech) && !(cv.minor && k === 'spaceship') && !(k === 'spaceship' && !victoryOn('space'))) out.push({ kind: 'proj', key: k, ok: true });
  return out;
}

function buyCost(c) {
  if (!c.build || c.build.kind === 'proj') return Infinity;
  const left = Math.max(0, buildCost(c.build) - c.prod);
  const k = c.build.kind === 'wonder' ? 4 : 2;
  return Math.ceil((left * k + Math.pow(left, 1.15) * 0.3 + 10) * (1 + (gov(civ(c.civ)).buy || 0) + (policyFx(civ(c.civ)).buy || 0)));
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
  if (cv.human && y.unhappy > 0 && !c.warnedUnhappy) { c.warnedUnhappy = true; notify(cv.id, `${c.name} har utilfredse indbyggere, som ikke arbejder. Byg et tempel, eller skaf luksusvarer.`, idx(c.x, c.y), 'warn'); }
  // grænser
  c.culture += y.culture;
  if (c.culture >= c.nextBorder) {
    c.culture -= c.nextBorder;
    c.borderClaims++;
    c.nextBorder = Math.floor(12 + c.borderClaims * 5 + Math.pow(c.borderClaims, 1.4));
    expandBorder(c);
  }
  c.hp = Math.min(100, c.hp + (G.turn - c.lastAttacked > 1 ? 15 : 6));
  if (c.unrest > 0 && --c.unrest === 0) c.unrestWhy = null;
  // produktion
  if (!c.build && !cv.human) aiChooseBuild(c);
  if (!c.build) return y;
  if (c.build.kind === 'proj' && c.build.key === 'wealth') { cv.gold += y.p * 0.5; return y; }
  c.prod += y.p;
  const cost = buildCost(c.build);
  if (c.prod >= cost) {
    const b = c.build;
    if (b.kind === 'unit') {
      if (b.key === 'settler' && c.pop < 2) return y;
      if (!hasStratFor(c.civ, b.key)) {
        if (c.warnedRes !== b.key) { c.warnedRes = b.key; notify(cv.id, `${c.name} kan ikke færdiggøre ${UNITS[b.key].name.toLowerCase()}: der mangler ${RESOURCES[UNITS[b.key].needs].name.toLowerCase()}.`, idx(c.x, c.y), 'warn'); }
        if (!cv.human) c.build = null;
        return y;
      }
      c.warnedRes = null;
      c.prod -= cost;
      if (b.key === 'settler') c.pop--;
      const air = UNITS[b.key].domain === 'air';
      const u = createUnit(c.civ, b.key, c.x, c.y, air ? c.blds.includes('airport') : c.blds.includes('barracks') && isMil({ type: b.key }));
      if (b.key === 'caravan') u.home = c.id;
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
        notify(-1, `${cv.name} har fuldført vidunderet ${WONDERS[b.key].name} i ${c.name}.`, idx(c.x, c.y), cv.human ? 'good' : 'info');
        for (const o of G.cities) if (o !== c && o.build && o.build.kind === 'wonder' && o.build.key === b.key) { o.build = null; notify(o.civ, `${o.name} kan ikke længere bygge ${WONDERS[b.key].name}.`, idx(o.x, o.y), 'warn'); }
      }
    } else if (b.kind === 'proj' && b.key === 'spaceship') {
      c.prod -= cost; c.build = null;
      G.over = { winner: c.civ, how: 'rum' };
      notify(-1, `${cv.name}s rumskib er sendt mod Alpha Centauri!`, idx(c.x, c.y), cv.human ? 'good' : 'bad');
    }
    if (!c.build) queueNext(c);
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
    if (!neighborsI(j).some(n => G.tiles[n].city === c.id)) continue;
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
  if (isWater(i) || t.t === 'mountain') return false;
  const cv = civ(u.civ);
  if (!hasTech(cv, IMPROVEMENT_TECH[kind])) return false;
  if (t.owner >= 0 && t.owner !== u.civ) return false;
  if (cityAt(i) && kind !== 'chop') return false;
  if (kind === 'road') return !t.road;
  if (kind === 'chop') return t.t === 'forest' || t.t === 'jungle';
  if (kind === 'farm') {
    if (t.imp === 'farm') return false;
    if (t.t === 'desert') return freshWater(i);
    return ['grass', 'plains', 'tundra'].includes(t.t);
  }
  if (kind === 'mine') return t.imp !== 'mine' && (t.t === 'hills' || t.res === 'iron' || t.res === 'gold' || t.res === 'gems' || t.t === 'desert');
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

// ---------- Store personligheder ----------
function addGreatPoints(cv, type, n) {
  if (!isMajor(cv)) return;
  n *= 1 + (policyFx(cv).gpRate || 0);
  cv.gpw[type] += n; cv.gpp += n;
}
function processGreatPeople(cv) {
  if (!isMajor(cv)) return;
  for (const c of civCities(cv.id)) {
    for (const b of c.blds) if (BUILDINGS[b].gp) addGreatPoints(cv, BUILDINGS[b].gp, 1);
    for (const k in G.wonders) if (G.wonders[k] === c.id && WONDERS[k].gp) addGreatPoints(cv, WONDERS[k].gp, 2);
  }
  if (cv.gpp < cv.gpNext) return;
  const cap = capitalOf(cv.id);
  if (!cap) return;
  const tot = Object.values(cv.gpw).reduce((a, b) => a + b, 0) || 1;
  let r = Math.random() * tot, type = 'sci';
  for (const k in cv.gpw) { r -= cv.gpw[k]; if (r <= 0) { type = k; break; } }
  cv.gpp -= cv.gpNext; cv.gpCount++;
  cv.gpNext = 100 + cv.gpCount * 120;
  cv.gpw = { sci: 0, mer: 0, eng: 0, gen: 0 };
  const ut = GP_TYPES[type];
  createUnit(cv.id, ut, cap.x, cap.y);
  notify(cv.id, `En stor personlighed er født i ${cap.name}: ${UNITS[ut].name}!`, idx(cap.x, cap.y), 'good');
}
function gpActionOk(u) {
  const cv = civ(u.civ);
  const i = idx(u.x, u.y);
  if (u.type === 'gp_sci') return !!cv.research;
  if (u.type === 'gp_mer') return true;
  if (u.type === 'gp_eng') { const c = cityAt(i); return !!(c && c.civ === u.civ && c.build && c.build.kind !== 'proj'); }
  return false;
}
function useGreatPerson(u) {
  const cv = civ(u.civ);
  const i = idx(u.x, u.y);
  if (!gpActionOk(u)) return false;
  if (u.type === 'gp_sci') {
    const add = Math.round(techCost(cv, cv.research) * 0.8);
    cv.sci += add;
    notify(cv.id, `Videnskabsmanden har givet ${add} forskning til ${TECHS[cv.research].name}.`, null, 'good');
  } else if (u.type === 'gp_mer') {
    const g = 150 + 60 * eraOf(cv);
    cv.gold += g;
    const owner = G.tiles[i].owner;
    if (owner >= 0 && civ(owner).minor) { civ(owner).inf[cv.id] = (civ(owner).inf[cv.id] || 0) + 40; notify(cv.id, `Handelsmissionen i ${civ(owner).name} gav ${g} guld og +40 indflydelse.`, i, 'good'); }
    else notify(cv.id, `Handelsmissionen gav ${g} guld.`, i, 'good');
  } else if (u.type === 'gp_eng') {
    const c = cityAt(i);
    c.prod += 300;
    notify(cv.id, `Ingeniøren har givet 300 produktion til ${buildName(c.build)} i ${c.name}.`, i, 'good');
  }
  killUnit(u);
  return true;
}

// ---------- Synsfelt og kontakt ----------
let VIS = null;
function updateVisibility() {
  VIS = new Uint8Array(G.w * G.h);
  const h = G.human;
  for (const u of G.units) {
    if (u.civ !== h) continue;
    let r = u.type === 'scout' ? 3 : 2;
    const ut = G.tiles[idx(u.x, u.y)];
    if (ut.t === 'hills') r++;
    if (ut.nat && NATURAL[ut.nat].sight) r += NATURAL[ut.nat].sight;
    for (const j of tilesInRadius(u.x, u.y, r)) { VIS[j] = 1; G.explored[j] = 1; }
  }
  for (const c of G.cities) {
    if (c.civ !== h) continue;
    for (const j of tilesInRadius(c.x, c.y, 3)) { VIS[j] = 1; G.explored[j] = 1; }
  }
  for (let j = 0; j < G.tiles.length; j++) if (G.tiles[j].owner === h) {
    VIS[j] = 1; G.explored[j] = 1;
    for (const n of neighborsI(j)) { VIS[n] = 1; G.explored[n] = 1; }
  }
  for (const u of G.units) if (u.civ !== h && VIS[idx(u.x, u.y)]) meet(h, u.civ);
  for (const c of G.cities) if (c.civ !== h && VIS[idx(c.x, c.y)]) meet(h, c.civ);
  if (G.natSeen) checkNatDiscovery();
}
function meet(a, b) {
  if (a === b || G.met[a][b]) return;
  if (civ(a).barb || civ(b).barb) return;
  G.met[a][b] = G.met[b][a] = true;
  for (const [me, other] of [[a, b], [b, a]]) {
    if (!civ(me).human) continue;
    const o = civ(other);
    notify(me, o.minor ? `Du har mødt bystaten ${o.name} (${MINOR_TYPES[o.mtype].name.toLowerCase()}).` : `Du har mødt ${o.name}.`, null, 'info');
  }
}
function meetCheck(cid, i) {
  if (VIS && VIS[i]) meet(G.human, cid);
}

function declareWar(a, b, quiet, viaPact) {
  if (G.war[a][b] || civ(a).barb || civ(b).barb) return;
  G.war[a][b] = G.war[b][a] = true;
  G.warSince[a][b] = G.warSince[b][a] = G.turn;
  meet(a, b);
  onWarDeclared(a, b, viaPact);
  if (civ(b).minor && isMajor(civ(a))) civ(b).inf[a] = -50;
  if (quiet) return;
  if (civ(a).human) notify(a, `Du har erklæret krig mod ${civ(b).name}.`, null, 'bad');
  if (civ(b).human) notify(b, `${civ(a).name} har erklæret krig mod dig!`, null, 'bad');
  for (const h of humansWhoMet(a, b)) notify(h, `${civ(a).name} har erklæret krig mod ${civ(b).name}.`, null, 'info');
}
function makePeace(a, b) {
  if (!G.war[a][b] || civ(a).barb || civ(b).barb) return;
  G.war[a][b] = G.war[b][a] = false;
  G.warSince[a][b] = G.warSince[b][a] = G.turn;
  remember(a, b, 'peace', 8, 'Sluttede fred med os', 20); remember(b, a, 'peace', 8, 'Sluttede fred med os', 20);
  if (civ(a).human) notify(a, `Der er nu fred mellem dig og ${civ(b).name}.`, null, 'good');
  if (civ(b).human) notify(b, `Der er nu fred mellem dig og ${civ(a).name}.`, null, 'good');
  for (const h of humansWhoMet(a, b)) notify(h, `${civ(a).name} og ${civ(b).name} har sluttet fred.`, null, 'info');
}
function recentlyAtWar(a, b) { return G.war[a][b] || (G.warSince[a][b] && G.turn - G.warSince[a][b] < 10); }

// ---------- Teknologihandel ----------
function canTradeTech(a, b) {
  const A = civ(a), B = civ(b);
  return A.alive && B.alive && isMajor(A) && isMajor(B) && G.met[a][b] && !recentlyAtWar(a, b);
}
function techPrice(buyer, k) { return Math.round(techCost(buyer, k) * 1.7); }
function techsFor(from, to) { return from.techs.filter(k => !to.techs.includes(k) && canResearch(to, k)); }
// Vil AI'en sælge teknologien k til køber?
function aiWillSell(ai, buyer, k) {
  if (!canTradeTech(ai.id, buyer.id)) return false;
  if (score(buyer.id) > score(ai.id) * 1.3) return false;
  if (attitude(ai.id, buyer.id).score < -10) return false;
  return ai.techs.includes(k);
}
function aiBuyPrice(ai, k) { return Math.round(techCost(ai, k) * 1.2); }
function sellTechToAi(seller, ai, k) {
  const price = aiBuyPrice(ai, k);
  if (ai.gold < price + 30) return false;
  ai.gold -= price; seller.gold += price; ai.techs.push(k);
  remember(ai.id, seller.id, 'trade', 6, 'Handlede med os', 30);
  if (ai.research === k) { ai.research = null; aiChooseResearch(ai); }
  return price;
}
function buyTechFromAi(buyer, ai, k) {
  const price = techPrice(buyer, k);
  if (buyer.gold < price || !aiWillSell(ai, buyer, k)) return false;
  buyer.gold -= price; ai.gold += price; buyer.techs.push(k);
  remember(ai.id, buyer.id, 'trade', 6, 'Handlede med os', 30);
  if (buyer.research === k) buyer.research = null;
  return price;
}

function giftMajor(p, ai, gold) {
  if (p.gold < gold) return 0;
  p.gold -= gold; ai.gold += gold;
  const v = Math.round(gold / 8);
  remember(ai.id, p.id, 'gift', v, 'Gav os gaver', 40);
  return v;
}

// ---------- Bystater ----------
function minorStatus(m, cid) {
  const inf = m.inf[cid] || 0;
  if (m.ally === cid) return 'Allieret';
  if (inf >= 30) return 'Venner';
  if (atWar(m.id, cid)) return 'Krig';
  if (inf < 0) return 'Fjendtlig';
  return 'Neutral';
}
function giftMinor(p, m, gold) {
  if (p.gold < gold) return 0;
  p.gold -= gold;
  const add = Math.round(gold / 3 / (1 + eraOf(p) * 0.15));
  m.inf[p.id] = Math.min(150, (m.inf[p.id] || 0) + add);
  questGift(m, p, gold);
  return add;
}
function processMinors() {
  processQuests();
  const ws = majors().filter(c => c.alive);
  for (const m of G.civs) {
    if (!m.minor || !m.alive) continue;
    for (const p of ws) {
      const v = m.inf[p.id] || 0;
      if (v > 0) m.inf[p.id] = v - 1; else if (v < 0 && !atWar(m.id, p.id)) m.inf[p.id] = v + 1;
    }
    // ny allieret
    let ally = m.ally != null && (m.inf[m.ally] || 0) >= 60 && civ(m.ally).alive ? m.ally : null;
    for (const p of ws) if ((m.inf[p.id] || 0) >= 60 && (ally == null || m.inf[p.id] > m.inf[ally] + 5)) ally = p.id;
    if (ally !== m.ally) {
      if (m.ally != null) notify(m.ally, `${m.name} er ikke længere din allierede.`, null, 'warn');
      for (const x of m.allyWars) makePeace(m.id, x);
      m.allyWars = [];
      m.ally = ally;
      if (ally != null) {
        notify(ally, `${m.name} er nu din allierede!`, null, 'good');
        for (const p of ws) if (p.id !== ally && (m.inf[p.id] || 0) >= 60) m.inf[p.id] = 59;
      }
    }
    if (m.ally != null) {
      for (const x of ws) {
        if (x.id === m.ally) continue;
        if (atWar(m.ally, x.id) && !atWar(m.id, x.id)) {
          declareWar(m.id, x.id, true); m.allyWars.push(x.id);
          notify(x.id, `Bystaten ${m.name} går ind i krigen på ${civ(m.ally).name}s side.`, null, 'bad');
        }
      }
      m.allyWars = m.allyWars.filter(x => { if (!atWar(m.ally, x)) { makePeace(m.id, x); return false; } return true; });
    }
    // bonusser til venner
    for (const p of ws) {
      if ((m.inf[p.id] || 0) < 30 || atWar(m.id, p.id)) continue;
      const isAlly = m.ally === p.id;
      if (m.mtype === 'handel') p.gold += isAlly ? 5 : 3;
      if (m.mtype === 'militaer') {
        m.giftTimer[p.id] = (m.giftTimer[p.id] || 0) + 1;
        if (m.giftTimer[p.id] >= (isAlly ? 10 : 15)) {
          m.giftTimer[p.id] = 0;
          const cap = capitalOf(p.id);
          if (cap) {
            const k = bestUnitFor(p, 'atk');
            createUnit(p.id, k, cap.x, cap.y);
            notify(p.id, `${m.name} har sendt dig en ${UNITS[k].name.toLowerCase()} som gave.`, idx(cap.x, cap.y), 'good');
          }
        }
      }
    }
    // bystater følger med i teknologi
    if (G.turn % 8 === 0) {
      const known = Object.keys(TECHS).filter(k => canResearch(m, k) && ws.filter(p => p.techs.includes(k)).length >= Math.max(1, ws.length / 2));
      if (known.length) { const k = pick(known); m.techs.push(k); if (m.research === k) m.research = null; }
    }
  }
}

// ---------- Barbarer ----------
function spawnCamps() {
  if (G.turn < 4) return;
  if (majors().some(c => c.alive && c.techs.includes('gunpowder'))) return;
  const maxCamps = Math.round(G.w * G.h / 260);
  if (G.camps.length >= maxCamps || Math.random() > 0.3) return;
  for (let k = 0; k < 40; k++) {
    const i = Math.floor(Math.random() * G.tiles.length);
    const t = G.tiles[i];
    if (!landPassable(i) || t.owner >= 0 || t.t === 'snow' || campAt(i)) continue;
    const [x, y] = xy(i);
    if (G.cities.some(c => dist(c.x, c.y, x, y) < 6)) continue;
    if (G.units.some(u => dist(u.x, u.y, x, y) < 4)) continue;
    if (VIS && VIS[i]) continue;
    G.camps.push({ i, timer: 3 + Math.floor(Math.random() * 4) });
    return;
  }
}
function barbUnitType() {
  const era = worldEra();
  if (era === 0) return G.turn < 25 ? 'warrior' : pick(['warrior', 'warrior', 'archer', 'spearman']);
  if (era === 1) return pick(['swordsman', 'archer', 'horseman', 'spearman']);
  return pick(['swordsman', 'horseman', 'pikeman', 'catapult', 'knight']);
}
function campsTick() {
  const late = majors().some(c => c.alive && c.techs.includes('gunpowder'));
  if (worldEra() >= 4 && G.camps.length && Math.random() < 0.05) G.camps.splice(Math.floor(Math.random() * G.camps.length), 1);
  for (const k of G.camps) {
    k.timer--;
    if (k.timer > 0) continue;
    k.timer = (late ? 16 : 9) + Math.floor(Math.random() * 5);
    const [x, y] = xy(k.i);
    const near = G.units.filter(u => u.civ === G.barb && dist(u.x, u.y, x, y) <= 6).length;
    if (near >= 3) continue;
    if (unitsAt(k.i).some(u => u.civ !== G.barb)) continue;
    const u = createUnit(G.barb, barbUnitType(), x, y);
    u.camp = k.i;
  }
}

// ---------- Point ----------
function milPower(cid) {
  let s = 0;
  for (const u of G.units) if (u.civ === cid && isMil(u)) { const T = UNITS[u.type]; s += Math.max(T.str, T.ranged || 0) * (u.hp / 100); }
  return s + civCities(cid).length * 4;
}
function score(cid) {
  const cs = civCities(cid);
  const pop = cs.reduce((a, c) => a + c.pop, 0);
  const w = Object.values(G.wonders).filter(id => { const c = cityById(id); return c && c.civ === cid; }).length;
  return cs.length * 8 + pop * 4 + civ(cid).techs.length * 5 + w * 20 + Math.floor((civ(cid).cultureTotal || 0) / 200) + (civReligion(cid) ? 15 : 0);
}

// ---------- Turgang ----------
function beginCivTurn(cid) {
  const cv = civ(cid);
  if (!cv.alive) return;
  for (const u of civUnits(cid)) {
    if (u.work) progressWork(u);
    if ((!u.acted || hasPromo(u, 'march')) && u.hp < 100) {
      const i = idx(u.x, u.y);
      const ct = cityAt(i);
      const inCity = ct && ct.civ === cid;
      u.hp = Math.min(100, u.hp + (inCity ? 25 : G.tiles[i].owner === cid ? 15 : embarked(u) || isSea(u) ? 5 : 10) + extraHeal(u));
    }
    u.acted = false;
    u.moves = u.work ? 0 : maxMoves(u);
    if (embarked(u)) u.moves = Math.min(u.moves, 2);
  }
  if (cv.barb) return;
  assignAllTiles();
  let sci = 0, gold = 0, faith = 0, cul = 0;
  for (const c of civCities(cid)) { const y = processCity(c); sci += y.sci; gold += y.gold; faith += y.faith || 0; cul += y.culture || 0; }
  cv.faith = (cv.faith || 0) + faith;
  cv.cultureTotal = (cv.cultureTotal || 0) + cul;
  societyTurn(cv, cul);
  if (cv.human && canFoundReligion(cv) && !cv.toldReligion) { cv.toldReligion = true; notify(cid, 'Du har tro nok til at grundlægge en religion. Åbn Riget → Religion.', null, 'good'); }
  processGreatPeople(cv);
  cv.sci += sci;
  if (cv.research && cv.techs.includes(cv.research)) cv.research = null;
  if (cv.research) {
    const cost = techCost(cv, cv.research);
    if (cv.sci >= cost) {
      cv.sci -= cost;
      const k = cv.research;
      cv.techs.push(k); cv.research = null;
      notify(cid, `Dine lærde har opdaget ${TECHS[k].name}!`, null, 'good');
      if (cv.human && typeof SFX !== 'undefined') SFX.play('tech');
      if (!cv.human) aiChooseResearch(cv);
    }
  } else if (!cv.human) aiChooseResearch(cv);
  cv.gold += gold - upkeep(cid);
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
  tickGovernment(cv);
}

function upkeep(cid) {
  const cs = civCities(cid);
  const units = civUnits(cid).filter(u => u.type !== 'settler' && !UNITS[u.type].gp).length;
  const free = Math.max(3, cs.length * (2 + (gov(civ(cid)).freeUnits || 0) + (policyFx(civ(cid)).freeUnits || 0)));
  let u = Math.max(0, units - free) * 1;
  const smith = civHasWonder(cid, 'adamsmith');
  for (const c of cs) for (const b of c.blds) { const k = BUILDINGS[b].upkeep; if (!(smith && k === 1)) u += k; }
  return u;
}

function civIncome(cid) {
  let sci = 0, gold = 0;
  for (const c of civCities(cid)) { const y = cityYields(c); sci += y.sci; gold += y.gold; }
  let bonus = 0;
  for (const m of G.civs) if (m.minor && m.alive && m.mtype === 'handel' && (m.inf[cid] || 0) >= 30 && !atWar(m.id, cid)) bonus += m.ally === cid ? 5 : 3;
  return { sci: Math.round(sci * 10) / 10, gold: Math.round((gold + bonus - upkeep(cid)) * 10) / 10 };
}

function endTurn() {
  if (G.over) return null;
  const h = G.human;
  cityStrikes(h);
  const hs = G.humans.filter(id => civ(id).alive);
  const k = hs.indexOf(h);
  if (k >= 0 && k < hs.length - 1) { startHumanTurn(hs[k + 1]); return 'handover'; }
  ANIM.events = []; ANIM.rec = hs.length <= 1;
  processMinors();
  spawnCamps();
  for (const cv of G.civs) {
    if (cv.human || !cv.alive) continue;
    beginCivTurn(cv.id);
    if (cv.barb) { campsTick(); aiBarbarians(cv); }
    else aiPlay(cv);
    cityStrikes(cv.id);
    if (G.over) break;
  }
  ANIM.rec = false;
  validateRoutes();
  decayMemory();
  processReligion();
  G.turn++;
  processUN();
  recordHistory();
  const alive = G.humans.filter(id => civ(id).alive);
  for (const hh of alive) for (const o of majors()) if (o.id !== hh && G.ob[hh][o.id] === G.turn) notify(hh, `Aftalen om åbne grænser med ${o.name} er udløbet.`, null, 'info');
  checkVictory();
  if (G.over || !alive.length) return null;
  startHumanTurn(alive[0]);
  return alive.length > 1 ? 'handover' : null;
}

function startHumanTurn(id) {
  G.human = id;
  if (!G.exploredBy[id]) G.exploredBy[id] = new Array(G.w * G.h).fill(0);
  G.explored = G.exploredBy[id];
  updateVisibility();
  beginCivTurn(id);
  for (const u of civUnits(id)) {
    if (u.path) followPath(u);
    if (u.auto && u.type === 'worker' && !u.work && G.units.includes(u)) aiWorker(u);
    if (u.explore && G.units.includes(u)) autoExplore(u);
  }
  updateVisibility();
  checkSentries(id);
  checkVictory();
}

function checkVictory() {
  if (G.over) return;
  for (const id of G.humans || [G.human]) {
    const h = civ(id);
    if (h.alive && civCities(id).length === 0 && h.everCity && !civUnits(id).some(u => u.type === 'settler')) {
      h.alive = false;
      notify(-1, `${h.name} er faldet.`, null, 'bad');
    }
  }
  const hum = (G.humans || [G.human]).filter(id => civ(id).alive);
  if (!hum.length) { G.over = { winner: null, how: 'tab' }; return; }
  const alive = majors().filter(c => c.alive);
  if (alive.length === 1 && victoryOn('conquest')) { G.over = { winner: alive[0].id, how: 'erobring' }; return; }
  if (victoryOn('culture')) for (const c of alive) if (cultureProgress(c.id) >= 1) {
    G.over = { winner: c.id, how: 'kultur' };
    notify(-1, `${c.name} har vundet en kulturel sejr.`, null, c.human ? 'good' : 'bad');
    return;
  }
  if (G.turn > maxTurns()) {
    const best = alive.sort((a, b) => score(b.id) - score(a.id))[0];
    G.over = { winner: best.id, how: 'point' };
  }
}

// ---------- Gem / indlæs ----------
const SAVE_KEY = 'imperium-save-v3';
function saveData() {
  const ex = G.explored; G.explored = null;
  try { return JSON.stringify(G); } finally { G.explored = ex; }
}
function saveGame() {
  try { localStorage.setItem(SAVE_KEY, saveData()); return true; } catch (e) { return false; }
}
// Gemte spil i pladser pakkes med gzip, hvis browseren kan
async function packSave(str) {
  if (typeof CompressionStream === 'undefined') return { z: false, d: str };
  const cs = new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'));
  const buf = new Uint8Array(await new Response(cs).arrayBuffer());
  let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return { z: true, d: btoa(bin) };
}
async function unpackSave(p) {
  if (!p.z) return p.d;
  const bin = atob(p.d); const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  const ds = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
  return await new Response(ds).text();
}
function loadFromString(str) {
  try {
    const data = JSON.parse(str);
    if (!data || !data.tiles || !data.civs) return false;
    G = data;
    ensureRealmState();
    ensureWorldState();
    if (G.exploredBy[G.human]) G.explored = G.exploredBy[G.human]; else G.exploredBy[G.human] = G.explored || new Array(G.w * G.h).fill(0);
    assignAllTiles();
    updateVisibility();
    return true;
  } catch (e) { return false; }
}
function loadGame() {
  try {
    const s = localStorage.getItem(SAVE_KEY);
    if (!s) return null;
    G = JSON.parse(s);
    ensureRealmState();
    ensureWorldState();
    if (G.exploredBy[G.human]) G.explored = G.exploredBy[G.human]; else G.exploredBy[G.human] = G.explored;
    for (const id in G.exploredBy) if (+id !== G.human && G.exploredBy[id].length !== G.explored.length) G.exploredBy[id] = new Array(G.w * G.h).fill(0);
    assignAllTiles();
    updateVisibility();
    return G;
  } catch (e) { return null; }
}
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
