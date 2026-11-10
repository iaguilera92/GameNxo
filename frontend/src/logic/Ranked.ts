import { commit, getPlayer } from '../domain/playerStore';
import { gameClock } from '../domain/timeSource';
import * as ranked from '../domain/ranked';
import * as login from '../domain/dailyLogin';
import { playerRank } from '../domain/ranks';
import type { RankedOutcome } from '../domain/rankedState';

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

// ---------------------------------------------------------------- premio diario

export const loginStatus = () => login.loginStatus(getPlayer() as never, now());
export function claimLogin() {
  return commit((s) => login.claimLogin(s, now()));
}
export function claimLoginRewardAdBonus() {
  return commit((s) => {
    const res = login.claimLoginAdBonus(s, now());
    return { ok: true as const, state: res.state, given: res.given };
  });
}
