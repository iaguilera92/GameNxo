// Movimientos de los DEFENSIVOS VOLTERETA y PATINAJE (lógica PURA, sin Phaser: la prueba tools/test-defensive-moves.mjs la
// importa tal cual). La escena (MatchScene) y los efectos (fx/iceTrailFx.ts) solo aplican estos números.
//
// Los dos hacen lo mismo que el resto de defensivos (te dejan en el punto de la pelota y la devolución queda asegurada,
// misma recarga que el DASH): solo cambia CÓMO te mueves, como una skin.
//   VOLTERETA  2 volteretas laterales en arco, con un toque de suelo (polvo) entre las dos; cae agachado y devuelve con un revés.
//   PATINAJE   patinas en línea hasta la pelota (sale rápido y se desliza al frenar) dejando un camino de hielo.

export interface Pt {
  x: number;
  y: number;
}

export const FLIP = {
  /** duración del recorrido (s): mínimo y máximo (el plan de la pelota manda dentro de ese rango) */
  airMin: 0.46,
  airMax: 0.8,
  /** altura de cada voltereta en el aire (en z) */
  height: 58,
  /** vueltas completas en todo el recorrido */
  turns: 2,
  /** curvatura lateral máxima del arco (u de cancha) */
  arc: 70,
  /** segundos antes del contacto en que cae (el revés arranca justo después, como el DESTELLO) */
  lead: 0.1,
} as const;

export const SKATE = {
  minT: 0.3,
  maxT: 0.62,
  /** segundos antes del contacto en que llega */
  lead: 0.04,
  /** inclinación del cuerpo al patinar (rad) */
  lean: 0.17,
  /** el camino de hielo: ancho en cancha (u), cuánto se queda entero (ms) y cuánto tarda en derretirse (ms) */
  width: 22,
  holdMs: 900,
  fadeMs: 1100,
} as const;

/** Lado (-1 / +1) hacia el que se mueve en pantalla (y de cancha): el sentido de las volteretas. Sin movimiento lateral, +1. */
export function flipSide(from: Pt, to: Pt): -1 | 1 {
  return to.y - from.y < 0 ? -1 : 1;
}

/**
 * Pose de la VOLTERETA en el instante `k` (0..1): posición en arco, altura (dos saltos que tocan el suelo en 0, 0,5 y 1) y giro
 * en radianes (FLIP.turns vueltas completas, hacia `side`).
 */
export function flipPose(from: Pt, to: Pt, k: number): { x: number; y: number; lift: number; spin: number } {
  const u = Math.max(0, Math.min(1, k));
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const side = flipSide(from, to);
  const arc = Math.min(len * 0.25, FLIP.arc) * Math.sin(Math.PI * u) * side;
  return {
    x: from.x + dx * u - (dy / len) * arc,
    y: from.y + dy * u + (dx / len) * arc,
    lift: FLIP.height * Math.abs(Math.sin(2 * Math.PI * u)),
    spin: Math.PI * 2 * FLIP.turns * u * side,
  };
}

/** Avance del PATINAJE (0..1): sale rápido y se desliza al frenar (desaceleración suave). */
export function skateEase(k: number): number {
  const u = Math.max(0, Math.min(1, k));
  return 1 - Math.pow(1 - u, 2.2);
}

/** Inclinación del cuerpo al patinar (rad): máxima al arrancar y se endereza al frenar, hacia el lado en que se mueve. */
export function skateLean(from: Pt, to: Pt, k: number): number {
  const u = Math.max(0, Math.min(1, k));
  return SKATE.lean * (1 - skateEase(u)) * flipSide(from, to);
}
