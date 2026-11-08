import { MAX_LEVEL } from '../config';
import { getSettings } from '../logic/Settings';

/**
 * Perfiles de dificultad del rival (habilidad BASE, fija durante el partido).
 *
 * No confundir con los futuros modos de comportamiento (NORMAL / CONCENTRADO / COMPETITIVO),
 * que serán variaciones temporales encima de este perfil.
 *
 * `difficulty` (0..1) alimenta las fórmulas de siempre de BotAI (velocidad, reacción, error,
 * golpes fuera, puntería) y de ServeAI. "Normal" (0.45) = el comportamiento previo a los perfiles.
 */
export type BotTier = 'principiante' | 'facil' | 'normal' | 'dificil' | 'experto';

export interface BotProfile {
  tier: BotTier;
  name: string;
  /** 0..1 */
  difficulty: number;
  /** nivel que se muestra del rival (pantalla VS) */
  level: number;
}

const TIERS: { tier: BotTier; name: string; difficulty: number; fromLevel: number }[] = [
  { tier: 'principiante', name: 'Principiante', difficulty: 0.24, fromLevel: 1 },
  { tier: 'facil', name: 'Fácil', difficulty: 0.34, fromLevel: 4 },
  { tier: 'normal', name: 'Normal', difficulty: 0.45, fromLevel: 9 },
  { tier: 'dificil', name: 'Difícil', difficulty: 0.6, fromLevel: 17 },
  { tier: 'experto', name: 'Experto', difficulty: 0.75, fromLevel: 25 },
];

/** Perfil por tramo de nivel del rival. */
export function profileForLevel(level: number): BotProfile {
  const lv = Math.max(1, Math.min(MAX_LEVEL, Math.round(level)));
  let t = TIERS[0];
  for (const x of TIERS) if (lv >= x.fromLevel) t = x;
  return { tier: t.tier, name: t.name, difficulty: t.difficulty, level: lv };
}

/** Nivel del rival para un jugador: cerca del suyo (−2..+2), dentro de 1..MAX_LEVEL. */
export function rivalLevelFor(playerLevel: number, rnd = Math.random): number {
  const delta = Math.floor(rnd() * 5) - 2;
  return Math.max(1, Math.min(MAX_LEVEL, Math.round(playerLevel) + delta));
}

/**
 * Perfil para un partido. Pruebas: localStorage 'dev.botTier' = 'experto' (etc.) fuerza el tramo.
 */
export function profileForMatch(rivalLevel: number): BotProfile {
  const p = profileForLevel(rivalLevel);
  let forced: string | null = null;
  try {
    forced = localStorage.getItem('dev.botTier');
  } catch {
    /* sin almacenamiento */
  }
  // dificultad elegida por el jugador en AJUSTES (AUTO = por el nivel del rival)
  if (!forced) {
    const chosen = getSettings().rival;
    if (chosen !== 'auto') forced = chosen;
  }
  const f = TIERS.find((x) => x.tier === forced);
  return f ? { tier: f.tier, name: f.name, difficulty: f.difficulty, level: p.level } : p;
}
