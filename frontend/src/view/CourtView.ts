import Phaser from 'phaser';
import { ALLEY, COURT, NET_X } from '../config';
import { COURT_SHIFT, VIEW, project } from './projection';

/**
 * Ambiente + cancha del partido (solo visual).
 *
 * - Ambiente: imagen (estadio, focos, vallas). Su suelo hace de "pista exterior". Se escala y desplaza
 *   para que el muro del fondo de la imagen quede justo detrás de la cancha.
 * - Cancha: dibujada por código con `project()` para que líneas y física calcen siempre.
 *   Su estilo depende del ambiente: 'hard' (pista dura azul) o 'clay' (arcilla sobre la textura de la imagen).
 * - Al empezar cada partido se elige un ambiente al azar entre los que estén cargados.
 *
 * La red NO se dibuja aquí (va en MatchScene, en su propia capa de profundidad).
 * Devuelve false si no hay ningún ambiente cargado (MatchScene usa entonces su cancha de siempre).
 */

export type Surface = 'hard' | 'clay';

export interface Ambiente {
  key: string;
  file: string;
  w: number;
  h: number;
  /** borde inferior del muro del fondo en la imagen (px) */
  wallBottomY: number;
  /** borde superior del muro sólido y de la valla de malla que hay encima (px de imagen; medidos a ojo) */
  wallTopY: number;
  fenceTopY: number;
  /** (21-11-2026) y de la imagen donde se POSA la paloma (borde de arriba del muro); sin él, `wallTopY`. En el ambiente 3 el borde del muro está más arriba que su `wallTopY` y la paloma quedaba a media pared */
  perchTopY?: number;
  /** (21-11-2026, usuario) alto de REFERENCIA para la escala si la imagen es más alta que 1024 (ver 'Estructura de un ambiente' en NOTAS-CLAUDE.txt): así las medidas y el tamaño de las cosas no cambian y el alto de más queda como suelo extra abajo */
  scaleH?: number;
  /** (21-11-2026, usuario) px de pantalla que BAJA toda la cancha (cancha, red, personajes) respecto a la imagen, que no se mueve: más espacio entre la pared y el rival. Ver COURT_SHIFT */
  courtDY?: number;
  /** (22-11-2026, usuario) achica la imagen del ambiente (× sobre su escala; 1 = como siempre) para que lo de los costados (gradas) entre en pantalla. El muro sigue en WALL_AT_Y */
  zoom?: number;
  /**
   * (22-11-2026, usuario) escala FIJA (la de un teléfono de 720x1280), igual en todos los teléfonos: la cancha no cambia con el alto de la
   * pantalla y, sin esto, en un teléfono más alargado la imagen crecía y las gradas quedaban pegadas a la cancha. Para imágenes dibujadas
   * sobre la cancha (boceto _temp/standsketch.mjs). Lo que sobra abajo en un teléfono alargado lo cubre el relleno común (SHARED_FOOTER)
   */
  fixedScale?: boolean;
  /**
   * (22-11-2026, usuario) y de la imagen que se pone en WALL_AT_Y (sin él, `wallBottomY`). Sirve para subir el muro en el dibujo sin mover la
   * imagen: las gradas, alineadas a la cancha, quedan donde estaban y la pared (choque de la pelota, paloma) se mide en su `wallBottomY` real
   */
  anchorY?: number;
  /** (22-11-2026, usuario) color del relleno bajo la imagen y detrás de los controles (por defecto SHARED_FOOTER, azul oscuro) */
  footer?: number;
  surface: Surface;
  /** color medio de la fila de arriba de la imagen (cielo que la continúa al alejar la cámara) */
  sky?: number;
  /** (19-11-2026, usuario) mapa EXCLUSIVO de un modo: '2v2' = solo sale en los partidos 2v2 (y el 2v2 solo usa los suyos) */
  only?: '2v2';
  /** (19-11-2026, usuario) colores de la cancha dura: azul (por defecto) o VERDE (a juego con un piso verde, como el del parque) */
  court?: keyof typeof HARD_COLORS;
}

/** Ambientes panorámicos optimizados en WebP, cargados aleatoriamente al iniciar cada partido. */
export const AMBIENTES: Ambiente[] = [
  // (22-11-2026, usuario) rehecho: SIN vallas laterales, gradas pegadas a la cancha (espectadores), farol del centro APAGADO (su luz la pone el código). Muro medido sobre la imagen nueva. zoom 0.7: las esquinas de las gradas entran en pantalla
  // (22-11-2026, usuario) imagen de ChatGPT con las GRADAS ENDEREZADAS a la perspectiva de la cancha (_temp/warp-gradas.mjs; original en
  // _temp/respaldo_oficial/ambientes/ambiente-1-1254-v3.png). (22-11-2026, usuario) MURO MAS ARRIBA y gradas mas separadas (ChatGPT sobre la
  // guia _temp/guia-muro.mjs, enderezada otra vez: ambiente-1-1254-v4-muro.png): muro borde de arriba y 251, pie y 306, malla 200. La imagen
  // sigue anclada como antes (anchorY 350 = el pie del muro anterior) para que las gradas no se muevan respecto a la cancha.
  // (22-11-2026, usuario) v5: muro todavia mas arriba (borde y 228, pie y 278, malla 178) (ambiente-1-1254-v5.png, instalada TAL CUAL a pedido del usuario: sin enderezar las gradas)
  // (23-11-2026, usuario) v6 de ChatGPT: gradas abiertas como el 2v2 (pie de las gradas siguiendo la perspectiva de la cancha) y muro del fondo
  // más alto (borde y 172, pie y 229 de 1254). Misma posición de la imagen (anchorY 350); muro en su pie y borde reales.
  { key: 'ambiente-1', file: 'ambiente-1.webp', w: 1536, h: 1536, scaleH: 1024, courtDY: 52, zoom: 0.7, fixedScale: true, anchorY: 350, wallBottomY: 280, wallTopY: 211, fenceTopY: 178, surface: 'hard', court: 'night', sky: 0x031d6b, footer: 0x303a62 }, // (23-11-2026) v7: mismo dibujo que la v6 con el piso azul pizarra; cancha con la paleta `night` y relleno de abajo del color del piso
  // (22-11-2026, usuario) ARCILLA nueva (1536 x 1536, estructura est�ndar): muro verde del fondo medido sobre la imagen (borde de arriba en y 318,
  // pie en y 396; postes de la malla hasta y ~251). Gradas a los dos costados: zoom 0.6 (con 0.7 casi no entraban en pantalla y los espectadores no se veian, 22-11-2026)
  // (23-11-2026, usuario) ambiente-2 v2 de ChatGPT: gradas abiertas siguiendo la cancha (pie de la grada izquierda (293,330)->(27,590) de 1254);
  // el muro verde no se movió (pie y 322 de 1254), mismos valores
  { key: 'ambiente-2', file: 'ambiente-2.webp', w: 1536, h: 1536, scaleH: 1024, courtDY: 52, zoom: 0.6, wallBottomY: 396, wallTopY: 318, fenceTopY: 251, surface: 'clay', sky: 0x0c2e35 },
  // (22-11-2026, usuario) CIUDAD nueva (1536 x 1536, estructura est�ndar): calle a la izquierda (pasar�n autos), gradas a la derecha. Muro azul
  // del fondo medido sobre la imagen (borde de arriba en y 317, pie en y 392; malla hasta y ~251). Sin cornisa: se posa en el borde del muro
  // (23-11-2026, usuario) imagen v2 de ChatGPT: a la derecha, reja y camino del parque en vez de gradas; muro y bordes del piso donde estaban (mismos valores)
  { key: 'ambiente-3', file: 'ambiente-3.webp', w: 1536, h: 1536, scaleH: 1024, courtDY: 52, zoom: 0.7, wallBottomY: 392, wallTopY: 317, fenceTopY: 251, surface: 'hard', sky: 0x143d7e },
  // (21-11-2026, usuario) NIEVE: muro de piedra del fondo medido sobre la imagen (nieve del borde en y 333, pie en y 372); valla de malla encima (en la imagen llega a y ~285; fenceTopY 265 = 20 px mas alta a pedido del usuario, 21-11-2026). Piso duro azul
  { key: 'ambiente-4', file: 'ambiente-4.webp', w: 1536, h: 1536, scaleH: 1024, courtDY: 52, wallBottomY: 372, wallTopY: 333, fenceTopY: 265, surface: 'hard', sky: 0x2a80e8 },
  // (19-11-2026, usuario) PARQUE con varias canchas: SOLO para el 2v2. Imagen con un PASEO de lado a lado detrás del muro (los paseantes
  // cruzan toda la pantalla). Muro del fondo medido sobre la imagen (borde de arriba en y 313, pie en y 397); no tiene valla encima:
  // fenceTopY = el alto de las vallas verdes del fondo (~236). Piso verde de la imagen y cancha azul (hard)
  // (22-11-2026, usuario) imagen nueva de ChatGPT v9 de ChatGPT ENDEREZADA fila por fila con _temp/enderezar-2v2.mjs: pie de los muros a 140 px de la linea de dobles en todas las filas (23-11: guia _temp/para-chatgpt/2v2-v7-guia-muros-rojo.png, distancia muro-dobles 160/151 arriba -> 139/131 abajo, guia 140; antes v8 172 -> 136; pie muro fondo y 352 de 1254 = 431, borde de arriba y 250 = 306) (antes v6, con escalera a la derecha), redibujada con los muros de los lados paralelos en pantalla a la línea de dobles (guía _temp/para-chatgpt/2v2-guia-muros-rojo.png); muro del fondo al pie y 337 de 1254 = 412
  { key: 'ambiente-1-2v2', file: 'ambiente-1-2v2.webp', w: 1536, h: 1536, scaleH: 1024, courtDY: 52, zoom: 0.7, fixedScale: true, anchorY: 431, wallBottomY: 387, wallTopY: 285, fenceTopY: 184, surface: 'hard', court: 'green', sky: 0x2a7ba4, footer: 0x0caf36, only: '2v2' }, // footer = verde del pasto de abajo de la imagen
];

/** (19-11-2026) Ambientes cargados para este modo: el 2v2 usa los suyos (`only: '2v2'`) si hay alguno cargado; el 1v1 nunca los usa. */
function ambientesFor(scene: Phaser.Scene, doubles: boolean): Ambiente[] {
  const loaded = AMBIENTES.filter((a) => scene.textures.exists(a.key));
  const own = loaded.filter((a) => a.only === '2v2');
  if (doubles && own.length) return own;
  const all1v1 = loaded.filter((a) => !a.only);
  // (22-11-2026, usuario) en 1v1 sale AL AZAR uno de SORTEO_1V1 (ambiente-3 queda fuera hasta que llegue su imagen nueva). null = todos
  const only = SORTEO_1V1 ? all1v1.filter((a) => SORTEO_1V1.includes(a.key)) : [];
  return only.length ? only : all1v1;
}
/** (22-11-2026, usuario) ambientes que entran al sorteo del 1v1; null = aleatorio entre todos */
// (22-11-2026, usuario) por ahora SOLO ambiente-1 (se esta revisando la imagen nueva). Sorteo anterior: ['ambiente-1', 'ambiente-2', 'ambiente-4']
// (23-11-2026, usuario) los mapas 1v1 ya listos (imagen rehecha en perspectiva): 1, 2 y 3. ambiente-4 entra cuando se rehaga.
const SORTEO_1V1: string[] | null = ['ambiente-1', 'ambiente-2', 'ambiente-3'];

/** y en pantalla donde debe quedar el muro del fondo (un poco por detrás de la cancha) */
const WALL_AT_Y = 302;
/** Relleno común al pie de todos los ambientes y detrás de los controles. */
export const SHARED_FOOTER = 0x07152f;
/** (22-11-2026) relleno del pie de un ambiente (el suyo o el común) */
export const footerColor = (key?: string | null) => AMBIENTES.find((a) => a.key === key)?.footer ?? SHARED_FOOTER;
/** el mismo color oscurecido (franja de detrás de los controles y fondo de la presentación) */
export const footerDark = (col: number, k = 0.5) => { const c = Phaser.Display.Color.IntegerToColor(col); return Phaser.Display.Color.GetColor(Math.round(c.red * k), Math.round(c.green * k), Math.round(c.blue * k)); };
/** ancho mínimo a cubrir (la cámara sigue al jugador en lateral) */
const COVER_W = VIEW.W + 400;

const LAT_C = (COURT.top + COURT.bottom) / 2;

export function queueAmbienteLoad(load: Phaser.Loader.LoaderPlugin) {
  for (const a of AMBIENTES) if (!load.textureManager.exists(a.key)) load.image(a.key, a.file);
}

/** Pared del fondo tal como se dibujó (para que la pelota choque donde se ve): base en pantalla y alturas en px. */
export interface DrawnWall {
  wallAtY: number;
  padPx: number;
  fencePx: number;
  /** alto (px de pantalla, desde la base del muro) del borde de arriba donde se posa la paloma */
  perchPx: number;
  /** ambiente elegido (para elegir la música del partido) */
  key: string;
  /** (19-11-2026) dónde se dibujó la imagen del ambiente: esquina de arriba a la izquierda y escala (para poner cosas sobre ella: paseantes) */
  img: { left: number; top: number; s: number; w: number; h: number };
}

/**
 * Ambiente (cancha + música) de un partido ONLINE: sale del id de la sala, así que los dos teléfonos eligen el mismo sin enviarse nada
 * (en 1v1 y en 2v2). null = no hay imagen de ambiente cargada. Contra el bot sigue el sorteo de siempre (pickAmbiente).
 */
export function ambienteForRoom(scene: Phaser.Scene, roomId: string, doubles = false): string | null {
  const available = ambientesFor(scene, doubles);
  if (!available.length) return null;
  let h = 2166136261;
  for (const c of roomId) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 13;
  return available[(h >>> 0) % available.length].key;
}

/** Sortea el ambiente del partido (respeta 'dev.ambiente'). null = no hay imagen de ambiente cargada. */
export function pickAmbiente(scene: Phaser.Scene, doubles = false): string | null {
  const available = ambientesFor(scene, doubles);
  if (!available.length) return null;
  let forced: string | null = null;
  try {
    forced = localStorage.getItem('dev.ambiente');
  } catch {
    /* sin almacenamiento */
  }
  return (available.find((a) => a.key === forced) ?? (Phaser.Utils.Array.GetRandom(available) as Ambiente)).key;
}

/** (21-11-2026) Ambiente que se usará en el partido (mismo criterio que drawCourtView): 'dev.ambiente' puede forzar cualquiera, luego el elegido (preferred) y si no, sorteo. null = no hay imágenes cargadas. */
export function resolveAmbiente(scene: Phaser.Scene, preferred?: string | null, doubles = false): Ambiente | null {
  const loaded = AMBIENTES.filter((a) => scene.textures.exists(a.key));
  if (!loaded.length) return null;
  const available = ambientesFor(scene, doubles);
  let forced: string | null = null;
  try {
    forced = localStorage.getItem('dev.ambiente');
  } catch {
    /* sin almacenamiento */
  }
  return loaded.find((a) => a.key === forced) ?? available.find((a) => a.key === preferred) ?? (Phaser.Utils.Array.GetRandom(available.length ? available : loaded) as Ambiente);
}

/**
 * Dibuja ambiente + cancha. Devuelve la pared dibujada, o null si falta la imagen (la escena dibuja la suya).
 * preferred: ambiente ya elegido (en la búsqueda, para que su música empiece en el VS); si no, se sortea.
 */
export function drawCourtView(scene: Phaser.Scene, preferred?: string | null, doubles = false): DrawnWall | null {
  const amb = resolveAmbiente(scene, preferred, doubles);
  if (!amb) return null;
  COURT_SHIFT.y = amb.courtDY ?? 0; // antes de dibujar nada (la cancha, la red y los personajes usan project)
  const H = Math.max(scene.scale.height, VIEW.H);

  // ---------------------------------------------------------------- ambiente (imagen)
  const s = Math.max((amb.fixedScale ? VIEW.H : H) / (amb.scaleH ?? amb.h), COVER_W / amb.w) * (amb.zoom ?? 1);
  const top = WALL_AT_Y - (amb.anchorY ?? amb.wallBottomY) * s;
  const wallAtY = top + amb.wallBottomY * s; // pie del muro en pantalla (= WALL_AT_Y sin anchorY)
  const imgBottom = top + amb.h * s;
  // Relleno común bajo el escenario. La transición encima suaviza el borde inferior de cada imagen.
  const FOOT = amb.footer ?? SHARED_FOOTER;
  scene.add.rectangle(-1000, imgBottom - 4, VIEW.W + 2000, Math.max(0, H - imgBottom) + 2400, FOOT).setOrigin(0).setDepth(-21);
  // '__BASE' explícito: los recortes del cielo (extendTop) se añaden como frames de esta misma textura y Phaser cambia su
  // primer frame al añadir uno: sin esto, desde el 2º partido el estadio se dibujaba con la franja de 3 px (todo negro)
  scene.add.image(VIEW.W / 2, top, amb.key, '__BASE').setOrigin(0.5, 0).setScale(s).setDepth(-20);
  extendTop(scene, amb, top, s);
  const fade = scene.add.graphics().setDepth(-19);
  fade.fillGradientStyle(FOOT, FOOT, FOOT, FOOT, 0, 0, 1, 1)
    .fillRect(-1000, imgBottom - 220, VIEW.W + 2000, 270);

  // ---------------------------------------------------------------- cancha (código)
  const g = scene.make.graphics({}, false);
  if (amb.surface === 'clay') drawClay(g);
  else drawHard(g, HARD_COLORS[amb.court ?? 'blue']);

  // hornear en una textura (1 sola vez; rápido en el móvil)
  const BX = -1000;
  const BY = 0;
  const rt = scene.add.renderTexture(BX, BY, VIEW.W + 2000, Math.ceil(H) + 40).setOrigin(0).setDepth(-10);
  rt.draw(g, -BX, -BY);
  g.destroy();
  return { wallAtY, padPx: (amb.wallBottomY - amb.wallTopY) * s, fencePx: (amb.wallBottomY - amb.fenceTopY) * s, perchPx: (amb.wallBottomY - (amb.perchTopY ?? amb.wallTopY)) * s, key: amb.key, img: { left: VIEW.W / 2 - (amb.w * s) / 2, top, s, w: amb.w * s, h: amb.h * s } };
}

/**
 * (14-11-2026) CIELO sobre la imagen del ambiente: al alejar la cámara (globo) se veía una franja negra arriba. Se estira la
 * fila de arriba de la imagen hacia arriba (continúa sus colores) y se funde con el color medio de esa fila, que cubre el resto.
 */
function extendTop(scene: Phaser.Scene, amb: Ambiente, top: number, s: number) {
  // (15-11-2026) sin estirar filas/columnas de la imagen: estirar 3 px dejaba LÍNEAS (rayas) arriba y a los lados al alejar la
  // cámara. Ahora: color liso del cielo de cada ambiente y un degradado que se funde DENTRO del borde de la imagen (sin corte).
  const avg = amb.sky ?? 0x0b1530;
  const W0 = -1500;
  const WW = VIEW.W + 3000;
  scene.add.rectangle(W0, top + 2, WW, 2200, avg).setOrigin(0, 1).setDepth(-22);
  const fade = scene.add.graphics().setDepth(-19);
  fade.fillGradientStyle(avg, avg, avg, avg, 1, 1, 0, 0).fillRect(W0, top - 2, WW, SKY_BLEND);
  // COSTADOS (23-11-2026, usuario): antes, fondo oscuro liso y un degradado negro en el borde; al ir a un lado se veía un borde
  // negro. Ahora, la misma imagen espejada a cada lado: el borde empalma sin corte y al mover la cámara sigue el ambiente.
  const iw = amb.w * s;
  for (const side of [-1, 1] as const) {
    scene.add.image(VIEW.W / 2 + side * iw, top, amb.key, '__BASE').setOrigin(0.5, 0).setScale(s).setFlipX(true).setDepth(-20);
  }
}
/** cuánto entra el degradado del cielo en el borde de arriba de la imagen (px de mundo) */
const SKY_BLEND = 90;


// ================================================================ utilidades de dibujo

const P = (x: number, y: number) => {
  const p = project(x, y);
  return new Phaser.Math.Vector2(p.sx, p.sy);
};
const quad = (g: Phaser.GameObjects.Graphics, x0: number, y0: number, x1: number, y1: number) =>
  g.fillPoints([P(x0, y0), P(x0, y1), P(x1, y1), P(x1, y0)], true);

const dT = COURT.top - ALLEY;
const dB = COURT.bottom + ALLEY;
const SL = (NET_X - COURT.left) * 0.538; // línea de saque (6.40 m de 11.885 m)

/** Líneas reglamentarias (dobles, individuales, saque, marcas centrales). */
const LINES: [number, number, number, number][] = [
  [COURT.left, dT, COURT.right, dT],
  [COURT.left, dB, COURT.right, dB],
  [COURT.left, COURT.top, COURT.right, COURT.top],
  [COURT.left, COURT.bottom, COURT.right, COURT.bottom],
  [COURT.left, dT, COURT.left, dB],
  [COURT.right, dT, COURT.right, dB],
  [NET_X - SL, COURT.top, NET_X - SL, COURT.bottom],
  [NET_X + SL, COURT.top, NET_X + SL, COURT.bottom],
  [NET_X - SL, LAT_C, NET_X + SL, LAT_C],
  [COURT.left, LAT_C, COURT.left + 14, LAT_C],
  [COURT.right - 14, LAT_C, COURT.right, LAT_C],
];

function strokeLines(g: Phaser.GameObjects.Graphics, w: number, col: number, a: number) {
  g.lineStyle(w, col, a);
  for (const [x0, y0, x1, y1] of LINES) {
    const a0 = P(x0, y0);
    const a1 = P(x1, y1);
    g.lineBetween(a0.x, a0.y, a1.x, a1.y);
  }
}

/** Mancha de luz suave (varias elipses superpuestas). */
function glow(g: Phaser.GameObjects.Graphics, x: number, y: number, rx: number, ry: number, a: number, col: number) {
  const c = P(x, y);
  for (let k = 4; k >= 1; k--) {
    g.fillStyle(col, (a * (5 - k)) / 10);
    g.fillEllipse(c.x, c.y, (rx * k) / 4, (ry * k) / 4);
  }
}

// ================================================================ pista dura (azul)

/**
 * Colores de la cancha dura: pasillos (alley), degradado de la de individuales (near → far) y luz de los focos.
 * (19-11-2026, usuario) VERDE para el PARQUE del 2v2: tonos de cancha dura verde, algo más claros que el piso de la imagen (0x289646).
 */
const HARD_COLORS = {
  blue: { alley: 0x1d4aa0, near: 0x4a97f0, far: 0x2459b8, light: 0xbfe0ff },
  green: { alley: 0x1f7a3c, near: 0x4cbf6a, far: 0x2f9452, light: 0xe0ffd8 },
  // (23-11-2026, usuario) ambiente-1 v7, piso azul pizarra (#303a62): azul más apagado que `blue` (no choca con el piso y va con el mural) y la
  // luz de los focos cálida, como los faroles. Vista previa: _temp/preview-cancha.mjs
  night: { alley: 0x2a3c7a, near: 0x4f74c8, far: 0x33529e, light: 0xffd9a0 },
};

function drawHard(g: Phaser.GameObjects.Graphics, C = HARD_COLORS.blue) {
  // sin sombra ni borde oscuro alrededor (hacían que la cancha pareciera flotar): el borde es la línea blanca
  // pasillos de dobles: el tono profundo; individuales: degradado (más claro cerca)
  g.fillStyle(C.alley, 1);
  quad(g, COURT.left, dT, COURT.right, dB);
  const bands = 14;
  const near = Phaser.Display.Color.ValueToColor(C.near);
  const far = Phaser.Display.Color.ValueToColor(C.far);
  for (let b = 0; b < bands; b++) {
    const x0 = COURT.left + ((COURT.right - COURT.left) * b) / bands;
    const x1 = COURT.left + ((COURT.right - COURT.left) * (b + 1)) / bands;
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(near, far, bands - 1, b);
    g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
    quad(g, x0, COURT.top, x1 + 1, COURT.bottom);
  }

  // cuadros de saque un tono más claros
  g.fillStyle(0xffffff, 0.05);
  quad(g, NET_X - SL, COURT.top, NET_X + SL, COURT.bottom);

  // luz de focos
  glow(g, COURT.left + 240, LAT_C, 520, 150, 0.12, C.light);
  glow(g, COURT.right - 220, LAT_C, 300, 70, 0.1, C.light);

  // sombra del muro del fondo
  for (let i = 0; i < 6; i++) {
    g.fillStyle(0x061033, 0.16 * (1 - i / 6));
    quad(g, COURT.right - 40 - i * 14, dT, COURT.right, dB);
  }

  // líneas: halo neón + blanco
  strokeLines(g, 11, 0x6fd0ff, 0.18);
  strokeLines(g, 5, 0xffffff, 1);
}

// ================================================================ arcilla

function drawClay(g: Phaser.GameObjects.Graphics) {
  // la textura de arcilla la pone la imagen: aquí solo se matiza y se pintan las líneas
  // sin contorno oscuro alrededor: el límite de la cancha lo marcan las líneas blancas
  // superficie: tinte cálido algo más saturado que el exterior
  g.fillStyle(0xd2561f, 0.3);
  quad(g, COURT.left, dT, COURT.right, dB);
  g.fillStyle(0xe2672a, 0.12);
  quad(g, COURT.left, COURT.top, COURT.right, COURT.bottom);

  // desgaste: zonas más pisadas detrás de cada línea de fondo y junto a la red
  const wear = (x: number, rx: number, ry: number, a: number) => {
    const c = P(x, LAT_C);
    for (let k = 3; k >= 1; k--) {
      g.fillStyle(0x7a2a0c, (a * (4 - k)) / 6);
      g.fillEllipse(c.x, c.y, (rx * k) / 3, (ry * k) / 3);
    }
  };
  wear(COURT.left + 10, 420, 70, 0.22);
  wear(COURT.right - 8, 210, 26, 0.2);

  // luz cálida de los focos
  glow(g, COURT.left + 260, LAT_C, 520, 150, 0.1, 0xffe2b0);
  glow(g, COURT.right - 220, LAT_C, 300, 70, 0.08, 0xffe2b0);

  // sombra del muro del fondo
  for (let i = 0; i < 6; i++) {
    g.fillStyle(0x3a1206, 0.13 * (1 - i / 6));
    quad(g, COURT.right - 40 - i * 14, dT, COURT.right, dB);
  }

  // líneas: blanco hueso (cinta de arcilla), sin sombra oscura
  strokeLines(g, 5, 0xfbf3e6, 1);
}
