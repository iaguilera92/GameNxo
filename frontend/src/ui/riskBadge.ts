import Phaser from 'phaser';
import { FONT } from './theme';
import { rankedState } from '../logic/Ranked';

/**
 * MODO RIESGO x2: marca bajo el panel "TÚ" del marcador cuando la partida Ranked en curso se jugó con el evento
 * (el multiplicador ya quedó fijado en `ranked.pending.risk` al pagar la entrada). Va dentro del marcador: se mueve,
 * se oculta y se muestra con él. Partidas sin Ranked o x1: nada.
 */
export function addRiskBadge(scene: Phaser.Scene, board: Phaser.GameObjects.Container) {
  if (rankedState().pending?.risk !== 2) return;
  const x = -(98 + 111); // centro del panel izquierdo (ScoreBoard: CW / 2 + PW / 2)
  const y = 70 + 20;
  const t = scene.add.text(x, y, 'x2 RIESGO', { fontFamily: FONT, fontSize: '17px', color: '#ffffff', stroke: '#4a0d00', strokeThickness: 4 }).setOrigin(0.5).setLetterSpacing(1);
  const w = t.width + 26;
  const g = scene.add.graphics();
  g.fillStyle(0x0a1638, 1).fillRoundedRect(x - w / 2 - 2, y - 15, w + 4, 30, 15);
  g.fillStyle(0xd8361e, 1).fillRoundedRect(x - w / 2, y - 13, w, 26, 13);
  g.fillStyle(0xffffff, 0.22).fillRoundedRect(x - w / 2 + 5, y - 11, w - 10, 8, 4);
  g.lineStyle(2, 0xffd23f, 1).strokeRoundedRect(x - w / 2, y - 13, w, 26, 13);
  board.add([g, t]);
  scene.tweens.add({ targets: [g, t], alpha: { from: 1, to: 0.6 }, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
}
