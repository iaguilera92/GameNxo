/**
 * MODO DESARROLLO (AJUSTES). Datos puros, sin Phaser.
 *
 * - ACTIVADO: se juega con un perfil de pruebas APARTE (nivel 20, todos los poderes, estilos, efectos y personajes
 *   desbloqueados, algo de dinero). Se guarda en su propia clave: lo que hagas ahí no toca tu progreso real.
 * - DESACTIVADO: el perfil de siempre. Uno nuevo empieza en nivel 1 con todo bloqueado salvo lo primero que se tiene
 *   (habilidades Dash y Smash de fuego, ulti de fuego, efecto de carga clásico, estilo clásico y Nxo).
 *
 * Mientras se prueba, la app EMPIEZA con el modo activado (DEV_MODE_DEFAULT). La elección se guarda en el dispositivo (clave
 * propia, para que el almacén del jugador la lea sin depender de los ajustes de sonido, que usan Phaser): al apagarlo en
 * AJUSTES la app se reinicia y arranca con el perfil normal, y así sigue hasta que se vuelva a encender.
 */
import { MAX_LEVEL } from '../config';
import { CATALOG } from '../characters/catalog';
import { type ItemId, type PlayerState, clonePlayer } from './player';
import { SHOP_ITEMS } from './shopCatalog';
import { EMOTES } from './emotes';
import { CHAR_COLOR_LIST } from './charColors';

/** Con qué modo arranca la app cuando el jugador aún no ha elegido. 	rue mientras se prueba; ponlo en alse para publicar. */
export const DEV_MODE_DEFAULT = true;
export const DEV_LEVEL = 20;
/** dinero de pruebas del perfil de desarrollo (para poder comprar el Pase Premium u otros ítems de dinero) */
export const DEV_CASH = 500;

const FLAG_KEY = 'gamenxo.devMode';
/** claves del perfil de desarrollo (el de siempre está en playerStore: 'gamenxo.player.v2') */
export const DEV_PROFILE_KEY = 'gamenxo.player.dev';

export function isDevMode(): boolean {
  try {
    const v = localStorage.getItem(FLAG_KEY);
    return v === null ? DEV_MODE_DEFAULT : v === '1';
  } catch {
    return DEV_MODE_DEFAULT;
  }
}

export function writeDevMode(on: boolean) {
  try {
    localStorage.setItem(FLAG_KEY, on ? '1' : '0');
  } catch {
    /* sin almacenamiento: vale para esta sesión */
  }
}

/** Todos los ítems que existen en el juego (Tienda + personajes del catálogo). */
export function allItems(): ItemId[] {
  return [
    ...SHOP_ITEMS.map((i) => i.id),
    ...CATALOG.map((s) => `skin:${s.id}` as ItemId),
    ...EMOTES.map((k) => `emote:${k}` as ItemId),
    ...CHAR_COLOR_LIST.filter((c) => c.id !== 'classic').map((c) => `color:${c.id}` as ItemId),
  ];
}

/** El perfil de pruebas: lo que haya guardado, con el nivel mínimo y todo desbloqueado. */
export function devProfile(s: PlayerState): PlayerState {
  const n = clonePlayer(s);
  n.level = Math.min(MAX_LEVEL, Math.max(DEV_LEVEL, n.level));
  n.owned = [...new Set<ItemId>([...n.owned, ...allItems()])];
  n.gems = Math.max(n.gems, DEV_CASH);
  return n;
}
