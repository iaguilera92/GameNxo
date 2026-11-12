/**
 * RANKED — configuración (datos puros, sin Phaser). TODO lo ajustable de la economía competitiva está aquí.
 * Documentación: docs/RANKED.md. `validateRankedConfig()` comprueba la coherencia (también en los tests).
 *
 * Moneda: las MONEDAS del jugador (PlayerState.coins) son la moneda competitiva. Se gastan en entradas
 * Ranked y deciden la clasificación. La Tienda solo cobra DINERO (PlayerState.gems).
 */
import type { RankId } from './ranks';

export interface LeagueEconomy {
  /** costo de entrada (modalidad normal); la apuesta multiplica entrada y premio */
  entry: number;
  /** saldo con el que se asciende a la liga siguiente (null = liga máxima) */
  target: number | null;
  /** recompensa semanal por liga (si se cumple el mínimo de partidas) */
  weekly: { coins: number; cash: number };
  /** liga a la que se baja en el reinicio mensual */
  demoteTo: RankId;
}

export interface PositionPrize {
  /** posición máxima incluida (1 = solo el Top 1) */
  upTo: number;
  label: string;
  coins: number;
  cash: number;
}

export const RANKED = {
  /** nivel con el que se desbloquea: 1 = todos compiten en Bronce desde el principio (no se deja fuera a nadie) */
  unlockLevel: 1,
  /** premio de una victoria = entrada × prizeMult */
  prizeMult: 2,
  /** apuestas disponibles (multiplicador individual de entrada y premio) */
  bets: [1, 2] as const,
  /** partidas completadas (ganadas o perdidas) para cobrar la recompensa semanal */
  minMatchesForReward: 3,
  /**
   * Descenso mensual: si el saldo supera este tope de la liga NUEVA, se recorta a él. Fracción del tramo
   * entre el objetivo de la liga nueva y el de la siguiente (0.5 = mitad de la liga siguiente): con una
   * partida más se vuelve a subir y se empieza a mitad de la liga.
   */
  demotionCapFraction: 0.5,
  /** participantes visibles por liga (jugadores reales + rivales simulados) */
  tableSize: 100,
  leagues: {
    // semanal de Bronce = 12 entradas (más que una semana de premio diario); Plata paga más que Bronce (docs/ECONOMIA.md)
    bronze: { entry: 500, target: 30_000, weekly: { coins: 6_000, cash: 0 }, demoteTo: 'bronze' },
    silver: { entry: 1_000, target: 60_000, weekly: { coins: 8_000, cash: 10 }, demoteTo: 'bronze' },
    gold: { entry: 2_000, target: 120_000, weekly: { coins: 9_000, cash: 20 }, demoteTo: 'silver' },
    platinum: { entry: 4_000, target: 240_000, weekly: { coins: 12_000, cash: 30 }, demoteTo: 'gold' },
    diamond: { entry: 8_000, target: 480_000, weekly: { coins: 15_000, cash: 50 }, demoteTo: 'platinum' },
    challenger: { entry: 16_000, target: null, weekly: { coins: 20_000, cash: 75 }, demoteTo: 'diamond' },
  } as Record<RankId, LeagueEconomy>,
  /** premios extra por posición final de la semana (el primer tramo que incluya la posición) */
  positionPrizes: [
    { upTo: 1, label: 'TOP 1', coins: 5_000, cash: 50 },
    { upTo: 10, label: 'TOP 10', coins: 2_000, cash: 20 },
    { upTo: 50, label: 'TOP 50', coins: 500, cash: 5 },
  ] as PositionPrize[],
  /**
   * Sin backend solo existe un jugador real: los rivales simulados SÍ ocupan posiciones (si no, el jugador
   * sería siempre Top 1). Con backend y jugadores suficientes poner false: las posiciones de premio se
   * calculan solo entre jugadores reales. Los bots NUNCA reciben premios.
   */
  botsCountForPositionPrizes: true,
  /** partidas Ranked recordadas (ids) para no liquidar dos veces la misma */
  maxMatchIds: 32,
};

export const LEAGUE_ORDER: RankId[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'challenger'];

export const league = (id: RankId) => RANKED.leagues[id];
export const nextLeague = (id: RankId): RankId | null => LEAGUE_ORDER[LEAGUE_ORDER.indexOf(id) + 1] ?? null;
export const prevLeague = (id: RankId): RankId | null => LEAGUE_ORDER[LEAGUE_ORDER.indexOf(id) - 1] ?? null;

/** Saldo mínimo "de referencia" de una liga (objetivo de la anterior; 0 en Bronce). */
export function leagueFloor(id: RankId): number {
  const p = prevLeague(id);
  return p ? (league(p).target ?? 0) : 0;
}

/** Costo y premio de una partida en la liga con la apuesta dada. */
export function matchStakes(id: RankId, bet: number) {
  const entry = league(id).entry * bet;
  return { entry, prize: entry * RANKED.prizeMult };
}

/** Tope de saldo tras bajar a `to` (null = sin tope). */
export function demotionCap(to: RankId): number | null {
  const t = league(to).target;
  const n = nextLeague(to);
  const nt = n ? league(n).target : null;
  if (t == null) return null;
  const span = nt != null ? nt - t : t; // la siguiente es la máxima: tramo = el propio objetivo
  return Math.floor(t + span * RANKED.demotionCapFraction);
}

export function positionPrize(pos: number | null): PositionPrize | null {
  if (pos == null || pos < 1) return null;
  return RANKED.positionPrizes.find((p) => pos <= p.upTo) ?? null;
}

/** Comprueba la configuración; devuelve los errores (vacío = válida). */
export function validateRankedConfig(): string[] {
  const errs: string[] = [];
  let prevTarget = 0;
  LEAGUE_ORDER.forEach((id, i) => {
    const l = RANKED.leagues[id];
    if (!l) return errs.push(`falta la liga ${id}`);
    if (!Number.isInteger(l.entry) || l.entry <= 0) errs.push(`entrada inválida en ${id}`);
    const last = i === LEAGUE_ORDER.length - 1;
    if (last ? l.target !== null : l.target == null || l.target <= prevTarget) errs.push(`objetivo inválido en ${id}`);
    if (l.target != null) prevTarget = l.target;
    if (l.weekly.coins < 0 || l.weekly.cash < 0) errs.push(`recompensa semanal negativa en ${id}`);
    if (LEAGUE_ORDER.indexOf(l.demoteTo) > i) errs.push(`el descenso de ${id} sube de liga`);
  });
  const ups = RANKED.positionPrizes.map((p) => p.upTo);
  if (ups.some((u, i) => i > 0 && u <= ups[i - 1])) errs.push('tramos de posición desordenados');
  if (RANKED.minMatchesForReward < 0) errs.push('mínimo de partidas inválido');
  return errs;
}
