/**
 * PASE DE BATALLA — configuración de la temporada (niveles, premios, precio). Sin lógica de premios:
 * operations.addXp la usa para llenar el pase sin imports circulares.
 *
 * El pase entrega algo de dinero (billetes), cosméticos (efecto pelota, cargando golpe), los 3 EMOTES, Rayos para la
 * ZONA y el personaje del final; las monedas quedan reservadas para Ranked.
 */
import type { ItemId, PlayerState, StyleId } from './player';
import type { SkinId } from '../characters/skins';
import { newBattlePass } from './battlePassState';

export type BpReward =
  | { kind: 'cash'; amount: number }
  | { kind: 'item'; item: ItemId; name: string }
  | { kind: 'character'; skin: SkinId; style?: StyleId; name: string }
  /** Rayos de la ZONA (zone.rays): se gastan en sus atributos (PERSONALIZACIÓN) */
  | { kind: 'rays'; amount: number };

export type BpTrack = 'free' | 'prem';

export interface BpTier {
  free: BpReward;
  prem: BpReward;
}

const $ = (amount: number): BpReward => ({ kind: 'cash', amount });
const it = (item: ItemId, name: string): BpReward => ({ kind: 'item', item, name });
const rays = (amount: number): BpReward => ({ kind: 'rays', amount });

export const BP_SEASON = {
  id: 'S1',
  name: 'TEMPORADA 1',
  /** EXP por nivel del pase */
  xpPerTier: 100,
  /**
   * precio del Pase Premium en DINERO. Hoy no se usa (premiumRealMoney: se paga con dinero real); el camino gratis ya NO
   * alcanza para pagarlo (da 40).
   */
  premiumCash: 120,
  /**
   * El Pase Premium se paga SOLO con dinero real (compra dentro de la app). Precio mostrado en CLP.
   * Mientras no exista la integración de pagos (Google Play / App Store), no se puede comprar.
   */
  premiumRealPrice: '$3.990 CLP',
  premiumRealMoney: true,
  /** si un premio de cosmético ya se tiene: compensación en dinero (baja: no debe inflar el dinero del pase) */
  duplicateCash: 3,
  /** regalo de bienvenida (no cuenta como nivel del pase): el primer emote, para tener uno desde la primera partida */
  welcome: { free: it('emote:happy', 'Risa'), prem: $(5) } as { free: BpReward; prem: BpReward },
  /**
   * DINERO DEL PASE (11-11-2026, con el usuario): un pase COMPLETO (gratis + premium) da como mucho para 2 objetos de la
   * Tienda de 50: GRATIS 40 y PREMIUM 60 (con la bienvenida) = 100. El resto del dinero sale de la ruleta, el premio
   * diario y la clasificación semanal. Antes daba 175 + 535.
   * niveles 1..N (índice 0 = nivel 1): entre medio, los emotes (3 y 11), los efectos
   * de pelota (ROSADO 5, ORO 10 premium y VERDE 15), el cargando golpe TULIPÁN (12 premium), Rayos para la ZONA (25) y Mai (30).
   * ESTILOS DE COLOR del personaje (domain/charColors.ts): AZUL 8 y VERDE 18 (gratis); MORADO 7, DORADO 21 y SOMBRA 27
   * (premium). Se equipan en PERSONALIZACIÓN.
   */
  tiers: [
    { free: $(1), prem: $(2) },
    { free: $(1), prem: $(2) },
    { free: it('emote:cool', 'Pensando'), prem: $(2) },
    { free: $(1), prem: $(2) },
    { free: it('style:pink', 'Rosado'), prem: $(2) },
    { free: $(2), prem: $(2) },
    { free: $(1), prem: it('color:morado', 'Color Morado') },
    { free: it('color:azul', 'Color Azul'), prem: $(2) },
    { free: $(2), prem: $(2) },
    { free: $(1), prem: it('style:gold', 'Oro') },
    { free: it('emote:wow', 'Enojado'), prem: $(2) },
    { free: $(2), prem: it('charge:tulip', 'Tulipán') },
    { free: $(1), prem: $(2) },
    { free: $(2), prem: $(2) },
    { free: it('style:green', 'Verde'), prem: $(2) },
    { free: $(2), prem: $(3) },
    { free: $(1), prem: $(2) },
    { free: it('color:verde', 'Color Verde'), prem: $(3) },
    { free: $(2), prem: $(3) },
    { free: $(2), prem: $(3) },
    { free: $(1), prem: it('color:dorado', 'Color Dorado') },
    { free: $(2), prem: $(2) },
    { free: $(2), prem: $(3) },
    { free: $(3), prem: $(2) },
    { free: rays(1), prem: rays(2) },
    { free: $(2), prem: $(3) },
    { free: $(3), prem: it('color:sombra', 'Color Sombra') },
    { free: $(3), prem: $(3) },
    { free: $(3), prem: $(4) },
    { free: { kind: 'character', skin: 'mai', name: 'Mai' }, prem: { kind: 'character', skin: 'mai', style: 'gold', name: 'Mai · Estilo Oro' } },
  ] as BpTier[],
};

/** EXP máxima del pase (último nivel). */
export const bpMaxXp = () => BP_SEASON.tiers.length * BP_SEASON.xpPerTier;

/** Suma EXP al pase (la llama operations.addXp). Pura: modifica el clon que recibe. */
export function bpAddXpInPlace(n: PlayerState, amount: number) {
  if (n.bp.season !== BP_SEASON.id) n.bp = newBattlePass(BP_SEASON.id);
  n.bp.xp = Math.min(bpMaxXp(), n.bp.xp + Math.max(0, Math.floor(amount)));
}
