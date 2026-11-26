import { commit, getPlayer } from '../domain/playerStore';
import { gameClock, setServerTime } from '../domain/timeSource';
import * as risk from '../domain/riskMode';
import { fetchRisk, postRiskActivate } from '../net/riskApi';
import * as ranked from '../domain/ranked';
import * as login from '../domain/dailyLogin';
import * as shopGift from '../domain/shopGift';
import { playerRank } from '../domain/ranks';
import type { RankedOutcome } from '../domain/rankedState';
import { syncLeague2v2 } from './League2v2';

/**
 * Fachada de Ranked y del premio diario para las escenas: aplica las operaciones puras de
 * domain/ranked.ts y domain/dailyLogin.ts con la hora del juego y guarda con playerStore.
 * Con backend, estas funciones pasarán a llamar a la API (el servidor decide saldos y premios).
 */

const now = () => gameClock.now();

/** Arranque: una partida Ranked que quedó a medias (app cerrada) cuenta como abandono; cierra semana / mes. */
export function bootRanked() {
  const before = getPlayer();
  const after = ranked.abandonPending(before as never, now());
  if (after !== before) commit(() => ({ ok: true as const, state: after }));
  syncLeague2v2(); // LIGA 2v2: cierra su semana igual
}

/** Pone semana / mes / desbloqueo al día (y guarda si cambió). */
export function syncRanked() {
  const before = getPlayer();
  const after = ranked.syncRanked(before as never, now());
  if (after !== before) commit(() => ({ ok: true as const, state: after }));
}

export const rankedView = () => ranked.rankedView(getPlayer() as never, now());
export const leagueLeaders = () => ranked.leagueLeaders(getPlayer() as never, now());
export const rankedState = () => getPlayer().ranked;

/** Liga actual (Bronce si aún no se desbloqueó). */
export const myLeague = () => playerRank(getPlayer());

/** Posición actual en la tabla de la liga (solo si Ranked está desbloqueado). */
export function myPosition(): number | undefined {
  if (!getPlayer().ranked.unlocked) return undefined;
  return rankedView().position ?? undefined;
}

/** Id único de partida. */
export function newMatchId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  const a = new Uint32Array(4);
  c?.getRandomValues?.(a);
  return `m-${Date.now().toString(36)}-${[...a].map((x) => x.toString(36)).join('')}`;
}

export function enterRanked(matchId: string, bet: number) {
  return commit((s) => ranked.enterRanked(s, matchId, bet, now()));
}

/** Liquida la partida Ranked en curso (si la hay). null = no había partida Ranked pendiente. */
export function settleCurrentRanked(outcome: RankedOutcome): ranked.Settlement | null {
  const p = getPlayer().ranked.pending;
  if (!p) return null;
  const res = commit((s) => ranked.settleRanked(s, p.matchId, outcome, now()));
  return res.ok ? res.settlement : null;
}

export function claimWeekly(week: string) {
  return commit((s) => ranked.claimWeekly(s, week));
}

/** Recompensas semanales por mostrar. */
export const pendingWeekly = () => getPlayer().ranked.rewards.filter((w) => !w.claimed);

export function markRankedSeen() {
  const before = getPlayer();
  const after = ranked.markRankedSeen(before as never);
  if (after !== before) commit(() => ({ ok: true as const, state: after }));
}

// ---------------------------------------------------------------- MODO RIESGO x2

/** Estado del evento con la hora del juego (sincronizada con el servidor). */
export const riskModeStatus = (): risk.RiskStatus => {
  const t = now();
  // PRUEBA de MODO DESARROLLO (devActivateRisk): se ve activo 10 min; las apuestas NO se doblan (eso solo lo decide la activación real)
  if (devRiskEnd > t) return { phase: 'active', multiplier: 1, msLeft: devRiskEnd - t, endsAt: devRiskEnd };
  return risk.riskStatus(getPlayer().riskMode, t);
};

/** fin de la PRUEBA local del MODO RIESGO (solo MODO DESARROLLO, en memoria) */
let devRiskEnd = 0;
/** (18-11-2026) MODO DESARROLLO: activa una PRUEBA visual de 10 min cualquier día (sin servidor, sin x2 real en las apuestas). */
export function devActivateRisk() {
  devRiskEnd = now() + risk.RISK_MODE.durationMs;
}

/** ¿Ya se activó esta semana (se esté jugando o ya terminado)? Se restablece el lunes siguiente. */
export const riskUsedThisWeek = () => getPlayer().riskMode?.week === risk.riskWeekAt(now());

/** Aplica la respuesta del servidor: su hora y su activación mandan. */
function applyRiskReply(r: { now: number; risk: unknown }) {
  setServerTime(r.now);
  const before = getPlayer();
  const after = risk.applyServerRisk(before as never, r.risk);
  if (after !== before) commit(() => ({ ok: true as const, state: after }));
}

/** Pide el estado al servidor (al abrir Ranked / reconectar). false = sin conexión: se sigue con lo guardado. */
export async function syncRiskMode(): Promise<boolean> {
  const r = await fetchRisk();
  if (!r) return false;
  applyRiskReply(r);
  return true;
}

export type RiskActivateError = risk.RiskError | 'offline' | 'unknown';
/** Activa el MODO RIESGO x2 en el servidor (único que lo decide). */
export async function activateRiskMode(): Promise<{ ok: true } | { ok: false; error: RiskActivateError }> {
  const r = await postRiskActivate();
  if (!r) return { ok: false, error: 'offline' };
  applyRiskReply(r);
  if (r.ok) return { ok: true };
  const e = r.error;
  return { ok: false, error: e === 'not_monday' || e === 'already_used' || e === 'active' ? e : 'unknown' };
}

// ---------------------------------------------------------------- premio diario

export const loginStatus = () => login.loginStatus(getPlayer() as never, now());
/** REGALO GRATIS de la Tienda (domain/shopGift.ts). */
export function claimShopGift(cash = 0, force = false) {
  return commit((s) => shopGift.claimGift(s, now(), Math.random, cash, force));
}
export function shopGiftStatus() {
  return shopGift.giftStatus(getPlayer(), now());
}

export function claimLogin(override?: login.LoginReward) {
  return commit((s) => login.claimLogin(s, now(), override));
}
export function claimLoginRewardAdBonus(override?: login.LoginReward) {
  return commit((s) => {
    const res = login.claimLoginAdBonus(s, now(), override);
    return { ok: true as const, state: res.state, given: res.given };
  });
}
