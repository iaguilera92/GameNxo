import Phaser from 'phaser';
import { ALLEY, COURT, NET_X } from '../config';
import { VIEW, project } from './projection';

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
  { key: 'ambiente-1', file: 'ambiente-1.webp', w: 1536, h: 1024, wallBottomY: 318, wallTopY: 265, fenceTopY: 205, surface: 'hard', sky: 0x031d6b },
  { key: 'ambiente-2', file: 'ambiente-2.webp', w: 1536, h: 1024, wallBottomY: 345, wallTopY: 268, fenceTopY: 196, surface: 'clay', sky: 0x0c2e35 },
  { key: 'ambiente-3', file: 'ambiente-3.webp', w: 1536, h: 1024, wallBottomY: 418, wallTopY: 359, fenceTopY: 222, perchTopY: 325, surface: 'hard', sky: 0x143d7e },
  // (19-11-2026, usuario) PARQUE con varias canchas: SOLO para el 2v2. Imagen con un PASEO de lado a lado detrás del muro (los paseantes
  // cruzan toda la pantalla). Muro del fondo medido sobre la imagen (borde de arriba en y 313, pie en y 397); no tiene valla encima:
  // fenceTopY = el alto de las vallas verdes del fondo (~236). Piso verde de la imagen y cancha azul (hard)
  { key: 'ambiente-1-2v2', file: 'ambiente-1-2v2.webp', w: 1536, h: 1024, wallBottomY: 397, wallTopY: 313, fenceTopY: 236, surface: 'hard', court: 'green', sky: 0x2a7ba4, only: '2v2' },
];

/** (19-11-2026) Ambientes cargados para este modo: el 2v2 usa los suyos (`only: '2v2'`) si hay alguno cargado; el 1v1 nunca los usa. */
function ambientesFor(scene: Phaser.Scene, doubles: boolean): Ambiente[] {
  const loaded = AMBIENTES.filter((a) => scene.textures.exists(a.key));
  const own = loaded.filter((a) => a.only === '2v2');
  if (doubles && own.length) return own;
  return loaded.filter((a) => !a.only);
}

/** y en pantalla donde debe quedar el muro del fondo (un poco por detrás de la cancha) */
const WALL_AT_Y = 302;
/** Relleno común al pie de todos los ambientes y detrás de los controles. */
const SHARED_FOOTER = 0x07152f;
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
  img: { left: number; top: number; s: number };
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

/**
 * Dibuja ambiente + cancha. Devuelve la pared dibujada, o null si falta la imagen (la escena dibuja la suya).
 * preferred: ambiente ya elegido (en la búsqueda, para que su música empiece en el VS); si no, se sortea.
 */
export function drawCourtView(scene: Phaser.Scene, preferred?: string | null, doubles = false): DrawnWall | null {
  // 'dev.ambiente' puede forzar cualquiera (también el del 2v2 en un 1v1, para probarlo); si no, solo los de este modo
  const loaded = AMBIENTES.filter((a) => scene.textures.exists(a.key));
  if (!loaded.length) return null;
  const available = ambientesFor(scene, doubles);
  // pruebas: localStorage 'dev.ambiente' = 'ambiente-2' fuerza uno concreto
  let forced: string | null = null;
  try {
    forced = localStorage.getItem('dev.ambiente');
  } catch {
    /* sin almacenamiento */
  }
  const amb = loaded.find((a) => a.key === forced) ?? available.find((a) => a.key === preferred) ?? (Phaser.Utils.Array.GetRandom(available.length ? available : loaded) as Ambiente);
  const H = Math.max(scene.scale.height, VIEW.H);

  // ---------------------------------------------------------------- ambiente (imagen)
  const s = Math.max(H / amb.h, COVER_W / amb.w);
  const top = WALL_AT_Y - amb.wallBottomY * s;
  const imgBottom = top + amb.h * s;
  // Relleno común bajo el escenario. La transición encima suaviza el borde inferior de cada imagen.
  scene.add.rectangle(-1000, imgBottom - 4, VIEW.W + 2000, Math.max(0, H - imgBottom) + 440, SHARED_FOOTER).setOrigin(0).setDepth(-21);
  // '__BASE' explícito: los recortes del cielo (extendTop) se añaden como frames de esta misma textura y Phaser cambia su
  // primer frame al añadir uno: sin esto, desde el 2º partido el estadio se dibujaba con la franja de 3 px (todo negro)
  scene.add.image(VIEW.W / 2, top, amb.key, '__BASE').setOrigin(0.5, 0).setScale(s).setDepth(-20);
  extendTop(scene, amb, top, s);
  const fade = scene.add.graphics().setDepth(-19);
  fade.fillGradientStyle(SHARED_FOOTER, SHARED_FOOTER, SHARED_FOOTER, SHARED_FOOTER, 0, 0, 1, 1)
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
  return { wallAtY: WALL_AT_Y, padPx: (amb.wallBottomY - amb.wallTopY) * s, fencePx: (amb.wallBottomY - amb.fenceTopY) * s, perchPx: (amb.wallBottomY - (amb.perchTopY ?? amb.wallTopY)) * s, key: amb.key, img: { left: VIEW.W / 2 - (amb.w * s) / 2, top, s } };
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
  // COSTADOS: fondo oscuro liso fuera de la imagen y un degradado que entra en su borde
  const iw = amb.w * s;
  const ih = amb.h * s;
  const left = VIEW.W / 2 - iw / 2;
  const dark = 0x050b1c;
  for (const side of [-1, 1] as const) {
    const edge = side < 0 ? left : left + iw;
    scene.add.rectangle(side < 0 ? edge - 1500 : edge, top, 1500, ih + 600, dark).setOrigin(0, 0).setDepth(-22);
    const v = scene.add.graphics().setDepth(-19);
    const x0 = side < 0 ? edge - 2 : edge - SIDE_BLEND + 2;
    const a0 = side < 0 ? 1 : 0;
    const a1 = side < 0 ? 0 : 1;
    v.fillGradientStyle(dark, dark, dark, dark, a0, a1, a0, a1).fillRect(x0, top, SIDE_BLEND, ih);
  }
}
/** cuánto entra el degradado del cielo / de los costados en el borde de la imagen (px de mundo) */
const SKY_BLEND = 90;
const SIDE_BLEND = 70;


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
