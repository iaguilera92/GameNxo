---
inclusion: always
---

# Sprites de personajes

Aplica a un personaje nuevo y a cualquier cambio en los sprites de los actuales.

- **Fuente única:** los sprites de un personaje salen SIEMPRE de sus hojas en `frontend/public/personajes/<Personaje>/`
  (la vista de frente del rival, en `rival/`). Una imagen nueva (de Descargas, de un chat…) se deja primero ahí, con el
  nombre exacto que lee la herramienta: `pj-<id>-1..4.png` (movimientos) y `pj-<id>-ulti.png` (ULTI). Nunca se copia
  directo a `frontend/public/assets/characters/`.
- **Solo dos herramientas, genéricas:** `node tools/build-moves.mjs <id|all>` (las 4 hojas de movimientos) y
  `node tools/build-ulti.mjs <id|all>` (la ULTI), desde `frontend/`. Hoja fuente → herramienta → tiras WebP en
  `frontend/public/assets/characters/<id>-v2/` y `<id>-inferno/` y JSON en `frontend/src/characters/`. El juego solo
  carga las tiras. Tiras y JSON son generados: no se editan a mano. No crear una herramienta nueva por personaje.
- **Registro de personajes:** todo lo que cambia entre personajes (carpeta y prefijo de las hojas, vista, columnas, orden
  de filas, espejos, cortes a mano, posición de la raqueta en el saque) vive en `frontend/tools/characters.mjs`, una
  entrada por pack (`nxo`, `nxo-front`, `mai`, `mai-front`). Las herramientas no se tocan para un personaje nuevo.
- **Contrato único:** todos los personajes y vistas traen las mismas 4 hojas de movimientos (8 filas × 8 frames, mismo orden
  de filas, mismos movimientos) y 1 hoja de ULTI (6 filas × 9); solo cambia el diseño. Las hojas se redibujan hasta
  cumplirlo: no se añaden excepciones al registro. Las que hay hoy (`MAI_LEGACY_MOVES`) son temporales y se borran
  cuando lleguen las hojas nuevas (pendientes en la sección 8 del documento).
- Antes de tocar una hoja, una herramienta, `characters.mjs` o las tiras de `frontend/public/assets/characters/`,
  lee `docs/COMO-TRABAJAR-SPRITES-MOVIMIENTOS.md` (empieza por su sección 0, reglas para las IA): qué es cada hoja y cada
  fila, reglas de dibujo, comandos y diferencias por personaje.
- **Contrato antes de instalar:** comparar la hoja con `docs/COMO-TRABAJAR-SPRITES-MOVIMIENTOS.md` (rejilla, fondo liso, raqueta en la mano
  derecha, sin pelota, frame 1 de pie, filas en su orden) y avisar lo que no cumpla. Una hoja que no sigue el contrato
  no se instala sin preguntar.
- **Personaje nuevo:** 1) dejar las hojas en `public/personajes/<Personaje>/` con los nombres de arriba; 2) añadir su
  entrada en `tools/characters.mjs`; 3) correr `build-moves.mjs <id>` y `build-ulti.mjs <id>` y revisar el log y las
  tiras; 4) conectar el pack en el juego (`NxoActor.ts` PACKS, `sheets.ts`, `catalog.ts`); 5) mirada y retrato vienen del
  arte (no los genera ningún build); 6) actualizar el documento.
- **Tiras en WebP, todas,** con transparencia: los dos builds ya convierten con `tools/convert-image.mjs` y dejan los JSON
  apuntando a `.webp`. Revisar los bordes. WebP baja el peso del APK, no la memoria del teléfono: la celda de cada frame
  tiene que ser la justa. Las herramientas de efectos y botones que aún escriben PNG se convierten a mano.
- Al cambiar una hoja: la anterior a `_temp/respaldo_oficial/<Personaje>/` (fuera de `frontend/public`, nunca llega al
  APK), la nueva con el nombre exacto que lee la herramienta, regenerar, revisar el log y las tiras, `npx tsc --noEmit` y
  `npm run build`, y comprobar que los demás packs no cambian.
- Si cambias una hoja, una fila o una herramienta, actualiza `docs/COMO-TRABAJAR-SPRITES-MOVIMIENTOS.md` en el mismo cambio.
- No poner preFX/postFX en los sprites del personaje (están dentro de un Container: en el APK se rompe el dibujo).
