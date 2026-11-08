/**
 * Movimiento del jugador con INERCIA LIGERA y respuesta del joystick. Módulo puro (sin Phaser ni imports)
 * para probarlo con node: tools/test-player-motion.mjs.
 *
 * Velocidades en px lógicos por segundo, en ESPACIO DE ENTRADA (como el joystick):
 *   vx = derecha de la pantalla (lateral de cancha, +y)   vy = abajo de la pantalla (hacia el fondo, −x)
 * La escena convierte a cancha igual que antes: x −= vy·dt, y += vx·dt.
 *
 * Modelo (aceleración constante, independiente de los FPS):
 *  - La velocidad se descompone en la dirección actual (paralela) y la perpendicular.
 *  - Paralela: acelera con `accel`; si el objetivo es menor frena con `decel`; si es contrario
 *    (cambio de sentido) frena `reverseMult` veces más rápido → giros secos, sin resbalar.
 *  - Perpendicular (girar en diagonal / 90°): se alcanza con `accel`.
 */
export const MOTION = {
  /** Interruptor general. También: localStorage 'dev.playerInertia' = '0' → movimiento instantáneo de siempre. */
  enabled: true,
  /** s de 0 a la velocidad máxima */
  accelTime: 0.07,
  /** s de la velocidad máxima a 0 (soltar el joystick) */
  decelTime: 0.05,
  /** al invertir el sentido se frena este múltiplo más rápido (0,025 s de máxima a 0) */
  reverseMult: 2,
  /**
   * Compensación OPCIONAL del arranque (propuesta, desactivada): desde parado se aplica al instante esta
   * fracción de la velocidad pedida. 0 = inercia pura. Ver el estudio en tools/test-player-motion.mjs.
   */
  startImpulse: 0,
  /** fracción de la velocidad máxima por encima de la cual se ve corriendo (antes: |joystick| > 0,1) */
  moveMin: 0.1,
  /** ritmo de la animación de carrera = fracción de velocidad, acotada */
  runAnimMin: 0.45,
  runAnimMax: 1.1,
  /** frenada con animación (runstop) solo al soltar yendo a ≥ esta fracción de la velocidad máxima */
  skidMin: 0.6,
  /** cambio de sentido lateral con animación (brake-turn) a ≥ esta fracción y con el joystick ≥ turnInput */
  turnMin: 0.5,
  turnInput: 0.3,
};

/** Respuesta del joystick (precisión): zona muerta reescalada + curva suave + tope de máxima. */
export const JOY = {
  /** localStorage 'dev.joyCurve' = '0' → respuesta lineal de siempre */
  enabled: true,
  dead: 0.12,
  /** a partir de esta inclinación, velocidad máxima */
  full: 0.85,
  /** >1 = más control fino en inclinaciones pequeñas */
  gamma: 1.25,
};

export interface Motion {
  vx: number;
  vy: number;
  /** desplazamiento exacto del último paso (px, espacio de entrada): usar esto, no vx·dt */
  dx: number;
  dy: number;
  /** cerrojos para que cada evento salga una sola vez */
  skidLatch: boolean;
  turnLatch: boolean;
}

export type MotionEvent = 'skid' | 'turn' | null;

export function createMotion(): Motion {
  return { vx: 0, vy: 0, dx: 0, dy: 0, skidLatch: false, turnLatch: false };
}

export function stopMotion(m: Motion) {
  m.vx = 0;
  m.vy = 0;
  m.dx = 0;
  m.dy = 0;
  m.skidLatch = false;
  m.turnLatch = false;
}

/**
 * Avanza la velocidad hacia el objetivo (tx, ty) (px/s, ya multiplicado por la velocidad máxima).
 * Devuelve 'skid' al soltar corriendo rápido y 'turn' al invertir el sentido lateral corriendo; una vez.
 */
export function stepMotion(m: Motion, tx: number, ty: number, max: number, dt: number): MotionEvent {
  // subpasos fijos (≤ 1/480 s): los giros dependen de la dirección en cada instante, así la curva
  // es la misma a 30 que a 144 fps. Cada subpaso se integra de forma exacta.
  const n = Math.max(1, Math.ceil(dt * 480 - 1e-9));
  const h = dt / n;
  let evt: MotionEvent = null;
  let sx = 0, sy = 0;
  for (let i = 0; i < n; i++) {
    const e = subStep(m, tx, ty, max, h);
    if (e && !evt) evt = e;
    sx += m.dx;
    sy += m.dy;
  }
  m.dx = sx;
  m.dy = sy;
  return evt;
}

function subStep(m: Motion, tx: number, ty: number, max: number, dt: number): MotionEvent {
  const accel = max / MOTION.accelTime;
  const decel = max / MOTION.decelTime;
  const sp0 = Math.hypot(m.vx, m.vy);
  const tmag = Math.hypot(tx, ty);

  // --- eventos (se miran antes de mover, con la velocidad que lleva)
  let evt: MotionEvent = null;
  const released = tmag < max * 0.1;
  if (released && sp0 >= max * MOTION.skidMin && !m.skidLatch) {
    evt = 'skid';
    m.skidLatch = true;
  }
  if (!released) m.skidLatch = false;
  const reversing = Math.abs(tx) >= max * MOTION.turnInput && Math.sign(tx) === -Math.sign(m.vx) && Math.abs(m.vx) >= max * MOTION.turnMin;
  if (reversing && !m.turnLatch) {
    evt = 'turn';
    m.turnLatch = true;
  }
  if (m.turnLatch && (Math.sign(m.vx) === Math.sign(tx) || Math.abs(tx) < max * MOTION.turnInput)) m.turnLatch = false;

  // --- base del paso: dirección actual u (o la pedida, si está parado) y su perpendicular w
  let p = sp0;
  let ux: number, uy: number;
  if (sp0 < 1e-6) {
    m.vx = m.vy = 0;
    if (tmag < 1e-6) {
      m.dx = m.dy = 0;
      return evt;
    }
    ux = tx / tmag;
    uy = ty / tmag;
    p = tmag * MOTION.startImpulse; // compensación opcional del arranque (0 = desactivada)
  } else {
    ux = m.vx / sp0;
    uy = m.vy / sp0;
  }
  const wx = -uy, wy = ux;
  const tp = tx * ux + ty * uy; // objetivo en la dirección actual (negativo = sentido contrario)
  const tq = tx * wx + ty * wy; // objetivo perpendicular

  // integración EXACTA (aceleración constante a tramos): misma trayectoria a cualquier FPS
  const par = move1D(p, tp, dt, accel, decel, decel * MOTION.reverseMult);
  const per = move1D(0, tq, dt, accel, accel, accel);
  m.vx = par.v * ux + per.v * wx;
  m.vy = par.v * uy + per.v * wy;
  m.dx = par.d * ux + per.d * wx;
  m.dy = par.d * uy + per.d * wy;
  const sp = Math.hypot(m.vx, m.vy);
  if (sp > max) {
    m.vx *= max / sp;
    m.vy *= max / sp;
  }
  return evt;
}

/**
 * Velocidad 1D hacia `tgt` durante `dt`: acelera con `up`; frena hacia un objetivo del mismo signo (o 0)
 * con `down`; si el objetivo es de signo contrario frena con `rev` hasta 0 y luego acelera con `up`.
 * Devuelve la velocidad final y la distancia exacta recorrida.
 */
function move1D(v: number, tgt: number, dt: number, up: number, down: number, rev: number) {
  let d = 0;
  let t = dt;
  for (let i = 0; i < 4 && t > 1e-12; i++) {
    if (Math.abs(tgt - v) < 1e-9) {
      v = tgt;
      d += v * t;
      break;
    }
    const opposite = v !== 0 && Math.sign(tgt) !== Math.sign(v) && tgt !== 0;
    const speedingUp = v === 0 || (Math.sign(tgt) === Math.sign(v) && Math.abs(tgt) > Math.abs(v));
    const rate = opposite ? rev : speedingUp ? up : down;
    const end = opposite ? 0 : tgt; // la frenada de cambio de sentido termina en 0
    const need = Math.abs(end - v) / rate;
    if (need >= t) {
      const v1 = v + Math.sign(end - v) * rate * t;
      d += ((v + v1) / 2) * t;
      v = v1;
      break;
    }
    d += ((v + end) / 2) * need;
    v = end;
    t -= need;
  }
  return { v, d };
}

/** Magnitud de salida del joystick para una inclinación 0..1 (0 dentro de la zona muerta). */
export function joyResponse(mag: number): number {
  if (!JOY.enabled) return mag < JOY.dead ? 0 : mag; // comportamiento anterior
  if (mag < JOY.dead) return 0;
  const t = Math.min(1, (mag - JOY.dead) / (JOY.full - JOY.dead));
  return Math.pow(t, JOY.gamma);
}

/** Ritmo de la animación de carrera para una fracción de velocidad 0..1. */
export function runAnimRate(speedK: number): number {
  return Math.min(MOTION.runAnimMax, Math.max(MOTION.runAnimMin, speedK));
}
