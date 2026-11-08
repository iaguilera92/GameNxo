import Phaser from 'phaser';
import { COURT, HIT_MAX_Z, HIT_RANGE, NET_X, PLAYER_SPEED, SHOT_SPEED } from '../config';
import { BotAI } from '../logic/BotAI';
import type { BallState, ShotKind } from '../objects/Ball';
import type { BotProfile } from './BotProfile';
import { type BotMode, MOOD, isKeyPoint, nextMode } from './BotMood';

/**
 * Cerebro del rival (IA de partido).
 *
 * Reúne lo que antes vivía dentro de MatchScene:
 *  - movimiento del rival (colocarse para sacar y perseguir la pelota) — con inercia (Etapa 3)
 *  - plan del golpe (a dónde, con qué velocidad y de qué tipo)
 *  - recuperación táctica tras golpear (Etapa 3)
 * y reutiliza `BotAI` (reacción + percepción con ruido + predicción que se corrige).
 *
 * Solo decide: NO toca la física, la puntuación ni las animaciones. La escena aplica el resultado
 * (aimShot, setKind, setMoving…). Mismas fórmulas y mismo orden de llamadas al azar que antes.
 *
 * Próximas etapas (ver auditoría): perfiles de dificultad, percepción con ruido, re-predicción,
 * movimiento con inercia, estrategia de golpes y modos NORMAL / CONCENTRADO / COMPETITIVO.
 */

const rand = Phaser.Math.FloatBetween;
const clamp = Phaser.Math.Clamp;
const LAT_C = (COURT.top + COURT.bottom) / 2;
const HALF_W = (COURT.bottom - COURT.top) / 2;

/** Movimiento con inercia del rival (en múltiplos de su velocidad máxima por segundo). */
const MOVE = {
  accel: 10, // llega a su velocidad máxima en ~0,1 s
  decel: 9, // frena algo más rápido de lo que arranca
  arrive: 3, // px: radio en el que se considera "llegado"
  runAnim: 28, // px/s: por encima se ve corriendo
  recoverFollow: 0.35, // recuperación: fracción hacia el lateral al que mandó su golpe
};

/** Posición/estado del rival que el cerebro puede mover. */
export interface BotBody {
  x: number;
  y: number;
  stun: number;
}

/** Límites de movimiento del rival (en coordenadas de cancha). */
export interface BotBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface BotTickInput {
  dt: number;
  /** fase del partido */
  phase: string;
  /** el rival es quien saca este punto */
  botServes: boolean;
  /** el rival se está colocando para sacar (antes de lanzar) */
  servePositioning: boolean;
  /** lateral donde quiere sacar */
  serveY: number;
  ball: BallState;
}

export interface BotTickResult {
  moving: boolean;
  /** dirección lateral en pantalla (para la animación de carrera) */
  dirX: number;
  /** ya está colocado y pasó la espera: la escena lanza la pelota */
  readyToToss: boolean;
}

/** Tipo de golpe que elige el rival. */
export type ShotIntent = 'normal' | 'deep' | 'angle' | 'drop' | 'lob';

/** Lo que el rival "ve" al golpear. */
export interface ShotContext {
  playerX: number;
  playerY: number;
  botX: number;
  botY: number;
}

export interface ShotPlan {
  tx: number;
  ty: number;
  speed: number;
  kind: ShotKind;
  /** margen sobre la red para aimShot (globo = alto) */
  margin: number;
  intent: ShotIntent;
  /** calidad del contacto 0..1 */
  quality: number;
}

/** Estrategia de golpes (Etapa 4). */
const STRAT = {
  /** hasta esta fracción del alcance el contacto es limpio; más lejos, estirado */
  cleanReach: 0.55,
  /** con calidad por debajo de esto se defiende (globo / normal, sin riesgos) */
  defensiveBelow: 0.35,
  /** riesgo relativo de fallar cada golpe */
  risk: { normal: 1, deep: 1.25, angle: 1.4, drop: 0.8, lob: 0.7 } as Record<ShotIntent, number>,
  /** probabilidad de fallo = outChance × riesgo × (outBase + outBadContact × (1 − calidad)) */
  outBase: 0.6,
  outBadContact: 1.1,
};

export class BotBrain {
  /** reacción + predicción (implementación existente, reutilizada) */
  readonly ai: BotAI;
  /** espera antes de lanzar el saque (s); la fija la escena con el plan de saque */
  serveWait = 0;
  /** velocidad actual del rival (movimiento con inercia) */
  private vel = { x: 0, y: 0 };
  private _mode: BotMode = 'normal';
  /** últimos golpes elegidos (para variar) */
  private lastIntents: [ShotIntent | undefined, ShotIntent | undefined] = [undefined, undefined];

  /**
   * @param profile perfil de dificultad del rival (src/ai/BotProfile.ts). Sin perfil, la dificultad
   *                por defecto de config (BOT_DIFFICULTY), como antes.
   */
  constructor(
    private readonly bounds: BotBounds,
    readonly profile?: BotProfile,
  ) {
    this.ai = new BotAI(profile?.difficulty);
  }

  /** Modo de comportamiento del punto en curso (NORMAL / CONCENTRADO / COMPETITIVO). */
  get mode(): BotMode {
    return this._mode;
  }

  /**
   * Empieza un punto: sortea el modo (con persistencia y más concentración en puntos clave) y aplica
   * su impulso a la dificultad. Pruebas: localStorage 'dev.botMode' fuerza un modo y
   * 'dev.botDebug' = '1' lo muestra en la consola.
   */
  onPointStart(points: readonly [number, number], games: readonly [number, number]) {
    const key = isKeyPoint(points, games);
    let mode = nextMode(this._mode, key);
    const forced = devFlag('dev.botMode');
    if (forced === 'normal' || forced === 'concentrado' || forced === 'competitivo') mode = forced;
    this._mode = mode;
    this.ai.setBoost(MOOD.boost[mode]);
    if (devFlag('dev.botDebug') === '1') console.info(`[rival] punto ${points.join('-')}${key ? ' (clave)' : ''}: modo ${mode}, dificultad ${this.ai.d.toFixed(2)}`);
  }

  /** Dificultad actual (0..1). */
  get difficulty() {
    return this.ai.d;
  }

  /** Un paso de movimiento del rival. Muta `body` (x, y, stun) igual que antes hacía la escena. */
  tick(body: BotBody, inp: BotTickInput): BotTickResult {
    const { dt, phase } = inp;
    if (body.stun > 0) body.stun -= dt;
    const frozen = body.stun > 0 || phase === 'over' || phase === 'intro' || ((phase === 'serve' || phase === 'toss') && inp.botServes);
    if (phase === 'rally') this.ai.update(dt, inp.ball);

    if (inp.botServes && phase === 'serve' && inp.servePositioning) {
      // se coloca sobre su línea de fondo y, pasado un momento, lanza la pelota
      const dy = inp.serveY - body.y;
      const step = Math.min(Math.abs(dy), PLAYER_SPEED * 0.35 * dt);
      body.y += Math.sign(dy) * step;
      this.serveWait -= dt;
      return { moving: Math.abs(dy) > 3, dirX: dy, readyToToss: this.serveWait <= 0 && Math.abs(dy) <= 3 };
    }
    if (frozen) {
      this.vel.x = this.vel.y = 0;
      return { moving: false, dirX: 0, readyToToss: false };
    }

    // persigue el punto que predijo BotAI, con inercia: acelera, corre y frena al llegar
    const max = this.ai.speed;
    const accel = max * MOVE.accel;
    const decel = max * MOVE.decel;
    const dx = this.ai.target.x - body.x;
    const dy = this.ai.target.y - body.y;
    const dist = Math.hypot(dx, dy);
    // velocidad deseada: máxima lejos; al acercarse, la que permite frenar justo en el punto
    const want = dist > MOVE.arrive ? Math.min(max, Math.sqrt(2 * decel * (dist - MOVE.arrive))) : 0;
    const wx = dist > 0.001 ? (dx / dist) * want : 0;
    const wy = dist > 0.001 ? (dy / dist) * want : 0;
    let ax = wx - this.vel.x;
    let ay = wy - this.vel.y;
    const dv = Math.hypot(ax, ay);
    const lim = (want > Math.hypot(this.vel.x, this.vel.y) ? accel : decel) * dt;
    if (dv > lim) {
      ax *= lim / dv;
      ay *= lim / dv;
    }
    this.vel.x += ax;
    this.vel.y += ay;
    body.x += this.vel.x * dt;
    body.y += this.vel.y * dt;
    const cx = clamp(body.x, this.bounds.xMin, this.bounds.xMax);
    const cy = clamp(body.y, this.bounds.yMin, this.bounds.yMax);
    if (cx !== body.x) this.vel.x = 0;
    if (cy !== body.y) this.vel.y = 0;
    body.x = cx;
    body.y = cy;
    const sp = Math.hypot(this.vel.x, this.vel.y);
    return { moving: sp > MOVE.runAnim, dirX: this.vel.y, readyToToss: false }; // +y de cancha = derecha en pantalla
  }

  /**
   * El rival acaba de golpear con este plan: se recoloca (recuperación táctica) un poco hacia el lado
   * al que mandó la pelota, que es desde donde le van a devolver; no siempre al centro.
   */
  onShot(shot: ShotPlan) {
    const ty = clamp(shot.ty, COURT.top, COURT.bottom);
    this.ai.onBotHit(LAT_C + (ty - LAT_C) * MOVE.recoverFollow);
  }

  /**
   * Estrategia del golpe (Etapa 4). Tres pasos:
   *  1. CALIDAD DE CONTACTO (0..1): llegar estirado o con la pelota alta empeora el golpe (error humano real).
   *  2. ELECCIÓN DEL GOLPE según lo que hace el jugador y la dificultad: normal, profundo, cruzado,
   *     dejada o globo; con variedad (no repite mucho el mismo) y defensivo si está muy apurado.
   *  3. EJECUCIÓN: destino, velocidad y margen sobre la red; con error según la calidad y, a veces, fuera.
   * Solo decide números: la física la aplica la escena con aimShot, igual que siempre.
   */
  planShot(ball: BallState, ctx: ShotContext): ShotPlan {
    const ai = this.ai;
    const d = ai.d;
    const away = ctx.playerY > LAT_C ? -1 : 1; // lado contrario al jugador
    const ownLen = NET_X - COURT.left; // largo del campo del jugador

    // 1) calidad de contacto: lo estirado que llega (mismo cálculo de alcance que el juego) y la altura
    const cdx = ball.x - (ctx.botX - 15);
    const cdy = (ball.y - ctx.botY) * 1.25;
    const stretch = Math.hypot(cdx, cdy) / HIT_RANGE;
    let q = 1 - clamp((stretch - STRAT.cleanReach) / (1 - STRAT.cleanReach), 0, 1);
    if (ball.z > HIT_MAX_Z * 0.75) q *= 0.8;

    // 2) lectura del jugador y elección
    const depth = (ctx.playerX - COURT.left) / ownLen; // 0 = en su línea de fondo, 1 = en la red
    const playerAtNet = depth > 0.6;
    const playerDeep = depth < 0.08;
    const w: Record<ShotIntent, number> = {
      normal: 1,
      deep: 0.55 * d * q,
      angle: 0.45 * ai.aimSkill * q,
      drop: (playerDeep ? 0.6 : 0.06) * d * q,
      lob: playerAtNet ? 0.1 + 0.9 * d : 0.04,
    };
    if (q < STRAT.defensiveBelow) {
      // muy apurado: se defiende (sin riesgos); el globo defensivo es cosa de rivales buenos
      w.deep = w.angle = w.drop = 0;
      w.lob += 0.1 + 0.5 * d;
    }
    // variedad: si los dos últimos fueron iguales, ese golpe pierde peso
    const [a, b] = this.lastIntents;
    if (a && a === b) w[a] *= 0.35;
    const intent = pickWeighted(w);
    this.lastIntents = [intent, a];

    // 3) ejecución
    let tx: number;
    let ty: number;
    let speed = SHOT_SPEED * (0.82 + 0.3 * d) * (0.85 + 0.15 * q);
    let margin = 18;
    let kind: ShotKind = 'normal';
    const aimed = () => LAT_C + clamp(away * ai.aimSkill * rand(0.4, 1) + rand(-0.4, 0.4) * (1 - ai.aimSkill), -1, 1) * (HALF_W - 28);
    switch (intent) {
      case 'deep': // profundo de ataque
        tx = NET_X - ownLen * rand(0.8, 0.95);
        ty = aimed();
        speed *= 1.12;
        break;
      case 'angle': // cruzado a la línea lateral
        tx = NET_X - ownLen * rand(0.45, 0.75);
        ty = LAT_C + away * rand(0.75, 1) * (HALF_W - 20);
        kind = 'side';
        break;
      case 'drop': // dejada junto a la red
        tx = NET_X - ownLen * rand(0.1, 0.25);
        ty = LAT_C + away * rand(0.2, 0.7) * (HALF_W - 40);
        speed = SHOT_SPEED * 0.78;
        margin = 8;
        kind = 'drop';
        break;
      case 'lob': // globo alto y profundo (por encima del jugador en la red, o para defenderse)
        tx = NET_X - ownLen * rand(0.82, 0.94);
        ty = LAT_C + away * rand(0.2, 0.8) * (HALF_W - 40);
        speed = SHOT_SPEED * 0.85;
        margin = 75;
        kind = 'lob';
        break;
      default: // normal (el de siempre)
        tx = NET_X - ownLen * rand(0.55, 0.9);
        ty = aimed();
    }
    // imprecisión por mal contacto
    tx += (1 - q) * rand(-60, 60);
    ty += (1 - q) * rand(-90, 90);
    // a veces sale mal: los golpes arriesgados y el mal contacto lo hacen más probable
    if (Math.random() < ai.outChance * STRAT.risk[intent] * (STRAT.outBase + STRAT.outBadContact * (1 - q))) {
      if (intent === 'drop') tx = NET_X + rand(10, 45); // dejada corta: se queda en su campo
      else if (Math.random() < 0.5) tx = COURT.left - rand(15, 55);
      else ty = Math.random() < 0.5 ? COURT.top - rand(15, 45) : COURT.bottom + rand(15, 45);
    }
    return { tx, ty, speed, kind, margin, intent, quality: q };
  }
}

/** Lee una bandera de pruebas de localStorage (null si no hay almacenamiento). */
function devFlag(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Elige una clave al azar según su peso. */
function pickWeighted<K extends string>(w: Record<K, number>): K {
  const keys = Object.keys(w) as K[];
  const total = keys.reduce((s, k) => s + Math.max(0, w[k]), 0);
  let r = Math.random() * total;
  for (const k of keys) {
    r -= Math.max(0, w[k]);
    if (r <= 0) return k;
  }
  return keys[0];
}
