/**
 * PASE DE BATALLA (lógica pura, sin Phaser).
 *
 * - Se llena con la EXP que gana el jugador (partidas, ruleta…): toda EXP que pasa por
 *   operations.addXp suma también al pase de la temporada.
 * - Cada nivel tiene un premio GRATIS y uno PREMIUM. El premium exige el pase premium.
 * - Reclamar es idempotente: cada premio se entrega una sola vez (se guarda en el mismo commit).
 * - Pase premium: se compra con DINERO (billetes), que da el propio pase (también el gratis).
 * Configuración (temporada, niveles, premios, precio) en BP_SEASON.
 */
import { addCoins, grantItem } from './operations';
import { type PlayerState, clonePlayer, owns } from './player';
import { newBattlePass } from './battlePassState';
import { BP_SEASON, type BpReward, type BpTrack } from './battlePassConfig';

export { BP_SEASON } from './battlePassConfig';
export type { BpReward, BpTrack, BpTier } from './battlePassConfig';

export const BP_TIERS = BP_SEASON.tiers.length;

/** Nivel alcanzado (0..BP_TIERS) y progreso dentro del siguiente. */
export function bpLevel(xp: number) {
  const level = Math.min(BP_TIERS, Math.floor(xp / BP_SEASON.xpPerTier));
  const into = level >= BP_TIERS ? BP_SEASON.xpPerTier : xp - level * BP_SEASON.xpPerTier;
  return { level, into, progress: into / BP_SEASON.xpPerTier };
}

/** Pone el pase al día con la temporada actual (nueva temporada = pase vacío). */
export function syncSeason(s: PlayerState): PlayerState {
  if (s.bp.season === BP_SEASON.id) return s;
  const n = clonePlayer(s);
  n.bp = newBattlePass(BP_SEASON.id);
  return n;
}

export type BpError = 'locked' | 'not_premium' | 'already_claimed' | 'invalid' | 'not_enough_cash' | 'already_premium' | 'real_money';
export type BpResult<T = object> = ({ ok: true; state: PlayerState } & T) | { ok: false; error: BpError };

/** ¿Se puede reclamar este premio ahora? */
export function bpCanClaim(s: PlayerState, track: BpTrack, tier: number): BpError | null {
  if (!Number.isInteger(tier) || tier < 1 || tier > BP_TIERS) return 'invalid';
  const b = s.bp.season === BP_SEASON.id ? s.bp : newBattlePass(BP_SEASON.id);
  if (bpLevel(b.xp).level < tier) return 'locked';
  if (track === 'prem' && !b.premium) return 'not_premium';
  if ((track === 'free' ? b.free : b.prem).includes(tier)) return 'already_claimed';
  return null;
}

/** Reclama un premio (una sola vez). Devuelve lo entregado (un cosmético repetido se compensa). */
export function bpClaim(s: PlayerState, track: BpTrack, tier: number): BpResult<{ given: BpReward }> {
  const synced = syncSeason(s);
  const err = bpCanClaim(synced, track, tier);
  if (err) return { ok: false, error: err };
  const reward = BP_SEASON.tiers[tier - 1][track];
  let n = clonePlayer(synced);
  let given = reward;
  if (reward.kind === 'coins') {
    const r = addCoins(n, reward.amount);
    if (r.ok) n = r.state;
  } else if (reward.kind === 'cash') {
    n.gems += reward.amount; // dinero (billetes)
  } else if (owns(n, reward.item)) {
    given = { kind: 'coins', amount: BP_SEASON.duplicateCoins };
    const r = addCoins(n, BP_SEASON.duplicateCoins);
    if (r.ok) n = r.state;
  } else {
    const r = grantItem(n, reward.item);
    if (r.ok) n = r.state;
  }
  n = clonePlayer(n);
  (track === 'free' ? n.bp.free : n.bp.prem).push(tier);
  return { ok: true, state: n, given };
}

/** Compra del Pase Premium. Hoy se paga solo con dinero real (premiumRealMoney): devuelve 'real_money'. */
export function bpBuyPremium(s: PlayerState): BpResult {
  const n = clonePlayer(syncSeason(s));
  if (n.bp.premium) return { ok: false, error: 'already_premium' };
  // solo dinero real: la compra la hará la tienda de la app (pendiente de integrar); con dinero virtual no
  if (BP_SEASON.premiumRealMoney) return { ok: false, error: 'real_money' };
  if (n.gems < BP_SEASON.premiumCash) return { ok: false, error: 'not_enough_cash' };
  n.gems -= BP_SEASON.premiumCash;
  n.bp.premium = true;
  return { ok: true, state: n };
}

/** Premios listos para reclamar (para el aviso del menú). */
export function bpClaimable(s: PlayerState): number {
  const b = syncSeason(s).bp;
  const lvl = bpLevel(b.xp).level;
  let n = 0;
  for (let t = 1; t <= lvl; t++) {
    if (!b.free.includes(t)) n++;
    if (b.premium && !b.prem.includes(t)) n++;
  }
  return n;
}

/** Valida datos guardados (migración). */
export function sanitizeBattlePass(raw: unknown) {
  const b = newBattlePass(BP_SEASON.id);
  if (!raw || typeof raw !== 'object') return b;
  const r = raw as Record<string, unknown>;
  if (r.season !== BP_SEASON.id) return b; // otra temporada: empieza de cero
  const ints = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((x): x is number => Number.isInteger(x) && x >= 1 && x <= BP_TIERS))] : []);
  b.xp = typeof r.xp === 'number' && Number.isFinite(r.xp) ? Math.max(0, Math.min(BP_TIERS * BP_SEASON.xpPerTier, Math.floor(r.xp))) : 0;
  b.premium = r.premium === true;
  b.free = ints(r.free);
  b.prem = ints(r.prem);
  return b;
}
