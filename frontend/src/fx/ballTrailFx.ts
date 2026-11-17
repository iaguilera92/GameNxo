import Phaser from 'phaser';

/**
 * EFECTOS DE PELOTA (estelas de PERSONALIZACIÓN y de la Tienda; ui/styleLook.ts los asigna a cada estilo). Solo cambian
 * cómo se ve la estela de TUS golpes normales: la física, el sonido y los poderes no cambian.
 *
 * Todo se dibuja con Graphics (sin texturas ni preFX/postFX: en el APK se rompen) y las partículas se mueven a mano
 * (sin un tween por partícula), con tope de partículas vivas.
 *
 *   plain    cinta de un solo color (los estilos de siempre; el Oro suma chispas aparte en Ball)
 *   rainbow  la cinta cambia de color a lo largo del recorrido
 *   ember    brasas que suben detrás de la pelota
 *   frost    copos de nieve que caen
 *   petals   pétalos de tulipán que flotan
 *   hearts   corazones que flotan
 *   stars    destellos que parpadean
 *   neon     doble línea fina y brillante
 *   smoke    humo gris que se disipa
 */
export type TrailFx = 'plain' | 'rainbow' | 'ember' | 'frost' | 'petals' | 'hearts' | 'stars' | 'neon' | 'smoke';

/** Lo que Ball necesita saber del estilo equipado. */
export interface TrailLook {
  trail: number;
  sparkle: boolean;
  fx?: TrailFx;
}

/** Punto de la cinta (coordenadas de pantalla) y su color. */
export interface RibbonPoint {
  x: number;
  y: number;
  col: number;
}

/** Ancho y opacidad de la cinta de cada efecto, respecto a la cinta normal. */
const RIBBON: Record<TrailFx, { w: number; a: number }> = {
  plain: { w: 1, a: 1 },
  rainbow: { w: 1, a: 1 },
  ember: { w: 0.5, a: 0.65 },
  frost: { w: 0.5, a: 0.65 },
  petals: { w: 0.4, a: 0.5 },
  hearts: { w: 0.4, a: 0.5 },
  stars: { w: 0.45, a: 0.55 },
  neon: { w: 1, a: 1 },
  smoke: { w: 1.15, a: 0.38 },
};

/** HSV (0..1) a 0xRRGGBB. */
function hsv(h: number, s: number, v: number): number {
  const i = Math.floor(h * 6) % 6;
  const f = h * 6 - Math.floor(h * 6);
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  return (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
}

/** Arcoíris: `t` = 0 (cola) .. 1 (pelota); los colores corren despacio con el tiempo `now` (ms). */
export function rainbowColor(t: number, now: number): number {
  return hsv((((1 - t) * 0.8 + now / 1500) % 1 + 1) % 1, 0.85, 1);
}

/**
 * Dibuja la cinta de la estela (de la cola a la pelota). `plain` es exactamente la de siempre; los demás efectos la
 * afinan (partículas aparte) o la cambian (arcoíris por tramos, neón de doble línea).
 */
export function drawRibbon(g: Phaser.GameObjects.Graphics, pts: RibbonPoint[], o: { scale: number; charged: boolean; boost: number; fx: TrailFx; now: number }) {
  const n = pts.length;
  const rs = RIBBON[o.fx];
  for (let i = 1; i < n; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const t = i / n;
    const base = (3 + t * 16) * o.scale * (o.charged ? 1.6 : 1) * (1 + 0.7 * o.boost);
    const alpha = Math.min(1, t * (o.charged ? 0.85 : 0.6) * (1 + 0.5 * o.boost));
    const col = o.fx === 'rainbow' ? rainbowColor(t, o.now) : b.col;
    if (o.fx === 'neon') {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len < 0.01) continue;
      const nx = -dy / len;
      const ny = dx / len;
      const sep = (1.5 + t * 6) * o.scale;
      const thick = (1.6 + t * 1.6) * o.scale;
      g.lineStyle(base * 0.9, col, alpha * 0.12).lineBetween(a.x, a.y, b.x, b.y); // halo suave
      for (const sg of [-1, 1]) {
        const ox = nx * sep * sg;
        const oy = ny * sep * sg;
        g.lineStyle(thick, col, alpha * 0.95).lineBetween(a.x + ox, a.y + oy, b.x + ox, b.y + oy);
        g.lineStyle(thick * 0.4, 0xffffff, alpha * 0.9).lineBetween(a.x + ox, a.y + oy, b.x + ox, b.y + oy);
      }
      continue;
    }
    const w = base * rs.w;
    g.lineStyle(w, col, alpha * rs.a).lineBetween(a.x, a.y, b.x, b.y);
    g.fillStyle(col, alpha * rs.a).fillCircle(b.x, b.y, w / 2);
  }
}

type Shape = 'circle' | 'heart' | 'petal' | 'flake' | 'star';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  rot: number;
  vr: number;
  shape: Shape;
  col: number;
  a: number;
  /** cambio de tamaño a lo largo de su vida (+ crece, − se encoge) */
  grow: number;
  /** parpadeo (destellos) */
  twinkle: boolean;
  phase: number;
  /** halo suave detrás (brasas) */
  glow: boolean;
}

/** Partículas por segundo de cada efecto (los que no tienen, 0). */
const RATE: Record<TrailFx, number> = { plain: 0, rainbow: 0, neon: 0, ember: 38, frost: 30, petals: 22, hearts: 14, stars: 34, smoke: 30 };
const MAX_PARTICLES = 60;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(l: readonly T[]): T => l[Math.floor(Math.random() * l.length)];

/** Partículas de una estela; se dibujan en el Graphics que se le pasa (una vez por cuadro con `tick`). */
export class TrailParticles {
  private ps: Particle[] = [];
  private acc = 0;
  private dirty = false;

  constructor(readonly g: Phaser.GameObjects.Graphics) {}

  /** Crea una partícula del efecto `fx` en (x, y); `k` = tamaño de la pelota en pantalla (1 = normal). */
  private spawn(fx: TrailFx, x: number, y: number, k: number) {
    const base = { x: x + rnd(-5, 5) * k, y: y + rnd(-3, 3) * k, age: 0, rot: rnd(0, Math.PI * 2), vr: 0, grow: -0.4, twinkle: false, phase: rnd(0, 6), glow: false };
    let p: Particle | null = null;
    if (fx === 'ember') p = { ...base, vx: rnd(-10, 10) * k, vy: -rnd(25, 55) * k, life: rnd(0.35, 0.65), size: rnd(2.2, 4.2) * k, shape: 'circle', col: pick([0xffd23a, 0xff8a1e, 0xff4a10]), a: 0.9, grow: -0.5, glow: true };
    else if (fx === 'frost') p = { ...base, vx: rnd(-12, 12) * k, vy: rnd(14, 32) * k, life: rnd(0.55, 0.9), size: rnd(3, 5.5) * k, shape: 'flake', col: pick([0xffffff, 0xcfefff, 0x9fdcff]), a: 0.95, vr: rnd(-3, 3), grow: -0.2 };
    else if (fx === 'petals') p = { ...base, vx: rnd(-18, 18) * k, vy: rnd(4, 16) * k, life: rnd(0.7, 1.1), size: rnd(5, 8) * k, shape: 'petal', col: pick([0xffb3d6, 0xff8fc4, 0xffd0e6]), a: 0.95, vr: rnd(-4, 4), grow: -0.25 };
    else if (fx === 'hearts') p = { ...base, vx: rnd(-8, 8) * k, vy: -rnd(8, 20) * k, life: rnd(0.7, 1.1), size: rnd(5, 8) * k, shape: 'heart', col: pick([0xff5f8a, 0xff8fb0, 0xffc0d4]), a: 0.95, grow: -0.3 };
    else if (fx === 'stars') p = { ...base, vx: rnd(-6, 6) * k, vy: rnd(-6, 6) * k, life: rnd(0.4, 0.8), size: rnd(3.5, 6.5) * k, shape: 'star', col: pick([0xffffff, 0xfff1a0, 0xffd23f]), a: 1, vr: rnd(-2, 2), grow: -0.2, twinkle: true };
    else if (fx === 'smoke') p = { ...base, vx: rnd(-8, 8) * k, vy: -rnd(6, 16) * k, life: rnd(0.5, 0.9), size: rnd(4, 7) * k, shape: 'circle', col: pick([0x8a909a, 0xa5abb5, 0x6f7580]), a: 0.35, grow: 1.6 };
    if (!p) return;
    if (this.ps.length >= MAX_PARTICLES) this.ps.shift();
    this.ps.push(p);
  }

  /** Un cuadro: crea partículas (si `fx` y la pelota se está mostrando), las mueve y las dibuja. `k` = escala de la pelota. */
  tick(fx: TrailFx | null, x: number, y: number, k: number, dt: number) {
    if (fx && RATE[fx] > 0) {
      this.acc += dt * RATE[fx];
      while (this.acc >= 1) {
        this.acc -= 1;
        this.spawn(fx, x, y, k);
      }
    } else this.acc = 0;
    if (!this.ps.length) {
      if (this.dirty) this.g.clear();
      this.dirty = false;
      return;
    }
    const g = this.g.clear();
    this.dirty = true;
    for (let i = this.ps.length - 1; i >= 0; i--) {
      const p = this.ps[i];
      p.age += dt;
      if (p.age >= p.life) {
        this.ps.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      const q = p.age / p.life;
      let alpha = p.a * (1 - q);
      if (p.twinkle) alpha *= 0.45 + 0.55 * Math.abs(Math.sin(p.age * 24 + p.phase));
      const s = Math.max(0.4, p.size * (1 + p.grow * q));
      drawShape(g, p, s, alpha);
    }
  }

  clear() {
    this.ps.length = 0;
    this.acc = 0;
    this.g.clear();
    this.dirty = false;
  }
}

function drawShape(g: Phaser.GameObjects.Graphics, p: Particle, s: number, alpha: number) {
  const { x, y, col } = p;
  if (p.shape === 'circle') {
    if (p.glow) g.fillStyle(col, alpha * 0.25).fillCircle(x, y, s * 1.9);
    g.fillStyle(col, alpha).fillCircle(x, y, s);
  } else if (p.shape === 'heart') {
    g.fillStyle(col, alpha);
    g.fillCircle(x - s * 0.5, y - s * 0.3, s * 0.58).fillCircle(x + s * 0.5, y - s * 0.3, s * 0.58);
    g.fillTriangle(x - s * 1.05, y - s * 0.05, x + s * 1.05, y - s * 0.05, x, y + s * 1.05);
  } else if (p.shape === 'petal') {
    const pts: { x: number; y: number }[] = [];
    const c = Math.cos(p.rot);
    const sn = Math.sin(p.rot);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const ex = Math.cos(a) * s;
      const ey = Math.sin(a) * s * 0.55;
      pts.push({ x: x + ex * c - ey * sn, y: y + ex * sn + ey * c });
    }
    g.fillStyle(col, alpha).fillPoints(pts, true);
  } else if (p.shape === 'flake') {
    g.lineStyle(Math.max(1, s * 0.3), col, alpha);
    for (let j = 0; j < 3; j++) {
      const a = p.rot + (j * Math.PI) / 3;
      g.lineBetween(x - Math.cos(a) * s, y - Math.sin(a) * s, x + Math.cos(a) * s, y + Math.sin(a) * s);
    }
  } else {
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < 8; i++) {
      const a = p.rot + (i / 8) * Math.PI * 2;
      const r = i % 2 === 0 ? s : s * 0.3;
      pts.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
    }
    g.fillStyle(col, alpha).fillPoints(pts, true);
  }
}

/**
 * Miniatura ESTÁTICA de un efecto (huecos del selector de PERSONALIZACIÓN): la pelota con su estela, centrada en (0, 0) del
 * Graphics, con `r` = radio de la pelota.
 */
export function drawTrailStatic(g: Phaser.GameObjects.Graphics, r: number, look: TrailLook) {
  const fx = look.fx ?? 'plain';
  const pts: RibbonPoint[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    pts.push({ x: -r * 2.2 + t * r * 2, y: r * 0.9 - t * r * 0.8, col: look.trail });
  }
  drawRibbon(g, pts, { scale: r / 12, charged: false, boost: 0, fx, now: 600 });
  // partículas congeladas: unas cuantas formas del efecto detrás de la pelota
  if (RATE[fx] > 0) {
    const tp = new TrailParticles(g);
    for (let i = 0; i < 7; i++) {
      (tp as unknown as { spawn: (f: TrailFx, x: number, y: number, k: number) => void }).spawn(fx, -r * (0.6 + i * 0.32), r * (0.5 - i * 0.12) * (i % 2 ? 1 : -1) * 0.8, r / 12);
    }
    const ps = (tp as unknown as { ps: Particle[] }).ps;
    for (const p of ps) {
      p.age = p.life * 0.25;
      drawShape(g, p, Math.max(0.4, p.size * (1 + p.grow * 0.25)), p.a * 0.75);
    }
  }
  g.fillStyle(0x0a1638).fillCircle(r * 0.3, 0, r * 1.05);
  g.fillStyle(0xd7f53a).fillCircle(r * 0.3, 0, r * 0.86);
  g.lineStyle(r * 0.14, 0xffffff, 0.95).beginPath().arc(r * 0.3 - r * 0.9, 0, r * 0.8, -0.85, 0.85).strokePath();
  if (look.sparkle) for (let i = 0; i < 4; i++) g.fillStyle(0xfff6c8, 1).fillCircle(-r * (0.6 + i * 0.4), r * (0.2 * ((i % 2) * 2 - 1)), r * 0.12);
}

/**
 * Pelota que cruza (cx - span/2 .. cx + span/2) dejando la estela del efecto, en bucle: para la Tienda y la televisión del
 * selector. Devuelve los objetos que hay que añadir a su contenedor y el tween principal (quitarlo al destruirlos).
 */
export function createTrailPreview(scene: Phaser.Scene, cx: number, cy: number, span: number, look: TrailLook, size = 1, isVisible?: () => boolean, minFrameMs = 0) {
  const fx = look.fx ?? 'plain';
  const k = size;
  const pos = (t: number) => ({ x: cx - span / 2 + span * t, y: cy + 26 * k - Math.sin(t * Math.PI) * 52 * k });
  const ghost = scene.add.graphics();
  ghost.lineStyle(4, look.trail, 0.18).beginPath();
  for (let i = 0; i <= 20; i++) {
    const p = pos(i / 20);
    if (i === 0) ghost.moveTo(p.x, p.y);
    else ghost.lineTo(p.x, p.y);
  }
  ghost.strokePath();
  const g = scene.add.graphics();
  const pg = scene.add.graphics();
  const ball = scene.add.container(0, 0);
  ball.add([scene.add.circle(0, 0, 12 * k, 0x0a1638), scene.add.circle(0, 0, 9 * k, 0xd7f53a), scene.add.circle(-3 * k, -3 * k, 3 * k, 0xffffff, 0.75)]);
  const parts = new TrailParticles(pg);
  const st = { t: 0 };
  let last = scene.time.now;
  let lastDraw = -1e9;
  const draw = () => {
    if (isVisible && !isVisible()) return; // fuera de pantalla: no se redibuja
    const now = scene.time.now;
    if (minFrameMs && now - lastDraw < minFrameMs) return; // limita los cuadros por segundo (varias vistas previas a la vez)
    lastDraw = now;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    g.clear();
    const pts: RibbonPoint[] = [];
    const n = 9;
    for (let i = n; i >= 0; i--) {
      const p = pos(Math.max(0, st.t - (i / n) * 0.45));
      pts.push({ x: p.x, y: p.y, col: look.trail });
    }
    drawRibbon(g, pts, { scale: 0.75 * k, charged: false, boost: 0, fx, now });
    const p = pos(st.t);
    ball.setPosition(p.x, p.y);
    parts.tick(st.t > 0.03 && st.t < 0.98 ? fx : null, p.x, p.y, k, dt);
    if (look.sparkle && Math.random() < 0.25 && st.t > 0.05) {
      pg.fillStyle(0xfff1b8, 0.9).fillCircle(p.x + rnd(-6, 6), p.y + rnd(-6, 6), 2.2);
    }
  };
  const tween = scene.tweens.add({ targets: st, t: 1, duration: 1100, delay: Math.floor(Math.random() * 500), repeat: -1, repeatDelay: 450, ease: 'Sine.easeInOut', onUpdate: draw });
  draw();
  return { objects: [ghost, g, pg, ball] as Phaser.GameObjects.GameObject[], tween, parts };
}
