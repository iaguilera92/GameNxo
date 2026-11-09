/**
 * RANKED — lógica pura (estado -> nuevo estado + resultado). Sin Phaser ni DOM.
 * Igual que operations.ts: con backend, el SERVIDOR ejecutará estas funciones (descontar entradas, liquidar
 * partidas, cerrar semanas y meses). El cliente solo las llama mientras no exista servidor.
 *
 * Reglas (configuración en rankedConfig.ts, documentación en docs/RANKED.md):
 *  - Se desbloquea en el nivel RANKED.unlockLevel; se empieza en Bronce.
 *  - Entrar paga la entrada (× apuesta). Ganar paga entrada × prizeMult. Perder: nada.
 *  - La clasificación de la liga es el SALDO de monedas. Al terminar una partida con saldo >= objetivo
 *    de la liga se asciende (puede encadenar varias ligas).
 *  - Semana (lunes 00:00 hora de Chile, mismo corte 23:59 que las ruletas): con >= minMatchesForReward
 *    partidas completadas (ganadas o perdidas; no rendición ni abandono) se gana la recompensa de la liga
 *    + premio por posición. Se calcula al cerrar la semana y se cobra con un botón (una sola vez).
 *  - Mes: se baja de liga según `demoteTo` y, si se bajó, el saldo se recorta al tope de la nueva liga.
 *  - Abandono: una partida con entrada pagada que no se liquidó (app cerrada) se pierde y no cuenta.
 *  - Todo es idempotente por id de partida / id de semana.
 */
import { cycleIdAt, msToNextReset } from './dailyWheel';
import { type PlayerState, clonePlayer } from './player';
import { RANKED, demotionCap, league, matchStakes, nextLeague, positionPrize } from './rankedConfig';
import { type BoardEntry, type BotClock, buildBoard, prizePosition } from './rankedBots';
import { type RankedOutcome, type WeeklyReward, newStats } from './rankedState';
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
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

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

/** Reloj de los bots en un instante. */
export function botClockAt(ms: number): BotClock {
  const day = cycleIdAt(ms);
  const { y, m, d } = parseDay(day);
  const frac = Math.min(1, Math.max(0, 1 - msToNextReset(ms) / DAY));
  return { month: day.slice(0, 7), progress: (d - 1 + frac) / daysInMonth(y, m), tick: Math.floor(ms / 3_600_000) };
}

/** Reloj de los bots al final de una semana (último día completo). */
export function botClockWeekEnd(week: string): BotClock {
  const { y, m, d } = parseDay(week);
  const last = dayId(Date.UTC(y, m - 1, d) + 6 * DAY);
  const L = parseDay(last);
  return { month: last.slice(0, 7), progress: L.d / daysInMonth(L.y, L.m), tick: Math.floor((Date.UTC(L.y, L.m - 1, L.d) + DAY) / 3_600_000) };
}

// ---------------------------------------------------------------- tabla

export function playerEntry(s: PlayerState): Omit<BoardEntry, 'position'> {
  return {
    id: ME,
    name: s.name,
    bot: false,
    level: s.level,
    coins: s.coins,
    wins: s.ranked.season.wins,
    losses: s.ranked.season.losses,
    avatar: { skin: s.equipped.skin === 'mai' ? 'mai' : 'nxo', color: 0xffc42e },
  };
}

/** Tabla de una liga. El jugador solo aparece en la suya. */
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
  const eligible = r.weekMatches >= RANKED.minMatchesForReward;
  const board = boardFor(s, r.league, botClockWeekEnd(week));
  const position = board.find((e) => e.id === ME)?.position ?? null;
  const pp = positionPrize(prizePosition(board, ME));
  const base = league(r.league).weekly;
  return {
    week,
    league: r.league,
    matches: r.weekMatches,
    eligible,
    position,
    coins: eligible ? base.coins + (pp?.coins ?? 0) : 0,
    cash: eligible ? base.cash + (pp?.cash ?? 0) : 0,
    positionLabel: pp?.label ?? null,
    claimed: false,
  };
}

/**
 * Pone Ranked al día con `now`: desbloqueo, cierre de semana (recompensa) y de mes (descenso).
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
    if (r.weekMatches > 0) r.rewards.push(weeklyReward(n, r.week));
    if (r.rewards.length > 8) r.rewards.splice(0, r.rewards.length - 8);
    r.weekMatches = 0;
    r.season = newStats();
  }
  if (r.month && month > r.month) {
    const from = r.league;
    const to = league(from).demoteTo;
    if (to !== from) {
      const cap = demotionCap(to);
      const cut = cap != null && n.coins > cap ? n.coins - cap : 0;
      n.coins -= cut;
      r.league = to;
      r.seenLeague = to;
      r.demotion = { from, to, coinsCut: cut };
    }
  }
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
  if (n0.coins < entry) return fail('not_enough_coins');
  const n = clonePlayer(n0);
  n.coins -= entry;
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

/** Liquida la partida pendiente. Idempotente: repetir con el mismo id no paga dos veces. */
export function settleRanked(s: PlayerState, matchId: string, outcome: RankedOutcome, now: number): RankedResult<{ settlement: Settlement }> {
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
  const win = outcome === 'win';
  const counted = outcome === 'win' || outcome === 'loss';
  const prize = win ? p.prize : 0;
  n.coins += prize;
  if (counted) {
    r.weekMatches++;
    for (const st of [r.season, r.total]) {
      if (win) st.wins++;
      else st.losses++;
      st.streak = win ? st.streak + 1 : 0;
      st.bestStreak = Math.max(st.bestStreak, st.streak);
    }
  } else {
    r.season.streak = 0;
    r.total.streak = 0;
  }
  // ascenso: solo al terminar una partida (las monedas de ruletas/pase no ascienden sin jugar)
  const before = r.league;
  if (counted) {
    let nx = nextLeague(r.league);
    let t = league(r.league).target;
    while (nx && t != null && n.coins >= t) {
      r.league = nx;
      nx = nextLeague(r.league);
      t = league(r.league).target;
    }
  }
  const promotedTo = r.league !== before ? r.league : null;
  return { ok: true, state: n, settlement: { outcome, entry: p.entry, prize, delta: prize - p.entry, counted, league: r.league, promotedTo, duplicate: false } };
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
  coins: number;
  target: number | null;
  next: RankId | null;
  /** 0..1 hacia el objetivo de ascenso (1 en la liga máxima) */
  progress: number;
  board: BoardEntry[];
  position: number | null;
  weekMatches: number;
  minMatches: number;
  msLeft: number;
  /** recompensa semanal estimada si terminara ahora (0 si aún no cumple el mínimo) */
  estimate: { coins: number; cash: number; label: string | null; eligible: boolean };
  season: PlayerState['ranked']['season'];
  total: PlayerState['ranked']['total'];
  stakes: { bet: number; entry: number; prize: number; affordable: boolean }[];
}

export function rankedView(s0: PlayerState, now: number): RankedView {
  const s = syncRanked(s0, now);
  const r = s.ranked;
  const target = league(r.league).target;
  const board = boardFor(s, r.league, botClockAt(now));
  const position = board.find((e) => e.id === ME)?.position ?? null;
  const pp = positionPrize(prizePosition(board, ME));
  const eligible = r.weekMatches >= RANKED.minMatchesForReward;
  const base = league(r.league).weekly;
  return {
    unlocked: r.unlocked,
    league: r.league,
    coins: s.coins,
    target,
    next: nextLeague(r.league),
    progress: target == null ? 1 : Math.min(1, s.coins / target),
    board,
    position,
    weekMatches: r.weekMatches,
    minMatches: RANKED.minMatchesForReward,
    msLeft: msToWeekEnd(now),
    estimate: { coins: base.coins + (pp?.coins ?? 0), cash: base.cash + (pp?.cash ?? 0), label: pp?.label ?? null, eligible },
    season: r.season,
    total: r.total,
    stakes: RANKED.bets.map((bet) => {
      const st = matchStakes(r.league, bet);
      return { bet, ...st, affordable: s.coins >= st.entry };
    }),
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
      eligible: !!w.eligible,
      position: typeof w.position === 'number' && w.position > 0 ? Math.floor(w.position) : null,
      coins: int0(w.coins),
      cash: int0(w.cash),
      positionLabel: typeof w.positionLabel === 'string' ? w.positionLabel : null,
      claimed: !!w.claimed,
    }));
  const d = o.demotion as Record<string, unknown> | null | undefined;
  return {
    unlocked: !!o.unlocked,
    league: leagueId,
    week: typeof o.week === 'string' ? o.week : '',
    month: typeof o.month === 'string' ? o.month : '',
    weekMatches: int0(o.weekMatches),
    season: statsOf(o.season),
    total: statsOf(o.total),
    pending,
    settled: Array.isArray(o.settled) ? o.settled.filter((x): x is string => typeof x === 'string').slice(-RANKED.maxMatchIds) : [],
    rewards,
    seenLeague: leagueOr(o.seenLeague, leagueId),
    demotion: d && typeof d === 'object' ? { from: leagueOr(d.from, leagueId), to: leagueOr(d.to, leagueId), coinsCut: int0(d.coinsCut) } : null,
  };
}
