import Phaser from 'phaser';

/**
 * CINEMÁTICAS DE GOLPE ESPECIAL sobre la misma cancha (sin cambiar de escena ni cámara).
 * Un solo motor con perfiles:
 *   SMASH_CINE     SMASH de habilidad — 1 s (pausa, energía, destello, golpe)
 *   INFERNO_CINE   INFERNO DRIVE (logic/InfernoDrive.ts) — 2 s (concentración, desplazamiento, impacto)
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
  private back: Phaser.GameObjects.Graphics;
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
  /** duración real medida hasta el golpe (pruebas) */
  lastMs = 0;
  /** perfil de la última cinemática (pruebas) */
  lastProfile: CineProfile = SMASH_CINE;

  constructor(private scene: Phaser.Scene) {
    this.dark = scene.add.rectangle(0, 0, 10, 10, 0x02040c, 1).setOrigin(0.5).setDepth(0.95).setVisible(false);
    this.back = scene.add.graphics().setVisible(false).setBlendMode(Phaser.BlendModes.ADD);
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
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.tailTick, this);
      this.cancel();
    });
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
    // congelar: tweens, temporizadores de la escena y animaciones de los personajes
    this.scene.tweens.pauseAll();
    this.pausedTime = !this.scene.time.paused;
    this.scene.time.paused = true;
    for (const s of o.freeze) s.anims?.pause();
    this.dark.setVisible(true).setAlpha(0);
    this.back.setVisible(true);
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
    this.back.clear().setVisible(false);
    this.front.clear().setVisible(false);
    this.auraImgs.forEach((o) => o.setVisible(false));
    this.racketGlow.setVisible(false);
    this.flashImg.setVisible(false);
    this.parts = [];
    this.opts = undefined;
  }

  // ---------------------------------------------------------------- dibujo
  private draw(e: number) {
    const P = this.P;
    const D = P.durationMs;
    const C = P.colors;
    const G = P.glow;
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
    const b = this.back;
    b.clear().setDepth(f.depth - 0.5);
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
      o.setTint(col)
        .setPosition(f.x, f.y)
        .setDisplaySize(hh * 1.5 * sc, hh * 3 * sc)
        .setAlpha(Math.min(1, a * 2.6 * energy * G))
        .setDepth(f.depth - 0.5 - i * 0.01)
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
        g.lineStyle(18 * wk, col, 0.14 * fade).lineBetween(x0, y0, x1, y1); // halo suave
        g.lineStyle(8 * wk, col, 0.5 * fade).lineBetween(x0, y0, x1, y1);
        g.lineStyle(3 * wk, 0xffffff, 1 * fade).lineBetween(x0, y0, x1, y1); // núcleo luminoso
        g.fillStyle(col, 0.5 * fade).fillCircle(x1, y1, 7 * wk);
        g.fillStyle(0xffffff, fade).fillCircle(x1, y1, 3.5 * wk); // punta
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
      g.fillStyle(p.col, 0.9 * clamp01(energy + 0.2)).fillCircle(f.x + Math.cos(p.a) * p.r, f.y + Math.sin(p.a) * p.r * 0.8, p.size * (0.7 + 0.5 * k));
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
        .setTint(atHit ? 0xfff1c8 : 0xffffff)
        .setPosition(atHit ? f.racketX : f.x, atHit ? f.racketY : f.y)
        .setDisplaySize(w, h)
        .setAlpha(0.85 * (1 - q) * (1 - q))
        .setVisible(true);
    } else this.flashImg.setVisible(false);
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
