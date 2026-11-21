/**
 * RANKED v2 — rivales simulados del RANKING LIGA (datos puros, sin Phaser). Diseño: docs/RANKED-V2.md §7.
 *
 * - Solo de presentación: no son cuentas, no tienen saldo, no apuestan, no reciben premios y no ascienden.
 * - Ciclo SEMANAL: cada (liga, semana) genera su grupo de bots (nombres, perfiles y resultados nuevos). Deterministas: la misma
 *   tabla en cualquier dispositivo o servidor.
 * - Avanzan UNA VEZ AL DÍA (al empezar cada día de la semana se aplica ese día): estables durante el día.
 * - Perfiles: muy competitivo, competitivo, casual, poco activo e irregular. Cada semana un número distinto de bots (0..6)
 *   alcanza la meta; el resto queda por debajo. Nunca superan el 120 % de la meta de su liga.
 * - Un jugador REAL que pasa la meta queda PRIMERO: los bots se muestran por debajo del mejor de esos reales (buildBoard).
 * - Cuantos más jugadores reales haya en la liga, menos bots: bots = tableSize − reales.
 */
import { RANKED, league } from './rankedConfig';
import type { RankId } from './ranks';

export interface BoardEntry {
  id: string;
  name: string;
  bot: boolean;
  level: number;
  /** puntuación de la tabla: en el Ranking Liga, el NETO de la semana (puede ser negativo); en el Global, el saldo */
  coins: number;
  wins: number;
  losses: number;
  /** cuándo alcanzó esa puntuación (desempate final); 0 = sin dato */
  reachedAt: number;
  /** avatar: personaje y color de marco */
  avatar: { skin: 'nxo' | 'mai'; color: number };
  position: number;
}

/** Momento de la simulación: semana (lunes AAAA-MM-DD) y día visible (0 = lunes … 6 = domingo). */
export interface BotClock {
  week: string;
  day: number;
}

type Profile = 'pro' | 'competitive' | 'casual' | 'low' | 'irregular';

export const BOTS = {
  /** nivel de los bots: entre el de desbloqueo y este */
  maxLevel: 20, // = MAX_LEVEL (config.ts)
  /** tope del neto: fracción de la meta (120 %) */
  maxFrac: 1.2,
  /** cuántos bots alcanzan la meta cada semana (mín, máx; se sortea por liga y semana) */
  reach: [0, 6] as const,
  /** perfiles: reparto (suma 1), neto final como fracción de la meta y días activos */
  profiles: {
    pro: { share: 0.08, frac: [0.85, 1.2], days: [6, 7] },
    competitive: { share: 0.2, frac: [0.55, 0.95], days: [5, 7] },
    casual: { share: 0.35, frac: [0.2, 0.6], days: [3, 5] },
    low: { share: 0.25, frac: [0, 0.25], days: [1, 3] },
    irregular: { share: 0.12, frac: [-0.1, 0.8], days: [2, 5] },
  } as Record<Profile, { share: number; frac: readonly [number, number]; days: readonly [number, number] }>,
  /** de los que no alcanzan la meta: tope (fracción) para que el número de los que llegan sea exacto */
  belowFrac: 0.97,
};

const AVATAR_COLORS = [0x3a7bff, 0xff4f5e, 0x62d935, 0xffc42e, 0xb06bff, 0x37e0ff, 0xff8a3d, 0xff6fc8];
const PRE = ['Volea', 'Saque', 'Drop', 'Lob', 'Smash', 'Topspin', 'Slice', 'Ace', 'Net', 'Rally', 'Break', 'Deuce', 'Set', 'Spin', 'Match', 'Grip'];
const SUF = ['Rex', 'Zor', 'Kai', 'Nova', 'Vex', 'Lux', 'Max', 'Rio', 'Pix', 'Ozo', 'Fox', 'Yuk', 'Taz', 'Jet', 'Bly', 'Kip'];
const DAY = 86_400_000;

/** Hash de texto a 32 bits (FNV-1a). */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Generador determinista (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const between = (r: () => number, lo: number, hi: number) => Math.floor(lerp(lo, hi + 1, r()));

/** Mezcla determinista (Fisher-Yates con el generador dado): igual en cualquier motor de JavaScript. */
function shuffle<T>(arr: T[], r: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Meta de referencia de los bots: la meta de la liga; en la liga máxima (sin meta), 30 entradas. */
export function botGoal(id: RankId): number {
  const l = league(id);
  return l.target ?? l.entry * 30;
}

function weekStartMs(week: string): number {
  const [y, m, d] = week.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Resultado de un bot día a día: neto acumulado, victorias y derrotas al final de cada día (7 valores). */
interface BotWeek {
  net: number[];
  wins: number[];
  losses: number[];
}

function simulateWeek(r: () => number, profile: Profile, finalFrac: number, goal: number, entry: number): BotWeek {
  const cfg = BOTS.profiles[profile];
  const finalNet = Math.round((finalFrac * goal) / entry); // en "victorias netas" (pasos de una entrada)
  const active = between(r, cfg.days[0], cfg.days[1]);
  // días activos al azar (sin repetir)
  const days = shuffle([0, 1, 2, 3, 4, 5, 6], r).slice(0, active).sort((a, b) => a - b);
  // reparto irregular: pesos al azar, algún día fuerte y algún día negativo
  const w = days.map(() => Math.pow(r(), 1.4) + 0.05);
  if (days.length > 1 && r() < 0.6) w[Math.floor(r() * w.length)] *= 2.2; // día fuerte
  const sum = w.reduce((a, b) => a + b, 0);
  const steps = new Array(7).fill(0);
  let acc = 0;
  days.forEach((d, i) => {
    const share = i === days.length - 1 ? finalNet - acc : Math.round((finalNet * w[i]) / sum);
    steps[d] = share;
    acc += share;
  });
  // días negativos (perdió más de lo que ganó) compensados en otro día activo: el total no cambia
  if (days.length > 1) {
    for (let k = 0; k < days.length; k++) {
      if (r() < (profile === 'irregular' ? 0.45 : 0.2)) {
        const dip = between(r, 1, Math.max(1, Math.round(Math.abs(finalNet) * 0.12) + 1));
        const other = days[(k + 1 + Math.floor(r() * (days.length - 1))) % days.length];
        steps[days[k]] -= dip;
        steps[other] += dip;
      }
    }
  }
  const cap = Math.floor((BOTS.maxFrac * goal) / entry);
  const net: number[] = [];
  const wins: number[] = [];
  const losses: number[] = [];
  let n = 0;
  let wv = 0;
  let lv = 0;
  for (let d = 0; d < 7; d++) {
    const before = n;
    n = Math.min(cap, n + steps[d]);
    const dn = n - before;
    if (steps[d] !== 0 || days.includes(d)) {
      // partidas del día: las netas más pares ganadas/perdidas (parece gente que gana y pierde)
      const extra = between(r, 0, 4);
      const m = Math.abs(dn) + 2 * extra;
      wv += (m + dn) / 2;
      lv += (m - dn) / 2;
    }
    net.push(Math.max(0, n) * entry); // como los jugadores: el neto de la liga nunca baja de 0
    wins.push(wv);
    losses.push(lv);
  }
  return { net, wins, losses };
}

/**
 * Economía de la tabla cuando NO es la de la liga normal (LIGA 2v2, 21-11-2026): meta de ascenso, paso de un resultado neto (lo que se
 * gana en una victoria) y una etiqueta para que sus bots (nombres y resultados) sean otros.
 */
export interface BoardEcon {
  goal: number;
  entry: number;
  target: number | null;
  tag: string;
}
/** Bots de una liga en un momento dado. `realPlayers` = jugadores reales que también están en la tabla. `econ` = otra economía (2v2). */
export function botsFor(id: RankId, clock: BotClock, realPlayers = 1, econ?: BoardEcon): Omit<BoardEntry, 'position'>[] {
  const count = Math.max(0, RANKED.tableSize - Math.max(0, realPlayers));
  if (!count || !clock.week) return [];
  const goal = econ ? econ.goal : botGoal(id);
  const entry = econ ? econ.entry : league(id).entry;
  const tag = econ ? `${econ.tag}:` : '';
  const day = Math.min(6, Math.max(0, Math.floor(clock.day)));
  const week = rng(hash(`cohort:${tag}${id}:${clock.week}`));
  // cuántos llegan a la meta esta semana y quiénes (los primeros de una permutación)
  const reach = Math.min(count, between(week, BOTS.reach[0], BOTS.reach[1]));
  const order = shuffle(Array.from({ length: count }, (_, i) => i), week);
  const reachers = new Set(order.slice(0, reach));
  const profiles = Object.keys(BOTS.profiles) as Profile[];
  const t0 = weekStartMs(clock.week);
  const out: Omit<BoardEntry, 'position'>[] = [];
  for (let i = 0; i < count; i++) {
    const r = rng(hash(`bot:${tag}${id}:${clock.week}:${i}`));
    const name = `${PRE[Math.floor(r() * PRE.length)]}${SUF[Math.floor(r() * SUF.length)]}${Math.floor(r() * 90 + 10)}`;
    const skin = r() < 0.5 ? 'nxo' : 'mai';
    const color = AVATAR_COLORS[Math.floor(r() * AVATAR_COLORS.length)];
    const level = Math.floor(lerp(RANKED.unlockLevel, BOTS.maxLevel + 1, r()));
    let profile: Profile = 'irregular';
    if (reachers.has(i)) profile = 'pro';
    else {
      let x = r();
      for (const p of profiles) {
        x -= BOTS.profiles[p].share;
        if (x < 0) {
          profile = p;
          break;
        }
      }
    }
    const pf = BOTS.profiles[profile];
    const frac = reachers.has(i) ? lerp(1, BOTS.maxFrac, r()) : Math.min(BOTS.belowFrac, lerp(pf.frac[0], pf.frac[1], r()));
    const wk = simulateWeek(r, profile, frac, goal, entry);
    // los que llegan a la meta deben terminar en ella (el redondeo por días no puede dejarlos justo debajo)
    if (reachers.has(i) && wk.net[6] < goal) wk.net[6] = Math.ceil(goal / entry) * entry;
    out.push({
      id: `bot:${tag}${id}:${clock.week}:${i}`,
      name,
      bot: true,
      level,
      coins: wk.net[day],
      wins: wk.wins[day],
      losses: wk.losses[day],
      // "hora" en que llegó a esa puntuación: dentro del día visible (estable)
      // (sin partidas aún: 0, así un real con el mismo neto queda delante)
      reachedAt: wk.wins[day] + wk.losses[day] > 0 ? t0 + day * DAY + Math.floor(r() * DAY) : 0,
      avatar: { skin, color },
    });
  }
  return out;
}

/** Orden del Ranking Liga: neto ↓, victorias ↓, derrotas ↑, quien llegó antes ↑; empate total: reales primero. */
export function compareEntries(a: Omit<BoardEntry, 'position'>, b: Omit<BoardEntry, 'position'>): number {
  return (
    b.coins - a.coins ||
    b.wins - a.wins ||
    a.losses - b.losses ||
    (a.reachedAt || Number.MAX_SAFE_INTEGER) - (b.reachedAt || Number.MAX_SAFE_INTEGER) ||
    Number(a.bot) - Number(b.bot) ||
    a.id.localeCompare(b.id)
  );
}

/**
 * Tabla completa ordenada del RANKING LIGA. Posiciones 1..N. Si un jugador real pasó la meta, ningún bot queda por encima del
 * mejor de ellos (decisión del usuario, 16-11-2026): el neto mostrado del bot se rebaja por debajo de ese real.
 */
export function buildBoard(id: RankId, clock: BotClock, real: Omit<BoardEntry, 'position'>[], econ?: BoardEcon): BoardEntry[] {
  const target = econ ? econ.target : league(id).target;
  const entry = econ ? econ.entry : league(id).entry;
  const over = target != null ? real.filter((e) => e.coins >= target) : [];
  const bestReal = over.length ? Math.max(...over.map((e) => e.coins)) : null;
  const bots = botsFor(id, clock, real.length, econ).map((b) => (bestReal != null && b.coins >= bestReal ? { ...b, coins: bestReal - entry } : b));
  const rows = [...bots, ...real];
  rows.sort(compareEntries);
  return rows.slice(0, Math.max(RANKED.tableSize, real.length)).map((e, i) => ({ ...e, position: i + 1 }));
}

/** Bots del RANKING GLOBAL (16-11-2026, pedido del usuario: "que no se vea tan solo"). */
export const GLOBAL_BOTS = {
  /** saldo del más rico y del más pobre el día de inicio (reparto exponencial entre ambos) */
  top: 380_000,
  bottom: 1_800,
  /** inicio de la simulación: desde aquí crecen sus saldos día a día */
  epoch: Date.UTC(2026, 10, 1),
  /** crecimiento medio por día (0,4 %) y variación diaria (±3 %) */
  growth: 0.004,
  wobble: 0.03,
};

/**
 * Bots del Ranking Global: identidad ESTABLE (mismos nombres siempre, como cuentas de verdad) y saldo que cambia una vez al día
 * (crece de a poco, con altibajos). Deterministas: misma tabla en cualquier dispositivo. `day` = AAAA-MM-DD (corte diario).
 */
export function globalBotsFor(day: string, count: number): Omit<BoardEntry, 'position'>[] {
  const out: Omit<BoardEntry, 'position'>[] = [];
  const [y, m, d] = day.split('-').map(Number);
  const days = Math.max(0, Math.round((Date.UTC(y, m - 1, d) - GLOBAL_BOTS.epoch) / DAY));
  const ratio = GLOBAL_BOTS.top / GLOBAL_BOTS.bottom;
  for (let i = 0; i < count; i++) {
    const r = rng(hash(`gbot:${i}`));
    const name = `${PRE[Math.floor(r() * PRE.length)]}${SUF[Math.floor(r() * SUF.length)]}${Math.floor(r() * 90 + 10)}`;
    const skin = r() < 0.5 ? 'nxo' : 'mai';
    const color = AVATAR_COLORS[Math.floor(r() * AVATAR_COLORS.length)];
    const level = Math.floor(lerp(8, BOTS.maxLevel + 1, Math.pow(1 - i / Math.max(1, count), 0.6) * 0.8 + r() * 0.2));
    // puesto base i (0 = el más rico) con algo de ruido propio; cada bot crece a su ritmo
    const base = GLOBAL_BOTS.bottom * Math.pow(ratio, 1 - (i + r() * 0.9) / Math.max(1, count));
    const pace = lerp(0.3, 1.8, r());
    const wob = rng(hash(`gbot:${i}:${day}`))() * 2 - 1;
    const coins = Math.max(0, Math.round((base * (1 + GLOBAL_BOTS.growth * pace * days) * (1 + wob * GLOBAL_BOTS.wobble)) / 10) * 10);
    const played = Math.round(lerp(40, 900, Math.pow(1 - i / Math.max(1, count), 1.3)) * lerp(0.7, 1.3, r()) + days * pace);
    const wins = Math.round(played * lerp(0.42, 0.66, r()));
    out.push({ id: `gbot:${i}`, name, bot: true, level, coins, wins, losses: played - wins, reachedAt: 0, avatar: { skin, color } });
  }
  return out;
}

/**
 * RANKING GLOBAL: saldo de monedas, permanente. Con bots hasta completar la tabla (`day` = día actual); los jugadores REALES se
 * muestran SIEMPRE, aunque queden fuera del Top (se añaden al final con su posición real).
 */
export function buildGlobalBoard(real: Omit<BoardEntry, 'position'>[], day = ''): BoardEntry[] {
  const bots = day ? globalBotsFor(day, Math.max(0, RANKED.tableSize - real.length)) : [];
  const all = [...bots, ...real]
    .sort((a, b) => b.coins - a.coins || Number(a.bot) - Number(b.bot) || a.id.localeCompare(b.id))
    .map((e, i) => ({ ...e, position: i + 1 }));
  const top = all.slice(0, RANKED.tableSize);
  return [...top, ...all.slice(RANKED.tableSize).filter((e) => !e.bot)];
}

/**
 * POSICIÓN DE PREMIO (D7): solo entre jugadores reales; mientras no haya servidor (`botsCountForPositionPrizes`) la de la
 * tabla. null = no está en la tabla.
 */
export function prizePosition(board: BoardEntry[], playerId: string): number | null {
  const rows = RANKED.botsCountForPositionPrizes ? board : board.filter((e) => !e.bot);
  const i = rows.findIndex((e) => e.id === playerId);
  return i < 0 ? null : i + 1;
}
