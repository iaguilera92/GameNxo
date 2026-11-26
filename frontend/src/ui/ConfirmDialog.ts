import Phaser from 'phaser';
import { FONT } from './theme';
import { arcadeButton } from './modeButtons';

/**
 * Diálogo de confirmación con el estilo del menú (azul marino, borde neón, botones arcade).
 * - Botón de confirmar (rojo) y de cancelar (amarillo, el seguro).
 * - `lockSeconds`: el botón de confirmar empieza bloqueado con cuenta atrás y se habilita al llegar a 0.
 *   La cuenta usa tweens (siguen corriendo aunque la escena tenga `time.paused`).
 *
 * Devuelve los objetos creados: destruirlos todos cierra el diálogo (y detiene la cuenta).
 */
export interface ConfirmOpts {
  title: string;
  message: string;
  detail?: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  lockSeconds?: number;
  depth?: number;
  /** (24-11-2026) botones sin la sombra de color (pantalla de inicio) */
  noShadow?: boolean;
  /** (26-11-2026, usuario) dibujo sobre los botones (p. ej. el personaje elegido): alto extra del panel y cómo crearlo (pies en `feetY`) */
  artH?: number;
  /** (26-11-2026, usuario) insignia de arriba: bandera blanca (rendirse, por defecto) o una PELOTA de tenis que gira */
  badge?: 'flag' | 'ball';
  /** (26-11-2026, usuario) palabra del mensaje que va en AMARILLO (p. ej. "Tienda") */
  highlight?: string;
  art?: (x: number, feetY: number, h: number, w: number) => Phaser.GameObjects.GameObject | undefined;
}

const NAVY = 0x0b1733;
const NEON = 0x3a7bff;

export function showConfirm(scene: Phaser.Scene, o: ConfirmOpts): Phaser.GameObjects.GameObject[] {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const depth = o.depth ?? 8000;
  const pw = Math.min(600, W - 60);
  const artH = o.art ? (o.artH ?? 220) : 0;
  const ph = 380 + artH;
  const cy = Math.min(H * 0.45, 640 + artH / 2);

  // velo que bloquea los toques al juego
  const shade = scene.add.rectangle(0, 0, W, H, 0x02060f, 0.7).setOrigin(0).setScrollFactor(0).setDepth(depth).setInteractive();
  shade.setAlpha(0);
  scene.tweens.add({ targets: shade, alpha: 1, duration: 160 });

  // ---------------------------------------------------------------- panel
  const panel = scene.add.container(W / 2, cy).setScrollFactor(0).setDepth(depth + 1);
  const g = scene.add.graphics();
  const x = -pw / 2;
  const y = -ph / 2;
  g.fillStyle(0x000000, 0.45).fillRoundedRect(x + 4, y + 8, pw, ph, 26);
  g.lineStyle(12, NEON, 0.22).strokeRoundedRect(x, y, pw, ph, 26);
  g.fillStyle(0x0a1638, 1).fillRoundedRect(x - 4, y - 4, pw + 8, ph + 8, 29);
  g.fillStyle(NAVY, 0.97).fillRoundedRect(x, y, pw, ph, 26);
  g.fillStyle(0x1b2d5c, 0.55).fillRoundedRect(x + 4, y + 4, pw - 8, 116, { tl: 22, tr: 22, bl: 0, br: 0 }); // (26-11-2026, usuario) cabecera más alta (96 -> 116)
  g.lineStyle(3, NEON, 1).strokeRoundedRect(x, y, pw, ph, 26);
  g.lineStyle(1.5, 0xffc42e, 0.45).strokeRoundedRect(x + 8, y + 8, pw - 16, ph - 16, 20);
  panel.add(g);

  // insignia con bandera blanca, montada sobre el borde superior (o la PELOTA de tenis girando)
  if (o.badge === 'ball') {
    const ring = scene.add.graphics({ x: 0, y });
    ring.fillStyle(0x0a1638, 1).fillCircle(0, 0, 48);
    ring.lineStyle(3, NEON, 1).strokeCircle(0, 0, 46);
    const ball = scene.add.graphics({ x: 0, y });
    ball.fillStyle(0xc9e83a, 1).fillCircle(0, 0, 38);
    ball.fillStyle(0xe6ff6a, 0.6).fillCircle(-8, -10, 22);
    ball.lineStyle(5, 0xffffff, 1);
    ball.beginPath().arc(-38, 0, 30, -1.05, 1.05, false).strokePath();
    ball.beginPath().arc(38, 0, 30, Math.PI - 1.05, Math.PI + 1.05, false).strokePath();
    ball.lineStyle(2, 0x7a9a10, 0.6).strokeCircle(0, 0, 38);
    panel.add([ring, ball]);
    scene.tweens.add({ targets: ball, angle: 360, duration: 2400, repeat: -1 });
  }
  const badge = scene.add.graphics({ x: 0, y }).setVisible(o.badge !== 'ball');
  badge.fillStyle(0x0a1638, 1).fillCircle(0, 0, 48);
  badge.fillStyle(0xc42536, 1).fillCircle(0, 2, 42);
  badge.fillStyle(0xff4f5e, 1).fillCircle(0, -2, 40);
  badge.fillStyle(0xffffff, 0.25).fillEllipse(-8, -20, 40, 14);
  badge.lineStyle(3, NEON, 1).strokeCircle(0, 0, 46);
  badge.fillStyle(0x0a1638).fillRoundedRect(-14, -24, 8, 48, 3); // mástil
  badge.fillStyle(0xe8ecf6).fillRect(-12, -22, 4, 44);
  badge.fillStyle(0x0a1638).fillPoints([{ x: -8, y: -25 }, { x: 22, y: -18 }, { x: 16, y: -8 }, { x: 23, y: 2 }, { x: -8, y: -1 }], true);
  badge.fillStyle(0xffffff).fillPoints([{ x: -6, y: -21 }, { x: 16, y: -16 }, { x: 11, y: -8 }, { x: 17, y: -2 }, { x: -6, y: -4 }], true);
  panel.add(badge);

  panel.add(scene.add.text(0, y + 72, o.title, /* (26-11-2026, usuario) centrado en la cabecera (un poco mas abajo) */ { fontFamily: FONT, fontSize: '42px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 6 }).setOrigin(0.5).setLetterSpacing(2));
  const msgStyle = { fontFamily: FONT, fontSize: '24px', color: '#dbe5ff', align: 'center', wordWrap: { width: pw - 70 } };
  const msg = scene.add.text(0, y + 182, o.message, msgStyle).setOrigin(0.5);
  panel.add(msg);
  if (o.highlight) {
    // la palabra en amarillo, encima de la suya (mismo tipo de letra: calza exacto)
    const lines = msg.getWrappedText();
    const li = lines.findIndex((l) => l.includes(o.highlight!));
    if (li >= 0) {
      const line = lines[li];
      const measure = scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: '24px' }).setVisible(false);
      const lw = measure.setText(line).width;
      const pre = measure.setText(line.slice(0, line.indexOf(o.highlight))).width;
      measure.destroy();
      const lh = msg.height / lines.length;
      panel.add(scene.add.text(-lw / 2 + pre, msg.y - msg.height / 2 + lh * li + lh / 2, o.highlight, { fontFamily: FONT, fontSize: '24px', color: '#ffd23f' }).setOrigin(0, 0.5));
    }
  }
  if (o.detail) panel.add(scene.add.text(0, y + 209, o.detail, { fontFamily: FONT, fontSize: '19px', color: '#ff9aa3' }).setOrigin(0.5));
  if (o.art) {
    // entre el texto y los botones, centrado en ese hueco
    const a = o.art(0, y + ph - 158, artH - 30, pw); // (26-11-2026, usuario) más arriba: no choca con los botones
    if (a) panel.add(a);
  }

  panel.setScale(0.7).setAlpha(0);
  scene.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });

  // ---------------------------------------------------------------- botones
  const bw = (pw - 70) / 2;
  const bh = 84;
  const by = cy + ph / 2 - 76;
  const leftX = W / 2 - bw / 2 - 12;
  const rightX = W / 2 + bw / 2 + 12;
  const objs: Phaser.GameObjects.GameObject[] = [shade, panel];
  // (26-11-2026, usuario) los botones aparecen JUNTO con el panel (antes salían primero ellos y luego el diálogo)
  const fix = (c: Phaser.GameObjects.Container) => {
    c.setScrollFactor(0).setDepth(depth + 2).setAlpha(0);
    scene.tweens.add({ targets: c, alpha: 1, delay: 120, duration: 220 });
    return c;
  };

  const cancel = fix(arcadeButton(scene, rightX, by, bw, bh, o.cancelLabel, o.onCancel, { palette: 'yellow', noShadow: o.noShadow }));
  objs.push(cancel);

  const makeConfirm = () => fix(arcadeButton(scene, leftX, by, bw, bh, o.confirmLabel, o.onConfirm, { palette: 'red', noShadow: o.noShadow }));
  const lock = Math.max(0, Math.floor(o.lockSeconds ?? 0));
  if (!lock) {
    objs.push(makeConfirm());
    return objs;
  }

  // confirmar bloqueado: botón gris con cuenta atrás + barra de progreso; al terminar se cambia por el rojo
  const locked = fix(arcadeButton(scene, leftX, by, bw, bh, `${o.confirmLabel} ${lock}`, () => undefined, { palette: 'grey', disabled: true }));
  const label = locked.getData('label') as Phaser.GameObjects.Text;
  const bar = scene.add.graphics().setScrollFactor(0).setDepth(depth + 3);
  const barW = bw * 0.62;
  const barX = leftX - barW / 2 - 6;
  const barY = by + bh / 2 + 14;
  const drawBar = (p: number) => {
    bar.clear();
    bar.fillStyle(0x0a1638, 1).fillRoundedRect(barX, barY, barW, 8, 4);
    bar.fillStyle(0xff4f5e, 1).fillRoundedRect(barX, barY, Math.max(8, barW * p), 8, 4);
  };
  drawBar(0);
  objs.push(locked, bar);

  let shown = lock;
  const counter = scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: lock * 1000,
    onUpdate: (tw) => {
      const p = tw.getValue() ?? 0;
      drawBar(p);
      const left = Math.max(1, Math.ceil(lock * (1 - p)));
      if (left !== shown) {
        shown = left;
        label.setText(`${o.confirmLabel} ${left}`);
        scene.tweens.add({ targets: label, scale: { from: label.scale * 1.25, to: label.scale }, duration: 200, ease: 'Back.easeOut' });
      }
    },
    onComplete: () => {
      if (!locked.active) return;
      locked.setVisible(false);
      bar.setVisible(false);
      const btn = makeConfirm();
      objs.push(btn); // por si se cierra desde fuera usando la lista
      scene.tweens.add({ targets: btn, scale: { from: 0.6, to: 1 }, duration: 320, ease: 'Back.easeOut' });
      // al destruir el gris (cierre del diálogo), también el rojo
      locked.once(Phaser.GameObjects.Events.DESTROY, () => btn.destroy());
    },
  });
  panel.once(Phaser.GameObjects.Events.DESTROY, () => counter.stop());
  return objs;
}
