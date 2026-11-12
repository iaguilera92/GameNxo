import Phaser from 'phaser';
import type { Character } from './Character';
import type { SmashPower } from '../domain/smashPowers';
import { SMASH_LOOK } from '../fx/smashFx';

/** Colores de la "hipercarga" por poder del SMASH: fuego = morado/rosa eléctrico (el de siempre); hielo = azul y cian (SMASH_LOOK). */
type Pal = { col: number; hot: number; core: number };

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
 * Aura de "hipercarga" alrededor de un personaje: llamas de energía que suben y chispas (irradia, sin halo ni anillo).
 * Los efectos usan emisores de partículas (con pool) para no crear objetos por frame.
 * Sin postFX (Glow): compilaba un shader al encenderse y redibujaba al personaje cada fotograma (tirones en móvil).
 */
export class HyperAura {
  private flames!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  /** poder del SMASH con el que están creados los elementos (start lo cambia si hace falta) */
  private el: SmashPower = 'fire';
  /** zonas de emisión (se reescalan cada frame con la perspectiva) */
  private flameZone = new Phaser.Geom.Rectangle(-46, -75, 92, 120);
  private sparkZone = new Phaser.Geom.Rectangle(-46, -60, 92, 90);
  active = false;

  /** `el` = poder con el que se crea (la ZONA usa 'ice'): así encenderla no rehace los emisores a mitad de partido. */
  constructor(private scene: Phaser.Scene, private ch: Character, el: SmashPower = 'fire') {
    ensureTextures(scene);
    this.build(el);
  }

  /** Crea los emisores con los colores del poder (se vuelve a llamar solo si cambia de poder). */
  private build(el: SmashPower) {
    const scene = this.scene;
    const { col: COL, hot: COL_HOT, core: COL_CORE }: Pal = SMASH_LOOK[el].aura;
    this.el = el;
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

  /** Enciende el aura con los colores del poder del SMASH (el); si cambió respecto al anterior, se rehace. */
  start(el: SmashPower = 'fire') {
    if (this.active) return;
    if (el !== this.el) {
      this.destroyParts();
      this.build(el);
    }
    const COL_HOT = SMASH_LOOK[this.el].aura.hot;
    this.active = true;
    this.flames.start();
    this.sparks.start();

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

  stop() {
    if (!this.active) return;
    this.active = false;
    this.flames.stop();
    this.sparks.stop();
  }

  /** Llamar cada frame después de posicionar al personaje. */
  update(_dt: number) {
    if (!this.active) return;
    const ch = this.ch;
    const k = Math.abs(ch.scaleY) || 1;

    // emisores siguen al personaje; las llamas salen del contorno del cuerpo
    const w = 46 * k;
    this.flameZone.setTo(-w, -BODY_H * 0.85 * k, w * 2, BODY_H * 0.85 * k);
    this.sparkZone.setTo(-w, -BODY_H * 0.8 * k, w * 2, BODY_H * 0.7 * k);
    this.flames.setPosition(ch.x, ch.y).setDepth(ch.depth - 0.5);
    this.sparks.setPosition(ch.x, ch.y).setDepth(ch.depth + 0.5);
  }

  private destroyParts() {
    this.flames.destroy();
    this.sparks.destroy();
  }

  destroy() {
    this.stop();
    this.destroyParts();
  }
}



