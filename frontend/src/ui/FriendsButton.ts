import Phaser from 'phaser';
import { FONT } from './theme';
import { roundedPoly } from './shapes';

/**
 * Botón AMIGOS del menú principal: misma forma que DIARIO (paralelogramo inclinado, icono arriba y texto abajo) pero
 * apagado y con candado, porque la sección aún no existe. Al tocarlo solo avisa que llega pronto.
 */
export function friendsButton(scene: Phaser.Scene, x: number, y: number, onToast: (m: string) => void, w = 76, h = 76) {
  const c = scene.add.container(x, y).setDepth(50);
  const k = 14 * (h / 136) + 4;
  const shape = roundedPoly([[-w / 2 + k, -h / 2], [w / 2, -h / 2], [w / 2 - k, h / 2], [-w / 2, h / 2]], 14);
  // paleta de "bloqueado" (la misma de MenuScene.sideButton con locked = true)
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.35).fillPoints(shape.map((p) => ({ x: p.x + 4, y: p.y + 7 })), true);
  g.fillStyle(0x0a1226, 0.9).fillPoints(shape, true);
  g.fillStyle(0x141f3a, 0.55).fillPoints(shape.filter((p) => p.y < 0).map((p) => ({ x: p.x * 0.97, y: p.y * 0.96 })), true);
  g.lineStyle(3, 0x2c3d66, 0.8).strokePoints(shape, true, true);
  g.lineStyle(2, 0xffffff, 0.08).lineBetween(-w / 2 + k + 12, -h / 2 + 4, w / 2 - 12, -h / 2 + 4);

  // icono: dos personas (una detrás de la otra)
  const col = 0x8391b3;
  const s = Math.min(1, h / 84);
  const ic = scene.add.graphics({ y: -h * 0.14 });
  ic.fillStyle(0x5d6b8c, 1).fillCircle(9 * s, -8 * s, 6 * s).fillRoundedRect(0, -1 * s, 18 * s, 14 * s, { tl: 9 * s, tr: 9 * s, bl: 3, br: 3 });
  ic.fillStyle(col, 1).fillCircle(-5 * s, -6 * s, 7 * s).fillRoundedRect(-15 * s, 3 * s, 20 * s, 15 * s, { tl: 10 * s, tr: 10 * s, bl: 3, br: 3 });

  const t = scene.add.text(0, h / 2 - 15, 'AMIGOS', { fontFamily: FONT, fontSize: '17px', color: '#9aa6c4' }).setOrigin(0.5);

  // candado en la esquina superior derecha
  const lk = scene.add.graphics({ x: w / 2 - 14, y: -h / 2 + 12 });
  lk.fillStyle(0x16223f, 1).fillCircle(0, 0, 12).lineStyle(2, 0x2c3d66, 1).strokeCircle(0, 0, 12);
  lk.lineStyle(3, 0xb7c2de).beginPath().arc(0, -1, 4.5, Math.PI, 0).strokePath();
  lk.fillStyle(0xb7c2de).fillRoundedRect(-6, -1, 12, 9, 2);

  c.add([g, ic, t, lk]);
  c.setSize(w, h).setInteractive({ useHandCursor: true });
  c.on('pointerup', () => {
    scene.tweens.add({ targets: c, scale: { from: 0.94, to: 1 }, duration: 200, ease: 'Back.easeOut' });
    onToast('AMIGOS llega pronto');
  });
  return c;
}
