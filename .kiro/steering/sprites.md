---
inclusion: always
---

# Sprites de personajes

- Las imágenes fuente de los sprites están siempre en `frontend/public/personajes/<Personaje>/` (la vista de frente
  del rival, en `rival/`).
- Antes de tocar una hoja, `frontend/tools/build-nxo-*.mjs` o las tiras de `frontend/public/assets/characters/`,
  lee `docs/SPRITES.md`: qué es cada hoja y cada fila, reglas de dibujo, comandos y diferencias por personaje.
- Por personaje y vista: 4 hojas de movimientos (8 filas × 8 frames) y 1 hoja del INFERNO (1 fila × 9). Habrá más
  hojas: sus filas se definen primero en `docs/SPRITES.md`.
- Al cambiar una hoja: la anterior a `Old sprites/`, la nueva con el nombre exacto que lee la herramienta,
  regenerar, revisar el log y las tiras, `npx tsc --noEmit` y `npm run build`, y comprobar que los demás packs no
  cambian. Una hoja que no sigue el contrato no se instala sin preguntar.
- Si cambias una hoja, una fila o una herramienta, actualiza `docs/SPRITES.md` en el mismo cambio.
