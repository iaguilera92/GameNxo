import Phaser from 'phaser';
import { drawAbilityIcon, drawDisc } from './icons';
import type { AbilityIcon } from '../logic/Abilities';

/** Azul neón de la ventana de saque perfecto. */
export const NEON = 0x19e6ff;

/**
 * Botón circular de saque (sin texto): raqueta dorada = saque normal, pelota girando violeta = con efecto.
 * `setCue(true)` lo ilumina en azul neón con un pulso mientras dura la ventana de saque perfecto.
 */
export class ServeButton extends Phaser.GameObjects.Container {
  private face: Phaser.GameObjects.Container;
  private neon: Phaser.GameObjects.Graphics;
  private chosen: Phaser.GameObjects.Graphics;
  private cue = false;
  private locked = false;
  private cueTween?: Phaser.Tweens.Tween;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly radius: number,
    icon: AbilityIcon,
    color: number,
    colorDark: number,
    private readonly onPress: () => void,
  ) {
    super(scene, x, y);
    this.setScrollFactor(0).setDepth(5000);
    const R = radius;

    this.neon = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.neon.fillStyle(NEON, 0.35).fillCircle(0, 0, R + 30);
    this.neon.lineStyle(10, NEON, 1).strokeCircle(0, 0, R + 14);
    this.neon.lineStyle(4, 0xffffff, 0.9).strokeCircle(0, 0, R + 8);
    this.add(this.neon);

    this.face = scene.add.container(0, 0);
    const g = scene.add.graphics();
    drawDisc(g, R, color, colorDark);
    drawAbilityIcon(g, icon, R);
    this.face.add(g);
    this.add(this.face);

    // aro que marca el botón elegido (el otro queda apagado)
    this.chosen = scene.add.graphics().setVisible(false);
    this.chosen.lineStyle(7, 0xffffff, 0.95).strokeCircle(0, 0, R + 14);
    this.add(this.chosen);

    this.setSize(R * 2 + 20, R * 2 + 20);
    this.setInteractive(new Phaser.Geom.Circle(R + 10, R + 10, R + 14), Phaser.Geom.Circle.Contains);
    this.on('pointerdown', () => this.press());
    scene.add.existing(this);
  }

  /** Sustituye el dibujo por una imagen (si la textura no existe, se queda el dibujo). */
  setArt(key: string) {
    if (!this.scene.textures.exists(key)) return;
    this.face.removeAll(true);
    const d = this.radius * 2 + 16;
    this.face.add(this.scene.add.image(0, 0, key).setDisplaySize(d, d));
  }

  /** Pulsación (táctil o teclado). */
  press() {
    if (this.locked || !this.visible) return;
    this.scene.tweens.killTweensOf(this.face);
    this.face.setScale(1);
    this.scene.tweens.add({ targets: this.face, scale: 0.82, duration: 70, yoyo: true, ease: 'Quad.easeOut' });
    this.onPress();
  }

  /** Bloqueado = el otro tipo de saque ya está en curso: no responde y se ve apagado. */
  setLocked(on: boolean) {
    this.locked = on;
    this.face.setAlpha(on ? 0.35 : 1);
    if (on) this.setCue(false);
  }

  /** Marca este botón como el tipo de saque elegido. */
  setChosen(on: boolean) {
    this.chosen.setVisible(on);
  }

  /** Brillo azul neón con pulso (ventana de saque perfecto). */
  setCue(on: boolean) {
    if (on === this.cue) return;
    this.cue = on;
    this.cueTween?.remove();
    this.cueTween = undefined;
    this.neon.setVisible(on).setAlpha(1).setScale(1);
    if (on) {
      this.cueTween = this.scene.tweens.add({ targets: this.neon, scale: 1.14, alpha: 0.6, duration: 230, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  /** Estado limpio (nuevo saque). */
  resetState() {
    this.setCue(false);
    this.setChosen(false);
    this.setLocked(false);
  }

  /** Muestra u oculta el botón (el resto de controles se restauran en la escena). */
  show(on: boolean) {
    this.setVisible(on);
    if (on) this.resetState();
    else this.setCue(false);
  }
}
