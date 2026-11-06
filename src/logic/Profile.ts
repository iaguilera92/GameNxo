import type { AbilityId } from './Abilities';
import { getPlayer, commit } from '../domain/playerStore';
import * as ops from '../domain/operations';
import type { SkinId } from '../characters/skins';

/**
 * Fachada de compatibilidad: las escenas (incluida MatchScene) siguen usando esta API.
 * Los datos reales viven en src/domain (PlayerState + playerStore).
 */
export interface Profile {
  name: string;
  level: number; // 1..MAX_LEVEL
  xp: number; // XP dentro del nivel actual
  style: string;
  abilities: [AbilityId, AbilityId]; // habilidad 1 y 2 equipadas
  /** personaje elegido (id de skin del catálogo) */
  skin: string;
}

/**
 * Personaje fijo para todos (p. ej. 'nxo'). `null` = usar la skin guardada en el perfil
 * (por defecto Nxo; en PERSONAJE hay un selector TEMPORAL Hombre/Mujer para pruebas).
 */
export const FORCED_SKIN: SkinId | null = null;

/** Vista de solo lectura del jugador con la forma antigua. */
export function getProfile(): Profile {
  const s = getPlayer();
  return {
    name: s.name,
    level: s.level,
    xp: s.xp,
    style: s.equipped.style,
    abilities: [...s.equipped.abilities] as [AbilityId, AbilityId],
    skin: FORCED_SKIN ?? s.equipped.skin,
  };
}

export type XpResult = ops.XpGain;

/** Suma XP, sube de nivel si corresponde (máximo MAX_LEVEL) y guarda. */
export function addXp(amount: number): XpResult {
  const res = commit((s) => ops.addXp(s, amount));
  if (res.ok) return res.xp;
  const { level, xp } = getPlayer();
  return { gained: 0, levelsUp: 0, before: { level, xp }, after: { level, xp } };
}

export const levelProgress = ops.levelProgress;

/** Cambia el personaje elegido y lo guarda (solo si el jugador lo posee). */
export function setSkin(id: string) {
  commit((s) => ops.equipSkin(s, id as SkinId));
}
