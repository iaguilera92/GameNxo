import Phaser from 'phaser';
import { FONT } from '../ui/theme';
import { drawWarningIcon } from '../ui/icons';

/**
 * Aviso lateral: entra desde la IZQUIERDA, se queda un momento y sale por la izquierda
 * (DOBLE FALTA, FUERA, IGUALES, PUNTO DE PARTIDO, 2º SERVICIO, LET, AL AIRE, TIEMPO…). Varios a la vez se apilan hacia
 * abajo. Es el ÚNICO estilo de avisos del partido: fondo negro y borde del color (igual que la cuenta atrás del saque).
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

/** (21-11-2026, usuario) la placa nace EXT px fuera de la pantalla a la izquierda y SIN borde ni franja de color ahí: parece venir de más allá del borde y no queda hueco sin fondo. */
const EXT = 40;

/**
 * Huecos ocupados (0 = arriba, 1 = debajo…): cada aviso toma el PRIMER hueco libre y lo suelta al irse. (Antes un
 * contador: si se iba el de arriba, el siguiente caía encima del de abajo, p. ej. de "SACA EN 5".)
 */
const used = new Set<number>();
let resetHooked: Phaser.Scene | null = null;
function takeSlot(scene: Phaser.Scene): number {
  if (resetHooked !== scene) {
    // la escena se reutiliza entre partidos: al cerrarse, todos los huecos quedan libres
    resetHooked = scene;
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      used.clear();
      resetHooked = null;
    });
  }
  let i = 0;
  while (used.has(i)) i++;
  used.add(i);
  return i;
}
const slotY = (i: number) => NOTICE.y + i * (NOTICE.h + NOTICE.gap);

/** hueco extra a la izquierda del texto cuando el aviso lleva icono (px) */
const ICON_W = 36;

/** `icon: 'warning'` (21-11-2026): triángulo de advertencia a la izquierda del texto (p. ej. RAQUETA). */
export function showSideNotice(scene: Phaser.Scene, text: string, color = 0xffd23f, ms = 1600, icon?: 'warning') {
  const h = NOTICE.h;
  const s = NOTICE.slant;
  const slot = takeSlot(scene);
  const y = slotY(slot);
  const extra = icon ? ICON_W : 0;
  const t = scene.add.text(NOTICE.textX + extra, 0, text.toUpperCase(), { fontFamily: FONT, fontSize: `${NOTICE.font}px`, color: '#ffffff', stroke: '#0a1638', strokeThickness: 4 }).setOrigin(0, 0.5).setLetterSpacing(2);
  const maxW = scene.scale.width - NOTICE.rightClear;
  if (t.width + NOTICE.padW + extra > maxW) t.setScale((maxW - NOTICE.padW - extra) / t.width); // texto largo: se encoge para no tapar el botón de emotes
  const w = t.displayWidth + NOTICE.padW + extra;
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.35).fillPoints([{ x: -EXT, y: -h / 2 + 4 }, { x: w + 4, y: -h / 2 + 4 }, { x: w - s + 4, y: h / 2 + 4 }, { x: -EXT, y: h / 2 + 4 }], true);
  // ESTILO ÚNICO de los avisos laterales (13-11-2026): el de la cuenta atrás del saque, fondo negro y borde del color
  g.fillStyle(0x000000, 0.95).fillPoints([{ x: -EXT, y: -h / 2 }, { x: w, y: -h / 2 }, { x: w - s, y: h / 2 }, { x: -EXT, y: h / 2 }], true);
  g.lineStyle(3, color, 1).lineBetween(-EXT, -h / 2, w, -h / 2).lineBetween(w, -h / 2, w - s, h / 2).lineBetween(w - s, h / 2, -EXT, h / 2);
  const c = scene.add.container(-w - 20, y, [g, t]).setScrollFactor(0).setDepth(6060);
  if (icon) {
    const ig = scene.add.graphics({ x: NOTICE.textX + ICON_W / 2 - 4, y: 1 });
    drawWarningIcon(ig, 14, 0xffd23f);
    c.add(ig);
    scene.tweens.add({ targets: ig, scale: { from: 1.35, to: 1 }, duration: 320, delay: 200, ease: 'Back.easeOut' }); // latido al entrar
  }
  scene.tweens.add({ targets: c, x: 0, duration: 260, ease: 'Cubic.easeOut' });
  scene.tweens.add({
    targets: c,
    x: -w - 20,
    delay: ms,
    duration: 240,
    ease: 'Cubic.easeIn',
    onComplete: () => {
      c.destroy();
      used.delete(slot);
    },
  });
  return c;
}

/**
 * (21-11-2026, usuario) Aviso de la VELOCIDAD DEL SAQUE: "SAQUE 182 KM/H" con el número (grande) y el borde del color de la fuerza (amarillo leve ·
 * verde bueno · rojo fuerte; config.ts SERVE_KMH). Mismo sitio y forma que los demás avisos laterales.
 */
export function showServeSpeedNotice(scene: Phaser.Scene, kmh: number, color: number, ms = 1900) {
  const h = NOTICE.h;
  const s = NOTICE.slant;
  const slot = takeSlot(scene);
  const y = slotY(slot);
  const hex = '#' + color.toString(16).padStart(6, '0');
  const style = (size: number, col: string, stroke = 4) => ({ fontFamily: FONT, fontSize: `${size}px`, color: col, stroke: '#0a1638', strokeThickness: stroke });
  // (21-11-2026, usuario) los tres textos del MISMO tamaño y en la misma línea (el número lleva el color de la fuerza; los otros, blancos)
  const FS = 28;
  const t1 = scene.add.text(NOTICE.textX, 0, 'SAQUE', style(FS, '#ffffff', 5)).setOrigin(0, 0.5).setLetterSpacing(2);
  const t2 = scene.add.text(t1.x + t1.width + 12, 0, String(kmh), style(FS, hex, 5)).setOrigin(0, 0.5);
  const t3 = scene.add.text(t2.x + t2.width + 10, 0, 'KM/H', style(FS, '#ffffff', 5)).setOrigin(0, 0.5).setLetterSpacing(1);
  const w = Math.round(t3.x + t3.width + 30);
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.35).fillPoints([{ x: -EXT, y: -h / 2 + 4 }, { x: w + 4, y: -h / 2 + 4 }, { x: w - s + 4, y: h / 2 + 4 }, { x: -EXT, y: h / 2 + 4 }], true);
  g.fillStyle(0x000000, 0.95).fillPoints([{ x: -EXT, y: -h / 2 }, { x: w, y: -h / 2 }, { x: w - s, y: h / 2 }, { x: -EXT, y: h / 2 }], true);
  g.lineStyle(3, color, 1).lineBetween(-EXT, -h / 2, w, -h / 2).lineBetween(w, -h / 2, w - s, h / 2).lineBetween(w - s, h / 2, -EXT, h / 2);
  const c = scene.add.container(-w - 20, y, [g, t1, t2, t3]).setScrollFactor(0).setDepth(6060);
  scene.tweens.add({ targets: c, x: 0, duration: 260, ease: 'Cubic.easeOut' });
  scene.tweens.add({ targets: t2, scale: { from: 1.5, to: 1 }, duration: 380, delay: 200, ease: 'Back.easeOut' }); // el número "golpea" al entrar
  scene.tweens.add({
    targets: c,
    x: -w - 20,
    delay: ms,
    duration: 240,
    ease: 'Cubic.easeIn',
    onComplete: () => {
      c.destroy();
      used.delete(slot);
    },
  });
  return c;
}

/**
 * Cuenta atrás del saque en el aviso lateral (mismo sitio y forma que DOBLE FALTA…): "SACA EN 5" con fondo negro y
 * borde naranja; en el 3 el borde pasa a rojo y en el 1 todo rojo (fondo y borde). Se queda mientras dura la cuenta.
 */
export interface ServeCountdown {
  show(n: number): void;
  hide(): void;
  /** se acabó el tiempo: el mismo aviso dice `text` (TIEMPO) todo en rojo, late y se va */
  final(text: string): void;
}

export function createServeCountdown(scene: Phaser.Scene, format = (n: number) => `SACA EN ${n}`): ServeCountdown {
  let c: Phaser.GameObjects.Container | null = null;
  let g: Phaser.GameObjects.Graphics | null = null;
  let t: Phaser.GameObjects.Text | null = null;
  let cur = -1;
  let leaving = false;
  let slot = -1;
  let width = 260;
  const h = NOTICE.h;
  const s = NOTICE.slant;
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    c = null;
    slot = -1;
  });
  const draw = (n: number, label?: string) => {
    if (!g || !t) return;
    t.setText(label ?? format(n)).setScale(1);
    const w = width = t.width + NOTICE.padW;
    const line = n <= 3 ? 0xff1f2e : 0xff9a1f; // 5-4 naranja · 3-1 rojo
    const fill = n <= 1 ? 0xe0182a : 0x000000; // 1: todo rojo
    g.clear();
    g.fillStyle(0x000000, 0.35).fillPoints([{ x: -EXT, y: -h / 2 + 4 }, { x: w + 4, y: -h / 2 + 4 }, { x: w - s + 4, y: h / 2 + 4 }, { x: -EXT, y: h / 2 + 4 }], true);
    g.fillStyle(fill, 0.95).fillPoints([{ x: -EXT, y: -h / 2 }, { x: w, y: -h / 2 }, { x: w - s, y: h / 2 }, { x: -EXT, y: h / 2 }], true);
    g.lineStyle(3, line, 1).lineBetween(-EXT, -h / 2, w, -h / 2).lineBetween(w, -h / 2, w - s, h / 2).lineBetween(w - s, h / 2, -EXT, h / 2);
  };
  return {
    show(n: number) {
      if (n === cur && c && !leaving) return;
      if (!c || leaving) {
        c?.destroy();
        leaving = false;
        t = scene.add.text(NOTICE.textX, 0, '', { fontFamily: FONT, fontSize: `${NOTICE.font}px`, color: '#ffffff', stroke: '#0a1638', strokeThickness: 4 }).setOrigin(0, 0.5).setLetterSpacing(2);
        g = scene.add.graphics();
        // primer hueco libre (si hay otro aviso arriba, va debajo; los que lleguen después, debajo de este)
        if (slot >= 0) used.delete(slot);
        slot = takeSlot(scene);
        c = scene.add.container(-scene.scale.width, slotY(slot), [g, t]).setScrollFactor(0).setDepth(6061);
        scene.tweens.add({ targets: c, x: 0, duration: 220, ease: 'Cubic.easeOut' });
      }
      cur = n;
      draw(n);
      // latido en cada número
      if (t) {
        scene.tweens.killTweensOf(t);
        scene.tweens.add({ targets: t, scale: { from: 1.25, to: 1 }, duration: 260, ease: 'Back.easeOut' });
      }
    },
    final(text: string) {
      this.show(1); // (si no estaba, entra) y queda todo en rojo
      cur = -2;
      draw(1, text);
      if (t) {
        scene.tweens.killTweensOf(t);
        scene.tweens.add({ targets: t, scale: { from: 1.35, to: 1 }, duration: 300, ease: 'Back.easeOut' });
      }
      scene.time.delayedCall(950, () => this.hide());
    },
    hide() {
      if (!c || leaving) return;
      leaving = true;
      cur = -1;
      const box = c;
      scene.tweens.add({
        targets: box,
        x: -width - 20,
        duration: 200,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          box.destroy();
          if (c === box) {
            c = null;
            used.delete(slot);
            slot = -1;
          }
        },
      });
    },
  };
}
