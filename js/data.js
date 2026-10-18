// Spildata: terræn, ressourcer, enheder, bygninger, vidundere, teknologier og folk.
'use strict';

const TERRAIN = {
  ocean:    { name: 'Hav',      f: 1, p: 0, t: 1, move: 1, water: true,  def: 0,    color: '#1d4e74' },
  coast:    { name: 'Kyst',     f: 1, p: 0, t: 2, move: 1, water: true,  def: 0,    color: '#2f7aa3' },
  grass:    { name: 'Græsland', f: 2, p: 0, t: 0, move: 1,  def: 0,    color: '#6f9f3e' },
  plains:   { name: 'Slette',   f: 1, p: 1, t: 0, move: 1,  def: 0,    color: '#a8a54f' },
  desert:   { name: 'Ørken',    f: 0, p: 1, t: 0, move: 1,  def: 0,    color: '#d9c27a' },
  tundra:   { name: 'Tundra',   f: 1, p: 0, t: 0, move: 1,  def: 0,    color: '#8e9a84' },
  snow:     { name: 'Sne',      f: 0, p: 0, t: 0, move: 1,  def: 0,    color: '#e4ebef' },
  hills:    { name: 'Bakker',   f: 1, p: 1, t: 0, move: 2,  def: 0.5,  color: '#9a8455' },
  mountain: { name: 'Bjerge',   f: 0, p: 1, t: 0, move: 99, def: 0,    color: '#7b7570' },
  forest:   { name: 'Skov',     f: 1, p: 2, t: 0, move: 2,  def: 0.25, color: '#3f6e34' },
  jungle:   { name: 'Jungle',   f: 1, p: 0, t: 1, move: 2,  def: 0.25, color: '#2f5f2c' },
};

// lux: luksusvare, giver +1 tilfredshed i alle byer
// strat: strategisk ressource, som visse enheder kræver. reveal: teknologien, der gør den synlig
const RESOURCES = {
  wheat:  { name: 'Hvede',    f: 2, p: 0, t: 0, on: ['grass', 'plains'],           glyph: '🌾' },
  cattle: { name: 'Kvæg',     f: 1, p: 1, t: 0, on: ['grass'],                     glyph: '🐄' },
  horses: { name: 'Heste',    f: 0, p: 2, t: 0, on: ['plains', 'grass', 'tundra'], glyph: '🐎', strat: true },
  iron:   { name: 'Jern',     f: 0, p: 2, t: 0, on: ['hills', 'tundra'],           glyph: '⛏', strat: true },
  coal:   { name: 'Kul',      f: 0, p: 2, t: 0, on: ['hills', 'plains', 'tundra'], glyph: '⚫', strat: true, reveal: 'metallurgy' },
  oil:    { name: 'Olie',     f: 0, p: 1, t: 1, on: ['desert', 'tundra', 'jungle'], glyph: '🛢', strat: true, reveal: 'electricity' },
  fish:   { name: 'Fisk',     f: 2, p: 0, t: 0, on: ['coast'],                     glyph: '🐟' },
  deer:   { name: 'Hjorte',   f: 1, p: 1, t: 0, on: ['forest', 'tundra'],          glyph: '🦌' },
  oasis:  { name: 'Oase',     f: 3, p: 0, t: 2, on: ['desert'],                    glyph: '🌴' },
  gold:   { name: 'Guld',     f: 0, p: 0, t: 4, on: ['hills', 'desert'],           glyph: '🪙', lux: true },
  gems:   { name: 'Ædelsten', f: 0, p: 0, t: 4, on: ['jungle', 'hills'],           glyph: '💎', lux: true },
  wine:   { name: 'Vin',      f: 0, p: 0, t: 3, on: ['plains', 'grass'],           glyph: '🍇', lux: true },
  spices: { name: 'Krydderier', f: 1, p: 0, t: 2, on: ['jungle', 'forest'],        glyph: '🌶', lux: true },
  furs:   { name: 'Pelse',    f: 0, p: 0, t: 3, on: ['tundra', 'forest'],          glyph: '🦊', lux: true },
  whales: { name: 'Hvaler',   f: 1, p: 1, t: 2, on: ['coast', 'ocean'],            glyph: '🐋', lux: true },
  silk:   { name: 'Silke',    f: 0, p: 0, t: 3, on: ['forest', 'grass'],           glyph: '🧵', lux: true },
};

// cls: civil, melee, ranged, mounted, siege, armor, naval
// domain: land (standard) eller sea. up: enheden kan opgraderes til.
const UNITS = {
  settler:   { name: 'Bosætter',      cost: 60,  str: 0,  moves: 2, cls: 'civil',   tech: null,       glyph: '🏕', desc: 'Grundlægger nye byer. Byen mister 1 indbygger.' },
  worker:    { name: 'Arbejder',      cost: 40,  str: 0,  moves: 2, cls: 'civil',   tech: null,       glyph: '⚒', desc: 'Bygger farme, miner og veje.' },
  caravan:   { name: 'Karavane',      cost: 50,  str: 0,  moves: 2, cls: 'civil',   tech: 'currency', glyph: '🐪', desc: 'Opretter en handelsrute til en by mindst 6 felter væk.' },
  scout:     { name: 'Spejder',       cost: 25,  str: 4,  moves: 3, cls: 'melee',   tech: null,       glyph: '🔭', obs: 'feudal', desc: 'Hurtig opdagelsesrejsende.' },
  warrior:   { name: 'Kriger',        cost: 30,  str: 6,  moves: 2, cls: 'melee',   tech: null,       glyph: '🪓', obs: 'iron', up: 'swordsman' },
  archer:    { name: 'Bueskytte',     cost: 40,  str: 5,  ranged: 7,  range: 2, moves: 2, cls: 'ranged', tech: 'archery', glyph: '🏹', obs: 'university', up: 'crossbow' },
  spearman:  { name: 'Spydkæmper',    cost: 50,  str: 10, moves: 2, cls: 'melee',   tech: 'bronze',   glyph: '🔱', antiMounted: true, obs: 'feudal', up: 'pikeman' },
  horseman:  { name: 'Rytter',        cost: 60,  str: 12, moves: 4, cls: 'mounted', tech: 'riding',   needs: 'horses', glyph: '🐴', obs: 'chivalry', up: 'knight' },
  swordsman: { name: 'Sværdkæmper',   cost: 70,  str: 14, moves: 2, cls: 'melee',   tech: 'iron',     needs: 'iron', glyph: '⚔', obs: 'gunpowder', up: 'musketeer' },
  catapult:  { name: 'Katapult',      cost: 80,  str: 7,  ranged: 14, range: 2, moves: 2, cls: 'siege', tech: 'math', glyph: '☄', obs: 'metallurgy', up: 'cannon' },
  pikeman:   { name: 'Pikenér',       cost: 80,  str: 16, moves: 2, cls: 'melee',   tech: 'feudal',   glyph: '🗡', antiMounted: true, obs: 'gunpowder', up: 'musketeer' },
  knight:    { name: 'Ridder',        cost: 100, str: 20, moves: 4, cls: 'mounted', tech: 'chivalry', needs: 'horses', glyph: '🛡', obs: 'combustion', up: 'tank' },
  crossbow:  { name: 'Armbrøstskytte', cost: 90, str: 12, ranged: 18, range: 2, moves: 2, cls: 'ranged', tech: 'university', glyph: '🎯', obs: 'ballistics', up: 'artillery' },
  musketeer: { name: 'Musketer',      cost: 120, str: 24, moves: 2, cls: 'melee',   tech: 'gunpowder', glyph: '💥', obs: 'rifling', up: 'rifleman' },
  cannon:    { name: 'Kanon',         cost: 140, str: 14, ranged: 26, range: 2, moves: 2, cls: 'siege', tech: 'metallurgy', needs: 'iron', glyph: '💣', obs: 'ballistics', up: 'artillery' },
  rifleman:  { name: 'Riffelskytte',  cost: 180, str: 34, moves: 2, cls: 'melee',   tech: 'rifling',  glyph: '🎖', obs: 'combustion', up: 'infantry' },
  artillery: { name: 'Artilleri',     cost: 220, str: 20, ranged: 42, range: 3, moves: 2, cls: 'siege', tech: 'ballistics', needs: 'coal', glyph: '🎇' },
  infantry:  { name: 'Infanteri',     cost: 250, str: 50, moves: 2, cls: 'melee',   tech: 'combustion', glyph: '🪖' },
  tank:      { name: 'Kampvogn',      cost: 300, str: 70, moves: 5, cls: 'armor',   tech: 'combustion', needs: 'oil', glyph: '🚜' },
  // skibe
  galley:    { name: 'Galej',         cost: 50,  str: 9,  moves: 3, cls: 'naval', domain: 'sea', coastOnly: true, tech: 'sailing', glyph: '⛵', obs: 'industry', up: 'ironclad' },
  frigate:   { name: 'Fregat',        cost: 120, str: 14, ranged: 22, range: 2, moves: 4, cls: 'naval', domain: 'sea', tech: 'gunpowder', needs: 'iron', glyph: '🚢', obs: 'combustion', up: 'battleship' },
  ironclad:  { name: 'Jernklædt',     cost: 180, str: 40, moves: 4, cls: 'naval', domain: 'sea', tech: 'industry', needs: 'coal', glyph: '⚓', up: 'battleship' },
  battleship:{ name: 'Slagskib',      cost: 320, str: 50, ranged: 60, range: 3, moves: 5, cls: 'naval', domain: 'sea', tech: 'combustion', needs: 'oil', glyph: '🛳' },
  // fly og luftværn
  fighter:   { name: 'Jagerfly',      cost: 220, str: 30, ranged: 32, range: 6, moves: 1, cls: 'air', domain: 'air', tech: 'flight', intercept: 6, glyph: '✈', desc: 'Står i dine byer. Angriber inden for 6 felter og opsnapper fjendtlige fly.' },
  bomber:    { name: 'Bombefly',      cost: 280, str: 20, ranged: 60, range: 8, moves: 1, cls: 'air', domain: 'air', tech: 'flight', needs: 'oil', bombard: true, glyph: '🛩', desc: 'Står i dine byer. Bomber byer og enheder inden for 8 felter.' },
  aagun:     { name: 'Luftværn',      cost: 160, str: 32, moves: 2, cls: 'melee', tech: 'flight', intercept: 2, glyph: '🎯', desc: 'Opsnapper fjendtlige fly inden for 2 felter.' },
  // spionage
  spy:       { name: 'Spion',         cost: 70,  str: 0,  moves: 3, cls: 'civil', tech: 'university', spy: true, glyph: '🕵', desc: 'Stjæler viden, saboterer og skaber uro i fremmede byer. Står den i din egen by, beskytter den mod fjendens spioner.' },
  // religion (købes for tro)
  missionary:{ name: 'Missionær',     cost: 0,   str: 0,  moves: 3, cls: 'civil', faith: true, glyph: '⛪', desc: 'Spreder din religion til en by. Kan bruges to gange.' },
  // store personligheder (kan ikke bygges)
  gp_sci:    { name: 'Videnskabsmand', cost: 0, str: 0, moves: 2, cls: 'civil', gp: true, glyph: '🔬', desc: 'Kan bruges til et stort forskningsspring.' },
  gp_mer:    { name: 'Købmand',       cost: 0, str: 0, moves: 2, cls: 'civil', gp: true, glyph: '💰', desc: 'Kan gennemføre en handelsmission for guld.' },
  gp_eng:    { name: 'Ingeniør',      cost: 0, str: 0, moves: 2, cls: 'civil', gp: true, glyph: '📐', desc: 'Giver 300 produktion til byen, den står i.' },
  gp_gen:    { name: 'General',       cost: 0, str: 0, moves: 3, cls: 'civil', gp: true, glyph: '🎺', desc: 'Egne enheder inden for 2 felter får +25 % styrke.' },
};

const BUILDINGS = {
  granary:    { name: 'Kornkammer',   cost: 60,  upkeep: 1, tech: 'pottery',    desc: '+2 mad' },
  barracks:   { name: 'Kaserne',      cost: 50,  upkeep: 1, tech: 'bronze',     desc: 'Nye enheder starter med 15 erfaring (en forfremmelse)', gp: 'gen' },
  watermill:  { name: 'Vandmølle',    cost: 70,  upkeep: 1, tech: 'wheel',      desc: '+2 produktion. Byen skal ligge ved en flod', river: true, gp: 'eng' },
  walls:      { name: 'Bymur',        cost: 70,  upkeep: 1, tech: 'masonry',    desc: 'Byens forsvar +50 %', gp: 'gen' },
  library:    { name: 'Bibliotek',    cost: 80,  upkeep: 1, tech: 'writing',    desc: '+50 % forskning', gp: 'sci' },
  market:     { name: 'Marked',       cost: 90,  upkeep: 0, tech: 'currency',   desc: '+50 % guld, +1 tilfredshed, +1 handelsrute', happy: 1, gp: 'mer' },
  shrine:     { name: 'Helligdom',    cost: 40,  upkeep: 0, tech: 'mysticism',  desc: '+1 tro', faith: 1 },
  temple:     { name: 'Tempel',       cost: 60,  upkeep: 1, tech: 'philosophy', desc: '+2 tilfredshed, +3 kultur, +2 tro', happy: 2, culture: 3, faith: 2 },
  amphitheater: { name: 'Amfiteater', cost: 90,  upkeep: 1, tech: 'construction', desc: '+2 kultur, +1 tilfredshed', culture: 2, happy: 1 },
  arena:      { name: 'Arena',        cost: 100, upkeep: 2, tech: 'construction', desc: '+3 tilfredshed', happy: 3 },
  aqueduct:   { name: 'Akvædukt',     cost: 110, upkeep: 1, tech: 'construction', desc: 'Byen kan vokse over 8 indbyggere' },
  harbor:     { name: 'Havn',         cost: 90,  upkeep: 1, tech: 'sailing',    desc: '+1 mad fra havfelter. Kun kystbyer', coastal: true, gp: 'mer' },
  university: { name: 'Universitet',  cost: 160, upkeep: 2, tech: 'university', desc: '+50 % forskning', gp: 'sci' },
  bank:       { name: 'Bank',         cost: 150, upkeep: 0, tech: 'banking',    desc: '+50 % guld, +1 handelsrute', gp: 'mer' },
  cathedral:  { name: 'Katedral',     cost: 140, upkeep: 2, tech: 'banking',    desc: '+3 tilfredshed, +3 tro', happy: 3, faith: 3 },
  museum:     { name: 'Museum',       cost: 180, upkeep: 2, tech: 'gravity',    desc: '+5 kultur', culture: 5 },
  airport:    { name: 'Lufthavn',     cost: 200, upkeep: 2, tech: 'flight',     desc: 'Fly kan omplaceres hertil fra hele riget, og nye fly bliver veteraner' },
  broadcast:  { name: 'Radiotårn',    cost: 240, upkeep: 3, tech: 'computers',  desc: '+6 kultur, +1 tilfredshed', culture: 6, happy: 1 },
  workshop:   { name: 'Værksted',     cost: 120, upkeep: 1, tech: 'iron',       desc: '+25 % produktion', gp: 'eng' },
  factory:    { name: 'Fabrik',       cost: 240, upkeep: 3, tech: 'industry',   desc: '+50 % produktion', gp: 'eng' },
  powerplant: { name: 'Kraftværk',    cost: 260, upkeep: 3, tech: 'electricity', desc: '+50 % produktion', gp: 'eng' },
  lab:        { name: 'Forskningslab', cost: 280, upkeep: 3, tech: 'computers', desc: '+75 % forskning', gp: 'sci' },
};

const WONDERS = {
  stonehenge:{ name: 'Stonehenge',           cost: 140, tech: 'mysticism',  desc: '+4 tro i byen', faith: 4 },
  pyramids:  { name: 'Pyramiderne',          cost: 180, tech: 'masonry',    desc: '+25 % produktion i byen. Skift af regering giver kun 1 tur anarki', gp: 'eng' },
  gardens:   { name: 'De Hængende Haver',    cost: 200, tech: 'pottery',    desc: '+1 tilfredshed i alle dine byer' },
  colossus:  { name: 'Kolossen',             cost: 160, tech: 'bronze',     desc: '+1 handel på alle havfelter byen arbejder', gp: 'mer' },
  library:   { name: 'Det Store Bibliotek',  cost: 260, tech: 'philosophy', desc: '+8 forskning i byen', gp: 'sci' },
  greatwall: { name: 'Den Kinesiske Mur',    cost: 240, tech: 'construction', desc: 'Alle dine byer får bymurens forsvar', gp: 'gen' },
  newton:    { name: 'Newtons Kollegium',    cost: 420, tech: 'gravity',    desc: '+100 % forskning i byen', gp: 'sci' },
  adamsmith: { name: 'Adam Smiths Handelshus', cost: 450, tech: 'banking',  desc: 'Betaler vedligehold for alle bygninger med 1 i upkeep', gp: 'mer' },
  hoover:    { name: 'Hoover-dæmningen',     cost: 600, tech: 'electricity', desc: '+25 % produktion i alle byer', gp: 'eng' },
  un:        { name: 'De Forenede Nationer', cost: 700, tech: 'computers',  desc: 'Hver 10. tur stemmer verden om en verdensleder. Flertal giver diplomatisk sejr' },
};

const PROJECTS = {
  spaceship: { name: 'Rumskib til Alpha Centauri', cost: 2600, tech: 'spaceflight', desc: 'Vinder spillet, når det er færdigt' },
  wealth:    { name: 'Velstand', cost: 0, tech: null, desc: 'Omdanner produktion til guld' },
};

const TECHS = {
  agriculture:  { name: 'Landbrug',          cost: 0,    pre: [],                       era: 0 },
  mining:       { name: 'Minedrift',         cost: 30,   pre: ['agriculture'],          era: 0 },
  pottery:      { name: 'Keramik',           cost: 30,   pre: ['agriculture'],          era: 0 },
  archery:      { name: 'Bueskydning',       cost: 30,   pre: ['agriculture'],          era: 0 },
  wheel:        { name: 'Hjulet',            cost: 40,   pre: ['agriculture'],          era: 0 },
  sailing:      { name: 'Sejlads',           cost: 45,   pre: ['pottery'],              era: 0 },
  bronze:       { name: 'Bronzealder',       cost: 45,   pre: ['mining'],               era: 0 },
  riding:       { name: 'Ridning',           cost: 50,   pre: ['wheel'],                era: 0 },
  writing:      { name: 'Skrift',            cost: 50,   pre: ['pottery'],              era: 0 },
  masonry:      { name: 'Murværk',           cost: 50,   pre: ['mining'],               era: 0 },
  mysticism:    { name: 'Mystik',            cost: 40,   pre: ['pottery'],              era: 0 },
  monarchy:     { name: 'Monarki',           cost: 60,   pre: ['bronze', 'writing'],    era: 0 },
  iron:         { name: 'Jernbearbejdning',  cost: 85,   pre: ['bronze'],               era: 1 },
  math:         { name: 'Matematik',         cost: 85,   pre: ['writing', 'wheel'],     era: 1 },
  currency:     { name: 'Valuta',            cost: 85,   pre: ['bronze', 'writing'],    era: 1 },
  philosophy:   { name: 'Filosofi',          cost: 130,  pre: ['currency'],             era: 1 },
  construction: { name: 'Konstruktion',      cost: 130,  pre: ['masonry', 'math'],      era: 1 },
  feudal:       { name: 'Feudalisme',        cost: 190,  pre: ['iron', 'philosophy'],   era: 2 },
  chivalry:     { name: 'Ridderskab',        cost: 230,  pre: ['riding', 'feudal'],     era: 2 },
  astronomy:    { name: 'Astronomi',         cost: 210,  pre: ['math', 'philosophy', 'sailing'], era: 2 },
  university:   { name: 'Universitet',       cost: 280,  pre: ['astronomy'],            era: 2 },
  banking:      { name: 'Bankvæsen',         cost: 280,  pre: ['currency', 'feudal'],   era: 2 },
  gunpowder:    { name: 'Krudt',             cost: 360,  pre: ['feudal', 'university'], era: 3 },
  gravity:      { name: 'Tyngdeloven',       cost: 420,  pre: ['university', 'banking'], era: 3 },
  metallurgy:   { name: 'Metallurgi',        cost: 420,  pre: ['gunpowder'],            era: 3 },
  democracy:    { name: 'Demokrati',         cost: 430,  pre: ['banking', 'gravity'],   era: 3 },
  industry:     { name: 'Industrialisering', cost: 580,  pre: ['metallurgy', 'banking'], era: 4 },
  rifling:      { name: 'Riffelløb',         cost: 620,  pre: ['industry'],             era: 4 },
  electricity:  { name: 'Elektricitet',      cost: 680,  pre: ['gravity', 'industry'],  era: 4 },
  ballistics:   { name: 'Ballistik',         cost: 740,  pre: ['rifling'],              era: 4 },
  communism:    { name: 'Kommunisme',        cost: 650,  pre: ['industry', 'philosophy'], era: 4 },
  combustion:   { name: 'Forbrændingsmotor', cost: 860,  pre: ['electricity', 'rifling'], era: 5 },
  flight:       { name: 'Luftfart',          cost: 820,  pre: ['combustion'],           era: 5 },
  computers:    { name: 'Computere',         cost: 960,  pre: ['electricity'],          era: 5 },
  rocketry:     { name: 'Raketter',          cost: 1150, pre: ['computers', 'combustion'], era: 5 },
  spaceflight:  { name: 'Rumfart',           cost: 1450, pre: ['rocketry'],             era: 5 },
};
// Ekstra effekter der vises i teknologitræet
const TECH_NOTES = {
  sailing: 'Landenheder kan sejle langs kysten',
  astronomy: 'Landenheder kan krydse åbent hav, +1 mad fra havet',
  industry: '+1 mad fra farme',
  monarchy: 'Regeringsform: Monarki',
  philosophy: 'Regeringsform: Republik',
  democracy: 'Regeringsform: Demokrati',
  communism: 'Regeringsform: Kommunisme',
  metallurgy: 'Viser kul på kortet',
  mysticism: 'Tro: grundlæg en religion',
  electricity: 'Viser olie på kortet',
};

// Regeringsformer. Tal er tillæg (0.1 = +10 %). freeUnits: gratis enheder pr. by ud over 2.
const GOVS = {
  despotism: { name: 'Despoti', tech: null, sci: -0.1, gold: -0.1, prod: 0, freeUnits: 1, garrison: 1,
    pros: ['+1 gratis enhed pr. by', 'Garnisoner giver +1 ekstra tilfredshed'], cons: ['−10 % forskning og guld'] },
  monarchy: { name: 'Monarki', tech: 'monarchy', sci: 0, gold: 0, prod: 0, freeUnits: 1, garrison: 1, capitalProd: 3, capitalCulture: 2,
    pros: ['+3 produktion og +2 kultur i hovedstaden', '+1 gratis enhed pr. by', 'Garnisoner giver +1 ekstra tilfredshed'], cons: [] },
  republic: { name: 'Republik', tech: 'philosophy', sci: 0.1, gold: 0.15, prod: 0, freeUnits: -1, cityTrade: 1, warWeary: 1,
    pros: ['+1 handel i hver by', '+10 % forskning, +15 % guld'], cons: ['Krig mod stormagter: −1 tilfredshed i hver by', '1 gratis enhed færre pr. by'] },
  democracy: { name: 'Demokrati', tech: 'democracy', sci: 0.2, gold: 0.25, prod: 0, freeUnits: -1, warWeary: 2, buy: -0.25, happy: 1,
    pros: ['+20 % forskning, +25 % guld', 'Køb er 25 % billigere', '+1 tilfredshed i hver by'], cons: ['Krig mod stormagter: −2 tilfredshed i hver by', '1 gratis enhed færre pr. by'] },
  communism: { name: 'Kommunisme', tech: 'communism', sci: 0, gold: -0.1, prod: 0.15, freeUnits: 2, noEmpire: true,
    pros: ['+15 % produktion', 'Ingen utilfredshed fra rigets størrelse', '+2 gratis enheder pr. by'], cons: ['−10 % guld'] },
  anarchy: { name: 'Anarki', tech: 'never', sci: -1, gold: -0.5, prod: -0.25, freeUnits: 0, hidden: true,
    pros: [], cons: ['Ingen forskning, −50 % guld, −25 % produktion'] },
};

// Forfremmelser. cls: hvilke enhedstyper der kan få dem. req: kræver en anden forfremmelse først.
const PROMOS = {
  drill1:   { name: 'Øvelse I',     desc: '+15 % styrke', cls: ['melee', 'mounted', 'armor', 'ranged', 'siege', 'naval'] },
  drill2:   { name: 'Øvelse II',    desc: '+15 % styrke', req: 'drill1', cls: ['melee', 'mounted', 'armor', 'ranged', 'siege', 'naval'] },
  drill3:   { name: 'Øvelse III',   desc: '+15 % styrke', req: 'drill2', cls: ['melee', 'mounted', 'armor', 'ranged', 'siege', 'naval'] },
  shock:    { name: 'Stormtropper', desc: '+25 % angreb på åbent land', cls: ['melee', 'mounted', 'armor'] },
  woods:    { name: 'Skovkæmper',   desc: '+33 % i skov, jungle og bakker', cls: ['melee', 'ranged', 'mounted'] },
  cover:    { name: 'Dækning',      desc: '+33 % forsvar mod afstandsangreb', cls: ['melee', 'ranged', 'siege', 'mounted', 'armor'] },
  siege:    { name: 'Stormløb',     desc: '+33 % angreb mod byer', cls: ['melee', 'mounted', 'siege', 'armor', 'naval'] },
  accuracy: { name: 'Præcision',    desc: '+25 % afstandsangreb', cls: ['ranged', 'siege', 'naval'], ranged: true },
  range:    { name: 'Rækkevidde',   desc: '+1 felts afstand', req: 'accuracy', cls: ['ranged', 'siege', 'naval'], ranged: true },
  mobility: { name: 'Mobilitet',    desc: '+1 bevægelse', cls: ['mounted', 'armor', 'naval'] },
  medic:    { name: 'Felthospital', desc: 'Egne enheder på og ved feltet heler 10 ekstra', cls: ['melee', 'ranged'] },
  march:    { name: 'March',        desc: 'Heler hver tur, også efter kamp', req: 'medic', cls: ['melee', 'ranged'] },
};
const XP_LEVELS = [10, 25, 45, 70, 100, 140, 190, 250];

// Naturvidundere. Felterne giver ekstra udbytte og særlige fordele.
const NATURAL = {
  uluru:       { name: 'Uluru',                 on: ['desert', 'plains'],          f: 1, p: 0, t: 3, happy: 1, faith: 2, desc: '+3 handel, +2 tro, +1 tilfredshed i alle dine byer' },
  canyon:      { name: 'Grand Canyon',          on: ['desert', 'plains', 'hills'], f: 0, p: 3, t: 2, def: 0.5, desc: '+3 produktion, +2 handel, +50 % forsvar' },
  kilimanjaro: { name: 'Kilimanjaro',           on: ['hills'],                     f: 2, p: 2, t: 0, def: 0.25, sight: 2, desc: '+2 mad, +2 produktion, langt udsyn' },
  victoria:    { name: 'Victoriafaldet',        on: ['grass', 'plains', 'forest', 'jungle'], river: true, f: 2, p: 0, t: 3, happy: 1, desc: '+3 handel, +1 tilfredshed i alle dine byer' },
  reef:        { name: 'Det Store Barriererev', on: ['coast'],                     f: 3, p: 0, t: 2, desc: '+3 mad, +2 handel' },
  fountain:    { name: 'Ungdomskilden',         on: ['grass', 'plains'],           f: 2, p: 0, t: 1, heal: true, desc: 'Enheder her heler helt hver tur' },
  fuji:        { name: 'Fuji',                  on: ['hills'],                     f: 0, p: 3, t: 1, culture: 3, faith: 2, desc: '+3 produktion, +3 kultur og +2 tro til byen' },
};

// Holdninger mellem folk
const ATTITUDES = [
  { min: 30, name: 'Venlig', cls: 'good' },
  { min: 10, name: 'Imødekommende', cls: 'good' },
  { min: -10, name: 'Neutral', cls: 'neutral' },
  { min: -30, name: 'Mistænksom', cls: 'warn' },
  { min: -999, name: 'Fjendtlig', cls: 'bad' },
];

const ERAS = ['Oldtiden', 'Klassisk tid', 'Middelalderen', 'Renæssancen', 'Industritiden', 'Moderne tid'];

const IMPROVEMENT_TECH = { farm: 'agriculture', mine: 'mining', road: 'wheel', chop: 'bronze' };

const CIVS = [
  { key: 'dk', lat: 55.7, lon: 12.6, name: 'Danmark',    adj: 'dansk',     color: '#c8293b',
    cities: ['København', 'Aarhus', 'Odense', 'Roskilde', 'Ribe', 'Aalborg', 'Viborg', 'Esbjerg', 'Vejle', 'Helsingør', 'Randers', 'Kolding', 'Horsens', 'Silkeborg', 'Næstved', 'Svendborg', 'Haderslev', 'Holbæk', 'Slagelse', 'Hjørring', 'Skagen', 'Nyborg'] },
  { key: 'rome', lat: 41.9, lon: 12.5, name: 'Romerriget', adj: 'romersk',  color: '#7d4bb8',
    cities: ['Roma', 'Antium', 'Capua', 'Ravenna', 'Neapolis', 'Arretium', 'Mediolanum', 'Pompeji', 'Brundisium', 'Tarentum', 'Verona', 'Genua', 'Florentia', 'Ostia', 'Aquileia', 'Placentia'] },
  { key: 'egypt', lat: 30.0, lon: 31.2, name: 'Egypten',  adj: 'egyptisk',  color: '#e0a526',
    cities: ['Theben', 'Memfis', 'Heliopolis', 'Alexandria', 'Giza', 'Abydos', 'Elefantine', 'Tanis', 'Edfu', 'Karnak', 'Amarna', 'Sais', 'Bubastis', 'Avaris'] },
  { key: 'china', lat: 34.3, lon: 108.9, name: 'Kina',     adj: 'kinesisk',  color: '#2f9c5a',
    cities: ['Beijing', 'Xi\'an', 'Nanjing', 'Luoyang', 'Kaifeng', 'Hangzhou', 'Guangzhou', 'Chengdu', 'Suzhou', 'Wuhan', 'Tianjin', 'Shanghai', 'Datong', 'Lanzhou'] },
  { key: 'aztec', lat: 19.4, lon: -99.1, name: 'Aztekerne', adj: 'aztekisk', color: '#1fa3a8',
    cities: ['Tenochtitlan', 'Texcoco', 'Tlacopan', 'Tlatelolco', 'Xochimilco', 'Chalco', 'Coyoacan', 'Azcapotzalco', 'Tula', 'Cholula', 'Teotihuacan', 'Malinalco'] },
  { key: 'mongol', lat: 47.9, lon: 106.9, name: 'Mongoliet', adj: 'mongolsk', color: '#e2662b',
    cities: ['Karakorum', 'Kharkhorin', 'Darkhan', 'Erdenet', 'Khovd', 'Ölgii', 'Choibalsan', 'Mörön', 'Bayankhongor', 'Altai', 'Zuunmod', 'Sükhbaatar'] },
  { key: 'greece', lat: 38.0, lon: 23.7, name: 'Grækenland', adj: 'græsk',  color: '#2f6fd1',
    cities: ['Athen', 'Sparta', 'Korinth', 'Argos', 'Delfi', 'Olympia', 'Rhodos', 'Knossos', 'Milet', 'Efesos', 'Pergamon', 'Byzans', 'Syrakus', 'Megara'] },
];

// Bystater. type: handel (+guld), sofart (+mad i hovedstaden), militaer (gaver i form af enheder)
const MINORS = [
  { key: 'venedig', lat: 45.4, lon: 12.3,  name: 'Venedig',  type: 'handel',   color: '#d9d2b8' },
  { key: 'zanzibar', lat: -6.2, lon: 39.2, name: 'Zanzibar', type: 'sofart',   color: '#9ad1c4' },
  { key: 'kabul', lat: 34.5, lon: 69.2,    name: 'Kabul',    type: 'militaer', color: '#b98c7a' },
  { key: 'monaco', lat: 43.7, lon: 7.4,   name: 'Monaco',   type: 'handel',   color: '#e6b8c8' },
  { key: 'ragusa', lat: 42.6, lon: 18.1,   name: 'Ragusa',   type: 'sofart',   color: '#a9bfe0' },
  { key: 'almaty', lat: 43.2, lon: 76.9,   name: 'Almaty',   type: 'militaer', color: '#c9b37c' },
  { key: 'byblos', lat: 34.1, lon: 35.6,   name: 'Byblos',   type: 'handel',   color: '#cfa6e0' },
  { key: 'hanoi', lat: 21.0, lon: 105.8,    name: 'Hanoi',    type: 'militaer', color: '#a7c98f' },
];
const MINOR_TYPES = {
  handel:   { name: 'Handelsby', bonus: 'Venner: +3 guld pr. tur (allieret: +5)' },
  sofart:   { name: 'Søfartsby', bonus: 'Venner: +2 mad i din hovedstad (allieret: +3)' },
  militaer: { name: 'Militærby', bonus: 'Venner: en enhed hver 15. tur (allieret: hver 10.)' },
};

const BARB = { key: 'barb', name: 'Barbarer', adj: 'barbarisk', color: '#3d3a36' };

const DIFFICULTY = {
  easy:   { name: 'Let',    ai: 0.8,  content: 5 },
  normal: { name: 'Normal', ai: 1.0,  content: 4 },
  hard:   { name: 'Svær',   ai: 1.35, content: 3 },
};

const MAPSIZES = {
  small:  { name: 'Lille',  w: 44, h: 28, minors: 3, natural: 3 },
  medium: { name: 'Mellem', w: 60, h: 38, minors: 5, natural: 5 },
  large:  { name: 'Stor',   w: 78, h: 48, minors: 7, natural: 7 },
};

const MAPTYPES = {
  continents: { name: 'Kontinenter' },
  pangaea:    { name: 'Pangæa' },
  islands:    { name: 'Øer' },
  earth:      { name: 'Jorden' },
};
// Størrelser for Jorden-kortet
const EARTH_SIZES = { small: { w: 64, h: 36 }, medium: { w: 84, h: 47 }, large: { w: 100, h: 56 } };

// Spiltempo: k ganges på omkostninger og vækst
const PACES = {
  quick:    { name: 'Hurtigt',  k: 0.67, turns: 270 },
  standard: { name: 'Standard', k: 1,    turns: 400 },
  epic:     { name: 'Episk',    k: 1.5,  turns: 600 },
};
const VICTORY_TYPES = {
  conquest: 'Erobring', space: 'Rumskib', culture: 'Kultur', diplo: 'Diplomati',
};

const GP_TYPES = { sci: 'gp_sci', mer: 'gp_mer', eng: 'gp_eng', gen: 'gp_gen' };

// Religioner (spillets egne) og trosretninger
const RELIGIONS = {
  sun:   { name: 'Solkulten',     color: '#F0C75A' },
  tree:  { name: 'Den Gamle Tro', color: '#8FCF6A' },
  star:  { name: 'Stjernevejen',  color: '#B9D4F2' },
  sea:   { name: 'Havets Orden',  color: '#6FC0E0' },
  light: { name: 'Lysets Lære',   color: '#F2A65A' },
  earth: { name: 'Jordens Kreds', color: '#D9B67A' },
  asa:   { name: 'Asatro',        color: '#E46C60' },
};
const BELIEFS = {
  tithe:     { kind: 'founder',  name: 'Tiende',         desc: '+1 guld i den hellige by for hver by, der følger religionen' },
  pilgrim:   { kind: 'founder',  name: 'Pilgrimme',      desc: '+1 tro i den hellige by for hver by, der følger religionen' },
  council:   { kind: 'founder',  name: 'Kirkeråd',       desc: '+1 kultur i den hellige by for hver anden by, der følger religionen' },
  monastery: { kind: 'follower', name: 'Klostre',        desc: '+2 forskning i byer, der følger religionen' },
  feasts:    { kind: 'follower', name: 'Fester',         desc: '+1 tilfredshed i byer, der følger religionen' },
  fields:    { kind: 'follower', name: 'Hellige marker', desc: '+1 mad i byer, der følger religionen' },
  guilds:    { kind: 'follower', name: 'Laug',           desc: '+10 % produktion i byer, der følger religionen' },
  peace:     { kind: 'follower', name: 'Fredens bud',    desc: '+20 % forsvar i byer, der følger religionen' },
  charity:   { kind: 'follower', name: 'Næstekærlighed', desc: '+2 guld i byer, der følger religionen' },
};

// Sejrsformer
const VICTORY = { culture: 18000, cultureWonders: 4, unEvery: 10 };
