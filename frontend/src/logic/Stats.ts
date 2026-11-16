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
  /** partidas JUGADAS (terminadas, ganadas o no; 16-11-2026, para el PERFIL) y sus ids ya contados */
  played: number;
  countedPlayed: string[];
}

function load(): Stats {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Stats> | null;
    if (raw && typeof raw.wins === 'number' && Number.isFinite(raw.wins)) {
      const wins = Math.max(0, Math.floor(raw.wins));
      const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(-MAX_IDS) : []);
      // datos viejos sin `played`: al menos las victorias y las partidas Ranked ya jugadas
      const r = getPlayer().ranked.total;
      const played = typeof raw.played === 'number' && Number.isFinite(raw.played) ? Math.max(wins, Math.floor(raw.played)) : Math.max(wins, r.wins + r.losses);
      return { wins, counted: ids(raw.counted), played, countedPlayed: ids(raw.countedPlayed) };
    }
  } catch {
    /* sin almacenamiento o dato roto: se recalcula */
  }
  const r = getPlayer().ranked.total;
  return { wins: r.wins, counted: [], played: r.wins + r.losses, countedPlayed: [] };
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

/** Partidas jugadas (terminadas: ganadas, perdidas o rendidas). */
export function totalPlayed(): number {
  return load().played;
}

/** Suma una partida jugada (una sola vez por `matchId`). Devuelve el total. */
export function recordPlayed(matchId: string): number {
  const s = load();
  if (s.countedPlayed.includes(matchId)) return s.played;
  s.played++;
  s.countedPlayed.push(matchId);
  if (s.countedPlayed.length > MAX_IDS) s.countedPlayed.shift();
  save(s);
  return s.played;
}
