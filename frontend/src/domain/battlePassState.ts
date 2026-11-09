/**
 * PASE DE BATALLA — datos guardados por jugador (dentro de PlayerState.bp).
 * Solo tipos y constructores, sin dependencias (evita imports circulares con player.ts).
 */
export interface BattlePassState {
  /** id de la temporada a la que pertenecen estos datos (al cambiar de temporada se reinicia) */
  season: string;
  /** EXP acumulada en el pase durante la temporada */
  xp: number;
  /** pase premium comprado */
  premium: boolean;
  /** niveles ya reclamados en cada camino */
  free: number[];
  prem: number[];
}

export function newBattlePass(season = ''): BattlePassState {
  return { season, xp: 0, premium: false, free: [], prem: [] };
}

export function cloneBattlePass(b: BattlePassState): BattlePassState {
  return { ...b, free: [...b.free], prem: [...b.prem] };
}
