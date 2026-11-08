/**
 * DASH avanzado (opción B): SPRINT visible hacia la pelota, sin teletransporte. Lógica pura (sin Phaser ni
 * imports) para probarla con node: tools/test-dash.mjs. Efectos en src/fx/dashFx.ts; integración en MatchScene.
 *
 * Fases (tiempo de simulación, posición en forma cerrada → igual a cualquier FPS):
 *   start   arranque: agachado + polvo, en el sitio                     DASH.startS
 *   sprint  carrera a velocidad constante (2,5× … 3,5× la normal)       (distancia − frenada) / velocidad
 *   land    frenada: desliza los últimos `landSlide` y para              DASH.landS
 *   done    libre (movimiento normal con inercia, desde 0)
 *
 * Devolución garantizada como el DASH de siempre, mientras el jugador no se aleje más de `leash` del punto
 * de llegada. Un contacto normal antes (durante el sprint o la espera) sigue la lógica de golpes de siempre.
 */
export const DASH = {
  /** Interruptor general. También: localStorage 'dev.dashSprint' = '0' → DASH de teletransporte de siempre. */
  enabled: true,
  /** velocidad del sprint (× velocidad normal del jugador): base y tope solo si hace falta para llegar */
  baseMult: 2.5,
  maxMult: 3.5,
  startS: 0.07,
  landS: 0.11,
  /**
   * DASH de urgencia: si ni a 3,5× llega con las transiciones normales, arranque y frenada más cortos (mismo
   * tope de velocidad). Así se conserva el alcance del DASH de teletransporte (casos ~0,05 %).
   */
  quick: { startS: 0.03, landS: 0.06 },
  /** unidades que recorre frenando (dentro de landS) */
  landSlide: 10,
  /** si al esperar se aleja más que esto del punto de llegada, pierde la devolución garantizada */
  leash: 45,
  /** sombras: 3 posiciones reales del recorrido (al 25 / 50 / 75 % del sprint) */
  ghosts: 3,
  ghostAlpha: [0.26, 0.38, 0.5],
  ghostTint: 0x8f7cff,
  ghostHoldMs: 60,
  ghostFadeMs: 260,
  /** recorridos muy cortos: sin sombras (se amontonarían) */
  ghostMinDist: 40,
};

export interface Pt {
  x: number;
  y: number;
}
export interface Bounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}
export interface DashSample {
  t: number;
  x: number;
  y: number;
  /** tras el 1er bote y a altura cómoda (lo que prefiere el DASH de siempre) */
  good: boolean;
}
export interface SprintPlan {
  /** punto de llegada (ya dentro de los límites del jugador) */
  x: number;
  y: number;
  /** instante (s desde ahora) en que la pelota pasa por el punto de golpeo */
  t: number;
  mult: number;
  dist: number;
  /** transiciones del recorrido (normales o de urgencia); sin ellas, las normales */
  startS?: number;
  landS?: number;
}

interface BallLike {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

/**
 * Muestras de la trayectoria con las MISMAS reglas que MatchScene.dashPlan: hasta el 2º bote en el campo del
 * jugador, a más de 30 de la red, dentro de su zona ampliada y a altura de golpe. `step` = stepBall.
 * null = va a la red.
 */
export function sampleTrajectory(
  ball: BallLike,
  bounces: number,
  step: (s: BallLike, dt: number) => string | null,
  netX: number,
  maxZ: number,
  box: Bounds,
): DashSample[] | null {
  const s = { ...ball };
  const out: DashSample[] = [];
  const dt = 1 / 120;
  for (let t = 0; t < 4; t += dt) {
    const ev = step(s, dt);
    if (ev === 'net') return null;
    if (ev === 'bounce' && s.x < netX && ++bounces >= 2) break;
    if (s.x > netX - 30) continue;
    const reachable = s.x >= box.xMin && s.x <= box.xMax && s.y >= box.yMin && s.y <= box.yMax && s.z < maxZ * 0.85;
    if (!reachable) continue;
    out.push({ t, x: s.x, y: s.y, good: bounces >= 1 && s.z < maxZ * 0.7 });
  }
  return out;
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Punto de llegada para golpear la pelota en `p` (igual que el DASH de siempre: 18 por detrás). */
export function arrivalPoint(p: Pt, b: Bounds): Pt {
  return { x: clamp(p.x - 18, b.xMin, b.xMax), y: clamp(p.y, b.yMin, b.yMax) };
}

export interface Timing {
  startS: number;
  landS: number;
}
const NORMAL: Timing = { startS: DASH.startS, landS: DASH.landS };

/** Segundos desde que se pulsa hasta quedar parado en el punto (recorrido `dist` a `mult`). */
export function arrivalTime(dist: number, mult: number, maxSpeed: number, tm: Timing = NORMAL) {
  const run = Math.max(0, dist - Math.min(dist, DASH.landSlide));
  return tm.startS + run / (maxSpeed * mult) + tm.landS;
}

/**
 * Elige el punto: con 2,5× el primero tras el bote (si no, el primero alcanzable: volea); si a 2,5× no llega a
 * ninguno, la velocidad JUSTA hasta 3,5×; si tampoco, lo mismo con las transiciones de urgencia (DASH.quick).
 * null = imposible (como el "¡Muy tarde!" de siempre).
 */
export function planSprint(samples: DashSample[], from: Pt, maxSpeed: number, bounds: Bounds): SprintPlan | null {
  const dist = (p: DashSample) => {
    const a = arrivalPoint(p, bounds);
    return Math.hypot(a.x - from.x, a.y - from.y);
  };
  const pick = (f: (p: DashSample) => boolean) => samples.find((p) => p.good && f(p)) ?? samples.find(f) ?? null;
  for (const tm of [NORMAL, DASH.quick]) {
    const ok = (m: number) => (p: DashSample) => arrivalTime(dist(p), m, maxSpeed, tm) <= p.t + 1e-9;
    let p = pick(ok(DASH.baseMult));
    let mult = DASH.baseMult;
    if (!p) {
      p = pick(ok(DASH.maxMult));
      if (!p) continue;
      const d = dist(p);
      const run = Math.max(0, d - Math.min(d, DASH.landSlide));
      const avail = p.t - tm.startS - tm.landS;
      mult = clamp(avail > 0 ? run / (maxSpeed * avail) : DASH.maxMult, DASH.baseMult, DASH.maxMult);
    }
    const a = arrivalPoint(p, bounds);
    return { x: a.x, y: a.y, t: p.t, mult, dist: Math.hypot(a.x - from.x, a.y - from.y), startS: tm.startS, landS: tm.landS };
  }
  return null;
}

export type DashPhase = 'start' | 'sprint' | 'land' | 'done';

export interface DashRun {
  from: Pt;
  to: Pt;
  mult: number;
  speed: number;
  dist: number;
  slide: number;
  /** duración de la fase sprint */
  sprintS: number;
  /** transiciones de este recorrido (normales o de urgencia) */
  startS: number;
  landS: number;
  elapsed: number;
  phase: DashPhase;
  ghostsMade: number;
  /** lado de la pantalla hacia el que corre (+1 derecha, −1 izquierda, 0 = solo profundidad) */
  dirX: number;
}

export function createRun(from: Pt, plan: SprintPlan, maxSpeed: number): DashRun {
  const dist = Math.hypot(plan.x - from.x, plan.y - from.y);
  const slide = Math.min(dist, DASH.landSlide);
  const speed = maxSpeed * plan.mult;
  const dy = plan.y - from.y;
  return {
    from: { ...from },
    to: { x: plan.x, y: plan.y },
    mult: plan.mult,
    speed,
    dist,
    slide,
    sprintS: (dist - slide) / speed,
    startS: plan.startS ?? DASH.startS,
    landS: plan.landS ?? DASH.landS,
    elapsed: 0,
    phase: 'start',
    ghostsMade: 0,
    dirX: Math.abs(dy) > Math.max(6, dist * 0.2) ? Math.sign(dy) : 0, // en cancha +y = derecha en pantalla
  };
}

export function phaseAt(r: DashRun, e: number): DashPhase {
  if (e < r.startS) return 'start';
  if (e < r.startS + r.sprintS) return 'sprint';
  if (e < r.startS + r.sprintS + r.landS) return 'land';
  return 'done';
}

/** Distancia recorrida a los `e` s (forma cerrada). */
export function travelled(r: DashRun, e: number): number {
  const ts = e - r.startS;
  if (ts <= 0) return 0;
  if (ts < r.sprintS) return r.speed * ts;
  const tl = ts - r.sprintS;
  if (tl >= r.landS) return r.dist;
  const u = tl / r.landS;
  return r.dist - r.slide + r.slide * (1 - (1 - u) * (1 - u)); // frena: desliza y para
}

export function positionAt(r: DashRun, e: number): Pt {
  const k = r.dist > 1e-9 ? travelled(r, e) / r.dist : 1;
  return { x: r.from.x + (r.to.x - r.from.x) * k, y: r.from.y + (r.to.y - r.from.y) * k };
}

export interface RunStep {
  pos: Pt;
  phase: DashPhase;
  /** fase en la que acaba de entrar en este paso (null = la misma) */
  entered: DashPhase | null;
  /** índices de sombras a crear AHORA (en la posición real de este instante) */
  ghosts: number[];
}

/** Avanza el DASH `dt` s. */
export function stepRun(r: DashRun, dt: number): RunStep {
  const prev = r.phase;
  r.elapsed += dt;
  r.phase = phaseAt(r, r.elapsed);
  const ghosts: number[] = [];
  if (r.dist >= DASH.ghostMinDist) {
    const sprintDone = Math.max(0, Math.min(1, (r.elapsed - r.startS) / Math.max(1e-9, r.sprintS)));
    while (r.ghostsMade < DASH.ghosts && sprintDone >= (r.ghostsMade + 1) / (DASH.ghosts + 1)) ghosts.push(r.ghostsMade++);
  }
  return { pos: positionAt(r, r.elapsed), phase: r.phase, entered: r.phase !== prev ? r.phase : null, ghosts };
}

/** El DASH en curso se cancela: golpe ya hecho (normal, SMASH, INFERNO), cinemática especial o fin del peloteo. */
export function shouldCancelRun(ctx: { rally: boolean; playerHit: boolean; specialActive: boolean }): boolean {
  return !ctx.rally || ctx.playerHit || ctx.specialActive;
}

export interface Guarantee {
  /** instante previsto del golpe (s desde la activación) */
  t: number;
  elapsed: number;
  x: number;
  y: number;
}

/**
 * Devolución garantizada del sprint, cada fotograma: 'drop' (ya golpeó / fin del peloteo / se alejó a propósito),
 * 'force' (golpe forzado, una vez) o 'keep'.
 */
export function guaranteeStep(
  g: Guarantee,
  dt: number,
  ctx: { rally: boolean; playerHit: boolean; running: boolean; px: number; py: number; ballOk: boolean },
): 'keep' | 'force' | 'drop' {
  if (!ctx.rally || ctx.playerHit) return 'drop';
  g.elapsed += dt;
  if (!ctx.running && Math.hypot(ctx.px - g.x, ctx.py - g.y) > DASH.leash) return 'drop';
  if (!ctx.running && g.elapsed >= g.t + 0.02 && ctx.ballOk) return 'force';
  return 'keep';
}
