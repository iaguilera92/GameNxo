/** Progresión permanente de los atributos que se aplican durante el estado Zona. */
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
  stats: ZoneStatLevels;
}

export const ZONE_STAT_MAX = 20;
export const ZONE_RAY_BONUS = 0.01;

export const newZoneProgress = (): ZoneProgress => ({
  rays: 0,
  stats: { strength: 0, speed: 0, precision: 0, agility: 0, resistance: 0 },
});

export function cloneZoneProgress(z: ZoneProgress): ZoneProgress {
  return { rays: z.rays, stats: { ...z.stats } };
}

export function sanitizeZoneProgress(raw: unknown): ZoneProgress {
  const root = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const stats = (root.stats && typeof root.stats === 'object' ? root.stats : {}) as Record<string, unknown>;
  const level = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(ZONE_STAT_MAX, Math.floor(value))) : 0;
  return {
    rays: typeof root.rays === 'number' && Number.isFinite(root.rays) ? Math.max(0, Math.floor(root.rays)) : 0,
    stats: {
      strength: level(stats.strength),
      speed: level(stats.speed),
      precision: level(stats.precision),
      agility: level(stats.agility),
      resistance: level(stats.resistance),
    },
  };
}

export const zoneStatPercent = (level: number) => Math.min(ZONE_STAT_MAX, Math.max(0, Math.floor(level))) * ZONE_RAY_BONUS;
