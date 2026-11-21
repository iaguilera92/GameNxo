/**
 * MARCOS DEL PERFIL (16-11-2026, decisión del usuario): el borde de la card del perfil del menú. Los marcos son de las LIGAS:
 * llegar a una liga (la mejor alcanzada, `ranked.bestLeague`) desbloquea su marco y los de las ligas anteriores, para siempre
 * (aunque luego se baje). Sin marco = el borde azul de siempre. Datos puros, sin Phaser.
 *
 * Ids fijos: los de las ligas (`bronze` … `challenger`); nunca se cambian (docs/BASE-DE-DATOS.md).
 */
import { type PlayerState, clonePlayer } from './player';
import { LEAGUE_ORDER } from './rankedConfig';
import { bestLeague2v2 } from './league2v2';
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

/** Elige marco (null = sin marco, ni de liga ni 2v2). Error si está bloqueado. Elegir uno de liga quita el marco 2v2 (solo se ve uno). */
export function equipFrame(s: PlayerState, id: FrameId | null): { ok: true; state: PlayerState } | { ok: false; error: 'locked' } {
  if (id && !frameUnlocked(s, id)) return { ok: false, error: 'locked' };
  const n = clonePlayer(s);
  if (id) n.equipped.frame = id;
  else delete n.equipped.frame;
  delete n.equipped.frame2v2;
  return { ok: true, state: n };
}

// ---------------------------------------------------------------- MARCOS 2V2 (21-11-2026, usuario)
// Los de la LIGA 2v2: se ganan al SUBIR de liga 2v2 en la semanal (domain/league2v2.ts: `bestLeague`); mismas ids de liga que los de arriba.

/** ¿Ya se alcanzó esa liga 2v2 (o una más alta)? */
export function frame2v2Unlocked(s: PlayerState, id: FrameId): boolean {
  return LEAGUE_ORDER.indexOf(id) >= 0 && LEAGUE_ORDER.indexOf(id) <= LEAGUE_ORDER.indexOf(bestLeague2v2(s));
}

/** Marco 2v2 que se ve (el elegido si sigue desbloqueado; null = ninguno). */
export function equippedFrame2v2(s: PlayerState): FrameId | null {
  const f = s.equipped.frame2v2;
  return f && frame2v2Unlocked(s, f) ? f : null;
}

/** Elige un marco 2v2 (quita el de liga: solo se ve uno). Error si está bloqueado. */
export function equipFrame2v2(s: PlayerState, id: FrameId): { ok: true; state: PlayerState } | { ok: false; error: 'locked' } {
  if (!frame2v2Unlocked(s, id)) return { ok: false, error: 'locked' };
  const n = clonePlayer(s);
  n.equipped.frame2v2 = id;
  delete n.equipped.frame;
  return { ok: true, state: n };
}

export const isFrameId = (v: unknown): v is FrameId => typeof v === 'string' && (LEAGUE_ORDER as string[]).includes(v);
