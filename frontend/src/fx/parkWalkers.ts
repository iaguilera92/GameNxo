import Phaser from 'phaser';
import META from '../view/paseantes-parque.json';

/**
 * (19-11-2026, usuario) PASEANTES del mapa del 2v2 (PARQUE, `ambiente-1-2v2`): 4 personajes (señora con perro, niño con pelota, chico
 * trotando, chica con raqueta) que cruzan de vez en cuando por el CAMINO DE TIERRA del fondo, detrás del muro. Solo decoración (no tocan
 * el partido). Hoja: tools/build-paseantes.mjs → public/assets/ambientes/paseantes-parque.webp (4 filas × 6 cuadros, todos hacia la derecha).
 * Posiciones en px de la IMAGEN del ambiente (1536 × 1024); `img` dice dónde se dibujó (CourtView.drawCourtView). Cruzan de un borde de la imagen
 * al otro por el PASEO de detrás del muro (19-11-2026: la imagen se rehízo con ese paseo despejado).
 */
const KEY = 'park-walkers';
const PATH = {
  /**
   * (19-11-2026, usuario) pies sobre el PASEO que cruza toda la imagen detrás del muro (vereda de y 274 a ~312): en y 284 quedan por encima
   * de las rejas de los costados (empiezan en y ~287), así se ven enteros de un borde al otro
   */
  feetY: 284,
  /** tramo que recorren: de fuera de la imagen por un lado a fuera por el otro (sin desaparecer) */
  x0: -70,
  x1: 1606,
  /** alto de un adulto en px de la imagen (las bancas miden ~45) */
  adultH: 62,
};
/** por fila: velocidad (px de imagen por s) y cuadros por segundo de su ciclo */
const WALKERS = [
  { speed: 30, fps: 7 }, // señora con perro
  { speed: 36, fps: 8 }, // niño con pelota
  { speed: 66, fps: 12 }, // chico trotando
  { speed: 38, fps: 8 }, // chica con raqueta
];
const MAX_AT_ONCE = 2;

export function queueParkWalkers(load: Phaser.Loader.LoaderPlugin) {
  if (!load.textureManager.exists(KEY)) load.spritesheet(KEY, META.file, { frameWidth: META.cell.w, frameHeight: META.cell.h });
}

/** Empieza los paseos (llamar una vez al dibujar el ambiente del parque). `img` = esquina de arriba a la izquierda y escala de la imagen. */
export function startParkWalkers(scene: Phaser.Scene, img: { left: number; top: number; s: number }) {
  if (!scene.textures.exists(KEY)) return;
  for (let r = 0; r < META.rows; r++) {
    const k = `${KEY}-${r}`;
    if (!scene.anims.exists(k)) {
      scene.anims.create({ key: k, frames: scene.anims.generateFrameNumbers(KEY, { start: r * META.frames, end: r * META.frames + META.frames - 1 }), frameRate: WALKERS[r].fps, repeat: -1 });
    }
  }
  const busy = new Set<number>();
  const X = (x: number) => img.left + x * img.s;
  const feetY = img.top + PATH.feetY * img.s;
  // escala: el más alto de la hoja mide adultH px de imagen (el resto, en proporción)
  const scale = (PATH.adultH * img.s) / Math.max(...META.heights);

  const walk = () => {
    if (!scene.sys.isActive() || busy.size >= MAX_AT_ONCE) return;
    const free = WALKERS.map((_, i) => i).filter((i) => !busy.has(i));
    const row = free[Math.floor(Math.random() * free.length)];
    busy.add(row);
    const W = WALKERS[row];
    const right = Math.random() < 0.5;
    const from = right ? PATH.x0 : PATH.x1;
    const to = right ? PATH.x1 : PATH.x0;
    const spr = scene.add
      .sprite(X(from), feetY + META.feetPad * scale, KEY, row * META.frames)
      .setOrigin(0.5, 1)
      .setScale(scale)
      .setFlipX(!right) // la hoja mira a la derecha
      .setDepth(-19.5) // sobre la imagen del ambiente y bajo la cancha
      .setAlpha(0);
    spr.play({ key: `${KEY}-${row}`, startFrame: Math.floor(Math.random() * META.frames) });
    const ms = (Math.abs(to - from) / W.speed) * 1000;
    spr.setAlpha(1); // entran y salen caminando por los bordes de la imagen (los costados oscuros la tapan)
    scene.tweens.add({ targets: spr, x: X(to), duration: ms, ease: 'Linear', onComplete: () => {
      busy.delete(row);
      spr.destroy();
    } });
  };
  // el primero pronto; luego cada 5-10 s (como mucho 2 a la vez)
  const next = (ms: number) =>
    scene.time.delayedCall(ms, () => {
      walk();
      next(Phaser.Math.Between(5000, 10000));
    });
  next(1500);
}
