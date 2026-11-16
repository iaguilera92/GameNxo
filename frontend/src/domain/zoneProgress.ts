/**
 * Progresión permanente de los atributos que se aplican durante el estado Zona.
 * (15-11-2026) Los atributos son POR PERSONAJE: `stats[skin]`. Los Rayos (`rays`) siguen siendo de la cuenta: el jugador elige en qué
 * personaje gastarlos. Ver docs/MAESTRIAS.md.
 */
export const ZONE_STAT_KEYS = ['strength', 'speed', 'precision', 'agility', 'resistance'] as const;
export type ZoneStatKey = (typeof ZONE_STAT_KEYS)[number];

export interface ZoneStatLevels {
  strength: number;
  speed: number;
  precision: number;
  agility: number;
  resistance: number;
}

export interface ZoneProgress {
  rays: number;
  /** atributos por personaje (id de skin); un personaje sin entrada tiene todo en 0 */
  stats: Record<string, ZoneStatLevels>;
}

export const ZONE_STAT_MAX = 20;
export const ZONE_RAY_BONUS = 0.01;
/** personaje al que pasan los atributos guardados antes de que la ZONA fuera por personaje (el inicial) */
export const ZONE_LEGACY_SKIN = 'nxo';

export const emptyZoneStats = (): ZoneStatLevels => ({ strength: 0, speed: 0, precision: 0, agility: 0, resistance: 0 });

export const newZoneProgress = (): ZoneProgress => ({ rays: 0, stats: {} });

/** Atributos de un personaje (copia; todo en 0 si aún no subió ninguno). */
export function zoneStatsOf(z: Readonly<ZoneProgress>, skin: string): ZoneStatLevels {
  return { ...emptyZoneStats(), ...(z.stats[skin] ?? {}) };
}

export function cloneZoneProgress(z: ZoneProgress): ZoneProgress {
  const stats: Record<string, ZoneStatLevels> = {};
  for (const [k, v] of Object.entries(z.stats)) stats[k] = { ...v };
  return { rays: z.rays, stats };
}

const level = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(ZONE_STAT_MAX, Math.floor(value))) : 0);

function sanitizeLevels(raw: unknown): ZoneStatLevels {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return { strength: level(r.strength), speed: level(r.speed), precision: level(r.precision), agility: level(r.agility), resistance: level(r.resistance) };
}

/** Ids de personaje que se aceptan al leer lo guardado (letras, números, guion): evita claves raras. */
const SKIN_KEY = /^[a-z0-9_-]{1,24}$/;

export function sanitizeZoneProgress(raw: unknown): ZoneProgress {
  const root = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const rays = typeof root.rays === 'number' && Number.isFinite(root.rays) ? Math.max(0, Math.floor(root.rays)) : 0;
  const src = (root.stats && typeof root.stats === 'object' ? root.stats : {}) as Record<string, unknown>;
  const stats: Record<string, ZoneStatLevels> = {};
  // formato anterior a la ZONA por personaje: un solo bloque con los 5 atributos → pasa al personaje inicial
  if (ZONE_STAT_KEYS.some((k) => typeof src[k] === 'number')) {
    const legacy = sanitizeLevels(src);
    if (ZONE_STAT_KEYS.some((k) => legacy[k] > 0)) stats[ZONE_LEGACY_SKIN] = legacy;
    return { rays, stats };
  }
  for (const [skin, v] of Object.entries(src).slice(0, 16)) {
    if (!SKIN_KEY.test(skin) || !v || typeof v !== 'object') continue;
    const lv = sanitizeLevels(v);
    if (ZONE_STAT_KEYS.some((k) => lv[k] > 0)) stats[skin] = lv;
  }
  return { rays, stats };
}

export const zoneStatPercent = (level: number) => Math.min(ZONE_STAT_MAX, Math.max(0, Math.floor(level))) * ZONE_RAY_BONUS;
