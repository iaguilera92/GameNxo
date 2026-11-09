/**
 * RULETAS DIARIAS — forma de los datos guardados por jugador (dentro de PlayerState.wheel).
 * Solo tipos y constructores, sin dependencias (evita imports circulares con player.ts).
 */
import type { ItemId } from './player';

/** Premio ya resuelto (lo que se entrega). */
export type WheelReward =
  /** `duplicateOf`: compensación por un cosmético repetido (null = catálogo agotado) */
  | { kind: 'coins'; amount: number; duplicateOf?: ItemId | null }
  | { kind: 'xp'; amount: number }
  | { kind: 'item'; item: ItemId; name: string };

export interface WheelSpin {
  /** 0..perDay-1 */
  index: number;
  /** id de la partida que la desbloqueó */
  matchId: string;
  /** sector elegido (null = aún sin girar) */
  slot: string | null;
  reward: WheelReward | null;
  claimed: boolean;
  /** ya se abrió automáticamente en el menú (solo una vez por victoria) */
  presented: boolean;
}

export interface WheelState {
  /** id del ciclo diario (fecha AAAA-MM-DD del día que empieza a las 23:59 del anterior) */
  cycle: string;
  /** victorias válidas del ciclo (pueden ser > perDay; solo cuentan las primeras) */
  wins: number;
  /** ids de partidas ya contadas en este ciclo */
  matchIds: string[];
  spins: WheelSpin[];
}

export function newWheelState(cycle = ''): WheelState {
  return { cycle, wins: 0, matchIds: [], spins: [] };
}

export function cloneWheel(w: WheelState): WheelState {
  return {
    ...w,
    matchIds: [...w.matchIds],
    spins: w.spins.map((s) => ({ ...s, reward: s.reward ? { ...s.reward } : null })),
  };
}
