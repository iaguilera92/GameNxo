/**
 * Catálogo de la tienda (datos puros). Mañana puede venir del servidor con la misma forma.
 * Los datos de juego de cada habilidad (cooldown, color…) siguen en logic/Abilities.ts.
 *
 * Todo lo que existe en el juego se puede conseguir aquí, con DINERO virtual (billetes, PlayerState.gems) o con dinero
 * real (CLP). Lo único que NO se vende son los atributos de ZONA: se mejoran solo con Rayos (Ranked).
 * El cobro en CLP necesita la integración de pagos (Google Play / App Store): hasta entonces solo se muestra el precio.
 */
import type { ItemId, ItemKind } from './player';

export interface ShopItem {
  id: ItemId;
  kind: ItemKind;
  name: string;
  /** precio en DINERO virtual (billetes, PlayerState.gems): las monedas son competitivas y no se usan en la Tienda */
  price: number;
  /** precio en dinero real (pesos chilenos, IVA incluido) */
  clp: number;
  /** nivel mínimo para comprar */
  minLevel: number;
  /** false = visible pero aún no se puede comprar */
  available: boolean;
}

export const SHOP_ITEMS: ShopItem[] = [
  // estilos (estela de los golpes)
  { id: 'style:red', kind: 'style', name: 'Rojo', price: 10, clp: 490, minLevel: 1, available: true },
  { id: 'style:green', kind: 'style', name: 'Verde', price: 10, clp: 490, minLevel: 2, available: true },
  { id: 'style:gold', kind: 'style', name: 'Oro', price: 25, clp: 990, minLevel: 5, available: true },
  // rosado: premio del Pase de Batalla (nivel 5); también se compra
  { id: 'style:pink', kind: 'style', name: 'Rosado', price: 15, clp: 690, minLevel: 1, available: true },
  // poderes del INFERNO (el FUEGO es de todos; el HIELO viene con Mai)
  { id: 'inferno:ice', kind: 'inferno', name: 'Hielo', price: 40, clp: 1490, minLevel: 1, available: true },
  { id: 'inferno:wind', kind: 'inferno', name: 'Viento', price: 60, clp: 1990, minLevel: 1, available: true },
  { id: 'inferno:lightning', kind: 'inferno', name: 'Rayo', price: 80, clp: 2490, minLevel: 1, available: true },
  { id: 'inferno:tulip', kind: 'inferno', name: 'Tulipán', price: 80, clp: 2490, minLevel: 1, available: true },
  // poderes del ESPECIAL (SMASH). El fuego es de todos
  { id: 'smash:ice', kind: 'smash', name: 'Hielo', price: 45, clp: 1690, minLevel: 1, available: true },
  { id: 'smash:wind', kind: 'smash', name: 'Viento', price: 50, clp: 1790, minLevel: 1, available: true },
  { id: 'smash:lightning', kind: 'smash', name: 'Rayo', price: 55, clp: 1990, minLevel: 1, available: true },
  // efectos de CARGA (el aro bajo el jugador al cargar un golpe). Nxo trae el de fuego y Mai el de tulipán; el clásico es de todos
  { id: 'charge:fire', kind: 'charge', name: 'Fuego', price: 35, clp: 1290, minLevel: 1, available: true },
  { id: 'charge:energy', kind: 'charge', name: 'Energía', price: 35, clp: 1290, minLevel: 1, available: true },
  { id: 'charge:tulip', kind: 'charge', name: 'Tulipán', price: 45, clp: 1690, minLevel: 1, available: true },
  // poderes del DEFENSIVO (el DASH es de todos)
  { id: 'defensive:blink', kind: 'defensive', name: 'Destello', price: 50, clp: 1790, minLevel: 1, available: true },
  { id: 'defensive:shadow', kind: 'defensive', name: 'Sombra', price: 50, clp: 1790, minLevel: 1, available: true },
  { id: 'defensive:jump', kind: 'defensive', name: 'Supersalto', price: 50, clp: 1790, minLevel: 1, available: true },
];

/** Paquetes de DINERO virtual que se compran con dinero real (CLP). Referencia: ~$35 CLP por unidad, con bonus en los grandes. */
export interface CashPack {
  id: string;
  name: string;
  cash: number;
  clp: number;
  /** cinta de la tarjeta en la Tienda */
  tag?: 'popular' | 'best';
}
/** Paquetes de DINERO (se compran con CLP): cuanto más grande, más dinero por peso. */
export const CASH_PACKS: CashPack[] = [
  { id: 'cash-s', name: 'Puñado', cash: 50, clp: 1490 },
  { id: 'cash-m', name: 'Fajo', cash: 130, clp: 2990 },
  { id: 'cash-l', name: 'Maletín', cash: 350, clp: 6990, tag: 'popular' },
  { id: 'cash-xl', name: 'Bolsa', cash: 750, clp: 13990 },
  { id: 'cash-xxl', name: 'Cofre', cash: 2000, clp: 34990 },
  { id: 'cash-max', name: 'Caja fuerte', cash: 4500, clp: 69990, tag: 'best' },
];

/** "$1.490 CLP" */
export const clpLabel = (clp: number) => `$${clp.toLocaleString('es-CL')} CLP`;

export function shopItem(id: ItemId): ShopItem | undefined {
  return SHOP_ITEMS.find((i) => i.id === id);
}
