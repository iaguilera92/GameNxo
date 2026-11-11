/**
 * IMPACTO de SMASH / INFERNO DRIVE contra el rival (lógica pura, sin Phaser).
 *
 * El "impacto directo" es el contacto real que ya existía: el rival alcanza (con su alcance de golpe)
 * una pelota de potencia → MatchScene.fireImpact. No hay colisión con el cuerpo: si no la alcanza, el
 * punto sigue como siempre; botar o pasar cerca no activa nada. La devolución floja, la puntuación y la
 * física de los tiros no cambian: aquí solo se decide el aturdimiento y el retroceso.
 * Los efectos visuales están en fx/ImpactFx.ts.
 */
export type PowerKind = 'smash' | 'inferno';

export const POWER_IMPACT = {
  /** aturdimiento total (reacción + recuperación) del SMASH, ajustable según el balance */
  stunMs: 650,
  /** aturdimiento por tipo: la ULTI (INFERNO) deja 1,5 s al que la alcanza (jugador o rival) */
  stunMsBy: { smash: 650, inferno: 1500 } as Record<PowerKind, number>,
  /** retroceso: distancia en profundidad de cancha y duración (rápido al principio, frena al final) */
  knockback: { dist: 110, ms: 280 },
  /** reacción del cuerpo (inclinación inicial, grados) */
  recoilDeg: 25,
  /** sacudida de cámara moderada */
  shake: {
    smash: { ms: 220, intensity: 0.011 },
    inferno: { ms: 260, intensity: 0.015 },
  },
};

/** Posición final del retroceso: hacia atrás (lejos de la red) sin salir de la zona del rival. */
export function knockbackX(x: number, xMax: number, dist = POWER_IMPACT.knockback.dist) {
  return Math.max(x, Math.min(xMax, x + dist));
}

/** Segundos de aturdimiento (el cerebro del bot los descuenta y no se mueve ni golpea mientras duran). */
export function stunSeconds(kind: PowerKind = 'smash') {
  return stunMsFor(kind) / 1000;
}

/** Milisegundos de aturdimiento según el ataque recibido (SMASH 0,65 s · INFERNO 1,5 s). */
export function stunMsFor(kind: PowerKind) {
  return POWER_IMPACT.stunMsBy[kind] ?? POWER_IMPACT.stunMs;
}
