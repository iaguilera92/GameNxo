# Misiones por partida (1v1)

Añadido: 18-11-2026 (Claude). 4 misiones que se reinician en **cada partida** 1v1 (contra el bot u online; en 2v2 no hay).
Cada una cuenta **una sola vez** por partida. Lógica: `frontend/src/domain/matchMissions.ts`. Prueba:
`node tools/test-match-missions.mjs` (en `frontend/`).

| Misión | Cuándo se cumple | Monedas |
|---|---|---|
| Dejada Mortal (DROP SHOT 0) | Ganas un punto cuyo motivo es `'¡DROP SHOT 0!'` (`MatchScene.pointTo`) | 20 |
| ¡A las Estrellas! (sacar volando) | ¡A LAS ESTRELLAS!: el rival sin raqueta (tu ULTI) recibe tu ESPECIAL y sale volando (`skyLaunch`); cuenta al darte el punto (`bot.launched`) | 40 |
| Rey de la Red (duelo en la red) | Ganas el punto en el que hubo DUELO EN LA RED (`duelUsed`) | 20 |
| Combo Globo (ESPECIAL + GLOBO máximo) | Tiras tu ESPECIAL (no la ULTI), el rival lo devuelve y tú respondes con el GLOBO cargado al máximo (GLOBO DISPARADO) y ganas el punto sin que el rival la vuelva a tocar | 20 |
| **Las 4** | | **100** |

## Cómo funciona

- **Golpes**: el setter `lastHitter` de `MatchScene` avisa cada golpe a `missionHit` (rival = cualquier golpe del bot / rival online).
  `playerHit` etiqueta el golpe del jugador: `'special'` (ESPECIAL) o `'maxLob'` (rama del GLOBO DISPARADO). Con eso se lleva la
  cadena ESPECIAL → devolución → GLOBO máximo; se corta con cualquier otro golpe y en cada punto nuevo.
- **Puntos**: `pointTo` (tras `netGate`, o sea el punto que se aplica de verdad, también en red) llama a `missionPoint`, que
  devuelve las misiones nuevas. Cada una dispara la alerta de LOGRO.
- **Alerta de LOGRO** (`fx/missionAlert.ts`): placa navy con borde dorado, estrella, "¡LOGRO!", nombre y "+N" con moneda. Centrada
  entre el joystick y los botones de habilidades, ~350 px sobre el borde de abajo (más arriba que el botón ESPECIAL). Varias a la vez
  salen en fila. No sale en el punto que termina el partido (ya empezó el final): esa misión se ve en ADICIONALES.
- **Fin de partido** (`MatchEndScene`): `MatchScene.endMatch` manda `missions` (ids cumplidos). Tras las 3 cards de recompensa y,
  si hubo duelo de apuestas, tras pasar las monedas apostadas, aparece **ADICIONALES**: 4 cards (✓ dorada = cumplida, candado =
  no) y el total que cuenta hacia arriba.

## Economía

- Las monedas se suman con `addCoins` (igual que el premio de partida, `docs/ECONOMIA.md`), **una vez** por partida
  (`_missionCoins` en los datos de la escena), también si pierdes o te rindes.
- No pasan por el backend (los premios de partida tampoco) ni por `settleCurrentRanked`: no cambian el resultado del Ranked
  ni de la apuesta (ni el modo RIESGO x2).
