import Phaser from 'phaser';
import type { BallState } from '../objects/Ball';
import { project } from '../view/projection';
import { INFERNO, shakeLevel } from '../logic/InfernoDrive';

/**
 * Efectos de INFERNO DRIVE (procedurales, sin hojas de sprites nuevas):
 *   GhostTrail   4 imágenes residuales del personaje (copias del fotograma actual de su sprite)
 *   InfernoFire  bola de fuego 3× la pelota + estela de fuego (partículas en pool)
 *   infernoShake vibración de cámara de 250 ms que se reduce sola (solo la cámara del mundo)
 *   sonidos      carga de energía, desplazamiento e impacto (Web Audio, sin archivos)
 * Todo se anima con tiempo REAL (el partido puede estar congelado por la cinemática).
 */

// ---------------------------------------------------------------- texturas
function ensureTex(scene: Phaser.Scene, key: string, size: number, stops: [number, number][]) {
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
const FLAME = 'fx-inferno-flame';

// ---------------------------------------------------------------- sombras
interface Ghost {
  o: Phaser.GameObjects.Image;
  t0: number;
  a0: number;
}

export class GhostTrail {
  private ghosts: Ghost[] = [];

  constructor(private scene: Phaser.Scene) {
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.tick, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.tick, this);
      this.clear();
    });
  }

  /** Copia el fotograma actual de los sprites (mismo tamaño, proporción, giro y volteo). */
  spawn(sprites: Phaser.GameObjects.Sprite[], index: number, depth: number) {
    const a0 = INFERNO.dash.ghostAlpha[index] ?? 0.4;
    for (const s of sprites) {
      if (!s.visible || !s.frame) continue;
      const m = s.getWorldTransformMatrix();
      const img = this.scene.add
        .image(m.tx, m.ty, s.texture.key, s.frame.name)
        .setOrigin(s.originX, s.originY)
        .setScale(m.scaleX, m.scaleY)
        .setRotation(m.rotation)
        .setFlipX(s.flipX)
        .setTint(INFERNO.dash.tint)
        .setAlpha(a0)
        .setDepth(depth - 0.2 - (INFERNO.dash.ghosts - index) * 0.01);
      this.ghosts.push({ o: img, t0: performance.now(), a0 });
    }
  }

  get count() {
    return this.ghosts.length;
  }

  private tick() {
    const now = performance.now();
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      const g = this.ghosts[i];
      // se mantienen un momento y se desvanecen progresivamente
      const q = (now - g.t0 - 220) / INFERNO.dash.ghostFadeMs;
      if (q >= 1) {
        g.o.destroy();
        this.ghosts.splice(i, 1);
      } else if (q > 0) g.o.setAlpha(g.a0 * (1 - q));
    }
  }

  clear() {
    this.ghosts.forEach((g) => g.o.destroy());
    this.ghosts = [];
  }
}

// ---------------------------------------------------------------- pelota de fuego
interface Flame {
  o: Phaser.GameObjects.Image;
  age: number;
  life: number;
  vx: number;
  vy: number;
  s0: number;
}
const FIRE_POOL = 140;
/** la bola de fuego mide esto × la pelota */
export const FIREBALL_SCALE = 3;
const FIRE_COLS = [0xfff2a0, 0xffc02a, 0xff7a1a, 0xff3d1a, 0xb3200f];

export class InfernoFire {
  private live: Flame[] = [];
  private free: Phaser.GameObjects.Image[] = [];
  private acc = 0;
  private spin = 0;
  private prev?: { x: number; y: number };
  private last = performance.now();
  private ball: Phaser.GameObjects.Image[];

  constructor(scene: Phaser.Scene) {
    ensureTex(scene, FLAME, 48, [
      [0, 1],
      [0.35, 0.85],
      [0.7, 0.3],
      [1, 0],
    ]);
    for (let i = 0; i < FIRE_POOL; i++) this.free.push(scene.add.image(0, 0, FLAME).setBlendMode(Phaser.BlendModes.ADD).setVisible(false));
    // bola de fuego: halo rojo sólido + llama naranja + núcleo amarillo-blanco
    this.ball = [
      scene.add.image(0, 0, FLAME).setTint(0xff3a0a).setAlpha(0.95).setVisible(false),
      scene.add.image(0, 0, FLAME).setTint(0xff9a1a).setBlendMode(Phaser.BlendModes.ADD).setVisible(false),
      scene.add.image(0, 0, FLAME).setTint(0xfff3b0).setBlendMode(Phaser.BlendModes.ADD).setVisible(false),
    ];
  }

  /** Cada fotograma: `on` = la pelota vuela como INFERNO DRIVE. */
  update(ball: BallState, on: boolean, visible: boolean) {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const ground = project(ball.x, ball.y, 0);
    const air = project(ball.x, ball.y, ball.z);
    const k = air.s * 0.8 * (1 + Math.min(ball.z, 220) / 700);
    const vx = this.prev ? (air.sx - this.prev.x) / Math.max(dt, 1e-3) : 0;
    const vy = this.prev ? (air.sy - this.prev.y) / Math.max(dt, 1e-3) : 0;
    this.prev = { x: air.sx, y: air.sy };
    // --- la bola de fuego: 3 veces la pelota (radio de la pelota = 12 × k), por encima de ella
    const show = on && visible;
    const R = FIREBALL_SCALE * 12 * k;
    this.spin += dt;
    const flick = 1 + Math.sin(this.spin * 38) * 0.05 + Math.sin(this.spin * 23) * 0.04;
    const [outer, mid, core] = this.ball;
    for (const o of this.ball) o.setVisible(show);
    if (show) {
      const d = ground.sy + 2.5;
      outer.setPosition(air.sx, air.sy).setDisplaySize(R * 2.5 * flick, R * 2.5 * flick).setDepth(d);
      mid.setPosition(air.sx, air.sy).setDisplaySize(R * 1.9 * flick, R * 1.9 * flick).setDepth(d + 0.01);
      core.setPosition(air.sx, air.sy).setDisplaySize(R * 1.15, R * 1.15).setDepth(d + 0.02);
      // estela: llamas que se quedan atrás siguiendo la dirección y velocidad de la bola
      this.acc += dt;
      while (this.acc > 0.012) {
        this.acc -= 0.012;
        const jx = Phaser.Math.FloatBetween(-0.35, 0.35) * R;
        const jy = Phaser.Math.FloatBetween(-0.35, 0.35) * R;
        this.emit(air.sx - vx * 0.01 + jx, air.sy - vy * 0.01 + jy, -vx * 0.06, -vy * 0.06 - 25, Phaser.Math.FloatBetween(0.28, 0.45), Phaser.Math.FloatBetween(1.6, 2.2) * R, ground.sy + 2.3);
      }
    } else this.acc = 0;

    for (let i = this.live.length - 1; i >= 0; i--) {
      const f = this.live[i];
      f.age += dt;
      const q = f.age / f.life;
      if (q >= 1) {
        f.o.setVisible(false);
        this.free.push(f.o);
        this.live.splice(i, 1);
        continue;
      }
      f.o.x += f.vx * dt;
      f.o.y += f.vy * dt;
      // amarillo → naranja → rojo al envejecer
      f.o.setTint(FIRE_COLS[Math.min(FIRE_COLS.length - 1, Math.floor(q * FIRE_COLS.length))]);
      f.o.setScale(f.s0 * (1 - q * 0.55)).setAlpha(0.9 * (1 - q));
    }
  }

  private emit(x: number, y: number, vx: number, vy: number, life: number, size: number, depth: number) {
    const o = this.free.pop() ?? this.live.shift()?.o;
    if (!o) return;
    const s0 = size / 48;
    o.setPosition(x, y).setDepth(depth).setScale(s0).setAlpha(0.9).setTint(FIRE_COLS[0]).setVisible(true);
    this.live.push({ o, age: 0, life, vx, vy, s0 });
  }

  clear() {
    for (const f of this.live) {
      f.o.setVisible(false);
      this.free.push(f.o);
    }
    this.live = [];
    this.prev = undefined;
    for (const o of this.ball) o.setVisible(false);
  }
}

// ---------------------------------------------------------------- impacto, vibración y sonido
/** Anillo de energía + chispas en el punto de contacto (mundo). */
export function infernoImpactFx(scene: Phaser.Scene, x: number, y: number, k: number) {
  for (const [col, size, delay] of [
    [0xffffff, 5, 0],
    [0xff7a1a, 7, 60],
    [0xff3d1a, 9, 120],
  ] as const) {
    const ring = scene.add.circle(x, y, 14 * k + 6, 0xffffff, 0).setStrokeStyle(7, col, 1).setDepth(3650).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: ring, scale: size, alpha: 0, delay, duration: 460, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
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
