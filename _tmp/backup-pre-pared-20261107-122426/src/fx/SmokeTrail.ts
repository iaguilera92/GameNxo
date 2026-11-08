import Phaser from 'phaser';
import type { BallState } from '../objects/Ball';
import { project } from '../view/projection';

/**
 * Humo denso pegado a la pelota mientras vuela un SMASH.
 * Puffs suaves (textura de degradado radial generada una vez) en un pool actualizado a mano:
 * sin tweens ni objetos nuevos por fotograma.
 *   medio  → SMASH normal
 *   fuerte → SMASH potenciado (más oscuro, más denso, con chispas doradas)
 */
export const SMOKE = {
  normal: { every: 0.014, per: 1, size: [26, 36], life: [0.55, 0.8], alpha: 0.75, colors: [0x3c3742, 0x55505c, 0x6d6874] },
  strong: { every: 0.01, per: 1, size: [30, 42], life: [0.65, 0.95], alpha: 0.82, colors: [0x1d1922, 0x2b2730, 0x3c3742, 0x4a4450] },
  grow: 2.4, // escala final del puff
  rise: 40, // px que sube durante su vida
  sparkChance: 0.45, // potenciado: probabilidad de chispa dorada por emisión
};

const TEX = 'fx-smoke-puff';
const SPARK_TEX = 'fx-smoke-spark';
const POOL = 150;
/** el humo nace un poco por detrás de la pelota (s de trayectoria), para que la pelota se vea delante */
const BEHIND = 0.02;

interface Puff {
  o: Phaser.GameObjects.Image;
  age: number;
  life: number;
  a0: number;
  s0: number;
  vx: number;
  vy: number;
  spin: number;
  spark: boolean;
}

/** Texturas de puff (degradado radial blanco → transparente), creadas una sola vez. */
function ensureTextures(scene: Phaser.Scene) {
  const make = (key: string, size: number, stops: [number, number][]) => {
    if (scene.textures.exists(key)) return;
    const t = scene.textures.createCanvas(key, size, size);
    if (!t) return;
    const ctx = t.getContext();
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [at, a] of stops) g.addColorStop(at, `rgba(255,255,255,${a})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    t.refresh();
  };
  make(TEX, 64, [
    [0, 1],
    [0.45, 0.75],
    [0.75, 0.28],
    [1, 0],
  ]);
  make(SPARK_TEX, 16, [
    [0, 1],
    [0.4, 0.9],
    [1, 0],
  ]);
}

export class SmokeTrail {
  private live: Puff[] = [];
  private free: Phaser.GameObjects.Image[] = [];
  private timer = 0;

  constructor(scene: Phaser.Scene) {
    ensureTextures(scene);
    for (let i = 0; i < POOL; i++) this.free.push(scene.add.image(0, 0, TEX).setVisible(false).setActive(false));
  }

  /** Llamar cada fotograma. `on`: la pelota vuela como SMASH; `strong`: potenciado. */
  update(dt: number, ball: BallState, on: boolean, strong: boolean, visible = true) {
    if (on && visible) {
      const cfg = strong ? SMOKE.strong : SMOKE.normal;
      this.timer = Math.max(this.timer - dt, -0.06); // tirón de fotogramas: no más de unas pocas emisiones
      while (this.timer <= 0) {
        this.timer += cfg.every;
        const ground = project(ball.x, ball.y, 0);
        const air = project(ball.x, ball.y, ball.z);
        const tail = project(ball.x - ball.vx * BEHIND, ball.y - ball.vy * BEHIND, Math.max(0, ball.z - ball.vz * BEHIND));
        const k = air.s * 0.8 * (1 + Math.min(ball.z, 220) / 700); // misma escala que el sprite de la pelota
        for (let i = 0; i < cfg.per; i++) this.spawn(tail.sx, tail.sy, ground.sy + 1.5, k, cfg, false);
        if (strong && Math.random() < SMOKE.sparkChance) this.spawn(air.sx, air.sy, ground.sy + 2.5, k, cfg, true);
      }
    } else this.timer = 0;

    // el humo nunca por delante de la pelota (si se aleja de cámara, el humo viejo tendría más profundidad)
    const ballDepth = visible ? project(ball.x, ball.y, 0).sy + 2 : Infinity;
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      if (!p.spark && p.o.depth >= ballDepth) p.o.setDepth(ballDepth - 0.5);
      p.age += dt;
      const f = p.age / p.life;
      if (f >= 1) {
        p.o.setVisible(false).setActive(false);
        this.free.push(p.o);
        this.live.splice(i, 1);
        continue;
      }
      p.o.x += p.vx * dt;
      p.o.y += p.vy * dt;
      p.o.rotation += p.spin * dt;
      if (p.spark) p.o.setScale(p.s0 * (1 - f)).setAlpha(p.a0 * (1 - f));
      else {
        const grow = 1 + (SMOKE.grow - 1) * (1 - (1 - f) * (1 - f));
        // entra rápido, se disipa despacio
        const fade = f < 0.12 ? f / 0.12 : 1 - (f - 0.12) / 0.88;
        p.o.setScale(p.s0 * grow).setAlpha(p.a0 * fade);
      }
    }
  }

  /** Apaga todo (fin de punto). */
  clear() {
    for (const p of this.live) {
      p.o.setVisible(false).setActive(false);
      this.free.push(p.o);
    }
    this.live.length = 0;
    this.timer = 0;
  }

  private spawn(x: number, y: number, depth: number, k: number, cfg: typeof SMOKE.normal, spark: boolean) {
    // pool lleno: las chispas no roban sitio; el humo recicla el puff más viejo
    const o = this.free.pop() ?? (spark ? undefined : this.live.shift()?.o);
    if (!o) return;
    const R = Phaser.Math.FloatBetween;
    const life = spark ? R(0.25, 0.45) : R(cfg.life[0], cfg.life[1]);
    const size = (spark ? R(10, 16) : R(cfg.size[0], cfg.size[1])) * k; // diámetro en px
    const color = spark ? Phaser.Utils.Array.GetRandom([0xffd23f, 0xffb020, 0xfff1b8]) : Phaser.Utils.Array.GetRandom(cfg.colors);
    o.setTexture(spark ? SPARK_TEX : TEX)
      .setTint(color)
      .setPosition(x + R(-5, 5) * k, y + R(-4, 4) * k)
      .setDepth(depth)
      .setBlendMode(spark ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL)
      .setRotation(R(0, Math.PI * 2))
      .setVisible(true)
      .setActive(true);
    const s0 = size / o.width;
    const a0 = spark ? 1 : cfg.alpha * R(0.85, 1.1);
    o.setScale(s0).setAlpha(spark ? a0 : 0);
    const vx = spark ? R(-110, 110) : R(-14, 14);
    const vy = spark ? R(-110, 30) : -(SMOKE.rise / life) * R(0.6, 1.2);
    this.live.push({ o, age: 0, life, a0, s0, vx, vy, spin: R(-1.5, 1.5), spark });
  }
}
