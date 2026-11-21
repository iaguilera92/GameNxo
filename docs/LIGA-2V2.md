# LIGA 2v2

La pantalla LIGA tiene dos pestañas: **LIGA** (la de siempre, sin decir que es 1v1; barra de progreso **amarilla**, como JUGAR) y **LIGA 2V2**
(barra **morada**). La 2v2 repite la estructura de la liga normal con las **MONEDAS 2v2** (`PlayerState.coins2v2`).

## Reglas (decididas con el usuario, 21-11-2026)

- Una liga (Bronce, Plata, Oro, Platino, Diamante, Challenger) y un **neto semanal**: monedas 2v2 ganadas menos perdidas en partidos 2v2
  (online y contra bots). Ruletas, pase, regalos y cofres no cuentan. Nunca baja de 0. Rendirse cuenta como derrota.
- Semana = la de la liga normal (lunes 00:00 hora de Chile). Al cerrarla:
  - con **3 victorias** o más se gana la recompensa semanal de la liga (monedas 2v2 + dinero + 1 Rayo), que se cobra con un botón;
  - con neto ≥ meta se sube **una** liga y se desbloquea su **marco 2v2** del perfil;
  - el neto, las victorias y las derrotas de la semana vuelven a 0.
- La tabla se llena con jugadores simulados (`domain/rankedBots.ts` con otra economía: `BoardEcon`) hasta que haya cuentas en el servidor.
- Quien ya tenía monedas 2v2 empieza en la liga que le daban sus monedas (`rank2v2`) y no baja nadie.

## Cifras PROVISIONALES (`LEAGUE_2V2` en `domain/league2v2.ts`)

| Liga | Meta semanal (neto) | Semanal: monedas 2v2 + dinero |
| --- | --- | --- |
| Bronce | 300 | 60 |
| Plata | 450 | 90 + 5 |
| Oro | 650 | 120 + 10 |
| Platino | 900 | 160 + 15 |
| Diamante | 1.200 | 220 + 25 |
| Challenger | sin meta | 300 + 40 |

Una victoria x1 da +30 y una derrota −15 (`COINS_2V2`), así que la meta de Bronce son 10 victorias netas.

## Marcos 2v2

- Arte: `public/personajes/Marcos/marcos-ranked-2v2.png` (fuera del APK) → `SET=2v2 node tools/build-profile-frames.mjs` (desde `frontend/`)
  → `public/assets/marcos2v2/<liga>.webp` y `src/ui/profile-frames-2v2.json`. Los de la liga normal: la misma herramienta sin `SET`.
- Estado: `PlayerState.league2v2` (liga, `bestLeague`, neto, recompensas) y `equipped.frame2v2`. El marco 2v2 se desbloquea con
  `bestLeague` (nunca baja). Elegir un marco de liga quita el 2v2 y al revés: se ve uno solo.
- Dónde se ven: card del perfil del menú y selector del perfil (pestañas LIGA / LIGA 2V2).

## Pendiente

- Última partida / premios extra de la pestaña 2v2 (la pestaña LIGA los tiene; la 2v2 no guarda historial).
- Mostrar el marco 2v2 al rival (el protocolo online solo manda el marco de liga).
- Cifras definitivas y posiciones de premio en 2v2; descenso (como en la liga normal, en pausa).
- Con servidor: `syncLeague2v2`, `recordMatch2v2` y `claimWeekly2v2` pasan al servidor, como `domain/ranked.ts`.
