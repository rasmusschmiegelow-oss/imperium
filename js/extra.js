// Spiltempo, sejrsformer, produktionskø, automatisering, spionage og Jorden-kortet.
'use strict';

// ---------- Tempo og sejrsformer ----------
function paceK() { return G && G.pace && PACES[G.pace] ? PACES[G.pace].k : 1; }
function maxTurns() { return G && G.pace && PACES[G.pace] ? PACES[G.pace].turns : 400; }
function victoryOn(k) { return !G || !G.victories || G.victories[k] !== false; }
function cultureGoal() { return Math.round(VICTORY.culture * paceK()); }

// ---------- Produktionskø ----------
function queueAdd(c, b) {
  if (!c.queue) c.queue = [];
  if (!c.build) { c.build = b; return; }
  if (c.queue.length < 8) c.queue.push(b);
}
function queueNext(c) {
  if (!c.queue) return;
  while (c.queue.length && !c.build) {
    const b = c.queue.shift();
    const ok = buildOptions(c).some(o => o.kind === b.kind && o.key === b.key && (o.ok || (b.kind === 'unit' && b.key === 'settler')));
    if (ok) c.build = b;
  }
}

// ---------- Automatisk udforskning og vagt ----------
function autoExplore(u) {
  if (!u.explore || u.moves <= 0) return;
  const here = idx(u.x, u.y);
  // ruiner tæt på
  let best = null, bd = 7;
  for (let i = 0; i < G.tiles.length; i++) if (G.tiles[i].ruin && G.explored[i]) { const d = distI(i, here); if (d < bd) { bd = d; best = i; } }
  if (best == null) {
    // nærmeste kendte felt med ukendte naboer
    const seen = new Set([here]); const q = [here]; let n = 0;
    while (q.length && n++ < 1500) {
      const cur = q.shift();
      if (cur !== here && neighborsI(cur).some(j => !G.explored[j])) { best = cur; break; }
      for (const j of neighborsI(cur)) if (!seen.has(j) && G.explored[j] && canEnter(u, j)) { seen.add(j); q.push(j); }
    }
  }
  if (best == null) {
    u.explore = false;
    notify(u.civ, `Din ${UNITS[u.type].name.toLowerCase()} har ikke mere at udforske.`, here, 'info');
    return;
  }
  const p = findPath(u, best);
  if (!p || !p.length) { u.explore = false; return; }
  u.path = p; followPath(u); u.path = null;
}
function checkSentries(cid) {
  for (const u of civUnits(cid)) {
    if (!u.sentry) continue;
    const foe = G.units.find(v => atWar(cid, v.civ) && isMil(v) && dist(v.x, v.y, u.x, u.y) <= 3);
    if (foe) {
      u.sentry = false; u.fort = false;
      notify(cid, `Din ${UNITS[u.type].name.toLowerCase()} har fået øje på ${civ(foe.civ).adj} ${UNITS[foe.type].name.toLowerCase()}.`, idx(u.x, u.y), 'warn');
    }
  }
}

// ---------- Spionage ----------
const SPY_MISSIONS = {
  steal:    { name: 'Stjæl viden',  icon: 'spy_steal',    base: 0.55 },
  sabotage: { name: 'Sabotér',      icon: 'spy_sabotage', base: 0.6 },
  unrest:   { name: 'Skab uro',     icon: 'spy_unrest',   base: 0.65 },
};
function isSpy(u) { return !!UNITS[u.type].spy; }
function spyTarget(u) {
  if (!isSpy(u)) return null;
  return G.cities.find(c => c.civ !== u.civ && isMajor(civ(c.civ)) && dist(c.x, c.y, u.x, u.y) <= 1) || null;
}
function counterSpy(c) { return G.units.some(v => v.civ === c.civ && isSpy(v) && v.x === c.x && v.y === c.y); }
function stealable(u, c) { return civ(c.civ).techs.filter(k => canResearch(civ(u.civ), k)); }
function spyChance(u, c, m) {
  let p = SPY_MISSIONS[m].base;
  if (counterSpy(c)) p -= 0.35;
  if (c.capital) p -= 0.1;
  p += (eraOf(civ(u.civ)) - eraOf(civ(c.civ))) * 0.05;
  return clamp(p, 0.1, 0.9);
}
function spyMissionOk(u, c, m) {
  if (m === 'steal') return stealable(u, c).length > 0;
  if (m === 'sabotage') return !!(c.build && c.prod > 10);
  if (m === 'unrest') return !c.unrest;
  return false;
}
function spyMission(u, m) {
  const c = spyTarget(u);
  if (!c || !spyMissionOk(u, c, m)) return null;
  const me = civ(u.civ), them = civ(c.civ);
  const p = spyChance(u, c, m);
  const ok = Math.random() < p;
  const at = idx(c.x, c.y);
  killUnit(u);
  if (!ok) {
    remember(them.id, me.id, 'spy', -20, 'Blev taget i spionage', 40);
    notify(me.id, `Din spion blev afsløret og taget i ${c.name}.`, at, 'bad');
    notify(them.id, `En spion fra ${me.name} blev fanget i ${c.name}!`, at, 'warn');
    return { ok: false };
  }
  let text = '';
  if (m === 'steal') {
    const k = pick(stealable({ civ: me.id }, c));
    me.techs.push(k); if (me.research === k) me.research = null;
    text = `Din spion har stjålet ${TECHS[k].name} fra ${c.name}!`;
    if (them.human) notify(them.id, `Nogen har stjålet viden fra ${c.name}.`, at, 'bad');
  } else if (m === 'sabotage') {
    const lost = Math.round(c.prod * 0.7);
    c.prod -= lost;
    text = `Din spion har saboteret ${c.name}: ${lost} produktion er tabt.`;
    notify(them.id, `Sabotage i ${c.name}! ${lost} produktion er tabt.`, at, 'bad');
  } else if (m === 'unrest') {
    c.unrest = 6;
    text = `Din spion har skabt uro i ${c.name}.`;
    notify(them.id, `Uro i ${c.name}: indbyggerne er utilfredse i 6 ture.`, at, 'bad');
  }
  notify(me.id, text, at, 'good');
  if (Math.random() < 0.3) { remember(them.id, me.id, 'spy', -12, 'Spionerede mod os', 40); notify(them.id, `Sporene peger på ${me.name}.`, at, 'warn'); }
  assignAllTiles();
  return { ok: true };
}
function aiSpy(u, cv) {
  // første spion bliver hjemme som modspion
  const cap = capitalOf(cv.id);
  if (cap && !counterSpy(cap) && (u.counter || !civUnits(cv.id).some(v => v !== u && isSpy(v) && v.counter))) {
    u.counter = true;
    if (!(u.x === cap.x && u.y === cap.y)) moveToward(u, idx(cap.x, cap.y), 0);
    u.fort = true; return;
  }
  const c = spyTarget(u);
  if (c) {
    const war = atWar(cv.id, c.civ);
    const m = spyMissionOk(u, c, 'steal') ? 'steal' : war && spyMissionOk(u, c, 'sabotage') ? 'sabotage' : war && spyMissionOk(u, c, 'unrest') ? 'unrest' : null;
    if (m) { spyMission(u, m); return; }
  }
  let tgt = u.target != null ? cityById(u.target) : null;
  if (!tgt || tgt.civ === cv.id || !isMajor(civ(tgt.civ))) {
    const cands = G.cities.filter(x => x.civ !== cv.id && isMajor(civ(x.civ)) && G.met[cv.id][x.civ] && (stealable(u, x).length || atWar(cv.id, x.civ)))
      .sort((a, b) => dist(a.x, a.y, u.x, u.y) - dist(b.x, b.y, u.x, u.y));
    tgt = cands[0] || null; u.target = tgt ? tgt.id : null;
  }
  if (!tgt) { u.fort = true; return; }
  const goal = neighbors(tgt.x, tgt.y).filter(j => canEnter(u, j)).sort((a, b) => distI(a, idx(u.x, u.y)) - distI(b, idx(u.x, u.y)))[0];
  if (goal == null) { u.target = null; return; }
  const p = findPath(u, goal);
  if (!p) { u.target = null; return; }
  u.path = p; followPath(u); u.path = null;
}

// ---------- Jorden ----------
// Grove kystlinjer som [længde, bredde]. Hav-polygoner skæres ud bagefter.
const EARTH_LAND = [
  // Nordamerika
  [[-168, 66], [-162, 70], [-156, 71.3], [-140, 69.5], [-128, 70], [-115, 68.5], [-100, 68], [-94, 72], [-82, 69], [-80, 63], [-90, 57], [-92, 57], [-82, 55], [-80, 51], [-78, 58], [-70, 59], [-62, 57], [-56, 52], [-60, 47], [-66, 45], [-70, 42], [-74, 40], [-76, 35], [-81, 31], [-80, 26], [-82, 26], [-84, 30], [-90, 29.5], [-95, 29], [-97, 26], [-97.5, 21], [-95, 18.5], [-91, 19], [-87, 21.5], [-88, 16], [-84, 15], [-83, 10], [-79, 9], [-77, 8], [-80, 7], [-83, 8.5], [-86, 11], [-92, 14.5], [-96, 15.7], [-105, 19.5], [-106, 23], [-110, 24], [-112, 29], [-114.5, 31.5], [-117, 32.5], [-120.5, 34.5], [-124, 40], [-124, 46], [-125, 49], [-131, 54], [-137, 58], [-145, 60], [-152, 59], [-158, 56], [-163, 55], [-158, 59], [-162, 60], [-166, 62], [-165, 64.5]],
  // Grønland og de arktiske øer
  [[-73, 78], [-60, 82], [-30, 83], [-20, 80], [-18, 75], [-22, 70], [-26, 68], [-40, 65], [-43, 60], [-50, 62], [-54, 67], [-56, 72], [-66, 76]],
  [[-90, 74], [-80, 74], [-68, 70], [-62, 66], [-72, 62], [-80, 64], [-86, 68], [-95, 72], [-110, 73], [-120, 74], [-115, 77], [-95, 79], [-80, 80]],
  // Sydamerika
  [[-80, 9], [-77, 8], [-72, 12], [-62, 10.5], [-52, 5], [-50, 0], [-44, -2.5], [-35, -5], [-35, -9], [-39, -15], [-41, -22], [-48, -26], [-53, -34], [-58, -38], [-62, -39], [-65, -42], [-67, -47], [-68, -52], [-72, -54], [-75, -50], [-74, -44], [-73, -37], [-71, -30], [-70, -18], [-76, -14], [-81, -6], [-80, -2], [-80, 1], [-77, 4], [-78, 7]],
  // Eurasien
  [[-9.5, 37], [-9.5, 43.5], [-1.5, 43.5], [-1.5, 46.5], [-5, 48.3], [-1.5, 49.5], [2, 51], [5, 53.3], [8.5, 53.8], [8, 57], [10.5, 57.8], [5, 62], [10, 64], [14, 67.5], [18, 70], [25, 71], [31, 70], [41, 67], [44, 68.5], [53, 68.5], [60, 69.5], [68, 68], [73, 72.5], [80, 73.5], [90, 75.5], [100, 77], [106, 77.7], [113, 74], [129, 72], [140, 72], [150, 71], [160, 69.5], [170, 70], [180, 69], [180, 65], [178, 62], [170, 60], [163, 58], [162, 55], [157, 51], [156, 57], [142, 59], [137, 54], [141, 52], [140, 48], [135, 43.5], [131, 42.5], [129, 40], [129.5, 36], [129, 35], [126.5, 34.5], [126, 37.5], [124.5, 39.8], [121, 40], [118, 39], [121, 37.5], [122, 37], [119, 35], [121, 32], [122, 30], [120, 26], [116, 22.5], [110, 21], [108, 21.5], [106, 19], [109, 12], [105, 8.6], [103, 10.5], [100, 13.5], [99, 10], [100.5, 7], [104, 1.3], [101, 3], [98.5, 8], [98, 16], [94, 16], [92, 21], [91, 22.5], [87, 21.5], [86, 20], [80, 15.5], [80, 10], [77.5, 8], [76, 10], [73, 16], [72.5, 21], [70, 22.5], [67, 24.8], [62, 25], [57, 25.7], [59.8, 22.5], [57, 19], [52, 16], [45, 13], [43.3, 12.7], [42.5, 15], [39, 21.5], [35, 28], [34.2, 27.8], [32.5, 30], [34, 31.3], [35, 33], [36, 36.5], [32, 36.5], [27, 37], [26, 40], [23, 40.5], [22.5, 37], [21, 38.5], [19.5, 41.5], [13.5, 45.5], [12.3, 45], [16, 41.5], [18.5, 40], [16, 38], [15.5, 40], [12.5, 41.8], [10, 44], [7, 43.7], [3, 43.3], [3, 41.7], [0, 40], [-0.5, 38.5], [-2, 36.7], [-5.5, 36], [-6.5, 37]],
  // Afrika
  [[-17, 21], [-17, 15], [-15, 11], [-13, 8], [-8, 4.5], [-3, 5], [4, 6.3], [8.5, 4.5], [9.5, 3], [9, -1], [12, -5], [13.5, -11], [12, -17], [15, -27], [17, -30], [18.5, -34.3], [20, -34.8], [26, -34], [32, -28.5], [33, -26], [35.5, -24], [35, -20], [40, -16], [40.5, -11], [39, -6], [42, -1], [46, 2], [51, 11.5], [44, 10.5], [43.3, 11.6], [42, 14], [39, 18], [37, 22], [35.5, 24], [33.5, 28], [32.5, 30], [30, 31.3], [25, 31.7], [20, 30.5], [19.5, 32], [15, 32.3], [11, 33.5], [10.2, 37], [8, 37], [3, 36.8], [-1, 35.5], [-6, 35.8], [-9.8, 30], [-13, 27.5]],
  [[44, -25], [47, -25], [50.5, -15], [49.5, -12], [47.5, -14], [44, -17], [43.5, -22]],
  // Britiske øer og Island
  [[-5.7, 50], [1.5, 51], [1.7, 52.8], [0, 53.5], [-1.5, 55], [-2, 57], [-3.5, 58.6], [-5, 58.6], [-6, 56.5], [-5, 55], [-3, 54.5], [-3.3, 53.3], [-4.8, 52], [-5.3, 51.6], [-3, 51.4]],
  [[-10, 51.5], [-6, 52], [-6, 54], [-7.5, 55.3], [-10, 54.2]],
  [[-24, 64], [-22, 66.5], [-15, 66.5], [-13.5, 65], [-18, 63.4]],
  // Middelhavsøer
  [[12.4, 38], [15.6, 38.3], [15.1, 36.7]], [[8.2, 39], [9.8, 39], [9.5, 43], [8.6, 42.4]],
  // Japan, Taiwan, Sri Lanka, Sakhalin, Novaja Semlja
  [[130, 31], [131.5, 33.5], [133, 34], [135, 33.5], [140, 35], [141, 38], [142, 40.5], [140, 41.5], [139.5, 38.5], [137, 37], [136, 35.5], [133, 35.5], [130.5, 34]],
  [[140, 41.5], [141.5, 42.5], [145.5, 43.3], [144, 44.5], [141.8, 45.4], [140, 43.2]],
  [[120.2, 22.5], [121.8, 25], [121.6, 22.7]], [[79.8, 6.5], [80, 9.5], [81.8, 7.5], [81, 6]],
  [[142, 46], [143.5, 49], [143, 54], [142, 52]], [[52, 71], [57, 75.5], [68, 77], [58, 74], [53, 70.5]],
  // Sydøstasien og Oceanien
  [[95, 5.5], [98, 4], [106, -3], [106, -6], [102, -4], [97, 1]], [[105, -6.8], [114.5, -8.5], [114, -7.5], [106, -5.8]],
  [[109, 1.5], [110.5, -1.5], [114.5, -4], [116.5, -2], [119, 1], [117.5, 7], [116, 6.5], [113, 3]],
  [[119, -5.5], [120.5, -1], [122, 1.2], [125, 1.5], [121.5, -0.5], [122.5, -5]],
  [[131, -1.3], [138, -1.5], [144, -3.8], [150, -10.5], [146, -8.5], [141, -9], [138, -8.3], [135, -4.5], [132, -4]],
  [[120, 18.5], [122.5, 18.5], [124, 13], [126, 9], [126, 6.5], [122, 7], [121.5, 12], [120.5, 14.5]],
  [[114, -22], [114, -26], [115, -34], [118, -35], [124, -33.5], [129, -31.6], [132, -32], [135, -34.5], [138, -35.5], [140, -38], [146, -39], [150, -37.5], [153, -31], [153.5, -25], [150.5, -22], [146, -19], [145.5, -15], [143.5, -11], [142, -11], [141.5, -15.5], [140, -17.5], [136, -15.5], [136.5, -12], [131, -11.3], [129, -15], [126, -14], [122, -17.5], [119, -20]],
  [[144.6, -40.7], [148.3, -40.9], [148, -43.2], [146, -43.6]],
  [[172.5, -34.5], [178.5, -37.6], [176.8, -39.5], [175, -41.5], [174.5, -39], [173.5, -36]],
  [[172.7, -40.5], [174.3, -41.7], [171, -45], [167, -46.3], [166.5, -45.5], [170.5, -42.5]],
  // Caribien
  [[-85, 22], [-82, 23.2], [-77, 22.3], [-74.2, 20.2], [-77.5, 19.8], [-80, 21.7]], [[-74.5, 18.5], [-72, 20], [-68.4, 18.6], [-71, 17.6]],
];
const EARTH_SEA = [
  [[10.5, 54.3], [14, 54], [19, 54.5], [21.5, 57], [24, 57.5], [23.5, 59.3], [29.5, 60], [22, 60.5], [21.5, 63], [25.5, 65.5], [22, 66], [17, 62.5], [19, 60], [16.5, 57], [14, 55.5], [12.7, 56], [11, 55.7]],
  [[28, 41.5], [28, 43.5], [30, 45.5], [33.5, 44.5], [36.5, 45.3], [38, 47], [39.5, 47], [38, 44.5], [41.5, 41.5], [36, 41.7], [31, 41.2]],
  [[47, 45], [49.5, 46.5], [53, 47], [53, 44.5], [51, 43], [53, 41], [54, 37.5], [50, 37], [49, 38.5], [49.5, 40.5], [48, 42]],
  [[32.5, 30], [35, 28], [39, 21.5], [42.5, 15], [43.5, 12.5], [42, 13], [38.5, 18], [37, 21], [35, 24], [33, 27.5]],
  [[48, 30], [50.5, 30], [54, 26], [56.5, 27], [56, 24.5], [52, 24], [51, 26], [49, 27], [48, 29]],
  [[-95, 59], [-94, 61], [-90, 64], [-82, 63.5], [-77, 62.5], [-78, 58], [-80, 55], [-82, 53], [-86, 55.5], [-92, 57]],
];
// bjergkæder og ørkener som kasser: [lonA, lonB, latA, latB, effekt]
const EARTH_BOXES = [
  [72, 97, 27, 36, 'mountain'], [-125, -105, 32, 60, 'mountain'], [-80, -66, -50, 8, 'andes'], [6, 15, 44, 47.5, 'mountain'], [40, 50, 39, 44, 'mountain'],
  [-15, 35, 16, 31, 'desert'], [35, 58, 15, 32, 'desert'], [88, 115, 38, 46, 'desert'], [120, 142, -32, -20, 'desert'], [15, 25, -28, -20, 'desert'], [-118, -105, 30, 38, 'desert'], [55, 70, 36, 45, 'desert'],
  [-75, -45, -12, 5, 'jungle'], [12, 30, -5, 5, 'jungle'], [95, 125, -8, 20, 'jungle'],
];
function pointInPoly(lon, lat, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
function earthIsLand(lon, lat) {
  if (lat < -56) return false;
  if (!EARTH_LAND.some(p => pointInPoly(lon, lat, p))) return false;
  return !EARTH_SEA.some(p => pointInPoly(lon, lat, p));
}
function earthLatLon(x, y, w, h) {
  const lat = 78 - (y + 0.5) * (136 / h);
  let lon = -180 + (x + 0.5 * (y & 1) + 0.5) * 360 / w;
  if (lon > 180) lon -= 360;
  return [lat, lon];
}
function earthTileOf(lat, lon) {
  const y = clamp(Math.round((78 - lat) / (136 / G.h) - 0.5), 0, G.h - 1);
  const x = Math.round((lon + 180) * G.w / 360 - 0.5 - 0.5 * (y & 1));
  return idx(x, y);
}
// Kaldes fra generateTerrain: fylder højde og fugt ud fra verdenskortet
function earthFields(w, h, n, m) {
  const elev = new Float32Array(w * h), moist = new Float32Array(w * h), lats = new Float32Array(w * h);
  let water = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    const [lat, lon] = earthLatLon(x, y, w, h);
    lats[i] = Math.min(1, Math.abs(lat) / 80);
    const px = x + 0.5 * (y & 1), py = y * 0.87;
    const e0 = n(px, py);
    let mo = m(px, py);
    if (earthIsLand(lon, lat)) {
      let e = 1 + e0 * 0.6;
      for (const [a, b, c, d, k] of EARTH_BOXES) {
        if (lon < a || lon > b || lat < c || lat > d) continue;
        if (k === 'mountain') e += 0.45;
        else if (k === 'andes') { if (lon < -66 - (lat < -20 ? 0 : 4)) e += 0.5; }
        else if (k === 'desert') mo = Math.min(mo, 0.18 + e0 * 0.1);
        else if (k === 'jungle') mo = Math.max(mo, 0.8);
      }
      elev[i] = e;
    } else { elev[i] = e0 * 0.5; water++; }
    moist[i] = mo;
  }
  return { elev, moist, lats, seaQ: water / (w * h) };
}
// Startfelt nær et rigtigt sted
function earthStart(lat, lon, taken, cands) {
  if (lat == null) return null;
  const t = earthTileOf(lat, lon);
  const [tx, ty] = xy(t);
  let best = null, bs = -Infinity;
  for (const j of tilesInRadius(tx, ty, 5)) {
    const tt = G.tiles[j];
    if (!['grass', 'plains', 'hills', 'forest', 'desert'].includes(tt.t)) continue;
    if (taken.some(s => s != null && distI(s, j) < 3)) continue;
    const sc = siteScore(j, G.tiles) * 0.5 - distI(j, t) * 6 + (cands && cands.has(j) ? 2 : 0);
    if (sc > bs) { bs = sc; best = j; }
  }
  return best;
}
