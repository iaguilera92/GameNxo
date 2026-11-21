/**
 * LIGA 2v2 (21-11-2026, decidido con el usuario): la misma estructura que la LIGA normal, con las MONEDAS 2v2 (domain/coins2v2.ts). Datos
 * puros, sin Phaser. Con backend, el SERVIDOR ejecutará estas funciones (como domain/ranked.ts).
 *
 *  - Una liga (Bronce … Challenger) y un NETO semanal: lo ganado − lo perdido en partidos 2v2 (online y contra bots). Ruletas, pase,
 *    regalos y cofres no cuentan. Nunca baja de 0.
 *  - Semana = la de la liga normal (lunes 00:00 hora de Chile). Al cerrarla:
 *      · con >= minWinsForReward VICTORIAS se gana la recompensa de la liga (MONEDAS 2v2 + dinero + rayos), que se cobra con un botón;
 *      · con neto ≥ meta de la liga se sube UNA liga y se desbloquea su MARCO 2v2 del perfil (domain/profileFrames.ts);
 *      · el neto, las victorias y las derrotas de la semana vuelven a 0.
 *  - La tabla se llena con jugadores SIMULADOS (domain/rankedBots.ts con otra economía) hasta que haya cuentas en el servidor.
 *
 * TODAS las cifras de LEAGUE_2V2 son PROVISIONALES (pendientes de definir con el usuario).
 */
import { type PlayerState, clonePlayer } from './player';
import type { RankId } from './ranks';
import { LEAGUE_ORDER, nextLeague } from './rankedConfig';
import { type BoardEcon, type BoardEntry, buildBoard } from './rankedBots';
import { type RankedView, ME, botClockAt, botClockWeekEnd, msToWeekEnd, weekIdAt } from './ranked';
import { type WeeklyReward, newStats } from './rankedState';
import { type League2v2State, newLeague2v2State } from './league2v2State';
import { addCoins2v2 } from './coins2v2';

/** Desde cuántas MONEDAS 2v2 se tenía cada rango antes de la liga semanal: solo decide la liga inicial de quien ya jugaba 2v2. */
export const RANK_2V2: { id: RankId; from: number }[] = [
  { id: 'bronze', from: 0 },
  { id: 'silver', from: 150 },
  { id: 'gold', from: 400 },
  { id: 'platinum', from: 800 },
  { id: 'diamond', from: 1400 },
  { id: 'challenger', from: 2200 },
];

export interface League2v2Economy {
  /** META SEMANAL de ascenso: neto de MONEDAS 2v2 de la semana (null = liga máxima) */
  target: number | null;
  /** referencia de los simulados de la tabla (en la liga máxima, que no tiene meta) */
  goal: number;
  /** recompensa semanal (MONEDAS 2v2 y dinero) si se cumple el mínimo de victorias */
  weekly: { coins: number; cash: number };
}

export const LEAGUE_2V2: {
  /** VICTORIAS 2v2 en la semana para cobrar la recompensa semanal */
  minWinsForReward: number;
  /** lo que se gana en una victoria x1: el paso de los resultados de los simulados */
  step: number;
  /** Rayos que da una recompensa semanal elegible */
  rays: number;
  leagues: Record<RankId, League2v2Economy>;
} = {
  minWinsForReward: 3,
  step: 30,
  rays: 1,
  leagues: {
    bronze: { target: 300, goal: 300, weekly: { coins: 60, cash: 0 } },
    silver: { target: 450, goal: 450, weekly: { coins: 90, cash: 5 } },
    gold: { target: 650, goal: 650, weekly: { coins: 120, cash: 10 } },
    platinum: { target: 900, goal: 900, weekly: { coins: 160, cash: 15 } },
    diamond: { target: 1200, goal: 1200, weekly: { coins: 220, cash: 25 } },
    challenger: { target: null, goal: 1500, weekly: { coins: 300, cash: 40 } },
  },
};

export const league2v2Economy = (id: RankId) => LEAGUE_2V2.leagues[id];
const boardEcon = (id: RankId): BoardEcon => ({ goal: LEAGUE_2V2.leagues[id].goal, entry: LEAGUE_2V2.step, target: LEAGUE_2V2.leagues[id].target, tag: '2v2' });

/** Rango por total de monedas 2v2 (solo para la liga inicial de quien ya tenía monedas 2v2), y el siguiente. */
export function rank2v2(total: number): { id: RankId; from: number; next: { id: RankId; from: number } | null } {
  let i = 0;
  for (let k = 0; k < RANK_2V2.length; k++) if (total >= RANK_2V2[k].from) i = k;
  return { ...RANK_2V2[i], next: RANK_2V2[i + 1] ?? null };
}

const coinsOf = (s: Readonly<PlayerState>) => Math.max(0, Math.floor(s.coins2v2 ?? 0));
/** Liga 2v2 actual (sin datos guardados aún: la que daban sus monedas 2v2). */
export const league2v2Of = (s: Readonly<PlayerState>): RankId => s.league2v2?.league ?? rank2v2(coinsOf(s)).id;
/** MEJOR liga 2v2 alcanzada (nunca baja): desbloquea los marcos 2v2. */
export function bestLeague2v2(s: Readonly<PlayerState>): RankId {
  const l = s.league2v2;
  if (!l) return league2v2Of(s);
  return LEAGUE_ORDER.indexOf(l.league) > LEAGUE_ORDER.indexOf(l.bestLeague) ? l.league : l.bestLeague;
}

// ---------------------------------------------------------------- tabla

function playerEntry(s: PlayerState, l: League2v2State): Omit<BoardEntry, 'position'> {
  return {
    id: ME,
    name: s.name,
    bot: false,
    level: s.level,
    coins: l.weekNet,
    wins: l.weekWins,
    losses: l.weekLosses,
    reachedAt: l.weekReachedAt,
    avatar: { skin: s.equipped.skin === 'mai' ? 'mai' : 'nxo', color: 0xffc42e },
  };
}

/** Tabla de la liga 2v2 del jugador (neto semanal, con simulados). */
export function board2v2(s: PlayerState, l: League2v2State, clock: { week: string; day: number }): BoardEntry[] {
  return buildBoard(l.league, clock, [playerEntry(s, l)], boardEcon(l.league));
}

// ---------------------------------------------------------------- operaciones

function weeklyReward(s: PlayerState, l: League2v2State, week: string): WeeklyReward {
  const eligible = l.weekWins >= LEAGUE_2V2.minWinsForReward;
  const position = board2v2(s, l, botClockWeekEnd(week)).find((e) => e.id === ME)?.position ?? null;
  const base = league2v2Economy(l.league).weekly;
  return {
    week,
    league: l.league,
    matches: l.weekMatches,
    wins: l.weekWins,
    net: l.weekNet,
    eligible,
    promotedTo: null,
    position,
    coins: eligible ? base.coins : 0,
    cash: eligible ? base.cash : 0,
    rays: eligible ? LEAGUE_2V2.rays : 0,
    positionLabel: null,
    claimed: false,
  };
}

/**
 * Pone la liga 2v2 al día con `now`: la crea (con la liga que daban sus monedas 2v2) y cierra la semana (recompensa + ascenso de UNA liga
 * con neto ≥ meta + semana a 0). Pura: devuelve el mismo objeto si no cambia nada.
 */
export function syncLeague2v2(s: PlayerState, now: number): PlayerState {
  const week = weekIdAt(now);
  if (s.league2v2 && week <= s.league2v2.week) return s;
  const n = clonePlayer(s);
  if (!n.league2v2) {
    n.league2v2 = newLeague2v2State(rank2v2(coinsOf(n)).id);
    n.league2v2.week = week;
    return n;
  }
  const l = n.league2v2;
  if (l.week && week > l.week) {
    const reward = l.weekMatches > 0 ? weeklyReward(n, l, l.week) : null;
    const target = league2v2Economy(l.league).target;
    const nx = nextLeague(l.league);
    if (nx && target != null && l.weekNet >= target) {
      l.league = nx;
      if (LEAGUE_ORDER.indexOf(nx) > LEAGUE_ORDER.indexOf(l.bestLeague)) l.bestLeague = nx; // desbloquea el marco 2v2 de esa liga
      if (reward) reward.promotedTo = nx;
    }
    if (reward) l.rewards.push(reward);
    if (l.rewards.length > 8) l.rewards.splice(0, l.rewards.length - 8);
    l.weekMatches = 0;
    l.weekNet = 0;
    l.weekWins = 0;
    l.weekLosses = 0;
    l.weekReachedAt = 0;
    l.season = newStats();
  }
  l.week = week;
  return n;
}

/** Apunta un partido 2v2 terminado: `delta` = lo que cambiaron de verdad las MONEDAS 2v2 (después de recortar a 0). */
export function recordMatch2v2(s: PlayerState, now: number, win: boolean, delta: number): PlayerState {
  const synced = syncLeague2v2(s, now);
  const n = synced === s ? clonePlayer(s) : synced;
  const l = n.league2v2!;
  l.weekMatches += 1;
  l.weekNet = Math.max(0, l.weekNet + Math.trunc(delta));
  l.weekReachedAt = now;
  for (const st of [l.season, l.total]) {
    if (win) {
      st.wins += 1;
      st.streak += 1;
      st.bestStreak = Math.max(st.bestStreak, st.streak);
    } else {
      st.losses += 1;
      st.streak = 0;
    }
  }
  if (win) l.weekWins += 1;
  else l.weekLosses += 1;
  return n;
}

export type Claim2v2Result = { ok: true; state: PlayerState; reward: WeeklyReward; given: boolean } | { ok: false; error: 'not_found' };

/** Cobra (o descarta, si no era elegible) la recompensa de una semana de la liga 2v2. Idempotente. */
export function claimWeekly2v2(s: PlayerState, week: string): Claim2v2Result {
  const i = s.league2v2?.rewards.findIndex((w) => w.week === week) ?? -1;
  if (!s.league2v2 || i < 0) return { ok: false, error: 'not_found' };
  const w = s.league2v2.rewards[i];
  if (w.claimed) return { ok: true, state: s, reward: w, given: false };
  let n = clonePlayer(s);
  const nw = n.league2v2!.rewards[i];
  nw.claimed = true;
  if (nw.eligible) {
    n = addCoins2v2(n, nw.coins);
    n.gems += nw.cash;
    n.zone.rays += nw.rays;
  }
  n.league2v2!.rewards = n.league2v2!.rewards.filter((x) => !x.claimed || x.week === week).slice(-8);
  return { ok: true, state: n, reward: nw, given: nw.eligible };
}

/** La animación de ascenso ya se mostró. */
export function markLeague2v2Seen(s: PlayerState): PlayerState {
  const l = s.league2v2;
  if (!l || l.seenLeague === l.league) return s;
  const n = clonePlayer(s);
  n.league2v2!.seenLeague = n.league2v2!.league;
  return n;
}

// ---------------------------------------------------------------- consultas

/** Lo que dibuja el hub de LIGA (el mismo de la liga normal): los campos de RankedView que usa. `coins` = MONEDAS 2v2. */
export type LeagueHubView = Pick<
  RankedView,
  'league' | 'coins' | 'target' | 'next' | 'weekNet' | 'progress' | 'promoting' | 'board' | 'position' | 'prizePosition' | 'weekMatches' | 'weekWins' | 'weekLosses' | 'minWins' | 'msLeft' | 'estimate' | 'season' | 'total'
>;

export function view2v2(s0: PlayerState, now: number): LeagueHubView {
  const s = syncLeague2v2(s0, now);
  const l = s.league2v2 ?? newLeague2v2State(league2v2Of(s));
  const eco = league2v2Economy(l.league);
  const board = board2v2(s, l, botClockAt(now));
  const eligible = l.weekWins >= LEAGUE_2V2.minWinsForReward;
  const next = nextLeague(l.league);
  return {
    league: l.league,
    coins: coinsOf(s),
    target: eco.target,
    next,
    weekNet: l.weekNet,
    progress: eco.target == null ? 1 : Math.min(1, Math.max(0, l.weekNet / eco.target)),
    promoting: !!next && eco.target != null && l.weekNet >= eco.target,
    board,
    position: board.find((e) => e.id === ME)?.position ?? null,
    prizePosition: null,
    weekMatches: l.weekMatches,
    weekWins: l.weekWins,
    weekLosses: l.weekLosses,
    minWins: LEAGUE_2V2.minWinsForReward,
    msLeft: msToWeekEnd(now),
    estimate: { coins: eco.weekly.coins, cash: eco.weekly.cash, rays: eligible ? LEAGUE_2V2.rays : 0, label: null, eligible },
    season: l.season,
    total: l.total,
  };
}
