/**
 * Defensa de los mensajes que llegan de los clientes (el servidor solo los reenvía, pero no debe reenviar basura):
 *  - sanitize*: reconstruye cada mensaje solo con los campos conocidos, con tipos y rangos válidos.
 *    Devuelve null si el mensaje no sirve (se descarta, no se reenvía).
 *  - SocketLimiter: límite de mensajes por segundo y por tipo (cubo de fichas). Un cliente que se pasa mucho
 *    de forma sostenida se desconecta.
 * Lógica pura (sin Socket.IO) para poder probarla: test/guard.test.ts.
 */
import type { ActionKind, ActionMsg, BallWire, HitMsg, PointMsg, StateMsg } from './events/protocol.js';

/** límite de magnitud de cualquier número (las coordenadas reales son de cientos) */
const LIM = 1e5;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.max(-LIM, Math.min(LIM, v)) : null);
const str = (v: unknown, max: number): string | null => (typeof v === 'string' ? v.slice(0, max) : null);

export function sanitizeState(d: unknown): StateMsg | null {
  if (!isObj(d)) return null;
  const x = num(d.x);
  const y = num(d.y);
  if (x === null || y === null) return null;
  return {
    t: num(d.t) ?? 0,
    x,
    y,
    moving: d.moving === true,
    dirX: num(d.dirX) ?? 0,
    facing: num(d.facing) ?? 1,
    charging: d.charging === true,
    stunned: d.stunned === true,
  };
}

function sanitizeBall(b: unknown): BallWire | null {
  if (!isObj(b)) return null;
  const x = num(b.x), y = num(b.y), z = num(b.z), vx = num(b.vx), vy = num(b.vy), vz = num(b.vz);
  if (x === null || y === null || z === null || vx === null || vy === null || vz === null) return null;
  const out: BallWire = { x, y, z, vx, vy, vz };
  const damp = num(b.damp), fric = num(b.fric), ay = num(b.ay);
  if (damp !== null) out.damp = damp;
  if (fric !== null) out.fric = fric;
  if (ay !== null) out.ay = ay;
  return out;
}

export function sanitizeHit(d: unknown): HitMsg | null {
  if (!isObj(d)) return null;
  const seq = num(d.seq);
  const ball = sanitizeBall(d.ball);
  const x = num(d.x);
  const y = num(d.y);
  if (seq === null || !ball || x === null || y === null) return null;
  if (d.kind !== 'hit' && d.kind !== 'serve') return null;
  const out: HitMsg = {
    seq: Math.floor(seq),
    kind: d.kind,
    ball,
    x,
    y,
    shotKind: str(d.shotKind, 16) ?? 'normal',
    power: d.power === true,
    inferno: d.inferno === true,
    charged: d.charged === true,
    overhead: d.overhead === true,
    volley: d.volley === true,
  };
  if (d.special === true) out.special = true;
  if (d.shock === true) out.shock = true;
  if (d.serveSpin === true) out.serveSpin = true;
  if (d.impact === true) out.impact = true;
  const lunge = num(d.lunge);
  if (lunge !== null && lunge !== 0) out.lunge = Math.sign(lunge);
  return out;
}

const ACTIONS = new Set<ActionKind>(['toss', 'catch', 'sprint-start', 'sprint-end', 'stunned', 'emote', 'smash-armed', 'smash-disarmed', 'smash-cine', 'inferno-cine']);

export function sanitizeAction(d: unknown): ActionMsg | null {
  if (!isObj(d) || typeof d.kind !== 'string' || !ACTIONS.has(d.kind as ActionKind)) return null;
  const out: ActionMsg = { kind: d.kind as ActionKind };
  if (isObj(d.data)) {
    const data: Record<string, number | string | boolean> = {};
    let n = 0;
    for (const [k, v] of Object.entries(d.data)) {
      if (++n > 12) break;
      const key = k.slice(0, 24);
      if (typeof v === 'number') {
        const c = num(v);
        if (c !== null) data[key] = c;
      } else if (typeof v === 'string') data[key] = v.slice(0, 32);
      else if (typeof v === 'boolean') data[key] = v;
    }
    out.data = data;
  }
  return out;
}

export function sanitizePoint(d: unknown): PointMsg | null {
  if (!isObj(d)) return null;
  const seq = num(d.seq);
  if (seq === null) return null;
  if (d.kind !== 'point' && d.kind !== 'fault' && d.kind !== 'let') return null;
  if (d.to !== 'me' && d.to !== 'opponent') return null;
  const out: PointMsg = { seq: Math.floor(seq), kind: d.kind, to: d.to, reason: str(d.reason, 60) ?? '', color: str(d.color, 16) ?? '' };
  if (Array.isArray(d.games) && d.games.length === 2) {
    const a = num(d.games[0]);
    const b = num(d.games[1]);
    if (a !== null && b !== null) out.games = [Math.floor(a), Math.floor(b)];
  }
  return out;
}

// ------------------------------------------------------------------ límite de mensajes

/** mensajes por segundo (rate) y ráfaga permitida (burst) de cada tipo */
export const LIMITS = {
  state: { rate: 30, burst: 40 }, // el cliente manda ~20/s
  hit: { rate: 8, burst: 12 },
  action: { rate: 15, burst: 25 },
  point: { rate: 4, burst: 8 },
  ctl: { rate: 2, burst: 6 }, // buscar, cancelar, listo, salir
} as const;
export type LimitKey = keyof typeof LIMITS;

/** pasado este número de mensajes descartados en una ventana, el cliente se considera abusivo */
const STRIKE_LIMIT = 300;
const STRIKE_WINDOW_MS = 10_000;

export class SocketLimiter {
  private buckets = new Map<LimitKey, { tokens: number; at: number }>();
  private strikes = 0;
  private windowAt = 0;

  /** true = el mensaje pasa. `abusive()` dice si hay que cortar la conexión. */
  allow(key: LimitKey, now: number): boolean {
    const cfg = LIMITS[key];
    const b = this.buckets.get(key) ?? { tokens: cfg.burst, at: now };
    b.tokens = Math.min(cfg.burst, b.tokens + ((now - b.at) / 1000) * cfg.rate);
    b.at = now;
    this.buckets.set(key, b);
    if (b.tokens >= 1) {
      b.tokens -= 1;
      return true;
    }
    if (now - this.windowAt > STRIKE_WINDOW_MS) {
      this.windowAt = now;
      this.strikes = 0;
    }
    this.strikes++;
    return false;
  }

  abusive(): boolean {
    return this.strikes > STRIKE_LIMIT;
  }
}
