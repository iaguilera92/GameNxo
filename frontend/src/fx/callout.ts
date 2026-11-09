import Phaser from 'phaser';
import { FONT } from '../ui/theme';
import { VIEW } from '../view/projection';

/**
 * Aviso breve del partido. Con marcador (MatchScene registra 'scoreInfo'), va en la píldora bajo "JUEGO N".
 * Sin él, aviso centrado (FALTA, TIEMPO, LET, AL AIRE, 2º SERVICIO…): una píldora compacta bajo el
 * marcador en lugar de textos flotando junto al jugador. Solo hay UNO a la vez (el nuevo reemplaza al anterior).
 * Fijo en pantalla (scrollFactor 0 → cámara de interfaz).
 */
const KEY = '__callout';

export function showCallout(scene: Phaser.Scene, text: string, color = 0xffc42e, ms = 900) {
  // si la escena tiene marcador, el aviso va en su píldora (bajo "JUEGO N"): ver MatchScene ('scoreInfo')
  const toBoard = scene.data?.get('scoreInfo') as ((t: string, c: string, ms: number) => void) | undefined;
  if (toBoard) {
    toBoard(text, '#' + color.toString(16).padStart(6, '0'), ms + 300);
    return null;
  }
  const prev = scene.data?.get(KEY) as Phaser.GameObjects.Container | undefined;
  if (prev?.active) prev.destroy();
  const W = scene.scale.width;
  const y = Math.min(scene.scale.height, VIEW.H) * 0.2;
  const c = scene.add.container(W / 2, y).setScrollFactor(0).setDepth(6050);
  const t = scene.add.text(0, 1, text.toUpperCase(), { fontFamily: FONT, fontSize: '30px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 5 }).setOrigin(0.5).setLetterSpacing(2);
  const w = t.width + 56;
  const h = 54;
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.35).fillRoundedRect(-w / 2 + 3, -h / 2 + 5, w, h, h / 2);
  g.fillStyle(0x0b1733, 0.95).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  g.fillStyle(0xffffff, 0.08).fillRoundedRect(-w / 2 + 8, -h / 2 + 4, w - 16, h * 0.35, h * 0.17);
  g.lineStyle(3, color, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  c.add([g, t]);
  scene.data?.set(KEY, c);
  c.setScale(0.6).setAlpha(0);
  scene.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 180, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: c, alpha: 0, y: y - 14, delay: ms, duration: 220, onComplete: () => c.destroy() });
  return c;
}
