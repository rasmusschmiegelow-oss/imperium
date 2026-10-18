// Brugerflade til årstider, dynasti, helte, krønike, verdenskriser og eftermæle.
'use strict';

Object.assign(UI, {
  // Sne og is om vinteren, og et let skær af årstiden
  drawSeason(vis) {
    const ctx = this.ctx, s = seasonIdx();
    if (s === 3) {
      for (const i of vis) {
        if (!G.explored[i]) continue;
        const ice = iceAt(i), snow = !ice && snowAt(i);
        if (!ice && !snow) continue;
        const [cx, cy] = centerI(i);
        this.hexPath(cx, cy, S + 0.4);
        ctx.fillStyle = ice ? 'rgba(214,234,248,0.62)' : 'rgba(246,248,252,0.42)';
        ctx.fill();
        if (ice) { ctx.strokeStyle = 'rgba(150,185,210,0.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx - S * 0.45, cy - S * 0.1); ctx.lineTo(cx, cy + S * 0.15); ctx.lineTo(cx + S * 0.4, cy - S * 0.2); ctx.stroke(); }
      }
    }
    const tint = s === 0 ? 'rgba(120,210,140,0.05)' : s === 2 ? 'rgba(210,120,40,0.08)' : s === 3 ? 'rgba(150,180,220,0.07)' : null;
    if (tint) { ctx.fillStyle = tint; for (const i of vis) { const [cx, cy] = centerI(i); this.hexPath(cx, cy, S + 0.6); ctx.fill(); } }
  },
  seasonHtml() {
    const s = season();
    return `${ART.miscGlyph('season_' + s.key, 14)} ${s.name}`;
  },

  // ---------- Dynasti ----------
  dynastyHtml(cv) {
    const r = cv.ruler;
    if (!r) return '';
    const reign = G.turn - r.since;
    const left = r.life - reign;
    const health = left > 25 * paceK() ? 'Godt helbred' : left > 10 * paceK() ? 'Er ved at blive gammel' : 'Svækket af alderen';
    const chips = r.traits.map(t => `<span class="chip ${TRAITS[t].bad ? 'neg' : 'ok'}" title="${esc(TRAITS[t].desc)}">${esc(TRAITS[t].name)}</span>`).join(' ');
    const past = cv.dynasty.slice(-5).reverse().map(d => `<li><b>${esc(d.name)}</b> <span>tur ${d.from}–${d.to}</span></li>`).join('');
    const relic = cv.relic ? `<div class="relicline">${ART.miscGlyph(RELICS[cv.relic].icon, 18)} Arvestykke: <b>${esc(RELICS[cv.relic].name)}</b> · ${esc(RELICS[cv.relic].desc)}</div>` : '';
    return `<div class="dynasty"><div class="quote">${this.leaderBadge(cv, 40)}<div><b>${esc(r.name)}</b><span>Har regeret i ${reign} ${reign === 1 ? 'tur' : 'ture'} · ${health}</span><div class="traits">${chips}</div><span class="tdesc">${r.traits.map(t => esc(TRAITS[t].desc)).join(' · ')}</span></div></div>
      ${past ? `<details><summary>Tidligere herskere (${cv.dynasty.length})</summary><ul class="pastrulers">${past}</ul></details>` : ''}${relic}</div>`;
  },
  showHeir(o) {
    const cv = civ(o.to);
    if (o.to !== G.human || !cv.alive) return false;
    const cur = cv.ruler;
    const opts = o.heirs.slice(1).map((h, n) => ({ n: n + 1, h }));
    const tr = (h) => h.traits.map(t => `<span class="chip ${TRAITS[t].bad ? 'neg' : 'ok'}" title="${esc(TRAITS[t].desc)}">${esc(TRAITS[t].name)}</span>`).join(' ');
    const bg = this.modal('Tronskifte', `<div class="event">${ART.miscGlyph('leader', 54)}<p>${esc(o.old)} er død. Den ældste arving, <b>${esc(cur.name)}</b>, har taget tronen. Du kan sætte en yngre arving på tronen i stedet, men det giver arvestrid i hovedstaden i 4 ture.</p></div>
      <div class="heirs"><div class="heir on"><b>${esc(cur.name)}</b><div>${tr(cur)}</div><span>${cur.traits.map(t => esc(TRAITS[t].desc)).join(' · ')}</span><button type="button" class="act primary" data-heir="0">Behold ${esc(cur.name)}</button></div>
      ${opts.map(({ n, h }) => `<div class="heir"><b>${esc(regnalName(cv, h.base))}</b><div>${tr(h)}</div><span>${h.traits.map(t => esc(TRAITS[t].desc)).join(' · ')}</span><button type="button" class="act" data-heir="${n}">Vælg i stedet</button></div>`).join('')}</div>`, '');
    bg.querySelector('.x').hidden = true;
    bg.dataset.lock = '1';
    this.pendingEvent = o;
    this.afterModal = () => this.nextOffer();
    bg.querySelectorAll('[data-heir]').forEach(b => b.onclick = () => {
      delete bg.dataset.lock; this.pendingEvent = null;
      const n = +b.dataset.heir;
      if (n > 0) { chooseHeir(cv, o.heirs[n]); notify(cv.id, `${cv.ruler.name} er sat på tronen. Der er arvestrid i hovedstaden.`, null, 'warn'); }
      this.closeModal(); this.refresh();
    });
    return true;
  },

  // ---------- Krøniken ----------
  chronicleHtml() {
    const h = human();
    const mine = (G.chron || []).filter(e => e.civ === h.id || e.civ === -1 || (e.civ >= 0 && G.met[h.id][e.civ]));
    if (!mine.length) return '<p>Krøniken er tom endnu. Historien skrives, mens du spiller.</p>';
    const groups = [];
    for (const e of mine) {
      const g = groups[groups.length - 1];
      if (g && g.era === e.era) g.items.push(e); else groups.push({ era: e.era, items: [e] });
    }
    const heroes = G.units.filter(u => u.civ === h.id && u.hero);
    const heroHtml = heroes.length ? `<div class="section-h">Levende helte</div><div class="heroes">${heroes.map(u => `<div class="hero"><b>${ART.miscGlyph('hero', 16)} ${esc(u.hero)}</b><span>${esc(UNITS[u.type].name)} · ${u.kills || 0} sejre</span><ul>${(u.saga || []).map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>`).join('')}</div>` : '';
    const titled = civCities(h.id).filter(c => c.epithet);
    const cityHtml = titled.length ? `<div class="section-h">Byer med tilnavne</div><p>${titled.map(c => `<b>${esc(cityTitle(c))}</b>`).join(' · ')}</p>` : '';
    return `<p class="sub">Sådan vil eftertiden fortælle om ${esc(h.name)} og den verden, I lever i.</p>${heroHtml}${cityHtml}
      <div class="chronicle">${groups.reverse().map(g => `<h4>${esc(ERAS[Math.min(g.era, ERAS.length - 1)] || '')}</h4>${g.items.slice().reverse().map(e => `<p class="${e.civ === h.id ? 'own' : ''} k-${e.kind}"><em>${yearLabel(e.turn)}</em> ${esc(e.text)}</p>`).join('')}`).join('')}</div>`;
  },

  // ---------- Verdenskriser ----------
  openCrisis() {
    const c = G.crisis;
    if (!c) return;
    const C = CRISES[c.key];
    const h = human();
    const share = crisisShare();
    const mine = c.gave[h.id] || 0;
    const rows = majors().filter(x => x.alive && (x.id === h.id || G.met[h.id][x.id])).map(x => `<div class="crow"><i style="background:${x.color}"></i><span>${esc(x.name)}</span><b>${c.gave[x.id] || 0} guld</b>${(c.gave[x.id] || 0) >= share ? '<span class="chip ok">Beskyttet</span>' : ''}</div>`).join('');
    const amounts = [share - mine, share, share * 2].filter((v, n, a) => v > 0 && a.indexOf(v) === n);
    const bg = this.modal(C.name, `<div class="event">${ART.miscGlyph(C.icon, 54)}<div><p>${esc(C.text)}</p><p><b>Virkning:</b> ${esc(C.hit)} Varer ${c.left} ture endnu.</p></div></div>
      <p>Hvis alle folk tilsammen giver ${c.need} guld, slutter krisen med det samme. Den, der har givet sin andel på ${share} guld, er beskyttet mod virkningen. De andre folk husker, hvem der hjalp, og hvem der svigtede.</p>
      <div class="cbar"><span style="width:${clamp(c.pot / c.need * 100, 0, 100)}%"></span></div><p class="sub">${c.pot} af ${c.need} guld samlet. Du har givet ${mine} guld.</p>
      <div class="crows">${rows}</div>
      <div class="actions-row">${amounts.map(v => `<button type="button" class="act ${v === share - mine || v === share ? 'primary' : ''}" data-give="${v}" ${h.gold >= v ? '' : 'disabled'}>Giv ${v} guld</button>`).join('')}</div>`, '', true);
    bg.querySelectorAll('[data-give]').forEach(b => b.onclick = () => {
      if (crisisGive(h, +b.dataset.give)) { SFX.play('coin'); notify(h.id, `Du har givet ${b.dataset.give} guld til den fælles indsats mod ${C.name.toLowerCase()}.`, null, 'good'); }
      if (G.crisis) this.openCrisis(); else this.closeModal();
      this.refresh();
    });
  },

  // ---------- Eftermæle ----------
  legacyHtml(cv) {
    const r = recordLegacy(cv);
    const L = r.L;
    const cats = Object.keys(LEGACY_CATS).map(k => `<div class="lcat ${k === L.top ? 'top' : ''}"><span>${esc(LEGACY_CATS[k].name)}</span><b>${L.cats[k]}</b></div>`).join('');
    const un = (r.unlocked || []).map(k => `<div class="relicline new">${ART.miscGlyph(RELICS[k].icon, 22)} Nyt arvestykke: <b>${esc(RELICS[k].name)}</b> · ${esc(RELICS[k].desc)}</div>`).join('');
    return `<div class="epitaph">“${esc(L.epitaph)}”</div>
      <div class="section-h">Eftermæle: ${L.total} point</div><div class="lcats">${cats}<div class="lcat"><span>${L.won ? 'Sejr' : cv.alive ? 'Overlevede' : 'Faldt'}</span><b>${L.bonus}</b></div></div>
      <p class="sub">I alt i æresbogen: ${r.book.total} point fra ${r.book.games.length} ${r.book.games.length === 1 ? 'spil' : 'spil'}.</p>${un}`;
  },
  openLegacy() {
    const book = legacyBook();
    const relics = Object.keys(RELICS).map(k => { const R = RELICS[k]; const ok = book.total >= R.need; return `<div class="relic ${ok ? '' : 'locked'}">${ART.miscGlyph(R.icon, 30)}<div><b>${esc(R.name)}</b><span>${esc(R.desc)}</span><span class="need">${ok ? 'Låst op' : `Kræver ${R.need} eftermæle`}</span></div></div>`; }).join('');
    const games = book.games.map(g => `<div class="lgame"><i style="background:${g.color}"></i><div><b>${esc(g.civ)}</b> <span>${esc(g.result)} · ${esc(g.year)} · ${g.score} point${g.ruler ? ` · sidste hersker ${esc(g.ruler)}` : ''}</span><em>“${esc(g.epitaph)}”</em></div></div>`).join('');
    this.modal('Æresbogen', `<p>Hvert spil giver eftermæle efter, hvordan dit folk blev husket. Eftermælet samles på tværs af spil og låser arvestykker op, som du kan tage med ind i nye spil. Æresbogen gemmes i denne browser.</p>
      <div class="section-h">Eftermæle i alt: ${book.total}</div><div class="relics">${relics}</div>
      <div class="section-h">Tidligere spil</div>${games || '<p class="sub">Ingen spil endnu. Spil et spil til ende for at skrive det første kapitel.</p>'}`, '', true);
  },
  fillRelics() {
    const sel = $('#opt-relic');
    if (!sel) return;
    const book = legacyBook();
    sel.innerHTML = `<option value="">Intet</option>` + Object.keys(RELICS).map(k => { const R = RELICS[k]; const ok = book.total >= R.need; return `<option value="${k}" ${ok ? '' : 'disabled'}>${esc(R.name)}${ok ? '' : ` (kræver ${R.need} eftermæle)`}</option>`; }).join('');
    sel.value = 'ravne';
  },
});
