import Phaser from 'phaser';
import { C, textStyle } from './theme';
import { drawAbilityIcon, drawDisc } from './icons';
import type { AbilityIcon } from '../logic/Abilities';

/** Botón de habilidad circular con cooldown visible (relleno radial + anillo + segundos). */
export class AbilityButton extends Phaser.GameObjects.Container {
  private remaining = 0;
  private overlay: Phaser.GameObjects.Graphics;
  private ring: Phaser.GameObjects.Graphics;
  private glow: Phaser.GameObjects.Arc;
  private secs: Phaser.GameObjects.Text;
  private face: Phaser.GameObjects.Container;
  private armed = false;
  enabled = true;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly radius: number,
    private readonly cooldown: number,
    color: number,
    colorDark: number,
    icon: AbilityIcon,
    label: string,
    /** Devuelve false si ahora no se puede usar (no consume el cooldown). */
    private readonly onActivate: () => boolean,
  ) {
    super(scene, x, y);
    this.setScrollFactor(0).setDepth(5000);
    const R = radius;

    this.glow = scene.add.circle(0, 0, R + 20, 0xff9a2e, 0.0);
    this.add(this.glow);

    this.face = scene.add.container(0, 0);
    this.add(this.face);
    const g = scene.add.graphics();
    drawDisc(g, R, color, colorDark);
    drawAbilityIcon(g, icon, R);
    this.face.add(g);

    this.overlay = scene.add.graphics();
    this.ring = scene.add.graphics();
    this.add([this.overlay, this.ring]);
    this.secs = scene.add.text(0, 0, '', textStyle(Math.round(R * 0.6))).setOrigin(0.5);
    this.add(this.secs);
    this.add(scene.add.text(0, R + 22, label, textStyle(20)).setOrigin(0.5));

    this.setSize(R * 2 + 20, R * 2 + 20);
    this.setInteractive(new Phaser.Geom.Circle(R + 10, R + 10, R + 14), Phaser.Geom.Circle.Contains);
    this.on('pointerdown', () => this.tryActivate());
    scene.add.existing(this);
    this.redraw();
  }

  /** Sustituye el dibujo por una imagen (si la textura no existe, se queda el dibujo). */
  setArt(key: string) {
    if (!this.scene.textures.exists(key)) return;
    this.face.removeAll(true);
    const d = this.radius * 2 + 16; // mismo tamaño que el disco dibujado (con su borde)
    this.face.add(this.scene.add.image(0, 0, key).setDisplaySize(d, d));
  }

  /** Bloquea / libera el botón (se ve atenuado y vibra si se pulsa mientras está bloqueado). */
  setEnabled(on: boolean) {
    this.enabled = on;
    this.redraw();
  }

  get ready() {
    return this.remaining <= 0 && this.enabled;
  }

  private shake() {
    this.scene.tweens.add({ targets: this.face, x: { from: -6, to: 6 }, duration: 50, yoyo: true, repeat: 2, onComplete: () => (this.face.x = 0) });
  }

  tryActivate(): boolean {
    if (!this.ready) {
      this.shake();
      return false;
    }
    this.scene.tweens.killTweensOf(this.face);
    this.face.setScale(1);
    this.face.x = 0;
    if (!this.onActivate()) {
      this.shake();
      return false;
    }
    this.remaining = this.cooldown;
    this.scene.tweens.add({ targets: this.face, scale: 0.82, duration: 70, yoyo: true, ease: 'Quad.easeOut' });
    this.redraw();
    return true;
  }

  setArmed(a: boolean) {
    this.armed = a;
    this.scene.tweens.killTweensOf(this.glow);
    if (a) {
      this.glow.setAlpha(0.6);
      this.scene.tweens.add({ targets: this.glow, alpha: 0.15, scale: 1.15, duration: 350, yoyo: true, repeat: -1 });
    } else {
      this.glow.setAlpha(0).setScale(1);
    }
    this.redraw();
  }

  update(dt: number) {
    if (this.remaining > 0) {
      this.remaining = Math.max(0, this.remaining - dt);
      if (this.remaining === 0) {
        // listo: rebote + destello
        this.scene.tweens.add({ targets: this.face, scale: { from: 1.25, to: 1 }, duration: 380, ease: 'Back.easeOut' });
      }
      this.redraw();
    }
  }

  private redraw() {
    const R = this.radius;
    this.overlay.clear();
    this.ring.clear();
    const busy = this.remaining > 0;
    this.face.setAlpha(busy || !this.enabled ? 0.55 : 1);
    if (busy) {
      const frac = this.remaining / this.cooldown; // parte que falta
      const start = -Math.PI / 2;
      // relleno oscuro radial (lo que falta por cargar)
      this.overlay.fillStyle(0x0b0620, 0.6);
      this.overlay.slice(0, 0, R - 2, start, start + frac * Math.PI * 2, false).fillPath();
      // anillo de progreso (lo ya cargado)
      this.ring.lineStyle(8, C.outline, 1).strokeCircle(0, 0, R + 12);
      this.ring.lineStyle(5, 0xffe066, 1);
      this.ring.beginPath();
      this.ring.arc(0, 0, R + 12, start, start + (1 - frac) * Math.PI * 2, false);
      this.ring.strokePath();
      this.secs.setText(String(Math.ceil(this.remaining)));
    } else {
      this.secs.setText('');
    }
    if (this.armed) this.ring.lineStyle(6, 0xff9a2e, 1).strokeCircle(0, 0, R + 16);
  }
}
