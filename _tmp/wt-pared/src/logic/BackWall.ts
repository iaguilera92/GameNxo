/**
 * Pared del FONDO del rival (la del estadio dibujado): la pelota que llega choca, rebota y, si el punto seguía
 * vivo, lo termina. Lógica pura (sin Phaser ni imports) para probarla con node: tools/test-wall.mjs.
 *
 * No toca stepBall (lo usan el rival y las predicciones): la escena comprueba la pared DESPUÉS de los golpes
 * de cada subpaso, así el rival siempre tiene su oportunidad de devolver antes que la pared.
 *
 * Reglas (como en un club con pared al fondo):
 *  - toca la pared tras botar bien en el campo del rival → PUNTO para quien golpeó (el rival no llegó);
 *  - toca la pared sin haber botado → FUERA (punto para quien recibe);
 *  - saque que toca la pared sin botar → falta;
 *  - por encima de la valla pasa de largo (como hasta ahora).
 * Son los mismos resultados que ya daba el juego (2º bote / bote fuera), pero en el momento y sitio en que se ve.
 */
export const WALL = {
  /** Interruptor. También: localStorage 'dev.backWall' = '0' → la pelota atraviesa la pared como antes. */
  enabled: true,
  /** velocidad hacia atrás que conserva al rebotar en el muro acolchado / en la valla de malla */
  restitution: 0.42,
  fenceRestitution: 0.22,
  /** lo que conserva de la velocidad lateral y vertical en el choque */
  keepY: 0.75,
  keepZ: 0.8,
};

export interface WallGeom {
  /** plano de la pared en profundidad (x de cancha) */
  x: number;
  /** altura (z) del muro sólido y de la valla que hay encima */
  padZ: number;
  fenceZ: number;
}

interface BallLike {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

export type WallHit = 'pad' | 'fence';

/**
 * Si en este subpaso la pelota cruzó el plano de la pared yendo hacia ella y por debajo de la valla, la deja
 * en la pared y la hace rebotar. Devuelve qué tocó (o null).
 */
export function wallHit(prevX: number, s: BallLike, w: WallGeom): WallHit | null {
  if (!(s.vx > 0 && prevX < w.x && s.x >= w.x)) return null;
  if (s.z >= w.fenceZ) return null; // pasa por encima
  const kind: WallHit = s.z < w.padZ ? 'pad' : 'fence';
  s.x = w.x - 0.5;
  s.vx = -s.vx * (kind === 'pad' ? WALL.restitution : WALL.fenceRestitution);
  s.vy *= WALL.keepY;
  s.vz *= WALL.keepZ;
  return kind;
}

export type WallOutcome = { kind: 'fault' } | { kind: 'point'; winner: 'hitter' | 'receiver'; reason: 'out' | 'winner' } | { kind: 'none' };

/** Qué significa el choque si el punto seguía en juego. */
export function wallOutcome(ctx: { rally: boolean; hitter: 'player' | 'bot' | null; serving: boolean; bounces: number }): WallOutcome {
  if (!ctx.rally || !ctx.hitter) return { kind: 'none' };
  if (ctx.serving) return { kind: 'fault' };
  if (ctx.bounces === 0) return { kind: 'point', winner: 'receiver', reason: 'out' };
  return { kind: 'point', winner: 'hitter', reason: 'winner' };
}

/**
 * Geometría de la pared a partir del dibujo del estadio: `wallAtY` = y de pantalla donde queda la base del
 * muro; `topPx` / `fenceTopPx` = altura en pantalla del muro y de la valla (px de imagen × escala).
 * `project` = view/projection.project; `zk` = VIEW.Z_K. La x se busca donde la base del muro cae en pantalla.
 */
export function wallFromArt(project: (x: number, y: number, z?: number) => { sy: number; s: number }, latC: number, wallAtY: number, padPx: number, fencePx: number, zk: number): WallGeom {
  let lo = 0, hi = 20000;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (project(mid, latC).sy > wallAtY) lo = mid; // más cerca de la cámara: más abajo en pantalla
    else hi = mid;
  }
  const x = (lo + hi) / 2;
  const s = project(x, latC).s;
  return { x, padZ: padPx / (zk * s), fenceZ: fencePx / (zk * s) };
}
