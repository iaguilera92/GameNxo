import Phaser from 'phaser';
import { FONT } from './theme';

/**
 * Indicador de turno de saque sobre la cabeza de quien saca (en el mundo, sigue al personaje):
 *   "SERVICIO" en una píldora azul noche con borde dorado (tú) o rojo (rival) y pico hacia el personaje
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

  constructor(scene: Phaser.Scene, _rivalName: string) {
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
    // la etiqueta entera (con su pico) sube y baja suave; el pico nunca se separa de la píldora
    this.c.setPosition(x, y - TAG_LIFT * TAG_SCALE + bob * 0.5);
  }

  private build(who: 'player' | 'bot') {
    const mine = who === 'player';
    // mismo texto para los dos; el color dice de quién es (dorado = tú, rojo = rival)
    this.label.setText('SERVICIO').setColor('#ffffff').setFontSize(22).setScale(1);
    const accent = mine ? 0xffc42e : 0xff4f5e;
    const w = this.label.width + 70;
    const h = 40;
    const g = this.pill.clear();
    // sombra, cuerpo azul noche, brillo superior y borde del color del turno
    g.fillStyle(0x000000, 0.35).fillRoundedRect(-w / 2 + 2, -h / 2 + 5, w, h, h / 2);
    g.fillStyle(0x0b1733, 0.96).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    g.fillStyle(0xffffff, 0.1).fillRoundedRect(-w / 2 + 8, -h / 2 + 4, w - 16, h * 0.32, h * 0.16);
    g.lineStyle(3, accent, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    // insignia con la pelota a la izquierda (círculo del color del turno)
    const bx = -w / 2 + 22;
    g.fillStyle(accent, 1).fillCircle(bx, 0, 15);
    g.fillStyle(0x0a1638, 1).fillCircle(bx, 0, 11);
    g.fillStyle(0xd7f53a, 1).fillCircle(bx, 0, 9);
    g.lineStyle(1.6, 0xffffff, 0.9).beginPath().arc(bx - 9, 0, 8, -0.9, 0.9).strokePath();
    this.label.setX(14).setShadow(0, 2, '#0a1638', 0, true, true);
    // pico hacia el personaje (globo de diálogo), en los dos turnos
    const a = this.arrow.clear();
    // pico unido a la píldora: nace dentro del borde inferior (tapa el trazo) y baja hacia el personaje
    const ay = h / 2;
    a.fillStyle(0x000000, 0.35).fillTriangle(-11, ay + 2, 13, ay + 2, 1, ay + 18);
    a.fillStyle(accent, 1).fillTriangle(-12, ay - 3, 12, ay - 3, 0, ay + 15);
    a.fillStyle(0x0b1733, 1).fillTriangle(-8, ay - 4, 8, ay - 4, 0, ay + 9);
  }
}
