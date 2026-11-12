---
inclusion: always
---

# Sprites de personajes

- **Fuente única:** los sprites de un personaje salen SIEMPRE de sus hojas en `frontend/public/personajes/<Personaje>/`
  (la vista de frente del rival, en `rival/`). Una imagen nueva (de Descargas, de un chat…) se deja primero ahí, con el
  nombre exacto que lee la herramienta. Nunca se copia directo a `frontend/public/assets/characters/`.
- **Flujo:** hoja fuente → `frontend/tools/build-nxo-v2.mjs` / `build-nxo-inferno.mjs` → tiras en
  `frontend/public/assets/characters/<pack>/` y JSON en `frontend/src/characters/`. El juego solo carga las tiras.
  Tiras y JSON son generados: no se editan a mano.
- Antes de tocar una hoja, `frontend/tools/build-nxo-*.mjs` o las tiras de `frontend/public/assets/characters/`,
  lee `docs/COMO-TRABAJAR-SPRITES-MOVIMIENTOS.md` (empieza por su sección 0, reglas para las IA): qué es cada hoja y cada fila, reglas de dibujo,
  comandos y diferencias por personaje.
- Por personaje y vista: 4 hojas de movimientos (8 filas × 8 frames) y 1 hoja del INFERNO (1 fila × 9). Habrá más
  hojas: sus filas se definen primero en `docs/COMO-TRABAJAR-SPRITES-MOVIMIENTOS.md`.
- **Contrato antes de instalar:** comparar la hoja con `docs/COMO-TRABAJAR-SPRITES-MOVIMIENTOS.md` (rejilla, fondo liso, raqueta en la mano
  derecha, sin pelota, frame 1 de pie, filas en su orden) y avisar lo que no cumpla. Una hoja que no sigue el contrato
  no se instala sin preguntar.
- **Tiras en WebP** desde la próxima hoja que se procese, con transparencia, convertidas al final del corte con
  `tools/convert-image.mjs` y los JSON apuntando a `.webp`. Revisar los bordes. WebP baja el peso del APK, no la
  memoria del teléfono: la celda de cada frame tiene que ser la justa.
- Al cambiar una hoja: la anterior a `Old sprites/`, la nueva con el nombre exacto que lee la herramienta,
  regenerar, revisar el log y las tiras, `npx tsc --noEmit` y `npm run build`, y comprobar que los demás packs no
  cambian.
- Si cambias una hoja, una fila o una herramienta, actualiza `docs/COMO-TRABAJAR-SPRITES-MOVIMIENTOS.md` en el mismo cambio.
- No poner preFX/postFX en los sprites del personaje (están dentro de un Container: en el APK se rompe el dibujo).
