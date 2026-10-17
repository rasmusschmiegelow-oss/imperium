# Imperium

Et turbaseret strategispil i stil med Sid Meier's Civilization, skrevet i ren HTML, CSS og JavaScript. Ingen byggetrin og ingen afhængigheder.

## Spil

Åbn `index.html` i en browser, eller slå GitHub Pages til for repoet og spil i browseren.

- Grundlæg byer med bosættere, og lad dem vokse, producere og udvide deres grænser.
- Forsk dig gennem 30 teknologier fra Landbrug til Rumfart.
- 18 enhedstyper, 13 bygninger og 8 vidundere.
- 1–6 computermodstandere, der ekspanderer, bygger, erklærer krig og slutter fred.
- Tilfældigt genererede sekskantskort med terræn, ressourcer og krigståge.
- Vind ved erobring, ved at sende det første rumskib mod Alpha Centauri, eller på point efter tur 400.
- Spillet gemmes automatisk i browseren efter hver tur.

## Styring

| Handling | Mus / tast |
|---|---|
| Vælg og flyt enhed | Klik på enheden, klik på et felt (højreklik virker også) |
| Angrib | Klik på et rødt markeret felt |
| Panorér / zoom | Træk / rul eller knib, piletaster, + og − |
| Afslut tur | Enter |
| Næste enhed / spring over | N / mellemrum |
| Befæst, grundlæg by | F, B |
| Farm, mine, vej, ryd skov, automatisér | I, M, R, C, A |
| Teknologi, diplomati | T, D |

## Filer

- `js/data.js` – terræn, enheder, bygninger, vidundere, teknologier og folk
- `js/game.js` – regler: kort, bevægelse, kamp, byer, forskning og turgang
- `js/ai.js` – computermodstandernes beslutninger
- `js/ui.js` – tegning af kortet, input og paneler
