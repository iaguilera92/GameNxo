import Phaser from 'phaser';

export const FONT = '"Lilita One", "Arial Black", sans-serif';

export const C = {
  outline: 0x1a1033,
  white: 0xffffff,
  yellow: 0xffcc2e,
  yellowDark: 0xd9860a,
  green: 0x62d935,
  greenDark: 0x2f9419,
  red: 0xff4f5e,
  redDark: 0xb3202f,
  blue: 0x3aa6ff,
  blueDark: 0x1b5fc2,
  purple: 0x9b5cff,
  purpleDark: 0x5a2db3,
  grey: 0x8a93a6,
  greyDark: 0x535b6e,
  skyTop: 0x3d8bff,
  skyBottom: 0x1c2f8f,
};

export function textStyle(size: number, color = '#ffffff'): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONT,
    fontSize: `${size}px`,
    color,
    stroke: '#1a1033',
    strokeThickness: Math.max(4, Math.round(size * 0.18)),
    shadow: { offsetX: 0, offsetY: Math.max(2, Math.round(size * 0.08)), color: '#1a1033', blur: 0, fill: true, stroke: true },
    align: 'center',
  };
}

/** Fondo con degradado + rayos tipo "sunburst". */
export function drawBackground(scene: Phaser.Scene, rays = true): Phaser.GameObjects.Container {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const cont = scene.add.container(0, 0);
  const g = scene.add.graphics();
  g.fillGradientStyle(C.skyTop, C.skyTop, C.skyBottom, C.skyBottom, 1);
  g.fillRect(0, 0, W, H);
  cont.add(g);
  if (rays) {
    const r = scene.add.graphics({ x: W / 2, y: H * 0.55 });
    r.fillStyle(0xffffff, 0.06);
    const n = 16;
    const len = Math.max(W, H) * 1.2;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = a0 + Math.PI / n;
      r.fillTriangle(0, 0, Math.cos(a0) * len, Math.sin(a0) * len, Math.cos(a1) * len, Math.sin(a1) * len);
    }
    scene.tweens.add({ targets: r, angle: 360, duration: 60000, repeat: -1 });
    cont.add(r);
  }
  return cont;
}

/** Reinicia la escena si cambia el tamaño de pantalla (p.ej. al entrar en pantalla completa). */
export function restartOnResize(scene: Phaser.Scene) {
  const handler = () => scene.scene.restart();
  scene.scale.on('resize', handler);
  scene.events.once('shutdown', () => scene.scale.off('resize', handler));
}
