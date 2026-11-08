/**
 * Rangos competitivos (datos puros, sin Phaser).
 *
 * El competitivo (Ranked) se desbloquea al llegar a RANK_UNLOCK_LEVEL y empieza en Bronce.
 * La liga y la posición vienen de PlayerState.ranked (lógica en domain/ranked.ts, docs/RANKED.md).
 */
import type { PlayerState } from './player';

export type RankId = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'challenger';

export interface RankDef {
  id: RankId;
  name: string;
  /** orden de menor a mayor */
  tier: number;
  /** imagen de la insignia (public/); undefined = aún no tiene arte */
  image?: string;
  /** solo para los N mejores del ranking global */
  topOnly?: number;
  /**
   * Hueco de la imagen donde se escribe la posición global (solo Challenger).
   * Fracciones 0..1 del ancho/alto de la imagen.
   */
  numberSlot?: { cx: number; cy: number; w: number; h: number };
}

/** Máximo de dígitos de la posición Challenger (1..999). */
export const RANK_POSITION_MAX_DIGITS = 3;

/** Posición válida para mostrar (entero 1..max, máx. 3 dígitos) o null. */
export function formatRankPosition(pos: number | undefined | null, max = 999): string | null {
  if (pos == null || !Number.isInteger(pos) || pos < 1 || pos > max) return null;
  const s = String(pos);
  return s.length <= RANK_POSITION_MAX_DIGITS ? s : null;
}

/** Debe coincidir con RANKED.unlockLevel (domain/rankedConfig.ts; lo comprueban los tests). */
export const RANK_UNLOCK_LEVEL = 1;

export const RANKS: RankDef[] = [
  { id: 'bronze', name: 'Bronce', tier: 1, image: 'assets/bronce.png' },
  { id: 'silver', name: 'Plata', tier: 2, image: 'assets/plata.png' },
  { id: 'gold', name: 'Oro', tier: 3, image: 'assets/oro.png' },
  { id: 'platinum', name: 'Platino', tier: 4, image: 'assets/platino.png' },
  { id: 'diamond', name: 'Diamante', tier: 5, image: 'assets/diamante.png' },
  {
    id: 'challenger',
    name: 'Challenger',
    tier: 6,
    image: 'assets/challenger.png',
    topOnly: 500,
    numberSlot: { cx: 627 / 1254, cy: 948 / 1254, w: 300 / 1254, h: 130 / 1254 },
  },
];

export const INITIAL_RANK: RankId = 'bronze';

export function rankDef(id: RankId): RankDef {
  return RANKS.find((r) => r.id === id) ?? RANKS[0];
}

export function isRankUnlocked(level: number) {
  return level >= RANK_UNLOCK_LEVEL;
}

/** Liga actual del jugador (Bronce si aún no desbloqueó Ranked). */
export function playerRank(p: Pick<PlayerState, 'ranked'>): RankId {
  return p.ranked?.unlocked ? p.ranked.league : INITIAL_RANK;
}
