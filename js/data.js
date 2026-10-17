// Spildata: terræn, ressourcer, enheder, bygninger, vidundere, teknologier og civilisationer.
'use strict';

const TERRAIN = {
  ocean:    { name: 'Hav',      f: 1, p: 0, t: 1, move: 99, water: true,  def: 0,    color: '#1d4e74' },
  coast:    { name: 'Kyst',     f: 1, p: 0, t: 2, move: 99, water: true,  def: 0,    color: '#2f7aa3' },
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

const RESOURCES = {
  wheat:  { name: 'Hvede',   f: 2, p: 0, t: 0, on: ['grass', 'plains'],          glyph: '🌾' },
  cattle: { name: 'Kvæg',    f: 1, p: 1, t: 0, on: ['grass'],                    glyph: '🐄' },
  horses: { name: 'Heste',   f: 0, p: 2, t: 0, on: ['plains', 'grass', 'tundra'], glyph: '🐎' },
  iron:   { name: 'Jern',    f: 0, p: 2, t: 0, on: ['hills', 'tundra'],          glyph: '⛏' },
  gold:   { name: 'Guld',    f: 0, p: 0, t: 4, on: ['hills', 'desert'],          glyph: '🪙' },
  fish:   { name: 'Fisk',    f: 2, p: 0, t: 0, on: ['coast'],                    glyph: '🐟' },
  gems:   { name: 'Ædelsten', f: 0, p: 0, t: 4, on: ['jungle'],                  glyph: '💎' },
  deer:   { name: 'Hjorte',  f: 1, p: 1, t: 0, on: ['forest', 'tundra'],         glyph: '🦌' },
  oasis:  { name: 'Oase',    f: 3, p: 0, t: 2, on: ['desert'],                   glyph: '🌴' },
};

// cls: civil, melee, ranged, mounted, siege, armor
const UNITS = {
  settler:   { name: 'Bosætter',      cost: 60,  str: 0,  moves: 2, cls: 'civil',   tech: null,            glyph: '🏕', desc: 'Grundlægger nye byer. Byen mister 1 indbygger.' },
  worker:    { name: 'Arbejder',      cost: 40,  str: 0,  moves: 2, cls: 'civil',   tech: null,            glyph: '⚒', desc: 'Bygger farme, miner og veje.' },
  scout:     { name: 'Spejder',       cost: 25,  str: 4,  moves: 3, cls: 'melee',   tech: null,            glyph: '🔭', obs: 'feudal', desc: 'Hurtig opdagelsesrejsende.' },
  warrior:   { name: 'Kriger',        cost: 30,  str: 6,  moves: 2, cls: 'melee',   tech: null,            glyph: '🪓', obs: 'iron' },
  archer:    { name: 'Bueskytte',     cost: 40,  str: 5,  ranged: 7,  range: 2, moves: 2, cls: 'ranged', tech: 'archery', glyph: '🏹', obs: 'gunpowder' },
  spearman:  { name: 'Spydkæmper',    cost: 50,  str: 10, moves: 2, cls: 'melee',   tech: 'bronze',        glyph: '🔱', antiMounted: true, obs: 'feudal' },
  horseman:  { name: 'Rytter',        cost: 60,  str: 12, moves: 4, cls: 'mounted', tech: 'riding',        glyph: '🐴', obs: 'chivalry' },
  swordsman: { name: 'Sværdkæmper',   cost: 70,  str: 14, moves: 2, cls: 'melee',   tech: 'iron',          glyph: '⚔', obs: 'gunpowder' },
  catapult:  { name: 'Katapult',      cost: 80,  str: 7,  ranged: 14, range: 2, moves: 2, cls: 'siege', tech: 'math', glyph: '☄', obs: 'metallurgy' },
  pikeman:   { name: 'Pikenér',       cost: 80,  str: 16, moves: 2, cls: 'melee',   tech: 'feudal',        glyph: '🗡', antiMounted: true, obs: 'gunpowder' },
  knight:    { name: 'Ridder',        cost: 100, str: 20, moves: 4, cls: 'mounted', tech: 'chivalry',      glyph: '🛡', obs: 'combustion' },
  crossbow:  { name: 'Armbrøstskytte', cost: 90, str: 12, ranged: 18, range: 2, moves: 2, cls: 'ranged', tech: 'university', glyph: '🎯', obs: 'ballistics' },
  musketeer: { name: 'Musketer',      cost: 120, str: 24, moves: 2, cls: 'melee',   tech: 'gunpowder',     glyph: '💥', obs: 'rifling' },
  cannon:    { name: 'Kanon',         cost: 140, str: 14, ranged: 26, range: 2, moves: 2, cls: 'siege', tech: 'metallurgy', glyph: '💣', obs: 'ballistics' },
  rifleman:  { name: 'Riffelskytte',  cost: 180, str: 34, moves: 2, cls: 'melee',   tech: 'rifling',       glyph: '🎖', obs: 'combustion' },
  artillery: { name: 'Artilleri',     cost: 220, str: 20, ranged: 42, range: 3, moves: 2, cls: 'siege', tech: 'ballistics', glyph: '🎇' },
  infantry:  { name: 'Infanteri',     cost: 250, str: 50, moves: 2, cls: 'melee',   tech: 'combustion',    glyph: '🪖' },
  tank:      { name: 'Kampvogn',      cost: 300, str: 70, moves: 5, cls: 'armor',   tech: 'combustion',    glyph: '🚜' },
};

const BUILDINGS = {
  granary:    { name: 'Kornkammer',   cost: 60,  upkeep: 1, tech: 'pottery',    desc: '+2 mad' },
  barracks:   { name: 'Kaserne',      cost: 50,  upkeep: 1, tech: 'bronze',     desc: 'Nye enheder bliver veteraner (+25 % styrke)' },
  walls:      { name: 'Bymur',        cost: 70,  upkeep: 1, tech: 'masonry',    desc: 'Byens forsvar +100 %' },
  library:    { name: 'Bibliotek',    cost: 80,  upkeep: 1, tech: 'writing',    desc: '+50 % forskning' },
  market:     { name: 'Marked',       cost: 90,  upkeep: 0, tech: 'currency',   desc: '+50 % guld' },
  temple:     { name: 'Tempel',       cost: 60,  upkeep: 1, tech: 'philosophy', desc: '+3 kultur, grænser vokser hurtigere' },
  aqueduct:   { name: 'Akvædukt',     cost: 110, upkeep: 1, tech: 'construction', desc: 'Byen kan vokse over 8 indbyggere' },
  university: { name: 'Universitet',  cost: 160, upkeep: 2, tech: 'university', desc: '+50 % forskning' },
  bank:       { name: 'Bank',         cost: 150, upkeep: 0, tech: 'banking',    desc: '+50 % guld' },
  workshop:   { name: 'Værksted',     cost: 120, upkeep: 1, tech: 'iron',       desc: '+25 % produktion' },
  factory:    { name: 'Fabrik',       cost: 240, upkeep: 3, tech: 'industry',   desc: '+50 % produktion' },
  powerplant: { name: 'Kraftværk',    cost: 260, upkeep: 3, tech: 'electricity', desc: '+50 % produktion' },
  lab:        { name: 'Forskningslab', cost: 280, upkeep: 3, tech: 'computers', desc: '+75 % forskning' },
};

const WONDERS = {
  pyramids:  { name: 'Pyramiderne',          cost: 180, tech: 'masonry',    desc: '+25 % produktion i byen' },
  gardens:   { name: 'De Hængende Haver',    cost: 200, tech: 'pottery',    desc: '+1 mad i alle dine byer' },
  colossus:  { name: 'Kolossen',             cost: 160, tech: 'bronze',     desc: '+1 handel på alle havfelter byen arbejder' },
  library:   { name: 'Det Store Bibliotek',  cost: 260, tech: 'philosophy', desc: '+8 forskning i byen' },
  greatwall: { name: 'Den Kinesiske Mur',    cost: 240, tech: 'construction', desc: 'Alle dine byer får bymurens forsvar' },
  newton:    { name: 'Newtons Kollegium',    cost: 420, tech: 'gravity',    desc: '+100 % forskning i byen' },
  adamsmith: { name: 'Adam Smiths Handelshus', cost: 450, tech: 'banking',  desc: 'Betaler vedligehold for alle bygninger med 1 i upkeep' },
  hoover:    { name: 'Hoover-dæmningen',     cost: 600, tech: 'electricity', desc: '+25 % produktion i alle byer' },
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
  astronomy:    { name: 'Astronomi',         cost: 210,  pre: ['math', 'philosophy'],   era: 2 },
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

const ERAS = ['Oldtiden', 'Klassisk tid', 'Middelalderen', 'Renæssancen', 'Industritiden', 'Moderne tid'];

// Hvad en teknologi låser op (bruges i teknologitræet)
const IMPROVEMENT_TECH = { farm: 'agriculture', mine: 'mining', road: 'wheel', chop: 'bronze' };

const CIVS = [
  { key: 'dk', name: 'Danmark',    adj: 'dansk',     color: '#c8293b', light: '#f3b3ba',
    cities: ['København', 'Aarhus', 'Odense', 'Roskilde', 'Ribe', 'Aalborg', 'Viborg', 'Esbjerg', 'Vejle', 'Helsingør', 'Randers', 'Kolding', 'Horsens', 'Silkeborg', 'Næstved', 'Svendborg', 'Haderslev', 'Holbæk', 'Slagelse', 'Hjørring', 'Skagen', 'Nyborg'] },
  { key: 'rome', name: 'Romerriget', adj: 'romersk',  color: '#7d4bb8', light: '#d6c2ee',
    cities: ['Roma', 'Antium', 'Capua', 'Ravenna', 'Neapolis', 'Arretium', 'Mediolanum', 'Pompeji', 'Brundisium', 'Tarentum', 'Verona', 'Genua', 'Florentia', 'Ostia', 'Aquileia', 'Placentia'] },
  { key: 'egypt', name: 'Egypten',  adj: 'egyptisk',  color: '#e0a526', light: '#f6e0a6',
    cities: ['Theben', 'Memfis', 'Heliopolis', 'Alexandria', 'Giza', 'Abydos', 'Elefantine', 'Tanis', 'Edfu', 'Karnak', 'Amarna', 'Sais', 'Bubastis', 'Avaris'] },
  { key: 'china', name: 'Kina',     adj: 'kinesisk',  color: '#2f9c5a', light: '#b5e3c6',
    cities: ['Beijing', 'Xi\'an', 'Nanjing', 'Luoyang', 'Kaifeng', 'Hangzhou', 'Guangzhou', 'Chengdu', 'Suzhou', 'Wuhan', 'Tianjin', 'Shanghai', 'Datong', 'Lanzhou'] },
  { key: 'aztec', name: 'Aztekerne', adj: 'aztekisk', color: '#1fa3a8', light: '#ade4e6',
    cities: ['Tenochtitlan', 'Texcoco', 'Tlacopan', 'Tlatelolco', 'Xochimilco', 'Chalco', 'Coyoacan', 'Azcapotzalco', 'Tula', 'Cholula', 'Teotihuacan', 'Malinalco'] },
  { key: 'mongol', name: 'Mongoliet', adj: 'mongolsk', color: '#e2662b', light: '#f6c3a9',
    cities: ['Karakorum', 'Kharkhorin', 'Darkhan', 'Erdenet', 'Khovd', 'Ölgii', 'Choibalsan', 'Mörön', 'Bayankhongor', 'Altai', 'Zuunmod', 'Sükhbaatar'] },
  { key: 'greece', name: 'Grækenland', adj: 'græsk',  color: '#2f6fd1', light: '#b3cbf3',
    cities: ['Athen', 'Sparta', 'Korinth', 'Argos', 'Delfi', 'Olympia', 'Rhodos', 'Knossos', 'Milet', 'Efesos', 'Pergamon', 'Byzans', 'Syrakus', 'Megara'] },
];

const DIFFICULTY = {
  easy:   { name: 'Let',    ai: 0.8 },
  normal: { name: 'Normal', ai: 1.0 },
  hard:   { name: 'Svær',   ai: 1.35 },
};

const MAPSIZES = {
  small:  { name: 'Lille',  w: 40, h: 26 },
  medium: { name: 'Mellem', w: 56, h: 36 },
  large:  { name: 'Stor',   w: 72, h: 46 },
};
