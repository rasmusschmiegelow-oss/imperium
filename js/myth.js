// Gudernes gunst og mirakler, holmgang, byens sjæl, Rådet og historiens genspil.
'use strict';

// ---------- Gudernes gunst ----------
const GODS = {
  odin: { name: 'Odin', title: 'Visdommens gud', icon: 'god_odin', passive: '+10 % forskning', fx: { sci: 0.1 }, pers: ['videnskab', 'bygmester'],
    miracles: [
      { key: 'ravne', name: 'Huginn og Muninn', cost: 35, desc: 'Ravnene afslører landet i 9 felters afstand fra alle dine byer.' },
      { key: 'kilde', name: 'Mimers brønd', cost: 60, desc: 'Giver forskning svarende til 40 % af dit nuværende emne.' } ] },
  thor: { name: 'Thor', title: 'Tordenguden', icon: 'god_thor', passive: '+10 % styrke', fx: { str: 0.1 }, pers: ['erobrer'],
    miracles: [
      { key: 'torden', name: 'Tordenvejr', cost: 50, desc: 'Lyn rammer alle fjendtlige enheder inden for 3 felter af dine byer (−35 liv).' },
      { key: 'mjolner', name: 'Mjølners slag', cost: 40, desc: 'Fjender ved siden af dine enheder mister 25 liv.' } ] },
  frej: { name: 'Frej', title: 'Frugtbarhedens gud', icon: 'god_frej', passive: '+1 mad i alle byer', fx: { cityFood: 1 }, pers: ['diplomat', 'handelsmand'],
    miracles: [
      { key: 'host', name: 'Rig høst', cost: 40, desc: 'Alle byer får fyldt halvdelen af deres madlager.' },
      { key: 'fred', name: 'Fredens velsignelse', cost: 55, desc: '+2 tilfredshed i alle byer i 12 ture.' } ] },
  njord: { name: 'Njord', title: 'Havets og vindens gud', icon: 'god_njord', passive: '+10 % guld', fx: { gold: 0.1 }, pers: ['handelsmand'],
    miracles: [
      { key: 'medvind', name: 'Medvind', cost: 30, desc: 'Alle dine enheder får +2 bevægelse i denne tur.' },
      { key: 'gaver', name: 'Havets gaver', cost: 45, desc: '+120 guld fra havet.' } ] },
  tyr: { name: 'Tyr', title: 'Edernes gud', icon: 'god_tyr', passive: 'Byer forsvarer sig 20 % bedre', fx: { garrisonDef: 0.2 }, pers: ['erobrer', 'diplomat'],
    miracles: [
      { key: 'ed', name: 'Tyrs ed', cost: 40, desc: 'Alle dine enheder heles helt.' },
      { key: 'glod', name: 'Kampglød', cost: 50, desc: '+25 % styrke til alle dine enheder i 4 ture.' } ] },
  loke: { name: 'Loke', title: 'Listens gud', icon: 'god_loke', passive: '+10 % guld og forskning', fx: { gold: 0.05, sci: 0.05 }, pers: ['handelsmand', 'from'],
    miracles: [
      { key: 'blaend', name: 'Blændværk', cost: 45, desc: 'Fjender i 4 felters afstand fra dine byer kan ikke bevæge sig næste tur.' },
      { key: 'list', name: 'Listig handel', cost: 40, desc: 'Hvert folk, du kender, betaler dig 25 guld.' } ] },
};
function favorGain(cv) {
  const f = civCities(cv.id).reduce((a, c) => a + cityFaith(c), 0);
  return 1 + Math.floor(f / 3);
}
function choosePatron(cv, k) {
  if (!GODS[k] || cv.god) return false;
  cv.god = k; cv.favor = 10; cv.cool = {};
  chron(cv.id, 'faith', `${cv.name} valgte ${GODS[k].name}, ${GODS[k].title.toLowerCase()}, som sin skytsgud.`);
  return true;
}
function blot(cv, gold) {
  if (!cv.god || cv.gold < gold) return 0;
  cv.gold -= gold;
  const add = Math.round(gold / 3);
  cv.favor = Math.min(100, cv.favor + add);
  return add;
}
function miracleOk(cv, m) { return cv.god && cv.favor >= m.cost && (cv.cool[m.key] || 0) <= G.turn; }
function enemiesNear(cv, r) {
  const out = new Set();
  for (const c of civCities(cv.id)) for (const u of G.units) if (atWar(cv.id, u.civ) && dist(u.x, u.y, c.x, c.y) <= r) out.add(u);
  return [...out];
}
function castMiracle(cv, key) {
  const G0 = GODS[cv.god];
  const m = G0 && G0.miracles.find(x => x.key === key);
  if (!m || !miracleOk(cv, m)) return null;
  cv.favor -= m.cost;
  cv.cool[key] = G.turn + Math.round(10 * paceK());
  let r = '';
  if (key === 'ravne') { const ex = G.exploredBy[cv.id]; if (ex) for (const c of civCities(cv.id)) for (const j of tilesInRadius(c.x, c.y, 9)) ex[j] = 1; r = 'Ravnene har set alt i vide omkreds.'; }
  else if (key === 'kilde') { const t = cv.research || Object.keys(TECHS).find(k => canResearch(cv, k)); const add = t ? Math.round(techCost(cv, t) * 0.4) : 50; cv.sci += add; r = `+${add} forskning fra Mimers brønd.`; }
  else if (key === 'torden') { const es = enemiesNear(cv, 3); for (const u of es) { u.hp -= 35; if (u.hp <= 0) killUnit(u); } r = `Lynet ramte ${es.length} fjendtlige enheder.`; }
  else if (key === 'mjolner') { let n = 0; for (const u of G.units.slice()) if (atWar(cv.id, u.civ) && civUnits(cv.id).some(v => dist(v.x, v.y, u.x, u.y) <= 1)) { u.hp -= 25; n++; if (u.hp <= 0) killUnit(u); } r = `Mjølner ramte ${n} fjender.`; }
  else if (key === 'host') { for (const c of civCities(cv.id)) c.food = Math.max(c.food, Math.floor(growthNeed(c.pop) * 0.5)); r = 'Kornet bugner i alle byer.'; }
  else if (key === 'fred') { addBoon(cv, 'Fredens velsignelse', { happy: 2 }, 12); r = 'Frej velsigner dine byer.'; }
  else if (key === 'medvind') { for (const u of civUnits(cv.id)) u.moves += 2; r = 'Vinden fylder sejlene og ryggen på dine krigere.'; }
  else if (key === 'gaver') { cv.gold += 120; r = 'Havet har skænket 120 guld.'; }
  else if (key === 'ed') { for (const u of civUnits(cv.id)) u.hp = 100; r = 'Alle dine enheder er helet.'; }
  else if (key === 'glod') { addBoon(cv, 'Kampglød', { str: 0.25 }, 4); r = 'Dine krigere brænder af kampglød.'; }
  else if (key === 'blaend') { const es = enemiesNear(cv, 4); for (const u of es) u.dazed = G.turn + 1; r = `${es.length} fjender er fanget i blændværk.`; }
  else if (key === 'list') { let g = 0; for (const o of majors()) if (o.alive && o.id !== cv.id && G.met[cv.id][o.id]) { const t = Math.min(25, Math.floor(o.gold)); o.gold -= t; g += t; } cv.gold += g; r = `Loke har narret ${g} guld ud af de andre folk.`; }
  chron(cv.id, 'faith', `${G0.name} hørte ${cv.name}s bøn: ${m.name}. ${r}`);
  return r;
}
function aiGods(cv) {
  if (!cv.god) {
    if (G.turn < 8) return;
    const pref = Object.keys(GODS).filter(k => GODS[k].pers.includes(cv.pers));
    choosePatron(cv, pick(pref.length ? pref : Object.keys(GODS)));
    return;
  }
  const war = warWithMajor(cv.id) || enemiesNear(cv, 3).length > 1;
  for (const m of GODS[cv.god].miracles) {
    if (!miracleOk(cv, m)) continue;
    const useful = ['torden', 'mjolner', 'blaend', 'glod', 'ed'].includes(m.key) ? war && enemiesNear(cv, 3).length > 0 : cv.favor > 80 || Math.random() < 0.05;
    if (useful) { castMiracle(cv, m.key); break; }
  }
  if (cv.gold > 400 && cv.favor < 60 && Math.random() < 0.1) blot(cv, 60);
}
function godsTurn(cv) {
  if (!cv.god) {
    if (cv.human && G.turn >= 8 && !cv.godOffered) { cv.godOffered = true; G.offers.push({ type: 'gods', from: cv.id, to: cv.id }); }
    if (!cv.human) aiGods(cv);
    return;
  }
  cv.favor = Math.min(100, (cv.favor || 0) + favorGain(cv));
  if (cv.human && cv.favor >= 100 && !cv.toldFavor) { cv.toldFavor = true; notify(cv.id, `${GODS[cv.god].name}s gunst er fuld. Brug et mirakel under Riget → Guderne.`, null, 'good'); }
  if (cv.favor < 100) cv.toldFavor = false;
  if (!cv.human) aiGods(cv);
}

// ---------- Holmgang ----------
const HOLM_MOVES = { angreb: { name: 'Angreb', beats: 'list', desc: 'Slår list' }, forsvar: { name: 'Forsvar', beats: 'angreb', desc: 'Slår angreb' }, list: { name: 'List', beats: 'forsvar', desc: 'Slår forsvar' } };
function champion(cid) {
  const us = civUnits(cid).filter(u => isMil(u) && !isSea(u) && !isAir(u));
  if (!us.length) return null;
  return us.sort((a, b) => champPower(b) - champPower(a))[0];
}
function champPower(u) { return UNITS[u.type].str * (u.hero ? 1.3 : 1) * (1 + (u.promos || []).length * 0.08) * (0.5 + 0.5 * u.hp / 100); }
function holmStake(a, b) {
  if (atWar(a, b)) return { kind: 'peace', text: 'Taberen slutter fred og betaler vinderen guld.' };
  return { kind: 'honor', text: 'Taberen betaler vinderen guld, og vinderen vinder ære.' };
}
function holmGold(a, b) { return Math.round(Math.min(200, 40 + Math.min(civ(a).gold, civ(b).gold) * 0.25) / 10) * 10; }
function holmgangOk(a, b) {
  if (!isMajor(civ(a)) || !isMajor(civ(b)) || !civ(b).alive) return 'Kun store folk kan mødes til holmgang.';
  if (!champion(a)) return 'Du har ingen kæmpe.';
  if (!champion(b)) return 'De har ingen kæmpe.';
  if ((G.holmCool && G.holmCool[a + ':' + b] || 0) > G.turn) return 'I har mødtes for nylig.';
  return null;
}
function aiAcceptHolm(ai, other) {
  const me = champion(ai.id), them = champion(other);
  if (!me || !them) return false;
  const r = champPower(me) / champPower(them);
  const bold = ai.pers === 'erobrer' ? 0.25 : ai.pers === 'diplomat' ? 0.1 : 0;
  return r + bold > 0.9 || (atWar(ai.id, other) && milPower(ai.id) < milPower(other) * 0.8);
}
function newDuel(a, b) {
  const ca = champion(a), cb = champion(b);
  return { a, b, ua: ca.id, ub: cb.id, sa: { type: ca.type, hero: ca.hero || null }, sb: { type: cb.type, hero: cb.hero || null }, ha: 100, hb: 100, round: 1, log: [], stake: holmStake(a, b), gold: holmGold(a, b), last: [] };
}
function aiHolmMove(d, side) {
  const hist = side === 'b' ? d.last : [];
  const mv = Object.keys(HOLM_MOVES);
  if (hist.length && Math.random() < 0.45) { const prev = hist[hist.length - 1]; const counter = mv.find(k => HOLM_MOVES[k].beats === prev); return counter; }
  return pick(mv);
}
function duelRound(d, ma) {
  const mb = aiHolmMove(d, 'b');
  d.last.push(ma);
  const ua = unitById(d.ua), ub = unitById(d.ub);
  const pa = ua ? champPower(ua) : 1, pb = ub ? champPower(ub) : 1;
  const ratio = pa / pb;
  let text;
  const dmg = (base, r) => Math.round(base * clamp(r, 0.5, 2) * (0.85 + Math.random() * 0.3));
  if (HOLM_MOVES[ma].beats === mb) { const x = dmg(38, ratio); d.hb -= x; text = `${HOLM_MOVES[ma].name} mod ${HOLM_MOVES[mb].name.toLowerCase()}: din kæmpe rammer hårdt (−${x}).`; }
  else if (HOLM_MOVES[mb].beats === ma) { const x = dmg(38, 1 / ratio); d.ha -= x; text = `${HOLM_MOVES[ma].name} mod ${HOLM_MOVES[mb].name.toLowerCase()}: modstanderen rammer hårdt (−${x}).`; }
  else { const x = dmg(14, 1 / ratio), y = dmg(14, ratio); d.ha -= x; d.hb -= y; text = `Begge vælger ${HOLM_MOVES[ma].name.toLowerCase()}. Sværdene krydses (−${x} / −${y}).`; }
  d.log.push({ round: d.round, ma, mb, text });
  d.round++;
  if (d.ha <= 0 || d.hb <= 0 || d.round > 3) d.done = true;
  return d;
}
function resolveDuel(d) {
  const A = civ(d.a), B = civ(d.b);
  const win = d.ha >= d.hb ? 'a' : 'b';
  const W = win === 'a' ? A : B, L = win === 'a' ? B : A;
  const wu = unitById(win === 'a' ? d.ua : d.ub), lu = unitById(win === 'a' ? d.ub : d.ua);
  const gold = Math.min(d.gold, Math.floor(L.gold));
  L.gold -= gold; W.gold += gold;
  if (d.stake.kind === 'peace' && atWar(A.id, B.id)) makePeace(A.id, B.id);
  if (!G.holmCool) G.holmCool = {};
  G.holmCool[A.id + ':' + B.id] = G.holmCool[B.id + ':' + A.id] = G.turn + Math.round(15 * paceK());
  const wn = wu ? (wu.hero || `en ${W.adj} ${UNITS[wu.type].name.toLowerCase()}`) : W.name;
  const ln = lu ? (lu.hero || `en ${L.adj} ${UNITS[lu.type].name.toLowerCase()}`) : L.name;
  if (lu) { if (lu.hero) chron(L.id, 'hero', `Sagaen om ${lu.hero} endte på holmen.`); killUnit(lu); }
  if (wu) { wu.kills = (wu.kills || 0) + 1; W.stats.kills++; W.stats.holm = (W.stats.holm || 0) + 1; if (!wu.hero && wu.kills >= 3) makeHero(wu, 'Vandt sin ære ved holmgang.'); else if (wu.hero && wu.saga) wu.saga.push(`Vandt holmgang mod ${ln} i ${yearLabel(G.turn)}.`.replace('..', '.')); }
  remember(L.id, W.id, 'holm', -6, 'Slog vores kæmpe på holmen', 30);
  remember(W.id, L.id, 'holmrespect', 4, 'Mødte os ærligt på holmen', 30);
  chron(W.id, 'hero', `Ved holmgang mellem ${A.name} og ${B.name} sejrede ${wn} over ${ln}.${d.stake.kind === 'peace' ? ' Krigen blev afgjort, og der blev sluttet fred.' : ''}`, L.id);
  facAdd(W, 'warriors', 8); facAdd(L, 'warriors', -8);
  return { winner: W.id, loser: L.id, gold };
}
// Computeren udfordrer en spiller, den er i krig med
function aiHolmgang(cv) {
  if (cv.pers !== 'erobrer' && cv.pers !== 'diplomat') return;
  if (Math.random() > 0.015) return;
  for (const o of majors()) {
    if (!o.alive || o.id === cv.id || !o.human || !atWar(cv.id, o.id)) continue;
    if (holmgangOk(cv.id, o.id) || !aiAcceptHolm(cv, o.id)) continue;
    G.offers.push({ type: 'holmgang', from: cv.id, to: o.id });
    return;
  }
}
function aiVsAiHolm(cv) {
  if (Math.random() > 0.01) return;
  const o = majors().find(x => x.alive && !x.human && x.id !== cv.id && atWar(cv.id, x.id));
  if (!o || holmgangOk(cv.id, o.id) || !aiAcceptHolm(o, cv.id)) return;
  const d = newDuel(cv.id, o.id);
  while (!d.done) duelRound(d, pick(Object.keys(HOLM_MOVES)));
  resolveDuel(d);
}

// ---------- Byens sjæl ----------
const SOULS = {
  handel: { name: 'Handelsby', icon: 'soul_handel', desc: '+3 guld og +1 handelsrute', fx: { cityGold: 3 }, routes: 1, pers: ['handelsmand'] },
  faestning: { name: 'Fæstningsby', icon: 'soul_faestning', desc: '+50 % forsvar, og nye enheder er veteraner', def: 0.5, pers: ['erobrer'] },
  laerdom: { name: 'Lærdomsby', icon: 'soul_laerdom', desc: '+3 forskning og +20 % forskning i byen', sci: 3, sm: 0.2, pers: ['videnskab'] },
  hellig: { name: 'Helligby', icon: 'soul_hellig', desc: '+3 tro og +2 kultur', faith: 3, culture: 2, pers: ['from'] },
  smedje: { name: 'Håndværkerby', icon: 'soul_smedje', desc: '+20 % produktion', pm: 0.2, pers: ['bygmester', 'erobrer'] },
  korn: { name: 'Kornkammer', icon: 'soul_korn', desc: '+3 mad', f: 3, pers: ['diplomat', 'bygmester'] },
};
const SOUL_POP = 5;
function setSoul(c, k) {
  if (c.soul || !SOULS[k]) return false;
  c.soul = k;
  chron(c.civ, 'city', `${c.name} blev kendt som ${SOULS[k].name.toLowerCase()} i hele riget.`);
  return true;
}
function soulCity(c, r) {
  const S0 = c.soul && SOULS[c.soul];
  if (!S0) return;
  r.f += S0.f || 0; r.pm += S0.pm || 0; r.sm += S0.sm || 0; r.sci += S0.sci || 0; r.culture += S0.culture || 0;
  r.gold += (S0.fx && S0.fx.cityGold) || 0;
}
function soulsTurn(cv) {
  for (const c of civCities(cv.id)) {
    if (c.soul || c.pop < SOUL_POP) continue;
    if (cv.human) { if (!c.soulAsked) { c.soulAsked = true; G.offers.push({ type: 'soul', from: cv.id, to: cv.id, city: c.id }); } }
    else {
      const pref = Object.keys(SOULS).filter(k => SOULS[k].pers.includes(cv.pers));
      setSoul(c, Math.random() < 0.7 && pref.length ? pick(pref) : pick(Object.keys(SOULS)));
    }
  }
}

// ---------- Rådet ----------
const ADVISORS = {
  kansler: { name: 'Kansleren', short: 'Ka', color: '#E8C34C', role: 'Økonomi og byer' },
  haer: { name: 'Hærføreren', short: 'Hf', color: '#E46C60', role: 'Hær og forsvar' },
  praest: { name: 'Ypperstepræsten', short: 'Yp', color: '#C99AE6', role: 'Tro og folkets sind' },
  skjald: { name: 'Skjalden', short: 'Sk', color: '#72B6EA', role: 'Eventyr og eftermæle' },
};
// Returnerer en liste af råd: { who, text, prio, at, open }
function councilAdvice(cv) {
  const out = [];
  const add = (who, prio, text, at, open) => out.push({ who, prio, text, at, open });
  const cs = civCities(cv.id);
  const inc = civIncome(cv.id);
  if (inc.gold < 0) add('kansler', 90, `Statskassen bløder ${fmt(-inc.gold)} guld pr. tur. Sæt en by til at producere rigdom, eller hjemsend en enhed.`, null, null);
  const idle = cs.find(c => !c.build);
  if (idle) add('kansler', 85, `${idle.name} står uden noget at lave. Lad os give byens folk en opgave.`, idx(idle.x, idle.y), { city: idle.id });
  const buyable = cs.find(c => c.build && c.build.kind === 'bld' && isFinite(buyCost(c)) && buyCost(c) < cv.gold * 0.5);
  if (buyable && cv.gold > 150) add('kansler', 40, `Vi har guld nok til at købe ${buildName(buyable.build).toLowerCase()} i ${buyable.name} med det samme.`, idx(buyable.x, buyable.y), { city: buyable.id });
  const big = cs.find(c => c.pop >= SOUL_POP && !c.soul);
  if (big) add('kansler', 50, `${big.name} er stor nok til at få sin egen sjæl. Hvad skal byen være kendt for?`, idx(big.x, big.y), { city: big.id });
  for (const c of cs) {
    const foes = G.units.filter(u => atWar(cv.id, u.civ) && isMil(u) && dist(u.x, u.y, c.x, c.y) <= 3);
    if (foes.length) { add('haer', 95, `Fjender ved ${c.name}! ${foes.length} ${foes.length === 1 ? 'fjendtlig enhed er' : 'fjendtlige enheder er'} tæt på. Styrk forsvaret.`, idx(c.x, c.y), null); break; }
  }
  const naked = cs.find(c => !G.units.some(u => u.civ === cv.id && u.x === c.x && u.y === c.y && isMil(u)));
  if (naked && cs.length > 1) add('haer', 55, `${naked.name} har ingen garnison. En enkelt kriger kan redde byen.`, idx(naked.x, naked.y), null);
  const promo = civUnits(cv.id).find(u => typeof promoPending === 'function' && promoPending(u) > 0);
  if (promo) add('haer', 45, `En ${UNITS[promo.type].name.toLowerCase()} har gjort sig fortjent til en forfremmelse.`, idx(promo.x, promo.y), { unit: promo.id });
  const weak = majors().find(o => o.alive && o.id !== cv.id && atWar(cv.id, o.id) && milPower(o.id) * 1.6 < milPower(cv.id));
  if (weak) add('haer', 60, `Vores hær er langt stærkere end ${weak.name}s. Nu er tiden til at slå til, eller til at kræve holmgang.`, null, { tab: 'diplo' });
  const unh = cs.reduce((a, c) => a + (c.unhappy || 0), 0);
  if (unh) add('praest', 80, `${unh} borgere er utilfredse og nægter at arbejde. Byg templer, eller skaf luksusvarer.`, null, null);
  if (canFoundReligion(cv)) add('praest', 75, 'Vores tro er stærk nok til at grundlægge en religion.', null, { realm: 'religion' });
  if (!cv.god && G.turn >= 8) add('praest', 70, 'Folket mangler en skytsgud. Vælg en gud, der kan vogte over riget.', null, { realm: 'gods' });
  if (cv.god && cv.favor >= 60 && GODS[cv.god].miracles.some(m => miracleOk(cv, m))) add('praest', 50, `${GODS[cv.god].name}s gunst er stor. Et mirakel venter på dit ord.`, null, { realm: 'gods' });
  for (const k in cv.fac.l) if (cv.fac.l[k] <= 30) { add('praest', 65, `${FACTIONS[k].name} er vrede. De ønsker ${FACTIONS[k].likes}.`, null, { realm: 'folk' }); break; }
  if (canAdoptPolicy(cv)) add('skjald', 60, 'Kulturen har givet os råd til en ny samfundspolitik.', null, { realm: 'society' });
  if (cv.prophecy && cv.prophecy.until - G.turn <= 5) add('skjald', 70, `Kun ${Math.max(0, cv.prophecy.until - G.turn)} ture tilbage til oraklets frist: ${prophecyText(cv.prophecy)}`, null, { realm: 'folk' });
  const rum = Object.keys(cv.rumors).find(k => G.legends[k] && G.legends[k].found == null && !cv.exp && expeditionOk(cv, k));
  if (rum) add('skjald', 45, `Rygterne om ${LEGENDS[rum].name} lokker. Vi har råd til at sende et togt.`, cv.rumors[rum].area, { realm: 'legends' });
  const runeC = cs.find(c => canRaiseRune(cv, c));
  if (runeC && cv.gold > 200) add('skjald', 25, `Lad os rejse en runesten i ${runeC.name}, så eftertiden husker os.`, idx(runeC.x, runeC.y), { city: runeC.id });
  if (G.crisis && crisisHits(cv.id)) add('skjald', 85, `${CRISES[G.crisis.key].name} hærger. Giv vores andel, så vi bliver husket som dem, der hjalp.`, null, { crisis: true });
  return out.sort((a, b) => b.prio - a.prio);
}

// ---------- Historiens genspil ----------
function recordReplay() {
  if (!G.replay || !G.replay.last) G.replay = { last: new Array(G.tiles.length).fill(-1), frames: [], seen: [] };
  const prevArr = G.replay.last;
  const d = [];
  for (let i = 0; i < G.tiles.length; i++) { const o = G.tiles[i].owner ?? -1; if (o !== prevArr[i]) { d.push(i, o); prevArr[i] = o; } }
  const cities = G.cities.filter(c => !(G.replay.seen || []).includes(c.id));
  G.replay.seen = (G.replay.seen || []).concat(cities.map(c => c.id));
  G.replay.frames.push({ t: G.turn, d, c: cities.map(c => [idx(c.x, c.y), c.civ]) });
}
function ensureMythState() {
  for (const cv of G.civs) {
    if (!isMajor(cv)) continue;
    if (cv.favor == null) cv.favor = 0;
    if (!cv.cool) cv.cool = {};
  }
}
function mythTurn(cv) {
  if (!isMajor(cv)) return;
  godsTurn(cv);
  soulsTurn(cv);
  if (!cv.human) { aiHolmgang(cv); aiVsAiHolm(cv); }
}
