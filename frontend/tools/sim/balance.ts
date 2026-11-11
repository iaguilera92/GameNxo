/**
 * SIMULACIÓN DE BALANCE (sin pantalla): bot contra bot con las habilidades (Defensivo/dash, Especial/smash, Ulti/inferno).
 * La arranca tools/sim-balance.mjs (la empaqueta con esbuild y sustituye Phaser por un stub mínimo).
 *
 * USA EL CÓDIGO REAL de: ai/BotBrain (movimiento, plan de golpe, habilidades), logic/BotAI, objects/Ball (stepBall, aimShot),
 * logic/Score, logic/PowerImpact y las constantes de config.ts. Lo que NO es real y está modelado aquí (resumen en
 * docs/BALANCE.md): el saque (calidad por probabilidades, no por pulsaciones), el golpe de la ULTI (se hace al instante,
 * sin los 2 s de cinemática), la Zona, la pared del fondo (da los mismos resultados que el 2º bote / bote fuera) y el
 * jugador humano (aquí los dos lados son el mismo cerebro). Sirve para comparar configuraciones, no para predecir
 * un valor absoluto.
 *
 * El lado B (derecha) es como el bot del juego; el lado A (izquierda) usa el MISMO cerebro con el campo espejado.
 */
import { BotBrain, type BotBody, type ShotPlan } from '../../src/ai/BotBrain';
import { profileForLevel } from '../../src/ai/BotProfile';
import type { BotTier } from '../../src/ai/BotProfile';
import { Score } from '../../src/logic/Score';
import { aimShot, isInCourt, stepBall, type BallState } from '../../src/objects/Ball';
import { BOT_SERVE, COURT, HIT_MAX_Z, HIT_RANGE, NET_X, SERVE, SERVE_SPEED, SHOT_SPEED, SIDE_MARGIN } from '../../src/config';
import { knockbackX, stunSeconds } from '../../src/logic/PowerImpact';

type SideId = 0 | 1; // 0 = A (izquierda), 1 = B (derecha); igual que Score
const LAT_C = (COURT.top + COURT.bottom) / 2;
const HALF_W = (COURT.bottom - COURT.top) / 2;
const B_X: [number, number] = [NET_X + 45, COURT.right + 130];
const Y_MIN = COURT.top - SIDE_MARGIN;
const Y_MAX = COURT.bottom + SIDE_MARGIN;
const BOUNDS = { xMin: B_X[0], xMax: B_X[1], yMin: Y_MIN, yMax: Y_MAX };
/** tiempo "muerto" entre punto y punto durante el que corren las recargas: marcador (2,35 s) + espera del saque + saque */
const DEAD_S = 2.35 + 1.2 + 1.0;
const DT = 1 / 60;
const SUB = 3;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2;
const mx = (x: number) => 2 * NET_X - x;

export const TIER_LEVEL: Record<BotTier, number> = { principiante: 1, facil: 4, normal: 9, dificil: 17, experto: 25 };
export const TIERS = Object.keys(TIER_LEVEL) as BotTier[];

export interface Abilities {
  dash: boolean;
  smash: boolean;
  ulti: boolean;
}
/** ajustes de prueba (qué pasaría si...): 0 / null = los valores reales del juego */
export const CFG = {
  /** recarga del Especial y del Defensivo en s (se multiplica por el factor de recarga de cada nivel) */
  smashCd: 0,
  dashCd: 0,
  /** tabla de uso por nivel que sustituye a ABIL de BotBrain */
  table: null as null | Record<string, { dash: number; smash: number; ulti: number; cd: number; power: number }>,
  /** multiplicador de la velocidad de los tiros de poder (ESPECIAL y ULTI); 1 = como el juego */
  powerSpeed: 1,
  /** igual, pero por nivel de rival (si existe, manda sobre powerSpeed) */
  powerSpeedByTier: null as null | Record<string, number>,
  /** segundos de aturdimiento al alcanzar un tiro de poder; 0 = POWER_IMPACT.stunMs */
  stunS: 0,
  /** velocidad de la devolución floja tras alcanzarlo, sobre SHOT_SPEED; 0,55 = como el juego */
  weakK: 0.55,
};
export const ALL: Abilities = { dash: true, smash: true, ulti: true };
export const NONE: Abilities = { dash: false, smash: false, ulti: false };

interface SideStats {
  pointsWon: number;
  /** usos de cada habilidad */
  dash: number;
  smash: number;
  ulti: number;
  /** puntos en los que usó cada una, y cuántos de esos ganó */
  dashPts: number;
  dashWon: number;
  smashPts: number;
  smashWon: number;
  ultiPts: number;
  ultiWon: number;
  /** tiros de poder (smash + ulti) que lanzó: rival los alcanzó (aturdido) / nadie los tocó (punto) / error propio */
  shotReached: number;
  shotAce: number;
  shotError: number;
  /** veces que este lado recibió un tiro de poder y lo alcanzó */
  gotStunned: number;
}
const newStats = (): SideStats => ({ pointsWon: 0, dash: 0, smash: 0, ulti: 0, dashPts: 0, dashWon: 0, smashPts: 0, smashWon: 0, ultiPts: 0, ultiWon: 0, shotReached: 0, shotAce: 0, shotError: 0, gotStunned: 0 });

class Agent {
  readonly brain: BotBrain;
  /** posición en el campo PROPIO (espejado para el lado A) */
  body: BotBody = { x: COURT.right + 40, y: LAT_C, stun: 0 };
  stats = newStats();
  /** banderas del punto en curso */
  used = { dash: false, smash: false, ulti: false };
  constructor(readonly id: SideId, readonly tier: BotTier, abil: Abilities) {
    this.brain = new BotBrain(BOUNDS, profileForLevel(TIER_LEVEL[tier]));
    const b = this.brain as unknown as Record<string, unknown>;
    // habilidades apagadas: nunca disponibles (el resto del cerebro es el real)
    if (!abil.dash) b.dashCd = 1e9;
    if (!abil.smash) b.smashCd = 1e9;
    if (!abil.ulti) this.brain.wantsUlti = () => false;
    if (CFG.table) Object.defineProperty(this.brain, 'abil', { get: () => CFG.table![tier] });
    const cd = (b as unknown as { abil: { cd: number } }).abil.cd;
    if (abil.smash && CFG.smashCd) b.smashCd = CFG.smashCd * 0.5 * cd;
  }
  get mirror() {
    return this.id === 0;
  }
  /** de coordenadas del mundo a las del campo propio, y al revés (el espejo es su propia inversa) */
  fx(x: number) {
    return this.mirror ? mx(x) : x;
  }
  world() {
    return { x: this.fx(this.body.x), y: this.body.y };
  }
  /** la pelota vista desde el campo propio */
  view(b: BallState): BallState {
    return this.mirror ? { ...b, x: mx(b.x), vx: -b.vx } : b;
  }
}

export interface MatchResult {
  winner: SideId;
  durationS: number;
  points: number;
  games: [number, number];
  stats: [SideStats, SideStats];
  rallyS: number[];
  /** golpes totales y puntos que se agotaron sin resolverse (si hay muchos, algo no cuadra) */
  hits: number;
  timeouts: number;
  /** calidad de contacto de los golpes: <0,3 / 0,3-0,6 / >=0,6 (la ESPECIAL y la ULTI piden >= 0,6) */
  quality: [number, number, number];
}

/** estado de la pelota y reglas del punto en curso */
interface Rally {
  ball: BallState & { power: boolean };
  lastHitter: SideId | null;
  bounces: number;
  serving: boolean;
  /** quién lanzó el tiro de poder en vuelo y de qué tipo */
  powerOwner: SideId | null;
  powerKind: 'smash' | 'ulti' | null;
}

function serveBox(server: SideId, srvY: number) {
  const sl = (NET_X - COURT.left) * 0.538;
  const x0 = server === 0 ? NET_X : NET_X - sl;
  const x1 = server === 0 ? NET_X + sl : NET_X;
  const upper = srvY > LAT_C;
  return { x0, x1, y0: upper ? COURT.top : LAT_C, y1: upper ? LAT_C : COURT.bottom };
}

export function playMatch(tierA: BotTier, abilA: Abilities, tierB: BotTier, abilB: Abilities): MatchResult {
  const A = new Agent(0, tierA, abilA);
  const B = new Agent(1, tierB, abilB);
  const ag: [Agent, Agent] = [A, B];
  const score = new Score();
  let timeS = 0;
  let nPoints = 0;
  let hits = 0;
  let timeouts = 0;
  const quality: [number, number, number] = [0, 0, 0];
  const rallyS: number[] = [];

  /** el rival de `a` */
  const other = (a: Agent) => ag[a.id === 0 ? 1 : 0];

  const tickBrains = (r: Rally | null, dt: number, phase: string) => {
    for (const a of ag) {
      const res = a.brain.tick(a.body, {
        dt,
        phase,
        botServes: false,
        servePositioning: false,
        serveY: 0,
        ball: r ? a.view(r.ball) : { x: COURT.right, y: LAT_C, z: 0, vx: 0, vy: 0, vz: 0 },
      });
      if (res.sprint === 'start') {
        if (CFG.dashCd) (a.brain as unknown as { dashCd: number }).dashCd = CFG.dashCd * (a.brain as unknown as { abil: { cd: number } }).abil.cd;
        a.stats.dash++;
        a.used.dash = true;
      }
    }
  };

  /** ¿alcanza `a` la pelota? (misma fórmula que MatchScene.inReach, sin Zona) */
  const inReach = (a: Agent, b: BallState) => {
    const v = a.view(b);
    const dx = v.x - (a.body.x - 15);
    const dy = (v.y - a.body.y) * 1.25;
    return Math.sqrt(dx * dx + dy * dy) < HIT_RANGE && v.z < HIT_MAX_Z;
  };

  /** golpea `a`: plan del cerebro (golpe normal, ESPECIAL o ULTI) y física real */
  const hit = (a: Agent, r: Rally) => {
    const o = other(a);
    const own = a.view(r.ball);
    const ow = o.world();
    const ctx = { playerX: a.fx(ow.x), playerY: ow.y, botX: a.body.x, botY: a.body.y };
    let plan: ShotPlan;
    let kind: 'smash' | 'ulti' | null = null;
    if (a.brain.wantsUlti(own, ctx)) {
      plan = a.brain.planShot(own, ctx, true);
      kind = 'ulti';
      a.stats.ulti++;
      a.used.ulti = true;
    } else {
      plan = a.brain.planShot(own, ctx);
      if (plan.power) {
        kind = 'smash';
        if (CFG.smashCd) (a.brain as unknown as { smashCd: number }).smashCd = CFG.smashCd * (a.brain as unknown as { abil: { cd: number } }).abil.cd;
        a.stats.smash++;
        a.used.smash = true;
      }
    }
    r.ball.z = Math.max(r.ball.z, 22);
    aimShot(r.ball, a.fx(plan.tx), plan.ty, plan.speed * (plan.power ? (CFG.powerSpeedByTier?.[a.tier] ?? CFG.powerSpeed) : 1), plan.margin);
    r.ball.power = !!plan.power;
    r.powerOwner = kind ? a.id : null;
    r.powerKind = kind;
    r.lastHitter = a.id;
    r.bounces = 0;
    r.serving = false;
    hits++;
    quality[plan.quality < 0.3 ? 0 : plan.quality < 0.6 ? 1 : 2]++;
    a.brain.onShot(plan);
    o.brain.ai.onPlayerHit(!!plan.power);
  };

  /** `a` alcanza un tiro de poder: aturdido, retroceso y devolución floja (MatchScene.fireImpact / playerImpact) */
  const powerImpact = (a: Agent, r: Rally) => {
    const o = other(a);
    a.stats.gotStunned++;
    if (r.powerOwner !== null) ag[r.powerOwner].stats.shotReached++;
    a.body.stun = CFG.stunS || stunSeconds();
    a.body.x = knockbackX(a.body.x, B_X[1]);
    const tx = NET_X - (NET_X - COURT.left) * rnd(0.3, 0.6);
    const ty = LAT_C + rnd(-0.5, 0.5) * HALF_W;
    r.ball.z = Math.max(r.ball.z, 22);
    aimShot(r.ball, a.fx(tx), ty, SHOT_SPEED * CFG.weakK, 70);
    r.ball.power = false;
    r.powerOwner = null;
    r.powerKind = null;
    r.lastHitter = a.id;
    r.bounces = 0;
    a.brain.ai.onBotHit();
    o.brain.ai.onPlayerHit(false);
  };

  /** juega un punto completo. Devuelve el ganador. */
  const playPoint = (server: SideId): SideId => {
    for (const a of ag) {
      a.used = { dash: false, smash: false, ulti: false };
      a.body = { x: COURT.right + 40, y: LAT_C, stun: 0 };
      a.brain.ai.reset(a.body.x, a.body.y);
    }
    const side = (score.points[0] + score.points[1]) % 2 === 0 ? 1 : -1;
    const srv = ag[server];
    const rec = other(srv);
    srv.body.y = LAT_C + side * 70;
    rec.body.y = LAT_C - side * 40;
    srv.brain.ai.reset(srv.body.x, srv.body.y);
    rec.brain.ai.reset(rec.body.x + 5, rec.body.y);
    // el cerebro de cada lado ve el marcador desde su punto de vista (índice 1 = él)
    const p = score.points;
    const g = score.games;
    A.brain.onPointStart([p[1], p[0]], [g[1], g[0]]);
    B.brain.onPointStart([p[0], p[1]], [g[0], g[1]]);

    // ---- saque (modelado: la calidad sale de probabilidades; el contacto y la física son los reales)
    let faults = 0;
    let rally: Rally | null = null;
    while (!rally) {
      const second = faults > 0 ? 1 : 0;
      const d = srv.brain.difficulty;
      const spin = Math.random() < BOT_SERVE.spinChance[second];
      type Q = 'perfect' | 'normal' | 'weak' | 'low' | 'miss';
      let q: Q;
      if (Math.random() < BOT_SERVE.whiffChance[second]) q = 'miss';
      else if (Math.random() < BOT_SERVE.perfectChance[second] + 0.2 * d) q = 'perfect';
      else if (Math.random() < 0.5) q = Math.random() < 0.5 ? 'miss' : 'normal'; // algo pronto
      else q = Math.random() < 0.6 ? 'normal' : Math.random() < 0.75 ? 'weak' : 'low'; // algo tarde
      const w = srv.world();
      const ball = { x: w.x + (server === 0 ? 10 : -10), y: w.y, z: q === 'perfect' ? 280 : q === 'normal' ? 230 : 160, vx: 0, vy: 0, vz: 0, power: false };
      const mkRally = (): Rally => ({ ball, lastHitter: server, bounces: 0, serving: true, powerOwner: null, powerKind: null });
      timeS += 0.5;
      if (q === 'miss') {
        faults++;
        if (faults >= 2) return rec.id;
        continue;
      }
      if (q === 'low') {
        // la pelota sale plana contra la red: falta directa del punto
        return rec.id;
      }
      const box = serveBox(server, w.y);
      const [eLat, eDep] = SERVE.error[q === 'perfect' ? 'perfect' : q === 'normal' ? 'normal' : 'weak'];
      const aimT = [0.14, 0.5, 0.86][Math.floor(Math.random() * 3)] + (Math.random() - 0.5) * 0.12;
      const f = clamp((spin ? SERVE.depth.spin : SERVE.depth.normal) + gauss() * eDep, 0.12, 1.4);
      const tx = server === 0 ? box.x0 + (box.x1 - box.x0) * f : box.x1 - (box.x1 - box.x0) * f;
      const ty = box.y0 + 14 + (box.y1 - box.y0 - 28) * clamp(aimT + gauss() * eLat, -0.6, 1.6);
      const speed = SERVE_SPEED * SERVE.speed[q === 'perfect' ? 'perfect' : q === 'normal' ? 'normal' : 'weak'][second] * (spin ? SERVE.spinSpeedMult : 1);
      const margin = q === 'perfect' ? 22 : q === 'normal' ? rnd(8, 20) : rnd(-4, 10);
      aimShot(ball, tx, ty, speed, margin);
      if (Math.random() < SERVE.flawChance[q === 'perfect' ? 'perfect' : q === 'normal' ? 'normal' : 'weak']) ball.vz -= rnd(SERVE.flawDrop[0], SERVE.flawDrop[1]);
      rally = mkRally();
      srv.brain.ai.onBotHit();
      rec.brain.ai.onPlayerHit(q === 'perfect');
      // ¿entra el saque? se resuelve al primer bote; la falta repite el saque
      const probe = { ...ball };
      let landed: { x: number; y: number } | null = null;
      let net = false;
      for (let t = 0; t < 4; t += 1 / 120) {
        const ev = stepBall(probe, 1 / 120);
        if (ev === 'net') {
          net = true;
          break;
        }
        if (ev === 'bounce') {
          landed = { x: probe.x, y: probe.y };
          break;
        }
      }
      const inBox = !!landed && landed.x >= box.x0 - 6 && landed.x <= box.x1 + 6 && landed.y >= box.y0 - 6 && landed.y <= box.y1 + 6;
      if (net || !inBox) {
        rally = null;
        faults++;
        if (faults >= 2) return rec.id;
      }
    }

    // ---- peloteo
    let t = 0;
    let winner: SideId | null = null;
    const finish = (w: SideId) => {
      winner = w;
    };
    const r = rally;
    while (winner === null && t < 90) {
      for (let i = 0; i < SUB && winner === null; i++) {
        const ev = stepBall(r.ball, DT / SUB);
        if (ev === 'net') {
          const hitter = r.lastHitter ?? server;
          if (r.powerOwner !== null) ag[r.powerOwner].stats.shotError++;
          finish((1 - hitter) as SideId);
          break;
        }
        if (ev === 'bounce') {
          const hitter = r.lastHitter ?? server;
          const recv = (1 - hitter) as SideId;
          if (r.serving) {
            r.serving = false; // ya se comprobó que entra
            r.bounces = 1;
          } else if (r.bounces === 0) {
            const onRecvSide = hitter === 0 ? r.ball.x > NET_X : r.ball.x < NET_X;
            if (!isInCourt(r.ball.x, r.ball.y) || !onRecvSide) {
              if (r.powerOwner !== null) ag[r.powerOwner].stats.shotError++;
              finish(recv);
            } else r.bounces = 1;
          } else {
            if (r.powerOwner !== null) ag[r.powerOwner].stats.shotAce++;
            finish(hitter);
          }
          if (winner !== null) break;
        }
        // golpes: el que no golpeó, con la pelota viniendo hacia su lado y a su alcance
        for (const a of ag) {
          if (winner !== null) break;
          if (r.serving || r.lastHitter === a.id || a.body.stun > 0) continue; // durante el saque nadie golpea hasta que bota
          const comingTo = a.id === 0 ? r.ball.x < NET_X && r.ball.vx < 0 : r.ball.x > NET_X && r.ball.vx > 0;
          if (!comingTo || !inReach(a, r.ball)) continue;
          if (r.ball.power) powerImpact(a, r);
          else hit(a, r);
        }
      }
      tickBrains(r, DT, 'rally');
      t += DT;
    }
    if (winner === null) timeouts++;
    timeS += t;
    rallyS.push(t);
    return winner ?? server;
  };

  while (true) {
    const server = score.server;
    const w = playPoint(server);
    nPoints++;
    A.stats.pointsWon += w === 0 ? 1 : 0;
    B.stats.pointsWon += w === 1 ? 1 : 0;
    for (const a of ag) {
      const won = a.id === w;
      if (a.used.dash) {
        a.stats.dashPts++;
        if (won) a.stats.dashWon++;
      }
      if (a.used.smash) {
        a.stats.smashPts++;
        if (won) a.stats.smashWon++;
      }
      if (a.used.ulti) {
        a.stats.ultiPts++;
        if (won) a.stats.ultiWon++;
      }
      if (won) a.brain.onPointWon(); // la ULTI se carga con los puntos ganados
    }
    const res = score.pointTo(w);
    // tiempo entre puntos: las recargas siguen corriendo
    for (let i = 0; i < DEAD_S / 0.05; i++) tickBrains(null, 0.05, 'pointover');
    timeS += DEAD_S;
    if (res.matchWinner !== null) {
      return { winner: res.matchWinner, durationS: timeS, points: nPoints, games: [score.games[0], score.games[1]], stats: [A.stats, B.stats], rallyS, hits, timeouts, quality };
    }
  }
}
