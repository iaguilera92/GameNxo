import Phaser from 'phaser';
import { SHEETS, SHEET_IDS, type SheetCfg, type SheetId } from '../characters/sheets';
import { CHAR_UNITS_H, skinMode } from '../characters/skins';
import nxoHits from '../characters/nxo-hits.json';
import nxoSpecial from '../characters/nxo-special.json';
import nxoMove from '../characters/nxo-move.json';
import nxoInferno from '../characters/nxo-inferno.json';
import nxoFInferno from '../characters/nxo-front-inferno.json';
import nxoExtra from '../characters/nxo-extra.json';
import nxoFHits from '../characters/nxo-front-hits.json';
import nxoFSpecial from '../characters/nxo-front-special.json';
import nxoFMove from '../characters/nxo-front-move.json';
import nxoFExtra from '../characters/nxo-front-extra.json';
import maiHits from '../characters/mai-hits.json';
import maiSpecial from '../characters/mai-special.json';
import maiMove from '../characters/mai-move.json';
import maiExtra from '../characters/mai-extra.json';
import maiInferno from '../characters/mai-inferno.json';
import { runAnimRate } from '../logic/PlayerMotion';

/**
 * Hojas NUEVAS de NXO de espaldas (public/personajes/Nxo/pj-nxo-sprites-1..4.png, cortadas con
 * tools/build-nxo-v2.mjs): todas las tiras viven en assets/characters/nxo-v2/ con la misma celda y ancla.
 * Con ellas NO se voltea nada: correr a la izquierda, frenadas, etc. ya vienen dibujados.
 */
const V2_DIR = 'nxo-v2';
const sheetDir = (id: SheetId) => PACKS[id]?.dir ?? `${id}-sprites`;
type ExtraAnim = keyof typeof nxoExtra.animations;
const EXTRA = nxoExtra as { cell: { w: number; h: number }; origin: { x: number; y: number }; standHeight: number; animations: Record<ExtraAnim, AnimInfo> };
/** animaciones extra de un pack: cada personaje trae las que tiene su hoja (MAI no trae el bote ni el lanzamiento del saque) */
type ExtraCfg = Omit<typeof EXTRA, 'animations'> & { animations: Partial<Record<ExtraAnim, AnimInfo>> };
const extrasOf = (p: { extra: ExtraCfg }) => Object.entries(p.extra.animations) as [ExtraAnim, AnimInfo][];
const extraKey = (a: ExtraAnim, pk = 'nxo') => `${pk}-x-${a}`;

/** Raqueta suelta (sale volando al recibir el INFERNO): imagen generada por cÃ³digo. */
export const LOOSE_RACKET = 'nxo-loose-racket';

/**
 * NXO de espaldas con animaciones por sprites (hoja procesada con tools/build-nxo-sprites.mjs).
 * Es el "cuerpo" del Character cuando el jugador usa la skin 'nxo' en la vista 'back'.
 *
 * MÃ¡quina de estados:
 *   idle â‡„ run            en bucle; run â†’ runstop (una vez) â†’ idle
 *   hold                  pose de preparaciÃ³n del golpe (cargando o con la pelota cerca)
 *   swing                 forehand / backhand / smash, una vez; vuelve a idle / run / hold
 *   serve                 saque: toque hasta el brazo arriba, espera la pelota y golpea
 *   victory               celebraciÃ³n (una vez; queda en la Ãºltima pose)
 *
 * El golpe fÃ­sico se aplica en el mismo frame en que el juego llama a swing(), asÃ­ que el clip
 * arranca unos fotogramas antes del impacto (desde la pose de preparaciÃ³n) para que la raqueta
 * llegue a la pelota casi a la vez.
 */
export type NxoAnim = 'idle' | 'run' | 'runstop' | 'forehand' | 'backhand' | 'serve' | 'smash' | 'victory';
/**
 * Bote antes del saque (hoja 4, fila 1). Medidas en px del sprite (alto de pie 108), sobre los pies:
 * altura de la mano en cada frame, lado de la mano y tiempos (en frames) de soltar, tocar el suelo y recoger.
 * zPerPx / yPerPx pasan px del sprite a unidades del mundo (medido en la cancha a la distancia del saque).
 */
const BOUNCE = {
  // hoja 4 fila 1 (versiÃ³n del 08-11 20:18): mano libre a la IZQUIERDA de la imagen, raqueta a la derecha
  frames: [55, 51, 37, 34, 30, 35, 50, 55],
  palm: 8, // la pelota va bajo la palma
  handX: -30,
  release: 2.2,
  ground: 4.3,
  catch: 6.5,
  // medido con alto de pie 108; la hoja actual mide 115 â†’ Ã—108/115
  zPerPx: 1.09,
  yPerPx: 0.82,
};

/** salto por cÃ³digo (frames 3-6 = Ã­ndices 2-5) del saque con efecto */
const JUMP_ARC = [0.45, 0.85, 1, 0.55];
const JUMP_H = CHAR_UNITS_H * 0.22;

/** al empezar a moverse camina este tiempo (ms) y luego corre (hojas nuevas) */
const WALK_MS = 500;

type State = 'idle' | 'run' | 'runstop' | 'hold' | 'swing' | 'serve' | 'victory' | 'turn' | 'sprint' | 'land' | 'inferno' | 'dive' | 'stun' | 'emote' | 'remate';

export type SpriteCharId = SheetId;
/** Clip (textura = animación) para dibujar fuera del partido: último frame, ancla y alto de pie de su hoja. */
export type EndClip = { key: string; last: number; origin: { x: number; y: number }; standHeight: number };
const CFGS = SHEETS;
const IDS = SHEET_IDS;
export const NXO_ANIMS = Object.keys(SHEETS.nxo.animations) as NxoAnim[];
const spriteKey = (id: SpriteCharId, a: NxoAnim) => `${id}-${a}`;
type AnimInfo = { file: string; frames: number; fps: number; loop: boolean; impact?: number; scale?: number };
const A = (id: SpriteCharId) => CFGS[id].animations as Record<NxoAnim, AnimInfo>;

/**
 * Golpes rehechos de NXO de espaldas (hoja 1b: swing completo, impacto en el frame 4). Tienen su
 * propia celda y ancla, asÃ­ que al reproducirlos se cambia el origen del sprite. Si faltan las
 * texturas se usan los golpes de la hoja original.
 */
type HitAnim = 'forehand' | 'backhand' | 'forehand-power' | 'backhand-power' | 'serve' | 'smash';
/** Centro del cordaje en el frame de impacto del saque: altura sobre los pies (`z`) y lado (`dx`, + = derecha de la pantalla), en unidades del personaje. */
type RacketSpot = { dx: number; z: number };
const HITS = nxoHits as { cell: { w: number; h: number }; origin: { x: number; y: number }; standHeight: number; hold: number; serveWait: number; smashStart: number; serveRacket: { normal: RacketSpot; spin: RacketSpot }; animations: Record<HitAnim, AnimInfo> };
const HIT_ANIMS = Object.keys(HITS.animations) as HitAnim[];
const hitKey = (a: HitAnim, pk = 'nxo') => `${pk}-hit-${a}`;
const hitsReady = (scene: Phaser.Scene, p: Pack) => HIT_ANIMS.every((a) => scene.textures.exists(hitKey(a, p.key)));

/**
 * Remate ESPECIAL de NXO de espaldas (hoja 4, fila 3 "Smash potenciado": salta y remata en el aire).
 * Solo para el ataque especial SMASH. Hoja propia (celda/ancla distintas); si falta la textura se usa
 * el remate normal.
 */
type SpecialAnim = 'smash-power';
const SPECIAL = nxoSpecial as { cell: { w: number; h: number }; origin: { x: number; y: number }; standHeight: number; start: number; animations: Record<SpecialAnim, AnimInfo> };
const specialKey = (a: SpecialAnim, pk = 'nxo') => `${pk}-special-${a}`;

/**
 * Movimiento de NXO de espaldas (hoja 4, fila 6 "Frenada y cambio de direcciÃ³n"): corre a la derecha,
 * frena con polvo y sale hacia la izquierda (volteado = de izquierda a derecha). Hoja propia (celda/ancla
 * distintas). Si falta la textura, el giro es el volteo instantÃ¡neo de siempre.
 */
type MoveAnim = 'brake-turn';
const MOVE = nxoMove as {
  cell: { w: number; h: number };
  origin: { x: number; y: number };
  standHeight: number;
  turnExit: number;
  turnRate: number;
  /** frenada al terminar el DASH: frames landFrom..landEnd del mismo clip (corre, frena con polvo, guardia) */
  landFrom: number;
  landExit: number;
  landEnd: number;
  landRate: number;
  animations: Record<MoveAnim, AnimInfo>;
};
/** Ritmo de la carrera durante el sprint del DASH (la de siempre, con raqueta, muy acelerada). */
const SPRINT_RATE = 1.9;
const moveKey = (a: MoveAnim, pk = 'nxo') => `${pk}-move-${a}`;


/**
 * INFERNO DRIVE de NXO de espaldas (hoja pj-nxo-sprite-inferno, 16 frames en una textura de 4 columnas).
 * EXCLUSIVO del INFERNO: ningÃºn otro golpe lo usa. `hold` = pose de espera congelada durante la cinemÃ¡tica;
 * `preStrike` = Ãºltimo fotograma de preparaciÃ³n, justo antes del golpe; `strikeFrom` = donde arranca el clip
 * al contacto real; `impact` = frame del contacto. Si falta la textura se usa la guardia de siempre.
 */
type InfCfg = {
  cell: { w: number; h: number };
  origin: { x: number; y: number };
  standHeight: number;
  hold: number;
  preStrike: number;
  strikeFrom: number;
  impact: number;
  animations: { 'inferno-swing': AnimInfo };
};
const INF = nxoInferno as InfCfg;
const infernoKey = (pk = 'nxo') => `${pk}-inferno-swing`;
const infernoReady = (scene: Phaser.Scene, pk = 'nxo') => scene.textures.exists(infernoKey(pk)) && scene.anims.exists(infernoKey(pk));
/** si la cinemÃ¡tica no llega a golpear (cancelada sin aviso), la pose de espera se suelta sola pasado este tiempo real */
const INFERNO_HOLD_MAX_MS = 3500;

/**
 * Juego de hojas v2 de un personaje: tiras en assets/characters/<dir>/ y sus JSON. `key` prefija las texturas/animaciones.
 * 'nxo' = NXO de espaldas (jugador); 'nxo-front' = el rival (NXO de frente, tools/build-nxo-v2.mjs front);
 * 'mai' = MAI de espaldas (jugadora, tools/build-nxo-v2.mjs mai).
 */
type Pack = {
  dir: string;
  key: string;
  hits: typeof HITS;
  special: typeof SPECIAL;
  move: typeof MOVE;
  extra: ExtraCfg;
  /** el reposo del saque es el bote de la pelota (clip y alturas medidas solo en la hoja de espaldas) */
  bounce: boolean;
  /** INFERNO DRIVE (hoja de 9 frames) y su carpeta */
  inf: InfCfg;
  infDir: string;
};
const PACKS = {
  nxo: { dir: V2_DIR, key: 'nxo', hits: HITS, special: SPECIAL, move: MOVE, extra: EXTRA, bounce: true, inf: INF, infDir: 'nxo-inferno' },
  'nxo-front': {
    dir: 'nxo-front-v2',
    key: 'nxof',
    hits: nxoFHits as typeof HITS,
    special: nxoFSpecial as typeof SPECIAL,
    move: nxoFMove as typeof MOVE,
    extra: nxoFExtra as typeof EXTRA,
    bounce: false,
    inf: nxoFInferno as InfCfg,
    infDir: 'nxo-front-inferno',
  },
  // MAI de espaldas: sin bote ni lanzamiento del saque en su hoja (reposo normal y saque desde su frame 1)
  mai: {
    dir: 'mai-v2',
    key: 'mai',
    hits: maiHits as typeof HITS,
    special: maiSpecial as typeof SPECIAL,
    move: maiMove as typeof MOVE,
    extra: maiExtra as ExtraCfg,
    bounce: false,
    inf: maiInferno as InfCfg,
    infDir: 'mai-inferno',
  },
} as Record<'nxo' | 'nxo-front' | 'mai', Pack> & Partial<Record<SheetId, Pack>>;
const PACK_LIST = Object.values(PACKS) as Pack[];

export function queueNxoSpriteLoads(load: Phaser.Loader.LoaderPlugin) {
  if (skinMode() !== 'off') {
    for (const p of PACK_LIST) {
      for (const a of Object.keys(p.move.animations) as MoveAnim[]) {
        load.spritesheet(moveKey(a, p.key), `assets/characters/${p.dir}/${p.move.animations[a].file}`, { frameWidth: p.move.cell.w, frameHeight: p.move.cell.h });
      }
      for (const [a, info] of extrasOf(p)) {
        load.spritesheet(extraKey(a, p.key), `assets/characters/${p.dir}/${info.file}`, { frameWidth: p.extra.cell.w, frameHeight: p.extra.cell.h });
      }
    }
  }
  if (skinMode() !== 'off') {
    for (const p of PACK_LIST) load.spritesheet(infernoKey(p.key), `assets/characters/${p.infDir}/${p.inf.animations['inferno-swing'].file}`, { frameWidth: p.inf.cell.w, frameHeight: p.inf.cell.h });
  }
  queueBaseLoads(load);
}

function queueBaseLoads(load: Phaser.Loader.LoaderPlugin) {
  if (skinMode() === 'off') return;
  for (const id of IDS) {
    const c = CFGS[id];
    for (const a of NXO_ANIMS) {
      load.spritesheet(spriteKey(id, a), `assets/characters/${sheetDir(id)}/${A(id)[a].file}`, { frameWidth: c.cell.w, frameHeight: c.cell.h });
    }
  }
  for (const p of PACK_LIST) {
    for (const a of HIT_ANIMS) {
      load.spritesheet(hitKey(a, p.key), `assets/characters/${p.dir}/${p.hits.animations[a].file}`, { frameWidth: p.hits.cell.w, frameHeight: p.hits.cell.h });
    }
    for (const a of Object.keys(p.special.animations) as SpecialAnim[]) {
      load.spritesheet(specialKey(a, p.key), `assets/characters/${p.dir}/${p.special.animations[a].file}`, { frameWidth: p.special.cell.w, frameHeight: p.special.cell.h });
    }
  }
}
/** Raqueta suelta (misma paleta que la del sprite: aro rojo, cordaje claro, mango negro). */
export function ensureLooseRacket(scene: Phaser.Scene) {
  if (scene.textures.exists(LOOSE_RACKET)) return;
  const g = scene.make.graphics({}, false);
  // dibujada en vertical: cabeza arriba, mango abajo (32x64)
  g.fillStyle(0x1a1016, 1).fillRoundedRect(13, 34, 6, 28, 3); // mango
  g.fillStyle(0xc62828, 1).fillRect(14, 30, 4, 8); // cuello
  g.fillStyle(0x7a0f14, 1).fillEllipse(16, 17, 30, 34); // aro (borde oscuro)
  g.fillStyle(0xe53935, 1).fillEllipse(16, 17, 26, 30);
  g.fillStyle(0xf3e6d0, 1).fillEllipse(16, 17, 19, 23); // cordaje
  g.lineStyle(1, 0xc9b79a, 0.8);
  for (let i = -2; i <= 2; i++) {
    g.lineBetween(16 + i * 3.5, 7, 16 + i * 3.5, 27);
    g.lineBetween(7, 17 + i * 4, 25, 17 + i * 4);
  }
  g.generateTexture(LOOSE_RACKET, 32, 64);
  g.destroy();
}

export function nxoSpritesReady(scene: Phaser.Scene, id: SpriteCharId = 'nxo') {
  return NXO_ANIMS.every((a) => scene.textures.exists(spriteKey(id, a)));
}

/** Crea las animaciones (globales del juego). Llamar una vez tras cargar las texturas. */
export function registerNxoAnims(scene: Phaser.Scene) {
  const mk = (k: string, info: AnimInfo, repeat: number) => {
    if (!scene.textures.exists(k) || scene.anims.exists(k)) return;
    scene.anims.create({ key: k, frames: scene.anims.generateFrameNumbers(k, { start: 0, end: info.frames - 1 }), frameRate: info.fps, repeat });
  };
  for (const p of PACK_LIST) {
    for (const a of Object.keys(p.move.animations) as MoveAnim[]) mk(moveKey(a, p.key), p.move.animations[a], 0);
    for (const [a, info] of extrasOf(p)) mk(extraKey(a, p.key), info, info.loop ? -1 : 0);
    for (const a of Object.keys(p.special.animations) as SpecialAnim[]) mk(specialKey(a, p.key), p.special.animations[a], 0);
    mk(infernoKey(p.key), p.inf.animations['inferno-swing'], 0);
    if (hitsReady(scene, p)) for (const a of HIT_ANIMS) mk(hitKey(a, p.key), p.hits.animations[a], 0);
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
}
/**
 * Ritmo del golpe (solo presentaciÃ³n; el golpe fÃ­sico ocurre cuando lo decide la escena):
 *   preparaciÃ³n (pose hold) â†’ aceleraciÃ³n rÃ¡pida hasta el frame de impacto â†’ pausa breve de impacto
 *   (hit-stop) â†’ seguimiento â†’ recuperaciÃ³n algo mÃ¡s lenta â†’ reposo.
 * El tiro cargado / SMASH (`power`) acelera mÃ¡s, se detiene mÃ¡s en el impacto y sigue mÃ¡s largo.
 */
const SWING = {
  accel: 1.8, // velocidad de reproducciÃ³n hasta el impacto (normal; mÃ¡s lento = se ve el armado)
  accelPower: 3, // Ã­dem con potencia
  hitStopMs: 45,
  hitStopPowerMs: 90,
  // velocidad tras el impacto: mÃ¡s lenta para que se vea el seguimiento (frame 7: la raqueta cruza el cuerpo);
  // a 15 fps Ã— 0,55 cada frame dura ~120 ms
  follow: 0.55,
  followPower: 0.5,
  recover: 0.75, // Ãºltimos 2 frames
  maxImpactMs: 160, // (impacto en el frame 8: la raqueta tarda algo mÃ¡s en llegar) // el destello nunca se retrasa mÃ¡s que esto respecto al golpe fÃ­sico
  followLock: 3, // frames tras el impacto en que el seguimiento no se corta al moverse (se ven el 7 y el 8 completos)
};
/** Estela de la raqueta (arco en el impacto), en unidades del Character (alto = CHAR_UNITS_H). */
const SWOOSH = {
  rx: 0.62, // radio horizontal del arco (Ã— alto del personaje)
  ry: 0.2, // radio vertical
  y: -0.45, // altura del centro (negativo = hacia arriba desde los pies)
  tail: 0.55, // largo de la cola (fracciÃ³n del arco)
  ms: 130,
  msPower: 170,
  fadeMs: 140,
};
/** El saque corre rÃ¡pido hasta el brazo arriba (la pelota ya saliÃ³) y luego a ritmo normal. */
const SERVE_TOSS_SPEED = 2.6;

export class NxoActor {
  readonly sprite: Phaser.GameObjects.Sprite;
  private state: State = 'idle';
  private moving = false;
  private charging = false;
  private ready = false;
  private facing = 1;
  /** direcciÃ³n del desplazamiento lateral en pantalla (1 derecha, -1 izquierda); independiente del golpe */
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
  /** tras el impacto + 1 frame ya se puede salir a correr (la recuperaciÃ³n no bloquea el movimiento) */
  private swingInterruptible = false;
  private swingOverhead = false;
  /** el golpe en curso es el INFERNO DRIVE (su hoja ya trae el barrido de fuego: sin estela extra) */
  private swingInferno = false;
  /** instante real (performance.now) en que empezÃ³ la pose de espera del INFERNO */
  private infernoSince = 0;
  /** estela de la raqueta (se dibuja encima del sprite, dentro del mismo Character) */
  private readonly swoosh: Phaser.GameObjects.Graphics;
  private swooshTween?: Phaser.Tweens.Tween;
  // movimiento con inercia (src/logic/PlayerMotion.ts). Sin velocidad (p. ej. el rival) = comportamiento de siempre.
  /** true mientras quien llama no pasa la velocidad real */
  private legacyMove = true;
  /** fracciÃ³n 0..1 de la velocidad mÃ¡xima */
  private speedK = 1;
  /** se soltÃ³ el joystick corriendo rÃ¡pido: la parada lleva animaciÃ³n de frenada */
  private skidArmed = false;
  /** en el giro (brake-turn) ya estÃ¡ orientado al nuevo lado: se puede salir a correr */
  private turnDone = true;
  /** frenada del DASH ya en guardia: se puede volver a correr / golpear */
  private landDone = true;
  /** sacador quieto antes de lanzar: el reposo es el bote de la pelota (hoja 4, fila 1) */
  private serveIdle = false;
  /** saque en curso: tipo (con efecto usa su propio golpe) y si aÃºn va el lanzamiento (hoja 4, fila 2) */
  private serveKind: 'normal' | 'spin' = 'normal';
  private tossing = false;
  /** estirada: lado y si ya va la recuperaciÃ³n */
  private diveSide = 1;
  private recovering = false;
  private looseRacket?: Phaser.GameObjects.Image;
  private looseAt = -1;

  /** juego de hojas v2 de este personaje (nxo de espaldas / nxo de frente); undefined = hojas antiguas */
  private readonly pk?: Pack;
  private get P(): Pack {
    return this.pk ?? PACKS.nxo;
  }
  private xk(a: ExtraAnim) {
    return extraKey(a, this.P.key);
  }
  private xr(a: ExtraAnim) {
    return this.scene.anims.exists(extraKey(a, this.P.key));
  }
  private hk(a: HitAnim) {
    return hitKey(a, this.P.key);
  }
  private sk(a: SpecialAnim) {
    return specialKey(a, this.P.key);
  }
  private mk(a: MoveAnim) {
    return moveKey(a, this.P.key);
  }
  private specialOk() {
    return this.scene.textures.exists(this.sk('smash-power'));
  }
  private moveOk() {
    return this.scene.textures.exists(this.mk('brake-turn')) && this.scene.anims.exists(this.mk('brake-turn'));
  }
  private readonly cfg: SheetCfg;
  /** usa los golpes rehechos (hoja 1b) en vez de los de la hoja original */
  private readonly hits: boolean;
  private k(a: NxoAnim) {
    return spriteKey(this.id, a);
  }
  /** clip de golpe: el de la hoja 1b si estÃ¡; si no, el de la hoja original (las versiones potentes caen en la normal) */
  private clip(a: HitAnim): { key: string; info: AnimInfo } {
    if (this.hits) return { key: this.hk(a), info: this.P.hits.animations[a] };
    const base: NxoAnim = a === 'forehand-power' ? 'forehand' : a === 'backhand-power' ? 'backhand' : a;
    return { key: this.k(base), info: A(this.id)[base] };
  }
  /** fotogramas clave (guardia, espera del saque, inicio del remate) de la hoja de golpes en uso */
  private get geo() {
    return this.hits ? this.P.hits : this.cfg;
  }
  /**
   * Frame de la pose de espera: normal (la derecha puede tener el suyo: `holdForehand`) o de CARGA (`holdPower`,
   * filas 3 y 4 = forehand-power / backhand-power). Ver nxo-hits.json.
   */
  private holdOf(side: 'forehand' | 'backhand', power = false): number {
    const h = this.hits ? (this.P.hits as { holdForehand?: number; holdPower?: number; holdPowerForehand?: number }) : undefined;
    if (power && side === 'forehand' && h?.holdPowerForehand !== undefined) return h.holdPowerForehand;
    if (power && h?.holdPower !== undefined) return h.holdPower;
    if (!power && side === 'forehand' && h?.holdForehand !== undefined) return h.holdForehand;
    return this.geo.hold;
  }
  /** ancla y alto de pie de la hoja de un clip (las hojas tienen celdas y escalas distintas) */
  private geoOf(key: string): { origin: { x: number; y: number }; standHeight: number } {
    if (key === infernoKey(this.P.key)) return this.P.inf;
    if (key.startsWith(`${this.P.key}-special-`)) return this.P.special;
    if (key.startsWith(`${this.P.key}-hit-`)) return this.P.hits;
    if (key.startsWith(`${this.P.key}-move-`)) return this.P.move;
    if (key.startsWith(`${this.P.key}-x-`)) return this.P.extra;
    return this.cfg;
  }
  /** ajusta ancla y escala del sprite a la hoja de `key` (los pies quedan siempre en (0,0) y al mismo alto) */
  private fitTo(key: string) {
    const g = this.geoOf(key);
    this.sprite.setOrigin(g.origin.x, g.origin.y);
    // retoque por animaciÃ³n (p. ej. smash potenciado dibujado mÃ¡s chico: `scale` en su JSON)
    const k = key === this.sk('smash-power') ? (this.P.special.animations['smash-power'].scale ?? 1) : 1;
    this.sprite.setScale((CHAR_UNITS_H / g.standHeight) * k);
  }
  /** reproduce un clip ajustando el ancla (las hojas tienen celdas distintas) */
  private playClip(key: string, startFrame = 0) {
    this.fitTo(key);
    this.sprite.y = 0; // sin salto por cÃ³digo salvo en los clips que lo llevan (jumpAt)
    this.sprite.play({ key, startFrame });
  }

  /**
   * Salto por cÃ³digo del saque con efecto (hoja 2, fila 6): el dibujo no despega del suelo, asÃ­ que en los
   * frames 3-6 (Ã­ndices 2-5) se eleva el sprite en arco; pico en el impacto (frame 5, Ã­ndice 4).
   * El smash potenciado (fila 8) ya trae el salto DIBUJADO: no se suma otro.
   */
  private jumpAt(key: string | undefined, frame: number) {
    const jump = key === this.xk('serve-spin');
    const k = jump ? (JUMP_ARC[frame - 2] ?? 0) : 0;
    this.sprite.y = -k * JUMP_H;
  }
  /** hojas nuevas (sin volteos) y con las animaciones extra cargadas */
  private get v2() {
    return !!this.pk && this.xr('run-left');
  }
  /** volteo de carrera hacia la izquierda (la fila "run-left" de la hoja nueva corre a la derecha: se usa run volteado) */
  private flip(on: boolean) {
    this.sprite.setFlipX(on);
  }

  constructor(private scene: Phaser.Scene, parent: Phaser.GameObjects.Container, private id: SpriteCharId = 'nxo') {
    this.cfg = CFGS[id];
    this.pk = PACKS[id];
    this.hits = !!this.pk && this.pk.hits.standHeight === this.cfg.standHeight && hitsReady(scene, this.pk);
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
  setMoving(m: boolean, dirX = 0, speedK?: number) {
    if (Math.abs(dirX) > 0.15) this.runDir = dirX > 0 ? 1 : -1;
    this.legacyMove = speedK === undefined;
    if (speedK !== undefined) this.speedK = speedK;
    this.moving = m;
    this.refresh();
    // hojas nuevas: cambiar de lado corriendo cambia de clip (derecha â‡„ izquierda), sin volteo
    if (this.v2 && this.state === 'run' && this.sprite.anims.currentAnim?.key !== this.runKey()) this.enter('run');
    else if (this.state === 'run' || this.state === 'runstop') this.flip(this.runDir < 0);
    // carrera al ritmo de la velocidad real (sin patinar al ir despacio)
    if (this.state === 'run' && !this.legacyMove) this.sprite.anims.timeScale = runAnimRate(this.speedK);
  }

  /**
   * Sprint del DASH. on: carrera de siempre (con raqueta) muy acelerada hacia `dirX` (0 = conserva el lado).
   * off con `land`: frenada de la hoja 4 que termina en guardia; sin `land` (cancelado): vuelve al reposo.
   * Si mientras tanto empezÃ³ un golpe (contacto normal, SMASH, INFERNO), el golpe manda y aquÃ­ no se toca nada.
   */
  setSprint(on: boolean, dirX = 0, land = false) {
    if (Math.abs(dirX) > 0.15) this.runDir = dirX > 0 ? 1 : -1;
    if (on) {
      if (this.state === 'victory' || this.state === 'serve') return;
      this.stopShake();
      this.stopLean();
      this.moving = false; // el sprint manda en la animaciÃ³n; al acabar, setMoving vuelve a decidir
      this.state = 'sprint';
      if (this.v2) {
        // hojas nuevas: DASH propio hacia la derecha; hacia la izquierda, la carrera izquierda acelerada
        const right = this.runDir > 0;
        this.playClip(this.xk('dash'));
        this.sprite.anims.timeScale = 1.2;
        this.flip(!right);
        return;
      }
      this.playClip(this.k('run'));
      this.sprite.anims.timeScale = SPRINT_RATE;
      this.flip(this.runDir < 0);
      return;
    }
    if (this.state !== 'sprint') return;
    // la frenada de la hoja estÃ¡ dibujada corriendo hacia la derecha: con las hojas nuevas (sin volteo) solo se usa en ese sentido
    if (land && !!this.pk && this.moveOk()) {
      this.state = 'land';
      this.landDone = false;
      // el clip frena corriendo hacia la derecha: hacia la izquierda se voltea (solo hojas antiguas)
      this.flip(this.runDir < 0);
      this.playClip(this.mk('brake-turn'), this.P.move.landFrom);
      this.sprite.anims.timeScale = this.P.move.landRate;
      return;
    }
    this.state = 'idle';
    this.refresh();
    if (this.state === 'idle') this.enter('idle');
  }

  /**
   * INFERNO DRIVE, concentraciÃ³n: pose de espera congelada (frame `hold` de su hoja, raqueta atrÃ¡s en la mano derecha,
   * mano izquierda seÃ±alando). Sin volteo. false = sin hoja (el llamador usa la guardia de siempre).
   */
  infernoHold(): boolean {
    if (!this.pk || !infernoReady(this.scene, this.P.key) || this.state === 'victory') return false;
    this.stopShake();
    this.stopLean();
    this.state = 'inferno';
    this.infernoSince = performance.now();
    this.swingInferno = false;
    this.sprite.anims.stop();
    this.sprite.anims.timeScale = 1;
    this.sprite.setFlipX(false);
    this.fitTo(infernoKey(this.P.key)); // su hoja tiene otra celda y otra escala
    this.sprite.setTexture(infernoKey(this.P.key), this.P.inf.hold);
    return true;
  }

  /** INFERNO DRIVE: Ãºltimo fotograma de preparaciÃ³n, unos ms antes del contacto (la pose sigue congelada, solo cambia el frame). */
  infernoPre() {
    if (this.state === 'inferno') this.sprite.setFrame(this.P.inf.preStrike);
  }

  /** INFERNO DRIVE sin golpe (cancelado o descartado): sale de la pose de espera. */
  infernoRelease() {
    if (this.state !== 'inferno') return;
    this.state = 'idle';
    this.sprite.setAngle(0);
    this.sprite.anims.timeScale = 1;
    this.refresh();
    if (this.state === 'idle') this.enter('idle');
  }

  /** Se soltÃ³ el joystick corriendo rÃ¡pido: la prÃ³xima parada muestra la frenada (runstop). */
  skid() {
    this.skidArmed = true;
  }

  /**
   * Cambio de sentido lateral corriendo: frenada con polvo y giro (hoja 4). `newDir`: lado al que va
   * ahora (1 derecha, -1 izquierda). Solo NXO de espaldas con la hoja cargada; si no, volteo de siempre.
   */
  brakeTurn(newDir: number) {
    if (this.legacyMove || !this.pk || !this.moveOk()) return;
    if (this.state !== 'run' && this.state !== 'runstop') return;
    this.runDir = newDir >= 0 ? 1 : -1;
    // hojas nuevas (sin volteo): el giro dibujado va de derecha a izquierda; al revÃ©s, cambio de carrera directo
    this.state = 'turn';
    this.turnDone = false;
    this.skidArmed = false;
    // el clip va de derecha a izquierda: hacia la derecha se voltea (solo hojas antiguas)
    this.flip(this.runDir > 0);
    this.sprite.anims.timeScale = this.P.move.turnRate;
    this.playClip(this.mk('brake-turn'));
  }

  setCharging(on: boolean) {
    const changed = this.charging !== on;
    this.charging = on;
    if (on && this.state === 'turn') this.turnDone = true; // cargar corta el giro: guardia al momento
    // durante el sprint del DASH el jugador no puede cargar: solo INFERNO DRIVE pide la guardia aquÃ­ â†’ manda INFERNO
    if (on && (this.state === 'sprint' || this.state === 'land')) {
      this.landDone = true;
      this.state = 'idle';
    }
    this.refresh();
    if (changed && this.state === 'hold') this.enterHold(); // ya estaba en guardia: pasa de la pose de espera a la de carga (o al reves)
  }

  /** La pelota viene hacia el jugador y estÃ¡ cerca: ponerse en guardia con la raqueta atrÃ¡s. */
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
   * Golpe: derecha / revÃ©s segÃºn el lado de la pelota; remate (smash) si es alto o es el SMASH.
   * `power`: tiro cargado o SMASH (golpe mÃ¡s marcado). Devuelve los ms hasta el frame visual de
   * impacto, para que la escena sincronice el destello (la fÃ­sica NO se retrasa).
   */
  swing(overhead: boolean, power = false, special = false, volley = false): number {
    if (this.state === 'victory') return 0;
    if (this.state === 'serve') {
      // el saque ya está en marcha: asegurar que termina el golpe. serveRelease (no releaseServe): si aún está en el
      // LANZAMIENTO pasa al clip del golpe; antes se quedaba en el clip del lanzamiento, ocupado para siempre (rival en
      // red: su saque llega por game:hit sin pasar por serveRelease). (Claude, 12-11-2026)
      this.serveRelease();
      return 0;
    }
    if (this.state === 'swing' && !this.swingInterruptible) return 0;
    const wasHold = this.state === 'hold' || this.scene.time.now - this.lastHoldAt < 150;
    const side = this.facing > 0 ? 'forehand' : 'backhand';
    // normal: derecha = hoja 2 fila 1 (forehand), reves = fila 2 (backhand). Cargado: fila 3 (forehand-power) / fila 4 (backhand-power),
    // cada una con su propia pose de carga (holdPower)
    const anim: HitAnim = overhead ? 'smash' : power ? (side === 'forehand' ? 'forehand-power' : 'backhand-power') : side;
    const holdFrame = this.holdOf(side, power && !overhead);
    // ataque especial SMASH: remate con salto (hoja propia) si existe para este personaje
    // INFERNO DRIVE: viene de su pose de espera (infernoHold) â†’ clip propio, solo para este golpe
    const inferno = this.state === 'inferno' && infernoReady(this.scene, this.P.key);
    this.swingInferno = inferno;
    const useSpecial = !inferno && special && overhead && !!this.pk && this.specialOk();
    // volea en la red: clip 'volley' de las hojas nuevas (hoja 4, fila 5) si estÃ¡ cargado
    const volleyInfo = this.P.extra.animations.volley;
    const useVolley = !inferno && !useSpecial && volley && !overhead && this.v2 && this.xr('volley') && !!volleyInfo;
    const { key, info } = inferno
      ? { key: infernoKey(this.P.key), info: this.P.inf.animations['inferno-swing'] }
      : useSpecial
        ? { key: this.sk('smash-power'), info: this.P.special.animations['smash-power'] }
        : useVolley && volleyInfo
          ? { key: this.xk('volley'), info: volleyInfo }
          : this.clip(anim);
    const geo = this.geo;
    // desde la preparaciÃ³n se continÃºa justo despuÃ©s; sin ella se arranca EN la preparaciÃ³n (se ve la raqueta atrÃ¡s)
    const start = inferno ? this.P.inf.strikeFrom : useSpecial ? this.P.special.start : useVolley ? 1 : overhead ? geo.smashStart : wasHold ? holdFrame + 1 : holdFrame;
    const impact = inferno ? this.P.inf.impact : Math.max(start, info.impact ?? start + 2);
    this.stopShake();
    this.stopLean();
    this.sprite.setFlipX(false); // los golpes nunca van volteados (derecha/revÃ©s los decide `facing`)
    this.state = 'swing';
    this.swingImpact = impact;
    this.swingFrames = info.frames;
    this.swingPower = power;
    this.swingOverhead = overhead;
    this.swingHitDone = false;
    this.swingInterruptible = false;
    // la velocidad sube lo justo para que el contacto llegue dentro de maxImpactMs aunque el golpe arranque lejos del impacto
    const need = (impact - start) / (info.fps * (SWING.maxImpactMs / 1000));
    const accel = Math.max(power ? SWING.accelPower : SWING.accel, need);
    this.sprite.anims.timeScale = accel;
    this.playClip(key, start);
    return Math.min(SWING.maxImpactMs, ((impact - start) / (info.fps * accel)) * 1000);
  }

  /**
   * REMATE del globo (cámara lenta): pose de preparación del remate con salto (clip smash-power en su frame de arranque,
   * raqueta arriba) congelada hasta el golpe; swing(…, special) sigue desde ese mismo frame. false = sin hoja.
   */
  remateHold(): boolean {
    if (this.state === 'victory') return false;
    const useSpecial = !!this.pk && this.specialOk();
    if (!useSpecial && !this.v2) return false;
    this.stopShake();
    this.stopLean();
    this.sprite.setFlipX(false);
    this.state = 'remate';
    this.sprite.anims.timeScale = 1;
    this.playClip(useSpecial ? this.sk('smash-power') : this.clip('smash').key, useSpecial ? this.P.special.start : this.geo.smashStart);
    this.sprite.anims.pause();
    return true;
  }

  /**
   * Suelta la pose del REMATE sin golpear (punto terminado, golpe al aire o remate del rival en red que no llegó a su
   * golpe). Sin esto el estado 'remate' queda ocupado y el personaje ya no anima la carrera. (Claude, 12-11-2026)
   */
  releaseRemate() {
    if (this.state !== 'remate') return;
    if (this.sprite.anims.isPaused) this.sprite.anims.resume();
    this.enter('idle');
    this.refresh();
  }

  /** Inicio del toque del saque (la pelota acaba de salir). El golpe llega con serveRelease(). */
  serve(kind: 'normal' | 'spin' = 'normal') {
    if (this.state === 'victory') return;
    this.stopShake();
    this.stopLean();
    this.sprite.setFlipX(false);
    this.state = 'serve';
    this.serveReleased = false;
    this.serveKind = kind;
    this.serveIdle = false;
    // la pelota ya va hacia arriba: el brazo llega rÃ¡pido a la pose de lanzamiento (frame serveWait)
    this.sprite.anims.timeScale = SERVE_TOSS_SPEED;
    if (this.v2 && this.xr('serve-toss')) {
      // hojas nuevas: lanzamiento propio (brazo sube, raqueta atrÃ¡s); queda en su Ãºltimo frame hasta soltar
      this.tossing = true;
      this.playClip(this.xk('serve-toss'));
      return;
    }
    this.tossing = false;
    this.playClip(this.serveClip().key);
  }

  /** golpe del saque: con efecto usa su propio clip (hojas nuevas) */
  private serveClip(): { key: string; info: AnimInfo } {
    const spin = this.P.extra.animations['serve-spin'];
    if (this.serveKind === 'spin' && this.v2 && this.xr('serve-spin') && spin) return { key: this.xk('serve-spin'), info: spin };
    return this.clip('serve');
  }

  /** La pelota estÃ¡ a punto de bajar a la altura de golpeo: soltar el clip para que impacte justo. */
  serveRelease() {
    if (this.state !== 'serve') return;
    if (this.tossing) {
      // del lanzamiento al golpe: el clip de saque arranca en su pose de espera (trofeo) y llega al contacto
      this.tossing = false;
      this.serveReleased = true;
      this.sprite.anims.timeScale = 1;
      this.playClip(this.serveClip().key, this.geo.serveWait);
      return;
    }
    this.releaseServe();
  }

  /** Segundos que tarda la raqueta en llegar al contacto desde la pose de espera del saque. */
  serveContactDelay() {
    const a = this.serveClip().info, wait = this.geo.serveWait;
    return Math.max(0.04, ((a.impact ?? wait) - wait) / a.fps);
  }

  /**
   * Dónde está el centro del cordaje en el frame de impacto del saque en curso (medido sobre las tiras, ver
   * tools/build-nxo-v2.mjs): `z` = altura sobre los pies y `dx` = lado (+ = derecha de la pantalla), en unidades del
   * personaje. El saque con efecto suma el salto por código del propio sprite (jumpAt), que ya está en el frame 5.
   */
  serveRacket(): RacketSpot {
    const spin = this.serveClip().key === this.xk('serve-spin');
    const r = this.P.hits.serveRacket[spin ? 'spin' : 'normal'];
    return { dx: r.dx, z: r.z + (spin ? JUMP_H * (JUMP_ARC[2] ?? 0) : 0) };
  }

  /**
   * Sacador quieto antes de lanzar: el reposo pasa a ser el bote de la pelota (hoja 4, fila 1). MoviÃ©ndose
   * no se bota (corre); al lanzar se va directo al lanzamiento.
   */
  setServeIdle(on: boolean) {
    if (on === this.serveIdle) return;
    this.serveIdle = on;
    if (this.state === 'idle') this.enter('idle');
  }

  /**
   * Pelota del bote sincronizada con la mano del clip (hoja 4, fila 1: de espaldas, la mano libre bota al lado
   * derecho de la imagen, junto a la raqueta). Devuelve su altura `z` y su desplazamiento lateral `dy` en
   * unidades del mundo, o null si no se estÃ¡ botando. La pelota la dibuja y mueve el juego; el sprite no la lleva.
   *   frames 1-2  en la mano (cintura) Â· 3 suelta Â· ~4,5 toca el suelo Â· 7 vuelve a la mano Â· 8 en la mano
   */
  serveBounceBall(): { z: number; dy: number } | null {
    if (this.state !== 'idle' || this.sprite.anims.currentAnim?.key !== this.xk('serve-bounce')) return null;
    const t = this.sprite.anims.getProgress() * BOUNCE.frames.length; // 0..8 en "frames"
    const hand = (u: number) => {
      const i = Math.max(0, Math.min(BOUNCE.frames.length - 1, Math.floor(u)));
      const j = Math.min(BOUNCE.frames.length - 1, i + 1);
      const f = Math.max(0, Math.min(1, u - i));
      return BOUNCE.frames[i] + (BOUNCE.frames[j] - BOUNCE.frames[i]) * f; // px sobre los pies
    };
    let px: number;
    if (t < BOUNCE.release) px = hand(t) - BOUNCE.palm;
    else if (t < BOUNCE.ground) {
      const h0 = hand(BOUNCE.release) - BOUNCE.palm;
      const k = (t - BOUNCE.release) / (BOUNCE.ground - BOUNCE.release);
      px = h0 * (1 - k * k); // cae acelerando
    } else if (t < BOUNCE.catch) {
      const h1 = hand(BOUNCE.catch) - BOUNCE.palm;
      const k = (BOUNCE.catch - t) / (BOUNCE.catch - BOUNCE.ground);
      px = h1 * (1 - k * k); // sube frenando hasta la mano
    } else px = hand(t) - BOUNCE.palm;
    return { z: Math.max(2, px * BOUNCE.zPerPx), dy: BOUNCE.handX * BOUNCE.yPerPx };
  }

  // ------------------------------------------------------------ hojas nuevas: estiradas, aturdido, emotes
  /** Estirada hacia `side` (1 derecha, -1 izquierda) y recuperaciÃ³n. false = sin hoja (el llamador inclina el cuerpo). */
  lunge(side: number): boolean {
    if (!this.v2 || this.state === 'victory') return false;
    this.stopShake();
    this.stopLean();
    this.sprite.setFlipX(false);
    this.state = 'dive';
    this.diveSide = side >= 0 ? 1 : -1;
    this.recovering = false;
    this.sprite.anims.timeScale = 1;
    this.playClip(this.xk(this.diveSide > 0 ? 'dive-right' : 'dive-left'));
    return true;
  }

  /**
   * Golpe de un ataque especial recibido: aturdido (`stunned`) o, con el INFERNO, recibir el impacto con la
   * raqueta saliendo volando (vuelve a la mano al acabar). Dura `ms`. false = sin hoja.
   */
  /** `throwRacket` = false: la mano queda vacía pero la raqueta suelta la dibuja MatchScene (cae en la cancha). */
  impactStun(kind: 'smash' | 'inferno', ms: number, throwRacket = true): boolean {
    if (!this.v2 || this.state === 'victory') return false;
    this.stopShake();
    this.stopLean();
    this.sprite.setFlipX(false);
    this.state = 'stun';
    this.sprite.anims.timeScale = 1;
    if (kind === 'inferno' && this.xr('inferno-hit')) {
      this.looseAt = throwRacket ? 2 : -1; // desde el frame 3 la mano queda vacÃ­a: la raqueta sale volando
      this.playClip(this.xk('inferno-hit'));
    } else {
      this.looseAt = -1;
      this.playClip(this.xk('stunned'));
    }
    this.scene.time.delayedCall(ms, () => this.endBusy('stun'));
    return true;
  }

  /** ReacciÃ³n al acabar un punto (ganado / perdido). Se corta sola al empezar el siguiente. */
  pointEnd(won: boolean) {
    if (!this.v2 || this.state === 'victory' || this.state === 'stun') return;
    this.emote(won ? 'point-won' : 'point-lost');
  }

  /** Texturas + último frame de las poses de victoria / derrota (para dibujarlas fuera del partido). */
  endPoses(): { victory: { key: string; frame: number }; defeat: { key: string; frame: number } } | null {
    // En las tarjetas del resultado todos miran a cámara, incluso el personaje que jugó de espaldas.
    const frontId: SpriteCharId = this.id === 'nxo' ? 'nxo-front' : this.id === 'mai' ? 'mai-front' : this.id;
    const frontPack = PACKS[frontId];
    const last = (k: string) => {
      const a = this.scene.anims.get(k);
      return a && this.scene.textures.exists(k) ? { key: k, frame: a.frames.length - 1 } : null;
    };
    const idleKey = spriteKey(frontId, 'idle');
    const fallback = this.scene.textures.exists(idleKey) ? { key: idleKey, frame: 0 } : null;
    const victory = last(spriteKey(frontId, 'victory')) ?? fallback;
    const defeat = (frontPack ? last(extraKey('defeat', frontPack.key)) : null) ?? fallback;
    return victory && defeat ? { victory, defeat } : null;
  }

  /**
   * (Claude) Clips DE FRENTE para la pantalla de resultados (MatchEndScene): reposo en bucle, victoria y derrota, con el
   * ancla y el alto de pie de SU hoja, para dibujar a los dos personajes al mismo tamaño. Sin clip de derrota (p. ej. Mai
   * de frente, hoja antigua) se usa el reposo. null = sin hoja.
   */
  endClips(): { idle: EndClip; victory: EndClip; defeat: EndClip } | null {
    const frontId: SpriteCharId = this.id === 'nxo' ? 'nxo-front' : this.id === 'mai' ? 'mai-front' : this.id;
    const frontPack = PACKS[frontId];
    const cfg = CFGS[frontId];
    const mk = (k: string, g: { origin: { x: number; y: number }; standHeight: number }): EndClip | null => {
      const a = this.scene.anims.get(k);
      return a && this.scene.textures.exists(k) ? { key: k, last: a.frames.length - 1, origin: g.origin, standHeight: g.standHeight } : null;
    };
    const idle = mk(spriteKey(frontId, 'idle'), cfg);
    if (!idle) return null;
    const victory = mk(spriteKey(frontId, 'victory'), cfg) ?? idle;
    const defeat = (frontPack ? mk(extraKey('defeat', frontPack.key), frontPack.extra) : null) ?? idle;
    return { idle, victory, defeat };
  }

  /** Derrota (partido perdido): queda en la Ãºltima pose. */
  defeat() {
    if (!this.v2) return;
    this.stopShake();
    this.stopLean();
    this.sprite.setFlipX(false);
    this.state = 'victory'; // misma regla: se queda en la Ãºltima pose
    this.sprite.anims.timeScale = 1;
    this.playClip(this.xk('defeat'));
  }

  /** Clips sueltos de la hoja nueva (intro, saludo, espera activa, caminarâ€¦): una vez y vuelve al reposo. */
  emote(a: ExtraAnim) {
    if (!this.xr(a) || this.state === 'victory') return;
    this.stopShake();
    this.stopLean();
    this.sprite.setFlipX(false);
    this.state = 'emote';
    this.sprite.anims.timeScale = 1;
    this.playClip(this.xk(a));
  }

  private endBusy(s: State) {
    if (this.state !== s) return;
    this.state = 'idle';
    this.dropLooseRacket();
    this.refresh();
    if (this.state === 'idle') this.enter('idle');
  }

  /** La raqueta sale despedida girando (imagen suelta, dentro del Character) y espera a volver a la mano. */
  private throwLooseRacket() {
    ensureLooseRacket(this.scene);
    this.dropLooseRacket();
    const parent = this.sprite.parentContainer;
    if (!parent) return;
    const k = CHAR_UNITS_H / 140;
    const r = this.scene.add.image(28 * k, -70 * k, LOOSE_RACKET).setScale(k * 1.1).setAngle(-30);
    parent.add(r);
    this.looseRacket = r;
    this.scene.tweens.add({ targets: r, x: 120 * k, duration: 520, ease: 'Quad.easeOut' });
    this.scene.tweens.add({ targets: r, y: -190 * k, duration: 260, ease: 'Quad.easeOut', yoyo: true, hold: 0 });
    this.scene.tweens.add({ targets: r, angle: 720 + 60, duration: 520, ease: 'Quad.easeOut' });
    // queda en el suelo, tumbada, hasta que se recupera
    this.scene.time.delayedCall(540, () => r.active && r.setAngle(80));
  }

  private dropLooseRacket() {
    if (!this.looseRacket) return;
    const r = this.looseRacket;
    this.looseRacket = undefined;
    this.scene.tweens.killTweensOf(r);
    this.scene.tweens.add({ targets: r, alpha: 0, scale: r.scale * 0.6, duration: 140, onComplete: () => r.destroy() });
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
    this.skidArmed = false;
    this.turnDone = true;
    this.landDone = true;
    this.tossing = false;
    this.recovering = false;
    this.dropLooseRacket();
    this.state = 'idle';
    this.sprite.anims.timeScale = 1;
    this.enter('idle');
  }

  // ------------------------------------------------------------ interno
  private busy() {
    // la recuperaciÃ³n del golpe no bloquea: se puede salir a correr o volver a la guardia
    if (this.state === 'swing') return !this.swingInterruptible;
    if (this.state === 'turn') return !this.turnDone; // el giro se ve hasta quedar orientado
    if (this.state === 'sprint') return true; // lo controla el DASH (setSprint)
    if (this.state === 'land') return !this.landDone;
    if (this.state === 'stun') return true; // lo suelta endBusy al acabar el aturdimiento
    if (this.state === 'remate') return true; // pose del REMATE: la suelta el golpe (swing)
    if (this.state === 'dive') return !this.recovering || !(this.moving || this.charging); // la recuperaciÃ³n se puede cortar
    if (this.state === 'emote') return !(this.moving || this.charging); // moverse corta la reacciÃ³n
    if (this.state === 'inferno') {
      if (performance.now() - this.infernoSince < INFERNO_HOLD_MAX_MS) return true; // lo controla INFERNO (infernoRelease)
      this.state = 'idle'; // red de seguridad: la cinemÃ¡tica no llegÃ³ a golpear
      return false;
    }
    return this.state === 'serve' || this.state === 'victory';
  }

  /** Elige el estado "de reposo" que corresponde a las banderas actuales. */
  private refresh() {
    if (this.busy()) return;
    const wantHold = (this.charging || this.ready) && !this.moving;
    if (this.moving && !this.charging) {
      if (this.state !== 'run') {
        this.runStartAt = this.scene.time.now; // arranca caminando (WALK_MS) y luego corre
        this.enter('run');
        // pasar a la carrera al cumplirse el tiempo (setMoving no se llama en cada fotograma)
        this.walkTimer?.remove();
        this.walkTimer = this.scene.time.delayedCall(WALK_MS + 10, () => {
          if (this.state === 'run' && this.sprite.anims.currentAnim?.key === this.xk('walk')) this.enter('run');
        });
      }
    } else if (wantHold) {
      if (this.state !== 'hold') this.enterHold();
    } else if (this.state === 'run') {
      // con inercia, la frenada animada solo tras soltar corriendo rÃ¡pido; un paso corto para en reposo
      // (hojas nuevas: la frenada estÃ¡ dibujada corriendo a la derecha; hacia la izquierda se para en reposo)
      const stop = this.legacyMove || this.skidArmed;
      this.enter(stop ? 'runstop' : 'idle');
    } else if (this.state === 'hold' || this.state === 'dive' || this.state === 'emote') {
      this.enter('idle');
    }
    // en la recuperaciÃ³n del golpe: si no hay nada que hacer, se deja terminar el clip
  }

  private enter(s: 'idle' | 'run' | 'runstop') {
    if (this.state === 'hold') this.lastHoldAt = this.scene.time.now;
    this.stopShake();
    this.stopLean();
    this.state = s;
    this.sprite.anims.timeScale = 1;
    if (!this.legacyMove) {
      if (s === 'run') this.sprite.anims.timeScale = runAnimRate(this.speedK);
      if (s === 'runstop') this.sprite.anims.timeScale = 1.3; // la parada real dura ~50 ms: frenada mÃ¡s viva
    }
    this.skidArmed = false;
    // solo la carrera (y su frenada) se voltea segÃºn la direcciÃ³n; el reposo mira siempre igual (hojas nuevas: nunca)
    this.flip((s === 'run' || s === 'runstop') && this.runDir < 0);
    if (s === 'run') this.playClip(this.runKey());
    else if (s === 'idle' && this.serveIdle && this.v2 && this.P.bounce && this.xr('serve-bounce')) this.playClip(this.xk('serve-bounce'));
    else this.playClip(this.k(s));
  }

  /** instante en que empezÃ³ a moverse (para caminar al principio) */
  private runStartAt = 0;
  private walkTimer?: Phaser.Time.TimerEvent;

  /**
   * Clip de carrera. Hojas nuevas: los primeros WALK_MS de cada desplazamiento CAMINA (hoja 4, fila 3) y luego
   * corre; setMoving cambia de clip solo al pasar el tiempo (compara con runKey en cada fotograma).
   */
  private runKey() {
    if (this.v2 && this.xr('walk') && this.scene.time.now - this.runStartAt < WALK_MS) return this.xk('walk');
    return this.k('run');
  }

  private enterHold() {
    this.state = 'hold';
    this.sprite.setFlipX(false);
    this.sprite.anims.stop();
    const side = this.facing > 0 ? 'forehand' : 'backhand';
    // cargando: pose de carga de la fila de golpe cargado; con la pelota cerca (sin cargar): pose de espera del golpe normal
    const holdKey = this.clip(this.charging ? (side === 'forehand' ? 'forehand-power' : 'backhand-power') : side).key;
    this.fitTo(holdKey);
    this.sprite.setTexture(holdKey, this.holdOf(side, this.charging));
    if (this.charging) {
      // carga: anticipaciÃ³n marcada (cuerpo echado hacia atrÃ¡s y algo agachado) + temblor
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
   * hacia el otro lado con una cola que se afina y se desvanece. El tiro potente es mÃ¡s grueso y dorado.
   */
  private playSwoosh(power: boolean) {
    const H = CHAR_UNITS_H;
    const g = this.swoosh;
    const over = this.swingOverhead;
    // remate: arco vertical por encima de la cabeza; golpe normal: arco horizontal a la altura del pecho
    const rx = (over ? 0.38 : SWOOSH.rx) * H, ry = (over ? 0.48 : SWOOSH.ry) * H;
    const cy = (over ? -0.72 : SWOOSH.y) * H;
    const dir = this.facing;
    // Ã¡ngulos (rad): 0 = lado derecho, Ï€/2 = arriba. El normal va de un lado al otro por delante.
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
        const k = (i + 1) / N; // 0 en la cola â†’ 1 en la cabeza
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

  /** Quita la inclinaciÃ³n de la carga (vuelve a la escala uniforme del sprite). */
  private stopLean() {
    if (!this.lean) return;
    this.lean.remove();
    this.lean = undefined;
    this.sprite.setAngle(0);
    this.sprite.scaleY = this.sprite.scaleX;
  }

  private releaseServe() {
    this.serveReleased = true;
    this.sprite.anims.timeScale = 1; // del brazo arriba al contacto a ritmo normal (serveContactDelay lo cuenta asÃ­)
    if (this.sprite.anims.isPaused) this.sprite.anims.resume();
  }

  private onFrame(f: Phaser.Animations.AnimationFrame) {
    const frame = Number(f.textureFrame);
    this.jumpAt(this.sprite.anims.currentAnim?.key, frame);
    // frenada del DASH: en guardia ya se puede mover; el Ãºltimo frame Ãºtil termina la frenada (el siguiente
    // del clip ya sale corriendo al otro lado y no se muestra)
    if (this.state === 'land') {
      if (!this.landDone && frame >= this.P.move.landExit) {
        this.landDone = true;
        this.refresh();
      }
      if (this.state === 'land' && frame >= this.P.move.landEnd) this.enter('idle');
      return;
    }
    // giro: al quedar orientado al nuevo lado, si sigue corriendo sale a la carrera (no espera al final)
    if (this.state === 'turn') {
      if (!this.turnDone && frame >= this.P.move.turnExit) {
        this.turnDone = true;
        this.refresh();
      }
      return;
    }
    // INFERNO recibido: desde el frame de la mano vacÃ­a, la raqueta sale volando
    if (this.state === 'stun') {
      if (this.looseAt >= 0 && frame >= this.looseAt) {
        this.looseAt = -1;
        this.throwLooseRacket();
      }
      return;
    }
    // saque: parar con el brazo arriba hasta que la pelota estÃ© a punto de caer al golpeo
    if (this.state === 'serve') {
      if (this.tossing) return; // el lanzamiento (hoja nueva) termina solo en su Ãºltima pose
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
      if (!this.swingInferno) this.playSwoosh(power);
      this.scene.time.delayedCall(power ? SWING.hitStopPowerMs : SWING.hitStopMs, () => {
        if (this.state !== 'swing') return;
        this.sprite.anims.timeScale = power ? SWING.followPower : SWING.follow;
        this.sprite.anims.resume();
      });
      return;
    }
    if (this.swingHitDone && frame >= Math.min(this.swingFrames - 1, this.swingImpact + SWING.followLock)) this.swingInterruptible = true;
    // recuperaciÃ³n: los dos Ãºltimos frames algo mÃ¡s lentos (no salta de golpe al reposo)
    if (frame >= this.swingFrames - 2) this.sprite.anims.timeScale = SWING.recover;
    // si el jugador ya se mueve o carga, sale de la recuperaciÃ³n sin esperar al final
    const wantsRun = this.moving && !this.charging;
    const wantsHold = this.charging && !this.moving;
    if (this.swingInterruptible && (wantsRun || wantsHold)) {
      this.state = 'idle';
      this.refresh();
    }
  }

  private onComplete(animKey: string) {
    if (this.state === 'victory') return; // se queda en la Ãºltima pose
    if (this.state === 'serve' && this.tossing) return; // lanzamiento: espera en la Ãºltima pose a serveRelease
    if (this.state === 'stun') return; // aturdido: lo suelta endBusy
    if (this.state === 'dive') {
      if (!this.recovering) {
        // tras la estirada, se levanta (recuperaciÃ³n del mismo lado)
        this.recovering = true;
        this.playClip(this.xk(this.diveSide > 0 ? 'recover-right' : 'recover-left'));
        this.sprite.anims.timeScale = 1.4;
        return;
      }
      this.state = 'idle';
      this.sprite.anims.timeScale = 1;
      this.refresh();
      if (this.state === 'idle') this.enter('idle');
      return;
    }
    if (this.state === 'emote') {
      this.state = 'idle';
      this.refresh();
      if (this.state === 'idle') this.enter('idle');
      return;
    }
    if (this.state === 'turn') this.turnDone = true;
    if (this.state === 'land') this.landDone = true;
    if (this.state === 'swing' || this.state === 'serve' || this.state === 'runstop' || this.state === 'turn' || this.state === 'land') {
      if (animKey === this.k('idle') || animKey === this.k('run')) return;
      this.state = 'idle'; // parte del reposo y deja que refresh decida
      this.sprite.anims.timeScale = 1;
      if (this.moving && !this.charging) this.enter('run');
      else if (this.charging || this.ready) this.enterHold();
      else this.enter('idle');
    }
  }
}




