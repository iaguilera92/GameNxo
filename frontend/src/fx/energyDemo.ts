import Phaser from 'phaser';
import { COURT, SHOT_SPEED } from '../config';
import { VIEW, project } from '../view/projection';
import type { Character } from '../objects/Character';
import type { Ball } from '../objects/Ball';
import { HyperAura } from '../objects/HyperAura';
import { type CineFocus, type CineProfile, type SmashCinematic, spritesIn } from './SmashCinematic';
import { ENERGY_MATCH_CINE, ENERGY_MATCH_K } from '../logic/EnergyRally';
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

const LAT_C = (COURT.top + COURT.bottom) / 2;
/** sitio lateral de las 4 máquinas (izq. → der. en pantalla) */
const M_Y = [COURT.top - 15, LAT_C - 85, LAT_C + 85, COURT.bottom + 15];
/** la que lanza la única pelota y a quién se le pega en cada golpe (−1 = la BOLA DE ENERGÍA a las dos del centro) */
const LAUNCHER = 1;
const TARGET = [0, 3, 2, -1];
/**
 * tiempos (s): espera antes de lanzar; pelota de la máquina (hasta el bote / del bote a la raqueta); rebote desde la máquina noqueada
 * (hasta el bote / a la raqueta); devolución; la bola crece en la raqueta; vuelo de la bola final; pausa antes del corte
 */
// (17-11-2026, usuario) los 3 peloteos duran 3,5 s, como en el partido: 3 × (out + backA + backB) = 3 × 1,167 s (antes 3 × 1,0 s)
const T = { wait: 0.3, inA: 0.32, inB: 0.18, /* (17-11-2026, usuario) la pelota de la máquina llega antes */ backA: 0.385, backB: 0.257, out: 0.525, grow: 0.5, final: 0.6, endHold: 1.0 };
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
  private phase: 'serve' | 'in' | 'cine' | 'out' | 'grow' | 'end' | 'idle' = 'idle';
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
    this.setVisible(false);
  }

  // ------------------------------------------------------------------ ciclo
  /** Todo en su sitio (máquinas en pie y encendidas) y la pelota a punto de salir. */
  reset() {
    this.stop();
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
  }

  /** Corta lo que esté en marcha (cinemática, carga, aura, penumbra, pelota) sin tocar las máquinas. */
  stop() {
    this.phase = 'idle';
    this.h.stopCharge();
    this.cineFx.hide();
    this.impact.stop();
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
    // penumbra de la cinemática durante todo el peloteo; se aclara tras la BOLA DE ENERGÍA
    if (this.darkOn && !this.cineFx.drawDark(this.phase === 'end' ? 0 : 0.6, dt)) this.darkOn = false;
    switch (this.phase) {
      case 'serve':
        return this.stepServe(dt);
      case 'in':
        return this.stepIn(dt);
      case 'grow':
        return this.stepGrow(dt);
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
    this.h.snd('golpe-fuerte', 0.5);
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
    const final = TARGET[this.round] === -1;
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
    this.phase = 'cine';
    if (!pl.infernoHold()) pl.setCharging(true);
    h.playCharge(0.8);
    this.cineFx.start();
    this.auraOn();
    this.lastCine = performance.now();
    const sprites = spritesIn(pl);
    h.cine.start({
      profile: DEMO_CINE,
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
        if (e >= DEMO_CINE.hitAtMs - 45) pl.infernoPre();
        const f = h.focus();
        const feet = project(h.pa.x, h.pa.y);
        this.cineFx.drawCharge(e / CINE_K, { x: f.x, y: f.y, racketX: f.racketX, racketY: f.racketY, s: f.s, hh: f.hh, depth: f.depth, feetY: feet.sy });
        this.aura?.update(dt);
      },
      onHit: () => {
        this.cineFx.hideCharge();
        this.cineFx.setDark(DEMO_CINE.darken);
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
    const final = TARGET[this.round] === -1;
    this.from.x = this.racket.x;
    this.from.y = this.racket.y;
    this.from.z = this.racket.z;
    this.aim.x = h.machineX - 30;
    this.aim.z = HIT_Z;
    const p = project(this.racket.x, this.racket.y, this.racket.z);
    if (final) {
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
    const final = TARGET[this.round] === -1;
    const dur = final ? T.final : T.out;
    this.placeBall(arcAt(this.from, this.aim, this.t / dur, final ? 30 : 40, this.pos), this.from, this.aim, dur);
    if (this.t < dur) return;
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
    h.shake(6);
    h.snd('golpe-fuerte', 0.9);
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
    // (17-11-2026) el impacto DESTRUCTIVO de la BOLA DE ENERGÍA (estrella, columna, ondas y grietas en el suelo, esquirlas, brasas, trozos)
    this.impact.play(cx, ey, cy, s);
    h.flash(260, 0xf0fdff);
    h.shake(20);
    h.snd('golpe-fuerte', 1);
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
      tw.add({
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
      });
      this.puffs(m, 4, 1);
    }
    // (17-11-2026, usuario) la onda llega hasta las máquinas de las ESQUINAS (ya noqueadas): la izquierda se aleja un poco a la izquierda
    // y la derecha a la derecha, con un temblor; así el impacto se siente más grande. El reinicio (reset) las devuelve a su sitio.
    for (const [m, dir] of [[this.m[0], -1], [this.m[3], 1]] as const) {
      tw.killTweensOf(m.c);
      const x0 = m.c.x;
      const a0 = m.c.angle;
      const push = { u: 0 };
      tw.add({
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
      });
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
