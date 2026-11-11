import Phaser from 'phaser';

/**
 * PALOMA del ambiente (solo decoración): da vida al estadio al empezar el partido.
 *
 * Una vez por partido, al principio: llega volando desde fuera de la pantalla, se posa en una orilla del ambiente
 * (sobre el muro del fondo, lejos de la cancha), se queda ~5 s caminando y picoteando y se va volando por el mismo lado.
 * El lado (izquierda / derecha) se sortea en cada partido. No interactúa con nada del juego.
 *
 * Hoja: public/assets/ambiente/paloma.png (tools/build-paloma.mjs), 8 x 3 celdas de 135 x 120, mirando a la derecha:
 *   fila 0  suelo (quieta / camina / picotea)   fila 1  despegue (al revés = aterrizaje)   fila 2  vuelo
 */
const KEY = 'ambiente-paloma';
const FILE = 'assets/ambiente/paloma.png';
const CELL = { w: 135, h: 120 };
const COLS = 8;

export const BIRD = {
  /** espera desde que empieza la escena hasta que llega (ms) */
  delayMs: 900,
  /** tiempo posada (ms) */
  stayMs: 5000,
  /** duración del vuelo de llegada / salida (ms) */
  flyInMs: 1600,
  flyOutMs: 1800,
  /** tamaño en pantalla (escala de la celda) */
  scale: 0.42,
  /** profundidad: encima de la imagen del ambiente (-20/-19), debajo de la cancha (-10) */
  depth: -15,
};

export function queueAmbientBird(load: Phaser.Loader.LoaderPlugin) {
  if (!load.textureManager.exists(KEY)) load.spritesheet(KEY, FILE, { frameWidth: CELL.w, frameHeight: CELL.h });
}

function ensureAnims(scene: Phaser.Scene) {
  const row = (r: number) => Array.from({ length: COLS }, (_, i) => ({ key: KEY, frame: r * COLS + i }));
  if (!scene.anims.exists('paloma-idle')) scene.anims.create({ key: 'paloma-idle', frames: row(0), frameRate: 7, repeat: -1, yoyo: true });
  if (!scene.anims.exists('paloma-takeoff')) scene.anims.create({ key: 'paloma-takeoff', frames: row(1), frameRate: 16, repeat: 0 });
  if (!scene.anims.exists('paloma-land')) scene.anims.create({ key: 'paloma-land', frames: row(1).slice(2).reverse(), frameRate: 16, repeat: 0 });
  if (!scene.anims.exists('paloma-fly')) scene.anims.create({ key: 'paloma-fly', frames: row(2), frameRate: 16, repeat: -1 });
}

/**
 * Lanza la paloma. `perch` = dónde se posa a cada lado (coordenadas de mundo de la escena); `side` opcional para pruebas
 * (localStorage 'dev.paloma' = 'left' | 'right' | 'off').
 */
export function spawnAmbientBird(scene: Phaser.Scene, perch: { left: { x: number; y: number }; right: { x: number; y: number } }) {
  if (!scene.textures.exists(KEY)) return;
  let forced: string | null = null;
  try {
    forced = localStorage.getItem('dev.paloma');
  } catch {
    /* sin almacenamiento */
  }
  if (forced === 'off') return;
  const side: 'left' | 'right' = forced === 'left' || forced === 'right' ? forced : Math.random() < 0.5 ? 'left' : 'right';
  ensureAnims(scene);
  const p = perch[side];
  const out = side === 'left' ? -1 : 1; // hacia dónde queda el borde de la pantalla
  // fuera de la pantalla, más alto que el muro
  const off = { x: p.x + out * 420, y: p.y - 260 };
  const bird = scene.add.sprite(off.x, off.y, KEY, 2 * COLS).setScale(BIRD.scale).setOrigin(0.5, 0.85).setDepth(BIRD.depth);
  // la hoja mira a la derecha: llegando desde la izquierda mira a la derecha (hacia el estadio) y al revés
  bird.setFlipX(side === 'right');
  bird.play('paloma-fly');

  scene.time.delayedCall(BIRD.delayMs, () => {
    if (!bird.active) return;
    scene.tweens.add({
      targets: bird,
      x: p.x,
      y: p.y,
      duration: BIRD.flyInMs,
      ease: 'Sine.easeOut',
      onComplete: () => {
        if (!bird.active) return;
        bird.play('paloma-land');
        bird.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
          if (!bird.active) return;
          bird.play('paloma-idle');
          // da algún pasito mientras está posada (sin acercarse a la cancha)
          scene.tweens.add({ targets: bird, x: p.x - out * 14, duration: 1400, delay: 900, yoyo: true, ease: 'Sine.easeInOut' });
          scene.time.delayedCall(BIRD.stayMs, () => leave(scene, bird, out, p));
        });
      },
    });
  });
}

function leave(scene: Phaser.Scene, bird: Phaser.GameObjects.Sprite, out: number, p: { x: number; y: number }) {
  if (!bird.active) return;
  scene.tweens.killTweensOf(bird);
  // se gira hacia su borde y despega
  bird.setFlipX(out < 0);
  bird.play('paloma-takeoff');
  bird.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
    if (!bird.active) return;
    bird.play('paloma-fly');
    scene.tweens.add({
      targets: bird,
      x: p.x + out * 460,
      y: p.y - 320,
      duration: BIRD.flyOutMs,
      ease: 'Sine.easeIn',
      onComplete: () => bird.destroy(),
    });
  });
}
