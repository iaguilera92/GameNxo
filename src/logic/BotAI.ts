import Phaser from 'phaser';
import { BOT_DIFFICULTY, COURT, NET_X, PLAYER_SPEED } from '../config';
import { BallState, stepBall } from '../objects/Ball';

/**
 * Lectura de la pelota por el rival (lo usa src/ai/BotBrain.ts):
 *
 *  1. REACCIÓN: tras tu golpe tarda `reaction` s en empezar a leer la pelota.
 *  2. PERCEPCIÓN CON RUIDO: no ve la velocidad exacta; la estima con un error que depende de su
 *     dificultad. El error se sortea UNA vez por golpe (no tiembla) y se va corrigiendo.
 *  3. RE-PREDICCIÓN: vuelve a predecir cada REPLAN s hasta que la pelota bota; en cada corrección el
 *     error se multiplica por CONVERGE, sin bajar de un mínimo (los rivales débiles conservan más error).
 *
 * La predicción usa la física real (stepBall) sobre la pelota PERCIBIDA. No toca la pelota real.
 */
const REPLAN = 0.15; // s entre correcciones (el factor de corrección depende de la dificultad)

export class BotAI {
  /** Dificultad BASE 0..1 (perfil del rival: src/ai/BotProfile.ts). */
  readonly baseD: number;
  /** Dificultad EFECTIVA 0..1 = base + impulso del modo (NORMAL/CONCENTRADO/COMPETITIVO). */
  d!: number;
  speed!: number;
  private reaction!: number; // s
  private errorPx!: number;
  /** Probabilidad de que un golpe del bot salga fuera. */
  outChance!: number;
  /** Precisión del golpe: 0 = siempre al centro, 1 = busca las esquinas. */
  aimSkill!: number;
  /** ruido relativo con el que estima la velocidad de la pelota (al empezar a leerla) */
  private velNoise!: number;
  /** fracción de error que nunca corrige (más alta cuanto más débil) */
  private errorFloor!: number;
  /** factor de corrección por re-predicción (más cerca de 1 = corrige más lento) */
  private converge!: number;

  constructor(difficulty = BOT_DIFFICULTY) {
    this.baseD = Phaser.Math.Clamp(difficulty, 0, 1);
    this.setBoost(0);
  }

  /**
   * Aplica el impulso temporal del modo de comportamiento sobre la dificultad base
   * (lo llama BotBrain al empezar cada punto). Recalcula todo con las mismas fórmulas.
   */
  setBoost(boost: number) {
    this.d = Phaser.Math.Clamp(this.baseD + boost, 0, 1);
    this.speed = PLAYER_SPEED * (0.62 + 0.45 * this.d);
    this.reaction = 0.42 - 0.3 * this.d;
    this.errorPx = 85 * (1 - this.d) + 12;
    this.outChance = 0.14 * (1 - this.d) + 0.02;
    this.aimSkill = 0.35 + 0.55 * this.d;
    this.velNoise = 0.18 * (1 - this.d) + 0.02;
    this.errorFloor = 0.15 + 0.85 * (1 - this.d) * (1 - this.d);
    this.converge = 0.45 + 0.5 * (1 - this.d);
  }

  target = new Phaser.Math.Vector2(COURT.right + 40, (COURT.top + COURT.bottom) / 2);
  private pending: number | null = null;
  private extraError = 1;
  // lectura del golpe en curso
  private tracking = false;
  private replanIn = 0;
  private errScale = 1;
  /** s que faltan para el primer bote previsto (después ya no corrige) */
  private bounceIn = Infinity;
  /** error de percepción de ESTE golpe (normalizado, se sortea una vez) */
  private noise = { vx: 0, vy: 0, vz: 0, ox: 0, oy: 0 };

  /** ya está leyendo tu golpe (pasó su tiempo de reacción) y persigue el punto previsto */
  get reading() {
    return this.tracking;
  }

  get home() {
    return new Phaser.Math.Vector2(COURT.right + 40, (COURT.top + COURT.bottom) / 2);
  }

  /** Llamar cuando el jugador golpea la pelota. */
  onPlayerHit(power: boolean) {
    this.pending = this.reaction + (power ? 0.22 : 0) + Math.random() * 0.08;
    this.extraError = power ? 1.6 : 1;
    this.tracking = false;
    this.errScale = 1;
    this.bounceIn = Infinity;
    const g = () => Math.random() * 2 - 1;
    this.noise = { vx: g(), vy: g(), vz: g(), ox: g(), oy: g() };
  }

  /**
   * Llamar cuando el bot golpea: vuelve a su posición de espera.
   * `recoverY` (opcional): lateral hacia el que se recoloca (recuperación táctica); sin él, el centro.
   */
  onBotHit(recoverY?: number) {
    this.pending = null;
    this.tracking = false;
    const h = this.home;
    const y = recoverY ?? h.y;
    this.target.set(h.x + Phaser.Math.Between(-20, 20), y + Phaser.Math.Between(-40, 40));
  }

  reset(x: number, y: number) {
    this.pending = null;
    this.tracking = false;
    this.target.set(x, y);
  }

  update(dt: number, live: BallState) {
    if (this.pending !== null) {
      this.pending -= dt;
      if (this.pending <= 0) {
        this.pending = null;
        this.tracking = true;
        this.replanIn = 0;
      }
    }
    if (!this.tracking) return;
    this.bounceIn -= dt;
    if (this.bounceIn <= 0) {
      this.tracking = false; // ya botó: se queda con la última lectura
      return;
    }
    this.replanIn -= dt;
    if (this.replanIn <= 0) {
      this.predict(live);
      this.errScale = Math.max(this.errorFloor, this.errScale * this.converge);
      this.replanIn = REPLAN;
    }
  }

  /** La pelota tal como la percibe el rival ahora (velocidad con el error de este golpe). */
  private perceive(b: BallState): BallState {
    const k = this.velNoise * this.extraError * this.errScale;
    const n = this.noise;
    return { ...b, vx: b.vx * (1 + n.vx * k), vy: b.vy + n.vy * k * 160, vz: b.vz * (1 + n.vz * k * 0.6) };
  }

  /** Simula la pelota percibida para encontrar un punto de golpeo cómodo en su lado. */
  private predict(b: BallState) {
    const s = this.perceive(b);
    let bounces = 0;
    let t = 0;
    let after = 0;
    let firstBounce = Infinity;
    let found: { x: number; y: number } | null = null;
    const dt = 1 / 120;
    while (t < 4) {
      const ev = stepBall(s, dt);
      t += dt;
      if (ev === 'net') break;
      if (ev === 'bounce') {
        bounces++;
        if (bounces === 1) firstBounce = t;
      }
      if (bounces >= 1) after += dt;
      // punto ideal: ~0.3s después del primer bote, o antes si se va muy al fondo
      if (bounces >= 1 && s.x > NET_X + 40 && (after >= 0.3 || s.x > COURT.right + 70)) {
        found = { x: s.x, y: s.y };
        break;
      }
      if (bounces >= 2) {
        found = { x: s.x, y: s.y };
        break;
      }
    }
    if (!found) return;
    this.bounceIn = firstBounce;
    // error de posición de este golpe: fijo en dirección, se encoge con cada corrección
    const e = this.errorPx * this.extraError * this.errScale;
    this.target.set(found.x + 18 + this.noise.ox * e * 0.5, found.y + this.noise.oy * e);
  }
}
