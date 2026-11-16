import Phaser from 'phaser';
import { FONT } from './theme';
import { fitText } from './fitText';
import { roundedPoly } from './shapes';
import { friendsRepository, openFriendsDialog } from './FriendsDialog';

/**
 * Botón AMIGOS del menú principal: misma forma que DIARIO y GLOBAL (paralelogramo inclinado, icono arriba y texto abajo). Abre la ventana de amigos
 * (ui/FriendsDialog.ts). Un punto rojo avisa si hay solicitudes pendientes. (21-11-2026: antes estaba apagado, con candado.)
 */
export function friendsButton(scene: Phaser.Scene, x: number, y: number, onToast: (m: string) => void, w = 76, h = 76) {
  const c = scene.add.container(x, y).setDepth(50);
  const k = 14 * (h / 136) + 4;
  const shape = roundedPoly([[-w / 2 + k, -h / 2], [w / 2, -h / 2], [w / 2 - k, h / 2], [-w / 2, h / 2]], 14);
  const line = 0x3a7bff;
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.35).fillPoints(shape.map((p) => ({ x: p.x + 4, y: p.y + 7 })), true);
  g.lineStyle(10, line, 0.22).strokePoints(shape, true, true);
  g.fillStyle(0x0b1733, 0.94).fillPoints(shape, true);
  g.fillStyle(0x1b2d5c, 0.55).fillPoints(shape.filter((p) => p.y < 0).map((p) => ({ x: p.x * 0.97, y: p.y * 0.96 })), true);
  g.lineStyle(3, line, 1).strokePoints(shape, true, true);
  g.lineStyle(2, 0xffffff, 0.22).lineBetween(-w / 2 + k + 12, -h / 2 + 4, w / 2 - 12, -h / 2 + 4);

  // icono: dos personas (una detrás de la otra)
  const s = Math.min(1, h / 84);
  const ic = scene.add.graphics({ y: -h * 0.14 });
  ic.fillStyle(0x4aa8ff, 1).fillCircle(9 * s, -8 * s, 6 * s).fillRoundedRect(0, -1 * s, 18 * s, 14 * s, { tl: 9 * s, tr: 9 * s, bl: 3, br: 3 });
  ic.fillStyle(0x9fe2ff, 1).fillCircle(-5 * s, -6 * s, 7 * s).fillRoundedRect(-15 * s, 3 * s, 20 * s, 15 * s, { tl: 10 * s, tr: 10 * s, bl: 3, br: 3 });

  const t = scene.add.text(0, h / 2 - 15, 'AMIGOS', { fontFamily: FONT, fontSize: '17px', color: '#ffffff' }).setOrigin(0.5);
  fitText(t, w - 14, 0.55); // se achica antes que cortarse

  c.add([g, ic, t]);
  // punto rojo: solicitudes pendientes
  if (friendsRepository().load().requests.length > 0) {
    const b = scene.add.graphics({ x: w / 2 - 14, y: -h / 2 + 12 });
    b.fillStyle(0x0a1638, 1).fillCircle(0, 0, 11).fillStyle(0xff3b4f, 1).fillCircle(0, 0, 8);
    c.add(b);
  }
  c.setSize(w, h).setInteractive({ useHandCursor: true });
  c.on('pointerup', () => {
    scene.tweens.add({ targets: c, scale: { from: 0.94, to: 1 }, duration: 200, ease: 'Back.easeOut' });
    openFriendsDialog(scene, onToast);
  });
  return c;
}