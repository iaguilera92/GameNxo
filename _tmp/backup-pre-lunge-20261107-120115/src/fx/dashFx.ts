import type Phaser from 'phaser';
import type { DASH as DashCfg } from '../logic/DashSprint';

type Cfg = Pick<typeof DashCfg, 'ghostAlpha' | 'ghostTint' | 'ghosts' | 'ghostHoldMs' | 'ghostFadeMs'>;

/**
 * Efectos del DASH (sprint). Independientes de INFERNO DRIVE (no usa GhostTrail ni InfernoFx).
 *  - sombras: copia del aspecto ACTUAL del personaje (sus imágenes/sprites, mismo fotograma, tamaño, giro y
 *    volteo) en la posición real por la que pasa; azul-violeta, se mantienen un instante y se desvanecen.
 *  - arranque: polvo en los pies y un anillo azul-violeta.
 * Solo usa tipos de Phaser (se puede probar en node con una escena simulada). Todo objeto creado se destruye
 * al acabar su animación; `count` dice cuántos quedan vivos.
 */
type Drawable = Phaser.GameObjects.GameObject & {
  visible: boolean;
  texture: Phaser.Textures.Texture;
  frame: Phaser.Textures.Frame;
  originX: number;
  originY: number;
  flipX: boolean;
  getWorldTransformMatrix(): Phaser.GameObjects.Components.TransformMatrix;
};

export class DashFx {
  private live = new Set<Phaser.GameObjects.GameObject>();
  private readonly scene: Phaser.Scene;
  /** ajustes de las sombras (DASH de src/logic/DashSprint.ts) */
  private readonly cfg: Cfg;

  constructor(scene: Phaser.Scene, cfg: Cfg) {
    this.scene = scene;
    this.cfg = cfg;
  }

  /** Objetos de efecto vivos ahora mismo (para comprobar que no se acumulan). */
  get count() {
    return this.live.size;
  }

  /** Sombra nº `index` (0 = la más antigua y tenue) del personaje `ch` en su sitio actual. */
  ghost(ch: Phaser.GameObjects.Container, index: number, depth: number) {
    const alpha = this.cfg.ghostAlpha[index] ?? 0.35;
    for (const o of drawables(ch)) {
      const m = o.getWorldTransformMatrix();
      // descomposición con volteo: una escala negativa (rig volteado) se convierte en flipX, no en un giro de 180°
      const sy = Math.hypot(m.c, m.d);
      const rot = Math.atan2(-m.c, m.d);
      const cos = Math.cos(rot);
      const sx = Math.abs(cos) > 1e-3 ? m.a / cos : m.b / Math.sin(rot);
      const img = this.scene.add
        .image(m.tx, m.ty, o.texture.key, o.frame.name)
        .setOrigin(o.originX, o.originY)
        .setScale(Math.abs(sx), sy)
        .setRotation(rot)
        .setFlipX(o.flipX !== sx < 0)
        .setTint(this.cfg.ghostTint)
        .setAlpha(alpha)
        .setDepth(depth - 0.3 - (this.cfg.ghosts - index) * 0.01);
      this.track(img);
      this.scene.tweens.add({ targets: img, alpha: 0, delay: this.cfg.ghostHoldMs, duration: this.cfg.ghostFadeMs, onComplete: () => this.kill(img) });
    }
  }

  /** Arranque: polvo en los pies (pantalla x, y; k = escala del personaje) y anillo azul-violeta. */
  burst(x: number, y: number, k: number, depth: number) {
    const ring = this.scene.add.ellipse(x, y, 90 * k, 30 * k, this.cfg.ghostTint, 0.35).setStrokeStyle(4, 0xd9d2ff, 0.9).setDepth(depth - 1);
    this.track(ring);
    this.scene.tweens.add({ targets: ring, scaleX: 1.9, scaleY: 1.9, alpha: 0, duration: 260, onComplete: () => this.kill(ring) });
    for (let i = 0; i < 5; i++) {
      const d = this.scene.add.ellipse(x + (Math.random() - 0.5) * 50 * k, y + (Math.random() - 0.5) * 6, (14 + Math.random() * 10) * k, (7 + Math.random() * 4) * k, 0xe8e2d0, 0.7).setDepth(depth + 1);
      this.track(d);
      this.scene.tweens.add({ targets: d, y: d.y - (6 + Math.random() * 14), scaleX: 1.8, scaleY: 1.8, alpha: 0, duration: 260 + Math.random() * 160, onComplete: () => this.kill(d) });
    }
  }

  /** Quita todo al instante (cancelación, fin de punto, cierre de escena). */
  clear() {
    for (const o of [...this.live]) {
      this.scene.tweens.killTweensOf(o);
      this.kill(o);
    }
  }

  private track(o: Phaser.GameObjects.GameObject) {
    this.live.add(o);
  }

  private kill(o: Phaser.GameObjects.GameObject) {
    if (!this.live.delete(o)) return;
    o.destroy();
  }
}

/** Imágenes y sprites visibles dentro de un contenedor (recursivo). */
function drawables(root: Phaser.GameObjects.GameObject): Drawable[] {
  const out: Drawable[] = [];
  const walk = (o: Phaser.GameObjects.GameObject) => {
    const d = o as Drawable & { list?: Phaser.GameObjects.GameObject[] };
    if (d.visible === false) return;
    if (Array.isArray(d.list)) d.list.forEach(walk);
    else if (d.texture && d.frame && typeof d.getWorldTransformMatrix === 'function' && d.texture.key !== '__DEFAULT' && d.texture.key !== '__MISSING') out.push(d);
  };
  walk(root);
  return out;
}
