import { COURT } from '../config';

/**
 * Proyección en perspectiva para la vista vertical (tipo Mario Tennis).
 *
 * La física trabaja en "coordenadas de cancha":
 *   x = largo de la cancha (jugador en x pequeños, bot en x grandes, red en NET_X)
 *   y = ancho de la cancha (lateral)
 *   z = altura
 * Esta función las convierte a pantalla con una cámara situada detrás del jugador.
 * Los parámetros de VIEW se definen en píxeles de pantalla y el resto se deriva.
 */
export const VIEW = {
  W: 720, // resolución de diseño (vertical)
  H: 1280,
  NEAR_Y: 900, // y en pantalla de la línea de fondo del jugador
  FAR_Y: 330, // y en pantalla de la línea de fondo del rival
  NEAR_W: 640, // ancho en pantalla de la cancha en la línea de fondo cercana (casi toda la pantalla)
  RATIO: 0.42, // ancho lejano / ancho cercano (perspectiva fuerte, cámara baja tipo Mario Tennis)
  Z_K: 0.75, // compresión visual de la altura
  CHAR_K: 0.62, // escala base de los personajes
  /** cuánto sigue la cámara al jugador en lateral (0 = fija, 1 = centrada en él) */
  FOLLOW: 0.35,
};

const L0 = COURT.left;
const L1 = COURT.right;
const LAT_C = (COURT.top + COURT.bottom) / 2;
const LAT_W = COURT.bottom - COURT.top;

const CAM_X = (L0 - VIEW.RATIO * L1) / (1 - VIEW.RATIO);
const D1 = L0 - CAM_X;
const D2 = L1 - CAM_X;
const F = (VIEW.NEAR_W * D1) / LAT_W;
const K = (VIEW.NEAR_Y - VIEW.FAR_Y) / (1 / D1 - 1 / D2);
const H0 = VIEW.NEAR_Y - K / D1;

export interface Projected {
  sx: number;
  sy: number;
  /** escala de perspectiva (~1.45 en la línea de fondo cercana) */
  s: number;
}

export function project(x: number, y: number, z = 0): Projected {
  const D = Math.max(80, x - CAM_X);
  const s = F / D;
  return { sx: VIEW.W / 2 + (y - LAT_C) * s, sy: H0 + K / D - VIEW.Z_K * z * s, s };
}
