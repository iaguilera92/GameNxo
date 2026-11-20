# Demostración de poderes en PERSONALIZAR (15-11-2026)

Los selectores de poderes de PERSONALIZAR (`ui/PowerDialog.ts`) tienen una televisión arriba y los huecos abajo. El DEFENSIVO ya usa la versión nueva:

- **Televisión grande y sin marco** (`bigTv: true`): solo la pantalla, sin carcasa, botones ni rejilla, y con casi todo el alto libre.
- **Página 2: demostración en acción** (`demo`): se llega **deslizando de lado** (o tocando "EN ACCIÓN ›" o los puntos de abajo). Se ve a tu personaje de
  espaldas contra una **máquina de pelotas** que hace de rival (quieta al fondo, en medio). La máquina dispara, el personaje usa el poder elegido para
  llegar y devolver, y al devolver se corta con una cortinilla y vuelve a empezar (alterna derecha y revés). Con otro hueco elegido, la demostración cambia
  de poder al instante, también con los que aún no son tuyos (sirve de vista previa antes de comprar).
- **Transición:** la página que sale se aleja y se apaga, la que entra llega desde más cerca, un barrido de luz cruza la pantalla y aparecen barras de
  cine con el rótulo "EN ACCIÓN · PODER"; al llegar arranca la demostración.

Solo es una demostración visual: no toca el partido, la red ni lo guardado. Nada de lo que se hace aquí lo ve ni lo decide el bot, el rival online o el servidor.

## Cómo está hecho (para migrar el ESPECIAL, la ULTI y los demás)

| Pieza | Archivo | Qué hace |
|---|---|---|
| Diálogo | `ui/PowerDialog.ts` | Opciones `bigTv` y `demo`; `PowerSlot.id` / `demoName`; páginas, arrastre, barras de cine, barrido, puntos |
| Contrato | `PowerDemo` (en `PowerDialog.ts`) | `setPower(id)`, `setActive(on)`, `destroy()`. La escena crea la demostración con `demo.create(parent, outer, inner, id)` |
| Demostración del DEFENSIVO | `fx/powerDemo.ts` | `createDefensiveDemo(...)`: escenario (cancha, red, máquina), pelota, ciclo y el movimiento de cada poder |
| Efectos compartidos | `fx/defensiveFx.ts` | Portal, polvo, despegue y aterrizaje del SUPERSALTO, humo de la SOMBRA, caída de la VOLTERETA. **Los usan el partido y la demostración** |
| Colocación del personaje | `fx/actorPose.ts` | `placeActor`: posición, escala, giro, agachado, transparencia y sombra. **Lo usa `MatchScene.renderActors` y la demostración** |
| Tiempos de cada poder | `logic/DefensiveMoves.ts` | Ahora también `SHADOW`, `JUMP`, `DASH_WARP` y `BLINK` (antes constantes de `MatchScene`). TIEMPO LENTO: `SLOWMO` (+ `fx/slowmoCine.ts`); su demostración es `execSlowmo` en `fx/powerDemo.ts` (misma coreografía que `MatchScene.startSlowmo`: si una cambia, copiar el cambio a la otra) |
| Sombras del DASH en un escenario | `fx/dashFx.ts` | `ghost(ch, i, depth, space?)`: con `space` convierte la posición del mundo al contenedor del escenario |

Idea: **lo que cambie en un poder (efectos, tiempos, forma) cambia a la vez en el partido y en la demostración.** Por eso los efectos y los números se
sacaron de `MatchScene`. Lo que NO está compartido es la coreografía de cada poder (los pasos de `startJump`, `startFlip`, `startBlink`, `startShadow`,
`startSkate` y el DASH): `fx/powerDemo.ts` la repite con las mismas piezas. Si se cambia la coreografía de un poder en `MatchScene`, hay que copiarla
también a su `exec…` de `powerDemo.ts`.

### El escenario y el proxy
Los efectos (`DashFx`, `IceTrail`, `iceSprayFx`, `defensiveFx`) crean sus objetos con `scene.add`. La demostración vive dentro de un contenedor (`stage`)
con su propia escala y posición, y se le pasa a esos efectos una "escena" falsa (`{ add: proxy, tweens }`) cuyo `add` mete cada objeto nuevo en el
escenario. Todo se coloca en coordenadas del juego (`view/projection`), y `layout()` ajusta la escala para que quepa en la pantalla.
El escenario se ordena por profundidad cada cuadro (`stage.sort('depth')`) porque dentro de un contenedor `setDepth` no ordena solo.

### Para migrar el siguiente selector (ESPECIAL, ULTI, CARGANDO GOLPE)
1. En su `openXDialog` de `CustomizeScene`: dar `id` y `demoName` a cada `PowerSlot`, y pasar `bigTv: true` y `demo: { create: ... }`.
2. Crear su demostración (por ejemplo `createSmashDemo` en `fx/powerDemo.ts` o un archivo propio) que cumpla `PowerDemo`. Reutilizar `stage`, la máquina
   y la pelota de `DefensiveDemo` (conviene sacar el escenario a una clase base antes de la segunda demostración).
3. Si el poder tiene efectos que hoy son privados de `MatchScene`, sacarlos a `fx/` como se hizo con `defensiveFx.ts` y llamarlos desde los dos sitios.

## Pendiente de revisar en un teléfono
Todo lo anterior compila y las pruebas siguen pasando, pero **no se ha visto en pantalla**: el alto de la televisión grande en el APK, el arrastre de lado
(umbral y velocidad), la cortinilla, la máquina de pelotas, el sonido de la demostración y que cada poder se vea igual que en el partido.

## Lista de poderes con varias p�ginas (15-11-2026)
Con la televisi�n grande (igTv, hoy el DEFENSIVO) y m�s de 10 poderes, la lista de huecos se pagina de a 10 (2 filas � 5): se arrastra de lado sobre la lista (hacia la izquierda ver los siguientes, hacia la derecha volver) y hay puntos de p�gina debajo. Los dem�s selectores (sin igTv) siguen a�adiendo filas. La p�gina inicial es la del poder equipado.

## ESPECIAL y ULTI (21-11-2026)
`createSpecialDemo(scene, parent, outer, inner, skin, 'smash' | 'inferno', id)` en `fx/powerDemo.ts`: la clase `DefensiveDemo` en modo `special`. Usa las MISMAS piezas del partido:
- Pelota `objects/Ball` (setElement / setPower / setKind / quietFx), `SmokeTrail`, `SmashElementFx`, `InfernoFire` y la cinemática `SmashCinematic` con `smashCine(el)` / `infernoCine(el)`.
- La máquina tira DIRECTO al personaje (bota a 340 delante, le llega a media altura): no se mueve.
- ESPECIAL (como `activateSmash` + `startSmashCine` + `playerHit`): brillo de armado `SMASH_LOOK[el].ring`, al llegar la pelota pose de carga congelada + cinemática del poder, golpe fuerte con la pelota del poder, humo y efecto del elemento.
- ULTI (como `startInferno` + `infernoDashStep` + `infernoImpact`): pose de espera, cinemática del INFERNO, dash con sombras (DashFx con `INFERNO_LOOK[el].ghostTint`; GhostTrail no, usa preFX), RAYO con `lightningBodyFx` / `lightningDashFlash`, golpe con `infernoImpactFx` y la bola `InfernoFire`.
- Impacto en la máquina como `fireImpact`: `powerImpactFx`, `ultiStunFx` (ULTI), globo flojo de vuelta; la máquina se tambalea con estrellas.
- La "escena" de los efectos (`this.st`) es un Proxy de la real: `add` mete en el escenario; `cameras.main` es del escenario (shake/flash solo de la demo, `worldView` = el recorte); `tweens.pauseAll/resumeAll` y `time.paused` no hacen nada (la cinemática no congela el diálogo; la demo se para sola mientras `cine.active`).
- Falta: la franja de la mirada del INFERNO (`showInfernoGaze`, usa máscara propia: no cabe dentro de la máscara de la TV).
- Solo visual: no toca el partido, el bot ni el online.
## CARGANDO GOLPE y Tienda (21-11-2026)
- `createSpecialDemo(..., 'charge', id)`: la m�quina tira directo; el personaje se pone en guardia de carga (`setCharging`) y el aro del suelo crece ~1,1 s hasta el m�ximo (`ChargeSpriteFx` del partido con su hoja; el cl�sico, el aro dibujado como `MatchScene.renderCharge`). Al llegar la pelota, golpe cargado (estela ancha del cargado) y el aro se disipa.
- TIENDA: todas las tarjetas (efecto de pelota, CARGANDO GOLPE, ULTI, ESPECIAL, DEFENSIVO, ZONA) tienen VER en vez de USAR (`ShopScene.openPreviewOf`). Dentro: COMPRAR si no lo tienes; USAR / EN USO si ya es tuyo. Lo legendario que no tienes sigue sin VER.

## EFECTO PELOTA y CARGANDO GOLPE en PERSONALIZAR (21-11-2026)
Los dos di�logos usan `bigTv` + `demo` como el DEFENSIVO: p�gina de informaci�n y, deslizando, "En acci�n" contra la m�quina.
- EFECTO PELOTA: `createStyleDemo(..., look, lookOf)`; al elegir otro efecto de la lista cambia la estela (`setPower` ? `lookOf(id)`). 13 efectos: la lista se pagina de a 10.
- CARGANDO GOLPE: `createSpecialDemo(..., 'charge', id)` (aro del suelo creciendo + golpe cargado).
- Los slots llevan `id` y `demoName`. Rarezas y "POR DEFECTO" como antes.

- TIENDA (21-11-2026): solo comprar y ver. Sin EN USO / USAR; equipar es solo en PERSONALIZAR.

- ESPECIAL DRAGÓN (20-11-2026, usuario): en la vista previa el sprite del dragón sale 1,8 veces más grande (`SmashElementFx.dragonScale`, puesto en `powerDemo`); en el partido no cambia.
- ESPECIAL DRAGÓN (20-11-2026, usuario): su golpe suena con `ulti-fuego` recortado como en la ULTI (`InfernoFx.playUltiFile`) en el partido (usuario, bot y rival online, `MatchScene.hitFx`) y en la vista previa.
