/**
 * Modelo de datos del jugador (progresión y economía).
 *
 * Capa de dominio: TypeScript puro, SIN Phaser ni DOM. Pensada para moverse tal cual al
 * backend (Node) cuando llegue el online: el servidor validará las mismas operaciones.
 * Solo se importan TIPOS de otros módulos (se borran al compilar).
 */
import type { AbilityId } from '../logic/Abilities';
import type { SkinId } from '../characters/skins';
import type { RankId } from './ranks';
import { type WheelState, cloneWheel, newWheelState } from './wheelState';
import { type BattlePassState, cloneBattlePass, newBattlePass } from './battlePassState';
import { type RankedState, cloneRanked, newRankedState } from './rankedState';
import { type League2v2State, cloneLeague2v2 } from './league2v2State';
import { type ZoneProgress, cloneZoneProgress, newZoneProgress } from './zoneProgress';
import type { InfernoPower } from './infernoPowers';
import type { ChargeFxId } from './chargeFx';
import type { SmashPower } from './smashPowers';
import type { DefensivePower } from './defensivePowers';
import type { EmoteKind } from './emotes';
import type { CharColorId, ColorSkin } from './charColors';

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

/** Efectos de pelota (estelas). `classic` = POR DEFECTO (sin estela). Los ids no se cambian nunca. */
export type StyleId = 'classic' | 'blue' | 'red' | 'green' | 'gold' | 'pink' | 'rainbow' | 'ember' | 'frost' | 'tulip' | 'hearts' | 'stars' | 'neon' | 'smoke';
export type ItemKind = 'ability' | 'skin' | 'style' | 'inferno' | 'charge' | 'defensive' | 'smash' | 'emote' | 'color' | 'zone';
/** Id único de ítem: `<tipo>:<id>` (ej. 'ability:wall', 'skin:mai'). Los `emote:` solo se ganan en el Pase de Batalla. */
export type ItemId = `ability:${AbilityId}` | `skin:${SkinId}` | 'skin:net' | 'skin:rin' | 'skin:zac' | 'skin:flo' | `style:${StyleId}` | `inferno:${InfernoPower}` | `charge:${ChargeFxId}` | `defensive:${DefensivePower}` | `smash:${SmashPower}` | `emote:${EmoteKind}` | `color:${CharColorId}` | `color:${CharColorId}:${ColorSkin}` | `zone:${'fire' | 'shadow'}`;

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
  /** ESTILO DE ZONA (domain/zoneSkins.ts): cómo se ve tu ZONA; sin elegir = Eléctrica */
  zone?: 'fire' | 'shadow';
  /** MARCO del perfil (domain/profileFrames.ts: el de una liga ya alcanzada); sin elegir = borde azul */
  frame?: RankId;
  /** MARCO 2v2 del perfil (domain/profileFrames.ts: el de una liga 2v2 ya alcanzada); si está, manda sobre `frame` en la card del perfil */
  frame2v2?: RankId;
}

import type { ChestState } from './chest';

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
  /** LIGA 2v2 (domain/league2v2.ts): liga, neto semanal de MONEDAS 2v2 y recompensas; sin datos = se crea al sincronizar */
  league2v2?: League2v2State;
  /** recompensa por iniciar sesión (domain/dailyLogin.ts) */
  login: LoginState;
  /** Rayos y atributos que mejoran al entrar en Zona. */
  zone: ZoneProgress;
  /** REGALO GRATIS de la Tienda: ciclo (día) en que se recogió por última vez (domain/shopGift.ts) */
  giftDay?: string;
  /** TUTORIAL por nivel: ids de los avisos ya vistos (domain/tutorial.ts). Va con la cuenta. */
  tutorial?: string[];
  /** COFRE EVOLUTIVO de la ruleta (domain/chest.ts); sin cofre = undefined */
  chest?: ChestState;
  /** MAESTRÍAS: puntos por personaje (id de skin). Se ganan al ganar partidos, desde el nivel 20 de la cuenta (domain/characterPassives.ts). Sin puntos = undefined */
  mastery?: Record<string, number>;
  /** MODO RIESGO x2 (domain/riskMode.ts): última activación confirmada por el servidor; nunca usado = undefined */
  riskMode?: RiskModeState;
  /** MONEDAS 2v2 (domain/coins2v2.ts): contador propio del ranking del 2v2; 0 = undefined */
  coins2v2?: number;
  /** CAMBIO de ofertas de la Tienda (domain/shopRotation.ts): semana (su lunes) y categorías ya cambiadas pagando dinero; vale una vez por categoría y semana */
  shopReroll?: ShopRerollState;
  /** (24-11-2026, usuario) ya pasó la pantalla de inicio (nombre de usuario y personaje elegido, sin vuelta atrás: operations.completeOnboarding) */
  onboarded?: boolean;
}
/** categorías de la Tienda ya cambiadas en una semana (week = lunes AAAA-MM-DD) */
export interface ShopRerollState {
  week: string;
  kinds: ItemKind[];
}
import type { RiskModeState } from './riskMode';

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

// (24-11-2026, usuario) NXO ya no es de todos: cada cuenta tiene SOLO el personaje que eligió al empezar (newPlayer / completeOnboarding)
export const STARTER_ITEMS: ItemId[] = ['ability:dash', 'ability:smash', 'style:classic'];
/** (25-11-2026, usuario) la cuenta nueva parte con 0 monedas (antes 5000 = 10 entradas de Bronce) */
export const STARTING_COINS = 0;

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
    owned: [...STARTER_ITEMS, `skin:${starter}` as ItemId],
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
  return { ...s, owned: [...s.owned], equipped: { ...s.equipped, abilities: [...s.equipped.abilities] }, wheel: cloneWheel(s.wheel), bp: cloneBattlePass(s.bp), ranked: cloneRanked(s.ranked), ...(s.league2v2 ? { league2v2: cloneLeague2v2(s.league2v2) } : {}), login: { ...s.login, days: [...(s.login.days ?? [])] }, zone: cloneZoneProgress(s.zone), ...(s.tutorial ? { tutorial: [...s.tutorial] } : {}), ...(s.chest ? { chest: { ...s.chest } } : {}), ...(s.mastery ? { mastery: { ...s.mastery } } : {}), ...(s.riskMode ? { riskMode: { ...s.riskMode } } : {}), ...(s.shopReroll ? { shopReroll: { week: s.shopReroll.week, kinds: [...s.shopReroll.kinds] } } : {}) };
}
