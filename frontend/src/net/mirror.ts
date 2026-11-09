/**
 * Espejo de coordenadas entre los dos teléfonos. Cada cliente ve SU jugador abajo (x pequeños) y el rival
 * arriba (x grandes): lo que envía el rival se refleja por el centro de la cancha (red y eje lateral).
 *   x' = COURT.left + COURT.right − x   (la red está en el centro: NET_X = (left + right) / 2)
 *   y' = 2·LAT_C − y                    (su derecha es tu izquierda)
 */
import { COURT } from '../config';
import type { BallWire } from './protocol';

const SUM_X = COURT.left + COURT.right;
const LAT_C = (COURT.top + COURT.bottom) / 2;

export const mirrorX = (x: number) => SUM_X - x;
export const mirrorY = (y: number) => 2 * LAT_C - y;

export function mirrorBall(b: BallWire): BallWire {
  // la aceleración lateral (efecto del saque) también se invierte con el eje lateral
  return { ...b, x: mirrorX(b.x), y: mirrorY(b.y), vx: -b.vx, vy: -b.vy, ...(b.ay ? { ay: -b.ay } : {}) };
}
