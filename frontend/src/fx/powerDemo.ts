import Phaser from 'phaser';
import { NetView, NET_VIEW_SCALE } from './NetView';
import { ALLEY, COURT, GRAVITY, HIT_MAX_Z, HIT_RANGE, LUNGE_ARM, NET_HEIGHT, NET_OVERHANG, NET_X, PLAYER_SPEED, SHOT_SPEED, SIDE_MARGIN, SMASH_SPEED_MULT } from '../config';
import { Character, playerLook } from '../objects/Character';
import { Ball, type BallState, aimShot, stepBall } from '../objects/Ball';
import { SmashCinematic } from './SmashCinematic';
import { ChargeSpriteFx, chargeFxReady, isSpriteCharge } from './chargeFx';
import type { ChargeFxId } from '../domain/chargeFx';
import { SmokeTrail } from './SmokeTrail';
import { SmashElementFx } from './smashElementFx';
import { INFERNO, INFERNO_CINE, planInfernoContact } from '../logic/InfernoDrive';
import { lightDashFlash, shadowDashFlash, lightningBodyFx, lightningDashFlash, lightningFloorTrail } from './elementImpactFx';
import { VIEW, project } from '../view/projection';
import { DashFx } from './dashFx';
import { DASH, type DashRun, createRun, planSprint, sampleTrajectory, stepRun } from '../logic/DashSprint';
import { SLOWMO_CINE } from './slowmoCine';
import { EnergyCineFx } from './energyBallCine';
import { runAnimRate } from '../logic/PlayerMotion';
import { BLINK, FLIP, JUMP, LIGHTNING, SLOWMO, SHADOW, SKATE, flipPose, skateEase, skateLean } from '../logic/DefensiveMoves';
import * as defFx from './defensiveFx';
import { type PoseActor, placeActor } from './actorPose';
import { IceTrail, iceSprayFx } from './iceTrailFx';
import { spritesIn } from './SmashCinematic';
import { applyCharColor } from './CharColorFx';
import { dashSfx, sfx } from './sfx';
import { getProfile } from '../logic/Profile';
import type { DefensivePower } from '../domain/defensivePowers';
import type { SmashPower } from '../domain/smashPowers';
import { SMASH_LOOK, smashCine } from './smashFx';
import { INFERNO_LOOK, InfernoFire, type FxElement, type InfernoElement, infernoCine, infernoImpactFx, infernoSound, playUltiFile } from './InfernoFx';
import { powerImpactFx } from './ImpactFx';
import type { DemoRect, PowerDemo } from '../ui/PowerDialog';
import { type TrailFx, type TrailLook, TrailParticles, drawRibbon } from './ballTrailFx';
import { EnergyDemo } from './energyDemo';

/**
 * DEMOSTRACIÓN DEL DEFENSIVO (selector de PERSONALIZAR, página 2 de la televisión): tu personaje, de espaldas, contra una MÁQUINA DE PELOTAS que
 * hace de rival (quieta al fondo, en medio). La máquina dispara una pelota y el personaje usa el DEFENSIVO elegido para llegar y devolverla; al
 * devolverla se corta (cortinilla) y vuelve a empezar, alternando derecha / revés.
 *
 * Usa lo MISMO que el partido: la proyección de la cancha (`view/projection`), la física de la pelota (`stepBall` / `aimShot`), los planes de
 * llegada del DASH (`logic/DashSprint`), los tiempos y la forma de cada movimiento (`logic/DefensiveMoves` y las constantes de cada poder), los
 * efectos (`fx/defensiveFx`, `fx/dashFx`, `fx/iceTrailFx`) y la colocación del personaje (`fx/actorPose`). Lo que cambie allí cambia aquí.
 * Todo vive en un contenedor (`stage`) con su escala y posición: los efectos se crean en la escena y un proxy los mete en el escenario.
 *
 * Es solo una demostración: no toca el partido, la red ni lo guardado. El bot, el rival online y la cuenta no intervienen.
 */

const LAT_C = (COURT.top + COURT.bottom) / 2;
const Y_MIN = COURT.top - SIDE_MARGIN;
const Y_MAX = COURT.bottom + SIDE_MARGIN;
/** zona del jugador y alcance hacia atrás del DEFENSIVO: los mismos números que MatchScene */
const P_X = [COURT.left - 70, NET_X - 45];
const DASH_BACK_REACH = 150;
const BOUNDS = { xMin: P_X[0], xMax: P_X[1], yMin: Y_MIN, yMax: Y_MAX };
const BOX = { xMin: P_X[0] - DASH_BACK_REACH, xMax: P_X[1] + 30, yMin: Y_MIN - 30, yMax: Y_MAX + 30 };
/** de dónde sale la pelota (boca de la máquina) y dónde está su base */
const MACHINE_X = COURT.right + 55;
const MUZZLE_Z = 59;
/**
 * (17-11-2026, usuario: "la máquina tira muy lento") velocidad del tiro de la máquina en las demos de ESPECIAL / ULTI / CARGANDO GOLPE
 * (× SHOT_SPEED). Antes 0,8: la pelota tardaba ~1,95 s en llegar a la raqueta; con 1,15, ~1,35 s (le llega a ~48 de alto tras el bote)
 */
export const SPECIAL_SERVE_K = 1.15;
/** dónde bota el ESPECIAL antes de llegar a la máquina (su cancha, entre la línea de saque y el fondo) */
const SPECIAL_BOUNCE_X = COURT.right - 200;
/** altura a la que la bola de la ULTI llega a la máquina (su cuerpo) */
const MACHINE_HIT_Z = 60;
/** segundos entre que acaba un ciclo y sale la siguiente pelota, y tras devolverla antes del corte */
const WAIT_S = 0.85;
const AFTER_S = 0.7;
/** cuánto antes del contacto arranca el golpe (el sprite tarda en llegar a su fotograma de impacto) */
const SWING_LEAD = 0.14;

/** modos con pelota del partido: ESPECIAL (smash), ULTI (inferno) y CARGANDO GOLPE (charge, 21-11-2026) */
type DemoKind = 'smash' | 'inferno' | 'charge';
const clamp = Phaser.Math.Clamp;
/**
 * Sombras de la ULTI en la demostración (DashFx con el tinte del poder; GhostTrail usa preFX y no se puede dentro del escenario): 4, con los alfas del
 * INFERNO, y se quedan hasta el golpe y se desvanecen como las del partido (GhostTrail.end), no el parpadeo corto del DASH.
 */
const ultiGhosts = (el: string) => ({ ...DASH, ghostTint: INFERNO_LOOK[el as InfernoElement].ghostTint, ghosts: INFERNO.dash.ghosts, ghostAlpha: INFERNO.dash.ghostAlpha, ghostHoldMs: 420, ghostFadeMs: INFERNO.dash.ghostFadeMs });
const rand = Phaser.Math.FloatBetween;

type Run = {
  /** s desde que se activó el poder hasta el contacto */
  hitAt: number;
  /** s desde que se activó hasta que arranca el golpe */
  swingAt: number;
  /** lado del golpe: 1 derecha, -1 revés, 0 = según de qué lado venga la pelota */
  facing: -1 | 0;
  update(dt: number): void;
  cleanup(): void;
};

/** Cuadrantes (Quad.easeIn y Back.easeOut) para el DESTELLO. */
const easeIn = (u: number) => u * u;
const backOut = (u: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
};

class DefensiveDemo implements PowerDemo {
  private readonly stage: Phaser.GameObjects.Container;
  /** "escena" con la que se crean los efectos: todo lo que se añade va al escenario */
  private readonly st: Phaser.Scene;
  /** red del partido (fx/NetView.ts) */
  private netView!: NetView;
  private readonly curtain: Phaser.GameObjects.Rectangle;
  private readonly dashFx: DashFx;
  /** (21-11-2026) efecto de velocidad dorado de la carrera a la T del HURACÁN (EnergyDemo.speed) */
  private readonly hurDash: DashFx;
  private readonly pl: Character;
  private readonly pa: PoseActor & { warp: number };
  private readonly machine: Phaser.GameObjects.Container;
  private readonly machineLight: Phaser.GameObjects.Arc;
  private readonly ballC: Phaser.GameObjects.Container;
  private readonly ballShadow: Phaser.GameObjects.Ellipse;
  private readonly ballTrail: Phaser.GameObjects.Graphics;
  private readonly trailPts: { x: number; y: number }[] = [];
  private readonly ball: BallState;
  private readonly crop: { cx: number; cy: number; w: number; h: number };
  private power: DefensivePower;
  private active = false;
  private destroyed = false;
  private phase: 'wait' | 'flight' | 'after' | 'cut' = 'wait';
  private clock = 0;
  private bounces = 0;
  /** botes reales de la pelota devuelta (del otro lado) y cuánto lleva ya quieta: el ciclo espera a que termine de botear */
  private afterBounces = 0;
  /** botes de la pelota del ESPECIAL en el lado de la máquina antes de alcanzarla (como en el partido: bota y luego llega al rival) */
  private specialBounces = 0;
  private settle = 0;
  private ballOn = false;
  private activated = false;
  private swung = false;
  private struck = false;
  private run: Run | null = null;
  private runT = 0;
  private side = 1;
  private zoom = 1;
  private shakeX = 0;
  private shakeY = 0;
  private cutting = false;
  private readonly tick = (_t: number, delta: number) => this.frame(Math.min(0.05, delta / 1000));
  /**
   * MODO EFECTO DE PELOTA (Tienda, 16-11-2026): con `look` el personaje llega corriendo normal (sin DEFENSIVO) y su devolución lleva la
   * estela y las partículas de ese efecto (las mismas de Ball.render en el partido: drawRibbon + TrailParticles).
   */
  private look: TrailLook | null;
  /** EFECTO DE PELOTA en PERSONALIZAR (21-11-2026): con la lista se cambia de efecto (setPower): el aspecto de cada id */
  private lookOf: ((id: string) => TrailLook) | null = null;
  /**
   * MODO ESPECIAL / ULTI (21-11-2026): el personaje llega corriendo como en el efecto de pelota, pero su devolución es el SMASH o el INFERNO del
   * poder el: aura de armado, carga, remate, impacto del partido (powerImpactFx) contra la máquina, que se tambalea, y un globo flojo de vuelta.
   */
  private readonly special: { kind: DemoKind; el: string } | null;
  private infDash: DashFx | null = null;
  private el: string;
  private impacted = false;
  /** las piezas del partido para el ESPECIAL y la ULTI: pelota (objects/Ball), humo y efecto del elemento del SMASH, bola del INFERNO y la cinemática */
  private rb: Ball | null = null;
  private smoke: SmokeTrail | null = null;
  private elFx: SmashElementFx | null = null;
  private fireBall: InfernoFire | null = null;
  private cine: SmashCinematic | null = null;
  private infernoFlight = false;
  /** la demo de energía mantiene la bola de energía aunque la pelota no sea 'power' (1.er golpe del HURACÁN) */
  private keepFlight = false;
  /** brillo del ESPECIAL armado (MatchScene.updateSmashGlow) */
  private glow: Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse | null = null;
  private flashR: Phaser.GameObjects.Rectangle | null = null;
  /** CARGANDO GOLPE: el aro del suelo (sprites, como ChargeSpriteFx del partido; el clásico, el aro dibujado) y cuánto lleva cargando */
  private chargeFx: ChargeSpriteFx | null = null;
  private chargeRing: Phaser.GameObjects.Ellipse | null = null;
  private chargeT: number | null = null;
  private readonly fxParts: TrailParticles | null = null;
  private readonly ribbon: { x: number; y: number; col: number }[] = [];
  private lastDt = 1 / 60;
  /** (17-11-2026) ULTI LEGENDARIA BOLA DE ENERGÍA: su secuencia propia con 4 máquinas (fx/energyDemo.ts); se crea la primera vez que hace falta */
  private energy: EnergyDemo | null = null;
  private get energyOn() {
    return this.special?.kind === 'inferno' && (this.el === 'energy' || this.el === 'hurricane');
  }

  constructor(
    private readonly scene: Phaser.Scene,
    parent: Phaser.GameObjects.Container,
    outer: DemoRect,
    private readonly inner: DemoRect,
    private readonly skin: string,
    initial: DefensivePower,
    look?: TrailLook,
    special?: { kind: DemoKind; el: string },
  ) {
    this.power = initial;
    this.look = look ?? null;
    this.el = special?.el ?? 'fire';
    this.stage = scene.add.container(0, 0);
    parent.add(this.stage);
    // proxy de `add`: cada objeto que crean los efectos se mete en el escenario (que tiene su propia escala y posición)
    const stage = this.stage;
    const add = new Proxy(scene.add, {
      get(target, prop) {
        const v = Reflect.get(target, prop, target) as unknown;
        if (typeof v !== 'function') return v;
        return (...args: unknown[]) => {
          const o = (v as (...a: unknown[]) => unknown).apply(target, args);
          if (o instanceof Phaser.GameObjects.GameObject) stage.add(o);
          return o;
        };
      },
    });
    const foot = project(MACHINE_X, LAT_C);
    const top = foot.sy - 150 * foot.s * VIEW.CHAR_K - 14;
    const bottom = project(COURT.left - 40, LAT_C).sy + 26;
    this.crop = { cx: VIEW.W / 2, cy: (top + bottom) / 2, w: VIEW.W, h: bottom - top };
    // la "escena" de los efectos: la real, pero con `add` hacia el escenario y una cámara propia del escenario (los efectos del partido sacuden y
    // destellan la pantalla: aquí sacuden y destellan solo la demostración). La cinemática del partido congela tweens y reloj: aquí no (el
    // diálogo sigue vivo); la demostración se para sola mientras dura (frame).
    const view = new Phaser.Geom.Rectangle(0, top, VIEW.W, bottom - top);
    const cam = {
      worldView: view,
      scrollX: 0,
      scrollY: 0,
      zoom: 1,
      shake: (_ms?: number, amp?: number) => this.shake(Math.min(10, (typeof amp === 'number' ? amp : 0.01) * 400)),
      flash: (ms = 90, r = 255, g = 255, b = 255) => this.flash(ms, Phaser.Display.Color.GetColor(r, g, b)),
      fadeIn: () => undefined,
      fadeOut: () => undefined,
    };
    const camStub = { main: new Proxy(cam, { get: (o, p) => (p in o ? (o as Record<string | symbol, unknown>)[p] : () => undefined) }) };
    const bindAll = <T extends object>(obj: T, over: Record<string, unknown>) =>
      new Proxy(obj, {
        get(target, prop) {
          if (typeof prop === 'string' && prop in over) return over[prop];
          const v = Reflect.get(target, prop, target) as unknown;
          return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(target) : v;
        },
        set(target, prop, value) {
          if (typeof prop === 'string' && prop in over) return true;
          return Reflect.set(target, prop, value, target);
        },
      });
    const tweens = bindAll(scene.tweens, { pauseAll: () => undefined, resumeAll: () => undefined });
    const time = bindAll(scene.time, { paused: false });
    this.st = new Proxy(scene, {
      get(target, prop) {
        if (prop === 'add') return add;
        if (prop === 'cameras') return camStub;
        if (prop === 'tweens') return tweens;
        if (prop === 'time') return time;
        const v = Reflect.get(target, prop, target) as unknown;
        return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(target) : v;
      },
    });
    this.dashFx = new DashFx(this.st, DASH);
    this.hurDash = new DashFx(this.st, { ...DASH, ghostTint: 0xffd84a });
    this.special = special ?? null;
    if (special?.kind === 'inferno') this.infDash = new DashFx(this.st, ultiGhosts(special.el));

    this.buildCourt();
    const m = this.buildMachine();
    this.machine = m.container;
    this.machineLight = m.light;
    const b = this.buildBall();
    this.ballC = b.ball;
    this.ballShadow = b.shadow;
    this.ballTrail = b.trail;
    if (this.look) this.fxParts = new TrailParticles(this.st.add.graphics());
    if (special) {
      // la pelota, el humo, el efecto del elemento, la bola del INFERNO y la cinemática: los MISMOS objetos del partido
      this.rb = new Ball(this.st);
      this.rb.setVisible(false);
      this.ball = this.rb.s;
      this.smoke = new SmokeTrail(this.st);
      this.elFx = new SmashElementFx(this.st);
      this.elFx.dragonScale = 1.8; // (20-11-2026, usuario) en la vista previa el dragón casi no se veía
      this.fireBall = new InfernoFire(this.st);
      this.cine = new SmashCinematic(this.st);
      this.flashR = this.st.add.rectangle(VIEW.W / 2, this.crop.cy, VIEW.W * 3, 3000, 0xffffff, 0).setDepth(5000).setBlendMode(Phaser.BlendModes.ADD);
      if (special.kind === 'charge') this.useCharge(special.el as ChargeFxId);
    } else this.ball = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 };

    this.pl = new Character(scene, 0, 0, playerLook(skin), 'back');
    this.stage.add(this.pl);
    const color = getProfile().color;
    if (color !== 'classic') applyCharColor(this.pl, color, skin);
    this.pa = { x: COURT.left - 40, y: LAT_C, warp: 1 };
    placeActor(this.pl, this.pa);

    // cortinilla (negra) sobre el escenario, para los cortes entre ciclos y al cambiar de poder
    this.curtain = scene.add.rectangle(outer.x + outer.w / 2, outer.y + outer.h / 2, outer.w, outer.h, 0x000000, 1).setAlpha(0);
    parent.add(this.curtain);
    this.layout();
    // (18-11-2026, usuario: "se pega al ver la ULTI legendaria") la secuencia de la BOLA DE ENERGÍA (4 máquinas, pools, aura) ya NO se
    // crea aquí (en el mismo fotograma del deslizamiento a EN ACCIÓN): se crea en reset() al activarse, con la cortinilla en negro
    if (this.energyOn) this.machine.setVisible(false);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.tick);
  }

  // ------------------------------------------------------------------ API
  setPower(id: string | undefined) {
    if (this.look) {
      // EFECTO DE PELOTA: otro efecto de la lista → su estela y sus partículas desde el próximo ciclo
      if (!id || !this.lookOf) return;
      const nl = this.lookOf(id);
      if (nl === this.look) return;
      this.look = nl;
      this.ribbon.length = 0;
      this.fxParts?.clear();
      if (this.active) this.cut(false);
      return;
    }
    if (this.special) {
      if (!id || id === this.el) return;
      this.el = id;
      if (this.special.kind === 'charge') this.useCharge(id as ChargeFxId);
      if (this.special.kind === 'inferno') {
        this.infDash?.clear();
        this.infDash = new DashFx(this.st, ultiGhosts(id));
      }
      if (this.active) this.cut(false);
      return;
    }
    const p = id as DefensivePower | undefined;
    if (!p || p === this.power) return;
    this.power = p;
    if (this.active) this.cut(false);
  }

  setActive(on: boolean) {
    if (this.destroyed || on === this.active) return;
    this.active = on;
    this.stage.setVisible(true);
    if (on) {
      // entrada: arranca de cero, con la cortinilla abriéndose
      this.reset();
      this.curtain.setAlpha(1);
      this.scene.tweens.add({ targets: this.curtain, alpha: 0, duration: 420, ease: 'Sine.easeOut' });
    } else {
      this.cleanupRun();
      this.stopSpecial(); // (la página se dejó: nada sigue sonando ni a medio dibujar)
      this.curtain.setAlpha(0);
    }
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.active = false;
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.tick);
    this.cleanupRun();
    // los tweens de los objetos del escenario se quitan antes de destruirlos (si no, quedan huérfanos)
    const all: Phaser.GameObjects.GameObject[] = [this.curtain];
    const walk = (o: Phaser.GameObjects.GameObject) => {
      all.push(o);
      (o as Phaser.GameObjects.Container).list?.forEach(walk);
    };
    walk(this.stage);
    this.scene.tweens.killTweensOf(all);
    this.clearStun();
    this.stopSpecial();
    this.energy?.destroy();
    this.energy = null;
    if (this.cine) this.scene.events.off(Phaser.Scenes.Events.POST_UPDATE, (this.cine as unknown as { tailTick: () => void }).tailTick, this.cine);
    this.dashFx.clear();
    this.hurDash.clear();
    this.infDash?.clear();
    if (this.stage.scene) this.stage.destroy(true);
    this.curtain.destroy();
  }

  // ------------------------------------------------------------------ ciclo
  private frame(dt: number) {
    if (!this.active || this.destroyed || !this.stage.scene) return;
    this.zoom += (this.targetZoom - this.zoom) * Math.min(1, dt * 4);
    this.focusK += ((this.focusOn ? 1 : 0) - this.focusK) * Math.min(1, dt * 4);
    const realDt = dt;
    dt *= this.slowK; // TIEMPO LENTO: el mundo va lento mientras corre (el zoom y la cámara siguen en tiempo real)
    this.shakeX *= 0.82;
    this.shakeY *= 0.82;
    // cinemática del ESPECIAL / ULTI (la del partido): mientras dura, la demostración se congela como el partido (pelota quieta)
    if (this.dk && (this.darkWant > 0 || this.darkOn)) this.darkOn = this.dk.drawDark(this.darkWant, realDt);
    if (this.energyOn && this.energy) {
      // (17-11-2026) BOLA DE ENERGÍA: su secuencia con las 4 máquinas (fx/energyDemo.ts; la cinemática la mueve ella)
      if (this.phase !== 'cut') this.energy.update(dt);
    } else if (this.cine?.active) {
      this.cine.update();
    } else if (this.phase === 'wait') {
      this.clock += dt;
      this.machineLight.setFillStyle(this.clock > WAIT_S - 0.35 && Math.floor(this.clock * 12) % 2 === 0 ? 0xffd23f : 0x35c85a);
      if (this.clock >= WAIT_S) this.fire();
    } else if (this.phase === 'flight' || this.phase === 'after') {
      this.stepPhysics(dt);
      if (this.phase === 'flight') this.stepFlight(dt);
      else {
        if (this.special && !this.impacted && this.hitsMachine()) this.impactSpecial();
        // tras devolver: se deja que la pelota bote hasta quedar casi quieta (3 botes o parada) y se espera un instante antes del corte
        this.clock += dt;
        const b = this.ball;
        // ULTI: la pelota atravesó la máquina y se va; se corta cuando sale de la pantalla
        const gone = this.special?.kind === 'inferno' && this.impacted && b.x > MACHINE_X + 260;
        const stopped = gone || (this.special?.kind !== 'inferno' && this.afterBounces >= 3) || (this.afterBounces >= 1 && b.z <= 0.01 && Math.abs(b.vx) < 30 && Math.abs(b.vy) < 30);
        if (stopped) this.settle += dt;
        if (this.settle >= AFTER_S || this.clock >= 5) this.cut(true);
      }
    }
    this.lastDt = dt;
    this.netView.update(); // la red solo se redibuja mientras ondula
    this.renderBall();
    placeActor(this.pl, this.pa);
    this.stage.sort('depth');
    this.layout();
  }

  private targetZoom = 1;
  /** TIEMPO LENTO: velocidad del mundo (1 = normal) y cámara fija en el personaje (focusOn) con su avance suave (focusK) */
  private slowK = 1;
  /** TIEMPO LENTO: penumbra (solo se ven los personajes y la pelota) */
  private dk: EnergyCineFx | null = null;
  private darkWant = 0;
  private darkOn = false;
  private focusOn = false;
  private focusK = 0;

  private layout() {
    const i = this.inner;
    const k = Math.min(i.w / this.crop.w, i.h / this.crop.h) * this.zoom;
    // TIEMPO LENTO: el centro del encuadre se va al personaje mientras dura su cinemática
    let cx = this.crop.cx;
    let cy = this.crop.cy;
    if (this.focusK > 0.001) {
      const f = project(this.pa.x, this.pa.y);
      const e = this.focusK * this.focusK * (3 - 2 * this.focusK);
      cx += (f.sx - cx) * e;
      cy += (f.sy - 70 * f.s * VIEW.CHAR_K - cy) * e;
    }
    this.stage.setScale(k);
    this.stage.setPosition(i.x + i.w / 2 - k * cx + this.shakeX, i.y + i.h / 2 - k * cy + this.shakeY);
  }

  private shake(amp: number) {
    this.shakeX = rand(-amp, amp);
    this.shakeY = rand(-amp, amp);
  }

  /** destello de "pantalla" (cameras.main.flash de los efectos del partido), solo sobre la demostración */
  private flash(ms: number, col: number) {
    const r = this.flashR;
    if (!r || !r.scene) return;
    this.scene.tweens.killTweensOf(r);
    r.setFillStyle(col, 1).setAlpha(0.45);
    this.scene.tweens.add({ targets: r, alpha: 0, duration: Math.max(120, ms * 2), ease: 'Quad.easeOut' });
  }

  /** Estado inicial de un ciclo: personaje en guardia, máquina cargada, sin pelota. */
  private reset() {
    this.cleanupRun();
    const a = this.pa;
    a.x = COURT.left - 40;
    a.y = LAT_C;
    a.warp = 1;
    a.lift = 0;
    a.spin = undefined;
    a.squat = 0;
    this.scene.tweens.killTweensOf(a);
    this.pl.setSprint(false, 0);
    this.pl.facing = 1;
    this.pl.resetPose();
    this.pl.setReady(false);
    this.ballOn = false;
    this.keepFlight = false;
    this.trailPts.length = 0;
    this.ballTrail.clear();
    this.ribbon.length = 0;
    this.fxParts?.clear();
    this.phase = 'wait';
    this.clock = 0;
    this.bounces = 0;
    this.afterBounces = 0;
    this.specialBounces = 0;
    this.settle = 0;
    this.activated = false;
    this.swung = false;
    this.struck = false;
    this.impacted = false;
    this.stopSpecial();
    this.clearStun();
    this.scene.tweens.killTweensOf(this.machine);
    this.machine.setAngle(0).setX(project(MACHINE_X, LAT_C).sx).setVisible(true).setAlpha(1);
    this.wreck.forEach((o) => o.scene && o.destroy());
    this.wreck = [];
    this.syncEnergy();
    this.runT = 0;
    this.targetZoom = 1;
    this.zoom = 1;
    this.slowK = 1;
    this.focusOn = false;
    this.focusK = 0;
    this.darkWant = 0;
    this.darkOn = false;
    this.dk?.hide();
    this.side = -this.side; // derecha / revés alternando
  }

  /** Corte entre ciclos: cortinilla que cierra, se reinicia y abre. `slow` = tras devolver (más pausado). */
  private cut(slow: boolean) {
    if (this.cutting) return;
    this.cutting = true;
    this.phase = 'cut';
    this.targetZoom = 1.1;
    this.scene.tweens.add({
      targets: this.curtain,
      alpha: 1,
      duration: slow ? 260 : 160,
      ease: 'Quad.easeIn',
      onComplete: () => {
        if (this.destroyed) return;
        this.reset();
        this.cutting = false;
        this.scene.tweens.add({ targets: this.curtain, alpha: 0, duration: 340, ease: 'Sine.easeOut' });
      },
    });
  }

  // ------------------------------------------------------------------ la pelota
  private fire() {
    const b = this.ball;
    b.x = MACHINE_X - 15;
    b.y = LAT_C;
    b.z = MUZZLE_Z;
    b.damp = undefined;
    if (this.special) {
      // ESPECIAL / ULTI: la máquina tira DIRECTO al personaje (bota delante de él y le llega a la raqueta): no hace falta moverse
      // (bota a 340 de él: le llega a media altura, ~60 en el ESPECIAL y ~85 donde arranca la ULTI)
      // (la ULTI también: avanza lo justo desde donde está y sus sombras quedan separadas detrás de él, así se ven aunque el avance sea corto)
      aimShot(b, this.pa.x + 340, this.pa.y, SHOT_SPEED * SPECIAL_SERVE_K, 18);
      this.armSpecial();
    } else {
      // destino: en el fondo de su lado, a un costado (alterna): obliga a moverse
      const tx = COURT.left + 190;
      const ty = LAT_C + this.side * 135;
      aimShot(b, tx, ty, SHOT_SPEED * 0.8, 18);
    }
    this.ballOn = true;
    this.bounces = 0;
    this.phase = 'flight';
    this.clock = 0;
    this.pl.setReady(true);
    this.machineLight.setFillStyle(0x35c85a);
    this.snd('golpe-fuerte', 0.5);
    // retroceso de la máquina y fogonazo en la boca
    const ks = this.machine.scaleX;
    this.scene.tweens.add({ targets: this.machine, scaleX: ks * 1.07, scaleY: ks * 0.93, duration: 70, yoyo: true, ease: 'Quad.easeOut' });
    const mp = project(MACHINE_X, LAT_C);
    const my = mp.sy - 76 * ks;
    const flash = this.st.add.circle(mp.sx, my, 26 * ks, 0xfff1b8, 0.9).setDepth(mp.sy + 3).setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: flash, scale: 2.4, alpha: 0, duration: 200, ease: 'Quad.easeOut', onComplete: () => flash.destroy() });
    for (let i = 0; i < 6; i++) {
      const puff = this.st.add.circle(mp.sx + rand(-10, 10) * ks, my + rand(-6, 6) * ks, rand(6, 11) * ks, 0xd8dcea, 0.55).setDepth(mp.sy + 2);
      this.scene.tweens.add({ targets: puff, x: puff.x + rand(-34, 34) * ks, y: puff.y + rand(10, 40) * ks, scale: 2.1, alpha: 0, duration: rand(280, 480), onComplete: () => puff.destroy() });
    }
  }

  private stepPhysics(dt: number) {
    if (!this.ballOn) return;
    const n = Math.max(1, Math.ceil(dt * 120));
    for (let i = 0; i < n; i++) {
      const vz0 = this.ball.vz;
      const vx0 = this.ball.vx;
      const ev = stepBall(this.ball, dt / n);
      // un bote de verdad (la pelota rodando también da "bote" en cada paso: no cuenta)
      const real = ev === 'bounce' && vz0 < -120;
      if (real && this.special && !this.impacted && this.ball.x > NET_X) this.specialBounces++;
      if (real && this.struck && (!this.special || this.impacted)) this.afterBounces++;
      else if (real && this.ball.x < NET_X) this.bounces++;
      if (real) {
        const p = project(this.ball.x, this.ball.y);
        const r = this.st.add.ellipse(p.sx, p.sy, 34 * p.s, 11 * p.s).setStrokeStyle(2.5 * p.s, 0xffffff, 0.8).setDepth(p.sy - 0.4);
        this.scene.tweens.add({ targets: r, scale: 2.4, alpha: 0, duration: 300, ease: 'Cubic.easeOut', onComplete: () => r.destroy() });
      }
      if (ev === 'net') {
        this.netView.hit(this.ball.y, this.ball.z, vx0);
        this.ball.vx = Math.abs(this.ball.vx) * 0.2;
      }
    }
  }

  /** Mientras vuela hacia el jugador: al cruzar la red se activa el DEFENSIVO; luego se mueve el movimiento y se golpea en su momento. */
  private stepFlight(dt: number) {
    if (this.special) return this.stepSpecial();
    if (!this.activated && this.ball.x < NET_X - 25) {
      this.activated = true;
      this.run = this.exec();
      this.runT = 0;
      if (!this.run) {
        this.cut(false);
        return;
      }
      this.targetZoom = 1.06;
    }
    const r = this.run;
    if (!r) return;
    this.runT += dt;
    r.update(dt);
    if (!this.swung && this.runT >= r.swingAt) {
      this.swung = true;
      this.pl.facing = r.facing !== 0 ? r.facing : this.ball.y > this.pa.y ? 1 : -1;
      if (this.special) this.pl.swing(true, true, true);
      else this.pl.swing(false, false, false, false);
    }
    if (!this.struck && this.runT >= r.hitAt) this.strike();
  }

  /** El contacto: la pelota sale devuelta hacia la máquina y se ve el golpe. */
  private strike() {
    this.struck = true;
    const b = this.ball;
    b.z = Math.max(b.z, 22);
    if (this.special) {
      this.launchSpecial();
      this.phase = 'after';
      this.clock = 0;
      this.pl.setReady(false);
      return;
    }
    aimShot(b, COURT.right - 230, LAT_C - this.side * 90, SHOT_SPEED * 0.95, 18);
    this.bounces = 0;
    const p = project(b.x, b.y, b.z);
    const ring = this.st.add.circle(p.sx, p.sy, 16, 0xffffff, 0).setStrokeStyle(6, 0xffffff, 0.95).setDepth(p.sy + 8).setBlendMode(Phaser.BlendModes.ADD);
    this.scene.tweens.add({ targets: ring, scale: 4, alpha: 0, duration: 320, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    const star = this.st.add.star(p.sx, p.sy, 8, 6, 44, 0xfff1b8, 0.9).setDepth(p.sy + 9).setBlendMode(Phaser.BlendModes.ADD).setScale(0.3);
    this.scene.tweens.add({ targets: star, scale: 1.2, angle: 40, alpha: 0, duration: 260, ease: 'Cubic.easeOut', onComplete: () => star.destroy() });
    this.shake(3);
    this.snd('golpe-fuerte', 0.7);
    this.phase = 'after';
    this.clock = 0;
    this.pl.setReady(false);
  }

  private renderBall() {
    if (this.rb) {
      // ESPECIAL / ULTI: la pelota del partido con su humo, el efecto de su elemento y la bola del INFERNO (MatchScene.update)
      const rb = this.rb;
      this.ballC.setVisible(false);
      this.ballShadow.setVisible(false);
      this.ballTrail.setVisible(false);
      rb.setVisible(this.ballOn);
      // (21-11-2026, usuario) HURACÁN, 1.er golpe: la pelota NO es 'power' pero sí vuela como BOLA DE ENERGÍA (como en el partido): la demo de energía lo pide con setBall(true, true)
      if (!rb.power && !this.keepFlight) this.infernoFlight = false;
      rb.quietFx = this.infernoFlight;
      rb.render(this.lastDt);
      const vis = this.ballOn && rb.sprite.visible;
      const smashOn = rb.power && !this.infernoFlight;
      this.smoke?.update(this.lastDt, rb.s, smashOn, false, vis);
      this.elFx?.update(this.lastDt, rb.s, smashOn, false, vis);
      this.fireBall?.update(rb.s, this.infernoFlight, vis);
      this.renderGlow();
      this.renderCharge();
      return;
    }
    this.ballC.setVisible(this.ballOn);
    this.ballShadow.setVisible(this.ballOn);
    this.ballTrail.setVisible(this.ballOn);
    if (!this.ballOn) return;
    const { x, y, z } = this.ball;
    const ground = project(x, y, 0);
    const air = project(x, y, z);
    const k = Math.max(0.5, 1 - z / 320);
    this.ballShadow.setPosition(ground.sx, ground.sy).setScale(k * ground.s * 0.95).setAlpha(0.55 * k + 0.1).setDepth(1);
    const scale = air.s * 0.8 * (1 + Math.min(z, 220) / 700);
    this.ballC.setPosition(air.sx, air.sy).setScale(scale).setDepth(ground.sy + 2);
    this.ballTrail.setDepth(ground.sy + 1);
    // MODO EFECTO DE PELOTA: la devolución lleva la estela del efecto (como en el partido); la pelota de la máquina, la blanca de siempre
    if (this.look && this.struck) {
      const fx: TrailFx = this.look.fx ?? 'plain';
      this.ribbon.push({ x: air.sx, y: air.sy, col: this.look.trail });
      if (this.ribbon.length > 20) this.ribbon.shift();
      this.ballTrail.clear();
      drawRibbon(this.ballTrail, this.ribbon, { scale, charged: false, boost: 0, fx, now: this.scene.time.now });
      if (this.fxParts) {
        this.fxParts.g.setDepth(ground.sy + 2);
        this.fxParts.tick(fx !== 'plain' ? fx : null, air.sx, air.sy, scale, this.lastDt);
      }
      return;
    }
    // estela corta, blanca
    this.trailPts.push({ x: air.sx, y: air.sy });
    if (this.trailPts.length > 14) this.trailPts.shift();
    const g = this.ballTrail.clear();
    const n = this.trailPts.length;
    for (let i = 1; i < n; i++) {
      const a = this.trailPts[i - 1];
      const b = this.trailPts[i];
      const t = i / n;
      g.lineStyle((2 + t * 9) * scale, 0xffffff, t * 0.4).lineBetween(a.x, a.y, b.x, b.y);
    }
  }

  // ------------------------------------------------------------------ el movimiento de cada poder (los mismos pasos que el partido)
  /** Punto de golpeo (igual que MatchScene.dashPlan): el primero a partir de `minT` s, tras el 1er bote; si no hay, volea. */
  private plan(minT: number): { x: number; y: number; t: number } | null {
    const s = { ...this.ball };
    let bounces = this.bounces;
    let volley: { x: number; y: number; t: number } | null = null;
    const dt = 1 / 120;
    for (let t = 0; t < 4; t += dt) {
      const ev = stepBall(s, dt);
      if (ev === 'net') return null;
      if (ev === 'bounce' && s.x < NET_X && ++bounces >= 2) break;
      if (t < minT || s.x > NET_X - 30) continue;
      const reachable = s.x >= P_X[0] - DASH_BACK_REACH && s.x <= P_X[1] + 30 && s.y >= Y_MIN - 30 && s.y <= Y_MAX + 30 && s.z < HIT_MAX_Z * 0.85;
      if (!reachable) continue;
      if (bounces >= 1 && s.z < HIT_MAX_Z * 0.7) return { x: s.x, y: s.y, t };
      if (!volley) volley = { x: s.x, y: s.y, t };
    }
    return volley;
  }

  private exec(): Run | null {
    if (this.look) return this.execRun();
    switch (this.power) {
      case 'blink':
        return this.execBlink();
      case 'lightning':
        return this.execLightning();
      case 'slowmo':
        return this.execSlowmo();
      case 'shadow':
        return this.execShadow();
      case 'jump':
        return this.execJump();
      case 'flip':
        return this.execFlip();
      case 'skate':
        return this.execSkate();
      default:
        return this.execDash();
    }
  }

  private ghost(i: number, ch: Phaser.GameObjects.Container = this.pl) {
    this.dashFx.ghost(ch, i, ch.depth, this.stage);
  }

  private snd(name: string, vol = 0.6) {
    try {
      sfx(this.scene, name, vol);
    } catch {
      /* sin audio */
    }
  }

  /** MODO EFECTO DE PELOTA: corre normal (sin DEFENSIVO) hasta el punto de golpeo y devuelve. */
  private execRun(): Run | null {
    const plan = this.plan(0.3);
    if (!plan) return null;
    const from = { x: this.pa.x, y: this.pa.y };
    const tx = clamp(plan.x - 18, P_X[0], P_X[1]);
    const ty = clamp(plan.y, Y_MIN, Y_MAX);
    const runT = Math.max(0.2, plan.t - 0.12);
    let t = 0;
    this.pl.setMoving(true, Math.sign(ty - from.y) || 1);
    return {
      hitAt: plan.t,
      swingAt: plan.t - SWING_LEAD,
      facing: 0,
      update: (dt) => {
        t += dt;
        const k = Math.min(1, t / runT);
        const e = k * k * (3 - 2 * k);
        this.pa.x = from.x + (tx - from.x) * e;
        this.pa.y = from.y + (ty - from.y) * e;
        if (k >= 1) this.pl.setMoving(false, 0);
      },
      cleanup: () => this.pl.setMoving(false, 0),
    };
  }

  /** DASH: sprint hasta la pelota con sombras (el de siempre). */
  private execDash(): Run | null {
    const from = { x: this.pa.x, y: this.pa.y };
    const smp = sampleTrajectory(this.ball, this.bounces, stepBall, NET_X, HIT_MAX_Z, BOX);
    const plan = smp ? planSprint(smp, from, PLAYER_SPEED, BOUNDS) : null;
    if (!plan) return null;
    const r: DashRun = createRun(from, plan, PLAYER_SPEED);
    this.pl.setSprint(true, r.dirX);
    const p = project(from.x, from.y);
    this.dashFx.burst(p.sx, p.sy, p.s * VIEW.CHAR_K, this.pl.depth);
    this.snd(dashSfx(getProfile().smash));
    let landed = false;
    let ended = false;
    return {
      hitAt: plan.t,
      swingAt: plan.t - SWING_LEAD,
      facing: 0,
      update: (dt) => {
        const st = stepRun(r, dt);
        this.pa.x = st.pos.x;
        this.pa.y = st.pos.y;
        if (st.ghosts.length) {
          placeActor(this.pl, this.pa);
          for (const i of st.ghosts) this.ghost(i);
        }
        if (st.entered === 'land' && !landed) {
          landed = true;
          this.pl.setSprint(false, r.dirX, true);
        }
        if (st.phase === 'done' && !ended) {
          ended = true;
          this.pl.setSprint(false, r.dirX, false);
        }
      },
      cleanup: () => this.pl.setSprint(false, r.dirX, false),
    };
  }

  /** DESTELLO: desaparece dejando una estela, reaparece junto a la pelota y devuelve de revés. */
  private execBlink(): Run | null {
    const normal = this.plan(BLINK.out + BLINK.in + BLINK.swingLead + 0.02);
    const plan = normal ?? this.plan(BLINK.fastOut + BLINK.fastIn + 0.1);
    if (!plan) return null;
    const fast = !normal;
    const from = { x: this.pa.x, y: this.pa.y };
    const tx = clamp(plan.x - 18, P_X[0], P_X[1]);
    const ty = clamp(plan.y + BLINK.side, Y_MIN, Y_MAX);
    const out = fast ? BLINK.fastOut : BLINK.out;
    const inn = fast ? BLINK.fastIn : BLINK.in;
    const a = project(from.x, from.y);
    const b = project(tx, ty);
    const k = a.s * VIEW.CHAR_K;
    this.dashFx.burst(a.sx, a.sy, k, this.pl.depth, 0x45d9ff);
    this.snd('dash-destello');
    if (Math.hypot(tx - from.x, ty - from.y) > 40) {
      for (let i = 0; i < 3; i++) {
        const f = (i + 1) / 4;
        this.pa.x = from.x + (tx - from.x) * f;
        this.pa.y = from.y + (ty - from.y) * f;
        placeActor(this.pl, this.pa);
        this.ghost(i);
      }
      this.pa.x = from.x;
      this.pa.y = from.y;
      placeActor(this.pl, this.pa);
    }
    this.dashFx.streak(a.sx, a.sy - 70 * k, b.sx, b.sy - 70 * k, k, this.pl.depth);
    defFx.portal(this.st, from.x, from.y, 0x45d9ff, 0xd9f7ff);
    let t = 0;
    let moved = false;
    return {
      hitAt: plan.t,
      swingAt: plan.t - BLINK.swingLead,
      facing: -1,
      update: (dt) => {
        t += dt;
        if (t < out) this.pa.warp = 1 - easeIn(t / out);
        else {
          if (!moved) {
            moved = true;
            this.pa.x = tx;
            this.pa.y = ty;
            defFx.portal(this.st, tx, ty, 0x45d9ff, 0xd9f7ff);
          }
          this.pa.warp = t < out + inn ? clamp(backOut((t - out) / inn), 0, 1) : 1;
        }
      },
      cleanup: () => {
        this.pa.warp = 1;
      },
    };
  }

  /** RELÁMPAGO (épico): azul neón, rayo hasta la pelota con rastro de rayos en el suelo, reaparece y devuelve de revés (como en el partido). */
  private execLightning(): Run | null {
    const normal = this.plan(LIGHTNING.chg + LIGHTNING.out + LIGHTNING.in + LIGHTNING.swingLead + 0.02);
    const plan = normal ?? this.plan(LIGHTNING.fastChg + LIGHTNING.fastOut + LIGHTNING.fastIn + 0.1);
    if (!plan) return null;
    const fast = !normal;
    const from = { x: this.pa.x, y: this.pa.y };
    const tx = clamp(plan.x - 18, P_X[0], P_X[1]);
    const ty = clamp(plan.y + LIGHTNING.side, Y_MIN, Y_MAX);
    const chg = fast ? LIGHTNING.fastChg : LIGHTNING.chg;
    const out = fast ? LIGHTNING.fastOut : LIGHTNING.out;
    const inn = fast ? LIGHTNING.fastIn : LIGHTNING.in;
    const a = project(from.x, from.y);
    const b = project(tx, ty);
    const pl = this.pl;
    this.snd('dash-electirco-1', 0.8);
    lightningBodyFx(this.st, () => {
      const f = project(this.pa.x, this.pa.y);
      return { x: f.sx, y: f.sy, headY: f.sy - 150 * f.s * VIEW.CHAR_K * 0.9 };
    }, (chg + out + inn) * 1000 + 220, pl, this.stage, true);
    let t = 0;
    let flashed = false;
    let moved = false;
    return {
      hitAt: plan.t,
      swingAt: plan.t - LIGHTNING.swingLead,
      facing: -1,
      update: (dt) => {
        t += dt;
        if (t < chg) return;
        if (!flashed) {
          flashed = true;
          lightningDashFlash(this.st, a.sx, a.sy, b.sx, b.sy, a.s, 150 * a.s * VIEW.CHAR_K * 0.9);
          lightningFloorTrail(this.st, a.sx, a.sy, b.sx, b.sy, a.s * VIEW.CHAR_K);
        }
        if (t < chg + out) this.pa.warp = 1 - easeIn((t - chg) / out);
        else {
          if (!moved) {
            moved = true;
            this.pa.x = tx;
            this.pa.y = ty;
          }
          this.pa.warp = t < chg + out + inn ? clamp(backOut((t - chg - out) / inn), 0, 1) : 1;
        }
      },
      cleanup: () => {
        this.pa.warp = 1;
      },
    };
  }

  /**
   * TIEMPO LENTO (legendario): corre a la pelota en cámara lenta (el mundo a SLOWMO.k, pantalla en penumbra) y para un poco antes de ella; la
   * cinemática de 2 s (partido congelado, cámara cerca del personaje) lo AVANZA con la estirada hasta la pelota y al final devuelve. Es la
   * misma coreografía del partido (MatchScene.startSlowmo / updateSlowmoHit).
   */
  private execSlowmo(): Run | null {
    const plan = this.plan(SLOWMO.minT);
    if (!plan) return null;
    const cine = (this.cine ??= new SmashCinematic(this.st));
    const from = { x: this.pa.x, y: this.pa.y };
    const side = plan.y > from.y ? 1 : -1;
    const tx = clamp(plan.x - 18 - SLOWMO.ax, P_X[0], P_X[1]);
    const ty = clamp(plan.y - side * (LUNGE_ARM + SLOWMO.ay), Y_MIN, Y_MAX);
    const runT = Math.max(0.3, plan.t - SLOWMO.lead);
    // ritmo de las zancadas = lo que avanza en pantalla (el mundo va a SLOWMO.k)
    const rate = runAnimRate(((Math.hypot(tx - from.x, ty - from.y) / runT) * SLOWMO.k) / PLAYER_SPEED);
    const pl = this.pl;
    this.slowK = SLOWMO.k;
    this.dk ??= new EnergyCineFx(this.st);
    this.dk.hide();
    this.darkWant = SLOWMO.dark;
    this.darkOn = true;
    pl.setSprint(true, Math.sign(ty - from.y) || 1);
    const p0 = project(from.x, from.y);
    this.dashFx.burst(p0.sx, p0.sy, p0.s * VIEW.CHAR_K, pl.depth, 0x9be7ff);
    this.snd('dash-destello', 0.6);
    this.flash(120, 0xbfe6ff);
    let t = 0;
    let stage = 0;
    let ghosts = 0;
    const run: Run = {
      hitAt: 1e9, // lo fija la cinemática al terminar
      swingAt: 1e9,
      facing: 0,
      update: (dt) => {
        if (stage !== 0) return;
        for (const sp of spritesIn(pl)) if (sp.anims) sp.anims.timeScale = rate;
        t += dt;
        const k = Math.min(1, t / runT);
        const e = k * k * (3 - 2 * k);
        this.pa.x = from.x + (tx - from.x) * e;
        this.pa.y = from.y + (ty - from.y) * e;
        if (ghosts < 3 && k >= (ghosts + 1) / 4) {
          placeActor(pl, this.pa);
          this.ghost(ghosts++);
        }
        if (k < 1) return;
        stage = 1;
        this.slowK = 1;
        pl.setSprint(false, 0);
        pl.facing = side;
        if (!pl.lunge(side)) pl.swing(false, false, false, false);
        const sprites = spritesIn(pl);
        for (const sp of sprites) if (sp.anims) sp.anims.timeScale = SLOWMO.spriteK;
        // la pelota queda quieta durante la cinemática: la estirada termina junto a ella
        const b = this.ball;
        const to = { x: clamp(b.x - 18, P_X[0], P_X[1]), y: clamp(b.y - side * LUNGE_ARM, Y_MIN, Y_MAX) };
        const st0 = { x: this.pa.x, y: this.pa.y };
        this.targetZoom = SLOWMO.demoZoom;
        this.focusOn = true;
        this.snd('cargando', 0.6);
        cine.start({
          profile: SLOWMO_CINE,
          freeze: sprites,
          executor: sprites,
          leadMs: SLOWMO.leadMs,
          focus: () => this.focus(),
          onFrame: (e) => {
            const u = Math.min(1, e / (SLOWMO.hitMs - 150));
            const m = u * u * (3 - 2 * u);
            this.pa.x = st0.x + (to.x - st0.x) * m;
            this.pa.y = st0.y + (to.y - st0.y) * m;
            this.targetZoom = SLOWMO.demoZoom + 0.35 * Math.max(0, (e - SLOWMO.zoomInMs) / (SLOWMO.hitMs - SLOWMO.zoomInMs));
          },
          onCancel: () => {
            this.focusOn = false;
            this.darkWant = 0;
          },
          onHit: () => {
            stage = 2;
            this.focusOn = false;
            this.darkWant = 0;
            this.pa.x = to.x;
            this.pa.y = to.y;
            this.targetZoom = 1.06;
            run.hitAt = 0; // el contacto: strike() en el próximo fotograma (pelota fuerte hacia la máquina)
            this.shake(5);
            this.snd('electricidad', 0.6);
          },
        });
      },
      cleanup: () => {
        this.slowK = 1;
        this.focusOn = false;
        this.darkWant = 0;
        cine.cancel();
        pl.setSprint(false, 0);
      },
    };
    return run;
  }
  /** SOMBRA: un clon oscuro corre hasta la pelota y cambias tu lugar con él. */
  private execShadow(): Run | null {
    const plan = this.plan(SHADOW.runMin + 0.08);
    if (!plan) return null;
    const from = { x: this.pa.x, y: this.pa.y };
    const tx = clamp(plan.x - 18, P_X[0], P_X[1]);
    const ty = clamp(plan.y, Y_MIN, Y_MAX);
    const dur = clamp(plan.t - 0.08, SHADOW.runMin, SHADOW.runMax);
    const clone = new Character(this.scene, 0, 0, playerLook(this.skin), 'back');
    this.stage.add(clone);
    for (const sp of spritesIn(clone)) sp.setTint(SHADOW.tint);
    clone.setAlpha(SHADOW.alpha);
    clone.setSprint(true, ty - from.y);
    const p0 = project(from.x, from.y);
    this.dashFx.burst(p0.sx, p0.sy, p0.s * VIEW.CHAR_K, this.pl.depth);
    this.snd('dash-shadow');
    const puff = { t: 0 };
    let ghosts = 0;
    let swapped = false;
    let t = 0;
    return {
      hitAt: plan.t,
      swingAt: plan.t - SWING_LEAD,
      facing: 0,
      update: (dt) => {
        t += dt;
        if (swapped) return;
        const k = Math.min(1, t / dur);
        const p = project(from.x + (tx - from.x) * k, from.y + (ty - from.y) * k);
        clone.setPosition(p.sx, p.sy).setScale(p.s * VIEW.CHAR_K).setDepth(p.sy);
        if (ghosts < 3 && t >= (dur / 4) * (ghosts + 1)) this.ghost(ghosts++, clone);
        defFx.shadowTrailPuff(this.st, this.scene.time.now, clone, puff);
        if (k < 1) return;
        swapped = true;
        // CAMBIO DE LUGAR: humo donde estabas, apareces en el punto y el clon se deshace
        defFx.portal(this.st, this.pa.x, this.pa.y, 0x5a32b8, 0xd4bfff);
        defFx.shadowSmoke(this.st, this.pa.x, this.pa.y, false);
        this.pa.x = tx;
        this.pa.y = ty;
        this.pa.warp = 1;
        defFx.portal(this.st, tx, ty, 0x9a6bff, 0xffffff);
        defFx.shadowSmoke(this.st, tx, ty, true);
        this.shake(3);
        this.scene.tweens.add({ targets: clone, alpha: 0, duration: 160, onComplete: () => clone.destroy() });
      },
      cleanup: () => {
        this.scene.tweens.killTweensOf(clone);
        if (clone.scene) clone.destroy();
      },
    };
  }

  /** SUPERSALTO: salto en parábola hasta la pelota; cae con onda de choque y grietas. */
  private execJump(): Run | null {
    const plan = this.plan(JUMP.airMin + 0.06);
    if (!plan) return null;
    const from = { x: this.pa.x, y: this.pa.y };
    const tx = clamp(plan.x - 18, P_X[0], P_X[1]);
    const ty = clamp(plan.y, Y_MIN, Y_MAX);
    const dur = clamp(plan.t - 0.06, JUMP.airMin, JUMP.airMax);
    this.pl.setMoving(false, 0);
    defFx.dust(this.st, from.x, from.y);
    defFx.jumpTakeoff(this.st, from.x, from.y);
    this.takeoffSquash();
    this.snd('dash-jump');
    let ghosts = 0;
    let landed = false;
    let t = 0;
    return {
      hitAt: plan.t,
      swingAt: plan.t - SWING_LEAD,
      facing: 0,
      update: (dt) => {
        t += dt;
        if (landed) return;
        const k = Math.min(1, t / dur);
        this.pa.x = from.x + (tx - from.x) * k;
        this.pa.y = from.y + (ty - from.y) * k;
        this.pa.lift = 4 * JUMP.height * k * (1 - k);
        if (ghosts < 3 && k >= (ghosts + 1) / 4) {
          placeActor(this.pl, this.pa);
          this.ghost(ghosts++);
        }
        if (k >= 1) {
          landed = true;
          this.pa.lift = 0;
          this.pa.x = tx;
          this.pa.y = ty;
          defFx.jumpLand(this.st, tx, ty);
          this.landSquash();
          this.shake(4);
        }
      },
      cleanup: () => {
        this.pa.lift = 0;
      },
    };
  }

  /** VOLTERETA: dos volteretas laterales en arco, toque de suelo entre las dos, cae agachado y devuelve de revés. */
  private execFlip(): Run | null {
    const plan = this.plan(FLIP.airMin + FLIP.lead);
    if (!plan) return null;
    const from = { x: this.pa.x, y: this.pa.y };
    const tx = clamp(plan.x - 18, P_X[0], P_X[1]);
    const ty = clamp(plan.y, Y_MIN, Y_MAX);
    const to = { x: tx, y: ty };
    const dur = clamp(plan.t - FLIP.lead, FLIP.airMin, FLIP.airMax);
    this.pl.setMoving(false, 0);
    defFx.dust(this.st, from.x, from.y);
    this.takeoffSquash();
    this.snd('dash-jump');
    let ghosts = 0;
    let mid = false;
    let landed = false;
    let t = 0;
    return {
      hitAt: plan.t,
      // como en el partido: el revés sale al caer (o 0,15 s antes del contacto, lo que ocurra después)
      swingAt: Math.max(plan.t - BLINK.swingLead, dur),
      facing: -1,
      update: (dt) => {
        t += dt;
        if (landed) return;
        const k = Math.min(1, t / dur);
        const po = flipPose(from, to, k);
        this.pa.x = po.x;
        this.pa.y = po.y;
        this.pa.lift = po.lift;
        this.pa.spin = po.spin;
        if (!mid && k >= 0.5) {
          mid = true;
          defFx.dust(this.st, po.x, po.y);
          this.snd('dash-jump', 0.4);
        }
        if (ghosts < 3 && k >= (ghosts + 1) / 4) {
          placeActor(this.pl, this.pa);
          this.ghost(ghosts++);
        }
        if (k >= 1) {
          landed = true;
          this.pa.lift = 0;
          this.pa.spin = undefined;
          this.pa.x = tx;
          this.pa.y = ty;
          defFx.flipLand(this.st, tx, ty);
          this.landSquash();
          this.shake(2);
        }
      },
      cleanup: () => {
        this.pa.lift = 0;
        this.pa.spin = undefined;
      },
    };
  }

  /** PATINAJE: patina en línea hasta la pelota, inclinado, dejando un camino de hielo que se derrite. */
  private execSkate(): Run | null {
    const plan = this.plan(SKATE.minT + SKATE.lead);
    if (!plan) return null;
    const from = { x: this.pa.x, y: this.pa.y };
    const tx = clamp(plan.x - 18, P_X[0], P_X[1]);
    const ty = clamp(plan.y, Y_MIN, Y_MAX);
    const to = { x: tx, y: ty };
    const dur = clamp(plan.t - SKATE.lead, SKATE.minT, SKATE.maxT);
    const dirX = Math.sign(ty - from.y) || 1;
    this.pl.setMoving(false, 0);
    this.pl.setSprint(true, dirX);
    const trail = new IceTrail(this.st);
    trail.add(from.x, from.y);
    const p0 = project(from.x, from.y);
    this.dashFx.burst(p0.sx, p0.sy, p0.s * VIEW.CHAR_K, this.pl.depth);
    this.snd('dash-destello', 0.5);
    let ghosts = 0;
    let done = false;
    let t = 0;
    return {
      hitAt: plan.t,
      swingAt: plan.t - SWING_LEAD,
      facing: 0,
      update: (dt) => {
        t += dt;
        if (done) return;
        const k = Math.min(1, t / dur);
        const e = skateEase(k);
        this.pa.x = from.x + (tx - from.x) * e;
        this.pa.y = from.y + (ty - from.y) * e;
        this.pa.spin = skateLean(from, to, k);
        trail.add(this.pa.x, this.pa.y);
        if (ghosts < 2 && k >= (ghosts + 1) / 3) {
          placeActor(this.pl, this.pa);
          this.ghost(ghosts++);
        }
        if (k >= 1) {
          done = true;
          this.pa.spin = undefined;
          this.pa.x = tx;
          this.pa.y = ty;
          trail.finish();
          this.pl.setSprint(false, dirX, true);
          iceSprayFx(this.st, tx, ty, dirX);
        }
      },
      cleanup: () => {
        this.pa.spin = undefined;
        this.pl.setSprint(false, dirX, false);
        trail.destroy();
      },
    };
  }

  // ------------------------------------------------------------------ ESPECIAL y ULTI (modo `special`): los pasos del partido
  /** Al disparar la máquina: el ESPECIAL se arma (brillo del color del poder y sonido de carga, como activateSmash). La ULTI, armada sin más. */
  private armSpecial() {
    const sp = this.special!;
    if (sp.kind === 'charge') {
      // CARGANDO GOLPE: se pone en guardia de carga apenas sale la pelota y el aro crece hasta el máximo mientras viene
      this.pl.setCharging(true);
      this.chargeT = 0;
      this.playCharge(0.5);
      return;
    }
    this.rb?.setElement((sp.kind === 'smash' ? this.el : 'fire') as SmashPower);
    if (sp.kind === 'smash') {
      this.playCharge(0.6);
      const col = SMASH_LOOK[this.el as SmashPower].ring;
      this.glow = this.scene.textures.exists('fx-inferno-glow') ? this.st.add.image(0, 0, 'fx-inferno-glow').setTint(col) : this.st.add.ellipse(0, 0, 100, 100, col, 0.5);
      this.glow.setBlendMode(Phaser.BlendModes.ADD);
    }
  }

  /** Elige el efecto de CARGA: con su hoja (fuego, energía, tulipán, rayo) el ChargeSpriteFx del partido; el clásico (o sin hoja), el aro dibujado. */
  private useCharge(id: ChargeFxId) {
    this.chargeFx?.hide();
    this.chargeRing?.setVisible(false);
    if (isSpriteCharge(id) && chargeFxReady(this.scene, id)) {
      this.chargeFx ??= new ChargeSpriteFx(this.st);
      this.chargeFx.use(id);
    } else {
      this.chargeFx?.destroy();
      this.chargeFx = null;
      this.chargeRing ??= this.st.add.ellipse(0, 0, 120, 40, 0x6ec1ff, 0.25).setStrokeStyle(5, 0xd6f0ff, 0.9).setVisible(false);
    }
  }

  /** El aro de la carga bajo los pies (MatchScene.renderCharge): crece en ~1,1 s hasta el máximo y late; al golpear se disipa. */
  private renderCharge() {
    if (this.special?.kind !== 'charge') return;
    const dt = this.lastDt;
    if (this.chargeT !== null) this.chargeT += dt;
    const v = this.chargeT === null ? null : Math.min(1, this.chargeT / 1.1);
    const p = project(this.pa.x, this.pa.y);
    if (this.chargeFx) {
      if (v !== null) this.chargeFx.setCharge(v);
      this.chargeFx.render(dt, p.sx, p.sy, p.s, p.sy);
      return;
    }
    const r = this.chargeRing;
    if (!r) return;
    if (v === null) return void r.setVisible(false);
    const full = v >= 1;
    const pulse = 0.5 + 0.5 * Math.sin(this.scene.time.now / (full ? 70 : 140));
    r.setVisible(true)
      .setFillStyle(full ? 0xffc72e : 0x6ec1ff, 0.25)
      .setStrokeStyle(5, full ? 0xfff2a8 : 0xd6f0ff, 0.9)
      .setPosition(p.sx, p.sy)
      .setScale(p.s * (0.55 + 0.55 * v + pulse * 0.06))
      .setAlpha(0.45 + pulse * 0.4)
      .setDepth(p.sy - 0.8);
  }

  /** Brillo del ESPECIAL armado alrededor del personaje (MatchScene.updateSmashGlow). */
  private renderGlow() {
    const g = this.glow;
    if (!g || !g.scene) return;
    const feet = project(this.pa.x, this.pa.y);
    const h = 150 * feet.s * VIEW.CHAR_K * 0.9;
    const pulse = 0.22 + 0.08 * Math.sin(this.scene.time.now / 260);
    g.setPosition(feet.sx, feet.sy - h * 0.5)
      .setDisplaySize(h * 1.25, h * 1.5)
      .setAlpha(pulse)
      .setDepth(this.pl.depth - 0.5);
  }

  /**
   * Mientras la pelota viene derecho al personaje: al llegarle a la raqueta sale la cinemática del partido. ESPECIAL (startSmashCine): pose de
   * carga congelada, cinemática del poder y golpe. ULTI (startInferno): pose de espera, cinemática del INFERNO con el dash de sombras hasta la
   * pelota y golpe.
   */
  private stepSpecial() {
    if (this.activated) return;
    const b = this.ball;
    // (por si acaso) la pelota pasó de largo sin llegar a la raqueta: se corta y se repite
    if (b.x < this.pa.x - 80) return this.cut(false);
    if (this.bounces < 1) return;
    if (this.special!.kind === 'charge') {
      // golpe CARGADO al llegarle la pelota a la raqueta (sin cinemática)
      if (b.x > this.pa.x + 34 || b.z > HIT_MAX_Z) return;
      this.activated = true;
      this.targetZoom = 1.06;
      this.pl.setCharging(false);
      this.pl.facing = 1;
      this.pl.swing(true, false, false, false);
      this.strike();
      return;
    }
    const inf = this.special!.kind === 'inferno';
    // ULTI: con su alcance especial (+25 %), un poco antes; ESPECIAL: ya en la raqueta
    const reach = inf ? HIT_RANGE * 1.25 : 34;
    if (b.x > this.pa.x + reach || b.z > HIT_MAX_Z) return;
    this.activated = true;
    this.targetZoom = 1.08;
    if (inf) this.startInfernoCine();
    else this.startSmashCine();
  }

  private focus() {
    const p = project(this.pa.x, this.pa.y);
    const k = p.s * VIEW.CHAR_K;
    const headY = p.sy - 150 * k * 0.9;
    const bb = project(this.ball.x, this.ball.y, this.ball.z);
    const hx = p.sx;
    return { x: p.sx, y: (headY + p.sy) / 2, hh: (p.sy - headY) / 2, racketX: hx + (bb.sx - hx) * 0.5, racketY: headY + (bb.sy - headY) * 0.5, s: p.s, depth: this.pl.depth };
  }

  /** MatchScene.startSmashCine: golpe fuerte desde la pose de carga, congelado durante la cinemática del poder. */
  private startSmashCine() {
    const pl = this.pl;
    this.pl.facing = 1;
    const lead = pl.swing(true, false, false, false, true);
    this.cine!.start({
      profile: smashCine(this.el as SmashPower),
      freeze: spritesIn(pl),
      executor: spritesIn(pl),
      leadMs: Math.min(lead, 150),
      focus: () => this.focus(),
      onHit: () => this.strike(),
    });
  }

  /** MatchScene.startInferno + infernoDashStep: pose de espera, concentración y desplazamiento con sombras (el RAYO, cuerpo eléctrico y destello). */
  private startInfernoCine() {
    const pl = this.pl;
    const el = this.el as InfernoElement;
    if (!pl.infernoHold()) pl.setCharging(true);
    this.playCharge(0.8); // (el de la ULTI: el mismo mp3 de carga; se corta al golpear)
    const from = { x: this.pa.x, y: this.pa.y };
    // el punto de contacto, el MISMO cálculo del partido (planInfernoContact): avanza desde donde está hasta dejar la pelota a la raqueta
    const c = planInfernoContact({ px: from.x, py: from.y, dir: 1, ball: this.ball, hitRange: HIT_RANGE, maxZ: HIT_MAX_Z, bounds: BOUNDS });
    const to = c ? { x: c.x, y: c.y } : { x: clamp(this.ball.x - 30, P_X[0], P_X[1]), y: clamp(this.ball.y, Y_MIN, Y_MAX) };
    const start = from;
    const D = INFERNO.dash;
    const dash = this.infDash ?? this.dashFx;
    let sound = false;
    let flashed = false;
    let ghosts = 0;
    const anchor = () => {
      const f = project(this.pa.x, this.pa.y);
      return { x: f.sx, y: f.sy, headY: f.sy - 150 * f.s * VIEW.CHAR_K * 0.9 };
    };
    this.cine!.start({
      profile: infernoCine(el),
      freeze: spritesIn(pl),
      executor: spritesIn(pl),
      leadMs: 0,
      focus: () => this.focus(),
      onCancel: () => {
        pl.infernoRelease();
        pl.setCharging(false);
      },
      onFrame: (e) => {
        if (e >= INFERNO_CINE.hitAtMs - 45) pl.infernoPre();
        if (e < D.fromMs) return;
        const u = Math.min(1, (e - D.fromMs) / (D.toMs - D.fromMs - 120));
        // (18-11-2026, usuario) LUZ: como el RAYO (se teletransporta, sin sombras) pero todo blanco y con partículas blancas, sin electricidad
        // SOMBRA (18-11-2026): lo mismo en oscuridad
        if (el === 'lightning' || el === 'light' || el === 'shadow') {
          const light = el === 'light' || el === 'shadow';
          if (!sound) {
            sound = true;
            infernoSound.dash(this.st);
            lightningBodyFx(this.st, anchor, D.toMs - D.fromMs + 450, pl, this.stage, el === 'shadow' ? 'shadow' : light ? 'light' : false);
          }
          if (u >= 0.5 && !flashed) {
            flashed = true;
            const pa = project(start.x, start.y);
            const pb = project(to.x, to.y);
            (el === 'shadow' ? shadowDashFlash : light ? lightDashFlash : lightningDashFlash)(this.st, pa.sx, pa.sy, pb.sx, pb.sy, pa.s, 150 * pa.s * VIEW.CHAR_K * 0.9);
          }
          this.pa.x = u < 0.5 ? start.x : to.x;
          this.pa.y = u < 0.5 ? start.y : to.y;
          return;
        }
        if (!sound) {
          sound = true;
          infernoSound.dash(this.st);
        }
        this.pa.x = start.x + (to.x - start.x) * u;
        this.pa.y = start.y + (to.y - start.y) * u;
        // sombras del color del poder por el camino (DashFx con su tinte: GhostTrail usa preFX, que no se puede dentro del escenario)
        // como GhostTrail en el partido: la 1.ª sombra es el personaje en el sitio de donde arrancó, y las otras 3 por el camino (las 4 antes del
        // impacto); quedan quietas hasta el golpe y se desvanecen. La 1.ª, la más tenue.
        // DELANTE del cuerpo, como GhostTrail cuando la sombra queda más cerca de la cámara (el personaje avanza hacia la red): DashFx las pone
        // detrás (depth − 0,3) y con un avance corto quedaban tapadas por el personaje; por eso no se veían en la demostración
        if (ghosts < D.ghosts && u >= ghosts / D.ghosts) {
          placeActor(pl, this.pa);
          dash.ghost(pl, ghosts++, pl.depth + 0.4, this.stage);
        }
      },
      onHit: () => {
        this.pa.x = to.x;
        this.pa.y = to.y;
        pl.setCharging(false);
        pl.swing(true, false, false, false);
        this.strike();
      },
    });
  }

  /** sonido de CARGA en curso (ESPECIAL armado, ULTI concentrándose, CARGANDO GOLPE): suena hasta el golpe */
  private chargeSnd: Phaser.Sound.BaseSound | null = null;

  /** Empieza el sonido de carga (como activateSmash / infernoSound.charge en el partido); se corta con stopChargeSnd al golpear. */
  private playCharge(vol: number) {
    this.stopChargeSnd();
    try {
      if (!this.scene.cache.audio.exists('cargando')) return;
      this.chargeSnd = this.scene.sound.add('cargando', { volume: vol });
      this.chargeSnd.play();
    } catch {
      this.chargeSnd = null;
    }
  }

  private stopChargeSnd() {
    const s = this.chargeSnd;
    this.chargeSnd = null;
    if (!s) return;
    s.stop();
    s.destroy();
  }

  /** El golpe (MatchScene.playerHit + setSmashFlight / infernoImpact): la pelota sale con el poder hacia la máquina. */
  private launchSpecial() {
    this.stopChargeSnd(); // la carga suena hasta el golpe
    const sp = this.special!;
    const rb = this.rb!;
    const b = this.ball;
    const inf = sp.kind === 'inferno';
    this.glow?.destroy();
    this.glow = null;
    if (sp.kind === 'charge') {
      // golpe cargado al máximo: sale rápido con la estela ancha del cargado y el aro se disipa (como al soltar en el partido)
      this.impacted = true;
      this.chargeT = null;
      this.chargeFx?.setCharge(null);
      aimShot(b, COURT.right - 200, LAT_C - this.side * 80, SHOT_SPEED * 1.35, 18);
      rb.setKind('normal', true);
      rb.setImpactTrail(1, 0xffd23f);
      this.snd('golpe-fuerte', 0.9);
      this.shake(4);
      return;
    }
    // la ULTI atraviesa la máquina y sigue de largo (sale de la pantalla); el ESPECIAL (17-11-2026, usuario) BOTA en la cancha de la máquina
    // y luego le llega, como el ESPECIAL del partido al rival (antes iba directo a la máquina por el aire); le pega y vuelve en globo
    if (inf) aimShot(b, MACHINE_X + 700, LAT_C, SHOT_SPEED * SMASH_SPEED_MULT * INFERNO.speedMult, 6);
    else aimShot(b, SPECIAL_BOUNCE_X, LAT_C, SHOT_SPEED * SMASH_SPEED_MULT, 6);
    if (inf) {
      // tiro TENSO: que llegue a la máquina a la altura de su cuerpo (antes pasaba alta en globo y "la tocaba" en pantalla mucho antes de explotar)
      const T = Math.max(0.2, (MACHINE_X - 40 - b.x) / b.vx);
      b.vz = (MACHINE_HIT_Z - b.z + 0.5 * GRAVITY * T * T) / T;
    }
    if (inf) {
      const el = this.el as InfernoElement;
      rb.setPower(true);
      rb.setKind('normal', true);
      this.infernoFlight = true;
      this.fireBall?.setElement(el);
      const p = project(b.x, b.y, b.z);
      infernoImpactFx(this.st, p.sx, p.sy, p.s, el);
      infernoSound.impact(this.st, el);
      this.shake(8);
    } else {
      const el = this.el as SmashPower;
      rb.setElement(el);
      this.smoke?.setElement(el);
      this.elFx?.setElement(el);
      rb.setPower(true);
      rb.setKind('normal', true);
      // (18-11-2026, usuario) ESPECIAL de SOMBRA o de LUZ: su propio golpe (especial-sombra-luz)
      const own = (el === 'shadow' || el === 'light') && this.scene.cache.audio.exists('especial-sombra-luz');
      // (20-11-2026, usuario) ESPECIAL DRAGÓN: ulti-fuego recortado como en la ULTI
      if (!(el === 'dragon' && playUltiFile(this.scene, 'ulti-fuego', 0.9))) this.snd(own ? 'especial-sombra-luz' : 'golpe-fuerte', 0.9);
      this.shake(5);
    }
  }

  /** MatchScene.fireImpact: la pelota de poder alcanza a la máquina. Explosión, retroceso, aturdido y devolución débil (globo). */
  private impactSpecial() {
    const sp = this.special!;
    const rb = this.rb!;
    this.impacted = true;
    if (sp.kind === 'inferno') return this.destroyMachine();
    const kind = this.infernoFlight ? 'inferno' : 'smash';
    this.infernoFlight = false;
    rb.quietFx = false;
    this.fireBall?.clear();
    const mp = project(MACHINE_X, LAT_C);
    const ks = mp.s * VIEW.CHAR_K;
    const s = this.ball;
    const at = kind === 'inferno' ? project(s.x, s.y, s.z) : { sx: mp.sx, sy: mp.sy - 70 * ks };
    powerImpactFx(this.st, kind, at.sx, at.sy, mp.s, this.el as FxElement);
    s.z = Math.max(s.z, 22);
    // (17-11-2026, usuario) la pelota NO vuelve al jugador: rebota en la máquina y cae hacia un lado (fuera de la cancha), botando allí
    const off = this.side >= 0 ? 1 : -1;
    aimShot(s, MACHINE_X - 90, LAT_C + off * (COURT.bottom - COURT.top) * 0.62, SHOT_SPEED * 0.4, 0);
    s.vz = Math.max(s.vz, 260); // sale despedida hacia arriba un poco antes de caer
    rb.setPower(false);
    rb.setKind('lob');
    this.targetZoom = 1;
    // la máquina sale empujada, se tambalea y le dan vueltas las estrellas del aturdido
    this.scene.tweens.killTweensOf(this.machine);
    const mx = this.machine.x;
    this.scene.tweens.add({ targets: this.machine, x: mx + 18, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
    this.scene.tweens.chain({
      targets: this.machine,
      tweens: [
        { angle: -13, duration: 110, ease: 'Quad.easeOut' },
        { angle: 9, duration: 150, ease: 'Sine.easeInOut' },
        { angle: -6, duration: 170, ease: 'Sine.easeInOut' },
        { angle: 3, duration: 190, ease: 'Sine.easeInOut' },
        { angle: 0, duration: 200, ease: 'Sine.easeOut' },
      ],
    });
    this.clearStun();
    const stars = [0, 1, 2].map(() => this.st.add.star(0, 0, 5, 4, 9, 0xffe14a, 1).setDepth(mp.sy + 6));
    const topY = mp.sy - 150 * ks;
    const tw = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: kind === 'inferno' ? 1500 : 650,
      onUpdate: (c) => {
        const v = c.getValue() ?? 0;
        stars.forEach((st, i) => {
          if (!st.scene) return;
          const a = v * 14 + (i * Math.PI * 2) / 3;
          st.setPosition(mp.sx + Math.cos(a) * 34 * ks, topY + Math.sin(a) * 8 * ks).setAngle(v * 600).setAlpha(v > 0.8 ? (1 - v) * 5 : 1);
        });
      },
      onComplete: () => this.clearStun(),
    });
    this.stun = { tw, stars };
  }

  /** Deja las piezas del ESPECIAL / ULTI como al empezar (sin cinemática, sin poder en la pelota, sin brillo). */
  private stopSpecial() {
    this.stopChargeSnd();
    if (!this.special) return;
    this.energy?.stop();
    this.chargeT = null;
    this.chargeFx?.hide();
    this.chargeRing?.setVisible(false);
    this.cine?.cancel();
    this.pl.infernoRelease();
    this.pl.setCharging(false);
    this.infernoFlight = false;
    const rb = this.rb;
    if (rb) {
      rb.setPower(false);
      rb.setIgnited(false);
      rb.quietFx = false;
      rb.clearTrail();
      rb.setVisible(false);
    }
    this.smoke?.clear();
    this.elFx?.clear();
    this.fireBall?.clear();
    this.glow?.destroy();
    this.glow = null;
    this.infDash?.clear();
  }
  /**
   * ¿La pelota de poder llegó a la máquina? Cuando su dibujo entra en el de la máquina (en pantalla, con la altura incluida) o, por si acaso, al
   * pasar por su sitio en la cancha. Así la explosión sale justo cuando se ve el choque.
   */
  private hitsMachine(): boolean {
    const b = this.ball;
    if (b.x < NET_X) return false;
    // el ESPECIAL primero bota (en pantalla podía "tocar" la máquina al pasar alto antes del bote); si no botara, al llegar a ella igual
    if (this.special?.kind === 'smash' && this.specialBounces < 1 && b.x < MACHINE_X - 45) return false;
    if (b.x >= MACHINE_X - 45) return true;
    const mp = project(MACHINE_X, LAT_C);
    const ks = mp.s * VIEW.CHAR_K;
    const p = project(b.x, b.y, b.z);
    return Math.abs(p.sx - mp.sx) < 55 * ks && p.sy > mp.sy - 145 * ks && p.sy < mp.sy + 5 * ks;
  }

  /** restos de la máquina destruida por la ULTI (se quitan al reiniciar el ciclo) */
  private wreck: Phaser.GameObjects.GameObject[] = [];

  /**
   * ULTI: la bola ATRAVIESA la máquina y la DESTRUYE. Explosión del impacto de la ULTI (powerImpactFx 'inferno' + infernoImpactFx) en la máquina, la
   * máquina desaparece en un destello, salen volando sus piezas (chasis, ruedas, tolva y pelotas) y queda una mancha quemada con humo. La pelota sigue
   * de largo con su fuego (no vuelve).
   */
  private destroyMachine() {
    const el = this.el as InfernoElement;
    // (17-11-2026, usuario) tras destruir la máquina la bola sigue con su efecto pero sale un poco hacia arriba y DA UN BOTE detrás de
    // ella antes de salir de la pantalla (antes seguía derecho, sin caer ni botar)
    this.ball.vx *= 0.55;
    this.ball.vz = 230;
    const mp = project(MACHINE_X, LAT_C);
    const ks = mp.s * VIEW.CHAR_K;
    const my = mp.sy - 70 * ks;
    powerImpactFx(this.st, 'inferno', mp.sx, my, mp.s * 1.2, el as FxElement, mp.sy);
    infernoImpactFx(this.st, mp.sx, my, mp.s * 1.3, el);
    this.shake(12);
    this.flash(120, INFERNO_LOOK[el].cine.flashTint ?? 0xfff1c8);
    this.snd('golpe-fuerte', 1);
    this.scene.tweens.killTweensOf(this.machine);
    this.machine.setVisible(false);
    // mancha quemada y humo donde estaba
    const scorch = this.st.add.ellipse(mp.sx, mp.sy, 150 * ks, 44 * ks, 0x05060a, 0.7).setDepth(mp.sy - 1);
    this.wreck.push(scorch);
    // piezas que salen volando, girando, y caen
    const pieces: [number, number, number, number, 'r' | 'c'][] = [
      [0x2f56b8, 88, 60, -1, 'r'], [0x16224a, 100, 26, 1, 'r'], [0x1c2f66, 70, 22, -1, 'r'],
      [0x0b1224, 28, 28, 1, 'c'], [0x0b1224, 28, 28, -1, 'c'], [0x45d9ff, 80, 8, 1, 'r'],
      [0xd7f53a, 16, 16, 1, 'c'], [0xd7f53a, 16, 16, -1, 'c'], [0xd7f53a, 16, 16, 1, 'c'], [0x070d22, 40, 40, -1, 'c'],
    ];
    pieces.forEach(([col, w, h, sd, shape], i) => {
      const x0 = mp.sx + rand(-30, 30) * ks;
      const y0 = mp.sy - rand(30, 120) * ks;
      const o = shape === 'c' ? this.st.add.circle(x0, y0, (w / 2) * ks, col) : this.st.add.rectangle(x0, y0, w * ks, h * ks, col);
      o.setStrokeStyle(3 * ks, 0x0a1638, 1).setDepth(mp.sy + 4 + i * 0.01);
      this.wreck.push(o);
      const dx = (sd * rand(60, 200) + rand(-30, 30)) * ks;
      const peak = rand(80, 200) * ks;
      const land = mp.sy + rand(-10, 30) * ks;
      const dur = rand(650, 950);
      const k = { v: 0 };
      this.scene.tweens.add({
        targets: k,
        v: 1,
        duration: dur,
        ease: 'Linear',
        onUpdate: () => {
          if (!o.scene) return;
          const v = k.v;
          o.setPosition(x0 + dx * v, y0 + (land - y0) * v - Math.sin(v * Math.PI) * peak).setAngle(sd * 540 * v);
        },
        onComplete: () => o.scene && this.scene.tweens.add({ targets: o, alpha: 0, delay: 250, duration: 400 }),
      });
    });
    for (let i = 0; i < 9; i++) {
      const puff = this.st.add.circle(mp.sx + rand(-40, 40) * ks, mp.sy - rand(10, 90) * ks, rand(14, 26) * ks, Phaser.Math.RND.pick([0x1a1a22, 0x2a2a34, 0x3c3c48]), 0.75).setDepth(mp.sy + 3);
      this.wreck.push(puff);
      this.scene.tweens.add({ targets: puff, y: puff.y - rand(60, 140) * ks, x: puff.x + rand(-30, 30) * ks, scale: 2.2, alpha: 0, delay: i * 40, duration: rand(700, 1100) });
    }
  }

  private stun: { tw: Phaser.Tweens.Tween; stars: Phaser.GameObjects.Star[] } | null = null;
  private clearStun() {
    const s = this.stun;
    this.stun = null;
    if (!s) return;
    s.tw.stop();
    s.stars.forEach((o) => o.scene && o.destroy());
  }

  /** Se agacha un instante y se estira al despegar (SUPERSALTO y VOLTERETA). */
  private takeoffSquash() {
    const a = this.pa;
    a.squat = 0.9;
    this.scene.tweens.add({ targets: a, squat: -0.55, duration: 110, ease: 'Quad.easeOut', onComplete: () => this.scene.tweens.add({ targets: a, squat: 0, duration: 220, ease: 'Sine.easeInOut' }) });
  }

  private landSquash() {
    const a = this.pa;
    this.scene.tweens.killTweensOf(a);
    a.squat = 1;
    this.scene.tweens.add({ targets: a, squat: 0, duration: 280, ease: 'Quad.easeOut' });
  }

  /**
   * (17-11-2026) BOLA DE ENERGÍA elegida: la máquina de siempre se esconde y salen las 4 (en su sitio, la secuencia desde el principio). Con otra
   * ULTI: las 4 se esconden y vuelve la de siempre.
   */
  private syncEnergy() {
    if (!this.energyOn) {
      this.energy?.hide();
      return;
    }
    this.energy ??= new EnergyDemo({
      scene: this.scene,
      st: this.st,
      pl: this.pl,
      pa: this.pa,
      rb: this.rb!,
      fire: this.fireBall!,
      cine: this.cine!,
      machineX: MACHINE_X,
      buildMachine: (x, y) => this.buildMachine(x, y),
      focus: () => this.focus(),
      shake: (a) => this.shake(a),
      flash: (ms, col) => this.flash(ms, col),
      snd: (n, v) => this.snd(n, v),
      playCharge: (v) => this.playCharge(v),
      stopCharge: () => this.stopChargeSnd(),
      speed: {
        burst: (x, y, k, depth) => this.hurDash.burst(x, y, k, depth, 0xffd84a),
        streak: (ax, ay, bx, by, k, depth) => this.hurDash.streak(ax, ay, bx, by, k, depth, 0xffd84a),
        ghost: (i) => this.hurDash.ghost(this.pl, i, this.pl.depth, this.stage),
      },
      setBall: (on, inf) => {
        this.ballOn = on;
        this.infernoFlight = inf;
        this.keepFlight = inf; // sin esto renderBall apaga la bola del 1.er golpe del HURACÁN (rb.power = false)
      },
      done: () => this.cut(true),
    });
    this.machine.setVisible(false);
    this.energy.setPower(this.el === 'hurricane' ? 'hurricane' : 'energy');
    this.energy.reset();
  }

  private cleanupRun() {
    const r = this.run;
    this.run = null;
    r?.cleanup();
  }

  // ------------------------------------------------------------------ dibujo del escenario
  private P(x: number, y: number, z = 0) {
    const p = project(x, y, z);
    return new Phaser.Math.Vector2(p.sx, p.sy);
  }

  private buildCourt() {
    const add = this.st.add;
    const g = add.graphics().setDepth(-100);
    // fondo de UN solo color, azul de pista de tenis, un poco más oscuro que los dobles del partido (sin muro, cielo ni suelo aparte): solo la pista sobre él
    g.fillStyle(0x1e4a9a, 1).fillRect(-900, -900, 2520, 3300);
    // pista: dobles y individuales con la misma paleta del partido
    const dT = COURT.top - ALLEY;
    const dB = COURT.bottom + ALLEY;
    const quad = (x0: number, y0: number, x1: number, y1: number) => g.fillPoints([this.P(x0, y0), this.P(x0, y1), this.P(x1, y1), this.P(x1, y0)], true);
    g.fillStyle(0x2456a8, 1);
    quad(COURT.left, dT, COURT.right + 1, dB);
    const bands = 10;
    for (let i = 0; i < bands; i++) {
      const x0 = COURT.left + ((COURT.right - COURT.left) * i) / bands;
      const x1 = COURT.left + ((COURT.right - COURT.left) * (i + 1)) / bands;
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(0x3f8be8), Phaser.Display.Color.ValueToColor(0x2a63c0), 1, i / (bands - 1));
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
      quad(x0, COURT.top, x1 + 1, COURT.bottom);
    }
    g.lineStyle(4, 0xffffff, 1);
    const line = (x0: number, y0: number, x1: number, y1: number) => {
      const a = this.P(x0, y0);
      const b = this.P(x1, y1);
      g.lineBetween(a.x, a.y, b.x, b.y);
    };
    line(COURT.left, dT, COURT.right, dT);
    line(COURT.left, dB, COURT.right, dB);
    line(COURT.left, COURT.top, COURT.right, COURT.top);
    line(COURT.left, COURT.bottom, COURT.right, COURT.bottom);
    line(COURT.left, dT, COURT.left, dB);
    line(COURT.right, dT, COURT.right, dB);
    const sl = (NET_X - COURT.left) * 0.538;
    line(NET_X - sl, COURT.top, NET_X - sl, COURT.bottom);
    line(NET_X + sl, COURT.top, NET_X + sl, COURT.bottom);
    line(NET_X - sl, LAT_C, NET_X + sl, LAT_C);
    // (22-11-2026, usuario) la MISMA red del partido (fx/NetView.ts): malla en rombos, cinta con caída, correa, postes azules y sombra,
    // igual de alta (NET_VIEW_SCALE) y de ancha (NET_OVERHANG); ondula y suena si la pelota pega en ella. Va al escenario por el proxy de `add`
    this.netView = new NetView(this.st, (x, y, z = 0) => this.P(x, y, z), NET_X, dT - NET_OVERHANG, dB + NET_OVERHANG, NET_HEIGHT * NET_VIEW_SCALE, project(NET_X, LAT_C).sy - 0.5);
  }

  /** Máquina de pelotas (de frente, quieta al fondo en medio): chasis con ruedas, cuerpo, tolva con pelotas y boca. Mide unos 140 de alto, como un personaje. */
  private buildMachine(x = MACHINE_X, y = LAT_C) {
    const foot = project(x, y);
    const ks = foot.s * VIEW.CHAR_K;
    const c = this.st.add.container(foot.sx, foot.sy).setScale(ks).setDepth(foot.sy);
    const g = this.st.add.graphics();
    c.add(g);
    g.fillStyle(0x000000, 0.35).fillEllipse(0, 0, 124, 30);
    for (const wx of [-40, 40]) {
      g.fillStyle(0x0b1224, 1).fillCircle(wx, -11, 14).lineStyle(3, 0x6b7a9e, 1).strokeCircle(wx, -11, 14);
      g.fillStyle(0x6b7a9e, 1).fillCircle(wx, -11, 4);
    }
    g.fillStyle(0x16224a, 1).fillRoundedRect(-50, -48, 100, 30, 8).lineStyle(3, 0x0a1638, 1).strokeRoundedRect(-50, -48, 100, 30, 8);
    g.fillStyle(0x2f56b8, 1).fillRoundedRect(-44, -114, 88, 74, 12).lineStyle(4, 0x0a1638, 1).strokeRoundedRect(-44, -114, 88, 74, 12);
    g.fillStyle(0xffffff, 0.14).fillRoundedRect(-38, -110, 76, 22, 8);
    g.fillStyle(0x45d9ff, 1).fillRoundedRect(-44, -62, 88, 6, 3);
    // tolva con pelotas
    g.fillStyle(0x1c2f66, 1).fillPoints([{ x: -36, y: -114 }, { x: 36, y: -114 }, { x: 27, y: -136 }, { x: -27, y: -136 }], true).lineStyle(3, 0x0a1638, 1).strokePoints([{ x: -36, y: -114 }, { x: 36, y: -114 }, { x: 27, y: -136 }, { x: -27, y: -136 }], true);
    for (const [bx, by] of [[-13, -141], [9, -144], [-1, -136]] as const) g.fillStyle(0x0a1638, 1).fillCircle(bx, by, 9).fillStyle(0xd7f53a, 1).fillCircle(bx, by, 7.4);
    // boca
    g.fillStyle(0x070d22, 1).fillCircle(0, -76, 23).lineStyle(5, 0x45d9ff, 1).strokeCircle(0, -76, 23);
    g.fillStyle(0x02060f, 1).fillCircle(0, -76, 14);
    const light = this.st.add.circle(30, -100, 5, 0x35c85a, 1);
    c.add(light);
    return { container: c, light };
  }

  private buildBall() {
    const shadow = this.st.add.ellipse(0, 0, 30, 12, 0x000000, 0.5);
    const trail = this.st.add.graphics();
    const ball = this.st.add.container(0, 0);
    ball.add([this.st.add.circle(0, 0, 12, 0x0a1638), this.st.add.circle(0, 0, 9.6, 0xd7f53a), this.st.add.circle(-3.5, -3.5, 3, 0xffffff, 0.7)]);
    ball.setVisible(false);
    shadow.setVisible(false);
    trail.setVisible(false);
    return { ball, shadow, trail };
  }
}

/**
 * Crea la demostración del DEFENSIVO en `parent` (el contenedor de la página 2 de la televisión). `outer` = toda la pantalla (la cortinilla); `inner` = el
 * hueco que queda entre las barras de cine, donde se ajusta la escena.
 */
export function createDefensiveDemo(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, outer: DemoRect, inner: DemoRect, skin: string, initial: DefensivePower): PowerDemo {
  return new DefensiveDemo(scene, parent, outer, inner, skin, initial);
}

/**
 * Demostración de un EFECTO DE PELOTA (Tienda, 16-11-2026): la misma escena (tu personaje contra la máquina), pero llega corriendo y su
 * devolución lleva la estela de `look` (ui/styleLook.ts → TrailLook).
 */
export function createSpecialDemo(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, outer: DemoRect, inner: DemoRect, skin: string, kind: DemoKind, initial: string): PowerDemo {
  return new DefensiveDemo(scene, parent, outer, inner, skin, 'dash', undefined, { kind, el: initial });
}

export function createStyleDemo(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, outer: DemoRect, inner: DemoRect, skin: string, look: TrailLook, lookOf?: (id: string) => TrailLook): PowerDemo {
  const d = new DefensiveDemo(scene, parent, outer, inner, skin, 'dash', look);
  // con `lookOf` (selector de PERSONALIZAR) cambia de efecto al elegir otro de la lista
  (d as unknown as { lookOf: ((id: string) => TrailLook) | null }).lookOf = lookOf ?? null;
  return d;
}
