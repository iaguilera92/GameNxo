import { getPlayer } from '../domain/playerStore';

/**
 * Estadísticas del jugador en este dispositivo: victorias totales (BOT, Ranked y online).
 *
 * Va en su propia clave de localStorage y NO dentro de PlayerState a propósito: así no hay que tocar el esquema
 * ni la migración del jugador (domain/player.ts, domain/migrate.ts). La primera vez arranca con las victorias
 * Ranked que ya tenía el jugador, para no empezar de cero.
 */
const KEY = 'gamenxo.stats.v1';
/** ids de partidas ya contadas (evita contar dos veces la misma si la escena de resultados se repite) */
const MAX_IDS = 50;

interface Stats {
  wins: number;
  counted: string[];
}

function load(): Stats {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Stats> | null;
    if (raw && typeof raw.wins === 'number' && Number.isFinite(raw.wins)) {
      return { wins: Math.max(0, Math.floor(raw.wins)), counted: Array.isArray(raw.counted) ? raw.counted.filter((x) => typeof x === 'string').slice(-MAX_IDS) : [] };
    }
  } catch {
    /* sin almacenamiento o dato roto: se recalcula */
  }
  return { wins: getPlayer().ranked.total.wins, counted: [] };
}

function save(s: Stats) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* sin almacenamiento: se juega igual */
  }
}

/** Victorias totales del jugador. */
export function totalWins(): number {
  return load().wins;
}

/** Suma una victoria (una sola vez por `matchId`). Devuelve el total. */
export function recordWin(matchId: string): number {
  const s = load();
  if (s.counted.includes(matchId)) return s.wins;
  s.wins++;
  s.counted.push(matchId);
  if (s.counted.length > MAX_IDS) s.counted.shift();
  save(s);
  return s.wins;
}
