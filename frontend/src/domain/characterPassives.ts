/**
 * PASIVAS DE PERSONAJE y MAESTRÍAS (datos puros, sin Phaser). Definición completa y decisiones: docs/MAESTRIAS.md.
 *
 * Cada personaje tiene una pasiva que llega a +10 %. Se sube con puntos de MAESTRÍA: 1 por partido ganado con ese personaje, y solo
 * desde que la cuenta llega al nivel máximo (nivel 20). Cada nivel de maestría vale +1 % (nivel 10 = +10 %). Se empieza en el NIVEL 0 (0 %) y la
 * primera victoria ya sube al nivel 1.
 *
 * Los ids (`agility`, `precision`, los de personaje) no se cambian nunca. Se guardan los PUNTOS (`PlayerState.mastery[skin]`), no el nivel:
 * así cambiar la curva de abajo no rompe lo guardado.
 */
import { MAX_LEVEL } from '../config';

export type PassiveId = 'agility' | 'precision' | 'strength' | 'spin' | 'resistance';

export interface PassiveDef {
  /** id de personaje (skin del catálogo) */
  skin: string;
  id: PassiveId;
  /** nombre visible */
  name: string;
  /** frase breve (barra de PERSONALIZAR, Pase de Batalla) */
  short: string;
  /** explicación más larga (diálogo de información) */
  detail: string;
  /** color de la interfaz y su versión CSS */
  color: number;
  css: string;
}

/**
 * (25-11-2026, usuario) Las 5 pasivas (varios personajes pueden compartir una). `skin` y el nombre del personaje se ponen al asignarla.
 */
const KINDS: Record<PassiveId, Omit<PassiveDef, 'skin' | 'detail'> & { what: string }> = {
  agility: { id: 'agility', name: 'AGILIDAD', short: 'Corres más rápido y llegas más lejos a la pelota.', what: 'Aumenta tu velocidad de movimiento y el alcance de tu raqueta.', color: 0x45d9ff, css: '#8fe8ff' },
  precision: { id: 'precision', name: 'PRECISIÓN', short: 'Tus golpes y tu saque se desvían menos.', what: 'Reduce el desvío de tus golpes (a los lados y en profundidad) y de tu saque.', color: 0xff8fc4, css: '#ffc2dd' },
  strength: { id: 'strength', name: 'FUERZA', short: 'Tus golpes salen más fuertes y rápidos.', what: 'Aumenta la velocidad de tus golpes (no los globos ni las dejadas).', color: 0xff8a4a, css: '#ffb98f' },
  spin: { id: 'spin', name: 'EFECTO', short: 'Tu saque y tu golpe tienen más efecto.', what: 'Aumenta la curva de tu saque con efecto y de tus golpes.', color: 0x5be37a, css: '#9ff0b4' },
  resistance: { id: 'resistance', name: 'RESISTENCIA', short: 'Tu DEFENSIVO se recarga antes.', what: 'Reduce la espera para volver a usar tu DEFENSIVO.', color: 0xffd23f, css: '#ffe58a' },
};

const def = (skin: string, name: string, id: PassiveId): PassiveDef => {
  const { what, ...k } = KINDS[id];
  return { ...k, skin, detail: `${what} Cada nivel de maestría suma un 1 % (hasta un 10 % en el nivel 10) y se aplica en todos tus partidos con ${name}.` };
};

/** Una pasiva por personaje (25-11-2026, usuario: Jun = Resistencia, Zac y Net = Fuerza, Rin = Agilidad, Isa = Efecto, Flo = Resistencia). */
export const PASSIVES: Record<string, PassiveDef> = {
  nxo: def('nxo', 'Nxo', 'agility'),
  mai: def('mai', 'Mai', 'precision'),
  jun: def('jun', 'Jun', 'resistance'),
  mat: def('mat', 'Mat', 'spin'),
  zac: def('zac', 'Zac', 'strength'),
  net: def('net', 'Net', 'strength'),
  rin: def('rin', 'Rin', 'agility'),
  isa: def('isa', 'Isa', 'spin'),
  flo: def('flo', 'Flo', 'resistance'),
};

/** Pasiva de un personaje (undefined si aún no tiene). */
export const passiveOf = (skin: string): PassiveDef | undefined => PASSIVES[skin];

export const MASTERY = {
  /** nivel de CUENTA desde el que se suman puntos (antes, nada) */
  unlockLevel: MAX_LEVEL,
  /** nivel máximo de maestría */
  maxLevel: 10,
  /** lo que vale cada nivel (0,01 = 1 %) */
  pctPerLevel: 0.01,
  /** puntos para subir DESDE el nivel anterior: al 1 → 1, al 2 → 2, al 3 → 4, … al 10 → 40 (1 punto por partido ganado) */
  steps: [1, 2, 4, 8, 12, 16, 20, 25, 30, 40],
} as const;

/** Puntos acumulados necesarios para llegar al nivel 1, 2, … 10 (1, 3, 7, 15, 27, 43, 63, 88, 118, 158). */
export const MASTERY_THRESHOLDS: number[] = MASTERY.steps.reduce<number[]>((acc, s) => [...acc, (acc[acc.length - 1] ?? 0) + s], []);
/** Puntos del nivel máximo (más no se acumula). */
export const MASTERY_MAX_POINTS = MASTERY_THRESHOLDS[MASTERY_THRESHOLDS.length - 1];

const clampPoints = (points: number) => Math.min(MASTERY_MAX_POINTS, Math.max(0, Math.floor(Number.isFinite(points) ? points : 0)));

/** Nivel de maestría (0..10) con `points` puntos. */
export function masteryLevel(points: number): number {
  const p = clampPoints(points);
  let level = 0;
  for (const t of MASTERY_THRESHOLDS) if (p >= t) level++;
  return level;
}

export interface MasteryProgress {
  level: number;
  /** puntos dentro del nivel actual y los que pide el siguiente (0 en el máximo) */
  into: number;
  need: number;
  /** 0..1 hacia el siguiente nivel (1 en el máximo) */
  frac: number;
  max: boolean;
}

export function masteryProgress(points: number): MasteryProgress {
  const p = clampPoints(points);
  const level = masteryLevel(p);
  if (level >= MASTERY.maxLevel) return { level, into: 0, need: 0, frac: 1, max: true };
  const base = level === 0 ? 0 : MASTERY_THRESHOLDS[level - 1];
  const need = MASTERY.steps[level];
  const into = p - base;
  return { level, into, need, frac: need > 0 ? into / need : 1, max: false };
}

/** Valor de la pasiva con `points` puntos: 0 (nivel 0) … 0,10 (nivel 10). */
export function passiveValue(points: number): number {
  return Math.round(masteryLevel(points) * MASTERY.pctPerLevel * 1000) / 1000;
}

/** Lee lo guardado: solo personajes con pasiva, enteros entre 0 y el tope. */
export function sanitizeMastery(raw: unknown): Record<string, number> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Record<string, number> = {};
  for (const [skin, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!PASSIVES[skin] || typeof v !== 'number') continue;
    const p = clampPoints(v);
    if (p > 0) out[skin] = p;
  }
  return Object.keys(out).length ? out : undefined;
}
