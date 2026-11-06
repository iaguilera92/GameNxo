/**
 * Modelo de datos del jugador (progresión y economía).
 *
 * Capa de dominio: TypeScript puro, SIN Phaser ni DOM. Pensada para moverse tal cual al
 * backend (Node) cuando llegue el online: el servidor validará las mismas operaciones.
 * Solo se importan TIPOS de otros módulos (se borran al compilar).
 */
import type { AbilityId } from '../logic/Abilities';
import type { SkinId } from '../characters/skins';

export const PLAYER_SCHEMA_VERSION = 2;

export type StyleId = 'classic' | 'red' | 'green' | 'gold';
export type ItemKind = 'ability' | 'skin' | 'style';
/** Id único de ítem: `<tipo>:<id>` (ej. 'ability:wall', 'skin:mai'). */
export type ItemId = `ability:${AbilityId}` | `skin:${SkinId}` | `style:${StyleId}`;

export interface Loadout {
  skin: SkinId;
  style: StyleId;
  abilities: [AbilityId, AbilityId];
}

export interface PlayerState {
  version: typeof PLAYER_SCHEMA_VERSION;
  name: string;
  level: number; // 1..MAX_LEVEL
  xp: number; // XP dentro del nivel actual
  coins: number; // moneda blanda (se gana jugando)
  gems: number; // moneda premium (reservada)
  owned: ItemId[];
  equipped: Loadout;
}

export const itemId = {
  ability: (id: AbilityId): ItemId => `ability:${id}`,
  skin: (id: SkinId): ItemId => `skin:${id}`,
  style: (id: StyleId): ItemId => `style:${id}`,
};

export const STARTER_ITEMS: ItemId[] = ['ability:dash', 'ability:smash', 'skin:nxo', 'skin:mai', 'style:classic'];
export const STARTING_COINS = 250;

export function newPlayer(): PlayerState {
  return {
    version: PLAYER_SCHEMA_VERSION,
    name: 'Nxo',
    level: 1,
    xp: 0,
    coins: STARTING_COINS,
    gems: 0,
    owned: [...STARTER_ITEMS],
    equipped: { skin: 'nxo', style: 'classic', abilities: ['dash', 'smash'] },
  };
}

export function owns(s: PlayerState, id: ItemId) {
  return s.owned.includes(id);
}

/** Copia profunda (las operaciones nunca mutan el estado recibido). */
export function clonePlayer(s: PlayerState): PlayerState {
  return { ...s, owned: [...s.owned], equipped: { ...s.equipped, abilities: [...s.equipped.abilities] } };
}
