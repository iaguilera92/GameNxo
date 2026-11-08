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
  /** capas del aura detrás del personaje: [radio, color, alfa] (por defecto, la del SMASH) */
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
  rays: 14,
  particles: 34,
  glow: 1,
  pulseEveryMs: 110,
  colors: { core: 0xfff4c2, gold: 0xffc42e, hot: 0xff8a1e, cyan: 0x7fe3ff },
};

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
  private front: Phaser.GameObjects.Graphics;
  private parts: Particle[] = [];
  private lastPulse = 0;
  private lastE = 0;
  private pulses: { t: number }[] = [];
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
    this.pulses = [];
    this.lastPulse = 0;
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

    // --- aura detrás del personaje (no lo tapa)
    const b = this.back;
    b.clear().setDepth(f.depth - 0.5);
    const throb = 1 + Math.sin(e / 38) * 0.06;
    const aura: [number, number, number][] = P.aura ?? [
      [150, C.hot, 0.1],
      [110, C.gold, 0.16],
      [75, C.core, 0.22],
    ];
    for (const [r, col, a] of aura) {
      b.fillStyle(col, a * energy * G).fillEllipse(f.x, f.y, r * 2 * k * throb * (0.6 + 0.4 * energy), r * 2.5 * k * throb * (0.6 + 0.4 * energy));
    }

    // --- rayos que convergen, partículas y pulsos (por encima, aditivos y finos)
    const g = this.front;
    g.clear();
    if (e >= P.activateMs * 0.6 && e < P.raysUntilMs) {
      const n = P.rays;
      const span = 260 * k + 140;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2 + i * 0.37;
        const speed = e < P.focusMs ? 1.4 : 2.2; // más rápidos en la máxima energía
        const prog = (e / 1000) * speed + i * 0.137;
        const t = prog - Math.floor(prog); // 0 → 1: del borde hacia el centro
        const r0 = span * (1 - t) + 26 * k;
        const len = (60 + 70 * energy) * k;
        const r1 = Math.max(18 * k, r0 - len);
        const w = (e < P.focusMs ? 3 : 5) * (0.6 + 0.6 * energy) * G;
        const col = i % 3 === 0 ? C.cyan : i % 3 === 1 ? C.gold : C.core;
        g.lineStyle(w, col, clamp01(0.85 * energy * Math.sin(t * Math.PI))).lineBetween(f.x + Math.cos(ang) * r0, f.y + Math.sin(ang) * r0 * 0.8, f.x + Math.cos(ang) * r1, f.y + Math.sin(ang) * r1 * 0.8);
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
    // pulsos de luz en la raqueta (máxima energía)
    if (e >= P.focusMs && e < P.peakMs && e - this.lastPulse >= P.pulseEveryMs) {
      this.lastPulse = e;
      this.pulses.push({ t: e });
    }
    for (const p of this.pulses) {
      const q = (e - p.t) / 260;
      if (q >= 1) continue;
      g.lineStyle(4 * (1 - q) + 1, C.core, 0.9 * (1 - q)).strokeCircle(f.racketX, f.racketY, (10 + 50 * q) * k + 4);
    }
    // brillo en la raqueta (suave y pequeño: no tapa la pelota)
    if (e < P.hitAtMs) {
      g.fillStyle(C.core, 0.3 * energy * G).fillCircle(f.racketX, f.racketY, (10 + 8 * energy) * k);
      g.lineStyle(2.5, 0xffffff, 0.7 * energy * G).strokeCircle(f.racketX, f.racketY, (14 + 6 * energy) * k);
    }

    // --- destello: rápido, no tapa la pelota ni al rival (radio limitado)
    if (e >= P.flashAtMs && e < P.flashAtMs + P.flashMs) {
      const q = (e - P.flashAtMs) / P.flashMs;
      const fx = e >= P.hitAtMs ? f.racketX : f.x;
      const fy = e >= P.hitAtMs ? f.racketY : f.y;
      g.fillStyle(0xffffff, 0.42 * (1 - q) * (1 - q)).fillCircle(fx, fy, (30 + 170 * q) * k);
      g.lineStyle(8 * (1 - q) + 2, C.gold, 1 - q).strokeCircle(fx, fy, (50 + 300 * q) * k);
      g.lineStyle(5 * (1 - q) + 1, C.hot, 0.8 * (1 - q)).strokeCircle(fx, fy, (25 + 160 * q) * k);
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
