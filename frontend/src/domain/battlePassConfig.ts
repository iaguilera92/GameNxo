/**
 * PASE DE BATALLA — configuración de la temporada (niveles, premios, precio). Sin lógica de premios:
 * operations.addXp la usa para llenar el pase sin imports circulares.
 *
 * Monedas del juego:
 *   monedas  (moneda común)  se ganan jugando · compran estilos en la Tienda
 *   dinero   (billetes)      moneda premium · sale del pase (también del gratis) · compra el Pase
 *                            Premium y artículos de dinero en la Tienda. Se guarda en PlayerState.gems.
 */
import type { ItemId, PlayerState } from './player';
import { newBattlePass } from './battlePassState';

export type BpReward =
  | { kind: 'coins'; amount: number }
  | { kind: 'cash'; amount: number }
  | { kind: 'item'; item: ItemId; name: string };

export type BpTrack = 'free' | 'prem';

export interface BpTier {
  free: BpReward;
  prem: BpReward;
}

const c = (amount: number): BpReward => ({ kind: 'coins', amount });
const $ = (amount: number): BpReward => ({ kind: 'cash', amount });
const it = (item: ItemId, name: string): BpReward => ({ kind: 'item', item, name });

export const BP_SEASON = {
  id: 'S1',
  name: 'TEMPORADA 1',
  /** EXP por nivel del pase */
  xpPerTier: 100,
  /** precio del Pase Premium en DINERO (el camino gratis da dinero suficiente a mitad de temporada) */
  premiumCash: 120,
  /**
   * El Pase Premium se paga SOLO con dinero real (compra dentro de la app). Precio mostrado en CLP.
   * Mientras no exista la integración de pagos (Google Play / App Store), no se puede comprar.
   */
  premiumRealPrice: '$4.990',
  premiumRealMoney: true,
  /** si un premio de cosmético ya se tiene: compensación */
  duplicateCoins: 300,
  /** niveles 1..N (índice 0 = nivel 1) */
  tiers: [
    { free: c(50), prem: c(150) },
    { free: c(60), prem: $(10) },
    { free: $(10), prem: c(200) },
    { free: c(80), prem: $(15) },
    { free: it('style:red', 'Estilo Rojo'), prem: c(250) },
    { free: $(15), prem: $(20) },
    { free: c(100), prem: c(300) },
    { free: c(100), prem: $(20) },
    { free: $(20), prem: c(300) },
    { free: c(120), prem: it('style:gold', 'Estilo Oro') },
    { free: c(120), prem: $(25) },
    { free: $(20), prem: c(350) },
    { free: c(130), prem: $(25) },
    { free: c(140), prem: c(350) },
    { free: it('style:green', 'Estilo Verde'), prem: $(30) },
    { free: $(25), prem: c(400) },
    { free: c(150), prem: $(30) },
    { free: c(160), prem: c(400) },
    { free: $(25), prem: $(35) },
    { free: c(200), prem: c(500) },
    { free: c(170), prem: $(35) },
    { free: $(30), prem: c(500) },
    { free: c(180), prem: $(40) },
    { free: c(190), prem: c(550) },
    { free: $(30), prem: $(50) },
    { free: c(200), prem: c(600) },
    { free: c(210), prem: $(50) },
    { free: $(40), prem: c(650) },
    { free: c(230), prem: $(60) },
    { free: $(60), prem: c(1500) },
  ] as BpTier[],
};

/** EXP máxima del pase (último nivel). */
export const bpMaxXp = () => BP_SEASON.tiers.length * BP_SEASON.xpPerTier;

/** Suma EXP al pase (la llama operations.addXp). Pura: modifica el clon que recibe. */
export function bpAddXpInPlace(n: PlayerState, amount: number) {
  if (n.bp.season !== BP_SEASON.id) n.bp = newBattlePass(BP_SEASON.id);
  n.bp.xp = Math.min(bpMaxXp(), n.bp.xp + Math.max(0, Math.floor(amount)));
}
