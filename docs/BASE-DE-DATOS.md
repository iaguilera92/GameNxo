# Base de datos y cuentas (PRÓXIMO PASO DEL PROYECTO)

Pronto se añade una base de datos con cuentas. Cada cuenta guardará qué poderes compró y cuál tiene equipado (ESPECIAL,
DEFENSIVO, ULTI, efecto de carga, color), y el servidor lo usará para validar y para mostrárselo al rival. Este documento
fija lo que ya existe, lo que falta y las reglas para no complicar la migración. Redactado el 12-11-2026 tras revisar el código.

## 1. Lo que ya existe

| Pieza | Dónde | Estado |
|---|---|---|
| Modelo del jugador (`owned`, `equipped`, monedas, nivel, pase, ranked…) | `frontend/src/domain/player.ts` | TypeScript puro, sin Phaser. Hecho para moverse al backend |
| Validación de lo guardado | `frontend/src/domain/migrate.ts` | Descarta ids que no existen y poderes que el jugador no posee. Aquí van las migraciones de ids renombrados |
| Operaciones (comprar, equipar…) | `frontend/src/domain/operations.ts` | Puras: no mutan el estado. El servidor puede ejecutar las mismas |
| Guardado | `frontend/src/domain/playerStore.ts` | Hoy `localStorage` (en el teléfono). Trae un `PlayerRepository` para cambiarlo por una API |
| Catálogo de la Tienda | `frontend/src/domain/shopCatalog.ts` | Ítem `<tipo>:<id>`, precio, nivel mínimo |
| Poderes | `domain/smashPowers.ts`, `defensivePowers.ts`, `infernoPowers.ts`, `chargeFx.ts`, `charColors.ts` | Cada uno con su lista de ids y su función `...Owned` |
| Servidor | `backend/` | Sin cuentas ni base de datos. No sabe qué poder tiene cada jugador |

Cada ítem de la Tienda tiene `rarity` (normal · especial · épica · legendaria; hoy: ULTIS, ESPECIAL y DEFENSIVO especiales salvo el DESTELLO, normal; cargando golpe: Fuego normal, Energía especial, Tulipán épica; EFECTOS DE PELOTA: Brasas, Hielo, Neón y Humo especiales, Tulipanes y Corazones épicas, Estrellas legendaria, Arcoíris y Estrellas legendarias; Rojo, Verde, Oro y Rosado normales. `style:classic` es POR DEFECTO: sin estela) y `realMoneyOnly` (solo dinero real: las ULTIS y la rareza épica o legendaria). Esas dos marcas son datos de catálogo, no de la cuenta: el servidor las lee del mismo catálogo.

El tutorial por nivel guarda en la cuenta los avisos ya vistos (`PlayerState.tutorial`, ids de `domain/tutorial.ts`: no se cambian nunca).

Lo que se guarda por cuenta son solo ids (`smash:ice`, `defensive:blink`, `equipped.smash = 'ice'`…): pesa casi nada.

## 2. Cómo se enteran hoy los rivales (hay que cambiarlo con cuentas)

- ESPECIAL: el rival lo sabe cuando el otro teléfono lo arma (`smash-armed`, `data.element`) o lanza la cinemática (`smash-cine`).
- ULTI: llega en `inferno-cine` (`data.power`). DEFENSIVO: acción `defensive` con `data.kind`.
- `backend/src/socket/guard.ts` copia los valores de texto (máx. 32 caracteres) sin comprobar que sean poderes que existen.
- El servidor tampoco comprueba que el jugador posea el poder que dice usar. Hoy confía en el cliente.

Objetivo con cuentas: el servidor guarda lo comprado y lo equipado, comprueba que el poder es suyo y manda el equipamiento
del rival al empezar el partido, en vez de que el rival lo descubra al usarlo.

## 3. Reglas desde ya (para cualquier IA que toque poderes)

1. **El id de un poder no se cambia nunca.** El nombre que se ve (`name`) es aparte. Si hay que renombrar, se conserva el id
   viejo o se añade una migración en `domain/migrate.ts` (pasó con ESTRELLA → LUZ: `smash:star` → `smash:light`).
   Cuando exista la base de datos, esa tabla de renombres también se aplica en el servidor.
2. **Un poder nuevo** = un id nuevo en su archivo de `domain/`, un ítem en `shopCatalog.ts` y su aspecto. Hoy el aspecto está
   repartido en varias tablas (`SMASH_LOOK` en `fx/smashFx.ts`, `INFERNO_LOOK` y `EXTRA_HIT` en `fx/InfernoFx.ts`, `BLAST` y
   `AFTER` en `fx/ImpactFx.ts`, `GLOW` en `fx/smashElementFx.ts`, `POWER_WALL` en `fx/wallFx.ts`, el filtro de
   `ui/AbilityButton.ts`). Añadir un poder obliga a tocar unos 8 archivos.
3. **Lo que se guarda va en `domain/`**, sin Phaser ni DOM. No guardar nada de la cuenta en `localStorage` fuera de
   `PlayerRepository` (hoy `Stats.ts`, `Settings.ts` y el modo dev usan claves propias: son del dispositivo, no de la cuenta).
4. **No fiarse del cliente.** Cualquier dato que decida compras, nivel, monedas o poderes se valida en el servidor con las mismas
   operaciones de `domain/operations.ts`.
5. **Los tres casos del partido** (usuario, bot, rival online) siguen valiendo (`.kiro/steering/partido.md`): el rival online
   verá los poderes que el servidor diga que tiene.

## 4. Qué falta por poder (ordenado)

1. **Registro único por poder**: un archivo por tipo (ESPECIAL, DEFENSIVO, ULTI) con id fijo, nombre, precio, aspecto, impacto,
   marca en el suelo y sonidos. Sustituye a las tablas sueltas del punto 3.2.
2. **Sonidos propios por poder.** Hoy:
   - ESPECIAL: ninguno propio. Todos comparten `cargando`, `golpe-fuerte`, `stun` y `electricidad`.
   - ULTI: propio en fuego, rayo y hielo (`ulti-*`, `impacto-ulti-*`). Viento y tulipán usan el genérico.
   - DEFENSIVO: `dash-1`, `dash-destello`, `dash-shadow`, `dash-jump`. VOLTERETA y PATINAJE reutilizan otros. El sonido del DASH
     cambia según el ESPECIAL equipado (`dashSfx`, eléctrico con rayo): separarlo.
3. **Efectos de los defensivos fuera de `MatchScene`** (hoy están dentro de `startShadow`, `startJump`, `startFlip`,
   `startSkate`, `startBlink`…) a un archivo propio con una función por poder.
4. **Contrato de datos del servidor**: lista de ids válidos, qué compra desbloquea cada uno, esquema de la cuenta, migración de
   ids, qué viaja al rival al empezar el partido. Sale de `PlayerState` y `Loadout`.
5. **Cuentas y base de datos**: otro `PlayerRepository` (API), identificación, y validación en el servidor de cada operación.
   Decidir el motor y el alojamiento con el dueño del proyecto antes de empezar.

## 5. Lo que NO está decidido

Motor de base de datos, forma de iniciar sesión, si el servidor es la única fuente de la verdad o solo valida, y qué se hace con
los perfiles que hoy están en `localStorage`. Preguntar antes de decidirlo.

## Maestrías y ZONA por personaje (pendiente de construir)

Cada personaje tendrá una pasiva (Nxo = Agilidad, Mai = Precisión, hasta +10 %) que sube con **puntos de Maestría** ganados al ganar partidos
(solo desde el nivel 20 de la cuenta), y los atributos de ZONA pasan a guardarse **por personaje**. Nuevos datos por cuenta: `mastery` (puntos por
`skin`) y `zone.stats` por `skin`. Todo en `domain/`, validado en el servidor con `operations.ts` (`awardMastery`). Definición completa y decisiones
abiertas: `docs/MAESTRIAS.md`.
