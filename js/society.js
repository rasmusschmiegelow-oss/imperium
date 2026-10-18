// Samfundspolitikker, guldalder, ledere med personlighed, opgaver fra bystater og begivenheder med valg.
'use strict';

// ---------- Samfundspolitikker ----------
const POLICY_TREES = {
  tradition: { name: 'Tradition', tech: null, icon: 'pol_tradition', desc: 'Stærk hovedstad og stabile byer.' },
  liberty: { name: 'Frihed', tech: null, icon: 'pol_liberty', desc: 'Hurtig udvidelse og flere store personligheder.' },
  honor: { name: 'Ære', tech: 'bronze', icon: 'pol_honor', desc: 'Stærkere hære og bedre kamp mod barbarer.' },
  piety: { name: 'Fromhed', tech: 'mysticism', icon: 'pol_piety', desc: 'Mere tro, kultur og tilfredshed.' },
  commerce: { name: 'Handel', tech: 'currency', icon: 'pol_commerce', desc: 'Mere guld og billigere køb.' },
  rationalism: { name: 'Rationalisme', tech: 'philosophy', icon: 'pol_rationalism', desc: 'Mere forskning.' },
};
const POLICIES = {
  trad_aristo: { tree: 'tradition', name: 'Aristokrati', desc: '+20 % produktion, når byer bygger vidundere', fx: { wonderProd: 0.2 } },
  trad_legal: { tree: 'tradition', name: 'Legalisme', desc: '+1 tilfredshed i hver by', fx: { happy: 1 } },
  trad_landed: { tree: 'tradition', name: 'Landadel', desc: '+3 mad og +2 produktion i hovedstaden', fx: { capitalFood: 3, capitalProd: 2 } },
  trad_oligarchy: { tree: 'tradition', name: 'Oligarki', desc: '+3 kultur i hovedstaden, og garnisoner forsvarer sig 25 % bedre', fx: { capitalCulture: 3, garrisonDef: 0.25 } },
  lib_collective: { tree: 'liberty', name: 'Kollektivt styre', desc: '+50 % produktion på bosættere', fx: { settlerProd: 0.5 } },
  lib_citizen: { tree: 'liberty', name: 'Borgerskab', desc: '+1 produktion i hver by', fx: { cityProd: 1 } },
  lib_republic: { tree: 'liberty', name: 'Republikanisme', desc: '+2 handel i hver by', fx: { cityTrade: 2 } },
  lib_merit: { tree: 'liberty', name: 'Meritokrati', desc: '+30 % point til store personligheder', fx: { gpRate: 0.3 } },
  hon_code: { tree: 'honor', name: 'Krigerkodeks', desc: '+10 % styrke til alle enheder', fx: { str: 0.1 } },
  hon_discipline: { tree: 'honor', name: 'Disciplin', desc: '+1 gratis enhed pr. by', fx: { freeUnits: 1 } },
  hon_hunters: { tree: 'honor', name: 'Barbarjægere', desc: '+50 % styrke mod barbarer', fx: { barbStr: 0.5 } },
  hon_caste: { tree: 'honor', name: 'Militærkaste', desc: '+1 tilfredshed i byer med garnison', fx: { garrisonHappy: 1 } },
  pie_order: { tree: 'piety', name: 'Tempelorden', desc: '+1 tro i hver by', fx: { cityFaith: 1 } },
  pie_ritual: { tree: 'piety', name: 'Ritualer', desc: '+1 tilfredshed i hver by', fx: { happy: 1 } },
  pie_reform: { tree: 'piety', name: 'Reformation', desc: '+1 kultur i hver by', fx: { cityCulture: 1 } },
  pie_tolerance: { tree: 'piety', name: 'Tolerance', desc: '+25 % tro', fx: { faithMul: 0.25 } },
  com_houses: { tree: 'commerce', name: 'Handelshuse', desc: '+15 % guld', fx: { gold: 0.15 } },
  com_mercantile: { tree: 'commerce', name: 'Merkantilisme', desc: 'Det er 25 % billigere at købe produktion', fx: { buy: -0.25 } },
  com_caravans: { tree: 'commerce', name: 'Karavanebyer', desc: '+1 handelsrute pr. by', fx: { maxRoutes: 1 } },
  com_luxury: { tree: 'commerce', name: 'Luksushandel', desc: '+2 guld i hver by', fx: { cityGold: 2 } },
  rat_academy: { tree: 'rationalism', name: 'Akademier', desc: '+15 % forskning', fx: { sci: 0.15 } },
  rat_secular: { tree: 'rationalism', name: 'Sekularisme', desc: '+1 forskning i hver by', fx: { citySci: 1 } },
  rat_humanism: { tree: 'rationalism', name: 'Humanisme', desc: '+5 forskning i hovedstaden', fx: { capitalSci: 5 } },
  rat_free: { tree: 'rationalism', name: 'Fri tanke', desc: '+15 % forskning', fx: { sci: 0.15 } },
};
const POLICY_FINISH = 'Når hele grenen er indført, begynder en guldalder.';

function policyFx(cv) {
  const fx = {};
  for (const k of (cv && cv.policies) || []) { const p = POLICIES[k]; if (p) for (const f in p.fx) fx[f] = (fx[f] || 0) + p.fx[f]; }
  return fx;
}
function treeOpen(cv, t) { const tr = POLICY_TREES[t]; return !tr.tech || cv.techs.includes(tr.tech); }
function policyCost(cv) {
  const n = (cv.policies || []).length;
  const cs = Math.max(1, civCities(cv.id).length);
  return Math.round((30 + 22 * n + 3 * Math.pow(n, 1.9)) * (1 + 0.12 * (cs - 1)) * paceK());
}
function policyOptions(cv) {
  return Object.keys(POLICIES).filter(k => !cv.policies.includes(k) && treeOpen(cv, POLICIES[k].tree));
}
function canAdoptPolicy(cv) { return isMajor(cv) && cv.polCul >= policyCost(cv) && policyOptions(cv).length > 0; }
function treeDone(cv, t) { return Object.keys(POLICIES).filter(k => POLICIES[k].tree === t).every(k => cv.policies.includes(k)); }
function adoptPolicy(cv, k) {
  if (!canAdoptPolicy(cv) || !policyOptions(cv).includes(k)) return false;
  cv.polCul -= policyCost(cv);
  cv.policies.push(k);
  cv.toldPolicy = false;
  const t = POLICIES[k].tree;
  if (treeDone(cv, t)) {
    startGoldenAge(cv, `Du har indført hele grenen ${POLICY_TREES[t].name}.`);
    notify(-1, `${cv.name} har indført alle politikker i grenen ${POLICY_TREES[t].name}.`, null, 'info');
  }
  return true;
}
function aiPolicy(cv) {
  let n = 0;
  while (canAdoptPolicy(cv) && n++ < 3) {
    const pref = personality(cv).trees;
    const opts = policyOptions(cv);
    // samme gren først, så den bliver færdig
    const started = Object.keys(POLICY_TREES).filter(t => cv.policies.some(k => POLICIES[k].tree === t) && !treeDone(cv, t));
    let pickK = null;
    for (const t of [...started.sort((a, b) => pref.indexOf(a) - pref.indexOf(b)), ...pref]) { pickK = opts.find(k => POLICIES[k].tree === t); if (pickK) break; }
    if (!pickK) pickK = opts[0];
    adoptPolicy(cv, pickK);
  }
}

// ---------- Guldalder ----------
function goldenNeed(cv) { return Math.round((500 + 400 * (cv.ga.count || 0)) * paceK()); }
function goldenTurns() { return Math.max(6, Math.round(10 * paceK())); }
function inGoldenAge(cv) { return !!(cv && cv.ga && cv.ga.left > 0); }
function startGoldenAge(cv, why) {
  cv.ga.left = (cv.ga.left || 0) + goldenTurns();
  cv.ga.count = (cv.ga.count || 0) + 1;
  notify(cv.id, `${why ? why + ' ' : ''}En guldalder begynder: +20 % produktion og guld og +2 kultur i hver by i ${cv.ga.left} ture.`, null, 'good');
  if (cv.human && typeof SFX !== 'undefined') SFX.play('tech');
}
function goldenSurplus(cid) {
  let s = 0;
  for (const c of civCities(cid)) { const h = cityHappiness(c); s += Math.max(0, h.content - c.pop); }
  return s;
}
function tickGoldenAge(cv) {
  if (cv.ga.left > 0) {
    cv.ga.left--;
    if (cv.ga.left === 0) notify(cv.id, 'Guldalderen er slut.', null, 'info');
    return;
  }
  cv.ga.pts += goldenSurplus(cv.id);
  if (cv.ga.pts >= goldenNeed(cv)) { cv.ga.pts = 0; startGoldenAge(cv, 'Dit folk er tilfreds.'); }
}

// Bidrag fra politikker, guldalder og begivenheder til en bys udbytte
function societyCity(c, cv) {
  const f = policyFx(cv);
  const ga = inGoldenAge(cv);
  const r = { f: 0, p: 0, t: 0, pm: 0, sm: f.sci || 0, gm: f.gold || 0, culture: f.cityCulture || 0, sci: f.citySci || 0, gold: f.cityGold || 0 };
  r.p += f.cityProd || 0;
  r.t += f.cityTrade || 0;
  if (c.capital) { r.f += f.capitalFood || 0; r.p += f.capitalProd || 0; r.culture += f.capitalCulture || 0; r.sci += f.capitalSci || 0; }
  if (c.build && c.build.kind === 'wonder') r.pm += f.wonderProd || 0;
  if (c.build && c.build.key === 'settler') r.pm += f.settlerProd || 0;
  if (ga) { r.pm += 0.2; r.gm += 0.2; r.culture += 2; }
  r.f += c.fertile || 0;
  return r;
}
function societyHappy(c, cv, src) {
  const f = policyFx(cv);
  if (f.happy) src.push(['Samfundspolitikker', f.happy]);
  if (f.garrisonHappy && G.units.some(u => u.civ === c.civ && u.x === c.x && u.y === c.y && isMil(u))) src.push(['Militærkaste', f.garrisonHappy]);
  if (c.appeased && c.appeased > G.turn) src.push(['Opfyldte krav', 2]);
}
function policyStrength(u, role, opp, tileI) {
  const cv = civ(u.civ);
  if (!cv || !cv.policies || !cv.policies.length) return 0;
  const f = policyFx(cv);
  let m = f.str || 0;
  if (f.barbStr && opp && opp.civ != null && civ(opp.civ).barb) m += f.barbStr;
  if (f.garrisonDef && role === 'def' && tileI != null) { const c = cityAt(tileI); if (c && c.civ === u.civ) m += f.garrisonDef; }
  return m;
}

// ---------- Ledere med personlighed ----------
const PERSONALITIES = {
  erobrer: { name: 'Erobrer', aggression: 1.5, wonder: 0.15, sciRate: 0.55, trees: ['honor', 'tradition', 'commerce', 'liberty', 'rationalism', 'piety'],
    hello: ['Vores hære er klar. Er dine?', 'Kun de stærke skriver historien.', 'Jeg respekterer styrke. Intet andet.'],
    friend: ['Du har vist dig som en værdig nabo.', 'Sammen kan ingen stoppe os.'],
    foe: ['Dine grænser er mine fremtidige marker.', 'Du burde frygte mig.'],
    war: ['Dine byer vil brænde.', 'Der bliver ingen nåde.'] },
  bygmester: { name: 'Bygmester', aggression: 0.9, wonder: 0.6, sciRate: 0.6, trees: ['tradition', 'commerce', 'rationalism', 'piety', 'liberty', 'honor'],
    hello: ['Store riger huskes for det, de byggede.', 'Mine arkitekter arbejder dag og nat.'],
    friend: ['Lad os bygge en verden, der varer.', 'Du forstår værdien af sten og tålmodighed.'],
    foe: ['Du forstyrrer mit byggeri.', 'Hold dine soldater væk fra mine bygningsværker.'],
    war: ['Du river ned, hvad andre har bygget.', 'Dine mure holder ikke.'] },
  handelsmand: { name: 'Handelsmand', aggression: 0.7, wonder: 0.3, sciRate: 0.5, trees: ['commerce', 'liberty', 'rationalism', 'tradition', 'piety', 'honor'],
    hello: ['Alt har en pris. Hvad har du at tilbyde?', 'Guld åbner flere døre end sværd.'],
    friend: ['Vores handel gør begge riger rige.', 'En god handelspartner er guld værd.'],
    foe: ['Du er dårlig for forretningen.', 'Mine købmænd stoler ikke på dig.'],
    war: ['Krig er spild af gode penge.', 'Du vil betale for det her.'] },
  videnskab: { name: 'Lærd', aggression: 0.75, wonder: 0.35, sciRate: 0.75, trees: ['rationalism', 'liberty', 'tradition', 'commerce', 'piety', 'honor'],
    hello: ['Viden er den eneste sande magt.', 'Mine lærde har spørgsmål til dine.'],
    friend: ['Lad os dele det, vi har lært.', 'Fornuften forener os.'],
    foe: ['Uvidenhed er farlig. Det er du også.', 'Du hører til i fortiden.'],
    war: ['Vores opfindelser vil afgøre krigen.', 'Du kæmper mod fremtiden.'] },
  diplomat: { name: 'Diplomat', aggression: 0.6, wonder: 0.3, sciRate: 0.6, trees: ['liberty', 'commerce', 'piety', 'tradition', 'rationalism', 'honor'],
    hello: ['Velkommen, ven. Lad os tale sammen.', 'Der er plads til os alle i verden.'],
    friend: ['Vores venskab er en gave til verden.', 'Jeg er glad for at kende dig.'],
    foe: ['Jeg er skuffet over dig.', 'Du gør det svært at være venner.'],
    war: ['Det her kunne vi have undgået.', 'Jeg vil hellere have fred, men jeg forsvarer mig.'] },
  from: { name: 'Troende', aggression: 0.85, wonder: 0.4, sciRate: 0.55, trees: ['piety', 'tradition', 'liberty', 'commerce', 'honor', 'rationalism'],
    hello: ['Guderne holder øje med os begge.', 'Må lyset vise dig vejen.'],
    friend: ['Vi er velsignet med fred.', 'Guderne smiler til vores venskab.'],
    foe: ['Din vej fører mod mørket.', 'Vend om, før det er for sent.'],
    war: ['Det er guds vilje.', 'Du vil fortryde din vantro.'] },
};
const LEADERS = {
  dk: { name: 'Harald Blåtand', title: 'Kong', p: 'from' },
  rome: { name: 'Augustus', title: 'Kejser', p: 'bygmester' },
  egypt: { name: 'Kleopatra', title: 'Dronning', p: 'handelsmand' },
  china: { name: 'Qin Shi Huang', title: 'Kejser', p: 'bygmester' },
  aztec: { name: 'Montezuma', title: 'Hersker', p: 'erobrer' },
  mongol: { name: 'Djengis Khan', title: 'Khan', p: 'erobrer' },
  greece: { name: 'Perikles', title: 'Statsmand', p: 'videnskab' },
};
function leaderOf(cv) { return (cv && LEADERS[cv.key]) || { name: cv ? cv.name : '?', title: 'Hersker', p: 'diplomat' }; }
function personality(cv) { return PERSONALITIES[(cv && cv.pers) || leaderOf(cv).p] || PERSONALITIES.diplomat; }
function leaderLine(cv, other) {
  const P = personality(cv);
  let list = P.hello;
  if (other != null && isMajor(civ(other))) {
    if (atWar(cv.id, other)) list = P.war;
    else { const s = attitude(cv.id, other).score; list = s >= 20 ? P.friend : s <= -20 ? P.foe : P.hello; }
  }
  return list[(G.turn + cv.id * 7) % list.length];
}
function leaderInitials(cv) { return leaderOf(cv).name.split(' ').map(w => w[0]).slice(0, 2).join(''); }

// ---------- Opgaver fra bystater ----------
function questDeadline() { return Math.round(30 * paceK()); }
function questNew(m, p) {
  const cap = capitalOf(m.id);
  if (!cap) return null;
  const types = [];
  const camp = G.camps.filter(k => { const [x, y] = xy(k.i); return dist(x, y, cap.x, cap.y) <= 10; }).sort((a, b) => distI(a.i, idx(cap.x, cap.y)) - distI(b.i, idx(cap.x, cap.y)))[0];
  if (camp) types.push({ type: 'camp', i: camp.i });
  const ws = Object.keys(WONDERS).filter(k => G.wonders[k] == null && (p.techs.includes(WONDERS[k].tech) || canResearch(p, WONDERS[k].tech)) && k !== 'un');
  if (ws.length) types.push({ type: 'wonder', key: pick(ws) });
  const ts = Object.keys(TECHS).filter(k => canResearch(p, k));
  if (ts.length) types.push({ type: 'tech', key: pick(ts) });
  types.push({ type: 'gold', amt: Math.round((60 + eraOf(p) * 30) / 10) * 10 });
  if (civCities(p.id).length < 12) types.push({ type: 'city', base: civCities(p.id).length });
  types.push({ type: 'culture', base: p.cultureTotal || 0, amt: Math.round((80 + eraOf(p) * 60) * paceK()) });
  const q = pick(types);
  q.until = G.turn + questDeadline();
  q.paid = 0;
  return q;
}
function questText(m, q) {
  if (q.type === 'camp') return 'Ødelæg barbarlejren i nærheden af bystaten';
  if (q.type === 'wonder') return `Byg vidunderet ${WONDERS[q.key].name}`;
  if (q.type === 'tech') return `Opdag ${TECHS[q.key].name}`;
  if (q.type === 'gold') return `Giv bystaten ${q.amt} guld (${Math.min(q.amt, q.paid)} givet)`;
  if (q.type === 'city') return 'Grundlæg en ny by';
  if (q.type === 'culture') return `Saml ${q.amt} kultur`;
  return '';
}
function questReward(q) { return q.type === 'wonder' ? 60 : q.type === 'camp' ? 45 : 40; }
function questState(m, p, q) {
  if (q.type === 'camp') {
    const gone = (G.campsGone || []).find(k => k.i === q.i);
    if (gone) return gone.by === p.id ? 'done' : 'fail';
    if (!G.camps.some(k => k.i === q.i)) return 'fail';
  } else if (q.type === 'wonder') {
    const id = G.wonders[q.key];
    if (id != null) { const c = cityById(id); return c && c.civ === p.id ? 'done' : 'fail'; }
  } else if (q.type === 'tech') { if (p.techs.includes(q.key)) return 'done'; }
  else if (q.type === 'gold') { if (q.paid >= q.amt) return 'done'; }
  else if (q.type === 'city') { if (civCities(p.id).length > q.base) return 'done'; }
  else if (q.type === 'culture') { if ((p.cultureTotal || 0) - q.base >= q.amt) return 'done'; }
  return G.turn > q.until ? 'fail' : null;
}
function processQuests() {
  const ws = majors().filter(c => c.alive);
  for (const m of G.civs) {
    if (!m.minor || !m.alive) continue;
    if (!m.quests) m.quests = {};
    for (const p of ws) {
      const q = m.quests[p.id];
      if (q) {
        const st = questState(m, p, q);
        if (st === 'done') {
          const add = questReward(q);
          m.inf[p.id] = Math.min(150, (m.inf[p.id] || 0) + add);
          notify(p.id, `Opgave løst for ${m.name}: ${questText(m, q).replace(/ \(.*\)$/, '').toLowerCase()}. +${add} indflydelse.`, null, 'good');
          delete m.quests[p.id];
        } else if (st === 'fail') {
          notify(p.id, `Opgaven for ${m.name} kan ikke længere løses.`, null, 'info');
          delete m.quests[p.id];
        } else if (q.type === 'gold' && !p.human && p.gold > q.amt + 150 && Math.random() < 0.3) {
          giftMinor(p, m, q.amt - q.paid);
        }
        continue;
      }
      if (!G.met[p.id][m.id] || atWar(p.id, m.id) || G.turn < 8) continue;
      if (Math.random() < 0.04) {
        const nq = questNew(m, p);
        if (nq) {
          m.quests[p.id] = nq;
          const cap = capitalOf(m.id);
          notify(p.id, `${m.name} beder om hjælp: ${questText(m, nq).replace(/ \(.*\)$/, '').toLowerCase()}. Belønning: +${questReward(nq)} indflydelse.`, cap ? idx(cap.x, cap.y) : null, 'info');
        }
      }
    }
  }
}
// Kaldes når en spiller giver en bystat guld
function questGift(m, p, gold) {
  const q = m.quests && m.quests[p.id];
  if (q && q.type === 'gold') q.paid += gold;
}

// ---------- Begivenheder ----------
const EVENTS = {
  plague: { title: 'Pest', icon: 'ev_plague', cond: (cv, c) => c.pop >= 4,
    text: (cv, c) => `En smitsom sygdom breder sig i ${c.name}. Folk flygter fra markederne.`,
    choices: [
      { label: () => 'Betal læger (60 guld)', ok: (cv) => cv.gold >= 60, go: (cv, c) => { cv.gold -= 60; return `Lægerne stoppede pesten i ${c.name}.`; } },
      { label: () => 'Luk byen af', go: (cv, c) => { c.pop = Math.max(1, c.pop - 1); return `${c.name} mistede en indbygger, men pesten spredte sig ikke.`; } },
    ] },
  quake: { title: 'Jordskælv', icon: 'ev_quake', cond: (cv, c) => c.blds.length >= 2,
    text: (cv, c) => `Et jordskælv har rystet ${c.name}. Flere bygninger er revnet.`,
    choices: [
      { label: () => 'Genopbyg med det samme (80 guld)', ok: (cv) => cv.gold >= 80, go: (cv, c) => { cv.gold -= 80; return `${c.name} er bygget op igen.`; } },
      { label: () => 'Lad det ligge', go: (cv, c) => { const k = pick(c.blds); c.blds = c.blds.filter(b => b !== k); return `${BUILDINGS[k].name} i ${c.name} er styrtet sammen.`; } },
    ] },
  flood: { title: 'Oversvømmelse', icon: 'ev_flood', cond: (cv, c) => cityOnRiver(c),
    text: (cv, c) => `Floden ved ${c.name} går over sine bredder.`,
    choices: [
      { label: () => 'Byg diger (byen mister sin produktion)', go: (cv, c) => { c.prod = 0; return `Digerne holdt vandet ude af ${c.name}.`; } },
      { label: () => 'Lad vandet komme (byen mister sin mad, men jorden bliver frugtbar: +1 mad for altid)', go: (cv, c) => { c.food = 0; c.fertile = (c.fertile || 0) + 1; return `Vandet har gjort jorden ved ${c.name} frugtbar.`; } },
    ] },
  scholar: { title: 'En vandrende lærd', icon: 'ev_scholar', cond: (cv) => !!cv.research,
    text: (cv, c) => `En berømt lærd er kommet til ${c.name} og søger en mæcen.`,
    choices: [
      { label: () => 'Giv ham et hjem (50 guld)', ok: (cv) => cv.gold >= 50, go: (cv) => { cv.gold -= 50; const add = Math.round(techCost(cv, cv.research) * 0.35); cv.sci += add; return `Den lærde hjælper dine forskere: +${add} forskning.`; } },
      { label: () => 'Send ham videre', go: () => 'Den lærde drog videre.' },
    ] },
  festival: { title: 'Høstfest', icon: 'ev_festival', cond: (cv) => !inGoldenAge(cv),
    text: (cv, c) => `Høsten har været god i ${c.name}, og folket vil holde fest.`,
    choices: [
      { label: () => 'Hold fest (40 guld, +80 point mod en guldalder)', ok: (cv) => cv.gold >= 40, go: (cv) => { cv.gold -= 40; cv.ga.pts += 80; return 'Festen bliver husket i årevis.'; } },
      { label: () => 'Spar pengene', go: () => 'Folket festede på egen hånd.' },
    ] },
  goldfind: { title: 'Guldfund', icon: 'ev_gold', cond: () => true,
    text: (cv, c) => `Der er fundet guld i bakkerne ved ${c.name}.`,
    choices: [
      { label: () => 'Grav det hele op (+120 guld, men uro i byen i 5 ture)', go: (cv, c) => { cv.gold += 120; c.unrest = 5; c.unrestWhy = 'Guldfeber'; return 'Statskassen er fyldt, men byen er i oprør.'; } },
      { label: () => 'Del med folket (+50 guld og +50 point mod en guldalder)', go: (cv) => { cv.gold += 50; cv.ga.pts += 50; return 'Folket hylder din gavmildhed.'; } },
    ] },
  pilgrims: { title: 'Pilgrimme', icon: 'ev_pilgrims', cond: (cv, c) => !!c.rel,
    text: (cv, c) => `Pilgrimme valfarter til ${c.name} for at besøge byens hellige steder.`,
    choices: [
      { label: () => 'Byg herberger (40 guld, +60 tro)', ok: (cv) => cv.gold >= 40, go: (cv) => { cv.gold -= 40; cv.faith += 60; return 'Pilgrimmene efterlod gaver til templerne.'; } },
      { label: () => 'Lad dem klare sig selv (+15 tro)', go: (cv) => { cv.faith += 15; return 'Nogle få pilgrimme blev.'; } },
    ] },
  rebels: { title: 'Oprør', icon: 'ev_rebels', cond: (cv, c) => (c.unhappy || 0) > 0 && c.pop >= 3,
    text: (cv, c) => `Utilfredse borgere i ${c.name} har grebet til våben.`,
    choices: [
      { label: () => 'Slå oprøret ned (oprørerne går til angreb)', go: (cv, c) => { let n = 0; for (const j of neighbors(c.x, c.y)) { if (n >= 2) break; if (landPassable(j) && !unitsAt(j).length && !cityAt(j)) { const [x, y] = xy(j); createUnit(G.barb, barbUnitType(), x, y); n++; } } return `${n} grupper af oprørere har samlet sig uden for ${c.name}.`; } },
      { label: () => 'Giv efter for kravene (60 guld, +2 tilfredshed i 10 ture)', ok: (cv) => cv.gold >= 60, go: (cv, c) => { cv.gold -= 60; c.appeased = G.turn + 10; return `Borgerne i ${c.name} har lagt våbnene.`; } },
      { label: () => 'Ignorer dem (byen mister en indbygger)', go: (cv, c) => { c.pop = Math.max(1, c.pop - 1); return `Oprørerne forlod ${c.name}.`; } },
    ] },
  inventor: { title: 'En opfinder', icon: 'ev_inventor', cond: (cv, c) => c.build && c.build.kind !== 'proj',
    text: (cv, c) => `En opfinder i ${c.name} har en idé, der kan gøre arbejdet hurtigere.`,
    choices: [
      { label: () => 'Finansier idéen (60 guld)', ok: (cv) => cv.gold >= 60, go: (cv, c) => { const add = Math.round(buildCost(c.build) * 0.4); c.prod += add; return `${c.name} får +${add} produktion til ${buildName(c.build).toLowerCase()}.`; } },
      { label: () => 'Afvis', go: () => 'Opfinderen tog sin idé med til en anden by.' },
    ] },
  refugees: { title: 'Flygtninge', icon: 'ev_refugees', cond: (cv, c) => c.pop < cityYields(c).cap,
    text: (cv, c) => `En gruppe flygtninge står ved porten til ${c.name}.`,
    choices: [
      { label: () => 'Luk dem ind (+1 indbygger, lidt uro i 4 ture)', go: (cv, c) => { c.pop++; c.unrest = Math.max(c.unrest || 0, 4); c.unrestWhy = 'Nye tilflyttere'; return `${c.name} har fået nye indbyggere.`; } },
      { label: () => 'Afvis dem', go: () => 'Flygtningene drog videre.' },
    ] },
  artist: { title: 'En berømt kunstner', icon: 'ev_artist', cond: () => true,
    text: (cv, c) => `En berømt kunstner tilbyder at skabe et mesterværk i ${c.name}.`,
    choices: [
      { label: () => 'Bestil mesterværket (70 guld, +80 kultur)', ok: (cv) => cv.gold >= 70, go: (cv, c) => { cv.gold -= 70; cv.polCul += 80; cv.cultureTotal += 80; c.culture += 20; return `Mesterværket i ${c.name} tiltrækker folk fra hele verden.`; } },
      { label: () => 'Afvis', go: () => 'Kunstneren rejste videre.' },
    ] },
};
function eventChoices(ev, cv, c) { return ev.choices.map((ch, n) => ({ n, label: ch.label(cv, c), ok: !ch.ok || ch.ok(cv, c) })); }
function rollEvent(cv) {
  if (!isMajor(cv) || G.turn < 15 || G.turn - (cv.lastEvent || 0) < 12 || Math.random() > 0.07) return;
  const cs = civCities(cv.id);
  if (!cs.length) return;
  const opts = [];
  for (const k in EVENTS) for (const c of cs) if (EVENTS[k].cond(cv, c)) opts.push([k, c]);
  if (!opts.length) return;
  const [k, c] = pick(opts);
  cv.lastEvent = G.turn;
  if (cv.human) { G.offers.push({ type: 'event', from: cv.id, to: cv.id, key: k, city: c.id }); return; }
  const ch = eventChoices(EVENTS[k], cv, c).filter(x => x.ok);
  EVENTS[k].choices[ch[0].n].go(cv, c);
}
function resolveEvent(o, n) {
  const ev = EVENTS[o.key], cv = civ(o.to), c = cityById(o.city);
  if (!ev || !c || c.civ !== cv.id) return null;
  const ch = ev.choices[n];
  if (!ch || (ch.ok && !ch.ok(cv, c))) return null;
  return ch.go(cv, c);
}

// ---------- Tur og tilstand ----------
function societyTurn(cv, culture) {
  if (!isMajor(cv)) return;
  cv.polCul += culture;
  tickGoldenAge(cv);
  if (cv.human) {
    if (canAdoptPolicy(cv) && !cv.toldPolicy) { cv.toldPolicy = true; notify(cv.id, 'Du har kultur nok til en ny samfundspolitik. Åbn Riget → Samfund.', null, 'good'); }
  } else aiPolicy(cv);
  rollEvent(cv);
}
function ensureSocietyState() {
  for (const cv of G.civs) {
    if (!isMajor(cv)) continue;
    if (!cv.policies) cv.policies = [];
    if (cv.polCul == null) cv.polCul = 0;
    if (!cv.ga) cv.ga = { pts: 0, left: 0, count: 0 };
    if (!cv.pers) {
      cv.pers = leaderOf(cv).p;
      const P = PERSONALITIES[cv.pers];
      if (!cv.human) { cv.aggression = P.aggression * (0.85 + Math.random() * 0.3); cv.sciRate = P.sciRate; }
    }
  }
  if (!G.campsGone) G.campsGone = [];
}

// Hvad lederens personlighed lægger mærke til hos andre
function personalityReasons(A, B, reasons, routes) {
  const p = A.pers;
  if (p === 'erobrer' && milPower(B.id) > milPower(A.id) * 1.3) reasons.push(['Respekterer jeres styrke', 8]);
  if (p === 'erobrer' && milPower(B.id) * 2 < milPower(A.id)) reasons.push(['Ser jer som svage', -8]);
  if (p === 'bygmester') { const wa = Object.values(G.wonders).filter(id => { const c = cityById(id); return c && c.civ === A.id; }).length, wb = Object.values(G.wonders).filter(id => { const c = cityById(id); return c && c.civ === B.id; }).length; if (wb > wa) reasons.push(['Misunder jeres vidundere', -8]); }
  if (p === 'handelsmand' && routes) reasons.push(['Godt for forretningen', 8]);
  if (p === 'videnskab' && B.techs.length > A.techs.length + 2) reasons.push(['Imponeret af jeres viden', 6]);
  if (p === 'diplomat') reasons.push(['Søger venskab', 6]);
  if (p === 'from') { const ra = civReligion(A.id), rb = civReligion(B.id); if (ra && rb) reasons.push(ra === rb ? ['Samme tro', 12] : ['Anden tro', -10]); }
}
