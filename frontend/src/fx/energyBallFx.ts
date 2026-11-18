import Phaser from 'phaser';
import { isShown } from './barrageFx';

/**
 * (17-11-2026) BOLA DE ENERGÍA (`energy`, ULTI LEGENDARIA, sin hoja de sprites): esfera de energía blanca y celeste dibujada
 * por código, MÁS GRANDE que las bolas de la ULTI normal, con el aro y el brillo del golpe cargado al máximo y rayos que
 * chisporrotean alrededor. Objetos creados UNA vez (pool); en cada fotograma solo se mueven y se redibujan los Graphics.
 *   EnergyBallFx        la bola en vuelo (la usa InfernoFire) y la esfera que crece en la raqueta durante la carga
 *   energyBurst         destello del golpe en la raqueta (aros + rayos), vida corta
 *   addEnergyPreview    vista previa (Tienda, Personalización)
 */
export const ENERGY_COL = { core: 0xffffff, light: 0xc8f8ff, cyan: 0x5fe8ff, deep: 0x1f8cff };

const GLOW = 'fx-energy-glow';

/** Textura de brillo suave (degradado radial blanco): se tiñe con setTint. */
export function ensureEnergyGlow(scene: Phaser.Scene) {
  if (scene.textures.exists(GLOW)) return;
  const size = 64;
  const t = scene.textures.createCanvas(GLOW, size, size);
  if (!t) return;
  const ctx = t.getContext();
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.3)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  t.refresh();
}

/** estela: siluetas de la esfera en posiciones anteriores */
const TRAIL = 4; // (18-11-2026) 6 → 4 (rendimiento)
const TRAIL_STEP = 0.035;

/**
 * Esfera de energía: halo celeste grande que late, cuerpo blanco-celeste, núcleo blanco, el ARO del golpe cargado al máximo
 * (dos anillos que laten y giran), rayos eléctricos que se redibujan a saltos y una estela corta de siluetas.
 */
export class EnergyBallFx {
  private halo: Phaser.GameObjects.Image;
  private body: Phaser.GameObjects.Image;
  private core: Phaser.GameObjects.Image;
  private ring: Phaser.GameObjects.Graphics;
  private bolts: Phaser.GameObjects.Graphics;
  private trail: Phaser.GameObjects.Image[] = [];
  /** historial de posiciones (anillo fijo, sin crear objetos) */
  private hx = new Float32Array(32);
  private hy = new Float32Array(32);
  private ht = new Float32Array(32);
  private hn = 0;
  private hi = 0;
  private boltT = 0;
  private t = 0;
  private visible = false;

  constructor(scene: Phaser.Scene) {
    ensureEnergyGlow(scene);
    const ADD = Phaser.BlendModes.ADD;
    for (let i = 0; i < TRAIL; i++) this.trail.push(scene.add.image(0, 0, GLOW).setTint(ENERGY_COL.cyan).setBlendMode(ADD).setVisible(false));
    this.halo = scene.add.image(0, 0, GLOW).setTint(ENERGY_COL.cyan).setBlendMode(ADD).setVisible(false);
    this.body = scene.add.image(0, 0, GLOW).setTint(ENERGY_COL.light).setBlendMode(ADD).setVisible(false);
    this.core = scene.add.image(0, 0, GLOW).setTint(ENERGY_COL.core).setBlendMode(ADD).setVisible(false);
    this.ring = scene.add.graphics().setBlendMode(ADD).setVisible(false);
    this.bolts = scene.add.graphics().setBlendMode(ADD).setVisible(false);
  }

  /**
   * Dibuja la esfera centrada en (x, y) con radio `R` (px) y profundidad `d`. `dt` en segundos. `trail` = deja estela (en
   * vuelo sí; en la raqueta, cargando, no).
   */
  draw(dt: number, x: number, y: number, R: number, d: number, trail = true) {
    this.t += dt;
    this.visible = true;
    const t = this.t;
    const pulse = 1 + 0.07 * Math.sin(t * 26) + 0.04 * Math.sin(t * 11);
    this.halo.setPosition(x, y).setDisplaySize(R * 4.2 * pulse, R * 4.2 * pulse).setAlpha(0.45 + 0.15 * Math.sin(t * 19)).setDepth(d - 0.03).setVisible(true);
    this.body.setPosition(x, y).setDisplaySize(R * 2.5 * pulse, R * 2.5 * pulse).setAlpha(0.95).setDepth(d).setVisible(true);
    this.core.setPosition(x, y).setDisplaySize(R * 1.5, R * 1.5).setAlpha(0.8 + 0.2 * Math.sin(t * 40)).setDepth(d + 0.01).setVisible(true);
    // aro del golpe cargado al máximo: dos anillos que laten (el de fuera más tenue) y un arco que gira
    const g = this.ring.clear().setDepth(d + 0.012).setVisible(true);
    const rk = 0.5 + 0.5 * Math.sin(t * 18);
    g.lineStyle(Math.max(2, R * 0.16), ENERGY_COL.cyan, 0.35 + 0.25 * rk).strokeCircle(x, y, R * (1.25 + 0.12 * rk));
    g.lineStyle(Math.max(1.5, R * 0.08), ENERGY_COL.core, 0.85).strokeCircle(x, y, R * (1.02 + 0.05 * rk));
    const a0 = t * 7;
    g.lineStyle(Math.max(1.5, R * 0.1), ENERGY_COL.light, 0.9);
    g.beginPath().arc(x, y, R * 1.45, a0, a0 + 1.1).strokePath();
    g.beginPath().arc(x, y, R * 1.45, a0 + Math.PI, a0 + Math.PI + 1.1).strokePath();
    // rayos: se redibujan a saltos (parpadeo eléctrico)
    this.boltT -= dt;
    this.bolts.setPosition(x, y).setDepth(d + 0.013).setVisible(true); // dibujados respecto al centro: siguen a la bola
    if (this.boltT <= 0) {
      this.boltT = 0.05 + Math.random() * 0.04;
      this.drawBolts(R);
    }
    // estela
    const now = t;
    this.hx[this.hi] = x;
    this.hy[this.hi] = y;
    this.ht[this.hi] = now;
    this.hi = (this.hi + 1) % this.hx.length;
    this.hn = Math.min(this.hn + 1, this.hx.length);
    for (let i = 0; i < TRAIL; i++) {
      const o = this.trail[i];
      if (!trail) {
        o.setVisible(false);
        continue;
      }
      const want = now - (i + 1) * TRAIL_STEP;
      let found = -1;
      for (let j = 1; j <= this.hn; j++) {
        const k = (this.hi - j + this.hx.length) % this.hx.length;
        if (this.ht[k] <= want) {
          found = k;
          break;
        }
      }
      if (found < 0 || Math.abs(this.hx[found] - x) + Math.abs(this.hy[found] - y) < 2) {
        o.setVisible(false);
        continue;
      }
      const f = 1 - (i + 1) / (TRAIL + 1);
      o.setPosition(this.hx[found], this.hy[found])
        .setDisplaySize(R * 2.6 * (0.5 + 0.5 * f), R * 2.6 * (0.5 + 0.5 * f))
        .setAlpha(0.55 * f)
        .setTint(i < 2 ? ENERGY_COL.light : ENERGY_COL.cyan)
        .setDepth(d - 0.02)
        .setVisible(true);
    }
  }

  /** Rayos en zigzag que salen del borde de la esfera, respecto a su centro (se quedan hasta el siguiente salto). */
  private drawBolts(R: number) {
    const x = 0;
    const y = 0;
    const g = this.bolts.clear();
    const n = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r1 = R * (1.6 + Math.random() * 0.9);
      for (const [w, col, al] of [
        [Math.max(3, R * 0.2), ENERGY_COL.cyan, 0.5],
        [Math.max(1.4, R * 0.08), ENERGY_COL.core, 1],
      ] as const) {
        g.lineStyle(w, col, al).beginPath();
        g.moveTo(x + Math.cos(a) * R * 0.9, y + Math.sin(a) * R * 0.9);
        for (let k = 1; k <= 3; k++) {
          const rr = R * 0.9 + ((r1 - R * 0.9) * k) / 3;
          const j = k === 3 ? 0 : (Math.random() - 0.5) * 0.5;
          g.lineTo(x + Math.cos(a + j) * rr, y + Math.sin(a + j) * rr);
        }
        g.strokePath();
      }
    }
  }

  hide() {
    if (!this.visible) return;
    this.visible = false;
    this.halo.setVisible(false);
    this.body.setVisible(false);
    this.core.setVisible(false);
    this.ring.clear().setVisible(false);
    this.bolts.clear().setVisible(false);
    for (const o of this.trail) o.setVisible(false);
    this.hn = 0;
  }

  destroy() {
    for (const o of [this.halo, this.body, this.core, this.ring, this.bolts, ...this.trail]) o.destroy();
  }
}

/** Golpe de la BOLA DE ENERGÍA en la raqueta: aros blancos y celestes que se abren + rayos que salen del contacto (vida corta). */
export function energyBurst(scene: Phaser.Scene, x: number, y: number, k: number) {
  const kk = Math.max(0.6, k);
  const ADD = Phaser.BlendModes.ADD;
  for (let i = 0; i < 3; i++) {
    const ring = scene.add.circle(x, y, 20 * kk).setStrokeStyle((7 - i * 2) * kk, i % 2 ? ENERGY_COL.cyan : ENERGY_COL.core, 0.95).setDepth(3651).setBlendMode(ADD);
    scene.tweens.add({ targets: ring, scale: 5 + i * 1.2, alpha: 0, delay: i * 45, duration: 400, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
  }
  const g = scene.add.graphics().setDepth(3652).setBlendMode(ADD);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.random() * 0.4;
    const L = Phaser.Math.FloatBetween(60, 130) * kk;
    for (const [w, col, al] of [
      [7, ENERGY_COL.deep, 0.35],
      [3.5, ENERGY_COL.cyan, 0.85],
      [1.6, ENERGY_COL.core, 1],
    ] as const) {
      g.lineStyle(w * kk, col, al).beginPath().moveTo(x, y);
      for (let j = 1; j <= 4; j++) {
        const o = j < 4 ? (Math.random() - 0.5) * 18 * kk : 0;
        g.lineTo(x + (Math.cos(a) * (L * j)) / 4 - Math.sin(a) * o, y + ((Math.sin(a) * (L * j)) / 4 + Math.cos(a) * o) * 0.75);
      }
      g.strokePath();
    }
  }
  scene.tweens.add({ targets: g, alpha: 0, duration: 260, delay: 60, onComplete: () => g.destroy() });
}

/**
 * Vista previa de BOLA DE ENERGÍA: la esfera centrada en el contenedor (cabe en maxW × maxH). Con `animate`, late con el
 * `update` de la escena hasta que se destruye el contenedor (no se redibuja si no se ve).
 */
export function addEnergyPreview(scene: Phaser.Scene, c: Phaser.GameObjects.Container, maxW: number, maxH: number, animate: boolean) {
  const fx = new EnergyBallFx(scene);
  const R = Math.min(maxW, maxH) * 0.2;
  // los objetos del pool se meten en el contenedor (coordenadas locales)
  const parts = fx as unknown as { halo: Phaser.GameObjects.Image; body: Phaser.GameObjects.Image; core: Phaser.GameObjects.Image; ring: Phaser.GameObjects.Graphics; bolts: Phaser.GameObjects.Graphics; trail: Phaser.GameObjects.Image[] };
  c.add([...parts.trail, parts.halo, parts.body, parts.core, parts.ring, parts.bolts]);
  fx.draw(0.016, 0, 0, R, 0, false);
  if (!animate) return;
  const tick = (_t: number, delta: number) => {
    if (!c.active) return;
    if (!isShown(c)) return;
    fx.draw(Math.min(0.05, delta / 1000), 0, 0, R, 0, false);
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, tick);
  const off = () => scene.events.off(Phaser.Scenes.Events.UPDATE, tick);
  c.once(Phaser.GameObjects.Events.DESTROY, off);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
}

// ---------------------------------------------------------------- (17-11-2026) IMPACTO FINAL DE LA BOLA DE ENERGÍA
// (18-11-2026, usuario: "se pega") menos partículas en el impacto (56 / 28 / 18 → 34 / 16 / 12): se ve igual de lleno y pesa menos en el teléfono
const IMP_SHARDS = 34;
const IMP_EMBERS = 16;
const IMP_DEBRIS = 12;
const IMP_CRACKS = 10;
const IMP_CRACK_PTS = 6;
const IMP_LIFE = 1.2;
const IMP_G = 1400;
const impEase = (u: number) => 1 - (1 - u) * (1 - u);

/**
 * IMPACTO FINAL de la BOLA DE ENERGÍA (al rival en el partido y a las 2 máquinas del centro en la demostración): DESTRUCTIVO y con
 * otra forma que el estallido redondo de siempre:
 *   destello en ESTRELLA (8 púas largas y finas) + resplandor breve; COLUMNA de energía que sale disparada hacia arriba desde el
 *   punto; 3 ONDAS planas en el suelo (elipses en perspectiva) que se abren rápido; GRIETAS de luz en zigzag por el suelo que
 *   destellan y se apagan; chisporroteo eléctrico en el suelo (~0,6 s).
 *   partículas: esquirlas de energía en todas direcciones con gravedad (caen y botan en la cancha), brasas que suben flotando y
 *   trocitos de cancha (gris/blanco) que saltan y botan.
 * Todo en un POOL creado una vez: 3 Graphics + 1 imagen de brillo, partículas en Float32Array (sin crear nada por fotograma). Se
 * dibuja con el `update` de la escena mientras dura (~1,2 s) y luego se esconde sola. Coordenadas de pantalla (las del mundo).
 */
export class EnergyImpactFx {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly pg: Phaser.GameObjects.Graphics;
  private readonly dg: Phaser.GameObjects.Graphics;
  private readonly glow: Phaser.GameObjects.Image;
  private on = false;
  private t = 0;
  private x = 0;
  private y = 0;
  private fy = 0;
  private k = 1;
  private readonly sx = new Float32Array(IMP_SHARDS);
  private readonly sy = new Float32Array(IMP_SHARDS);
  private readonly svx = new Float32Array(IMP_SHARDS);
  private readonly svy = new Float32Array(IMP_SHARDS);
  private readonly sl = new Float32Array(IMP_SHARDS);
  private readonly sg = new Float32Array(IMP_SHARDS);
  private readonly ex = new Float32Array(IMP_EMBERS);
  private readonly ey = new Float32Array(IMP_EMBERS);
  private readonly evx = new Float32Array(IMP_EMBERS);
  private readonly evy = new Float32Array(IMP_EMBERS);
  private readonly el = new Float32Array(IMP_EMBERS);
  private readonly dx = new Float32Array(IMP_DEBRIS);
  private readonly dy = new Float32Array(IMP_DEBRIS);
  private readonly dvx = new Float32Array(IMP_DEBRIS);
  private readonly dvy = new Float32Array(IMP_DEBRIS);
  private readonly dgy = new Float32Array(IMP_DEBRIS);
  private readonly dsz = new Float32Array(IMP_DEBRIS);
  private readonly cx = new Float32Array(IMP_CRACKS * IMP_CRACK_PTS);
  private readonly cy = new Float32Array(IMP_CRACKS * IMP_CRACK_PTS);
  private readonly tick = (_t: number, d: number) => this.step(Math.min(0.05, d / 1000));

  constructor(private readonly scene: Phaser.Scene, depth = 3790) {
    ensureEnergyGlow(scene);
    const ADD = Phaser.BlendModes.ADD;
    this.dg = scene.add.graphics().setDepth(depth - 0.2).setVisible(false);
    this.g = scene.add.graphics().setBlendMode(ADD).setDepth(depth).setVisible(false);
    this.pg = scene.add.graphics().setBlendMode(ADD).setDepth(depth + 0.1).setVisible(false);
    this.glow = scene.add.image(0, 0, GLOW).setTint(ENERGY_COL.light).setBlendMode(ADD).setDepth(depth + 0.2).setVisible(false);
  }

  /** Lanza el impacto en (x, y) (centro del golpe), con el suelo en `feetY` y la escala de perspectiva `k`. */
  play(x: number, y: number, feetY: number, k: number) {
    const R = Math.random;
    k = Math.max(0.6, Math.min(1.25, k));
    this.x = x;
    this.y = y;
    this.fy = feetY;
    this.k = k;
    this.t = 0;
    for (let i = 0; i < IMP_SHARDS; i++) {
      const a = R() * Math.PI * 2;
      const sp = (300 + R() * 650) * k;
      this.sx[i] = x;
      this.sy[i] = y;
      this.svx[i] = Math.cos(a) * sp;
      this.svy[i] = Math.sin(a) * sp * 0.7 - 260 * k;
      this.sl[i] = 0.55 + R() * 0.6;
      this.sg[i] = feetY + (R() * 40 - 15) * k;
    }
    for (let i = 0; i < IMP_EMBERS; i++) {
      this.ex[i] = x + (R() - 0.5) * 140 * k;
      this.ey[i] = feetY - R() * 80 * k;
      this.evx[i] = (R() - 0.5) * 50 * k;
      this.evy[i] = -(40 + R() * 110) * k;
      this.el[i] = 0.6 + R() * 0.6;
    }
    for (let i = 0; i < IMP_DEBRIS; i++) {
      const a = R() * Math.PI;
      const sp = (180 + R() * 320) * k;
      this.dx[i] = x + (R() - 0.5) * 50 * k;
      this.dy[i] = feetY;
      this.dvx[i] = -Math.cos(a) * sp;
      this.dvy[i] = -(250 + R() * 380) * k;
      this.dgy[i] = feetY + (R() * 40 - 12) * k;
      this.dsz[i] = (3 + R() * 4) * k;
    }
    // grietas: zigzag desde el punto, en perspectiva (aplastadas en vertical)
    for (let c = 0; c < IMP_CRACKS; c++) {
      const a = (c / IMP_CRACKS) * Math.PI * 2 + R() * 0.4;
      const L = (110 + R() * 160) * k;
      for (let j = 0; j < IMP_CRACK_PTS; j++) {
        const q = j / (IMP_CRACK_PTS - 1);
        const o = j === 0 ? 0 : (R() - 0.5) * 34 * k;
        this.cx[c * IMP_CRACK_PTS + j] = x + Math.cos(a) * L * q - Math.sin(a) * o;
        this.cy[c * IMP_CRACK_PTS + j] = feetY + (Math.sin(a) * L * q + Math.cos(a) * o) * 0.32;
      }
    }
    if (!this.on) this.scene.events.on(Phaser.Scenes.Events.UPDATE, this.tick);
    this.on = true;
    this.g.setVisible(true);
    this.pg.setVisible(true);
    this.dg.setVisible(true);
    this.step(0);
  }

  private step(dt: number) {
    if (!this.on) return;
    if (!this.g.scene) return this.stop();
    this.t += dt;
    const t = this.t;
    if (t >= IMP_LIFE) return this.stop();
    const { x, y, fy, k } = this;
    const g = this.g.clear();

    // resplandor breve
    if (t < 0.35) {
      const u = t / 0.35;
      const s = k * (120 + 420 * impEase(u));
      this.glow.setPosition(x, y).setDisplaySize(s, s * 0.85).setAlpha(1 - u).setVisible(true);
    } else this.glow.setVisible(false);

    // COLUMNA de energía hacia arriba
    if (t < 0.7) {
      const u = t / 0.7;
      const H = k * 460 * Math.min(1, t / 0.1);
      const W = k * 64 * Math.sqrt(1 - u);
      const a = 1 - u;
      g.fillStyle(ENERGY_COL.deep, 0.3 * a).fillRect(x - W * 1.1, fy - H, W * 2.2, H);
      g.fillStyle(ENERGY_COL.cyan, 0.55 * a).fillRect(x - W * 0.6, fy - H, W * 1.2, H);
      g.fillStyle(ENERGY_COL.core, a).fillRect(x - W * 0.22, fy - H, W * 0.44, H);
      g.fillStyle(ENERGY_COL.light, 0.8 * a).fillEllipse(x, fy - H, W * 1.6, W * 0.9);
    }

    // destello en ESTRELLA: 8 púas (las 4 rectas, largas)
    if (t < 0.26) {
      const u = t / 0.26;
      const a = 1 - u;
      const L = k * (170 + 320 * impEase(Math.min(1, u * 2.5)));
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2 + 0.12;
        const len = (i % 2 === 0 ? L : L * 0.5) * (i % 4 === 0 ? 1.15 : 1);
        const w = k * (i % 2 === 0 ? 9 : 5) * a + 1;
        const c = Math.cos(ang);
        const s = Math.sin(ang);
        g.fillStyle(ENERGY_COL.cyan, 0.55 * a).fillTriangle(x - s * w * 2, y + c * w * 2, x + s * w * 2, y - c * w * 2, x + c * len * 1.08, y + s * len * 1.08);
        g.fillStyle(ENERGY_COL.core, a).fillTriangle(x - s * w, y + c * w, x + s * w, y - c * w, x + c * len, y + s * len);
      }
    }

    // ONDAS planas en el suelo (3, escalonadas)
    for (let r = 0; r < 3; r++) {
      const u = (t - r * 0.07) / 0.55;
      if (u <= 0 || u >= 1) continue;
      const rad = k * (30 + 340 * impEase(u));
      g.lineStyle(k * (11 * (1 - u)) + 1, r === 1 ? ENERGY_COL.core : ENERGY_COL.cyan, 0.9 * (1 - u));
      g.strokeEllipse(x, fy, rad * 2, rad * 0.62, 32);
    }

    // GRIETAS de luz en el suelo
    if (t < 0.9) {
      const a = t < 0.08 ? 1 : 1 - (t - 0.08) / 0.82;
      const n = Math.max(2, Math.ceil(IMP_CRACK_PTS * Math.min(1, t / 0.1)));
      for (let layer = 0; layer < 2; layer++) {
        if (layer === 0) g.lineStyle(6 * k + 1, ENERGY_COL.deep, 0.5 * a);
        else g.lineStyle(2.4 * k + 0.8, ENERGY_COL.core, a);
        for (let c = 0; c < IMP_CRACKS; c++) {
          const o = c * IMP_CRACK_PTS;
          g.beginPath().moveTo(this.cx[o], this.cy[o]);
          for (let j = 1; j < n; j++) g.lineTo(this.cx[o + j], this.cy[o + j]);
          g.strokePath();
        }
      }
    }

    // chisporroteo eléctrico en el suelo
    if (t > 0.1 && t < 0.7) {
      const a = 1 - (t - 0.1) / 0.6;
      for (let i = 0; i < 4; i++) {
        const ang = Math.random() * Math.PI * 2;
        const r0 = Math.random() * 130 * k;
        let px = x + Math.cos(ang) * r0;
        let py = fy + Math.sin(ang) * r0 * 0.32;
        g.lineStyle(2 * k + 0.6, i % 2 ? ENERGY_COL.cyan : ENERGY_COL.core, a).beginPath().moveTo(px, py);
        for (let j = 0; j < 3; j++) {
          px += (Math.random() - 0.5) * 40 * k;
          py += (Math.random() - 0.7) * 22 * k;
          g.lineTo(px, py);
        }
        g.strokePath();
      }
    }

    // PARTÍCULAS: esquirlas (gravedad + bote) y brasas que suben
    const pg = this.pg.clear();
    for (let i = 0; i < IMP_SHARDS; i++) {
      if (this.sl[i] <= 0) continue;
      this.sl[i] -= dt;
      this.svy[i] += IMP_G * k * dt;
      this.sx[i] += this.svx[i] * dt;
      this.sy[i] += this.svy[i] * dt;
      if (this.sy[i] > this.sg[i] && this.svy[i] > 0) {
        this.sy[i] = this.sg[i];
        this.svy[i] *= -0.35;
        this.svx[i] *= 0.6;
      }
      pg.lineStyle(2.6 * k + 0.6, i % 3 === 0 ? ENERGY_COL.cyan : ENERGY_COL.core, Math.min(1, this.sl[i] * 2));
      pg.lineBetween(this.sx[i], this.sy[i], this.sx[i] - this.svx[i] * 0.025, this.sy[i] - this.svy[i] * 0.025);
    }
    for (let i = 0; i < IMP_EMBERS; i++) {
      if (this.el[i] <= 0 || t < 0.12) continue;
      this.el[i] -= dt;
      this.ex[i] += (this.evx[i] + Math.sin(t * 9 + i) * 30 * k) * dt;
      this.ey[i] += this.evy[i] * dt;
      const a = Math.min(1, this.el[i] * 1.6) * (0.6 + 0.4 * Math.sin(t * 30 + i * 2));
      pg.fillStyle(i % 2 ? ENERGY_COL.light : ENERGY_COL.cyan, Math.max(0, a)).fillCircle(this.ex[i], this.ey[i], (2 + (i % 3)) * k);
    }

    // trocitos de cancha que saltan y botan
    const dg = this.dg.clear();
    const da = t > 0.9 ? 1 - (t - 0.9) / 0.3 : 1;
    for (let i = 0; i < IMP_DEBRIS; i++) {
      this.dvy[i] += IMP_G * k * dt;
      this.dx[i] += this.dvx[i] * dt;
      this.dy[i] += this.dvy[i] * dt;
      if (this.dy[i] > this.dgy[i] && this.dvy[i] > 0) {
        this.dy[i] = this.dgy[i];
        this.dvy[i] *= -0.4;
        this.dvx[i] *= 0.55;
      }
      const s = this.dsz[i];
      dg.fillStyle(i % 3 === 0 ? 0xe8eef8 : 0x8a93a6, da).fillRect(this.dx[i] - s / 2, this.dy[i] - s / 2, s, s * 0.7);
    }
  }

  /** Para y esconde (también al cambiar de escena o cortar la demostración). */
  stop() {
    if (this.on) this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.tick);
    this.on = false;
    if (!this.g.scene) return;
    this.g.clear().setVisible(false);
    this.pg.clear().setVisible(false);
    this.dg.clear().setVisible(false);
    this.glow.setVisible(false);
  }

  destroy() {
    this.stop();
    for (const o of [this.g, this.pg, this.dg, this.glow]) if (o.scene) o.destroy();
  }
}
