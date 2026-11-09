import Phaser from 'phaser';
import { textStyle } from './theme';

/**
 * Identidad visual compartida de Nxo Tennis (pantallas previas al partido).
 * Azul marino base, azul eléctrico / cyan de acento, dorado para acciones.
 * Paneles oscuros translúcidos con borde fino. Nada de relieves "de plástico".
 */
export const UI = {
  navy: 0x07122e,
  navy2: 0x0a1838,
  panel: 0x0a1838,
  line: 0x2f6fe0,
  electric: 0x3a8bff,
  cyan: 0x37e0ff,
  gold: 0xffc42e,
  goldDark: 0xd99400,
  white: 0xffffff,
  text: '#ffffff',
  textDim: '#9fc0ff',
};

/** Fondo de estadio nocturno (imagen) + velo marino para contraste de la UI. */
export function stadiumBg(scene: Phaser.Scene, veil = 0.3) {
  const W = scene.scale.width;
  const H = scene.scale.height;
  if (scene.textures.exists('menu-bg')) {
    const bg = scene.add.image(W / 2, H / 2, 'menu-bg');
    bg.setScale(Math.max(W / bg.width, H / bg.height)).setScrollFactor(0);
  } else {
    scene.add.rectangle(0, 0, W, H, UI.navy).setOrigin(0);
  }
  scene.add.rectangle(0, 0, W, H, UI.navy, veil).setOrigin(0);
}

/** Panel oscuro translúcido con borde fino (base de todas las tarjetas). */
export function panel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { radius?: number; fill?: number; alpha?: number; line?: number; lineAlpha?: number; lineW?: number } = {},
) {
  const { radius = 18, fill = UI.panel, alpha = 0.82, line = UI.line, lineAlpha = 0.9, lineW = 2 } = opts;
  const g = scene.add.graphics();
  g.fillStyle(fill, alpha).fillRoundedRect(x, y, w, h, radius);
  g.lineStyle(lineW, line, lineAlpha).strokeRoundedRect(x, y, w, h, radius);
  return g;
}

/**
 * Botón plano moderno (sin relieve). `primary` lo pinta dorado; si no, panel oscuro con borde.
 * Devuelve un contenedor interactivo con animación de pulsación sobria.
 */
export function flatButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
  opts: { primary?: boolean; fontSize?: number } = {},
) {
  const { primary = false, fontSize = Math.round(h * 0.42) } = opts;
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const r = Math.min(16, h / 2);
  if (primary) {
    g.fillStyle(UI.goldDark, 1).fillRoundedRect(-w / 2, -h / 2 + 3, w, h, r);
    g.fillStyle(UI.gold, 1).fillRoundedRect(-w / 2, -h / 2, w, h, r);
  } else {
    g.fillStyle(UI.panel, 0.9).fillRoundedRect(-w / 2, -h / 2, w, h, r);
    g.lineStyle(2, UI.line, 0.95).strokeRoundedRect(-w / 2, -h / 2, w, h, r);
  }
  c.add(g);
  const col = primary ? '#1a1033' : '#ffffff';
  c.add(scene.add.text(0, 0, label, textStyle(fontSize, col)).setOrigin(0.5));
  c.setSize(w, h).setInteractive({ useHandCursor: true });
  c.on('pointerdown', () => scene.tweens.add({ targets: c, scale: 0.95, duration: 80 }));
  const up = () => scene.tweens.add({ targets: c, scale: 1, duration: 140, ease: 'Quad.easeOut' });
  c.on('pointerup', () => {
    up();
    onClick();
  });
  c.on('pointerout', up);
  return c;
}

/** Candado pequeño dorado (para elementos "próximamente"). */
export function lockBadge(scene: Phaser.Scene, x: number, y: number) {
  const g = scene.add.graphics({ x, y });
  g.fillStyle(UI.gold).fillRoundedRect(-8, -1, 16, 12, 3);
  g.lineStyle(3, UI.gold).strokeCircle(0, -3, 5.5);
  return g;
}
