import Phaser from 'phaser';
import { SHEETS, SHEET_IDS, type SheetCfg, type SheetId } from '../characters/sheets';
import { CHAR_UNITS_H, skinMode } from '../characters/skins';
import nxoHits from '../characters/nxo-hits.json';
import nxoSpecial from '../characters/nxo-special.json';

/**
 * NXO de espaldas con animaciones por sprites (hoja procesada con tools/build-nxo-sprites.mjs).
 * Es el "cuerpo" del Character cuando el jugador usa la skin 'nxo' en la vista 'back'.
 *
 * Máquina de estados:
 *   idle ⇄ run            en bucle; run → runstop (una vez) → idle
 *   hold                  pose de preparación del golpe (cargando o con la pelota cerca)
 *   swing                 forehand / backhand / smash, una vez; vuelve a idle / run / hold
 *   serve                 saque: toque hasta el brazo arriba, espera la pelota y golpea
 *   victory               celebración (una vez; queda en la última pose)
 *
 * El golpe físico se aplica en el mismo frame en que el juego llama a swing(), así que el clip
 * arranca unos fotogramas antes del impacto (desde la pose de preparación) para que la raqueta
 * llegue a la pelota casi a la vez.
 */
export type NxoAnim = 'idle' | 'run' | 'runstop' | 'forehand' | 'backhand' | 'serve' | 'smash' | 'victory';
type State = 'idle' | 'run' | 'runstop' | 'hold' | 'swing' | 'serve' | 'victory';

export type SpriteCharId = SheetId;
const CFGS = SHEETS;
const IDS = SHEET_IDS;
export const NXO_ANIMS = Object.keys(SHEETS.nxo.animations) as NxoAnim[];
const spriteKey = (id: SpriteCharId, a: NxoAnim) => `${id}-${a}`;
type AnimInfo = { file: string; frames: number; fps: number; loop: boolean; impact?: number };
const A = (id: SpriteCharId) => CFGS[id].animations as Record<NxoAnim, AnimInfo>;

/**
 * Golpes rehechos de NXO de espaldas (hoja 1b: swing completo, impacto en el frame 4). Tienen su
 * propia celda y ancla, así que al reproducirlos se cambia el origen del sprite. Si faltan las
 * texturas se usan los golpes de la hoja original.
 */
type HitAnim = 'forehand' | 'backhand' | 'forehand-power' | 'backhand-power' | 'serve' | 'smash';
const HITS = nxoHits as { cell: { w: number; h: number }; origin: { x: number; y: number }; standHeight: number; hold: number; serveWait: number; smashStart: number; animations: Record<HitAnim, AnimInfo> };
const HIT_ANIMS = Object.keys(HITS.animations) as HitAnim[];
const HITS_FOR: SpriteCharId = 'nxo';
const hitKey = (a: HitAnim) => `${HITS_FOR}-hit-${a}`;
const hitsReady = (scene: Phaser.Scene) => HIT_ANIMS.every((a) => scene.textures.exists(hitKey(a)));

/**
 * Remate ESPECIAL de NXO de espaldas (hoja 4, fila 3 "Smash potenciado": salta y remata en el aire).
 * Solo para el ataque especial SMASH. Hoja propia (celda/ancla distintas); si falta la textura se usa
 * el remate normal.
 */
type SpecialAnim = 'smash-power';
const SPECIAL = nxoSpecial as { cell: { w: number; h: number }; origin: { x: number; y: number }; standHeight: number; start: number; animations: Record<SpecialAnim, AnimInfo> };
const specialKey = (a: SpecialAnim) => `${HITS_FOR}-special-${a}`;
const specialReady = (scene: Phaser.Scene) => scene.textures.exists(specialKey('smash-power'));

export function queueNxoSpriteLoads(load: Phaser.Loader.LoaderPlugin) {
  if (skinMode() === 'off') return;
  for (const id of IDS) {
    const c = CFGS[id];
    for (const a of NXO_ANIMS) {
      load.spritesheet(spriteKey(id, a), `assets/characters/${id}-sprites/${A(id)[a].file}`, { frameWidth: c.cell.w, frameHeight: c.cell.h });
    }
  }
  for (const a of HIT_ANIMS) {
    load.spritesheet(hitKey(a), `assets/characters/nxo-hits/${HITS.animations[a].file}`, { frameWidth: HITS.cell.w, frameHeight: HITS.cell.h });
  }
  for (const a of Object.keys(SPECIAL.animations) as SpecialAnim[]) {
    load.spritesheet(specialKey(a), `assets/characters/nxo-special/${SPECIAL.animations[a].file}`, { frameWidth: SPECIAL.cell.w, frameHeight: SPECIAL.cell.h });
  }
}

export function nxoSpritesReady(scene: Phaser.Scene, id: SpriteCharId = 'nxo') {
  return NXO_ANIMS.every((a) => scene.textures.exists(spriteKey(id, a)));
}

/** Crea las animaciones (globales del juego). Llamar una vez tras cargar las texturas. */
export function registerNxoAnims(scene: Phaser.Scene) {
  for (const a of Object.keys(SPECIAL.animations) as SpecialAnim[]) {
    const k = specialKey(a);
    if (!scene.textures.exists(k) || scene.anims.exists(k)) continue;
    const info = SPECIAL.animations[a];
    scene.anims.create({ key: k, frames: scene.anims.generateFrameNumbers(k, { start: 0, end: info.frames - 1 }), frameRate: info.fps, repeat: 0 });
  }
  for (const id of IDS) {
    if (!nxoSpritesReady(scene, id)) continue;
    for (const a of NXO_ANIMS) {
      const k = spriteKey(id, a);
      if (scene.anims.exists(k)) continue;
      const info = A(id)[a];
      scene.anims.create({
        key: k,
        frames: scene.anims.generateFrameNumbers(k, { start: 0, end: info.frames - 1 }),
        frameRate: info.fps,
        repeat: info.loop ? -1 : 0,
      });
    }
  }
  if (!hitsReady(scene)) return;
  for (const a of HIT_ANIMS) {
    const k = hitKey(a);
    if (scene.anims.exists(k)) continue;
    const info = HITS.animations[a];
    scene.anims.create({ key: k, frames: scene.anims.generateFrameNumbers(k, { start: 0, end: info.frames - 1 }), frameRate: info.fps, repeat: 0 });
  }
}
/**
 * Ritmo del golpe (solo presentación; el golpe físico ocurre cuando lo decide la escena):
 *   preparación (pose hold) → aceleración rápida hasta el frame de impacto → pausa breve de impacto
 *   (hit-stop) → seguimiento → recuperación algo más lenta → reposo.
 * El tiro cargado / SMASH (`power`) acelera más, se detiene más en el impacto y sigue más largo.
 */
const SWING = {
  accel: 1.8, // velocidad de reproducción hasta el impacto (normal; más lento = se ve el armado)
  accelPower: 3, // ídem con potencia
  hitStopMs: 45,
  hitStopPowerMs: 90,
  follow: 1, // velocidad tras el impacto
  followPower: 0.85,
  recover: 0.75, // últimos 2 frames
  maxImpactMs: 100, // el destello nunca se retrasa más que esto respecto al golpe físico
  followLock: 3, // frames tras el impacto en que el seguimiento no se corta al moverse
};
/** Estela de la raqueta (arco en el impacto), en unidades del Character (alto = CHAR_UNITS_H). */
const SWOOSH = {
  rx: 0.62, // radio horizontal del arco (× alto del personaje)
  ry: 0.2, // radio vertical
  y: -0.45, // altura del centro (negativo = hacia arriba desde los pies)
  tail: 0.55, // largo de la cola (fracción del arco)
  ms: 130,
  msPower: 170,
  fadeMs: 140,
};
/** El saque corre rápido hasta el brazo arriba (la pelota ya salió) y luego a ritmo normal. */
const SERVE_TOSS_SPEED = 2.6;

export class NxoActor {
  readonly sprite: Phaser.GameObjects.Sprite;
  private state: State = 'idle';
  private moving = false;
  private charging = false;
  private ready = false;
  private facing = 1;
  /** dirección del desplazamiento lateral en pantalla (1 derecha, -1 izquierda); independiente del golpe */
  private runDir = 1;
  private serveReleased = false;
  private lastHoldAt = -1e9;
  private shake?: Phaser.Tweens.Tween;
  private lean?: Phaser.Tweens.Tween;
  // golpe en curso
  private swingImpact = 0;
  private swingFrames = 0;
  private swingPower = false;
  private swingHitDone = false;
  /** tras el impacto + 1 frame ya se puede salir a correr (la recuperación no bloquea el movimiento) */
  private swingInterruptible = false;
  private swingOverhead = false;
  /** estela de la raqueta (se dibuja encima del sprite, dentro del mismo Character) */
  private readonly swoosh: Phaser.GameObjects.Graphics;
  private swooshTween?: Phaser.Tweens.Tween;

  private readonly cfg: SheetCfg;
  /** usa los golpes rehechos (hoja 1b) en vez de los de la hoja original */
  private readonly hits: boolean;
  private k(a: NxoAnim) {
    return spriteKey(this.id, a);
  }
  /** clip de golpe: el de la hoja 1b si está; si no, el de la hoja original (las versiones potentes caen en la normal) */
  private clip(a: HitAnim): { key: string; info: AnimInfo } {
    if (this.hits) return { key: hitKey(a), info: HITS.animations[a] };
    const base: NxoAnim = a === 'forehand-power' ? 'forehand' : a === 'backhand-power' ? 'backhand' : a;
    return { key: this.k(base), info: A(this.id)[base] };
  }
  /** fotogramas clave (guardia, espera del saque, inicio del remate) de la hoja de golpes en uso */
  private get geo() {
    return this.hits ? HITS : this.cfg;
  }
  /** reproduce un clip ajustando el ancla (las hojas tienen celdas distintas) */
  private playClip(key: string, startFrame = 0) {
    const o = key.startsWith(`${HITS_FOR}-special-`) ? SPECIAL.origin : key.startsWith(`${HITS_FOR}-hit-`) ? HITS.origin : this.cfg.origin;
    this.sprite.setOrigin(o.x, o.y);
    this.sprite.play({ key, startFrame });
  }

  constructor(private scene: Phaser.Scene, parent: Phaser.GameObjects.Container, private id: SpriteCharId = 'nxo') {
    this.cfg = CFGS[id];
    this.hits = id === HITS_FOR && HITS.standHeight === this.cfg.standHeight && hitsReady(scene);
    this.sprite = scene.add.sprite(0, 0, this.k('idle'), 0);
    // el ancla de la celda es (centro del cuerpo, suelo): los pies quedan en (0,0) del Character
    this.sprite.setOrigin(this.cfg.origin.x, this.cfg.origin.y).setScale(CHAR_UNITS_H / this.cfg.standHeight);
    parent.add(this.sprite);
    this.swoosh = scene.add.graphics().setVisible(false);
    parent.add(this.swoosh);
    this.sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => this.onComplete(anim.key));
    this.sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, (_a: Phaser.Animations.Animation, f: Phaser.Animations.AnimationFrame) => this.onFrame(f));
    this.sprite.play(this.k('idle'));
  }

  // ------------------------------------------------------------ entradas (las llama Character)
  /**
   * `dirX`: componente lateral del movimiento en pantalla (>0 derecha, <0 izquierda, 0 = solo vertical).
   * Los sprites de carrera corren hacia la derecha: hacia la izquierda se voltean (flipX) SOLO al correr.
   */
  setMoving(m: boolean, dirX = 0) {
    if (Math.abs(dirX) > 0.15) this.runDir = dirX > 0 ? 1 : -1;
    this.moving = m;
    this.refresh();
    if (this.state === 'run' || this.state === 'runstop') this.sprite.setFlipX(this.runDir < 0);
  }

  setCharging(on: boolean) {
    this.charging = on;
    this.refresh();
  }

  /** La pelota viene hacia el jugador y está cerca: ponerse en guardia con la raqueta atrás. */
  setReady(on: boolean) {
    if (on === this.ready) return;
    this.ready = on;
    this.refresh();
  }

  setFacing(f: number) {
    this.facing = f >= 0 ? 1 : -1;
    if (this.state === 'hold') this.enterHold(); // cambia de forehand a backhand sin soltar la pose
  }

  /**
   * Golpe: derecha / revés según el lado de la pelota; remate (smash) si es alto o es el SMASH.
   * `power`: tiro cargado o SMASH (golpe más marcado). Devuelve los ms hasta el frame visual de
   * impacto, para que la escena sincronice el destello (la física NO se retrasa).
   */
  swing(overhead: boolean, power = false, special = false): number {
    if (this.state === 'victory') return 0;
    if (this.state === 'serve') {
      this.releaseServe(); // el saque ya está en marcha: solo asegurar que termina el golpe
      return 0;
    }
    if (this.state === 'swing' && !this.swingInterruptible) return 0;
    const wasHold = this.state === 'hold' || this.scene.time.now - this.lastHoldAt < 150;
    const side = this.facing > 0 ? 'forehand' : 'backhand';
    const anim: HitAnim = overhead ? 'smash' : power ? `${side}-power` : side;
    // ataque especial SMASH: remate con salto (hoja propia) si existe para este personaje
    const useSpecial = special && overhead && this.id === HITS_FOR && specialReady(this.scene);
    const { key, info } = useSpecial ? { key: specialKey('smash-power'), info: SPECIAL.animations['smash-power'] } : this.clip(anim);
    const geo = this.geo;
    // desde la preparación se continúa justo después; sin ella se arranca EN la preparación (se ve la raqueta atrás)
    const start = useSpecial ? SPECIAL.start : overhead ? geo.smashStart : wasHold ? geo.hold + 1 : geo.hold;
    const impact = Math.max(start, info.impact ?? start + 2);
    this.stopShake();
    this.stopLean();
    this.sprite.setFlipX(false); // los golpes nunca van volteados (derecha/revés los decide `facing`)
    this.state = 'swing';
    this.swingImpact = impact;
    this.swingFrames = info.frames;
    this.swingPower = power;
    this.swingOverhead = overhead;
    this.swingHitDone = false;
    this.swingInterruptible = false;
    const accel = power ? SWING.accelPower : SWING.accel;
    this.sprite.anims.timeScale = accel;
    this.playClip(key, start);
    return Math.min(SWING.maxImpactMs, ((impact - start) / (info.fps * accel)) * 1000);
  }

  /** Inicio del toque del saque (la pelota acaba de salir). El golpe llega con serveRelease(). */
  serve() {
    if (this.state === 'victory') return;
    this.stopShake();
    this.stopLean();
    this.sprite.setFlipX(false);
    this.state = 'serve';
    this.serveReleased = false;
    // la pelota ya va hacia arriba: el brazo llega rápido a la pose de lanzamiento (frame serveWait)
    this.sprite.anims.timeScale = SERVE_TOSS_SPEED;
    this.playClip(this.clip('serve').key);
  }

  /** La pelota está a punto de bajar a la altura de golpeo: soltar el clip para que impacte justo. */
  serveRelease() {
    if (this.state === 'serve') this.releaseServe();
  }

  /** Segundos que tarda la raqueta en llegar al contacto desde la pose de espera del saque. */
  serveContactDelay() {
    const a = this.clip('serve').info, wait = this.geo.serveWait;
    return Math.max(0.04, ((a.impact ?? wait) - wait) / a.fps);
  }

  victory() {
    this.stopShake();
    this.stopLean();
    this.sprite.setFlipX(false);
    this.state = 'victory';
    this.sprite.anims.timeScale = 1;
    this.playClip(this.k('victory'));
  }

  /** Vuelve a la pose neutra (nuevo punto: el jugador se recoloca). */
  resetPose() {
    this.stopShake();
    this.stopLean();
    this.sprite.setFlipX(false);
    this.moving = false;
    this.charging = false;
    this.ready = false;
    this.state = 'idle';
    this.sprite.anims.timeScale = 1;
    this.playClip(this.k('idle'));
  }

  // ------------------------------------------------------------ interno
  private busy() {
    // la recuperación del golpe no bloquea: se puede salir a correr o volver a la guardia
    if (this.state === 'swing') return !this.swingInterruptible;
    return this.state === 'serve' || this.state === 'victory';
  }

  /** Elige el estado "de reposo" que corresponde a las banderas actuales. */
  private refresh() {
    if (this.busy()) return;
    const wantHold = (this.charging || this.ready) && !this.moving;
    if (this.moving && !this.charging) {
      if (this.state !== 'run') this.enter('run');
    } else if (wantHold) {
      if (this.state !== 'hold') this.enterHold();
    } else if (this.state === 'run') {
      this.enter('runstop');
    } else if (this.state === 'hold') {
      this.enter('idle');
    }
    // en la recuperación del golpe: si no hay nada que hacer, se deja terminar el clip
  }

  private enter(s: 'idle' | 'run' | 'runstop') {
    if (this.state === 'hold') this.lastHoldAt = this.scene.time.now;
    this.stopShake();
    this.stopLean();
    this.state = s;
    this.sprite.anims.timeScale = 1;
    // solo la carrera (y su frenada) se voltea según la dirección; el reposo mira siempre igual
    this.sprite.setFlipX((s === 'run' || s === 'runstop') && this.runDir < 0);
    this.playClip(this.k(s));
  }

  private enterHold() {
    this.state = 'hold';
    this.sprite.setFlipX(false);
    this.sprite.anims.stop();
    const holdKey = this.clip(this.facing > 0 ? 'forehand' : 'backhand').key;
    const o = this.hits ? HITS.origin : this.cfg.origin;
    this.sprite.setOrigin(o.x, o.y);
    this.sprite.setTexture(holdKey, this.geo.hold);
    if (this.charging) {
      // carga: anticipación marcada (cuerpo echado hacia atrás y algo agachado) + temblor
      if (!this.lean) {
        this.lean = this.scene.tweens.add({
          targets: this.sprite,
          angle: -5 * this.facing,
          scaleY: this.sprite.scaleX * 0.96,
          duration: 180,
          ease: 'Quad.easeOut',
        });
      }
      if (!this.shake) this.shake = this.scene.tweens.add({ targets: this.sprite, x: { from: -1.5, to: 1.5 }, duration: 55, yoyo: true, repeat: -1 });
    } else {
      this.stopShake();
      this.stopLean();
    }
  }

  /**
   * Estela en arco de la raqueta en el impacto: la cabeza recorre el arco desde el lado de la pelota
   * hacia el otro lado con una cola que se afina y se desvanece. El tiro potente es más grueso y dorado.
   */
  private playSwoosh(power: boolean) {
    const H = CHAR_UNITS_H;
    const g = this.swoosh;
    const over = this.swingOverhead;
    // remate: arco vertical por encima de la cabeza; golpe normal: arco horizontal a la altura del pecho
    const rx = (over ? 0.38 : SWOOSH.rx) * H, ry = (over ? 0.48 : SWOOSH.ry) * H;
    const cy = (over ? -0.72 : SWOOSH.y) * H;
    const dir = this.facing;
    // ángulos (rad): 0 = lado derecho, π/2 = arriba. El normal va de un lado al otro por delante.
    const a0 = over ? Math.PI * 0.55 : dir > 0 ? -0.15 : Math.PI + 0.15;
    const a1 = over ? (dir > 0 ? -0.35 : Math.PI + 0.35) : dir > 0 ? Math.PI + 0.15 : -0.15;
    const color = power ? 0xffe27a : 0xffffff;
    const width = (power ? 0.075 : 0.055) * H;
    const pt = (a: number) => ({ x: Math.cos(a) * rx, y: cy - Math.sin(a) * ry });
    const draw = (p: number, alpha: number) => {
      g.clear();
      // la cabeza se para al final del arco y la cola la alcanza (la estela se recoge)
      const head = Math.min(1, p), tail = Math.min(head, Math.max(0, p - SWOOSH.tail));
      const N = 14;
      for (let i = 0; i < N; i++) {
        const t0 = tail + ((head - tail) * i) / N, t1 = tail + ((head - tail) * (i + 1)) / N;
        const k = (i + 1) / N; // 0 en la cola → 1 en la cabeza
        const p0 = pt(a0 + (a1 - a0) * t0), p1 = pt(a0 + (a1 - a0) * t1);
        g.lineStyle(Math.max(1, width * k), color, alpha * k * 0.85);
        g.lineBetween(p0.x, p0.y, p1.x, p1.y);
      }
    };
    this.swooshTween?.remove();
    g.setVisible(true).setAlpha(1);
    const st = { p: 0 };
    this.swooshTween = this.scene.tweens.add({
      targets: st,
      p: 1 + SWOOSH.tail * 0.5,
      duration: power ? SWOOSH.msPower : SWOOSH.ms,
      ease: 'Cubic.easeOut',
      onUpdate: () => draw(st.p, 1),
      onComplete: () => {
        this.swooshTween = this.scene.tweens.add({
          targets: g,
          alpha: 0,
          duration: SWOOSH.fadeMs,
          onComplete: () => g.clear().setVisible(false),
        });
      },
    });
  }

  private stopShake() {
    if (this.state === 'hold') this.lastHoldAt = this.scene.time.now;
    if (!this.shake) return;
    this.shake.remove();
    this.shake = undefined;
    this.sprite.x = 0;
  }

  /** Quita la inclinación de la carga (vuelve a la escala uniforme del sprite). */
  private stopLean() {
    if (!this.lean) return;
    this.lean.remove();
    this.lean = undefined;
    this.sprite.setAngle(0);
    this.sprite.scaleY = this.sprite.scaleX;
  }

  private releaseServe() {
    this.serveReleased = true;
    this.sprite.anims.timeScale = 1; // del brazo arriba al contacto a ritmo normal (serveContactDelay lo cuenta así)
    if (this.sprite.anims.isPaused) this.sprite.anims.resume();
  }

  private onFrame(f: Phaser.Animations.AnimationFrame) {
    const frame = Number(f.textureFrame);
    // saque: parar con el brazo arriba hasta que la pelota esté a punto de caer al golpeo
    if (this.state === 'serve') {
      if (!this.serveReleased && frame === this.geo.serveWait) {
        this.sprite.anims.pause();
        this.sprite.anims.timeScale = 1;
      }
      return;
    }
    if (this.state !== 'swing') return;
    if (!this.swingHitDone && frame >= this.swingImpact) {
      // impacto: pausa breve (hit-stop) y "golpe" de escala; luego seguimiento
      this.swingHitDone = true;
      const power = this.swingPower;
      this.sprite.anims.pause();
      const base = this.sprite.scaleX;
      this.scene.tweens.add({ targets: this.sprite, scaleX: base * (power ? 1.07 : 1.05), scaleY: base * (power ? 0.95 : 0.965), duration: 50, yoyo: true });
      // latigazo: el cuerpo gira un poco hacia donde va la raqueta y vuelve
      this.scene.tweens.add({ targets: this.sprite, angle: (power ? -6 : -4) * this.facing, duration: 70, yoyo: true, ease: 'Quad.easeOut' });
      this.playSwoosh(power);
      this.scene.time.delayedCall(power ? SWING.hitStopPowerMs : SWING.hitStopMs, () => {
        if (this.state !== 'swing') return;
        this.sprite.anims.timeScale = power ? SWING.followPower : SWING.follow;
        this.sprite.anims.resume();
      });
      return;
    }
    if (this.swingHitDone && frame >= Math.min(this.swingFrames - 1, this.swingImpact + SWING.followLock)) this.swingInterruptible = true;
    // recuperación: los dos últimos frames algo más lentos (no salta de golpe al reposo)
    if (frame >= this.swingFrames - 2) this.sprite.anims.timeScale = SWING.recover;
    // si el jugador ya se mueve o carga, sale de la recuperación sin esperar al final
    const wantsRun = this.moving && !this.charging;
    const wantsHold = this.charging && !this.moving;
    if (this.swingInterruptible && (wantsRun || wantsHold)) {
      this.state = 'idle';
      this.refresh();
    }
  }

  private onComplete(animKey: string) {
    if (this.state === 'victory') return; // se queda en la última pose
    if (this.state === 'swing' || this.state === 'serve' || this.state === 'runstop') {
      if (animKey === this.k('idle') || animKey === this.k('run')) return;
      this.state = 'idle'; // parte del reposo y deja que refresh decida
      this.sprite.anims.timeScale = 1;
      if (this.moving && !this.charging) this.enter('run');
      else if (this.charging || this.ready) this.enterHold();
      else this.enter('idle');
    }
  }
}




