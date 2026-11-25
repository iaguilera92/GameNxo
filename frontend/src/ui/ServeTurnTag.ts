import Phaser from 'phaser';
import { FONT } from './theme';
/**
 * Indicador de turno de saque sobre la cabeza de quien saca (en el mundo, sigue al personaje):
 *   "SERVICIO" con la pelota, dentro de un globo de diálogo azul noche con borde dorado (tú) o rojizo (rival) y pico hacia el personaje.
 * (21-11-2026, usuario) El globo es la imagen `dialog-servicio` (public/assets/ui/dialog-servicio.webp, 800 × 246, recortada del arte de 2048 × 768 en
 * (40, 120, 1964 × 605)); la pelota y el texto van dentro. Si la imagen no carga, se dibuja por código como antes.
 * Solo visual. Se muestra mientras se espera el saque (fase 'serve') y se oculta al lanzar la pelota.
 */
export const SERVE_TAG_ART = { key: 'ui-dialog-servicio', file: 'assets/ui/dialog-servicio.webp' };
export function queueServeTagArt(load: Phaser.Loader.LoaderPlugin) {
  if (!load.textureManager.exists(SERVE_TAG_ART.key)) load.image(SERVE_TAG_ART.key, SERVE_TAG_ART.file);
}
/** tamaño de la etiqueta (se ve en el mundo, a escala de la cancha) */
const TAG_SCALE = 1.35;
/** separación sobre el punto de la cabeza (unidades de la etiqueta, antes de escalar) */
const TAG_LIFT = 78;
/** unidades de la etiqueta por píxel del arte original (el globo mide ~196 unidades de ancho) */
const ART_K = 0.1; // (21-11-2026, usuario) más grande (antes 0,0822): el texto y la pelota quedaban muy juntos
/** recorte de la imagen cargada respecto del arte original, y el centro del globo en el arte (origen del contenedor) */
const ART_CROP = { x: 40, y: 120, w: 1964, h: 605 };
const ART_C = { x: 1024, y: 340 };
/** tinte del globo del rival (el borde dorado pasa a rojo) */
const RIVAL_TINT = 0xff5a68;
export class ServeTurnTag {
  private c: Phaser.GameObjects.Container;
  private pill: Phaser.GameObjects.Graphics;
  private img: Phaser.GameObjects.Image | null = null;
  private label: Phaser.GameObjects.Text;
  private arrow: Phaser.GameObjects.Graphics;
  private who: 'player' | 'bot' | null = null;
  private t = 0;
  private alpha = 0;
  constructor(scene: Phaser.Scene, _rivalName: string) {
    this.c = scene.add.container(0, 0).setDepth(4600).setAlpha(0).setScale(TAG_SCALE);
    this.pill = scene.add.graphics();
    if (scene.textures.exists(SERVE_TAG_ART.key)) {
      this.img = scene.add
        .image((ART_CROP.x - ART_C.x) * ART_K, (ART_CROP.y - ART_C.y) * ART_K, SERVE_TAG_ART.key)
        .setOrigin(0, 0)
        .setDisplaySize(ART_CROP.w * ART_K, ART_CROP.h * ART_K);
    }
    this.label = scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: '24px', color: '#0a1638' }).setOrigin(0.5).setLetterSpacing(1);
    this.arrow = scene.add.graphics();
    this.c.add(this.img ? [this.img, this.pill, this.label, this.arrow] : [this.pill, this.label, this.arrow]);
  }
  /** `x, y` = punto sobre la cabeza (pantalla/mundo). `who` = quién saca, o null para ocultar. */
  /** (25-11-2026) nivel 1: por encima del oscurecido de la guía */
  setFront(on: boolean) {
    this.c.setDepth(on ? 5620 : 4600);
  }
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
    this.arrow.clear();
    const g = this.pill.clear();
    if (this.img) {
      // con la imagen: el globo trae píldora, borde y pico; solo se tiñe para el rival y se dibuja la pelota (a la izquierda) y el texto
      if (mine) this.img.clearTint();
      else this.img.setTint(RIVAL_TINT);
      const bx = (330 - ART_C.x) * ART_K;
      g.fillStyle(accent, 1).fillCircle(bx, 0, 14);
      g.fillStyle(0x0a1638, 1).fillCircle(bx, 0, 10.5);
      g.fillStyle(0xd7f53a, 1).fillCircle(bx, 0, 8.5);
      g.lineStyle(1.6, 0xffffff, 0.9).beginPath().arc(bx - 9, 0, 8, -0.9, 0.9).strokePath();
      this.label.setX(20).setShadow(0, 2, '#0a1638', 0, true, true);
      return;
    }
    const w = this.label.width + 70;
    const h = 40;
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
    const a = this.arrow;
    // pico unido a la píldora: nace dentro del borde inferior (tapa el trazo) y baja hacia el personaje
    const ay = h / 2;
    a.fillStyle(0x000000, 0.35).fillTriangle(-11, ay + 2, 13, ay + 2, 1, ay + 18);
    a.fillStyle(accent, 1).fillTriangle(-12, ay - 3, 12, ay - 3, 0, ay + 15);
    a.fillStyle(0x0b1733, 1).fillTriangle(-8, ay - 4, 8, ay - 4, 0, ay + 9);
  }
}
