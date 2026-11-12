# Sprites de los personajes: hojas fuente, filas y cómo se cortan

Contrato de las hojas de sprites. Léelo antes de tocar una imagen de `frontend/public/personajes/`, las
herramientas `frontend/tools/build-moves.mjs` / `build-ulti.mjs` / `characters.mjs` o las tiras de `frontend/public/assets/characters/`.
Si cambias una hoja, una fila o una herramienta, actualiza este documento en el mismo cambio.

Última actualización: 12-11-2026.

## 0. Reglas para las IA (resumen; el detalle está en las secciones siguientes)

1. **Fuente única.** Los sprites de un personaje salen SIEMPRE de sus hojas en `frontend/public/personajes/<Personaje>/`
   (el rival, en `rival/`). Una imagen nueva (de Descargas, de un chat…) se deja primero ahí, con el nombre exacto que
   lee la herramienta. Nunca se copia directo a `assets/characters/`.
2. **Flujo.** Hoja fuente (`personajes/`) → herramienta (`tools/build-moves.mjs`, `build-ulti.mjs`) → tiras en
   `frontend/public/assets/characters/<pack>/` y JSON en `frontend/src/characters/`. El juego solo carga las tiras.
   Tiras y JSON son generados: no se editan a mano, se regeneran desde la hoja.
3. **Contrato antes de instalar.** Comparar la hoja con las secciones 4 y 5 (rejilla 8 × 8, fondo liso, raqueta en la
   mano derecha, sin pelota, frame 1 de pie, filas en su orden). Avisar al usuario de lo que no cumpla. Una hoja que no
   sigue el contrato no se instala sin preguntar.
4. **Tiras en WebP** (decidido el 12-11-2026). Desde la próxima hoja que se procese, las tiras de `assets/characters/`
   van en `.webp` con transparencia: pesan unas 4 veces menos en el APK. El primer pack en WebP es el rival NXO
   (`nxo-front-v2/`, 12-11-2026): `build-moves.mjs` escribe cada tira en PNG, la convierte con
   `tools/convert-image.mjs` (calidad 0,92), borra el PNG y deja los JSON apuntando a `.webp` (constante `WEBP`, hoy
   siempre `true`). TODAS las tiras de personajes están en WebP desde el 12-11-2026: `nxo-v2`, `nxo-front-v2`, `mai-v2` y los packs antiguos (`mai-sprites`, `nxo-front-sprites`, `mai-front-sprites`, convertidos a mano). Las herramientas viejas (`build-nxo-sprites.mjs`) aún sacan PNG: convertir y borrar el PNG. La ULTI completa de NXO (`nxo-inferno/`, `nxo-front-inferno/`) también va en WebP (`build-ulti.mjs`,
   modo de 6 × 9). Al pasar otro pack a WebP: activarlo en `WEBP`, regenerar y revisar de cerca los bordes. Si queda
   un halo, subir la calidad. La conversión abre Chrome headless por tira: el corte tarda un par de minutos.
5. **Tamaño del frame.** WebP no baja la memoria del teléfono: cada frame ocupa ancho × alto × 4 bytes en la GPU,
   sea PNG o WebP. La celda tiene que ser la justa para lo que dibuja, sin aire de más. La del rival NXO bajó de
   250 × 206 a 178 × 136 con las hojas 1-3 del 12-11-2026.
6. **Al terminar.** Mover la hoja anterior a `_temp/respaldo_oficial/<Personaje>/`, regenerar, leer el log, mirar las tiras, correr
   `npx tsc --noEmit` y `npm run build`, comprobar que los demás packs no cambian y actualizar este documento.
7. **Solo dos herramientas y un registro.** `build-moves.mjs <id|all>` (movimientos) y `build-ulti.mjs <id|all>` (ULTI) sirven
   para cualquier personaje; lo que cambia de uno a otro vive en `tools/characters.mjs`. No se crea una herramienta por
   personaje ni se meten excepciones en las herramientas.
8. **Contrato único.** Todos los personajes y vistas traen las mismas hojas y filas; solo cambia el diseño. Si una hoja no
   lo cumple, se redibuja (queda en la §8) y no se añade una excepción al registro. Las de hoy (`MAI_LEGACY_MOVES`) son
   temporales.
9. **Personaje nuevo, en orden.** a) Hojas en `personajes/<Personaje>/` con los nombres `pj-<id>-1..4.png` y
   `pj-<id>-ulti.png`; b) comparar con el contrato (regla 3); c) entrada nueva en `tools/characters.mjs`; d) correr los dos
   builds y revisar log y tiras; e) conectar el pack en el juego (`NxoActor.ts` PACKS, `sheets.ts`, `catalog.ts`);
   f) mirada y retrato vienen del arte; g) `tsc`, `npm run build`, probar en partido y actualizar este documento.
10. **En el juego.** No poner preFX/postFX en los sprites del personaje: están dentro de un Container y en el APK se rompe
   el dibujo. El estilo de color usa su propio pipeline de dibujo (`fx/CharColorFx.ts`).

## 1. Dónde están las imágenes

Las imágenes con las que trabajamos los sprites están **siempre** en `frontend/public/personajes/<Personaje>/`:
una carpeta por personaje, y la vista de frente (rival) en su subcarpeta `rival/`.

```
frontend/public/personajes/
├── Nxo/
│   ├── pj-nxo-1.png … -4.png   hojas de movimientos, de espaldas (jugador)
│   ├── pj-nxo-ulti.png                 ULTI completa, de espaldas (6 filas × 9; la que se usa desde el 12-11-2026)
│   ├── pj-nxo-sprite-inferno.png       INFERNO DRIVE antiguo de 1 fila (respaldo, ya no se procesa)
│   ├── pj-nxo-mirada.webp              franja de los ojos del INFERNO        (la carga el juego)
│   ├── pj-nxo.webp                     retrato: menú, PERSONAJE y VS         (la carga el juego)
│   ├── emojis/                         nxo-risa, nxo-pensando, nxo-enojado   (fuentes: el juego usa assets/emotes/)
│   ├── _temp/respaldo_oficial/                    versiones anteriores
│   └── rival/
│       ├── pj-nxo-rival-1.png … -4.png hojas de movimientos, de frente (rival)
│       ├── pj-nxo-rival-ulti.png       ULTI completa, de frente (6 filas × 9; la que se usa desde el 12-11-2026)
│       ├── pj-nxo-rival-inferno.png    INFERNO DRIVE antiguo de 1 fila (respaldo, ya no se procesa)
│       └── _temp/respaldo_oficial/
└── Mai/
    ├── pj-mai-1.png … -4.png           hojas de movimientos, de espaldas
    ├── pj-mai-ulti.png                 ULTI completa (6 × 9), de espaldas
    ├── pj-mai-mirada.webp              franja de los ojos del INFERNO        (la carga el juego)
    ├── pj-mai.png                      referencia del diseño
    └── rival/                          pj-mai-rival-1..4.png, pj-mai-rival-ulti.png (solo la hoja 1 y la ULTI en uso; ver §6)
        └── _temp/respaldo_oficial/                hojas 1, 2 e INFERNO anteriores (-antes-new)
```

Reglas:

- Son imágenes **fuente**: el juego no las carga. Las herramientas las cortan en tiras
  (`public/assets/characters/<carpeta>/`) y escriben los JSON (`src/characters/`). Tiras y JSON son
  archivos generados: no se editan a mano, se regeneran.
- `npm run build` quita de `dist/` (y del APK) todo `personajes/` salvo lo que lista `KEEP_IN_PERSONAJES` en
  `frontend/vite.config.ts` (hoy: `Nxo/pj-nxo.webp`, `Nxo/pj-nxo-mirada.webp`, `Mai/pj-mai-mirada.webp`). Si el
  juego tiene que leer otro archivo de aquí, hay que añadirlo a esa lista.
- Los emojis de `Nxo/emojis/` son fuentes: `node tools/build-emote-thumbs.mjs` genera las miniaturas de 160 px que usa
  el juego (`public/assets/emotes/`). No van al APK (12-11-2026).
- Para cambiar una hoja: mover la anterior a `_temp/respaldo_oficial/<Personaje>/` con un sufijo (`pj-nxo-rival-2-antes-new.png`),
  dejar la nueva con el nombre exacto que lee la herramienta (sin `-new`) y regenerar (sección 3).
- Los nombres de Nxo de espaldas son históricos (`pj-nxo-N`, `pj-nxo-sprite-inferno`). Un personaje
  nuevo sigue el patrón de Mai: `pj-<id>-1..4.png`, `pj-<id>-inferno.png`, `pj-<id>-mirada.webp` y, en
  `rival/`, `pj-<id>-rival-1..4.png` y `pj-<id>-rival-inferno.png`.

## 2. Qué hojas tiene cada personaje

Por personaje y por vista (espaldas = jugador, frente = rival):

- **4 hojas de movimientos** (hojas 1 a 4) de 8 filas cada una. Más adelante habrá más hojas (5, 6…): ver la
  sección 7.
- **1 hoja del INFERNO DRIVE**: 1 fila de 9 frames. NXO (de espaldas y de frente) ya usa la **hoja de la ULTI completa**
  (6 filas × 9: golpe, recibir el pelotazo, aturdido, reposo y carrera sin raqueta y recogerla; sección 5).
- Imágenes sueltas: mirada (`-mirada.webp`), retrato y emojis.

| Pack | Vista | Hojas 1-4 | INFERNO | Tiras que carga el juego | JSON (`src/characters/`) |
|---|---|---|---|---|---|
| `nxo` | espaldas | `Nxo/pj-nxo-1..4.png` | `Nxo/pj-nxo-ulti.png` (6 × 9, tiras WebP) | `nxo-v2/`, `nxo-inferno/` | `nxo-{sprites,hits,move,special,extra,inferno}.json` |
| `nxo-front` | frente | `Nxo/rival/pj-nxo-rival-1..4.png` | `Nxo/rival/pj-nxo-rival-ulti.png` (6 × 9, tiras WebP) | `nxo-front-v2/`, `nxo-front-inferno/` | `nxo-front-*.json` |
| `mai` | espaldas | `Mai/pj-mai-1..4.png` | `Mai/pj-mai-ulti.png` (6 × 9, tiras WebP) | `mai-v2/`, `mai-inferno/` | `mai-*.json` |
| `mai-front` | frente | `Mai/rival/pj-mai-rival-1..4.png` (sin procesar) | `Mai/rival/pj-mai-rival-ulti.png` (6 × 9, tiras WebP) | movimientos: hoja antigua `mai-front-sprites/`; ULTI: `mai-front-inferno/` | `mai-front-sprites.json`, `mai-front-inferno.json` |

Qué pack usa cada personaje: `src/characters/catalog.ts`. Carga de los packs: `PACKS` en
`src/objects/NxoActor.ts`.

Archivos del código que mueven las animaciones (rescatado de `MOVIMIENTOS-PERSONAJES.txt`, borrado el 12-11-2026):

| Archivo | Qué hace |
|---|---|
| `src/characters/sheets.ts` | registro de las hojas antiguas (`SHEET_IDS`) y sus JSON |
| `src/characters/catalog.ts` | qué pack usa cada personaje en cada vista |
| `src/characters/*.json` | celda, ancla, alto de pie, fps, bucle y fotogramas clave de cada tira (generados) |
| `src/objects/NxoActor.ts` | carga las tiras (`queueNxoSpriteLoads`, desde `BootScene`), registra las animaciones y es la máquina de estados que reproduce cada clip |
| `src/objects/Character.ts` | puente entre `MatchScene` y `NxoActor` (`swing`, `serve`, `victory`, `defeat`…) |
| `src/scenes/MatchScene.ts` | decide **cuándo** se llama cada animación |
| `src/scenes/MatchEndScene.ts` | poses de la tarjeta del resultado (`endClips`, silueta medida, `defeatHoldKey`) |

## 3. Cómo se generan

Desde `frontend/`:

```powershell
# Movimientos (hojas 1-4): un personaje por vez, o todos
node tools/build-moves.mjs nxo          # NXO de espaldas: hojas 1-4 -> nxo-v2/ + nxo-*.json
node tools/build-moves.mjs nxo-front    # NXO rival:       hojas 1-4 -> nxo-front-v2/ + nxo-front-*.json
node tools/build-moves.mjs mai          # MAI de espaldas: hojas 1-4 -> mai-v2/ + mai-*.json
node tools/build-moves.mjs all          # todos los que tienen hojas de movimientos

# ULTI (hoja de 6 × 9): lo mismo
node tools/build-ulti.mjs nxo           # -> nxo-inferno/*.webp + nxo-inferno.json
node tools/build-ulti.mjs nxo-front     # -> nxo-front-inferno/
node tools/build-ulti.mjs mai           # -> mai-inferno/
node tools/build-ulti.mjs mai-front     # -> mai-front-inferno/ (cortada, aún sin conectar al juego)
node tools/build-ulti.mjs all           # todos los que tienen ULTI
npx tsc --noEmit
npm run build
```

**Contrato único:** todos los personajes y vistas traen las mismas 4 hojas (8 filas × 8 frames, mismo orden de filas, mismos movimientos); solo cambia el diseño. Hoy NXO lo cumple y **las hojas 3 y 4 de MAI no** (aturdido en la fila 4 de la hoja 3, sin recuperación izquierda, hoja 4 con 9 columnas y sus filas 1-2 sin bote ni lanzamiento): esas diferencias están marcadas como TEMPORALES en `tools/characters.mjs` (`MAI_LEGACY_MOVES`) y se borran cuando lleguen sus hojas nuevas con el orden de NXO. Solo hay DOS herramientas, y valen para cualquier personaje: `build-moves.mjs` (las 4 hojas de movimientos) y `build-ulti.mjs` (la ULTI). Lo que cambia de un personaje a otro (carpeta de las hojas, nombre de las hojas, orden de filas, columnas, cortes a mano, espejos, posición de la raqueta en el saque) vive en **`tools/characters.mjs`**, una entrada por pack (`nxo`, `nxo-front`, `mai`, `mai-front`); las herramientas no se tocan. Cada una imprime el tamaño y la celda de cada hoja, el alto de pie medido, la escala por fila y avisos
como `pieza ancha` (una pieza más ancha que su celda): revisa el log y mira las tiras antes de dar una hoja por buena.

`build-moves.mjs`, por hoja:

1. Quita el fondo: verde de croma (con limpieza del reflejo verde en el borde) o blanco casi puro. El blanco se
   quita rellenando desde el borde de la imagen, así que lo blanco encerrado en el dibujo (camiseta, cordaje) se
   conserva. El fondo negro ya no se admite (`blackToAlpha` se quitó el 12-11-2026, cuando la hoja 2 del rival
   llegó en verde).
2. Divide la hoja en 8 filas y N columnas iguales (N = 8; la hoja 4 de Mai, 9). La celda sale del tamaño real de
   la imagen: una hoja puede medir 1536×1024, 1254×1254 o 1330×1182.
3. Separa las piezas conexas y asigna cada una a su celda por la posición de los pies. Entre filas corta por la
   línea más vacía de cada columna, buscando entre 40 px por encima y 16 px por debajo del límite nominal. Si dos
   frames se tocan más abajo, la línea se pone a mano en `cutAt` (`tools/characters.mjs`) (hoja → `'fila de arriba/frame'` → y en px de la
   hoja). Las piezas sueltas (raqueta, estrellas, polvo) van con el cuerpo más cercano de su columna, y un trozo
   que ese corte separó de un cuerpo vuelve a su cuerpo.
4. Apoya cada fila en su suelo (mediana de la base de sus frames) y la escala para que su **frame 1, de pie**,
   mida lo mismo que la guardia de referencia. Todas las hojas se igualan a la más pequeña (solo reduce, nunca
   amplía).
5. Escribe una tira por animación, con la misma celda para todas y el ancla en el centro del cuerpo, a la altura
   del suelo, y los JSON con fps y fotogramas clave. El juego escala cada pack por su `standHeight`: una hoja
   dibujada más grande da más resolución, no un personaje más grande.

`build-ulti.mjs` hace lo mismo con la hoja del INFERNO: fondo verde o transparente, separa los 9 frames
por columnas vacías (o por piezas si dos se solapan sin tocarse), escala con el frame 1 de pie a 140 px y
empaqueta los 9 en una textura de 3 columnas.

Con una hoja cuadrada (alto / ancho > 0,8: la ULTI completa de 6 × 9) cambia de modo: corta por la **rejilla fija**
(celda = ancho/9 × alto/6), no por columnas vacías. Cada pieza va entera a la celda donde cae su centro (un efecto
que roza el borde de la celda no se corta) y las manchas de menos de 30 px se ignoran. Una sola escala para todas
las filas (el frame 1 de la fila 1, de pie, mide 140 px), cada fila apoyada en la mediana de sus suelos y el ancla
en el centro del cuerpo (píxeles oscuros: las estrellas y destellos no lo mueven). Escribe una textura de 3 × 3 por
clip, todas con la misma celda, en WebP (con `png` como 2.º argumento, `node tools/build-ulti.mjs <id> png`, las deja en PNG para probar). Las hojas antiguas de 1 fila ya no se procesan (la herramienta vieja está en `_temp/respaldo_oficial/tools-viejas/`).

### Todas las herramientas de `frontend/tools/` que tocan imágenes

| Herramienta | Qué hace | Estado |
|---|---|---|
| `build-moves.mjs` | Corta las hojas 1-4 (8 filas × 8) de NXO espaldas / rival / Mai en tiras WebP + JSON. | **En uso** |
| `build-ulti.mjs` | Corta la ULTI (6 × 9) de cualquier personaje en tiras WebP + JSON. | **En uso** |
| `characters.mjs` | Registro de personajes: qué hojas, filas, columnas y ajustes tiene cada pack. Lo leen las dos herramientas. | **En uso** |
| `convert-image.mjs` | Convierte PNG ↔ WebP con Chrome headless. Lo llaman las otras herramientas. | **En uso** |
| `build-nxo-sprites.mjs` | Primera generación: la hoja NO tenía rejilla fija, así que mide filas y frames (valles de la proyección, componentes conexas), escala por fila y escribe `<id>-sprites/*.png` + `nxo-sprites.json` / `mai-sprites.json`. | **Antigua.** Solo sigue ligada a **Mai rival** (`mai-front-sprites/`, hoja sin migrar). Saca PNG: convertir a WebP a mano. Cuando Mai rival pase a `build-moves.mjs`, se puede borrar. |
| `paste-row.mjs` | Pega una animación suelta (frames en cuadrícula) como fila de una hoja de NXO. | Auxiliar para armar hojas. |
| `keep-enclosed-green.mjs` | Conserva los detalles verdes encerrados en el personaje (hojas de la gorra de Mai) al quitar el croma. | Auxiliar de `build-moves.mjs`. |
| `build-end-poses.mjs` | Poses de la pantalla de resultado para un personaje de frente sin hoja nueva (`mai-front-end/`). | En uso para Mai rival. |
| `png-lite.mjs` | Lector/escritor PNG mínimo, sin dependencias. | Librería interna. |
| `build-inferno-ball.mjs`, `build-power-ball.mjs`, `build-trail-ball.mjs` | Hojas de las bolas del INFERNO (fuego, hielo, viento, rayo, tulipán). | En uso. **Sacan PNG** (convertir a WebP). |
| `build-charge-fx.mjs` | Hoja del aro de carga bajo el jugador. | En uso. |
| `build-paloma.mjs`, `build-emote-thumbs.mjs`, `make-button-sprites.mjs`, `make-android-icons.mjs` | Paloma del ambiente, miniaturas de emotes, botones ligeros del partido, íconos de la app. | En uso. Los dos primeros y `make-button-sprites` sacan PNG. |
| `preview-char-colors.mjs` | Vista previa de los estilos de color (`fx/CharColorFx.ts`). | Auxiliar. |

Las demás (`sim-*.mjs`, `test-*.mjs`, `apk.mjs`) no son de imágenes: simulaciones, pruebas y compilar el APK.

## 4. Reglas de dibujo (valen para todas las hojas)

- **Rejilla**: 8 filas × 8 frames, repartidos de forma uniforme. Un personaje por celda. Hay que dejar aire entre
  filas: los pies de una fila no deben tocar la cabeza ni la raqueta de la fila de abajo.
- **Fondo**: liso, de un solo color: verde croma intenso (tipo `#00FF00`), blanco o negro. Nada verde en el
  personaje (las hojas de la flor de la gorra de Mai se recuperan con un caso especial:
  `tools/keep-enclosed-green.mjs`).
- **Mano**: la raqueta siempre en la mano **derecha**. De espaldas queda a la derecha de la imagen; de frente
  (rival), a la **izquierda** de la imagen. Si una hoja llega con la raqueta en la mano izquierda, la herramienta
  puede espejarla (sección 6), pero es mejor pedirla bien.
- **Sin pelota**: el juego dibuja la suya (en el bote del saque la mueve con la mano). Sí se dibujan el polvo,
  las estrellas y los destellos que forman parte del movimiento.
- **Frame 1 de cada fila, de pie** en guardia y a la altura del reposo: la herramienta lo usa para medir y escalar
  la fila. Excepciones: las filas que empiezan corriendo (`runstop`, `brake-turn`, `run-left`, `dash`) se miden
  con la carrera, y las recuperaciones (`recover-*`) con su último frame, que tiene que ser de pie.
- **Mismo tamaño** de personaje en toda la fila. Entre hojas puede variar (la herramienta lo iguala), dentro de
  una fila no.
- **Direcciones de pantalla**: "derecha" e "izquierda" son de la imagen, no del personaje. Las carreras se dibujan
  hacia la derecha de la imagen y el juego las voltea para ir a la izquierda (`run`, `walk`, `runstop`, `dash`).
  Las estiradas no se voltean: `dive-right` se tira hacia la derecha de la pantalla y `dive-left` hacia la
  izquierda. El juego usa `forehand` cuando la pelota llega por la derecha de la pantalla y `backhand` por la
  izquierda, en las dos vistas (`facing` en `NxoActor`).
- **Fotogramas clave**: en este documento van contados desde 1, como en la hoja. En los JSON van desde 0 (el
  frame 5 de la hoja es `4` en el JSON).

## 5. Qué es cada fila

"Sin uso todavía" = la fila se corta y se carga, pero ningún código la reproduce. Las filas son de 8 frames salvo
donde se indica.

### Hoja 1: movimiento

| Fila | Clip | fps | Qué se dibuja | Uso en el juego |
|---|---|---|---|---|
| 1 | `idle` | 8, bucle | reposo en guardia | parado |
| 2 | `run` | 14, bucle | correr hacia la derecha | correr (volteado hacia la izquierda), al ritmo de la velocidad real |
| 3 | `runstop` | 14 | frenada desde la carrera hasta la guardia | soltar el joystick corriendo rápido |
| 4 | `victory` | 10 | celebración; la última pose se mantiene | partido ganado. La última pose de la vista de frente sale en la tarjeta del resultado |
| 5 | `brake-turn` | 14 | frenada y giro: de correr a la derecha a correr a la izquierda | cambio de sentido corriendo; los frames 2-5, frenada al acabar el DASH |
| 6 | `run-left` | 14, bucle | correr hacia la izquierda | no se reproduce (se voltea `run`), pero tiene que existir: activa las hojas nuevas en `NxoActor` |
| 7 | `dash` | 18, bucle | sprint del DASH hacia la derecha | DASH (volteado hacia la izquierda) |
| 8 | `defeat` | 10 | derrota; la última pose se mantiene | partido perdido. Igual que `victory` en la tarjeta del resultado |

### Hoja 2: golpes

El golpe se reproduce desde su frame de espera (o el siguiente, si ya estaba esperando): los frames anteriores
no se ven en el golpe. Desde la hoja 2 del rival del 12-11-2026, espaldas y rival usan los mismos frames clave.

| Fila | Clip | fps | Qué se dibuja | Frames clave | Uso en el juego |
|---|---|---|---|---|---|
| 1 | `forehand` | 15 | derecha: golpe por el lado de la raqueta | espera 2 · impacto 7 | golpe normal, pelota por la derecha |
| 2 | `backhand` | 15 | revés | espera 2 · impacto 6 | golpe normal, pelota por la izquierda |
| 3 | `forehand-power` | 15 | derecha cargada | carga 4 · impacto 6 | golpe cargado de derecha; el frame de carga es la pose mientras se carga |
| 4 | `backhand-power` | 15 | revés cargado | carga 4 · impacto 6 | golpe cargado de revés |
| 5 | `serve` | 12 | saque normal | trofeo (espera la pelota) 3 · impacto 5 | saque normal: arranca en el trofeo, tras `serve-toss` |
| 6 | `serve-spin` | 12 | saque con efecto | trofeo 3 · impacto 5 | saque con efecto; el juego le suma un salto por código en los frames 3-6 (`JUMP_ARC`) |
| 7 | `smash` | 14 | remate | arranca en 3 · impacto 5 | pelota alta |
| 8 | `smash-power` | 14 | remate del SMASH potenciado, con salto | arranca en 3 · impacto 5 | ataque especial SMASH |

**Tiempo del saque.** El instante del contacto físico depende del clip: `NxoActor.serveContactDelay()` =
(frame de impacto − frame de espera) / fps de `serve` o `serve-spin`, y `MatchScene.beginSwing` lo usa para el golpe y
el salto (`serveJump`), junto con `SERVE` de `config.ts`. Cambiar los frames o los fps del saque mueve el contacto:
retocar ambos juntos.

**Dónde queda la raqueta en el impacto del saque (`serveRacket`).** En el frame de impacto de `serve` y de
`serve-spin` (frame 5, índice 4) el juego pone la pelota en el centro del cordaje: la altura a la que salta el
sacador (`MatchScene.serveJump`) y el lado en el que sube la pelota salen de ahí. Está medido sobre cada tira y se
guarda en `src/characters/<pack>-hits.json` como `serveRacket: { normal: { dx, z }, spin: { dx, z } }`, en
unidades del personaje (alto 150): `z` = altura del centro del cordaje sobre los pies y `dx` = desplazamiento lateral
(+ = derecha de la pantalla). Lo escribe `tools/build-moves.mjs` (constante `K.serveRacket`). **Si se cambia la
hoja 2 (filas 5 o 6) o la hoja del saque de un personaje hay que volver a medirlo**: abrir el frame 5 de la tira,
anotar el centro del óvalo de la raqueta en píxeles (sobre los pies y respecto al centro de la celda) y multiplicar por
`150 / standHeight`. Valores actuales: NXO espaldas 147 / 143 (z normal / efecto; dx −25 / −33, hoja 2 del 12-11-2026), NXO rival 148 / 146 (dx −10 / −19,
raqueta a la izquierda de la imagen; medido el 12-11-2026), MAI 128 / 146.

### Hoja 3: estiradas y reacciones

| Fila | Clip | fps | Qué se dibuja | Uso en el juego |
|---|---|---|---|---|
| 1 | `dive-right` | 18 | estirada hacia la derecha de la pantalla: se lanza y cae | estirada (`lunge`) a por una pelota lejana por la derecha; en red, también la del rival |
| 2 | `dive-left` | 18 | lo mismo hacia la izquierda | estirada por la izquierda |
| 3 | `recover-right` | 14 (×1,4) | se levanta tras `dive-right`: empieza tumbado y termina de pie | justo después de `dive-right`; moverse la corta |
| 4 | `recover-left` | 14 (×1,4) | se levanta tras `dive-left` | justo después de `dive-left` |
| 5 | `stunned` | 12, bucle | aturdido: estrellas y mareo | le impacta el ataque especial SMASH (dura `POWER_IMPACT.stunMs`) |
| 6 | `point-won` | 12 | celebra el punto | al acabar un punto ganado |
| 7 | `point-lost` | 10 | se lamenta | al acabar un punto perdido |
| 8 | `wait` | 10, bucle | espera activa (NXO: las marcas "( )" sueltas se quitan al cortar) | sin uso todavía |

La estirada y la recuperación se encadenan: el último frame de `dive-*` debería enlazar con el primero de
`recover-*` (en el suelo). La hoja 3 del rival NXO (12-11-2026) ya lo cumple: la estirada termina tumbada y la
recuperación empieza tumbada. En las hojas de espaldas el frame 8 de la estirada vuelve a estar de pie y se nota
un salto al empezar la recuperación; en las hojas nuevas conviene terminar la estirada en el suelo.

El contacto de la estirada es fijo en el tiempo (`LUNGE_CONTACT_S` = 0,2 s a 18 fps → frame 4), así que el alcance
máximo tiene que dibujarse en el frame 4 (o 4-5).

### Hoja 4: saque y extras

| Fila | Clip | fps | Qué se dibuja | Uso en el juego |
|---|---|---|---|---|
| 1 | `serve-bounce` | 12, bucle | bota la pelota antes de sacar (sin pelota dibujada) | sacador quieto antes de lanzar. Solo en los packs con `bounce` (NXO de espaldas: `BOUNCE`; NXO rival de frente: `BOUNCE_FRONT`, medido a ojo con la raqueta): la pelota sigue la mano con esas alturas en `NxoActor.ts`, que hay que volver a medir si cambia esta fila |
| 2 | `serve-toss` | 14 | lanza la pelota y arma el brazo; la última pose se mantiene | al pulsar sacar, hasta el golpe (`serve` / `serve-spin` desde el trofeo) |
| 3 | `walk` | 10, bucle | caminar hacia la derecha | los primeros 500 ms al empezar a moverse (`WALK_MS`), luego `run` |
| 4 | `inferno-hit` | 14 | recibe el INFERNO y la raqueta sale despedida | recibe un INFERNO. Desde el frame 3 la mano queda vacía: la raqueta que vuela la dibuja el juego |
| 5 | `volley` | 16 | volea | golpe en la red, desde el frame 2 · impacto 5 |
| 6 | `dropshot` | 14 | dejada | sin uso todavía (impacto 5 en el JSON) |
| 7 | `intro` | 10 | presentación al empezar el partido | sin uso todavía |
| 8 | `greet` | 10 | saludo | sin uso todavía |

### Hoja del INFERNO DRIVE

1 fila de 9 frames, fondo verde o transparente, raqueta en la mano derecha y sin pelota. Entre frames tiene que
haber columnas vacías; si dos se solapan (la raqueta de uno por encima del otro), que no se toquen.

| Frame | Qué se dibuja | Uso en el juego |
|---|---|---|
| 1 | de pie, en guardia | mide la escala (140 px de alto); no se muestra |
| 2-4 | preparación | hoy no se muestran |
| 5 | concentración: raqueta atrás y la otra mano señalando | pose congelada mientras dura la cinemática (`hold`) |
| 6 | justo antes del golpe | últimos ms de la espera (`preStrike`); el golpe arranca aquí (`strikeFrom`) |
| 7 | impacto | contacto con la pelota (`impact`) |
| 8-9 | seguimiento y final | final del golpe |

### Hoja de la ULTI completa (6 filas × 9)

NXO de espaldas (`Nxo/pj-nxo-ulti.png`) y NXO rival de frente (`Nxo/rival/pj-nxo-rival-ulti.png`, sin espejo), del 12-11-2026; las hojas de 1 fila quedan de respaldo. Mai de espaldas y de frente (`Mai/pj-mai-ulti.png`, `Mai/rival/pj-mai-rival-ulti.png`) también, del 12-11-2026. Llegaron de 1254×1254 (celda 139×209): la herramienta corta por ancho/9 × alto/6, así que vale cualquier tamaño.
Rejilla fija de 9 columnas × 6 filas, celdas iguales, fondo verde croma liso. Los efectos dibujados (estela,
estallido, sudor, estrellas, polvo, brillos) van en blanco o amarillo, nunca en verde, y son parte del frame. El
frame 1 de la fila 1 de pie, como en las otras hojas. Sin pelota.

| Fila | Clip | Frames | fps | Bucle | Qué se dibuja | Uso en el juego |
|---|---|---|---|---|---|---|
| 1 | `inferno-swing` | 9 | 15 | no | golpe de la ULTI con estela; poses como la tabla de arriba | ULTI propia: `hold` 5, `preStrike` / `strikeFrom` 6 (el destello: el golpe arranca ahí al contacto), `impact` 7 (0-based 4 / 5 / 6, igual de frente sin espejo) |
| 2 | `ulti-hit` | 9 | 14 | no | recibe el pelotazo: la raqueta se suelta en el frame 2; desde el 3, mano vacía | ULTI recibida. La raqueta que vuela la dibuja `MatchScene.loseRacket` a los `RACKET_LOSS.launchMs` (143 ms = 2 frames a 14 fps) |
| 3 | `ulti-stun` | 9 | 12 | sí | aturdido sin raqueta, con las estrellas dibujadas | tras `ulti-hit`, en bucle hasta que acaba el aturdido. La escena no pone sus estrellas encima |
| 4 | `idle-nr` | 9 | 8 | sí | reposo sin raqueta | parado mientras la raqueta está en el suelo |
| 5 | `run-nr` | 9 | 14 | sí | corre hacia la derecha sin raqueta | correr sin raqueta (volteado hacia la izquierda); sin `walk` ni frenada |
| 6 | `pickup` | 9 | 14 | no | se agacha, toma la raqueta del suelo (la mano la toma en el frame 4) y termina en guardia con ella | al pasar por encima de la raqueta: quieto mientras dura; en el frame 4 (`pickupGrab`, 0-based 3) se va la raqueta del suelo |

En el juego (`NxoActor`): `impactStun('inferno')` reproduce `ulti-hit` y encadena `ulti-stun`; `setNoRacket(true)`
(desde `MatchScene.loseRacket`) cambia el reposo y la carrera a `idle-nr` / `run-nr`; `pickupRacket()` reproduce
`pickup` y devuelve su duración. Al terminar el punto (`clearRacket`, `resetPose`) vuelve a tener raqueta sin
animación. Los packs sin estos clips (ninguno hoy) siguen con `inferno-hit` / `stunned` y sus clips con
raqueta. En red, el rival muestra lo mismo cuando llega la acción `racket` (perdida o recogida).

La mirada (`pj-<id>-mirada.webp`) es una franja ancha con los ojos del personaje que cruza la pantalla al empezar
el INFERNO. `GAZE_ARTS` en `src/fx/infernoGaze.ts` guarda la altura de la franja (`eyeFy`) y la posición de las
pupilas (`eyes`), de donde salen los rayos: si cambia la imagen, hay que volver a medirlas.

## 6. Diferencias por personaje y vista

Las secciones 4 y 5 son el contrato. Estas son las excepciones que la herramienta ya conoce
(`tools/build-moves.mjs`):

**MAI de espaldas** (`ROWS_MAI`, `derived`, `scaleAs` en `characters.mjs`):

- Hojas 1 y 2: igual que NXO.
- Hoja 3: 1 `dive-right` · 2 `dive-left` (ya se levanta en los frames 7-8) · 3 `recover-right` · 4 `stunned` ·
  5 `point-won` · 6 `point-lost` (se agacha hasta el suelo y se levanta) · 7 salto, sin uso · 8 `wait`.
  `recover-left` se arma con los frames 7-8 de `dive-left` y `stunned` usa la escala de `point-won`, porque empieza
  agachada.
- Hoja 4, de 9 frames por fila: filas 1 y 2 sin uso (no son el bote ni el lanzamiento) · 3 `walk` ·
  4 `inferno-hit` · 5 `volley` · 6 `dropshot` · 7 `intro` · 8 `greet`. Sin bote ni lanzamiento propios, su pack va
  con `bounce: false` y el saque (filas 5 y 6 de la hoja 2) arranca en su frame 1 y se pausa en el trofeo.
- Las hojas verdes de la flor de la gorra se recuperan después del croma (`keep-enclosed-green.mjs`, solo Mai).

**NXO de espaldas** (`nxo`):

- Hoja 2 nueva del 12-11-2026 (1254×1254, fondo verde; la anterior en `Nxo/_temp/respaldo_oficial/pj-nxo-sprites-2-antes-new.png`).
  Instalada a pedido aunque no cumple la mano: en las filas 2-8 el frame 1 lleva la raqueta a la **izquierda** de la
  imagen (mano izquierda) y en varias filas cambia de lado entre frames. El golpe arranca en su frame de espera, así que
  el frame 1 no se ve, pero puede notarse el cambio de mano desde el reposo. `serveRacket` medido de nuevo.
- Tiras en WebP desde esta hoja (celda 222×142).

**NXO rival, de frente** (`front`):

Hojas 1, 2 y 3 nuevas del 12-11-2026 (las anteriores están en `Nxo/rival/_temp/respaldo_oficial/` con el sufijo
`-antes-new`; la 2, `-antes-new-12-11-2026`). La hoja 4 y el INFERNO no cambiaron. Tiras en WebP (sección 0.4).

- Hoja 1 (1536×1024, fondo verde): ya no se espeja entera (`FLIP_SHEETS` vacío). Se espejan solo las filas 1
  `idle`, 4 `victory` y 8 `defeat` (`flipRows` en `characters.mjs`), que llegan con la raqueta a la derecha de la imagen. Las carreras
  (filas 2, 3, 5, 6 y 7) corren hacia la derecha de la imagen, como pide el contrato, pero con la raqueta en la mano
  izquierda; espejarlas las haría correr al revés. Por eso, al correr, el rival lleva la raqueta en la otra mano y
  puede verse el cambio de mano al pasar de la frenada al reposo. Para arreglarlo hay que pedir esas filas otra vez
  con la raqueta a la izquierda de la imagen.
- La derrota (fila 8) ya termina de rodillas con la raqueta en el suelo, y la victoria (fila 4) acaba en una pose
  fija: las dos salen bien en el partido y en la tarjeta del resultado.
- Hoja 2 (1254×1254, celda 156,75, fondo verde): raqueta a la izquierda de la imagen, sin espejo. Frames clave
  iguales a los de espaldas (sección 5). `serveRacket` medido de nuevo.
- Hoja 3 (1536×1024, fondo verde): filas en el orden del contrato, sin espejo. En `dive-right` el alcance máximo
  está solo en el frame 4 (en el 5 la raqueta ya queda detrás); en `dive-left`, en los frames 4-5. Coincide con
  `LUNGE_CONTACT_S`. Dos frames tocan al de la fila de abajo y llevan corte a mano (`cutAt` en `characters.mjs`): fila 2 frame 7
  (y = 284) y fila 5 frames 4 y 5 (y = 668). En los frames 4 y 5 del aturdido queda una mancha de 1-2 px del pelo
  del salto de abajo entre los pies.
- Hoja 4, fila 1 (`serve-bounce`): llega espejada y se espeja solo esa fila (`flipRows` en `characters.mjs`). El pack usa
  `BOUNCE_FRONT` (bota con la raqueta, a la izquierda de la imagen).
- ULTI completa (`pj-nxo-rival-ulti.png`, 12-11-2026): fila 6 (`pickup`) no cumple la mano: en los frames 3-8 la
  raqueta queda a la **derecha** de la imagen (mano izquierda) y en el 9 vuelve a la izquierda, así que al terminar
  de recogerla se ve un cambio de mano. El resto de filas cumple. Para arreglarlo hay que pedir esa fila otra vez.
- INFERNO antiguo (respaldo): ya trae la raqueta en la mano derecha, se cortaba sin espejo (solo marca
  `view: front` en el JSON). Con `flip` se espejaría cada frame y cambiarían los frames clave: mejor pedir la hoja
  bien.

**MAI rival**: usa todavía la hoja antigua (`mai-front-sprites/`, `tools/build-nxo-sprites.mjs`). Sus hojas nuevas
están en `Mai/rival/` sin procesar, salvo la hoja 1 (ver la excepción de abajo). `build-moves.mjs mai-front` aún no
existe: para procesar el pack hacen falta las 4 hojas y el INFERNO de Mai rival.

- **Hojas nuevas del 12-11-2026** (hoja 1, hoja 2 e INFERNO; las anteriores en `Mai/rival/_temp/respaldo_oficial/` con el sufijo
  `-antes-new`). Hojas 3 y 4 siguen siendo las del 10-11-2026, de dibujo viejo.
  - Hoja 1 (1536×1024, verde): derrota (fila 8) termina de rodillas con la raqueta en el suelo; victoria (fila 4)
    estable. **Incumple el contrato en la fila 2 (`run`)**: corre hacia la izquierda de la imagen, igual que la fila 6
    (`run-left`), y el contrato pide `run` hacia la derecha. Las filas 3 y 7 sí corren a la derecha. Cuando se procese
    el pack hay que pedir la fila 2 otra vez o espejarla (con la raqueta quedaría en la otra mano, como en el rival NXO).
  - Hoja 2 (1254×1254, verde): cumple. Raqueta a la izquierda de la imagen, filas en orden, destello de impacto
    en los mismos frames que NXO.
  - INFERNO (2172×724, verde): 9 frames en una fila, raqueta a la izquierda de la imagen, sin pelota. Cumple.
  - Hoja 2 e INFERNO solo quedan guardados: el juego aún no los lee.
- Excepción (11-11-2026): la **tarjeta del resultado** (`MatchEndScene`) usa ya la hoja nueva 1 de Mai rival para sus
  3 poses: filas 1 `idle`, 4 `victory` y 8 `defeat`. `node tools/build-end-poses.mjs` las corta (croma verde + gorra con
  `keep-enclosed-green`) en `public/assets/characters/mai-front-end/{idle,victory,defeat}.webp` (8 frames de 192 × 128;
  WebP desde el 12-11-2026, el script convierte con `convert-image.mjs` y borra el PNG).
  La escena mide la silueta de cada tira para el alto y los pies (sin JSON). Cuando se procese el pack `mai-front`
  completo, se puede quitar esta excepción (`MAI_END` / `endPosesFor` en `MatchEndScene.ts`).

### Efectos de carga ("cargando golpe")

No son hojas de personaje: son el aro que aparece en el suelo bajo el jugador (y bajo el rival, en red) mientras se mantiene
la carga de un golpe; la barra de potencia sobre la cabeza no cambia. Hay tres con sprites (se compran en la Tienda; Nxo trae
el de fuego y Mai el de tulipán) y el clásico, que se dibuja por código (`MatchScene` + `fx/shotFx.ts`) y es de todos.

| Id | Fuente (`frontend/art/cargando/`) | Hoja que carga el juego | Celda | Fondo de la fuente |
|---|---|---|---|---|
| `fire` | `cargando-fuego.webp` → `cargando-fuego.png` | `public/assets/charge-fire.webp` | 256×236 | transparente |
| `energy` | `cargando-energia.png` | `public/assets/charge-energy.png` | 256×230 | transparente |
| `tulip` | `cargando-tulipan.webp` → `cargando-tulipan.png` | `public/assets/charge-tulip.webp` | 256×256 | transparente |

Contrato de la fuente: 10 frames en 5 columnas × 2 filas, en orden de lectura. El efecto **nace** (frame 1), **crece** hasta su
máximo (frames 6-7) y **se disipa** (frame 10). El aro tiene que estar en el mismo sitio en todos los frames. Dejar aire entre
frames y fondo transparente.

- **Fuego y tulipán (11-11-2026):** fuentes nuevas en `.webp` (las anteriores están en `art/cargando/Old/`). La herramienta
  lee PNG y el juego carga webp. Para `<nombre>` = fuego / tulipan e `<id>` = fire / tulip:
  `node tools/convert-image.mjs art/cargando/cargando-<nombre>.webp art/cargando/cargando-<nombre>.png` →
  `node tools/build-charge-fx.mjs <nombre>` →
  `node tools/convert-image.mjs public/assets/charge-<id>.png public/assets/charge-<id>.webp` (y se borra el `.png` de
  `public/assets`). `convert-image.mjs` usa Chrome headless (Node no lee ni escribe webp). Energía sigue en `.png`.

- Se generan con `node tools/build-charge-fx.mjs [fuego|energia|tulipan]` (sin argumentos, las tres). A diferencia de las bolas
  del INFERNO, no se centra cada frame: todos comparten recorte y ancla (el centro del aro = los pies). La herramienta imprime
  el ancho de la celda, la altura del ancla (`anchorFy`) y la proporción del aro (`ringFill`); esos números van en `CHARGE_ART`
  (`src/fx/chargeFx.ts`). Si se cambia una fuente, regenerar y actualizar `CHARGE_ART`.
- Uso en el partido: la carga 0-100 % recorre los frames 1-6; al 100 % late entre los frames 6, 7, 6 y 5; al soltar se
  disipa con los frames 8-10 (`ChargeSpriteFx`). Fuego y energía se pintan con luz aditiva; el tulipán, normal.
- Para añadir un efecto nuevo: su id en `domain/chargeFx.ts` (`CHARGE_FX`), su fuente en `art/cargando/`, una entrada en
  `SHEETS` de la herramienta y en `CHARGE_ART`, y su ítem `charge:<id>` en `domain/shopCatalog.ts`.

### Bolas de la ULTI con rastro (tulipán)

Tampoco son hojas de personaje: son la bola que vuela con la ULTI (poder `tulip`, ítem `inferno:tulip`). A diferencia de las
demás bolas (fuego, hielo, viento, rayo: una hoja cuadrada de 192 px por frame, centrada en su cuerpo), la del tulipán trae
**dos hojas**: la bola (cabeza de la estela de pétalos) y su **rastro**, que el juego pinta detrás de la bola en el mismo
frame, sitio y giro.

| Fuente (`frontend/art/inferno/`) | Hoja que carga el juego | Celda |
|---|---|---|
| `inferno-ball-tulipan.png` | `public/assets/inferno-ball-tulip.png` | 384×174 |
| `inferno-ball-tulipan-rastro.png` | `public/assets/inferno-ball-tulip-trail.png` | 384×174 |

Contrato de las fuentes: las dos del mismo tamaño, 10 frames en 5 columnas × 2 filas (rejilla uniforme, en orden de
lectura), fondo transparente, la estela en horizontal con la **cabeza a la derecha** y la cola a la izquierda. El rastro va
dibujado en el mismo sitio que la bola en cada celda. El efecto nace (frame 1), crece (frames 5-7) y se disipa (frame 10).

- Se generan con `node tools/build-trail-ball.mjs [tulipan]`. No se centra cada frame: los frames de las dos hojas comparten
  recorte y ancla (la cabeza = donde va la pelota). La herramienta limpia la bruma blanca y los grises oscuros sin color, e
  imprime la celda y el ancla (`originX`, `originY`), que van en `TULIPBALL_ART` (`src/fx/InfernoFx.ts`).
- En el juego (`BALL_ART.tulip`): la animación recorre en vaivén los frames 4-7 (`seq`), el dibujo se gira 90° (`rot`) para
  que la cola quede contra el avance, y no lleva la estela de siluetas por código (`ghosts: false`).
- Para otra bola con rastro: sus dos fuentes en `art/inferno/`, una entrada en `SHEETS` de la herramienta y en `BALL_ART`.

## 7. Cambiar una hoja o añadir hojas nuevas

Cambiar una hoja con el mismo orden de filas:

1. Compararla con este contrato: rejilla, fondo, mano, frame 1 de pie y las filas en su orden. Si una fila no
   cuadra, no instalarla: pedirla otra vez o adaptar el registro de filas de ese personaje en la herramienta (y
   aquí).
2. Mover la anterior a `_temp/respaldo_oficial/<Personaje>/` y dejar la nueva con el nombre exacto.
3. Regenerar su pack (sección 3), leer el log, mirar las tiras y pasar `npx tsc --noEmit` y `npm run build`.
4. Comprobar que los demás packs no cambian (`git status` de sus carpetas de tiras y sus JSON).

Cambiar una sola fila: `node tools/paste-row.mjs <hoja.png> <fila 1-8> <nueva.png> <cols> <rows> [frames] [feet] [height]`
pega una animación suelta (frames en cuadrícula) en esa fila, a la escala y la línea de pies de su frame 1 actual.
Deja el fondo en verde puro, así que sirve para hojas de fondo verde. Antes, copia la hoja a `_temp/respaldo_oficial/<Personaje>/`
(`-antes-filaN`).

Añadir una hoja (5, 6…):

1. Definir antes sus filas en la sección 5, con las mismas reglas (8 filas × 8 frames).
2. En `tools/characters.mjs`: añadir la hoja a `rows` y a `cols` del personaje (`ROWS_NXO` / `ROWS_MAI`). En
   `tools/build-moves.mjs`: ampliar los bucles `[1, 2, 3, 4]` (corte y escala) y poner en `REF` la fila de referencia
   de la hoja, una con el frame 1 de pie.
3. Añadir los clips nuevos al JSON `extra` (bloque `write(PFX + 'extra', …)`) con fps, bucle y fotogramas clave.
   `NxoActor` carga solos todos los clips de `extra`, pero el juego solo reproduce los que algún código llama
   (`emote(nombre)` o un estado nuevo).

Personaje nuevo: las mismas 4 hojas, la ULTI y la mirada, con este contrato. Pasos:

1. Dejar las hojas en `public/personajes/<Personaje>/` (y `rival/` para la vista de frente) con el patrón `pj-<id>-1..4.png`, `pj-<id>-ulti.png`.
2. Añadir una entrada en `tools/characters.mjs` (copiar la de `nxo` o `mai` y ajustar; los campos están explicados arriba del archivo).
3. `node tools/build-moves.mjs <id>` y `node tools/build-ulti.mjs <id>`, revisar el log y las tiras.
4. En el juego: una entrada en `PACKS` (`NxoActor.ts`), su JSON en `sheets.ts` y el personaje en `catalog.ts`.



## 8. Pendiente de arte (hojas por redibujar)

Anotado el 12-11-2026. Ninguna de estas hojas se instala hasta que cumpla el contrato (�4 y �5); mientras tanto el juego sigue con lo que ya tiene.

| Hoja | Qu� falta | Qu� desbloquea |
|---|---|---|
| **Mai de espaldas, hoja 3** (`Mai/pj-mai-3.png`) | Una animaci�n por fila, en el orden de NXO: 1 estirada der � 2 estirada izq � 3 recuperaci�n der � 4 recuperaci�n izq � 5 aturdido � 6 punto ganado � 7 punto perdido � 8 espera. Hoy el aturdido est� en la fila 4, no hay recuperaci�n izquierda y la fila 7 es un salto sin uso. | Borrar `MAI_LEGACY_MOVES` de `tools/characters.mjs` (parte de la hoja 3: `derived`, `scaleAs`). |
| **Mai de espaldas, hoja 4** (`Mai/pj-mai-4.png`) | 8 columnas (hoy 9) y las filas 1 y 2 como bote y lanzamiento del saque. | Quitar `bounce: null` de Mai en `NxoActor.ts` y el resto de `MAI_LEGACY_MOVES`. |
| **Mai rival, hoja 3** (`Mai/rival/pj-mai-rival-3.png`) | Igual que la de espaldas: hoy las filas 1 a 3 son una sola secuencia (se lanza, se arrastra, aturdida, se levanta) en vez de una animaci�n por fila. | Procesar el pack `mai-front` con `build-moves.mjs mai-front` y conectarlo (`NxoActor.ts`, `sheets.ts`). |

Por confirmar (puede no requerir redibujar):
- **Mai rival, hoja 2:** en derecha y rev�s la raqueta cruza al lado derecho de la imagen en el impacto (frames 6 y 7). Comprobar que es el lado correcto para el rival.
- **Mai rival, hoja 4:** las filas 1 y 2 no se distinguen bien como bote y lanzamiento del saque.

Las hojas 1 de Mai rival y de espaldas, la 2 de espaldas y la ULTI de los cuatro packs ya cumplen.
