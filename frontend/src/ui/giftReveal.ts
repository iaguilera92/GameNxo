import Phaser from 'phaser';
import { textStyle } from './theme';
import { drawFadingRays } from './fadeRays';
import { coin2v2Image, coinIcon } from './wheelArt';
import { sfx } from '../fx/sfx';

export type GiftRevealKind = 'coins' | 'coins2v2' | 'cash';
const GOLD = 0xffc42e;

/**
 * (26-11-2026, usuario) PRESENTACIÓN de un regalo (como el premio de la ruleta, más chica): todo oscuro, rayos que giran, el premio con
 * su imagen que entra con rebote, "+N" que cuenta y el nombre; TOCA PARA CONTINUAR. La usan la Tienda (REGALO DIARIO) y el menú
 * (27-11-2026, regalo de un amigo: `subtitle` = "Mai_Fan te envió un regalo").
 */
export function giftReveal(scene: Phaser.Scene, kind: GiftRevealKind, amount: number, onDone: () => void, title = 'REGALO DIARIO', subtitle?: string) {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const cy = H * 0.44;
  const col = kind === 'cash' ? 0x8dffad : kind === 'coins2v2' ? 0xd2b0ff : 0xffd23f;
  const css = kind === 'cash' ? '#8dffad' : kind === 'coins2v2' ? '#d2b0ff' : '#ffd23f';
  const root = scene.add.container(0, 0).setDepth(9400);
  const dark = scene.add.rectangle(0, 0, W, H, 0x02060f, 0.88).setOrigin(0).setInteractive();
  root.add(dark);
  // rayos de luz que giran detrás del premio
  const rays = scene.add.graphics({ x: W / 2, y: cy }).setBlendMode(Phaser.BlendModes.ADD);
  drawFadingRays(rays, 12, 280, col, 0.28, 0.12);
  rays.fillStyle(col, 0.22).fillCircle(0, 0, 90);
  root.add(rays);
  scene.tweens.add({ targets: rays, angle: 360, duration: 9000, repeat: -1 });
  const tt = scene.add.text(W / 2, cy - 190, title, textStyle(40, '#ffffff')).setOrigin(0.5);
  if (tt.width > W - 40) tt.setScale((W - 40) / tt.width);
  root.add(tt);
  if (subtitle) {
    const st = scene.add.text(W / 2, cy - 142, subtitle, textStyle(24, '#ffd9a0')).setOrigin(0.5);
    if (st.width > W - 40) st.setScale((W - 40) / st.width);
    root.add(st);
  }
  // el premio con su imagen
  let icon: Phaser.GameObjects.Image;
  if (kind === 'cash' && scene.textures.exists('cash-pack')) {
    icon = scene.add.image(W / 2, cy, 'cash-pack');
    icon.setScale(150 / Math.max(icon.width, icon.height));
  } else icon = (kind === 'coins2v2' ? coin2v2Image : coinIcon)(scene, W / 2, cy, 62) as Phaser.GameObjects.Image;
  root.add(icon);
  const sx = icon.scaleX;
  const sy = icon.scaleY;
  icon.setScale(sx * 0.2, sy * 0.2);
  scene.tweens.add({ targets: icon, scaleX: sx, scaleY: sy, duration: 520, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: icon, y: cy - 8, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 520 });
  const amt = scene.add.text(W / 2, cy + 120, '+0', textStyle(56, css)).setOrigin(0.5).setAlpha(0);
  const name = scene.add.text(W / 2, cy + 172, kind === 'cash' ? 'DINERO' : kind === 'coins2v2' ? 'MONEDAS 2V2' : 'MONEDAS', textStyle(26, '#ffffff')).setOrigin(0.5).setAlpha(0);
  root.add([amt, name]);
  scene.tweens.add({ targets: [amt, name], alpha: 1, delay: 300, duration: 250 });
  const n = { v: 0 };
  scene.tweens.add({ targets: n, v: amount, delay: 350, duration: 700, ease: 'Cubic.easeOut', onUpdate: () => amt.setText('+' + Math.round(n.v)) });
  // destellos
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const st = scene.add.star(W / 2, cy, 5, 5, 12, Phaser.Utils.Array.GetRandom([col, 0xffffff, GOLD])).setBlendMode(Phaser.BlendModes.ADD);
    root.add(st);
    scene.tweens.add({ targets: st, x: W / 2 + Math.cos(a) * 200, y: cy + Math.sin(a) * 160, angle: 300, alpha: 0, scale: 0.4, duration: 800, ease: 'Cubic.easeOut' });
  }
  scene.cameras.main.flash(160, 255, 240, 180);
  sfx(scene, 'equipar');
  const prompt = scene.add.text(W / 2, H * 0.86, 'TOCA PARA CONTINUAR', textStyle(26, '#ffffff')).setOrigin(0.5).setAlpha(0);
  root.add(prompt);
  root.setAlpha(0);
  scene.tweens.add({ targets: root, alpha: 1, duration: 220 });
  scene.time.delayedCall(900, () => {
    if (!root.active) return;
    scene.tweens.add({ targets: prompt, alpha: { from: 0.4, to: 1 }, duration: 600, yoyo: true, repeat: -1 });
    dark.once('pointerup', () => {
      scene.tweens.add({ targets: root, alpha: 0, duration: 200, onComplete: () => { root.destroy(); onDone(); } });
    });
  });
  return root;
}
