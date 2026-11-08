/**
 * Catálogo de la tienda (datos puros). Mañana puede venir del servidor con la misma forma.
 * Los datos de juego de cada habilidad (cooldown, color…) siguen en logic/Abilities.ts.
 */
import type { ItemId, ItemKind } from './player';

export interface ShopItem {
  id: ItemId;
  kind: ItemKind;
  name: string;
  price: number; // DINERO (billetes, PlayerState.gems): las monedas son competitivas y no se usan en la Tienda
  /** nivel mínimo para comprar */
  minLevel: number;
  /** false = visible pero aún no se puede comprar (p. ej. habilidad sin implementar en el partido) */
  available: boolean;
}

export const SHOP_ITEMS: ShopItem[] = [
  // habilidades: wall/curve/freeze aún no existen en el partido (Kiro) -> no disponibles
  // precios en DINERO (antes en monedas: ~15 monedas = 1 de dinero, según la Bolsa de monedas)
  { id: 'ability:wall', kind: 'ability', name: 'Muro', price: 35, minLevel: 3, available: false },
  { id: 'ability:curve', kind: 'ability', name: 'Efecto', price: 50, minLevel: 5, available: false },
  { id: 'ability:freeze', kind: 'ability', name: 'Hielo', price: 70, minLevel: 8, available: false },
  // estilos (estela de los golpes)
  { id: 'style:red', kind: 'style', name: 'Rojo', price: 10, minLevel: 1, available: true },
  { id: 'style:green', kind: 'style', name: 'Verde', price: 10, minLevel: 2, available: true },
  { id: 'style:gold', kind: 'style', name: 'Oro', price: 25, minLevel: 5, available: true },
];

/** Ofertas que se pagan con DINERO (billetes). El Pase Premium usa su precio de BP_SEASON. */
export const CASH_OFFERS = {
  coinPack: { cash: 20, coins: 300, name: 'Bolsa de monedas' },
};

export function shopItem(id: ItemId): ShopItem | undefined {
  return SHOP_ITEMS.find((i) => i.id === id);
}
