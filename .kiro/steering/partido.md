# Cambios del partido: siempre para los tres

Todo cambio del partido (animaciones, efectos, reglas, física, avisos) tiene que funcionar para los tres casos y
revisarse en los tres antes de darlo por hecho:

1. **Usuario**: el jugador local, de espaldas, abajo de la pantalla (`player` en `MatchScene`).
2. **Rival bot**: el rival de un jugador, de frente, movido por la IA (`bot` + `BotBrain`, sin `this.net`).
3. **Rival online**: el otro teléfono, de frente, que llega por la red (`bot` con `this.net`: `netBotTick`,
   `netApplyAction`, posición interpolada `netInterp.delayMs` en el pasado). Cada teléfono ve al otro espejado.

Si algo solo aplica a uno (por ejemplo, la flecha que lleva a la raqueta es solo del usuario), decirlo en el reporte.
En red, lo que decide un teléfono (puntos, faltas, dónde cae la raqueta) lo avisa él; el otro solo lo muestra.
