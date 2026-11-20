/**
 * RULETAS DIARIAS — configuración (datos puros, sin Phaser). Todo lo ajustable está aquí.
 *
 * Probabilidades en PUNTOS BÁSICOS (10000 = 100 %) para que la suma sea exacta (sin decimales
 * flotantes). `validateWheelConfig()` lo comprueba (también en los tests).
 */
import type { ItemId } from './player';
import type { WheelTier } from './wheelState';

export type { WheelTier } from './wheelState';

/** Rareza: decide colores y la celebración. */
export type WheelRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'special';

export type WheelPrize =
  | { kind: 'coins'; amount: number }
  /** (21-11-2026, usuario) MONEDAS 2V2 (PlayerState.coins2v2) */
  | { kind: 'coins2v2'; amount: number }
  | { kind: 'xp'; amount: number }
  /** DINERO virtual (billetes) */
  | { kind: 'cash'; amount: number }
  /** premio épico: se elige UNA de las opciones (por peso) al girar */
  | { kind: 'epic'; options: { kind: 'coins' | 'xp'; amount: number; weight: number }[] }
  /** premio especial: un cosmético raro del catálogo */
  | { kind: 'cosmetic' }
  /** COFRE EVOLUTIVO (domain/chest.ts) */
  | { kind: 'chest' };

export interface WheelSlot {
  /** id estable (se guarda en el historial) */
  id: string;
  /** texto corto en el sector */
  label: string;
  prize: WheelPrize;
  /** probabilidad en puntos básicos (10000 = 100 %) */
  weight: number;
  rarity: WheelRarity;
}

/** Categorías del catálogo de cosméticos raros (preparado para ampliarse). */
export type CosmeticCategory = 'ballFx' | 'skin' | 'pet' | 'racket' | 'style';

export interface CosmeticEntry {
  id: ItemId;
  category: CosmeticCategory;
  name: string;
}

/**
 * Catálogo de cosméticos que pueden salir en los premios especiales.
 * SOLO artículos que existen hoy en el juego. Efectos de pelota, mascotas y raquetas aún no existen:
 * cuando existan, se añaden aquí (y su tipo en `ItemId`, domain/player.ts) sin tocar la lógica.
 */
export const COSMETIC_CATALOG: CosmeticEntry[] = [
  { id: 'style:gold', category: 'style', name: 'Estilo Oro' },
  { id: 'style:red', category: 'style', name: 'Estilo Rojo' },
  { id: 'style:green', category: 'style', name: 'Estilo Verde' },
];

export const WHEEL = {
  /** ruletas por día (1 por partida completada) */
  perDay: 4,
  /** reinicio diario: 23:59 hora de Chile (con horario de verano, vía Intl) */
  timeZone: 'America/Santiago',
  resetHour: 23,
  resetMinute: 59,
  /** cosmético que ya se tiene (o catálogo agotado): compensación en monedas */
  duplicatePolicy: 'coins' as 'coins',
  duplicateCoins: 300,
  /** victorias recordadas por ciclo (ids de partida) para no contar dos veces la misma */
  maxMatchIds: 32,
  /**
   * NIVELES de la ruleta (15-11-2026, decisión del usuario): cada toque (hasta `maxTaps`) tira una vez para que la ruleta
   * suba a DORADA o a ÉPICA, y cada nivel sube los premios en monedas, EXP y dinero (los cosméticos no cambian).
   * `upgrade[nivel actual][nivel nuevo]` = probabilidad POR TOQUE en puntos básicos (10000 = 100 %).
   * Con 4 toques sale ~55 % normal · ~33 % dorada · ~13 % épica (puede que ninguno suba); con 1 toque, ~86 % normal.
   */
  tiers: {
    maxTaps: 4,
    upgrade: { normal: { gold: 1200, epic: 200 }, gold: { epic: 1000 } } as {
      normal: { gold: number; epic: number };
      gold: { epic: number };
    },
    /** % que suben los premios */
    bonusPct: { normal: 0, gold: 15, epic: 20 } as Record<WheelTier, number>,
  },
  /**
   * 10 sectores, en el orden en que se dibujan (sentido horario desde arriba).
   * Premios PEQUEÑOS (decisión del usuario, 12-11-2026: la ruleta daba demasiado y el anuncio x2 lo duplica):
   * monedas 50 / 100 / 150, XP 25 / 50, DINERO virtual 1 / 5, ÉPICO 500 monedas o 250 XP, cosmético (repetido = 300 monedas).
   * Media por giro ≈ 45 monedas + 5 XP + 0,4 de dinero (antes 300 + 102); con el x2, el doble.
   * (14-11-2026) DINERO en la ruleta (decisión del usuario): el dinero virtual compra los ítems normales y especiales de la Tienda,
   * y la ruleta es una de sus fuentes (con el pase gratis). Los sectores '1' y '5' reemplazan a '10 monedas' y '10 XP'; las monedas y la XP
   * esperadas por giro quedan igual (su peso pasó a '50 monedas' y '25 XP').
   */
  slots: [
    { id: 'd1', label: '1', prize: { kind: 'cash', amount: 1 }, weight: 2700, rarity: 'common' },
    { id: 'd5', label: '5', prize: { kind: 'cash', amount: 5 }, weight: 300, rarity: 'rare' },
    { id: 'c50', label: '50', prize: { kind: 'coins', amount: 50 }, weight: 2000, rarity: 'common' },
    { id: 'cos1', label: 'ESPECIAL', prize: { kind: 'cosmetic' }, weight: 200, rarity: 'special' },
    { id: 'x25', label: '25', prize: { kind: 'xp', amount: 25 }, weight: 1000, rarity: 'uncommon' },
    { id: 'c100', label: '100', prize: { kind: 'coins', amount: 100 }, weight: 1500, rarity: 'uncommon' },
    {
      id: 'epic',
      label: 'ÉPICO',
      prize: { kind: 'epic', options: [{ kind: 'coins', amount: 500, weight: 1 }, { kind: 'xp', amount: 250, weight: 1 }] },
      weight: 100,
      rarity: 'epic',
    },
    { id: 'c150', label: '150', prize: { kind: 'coins', amount: 150 }, weight: 800, rarity: 'rare' },
    // (15-11-2026) COFRE EVOLUTIVO en el lugar del 2.º ESPECIAL (el ESPECIAL que queda tiene su peso: misma probabilidad de cosmético).
    // 5 %: sale ~1 de cada 20 giros. Peso tomado de '50 monedas'.
    { id: 'chest', label: 'COFRE', prize: { kind: 'chest' }, weight: 500, rarity: 'epic' },
    // (21-11-2026, usuario) la ruleta da MONEDAS 2V2: este sector reemplaza a '50 EXP' (id 'x50'); su peso y 600 de '50 monedas' (3 % + 6 %)
    { id: 'v30', label: '30', prize: { kind: 'coins2v2', amount: 30 }, weight: 900, rarity: 'uncommon' },
  ] as WheelSlot[],
};

export const WEIGHT_TOTAL = 10000;

/** Comprueba la configuración; devuelve los errores encontrados (vacío = válida). */
export function validateWheelConfig(): string[] {
  const errs: string[] = [];
  const sum = WHEEL.slots.reduce((a, s) => a + s.weight, 0);
  if (WHEEL.slots.length !== 10) errs.push(`hay ${WHEEL.slots.length} sectores (deben ser 10)`);
  if (sum !== WEIGHT_TOTAL) errs.push(`las probabilidades suman ${sum / 100} % (deben sumar 100 %)`);
  if (new Set(WHEEL.slots.map((s) => s.id)).size !== WHEEL.slots.length) errs.push('ids de sector repetidos');
  const up = WHEEL.tiers.upgrade;
  if (up.normal.gold + up.normal.epic > WEIGHT_TOTAL || up.gold.epic > WEIGHT_TOTAL) errs.push('probabilidades de subir de nivel mayores que 100 %');
  if (!Number.isInteger(WHEEL.tiers.maxTaps) || WHEEL.tiers.maxTaps < 1) errs.push('maxTaps inválido');
  for (const s of WHEEL.slots) {
    if (!Number.isInteger(s.weight) || s.weight < 0) errs.push(`peso inválido en ${s.id}`);
    if ((s.prize.kind === 'coins' || s.prize.kind === 'coins2v2' || s.prize.kind === 'xp' || s.prize.kind === 'cash') && (!Number.isInteger(s.prize.amount) || s.prize.amount <= 0)) errs.push(`cantidad inválida en ${s.id}`);
  }
  return errs;
}
