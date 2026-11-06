/**
 * Punto único de acceso al estado del jugador desde el juego.
 *
 * Hoy guarda en localStorage. Para el online basta con otro `PlayerRepository`
 * (API REST / Supabase) sin tocar escenas ni operaciones.
 */
import { migratePlayer } from './migrate';
import type { OpResult } from './operations';
import type { PlayerState } from './player';

export interface PlayerRepository {
  load(): unknown; // datos crudos (se validan con migratePlayer)
  save(s: PlayerState): void;
}

const KEY_V2 = 'gamenxo.player.v2';
const KEY_V1 = 'gamenxo.profile.v1'; // se lee para migrar; no se borra

export class LocalPlayerRepository implements PlayerRepository {
  load(): unknown {
    try {
      const raw = localStorage.getItem(KEY_V2) ?? localStorage.getItem(KEY_V1);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
  save(s: PlayerState) {
    try {
      localStorage.setItem(KEY_V2, JSON.stringify(s));
    } catch {
      /* sin almacenamiento: se juega igual */
    }
  }
}

let repo: PlayerRepository = new LocalPlayerRepository();
let state: PlayerState | null = null;
type Listener = (s: PlayerState) => void;
const listeners = new Set<Listener>();

/** Cambia el almacenamiento (tests / backend futuro). */
export function setPlayerRepository(r: PlayerRepository) {
  repo = r;
  state = null;
}

/** Estado actual (solo lectura: para cambiarlo usar `commit`). */
export function getPlayer(): Readonly<PlayerState> {
  if (!state) {
    state = migratePlayer(repo.load());
    repo.save(state);
  }
  return state;
}

/** Aplica una operación; si sale bien, guarda y avisa. Devuelve el resultado tal cual. */
export function commit<R extends OpResult<object>>(op: (s: PlayerState) => R): R {
  const res = op(getPlayer() as PlayerState);
  if (res.ok) {
    state = res.state;
    repo.save(state);
    listeners.forEach((l) => l(res.state));
  }
  return res;
}

/** Suscripción a cambios (p. ej. contador de monedas). Devuelve la función para desuscribirse. */
export function onPlayerChange(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}
