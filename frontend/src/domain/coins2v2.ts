/**
 * MONEDAS 2v2 (19-11-2026, decidido con el usuario): contador PROPIO del ranking del 2v2 (no son las monedas de la Liga ni el dinero de la
 * Tienda). Se suman y restan al terminar CADA partido 2v2 (online y contra bots) y nunca bajan de 0. Datos puros, sin Phaser.
 * Más adelante pueden ordenar una tabla / rango 2v2 (pendiente de diseño).
 */
import { type PlayerState, clonePlayer } from './player';

export const COINS_2V2 = {
  win: 30,
  loss: 15,
  surrender: 30,
} as const;

export type Result2v2 = 'win' | 'loss' | 'surrender';

/** Cambio de las MONEDAS 2v2 por un resultado (antes de recortar a 0). */
export const delta2v2 = (r: Result2v2) => (r === 'win' ? COINS_2V2.win : r === 'loss' ? -COINS_2V2.loss : -COINS_2V2.surrender);

/** Aplica un resultado: nuevo estado y cuánto cambió de verdad (perder con 5 monedas resta 5, no 15). */
export function apply2v2Result(s: PlayerState, r: Result2v2): { state: PlayerState; before: number; after: number; delta: number } {
  const before = Math.max(0, Math.floor(s.coins2v2 ?? 0));
  const after = Math.max(0, before + delta2v2(r));
  const n = clonePlayer(s);
  if (after > 0) n.coins2v2 = after;
  else delete n.coins2v2;
  return { state: n, before, after, delta: after - before };
}

/** Valida lo guardado (entero > 0; si no, sin campo). */
export function sanitizeCoins2v2(raw: unknown): number | undefined {
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : undefined;
}
