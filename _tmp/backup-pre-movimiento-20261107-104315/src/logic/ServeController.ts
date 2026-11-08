import { GRAVITY, SERVE } from '../config';

/**
 * Máquina de estados del saque (sin Phaser: solo reglas de tiempo y calidad del golpe).
 *
 *   POSITIONING  el servidor se coloca (el jugador mueve el personaje; la IA espera)
 *   TOSS         pelota lanzada; breve bloqueo anti doble toque
 *   AIMING       la pelota sube y baja; se apunta y se espera el momento del golpe
 *   SWING        golpe pulsado: la raqueta viaja hasta la pelota (retardo de la animación)
 *   SERVE_RESULT pelota golpeada: queda validar el servicio (cuadro, red, let)
 *   RALLY        saque válido: intercambio normal
 *
 * Quien juega (jugador por botones o IA por plan) solo llama a startToss / pressHit; la escena
 * aplica el resultado a la pelota real. Así las reglas del saque quedan separadas de controles,
 * animaciones y física, y un servidor autoritativo podría reutilizar esta lógica tal cual.
 */
export type ServeState = 'POSITIONING' | 'TOSS' | 'AIMING' | 'SWING' | 'SERVE_RESULT' | 'RALLY';
export type ServeKind = 'normal' | 'spin';
export type ServeQuality = 'perfect' | 'normal' | 'weak' | 'low' | 'miss';

/** Altura de la pelota (z) a los `t` segundos del lanzamiento: misma ecuación que stepBall. */
export function tossHeight(z0: number, t: number) {
  return z0 + SERVE.tossVz * t - 0.5 * GRAVITY * t * t;
}

/** Instante (s) en que la pelota alcanza su punto más alto. */
export const APEX_T = SERVE.tossVz / GRAVITY;

/** Ventana de saque perfecto (segundos desde el lanzamiento) para cada tipo de saque. */
export function perfectWindow(kind: ServeKind) {
  const k = kind === 'spin' ? SERVE.spinWindowScale : 1;
  return { from: APEX_T - SERVE.perfectBefore * k, to: APEX_T + SERVE.perfectAfter * k };
}

export type ServeEvent = 'aiming' | 'contact' | null;

export class ServeController {
  state: ServeState = 'POSITIONING';
  kind: ServeKind | null = null;
  /** segundos desde el lanzamiento */
  t = 0;
  /** la pulsación del golpe cayó dentro de la ventana perfecta */
  pressedInWindow = false;
  private swingLeft = 0;

  reset() {
    this.state = 'POSITIONING';
    this.kind = null;
    this.t = 0;
    this.pressedInWindow = false;
    this.swingLeft = 0;
  }

  /** 1ª pulsación: lanza la pelota. Solo vale colocándose; las demás se ignoran. */
  startToss(kind: ServeKind): boolean {
    if (this.state !== 'POSITIONING') return false;
    this.state = 'TOSS';
    this.kind = kind;
    this.t = 0;
    this.pressedInWindow = false;
    return true;
  }

  /** ¿Está abierta la ventana perfecta ahora? (para iluminar el botón en azul neón) */
  windowOpen(): boolean {
    if (!this.kind || (this.state !== 'TOSS' && this.state !== 'AIMING')) return false;
    const w = perfectWindow(this.kind);
    return this.t >= w.from && this.t <= w.to;
  }

  /** Segundos que dura la ventana del tipo de saque actual (para el brillo del botón). */
  windowLength(): number {
    if (!this.kind) return 0;
    const w = perfectWindow(this.kind);
    return w.to - w.from;
  }

  /** 2ª pulsación del mismo botón: inicia el golpe; el contacto llega tras `delay` segundos. */
  pressHit(delay: number): boolean {
    if (this.state !== 'AIMING') return false;
    this.pressedInWindow = this.windowOpen();
    this.swingLeft = Math.max(0, delay);
    this.state = 'SWING';
    return true;
  }

  tick(dt: number): ServeEvent {
    if (this.state === 'TOSS' || this.state === 'AIMING' || this.state === 'SWING') this.t += dt;
    if (this.state === 'TOSS' && this.t >= SERVE.tossLock) {
      this.state = 'AIMING';
      return 'aiming';
    }
    if (this.state === 'SWING') {
      this.swingLeft -= dt;
      if (this.swingLeft <= 0) {
        this.state = 'SERVE_RESULT';
        return 'contact';
      }
    }
    return null;
  }

  /** Calidad del contacto según la altura real de la pelota y si se pulsó en ventana. */
  evaluate(z: number, vz: number): ServeQuality {
    const min = vz > 0 ? SERVE.reachMinRisingZ : SERVE.reachMinZ;
    if (z < min || z > SERVE.reachMaxZ) return 'miss';
    if (this.pressedInWindow) return 'perfect';
    if (vz < 0 && z < SERVE.lowHitZ) return 'low'; // demasiado baja: va a la red
    if (vz < 0 && z < SERVE.weakBelowZ) return 'weak';
    return 'normal';
  }

  /** Servicio validado (la pelota cayó bien en el cuadro): empieza el intercambio. */
  startRally() {
    if (this.state === 'SERVE_RESULT') this.state = 'RALLY';
  }
}
