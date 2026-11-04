import { MAX_LEVEL, xpToNext } from '../config';
import type { AbilityId } from './Abilities';

/** Perfil del jugador guardado en el dispositivo (localStorage). */
export interface Profile {
  name: string;
  level: number; // 1..MAX_LEVEL
  xp: number; // XP dentro del nivel actual
  style: string;
  abilities: [AbilityId, AbilityId]; // habilidad 1 y 2 equipadas
}

const KEY = 'gamenxo.profile.v1';

const DEFAULT: Profile = { name: 'Jugador', level: 1, xp: 0, style: 'Clásico', abilities: ['dash', 'smash'] };

let cache: Profile | null = null;

export function getProfile(): Profile {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...DEFAULT, ...(JSON.parse(raw) as Partial<Profile>) } : { ...DEFAULT };
  } catch {
    cache = { ...DEFAULT };
  }
  return cache;
}

function save(p: Profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* sin almacenamiento: se juega igual */
  }
}

export interface XpResult {
  gained: number;
  levelsUp: number;
  before: { level: number; xp: number };
  after: { level: number; xp: number };
}

/** Suma XP, sube de nivel si corresponde (máximo MAX_LEVEL) y guarda. */
export function addXp(amount: number): XpResult {
  const p = getProfile();
  const before = { level: p.level, xp: p.xp };
  let levelsUp = 0;
  p.xp += amount;
  while (p.level < MAX_LEVEL && p.xp >= xpToNext(p.level)) {
    p.xp -= xpToNext(p.level);
    p.level++;
    levelsUp++;
  }
  if (p.level >= MAX_LEVEL) {
    p.level = MAX_LEVEL;
    p.xp = 0;
  }
  save(p);
  return { gained: amount, levelsUp, before, after: { level: p.level, xp: p.xp } };
}

/** Progreso 0..1 dentro del nivel actual. */
export function levelProgress(p: { level: number; xp: number }) {
  if (p.level >= MAX_LEVEL) return 1;
  return p.xp / xpToNext(p.level);
}
