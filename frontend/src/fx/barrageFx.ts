import Phaser from 'phaser';
import { project } from '../view/projection';

/**
 * (17-11-2026) ULTI RÁFAGA (`barrage`, sin hoja de sprites): una ráfaga de pelotas de tenis. SOLO VISUAL: la pelota real (la
 * que cuenta para el juego) va siempre en el centro como siempre; alrededor y detrás vuelan pelotas "fantasma" que siguen su
 * camino con pequeños retrasos y desvíos (como una máquina lanzapelotas). Todo se dibuja con UN Graphics por efecto (se
 * redibuja cada fotograma, sin crear objetos por fotograma).
 *   BarrageTrail   las pelotas fantasma en vuelo (InfernoFire), en perspectiva (project, desvíos en unidades del mundo)
 *   barrageSlam    impacto: las pelotas llegan una tras otra ("ta-ta-ta-ta") y al final rebotan en todas direcciones
 *   ballSpray      abanico de pelotas que salen disparadas (raqueta, rebote final, pared)
 *   addBarragePreview  vista previa (Tienda, Personalización): pelota central con una ráfaga girando alrededor
 */
/** ¿Se ve el contenedor? (él y todos sus padres visibles): las vistas previas animadas por código no se redibujan si no se ven (tarjetas fuera de pantalla, Tienda congelada tras VER). */
export function isShown(c: Phaser.GameObjects.Container): boolean {
  let o: Phaser.GameObjects.Container | null = c;
  while (o) {
    if (!o.visible) return false;
    o = o.parentContainer;
  }
  return true;
}

export const BARRAGE_COL = { glow: 0xd8ff3a, light: 0xeaff8a, white: 0xffffff };

/**
 * Pelota de tenis en un Graphics: centro (x, y), radio r, giro `rot` (costuras) y opacidad `a`. Mismo dibujo que la pelota
 * del partido (fieltro amarillo lima con la costura blanca).
 */
export function drawBarrageBall(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, rot: number, a = 1, lite = false) {
  if (lite) {
    // versión barata (las pelotas de atrás, chicas y tenues): contorno, fieltro y un brillo; sin costuras
    g.fillStyle(0x0a1638, 0.8 * a).fillCircle(x, y, r * 1.12);
    g.fillStyle(0xd7f53a, a).fillCircle(x, y, r);
    g.fillStyle(0xffffff, 0.5 * a).fillCircle(x - r * 0.35, y - r * 0.38, r * 0.28);
    return;
  }
  g.fillStyle(0x0a1638, 0.85 * a).fillCircle(x, y, r * 1.12);
  g.fillStyle(0xd7f53a, a).fillCircle(x, y, r);
  g.fillStyle(0xa9c91e, 0.6 * a).fillCircle(x + r * 0.22, y + r * 0.25, r * 0.78);
  g.fillStyle(0xeefe7a, 0.9 * a).fillCircle(x - r * 0.12, y - r * 0.14, r * 0.68);
  if (r >= 2.2) {
    const c = Math.cos(rot) * r * 1.25;
    const s = Math.sin(rot) * r * 1.25;
    g.lineStyle(Math.max(1, r * 0.13), 0xffffff, 0.95 * a);
    g.beginPath();
    g.arc(x - c, y - s, r * 0.95, rot - 0.75, rot + 0.75);
    g.strokePath();
    g.beginPath();
    g.arc(x + c, y + s, r * 0.95, rot + Math.PI - 0.75, rot + Math.PI + 0.75);
    g.strokePath();
  }
  g.fillStyle(0xffffff, 0.55 * a).fillCircle(x - r * 0.38, y - r * 0.42, r * 0.24);
}

/** Estela corta (desenfoque de movimiento) de una pelota: de (x0, y0) a (x1, y1), ancho según su radio. */
function streak(g: Phaser.GameObjects.Graphics, x0: number, y0: number, x1: number, y1: number, r: number, a: number) {
  if (Math.abs(x1 - x0) + Math.abs(y1 - y0) < 1) return;
  g.lineStyle(r * 1.7, BARRAGE_COL.glow, 0.16 * a).lineBetween(x0, y0, x1, y1);
  g.lineStyle(r * 0.8, BARRAGE_COL.light, 0.32 * a).lineBetween(x0, y0, x1, y1);
}

// ---------------------------------------------------------------- en vuelo
/** Formación de las pelotas fantasma: desvío lateral (oy) y de altura (oz) en unidades del mundo, retraso (s), tamaño y opacidad. */
const GHOST_N = 24; // (17-11-2026) antes 10 (luego 15): más pelotas yendo hacia el rival
const GHOSTS = Array.from({ length: GHOST_N }, (_, i) => {
  const u = (i + 1) / GHOST_N;
  const ang = i * 2.39996; // ángulo de oro: repartidas sin formar filas
  const rad = 9 + 27 * Math.sqrt(u);
  return { oy: Math.cos(ang) * rad, oz: Math.sin(ang) * rad * 0.8, lag: 0.02 + 0.14 * u, size: 0.9 - 0.3 * u, alpha: 0.85 - 0.5 * u, spin: 10 + (i % 4) * 3, ph: i * 1.7 };
});
const HIST = 64;
/** retraso extra de la cola de la estela de cada fantasma (s) */
const STREAK_LAG = 0.035;

/**
 * Pelotas fantasma de la RÁFAGA en vuelo: guarda las posiciones REALES de la pelota (mundo, x/y/z) y cada fantasma va por el
 * mismo camino con su retraso y su desvío; se proyectan con project(), así quedan en perspectiva y botan donde bota la real.
 * Al empezar el vuelo salen todas juntas de la raqueta y se abren (como una ráfaga).
 */
export class BarrageTrail {
  readonly gfx: Phaser.GameObjects.Graphics;
  private hx = new Float32Array(HIST);
  private hy = new Float32Array(HIST);
  private hz = new Float32Array(HIST);
  private ht = new Float64Array(HIST);
  private head = 0;
  private count = 0;
  private flight = 0;
  private t = 0;
  /** muestra del camino (se reutiliza: sin objetos nuevos por fotograma) */
  private px = 0;
  private py = 0;
  private pz = 0;

  constructor(scene: Phaser.Scene) {
    this.gfx = scene.add.graphics().setVisible(false);
  }

  /** Posición del camino de la pelota real en el instante `at` (s) → px, py, pz (fuera del registro: la más vieja). */
  private sample(at: number) {
    let j = this.head;
    for (let n = 0; n < this.count; n++) {
      const prev = (j - 1 + HIST) % HIST;
      if (this.ht[j] <= at || n === this.count - 1) {
        this.px = this.hx[j];
        this.py = this.hy[j];
        this.pz = this.hz[j];
        return;
      }
      if (this.ht[prev] <= at) {
        const f = (at - this.ht[prev]) / Math.max(1e-6, this.ht[j] - this.ht[prev]);
        this.px = this.hx[prev] + (this.hx[j] - this.hx[prev]) * f;
        this.py = this.hy[prev] + (this.hy[j] - this.hy[prev]) * f;
        this.pz = this.hz[prev] + (this.hz[j] - this.hz[prev]) * f;
        return;
      }
      j = prev;
    }
  }

  /** Cada fotograma con la pelota real (mundo). `d` = profundidad (detrás de la pelota real). */
  draw(dt: number, bx: number, by: number, bz: number, d: number) {
    const now = performance.now() / 1000;
    this.head = (this.head + 1) % HIST;
    this.hx[this.head] = bx;
    this.hy[this.head] = by;
    this.hz[this.head] = bz;
    this.ht[this.head] = now;
    this.count = Math.min(HIST, this.count + 1);
    this.flight += dt;
    this.t += dt;
    const ramp = Math.min(1, this.flight / 0.18); // se abren al salir de la raqueta
    const g = this.gfx.clear().setDepth(d).setVisible(true);
    for (let i = GHOSTS.length - 1; i >= 0; i--) {
      const G = GHOSTS[i];
      const oy = (G.oy + Math.sin(this.t * 7 + G.ph) * 3) * ramp;
      const oz = (G.oz + Math.cos(this.t * 6 + G.ph) * 3) * ramp;
      this.sample(now - G.lag - STREAK_LAG);
      const q = project(this.px, this.py + oy, Math.max(0, this.pz + oz));
      this.sample(now - G.lag);
      const wz = Math.max(0, this.pz + oz);
      const p = project(this.px, this.py + oy, wz);
      const r = 9.8 * p.s * 0.8 * (1 + Math.min(wz, 220) / 700) * G.size;
      const a = G.alpha * (0.4 + 0.6 * ramp);
      streak(g, q.sx, q.sy, p.sx, p.sy, r, a);
      drawBarrageBall(g, p.sx, p.sy, r, this.t * G.spin + G.ph, a, i >= 9); // las 9 de delante, completas; el resto, simples (más pelotas sin más costo)
    }
  }

  hide() {
    this.gfx.setVisible(false);
    this.count = 0;
    this.flight = 0;
  }
}

// ---------------------------------------------------------------- golpes
interface SprayOpts {
  /** distancia que recorren [mín, máx] (px, por `s`) */
  dist: [number, number];
  ms: number;
  /** caída (px por `s`) al final del recorrido */
  fall?: number;
  /** abanico de ángulos [desde, hasta] (rad); sin él, en todas direcciones */
  angle?: [number, number];
  /** aplastado vertical (a ras de suelo < 1) */
  flat?: number;
  /** radio de las pelotas (px por `s`) */
  size?: number;
  /** aro lima que se abre al salir */
  ring?: boolean;
}

/**
 * Pelotas que salen disparadas desde (x, y) girando, con su estela, caen un poco y se apagan. Un solo Graphics que se
 * redibuja; al acabar se destruye (o llama a `onDone`, que lo destruye: WallFx).
 */
export function ballSpray(scene: Phaser.Scene, x: number, y: number, s: number, D: number, n: number, o: SprayOpts, onDone?: (g: Phaser.GameObjects.Graphics) => void) {
  const g = scene.add.graphics().setDepth(D);
  const flat = o.flat ?? 1;
  const [a0, a1] = o.angle ?? [0, Math.PI * 2];
  const shots = Array.from({ length: n }, (_, i) => ({
    a: o.angle ? a0 + ((i + 0.5) / n) * (a1 - a0) + Phaser.Math.FloatBetween(-0.12, 0.12) : a0 + (i / n) * (a1 - a0) + Phaser.Math.FloatBetween(-0.25, 0.25),
    d: Phaser.Math.FloatBetween(o.dist[0], o.dist[1]) * s,
    r: (o.size ?? 7) * s * Phaser.Math.FloatBetween(0.75, 1.1),
    spin: Phaser.Math.FloatBetween(10, 22) * (i % 2 ? 1 : -1),
    delay: Phaser.Math.FloatBetween(0, 0.12),
  }));
  const fall = (o.fall ?? 0) * s;
  const pos = (sh: (typeof shots)[number], p: number): [number, number] => {
    const e = 1 - (1 - p) * (1 - p);
    return [x + Math.cos(sh.a) * sh.d * e, y + Math.sin(sh.a) * sh.d * e * flat + fall * p * p];
  };
  const finish = () => (onDone ? onDone(g) : g.destroy());
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration: o.ms,
    onUpdate: (tw) => {
      if (!g.scene || !g.active) return;
      const T = tw.getValue() ?? 0;
      g.clear();
      if (o.ring && T < 0.45) {
        const q = T / 0.45;
        g.lineStyle(5 * s * (1 - q) + 1, BARRAGE_COL.glow, 0.9 * (1 - q)).strokeEllipse(x, y, (20 + 120 * q) * s, (20 + 120 * q) * s * flat);
        g.fillStyle(BARRAGE_COL.white, 0.7 * (1 - q)).fillCircle(x, y, 14 * s * (1 - q));
      }
      for (const sh of shots) {
        const p = Math.min(1, Math.max(0, (T - sh.delay) / (1 - sh.delay)));
        if (p <= 0) continue;
        const a = 1 - p * p;
        const [px, py] = pos(sh, p);
        const [qx, qy] = pos(sh, Math.max(0, p - 0.1));
        const r = sh.r * (1 - 0.3 * p);
        streak(g, qx, qy, px, py, r, a);
        drawBarrageBall(g, px, py, r, sh.spin * p, a);
      }
    },
    onComplete: finish,
  });
  return g;
}

/**
 * IMPACTO de la RÁFAGA (cuerpo del rival o bote): las pelotas llegan desde fuera una tras otra y golpean en el punto
 * ("ta-ta-ta-ta": un pequeño estallido lima por cada una) y al final varias salen rebotando en todas direcciones.
 * `flat` aplasta las trayectorias en vertical (a ras de suelo). Dura ~0,9 s.
 */
export function barrageSlam(scene: Phaser.Scene, x: number, y: number, s: number, D: number, flat = 1) {
  const g = scene.add.graphics().setDepth(D);
  const N = 9;
  const STEP = 50;
  const TRAVEL = 120;
  const POP = 170;
  const shots = Array.from({ length: N }, (_, i) => ({
    a: i * 2.39996 + Phaser.Math.FloatBetween(-0.3, 0.3),
    R: Phaser.Math.FloatBetween(120, 175) * s,
    start: i * STEP,
    spin: Phaser.Math.FloatBetween(12, 20),
  }));
  const total = (N - 1) * STEP + TRAVEL + POP;
  const at = (sh: (typeof shots)[number], q: number): [number, number] => {
    const k = 1 - q * q; // acelera al llegar
    return [x + Math.cos(sh.a) * sh.R * k, y + Math.sin(sh.a) * sh.R * k * 0.75 * flat];
  };
  scene.tweens.addCounter({
    from: 0,
    to: total,
    duration: total,
    onUpdate: (tw) => {
      if (!g.scene || !g.active) return;
      const t = tw.getValue() ?? 0;
      g.clear();
      for (const sh of shots) {
        if (t < sh.start) continue;
        const q = (t - sh.start) / TRAVEL;
        if (q < 1) {
          const [px, py] = at(sh, q);
          const [bx, by] = at(sh, Math.max(0, q - 0.22));
          const r = 7.5 * s * (0.75 + 0.25 * q);
          streak(g, bx, by, px, py, r, 0.6 + 0.4 * q);
          drawBarrageBall(g, px, py, r, sh.spin * q, 0.6 + 0.4 * q);
          continue;
        }
        const pp = (t - sh.start - TRAVEL) / POP;
        if (pp >= 1) continue;
        // estallido corto de cada pelota que llega
        g.lineStyle(4 * s * (1 - pp) + 1, BARRAGE_COL.glow, 0.95 * (1 - pp)).strokeEllipse(x, y, (14 + 70 * pp) * s, (14 + 70 * pp) * s * flat);
        g.fillStyle(BARRAGE_COL.white, 0.85 * (1 - pp)).fillCircle(x, y, 12 * s * (1 - pp));
        g.fillStyle(BARRAGE_COL.light, 0.5 * (1 - pp)).fillCircle(x, y, 22 * s * (1 - pp * 0.5));
      }
    },
    onComplete: () => g.destroy(),
  });
  // rebote final: varias pelotas salen en todas direcciones, caen y se apagan
  scene.time.delayedCall((N - 1) * STEP + TRAVEL, () => ballSpray(scene, x, y, s, D + 0.5, 13, { dist: [90, 190], ms: 620, fall: 60, flat, size: 8, ring: true }));
  return (N - 1) * STEP + TRAVEL;
}

/** Golpe de la RÁFAGA en la raqueta: un abanico rápido de pelotas que salen disparadas de la raqueta. */
export function barrageFan(scene: Phaser.Scene, x: number, y: number, k: number) {
  const kk = Math.max(0.6, k);
  ballSpray(scene, x, y, kk, 3651, 14, { dist: [80, 160], ms: 420, fall: 20, size: 7, ring: true });
}

// ---------------------------------------------------------------- vista previa
/**
 * Vista previa de RÁFAGA: la pelota central con una ráfaga de pelotas más chicas girando a su alrededor en una órbita
 * inclinada (las de atrás más chicas y tenues, cada una con su estela). Cabe en maxW × maxH. Con `animate`, se mueve con el
 * `update` de la escena hasta que se destruye el contenedor.
 */
export function addBarragePreview(scene: Phaser.Scene, c: Phaser.GameObjects.Container, maxW: number, maxH: number, animate: boolean) {
  const m = Math.min(maxW, maxH);
  const g = scene.add.graphics();
  c.add(g);
  const N = 12;
  const RX = m * 0.33;
  const RY = m * 0.15;
  const TILT = -0.35;
  const ct = Math.cos(TILT);
  const st = Math.sin(TILT);
  const orbit = (a: number): [number, number, number] => {
    const ex = Math.cos(a) * RX;
    const ey = Math.sin(a) * RY;
    return [ex * ct - ey * st, ex * st + ey * ct, Math.sin(a)]; // [x, y, delante (+1) / detrás (-1)]
  };
  let t = 0.4;
  const draw = () => {
    g.clear();
    for (const front of [false, true]) {
      if (front) drawBarrageBall(g, 0, 0, m * 0.15, t * 6, 1);
      for (let i = 0; i < N; i++) {
        // en grupos (ráfaga), no repartidas por igual
        const a = t * 3.2 + (i / N) * Math.PI * 2 + Math.sin(i * 1.3) * 0.25;
        const [x, y, z] = orbit(a);
        if (z >= 0 !== front) continue;
        const depthK = 0.75 + 0.25 * z;
        const r = m * 0.075 * depthK;
        const al = 0.55 + 0.45 * depthK;
        const [x0, y0] = orbit(a - 0.45);
        const [x1, y1] = orbit(a - 0.22);
        streak(g, x0, y0, x1, y1, r * 0.8, al * 0.7);
        streak(g, x1, y1, x, y, r, al);
        drawBarrageBall(g, x, y, r, t * 14 + i, al);
      }
    }
  };
  draw();
  if (!animate) return;
  const tick = (_t: number, delta: number) => {
    if (!c.active || !isShown(c)) return;
    t += Math.min(0.05, delta / 1000);
    draw();
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, tick);
  const off = () => scene.events.off(Phaser.Scenes.Events.UPDATE, tick);
  c.once(Phaser.GameObjects.Events.DESTROY, off);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
}
