import Phaser from 'phaser';

/**
 * CINEMÁTICAS DE GOLPE ESPECIAL sobre la misma cancha (sin cambiar de escena ni cámara).
 * Un solo motor con perfiles:
 *   SMASH_CINE     SMASH de habilidad — 1 s (pausa, energía, destello, golpe)
 *   INFERNO_CINE   INFERNO DRIVE (logic/InfernoDrive.ts) — 2 s (concentración, desplazamiento, impacto); con los
 *                  colores y la forma de la energía de cada poder: infernoCine(poder) en fx/InfernoFx.ts
 *
 * La escena la lanza SOLO con el contacto ya confirmado/validado. Mientras `active`:
 *   - la simulación del partido no avanza (la escena salta su update: física, jugadores, IA, relojes),
 *   - tweens, temporizadores de la escena y animaciones de los personajes quedan en pausa,
 *   - este módulo se anima con tiempo REAL (performance.now / setTimeout), no con el reloj del partido.
 * En `hitAtMs` se restaura todo y se ejecuta el golpe pendiente UNA sola vez (onHit). Si el perfil
 * dura más que `hitAtMs`, los efectos (luz que vuelve, destello) siguen como "cola" con el partido ya
 * en marcha.
 *
 * Oscurecimiento por capas: capa oscura del mundo con profundidad 0.95 → por encima del suelo, la
 * cancha, las líneas y el escenario (< 1) y por debajo de sombras, personajes y pelota (≥ 1).
 * El HUD va en otra cámara y no se oscurece.
 */
export interface CineProfile {
  durationMs: number;
  /** instante del golpe: aquí se reanuda el partido */
  hitAtMs: number;
  /** curva de energía: activación → concentración → máxima */
  activateMs: number;
  focusMs: number;
  peakMs: number;
  /** rayos y partículas convergentes hasta aquí */
  raysUntilMs: number;
  /** desde aquí la luz vuelve y la energía se apaga */
  releaseFromMs: number;
  flashAtMs: number;
  flashMs: number;
  /** oscuridad de la cancha (0..1) */
  darken: number;
  rays: number;
  particles: number;
  /** intensidad del resplandor (multiplica alfas) */
  glow: number;
  pulseEveryMs: number;
  colors: { core: number; gold: number; hot: number; cyan: number };
  /** capas del aura ceñida detrás del personaje: [escala sobre su silueta, color, alfa] (por defecto, la del SMASH) */
  aura?: [number, number, number][];
  /**
   * forma de la energía que llega al personaje: 'beam' (líneas de luz, por defecto) o 'ice' (esquirlas de hielo
   * con escarcha y cristales en vez de puntos)
   */
  rayStyle?: 'beam' | 'ice';
  /** color del destello en la raqueta al golpear (por defecto, blanco cálido) */
  flashTint?: number;
  /** (18-11-2026) ESPECIAL LEGENDARIO DRAGÓN: un dragón gigante de fuego se alza detrás del que golpea y ruge (drawDragon) */
  dragon?: boolean;
}

export const SMASH_CINE: CineProfile & { enabled: boolean } = {
  /** activar/desactivar (también: localStorage 'dev.smashCine' = '0') */
  enabled: true,
  durationMs: 1000,
  hitAtMs: 1000,
  activateMs: 200,
  focusMs: 500,
  peakMs: 800,
  raysUntilMs: 860,
  releaseFromMs: 800,
  flashAtMs: 800,
  flashMs: 140,
  darken: 0.43,
  rays: 20,
  particles: 34,
  glow: 1,
  pulseEveryMs: 110,
  colors: { core: 0xfff4c2, gold: 0xffc42e, hot: 0xff8a1e, cyan: 0x7fe3ff },
};

/** textura de brillo suave (sin bordes) para aura, raqueta y destellos */
const SOFT = 'fx-cine-soft';

export function smashCineEnabled() {
  if (!SMASH_CINE.enabled) return false;
  try {
    return localStorage.getItem('dev.smashCine') !== '0';
  } catch {
    return true;
  }
}

/** Punto de concentración (coordenadas de mundo) y escala de perspectiva. */
export interface CineFocus {
  x: number;
  y: number;
  racketX: number;
  racketY: number;
  /** escala de perspectiva del personaje */
  s: number;
  /** medio alto del personaje en pantalla (el aura se ciñe a su silueta) */
  hh?: number;
  /** profundidad del personaje (el aura va justo detrás) */
  depth: number;
}

export interface CineStart {
  /** perfil (por defecto el del SMASH) */
  profile?: CineProfile;
  focus: () => CineFocus;
  /** sprites a congelar (jugador y rival) */
  freeze: Phaser.GameObjects.Sprite[];
  /** sprites del ejecutor: se sueltan `leadMs` antes del golpe para que la raqueta llegue al impacto justo */
  executor: Phaser.GameObjects.Sprite[];
  leadMs: number;
  /** cada fotograma de la parte congelada (p. ej. el desplazamiento de INFERNO DRIVE) */
  onFrame?: (e: number) => void;
  /** golpe pendiente: se consume exactamente una vez */
  onHit: () => void;
  /** limpieza sin golpe (cancelación) */
  onCancel?: () => void;
}

interface Particle {
  a: number;
  r: number;
  v: number;
  size: number;
  col: number;
  life: number;
}

export class SmashCinematic {
  /** true = el partido está congelado */
  active = false;
  private P: CineProfile = SMASH_CINE;
  private t0 = 0;
  private opts?: CineStart;
  private released = false;
  private hitPending = false;
  private pausedTime = false;
  private tail = false;
  private dark: Phaser.GameObjects.Rectangle;
  private auraImgs: Phaser.GameObjects.Image[];
  private racketGlow: Phaser.GameObjects.Image;
  private flashImg: Phaser.GameObjects.Image;
  private front: Phaser.GameObjects.Graphics;
  private parts: Particle[] = [];
  private lastE = 0;
  private fallback = 0;
  private releaseTimer = 0;
  private endTimer = 0;
  private lastFocus?: CineFocus;
  /** (18-11-2026) DRAGÓN: cuerpo (normal) y fuego / ojos (aditivo), creados la primera vez que hacen falta; rugido (sacudida) una vez */
  private dragonBody?: Phaser.GameObjects.Graphics;
  private dragonFire?: Phaser.GameObjects.Graphics;
  private roared = false;
  /** duración real medida hasta el golpe (pruebas) */
  lastMs = 0;
  /** perfil de la última cinemática (pruebas) */
  lastProfile: CineProfile = SMASH_CINE;

  constructor(private scene: Phaser.Scene) {
    this.dark = scene.add.rectangle(0, 0, 10, 10, 0x02040c, 1).setOrigin(0.5).setDepth(0.95).setVisible(false);
    // brillos SUAVES (degradado radial, sin contorno): aura del cuerpo, raqueta y destello
    if (!scene.textures.exists(SOFT)) {
      const t = scene.textures.createCanvas(SOFT, 64, 64);
      if (t) {
        const ctx = t.getContext();
        const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.4, 'rgba(255,255,255,0.6)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 64, 64);
        t.refresh();
      }
    }
    const soft = () => scene.add.image(0, 0, SOFT).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.auraImgs = [soft(), soft(), soft()];
    this.racketGlow = soft().setDepth(3699);
    this.flashImg = soft().setDepth(3701);
    this.front = scene.add.graphics().setDepth(3700).setVisible(false).setBlendMode(Phaser.BlendModes.ADD);
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.tailTick, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.dispose, this);
  }

  /** Cancela la reproducción y retira los listeners. La escena o el contenedor dueño destruye el dibujo. */
  dispose() {
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.dispose, this);
    this.scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.tailTick, this);
    this.cancel();
  }

  /** ¿Hay alguna cinemática en curso (congelada o en su cola de efectos)? */
  get busy() {
    return this.active || this.tail;
  }

  /** Empieza la cinemática (la escena deja de simular mientras `active`). */
  start(o: CineStart) {
    if (this.active) return;
    if (this.tail) this.endTail();
    this.P = o.profile ?? SMASH_CINE;
    this.lastProfile = this.P;
    this.active = true;
    this.opts = o;
    this.t0 = performance.now();
    this.released = false;
    this.hitPending = true;
    this.parts = [];
    this.lastE = 0;
    this.roared = false;
    // congelar: tweens, temporizadores de la escena y animaciones de los personajes
    this.scene.tweens.pauseAll();
    this.pausedTime = !this.scene.time.paused;
    this.scene.time.paused = true;
    for (const s of o.freeze) s.anims?.pause();
    this.dark.setVisible(true).setAlpha(0);
    this.front.setVisible(true);
    // tiempo REAL exacto (no depende de los FPS ni del reloj del partido); también es la red de seguridad
    const H = this.P.hitAtMs;
    this.releaseTimer = window.setTimeout(() => this.release(), Math.max(0, H - o.leadMs));
    this.fallback = window.setTimeout(() => this.active && this.finish(), H);
  }

  /** Suelta la animación del ejecutor para que la raqueta llegue al impacto justo al reanudar. */
  private release() {
    if (!this.active || this.released || !this.opts) return;
    this.released = true;
    for (const s of this.opts.executor) s.anims?.resume();
  }

  /** Llamar cada fotograma mientras `active`. */
  update() {
    if (!this.active || !this.opts) return;
    const e = performance.now() - this.t0;
    if (e >= this.P.hitAtMs) {
      this.finish();
      return;
    }
    this.opts.onFrame?.(e);
    this.draw(e);
  }

  /** Golpe: restaura la simulación y ejecuta el golpe pendiente (una vez). */
  private finish() {
    const o = this.opts;
    this.lastMs = performance.now() - this.t0;
    if (o) this.lastFocus = o.focus();
    this.unfreeze();
    const tail = this.P.durationMs > this.P.hitAtMs;
    if (tail) {
      this.tail = true;
      this.endTimer = window.setTimeout(() => this.endTail(), this.P.durationMs - this.P.hitAtMs + 30);
    } else this.clearGfx();
    if (o && this.hitPending) {
      this.hitPending = false;
      o.onHit();
    }
  }

  /** Limpieza segura sin golpe (cambio de escena, fin de partido…). */
  cancel() {
    const o = this.opts;
    const pending = this.hitPending;
    this.hitPending = false;
    if (this.active) this.unfreeze();
    this.endTail();
    if (pending) o?.onCancel?.();
  }

  private unfreeze() {
    window.clearTimeout(this.fallback);
    window.clearTimeout(this.releaseTimer);
    this.active = false;
    if (this.opts) for (const s of this.opts.freeze) s.anims?.resume();
    if (this.scene.sys.isActive() || this.scene.sys.isPaused()) {
      this.scene.tweens.resumeAll();
      if (this.pausedTime) this.scene.time.paused = false;
    }
    this.pausedTime = false;
  }

  private tailTick() {
    if (!this.tail) return;
    const e = performance.now() - this.t0;
    if (e >= this.P.durationMs) return this.endTail();
    this.draw(e);
  }

  private endTail() {
    window.clearTimeout(this.endTimer);
    this.tail = false;
    if (!this.active) this.clearGfx();
  }

  private clearGfx() {
    this.dark.setVisible(false);
    this.front.clear().setVisible(false);
    this.auraImgs.forEach((o) => o.setVisible(false));
    this.racketGlow.setVisible(false);
    this.flashImg.setVisible(false);
    this.dragonBody?.clear().setVisible(false);
    this.dragonFire?.clear().setVisible(false);
    this.parts = [];
    this.opts = undefined;
  }

  /**
   * (18-11-2026) ESPECIAL LEGENDARIO DRAGÓN: un DRAGÓN de fuego gigante sale del suelo detrás del que golpea serpenteando hacia arriba, abre las
   * fauces con fuego dentro y RUGE (sacudida) en la máxima energía; al golpear se desvanece en la cola de la cinemática. Dos Graphics
   * redibujados cada fotograma (sin objetos nuevos). `f` = el que golpea (coordenadas de mundo).
   */
  private drawDragon(e: number, f: CineFocus) {
    const P = this.P;
    this.dragonBody ??= this.scene.add.graphics();
    this.dragonFire ??= this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    const body = this.dragonBody.clear().setVisible(true);
    const fire = this.dragonFire.clear().setVisible(true);
    if (body.depth !== f.depth - 0.6) body.setDepth(f.depth - 0.6);
    if (fire.depth !== f.depth - 0.55) fire.setDepth(f.depth - 0.55);
    const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
    const smooth = (x: number) => x * x * (3 - 2 * x);
    const k = f.s;
    const hh = f.hh ?? 60 * k;
    const feetY = f.y + hh;
    // sube del suelo (0,1 → 0,75 de la carga), abre la boca en la concentración, ruge en la máxima energía; se apaga tras el golpe
    const rise = smooth(clamp01((e - 80) / (P.focusMs - 80)));
    const open = smooth(clamp01((e - P.focusMs) / (P.peakMs - P.focusMs)));
    const fade = e < P.hitAtMs ? 1 : 1 - clamp01((e - P.hitAtMs) / Math.max(1, P.durationMs - P.hitAtMs));
    body.setAlpha(fade);
    fire.setAlpha(fade);
    if (rise <= 0.01) return;
    if (!this.roared && e >= P.peakMs) {
      this.roared = true;
      this.scene.cameras.main.shake(320, 0.012); // RUGIDO
    }
    const t = e / 1000;
    const H = hh * 5.2 * rise; // alto del cuerpo
    const N = 20;
    const spine: { x: number; y: number }[] = [];
    for (let i = 0; i < N; i++) {
      const q = i / (N - 1);
      const sway = Math.sin(q * Math.PI * 2.1 + t * 4.2) * hh * 0.85 * (1 - q * 0.35);
      spine.push({ x: f.x + sway, y: feetY - q * H });
    }
    const width = (q: number) => hh * (0.62 - 0.36 * q) * (0.6 + 0.4 * rise);
    const side = (sgn: number, scale = 1, off = 0) =>
      spine.map((p, i) => {
        const a = spine[Math.max(0, i - 1)];
        const b = spine[Math.min(N - 1, i + 1)];
        let nx = -(b.y - a.y);
        let ny = b.x - a.x;
        const l = Math.hypot(nx, ny) || 1;
        nx /= l;
        ny /= l;
        const w = width(i / (N - 1)) * scale;
        return { x: p.x + nx * (w * sgn + off), y: p.y + ny * (w * sgn + off) };
      });
    const poly = (scale: number, off = 0) => [...side(1, scale, off), ...side(-1, scale, off).reverse()];
    // cuerpo: contorno oscuro, escamas rojas, vientre dorado
    body.fillStyle(0x2a0404, 1).fillPoints(poly(1.12), true);
    body.fillStyle(0xb3161a, 1).fillPoints(poly(1), true);
    body.fillStyle(0xe0401e, 1).fillPoints(poly(0.55, -width(0.5) * 0.2), true);
    body.fillStyle(0xffb020, 0.95).fillPoints(poly(0.22, -width(0.5) * 0.45), true);
    // aletas dorsales (púas doradas) por el lomo
    const back = side(1, 1.05);
    for (let i = 2; i < N - 2; i += 2) {
      const p = back[i];
      const a = spine[i - 1];
      const b = spine[i + 1];
      const tx = b.x - a.x;
      const ty = b.y - a.y;
      const tl = Math.hypot(tx, ty) || 1;
      const nx = p.x - spine[i].x;
      const ny = p.y - spine[i].y;
      const nl = Math.hypot(nx, ny) || 1;
      const sp = hh * 0.34 * (1 - (i / N) * 0.5);
      body.fillStyle(0xffc42e, 1).fillTriangle(p.x - (tx / tl) * sp * 0.4, p.y - (ty / tl) * sp * 0.4, p.x + (tx / tl) * sp * 0.4, p.y + (ty / tl) * sp * 0.4, p.x + (nx / nl) * sp, p.y + (ny / nl) * sp);
    }
    // CABEZA en la punta, mirando hacia arriba y un poco hacia delante
    const top = spine[N - 1];
    const hs = hh * 0.95;
    const ang = -Math.PI / 2 + 0.55 + Math.sin(t * 3) * 0.08;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const P2 = (fx: number, fy: number) => ({ x: top.x + ca * fx * hs - sa * fy * hs, y: top.y + sa * fx * hs + ca * fy * hs });
    const jaw = 0.12 + 0.5 * open; // apertura de la boca
    // cuernos hacia atrás
    body.fillStyle(0xffe08a, 1).fillPoints([P2(-0.2, -0.32), P2(-0.95, -0.85), P2(-0.45, -0.18)], true);
    body.fillStyle(0xffe08a, 1).fillPoints([P2(-0.25, 0.3), P2(-1.0, 0.7), P2(-0.5, 0.16)], true);
    // mandíbula de arriba y de abajo (se abren)
    body.fillStyle(0x2a0404, 1).fillPoints([P2(-0.55, -0.42), P2(0.35, -0.38), P2(1.25, -0.12 - jaw * 0.2), P2(0.9, 0.02), P2(-0.4, 0.12)], true);
    body.fillStyle(0xc81c1c, 1).fillPoints([P2(-0.48, -0.34), P2(0.32, -0.3), P2(1.12, -0.12 - jaw * 0.2), P2(0.82, -0.02), P2(-0.35, 0.06)], true);
    body.fillStyle(0x2a0404, 1).fillPoints([P2(-0.4, 0.14), P2(0.75, 0.1 + jaw), P2(1.05, 0.2 + jaw * 1.1), P2(0.3, 0.38 + jaw * 0.6), P2(-0.45, 0.36)], true);
    body.fillStyle(0xa81616, 1).fillPoints([P2(-0.32, 0.18), P2(0.7, 0.14 + jaw), P2(0.95, 0.22 + jaw * 1.05), P2(0.28, 0.32 + jaw * 0.6), P2(-0.38, 0.3)], true);
    // dientes
    for (let i = 0; i < 4; i++) {
      const u = 0.15 + i * 0.22;
      const a0 = P2(u, -0.08 - jaw * 0.12 * u);
      body.fillStyle(0xfff6e0, 1).fillTriangle(a0.x, a0.y, P2(u + 0.1, -0.08 - jaw * 0.12 * u).x, P2(u + 0.1, -0.08 - jaw * 0.12 * u).y, P2(u + 0.05, 0.04 + jaw * 0.3).x, P2(u + 0.05, 0.04 + jaw * 0.3).y);
    }
    // ojo que brilla
    const eye = P2(-0.05, -0.2);
    fire.fillStyle(0xffd23f, 0.45).fillCircle(eye.x, eye.y, hs * 0.2);
    fire.fillStyle(0xfff6c8, 1).fillCircle(eye.x, eye.y, hs * 0.09);
    // fuego en las fauces (crece al abrirse) y LLAMARADA al rugir
    const mouth = P2(1.0, 0.05 + jaw * 0.5);
    if (open > 0) {
      fire.fillStyle(0xff7a1a, 0.5 * open).fillCircle(mouth.x, mouth.y, hs * (0.25 + 0.3 * open));
      fire.fillStyle(0xfff1b8, 0.8 * open).fillCircle(mouth.x, mouth.y, hs * (0.1 + 0.14 * open));
    }
    if (e >= P.peakMs && e < P.hitAtMs + 120) {
      const u = clamp01((e - P.peakMs) / 220);
      for (const [L, w, col, a] of [
        [3.2, 0.7, 0xd6201e, 0.45],
        [2.6, 0.5, 0xff7a1a, 0.6],
        [1.9, 0.3, 0xfff1b8, 0.85],
      ] as const) {
        const len = hs * L * u * (0.9 + 0.1 * Math.sin(t * 40));
        const ex = mouth.x + ca * len;
        const ey = mouth.y + sa * len;
        fire.fillStyle(col, a).fillTriangle(mouth.x - sa * hs * w * 0.3, mouth.y + ca * hs * w * 0.3, mouth.x + sa * hs * w * 0.3, mouth.y - ca * hs * w * 0.3, ex - sa * hs * w, ey + ca * hs * w);
        fire.fillStyle(col, a).fillTriangle(mouth.x - sa * hs * w * 0.3, mouth.y + ca * hs * w * 0.3, ex - sa * hs * w, ey + ca * hs * w, ex + sa * hs * w, ey - ca * hs * w);
      }
    }
    // brasas que suben alrededor del cuerpo
    for (let i = 0; i < 10; i++) {
      const q = ((t * 0.6 + i * 0.137) % 1);
      const p = spine[Math.floor(q * (N - 1))];
      const ox = Math.sin(i * 2.3 + t * 5) * hh * 0.9;
      fire.fillStyle(i % 2 ? 0xffd23f : 0xff7a1a, 0.8 * (1 - q)).fillCircle(p.x + ox, p.y - q * hh * 0.6, (2 + (i % 3)) * k);
    }
    // resplandor de fuego en el suelo donde sale
    fire.fillStyle(0xff5a12, 0.35 * rise).fillEllipse(f.x, feetY, hh * 3.4, hh * 0.7);
  }

  // ---------------------------------------------------------------- dibujo
  private draw(e: number) {
    const P = this.P;
    const D = P.durationMs;
    const C = P.colors;
    const G = P.glow;
    const ice = P.rayStyle === 'ice';
    // durante la cola el ejecutor ya se mueve: se sigue su posición si aún hay opciones
    const f = this.opts ? this.opts.focus() : this.lastFocus;
    if (!f) return;
    const k = f.s;
    const smooth = (x: number) => x * x * (3 - 2 * x);
    const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

    // --- oscuridad: entra en la activación, se mantiene y vuelve desde releaseFrom
    const darkK = e < P.activateMs ? smooth(e / P.activateMs) : e < P.releaseFromMs ? 1 : 1 - smooth(clamp01((e - P.releaseFromMs) / (D - P.releaseFromMs)));
    const v = this.scene.cameras.main.worldView;
    this.dark.setPosition(v.centerX, v.centerY).setSize(v.width * 2 + 400, v.height * 2 + 400).setAlpha(P.darken * darkK);
    if (P.dragon) this.drawDragon(e, f); // (18-11-2026) ESPECIAL LEGENDARIO DRAGÓN

    // --- energía: crece hasta el pico, se mantiene y cae en la liberación
    const energy =
      e < P.activateMs
        ? 0.3 * (e / P.activateMs)
        : e < P.focusMs
          ? 0.3 + 0.4 * ((e - P.activateMs) / (P.focusMs - P.activateMs))
          : e < P.peakMs
            ? 0.7 + 0.3 * ((e - P.focusMs) / (P.peakMs - P.focusMs))
            : e < P.releaseFromMs
              ? 1
              : 1 - clamp01((e - P.releaseFromMs) / (D - P.releaseFromMs));

    // --- aura CEÑIDA al cuerpo, detrás del personaje (sin discos grandes sobre la cancha)
    const hh = f.hh ?? 60 * k; // medio alto del personaje en pantalla
    const throb = 1 + Math.sin(e / 38) * 0.06;
    const aura: [number, number, number][] = P.aura ?? [
      [1.25, C.hot, 0.16],
      [1.05, C.gold, 0.22],
      [0.85, C.core, 0.26],
    ];
    // brillo suave (degradado sin bordes) pegado a la silueta: sin contornos circulares
    aura.forEach(([s, col, a], i) => {
      const sc = s * throb * (0.75 + 0.25 * energy);
      const o = this.auraImgs[i];
      if (!o) return;
      const depth = f.depth - 0.5 - i * 0.01;
      if (o.depth !== depth) o.setDepth(depth);
      o.setTint(col)
        .setPosition(f.x, f.y)
        .setDisplaySize(hh * 1.5 * sc, hh * 3 * sc)
        .setAlpha(Math.min(1, a * 2.6 * energy * G))
        .setVisible(true);
    });

    // --- líneas de energía que NACEN lejos (bordes de la pantalla) y VIAJAN hacia el personaje:
    //     núcleo brillante + halo suave; se detienen antes del cuerpo para no taparlo
    const g = this.front;
    g.clear();
    if (e >= P.activateMs * 0.6 && e < P.raysUntilMs) {
      const n = P.rays;
      const v = this.scene.cameras.main.worldView;
      const far = Math.max(v.width, v.height) * 0.46; // desde los bordes de la pantalla
      const stop = hh * 0.75;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2 + i * 0.41;
        const speed = e < P.focusMs ? 1.3 : 2.1; // más rápidas en la máxima energía
        const prog = (e / 1000) * speed + ((i * 0.618) % 1);
        const t = prog - Math.floor(prog); // 0 → 1: del borde hacia el personaje
        const ease = Math.pow(t, 1.5); // acelera al acercarse (se siente absorbida)
        const head = stop + (far - stop) * (1 - ease);
        const len = (150 + 170 * energy) * (0.7 + 0.3 * k) * (1 - 0.45 * ease);
        const tail = Math.min(far + 40, head + len);
        const fade = clamp01(Math.sin(t * Math.PI) * 1.4) * clamp01(0.35 + energy);
        const col = i % 3 === 0 ? C.cyan : i % 3 === 1 ? C.gold : C.core; // colores de cada habilidad
        const cx = Math.cos(ang);
        const cy = Math.sin(ang) * 0.85;
        const x0 = f.x + cx * tail;
        const y0 = f.y + cy * tail;
        const x1 = f.x + cx * head;
        const y1 = f.y + cy * head;
        const wk = (e < P.focusMs ? 1 : 1.35) * G;
        if (ice) {
          this.iceShard(g, x0, y0, x1, y1, col, fade, wk);
          continue;
        }
        g.lineStyle(18 * wk, col, 0.14 * fade).lineBetween(x0, y0, x1, y1); // halo suave
        g.lineStyle(8 * wk, col, 0.5 * fade).lineBetween(x0, y0, x1, y1);
        g.lineStyle(3 * wk, 0xffffff, 1 * fade).lineBetween(x0, y0, x1, y1); // núcleo luminoso
        g.fillStyle(col, 0.5 * fade).fillEllipse(x1, y1, 14 * wk, 14 * wk, 12);
        g.fillStyle(0xffffff, fade).fillEllipse(x1, y1, 7 * wk, 7 * wk, 8); // punta
      }
    }
    // partículas: nacen lejos y caen hacia el punto de concentración
    const partsOn = e >= P.activateMs && e < P.raysUntilMs;
    if (partsOn && this.parts.length < P.particles) {
      const want = Math.round(P.particles * clamp01((e - P.activateMs) / (P.focusMs - P.activateMs)));
      while (this.parts.length < want)
        this.parts.push({ a: Math.random() * Math.PI * 2, r: (180 + Math.random() * 160) * k + 60, v: 0, size: 2 + Math.random() * 3, col: Math.random() < 0.5 ? C.gold : C.cyan, life: 1 });
    }
    // paso real entre fotogramas (igual a cualquier FPS)
    const dt = Math.min(0.05, Math.max(0, (e - this.lastE) / 1000));
    this.lastE = e;
    for (const p of this.parts) {
      p.v += 1400 * dt * k;
      p.r = Math.max(0, p.r - p.v * dt);
      if (p.r < 20 * k) {
        if (partsOn) {
          p.r = (180 + Math.random() * 160) * k + 60;
          p.v = 0;
          p.a = Math.random() * Math.PI * 2;
        } else p.life = 0;
      }
      if (p.life <= 0) continue;
      const px = f.x + Math.cos(p.a) * p.r;
      const py = f.y + Math.sin(p.a) * p.r * 0.8;
      const pa = 0.9 * clamp01(energy + 0.2);
      const ps = p.size * (0.7 + 0.5 * k);
      // hielo: cristales que apuntan hacia el personaje y giran un poco al caer; si no, puntos de luz
      if (ice) this.iceCrystal(g, px, py, ps * 1.3, p.a + p.r * 0.02, p.col, pa);
      else g.fillStyle(p.col, pa).fillEllipse(px, py, ps * 2, ps * 2, 8);
    }
    // brillo en la raqueta: suave y latiendo en la máxima energía (sin anillos ni ondas)
    if (e < P.hitAtMs) {
      const beat = e >= P.focusMs && e < P.peakMs ? 1 + 0.35 * Math.max(0, Math.sin((e / P.pulseEveryMs) * Math.PI)) : 1;
      const sz = (34 + 22 * energy) * k * beat;
      this.racketGlow.setTint(C.core).setPosition(f.racketX, f.racketY).setDisplaySize(sz, sz).setAlpha(0.75 * energy * G).setVisible(true);
    } else this.racketGlow.setVisible(false);

    // --- destello: brillo suave sin contorno (ni anillos), breve
    if (e >= P.flashAtMs && e < P.flashAtMs + P.flashMs) {
      const q = (e - P.flashAtMs) / P.flashMs;
      const atHit = e >= P.hitAtMs;
      const hh = f.hh ?? 60 * k;
      const w = atHit ? (60 + 220 * q) * k : hh * (1.8 + 0.6 * q);
      const h = atHit ? w : hh * (3.2 + 0.7 * q);
      this.flashImg
        .setTint(atHit ? (P.flashTint ?? 0xfff1c8) : 0xffffff)
        .setPosition(atHit ? f.racketX : f.x, atHit ? f.racketY : f.y)
        .setDisplaySize(w, h)
        .setAlpha(0.85 * (1 - q) * (1 - q))
        .setVisible(true);
    } else this.flashImg.setVisible(false);
  }

  /**
   * Rayo de hielo (`rayStyle: 'ice'`): esquirla alargada de la cola (x0, y0) a la punta (x1, y1), más ancha cerca de
   * la punta, con halo tenue, arista blanca, ramitas de escarcha que apuntan hacia la punta y un destello de cristal en ella.
   */
  private iceShard(g: Phaser.GameObjects.Graphics, x0: number, y0: number, x1: number, y1: number, col: number, fade: number, wk: number) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len < 1) return;
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;
    const mx = x0 + dx * 0.72; // parte más ancha
    const my = y0 + dy * 0.72;
    for (const [w, a] of [
      [9 * wk, 0.2],
      [5 * wk, 0.6],
    ] as const) {
      g.fillStyle(col, a * fade);
      g.fillTriangle(x0, y0, mx + nx * w, my + ny * w, mx - nx * w, my - ny * w);
      g.fillTriangle(x1, y1, mx + nx * w, my + ny * w, mx - nx * w, my - ny * w);
    }
    g.lineStyle(2 * wk, 0xffffff, 0.95 * fade).lineBetween(x0 + dx * 0.25, y0 + dy * 0.25, x1, y1);
    // escarcha: ramitas hacia la punta, como los brazos de un copo (cada vez más cortas)
    g.lineStyle(1.4 * wk, 0xe6fbff, 0.75 * fade);
    for (const [at, f] of [
      [0.32, 0.09],
      [0.5, 0.07],
      [0.66, 0.05],
    ] as const) {
      const bx = x0 + dx * at;
      const by = y0 + dy * at;
      const bl = len * f;
      g.lineBetween(bx, by, bx + ux * bl + nx * bl * 0.75, by + uy * bl + ny * bl * 0.75);
      g.lineBetween(bx, by, bx + ux * bl - nx * bl * 0.75, by + uy * bl - ny * bl * 0.75);
    }
    const ang = Math.atan2(uy, ux);
    this.iceCrystal(g, x1, y1, 4.5 * wk, ang, 0xffffff, fade);
    this.iceCrystal(g, x1, y1, 2.8 * wk, ang + Math.PI / 2, 0xffffff, 0.8 * fade);
  }

  /** Cristal de hielo: rombo alargado según `ang` (eje largo 1,6·r) con un rombo blanco más pequeño dentro. */
  private iceCrystal(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, ang: number, col: number, alpha: number) {
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    for (const [k, c, a] of [
      [1, col, alpha],
      [0.45, 0xffffff, alpha * 0.9],
    ] as const) {
      const lx = ca * r * 1.6 * k;
      const ly = sa * r * 1.6 * k;
      const wx = -sa * r * 0.6 * k;
      const wy = ca * r * 0.6 * k;
      g.fillStyle(c, a);
      g.fillTriangle(x + lx, y + ly, x + wx, y + wy, x - wx, y - wy);
      g.fillTriangle(x - lx, y - ly, x + wx, y + wy, x - wx, y - wy);
    }
  }
}

/** Sprites (con animación) dentro de un objeto (p. ej. el contenedor de un personaje). */
export function spritesIn(o: Phaser.GameObjects.GameObject): Phaser.GameObjects.Sprite[] {
  const out: Phaser.GameObjects.Sprite[] = [];
  const walk = (x: Phaser.GameObjects.GameObject) => {
    if (x instanceof Phaser.GameObjects.Sprite) out.push(x);
    const list = (x as Phaser.GameObjects.Container).list;
    if (Array.isArray(list)) list.forEach(walk);
  };
  walk(o);
  return out;
}
