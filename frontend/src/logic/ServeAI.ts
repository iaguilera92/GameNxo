import { BOT_SERVE, SERVE } from '../config';
import { type ServeKind, perfectWindow } from './ServeController';

/** Decisiones del rival al sacar. Se ejecutan con las mismas pulsaciones y física que el jugador. */
export interface BotServePlan {
  kind: ServeKind;
  /** destino lateral dentro del cuadro: 0 = un borde, 1 = el otro */
  aimT: number;
  /** espera inicial antes de lanzar (s) */
  wait: number;
  /** instante (s desde el lanzamiento) en que pulsa el golpe */
  pressAt: number;
  /** pretende un saque perfecto */
  goesPerfect: boolean;
}

const ZONES = [0.14, 0.5, 0.86];

export class ServeAI {
  private lastZone = -1;

  /**
   * @param faults 0 = primer saque, 1 = segundo saque
   * @param skill 0..1 (dificultad del bot)
   */
  plan(faults: number, skill: number): BotServePlan {
    const second = faults > 0 ? 1 : 0;
    const kind: ServeKind = Math.random() < BOT_SERVE.spinChance[second] ? 'spin' : 'normal';
    const goesPerfect = Math.random() < BOT_SERVE.perfectChance[second] + 0.2 * skill;

    // zona del cuadro: distinta a la anterior casi siempre, con pequeña variación
    let z = Math.floor(Math.random() * ZONES.length);
    if (z === this.lastZone && Math.random() < 0.75) z = (z + 1 + Math.floor(Math.random() * 2)) % ZONES.length;
    this.lastZone = z;
    const aimT = Math.min(0.92, Math.max(0.08, ZONES[z] + (Math.random() - 0.5) * 0.12));

    // momento del golpe
    const w = perfectWindow(kind);
    // golpear antes de este instante sería "demasiado pronto" (la pelota aún no sube lo bastante): el rival no lo hace
    const lock = Math.max(SERVE.tossLock + 0.03, 0.24);
    let pressAt: number;
    if (Math.random() < BOT_SERVE.whiffChance[second]) {
      pressAt = 1.25 + Math.random() * 0.1; // tarde: golpea en vacío antes de que la pelota llegue a la mano
    } else if (goesPerfect) {
      pressAt = w.from + (w.to - w.from) * (0.25 + Math.random() * 0.5);
    } else if (Math.random() < 0.5) {
      pressAt = Math.max(lock, w.from - 0.01 - Math.random() * (w.from - lock)); // algo pronto
    } else {
      pressAt = w.to + 0.01 + Math.random() * 0.07; // algo tarde
    }
    return { kind, aimT, wait: BOT_SERVE.waitMin + Math.random() * (BOT_SERVE.waitMax - BOT_SERVE.waitMin), pressAt, goesPerfect };
  }
}
