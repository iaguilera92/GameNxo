import Phaser from 'phaser';
import { C } from './theme';

/** Golpe cargado según el joystick: normal (fuerza) · cortita · globo · cruzado izquierda/derecha. */
export type ChargeShot = 'normal' | 'drop' | 'lob' | 'left' | 'right';
/** Azul eléctrico (carga) y dorado (carga máxima) del arco. */
const BLUE = 0x2f9bff;
const GOLD = 0xffc72e;
const NEON_EDGE = 0x3fd0ff;
const SEGMENTS = 10;
const R_OUT = 46;
const R_IN = 30;

const lerpColor = (a: number, b: number, t: number) => {
  const c = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(a), Phaser.Display.Color.ValueToColor(b), 100, Math.round(t * 100));
  return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
};

/**
 * Indicador único de potencia y dirección del golpe: arco semicircular segmentado sobre la cabeza.
 *  - se llena con `setValue(0..1)`;
 *  - en el centro muestra el icono de fuerza + "FUERZA", o una flecha si hay dirección (`setDirection(-1 | 1)`);
 *  - al llegar al máximo el arco pasa a dorado, da un pulso y sigue latiendo suavemente mientras se mantiene.
 * Solo dibuja: no conoce la lógica del partido (la escena le pasa los valores).
 */
export class ChargeMeter extends Phaser.GameObjects.Container {
  private g: Phaser.GameObjects.Graphics;
  private icon: Phaser.GameObjects.Graphics;
  private value = 0;
  private shot: ChargeShot = 'normal';
  private full = false;
  private t = 0;
  private fade?: Phaser.Tweens.Tween;
  private pop?: Phaser.Tweens.Tween;
  /** escala base (perspectiva) y factor de pulso: la escala final es su producto */
  private baseScale = 1;
  private popK = 1;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    this.setDepth(4400).setVisible(false);
    this.g = scene.add.graphics();
    this.icon = scene.add.graphics();
    this.add([this.g, this.icon]);
    scene.add.existing(this);
  }

  /** Empieza una carga nueva. */
  begin() {
    this.fade?.remove();
    this.pop?.remove();
    this.fade = this.pop = undefined;
    this.popK = 1;
    this.value = 0;
    this.shot = 'normal';
    this.full = false;
    this.t = 0;
    this.setAlpha(1).setVisible(true);
    this.draw();
  }

  /** Oculta el indicador (con desvanecido suave si `soft`). */
  end(soft = true) {
    this.pop?.remove();
    this.pop = undefined;
    if (!this.visible) return;
    this.fade?.remove();
    if (!soft) {
      this.setVisible(false);
      return;
    }
    this.fade = this.scene.tweens.add({ targets: this, alpha: 0, popK: 1.15, duration: 160, onUpdate: () => this.applyScale(), onComplete: () => this.setVisible(false) });
  }

  setValue(v: number) {
    const nv = Phaser.Math.Clamp(v, 0, 1);
    if (nv >= 1 && !this.full) {
      this.full = true;
      this.pulse();
    }
    this.value = nv;
  }

  /** Golpe que saldrá (lo decide el joystick): cambia solo el icono central. No toca la carga. */
  setShot(s: ChargeShot) {
    this.shot = s;
  }

  /** Pulso luminoso (se llama solo al llegar al máximo). */
  pulse() {
    this.pop?.remove();
    this.popK = 1.28;
    this.pop = this.scene.tweens.add({ targets: this, popK: 1, duration: 260, ease: 'Back.easeOut' });
  }

  /** Posición (sobre la cabeza) y escala por perspectiva. */
  place(x: number, y: number, k: number) {
    this.setPosition(x, y);
    this.baseScale = k;
  }

  private applyScale() {
    this.setScale(this.baseScale * this.popK);
  }

  /** Animación y redibujado; llamar cada frame mientras se carga. */
  tick(dt: number) {
    if (!this.visible) return;
    this.t += dt;
    this.applyScale();
    this.draw();
  }

  /**
   * Brazo musculoso (💪): brazo horizontal, bíceps abultado, antebrazo vertical y puño arriba.
   * Se dibuja dos veces: primero engordado en color de contorno y encima el relleno.
   */
  private drawArm(ic: Phaser.GameObjects.Graphics, cy: number, col: number) {
    const k = 0.9;
    const X = (x: number) => x * k;
    const Y = (y: number) => cy + (y + 3) * k;
    const parts = (o: number, c: number) => {
      ic.fillStyle(c, 1);
      ic.fillRoundedRect(X(-15) - o, Y(2) - o, 21 * k + o * 2, 8 * k + o * 2, 4 * k + o); // brazo (hombro → codo)
      ic.fillCircle(X(-5), Y(0), 7.5 * k + o); // bíceps
      ic.fillCircle(X(6), Y(6), 4.5 * k + o); // codo
      ic.fillRoundedRect(X(2) - o, Y(-9) - o, 8 * k + o * 2, 17 * k + o * 2, 4 * k + o); // antebrazo
      ic.fillCircle(X(6.5), Y(-11), 6 * k + o); // puño
    };
    parts(2.4, C.outline);
    parts(0, col);
    // sombra bajo el bíceps y nudillos
    ic.lineStyle(1.8, 0xb57a00, 1);
    ic.beginPath().arc(X(-5), Y(0), 5.2 * k, Math.PI * 0.2, Math.PI * 0.85).strokePath();
    ic.lineBetween(X(3), Y(-13), X(10), Y(-13));
    // brillo del bíceps
    ic.fillStyle(0xffffff, 0.65).fillEllipse(X(-7), Y(-3.5), 6 * k, 2.8 * k);
  }

  private draw() {
    const g = this.g;
    const v = this.value;
    const mix = Phaser.Math.Clamp((v - 0.75) / 0.25, 0, 1); // azul -> dorado en el último cuarto
    const col = lerpColor(BLUE, GOLD, mix);
    const beat = this.full ? 0.5 + 0.5 * Math.sin(this.t * 9) : 0;
    g.clear();

    // base semicircular con borde neón
    const fillBase = (r: number, color: number, a: number) => {
      g.fillStyle(color, a).beginPath().arc(0, 0, r, Math.PI, Math.PI * 2).closePath().fillPath();
    };
    fillBase(R_OUT + 8, NEON_EDGE, this.full ? 0.55 + 0.35 * beat : 0.75);
    fillBase(R_OUT + 4, C.outline, 1);
    fillBase(R_IN - 3, 0x0d1d44, 0.95);

    // segmentos del arco (de izquierda a derecha)
    const span = Math.PI / SEGMENTS;
    const gap = 0.07;
    for (let i = 0; i < SEGMENTS; i++) {
      const a0 = Math.PI + i * span + gap;
      const a1 = Math.PI + (i + 1) * span - gap;
      const fill = Phaser.Math.Clamp(v * SEGMENTS - i, 0, 1);
      const rMid = (R_OUT + R_IN) / 2;
      const w = R_OUT - R_IN;
      g.lineStyle(w, 0x16306b, 0.95).beginPath().arc(0, 0, rMid, a0, a1).strokePath();
      if (fill > 0) {
        const c = this.full ? lerpColor(GOLD, 0xfff2a8, beat * 0.7) : col;
        g.lineStyle(w, c, 0.55 + 0.45 * fill).beginPath().arc(0, 0, rMid, a0, a1).strokePath();
        g.lineStyle(3, 0xffffff, 0.45 * fill).beginPath().arc(0, 0, R_OUT - 3, a0 + 0.02, a1 - 0.02).strokePath();
      }
    }

    // centro: SOLO icono (sin texto) según el golpe que saldrá
    const ic = this.icon;
    ic.clear();
    const CY = -14; // centro del icono dentro del semicírculo
    const shape = (pts: number[], k: number, dx = 0, dy = 0) => {
      const out: Phaser.Math.Vector2[] = [];
      for (let i = 0; i < pts.length; i += 2) out.push(new Phaser.Math.Vector2(pts[i] * k + dx, CY + pts[i + 1] * k + dy));
      return out;
    };
    const icon = (pts: number[], color: number, k = 1) => {
      ic.fillStyle(C.outline).fillPoints(shape(pts, k * 1.24), true);
      ic.fillStyle(color).fillPoints(shape(pts, k), true);
    };
    const shot = this.shot;
    if (shot === 'normal') {
      // brazo musculoso (bíceps flexionado, puño arriba)
      this.drawArm(ic, CY, this.full ? 0xfff2a8 : 0xffd23f);
    } else if (shot === 'lob' || shot === 'drop') {
      // globo = flecha arriba · cortita = flecha abajo
      const s = shot === 'lob' ? 1 : -1;
      const arrow = [0, -15 * s, 12, -3 * s, 5, -3 * s, 5, 13 * s, -5, 13 * s, -5, -3 * s, -12, -3 * s];
      icon(arrow, shot === 'lob' ? 0xffd23f : 0xdfe6f5);
    } else {
      const s = shot === 'left' ? -1 : 1;
      const arrow = [16 * s, 0, 4 * s, -12, 4 * s, -5, -14 * s, -5, -14 * s, 5, 4 * s, 5, 4 * s, 12];
      icon(arrow, 0xffffff);
    }
  }
}