import Phaser from 'phaser';
import type { Character } from './Character';

/** Colores de la "hipercarga" (morado/rosa eléctrico). */
const COL = 0xb44bff;
const COL_HOT = 0xff6ae6;
const COL_CORE = 0xffffff;

/** Altura aproximada del personaje en unidades locales (antes de escalar). */
const BODY_H = 150;

/** Adapta un rectángulo como fuente de puntos aleatorios para el emisor. */
const zoneSource = (r: Phaser.Geom.Rectangle): Phaser.Types.GameObjects.Particles.RandomZoneSource => ({
  getRandomPoint: (p) => {
    p.x = r.x + Math.random() * r.width;
    p.y = r.y + Math.random() * r.height;
  },
});

/** Texturas pequeñas generadas una sola vez (brillo radial y chispa). */
function ensureTextures(scene: Phaser.Scene) {
  if (!scene.textures.exists('fx-glow')) {
    const S = 64;
    const tex = scene.textures.createCanvas('fx-glow', S, S);
    if (tex) {
      const ctx = tex.getContext();
      const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
      tex.refresh();
    }
  }
  if (!scene.textures.exists('fx-spark')) {
    const g = scene.make.graphics({}, false);
    g.fillStyle(0xffffff).fillRect(3, 0, 2, 8).fillRect(0, 3, 8, 2);
    g.generateTexture('fx-spark', 8, 8);
    g.destroy();
  }
}

/**
 * Aura de "hipercarga" alrededor de un personaje: halo pulsante, contorno brillante,
 * llamas de energía que suben, chispas y anillo en el suelo.
 * Los efectos usan emisores de partículas (con pool) para no crear objetos por frame.
 */
export class HyperAura {
  private halo: Phaser.GameObjects.Image;
  private ring: Phaser.GameObjects.Ellipse;
  private flames: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private glowFx?: Phaser.FX.Glow;
  private tweens: Phaser.Tweens.Tween[] = [];
  private t = 0;
  /** zonas de emisión (se reescalan cada frame con la perspectiva) */
  private flameZone = new Phaser.Geom.Rectangle(-46, -75, 92, 120);
  private sparkZone = new Phaser.Geom.Rectangle(-46, -60, 92, 90);
  active = false;

  constructor(private scene: Phaser.Scene, private ch: Character) {
    ensureTextures(scene);
    this.halo = scene.add.image(0, 0, 'fx-glow').setTint(COL).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.ring = scene.add
      .ellipse(0, 0, 120, 40, COL, 0.35)
      .setStrokeStyle(5, COL_HOT, 0.9)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);

    // llamas de energía (detrás del personaje)
    this.flames = scene.add.particles(0, 0, 'fx-glow', {
      lifespan: { min: 380, max: 650 },
      speedY: { min: -170, max: -90 },
      speedX: { min: -25, max: 25 },
      scaleX: { start: 0.45, end: 0.08 },
      scaleY: { start: 0.9, end: 0.15 },
      alpha: { start: 0.85, end: 0 },
      tint: [COL, COL, COL_HOT],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 28,
      quantity: 2,
      emitZone: new Phaser.GameObjects.Particles.Zones.RandomZone(zoneSource(this.flameZone)),
      emitting: false,
    });
    // chispas (delante del personaje)
    this.sparks = scene.add.particles(0, 0, 'fx-spark', {
      lifespan: { min: 300, max: 550 },
      speedY: { min: -200, max: -80 },
      speedX: { min: -60, max: 60 },
      scale: { start: 1.4, end: 0.2 },
      alpha: { start: 1, end: 0 },
      rotate: { min: 0, max: 90 },
      tint: [COL_CORE, COL_HOT],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 90,
      emitZone: new Phaser.GameObjects.Particles.Zones.RandomZone(zoneSource(this.sparkZone)),
      emitting: false,
    });
  }

  start() {
    if (this.active) return;
    this.active = true;
    this.t = 0;
    this.halo.setVisible(true);
    this.ring.setVisible(!this.ringHidden);
    this.flames.start();
    this.sparks.start();

    // contorno brillante (solo WebGL; en Canvas se omite)
    if (this.scene.game.renderer.type === Phaser.WEBGL && this.ch.postFX) {
      this.glowFx = this.ch.postFX.addGlow(COL_HOT, 3, 0, false, 0.1, 10);
      this.tweens.push(this.scene.tweens.add({ targets: this.glowFx, outerStrength: { from: 2, to: 6 }, duration: 260, yoyo: true, repeat: -1 }));
    }

    // estallido de activación
    const k = this.ch.scaleX || 1;
    const blast = this.scene.add
      .image(this.ch.x, this.ch.y - BODY_H * 0.5 * k, 'fx-glow')
      .setTint(COL_HOT)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(this.ch.depth + 1)
      .setScale(0.5);
    this.scene.tweens.add({ targets: blast, scale: 6 * k, alpha: 0, duration: 380, ease: 'Quad.easeOut', onComplete: () => blast.destroy() });
    this.sparks.explode(18, this.ch.x, this.ch.y);
  }

  /** Oculta (o vuelve a mostrar) el anillo de los pies, p. ej. durante las cinemáticas de golpe especial. */
  private ringHidden = false;
  setRingHidden(h: boolean) {
    this.ringHidden = h;
    this.ring.setVisible(this.active && !h);
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    this.halo.setVisible(false);
    this.ring.setVisible(false);
    this.flames.stop();
    this.sparks.stop();
    this.tweens.forEach((t) => t.remove());
    this.tweens = [];
    if (this.glowFx) {
      this.ch.postFX?.remove(this.glowFx);
      this.glowFx = undefined;
    }
  }

  /** Llamar cada frame después de posicionar al personaje. */
  update(dt: number) {
    if (!this.active) return;
    this.t += dt;
    const ch = this.ch;
    const k = Math.abs(ch.scaleY) || 1;
    const midY = ch.y - BODY_H * 0.5 * k;
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 14);

    this.halo
      .setPosition(ch.x, midY)
      .setScale((3.2 + pulse * 0.5) * k, (4.4 + pulse * 0.6) * k)
      .setAlpha(0.45 + pulse * 0.25)
      .setDepth(ch.depth - 0.6);
    this.ring
      .setPosition(ch.x, ch.y)
      .setScale((1 + pulse * 0.15) * k)
      .setAlpha(0.6 + pulse * 0.4)
      .setDepth(ch.depth - 0.7);

    // emisores siguen al personaje; las llamas salen del contorno del cuerpo
    const w = 46 * k;
    this.flameZone.setTo(-w, -BODY_H * 0.85 * k, w * 2, BODY_H * 0.85 * k);
    this.sparkZone.setTo(-w, -BODY_H * 0.8 * k, w * 2, BODY_H * 0.7 * k);
    this.flames.setPosition(ch.x, ch.y).setDepth(ch.depth - 0.5);
    this.sparks.setPosition(ch.x, ch.y).setDepth(ch.depth + 0.5);
  }

  destroy() {
    this.stop();
    this.halo.destroy();
    this.ring.destroy();
    this.flames.destroy();
    this.sparks.destroy();
  }
}



