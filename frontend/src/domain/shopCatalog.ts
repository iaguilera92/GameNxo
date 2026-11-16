/**
 * Catálogo de la tienda (datos puros). Mañana puede venir del servidor con la misma forma.
 * Los datos de juego de cada habilidad (cooldown, color…) siguen en logic/Abilities.ts.
 *
 * Todo lo que existe en el juego se puede conseguir aquí, con DINERO virtual (billetes, PlayerState.gems) o con dinero
 * real (CLP). Lo único que NO se vende son los atributos de ZONA: se mejoran solo con Rayos (Ranked).
 * El cobro en CLP necesita la integración de pagos (Google Play / App Store): hasta entonces solo se muestra el precio.
 */
import type { ItemId, ItemKind } from './player';
import { UNLOCK_LEVEL, type UnlockKey } from './unlocks';

/**
 * RAREZAS (decididas con el usuario el 14-11-2026): normal · especial · epica · legendaria. Clasificadas hoy: todas las ULTIS, todos los
 * poderes del ESPECIAL y todos los del DEFENSIVO son especiales, salvo el DESTELLO (normal); el DASH y el FUEGO vienen gratis y no están en
 * el catálogo. CARGANDO GOLPE: Fuego normal, Energía especial, Tulipán épica. EFECTOS DE PELOTA: Brasas, Hielo, Neón y Humo especiales; Tulipanes y
 * Corazones épicas; Estrellas y Arcoíris legendarias; los estilos de color de siempre (Rojo, Verde, Oro, Rosado) normales (15-11-2026).
 * REGLA: cada habilidad o poder NUEVO se crea preguntando antes al usuario qué rareza tiene.
 */
export type ItemRarity = 'normal' | 'especial' | 'epica' | 'legendaria';
export const RARITY_LABEL: Record<ItemRarity, string> = { normal: 'NORMAL', especial: 'ESPECIAL', epica: 'ÉPICA', legendaria: 'LEGENDARIA' };

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
  /** rareza del ítem (ausente = aún sin clasificar) */
  rarity?: ItemRarity;
  /** true = solo se compra con DINERO REAL (CLP): con dinero virtual purchase lo rechaza (`real_money_only`) */
  realMoneyOnly?: boolean;
}

const BASE_ITEMS: ShopItem[] = [
  // estilos (estela de los golpes)
  { id: 'style:red', kind: 'style', name: 'Rojo', price: 10, clp: 490, minLevel: 1, available: true },
  { id: 'style:green', kind: 'style', name: 'Verde', price: 10, clp: 490, minLevel: 2, available: true },
  { id: 'style:gold', kind: 'style', name: 'Oro', price: 25, clp: 990, minLevel: 5, available: true },
  // rosado: premio del Pase de Batalla (nivel 5); también se compra
  { id: 'style:pink', kind: 'style', name: 'Rosado', price: 15, clp: 690, minLevel: 1, available: true },
  // efectos de pelota con forma propia (15-11-2026, fx/ballTrailFx.ts). Precios: ESPECIAL como los poderes especiales (40 / $1.490),
  // ÉPICA 60 / $1.990 y LEGENDARIA 100 / $2.490 (referencia: solo se pagan con dinero real).
  { id: 'style:rainbow', kind: 'style', name: 'Arcoíris', price: 100, clp: 2490, minLevel: 1, available: true },
  { id: 'style:ember', kind: 'style', name: 'Brasas', price: 40, clp: 1490, minLevel: 1, available: true },
  { id: 'style:frost', kind: 'style', name: 'Hielo', price: 40, clp: 1490, minLevel: 1, available: true },
  { id: 'style:neon', kind: 'style', name: 'Neón', price: 40, clp: 1490, minLevel: 1, available: true },
  { id: 'style:smoke', kind: 'style', name: 'Humo', price: 40, clp: 1490, minLevel: 1, available: true },
  { id: 'style:tulip', kind: 'style', name: 'Tulipanes', price: 60, clp: 1990, minLevel: 1, available: true },
  { id: 'style:hearts', kind: 'style', name: 'Corazones', price: 60, clp: 1990, minLevel: 1, available: true },
  { id: 'style:stars', kind: 'style', name: 'Estrellas', price: 100, clp: 2490, minLevel: 1, available: true },
  // poderes del INFERNO (el FUEGO es de todos; el HIELO viene con Mai)
  { id: 'inferno:ice', kind: 'inferno', name: 'Hielo', price: 40, clp: 1490, minLevel: 1, available: true },
  { id: 'inferno:wind', kind: 'inferno', name: 'Viento', price: 60, clp: 1990, minLevel: 1, available: true },
  { id: 'inferno:lightning', kind: 'inferno', name: 'Rayo', price: 80, clp: 2490, minLevel: 1, available: true },
  { id: 'inferno:tulip', kind: 'inferno', name: 'Tulipán', price: 80, clp: 2490, minLevel: 1, available: true },
  // poderes del ESPECIAL (SMASH). El fuego es de todos
  { id: 'smash:ice', kind: 'smash', name: 'Hielo', price: 45, clp: 1390, minLevel: 1, available: true },
  { id: 'smash:wind', kind: 'smash', name: 'Viento', price: 50, clp: 1490, minLevel: 1, available: true },
  { id: 'smash:lightning', kind: 'smash', name: 'Rayo', price: 55, clp: 1990, minLevel: 1, available: true },
  { id: 'smash:shadow', kind: 'smash', name: 'Sombra', price: 60, clp: 1990, minLevel: 1, available: true },
  { id: 'smash:light', kind: 'smash', name: 'Luz', price: 60, clp: 1990, minLevel: 1, available: true },
  // efectos de CARGA (el aro bajo el jugador al cargar un golpe). Nxo trae el de fuego y Mai el de tulipán; el clásico es de todos
  { id: 'charge:fire', kind: 'charge', name: 'Fuego', price: 35, clp: 1290, minLevel: 1, available: true },
  { id: 'charge:energy', kind: 'charge', name: 'Energía', price: 35, clp: 1290, minLevel: 1, available: true },
  { id: 'charge:tulip', kind: 'charge', name: 'Tulipán', price: 45, clp: 1390, minLevel: 1, available: true },
  // poderes del DEFENSIVO (el DASH es de todos)
  { id: 'defensive:blink', kind: 'defensive', name: 'Destello', price: 50, clp: 1490, minLevel: 1, available: true },
  { id: 'defensive:shadow', kind: 'defensive', name: 'Sombra', price: 50, clp: 1490, minLevel: 1, available: true },
  { id: 'defensive:jump', kind: 'defensive', name: 'Supersalto', price: 50, clp: 1490, minLevel: 1, available: true },
  { id: 'defensive:flip', kind: 'defensive', name: 'Voltereta', price: 50, clp: 1490, minLevel: 1, available: true },
  { id: 'defensive:skate', kind: 'defensive', name: 'Patinaje', price: 50, clp: 1490, minLevel: 1, available: true },
  // ESTILOS DE ZONA (16-11-2026, domain/zoneSkins.ts; la ELÉCTRICA es de todos): FUEGO épica y SOMBRA legendaria = solo dinero real
  { id: 'zone:fire', kind: 'zone', name: 'Fuego', price: 80, clp: 1990, minLevel: 1, available: true },
  { id: 'zone:shadow', kind: 'zone', name: 'Sombra', price: 100, clp: 2490, minLevel: 1, available: true },
];
/** Rareza de un ítem de la Tienda por su id (undefined = sin clasificar o no está en la Tienda: FUEGO, DASH). */
export function itemRarity(id: string): ItemRarity | undefined {
  return SHOP_ITEMS.find((i) => i.id === id)?.rarity;
}

/**
 * (12-11-2026) Un ítem no se puede comprar antes de que se desbloquee la habilidad a la que pertenece (domain/unlocks.ts): sin esto
 * un jugador de nivel 1 compraba poderes del ESPECIAL, el DEFENSIVO o la ULTI que aún no puede usar. El nivel de cada ítem es el mayor
 * entre el suyo y el de su habilidad; el nivel de desbloqueo se cambia solo en unlocks.ts.
 */
const KIND_UNLOCK: Partial<Record<ItemKind, UnlockKey>> = { defensive: 'defensive', smash: 'special', inferno: 'ulti', charge: 'charge', style: 'trail', zone: 'zone' };
export const SHOP_ITEMS: ShopItem[] = BASE_ITEMS.map((it) => {
  const key = KIND_UNLOCK[it.kind];
  const base = key ? { ...it, minLevel: Math.max(it.minLevel, UNLOCK_LEVEL[key]) } : it;
  // (14-11-2026) REGLA DEL DINERO VIRTUAL: la rareza normal y la especial se compran con dinero virtual; la ÉPICA y la LEGENDARIA solo con dinero real
  // (más abajo: ULTIS, y CARGANDO GOLPE según su rareza).
  // (14-11-2026) TODAS las ULTIS cuestan dinero real y son de rareza ESPECIAL (aún no hay ULTIS gratuitas). Su price en dinero virtual
  // queda solo como referencia (regla de precios en CLP y total de la tienda); no se puede pagar con él.
  if (it.kind === 'inferno') return { ...base, rarity: 'especial' as const, realMoneyOnly: true };
  // (16-11-2026) ESTILOS DE ZONA (decisión del usuario): FUEGO épica, SOMBRA legendaria; las dos, solo dinero real
  if (it.kind === 'zone') return { ...base, rarity: it.id === 'zone:shadow' ? ('legendaria' as const) : ('epica' as const), realMoneyOnly: true };
  // (14-11-2026) ESPECIAL y DEFENSIVO: todos especiales, menos el DESTELLO (normal)
  if (it.kind === 'smash' || it.kind === 'defensive') return { ...base, rarity: it.id === 'defensive:blink' ? ('normal' as const) : ('especial' as const) };
  // (14-11-2026) CARGANDO GOLPE: Fuego normal, Energía especial, Tulipán épica (propuesta aceptada por omisión; la legendaria queda reservada). Los ESTILOS siguen sin rareza (decisión del usuario).
  if (it.kind === 'charge') {
    const rarity = it.id === 'charge:fire' ? ('normal' as const) : it.id === 'charge:energy' ? ('especial' as const) : ('epica' as const);
    return { ...base, rarity, ...(rarity === 'epica' ? { realMoneyOnly: true } : {}) };
  }
  // (15-11-2026) EFECTOS DE PELOTA nuevos (decididos con el usuario): Brasas, Hielo, Neón y Humo = especial; Tulipanes y Corazones = épica
  // (solo dinero real); Estrellas = legendaria (solo dinero real). Los estilos de color de siempre (rojo, verde, oro, rosado) siguen sin rareza.
  // Arcoíris = legendaria (solo dinero real). Rojo, Verde, Oro y Rosado = normales (se compran con dinero virtual y salen en el Pase de Batalla).
  if (it.kind === 'style') {
    const STYLE_RARITY: Partial<Record<string, ItemRarity>> = { 'style:ember': 'especial', 'style:frost': 'especial', 'style:neon': 'especial', 'style:smoke': 'especial', 'style:tulip': 'epica', 'style:hearts': 'epica', 'style:stars': 'legendaria', 'style:rainbow': 'legendaria', 'style:red': 'normal', 'style:green': 'normal', 'style:gold': 'normal', 'style:pink': 'normal' };
    const rarity = STYLE_RARITY[it.id];
    if (rarity) return { ...base, rarity, ...(rarity === 'epica' || rarity === 'legendaria' ? { realMoneyOnly: true } : {}) };

  }
  return base;
});
/*
 * REGLA DE PRECIOS EN CLP (docs/ECONOMIA.md): el precio directo de un ítem nunca es más caro que juntar su dinero con los
 * paquetes de abajo (ej. un ítem de 50 de dinero cuesta como mucho $1.490 = "Puñado"). tools/sim-economy.mjs lo revisa.
 */

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
