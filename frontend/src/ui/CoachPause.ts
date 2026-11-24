import Phaser from 'phaser';
import { FONT } from './theme';
import { arcadeButton } from './modeButtons';

const NAVY = 0x0b1a3d;
const NEON = 0x3a7bff;
const GOLD = 0xffd23f;

/**
 * (24-11-2026, usuario) PAUSA DEL TUTORIAL dentro del partido: panel breve arriba de la cancha (no tapa la pelota ni a los personajes) con
 * una explicación de una o dos líneas y ENTENDIDO. Si no se toca, sigue sola a los `autoMs` (barra que se vacía). Funciona con el reloj del
 * partido en pausa: usa tweens, no `scene.time`. Devuelve la función que lo cierra sin llamar a `onDone`.
 */
export function showCoachPause(scene: Phaser.Scene, text: string, onDone: () => void, o: { autoMs?: number; depth?: number; y?: number } = {}) {
  const W = scene.scale.width;
  const autoMs = o.autoMs ?? 6000;
  const depth = o.depth ?? 7800;
  const pw = W - 60;
  const root = scene.add.container(W / 2, o.y ?? 250).setScrollFactor(0).setDepth(depth);
  const txt = scene.add.text(0, -28, text, { fontFamily: FONT, fontSize: '27px', color: '#ffffff', align: 'center', wordWrap: { width: pw - 50 }, lineSpacing: 4 }).setOrigin(0.5);
  const ph = Math.max(170, txt.height + 130);
  txt.setY(-ph / 2 + 26 + txt.height / 2);
  const bg = scene.add.graphics();
  bg.fillStyle(0x000000, 0.4).fillRoundedRect(-pw / 2 + 3, -ph / 2 + 6, pw, ph, 22);
  bg.fillStyle(NAVY, 0.96).fillRoundedRect(-pw / 2, -ph / 2, pw, ph, 22);
  bg.lineStyle(3, NEON, 1).strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, 22);
  root.add([bg, txt]);
  // barra de la espera: se vacía hasta que sigue sola
  const barW = pw - 60;
  const barY = ph / 2 - 12;
  root.add(scene.add.rectangle(-barW / 2, barY, barW, 5, 0x1f2f5c).setOrigin(0, 0.5));
  const bar = scene.add.rectangle(-barW / 2, barY, barW, 5, GOLD).setOrigin(0, 0.5);
  root.add(bar);
  let done = false;
  const close = () => {
    if (done) return;
    done = true;
    scene.tweens.killTweensOf(bar);
    scene.tweens.add({ targets: root, alpha: 0, duration: 140, onComplete: () => root.destroy() });
  };
  const finish = () => {
    if (done) return;
    close();
    onDone();
  };
  root.add(arcadeButton(scene, 0, ph / 2 - 52, 250, 64, 'ENTENDIDO', finish, { palette: 'yellow' }));
  scene.tweens.add({ targets: bar, scaleX: 0, duration: autoMs, ease: 'Linear', onComplete: finish });
  root.setAlpha(0).setScale(0.94);
  scene.tweens.add({ targets: root, alpha: 1, scale: 1, duration: 180, ease: 'Back.easeOut' });
  return close;
}
