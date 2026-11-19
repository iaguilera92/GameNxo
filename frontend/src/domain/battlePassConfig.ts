/**
 * PASE DE BATALLA — configuración de la temporada (niveles, premios, precio). Sin lógica de premios:
 * operations.addXp la usa para llenar el pase sin imports circulares.
 *
 * El pase entrega algo de dinero (billetes), cosméticos (efecto pelota, cargando golpe), los 3 EMOTES, Rayos para la
 * ZONA y el personaje del final; las monedas quedan reservadas para Ranked.
 */
import type { ItemId, PlayerState, StyleId } from './player';
import type { SkinId } from '../characters/skins';
import { type CharColorId, charColorItem } from './charColors';
import { newBattlePass } from './battlePassState';
import { gameClock } from './timeSource';

export type BpReward =
  | { kind: 'cash'; amount: number }
  | { kind: 'item'; item: ItemId; name: string }
  /**
   * Personaje del final del Pase. `skin` puede ser uno que aún NO existe como personaje jugable (`soon`: solo tiene retrato, como JUN el 21-11-2026):
   * al reclamarlo no se entrega `skin:<id>` (no se puede elegir para jugar) y se guarda solo que el nivel está reclamado. `style` = estilo de la
   * pelota (Oro); `color` = estilo de COLOR del personaje (domain/charColors.ts: el premium de JUN lo trae DORADO) y se entrega como ítem `color:<id>`.
   */
  | { kind: 'character'; skin: SkinId | 'jun'; style?: StyleId; color?: CharColorId; soon?: true; name: string }
  /** Rayos de la ZONA (zone.rays): se gastan en sus atributos (PERSONALIZACIÓN) */
  | { kind: 'rays'; amount: number }
  /**
   * (19-11-2026, usuario) COFRE NORMAL (domain/chest.ts): como el de la ruleta, se abre a los 2 días. Si ya hay uno sin abrir, EVOLUCIONA
   * (normal → especial → épico, sin reiniciar el tiempo); si ya era épico, monedas. En lo entregado: `level` = cómo quedó el cofre, `coins` = compensación.
   */
  | { kind: 'chest'; level?: 0 | 1 | 2; upgraded?: boolean; coins?: number };

export type BpTrack = 'free' | 'prem';

export interface BpTier {
  free: BpReward;
  prem: BpReward;
}

const $ = (amount: number): BpReward => ({ kind: 'cash', amount });
const it = (item: ItemId, name: string): BpReward => ({ kind: 'item', item, name });
const rays = (amount: number): BpReward => ({ kind: 'rays', amount });
const chest: BpReward = { kind: 'chest' };

export const BP_SEASON = {
  id: 'S1',
  name: 'TEMPORADA 1',
  /**
   * Mes de la temporada ('AAAA-MM'): el Pase TERMINA el último día de ese mes (hora de Chile). Terminado, queda bloqueado
   * (menú, Tienda y pantalla del Pase) hasta que se publique otro con un `id` y un `month` nuevos (se reinicia solo).
   */
  month: '2026-11',
  /**
   * EXP por nivel del pase. Temporada 1: 100. DESDE LA TEMPORADA 2 (al cambiar `id` y `month`): 350 (economía aprobada,
   * docs/ECONOMIA.md: el casual lo completa cerca del día 25 del mes, el regular en ~2 semanas). No cambiarlo en plena
   * temporada: bajaría el nivel del pase de quien ya avanzó (los niveles se calculan como EXP / xpPerTier).
   */
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
  // (18-11-2026, usuario) al empezar NO se tiene ningún emote: la bienvenida ya no regala RISA (pasa al nivel 2; aquí queda su dinero)
  welcome: { free: $(1), prem: $(5) } as { free: BpReward; prem: BpReward },
  /**
   * DINERO DEL PASE (11-11-2026, con el usuario): un pase COMPLETO (gratis + premium) da como mucho para 2 objetos de la
   * Tienda de 50: GRATIS 40 y PREMIUM 60 (con la bienvenida) = 100. El resto del dinero sale de la ruleta, el premio
   * diario y la clasificación semanal. Antes daba 175 + 535.
   * niveles 1..N (índice 0 = nivel 1): el reparto de premios está explicado sobre `tiers` (19-11-2026).
   */
  /*
   * (19-11-2026, usuario) REPARTO NUEVO. Reglas: en un mismo camino nunca van seguidos dos premios del mismo tipo (solo el dinero puede ir seguido) y
   * tampoco en el mismo nivel o en niveles vecinos entre los dos caminos; de cada tipo hay uno en GRATIS y otro en PREMIUM:
   *   efecto pelota  Rosado 5 · Oro 3 (premium)          cargando golpe  Energía 23 · Tulipán 15 (premium)
   *   color (POR PERSONAJE, de NXO)  Azul 17 · Dorado 21 (premium)       cofre normal  11 · 7 (premium)
   *   emotes  Risa 2, Pensando 8, Enojado 14, Llorando 20 · LENTES 11 y TESORO 27 (legendarios, premium)
   *   Rayo 26 (gratis) y Jun 30 (los dos). El resto, dinero (gratis 36 + bienvenida 1; premium 55 + bienvenida 5, como antes).
   * Cargando gratis = ENERGÍA (no FUEGO): el FUEGO ya viene con NXO, que es el personaje de todos.
   * Fuera del Pase: efectos Verde y Rojo (siguen en la Tienda) y los colores Verde, Morado y Sombra.
   */
  tiers: [
    { free: $(1), prem: $(2) }, // 1
    { free: it('emote:happy', 'Risa'), prem: $(2) }, // 2
    { free: $(1), prem: it('style:gold', 'Oro') }, // 3
    { free: $(1), prem: $(2) }, // 4
    { free: it('style:pink', 'Rosado'), prem: $(2) }, // 5
    { free: $(1), prem: $(2) }, // 6
    { free: $(1), prem: chest }, // 7
    { free: it('emote:cool', 'Pensando'), prem: $(2) }, // 8
    { free: $(1), prem: $(2) }, // 9
    { free: $(1), prem: $(2) }, // 10
    { free: chest, prem: it('emote:shades', 'Lentes') }, // 11 (LENTES: emote LEGENDARIO animado)
    { free: $(1), prem: $(2) }, // 12
    { free: $(2), prem: $(2) }, // 13
    { free: it('emote:wow', 'Enojado'), prem: $(2) }, // 14
    { free: $(2), prem: it('charge:tulip', 'Tulipán') }, // 15
    { free: $(2), prem: $(2) }, // 16
    { free: it(charColorItem('azul', 'nxo'), 'Azul · NXO'), prem: $(2) }, // 17
    { free: $(2), prem: $(2) }, // 18
    { free: $(2), prem: $(2) }, // 19
    { free: it('emote:cry', 'Llorando'), prem: $(3) }, // 20
    { free: $(2), prem: it(charColorItem('dorado', 'nxo'), 'Dorado · NXO') }, // 21
    { free: $(2), prem: $(3) }, // 22
    { free: it('charge:energy', 'Energía'), prem: $(3) }, // 23
    { free: $(2), prem: $(3) }, // 24
    { free: $(2), prem: $(3) }, // 25
    { free: rays(1), prem: $(3) }, // 26
    { free: $(2), prem: it('emote:treasure', 'Tesoro') }, // 27 (TESORO: emote LEGENDARIO animado)
    { free: $(3), prem: $(3) }, // 28
    { free: $(3), prem: $(4) }, // 29
    // (21-11-2026, usuario) JUN reemplaza a MAI como personaje del nivel 30; aún NO se puede jugar (solo tiene retrato): `soon`. Premium: JUN con el
    // color DORADO. Cuando tenga sus hojas (docs/COMO-TRABAJAR-SPRITES-MOVIMIENTOS.md) se quita `soon` y se entrega `skin:jun`.
    { free: { kind: 'character', skin: 'jun', soon: true, name: 'Jun' }, prem: { kind: 'character', skin: 'jun', color: 'dorado', soon: true, name: 'Jun · Color Dorado' } },
  ] as BpTier[],
};

/** EXP máxima del pase (último nivel). */
export const bpMaxXp = () => BP_SEASON.tiers.length * BP_SEASON.xpPerTier;

/** "AAAA-MM-DD" del día en hora de Chile. */
const chileDay = (ms: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms);

/**
 * Fecha de término del Pase: último día de su mes (BP_SEASON.month). `over` = ya terminó (desde el día siguiente);
 * `daysLeft` cuenta hoy (1 = último día).
 */
export function bpSeasonInfo(now = gameClock.now()) {
  const [y, m] = BP_SEASON.month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const last = `${BP_SEASON.month}-${String(lastDay).padStart(2, '0')}`;
  const today = chileDay(now);
  const over = today > last;
  const [ty, tm, td] = today.split('-').map(Number);
  const daysLeft = over ? 0 : Math.round((Date.UTC(y, m - 1, lastDay) - Date.UTC(ty, tm - 1, td)) / 86_400_000) + 1;
  return { over, lastDay, month: m, year: y, daysLeft };
}

/** Suma EXP al pase (la llama operations.addXp). Pura: modifica el clon que recibe. Con el Pase terminado no suma. */
export function bpAddXpInPlace(n: PlayerState, amount: number) {
  if (bpSeasonInfo().over) return;
  if (n.bp.season !== BP_SEASON.id) n.bp = newBattlePass(BP_SEASON.id);
  n.bp.xp = Math.min(bpMaxXp(), n.bp.xp + Math.max(0, Math.floor(amount)));
}
