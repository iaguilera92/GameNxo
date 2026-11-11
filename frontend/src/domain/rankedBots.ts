/**
 * RANKED — rivales simulados para que las tablas nunca se vean vacías (datos puros, sin Phaser).
 *
 * - Deterministas: mismo (liga, mes, momento) ⇒ misma tabla en cualquier dispositivo / servidor.
 * - Identificados como bots (`bot: true`, id `bot:…`). Nunca reciben premios ni cuentan como jugadores reales.
 * - Nombres generados por sílabas + número (no copian usuarios reales).
 * - Sus monedas suben de forma progresiva durante el mes, con pequeñas variaciones por hora,
 *   y siempre quedan POR DEBAJO del objetivo de ascenso de su liga (no "ascienden" ni salen de la tabla).
 * - Cuantos más jugadores reales haya en la liga, menos bots: bots = tableSize − reales.
 */
import { RANKED, league, leagueFloor } from './rankedConfig';
import type { RankId } from './ranks';

export interface BoardEntry {
  id: string;
  name: string;
  bot: boolean;
  level: number;
  coins: number;
  wins: number;
  losses: number;
  /** avatar: personaje y color de marco */
  avatar: { skin: 'nxo' | 'mai'; color: number };
  position: number;
}

/** Momento de la simulación dentro del mes de ranking. */
export interface BotClock {
  month: string;
  /** 0..1 avance del mes */
  progress: number;
  /** contador horario (variaciones pequeñas que cambian cada hora) */
  tick: number;
}

export const BOTS = {
  /** nivel de los bots: entre el de desbloqueo y este */
  maxLevel: 20, // = MAX_LEVEL (config.ts)
  /** fracción del tramo de la liga con la que empiezan el mes (mín, máx) */
  startFrac: [0.02, 0.55] as const,
  /** cuánto del tramo pueden ganar en el mes (mín, máx) */
  growthFrac: [0.05, 0.5] as const,
  /** variación horaria (fracción del tramo, ±) */
  wobble: 0.015,
  /** tope: nunca más allá de esta fracción del tramo (por debajo del objetivo) */
  maxFrac: 0.985,
  /** porcentaje de victorias (mín, máx) */
  winRate: [0.38, 0.68] as const,
  /** partidas al final del mes (mín, máx) */
  matches: [12, 90] as const,
};

const AVATAR_COLORS = [0x3a7bff, 0xff4f5e, 0x62d935, 0xffc42e, 0xb06bff, 0x37e0ff, 0xff8a3d, 0xff6fc8];
const PRE = ['Volea', 'Saque', 'Drop', 'Lob', 'Smash', 'Topspin', 'Slice', 'Ace', 'Net', 'Rally', 'Break', 'Deuce', 'Set', 'Spin', 'Match', 'Grip'];
const SUF = ['Rex', 'Zor', 'Kai', 'Nova', 'Vex', 'Lux', 'Max', 'Rio', 'Pix', 'Ozo', 'Fox', 'Yuk', 'Taz', 'Jet', 'Bly', 'Kip'];

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

/** Tramo de monedas de la liga [base, techo) para los bots. */
function span(id: RankId) {
  const lo = leagueFloor(id);
  const t = league(id).target;
  const width = t != null ? t - lo : Math.max(lo, 1);
  return { lo, width };
}

/** Bots de una liga en un momento dado. `realPlayers` = jugadores reales que también están en la tabla. */
export function botsFor(id: RankId, clock: BotClock, realPlayers = 1): Omit<BoardEntry, 'position'>[] {
  const count = Math.max(0, RANKED.tableSize - Math.max(0, realPlayers));
  const { lo, width } = span(id);
  const out: Omit<BoardEntry, 'position'>[] = [];
  const p = Math.min(1, Math.max(0, clock.progress));
  for (let i = 0; i < count; i++) {
    // identidad estable por liga (el mismo bot sigue en su liga mes a mes); números del mes
    const who = rng(hash(`bot:${id}:${i}`));
    const r = rng(hash(`bot:${id}:${i}:${clock.month}`));
    const name = `${PRE[Math.floor(who() * PRE.length)]}${SUF[Math.floor(who() * SUF.length)]}${Math.floor(who() * 90 + 10)}`;
    const skin = who() < 0.5 ? 'nxo' : 'mai';
    const color = AVATAR_COLORS[Math.floor(who() * AVATAR_COLORS.length)];
    const level = Math.floor(lerp(RANKED.unlockLevel, BOTS.maxLevel + 1, who()));
    const start = lerp(BOTS.startFrac[0], BOTS.startFrac[1], r());
    const growth = lerp(BOTS.growthFrac[0], BOTS.growthFrac[1], r());
    const pace = lerp(0.6, 1.6, r()); // unos suben al principio, otros al final
    const wob = rng(hash(`bot:${id}:${i}:${clock.month}:${clock.tick}`));
    const frac = Math.min(BOTS.maxFrac, Math.max(0, start + growth * Math.pow(p, pace) + (wob() * 2 - 1) * BOTS.wobble * p));
    const coins = Math.round((lo + width * frac) / 10) * 10;
    const matches = Math.round(lerp(BOTS.matches[0], BOTS.matches[1], r()) * p);
    const wins = Math.round(matches * lerp(BOTS.winRate[0], BOTS.winRate[1], r()));
    out.push({ id: `bot:${id}:${i}`, name, bot: true, level, coins, wins, losses: matches - wins, avatar: { skin, color } });
  }
  return out;
}

/** Tabla completa ordenada (monedas desc.; empate: los jugadores reales primero). Posiciones 1..N. */
export function buildBoard(id: RankId, clock: BotClock, real: Omit<BoardEntry, 'position'>[]): BoardEntry[] {
  const rows = [...botsFor(id, clock, real.length), ...real];
  rows.sort((a, b) => b.coins - a.coins || Number(a.bot) - Number(b.bot) || a.id.localeCompare(b.id));
  return rows.slice(0, Math.max(RANKED.tableSize, real.length)).map((e, i) => ({ ...e, position: i + 1 }));
}

/**
 * Posición que cuenta para los premios: con `botsCountForPositionPrizes` la de la tabla; si no, solo entre
 * jugadores reales. null = no está en la tabla.
 */
export function prizePosition(board: BoardEntry[], playerId: string): number | null {
  const rows = RANKED.botsCountForPositionPrizes ? board : board.filter((e) => !e.bot);
  const i = rows.findIndex((e) => e.id === playerId);
  return i < 0 ? null : i + 1;
}
