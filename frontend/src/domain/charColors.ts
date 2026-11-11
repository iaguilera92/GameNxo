/**
 * ESTILOS DE COLOR del personaje (datos puros, sin Phaser). El efecto (croma selectivo) está en fx/CharColorFx.ts.
 *
 * - CLÁSICO: los colores de la hoja de sprites. Es de todos.
 * - El resto (AZUL, VERDE, MORADO, DORADO, SOMBRA) se ganan en el PASE DE BATALLA (ítem `color:<id>`).
 * - Se elige en PERSONALIZACIÓN y se guarda en `PlayerState.equipped.color`. Solo cambia cómo se ve tu personaje.
 */
export type CharColorId = 'classic' | 'azul' | 'verde' | 'morado' | 'dorado' | 'sombra';

export interface CharColorInfo {
  id: CharColorId;
  name: string;
  desc: string;
  /** color de la interfaz (muestra, borde) */
  color: number;
}

export const CHAR_COLOR_LIST: CharColorInfo[] = [
  { id: 'classic', name: 'CLÁSICO', desc: 'Los colores de siempre de tu personaje.', color: 0xff4f5e },
  { id: 'azul', name: 'AZUL', desc: 'Tu ropa en azul eléctrico.', color: 0x2f7bff },
  { id: 'verde', name: 'VERDE', desc: 'Tu ropa en verde.', color: 0x2fd46a },
  { id: 'morado', name: 'MORADO', desc: 'Tu ropa en morado.', color: 0x9a45ff },
  { id: 'dorado', name: 'DORADO', desc: 'Tu ropa en dorado brillante.', color: 0xffc42e },
  { id: 'sombra', name: 'SOMBRA', desc: 'Tu ropa oscura, sin color.', color: 0x4a5266 },
];

const IDS = new Set<string>(CHAR_COLOR_LIST.map((c) => c.id));

export function isCharColor(v: unknown): v is CharColorId {
  return typeof v === 'string' && IDS.has(v);
}

/** Estilo en uso: el elegido (si es válido) o el clásico. */
export function charColorOf(chosen: unknown): CharColorId {
  return isCharColor(chosen) ? chosen : 'classic';
}

export function charColorInfo(id: CharColorId): CharColorInfo {
  return CHAR_COLOR_LIST.find((c) => c.id === id) ?? CHAR_COLOR_LIST[0];
}

/** ¿Lo tiene? El clásico es de todos; el resto se gana en el Pase (ítem `color:<id>`). `owned` = PlayerState.owned. */
export function charColorOwned(owned: readonly string[], id: CharColorId): boolean {
  return id === 'classic' || owned.includes(`color:${id}`);
}
