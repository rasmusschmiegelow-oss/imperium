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
const RESOURCES = {
  wheat:  { name: 'Hvede',    f: 2, p: 0, t: 0, on: ['grass', 'plains'],           glyph: '🌾' },
  cattle: { name: 'Kvæg',     f: 1, p: 1, t: 0, on: ['grass'],                     glyph: '🐄' },
  horses: { name: 'Heste',    f: 0, p: 2, t: 0, on: ['plains', 'grass', 'tundra'], glyph: '🐎' },
  iron:   { name: 'Jern',     f: 0, p: 2, t: 0, on: ['hills', 'tundra'],           glyph: '⛏' },
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
  horseman:  { name: 'Rytter',        cost: 60,  str: 12, moves: 4, cls: 'mounted', tech: 'riding',   glyph: '🐴', obs: 'chivalry', up: 'knight' },
  swordsman: { name: 'Sværdkæmper',   cost: 70,  str: 14, moves: 2, cls: 'melee',   tech: 'iron',     glyph: '⚔', obs: 'gunpowder', up: 'musketeer' },
  catapult:  { name: 'Katapult',      cost: 80,  str: 7,  ranged: 14, range: 2, moves: 2, cls: 'siege', tech: 'math', glyph: '☄', obs: 'metallurgy', up: 'cannon' },
  pikeman:   { name: 'Pikenér',       cost: 80,  str: 16, moves: 2, cls: 'melee',   tech: 'feudal',   glyph: '🗡', antiMounted: true, obs: 'gunpowder', up: 'musketeer' },
  knight:    { name: 'Ridder',        cost: 100, str: 20, moves: 4, cls: 'mounted', tech: 'chivalry', glyph: '🛡', obs: 'combustion', up: 'tank' },
  crossbow:  { name: 'Armbrøstskytte', cost: 90, str: 12, ranged: 18, range: 2, moves: 2, cls: 'ranged', tech: 'university', glyph: '🎯', obs: 'ballistics', up: 'artillery' },
  musketeer: { name: 'Musketer',      cost: 120, str: 24, moves: 2, cls: 'melee',   tech: 'gunpowder', glyph: '💥', obs: 'rifling', up: 'rifleman' },
  cannon:    { name: 'Kanon',         cost: 140, str: 14, ranged: 26, range: 2, moves: 2, cls: 'siege', tech: 'metallurgy', glyph: '💣', obs: 'ballistics', up: 'artillery' },
  rifleman:  { name: 'Riffelskytte',  cost: 180, str: 34, moves: 2, cls: 'melee',   tech: 'rifling',  glyph: '🎖', obs: 'combustion', up: 'infantry' },
  artillery: { name: 'Artilleri',     cost: 220, str: 20, ranged: 42, range: 3, moves: 2, cls: 'siege', tech: 'ballistics', glyph: '🎇' },
  infantry:  { name: 'Infanteri',     cost: 250, str: 50, moves: 2, cls: 'melee',   tech: 'combustion', glyph: '🪖' },
  tank:      { name: 'Kampvogn',      cost: 300, str: 70, moves: 5, cls: 'armor',   tech: 'combustion', glyph: '🚜' },
  // skibe
  galley:    { name: 'Galej',         cost: 50,  str: 9,  moves: 3, cls: 'naval', domain: 'sea', coastOnly: true, tech: 'sailing', glyph: '⛵', obs: 'industry', up: 'ironclad' },
  frigate:   { name: 'Fregat',        cost: 120, str: 14, ranged: 22, range: 2, moves: 4, cls: 'naval', domain: 'sea', tech: 'gunpowder', glyph: '🚢', obs: 'combustion', up: 'battleship' },
  ironclad:  { name: 'Jernklædt',     cost: 180, str: 40, moves: 4, cls: 'naval', domain: 'sea', tech: 'industry', glyph: '⚓', up: 'battleship' },
  battleship:{ name: 'Slagskib',      cost: 320, str: 50, ranged: 60, range: 3, moves: 5, cls: 'naval', domain: 'sea', tech: 'combustion', glyph: '🛳' },
  // store personligheder (kan ikke bygges)
  gp_sci:    { name: 'Videnskabsmand', cost: 0, str: 0, moves: 2, cls: 'civil', gp: true, glyph: '🔬', desc: 'Kan bruges til et stort forskningsspring.' },
  gp_mer:    { name: 'Købmand',       cost: 0, str: 0, moves: 2, cls: 'civil', gp: true, glyph: '💰', desc: 'Kan gennemføre en handelsmission for guld.' },
  gp_eng:    { name: 'Ingeniør',      cost: 0, str: 0, moves: 2, cls: 'civil', gp: true, glyph: '📐', desc: 'Giver 300 produktion til byen, den står i.' },
  gp_gen:    { name: 'General',       cost: 0, str: 0, moves: 3, cls: 'civil', gp: true, glyph: '🎺', desc: 'Egne enheder inden for 2 felter får +25 % styrke.' },
};

const BUILDINGS = {
  granary:    { name: 'Kornkammer',   cost: 60,  upkeep: 1, tech: 'pottery',    desc: '+2 mad' },
  barracks:   { name: 'Kaserne',      cost: 50,  upkeep: 1, tech: 'bronze',     desc: 'Nye enheder bliver veteraner (+25 % styrke)', gp: 'gen' },
  watermill:  { name: 'Vandmølle',    cost: 70,  upkeep: 1, tech: 'wheel',      desc: '+2 produktion. Byen skal ligge ved en flod', river: true, gp: 'eng' },
  walls:      { name: 'Bymur',        cost: 70,  upkeep: 1, tech: 'masonry',    desc: 'Byens forsvar +50 %', gp: 'gen' },
  library:    { name: 'Bibliotek',    cost: 80,  upkeep: 1, tech: 'writing',    desc: '+50 % forskning', gp: 'sci' },
  market:     { name: 'Marked',       cost: 90,  upkeep: 0, tech: 'currency',   desc: '+50 % guld, +1 tilfredshed, +1 handelsrute', happy: 1, gp: 'mer' },
  temple:     { name: 'Tempel',       cost: 60,  upkeep: 1, tech: 'philosophy', desc: '+2 tilfredshed, +3 kultur', happy: 2 },
  arena:      { name: 'Arena',        cost: 100, upkeep: 2, tech: 'construction', desc: '+3 tilfredshed', happy: 3 },
  aqueduct:   { name: 'Akvædukt',     cost: 110, upkeep: 1, tech: 'construction', desc: 'Byen kan vokse over 8 indbyggere' },
  harbor:     { name: 'Havn',         cost: 90,  upkeep: 1, tech: 'sailing',    desc: '+1 mad fra havfelter. Kun kystbyer', coastal: true, gp: 'mer' },
  university: { name: 'Universitet',  cost: 160, upkeep: 2, tech: 'university', desc: '+50 % forskning', gp: 'sci' },
  bank:       { name: 'Bank',         cost: 150, upkeep: 0, tech: 'banking',    desc: '+50 % guld, +1 handelsrute', gp: 'mer' },
  cathedral:  { name: 'Katedral',     cost: 140, upkeep: 2, tech: 'banking',    desc: '+3 tilfredshed', happy: 3 },
  workshop:   { name: 'Værksted',     cost: 120, upkeep: 1, tech: 'iron',       desc: '+25 % produktion', gp: 'eng' },
  factory:    { name: 'Fabrik',       cost: 240, upkeep: 3, tech: 'industry',   desc: '+50 % produktion', gp: 'eng' },
  powerplant: { name: 'Kraftværk',    cost: 260, upkeep: 3, tech: 'electricity', desc: '+50 % produktion', gp: 'eng' },
  lab:        { name: 'Forskningslab', cost: 280, upkeep: 3, tech: 'computers', desc: '+75 % forskning', gp: 'sci' },
};

const WONDERS = {
  pyramids:  { name: 'Pyramiderne',          cost: 180, tech: 'masonry',    desc: '+25 % produktion i byen', gp: 'eng' },
  gardens:   { name: 'De Hængende Haver',    cost: 200, tech: 'pottery',    desc: '+1 tilfredshed i alle dine byer' },
  colossus:  { name: 'Kolossen',             cost: 160, tech: 'bronze',     desc: '+1 handel på alle havfelter byen arbejder', gp: 'mer' },
  library:   { name: 'Det Store Bibliotek',  cost: 260, tech: 'philosophy', desc: '+8 forskning i byen', gp: 'sci' },
  greatwall: { name: 'Den Kinesiske Mur',    cost: 240, tech: 'construction', desc: 'Alle dine byer får bymurens forsvar', gp: 'gen' },
  newton:    { name: 'Newtons Kollegium',    cost: 420, tech: 'gravity',    desc: '+100 % forskning i byen', gp: 'sci' },
  adamsmith: { name: 'Adam Smiths Handelshus', cost: 450, tech: 'banking',  desc: 'Betaler vedligehold for alle bygninger med 1 i upkeep', gp: 'mer' },
  hoover:    { name: 'Hoover-dæmningen',     cost: 600, tech: 'electricity', desc: '+25 % produktion i alle byer', gp: 'eng' },
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
  industry:     { name: 'Industrialisering', cost: 580,  pre: ['metallurgy', 'banking'], era: 4 },
  rifling:      { name: 'Riffelløb',         cost: 620,  pre: ['industry'],             era: 4 },
  electricity:  { name: 'Elektricitet',      cost: 680,  pre: ['gravity', 'industry'],  era: 4 },
  ballistics:   { name: 'Ballistik',         cost: 740,  pre: ['rifling'],              era: 4 },
  combustion:   { name: 'Forbrændingsmotor', cost: 860,  pre: ['electricity', 'rifling'], era: 5 },
  computers:    { name: 'Computere',         cost: 960,  pre: ['electricity'],          era: 5 },
  rocketry:     { name: 'Raketter',          cost: 1150, pre: ['computers', 'combustion'], era: 5 },
  spaceflight:  { name: 'Rumfart',           cost: 1450, pre: ['rocketry'],             era: 5 },
};
// Ekstra effekter der vises i teknologitræet
const TECH_NOTES = {
  sailing: 'Landenheder kan sejle langs kysten',
  astronomy: 'Landenheder kan krydse åbent hav, +1 mad fra havet',
  industry: '+1 mad fra farme',
};

const ERAS = ['Oldtiden', 'Klassisk tid', 'Middelalderen', 'Renæssancen', 'Industritiden', 'Moderne tid'];

const IMPROVEMENT_TECH = { farm: 'agriculture', mine: 'mining', road: 'wheel', chop: 'bronze' };

const CIVS = [
  { key: 'dk', name: 'Danmark',    adj: 'dansk',     color: '#c8293b',
    cities: ['København', 'Aarhus', 'Odense', 'Roskilde', 'Ribe', 'Aalborg', 'Viborg', 'Esbjerg', 'Vejle', 'Helsingør', 'Randers', 'Kolding', 'Horsens', 'Silkeborg', 'Næstved', 'Svendborg', 'Haderslev', 'Holbæk', 'Slagelse', 'Hjørring', 'Skagen', 'Nyborg'] },
  { key: 'rome', name: 'Romerriget', adj: 'romersk',  color: '#7d4bb8',
    cities: ['Roma', 'Antium', 'Capua', 'Ravenna', 'Neapolis', 'Arretium', 'Mediolanum', 'Pompeji', 'Brundisium', 'Tarentum', 'Verona', 'Genua', 'Florentia', 'Ostia', 'Aquileia', 'Placentia'] },
  { key: 'egypt', name: 'Egypten',  adj: 'egyptisk',  color: '#e0a526',
    cities: ['Theben', 'Memfis', 'Heliopolis', 'Alexandria', 'Giza', 'Abydos', 'Elefantine', 'Tanis', 'Edfu', 'Karnak', 'Amarna', 'Sais', 'Bubastis', 'Avaris'] },
  { key: 'china', name: 'Kina',     adj: 'kinesisk',  color: '#2f9c5a',
    cities: ['Beijing', 'Xi\'an', 'Nanjing', 'Luoyang', 'Kaifeng', 'Hangzhou', 'Guangzhou', 'Chengdu', 'Suzhou', 'Wuhan', 'Tianjin', 'Shanghai', 'Datong', 'Lanzhou'] },
  { key: 'aztec', name: 'Aztekerne', adj: 'aztekisk', color: '#1fa3a8',
    cities: ['Tenochtitlan', 'Texcoco', 'Tlacopan', 'Tlatelolco', 'Xochimilco', 'Chalco', 'Coyoacan', 'Azcapotzalco', 'Tula', 'Cholula', 'Teotihuacan', 'Malinalco'] },
  { key: 'mongol', name: 'Mongoliet', adj: 'mongolsk', color: '#e2662b',
    cities: ['Karakorum', 'Kharkhorin', 'Darkhan', 'Erdenet', 'Khovd', 'Ölgii', 'Choibalsan', 'Mörön', 'Bayankhongor', 'Altai', 'Zuunmod', 'Sükhbaatar'] },
  { key: 'greece', name: 'Grækenland', adj: 'græsk',  color: '#2f6fd1',
    cities: ['Athen', 'Sparta', 'Korinth', 'Argos', 'Delfi', 'Olympia', 'Rhodos', 'Knossos', 'Milet', 'Efesos', 'Pergamon', 'Byzans', 'Syrakus', 'Megara'] },
];

// Bystater. type: handel (+guld), sofart (+mad i hovedstaden), militaer (gaver i form af enheder)
const MINORS = [
  { key: 'venedig',  name: 'Venedig',  type: 'handel',   color: '#d9d2b8' },
  { key: 'zanzibar', name: 'Zanzibar', type: 'sofart',   color: '#9ad1c4' },
  { key: 'kabul',    name: 'Kabul',    type: 'militaer', color: '#b98c7a' },
  { key: 'monaco',   name: 'Monaco',   type: 'handel',   color: '#e6b8c8' },
  { key: 'ragusa',   name: 'Ragusa',   type: 'sofart',   color: '#a9bfe0' },
  { key: 'almaty',   name: 'Almaty',   type: 'militaer', color: '#c9b37c' },
  { key: 'byblos',   name: 'Byblos',   type: 'handel',   color: '#cfa6e0' },
  { key: 'hanoi',    name: 'Hanoi',    type: 'militaer', color: '#a7c98f' },
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
  small:  { name: 'Lille',  w: 44, h: 28, minors: 3 },
  medium: { name: 'Mellem', w: 60, h: 38, minors: 5 },
  large:  { name: 'Stor',   w: 78, h: 48, minors: 7 },
};

const MAPTYPES = {
  continents: { name: 'Kontinenter' },
  pangaea:    { name: 'Pangæa' },
  islands:    { name: 'Øer' },
};

const GP_TYPES = { sci: 'gp_sci', mer: 'gp_mer', eng: 'gp_eng', gen: 'gp_gen' };
