import Phaser from 'phaser';
import { project } from '../view/projection';
import { LOB_SMASH, type LobState } from '../logic/LobSmash';

/**
 * Indicador de caída del globo: círculo en el SUELO de la cancha, en perspectiva (se proyecta un
 * círculo de cancha con la misma métrica que el alcance: el lateral pesa 1,25). Solo visual.
 *
 * Aspecto: disco suave (degradado radial), anillo neón con halo, marcas que giran y un LATIDO
 * (doble pulso "pum-pum") que emite ondas hacia fuera. Más rápido y dorado cuando toca rematar.
 *
 * Estados de color:
 *   neutro      cian (contrasta con pista azul y con arcilla)
 *   listo       dorado (el receptor está dentro y la ventana del SMASH potenciado está abierta)
 *   fuera       rojo (el globo cae fuera de la cancha)
 */
const COL = {
  neutral: 0x37e0ff,
  ready: 0xffc42e,
  out: 0xff5a6a,
  readyInner: 0x6fb2ff,
};

/** Latido: periodo (s) y amplitud del pulso, por estado. */
const BEAT = {
  neutral: { period: 0.95, amp: 0.1 },
  ready: { period: 0.55, amp: 0.15 },
};

interface Ripple {
  age: number;
  color: number;
}

export class LobMarker {
  private g: Phaser.GameObjects.Graphics;
  private wasReady = false;
  private t = 0;
  private alpha = 0;
  private beatPhase = 0;
  private ripples: Ripple[] = [];

  constructor(private scene: Phaser.Scene) {
    // justo encima del suelo de la cancha (la cancha horneada está en -10; la mira de saque en 0.8)
    this.g = scene.add.graphics().setDepth(0.9);
  }

  /** Dibuja el círculo. `inside`: el receptor está dentro; `ready`: además puede armar el potenciado. */
  render(dt: number, st: LobState, inside: boolean, ready: boolean) {
    this.t += dt;
    const show = st.active;
    this.alpha = Phaser.Math.Clamp(this.alpha + (show ? dt * 6 : -dt * 8), 0, 1);
    this.g.clear();
    if (this.alpha <= 0) {
      this.wasReady = false;
      this.ripples.length = 0;
      return;
    }
    const out = !st.inCourt && !LOB_SMASH.allowOutLob;
    const color = out ? COL.out : ready ? COL.ready : COL.neutral;
    const R = LOB_SMASH.radius;
    const a = this.alpha;

    // --- latido: doble pulso por periodo; cada latido lanza una onda
    const beat = ready ? BEAT.ready : BEAT.neutral;
    const prev = this.beatPhase;
    this.beatPhase = (this.beatPhase + dt / beat.period) % 1;
    if (this.beatPhase < prev && show) this.ripples.push({ age: 0, color });
    const u = this.beatPhase;
    const pulse = Math.exp(-(((u - 0.06) / 0.07) ** 2)) + 0.55 * Math.exp(-(((u - 0.3) / 0.07) ** 2));
    const k = 1 + beat.amp * pulse;

    // --- ondas (detrás de todo)
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const rp = this.ripples[i];
      rp.age += dt;
      const life = 0.75;
      if (rp.age >= life) {
        this.ripples.splice(i, 1);
        continue;
      }
      const f = rp.age / life;
      const pts = this.ring(st.x, st.y, R * (1 + 0.7 * Phaser.Math.Easing.Cubic.Out(f)));
      this.g.lineStyle(4 * (1 - f) + 1, rp.color, 0.6 * (1 - f) * a).strokePoints(pts, true, true);
    }

    // --- base oscura muy suave (contraste sobre pista clara u oscura)
    this.g.fillStyle(0x000000, 0.14 * a).fillPoints(this.ring(st.x, st.y, R * 1.06 * k, 32), true);
    // --- disco: degradado radial (capas concéntricas)
    const fillA = (inside ? 0.1 : 0.065) * (1 + 0.6 * pulse);
    for (const f of [1, 0.78, 0.56, 0.34]) this.g.fillStyle(color, fillA * a).fillPoints(this.ring(st.x, st.y, R * f * k, 32), true);

    // --- anillo neón: halo ancho + línea de color + filo blanco
    const main = this.ring(st.x, st.y, R * k);
    this.g.lineStyle(14, color, (0.1 + 0.12 * pulse) * a).strokePoints(main, true, true);
    this.g.lineStyle(7, color, (0.25 + 0.15 * pulse) * a).strokePoints(main, true, true);
    this.g.lineStyle(3.5, color, a).strokePoints(main, true, true);
    this.g.lineStyle(1.4, 0xffffff, (0.55 + 0.35 * pulse) * a).strokePoints(main, true, true);

    // --- 4 marcas de mira que giran por fuera del anillo
    const spin = this.t * (ready ? 2.4 : 1.1);
    for (let i = 0; i < 4; i++) {
      const a0 = spin + (i * Math.PI) / 2;
      const arc = this.arc(st.x, st.y, R * 1.2 * k, a0 - 0.32, a0 + 0.32);
      this.g.lineStyle(4, color, 0.85 * a).strokePoints(arc, false, false);
    }

    // --- anillo interior (listo) + centro
    if (ready) {
      const inner = this.ring(st.x, st.y, R * 0.5 * (2 - k));
      this.g.lineStyle(6, COL.readyInner, 0.25 * a).strokePoints(inner, true, true);
      this.g.lineStyle(2.5, COL.readyInner, 0.9 * a).strokePoints(inner, true, true);
    }
    const c = project(st.x, st.y);
    this.g.fillStyle(color, 0.5 * a).fillEllipse(c.sx, c.sy, 20 * c.s * k, 9 * c.s * k);
    this.g.fillStyle(0xffffff, 0.95 * a).fillEllipse(c.sx, c.sy, 9 * c.s, 4 * c.s);

    // activación: al abrirse la ventana con el receptor dentro, un destello que se expande
    if (ready && !this.wasReady) this.burst(st.x, st.y);
    this.wasReady = ready;
  }

  hide() {
    this.alpha = 0;
    this.g.clear();
    this.wasReady = false;
    this.ripples.length = 0;
  }

  /** Círculo de cancha proyectado a pantalla. */
  private ring(x: number, y: number, r: number, n = 40) {
    const pts: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < n; i++) pts.push(this.pt(x, y, r, (i / n) * Math.PI * 2));
    return pts;
  }

  /** Arco abierto de cancha proyectado (a0..a1 en radianes, n+1 puntos). */
  private arc(x: number, y: number, r: number, a0: number, a1: number, n = 8) {
    const pts: Phaser.Math.Vector2[] = [];
    for (let i = 0; i <= n; i++) pts.push(this.pt(x, y, r, a0 + ((a1 - a0) * i) / n));
    return pts;
  }

  private pt(x: number, y: number, r: number, a: number) {
    const p = project(x + Math.cos(a) * r, y + (Math.sin(a) * r) / 1.25);
    return new Phaser.Math.Vector2(p.sx, p.sy);
  }

  private burst(x: number, y: number) {
    const c = project(x, y);
    const e = this.scene.add
      .ellipse(c.sx, c.sy, LOB_SMASH.radius * 2 * c.s, (LOB_SMASH.radius * 2 * c.s) / 2.4, COL.ready, 0)
      .setStrokeStyle(4, COL.ready, 1)
      .setDepth(0.95)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: e, scale: 1.8, alpha: 0, duration: 420, ease: 'Quad.easeOut', onComplete: () => e.destroy() });
  }
}

/**
 * Efectos del SMASH POTENCIADO (además de los del SMASH normal): destello dorado + azul, ondas dobles
 * y un leve "zoom" de cámara. Sin textos grandes.
 */
export function superSmashFx(scene: Phaser.Scene, sx: number, sy: number) {
  for (const [col, delay, size] of [
    [0xffc42e, 0, 5],
    [0x3a8bff, 70, 6.5],
  ] as const) {
    const ring = scene.add.circle(sx, sy, 16, 0xffffff, 0).setStrokeStyle(7, col, 1).setDepth(3600).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: ring, scale: size, alpha: 0, delay, duration: 420, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
  }
  const core = scene.add.circle(sx, sy, 26, 0xfff1b8, 0.9).setDepth(3601).setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({ targets: core, scale: 2.6, alpha: 0, duration: 260, onComplete: () => core.destroy() });
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const d = Phaser.Math.FloatBetween(50, 120);
    const st = scene.add.star(sx, sy, 4, 3, 9, i % 2 ? 0xffd23f : 0x6fd0ff).setDepth(3601).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: st, x: sx + Math.cos(a) * d, y: sy + Math.sin(a) * d * 0.7, alpha: 0, angle: 220, duration: 380, onComplete: () => st.destroy() });
  }
  scene.cameras.main.flash(140, 255, 220, 120);
}
