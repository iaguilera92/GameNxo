import Phaser from 'phaser';
import { SKATE } from '../logic/DefensiveMoves';
import { project } from '../view/projection';

/**
 * CAMINO DE HIELO del PATINAJE (DEFENSIVO): una cinta de hielo claro sobre la cancha que sigue el recorrido del patinador, con
 * borde blanco y destellos. Es solo visual (no cambia el bote ni la velocidad de la pelota). Se queda entero SKATE.holdMs y se
 * derrite (se desvanece) en SKATE.fadeMs. Un solo Graphics: se redibuja mientras patina y luego queda quieto.
 */
const ICE = { body: 0x9fe6ff, core: 0xeafcff, edge: 0xffffff, spark: 0xffffff };

export class IceTrail {
  private g: Phaser.GameObjects.Graphics;
  private pts: { x: number; y: number }[] = [];
  private fading = false;
  /** aviso al terminar de derretirse (la escena lo saca de su lista) */
  onGone?: () => void;

  constructor(private scene: Phaser.Scene) {
    // sobre la cancha y bajo los personajes (su profundidad es su y de pantalla)
    this.g = scene.add.graphics().setDepth(1);
  }

  /** Añade un punto del recorrido (coordenadas de cancha). */
  add(x: number, y: number) {
    if (this.fading || !this.g.active) return;
    const last = this.pts[this.pts.length - 1];
    if (last && Math.hypot(x - last.x, y - last.y) < 4) return;
    this.pts.push({ x, y });
    this.draw();
  }

  /** Terminó el patinaje: el hielo se queda un momento y se derrite. */
  finish() {
    if (this.fading || !this.g.active) return;
    this.fading = true;
    this.draw();
    this.scene.tweens.add({
      targets: this.g,
      alpha: 0,
      delay: SKATE.holdMs,
      duration: SKATE.fadeMs,
      ease: 'Quad.easeIn',
      onComplete: () => this.destroy(),
    });
  }

  destroy() {
    if (this.g.active) {
      this.scene.tweens.killTweensOf(this.g);
      this.g.destroy();
    }
    this.pts.length = 0;
    const cb = this.onGone;
    this.onGone = undefined;
    cb?.();
  }

  private draw() {
    const g = this.g;
    g.clear();
    const n = this.pts.length;
    if (n < 2) return;
    const sp = this.pts.map((p) => project(p.x, p.y));
    // cinta: tres capas (borde blanco, cuerpo azul claro, núcleo casi blanco); más ancha al principio y se afina al final
    const layers: [number, number, number][] = [[1.0, ICE.edge, 0.5], [0.78, ICE.body, 0.6], [0.4, ICE.core, 0.85]];
    for (const [wk, col, a] of layers) {
      for (let i = 1; i < n; i++) {
        const t = i / n;
        const w = SKATE.width * wk * sp[i].s * (0.55 + 0.45 * t);
        g.lineStyle(Math.max(2, w), col, a).lineBetween(sp[i - 1].sx, sp[i - 1].sy, sp[i].sx, sp[i].sy);
      }
    }
    // destellos de hielo repartidos por el camino
    for (let i = 2; i < n; i += 3) {
      const p = sp[i];
      const r = 4 * p.s;
      g.lineStyle(Math.max(1, 1.4 * p.s), ICE.spark, 0.9).lineBetween(p.sx - r, p.sy - 2, p.sx + r, p.sy - 2).lineBetween(p.sx, p.sy - 2 - r, p.sx, p.sy - 2 + r);
    }
  }
}

/** Rociada de hielo al frenar el patinaje: abanico de esquirlas hacia delante y un anillo azul en el suelo. `dir` = 1 / -1 (lado de pantalla). */
export function iceSprayFx(scene: Phaser.Scene, x: number, y: number, dir: number) {
  const p = project(x, y);
  const k = p.s;
  const ring = scene.add.ellipse(p.sx, p.sy, 70 * k, 24 * k).setStrokeStyle(4 * k, 0x9fe6ff, 0.95).setDepth(p.sy - 0.5).setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({ targets: ring, scale: 2.8, alpha: 0, duration: 380, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
  for (let i = 0; i < 9; i++) {
    const a = (-0.9 + (i / 8) * 1.8) * 0.8;
    const sh = scene.add.triangle(p.sx, p.sy - 6 * k, 0, 0, 7 * k, 3 * k, 0, 6 * k, i % 2 ? 0xeafcff : 0x9fe6ff, 0.95).setDepth(p.sy + 1).setBlendMode(Phaser.BlendModes.ADD);
    sh.setRotation(a + (dir < 0 ? Math.PI : 0));
    const d = (50 + Math.random() * 50) * k;
    scene.tweens.add({
      targets: sh,
      x: p.sx + Math.cos(a) * d * (dir < 0 ? -1 : 1),
      y: p.sy - 6 * k + Math.sin(a) * d * 0.5 - 14 * k,
      alpha: 0,
      scale: 0.3,
      duration: 380 + Math.random() * 160,
      ease: 'Cubic.easeOut',
      onComplete: () => sh.destroy(),
    });
  }
}
