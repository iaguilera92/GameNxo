import Phaser from 'phaser';
import { ALLEY, BOUNCE_DAMP, COURT, GRAVITY, HIT_MAX_Z, NET_HEIGHT, NET_X } from '../config';
import { C } from '../ui/theme';
import { project } from '../view/projection';
import type { SmashPower } from '../domain/smashPowers';
import { SMASH_LOOK } from '../fx/smashFx';

export interface BallState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** rebote propio de este golpe (p.ej. cortita cargada); por defecto BOUNCE_DAMP */
  damp?: number;
  /** frenado horizontal al botar; por defecto 0.88 */
  fric?: number;
  /** aceleración lateral (saque con efecto): curva en el aire y 'patada' al botar */
  ay?: number;
}

export type BallEvent = 'bounce' | 'net' | null;

/** Avanza la física de una pelota (también se usa para predicción). */
export function stepBall(s: BallState, dt: number): BallEvent {
  const prevX = s.x;
  s.x += s.vx * dt;
  s.y += s.vy * dt;
  s.z += s.vz * dt;
  s.vz -= GRAVITY * dt;
  if (s.ay) s.vy += s.ay * dt;

  // ¿Cruza la red por debajo de su altura?
  const crossed = (prevX - NET_X) * (s.x - NET_X) < 0;
  if (crossed && s.y > COURT.top - ALLEY - 6 && s.y < COURT.bottom + ALLEY + 6 && s.z < NET_HEIGHT) {
    s.x = NET_X - Math.sign(s.vx) * 6;
    s.vx = -s.vx * 0.15;
    s.vy *= 0.3;
    return 'net';
  }

  if (s.z <= 0 && s.vz < 0) {
    s.z = 0;
    s.vz = -s.vz * (s.damp ?? BOUNCE_DAMP);
    if (s.ay) {
      // el efecto se transforma en un bote abierto hacia el lado
      s.vy += s.ay * 0.35;
      s.ay = undefined;
    }
    const f = s.fric ?? 0.88;
    s.vx *= f;
    s.vy *= f;
    if (s.vz < 40) s.vz = 0;
    return 'bounce';
  }
  return null;
}

/**
 * Calcula la velocidad de salida para que la pelota, saliendo de `from`,
 * bote en `target`, a una velocidad horizontal aproximada `speed`,
 * garantizando que pase la red con un margen.
 */
export function aimShot(from: BallState, tx: number, ty: number, speed: number, netMargin = 18): void {
  const dx = tx - from.x;
  const dy = ty - from.y;
  const dist = Math.hypot(dx, dy);
  let T = Math.max(0.35, dist / speed);
  for (let i = 0; i < 25; i++) {
    const vx = dx / T;
    const vz = (0.5 * GRAVITY * T * T - from.z) / T;
    const tn = (NET_X - from.x) / vx;
    const zn = from.z + vz * tn - 0.5 * GRAVITY * tn * tn;
    if (tn <= 0 || tn >= T || zn > NET_HEIGHT + netMargin) break;
    T *= 1.08;
  }
  // cada golpe nuevo vuelve al bote normal
  from.damp = undefined;
  from.fric = undefined;
  from.ay = undefined;
  from.vx = dx / T;
  from.vy = dy / T;
  from.vz = (0.5 * GRAVITY * T * T - from.z) / T;
}

export function isInCourt(x: number, y: number) {
  return x >= COURT.left && x <= COURT.right && y >= COURT.top && y <= COURT.bottom;
}

/**
 * Busca un punto cómodo de golpeo en el lado `side` ('near' = jugador, x < red),
 * al menos `minT` segundos en el futuro. Preferencia: tras el primer bote.
 * Devuelve null si la pelota no llegará a ese lado.
 */
export function predictIntercept(b: BallState, side: 'near' | 'far', alreadyBounced: boolean, minT = 0.3): { x: number; y: number } | null {
  const s = { ...b };
  const onSide = () => (side === 'near' ? s.x < NET_X - 30 : s.x > NET_X + 30);
  let bounces = alreadyBounced ? 1 : 0;
  let fallback: { x: number; y: number } | null = null;
  const dt = 1 / 120;
  for (let t = 0; t < 4; t += dt) {
    const ev = stepBall(s, dt);
    if (ev === 'net') return null;
    if (ev === 'bounce') bounces++;
    if (bounces >= 2) break;
    if (t < minT || !onSide()) continue;
    if (bounces >= 1 && s.z < HIT_MAX_Z * 0.7) return { x: s.x, y: s.y };
    if (!fallback && s.z < HIT_MAX_Z * 0.8) fallback = { x: s.x, y: s.y };
  }
  return fallback;
}

/** Tipo de golpe: define el color de la estela. */
export type ShotKind = 'normal' | 'drop' | 'lob' | 'side' | 'power';
const TRAIL_COLOR: Record<ShotKind, number> = {
  normal: 0xffffff,
  drop: 0x9aa0ad, // corta: gris
  lob: 0xffd23f, // globo: amarillo
  side: 0x6ec1ff, // cruzada izquierda/derecha: azul suave
  power: 0xff7a1e, // smash: naranja
};

/** Pelota visual: sprite + sombra + estela + fuego. */
export class Ball {
  readonly s: BallState = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 };
  readonly shadow: Phaser.GameObjects.Ellipse;
  readonly sprite: Phaser.GameObjects.Container;
  private trail: Phaser.GameObjects.Graphics;
  private history: { x: number; y: number; col: number }[] = [];
  private guide: Phaser.GameObjects.Graphics;
  private kind: ShotKind = 'normal';
  /** golpe cargado: estela más ancha e intensa */
  private charged = false;
  private core: Phaser.GameObjects.Arc;
  /** golpe potente en vuelo (bola de fuego) */
  power = false;
  /** 0 = sin fuego, 1 = encendida (smash armado), 2 = bola de fuego */
  private fire = 0;
  private fireTimer = 0;
  /** estela reforzada tras un golpe potente: 0..1, se apaga sola */
  private boost = 0;
  private boostColor = 0xffffff;
  /** true = sin estela ni partículas de fuego propias (otro efecto dibuja la pelota, p. ej. INFERNO DRIVE) */
  quietFx = false;

  constructor(private scn: Phaser.Scene) {
    this.shadow = scn.add.ellipse(0, 0, 30, 12, 0x000000, 0.5);
    this.guide = scn.add.graphics();
    this.trail = scn.add.graphics();
    this.sprite = scn.add.container(0, 0);
    const outline = scn.add.circle(0, 0, 12, C.outline);
    this.core = scn.add.circle(0, 0, 9, 0xd7f53a);
    const shine = scn.add.circle(-3, -3, 3.2, 0xffffff, 0.75);
    this.sprite.add([outline, this.core, shine]);
  }

  /** Intención del último golpe ('lob' = globo, etc.). Solo lectura. */
  get shotKind(): ShotKind {
    return this.kind;
  }

  /**
   * Cambia el color de la estela según el tipo de golpe. `look`: estilo equipado del jugador (solo en
   * sus golpes): tiñe la estela de los golpes normales y añade chispas si el estilo las tiene.
   */
  setKind(k: ShotKind, charged = false, look?: { trail: number; sparkle: boolean }) {
    this.kind = k;
    this.charged = charged;
    this.look = look ?? null;
  }
  private look: { trail: number; sparkle: boolean } | null = null;
  private sparkTimer = 0;

  /** Refuerza la estela (más ancha y de color) tras un golpe potente; decae en menos de un segundo. */
  setImpactTrail(boost: number, color: number) {
    this.boost = boost;
    this.boostColor = color;
  }

  setPower(p: boolean) {
    this.power = p;
    if (p) this.fire = 2;
    else if (this.fire === 2) this.fire = 0;
    this.core.fillColor = this.fire ? SMASH_LOOK[this.el].ball.core : 0xd7f53a;
  }

  /** Enciende (o apaga) el fuego de "smash armado" sin que sea todavía un golpe potente. */
  setIgnited(on: boolean) {
    if (this.fire === 2) return;
    this.fire = on ? 1 : 0;
    this.core.fillColor = on ? SMASH_LOOK[this.el].ball.core : 0xd7f53a;
  }

  /**
   * Poder del SMASH que lleva la pelota (fuego o hielo, domain/smashPowers.ts): color del núcleo, de la estela y de las
   * partículas. Llamar antes de `setIgnited` / `setPower`; si ya está prendida se repinta al momento.
   */
  setElement(el: SmashPower) {
    this.el = el;
    if (this.fire) this.core.fillColor = SMASH_LOOK[el].ball.core;
  }
  private el: SmashPower = 'fire';

  /**
   * Sincroniza lo que se VE con el sprite: la física del golpe es inmediata, pero la raqueta dibujada llega a su
   * fotograma de impacto `ms` después. Durante ese tiempo la pelota se dibuja en el punto de contacto y se suelta
   * hasta alcanzar a la real (la trayectoria, la puntuación y las colisiones no cambian). Las bolas de fuego se
   * quedan como están (sus llamas se dibujan en la posición real).
   */
  holdVisual(ms: number) {
    if (this.power || ms < 20) return;
    this.lag = { x: this.s.x, y: this.s.y, z: this.s.z, t0: this.scn.time.now, ms: Math.min(ms, 200) };
  }
  private lag?: { x: number; y: number; z: number; t0: number; ms: number };

  render(dt = 1 / 60) {
    let { x, y, z } = this.s;
    if (this.lag) {
      const q = (this.scn.time.now - this.lag.t0) / this.lag.ms;
      if (q >= 1 || this.power) this.lag = undefined;
      else {
        const L = this.lag;
        x = L.x + (x - L.x) * q;
        y = L.y + (y - L.y) * q;
        z = L.z + (z - L.z) * q;
      }
    }
    const ground = project(x, y, 0);
    const air = project(x, y, z);
    const k = Math.max(0.5, 1 - z / 320);
    this.shadow.setPosition(ground.sx, ground.sy).setScale(k * ground.s * 0.95).setAlpha(0.55 * k + 0.1);
    const sy = air.sy;
    const scale = air.s * 0.8 * (1 + Math.min(z, 220) / 700);
    this.sprite.setPosition(air.sx, sy);
    this.sprite.setScale(scale);
    this.sprite.setDepth(ground.sy + 2);
    this.shadow.setDepth(1);
    this.trail.setDepth(ground.sy + 1);
    this.guide.setDepth(2);

    // guía vertical suave pelota -> sombra (ayuda a leer la altura)
    this.guide.clear();
    if (z > 12) this.guide.lineStyle(2 * ground.s, 0xffffff, Math.min(0.28, z / 500)).lineBetween(ground.sx, ground.sy, air.sx, sy);

    // efecto propio encima (bola de fuego de INFERNO DRIVE): sin estela ni chispas de fuego
    if (this.quietFx) {
      this.history = [];
      this.trail.clear();
      return;
    }
    // estela tipo "viento": cinta cónica del color del golpe
    this.boost = Math.max(0, this.boost - dt * 1.3);
    const styled = this.look && (this.kind === 'normal' || this.kind === 'side') ? this.look.trail : null;
    const col = this.boost > 0.2 ? this.boostColor : this.power ? SMASH_LOOK[this.el].ball.trail : styled ?? TRAIL_COLOR[this.kind];
    if (this.look?.sparkle && !this.power && this.sprite.visible) this.emitSparks(dt, air.sx, sy, scale, ground.sy);
    this.history.push({ x: air.sx, y: sy, col });
    if (this.history.length > 20) this.history.shift();
    this.trail.clear();
    const n = this.history.length;
    for (let i = 1; i < n; i++) {
      const a = this.history[i - 1];
      const b = this.history[i];
      const t = i / n;
      const w = (3 + t * 16) * scale * (this.charged ? 1.6 : 1) * (1 + 0.7 * this.boost);
      const alpha = Math.min(1, t * (this.charged ? 0.85 : 0.6) * (1 + 0.5 * this.boost));
      this.trail.lineStyle(w, b.col, alpha).lineBetween(a.x, a.y, b.x, b.y);
      this.trail.fillStyle(b.col, alpha).fillCircle(b.x, b.y, w / 2);
    }
    if (this.fire && this.sprite.visible) this.emitFire(dt, air.sx, sy, scale, ground.sy);
  }

  /** Chispas del estilo Oro: estrellitas que se quedan atrás en la estela. */
  private emitSparks(dt: number, x: number, y: number, scale: number, depth: number) {
    this.sparkTimer -= dt;
    if (this.sparkTimer > 0) return;
    this.sparkTimer = 0.05;
    const st = this.scn.add
      .star(x + Phaser.Math.FloatBetween(-8, 8) * scale, y + Phaser.Math.FloatBetween(-6, 6) * scale, 4, 2 * scale, 6 * scale, Phaser.Math.RND.pick([0xfff1b8, 0xffd23f, 0xffffff]))
      .setDepth(depth + 1)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.scn.tweens.add({ targets: st, angle: 180, scale: 0.1, alpha: 0, y: st.y + Phaser.Math.FloatBetween(4, 14) * scale, duration: Phaser.Math.Between(260, 420), onComplete: () => st.destroy() });
  }

  /** Partículas de fuego (llamas que suben y se apagan). */
  private emitFire(dt: number, x: number, y: number, scale: number, depth: number) {
    this.fireTimer -= dt;
    if (this.fireTimer > 0) return;
    const big = this.fire === 2;
    this.fireTimer = big ? 0.04 : 0.07;
    const n = big ? 2 : 1;
    // fuego: llamas que suben; hielo: cristales y copos que se quedan atrás y caen despacio (SMASH_LOOK)
    const L = SMASH_LOOK[this.el].ball;
    for (let i = 0; i < n; i++) {
      const r = (big ? Phaser.Math.FloatBetween(8, 15) : Phaser.Math.FloatBetween(5, 9)) * scale;
      const px = x + Phaser.Math.FloatBetween(-6, 6) * scale;
      const py = y + Phaser.Math.FloatBetween(-4, 4) * scale;
      const col = Phaser.Utils.Array.GetRandom(L.flames);
      const f = L.shards ? this.scn.add.star(px, py, 4, r * 0.28, r * 0.85, col, 0.95) : this.scn.add.circle(px, py, r, col, 0.9);
      f.setDepth(depth + (Math.random() < 0.5 ? 1 : 3)).setBlendMode(Phaser.BlendModes.ADD);
      this.scn.tweens.add({
        targets: f,
        y: f.y - Phaser.Math.FloatBetween(14, big ? 40 : 24) * scale * L.rise,
        x: f.x + Phaser.Math.FloatBetween(-8, 8) * scale,
        scale: 0.2,
        alpha: 0,
        ...(L.shards ? { angle: Phaser.Math.Between(-140, 140) } : {}),
        duration: Phaser.Math.Between(big ? 260 : 200, big ? 420 : 320) * (L.shards ? 1.25 : 1),
        onComplete: () => f.destroy(),
      });
    }
  }

  clearTrail() {
    this.history = [];
    this.trail.clear();
    this.guide.clear();
    this.kind = 'normal';
    this.charged = false;
    this.boost = 0;
  }

  setVisible(v: boolean) {
    this.sprite.setVisible(v);
    this.shadow.setVisible(v);
    this.trail.setVisible(v);
    this.guide.setVisible(v);
  }
}





