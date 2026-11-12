# Ranked (ligas competitivas)

Responsable: Claude. Kiro mantiene el partido (MatchScene): Ranked **no** modifica el partido.

## Economía (decidida con el usuario el 08-11-2026)

| Moneda | Dónde se usa | De dónde sale |
|---|---|---|
| **Monedas** (`PlayerState.coins`) | Moneda **competitiva**: entradas Ranked y clasificación. **No** se usa en la Tienda. | Ruletas, premio diario, partidas, premios Ranked |
| **Dinero** (`PlayerState.gems`) | Tienda (estilos, habilidades) y Pase Premium | Pase de batalla, recompensas semanales de liga, premio diario |

- La economía completa (monedas, dinero, XP, pase, tienda, ruleta, premio diario) y por qué se eligió cada número:
  [`ECONOMIA.md`](ECONOMIA.md). Simulador: `node tools/sim-economy.mjs --runs=20` (desde `frontend/`).
- La Tienda ahora cobra **dinero** (precios convertidos a razón de ~15 monedas = 1 de dinero).
- La **clasificación** de la liga es el **saldo de monedas** (no hay un segundo sistema de puntos).
- **Ascenso**: al **terminar una partida Ranked** con saldo ≥ objetivo de la liga (puede subir varias ligas).
  Las monedas de ruletas, pase o premio diario **no** ascienden sin jugar.

## Reglas

- **Todos compiten desde el principio** (`RANKED.unlockLevel = 1`) y empiezan en **Bronce**.
  - El saldo inicial es de 5.000 monedas: alcanza para 10 entradas, aunque las pierda todas (12-11-2026; antes 1.500).
- **JUGAR** del menú muestra la entrada de tu liga (ej. "JUGAR 🪙 500") y juega una partida Ranked normal.
  - Sin monedas suficientes juega una partida amistosa gratis: nadie se queda fuera.
  - La pantalla RANKING ofrece además la apuesta x2.
- Entrar paga la entrada (× apuesta). Ganar paga entrada × 2. Perder no paga nada.
- Apuesta **x2** individual (el rival no apuesta).
- **Semana** (temporada): de lunes a domingo, con el mismo corte diario de las ruletas (23:59, hora de Chile).
  - Con **≥ 3 partidas completadas** (ganadas o perdidas) se gana la recompensa de la liga + premio por posición
    (Top 1 / Top 10 / Top 50).
  - Rendirse o abandonar **no cuenta** y pierde la entrada.
  - Con menos de 3 partidas no hay recompensa, pero **no se pierde la liga**.
  - Se calcula al cerrar la semana. El jugador la ve al entrar en Ranked y la cobra con un botón (una sola vez).
- **Mes**: se baja una liga (Plata→Bronce, Oro→Plata, Platino→Oro, Diamante→Platino, Challenger→Diamante).
  - Si se bajó y el saldo supera el tope, se recorta a **mitad de la liga siguiente**
    (`demotionCapFraction = 0.5`; ej.: de Plata a Bronce el tope es 45.000).
  - Con una partida más vuelve a subir y empieza a mitad de liga.
- **Abandono**: una partida con la entrada pagada que no se liquidó (app cerrada) se resuelve como abandono en el
  siguiente arranque (`bootRanked`).
- Todo es **idempotente**:
  - Cada partida se liquida una sola vez (id único).
  - Cada semana se cobra una sola vez.
  - La hora nunca retrocede (`timeSource`).

## Configuración (`frontend/src/domain/rankedConfig.ts`)

| Liga | Entrada (x1 / x2) | Premio (x1 / x2) | Objetivo de ascenso | Semanal |
|---|---|---|---|---|
| Bronce | 500 / 1.000 | 1.000 / 2.000 | 30.000 | 6.000 |
| Plata | 1.000 / 2.000 | 2.000 / 4.000 | 60.000 | 8.000 + 10 dinero |
| Oro | 2.000 / 4.000 | 4.000 / 8.000 | 120.000 | 9.000 + 20 |
| Platino | 4.000 / 8.000 | 8.000 / 16.000 | 240.000 | 12.000 + 30 |
| Diamante | 8.000 / 16.000 | 16.000 / 32.000 | 480.000 | 15.000 + 50 |
| Challenger | 16.000 / 32.000 | 32.000 / 64.000 | — (máxima) | 20.000 + 75 |

- Las entradas de Plata en adelante son una **propuesta** que duplica la de la liga anterior, igual que los objetivos.
- Semanal de Bronce 3.000 → 6.000 y de Plata 6.000 → 8.000 (12-11-2026): la de Bronce paga 12 entradas y pesa más que
  una semana de premio diario; subir a Plata sigue pagando más.
- Premios por posición: Top 1 = 5.000 + 50 · Top 10 = 2.000 + 20 · Top 50 = 500 + 5.
- `validateRankedConfig()` comprueba la coherencia (también en los tests).

## Rivales simulados (`frontend/src/domain/rankedBots.ts`)

- Hasta 100 participantes por liga: `bots = tableSize − jugadores reales` (sin backend hay 1 jugador real).
- Son deterministas: misma liga, mes y hora dan la misma tabla en cualquier dispositivo o servidor.
- Identificados con `bot: true` e id `bot:…`. Los nombres se generan con sílabas y número.
- Suben sus monedas poco a poco durante el mes, con variaciones por hora, y siempre quedan bajo el objetivo de
  ascenso.
- **Nunca reciben premios.**
- `botsCountForPositionPrizes = true`: sin backend los bots **sí** ocupan posiciones; si no, el único jugador real
  sería siempre Top 1. Con backend y jugadores suficientes poner `false`: las posiciones de premio se calcularán
  solo entre jugadores reales.

## Ruletas y premio diario

- Ruletas: una por **partida completada** (ganada o perdida; no rendición), máx. 4 al día.
- **Anuncio para duplicar**: **no implementado**, porque no hay proveedor de anuncios. Cuando exista:
  - Acreditar el doble solo con la confirmación del proveedor (idealmente verificada por el servidor).
  - Marcar el giro como duplicado en la misma operación que el pago, para no duplicar dos veces.
- **Premio diario** (`frontend/src/domain/dailyLogin.ts`): racha de 7 días.
  - Botón pequeño a la derecha del menú, en dorado cuando hay algo que reclamar.
  - **Nunca se abre solo.**

## Archivos

- **Dominio puro** (sin Phaser; listo para el backend):
  - `domain/ranked.ts`: operaciones, calendario, vista y validación de datos.
  - `domain/rankedConfig.ts`: configuración.
  - `domain/rankedState.ts`: forma de los datos.
  - `domain/rankedBots.ts`: rivales simulados.
  - `domain/dailyLogin.ts`: premio diario.
- **Guardado**: `PlayerState` v5 (`ranked`, `login`), migración en `domain/migrate.ts`.
- **Fachada**: `logic/Ranked.ts` (hora del juego + `playerStore`).
- **UI**:
  - `scenes/RankedScene.ts`: pantalla principal, podio, Top 100, líderes por liga, lista de ligas, ascenso,
    descenso mensual y recompensas semanales.
  - `ui/leagueStyle.ts`: colores de liga.
  - `ui/DailyLoginButton.ts`: premio diario.
- **Integración con el partido** (sin tocar MatchScene):
  - `MatchmakingScene` cobra la entrada al empezar; cancelar la búsqueda no cobra.
  - `MatchEndScene` liquida la partida pendiente (victoria, derrota o rendición).
- **Tests**: `node tools/test-ranked.mjs`.

## Backend futuro (Node + Supabase)

- El servidor ejecutará estas mismas funciones de `domain/`. El cliente nunca decide su saldo ni sus premios:
  - `enterRanked` / `settleRanked`: el servidor valida el resultado del partido.
  - `syncRanked`: cierre de semana y mes.
  - `claimWeekly` y `claimLogin`.
- `PlayerRepository` (playerStore) y `setServerTime` (timeSource) ya son los puntos de cambio.
- Las tablas reales vendrán de la base de datos; `buildBoard` completa con bots si faltan jugadores.
