# Maestrías y pasivas por personaje (definición, 15-11-2026)

Documento para quien (persona o IA) vaya a construir o tocar esta función. **Estado (15-11-2026): implementada** con las propuestas de este
documento como valores por defecto (curva de la sección 3, pasivas de la sección 4). Se construyó sin que el usuario las hubiera confirmado una
por una: si cambia alguna, se cambia en un solo sitio (`domain/characterPassives.ts`). Aquí está lo que decidió el usuario, lo que se propuso y
lo que sigue abierto. Lee también `docs/BASE-DE-DATOS.md` (cuentas y validación en servidor) y `docs/ECONOMIA.md` (rayos y ZONA, sección 11).

Dónde está en el código:

| Qué | Archivo |
|---|---|
| Pasivas, curva, nivel, valor, validación de lo guardado | `frontend/src/domain/characterPassives.ts` |
| Sumar maestría (`awardMastery`) y subir la ZONA por personaje (`upgradeZoneStat(s, stat, skin)`) | `frontend/src/domain/operations.ts` |
| ZONA por personaje y migración del formato anterior | `frontend/src/domain/zoneProgress.ts`, `domain/migrate.ts` |
| Dato guardado | `PlayerState.mastery` (`Record<skin, puntos>`, opcional) en `domain/player.ts` |
| Valor de la pasiva y ZONA del personaje elegido | `logic/Profile.ts`: `getProfile().passive`, `.masteryPoints`, `.zoneStats` |
| Aplicación en el partido (usuario) | `scenes/MatchScene.ts`: `passiveAgility`, `passivePrecision`, `inReach`, `maxSp`, `precisionCut`, `executeServe` |
| Barra en PERSONALIZAR | `scenes/CustomizeScene.ts`: `masteryBar` (sobre las 4 tarjetas) |
| Icono y diálogo de información (PERSONALIZAR y Pase) | `ui/passiveInfo.ts` |
| Pase de Batalla (personaje premio) | `scenes/BattlePassScene.ts`: `characterCell` (franja PASIVA con icono i) |
| +1 MAESTRÍA al ganar | `scenes/MatchEndScene.ts`: `masteryRow` |
| Pruebas | `frontend/tools/test-mastery.mjs` |

Nombre provisional: **Maestrías** (el usuario dijo "así le pondré mientras").

## 1. Idea

Cada personaje tiene una **pasiva** propia que mejora hasta un **10 %**. El jugador la sube **jugando con ese personaje**: gana
**puntos de Maestría** al ganar partidos, y cada nivel de maestría vale **+1 %** de la pasiva (nivel 10 = +10 %). Un jugador que
quiere a Nxo o a Mai tiene así una meta propia con cada uno, además de los atributos de ZONA (también por personaje, sección 6).

El objetivo del diseño es **retención**: que el jugador se interese por la pasiva del personaje y quiera llenar sus dos progresiones
(Maestría y ZONA) con cada uno.

## 2. Decidido por el usuario

| Tema | Decisión |
|---|---|
| Pasivas | (25-11-2026, usuario) **Nxo y Rin = Agilidad. Mai = Precisión. Zac y Net = Fuerza. Mat e Isa = Efecto (más curva del saque con efecto). Jun y Flo = Resistencia (el DEFENSIVO se recarga antes).** |
| Tope | Cada pasiva llega a **+10 %** para su personaje. |
| Niveles | Máximo **nivel 10 de maestría**. Cada nivel = **+1 %** de la pasiva (nivel 10 = 10 %). |
| Cómo se gana | **Solo jugando partidos y ganando.** Un partido ganado da **1 maestría**. No se compra ni se regala. |
| Cuándo empieza | **Solo después de llegar al nivel 20 de la cuenta** (`MAX_LEVEL`). Antes de ese nivel no se suman puntos. |
| Dónde se ve | En **PERSONALIZAR**, **arriba de las 4 tarjetas** (Estilos, Efecto, Cargando, Mascotas): una barra que no ocupe mucho alto y se vea bonita. |
| ZONA | **También por personaje** (sección 6). |
| Pase de Batalla | Si el premio es un personaje, el Pase debe **explicar su pasiva** con una breve información y un **icono de info** que abre más detalle (sección 7). |

## 3. Curva de maestrías (PENDIENTE: confirmar)

El texto original del usuario ("nivel 1 a 2 = 2 maestrías, nivel 4 = 4, nivel 3 = 8 … hasta el 10") quedó mezclado. Se entiende que cada
nivel pide más que el anterior, en forma de duplicar. Duplicando, el nivel 10 pide 512 en un solo paso (1.022 victorias en total): demasiado.

**Propuesta** (maestrías necesarias para subir *desde el nivel anterior*, 1 por victoria):

| Sube a nivel | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Maestrías del paso | 1 | 2 | 4 | 8 | 12 | 16 | 20 | 25 | 30 | 40 |
| Acumuladas | 1 | 3 | 7 | 15 | 27 | 43 | 63 | 88 | 118 | 158 |

Con esa tabla, el nivel 10 son 158 victorias con ese personaje. **DECIDIDO por el usuario (15-11-2026): el personaje parte en el NIVEL 0 (0 %) y la primera victoria ya sube al nivel 1.** Se guarda en un solo lugar (`domain/`, ver sección 8) para cambiarla sin tocar nada más.

**Otras decisiones pendientes** (con la propuesta por defecto):

- **Nivel de partida (decidido):** nivel 0 con 0 %; con 1 victoria, nivel 1 (+1 %).
- **Qué partidos cuentan:** victorias contra el bot y online. Ranked también. Contra el bot se puede abusar jugando muchas partidas
  seguidas: si se quiere evitar, que solo cuenten Ranked y online, o que contra el bot haya un tope por día.
- **Abandono, desconexión, partido sin terminar:** no da maestría.
- **Revancha:** cada partido ganado da 1, igual que cualquiera.

## 4. Las pasivas (PROPUESTA de cómo se aplican)

`P = nivel de maestría × 1 %` (0 a 0,10; nivel 0 = sin efecto). La pasiva **siempre está activa** en el partido (no depende de la ZONA).

| Personaje | Pasiva | Efecto propuesto con `P` |
|---|---|---|
| **Nxo** | **Agilidad** | Velocidad de movimiento × (1 + `P`) y alcance de la raqueta × (1 + `P`). |
| **Mai** | **Precisión** | Reduce el desvío de tus golpes (error lateral y de profundidad) en `P`, también en el saque. |
| **Jun** | **Resistencia** (id `resistance`, 25-11-2026) | Reduce el tiempo de recarga del DEFENSIVO. Se activa al jugar con Jun. |

Dónde engancharlo en el código (todo en `scenes/MatchScene.ts`; es el mismo mecanismo que ya usa la ZONA):

- **Velocidad:** `maxSp` del jugador (`PLAYER_SPEED * …`, función de movimiento del jugador). La ZONA ya multiplica por `ZONE.speedMult * zoneStatMultiplier('player','speed')`: la pasiva se multiplica aparte, así se suman sin pisarse.
- **Alcance:** `inReach()` ya usa `zk` (alcance de la ZONA); la pasiva multiplica el alcance base del jugador.
- **Precisión:** `applyTiming()` ya recibe `zonePrecision` y hace `mods.errLat *= 1 - zonePrecision` y `mods.errDep *= 1 - zonePrecision`. La pasiva de Mai se suma ahí (tope seguro: nunca bajar de 0 error). El saque usa `SERVE.error[quality]` en `executeServe()` (`eLat`, `eDep`): ahí también.
- **El bot no tiene pasiva** (propuesta: no cambia la dificultad). **El rival online** aplica su propia pasiva en SU teléfono: su movimiento llega por la red como posición ya calculada y sus golpes llegan con su destino, así que **no hace falta enviar la maestría para que funcione**. Solo hace falta enviarla si se quiere **mostrarla** (por ejemplo, en la pantalla de VS): entonces va en `PlayerProfile` (`net/protocol.ts`), y el servidor (`backend/src/socket/guard.ts`) debe validarla, no aceptarla a ciegas.
- Revisar el efecto en los **tres casos** del partido (regla `.kiro/steering/partido.md`): usuario, bot y rival online. La pasiva es del jugador local; en red cada teléfono ve al otro con la suya aplicada sin que se envíe.

Texto corto para mostrar (usar el mismo en PERSONALIZAR y en el Pase):

- **Agilidad** (Nxo): "Corres más rápido y llegas más lejos a la pelota."
- **Precisión** (Mai): "Tus golpes y tu saque se desvían menos."

## 5. Pantalla PERSONALIZAR

Una barra **fina** sobre la fila de 4 tarjetas (`CustomizeScene.cosmeticRow`), con el estilo del resto de las tarjetas (fondo azul oscuro,
borde de color del personaje, brillo suave). Contenido:

- Nombre de la pasiva y personaje: `AGILIDAD · NXO`, el nivel (`NIV 3`) y el valor actual (`+3 %`).
- Barra de progreso hacia el siguiente nivel con `x / y` maestrías.
- Con la cuenta por debajo del nivel 20: la barra sale **bloqueada** (candado y "Se activa en el nivel 20"); el progreso se ve vacío.
- En el nivel 10 de maestría: `NIVEL MÁX.` en dorado, sin barra de progreso.
- Un icono de info (i) que abre un diálogo con el detalle: qué mejora, cuánto vale cada nivel y cómo se gana (ganar partidos).
- Sigue al personaje elegido (hoy el selector HOMBRE | MUJER de `sexToggle` es temporal): al cambiar de personaje, cambia la barra.

Altura objetivo: unos 56–64 px (la barra no debe empujar demasiado el resto de la pantalla; revisar el alto libre en el APK). Tras un
partido la barra anima un instante (ver sección 9).

## 6. ZONA por personaje

Hoy la ZONA guarda los 5 atributos en un solo bloque (`PlayerState.zone.stats`, 20 puntos cada uno, 1 Rayo = 1 punto = 1 %; ver
`domain/zoneProgress.ts` y `docs/ECONOMIA.md` sección 11). **Pasa a ser por personaje**:

- Los **Rayos** (`zone.rays`) siguen siendo **de la cuenta** (una sola moneda): el jugador elige en qué personaje gastarlos.
- Los **5 atributos** pasan a guardarse **por personaje**: `zone.stats[skinId]`. Subir un atributo de Nxo no cambia los de Mai.
- En el partido se usan los atributos del **personaje con el que se juega** (`getProfile().zoneStats` ya sale de `PlayerState`: apuntará a `stats[skin]`). El rival online ya manda `zoneStats` de su personaje del partido (`PlayerProfile.zoneStats`): no cambia el protocolo.
- Al abrir la tarjeta de ZONA en PERSONALIZAR, se ven y suben los atributos **del personaje elegido**.
- **Migración (`domain/migrate.ts`):** los atributos guardados hoy (un solo bloque) se asignan a **Nxo** (el personaje inicial). Mai empieza con todo en 0. Subir `PLAYER_SCHEMA_VERSION` solo si el formato guardado lo exige, y comprobar `tools/test-ranked.mjs`. *Decisión pendiente: confirmar que los puntos existentes van a Nxo.*
- El tope de 20 puntos por atributo se mantiene **por personaje**. Con dos personajes, el jugador necesita el doble de Rayos para llenar todo.

Así cada personaje tiene **dos progresiones**: Maestría (pasiva, por victorias) y ZONA (atributos, por Rayos). El jugador tiene qué llenar con cada uno.

## 7. Pase de Batalla

El Pase regala personajes. Jun, con la pasiva Resistencia, es el premio del nivel 30 (`domain/battlePassConfig.ts`, recompensa `kind: 'character'`, y la escena
`scenes/BattlePassScene.ts`). Para una recompensa de personaje, el Pase debe mostrar:

- **Su pasiva y una frase breve** ("PASIVA · PRECISIÓN: tus golpes se desvían menos") en la tarjeta o el panel del personaje.
- Un **icono de info (i)** que abre un diálogo con más detalle: qué mejora, el tope (+10 %), cómo se sube (maestrías por ganar partidos, desde el nivel 20 de la cuenta) y los 10 niveles.
- Reusar el patrón de iconos de información que ya existe en la Tienda (`ShopScene.infoButton` y `INFO`) para no inventar otro.

## 8. Datos y reglas del proyecto

Reglas de `.kiro/steering/base-de-datos.md` (resumen):

- **Los ids no se cambian nunca:** `agility` y `precision` (ids de pasiva), `nxo` y `mai` (personajes). El nombre visible va aparte.
- Lo que se guarda por cuenta va en **`frontend/src/domain/`** (TypeScript puro, sin Phaser ni DOM) y pasa por **`PlayerRepository`**.
- **Nada de nivel, maestrías ni compras se decide en el cliente**: el servidor valida con `domain/operations.ts`. La suma de maestría al ganar un partido debe ser una operación (`awardMastery(state, skin, won)`) que el servidor pueda repetir.
- Un poder, pasiva o ítem **nuevo** se define en **un solo sitio** con su id fijo (no repartir colores, textos y sonidos en más tablas).
- **Rareza:** no aplica a la pasiva (no es un ítem). Si se añade algún ítem nuevo ligado a esta función, preguntar la rareza al usuario antes.

Estructura propuesta (nombres orientativos):

- `domain/characterPassives.ts`: tabla única por personaje: `{ skin, id ('agility'|'precision'), name, short, detail, maxPct: 10 }` y la curva de maestrías (sección 3), más `masteryLevel(points)`, `masteryProgress(points)`, `passiveValue(points)` (devuelve `P`).
- `PlayerState.mastery`: `Record<SkinId, number>` con los **puntos** (el nivel se calcula; así cambiar la curva no rompe lo guardado).
- `domain/operations.ts`: `awardMastery(s, skin)` (suma 1 solo si el nivel de la cuenta es `MAX_LEVEL`); `upgradeZoneStat(s, skin, key)` (la ZONA por personaje).
- `domain/migrate.ts`: crear `mastery` vacío y mover los atributos de ZONA existentes a Nxo (sección 6). Validar siempre: enteros ≥ 0 y tope por la curva (nivel 10).
- `logic/Profile.ts`: exponer `getProfile().passive` (`P`) y la ZONA del personaje activo.
- Fin del partido (`scenes/MatchEndScene.ts` y el flujo de victoria de `MatchScene`): llamar a `awardMastery` solo si **ganó el usuario** y el partido cuenta (sección 3). Mostrar "+1 MAESTRÍA" con la barra animada.
- Pruebas: `tools/test-mastery.mjs` (curva, nivel, nivel 20 de cuenta, tope, migración de la ZONA) con el mismo cargador de las otras pruebas (`tools/test-ranked.mjs`).

## 9. Resultado del partido

Al ganar, tras la XP, el panel de resultado debe mostrar **+1 MAESTRÍA** con el icono del personaje y la barra subiendo; si sube de nivel:
"¡AGILIDAD NIVEL 4! +4 %". Con la cuenta por debajo del nivel 20, no se muestra (o se muestra la barra bloqueada "Nivel 20").

## 10. Qué sigue abierto

Todo lo de abajo está implementado con la propuesta como valor por defecto; el usuario puede cambiarlo:

1. **Curva** (sección 3): 1, 2, 4, 8, 12, 16, 20, 25, 30, 40 (158 victorias para el nivel 10). Se cambia en `MASTERY.steps`.
2. **Nivel de partida (decidido):** nivel 0 con 0 %; la primera victoria sube al nivel 1. Las maestrías esperan al nivel 20 de la cuenta.
3. **Qué partidos cuentan:** cualquier victoria del usuario (contra el bot, online y Ranked); la rendición no suma. Sin tope diario contra el bot (riesgo de abuso: ver sección 3).
4. **Cómo se aplican** (sección 4): Agilidad = velocidad y alcance (`MatchScene.maxSp`, `inReach`); Precisión = menos desvío en los golpes con Perfect Timing y en el saque (`precisionCut`, `executeServe`).
5. **Los atributos de ZONA** que ya existían pasaron a **Nxo** (`ZONE_LEGACY_SKIN`).
6. **Pantalla VS:** el rival no ve tu maestría (no viaja por la red). Si se quiere mostrar, hay que añadirla a `PlayerProfile` (`net/protocol.ts`) y validarla en `backend/src/socket/guard.ts`.
7. **Servidor:** `awardMastery` y `upgradeZoneStat` son operaciones puras de `domain/operations.ts`, listas para que el servidor las repita; hoy el cliente las ejecuta en local como el resto de la cuenta.
8. **Pendiente de revisar jugando:** la altura de la barra en el APK (60 px + 10 de separación; el personaje de la vitrina cede ese alto), y el texto "+1 MAESTRÍA" del resultado en la pantalla de fin de partido (se añade una fila al panel; con el duelo de Ranked el duelo baja 44 px).
