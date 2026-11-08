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
import { addCoins, addXp, grantItem } from './operations';
import type { OpResult } from './operations';
import { type ItemId, type PlayerState, clonePlayer, owns } from './player';
import { COSMETIC_CATALOG, WHEEL, type WheelSlot } from './wheelConfig';
import { type WheelReward, type WheelState, newWheelState } from './wheelState';

export type { WheelReward, WheelSpin, WheelState } from './wheelState';

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

type WheelError = 'no_spin' | 'already_spun' | 'not_spun' | 'invalid';
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
  for (const sp of n.wheel.spins) if (sp.reward && !sp.claimed) n = applyReward(n, sp.reward).state;
  n.wheel = newWheelState(cycle);
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
  if (p.kind === 'coins' || p.kind === 'xp') return { kind: p.kind, amount: p.amount };
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

/**
 * Gira la ruleta `index`: decide (y guarda) el premio. Si ya estaba girada, devuelve el MISMO
 * resultado (pulsaciones repetidas / reconexión / app cerrada a mitad de la animación).
 */
export function spin(s: PlayerState, index: number, now: number, rng: Rng = secureRng): WheelResult<{ slot: WheelSlot; reward: WheelReward; repeated: boolean }> {
  const n = clonePlayer(syncCycle(s, now));
  const sp = n.wheel.spins[index];
  if (!sp) return fail('no_spin');
  if (sp.slot && sp.reward) {
    const slot = slotById(sp.slot);
    if (!slot) return fail('invalid');
    return { ok: true, state: n, slot, reward: sp.reward, repeated: true };
  }
  const slot = pickWeighted(WHEEL.slots, rng);
  const reward = resolvePrize(slot, n, rng);
  sp.slot = slot.id;
  sp.reward = reward;
  sp.presented = true;
  return { ok: true, state: n, slot, reward, repeated: false };
}

/** Entrega un premio con las operaciones de siempre (monedas, XP, inventario). */
function applyReward(s: PlayerState, r: WheelReward): { state: PlayerState; given: WheelReward } {
  let res: OpResult;
  let given = r;
  if (r.kind === 'item') {
    if (owns(s, r.item)) {
      // se consiguió entre el giro y el cobro (p. ej. comprado): política de duplicados
      given = { kind: 'coins', amount: WHEEL.duplicateCoins, duplicateOf: r.item };
      res = addCoins(s, WHEEL.duplicateCoins);
    } else res = grantItem(s, r.item);
  } else if (r.kind === 'xp') res = addXp(s, r.amount);
  else res = addCoins(s, r.amount);
  return { state: res.ok ? res.state : s, given };
}

/** Cobra el premio de la ruleta `index`. Idempotente: la segunda vez no entrega nada. */
export function claim(s: PlayerState, index: number, now: number): WheelResult<{ given: WheelReward | null; already: boolean }> {
  const synced = syncCycle(s, now);
  const sp0 = synced.wheel.spins[index];
  if (!sp0) return fail('no_spin');
  if (!sp0.reward) return fail('not_spun');
  if (sp0.claimed) return { ok: true, state: synced, given: null, already: true };
  const { state, given } = applyReward(synced, sp0.reward);
  const n = clonePlayer(state);
  const sp = n.wheel.spins[index];
  sp.claimed = true;
  sp.reward = given;
  return { ok: true, state: n, given, already: false };
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
  for (const x of spins.slice(0, WHEEL.perDay)) {
    if (!x || typeof x !== 'object') break;
    const o = x as Record<string, unknown>;
    const slot = typeof o.slot === 'string' && slotById(o.slot) ? o.slot : null;
    const reward = slot ? validReward(o.reward) : null;
    w.spins.push({
      index: w.spins.length,
      matchId: typeof o.matchId === 'string' ? o.matchId : '',
      slot: reward ? slot : null,
      reward,
      claimed: !!o.claimed && !!reward,
      presented: !!o.presented,
    });
  }
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
  if (r.kind === 'item' && typeof r.item === 'string' && COSMETIC_CATALOG.some((c) => c.id === r.item))
    return { kind: 'item', item: r.item as ItemId, name: typeof r.name === 'string' ? r.name : '' };
  return null;
}
