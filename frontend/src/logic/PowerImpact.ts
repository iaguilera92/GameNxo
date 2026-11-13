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
  stunMs: 2000,
  /**
   * aturdimiento por tipo: el ESPECIAL (SMASH) deja 2 s y la ULTI (INFERNO) 1,5 s al que la alcanza (jugador o rival);
   * la ULTI además le hace volar la raqueta (RACKET_LOSS)
   */
  stunMsBy: { smash: 2000, inferno: 1500 } as Record<PowerKind, number>,
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

/**
 * RAQUETA PERDIDA (ULTI recibida): cae a la izquierda o a la derecha de quien la recibe y queda en el suelo. Sin ella no
 * se devuelve ninguna pelota ni se usan habilidades; se recupera al pasar por encima. Vuelve sola al empezar otro punto.
 *  side   distancia lateral (unidades de cancha) a la que cae: entre [min, max]
 *  depth  variación en profundidad (±)
 *  pickR  distancia a la que se recoge
 *  flyMs  vuelo hasta el suelo
 *  (solo dibujo) launchMs  espera hasta que sale volando: el clip (ulti-hit de la hoja de la ULTI completa, o inferno-hit)
 *                         deja la mano vacía en su frame 3 = 2 frames a 14 fps ≈ 143 ms
 *               sizeK     alto de la raqueta suelta respecto al del personaje
 *               arcK      altura del vuelo respecto al alto del personaje
 */
export const RACKET_LOSS = { side: [110, 170] as [number, number], depth: 40, pickR: 42, flyMs: 700, launchMs: 143, sizeK: 0.55, arcK: 1.1 };

/**
 * EMPUJÓN LEVE al que RECIBE un golpe cargado al máximo (no cortita ni globo, ni SMASH / ULTI): al devolverlo retrocede un poco
 * hacia su fondo, con polvo y un golpecito de cámara; sin estrellas ni pérdida de raqueta. Mucho más suave que el SMASH
 * (knockback 110 / 280 ms, aturdido 2 s).
 *  dist    retroceso (unidades de cancha)    ms  duración del retroceso    stunS  s sin poder moverse (el empujón)
 *  shake   sacudida de cámara
 */
export const MAX_PUSH = { dist: 48, ms: 240, stunS: 0.2, shake: { ms: 90, intensity: 0.004 } };

/** Posición final del retroceso: hacia atrás (lejos de la red) sin salir de la zona del rival. */
export function knockbackX(x: number, xMax: number, dist = POWER_IMPACT.knockback.dist) {
  return Math.max(x, Math.min(xMax, x + dist));
}

/** Segundos de aturdimiento (el cerebro del bot los descuenta y no se mueve ni golpea mientras duran). */
export function stunSeconds(kind: PowerKind = 'smash') {
  return stunMsFor(kind) / 1000;
}

/** Milisegundos de aturdimiento según el ataque recibido (SMASH 2 s · INFERNO 1,5 s). */
export function stunMsFor(kind: PowerKind) {
  return POWER_IMPACT.stunMsBy[kind] ?? POWER_IMPACT.stunMs;
}
