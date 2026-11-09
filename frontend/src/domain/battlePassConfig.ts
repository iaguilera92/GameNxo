/**
 * PASE DE BATALLA — configuración de la temporada (niveles, premios, precio). Sin lógica de premios:
 * operations.addXp la usa para llenar el pase sin imports circulares.
 *
 * El pase entrega dinero (billetes) y cosméticos; las monedas quedan reservadas para Ranked.
 */
import type { ItemId, PlayerState } from './player';
import { newBattlePass } from './battlePassState';

export type BpReward =
  | { kind: 'cash'; amount: number }
  | { kind: 'item'; item: ItemId; name: string };

export type BpTrack = 'free' | 'prem';

export interface BpTier {
  free: BpReward;
  prem: BpReward;
}

const $ = (amount: number): BpReward => ({ kind: 'cash', amount });
// Conversión de antiguos premios en monedas a dinero, manteniendo un valor moderado.
const cashReward = (coins: number): BpReward => ({ kind: 'cash', amount: Math.max(5, Math.round(coins / 15)) });
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
  premiumRealPrice: '$3.990 CLP',
  premiumRealMoney: true,
  /** si un premio de cosmético ya se tiene: compensación en dinero */
  duplicateCash: 10,
  /** regalo de bienvenida (no cuenta como nivel del pase) */
  welcome: { free: $(10), prem: $(20) } as { free: BpReward; prem: BpReward },
  /** niveles 1..N (índice 0 = nivel 1) */
  tiers: [
    { free: cashReward(50), prem: cashReward(150) },
    { free: cashReward(60), prem: $(10) },
    { free: $(10), prem: cashReward(200) },
    { free: cashReward(80), prem: $(15) },
    { free: it('style:red', 'Estilo Rojo'), prem: cashReward(250) },
    { free: $(15), prem: $(20) },
    { free: cashReward(100), prem: cashReward(300) },
    { free: cashReward(100), prem: $(20) },
    { free: $(20), prem: cashReward(300) },
    { free: cashReward(120), prem: it('style:gold', 'Estilo Oro') },
    { free: cashReward(120), prem: $(25) },
    { free: $(20), prem: cashReward(350) },
    { free: cashReward(130), prem: $(25) },
    { free: cashReward(140), prem: cashReward(350) },
    { free: it('style:green', 'Estilo Verde'), prem: $(30) },
    { free: $(25), prem: cashReward(400) },
    { free: cashReward(150), prem: $(30) },
    { free: cashReward(160), prem: cashReward(400) },
    { free: $(25), prem: $(35) },
    { free: cashReward(200), prem: cashReward(500) },
    { free: cashReward(170), prem: $(35) },
    { free: $(30), prem: cashReward(500) },
    { free: cashReward(180), prem: $(40) },
    { free: cashReward(190), prem: cashReward(550) },
    { free: $(30), prem: $(50) },
    { free: cashReward(200), prem: cashReward(600) },
    { free: cashReward(210), prem: $(50) },
    { free: $(40), prem: cashReward(650) },
    { free: cashReward(230), prem: $(60) },
    { free: $(60), prem: cashReward(1500) },
  ] as BpTier[],
};

/** EXP máxima del pase (último nivel). */
export const bpMaxXp = () => BP_SEASON.tiers.length * BP_SEASON.xpPerTier;

/** Suma EXP al pase (la llama operations.addXp). Pura: modifica el clon que recibe. */
export function bpAddXpInPlace(n: PlayerState, amount: number) {
  if (n.bp.season !== BP_SEASON.id) n.bp = newBattlePass(BP_SEASON.id);
  n.bp.xp = Math.min(bpMaxXp(), n.bp.xp + Math.max(0, Math.floor(amount)));
}
