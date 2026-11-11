import Phaser from 'phaser';
import type { BallState } from '../objects/Ball';
import { project } from '../view/projection';
import { INFERNO, INFERNO_CINE, shakeLevel } from '../logic/InfernoDrive';
import { type InfernoPower, infernoPowerOf } from '../domain/infernoPowers';
import type { CineProfile } from './SmashCinematic';

/**
 * Efectos de INFERNO DRIVE (procedurales, sin hojas de sprites nuevas):
 *   GhostTrail   4 siluetas del personaje en posiciones anteriores reales del desplazamiento
 *   InfernoFire  la pelota convertida en esfera de fuego (llamas animadas a su alrededor, SIN estela)
 *   infernoShake vibración de cámara de 250 ms que se reduce sola (solo la cámara del mundo)
 *   INFERNO_LOOK lo que cambia con el poder (sombras, cinemática de carga, golpe de la raqueta): infernoCine(poder)
 *   sonidos      carga de energía, desplazamiento e impacto (Web Audio, sin archivos)
 * Todo se anima con tiempo REAL (el partido puede estar congelado por la cinemática) y con objetos
 * creados UNA vez (no se crean gráficos nuevos en cada fotograma).
 */

// ---------------------------------------------------------------- texturas
function ensureRadial(scene: Phaser.Scene, key: string, size: number, stops: [number, number][]) {
  if (scene.textures.exists(key)) return;
  const t = scene.textures.createCanvas(key, size, size);
  if (!t) return;
  const ctx = t.getContext();
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [at, a] of stops) g.addColorStop(at, `rgba(255,255,255,${a})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  t.refresh();
}

/** Lengua de fuego: gota alargada (base redonda abajo, punta arriba) con degradado. */
function ensureTongue(scene: Phaser.Scene, key: string) {
  if (scene.textures.exists(key)) return;
  const w = 40;
  const h = 96;
  const t = scene.textures.createCanvas(key, w, h);
  if (!t) return;
  const ctx = t.getContext();
  ctx.beginPath();
  ctx.moveTo(w / 2, 2);
  ctx.bezierCurveTo(w * 0.95, h * 0.45, w, h * 0.78, w / 2, h - 2);
  ctx.bezierCurveTo(0, h * 0.78, w * 0.05, h * 0.45, w / 2, 2);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, h, 0, 0);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.85)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fill();
  t.refresh();
}

const GLOW = 'fx-inferno-glow';
const TONGUE = 'fx-inferno-tongue';

/**
 * Bola de fuego animada (public/assets/inferno-ball.png): 8 frames en 4×2 celdas de 192 px, sacados de
 * inferno-1.png con cada frame recentrado en su bola (el centro de la celda = centro de la pelota) y
 * reducidos para móvil. Si la imagen falta se usa la bola dibujada por código (nunca las dos).
 */
export const FIREBALL_ART = { key: 'inferno-ball', file: 'assets/inferno-ball.png', cell: 192, frames: 9, fps: 14, anim: 'inferno-ball-spin', fill: 0.6 }; // 9 frames (hoja de 5 columnas, tools/build-inferno-ball.mjs); fill = parte de la celda que ocupa el cuerpo de la bola

/**
 * BOLA DE HIELO (INFERNO de Mai, public/assets/inferno-ball-ice.png): misma rejilla, frames y ritmo que la de fuego
 * (tools/build-ice-ball.mjs). Su remolino ocupa ~88 % de la celda; con fill 0,7 se ve de un tamaño parecido a la
 * bola de fuego (cuyas llamas sobresalen más de su cuerpo).
 */
export const ICEBALL_ART = { key: 'inferno-ball-ice', file: 'assets/inferno-ball-ice.png', cell: 192, frames: 9, fps: 14, anim: 'inferno-ball-ice-spin', fill: 0.7 };

/** Bolas de VIENTO y RAYO (tools/build-power-ball.mjs): 10 frames (5 + 5), mismo ritmo; fill con el mismo criterio que el hielo. */
const WINDBALL_ART = { key: 'inferno-ball-wind', file: 'assets/inferno-ball-wind.png', cell: 192, frames: 10, fps: 14, anim: 'inferno-ball-wind-spin', fill: 0.67 };
const LIGHTNINGBALL_ART = { key: 'inferno-ball-lightning', file: 'assets/inferno-ball-lightning.png', cell: 192, frames: 10, fps: 14, anim: 'inferno-ball-lightning-spin', fill: 0.64 };

/**
 * Hoja de una bola. Las cuadradas (fuego, hielo, viento, rayo) usan solo key…fill. Las bolas CON RASTRO (tulipán) añaden:
 *   cellH   alto de la celda (la celda no es cuadrada); `fill` es entonces la parte del ALTO que ocupa el cuerpo
 *   seq     frames que recorre la animación (si no, 0..frames-1)
 *   rot     giro extra del dibujo (rad): su cola no está arriba como en las demás
 *   origin  ancla del dibujo [x, y] (fracción de la celda) = donde va la pelota (la cabeza de la estela)
 *   trail   hoja del rastro: misma rejilla y ancla; se pinta DETRÁS de la bola en el mismo frame
 *   ghosts  false = sin la estela de siluetas por código (el rastro ya la dibuja)
 */
export interface BallArt {
  key: string;
  file: string;
  cell: number;
  frames: number;
  fps: number;
  anim: string;
  fill: number;
  cellH?: number;
  seq?: number[];
  rot?: number;
  origin?: [number, number];
  trail?: { key: string; file: string };
  ghosts?: boolean;
}

/**
 * Bola de TULIPÁN (tools/build-trail-ball.mjs, fuentes en art/inferno/): estela horizontal de pétalos con la cabeza a la
 * derecha (por eso `rot` = +90°: su cola queda contra el avance como la de las demás) y su RASTRO detrás. La animación
 * recorre en vaivén los frames de su máximo (4-7): los primeros y los últimos son el nacer y el disiparse, y en vuelo la
 * bola no debe desaparecer.
 */
const TULIPBALL_ART: BallArt = {
  key: 'inferno-ball-tulip',
  file: 'assets/inferno-ball-tulip.png',
  cell: 384,
  cellH: 174,
  frames: 10,
  fps: 12,
  anim: 'inferno-ball-tulip-spin',
  fill: 0.45,
  seq: [3, 4, 5, 6, 5, 4],
  rot: Math.PI / 2,
  origin: [0.852, 0.557],
  trail: { key: 'inferno-ball-tulip-trail', file: 'assets/inferno-ball-tulip-trail.png' },
  ghosts: false,
};

/** Elemento de la bola del INFERNO = el poder que eligió el jugador (domain/infernoPowers.ts). */
export type InfernoElement = InfernoPower;
export const BALL_ART: Record<InfernoElement, BallArt> = { fire: FIREBALL_ART, ice: ICEBALL_ART, wind: WINDBALL_ART, lightning: LIGHTNINGBALL_ART, tulip: TULIPBALL_ART };

/** Tamaño en pantalla [ancho, alto] de una bola de alto `h` (las cuadradas, h × h). */
export function ballDims(art: BallArt, h: number): [number, number] {
  return [art.cellH ? (h * art.cell) / art.cellH : h, h];
}

/**
 * Vista previa de la bola de un poder (Tienda, PERSONAJE): su rastro detrás (si tiene) y la bola, centradas en (x, y) y
 * dentro de maxW × maxH, sin giro. Con `animate` corre su animación (el rastro sigue el mismo frame). Sin hoja cargada, un
 * círculo de `color`.
 */
export function addBallPreview(scene: Phaser.Scene, x: number, y: number, el: InfernoElement, maxW: number, maxH: number, animate: boolean, color: number) {
  const art = BALL_ART[el];
  const c = scene.add.container(x, y);
  if (!scene.textures.exists(art.key)) {
    c.add(scene.add.circle(0, 0, Math.min(maxW, maxH) * 0.3, color, 1));
    return c;
  }
  const [aw, ah] = ballDims(art, 1);
  const k = Math.min(maxW / aw, maxH / ah);
  const first = art.seq?.[0] ?? 0;
  const trail = art.trail && scene.textures.exists(art.trail.key) ? scene.add.sprite(0, 0, art.trail.key, first).setDisplaySize(aw * k, ah * k) : undefined;
  const ball = scene.add.sprite(0, 0, art.key, first).setDisplaySize(aw * k, ah * k);
  if (trail) c.add(trail);
  c.add(ball);
  if (animate && scene.anims.exists(art.anim)) {
    if (trail) ball.on(Phaser.Animations.Events.ANIMATION_UPDATE, (_a: unknown, f: Phaser.Animations.AnimationFrame) => trail.active && trail.setFrame(f.textureFrame));
    ball.play(art.anim);
  }
  return c;
}
/**
 * Elemento de la bola de un jugador: el poder que eligió (`chosen`, p. ej. el que llega por red) o, si no hay, el de
 * su personaje (Mai = hielo; el resto = fuego).
 */
export function infernoElementFor(skin: string | undefined, chosen?: unknown): InfernoElement {
  return infernoPowerOf(chosen, skin);
}

/**
 * Lo que cambia con el poder del INFERNO además de la bola (BALL_FX) y de las explosiones (fx/ImpactFx.ts):
 *   ghostTint  tinte de las 4 sombras del desplazamiento (fuego); `ghostRamp` [oscuro, claro]: sombras de un solo tono
 *              (GhostTrail.setLook)
 *   cine       cinemática de carga (fx/SmashCinematic.ts): aura, energía que llega al personaje, brillo de la raqueta y
 *              destello del golpe. El hielo trae su propia forma: esquirlas con escarcha y cristales.
 *   hit        golpe de la raqueta con la pelota (MatchScene.hitFx): anillo, chispas en estrella y destello de cámara (RGB)
 * El fuego conserva los valores de siempre. Viento y rayo, de momento, las formas del fuego con sus colores.
 */
export interface InfernoLook {
  ghostTint: number;
  ghostRamp?: [number, number];
  cine: Pick<CineProfile, 'colors' | 'aura' | 'rayStyle' | 'flashTint'>;
  hit: { ring: number; star: number; flash: [number, number, number] };
}
export const INFERNO_LOOK: Record<InfernoElement, InfernoLook> = {
  fire: {
    ghostTint: INFERNO.dash.tint,
    cine: { colors: INFERNO_CINE.colors, aura: INFERNO_CINE.aura },
    hit: { ring: 0xff8a1e, star: 0xffd23f, flash: [255, 200, 120] },
  },
  ice: {
    ghostTint: 0x7fd4ff,
    ghostRamp: [0x0a38a8, 0xa6ecff],
    cine: {
      colors: { core: 0xe6fbff, gold: 0x9fe2ff, hot: 0x2f8cff, cyan: 0x4aa8ff },
      aura: [
        [1.3, 0x1f6bff, 0.22],
        [1.08, 0x3a9bff, 0.24],
        [0.86, 0x9fe6ff, 0.22],
      ],
      rayStyle: 'ice',
      flashTint: 0xeafcff,
    },
    hit: { ring: 0x8fdcff, star: 0xeafcff, flash: [170, 225, 255] },
  },
  wind: {
    ghostTint: 0x6fe0a0,
    ghostRamp: [0x0a7a44, 0xb4ffd2],
    cine: {
      colors: { core: 0xeaffe0, gold: 0x9cf0b0, hot: 0x2fbf6a, cyan: 0x5fd68a },
      aura: [
        [1.3, 0x1f9f5a, 0.22],
        [1.08, 0x3fd68a, 0.24],
        [0.86, 0xb8ffcc, 0.22],
      ],
      flashTint: 0xf0fff0,
    },
    hit: { ring: 0x5fd68a, star: 0xd0ffe0, flash: [180, 255, 200] },
  },
  lightning: {
    ghostTint: 0xffe36b,
    ghostRamp: [0x9a7400, 0xfff59a],
    cine: {
      colors: { core: 0xfffbe0, gold: 0xfff36b, hot: 0x2f6bff, cyan: 0x5aa8ff },
      aura: [
        [1.3, 0x2f6bff, 0.22],
        [1.08, 0x5aa8ff, 0.24],
        [0.86, 0xfff36b, 0.22],
      ],
      flashTint: 0xfffbe0,
    },
    hit: { ring: 0xfff36b, star: 0xfffbe0, flash: [255, 245, 170] },
  },
  tulip: {
    ghostTint: 0xff9fcf,
    ghostRamp: [0x8a1f55, 0xffd0e6],
    cine: {
      colors: { core: 0xfff0f7, gold: 0xffb3d6, hot: 0xe0457f, cyan: 0xff8fc4 },
      aura: [
        [1.3, 0xe0457f, 0.22],
        [1.08, 0xff8fc4, 0.24],
        [0.86, 0xffd0e6, 0.22],
      ],
      flashTint: 0xfff0f7,
    },
    hit: { ring: 0xff8fc4, star: 0xfff0f7, flash: [255, 190, 220] },
  },
};

const CINES: Partial<Record<InfernoElement, CineProfile>> = { fire: INFERNO_CINE };
/** Perfil de la cinemática del INFERNO para un poder: los tiempos de INFERNO_CINE con su aspecto (fuego = INFERNO_CINE). */
export function infernoCine(el: InfernoElement): CineProfile {
  let p = CINES[el];
  if (!p) {
    p = { ...INFERNO_CINE, ...INFERNO_LOOK[el].cine };
    CINES[el] = p;
  }
  return p;
}

/** Crea (una vez) la animación de cada bola cargada: la usan el partido y la vista previa de PERSONALIZACIÓN. */
export function ensureBallAnims(scene: Phaser.Scene) {
  for (const a of Object.values(BALL_ART)) {
    if (scene.textures.exists(a.key) && !scene.anims.exists(a.anim)) {
      const frames = scene.anims.generateFrameNumbers(a.key, a.seq ? { frames: a.seq } : { start: 0, end: a.frames - 1 });
      scene.anims.create({ key: a.anim, frames, frameRate: a.fps, repeat: -1 });
    }
  }
}

/** Encola las hojas de las bolas (y de sus rastros) que aún no están cargadas. */
export function queueInfernoArt(load: Phaser.Loader.LoaderPlugin) {
  for (const art of Object.values(BALL_ART)) {
    const size = { frameWidth: art.cell, frameHeight: art.cellH ?? art.cell };
    if (!load.scene.textures.exists(art.key)) load.spritesheet(art.key, art.file, size);
    if (art.trail && !load.scene.textures.exists(art.trail.key)) load.spritesheet(art.trail.key, art.trail.file, size);
  }
}

// ---------------------------------------------------------------- sombras
/**
 * Matriz de color (Phaser.Display.ColorMatrix: 4 filas de 5, desplazamientos en 0-255) que pasa la luminosidad del
 * dibujo a un degradado de `dark` (zonas oscuras) a `light` (zonas claras), conservando el alfa.
 */
function rampMatrix(dark: number, light: number): number[] {
  const row = (shift: number) => {
    const d = (dark >> shift) & 0xff;
    const k = (((light >> shift) & 0xff) - d) / 255;
    return [0.299 * k, 0.587 * k, 0.114 * k, 0, d];
  };
  return [...row(16), ...row(8), ...row(0), 0, 0, 0, 1, 0];
}

/** Retardo entre sombras (ms): cada una muestra dónde estaba el personaje hace k × LAG. */
const GHOST_LAG_MS = 45;
const GHOST_FADE_MS = 320;

interface Snap {
  t: number;
  x: number;
  y: number;
  sx: number;
  sy: number;
  rot: number;
  key: string;
  frame: string | number;
  flip: boolean;
  ox: number;
  oy: number;
}

/**
 * Cuatro siluetas reutilizadas (creadas una vez). Durante el desplazamiento se graba la posición real
 * del sprite en cada fotograma y la sombra k se coloca donde estaba el personaje hace (k+1) × LAG.
 * La más antigua, la más transparente. Al terminar se desvanecen.
 */
export class GhostTrail {
  private imgs: Phaser.GameObjects.Image[] = [];
  private hist: Snap[] = [];
  private fadeFrom = 0;
  private active = false;
  private lag = GHOST_LAG_MS;

  constructor(scene: Phaser.Scene) {
    for (let i = 0; i < INFERNO.dash.ghosts; i++) this.imgs.push(scene.add.image(0, 0, '__DEFAULT').setVisible(false).setTint(INFERNO.dash.tint));
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.tick, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.tick, this));
  }

  /**
   * Color de las sombras según el poder del INFERNO (INFERNO_LOOK). Sin `ramp` (fuego): el tinte multiplica los
   * colores del dibujo, como siempre. Con `ramp` [oscuro, claro] (hielo, viento, rayo): el dibujo pasa a un solo tono
   * según su luminosidad (ColorMatrix de WebGL), para que sus colores (p. ej. el rosa de Mai) no se mezclen con el
   * tinte y salgan de otro color. Sin efectos de WebGL (Canvas), el tinte.
   */
  setLook(tint: number, ramp?: [number, number]) {
    for (const o of this.imgs) {
      if (o.preFX?.list.length) {
        o.preFX.clear();
        o.resetPipeline();
      }
      if (ramp && o.preFX) {
        o.setTint(0xffffff);
        o.preFX.addColorMatrix().set(rampMatrix(ramp[0], ramp[1]));
      } else o.setTint(tint);
    }
  }

  /**
   * Empieza el desplazamiento. `moveMs`: lo que dura el recorrido; el retardo entre sombras es
   * moveMs / (sombras + 1), así al llegar quedan repartidas por todo el camino recorrido.
   */
  begin(moveMs = GHOST_LAG_MS * (INFERNO.dash.ghosts + 1)) {
    this.lag = moveMs / (INFERNO.dash.ghosts + 1);
    this.hist = [];
    this.fadeFrom = 0;
    this.active = true;
    this.imgs.forEach((o) => o.setVisible(false).setAlpha(1));
  }

  /** Graba la posición real actual del sprite y recoloca las sombras (llamar cada fotograma del desplazamiento). */
  record(sprite: Phaser.GameObjects.Sprite | undefined, depth: number) {
    if (!this.active || !sprite || !sprite.frame) return;
    const m = sprite.getWorldTransformMatrix();
    const now = performance.now();
    this.hist.push({ t: now, x: m.tx, y: m.ty, sx: m.scaleX, sy: m.scaleY, rot: m.rotation, key: sprite.texture.key, frame: sprite.frame.name, flip: sprite.flipX, ox: sprite.originX, oy: sprite.originY });
    if (this.hist.length > 120) this.hist.shift();
    const n = this.imgs.length;
    for (let k = 0; k < n; k++) {
      const snap = this.at(now - (k + 1) * this.lag);
      const o = this.imgs[k];
      if (!snap || Math.hypot(snap.x - m.tx, snap.y - m.ty) < 2) {
        o.setVisible(false);
        continue;
      }
      // k = 0 la más reciente (más visible) … k = n-1 la más antigua (más transparente)
      o.setTexture(snap.key, snap.frame)
        .setOrigin(snap.ox, snap.oy)
        .setPosition(snap.x, snap.y)
        .setScale(snap.sx, snap.sy)
        .setRotation(snap.rot)
        .setFlipX(snap.flip)
        .setAlpha(INFERNO.dash.ghostAlpha[n - 1 - k] ?? 0.3)
        // profundidad según la pantalla: si la sombra quedó MÁS CERCA de la cámara que el personaje (el jugador
        // avanza hacia la red), va DELANTE de él, la más antigua la primera: sombra 4, 3, 2, 1 y luego el cuerpo.
        // Si quedó detrás (el rival avanza hacia la cámara), va detrás como siempre.
        .setDepth(snap.y > m.ty ? depth + 0.02 + k * 0.01 : depth - 0.1 - k * 0.01)
        .setVisible(true);
    }
  }

  /** Fin del desplazamiento: se quedan donde estaban y se desvanecen suavemente. */
  end() {
    if (!this.active) return;
    this.active = false;
    this.fadeFrom = performance.now();
    this.imgs.forEach((o) => o.setData('a0', o.alpha));
  }

  get count() {
    return this.imgs.filter((o) => o.visible).length;
  }

  private at(t: number): Snap | undefined {
    // la instantánea más reciente con tiempo <= t
    for (let i = this.hist.length - 1; i >= 0; i--) if (this.hist[i].t <= t) return this.hist[i];
    return undefined;
  }

  private tick() {
    if (!this.fadeFrom) return;
    const q = (performance.now() - this.fadeFrom) / GHOST_FADE_MS;
    if (q >= 1) {
      this.fadeFrom = 0;
      this.imgs.forEach((o) => o.setVisible(false));
      return;
    }
    this.imgs.forEach((o) => o.visible && o.setAlpha((o.getData('a0') as number) * (1 - q)));
  }

  clear() {
    this.active = false;
    this.fadeFrom = 0;
    this.imgs.forEach((o) => o.setVisible(false));
  }
}

// ---------------------------------------------------------------- pelota de fuego
/** la esfera de fuego mide esto × la pelota (radio de la pelota en pantalla = 12 × escala) */
export const FIREBALL_SCALE = 3;
const TONGUES = 14;
/** estela de siluetas de la bola de fuego (hoja de sprites), brasas que salen por detras y su ritmo */
const TRAIL = 6;
const TRAIL_STEP = 0.042; // s entre siluetas
const EMBERS = 24;
const EMBER_RATE = 80; // brasas por segundo
interface Ember {
  o: Phaser.GameObjects.Image;
  life: number;
  max: number;
  vx: number;
  vy: number;
  s: number;
}
interface Hist {
  t: number;
  x: number;
  y: number;
  a: number;
  size: number;
}
const TONGUE_COLS = [0xff2a0a, 0xff6a12, 0xffa21a, 0xffd23a];
/**
 * Colores de lo que acompaña a la bola (con hoja de sprites) según su elemento: halo, núcleo, estela, partículas que
 * salen por detrás (`rise` = cuánto suben: el calor sube las brasas; la escarcha cae un poco) y destello del contacto.
 */
const BALL_FX: Record<InfernoElement, { halo: number; core: number; trail: [number, number]; bits: [number, number]; rise: number; glow: [number, number]; sparks: number[] }> = {
  fire: { halo: 0xff4a10, core: 0xfff1c0, trail: [0xffb347, 0xff5a1a], bits: [0xffd23a, 0xff6a12], rise: 0.8, glow: [0xfff1c8, 0xff7a1a], sparks: [0xfff2a0, 0xffa31a, 0xff3d1a] },
  ice: { halo: 0x2f8cff, core: 0xe6fbff, trail: [0xbff0ff, 0x4aa8ff], bits: [0xe6fbff, 0x8fdcff], rise: -0.15, glow: [0xeafcff, 0x3a9bff], sparks: [0xffffff, 0xbff0ff, 0x4aa8ff] },
  // viento: hojas verdes que flotan un poco
  wind: { halo: 0x2fd68a, core: 0xeaffe0, trail: [0xd0ffe0, 0x3fd68a], bits: [0x9cf06a, 0x5fd16f], rise: 0.35, glow: [0xf0fff0, 0x3fd68a], sparks: [0xffffff, 0xb8ff9a, 0x5fd16f] },
  // rayo: chispas eléctricas amarillas y azules que saltan sin subir
  lightning: { halo: 0x2f6bff, core: 0xfffbe0, trail: [0xbfe0ff, 0x3a7bff], bits: [0xfff36b, 0x7fc8ff], rise: 0, glow: [0xfffbe0, 0x3a7bff], sparks: [0xffffff, 0xfff36b, 0x5aa8ff] },
  // tulipán: pétalos rosados que caen despacio detrás de la estela
  tulip: { halo: 0xff5fa8, core: 0xfff0f7, trail: [0xffd0e6, 0xff8fc4], bits: [0xff9fcf, 0xffd0e6], rise: -0.1, glow: [0xfff0f7, 0xff8fc4], sparks: [0xffffff, 0xffb3d6, 0xff6fae] },
};

/**
 * La pelota convertida en una esfera de fuego: halo, cuerpo y núcleo luminoso + lenguas de fuego que
 * giran y laten alrededor. TODO se coloca cada fotograma en la posición de la pelota: no queda nada
 * en el aire (sin estela ni partículas). Objetos creados una vez.
 */
export class InfernoFire {
  private t = 0;
  private last = performance.now();
  private body: Phaser.GameObjects.Image[];
  private tongues: Phaser.GameObjects.Image[] = [];
  /** bola de fuego animada (hoja de sprites); si existe sustituye a la dibujada por código */
  private art?: Phaser.GameObjects.Sprite;
  /** efectos programados de la bola de fuego (solo con la hoja de sprites) */
  private ang = 0;
  private angInit = false;
  private hist: Hist[] = [];
  private trail: Phaser.GameObjects.Image[] = [];
  private artHalo?: Phaser.GameObjects.Image;
  private artCore?: Phaser.GameObjects.Image;
  /** rastro de las bolas que lo traen (BallArt.trail): detrás de la bola, mismo frame, posición y giro */
  private rastro?: Phaser.GameObjects.Sprite;
  private embers: Ember[] = [];
  private emberAcc = 0;
  /** elemento de la bola en vuelo (setElement): cambia la hoja de sprites y los colores de sus efectos */
  private el: InfernoElement = 'fire';

  constructor(private readonly scene: Phaser.Scene) {
    ensureBallAnims(scene); // animación de cada bola con hoja cargada (fuego, hielo, viento, rayo)
    if (scene.textures.exists(FIREBALL_ART.key)) this.art = scene.add.sprite(0, 0, FIREBALL_ART.key, 0).setVisible(false);
    ensureRadial(scene, GLOW, 64, [
      [0, 1],
      [0.35, 0.85],
      [0.7, 0.3],
      [1, 0],
    ]);
    ensureTongue(scene, TONGUE);
    if (this.art) {
      const add = Phaser.BlendModes.ADD;
      for (let i = 0; i < TRAIL; i++) this.trail.push(scene.add.image(0, 0, FIREBALL_ART.key, 0).setBlendMode(add).setVisible(false));
      this.artHalo = scene.add.image(0, 0, GLOW).setTint(BALL_FX.fire.halo).setBlendMode(add).setVisible(false);
      this.artCore = scene.add.image(0, 0, GLOW).setTint(BALL_FX.fire.core).setBlendMode(add).setVisible(false);
      for (let i = 0; i < EMBERS; i++) this.embers.push({ o: scene.add.image(0, 0, GLOW).setTint(0xffa21a).setBlendMode(add).setVisible(false), life: 0, max: 1, vx: 0, vy: 0, s: 1 });
    }
    this.body = [
      scene.add.image(0, 0, GLOW).setTint(0xff3a0a).setAlpha(0.55).setBlendMode(Phaser.BlendModes.ADD), // halo
      scene.add.image(0, 0, GLOW).setTint(0xff5a12).setAlpha(0.98), // cuerpo (sólido)
      scene.add.image(0, 0, GLOW).setTint(0xffb02a).setBlendMode(Phaser.BlendModes.ADD), // fuego interior
      scene.add.image(0, 0, GLOW).setTint(0xfff6c8).setBlendMode(Phaser.BlendModes.ADD), // núcleo
    ];
    for (let i = 0; i < TONGUES; i++) this.tongues.push(scene.add.image(0, 0, TONGUE).setOrigin(0.5, 0.9).setTint(TONGUE_COLS[i % TONGUE_COLS.length]).setBlendMode(Phaser.BlendModes.ADD));
    this.hide();
  }

  /**
   * Elemento de la bola que se va a lanzar (llamar al empezar su vuelo): el hielo usa su hoja y colores fríos.
   * Si la hoja de ese elemento no cargó, sigue la de fuego.
   */
  setElement(el: InfernoElement) {
    const want: InfernoElement = this.scene.textures.exists(BALL_ART[el].key) ? el : 'fire';
    if (want === this.el) return;
    this.hide(); // la bola anterior ya terminó: la nueva empieza su animación desde cero
    this.el = want;
    if (!this.art) return;
    const ART = BALL_ART[want];
    const [ox, oy] = ART.origin ?? [0.5, 0.5];
    this.art.setTexture(ART.key, 0).setOrigin(ox, oy);
    this.trail.forEach((g) => g.setTexture(ART.key, 0).setOrigin(ox, oy));
    this.artHalo?.setTint(BALL_FX[want].halo);
    this.artCore?.setTint(BALL_FX[want].core);
    if (ART.trail && this.scene.textures.exists(ART.trail.key)) {
      this.rastro ??= this.scene.add.sprite(0, 0, ART.trail.key, 0).setVisible(false);
      this.rastro.setTexture(ART.trail.key, 0).setOrigin(ox, oy);
    }
  }

  /** Cada fotograma: `on` = la pelota vuela como INFERNO DRIVE. */
  update(ball: BallState, on: boolean, visible: boolean) {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (!on || !visible) return this.hide();
    this.t += dt;
    const ground = project(ball.x, ball.y, 0);
    const air = project(ball.x, ball.y, ball.z);
    const k = air.s * 0.8 * (1 + Math.min(ball.z, 220) / 700);
    const R = FIREBALL_SCALE * 12 * k;
    const d = ground.sy + 2.5; // por encima de la pelota real
    if (this.art) {
      this.updateArt(ball, air, R, d, dt);
      return;
    }
    const pulse = 1 + Math.sin(this.t * 31) * 0.05 + Math.sin(this.t * 17) * 0.04;
    const [halo, body, inner, core] = this.body;
    halo.setPosition(air.sx, air.sy).setDisplaySize(R * 3.1 * pulse, R * 3.1 * pulse).setDepth(d).setVisible(true);
    // lenguas de fuego alrededor de toda la esfera: giran y laten (cada una a su ritmo)
    const spin = this.t * 2.6;
    for (let i = 0; i < TONGUES; i++) {
      const o = this.tongues[i];
      const a = spin + (i / TONGUES) * Math.PI * 2;
      const flick = 0.75 + 0.35 * Math.sin(this.t * (9 + (i % 5) * 2.3) + i * 1.7);
      const len = R * (0.95 + 0.5 * flick);
      const r0 = R * 0.62;
      o.setPosition(air.sx + Math.cos(a) * r0, air.sy + Math.sin(a) * r0)
        .setRotation(a + Math.PI / 2)
        .setDisplaySize(R * 0.62, len)
        .setAlpha(0.6 + 0.35 * flick)
        .setDepth(d + 0.005 + (i % 2) * 0.002)
        .setVisible(true);
    }
    body.setPosition(air.sx, air.sy).setDisplaySize(R * 2.05 * pulse, R * 2.05 * pulse).setDepth(d + 0.01).setVisible(true);
    inner.setPosition(air.sx, air.sy).setDisplaySize(R * 1.6, R * 1.6).setDepth(d + 0.011).setVisible(true);
    core.setPosition(air.sx, air.sy).setDisplaySize(R * (0.95 + 0.08 * Math.sin(this.t * 45)), R * (0.95 + 0.08 * Math.sin(this.t * 45))).setDepth(d + 0.012).setVisible(true);
  }

  /**
   * Bola de fuego con la hoja de sprites. El dibujo tiene la lengua de fuego ARRIBA: se gira para que la cola vaya
   * siempre DETRAS (contra el avance en pantalla). Efectos por codigo: halo que late, nucleo caliente, estela de
   * siluetas (cometa) y brasas que salen por detras.
   */
  private updateArt(ball: BallState, air: { sx: number; sy: number }, R: number, d: number, dt: number) {
    const art = this.art!;
    // direccion del avance en pantalla (la velocidad de la pelota proyectada un instante despues)
    const nx = project(ball.x + ball.vx * 0.04, ball.y + ball.vy * 0.04, ball.z + ball.vz * 0.04);
    const vx = nx.sx - air.sx, vy = nx.sy - air.sy;
    const sp = Math.hypot(vx, vy);
    if (sp > 0.05) {
      const target = Math.atan2(-vx, vy); // la punta del dibujo (arriba) apunta contra el avance
      if (!this.angInit) {
        this.ang = target;
        this.angInit = true;
      } else {
        const df = Math.atan2(Math.sin(target - this.ang), Math.cos(target - this.ang));
        this.ang += df * (1 - Math.exp(-dt * 16));
      }
    }
    const bx = sp > 0.05 ? -vx / sp : 0, by = sp > 0.05 ? -vy / sp : 1; // hacia atras
    const pulse = 1 + 0.05 * Math.sin(this.t * 26) + 0.03 * Math.sin(this.t * 13);
    const ART = BALL_ART[this.el];
    const P = BALL_FX[this.el];
    const size = ((R * 2) / ART.fill) * pulse;
    const [dw, dh] = ballDims(ART, size);
    const rot = ART.rot ?? 0;
    // halo y núcleo: del tamaño de una bola cuadrada (en las alargadas `size` es el alto de toda la estela)
    const glow = ART.cellH ? ((R * 2) / 0.6) * pulse : size;
    const first = !art.visible;
    if (first) art.play(ART.anim, true);
    // halo grande que late
    this.artHalo!.setPosition(air.sx, air.sy).setDisplaySize(glow * 1.9, glow * 1.9).setAlpha(0.5 + 0.2 * Math.sin(this.t * 21)).setDepth(d - 0.02).setVisible(true);
    // estela: siluetas de posiciones anteriores, cada vez mas chicas y tenues
    const now = performance.now() / 1000;
    this.hist.push({ t: now, x: air.sx, y: air.sy, a: this.ang, size });
    while (this.hist.length > 2 && now - this.hist[0].t > TRAIL * TRAIL_STEP + 0.2) this.hist.shift();
    const frame = art.frame.name;
    for (let i = 0; i < TRAIL; i++) {
      const g = this.trail[i];
      if (ART.ghosts === false) {
        g.setVisible(false);
        continue;
      }
      const want = now - (i + 1) * TRAIL_STEP;
      let h: Hist | undefined;
      for (let j = this.hist.length - 1; j >= 0; j--) {
        if (this.hist[j].t <= want) {
          h = this.hist[j];
          break;
        }
      }
      if (!h || Math.hypot(h.x - air.sx, h.y - air.sy) < 1.5) {
        g.setVisible(false);
        continue;
      }
      const f = 1 - (i + 1) / (TRAIL + 1);
      const [gw, gh] = ballDims(ART, h.size * (0.55 + 0.4 * f));
      g.setFrame(frame).setPosition(h.x, h.y).setRotation(h.a + rot).setDisplaySize(gw, gh).setAlpha(0.5 * f).setTint(i < 2 ? P.trail[0] : P.trail[1]).setDepth(d - 0.01).setVisible(true);
    }
    // el rastro (si la bola lo trae): detrás de la bola, en su mismo frame, sitio y giro
    if (ART.trail && this.rastro) {
      this.rastro.setFrame(frame).setPosition(air.sx, air.sy).setRotation(this.ang + rot).setDisplaySize(dw, dh).setDepth(d - 0.005).setVisible(true);
    }
    // la bola
    art.setPosition(air.sx, air.sy).setRotation(this.ang + rot).setDisplaySize(dw, dh).setDepth(d).setVisible(true);
    // nucleo caliente encima (parpadea)
    this.artCore!.setPosition(air.sx, air.sy).setDisplaySize(glow * 0.42, glow * 0.42).setAlpha(0.55 + 0.3 * Math.sin(this.t * 38)).setDepth(d + 0.01).setVisible(true);
    // brasas que salen por detras
    this.emberAcc += dt * EMBER_RATE;
    while (this.emberAcc >= 1) {
      this.emberAcc -= 1;
      const e = this.embers.find((q) => q.life <= 0);
      if (!e) break;
      const side = (Math.random() - 0.5) * R * 1.1;
      const px = air.sx + bx * R * (0.3 + Math.random() * 0.5) - by * side;
      const py = air.sy + by * R * (0.3 + Math.random() * 0.5) + bx * side;
      const spd = R * (2.2 + Math.random() * 3.2);
      e.max = e.life = 0.3 + Math.random() * 0.3;
      e.vx = bx * spd + (Math.random() - 0.5) * R * 1.2;
      e.vy = by * spd + (Math.random() - 0.5) * R * 1.2 - R * P.rise; // fuego: el calor las sube; hielo: la escarcha cae un poco
      e.s = R * (0.14 + Math.random() * 0.22);
      e.o.setPosition(px, py).setTint(Math.random() < 0.5 ? P.bits[0] : P.bits[1]).setVisible(true);
    }
    for (const e of this.embers) {
      if (e.life <= 0) continue;
      e.life -= dt;
      if (e.life <= 0) {
        e.o.setVisible(false);
        continue;
      }
      const k = e.life / e.max;
      e.o.setPosition(e.o.x + e.vx * dt, e.o.y + e.vy * dt).setDisplaySize(e.s * (0.4 + k), e.s * (0.4 + k)).setAlpha(0.95 * k).setDepth(d + 0.005);
    }
  }

  private hide() {
    this.body.forEach((o) => o.setVisible(false));
    this.tongues.forEach((o) => o.setVisible(false));
    if (this.art?.visible) {
      this.art.stop().setVisible(false);
      this.trail.forEach((o) => o.setVisible(false));
      this.rastro?.setVisible(false);
      this.artHalo?.setVisible(false);
      this.artCore?.setVisible(false);
      this.embers.forEach((e) => {
        e.life = 0;
        e.o.setVisible(false);
      });
      this.hist.length = 0;
      this.angInit = false;
      this.emberAcc = 0;
    }
  }

  clear() {
    this.hide();
  }

  /** Objetos visibles (pruebas). */
  get visibleParts() {
    return this.body.filter((o) => o.visible).length + this.tongues.filter((o) => o.visible).length + (this.art?.visible ? 1 : 0);
  }
}

// ---------------------------------------------------------------- impacto, vibración y sonido
/**
 * Brillo de energía + chispas en el punto de contacto (mundo), con los colores del elemento de la bola. Con hielo, en
 * vez de chispas redondas: esquirlas y un copo de nieve (iceBurst).
 */
export function infernoImpactFx(scene: Phaser.Scene, x: number, y: number, k: number, el: InfernoElement = 'fire') {
  const P = BALL_FX[el];
  // brillo de energía suave (sin anillos ni contornos)
  ensureRadial(scene, GLOW, 64, [
    [0, 1],
    [0.35, 0.85],
    [0.7, 0.3],
    [1, 0],
  ]);
  for (const [col, size, delay] of [
    [P.glow[0], 110, 0],
    [P.glow[1], 150, 40],
  ] as const) {
    const glow = scene.add.image(x, y, GLOW).setTint(col).setDisplaySize(size * k, size * k).setDepth(3650).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: glow, scale: glow.scale * 2.2, alpha: 0, delay, duration: 320, ease: 'Cubic.easeOut', onComplete: () => glow.destroy() });
  }
  if (el === 'ice') {
    iceBurst(scene, x, y, k, P.sparks);
    return;
  }
  if (el === 'lightning') {
    zapBurst(scene, x, y, k);
    return;
  }
  if (el === 'wind') {
    leafBurst(scene, x, y, k);
    return;
  }
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const d = Phaser.Math.FloatBetween(60, 150) * Math.max(0.6, k);
    const sp = scene.add.circle(x, y, Phaser.Math.FloatBetween(3, 6), Phaser.Utils.Array.GetRandom(P.sparks), 1).setDepth(3651).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: sp, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.7, alpha: 0, scale: 0.3, duration: Phaser.Math.Between(320, 520), ease: 'Cubic.easeOut', onComplete: () => sp.destroy() });
  }
}

/**
 * Golpe de hielo en la raqueta: esquirlas (rombos alargados, sin círculos) que salen disparadas girando y un copo de
 * nieve de 6 brazos que se abre y se desvanece en el punto de contacto. Objetos de vida corta (~17).
 */
function iceBurst(scene: Phaser.Scene, x: number, y: number, k: number, cols: number[]) {
  const kk = Math.max(0.6, k);
  const ADD = Phaser.BlendModes.ADD;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.15, 0.15);
    const d = Phaser.Math.FloatBetween(60, 150) * kk;
    const L = Phaser.Math.FloatBetween(10, 20) * kk;
    const W = Phaser.Math.FloatBetween(3, 5) * kk;
    // rombo con su caja en (0,0)-(W,L): el origen 0,5 lo deja centrado en (x, y); el eje largo apunta hacia fuera
    const shard = scene.add
      .polygon(x, y, [W / 2, 0, W, L / 2, W / 2, L, 0, L / 2], Phaser.Utils.Array.GetRandom(cols), 1)
      .setRotation(a + Math.PI / 2)
      .setDepth(3651)
      .setBlendMode(ADD);
    scene.tweens.add({
      targets: shard,
      x: x + Math.cos(a) * d,
      y: y + Math.sin(a) * d * 0.7,
      rotation: shard.rotation + Phaser.Math.FloatBetween(-1.2, 1.2),
      scaleY: 0.4,
      alpha: 0,
      duration: Phaser.Math.Between(320, 520),
      ease: 'Cubic.easeOut',
      onComplete: () => shard.destroy(),
    });
  }
  const R = 34 * kk;
  const flake = scene.add.graphics({ x, y }).setDepth(3652).setBlendMode(ADD);
  for (const [w, col, alpha] of [
    [6, 0x8fdcff, 0.5],
    [2.5, 0xffffff, 1],
  ] as const) {
    flake.lineStyle(w * kk, col, alpha);
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      flake.lineBetween(0, 0, ca * R, sa * R);
      for (const at of [0.45, 0.7]) {
        const bx = ca * R * at;
        const by = sa * R * at;
        const bl = R * 0.25;
        flake.lineBetween(bx, by, bx + Math.cos(ang + 0.7) * bl, by + Math.sin(ang + 0.7) * bl);
        flake.lineBetween(bx, by, bx + Math.cos(ang - 0.7) * bl, by + Math.sin(ang - 0.7) * bl);
      }
    }
  }
  flake.setScale(0.3);
  scene.tweens.add({ targets: flake, scale: 1.5, angle: 30, alpha: 0, duration: 460, ease: 'Cubic.easeOut', onComplete: () => flake.destroy() });
}

/** Golpe de RAYO en la raqueta: rayos en zigzag que salen del contacto y parpadean 3 veces (sin chispas redondas). */
function zapBurst(scene: Phaser.Scene, x: number, y: number, k: number) {
  const kk = Math.max(0.6, k);
  const g = scene.add.graphics().setDepth(3651).setBlendMode(Phaser.BlendModes.ADD);
  const draw = () => {
    g.clear();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.random() * 0.6;
      const L = Phaser.Math.FloatBetween(55, 120) * kk;
      for (const [w, col, al] of [
        [7, 0x2f6bff, 0.35],
        [3.5, 0x7fd4ff, 0.85],
        [1.8, 0xffffff, 1],
      ] as const) {
        g.lineStyle(w * kk, col, al).beginPath().moveTo(x, y);
        for (let j = 1; j <= 4; j++) {
          const o = j < 4 ? (Math.random() - 0.5) * 18 * kk : 0;
          g.lineTo(x + Math.cos(a) * (L * j) / 4 - Math.sin(a) * o, y + (Math.sin(a) * (L * j) / 4 + Math.cos(a) * o) * 0.75);
        }
        g.strokePath();
      }
    }
  };
  draw();
  scene.time.delayedCall(60, draw);
  scene.time.delayedCall(120, draw);
  scene.time.delayedCall(190, () => g.destroy());
}

/** Golpe de VIENTO en la raqueta: hojas que salen girando y un aro de aire. */
function leafBurst(scene: Phaser.Scene, x: number, y: number, k: number) {
  const kk = Math.max(0.6, k);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.2, 0.2);
    const d = Phaser.Math.FloatBetween(60, 140) * kk;
    const leaf = scene.add.ellipse(x, y, 12 * kk, 5 * kk, Phaser.Utils.Array.GetRandom([0x5fd16f, 0x3fa85a, 0xb8ff9a]), 1).setDepth(3651).setRotation(a);
    scene.tweens.add({ targets: leaf, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.7, rotation: a + Phaser.Math.FloatBetween(3, 7), alpha: 0, duration: Phaser.Math.Between(340, 520), ease: 'Cubic.easeOut', onComplete: () => leaf.destroy() });
  }
  const ring = scene.add.ellipse(x, y, 40 * kk, 30 * kk).setStrokeStyle(4 * kk, 0xe0ffe8, 0.9).setDepth(3651).setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({ targets: ring, scale: 3.6, angle: 120, alpha: 0, duration: 360, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
}

/** Vibración breve de la cámara del mundo que se reduce sola (el HUD va en otra cámara). */
export function infernoShake(scene: Phaser.Scene) {
  const lvl = shakeLevel();
  if (lvl <= 0) return;
  const I = INFERNO.shake.intensity * lvl;
  const cam = scene.cameras.main;
  cam.shake(INFERNO.shake.ms, I, true, (_c: Phaser.Cameras.Scene2D.Camera, p: number) => {
    cam.shakeEffect.intensity.set(I * (1 - p), I * (1 - p));
  });
  try {
    navigator.vibrate?.(INFERNO.hapticMs);
  } catch {
    /* sin vibración */
  }
}

function audio(scene: Phaser.Scene): AudioContext | null {
  const ctx = (scene.sound as unknown as { context?: AudioContext }).context;
  if (!ctx) return null;
  if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);
  return ctx;
}

function tone(ctx: AudioContext, f0: number, f1: number, at: number, dur: number, type: OscillatorType, vol: number) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, at);
  o.frequency.exponentialRampToValueAtTime(f1, at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + Math.min(0.08, dur * 0.3));
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(ctx.destination);
  o.start(at);
  o.stop(at + dur + 0.02);
}

let chargeSnd: Phaser.Sound.BaseSound | null = null;

/** Carga de energía (1 s ascendente), desplazamiento (silbido) e impacto (golpe grave). */
export const infernoSound = {
  charge(scene: Phaser.Scene) {
    // mp3 cargando (se corta al golpear); si falta, el zumbido sintetizado de siempre
    if (scene.cache.audio.exists('cargando')) {
      chargeSnd?.destroy();
      chargeSnd = scene.sound.add('cargando', { volume: 0.8 });
      chargeSnd.play();
      return;
    }
    const c = audio(scene);
    if (!c) return;
    tone(c, 90, 520, c.currentTime, 1.0, 'sawtooth', 0.05);
    tone(c, 180, 1040, c.currentTime, 1.0, 'triangle', 0.035);
  },
  dash(scene: Phaser.Scene) {
    const c = audio(scene);
    if (!c) return;
    tone(c, 1400, 300, c.currentTime, 0.28, 'sawtooth', 0.04);
  },
  impact(scene: Phaser.Scene) {
    chargeSnd?.stop();
    chargeSnd?.destroy();
    chargeSnd = null;
    // mp3 del golpe INFERNO (cargado en MatchScene.preload); si falta, el golpe sintetizado de siempre
    if (scene.cache.audio.exists('inferno-hit')) {
      scene.sound.play('inferno-hit', { volume: 1 });
      return;
    }
    const c = audio(scene);
    if (!c) return;
    tone(c, 160, 40, c.currentTime, 0.45, 'square', 0.12);
    tone(c, 900, 120, c.currentTime, 0.25, 'sawtooth', 0.06);
  },
};
