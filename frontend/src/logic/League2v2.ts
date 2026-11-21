import { commit, getPlayer } from '../domain/playerStore';
import { gameClock } from '../domain/timeSource';
import * as league from '../domain/league2v2';
import type { RankId } from '../domain/ranks';

/**
 * Fachada de la LIGA 2v2 para las escenas (como logic/Ranked.ts): aplica las operaciones puras de domain/league2v2.ts con la hora del
 * juego y guarda con playerStore. Con backend, estas funciones pasarán a llamar a la API (el servidor decide).
 */
const now = () => gameClock.now();

/** Pone la liga 2v2 al día (crea los datos, cierra la semana) y guarda si cambió. */
export function syncLeague2v2() {
  const before = getPlayer();
  const after = league.syncLeague2v2(before as never, now());
  if (after !== before) commit(() => ({ ok: true as const, state: after }));
}

export const leagueView2v2 = () => league.view2v2(getPlayer() as never, now());
/** Liga 2v2 actual del jugador. */
export const myLeague2v2 = (): RankId => league.league2v2Of(getPlayer());
/** Recompensas semanales 2v2 por mostrar. */
export const pendingWeekly2v2 = () => getPlayer().league2v2?.rewards.filter((w) => !w.claimed) ?? [];
export const league2v2State = () => getPlayer().league2v2;

export function claimWeekly2v2(week: string) {
  return commit((s) => league.claimWeekly2v2(s, week));
}

export function markLeague2v2Seen() {
  const before = getPlayer();
  const after = league.markLeague2v2Seen(before as never);
  if (after !== before) commit(() => ({ ok: true as const, state: after }));
}
