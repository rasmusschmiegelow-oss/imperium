// Grafik fra Paper-filen "Imperium · Grafik": graverede stregikoner og terrænfelter,
// tegnet som Path2D på kortets canvas.
'use strict';

// Billeder kan stadig lægges i ART.images['unit_<type>'] osv. og bruges så i stedet.
const ART = (() => {
  const circ = (cx, cy, r) => `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0`;

  // Enhedsikoner: 48×48-gitter, hvid streg. `dots` er udfyldte prikker.
  const UNIT_ICONS = {
    settler: ['M8 39 L24 13 L40 39 Z', 'M24 39 V28 L19 39', 'M24 13 V5', 'M24 5 H33 L30.5 8 L33 11 H24', 'M5 39 H43'],
    worker: ['M12 40 L30 22', 'M26 12 L36 22 L32 26 L22 16 Z', 'M36 40 L20 24', 'M11 13 Q18 11 21 19 Q13 22 11 13 Z'],
    scout: ['M8 27 L31 14 L34 19.5 L11 32.5 Z', 'M31 14 L38 10.5 L41 16 L34 19.5', 'M20 26 L14 41', 'M20 26 L27 41', 'M20 26 V41'],
    warrior: ['M15 42 L31 9', 'M27 12 Q38 11 39 23 Q33 18 25.5 18', 'M13 38 L18 40'],
    archer: ['M15 7 Q38 24 15 41', 'M15 7 V41', 'M9 24 H41', 'M36 19.5 L41 24 L36 28.5', 'M11 20.5 L8 24 L11 27.5'],
    spearman: ['M32 43 V13', 'M32 4 L36 13 H28 Z', circ(19, 29, 10), circ(19, 29, 3)],
    horseman: ['M15 42 Q13 30 18 22 Q15 14 21 7 L23 12 Q33 12 38 23 Q39 27 35 28 L28 25 Q26 33 30 42', 'M21 12 Q17 18 18 22'],
    swordsman: ['M10 10 L33 33', 'M38 10 L15 33', 'M29 37 L37 29', 'M11 29 L19 37', 'M34 34 L39 39', 'M14 34 L9 39'],
    catapult: [circ(14, 37, 4), circ(34, 37, 4), 'M7 32 H41', 'M15 32 L35 11', circ(37.5, 9, 3), 'M25 32 L28 21'],
    pikeman: ['M22 44 V10', 'M22 3 L25.5 10 H18.5 Z', 'M22 13 Q32 12 33 22 L22 19', 'M22 15 L15 18'],
    knight: ['M13 9 H35 V22 Q35 35 24 41 Q13 35 13 22 Z', 'M24 14 V34', 'M17 21 H31'],
    crossbow: ['M24 8 V41', 'M9 19 Q24 9 39 19', 'M9 19 L24 26 L39 19', 'M24 41 H29', 'M21 4 L24 8 L27 4'],
    musketeer: ['M7 35 L34 19', 'M7 35 L10 41 L17 37 L13 31.5', 'M18 29 L20 32', circ(38.5, 15.5, 3), circ(42, 9, 2), circ(35, 9.5, 1.5)],
    cannon: ['M9 27 L36 15 L38.5 21 L11.5 32.5 Z', circ(18, 34, 7), 'M18 27 V41', 'M11 34 H25', 'M24 39 L40 41'],
    rifleman: ['M10 38 L38 10', 'M38 10 L43 5', 'M10 38 L7 41 L12 44 L16 38.5', 'M18 30 L22 34', 'M14 31 Q22 22 31 22'],
    artillery: ['M20 27 L42 9', 'M13 22 H27 V32 H13 Z', circ(20, 36, 5.5), 'M15 38 L6 42', 'M25 38 L38 42'],
    infantry: ['M10 29 Q10 13 24 13 Q38 13 38 29', 'M5 29 H43', 'M14 29 Q24 41 34 29', 'M17 20 Q24 17 31 20'],
    tank: ['M6 29 H40 L36 37 H10 Z', 'M15 29 V22 Q15 19 18 19 H28 Q31 19 31 22 V29', 'M31 23 H45'],
    caravan: ['M6 27 Q9 19 15 22 Q19 10 26 20 Q29 15 33 21 H36 V12 L42 10 V15 L38 17 V28', 'M6 27 Q8 30 12 30 H38', 'M12 30 V41', 'M19 30 V41', 'M29 30 V41', 'M36 30 V41'],
    galley: ['M6 28 H42 L36 35 H12 Z', 'M24 28 V7', 'M24 9 Q35 15 24 24', 'M14 35 L10 42', 'M22 35 L19 42', 'M30 35 L28 42'],
    frigate: ['M5 31 H43 L38 39 H10 Z', 'M16 31 V8', 'M31 31 V6', 'M10 11 H22 L20 22 H12 Z', 'M25 9 H37 L35 22 H27 Z', 'M14 35 H15', 'M24 35 H25', 'M34 35 H35'],
    ironclad: ['M5 30 H43 L39 37 H9 Z', 'M13 30 V24 H33 V30', 'M20 24 V14 H26 V24', circ(26, 9, 3), circ(31, 6, 1.8)],
    battleship: ['M3 31 H45 L40 38 H8 Z', 'M18 31 V20 H29 V31', 'M23 20 V9', 'M19 13 H27', 'M8 31 V27 H14 V31', 'M33 31 V27 H39 V31', 'M14 28 H20', 'M39 28 H45'],
    gp_sci: ['M18 7 H30', 'M21 7 V19 L11 37 Q10 41 14 41 H34 Q38 41 37 37 L27 19 V7', 'M15 30 H33'],
    gp_mer: ['M24 7 V40', 'M15 40 H33', 'M9 13 H39', 'M9 13 L4 26 H14 Z', 'M39 13 L34 26 H44 Z'],
    gp_eng: ['M24 5 V9', circ(24, 12.5, 3.5), 'M22 16 L12 42', 'M26 16 L36 42', 'M16 32 Q24 35 32 32'],
    gp_gen: ['M14 43 V6', 'M14 8 H38 L32 15 L38 22 H14', 'M10 43 H18'],
    missionary: [circ(22, 10, 4), 'M22 14 L14 42 H30 Z', 'M36 8 V42', 'M33 12 H39'],
    fighter: ['M24 4 L27 16 L44 26 V30 L27 26 L26 38 L32 42 V44 L24 42 L16 44 V42 L22 38 L21 26 L4 30 V26 L21 16 Z'],
    bomber: ['M24 6 L26 18 L46 22 V27 L26 25 L25 36 L31 40 V42 L24 40 L17 42 V40 L23 36 L22 25 L2 27 V22 L22 18 Z', 'M12 20 V27', 'M36 20 V27'],
    aagun: ['M8 41 H40', 'M15 41 L19 30 H29 L33 41', 'M23 30 L35 8', 'M27 30 L39 10'],
  };
  // Ikoner til byggelisten og kortet: [stier, farve]
  const MISC_ICONS = {
    bld: [['M7 17 L24 7 L41 17 Z', 'M9 38 H39', 'M6 42 H42', 'M13 19 V36', 'M21 19 V36', 'M27 19 V36', 'M35 19 V36'], '#ECE6D8'],
    wonder: [['M4 40 L24 8 L44 40 Z', 'M24 8 L29 40', 'M13 26 H35'], '#EAD097'],
    spaceship: [['M24 4 Q32 12 32 28 V34 H16 V28 Q16 12 24 4 Z', circ(24, 18, 3), 'M16 27 L10 35 V40 L16 36', 'M32 27 L38 35 V40 L32 36', 'M20 38 L24 44 L28 38'], '#72B6EA'],
    wealth: [['M10 14 Q24 20 38 14', 'M10 14 Q24 8 38 14', 'M10 14 V34 Q24 40 38 34 V14', 'M10 24 Q24 30 38 24'], '#E8C34C'],
    camp: [['M8 39 L24 13 L40 39 Z', 'M24 39 L20 30 H28 Z', 'M17 6 L24 13 L31 6'], '#E46C60'],
    lock: [['M16 22 V16 Q16 8 24 8 Q32 8 32 16 V22', 'M11 22 H37 V40 H11 Z'], '#ECE6D8'],
    work: [['M12 40 L30 22', 'M26 12 L36 22 L32 26 L22 16 Z'], '#ECE6D8'],
    faith: [['M20 21 H28 V42 H20 Z', 'M24 21 V16', 'M24 5 Q29 10 24 15 Q19 10 24 5 Z'], '#C9A0E6'],
    shrine: [['M8 22 L24 10 L40 22', 'M12 22 V40 H36 V22', 'M20 40 V30 H28 V40'], '#ECE6D8'],
    rel_sun: [[circ(24, 24, 7), 'M24 5 V11', 'M24 37 V43', 'M5 24 H11', 'M37 24 H43', 'M10.5 10.5 L14.8 14.8', 'M33.2 33.2 L37.5 37.5', 'M37.5 10.5 L33.2 14.8', 'M14.8 33.2 L10.5 37.5'], '#F0C75A'],
    rel_tree: [['M24 42 V22', 'M24 22 Q14 22 12 14 Q18 6 24 12 Q30 6 36 14 Q34 22 24 22', 'M24 42 L17 44', 'M24 42 L31 44'], '#8FCF6A'],
    rel_star: [['M24 6 L28 18 L41 18 L30 26 L34 39 L24 31 L14 39 L18 26 L7 18 L20 18 Z'], '#B9D4F2'],
    rel_sea: [[circ(24, 13, 4), 'M6 27 Q12 21 18 27 T30 27 T42 27', 'M6 36 Q12 30 18 36 T30 36 T42 36'], '#6FC0E0'],
    rel_light: [['M24 7 Q32 18 28 26 Q26 30 24 30 Q22 30 20 26 Q16 18 24 7 Z', 'M14 35 H34', 'M18 41 H30'], '#F2A65A'],
    rel_earth: [[circ(24, 24, 17), 'M11 31 L19 21 L25 27 L30 22 L37 31'], '#D9B67A'],
    rel_asa: [['M13 9 H35 V19 H13 Z', 'M24 19 V42', 'M20 42 H28'], '#E46C60'],
    v_conquest: [['M10 42 V22 H16 V26 H21 V22 H27 V26 H32 V22 H38 V42 Z', 'M24 22 V6', 'M24 7 H34 L31 11 L34 15 H24'], '#E46C60'],
    v_culture: [['M14 10 Q10 28 24 40 Q38 28 34 10', 'M14 10 H34', 'M20 16 V34', 'M24 14 V38', 'M28 16 V34'], '#C99AE6'],
    v_diplo: [[circ(24, 22, 13), 'M11 22 H37', 'M24 9 Q17 22 24 35 Q31 22 24 9', 'M15 42 H33'], '#7FB3D1'],
    v_points: [['M14 8 H34 V16 Q34 28 24 28 Q14 28 14 16 Z', 'M24 28 V36', 'M16 40 H32', 'M14 12 H8 Q8 20 14 20', 'M34 12 H40 Q40 20 34 20'], '#E8C34C'],
    stats: [['M8 40 H42', 'M12 34 L20 24 L28 28 L38 12', 'M38 12 H32', 'M38 12 V18'], '#ECE6D8'],
    players: [[circ(16, 14, 5), 'M7 40 Q7 24 16 24 Q24 24 24 40', circ(32, 14, 5), 'M24 40 Q24 24 32 24 Q41 24 41 40'], '#ECE6D8'],
    // regeringsformer
    gov_despotism: [['M14 42 V20 H34 V42', 'M10 20 H38', 'M16 20 V9 L24 4 L32 9 V20', 'M14 31 H34'], '#EAD097'],
    gov_monarchy: [['M8 34 L10 14 L18 24 L24 10 L30 24 L38 14 L40 34 Z', 'M8 40 H40'], '#EAD097'],
    gov_republic: [['M24 41 Q12 35 10 20', 'M24 41 Q36 35 38 20', 'M12 26 Q7 25 8 20', 'M15 33 Q9 34 9 29', 'M36 26 Q41 25 40 20', 'M33 33 Q39 34 39 29', 'M10 20 Q9 14 13 12', 'M38 20 Q39 14 35 12'], '#EAD097'],
    gov_democracy: [['M10 22 H38 V42 H10 Z', 'M18 22 V8 H30 V22', 'M22 14 H26', 'M16 32 H32'], '#EAD097'],
    gov_communism: [[circ(24, 24, 9), circ(24, 24, 3), 'M24 6 V12', 'M24 36 V42', 'M6 24 H12', 'M36 24 H42', 'M11 11 L15 15', 'M33 33 L37 37', 'M37 11 L33 15', 'M15 33 L11 37'], '#EAD097'],
    gov_anarchy: [['M24 6 L20 20 L28 22 L22 42', 'M10 14 L16 18', 'M38 14 L32 18', 'M10 34 L16 30', 'M38 34 L32 30'], '#E46C60'],
    // diplomati
    dip_ob: [['M10 42 V17 Q24 4 38 17 V42', 'M16 42 V22 L21 26 V42', 'M32 42 V22 L27 26 V42'], '#ECE6D8'],
    dip_pact: [['M5 11 H21 V21 Q21 31 13 35 Q5 31 5 21 Z', 'M27 11 H43 V21 Q43 31 35 35 Q27 31 27 21 Z', 'M13 41 H35'], '#7CC47F'],
    dip_war: [['M10 38 L34 14', 'M29 10 H38 V19', 'M38 38 L14 14', 'M19 10 H10 V19'], '#E46C60'],
    dip_gift: [['M8 20 H40 V28 H8 Z', 'M11 28 V42 H37 V28', 'M24 20 V42', 'M24 20 Q14 7 11 13 Q10 20 24 20', 'M24 20 Q34 7 37 13 Q38 20 24 20'], '#E8C34C'],
    // verden
    ruin: [['M8 42 H40', 'M14 42 V20', 'M11 20 H17', 'M24 42 V30 L27 25 L21 23', 'M34 42 V14', 'M31 14 H37', 'M17 15 L29 10'], '#EAD097'],
    promo: [['M13 30 L24 21 L35 30', 'M13 39 L24 30 L35 39', 'M13 21 L24 12 L35 21'], '#EAD097'],
    nat_uluru: [['M5 35 Q9 23 18 21 Q30 17 38 23 Q43 27 43 35 Z', 'M5 40 H43'], '#E2895A'],
    nat_canyon: [['M4 17 H16 L20 29 H28 L32 17 H44', 'M20 29 L22 40 H26 L28 29', 'M4 23 H12', 'M36 23 H44'], '#E2A15A'],
    nat_kilimanjaro: [['M4 40 L20 12 L28 20 L32 16 L44 40 Z', 'M15 21 L20 12 L25 17 L21 21 Z'], '#ECE6D8'],
    nat_victoria: [['M8 10 H40', 'M14 10 V35', 'M22 10 V39', 'M30 10 V35', 'M38 10 V30', 'M8 41 Q24 35 40 41'], '#7FB3D1'],
    nat_reef: [['M8 40 Q10 30 16 32 Q16 22 22 26 Q24 14 28 24 Q34 18 34 30 Q40 28 40 40 Z'], '#E46C9A'],
    nat_fountain: [['M24 7 Q19 17 24 22 Q29 17 24 7 Z', 'M10 30 H38 L34 40 H14 Z', 'M16 26 Q24 19 32 26'], '#7CC4B0'],
    nat_fuji: [['M4 40 L18 16 H30 L44 40 Z', 'M18 16 L22 22 L26 18 L30 22'], '#ECE6D8'],
  };
  const UNIT_DOTS = {
    horseman: [[27, 17, 1.2]],
    tank: [[15, 33, 1.4], [23, 33, 1.4], [31, 33, 1.4]],
  };

  // Ressourcemærker: 48×48, bronze streg.
  const RES_ICONS = {
    wheat: ['M24 42 V10', 'M24 16 Q18 14 17 9 Q22 10 24 16 Q26 10 31 9 Q30 14 24 16', 'M24 25 Q18 23 17 18 Q22 19 24 25 Q26 19 31 18 Q30 23 24 25', 'M24 34 Q18 32 17 27 Q22 28 24 34 Q26 28 31 27 Q30 32 24 34'],
    cattle: ['M10 12 Q11 19 17 19', 'M38 12 Q37 19 31 19', 'M17 17 H31 L33 31 Q24 41 15 31 Z', 'M20 33 H20.5', 'M27.5 33 H28'],
    horses: ['M14 10 V24 Q14 38 24 38 Q34 38 34 24 V10', 'M10 10 H18', 'M30 10 H38'],
    iron: ['M8 34 L14 20 H34 L40 34 Z', 'M14 20 L18 14 H30 L34 20'],
    gold: [circ(24, 24, 14), circ(24, 24, 8), 'M24 20 V28'],
    fish: ['M6 24 Q18 11 32 24 Q18 37 6 24 Z', 'M32 24 L42 15 V33 Z', 'M14 22 H14.5'],
    gems: ['M10 18 L17 10 H31 L38 18 L24 40 Z', 'M10 18 H38', 'M19 18 L24 40 L29 18'],
    deer: ['M20 26 Q12 22 11 8', 'M14 18 L7 15', 'M28 26 Q36 22 37 8', 'M34 18 L41 15', 'M19 26 H29 L27 38 Q24 42 21 38 Z'],
    oasis: ['M24 36 Q27 24 24 14', 'M24 14 Q15 9 9 15', 'M24 14 Q33 9 39 15', 'M24 14 Q20 6 13 6', 'M24 14 Q28 6 35 6', 'M10 40 Q24 34 38 40'],
    wine: [circ(18, 21, 4.5), circ(28, 21, 4.5), circ(23, 29, 4.5), circ(23, 38, 3.5), 'M23 16 V9 Q28 6 33 9'],
    spices: ['M15 15 Q12 32 31 39 Q37 41 35 36 Q21 29 21 16 Z', 'M17 15 Q16 9 23 7'],
    furs: ['M12 13 Q24 7 36 13 L33 22 L39 35 L30 32 L24 41 L18 32 L9 35 L15 22 Z'],
    whales: ['M5 29 Q12 17 29 22 Q35 24 38 20 L44 15 L42 25 L38 27 Q34 37 18 35 Q8 35 5 29 Z', 'M19 17 Q19 11 15 8', 'M19 17 Q19 11 23 8'],
    silk: ['M13 9 H35', 'M13 39 H35', 'M17 9 V39', 'M31 9 V39', 'M17 17 L31 23', 'M17 25 L31 31'],
    coal: ['M10 32 L16 22 L26 24 L30 32 Z', 'M24 34 L30 26 L38 30 L36 38 Z', 'M12 38 L22 35'],
    oil: ['M24 6 Q36 22 36 30 Q36 41 24 41 Q12 41 12 30 Q12 22 24 6 Z', 'M18 30 Q18 35 23 36'],
  };

  // Terrændekoration i felt-koordinater (104×120, midte 52,60).
  // Hver post: {s: streg, w: bredde, f: udfyldning, d: [stier]}
  const TERRAIN_ART = {
    ocean: [{ s: '#4F7FA3', w: 2, d: ['M22 46 q6 -5 12 0 t12 0', 'M56 62 q6 -5 12 0 t12 0', 'M30 80 q6 -5 12 0 t12 0'] }],
    coast: [{ s: '#7FB3D1', w: 2, d: ['M24 50 q6 -5 12 0 t12 0', 'M54 70 q6 -5 12 0 t12 0'] }, { f: '#7FB3D1', d: [circ(70, 40, 1.6), circ(34, 78, 1.6)] }],
    grass: [{ s: '#4A7326', w: 2, d: ['M26 52 l3 -7 l3 7', 'M60 44 l3 -7 l3 7', 'M44 74 l3 -7 l3 7', 'M72 80 l3 -7 l3 7', 'M30 86 l3 -7 l3 7'] }],
    plains: [{ s: '#7E7B32', w: 2, d: ['M20 50 H40', 'M58 42 H84', 'M34 68 H62', 'M66 82 H82', 'M22 84 H38'] }],
    desert: [{ s: '#A88D45', w: 2, d: ['M18 62 Q32 50 46 62', 'M50 78 Q66 64 82 78', 'M56 44 Q66 36 76 44'] }, { f: '#A88D45', d: [circ(30, 80, 1.5), circ(40, 88, 1.5), circ(78, 56, 1.5)] }],
    tundra: [{ f: '#C7CEC1', d: ['M23 50 a9 3 0 1 0 18 0 a9 3 0 1 0 -18 0', 'M59 66 a11 3.5 0 1 0 22 0 a11 3.5 0 1 0 -22 0', 'M32 84 a8 2.5 0 1 0 16 0 a8 2.5 0 1 0 -16 0'] }, { s: '#66715D', w: 2, d: ['M62 42 l2 -5 l2 5', 'M24 70 l2 -5 l2 5'] }],
    snow: [{ s: '#AEBBC4', w: 2, d: ['M18 58 Q34 52 50 58', 'M54 76 Q70 70 86 76', 'M30 86 Q40 82 50 86'] }],
    hills: [{ s: '#5E4C2A', w: 2.5, d: ['M16 70 Q34 42 52 70', 'M46 84 Q66 54 88 84', 'M26 64 l6 6', 'M60 76 l6 6'] }],
    mountain: [{ f: '#56504B', d: ['M14 86 L40 36 L66 86 Z'] }, { f: '#625C57', d: ['M48 90 L68 52 L90 90 Z'] }, { f: '#EEF2F4', d: ['M40 36 L48 52 L42 49 L36 54 L33 50 Z', 'M68 52 L74 64 L69 62 L64 66 Z'] }, { s: '#3F3A36', w: 2, d: ['M40 36 L52 60'] }],
    forest: [{ f: '#24451D', d: ['M30 34 L42 58 H18 Z', 'M64 40 L78 66 H50 Z', 'M40 62 L54 88 H26 Z', 'M74 72 L84 92 H64 Z'] }, { s: '#24451D', w: 2.5, d: ['M30 58 V63', 'M64 66 V71', 'M40 88 V93'] }],
    jungle: [{ s: '#173A16', w: 2.5, d: ['M34 86 Q36 66 32 50', 'M32 50 Q22 44 16 50', 'M32 50 Q42 42 50 48', 'M32 50 Q30 40 22 38', 'M70 92 Q72 74 68 60', 'M68 60 Q58 54 52 60', 'M68 60 Q78 52 86 58', 'M68 60 Q68 50 76 46'] }],
  };

  // Byer: husene i felt-koordinater, vælges efter indbyggertal.
  const CITY_ART = {
    village: ['M36 70 V58 L44 50 L52 58 V70 Z', 'M56 72 V62 L63 55 L70 62 V72 Z'],
    town: ['M28 76 V64 L35 57 L42 64 V76', 'M45 76 V48 L52 40 L59 48 V76', 'M62 76 V62 L69 55 L76 62 V76', 'M26 76 H78', 'M52 48 V54'],
    city: ['M24 78 V60 H34 V78', 'M36 78 V46 H46 V78', 'M48 78 V34 L53 28 L58 34 V78', 'M60 78 V50 H70 V78', 'M72 78 V62 H80 V78', 'M22 78 H82', 'M40 54 H42', 'M40 62 H42', 'M64 58 H66'],
  };
  const STAR = 'M52 30 L54 35 H59 L55 38 L57 43 L52 40 L47 43 L49 38 L45 35 H50 Z';
  const INNER_HEX = 'M52 18 L91 40 L91 80 L52 102 L13 80 L13 40 Z';
  const WALL_HEX = 'M52 12 L96 37 L96 83 L52 108 L8 83 L8 37 Z';

  // Path2D-cache
  const cache = new Map();
  const P = (d) => { let p = cache.get(d); if (!p) { p = new Path2D(d); cache.set(d, p); } return p; };

  function strokeSet(ctx, list, color, width) {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const d of list) ctx.stroke(P(d));
  }

  const svgOf = (paths, color, size, sw, dots) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
    paths.map(d => `<path d="${d}"/>`).join('') +
    (dots || []).map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" stroke="none"/>`).join('') + '</svg>';

  return {
    images: {},
    img(key) { const im = this.images[key]; return im && im.complete && im.naturalWidth ? im : null; },
    // HTML-markup til paneler og lister
    unitGlyph(type, size = 22, color = 'currentColor') {
      const icon = UNIT_ICONS[type];
      return icon ? svgOf(icon, color, size, 3, UNIT_DOTS[type]) : (UNITS[type] ? UNITS[type].glyph : '');
    },
    miscGlyph(key, size = 22) { const m = MISC_ICONS[key]; return m ? svgOf(m[0], m[1], size, 3) : ''; },
    resGlyph(res, size = 18) { const icon = RES_ICONS[res]; return icon ? svgOf(icon, '#C9A45C', size, 3.2) : RESOURCES[res].glyph; },
    // Kanvas: enhedsikon i en token med radius r
    unit(ctx, type, cx, cy, r) {
      const im = this.img('unit_' + type);
      if (im) { ctx.drawImage(im, cx - r, cy - r, r * 2, r * 2); return; }
      const icon = UNIT_ICONS[type];
      if (!icon) {
        ctx.font = `${r * 1.15}px ${EMOJI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
        ctx.fillText(UNITS[type].glyph, cx, cy + 1); return;
      }
      const size = r * 1.32, k = size / 48;
      ctx.save(); ctx.translate(cx - size / 2, cy - size / 2); ctx.scale(k, k);
      strokeSet(ctx, icon, '#FFFFFF', 3.4);
      ctx.fillStyle = '#FFFFFF';
      for (const [x, y, rr] of UNIT_DOTS[type] || []) { ctx.beginPath(); ctx.arc(x, y, rr, 0, 7); ctx.fill(); }
      ctx.restore();
    },
    misc(ctx, key, cx, cy, size) {
      const m = MISC_ICONS[key]; if (!m) return;
      const k = size / 48;
      ctx.save(); ctx.translate(cx - size / 2, cy - size / 2); ctx.scale(k, k);
      strokeSet(ctx, m[0], m[1], 3.4); ctx.restore();
    },
    resource(ctx, res, cx, cy, s) {
      const im = this.img('res_' + res);
      const r = s * 0.62;
      ctx.fillStyle = 'rgba(15,19,26,0.82)'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
      ctx.strokeStyle = '#C9A45C'; ctx.lineWidth = 1.4; ctx.stroke();
      if (im) { ctx.drawImage(im, cx - s * 0.5, cy - s * 0.5, s, s); return; }
      const icon = RES_ICONS[res];
      if (!icon) { ctx.font = `${s}px ${EMOJI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(RESOURCES[res].glyph, cx, cy + 1); return; }
      const size = s * 0.92, k = size / 48;
      ctx.save(); ctx.translate(cx - size / 2, cy - size / 2); ctx.scale(k, k);
      strokeSet(ctx, icon, '#D9B66A', 3.6); ctx.restore();
    },
    terrain(ctx, t, i, cx, cy, detail) {
      const T = TERRAIN[t.t];
      UI.hexPath(cx, cy, S + 0.6);
      const im = this.img('terrain_' + t.t);
      if (im) { ctx.save(); ctx.clip(); ctx.drawImage(im, cx - S * SQ3 / 2 - 1, cy - S - 1, S * SQ3 + 2, S * 2 + 2); ctx.restore(); return; }
      ctx.fillStyle = T.color; ctx.fill();
      if (!detail) return;
      const layers = TERRAIN_ART[t.t]; if (!layers) return;
      const k = S / 60, flip = (t.deco + i) % 2 === 1;
      ctx.save(); ctx.translate(cx, cy); ctx.scale(flip ? -k : k, k); ctx.translate(-52, -60);
      for (const L of layers) {
        if (L.f) { ctx.fillStyle = L.f; for (const d of L.d) ctx.fill(P(d)); }
        if (L.s) strokeSet(ctx, L.d, L.s, L.w);
      }
      ctx.restore();
    },
    city(ctx, c, cx, cy) {
      const cv = civ(c.civ);
      const im = this.img('city');
      const k = S / 60;
      ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k); ctx.translate(-52, -60);
      if (cityHasWalls(c)) { ctx.save(); ctx.setLineDash([7, 3]); ctx.strokeStyle = '#E2DACA'; ctx.lineWidth = 4; ctx.stroke(P(WALL_HEX)); ctx.restore(); }
      ctx.save(); ctx.translate(0, 4); ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fill(P(INNER_HEX)); ctx.restore();
      ctx.fillStyle = cv.color; ctx.fill(P(INNER_HEX));
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; ctx.stroke(P(INNER_HEX));
      if (im) { ctx.drawImage(im, 22, 30, 60, 60); ctx.restore(); return; }
      const set = c.pop >= 9 ? CITY_ART.city : c.pop >= 4 ? CITY_ART.town : CITY_ART.village;
      strokeSet(ctx, set, cv.minor ? '#1B1408' : '#ECE6D8', 2.8);
      if (c.capital && !cv.minor) { ctx.fillStyle = '#EAD097'; ctx.fill(P(STAR)); }
      ctx.restore();
    },
    ruin(ctx, cx, cy) {
      ctx.fillStyle = 'rgba(15,19,26,0.82)'; ctx.beginPath(); ctx.arc(cx, cy, S * 0.38, 0, 7); ctx.fill();
      ctx.strokeStyle = '#C9A45C'; ctx.lineWidth = 1.6; ctx.stroke();
      this.misc(ctx, 'ruin', cx, cy, S * 0.56);
    },
    natural(ctx, key, cx, cy) {
      ctx.fillStyle = 'rgba(15,19,26,0.85)'; ctx.beginPath(); ctx.arc(cx, cy, S * 0.46, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(234,208,151,0.35)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, S * 0.52, 0, 7); ctx.stroke();
      ctx.strokeStyle = '#EAD097'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(cx, cy, S * 0.46, 0, 7); ctx.stroke();
      this.misc(ctx, 'nat_' + key, cx, cy, S * 0.62);
    },
    promoMarks(ctx, cx, cy, n, pending) {
      if (!n && !pending) return;
      ctx.save();
      ctx.strokeStyle = '#EAD097'; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let k = 0; k < Math.min(3, n); k++) {
        const y = cy - k * 3.6;
        ctx.beginPath(); ctx.moveTo(cx - 4, y + 2); ctx.lineTo(cx, y - 1); ctx.lineTo(cx + 4, y + 2); ctx.stroke();
      }
      if (pending) {
        ctx.fillStyle = '#EAD097'; ctx.beginPath(); ctx.arc(cx, cy - Math.min(3, n) * 3.6 - 3, 3.2, 0, 7); ctx.fill();
        ctx.strokeStyle = '#1B1408'; ctx.lineWidth = 1.3;
        const py = cy - Math.min(3, n) * 3.6 - 3;
        ctx.beginPath(); ctx.moveTo(cx - 1.8, py); ctx.lineTo(cx + 1.8, py); ctx.moveTo(cx, py - 1.8); ctx.lineTo(cx, py + 1.8); ctx.stroke();
      }
      ctx.restore();
    },
    camp(ctx, cx, cy) {
      const im = this.img('camp');
      ctx.fillStyle = 'rgba(30,20,15,0.8)'; ctx.beginPath(); ctx.arc(cx, cy, S * 0.42, 0, 7); ctx.fill();
      ctx.strokeStyle = '#B5482F'; ctx.lineWidth = 2; ctx.stroke();
      if (im) { ctx.drawImage(im, cx - S * 0.35, cy - S * 0.35, S * 0.7, S * 0.7); return; }
      this.misc(ctx, 'camp', cx, cy, S * 0.62);
    },
  };
})();
