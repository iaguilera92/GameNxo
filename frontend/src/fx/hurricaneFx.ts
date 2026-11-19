import Phaser from 'phaser';
import { DISC, GLOW, ensureDisc, ensureEnergyGlow, previewTicker } from './energyBallFx';

/**
 * (17-11-2026) ULTI LEGENDARIA HURACÁN (`hurricane`, sin hoja de sprites: todo por código). Guion en logic/EnergyRally.ts
 * (planHurricane) y escena en MatchScene (tickHurricane):
 *   carga → golpe cargado al máximo con VIENTO potente (windShotFx) → el rival sale despedido contra el fondo y queda en el suelo
 *   (wallKnockFx) → la pelota vuelve en un GLOBITO → un TORNADO envuelve al que la lanza y lo sube (TornadoFx) → a la altura de la
 *   pelota el tornado se deshace y sale envuelto en una ESFERA AMARILLA (WindSphereFx) → SMASH al rival (la bola: HurricaneBallFx).
 * Cada efecto usa UN Graphics que se redibuja (sin crear objetos por fotograma).
 */
export const HURRICANE_COL = { core: 0xffffff, light: 0xfff6b0, gold: 0xffd23f, deep: 0xe0a400, wind: 0xe8fff0, mint: 0x9cf5c8 };
const R = Phaser.Math.FloatBetween;
const pick = <T>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];
const kill = (o: Phaser.GameObjects.GameObject) => () => o.destroy();

// ---------------------------------------------------------------- la bola (vuelo del smash final)
/**
 * La bola del HURACÁN (vuelo del smash final y vista previa).
 * (18-11-2026, usuario) GIRA COMO UN HURACÁN: núcleo BLANCO, halo AMARILLO alrededor, 4 brazos en espiral que giran rápido (las bandas del
 * huracán) y RAYOS BLANCOS en zigzag que salen del borde del círculo y van GIRANDO a su alrededor.
 * (18-11-2026, rendimiento: "se pega") el halo y el núcleo son IMÁGENES teñidas (un cuadro en la GPU cada una) en vez de 5 círculos de Graphics
 * que se volvían a teselar en cada fotograma; en el Graphics solo quedan las espirales y los rayos, sin crear arreglos por fotograma.
 */
export class HurricaneBallFx {
  private readonly g: Phaser.GameObjects.Graphics;
  /** rayos (encima del núcleo) */
  private readonly g2: Phaser.GameObjects.Graphics;
  private readonly halo: Phaser.GameObjects.Image;
  private readonly glow: Phaser.GameObjects.Image;
  private readonly core: Phaser.GameObjects.Image;
  private t = 0;
  private readonly px = new Float32Array(5);
  private readonly py = new Float32Array(5);
  constructor(scene: Phaser.Scene, parent?: Phaser.GameObjects.Container) {
    ensureEnergyGlow(scene);
    ensureDisc(scene);
    const ADD = Phaser.BlendModes.ADD;
    this.halo = scene.add.image(0, 0, GLOW).setTint(HURRICANE_COL.deep).setBlendMode(ADD).setVisible(false);
    this.glow = scene.add.image(0, 0, GLOW).setTint(HURRICANE_COL.gold).setBlendMode(ADD).setVisible(false);
    this.g = scene.add.graphics().setBlendMode(ADD).setVisible(false);
    this.core = scene.add.image(0, 0, DISC).setTint(HURRICANE_COL.core).setVisible(false);
    this.g2 = scene.add.graphics().setBlendMode(ADD).setVisible(false);
    if (parent) parent.add([this.halo, this.glow, this.g, this.core, this.g2]);
  }
  draw(dt: number, x: number, y: number, r: number, depth: number) {
    this.t += dt;
    const t = this.t;
    const C = HURRICANE_COL;
    const pulse = 1 + 0.07 * Math.sin(t * 22);
    // halo amarillo (antes 3 círculos: ahora 2 brillos suaves)
    this.halo.setPosition(x, y).setDisplaySize(r * 5 * pulse, r * 5 * pulse).setAlpha(0.7).setDepth(depth - 0.02).setVisible(true);
    this.glow.setPosition(x, y).setDisplaySize(r * 3.2 * pulse, r * 3.2 * pulse).setAlpha(0.95).setDepth(depth - 0.01).setVisible(true);
    const g = this.g.clear().setDepth(depth).setVisible(true);
    // brazos en espiral del huracán (amarillo claro / dorado), girando rápido
    const spin = t * 9;
    for (let i = 0; i < 4; i++) {
      const a0 = spin + (i * Math.PI) / 2;
      g.lineStyle(Math.max(1.5, r * 0.2), i % 2 ? C.light : C.gold, 0.85).beginPath();
      for (let j = 0; j <= 8; j++) {
        const q = j / 8;
        const rr = r * (0.55 + 1.35 * q);
        const th = a0 + q * 2.4;
        if (j === 0) g.moveTo(x + Math.cos(th) * rr, y + Math.sin(th) * rr);
        else g.lineTo(x + Math.cos(th) * rr, y + Math.sin(th) * rr);
      }
      g.strokePath();
    }
    // la pelota: BLANCA (disco macizo, encima de las espirales)
    this.core.setPosition(x, y).setDisplaySize(r * 1.9, r * 1.9).setAlpha(0.95).setDepth(depth + 0.01).setVisible(true);
    // RAYOS blancos que salen del borde y GIRAN alrededor del círculo (cambian de forma a saltos)
    const n = 6;
    const slot = Math.floor(t * 18);
    const rot = t * 5;
    const px = this.px;
    const py = this.py;
    const g2 = this.g2.clear().setDepth(depth + 0.02).setVisible(true);
    for (let i = 0; i < n; i++) {
      const a = rot + (i * Math.PI * 2) / n;
      const len = r * (1.3 + 0.5 * (hash(slot * 7 + i) * 0.5 + 0.5));
      for (let j = 0; j <= 4; j++) {
        const q = j / 4;
        const d = r * 0.9 + len * q;
        const off = j === 0 ? 0 : hash(slot * 31 + i * 5 + j) * r * 0.32;
        const bend = q * q * 0.45; // se curva en el sentido del giro (arrastrados por el huracán)
        const cb = Math.cos(a + bend);
        const sb = Math.sin(a + bend);
        px[j] = x + cb * d - sb * off;
        py[j] = y + sb * d + cb * off;
      }
      for (let layer = 0; layer < 2; layer++) {
        if (layer === 0) g2.lineStyle(Math.max(1, r * 0.22), C.gold, 0.45);
        else g2.lineStyle(Math.max(1, r * 0.09), C.core, 1);
        g2.beginPath().moveTo(px[0], py[0]);
        for (let j = 1; j <= 4; j++) g2.lineTo(px[j], py[j]);
        g2.strokePath();
      }
    }
  }
  hide() {
    this.g.clear().setVisible(false);
    this.g2.clear().setVisible(false);
    this.halo.setVisible(false);
    this.glow.setVisible(false);
    this.core.setVisible(false);
  }
}

/** pseudo-aleatorio determinista en [−1, 1) (el zigzag de los rayos cambia a saltos, igual en cada redibujo del mismo instante) */
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
};

/** Vista previa (Tienda, PERSONALIZAR): la bola con su remolino. Con `animate`, se redibuja solo si se ve y a ~30 fps (previewTicker). */
export function addHurricanePreview(scene: Phaser.Scene, c: Phaser.GameObjects.Container, maxW: number, maxH: number, animate: boolean) {
  const fx = new HurricaneBallFx(scene, c);
  const r = Math.min(maxW, maxH) * 0.2;
  fx.draw(0.3, 0, 0, r, 0);
  if (!animate) return;
  previewTicker(scene, c, (dt) => fx.draw(dt, 0, 0, r, 0));
}


// ---------------------------------------------------------------- golpes
/** Golpe del HURACÁN en la raqueta: aros amarillos y ráfagas de viento curvas que salen. */
export function hurricaneBurst(scene: Phaser.Scene, x: number, y: number, k: number) {
  const kk = Math.max(0.6, k);
  const C = HURRICANE_COL;
  for (let i = 0; i < 2; i++) {
    const ring = scene.add.circle(x, y, 18 * kk, 0xffffff, 0).setStrokeStyle((5 - i * 2) * kk, i ? C.gold : C.light, 0.95).setDepth(3651).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: ring, scale: 4 + i, alpha: 0, delay: i * 60, duration: 360, ease: 'Cubic.easeOut', onComplete: kill(ring) });
  }
  gusts(scene, x, y, kk, 3652, 10, 70, 150);
}

/** `n` ráfagas de viento (arcos que se abren girando y se apagan) desde (x, y). */
function gusts(scene: Phaser.Scene, x: number, y: number, k: number, depth: number, n: number, d0: number, d1: number) {
  const C = HURRICANE_COL;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + R(-0.2, 0.2);
    const g = scene.add.graphics({ x, y }).setDepth(depth).setBlendMode(Phaser.BlendModes.ADD).setRotation(a);
    const L = R(d0, d1) * k;
    g.lineStyle(R(2.5, 4.5) * k, pick([C.wind, C.light, C.mint]), 0.9).beginPath().arc(L * 0.4, 0, L * 0.45, -0.9, 0.9).strokePath();
    g.setScale(0.3);
    scene.tweens.add({ targets: g, scale: 1.3, alpha: 0, rotation: a + R(0.6, 1.2), duration: R(320, 480), ease: 'Cubic.easeOut', onComplete: kill(g) });
  }
}

/**
 * Golpe con VIENTO POTENTE (el primero del guion, golpe cargado al máximo): un cono de viento hacia el rival (dirección en pantalla
 * `dx, dy`), ráfagas alrededor y polvo. `k` = escala de la perspectiva en el contacto.
 */
export function windShotFx(scene: Phaser.Scene, x: number, y: number, k: number, dx: number, dy: number) {
  const kk = Math.max(0.7, k);
  const C = HURRICANE_COL;
  const ang = Math.atan2(dy, dx);
  // cono de viento: líneas largas que salen hacia el rival
  for (let i = 0; i < 9; i++) {
    const a = ang + R(-0.32, 0.32);
    const g = scene.add.graphics({ x, y }).setDepth(3652).setBlendMode(Phaser.BlendModes.ADD).setRotation(a);
    const L = R(90, 190) * kk;
    g.lineStyle(R(2, 4) * kk, pick([C.wind, C.mint, C.light]), 0.9).lineBetween(R(10, 30) * kk, R(-6, 6) * kk, L, R(-10, 10) * kk);
    g.setScale(0.2, 1);
    scene.tweens.add({ targets: g, scaleX: 1.6, alpha: 0, duration: R(260, 420), ease: 'Cubic.easeOut', onComplete: kill(g) });
  }
  gusts(scene, x, y, kk, 3652, 8, 60, 130);
  const flash = scene.add.circle(x, y, 30 * kk, C.light, 0.9).setDepth(3653).setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({ targets: flash, scale: 2.6, alpha: 0, duration: 200, ease: 'Quad.easeOut', onComplete: kill(flash) });
}

/** El rival choca contra el FONDO (o la pared): destello, polvo que se abre, onda a ras de suelo y ráfagas. (x, y) = sus pies. */
export function wallKnockFx(scene: Phaser.Scene, x: number, y: number, k: number) {
  const kk = Math.max(0.7, k);
  const C = HURRICANE_COL;
  const D = y + 4;
  const flash = scene.add.ellipse(x, y - 50 * kk, 120 * kk, 160 * kk, C.light, 0.75).setDepth(D + 2).setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({ targets: flash, scaleX: 1.8, alpha: 0, duration: 220, ease: 'Quad.easeOut', onComplete: kill(flash) });
  for (let i = 0; i < 2; i++) {
    const w = scene.add.ellipse(x, y, 70 * kk, 22 * kk).setStrokeStyle((5 - i * 2) * kk, i ? C.gold : C.wind, 0.9).setDepth(y - 1).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: w, scaleX: 4.4 + i, scaleY: 3 + i, alpha: 0, delay: i * 70, duration: 460, ease: 'Cubic.easeOut', onComplete: kill(w) });
  }
  for (let i = 0; i < 10; i++) {
    const a = Math.PI + R(0, Math.PI);
    const p = scene.add.circle(x + R(-20, 20) * kk, y, R(8, 16) * kk, pick([0xd8d2c4, 0xc4bca8, 0xeee8da]), 0.75).setDepth(D);
    scene.tweens.add({ targets: p, x: p.x + Math.cos(a) * R(40, 110) * kk, y: p.y + Math.sin(a) * R(20, 60) * kk, scale: 2.2, alpha: 0, duration: R(500, 800), ease: 'Cubic.easeOut', onComplete: kill(p) });
  }
  gusts(scene, x, y - 40 * kk, kk, D + 1, 7, 50, 110);
}

// ---------------------------------------------------------------- tornado en IMAGEN (18-11-2026)
/** Hoja del TORNADO (assets/ulti-legendaria-tornado.webp, sin fondo): 8 cuadros de 192 × 256 (círculo en el suelo → tornado → se desarma). */
export const TORNADO_ART = { key: 'ulti-legendaria-tornado', file: 'assets/ulti-legendaria-tornado.webp', w: 192, h: 256, frames: 8, baseY: 0.93 } as const;

/**
 * (18-11-2026, usuario) TORNADO de la ULTI LEGENDARIA HURACÁN con la hoja de ChatGPT: el cuadro lo elige quien lo usa (`frame` 0..7); la base va
 * en los pies y el alto llega hasta `topY` (cubre al personaje completo mientras sube). Sin la hoja cargada no dibuja nada (`ok` = false).
 */
export class TornadoSprite {
  private img: Phaser.GameObjects.Image | null = null;
  constructor(private readonly scene: Phaser.Scene) {}
  get ok() {
    return this.scene.textures.exists(TORNADO_ART.key);
  }
  draw(frame: number, x: number, feetY: number, topY: number, depth: number) {
    if (!this.ok) return;
    this.img ??= this.scene.add.image(0, 0, TORNADO_ART.key, 0).setOrigin(0.5, TORNADO_ART.baseY);
    const f = Math.max(0, Math.min(TORNADO_ART.frames - 1, Math.floor(frame)));
    const k = Math.max(20, feetY - topY) / (TORNADO_ART.h * 0.85);
    this.img.setFrame(f).setPosition(x, feetY).setScale(k).setDepth(depth).setAlpha(1).setVisible(true);
  }
  hide() {
    this.img?.setVisible(false);
  }
  /**
   * (18-11-2026, rendimiento) Precarga: la hoja se sube a la GPU la primera vez que se DIBUJA, y eso daba un tirón justo al saltar. Se dibuja un
   * instante casi transparente (fuera de la vista del jugador: tras la cortinilla) y se esconde.
   */
  warm(x: number, y: number, depth: number) {
    if (!this.ok || this.img) return;
    this.img = this.scene.add.image(x, y, TORNADO_ART.key, 0).setOrigin(0.5, TORNADO_ART.baseY).setAlpha(0.01).setDepth(depth).setScale(0.2);
    this.scene.time.delayedCall(120, () => {
      if (this.img?.scene) this.img.setAlpha(1).setVisible(false);
    });
  }
}

// ---------------------------------------------------------------- tornado y esfera (sobre el que la lanza)
/**
 * TORNADO que envuelve al personaje y lo sube: embudo de anillos de viento (anchos arriba, estrechos abajo) que giran rápido, del
 * suelo hasta por encima de su cabeza, con polvo y hojas de luz que suben en espiral. `u` = 0..1 (entra, se queda, y en `u > 0.85` se
 * deshace abriéndose).
 */
export class TornadoFx {
  private g: Phaser.GameObjects.Graphics;
  private t = 0;
  private readonly bits = Array.from({ length: 16 }, (_, i) => ({ a: Math.random() * Math.PI * 2, h: i / 16, sp: R(0.5, 1.2) }));
  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
  }
  /** (x, feetY) = pies en el suelo; `topY` = arriba del embudo (pantalla); `k` = perspectiva; `depth` = la del personaje. */
  draw(dt: number, u: number, x: number, feetY: number, topY: number, k: number, depth: number) {
    this.t += dt;
    const C = HURRICANE_COL;
    const g = this.g.clear().setDepth(depth + 0.6).setVisible(true);
    const inA = Math.min(1, u / 0.15);
    const outA = u > 0.85 ? Math.max(0, 1 - (u - 0.85) / 0.15) : 1;
    const open = u > 0.85 ? 1 + (u - 0.85) * 6 : 1; // se abre al deshacerse
    const a = inA * outA;
    if (a <= 0) return;
    const H = Math.max(40, feetY - topY);
    const rings = 9;
    for (let i = 0; i < rings; i++) {
      const q = i / (rings - 1);
      const cy = feetY - H * q;
      const rx = (16 + 52 * q * q) * k * open * (1 + 0.06 * Math.sin(this.t * 9 + i));
      const ry = rx * 0.3;
      const spin = this.t * (14 - q * 5) + i * 0.8;
      g.lineStyle(Math.max(1.5, (4.5 - 2 * q) * k), i % 3 === 1 ? C.gold : i % 3 === 2 ? C.mint : C.wind, (0.55 + 0.3 * (1 - q)) * a).beginPath();
      for (let j = 0; j <= 18; j++) {
        const th = spin + (j / 18) * Math.PI * 1.7;
        const px = x + Math.cos(th) * rx;
        const py = cy + Math.sin(th) * ry;
        if (j === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.strokePath();
    }
    // polvo en la base
    g.fillStyle(0xe8e2d4, 0.18 * a).fillEllipse(x, feetY, 120 * k * open, 30 * k);
    // motas de luz que suben en espiral
    for (const b of this.bits) {
      const h = (b.h + this.t * b.sp * 0.6) % 1;
      const th = b.a + this.t * 8 * b.sp;
      const rr = (18 + 52 * h * h) * k * open;
      g.fillStyle(h > 0.5 ? C.light : C.wind, 0.85 * a * (1 - h * 0.4)).fillCircle(x + Math.cos(th) * rr, feetY - H * h + Math.sin(th) * rr * 0.3, Math.max(1.4, 2.6 * k));
    }
  }
  hide() {
    this.g.clear().setVisible(false);
  }
}

/**
 * (18-11-2026, usuario) La ESFERA AMARILLA se DESARMA y deja ver al personaje: destello, dos aros que se abren, esquirlas de luz dorada y ráfagas.
 * (x, y) = centro de la esfera; `r` = su radio en pantalla.
 */
export function sphereBreakFx(scene: Phaser.Scene, x: number, y: number, r: number, depth: number) {
  const C = HURRICANE_COL;
  const ADD = Phaser.BlendModes.ADD;
  const flash = scene.add.circle(x, y, r, C.light, 0.9).setDepth(depth + 1).setBlendMode(ADD);
  scene.tweens.add({ targets: flash, scale: 1.8, alpha: 0, duration: 220, ease: 'Quad.easeOut', onComplete: kill(flash) });
  for (let i = 0; i < 2; i++) {
    const ring = scene.add.circle(x, y, r, 0xffffff, 0).setStrokeStyle(Math.max(2, r * (0.09 - i * 0.03)), i ? C.gold : C.core, 0.95).setDepth(depth + 1).setBlendMode(ADD);
    scene.tweens.add({ targets: ring, scale: 2.2 + i * 0.6, alpha: 0, delay: i * 60, duration: 380, ease: 'Cubic.easeOut', onComplete: kill(ring) });
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + R(-0.2, 0.2);
    const sh = scene.add.star(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7, 4, r * 0.05, r * 0.16, pick([C.gold, C.light, C.core]), 1).setDepth(depth + 1).setBlendMode(ADD);
    scene.tweens.add({ targets: sh, x: x + Math.cos(a) * r * R(1.8, 2.6), y: y + Math.sin(a) * r * R(1.8, 2.6), angle: R(-180, 180), alpha: 0, duration: R(320, 520), ease: 'Cubic.easeOut', onComplete: kill(sh) });
  }
  gusts(scene, x, y, Math.max(0.6, r / 60), depth + 1, 6, 40, 90);
}

/**
 * ESFERA AMARILLA que envuelve al personaje en el aire (tras el tornado), con viento que gira por su borde. `a` = opacidad.
 * (18-11-2026, rendimiento) los rellenos son IMÁGENES teñidas (brillo suave y discos macizos) en vez de círculos de Graphics redibujados en cada
 * fotograma; el Graphics solo lleva los bordes y el viento.
 */
export class WindSphereFx {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly glow: Phaser.GameObjects.Image;
  private readonly d1: Phaser.GameObjects.Image;
  private readonly d2: Phaser.GameObjects.Image;
  private readonly d3: Phaser.GameObjects.Image;
  private readonly core: Phaser.GameObjects.Image;
  private t = 0;
  constructor(scene: Phaser.Scene) {
    ensureEnergyGlow(scene);
    ensureDisc(scene);
    const ADD = Phaser.BlendModes.ADD;
    this.glow = scene.add.image(0, 0, GLOW).setTint(HURRICANE_COL.gold).setBlendMode(ADD).setVisible(false);
    this.d1 = scene.add.image(0, 0, DISC).setTint(HURRICANE_COL.deep).setVisible(false);
    this.d2 = scene.add.image(0, 0, DISC).setTint(HURRICANE_COL.gold).setVisible(false);
    this.d3 = scene.add.image(0, 0, DISC).setTint(HURRICANE_COL.light).setVisible(false);
    this.core = scene.add.image(0, 0, GLOW).setTint(HURRICANE_COL.core).setBlendMode(ADD).setVisible(false);
    this.g = scene.add.graphics().setBlendMode(ADD).setVisible(false);
  }
  private put(o: Phaser.GameObjects.Image, x: number, y: number, size: number, alpha: number, depth: number) {
    o.setPosition(x, y).setDisplaySize(size, size).setAlpha(alpha).setDepth(depth).setVisible(alpha > 0.01);
  }
  /** `solid` (18-11-2026) = 0..1: la esfera se vuelve un CÍRCULO amarillo brillante y macizo (el personaje "se convierte" en ella). */
  draw(dt: number, x: number, y: number, r: number, depth: number, a: number, solid = 0) {
    this.t += dt;
    const C = HURRICANE_COL;
    const D = depth + 0.5;
    const g = this.g.clear().setDepth(D + 0.05).setVisible(a > 0.01);
    if (a <= 0.01) return this.hideFills();
    if (solid > 0) {
      // (18-11-2026, usuario) círculo amarillo LIMPIO: relleno que tapa al personaje, borde dorado y brillo suave
      const p2 = 1 + 0.025 * Math.sin(this.t * 10);
      const k = a * solid;
      this.put(this.glow, x, y, r * 2.9 * p2, 0.5 * k, D - 0.01);
      this.put(this.d1, x, y, r * 2 * p2, 0.85 * k, D);
      this.put(this.d2, x, y, r * 1.8 * p2, 0.95 * k, D + 0.01);
      this.put(this.d3, x, y, r * 1.32 * p2, 0.95 * k, D + 0.02);
      this.put(this.core, x, y, r * 1.2 * p2, 0.9 * k, D + 0.03);
      g.lineStyle(Math.max(2, r * 0.05), C.light, 0.9 * k).strokeCircle(x, y, r * p2);
      return;
    }
    const pulse = 1 + 0.05 * Math.sin(this.t * 14);
    this.put(this.glow, x, y, r * 3 * pulse, 0.45 * a, D - 0.01);
    this.d1.setVisible(false);
    this.d2.setVisible(false);
    this.put(this.d3, x, y, r * 2 * pulse, 0.16 * a, D);
    this.core.setVisible(false);
    g.lineStyle(Math.max(2, r * 0.06), C.gold, 0.9 * a).strokeCircle(x, y, r * pulse);
    g.lineStyle(Math.max(1, r * 0.025), C.core, 0.8 * a).strokeCircle(x, y, r * 0.93 * pulse);
    // viento que corre por el borde
    for (let i = 0; i < 3; i++) {
      const a0 = this.t * (6 + i) + (i * Math.PI * 2) / 3;
      g.lineStyle(Math.max(1.5, r * 0.05), i === 1 ? C.wind : C.light, 0.85 * a).beginPath().arc(x, y, r * (1.05 + 0.07 * i), a0, a0 + 1.4).strokePath();
    }
  }
  private hideFills() {
    for (const o of [this.glow, this.d1, this.d2, this.d3, this.core]) o.setVisible(false);
  }
  hide() {
    this.g.clear().setVisible(false);
    this.hideFills();
  }
}
