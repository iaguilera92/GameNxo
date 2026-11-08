import Phaser from 'phaser';
import type { BallState } from '../objects/Ball';
import { project } from '../view/projection';
import { INFERNO, shakeLevel } from '../logic/InfernoDrive';

/**
 * Efectos de INFERNO DRIVE (procedurales, sin hojas de sprites nuevas):
 *   GhostTrail   4 siluetas del personaje en posiciones anteriores reales del desplazamiento
 *   InfernoFire  la pelota convertida en esfera de fuego (llamas animadas a su alrededor, SIN estela)
 *   infernoShake vibración de cámara de 250 ms que se reduce sola (solo la cámara del mundo)
 *   sonidos      carga de energía, desplazamiento e impacto (Web Audio, sin archivos)
 * Todo se anima con tiempo REAL (el partido puede estar congelado por la cinemática) y con objetos
 * creados UNA vez (no se crean gráficos nuevos en cada fotograma).
 */

// ---------------------------------------------------------------- texturas
function ensureRadial(scene: Phaser.Scene, key: string, size: number, stops: [number, number][]) {
  if (scene.textures.exists(key)) return;
  const t = scene.textures.createCanvas(key, size, size);
  if (!t) return;
  const ctx = t.getContext();
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [at, a] of stops) g.addColorStop(at, `rgba(255,255,255,${a})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  t.refresh();
}

/** Lengua de fuego: gota alargada (base redonda abajo, punta arriba) con degradado. */
function ensureTongue(scene: Phaser.Scene, key: string) {
  if (scene.textures.exists(key)) return;
  const w = 40;
  const h = 96;
  const t = scene.textures.createCanvas(key, w, h);
  if (!t) return;
  const ctx = t.getContext();
  ctx.beginPath();
  ctx.moveTo(w / 2, 2);
  ctx.bezierCurveTo(w * 0.95, h * 0.45, w, h * 0.78, w / 2, h - 2);
  ctx.bezierCurveTo(0, h * 0.78, w * 0.05, h * 0.45, w / 2, 2);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, h, 0, 0);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.85)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fill();
  t.refresh();
}

const GLOW = 'fx-inferno-glow';
const TONGUE = 'fx-inferno-tongue';

/**
 * Bola de fuego animada (public/assets/inferno-ball.png): 8 frames en 4×2 celdas de 192 px, sacados de
 * inferno-1.png con cada frame recentrado en su bola (el centro de la celda = centro de la pelota) y
 * reducidos para móvil. Si la imagen falta se usa la bola dibujada por código (nunca las dos).
 */
export const FIREBALL_ART = { key: 'inferno-ball', file: 'assets/inferno-ball.png', cell: 192, frames: 8, fps: 14, anim: 'inferno-ball-spin', fill: 0.92 };

export function queueInfernoArt(load: Phaser.Loader.LoaderPlugin) {
  if (!load.scene.textures.exists(FIREBALL_ART.key)) load.spritesheet(FIREBALL_ART.key, FIREBALL_ART.file, { frameWidth: FIREBALL_ART.cell, frameHeight: FIREBALL_ART.cell });
}

// ---------------------------------------------------------------- sombras
/** Retardo entre sombras (ms): cada una muestra dónde estaba el personaje hace k × LAG. */
const GHOST_LAG_MS = 45;
const GHOST_FADE_MS = 320;

interface Snap {
  t: number;
  x: number;
  y: number;
  sx: number;
  sy: number;
  rot: number;
  key: string;
  frame: string | number;
  flip: boolean;
  ox: number;
  oy: number;
}

/**
 * Cuatro siluetas reutilizadas (creadas una vez). Durante el desplazamiento se graba la posición real
 * del sprite en cada fotograma y la sombra k se coloca donde estaba el personaje hace (k+1) × LAG.
 * La más antigua, la más transparente. Al terminar se desvanecen.
 */
export class GhostTrail {
  private imgs: Phaser.GameObjects.Image[] = [];
  private hist: Snap[] = [];
  private fadeFrom = 0;
  private active = false;
  private lag = GHOST_LAG_MS;

  constructor(scene: Phaser.Scene) {
    for (let i = 0; i < INFERNO.dash.ghosts; i++) this.imgs.push(scene.add.image(0, 0, '__DEFAULT').setVisible(false).setTint(INFERNO.dash.tint));
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.tick, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.tick, this));
  }

  /**
   * Empieza el desplazamiento. `moveMs`: lo que dura el recorrido; el retardo entre sombras es
   * moveMs / (sombras + 1), así al llegar quedan repartidas por todo el camino recorrido.
   */
  begin(moveMs = GHOST_LAG_MS * (INFERNO.dash.ghosts + 1)) {
    this.lag = moveMs / (INFERNO.dash.ghosts + 1);
    this.hist = [];
    this.fadeFrom = 0;
    this.active = true;
    this.imgs.forEach((o) => o.setVisible(false).setAlpha(1));
  }

  /** Graba la posición real actual del sprite y recoloca las sombras (llamar cada fotograma del desplazamiento). */
  record(sprite: Phaser.GameObjects.Sprite | undefined, depth: number) {
    if (!this.active || !sprite || !sprite.frame) return;
    const m = sprite.getWorldTransformMatrix();
    const now = performance.now();
    this.hist.push({ t: now, x: m.tx, y: m.ty, sx: m.scaleX, sy: m.scaleY, rot: m.rotation, key: sprite.texture.key, frame: sprite.frame.name, flip: sprite.flipX, ox: sprite.originX, oy: sprite.originY });
    if (this.hist.length > 120) this.hist.shift();
    const n = this.imgs.length;
    for (let k = 0; k < n; k++) {
      const snap = this.at(now - (k + 1) * this.lag);
      const o = this.imgs[k];
      if (!snap || Math.hypot(snap.x - m.tx, snap.y - m.ty) < 2) {
        o.setVisible(false);
        continue;
      }
      // k = 0 la más reciente (más visible) … k = n-1 la más antigua (más transparente)
      o.setTexture(snap.key, snap.frame)
        .setOrigin(snap.ox, snap.oy)
        .setPosition(snap.x, snap.y)
        .setScale(snap.sx, snap.sy)
        .setRotation(snap.rot)
        .setFlipX(snap.flip)
        .setAlpha(INFERNO.dash.ghostAlpha[n - 1 - k] ?? 0.3)
        .setDepth(depth - 0.1 - k * 0.01)
        .setVisible(true);
    }
  }

  /** Fin del desplazamiento: se quedan donde estaban y se desvanecen suavemente. */
  end() {
    if (!this.active) return;
    this.active = false;
    this.fadeFrom = performance.now();
    this.imgs.forEach((o) => o.setData('a0', o.alpha));
  }

  get count() {
    return this.imgs.filter((o) => o.visible).length;
  }

  private at(t: number): Snap | undefined {
    // la instantánea más reciente con tiempo <= t
    for (let i = this.hist.length - 1; i >= 0; i--) if (this.hist[i].t <= t) return this.hist[i];
    return undefined;
  }

  private tick() {
    if (!this.fadeFrom) return;
    const q = (performance.now() - this.fadeFrom) / GHOST_FADE_MS;
    if (q >= 1) {
      this.fadeFrom = 0;
      this.imgs.forEach((o) => o.setVisible(false));
      return;
    }
    this.imgs.forEach((o) => o.visible && o.setAlpha((o.getData('a0') as number) * (1 - q)));
  }

  clear() {
    this.active = false;
    this.fadeFrom = 0;
    this.imgs.forEach((o) => o.setVisible(false));
  }
}

// ---------------------------------------------------------------- pelota de fuego
/** la esfera de fuego mide esto × la pelota (radio de la pelota en pantalla = 12 × escala) */
export const FIREBALL_SCALE = 3;
const TONGUES = 14;
const TONGUE_COLS = [0xff2a0a, 0xff6a12, 0xffa21a, 0xffd23a];

/**
 * La pelota convertida en una esfera de fuego: halo, cuerpo y núcleo luminoso + lenguas de fuego que
 * giran y laten alrededor. TODO se coloca cada fotograma en la posición de la pelota: no queda nada
 * en el aire (sin estela ni partículas). Objetos creados una vez.
 */
export class InfernoFire {
  private t = 0;
  private last = performance.now();
  private body: Phaser.GameObjects.Image[];
  private tongues: Phaser.GameObjects.Image[] = [];
  /** bola de fuego animada (hoja de sprites); si existe sustituye a la dibujada por código */
  private art?: Phaser.GameObjects.Sprite;

  constructor(scene: Phaser.Scene) {
    if (scene.textures.exists(FIREBALL_ART.key)) {
      if (!scene.anims.exists(FIREBALL_ART.anim))
        scene.anims.create({ key: FIREBALL_ART.anim, frames: scene.anims.generateFrameNumbers(FIREBALL_ART.key, { start: 0, end: FIREBALL_ART.frames - 1 }), frameRate: FIREBALL_ART.fps, repeat: -1 });
      this.art = scene.add.sprite(0, 0, FIREBALL_ART.key, 0).setVisible(false);
    }
    ensureRadial(scene, GLOW, 64, [
      [0, 1],
      [0.35, 0.85],
      [0.7, 0.3],
      [1, 0],
    ]);
    ensureTongue(scene, TONGUE);
    this.body = [
      scene.add.image(0, 0, GLOW).setTint(0xff3a0a).setAlpha(0.55).setBlendMode(Phaser.BlendModes.ADD), // halo
      scene.add.image(0, 0, GLOW).setTint(0xff5a12).setAlpha(0.98), // cuerpo (sólido)
      scene.add.image(0, 0, GLOW).setTint(0xffb02a).setBlendMode(Phaser.BlendModes.ADD), // fuego interior
      scene.add.image(0, 0, GLOW).setTint(0xfff6c8).setBlendMode(Phaser.BlendModes.ADD), // núcleo
    ];
    for (let i = 0; i < TONGUES; i++) this.tongues.push(scene.add.image(0, 0, TONGUE).setOrigin(0.5, 0.9).setTint(TONGUE_COLS[i % TONGUE_COLS.length]).setBlendMode(Phaser.BlendModes.ADD));
    this.hide();
  }

  /** Cada fotograma: `on` = la pelota vuela como INFERNO DRIVE. */
  update(ball: BallState, on: boolean, visible: boolean) {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (!on || !visible) return this.hide();
    this.t += dt;
    const ground = project(ball.x, ball.y, 0);
    const air = project(ball.x, ball.y, ball.z);
    const k = air.s * 0.8 * (1 + Math.min(ball.z, 220) / 700);
    const R = FIREBALL_SCALE * 12 * k;
    const d = ground.sy + 2.5; // por encima de la pelota real
    if (this.art) {
      // sprite animado centrado en la pelota (misma trayectoria y altura), escala de perspectiva
      const size = (R * 2) / FIREBALL_ART.fill;
      if (!this.art.visible) this.art.play(FIREBALL_ART.anim, true);
      this.art.setPosition(air.sx, air.sy).setDisplaySize(size, size).setDepth(d).setVisible(true);
      return;
    }
    const pulse = 1 + Math.sin(this.t * 31) * 0.05 + Math.sin(this.t * 17) * 0.04;
    const [halo, body, inner, core] = this.body;
    halo.setPosition(air.sx, air.sy).setDisplaySize(R * 3.1 * pulse, R * 3.1 * pulse).setDepth(d).setVisible(true);
    // lenguas de fuego alrededor de toda la esfera: giran y laten (cada una a su ritmo)
    const spin = this.t * 2.6;
    for (let i = 0; i < TONGUES; i++) {
      const o = this.tongues[i];
      const a = spin + (i / TONGUES) * Math.PI * 2;
      const flick = 0.75 + 0.35 * Math.sin(this.t * (9 + (i % 5) * 2.3) + i * 1.7);
      const len = R * (0.95 + 0.5 * flick);
      const r0 = R * 0.62;
      o.setPosition(air.sx + Math.cos(a) * r0, air.sy + Math.sin(a) * r0)
        .setRotation(a + Math.PI / 2)
        .setDisplaySize(R * 0.62, len)
        .setAlpha(0.6 + 0.35 * flick)
        .setDepth(d + 0.005 + (i % 2) * 0.002)
        .setVisible(true);
    }
    body.setPosition(air.sx, air.sy).setDisplaySize(R * 2.05 * pulse, R * 2.05 * pulse).setDepth(d + 0.01).setVisible(true);
    inner.setPosition(air.sx, air.sy).setDisplaySize(R * 1.6, R * 1.6).setDepth(d + 0.011).setVisible(true);
    core.setPosition(air.sx, air.sy).setDisplaySize(R * (0.95 + 0.08 * Math.sin(this.t * 45)), R * (0.95 + 0.08 * Math.sin(this.t * 45))).setDepth(d + 0.012).setVisible(true);
  }

  private hide() {
    this.body.forEach((o) => o.setVisible(false));
    this.tongues.forEach((o) => o.setVisible(false));
    if (this.art?.visible) this.art.stop().setVisible(false);
  }

  clear() {
    this.hide();
  }

  /** Objetos visibles (pruebas). */
  get visibleParts() {
    return this.body.filter((o) => o.visible).length + this.tongues.filter((o) => o.visible).length + (this.art?.visible ? 1 : 0);
  }
}

// ---------------------------------------------------------------- impacto, vibración y sonido
/** Anillo de energía + chispas en el punto de contacto (mundo). */
export function infernoImpactFx(scene: Phaser.Scene, x: number, y: number, k: number) {
  // brillo de energía suave (sin anillos ni contornos)
  ensureRadial(scene, GLOW, 64, [
    [0, 1],
    [0.35, 0.85],
    [0.7, 0.3],
    [1, 0],
  ]);
  for (const [col, size, delay] of [
    [0xfff1c8, 110, 0],
    [0xff7a1a, 150, 40],
  ] as const) {
    const glow = scene.add.image(x, y, GLOW).setTint(col).setDisplaySize(size * k, size * k).setDepth(3650).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: glow, scale: glow.scale * 2.2, alpha: 0, delay, duration: 320, ease: 'Cubic.easeOut', onComplete: () => glow.destroy() });
  }
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const d = Phaser.Math.FloatBetween(60, 150) * Math.max(0.6, k);
    const sp = scene.add.circle(x, y, Phaser.Math.FloatBetween(3, 6), Phaser.Utils.Array.GetRandom([0xfff2a0, 0xffa31a, 0xff3d1a]), 1).setDepth(3651).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: sp, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.7, alpha: 0, scale: 0.3, duration: Phaser.Math.Between(320, 520), ease: 'Cubic.easeOut', onComplete: () => sp.destroy() });
  }
}

/** Vibración breve de la cámara del mundo que se reduce sola (el HUD va en otra cámara). */
export function infernoShake(scene: Phaser.Scene) {
  const lvl = shakeLevel();
  if (lvl <= 0) return;
  const I = INFERNO.shake.intensity * lvl;
  const cam = scene.cameras.main;
  cam.shake(INFERNO.shake.ms, I, true, (_c: Phaser.Cameras.Scene2D.Camera, p: number) => {
    cam.shakeEffect.intensity.set(I * (1 - p), I * (1 - p));
  });
  try {
    navigator.vibrate?.(INFERNO.hapticMs);
  } catch {
    /* sin vibración */
  }
}

function audio(scene: Phaser.Scene): AudioContext | null {
  const ctx = (scene.sound as unknown as { context?: AudioContext }).context;
  if (!ctx) return null;
  if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);
  return ctx;
}

function tone(ctx: AudioContext, f0: number, f1: number, at: number, dur: number, type: OscillatorType, vol: number) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, at);
  o.frequency.exponentialRampToValueAtTime(f1, at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + Math.min(0.08, dur * 0.3));
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(ctx.destination);
  o.start(at);
  o.stop(at + dur + 0.02);
}

/** Carga de energía (1 s ascendente), desplazamiento (silbido) e impacto (golpe grave). */
export const infernoSound = {
  charge(scene: Phaser.Scene) {
    const c = audio(scene);
    if (!c) return;
    tone(c, 90, 520, c.currentTime, 1.0, 'sawtooth', 0.05);
    tone(c, 180, 1040, c.currentTime, 1.0, 'triangle', 0.035);
  },
  dash(scene: Phaser.Scene) {
    const c = audio(scene);
    if (!c) return;
    tone(c, 1400, 300, c.currentTime, 0.28, 'sawtooth', 0.04);
  },
  impact(scene: Phaser.Scene) {
    const c = audio(scene);
    if (!c) return;
    tone(c, 160, 40, c.currentTime, 0.45, 'square', 0.12);
    tone(c, 900, 120, c.currentTime, 0.25, 'sawtooth', 0.06);
  },
};
