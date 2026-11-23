import Phaser from 'phaser';
import { FONT } from '../ui/theme';

/**
 * Presentación al empezar el partido, sobre el mismo mapa:
 *   0.00–0.45 s  ambiente en una vista lejana, centrada en la cancha
 *   0.45–2.40 s  los personajes caminan mientras la cámara se acerca al encuadre de juego
 *   0.95 s       aparecen "INICIO" + "¡COMIENZA EL PARTIDO!" con destello
 *   2.20 s       se aclara la pantalla y vuelven HUD y controles
 *   2.60 s       `onDone` empieza el primer punto
 *
 * Solo visual: no toca reglas, puntuación, físicas ni IA.
 */
export const INTRO = {
  /** vista lejana intermedia: deja ver el ambiente alrededor, pero no todo su ancho */
  zoomFrom: 0.72,
  /** relativo al zoom de juego (VIEW.CAM_ZOOM): la cámara termina EXACTAMENTE en el encuadre de juego (sin salto) */
  /** desplazamiento vertical inicial de la cámara (px de mundo; positivo = mira más abajo, oculta el borde superior) */
  // (21-11-2026, usuario) SIN elevación: el mapa ya no empieza abajo y sube; arranca LEJOS y QUIETO y solo se acerca (zoom)
  liftFrom: 0,
  /** viñeta superior (y de mundo): opaca hasta aquí y se desvanece hasta vigFadeTo */
  vigSolidTo: -60,
  vigFadeTo: 300,
  vigBottomFrom: 1250,
  vigBottomSolid: 1560,
  /** duración de la vista completa inicial; después empiezan juntos el zoom y la caminata */
  holdMs: 450,
  zoomMs: 1950,
  dark: 0.32,
  textAt: 950,
  textOutAt: 2250,
  revealAt: 2200,
  revealMs: 400,
  totalMs: 2600,
};

export function playMatchIntro(scene: Phaser.Scene, footer: number, onDone: () => void) {
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

  // Phaser centra con scrollX = centroX - width/2, independientemente del zoom.
  // Mantener ese punto fijo evita que el ambiente entre desde un costado al empezar.
  const baseX = cam.scrollX;
  const baseY = cam.scrollY;
  const baseZoom = cam.zoom; // zoom de juego (no 1): antes terminaba en 1 y al empezar saltaba al real
  const zoomFrom = baseZoom * INTRO.zoomFrom;
  const centerX = baseX + cam.width / 2;
  const centerY = baseY + cam.height / 2;
  cam.setZoom(zoomFrom);
  cam.centerOn(centerX, centerY + INTRO.liftFrom);
  cam.fadeIn(220, 0, 0, 0);
  // Solo cambia el zoom: el centro horizontal queda fijo desde el primer fotograma.
  const approach = { t: 0 };
  scene.tweens.add({
    targets: approach,
    t: 1,
    delay: INTRO.holdMs,
    duration: INTRO.zoomMs,
    ease: 'Sine.easeInOut',
    onUpdate: () => {
      const z = Phaser.Math.Linear(zoomFrom, baseZoom, approach.t);
      cam.setZoom(z);
      cam.centerOn(centerX, centerY + INTRO.liftFrom * (1 - approach.t));
    },
    onComplete: () => {
      cam.setZoom(baseZoom);
      cam.setScroll(baseX, baseY);
    },
  });

  // oscurecido (cubre de sobra aunque la cámara esté alejada)
  const dim = scene.add
    .rectangle(W / 2, H / 2, (W / INTRO.zoomFrom) * 2, (H / INTRO.zoomFrom) * 2, 0x02060f, INTRO.dark)
    .setScrollFactor(0)
    .setDepth(8000);
  // viñeta superior EN EL MUNDO: oscurece el cielo y esconde el borde del fondo mientras la cámara está lejos
  const vig = scene.add.graphics().setDepth(8000);
  vig.fillStyle(0x02060f, 1).fillRect(-2000, -2000, 5000, 2000 + INTRO.vigSolidTo);
  vig.fillGradientStyle(0x02060f, 0x02060f, 0x02060f, 0x02060f, 1, 1, 0, 0).fillRect(-2000, INTRO.vigSolidTo, 5000, INTRO.vigFadeTo - INTRO.vigSolidTo);
  // y abajo (bajo la cancha termina el fondo): (21-11-2026, usuario) del MISMO color que el ambiente (el del pie, tras los botones) que se va oscureciendo
  // hacia abajo, sin llegar al negro
  const foot = Phaser.Display.Color.IntegerToColor(footer); // (22-11-2026) el pie del ambiente (SHARED_FOOTER o el suyo)
  const footDark = Phaser.Display.Color.GetColor(Math.round(foot.red * 0.5), Math.round(foot.green * 0.5), Math.round(foot.blue * 0.5));
  vig.fillGradientStyle(footer, footer, footDark, footDark, 0, 0, 1, 1).fillRect(-2000, INTRO.vigBottomFrom, 5000, INTRO.vigBottomSolid - INTRO.vigBottomFrom);
  vig.fillStyle(footDark, 1).fillRect(-2000, INTRO.vigBottomSolid, 5000, 2000);

  // texto INICIO
  const cy = H * 0.4;
  const c = scene.add.container(W / 2, cy).setScrollFactor(0).setDepth(8001).setAlpha(0);
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
  // rayas a los LADOS del texto ( — INICIO — ), sin atravesarlo; crecen hacia fuera
  const gap = 22;
  const half = title.displayWidth / 2 + gap;
  const lineW = Math.max(30, W * 0.45 - half);
  const lineL = scene.add.rectangle(-half, -8, lineW, 8, 0x8fd8ff, 0.9).setOrigin(1, 0.5).setBlendMode(Phaser.BlendModes.ADD).setScale(0, 1);
  const lineR = scene.add.rectangle(half, -8, lineW, 8, 0x8fd8ff, 0.9).setOrigin(0, 0.5).setBlendMode(Phaser.BlendModes.ADD).setScale(0, 1);
  const sub = scene.add
    .text(0, 66, '¡COMIENZA EL PARTIDO!', { fontFamily: FONT, fontSize: '28px', color: '#ffd23f', stroke: '#0a1638', strokeThickness: 6 })
    .setOrigin(0.5)
    .setLetterSpacing(2);
  c.add([lineL, lineR, title, sub]);
  const titleScale = title.scale;

  scene.time.delayedCall(INTRO.textAt, () => {
    c.setAlpha(1);
    title.setScale(titleScale * 1.8).setAlpha(0);
    sub.setAlpha(0).setY(86);
    scene.tweens.add({ targets: title, scale: titleScale, alpha: 1, duration: 260, ease: 'Back.easeOut' });
    scene.tweens.add({ targets: [lineL, lineR], scaleX: 1, duration: 300, ease: 'Cubic.easeOut' });
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
    cam.setZoom(baseZoom);
    cam.scrollY = baseY;
    onDone();
  });
}
