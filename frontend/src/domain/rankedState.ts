/**
 * RANKED — datos guardados por jugador (dentro de PlayerState.ranked).
 * Solo tipos y constructores, sin dependencias (evita imports circulares con player.ts).
 */
import type { RankId } from './ranks';

export type RankedOutcome = 'win' | 'loss' | 'surrender' | 'abandon';

/** Partida Ranked con la entrada ya pagada y sin liquidar. */
export interface RankedPending {
  matchId: string;
  league: RankId;
  bet: number;
  entry: number;
  prize: number;
  startedAt: number;
}

/** Recompensa semanal calculada al cerrar la semana (se muestra y se cobra con un botón). */
export interface WeeklyReward {
  /** id de la semana cerrada */
  week: string;
  league: RankId;
  matches: number;
  /** cumplió el mínimo de partidas */
  eligible: boolean;
  position: number | null;
  /** premio de liga + premio por posición (0 si no es elegible) */
  coins: number;
  cash: number;
  /** Rayos entregados al reclamar una semana elegible. */
  rays: number;
  positionLabel: string | null;
  claimed: boolean;
}

export interface RankedStats {
  wins: number;
  losses: number;
  streak: number;
  bestStreak: number;
}

export interface RankedMatchHistory {
  outcome: 'win' | 'loss';
  delta: number;
  league: RankId;
  playedAt: number;
}

export interface RankedState {
  /** se desbloqueó (nivel >= RANKED.unlockLevel) */
  unlocked: boolean;
  league: RankId;
  /** semana (lunes AAAA-MM-DD) y mes (AAAA-MM) a los que pertenecen los datos */
  week: string;
  month: string;
  /** partidas completadas (ganadas + perdidas) en la semana: requisito de recompensa */
  weekMatches: number;
  /** estadísticas de la semana (temporada) y totales */
  season: RankedStats;
  total: RankedStats;
  pending: RankedPending | null;
  /** últimos resultados Ranked completados, del más reciente al más antiguo */
  history: RankedMatchHistory[];
  /** ids de partidas ya liquidadas (idempotencia) */
  settled: string[];
  /** recompensas semanales por mostrar / cobrar */
  rewards: WeeklyReward[];
  /** liga que el jugador ya vio celebrada (animación de ascenso pendiente si difiere) */
  seenLeague: RankId;
  /** último descenso mensual sin mostrar */
  demotion: { from: RankId; to: RankId; coinsCut: number } | null;
}

export const newStats = (): RankedStats => ({ wins: 0, losses: 0, streak: 0, bestStreak: 0 });

export function newRankedState(): RankedState {
  return {
    unlocked: false,
    league: 'bronze',
    week: '',
    month: '',
    weekMatches: 0,
    season: newStats(),
    total: newStats(),
    pending: null,
    history: [],
    settled: [],
    rewards: [],
    seenLeague: 'bronze',
    demotion: null,
  };
}

export function cloneRanked(r: RankedState): RankedState {
  return {
    ...r,
    season: { ...r.season },
    total: { ...r.total },
    pending: r.pending ? { ...r.pending } : null,
    history: r.history.map((entry) => ({ ...entry })),
    settled: [...r.settled],
    rewards: r.rewards.map((w) => ({ ...w })),
    demotion: r.demotion ? { ...r.demotion } : null,
  };
}
