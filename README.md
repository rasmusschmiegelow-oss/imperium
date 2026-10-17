# Imperium

Et turbaseret strategispil i stil med Sid Meier's Civilization, skrevet i ren HTML, CSS og JavaScript. Ingen byggetrin og ingen afhængigheder.

**Spil det her:** https://rasmusschmiegelow-oss.github.io/imperium/

## Indhold

- **Verden:** tilfældige sekskantskort, der går rundt som en globus, med korttyperne Kontinenter, Pangæa og Øer. Kortene har floder, ressourcer, luksusvarer og krigståge.
- **Byer:** byerne vokser, producerer og udvider deres grænser. Du kan vælge fokus (mad, produktion, handel) og låse de felter, indbyggerne arbejder på.
- **Tilfredshed:** utilfredse indbyggere arbejder ikke. Templer, markeder, arenaer, katedraler, garnisoner og luksusvarer holder byerne glade, mens store riger bliver sværere at styre.
- **Forskning:** 31 teknologier fra Landbrug til Rumfart, vist i et teknologitræ med forbindelser.
- **Militær:** landenheder, krigsskibe og indskibning. Med Sejlads sejler landenheder langs kysten, med Astronomi over åbent hav. Gamle enheder kan opgraderes for guld. Det er sværere at angribe over floder.
- **Store personligheder:** videnskabsmand, købmand, ingeniør og general.
- **Handel:** karavaner opretter handelsruter mellem byer, og du kan købe og sælge teknologi med andre folk.
- **Diplomati:** krig og fred med 1–6 computermodstandere, der samler hære, bygger veje og kommer med tilbud. Bystater kan blive dine venner eller allierede, hvis du giver dem gaver.
- **Barbarer:** barbarer angriber fra lejre i tomme områder. Hvis du ødelægger en lejr, får du guld.
- **Oplevelse:** du kan se modstandernes træk som animation. Spillet har lydeffekter og generativ musik, en guide de første ture og virker på mobil.
- **Sejr:** ved erobring, ved rumskib eller på point efter tur 400. Spillet gemmes automatisk i browseren.

## Styring

| Handling | Mus / tast |
|---|---|
| Vælg og flyt enhed | Klik på enheden og så på et felt (højreklik virker også) |
| Angrib | Klik på et rødt markeret felt |
| Panorér / zoom | Træk / rul eller knib, piletaster, + og − |
| Afslut tur | Enter |
| Næste enhed / spring over | N / mellemrum |
| Befæst, grundlæg by | F, B |
| Farm, mine, vej, ryd skov, automatisér | I, M, R, C, A |
| Opgradér, brug stor personlighed, handelsrute | U, G, E |
| Teknologi, diplomati | T, D |

## Filer

- `js/data.js`: terræn, ressourcer, enheder, bygninger, vidundere, teknologier, folk og bystater
- `js/game.js`: regler for kort, bevægelse, kamp, byer, tilfredshed, handel, bystater, barbarer og turgang
- `js/ai.js`: hvad computermodstanderne, bystaterne og barbarerne beslutter
- `js/ui.js`: tegning af kortet, input, paneler, animationer og guide
- `js/audio.js`: lydeffekter og musik med WebAudio

Al grafik tegnes gennem `ART` i `js/ui.js`. Du kan sætte rigtige sprites ind ved at lægge billeder i `ART.images` (fx `unit_warrior`, `terrain_grass`, `res_wheat`, `city`, `camp`).
