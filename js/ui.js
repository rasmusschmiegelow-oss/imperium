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
  { text: 'Udforsk ruiner med dine enheder for guld, teknologi og nye enheder. Enheder får erfaring i kamp, og ved hvert niveau kan du vælge en forfremmelse i enhedspanelet.', done: () => G.turn > 35, manual: true },
  { text: 'Når du opdager Monarki eller Filosofi, kan du skifte regeringsform under Regering øverst. Heste og jern på dit land giver adgang til ryttere og sværdkæmpere.', done: () => G.turn > 60 || human().gov !== 'despotism', manual: true },
  { text: 'Byg en helligdom (Mystik) for at samle tro. Med nok tro kan du grundlægge din egen religion under Riget → Religion og sprede den med missionærer.', done: () => G.turn > 80 || !!civReligion(G.human), manual: true },
  { text: 'Under Riget → Sejr kan du følge kapløbet om de fem sejrsformer, og under Statistik kan du se, hvordan rigerne udvikler sig.', done: () => G.turn > 100, manual: true },
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
    $('#btn-gov').onclick = () => this.openRealm(canFoundReligion(human()) ? 'religion' : canAdoptPolicy(human()) ? 'society' : this.realmTab);
    $('#stat-faith').onclick = () => this.openRealm('religion');
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
      chosen = b.dataset.k; this.chosenCiv = chosen;
      pickEl.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    };
    $('#btn-continue').hidden = !hasSave();
    const renderPlayers = () => {
      const n = +$('#opt-players').value;
      const box = $('#extra-players');
      const used = [chosen];
      let html = '';
      for (let k = 2; k <= n; k++) {
        const def = CIVS.find(c => !used.includes(c.key)); used.push(def.key);
        html += `<label class="field" for="opt-p${k}"><span class="label">Spiller ${k}</span><select id="opt-p${k}">${CIVS.map(c => `<option value="${c.key}" ${c.key === def.key ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>`;
      }
      box.innerHTML = html;
      box.hidden = n < 2;
    };
    $('#opt-players').onchange = renderPlayers;
    renderPlayers();
    $('#btn-start').onclick = () => {
      const mv = $('#opt-minors').value;
      const n = +$('#opt-players').value;
      const humans = [chosen];
      for (let k = 2; k <= n; k++) { const v = $('#opt-p' + k).value; if (!humans.includes(v)) humans.push(v); }
      const opts = { civ: chosen, humans, opponents: Math.min(+$('#opt-opp').value, CIVS.length - humans.length), size: $('#opt-size').value, difficulty: $('#opt-diff').value,
        mapType: $('#opt-map').value, minors: mv === 'auto' ? undefined : +mv, tutorial: $('#opt-guide').checked, pace: $('#opt-pace').value, victories: this.victoryChoice() };
      newGame(opts);
      this.enterGame();
      for (const id of G.humans) notify(id, `Velkommen, hersker over ${civ(id).name}. Grundlæg din første by med bosætteren (tast B).`, null, 'good');
      if (G.humans.length > 1) this.showHandover(true);
    };
    $('#btn-continue').onclick = () => { if (loadGame()) this.enterGame(); };
    $('#btn-load').onclick = () => this.openLoad();
    $('#btn-online').onclick = () => this.openOnline();
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

  victoryChoice() { const v = {}; for (const k of Object.keys(VICTORY_TYPES)) v[k] = $('#v-' + k).checked; return v; },

  // Skærm mellem spillerne ved samme skærm
  showHandover(first) {
    const h = human();
    const el = $('#handover');
    const inbox = (h.inbox || []).slice(-8);
    el.innerHTML = `<div class="ho-inner">
      <div class="ho-icon">${ART.miscGlyph('players', 40)}</div>
      <div class="label">Spiller ${G.humans.indexOf(h.id) + 1} af ${G.humans.length}</div>
      <h2 style="color:${h.color}">${esc(h.name)}</h2>
      <p>${first ? 'Spillet begynder.' : `Det er din tur. ${yearLabel(G.turn)}, tur ${G.turn}.`} De andre spillere skal se væk.</p>
      ${inbox.length ? `<div class="ho-log">${inbox.map(e => `<div class="${e.kind}">${esc(e.text)}</div>`).join('')}</div>` : ''}
      <button type="button" class="primary" id="ho-go">Start min tur</button></div>`;
    el.hidden = false;
    h.inbox = [];
    $('#ho-go').onclick = () => {
      el.hidden = true;
      const first = civUnits(G.human)[0] || civCities(G.human)[0];
      const c = capitalOf(G.human) || first;
      if (c) this.centerOn(idx(c.x, c.y));
      this.selectNext(true); this.refresh(); this.nextOffer();
    };
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
      if (this.readOnly && !['t', 'T', 'd', 'D'].includes(k)) return;
      if (k === 'Enter') { e.preventDefault(); this.onEndTurn(); return; }
      if (k === 't' || k === 'T') { this.openTech(); return; }
      if (k === 'd' || k === 'D') { this.openDiplo(); return; }
      if (k === 'n' || k === 'N' || k === 'Tab') { e.preventDefault(); this.selectNext(); return; }
      if (!u) return;
      const map = { x: 'explore', X: 'explore', v: 'sentry', V: 'sentry', p: 'spread', P: 'spread', ' ': 'skip', f: 'fort', F: 'fort', b: 'found', B: 'found', i: 'farm', I: 'farm', m: 'mine', M: 'mine', r: 'road', R: 'road', c: 'chop', C: 'chop', a: 'auto', A: 'auto', Delete: 'disband', Backspace: 'disband', h: 'home', H: 'home', u: 'upgrade', U: 'upgrade', g: 'gp', G: 'gp', e: 'route', E: 'route' };
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
    const y = tileYield(i, { civ: G.human, blds: [], id: -1 });
    const res = t.res && resVisible(t.res, human()) ? RESOURCES[t.res] : null;
    const parts = [`<b>${T.name}</b>${res ? ` · ${res.name}${res.lux ? ' (luksusvare)' : res.strat ? ' (strategisk)' : ''}` : ''}${t.river ? ' · flod' : ''}`];
    if (t.nat) parts.push(`<b style="color:var(--bronze-hi)">${esc(NATURAL[t.nat].name)}</b> · ${esc(NATURAL[t.nat].desc)}`);
    if (t.ruin) parts.push('<b style="color:var(--bronze-hi)">Ruiner</b> · gå ind med en enhed for at udforske dem');
    parts.push(`<span style="color:var(--food)">${y.f} mad</span> · <span style="color:var(--prod)">${y.p} prod.</span> · <span style="color:var(--gold)">${y.t} handel</span>`);
    const imp = [t.imp === 'farm' ? 'Farm' : t.imp === 'mine' ? 'Mine' : null, t.road ? 'Vej' : null].filter(Boolean);
    if (imp.length) parts.push(imp.join(', '));
    if (t.owner >= 0) parts.push(`<span style="color:${civ(t.owner).color}">●</span> ${esc(civ(t.owner).minor ? 'Bystaten ' + civ(t.owner).name : civ(t.owner).name)}`);
    if (TERRAIN[t.t].def) parts.push(`Forsvar +${TERRAIN[t.t].def * 100} %`);
    if (res && res.strat) parts.push(`Giver 2 ${res.name.toLowerCase()} inden for dine grænser`);
    if (t.owner >= 0 && t.owner !== G.human && isMajor(civ(t.owner)) && !atWar(G.human, t.owner) && !hasOB(G.human, t.owner)) parts.push('Lukket grænse: kræver åbne grænser');
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
    if (this.readOnly) { if (i >= 0 && G.explored[i]) { this.sel = { tile: i }; this.reach = null; this.refresh(); } return; }
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
    if (u && isAir(u)) {
      if (canAttack(u, i) && VIS[i]) { attack(u, i); SFX.play('combat'); this.hideTip(); this.afterAction(u); return; }
      if (city && city.civ === G.human && rebase(u, city)) { SFX.play('move'); this.afterAction(u); return; }
      if (i !== here && (!own.length || right)) { notify(G.human, `Fly kan kun flyve til dine byer inden for ${rebaseRange(u)} felter, eller angribe inden for ${unitRange(u)} felter.`, null, 'warn'); return; }
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
    if (isAir(u)) { this.confirmDisband = false; this.reach = new Set(u.moves > 0 ? rebaseTargets(u).map(c => idx(c.x, c.y)) : []); this.ensureVisible(idx(u.x, u.y)); this.refresh(); return; }
    this.confirmDisband = false;
    this.reach = reachable(u);
    this.ensureVisible(idx(u.x, u.y));
    this.refresh();
  },

  afterAction(u) {
    if (u && G.units.includes(u) && isAir(u) && u.moves > 0) { this.select(u); return; }
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
    return u.civ === G.human && u.moves > 0 && !u.fort && !u.sleep && !u.work && !u.path && !u.auto && !u.explore && !u.sentry && !this.skip.has(u.id);
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
    if (this.readOnly) return;
    const u = this.selUnit(); if (!u) return;
    if (a === 'skip') { this.skip.add(u.id); this.selectNext(); return; }
    if (a === 'fort') { if (!isMil(u)) u.sleep = true; else u.fort = true; u.path = null; this.selectNext(); return; }
    if (a === 'cancel') { u.path = null; u.auto = false; u.work = null; u.fort = false; u.sleep = false; u.explore = false; u.sentry = false; this.select(u); return; }
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
    if (a.startsWith('spy:')) { const r = spyMission(u, a.slice(4)); if (r) { SFX.play(r.ok ? 'tech' : 'bad'); this.sel = null; this.selectNext(); this.refresh(); } return; }
    if (a === 'explore') { u.explore = true; u.fort = false; u.sentry = false; autoExplore(u); this.afterAction(u); this.selectNext(); return; }
    if (a === 'sentry') { u.sentry = true; u.fort = true; u.path = null; this.selectNext(); return; }
    if (a === 'spread') { if (spreadReligion(u)) { SFX.play('tech'); if (G.units.includes(u)) this.select(u); else { this.sel = null; this.selectNext(); } } return; }
    if (a.startsWith('promo:')) { if (applyPromo(u, a.slice(6))) { SFX.play('tech'); this.select(u); } return; }
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
    if (this.readOnly) { notify(G.human, 'Det er ikke din tur endnu. Du får besked, når det er.', null, 'warn'); return; }
    this.closeDrawer();
    const blocker = this.blocker();
    if (blocker) { blocker.go(); return; }
    this.busy = true; $('#busy').hidden = false;
    this.sel = null; this.reach = null; this.pathPreview = null; this.hideTip();
    SFX.play('turn');
    await new Promise(r => setTimeout(r, 30));
    let res = null;
    try { res = endTurn(); } catch (err) { console.error(err); }
    this.skip = new Set();
    this.busy = false; $('#busy').hidden = true;
    if (this.online) { await this.finishOnlineTurn(res); return; }
    saveGame();
    if (G.over) { this.refresh(); this.showGameOver(); return; }
    if (res === 'handover') { this.sel = null; this.closeModal(true); this.refresh(); this.showHandover(false); return; }
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
    if (!G.offers) return;
    for (let k = 0; k < G.offers.length; k++) {
      const o = G.offers[k];
      if ((o.to != null ? o.to : G.human) !== G.human) continue;
      G.offers.splice(k, 1); k--;
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
    $('#stat-happy').innerHTML = `<span class="k">Tilfredshed</span>${unh ? `<b class="unhappy">${unh} utilfredse</b>` : inGoldenAge(h) ? `<b class="golden">${ART.miscGlyph('golden', 14)} Guldalder</b>` : '<b class="happy">Tilfredse</b>'}<span>${inGoldenAge(h) ? `${h.ga.left} ture` : `${lux} luksus`}</span>`;
    $('#stat-happy').title = (unh ? 'Utilfredse indbyggere arbejder ikke. Klik for at se den mest utilfredse by.' : 'Alle indbyggere arbejder.') + (inGoldenAge(h) ? ` Guldalder i ${h.ga.left} ture endnu.` : ` Guldalder: ${Math.floor(h.ga.pts)}/${goldenNeed(h)} point.`);
    $('#stat-year').innerHTML = `<b>${yearLabel(G.turn)}</b><span class="k">Tur ${G.turn}</span>`;
    const strat = Object.keys(RESOURCES).filter(k => RESOURCES[k].strat && resVisible(k, h));
    $('#stat-res').innerHTML = strat.map(k => { const a = stratAvail(h.id, k), sup = stratSupply(h.id, k); return `<span class="res ${a < 0 ? 'neg' : sup ? '' : 'none'}" title="${esc(RESOURCES[k].name)}: ${Math.max(0, a)} ledig af ${sup}">${ART.resGlyph(k, 15)}<b>${a}</b></span>`; }).join('');
    $('#stat-res').title = 'Strategiske ressourcer: ledige / i alt. Visse enheder kræver dem.';
    const gv = gov(h);
    $('#btn-gov').innerHTML = `${ART.miscGlyph('gov_' + h.gov, 16)} Riget`;
    $('#btn-gov').title = `Regering: ${h.gov === 'anarchy' ? `Anarki (${h.anarchy} ture)` : gv.name}. Samfundspolitikker, religion, sejr og statistik.${canAdoptPolicy(h) ? ' Du kan indføre en ny politik!' : ''}`;
    $('#btn-gov').classList.toggle('ready', canAdoptPolicy(h));
    const rel = civReligion(h.id);
    const fInc = civCities(h.id).reduce((a, c) => a + cityFaith(c), 0);
    $('#stat-faith').innerHTML = `${ART.miscGlyph('faith', 15)}<b class="faith">${Math.floor(h.faith || 0)}</b><span>+${fInc}</span>`;
    $('#stat-faith').title = rel ? `Tro. Din religion: ${RELIGIONS[rel].name}. Køb missionærer i byer, der følger den.` : canFoundReligion(h) ? 'Du kan grundlægge en religion nu!' : `Tro. ${religionSlotsLeft() > 0 ? `En religion koster ${religionCost()} tro.` : 'Der er ikke flere religioner at grundlægge.'}`;
    $('#stat-faith').classList.toggle('ready', canFoundReligion(h));
    const b = this.readOnly ? null : this.blocker();
    const et = $('#endturn');
    et.textContent = this.readOnly ? 'Venter …' : b ? b.label : this.online ? 'Afslut og send tur' : 'Afslut tur';
    et.classList.toggle('blocker', !!b || this.readOnly);
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
        : u.explore ? 'Udforsker automatisk' : u.sentry ? 'Står vagt' : u.fort ? 'Befæstet' : u.sleep ? 'Sover' : u.auto ? 'Automatiseret' : u.path ? `På vej · ${pathTurns(u, u.path)} ture` : embarked(u) ? 'Indskibet: svagt forsvar, kan ikke angribe' : '';
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
        if (u.type === 'missionary') {
          const t = spreadTarget(u);
          acts.push(A('spread', t ? `Prædik ${esc(RELIGIONS[u.rel].name)} i ${esc(t.name)}` : 'Prædik (stå i eller ved en by)', 'P', !!t, 'primary'));
          extra = `<div class="sub" style="margin-top:8px">${esc(RELIGIONS[u.rel].name)} · ${u.charges || 1} ${u.charges === 1 ? 'prædiken' : 'prædikener'} tilbage</div>`;
        }
        if (isAir(u)) extra = `<div class="sub" style="margin-top:8px">Klik på et rødt felt for at angribe (${unitRange(u)} felter), eller på en af dine byer for at omplacere flyet (${rebaseRange(u)} felter).</div>`;
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
        if (isMil(u) && promoPending(u)) {
          extra += `<div class="section-h" style="margin-top:12px">Vælg forfremmelse</div><div class="actions-row">${promoOptions(u).map(k => `<button type="button" class="act promo" data-a="promo:${k}" title="${esc(PROMOS[k].desc)}">${ART.miscGlyph('promo', 16)} ${esc(PROMOS[k].name)} <span class="pd">${esc(PROMOS[k].desc)}</span></button>`).join('')}</div>`;
        }
        if (isSpy(u)) {
          const t = spyTarget(u);
          if (t) {
            extra += `<div class="section-h" style="margin-top:12px">Spionage i ${esc(t.name)}${counterSpy(t) ? ' · byen har en modspion' : ''}</div><div class="actions-row">${Object.keys(SPY_MISSIONS).map(m => `<button type="button" class="act" data-a="spy:${m}" ${spyMissionOk(u, t, m) ? '' : 'disabled'} title="${m === 'steal' && !stealable(u, t).length ? 'De kender intet, du mangler' : m === 'sabotage' && !(t.build && t.prod > 10) ? 'Byen har ikke noget i gang' : ''}">${ART.miscGlyph(SPY_MISSIONS[m].icon, 16)} ${SPY_MISSIONS[m].name} · ${Math.round(spyChance(u, t, m) * 100)} %</button>`).join('')}</div><p class="hint-s">Spionen bruges op, uanset om missionen lykkes. Bliver den afsløret, husker ${esc(civ(t.civ).name)} det.</p>`;
          } else extra += `<div class="sub" style="margin-top:8px">Gå hen til en fremmed by for at spionere. Står spionen i din egen by, beskytter den mod fjendtlige spioner.</div>`;
        }
        if (isMil(u) && !isAir(u)) acts.push(A('explore', u.explore ? 'Udforsker …' : 'Udforsk automatisk', 'X', !u.explore));
        if (isMil(u) && !isAir(u)) acts.push(A('sentry', 'Vagt', 'V', !u.sentry, '', 'Stå stille, og vågn, når en fjende kommer inden for 3 felter'));
        if (isMil(u)) acts.push(A('fort', 'Befæst', 'F', !u.fort));
        else acts.push(A('fort', 'Sov', 'F', !u.sleep));
        acts.push(A('skip', 'Spring over', 'Mellemrum', u.moves > 0));
        if (u.path || u.auto || u.work || u.fort || u.sleep || u.explore || u.sentry) acts.push(A('cancel', 'Ny ordre', ''));
        acts.push(A('home', 'Til nærmeste by', 'H', u.moves > 0));
        acts.push(A('disband', this.confirmDisband ? 'Bekræft opløsning' : 'Opløs', '', true, 'danger'));
      }
      const stackUnits = unitsAt(idx(u.x, u.y)).filter(v => v.civ === u.civ);
      const stack = stackUnits.length > 1 ? `<div class="stack">${stackUnits.map(v => `<button type="button" title="${esc(UNITS[v.type].name)}" data-u="${v.id}" class="${v === u ? 'on' : ''}">${ART.unitGlyph(v.type)}</button>`).join('')}</div>` : '';
      const hpc = u.hp > 60 ? 'var(--good)' : u.hp > 30 ? 'var(--warn)' : 'var(--bad)';
      p.innerHTML = `<h3><span class="glyph" style="--unit-civ:${cv.color}">${ART.unitGlyph(u.type, 22, '#FFFFFF')}</span>${esc(T.name)}${u.vet ? ' <span class="chip w">Veteran</span>' : ''}${generalNear(u) && isMil(u) ? ' <span class="chip w">General</span>' : ''}</h3>
        <div class="sub">${own ? '' : esc(cv.name) + ' · '}${status || (T.desc ? esc(T.desc) : TERRAIN[G.tiles[idx(u.x, u.y)].t].name)}</div>
        <div class="kv">${T.str ? `<div><span>Styrke</span> <b>${T.str}</b></div>` : ''}${T.ranged ? `<div><span>Afstand</span> <b>${T.ranged}</b> <span>(${unitRange(u)} felter)</span></div>` : ''}
        <div><span>Bevægelse</span> <b>${fmt(u.moves)}/${maxMoves(u)}</b></div><div><span>Liv</span> <b>${u.hp}</b></div></div>
        <div class="hpbar"><span style="width:${u.hp}%;background:${hpc}"></span></div>
        ${isMil(u) ? `<div class="xprow"><span>Niveau ${unitLevel(u)}</span><span class="xpbar"><span style="width:${nextXp(u) ? clamp((u.xp || 0) / nextXp(u) * 100, 0, 100) : 100}%"></span></span><span>${u.xp || 0}${nextXp(u) ? `/${nextXp(u)}` : ''} erfaring</span></div>
          ${(u.promos || []).length ? `<div class="chips" style="margin-top:6px">${u.promos.map(k => `<span class="chip w" title="${esc(PROMOS[k].desc)}">${esc(PROMOS[k].name)}</span>`).join('')}</div>` : ''}` : ''}
        ${stratShort(u) ? `<div class="sub" style="color:var(--bad)">Mangler ${esc(RESOURCES[T.needs].name.toLowerCase())}: −25 % styrke</div>` : ''}
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
    if (t.res && !cityAt(i) && resVisible(t.res, human())) ART.resource(ctx, t.res, cx + S * 0.38, cy - S * 0.36, S * 0.44);
    if (t.ruin) ART.ruin(ctx, cx - S * 0.05, cy + S * 0.12);
    if (t.nat) {
      ART.natural(ctx, t.nat, cx, cy + S * 0.05);
      if (this.cam.z > 0.8) {
        const fs = clamp(11 / this.cam.z, 8, 16);
        ctx.font = `700 ${fs}px "Alegreya Sans", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10,13,18,0.85)'; ctx.fillStyle = '#EAD097';
        ctx.strokeText(NATURAL[t.nat].name, cx, cy + S * 0.72); ctx.fillText(NATURAL[t.nat].name, cx, cy + S * 0.72);
      }
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
      for (const j of tilesInRadius(u.x, u.y, T.ranged ? unitRange(u) : 1)) {
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
    if (c.rel && RELIGIONS[c.rel]) {
      ctx.fillStyle = '#0f131a'; ctx.beginPath(); ctx.arc(lx + total + fs * 0.25, ly + bh / 2, fs * 0.55, 0, 7); ctx.fill();
      ctx.strokeStyle = RELIGIONS[c.rel].color; ctx.lineWidth = Math.max(1, fs * 0.14); ctx.stroke();
      ART.misc(ctx, 'rel_' + c.rel, lx + total + fs * 0.25, ly + bh / 2, fs * 0.8);
    }
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
    if (u.promos && isMil(u)) ART.promoMarks(ctx, cx - r - 1, cy + r * 0.45, u.promos.length, u.civ === G.human && promoPending(u) > 0);
    if (u.x != null && stratShort(u)) { ctx.fillStyle = '#E46C60'; ctx.beginPath(); ctx.arc(cx + r * 0.85, cy + r * 0.85, 3.5, 0, 7); ctx.fill(); }
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
    const planes = all.filter(isAir).length;
    if (planes && city) {
      const [px, py] = centerI(i);
      ctx.fillStyle = 'rgba(15,19,26,0.9)'; ctx.beginPath(); ctx.arc(px + S * 0.45, py + S * 0.3, 8, 0, 7); ctx.fill();
      ctx.strokeStyle = civ(all.find(isAir).civ).color; ctx.lineWidth = 1.5; ctx.stroke();
      ART.unit(ctx, 'fighter', px + S * 0.45, py + S * 0.3, 6.5);
      if (planes > 1) { ctx.font = '700 8px "Alegreya Sans", sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(String(planes), px + S * 0.45 + 8, py + S * 0.3 - 6); }
    }
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
    const myRel = civReligion(c.civ);
    const pres = Object.entries(c.relP || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const relBlock = `<div class="relrow">${c.rel ? `${ART.miscGlyph('rel_' + c.rel, 20)}<b style="color:${RELIGIONS[c.rel].color}">${esc(RELIGIONS[c.rel].name)}</b>${isHolyCity(c) ? '<span class="chip w">Hellig by</span>' : ''}` : '<span style="color:var(--muted)">Ingen religion endnu</span>'}</div>
      ${pres.length ? `<div class="chips">${pres.map(([k, v]) => `<span class="chip" style="border:1px solid ${RELIGIONS[k].color}">${esc(RELIGIONS[k].name)} ${Math.round(v)}</span>`).join('')}</div>` : ''}
      <div class="kv"><div><span>Tro</span> <b>+${cityFaith(c)}</b></div></div>
      ${myRel ? `<div style="margin-top:6px"><button type="button" class="act" id="buymis" ${canBuyMissionary(c) ? '' : 'disabled'} title="${c.rel !== myRel ? 'Byen skal følge din religion' : ''}">${ART.unitGlyph('missionary', 16)} Køb missionær for ${missionaryCost(cv)} tro</button></div>` : ''}`;
    const growT = y.foodNet > 0 ? Math.ceil((y.need - c.food) / y.foodNet) : null;
    const cost = buildCost(c.build);
    const turns = (b) => { const left = Math.max(0, buildCost(b) - c.prod); return y.p > 0 ? Math.max(1, Math.ceil(left / y.p)) : '∞'; };
    const bc = buyCost(c);
    const opts = buildOptions(c);
    const glyphFor = (o) => o.kind === 'unit' ? ART.unitGlyph(o.key, 22, '#ECE6D8') : ART.miscGlyph(o.kind === 'bld' ? (o.key === 'shrine' ? 'shrine' : 'bld') : o.kind === 'wonder' ? (o.key === 'un' ? 'v_diplo' : 'wonder') : o.key === 'spaceship' ? 'spaceship' : 'wealth');
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
        const reason = !o.ok ? (o.reason || (o.key === 'settler' ? 'Kræver 2 indbyggere' : 'Bygges allerede')) : '';
        return `<div class="bwrap"><button type="button" class="bopt ${on ? 'on' : ''}" data-k="${o.kind}:${o.key}" ${o.ok ? '' : 'disabled'}>
          <span class="g">${glyphFor(o)}</span><span><span class="n">${esc(buildName(o))}</span><span class="d">${esc(reason || descFor(o))}</span></span>
          <span class="c">${o.key === 'wealth' ? '' : `${cst} · ${turns(o)} t`}</span></button>${o.key === 'wealth' ? '' : `<button type="button" class="qadd" data-q="${o.kind}:${o.key}" title="Sæt i kø" aria-label="Sæt ${esc(buildName(o))} i kø">+</button>`}</div>`;
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
        <div class="section-h">Religion</div>
        ${relBlock}
        <div class="section-h">Fokus</div>
        <div class="seg">${Object.entries(FOCUS).map(([k, f]) => `<button type="button" data-f="${k}" class="${(c.focus || 'balanced') === k ? 'on' : ''}">${f.name}</button>`).join('')}</div>
        <p class="hint-s">Klik på felterne omkring byen på kortet for at låse, hvilke felter indbyggerne arbejder på.${(c.locked || []).length ? ` <button type="button" class="linkbtn" id="unlock">Fjern låse (${c.locked.length})</button>` : ''}</p>
        <div class="section-h">Produktion</div>
        <div class="current">
          <div class="top">${c.build ? esc(buildName(c.build)) : 'Intet valgt'}<span>${c.build && c.build.key !== 'wealth' ? `${c.prod}/${cost} · ${turns(c.build)} ${turns(c.build) === 1 ? 'tur' : 'ture'}` : ''}</span></div>
          ${c.build && c.build.key !== 'wealth' ? `<div class="progress"><span style="width:${clamp(c.prod / cost * 100, 0, 100)}%"></span></div>` : ''}
          ${c.build && isFinite(bc) && c.build.key !== 'wealth' ? `<div><button type="button" class="act ${cv.gold >= bc ? 'primary' : ''}" id="buy" ${cv.gold >= bc ? '' : 'disabled'}>Køb nu for ${bc} guld</button></div>` : ''}
        </div>
        ${(c.queue || []).length ? `<div class="queue"><span class="label">${ART.miscGlyph('queue', 14)} Derefter</span>${c.queue.map((q, n) => `<span class="chip">${n + 1}. ${esc(buildName(q))} <button type="button" class="qdel" data-qd="${n}" aria-label="Fjern fra kø">×</button></span>`).join('')}</div>` : `<p class="hint-s">Tryk på + ud for en mulighed for at sætte den i kø.</p>`}
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
    d.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { const [kind, key] = b.dataset.q.split(':'); queueAdd(c, { kind, key }); this.refresh(); });
    d.querySelectorAll('[data-qd]').forEach(b => b.onclick = () => { c.queue.splice(+b.dataset.qd, 1); this.refresh(); });
    const un = d.querySelector('#unlock'); if (un) un.onclick = () => { c.locked = []; assignAllTiles(); this.refresh(); };
    const bm = d.querySelector('#buymis'); if (bm) bm.onclick = () => { const u = buyMissionary(c); if (u) { SFX.play('tech'); notify(G.human, `En missionær er klar i ${c.name}.`, idx(c.x, c.y), 'good'); this.refresh(); } };
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
    if (m.dataset.lock) {
      if (!silent) return false;
      if (this.pendingEvent) { G.offers.unshift(this.pendingEvent); this.pendingEvent = null; }
    }
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

  openGov() { this.openRealm('gov'); },
  govHtml() {
    const h = human();
    const av = govsAvailable(h);
    const cards = Object.keys(GOVS).filter(k => !GOVS[k].hidden).map(k => {
      const g = GOVS[k];
      const cur = h.gov === k || (h.gov === 'anarchy' && h.nextGov === k);
      const ok = av.includes(k);
      const btn = cur ? `<span class="chip w">${h.gov === 'anarchy' ? `Indføres om ${h.anarchy} ${h.anarchy === 1 ? 'tur' : 'ture'}` : 'Nuværende'}</span>`
        : ok ? `<button type="button" class="act primary" data-gov="${k}" ${h.gov === 'anarchy' ? 'disabled' : ''}>Indfør (${anarchyTurns(h)} ture anarki)</button>`
        : `<span class="sub">Kræver ${esc(TECHS[g.tech].name)}</span>`;
      return `<div class="govcard ${cur ? 'on' : ''} ${ok ? '' : 'locked'}">
        <div class="gi">${ART.miscGlyph('gov_' + k, 34)}</div>
        <div class="gb"><div class="gn">${esc(g.name)}</div>
          <ul>${g.pros.map(x => `<li class="pro">${esc(x)}</li>`).join('')}${g.cons.map(x => `<li class="con">${esc(x)}</li>`).join('')}</ul></div>
        <div class="ga">${btn}</div></div>`;
    }).join('');
    return `<p>Regeringsformen påvirker forskning, guld, produktion, tilfredshed og hvor mange enheder du kan holde gratis. Et skifte giver ${anarchyTurns(h)} ture med anarki uden forskning.</p><div class="govlist">${cards}</div>`;
  },
  bindGov(bg) {
    const h = human();
    bg.querySelectorAll('[data-gov]').forEach(b => b.onclick = () => {
      if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = 'Bekræft revolution'; return; }
      adoptGov(h, b.dataset.gov); SFX.play('turn'); this.closeModal(); this.refresh();
    });
  },

  openRealm(tab) {
    this.realmTab = tab || this.realmTab || 'gov';
    const tabs = [['gov', 'Regering', 'gov_' + human().gov], ['society', 'Samfund', 'pol_tradition'], ['religion', 'Religion', 'faith'], ['victory', 'Sejr', 'v_points'], ['stats', 'Statistik', 'stats']];
    const body = this.realmTab === 'gov' ? this.govHtml() : this.realmTab === 'society' ? this.societyHtml() : this.realmTab === 'religion' ? this.religionHtml() : this.realmTab === 'victory' ? this.victoryHtml() : this.statsHtml();
    const bg = this.modal('Riget', `<div class="tabs">${tabs.map(([k, n, ic]) => `<button type="button" data-tab="${k}" class="${this.realmTab === k ? 'on' : ''}">${ART.miscGlyph(ic, 16)} ${n}</button>`).join('')}</div>${body}`, '', this.realmTab === 'stats' || this.realmTab === 'victory' || this.realmTab === 'society');
    bg.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => this.openRealm(b.dataset.tab));
    if (this.realmTab === 'gov') this.bindGov(bg);
    if (this.realmTab === 'religion') this.bindReligion(bg);
    if (this.realmTab === 'society') this.bindSociety(bg);
    if (this.realmTab === 'stats') this.bindStats(bg);
  },

  religionHtml() {
    const h = human();
    const mine = civReligion(h.id);
    const cost = religionCost();
    let head;
    if (mine) head = `<p>Din religion er <b style="color:${RELIGIONS[mine].color}">${esc(RELIGIONS[mine].name)}</b>. Du har ${Math.floor(h.faith)} tro. Køb missionærer for ${missionaryCost(h)} tro i byer, der følger den, og send dem til byer, der skal omvendes.</p>`;
    else if (canFoundReligion(h)) {
      const free = freeReligions();
      const fb = Object.keys(BELIEFS).filter(k => BELIEFS[k].kind === 'founder');
      const ob = Object.keys(BELIEFS).filter(k => BELIEFS[k].kind === 'follower');
      head = `<p>Du har ${Math.floor(h.faith)} tro og kan grundlægge en religion for ${cost} tro. Din hovedstad bliver hellig by.</p>
        <div class="section-h">Vælg religion</div><div class="relpick" id="rp-rel">${free.map((k, n) => `<button type="button" data-rel="${k}" class="${n === 0 ? 'on' : ''}">${ART.miscGlyph('rel_' + k, 24)}<span>${esc(RELIGIONS[k].name)}</span></button>`).join('')}</div>
        <div class="section-h">Grundlæggerens trosretning</div><div class="blist" id="rp-f">${fb.map((k, n) => `<button type="button" class="bopt ${n === 0 ? 'on' : ''}" data-b="${k}"><span class="g">${ART.miscGlyph('faith', 18)}</span><span><span class="n">${esc(BELIEFS[k].name)}</span><span class="d">${esc(BELIEFS[k].desc)}</span></span><span></span></button>`).join('')}</div>
        <div class="section-h">Tilhængernes trosretning</div><div class="blist" id="rp-o">${ob.map((k, n) => `<button type="button" class="bopt ${n === 0 ? 'on' : ''}" data-b="${k}"><span class="g">${ART.miscGlyph('faith', 18)}</span><span><span class="n">${esc(BELIEFS[k].name)}</span><span class="d">${esc(BELIEFS[k].desc)}</span></span><span></span></button>`).join('')}</div>
        <div style="margin-top:12px"><button type="button" class="act primary" id="rp-go">Grundlæg religionen</button></div>`;
    } else head = `<p>Du har ${Math.floor(h.faith || 0)} tro. ${religionSlotsLeft() > 0 ? `En religion koster ${cost} tro. Helligdomme, templer, katedraler, Stonehenge og visse naturvidundere giver tro. Der er plads til ${religionSlotsLeft()} religion${religionSlotsLeft() === 1 ? '' : 'er'} mere i verden.` : 'Alle religioner i verden er grundlagt. Byerne kan stadig følge en religion og få dens fordele.'}</p>`;
    const list = Object.values(G.religions).map(r => {
      const R = RELIGIONS[r.key], f = civ(r.founder), holy = cityById(r.holy);
      const known = G.met[h.id][r.founder];
      return `<div class="drow"><i style="background:${R.color}"></i><div><div class="nm">${ART.miscGlyph('rel_' + r.key, 18)} ${esc(R.name)}</div>
        <div class="meta">${known ? `Grundlagt af ${esc(f.name)}` : 'Grundlagt af et ukendt folk'} · hellig by: ${holy && G.explored[idx(holy.x, holy.y)] ? esc(holy.name) : 'ukendt'} · ${followers(r.key)} byer</div>
        <div class="reasons">${r.beliefs.map(b => `<span class="p" title="${esc(BELIEFS[b].desc)}">${esc(BELIEFS[b].name)}</span>`).join('')}</div></div><span></span></div>`;
    }).join('');
    return head + `<div class="section-h">Verdens religioner</div>${list ? `<div class="diplo">${list}</div>` : '<p class="sub">Ingen religioner er grundlagt endnu.</p>'}`;
  },
  bindReligion(bg) {
    const one = (sel) => bg.querySelectorAll(sel + ' button').forEach(b => b.onclick = () => { bg.querySelectorAll(sel + ' button').forEach(x => x.classList.toggle('on', x === b)); });
    one('#rp-rel'); one('#rp-f'); one('#rp-o');
    const go = bg.querySelector('#rp-go');
    if (go) go.onclick = () => {
      const rel = bg.querySelector('#rp-rel .on').dataset.rel, f = bg.querySelector('#rp-f .on').dataset.b, o = bg.querySelector('#rp-o .on').dataset.b;
      if (foundReligion(human(), rel, f, o)) { SFX.play('tech'); this.openRealm('religion'); this.refresh(); }
    };
  },

  victoryHtml() {
    const h = human();
    const ms = majors().filter(c => c.alive && (c.id === h.id || G.met[h.id][c.id]));
    const unknown = majors().filter(c => c.alive && c.id !== h.id && !G.met[h.id][c.id]).length;
    const bar = (v, col) => `<span class="vbar"><span style="width:${clamp(v * 100, 0, 100)}%;background:${col}"></span></span>`;
    const alive = majors().filter(c => c.alive).length;
    const f = unForecast();
    const rows = ms.map(c => {
      const sp = c.techs.includes('spaceflight') ? 1 : c.techs.includes('rocketry') ? 0.6 : Math.min(0.5, c.techs.length / Object.keys(TECHS).length * 0.5);
      const ship = civCities(c.id).find(x => x.build && x.build.key === 'spaceship');
      return `<tr><td><i style="background:${c.color}"></i>${esc(c.name)}</td>
        <td>${bar(cultureProgress(c.id), '#c99ae6')}<span>${Math.round(c.cultureTotal)}/${cultureGoal()} · ${cultureWonders(c.id)}/${VICTORY.cultureWonders} vidundere</span></td>
        <td>${bar(ship ? 0.8 + 0.2 * ship.prod / PROJECTS.spaceship.cost : sp, '#72b6ea')}<span>${ship ? 'Bygger rumskib' : c.techs.includes('spaceflight') ? 'Kan bygge rumskib' : `${c.techs.length} teknologier`}</span></td>
        <td>${f.cands.includes(c.id) ? `<b>${f.votes[c.id]}</b>/${f.need} stemmer` : '–'}</td>
        <td>${score(c.id)}</td></tr>`;
    }).join('');
    return `<div class="vtypes">
      <div>${ART.miscGlyph('v_conquest', 28)}<b>Erobring</b><span>${victoryOn('conquest') ? `Vær den sidste stormagt tilbage. ${alive - 1} rivaler er tilbage.` : 'Slået fra i dette spil.'}</span></div>
      <div>${ART.miscGlyph('spaceship', 28)}<b>Rumskib</b><span>${victoryOn('space') ? `Forsk i Rumfart, og byg rumskibet (${buildCost({ kind: 'proj', key: 'spaceship' })} produktion).` : 'Slået fra i dette spil.'}</span></div>
      <div>${ART.miscGlyph('v_culture', 28)}<b>Kultur</b><span>${victoryOn('culture') ? `Saml ${cultureGoal().toLocaleString('da-DK')} kultur, og ej ${VICTORY.cultureWonders} vidundere.` : 'Slået fra i dette spil.'}</span></div>
      <div>${ART.miscGlyph('v_diplo', 28)}<b>Diplomati</b><span>${!victoryOn('diplo') ? 'Slået fra i dette spil.' : G.wonders.un != null ? `De Forenede Nationer er bygget af ${esc(civ(unOwner()).name)}. Næste afstemning i tur ${G.un.next || '?'}.` : 'Byg De Forenede Nationer (Computere), og vind en afstemning med flertal.'}</span></div>
      <div>${ART.miscGlyph('v_points', 28)}<b>Point</b><span>Flest point efter tur ${maxTurns()} (${PACES[G.pace || 'standard'].name.toLowerCase()} tempo). Der er ${Math.max(0, maxTurns() + 1 - G.turn)} ture tilbage.</span></div>
    </div>
    <div class="scroll-x"><table class="vtable"><thead><tr><th>Folk</th><th>Kultur</th><th>Rumkapløb</th><th>FN</th><th>Point</th></tr></thead><tbody>${rows}</tbody></table></div>
    ${unknown ? `<p class="sub">${unknown} folk, du ikke har mødt, vises ikke.</p>` : ''}`;
  },

  statsHtml() {
    this.statKey = this.statKey || 's';
    const keys = [['s', 'Point'], ['m', 'Militær'], ['k', 'Teknologier'], ['p', 'Befolkning'], ['c', 'Byer'], ['u', 'Kultur']];
    const dem = demographics(G.human);
    return `<div class="seg" id="st-keys">${keys.map(([k, n]) => `<button type="button" data-sk="${k}" class="${this.statKey === k ? 'on' : ''}">${n}</button>`).join('')}</div>
      <div class="chart">${this.chartSvg(this.statKey)}</div>
      <div class="section-h">Demografi</div>
      <div class="scroll-x"><table class="vtable"><thead><tr><th></th><th>Dig</th><th>Placering</th><th>Bedst</th><th>Gennemsnit</th><th>Dårligst</th></tr></thead><tbody>
      ${dem.map(d => `<tr><td>${d.name}</td><td><b>${d.mine.toLocaleString('da-DK')}</b></td><td>${d.rank}. af ${d.n}</td><td>${d.best.toLocaleString('da-DK')}</td><td>${d.avg.toLocaleString('da-DK')}</td><td>${d.worst.toLocaleString('da-DK')}</td></tr>`).join('')}
      </tbody></table></div>`;
  },
  bindStats(bg) { bg.querySelectorAll('[data-sk]').forEach(b => b.onclick = () => { this.statKey = b.dataset.sk; this.openRealm('stats'); }); },
  chartSvg(key, forAll) {
    const H = G.hist || [];
    if (H.length < 2) return '<p class="sub">Grafen fyldes ud, efterhånden som turene går.</p>';
    const ms = majors();
    const show = ms.map((c, n) => ({ c, n })).filter(o => forAll || o.c.id === G.human || G.met[G.human][o.c.id]);
    const W = 640, Hh = 220, pl = 44, pr = 12, pt = 10, pb = 26;
    let max = 1; for (const r of H) for (const o of show) max = Math.max(max, r[key][o.n] || 0);
    const nice = (v) => { const p = Math.pow(10, Math.floor(Math.log10(v))); const m = v / p; return (m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; };
    max = nice(max);
    const t0 = H[0].t, t1 = H[H.length - 1].t;
    const X = (t) => pl + (W - pl - pr) * (t - t0) / Math.max(1, t1 - t0);
    const Y = (v) => pt + (Hh - pt - pb) * (1 - v / max);
    const step = Math.max(1, Math.ceil(H.length / 160));
    let grid = '';
    for (let k = 0; k <= 4; k++) { const v = max * k / 4; grid += `<line x1="${pl}" x2="${W - pr}" y1="${Y(v)}" y2="${Y(v)}" class="gl"/><text x="${pl - 6}" y="${Y(v) + 4}" text-anchor="end">${Math.round(v).toLocaleString('da-DK')}</text>`; }
    grid += `<text x="${pl}" y="${Hh - 6}">Tur ${t0}</text><text x="${W - pr}" y="${Hh - 6}" text-anchor="end">Tur ${t1}</text>`;
    const lines = show.map(o => {
      const pts = H.filter((r, k) => k % step === 0 || k === H.length - 1).map(r => `${X(r.t).toFixed(1)},${Y(r[key][o.n] || 0).toFixed(1)}`).join(' ');
      const last = H[H.length - 1][key][o.n] || 0;
      return `<polyline points="${pts}" fill="none" stroke="${o.c.color}" stroke-width="${o.c.id === G.human ? 3 : 2}" stroke-linejoin="round"/><circle cx="${X(t1)}" cy="${Y(last)}" r="3.5" fill="${o.c.color}"/>`;
    }).join('');
    const legend = show.map(o => `<span><i style="background:${o.c.color}"></i>${esc(o.c.name)}</span>`).join('');
    return `<svg viewBox="0 0 ${W} ${Hh}" class="chartsvg" role="img" aria-label="Udvikling over tid">${grid}${lines}</svg><div class="legend">${legend}</div>`;
  },

  // ---------- Gemte spil ----------
  async slotSave(n) {
    const data = saveData();
    const meta = { name: `${human().name} · ${yearLabel(G.turn)}`, turn: G.turn, date: new Date().toLocaleString('da-DK'), humans: G.humans.length };
    const packed = await packSave(data);
    try { localStorage.setItem('imperium-slot-' + n, JSON.stringify({ meta, packed })); return true; } catch (e) { return false; }
  },
  slotMeta(n) { try { const s = localStorage.getItem('imperium-slot-' + n); return s ? JSON.parse(s).meta : null; } catch (e) { return null; } },
  async slotLoad(n) {
    try { const s = JSON.parse(localStorage.getItem('imperium-slot-' + n)); const data = await unpackSave(s.packed); return loadFromString(data); } catch (e) { return false; }
  },
  exportSave() {
    const blob = new Blob([saveData()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `imperium-${human().name.toLowerCase()}-tur-${G.turn}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },
  importSave(file, done) {
    const r = new FileReader();
    r.onload = () => done(loadFromString(String(r.result)));
    r.readAsText(file);
  },
  openLoad() {
    const slots = [1, 2, 3].map(n => ({ n, m: this.slotMeta(n) }));
    const bg = this.modal('Indlæs spil', `<div class="slots">${slots.map(o => `<div class="slot"><div><b>Plads ${o.n}</b><span>${o.m ? `${esc(o.m.name)} · ${esc(o.m.date)}` : 'Tom'}</span></div><button type="button" class="act primary" data-load="${o.n}" ${o.m ? '' : 'disabled'}>Indlæs</button></div>`).join('')}</div>
      <div class="section-h">Fra fil</div><p>Indlæs et spil, du har gemt som fil.</p><input type="file" id="load-file" accept=".json,application/json">
      <p class="sub" id="load-msg"></p>`);
    bg.querySelectorAll('[data-load]').forEach(b => b.onclick = async () => { if (await this.slotLoad(+b.dataset.load)) { this.closeModal(); this.enterGame(); } else bg.querySelector('#load-msg').textContent = 'Kunne ikke indlæse spillet.'; });
    bg.querySelector('#load-file').onchange = (e) => { const f = e.target.files[0]; if (f) this.importSave(f, ok => { if (ok) { this.closeModal(); this.enterGame(); } else bg.querySelector('#load-msg').textContent = 'Filen kunne ikke læses som et Imperium-spil.'; }); };
  },

  openDiplo() {
    const h = human();
    const myP = milPower(h.id);
    this.diploMsg = this.diploMsg || {};
    const tradeBlock = (c) => {
      if (!this.diploOpen[c.id]) return '';
      const msg = this.diploMsg[c.id] ? `<div class="dmsg ${this.diploMsg[c.id].ok ? 'good' : 'bad'}">${esc(this.diploMsg[c.id].text)}</div>` : '';
      const ob = hasOB(h.id, c.id), pact = hasPact(h.id, c.id);
      const others = majors().filter(t => t.alive && t.id !== h.id && t.id !== c.id && G.met[h.id][t.id] && G.met[c.id][t.id] && !atWar(c.id, t.id));
      const deals = `<div><span class="label">Aftaler</span><div class="actions-row">
          ${ob ? `<button type="button" class="act" data-deal="cancelob:${c.id}">${ART.miscGlyph('dip_ob', 16)} Opsig åbne grænser (til tur ${G.ob[h.id][c.id]})</button>` : `<button type="button" class="act" data-deal="ob:${c.id}">${ART.miscGlyph('dip_ob', 16)} Foreslå åbne grænser (30 ture)</button>`}
          ${pact ? `<button type="button" class="act" data-deal="cancelpact:${c.id}">${ART.miscGlyph('dip_pact', 16)} Opsig forsvarspagt</button>` : `<button type="button" class="act" data-deal="pact:${c.id}">${ART.miscGlyph('dip_pact', 16)} Foreslå forsvarspagt</button>`}
        </div></div>
        <div><span class="label">Gave</span><div class="actions-row">${[50, 100, 250].map(g => `<button type="button" class="act" data-mgift="${c.id}:${g}" ${h.gold >= g ? '' : 'disabled'}>${ART.miscGlyph('dip_gift', 16)} ${g} guld</button>`).join('')}</div></div>
        ${others.length ? `<div><span class="label">Fælles krig: bed ${esc(c.name)} erklære krig mod</span>${others.map(t => `<div class="actions-row"><span class="tgt"><i style="background:${t.color}"></i>${esc(t.name)}</span>${[0, 100, 250].map(g => `<button type="button" class="act" data-joint="${c.id}:${t.id}:${g}" ${h.gold >= g ? '' : 'disabled'}>${ART.miscGlyph('dip_war', 16)} ${g ? `for ${g} guld` : 'uden betaling'}</button>`).join('')}</div>`).join('')}</div>` : ''}`;
      if (!canTradeTech(h.id, c.id)) return `<div class="trade">${msg}${deals}<span class="sub">Ingen teknologihandel så kort tid efter krig.</span></div>`;
      const buy = techsFor(c, h).filter(k => aiWillSell(c, h, k));
      const sell = techsFor(h, c);
      return `<div class="trade">${msg}${deals}
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
      if (c.human) return `<div class="drow"><i style="background:${c.color}"></i><div><div class="nm">${esc(c.name)}<span class="status ${war ? 'war' : 'peace'}">${war ? 'Krig' : 'Fred'}</span><span class="chip w">Spiller</span></div>
        <div class="meta">${civCities(c.id).length} byer · militært ${mil} · ${score(c.id)} point</div></div><div class="btns">${btn}</div></div>`;
      const at = attitude(c.id, h.id), ai = attitudeInfo(at.score);
      const why = at.reasons.length ? at.reasons.map(r => `${r[1] > 0 ? '+' : ''}${r[1]} ${r[0]}`).join('\n') : 'Ingen særlige grunde endnu';
      const agr = [hasPact(h.id, c.id) ? `<span class="chip ok">${ART.miscGlyph('dip_pact', 13)} Forsvarspagt</span>` : '', hasOB(h.id, c.id) ? `<span class="chip">${ART.miscGlyph('dip_ob', 13)} Åbne grænser</span>` : ''].join('');
      const L = leaderOf(c);
      return `<div class="drow lead">${this.leaderBadge(c, 34)}<div><div class="nm">${esc(c.name)} <span class="ldr">${esc(L.title)} ${esc(L.name)} · ${esc(personality(c).name)}</span><span class="status ${war ? 'war' : 'peace'}">${war ? 'Krig' : 'Fred'}</span><span class="att ${ai.cls}" title="${esc(why)}">${ai.name} (${at.score > 0 ? '+' : ''}${at.score})</span>${agr}</div>
        <div class="meta">${civCities(c.id).length} byer · militært ${mil} · ${score(c.id)} point · ${c.techs.length} teknologier · ${esc(gov(c).name)}${c.policies && c.policies.length ? ` · ${c.policies.length} politikker` : ''}${inGoldenAge(c) ? ' · guldalder' : ''}</div>
        <div class="said">“${esc(leaderLine(c, h.id))}”</div>
        ${at.reasons.length ? `<div class="reasons">${at.reasons.slice(0, 4).map(r => `<span class="${r[1] > 0 ? 'p' : 'n'}">${r[1] > 0 ? '+' : ''}${r[1]} ${esc(r[0])}</span>`).join('')}</div>` : ''}</div>
        <div class="btns">${war ? '' : `<button type="button" class="act" data-trade="${c.id}">${this.diploOpen[c.id] ? 'Luk forhandling' : 'Forhandl'}</button>`}${btn}</div></div>${tradeBlock(c)}`;
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
        <div class="infbar"><span style="width:${clamp(inf, 0, 100)}%"></span><em style="left:30%"></em><em style="left:60%"></em></div><div class="meta">Din indflydelse: ${inf} (venner ved 30, allieret ved 60)</div>${m.quests && m.quests[h.id] ? `<div class="questline">${ART.miscGlyph('quest', 14)} Opgave: ${esc(questText(m, m.quests[h.id]))} · +${questReward(m.quests[h.id])} indflydelse · ${Math.max(0, m.quests[h.id].until - G.turn)} ture tilbage</div>` : ''}</div>
        <div class="btns">${war ? `<button type="button" class="act" data-p="${m.id}">Tilbyd fred</button>` : [50, 100, 250].map(g => `<button type="button" class="act" data-gift="${m.id}:${g}" ${h.gold >= g ? '' : 'disabled'}>Giv ${g}</button>`).join('') + `<button type="button" class="act danger" data-w="${m.id}">Erklær krig</button>`}</div></div>`;
    }).join('');
    const gp = `Næste store personlighed: ${Math.floor(h.gpp)}/${h.gpNext} point`;
    const bg = this.modal('Diplomati', `<p>Dit rige: ${civCities(h.id).length} byer, ${score(h.id)} point. Guld ${fmt(h.gold)} (${civIncome(h.id).gold >= 0 ? '+' : ''}${fmt(civIncome(h.id).gold)} pr. tur, heraf ${upkeep(h.id)} i vedligehold). ${gp}.</p>
      <div class="diplo">${rows}</div>
      ${minors.length ? `<div class="section-h">Bystater</div><div class="diplo">${mrows}</div>` : ''}
      <div class="section-h">Seneste begivenheder</div><div class="log">${(human().log || G.log).slice(-40).reverse().map(e => `<div class="${e.kind}"><em>Tur ${e.turn}</em>${esc(e.text)}</div>`).join('') || '<div>Intet endnu.</div>'}</div>`, '', true);
    const reopen = () => { const sc = bg.querySelector('.body').scrollTop; this.openDiplo(); const nb = document.querySelector('.modal-bg .body'); if (nb) nb.scrollTop = sc; this.refresh(); };
    bg.querySelectorAll('[data-trade]').forEach(b => b.onclick = () => { const id = +b.dataset.trade; this.diploOpen[id] = !this.diploOpen[id]; this.diploMsg[id] = null; reopen(); });
    const say = (id, ok, text) => { this.diploMsg[id] = { ok, text }; };
    bg.querySelectorAll('[data-deal]').forEach(b => b.onclick = () => {
      const [kind, sid] = b.dataset.deal.split(':'); const id = +sid; const c = civ(id);
      if (kind === 'cancelob') { cancelOB(h.id, id); say(id, true, 'Aftalen om åbne grænser er opsagt.'); }
      else if (kind === 'cancelpact') { cancelPact(h.id, id); say(id, true, 'Forsvarspagten er opsagt.'); }
      else {
        const r = aiAnswer(c, kind, h);
        if (r.ok) { if (kind === 'ob') signOB(h.id, id); else signPact(h.id, id); SFX.play('coin'); say(id, true, `${c.name} siger ja: ${kind === 'ob' ? 'åbne grænser i 30 ture' : 'forsvarspagt indgået'}.`); notify(h.id, kind === 'ob' ? `Åbne grænser med ${c.name} i 30 ture.` : `Forsvarspagt med ${c.name}.`, null, 'good'); }
        else say(id, false, `${c.name} siger nej. ${r.why}`);
      }
      reopen();
    });
    bg.querySelectorAll('[data-mgift]').forEach(b => b.onclick = () => {
      const [id, g] = b.dataset.mgift.split(':').map(Number);
      const v = giftMajor(h, civ(id), g);
      if (v) { SFX.play('coin'); say(id, true, `${civ(id).name} tager imod gaven (+${v} i holdning).`); }
      reopen();
    });
    bg.querySelectorAll('[data-joint]').forEach(b => b.onclick = () => {
      const [id, tid, g] = b.dataset.joint.split(':').map(Number);
      const c = civ(id), t = civ(tid);
      const r = aiAnswer(c, 'jointwar', h, { target: tid, gold: g });
      if (r.ok) {
        h.gold -= g; c.gold += g;
        declareWar(id, tid);
        remember(id, h.id, 'joint', 15, 'Kæmper sammen med os', 30);
        say(id, true, `${c.name} erklærer krig mod ${t.name}.`);
      } else say(id, false, `${c.name} siger nej. ${r.why}`);
      reopen();
    });
    bg.querySelectorAll('[data-w]').forEach(b => b.onclick = () => {
      const id = +b.dataset.w;
      if (b.dataset.sure) { declareWar(h.id, id); reopen(); return; }
      b.dataset.sure = '1'; b.textContent = 'Bekræft krig';
    });
    bg.querySelectorAll('[data-p]').forEach(b => b.onclick = () => {
      const id = +b.dataset.p;
      if (civ(id).human) { G.offers.push({ type: 'peace', from: h.id, to: id }); b.disabled = true; b.textContent = 'Tilbud sendt'; return; }
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
    this.offerNo = null;
    if (o.type === 'event') return this.showEvent(o);
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
    } else if (o.type === 'ob') {
      if (atWar(h.id, c.id) || hasOB(h.id, c.id)) return false;
      title = 'Åbne grænser'; text = `<b style="color:${c.color}">${esc(c.name)}</b> foreslår åbne grænser i 30 ture, så jeres enheder frit kan færdes på hinandens land.`;
      yes = { label: 'Accepter', go: () => { signOB(h.id, c.id); remember(c.id, h.id, 'deal', 5, 'Indgik aftaler med os', 20); } };
    } else if (o.type === 'pact') {
      if (atWar(h.id, c.id) || hasPact(h.id, c.id)) return false;
      title = 'Forsvarspagt'; text = `<b style="color:${c.color}">${esc(c.name)}</b> foreslår en forsvarspagt: hvis en af jer bliver angrebet, går den anden med i krigen.`;
      yes = { label: 'Indgå pagten', go: () => { signPact(h.id, c.id); remember(c.id, h.id, 'deal', 8, 'Indgik aftaler med os', 20); } };
    } else if (o.type === 'jointwar') {
      const t = civ(o.target);
      if (!t.alive || atWar(h.id, t.id) || !atWar(c.id, t.id) || c.gold < o.gold) return false;
      title = 'Bøn om hjælp'; text = `<b style="color:${c.color}">${esc(c.name)}</b> er i krig med <b style="color:${t.color}">${esc(t.name)}</b> og beder dig gå med i krigen. De tilbyder ${o.gold} guld.`;
      yes = { label: `Erklær krig for ${o.gold} guld`, go: () => { c.gold -= o.gold; h.gold += o.gold; declareWar(h.id, t.id); remember(c.id, h.id, 'joint', 20, 'Kæmper sammen med os', 30); } };
      this.offerNo = () => remember(c.id, h.id, 'refusedhelp', -6, 'Ville ikke hjælpe os', 20);
    } else if (o.type === 'demand') {
      if (atWar(h.id, c.id) || h.gold < o.gold) return false;
      title = 'Krav'; text = `<b style="color:${c.color}">${esc(c.name)}</b> kræver ${o.gold} guld af dig. De er militært stærkere og ikke venligt stemt. Hvis du afviser, kan det ende med krig.`;
      yes = { label: `Betal ${o.gold} guld`, go: () => { h.gold -= o.gold; c.gold += o.gold; remember(c.id, h.id, 'demand', 6, 'Gav efter for vores krav', 20); } };
      this.offerNo = () => { remember(c.id, h.id, 'refused', -15, 'Afviste vores krav', 40); if (Math.random() < 0.3) declareWar(c.id, h.id); };
    } else return false;
    const bg = this.modal(title, `${isMajor(c) && !c.human ? this.leaderQuote(c, h.id) : ''}<p>${text}</p>`,
      `<button type="button" class="act" id="o-no">Afvis</button>${yes ? `<button type="button" class="act primary" id="o-yes">${esc(yes.label)}</button>` : ''}`);
    this.afterModal = () => this.nextOffer();
    const yb = bg.querySelector('#o-yes');
    if (yb) yb.onclick = () => { yes.go(); this.closeModal(); this.refresh(); };
    bg.querySelector('#o-no').onclick = () => { if (o.type === 'peace') G.warSince[G.human][c.id] = G.turn; if (this.offerNo) this.offerNo(); this.offerNo = null; this.closeModal(); this.refresh(); };
    if (yb) { const go = yb.onclick; yb.onclick = () => { this.offerNo = null; go(); }; }
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
      <dt>Sejr</dt><dd>Erobring, rumskib, kultur (${cultureGoal().toLocaleString('da-DK')} kultur og ${VICTORY.cultureWonders} vidundere) eller diplomati (flertal i De Forenede Nationer), hvis de er slået til. Efter tur ${maxTurns()} vinder højeste pointtal. Se fremskridt under Riget → Sejr.</dd>
      <dt>Religion og fly</dt><dd>Tro fra helligdomme og templer lader dig grundlægge en religion og købe missionærer (tast P for at prædike). Fly står i byer: klik på et mål for at angribe eller på en by for at omplacere.</dd>
      <dt>Gemning</dt><dd>Spillet gemmes automatisk i denne browser efter hver tur.</dd>
    </dl>
      <div class="section-h">Gem spillet</div>
      <div class="slots">${[1, 2, 3].map(n => { const m = this.slotMeta(n); return `<div class="slot"><div><b>Plads ${n}</b><span>${m ? `${esc(m.name)} · ${esc(m.date)}` : 'Tom'}</span></div><button type="button" class="act" data-save="${n}">${m ? 'Overskriv' : 'Gem her'}</button></div>`; }).join('')}</div>
      <div class="actions-row"><button type="button" class="act" id="m-export">Gem som fil</button><button type="button" class="act" id="m-load">Indlæs …</button></div>`, `<button type="button" class="act" id="m-new">Nyt spil</button><button type="button" class="act" id="m-save">Gem nu</button><button type="button" class="act primary" id="m-close">Fortsæt</button>`);
    bg.querySelectorAll('[data-save]').forEach(b => b.onclick = async () => { const n = +b.dataset.save; if (b.dataset.sure || !this.slotMeta(n)) { b.textContent = (await this.slotSave(n)) ? 'Gemt' : 'Ikke plads'; b.disabled = true; } else { b.dataset.sure = '1'; b.textContent = 'Bekræft overskriv'; } });
    bg.querySelector('#m-export').onclick = () => this.exportSave();
    bg.querySelector('#m-load').onclick = () => this.openLoad();
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
        : o.how === 'kultur' ? `${h.name}s kunst, tro og vidundere har gjort riget til verdens kulturelle centrum i ${yearLabel(G.turn)}.`
        : o.how === 'diplomati' ? `De Forenede Nationer har valgt ${h.name} som verdensleder i ${yearLabel(G.turn)}.`
        : `Tiden er gået, og ${h.name} har flest point (${score(h.id)}).`;
    } else {
      title = 'Nederlag';
      text = o.how === 'rum' ? `${civ(o.winner).name} sendte det første rumskib af sted.` : o.how === 'kultur' ? `${civ(o.winner).name} vandt en kulturel sejr.` : o.how === 'diplomati' ? `${civ(o.winner).name} blev valgt som verdensleder i De Forenede Nationer.` : o.how === 'erobring' ? `${civ(o.winner).name} har erobret verden.` : `${civ(o.winner).name} sluttede med flest point.`;
    }
    const bg = this.modal(title, `<p>${esc(text)}</p><p>Dine point: <b>${score(h.id)}</b> · Tur ${G.turn}</p><div class="chart">${this.chartSvg('s', true)}</div>`,
      `<button type="button" class="act" id="g-look">Se kortet</button><button type="button" class="act primary" id="g-new">Nyt spil</button>`);
    bg.querySelector('#g-new').onclick = () => { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ingen lager */ } location.reload(); };
    bg.querySelector('#g-look').onclick = () => { G.explored.fill(1); updateVisibility(); this.closeModal(); this.dirty(); };
  },
};

window.addEventListener('DOMContentLoaded', () => UI.init());
