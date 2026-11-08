import { commit, getPlayer } from '../domain/playerStore';
import { gameClock } from '../domain/timeSource';
import * as wheel from '../domain/dailyWheel';
import type { WheelReward } from '../domain/wheelState';
import type { WheelSlot } from '../domain/wheelConfig';

/**
 * Fachada de las ruletas diarias para las escenas: aplica las operaciones puras de
 * domain/dailyWheel.ts con la hora del juego (timeSource) y guarda con playerStore (un solo
 * guardado por operación → premio y "reclamado" se guardan juntos).
 */

const now = () => gameClock.now();

/** Pone el ciclo al día (y lo guarda si cambió). */
export function syncWheels() {
  const before = getPlayer();
  const after = wheel.syncCycle(before as never, now());
  if (after !== before) commit(() => ({ ok: true as const, state: after }));
}

/** Registra una victoria válida. Devuelve el índice de ruleta desbloqueada (o null). */
export function recordMatchWin(matchId: string): number | null {
  const res = commit((s) => wheel.recordWin(s, matchId, now()));
  return res.ok ? res.unlocked : null;
}

export function wheelStatuses() {
  return wheel.wheelStatuses(getPlayer() as never, now());
}

/** Ruleta recién desbloqueada que aún no se abrió sola (o -1). */
export function wheelToPresent() {
  return wheel.nextToPresent(getPlayer() as never, now());
}

export function markWheelPresented(index: number) {
  commit((s) => wheel.markPresented(s, index, now()));
}

/** Decide (o recupera) el resultado del giro. */
export function spinWheel(index: number): { slot: WheelSlot; reward: WheelReward; repeated: boolean } | null {
  const res = commit((s) => wheel.spin(s, index, now()));
  return res.ok ? { slot: res.slot, reward: res.reward, repeated: res.repeated } : null;
}

/** Cobra el premio (idempotente). `given` = lo entregado (null si ya estaba cobrado). */
export function claimWheel(index: number): { given: WheelReward | null; already: boolean } | null {
  const res = commit((s) => wheel.claim(s, index, now()));
  return res.ok ? { given: res.given, already: res.already } : null;
}

/** Giro guardado de la ruleta `index` del ciclo actual (si existe). */
export function wheelSpin(index: number) {
  return wheel.syncCycle(getPlayer() as never, now()).wheel.spins[index] ?? null;
}

export function msToWheelReset() {
  return wheel.msToNextReset(now());
}
