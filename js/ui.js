// Tegning af kortet, input, paneler, animationer og guide.
'use strict';

const SQ3 = Math.sqrt(3);
const S = 32; // hex-radius i verdensenheder
const CORN = [0, 1, 2, 3, 4, 5].map(k => { const a = Math.PI / 180 * (60 * k - 30); return [Math.cos(a), Math.sin(a)]; });
// retning (E, NE, NW, W, SW, SE) -> hjørnepar
const DIR_EDGE = [[0, 1], [5, 0], [4, 5], [3, 4], [2, 3], [1, 2]];
const EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (n) => (Math.round(n * 10) / 10).toLocaleString('da-DK');
const mod = (a, b) => ((a % b) + b) % b;

function worldW() { return S * SQ3 * G.w; }
function center(x, y) { return [S * SQ3 * (x + 0.5 * (y & 1)) + S * SQ3 / 2, S * 1.5 * y + S]; }
function centerI(i) { const [x, y] = xy(i); return center(x, y); }
// Flyt x så den ligger tættest på ref (bruges ved kortets søm)
function nearX(x, ref) { const W = worldW(); while (x - ref > W / 2) x -= W; while (ref - x > W / 2) x += W; return x; }
function worldToTile(wx, wy) {
  const px = wx - S * SQ3 / 2, py = wy - S;
  const q = (SQ3 / 3 * px - py / 3) / S, r = (2 / 3 * py) / S;
  const cx = q, cz = r, cy = -cx - cz;
  let rx = Math.round(cx), ry = Math.round(cy), rz = Math.round(cz);
  const dx = Math.abs(rx - cx), dy = Math.abs(ry - cy), dz = Math.abs(rz - cz);
  if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry;
  const row = rz, col = rx + (row - (row & 1)) / 2;
  return row >= 0 && row < G.h ? idx(col, row) : -1;
}

const GUIDE = [
  { text: 'Grundlæg din første by. Vælg bosætteren, og tryk B eller knappen Grundlæg by.', done: () => civCities(G.human).length > 0 },
  { text: 'Vælg, hvad byen skal producere. En kriger beskytter byen, en arbejder forbedrer jorden.', done: () => civCities(G.human).some(c => c.build) || G.turn > 3 },
  { text: 'Vælg et forskningsemne i teknologitræet (tast T, eller klik på Forskning øverst).', done: () => !!human().research || human().techs.length > 1 },
  { text: 'Udforsk verden med din spejder: vælg den, og klik på et felt længere væk.', done: () => civUnits(G.human).some(u => u.scouted) || !civUnits(G.human).some(u => u.type === 'scout') },
  { text: 'Afslut turen med knappen nederst til højre eller Enter. Enheder, der venter på ordrer, har en gylden ring.', done: () => G.turn >= 2 },
  { text: 'Byg en arbejder, og lad den anlægge farme og miner. Knappen Automatisér lader den klare sig selv.', done: () => civUnits(G.human).some(u => u.type === 'worker') || G.turn > 25 },
  { text: 'Når byen har 2 indbyggere, kan den bygge en bosætter. Flere byer giver mere af alt.', done: () => civCities(G.human).length >= 2 || G.turn > 45 },
  { text: 'Hold byerne tilfredse: templer, markeder, garnisoner og luksusvarer som vin og pelse giver flere arbejdende indbyggere.', done: () => G.turn > 50, manual: true },
  { text: 'Med Sejlads kan landenheder sejle langs kysten, og med Valuta kan karavaner oprette handelsruter. Bystater bliver dine venner, hvis du giver dem gaver under Diplomati.', done: () => G.turn > 70, manual: true },
];

const UI = {
  sel: null, hover: -1, cam: { x: 0, y: 0, z: 1 }, dpr: 1, w: 0, h: 0,
  reach: null, pathPreview: null, raf: 0, busy: false, drawer: null, skip: new Set(), confirmDisband: false,
  anim: null, diploOpen: {},

  init() {
    this.cv = $('#map'); this.ctx = this.cv.getContext('2d');
    this.mm = $('#minimap'); this.mctx = this.mm.getContext('2d');
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.bindInput();
    this.bindKeys();
    $('#btn-tech').onclick = () => this.openTech();
    $('#stat-sci').onclick = () => this.openTech();
    $('#stat-gold').onclick = () => this.openDiplo();
    $('#stat-happy').onclick = () => {
      const c = civCities(G.human).filter(x => x.unhappy > 0).sort((a, b) => b.unhappy - a.unhappy)[0];
      if (c) { this.centerOn(idx(c.x, c.y)); this.openCity(c); }
    };
    $('#btn-diplo').onclick = () => this.openDiplo();
    $('#btn-menu').onclick = () => this.openMenu();
    $('#endturn').onclick = () => this.onEndTurn();
    document.addEventListener('click', e => { if (e.target.closest('button')) SFX.play('click'); });
    this.buildStart();
  },

  // ---------- Start ----------
  buildStart() {
    let chosen = 'dk';
    const pickEl = $('#civ-pick');
    pickEl.innerHTML = CIVS.map(c => `<button type="button" data-k="${c.key}" class="${c.key === chosen ? 'on' : ''}"><i style="background:${c.color}"></i>${esc(c.name)}</button>`).join('');
    pickEl.onclick = (e) => {
      const b = e.target.closest('button'); if (!b) return;
      chosen = b.dataset.k;
      pickEl.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    };
    $('#btn-continue').hidden = !hasSave();
    $('#btn-start').onclick = () => {
      const mv = $('#opt-minors').value;
      const opts = { civ: chosen, opponents: +$('#opt-opp').value, size: $('#opt-size').value, difficulty: $('#opt-diff').value,
        mapType: $('#opt-map').value, minors: mv === 'auto' ? undefined : +mv, tutorial: $('#opt-guide').checked };
      newGame(opts);
      this.enterGame();
      notify(G.human, `Velkommen, hersker over ${human().name}. Grundlæg din første by med bosætteren (tast B).`, null, 'good');
    };
    $('#btn-continue').onclick = () => { if (loadGame()) this.enterGame(); };
    // baggrundskort til startskærmen
    newGame({ civ: 'dk', opponents: 3, size: 'medium', difficulty: 'normal', mapType: 'continents', tutorial: false });
    G.explored.fill(1); VIS = new Uint8Array(G.w * G.h).fill(1);
    G.units = [];
    this.preview = true;
    this.cam.z = Math.max(this.w / (S * SQ3 * (G.w + 1)), this.h / (S * 1.5 * (G.h + 1)));
    this.cam.x = 0; this.cam.y = 0;
    this.dirty();
  },

  enterGame() {
    this.preview = false;
    $('#start').hidden = true;
    ['#topbar', '#minimap-wrap', '#endturn-wrap'].forEach(s => $(s).hidden = false);
    this.sel = null; this.skip = new Set();
    this.sizeMinimap();
    this.cam.z = this.w < 700 ? 0.85 : 1.1;
    const first = civUnits(G.human)[0] || civCities(G.human)[0];
    if (first) this.centerOn(idx(first.x, first.y));
    this.selectNext(true);
    this.refresh();
  },

  // ---------- Kamera ----------
  resize() {
    this.dpr = window.devicePixelRatio || 1;
    this.w = window.innerWidth; this.h = window.innerHeight;
    this.cv.width = this.w * this.dpr; this.cv.height = this.h * this.dpr;
    if (G && !this.preview) this.sizeMinimap();
    this.dirty();
  },
  centerOn(i) {
    const [cx, cy] = centerI(i);
    this.cam.x = cx - this.w / 2 / this.cam.z;
    this.cam.y = cy - this.h / 2 / this.cam.z;
    this.clampCam(); this.dirty();
  },
  screenOf(i) {
    const [cx, cy] = centerI(i);
    return [mod(cx - this.cam.x, worldW()) * this.cam.z, (cy - this.cam.y) * this.cam.z];
  },
  ensureVisible(i) {
    const [sx, sy] = this.screenOf(i);
    if (sx < 80 || sy < 90 || sx > this.w - 80 || sy > this.h - 160) this.centerOn(i);
  },
  clampCam() {
    if (!G) return;
    const wh = S * 1.5 * (G.h + 1);
    const vh = this.h / this.cam.z;
    this.cam.x = mod(this.cam.x, worldW());
    this.cam.y = vh > wh ? (wh - vh) / 2 : clamp(this.cam.y, -vh * 0.25, wh - vh * 0.75);
  },
  zoomAt(f, sx, sy) {
    const z0 = this.cam.z, z1 = clamp(z0 * f, 0.3, 2.6);
    const wx = this.cam.x + sx / z0, wy = this.cam.y + sy / z0;
    this.cam.z = z1; this.cam.x = wx - sx / z1; this.cam.y = wy - sy / z1;
    this.clampCam(); this.dirty();
  },
  screenToTile(sx, sy) { return worldToTile(this.cam.x + sx / this.cam.z, this.cam.y + sy / this.cam.z); },

  // ---------- Input ----------
  bindInput() {
    const cv = this.cv;
    const pts = new Map();
    let down = null, pinch = null;
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('pointerdown', e => {
      if (this.anim) { this.anim.skip = true; return; }
      cv.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: this.cam.z };
        down = null;
      } else down = { x: e.clientX, y: e.clientY, cx: this.cam.x, cy: this.cam.y, moved: false, btn: e.button };
    });
    cv.addEventListener('pointermove', e => {
      if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        this.zoomAt((pinch.z * d / pinch.d) / this.cam.z, (a.x + b.x) / 2, (a.y + b.y) / 2);
        return;
      }
      if (down) {
        const dx = e.clientX - down.x, dy = e.clientY - down.y;
        if (!down.moved && Math.hypot(dx, dy) > 6) down.moved = true;
        if (down.moved) {
          this.cam.x = down.cx - dx / this.cam.z; this.cam.y = down.cy - dy / this.cam.z;
          this.clampCam(); this.dirty(); this.hideTip();
          cv.style.cursor = 'grabbing';
          return;
        }
      }
      if (e.pointerType === 'mouse' && !this.preview) this.onHover(this.screenToTile(e.clientX, e.clientY), e.clientX, e.clientY);
    });
    const end = e => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      cv.style.cursor = '';
      if (down && !down.moved && !this.preview) {
        const i = this.screenToTile(e.clientX, e.clientY);
        if (i >= 0) this.onClick(i, down.btn === 2);
      }
      down = null;
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', e => { pts.delete(e.pointerId); pinch = null; down = null; });
    cv.addEventListener('pointerleave', () => { this.hover = -1; this.pathPreview = null; this.hideTip(); this.dirty(); });
    cv.addEventListener('wheel', e => { e.preventDefault(); if (this.preview) return; this.zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY); }, { passive: false });

    const mm = this.mm;
    let mdown = false;
    const mmGo = e => {
      const r = mm.getBoundingClientRect();
      const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
      const wx = fx * worldW(), wy = fy * S * 1.5 * (G.h + 0.33);
      this.cam.x = wx - this.w / 2 / this.cam.z; this.cam.y = wy - this.h / 2 / this.cam.z;
      this.clampCam(); this.dirty();
    };
    mm.addEventListener('pointerdown', e => { mdown = true; mm.setPointerCapture(e.pointerId); mmGo(e); });
    mm.addEventListener('pointermove', e => { if (mdown) mmGo(e); });
    mm.addEventListener('pointerup', () => { mdown = false; });
  },

  bindKeys() {
    window.addEventListener('keydown', e => {
      if (this.preview || !G) return;
      if (this.anim) { this.anim.skip = true; return; }
      if (this.busy) return;
      if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;
      const k = e.key;
      if (k === 'Escape') {
        if (this.closeModal() || this.closeDrawer()) { this.refresh(); return; }
        if (this.sel) { this.sel = null; this.refresh(); return; }
        this.openMenu(); return;
      }
      if (document.querySelector('.modal-bg')) return;
      const u = this.selUnit();
      const pan = 120 / this.cam.z;
      if (k === 'ArrowLeft') { this.cam.x -= pan; this.clampCam(); this.dirty(); e.preventDefault(); return; }
      if (k === 'ArrowRight') { this.cam.x += pan; this.clampCam(); this.dirty(); e.preventDefault(); return; }
      if (k === 'ArrowUp') { this.cam.y -= pan; this.clampCam(); this.dirty(); e.preventDefault(); return; }
      if (k === 'ArrowDown') { this.cam.y += pan; this.clampCam(); this.dirty(); e.preventDefault(); return; }
      if (k === '+' || k === '=') { this.zoomAt(1.2, this.w / 2, this.h / 2); return; }
      if (k === '-') { this.zoomAt(1 / 1.2, this.w / 2, this.h / 2); return; }
      if (k === 'Enter') { e.preventDefault(); this.onEndTurn(); return; }
      if (k === 't' || k === 'T') { this.openTech(); return; }
      if (k === 'd' || k === 'D') { this.openDiplo(); return; }
      if (k === 'n' || k === 'N' || k === 'Tab') { e.preventDefault(); this.selectNext(); return; }
      if (!u) return;
      const map = { ' ': 'skip', f: 'fort', F: 'fort', b: 'found', B: 'found', i: 'farm', I: 'farm', m: 'mine', M: 'mine', r: 'road', R: 'road', c: 'chop', C: 'chop', a: 'auto', A: 'auto', Delete: 'disband', Backspace: 'disband', h: 'home', H: 'home', u: 'upgrade', U: 'upgrade', g: 'gp', G: 'gp', e: 'route', E: 'route' };
      if (map[k]) { e.preventDefault(); this.doAction(map[k]); }
    });
  },

  selUnit() {
    if (!this.sel || this.sel.unit == null) return null;
    const u = unitById(this.sel.unit);
    if (!u || u.civ !== G.human) return null;
    return u;
  },

  onHover(i, sx, sy) {
    if (i === this.hover) { if (this.tipShown) this.moveTip(sx, sy); return; }
    this.hover = i;
    this.pathPreview = null;
    this.hideTip();
    const u = this.selUnit();
    if (u && i >= 0 && G.explored[i] && i !== idx(u.x, u.y)) {
      if (canAttack(u, i) && VIS[i]) {
        const pv = combatPreview(u, i);
        if (pv) this.showTip(this.oddsHtml(u, pv), sx, sy);
        else if (enemyTarget(u, i) && enemyTarget(u, i).civilians) this.showTip('Tag civil enhed til fange', sx, sy);
      } else {
        const p = findPath(u, i);
        if (p && p.length) this.pathPreview = { path: p, turns: pathTurns(u, p) };
        else this.showTip(this.tileTip(i), sx, sy);
      }
    } else if (i >= 0 && G.explored[i]) {
      this.showTip(this.tileTip(i), sx, sy);
    }
    this.dirty();
  },
  oddsHtml(u, pv) {
    const tgt = pv.city ? pv.city.name : `${civ(pv.unit.civ).adj} ${UNITS[pv.unit.type].name.toLowerCase()}`;
    const r = pv.A / pv.D;
    const verdict = r > 1.5 ? ['Klar fordel', 'var(--good)'] : r > 1.05 ? ['Fordel', 'var(--good)'] : r > 0.85 ? ['Jævnbyrdigt', 'var(--warn)'] : ['Risikabelt', 'var(--bad)'];
    return `<div>${pv.ranged ? 'Beskyd' : 'Angrib'} <b>${esc(tgt)}</b></div>
      <div>Styrke <b>${fmt(pv.A)}</b> mod <b>${fmt(pv.D)}</b></div>
      ${pv.notes.length ? `<div style="color:var(--muted)">${esc(pv.notes.join(' · '))}</div>` : ''}
      <div>Forventet: fjende −${Math.min(100, pv.expD)} liv${pv.ranged ? '' : `, du −${Math.min(100, pv.expA)}`}</div>
      <div class="odds" style="color:${verdict[1]}">${verdict[0]}</div>`;
  },
  tileTip(i) {
    const t = G.tiles[i]; const T = TERRAIN[t.t];
    const y = tileYield(i, null);
    const parts = [`<b>${T.name}</b>${t.res ? ` · ${RESOURCES[t.res].name}${RESOURCES[t.res].lux ? ' (luksusvare)' : ''}` : ''}${t.river ? ' · flod' : ''}`];
    parts.push(`<span style="color:var(--food)">${y.f} mad</span> · <span style="color:var(--prod)">${y.p} prod.</span> · <span style="color:var(--gold)">${y.t} handel</span>`);
    const imp = [t.imp === 'farm' ? 'Farm' : t.imp === 'mine' ? 'Mine' : null, t.road ? 'Vej' : null].filter(Boolean);
    if (imp.length) parts.push(imp.join(', '));
    if (t.owner >= 0) parts.push(`<span style="color:${civ(t.owner).color}">●</span> ${esc(civ(t.owner).minor ? 'Bystaten ' + civ(t.owner).name : civ(t.owner).name)}`);
    if (TERRAIN[t.t].def) parts.push(`Forsvar +${TERRAIN[t.t].def * 100} %`);
    if (t.river) parts.push('Angreb over floden −25 %');
    if (TERRAIN[t.t].move > 1 && TERRAIN[t.t].move < 99) parts.push(`Bevægelse koster ${TERRAIN[t.t].move}`);
    if (t.t === 'mountain') parts.push('Ufremkommeligt');
    if (T.water) parts.push(t.t === 'coast' ? 'Landenheder kan sejle her med Sejlads' : 'Åbent hav kræver Astronomi');
    if (campAt(i)) parts.push('<b style="color:var(--bad)">Barbarlejr</b> · gå ind med en militær enhed for at ødelægge den');
    if (VIS[i]) {
      const us = unitsAt(i).filter(u => u.civ !== G.human);
      if (us.length) parts.push(us.map(u => `${esc(civ(u.civ).adj)} ${UNITS[u.type].name.toLowerCase()} (${u.hp} liv)`).join('<br>'));
    }
    return parts.join('<br>');
  },
  showTip(html, sx, sy) { const t = $('#tooltip'); t.innerHTML = html; t.hidden = false; this.tipShown = true; this.moveTip(sx, sy); },
  moveTip(sx, sy) { const t = $('#tooltip'); const r = t.getBoundingClientRect(); t.style.left = Math.min(sx + 16, this.w - r.width - 8) + 'px'; t.style.top = Math.min(sy + 16, this.h - r.height - 8) + 'px'; },
  hideTip() { $('#tooltip').hidden = true; this.tipShown = false; },

  onClick(i, right) {
    if (this.busy || G.over) return;
    // styring af byfelter mens byen er åben
    if (this.drawer && !right) {
      const c = cityById(this.drawer.city);
      if (c && cityWorkable(c).includes(i)) { this.toggleLock(c, i); return; }
    }
    const u = this.selUnit();
    const here = u ? idx(u.x, u.y) : -1;
    const city = cityAt(i);
    const own = unitsAt(i).filter(v => v.civ === G.human);
    if (u && !right && i === here) {
      if (city && city.civ === G.human) { this.openCity(city); return; }
      if (own.length > 1) { const k = own.indexOf(u); this.select(own[(k + 1) % own.length]); }
      return;
    }
    if (u && (right || (!own.length && !(city && city.civ === G.human)))) {
      if (canAttack(u, i) && VIS[i]) {
        attack(u, i); SFX.play('combat'); this.hideTip(); this.afterAction(u); return;
      }
      if (!G.explored[i]) return;
      const p = findPath(u, i);
      if (p && p.length) {
        u.path = p; u.fort = false; u.sleep = false; u.work = null; u.auto = false;
        followPath(u); SFX.play('move');
        this.afterAction(u);
      } else if (enemyTarget(u, i) && isMil(u)) {
        notify(G.human, embarked(u) ? 'Indskibede enheder kan ikke angribe.' : 'Målet er uden for rækkevidde. Gå tættere på for at angribe.', null, 'warn');
      }
      return;
    }
    if (city && city.civ === G.human) {
      const waiting = own.find(v => this.needsOrders(v));
      if (waiting && !u) { this.select(waiting); return; }
      this.openCity(city); return;
    }
    if (own.length) { this.select(own.find(v => this.needsOrders(v)) || own[0]); return; }
    this.sel = { tile: i }; this.reach = null; this.refresh();
  },

  toggleLock(c, i) {
    const workers = c.pop - (c.unhappy || 0);
    c.locked = c.locked || [];
    if (c.locked.includes(i)) c.locked = c.locked.filter(j => j !== i);
    else { c.locked.push(i); while (c.locked.length > workers) c.locked.shift(); }
    assignAllTiles();
    this.refresh();
  },

  select(u) {
    this.sel = { unit: u.id };
    this.confirmDisband = false;
    this.reach = reachable(u);
    this.ensureVisible(idx(u.x, u.y));
    this.refresh();
  },

  afterAction(u) {
    this.pathPreview = null;
    this.reach = null;
    if (!G.units.includes(u)) { this.sel = null; this.selectNext(); this.refresh(); return; }
    if (u.moves <= 0 || u.work || u.fort) this.selectNext();
    else this.reach = reachable(u);
    checkVictory();
    this.refresh();
    if (G.over) this.showGameOver();
  },

  needsOrders(u) {
    return u.civ === G.human && u.moves > 0 && !u.fort && !u.sleep && !u.work && !u.path && !u.auto && !this.skip.has(u.id);
  },
  waitingUnits() { return civUnits(G.human).filter(u => this.needsOrders(u)); },
  selectNext(silent) {
    const w = this.waitingUnits();
    if (!w.length) { if (!silent) this.sel = null; this.refresh(); return; }
    const cur = this.selUnit();
    const k = cur ? w.indexOf(cur) : -1;
    const next = w[(k + 1) % w.length] === cur && w.length > 1 ? w[(k + 2) % w.length] : w[(k + 1) % w.length];
    this.select(next);
  },

  doAction(a) {
    const u = this.selUnit(); if (!u) return;
    if (a === 'skip') { this.skip.add(u.id); this.selectNext(); return; }
    if (a === 'fort') { if (!isMil(u)) u.sleep = true; else u.fort = true; u.path = null; this.selectNext(); return; }
    if (a === 'cancel') { u.path = null; u.auto = false; u.work = null; u.fort = false; u.sleep = false; this.select(u); return; }
    if (a === 'found') {
      if (canFoundCity(u)) { const c = foundCity(u); this.sel = null; this.refresh(); this.openCity(c); }
      else notify(G.human, 'Her kan du ikke grundlægge en by. Den skal ligge på land, mindst 3 felter fra andre byer og ikke på fremmed jord.', null, 'warn');
      return;
    }
    if (['farm', 'mine', 'road', 'chop'].includes(a)) { if (canWork(u, a)) { startWork(u, a); this.selectNext(); } return; }
    if (a === 'auto') { if (u.type === 'worker') { u.auto = true; aiWorker(u); this.selectNext(); } return; }
    if (a === 'home') {
      const c = civCities(G.human).sort((p, q) => dist(p.x, p.y, u.x, u.y) - dist(q.x, q.y, u.x, u.y))[0];
      if (c) { const p = findPath(u, idx(c.x, c.y)); if (p) { u.path = p; followPath(u); this.afterAction(u); } }
      return;
    }
    if (a === 'upgrade') { if (canUpgrade(u)) { doUpgrade(u); SFX.play('coin'); this.afterAction(u); } return; }
    if (a === 'gp') { if (UNITS[u.type].gp && useGreatPerson(u)) { SFX.play('tech'); this.sel = null; this.selectNext(); } return; }
    if (a === 'route') { const c = routeHere(u); if (c) { establishRoute(u, c); SFX.play('coin'); this.sel = null; this.selectNext(); } return; }
    if (a.startsWith('goto:')) {
      const c = cityById(+a.slice(5)); if (!c) return;
      const goal = c.civ === u.civ ? idx(c.x, c.y) : neighbors(c.x, c.y).filter(j => canEnter(u, j)).sort((p, q) => distI(p, idx(u.x, u.y)) - distI(q, idx(u.x, u.y)))[0];
      const p = goal != null ? findPath(u, goal) : null;
      if (p && p.length) { u.path = p; followPath(u); if (G.units.includes(u) && routeHere(u)) { this.select(u); return; } this.afterAction(u); }
      else if (p && !p.length) this.select(u);
      else notify(G.human, `Karavanen kan ikke finde vej til ${c.name}.`, null, 'warn');
      return;
    }
    if (a === 'disband') {
      if (!this.confirmDisband) { this.confirmDisband = true; this.renderPanel(); return; }
      killUnit(u); this.confirmDisband = false; this.sel = null; this.selectNext(); return;
    }
  },

  async onEndTurn() {
    if (this.busy || G.over || this.anim) return;
    this.closeDrawer();
    const blocker = this.blocker();
    if (blocker) { blocker.go(); return; }
    this.busy = true; $('#busy').hidden = false;
    this.sel = null; this.reach = null; this.pathPreview = null; this.hideTip();
    SFX.play('turn');
    await new Promise(r => setTimeout(r, 30));
    try { endTurn(); } catch (err) { console.error(err); }
    this.skip = new Set();
    this.busy = false; $('#busy').hidden = true;
    saveGame();
    const after = () => {
      if (G.over) { this.refresh(); this.showGameOver(); return; }
      this.selectNext(true);
      this.refresh();
      this.nextOffer();
    };
    this.refresh();
    this.playAnim(ANIM.events.slice(), after);
  },
  nextOffer() {
    while (G.offers && G.offers.length) {
      const o = G.offers.shift();
      if (this.showOffer(o)) return;
    }
  },
  blocker() {
    const h = human();
    if (!h.research && Object.keys(TECHS).some(k => canResearch(h, k))) return { label: 'Vælg forskning', go: () => this.openTech() };
    const idle = civCities(G.human).find(c => !c.build);
    if (idle) return { label: 'Vælg produktion', go: () => { this.centerOn(idx(idle.x, idle.y)); this.openCity(idle); } };
    return null;
  },

  // ---------- Animation af modstandernes træk ----------
  playAnim(events, done) {
    if (!events.length) { done(); return; }
    const trails = new Map(); const atks = [];
    for (const e of events) {
      if (e.t === 'move') {
        let tr = trails.get(e.id);
        if (!tr) { tr = { id: e.id, type: e.type, civ: e.civ, pts: [e.from] }; trails.set(e.id, tr); }
        tr.pts.push(e.to);
      } else atks.push(e);
    }
    const focus = atks.find(a => G.tiles[a.to].owner === G.human || unitsAt(a.to).some(v => v.civ === G.human)) || atks[0];
    if (focus) this.ensureVisible(focus.to);
    const moveDur = trails.size ? Math.min(1400, 500 + 120 * Math.max(...[...trails.values()].map(t => t.pts.length))) : 0;
    const atkDur = atks.length ? 900 : 0;
    this.anim = { trails: [...trails.values()], atks, t0: performance.now(), moveDur, atkDur, hidden: new Set(trails.keys()), done, sounded: false };
    const loop = () => {
      const a = this.anim; if (!a) return;
      const el = performance.now() - a.t0;
      if (a.skip || el > a.moveDur + a.atkDur) { this.anim = null; this.dirty(); a.done(); return; }
      if (!a.sounded && el > a.moveDur && a.atks.length) { a.sounded = true; SFX.play('combat'); }
      this.draw();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  },
  drawAnim() {
    const a = this.anim; if (!a) return;
    const ctx = this.ctx;
    const el = performance.now() - a.t0;
    if (el <= a.moveDur) {
      const p = clamp(el / a.moveDur, 0, 1);
      for (const tr of a.trails) {
        const pts = []; let px = null;
        for (const i of tr.pts) { let [x, y] = centerI(i); if (px != null) x = nearX(x, px); pts.push([x, y]); px = x; }
        const f = p * (pts.length - 1), k = Math.min(pts.length - 2, Math.floor(f)), r = f - k;
        const [x0, y0] = pts[Math.max(0, k)], [x1, y1] = pts[Math.min(pts.length - 1, k + 1)];
        const x = x0 + (x1 - x0) * r, y = y0 + (y1 - y0) * r;
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const q of pts) ctx.lineTo(q[0], q[1]); ctx.stroke(); ctx.setLineDash([]);
        this.drawToken({ type: tr.type, civ: tr.civ, hp: 100 }, x, y, S * 0.43, false);
      }
    } else {
      const p = clamp((el - a.moveDur) / a.atkDur, 0, 1);
      for (const e of a.atks) {
        const [tx, ty] = centerI(e.to); let [fx, fy] = centerI(e.from); fx = nearX(fx, tx);
        ctx.strokeStyle = `rgba(255,120,90,${1 - p})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.fillStyle = `rgba(255,170,80,${0.7 * (1 - p)})`;
        ctx.beginPath(); ctx.arc(tx, ty, S * (0.3 + p * 0.6), 0, 7); ctx.fill();
        ctx.font = '800 16px "Alegreya Sans", sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = `rgba(255,236,220,${1 - p * 0.6})`;
        ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 3;
        ctx.strokeText(`−${e.dmg}`, tx, ty - S * 0.6 - p * 18); ctx.fillText(`−${e.dmg}`, tx, ty - S * 0.6 - p * 18);
      }
    }
  },

  // ---------- Opdatering ----------
  refresh() { this.renderHUD(); this.renderPanel(); this.renderGuide(); this.dirty(); if (this.drawer) this.renderDrawer(); },
  dirty() { if (!this.raf) this.raf = requestAnimationFrame(() => { this.raf = 0; this.draw(); if (!this.preview) this.drawMinimap(); }); },

  renderHUD() {
    if (this.preview) return;
    const h = human();
    $('#civbadge').innerHTML = `<i style="background:${h.color}"></i>${esc(h.name)}`;
    const inc = civIncome(h.id);
    $('#stat-gold').innerHTML = `<span class="k">Guld</span><b class="gold">${fmt(h.gold)}</b><span>${inc.gold >= 0 ? '+' : ''}${fmt(inc.gold)}</span>`;
    if (h.research) {
      const cost = techCost(h, h.research);
      const turns = inc.sci > 0 ? Math.max(1, Math.ceil((cost - h.sci) / inc.sci)) : '∞';
      $('#stat-sci').innerHTML = `<span class="k">Forskning</span><b class="sci">${esc(TECHS[h.research].name)}</b><span class="bar"><span style="width:${clamp(h.sci / cost * 100, 0, 100)}%"></span></span><span>${turns} ${turns === 1 ? 'tur' : 'ture'}</span>`;
    } else {
      $('#stat-sci').innerHTML = `<span class="k">Forskning</span><b class="sci">Vælg et emne</b><span>+${fmt(inc.sci)}</span>`;
    }
    const unh = civCities(h.id).reduce((a, c) => a + (c.unhappy || 0), 0);
    const lux = civLuxuries(h.id).length;
    $('#stat-happy').innerHTML = `<span class="k">Tilfredshed</span>${unh ? `<b class="unhappy">${unh} utilfredse</b>` : '<b class="happy">Tilfredse</b>'}<span>${lux} luksus</span>`;
    $('#stat-happy').title = unh ? 'Utilfredse indbyggere arbejder ikke. Klik for at se den mest utilfredse by.' : 'Alle indbyggere arbejder.';
    $('#stat-year').innerHTML = `<b>${yearLabel(G.turn)}</b><span class="k">Tur ${G.turn}</span>`;
    const b = this.blocker();
    const et = $('#endturn');
    et.textContent = b ? b.label : 'Afslut tur';
    et.classList.toggle('blocker', !!b);
    const w = this.waitingUnits().length;
    $('#waiting').innerHTML = w ? `${w} ${w === 1 ? 'enhed venter' : 'enheder venter'} · <button type="button" id="btn-next">Næste</button>` : '';
    const bn = $('#btn-next'); if (bn) bn.onclick = () => this.selectNext();
  },

  renderGuide() {
    const el = $('#guide');
    if (this.preview || !G || !G.tutorial || !G.tutorial.on) { el.hidden = true; return; }
    const t = G.tutorial;
    while (t.step < GUIDE.length && !GUIDE[t.step].manual && GUIDE[t.step].done()) t.step++;
    if (t.step < GUIDE.length && GUIDE[t.step].manual && GUIDE[t.step].done()) t.step++;
    if (t.step >= GUIDE.length) { t.on = false; el.hidden = true; return; }
    const g = GUIDE[t.step];
    el.innerHTML = `<div class="gh"><span>Guide ${t.step + 1}/${GUIDE.length}</span><button type="button" class="x" id="guide-close" aria-label="Luk guiden">×</button></div>
      <p>${esc(g.text)}</p><div class="gb"><button type="button" class="act" id="guide-next">${g.manual ? 'Forstået' : 'Spring over'}</button></div>`;
    el.hidden = false;
    $('#guide-close').onclick = () => { t.on = false; this.renderGuide(); };
    $('#guide-next').onclick = () => { t.step++; this.renderGuide(); };
  },

  renderPanel() {
    const p = $('#panel');
    if (this.preview || !this.sel) { p.hidden = true; return; }
    if (this.sel.unit != null) {
      const u = unitById(this.sel.unit);
      if (!u) { p.hidden = true; return; }
      const T = UNITS[u.type];
      const cv = civ(u.civ);
      const own = u.civ === G.human;
      const status = u.work ? `${WORKS[u.work.kind].name.replace('Byg ', 'Bygger ').replace('Ryd', 'Rydder')} · ${u.work.left} ${u.work.left === 1 ? 'tur' : 'ture'} tilbage`
        : u.fort ? 'Befæstet' : u.sleep ? 'Sover' : u.auto ? 'Automatiseret' : u.path ? `På vej · ${pathTurns(u, u.path)} ture` : embarked(u) ? 'Indskibet: svagt forsvar, kan ikke angribe' : '';
      const acts = [];
      const A = (key, label, kbd, enabled = true, cls = '', title = '') => `<button type="button" class="act ${cls}" data-a="${key}" ${enabled ? '' : 'disabled'} ${title ? `title="${esc(title)}"` : ''}>${label}${kbd ? ` <kbd>${kbd}</kbd>` : ''}</button>`;
      let extra = '';
      if (own) {
        if (u.type === 'settler') acts.push(A('found', 'Grundlæg by', 'B', canFoundCity(u), 'primary'));
        if (u.type === 'worker') {
          for (const [k, kb] of [['farm', 'I'], ['mine', 'M'], ['road', 'R'], ['chop', 'C']]) {
            if (hasTech(human(), IMPROVEMENT_TECH[k])) acts.push(A(k, WORKS[k].name, kb, canWork(u, k) && !u.work, '', k === 'farm' && G.tiles[idx(u.x, u.y)].t === 'desert' && !freshWater(idx(u.x, u.y)) ? 'Farme i ørkenen kræver en flod i nærheden' : ''));
          }
          acts.push(A('auto', 'Automatisér', 'A', !u.auto));
        }
        if (u.type === 'caravan') {
          const here = routeHere(u);
          if (here) acts.push(A('route', `Opret handelsrute til ${esc(here.name)}`, 'E', true, 'primary'));
          const cands = routeCandidates(u).slice(0, 4);
          const home = cityById(u.home);
          extra = `<div class="sub" style="margin-top:8px">Hjemby: ${home ? esc(home.name) : 'ukendt'}. ${cands.length ? 'Mulige mål:' : 'Ingen mulige mål lige nu. Målet skal være mindst 6 felter væk og have en ledig handelsplads.'}</div>
            ${cands.length ? `<div class="actions-row">${cands.map(o => `<button type="button" class="act" data-a="goto:${o.c.id}">${esc(o.c.name)} <span style="color:var(--gold)">+${o.v}</span></button>`).join('')}</div>` : ''}`;
        }
        if (T.gp) {
          const label = { gp_sci: 'Forsk (stort spring)', gp_mer: 'Handelsmission', gp_eng: 'Hurtigbyg i byen', gp_gen: '' }[u.type];
          const why = { gp_sci: 'Vælg først et forskningsemne', gp_eng: 'Stil ingeniøren i en af dine byer, der bygger noget' }[u.type] || '';
          if (label) acts.push(A('gp', label, 'G', gpActionOk(u), 'primary', gpActionOk(u) ? '' : why));
        }
        const up = upgradeTarget(u);
        if (up) {
          const cost = upgradeCost(u, up);
          const why = G.tiles[idx(u.x, u.y)].owner !== u.civ ? 'Enheden skal stå på dit eget land' : human().gold < cost ? 'Ikke guld nok' : u.moves <= 0 ? 'Ingen bevægelse tilbage' : '';
          acts.push(A('upgrade', `Opgradér til ${UNITS[up].name} (${cost} guld)`, 'U', canUpgrade(u), '', why));
        }
        if (isMil(u)) acts.push(A('fort', 'Befæst', 'F', !u.fort));
        else acts.push(A('fort', 'Sov', 'F', !u.sleep));
        acts.push(A('skip', 'Spring over', 'Mellemrum', u.moves > 0));
        if (u.path || u.auto || u.work || u.fort || u.sleep) acts.push(A('cancel', 'Ny ordre', ''));
        acts.push(A('home', 'Til nærmeste by', 'H', u.moves > 0));
        acts.push(A('disband', this.confirmDisband ? 'Bekræft opløsning' : 'Opløs', '', true, 'danger'));
      }
      const stackUnits = unitsAt(idx(u.x, u.y)).filter(v => v.civ === u.civ);
      const stack = stackUnits.length > 1 ? `<div class="stack">${stackUnits.map(v => `<button type="button" title="${esc(UNITS[v.type].name)}" data-u="${v.id}" class="${v === u ? 'on' : ''}">${ART.unitGlyph(v.type)}</button>`).join('')}</div>` : '';
      const hpc = u.hp > 60 ? 'var(--good)' : u.hp > 30 ? 'var(--warn)' : 'var(--bad)';
      p.innerHTML = `<h3><span class="glyph" style="--unit-civ:${cv.color}">${ART.unitGlyph(u.type, 22, '#FFFFFF')}</span>${esc(T.name)}${u.vet ? ' <span class="chip w">Veteran</span>' : ''}${generalNear(u) && isMil(u) ? ' <span class="chip w">General</span>' : ''}</h3>
        <div class="sub">${own ? '' : esc(cv.name) + ' · '}${status || (T.desc ? esc(T.desc) : TERRAIN[G.tiles[idx(u.x, u.y)].t].name)}</div>
        <div class="kv">${T.str ? `<div><span>Styrke</span> <b>${T.str}</b></div>` : ''}${T.ranged ? `<div><span>Afstand</span> <b>${T.ranged}</b> <span>(${T.range} felter)</span></div>` : ''}
        <div><span>Bevægelse</span> <b>${fmt(u.moves)}/${T.moves}</b></div><div><span>Liv</span> <b>${u.hp}</b></div></div>
        <div class="hpbar"><span style="width:${u.hp}%;background:${hpc}"></span></div>
        ${stack}${extra}
        <div class="actions-row">${acts.join('')}</div>`;
      p.querySelectorAll('[data-a]').forEach(b => b.onclick = () => this.doAction(b.dataset.a));
      p.querySelectorAll('[data-u]').forEach(b => b.onclick = () => this.select(unitById(+b.dataset.u)));
      p.hidden = false;
      return;
    }
    if (this.sel.tile != null) {
      const i = this.sel.tile;
      const c = cityAt(i);
      if (c && G.explored[i]) {
        const cv = civ(c.civ);
        const minorInfo = cv.minor ? ` · ${MINOR_TYPES[cv.mtype].name.toLowerCase()} · ${minorStatus(cv, G.human).toLowerCase()} (indflydelse ${cv.inf[G.human] || 0})` : '';
        p.innerHTML = `<h3><span style="color:${cv.color}">●</span>${esc(c.name)}</h3><div class="sub">${esc(cv.minor ? 'Bystat' : cv.name)}${c.capital && !cv.minor ? ' · hovedstad' : ''}${esc(minorInfo)}</div>
          <div class="kv"><div><span>Indbyggere</span> <b>${c.pop}</b></div><div><span>Forsvar</span> <b>${fmt(cityStrength(c))}</b></div><div><span>Liv</span> <b>${c.hp}</b></div>${cityHasWalls(c) ? '<div><b>Bymur</b></div>' : ''}</div>`;
      } else {
        p.innerHTML = `<div class="sub" style="margin:0">${this.tileTip(i)}</div>`;
      }
      p.hidden = false;
      return;
    }
    p.hidden = true;
  },

  toast(e) {
    if (this.preview) return;
    const box = $('#toasts');
    const d = document.createElement('div');
    d.className = `toast ${e.kind}`;
    d.textContent = e.text;
    if (e.at != null) { d.title = 'Vis på kortet'; d.onclick = () => { this.centerOn(e.at); d.remove(); }; }
    else d.onclick = () => d.remove();
    box.appendChild(d);
    while (box.children.length > 5) box.firstChild.remove();
    setTimeout(() => d.remove(), e.kind === 'bad' ? 9000 : 6000);
    if (e.kind === 'bad' && !this.busy) SFX.play('bad');
  },

  // ---------- Tegning ----------
  draw() {
    if (!G) return;
    const ctx = this.ctx, z = this.cam.z, dpr = this.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#080b10';
    ctx.fillRect(0, 0, this.w, this.h);
    const W = worldW();
    const x0 = this.cam.x, y0 = this.cam.y, x1 = x0 + this.w / z, y1 = y0 + this.h / z;
    this.vy0 = y0; this.vy1 = y1;
    this.r0 = Math.max(0, Math.floor((y0 - S) / (1.5 * S)) - 1); this.r1 = Math.min(G.h - 1, Math.ceil(y1 / (1.5 * S)) + 1);
    const copies = [];
    for (let k = Math.floor((x0 - S * 2) / W); k <= Math.floor((x1 + S * 2) / W); k++) copies.push(k);
    const detail = z > 0.55;
    this.unitMap = new Map();
    for (const v of G.units) { const i = idx(v.x, v.y); if (!this.unitMap.has(i)) this.unitMap.set(i, []); this.unitMap.get(i).push(v); }
    for (const k of copies) {
      ctx.setTransform(dpr * z, 0, 0, dpr * z, (-this.cam.x + k * W) * dpr * z, -this.cam.y * dpr * z);
      this.vx0 = x0 - k * W; this.vx1 = x1 - k * W;
      const vis = this.visibleTiles();
      for (const i of vis) { const [cx, cy] = centerI(i); ART.terrain(ctx, G.tiles[i], i, cx, cy, detail); }
      for (const i of vis) this.drawRiver(i);
      if (detail) for (const i of vis) this.drawRoads(i);
      if (detail) for (const i of vis) this.drawExtras(i);
      for (const i of vis) this.drawBorders(i);
      this.drawRoutes();
      for (const cp of G.camps) if (G.explored[cp.i] && this.inView(cp.i)) { const [cx, cy] = centerI(cp.i); ART.camp(ctx, cx, cy); }
      ctx.fillStyle = 'rgba(6,8,12,0.5)';
      for (const i of vis) if (!VIS[i]) { const [cx, cy] = centerI(i); this.hexPath(cx, cy, S + 0.6); ctx.fill(); }
      this.drawCityOverlay();
      this.drawSelection();
      for (const c of G.cities) { const i = idx(c.x, c.y); if (G.explored[i] && this.inView(i)) { const [cx, cy] = centerI(i); ART.city(ctx, c, cx, cy); this.drawCityHp(c, cx, cy); } }
      for (const [i, us] of this.unitMap) if (VIS[i] && this.inView(i)) this.drawStack(i, us);
      const u = this.selUnit();
      if (u && (this.pathPreview || u.path)) this.drawPath(u, this.pathPreview ? this.pathPreview.path : u.path, this.pathPreview ? this.pathPreview.turns : null);
      for (const c of G.cities) if (G.explored[idx(c.x, c.y)] && this.inView(idx(c.x, c.y))) this.drawCityLabel(c);
      if (this.anim) this.drawAnim();
    }
  },
  visibleTiles() {
    const out = [];
    const c0 = Math.max(0, Math.floor(this.vx0 / (S * SQ3)) - 1), c1 = Math.min(G.w - 1, Math.ceil(this.vx1 / (S * SQ3)) + 1);
    for (let y = this.r0; y <= this.r1; y++) for (let x = c0; x <= c1; x++) { const i = y * G.w + x; if (G.explored[i]) out.push(i); }
    return out;
  },
  inView(i) {
    const [cx, cy] = centerI(i);
    return cx > this.vx0 - S * 3 && cx < this.vx1 + S * 3 && cy > this.vy0 - S * 3 && cy < this.vy1 + S * 3;
  },

  hexPath(cx, cy, s) {
    const ctx = this.ctx; ctx.beginPath();
    for (let k = 0; k < 6; k++) { const px = cx + CORN[k][0] * s, py = cy + CORN[k][1] * s; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.closePath();
  },

  drawRiver(i) {
    const t = G.tiles[i];
    if (!t.river) return;
    const ctx = this.ctx; const [cx, cy] = centerI(i);
    ctx.strokeStyle = '#3f86c4'; ctx.lineCap = 'round'; ctx.lineWidth = 4;
    if (t.riverTo >= 0) {
      let [nx, ny] = centerI(t.riverTo); nx = nearX(nx, cx);
      const toWater = isWater(t.riverTo);
      const ex = toWater ? (cx + nx) / 2 : nx, ey = toWater ? (cy + ny) / 2 : ny;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
    }
    const feeds = neighborsI(i).some(j => G.tiles[j].riverTo === i);
    if (!feeds) { ctx.fillStyle = '#3f86c4'; ctx.beginPath(); ctx.arc(cx, cy, 3, 0, 7); ctx.fill(); }
  },

  drawRoads(i) {
    const t = G.tiles[i];
    const isC = !!cityAt(i);
    if (!t.road && !isC) return;
    const ctx = this.ctx; const [x, y] = xy(i); const [cx, cy] = centerI(i);
    ctx.strokeStyle = 'rgba(92,66,38,0.75)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    let any = false;
    for (let d = 0; d < 6; d++) {
      const j = neighborDir(x, y, d); if (j < 0 || !G.explored[j]) continue;
      if (G.tiles[j].road || cityAt(j)) {
        if (isC && cityAt(j)) continue;
        let [nx, ny] = centerI(j); nx = nearX(nx, cx);
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo((cx + nx) / 2, (cy + ny) / 2); ctx.stroke(); any = true;
      }
    }
    if (!any && !isC) { ctx.fillStyle = 'rgba(92,66,38,0.75)'; ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, 7); ctx.fill(); }
  },

  drawExtras(i) {
    const ctx = this.ctx; const t = G.tiles[i]; const [cx, cy] = centerI(i);
    if (t.imp === 'farm') {
      ctx.strokeStyle = 'rgba(232,214,120,0.85)'; ctx.lineWidth = 1.6;
      for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(cx - S * 0.45, cy + k * 6 + 8); ctx.lineTo(cx + S * 0.1, cy + k * 6 + 2); ctx.stroke(); }
    } else if (t.imp === 'mine') {
      ctx.fillStyle = '#3a2f24';
      ctx.beginPath(); ctx.moveTo(cx - 9, cy + 12); ctx.lineTo(cx - 9, cy + 4); ctx.arc(cx - 3, cy + 4, 6, Math.PI, 0); ctx.lineTo(cx + 3, cy + 12); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#c9a45c'; ctx.lineWidth = 1.2; ctx.stroke();
    }
    if (t.res && !cityAt(i)) ART.resource(ctx, t.res, cx + S * 0.38, cy - S * 0.36, S * 0.44);
  },

  drawBorders(i) {
    const t = G.tiles[i]; if (t.owner < 0) return;
    const ctx = this.ctx; const [x, y] = xy(i); const [cx, cy] = centerI(i);
    const col = civ(t.owner).color;
    ctx.globalAlpha = 0.13; ctx.fillStyle = col; this.hexPath(cx, cy, S); ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = col; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    const ins = 0.9;
    for (let d = 0; d < 6; d++) {
      const j = neighborDir(x, y, d);
      if (j >= 0 && G.tiles[j].owner === t.owner) continue;
      const [a, b] = DIR_EDGE[d];
      ctx.beginPath();
      ctx.moveTo(cx + CORN[a][0] * S * ins, cy + CORN[a][1] * S * ins);
      ctx.lineTo(cx + CORN[b][0] * S * ins, cy + CORN[b][1] * S * ins);
      ctx.stroke();
    }
  },

  drawRoutes() {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(232,195,76,0.55)'; ctx.lineWidth = 2; ctx.setLineDash([2, 6]);
    for (const r of G.routes) {
      const a = cityById(r.a), b = cityById(r.b);
      if (!a || !b || (a.civ !== G.human && b.civ !== G.human)) continue;
      const [ax, ay] = center(a.x, a.y); let [bx, by] = center(b.x, b.y); bx = nearX(bx, ax);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    }
    ctx.setLineDash([]);
  },

  // Felter byen arbejder, vises når byen er åben
  drawCityOverlay() {
    if (!this.drawer) return;
    const c = cityById(this.drawer.city); if (!c) return;
    const ctx = this.ctx;
    for (const j of cityWorkable(c)) {
      const [cx, cy] = centerI(j);
      const worked = c.worked.includes(j), locked = (c.locked || []).includes(j);
      ctx.strokeStyle = worked ? '#ead097' : 'rgba(255,255,255,0.25)'; ctx.lineWidth = worked ? 2.5 : 1;
      this.hexPath(cx, cy, S * 0.82); ctx.stroke();
      if (worked) {
        const y = tileYield(j, c);
        const pips = [['#93d05e', y.f], ['#df8c4d', y.p], ['#e8c34c', y.t]];
        let px = cx - 13;
        ctx.fillStyle = 'rgba(10,13,18,0.75)'; this.roundRect(cx - 17, cy + 6, 34, 12, 6); ctx.fill();
        ctx.font = '800 9.5px "Alegreya Sans", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (const [col, v] of pips) { ctx.fillStyle = col; ctx.fillText(String(v), px + 2, cy + 12.5); px += 11; }
      }
      if (locked) ART.misc(ctx, 'lock', cx, cy - 10, 12);
    }
  },

  drawSelection() {
    const ctx = this.ctx;
    const u = this.selUnit();
    if (u && this.reach) {
      ctx.fillStyle = 'rgba(234,208,151,0.13)';
      for (const i of this.reach) { if (!this.inView(i)) continue; const [cx, cy] = centerI(i); this.hexPath(cx, cy, S * 0.92); ctx.fill(); }
    }
    if (u && u.moves > 0 && isMil(u)) {
      const T = UNITS[u.type];
      ctx.strokeStyle = 'rgba(228,108,96,0.95)'; ctx.lineWidth = 3;
      for (const j of tilesInRadius(u.x, u.y, T.ranged ? T.range : 1)) {
        if (VIS[j] && canAttack(u, j)) { const [cx, cy] = centerI(j); this.hexPath(cx, cy, S * 0.86); ctx.stroke(); }
      }
    }
    if (this.sel) {
      const su = this.sel.unit != null ? unitById(this.sel.unit) : null;
      const si = su ? idx(su.x, su.y) : this.sel.tile;
      if (si != null && si >= 0) { const [cx, cy] = centerI(si); ctx.strokeStyle = '#ead097'; ctx.lineWidth = 3; this.hexPath(cx, cy, S * 0.94); ctx.stroke(); }
    }
    if (this.hover >= 0 && G.explored[this.hover] && !this.busy) {
      const [cx, cy] = centerI(this.hover); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; this.hexPath(cx, cy, S * 0.96); ctx.stroke();
    }
  },

  drawCityHp(c, cx, cy) {
    if (c.hp >= 100) return;
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(cx - 18, cy + S * 0.55, 36, 5);
    ctx.fillStyle = c.hp > 50 ? '#7cc47f' : c.hp > 25 ? '#e8b64e' : '#e46c60'; ctx.fillRect(cx - 18, cy + S * 0.55, 36 * c.hp / 100, 5);
  },

  drawCityLabel(c) {
    const ctx = this.ctx; const [cx, cy] = center(c.x, c.y);
    const z = this.cam.z;
    const fs = clamp(12.5 / z, 9, 24);
    ctx.font = `700 ${fs}px "Alegreya Sans", sans-serif`;
    const cv = civ(c.civ);
    const own = c.civ === G.human;
    const name = (c.capital && !cv.minor ? '★ ' : '') + c.name + (own && c.unhappy ? ` ☹${c.unhappy}` : '');
    const tw = ctx.measureText(name).width;
    const pad = fs * 0.45, bh = fs * 1.5, popW = fs * 1.6;
    const total = popW + tw + pad * 2;
    const lx = cx - total / 2, ly = cy - S * 0.98 - bh;
    ctx.fillStyle = 'rgba(12,15,21,0.9)';
    this.roundRect(lx, ly, total, bh, bh / 2); ctx.fill();
    if (cv.minor) { ctx.strokeStyle = cv.color; ctx.lineWidth = 1.5; ctx.stroke(); }
    ctx.fillStyle = cv.color; this.roundRect(lx, ly, popW, bh, bh / 2); ctx.fill();
    ctx.fillStyle = cv.minor ? '#1b1408' : '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(c.pop), lx + popW / 2, ly + bh / 2 + 0.5);
    ctx.fillStyle = '#ece6d8'; ctx.textAlign = 'left';
    ctx.fillText(name, lx + popW + pad, ly + bh / 2 + 0.5);
    if (own) {
      const cost = buildCost(c.build);
      const prog = c.build && cost ? clamp(c.prod / cost, 0, 1) : 0;
      ctx.fillStyle = 'rgba(12,15,21,0.9)'; ctx.fillRect(lx + popW, ly + bh - 3, total - popW - bh / 3, 3);
      ctx.fillStyle = c.build ? '#df8c4d' : '#e46c60'; ctx.fillRect(lx + popW, ly + bh - 3, (total - popW - bh / 3) * (c.build ? prog : 1), 3);
    }
  },
  roundRect(x, y, w, h, r) { const ctx = this.ctx; ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); },

  drawToken(u, cx, cy, r, ring) {
    const ctx = this.ctx;
    const col = civ(u.civ).color;
    const emb = u.x != null && embarked(u);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(cx, cy + 2.5, r, 0, 7); ctx.fill();
    if (emb || UNITS[u.type].domain === 'sea') {
      ctx.fillStyle = '#5a3d22'; ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.65, r * 1.15, r * 0.42, 0, 0, Math.PI); ctx.fill();
    }
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
    ctx.lineWidth = u.fort ? 3.2 : 2; ctx.strokeStyle = u.fort ? '#d8d0bf' : 'rgba(255,255,255,0.85)'; ctx.stroke();
    if (ring) { ctx.strokeStyle = '#ead097'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, r + 3.5, 0, 7); ctx.stroke(); }
    ART.unit(ctx, u.type, cx, cy, r);
    if (u.hp < 100) {
      ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(cx - r, cy + r + 2, r * 2, 4);
      ctx.fillStyle = u.hp > 60 ? '#7cc47f' : u.hp > 30 ? '#e8b64e' : '#e46c60'; ctx.fillRect(cx - r, cy + r + 2, r * 2 * u.hp / 100, 4);
    }
  },

  drawStack(i, all) {
    const hidden = this.anim && this.anim.hidden;
    const us = hidden ? all.filter(v => !hidden.has(v.id)) : all;
    if (!us.length) return;
    const ctx = this.ctx; let [cx, cy] = centerI(i);
    const city = cityAt(i);
    const sel = this.selUnit();
    const u = us.includes(sel) ? sel : (us.filter(isMil).sort((a, b) => UNITS[b.type].str - UNITS[a.type].str)[0] || us[0]);
    const r = city ? S * 0.33 : S * 0.43;
    if (city) { cx -= S * 0.42; cy += S * 0.3; }
    this.drawToken(u, cx, cy, r, u.civ === G.human && this.needsOrders(u) && u !== sel);
    if (us.length > 1) {
      ctx.fillStyle = '#0f131a'; ctx.beginPath(); ctx.arc(cx + r * 0.85, cy - r * 0.85, 7, 0, 7); ctx.fill();
      ctx.strokeStyle = civ(u.civ).color; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.font = '700 10px "Alegreya Sans", sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(us.length), cx + r * 0.85, cy - r * 0.85 + 0.5);
    }
    if (u.work) { ctx.fillStyle = '#0f131a'; ctx.beginPath(); ctx.arc(cx + r * 0.9, cy + r * 0.6, 7, 0, 7); ctx.fill(); ART.misc(ctx, 'work', cx + r * 0.9, cy + r * 0.6, 11); }
  },

  drawPath(u, path, turns) {
    const ctx = this.ctx;
    const [px, py] = center(u.x, u.y);
    ctx.strokeStyle = 'rgba(234,208,151,0.9)'; ctx.lineWidth = 2.5; ctx.setLineDash([6, 5]);
    ctx.beginPath(); ctx.moveTo(px, py);
    let lx = px, ly = py;
    for (const p of path) { let [x, y] = centerI(p); x = nearX(x, lx); ctx.lineTo(x, y); lx = x; ly = y; }
    ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#ead097'; ctx.beginPath(); ctx.arc(lx, ly, 10, 0, 7); ctx.fill();
    if (turns != null) {
      ctx.fillStyle = '#1b1408'; ctx.font = '800 12px "Alegreya Sans", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(turns), lx, ly + 0.5);
    }
  },

  sizeMinimap() {
    const maxW = 220;
    const ww = worldW(), wh = S * 1.5 * (G.h + 0.33);
    const w = maxW, h = Math.round(maxW * wh / ww);
    this.mm.width = w * this.dpr; this.mm.height = h * this.dpr;
    this.mm.style.width = w + 'px'; this.mm.style.height = h + 'px';
    this.mmScale = w / ww;
  },
  drawMinimap() {
    if (!G || $('#minimap-wrap').hidden) return;
    const ctx = this.mctx; const k = this.mmScale * this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#080b10'; ctx.fillRect(0, 0, this.mm.width, this.mm.height);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    const cw = S * SQ3 + 1, ch = S * 1.5 + 1;
    for (let i = 0; i < G.tiles.length; i++) {
      if (!G.explored[i]) continue;
      const t = G.tiles[i];
      const [cx, cy] = centerI(i);
      ctx.fillStyle = t.owner >= 0 && !TERRAIN[t.t].water ? civ(t.owner).color : TERRAIN[t.t].color;
      ctx.globalAlpha = VIS[i] ? 1 : 0.6;
      ctx.fillRect(cx - cw / 2, cy - ch / 2, cw, ch);
    }
    ctx.globalAlpha = 1;
    for (const c of G.cities) {
      if (!G.explored[idx(c.x, c.y)]) continue;
      const [cx, cy] = center(c.x, c.y);
      ctx.fillStyle = '#fff'; ctx.fillRect(cx - S * 0.9, cy - S * 0.9, S * 1.8, S * 1.8);
    }
    ctx.strokeStyle = '#ead097'; ctx.lineWidth = 2 / k;
    const vx = mod(this.cam.x, worldW()), vw = this.w / this.cam.z, vh = this.h / this.cam.z;
    ctx.strokeRect(vx, this.cam.y, vw, vh);
    ctx.strokeRect(vx - worldW(), this.cam.y, vw, vh);
  },

  // ---------- By ----------
  openCity(c) {
    this.drawer = { city: c.id };
    this.sel = { tile: idx(c.x, c.y) };
    this.renderDrawer();
    this.refresh();
  },
  closeDrawer() {
    if (!this.drawer) return false;
    this.drawer = null;
    const d = document.querySelector('.drawer'); if (d) d.remove();
    this.dirty();
    return true;
  },
  renderDrawer() {
    const c = cityById(this.drawer.city);
    let d = document.querySelector('.drawer');
    if (!c || c.civ !== G.human) { if (d) d.remove(); this.drawer = null; return; }
    const scroll = d ? d.querySelector('.body').scrollTop : 0;
    if (!d) { d = document.createElement('aside'); d.className = 'drawer'; document.body.appendChild(d); }
    const y = cityYields(c);
    const hp = cityHappiness(c);
    const cv = civ(c.civ);
    const growT = y.foodNet > 0 ? Math.ceil((y.need - c.food) / y.foodNet) : null;
    const cost = buildCost(c.build);
    const turns = (b) => { const left = Math.max(0, buildCost(b) - c.prod); return y.p > 0 ? Math.max(1, Math.ceil(left / y.p)) : '∞'; };
    const bc = buyCost(c);
    const opts = buildOptions(c);
    const glyphFor = (o) => o.kind === 'unit' ? ART.unitGlyph(o.key, 22, '#ECE6D8') : ART.miscGlyph(o.kind === 'bld' ? 'bld' : o.kind === 'wonder' ? 'wonder' : o.key === 'spaceship' ? 'spaceship' : 'wealth');
    const descFor = (o) => {
      if (o.kind === 'unit') { const U = UNITS[o.key]; return U.str ? `Styrke ${U.str}${U.ranged ? ` · afstand ${U.ranged}` : ''} · ${U.moves} bevægelse${U.domain === 'sea' ? ' · skib' : ''}` : U.desc; }
      return (o.kind === 'bld' ? BUILDINGS : o.kind === 'wonder' ? WONDERS : PROJECTS)[o.key].desc + (o.kind === 'bld' && BUILDINGS[o.key].upkeep ? ` · ${BUILDINGS[o.key].upkeep} guld/tur` : '');
    };
    const group = (kind, title) => {
      const list = opts.filter(o => o.kind === kind);
      if (!list.length) return '';
      return `<div class="section-h">${title}</div><div class="blist">${list.map(o => {
        const on = c.build && c.build.kind === o.kind && c.build.key === o.key;
        const cst = buildCost(o);
        const reason = !o.ok ? (o.key === 'settler' ? 'Kræver 2 indbyggere' : 'Bygges allerede') : '';
        return `<button type="button" class="bopt ${on ? 'on' : ''}" data-k="${o.kind}:${o.key}" ${o.ok ? '' : 'disabled'}>
          <span class="g">${glyphFor(o)}</span><span><span class="n">${esc(buildName(o))}</span><span class="d">${esc(reason || descFor(o))}</span></span>
          <span class="c">${o.key === 'wealth' ? '' : `${cst} · ${turns(o)} t`}</span></button>`;
      }).join('')}</div>`;
    };
    const wondersHere = Object.entries(G.wonders).filter(([, id]) => id === c.id).map(([k]) => WONDERS[k].name);
    const routes = routesOf(c).map(r => { const o = cityById(r.a === c.id ? r.b : r.a); return o ? `<span class="chip">${esc(o.name)} +${routeValue(c, o)}</span>` : ''; }).join('');
    d.innerHTML = `<header><span class="pop" style="background:${cv.color}">${c.pop}</span><h2>${c.capital ? '★ ' : ''}${esc(c.name)}</h2><button type="button" class="x" aria-label="Luk">×</button></header>
      <div class="body">
        <div class="yields">
          <div class="y-food"><b>${y.foodNet >= 0 ? '+' : ''}${y.foodNet}</b><span>Mad</span></div>
          <div class="y-prod"><b>${y.p}</b><span>Prod.</span></div>
          <div class="y-sci"><b>${fmt(y.sci)}</b><span>Forsk.</span></div>
          <div class="y-gold"><b>${fmt(y.gold)}</b><span>Guld</span></div>
          <div class="y-cul"><b>${y.culture}</b><span>Kultur</span></div>
        </div>
        <div class="kv"><div><span>Vækst</span> <b>${c.food}/${y.need}</b> <span>${c.pop >= y.cap ? '· kræver akvædukt' : growT ? `· ${growT} ture` : y.foodNet < 0 ? '· sulter!' : '· står stille'}</span></div>
        <div><span>Forsvar</span> <b>${fmt(cityStrength(c))}</b></div><div><span>Liv</span> <b>${c.hp}</b></div></div>
        <div class="section-h">Tilfredshed</div>
        <div class="happy-row"><b class="${hp.unhappy ? 'unhappy' : 'happy'}">${c.pop - hp.unhappy} arbejder · ${hp.unhappy} utilfredse</b><span>Plads til ${hp.content} tilfredse</span></div>
        <div class="chips">${hp.src.map(s => `<span class="chip ${s[1] < 0 ? 'neg' : ''}">${esc(s[0])} ${s[1] > 0 ? '+' : ''}${s[1]}</span>`).join('')}</div>
        <div class="section-h">Fokus</div>
        <div class="seg">${Object.entries(FOCUS).map(([k, f]) => `<button type="button" data-f="${k}" class="${(c.focus || 'balanced') === k ? 'on' : ''}">${f.name}</button>`).join('')}</div>
        <p class="hint-s">Klik på felterne omkring byen på kortet for at låse, hvilke felter indbyggerne arbejder på.${(c.locked || []).length ? ` <button type="button" class="linkbtn" id="unlock">Fjern låse (${c.locked.length})</button>` : ''}</p>
        <div class="section-h">Produktion</div>
        <div class="current">
          <div class="top">${c.build ? esc(buildName(c.build)) : 'Intet valgt'}<span>${c.build && c.build.key !== 'wealth' ? `${c.prod}/${cost} · ${turns(c.build)} ${turns(c.build) === 1 ? 'tur' : 'ture'}` : ''}</span></div>
          ${c.build && c.build.key !== 'wealth' ? `<div class="progress"><span style="width:${clamp(c.prod / cost * 100, 0, 100)}%"></span></div>` : ''}
          ${c.build && isFinite(bc) && c.build.key !== 'wealth' ? `<div><button type="button" class="act ${cv.gold >= bc ? 'primary' : ''}" id="buy" ${cv.gold >= bc ? '' : 'disabled'}>Køb nu for ${bc} guld</button></div>` : ''}
        </div>
        ${group('unit', 'Enheder')}${group('bld', 'Bygninger')}${group('wonder', 'Vidundere')}${group('proj', 'Projekter')}
        <div class="section-h">Handelsruter (${routesOf(c).length}/${maxRoutes(c)})</div>
        <div class="chips">${routes || '<span style="color:var(--muted)">Ingen endnu. Byg en karavane, og send den til en by mindst 6 felter væk.</span>'}</div>
        <div class="section-h">I byen</div>
        <div class="chips">${c.blds.length || wondersHere.length ? c.blds.map(b => `<span class="chip">${esc(BUILDINGS[b].name)}</span>`).join('') + wondersHere.map(w => `<span class="chip w">${esc(w)}</span>`).join('') : '<span style="color:var(--muted)">Ingen bygninger endnu.</span>'}</div>
      </div>`;
    d.querySelector('.body').scrollTop = scroll;
    d.querySelector('.x').onclick = () => { this.closeDrawer(); this.refresh(); };
    d.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
      const [kind, key] = b.dataset.k.split(':');
      c.build = { kind, key };
      this.refresh();
    });
    d.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { c.focus = b.dataset.f; assignAllTiles(); this.refresh(); });
    const un = d.querySelector('#unlock'); if (un) un.onclick = () => { c.locked = []; assignAllTiles(); this.refresh(); };
    const buy = d.querySelector('#buy');
    if (buy) buy.onclick = () => {
      const k = buyCost(c);
      if (cv.gold < k) return;
      cv.gold -= k; c.prod = buildCost(c.build);
      SFX.play('coin');
      notify(G.human, `Du har købt ${buildName(c.build)} i ${c.name}. Den er klar næste tur.`, idx(c.x, c.y), 'good');
      this.refresh();
    };
  },

  // ---------- Dialoger ----------
  modal(title, body, foot, wide) {
    this.closeModal(true);
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true"><header><h2>${title}</h2><button type="button" class="x" aria-label="Luk">×</button></header><div class="body">${body}</div>${foot ? `<div class="foot">${foot}</div>` : ''}</div>`;
    bg.addEventListener('pointerdown', e => { if (e.target === bg) this.closeModal(); });
    bg.querySelector('.x').onclick = () => this.closeModal();
    document.body.appendChild(bg);
    return bg;
  },
  closeModal(silent) {
    const m = document.querySelector('.modal-bg');
    if (!m) return false;
    m.remove();
    if (!silent && this.afterModal) { const f = this.afterModal; this.afterModal = null; f(); }
    return true;
  },

  openTech() {
    const h = human();
    const inc = civIncome(h.id);
    const unlocks = (k) => {
      const out = [];
      for (const u in UNITS) if (UNITS[u].tech === k) out.push(UNITS[u].name);
      for (const b in BUILDINGS) if (BUILDINGS[b].tech === k) out.push(BUILDINGS[b].name);
      for (const w in WONDERS) if (WONDERS[w].tech === k) out.push(WONDERS[w].name);
      for (const p in PROJECTS) if (PROJECTS[p].tech === k) out.push(PROJECTS[p].name);
      for (const im in IMPROVEMENT_TECH) if (IMPROVEMENT_TECH[im] === k) out.push(WORKS[im].name.replace('Byg ', '').replace(/^./, s => s.toUpperCase()));
      if (TECH_NOTES[k]) out.push(TECH_NOTES[k]);
      return out;
    };
    const cols = ERAS.map((era, e) => {
      const ts = Object.keys(TECHS).filter(k => TECHS[k].era === e);
      return `<div class="techcol"><h4>${era}</h4>${ts.map(k => {
        const T = TECHS[k]; const known = h.techs.includes(k); const av = canResearch(h, k); const cur = h.research === k;
        const cost = techCost(h, k);
        const turns = inc.sci > 0 ? Math.max(1, Math.ceil((cost - (cur ? h.sci : Math.min(h.sci, cost))) / inc.sci)) : '∞';
        const cls = known ? 'known' : cur ? 'cur' : av ? 'avail' : 'locked';
        const u = unlocks(k);
        return `<button type="button" class="tech ${cls}" data-t="${k}" ${av ? '' : 'disabled'}>
          <span class="tn">${esc(T.name)}<span>${known ? 'Kendt' : `${turns} t`}</span></span>
          ${cur ? `<span class="bar"><span style="width:${clamp(h.sci / cost * 100, 0, 100)}%"></span></span>` : ''}
          ${u.length ? `<span class="un">${esc(u.join(', '))}</span>` : ''}
          ${!known && !av && T.pre.length ? `<span class="pre">Kræver ${esc(T.pre.map(p => TECHS[p].name).join(' og '))}</span>` : ''}
        </button>`;
      }).join('')}</div>`;
    }).join('');
    const bg = this.modal('Teknologi', `<p>Du forsker <b style="color:var(--sci)">+${fmt(inc.sci)}</b> pr. tur. Vælg et emne, der er markeret med bronze.</p><div class="scroll-x"><div class="techgrid">${cols}</div></div>`, '', true);
    bg.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { h.research = b.dataset.t; this.closeModal(); this.refresh(); });
    requestAnimationFrame(() => this.drawTechLines(bg, h));
  },
  drawTechLines(bg, h) {
    const grid = bg.querySelector('.techgrid'); if (!grid) return;
    const g = grid.getBoundingClientRect();
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'techlines');
    svg.setAttribute('width', grid.scrollWidth); svg.setAttribute('height', grid.scrollHeight);
    const card = {};
    grid.querySelectorAll('[data-t]').forEach(b => { card[b.dataset.t] = b.getBoundingClientRect(); });
    for (const k in TECHS) {
      const b = card[k]; if (!b) continue;
      for (const p of TECHS[k].pre) {
        const a = card[p]; if (!a) continue;
        const same = Math.abs(a.left - b.left) < 5;
        const ay = a.top + a.height / 2 - g.top, by = b.top + b.height / 2 - g.top;
        let d;
        if (same) {
          const ax = a.left - g.left, bx = b.left - g.left;
          d = `M${ax} ${ay} C${ax - 16} ${ay}, ${bx - 16} ${by}, ${bx} ${by}`;
        } else {
          const ax = a.right - g.left, bx = b.left - g.left;
          d = `M${ax} ${ay} C${ax + 18} ${ay}, ${bx - 18} ${by}, ${bx} ${by}`;
        }
        const path = document.createElementNS(NS, 'path');
        path.setAttribute('d', d);
        path.setAttribute('class', h.techs.includes(k) ? 'known' : h.techs.includes(p) ? 'open' : 'locked');
        svg.appendChild(path);
      }
    }
    grid.insertBefore(svg, grid.firstChild);
  },

  openDiplo() {
    const h = human();
    const myP = milPower(h.id);
    const tradeBlock = (c) => {
      if (!this.diploOpen[c.id]) return '';
      if (!canTradeTech(h.id, c.id)) return `<div class="trade"><span class="sub">Ingen teknologihandel så kort tid efter krig.</span></div>`;
      const buy = techsFor(c, h).filter(k => aiWillSell(c, h, k));
      const sell = techsFor(h, c);
      return `<div class="trade">
        <div><span class="label">Køb af ${esc(c.name)}</span><div class="actions-row">${buy.length ? buy.map(k => `<button type="button" class="act" data-buy="${c.id}:${k}" ${h.gold >= techPrice(h, k) ? '' : 'disabled'}>${esc(TECHS[k].name)} · ${techPrice(h, k)} guld</button>`).join('') : '<span class="sub">De vil ikke sælge noget, du kan bruge.</span>'}</div></div>
        <div><span class="label">Sælg til ${esc(c.name)} (de har ${fmt(c.gold)} guld)</span><div class="actions-row">${sell.length ? sell.map(k => `<button type="button" class="act" data-sell="${c.id}:${k}" ${c.gold >= aiBuyPrice(c, k) + 30 ? '' : 'disabled'}>${esc(TECHS[k].name)} · ${aiBuyPrice(c, k)} guld</button>`).join('') : '<span class="sub">De kender allerede det, du kan tilbyde.</span>'}</div></div>
      </div>`;
    };
    const rows = majors().filter(c => c.id !== h.id).map(c => {
      if (!G.met[h.id][c.id]) return `<div class="drow"><i style="background:#3a4250"></i><div><div class="nm">Ukendt folk</div><div class="meta">I har ikke mødt hinanden endnu.</div></div><span></span></div>`;
      if (!c.alive) return `<div class="drow"><i style="background:${c.color};opacity:.4"></i><div><div class="nm" style="text-decoration:line-through">${esc(c.name)}</div><div class="meta">Udslettet</div></div><span></span></div>`;
      const war = atWar(h.id, c.id);
      const ratio = milPower(c.id) / (myP + 1);
      const mil = ratio > 1.4 ? 'langt stærkere end dig' : ratio > 1.1 ? 'stærkere end dig' : ratio > 0.9 ? 'jævnbyrdig' : ratio > 0.6 ? 'svagere end dig' : 'langt svagere end dig';
      const since = G.turn - G.warSince[h.id][c.id];
      const btn = war ? `<button type="button" class="act" data-p="${c.id}">Tilbyd fred</button>` : `<button type="button" class="act danger" data-w="${c.id}" ${since < 10 && G.warSince[h.id][c.id] ? 'disabled title="Fredsaftalen er for ny"' : ''}>Erklær krig</button>`;
      return `<div class="drow"><i style="background:${c.color}"></i><div><div class="nm">${esc(c.name)}<span class="status ${war ? 'war' : 'peace'}">${war ? 'Krig' : 'Fred'}</span></div>
        <div class="meta">${civCities(c.id).length} byer · militært ${mil} · ${score(c.id)} point · ${c.techs.length} teknologier</div></div>
        <div class="btns">${war ? '' : `<button type="button" class="act" data-trade="${c.id}">${this.diploOpen[c.id] ? 'Skjul handel' : 'Handel'}</button>`}${btn}</div></div>${tradeBlock(c)}`;
    }).join('');
    const minors = G.civs.filter(m => m.minor);
    const mrows = minors.map(m => {
      if (!G.met[h.id][m.id]) return `<div class="drow"><i style="background:#3a4250"></i><div><div class="nm">Ukendt bystat</div><div class="meta">Udforsk verden for at finde den.</div></div><span></span></div>`;
      if (!m.alive) return `<div class="drow"><i style="background:${m.color};opacity:.4"></i><div><div class="nm" style="text-decoration:line-through">${esc(m.name)}</div><div class="meta">Erobret</div></div><span></span></div>`;
      const inf = m.inf[h.id] || 0;
      const war = atWar(h.id, m.id);
      const st = minorStatus(m, h.id);
      const allyName = m.ally != null ? civ(m.ally).name : 'ingen';
      return `<div class="drow minor"><i style="background:${m.color}"></i><div><div class="nm">${esc(m.name)} <span class="chip">${MINOR_TYPES[m.mtype].name}</span><span class="status ${war ? 'war' : st === 'Allieret' || st === 'Venner' ? 'peace' : 'neutral'}">${st}</span></div>
        <div class="meta">${esc(MINOR_TYPES[m.mtype].bonus)} · allieret med: ${esc(allyName)}</div>
        <div class="infbar"><span style="width:${clamp(inf, 0, 100)}%"></span><em style="left:30%"></em><em style="left:60%"></em></div><div class="meta">Din indflydelse: ${inf} (venner ved 30, allieret ved 60)</div></div>
        <div class="btns">${war ? `<button type="button" class="act" data-p="${m.id}">Tilbyd fred</button>` : [50, 100, 250].map(g => `<button type="button" class="act" data-gift="${m.id}:${g}" ${h.gold >= g ? '' : 'disabled'}>Giv ${g}</button>`).join('') + `<button type="button" class="act danger" data-w="${m.id}">Erklær krig</button>`}</div></div>`;
    }).join('');
    const gp = `Næste store personlighed: ${Math.floor(h.gpp)}/${h.gpNext} point`;
    const bg = this.modal('Diplomati', `<p>Dit rige: ${civCities(h.id).length} byer, ${score(h.id)} point. Guld ${fmt(h.gold)} (${civIncome(h.id).gold >= 0 ? '+' : ''}${fmt(civIncome(h.id).gold)} pr. tur, heraf ${upkeep(h.id)} i vedligehold). ${gp}.</p>
      <div class="diplo">${rows}</div>
      ${minors.length ? `<div class="section-h">Bystater</div><div class="diplo">${mrows}</div>` : ''}
      <div class="section-h">Seneste begivenheder</div><div class="log">${G.log.slice(-40).reverse().map(e => `<div class="${e.kind}"><em>Tur ${e.turn}</em>${esc(e.text)}</div>`).join('') || '<div>Intet endnu.</div>'}</div>`, '', true);
    const reopen = () => { const sc = bg.querySelector('.body').scrollTop; this.openDiplo(); const nb = document.querySelector('.modal-bg .body'); if (nb) nb.scrollTop = sc; this.refresh(); };
    bg.querySelectorAll('[data-trade]').forEach(b => b.onclick = () => { const id = +b.dataset.trade; this.diploOpen[id] = !this.diploOpen[id]; reopen(); });
    bg.querySelectorAll('[data-w]').forEach(b => b.onclick = () => {
      const id = +b.dataset.w;
      if (b.dataset.sure) { declareWar(h.id, id); reopen(); return; }
      b.dataset.sure = '1'; b.textContent = 'Bekræft krig';
    });
    bg.querySelectorAll('[data-p]').forEach(b => b.onclick = () => {
      const id = +b.dataset.p;
      if (aiAcceptPeace(civ(id), h.id)) { makePeace(h.id, id); reopen(); }
      else { b.disabled = true; b.textContent = `${civ(id).name} afviser`; }
    });
    bg.querySelectorAll('[data-gift]').forEach(b => b.onclick = () => {
      const [id, g] = b.dataset.gift.split(':').map(Number);
      const add = giftMinor(h, civ(id), g);
      if (add) { SFX.play('coin'); notify(h.id, `${civ(id).name} takker for gaven (+${add} indflydelse).`, null, 'good'); }
      reopen();
    });
    bg.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => {
      const [id, k] = b.dataset.buy.split(':');
      const price = buyTechFromAi(h, civ(+id), k);
      if (price) { SFX.play('tech'); notify(h.id, `Du har købt ${TECHS[k].name} af ${civ(+id).name} for ${price} guld.`, null, 'good'); }
      reopen();
    });
    bg.querySelectorAll('[data-sell]').forEach(b => b.onclick = () => {
      const [id, k] = b.dataset.sell.split(':');
      const price = sellTechToAi(h, civ(+id), k);
      if (price) { SFX.play('coin'); notify(h.id, `Du har solgt ${TECHS[k].name} til ${civ(+id).name} for ${price} guld.`, null, 'good'); }
      reopen();
    });
  },

  // Returnerer true hvis et tilbud blev vist
  showOffer(o) {
    const c = civ(o.from);
    const h = human();
    if (!c.alive) return false;
    let title, text, yes;
    if (o.type === 'peace') {
      if (!atWar(G.human, c.id)) return false;
      title = 'Fredstilbud'; text = `<b style="color:${c.color}">${esc(c.name)}</b> tilbyder at stoppe krigen og slutte fred.`;
      yes = { label: 'Accepter fred', go: () => makePeace(G.human, c.id) };
    } else if (o.type === 'sellTech') {
      if (h.techs.includes(o.tech) || !canTradeTech(h.id, c.id)) return false;
      title = 'Handelstilbud'; text = `<b style="color:${c.color}">${esc(c.name)}</b> tilbyder at sælge dig <b>${esc(TECHS[o.tech].name)}</b> for ${o.price} guld. Du har ${fmt(h.gold)} guld.`;
      if (h.gold < o.price) text += ' Du har ikke råd lige nu.';
      yes = h.gold >= o.price ? { label: `Køb for ${o.price} guld`, go: () => { h.gold -= o.price; c.gold += o.price; h.techs.push(o.tech); if (h.research === o.tech) h.research = null; SFX.play('tech'); notify(h.id, `Du har købt ${TECHS[o.tech].name}.`, null, 'good'); } } : null;
    } else if (o.type === 'buyTech') {
      if (c.techs.includes(o.tech) || !canTradeTech(h.id, c.id) || c.gold < o.price) return false;
      title = 'Handelstilbud'; text = `<b style="color:${c.color}">${esc(c.name)}</b> vil købe <b>${esc(TECHS[o.tech].name)}</b> af dig for ${o.price} guld.`;
      yes = { label: `Sælg for ${o.price} guld`, go: () => { sellTechToAi(h, c, o.tech); SFX.play('coin'); } };
    } else return false;
    const bg = this.modal(title, `<p>${text}</p>`,
      `<button type="button" class="act" id="o-no">Afvis</button>${yes ? `<button type="button" class="act primary" id="o-yes">${esc(yes.label)}</button>` : ''}`);
    this.afterModal = () => this.nextOffer();
    const yb = bg.querySelector('#o-yes');
    if (yb) yb.onclick = () => { yes.go(); this.closeModal(); this.refresh(); };
    bg.querySelector('#o-no').onclick = () => { if (o.type === 'peace') G.warSince[G.human][c.id] = G.turn; this.closeModal(); };
    return true;
  },

  openMenu() {
    const bg = this.modal('Menu', `<div class="toggles">
        <label for="snd"><input type="checkbox" id="snd" ${SFX.sound ? 'checked' : ''}> Lydeffekter</label>
        <label for="mus"><input type="checkbox" id="mus" ${SFX.music ? 'checked' : ''}> Musik</label>
        <label for="gd"><input type="checkbox" id="gd" ${G.tutorial && G.tutorial.on ? 'checked' : ''}> Vis guide</label>
      </div>
      <dl class="help">
      <dt>Flyt og angrib</dt><dd>Vælg en enhed, og klik på et felt. Højreklik virker også. Røde felter kan angribes. Med Sejlads kan landenheder gå ud på kystfelter og sejle.</dd>
      <dt>Kort</dt><dd>Kortet går rundt som en globus. Træk for at panorere, rul eller knib for at zoome, piletaster flytter kortet.</dd>
      <dt>Byer</dt><dd>Åbn en by for at vælge produktion og fokus. Klik på felterne omkring byen for at låse, hvor indbyggerne arbejder. Utilfredse indbyggere arbejder ikke.</dd>
      <dt>Taster</dt><dd>Enter afslut tur · N næste enhed · Mellemrum spring over · F befæst · B grundlæg by · I farm · M mine · R vej · C ryd skov · A automatisér · H til nærmeste by · U opgradér · G brug stor personlighed · E handelsrute · T teknologi · D diplomati</dd>
      <dt>Sejr</dt><dd>Udslet alle andre stormagter, eller forsk dig frem til Rumfart og byg rumskibet. Efter tur 400 vinder højeste pointtal.</dd>
      <dt>Gemning</dt><dd>Spillet gemmes automatisk i denne browser efter hver tur.</dd>
    </dl>`, `<button type="button" class="act" id="m-new">Nyt spil</button><button type="button" class="act" id="m-save">Gem nu</button><button type="button" class="act primary" id="m-close">Fortsæt</button>`);
    bg.querySelector('#snd').onchange = (e) => SFX.setSound(e.target.checked);
    bg.querySelector('#mus').onchange = (e) => SFX.setMusic(e.target.checked);
    bg.querySelector('#gd').onchange = (e) => { if (!G.tutorial) G.tutorial = { on: false, step: 0 }; G.tutorial.on = e.target.checked; this.renderGuide(); };
    bg.querySelector('#m-close').onclick = () => this.closeModal();
    bg.querySelector('#m-save').onclick = (e) => { e.target.textContent = saveGame() ? 'Gemt' : 'Kunne ikke gemme'; };
    const nb = bg.querySelector('#m-new');
    nb.onclick = () => {
      if (!nb.dataset.sure) { nb.dataset.sure = '1'; nb.textContent = 'Bekræft: nyt spil'; return; }
      location.reload();
    };
  },

  showGameOver() {
    const o = G.over; const h = human();
    let title, text;
    if (o.how === 'tab') { title = 'Dit rige er faldet'; text = `${h.name} er ikke mere. Historien vil huske jer.`; }
    else if (o.winner === h.id) {
      title = 'Sejr!';
      text = o.how === 'rum' ? `Dit rumskib er på vej mod Alpha Centauri. ${h.name} har vundet kapløbet om stjernerne i ${yearLabel(G.turn)}.`
        : o.how === 'erobring' ? `Alle rivaler er besejret. ${h.name} hersker over hele verden fra ${yearLabel(G.turn)}.`
        : `Tiden er gået, og ${h.name} har flest point (${score(h.id)}).`;
    } else {
      title = 'Nederlag';
      text = o.how === 'rum' ? `${civ(o.winner).name} sendte det første rumskib af sted.` : `${civ(o.winner).name} sluttede med flest point.`;
    }
    const bg = this.modal(title, `<p>${esc(text)}</p><p>Dine point: <b>${score(h.id)}</b> · Tur ${G.turn}</p>`,
      `<button type="button" class="act" id="g-look">Se kortet</button><button type="button" class="act primary" id="g-new">Nyt spil</button>`);
    bg.querySelector('#g-new').onclick = () => { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ingen lager */ } location.reload(); };
    bg.querySelector('#g-look').onclick = () => { G.explored.fill(1); updateVisibility(); this.closeModal(); this.dirty(); };
  },
};

window.addEventListener('DOMContentLoaded', () => UI.init());
