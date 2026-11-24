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
import { TUTORIAL_GIFTS } from './tutorial';
import { bpAddXpInPlace } from './battlePassConfig';
import { ZONE_STAT_MAX, type ZoneStatKey, zoneStatsOf } from './zoneProgress';
import { MASTERY, MASTERY_MAX_POINTS, passiveOf } from './characterPassives';
import { type InfernoPower, infernoOwned, isInfernoPower } from './infernoPowers';
import { type ChargeFxId, chargeFxOwned, isChargeFx } from './chargeFx';
import { type CharColorId, charColorOwned, isCharColor } from './charColors';
import { type SmashPower, isSmashPower, smashOwned } from './smashPowers';
import { type DefensivePower, defensiveOwned, isDefensivePower } from './defensivePowers';

export type OpError =
  | 'invalid_amount'
  | 'not_enough_coins'
  | 'not_found'
  | 'not_available'
  | 'not_in_shop'
 | 'already_rerolled'
 | 'nothing_to_change'
  | 'level_too_low'
  | 'already_owned'
  | 'not_owned'
  | 'duplicate_ability'
  | 'not_enough_cash'
  | 'real_money_only'
  | 'not_enough_rays'
  | 'stat_maxed'
  // (24-11-2026) pantalla de inicio (completeOnboarding)
  | 'already_done'
  | 'invalid_name'
  | 'invalid_skin';

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

/** Marca un aviso del tutorial como visto (idempotente). */
export function markTutorialSeen(s: PlayerState, id: string): OpResult {
  if (s.tutorial?.includes(id)) return { ok: true, state: s };
  const n = clonePlayer(s);
  n.tutorial = [...(n.tutorial ?? []), id];
  return { ok: true, state: n };
}

/** (24-11-2026, usuario) NOMBRE DE USUARIO: 3 a 12 letras, números, espacio, guion o guion bajo (sin espacios al principio ni al final). */
export const USERNAME = { min: 3, max: 12, re: /^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ _-]+$/ };
export function validUsername(raw: string): string | null {
  const n = raw.trim().replace(/\s+/g, ' ');
  return n.length >= USERNAME.min && n.length <= USERNAME.max && USERNAME.re.test(n) ? n : null;
}
/**
 * (24-11-2026, usuario) PANTALLA DE INICIO: nombre de usuario y el ÚNICO personaje que se regala (los demás se desbloquean en la Tienda). Sin
 * vuelta atrás: solo vale una vez por cuenta. `playable` = ids de los personajes que se pueden elegir (CATALOG).
 */
export function completeOnboarding(s: PlayerState, name: string, skin: string, playable: readonly string[]): OpResult {
  if (s.onboarded) return fail('already_done');
  const n = validUsername(name);
  if (!n) return fail('invalid_name');
  if (!playable.includes(skin)) return fail('invalid_skin');
  const c = clonePlayer(s);
  c.name = n;
  // solo el elegido: fuera los personajes que traía el perfil nuevo por defecto
  c.owned = [...c.owned.filter((i) => !i.startsWith('skin:')), `skin:${skin}` as ItemId];
  c.equipped = { ...c.equipped, skin: skin as PlayerState['equipped']['skin'] };
  c.onboarded = true;
  return { ok: true, state: c };
}
/** ¿Falta la pantalla de inicio? Cuenta nueva (nivel 1, sin tutorial empezado) con el modo desarrollo apagado. */
export function needsOnboarding(s: Readonly<PlayerState>, devMode: boolean): boolean {
  return !devMode && !s.onboarded && s.level === 1 && !(s.tutorial?.length);
}

/** (24-11-2026, usuario) Da los REGALOS del tutorial de los niveles ya alcanzados que aún no tiene (idempotente; domain/tutorial.ts TUTORIAL_GIFTS). */
export function grantTutorialGifts(s: PlayerState): OpResult {
  const add = TUTORIAL_GIFTS.filter((g) => g.level <= s.level && !s.owned.includes(g.item as ItemId)).map((g) => g.item as ItemId);
  if (!add.length) return { ok: true, state: s };
  const n = clonePlayer(s);
  n.owned = [...n.owned, ...add];
  return { ok: true, state: n };
}

/** Suma DINERO virtual (billetes, gems): premios de la ruleta, del pase, etc. */
export function addCash(s: PlayerState, amount: number): OpResult {
  if (!Number.isInteger(amount) || amount < 0) return fail('invalid_amount');
  const n = clonePlayer(s);
  n.gems += amount;
  return { ok: true, state: n };
}

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

/**
 * Gasta 1 Rayo para mejorar exactamente 1% un atributo de Zona de un PERSONAJE (skin; por defecto el equipado), hasta 20 niveles.
 * Los Rayos son de la cuenta; los atributos, de cada personaje (docs/MAESTRIAS.md).
 */
export function upgradeZoneStat(s: PlayerState, stat: ZoneStatKey, skin: string = s.equipped.skin): OpResult {
  if (s.zone.rays < 1) return fail('not_enough_rays');
  if (zoneStatsOf(s.zone, skin)[stat] >= ZONE_STAT_MAX) return fail('stat_maxed');
  const n = clonePlayer(s);
  n.zone.rays -= 1;
  const cur = zoneStatsOf(n.zone, skin);
  cur[stat] += 1;
  n.zone.stats[skin] = cur;
  return { ok: true, state: n };
}

/**
 * MAESTRÍA: suma 1 punto al personaje skin por un partido GANADO (docs/MAESTRIAS.md). Solo cuenta desde el nivel 20 de la cuenta y hasta el
 * nivel máximo de maestría; antes devuelve ok sin cambios (gained = 0). Solo personajes con pasiva.
 */
export function awardMastery(s: PlayerState, skin: string): OpResult<{ gained: number; before: number; after: number }> {
  const before = s.mastery?.[skin] ?? 0;
  if (!passiveOf(skin) || s.level < MASTERY.unlockLevel || before >= MASTERY_MAX_POINTS) return { ok: true, state: s, gained: 0, before, after: before };
  const n = clonePlayer(s);
  n.mastery = { ...(n.mastery ?? {}), [skin]: before + 1 };
  return { ok: true, state: n, gained: 1, before, after: before + 1 };
}

// ---------------------------------------------------------------- tienda / inventario

export function purchase(s: PlayerState, id: ItemId): OpResult {
  if (owns(s, id)) return fail('already_owned');
  const item = shopItem(id);
  if (!item) return fail('not_found');
  if (!item.available) return fail('not_available');
  if (item.realMoneyOnly) return fail('real_money_only'); // solo con dinero real (CLP, aún sin pasarela de pago)
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

/** Elige el ESTILO DE COLOR del personaje (solo uno que tengas: el clásico o uno ganado en el Pase). */
export function equipColor(s: PlayerState, id: CharColorId): OpResult {
  if (!isCharColor(id)) return fail('not_found');
  if (!charColorOwned(s.owned, id, s.equipped.skin)) return fail('not_owned'); // (19-11-2026) colores por personaje
  const n = clonePlayer(s);
  n.equipped.color = id;
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
