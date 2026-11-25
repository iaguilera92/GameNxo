import type Phaser from 'phaser';
import { FONT } from './theme';

/** mano que indica dónde tocar (assets/ui/guide-click.webp; original en _temp/respaldo_oficial/ui/click.png) */
const HAND = { key: 'guide-click', file: 'assets/ui/guide-click.webp', tipX: 0.255, tipY: 0.185, width: 130 };

/** La mano tocando en (x, y), en su propio contenedor (p. ej. el primer partido: "toca el lado derecho"). Destruir el contenedor la quita. */
export function tapHint(scene: Phaser.Scene, x: number, y: number, depth: number) {
  const root = scene.add.container(0, 0).setDepth(depth).setScrollFactor(0);
  if (scene.textures.exists(HAND.key)) tapHand(scene, root, x, y);
  else {
    scene.load.image(HAND.key, HAND.file);
    scene.load.once('complete', () => tapHand(scene, root, x, y));
    scene.load.start();
  }
  return root;
}

/** (25-11-2026, usuario) la mano DESLIZANDO de (x0, y) a (x1, y), una y otra vez (p. ej. "desliza para ver" la demostración). */
export function swipeHint(scene: Phaser.Scene, x0: number, x1: number, y: number, depth: number) {
  const root = scene.add.container(0, 0).setDepth(depth).setScrollFactor(0);
  const start = () => {
    if (!root.active) return;
    const hand = scene.add.image(x0, y, HAND.key).setOrigin(HAND.tipX, HAND.tipY);
    hand.setScale(HAND.width / hand.width);
    const trail = scene.add.graphics();
    root.add([trail, hand]);
    const loop = () => {
      if (!hand.active) return;
      hand.setPosition(x0, y).setAlpha(0);
      trail.clear();
      scene.tweens.add({ targets: hand, alpha: 1, duration: 200, onComplete: () => {
        if (!hand.active) return;
        scene.tweens.add({
          targets: hand, x: x1, duration: 700, ease: 'Sine.easeInOut',
          onUpdate: () => trail.clear().lineStyle(4, 0xffd23f, 0.25).lineBetween(x0, y, hand.x, y),
          onComplete: () => scene.tweens.add({ targets: [hand, trail], alpha: 0, delay: 150, duration: 250, onComplete: () => { trail.setAlpha(1); scene.time.delayedCall(250, loop); } }),
        });
      } });
    };
    loop();
  };
  if (scene.textures.exists(HAND.key)) start();
  else {
    scene.load.image(HAND.key, HAND.file);
    scene.load.once('complete', start);
    scene.load.start();
  }
  return root;
}

/** La mano, abajo a la derecha del control, apuntando a él, con un toque que se repite (baja, aprieta y suelta un anillo). */
function tapHand(scene: Phaser.Scene, root: Phaser.GameObjects.Container, x: number, y: number) {
  if (!root.active) return;
  const hand = scene.add.image(x, y, HAND.key).setOrigin(HAND.tipX, HAND.tipY);
  hand.setScale(HAND.width / hand.width);
  const s = hand.scale;
  const ring = scene.add.circle(x, y, 18).setStrokeStyle(5, 0xffd23f).setFillStyle(0xffffff, 0.25).setAlpha(0);
  root.add([ring, hand]);
  const tap = () => {
    if (!hand.active) return;
    hand.setPosition(x + 26, y + 26).setScale(s);
    scene.tweens.add({
      targets: hand, x, y, duration: 320, ease: 'Sine.easeOut',
      onComplete: () => {
        if (!hand.active) return;
        scene.tweens.add({ targets: hand, scale: s * 0.86, duration: 110, yoyo: true, ease: 'Quad.easeOut' });
        ring.setScale(0.4).setAlpha(1);
        scene.tweens.add({ targets: ring, scale: 2.4, alpha: 0, duration: 520, ease: 'Quad.easeOut' });
        scene.time.delayedCall(800, tap);
      },
    });
  };
  tap();
}

/** Mantiene visible y accesible solo el siguiente control del tutorial. */
export function guideFocus(scene: Phaser.Scene, target: { x: number; y: number; w: number; h: number }, message: string, opts: { textDy?: number; hand?: boolean; centerText?: boolean } = {}) {
  const { width, height } = scene.scale;
  const left = Math.max(0, target.x - target.w / 2 - 6);
  const right = Math.min(width, target.x + target.w / 2 + 6);
  const top = Math.max(0, target.y - target.h / 2 - 6);
  const bottom = Math.min(height, target.y + target.h / 2 + 6);
  const root = scene.add.container(0, 0).setDepth(8100).setScrollFactor(0);
  for (const [x, y, w, h] of [[0, 0, width, top], [0, bottom, width, height - bottom], [0, top, left, bottom - top], [right, top, width - right, bottom - top]]) {
    if (w > 0 && h > 0) root.add(scene.add.rectangle(x, y, w, h, 0x03091a, 0.72).setOrigin(0).setInteractive());
  }
  root.add(scene.add.graphics().lineStyle(4, 0xffd23f).strokeRoundedRect(left, top, right - left, bottom - top, 16));
  const textY = top > 95 ? top - 46 : bottom + 46 + (opts.textDy ?? 0);
  // el texto, centrado sobre el control que hay que tocar (sin salirse de la pantalla)
  const label = scene.add.text(target.x, textY, message, {
    fontFamily: FONT, fontSize: '32px', color: '#fff3bb', stroke: '#071332', strokeThickness: 7,
    align: 'center', wordWrap: { width: width - 40 },
  }).setOrigin(0.5);
  label.x = opts.centerText ? width / 2 : Math.max(20 + label.width / 2, Math.min(width - 20 - label.width / 2, target.x));
  root.add(label);
  // la punta del dedo, sobre la esquina de abajo a la derecha del control (un poco adentro)
  const hx = Math.min(width - 110, right - Math.min(40, (right - left) * 0.2));
  const hy = bottom - Math.min(26, (bottom - top) * 0.25);
  if (opts.hand === false) return root;
  if (scene.textures.exists(HAND.key)) tapHand(scene, root, hx, hy);
  else {
    scene.load.image(HAND.key, HAND.file);
    scene.load.once('complete', () => tapHand(scene, root, hx, hy));
    scene.load.start();
  }
  return root;
}
