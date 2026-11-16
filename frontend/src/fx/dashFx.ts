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

  /**
   * Arranque: destello en los pies (pantalla x, y; k = escala del personaje), dos anillos de choque, rayas de velocidad
   * sobre el suelo y polvo. `color` = tono del poder (por defecto el azul-violeta del DASH; el DESTELLO usa el cian).
   * Lo usan igual el usuario, el bot y el rival online (todos llaman a este método).
   */
  burst(x: number, y: number, k: number, depth: number, color: number = this.cfg.ghostTint) {
    const sc = this.scene;
    // destello blanco que se abre y se apaga rápido
    const flash = sc.add.ellipse(x, y - 4 * k, 60 * k, 26 * k, 0xffffff, 0.85).setDepth(depth + 2).setBlendMode('ADD');
    this.track(flash);
    sc.tweens.add({ targets: flash, scaleX: 2.6, scaleY: 2.2, alpha: 0, duration: 170, ease: 'Quad.easeOut', onComplete: () => this.kill(flash) });
    // dos anillos de choque: el segundo sale un poco después y más grande
    for (let i = 0; i < 2; i++) {
      const ring = sc.add.ellipse(x, y, 90 * k, 30 * k, color, i === 0 ? 0.35 : 0.18).setStrokeStyle(i === 0 ? 4 : 3, 0xd9d2ff, 0.9).setDepth(depth - 1);
      this.track(ring);
      sc.tweens.add({ targets: ring, scaleX: i === 0 ? 1.9 : 2.8, scaleY: i === 0 ? 1.9 : 2.8, alpha: 0, delay: i * 70, duration: 260 + i * 80, ease: 'Quad.easeOut', onComplete: () => this.kill(ring) });
    }
    // rayas de velocidad pegadas al suelo, hacia fuera
    const g = sc.add.graphics().setDepth(depth - 0.5).setBlendMode('ADD');
    this.track(g);
    const rays = 10;
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2 + Math.random() * 0.3;
      const r0 = (26 + Math.random() * 10) * k;
      const r1 = r0 + (34 + Math.random() * 30) * k;
      const x0 = x + Math.cos(a) * r0;
      const y0 = y + Math.sin(a) * r0 * 0.34; // aplastado: es el suelo visto en perspectiva
      const x1 = x + Math.cos(a) * r1;
      const y1 = y + Math.sin(a) * r1 * 0.34;
      g.lineStyle(7 * k, color, 0.22).lineBetween(x0, y0, x1, y1);
      g.lineStyle(2.5 * k, i % 2 ? 0xffffff : color, 0.9).lineBetween(x0, y0, x1, y1);
    }
    sc.tweens.add({ targets: g, alpha: 0, duration: 300, ease: 'Quad.easeOut', onComplete: () => this.kill(g) });
    // polvo
    for (let i = 0; i < 8; i++) {
      const d = sc.add.ellipse(x + (Math.random() - 0.5) * 70 * k, y + (Math.random() - 0.5) * 8, (14 + Math.random() * 12) * k, (7 + Math.random() * 5) * k, 0xe8e2d0, 0.7).setDepth(depth + 1);
      this.track(d);
      sc.tweens.add({ targets: d, y: d.y - (6 + Math.random() * 16), scaleX: 1.9, scaleY: 1.9, alpha: 0, duration: 260 + Math.random() * 180, onComplete: () => this.kill(d) });
    }
  }

  /**
   * Estela de movimiento rápido de (ax, ay) a (bx, by), en coordenadas de pantalla (DESTELLO): haces de luz paralelos
   * en la dirección del recorrido que avanzan un poco hacia el destino y se desvanecen. `k` = escala del personaje.
   */
  streak(ax: number, ay: number, bx: number, by: number, k: number, depth: number, color = 0x6fe3ff) {
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    if (len < 8) return;
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;
    const g = this.scene.add.graphics().setDepth(depth + 2).setBlendMode('ADD');
    this.track(g);
    const lines = 14;
    for (let i = 0; i < lines; i++) {
      const off = (i / (lines - 1) - 0.5) * 150 * k + (Math.random() - 0.5) * 8 * k;
      const tail = len * Math.random() * 0.3;
      const head = len * (0.7 + Math.random() * 0.3);
      const x0 = ax + ux * tail + nx * off;
      const y0 = ay + uy * tail + ny * off;
      const x1 = ax + ux * head + nx * off;
      const y1 = ay + uy * head + ny * off;
      const w = (2 + Math.random() * 5) * k;
      g.lineStyle(w * 2.6, color, 0.16).lineBetween(x0, y0, x1, y1); // halo
      g.lineStyle(w, i % 3 === 0 ? 0xffffff : color, 0.85).lineBetween(x0, y0, x1, y1); // núcleo
      g.fillStyle(0xffffff, 0.9).fillCircle(x1, y1, w * 0.9); // punta brillante
    }
    this.scene.tweens.add({ targets: g, x: ux * len * 0.12, y: uy * len * 0.12, alpha: 0, duration: 340, ease: 'Quad.easeOut', onComplete: () => this.kill(g) });
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
