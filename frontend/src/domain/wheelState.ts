/**
 * RULETAS DIARIAS — forma de los datos guardados por jugador (dentro de PlayerState.wheel).
 * Solo tipos y constructores, sin dependencias (evita imports circulares con player.ts).
 */
import type { ItemId } from './player';

/** Premio ya resuelto (lo que se entrega). */
export type WheelReward =
  /** `duplicateOf`: compensación por un cosmético repetido (null = catálogo agotado) */
  | { kind: 'coins'; amount: number; duplicateOf?: ItemId | null }
  /** (21-11-2026) MONEDAS 2V2 */
  | { kind: 'coins2v2'; amount: number }
  | { kind: 'xp'; amount: number }
  /** DINERO virtual (billetes): lo que compra en la Tienda */
  | { kind: 'cash'; amount: number }
  | { kind: 'item'; item: ItemId; name: string }
  /** COFRE EVOLUTIVO (domain/chest.ts): al cobrarse desbloquea o sube de nivel el cofre */
  | { kind: 'chest' };

/** Nivel de la ruleta (15-11-2026): normal, DORADA (+15 % a los premios) o ÉPICA (+20 %). Los ids no se cambian nunca. */
export type WheelTier = 'normal' | 'gold' | 'epic';

export interface WheelSpin {
  /** 0..perDay-1 */
  index: number;
  /** id de la partida que la desbloqueó */
  matchId: string;
  /** sector elegido (null = aún sin girar) */
  slot: string | null;
  /** premio FINAL (ya con el bonus del nivel de la ruleta): es lo que se cobra */
  reward: WheelReward | null;
  /** premio sin bonus (de aquí se recalcula `reward` si la ruleta sube de nivel); ausente en giros viejos */
  base?: WheelReward | null;
  /** nivel actual de la ruleta (ausente = normal) */
  tier?: WheelTier;
  /** toques ya jugados (cada toque, hasta WHEEL.tiers.maxTaps, tira una vez para subir de nivel) */
  taps?: number;
  claimed: boolean;
  /** ya se abrió automáticamente en el menú (solo una vez por victoria) */
  presented: boolean;
  /** ya cobró una vez el bonus de anuncio asociado a este giro */
  adBonusClaimed?: boolean;
}

export interface WheelState {
  /** id del ciclo diario (fecha AAAA-MM-DD del día que empieza a las 23:59 del anterior) */
  cycle: string;
  /** victorias válidas del ciclo (pueden ser > perDay; solo cuentan las primeras) */
  wins: number;
  /** ids de partidas ya contadas en este ciclo */
  matchIds: string[];
  spins: WheelSpin[];
  /** Giros bonus del pase: no caducan con el reinicio diario. */
  bonusSpins: WheelSpin[];
}

export function newWheelState(cycle = ''): WheelState {
  return { cycle, wins: 0, matchIds: [], spins: [], bonusSpins: [] };
}

function cloneSpin(s: WheelSpin): WheelSpin {
  return { ...s, reward: s.reward ? { ...s.reward } : null, ...(s.base ? { base: { ...s.base } } : {}) };
}

export function cloneWheel(w: WheelState): WheelState {
  return {
    ...w,
    matchIds: [...w.matchIds],
    spins: w.spins.map(cloneSpin),
    bonusSpins: w.bonusSpins.map(cloneSpin),
  };
}
