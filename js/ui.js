// Tegning af kortet, input og alle paneler.
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

function neighborDir(x, y, d) {
  const o = ((y & 1) ? NB_ODD : NB_EVEN)[d];
  const nx = x + o[0], ny = y + o[1];
  return inb(nx, ny) ? idx(nx, ny) : -1;
}
function center(x, y) { return [S * SQ3 * (x + 0.5 * (y & 1)) + S * SQ3 / 2, S * 1.5 * y + S]; }
function centerI(i) { const [x, y] = xy(i); return center(x, y); }
function worldToTile(wx, wy) {
  const px = wx - S * SQ3 / 2, py = wy - S;
  const q = (SQ3 / 3 * px - py / 3) / S, r = (2 / 3 * py) / S;
  let cx = q, cz = r, cy = -cx - cz;
  let rx = Math.round(cx), ry = Math.round(cy), rz = Math.round(cz);
  const dx = Math.abs(rx - cx), dy = Math.abs(ry - cy), dz = Math.abs(rz - cz);
  if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry;
  const row = rz, col = rx + (row - (row & 1)) / 2;
  return inb(col, row) ? idx(col, row) : -1;
}

const UI = {
  sel: null, hover: -1, cam: { x: 0, y: 0, z: 1 }, dpr: 1, w: 0, h: 0,
  reach: null, pathPreview: null, raf: 0, busy: false, drawer: null, skip: new Set(), confirmDisband: false,

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
    $('#btn-diplo').onclick = () => this.openDiplo();
    $('#btn-menu').onclick = () => this.openMenu();
    $('#endturn').onclick = () => this.onEndTurn();
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
      const opts = { civ: chosen, opponents: +$('#opt-opp').value, size: $('#opt-size').value, difficulty: $('#opt-diff').value };
      newGame(opts);
      this.enterGame();
      notify(G.human, `Velkommen, hersker over ${human().name}. Grundlæg din første by med bosætteren (tast B).`, null, 'good');
    };
    $('#btn-continue').onclick = () => { if (loadGame()) this.enterGame(); };
    // baggrundskort til startskærmen
    newGame({ civ: 'dk', opponents: 3, size: 'medium', difficulty: 'normal' });
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
  ensureVisible(i) {
    const [cx, cy] = centerI(i);
    const sx = (cx - this.cam.x) * this.cam.z, sy = (cy - this.cam.y) * this.cam.z;
    if (sx < 80 || sy < 90 || sx > this.w - 80 || sy > this.h - 160) this.centerOn(i);
  },
  clampCam() {
    const ww = S * SQ3 * (G.w + 1), wh = S * 1.5 * (G.h + 1);
    const vw = this.w / this.cam.z, vh = this.h / this.cam.z;
    this.cam.x = vw > ww ? (ww - vw) / 2 : clamp(this.cam.x, -vw * 0.3, ww - vw * 0.7);
    this.cam.y = vh > wh ? (wh - vh) / 2 : clamp(this.cam.y, -vh * 0.3, wh - vh * 0.7);
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
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        this.zoomAt((pinch.z * d / pinch.d) / this.cam.z, mx, my);
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
      if (e.pointerType === 'mouse') this.onHover(this.screenToTile(e.clientX, e.clientY), e.clientX, e.clientY);
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
      const wx = fx * S * SQ3 * (G.w + 0.5), wy = fy * S * 1.5 * (G.h + 0.33);
      this.cam.x = wx - this.w / 2 / this.cam.z; this.cam.y = wy - this.h / 2 / this.cam.z;
      this.clampCam(); this.dirty();
    };
    mm.addEventListener('pointerdown', e => { mdown = true; mm.setPointerCapture(e.pointerId); mmGo(e); });
    mm.addEventListener('pointermove', e => { if (mdown) mmGo(e); });
    mm.addEventListener('pointerup', () => { mdown = false; });
  },

  bindKeys() {
    window.addEventListener('keydown', e => {
      if (this.preview || !G || this.busy) return;
      if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;
      const k = e.key;
      if (k === 'Escape') {
        if (this.closeModal() || this.closeDrawer()) return;
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
      const map = { ' ': 'skip', f: 'fort', F: 'fort', b: 'found', B: 'found', i: 'farm', I: 'farm', m: 'mine', M: 'mine', r: 'road', R: 'road', c: 'chop', C: 'chop', a: 'auto', A: 'auto', Delete: 'disband', Backspace: 'disband', h: 'home', H: 'home' };
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
        if (p && p.length) { this.pathPreview = { path: p, turns: pathTurns(u, p) }; }
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
      <div>Forventet: fjende −${Math.min(100, pv.expD)} liv${pv.ranged ? '' : `, du −${Math.min(100, pv.expA)}`}</div>
      <div class="odds" style="color:${verdict[1]}">${verdict[0]}</div>`;
  },
  tileTip(i) {
    const t = G.tiles[i]; const T = TERRAIN[t.t];
    const y = tileYield(i, null);
    const parts = [`<b>${T.name}</b>${t.res ? ` · ${RESOURCES[t.res].name}` : ''}`];
    if (!T.water || true) parts.push(`<span style="color:var(--food)">${y.f} mad</span> · <span style="color:var(--prod)">${y.p} prod.</span> · <span style="color:var(--gold)">${y.t} handel</span>`);
    const imp = [t.imp === 'farm' ? 'Farm' : t.imp === 'mine' ? 'Mine' : null, t.road ? 'Vej' : null].filter(Boolean);
    if (imp.length) parts.push(imp.join(', '));
    if (t.owner >= 0) parts.push(`<span style="color:${civ(t.owner).color}">●</span> ${esc(civ(t.owner).name)}`);
    if (TERRAIN[t.t].def) parts.push(`Forsvar +${TERRAIN[t.t].def * 100} %`);
    if (TERRAIN[t.t].move > 1 && TERRAIN[t.t].move < 99) parts.push(`Bevægelse koster ${TERRAIN[t.t].move}`);
    if (t.t === 'mountain') parts.push('Ufremkommeligt');
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
        attack(u, i); this.hideTip(); this.afterAction(u); return;
      }
      if (!G.explored[i]) return;
      const p = findPath(u, i);
      if (p && p.length) {
        u.path = p; u.fort = false; u.sleep = false; u.work = null; u.auto = false;
        followPath(u);
        this.afterAction(u);
      } else if (enemyTarget(u, i) && UNITS[u.type].str > 0) {
        notify(G.human, 'Målet er uden for rækkevidde. Gå tættere på for at angribe.', null, 'warn');
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
    if (u.moves <= 0 || u.work || u.fort) { this.selectNext(); }
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
    if (!w.length) { if (!silent) { this.sel = null; } this.refresh(); return; }
    const cur = this.selUnit();
    let k = cur ? w.indexOf(cur) : -1;
    const next = w[(k + 1) % w.length] === cur && w.length > 1 ? w[(k + 2) % w.length] : w[(k + 1) % w.length];
    this.select(next);
  },

  doAction(a) {
    const u = this.selUnit(); if (!u) return;
    if (a === 'skip') { this.skip.add(u.id); this.selectNext(); return; }
    if (a === 'fort') { if (!isMil(u)) { u.sleep = true; } else u.fort = true; u.path = null; this.selectNext(); return; }
    if (a === 'cancel') { u.path = null; u.auto = false; u.work = null; u.fort = false; u.sleep = false; this.select(u); return; }
    if (a === 'found') { if (canFoundCity(u)) { const c = foundCity(u); this.sel = null; this.refresh(); this.openCity(c); } else notify(G.human, 'Her kan du ikke grundlægge en by. Den skal ligge mindst 3 felter fra andre byer og ikke på fremmed land.', null, 'warn'); return; }
    if (['farm', 'mine', 'road', 'chop'].includes(a)) { if (canWork(u, a)) { startWork(u, a); this.selectNext(); } return; }
    if (a === 'auto') { if (u.type === 'worker') { u.auto = true; aiWorker(u); this.selectNext(); } return; }
    if (a === 'home') {
      const c = civCities(G.human).sort((p, q) => dist(p.x, p.y, u.x, u.y) - dist(q.x, q.y, u.x, u.y))[0];
      if (c) { const p = findPath(u, idx(c.x, c.y)); if (p) { u.path = p; followPath(u); this.afterAction(u); } }
      return;
    }
    if (a === 'disband') {
      if (!this.confirmDisband) { this.confirmDisband = true; this.renderPanel(); return; }
      killUnit(u); this.confirmDisband = false; this.sel = null; this.selectNext(); return;
    }
  },

  async onEndTurn() {
    if (this.busy || G.over) return;
    this.closeDrawer();
    const h = human();
    const blocker = this.blocker();
    if (blocker) { blocker.go(); return; }
    this.busy = true; $('#busy').hidden = false;
    this.sel = null; this.reach = null; this.pathPreview = null; this.hideTip();
    await new Promise(r => setTimeout(r, 30));
    try { endTurn(); } catch (err) { console.error(err); }
    this.skip = new Set();
    this.busy = false; $('#busy').hidden = true;
    saveGame();
    void h;
    if (G.over) { this.refresh(); this.showGameOver(); return; }
    this.selectNext(true);
    this.refresh();
    if (G.offers && G.offers.length) this.showOffer(G.offers.shift());
  },
  blocker() {
    const h = human();
    if (!h.research && Object.keys(TECHS).some(k => canResearch(h, k))) return { label: 'Vælg forskning', go: () => this.openTech() };
    const idle = civCities(G.human).find(c => !c.build);
    if (idle) return { label: 'Vælg produktion', go: () => { this.centerOn(idx(idle.x, idle.y)); this.openCity(idle); } };
    return null;
  },

  // ---------- Opdatering ----------
  refresh() { this.renderHUD(); this.renderPanel(); this.dirty(); if (this.drawer) this.renderDrawer(); },
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
    $('#stat-year').innerHTML = `<b>${yearLabel(G.turn)}</b><span class="k">Tur ${G.turn}</span>`;
    const b = this.blocker();
    const et = $('#endturn');
    et.textContent = b ? b.label : 'Afslut tur';
    et.classList.toggle('blocker', !!b);
    const w = this.waitingUnits().length;
    $('#waiting').innerHTML = w ? `${w} ${w === 1 ? 'enhed venter' : 'enheder venter'} · <button type="button" id="btn-next">Næste</button>` : '';
    const bn = $('#btn-next'); if (bn) bn.onclick = () => this.selectNext();
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
        : u.fort ? 'Befæstet' : u.sleep ? 'Sover' : u.auto ? 'Automatiseret' : u.path ? `På vej · ${pathTurns(u, u.path)} ture` : '';
      let acts = [];
      const A = (key, label, kbd, enabled = true, cls = '') => `<button type="button" class="act ${cls}" data-a="${key}" ${enabled ? '' : 'disabled'}>${label}${kbd ? ` <kbd>${kbd}</kbd>` : ''}</button>`;
      if (own) {
        if (u.type === 'settler') acts.push(A('found', 'Grundlæg by', 'B', canFoundCity(u), 'primary'));
        if (u.type === 'worker') {
          for (const [k, kb] of [['farm', 'I'], ['mine', 'M'], ['road', 'R'], ['chop', 'C']]) {
            if (hasTech(human(), IMPROVEMENT_TECH[k])) acts.push(A(k, WORKS[k].name, kb, canWork(u, k) && !u.work));
          }
          acts.push(A('auto', 'Automatisér', 'A', !u.auto));
        }
        if (isMil(u)) acts.push(A('fort', 'Befæst', 'F', !u.fort));
        else if (u.type !== 'worker' || true) acts.push(A('fort', 'Sov', 'F', !u.sleep));
        acts.push(A('skip', 'Spring over', 'Mellemrum', u.moves > 0));
        if (u.path || u.auto || u.work || u.fort || u.sleep) acts.push(A('cancel', 'Ny ordre', ''));
        acts.push(A('home', 'Til nærmeste by', 'H', u.moves > 0));
        acts.push(A('disband', this.confirmDisband ? 'Bekræft opløsning' : 'Opløs', '', true, 'danger'));
      }
      const stackUnits = unitsAt(idx(u.x, u.y)).filter(v => v.civ === u.civ);
      const stack = stackUnits.length > 1 ? `<div class="stack">${stackUnits.map(v => `<button type="button" title="${esc(UNITS[v.type].name)}" data-u="${v.id}" class="${v === u ? 'on' : ''}">${UNITS[v.type].glyph}</button>`).join('')}</div>` : '';
      const hpc = u.hp > 60 ? 'var(--good)' : u.hp > 30 ? 'var(--warn)' : 'var(--bad)';
      p.innerHTML = `<h3><span class="glyph">${T.glyph}</span>${esc(T.name)}${u.vet ? ' <span class="chip w">Veteran</span>' : ''}</h3>
        <div class="sub">${own ? '' : esc(cv.name) + ' · '}${status || (T.desc ? esc(T.desc) : TERRAIN[G.tiles[idx(u.x, u.y)].t].name)}</div>
        <div class="kv">${T.str ? `<div><span>Styrke</span> <b>${T.str}</b></div>` : ''}${T.ranged ? `<div><span>Afstand</span> <b>${T.ranged}</b> <span>(${T.range} felter)</span></div>` : ''}
        <div><span>Bevægelse</span> <b>${fmt(u.moves)}/${T.moves}</b></div><div><span>Liv</span> <b>${u.hp}</b></div></div>
        <div class="hpbar"><span style="width:${u.hp}%;background:${hpc}"></span></div>
        ${stack}
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
        p.innerHTML = `<h3><span style="color:${cv.color}">●</span>${esc(c.name)}</h3><div class="sub">${esc(cv.name)}${c.capital ? ' · hovedstad' : ''}</div>
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
  },

  // ---------- Tegning ----------
  draw() {
    if (!G) return;
    const ctx = this.ctx, z = this.cam.z, dpr = this.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#080b10';
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.setTransform(dpr * z, 0, 0, dpr * z, -this.cam.x * dpr * z, -this.cam.y * dpr * z);
    const x0 = this.cam.x, y0 = this.cam.y, x1 = x0 + this.w / z, y1 = y0 + this.h / z;
    const r0 = Math.max(0, Math.floor((y0 - S) / (1.5 * S)) - 1), r1 = Math.min(G.h - 1, Math.ceil((y1) / (1.5 * S)) + 1);
    const c0 = Math.max(0, Math.floor(x0 / (S * SQ3)) - 1), c1 = Math.min(G.w - 1, Math.ceil(x1 / (S * SQ3)) + 1);
    const vis = [];
    for (let y = r0; y <= r1; y++) for (let x = c0; x <= c1; x++) { const i = idx(x, y); if (G.explored[i]) vis.push(i); }
    const detail = z > 0.55;
    // terræn
    for (const i of vis) this.drawTile(i, detail);
    // veje
    if (detail) for (const i of vis) this.drawRoads(i);
    // ressourcer og forbedringer
    if (detail) for (const i of vis) this.drawExtras(i);
    // territorier
    for (const i of vis) this.drawBorders(i);
    // tåge
    ctx.fillStyle = 'rgba(6,8,12,0.5)';
    for (const i of vis) if (!VIS[i]) { const [cx, cy] = centerI(i); this.hexPath(cx, cy, S + 0.6); ctx.fill(); }
    // kant af det udforskede
    // valg og rækkevidde
    const u = this.selUnit();
    if (u && this.reach) {
      ctx.fillStyle = 'rgba(234,208,151,0.13)';
      for (const i of this.reach) { const [cx, cy] = centerI(i); this.hexPath(cx, cy, S * 0.92); ctx.fill(); }
    }
    if (u && u.moves > 0 && isMil(u)) {
      const T = UNITS[u.type];
      ctx.strokeStyle = 'rgba(228,108,96,0.95)'; ctx.lineWidth = 3;
      for (const j of tilesInRadius(u.x, u.y, T.ranged ? T.range : 1)) {
        if (VIS[j] && canAttack(u, j)) { const [cx, cy] = centerI(j); this.hexPath(cx, cy, S * 0.86); ctx.stroke(); }
      }
    }
    if (this.sel) {
      const si = this.sel.unit != null ? (unitById(this.sel.unit) ? idx(unitById(this.sel.unit).x, unitById(this.sel.unit).y) : -1) : this.sel.tile;
      if (si >= 0) { const [cx, cy] = centerI(si); ctx.strokeStyle = '#ead097'; ctx.lineWidth = 3; this.hexPath(cx, cy, S * 0.94); ctx.stroke(); }
    }
    if (this.hover >= 0 && G.explored[this.hover] && !this.busy) {
      const [cx, cy] = centerI(this.hover); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; this.hexPath(cx, cy, S * 0.96); ctx.stroke();
    }
    // byer
    for (const c of G.cities) { const i = idx(c.x, c.y); if (G.explored[i] && i >= 0) this.drawCity(c); }
    // enheder
    const drawn = new Set();
    for (const v of G.units) {
      const i = idx(v.x, v.y);
      if (!VIS[i] || drawn.has(i)) continue;
      if (i < 0) continue;
      drawn.add(i);
      this.drawStack(i);
    }
    // gå-sti
    if (u && (this.pathPreview || u.path)) this.drawPath(u, this.pathPreview ? this.pathPreview.path : u.path, this.pathPreview ? this.pathPreview.turns : null);
    // bynavne øverst
    for (const c of G.cities) if (G.explored[idx(c.x, c.y)]) this.drawCityLabel(c);
  },

  hexPath(cx, cy, s) {
    const ctx = this.ctx; ctx.beginPath();
    for (let k = 0; k < 6; k++) { const px = cx + CORN[k][0] * s, py = cy + CORN[k][1] * s; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.closePath();
  },

  drawTile(i, detail) {
    const ctx = this.ctx; const t = G.tiles[i]; const T = TERRAIN[t.t];
    const [cx, cy] = centerI(i);
    this.hexPath(cx, cy, S + 0.6);
    ctx.fillStyle = T.color; ctx.fill();
    if (!detail) return;
    const r = mulberry32(t.deco + i);
    ctx.save();
    if (t.t === 'forest' || t.t === 'jungle') {
      ctx.fillStyle = t.t === 'forest' ? '#2d5326' : '#1f4720';
      for (let k = 0; k < 5; k++) {
        const ox = (r() - 0.5) * S * 1.1, oy = (r() - 0.5) * S * 0.9, s = S * (0.22 + r() * 0.08);
        ctx.beginPath(); ctx.moveTo(cx + ox, cy + oy - s * 1.3); ctx.lineTo(cx + ox + s * 0.75, cy + oy + s * 0.6); ctx.lineTo(cx + ox - s * 0.75, cy + oy + s * 0.6); ctx.closePath(); ctx.fill();
      }
    } else if (t.t === 'hills') {
      ctx.strokeStyle = 'rgba(70,52,28,0.55)'; ctx.lineWidth = 2.2;
      for (let k = 0; k < 2; k++) {
        const ox = (k ? 0.28 : -0.25) * S, oy = (k ? 0.12 : -0.1) * S;
        ctx.beginPath(); ctx.arc(cx + ox, cy + oy + S * 0.18, S * 0.32, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      }
    } else if (t.t === 'mountain') {
      for (let k = 0; k < 2; k++) {
        const ox = (k ? 0.3 : -0.18) * S, s = S * (k ? 0.45 : 0.62);
        ctx.fillStyle = k ? '#625c57' : '#56504b';
        ctx.beginPath(); ctx.moveTo(cx + ox, cy - s * 0.85); ctx.lineTo(cx + ox + s * 0.8, cy + s * 0.55); ctx.lineTo(cx + ox - s * 0.8, cy + s * 0.55); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e8ecef';
        ctx.beginPath(); ctx.moveTo(cx + ox, cy - s * 0.85); ctx.lineTo(cx + ox + s * 0.27, cy - s * 0.4); ctx.lineTo(cx + ox - s * 0.27, cy - s * 0.4); ctx.closePath(); ctx.fill();
      }
    } else if (t.t === 'desert') {
      ctx.fillStyle = 'rgba(160,128,60,0.45)';
      for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.arc(cx + (r() - 0.5) * S * 1.2, cy + (r() - 0.5) * S, 1.3, 0, 7); ctx.fill(); }
    } else if (t.t === 'ocean' || t.t === 'coast') {
      ctx.strokeStyle = t.t === 'ocean' ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1.4;
      for (let k = 0; k < 2; k++) {
        const ox = (r() - 0.5) * S, oy = (r() - 0.5) * S * 0.8;
        ctx.beginPath(); ctx.moveTo(cx + ox - 7, cy + oy); ctx.quadraticCurveTo(cx + ox - 3.5, cy + oy - 3, cx + ox, cy + oy); ctx.quadraticCurveTo(cx + ox + 3.5, cy + oy + 3, cx + ox + 7, cy + oy); ctx.stroke();
      }
    } else if (t.t === 'grass' || t.t === 'plains') {
      ctx.strokeStyle = t.t === 'grass' ? 'rgba(40,80,20,0.35)' : 'rgba(110,100,30,0.35)'; ctx.lineWidth = 1.2;
      for (let k = 0; k < 3; k++) {
        const ox = (r() - 0.5) * S * 1.1, oy = (r() - 0.5) * S * 0.9;
        ctx.beginPath(); ctx.moveTo(cx + ox - 2, cy + oy); ctx.lineTo(cx + ox, cy + oy - 4); ctx.lineTo(cx + ox + 2, cy + oy); ctx.stroke();
      }
    } else if (t.t === 'tundra') {
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.ellipse(cx + (r() - 0.5) * S, cy + (r() - 0.5) * S * 0.8, 4, 1.6, 0, 0, 7); ctx.fill(); }
    }
    ctx.restore();
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
        const [nx, ny] = centerI(j);
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo((cx + nx) / 2, (cy + ny) / 2); ctx.stroke(); any = true;
      }
    }
    if (!any && !isC) { ctx.fillStyle = '#6e5232'; ctx.beginPath(); ctx.arc(cx, cy, 3, 0, 7); ctx.fill(); }
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
    if (t.res && !cityAt(i)) {
      ctx.font = `${S * 0.44}px ${EMOJI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.arc(cx + S * 0.38, cy - S * 0.36, S * 0.27, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText(RESOURCES[t.res].glyph, cx + S * 0.38, cy - S * 0.34);
    }
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

  drawCity(c) {
    const ctx = this.ctx; const [cx, cy] = center(c.x, c.y);
    const col = civ(c.civ).color;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; this.hexPath(cx, cy + 2, S * 0.78); ctx.fill();
    ctx.fillStyle = col; this.hexPath(cx, cy, S * 0.74); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.5; ctx.stroke();
    if (cityHasWalls(c)) { ctx.strokeStyle = '#d8d0bf'; ctx.lineWidth = 3; this.hexPath(cx, cy, S * 0.8); ctx.stroke(); }
    // huse
    const houses = Math.min(5, 2 + Math.floor(c.pop / 3));
    const spots = [[-9, 3], [8, 4], [0, -6], [-14, -6], [14, -5]];
    for (let k = 0; k < houses; k++) {
      const [hx, hy] = spots[k]; const w = 9, h = 7;
      ctx.fillStyle = '#efe6d2'; ctx.fillRect(cx + hx - w / 2, cy + hy - h / 2, w, h);
      ctx.fillStyle = '#7b3f2a'; ctx.beginPath(); ctx.moveTo(cx + hx - w / 2 - 1.5, cy + hy - h / 2); ctx.lineTo(cx + hx, cy + hy - h / 2 - 6); ctx.lineTo(cx + hx + w / 2 + 1.5, cy + hy - h / 2); ctx.closePath(); ctx.fill();
    }
    if (c.hp < 100) {
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(cx - 18, cy + S * 0.55, 36, 5);
      ctx.fillStyle = c.hp > 50 ? '#7cc47f' : c.hp > 25 ? '#e8b64e' : '#e46c60'; ctx.fillRect(cx - 18, cy + S * 0.55, 36 * c.hp / 100, 5);
    }
  },

  drawCityLabel(c) {
    const ctx = this.ctx; const [cx, cy] = center(c.x, c.y);
    const z = this.cam.z;
    const fs = clamp(12.5 / z, 9, 24);
    ctx.font = `700 ${fs}px "Alegreya Sans", sans-serif`;
    const own = c.civ === G.human;
    const name = (c.capital ? '★ ' : '') + c.name;
    const tw = ctx.measureText(name).width;
    const pad = fs * 0.45, bh = fs * 1.5, popW = fs * 1.6;
    const total = popW + tw + pad * 2;
    const lx = cx - total / 2, ly = cy - S * 0.98 - bh;
    ctx.fillStyle = 'rgba(12,15,21,0.9)';
    this.roundRect(lx, ly, total, bh, bh / 2); ctx.fill();
    ctx.fillStyle = civ(c.civ).color; this.roundRect(lx, ly, popW, bh, bh / 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
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

  drawStack(i) {
    const us = unitsAt(i);
    if (!us.length) return;
    const ctx = this.ctx; let [cx, cy] = centerI(i);
    const city = cityAt(i);
    // vis bedste forsvarer, valgt enhed foretrækkes
    const sel = this.selUnit();
    let u = us.includes(sel) ? sel : (us.filter(isMil).sort((a, b) => UNITS[b.type].str - UNITS[a.type].str)[0] || us[0]);
    const r = city ? S * 0.33 : S * 0.43;
    if (city) { cx -= S * 0.42; cy += S * 0.3; }
    const col = civ(u.civ).color;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(cx, cy + 2.5, r, 0, 7); ctx.fill();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
    ctx.lineWidth = u.fort ? 3.2 : 2; ctx.strokeStyle = u.fort ? '#d8d0bf' : 'rgba(255,255,255,0.85)'; ctx.stroke();
    if (u.civ === G.human && this.needsOrders(u) && u !== sel) { ctx.strokeStyle = '#ead097'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, r + 3.5, 0, 7); ctx.stroke(); }
    ctx.font = `${r * 1.15}px ${EMOJI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
    ctx.fillText(UNITS[u.type].glyph, cx, cy + 1);
    if (u.hp < 100) {
      ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(cx - r, cy + r + 2, r * 2, 4);
      ctx.fillStyle = u.hp > 60 ? '#7cc47f' : u.hp > 30 ? '#e8b64e' : '#e46c60'; ctx.fillRect(cx - r, cy + r + 2, r * 2 * u.hp / 100, 4);
    }
    if (us.length > 1) {
      ctx.fillStyle = '#0f131a'; ctx.beginPath(); ctx.arc(cx + r * 0.85, cy - r * 0.85, 7, 0, 7); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.font = '700 10px "Alegreya Sans", sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(String(us.length), cx + r * 0.85, cy - r * 0.85 + 0.5);
    }
    if (u.work) { ctx.font = `${r * 0.8}px ${EMOJI}`; ctx.fillText('🔨', cx + r * 0.9, cy + r * 0.6); }
  },

  drawPath(u, path, turns) {
    const ctx = this.ctx;
    let [px, py] = center(u.x, u.y);
    ctx.strokeStyle = 'rgba(234,208,151,0.9)'; ctx.lineWidth = 2.5; ctx.setLineDash([6, 5]);
    ctx.beginPath(); ctx.moveTo(px, py);
    for (const p of path) { const [x, y] = centerI(p); ctx.lineTo(x, y); }
    ctx.stroke(); ctx.setLineDash([]);
    const last = path[path.length - 1]; const [lx, ly] = centerI(last);
    ctx.fillStyle = '#ead097'; ctx.beginPath(); ctx.arc(lx, ly, 10, 0, 7); ctx.fill();
    if (turns != null) {
      ctx.fillStyle = '#1b1408'; ctx.font = '800 12px "Alegreya Sans", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(turns), lx, ly + 0.5);
    }
    void px; void py;
  },

  sizeMinimap() {
    const maxW = 220;
    const ww = S * SQ3 * (G.w + 0.5), wh = S * 1.5 * (G.h + 0.33);
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
      ctx.fillStyle = t.owner >= 0 ? civ(t.owner).color : TERRAIN[t.t].color;
      if (t.owner >= 0 && TERRAIN[t.t].water) ctx.fillStyle = TERRAIN[t.t].color;
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
    ctx.strokeRect(this.cam.x, this.cam.y, this.w / this.cam.z, this.h / this.cam.z);
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
    return true;
  },
  renderDrawer() {
    const c = cityById(this.drawer.city);
    let d = document.querySelector('.drawer');
    if (!c || c.civ !== G.human) { if (d) d.remove(); this.drawer = null; return; }
    if (!d) { d = document.createElement('aside'); d.className = 'drawer'; document.body.appendChild(d); }
    const y = cityYields(c);
    const cv = civ(c.civ);
    const growT = y.foodNet > 0 ? Math.ceil((y.need - c.food) / y.foodNet) : null;
    const cost = buildCost(c.build);
    const turns = (b) => { const left = Math.max(0, buildCost(b) - (c.build && b.kind === c.build.kind && b.key === c.build.key ? c.prod : c.prod)); return y.p > 0 ? Math.max(1, Math.ceil(left / y.p)) : '∞'; };
    const bc = buyCost(c);
    const opts = buildOptions(c);
    const glyphFor = (o) => o.kind === 'unit' ? UNITS[o.key].glyph : o.kind === 'bld' ? '🏛' : o.kind === 'wonder' ? '🗿' : o.key === 'spaceship' ? '🚀' : '💰';
    const descFor = (o) => {
      if (o.kind === 'unit') { const U = UNITS[o.key]; return U.str ? `Styrke ${U.str}${U.ranged ? ` · afstand ${U.ranged}` : ''} · ${U.moves} bevægelse` : U.desc; }
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
        <div class="section-h">Produktion</div>
        <div class="current">
          <div class="top">${c.build ? esc(buildName(c.build)) : 'Intet valgt'}<span>${c.build && c.build.key !== 'wealth' ? `${c.prod}/${cost} · ${turns(c.build)} ${turns(c.build) === 1 ? 'tur' : 'ture'}` : ''}</span></div>
          ${c.build && c.build.key !== 'wealth' ? `<div class="progress"><span style="width:${clamp(c.prod / cost * 100, 0, 100)}%"></span></div>` : ''}
          ${c.build && isFinite(bc) && c.build.key !== 'wealth' ? `<div><button type="button" class="act ${cv.gold >= bc ? 'primary' : ''}" id="buy" ${cv.gold >= bc ? '' : 'disabled'}>Køb nu for ${bc} guld</button></div>` : ''}
        </div>
        ${group('unit', 'Enheder')}${group('bld', 'Bygninger')}${group('wonder', 'Vidundere')}${group('proj', 'Projekter')}
        <div class="section-h">I byen</div>
        <div class="chips">${c.blds.length || wondersHere.length ? c.blds.map(b => `<span class="chip">${esc(BUILDINGS[b].name)}</span>`).join('') + wondersHere.map(w => `<span class="chip w">${esc(w)}</span>`).join('') : '<span class="sub" style="color:var(--muted)">Ingen bygninger endnu.</span>'}</div>
      </div>`;
    d.querySelector('.x').onclick = () => { this.closeDrawer(); this.refresh(); };
    d.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
      const [kind, key] = b.dataset.k.split(':');
      c.build = { kind, key };
      this.refresh();
    });
    const buy = d.querySelector('#buy');
    if (buy) buy.onclick = () => {
      const k = buyCost(c);
      if (cv.gold < k) return;
      cv.gold -= k; c.prod = buildCost(c.build);
      notify(G.human, `Du har købt ${buildName(c.build)} i ${c.name}. Den er klar næste tur.`, idx(c.x, c.y), 'good');
      this.refresh();
    };
  },

  // ---------- Dialoger ----------
  modal(title, body, foot, wide) {
    this.closeModal();
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true"><header><h2>${title}</h2><button type="button" class="x" aria-label="Luk">×</button></header><div class="body">${body}</div>${foot ? `<div class="foot">${foot}</div>` : ''}</div>`;
    bg.addEventListener('pointerdown', e => { if (e.target === bg) this.closeModal(); });
    bg.querySelector('.x').onclick = () => this.closeModal();
    document.body.appendChild(bg);
    return bg;
  },
  closeModal() { const m = document.querySelector('.modal-bg'); if (m) { m.remove(); return true; } return false; },

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
      if (k === 'astronomy') out.push('+1 mad fra havet');
      if (k === 'industry') out.push('+1 mad fra farme');
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
  },

  openDiplo() {
    const h = human();
    const others = G.civs.filter(c => c.id !== h.id);
    const myP = milPower(h.id);
    const rows = others.map(c => {
      if (!G.met[h.id][c.id]) return `<div class="drow"><i style="background:#3a4250"></i><div><div class="nm">Ukendt folk</div><div class="meta">I har ikke mødt hinanden endnu.</div></div><span></span></div>`;
      if (!c.alive) return `<div class="drow"><i style="background:${c.color};opacity:.4"></i><div><div class="nm" style="text-decoration:line-through">${esc(c.name)}</div><div class="meta">Udslettet</div></div><span></span></div>`;
      const war = atWar(h.id, c.id);
      const ratio = milPower(c.id) / (myP + 1);
      const mil = ratio > 1.4 ? 'langt stærkere end dig' : ratio > 1.1 ? 'stærkere end dig' : ratio > 0.9 ? 'jævnbyrdig' : ratio > 0.6 ? 'svagere end dig' : 'langt svagere end dig';
      const since = G.turn - G.warSince[h.id][c.id];
      const btn = war ? `<button type="button" class="act" data-p="${c.id}">Tilbyd fred</button>` : `<button type="button" class="act danger" data-w="${c.id}" ${since < 10 && G.warSince[h.id][c.id] ? 'disabled title="Fredsaftalen er for ny"' : ''}>Erklær krig</button>`;
      return `<div class="drow"><i style="background:${c.color}"></i><div><div class="nm">${esc(c.name)}<span class="status ${war ? 'war' : 'peace'}">${war ? 'Krig' : 'Fred'}</span></div>
        <div class="meta">${civCities(c.id).length} byer · militært ${mil} · ${score(c.id)} point</div></div>${btn}</div>`;
    }).join('');
    const bg = this.modal('Diplomati', `<p>Dit rige: ${civCities(h.id).length} byer, ${score(h.id)} point. Guld ${fmt(h.gold)} (${civIncome(h.id).gold >= 0 ? '+' : ''}${fmt(civIncome(h.id).gold)} pr. tur, heraf ${upkeep(h.id)} i vedligehold).</p><div class="diplo">${rows}</div><div class="section-h">Seneste begivenheder</div><div class="log">${G.log.slice(-40).reverse().map(e => `<div class="${e.kind}"><em>Tur ${e.turn}</em>${esc(e.text)}</div>`).join('') || '<div>Intet endnu.</div>'}</div>`);
    bg.querySelectorAll('[data-w]').forEach(b => b.onclick = () => {
      const id = +b.dataset.w;
      if (b.dataset.sure) { declareWar(h.id, id); this.openDiplo(); this.refresh(); return; }
      b.dataset.sure = '1'; b.textContent = 'Bekræft krig';
    });
    bg.querySelectorAll('[data-p]').forEach(b => b.onclick = () => {
      const id = +b.dataset.p;
      if (aiAcceptPeace(civ(id), h.id)) { makePeace(h.id, id); this.openDiplo(); this.refresh(); }
      else { b.disabled = true; b.textContent = `${civ(id).name} afviser`; G.warSince[h.id][id] = Math.max(G.warSince[h.id][id], G.turn - 3); }
    });
  },

  showOffer(o) {
    const c = civ(o.from);
    if (!c.alive || !atWar(G.human, c.id)) return;
    const bg = this.modal('Fredstilbud', `<p><b style="color:${c.color}">${esc(c.name)}</b> tilbyder at stoppe krigen og slutte fred.</p>`,
      `<button type="button" class="act" id="o-no">Afvis</button><button type="button" class="act primary" id="o-yes">Accepter fred</button>`);
    bg.querySelector('#o-yes').onclick = () => { makePeace(G.human, c.id); this.closeModal(); this.refresh(); };
    bg.querySelector('#o-no').onclick = () => { G.warSince[G.human][c.id] = G.turn; this.closeModal(); };
  },

  openMenu() {
    const bg = this.modal('Menu', `<dl class="help">
      <dt>Flyt og angrib</dt><dd>Vælg en enhed, og klik på et felt. Højreklik virker også. Røde felter kan angribes.</dd>
      <dt>Kort</dt><dd>Træk for at panorere, rul eller knib for at zoome, piletaster flytter kortet.</dd>
      <dt>Taster</dt><dd>Enter afslut tur · N næste enhed · Mellemrum spring over · F befæst · B grundlæg by · I farm · M mine · R vej · C ryd skov · A automatisér · H til nærmeste by · T teknologi · D diplomati</dd>
      <dt>Sejr</dt><dd>Udslet alle modstandere, eller forsk dig frem til Rumfart og byg rumskibet. Efter tur 400 vinder højeste pointtal.</dd>
      <dt>Gemning</dt><dd>Spillet gemmes automatisk i denne browser efter hver tur.</dd>
    </dl>`, `<button type="button" class="act" id="m-new">Nyt spil</button><button type="button" class="act" id="m-save">Gem nu</button><button type="button" class="act primary" id="m-close">Fortsæt</button>`);
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
