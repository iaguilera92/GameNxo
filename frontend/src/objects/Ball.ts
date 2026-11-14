import Phaser from 'phaser';
import { ALLEY, BOUNCE_DAMP, COURT, GRAVITY, HIT_MAX_Z, NET_HEIGHT, NET_OVERHANG, NET_X } from '../config';
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
  /** gravedad propia de ESTE vuelo (el GLOBO DISPARADO sube mucho más alto en el mismo tiempo); por defecto GRAVITY. Vuelve a la normal al botar */
  g?: number;
}

export type BallEvent = 'bounce' | 'net' | null;

/** Avanza la física de una pelota (también se usa para predicción). */
export function stepBall(s: BallState, dt: number): BallEvent {
  const prevX = s.x;
  const prevY = s.y;
  const prevZ = s.z;
  const vy0 = s.vy;
  const vz0 = s.vz;
  const ay = s.ay ?? 0;
  const G = s.g ?? GRAVITY;
  // parábola exacta en cada paso: la pelota sigue la misma trayectoria a cualquier FPS (la que calcula aimShot). Antes
  // (z con la velocidad del principio del paso) a FPS bajos volaba más y botaba más lejos de donde se apuntó.
  s.x += s.vx * dt;
  s.y += vy0 * dt + 0.5 * ay * dt * dt;
  s.z += vz0 * dt - 0.5 * G * dt * dt;
  s.vz -= G * dt;
  if (ay) s.vy += ay * dt;

  // ¿Cruza la red por debajo de su altura?
  const crossed = (prevX - NET_X) * (s.x - NET_X) < 0;
  if (crossed && s.y > COURT.top - ALLEY - NET_OVERHANG && s.y < COURT.bottom + ALLEY + NET_OVERHANG && s.z < NET_HEIGHT) {
    s.x = NET_X - Math.sign(s.vx) * 6;
    s.vx = -s.vx * 0.15;
    s.vy *= 0.3;
    return 'net';
  }

  if (s.z <= 0 && s.vz < 0) {
    // el bote es donde z llegó a 0, no al final del paso: con pasos largos (FPS bajos) la pelota ya iba hasta 25
    // unidades más allá y un saque que tocaba la línea se cantaba falta. Rodando (ya en el suelo) no se retrocede.
    if (prevZ > 0) {
      // instante exacto del bote dentro del paso: prevZ + vz0·t − ½·g·t² = 0
      const t = Math.min(dt, (vz0 + Math.sqrt(vz0 * vz0 + 2 * G * prevZ)) / G);
      s.x = prevX + s.vx * t;
      s.y = prevY + vy0 * t + 0.5 * ay * t * t;
      s.vz = vz0 - G * t;
      s.vy = vy0 + ay * t;
    }
    s.z = 0;
    // tras un vuelo con gravedad propia (globo disparado) el bote es el de un globo normal: la velocidad de caída se reescala
    s.vz = -s.vz * (s.damp ?? BOUNCE_DAMP) * (s.g ? GRAVITY / s.g : 1);
    s.g = undefined;
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
/**
 * `maxStretch`: cuánto puede alargarse el vuelo (× el tiempo base) para pasar la red. Sin tope, un golpe desde muy abajo
 * acababa en un globo gigante; con tope (p. ej. el SAQUE), si no alcanza a pasar se va a la red, como en el tenis real.
 */
export function aimShot(from: BallState, tx: number, ty: number, speed: number, netMargin = 18, maxStretch = Infinity): void {
  const dx = tx - from.x;
  const dy = ty - from.y;
  const dist = Math.hypot(dx, dy);
  let T = Math.max(0.35, dist / speed);
  const tMax = T * maxStretch;
  for (let i = 0; i < 25 && T * 1.08 <= tMax; i++) {
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
  from.g = undefined;
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
  normal: 0xffffff, // sin uso: el golpe normal no deja estela salvo con un estilo equipado (Ball.update)
  drop: 0xffffff, // corta: blanca (la única con estela blanca)
  lob: 0xffd23f, // globo: amarillo (jugador y rival)
  side: 0x6ec1ff, // cruzada izquierda/derecha: azul suave
  power: 0xff7a1e, // smash: naranja
};

/** Color base del fieltro (amarillo verdoso de pelota de tenis). */
const BALL_FELT = 0xd7f53a;
export const BALL_FELT_KEY = 'ball-felt';
export const BALL_SHADE_KEY = 'ball-shade';

/**
 * Arte de la pelota, dibujado una vez por código (canvas 64 x 64):
 *   ball-felt   fieltro: degradado amarillo verdoso + pelusa + las dos costuras blancas curvas (gira en el render)
 *   ball-shade  volumen fijo encima: brillo arriba a la izquierda y sombra abajo a la derecha
 */
export function makeBallArt(scene: Phaser.Scene) {
  const N = 64;
  const R = N / 2;
  if (!scene.textures.exists(BALL_FELT_KEY)) {
    const t = scene.textures.createCanvas(BALL_FELT_KEY, N, N);
    if (t) {
      const ctx = t.getContext();
      ctx.save();
      ctx.beginPath();
      ctx.arc(R, R, R, 0, Math.PI * 2);
      ctx.clip();
      const g = ctx.createRadialGradient(R * 0.8, R * 0.75, 2, R, R, R);
      g.addColorStop(0, '#eefe7a');
      g.addColorStop(0.55, '#d7f53a');
      g.addColorStop(1, '#a9c91e');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, N, N);
      // pelusa del fieltro: puntitos claros y oscuros
      for (let i = 0; i < 260; i++) {
        ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,200,0.22)' : 'rgba(90,110,0,0.16)';
        ctx.fillRect(Math.random() * N, Math.random() * N, 1.4, 1.4);
      }
      // costuras: dos curvas en "S" opuestas, como una pelota real
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = 4.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(R * 0.18, -2);
      ctx.bezierCurveTo(R * 0.95, R * 0.55, R * 0.95, R * 1.45, R * 0.18, N + 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(N - R * 0.18, -2);
      ctx.bezierCurveTo(N - R * 0.95, R * 0.55, N - R * 0.95, R * 1.45, N - R * 0.18, N + 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(120,140,20,0.35)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(R * 0.18 + 3, -2);
      ctx.bezierCurveTo(R * 0.95 + 3, R * 0.55, R * 0.95 + 3, R * 1.45, R * 0.18 + 3, N + 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(N - R * 0.18 - 3, -2);
      ctx.bezierCurveTo(N - R * 0.95 - 3, R * 0.55, N - R * 0.95 - 3, R * 1.45, N - R * 0.18 - 3, N + 2);
      ctx.stroke();
      ctx.restore();
      t.refresh();
    }
  }
  if (!scene.textures.exists(BALL_SHADE_KEY)) {
    const t = scene.textures.createCanvas(BALL_SHADE_KEY, N, N);
    if (t) {
      const ctx = t.getContext();
      ctx.save();
      ctx.beginPath();
      ctx.arc(R, R, R, 0, Math.PI * 2);
      ctx.clip();
      // sombra: borde inferior derecho más oscuro (volumen)
      const sh = ctx.createRadialGradient(R * 0.7, R * 0.6, R * 0.3, R, R, R * 1.05);
      sh.addColorStop(0, 'rgba(0,0,0,0)');
      sh.addColorStop(0.7, 'rgba(20,40,0,0.10)');
      sh.addColorStop(1, 'rgba(20,40,0,0.45)');
      ctx.fillStyle = sh;
      ctx.fillRect(0, 0, N, N);
      // brillo especular arriba a la izquierda
      const hi = ctx.createRadialGradient(R * 0.62, R * 0.55, 0, R * 0.62, R * 0.55, R * 0.5);
      hi.addColorStop(0, 'rgba(255,255,255,0.85)');
      hi.addColorStop(0.45, 'rgba(255,255,255,0.25)');
      hi.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hi;
      ctx.fillRect(0, 0, N, N);
      ctx.restore();
      t.refresh();
    }
  }
}

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
  /** giro extra del fieltro (rad/s) aunque la pelota esté quieta (DUELO RED: la pelota del aro gira en el sitio) */
  spinExtra = 0;

  constructor(private scn: Phaser.Scene) {
    this.shadow = scn.add.ellipse(0, 0, 30, 12, 0x000000, 0.5);
    this.guide = scn.add.graphics();
    this.trail = scn.add.graphics();
    this.sprite = scn.add.container(0, 0);
    makeBallArt(scn);
    const outline = scn.add.circle(0, 0, 12, C.outline);
    // núcleo de color: solo se ve con la pelota prendida (SMASH: fuego / hielo); normal = el fieltro
    this.core = scn.add.circle(0, 0, 9.6, BALL_FELT).setVisible(false);
    // pelota de tenis: fieltro con costuras que GIRA (render) + sombreado de volumen fijo encima
    this.felt = scn.add.image(0, 0, BALL_FELT_KEY).setDisplaySize(19.6, 19.6);
    const shade = scn.add.image(0, 0, BALL_SHADE_KEY).setDisplaySize(19.6, 19.6);
    // GOLPE CARGADO AL MÁXIMO: halo y brillo encima + rayos alrededor (ocultos salvo en ese golpe)
    // halo exterior amplio y suave + halo interior intenso (más brillo); el brillo de encima casi blanco
    this.maxGlow = scn.add.circle(0, 0, 26, 0xfff0a0, 0.28).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.maxHalo = scn.add.circle(0, 0, 17, 0xfff6b8, 0.7).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.maxShine = scn.add.circle(0, 0, 9.8, 0xffffff, 0.7).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.maxBolts = scn.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.sprite.add([this.maxGlow, this.maxHalo, outline, this.felt, this.core, shade, this.maxShine, this.maxBolts]);
  }
  /** golpe cargado al máximo en vuelo: pelota brillante con rayos y SIN estela (hasta el siguiente golpe) */
  private max = false;
  private maxGlow: Phaser.GameObjects.Arc;
  private maxHalo: Phaser.GameObjects.Arc;
  private maxShine: Phaser.GameObjects.Arc;
  private maxBolts: Phaser.GameObjects.Graphics;
  private maxBoltT = 0;

  /**
   * Golpe cargado al máximo: la pelota (mismo tamaño) brilla, late y suelta rayos eléctricos, sin estela. Se apaga sola
   * con el siguiente golpe (setKind). Llamar DESPUÉS de setKind.
   */
  setMaxCharge(on: boolean) {
    this.max = on;
    this.maxGlow.setVisible(on);
    this.maxHalo.setVisible(on);
    this.maxShine.setVisible(on);
    this.maxBolts.setVisible(on).clear();
    if (on) {
      this.history = [];
      this.trail.clear();
    }
  }

  /** Rayos: 3-4 zigzags cortos que salen del borde de la pelota; se redibujan a saltos (parpadeo eléctrico). */
  private drawBolts() {
    const g = this.maxBolts.clear();
    const n = Phaser.Math.Between(3, 4);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r0 = 11;
      const r1 = Phaser.Math.FloatBetween(19, 26);
      const pts: { x: number; y: number }[] = [];
      const steps = 3;
      for (let k = 0; k <= steps; k++) {
        const r = r0 + ((r1 - r0) * k) / steps;
        const j = k === 0 || k === steps ? 0 : Phaser.Math.FloatBetween(-0.35, 0.35);
        pts.push({ x: Math.cos(a + j) * r, y: Math.sin(a + j) * r });
      }
      g.lineStyle(3.2, 0xfff6b0, 0.55).strokePoints(pts, false);
      g.lineStyle(1.4, 0xffffff, 1).strokePoints(pts, false);
    }
  }
  /** fieltro de la pelota (gira con la velocidad) */
  private felt: Phaser.GameObjects.Image;
  /** aplastamiento al botar (1 = recién botó, baja a 0) y vz del cuadro anterior para detectar el bote */
  private squash = 0;
  private prevVz = 0;

  /** Pinta la pelota: normal = fieltro con costuras; prendida = núcleo del color de su poder. */
  private paintCore() {
    const lit = this.fire > 0;
    this.core.setVisible(lit);
    this.felt.setVisible(!lit);
    if (lit) this.core.fillColor = SMASH_LOOK[this.el].ball.core;
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
    if (this.max) this.setMaxCharge(false); // cada golpe nuevo apaga el brillo del cargado al máximo
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
    this.paintCore();
  }

  /** Enciende (o apaga) el fuego de "smash armado" sin que sea todavía un golpe potente. */
  setIgnited(on: boolean) {
    if (this.fire === 2) return;
    this.fire = on ? 1 : 0;
    this.paintCore();
  }

  /**
   * Poder del SMASH que lleva la pelota (fuego, hielo, viento o rayo, domain/smashPowers.ts): color del núcleo, de la estela y de las
   * partículas. Llamar antes de `setIgnited` / `setPower`; si ya está prendida se repinta al momento.
   */
  setElement(el: SmashPower) {
    this.el = el;
    if (this.fire) this.paintCore();
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
    // bote: se aplasta un instante contra el suelo y recupera la forma
    if (this.prevVz < -60 && this.s.vz > 0 && this.s.z < 6) this.squash = Math.min(1, -this.prevVz / 500);
    this.prevVz = this.s.vz;
    this.squash = Math.max(0, this.squash - dt * 9);
    const sq = this.squash * 0.28;
    this.sprite.setScale(scale * (1 + sq), scale * (1 - sq));
    // efecto: el fieltro gira según la velocidad (y el sentido) de la pelota
    const v = Math.hypot(this.s.vx, this.s.vy, this.s.vz);
    this.felt.rotation += (Math.sign(this.s.vx || 1) * Math.min(v, 1600) * dt) / 70 + this.spinExtra * dt;
    this.sprite.setDepth(ground.sy + 2);
    this.shadow.setDepth(1);
    this.trail.setDepth(ground.sy + 1);
    this.guide.setDepth(2);

    // guía vertical suave pelota -> sombra (ayuda a leer la altura)
    this.guide.clear();
    if (z > 12) this.guide.lineStyle(2 * ground.s, 0xffffff, Math.min(0.28, z / 500)).lineBetween(ground.sx, ground.sy, air.sx, sy);

    // golpe cargado al máximo: la pelota late con su brillo y los rayos parpadean; sin estela, salvo el GLOBO DISPARADO
    // (globo cargado al máximo, 13-11-2026), que conserva su estela amarilla de globo
    if (this.max && !this.power && !this.quietFx) {
      if (this.kind !== 'lob') {
        this.history = [];
        this.trail.clear();
      }
      const pulse = 0.5 + 0.5 * Math.sin(this.scn.time.now / 55);
      this.maxGlow.setScale(1 + pulse * 0.3).setAlpha(0.18 + pulse * 0.22);
      this.maxHalo.setScale(1 + pulse * 0.22).setAlpha(0.55 + pulse * 0.4);
      this.maxShine.setAlpha(0.55 + pulse * 0.35);
      this.maxBoltT -= dt;
      if (this.maxBoltT <= 0) {
        this.maxBoltT = Phaser.Math.FloatBetween(0.05, 0.09);
        this.drawBolts();
      }
      if (this.kind !== 'lob') return;
    }
    // efecto propio encima (bola de fuego de INFERNO DRIVE): sin estela ni chispas de fuego
    if (this.quietFx) {
      this.history = [];
      this.trail.clear();
      return;
    }
    // estela tipo "viento": cinta cónica del color del golpe
    this.boost = Math.max(0, this.boost - dt * 1.3);
    const styled = this.look && (this.kind === 'normal' || this.kind === 'side') ? this.look.trail : null;
    // golpe NORMAL sin estilo equipado: sin estela (el efecto de pelota se asignará en PERSONALIZACIÓN)
    if (!this.power && this.kind === 'normal' && !this.look) {
      this.history = [];
      this.trail.clear();
      return;
    }
    // globo y cortita conservan SIEMPRE su color (el refuerzo del golpe solo ensancha la estela, no la tiñe)
    const fixed = !this.power && (this.kind === 'lob' || this.kind === 'drop');
    const col = fixed ? TRAIL_COLOR[this.kind] : this.boost > 0.2 ? this.boostColor : this.power ? SMASH_LOOK[this.el].ball.trail : styled ?? TRAIL_COLOR[this.kind];
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





