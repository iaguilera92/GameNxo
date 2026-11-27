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
import { type ItemId, type PlayerState, clonePlayer, newPlayer } from './player';
import { TUTORIAL_GIFTS, tutorialSeenBefore } from './tutorial';
import { SHOP_ITEMS } from './shopCatalog';
import { EMOTES } from './emotes';
import { CHAR_COLOR_LIST, COLOR_SKINS, charColorItem } from './charColors';
import { BP_SEASON } from './battlePassConfig';
import { newBattlePass } from './battlePassState';

/** Con qué modo arranca la app cuando el jugador aún no ha elegido. (27-11-2026, usuario) false: siempre empieza en modo TUTORIAL (perfil normal). */
export const DEV_MODE_DEFAULT = false;
/**
 * (27-11-2026, usuario) Contraseña para ENCENDER el modo desarrollo en AJUSTES (numérica, hasta 6 dígitos). Está en el cliente: solo
 * evita que se encienda por error, no es seguridad de verdad (con cuentas, el modo desarrollo lo debería decidir el servidor).
 */
const DEV_PASSWORD = '7';
export const DEV_PASSWORD_MAX = 6;
export function checkDevPassword(pin: string): boolean {
  return pin === DEV_PASSWORD;
}
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

/**
 * (24-11-2026, usuario) PROBAR TUTORIAL LVL (AJUSTES, solo con el modo desarrollo encendido): borra el perfil normal, deja uno nuevo en el
 * nivel `level` con el tutorial de los niveles anteriores ya visto (tutorialSeenBefore) y pasa a modo OFF SIN volver a borrarlo. Después
 * hay que reiniciar la app. El perfil de pruebas (ON) no se toca.
 */
export function startTutorialAt(level: number) {
  const lv = Math.max(1, Math.min(MAX_LEVEL, Math.round(level)));
  const s = newPlayer();
  s.level = lv;
  s.xp = 0;
  if (lv > 1) s.onboarded = true; // en el nivel 1 se ve la pantalla de inicio (nombre y personaje)
  const seen = tutorialSeenBefore(lv);
  if (seen.length) s.tutorial = seen;
  // regalos de los niveles ya pasados (gris, estela azul)
  for (const g of TUTORIAL_GIFTS) if (g.level <= lv && !s.owned.includes(g.item as ItemId)) s.owned.push(g.item as ItemId);
  try {
    for (const k of NORMAL_PROFILE_KEYS) localStorage.removeItem(k);
    localStorage.setItem(NORMAL_PROFILE_KEYS[0], JSON.stringify(s));
    localStorage.setItem(FLAG_KEY, '0');
  } catch {
    /* sin almacenamiento: no se puede preparar */
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
    ...CHAR_COLOR_LIST.filter((c) => c.id !== 'classic').flatMap((c) => COLOR_SKINS.map((sk) => charColorItem(c.id, sk) as ItemId)),
  ];
}

/** El perfil de pruebas: lo que haya guardado, en nivel máximo, con todo desbloqueado y al menos 5.000 monedas. */
export function devProfile(s: PlayerState): PlayerState {
  const n = clonePlayer(s);
  n.level = DEV_LEVEL;
  n.owned = [...new Set<ItemId>([...n.owned, ...allItems()])];
  n.gems = Math.max(n.gems, DEV_CASH);
  n.coins = Math.max(n.coins, DEV_COINS);
  devSoonCharacterTiers(n);
  return n;
}

/**
 * (21-11-2026, usuario) PASE DE BATALLA: para probar cómo se ve al DESBLOQUEAR el personaje nuevo (JUN, aún no jugable: `soon`), el perfil de pruebas lo
 * deja DISPONIBLE para reclamar en el camino GRATIS y en el PREMIUM en cada arranque: el pase llega al nivel de ese premio, se activa el Premium y el
 * premio de personaje vuelve a quedar sin reclamar (así se puede reclamar una y otra vez, reiniciando la app). Solo en MODO DESARROLLO.
 */
function devSoonCharacterTiers(n: PlayerState) {
  const tiers = BP_SEASON.tiers
    .map((t, i) => ({ tier: i + 1, soon: (t.free.kind === 'character' && t.free.soon) || (t.prem.kind === 'character' && t.prem.soon) }))
    .filter((t) => t.soon)
    .map((t) => t.tier);
  if (!tiers.length) return;
  if (n.bp.season !== BP_SEASON.id) n.bp = newBattlePass(BP_SEASON.id);
  n.bp.xp = Math.max(n.bp.xp, Math.max(...tiers) * BP_SEASON.xpPerTier);
  n.bp.premium = true;
  n.bp.free = n.bp.free.filter((t) => !tiers.includes(t));
  n.bp.prem = n.bp.prem.filter((t) => !tiers.includes(t));
}
