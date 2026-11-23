import Phaser from 'phaser';
import BARRIO from '../view/espectadores-barrio.json';
import ARCILLA from '../view/espectadores-arcilla.json';
import { COURT } from '../config';
import { VIEW, project } from '../view/projection';
import { CHAR_UNITS_H } from '../characters/skins';
/**
 * (21-11-2026, usuario) ESPECTADORES sentados en las gradas de los costados (ambiente-1). Casi siempre quietos (cuadro 1 de su fila) y de vez
 * en cuando hacen su movimiento sutil una vez y vuelven a quedar quietos. Hoja: tools/build-paseantes.mjs <png> espectadores-barrio 3
 * → public/assets/ambientes/espectadores-barrio.webp (3 filas × 6 cuadros, mirando a la DERECHA). Solo decoración: no tocan el partido.
 * Posiciones en px de la IMAGEN del ambiente (1536 × 1536); los pies sobre el borde de un escalón que queda por ENCIMA de la valla lateral
 * (los sprites van sobre la imagen: si quedaran tras la malla, se dibujarían delante de ella).
 */
interface Seat {
  /** fila de la hoja (barrio: 0 mira el partido, 1 celular, 2 refresco; arcilla: 0 lentes de sol, 1 chica, 2 celular, 3 perrito) */
  row: number;
  /** pies (px de imagen) */
  x: number;
  y: number;
  /** espejado: mira a la izquierda (grada de la derecha) */
  flip: boolean;
  /** espera entre movimientos (ms); no se usa si aplaude */
  every: [number, number];
  /** (22-11-2026, usuario) APLAUDE: quieto todo el rato y solo hace su movimiento cuando se gana un punto (cheer) */
  clap?: boolean;
}
interface SpectatorSet {
  key: string;
  meta: typeof BARRIO;
  /** alto (px de imagen) del más alto de la hoja */
  h: number;
  /**
   * (22-11-2026, usuario) si existe, `h` no se usa: cada espectador mide lo mismo que el RIVAL a su misma distancia (misma y de pantalla),
   * sentado = `seated` × el alto de pie del rival (150 × escala de perspectiva × CHAR_K). Asi, al lado del rival, son de su tamaño.
   */
  seated?: number;
  fps: number;
  seats: Seat[];
}
const SETS: Record<string, SpectatorSet> = {
  'ambiente-1': {
    key: 'spect-barrio',
    meta: BARRIO,
    h: 52,
    seated: 0.8, // (22-11-2026, usuario) un poco más grandes que el rival a esa distancia (antes 0.7); además crecen solos al bajar (rivalHeightAt)
    fps: 6,
    // (22-11-2026, usuario) los 4 en el escalón de abajo, lo más hacia el centro de la pantalla que entra (borde (310,261)->(240,309) de la imagen v5 de 1254, tal cual la dio ChatGPT, sin enderezar).
    // Imagen de ChatGPT con las gradas ENDEREZADAS (_temp/warp-gradas.mjs): corren paralelas a la cancha. Pies sobre el
    // borde iluminado del escalón donde se sientan (px de la imagen de 1536). Grada izquierda: escalón de abajo (401,358)->(220,588), el de encima
    // (352,337)->(220,472); grada derecha: escalón de abajo (1133,358)->(1323,576). En pantalla se ve de x ~284 a ~1252 (y la cámara se mueve un poco)
    // (22-11-2026, usuario) bajados ~15 px por el mismo escalón (borde (380,320)->(294,378) en 1536); el de más abajo queda a ~25 px del borde de la pantalla
    seats: [
      { row: 1, x: 352, y: 338, flip: false, every: [4000, 9000] }, // grada izquierda, junto a la esquina del muro: celular (se dibuja antes: queda detrás)
      { row: 0, x: 310, y: 367, flip: false, every: [5000, 11000] }, // grada izquierda, más hacia la red: mira el partido
      // (22-11-2026, usuario) sin el niño repetido junto al abuelo (el niño que mira el partido queda solo en la grada izquierda)
      { row: 2, x: 1184, y: 338, flip: true, every: [10000, 20000] }, // grada derecha, junto a la esquina del muro: toma refresco de vez en cuando
    ],
  },
  // (22-11-2026, usuario) ARCILLA (ambiente-2): hoja ambiente-2-figuras (4 filas x 8, fondo de tablero quitado con _temp/prep-figuras.mjs y
  // luego tools/build-paseantes.mjs <png> espectadores-arcilla 4 8). Miran a la DERECHA. Pies sobre el borde de los escalones de abajo, en px de
  // la imagen de 1536: grada izquierda borde (441,394)->(0,717), el de encima (404,380)->(0,588); grada derecha, espejada
  'ambiente-2': {
    key: 'spect-arcilla',
    meta: ARCILLA,
    h: 80, // (22-11-2026, usuario: con 52 no se veian) ~60 px en pantalla con el zoom 0.6
    fps: 7,
    // en pantalla (zoom 0.6) se ve de x ~288 a ~1248 de la imagen: los asientos van en la esquina de cada grada, junto al muro
    seats: [
      { row: 3, x: 420, y: 410, flip: false, every: [7000, 14000] }, // grada izquierda, junto a la esquina: el perrito (se dibuja antes: queda detras)
      { row: 0, x: 360, y: 448, flip: false, every: [6000, 12000], clap: true }, // grada izquierda, escalon de abajo: lentes de sol, aplaude en cada punto
      { row: 2, x: 1196, y: 413, flip: true, every: [5000, 10000] }, // grada derecha, escalon de encima: mira el celular (detras)
      { row: 1, x: 1136, y: 428, flip: true, every: [6000, 12000], clap: true }, // grada derecha, escalon de abajo: la chica, aplaude en cada punto
    ],
  },
};

/** (22-11-2026) alto de pie del rival (px de mundo) en la y de pantalla `sy`: se busca la profundidad x de la cancha que cae en esa y */
function rivalHeightAt(sy: number): number {
  let lo = COURT.left - 400;
  let hi = COURT.right + 2000;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (project(mid, 0).sy > sy) lo = mid; // más cerca de la camara = más abajo en pantalla
    else hi = mid;
  }
  return CHAR_UNITS_H * project((lo + hi) / 2, 0).s * VIEW.CHAR_K;
}

export function queueSpectators(load: Phaser.Loader.LoaderPlugin, ambiente: string) {
  const set = SETS[ambiente];
  if (set && !load.textureManager.exists(set.key)) load.spritesheet(set.key, set.meta.file, { frameWidth: set.meta.cell.w, frameHeight: set.meta.cell.h });
}

/** Pone los espectadores. Devuelve cheer(): los que aplauden hacen su movimiento (llamarlo al ganarse un punto); null si no hay. */
export function startSpectators(scene: Phaser.Scene, ambiente: string, img: { left: number; top: number; s: number }): (() => void) | null {
  const set = SETS[ambiente];
  if (!set || !scene.textures.exists(set.key)) return null;
  const clappers: { spr: Phaser.GameObjects.Sprite; anim: string }[] = [];
  const { key, meta } = set;
  const hMax = Math.max(...meta.heights);
  for (const seat of set.seats) {
    const scale = set.seated ? (rivalHeightAt(img.top + seat.y * img.s) * set.seated) / hMax : (set.h * img.s) / hMax;
    const first = seat.row * meta.frames;
    const anim = `${key}-${seat.row}`;
    if (!scene.anims.exists(anim)) {
      scene.anims.create({ key: anim, frames: scene.anims.generateFrameNumbers(key, { start: first, end: first + meta.frames - 1 }), frameRate: set.fps, repeat: 0 });
    }
    const spr = scene.add
      .sprite(img.left + seat.x * img.s, img.top + seat.y * img.s + meta.feetPad * scale, key, first)
      .setOrigin(0.5, 1)
      .setScale(scale)
      .setFlipX(seat.flip)
      .setDepth(-19.5); // sobre la imagen del ambiente y bajo la cancha
    // quieto en el cuadro 1; cada tanto, su movimiento una vez y de vuelta al cuadro 1
    spr.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => spr.setFrame(first));
    if (seat.clap) {
      clappers.push({ spr, anim });
      continue; // sin temporizador: solo aplaude en los puntos
    }
    const next = () =>
      scene.time.delayedCall(Phaser.Math.Between(seat.every[0], seat.every[1]), () => {
        if (!scene.sys.isActive() || !spr.active) return;
        spr.play(anim);
        next();
      });
    next();
  }
  if (!clappers.length) return null;
  return () => {
    for (const c of clappers) {
      // cada uno con su peque�o retraso, como una reacci�n
      scene.time.delayedCall(Phaser.Math.Between(150, 550), () => {
        if (scene.sys.isActive() && c.spr.active) c.spr.play(c.anim);
      });
    }
  };
}
