/**
 * MODO RIESGO x2: llamadas al servidor (autoridad; backend/src/api/riskRoutes.ts). Sin servidor no se puede activar.
 * Id del jugador: hasta que existan cuentas, un id aleatorio de este dispositivo (uno aparte para el perfil de pruebas).
 */
import { serverUrl } from './config';
import { isDevMode } from '../domain/devMode';

const KEY = 'gamenxo.deviceId';

export function riskPlayerId(): string {
  const key = isDevMode() ? `${KEY}.dev` : KEY;
  try {
    const old = localStorage.getItem(key);
    if (old && /^[A-Za-z0-9_-]{8,64}$/.test(old)) return old;
    const c = globalThis.crypto;
    const id = c?.randomUUID ? c.randomUUID().replace(/-/g, '') : `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem(key, id);
    return id;
  } catch {
    return 'sin-almacenamiento';
  }
}

export interface RiskServerReply {
  ok: boolean;
  error?: string;
  /** hora del servidor (ms) */
  now: number;
  /** activación registrada (null = nunca) */
  risk: unknown;
}

async function call(path: string, method: 'GET' | 'POST'): Promise<RiskServerReply | null> {
  const base = serverUrl();
  if (!base) return null;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 6000);
  try {
    const res = await fetch(`${base}/api/risk-mode/${encodeURIComponent(riskPlayerId())}${path}`, { method, signal: ctl.signal });
    const body = (await res.json()) as RiskServerReply;
    return typeof body?.now === 'number' ? body : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Estado según el servidor (null = sin conexión). */
export const fetchRisk = () => call('', 'GET');
/** Pide activar (null = sin conexión). */
export const postRiskActivate = () => call('/activate', 'POST');
