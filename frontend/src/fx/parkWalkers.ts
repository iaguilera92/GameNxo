import Phaser from 'phaser';
import PARK from '../view/paseantes-parque.json';
import SNOW from '../view/paseantes-nieve.json';
import CARS from '../view/autos-ciudad.json';
/**
 * (19-11-2026, usuario) PASEANTES del mapa del 2v2 (PARQUE, `ambiente-1-2v2`): 4 personajes (señora con perro, niño con pelota, chico
 * trotando, chica con raqueta) que cruzan de vez en cuando por el CAMINO DE TIERRA del fondo, detrás del muro. Solo decoración (no tocan
 * el partido). Hoja: tools/build-paseantes.mjs → public/assets/ambientes/paseantes-parque.webp (4 filas × 6 cuadros, todos hacia la derecha).
 * Posiciones en px de la IMAGEN del ambiente (1536 × 1024); `img` dice dónde se dibujó (CourtView.drawCourtView). Cruzan de un borde de la imagen
 * al otro por el PASEO de detrás del muro (19-11-2026: la imagen se rehízo con ese paseo despejado).
 *
 * (21-11-2026, usuario) Mismo sistema para la NIEVE (`ambiente-4`, hoja paseantes-nieve: persona, chica con husky, niño con trineo,
 * esquiador). Los tres primeros cruzan la franja de nieve de detrás de la valla; el esquiador baja por la LADERA de la derecha en
 * diagonal (`slope`). Además cae nieve suave (`startSnowFall`), por detrás de la cancha.
 */
interface Meta {
  file: string;
  cell: { w: number; h: number };
  rows: number;
  frames: number;
  feetPad: number;
  heights: number[];
}
interface Walker {
  /** px de imagen por s */
  speed: number;
  /** cuadros por segundo del ciclo */
  fps: number;
  /** si existe, baja por la ladera de (x0,y0) a (x1,y1) (px de imagen, pies) en vez de cruzar el paseo; `adultH` = alto en px de imagen */
  /** (21-11-2026) máximo de veces que sale en un partido (si no, sin tope) */
  maxPlays?: number;
  /** (23-11-2026) `adultH1`: alto al llegar a (x1,y1) (crece en perspectiva al acercarse); sin él, el mismo `adultH` */
  slope?: { x0: number; y0: number; x1: number; y1: number; adultH: number; adultH1?: number };
}
interface WalkSet {
  key: string;
  meta: Meta;
  path: { feetY: number; x0: number; x1: number; adultH: number };
  walkers: Walker[];
  /** (23-11-2026) la hoja mira a la IZQUIERDA (autos de la ciudad); si no, a la derecha */
  faceLeft?: boolean;
  /** (23-11-2026, usuario) sin fundido al entrar ni al salir: solo se mueve el sprite (los autos salen de detrás de `front` y se van por el borde) */
  noFade?: boolean;
  /** (23-11-2026, usuario) sombra suave en el piso bajo cada uno (los autos: si no, parecen flotar sobre la calle) */
  shadow?: boolean;
  /**
   * (23-11-2026, usuario) CARRILES: si existen, cada uno sale por un carril libre (como `slope`, del más lejano al más cercano) y dos a la
   * vez nunca van por el mismo; el más cercano se dibuja delante.
   */
  lanes?: Array<{ x0: number; y0: number; x1: number; y1: number; adultH: number; adultH1?: number }>;
  /**
   * (23-11-2026, usuario) capa FRENTE: recorte del mismo fondo (con alfa) con lo que queda delante del recorrido; se dibuja encima de los
   * paseantes, así pasan por detrás. x, y, w, h en px de la imagen del ambiente (1536).
   */
  front?: { key: string; file: string; x: number; y: number; w: number; h: number };
}

const SETS: Record<string, WalkSet> = {
  'ambiente-1-2v2': {
    key: 'park-walkers',
    meta: PARK,
    path: {
      /**
       * (19-11-2026, usuario) pies sobre el PASEO que cruza toda la imagen detrás del muro (vereda de y 274 a ~312): en y 284 quedan por encima
       * de las rejas de los costados (empiezan en y ~287), así se ven enteros de un borde al otro
       */
      feetY: 277, // (23-11-2026) v14: borde del muro en y ~232 (1254), paseo encima; 267 -> 277. v13: 277 -> 267. (22-11-2026) imagen nueva: paseo de y ~213 a ~237 (en 1254) detrás del muro
      /** tramo que recorren: de fuera de la imagen por un lado a fuera por el otro (sin desaparecer) */
      x0: -70,
      x1: 1606,
      /** alto de un adulto en px de la imagen (las bancas miden ~45) */
      adultH: 90, // (23-11-2026, usuario) un poco más grandes otra vez: 78 -> 90 (+15 %); antes 66 -> 78 (+18 %). (22-11-2026) hoja nueva: el más alto es la niña en patines (casco + patines); la abuela queda en ~57 y la silla en ~52
    },
    walkers: [
      // (22-11-2026, usuario) hoja nueva de 8 cuadros por fila
      { speed: 22, fps: 7 }, // abuela con bastón
      { speed: 28, fps: 8 }, // abuelo en silla de ruedas
      { speed: 66, fps: 13 }, // chica trotando
      { speed: 56, fps: 10 }, // niña en patines
    ],
  },
  'ambiente-4': {
    key: 'snow-walkers',
    meta: SNOW,
    // Los pies siguen la nieve plana por detrás de los postes de la reja.
    path: { feetY: 275, x0: -90, x1: 1626, adultH: 56 },
    walkers: [
      { speed: 34, fps: 8 }, // persona con bufanda
      { speed: 30, fps: 8 }, // chica con husky
      { speed: 38, fps: 9 }, // niño con trineo
      // Baja por debajo de las casas y se desvanece al llegar al pie de la ladera, antes del paseo.
      { speed: 45, fps: 10, maxPlays: 2, slope: { x0: 1270, y0: 201, x1: 1020, y1: 264, adultH: 40 } },
    ],
  },
  /**
   * (23-11-2026, usuario) CIUDAD (`ambiente-3`, hoja autos-ciudad: auto gris, SUV, camioneta roja, camión; 8 cuadros de ruedas, de 3/4 mirando a la
   * IZQUIERDA y hacia la cámara). Bajan por el carril de abajo de la CALLE de la izquierda (entre la amarilla doble y la reja verde).
   * (23-11-2026, usuario: "no debe aparecer de la nada y desaparecer") SIN fundido: arrancan escondidos detrás de las flores del fondo (x ~502) y
   * salen por el borde izquierdo, fuera de la pantalla (x -245). La capa `front` (flores, cantero, poste del farol y reja, recortados del fondo
   * por _temp/frente-a3.mjs, imagen v2 1254 x 0..440, y 150..420) va encima, así pasan por detrás. Ruedas en 1254: (340,272) a (100,355).
   * OJO: en pantalla se ve desde x ~284 de la imagen (más si la cámara sigue al jugador a la izquierda): se ve sobre todo el tramo del fondo.
   */
  'ambiente-3': {
    key: 'city-cars',
    meta: CARS,
    faceLeft: true,
    noFade: true,
    shadow: true,
    front: { key: 'city-front', file: 'assets/ambientes/ambiente-3-frente.webp', x: 0, y: 183.73, w: 538.95, h: 330.72 },
    path: { feetY: 316, x0: 416, x1: -245, adultH: 46 }, // (no se usa: todos van por `slope`)
    // (23-11-2026, usuario) hoja v2 de ChatGPT en el estilo del ambiente (contorno grueso, luz de atardecer, faros encendidos): 6 cuadros por fila
    // (23-11-2026, usuario) imagen v3: la calle tiene 2 carriles del mismo sentido (línea blanca discontinua al medio); van por el medio de
    // cada uno. Medidos en 1254 (_temp/carriles-a3.mjs): vereda de arriba de (340,216) a (10,237), línea discontinua de (335,239) a (37,310),
    // riel de la reja de (335,277) a (37,391). Pies: lejano justo sobre la línea, cercano justo sobre la reja (las ruedas de adelante del 3/4).
    lanes: [
      { x0: 502, y0: 267, x1: -245, y1: 445, adultH: 28, adultH1: 112 },
      { x0: 502, y0: 298, x1: -245, y1: 584, adultH: 34, adultH1: 135 },
    ],
    walkers: [0, 1, 2, 3].map((i) => ({ speed: [125, 115, 120, 95][i], fps: 10, slope: { x0: 502, y0: 298, x1: -245, y1: 584, adultH: 34, adultH1: 135 } })),
  },
};
const MAX_AT_ONCE = 2;

/** Carga la hoja de paseantes de un ambiente (si tiene). */
export function queueWalkers(load: Phaser.Loader.LoaderPlugin, ambiente: string) {
  const set = SETS[ambiente];
  if (set && !load.textureManager.exists(set.key)) load.spritesheet(set.key, set.meta.file, { frameWidth: set.meta.cell.w, frameHeight: set.meta.cell.h });
  if (set?.front && !load.textureManager.exists(set.front.key)) load.image(set.front.key, set.front.file);
}
export const queueParkWalkers = (load: Phaser.Loader.LoaderPlugin) => queueWalkers(load, 'ambiente-1-2v2');

/** Empieza los paseos (llamar una vez al dibujar el ambiente). `img` = esquina de arriba a la izquierda y escala de la imagen. */
export function startWalkers(scene: Phaser.Scene, ambiente: string, img: { left: number; top: number; s: number }) {
  const set = SETS[ambiente];
  if (!set || !scene.textures.exists(set.key)) return;
  const { key: KEY, meta: META, path: PATH, walkers: WALKERS } = set;
  for (let r = 0; r < META.rows; r++) {
    const k = `${KEY}-${r}`;
    if (!scene.anims.exists(k)) {
      scene.anims.create({ key: k, frames: scene.anims.generateFrameNumbers(KEY, { start: r * META.frames, end: r * META.frames + META.frames - 1 }), frameRate: WALKERS[r].fps, repeat: -1 });
    }
  }
  const busy = new Set<number>();
  const laneBusy = new Set<number>();
  const plays = WALKERS.map(() => 0);
  let last = -1;
  const X = (x: number) => img.left + x * img.s;
  const Y = (y: number) => img.top + y * img.s;
  const hMax = Math.max(...META.heights);
  const F = set.front;
  if (F && scene.textures.exists(F.key)) scene.add.image(X(F.x), Y(F.y), F.key).setOrigin(0).setDisplaySize(F.w * img.s, F.h * img.s).setDepth(-19.45); // sobre los paseantes (-19.5)
  const walk = () => {
    if (!scene.sys.isActive() || busy.size >= MAX_AT_ONCE) return;
    // (21-11-2026, usuario) que se alternen: no repite el último, sale primero el que menos ha salido, y el que tiene tope (esquiador) no pasa de él
    const free = WALKERS.map((_, i) => i).filter((i) => !busy.has(i) && i !== last && plays[i] < (WALKERS[i].maxPlays ?? Infinity));
    if (!free.length) return;
    const least = Math.min(...free.map((i) => plays[i]));
    const pool = free.filter((i) => plays[i] === least);
    const row = pool[Math.floor(Math.random() * pool.length)];
    last = row;
    plays[row]++;
    busy.add(row);
    const W = WALKERS[row];
    const freeLanes = set.lanes ? set.lanes.map((_, i) => i).filter((i) => !laneBusy.has(i)) : [];
    if (set.lanes && !freeLanes.length) {
      busy.delete(row);
      plays[row]--;
      return;
    }
    const lane = set.lanes ? freeLanes[Math.floor(Math.random() * freeLanes.length)] : -1;
    if (lane >= 0) laneBusy.add(lane);
    const sl = lane >= 0 ? set.lanes![lane] : W.slope;
    const dz = lane >= 0 ? (set.lanes!.length - 1 - lane) * 0.002 : 0; // el carril lejano, detrás del cercano
    const fade = !!sl && !set.noFade; // ladera con fundido (esquiador); los autos, sin fundido
    const right = sl ? false : Math.random() < 0.5; // el esquiador (y los autos) bajan hacia la izquierda
    const from = right ? PATH.x0 : PATH.x1;
    const to = right ? PATH.x1 : PATH.x0;
    const scale = ((sl ? sl.adultH : PATH.adultH) * img.s) / hMax; // el más alto de la hoja mide adultH px de imagen (el resto, en proporción)
    const spr = scene.add
      .sprite(X(sl ? sl.x0 : from), (sl ? Y(sl.y0) : Y(PATH.feetY)) + META.feetPad * scale, KEY, row * META.frames)
      .setOrigin(0.5, 1)
      .setScale(scale)
      .setFlipX(set.faceLeft ? right : !right)
      .setDepth(-19.5 - dz) // sobre la imagen del ambiente y bajo la cancha
      .setAlpha(fade ? 0 : 1); // en el paseo entran y salen por los bordes de la imagen; en la ladera, con fundido
    spr.play({ key: `${KEY}-${row}`, startFrame: Math.floor(Math.random() * META.frames) });
    // sombra: elipse oscura bajo las ruedas, un poco más abajo que el sprite (depth -19.51) y que sigue su posición y escala
    const shadow = set.shadow ? scene.add.ellipse(0, 0, META.cell.w * 0.82, META.cell.w * 0.16, 0x1a0f2e, 0.35).setDepth(-19.501 - dz) : null;
    const syncShadow = () => shadow?.setPosition(spr.x, spr.y - (META.feetPad + 4) * spr.scaleY).setScale(spr.scaleX);
    syncShadow();
    const dist = sl ? Math.hypot(sl.x1 - sl.x0, sl.y1 - sl.y0) : Math.abs(to - from);
    const ms = (dist / W.speed) * 1000;
    const done = () => {
      busy.delete(row);
      if (lane >= 0) laneBusy.delete(lane);
      spr.destroy();
      shadow?.destroy();
    };
    if (sl) {
      const scale1 = ((sl.adultH1 ?? sl.adultH) * img.s) / hMax;
      scene.tweens.add({ targets: spr, x: X(sl.x1), y: Y(sl.y1) + META.feetPad * scale1, scale: scale1, duration: ms, ease: 'Linear', onUpdate: syncShadow, onComplete: done });
      if (fade) {
        scene.tweens.add({ targets: spr, alpha: 1, duration: 600 });
        scene.tweens.add({ targets: spr, alpha: 0, delay: Math.max(0, ms - 600), duration: 600 });
      }
    } else {
      scene.tweens.add({ targets: spr, x: X(to), duration: ms, ease: 'Linear', onUpdate: syncShadow, onComplete: done });
    }
  };
  // el primero pronto; luego cada 5-10 s (como mucho 2 a la vez)
  const next = (ms: number) =>
    scene.time.delayedCall(ms, () => {
      walk();
      next(Phaser.Math.Between(5000, 10000));
    });
  next(1500);
}
export const startParkWalkers = (scene: Phaser.Scene, img: { left: number; top: number; s: number }) => startWalkers(scene, 'ambiente-1-2v2', img);

/**
 * (21-11-2026, usuario) NIEVE cayendo suave sobre el ambiente de nieve: copos chicos por detrás de la cancha (depth bajo el partido) y
 * solo de la parte alta de la imagen (cielo, montañas y muro del fondo), así no tapan la cancha.
 */
export function startSnowFall(scene: Phaser.Scene, img: { left: number; top: number; s: number }) {
  const N = 55;
  const x0 = img.left - 60 * img.s;
  const w = 1656 * img.s;
  const y0 = img.top;
  const h = 380 * img.s;
  for (let i = 0; i < N; i++) {
    const r = Phaser.Math.FloatBetween(0.9, 2.1) * img.s;
    const flake = scene.add.circle(x0 + Math.random() * w, y0, r, 0xffffff, Phaser.Math.FloatBetween(0.45, 0.85)).setDepth(-19.4);
    const fall = () => {
      if (!flake.active) return;
      const x = x0 + Math.random() * w;
      flake.setPosition(x, y0 - 6);
      scene.tweens.add({
        targets: flake,
        x: x + Phaser.Math.Between(-30, 30) * img.s,
        y: y0 + h,
        duration: Phaser.Math.Between(7000, 13000),
        ease: 'Linear',
        onComplete: fall,
      });
    };
    scene.time.delayedCall(Math.random() * 9000, fall);
  }
}
