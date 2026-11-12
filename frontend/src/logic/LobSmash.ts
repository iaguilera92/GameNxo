import { COURT, HIT_MAX_Z, NET_X } from '../config';
import { type BallState, type ShotKind, isInCourt, stepBall } from '../objects/Ball';

/**
 * GLOBO + SMASH POTENCIADO (solo lógica: detección, predicción de caída y reglas).
 * El dibujo del círculo y los efectos están en src/fx/LobMarker.ts. La física NO se toca:
 * se predice con la misma stepBall sobre una COPIA de la pelota.
 *
 * Flujo:
 *  1. Un golpe nuevo con intención 'lob' cuya trayectoria real es de globo (altura y vuelo) → globo activo.
 *  2. Se predice el primer bote (se recalcula cada REPLAN s; si cambia mucho o la pelota es golpeada /
 *     bota / termina el punto, se cancela).
 *  3. El receptor que esté DENTRO del radio (posición real en la cancha) con la pelota ya bajando y a poco
 *     de caer tiene la VENTANA abierta: si pulsa SMASH entonces, el remate sale potenciado — siempre que
 *     al contactar siga dentro, la pelota esté a altura de remate y bajando, y el globo caiga dentro.
 */
export const LOB_SMASH = {
  // --- detección (calibrado con simulación: los globos reales superan ambos umbrales en el 95 %;
  //     un golpe normal puede subir a ~370, por eso además se exige la intención 'lob')
  requireIntent: true,
  minApexZ: 300,
  minFlight: 1.45, // s del golpe al primer bote
  // --- predicción
  replan: 0.1, // s entre recálculos
  /** si el punto previsto se mueve más que esto entre recálculos, la trayectoria cambió */
  maxDrift: 120,
  // --- círculo / posición (unidades de cancha; el lateral pesa 1,25 como en el alcance de golpe)
  radius: 56,
  // --- ventana del SMASH potenciado
  windowLead: 1.1, // s antes de la caída en que se abre (con la pelota ya bajando)
  minContactZ: 70, // altura mínima de contacto para remate
  maxContactZ: HIT_MAX_Z, // altura máxima alcanzable (la del golpe normal)
  allowOutLob: false, // globo que cae fuera: no hay potenciado (mejor dejarla botar)
  // --- potencia (sobre la velocidad del SMASH normal); calibrado con la simulación de alcance del rival
  powerMult: 1.15,
  // --- REMATE (sin SMASH): golpe fuerte y directo automático al recibir el globo dentro del círculo
  remateMult: 1.45, // sobre SHOT_SPEED (golpe normal = 1; SMASH = SMASH_SPEED_MULT)
  // --- cámara: zoom suave al jugador mientras está dentro del círculo (solo cuando él recibe)
  zoom: 1.18,
  /** toma "especial": viñeta en los bordes (0..1). La cámara ya no se inclina (12-11-2026): solo zoom y encuadre */
  vignette: 0.6,
  /** encuadre: px sobre los pies del jugador que quedan en el centro (0 = pies al centro → toma más baja) */
  focusLift: 20,
  zoomIn: 3.5, // velocidad de entrada (1/s)
  zoomOut: 5, // velocidad de salida (1/s)
};

/**
 * REMATE del globo (jugador): al entrar en el círculo con la pelota bajando, salto + cámara lenta. Con el joystick se
 * apunta a uno de los 4 cuadros del rival y un aro se cierra sobre la pelota: tocar justo al cerrarse = SMASH! (más
 * fuerte); antes o después, el remate va donde se apuntó a velocidad normal. Sin tocar, golpea solo al pasarse el aro.
 *  startZ   altura de la pelota (bajando) a la que empieza
 *  contactZ altura a la que se cierra el aro (contacto ideal)
 *  realS    duración REAL de la cámara lenta hasta el cierre (s); minSlow = cámara lenta máxima
 *  perfect  margen del cierre (fracción del recorrido del aro) que cuenta como SMASH!
 *  lateMax  cuánto puede pasarse el aro antes del golpe automático (fracción)
 *  jump     altura del salto (unidades z)
 *  speed    velocidad del golpe sobre SHOT_SPEED según el momento
 */
export const REMATE = {
  // (11-11-2026) contacto alto: la pelota queda sobre la raqueta levantada (a 120 / 190 quedaba a la altura del pecho).
  // Si el globo no sube hasta startZ, empieza justo al empezar a bajar (s.vz < 0).
  startZ: 370,
  contactZ: 290,
  realS: 1.1,
  minSlow: 0.18,
  perfect: 0.09,
  lateMax: 0.35,
  /** tocar ANTES de esta fracción del aro = golpe al aire: no le pega, el juego sigue y se recupera en `whiffRecover` s */
  whiff: 0.6,
  whiffRecover: 0.35,
  jump: 85,
  // más directo (plano y rápido hacia abajo)
  // SMASH! justo al cierre del aro: 2,1 -> 1,85 (12-11-2026: era demasiado; sigue algo por encima del ESPECIAL, 1,75)
  speed: { perfect: 1.85, early: 1.45, late: 1.25 },
  /** margen sobre la red (bajo = más directo) */
  margin: 3,
};

export type Side = 'player' | 'bot';

export interface LobState {
  active: boolean;
  /** quién debe recibir el globo */
  receiver: Side | null;
  /** punto previsto del primer bote (cancha) */
  x: number;
  y: number;
  /** s que faltan para la caída */
  timeToLand: number;
  /** cae dentro de la cancha */
  inCourt: boolean;
  /** ventana de SMASH potenciado abierta (pelota bajando y a poco de caer) */
  window: boolean;
}

export class LobTracker {
  readonly state: LobState = { active: false, receiver: null, x: 0, y: 0, timeToLand: 0, inCourt: false, window: false };
  private lastHitter: Side | null = null;
  private lastVxSign = 0;
  private replanIn = 0;

  /** Cancela el globo actual (fin de punto, golpe, bote…). */
  cancel() {
    this.state.active = false;
    this.state.window = false;
    this.state.receiver = null;
  }

  /**
   * Llamar cada fotograma después de mover la pelota. Detecta golpes nuevos por el cambio de golpeador
   * o de sentido de la pelota (no hace falta engancharse a cada golpe).
   */
  update(dt: number, ball: BallState, lastHitter: Side | null, kind: ShotKind, phase: string, bounces: number) {
    const st = this.state;
    if (phase !== 'rally') {
      this.cancel();
      this.lastHitter = null;
      this.lastVxSign = 0;
      return st;
    }
    const sign = Math.sign(ball.vx);
    const newShot = lastHitter !== null && (lastHitter !== this.lastHitter || (sign !== 0 && sign !== this.lastVxSign && this.lastVxSign !== 0));
    this.lastHitter = lastHitter;
    if (sign !== 0) this.lastVxSign = sign;

    if (newShot) {
      this.cancel();
      if ((!LOB_SMASH.requireIntent || kind === 'lob') && lastHitter) this.tryStart(ball, lastHitter);
      return st;
    }
    if (!st.active) return st;
    // ya botó o la pelota dejó de venir al receptor: deja de ser relevante
    if (bounces > 0 || st.timeToLand <= 0) return this.endAndReturn();

    st.timeToLand -= dt;
    st.window = ball.vz < 0 && st.timeToLand <= LOB_SMASH.windowLead;
    this.replanIn -= dt;
    if (this.replanIn <= 0) {
      this.replanIn = LOB_SMASH.replan;
      const p = predictLanding(ball);
      if (!p) return this.endAndReturn();
      // trayectoria cambiada (p. ej. rozó algo): ya no vale
      if (Math.hypot(p.x - st.x, p.y - st.y) > LOB_SMASH.maxDrift) return this.endAndReturn();
      st.x = p.x;
      st.y = p.y;
      st.timeToLand = p.t;
      st.inCourt = isInCourt(p.x, p.y);
    }
    return st;
  }

  /** ¿La posición real (x, y de cancha) está dentro del círculo? */
  contains(x: number, y: number) {
    const st = this.state;
    if (!st.active) return false;
    const dx = x - st.x;
    const dy = (y - st.y) * 1.25;
    return Math.hypot(dx, dy) <= LOB_SMASH.radius;
  }

  /** ¿Se puede armar ahora un SMASH potenciado para `side` en (x, y)? */
  windowOpenFor(side: Side, x: number, y: number) {
    const st = this.state;
    return st.active && st.receiver === side && st.window && (st.inCourt || LOB_SMASH.allowOutLob) && this.contains(x, y);
  }

  /**
   * En el instante del golpe: ¿se cumplen TODAS las condiciones del remate potenciado?
   * (el alcance real ya lo comprobó la escena al decidir que hay golpe)
   */
  qualifies(side: Side, x: number, y: number, ball: BallState) {
    return this.windowOpenFor(side, x, y) && ball.vz < 0 && ball.z >= LOB_SMASH.minContactZ && ball.z <= LOB_SMASH.maxContactZ;
  }

  private tryStart(ball: BallState, hitter: Side) {
    const p = predictLanding(ball);
    if (!p) return;
    // comprobación física: tiene que ser de verdad un globo (alto y largo), no cualquier pelota alta
    if (p.apex < LOB_SMASH.minApexZ || p.t < LOB_SMASH.minFlight) return;
    const receiver: Side = hitter === 'player' ? 'bot' : 'player';
    // el bote tiene que estar en el campo del receptor (si no, no es un globo "para él")
    if (receiver === 'player' ? p.x > NET_X : p.x < NET_X) return;
    const st = this.state;
    st.active = true;
    st.receiver = receiver;
    st.x = p.x;
    st.y = p.y;
    st.timeToLand = p.t;
    st.inCourt = isInCourt(p.x, p.y);
    st.window = false;
    this.replanIn = LOB_SMASH.replan;
  }

  private endAndReturn() {
    this.cancel();
    return this.state;
  }
}

/** Primer bote previsto (física real sobre una copia), con la altura máxima del vuelo. */
export function predictLanding(b: BallState): { x: number; y: number; t: number; apex: number } | null {
  const s = { ...b };
  let apex = s.z;
  const dt = 1 / 120;
  for (let t = 0; t < 5; t += dt) {
    const ev = stepBall(s, dt);
    apex = Math.max(apex, s.z);
    if (ev === 'net') return null;
    if (ev === 'bounce') return { x: s.x, y: s.y, t: t + dt, apex };
    if (s.x < COURT.left - 600 || s.x > COURT.right + 600) return null;
  }
  return null;
}
