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
  private hintGlow: Phaser.GameObjects.Arc;
  private hinting = false;
  enabled = true;
  // variante INFERNO DRIVE (mismo botón): aspecto de fuego, sin enfriamiento, con medidor de carga
  private infernoMode = false;
  private labelText!: Phaser.GameObjects.Text;
  private baseLabel = '';
  private fireRing?: Phaser.GameObjects.Arc;
  private meter?: Phaser.GameObjects.Container;
  private meterText?: Phaser.GameObjects.Text;
  private meterPips?: Phaser.GameObjects.Graphics;

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
    // aviso dorado (p. ej. SMASH potenciado disponible); independiente del brillo de "armado"
    this.hintGlow = scene.add.circle(0, 0, R + 16, 0xffc42e, 0).setStrokeStyle(5, 0xfff1b8, 0);
    this.add(this.hintGlow);

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
    this.baseLabel = label;
    this.labelText = scene.add.text(0, R + 22, label, textStyle(20)).setOrigin(0.5);
    this.add(this.labelText);

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
    // INFERNO DRIVE no depende del enfriamiento del SMASH
    return (this.infernoMode || this.remaining <= 0) && this.enabled;
  }

  get inferno() {
    return this.infernoMode;
  }

  /**
   * Cambia el botón a INFERNO DRIVE (tonos de fuego, aura y texto) o lo devuelve a su aspecto original.
   * Misma posición, tamaño y zona táctil.
   */
  setInferno(on: boolean) {
    if (on === this.infernoMode) return;
    this.infernoMode = on;
    const R = this.radius;
    for (const o of this.face.list) {
      const img = o as Phaser.GameObjects.Image;
      if (typeof img.setTint === 'function') on ? img.setTint(0xff8a3a, 0xffc040, 0xff3d1a, 0xff6a1a) : img.clearTint();
    }
    if (!this.fireRing) {
      this.fireRing = this.scene.add.circle(0, 0, R + 14, 0xff5a1a, 0.35).setStrokeStyle(6, 0xffb020, 1).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
      this.addAt(this.fireRing, 1);
    }
    this.scene.tweens.killTweensOf(this.fireRing);
    this.fireRing.setVisible(on).setScale(1).setAlpha(1);
    if (on) {
      this.scene.tweens.add({ targets: this.fireRing, scale: 1.16, alpha: 0.45, duration: 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      // disponible: rebote + destello
      this.scene.tweens.add({ targets: this.face, scale: { from: 1.3, to: 1 }, duration: 420, ease: 'Back.easeOut' });
    }
    this.labelText.setText(on ? 'INFERNO' : this.baseLabel).setColor(on ? '#ffb347' : '#ffffff');
    this.redraw();
  }

  /** Medidor discreto de carga encima del botón: "INFERNO n/max" + pips. */
  setMeter(n: number, max: number) {
    const R = this.radius;
    if (!this.meter) {
      this.meter = this.scene.add.container(0, -R - 34);
      const bg = this.scene.add.graphics();
      bg.fillStyle(0x0b1733, 0.85).fillRoundedRect(-62, -15, 124, 30, 15);
      bg.lineStyle(2, 0xff7a1a, 0.9).strokeRoundedRect(-62, -15, 124, 30, 15);
      this.meterText = this.scene.add.text(0, -4, '', { fontFamily: '"Lilita One", "Arial Black", sans-serif', fontSize: '14px', color: '#ffd9a8' }).setOrigin(0.5);
      this.meterPips = this.scene.add.graphics();
      this.meter.add([bg, this.meterText, this.meterPips]);
      this.add(this.meter);
    }
    const full = n >= max;
    this.meterText!.setText(`INFERNO ${n}/${max}`).setColor(full ? '#ffe066' : '#ffd9a8');
    const g = this.meterPips!.clear();
    const w = 14;
    const x0 = -((max - 1) * (w + 3)) / 2;
    for (let i = 0; i < max; i++) {
      g.fillStyle(i < n ? (full ? 0xffc02a : 0xff6a1a) : 0x2a3a66, 1).fillRoundedRect(x0 + i * (w + 3) - w / 2, 7, w, 4, 2);
    }
  }

  /** Pequeña animación de "cargada" en el medidor. */
  pulseMeter() {
    if (!this.meter) return;
    this.scene.tweens.add({ targets: this.meter, scale: { from: 1.35, to: 1 }, duration: 480, ease: 'Back.easeOut' });
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
    if (!this.infernoMode) this.remaining = this.cooldown;
    this.scene.tweens.add({ targets: this.face, scale: 0.82, duration: 70, yoyo: true, ease: 'Quad.easeOut' });
    this.redraw();
    return true;
  }

  /** Aviso dorado pulsante (sin cambiar el cooldown ni el estado armado). */
  setHint(on: boolean) {
    if (on === this.hinting) return;
    this.hinting = on;
    this.scene.tweens.killTweensOf(this.hintGlow);
    if (on) {
      this.hintGlow.setScale(1).setFillStyle(0xffc42e, 0.35).setStrokeStyle(5, 0xfff1b8, 0.95);
      this.scene.tweens.add({ targets: this.hintGlow, scale: 1.18, alpha: { from: 1, to: 0.45 }, duration: 260, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else {
      this.hintGlow.setScale(1).setAlpha(1).setFillStyle(0xffc42e, 0).setStrokeStyle(5, 0xfff1b8, 0);
    }
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
    // en modo INFERNO no se muestra el enfriamiento del SMASH (sigue contando por detrás)
    const busy = this.remaining > 0 && !this.infernoMode;
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
