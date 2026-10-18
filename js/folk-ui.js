// Brugerflade til profetier, faktioner, togter og sagnsteder, runesten og skjalden.
'use strict';

Object.assign(UI, {
  // ---------- Folket: profeti og faktioner ----------
  folkHtml() {
    const h = human();
    const p = h.prophecy;
    const proph = p
      ? `<div class="ga">${ART.miscGlyph('oracle', 30)}<div><b>Oraklets spådom: ${esc(prophecyText(p))}</b><span>${Math.max(0, p.until - G.turn)} ture tilbage · belønning: ${esc(BOONS[p.reward].name.toLowerCase())}</span></div></div>`
      : `<div class="ga">${ART.miscGlyph('oracle', 30)}<div><b>Ingen spådom lige nu</b><span>Oraklet taler, når dit folk træder ind i en ny tidsalder.</span></div></div>`;
    const rows = Object.keys(FACTIONS).map(k => {
      const F = FACTIONS[k], v = h.fac.l[k], m = factionMood(v), tgt = factionTarget(h, k);
      const rs = factionReasons(h, k);
      const trend = tgt > v + 2 ? '↑' : tgt < v - 2 ? '↓' : '→';
      return `<div class="faction ${m}"><div class="fh">${ART.miscGlyph(F.icon, 28)}<div><b>${esc(F.name)}</b><span>${m === 'loyal' ? `Loyale: ${esc(F.loyal.desc)}` : m === 'angry' ? `Utilfredse: ${esc(F.angry.desc)}` : 'Afventende'}</span></div><em>${Math.round(v)} ${trend}</em></div>
        <div class="fbar"><span style="width:${v}%"></span><i style="left:30%"></i><i style="left:70%"></i></div>
        <div class="reasons">${rs.length ? rs.map(r => `<span class="${r[1] > 0 ? 'p' : 'n'}">${r[1] > 0 ? '+' : ''}${r[1]} ${esc(r[0])}</span>`).join('') : '<span>Ingen særlige grunde</span>'}</div>
        <div class="sub">Ønsker ${esc(F.likes)}.</div></div>`;
    }).join('');
    return `${proph}<p>Fire magtgrupper holder øje med alt, hvad du gør. Over 70 er de loyale og giver en fordel. Under 30 er de utilfredse og koster dig noget. Falder de under 15, kommer der en krise.</p><div class="factions">${rows}</div>`;
  },
  showProphecy(o) {
    const cv = civ(o.to);
    if (o.to !== G.human || cv.prophecy) return false;
    const bg = this.modal('Oraklet taler', `<div class="event">${ART.miscGlyph('oracle', 54)}<p>Dit folk er trådt ind i en ny tid, og oraklet har set tre mulige fremtider. Vælg den spådom, du vil forsøge at opfylde. Lykkes det, giver guderne en gave. Slår den fejl, rammes du af oraklets vrede.</p></div>
      <div class="evchoices">${o.options.map((p, n) => `<button type="button" class="act ${n === 0 ? 'primary' : ''}" data-pr="${n}"><b>${esc(prophecyText(p))}</b><br><span class="sub">${p.turns} ture · gave: ${esc(BOONS[p.reward].name.toLowerCase())}</span></button>`).join('')}
      <button type="button" class="act" data-pr="-1">Lyt ikke til oraklet</button></div>`, '');
    this.afterModal = () => this.nextOffer();
    bg.querySelectorAll('[data-pr]').forEach(b => b.onclick = () => {
      const n = +b.dataset.pr;
      if (n >= 0) { acceptProphecy(cv, o.options[n]); notify(cv.id, `Spådom: ${prophecyText(o.options[n])} Du har ${o.options[n].turns} ture.`, null, 'info'); }
      this.closeModal(); this.refresh();
    });
    return true;
  },

  // ---------- Togter og sagnsteder ----------
  legendsHtml() {
    const h = human();
    const ex = h.exp ? `<div class="ga on">${ART.miscGlyph('leg_compass', 30)}<div><b>Togt mod ${esc(LEGENDS[h.exp.key].name)}</b><span>Fremme om ${h.exp.left} ${h.exp.left === 1 ? 'tur' : 'ture'} · risiko ${Math.round(h.exp.risk * 100)} %</span></div></div>` : '';
    const rows = Object.keys(LEGENDS).filter(k => G.legends[k]).map(k => {
      const D = LEGENDS[k], L = G.legends[k], r = h.rumors[k];
      let status, btn = '';
      if (L.found != null) status = L.found === h.id ? '<span class="chip ok">Fundet af dig</span>' : G.met[h.id][L.found] ? `<span class="chip neg">Fundet af ${esc(civ(L.found).name)}</span>` : '<span class="chip neg">Fundet af et fremmed folk</span>';
      else if (r) {
        const cap = capitalOf(h.id);
        status = cap ? `<span class="chip w">Rygte: ${distWord(distI(idx(cap.x, cap.y), L.i))} mod ${dirTo(idx(cap.x, cap.y), L.i)}</span>` : '<span class="chip w">Rygte</span>';
        const cost = expeditionCost(h, k);
        const why = h.exp ? 'Du har allerede et togt undervejs' : D.sea && !h.techs.includes('sailing') ? 'Kræver Sejlads' : h.gold < cost ? `Kræver ${cost} guld` : '';
        btn = `<button type="button" class="act ${why ? '' : 'primary'}" data-exp="${k}" ${why ? 'disabled' : ''} title="${esc(why)}">Send togt (${cost} guld)</button><button type="button" class="act" data-look="${r.area}">Vis området</button>`;
      } else status = '<span class="chip">Ukendt</span>';
      return `<div class="lgd ${L.found != null ? 'found' : ''}">${ART.miscGlyph(D.icon, 30)}<div><b>${esc(r || L.found != null ? D.name : 'Et ukendt sagnsted')}</b><span>${esc(r || L.found != null ? D.desc : 'Rygterne har endnu ikke nået dig.')}</span><div>${status}</div></div><div class="btns">${btn}</div></div>`;
    }).join('');
    return `${ex}<p>Verden gemmer på sagnsteder. Rygter fortæller med tiden, i hvilken retning de ligger, og søgeområdet vises på kortet. Find dem med en enhed, eller send et togt. Det tager nogle ture, og der kan ske meget undervejs. Den, der kommer først, får gaven.</p><div class="legends">${rows}</div>`;
  },
  bindLegends(bg) {
    const h = human();
    bg.querySelectorAll('[data-exp]').forEach(b => b.onclick = () => { if (sendExpedition(h, b.dataset.exp)) { SFX.play('coin'); notify(h.id, `Et togt er sendt af sted mod ${LEGENDS[b.dataset.exp].name}.`, null, 'good'); } this.openRealm('legends'); this.refresh(); });
    bg.querySelectorAll('[data-look]').forEach(b => b.onclick = () => { this.closeModal(); this.centerOn(+b.dataset.look); this.dirty(); });
  },
  drawRumors() {
    const h = human();
    if (!h || !h.rumors) return;
    const ctx = this.ctx;
    for (const k in h.rumors) {
      const L = G.legends[k];
      if (!L || L.found != null) continue;
      const i = h.rumors[k].area;
      if (!this.inView(i)) continue;
      const [cx, cy] = centerI(i);
      ctx.save();
      ctx.setLineDash([6, 6]); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(234,208,151,0.75)';
      ctx.beginPath(); ctx.arc(cx, cy, S * SQ3 * 3.4, 0, 7); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = `700 ${clamp(12 / this.cam.z, 9, 20)}px "Alegreya Sans", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10,13,18,0.85)'; ctx.fillStyle = '#EAD097';
      const label = `Rygte: ${LEGENDS[k].name}`;
      ctx.strokeText(label, cx, cy - S * SQ3 * 3.4 - 8); ctx.fillText(label, cx, cy - S * SQ3 * 3.4 - 8);
      ctx.restore();
    }
  },
  drawLegend(i, t, cx, cy) {
    const L = G.legends && G.legends[t.legend];
    if (!L || L.found == null) return;
    const ctx2 = this.ctx;
    ctx2.fillStyle = 'rgba(15,19,26,0.88)'; ctx2.beginPath(); ctx2.arc(cx, cy, S * 0.5, 0, 7); ctx2.fill();
    ctx2.strokeStyle = '#F2C14E'; ctx2.lineWidth = 2.2; ctx2.stroke();
    ART.misc(ctx2, LEGENDS[t.legend].icon, cx, cy, S * 0.66);
    if (this.cam.z > 0.8) {
      const fs = clamp(11 / this.cam.z, 8, 16);
      ctx2.font = `700 ${fs}px "Alegreya Sans", sans-serif`; ctx2.textAlign = 'center'; ctx2.textBaseline = 'middle';
      ctx2.lineWidth = 3; ctx2.strokeStyle = 'rgba(10,13,18,0.85)'; ctx2.fillStyle = '#F2C14E';
      ctx2.strokeText(LEGENDS[t.legend].name, cx, cy + S * 0.75); ctx2.fillText(LEGENDS[t.legend].name, cx, cy + S * 0.75);
    }
  },

  // ---------- Runesten ----------
  runeHtml(c) {
    const h = human();
    if (c.rune) return `<div class="rune"><div class="runes">${esc(toRunes(c.rune.text))}</div><div class="rtext">“${esc(c.rune.text)}”</div><span class="sub">Rejst af ${esc(c.rune.ruler)} i ${yearLabel(c.rune.turn)} · +2 kultur og +1 tilfredshed</span></div>`;
    if (!h.techs.includes('writing')) return '<p class="hint-s">Med Skrift kan du rejse en runesten med din egen indskrift. Den giver +2 kultur og +1 tilfredshed i byen.</p>';
    const cost = runeCost(h);
    return `<p class="hint-s">Rejs en runesten med din egen indskrift. Den giver +2 kultur og +1 tilfredshed i byen.</p><button type="button" class="act ${h.gold >= cost ? 'primary' : ''}" id="rune-open" ${h.gold >= cost ? '' : 'disabled'}>Rejs en runesten (${cost} guld)</button>`;
  },
  openRune(c) {
    const h = human();
    const sug = runeSuggestion(h, c);
    const bg = this.modal('Rejs en runesten', `<p>Skriv, hvad stenen skal fortælle eftertiden. Højst 120 tegn.</p>
      <textarea id="rune-text" maxlength="120" rows="3">${esc(sug)}</textarea>
      <div class="rune preview"><div class="runes" id="rune-prev">${esc(toRunes(sug))}</div></div>`,
      `<button type="button" class="act" id="rune-cancel">Fortryd</button><button type="button" class="act primary" id="rune-ok">Rejs stenen (${runeCost(h)} guld)</button>`);
    const ta = bg.querySelector('#rune-text');
    ta.addEventListener('keydown', e => e.stopPropagation());
    ta.oninput = () => { bg.querySelector('#rune-prev').textContent = toRunes(ta.value); };
    bg.querySelector('#rune-cancel').onclick = () => this.closeModal();
    bg.querySelector('#rune-ok').onclick = () => {
      if (raiseRune(h, c, ta.value)) { SFX.play('city'); notify(h.id, `En runesten er rejst i ${c.name}.`, idx(c.x, c.y), 'good'); }
      this.closeModal(); this.refresh();
    };
  },

  // ---------- Skjalden ----------
  skaldPrefs() { try { return Object.assign({ cards: true, voice: false }, JSON.parse(localStorage.getItem('imperium-skald') || '{}')); } catch (e) { return { cards: true, voice: false }; } },
  setSkald(k, v) { const p = this.skaldPrefs(); p[k] = v; try { localStorage.setItem('imperium-skald', JSON.stringify(p)); } catch (e) { /* ingen lager */ } },
  skaldCheck() {
    if (this.preview || !G || !G.chron) return;
    const h = human();
    if (!h || !isMajor(h)) return;
    if (h.chronSeen == null) { h.chronSeen = G.chronId || 0; return; }
    if ((G.chronId || 0) <= h.chronSeen) return;
    const BIG = { ruler: 'Tronskifte', hero: 'Kvadet om en helt', wonder: 'Et vidunder', crisis: 'Verdenskrise', city: 'Et tilnavn', prophecy: 'Oraklet', legend: 'Sagnsted', golden: 'Guldalder', war: 'Krig', era: 'En ny tidsalder' };
    const fresh = G.chron.filter(e => e.id > h.chronSeen && BIG[e.kind] && (e.civ === h.id || e.about === h.id || e.kind === 'crisis' || (e.kind === 'legend' && / fandt /.test(e.text)) || (e.kind === 'wonder' && G.met[h.id][e.civ])));
    h.chronSeen = G.chronId;
    if (!this.skaldPrefs().cards && !this.skaldPrefs().voice) return;
    this.skaldQ = (this.skaldQ || []).concat(fresh.slice(-4).map(e => ({ title: e.kind === 'city' && !/tilnavnet/.test(e.text) ? 'En ny by' : BIG[e.kind], text: e.text, turn: e.turn, kind: e.kind })));
    if (!this.skaldBusy) this.skaldNext();
  },
  skaldNext() {
    const q = this.skaldQ || [];
    let el = $('#saga-card');
    if (!q.length) { this.skaldBusy = false; if (el) el.hidden = true; return; }
    this.skaldBusy = true;
    const it = q.shift();
    const pr = this.skaldPrefs();
    if (pr.cards) {
      if (!el) { el = document.createElement('div'); el.id = 'saga-card'; el.setAttribute('role', 'status'); document.body.appendChild(el); el.onclick = () => { clearTimeout(this.skaldT); this.skaldNext(); }; }
      el.className = 'k-' + it.kind;
      el.innerHTML = `<div class="sc-runes">${esc(toRunes(it.title))}</div><h3>${esc(it.title)}</h3><p>${esc(it.text)}</p><em>${yearLabel(it.turn)} · klik for at gå videre</em>`;
      el.hidden = false;
    }
    if (pr.voice) this.speak(it.text);
    clearTimeout(this.skaldT);
    this.skaldT = setTimeout(() => this.skaldNext(), 6500);
  },
  speak(text) {
    try {
      if (!('speechSynthesis' in window)) return;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'da-DK'; u.rate = 0.95; u.pitch = 0.9;
      const v = speechSynthesis.getVoices().find(x => /^da/i.test(x.lang));
      if (v) u.voice = v;
      speechSynthesis.speak(u);
    } catch (e) { /* ingen tale */ }
  },
});
