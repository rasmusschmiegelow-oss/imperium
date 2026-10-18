// Brugerflade til samfundspolitikker, guldalder, ledere, opgaver og begivenheder.
'use strict';

Object.assign(UI, {
  leaderBadge(cv, size) {
    return `<span class="leader-badge" style="--c:${cv.color};width:${size || 34}px;height:${size || 34}px;font-size:${Math.round((size || 34) * 0.38)}px">${esc(leaderInitials(cv))}</span>`;
  },
  leaderQuote(cv, other) {
    const L = leaderOf(cv);
    return `<div class="quote">${this.leaderBadge(cv, 30)}<div><q>${esc(leaderLine(cv, other))}</q><span>${esc(L.title)} ${esc(L.name)} · ${esc(personality(cv).name)}</span></div></div>`;
  },

  societyHtml() {
    const h = human();
    const L = leaderOf(h);
    const cost = policyCost(h);
    const ready = canAdoptPolicy(h);
    const gaOn = inGoldenAge(h);
    const need = goldenNeed(h);
    const surplus = goldenSurplus(h.id);
    const ga = gaOn
      ? `<div class="ga on">${ART.miscGlyph('golden', 30)}<div><b>Guldalder: ${h.ga.left} ${h.ga.left === 1 ? 'tur' : 'ture'} tilbage</b><span>+20 % produktion og guld og +2 kultur i hver by.</span></div></div>`
      : `<div class="ga">${ART.miscGlyph('golden', 30)}<div><b>Guldalder: ${Math.floor(h.ga.pts)}/${need} point</b><span class="bar"><span style="width:${clamp(h.ga.pts / need * 100, 0, 100)}%"></span></span><span>Overskud af tilfredshed giver point (+${surplus} pr. tur nu). En guldalder giver +20 % produktion og guld i ${goldenTurns()} ture.</span></div></div>`;
    const trees = Object.keys(POLICY_TREES).map(t => {
      const tr = POLICY_TREES[t];
      const open = treeOpen(h, t);
      const done = treeDone(h, t);
      const items = Object.keys(POLICIES).filter(k => POLICIES[k].tree === t).map(k => {
        const p = POLICIES[k];
        const has = h.policies.includes(k);
        return `<li class="${has ? 'has' : ''}"><div><b>${esc(p.name)}</b><span>${esc(p.desc)}</span></div>${has ? '<span class="chip ok">Indført</span>' : open ? `<button type="button" class="act ${ready ? 'primary' : ''}" data-pol="${k}" ${ready ? '' : 'disabled'}>Indfør</button>` : ''}</li>`;
      }).join('');
      return `<div class="poltree ${open ? '' : 'locked'} ${done ? 'done' : ''}"><div class="pth">${ART.miscGlyph(tr.icon, 26)}<div><b>${esc(tr.name)}</b><span>${open ? esc(tr.desc) : `Kræver ${esc(TECHS[tr.tech].name)}`}</span></div>${done ? '<span class="chip w">Fuldført</span>' : ''}</div><ul>${items}</ul></div>`;
    }).join('');
    return `<div class="quote">${this.leaderBadge(h, 34)}<div><b>${esc(L.title)} ${esc(L.name)}</b><span>Du leder ${esc(h.name)}.</span></div></div>
      <p>Kultur fra dine byer giver samfundspolitikker. ${ready ? `<b class="good">Du kan indføre en politik nu.</b>` : `Næste politik: ${Math.floor(h.polCul)}/${cost} kultur.`} Prisen stiger for hver politik og med antallet af byer. ${POLICY_FINISH}</p>
      ${ga}<div class="poltrees">${trees}</div>`;
  },
  bindSociety(bg) {
    const h = human();
    bg.querySelectorAll('[data-pol]').forEach(b => b.onclick = () => {
      if (adoptPolicy(h, b.dataset.pol)) { SFX.play('tech'); notify(h.id, `Ny samfundspolitik: ${POLICIES[b.dataset.pol].name}.`, null, 'good'); }
      const sc = bg.querySelector('.body').scrollTop;
      this.openRealm('society');
      const nb = document.querySelector('.modal-bg .body'); if (nb) nb.scrollTop = sc;
      this.refresh();
    });
  },

  // Returnerer true, hvis begivenheden blev vist
  showEvent(o) {
    const ev = EVENTS[o.key], cv = civ(o.to), c = cityById(o.city);
    if (!ev || !c || c.civ !== cv.id || o.to !== G.human) return false;
    const chs = eventChoices(ev, cv, c);
    const bg = this.modal(ev.title, `<div class="event">${ART.miscGlyph(ev.icon, 54)}<p>${esc(ev.text(cv, c))}</p></div><div class="evchoices">${chs.map(ch => `<button type="button" class="act ${ch.n === 0 ? 'primary' : ''}" data-ev="${ch.n}" ${ch.ok ? '' : 'disabled'}>${esc(ch.label)}</button>`).join('')}</div>`, '');
    bg.querySelector('.x').hidden = true;
    bg.dataset.lock = '1';
    this.pendingEvent = o;
    this.centerOn(idx(c.x, c.y));
    this.afterModal = () => this.nextOffer();
    bg.querySelectorAll('[data-ev]').forEach(b => b.onclick = () => {
      delete bg.dataset.lock; this.pendingEvent = null;
      const r = resolveEvent(o, +b.dataset.ev);
      if (r) notify(cv.id, `${ev.title}: ${r}`, idx(c.x, c.y), 'info');
      this.closeModal(); this.refresh();
    });
    return true;
  },
});
