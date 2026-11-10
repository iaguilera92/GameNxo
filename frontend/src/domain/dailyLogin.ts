/**
 * RECOMPENSA POR INICIAR SESIÓN — lógica pura (sin Phaser). Nunca se abre sola: el jugador la reclama
 * desde el botón del menú (que se marca en dorado cuando hay algo que reclamar).
 *
 * - Un premio por día (mismo ciclo diario que las ruletas: corte 23:59 hora de Chile).
 * - Racha de 7 días: reclamar días seguidos avanza la racha; saltarse un día vuelve al día 1.
 * - Idempotente: reclamar dos veces el mismo día no entrega nada.
 */
import { cycleIdAt } from './dailyWheel';
import { type LoginState, type PlayerState, clonePlayer } from './player';

export type { LoginState } from './player';

export type LoginReward = { coins: number; cash: number };

export const LOGIN = {
  /** premios de la racha (día 1..7); tras el 7 vuelve a empezar */
  rewards: [
    { coins: 250, cash: 0 },
    { coins: 300, cash: 0 },
    { coins: 400, cash: 0 },
    { coins: 500, cash: 5 },
    { coins: 600, cash: 0 },
    { coins: 800, cash: 0 },
    { coins: 1_500, cash: 10 },
  ] as LoginReward[],
};

const prevDay = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d - 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
};

/** Día de la racha que toca hoy (1..7) y si ya se reclamó. */
export function loginStatus(s: PlayerState, now: number): { day: number; claimed: boolean; reward: LoginReward } {
  const today = cycleIdAt(now);
  const L = s.login;
  const n = LOGIN.rewards.length;
  if (L.last === today) return { day: L.streak, claimed: true, reward: LOGIN.rewards[L.streak - 1] };
  const continues = L.last && L.last === prevDay(today) && L.streak > 0;
  const day = continues ? (L.streak % n) + 1 : 1;
  return { day, claimed: false, reward: LOGIN.rewards[day - 1] };
}

export function claimLogin(s: PlayerState, now: number): { ok: true; state: PlayerState; given: LoginReward | null; day: number } {
  const st = loginStatus(s, now);
  if (st.claimed) return { ok: true, state: s, given: null, day: st.day };
  const n = clonePlayer(s);
  n.coins += st.reward.coins;
  n.gems += st.reward.cash;
  n.login = { last: cycleIdAt(now), streak: st.day };
  return { ok: true, state: n, given: st.reward, day: st.day };
}

/** Duplica el premio diario tras completar un anuncio; solo una vez por día y después del reclamo base. */
export function claimLoginAdBonus(s: PlayerState, now: number): { state: PlayerState; given: LoginReward | null } {
  const today = cycleIdAt(now);
  const st = loginStatus(s, now);
  if (!st.claimed || s.login.adBonusDay === today) return { state: s, given: null };
  const n = clonePlayer(s);
  n.coins += st.reward.coins;
  n.gems += st.reward.cash;
  n.login.adBonusDay = today;
  return { state: n, given: st.reward };
}

export function sanitizeLogin(raw: unknown): LoginState {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const streak = typeof o.streak === 'number' && Number.isFinite(o.streak) ? Math.min(LOGIN.rewards.length, Math.max(0, Math.floor(o.streak))) : 0;
  return {
    last: typeof o.last === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.last) ? o.last : '',
    streak,
    adBonusDay: typeof o.adBonusDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.adBonusDay) ? o.adBonusDay : '',
  };
}
