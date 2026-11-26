import type { SkinId } from './skins';
import type { SheetId } from './sheets';

export type PlayableSkinId = Exclude<SkinId, 'player' | 'rival'>;

/** Personaje del catálogo: lo que el jugador elige en PERSONAJE y lo que puede ser rival. */
export interface SkinDef {
  id: PlayableSkinId;
  name: string;
  sex: 'm' | 'f';
  /** Hoja de animaciones por vista: 'back' = jugador (abajo), 'front' = rival (arriba). */
  sheets: { back: SheetId; front?: SheetId };
}

/** Personajes seleccionables. El rival se elige entre estos (distinto al del jugador). */
export const CATALOG: SkinDef[] = [
  { id: 'nxo', name: 'Nxo', sex: 'm', sheets: { back: 'nxo', front: 'nxo-front' } },
  { id: 'mai', name: 'Mai', sex: 'f', sheets: { back: 'mai', front: 'mai-front' } },
  { id: 'mat', name: 'Mat', sex: 'm', sheets: { back: 'mat', front: 'mat-front' } },
  { id: 'isa', name: 'Isa', sex: 'f', sheets: { back: 'isa', front: 'isa-front' } },
  { id: 'jun', name: 'Jun', sex: 'm', sheets: { back: 'jun', front: 'jun-front' } },
  { id: 'net', name: 'Net', sex: 'f', sheets: { back: 'net', front: 'net-front' } },
  { id: 'zac', name: 'Zac', sex: 'm', sheets: { back: 'zac', front: 'zac-front' } },
];

const RIVALS = CATALOG.filter((skin) => skin.sheets.front);

export function skinById(id: SkinId): SkinDef {
  return CATALOG.find((s) => s.id === id) ?? CATALOG[0];
}

/**
 * Rival automático: el siguiente personaje con arte de frente, distinto del jugador.
 */
export function rivalFor(playerId: string | undefined): SkinId {
  const i = RIVALS.findIndex((skin) => skin.id === playerId);
  return RIVALS[(i + 1) % RIVALS.length].id;
}

/**
 * Rival del tutorial 1v1: hombre en niveles impares, mujer en pares.
 * Cada grupo rota por el catálogo y excluye al personaje del jugador.
 */
export function tutorialRivalFor(playerId: string | undefined, level: number): SkinId {
  const pool = RIVALS.filter((s) => s.id !== playerId);
  if (!pool.length) return rivalFor(playerId);
  const want = level % 2 === 1 ? 'm' : 'f';
  const same = pool.filter((s) => s.sex === want);
  const n = Math.max(0, level - 1);
  return same.length ? same[Math.floor(n / 2) % same.length].id : pool[n % pool.length].id;
}

/** (25-11-2026, usuario) rival AL AZAR entre los personajes con arte de frente, distinto del tuyo (1v1 con el modo desarrollo encendido) */
export function randomRivalFor(playerId: string | undefined, rnd: () => number = Math.random): SkinId {
  const pool = RIVALS.filter((s) => s.id !== playerId);
  return pool.length ? pool[Math.floor(rnd() * pool.length)].id : rivalFor(playerId);
}

/** (25-11-2026, usuario) personajes del 2v2 contra bots: tu compañero (de espaldas) y los dos rivales (de frente) */
export type DoublesSkins = { ally: SkinId; rival1: SkinId; rival2: SkinId };
/**
 * (25-11-2026, usuario) 2v2 contra bots con VARIEDAD: tu compañero y los dos rivales son tres personajes DISTINTOS entre sí y del tuyo, al
 * azar en cada partido. Si no alcanzan (pocos personajes con arte), se repiten: primero el rival 2 pasa a ser tu personaje de frente
 * (como antes) y, con un solo personaje más, compañero y rival 1 son ese.
 */
export function doublesSkinsFor(playerId: string | undefined, rnd: () => number = Math.random): DoublesSkins {
  const pool = RIVALS.filter((s) => s.id !== playerId).map((s) => s.id);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const me = CATALOG.find((s) => s.id === playerId)?.id ?? 'nxo';
  const other = pool[0] ?? rivalFor(playerId);
  return { ally: pool[1] ?? other, rival1: other, rival2: pool[2] ?? me };
}

/** Hoja de animaciones de un personaje en una vista, o null si no tiene (usa el dibujo de siempre). */
export function sheetFor(id: string | undefined, view: 'front' | 'back'): SheetId | null {
  return CATALOG.find((s) => s.id === id)?.sheets[view] ?? null;
}
