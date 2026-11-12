/**
 * Modelo de datos del jugador (progresión y economía).
 *
 * Capa de dominio: TypeScript puro, SIN Phaser ni DOM. Pensada para moverse tal cual al
 * backend (Node) cuando llegue el online: el servidor validará las mismas operaciones.
 * Solo se importan TIPOS de otros módulos (se borran al compilar).
 */
import type { AbilityId } from '../logic/Abilities';
import type { SkinId } from '../characters/skins';
import { type WheelState, cloneWheel, newWheelState } from './wheelState';
import { type BattlePassState, cloneBattlePass, newBattlePass } from './battlePassState';
import { type RankedState, cloneRanked, newRankedState } from './rankedState';
import { type ZoneProgress, cloneZoneProgress, newZoneProgress } from './zoneProgress';
import type { InfernoPower } from './infernoPowers';
import type { ChargeFxId } from './chargeFx';
import type { SmashPower } from './smashPowers';
import type { DefensivePower } from './defensivePowers';
import type { EmoteKind } from './emotes';
import type { CharColorId } from './charColors';

/** v3: + ruletas diarias (`wheel`) · v4: + pase de batalla (`bp`) · v5: + Ranked (`ranked`) y premio diario (`login`) */
export const PLAYER_SCHEMA_VERSION = 7;

/** Recompensa por iniciar sesión (domain/dailyLogin.ts). */
export interface LoginState {
  /** último día reclamado (AAAA-MM-DD del ciclo diario) */
  last: string;
  /** días reclamados en la semana en curso (antes: día de la racha; 0 = ninguno) */
  streak: number;
  /** día del último bonus por anuncio para evitar reclamarlo más de una vez */
  adBonusDay?: string;
  /** semana en curso: su lunes (AAAA-MM-DD) */
  week?: string;
  /** días reclamados de esa semana (0 = lunes … 6 = domingo) */
  days?: number[];
}
export const newLoginState = (): LoginState => ({ last: '', streak: 0, adBonusDay: '', week: '', days: [] });

export type StyleId = 'classic' | 'red' | 'green' | 'gold' | 'pink';
export type ItemKind = 'ability' | 'skin' | 'style' | 'inferno' | 'charge' | 'defensive' | 'smash' | 'emote' | 'color';
/** Id único de ítem: `<tipo>:<id>` (ej. 'ability:wall', 'skin:mai'). Los `emote:` solo se ganan en el Pase de Batalla. */
export type ItemId = `ability:${AbilityId}` | `skin:${SkinId}` | `style:${StyleId}` | `inferno:${InfernoPower}` | `charge:${ChargeFxId}` | `defensive:${DefensivePower}` | `smash:${SmashPower}` | `emote:${EmoteKind}` | `color:${CharColorId}`;

export interface Loadout {
  skin: SkinId;
  style: StyleId;
  abilities: [AbilityId, AbilityId];
  /** poder del INFERNO elegido (domain/infernoPowers.ts); sin elegir = el del personaje */
  inferno?: InfernoPower;
  /** efecto de CARGA elegido (domain/chargeFx.ts); sin elegir = el del personaje */
  charge?: ChargeFxId;
  /** poder del ESPECIAL (SMASH) elegido (domain/smashPowers.ts); sin elegir = fuego */
  smash?: SmashPower;
  /** poder del DEFENSIVO elegido (domain/defensivePowers.ts); sin elegir = DASH */
  defensive?: DefensivePower;
  /** ESTILO DE COLOR del personaje (domain/charColors.ts); sin elegir = clásico */
  color?: CharColorId;
}

export interface PlayerState {
  version: typeof PLAYER_SCHEMA_VERSION;
  name: string;
  level: number; // 1..MAX_LEVEL
  xp: number; // XP dentro del nivel actual
  coins: number; // MONEDAS: moneda competitiva (entradas Ranked y clasificación). No se usa en la Tienda.
  gems: number; // DINERO (billetes): moneda de la Tienda y del Pase Premium
  owned: ItemId[];
  equipped: Loadout;
  /** ruletas de recompensas diarias (domain/dailyWheel.ts) */
  wheel: WheelState;
  /** pase de batalla de la temporada (domain/battlePass.ts) */
  bp: BattlePassState;
  /** competitivo: liga, temporada semanal, partidas (domain/ranked.ts) */
  ranked: RankedState;
  /** recompensa por iniciar sesión (domain/dailyLogin.ts) */
  login: LoginState;
  /** Rayos y atributos que mejoran al entrar en Zona. */
  zone: ZoneProgress;
}

export const itemId = {
  ability: (id: AbilityId): ItemId => `ability:${id}`,
  skin: (id: SkinId): ItemId => `skin:${id}`,
  style: (id: StyleId): ItemId => `style:${id}`,
  inferno: (id: InfernoPower): ItemId => `inferno:${id}`,
  charge: (id: ChargeFxId): ItemId => `charge:${id}`,
  smash: (id: SmashPower): ItemId => `smash:${id}`,
  defensive: (id: DefensivePower): ItemId => `defensive:${id}`,
  emote: (id: EmoteKind): ItemId => `emote:${id}`,
  color: (id: CharColorId): ItemId => `color:${id}`,
};

export const STARTER_ITEMS: ItemId[] = ['ability:dash', 'ability:smash', 'skin:nxo', 'style:classic'];
/** 10 entradas de Bronce (500): un jugador nuevo puede jugar 10 Ranked aunque las pierda todas (docs/ECONOMIA.md) */
export const STARTING_COINS = 5000;

/** Personaje con el que empieza un jugador nuevo: Nxo en la app (APK); Mai en la web (lo elige main.ts). */
export type StarterSkin = 'nxo' | 'mai';

export function newPlayer(starter: StarterSkin = 'nxo'): PlayerState {
  return {
    version: PLAYER_SCHEMA_VERSION,
    name: starter === 'mai' ? 'Mai' : 'Nxo',
    level: 1,
    xp: 0,
    coins: STARTING_COINS,
    gems: 0,
    // Nxo es de todos; empezar con Mai la deja además en propiedad (ítem skin:mai)
    owned: starter === 'mai' ? [...STARTER_ITEMS, 'skin:mai'] : [...STARTER_ITEMS],
    equipped: { skin: starter, style: 'classic', abilities: ['dash', 'smash'] },
    wheel: newWheelState(),
    bp: newBattlePass(),
    ranked: newRankedState(),
    login: newLoginState(),
    zone: newZoneProgress(),
  };
}

export function owns(s: PlayerState, id: ItemId) {
  return s.owned.includes(id);
}

/** Copia profunda (las operaciones nunca mutan el estado recibido). */
export function clonePlayer(s: PlayerState): PlayerState {
  return { ...s, owned: [...s.owned], equipped: { ...s.equipped, abilities: [...s.equipped.abilities] }, wheel: cloneWheel(s.wheel), bp: cloneBattlePass(s.bp), ranked: cloneRanked(s.ranked), login: { ...s.login, days: [...(s.login.days ?? [])] }, zone: cloneZoneProgress(s.zone) };
}
