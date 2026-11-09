import type { SkinId } from './skins';
import type { SheetId } from './sheets';

/** Personaje del catálogo: lo que el jugador elige en PERSONAJE y lo que puede ser rival. */
export interface SkinDef {
  id: SkinId;
  name: string;
  sex: 'm' | 'f';
  /** Hoja de animaciones por vista: 'back' = jugador (abajo), 'front' = rival (arriba). */
  sheets: Record<'back' | 'front', SheetId>;
}

/** Personajes seleccionables. El rival se elige entre estos (distinto al del jugador). */
export const CATALOG: SkinDef[] = [
  { id: 'nxo', name: 'Nxo', sex: 'm', sheets: { back: 'nxo', front: 'nxo-front' } },
  { id: 'mai', name: 'Mai', sex: 'f', sheets: { back: 'mai', front: 'mai-front' } },
];

export const DEFAULT_SKIN: SkinId = 'nxo';

export function skinById(id: SkinId): SkinDef {
  return CATALOG.find((s) => s.id === id) ?? CATALOG[0];
}

/** Siguiente/anterior skin del catálogo (para el selector con flechas). */
export function cycleSkin(id: SkinId, dir: 1 | -1): SkinId {
  const i = CATALOG.findIndex((s) => s.id === id);
  const n = CATALOG.length;
  return CATALOG[(((i < 0 ? 0 : i) + dir) % n + n) % n].id;
}

/**
 * Rival automático para el personaje del jugador: siempre otro distinto del catálogo.
 * Con 2 personajes es "el otro"; con más, el siguiente en el orden (se puede cambiar aquí sin tocar el resto).
 */
export function rivalFor(playerId: string | undefined): SkinId {
  const i = CATALOG.findIndex((s) => s.id === playerId);
  return CATALOG[(i + 1) % CATALOG.length].id;
}

/** Hoja de animaciones de un personaje en una vista, o null si no tiene (usa el dibujo de siempre). */
export function sheetFor(id: string | undefined, view: 'front' | 'back'): SheetId | null {
  return CATALOG.find((s) => s.id === id)?.sheets[view] ?? null;
}
