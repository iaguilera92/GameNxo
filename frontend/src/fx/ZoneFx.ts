import Phaser from 'phaser';

/**
 * Efecto visual de la ZONA sobre un personaje:
 *  - aura eléctrica que irradia (rayitos y chispas que suben; sin halo ni anillo)
 *  - "rayo en los ojos": estela de luz que sale de la cabeza y se arrastra con el movimiento (se dibuja con las
 *    posiciones recientes de la cabeza, así que al correr deja un trazo largo).
 * Solo visual. `update()` cada fotograma con la cabeza y los pies en pantalla.
 */
/** colores por defecto (Zona ELÉCTRICA); cada ESTILO DE ZONA trae los suyos (domain/zoneSkins.ts → setLook) */
const COL = 0x5fd4ff;
const HOT = 0xe8fbff;
/** largo del rayo de los ojos: puntos de la estela y separación base entre ellos (13-11-2026: 14 / 3,5 -> 20 / 4,5) */
const TRAIL_N = 20;
const TRAIL_STEP = 4.5;

/**
 * ALTURA DE LOS OJOS sobre los pies (unidades del personaje, alto de pie = 150) y separación del ojo al centro, por personaje y vista.
 * Medido en el frame 1 del idle de cada hoja (21-11-2026): antes el rayo salía de cabeza + 26 (≈124) para todos y en NXO de frente
 * quedaba en la boca (sus ojos están a ~138: cabeza grande) y en la Tienda (cabeza + 26 con otra base) en el cuello.
 *   nxo front: ojos en y≈48 de 190, pies en 186, escala 1        → 138
 *   mai front: ojos en y≈100 de 225, pies en 216, escala 150/182 → 96
 *   nxo back:  altura de las orejas (y≈88 de 240), pies 236, escala 150/190 → 117
 *   mai back:  bajo la visera (y≈68 de 225), pies 221, escala 150/190      → 121
 * Si se cambia una hoja de idle, volver a medir aquí.
 */
export const ZONE_EYES: Record<string, { front: { up: number; dx: number }; back: { up: number; dx: number } }> = {
  nxo: { front: { up: 138, dx: 9 }, back: { up: 117, dx: 10 } },
  mai: { front: { up: 96, dx: 9 }, back: { up: 121, dx: 10 } },
};
/** ojos del personaje `skin` en la vista `view` (los desconocidos, como NXO) */
export function zoneEyes(skin: string | undefined, view: 'front' | 'back') {
  return (ZONE_EYES[skin ?? 'nxo'] ?? ZONE_EYES.nxo)[view];
}

export class ZoneFx {
  private aura: Phaser.GameObjects.Graphics;
  private trail: Phaser.GameObjects.Graphics;
  private hist: { x: number; y: number }[] = [];
  private t = 0;
  private sparkAt = 0;
  private smokeAt = 0;
  private col = COL;
  private hot = HOT;
  /** humo oscuro alrededor (Zona de SOMBRA) */
  private smoke = false;
  /** sin aura (Zona por defecto): solo el rayo de los ojos, sin rayitos ni chispas */
  private noAura = false;
  active = false;
  /** radio del punto de luz en el ojo (unidades del personaje); la demo de la Zona lo achica (16-11-2026) */
  eyeDot = 4;

  /** Colores del ESTILO DE ZONA (domain/zoneSkins.ts): rayo de los ojos, rayitos, chispas y, la Sombra, humo negro. */
  setLook(look: { col: number; hot: number; smoke?: boolean; noAura?: boolean }) {
    this.col = look.col;
    this.hot = look.hot;
    this.smoke = !!look.smoke;
    this.noAura = !!look.noAura;
  }

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
   * `back` = personaje de espaldas (jugador): sus ojos no se ven, así que el rayo va DETRÁS del sprite.
   * `eyes` = altura de los ojos y separación (ZONE_EYES, según personaje y vista); `eyeK` = escala del dibujo si el personaje está más
   * grande que `k` (crece un 10 % con el aura de Zona). Sin `eyes`, como antes (cabeza + 26).
   */
  update(dt: number, head: { x: number; y: number }, feet: { x: number; y: number }, k: number, depth: number, side: number, back = false, eyes?: { up: number; dx: number }, eyeK = k) {
    if (!this.active) return;
    this.t += dt;
    const a = this.aura.clear().setDepth(depth - 0.05);
    const h = (feet.y - head.y) * 1.15;
    // rayitos verticales que suben por el aura (no en la Zona por defecto: el aura es de los estilos que se venden)
    for (let i = 0; i < (this.noAura ? 0 : 5); i++) {
      const ph = (this.t * 1.6 + i / 5) % 1;
      const x = feet.x + Math.sin(i * 2.1 + this.t * 3) * 42 * k;
      const y0 = feet.y - ph * h;
      a.lineStyle(2.5 * k, i % 2 ? this.hot : this.col, (1 - ph) * 0.9).lineBetween(x, y0, x + Math.sin(this.t * 20 + i) * 4 * k, y0 - 18 * k);
    }
    // rayo de los ojos: estela con las últimas posiciones del ojo
    const eye = eyes ? { x: feet.x + side * eyes.dx * eyeK, y: feet.y - eyes.up * eyeK } : { x: head.x + side * 10 * k, y: head.y + 26 * k };
    this.hist.unshift(eye);
    if (this.hist.length > TRAIL_N) this.hist.pop();
    // siempre algo de estela aunque esté quieto: se alarga hacia atrás/arriba con un temblor eléctrico
    const tr = this.trail.clear().setDepth(back ? depth - 0.04 : depth + 0.05);
    const pts = this.hist.map((p, i) => ({ x: p.x - side * i * TRAIL_STEP * k + Math.sin(this.t * 40 + i) * 2 * k, y: p.y - i * 1.2 * k }));
    for (let i = 0; i < pts.length - 1; i++) {
      const f = 1 - i / pts.length;
      // (16-11-2026, usuario) el rayo con el COLOR de su estilo (fuego naranja, sombra morada): el núcleo antes era `hot` (casi blanco en
      // todos) y se veían iguales; ahora el cuerpo es `col` y solo un hilo fino central es `hot`
      tr.lineStyle(9 * k * f, this.col, 0.45 * f).lineBetween(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
      tr.lineStyle(3.5 * k * f, this.col, 0.95 * f).lineBetween(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
      tr.lineStyle(1.2 * k * f, this.hot, 0.9 * f).lineBetween(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
    }
    tr.fillStyle(this.col, 1).fillCircle(eye.x, eye.y, this.eyeDot * k);
    tr.fillStyle(this.hot, 1).fillCircle(eye.x, eye.y, this.eyeDot * 0.5 * k);
    // SOMBRA: LLAMAS NEGRAS que suben alrededor del cuerpo (16-11-2026, usuario: antes eran círculos de humo). Lengua de fuego (gota
    // con punta arriba) negra con borde morado; se estira hacia arriba, se mece y se apaga (mezcla normal: oscurecen)
    if (this.smoke) {
      this.smokeAt -= dt;
      if (this.smokeAt <= 0) {
        this.smokeAt = 0.06;
        const mx = feet.x + Phaser.Math.FloatBetween(-38, 38) * k;
        const my = feet.y - Phaser.Math.FloatBetween(0, 0.7) * h;
        const s = Phaser.Math.FloatBetween(10, 17) * k;
        const fl = this.scene.add.graphics({ x: mx, y: my }).setDepth(depth - 0.06);
        const lean = Phaser.Math.FloatBetween(-0.35, 0.35);
        const flame = (w: number, hh: number) => {
          const pts: Phaser.Math.Vector2[] = [];
          for (let i = 0; i <= 12; i++) {
            const a = (i / 12) * Math.PI; // base redonda (abajo) de derecha a izquierda
            pts.push(new Phaser.Math.Vector2(Math.cos(a) * w, Math.sin(a) * w * 0.8));
          }
          pts.push(new Phaser.Math.Vector2(-w * 0.55, -hh * 0.45));
          pts.push(new Phaser.Math.Vector2(lean * w, -hh)); // punta
          pts.push(new Phaser.Math.Vector2(w * 0.55, -hh * 0.45));
          return pts;
        };
        fl.fillStyle(0x3a1670, 0.55).fillPoints(flame(s * 0.62, s * 2.3), true); // borde morado
        fl.fillStyle(Phaser.Math.RND.pick([0x07040d, 0x120821, 0x1a0c2e]), 0.85).fillPoints(flame(s * 0.48, s * 1.9), true);
        fl.setScale(0.6, 0.5);
        this.scene.tweens.add({
          targets: fl,
          y: my - Phaser.Math.FloatBetween(28, 55) * k,
          x: mx + Phaser.Math.FloatBetween(-10, 10) * k,
          scaleX: 1,
          scaleY: 1.35,
          angle: lean * 25,
          alpha: 0,
          duration: Phaser.Math.Between(450, 750),
          ease: 'Sine.easeOut',
          onComplete: () => fl.destroy(),
        });
      }
    }
    // chispas sueltas de vez en cuando
    this.sparkAt -= dt;
    if (this.sparkAt <= 0 && !this.noAura) {
      this.sparkAt = 0.12;
      const sx = feet.x + Phaser.Math.FloatBetween(-40, 40) * k;
      const sy = feet.y - Phaser.Math.FloatBetween(0.2, 0.9) * h;
      const sp = this.scene.add.circle(sx, sy, 3 * k, this.hot, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(depth + 0.04);
      this.scene.tweens.add({ targets: sp, y: sy - 30 * k, alpha: 0, scale: 0.3, duration: 420, onComplete: () => sp.destroy() });
    }
  }

  destroy() {
    this.aura.destroy();
    this.trail.destroy();
  }
}
