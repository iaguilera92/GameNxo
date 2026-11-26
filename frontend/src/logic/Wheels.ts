import { commit, getPlayer } from '../domain/playerStore';
import { gameClock } from '../domain/timeSource';
import * as wheel from '../domain/dailyWheel';
import type { WheelReward, WheelTier } from '../domain/wheelState';
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
export function spinWheel(index: number, bonus = false, forceSlot?: string): { slot: WheelSlot; reward: WheelReward; tier: WheelTier; repeated: boolean } | null {
  const res = commit((s) => wheel.spin(s, index, now(), undefined, bonus, forceSlot));
  return res.ok ? { slot: res.slot, reward: res.reward, tier: res.tier, repeated: res.repeated } : null;
}

/** Un toque más (2.º a 4.º): tira para subir la ruleta de nivel. `reward` y `tier` son los vigentes tras la tirada. */
export function boostWheel(index: number, bonus = false): { reward: WheelReward; tier: WheelTier; upgraded: boolean } | null {
  const res = commit((s) => wheel.boost(s, index, now(), undefined, bonus));
  return res.ok ? { reward: res.reward, tier: res.tier, upgraded: res.upgraded } : null;
}

/** Cobra el premio (idempotente). `given` = lo entregado (null si ya estaba cobrado). */
export function claimWheel(index: number, bonus = false): { given: WheelReward | null; already: boolean } | null {
  const res = commit((s) => wheel.claim(s, index, now(), bonus));
  return res.ok ? { given: res.given, already: res.already } : null;
}

export function claimWheelAdBonus(index: number, bonus = false) {
  const res = commit((s) => wheel.claimAdBonus(s, index, now(), bonus));
  return res.ok ? res.given : null;
}

/** Giro guardado de la ruleta `index` del ciclo actual (si existe). */
export function wheelSpin(index: number, bonus = false) {
  const state = wheel.syncCycle(getPlayer() as never, now()).wheel;
  return (bonus ? state.bonusSpins : state.spins)[index] ?? null;
}

export function grantBattlePassSpin(season: string) {
  const id = `battle-pass:${season}`;
  const res = commit((s) => {
    const current = wheel.syncCycle(s as never, now());
    const granted = wheel.grantBonusSpin(current as never, id);
    return { ok: true as const, state: granted.state, index: granted.index };
  });
  return res.ok ? res.index : -1;
}

/**
 * RULETA TEST (solo desarrollo, como el DÍA TEST del premio diario): un giro extra sin límite para ver cómo sale cada premio
 * y cómo se refleja en la cuenta (monedas, EXP, dinero, cosmético, COFRE en el menú). Los premios SÍ se entregan.
 */
export function grantTestSpin() {
  const res = commit((s) => {
    const current = wheel.syncCycle(s as never, now());
    const granted = wheel.grantBonusSpin(current as never, `test:${now()}`);
    return { ok: true as const, state: granted.state, index: granted.index };
  });
  return res.ok ? res.index : -1;
}

export function battlePassSpinIndex(season: string) {
  return wheel.bonusSpinIndex(getPlayer() as never, `battle-pass:${season}`);
}

/** (25-11-2026, usuario) ruleta del TUTORIAL (una por nivel, fuera del tope diario). Índice del giro bonus (o -1). */
export function grantTutorialSpin(id: string) {
  const res = commit((s) => {
    const current = wheel.syncCycle(s as never, now());
    const granted = wheel.grantBonusSpin(current as never, id);
    return { ok: true as const, state: granted.state, index: granted.index };
  });
  return res.ok ? res.index : -1;
}
/** ruleta del tutorial ganada que aún no se abrió sola (índice de giro bonus, o -1) */
export function tutorialWheelToPresent() {
  return wheel.nextTutorialBonus(getPlayer() as never);
}
export function unclaimedTutorialWheel() {
  return wheel.unclaimedTutorialBonus(getPlayer() as never);
}
export function markTutorialWheelPresented(index: number) {
  commit((s) => wheel.markBonusPresented(s, index));
}

export function msToWheelReset() {
  return wheel.msToNextReset(now());
}
