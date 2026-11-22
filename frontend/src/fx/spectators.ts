import Phaser from 'phaser';
import BARRIO from '../view/espectadores-barrio.json';
/**
 * (21-11-2026, usuario) ESPECTADORES sentados en las gradas de los costados (ambiente-1). Casi siempre quietos (cuadro 1 de su fila) y de vez
 * en cuando hacen su movimiento sutil una vez y vuelven a quedar quietos. Hoja: tools/build-paseantes.mjs <png> espectadores-barrio 3
 * → public/assets/ambientes/espectadores-barrio.webp (3 filas × 6 cuadros, mirando a la DERECHA). Solo decoración: no tocan el partido.
 * Posiciones en px de la IMAGEN del ambiente (1536 × 1536); los pies sobre el borde de un escalón que queda por ENCIMA de la valla lateral
 * (los sprites van sobre la imagen: si quedaran tras la malla, se dibujarían delante de ella).
 */
interface Seat {
  /** fila de la hoja: 0 mira el partido, 1 mira el celular, 2 toma refresco */
  row: number;
  /** pies (px de imagen) */
  x: number;
  y: number;
  /** espejado: mira a la izquierda (grada de la derecha) */
  flip: boolean;
  /** espera entre movimientos (ms) */
  every: [number, number];
}
interface SpectatorSet {
  key: string;
  meta: typeof BARRIO;
  /** alto (px de imagen) del más alto de la hoja */
  h: number;
  fps: number;
  seats: Seat[];
}
const SETS: Record<string, SpectatorSet> = {
  'ambiente-1': {
    key: 'spect-barrio',
    meta: BARRIO,
    h: 52, // ~1,5 escalones (cada escalón sube ~34 px de imagen)
    fps: 6,
    seats: [
      { row: 0, x: 410, y: 383, flip: false, every: [5000, 11000] }, // grada izquierda, escalón de abajo junto a la esquina: mira el partido
      { row: 1, x: 312, y: 406, flip: false, every: [4000, 9000] }, // grada izquierda, más afuera: sentada SOBRE el escalón de abajo (pies en su borde, y 333 de la imagen original de 1254)
      { row: 2, x: 1219, y: 409, flip: true, every: [10000, 20000] }, // grada derecha, sentado SOBRE el escalón de abajo más hacia la red (pies en su borde, x 995 / y 334 de la imagen de 1254): toma refresco de vez en cuando
    ],
  },
};

export function queueSpectators(load: Phaser.Loader.LoaderPlugin, ambiente: string) {
  const set = SETS[ambiente];
  if (set && !load.textureManager.exists(set.key)) load.spritesheet(set.key, set.meta.file, { frameWidth: set.meta.cell.w, frameHeight: set.meta.cell.h });
}

export function startSpectators(scene: Phaser.Scene, ambiente: string, img: { left: number; top: number; s: number }) {
  const set = SETS[ambiente];
  if (!set || !scene.textures.exists(set.key)) return;
  const { key, meta } = set;
  const scale = (set.h * img.s) / Math.max(...meta.heights);
  for (const seat of set.seats) {
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
    const next = () =>
      scene.time.delayedCall(Phaser.Math.Between(seat.every[0], seat.every[1]), () => {
        if (!scene.sys.isActive() || !spr.active) return;
        spr.play(anim);
        next();
      });
    next();
  }
}
