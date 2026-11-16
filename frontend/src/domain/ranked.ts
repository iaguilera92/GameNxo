/**
 * RANKED — lógica pura (estado -> nuevo estado + resultado). Sin Phaser ni DOM.
 * Igual que operations.ts: con backend, el SERVIDOR ejecutará estas funciones (descontar entradas, liquidar
 * partidas, cerrar semanas y meses). El cliente solo las llama mientras no exista servidor.
 *
 * Reglas RANKED v2 (configuración en rankedConfig.ts; diseño y decisiones en docs/RANKED-V2.md):
 *  - Se desbloquea en el nivel RANKED.unlockLevel; se empieza en Bronce.
 *  - Entrar exige saldo ≥ entrada × apuesta y la paga. Ganar paga entrada × prizeMult. Perder: nada.
 *  - DOS registros: el SALDO global (`coins`, Ranking Global, nunca se reinicia ni se recorta) y el NETO semanal
 *    (`ranked.weekNet`, Ranking Liga): solo apuestas Ranked; las monedas de ruletas, cofres o premios no lo tocan. Nunca baja de 0.
 *  - Semana (lunes 00:00 hora de Chile, mismo corte 23:59 que las ruletas). Al cerrarla:
 *      · con >= minWinsForReward VICTORIAS se gana la recompensa de la liga + premio por posición (se cobra con un botón);
 *      · con neto ≥ meta de la liga se sube UNA liga (nunca se salta ligas; Challenger no sube);
 *      · el neto, las victorias y las derrotas de la semana vuelven a 0.
 *  - Rendición y abandono cuentan como DERROTA (D9). Si se va el RIVAL: ver `settleRanked` ('opponent_left').
 *  - Descenso mensual EN PAUSA (D6): nadie baja hasta definir el criterio. Las monedas no se recortan nunca.
 *  - Todo es idempotente por id de partida / id de semana.
 */
import { cycleIdAt } from './dailyWheel';
import { type PlayerState, clonePlayer } from './player';
import { LEAGUE_ORDER, RANKED, league, matchStakes, nextLeague, positionPrize } from './rankedConfig';
import { type BoardEntry, type BotClock, buildBoard, buildGlobalBoard, prizePosition } from './rankedBots';
import { type RankedMatchHistory, type RankedOutcome, type WeeklyReward, newStats } from './rankedState';
import type { RankId } from './ranks';

export const ME = 'me';

// ---------------------------------------------------------------- calendario

const DAY = 86_400_000;
const parseDay = (id: string) => {
  const [y, m, d] = id.split('-').map(Number);
  return { y, m, d };
};
const dayId = (t: number) => {
  const x = new Date(t);
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}-${String(x.getUTCDate()).padStart(2, '0')}`;
};

/** Semana a la que pertenece un día (AAAA-MM-DD) = su lunes. */
export function weekOfDay(day: string): string {
  const { y, m, d } = parseDay(day);
  const t = Date.UTC(y, m - 1, d);
  const dow = (new Date(t).getUTCDay() + 6) % 7; // lunes = 0
  return dayId(t - dow * DAY);
}

export const weekIdAt = (ms: number) => weekOfDay(cycleIdAt(ms));
export const monthIdAt = (ms: number) => cycleIdAt(ms).slice(0, 7);

/** Ms hasta el cierre de la semana (búsqueda binaria sobre el ciclo diario: respeta horario de verano). */
export function msToWeekEnd(ms: number): number {
  const id = weekIdAt(ms);
  let lo = ms;
  let hi = ms + 8 * DAY;
  if (weekIdAt(hi) === id) return hi - ms;
  while (hi - lo > 1000) {
    const mid = Math.floor((lo + hi) / 2);
    if (weekIdAt(mid) === id) lo = mid;
    else hi = mid;
  }
  return hi - ms;
}

const utcOf = (id: string) => {
  const { y, m, d } = parseDay(id);
  return Date.UTC(y, m - 1, d);
};

/** Reloj de los bots en un instante: semana y día (0 = lunes … 6 = domingo). Los bots avanzan una vez al día. */
export function botClockAt(ms: number): BotClock {
  const day = cycleIdAt(ms);
  const week = weekOfDay(day);
  return { week, day: Math.round((utcOf(day) - utcOf(week)) / DAY) };
}

/** Reloj de los bots al final de una semana (domingo). */
export function botClockWeekEnd(week: string): BotClock {
  return { week, day: 6 };
}

// ---------------------------------------------------------------- tabla

export function playerEntry(s: PlayerState): Omit<BoardEntry, 'position'> {
  return {
    id: ME,
    name: s.name,
    bot: false,
    level: s.level,
    // Ranking Liga: el NETO de la semana (no el saldo)
    coins: s.ranked.weekNet,
    wins: s.ranked.weekWins,
    losses: s.ranked.weekLosses,
    reachedAt: s.ranked.weekReachedAt,
    avatar: { skin: s.equipped.skin === 'mai' ? 'mai' : 'nxo', color: 0xffc42e },
  };
}

/** Ranking Global (saldo de monedas, solo reales). Sin servidor solo está el jugador. */
export function globalBoardFor(s: PlayerState, now?: number): BoardEntry[] {
  return buildGlobalBoard([{ ...playerEntry(s), coins: s.coins, wins: s.ranked.total.wins, losses: s.ranked.total.losses, reachedAt: 0 }], now == null ? '' : cycleIdAt(now));
}

/** Tabla de una liga (Ranking Liga, neto semanal). El jugador solo aparece en la suya. */
export function boardFor(s: PlayerState, id: RankId, clock: BotClock): BoardEntry[] {
  const real = s.ranked.unlocked && s.ranked.league === id ? [playerEntry(s)] : [];
  return buildBoard(id, clock, real);
}

// ---------------------------------------------------------------- operaciones

export type RankedError = 'locked' | 'invalid_bet' | 'pending' | 'not_enough_coins' | 'not_found' | 'invalid';
export type RankedResult<T = object> = ({ ok: true; state: PlayerState } & T) | { ok: false; error: RankedError };
const fail = (error: RankedError): { ok: false; error: RankedError } => ({ ok: false, error });

/** Recompensa semanal de una semana cerrada. */
function weeklyReward(s: PlayerState, week: string): WeeklyReward {
  const r = s.ranked;
  const eligible = r.weekWins >= RANKED.minWinsForReward;
  const board = boardFor(s, r.league, botClockWeekEnd(week));
  const position = board.find((e) => e.id === ME)?.position ?? null;
  const pp = positionPrize(prizePosition(board, ME));
  const base = league(r.league).weekly;
  return {
    week,
    league: r.league,
    matches: r.weekMatches,
    wins: r.weekWins,
    net: r.weekNet,
    eligible,
    promotedTo: null,
    position,
    coins: eligible ? base.coins + (pp?.coins ?? 0) : 0,
    cash: eligible ? base.cash + (pp?.cash ?? 0) : 0,
    rays: eligible ? 1 : 0,
    positionLabel: pp?.label ?? null,
    claimed: false,
  };
}

/**
 * Pone Ranked al día con `now`: desbloqueo y cierre de semana (recompensa + ascenso de UNA liga con neto ≥ meta + neto a 0).
 * El mes solo se registra: el descenso mensual está EN PAUSA (D6) y las monedas no se recortan nunca.
 * Pura: devuelve el mismo objeto si no cambia nada.
 */
export function syncRanked(s: PlayerState, now: number): PlayerState {
  const week = weekIdAt(now);
  const month = monthIdAt(now);
  const r0 = s.ranked;
  if (!r0.unlocked && s.level < RANKED.unlockLevel) return s;
  // solo hacia delante (los ids se comparan como texto)
  if (r0.unlocked && r0.week && week <= r0.week && month <= r0.month) return s;

  const n = clonePlayer(s);
  const r = n.ranked;
  if (!r.unlocked) {
    r.unlocked = true;
    r.league = 'bronze';
    r.seenLeague = 'bronze';
    r.week = week;
    r.month = month;
    return n;
  }
  if (r.week && week > r.week) {
    // semana con actividad: se registra (elegible o no, para mostrar el resultado); sin partidas no se avisa
    const reward = r.weekMatches > 0 ? weeklyReward(n, r.week) : null;
    // ascenso semanal: neto ≥ meta → UNA liga (aunque la haya superado varias veces); seenLeague queda atrás: la pantalla lo celebra
    const target = league(r.league).target;
    const nx = nextLeague(r.league);
    if (nx && target != null && r.weekNet >= target) {
      r.league = nx;
      // mejor liga alcanzada (marcos del perfil): nunca baja
      if (LEAGUE_ORDER.indexOf(nx) > LEAGUE_ORDER.indexOf(r.bestLeague ?? 'bronze')) r.bestLeague = nx;
      if (reward) reward.promotedTo = nx;
    }
    if (reward) r.rewards.push(reward);
    if (r.rewards.length > 8) r.rewards.splice(0, r.rewards.length - 8);
    r.weekMatches = 0;
    r.weekNet = 0;
    r.weekWins = 0;
    r.weekLosses = 0;
    r.weekReachedAt = 0;
    r.season = newStats();
  }
  // mes: descenso EN PAUSA (RANKED.monthlyDemotion = false, D6). Cuando se defina el criterio, va aquí (sin recortar monedas).
  r.week = week;
  r.month = month;
  return n;
}

/** Entra a una partida Ranked: paga la entrada y deja la partida pendiente de liquidar. */
export function enterRanked(s: PlayerState, matchId: string, bet: number, now: number): RankedResult<{ entry: number; prize: number }> {
  if (!matchId) return fail('invalid');
  const n0 = syncRanked(s, now);
  const r = n0.ranked;
  if (!r.unlocked) return fail('locked');
  if (!(RANKED.bets as readonly number[]).includes(bet)) return fail('invalid_bet');
  if (r.pending || r.settled.includes(matchId)) return fail('pending');
  const { entry, prize } = matchStakes(r.league, bet);
  // D3: saldo ≥ entrada × apuesta (nunca negativo); si no alcanza, solo amistoso
  if (n0.coins < entry) return fail('not_enough_coins');
  const n = clonePlayer(n0);
  n.coins -= entry;
  // (16-11-2026) el neto semanal ya NO baja al apostar: se ajusta al liquidar la partida (resultado − entrada), con mínimo 0
  n.ranked.pending = { matchId, league: r.league, bet, entry, prize, startedAt: now };
  return { ok: true, state: n, entry, prize };
}

export interface Settlement {
  outcome: RankedOutcome;
  entry: number;
  prize: number;
  /** cambio neto de monedas por la partida (premio − entrada) */
  delta: number;
  counted: boolean;
  league: RankId;
  promotedTo: RankId | null;
  duplicate: boolean;
}

/**
 * Liquida la partida pendiente. Idempotente: repetir con el mismo id no paga dos veces.
 *  - 'win': cobra entrada × prizeMult. 'loss', 'surrender', 'abandon': derrota (D9), no cobra.
 *  - 'opponent_left' (se fue el RIVAL online): con `gamesWon ≥ 1` cobra entrada + entrada × forfeitBonus y cuenta como
 *    victoria; si no había ganado ningún juego se le devuelve la entrada y la partida no cuenta (propuesta pendiente, D9).
 * Ya no asciende al terminar la partida: el ascenso es semanal (syncRanked).
 */
export function settleRanked(s: PlayerState, matchId: string, outcome: RankedOutcome, now: number, opts: { gamesWon?: number } = {}): RankedResult<{ settlement: Settlement }> {
  const n0 = syncRanked(s, now);
  const r0 = n0.ranked;
  if (r0.settled.includes(matchId))
    return { ok: true, state: n0, settlement: { outcome, entry: 0, prize: 0, delta: 0, counted: false, league: r0.league, promotedTo: null, duplicate: true } };
  const p = r0.pending;
  if (!p || p.matchId !== matchId) return fail('not_found');
  const n = clonePlayer(n0);
  const r = n.ranked;
  r.pending = null;
  r.settled.push(matchId);
  if (r.settled.length > RANKED.maxMatchIds) r.settled.shift();
  const forfeit = outcome === 'opponent_left';
  const forfeitWin = forfeit && (opts.gamesWon ?? 0) >= 1;
  const win = outcome === 'win' || forfeitWin;
  const counted = !forfeit || forfeitWin;
  const prize = outcome === 'win' ? p.prize : forfeitWin ? p.entry + Math.floor(p.entry * RANKED.forfeitBonus) : forfeit ? p.entry : 0;
  n.coins += prize;
  // neto de la semana: lo ganado o perdido en esta partida; NUNCA baja de 0 (decisión del usuario, 16-11-2026)
  r.weekNet = Math.max(0, r.weekNet + prize - p.entry);
  if (counted) {
    r.weekMatches++;
    if (win) r.weekWins++;
    else r.weekLosses++;
    r.weekReachedAt = now;
    for (const st of [r.season, r.total]) {
      if (win) st.wins++;
      else st.losses++;
      st.streak = win ? st.streak + 1 : 0;
      st.bestStreak = Math.max(st.bestStreak, st.streak);
    }
    r.history.unshift({ outcome: win ? 'win' : 'loss', delta: prize - p.entry, league: p.league, playedAt: now });
    r.history = r.history.slice(0, 20);
  }
  return { ok: true, state: n, settlement: { outcome, entry: p.entry, prize, delta: prize - p.entry, counted, league: r.league, promotedTo: null, duplicate: false } };
}

/** Partida pendiente de una sesión anterior (app cerrada en pleno partido) = abandono. */
export function abandonPending(s: PlayerState, now: number): PlayerState {
  const p = s.ranked.pending;
  if (!p) return syncRanked(s, now);
  const res = settleRanked(s, p.matchId, 'abandon', now);
  return res.ok ? res.state : s;
}

/** Cobra (o descarta, si no era elegible) la recompensa de una semana. Idempotente. */
export function claimWeekly(s: PlayerState, week: string): RankedResult<{ reward: WeeklyReward; given: boolean }> {
  const i = s.ranked.rewards.findIndex((w) => w.week === week);
  if (i < 0) return fail('not_found');
  const w = s.ranked.rewards[i];
  if (w.claimed) return { ok: true, state: s, reward: w, given: false };
  const n = clonePlayer(s);
  const nw = n.ranked.rewards[i];
  nw.claimed = true;
  if (nw.eligible) {
    n.coins += nw.coins;
    n.gems += nw.cash;
    n.zone.rays += nw.rays;
  }
  n.ranked.rewards = n.ranked.rewards.filter((x) => !x.claimed || x.week === week).slice(-8);
  return { ok: true, state: n, reward: nw, given: nw.eligible };
}

/** La animación de ascenso / el aviso de descenso ya se mostraron. */
export function markRankedSeen(s: PlayerState): PlayerState {
  if (s.ranked.seenLeague === s.ranked.league && !s.ranked.demotion) return s;
  const n = clonePlayer(s);
  n.ranked.seenLeague = n.ranked.league;
  n.ranked.demotion = null;
  return n;
}

// ---------------------------------------------------------------- consultas

export interface RankedView {
  unlocked: boolean;
  league: RankId;
  /** saldo global (Ranking Global) */
  coins: number;
  /** META SEMANAL de ascenso de la liga (null = liga máxima) */
  target: number | null;
  next: RankId | null;
  /** neto de la semana (Ranking Liga) y 0..1 hacia la meta (1 en la liga máxima) */
  weekNet: number;
  progress: number;
  /** ya pasó la meta: sube de liga al cerrar la semana */
  promoting: boolean;
  board: BoardEntry[];
  position: number | null;
  /** posición de premio (solo entre reales, D7) */
  prizePosition: number | null;
  globalBoard: BoardEntry[];
  weekMatches: number;
  weekWins: number;
  weekLosses: number;
  /** victorias necesarias para la recompensa semanal */
  minWins: number;
  msLeft: number;
  /** recompensa semanal estimada si terminara ahora (0 si aún no cumple el mínimo) */
  estimate: { coins: number; cash: number; rays: number; label: string | null; eligible: boolean };
  season: PlayerState['ranked']['season'];
  total: PlayerState['ranked']['total'];
  stakes: { bet: number; entry: number; prize: number; affordable: boolean }[];
  history: RankedMatchHistory[];
}

export function rankedView(s0: PlayerState, now: number): RankedView {
  const s = syncRanked(s0, now);
  const r = s.ranked;
  const target = league(r.league).target;
  const board = boardFor(s, r.league, botClockAt(now));
  const position = board.find((e) => e.id === ME)?.position ?? null;
  const pPos = prizePosition(board, ME);
  const pp = positionPrize(pPos);
  const eligible = r.weekWins >= RANKED.minWinsForReward;
  const base = league(r.league).weekly;
  const next = nextLeague(r.league);
  return {
    unlocked: r.unlocked,
    league: r.league,
    coins: s.coins,
    target,
    next,
    weekNet: r.weekNet,
    progress: target == null ? 1 : Math.min(1, Math.max(0, r.weekNet / target)),
    promoting: !!next && target != null && r.weekNet >= target,
    board,
    position,
    prizePosition: pPos,
    globalBoard: globalBoardFor(s, now),
    weekMatches: r.weekMatches,
    weekWins: r.weekWins,
    weekLosses: r.weekLosses,
    minWins: RANKED.minWinsForReward,
    msLeft: msToWeekEnd(now),
    estimate: { coins: base.coins + (pp?.coins ?? 0), cash: base.cash + (pp?.cash ?? 0), rays: eligible ? 1 : 0, label: pp?.label ?? null, eligible },
    season: r.season,
    total: r.total,
    stakes: RANKED.bets.map((bet) => {
      const st = matchStakes(r.league, bet);
      return { bet, ...st, affordable: s.coins >= st.entry };
    }),
    history: r.history,
  };
}

/** Mejor jugador de cada liga (tablas simuladas + el jugador en la suya). */
export function leagueLeaders(s: PlayerState, now: number): { league: RankId; top: BoardEntry }[] {
  const clock = botClockAt(now);
  return (Object.keys(RANKED.leagues) as RankId[]).map((id) => ({ league: id, top: boardFor(s, id, clock)[0] }));
}

// ---------------------------------------------------------------- datos guardados

const LEAGUES = new Set<string>(Object.keys(RANKED.leagues));
const int0 = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);
/** entero con signo (el neto semanal puede ser negativo) */
const intAny = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : 0);
const leagueOr = (v: unknown, def: RankId): RankId => (typeof v === 'string' && LEAGUES.has(v) ? (v as RankId) : def);
const statsOf = (v: unknown) => {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return { wins: int0(o.wins), losses: int0(o.losses), streak: int0(o.streak), bestStreak: int0(o.bestStreak) };
};

/** Valida datos guardados (migración). Lo inválido vuelve al valor inicial. */
export function sanitizeRanked(raw: unknown): PlayerState['ranked'] {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const leagueId = leagueOr(o.league, 'bronze');
  const p = o.pending as Record<string, unknown> | null | undefined;
  const pending =
    p && typeof p === 'object' && typeof p.matchId === 'string' && p.matchId
      ? { matchId: p.matchId, league: leagueOr(p.league, leagueId), bet: int0(p.bet) || 1, entry: int0(p.entry), prize: int0(p.prize), startedAt: int0(p.startedAt) }
      : null;
  const rewards: WeeklyReward[] = (Array.isArray(o.rewards) ? o.rewards : [])
    .filter((w): w is Record<string, unknown> => !!w && typeof w === 'object' && typeof (w as Record<string, unknown>).week === 'string')
    .slice(-8)
    .map((w) => ({
      week: w.week as string,
      league: leagueOr(w.league, leagueId),
      matches: int0(w.matches),
      wins: int0(w.wins),
      net: intAny(w.net),
      eligible: !!w.eligible,
      promotedTo: typeof w.promotedTo === 'string' && LEAGUES.has(w.promotedTo) ? (w.promotedTo as RankId) : null,
      position: typeof w.position === 'number' && w.position > 0 ? Math.floor(w.position) : null,
      coins: int0(w.coins),
      cash: int0(w.cash),
      rays: int0(w.rays),
      positionLabel: typeof w.positionLabel === 'string' ? w.positionLabel : null,
      claimed: !!w.claimed,
    }));
  const d = o.demotion as Record<string, unknown> | null | undefined;
  const history: RankedMatchHistory[] = (Array.isArray(o.history) ? o.history : [])
    .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object')
    .filter((entry) => entry.outcome === 'win' || entry.outcome === 'loss')
    .map((entry) => ({
      outcome: entry.outcome as 'win' | 'loss',
      delta: typeof entry.delta === 'number' && Number.isFinite(entry.delta) ? Math.trunc(entry.delta) : 0,
      league: leagueOr(entry.league, leagueId),
      playedAt: int0(entry.playedAt),
    }))
    .slice(0, 20);
  return {
    unlocked: !!o.unlocked,
    league: leagueId,
    week: typeof o.week === 'string' ? o.week : '',
    month: typeof o.month === 'string' ? o.month : '',
    weekMatches: int0(o.weekMatches),
    weekNet: Math.max(0, intAny(o.weekNet)), // el neto de la liga nunca es negativo
    weekWins: int0(o.weekWins),
    weekLosses: int0(o.weekLosses),
    weekReachedAt: int0(o.weekReachedAt),
    season: statsOf(o.season),
    total: statsOf(o.total),
    pending,
    history,
    settled: Array.isArray(o.settled) ? o.settled.filter((x): x is string => typeof x === 'string').slice(-RANKED.maxMatchIds) : [],
    rewards,
    seenLeague: leagueOr(o.seenLeague, leagueId),
    // la mejor liga nunca es menor que la actual
    bestLeague: ((b: RankId) => (LEAGUE_ORDER.indexOf(b) >= LEAGUE_ORDER.indexOf(leagueId) ? b : leagueId))(leagueOr(o.bestLeague, leagueId)),
    demotion: d && typeof d === 'object' ? { from: leagueOr(d.from, leagueId), to: leagueOr(d.to, leagueId), coinsCut: int0(d.coinsCut) } : null,
  };
}
