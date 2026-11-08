/**
 * Catálogo de la tienda (datos puros). Mañana puede venir del servidor con la misma forma.
 * Los datos de juego de cada habilidad (cooldown, color…) siguen en logic/Abilities.ts.
 */
import type { ItemId, ItemKind } from './player';

export interface ShopItem {
  id: ItemId;
  kind: ItemKind;
  name: string;
  price: number; // monedas
  /** nivel mínimo para comprar */
  minLevel: number;
  /** false = visible pero aún no se puede comprar (p. ej. habilidad sin implementar en el partido) */
  available: boolean;
}

export const SHOP_ITEMS: ShopItem[] = [
  // habilidades: wall/curve/freeze aún no existen en el partido (Kiro) -> no disponibles
  { id: 'ability:wall', kind: 'ability', name: 'Muro', price: 500, minLevel: 3, available: false },
  { id: 'ability:curve', kind: 'ability', name: 'Efecto', price: 750, minLevel: 5, available: false },
  { id: 'ability:freeze', kind: 'ability', name: 'Hielo', price: 1000, minLevel: 8, available: false },
  // estilos (colores)
  { id: 'style:red', kind: 'style', name: 'Rojo', price: 150, minLevel: 1, available: true },
  { id: 'style:green', kind: 'style', name: 'Verde', price: 150, minLevel: 2, available: true },
  { id: 'style:gold', kind: 'style', name: 'Oro', price: 400, minLevel: 5, available: true },
];

export function shopItem(id: ItemId): ShopItem | undefined {
  return SHOP_ITEMS.find((i) => i.id === id);
}
