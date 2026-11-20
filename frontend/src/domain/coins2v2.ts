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
export const delta2v2 = (r: Result2v2, bet = 1) => bet * (r === 'win' ? COINS_2V2.win : r === 'loss' ? -COINS_2V2.loss : -COINS_2V2.surrender);

/**
 * APUESTA del 2v2 (21-11-2026, usuario): como en el 1v1, x1 o x2 (con posibilidad de x2). Lo que arriesgas (`risk` = lo que restas al perder) y lo que
 * ganas (`prize`) se multiplican por la apuesta: x1 = arriesgas 15 y ganas 30; x2 = arriesgas 30 y ganas 60 (rendirte resta el doble: 60). No se paga
 * por adelantado (las monedas 2v2 parten de 0 y nunca bajan de 0): el x1 siempre se puede elegir; el x2 solo si tienes monedas para cubrir lo que arriesgas.
 */
export const BETS_2V2 = [1, 2] as const;
export interface Stake2v2 {
  bet: number;
  /** lo que restas si pierdes */
  risk: number;
  /** lo que sumas si ganas */
  prize: number;
  /** se puede elegir (x1 siempre; x2 con al menos `risk` monedas 2v2) */
  affordable: boolean;
}
export function stakes2v2(coins: number): Stake2v2[] {
  return BETS_2V2.map((bet) => ({ bet, risk: COINS_2V2.loss * bet, prize: COINS_2V2.win * bet, affordable: bet === 1 || coins >= COINS_2V2.loss * bet }));
}
/**
 * (19-11-2026, usuario) AMISTOSO del 2v2: sin monedas 2v2 ni para lo que arriesga el x1 (15), el botón dice AMISTOSO, como el 1v1. Como las
 * monedas 2v2 solo se ganan jugando 2v2, al GANAR igual sumas (+30) y al perder no pierdes nada (ya no tienes): así se sale del amistoso jugando.
 */
export const friendly2v2 = (coins: number) => Math.max(0, Math.floor(coins)) < COINS_2V2.loss;

/** La apuesta que de verdad vale: la elegida si se puede pagar, si no x1. */
export const effectiveBet2v2 = (coins: number, wanted: number): number => stakes2v2(coins).find((s) => s.bet === wanted && s.affordable)?.bet ?? 1;

/** Aplica un resultado: nuevo estado y cuánto cambió de verdad (perder con 5 monedas resta 5, no 15). */
export function apply2v2Result(s: PlayerState, r: Result2v2, wantedBet = 1): { state: PlayerState; before: number; after: number; delta: number; bet: number } {
  const before = Math.max(0, Math.floor(s.coins2v2 ?? 0));
  const bet = effectiveBet2v2(before, wantedBet); // la apuesta elegida (x2 solo si se puede cubrir)
  const after = Math.max(0, before + delta2v2(r, bet));
  const n = clonePlayer(s);
  if (after > 0) n.coins2v2 = after;
  else delete n.coins2v2;
  return { state: n, before, after, delta: after - before, bet };
}

/** (21-11-2026) Suma monedas 2v2 de un premio (Pase, ruleta). No pasa por apply2v2Result: no es un resultado de partida. */
export function addCoins2v2(s: PlayerState, amount: number): PlayerState {
  const n = clonePlayer(s);
  n.coins2v2 = Math.max(0, Math.floor(n.coins2v2 ?? 0)) + Math.max(0, Math.floor(amount));
  return n;
}

/** Valida lo guardado (entero > 0; si no, sin campo). */
export function sanitizeCoins2v2(raw: unknown): number | undefined {
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : undefined;
}
