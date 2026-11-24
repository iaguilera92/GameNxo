import type Phaser from 'phaser';
import { FONT } from './theme';

/** Mantiene visible y accesible solo el siguiente control del tutorial. */
export function guideFocus(scene: Phaser.Scene, target: { x: number; y: number; w: number; h: number }, message: string) {
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
  const textY = top > 95 ? top - 46 : bottom + 46;
  root.add(scene.add.text(width / 2, textY, message, {
    fontFamily: FONT, fontSize: '26px', color: '#fff3bb', stroke: '#071332', strokeThickness: 6,
    align: 'center', wordWrap: { width: width - 40 },
  }).setOrigin(0.5));
  return root;
}
