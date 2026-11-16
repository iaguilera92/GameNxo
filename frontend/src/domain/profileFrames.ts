/**
 * MARCOS DEL PERFIL (16-11-2026, decisión del usuario): el borde de la card del perfil del menú. Los marcos son de las LIGAS:
 * llegar a una liga (la mejor alcanzada, `ranked.bestLeague`) desbloquea su marco y los de las ligas anteriores, para siempre
 * (aunque luego se baje). Sin marco = el borde azul de siempre. Datos puros, sin Phaser.
 *
 * Ids fijos: los de las ligas (`bronze` … `challenger`); nunca se cambian (docs/BASE-DE-DATOS.md).
 */
import { type PlayerState, clonePlayer } from './player';
import { LEAGUE_ORDER } from './rankedConfig';
import type { RankId } from './ranks';

export type FrameId = RankId;

export const FRAME_IDS: FrameId[] = [...LEAGUE_ORDER];

/** Mejor liga alcanzada (nunca baja). */
export function bestLeague(s: PlayerState): RankId {
  const r = s.ranked;
  const best = r.bestLeague ?? r.league;
  return LEAGUE_ORDER.indexOf(r.league) > LEAGUE_ORDER.indexOf(best) ? r.league : best;
}

export function frameUnlocked(s: PlayerState, id: FrameId): boolean {
  return LEAGUE_ORDER.indexOf(id) >= 0 && LEAGUE_ORDER.indexOf(id) <= LEAGUE_ORDER.indexOf(bestLeague(s));
}

/** Marco que se ve (el elegido si sigue desbloqueado; null = sin marco). */
export function equippedFrame(s: PlayerState): FrameId | null {
  const f = s.equipped.frame;
  return f && frameUnlocked(s, f) ? f : null;
}

/** Elige marco (null = sin marco). Error si está bloqueado. */
export function equipFrame(s: PlayerState, id: FrameId | null): { ok: true; state: PlayerState } | { ok: false; error: 'locked' } {
  if (id && !frameUnlocked(s, id)) return { ok: false, error: 'locked' };
  const n = clonePlayer(s);
  if (id) n.equipped.frame = id;
  else delete n.equipped.frame;
  return { ok: true, state: n };
}

export const isFrameId = (v: unknown): v is FrameId => typeof v === 'string' && (LEAGUE_ORDER as string[]).includes(v);
