// Registro de personajes para las herramientas de sprites (build-moves.mjs y build-ulti.mjs).
// Para AÑADIR un personaje o una vista: una entrada nueva aquí, sin tocar las herramientas. La guía está en
// docs/COMO-TRABAJAR-SPRITES-MOVIMIENTOS.md (§3 y §7).
//
// Cada clave es el id del pack, el mismo que usa el juego (src/characters/sheets.ts y objects/NxoActor.ts):
//   <id>       -> tiras en public/assets/characters/<id>-v2/ y <id>-inferno/ ; JSON en src/characters/<id>-*.json
//   dir        -> carpeta de las hojas fuente, dentro de public/personajes/
//   prefix     -> nombre de las hojas: <prefix>-1..4.png (movimientos) y <prefix>-ulti.png (ULTI)
//   view       -> 'back' (jugador, de espaldas) o 'front' (rival, de frente)
//   moves      -> las 4 hojas de movimientos (omitir mientras el personaje no las tenga)
//   ulti       -> la hoja de la ULTI de 6 filas x 9 (omitir mientras no la tenga)

/**
 * Orden de las filas de cada hoja (1-based como en el dibujo): hoja -> fila -> nombre del clip.
 * Qué es cada fila: docs/COMO-TRABAJAR-SPRITES-MOVIMIENTOS.md §5. Una fila que no se nombra no se corta.
 */
export const ROWS_NXO = {
  1: { 1: 'idle', 2: 'run', 3: 'runstop', 4: 'victory', 5: 'brake-turn', 6: 'run-left', 7: 'dash', 8: 'defeat' },
  2: { 1: 'forehand', 2: 'backhand', 3: 'forehand-power', 4: 'backhand-power', 5: 'serve', 6: 'serve-spin', 7: 'smash', 8: 'smash-power' },
  3: { 1: 'dive-right', 2: 'dive-left', 3: 'recover-right', 4: 'recover-left', 5: 'stunned', 6: 'point-won', 7: 'point-lost', 8: 'wait' },
  4: { 1: 'serve-bounce', 2: 'serve-toss', 3: 'walk', 4: 'inferno-hit', 5: 'volley', 6: 'dropshot', 7: 'intro', 8: 'greet' },
};

/**
 * CONTRATO ÚNICO: todos los personajes y vistas traen las MISMAS 4 hojas (8 filas × 8 frames, filas en el orden de ROWS)
 * y los mismos movimientos; lo único que cambia es el diseño. Un personaje nuevo usa MOVES_STANDARD tal cual.
 */
export const MOVES_STANDARD = {
  cols: { 1: 8, 2: 8, 3: 8, 4: 8 },
  rows: ROWS_NXO,
  refFourth: 'serve-bounce', // clip de la hoja 4 cuyo frame 1 (de pie) iguala la escala de esa hoja con las demás
  keepMain: ['wait'], // la espera activa trae "( )" sueltos: solo se queda la pieza grande
};

/**
 * TEMPORAL: las hojas actuales de MAI NO siguen el contrato (se dibujaron antes de fijarlo). Cuando lleguen sus hojas 3 y 4
 * nuevas, con el mismo orden de filas y 8 columnas que NXO, BORRAR este bloque y usar MOVES_STANDARD sin cambios.
 * Diferencias de hoy (lo que falta o sobra respecto a ROWS_NXO):
 *   hoja 3: fila 4 es el aturdido (NXO: recuperación izquierda), 5 punto ganado, 6 se agacha = punto perdido, 7 salto (sin uso),
 *           8 paso largo (= espera activa). No trae `recover-left` (se arma con 2 frames de la estirada izquierda) y el aturdido
 *           empieza agachado (copia la escala de `point-won`).
 *   hoja 4: 9 frames por fila (NXO: 8); las filas 1 y 2 no son el bote ni el lanzamiento del saque (sin uso, el saque
 *           arranca en su frame 1 con `bounce: null` en NxoActor), 3 caminar, 4 recibe el INFERNO, 5 volea, 6 dejada, 7 intro, 8 saludo.
 *   la espera (`wait`) no puede quitar piezas sueltas: no tiene marcas "( )" y borraría la raqueta.
 */
const MAI_LEGACY_MOVES = {
  cols: { 1: 8, 2: 8, 3: 8, 4: 9 },
  rows: {
    ...ROWS_NXO,
    3: { 1: 'dive-right', 2: 'dive-left', 3: 'recover-right', 4: 'stunned', 5: 'point-won', 6: 'point-lost', 8: 'wait' },
    4: { 3: 'walk', 4: 'inferno-hit', 5: 'volley', 6: 'dropshot', 7: 'intro', 8: 'greet' },
  },
  refFourth: 'walk',
  keepMain: [],
  derived: { 'recover-left': { from: 'dive-left', frames: [6, 7] } },
  scaleAs: { stunned: 'point-won' },
};
/*
 * Campos de `moves` (todos opcionales salvo cols, rows y refFourth):
 *   cols         frames por fila de cada hoja (hoja -> columnas). La celda se deduce del tamaño real de la imagen.
 *   rows         orden de filas (ROWS_NXO)
 *   refFourth    clip de la hoja 4 cuyo frame 1 (de pie) iguala la escala de esa hoja con las demás
 *   derived      clips armados con frames (0-based) de otra fila ya cortada: { clip: { from, frames } }
 *   keepMain     clips en que solo se queda la pieza conexa más grande (quita marcas sueltas, p. ej. los "( )" de la espera)
 *   scaleAs      clips que NO empiezan de pie y copian la escala de otra fila: { clip: 'fila-vecina' }
 *   flipSheets   hojas enteras dibujadas con la raqueta en la mano izquierda (se espejan)
 *   flipRows     filas sueltas con la raqueta en la mano izquierda: { hoja: [filas] } (se espeja cada frame)
 *   cutAt        cortes entre filas a mano: { hoja: { 'fila de arriba/frame': y en px de la hoja } }
 *   greenDetails true = hay detalles VERDES dentro del personaje (la flor de la gorra de MAI) que el croma no debe borrar
 *   serveRacket  centro del cordaje en el impacto del saque, medido sobre las tiras (ver build-moves.mjs)
 * Campos de `ulti` (todos opcionales): greenDetails, hold, preStrike, impact, racketFree, pickupGrab.
 */
export const CHARACTERS = {
  nxo: {
    view: 'back',
    dir: 'Nxo',
    prefix: 'pj-nxo',
    moves: {
      ...MOVES_STANDARD,
      serveRacket: { normal: { dx: -25, z: 147 }, spin: { dx: -33, z: 143 } }, // hoja 2 del 12-11-2026 (raqueta arriba a la izquierda en el impacto)
    },
    ulti: {},
  },
  'nxo-front': {
    view: 'front',
    dir: 'Nxo/rival',
    prefix: 'pj-nxo-rival',
    moves: {
      ...MOVES_STANDARD,
      // Hoja 1 (12-11-2026): reposo, victoria y derrota traen la raqueta a la derecha de la imagen; las carreras (filas 2, 3, 5, 6 y 7)
      // ya corren hacia la derecha y no se espejan (espejadas correrían al revés). Hoja 4 (10-11-2026): el bote del saque viene espejado.
      flipRows: { 1: [1, 4, 8], 4: [1] },
      // Hoja 3 (12-11-2026): la estirada izquierda (fila 2, frame 7) toca la cabeza de la recuperación de abajo, y los pies del
      // aturdido (fila 5, frames 4 y 5) tocan el pelo del salto de punto ganado.
      cutAt: { 3: { '2/7': 284, '5/4': 668, '5/5': 668 } },
      serveRacket: { normal: { dx: -10, z: 148 }, spin: { dx: -19, z: 146 } }, // hoja 2 del 12-11-2026 (raqueta a la izquierda de la imagen)
    },
    ulti: {},
  },
  mai: {
    view: 'back',
    dir: 'Mai',
    prefix: 'pj-mai',
    moves: {
      ...MAI_LEGACY_MOVES, // ver el bloque TEMPORAL de arriba
      greenDetails: true,
      serveRacket: { normal: { dx: 12, z: 128 }, spin: { dx: 20, z: 146 } },
    },
    ulti: { greenDetails: true },
  },
  // Mai rival: sus hojas de movimientos (pj-mai-rival-1..4.png) aún no están procesadas; cuando se instalen, añadir `moves` y
  // conectar el pack en objects/NxoActor.ts. Hoy solo tiene la ULTI cortada.
  'mai-front': {
    view: 'front',
    dir: 'Mai/rival',
    prefix: 'pj-mai-rival',
    ulti: { greenDetails: true },
  },
};
