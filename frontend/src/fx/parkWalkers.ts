import Phaser from 'phaser';
import PARK from '../view/paseantes-parque.json';
import SNOW from '../view/paseantes-nieve.json';
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
  slope?: { x0: number; y0: number; x1: number; y1: number; adultH: number };
}
interface WalkSet {
  key: string;
  meta: Meta;
  path: { feetY: number; x0: number; x1: number; adultH: number };
  walkers: Walker[];
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
      feetY: 284,
      /** tramo que recorren: de fuera de la imagen por un lado a fuera por el otro (sin desaparecer) */
      x0: -70,
      x1: 1606,
      /** alto de un adulto en px de la imagen (las bancas miden ~45) */
      adultH: 66, // (22-11-2026) hoja nueva: el más alto es la niña en patines (casco + patines); la abuela queda en ~57 y la silla en ~52
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
    // franja de nieve entre el horizonte (y ~260) y la valla (empieza en y ~285)
    path: { feetY: 282, x0: -90, x1: 1626, adultH: 56 },
    walkers: [
      { speed: 34, fps: 8 }, // persona con bufanda
      { speed: 30, fps: 8 }, // chica con husky
      { speed: 38, fps: 9 }, // niño con trineo
      // esquiador: baja por la ladera de la derecha (borde de arriba de la ladera ≈ de (1230,139) a (960,253)); baja hasta y 264, justo antes de la franja de nieve plana (horizonte y ~260; los otros pasean con los pies en y 282) y se desvanece sin cruzarla; pies ~35 px dentro de ella. OJO: en pantalla solo se ve la franja x 480..1056 de la imagen (720 de ancho a escala 1.25), por eso el tramo es corto
      { speed: 45, fps: 10, maxPlays: 2, slope: { x0: 1230, y0: 175, x1: 920, y1: 264, adultH: 40 } },
    ],
  },
};
const MAX_AT_ONCE = 2;

/** Carga la hoja de paseantes de un ambiente (si tiene). */
export function queueWalkers(load: Phaser.Loader.LoaderPlugin, ambiente: string) {
  const set = SETS[ambiente];
  if (set && !load.textureManager.exists(set.key)) load.spritesheet(set.key, set.meta.file, { frameWidth: set.meta.cell.w, frameHeight: set.meta.cell.h });
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
  const plays = WALKERS.map(() => 0);
  let last = -1;
  const X = (x: number) => img.left + x * img.s;
  const Y = (y: number) => img.top + y * img.s;
  const hMax = Math.max(...META.heights);
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
    const sl = W.slope;
    const right = sl ? false : Math.random() < 0.5; // el esquiador baja hacia la izquierda; la hoja mira a la derecha
    const from = right ? PATH.x0 : PATH.x1;
    const to = right ? PATH.x1 : PATH.x0;
    const scale = ((sl ? sl.adultH : PATH.adultH) * img.s) / hMax; // el más alto de la hoja mide adultH px de imagen (el resto, en proporción)
    const spr = scene.add
      .sprite(X(sl ? sl.x0 : from), (sl ? Y(sl.y0) : Y(PATH.feetY)) + META.feetPad * scale, KEY, row * META.frames)
      .setOrigin(0.5, 1)
      .setScale(scale)
      .setFlipX(!right)
      .setDepth(-19.5) // sobre la imagen del ambiente y bajo la cancha
      .setAlpha(sl ? 0 : 1); // en el paseo entran y salen por los bordes de la imagen; en la ladera, con fundido
    spr.play({ key: `${KEY}-${row}`, startFrame: Math.floor(Math.random() * META.frames) });
    const dist = sl ? Math.hypot(sl.x1 - sl.x0, sl.y1 - sl.y0) : Math.abs(to - from);
    const ms = (dist / W.speed) * 1000;
    const done = () => {
      busy.delete(row);
      spr.destroy();
    };
    if (sl) {
      scene.tweens.add({ targets: spr, x: X(sl.x1), y: Y(sl.y1) + META.feetPad * scale, duration: ms, ease: 'Linear', onComplete: done });
      scene.tweens.add({ targets: spr, alpha: 1, duration: 600 });
      scene.tweens.add({ targets: spr, alpha: 0, delay: Math.max(0, ms - 600), duration: 600 });
    } else {
      scene.tweens.add({ targets: spr, x: X(to), duration: ms, ease: 'Linear', onComplete: done });
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
