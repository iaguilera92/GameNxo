/**
 * (23-11-2026, usuario) POSICIÓN DEL COMPAÑERO EN EL 2v2 (sin Phaser: solo números de cancha).
 *
 * Antes el compañero se ponía en el ESPEJO exacto del otro respecto al centro (y = 2·centro − y del otro): si uno iba
 * pegado a un lado, el otro se iba pegado al contrario y nadie cubría el medio; y si uno estaba al medio, los dos
 * quedaban encimados.
 *
 * Ahora, como en el dobles real, la pareja se mueve JUNTA hacia el lado de la pelota y cada uno cubre su mitad:
 *  1. el centro del equipo se corre hacia donde está (o va a caer) la pelota (`ballPull`);
 *  2. el compañero se pone en el lado contrario al otro, a un cuarto de cancha de ese centro;
 *  3. sin quedar ni muy cerca (`minGap`: no se encima) ni muy lejos (`maxGap`: el medio queda cubierto) del otro.
 * El lado se conserva mientras el otro esté cerca del centro (histéresis), para que no cambie de lado a cada paso.
 */

/** ancho de juego en lateral (y de cancha) */
export interface Lane {
  top: number;
  bottom: number;
}

export const DOUBLES_POS = {
  /** cuánto se corre el centro del equipo hacia la pelota (0 = siempre al medio, 1 = encima de la pelota) */
  ballPull: 0.4,
  /** distancia ideal al centro del equipo, en fracción del ancho de cancha */
  spread: 0.25,
  /** separación mínima y máxima con el compañero, en fracción del ancho */
  minGap: 0.3,
  maxGap: 0.55,
  /** px que el otro tiene que pasar el centro para cambiar de lado */
  sideSwitch: 25,
  /** margen a los bordes del ancho de juego (px) */
  edge: 30,
  /** el que acaba de golpear vuelve a su mitad: distancia al medio en fracción del ancho */
  homeSpread: 0.22,
  /** suavizado del sitio de cobertura (s): no reacciona al instante a cada paso del otro */
  smoothS: 0.22,
};

/**
 * Lateral donde se pone el compañero que cubre.
 * @param mateY lateral del otro de su equipo (el que va a la pelota o el humano)
 * @param ballY lateral de referencia de la pelota (dónde va a caer o desde dónde la van a golpear)
 * @param prevSide lado en que estaba (+1 = más y que el otro, −1 = menos); 0 = sin lado todavía
 * @returns `y` y el lado usado (para la histéresis del siguiente paso)
 */
export function coverY(mateY: number, ballY: number, lane: Lane, prevSide: -1 | 0 | 1): { y: number; side: -1 | 1 } {
  const W = lane.bottom - lane.top;
  const mid = (lane.top + lane.bottom) / 2;
  const c = mid + DOUBLES_POS.ballPull * (ballY - mid);
  let side: -1 | 1;
  if (Math.abs(mateY - c) > DOUBLES_POS.sideSwitch || prevSide === 0) side = mateY <= c ? 1 : -1;
  else side = prevSide;
  const ideal = c + side * W * DOUBLES_POS.spread;
  const near = mateY + side * W * DOUBLES_POS.minGap;
  const far = mateY + side * W * DOUBLES_POS.maxGap;
  let y = side > 0 ? Math.min(Math.max(ideal, near), far) : Math.max(Math.min(ideal, near), far);
  y = Math.min(Math.max(y, lane.top + DOUBLES_POS.edge), lane.bottom - DOUBLES_POS.edge);
  // pegado al borde, el lado elegido ya no cabe: mejor el otro lado que encimarse
  if (Math.abs(y - mateY) < W * DOUBLES_POS.minGap * 0.5) {
    side = side > 0 ? -1 : 1;
    y = Math.min(Math.max(mateY + side * W * DOUBLES_POS.minGap, lane.top + DOUBLES_POS.edge), lane.bottom - DOUBLES_POS.edge);
  }
  return { y, side };
}

/** Lateral de espera del que acaba de golpear: el centro de SU mitad (la del lado contrario a su compañero), no el medio de la cancha. */
export function homeY(selfY: number, mateY: number, lane: Lane): number {
  const W = lane.bottom - lane.top;
  const mid = (lane.top + lane.bottom) / 2;
  const side = selfY >= mateY ? 1 : -1;
  return mid + side * W * DOUBLES_POS.homeSpread;
}

/** Acerca `cur` a `target` con un suavizado exponencial de `smoothS` segundos. */
export function smoothToward(cur: number, target: number, dt: number): number {
  const k = 1 - Math.exp(-dt / DOUBLES_POS.smoothS);
  return cur + (target - cur) * k;
}
