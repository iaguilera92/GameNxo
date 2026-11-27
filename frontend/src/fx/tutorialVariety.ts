import { getPlayer } from '../domain/playerStore';

/**
 * (26-11-2026, usuario) TUTORIAL (hasta el nivel 5): el mapa y la canción del partido no se repiten hasta haber salido todos,
 * para que el jugador conozca los ambientes y las canciones. Se guarda lo ya visto en localStorage (`tut.seen.<tipo>`).
 * Desde el nivel 6, sorteo normal (`fallback`).
 */
export const TUT_VARIETY_MAX_LEVEL = 5;

export function freshPick(kind: 'map' | 'music', options: string[], fallback: () => string): string {
  if (!options.length || getPlayer().level > TUT_VARIETY_MAX_LEVEL) return fallback();
  const key = `tut.seen.${kind}`;
  let seen: string[] = [];
  try {
    seen = JSON.parse(localStorage.getItem(key) ?? '[]');
  } catch {
    /* sin almacenamiento */
  }
  let left = options.filter((o) => !seen.includes(o));
  if (!left.length) {
    // ya salieron todos: vuelve a empezar, sin repetir el último
    const last = seen[seen.length - 1];
    seen = [];
    left = options.length > 1 ? options.filter((o) => o !== last) : options;
  }
  const pick = left[Math.floor(Math.random() * left.length)];
  try {
    localStorage.setItem(key, JSON.stringify([...seen, pick]));
  } catch {
    /* sin almacenamiento */
  }
  return pick;
}
