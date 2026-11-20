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
import { grantItem } from './operations';
import { type ItemId, type PlayerState, clonePlayer, itemId, owns } from './player';
import { gainChest } from './chest';
import { addCoins2v2 } from './coins2v2';
import { charColorItem } from './charColors';
import { gameClock } from './timeSource';
import { newBattlePass } from './battlePassState';
import { grantBonusSpin } from './dailyWheel';
import { BP_SEASON, type BpReward, type BpTrack } from './battlePassConfig';
import type { SkinId } from '../characters/skins';

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
export function bpClaim(s: PlayerState, track: BpTrack, tier: number): BpResult<{ given: BpReward; dupCash?: number }> {
  const synced = syncSeason(s);
  const err = bpCanClaim(synced, track, tier);
  if (err) return { ok: false, error: err };
  const reward = BP_SEASON.tiers[tier - 1][track];
  let n = clonePlayer(synced);
  const granted = grantBpReward(n, reward);
  n = granted.state;
  const given = granted.given;
  const dupCash = granted.dupCash;
  n = clonePlayer(n);
  (track === 'free' ? n.bp.free : n.bp.prem).push(tier);
  return { ok: true, state: n, given, ...(dupCash ? { dupCash } : {}) };
}

/** Cobra una sola vez el regalo de bienvenida del camino elegido. */
export function bpClaimWelcome(s: PlayerState, track: BpTrack): BpResult<{ given: BpReward; dupCash?: number }> {
  const synced = syncSeason(s);
  const claimed = track === 'free' ? synced.bp.welcomeFreeClaimed : synced.bp.welcomePremClaimed;
  if (claimed) return { ok: false, error: 'already_claimed' };
  if (track === 'prem' && !synced.bp.premium) return { ok: false, error: 'not_premium' };
  const reward = BP_SEASON.welcome[track];
  const { state: n, given, dupCash } = grantBpReward(clonePlayer(synced), reward);
  if (track === 'free') n.bp.welcomeFreeClaimed = true;
  else n.bp.welcomePremClaimed = true;
  return { ok: true, state: n, given, ...(dupCash ? { dupCash } : {}) };
}

/** Entrega dinero, cosméticos o un personaje con estilo; compensa solo si ya se posee todo. */
function grantBpReward(player: PlayerState, reward: BpReward): { state: PlayerState; given: BpReward; dupCash?: number } {
  const n = clonePlayer(player);
  if (reward.kind === 'cash') {
    n.gems += reward.amount;
    return { state: n, given: reward };
  }
  if (reward.kind === 'rays') {
    n.zone.rays += reward.amount;
    return { state: n, given: reward };
  }
  // (21-11-2026, usuario) MONEDAS 1v1 y 2v2: se suman a la cuenta sin más
  if (reward.kind === 'coins') {
    n.coins += reward.amount;
    return { state: n, given: reward };
  }
  if (reward.kind === 'coins2v2') return { state: addCoins2v2(n, reward.amount), given: reward };
  if (reward.kind === 'chest') {
    // (19-11-2026, usuario) COFRE NORMAL, como el de la ruleta: si ya hay uno sin abrir, evoluciona; si ya era épico, monedas
    const r = gainChest(n, gameClock.now());
    const given: BpReward = r.gain.kind === 'chest' ? { kind: 'chest', level: r.gain.level, upgraded: r.gain.upgraded } : { kind: 'chest', coins: r.gain.amount };
    return { state: r.state, given };
  }
  if (reward.kind === 'character' && reward.soon) {
    // personaje que aún no se puede jugar (JUN): no se entrega `skin:<id>` ni su color (los colores son por personaje: se entregan al publicarlo);
    // solo su estilo de pelota si no se tiene. Nunca compensa en dinero: el nivel queda reclamado y el personaje se entregará
    // (bpGrantClaimedItemsInPlace) cuando se publique sin `soon`
    for (const id of reward.style ? [itemId.style(reward.style)] : []) {
      if (owns(n, id)) continue;
      const result = grantItem(n, id);
      if (result.ok) Object.assign(n, result.state);
    }
    return { state: n, given: reward };
  }
  const ids = reward.kind === 'character'
    ? [itemId.skin(reward.skin as SkinId), ...(reward.style ? [itemId.style(reward.style)] : []), ...(reward.color ? [charColorItem(reward.color, reward.skin) as ItemId] : [])]
    : [reward.item];
  const newItems = ids.filter((id) => !owns(n, id));
  if (!newItems.length) {
    // (21-11-2026, usuario) ya lo tenías: se compensa en dinero, pero given sigue siendo el premio (la pantalla muestra el emote / efecto, no el dinero)
    n.gems += BP_SEASON.duplicateCash;
    return { state: n, given: reward, dupCash: BP_SEASON.duplicateCash };
  }
  for (const id of newItems) {
    const result = grantItem(n, id);
    if (result.ok) Object.assign(n, result.state);
  }
  return { state: n, given: reward };
}

/** Reclama el bonus único compartido por ambos caminos al completar la temporada. */
export function bpClaimBonus(s: PlayerState): BpResult<{ bonusIndex: number }> {
  const synced = syncSeason(s);
  if (bpLevel(synced.bp.xp).level < BP_TIERS) return { ok: false, error: 'locked' };
  if (synced.bp.bonusClaimed) return { ok: false, error: 'already_claimed' };
  const granted = grantBonusSpin(synced, `battle-pass:${BP_SEASON.id}`);
  const n = clonePlayer(granted.state);
  n.bp.bonusClaimed = true;
  return { ok: true, state: n, bonusIndex: granted.index };
}

export function bpBonusSpinIndex(s: PlayerState) {
  return s.wheel.bonusSpins.findIndex((sp) => sp.matchId === `battle-pass:${BP_SEASON.id}`);
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
  if (lvl >= BP_TIERS && !b.bonusClaimed) n++;
  if (!b.welcomeFreeClaimed) n++;
  if (b.premium && !b.welcomePremClaimed) n++;
  return n;
}

/**
 * Cosméticos de premios YA reclamados (bienvenida y niveles) que el jugador aún no tiene: pasa cuando la tabla de
 * premios cambia a mitad de temporada (p. ej. un nivel que daba dinero ahora da un emote). Se entregan sin cobrar nada
 * más. Solo ítems (dar un ítem que ya tienes no hace nada, así que se puede llamar en cada carga); dinero y Rayos no.
 * Muta `s` (la llama migrate sobre su propio estado nuevo).
 */
export function bpGrantClaimedItemsInPlace(s: PlayerState) {
  if (s.bp.season !== BP_SEASON.id) return;
  const rewards: BpReward[] = [];
  if (s.bp.welcomeFreeClaimed) rewards.push(BP_SEASON.welcome.free);
  if (s.bp.welcomePremClaimed) rewards.push(BP_SEASON.welcome.prem);
  for (const t of s.bp.free) if (BP_SEASON.tiers[t - 1]) rewards.push(BP_SEASON.tiers[t - 1].free);
  for (const t of s.bp.prem) if (BP_SEASON.tiers[t - 1]) rewards.push(BP_SEASON.tiers[t - 1].prem);
  for (const r of rewards) {
    if (r.kind === 'item' && !s.owned.includes(r.item)) s.owned.push(r.item);
    // personaje del final ya reclamado y que por fin se puede jugar (sin `soon`): se entrega con su estilo / color
    if (r.kind === 'character' && !r.soon) {
      for (const id of [itemId.skin(r.skin as SkinId), ...(r.style ? [itemId.style(r.style)] : []), ...(r.color ? [charColorItem(r.color, r.skin) as ItemId] : [])]) if (!s.owned.includes(id)) s.owned.push(id);
    }
  }
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
  b.bonusClaimed = r.bonusClaimed === true;
  b.welcomeFreeClaimed = r.welcomeFreeClaimed === true;
  b.welcomePremClaimed = r.welcomePremClaimed === true;
  return b;
}
