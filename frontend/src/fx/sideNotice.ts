import Phaser from 'phaser';
import { FONT } from '../ui/theme';
import { VIEW } from '../view/projection';

/**
 * Aviso lateral: entra desde la IZQUIERDA, se queda un momento y sale por la izquierda
 * (DOBLE FALTA, FUERA, IGUALES, PUNTO DE PARTIDO…). Varios a la vez se apilan hacia abajo.
 * Fijo en pantalla (scrollFactor 0 → cámara de interfaz).
 */
let stack = 0;
export function showSideNotice(scene: Phaser.Scene, text: string, color = 0xffd23f, ms = 1600) {
  const H = scene.scale.height;
  // justo DEBAJO de las franjas del marcador (centradas en 42 % del alto, ±100 px): antes caía encima de ellas
  const y = Math.min(H, VIEW.H) * 0.42 + 100 + 40 + stack * 66;
  stack++;
  const t = scene.add.text(26, 0, text.toUpperCase(), { fontFamily: FONT, fontSize: '28px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 5 }).setOrigin(0, 0.5).setLetterSpacing(2);
  const maxW = scene.scale.width - 60;
  if (t.width + 60 > maxW) t.setScale((maxW - 60) / t.width); // texto largo: se encoge para no salirse de la pantalla
  const w = t.displayWidth + 60;
  const h = 54;
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.35).fillPoints([{ x: 0, y: -h / 2 + 5 }, { x: w + 4, y: -h / 2 + 5 }, { x: w - 14 + 4, y: h / 2 + 5 }, { x: 0, y: h / 2 + 5 }], true);
  g.fillStyle(0x0b1733, 0.95).fillPoints([{ x: 0, y: -h / 2 }, { x: w, y: -h / 2 }, { x: w - 14, y: h / 2 }, { x: 0, y: h / 2 }], true);
  g.fillStyle(color, 1).fillRect(0, -h / 2, 10, h);
  g.lineStyle(3, color, 1).lineBetween(0, -h / 2, w, -h / 2).lineBetween(w, -h / 2, w - 14, h / 2).lineBetween(w - 14, h / 2, 0, h / 2);
  const c = scene.add.container(-w - 20, y, [g, t]).setScrollFactor(0).setDepth(6060);
  scene.tweens.add({ targets: c, x: 0, duration: 260, ease: 'Cubic.easeOut' });
  scene.tweens.add({
    targets: c,
    x: -w - 20,
    delay: ms,
    duration: 240,
    ease: 'Cubic.easeIn',
    onComplete: () => {
      c.destroy();
      stack = Math.max(0, stack - 1);
    },
  });
  if (stack === 1) scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => (stack = 0)); // una sola escucha por tanda
  return c;
}
