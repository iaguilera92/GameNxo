/**
 * RULETAS DIARIAS — configuración (datos puros, sin Phaser). Todo lo ajustable está aquí.
 *
 * Probabilidades en PUNTOS BÁSICOS (10000 = 100 %) para que la suma sea exacta (sin decimales
 * flotantes). `validateWheelConfig()` lo comprueba (también en los tests).
 */
import type { ItemId } from './player';

/** Rareza: decide colores y la celebración. */
export type WheelRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'special';

export type WheelPrize =
  | { kind: 'coins'; amount: number }
  | { kind: 'xp'; amount: number }
  /** premio épico: se elige UNA de las opciones (por peso) al girar */
  | { kind: 'epic'; options: { kind: 'coins' | 'xp'; amount: number; weight: number }[] }
  /** premio especial: un cosmético raro del catálogo */
  | { kind: 'cosmetic' };

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
   * 10 sectores, en el orden en que se dibujan (sentido horario desde arriba).
   * Premios PEQUEÑOS (decisión del usuario, 12-11-2026: la ruleta daba demasiado y el anuncio x2 lo duplica):
   * monedas 10 / 50 / 100 / 150, XP 10 / 25 / 50, ÉPICO 500 monedas o 250 XP, cosmético (repetido = 300 monedas).
   * Media por giro ≈ 45 monedas + 5 XP (antes 300 + 102); con el x2, el doble.
   */
  slots: [
    { id: 'c10', label: '10', prize: { kind: 'coins', amount: 10 }, weight: 3000, rarity: 'common' },
    { id: 'x10', label: '10', prize: { kind: 'xp', amount: 10 }, weight: 1000, rarity: 'common' },
    { id: 'c50', label: '50', prize: { kind: 'coins', amount: 50 }, weight: 2500, rarity: 'common' },
    { id: 'cos1', label: 'ESPECIAL', prize: { kind: 'cosmetic' }, weight: 100, rarity: 'special' },
    { id: 'x25', label: '25', prize: { kind: 'xp', amount: 25 }, weight: 600, rarity: 'uncommon' },
    { id: 'c100', label: '100', prize: { kind: 'coins', amount: 100 }, weight: 1500, rarity: 'uncommon' },
    {
      id: 'epic',
      label: 'ÉPICO',
      prize: { kind: 'epic', options: [{ kind: 'coins', amount: 500, weight: 1 }, { kind: 'xp', amount: 250, weight: 1 }] },
      weight: 100,
      rarity: 'epic',
    },
    { id: 'c150', label: '150', prize: { kind: 'coins', amount: 150 }, weight: 800, rarity: 'rare' },
    { id: 'cos2', label: 'ESPECIAL', prize: { kind: 'cosmetic' }, weight: 100, rarity: 'special' },
    { id: 'x50', label: '50', prize: { kind: 'xp', amount: 50 }, weight: 300, rarity: 'rare' },
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
  for (const s of WHEEL.slots) {
    if (!Number.isInteger(s.weight) || s.weight < 0) errs.push(`peso inválido en ${s.id}`);
    if ((s.prize.kind === 'coins' || s.prize.kind === 'xp') && (!Number.isInteger(s.prize.amount) || s.prize.amount <= 0)) errs.push(`cantidad inválida en ${s.id}`);
  }
  return errs;
}
