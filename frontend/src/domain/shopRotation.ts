/**
 * ROTACIÓN DE LA TIENDA (datos puros, sin Phaser). Decidido con el usuario (15-11-2026):
 *   - CARGANDO GOLPE, ESPECIAL y DEFENSIVO: se ven 3 a la vez y cambian cada 12 h.
 *   - ULTI: se ven 3 a la vez y cambian cada 24 h.
 *   - ZONA (21-11-2026): se ven 2 a la vez y cambian cada SEMANA (todos los domingos, con el reinicio de la noche del sábado).
 *   - EFECTO PELOTA no rota: están todos (en la Tienda se desliza hacia la derecha).
 *   - Si hay 3 o menos de una categoría, se muestran los que haya y no hay nada que cambiar.
 *
 * Es igual para todos los jugadores y no depende de nada que guarde el cliente: sale del reloj. Las ventanas parten del mismo reinicio
 * que la ruleta y el regalo (23:59 hora de Chile, domain/dailyWheel.ts): la de 24 h es el ciclo entero; las de 12 h, sus dos mitades.
 * Cada categoría tiene su propio orden fijo (mezcla con semilla) y cada ventana avanza de 3 en 3 sobre ese orden, así que cada cambio
 * muestra otros (con 6 o más, ninguno repetido; con 4 o 5, los menos posibles) y con el tiempo salen todos.
 *
 * Quien cobre (el servidor, más adelante) usa `purchaseOffered`: rechaza con 'not_in_shop' lo que ya no está en la Tienda.
 */
import { cycleIdAt, msToNextReset } from './dailyWheel';
import { type OpResult, purchase } from './operations';
import { type ItemId, type ItemKind, type PlayerState, clonePlayer } from './player';
import { weekIdAt } from './ranked';
import { SHOP_ITEMS, type ShopItem, shopItem } from './shopCatalog';

/** cuántos se ven a la vez en una categoría con rotación */
export const ROTATION_SHOW = 3;
/** categorías con rotación: cada cuántas horas cambian, cuántos se ven a la vez (por defecto ROTATION_SHOW) y si el contador sale siempre */
export const ROTATION: Partial<Record<ItemKind, { hours: 12 | 24 | 168; show?: number; alwaysTimer?: boolean }>> = {
  // PERSONAJES: 2 a la vez, cambian cada 24 h (NET, MAT, ISA y RIN)
  skin: { hours: 24, show: 2, alwaysTimer: true },
  charge: { hours: 12, alwaysTimer: true }, // (21-11-2026, usuario) con contador en el titulo como la ULTI (hoy solo hay 3, se ven todas)
  smash: { hours: 12 },
  defensive: { hours: 12 },
  inferno: { hours: 24 },
  // semanal; el contador sale siempre (aunque hoy se vean las 2 a la vez, cuando haya más estilos de zona rotarán)
  zone: { hours: 168, show: 2, alwaysTimer: true },
};

const HOUR = 3600_000;

/** Ventana actual de una rotación: su número (sube de uno en uno) y cuántos ms faltan para que cambie. */
export function rotationWindow(now: number, hours: 12 | 24 | 168): { id: number; nextMs: number } {
  const next = msToNextReset(now);
  const [y, m, d] = cycleIdAt(now).split('-').map(Number);
  const day = Math.round(Date.UTC(y, m - 1, d) / 86400_000);
  if (hours === 24) return { id: day, nextMs: next };
  if (hours === 168) {
    // semana de domingo a domingo (el día 3 desde 1970-01-01 fue domingo): cambia con el reinicio que abre el domingo
    const dow = (((day - 3) % 7) + 7) % 7; // 0 = domingo
    return { id: Math.floor((day - 3) / 7), nextMs: next + (6 - dow) * 86400_000 };
  }
  const second = next <= 12 * HOUR; // segunda mitad del ciclo: las últimas 12 h antes del reinicio
  return { id: day * 2 + (second ? 1 : 0), nextMs: second ? next : next - 12 * HOUR };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Aleatorio con semilla (mulberry32): el mismo orden para todos los jugadores. */
function seeded(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ítems a la venta de una categoría (los "próximamente" no entran en la rotación), en el orden del catálogo. */
function pool(kind: ItemKind): ShopItem[] {
  return SHOP_ITEMS.filter((i) => i.kind === kind && i.available);
}

/** Orden fijo de la rotación de una categoría (mezcla con semilla del nombre de la categoría, sobre los ids ordenados). */
function rotationOrder(kind: ItemKind): ShopItem[] {
  const list = [...pool(kind)].sort((a, b) => (a.id < b.id ? -1 : 1));
  const rnd = seeded(hash(`shop:${kind}`));
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/** Lo que la Tienda muestra AHORA de una categoría. Sin rotación: todo. Con 3 o menos: todo. */
export function shopOffers(kind: ItemKind, now: number, s?: RerollView): ShopItem[] {
  const rot = ROTATION[kind];
  const items = pool(kind);
  const show = rot?.show ?? ROTATION_SHOW;
  const byRarity = (list: ShopItem[]) => kind === 'charge'
    ? list.sort((a, b) => ['normal', 'especial', 'epica', 'legendaria'].indexOf(a.rarity ?? 'normal') - ['normal', 'especial', 'epica', 'legendaria'].indexOf(b.rarity ?? 'normal') || a.name.localeCompare(b.name, 'es'))
    : list;
  if (!rot || items.length <= show) return byRarity(items);
  const order = rotationOrder(kind);
  const w = rotationWindow(now, rot.hours);
  // (21-11-2026, usuario) con el CAMBIO pagado de esta semana se salta a la siguiente ventana: salen otros ítems
  const start = ((w.id + rerollShift(s, kind, now)) * show) % order.length;
  return byRarity(Array.from({ length: show }, (_, i) => order[(start + i) % order.length]));
}

/** ms para que cambie lo que muestra una categoría; null si no rota o no hay otros que mostrar. */
export function offersChangeIn(kind: ItemKind, now: number): number | null {
  const rot = ROTATION[kind];
  if (!rot || (pool(kind).length <= (rot.show ?? ROTATION_SHOW) && !rot.alwaysTimer)) return null;
  return rotationWindow(now, rot.hours).nextMs;
}

/** ¿Está este ítem a la venta ahora? (lo que no rota, siempre; lo que rota, solo si está en la ventana actual). */
export function isOnSale(id: ItemId, now: number, s?: RerollView): boolean {
  const it = shopItem(id);
  if (!it) return false;
  if (!ROTATION[it.kind]) return true;
  return shopOffers(it.kind, now, s).some((o) => o.id === id);
}

/** Compra solo lo que la Tienda muestra ahora (rechaza 'not_in_shop' lo demás). El resto de las reglas, en operations.purchase. */
export function purchaseOffered(s: PlayerState, id: ItemId, now: number = Date.now()): OpResult {
  if (!isOnSale(id, now, s)) return { ok: false, error: 'not_in_shop' };
  return purchase(s, id);
}

// ================================================================ CAMBIO de ofertas (21-11-2026, usuario)
/**
 * Al tocar el reloj de una categoría se puede CAMBIAR sus ofertas pagando dinero virtual: una vez por categoría y semana (se reinicia el
 * LUNES, como la liga) y trae otros ítems (salta a la siguiente ventana de la rotación hasta el lunes). Solo tiene sentido si la
 * categoría tiene más ítems de los que muestra (hoy: ULTI, ESPECIAL y DEFENSIVO); si no, no cobra nada.
 */
export const REROLL_PRICE = 100;
/** lo que mira la rotación del estado del jugador (basta con esto) */
export type RerollView = { shopReroll?: { week: string; kinds: ItemKind[] } };
/** ¿Ya se cambió esta categoría esta semana? */
export function rerolledThisWeek(s: RerollView | undefined, kind: ItemKind, now: number): boolean {
  return !!s?.shopReroll && s.shopReroll.week === weekIdAt(now) && s.shopReroll.kinds.includes(kind);
}
/** cuántas ventanas se adelanta la categoría: 1 si se cambió esta semana, 0 si no */
export function rerollShift(s: RerollView | undefined, kind: ItemKind, now: number): number {
  return rerolledThisWeek(s, kind, now) ? 1 : 0;
}
/** ¿Hay otros ítems que mostrar en esta categoría? (más ítems de los que se ven a la vez) */
export function canReroll(kind: ItemKind): boolean {
  const rot = ROTATION[kind];
  return !!rot && pool(kind).length > (rot.show ?? ROTATION_SHOW);
}
/** Cambia las ofertas de una categoría: cobra REROLL_PRICE de dinero y anota el cambio de la semana. */
export function rerollShop(s: PlayerState, kind: ItemKind, now: number = Date.now()): OpResult {
  if (!canReroll(kind)) return { ok: false, error: 'nothing_to_change' };
  if (rerolledThisWeek(s, kind, now)) return { ok: false, error: 'already_rerolled' };
  if (s.gems < REROLL_PRICE) return { ok: false, error: 'not_enough_cash' };
  const week = weekIdAt(now);
  const n = clonePlayer(s);
  n.gems -= REROLL_PRICE;
  const same = n.shopReroll && n.shopReroll.week === week ? n.shopReroll.kinds : []; // de otra semana: se empieza de cero (el lunes se reinicia)
  n.shopReroll = { week, kinds: [...same, kind] };
  return { ok: true, state: n };
}
