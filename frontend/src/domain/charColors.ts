/**
 * ESTILOS DE COLOR del personaje (datos puros, sin Phaser). El efecto (croma selectivo) está en fx/CharColorFx.ts.
 *
 * - CLÁSICO: los colores de la hoja de sprites. Es de todos.
 * - El resto (AZUL, VERDE, MORADO, DORADO, SOMBRA) se ganan en el PASE DE BATALLA, cada uno PARA UN PERSONAJE (ítem `color:<id>:<skin>`, 19-11-2026).
 * - Se elige en PERSONALIZACIÓN y se guarda en `PlayerState.equipped.color`. Solo cambia cómo se ve tu personaje.
 */
export type CharColorId = 'classic' | 'azul' | 'verde' | 'morado' | 'dorado' | 'sombra' | 'gris'; // gris = regalo del tutorial (nivel 8, 24-11-2026)

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
  // (24-11-2026, usuario) GRIS: regalo del tutorial en el nivel 8 (rareza especial), para todos tus personajes
  { id: 'gris', name: 'GRIS', desc: 'Tu ropa en gris claro.', color: 0xa7afbd },
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

/**
 * (19-11-2026, usuario) Los estilos de color son POR PERSONAJE: ítem `color:<id>:<skin>` (p. ej. `color:azul:nxo` solo pinta a NXO).
 * Los `color:<id>` antiguos (sin personaje, ganados antes) siguen valiendo para TODOS los personajes.
 */
export const COLOR_SKINS = ['nxo', 'mai', 'jun'] as const;
export type ColorSkin = (typeof COLOR_SKINS)[number];

/** Ítem del color `id` para el personaje `skin`. */
export function charColorItem(id: CharColorId, skin: string): `color:${CharColorId}:${ColorSkin}` {
  return `color:${id}:${skin}` as `color:${CharColorId}:${ColorSkin}`;
}

/** Personaje y color de un ítem `color:<id>:<skin>` (null si es un `color:<id>` antiguo o no es un color). */
export function parseCharColorItem(item: string): { id: CharColorId; skin: string } | null {
  const [k, id, skin] = item.split(':');
  return k === 'color' && skin && isCharColor(id) ? { id, skin } : null;
}

/** ¿Lo tiene para este personaje? El clásico es de todos; `color:<id>` antiguo vale para todos; si no, `color:<id>:<skin>`. `owned` = PlayerState.owned. */
export function charColorOwned(owned: readonly string[], id: CharColorId, skin?: string): boolean {
  return id === 'classic' || owned.includes(`color:${id}`) || (!!skin && owned.includes(`color:${id}:${skin}`));
}

/** Color que se ve en `skin`: el elegido si lo tiene para ese personaje; si no, el clásico. */
export function charColorFor(owned: readonly string[], chosen: unknown, skin: string): CharColorId {
  const id = charColorOf(chosen);
  return charColorOwned(owned, id, skin) ? id : 'classic';
}
