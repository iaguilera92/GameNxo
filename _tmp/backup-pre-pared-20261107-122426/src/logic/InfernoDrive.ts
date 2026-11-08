import type { CineProfile } from '../fx/SmashCinematic';

/**
 * INFERNO DRIVE — habilidad definitiva (lógica pura: carga, estados, validación del contacto).
 * Presentación: fx/SmashCinematic.ts (perfil INFERNO_CINE) + fx/InfernoFx.ts. Integración: MatchScene.
 *
 * Reglas:
 *  - Cada PUNTO ganado por el jugador suma 1 (máx. `pointsToCharge`). Las derrotas no suman.
 *    La carga se conserva entre puntos y empieza en 0 en cada partido.
 *  - Con la carga completa, el botón SMASH pasa a ser INFERNO DRIVE (mismo botón y sitio).
 *  - Pulsarlo la ARMA (no consume). Se dispara cuando la pelota que llega puede alcanzarse con el
 *    desplazamiento especial (alcance × `reachMult`) hasta una posición de contacto válida dentro de los
 *    límites del jugador. Si no hay contacto viable no pasa nada y la carga se conserva.
 *  - La carga se consume UNA vez, al ejecutar el golpe. Una vez por punto.
 *
 * Estados: CHARGING → READY → (armada) VALIDATING → CINEMATIC_CHARGE → GHOST_DASH → SPECIAL_IMPACT → RECOVERY.
 */
export const INFERNO = {
  /** PRUEBAS: 2 (el diseño final es 6) */
  pointsToCharge: 2,
  /** alcance efectivo sobre el del golpe normal (HIT_RANGE) */
  reachMult: 1.25,
  /** la posición de contacto deja la pelota a esta fracción del alcance normal (golpe cómodo) */
  contactAt: 0.35,
  /** velocidad de salida sobre la del SMASH especial (se aplica una vez) */
  speedMult: 1.15,
  /** desplazamiento fantasma */
  dash: { fromMs: 1000, toMs: 1650, ghosts: 4, ghostAlpha: [0.28, 0.42, 0.56, 0.72], tint: 0xff6a2a, ghostFadeMs: 520 },
  /** vibración de cámara al impactar (nivel 0..1 multiplicable por el jugador: localStorage 'nxo.shake') */
  shake: { ms: 250, intensity: 0.014, level: 1 },
  hapticMs: 70,
};

/** Cinemática de 2 s: 0–1000 concentración · 1000–1650 desplazamiento · 1650–2000 impacto. */
export const INFERNO_CINE: CineProfile = {
  durationMs: 2000,
  hitAtMs: 1650,
  activateMs: 250,
  focusMs: 600,
  peakMs: 1000,
  raysUntilMs: 1000,
  releaseFromMs: 1650,
  flashAtMs: 1650,
  flashMs: 220,
  darken: 0.45,
  rays: 26,
  particles: 44,
  glow: 1.3,
  pulseEveryMs: 120,
  // líneas y partículas en naranja, rojo y dorado
  colors: { core: 0xffd27a, gold: 0xffc23a, hot: 0xff3d1a, cyan: 0xff7a1a },
  // aura ceñida al ejecutor (escala sobre su silueta): naranja y roja
  aura: [
    [1.3, 0xff2200, 0.22],
    [1.08, 0xff5a00, 0.24],
    [0.86, 0xffa020, 0.22],
  ],
};

/** Nivel de vibración visual elegido (0 = sin vibración). */
export function shakeLevel(): number {
  try {
    const v = Number(localStorage.getItem('nxo.shake') ?? '1');
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) * INFERNO.shake.level : INFERNO.shake.level;
  } catch {
    return INFERNO.shake.level;
  }
}

export type InfernoPhase = 'CHARGING' | 'READY' | 'VALIDATING' | 'CINEMATIC_CHARGE' | 'GHOST_DASH' | 'SPECIAL_IMPACT' | 'RECOVERY';

export class InfernoDrive {
  charge = 0;
  phase: InfernoPhase = 'CHARGING';
  /** pulsada y esperando una pelota alcanzable */
  armed = false;
  /** ya se usó en este punto */
  usedThisPoint = false;

  get ready() {
    return this.charge >= INFERNO.pointsToCharge;
  }

  /** ¿En plena ejecución (cinemática / impacto)? */
  get executing() {
    return this.phase === 'CINEMATIC_CHARGE' || this.phase === 'GHOST_DASH' || this.phase === 'SPECIAL_IMPACT';
  }

  /** Punto ganado por el jugador. Devuelve true si AHORA queda cargada. */
  onPointWon(): boolean {
    if (this.ready) return false; // cargada: no se acumula más
    this.charge = Math.min(INFERNO.pointsToCharge, this.charge + 1);
    if (this.ready) {
      this.phase = 'READY';
      return true;
    }
    return false;
  }

  /** Empieza un punto: se puede volver a usar y se desarma lo que no llegó a ejecutarse. */
  onPointStart() {
    this.usedThisPoint = false;
    this.armed = false;
    if (!this.executing) this.phase = this.ready ? 'READY' : 'CHARGING';
  }

  /** Armar (pulsar el botón). No consume. */
  arm(): boolean {
    if (!this.ready || this.usedThisPoint || this.armed || this.executing) return false;
    this.armed = true;
    this.phase = 'VALIDATING';
    return true;
  }

  disarm() {
    this.armed = false;
    if (!this.executing) this.phase = this.ready ? 'READY' : 'CHARGING';
  }

  /** Contacto validado: empieza la cinemática. */
  begin() {
    this.armed = false;
    this.phase = 'CINEMATIC_CHARGE';
  }

  /** Golpe ejecutado: consume la carga (una vez). */
  consume() {
    this.charge = 0;
    this.usedThisPoint = true;
    this.phase = 'RECOVERY';
  }

  /** Cancelada antes del golpe (cambio de escena…): no consume. */
  abort() {
    this.armed = false;
    this.phase = this.ready ? 'READY' : 'CHARGING';
  }
}

export interface ReachCheck {
  /** posición del jugador y su orientación de golpe (+1 / -1), como en MatchScene.reachDist */
  px: number;
  py: number;
  dir: number;
  ball: { x: number; y: number; z: number };
  hitRange: number;
  maxZ: number;
  /** límites del jugador (no cruza la red ni sale de su zona) */
  bounds: { xMin: number; xMax: number; yMin: number; yMax: number };
}

/** Distancia de golpe (misma métrica que MatchScene.reachDist: el lateral pesa 1,25). */
export function reachMetric(px: number, py: number, dir: number, b: { x: number; y: number }) {
  return Math.hypot(b.x - (px + dir * 15), (b.y - py) * 1.25);
}

/**
 * ¿Se puede alcanzar la pelota con el desplazamiento especial? Devuelve la posición de contacto
 * (dentro de los límites, con la pelota dentro del alcance NORMAL desde allí) o null.
 */
export function planInfernoContact(c: ReachCheck): { x: number; y: number; dist: number } | null {
  if (c.ball.z >= c.maxZ) return null;
  const d = reachMetric(c.px, c.py, c.dir, c.ball);
  if (d >= c.hitRange * INFERNO.reachMult) return null;
  // vector hacia la pelota en la métrica de golpe; se avanza hasta dejarla a `contactAt` del alcance
  const want = c.hitRange * INFERNO.contactAt;
  const f = d > want ? 1 - want / d : 0;
  const mx = (c.ball.x - (c.px + c.dir * 15)) * f;
  const my = ((c.ball.y - c.py) * 1.25 * f) / 1.25;
  const x = Math.max(c.bounds.xMin, Math.min(c.bounds.xMax, c.px + mx));
  const y = Math.max(c.bounds.yMin, Math.min(c.bounds.yMax, c.py + my));
  const after = reachMetric(x, y, c.dir, c.ball);
  if (after >= c.hitRange) return null; // ni con el desplazamiento: inalcanzable de verdad
  return { x, y, dist: Math.hypot(x - c.px, y - c.py) };
}
