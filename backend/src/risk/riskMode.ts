/**
 * MODO RIESGO x2 (servidor = autoridad). Mismas reglas que frontend/src/domain/riskMode.ts
 * (test/riskMode.test.ts comprueba que los dos dan lo mismo):
 *  - solo los LUNES (ciclo diario de America/Santiago, corte 23:59, igual que la semana Ranked); UNA activación por semana;
 *  - dura 10 minutos desde la hora de activación del SERVIDOR (no se pausa: el tiempo es una resta de horas);
 *  - `stake`: fija el multiplicador de una partida Ranked al empezarla, una sola vez por id (repetir devuelve lo mismo:
 *    sin pagos dobles ni "subir" una partida empezada antes del evento).
 *
 * Persistencia: archivo JSON (RISK_DATA_FILE; por defecto data/risk-mode.json) escrito de forma atómica (tmp + rename).
 * Cada operación comprueba y escribe en el mismo turno síncrono de Node (un solo proceso): no hay carreras entre
 * dos activaciones simultáneas. Cuando exista la base de datos (docs/RANKED-V2.md), esto pasa a una tabla con
 * UNIQUE (account_id, week_id).
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export const RISK_MODE = { durationMs: 10 * 60_000, multiplier: 2, timeZone: 'America/Santiago', resetHour: 23, resetMinute: 59 } as const;

// ---------------------------------------------------------------- calendario (Chile, corte 23:59)

let fmt: Intl.DateTimeFormat | null = null;
function chileParts(ms: number) {
  fmt ??= new Intl.DateTimeFormat('en-CA', { timeZone: RISK_MODE.timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const p: Record<string, number> = {};
  for (const x of fmt.formatToParts(new Date(ms))) if (x.type !== 'literal') p[x.type] = Number(x.value);
  return { y: p.year, m: p.month, d: p.day, h: p.hour % 24, min: p.minute };
}

/** Día del ciclo (AAAA-MM-DD). Desde las 23:59 de Chile ya es el día siguiente (igual que frontend cycleIdAt). */
export function cycleIdAt(ms: number): string {
  const c = chileParts(ms);
  const p = chileParts(ms - 3600_000);
  const wall = (x: typeof c) => Date.UTC(x.y, x.m - 1, x.d, x.h, x.min) / 60000;
  const repeated = wall(c) - wall(p) < 59;
  let { y, m, d } = c;
  if (c.h > RISK_MODE.resetHour || (c.h === RISK_MODE.resetHour && (c.min >= RISK_MODE.resetMinute || repeated))) {
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    y = next.getUTCFullYear();
    m = next.getUTCMonth() + 1;
    d = next.getUTCDate();
  }
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const DAY = 86_400_000;
const utcOfDay = (id: string) => {
  const [y, m, d] = id.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
export function riskWeekAt(ms: number): string {
  const t = utcOfDay(cycleIdAt(ms));
  return new Date(t - ((new Date(t).getUTCDay() + 6) % 7) * DAY).toISOString().slice(0, 10);
}
export const isRiskDay = (ms: number) => new Date(utcOfDay(cycleIdAt(ms))).getUTCDay() === 1;

// ---------------------------------------------------------------- reglas

export interface RiskRecord {
  week: string;
  activatedAt: number;
}
export type RiskPhase = 'available' | 'active' | 'used' | 'closed';
export interface RiskStatus {
  phase: RiskPhase;
  multiplier: number;
  msLeft: number;
  endsAt: number | null;
}

export function riskStatus(st: RiskRecord | null | undefined, now: number): RiskStatus {
  // una activación solo vale si cae en lunes y en su semana (datos editados a mano no activan nada)
  if (st && st.activatedAt > 0 && isRiskDay(st.activatedAt) && st.week === riskWeekAt(st.activatedAt)) {
    const endsAt = st.activatedAt + RISK_MODE.durationMs;
    if (now >= st.activatedAt && now < endsAt) return { phase: 'active', multiplier: RISK_MODE.multiplier, msLeft: endsAt - now, endsAt };
    if (st.week === riskWeekAt(now)) return { phase: isRiskDay(now) ? 'used' : 'closed', multiplier: 1, msLeft: 0, endsAt };
  }
  return { phase: isRiskDay(now) ? 'available' : 'closed', multiplier: 1, msLeft: 0, endsAt: null };
}

export type RiskError = 'not_monday' | 'already_used' | 'active';

// ---------------------------------------------------------------- almacén

interface Account {
  risk: RiskRecord | null;
  /** multiplicador fijado por partida Ranked (idempotencia); se guardan las últimas MAX_STAKES */
  stakes: Record<string, { mult: number; at: number }>;
}
const MAX_STAKES = 50;
export const isPlayerId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(v);

export class RiskStore {
  private data = new Map<string, Account>();
  constructor(
    private readonly file: string | null,
    private readonly clock: () => number = Date.now,
  ) {
    if (!file) return;
    try {
      const raw = JSON.parse(readFileSync(file, 'utf8')) as Record<string, Account>;
      for (const [id, a] of Object.entries(raw)) if (isPlayerId(id) && a && typeof a === 'object') this.data.set(id, { risk: a.risk ?? null, stakes: a.stakes ?? {} });
    } catch {
      /* sin archivo todavía */
    }
  }

  private save() {
    if (!this.file) return;
    mkdirSync(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(Object.fromEntries(this.data)));
    renameSync(tmp, this.file); // atómico: nunca queda un archivo a medias
  }

  private acc(id: string): Account {
    let a = this.data.get(id);
    if (!a) this.data.set(id, (a = { risk: null, stakes: {} }));
    return a;
  }

  status(id: string) {
    const now = this.clock();
    const risk = this.data.get(id)?.risk ?? null;
    return { now, risk, ...riskStatus(risk, now) };
  }

  /** Activa (una vez por semana, solo lunes). Comprobación y escritura en el mismo turno: atómico. */
  activate(id: string): ({ ok: true } & ReturnType<RiskStore['status']>) | { ok: false; error: RiskError; now: number; risk: RiskRecord | null } {
    const now = this.clock();
    const a = this.acc(id);
    const s = riskStatus(a.risk, now);
    if (s.phase === 'active') return { ok: false, error: 'active', now, risk: a.risk };
    if (s.phase === 'used' || a.risk?.week === riskWeekAt(now)) return { ok: false, error: 'already_used', now, risk: a.risk };
    if (s.phase !== 'available') return { ok: false, error: 'not_monday', now, risk: a.risk };
    a.risk = { week: riskWeekAt(now), activatedAt: now };
    this.save();
    return { ok: true, ...this.status(id) };
  }

  /**
   * Multiplicador de una partida Ranked que empieza ahora. La PRIMERA llamada con ese `matchId` lo fija; las
   * siguientes devuelven el mismo (aunque el evento ya haya empezado o terminado): se aplica una sola vez.
   */
  stake(id: string, matchId: string): { mult: number; duplicate: boolean } {
    const a = this.acc(id);
    const prev = a.stakes[matchId];
    if (prev) return { mult: prev.mult, duplicate: true };
    const now = this.clock();
    const mult = riskStatus(a.risk, now).multiplier;
    a.stakes[matchId] = { mult, at: now };
    const keys = Object.keys(a.stakes);
    if (keys.length > MAX_STAKES) for (const k of keys.sort((x, y) => a.stakes[x].at - a.stakes[y].at).slice(0, keys.length - MAX_STAKES)) delete a.stakes[k];
    this.save();
    return { mult, duplicate: false };
  }

  /** Liquidación Ranked con el multiplicador FIJADO al entrar (`baseEntry` y `basePrize` sin multiplicar). */
  settle(id: string, matchId: string, baseEntry: number, basePrize: number, win: boolean) {
    const mult = this.data.get(id)?.stakes[matchId]?.mult ?? 1;
    const entry = baseEntry * mult;
    const prize = win ? basePrize * mult : 0;
    return { mult, entry, prize, delta: prize - entry };
  }
}
