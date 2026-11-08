import Phaser from 'phaser';
import { FONT } from './theme';

/**
 * Indicador de turno de saque sobre la cabeza de quien saca (en el mundo, sigue al personaje):
 *   jugador  → píldora dorada "TU SAQUE" + flecha que rebota apuntando al personaje
 *   rival    → píldora roja "SACA <RIVAL>"
 * Solo visual. Se muestra mientras se espera el saque (fase 'serve') y se oculta al lanzar la pelota.
 */
/** tamaño de la etiqueta (se ve en el mundo, a escala de la cancha) */
const TAG_SCALE = 1.35;
/** separación sobre el punto de la cabeza (unidades de la etiqueta, antes de escalar) */
const TAG_LIFT = 72;

export class ServeTurnTag {
  private c: Phaser.GameObjects.Container;
  private pill: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private arrow: Phaser.GameObjects.Graphics;
  private who: 'player' | 'bot' | null = null;
  private t = 0;
  private alpha = 0;

  constructor(scene: Phaser.Scene, private rivalName: string) {
    this.c = scene.add.container(0, 0).setDepth(4600).setAlpha(0).setScale(TAG_SCALE);
    this.pill = scene.add.graphics();
    this.label = scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: '24px', color: '#0a1638' }).setOrigin(0.5).setLetterSpacing(1);
    this.arrow = scene.add.graphics();
    this.c.add([this.pill, this.label, this.arrow]);
  }

  /** `x, y` = punto sobre la cabeza (pantalla/mundo). `who` = quién saca, o null para ocultar. */
  update(dt: number, who: 'player' | 'bot' | null, x: number, y: number) {
    this.t += dt;
    if (who && who !== this.who) this.build(who);
    if (who) this.who = who;
    this.alpha = Phaser.Math.Clamp(this.alpha + (who ? dt * 7 : -dt * 9), 0, 1);
    this.c.setAlpha(this.alpha).setVisible(this.alpha > 0);
    if (this.alpha <= 0) {
      this.who = null;
      return;
    }
    const bob = Math.sin(this.t * 7) * 5;
    // más arriba: la flecha (que rebota) termina por encima del pelo, sin tocar la cabeza
    this.c.setPosition(x, y - TAG_LIFT * TAG_SCALE + (this.who === 'player' ? bob * 0.4 : 0));
    this.arrow.setY(this.who === 'player' ? bob : 0);
  }

  private build(who: 'player' | 'bot') {
    const mine = who === 'player';
    const text = mine ? 'TU SAQUE' : `SACA ${this.rivalName.toUpperCase()}`;
    this.label.setText(text).setColor(mine ? '#0a1638' : '#ffffff').setFontSize(mine ? 24 : 20);
    if (this.label.width > 220) this.label.setScale(220 / this.label.width);
    else this.label.setScale(1);
    const w = Math.max(130, this.label.displayWidth + 54);
    const h = mine ? 40 : 34;
    const fill = mine ? 0xffc42e : 0xe8394a;
    const g = this.pill.clear();
    g.fillStyle(0x000000, 0.35).fillRoundedRect(-w / 2 + 2, -h / 2 + 4, w, h, h / 2);
    g.fillStyle(0x0a1638, 1).fillRoundedRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6, h / 2 + 3);
    g.fillStyle(fill, 1).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    g.fillStyle(0xffffff, 0.3).fillRoundedRect(-w / 2 + 10, -h / 2 + 4, w - 20, h * 0.28, h * 0.14);
    // pelotita a la izquierda del texto
    const bx = -w / 2 + 20;
    g.fillStyle(0x0a1638, 1).fillCircle(bx, 0, 10);
    g.fillStyle(0xd7f53a, 1).fillCircle(bx, 0, 8);
    g.lineStyle(1.6, 0xffffff, 0.9).beginPath().arc(bx - 9, 0, 8, -0.9, 0.9).strokePath();
    this.label.setX(10);
    // flecha hacia el personaje (solo en el turno del jugador)
    const a = this.arrow.clear();
    if (mine) {
      const ay = h / 2 + 12;
      a.fillStyle(0x0a1638, 1).fillTriangle(-14, ay - 3, 14, ay - 3, 0, ay + 17);
      a.fillStyle(fill, 1).fillTriangle(-10, ay, 10, ay, 0, ay + 12);
    }
  }
}
