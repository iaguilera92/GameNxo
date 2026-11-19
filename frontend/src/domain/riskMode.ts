/**
 * MODO RIESGO x2 — evento semanal de Ranked (lógica pura, sin Phaser ni DOM).
 *
 * Reglas (pedido del usuario, 18-11-2026):
 *  - Solo se activa los LUNES (ciclo diario de Chile, mismo corte 23:59 que la semana Ranked), a mano, UNA vez por semana.
 *  - Dura RISK_MODE.durationMs desde la activación, sin pausa: se calcula con la hora de activación, no con un contador
 *    (cerrar el juego o perder la conexión no lo detiene). Al terminar se apaga solo hasta el lunes siguiente.
 *  - Mientras está activo, las apuestas Ranked que EMPIEZAN valen x2 (entrada y premio): `enterRanked` lo fija en la
 *    partida pendiente (`pending.risk`), así se aplica una sola vez y la liquidación no lo vuelve a calcular.
 *  - Nada fuera de Ranked lo usa (ruletas, premios diarios, recompensas semanales: x1 siempre).
 *
 * La autoridad es el servidor (backend/src/risk/riskMode.ts, mismas reglas): el cliente solo guarda la activación que el
 * servidor confirmó (`applyServerRisk`). El multiplicador nunca llega de la pantalla: lo deduce esta función con la hora.
 */
import { cycleIdAt } from './dailyWheel';
import { type PlayerState, clonePlayer } from './player';

export const RISK_MODE = {
  /** 10 minutos exactos */
  durationMs: 10 * 60_000,
  multiplier: 2,
} as const;

/** Última activación (va con la cuenta, en PlayerState.riskMode). */
export interface RiskModeState {
  /** semana Ranked (lunes AAAA-MM-DD) de la activación */
  week: string;
  /** hora de activación (ms, hora del servidor) */
  activatedAt: number;
}

export type RiskPhase = 'available' | 'active' | 'used' | 'closed';

export interface RiskStatus {
  /** available = lunes y sin usar · active = corriendo · used = ya se usó esta semana · closed = hoy no es lunes */
  phase: RiskPhase;
  /** multiplicador de las apuestas Ranked que empiecen ahora */
  multiplier: number;
  /** ms que quedan del evento (solo active) */
  msLeft: number;
  endsAt: number | null;
}

const DAY = 86_400_000;
const utcOfDay = (id: string) => {
  const [y, m, d] = id.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const dayIdOf = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Lunes (AAAA-MM-DD) de la semana del ciclo diario de `ms` (igual que ranked.weekIdAt). */
export function riskWeekAt(ms: number): string {
  const t = utcOfDay(cycleIdAt(ms));
  return dayIdOf(t - ((new Date(t).getUTCDay() + 6) % 7) * DAY);
}

/** ¿El ciclo diario de `ms` es lunes? */
export const isRiskDay = (ms: number) => new Date(utcOfDay(cycleIdAt(ms))).getUTCDay() === 1;

/** Estado del evento en `now`. */
export function riskStatus(st: RiskModeState | null | undefined, now: number): RiskStatus {
  // una activación solo vale si cae en lunes y en su semana (datos editados a mano no activan nada)
  if (st && st.activatedAt > 0 && isRiskDay(st.activatedAt) && st.week === riskWeekAt(st.activatedAt)) {
    const endsAt = st.activatedAt + RISK_MODE.durationMs;
    if (now >= st.activatedAt && now < endsAt) return { phase: 'active', multiplier: RISK_MODE.multiplier, msLeft: endsAt - now, endsAt };
    if (st.week === riskWeekAt(now)) return { phase: isRiskDay(now) ? 'used' : 'closed', multiplier: 1, msLeft: 0, endsAt };
  }
  return { phase: isRiskDay(now) ? 'available' : 'closed', multiplier: 1, msLeft: 0, endsAt: null };
}

/** Multiplicador de una apuesta Ranked que empieza en `now`. */
export const riskMultiplierAt = (st: RiskModeState | null | undefined, now: number) => riskStatus(st, now).multiplier;

export type RiskError = 'not_monday' | 'already_used' | 'active';

/** Comprueba y crea la activación (la misma función corre en el servidor). */
export function activateRisk(st: RiskModeState | null | undefined, now: number): { ok: true; state: RiskModeState } | { ok: false; error: RiskError } {
  const s = riskStatus(st, now);
  if (s.phase === 'active') return { ok: false, error: 'active' };
  if (s.phase === 'used' || (st && st.week === riskWeekAt(now))) return { ok: false, error: 'already_used' };
  if (s.phase !== 'available') return { ok: false, error: 'not_monday' };
  return { ok: true, state: { week: riskWeekAt(now), activatedAt: now } };
}

/** Valida lo guardado (o lo que manda el servidor). */
export function sanitizeRisk(raw: unknown): RiskModeState | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.week !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.week)) return null;
  if (typeof o.activatedAt !== 'number' || !Number.isFinite(o.activatedAt) || o.activatedAt <= 0) return null;
  return { week: o.week, activatedAt: Math.floor(o.activatedAt) };
}

/**
 * Guarda en la cuenta lo que dice el SERVIDOR (autoridad): su activación sustituye a la local, aunque sea "ninguna".
 * Pura: devuelve el mismo objeto si no cambia nada.
 */
export function applyServerRisk(s: PlayerState, raw: unknown): PlayerState {
  const st = sanitizeRisk(raw);
  const cur = s.riskMode;
  if (st?.week === cur?.week && st?.activatedAt === cur?.activatedAt) return s;
  const n = clonePlayer(s);
  if (st) n.riskMode = st;
  else delete n.riskMode;
  return n;
}

/** mm:ss */
export function formatRiskLeft(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000)); // (18-11-2026) al activarlo se ve 9:59 enseguida y termina en 0:00
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
