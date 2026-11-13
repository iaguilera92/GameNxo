import Phaser from 'phaser';
import { COURT, DASH_COOLDOWN, HIT_MAX_Z, HIT_RANGE, NET_X, PLAYER_SPEED, SHOT_SPEED, SMASH_COOLDOWN, SMASH_SPEED_MULT } from '../config';
import { BotAI } from '../logic/BotAI';
import { INFERNO } from '../logic/InfernoDrive';
import type { BallState, ShotKind } from '../objects/Ball';
import type { BotProfile, BotTier } from './BotProfile';
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
  /** (Claude) saque o su resto en juego: sin habilidades (no decide DASH) */
  noAbilities?: boolean;
}

export interface BotTickResult {
  moving: boolean;
  /** DASH del rival: empieza / termina el sprint en este paso */
  sprint?: SprintEvt;
  /** con sprint 'end': terminó llegando al punto (la escena pone la frenada); false = cortado lejos (sigue corriendo) */
  landed?: boolean;
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
  /** SMASH del rival: bola de fuego (si la tocas, quedas aturdido) */
  power?: boolean;
  /** ULTI del rival (INFERNO DRIVE): además de `power`, la escena pone la esfera de fuego y los efectos del poder */
  ulti?: boolean;
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

/**
 * Habilidades del rival (como el jugador): DEFENSIVO (DASH: sprint cuando no llega), ESPECIAL (SMASH: bola de fuego)
 * y ULTI (INFERNO: se carga con 3 puntos ganados, como la tuya).
 * Por tramo: `dash` / `smash` / `ulti` = probabilidad de usarla cuando la situación lo pide (0 = no la tiene);
 * `cd` = multiplicador del enfriamiento (los flojos tardan más en recargar). Todos los tramos tienen ESPECIAL y ULTI
 * (si no, contra rivales de nivel bajo nunca se verían); los más flojos la usan menos.
 * power = velocidad de sus tiros de poder (ESPECIAL y ULTI) respecto a SMASH_AI.speedK: los niveles bajos los lanzan más
 * lentos para que un jugador nuevo pueda alcanzarlos (medido con tools/sim-balance.mjs: a velocidad completa, el
 * ESPECIAL del nivel más bajo ganaba el 99 % de los puntos en que lo usaba; con 0,7 baja a ~60 %).
 */
const ABIL: Record<BotTier, { dash: number; smash: number; ulti: number; cd: number; power: number }> = {
  principiante: { dash: 0, smash: 0.2, ulti: 0.4, cd: 1.6, power: 0.7 },
  facil: { dash: 0.4, smash: 0.3, ulti: 0.55, cd: 1.4, power: 0.75 },
  normal: { dash: 0.65, smash: 0.42, ulti: 0.7, cd: 1.2, power: 0.85 },
  dificil: { dash: 0.85, smash: 0.55, ulti: 0.85, cd: 1, power: 0.9 },
  experto: { dash: 1, smash: 0.7, ulti: 1, cd: 0.85, power: 1 },
};
const DASH_AI = {
  /** se lanza si al punto previsto le faltan más de estos s a su velocidad normal */
  needS: 0.62,
  /** duración del sprint (s) y multiplicador de velocidad */
  time: 0.34,
  mult: 2.4,
  /**
   * Solo animación: a esta distancia (px) del punto el sprint termina con la frenada de la hoja. A 2,4× empieza a frenar
   * a ~40 px y le quedan ~0,1 s, lo que dura la frenada. La velocidad extra sigue hasta acabar `time` (mismo juego).
   */
  landDist: 30,
};
const SMASH_AI = {
  /**
   * contacto mínimo para intentarlo. 0 = sin exigencia: el rival golpea en cuanto la pelota entra en su alcance, así que su
   * calidad de contacto casi nunca pasa de 0,15 (medido con tools/sim-balance.mjs: 100 % de los golpes < 0,3). Con 0,6 el
   * ESPECIAL no salía nunca.
   */
  minQuality: 0,
  /** velocidad respecto al SMASH del jugador (algo menos: que se pueda leer) */
  speedK: 0.9,
};
const ULTI_AI = {
  /** contacto mínimo para lanzar la ulti (0 = sin exigencia, por lo mismo que SMASH_AI.minQuality) */
  minQuality: 0,
  /** el desplazamiento de la ulti acerca al rival a la pelota esta fracción de la distancia (como el jugador) */
  moveToBall: 0.35,
};

/** Evento del sprint del DASH en este paso (la escena pone la animación). */
export type SprintEvt = 'start' | 'end' | null;

export class BotBrain {
  /**
   * PRUEBAS del DUELO EN LA RED (temporal; lo enciende MatchScene solo en el primer juego): el rival solo hace peloteo suave
   * hacia ti, sin ESPECIAL, ULTI, DASH, globos ni dejadas ni errores, y sale a volear cerca de la red.
   */
  netPractice = false;
  /** enfriamientos restantes de las habilidades (s) */
  private dashCd = 0;
  private smashCd = 0;
  /** carga de la ULTI: puntos ganados por el rival (INFERNO.pointsToCharge = lista), como la del jugador */
  private ultiCharge = 0;
  /** s que le quedan de sprint (DASH en curso) */
  private dashT = 0;
  /** la animación del sprint sigue en pantalla (termina al llegar al punto o al acabar dashT) */
  private dashAnim = false;
  /** ya decidió si usar el DASH para la pelota que viene */
  private dashDecided = false;
  private wasReading = false;
  private get abil() {
    return ABIL[this.profile?.tier ?? 'normal'];
  }
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
    // el SMASH no está listo desde el primer punto (tarda medio enfriamiento)
    this.smashCd = SMASH_COOLDOWN * 0.5 * this.abil.cd;
  }

  /** El rival ganó un punto: +1 de carga de la ULTI (hasta el máximo). */
  onPointWon() {
    this.ultiCharge = Math.min(INFERNO.pointsToCharge, this.ultiCharge + 1);
  }

  /** ULTI cargada (se consume al lanzarla: planShot con `ulti`). */
  get ultiReady() {
    return this.ultiCharge >= INFERNO.pointsToCharge;
  }

  /** Puntos de carga de la ULTI (para pruebas). */
  get ultiPoints() {
    return this.ultiCharge;
  }

  /**
   * Calidad del contacto (0..1): lo estirado que llega a la pelota (mismo cálculo de alcance que el juego) y la altura.
   * La usan planShot y wantsUlti.
   */
  private contactQuality(ball: BallState, ctx: ShotContext): number {
    const cdx = ball.x - (ctx.botX - 15);
    const cdy = (ball.y - ctx.botY) * 1.25;
    const stretch = Math.hypot(cdx, cdy) / HIT_RANGE;
    let q = 1 - clamp((stretch - STRAT.cleanReach) / (1 - STRAT.cleanReach), 0, 1);
    if (ball.z > HIT_MAX_Z * 0.75) q *= 0.8;
    return q;
  }

  /**
   * ¿Lanza la ULTI con este golpe? Cargada, con buen contacto y según su tramo (más a menudo en puntos con tensión).
   * La escena lo pregunta UNA vez por golpe, cuando la pelota ya está a su alcance; si es true, hace la cinemática y
   * luego llama a planShot(…, true).
   */
  wantsUlti(ball: BallState, ctx: ShotContext): boolean {
    if (this.netPractice || !this.ultiReady || this.abil.ulti <= 0) return false;
    if (this.contactQuality(ball, ctx) < ULTI_AI.minQuality) return false;
    const mood = this._mode === 'competitivo' ? 1.2 : this._mode === 'concentrado' ? 1.1 : 1;
    return Math.random() < Math.min(1, this.abil.ulti * mood);
  }

  /** Fracción de la distancia a la pelota que avanza el rival durante el desplazamiento de la ULTI. */
  get ultiMoveToBall() {
    return ULTI_AI.moveToBall;
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
    this.dashT = 0;
    this.dashDecided = false;
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
    if (phase !== 'intro' && phase !== 'over') {
      this.dashCd = Math.max(0, this.dashCd - dt);
      this.smashCd = Math.max(0, this.smashCd - dt);
    }
    // DASH: al empezar a leer cada golpe tuyo decide UNA vez si sprinta (no llegaría a tiempo)
    let sprint: SprintEvt = null;
    const reading = phase === 'rally' && this.ai.reading;
    if (reading && !this.wasReading) this.dashDecided = false;
    this.wasReading = reading;
    if (reading && !this.dashDecided && !frozen) {
      this.dashDecided = true;
      const need = Math.hypot(this.ai.target.x - body.x, this.ai.target.y - body.y) / this.ai.speed;
      if (!inp.noAbilities && !this.netPractice && this.dashCd <= 0 && need > DASH_AI.needS && Math.random() < this.abil.dash) {
        this.dashT = DASH_AI.time;
        this.dashCd = DASH_COOLDOWN * this.abil.cd;
        this.dashAnim = true;
        sprint = 'start';
      }
    }
    if (this.dashT > 0 && sprint !== 'start') {
      this.dashT -= dt;
      if (this.dashT <= 0 || frozen) {
        this.dashT = 0;
        if (this.dashAnim) sprint = 'end';
        this.dashAnim = false;
      }
    }

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
      return { moving: false, dirX: 0, readyToToss: false, sprint };
    }

    // persigue el punto que predijo BotAI, con inercia: acelera, corre y frena al llegar
    const dashing = this.dashT > 0;
    const max = this.ai.speed * (dashing ? DASH_AI.mult : 1);
    const accel = max * MOVE.accel * (dashing ? 2 : 1);
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
    // DASH: al llegar al punto, la animación del sprint termina con la frenada (la velocidad extra sigue hasta dashT)
    const near = Math.hypot(this.ai.target.x - body.x, this.ai.target.y - body.y) <= DASH_AI.landDist;
    let landed = sprint === 'end' && near;
    if (this.dashAnim && sprint === null && near) {
      this.dashAnim = false;
      sprint = 'end';
      landed = true;
    }
    return { moving: sp > MOVE.runAnim, dirX: this.vel.y, readyToToss: false, sprint, landed }; // +y de cancha = derecha en pantalla
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
  /** ¿Tiene el ESPECIAL listo? (recarga cumplida y su nivel lo usa). Lo usa la escena para el alcance extra. */
  get smashReady(): boolean {
    return !this.netPractice && this.smashCd <= 0 && this.abil.smash > 0;
  }

  /** Probabilidad de usar el ESPECIAL en un golpe (la misma que planShot, según su modo). */
  get smashChance(): number {
    return this.abil.smash * (this._mode === 'competitivo' ? 1.35 : this._mode === 'concentrado' ? 1.15 : 1);
  }

  /**
   * `noPower` (Claude): saque o su resto en juego: no lanza el ESPECIAL con este golpe.
   * `forcePower` (Claude): llegó con el alcance extra del ESPECIAL: este golpe ES el ESPECIAL (si está listo).
   */
  planShot(ball: BallState, ctx: ShotContext, ulti = false, noPower = false, forcePower = false): ShotPlan {
    const ai = this.ai;
    const d = ai.d;
    const away = ctx.playerY > LAT_C ? -1 : 1; // lado contrario al jugador
    const ownLen = NET_X - COURT.left; // largo del campo del jugador

    // 1) calidad de contacto: lo estirado que llega (mismo cálculo de alcance que el juego) y la altura
    const q = this.contactQuality(ball, ctx);

    const depth = (ctx.playerX - COURT.left) / ownLen; // 0 = en su línea de fondo, 1 = en la red

    // PRUEBAS del duelo en la red: peloteo suave, justo hacia donde está el jugador (que lo pueda volear), sin riesgos
    if (this.netPractice) {
      this.lastIntents = ['normal', this.lastIntents[0]];
      return {
        tx: clamp(ctx.playerX + rand(-40, 10), COURT.left + 60, NET_X - 30),
        ty: clamp(ctx.playerY + rand(-35, 35), COURT.top + 30, COURT.bottom - 30),
        speed: SHOT_SPEED * 0.6,
        kind: 'normal',
        margin: 38,
        intent: 'normal',
        quality: q,
      };
    }

    // ULTI (INFERNO DRIVE): la escena ya hizo la cinemática; golpe de máxima potencia lejos del jugador. Gasta la carga.
    if (ulti) {
      this.ultiCharge = 0;
      this.lastIntents = ['deep', this.lastIntents[0]];
      return {
        tx: NET_X - ownLen * rand(0.75, 0.92),
        ty: ctx.playerY > LAT_C ? COURT.top + rand(25, 60) : COURT.bottom - rand(25, 60),
        speed: SHOT_SPEED * SMASH_SPEED_MULT * INFERNO.speedMult * SMASH_AI.speedK * this.abil.power,
        kind: 'normal',
        margin: 6,
        intent: 'deep',
        quality: q,
        power: true,
        ulti: true,
      };
    }

    // SMASH (habilidad): con buen contacto y la habilidad cargada; más a menudo en puntos con tensión
    // (modo COMPETITIVO) o con el jugador en la red (poco tiempo para esquivarla)
    if (!noPower && this.smashCd <= 0 && this.abil.smash > 0 && q >= SMASH_AI.minQuality) {
      const want = this.abil.smash * (this._mode === 'competitivo' ? 1.35 : this._mode === 'concentrado' ? 1.15 : 1) * (depth > 0.5 ? 1.3 : 1);
      if (forcePower || Math.random() < want) {
        this.smashCd = SMASH_COOLDOWN * this.abil.cd;
        this.lastIntents = ['deep', this.lastIntents[0]];
        return {
          tx: NET_X - ownLen * rand(0.7, 0.9),
          ty: ctx.playerY > LAT_C ? COURT.top + rand(25, 60) : COURT.bottom - rand(25, 60), // lejos del jugador
          speed: SHOT_SPEED * SMASH_SPEED_MULT * SMASH_AI.speedK * this.abil.power,
          kind: 'normal',
          margin: 6,
          intent: 'deep',
          quality: q,
          power: true,
        };
      }
    }

    // 2) lectura del jugador y elección
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
