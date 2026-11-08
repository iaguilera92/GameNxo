import Phaser from 'phaser';
import { FONT } from '../ui/theme';

/**
 * Presentación corta al empezar el partido (≤ 2 s en total), SOBRE el mismo mapa:
 *   0.00 s  la pantalla aparece desde negro, oscurecida, con la cámara LEJOS (zoom out) y algo alta
 *   0.00–1.20 s  la cámara se acerca a su encuadre de juego
 *   0.70 s  "INICIO" + "¡COMIENZA EL PARTIDO!" con destello
 *   1.20–1.65 s  se aclara la pantalla y vuelven HUD y controles
 *   1.80 s  `onDone` (empieza el primer punto)
 *
 * Solo visual: no toca reglas, puntuación, físicas ni IA.
 */
export const INTRO = {
  /** zoom inicial (más bajo deja ver el borde del fondo; la viñeta tapa el resto) */
  zoomFrom: 0.72,
  /** desplazamiento vertical inicial de la cámara (px de mundo; positivo = mira más abajo, oculta el borde superior) */
  liftFrom: 130,
  /** viñeta superior (y de mundo): opaca hasta aquí y se desvanece hasta vigFadeTo */
  vigSolidTo: -60,
  vigFadeTo: 300,
  vigBottomFrom: 1250,
  vigBottomSolid: 1560,
  zoomMs: 1200,
  dark: 0.55,
  textAt: 700,
  textOutAt: 1500,
  revealAt: 1200,
  revealMs: 450,
  totalMs: 1800,
};

export function playMatchIntro(scene: Phaser.Scene, onDone: () => void) {
  const cam = scene.cameras.main;
  const W = scene.scale.width;
  const H = scene.scale.height;

  // HUD y controles (todo lo fijo en pantalla) ocultos hasta el final de la presentación
  const hud: { obj: Phaser.GameObjects.GameObject & { alpha: number }; a: number }[] = [];
  for (const obj of scene.children.list) {
    const o = obj as Phaser.GameObjects.GameObject & { scrollFactorX?: number; alpha?: number };
    if (o.scrollFactorX === 0 && typeof o.alpha === 'number') {
      const e = o as Phaser.GameObjects.GameObject & { alpha: number };
      hud.push({ obj: e, a: e.alpha });
      e.alpha = 0;
    }
  }

  // cámara: de lejos y un poco alta → encuadre normal
  const baseY = cam.scrollY;
  cam.setZoom(INTRO.zoomFrom);
  cam.scrollY = baseY + INTRO.liftFrom;
  cam.fadeIn(220, 0, 0, 0);
  scene.tweens.add({ targets: cam, zoom: 1, scrollY: baseY, duration: INTRO.zoomMs, ease: 'Cubic.easeInOut' });

  // oscurecido (cubre de sobra aunque la cámara esté alejada)
  const dim = scene.add
    .rectangle(W / 2, H / 2, (W / INTRO.zoomFrom) * 1.2, (H / INTRO.zoomFrom) * 1.2, 0x02060f, INTRO.dark)
    .setScrollFactor(0)
    .setDepth(8000);
  // viñeta superior EN EL MUNDO: oscurece el cielo y esconde el borde del fondo mientras la cámara está lejos
  const vig = scene.add.graphics().setDepth(8000);
  vig.fillStyle(0x02060f, 1).fillRect(-2000, -2000, 5000, 2000 + INTRO.vigSolidTo);
  vig.fillGradientStyle(0x02060f, 0x02060f, 0x02060f, 0x02060f, 1, 1, 0, 0).fillRect(-2000, INTRO.vigSolidTo, 5000, INTRO.vigFadeTo - INTRO.vigSolidTo);
  // y abajo (bajo la cancha termina el fondo)
  vig.fillGradientStyle(0x02060f, 0x02060f, 0x02060f, 0x02060f, 0, 0, 1, 1).fillRect(-2000, INTRO.vigBottomFrom, 5000, INTRO.vigBottomSolid - INTRO.vigBottomFrom);
  vig.fillStyle(0x02060f, 1).fillRect(-2000, INTRO.vigBottomSolid, 5000, 2000);

  // texto INICIO
  const cy = H * 0.4;
  const c = scene.add.container(W / 2, cy).setScrollFactor(0).setDepth(8001).setAlpha(0);
  const streak = scene.add.rectangle(0, 6, W * 0.9, 8, 0x8fd8ff, 0.9).setBlendMode(Phaser.BlendModes.ADD).setScale(0, 1);
  const title = scene.add
    .text(0, -8, 'INICIO', { fontFamily: FONT, fontSize: '104px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 12 })
    .setOrigin(0.5)
    .setLetterSpacing(6)
    .setShadow(0, 8, '#000000', 0, true, false);
  const grad = title.context.createLinearGradient(0, 0, 0, title.height);
  grad.addColorStop(0.2, '#ffffff');
  grad.addColorStop(0.6, '#bfe6ff');
  grad.addColorStop(0.95, '#4fa6ff');
  title.setFill(grad);
  if (title.width > W - 60) title.setScale((W - 60) / title.width);
  const sub = scene.add
    .text(0, 66, '¡COMIENZA EL PARTIDO!', { fontFamily: FONT, fontSize: '28px', color: '#ffd23f', stroke: '#0a1638', strokeThickness: 6 })
    .setOrigin(0.5)
    .setLetterSpacing(2);
  c.add([streak, title, sub]);
  const titleScale = title.scale;

  scene.time.delayedCall(INTRO.textAt, () => {
    c.setAlpha(1);
    title.setScale(titleScale * 1.8).setAlpha(0);
    sub.setAlpha(0).setY(86);
    scene.tweens.add({ targets: title, scale: titleScale, alpha: 1, duration: 260, ease: 'Back.easeOut' });
    scene.tweens.add({ targets: streak, scaleX: 1, duration: 300, ease: 'Cubic.easeOut' });
    scene.tweens.add({ targets: sub, alpha: 1, y: 66, duration: 240, delay: 120, ease: 'Quad.easeOut' });
    cam.flash(120, 120, 180, 255);
  });
  scene.time.delayedCall(INTRO.textOutAt, () => {
    scene.tweens.add({ targets: c, alpha: 0, scale: 1.12, duration: 260, ease: 'Quad.easeIn', onComplete: () => c.destroy() });
  });

  // se aclara y vuelve la interfaz
  scene.time.delayedCall(INTRO.revealAt, () => {
    scene.tweens.add({ targets: dim, alpha: 0, duration: INTRO.revealMs, onComplete: () => dim.destroy() });
    scene.tweens.add({ targets: vig, alpha: 0, duration: INTRO.revealMs, onComplete: () => vig.destroy() });
    for (const h of hud) scene.tweens.add({ targets: h.obj, alpha: h.a, duration: INTRO.revealMs });
  });

  scene.time.delayedCall(INTRO.totalMs, () => {
    cam.setZoom(1);
    cam.scrollY = baseY;
    onDone();
  });
}
