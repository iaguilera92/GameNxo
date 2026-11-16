/**
 * RANKED — datos guardados por jugador (dentro de PlayerState.ranked).
 * Solo tipos y constructores, sin dependencias (evita imports circulares con player.ts).
 */
import type { RankId } from './ranks';

/** `opponent_left`: el RIVAL online se rindió o abandonó (D9; ver settleRanked y RANKED.forfeitBonus) */
export type RankedOutcome = 'win' | 'loss' | 'surrender' | 'abandon' | 'opponent_left';

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
  /** victorias Ranked de la semana (requisito: RANKED.minWinsForReward) */
  wins: number;
  /** resultado neto de la semana (Ranking Liga) */
  net: number;
  /** cumplió el mínimo de victorias */
  eligible: boolean;
  /** liga a la que ascendió al cerrar la semana (neto ≥ meta) */
  promotedTo: RankId | null;
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
  /** partidas Ranked liquidadas en la semana (ganadas + perdidas, rendición y abandono incluidos) */
  weekMatches: number;
  /** RANKING LIGA (v2): resultado NETO de la semana en Ranked (apuestas ganadas − perdidas). Puede ser negativo. Vuelve a 0 cada semana */
  weekNet: number;
  /** victorias y derrotas Ranked de la semana (requisito de recompensa y desempates) */
  weekWins: number;
  weekLosses: number;
  /** cuándo alcanzó su neto actual (último desempate: quien llegó antes queda arriba). 0 = sin partidas */
  weekReachedAt: number;
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
  /** MEJOR liga alcanzada (nunca baja): desbloquea los MARCOS del perfil (domain/profileFrames.ts). Guardados viejos: la actual */
  bestLeague?: RankId;
  /** liga que el jugador ya vio celebrada (animación de ascenso pendiente si difiere) */
  seenLeague: RankId;
  /** último descenso mensual sin mostrar (descenso EN PAUSA: hoy nunca se crea; coinsCut siempre 0, las monedas no se recortan) */
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
    weekNet: 0,
    weekWins: 0,
    weekLosses: 0,
    weekReachedAt: 0,
    season: newStats(),
    total: newStats(),
    pending: null,
    history: [],
    settled: [],
    rewards: [],
    seenLeague: 'bronze',
    bestLeague: 'bronze',
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
