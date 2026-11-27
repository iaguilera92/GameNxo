import Phaser from 'phaser';
import { FONT } from './theme';
import { uiSound } from '../fx/uiSound';
import type { AuthProvider } from '../domain/account';

/**
 * (27-11-2026, usuario) Botones de INICIAR SESIÓN / VINCULAR CUENTA: FACEBOOK, GOOGLE y uno partido en dos (APPLE | GOOGLE PLAY). Los usan
 * la pantalla INICIAR SESIÓN (scenes/LoginScene.ts) y el diálogo VINCULAR CUENTA de AJUSTES. Iconos dibujados por código (sin imágenes).
 * Devuelven un contenedor centrado en (cx, cy); `onTap(proveedor)` al tocar.
 */
const NAVY = 0x0a1638;

function tapZone(scene: Phaser.Scene, c: Phaser.GameObjects.Container, x: number, w: number, h: number, onTap: () => void) {
  const z = scene.add.zone(x, 0, w, h).setInteractive({ useHandCursor: true });
  z.on('pointerdown', () => scene.tweens.add({ targets: c, scale: 0.97, duration: 70, yoyo: true }));
  z.on('pointerup', () => {
    uiSound(scene, 'tap');
    onTap();
  });
  c.add(z);
}

/** FACEBOOK o GOOGLE: píldora del color de la marca, icono a la izquierda y el nombre centrado. */
export function providerButton(scene: Phaser.Scene, cx: number, cy: number, w: number, h: number, provider: 'facebook' | 'google', onTap: (p: AuthProvider) => void) {
  const fb = provider === 'facebook';
  const c = scene.add.container(cx, cy);
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.35).fillRoundedRect(-w / 2 + 3, -h / 2 + 5, w, h, h / 2);
  g.fillStyle(fb ? 0x1877f2 : 0xffffff, 1).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  g.lineStyle(3, NAVY, 0.9).strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  if (fb) facebookIcon(g, -w / 2 + 52, 0);
  else googleIcon(g, -w / 2 + 52, 0);
  c.add(g);
  c.add(scene.add.text(18, 0, fb ? 'FACEBOOK' : 'GOOGLE', { fontFamily: FONT, fontSize: '30px', color: fb ? '#ffffff' : '#3c4043' }).setOrigin(0.5).setLetterSpacing(2));
  tapZone(scene, c, 0, w, h, () => onTap(provider));
  return c;
}

/** Un solo botón partido en dos: APPLE (negro) a la izquierda y GOOGLE PLAY (verde oscuro) a la derecha. */
export function splitAppleplayButton(scene: Phaser.Scene, cx: number, cy: number, w: number, h: number, onTap: (p: AuthProvider) => void) {
  const r = h / 2;
  const c = scene.add.container(cx, cy);
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.35).fillRoundedRect(-w / 2 + 3, -h / 2 + 5, w, h, r);
  g.fillStyle(0x111111, 1).fillRoundedRect(-w / 2, -h / 2, w / 2, h, { tl: r, bl: r, tr: 0, br: 0 });
  g.fillStyle(0x0f5132, 1).fillRoundedRect(0, -h / 2, w / 2, h, { tl: 0, bl: 0, tr: r, br: r });
  g.lineStyle(3, NAVY, 0.9).strokeRoundedRect(-w / 2, -h / 2, w, h, r);
  g.lineStyle(2, 0xffffff, 0.35).lineBetween(0, -h / 2 + 10, 0, h / 2 - 10);
  appleIcon(g, -w / 2 + 46, 0);
  playIcon(g, 40, 0);
  c.add(g);
  c.add(scene.add.text(-w / 4 + 18, 0, 'APPLE', { fontFamily: FONT, fontSize: '26px', color: '#ffffff' }).setOrigin(0.5).setLetterSpacing(1));
  const pt = scene.add.text(w / 4 + 22, 0, 'GOOGLE PLAY', { fontFamily: FONT, fontSize: '22px', color: '#ffffff' }).setOrigin(0.5);
  if (pt.width > w / 2 - 90) pt.setScale((w / 2 - 90) / pt.width);
  c.add(pt);
  tapZone(scene, c, -w / 4, w / 2, h, () => onTap('apple'));
  tapZone(scene, c, w / 4, w / 2, h, () => onTap('playgames'));
  return c;
}

/** Los tres botones apilados (FACEBOOK, GOOGLE, APPLE | GOOGLE PLAY) desde `top`; devuelve el borde de abajo. */
export function authButtons(scene: Phaser.Scene, parent: Phaser.GameObjects.Container | null, cx: number, top: number, w: number, onTap: (p: AuthProvider) => void, h = 84, gap = 22) {
  const list = [
    providerButton(scene, cx, top + h / 2, w, h, 'facebook', onTap),
    providerButton(scene, cx, top + h * 1.5 + gap, w, h, 'google', onTap),
    splitAppleplayButton(scene, cx, top + h * 2.5 + gap * 2, w, h, onTap),
  ];
  if (parent) parent.add(list);
  return top + h * 3 + gap * 2;
}

// ---------------------------------------------------------------- iconos
function facebookIcon(g: Phaser.GameObjects.Graphics, x: number, y: number) {
  g.fillStyle(0xffffff, 1).fillCircle(x, y, 22);
  g.fillStyle(0x1877f2, 1).fillRoundedRect(x - 3, y - 12, 8, 34, 2);
  g.fillRoundedRect(x - 3, y - 14, 16, 7, 3);
  g.fillRect(x - 9, y - 2, 20, 6);
}

function googleIcon(g: Phaser.GameObjects.Graphics, x: number, y: number) {
  const R = 19;
  const arc = (col: number, a0: number, a1: number) => {
    g.lineStyle(8, col, 1).beginPath().arc(x, y, R, Phaser.Math.DegToRad(a0), Phaser.Math.DegToRad(a1), false).strokePath();
  };
  arc(0xea4335, 200, 320);
  arc(0xfbbc05, 140, 200);
  arc(0x34a853, 40, 140);
  arc(0x4285f4, 320, 400);
  g.fillStyle(0x4285f4, 1).fillRect(x, y - 4, R + 4, 8);
}

function appleIcon(g: Phaser.GameObjects.Graphics, x: number, y: number) {
  g.fillStyle(0xffffff, 1);
  g.fillCircle(x - 7, y + 3, 12).fillCircle(x + 7, y + 3, 12).fillEllipse(x, y + 10, 30, 22);
  g.fillStyle(0x111111, 1).fillCircle(x + 17, y - 1, 6);
  g.fillStyle(0xffffff, 1).fillEllipse(x + 3, y - 15, 8, 12);
}

function playIcon(g: Phaser.GameObjects.Graphics, x: number, y: number) {
  g.fillStyle(0x00d7fe, 1).fillTriangle(x - 12, y - 18, x - 12, y, x + 6, y - 9);
  g.fillStyle(0xffce00, 1).fillTriangle(x + 6, y - 9, x - 12, y, x + 6, y + 9);
  g.fillStyle(0x00f076, 1).fillTriangle(x - 12, y - 18, x + 6, y - 9, x - 12, y);
  g.fillStyle(0xff3a44, 1).fillTriangle(x - 12, y, x + 6, y + 9, x - 12, y + 18);
}
