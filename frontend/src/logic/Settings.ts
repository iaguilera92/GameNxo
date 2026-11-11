import Phaser from 'phaser';

/**
 * AJUSTES del jugador (se guardan en el dispositivo) y su aplicación GLOBAL:
 *   sonido     silencia todo el audio: Phaser (`sound.mute`) y los sonidos sintetizados (se suspende el
 *              AudioContext y no se deja reanudar mientras esté apagado)
 *   vibración  `navigator.vibrate` deja de vibrar
 *   temblor    todas las sacudidas de cámara se multiplican por el nivel (0 = sin temblor)
 * Se instala una vez (main.ts) y vale para todos los efectos, presentes y futuros, sin tocarlos.
 */
export type ShakeLevel = 0 | 0.5 | 1;

/** Dificultad del rival: AUTO = según su nivel (cerca del tuyo); o fija. */
export type RivalSetting = 'auto' | 'facil' | 'normal' | 'dificil' | 'experto';
export const RIVAL_OPTIONS: { v: RivalSetting; label: string }[] = [
  { v: 'auto', label: 'AUTO' },
  { v: 'facil', label: 'FÁCIL' },
  { v: 'normal', label: 'NORMAL' },
  { v: 'dificil', label: 'DIFÍCIL' },
  { v: 'experto', label: 'EXPERTO' },
];

export interface GameSettings {
  sound: boolean;
  vibration: boolean;
  shake: ShakeLevel;
  rival: RivalSetting;
  /** anillo guía del Perfect Timing sobre la pelota */
  timingGuide: boolean;
}

const KEY = 'nxo.settings';
/** clave antigua que lee INFERNO DRIVE (logic/InfernoDrive.shakeLevel): se mantiene sincronizada */
const LEGACY_SHAKE = 'nxo.shake';
const DEFAULTS: GameSettings = { sound: true, vibration: true, shake: 1, rival: 'auto', timingGuide: true };

let current: GameSettings = load();
const listeners = new Set<(s: GameSettings) => void>();

function load(): GameSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<GameSettings> | null;
    if (!raw || typeof raw !== 'object') return { ...DEFAULTS };
    const shake = raw.shake === 0 || raw.shake === 0.5 || raw.shake === 1 ? raw.shake : DEFAULTS.shake;
    const rival = RIVAL_OPTIONS.some((o) => o.v === raw.rival) ? (raw.rival as RivalSetting) : DEFAULTS.rival;
    return { sound: raw.sound !== false, vibration: raw.vibration !== false, shake, rival, timingGuide: raw.timingGuide !== false };
  } catch {
    return { ...DEFAULTS };
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
    localStorage.setItem(LEGACY_SHAKE, String(current.shake));
  } catch {
    /* sin almacenamiento: vale para esta sesión */
  }
}

export function getSettings(): Readonly<GameSettings> {
  return current;
}

/** Cambia uno o varios ajustes, los guarda y los aplica al momento. */
export function setSettings(patch: Partial<GameSettings>) {
  current = { ...current, ...patch };
  save();
  applySound();
  listeners.forEach((l) => l(current));
}

export function onSettingsChange(l: (s: GameSettings) => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

// ---------------------------------------------------------------- aplicación global
let game: Phaser.Game | null = null;
let ctxResume: (() => Promise<void>) | null = null;

function audioCtx(): AudioContext | null {
  const sm = game?.sound as unknown as { context?: AudioContext } | undefined;
  return sm?.context ?? null;
}

function applySound() {
  if (!game) return;
  game.sound.mute = !current.sound;
  const ctx = audioCtx();
  if (!ctx) return;
  if (!current.sound) ctx.suspend().catch(() => undefined);
  else if (ctxResume && ctx.state === 'suspended') ctxResume().catch(() => undefined);
}

/** Instala los ajustes en el juego (una vez, en main.ts). */
export function installSettings(g: Phaser.Game) {
  game = g;
  save(); // sincroniza la clave antigua del temblor

  // temblor: todas las cámaras (escala la intensidad; 0 = no tiembla)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proto = Phaser.Cameras.Scene2D.Camera.prototype as unknown as { shake: (...a: any[]) => unknown; __nxoShake?: boolean };
  if (!proto.__nxoShake) {
    proto.__nxoShake = true;
    const orig = proto.shake;
    proto.shake = function (this: Phaser.Cameras.Scene2D.Camera, duration?: number, intensity?: number | Phaser.Math.Vector2, ...rest: unknown[]) {
      const lvl = current.shake;
      if (lvl <= 0) return this;
      let i: number | Phaser.Math.Vector2 = intensity ?? 0.05;
      i = typeof i === 'number' ? i * lvl : new Phaser.Math.Vector2(i.x * lvl, i.y * lvl);
      return orig.call(this, duration, i, ...rest);
    };
  }

  // vibración del dispositivo
  const nav = navigator as Navigator & { __nxoVib?: boolean };
  if (!nav.__nxoVib && typeof nav.vibrate === 'function') {
    nav.__nxoVib = true;
    const vib = nav.vibrate.bind(nav);
    try {
      Object.defineProperty(nav, 'vibrate', { configurable: true, value: (p: VibratePattern) => (current.vibration ? vib(p) : false) });
    } catch {
      /* navegador que no deja redefinirlo: se ignora */
    }
  }

  // sonido: el AudioContext no se reanuda mientras el sonido esté apagado (ni al primer toque)
  const hook = () => {
    const ctx = audioCtx() as (AudioContext & { __nxoAudio?: boolean }) | null;
    if (ctx && !ctx.__nxoAudio) {
      ctx.__nxoAudio = true;
      const orig = ctx.resume.bind(ctx);
      ctxResume = orig;
      ctx.resume = () => (current.sound ? orig() : Promise.resolve());
    }
    applySound();
  };
  if (g.isBooted) hook();
  else g.events.once(Phaser.Core.Events.READY, hook);
}
