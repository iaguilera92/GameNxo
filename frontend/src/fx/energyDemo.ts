import Phaser from 'phaser';
import { COURT, NET_X, SHOT_SPEED } from '../config';
import { VIEW, project } from '../view/projection';
import type { Character } from '../objects/Character';
import type { Ball } from '../objects/Ball';
import { HyperAura } from '../objects/HyperAura';
import { type CineFocus, type CineProfile, type SmashCinematic, spritesIn } from './SmashCinematic';
import { ENERGY_MATCH_CINE, ENERGY_MATCH_K, HURRICANE_MATCH_CINE } from '../logic/EnergyRally';
import { HURRICANE_COL, TORNADO_ART, TornadoFx, TornadoSprite, WindSphereFx, sphereBreakFx, wallKnockFx, windShotFx } from './hurricaneFx';
import { SPECIAL_SERVE_K } from './powerDemo';
import { EnergyCineFx } from './energyBallCine';
import { ENERGY_COL, EnergyImpactFx } from './energyBallFx';
import { type InfernoFire, infernoImpactFx, infernoSound } from './InfernoFx';
import { powerImpactFx } from './ImpactFx';
import { shockFx } from './shotFx';
import { getPlayer } from '../domain/playerStore';
import type { PlayerState } from '../domain/player';
import { zoneSkinOf } from '../domain/zoneSkins';
import type { PoseActor } from './actorPose';

/**
 * (17-11-2026) DEMOSTRACIÓN "EN ACCIÓN" de la ULTI LEGENDARIA BOLA DE ENERGÍA (PERSONALIZAR → ULTI y Tienda → VER), dentro de
 * fx/powerDemo.ts (modo 'inferno' con el poder 'energy'). En vez de una máquina hay CUATRO al fondo de la cancha: esquina izquierda,
 * centro-izquierda, centro-derecha y esquina derecha. UNA SOLA PELOTA (17-11-2026, cambio):
 *   la del centro-izquierda la lanza → el personaje hace la carga LEGENDARIA (la del partido, 1,8 s: aura fuerte, la
 *   energía se mete en su cuerpo, penumbra) y devuelve con la pelota del golpe cargado al máximo → NOQUEA la máquina de la esquina
 *   izquierda y la pelota REBOTA de vuelta hacia él → la manda a la esquina derecha (noqueada, rebota) → a la del centro-derecha
 *   (noqueada, rebota) → la BOLA DE ENERGÍA CRECE en la raqueta (energyBallCine.drawGrow) y sale: arrasa las DOS del centro.
 *   Pausa, corte (cortinilla de powerDemo) y otra vez. Ciclo ≈ 8,8 s.
 * Noqueada = sacudida, se tumba de lado (gira sobre su base con rebote), se oscurece un poco, su luz parpadea y se apaga y echa
 * algo de humo. El golpe final las empuja hacia el fondo girando, más pequeñas, hasta desaparecer, con una mancha leve y humo.
 * Todo se crea UNA vez (máquinas, humo en pool, mancha) y se reutiliza; la pelota sigue un guion (sin física).
 */

/** carga de la demostración = la del partido (ENERGY_CINE de 6 s acortada a 1,8 s); energyBallCine se dibuja con el tiempo reescalado */
// (17-11-2026, usuario) la MISMA carga que en el partido (ENERGY_MATCH_CINE, 1,8 s): Tienda, PERSONALIZAR y partido iguales
const CINE_K = ENERGY_MATCH_K;
const DEMO_CINE: CineProfile = ENERGY_MATCH_CINE;
/** (18-11-2026, usuario) HURACÁN en la demo: la carga 0,5 s más corta (1,8 → 1,3 s) para que se vea más el salto del smash */
const H_CHARGE_K = 1300 / 1800;
const H_CINE: CineProfile = {
  ...HURRICANE_MATCH_CINE,
  durationMs: HURRICANE_MATCH_CINE.durationMs * H_CHARGE_K,
  hitAtMs: HURRICANE_MATCH_CINE.hitAtMs * H_CHARGE_K,
  activateMs: HURRICANE_MATCH_CINE.activateMs * H_CHARGE_K,
  focusMs: HURRICANE_MATCH_CINE.focusMs * H_CHARGE_K,
  peakMs: HURRICANE_MATCH_CINE.peakMs * H_CHARGE_K,
  releaseFromMs: HURRICANE_MATCH_CINE.releaseFromMs * H_CHARGE_K,
  flashAtMs: HURRICANE_MATCH_CINE.flashAtMs * H_CHARGE_K,
  flashMs: HURRICANE_MATCH_CINE.flashMs * H_CHARGE_K,
};

const LAT_C = (COURT.top + COURT.bottom) / 2;
/** sitio lateral de las 4 máquinas (izq. → der. en pantalla) */
const M_Y = [COURT.top - 15, LAT_C - 85, LAT_C + 85, COURT.bottom + 15];
/** la que lanza la única pelota y a quién se le pega en cada golpe (−1 = la BOLA DE ENERGÍA a las dos del centro) */
const LAUNCHER = 1;
const TARGET = [0, 3, 2, -1];
/** (17-11-2026) HURACÁN: la máquina que recibe el viento (centro-derecha), la altura del salto del tornado (la del partido, HURRICANE.liftZ) y sus tiempos (s) */
const H_VIC = 2;
/** hasta dónde sale despedido (hacia el fondo) respecto de las máquinas */
const H_BACK_X = 110;
const H_LIFT = 240; // (18-11-2026, usuario) salto más alto (120 → 190 → 240): se ve más arriba dentro del tornado
// (18-11-2026, usuario) fly = vuelo del GLOBO desde la máquina hasta el smash; lift = salto con el tornado; hover = quieto en el aire (pies atrás)
// (18-11-2026, usuario) toT = espera tras el golpe antes de correr a la T; run = lo que tarda en llegar a la T
// (18-11-2026, usuario) salto más largo (0,55 → 0,75 s) y la bola amarilla lo cubre recién a los `cover` s del salto (se ve cómo salta)
// (18-11-2026) tornado = lo que dura la hoja del tornado (8 cuadros); el globo vuela fly (más largo para que todo calce)
const H_T = { lift: 0.75, fly: 2.2, hover: 0.5, tornado: 0.96, knockMs: 420, toT: 0.3, run: 0.6 };
/** (18-11-2026) la T de su campo (línea de saque con la línea central): desde ahí salta al smash */
// (18-11-2026, usuario) un poco más atrás de la T (0,538 → 0,64 del campo desde la red)
const T_POS = { x: NET_X - (NET_X - COURT.left) * 0.64, y: (COURT.top + COURT.bottom) / 2 };
/** altura extra del contacto del smash sobre el salto y altura del arco del globo */
const H_SMASH_Z = 45;
/** (18-11-2026) círculo amarillo: radio y cuánto sube su centro (en medios altos del personaje): cubre el cuerpo con la raqueta arriba */
const SPHERE_R = 1.5;
const SPHERE_UP = 0.3;
const H_LOB_ARC = 230;
/** colores de la carga del HURACÁN (los mismos del partido) */
const H_PAL = { core: HURRICANE_COL.core, light: HURRICANE_COL.light, cyan: HURRICANE_COL.gold, deep: HURRICANE_COL.deep };
/**
 * tiempos (s): espera antes de lanzar; pelota de la máquina (hasta el bote / del bote a la raqueta); rebote desde la máquina noqueada
 * (hasta el bote / a la raqueta); devolución; la bola crece en la raqueta; vuelo de la bola final; pausa antes del corte
 */
// (17-11-2026, usuario) los 3 peloteos duran 3,5 s, como en el partido: 3 × (out + backA + backB) = 3 × 1,167 s (antes 3 × 1,0 s)
const T = { wait: 0.3, inA: 0.32, inB: 0.18, /* (17-11-2026, usuario) la pelota de la máquina llega antes */ /* (18-11-2026, usuario) peloteo el doble de rápido */ backA: 0.193, backB: 0.128, out: 0.263, grow: 0.5, final: 0.6, endHold: 1.0 };
const SWING_LEAD = 0.14;
const MUZZLE_Z = 59;
const HIT_Z = 60;
/** velo de la máquina noqueada (máximo) */
const SHADE = 0.3;
/** humo (pool) */
const SMOKE = 20;
const LIGHT_ON = 0x35c85a;
const LIGHT_OFF = 0x3a3a3a;
const rand = Phaser.Math.FloatBetween;

export interface EnergyDemoHost {
  /** la escena real (tweens) y la "escena" de los efectos (todo lo que crea va al escenario) */
  scene: Phaser.Scene;
  st: Phaser.Scene;
  pl: Character;
  pa: PoseActor;
  rb: Ball;
  fire: InfernoFire;
  cine: SmashCinematic;
  /** la x de las máquinas (al fondo) */
  machineX: number;
  buildMachine(x: number, y: number): { container: Phaser.GameObjects.Container; light: Phaser.GameObjects.Arc };
  focus(): CineFocus;
  shake(amp: number): void;
  flash(ms: number, col: number): void;
  snd(name: string, vol?: number): void;
  playCharge(vol: number): void;
  stopCharge(): void;
  /** pelota visible / en vuelo de la ULTI (la dibuja powerDemo.renderBall) */
  setBall(on: boolean, inferno: boolean): void;
  /** terminó la secuencia: corte y otra vez */
  done(): void;
}

interface Machine {
  c: Phaser.GameObjects.Container;
  light: Phaser.GameObjects.Arc;
  shade: Phaser.GameObjects.Rectangle;
  y: number;
  sx: number;
  sy: number;
  ks: number;
  ko: boolean;
  /** s desde que la noquearon (parpadeo de la luz y humo) */
  koT: number;
  smokeT: number;
  /** hacia dónde se tumbó (−1 izquierda, 1 derecha) */
  dir: number;
  gone: boolean;
}

interface P3 {
  x: number;
  y: number;
  z: number;
}

/** tramo de la pelota con guion: recta de `a` a `b` más un arco de altura `h` */
function arcAt(a: P3, b: P3, u: number, h: number, out: P3) {
  const k = Math.max(0, Math.min(1, u));
  out.x = a.x + (b.x - a.x) * k;
  out.y = a.y + (b.y - a.y) * k;
  out.z = a.z + (b.z - a.z) * k + 4 * h * k * (1 - k);
  return out;
}

export class EnergyDemo {
  private readonly m: Machine[] = [];
  private readonly cineFx: EnergyCineFx;
  /** (17-11-2026) impacto final DESTRUCTIVO (el mismo del partido, pool) */
  private readonly impact: EnergyImpactFx;
  private aura: HyperAura | null = null;
  private readonly smoke: Phaser.GameObjects.Arc[] = [];
  private readonly sLife = new Float32Array(SMOKE);
  private readonly sMax = new Float32Array(SMOKE);
  private readonly sVx = new Float32Array(SMOKE);
  private readonly sVy = new Float32Array(SMOKE);
  private sNext = 0;
  private readonly scorch: Phaser.GameObjects.Ellipse;
  private phase: 'serve' | 'in' | 'cine' | 'out' | 'grow' | 'lift' | 'end' | 'idle' = 'idle';
  /** qué ULTI LEGENDARIA muestra (la elige powerDemo.syncEnergy): BOLA DE ENERGÍA o HURACÁN */
  private power: 'energy' | 'hurricane' = 'energy';
  private readonly tornado: TornadoFx;
  /** (18-11-2026) el tornado en imagen (si la hoja está cargada; si no, el de código) */
  private readonly tornImg: TornadoSprite;
  private readonly sphere: WindSphereFx;
  /** HURACÁN: 1 = ya viene el smash final */
  private hStage = 0;
  /**
   * (18-11-2026, usuario: "se pega al salir de la demo del HURACÁN") tweens del golpe final que mueven objetos sueltos ({u}) en vez de la
   * máquina: killTweensOf(m.c) no los corta y seguían vivos tras salir. Se cortan en stop().
   */
  private fxTw: Phaser.Tweens.Tween[] = [];
  /** HURACÁN: el personaje está en el aire (se dibujan el tornado y la esfera), progreso del tornado (−1 = sin tornado) y opacidad de la esfera */
  private hAir = false;
  /** HURACÁN: ya saltó a por el globo / ya se desarmó la esfera */
  private jumped = false;
  private broke = false;
  private tornU = -1;
  private sphereA = 0;
  private get hur() {
    return this.power === 'hurricane';
  }
  private round = 0;
  private t = 0;
  private swung = false;
  private bounced = false;
  private darkOn = false;
  private lastCine = 0;
  /** tramos de la pelota que viene (de la máquina o rebotada): dos tramos con un bote */
  private inA = T.inA;
  private inB = T.inB;
  /** puntos del guion (reutilizados) */
  private readonly from: P3 = { x: 0, y: 0, z: 0 };
  private readonly bounce: P3 = { x: 0, y: 0, z: 0 };
  private readonly racket: P3 = { x: 0, y: 0, z: 0 };
  private readonly aim: P3 = { x: 0, y: 0, z: 0 };
  private readonly pos: P3 = { x: 0, y: 0, z: 0 };

  constructor(private readonly h: EnergyDemoHost) {
    const st = h.st;
    for (const y of M_Y) {
      const b = h.buildMachine(h.machineX, y);
      const p = project(h.machineX, y);
      const ks = p.s * VIEW.CHAR_K;
      // velo oscuro de la máquina noqueada (dentro del contenedor: gira con ella)
      const shade = st.add.rectangle(0, -72, 108, 150, 0x05060c, 1).setAlpha(0);
      b.container.add(shade);
      this.m.push({ c: b.container, light: b.light, shade, y, sx: p.sx, sy: p.sy, ks, ko: false, koT: 0, smokeT: 0, dir: 1, gone: false });
    }
    const mid = project(h.machineX, LAT_C);
    const mk = mid.s * VIEW.CHAR_K;
    this.scorch = st.add.ellipse(mid.sx, mid.sy, 170 * mk, 38 * mk, 0x10131c, 0.4).setDepth(mid.sy - 1).setVisible(false);
    for (let i = 0; i < SMOKE; i++) this.smoke.push(st.add.circle(0, 0, 10, 0x5a5a66, 0.5).setVisible(false));
    this.cineFx = new EnergyCineFx(st);
    this.impact = new EnergyImpactFx(st);
    this.tornado = new TornadoFx(st);
    this.tornImg = new TornadoSprite(st);
    this.sphere = new WindSphereFx(st);
    this.setVisible(false);
  }

  // ------------------------------------------------------------------ ciclo
  /** Elige la ULTI LEGENDARIA que se muestra (antes de `reset`). */
  setPower(p: 'energy' | 'hurricane') {
    this.power = p;
    this.cineFx.setPalette(p === 'hurricane' ? H_PAL : undefined);
  }

  /** Todo en su sitio (máquinas en pie y encendidas) y la pelota a punto de salir. */
  reset() {
    this.stop();
    this.hStage = 0;
    const tw = this.h.scene.tweens;
    for (const m of this.m) {
      tw.killTweensOf(m.c);
      tw.killTweensOf(m.shade);
      m.c.setPosition(m.sx, m.sy).setScale(m.ks).setAngle(0).setAlpha(1).setDepth(m.sy).setVisible(true);
      m.light.setFillStyle(LIGHT_ON);
      m.shade.setAlpha(0);
      m.ko = false;
      m.gone = false;
      m.koT = 0;
      m.smokeT = 0;
    }
    this.scorch.setVisible(false);
    this.clearSmoke();
    this.round = 0;
    this.t = 0;
    this.phase = 'serve';
    // (18-11-2026, rendimiento) la hoja del tornado se sube a la GPU ahora (tras la cortinilla), no al saltar
    if (this.hur) {
      const p = project(T_POS.x, T_POS.y);
      this.tornImg.warm(p.sx, p.sy, p.sy);
    }
  }

  /** Corta lo que esté en marcha (cinemática, carga, aura, penumbra, pelota) sin tocar las máquinas. */
  stop() {
    this.phase = 'idle';
    for (const tw of this.fxTw) tw.remove();
    this.fxTw = [];
    this.h.stopCharge();
    this.cineFx.hide();
    this.impact.stop();
    this.tornado.hide();
    this.tornImg.hide();
    this.sphere.hide();
    this.h.scene.tweens.killTweensOf(this.h.pa);
    this.h.pa.lift = 0;
    this.h.pl.setAlpha(1); // (18-11-2026) por si se cortó convertido en la esfera
    this.tornadoSndStop(false);
    this.hAir = false;
    this.tornU = -1;
    this.darkOn = false;
    this.aura?.stop();
    this.aura?.setBoost(1);
    this.h.rb.setMaxCharge(false);
  }

  /** Fuera del modo BOLA DE ENERGÍA (otra ULTI elegida): se esconde todo. */
  hide() {
    this.stop();
    this.setVisible(false);
  }

  private setVisible(on: boolean) {
    for (const m of this.m) m.c.setVisible(on);
    this.scorch.setVisible(false);
    this.clearSmoke();
  }

  private clearSmoke() {
    for (let i = 0; i < SMOKE; i++) {
      this.sLife[i] = 0;
      this.smoke[i].setVisible(false);
    }
  }

  destroy() {
    this.stop();
    const tw = this.h.scene.tweens;
    for (const m of this.m) {
      tw.killTweensOf(m.c);
      tw.killTweensOf(m.shade);
    }
    this.aura?.destroy();
    this.aura = null;
    this.impact.destroy();
  }

  update(dt: number) {
    this.stepSmoke(dt);
    if (this.h.cine.active) {
      this.h.cine.update();
      return;
    }
    this.aura?.update(dt);
    if (this.hur && this.hAir) this.drawAir(dt);
    // penumbra de la cinemática durante todo el peloteo; se aclara tras la BOLA DE ENERGÍA
    if (this.darkOn && !this.cineFx.drawDark(this.phase === 'end' ? 0 : 0.6, dt)) this.darkOn = false;
    switch (this.phase) {
      case 'serve':
        return this.stepServe(dt);
      case 'in':
        return this.stepIn(dt);
      case 'grow':
        return this.stepGrow(dt);
      case 'lift':
        return this.stepLift(dt);
      case 'out':
        return this.stepOut(dt);
      case 'end':
        this.t += dt;
        if (this.t >= T.endHold) {
          this.phase = 'idle';
          this.h.done();
        }
        return;
      default:
        return;
    }
  }

  // ------------------------------------------------------------------ la máquina lanza (una sola vez)
  private stepServe(dt: number) {
    this.t += dt;
    const L = this.m[LAUNCHER];
    L.light.setFillStyle(this.t > T.wait - 0.3 && Math.floor(this.t * 12) % 2 === 0 ? 0xffd23f : LIGHT_ON);
    if (this.t < T.wait) return;
    L.light.setFillStyle(LIGHT_ON);
    this.from.x = this.h.machineX - 15;
    this.from.y = L.y;
    this.from.z = MUZZLE_Z;
    this.comeBack(T.inA, T.inB);
    // (17-11-2026, usuario) la 1.ª pelota de la máquina va a la MISMA velocidad que en las demás ULTIs (powerDemo.fire: SPECIAL_SERVE_K)
    const v = SHOT_SPEED * SPECIAL_SERVE_K;
    this.inA = Math.max(0.35, Math.hypot(this.bounce.x - this.from.x, this.bounce.y - this.from.y) / v);
    this.inB = Math.hypot(this.racket.x - this.bounce.x, this.racket.y - this.bounce.y) / (v * 0.85); // tras el bote va algo más lenta
    const rb = this.h.rb;
    rb.setPower(false);
    rb.setKind('normal');
    rb.setMaxCharge(false);
    rb.clearTrail();
    this.placeBall(this.from);
    this.h.setBall(true, false);
    this.h.pl.setReady(true);
    if (!this.hur) this.h.snd('golpe-fuerte', 0.5); // (18-11-2026, usuario) HURACÁN: la máquina dispara sin golpe-fuerte
    // retroceso de la máquina y fogonazo en la boca
    const ks = L.ks;
    this.h.scene.tweens.add({ targets: L.c, scaleX: ks * 1.07, scaleY: ks * 0.93, duration: 70, yoyo: true, ease: 'Quad.easeOut' });
    const my = L.sy - 76 * ks;
    const fl = this.h.st.add.circle(L.sx, my, 26 * ks, 0xfff1b8, 0.9).setDepth(L.sy + 3).setBlendMode(Phaser.BlendModes.ADD);
    this.h.scene.tweens.add({ targets: fl, scale: 2.4, alpha: 0, duration: 200, ease: 'Quad.easeOut', onComplete: () => fl.destroy() });
  }

  /** La pelota viene hacia el personaje desde `from` (boca de la máquina o la máquina noqueada): bota delante y llega a la raqueta. */
  private comeBack(a: number, b: number) {
    const pa = this.h.pa;
    this.racket.x = pa.x + 22;
    this.racket.y = pa.y + 12;
    this.racket.z = 34;
    this.bounce.x = pa.x + 280;
    this.bounce.y = this.from.y + (this.racket.y - this.from.y) * 0.8;
    this.bounce.z = 0;
    this.inA = a;
    this.inB = b;
    this.phase = 'in';
    this.t = 0;
    this.swung = false;
    this.bounced = false;
  }

  private stepIn(dt: number) {
    this.t += dt;
    const t = this.t;
    if (t < this.inA) this.placeBall(arcAt(this.from, this.bounce, t / this.inA, 45, this.pos), this.from, this.bounce, this.inA);
    else {
      if (!this.bounced) {
        this.bounced = true;
        const p = project(this.bounce.x, this.bounce.y);
        const r = this.h.st.add.ellipse(p.sx, p.sy, 34 * p.s, 11 * p.s).setStrokeStyle(2.5 * p.s, 0xffffff, 0.8).setDepth(p.sy - 0.4);
        this.h.scene.tweens.add({ targets: r, scale: 2.4, alpha: 0, duration: 300, ease: 'Cubic.easeOut', onComplete: () => r.destroy() });
      }
      this.placeBall(arcAt(this.bounce, this.racket, (t - this.inA) / this.inB, 24, this.pos), this.bounce, this.racket, this.inB);
    }
    const hitAt = this.inA + this.inB;
    const final = !this.hur && TARGET[this.round] === -1;
    if (this.round === 0 || final) {
      // 1.ª: la carga LEGENDARIA; última: la BOLA DE ENERGÍA crece en la raqueta. La pelota queda en la raqueta mientras tanto
      if (t < hitAt) return;
      this.placeBall(this.racket);
      if (final) {
        this.phase = 'grow';
        this.t = 0;
        this.swung = false;
        this.h.rb.setMaxCharge(false);
        this.h.pl.setCharging(true);
        this.h.playCharge(0.7);
        this.h.snd('electricidad', 0.6);
      } else this.startCharge();
      return;
    }
    if (!this.swung && t >= hitAt - SWING_LEAD) this.swing();
    if (t >= hitAt) this.strike();
  }

  private swing() {
    this.swung = true;
    this.h.pl.facing = 1;
    this.h.pl.swing(true, false, false, false);
  }

  // ------------------------------------------------------------------ la carga (la del partido, 1,8 s)
  private startCharge() {
    const h = this.h;
    const pl = h.pl;
    const cp = this.hur ? H_CINE : DEMO_CINE;
    const ck = this.hur ? CINE_K * H_CHARGE_K : CINE_K;
    this.phase = 'cine';
    if (!pl.infernoHold()) pl.setCharging(true);
    h.playCharge(0.8);
    this.cineFx.start();
    this.auraOn();
    this.lastCine = performance.now();
    const sprites = spritesIn(pl);
    h.cine.start({
      profile: cp,
      freeze: sprites,
      executor: sprites,
      leadMs: 0,
      focus: () => h.focus(),
      onCancel: () => {
        pl.infernoRelease();
        pl.setCharging(false);
        this.cineFx.hideCharge();
      },
      onFrame: (e) => {
        const now = performance.now();
        const dt = Math.min(0.05, (now - this.lastCine) / 1000);
        this.lastCine = now;
        if (e >= cp.hitAtMs - 45) pl.infernoPre();
        const f = h.focus();
        const feet = project(h.pa.x, h.pa.y);
        this.cineFx.drawCharge(e / ck, { x: f.x, y: f.y, racketX: f.racketX, racketY: f.racketY, s: f.s, hh: f.hh, depth: f.depth, feetY: feet.sy });
        this.aura?.update(dt);
      },
      onHit: () => {
        this.cineFx.hideCharge();
        this.cineFx.setDark(cp.darken);
        this.darkOn = true;
        pl.infernoRelease();
        pl.setCharging(false);
        pl.facing = 1;
        pl.swing(true, false, false, false);
        this.strike();
      },
    });
  }

  /** Aura de la ZONA del jugador (su ESTILO DE ZONA) más fuerte, como en el partido (legendZoneOn). */
  private auraOn() {
    const z = zoneSkinOf(getPlayer() as PlayerState);
    this.aura ??= new HyperAura(this.h.st, this.h.pl, z.aura, z.auraPal);
    this.aura.start(z.aura, true);
    this.aura.setBoost(1.9);
  }

  /** La BOLA DE ENERGÍA crece en la raqueta (lo mismo que el partido: energyBallCine.drawGrow) y sale. */
  private stepGrow(dt: number) {
    // (17-11-2026, usuario) el golpe final usa el swing de la ULTI (hoja ulti-1), como en el partido: pose de espera de la ULTI al
    // empezar a crecer la bola, preparación al final y el swing sale de ella
    if (this.t === 0) {
      this.h.pl.setCharging(false);
      this.h.pl.infernoHold();
    }
    this.t += dt;
    if (this.t >= T.grow - 0.045) this.h.pl.infernoPre();
    // (17-11-2026, usuario) sin esfera en el personaje: partículas hacia él y rayos que le salen; la bola sale chica y crece en vuelo
    const f = this.h.focus();
    const feet = project(this.h.pa.x, this.h.pa.y);
    this.cineFx.drawGrow(dt, this.t / T.grow, { x: f.x, y: f.y, racketX: f.racketX, racketY: f.racketY, s: f.s, hh: f.hh, depth: f.depth, feetY: feet.sy });
    this.h.fire.energyGrowSec = T.final;
    if (!this.swung && this.t >= T.grow - SWING_LEAD) this.swing();
    if (this.t >= T.grow) {
      this.cineFx.hideCharge();
      this.strike();
    }
  }

  // ------------------------------------------------------------------ el golpe y la pelota de vuelta
  private strike() {
    const h = this.h;
    const rb = h.rb;
    h.stopCharge();
    h.pl.setReady(false);
    const final = this.hur ? this.hStage === 1 : TARGET[this.round] === -1;
    this.from.x = this.racket.x;
    this.from.y = this.racket.y;
    this.from.z = this.racket.z;
    this.aim.x = h.machineX - 30;
    this.aim.z = HIT_Z;
    const p = project(this.racket.x, this.racket.y, this.racket.z);
    if (this.hur) {
      const v = this.m[H_VIC];
      this.aim.y = v.y;
      if (final) {
        // (18-11-2026, usuario) el SMASH del HURACÁN va al MEDIO de las 2 máquinas del centro: las destruye y empuja las de las esquinas (blast)
        this.aim.y = (M_Y[1] + M_Y[2]) / 2;
        rb.setKind('normal', true);
        rb.setPower(true);
        h.fire.setElement('hurricane');
        h.setBall(true, true);
        // (18-11-2026) impacto del smash en la raqueta, más grande (infernoImpactFx ya trae hurricaneBurst: no se repite, rendimiento)
        infernoImpactFx(h.st, p.sx, p.sy, p.s * 1.4, 'hurricane');
        infernoSound.impact(h.st, 'hurricane');
        this.tornadoSndStop(true); // el tornado termina con el golpe final
        h.flash(80, 0xfff6b0);
        h.shake(8);
      } else {
        // el golpe CARGADO al máximo con viento potente: sale una ráfaga hacia el rival
        const to = project(this.aim.x, this.aim.y, HIT_Z);
        const len = Math.hypot(to.sx - p.sx, to.sy - p.sy) || 1;
        rb.setPower(false);
        rb.setKind('normal');
        rb.setMaxCharge(true);
        h.setBall(true, false);
        windShotFx(h.st, p.sx, p.sy, p.s, (to.sx - p.sx) / len, (to.sy - p.sy) / len);
        h.snd('golpe-fuerte', 0.9);
        h.shake(6);
        // (18-11-2026, usuario) 0,3 s después del golpe se va corriendo a la T de su campo: desde ahí salta a por el globo
        h.scene.time.delayedCall(H_T.toT * 1000, () => {
          if (!this.hur || this.phase === 'idle') return;
          const pa = h.pa;
          h.pl.setMoving(true, Math.sign(T_POS.y - pa.y) || 1);
          h.scene.tweens.add({
            targets: pa,
            x: T_POS.x,
            y: T_POS.y,
            duration: H_T.run * 1000,
            ease: 'Sine.easeInOut',
            onComplete: () => {
              h.pl.setMoving(false, 0);
              h.pl.facing = 1;
            },
          });
        });
      }
    } else if (final) {
      // la BOLA DE ENERGÍA, al hueco entre las dos del centro
      this.aim.y = (M_Y[1] + M_Y[2]) / 2;
      rb.setKind('normal', true);
      rb.setPower(true);
      h.fire.setElement('energy');
      h.setBall(true, true);
      infernoImpactFx(h.st, p.sx, p.sy, p.s, 'energy');
      infernoSound.impact(h.st, 'energy');
      h.flash(120, 0xf0fdff);
      h.shake(8);
    } else {
      this.aim.y = this.m[TARGET[this.round]].y;
      // la pelota del golpe cargado al máximo (brillo y rayos), como en el peloteo del partido
      rb.setPower(false);
      rb.setKind('normal');
      rb.setMaxCharge(true);
      h.setBall(true, false);
      shockFx(h.st, p.sx, p.sy, p.s);
      h.snd('electricidad', 0.6);
      h.snd('golpe-fuerte', 0.7);
      h.shake(4);
    }
    this.phase = 'out';
    this.t = 0;
  }

  private stepOut(dt: number) {
    this.t += dt;
    const final = this.hur ? this.hStage === 1 : TARGET[this.round] === -1;
    const dur = final ? T.final : T.out;
    this.placeBall(arcAt(this.from, this.aim, this.t / dur, final ? 30 : 40, this.pos), this.from, this.aim, dur);
    if (this.t < dur) return;
    if (this.hur) {
      if (final) {
        this.blast(); // (18-11-2026) las 2 del centro destruidas, las de las esquinas empujadas hacia fuera
        this.round++;
        this.t = 0;
        this.phase = 'end';
      } else {
        this.hurKnock();
        this.startLift();
      }
      return;
    }
    if (final) {
      this.blast();
      this.round++;
      this.t = 0;
      this.phase = 'end';
      return;
    }
    this.knock(this.m[TARGET[this.round]]);
    this.round++;
    // la MISMA pelota rebota en la máquina y vuelve hacia el personaje (floja, sin el brillo del cargado)
    this.from.x = this.aim.x;
    this.from.y = this.aim.y;
    this.from.z = this.aim.z;
    this.h.rb.setKind('normal');
    this.h.rb.setMaxCharge(false);
    this.comeBack(T.backA, T.backB);
  }

  // ------------------------------------------------------------------ HURACÁN
  /** El rival sale despedido al FONDO (contra la pared), choca y queda tendido en el suelo. */
  private hurKnock() {
    const h = this.h;
    const m = this.m[H_VIC];
    const back = project(h.machineX + H_BACK_X, m.y);
    const bk = back.s * VIEW.CHAR_K;
    m.ko = true;
    m.koT = 0;
    m.smokeT = 0;
    m.dir = m.y < LAT_C ? -1 : 1;
    const tw = h.scene.tweens;
    tw.killTweensOf(m.c);
    tw.add({ targets: m.c, x: back.sx, y: back.sy, scale: bk, duration: H_T.knockMs, ease: 'Quad.easeOut' });
    tw.chain({
      targets: m.c,
      tweens: [
        { angle: -m.dir * 20, duration: H_T.knockMs * 0.6, ease: 'Quad.easeOut' },
        { angle: m.dir * 84, duration: 480, ease: 'Bounce.easeOut' },
      ],
    });
    tw.add({ targets: m.shade, alpha: SHADE, duration: 360, delay: 200 });
    h.scene.time.delayedCall(H_T.knockMs, () => {
      if (!this.hur || this.phase === 'idle') return;
      wallKnockFx(h.st, back.sx, back.sy, back.s * 1.3); // (18-11-2026, usuario) sin golpe-fuerte: suena solo en el 1.er golpe
      h.shake(10);
      this.puffs(m, 4, 0.8);
    });
  }

  /**
   * (18-11-2026, usuario) Al pegarle a la máquina, la pelota REBOTA en GLOBO hacia el personaje (el globo del círculo del smash, sin dibujar
   * el círculo). El personaje se queda QUIETO esperándolo (sin pose de carga ni sonido de cargando); el salto con el tornado lo hace stepLift.
   */
  /** Sonido del tornado: dura hasta el golpe final del smash (con un cierre rápido), o hasta que se corta la demo. */
  private tSnd: Phaser.Sound.BaseSound | null = null;
  private tornadoSndStart() {
    this.tornadoSndStop(false);
    try {
      if (!this.h.scene.cache.audio.exists('tornado-1')) return;
      this.tSnd = this.h.scene.sound.add('tornado-1', { volume: 0.8 });
      this.tSnd.play();
    } catch {
      this.tSnd = null;
    }
  }
  private tornadoSndStop(fade: boolean) {
    const s = this.tSnd;
    this.tSnd = null;
    if (!s) return;
    if (fade) this.h.scene.tweens.add({ targets: s, volume: 0, duration: 120, onComplete: () => { s.stop(); s.destroy(); } });
    else {
      s.stop();
      s.destroy();
    }
  }

  private startLift() {
    this.hStage = 1;
    this.from.x = this.aim.x; // sale de la máquina en el momento del golpe
    this.from.y = this.aim.y;
    this.from.z = this.aim.z;
    this.racket.z = 34 + H_LIFT + H_SMASH_Z; // contacto del smash: por encima de la cabeza, en lo alto del salto
    // el globo cae en la T (donde va a estar el personaje al saltar)
    this.racket.x = T_POS.x + 22;
    this.racket.y = T_POS.y + 12;
    this.h.stopCharge();
    this.h.rb.setMaxCharge(false);
    this.h.rb.setKind('lob');
    this.h.setBall(true, false);
    this.h.pl.setCharging(false);
    this.h.pl.setReady(false);
    this.phase = 'lift';
    this.t = 0;
    this.swung = false;
    this.jumped = false;
    this.broke = false;
    this.hAir = false;
    this.tornU = -1;
    this.sphereA = 0;
  }

  /** Dibujo del tornado y de la esfera (cada fotograma mientras el personaje está en el aire). */
  private drawAir(dt: number) {
    const h = this.h;
    const pa = h.pa;
    const feet = project(pa.x, pa.y);
    const lifted = project(pa.x, pa.y, pa.lift ?? 0).sy;
    const f = h.focus();
    if (this.tornU >= 0 && this.tornImg.ok) {
      // (18-11-2026) la hoja del tornado: alto fijo (del suelo a por encima del personaje en lo alto del salto: lo cubre completo)
      const top = project(pa.x, pa.y, H_LIFT + 170).sy;
      this.tornImg.draw(this.tornU * TORNADO_ART.frames, feet.sx, feet.sy, top, f.depth + 0.6);
      this.tornado.hide();
    } else if (this.tornU >= 0) {
      const top = project(pa.x, pa.y, (pa.lift ?? 0) + 170).sy;
      this.tornado.draw(dt, this.tornU, feet.sx, feet.sy, top, feet.s * VIEW.CHAR_K, f.depth);
    } else {
      this.tornado.hide();
      this.tornImg.hide();
    }
    const hh = f.hh ?? 60;
    // (18-11-2026, usuario) el círculo envuelve TODO el cuerpo (con la raqueta arriba de la pose del smash): más grande y algo más arriba
    this.sphere.draw(dt, f.x, f.y - (feet.sy - lifted) - hh * SPHERE_UP, hh * SPHERE_R, f.depth, this.sphereA, this.sphereA);
  }

  /** (18-11-2026) La esfera amarilla se desarma (estallido de luz) en donde está y deja ver al personaje. */
  private breakSphere() {
    const h = this.h;
    const pa = h.pa;
    const feet = project(pa.x, pa.y);
    const lifted = project(pa.x, pa.y, pa.lift ?? 0).sy;
    const f = h.focus();
    const hh = f.hh ?? 60;
    sphereBreakFx(h.st, f.x, f.y - (feet.sy - lifted) - hh * SPHERE_UP, hh * SPHERE_R, f.depth);
    this.sphereA = 0;
    h.pl.setAlpha(1);
  }

  /**
   * (18-11-2026, usuario) El GLOBO vuela alto hacia el personaje (H_T.fly). Antes de que llegue, el personaje SALTA con el clip del smash
   * (Character.remateJump: se agacha, despega y se queda congelado con los pies atrás) y al despegar EMPIEZA EL TORNADO que lo envuelve; arriba
   * el tornado se desarma, sale en la esfera y espera en el aire (H_T.hover) con esa pose hasta que llega la pelota: el SMASH sale de ahí.
   */
  private stepLift(dt: number) {
    this.t += dt;
    const t = this.t;
    const hov = this.racket;
    const jumpAt = H_T.fly - H_T.tornado - H_T.hover;
    this.placeBall(arcAt(this.from, hov, t / H_T.fly, H_LOB_ARC, this.pos), this.from, hov, H_T.fly);
    if (t >= jumpAt) {
      if (!this.jumped) {
        this.jumped = true;
        this.hAir = true;
        this.h.pl.facing = 1;
        if (!this.h.pl.remateJump()) this.h.pl.setCharging(true);
        this.tornadoSndStart(); // empieza el tornado (el mismo del partido): se corta en el golpe final
      }
      const j = t - jumpAt;
      const e = Math.min(1, j / H_T.lift);
      this.h.pa.lift = H_LIFT * e * e * (3 - 2 * e);
      // (18-11-2026, usuario) el TORNADO (hoja de 8 cuadros) sale al saltar: círculo en el suelo, sube cubriendo al personaje y se desarma.
      // Desde el cuadro 5 el personaje ya es el CÍRCULO AMARILLO dentro; al terminar el tornado el círculo se desarma y se le ve H_T.hover (0,5 s)
      // con la pose del smash antes de golpear
      this.tornU = j < H_T.tornado ? j / H_T.tornado : -1;
      const coverAt = H_T.tornado * (4 / TORNADO_ART.frames);
      if (j < H_T.tornado) {
        this.sphereA = j < coverAt ? 0 : Math.min(1, (j - coverAt) / 0.08);
        // dentro del tornado ya no se le ve (lo tapa); desde el cuadro 5 es la esfera
        this.h.pl.setAlpha(j >= coverAt - 0.12 ? 0 : 1);
      } else if (!this.broke) {
        this.broke = true;
        this.breakSphere();
      }
    }
    if (!this.swung && t >= H_T.fly - SWING_LEAD) {
      this.swung = true;
      this.h.pl.facing = 1;
      this.h.pl.swing(true, true, true, false); // el SMASH desde la pose congelada del salto
    }
    if (t >= H_T.fly) {
      this.placeBall(hov);
      this.strike();
    }
  }

  /** Pelota con guion: posición y su velocidad (para su dibujo). */
  private placeBall(p: P3, a?: P3, b?: P3, dur = 1) {
    const s = this.h.rb.s;
    s.vx = a && b ? (b.x - a.x) / dur : 0;
    s.vy = a && b ? (b.y - a.y) / dur : 0;
    s.vz = 0;
    s.x = p.x;
    s.y = p.y;
    s.z = p.z;
  }

  // ------------------------------------------------------------------ noqueos
  /** Máquina NOQUEADA: choque eléctrico, sacudida, se tumba de lado con rebote, se oscurece un poco, luz que parpadea y se apaga, algo de humo. */
  private knock(m: Machine) {
    const h = this.h;
    const by = m.sy - 70 * m.ks;
    shockFx(h.st, m.sx, by, m.ks * 1.6);
    powerImpactFx(h.st, 'smash', m.sx, by, m.ks * 1.6, 'lightning', m.sy);
    h.flash(90, ENERGY_COL.light);
    h.shake(6); // (18-11-2026, usuario) sin golpe-fuerte cuando la máquina devuelve la pelota
    m.ko = true;
    m.koT = 0;
    m.smokeT = 0;
    // se tumba hacia fuera (las de la izquierda de la pantalla, a la izquierda)
    m.dir = m.y < LAT_C ? -1 : 1;
    const tw = h.scene.tweens;
    tw.killTweensOf(m.c);
    tw.add({ targets: m.c, x: m.sx + m.dir * 26 * m.ks, y: m.sy + 4 * m.ks, duration: 420, ease: 'Quad.easeOut' });
    tw.chain({
      targets: m.c,
      tweens: [
        { angle: -m.dir * 14, duration: 90, ease: 'Quad.easeOut' },
        { angle: m.dir * 84, duration: 520, ease: 'Bounce.easeOut' },
      ],
    });
    tw.add({ targets: m.shade, alpha: SHADE, duration: 360, delay: 120 });
    this.puffs(m, 3, 0.5);
  }

  /** La BOLA DE ENERGÍA llega: gran explosión (muy notoria) que barre las dos máquinas del centro hacia el fondo. */
  private blast() {
    const h = this.h;
    const A = this.m[1];
    const B = this.m[2];
    const cx = (A.sx + B.sx) / 2;
    const cy = (A.sy + B.sy) / 2;
    const ks = A.ks;
    const s = ks / VIEW.CHAR_K;
    const ey = cy - 70 * ks;
    h.setBall(false, false);
    h.rb.setPower(false);
    h.fire.clear();
    if (this.hur) {
      // (18-11-2026, usuario) el SMASH del HURACÁN: el impacto de su ULTI (oro y viento), el choque de viento en el suelo y ráfagas
      infernoImpactFx(h.st, cx, ey, s * 1.6, 'hurricane'); // (trae hurricaneBurst: no se repite)
      wallKnockFx(h.st, cx, cy, s * 1.4);
      h.flash(200, 0xfff6b0);
      this.sphere.hide();
      this.hAir = false;
      h.scene.tweens.add({ targets: h.pa, lift: 0, duration: 380, ease: 'Quad.easeIn' });
    } else {
      // (17-11-2026) el impacto DESTRUCTIVO de la BOLA DE ENERGÍA (estrella, columna, ondas y grietas en el suelo, esquirlas, brasas, trozos)
      this.impact.play(cx, ey, cy, s);
      h.flash(260, 0xf0fdff);
    }
    h.shake(20);
    if (!this.hur) h.snd('golpe-fuerte', 1); // HURACÁN: ya suena ulti-legendaria-1 en el smash
    this.scorch.setPosition(cx, cy).setVisible(true).setAlpha(0.4);
    const tw = h.scene.tweens;
    for (const m of [A, B]) {
      const dir = m === A ? -1 : 1;
      m.ko = true;
      m.gone = true;
      m.dir = dir;
      m.light.setFillStyle(LIGHT_OFF);
      tw.killTweensOf(m.c);
      tw.killTweensOf(m.shade);
      tw.add({ targets: m.shade, alpha: SHADE, duration: 200 });
      // sale volando hacia el fondo (más arriba y más pequeña en pantalla), girando, y se desvanece
      const x0 = m.c.x;
      const y0 = m.c.y;
      const k0 = m.c.scaleX;
      const a0 = m.c.angle;
      const v = { u: 0 };
      this.fxTw.push(tw.add({
        targets: v,
        u: 1,
        duration: 850,
        ease: 'Quad.easeOut',
        onUpdate: () => {
          if (!m.c.scene) return;
          const u = v.u;
          m.c.setPosition(x0 + dir * 150 * ks * u, y0 - 110 * ks * u - Math.sin(u * Math.PI) * 40 * ks)
            .setScale(k0 * (1 - 0.45 * u))
            .setAngle(a0 + dir * 400 * u)
            .setAlpha(u < 0.55 ? 1 : 1 - (u - 0.55) / 0.45);
        },
      }));
      this.puffs(m, 4, 1);
    }
    // (17-11-2026, usuario) la onda llega hasta las máquinas de las ESQUINAS (ya noqueadas): la izquierda se aleja un poco a la izquierda
    // y la derecha a la derecha, con un temblor; así el impacto se siente más grande. El reinicio (reset) las devuelve a su sitio.
    for (const [m, dir] of [[this.m[0], -1], [this.m[3], 1]] as const) {
      tw.killTweensOf(m.c);
      const x0 = m.c.x;
      const a0 = m.c.angle;
      const push = { u: 0 };
      if (this.hur) {
        // (18-11-2026, usuario) HURACÁN: las empuja MÁS y casi se voltean (se inclinan ~60° hacia fuera) pero vuelven a caer de pie,
        // con un par de balanceos que se apagan
        this.fxTw.push(tw.add({
          targets: push,
          u: 1,
          delay: 70,
          duration: 1100,
          ease: 'Linear',
          onUpdate: () => {
            if (!m.c.scene) return;
            const u = push.u;
            const px = 1 - Math.pow(1 - Math.min(1, u / 0.55), 3); // deslizamiento (Cubic.easeOut en la 1.ª mitad)
            const up = 0.3; // hasta aquí se inclina; después vuelve con balanceo amortiguado
            const tilt = u < up ? Math.sin((u / up) * Math.PI * 0.5) * 60 : 60 * Math.exp(-(u - up) * 5) * Math.cos((u - up) * 11);
            m.c.setX(x0 + dir * 120 * ks * px).setAngle(a0 + dir * tilt);
          },
        }));
      } else
      this.fxTw.push(tw.add({
        targets: push,
        u: 1,
        delay: 70,
        duration: 520,
        ease: 'Cubic.easeOut',
        onUpdate: () => {
          if (!m.c.scene) return;
          const u = push.u;
          m.c.setX(x0 + dir * 55 * ks * u).setAngle(a0 + dir * 10 * Math.sin(u * Math.PI) * (1 - u * 0.5));
        },
      }));
      this.puffs(m, 2, 1);
    }
    // el aura y la penumbra se van (powerDemo corta tras la pausa)
    this.aura?.stop();
    this.aura?.setBoost(1);
  }

  // ------------------------------------------------------------------ humo (pool)
  /** `n` bocanadas desde la máquina (k = fuerza). */
  private puffs(m: Machine, n: number, k: number) {
    for (let i = 0; i < n; i++) this.emit(m.c.x + rand(-30, 30) * m.ks, m.c.y - rand(20, 100) * m.ks, m.ks * (0.8 + k * 0.5), m.sy + 3, k);
  }

  private emit(x: number, y: number, ks: number, depth: number, k = 0.4) {
    const i = this.sNext;
    this.sNext = (i + 1) % SMOKE;
    const o = this.smoke[i];
    this.sMax[i] = this.sLife[i] = rand(0.6, 1.0) * (0.8 + k * 0.4);
    this.sVx[i] = rand(-20, 20) * ks;
    this.sVy[i] = -rand(50, 90) * ks * (1 + k);
    o.setPosition(x, y)
      .setRadius(rand(10, 16) * ks)
      .setFillStyle(Phaser.Math.RND.pick([0x55555f, 0x6a6a75, 0x80808a]), 0.5)
      .setDepth(depth)
      .setScale(1)
      .setAlpha(0.5)
      .setVisible(true);
  }

  private stepSmoke(dt: number) {
    // algo de humo de las máquinas noqueadas (aún en pie: las que barrió la bola ya no están)
    for (const m of this.m) {
      if (!m.ko || m.gone) continue;
      m.koT += dt;
      // la luz parpadea en rojo y se apaga
      m.light.setFillStyle(m.koT < 0.6 && Math.floor(m.koT * 16) % 2 === 0 ? 0xff3b3b : LIGHT_OFF);
      m.smokeT -= dt;
      if (m.smokeT <= 0 && m.koT > 0.3) {
        m.smokeT = 0.38;
        // sale de lo que ahora es la parte de arriba de la máquina tumbada (su costado)
        this.emit(m.c.x + m.dir * rand(40, 70) * m.ks, m.c.y - rand(10, 30) * m.ks, m.ks * 0.7, m.sy + 3);
      }
    }
    for (let i = 0; i < SMOKE; i++) {
      if (this.sLife[i] <= 0) continue;
      const o = this.smoke[i];
      this.sLife[i] -= dt;
      if (this.sLife[i] <= 0) {
        o.setVisible(false);
        continue;
      }
      const u = 1 - this.sLife[i] / this.sMax[i];
      o.setPosition(o.x + this.sVx[i] * dt, o.y + this.sVy[i] * dt)
        .setScale(1 + 1.3 * u)
        .setAlpha(0.5 * (1 - u));
    }
  }
}
