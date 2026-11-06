import Phaser from 'phaser';
import { SHEETS, SHEET_IDS, type SheetCfg, type SheetId } from '../characters/sheets';
import { CHAR_UNITS_H, skinMode } from '../characters/skins';

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

export function queueNxoSpriteLoads(load: Phaser.Loader.LoaderPlugin) {
  if (skinMode() === 'off') return;
  for (const id of IDS) {
    const c = CFGS[id];
    for (const a of NXO_ANIMS) {
      load.spritesheet(spriteKey(id, a), `assets/characters/${id}-sprites/${A(id)[a].file}`, { frameWidth: c.cell.w, frameHeight: c.cell.h });
    }
  }
}

export function nxoSpritesReady(scene: Phaser.Scene, id: SpriteCharId = 'nxo') {
  return NXO_ANIMS.every((a) => scene.textures.exists(spriteKey(id, a)));
}

/** Crea las animaciones (globales del juego). Llamar una vez tras cargar las texturas. */
export function registerNxoAnims(scene: Phaser.Scene) {
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
}
export class NxoActor {
  readonly sprite: Phaser.GameObjects.Sprite;
  private state: State = 'idle';
  private moving = false;
  private charging = false;
  private ready = false;
  private facing = 1;
  private serveReleased = false;
  private lastHoldAt = -1e9;
  private shake?: Phaser.Tweens.Tween;

  private readonly cfg: SheetCfg;
  private k(a: NxoAnim) {
    return spriteKey(this.id, a);
  }

  constructor(private scene: Phaser.Scene, parent: Phaser.GameObjects.Container, private id: SpriteCharId = 'nxo') {
    this.cfg = CFGS[id];
    this.sprite = scene.add.sprite(0, 0, this.k('idle'), 0);
    // el ancla de la celda es (centro del cuerpo, suelo): los pies quedan en (0,0) del Character
    this.sprite.setOrigin(this.cfg.origin.x, this.cfg.origin.y).setScale(CHAR_UNITS_H / this.cfg.standHeight);
    parent.add(this.sprite);
    this.sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => this.onComplete(anim.key));
    this.sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, (_a: Phaser.Animations.Animation, f: Phaser.Animations.AnimationFrame) => this.onFrame(f));
    this.sprite.play(this.k('idle'));
  }

  // ------------------------------------------------------------ entradas (las llama Character)
  setMoving(m: boolean) {
    this.moving = m;
    this.refresh();
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

  /** Golpe: derecha / revés según el lado de la pelota; remate (smash) si es alto o es el SMASH. */
  swing(overhead: boolean) {
    if (this.state === 'victory') return;
    if (this.state === 'serve') {
      this.releaseServe(); // el saque ya está en marcha: solo asegurar que termina el golpe
      return;
    }
    if (this.state === 'swing') return;
    const wasHold = this.state === 'hold' || this.scene.time.now - this.lastHoldAt < 150;
    const anim: NxoAnim = overhead ? 'smash' : this.facing > 0 ? 'forehand' : 'backhand';
    // desde la preparación se continúa justo después; sin ella se salta la primera parte del clip
    const start = overhead ? this.cfg.smashStart : wasHold ? this.cfg.hold + 1 : this.cfg.hold;
    this.stopShake();
    this.state = 'swing';
    this.sprite.anims.timeScale = 1;
    this.sprite.play({ key: this.k(anim), startFrame: start });
  }

  /** Inicio del toque del saque (la pelota acaba de salir). El golpe llega con serveRelease(). */
  serve() {
    if (this.state === 'victory') return;
    this.stopShake();
    this.state = 'serve';
    this.serveReleased = false;
    this.sprite.anims.timeScale = 1;
    this.sprite.play(this.k('serve'));
  }

  /** La pelota está a punto de bajar a la altura de golpeo: soltar el clip para que impacte justo. */
  serveRelease() {
    if (this.state === 'serve') this.releaseServe();
  }

  /** Segundos que tarda la raqueta en llegar al contacto desde la pose de espera del saque. */
  serveContactDelay() {
    const a = this.cfg.animations.serve as AnimInfo;
    return Math.max(0.04, ((a.impact ?? this.cfg.serveWait) - this.cfg.serveWait) / a.fps);
  }

  victory() {
    this.stopShake();
    this.state = 'victory';
    this.sprite.anims.timeScale = 1;
    this.sprite.play(this.k('victory'));
  }

  /** Vuelve a la pose neutra (nuevo punto: el jugador se recoloca). */
  resetPose() {
    this.stopShake();
    this.moving = false;
    this.charging = false;
    this.ready = false;
    this.state = 'idle';
    this.sprite.anims.timeScale = 1;
    this.sprite.play(this.k('idle'));
  }

  // ------------------------------------------------------------ interno
  private busy() {
    return this.state === 'swing' || this.state === 'serve' || this.state === 'victory';
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
  }

  private enter(s: 'idle' | 'run' | 'runstop') {
    if (this.state === 'hold') this.lastHoldAt = this.scene.time.now;
    this.stopShake();
    this.state = s;
    this.sprite.anims.timeScale = 1;
    this.sprite.play(this.k(s));
  }

  private enterHold() {
    this.state = 'hold';
    this.sprite.anims.stop();
    this.sprite.setTexture(this.k(this.facing > 0 ? 'forehand' : 'backhand'), this.cfg.hold);
    // cargando: tiembla un poco, como el brazo del personaje vectorial
    if (this.charging && !this.shake) {
      this.shake = this.scene.tweens.add({ targets: this.sprite, x: { from: -1.5, to: 1.5 }, duration: 55, yoyo: true, repeat: -1 });
    } else if (!this.charging) this.stopShake();
  }

  private stopShake() {
    if (this.state === 'hold') this.lastHoldAt = this.scene.time.now;
    if (!this.shake) return;
    this.shake.remove();
    this.shake = undefined;
    this.sprite.x = 0;
  }

  private releaseServe() {
    this.serveReleased = true;
    if (this.sprite.anims.isPaused) this.sprite.anims.resume();
  }

  private onFrame(f: Phaser.Animations.AnimationFrame) {
    // saque: parar con el brazo arriba hasta que la pelota esté a punto de caer al golpeo
    if (this.state === 'serve' && !this.serveReleased && Number(f.textureFrame) === this.cfg.serveWait) this.sprite.anims.pause();
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




