/**
 * PERFECT TIMING (golpes del jugador en el peloteo). Módulo puro: sin Phaser ni imports, para poder
 * probarlo con node (tools/test-perfect-timing.mjs).
 *
 * Cómo se mide: el golpe del juego es AUTOMÁTICO (la raqueta golpea al entrar la pelota en el alcance).
 * La acción del jugador es el toque de golpe/carga (mitad derecha de la pantalla, ESPACIO o L). El
 * instante ideal del toque es `idealLeadMs` antes del contacto real (lo que tarda el swing en armarse).
 *
 *   delta = instante del toque − (instante del contacto − idealLeadMs)
 *   delta < 0 → temprano · delta > 0 → tarde
 *
 * Sin toque reciente (o toque hace mucho: carga larga) el golpe es 'none' y se comporta EXACTAMENTE
 * como siempre. Todos los tiempos usan el reloj de simulación de la escena (avanza con el dt de la
 * física, no con los FPS) y los toques se convierten a ese reloj con performance.now().
 */
export type TimingGrade = 'perfect' | 'good' | 'early' | 'late' | 'off' | 'none';

export const TIMING = {
  /** Interruptor general (también: localStorage 'dev.perfectTiming' = '0' lo desactiva). */
  enabled: true,
  /** Antelación ideal del toque respecto al contacto (ms). */
  idealLeadMs: 180,
  /** Ventanas (|delta| en ms). */
  perfectMs: 60,
  goodMs: 150,
  offMs: 250,
  /** Multiplicador de velocidad por calidad (sobre la velocidad ya calculada por el golpe). */
  power: { perfect: 1.2, good: 1, early: 0.85, late: 0.8, off: 1, none: 1 } as Record<TimingGrade, number>,
  /**
   * Precisión. El jugador no tenía error de ejecución: BUENO/none siguen sin él.
   * PERFECTO: +15 % → la pelota pasa un 15 % más justa sobre la red (más plana y penetrante).
   * TEMPRANO/TARDE: error aleatorio en el bote (desviación típica, fracción de media pista: lateral / fondo).
   */
  perfectMarginMult: 0.85,
  error: {
    early: { lat: 0.1, dep: 0.07 },
    late: { lat: 0.14, dep: 0.09 },
  } as Partial<Record<TimingGrade, { lat: number; dep: number }>>,
  /**
   * Antiacumulación: fracción del efecto (bonus o penalización) que se aplica en golpes ya potentes.
   * max = carga al 100 %; remate = remate automático del globo; ability = SMASH de habilidad.
   */
  scale: { normal: 1, max: 0.5, remate: 0.6, ability: 0.4 },
  /** Golpes de toque: la potencia no cambia (una dejada +20 % sería peor), solo la precisión. */
  touchKinds: ['drop', 'lob'] as string[],
  /**
   * CARGA PERFECTA (compatible con la carga larga): si el medidor llega al 100 % justo en el contacto
   * (|llenado − contacto| ≤ perfectMs) es PERFECTO; ≤ goodMs, BUENO. Solo premia: llenarse antes de
   * tiempo o no llenarse sigue siendo el golpe cargado de siempre (sin penalización).
   */
  chargePerfect: true,
  /**
   * TEMPRANO (opción B): resta solo de la potencia EXTRA de la carga (p. ej. el 0,3·c de 1,25 + 0,3·c),
   * nunca de la base del golpe. Así cargar un poco más nunca da un golpe claramente más flojo.
   */
  earlyChargeOnly: true,
  /** La penalización de TEMPRANO entra gradualmente desde el borde con BUENO (sin escalón). */
  earlyRamp: true,
  /**
   * Error de TEMPRANO / TARDE acotado y justo: el bote se acorta (nunca más largo) y se desplaza en
   * lateral hasta `maxSigma` desviaciones, siempre DENTRO de la pista (margen `inset`). El timing por sí
   * solo nunca manda la pelota fuera: empeora la colocación (más corta / menos ángulo), no la anula.
   */
  maxSigma: 2,
  inset: 14,
  /** Tope de velocidad (× SHOT_SPEED) que el timing puede alcanzar. Nunca baja una velocidad original. */
  maxSpeedMult: { normal: 1.95, ability: 2.15 },
  /** Efectos (ver src/fx/timingFx.ts). */
  fx: {
    text: { perfect: 'PERFECT!', good: 'BIEN', early: 'PRONTO', late: 'TARDE' } as Partial<Record<TimingGrade, string>>,
    color: { perfect: '#ffe066', good: '#cfe0ff', early: '#ffb38a', late: '#ffb38a' } as Partial<Record<TimingGrade, string>>,
    size: { perfect: 40, good: 20, early: 20, late: 20 } as Partial<Record<TimingGrade, number>>,
    vibrateMs: 30, // algunos motores de vibración de Android ignoran pulsos muy cortos
    shake: { ms: 70, intensity: 0.0025 },
    sound: true,
    volume: 0.35,
  },
};

/** Clasifica la diferencia temporal (ms; negativo = temprano). */
/** tolerancia de coma flotante en los bordes de ventana (los bordes son inclusivos) */
const EPS_MS = 1e-6;

export function classify(deltaMs: number): TimingGrade {
  const a = Math.abs(deltaMs) - EPS_MS;
  if (a <= TIMING.perfectMs) return 'perfect';
  if (a <= TIMING.goodMs) return 'good';
  if (a <= TIMING.offMs) return deltaMs < 0 ? 'early' : 'late';
  return 'off';
}

export interface TimingResult {
  grade: TimingGrade;
  /** ms (negativo = temprano); NaN si no hubo toque */
  deltaMs: number;
}

/**
 * Guarda el último toque y lo evalúa en el contacto. Cada toque se consume UNA vez
 * (evita que un mismo toque puntúe dos golpes).
 */
export class TimingTracker {
  private tapAt: number | null = null;

  /** `t` en segundos del reloj de simulación. */
  registerTap(t: number) {
    this.tapAt = t;
  }

  clear() {
    this.tapAt = null;
  }

  /** Evalúa el contacto en el instante `contactT` (s, reloj de simulación) y consume el toque. */
  evaluate(contactT: number): TimingResult {
    const tap = this.tapAt;
    this.tapAt = null;
    if (tap === null || tap > contactT) return { grade: 'none', deltaMs: NaN };
    const deltaMs = (tap - (contactT - TIMING.idealLeadMs / 1000)) * 1000;
    // toque muy anterior (p. ej. carga larga): no es un intento de timing → comportamiento original
    if (deltaMs < -(TIMING.offMs + 400)) return { grade: 'none', deltaMs };
    return { grade: classify(deltaMs), deltaMs };
  }
}

/**
 * Carga perfecta. `fullAt`: instante (s) en que el medidor llegó al 100 % (null = no llegó).
 * Devuelve 'perfect' / 'good' o 'none' (comportamiento de siempre). Nunca penaliza.
 */
export function evaluateCharge(fullAt: number | null, contactT: number): TimingResult {
  if (!TIMING.chargePerfect || fullAt === null) return { grade: 'none', deltaMs: NaN };
  const deltaMs = (fullAt - contactT) * 1000; // negativo = se llenó antes del contacto
  const a = Math.abs(deltaMs) - EPS_MS;
  return { grade: a <= TIMING.perfectMs ? 'perfect' : a <= TIMING.goodMs ? 'good' : 'none', deltaMs };
}

/** Geometría de la pista que necesita el error (coordenadas lógicas de config.ts). */
export interface CourtBox {
  netX: number;
  right: number;
  top: number;
  bottom: number;
  halfW: number;
}

/**
 * Error de TEMPRANO / TARDE sobre el bote elegido. `g` = generador ~N(0,1).
 * Profundidad: solo acorta (|g|·σ, como mucho maxSigma·σ), sin pasar de la red + 40 ni alargar una dejada.
 * Lateral: ±|g|·σ acotado, y siempre dentro de las líneas laterales (con `inset`).
 */
export function applyError(tx: number, ty: number, mods: TimingMods, c: CourtBox, g: () => number) {
  if (mods.errLat <= 0 && mods.errDep <= 0) return { tx, ty };
  const lim = (v: number) => Math.min(Math.abs(v), TIMING.maxSigma);
  const short = lim(g()) * mods.errDep * (c.right - c.netX);
  const floorX = Math.min(tx, c.netX + 40);
  const nx = Math.max(floorX, tx - short);
  const gl = g();
  const side = Math.sign(gl) * lim(gl) * mods.errLat * c.halfW;
  const lo = Math.min(ty, c.top + TIMING.inset);
  const hi = Math.max(ty, c.bottom - TIMING.inset);
  const ny = Math.min(hi, Math.max(lo, ty + side));
  return { tx: nx, ty: ny };
}

export type ShotClass = 'normal' | 'max' | 'remate' | 'ability';

export interface TimingMods {
  speedMult: number;
  /** true: el multiplicador (< 1) se aplica SOLO a la parte de la velocidad que aporta la carga (TEMPRANO) */
  chargeOnly: boolean;
  marginMult: number;
  /** desviación típica del error (fracción de media pista) */
  errLat: number;
  errDep: number;
}

const NEUTRAL: TimingMods = { speedMult: 1, chargeOnly: false, marginMult: 1, errLat: 0, errDep: 0 };

/**
 * Cuánto de la penalización de potencia de TEMPRANO se aplica según |delta|: 0 en el borde con BUENO
 * y 1 en el borde con FUERA DE TIEMPO (sin escalón al salir de BUENO). Solo potencia, no precisión.
 */
export function earlyRamp(deltaMs: number): number {
  if (!TIMING.earlyRamp || !Number.isFinite(deltaMs)) return 1;
  const r = (Math.abs(deltaMs) - TIMING.goodMs) / (TIMING.offMs - TIMING.goodMs);
  return Math.min(1, Math.max(0, r));
}

/**
 * Modificadores del golpe para una calidad dada, ya escalados por el tipo de golpe.
 * `deltaMs` (opcional) suaviza la potencia de TEMPRANO (ver earlyRamp).
 */
export function timingMods(grade: TimingGrade, cls: ShotClass, kind: string, deltaMs = NaN): TimingMods {
  if (grade === 'none' || grade === 'off' || grade === 'good') return { ...NEUTRAL };
  const k = TIMING.scale[cls];
  const touch = TIMING.touchKinds.includes(kind);
  const err = TIMING.error[grade];
  // TEMPRANO en golpes del jugador (no SMASH ni remate): solo resta de la potencia de la carga
  const chargeOnly = grade === 'early' && TIMING.earlyChargeOnly && (cls === 'normal' || cls === 'max');
  const p = grade === 'early' && chargeOnly ? 1 + (TIMING.power.early - 1) * earlyRamp(deltaMs) : TIMING.power[grade];
  return {
    speedMult: touch ? 1 : 1 + (p - 1) * k,
    chargeOnly: chargeOnly && !touch,
    marginMult: grade === 'perfect' ? 1 + (TIMING.perfectMarginMult - 1) * k : 1,
    errLat: err ? err.lat * k : 0,
    errDep: err ? err.dep * k : 0,
  };
}

/**
 * Velocidad final: aplica el multiplicador y el tope. El tope solo limita lo que AÑADE el timing:
 * si la velocidad original ya era mayor, se respeta.
 */
export function timedSpeed(base: number, mods: TimingMods, shotSpeed: number, cls: ShotClass, chargePart = 0): number {
  const cap = shotSpeed * (cls === 'ability' ? TIMING.maxSpeedMult.ability : TIMING.maxSpeedMult.normal);
  // TEMPRANO: se pierde solo una fracción de lo que aportó la carga; la velocidad base del golpe queda intacta
  if (mods.chargeOnly) return base - Math.max(0, chargePart) * (1 - mods.speedMult);
  const v = base * mods.speedMult;
  if (mods.speedMult <= 1) return v;
  return Math.max(base, Math.min(v, cap));
}
