/**
 * REGALO GRATIS de la Tienda (datos puros, sin Phaser): una vez por día (reinicio 23:59 hora de Chile, el mismo ciclo
 * que la ruleta) el jugador recoge unas MONEDAS gratis: casi siempre 5, a veces 10 y menos veces 15.
 * Decisión del usuario (12-11-2026): monedas (no dinero), una vez al día.
 */
import { cycleIdAt, msToNextReset, pickWeighted } from './dailyWheel';
import { addCoins } from './operations';
import { addCoins2v2 } from './coins2v2';
import type { PlayerState } from './player';

export const SHOP_GIFT = {
  /**
   * (21-11-2026, usuario) sorpresa: puede salir MONEDAS (1v1) o MONEDAS 2V2. Cantidad y peso (probabilidad relativa);
   * mitad y mitad entre las dos monedas, con las cantidades de siempre (5, a veces 10 y menos veces 15).
   */
  options: [
    { kind: 'coins', amount: 5, weight: 30 },
    { kind: 'coins', amount: 10, weight: 15 },
    { kind: 'coins', amount: 15, weight: 5 },
    { kind: 'coins2v2', amount: 5, weight: 30 },
    { kind: 'coins2v2', amount: 10, weight: 15 },
    { kind: 'coins2v2', amount: 15, weight: 5 },
  ] as { kind: GiftKind; amount: number; weight: number }[],
};
export type GiftKind = 'coins' | 'coins2v2';

export interface GiftStatus {
  /** se puede recoger ahora */
  available: boolean;
  /** ms hasta el próximo regalo (0 si ya está disponible) */
  nextMs: number;
}

export function giftStatus(s: Readonly<PlayerState>, now: number): GiftStatus {
  const available = s.giftDay !== cycleIdAt(now);
  return { available, nextMs: available ? 0 : msToNextReset(now) };
}

/** Recoge el regalo del día. `rng` en [0, 1). */
export function claimGift(s: PlayerState, now: number, rng: () => number = Math.random): { ok: true; state: PlayerState; amount: number; kind: GiftKind } | { ok: false; error: 'already' } {
  if (!giftStatus(s, now).available) return { ok: false, error: 'already' };
  const pick = pickWeighted(SHOP_GIFT.options, rng);
  let base: PlayerState = s;
  if (pick.kind === 'coins2v2') base = addCoins2v2(s, pick.amount);
  else {
    const res = addCoins(s, pick.amount);
    if (!res.ok) return { ok: false, error: 'already' };
    base = res.state;
  }
  return { ok: true, state: { ...base, giftDay: cycleIdAt(now) }, amount: pick.amount, kind: pick.kind };
}
