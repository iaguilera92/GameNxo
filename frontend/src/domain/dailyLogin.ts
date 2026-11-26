/**
 * RECOMPENSA POR INICIAR SESIÓN — lógica pura (sin Phaser). Nunca se abre sola: el jugador la reclama
 * desde el botón del menú (que se marca en dorado cuando hay algo que reclamar).
 *
 * - Calendario SEMANAL (11-11-2026): los 7 premios son los días de la semana en curso, de LUNES a DOMINGO (mismo ciclo
 *   diario que las ruletas: corte 23:59 hora de Chile). Hoy se reclama el premio de hoy; un día pasado sin reclamar
 *   queda perdido. El lunes empieza una semana nueva con todo por reclamar.
 * - Idempotente: reclamar dos veces el mismo día no entrega nada.
 */
import { cycleIdAt } from './dailyWheel';
import { type LoginState, type PlayerState, clonePlayer } from './player';

export type { LoginState } from './player';

/** (26-11-2026, usuario) `coins2v2`: monedas de la liga 2V2 (algunos días) */
export type LoginReward = { coins: number; cash: number; coins2v2?: number };

export const LOGIN = {
  /** premio de cada día de la semana (lunes … domingo) */
  rewards: [
    // (26-11-2026, usuario) DINERO 2 días (jueves y domingo: es el premio principal); MONEDAS 2V2 3 días (martes y viernes como
    // principal; el sábado como secundario, junto a las monedas)
    { coins: 250, cash: 0 },
    { coins: 0, cash: 0, coins2v2: 30 },
    { coins: 400, cash: 0 },
    { coins: 500, cash: 5 },
    { coins: 0, cash: 0, coins2v2: 60 },
    { coins: 800, cash: 0, coins2v2: 30 },
    // domingo: vale más que los otros 6 días juntos (2.850), para volver el último día de la semana (docs/ECONOMIA.md)
    { coins: 3_500, cash: 10 },
  ] as LoginReward[],
};

const addDays = (day: string, n: number) => {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
};

/** Semana del día de juego `now`: su lunes (id), el índice de hoy (0 = lunes … 6 = domingo) y los 7 días con su fecha. */
export function loginWeek(now: number): { week: string; today: string; index: number; days: { id: string; date: number }[] } {
  const today = cycleIdAt(now);
  const [y, m, d] = today.split('-').map(Number);
  const index = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // getUTCDay: 0 = domingo
  const week = addDays(today, -index);
  const days = Array.from({ length: 7 }, (_, i) => {
    const id = addDays(week, i);
    return { id, date: Number(id.slice(8)) };
  });
  return { week, today, index, days };
}

/**
 * Premio de hoy: `day` = día de la semana (1 = lunes … 7 = domingo), si ya se reclamó, el premio, y la semana con los
 * días ya reclamados (`claimedDays`, índices 0..6).
 */
export function loginStatus(s: PlayerState, now: number) {
  const wk = loginWeek(now);
  const L = s.login;
  const claimedDays = L.week === wk.week ? [...(L.days ?? [])] : [];
  const claimed = claimedDays.includes(wk.index);
  return { day: wk.index + 1, claimed, reward: LOGIN.rewards[wk.index], week: wk, claimedDays };
}

/** (26-11-2026, usuario) el PRIMER premio diario (guía del nivel 3) es siempre este, sea el día que sea: 500 monedas + 5 de dinero */
export const TUTORIAL_LOGIN_REWARD: LoginReward = { coins: 500, cash: 5 };

export function claimLogin(s: PlayerState, now: number, override?: LoginReward): { ok: true; state: PlayerState; given: LoginReward | null; day: number } {
  const st0 = loginStatus(s, now);
  const st = override ? { ...st0, reward: override } : st0;
  if (st.claimed) return { ok: true, state: s, given: null, day: st.day };
  const n = clonePlayer(s);
  n.coins += st.reward.coins;
  n.gems += st.reward.cash;
  if (st.reward.coins2v2) n.coins2v2 = (n.coins2v2 ?? 0) + st.reward.coins2v2;
  const days = [...st.claimedDays, st.week.index];
  n.login = { ...n.login, last: st.week.today, week: st.week.week, days, streak: days.length };
  return { ok: true, state: n, given: st.reward, day: st.day };
}

/** Duplica el premio diario tras completar un anuncio; solo una vez por día y después del reclamo base. */
export function claimLoginAdBonus(s: PlayerState, now: number, override?: LoginReward): { state: PlayerState; given: LoginReward | null } {
  const today = cycleIdAt(now);
  const st0 = loginStatus(s, now);
  const st = override ? { ...st0, reward: override } : st0;
  if (!st.claimed || s.login.adBonusDay === today) return { state: s, given: null };
  const n = clonePlayer(s);
  n.coins += st.reward.coins;
  n.gems += st.reward.cash;
  if (st.reward.coins2v2) n.coins2v2 = (n.coins2v2 ?? 0) + st.reward.coins2v2;
  n.login.adBonusDay = today;
  return { state: n, given: st.reward };
}

export function sanitizeLogin(raw: unknown): LoginState {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const streak = typeof o.streak === 'number' && Number.isFinite(o.streak) ? Math.min(LOGIN.rewards.length, Math.max(0, Math.floor(o.streak))) : 0;
  const days = Array.isArray(o.days) ? [...new Set(o.days.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))] : [];
  return {
    last: typeof o.last === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.last) ? o.last : '',
    streak,
    adBonusDay: typeof o.adBonusDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.adBonusDay) ? o.adBonusDay : '',
    week: typeof o.week === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.week) ? o.week : '',
    days,
  };
}
