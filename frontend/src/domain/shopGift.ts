/**
 * REGALO GRATIS de la Tienda (datos puros, sin Phaser): una vez por día (reinicio 23:59 hora de Chile, el mismo ciclo
 * que la ruleta) el jugador recoge unas MONEDAS gratis: casi siempre 5, a veces 10 y menos veces 15.
 * Decisión del usuario (12-11-2026): monedas (no dinero), una vez al día.
 */
import { cycleIdAt, msToNextReset, pickWeighted } from './dailyWheel';
import { addCoins } from './operations';
import type { PlayerState } from './player';

export const SHOP_GIFT = {
  /** monedas y su peso (probabilidad relativa) */
  options: [
    { amount: 5, weight: 60 },
    { amount: 10, weight: 30 },
    { amount: 15, weight: 10 },
  ],
};

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
export function claimGift(s: PlayerState, now: number, rng: () => number = Math.random): { ok: true; state: PlayerState; amount: number } | { ok: false; error: 'already' } {
  if (!giftStatus(s, now).available) return { ok: false, error: 'already' };
  const pick = pickWeighted(SHOP_GIFT.options, rng);
  const res = addCoins(s, pick.amount);
  if (!res.ok) return { ok: false, error: 'already' };
  return { ok: true, state: { ...res.state, giftDay: cycleIdAt(now) }, amount: pick.amount };
}
