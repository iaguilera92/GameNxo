/**
 * Punto único de acceso al estado del jugador desde el juego.
 *
 * Hoy guarda en localStorage. Para el online basta con otro `PlayerRepository`
 * (API REST / Supabase) sin tocar escenas ni operaciones.
 */
import { migratePlayer } from './migrate';
import { DEV_PROFILE_KEY, devProfile, isDevMode } from './devMode';
import type { OpResult } from './operations';
import type { PlayerState, StarterSkin } from './player';

export interface PlayerRepository {
  load(): unknown; // datos crudos (se validan con migratePlayer)
  save(s: PlayerState): void;
}

const KEY_V2 = 'gamenxo.player.v2';
const KEY_V1 = 'gamenxo.profile.v1'; // se lee para migrar; no se borra

export class LocalPlayerRepository implements PlayerRepository {
  /** key = clave donde se guarda; solo el perfil de siempre lee además el formato antiguo (v1) */
  constructor(private readonly key = KEY_V2) {}
  load(): unknown {
    try {
      const raw = localStorage.getItem(this.key) ?? (this.key === KEY_V2 ? localStorage.getItem(KEY_V1) : null);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
  save(s: PlayerState) {
    try {
      localStorage.setItem(this.key, JSON.stringify(s));
    } catch {
      /* sin almacenamiento: se juega igual */
    }
  }
}

/** perfil activo: el de siempre o, con el MODO DESARROLLO de AJUSTES, el de pruebas (domain/devMode.ts). Se elige al arrancar la app. */
const makeRepo = (dev: boolean): PlayerRepository => new LocalPlayerRepository(dev ? DEV_PROFILE_KEY : KEY_V2);
let repo: PlayerRepository = makeRepo(isDevMode());
let state: PlayerState | null = null;
/** personaje de un jugador nuevo (sin partida guardada): main.ts pone Mai en la web y Nxo en la app */
let starter: StarterSkin = 'nxo';
export function setStarterSkin(skin: StarterSkin) {
  starter = skin;
}
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
    state = migratePlayer(repo.load(), starter);
    if (isDevMode()) state = devProfile(state); // nivel 20 y todo desbloqueado
    repo.save(state);
  }
  return state;
}

/** Aplica una operación; si sale bien, guarda y avisa. Devuelve el resultado tal cual. */
export function commit<R extends OpResult<object> | { ok: true; state: PlayerState } | { ok: false; error: string }>(op: (s: PlayerState) => R): R {
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
