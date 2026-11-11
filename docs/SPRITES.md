# Sprites de los personajes: hojas fuente, filas y cómo se cortan

Contrato de las hojas de sprites. Léelo antes de tocar una imagen de `frontend/public/personajes/`, las
herramientas `frontend/tools/build-nxo-*.mjs` o las tiras de `frontend/public/assets/characters/`.
Si cambias una hoja, una fila o una herramienta, actualiza este documento en el mismo cambio.

Última actualización: 10-11-2026.

## 1. Dónde están las imágenes

Las imágenes con las que trabajamos los sprites están **siempre** en `frontend/public/personajes/<Personaje>/`:
una carpeta por personaje, y la vista de frente (rival) en su subcarpeta `rival/`.

```
frontend/public/personajes/
├── Nxo/
│   ├── pj-nxo-sprites-1.png … -4.png   hojas de movimientos, de espaldas (jugador)
│   ├── pj-nxo-sprite-inferno.png       INFERNO DRIVE, de espaldas
│   ├── pj-nxo-mirada.webp              franja de los ojos del INFERNO        (la carga el juego)
│   ├── pj-nxo.webp                     retrato: menú, PERSONAJE y VS         (la carga el juego)
│   ├── emojis/                         nxo-risa, nxo-pensando, nxo-enojado   (los carga el juego)
│   ├── Old sprites/                    versiones anteriores
│   └── rival/
│       ├── pj-nxo-rival-1.png … -4.png hojas de movimientos, de frente (rival)
│       ├── pj-nxo-rival-inferno.png    INFERNO DRIVE, de frente
│       └── Old sprites/
└── Mai/
    ├── pj-mai-1.png … -4.png           hojas de movimientos, de espaldas
    ├── pj-mai-inferno.png              INFERNO DRIVE, de espaldas
    ├── pj-mai-mirada.webp              franja de los ojos del INFERNO        (la carga el juego)
    ├── pj-mai.png                      referencia del diseño
    └── rival/                          pj-mai-rival-1..4.png, pj-mai-rival-inferno.png (sin procesar todavía)
```

Reglas:

- Son imágenes **fuente**: el juego no las carga. Las herramientas las cortan en tiras
  (`public/assets/characters/<carpeta>/`) y escriben los JSON (`src/characters/`). Tiras y JSON son
  archivos generados: no se editan a mano, se regeneran.
- `npm run build` quita de `dist/` (y del APK) todo `personajes/` salvo lo que lista `KEEP_IN_PERSONAJES` en
  `frontend/vite.config.ts` (hoy: `Nxo/pj-nxo.webp`, `Nxo/pj-nxo-mirada.webp`, `Nxo/emojis`,
  `Mai/pj-mai-mirada.webp`). Si el juego tiene que leer otro archivo de aquí, hay que añadirlo a esa lista.
- Para cambiar una hoja: mover la anterior a `Old sprites/` con un sufijo (`pj-nxo-rival-2-antes-new.png`),
  dejar la nueva con el nombre exacto que lee la herramienta (sin `-new`) y regenerar (sección 3).
- Los nombres de Nxo de espaldas son históricos (`pj-nxo-sprites-N`, `pj-nxo-sprite-inferno`). Un personaje
  nuevo sigue el patrón de Mai: `pj-<id>-1..4.png`, `pj-<id>-inferno.png`, `pj-<id>-mirada.webp` y, en
  `rival/`, `pj-<id>-rival-1..4.png` y `pj-<id>-rival-inferno.png`.

## 2. Qué hojas tiene cada personaje

Por personaje y por vista (espaldas = jugador, frente = rival):

- **4 hojas de movimientos** (hojas 1 a 4) de 8 filas cada una. Más adelante habrá más hojas (5, 6…): ver la
  sección 7.
- **1 hoja del INFERNO DRIVE**: 1 fila de 9 frames.
- Imágenes sueltas: mirada (`-mirada.webp`), retrato y emojis.

| Pack | Vista | Hojas 1-4 | INFERNO | Tiras que carga el juego | JSON (`src/characters/`) |
|---|---|---|---|---|---|
| `nxo` | espaldas | `Nxo/pj-nxo-sprites-1..4.png` | `Nxo/pj-nxo-sprite-inferno.png` | `nxo-v2/`, `nxo-inferno/` | `nxo-{sprites,hits,move,special,extra,inferno}.json` |
| `nxo-front` | frente | `Nxo/rival/pj-nxo-rival-1..4.png` | `Nxo/rival/pj-nxo-rival-inferno.png` | `nxo-front-v2/`, `nxo-front-inferno/` | `nxo-front-*.json` |
| `mai` | espaldas | `Mai/pj-mai-1..4.png` | `Mai/pj-mai-inferno.png` | `mai-v2/`, `mai-inferno/` | `mai-*.json` |
| `mai-front` | frente | `Mai/rival/pj-mai-rival-1..4.png` (sin procesar) | `Mai/rival/pj-mai-rival-inferno.png` (sin procesar) | hoy la hoja antigua `mai-front-sprites/` | `mai-front-sprites.json` |

Qué pack usa cada personaje: `src/characters/catalog.ts`. Carga de los packs: `PACKS` en
`src/objects/NxoActor.ts`.

## 3. Cómo se generan

Desde `frontend/`:

```powershell
node tools/build-nxo-v2.mjs          # NXO de espaldas: hojas 1-4 -> nxo-v2/ + nxo-*.json
node tools/build-nxo-v2.mjs front    # NXO rival:       hojas 1-4 -> nxo-front-v2/ + nxo-front-*.json
node tools/build-nxo-v2.mjs mai      # MAI de espaldas: hojas 1-4 -> mai-v2/ + mai-*.json

node tools/build-nxo-inferno.mjs     # INFERNO de NXO de espaldas -> nxo-inferno/ + nxo-inferno.json
node tools/build-nxo-inferno.mjs public/personajes/Nxo/rival/pj-nxo-rival-inferno.png public/assets/characters/nxo-front-inferno nxo-front-inferno.json front
node tools/build-nxo-inferno.mjs public/personajes/Mai/pj-mai-inferno.png public/assets/characters/mai-inferno mai-inferno.json

npx tsc --noEmit
npm run build
```

Cada herramienta imprime el tamaño y la celda de cada hoja, el alto de pie medido, la escala por fila y avisos
como `pieza ancha` (una pieza más ancha que su celda): revisa el log y mira las tiras antes de dar una hoja por buena.

`build-nxo-v2.mjs`, por hoja:

1. Quita el fondo: verde de croma (con limpieza del reflejo verde en el borde), blanco o negro casi puro. El
   blanco y el negro se quitan rellenando desde el borde de la imagen, así que lo encerrado en el dibujo
   (camiseta, cordaje, sombras del pelo) se conserva.
2. Divide la hoja en 8 filas y N columnas iguales (N = 8; la hoja 4 de Mai, 9). La celda sale del tamaño real de
   la imagen: una hoja puede medir 1536×1024, 1254×1254 o 1330×1182.
3. Separa las piezas conexas y asigna cada una a su celda por la posición de los pies. Entre filas corta por la
   línea más vacía de cada columna. Las piezas sueltas (raqueta, estrellas, polvo) van con el cuerpo más cercano
   de su columna, y un trozo que ese corte separó de un cuerpo vuelve a su cuerpo.
4. Apoya cada fila en su suelo (mediana de la base de sus frames) y la escala para que su **frame 1, de pie**,
   mida lo mismo que la guardia de referencia. Todas las hojas se igualan a la más pequeña (solo reduce, nunca
   amplía).
5. Escribe una tira por animación, con la misma celda para todas y el ancla en el centro del cuerpo, a la altura
   del suelo, y los JSON con fps y fotogramas clave. El juego escala cada pack por su `standHeight`: una hoja
   dibujada más grande da más resolución, no un personaje más grande.

`build-nxo-inferno.mjs` hace lo mismo con la hoja del INFERNO: fondo verde o transparente, separa los 9 frames
por columnas vacías (o por piezas si dos se solapan sin tocarse), escala con el frame 1 de pie a 140 px y
empaqueta los 9 en una textura de 3 columnas.

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
no se ven en el golpe. El rival (`nxo-front`) tiene otros frames de espera.

| Fila | Clip | fps | Qué se dibuja | Frames clave (espaldas / rival) | Uso en el juego |
|---|---|---|---|---|---|
| 1 | `forehand` | 15 | derecha: golpe por el lado de la raqueta | espera 2 / 5 · impacto 7 / 8 | golpe normal, pelota por la derecha |
| 2 | `backhand` | 15 | revés | espera 2 / 3 · impacto 6 | golpe normal, pelota por la izquierda |
| 3 | `forehand-power` | 15 | derecha cargada | carga 4 / 3 · impacto 6 | golpe cargado de derecha; el frame de carga es la pose mientras se carga |
| 4 | `backhand-power` | 15 | revés cargado | carga 4 / 3 · impacto 6 | golpe cargado de revés |
| 5 | `serve` | 12 | saque normal | trofeo (espera la pelota) 3 · impacto 5 | saque normal: arranca en el trofeo, tras `serve-toss` |
| 6 | `serve-spin` | 12 | saque con efecto | trofeo 3 · impacto 5 | saque con efecto; el juego le suma un salto por código en los frames 3-6 (`JUMP_ARC`) |
| 7 | `smash` | 14 | remate | arranca en 3 · impacto 5 | pelota alta |
| 8 | `smash-power` | 14 | remate del SMASH potenciado, con salto | arranca en 3 · impacto 5 | ataque especial SMASH |

**Dónde queda la raqueta en el impacto del saque (`serveRacket`).** En el frame de impacto de `serve` y de
`serve-spin` (frame 5, índice 4) el juego pone la pelota en el centro del cordaje: la altura a la que salta el
sacador (`MatchScene.serveJump`) y el lado en el que sube la pelota salen de ahí. Está medido sobre cada tira y se
guarda en `src/characters/<pack>-hits.json` como `serveRacket: { normal: { dx, z }, spin: { dx, z } }`, en
unidades del personaje (alto 150): `z` = altura del centro del cordaje sobre los pies y `dx` = desplazamiento lateral
(+ = derecha de la pantalla). Lo escribe `tools/build-nxo-v2.mjs` (constante `K.serveRacket`). **Si se cambia la
hoja 2 (filas 5 o 6) o la hoja del saque de un personaje hay que volver a medirlo**: abrir el frame 5 de la tira,
anotar el centro del óvalo de la raqueta en píxeles (sobre los pies y respecto al centro de la celda) y multiplicar por
`150 / standHeight`. Valores actuales: NXO espaldas 129 / 145 (z normal / efecto), NXO rival 143 / 144, MAI 128 / 146.

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
`recover-*` (en el suelo). En las hojas actuales el frame 8 de la estirada vuelve a estar de pie y se nota un
salto al empezar la recuperación; en las hojas nuevas conviene terminar la estirada en el suelo.

### Hoja 4: saque y extras

| Fila | Clip | fps | Qué se dibuja | Uso en el juego |
|---|---|---|---|---|
| 1 | `serve-bounce` | 12, bucle | bota la pelota antes de sacar (sin pelota dibujada) | sacador quieto antes de lanzar. Solo en los packs con `bounce: true` (hoy NXO de espaldas): la pelota sigue la mano con las alturas de `BOUNCE` en `NxoActor.ts`, que hay que volver a medir si cambia esta fila |
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

La mirada (`pj-<id>-mirada.webp`) es una franja ancha con los ojos del personaje que cruza la pantalla al empezar
el INFERNO. `GAZE_ARTS` en `src/fx/infernoGaze.ts` guarda la altura de la franja (`eyeFy`) y la posición de las
pupilas (`eyes`), de donde salen los rayos: si cambia la imagen, hay que volver a medirlas.

## 6. Diferencias por personaje y vista

Las secciones 4 y 5 son el contrato. Estas son las excepciones que la herramienta ya conoce
(`tools/build-nxo-v2.mjs`):

**MAI de espaldas** (`ROWS_MAI`, `DERIVED`, `SCALE_AS`):

- Hojas 1 y 2: igual que NXO.
- Hoja 3: 1 `dive-right` · 2 `dive-left` (ya se levanta en los frames 7-8) · 3 `recover-right` · 4 `stunned` ·
  5 `point-won` · 6 `point-lost` (se agacha hasta el suelo y se levanta) · 7 salto, sin uso · 8 `wait`.
  `recover-left` se arma con los frames 7-8 de `dive-left` y `stunned` usa la escala de `point-won`, porque empieza
  agachada.
- Hoja 4, de 9 frames por fila: filas 1 y 2 sin uso (no son el bote ni el lanzamiento) · 3 `walk` ·
  4 `inferno-hit` · 5 `volley` · 6 `dropshot` · 7 `intro` · 8 `greet`. Sin bote ni lanzamiento propios, su pack va
  con `bounce: false` y el saque (filas 5 y 6 de la hoja 2) arranca en su frame 1 y se pausa en el trofeo.
- Las hojas verdes de la flor de la gorra se recuperan después del croma (`keep-enclosed-green.mjs`, solo Mai).

**NXO rival, de frente** (`front`):

- Hoja 1: llega con la raqueta en la mano izquierda y se espeja entera, celda a celda (`FLIP_SHEETS`).
- Hoja 2 (10-11-2026): fondo negro, que se quita con `blackToAlpha`.
- Hoja 4, fila 1 (`serve-bounce`): llega espejada y se espeja solo esa fila (`FLIP_ROWS`). El pack va con
  `bounce: false`, así que hoy no se usa.
- Frames de espera de la hoja 2: los de la columna "rival" de la tabla.
- INFERNO: ya trae la raqueta en la mano derecha, se corta sin espejo con el argumento `front` (solo marca
  `view: front` en el JSON). Con `flip` se espejaría cada frame y cambiarían los frames clave: mejor pedir la hoja
  bien.
- Hoja 3: sigue la del 08-11-2026 (pelo castaño). La nueva del 10-11-2026 no sigue el orden de filas de la hoja 3
  ni la mano (raqueta en la izquierda) y no está instalada.

**MAI rival**: usa todavía la hoja antigua (`mai-front-sprites/`, `tools/build-nxo-sprites.mjs`). Sus hojas nuevas
están en `Mai/rival/` sin procesar.

### Efectos de carga ("cargando golpe")

No son hojas de personaje: son el aro que aparece en el suelo bajo el jugador (y bajo el rival, en red) mientras se mantiene
la carga de un golpe; la barra de potencia sobre la cabeza no cambia. Hay tres con sprites (se compran en la Tienda; Nxo trae
el de fuego y Mai el de tulipán) y el clásico, que se dibuja por código (`MatchScene` + `fx/shotFx.ts`) y es de todos.

| Id | Fuente (`frontend/art/cargando/`) | Hoja que carga el juego | Celda | Fondo de la fuente |
|---|---|---|---|---|
| `fire` | `cargando-fuego.png` | `public/assets/charge-fire.png` | 256×262 | transparente |
| `energy` | `cargando-energia.png` | `public/assets/charge-energy.png` | 256×230 | transparente |
| `tulip` | `cargando-tulipan.png` | `public/assets/charge-tulip.png` | 256×287 | rejilla gris + bruma blanca (se limpia) |

Contrato de la fuente: 10 frames en 5 columnas × 2 filas, en orden de lectura. El efecto **nace** (frame 1), **crece** hasta su
máximo (frames 6-7) y **se disipa** (frame 10). El aro tiene que estar en el mismo sitio en todos los frames. Dejar aire entre
frames; el tulipán, además, no puede traer la bruma blanca pegada al fondo (la herramienta la recorta por alfa y saturación).

- Se generan con `node tools/build-charge-fx.mjs [fuego|energia|tulipan]` (sin argumentos, las tres). A diferencia de las bolas
  del INFERNO, no se centra cada frame: todos comparten recorte y ancla (el centro del aro = los pies). La herramienta imprime
  el ancho de la celda, la altura del ancla (`anchorFy`) y la proporción del aro (`ringFill`); esos números van en `CHARGE_ART`
  (`src/fx/chargeFx.ts`). Si se cambia una fuente, regenerar y actualizar `CHARGE_ART`.
- Uso en el partido: la carga 0-100 % recorre los frames 1-6; al 100 % late entre los frames 6, 7, 6 y 5; al soltar se
  disipa con los frames 8-10 (`ChargeSpriteFx`). Fuego y energía se pintan con luz aditiva; el tulipán, normal.
- Para añadir un efecto nuevo: su id en `domain/chargeFx.ts` (`CHARGE_FX`), su fuente en `art/cargando/`, una entrada en
  `SHEETS` de la herramienta y en `CHARGE_ART`, y su ítem `charge:<id>` en `domain/shopCatalog.ts`.

## 7. Cambiar una hoja o añadir hojas nuevas

Cambiar una hoja con el mismo orden de filas:

1. Compararla con este contrato: rejilla, fondo, mano, frame 1 de pie y las filas en su orden. Si una fila no
   cuadra, no instalarla: pedirla otra vez o adaptar el registro de filas de ese personaje en la herramienta (y
   aquí).
2. Mover la anterior a `Old sprites/` y dejar la nueva con el nombre exacto.
3. Regenerar su pack (sección 3), leer el log, mirar las tiras y pasar `npx tsc --noEmit` y `npm run build`.
4. Comprobar que los demás packs no cambian (`git status` de sus carpetas de tiras y sus JSON).

Cambiar una sola fila: `node tools/paste-row.mjs <hoja.png> <fila 1-8> <nueva.png> <cols> <rows> [frames] [feet] [height]`
pega una animación suelta (frames en cuadrícula) en esa fila, a la escala y la línea de pies de su frame 1 actual.
Deja el fondo en verde puro, así que sirve para hojas de fondo verde. Antes, copia la hoja a `Old sprites/`
(`-antes-filaN`).

Añadir una hoja (5, 6…):

1. Definir antes sus filas en la sección 5, con las mismas reglas (8 filas × 8 frames).
2. En `tools/build-nxo-v2.mjs`: añadir la hoja a `ROWS_NXO` (y a `ROWS_MAI` si aplica) y a `COLS`, ampliar los
   bucles `[1, 2, 3, 4]` (corte y escala) y poner en `REF` la fila de referencia de la hoja, una con el frame 1 de
   pie.
3. Añadir los clips nuevos al JSON `extra` (bloque `write(PFX + 'extra', …)`) con fps, bucle y fotogramas clave.
   `NxoActor` carga solos todos los clips de `extra`, pero el juego solo reproduce los que algún código llama
   (`emote(nombre)` o un estado nuevo).

Personaje nuevo: las mismas 4 hojas, INFERNO y mirada, con este contrato. En la herramienta necesita su registro
de filas y sus nombres (`SRC_DIR`, `SRC_NAME`, `DIR`, `PFX`); en el juego, una entrada en `PACKS` (`NxoActor.ts`)
y en `catalog.ts`.
