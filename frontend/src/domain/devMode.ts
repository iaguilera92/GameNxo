/**
 * MODO DESARROLLO (AJUSTES). Datos puros, sin Phaser.
 *
 * - ACTIVADO: se juega con un perfil de pruebas APARTE (nivel máximo, todos los poderes, estilos, efectos y personajes
 *   desbloqueados, 5.000 monedas y algo de dinero). Se guarda en su propia clave: lo que hagas ahí no toca el perfil normal.
 * - DESACTIVADO: el perfil de siempre. Al pasar de ON a OFF se BORRA y se empieza de cero: nivel 1, nada comprado y todo
 *   bloqueado por nivel salvo lo primero que se tiene (habilidades Dash y Smash de fuego, ulti de fuego, efecto de carga
 *   clásico, estilo clásico y el personaje inicial). Mientras siga en OFF, el progreso se guarda.
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
export const DEV_LEVEL = MAX_LEVEL;
/** dinero de pruebas del perfil de desarrollo (para poder comprar el Pase Premium u otros ítems de dinero) */
export const DEV_CASH = 500;
/** monedas con las que parte el perfil de desarrollo (entradas Ranked) */
export const DEV_COINS = 5000;

const FLAG_KEY = 'gamenxo.devMode';
/** claves del perfil de desarrollo (el de siempre está en playerStore: 'gamenxo.player.v2') */
export const DEV_PROFILE_KEY = 'gamenxo.player.dev';
/** lo que guarda el perfil normal (jugador, formato antiguo, estadísticas y apuesta del menú): se borra al pasar a OFF */
const NORMAL_PROFILE_KEYS = ['gamenxo.player.v2', 'gamenxo.profile.v1', 'gamenxo.stats.v1', 'gamenxo.menu.bet'];

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
    // de ON a OFF: el perfil normal empieza de cero (nivel 1, nada comprado)
    if (!on && isDevMode()) for (const k of NORMAL_PROFILE_KEYS) localStorage.removeItem(k);
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

/** El perfil de pruebas: lo que haya guardado, en nivel máximo, con todo desbloqueado y al menos 5.000 monedas. */
export function devProfile(s: PlayerState): PlayerState {
  const n = clonePlayer(s);
  n.level = DEV_LEVEL;
  n.owned = [...new Set<ItemId>([...n.owned, ...allItems()])];
  n.gems = Math.max(n.gems, DEV_CASH);
  n.coins = Math.max(n.coins, DEV_COINS);
  return n;
}
