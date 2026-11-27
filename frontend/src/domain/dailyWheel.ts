/**
 * RULETAS DIARIAS — lógica pura (estado -> nuevo estado + resultado). Sin Phaser ni DOM.
 * Igual que operations.ts: en el online el servidor ejecutará estas mismas funciones.
 *
 * Reglas:
 *  - Cada partida completada (ganada o perdida; no rendición ni abandono; id único) desbloquea UNA ruleta,
 *    hasta WHEEL.perDay. (`recordWin` conserva su nombre: lo llama MatchEndScene con cualquier partida completada.)
 *  - Ciclo diario: termina a las 23:59 de America/Santiago (Intl: incluye horario de verano).
 *  - Al girar, el premio se decide AQUÍ (aleatorio seguro y ponderado) y se guarda ANTES de animar:
 *    repetir la petición o cerrar la app no cambia el resultado (idempotente).
 *  - Reclamar entrega el premio y lo marca como reclamado en la MISMA operación (un solo guardado):
 *    no se puede cobrar dos veces.
 *  - Cambio de ciclo: los giros sin girar caducan; un premio ya decidido pero sin reclamar se entrega.
 */
import { addCash, addCoins, addXp, grantItem } from './operations';
import { gainChest } from './chest';
import { addCoins2v2 } from './coins2v2';
import type { OpResult } from './operations';
import { type ItemId, type PlayerState, clonePlayer, owns } from './player';
import { COSMETIC_CATALOG, WEIGHT_TOTAL, WHEEL, type WheelSlot } from './wheelConfig';
import { GUIDE_FIRST_WHEEL } from './tutorial';
import { type WheelReward, type WheelSpin, type WheelState, type WheelTier, newWheelState } from './wheelState';

export type { WheelReward, WheelSpin, WheelState, WheelTier } from './wheelState';

// ---------------------------------------------------------------- ciclo diario

let fmt: Intl.DateTimeFormat | null = null;
/** Fecha y hora de pared en Chile (con su horario de verano). */
function chileParts(ms: number) {
  fmt ??= new Intl.DateTimeFormat('en-CA', {
    timeZone: WHEEL.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const p: Record<string, number> = {};
  for (const x of fmt.formatToParts(new Date(ms))) if (x.type !== 'literal') p[x.type] = Number(x.value);
  return { y: p.year, m: p.month, d: p.day, h: p.hour % 24, min: p.minute };
}

/**
 * Id del ciclo al que pertenece `ms`. Desde las 23:59 cuenta ya como el día siguiente.
 * Al salir del horario de verano en Chile el reloj pasa de 24:00 a 23:00 y la hora 23:xx se repite:
 * esa hora repetida ya va DESPUÉS de las primeras 23:59, así que cuenta como el ciclo siguiente
 * (el ciclo nunca retrocede y no hay reinicio doble).
 */
export function cycleIdAt(ms: number): string {
  const c = chileParts(ms);
  const p = chileParts(ms - 3600_000);
  const wall = (x: typeof c) => Date.UTC(x.y, x.m - 1, x.d, x.h, x.min) / 60000;
  // en la última hora real el reloj de pared avanzó menos de 59 min → se atrasó (fin del horario de verano)
  const repeated = wall(c) - wall(p) < 59;
  let { y, m, d } = c;
  if (c.h > WHEEL.resetHour || (c.h === WHEEL.resetHour && (c.min >= WHEEL.resetMinute || repeated))) {
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    y = next.getUTCFullYear();
    m = next.getUTCMonth() + 1;
    d = next.getUTCDate();
  }
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Ms que faltan para el próximo reinicio (búsqueda binaria: respeta cambios de horario). */
export function msToNextReset(ms: number): number {
  const id = cycleIdAt(ms);
  let lo = ms;
  let hi = ms + 26 * 3600_000;
  if (cycleIdAt(hi) === id) return hi - ms; // no debería pasar
  while (hi - lo > 1000) {
    const mid = Math.floor((lo + hi) / 2);
    if (cycleIdAt(mid) === id) lo = mid;
    else hi = mid;
  }
  return hi - ms;
}

// ---------------------------------------------------------------- aleatorio seguro

export type Rng = () => number; // [0, 1)

/** Aleatorio criptográfico (Web Crypto) con 32 bits; respaldo Math.random si no existe. */
export const secureRng: Rng = () => {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.getRandomValues) {
    const a = new Uint32Array(1);
    c.getRandomValues(a);
    return a[0] / 4294967296;
  }
  return Math.random();
};

/** Elige por pesos enteros. */
export function pickWeighted<T extends { weight: number }>(items: T[], rng: Rng): T {
  const total = items.reduce((a, i) => a + i.weight, 0);
  let r = Math.floor(rng() * total);
  for (const it of items) {
    if (r < it.weight) return it;
    r -= it.weight;
  }
  return items[items.length - 1];
}

export function slotById(id: string): WheelSlot | undefined {
  return WHEEL.slots.find((s) => s.id === id);
}

// ---------------------------------------------------------------- operaciones

type WheelError = 'no_spin' | 'already_spun' | 'not_spun' | 'invalid' | 'already_bonus';
export type WheelResult<T = object> = ({ ok: true; state: PlayerState } & T) | { ok: false; error: WheelError };
const fail = (error: WheelError): { ok: false; error: WheelError } => ({ ok: false, error });

/**
 * Pone el estado al día con el ciclo de `now`. Si cambió: caducan los giros sin girar y se
 * entregan los premios decididos y no reclamados. Pura: devuelve un estado nuevo.
 */
export function syncCycle(s: PlayerState, now: number): PlayerState {
  const cycle = cycleIdAt(now);
  // solo hacia delante (AAAA-MM-DD se compara como texto): una hora anterior nunca reabre ni reinicia
  if (s.wheel.cycle && cycle <= s.wheel.cycle) return s;
  let n = clonePlayer(s);
  for (const sp of n.wheel.spins) if (sp.reward && !sp.claimed) n = applyReward(n, sp.reward, now).state;
  const bonusSpins = n.wheel.bonusSpins;
  n.wheel = newWheelState(cycle);
  n.wheel.bonusSpins = bonusSpins;
  return n;
}

/**
 * Registra una victoria (una vez por `matchId`). Si quedan ruletas hoy, desbloquea la siguiente.
 * `unlocked` = índice desbloqueado, o null (repetida o tope diario alcanzado).
 */
export function recordWin(s: PlayerState, matchId: string, now: number): WheelResult<{ unlocked: number | null; duplicate: boolean }> {
  if (!matchId) return fail('invalid');
  const n = clonePlayer(syncCycle(s, now));
  const w = n.wheel;
  if (w.matchIds.includes(matchId)) return { ok: true, state: n, unlocked: null, duplicate: true };
  w.matchIds.push(matchId);
  if (w.matchIds.length > WHEEL.maxMatchIds) w.matchIds.shift();
  w.wins++;
  if (w.spins.length >= WHEEL.perDay) return { ok: true, state: n, unlocked: null, duplicate: false };
  const index = w.spins.length;
  w.spins.push({ index, matchId, slot: null, reward: null, claimed: false, presented: false });
  return { ok: true, state: n, unlocked: index, duplicate: false };
}

/** Añade un giro bonus persistente, independiente del límite diario de partidas. */
export function grantBonusSpin(s: PlayerState, id: string): { state: PlayerState; index: number } {
  const n = clonePlayer(s);
  const existing = n.wheel.bonusSpins.findIndex((sp) => sp.matchId === id);
  if (existing >= 0) return { state: n, index: existing };
  const index = n.wheel.bonusSpins.length;
  n.wheel.bonusSpins.push({ index, matchId: id, slot: null, reward: null, claimed: false, presented: false });
  return { state: n, index };
}

export function bonusSpinIndex(s: PlayerState, id: string): number {
  return s.wheel.bonusSpins.findIndex((sp) => sp.matchId === id);
}

/**
 * (25-11-2026, usuario) RULETA DEL TUTORIAL: una por NIVEL subido (giro bonus con id `tutorial-level:N`; el del primer partido, GUIDE_FIRST_WHEEL),
 * fuera del tope diario (con las ruletas diarias, tras varias partidas en el día no salía ninguna). Índice de la que falta abrir sola, o -1.
 */
/** (26-11-2026, usuario) ruleta del tutorial que evoluciona a DORADA sí o sí (la del partido del nivel 3) */
export const GOLD_TUTORIAL_WHEEL = 'tutorial-level:3';
export function isTutorialSpinId(id: string) {
  return id === GUIDE_FIRST_WHEEL || id.startsWith('tutorial-level:');
}
export function nextTutorialBonus(s: PlayerState): number {
  return s.wheel.bonusSpins.findIndex((sp) => isTutorialSpinId(sp.matchId) && !sp.presented && !sp.claimed);
}
/** (26-11-2026, usuario) ruleta del tutorial aún SIN COBRAR (presentada o no): -1 si no hay */
export function unclaimedTutorialBonus(s: PlayerState): number {
  return s.wheel.bonusSpins.findIndex((sp) => isTutorialSpinId(sp.matchId) && !sp.claimed);
}
/** Marca un giro bonus como ya presentado (se abre solo una vez). */
export function markBonusPresented(s: PlayerState, index: number): WheelResult {
  const n = clonePlayer(s);
  const sp = n.wheel.bonusSpins[index];
  if (!sp) return fail('no_spin');
  sp.presented = true;
  return { ok: true, state: n };
}

/** Marca una ruleta como ya presentada (la apertura automática ocurre una sola vez). */
export function markPresented(s: PlayerState, index: number, now: number): WheelResult {
  const n = clonePlayer(syncCycle(s, now));
  const sp = n.wheel.spins[index];
  if (!sp) return fail('no_spin');
  sp.presented = true;
  return { ok: true, state: n };
}

/** Resuelve el premio de un sector (épico: elige opción; cosmético: elige del catálogo). */
export function resolvePrize(slot: WheelSlot, s: PlayerState, rng: Rng): WheelReward {
  const p = slot.prize;
  if (p.kind === 'coins' || p.kind === 'coins2v2' || p.kind === 'xp' || p.kind === 'cash') return { kind: p.kind, amount: p.amount };
  if (p.kind === 'chest') return { kind: 'chest' };
  if (p.kind === 'epic') {
    const o = pickWeighted(p.options, rng);
    return { kind: o.kind, amount: o.amount };
  }
  // cosmético: uno que el jugador NO tenga; si no queda ninguno, compensación
  const pool = COSMETIC_CATALOG.filter((c) => !owns(s, c.id));
  if (!pool.length) return { kind: 'coins', amount: WHEEL.duplicateCoins, duplicateOf: null };
  const c = pool[Math.floor(rng() * pool.length)];
  return { kind: 'item', item: c.id, name: c.name };
}

/** Premio con el bonus del nivel de la ruleta (monedas, EXP y dinero; el cosmético y la compensación por repetido no cambian). */
export function scaleReward(r: WheelReward, tier: WheelTier): WheelReward {
  const pct = WHEEL.tiers.bonusPct[tier];
  if (!pct || r.kind === 'item' || r.kind === 'chest') return r;
  if (r.kind === 'coins' && r.duplicateOf !== undefined) return r;
  // (17-11-2026, usuario) siempre se nota el bonus: al menos +1 (1 de dinero en ruleta dorada o épica = 2, no 1)
  return { ...r, amount: Math.max(r.amount + 1, Math.round((r.amount * (100 + pct)) / 100)) };
}

/** Tirada de UN toque: ¿sube la ruleta de nivel? (normal → dorada o épica; dorada → épica; la épica no sube más). */
export function rollTier(tier: WheelTier, rng: Rng): WheelTier {
  const up = WHEEL.tiers.upgrade;
  const r = Math.floor(rng() * WEIGHT_TOTAL);
  if (tier === 'normal') return r < up.normal.epic ? 'epic' : r < up.normal.epic + up.normal.gold ? 'gold' : 'normal';
  if (tier === 'gold') return r < up.gold.epic ? 'epic' : 'gold';
  return tier;
}

/**
 * Gira la ruleta `index`: decide (y guarda) el premio y la primera tirada de nivel (el 1.er toque). Si ya estaba girada,
 * devuelve el MISMO resultado (pulsaciones repetidas / reconexión / app cerrada a mitad de la animación).
 * `reward` es el premio FINAL (con el bonus del nivel); los toques siguientes llaman a `boost`.
 */
export function spin(s: PlayerState, index: number, now: number, rng: Rng = secureRng, bonus = false, forceSlot?: string): WheelResult<{ slot: WheelSlot; reward: WheelReward; tier: WheelTier; repeated: boolean }> {
  const n = clonePlayer(syncCycle(s, now));
  const sp = (bonus ? n.wheel.bonusSpins : n.wheel.spins)[index];
  if (!sp) return fail('no_spin');
  if (sp.slot && sp.reward) {
    const slot = slotById(sp.slot);
    if (!slot) return fail('invalid');
    return { ok: true, state: n, slot, reward: sp.reward, tier: sp.tier ?? 'normal', repeated: true };
  }
  // forceSlot: solo la RULETA TEST (desarrollo) elige el sector para probar cada premio
  // (26-11-2026, usuario) RULETAS DEL TUTORIAL hasta el nivel 5: monedas y dinero alternados (para llegar al 5 con ~20 de dinero y comprar
  // un defensivo): 1.er partido 100 monedas, nivel 2 = 5 de dinero, nivel 3 = 150 monedas, nivel 4 = 5 de dinero
  const TUT_SLOT: Record<string, string> = { [GUIDE_FIRST_WHEEL]: 'c100', 'tutorial-level:2': 'd5', 'tutorial-level:3': 'c150', 'tutorial-level:4': 'd5', 'tutorial-level:7': 'chest' }; // (27-11-2026, usuario) la del partido del nivel 7: COFRE
  const fixedId = sp.matchId ? TUT_SLOT[sp.matchId] : undefined;
  const slot = (fixedId ? slotById(fixedId) : forceSlot && slotById(forceSlot)) || pickWeighted(WHEEL.slots, rng);
  const base = resolvePrize(slot, n, rng);
  const tier = fixedId ? 'normal' : rollTier('normal', rng);
  const reward = scaleReward(base, tier);
  sp.slot = slot.id;
  sp.base = base;
  sp.reward = reward;
  sp.tier = tier;
  sp.taps = 1;
  sp.presented = true;
  return { ok: true, state: n, slot, reward, tier, repeated: false };
}

/**
 * Un toque más sobre la ruleta ya girada (2.º a 4.º): tira una vez para subirla de nivel. Si sube, el premio se recalcula
 * desde el premio base. El número de toques se guarda: no se puede tirar de más ni repetir una tirada. No hace nada si el
 * premio ya se cobró, si no hay premio base (giro viejo) o si ya se usaron todos los toques.
 */
export function boost(s: PlayerState, index: number, now: number, rng: Rng = secureRng, bonus = false): WheelResult<{ reward: WheelReward; tier: WheelTier; upgraded: boolean }> {
  const n = clonePlayer(syncCycle(s, now));
  const sp = (bonus ? n.wheel.bonusSpins : n.wheel.spins)[index];
  if (!sp || !sp.slot || !sp.reward) return fail('not_spun');
  const tier = sp.tier ?? 'normal';
  const taps = sp.taps ?? WHEEL.tiers.maxTaps;
  if (sp.claimed || !sp.base || taps >= WHEEL.tiers.maxTaps) return { ok: true, state: n, reward: sp.reward, tier, upgraded: false };
  sp.taps = taps + 1;
  // (26-11-2026, usuario) TUTORIAL: la ruleta del nivel 3 (al pasar al 4) evoluciona a DORADA sí o sí en el primer toque extra, y ahí se queda
  const goldTut = sp.matchId === GOLD_TUTORIAL_WHEEL;
  const next = goldTut ? 'gold' : rollTier(tier, rng);
  if (next === tier) return { ok: true, state: n, reward: sp.reward, tier, upgraded: false };
  sp.tier = next;
  sp.reward = scaleReward(sp.base, next);
  return { ok: true, state: n, reward: sp.reward, tier: next, upgraded: true };
}

/** Entrega un premio con las operaciones de siempre (monedas, XP, inventario). */
function applyReward(s: PlayerState, r: WheelReward, now = Date.now()): { state: PlayerState; given: WheelReward } {
  let res: OpResult;
  let given = r;
  if (r.kind === 'chest') {
    // cofre: nuevo (2 días) o sube de nivel; si ya era ÉPICO, monedas (lo entregado queda como monedas)
    const g = gainChest(s, now);
    return { state: g.state, given: g.gain.kind === 'coins' ? { kind: 'coins', amount: g.gain.amount } : r };
  }
  if (r.kind === 'item') {
    if (owns(s, r.item)) {
      // se consiguió entre el giro y el cobro (p. ej. comprado): política de duplicados
      given = { kind: 'coins', amount: WHEEL.duplicateCoins, duplicateOf: r.item };
      res = addCoins(s, WHEEL.duplicateCoins);
    } else res = grantItem(s, r.item);
  } else if (r.kind === 'xp') res = addXp(s, r.amount);
  else if (r.kind === 'cash') res = addCash(s, r.amount);
  else if (r.kind === 'coins2v2') res = { ok: true, state: addCoins2v2(s, r.amount) };
  else res = addCoins(s, r.amount);
  return { state: res.ok ? res.state : s, given };
}

/** Cobra el premio de la ruleta `index`. Idempotente: la segunda vez no entrega nada. */
export function claim(s: PlayerState, index: number, now: number, bonus = false): WheelResult<{ given: WheelReward | null; already: boolean }> {
  const synced = syncCycle(s, now);
  const sp0 = (bonus ? synced.wheel.bonusSpins : synced.wheel.spins)[index];
  if (!sp0) return fail('no_spin');
  if (!sp0.reward) return fail('not_spun');
  if (sp0.claimed) return { ok: true, state: synced, given: null, already: true };
  const { state, given } = applyReward(synced, sp0.reward, now);
  const n = clonePlayer(state);
  const sp = (bonus ? n.wheel.bonusSpins : n.wheel.spins)[index];
  sp.claimed = true;
  sp.reward = given;
  return { ok: true, state: n, given, already: false };
}

/** Duplica una recompensa ya cobrada tras completar un anuncio; una sola vez por giro. */
export function claimAdBonus(s: PlayerState, index: number, now: number, bonus = false): WheelResult<{ given: WheelReward | null }> {
  const synced = syncCycle(s, now);
  const sp0 = (bonus ? synced.wheel.bonusSpins : synced.wheel.spins)[index];
  if (!sp0) return fail('no_spin');
  if (!sp0.claimed || !sp0.reward) return fail('not_spun');
  if (sp0.adBonusClaimed) return fail('already_bonus');

  // Un cosmético no se puede duplicar; entrega la compensación habitual en monedas.
  const extra: WheelReward = sp0.reward.kind === 'item' || sp0.reward.kind === 'chest'
    ? { kind: 'coins', amount: WHEEL.duplicateCoins, duplicateOf: sp0.reward.kind === 'item' ? sp0.reward.item : null }
    : sp0.reward;
  const applied = applyReward(synced, extra);
  const n = clonePlayer(applied.state);
  const spin = (bonus ? n.wheel.bonusSpins : n.wheel.spins)[index];
  spin.adBonusClaimed = true;
  return { ok: true, state: n, given: applied.given };
}

// ---------------------------------------------------------------- consultas

export type WheelStatus = 'locked' | 'ready' | 'spun' | 'done';

/** Estado visible de cada una de las ruletas del día (aplica el ciclo de `now` sin guardar). */
export function wheelStatuses(s: PlayerState, now: number): WheelStatus[] {
  const w = syncCycle(s, now).wheel;
  return Array.from({ length: WHEEL.perDay }, (_, i) => {
    const sp = w.spins[i];
    if (!sp) return 'locked';
    if (sp.claimed) return 'done';
    return sp.reward ? 'spun' : 'ready';
  });
}

/** Primera ruleta pendiente que aún no se abrió automáticamente (o -1). */
export function nextToPresent(s: PlayerState, now: number): number {
  const w = syncCycle(s, now).wheel;
  const sp = w.spins.find((x) => !x.presented && !x.claimed);
  return sp ? sp.index : -1;
}

/** Valida datos guardados (migración). */
export function sanitizeWheel(raw: unknown): WheelState {
  if (!raw || typeof raw !== 'object') return newWheelState();
  const r = raw as Record<string, unknown>;
  const w = newWheelState(typeof r.cycle === 'string' ? r.cycle : '');
  w.wins = typeof r.wins === 'number' && Number.isFinite(r.wins) ? Math.max(0, Math.floor(r.wins)) : 0;
  w.matchIds = Array.isArray(r.matchIds) ? r.matchIds.filter((x): x is string => typeof x === 'string').slice(-WHEEL.maxMatchIds) : [];
  const spins = Array.isArray(r.spins) ? r.spins : [];
  const parseSpins = (values: unknown[], limit: number, into: WheelSpin[]) => {
    for (const x of values.slice(0, limit)) {
      if (!x || typeof x !== 'object') break;
      const o = x as Record<string, unknown>;
      const slot = typeof o.slot === 'string' && slotById(o.slot) ? o.slot : null;
      const reward = slot ? validReward(o.reward) : null;
      const base = reward ? validReward(o.base) : null;
      const tier: WheelTier = o.tier === 'gold' || o.tier === 'epic' ? o.tier : 'normal';
      const taps = typeof o.taps === 'number' && Number.isInteger(o.taps) ? Math.min(WHEEL.tiers.maxTaps, Math.max(0, o.taps)) : undefined;
      into.push({
        index: into.length,
        matchId: typeof o.matchId === 'string' ? o.matchId : '',
        slot: reward ? slot : null,
        reward,
        ...(base ? { base } : {}),
        ...(reward && tier !== 'normal' ? { tier } : {}),
        ...(reward && taps !== undefined ? { taps } : {}),
        claimed: !!o.claimed && !!reward,
        presented: !!o.presented,
        adBonusClaimed: !!o.adBonusClaimed,
      });
    }
  };
  parseSpins(spins, WHEEL.perDay, w.spins);
  parseSpins(Array.isArray(r.bonusSpins) ? r.bonusSpins : [], 100, w.bonusSpins);
  return w;
}

/** Premio guardado con forma válida (si no, se descarta). */
function validReward(v: unknown): WheelReward | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  const amt = typeof r.amount === 'number' && Number.isInteger(r.amount) && r.amount > 0 ? r.amount : 0;
  if (r.kind === 'coins' && amt) {
    if (!('duplicateOf' in r)) return { kind: 'coins', amount: amt };
    return { kind: 'coins', amount: amt, duplicateOf: typeof r.duplicateOf === 'string' ? (r.duplicateOf as ItemId) : null };
  }
  if (r.kind === 'xp' && amt) return { kind: 'xp', amount: amt };
  if (r.kind === 'cash' && amt) return { kind: 'cash', amount: amt };
  if (r.kind === 'coins2v2' && amt) return { kind: 'coins2v2', amount: amt };
  if (r.kind === 'item' && typeof r.item === 'string' && COSMETIC_CATALOG.some((c) => c.id === r.item))
    return { kind: 'item', item: r.item as ItemId, name: typeof r.name === 'string' ? r.name : '' };
  return null;
}
