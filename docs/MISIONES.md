# Misiones por partida (1v1 y 2v2)

Añadido: 18-11-2026 (Claude). 4 misiones que se reinician en **cada partida** 1v1 (contra el bot u online).
**2v2 (23-11-2026, usuario):** las MISMAS 4 misiones, por ahora, con la sección ADICIONALES al final del resultado. Cuentan los puntos de tu
equipo (también los que hace tu compañero); ¡Hasta la vista! vale con cualquiera de los dos rivales; Duelo RED no se puede cumplir (en el 2v2
no hay duelo en la red). **Pagan MONEDAS 2v2** (usuario, 23-11-2026), equivalentes a las del 1v1 en la misma proporción que el premio por
ganar el partido (COINS_2V2.win / COINS_WIN = 30 / 50): Drop Shot 0 **12**, ¡Hasta la vista! **24**, Duelo RED 12, Combo Globo **12**
(`missionReward` en `domain/matchMissions.ts`; se suman con `grantCoins2v2`, sin contar en el neto de la LIGA 2v2, como los premios del Pase).
Cada una cuenta **una sola vez** por partida. Lógica: `frontend/src/domain/matchMissions.ts`. Prueba:
`node tools/test-match-missions.mjs` (en `frontend/`).

| Misión | Cuándo se cumple | Monedas |
|---|---|---|
| Drop Shot 0 | Ganas un punto cuyo motivo es `'¡DROP SHOT 0!'` (`MatchScene.pointTo`) | 20 |
| ¡Hasta la vista! (sacar volando) | ¡A LAS ESTRELLAS!: el rival sin raqueta (tu ULTI) recibe tu ESPECIAL y sale volando (`skyLaunch`); cuenta al darte el punto (`bot.launched`) | 40 |
| Duelo RED (duelo en la red) | Ganas el punto en el que hubo DUELO EN LA RED (`duelUsed`) | 20 |
| Combo Globo (ESPECIAL + GLOBO máximo) | Tiras tu ESPECIAL (no la ULTI), el rival lo devuelve y tú respondes con el GLOBO cargado al máximo (GLOBO DISPARADO) y ganas el punto sin que el rival la vuelva a tocar | 20 |
| **Las 4** | | **100** |

## Cómo funciona

- **Golpes**: el setter `lastHitter` de `MatchScene` avisa cada golpe a `missionHit` (rival = cualquier golpe del bot / rival online).
  `playerHit` etiqueta el golpe del jugador: `'special'` (ESPECIAL) o `'maxLob'` (rama del GLOBO DISPARADO). Con eso se lleva la
  cadena ESPECIAL → devolución → GLOBO máximo; se corta con cualquier otro golpe y en cada punto nuevo.
- **Puntos**: `pointTo` (tras `netGate`, o sea el punto que se aplica de verdad, también en red) llama a `missionPoint`, que
  devuelve las misiones nuevas. Cada una dispara la alerta de LOGRO.
- **Alerta de LOGRO** (`fx/missionAlert.ts`, arte nuevo 21-11-2026): la imagen `public/assets/ui/marcador-misiones.webp` (660 × 163,
  pastilla navy con borde dorado, medalla con estrella a la izquierda, moneda-pelota arriba a la derecha y un casillero para el
  premio; la original en PNG está en `_temp/respaldo_oficial/ui-png-originales/`). Sobre ella, en una sola pieza: "¡LOGRO!" (dorado) y
  el nombre (blanco, se achica si es largo) centrados en la zona libre, y "+N" (dorado) centrado en el casillero. Ya no se dibuja
  placa, estrella ni moneda por código. (19-11-2026, usuario) Más grande: 420 px de ancho (textos ×1,27) y el "+N" centrado en la parte
  LIBRE del casillero (la moneda tapa su parte de arriba; `MARKER_ART.prize` medido sobre la imagen). Antes se mostraba a 330 px de ancho × ~81 de alto (el alto sale de la proporción de la imagen), centrada
  entre el joystick y los botones de habilidades, ~350 px sobre el borde de abajo (más arriba que el botón ESPECIAL). Animaciones:
  entrada con rebote, destello del borde, halo dorado que late y salida. La textura `ui-marcador-misiones` se precarga en
  `MatchScene.preload` (`queueMissionAlertArt`); si falta, dibuja una pastilla simple. Las zonas del texto y del casillero están en
  `MARKER_ART` (coordenadas de la imagen a 2128 × 524): si se cambia el arte, se ajustan ahí. Varias a la vez salen en fila.
  No sale en el punto que termina el partido (ya empezó el final): esa misión se ve en ADICIONALES. Solo la ve el usuario local
  en 1v1: en 2v2 no hay misiones y el bot o el rival online no la muestran.
- **Fin de partido** (`MatchEndScene`): `MatchScene.endMatch` manda `missions` (ids cumplidos). Tras las 3 cards de recompensa y,
  si hubo duelo de apuestas, tras pasar las monedas apostadas, aparece **ADICIONALES**: 4 cards (✓ dorada = cumplida, candado =
  no) y el total que cuenta hacia arriba.

## Economía

- Las monedas se suman con `addCoins` (igual que el premio de partida, `docs/ECONOMIA.md`), **una vez** por partida
  (`_missionCoins` en los datos de la escena), también si pierdes o te rindes.
- No pasan por el backend (los premios de partida tampoco) ni por `settleCurrentRanked`: no cambian el resultado del Ranked
  ni de la apuesta (ni el modo RIESGO x2).

- (20-11-2026, usuario) Nombres nuevos: Drop Shot 0, ¡Hasta la vista!, Duelo RED (Combo Globo igual). La alerta dice "¡MISIÓN CUMPLIDA!" (antes "¡LOGRO!") y el "+N" va 2 px a la izquierda y más grande (23 px).
