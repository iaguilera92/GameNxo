import Phaser from 'phaser';
import { FONT } from '../ui/theme';

/**
 * Aviso lateral: entra desde la IZQUIERDA, se queda un momento y sale por la izquierda
 * (DOBLE FALTA, FUERA, IGUALES, PUNTO DE PARTIDO…). Varios a la vez se apilan hacia abajo.
 * Fijo en pantalla (scrollFactor 0 → cámara de interfaz).
 */
const NOTICE = {
  /**
   * Altura del centro del aviso: la misma que el botón de emotes, pero pegado al borde izquierdo.
   * Si se mueve ese botón (MatchScene.layout: `emotes.setPosition(W - 46, 226)`), cambiar también aquí.
   */
  y: 226,
  font: 24, // antes 28
  h: 46, // alto de la placa (antes 54)
  textX: 22, // margen izquierdo del texto (antes 26)
  padW: 50, // ancho de la placa = texto + padW (antes 60)
  slant: 12, // corte inclinado del lado derecho (antes 14)
  bar: 8, // franja de color del borde izquierdo (antes 10)
  gap: 10, // separación entre avisos apilados
  /** el aviso nunca llega al botón de emotes (centro a 46 px del borde derecho, radio ~36) */
  rightClear: 100,
};

let stack = 0;
export function showSideNotice(scene: Phaser.Scene, text: string, color = 0xffd23f, ms = 1600) {
  const h = NOTICE.h;
  const s = NOTICE.slant;
  const y = NOTICE.y + stack * (h + NOTICE.gap);
  stack++;
  const t = scene.add.text(NOTICE.textX, 0, text.toUpperCase(), { fontFamily: FONT, fontSize: `${NOTICE.font}px`, color: '#ffffff', stroke: '#0a1638', strokeThickness: 4 }).setOrigin(0, 0.5).setLetterSpacing(2);
  const maxW = scene.scale.width - NOTICE.rightClear;
  if (t.width + NOTICE.padW > maxW) t.setScale((maxW - NOTICE.padW) / t.width); // texto largo: se encoge para no tapar el botón de emotes
  const w = t.displayWidth + NOTICE.padW;
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.35).fillPoints([{ x: 0, y: -h / 2 + 4 }, { x: w + 4, y: -h / 2 + 4 }, { x: w - s + 4, y: h / 2 + 4 }, { x: 0, y: h / 2 + 4 }], true);
  g.fillStyle(0x0b1733, 0.95).fillPoints([{ x: 0, y: -h / 2 }, { x: w, y: -h / 2 }, { x: w - s, y: h / 2 }, { x: 0, y: h / 2 }], true);
  g.fillStyle(color, 1).fillRect(0, -h / 2, NOTICE.bar, h);
  g.lineStyle(3, color, 1).lineBetween(0, -h / 2, w, -h / 2).lineBetween(w, -h / 2, w - s, h / 2).lineBetween(w - s, h / 2, 0, h / 2);
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

/**
 * Cuenta atrás del saque en el aviso lateral (mismo sitio y forma que DOBLE FALTA…): "SACA EN 5" con fondo negro y
 * borde naranja; en el 3 el borde pasa a rojo y en el 1 todo rojo (fondo y borde). Se queda mientras dura la cuenta.
 */
export interface ServeCountdown {
  show(n: number): void;
  hide(): void;
}

export function createServeCountdown(scene: Phaser.Scene): ServeCountdown {
  let c: Phaser.GameObjects.Container | null = null;
  let g: Phaser.GameObjects.Graphics | null = null;
  let t: Phaser.GameObjects.Text | null = null;
  let cur = -1;
  let leaving = false;
  const h = NOTICE.h;
  const s = NOTICE.slant;
  // la escena se reutiliza entre partidos: al cerrarse, la pila de avisos vuelve a cero
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    c = null;
    stack = 0;
  });
  const draw = (n: number) => {
    if (!g || !t) return;
    t.setText(`SACA EN ${n}`);
    const w = t.displayWidth + NOTICE.padW;
    const line = n <= 3 ? 0xff1f2e : 0xff9a1f; // 5-4 naranja · 3-1 rojo
    const fill = n <= 1 ? 0xe0182a : 0x000000; // 1: todo rojo
    g.clear();
    g.fillStyle(0x000000, 0.35).fillPoints([{ x: 0, y: -h / 2 + 4 }, { x: w + 4, y: -h / 2 + 4 }, { x: w - s + 4, y: h / 2 + 4 }, { x: 0, y: h / 2 + 4 }], true);
    g.fillStyle(fill, 0.95).fillPoints([{ x: 0, y: -h / 2 }, { x: w, y: -h / 2 }, { x: w - s, y: h / 2 }, { x: 0, y: h / 2 }], true);
    g.fillStyle(line, 1).fillRect(0, -h / 2, NOTICE.bar, h);
    g.lineStyle(3, line, 1).lineBetween(0, -h / 2, w, -h / 2).lineBetween(w, -h / 2, w - s, h / 2).lineBetween(w - s, h / 2, 0, h / 2);
  };
  return {
    show(n: number) {
      if (n === cur && c && !leaving) return;
      if (!c || leaving) {
        c?.destroy();
        leaving = false;
        t = scene.add.text(NOTICE.textX, 0, '', { fontFamily: FONT, fontSize: `${NOTICE.font}px`, color: '#ffffff', stroke: '#0a1638', strokeThickness: 4 }).setOrigin(0, 0.5).setLetterSpacing(2);
        g = scene.add.graphics();
        c = scene.add.container(-260, NOTICE.y, [g, t]).setScrollFactor(0).setDepth(6061);
        scene.tweens.add({ targets: c, x: 0, duration: 220, ease: 'Cubic.easeOut' });
        stack++; // los demás avisos se apilan debajo mientras se ve
      }
      cur = n;
      draw(n);
      // latido en cada número
      if (t) {
        scene.tweens.killTweensOf(t);
        scene.tweens.add({ targets: t, scale: { from: 1.25, to: 1 }, duration: 260, ease: 'Back.easeOut' });
      }
    },
    hide() {
      if (!c || leaving) return;
      leaving = true;
      cur = -1;
      const box = c;
      scene.tweens.add({
        targets: box,
        x: -260,
        duration: 200,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          box.destroy();
          if (c === box) c = null;
          stack = Math.max(0, stack - 1);
        },
      });
    },
  };
}
