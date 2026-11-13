# Auditoría: sprites, herramientas build y multimedia (Claude, 12-11-2026)

Revisión de los cambios de Kiro del 12-11-2026: `build-moves.mjs`, `build-ulti.mjs`, `characters.mjs`, el paso a WebP y los respaldos en `_temp/`.

**Reglas para Kiro:**
- No hacer commit, push ni ramas.
- Re-leer cada archivo antes de editarlo.
- Anotar en `NOTAS-CLAUDE.txt` lo que se cambie.
- Al terminar, correr `npx tsc --noEmit`, `npm run build` y `node tools/test-*.mjs` desde `frontend/`.

## Lo que ya está bien (verificado)
- `tsc`, `npm run build` y los 5 `test-*.mjs` pasan.
- `dist` pesa 21,1 MB y no trae ningún PNG en `assets/characters/`.
- De `personajes/` solo quedan en `dist` los 3 archivos que lee el juego (`pj-nxo.webp`, `pj-nxo-mirada.webp`, `pj-mai-mirada.webp`).
- No hay rutas rotas: se revisaron todas las rutas de assets en `src/`, `index.html`, el manifiesto y los `file` de los JSON de `src/characters/`.
- `git status` no tiene borrados inesperados. Lo borrado coincide con el resumen: los PNG pasados a WebP, los `Old sprites` movidos a `_temp/`, `nxo_portrait`, `mai-sprites/`, `nxo-front-sprites/` y las 3 herramientas viejas.
- Prueba en seco de un personaje nuevo (`test`, copia aislada fuera del proyecto, hojas de NXO renombradas, una sola entrada en `characters.mjs`):
  - `build-moves` generó 32 tiras y 5 JSON.
  - `build-ulti` generó 6 tiras y su JSON.
  - Del lado de las herramientas, el registro funciona.

## Bloquea
Nada.

## Conviene arreglar

### 1. La conversión a WebP puede dejar una tira vieja sin avisar
- **Dónde:** `tools/build-moves.mjs:416-417` y `tools/build-ulti.mjs:190-191`.
- **Problema:** después de `convert-image` solo se comprueba `existsSync(<clip>.webp)`. Si la conversión falla y existe un `.webp` de antes, la comprobación pasa y queda la tira vieja.
- **Ya pasó una vez:** `nxo-inferno/inferno-swing.webp` quedó de 549×540 con un JSON de celda 185×188, y en consola apareció `Frame "4".."8" not found`.
- **Arreglo:** borrar el `.webp` antes de convertir (o comprobar que el archivo sea más nuevo que el PNG) y, si falla, cortar con error.

### 2. `make-button-sprites.mjs` ya no funciona
- **Dónde:** `tools/make-button-sprites.mjs:5` y `:21`.
- **Problema:** lee `public/assets/btn-dash|btn-smash|btn-saque|btn-saque-efecto.png`, que pasaron a `.webp` y se borraron.
- **Ojo:** el juego carga `assets/ui/btn-*.png` (`src/ui/buttonArt.ts:10-13`). Esos sí existen.
- **Arreglo:** leer el `.webp` (convertir a PNG temporal con `convert-image`, como hace `preview-char-colors.mjs`) y, de paso, escribir `assets/ui/*.webp` y actualizar `buttonArt.ts`.

### 3. Las herramientas que escriben PNG no actualizan el juego
- **Dónde:**
  - `tools/build-inferno-ball.mjs:14`
  - `tools/build-power-ball.mjs:20`
  - `tools/build-trail-ball.mjs:64`
  - `tools/build-charge-fx.mjs:43`
  - `tools/build-paloma.mjs:21`
  - `tools/build-nxo-sprites.mjs:348-349`
- **Problema:** escriben `.png`, pero el juego ya carga `.webp`. Si se vuelven a correr, el juego sigue mostrando la versión vieja sin ningún aviso. No pisan los WebP: el problema es que el cambio se pierde.
- **Arreglo:**
  - Una función común (por ejemplo `saveWebp(path, w, h, buf)` en `png-lite.mjs` o en un helper nuevo) que guarde el PNG, llame a `convert-image.mjs`, verifique (punto 1) y borre el PNG.
  - Que todas la usen con salida `.webp`.
  - Que `build-moves`/`build-ulti` usen la misma función.

### 4. "Personaje nuevo = una entrada" solo es cierto en las herramientas
En el juego hay que tocar a mano:
- `src/objects/NxoActor.ts:4-18` (imports de los JSON) y `:202-227` (`PACKS`).
- `src/objects/NxoActor.ts:962` y `:981`: el nombre del rival está fijo (`nxo`→`nxo-front`, `mai`→`mai-front`).
- `src/characters/sheets.ts:11` (`SheetId`) y `src/characters/catalog.ts`.
- `BOUNCE` (alturas del bote del saque): solo está medido para NXO. Un pack con bote necesita sus propias medidas.

**Pedido:**
- Documentarlo en la regla 9 de `docs/COMO-TRABAJAR-SPRITES-MOVIMIENTOS.md`, con esta lista exacta.
- Opcional: deducir el id del rival (`<id>-front`) en vez de fijarlo.

### 5. `docs/COMO-TRABAJAR-SPRITES-MOVIMIENTOS.md` desactualizado
- **Líneas 55-71 (árbol de carpetas):**
  - Muestra `pj-nxo-sprite-inferno.png` y `rival/pj-nxo-rival-inferno.png`, que ya no están en `personajes/`.
  - Muestra carpetas `_temp/respaldo_oficial/` DENTRO de `personajes/`; están en la raíz del repo.
- **Líneas 86-88: es el error más importante.** Dice que un personaje nuevo usa `pj-<id>-inferno.png` y `pj-<id>-rival-inferno.png`, pero `build-ulti.mjs:29` lee `<prefix>-ulti.png`. Quien agregue un personaje con esa guía fallará.
- **Línea 96:** "1 hoja del INFERNO DRIVE: 1 fila de 9 frames". Ya no aplica.
- **Líneas 166-175:** describen el corte por columnas vacías y el cambio de modo "alto/ancho > 0,8" como vigentes. Hoy `build-ulti` es solo rejilla 6×9.
- **Línea 24:** lista `mai-sprites` y `nxo-front-sprites` como packs en WebP; están en `_temp/respaldo_oficial/assets-sin-uso/`.
- **Línea 185:** revisar el estado de `build-nxo-sprites.mjs`, que sigue escribiendo PNG (ver punto 3).
- **Línea 365:** ruta rara `Nxo/_temp/respaldo_oficial/...`.

### 6. Valores fijos dentro de las herramientas
- **En `build-moves.mjs`:**
  - Frames clave y fps: líneas 439-449 (`K`) y 475-563.
  - Detección del cuerpo por píxeles oscuros (RGB < 70): líneas 226 y 292-298.
  - Pies al 95 % de la celda: línea 234.
  - `RUN_LIKE` y `LAST_STAND`: líneas 342-343.
- **En `build-ulti.mjs`:**
  - `STAND_H = 140`: línea 33.
  - fps de `GRID_CLIPS`: líneas 92-99.
  - Píxeles oscuros: línea 129.

**Decidir:**
- Si son parte del contrato (iguales para todos), escribirlo en el doc y en el encabezado de `characters.mjs`.
- Si no, moverlos al registro con valores por defecto.
- **Riesgo:** un personaje de pelo y ropa claros no tendría "cuerpo" con la regla RGB < 70 y el corte fallaría.

## Menor
- **Código muerto en `build-moves.mjs`:**
  - `function keepMain()` y sus `CW`/`CH` (líneas 45-46 y 111-138): no se llama; `KEEP_MAIN` se resuelve en la línea 282.
  - `const WEBP = true` y la rama PNG (42-43).
  - Comentario obsoleto en la línea 429 ("la hoja 2 tiene 9").
- **Error latente en `build-moves.mjs:53`:** `flipX` usa `COLS[1]` para todas las hojas. Rompería un `flipSheets` de una hoja de 9 columnas. Usar las columnas de esa hoja.
- **Línea de comandos:**
  - Los errores salen con todo el detalle técnico de Node (son `throw`). Mejor `console.error(msg); process.exit(1)`.
  - El mensaje de uso de `build-moves` (línea 24) ofrece `mai-front`, que no tiene movimientos. Filtrar por `c.moves`, como hace `build-ulti`.
  - `build-ulti all png` no pasa `png` a cada personaje (línea 23).
  - Con `all`, la primera falla corta los demás. Decidir si debe seguir y resumir los errores al final.
- **Referencias viejas:**
  - `README.md:82-83` nombra `build-nxo-v2.mjs` y `build-nxo-inferno.mjs`.
  - `frontend/vite.config.ts:6-7`: el comentario habla de `tools/build-nxo-*.mjs` y de `_temp` dentro de `personajes/`.
  - `src/objects/NxoActor.ts:152` ("16 frames, 4 columnas"), `:172` (`pj-nxo-sprite-inferno-v2`), `:186-187` (argumentos `front`/`mai` que ya no existen) y `:198` ("hoja de 9 frames").
  - `src/characters/sheets.ts:7-9` (dice `build-nxo-sprites` para todas las hojas).
  - `src/scenes/CustomizeScene.ts:938` y `:1034` (`assets/btn-<id>.png`).
- **`mai-front-inferno/`:** se genera (0,4 MB, más `mai-front-inferno.json`) pero no se carga. Va al APK sin uso hasta conectar el pack.
- **`_temp/`:** pesa 80 MB y no está en `.gitignore`. No va al APK porque está fuera de `public/`. Recomendado agregar `_temp/` a `.gitignore` (lo decide el usuario).

## Riesgos confirmados
- **El rival de Mai no usa la ULTI nueva:** `mai-front` no está en `PACKS`. Al igualar a Mai con el contrato, revisar:
  - `NxoActor.ts:223` (`bounce: null`) y medir su `BOUNCE`.
  - `MatchEndScene.ts:100-108` y `:213-222` (`MAI_END`, poses fijas de `mai-front-end/`).
  - `catalog.ts:16` y `sheets.ts:4, 18`.
  - `build-nxo-sprites.mjs` y `build-end-poses.mjs`, que se podrán borrar.
  - `MAI_LEGACY_MOVES` en `characters.mjs:46-57`, que se borra.
- **El APK es el viejo:** `android/app/build/outputs/apk/debug/game-nxo.apk` (101,9 MB) es de las 20:57; los assets de Android se sincronizaron a las 21:04 (21,1 MB). Lo recompila el usuario con `npm run apk`.
- **La guía está desactualizada:** ver el punto 5.

## Sin verificar (probar a mano)
- **Mai de espaldas** con WebP y ULTI: recibirla, mareo con estrellas, correr y esperar sin raqueta, recogerla.
- **NXO con la hoja 2 nueva:** derecha, revés, cargados, saque normal y con efecto. Mirar que la pelota quede en el cordaje (`serveRacket` remedido).
- **Rival NXO:** golpes, saque, ULTI completa.
- **Mai rival** con su hoja antigua: partido y pantalla de resultado (`mai-front-end`).
- **APK nuevo en el teléfono** y los bordes de las WebP de cerca (halos).
- **Que las tiras salgan idénticas al regenerar:** no se corrieron las herramientas sobre el proyecto real.
