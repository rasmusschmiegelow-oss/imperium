// Brugerflade efter Paper-designet: guderne, holmgang, byens sjæl, Rådet og historiens genspil.
'use strict';

Object.assign(UI, {
  // ---------- Guderne ----------
  godTile(k, extra) {
    const D = GODS[k], col = MISC_COLOR(D.icon);
    return `<button type="button" class="mtile" data-god="${k}" style="--gc:${col}"><span class="ring">${ART.miscGlyph(D.icon, 52)}</span><b>${esc(D.name)}</b><em>${esc(D.title.split(',')[0].toLowerCase())}</em>${extra ? `<span class="tdesc">${esc(D.passive)}</span>` : ''}</button>`;
  },
  showGods(o) {
    const cv = civ(o.to);
    if (o.to !== G.human || cv.god) return false;
    const bg = this.modal('Vælg en skytsgud', `<p class="saga-lede">Dit folk søger en gud, der kan vogte over riget. Guden giver en varig fordel, og med gunst fra blot og tro kan du påkalde mirakler.</p>
      <div class="mtiles">${Object.keys(GODS).map(k => this.godTile(k, true)).join('')}</div>`, '', true);
    this.afterModal = () => this.nextOffer();
    bg.querySelectorAll('[data-god]').forEach(b => b.onclick = () => {
      if (choosePatron(cv, b.dataset.god)) { SFX.play('tech'); notify(cv.id, `${GODS[cv.god].name} er nu jeres skytsgud.`, null, 'good'); }
      this.closeModal(); this.refresh();
    });
    return true;
  },
  godsHtml() {
    const h = human();
    if (!h.god) return `<p class="saga-lede">Endnu har dit folk ingen skytsgud. Vælg den gud, der skal vogte over riget.</p><div class="mtiles">${Object.keys(GODS).map(k => this.godTile(k, true)).join('')}</div>`;
    const D = GODS[h.god], col = MISC_COLOR(D.icon);
    const mir = D.miracles.map(m => {
      const ok = miracleOk(h, m), cd = (h.cool[m.key] || 0) - G.turn;
      const btn = ok ? `<button type="button" class="act primary wide" data-mir="${m.key}">Påkald ${esc(D.name)}</button>`
        : `<button type="button" class="act wide" disabled>${cd > 0 ? `Klar igen om ${cd} ${cd === 1 ? 'tur' : 'ture'}` : `Kræver ${m.cost} gunst`}</button>`;
      return `<div class="miracle"><div class="mh"><b>${esc(m.name)}</b><span>${m.cost} gunst</span></div><p>${esc(m.desc)}</p>${btn}</div>`;
    }).join('');
    return `<div class="patron" style="--gc:${col}"><span class="ring">${ART.miscGlyph(D.icon, 60)}</span>
        <div class="pi"><span class="label">Din skytsgud</span><b>${esc(D.name)}</b><em>${esc(D.title.split(',')[0])} · ${esc(D.passive)}</em></div>
        <div class="pf"><span class="label">Gunst</span><b>${Math.floor(h.favor)}<small> / 100</small></b><span class="fbar2"><span style="width:${h.favor}%"></span></span><span class="sub">+${favorGain(h)} pr. tur fra tro</span></div></div>
      <div class="miracles">${mir}</div>
      <div class="blot"><em>Hold blot for at øge gudens gunst</em><button type="button" class="act ghost" data-blot="60" ${h.gold >= 60 ? '' : 'disabled'}>Ofr 60 guld · +20</button><button type="button" class="act ghost" data-blot="150" ${h.gold >= 150 ? '' : 'disabled'}>Ofr 150 guld · +50</button></div>`;
  },
  bindGods(bg) {
    const h = human();
    bg.querySelectorAll('[data-god]').forEach(b => b.onclick = () => { if (choosePatron(h, b.dataset.god)) SFX.play('tech'); this.openRealm('gods'); this.refresh(); });
    bg.querySelectorAll('[data-mir]').forEach(b => b.onclick = () => {
      const r = castMiracle(h, b.dataset.mir);
      if (r) { SFX.play('tech'); notify(h.id, r, null, 'good'); updateVisibility(); }
      this.openRealm('gods'); this.refresh(); this.dirty();
    });
    bg.querySelectorAll('[data-blot]').forEach(b => b.onclick = () => { const v = blot(h, +b.dataset.blot); if (v) SFX.play('coin'); this.openRealm('gods'); this.refresh(); });
  },

  // ---------- Byens sjæl ----------
  showSoul(o) {
    const c = cityById(o.city);
    if (!c || c.civ !== G.human || c.soul) return false;
    const tiles = Object.keys(SOULS).map(k => { const S0 = SOULS[k]; return `<button type="button" class="mtile" data-soul="${k}" style="--gc:${MISC_COLOR(S0.icon)}"><span class="ring">${ART.miscGlyph(S0.icon, 52)}</span><b>${esc(S0.name)}</b><span class="tdesc">${esc(S0.desc)}</span></button>`; }).join('');
    const bg = this.modal(`Byens sjæl`, `<p class="saga-lede">${esc(c.name)} er vokset til en stor by. Hvad skal den være kendt for i hele riget? Valget gælder for altid.</p><div class="mtiles">${tiles}</div>`, '', true);
    this.centerOn(idx(c.x, c.y));
    this.afterModal = () => this.nextOffer();
    bg.querySelectorAll('[data-soul]').forEach(b => b.onclick = () => {
      if (setSoul(c, b.dataset.soul)) { SFX.play('city'); notify(c.civ, `${c.name} er nu en ${SOULS[c.soul].name.toLowerCase()}.`, idx(c.x, c.y), 'good'); }
      this.closeModal(); this.refresh();
    });
    return true;
  },

  // ---------- Holmgang ----------
  champCard(u, cv, hp, mine, fallen) {
    const T = u ? UNITS[u.type] : null;
    const name = u ? (u.hero || T.name) : '–';
    const sub = u ? `${cv.adj[0].toUpperCase() + cv.adj.slice(1)} ${T.name.toLowerCase()}${u.hero ? ' · helt' : ''}` : '';
    return `<div class="champ ${mine ? 'mine' : 'foe'} ${fallen ? 'fallen' : ''}"><div class="ch"><span class="seal" style="--c:${cv.color}">${u ? ART.unitGlyph(u.type, 26, '#FFFFFF') : ''}</span><div><b>${esc(name)}</b><em>${esc(sub)}${fallen ? ' · faldet' : ''}</em></div></div>
      <div class="hp"><span class="bar"><span style="width:${clamp(hp, 0, 100)}%"></span></span><b>${Math.max(0, Math.round(hp))}</b></div></div>`;
  },
  openDuel(d) {
    const A = civ(d.a), B = civ(d.b);
    const ua = unitById(d.ua) || d.sa, ub = unitById(d.ub) || d.sb;
    const fa = d.done && !unitById(d.ua), fb = d.done && !unitById(d.ub);
    const last = d.log[d.log.length - 1];
    const stake = d.stake.kind === 'peace' ? `taberen slutter fred og betaler ${d.gold} guld` : `taberen betaler ${d.gold} guld`;
    const head = d.done ? 'Holmgangen er afgjort' : `Runde ${d.round} af 3 · ${stake}`;
    const moves = Object.keys(HOLM_MOVES).map((k, n) => `<button type="button" class="hmove ${n === 0 ? 'gilt' : ''}" data-mv="${k}"><b>${HOLM_MOVES[k].name}</b><span>${HOLM_MOVES[k].desc.toLowerCase()}</span></button>`).join('');
    let foot;
    if (d.done) {
      const res = d.result;
      const won = res.winner === G.human;
      foot = `<div class="hresult ${won ? 'won' : 'lost'}"><b>${won ? 'Sejr på holmen' : 'Nederlag på holmen'}</b><em>${won ? `Din kæmpe står tilbage. Du får ${res.gold} guld${d.stake.kind === 'peace' ? ', og der er sluttet fred' : ''}.` : `Din kæmpe er faldet. Du betaler ${res.gold} guld${d.stake.kind === 'peace' ? ', og der er sluttet fred' : ''}.`}</em><button type="button" class="hmove gilt hdone" id="h-done"><b>Afslut</b></button></div>`;
    } else foot = `<div class="hmoves">${moves}</div>`;
    const bg = this.modal('Holmgang', `<div class="duel"><p class="dhead">${esc(head)}</p>
      <div class="champs">${this.champCard(ua, A, d.ha, true, fa)}<span class="vs">mod</span>${this.champCard(ub, B, d.hb, false, fb)}</div>
      <p class="kvad">${last ? `Runde ${last.round}: ${esc(last.text)}` : 'Kæmperne træder ind i ringen af hasselstænger. Vælg dit første træk.'}</p></div>${foot}`, '', true);
    bg.querySelector('.modal').classList.add('duelwin');
    bg.dataset.lock = d.done ? '' : '1';
    if (!d.done) bg.querySelector('.x').hidden = true;
    bg.querySelectorAll('[data-mv]').forEach(b => b.onclick = () => {
      duelRound(d, b.dataset.mv);
      SFX.play(d.done ? 'tech' : 'coin');
      if (d.done) { d.result = resolveDuel(d); this.refresh(); }
      delete bg.dataset.lock; this.closeModal(true); this.openDuel(d);
    });
    const hd = bg.querySelector('#h-done');
    if (hd) hd.onclick = () => { delete bg.dataset.lock; this.closeModal(); this.refresh(); };
  },
  startHolmgang(otherId) {
    const h = human(), o = civ(otherId);
    const why = holmgangOk(h.id, otherId);
    if (why) return { ok: false, text: why };
    if (!o.human && !aiAcceptHolm(o, h.id)) {
      if (!G.holmCool) G.holmCool = {};
      G.holmCool[h.id + ':' + otherId] = G.turn + 5;
      return { ok: false, text: `${o.name} afviser udfordringen.` };
    }
    this.openDuel(newDuel(h.id, otherId));
    return { ok: true };
  },
  showHolmOffer(o) {
    const c = civ(o.from), h = human();
    if (!c.alive || holmgangOk(c.id, h.id)) return false;
    const st = holmStake(c.id, h.id);
    const bg = this.modal('Udfordring til holmgang', `${this.leaderQuote(c, h.id)}<p><b style="color:${c.color}">${esc(c.name)}</b> udfordrer dig til holmgang. ${esc(st.text)} Din bedste kæmpe møder deres.</p><p class="sub">Afviser du, kalder de dig fej, og dine krigere bliver vrede.</p>`,
      `<button type="button" class="act" id="o-no">Afvis</button><button type="button" class="act primary" id="o-yes">Tag imod</button>`);
    this.afterModal = () => this.nextOffer();
    bg.querySelector('#o-no').onclick = () => { remember(c.id, h.id, 'coward', -10, 'Afviste holmgang', 30); facAdd(h, 'warriors', -10); this.closeModal(); this.refresh(); };
    bg.querySelector('#o-yes').onclick = () => { this.afterModal = null; this.closeModal(true); this.openDuel(newDuel(h.id, c.id)); };
    return true;
  },

  // ---------- Rådet ----------
  renderCouncil() {
    const el = $('#council');
    if (!el) return;
    const h = human();
    if (this.preview || !h || !isMajor(h) || this.readOnly || (G.tutorial && G.tutorial.on && G.turn < 12)) { el.hidden = true; return; }
    const list = councilAdvice(h);
    if (!list.length) { el.hidden = true; return; }
    this.councilIdx = clamp(this.councilIdx || 0, 0, list.length - 1);
    const a = list[this.councilIdx], A = ADVISORS[a.who];
    const act = a.at != null || a.open ? `<button type="button" class="linkbtn" id="co-go">${a.open && a.open.realm ? 'Åbn' : a.open && a.open.city ? 'Åbn byen' : 'Vis på kortet'} →</button>` : '';
    el.innerHTML = `<div class="coh"><span class="label">Rådet · ${this.councilIdx + 1} af ${list.length}</span><span class="coarr"><button type="button" id="co-prev" aria-label="Forrige råd">‹</button><button type="button" id="co-next" aria-label="Næste råd">›</button></span></div>
      <div class="cob"><span class="aseal" style="--ac:${A.color}">${A.short}</span><div><b>${A.name}</b><q>${esc(a.text)}</q>${act}</div></div>`;
    el.hidden = false;
    el.querySelector('#co-prev').onclick = () => { this.councilIdx = (this.councilIdx - 1 + list.length) % list.length; this.renderCouncil(); };
    el.querySelector('#co-next').onclick = () => { this.councilIdx = (this.councilIdx + 1) % list.length; this.renderCouncil(); };
    const go = el.querySelector('#co-go');
    if (go) go.onclick = () => {
      if (a.at != null) this.centerOn(a.at);
      const o = a.open || {};
      if (o.city) { const c = cityById(o.city); if (c) this.openCity(c); }
      else if (o.realm) this.openRealm(o.realm);
      else if (o.tab === 'diplo') this.openDiplo();
      else if (o.crisis) this.openCrisis();
      else if (o.unit) { const u = unitById(o.unit); if (u) this.select(u); }
      this.dirty();
    };
  },

  // ---------- Historiens genspil ----------
  openReplay() {
    const R = G.replay;
    if (!R || !R.frames.length) { notify(G.human, 'Der er ingen historie at vise endnu.', null, 'info'); return; }
    const bg = this.modal('Historien udfolder sig', `<div class="replay"><div class="rp-top"><span></span><div class="rp-year"><b id="rp-y"></b><em id="rp-e"></em></div></div>
      <canvas id="rp-c" width="1040" height="460" aria-label="Kort over historien"></canvas>
      <p class="kvad" id="rp-k"></p>
      <div class="rp-ctl"><button type="button" class="rp-play" id="rp-p" aria-label="Afspil eller pause"></button>
        <div class="rp-track"><input type="range" id="rp-s" min="0" max="${R.frames.length - 1}" value="0" aria-label="Tid"><div class="rp-eras">${ERAS.map((e, n) => `<span data-era="${n}">${esc(e)}</span>`).join('')}</div></div>
        <div class="rp-speed"><button type="button" data-sp="1" class="on">1×</button><button type="button" data-sp="3">3×</button></div></div></div>`, '', true);
    bg.querySelector('.modal').classList.add('replaywin');
    const cv = bg.querySelector('#rp-c'), ctx = cv.getContext('2d');
    const own = new Array(G.tiles.length).fill(-1);
    const cities = [];
    let at = -1, timer = null, speed = 1;
    const cs = Math.min(1040 / (G.w + 0.5), 460 / (G.h * 0.87 + 0.5));
    const ox = (1040 - cs * (G.w + 0.5)) / 2, oy = (460 - cs * (G.h * 0.87 + 0.5)) / 2;
    const landCol = (t) => TERRAIN[t].water ? '#0F2436' : t === 'snow' || t === 'tundra' ? '#4E585C' : t === 'desert' ? '#6E6440' : t === 'mountain' ? '#3E4440' : t === 'hills' ? '#4A5C34' : '#3E5A33';
    const apply = (k) => {
      if (k < at) { own.fill(-1); cities.length = 0; at = -1; }
      for (let f = at + 1; f <= k; f++) { const F = R.frames[f]; for (let j = 0; j < F.d.length; j += 2) own[F.d[j]] = F.d[j + 1]; for (const c of F.c || []) cities.push(c); }
      at = k;
    };
    const seen = G.over ? null : (G.exploredBy[G.human] || G.explored);
    const draw = () => {
      ctx.fillStyle = '#0F2436'; ctx.fillRect(0, 0, 1040, 460);
      for (let i = 0; i < G.tiles.length; i++) {
        const x = i % G.w, y = Math.floor(i / G.w);
        const px = ox + (x + (y & 1) * 0.5) * cs, py = oy + y * cs * 0.87;
        if (seen && !seen[i]) { ctx.fillStyle = '#0a0d10'; ctx.fillRect(px, py, cs + 0.6, cs * 0.87 + 0.6); continue; }
        ctx.fillStyle = landCol(G.tiles[i].t); ctx.fillRect(px, py, cs + 0.6, cs * 0.87 + 0.6);
        const o = own[i];
        if (o >= 0 && G.civs[o]) { ctx.globalAlpha = 0.62; ctx.fillStyle = G.civs[o].color; ctx.fillRect(px, py, cs + 0.6, cs * 0.87 + 0.6); ctx.globalAlpha = 1; }
      }
      ctx.fillStyle = '#FFF5E6';
      for (const [i] of cities) { if (seen && !seen[i]) continue; const x = i % G.w, y = Math.floor(i / G.w); ctx.beginPath(); ctx.arc(ox + (x + (y & 1) * 0.5 + 0.5) * cs, oy + (y + 0.5) * cs * 0.87, Math.max(2, cs * 0.42), 0, 7); ctx.fill(); }
    };
    const show = (k) => {
      apply(k); draw();
      const t = R.frames[k].t;
      const past = (G.chron || []).filter(e => e.turn <= t);
      const era = past.reduce((m, e) => Math.max(m, e.era || 0), 0);
      bg.querySelector('#rp-y').textContent = yearLabel(t);
      bg.querySelector('#rp-e').textContent = `${ERAS[Math.min(era, ERAS.length - 1)]} · tur ${t}`;
      const cap = past.filter(e => ['war', 'wonder', 'ruler', 'crisis', 'legend', 'hero', 'golden', 'faith', 'city'].includes(e.kind)).slice(-1)[0];
      bg.querySelector('#rp-k').textContent = cap ? `“${cap.text}”` : '“I begyndelsen var verden stille.”';
      bg.querySelectorAll('[data-era]').forEach(s => s.classList.toggle('on', +s.dataset.era === era));
      bg.querySelector('#rp-s').value = k;
    };
    const setPlay = (on) => {
      clearInterval(timer); timer = null;
      bg.querySelector('#rp-p').innerHTML = on ? '<svg width="18" height="18" viewBox="0 0 18 18"><path d="M5 3 V15 M13 3 V15" stroke="#1A1408" stroke-width="3" stroke-linecap="round"/></svg>' : '<svg width="18" height="18" viewBox="0 0 18 18"><path d="M5 2 L15 9 L5 16 Z" fill="#1A1408"/></svg>';
      if (on) timer = setInterval(() => { if (!document.body.contains(cv)) { clearInterval(timer); return; } if (at >= R.frames.length - 1) { setPlay(false); return; } show(Math.min(R.frames.length - 1, at + speed)); }, 110);
    };
    bg.querySelector('#rp-p').onclick = () => setPlay(!timer);
    bg.querySelector('#rp-s').oninput = (e) => { setPlay(false); show(+e.target.value); };
    bg.querySelectorAll('[data-sp]').forEach(b => b.onclick = () => { speed = +b.dataset.sp; bg.querySelectorAll('[data-sp]').forEach(x => x.classList.toggle('on', x === b)); });
    show(0); setPlay(true);
  },
});

// Farven på et ikon fra grafikarket
function MISC_COLOR(key) {
  const m = ART.miscGlyph(key, 10).match(/stroke="(#[0-9A-Fa-f]{3,8})"/);
  return m ? m[1] : '#E2B65C';
}
