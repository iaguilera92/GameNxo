import { GAMES_TO_WIN } from '../config';

/**
 * Modos de comportamiento del rival (Etapa 5): su CONCENTRACIÓN del momento, encima de su perfil.
 *
 *   NORMAL       75 %  juega como su perfil
 *   CONCENTRADO  20 %  algo más rápido, preciso y agresivo
 *   COMPETITIVO   5 %  su mejor versión (más en puntos clave)
 *
 * NO son niveles de dificultad: son un impulso temporal y LIMITADO sobre la dificultad base
 * (un rival fácil concentrado sigue siendo fácil). Se sortean al empezar cada punto y tienden a
 * mantenerse un poco (STICKY) sin alterar la proporción 75/20/5.
 */
export type BotMode = 'normal' | 'concentrado' | 'competitivo';

export const MOOD = {
  /** proporción prevista en puntos normales */
  weights: { normal: 75, concentrado: 20, competitivo: 5 } as Record<BotMode, number>,
  /** en puntos clave (punto de juego, iguales/ventaja, punto de partido) */
  keyWeights: { normal: 55, concentrado: 30, competitivo: 15 } as Record<BotMode, number>,
  /** impulso sobre la dificultad base (0..1) */
  boost: { normal: 0, concentrado: 0.06, competitivo: 0.12 } as Record<BotMode, number>,
  /** probabilidad de seguir en el mismo modo el punto siguiente (no cambia la proporción) */
  sticky: 0.5,
};

/** ¿Es un punto clave? (puntos y juegos del marcador: índice 0 = jugador, 1 = rival) */
export function isKeyPoint(points: readonly [number, number], games: readonly [number, number]) {
  const [a, b] = points;
  const gamePoint = (a >= 3 || b >= 3) && a !== b; // alguien está a un punto de ganar el juego
  const deuce = a >= 3 && b >= 3; // iguales / ventaja
  const matchGame = games[0] === GAMES_TO_WIN - 1 || games[1] === GAMES_TO_WIN - 1;
  return gamePoint || deuce || (matchGame && (a >= 2 || b >= 2));
}

/** Sortea un modo según pesos. */
export function rollMode(w: Record<BotMode, number>, rnd = Math.random): BotMode {
  const total = w.normal + w.concentrado + w.competitivo;
  let r = rnd() * total;
  if ((r -= w.normal) < 0) return 'normal';
  if ((r -= w.concentrado) < 0) return 'concentrado';
  return 'competitivo';
}

/** Modo para el punto que empieza (con persistencia y puntos clave). */
export function nextMode(prev: BotMode, keyPoint: boolean, rnd = Math.random): BotMode {
  if (rnd() < MOOD.sticky) return prev;
  return rollMode(keyPoint ? MOOD.keyWeights : MOOD.weights, rnd);
}
