import Phaser from 'phaser';

/**
 * Efecto visual de la ZONA sobre un personaje:
 *  - aura eléctrica (halo azul-blanco que late + anillo en los pies + chispas que suben)
 *  - "rayo en los ojos": estela de luz que sale de la cabeza y se arrastra con el movimiento (se dibuja con las
 *    posiciones recientes de la cabeza, así que al correr deja un trazo largo).
 * Solo visual. `update()` cada fotograma con la cabeza y los pies en pantalla.
 */
const COL = 0x5fd4ff;
const HOT = 0xe8fbff;

export class ZoneFx {
  private aura: Phaser.GameObjects.Graphics;
  private trail: Phaser.GameObjects.Graphics;
  private hist: { x: number; y: number }[] = [];
  private t = 0;
  private sparkAt = 0;
  active = false;

  constructor(private scene: Phaser.Scene) {
    this.aura = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.trail = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
  }

  start() {
    this.active = true;
    this.hist = [];
    this.aura.setVisible(true);
    this.trail.setVisible(true);
  }

  stop() {
    this.active = false;
    this.aura.clear().setVisible(false);
    this.trail.clear().setVisible(false);
    this.hist = [];
  }

  /**
   * `head` = punto de la cabeza en pantalla, `feet` = pies, `k` = escala de perspectiva, `depth` = profundidad del
   * personaje, `side` = hacia dónde mira la cara en pantalla (1 derecha / -1 izquierda; los ojos se desplazan).
   */
  update(dt: number, head: { x: number; y: number }, feet: { x: number; y: number }, k: number, depth: number, side: number) {
    if (!this.active) return;
    this.t += dt;
    const a = this.aura.clear().setDepth(depth - 0.05);
    const pulse = 1 + Math.sin(this.t * 10) * 0.08;
    const h = (feet.y - head.y) * 1.15;
    // halo alargado alrededor del cuerpo
    a.fillStyle(COL, 0.12).fillEllipse(feet.x, feet.y - h * 0.45, 120 * k * pulse, h * 1.05 * pulse);
    a.fillStyle(HOT, 0.08).fillEllipse(feet.x, feet.y - h * 0.45, 80 * k * pulse, h * 0.85 * pulse);
    // anillo en el suelo
    a.lineStyle(4 * k, COL, 0.75).strokeEllipse(feet.x, feet.y, 110 * k * pulse, 36 * k * pulse);
    // rayitos verticales que suben por el aura
    for (let i = 0; i < 5; i++) {
      const ph = (this.t * 1.6 + i / 5) % 1;
      const x = feet.x + Math.sin(i * 2.1 + this.t * 3) * 42 * k;
      const y0 = feet.y - ph * h;
      a.lineStyle(2.5 * k, i % 2 ? HOT : COL, (1 - ph) * 0.9).lineBetween(x, y0, x + Math.sin(this.t * 20 + i) * 4 * k, y0 - 18 * k);
    }
    // rayo de los ojos: estela con las últimas posiciones del ojo
    const eye = { x: head.x + side * 10 * k, y: head.y + 26 * k };
    this.hist.unshift(eye);
    if (this.hist.length > 14) this.hist.pop();
    // siempre algo de estela aunque esté quieto: se alarga hacia atrás/arriba con un temblor eléctrico
    const tr = this.trail.clear().setDepth(depth + 0.05);
    const pts = this.hist.map((p, i) => ({ x: p.x - side * i * 3.5 * k + Math.sin(this.t * 40 + i) * 2 * k, y: p.y - i * 1.2 * k }));
    for (let i = 0; i < pts.length - 1; i++) {
      const f = 1 - i / pts.length;
      tr.lineStyle(9 * k * f, COL, 0.35 * f).lineBetween(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
      tr.lineStyle(3.5 * k * f, HOT, 0.95 * f).lineBetween(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
    }
    tr.fillStyle(HOT, 1).fillCircle(eye.x, eye.y, 4 * k);
    // chispas sueltas de vez en cuando
    this.sparkAt -= dt;
    if (this.sparkAt <= 0) {
      this.sparkAt = 0.12;
      const sx = feet.x + Phaser.Math.FloatBetween(-40, 40) * k;
      const sy = feet.y - Phaser.Math.FloatBetween(0.2, 0.9) * h;
      const sp = this.scene.add.circle(sx, sy, 3 * k, HOT, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(depth + 0.04);
      this.scene.tweens.add({ targets: sp, y: sy - 30 * k, alpha: 0, scale: 0.3, duration: 420, onComplete: () => sp.destroy() });
    }
  }

  destroy() {
    this.aura.destroy();
    this.trail.destroy();
  }
}
