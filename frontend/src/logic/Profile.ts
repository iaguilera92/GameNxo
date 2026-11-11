import type { AbilityId } from './Abilities';
import { getPlayer, commit } from '../domain/playerStore';
import * as ops from '../domain/operations';
import type { SkinId } from '../characters/skins';
import type { ZoneStatLevels } from '../domain/zoneProgress';
import { type InfernoPower, infernoPowerOf } from '../domain/infernoPowers';
import { type ChargeFxId, chargeFxOf } from '../domain/chargeFx';
import { type SmashPower, smashPowerOf } from '../domain/smashPowers';
import { type DefensivePower, defensivePowerOf } from '../domain/defensivePowers';

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
  zoneStats: ZoneStatLevels;
  /** poder del INFERNO en uso: el elegido o, sin elegir, el del personaje (domain/infernoPowers.ts) */
  inferno: InfernoPower;
  /** efecto de CARGA en uso: el elegido o, sin elegir, el del personaje (domain/chargeFx.ts) */
  charge: ChargeFxId;
  /** poder del ESPECIAL (SMASH) en uso: el elegido o fuego (domain/smashPowers.ts) */
  smash: SmashPower;
  /** poder del DEFENSIVO en uso: el elegido o el DASH (domain/defensivePowers.ts) */
  defensive: DefensivePower;
}

/**
 * Personaje fijo para todos (p. ej. 'nxo'). `null` = usar la skin guardada en el perfil
 * (por defecto Nxo; en PERSONAJE hay un selector TEMPORAL Hombre/Mujer para pruebas).
 */
export const FORCED_SKIN: SkinId | null = null;

/** Vista de solo lectura del jugador con la forma antigua. */
export function getProfile(): Profile {
  const s = getPlayer();
  const skin = FORCED_SKIN ?? s.equipped.skin;
  return {
    name: s.name,
    level: s.level,
    xp: s.xp,
    style: s.equipped.style,
    abilities: [...s.equipped.abilities] as [AbilityId, AbilityId],
    skin,
    zoneStats: { ...s.zone.stats },
    inferno: infernoPowerOf(s.equipped.inferno, skin),
    charge: chargeFxOf(s.equipped.charge, skin),
    smash: smashPowerOf(s.equipped.smash),
    defensive: defensivePowerOf(s.equipped.defensive),
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

/** Suma monedas y guarda. Devuelve lo ganado y el total antes/después. */
export function addCoins(amount: number): { gained: number; before: number; after: number } {
  const before = getPlayer().coins;
  const res = commit((s) => ops.addCoins(s, amount));
  const after = getPlayer().coins;
  return { gained: res.ok ? after - before : 0, before, after };
}

/** Cambia el personaje elegido y lo guarda (solo si el jugador lo posee). */
export function setSkin(id: string) {
  commit((s) => ops.equipSkin(s, id as SkinId));
}

/** Cambia el poder del ESPECIAL (SMASH) y lo guarda (solo si lo tiene). */
export function setSmash(id: SmashPower) {
  commit((s) => ops.equipSmash(s, id));
}

/** Cambia el efecto de CARGA y lo guarda (solo si lo tiene). */
export function setCharge(id: ChargeFxId) {
  commit((s) => ops.equipCharge(s, id));
}

/** Cambia el poder del DEFENSIVO y lo guarda (solo si lo tiene). */
export function setDefensive(id: DefensivePower) {
  commit((s) => ops.equipDefensive(s, id));
}

/** Cambia el poder del INFERNO y lo guarda. */
export function setInferno(id: InfernoPower) {
  commit((s) => ops.equipInferno(s, id));
}
