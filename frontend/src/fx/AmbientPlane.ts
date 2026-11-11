import Phaser from 'phaser';

/**
 * AVIÓN del ambiente (solo decoración): cruza el cielo del estadio, por encima de la valla del fondo, una vez por partido.
 * Entra por un lado de la pantalla y sale por el otro (sentido al azar), subiendo un poco y alejándose: los 8 frames de
 * la hoja lo van achicando a lo largo del cruce. No interactúa con nada del juego.
 *
 * Hoja: public/assets/ambiente/avion.png (tools/build-paloma.mjs avion), 8 x 1 celdas de 135 x 362, mirando a la derecha.
 * Cuándo sale lo decide MatchScene (launchAmbient: paloma y avión en orden al azar, con 30 s entre uno y otro).
 */
const KEY = 'ambiente-avion';
const FILE = 'assets/ambiente/avion.png';
const CELL = { w: 135, h: 362 };
const FRAMES = 8;

export const PLANE = {
  /** duración del cruce (ms) */
  crossMs: 9000,
  /** tamaño al entrar (escala de la celda) */
  scale: 0.55,
  /** cuánto sube durante el cruce (px) */
  climb: 50,
  /** profundidad: encima de la imagen del ambiente (-20) y de su degradado (-19), debajo de la cancha (-10) */
  depth: -18,
};

export function queueAmbientPlane(load: Phaser.Loader.LoaderPlugin) {
  if (!load.textureManager.exists(KEY)) load.spritesheet(KEY, FILE, { frameWidth: CELL.w, frameHeight: CELL.h });
}

/**
 * Lanza el avión a la altura `y` (mundo de la escena), cruzando de `fromX` a `toX` (bordes de lo visible). Pruebas:
 * localStorage 'dev.avion' = 'ltr' | 'rtl' | 'off'.
 */
export function spawnAmbientPlane(scene: Phaser.Scene, y: number, leftX: number, rightX: number) {
  if (!scene.textures.exists(KEY)) return;
  let forced: string | null = null;
  try {
    forced = localStorage.getItem('dev.avion');
  } catch {
    /* sin almacenamiento */
  }
  if (forced === 'off') return;
  const ltr = forced === 'ltr' ? true : forced === 'rtl' ? false : Math.random() < 0.5;
  const from = ltr ? leftX - 120 : rightX + 120;
  const to = ltr ? rightX + 120 : leftX - 120;
  const plane = scene.add.sprite(from, y, KEY, 0).setScale(PLANE.scale).setDepth(PLANE.depth).setFlipX(!ltr);
  const t = { p: 0 };
  scene.tweens.add({
    targets: t,
    p: 1,
    duration: PLANE.crossMs,
    ease: 'Linear',
    onUpdate: () => {
      if (!plane.active) return;
      plane.setPosition(from + (to - from) * t.p, y - PLANE.climb * t.p);
      // se aleja: los frames lo achican de a poco a lo largo del cruce
      plane.setFrame(Math.min(FRAMES - 1, Math.floor(t.p * FRAMES)));
    },
    onComplete: () => plane.destroy(),
  });
}
