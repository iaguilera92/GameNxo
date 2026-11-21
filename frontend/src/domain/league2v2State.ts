/**
 * LIGA 2v2 — datos guardados por jugador (PlayerState.league2v2). Solo tipos y constructores (como rankedState.ts), sin dependencias
 * de player.ts para evitar imports circulares. La lógica (semana, ascenso, recompensa) está en league2v2.ts.
 *
 * Mismo esquema que la liga normal: una liga (Bronce … Challenger), un NETO semanal de MONEDAS 2v2, una meta para subir UNA liga al
 * cerrar la semana y una recompensa semanal por victorias. Subir de liga en la semanal desbloquea el MARCO 2v2 de esa liga.
 */
import type { RankId } from './ranks';
import { LEAGUE_ORDER } from './rankedConfig';
import { type RankedStats, type WeeklyReward, newStats } from './rankedState';

export interface League2v2State {
  league: RankId;
  /** MEJOR liga 2v2 alcanzada (nunca baja): desbloquea los MARCOS 2v2 del perfil (domain/profileFrames.ts) */
  bestLeague: RankId;
  /** liga que el jugador ya vio celebrada (animación de ascenso pendiente si difiere de `league`) */
  seenLeague: RankId;
  /** semana (lunes AAAA-MM-DD) a la que pertenecen los datos de abajo */
  week: string;
  /** partidas 2v2 de la semana (ganadas + perdidas; rendirse cuenta como derrota) */
  weekMatches: number;
  /** NETO de la semana en MONEDAS 2v2 (ganadas − perdidas en partidos 2v2; ruletas, pase y regalos no cuentan). Nunca baja de 0 */
  weekNet: number;
  weekWins: number;
  weekLosses: number;
  /** cuándo alcanzó su neto actual (desempate) */
  weekReachedAt: number;
  season: RankedStats;
  total: RankedStats;
  /** recompensas semanales por mostrar / cobrar (`coins` = MONEDAS 2v2) */
  rewards: WeeklyReward[];
}

export function newLeague2v2State(league: RankId = 'bronze'): League2v2State {
  return {
    league,
    bestLeague: league,
    seenLeague: league,
    week: '',
    weekMatches: 0,
    weekNet: 0,
    weekWins: 0,
    weekLosses: 0,
    weekReachedAt: 0,
    season: newStats(),
    total: newStats(),
    rewards: [],
  };
}

export function cloneLeague2v2(l: League2v2State): League2v2State {
  return { ...l, season: { ...l.season }, total: { ...l.total }, rewards: l.rewards.map((w) => ({ ...w })) };
}

const LEAGUES = new Set<string>(LEAGUE_ORDER);
const int0 = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);
const leagueOr = (v: unknown, def: RankId): RankId => (typeof v === 'string' && LEAGUES.has(v) ? (v as RankId) : def);
const statsOf = (v: unknown): RankedStats => {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return { wins: int0(o.wins), losses: int0(o.losses), streak: int0(o.streak), bestStreak: int0(o.bestStreak) };
};

/** Valida lo guardado (migración). Sin datos = undefined (el estado se crea al sincronizar, con la liga que ya tenía por sus monedas 2v2). */
export function sanitizeLeague2v2(raw: unknown): League2v2State | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const league = leagueOr(o.league, 'bronze');
  const best = leagueOr(o.bestLeague, league);
  const rewards: WeeklyReward[] = (Array.isArray(o.rewards) ? o.rewards : [])
    .filter((w): w is Record<string, unknown> => !!w && typeof w === 'object' && typeof (w as Record<string, unknown>).week === 'string')
    .slice(-8)
    .map((w) => ({
      week: w.week as string,
      league: leagueOr(w.league, league),
      matches: int0(w.matches),
      wins: int0(w.wins),
      net: int0(w.net),
      eligible: !!w.eligible,
      promotedTo: typeof w.promotedTo === 'string' && LEAGUES.has(w.promotedTo) ? (w.promotedTo as RankId) : null,
      position: typeof w.position === 'number' && w.position > 0 ? Math.floor(w.position) : null,
      coins: int0(w.coins),
      cash: int0(w.cash),
      rays: int0(w.rays),
      positionLabel: typeof w.positionLabel === 'string' ? w.positionLabel : null,
      claimed: !!w.claimed,
    }));
  return {
    league,
    // la mejor liga nunca es menor que la actual
    bestLeague: LEAGUE_ORDER.indexOf(best) >= LEAGUE_ORDER.indexOf(league) ? best : league,
    seenLeague: leagueOr(o.seenLeague, league),
    week: typeof o.week === 'string' ? o.week : '',
    weekMatches: int0(o.weekMatches),
    weekNet: int0(o.weekNet),
    weekWins: int0(o.weekWins),
    weekLosses: int0(o.weekLosses),
    weekReachedAt: int0(o.weekReachedAt),
    season: statsOf(o.season),
    total: statsOf(o.total),
    rewards,
  };
}
