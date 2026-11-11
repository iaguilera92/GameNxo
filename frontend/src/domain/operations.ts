/**
 * Operaciones del jugador: funciones puras (estado -> nuevo estado + resultado).
 * No guardan nada: eso lo hace playerStore. En el online, el servidor ejecutará estas mismas
 * funciones para validar (el cliente nunca decide sus monedas).
 */
import { MAX_LEVEL, xpToNext } from '../config';
import type { AbilityId } from '../logic/Abilities';
import type { SkinId } from '../characters/skins';
import { type ItemId, type PlayerState, type StyleId, clonePlayer, itemId, owns } from './player';
import { shopItem } from './shopCatalog';
import { bpAddXpInPlace } from './battlePassConfig';
import { ZONE_STAT_MAX, type ZoneStatKey } from './zoneProgress';
import { type InfernoPower, infernoOwned, isInfernoPower } from './infernoPowers';
import { type ChargeFxId, chargeFxOwned, isChargeFx } from './chargeFx';
import { type SmashPower, isSmashPower, smashOwned } from './smashPowers';
import { type DefensivePower, defensiveOwned, isDefensivePower } from './defensivePowers';

export type OpError =
  | 'invalid_amount'
  | 'not_enough_coins'
  | 'not_found'
  | 'not_available'
  | 'level_too_low'
  | 'already_owned'
  | 'not_owned'
  | 'duplicate_ability'
  | 'not_enough_cash'
  | 'not_enough_rays'
  | 'stat_maxed';

export type OpResult<T = object> = ({ ok: true; state: PlayerState } & T) | { ok: false; error: OpError };

const fail = (error: OpError): { ok: false; error: OpError } => ({ ok: false, error });

// ---------------------------------------------------------------- progresión

export interface XpGain {
  gained: number;
  levelsUp: number;
  before: { level: number; xp: number };
  after: { level: number; xp: number };
}

export function addXp(s: PlayerState, amount: number): OpResult<{ xp: XpGain }> {
  if (!Number.isFinite(amount) || amount < 0) return fail('invalid_amount');
  const n = clonePlayer(s);
  const before = { level: n.level, xp: n.xp };
  let levelsUp = 0;
  n.xp += Math.floor(amount);
  // toda la EXP ganada llena también el pase de batalla de la temporada
  bpAddXpInPlace(n, amount);
  while (n.level < MAX_LEVEL && n.xp >= xpToNext(n.level)) {
    n.xp -= xpToNext(n.level);
    n.level++;
    levelsUp++;
  }
  if (n.level >= MAX_LEVEL) {
    n.level = MAX_LEVEL;
    n.xp = 0;
  }
  return { ok: true, state: n, xp: { gained: Math.floor(amount), levelsUp, before, after: { level: n.level, xp: n.xp } } };
}

/** Progreso 0..1 dentro del nivel actual. */
export function levelProgress(p: { level: number; xp: number }) {
  if (p.level >= MAX_LEVEL) return 1;
  return p.xp / xpToNext(p.level);
}

// ---------------------------------------------------------------- monedas

export function addCoins(s: PlayerState, amount: number): OpResult {
  if (!Number.isInteger(amount) || amount < 0) return fail('invalid_amount');
  const n = clonePlayer(s);
  n.coins += amount;
  return { ok: true, state: n };
}

export function spendCoins(s: PlayerState, amount: number): OpResult {
  if (!Number.isInteger(amount) || amount < 0) return fail('invalid_amount');
  if (s.coins < amount) return fail('not_enough_coins');
  const n = clonePlayer(s);
  n.coins -= amount;
  return { ok: true, state: n };
}

/** Gasta 1 Rayo para mejorar exactamente 1% un atributo de Zona, hasta 20 niveles. */
export function upgradeZoneStat(s: PlayerState, stat: ZoneStatKey): OpResult {
  if (s.zone.rays < 1) return fail('not_enough_rays');
  if (s.zone.stats[stat] >= ZONE_STAT_MAX) return fail('stat_maxed');
  const n = clonePlayer(s);
  n.zone.rays -= 1;
  n.zone.stats[stat] += 1;
  return { ok: true, state: n };
}

// ---------------------------------------------------------------- tienda / inventario

export function purchase(s: PlayerState, id: ItemId): OpResult {
  if (owns(s, id)) return fail('already_owned');
  const item = shopItem(id);
  if (!item) return fail('not_found');
  if (!item.available) return fail('not_available');
  if (s.level < item.minLevel) return fail('level_too_low');
  // la Tienda cobra DINERO: las monedas son la moneda competitiva (Ranked)
  if (!Number.isInteger(item.price) || item.price < 0) return fail('invalid_amount');
  if (s.gems < item.price) return fail('not_enough_cash');
  const n = clonePlayer(s);
  n.gems -= item.price;
  n.owned.push(id);
  return { ok: true, state: n };
}

/** Desbloqueo gratuito (recompensas de nivel, eventos…). Idempotente. */
export function grantItem(s: PlayerState, id: ItemId): OpResult {
  if (owns(s, id)) return { ok: true, state: s };
  const n = clonePlayer(s);
  n.owned.push(id);
  return { ok: true, state: n };
}

// ---------------------------------------------------------------- equipamiento

export function equipSkin(s: PlayerState, skin: SkinId): OpResult {
  if (!owns(s, itemId.skin(skin))) return fail('not_owned');
  const n = clonePlayer(s);
  n.equipped.skin = skin;
  return { ok: true, state: n };
}

export function equipStyle(s: PlayerState, style: StyleId): OpResult {
  if (!owns(s, itemId.style(style))) return fail('not_owned');
  const n = clonePlayer(s);
  n.equipped.style = style;
  return { ok: true, state: n };
}

/** Elige el poder del INFERNO (solo uno que tengas: fuego, el de tu personaje o uno comprado). */
/** Elige el poder del ESPECIAL / SMASH (solo uno que tengas: fuego o uno comprado). */
export function equipSmash(s: PlayerState, power: SmashPower): OpResult {
  if (!isSmashPower(power)) return fail('not_found');
  if (!smashOwned(s.owned, power)) return fail('not_owned');
  const n = clonePlayer(s);
  n.equipped.smash = power;
  return { ok: true, state: n };
}

/** Elige el efecto de CARGA (solo uno que tengas: el clásico, el de tu personaje o uno comprado). */
export function equipCharge(s: PlayerState, fx: ChargeFxId): OpResult {
  if (!isChargeFx(fx)) return fail('not_found');
  if (!chargeFxOwned(s.owned, fx, s.equipped.skin)) return fail('not_owned');
  const n = clonePlayer(s);
  n.equipped.charge = fx;
  return { ok: true, state: n };
}

/** Elige el poder del DEFENSIVO (solo uno que tengas: el DASH o uno comprado). */
export function equipDefensive(s: PlayerState, power: DefensivePower): OpResult {
  if (!isDefensivePower(power)) return fail('not_found');
  if (!defensiveOwned(s.owned, power)) return fail('not_owned');
  const n = clonePlayer(s);
  n.equipped.defensive = power;
  return { ok: true, state: n };
}

export function equipInferno(s: PlayerState, power: InfernoPower): OpResult {
  if (!isInfernoPower(power)) return fail('not_found');
  if (!infernoOwned(s.owned, power, s.equipped.skin)) return fail('not_owned');
  const n = clonePlayer(s);
  n.equipped.inferno = power;
  return { ok: true, state: n };
}

/** Equipa una habilidad en el slot 0 o 1. Si ya está en el otro slot, se intercambian. */
export function equipAbility(s: PlayerState, slot: 0 | 1, ability: AbilityId): OpResult {
  if (!owns(s, itemId.ability(ability))) return fail('not_owned');
  const n = clonePlayer(s);
  const other = slot === 0 ? 1 : 0;
  if (n.equipped.abilities[other] === ability) n.equipped.abilities[other] = n.equipped.abilities[slot];
  n.equipped.abilities[slot] = ability;
  if (n.equipped.abilities[0] === n.equipped.abilities[1]) return fail('duplicate_ability');
  return { ok: true, state: n };
}
