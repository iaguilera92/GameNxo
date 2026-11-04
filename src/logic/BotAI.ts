import Phaser from 'phaser';
import { BOT_DIFFICULTY, COURT, NET_X, PLAYER_SPEED } from '../config';
import { BallState, stepBall } from '../objects/Ball';

/**
 * IA simple: tras un tiempo de reacción predice dónde podrá golpear la pelota
 * (con un error aleatorio) y se mueve hacia allí con velocidad limitada.
 */
export class BotAI {
  readonly d = Phaser.Math.Clamp(BOT_DIFFICULTY, 0, 1);
  readonly speed = PLAYER_SPEED * (0.62 + 0.45 * this.d);
  private readonly reaction = 0.42 - 0.3 * this.d; // s
  private readonly errorPx = 85 * (1 - this.d) + 12;
  /** Probabilidad de que un golpe del bot salga fuera. */
  readonly outChance = 0.14 * (1 - this.d) + 0.02;
  /** Precisión del golpe: 0 = siempre al centro, 1 = busca las esquinas. */
  readonly aimSkill = 0.35 + 0.55 * this.d;

  target = new Phaser.Math.Vector2(COURT.right + 40, (COURT.top + COURT.bottom) / 2);
  private pending: number | null = null;
  private extraError = 1;

  get home() {
    return new Phaser.Math.Vector2(COURT.right + 40, (COURT.top + COURT.bottom) / 2);
  }

  /** Llamar cuando el jugador golpea la pelota. */
  onPlayerHit(power: boolean) {
    this.pending = this.reaction + (power ? 0.22 : 0) + Math.random() * 0.08;
    this.extraError = power ? 1.6 : 1;
  }

  /** Llamar cuando el bot golpea: vuelve hacia el centro. */
  onBotHit() {
    this.pending = null;
    const h = this.home;
    this.target.set(h.x + Phaser.Math.Between(-20, 20), h.y + Phaser.Math.Between(-40, 40));
  }

  reset(x: number, y: number) {
    this.pending = null;
    this.target.set(x, y);
  }

  update(dt: number, live: BallState) {
    if (this.pending !== null) {
      this.pending -= dt;
      if (this.pending <= 0) {
        this.pending = null;
        this.predict(live);
      }
    }
  }

  /** Simula la pelota para encontrar un punto de golpeo cómodo en su lado. */
  private predict(b: BallState) {
    const s = { ...b };
    let bounces = 0;
    let t = 0;
    let after = 0;
    let found: { x: number; y: number } | null = null;
    const dt = 1 / 120;
    while (t < 4) {
      const ev = stepBall(s, dt);
      t += dt;
      if (ev === 'net') break;
      if (ev === 'bounce') bounces++;
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
    const e = this.errorPx * this.extraError;
    this.target.set(found.x + 18 + Phaser.Math.FloatBetween(-e * 0.5, e * 0.5), found.y + Phaser.Math.FloatBetween(-e, e));
  }
}
