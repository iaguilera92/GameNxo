/**
 * ESTILOS DE ZONA (16-11-2026, decisión del usuario): cómo se ve la ZONA (remontada) de tu personaje. Datos puros, sin Phaser.
 *   ELÉCTRICA  (por defecto, de todos)  SOLO el rayo celeste en los ojos, sin aura (16-11-2026: el aura es de las que se venden)
 *   FUEGO      ÉPICA  (solo dinero real) aura de llamas rojo-naranja y rayo de fuego en los ojos
 *   SOMBRA     LEGENDARIA (solo dinero real; no se puede VER en la Tienda) aura de oscuridad morada con humo negro
 * Solo cambia lo que se ve: la ZONA hace lo mismo (logic/Zone.ts). Ids fijos (docs/BASE-DE-DATOS.md). Rareza y precio: domain/shopCatalog.ts.
 */
import type { SmashPower } from './smashPowers';
import { type PlayerState, clonePlayer, owns } from './player';

export type ZoneSkinId = 'electric' | 'fire' | 'shadow';
export const ZONE_SKIN_IDS: ZoneSkinId[] = ['electric', 'fire', 'shadow'];

export interface ZoneSkinDef {
  id: ZoneSkinId;
  name: string;
  desc: string;
  /** color principal y caliente del rayo de los ojos y del aura (fx/ZoneFx.ts) */
  col: number;
  hot: number;
  /** aura de llamas del personaje (objects/HyperAura.ts, con los colores de ese poder) */
  aura: SmashPower;
  /** colores propios del aura (si los del poder no sirven: el aura del SMASH de fuego es morada) */
  auraPal?: { col: number; hot: number; core: number };
  /** destello de pantalla al entrar en Zona */
  flash: number;
  /** humo oscuro (normal, no aditivo) alrededor: la Sombra */
  smoke?: boolean;
  /** sin aura (ni llamas ni rayitos ni chispas): solo el rayo de los ojos. La Zona por defecto: el aura se compra */
  noAura?: boolean;
}

export const ZONE_SKINS: Record<ZoneSkinId, ZoneSkinDef> = {
  electric: { id: 'electric', name: 'Eléctrica', desc: 'Rayo de luz en los ojos.', col: 0x5fd4ff, hot: 0xe8fbff, aura: 'ice', flash: 0x5fd4ff, noAura: true },
  fire: { id: 'fire', name: 'Fuego', desc: 'Aura de llamas y un rayo de fuego en los ojos.', col: 0xff6a2a, hot: 0xffe0a0, aura: 'fire', auraPal: { col: 0xff4a10, hot: 0xffa21e, core: 0xfff1c0 }, flash: 0xff6a2a },
  shadow: { id: 'shadow', name: 'Sombra', desc: 'Oscuridad morada, humo negro y ojos de sombra.', col: 0x9b4dff, hot: 0xe2c8ff, aura: 'shadow', flash: 0x5a2bb0, smoke: true },
};

export const isZoneSkin = (v: unknown): v is ZoneSkinId => typeof v === 'string' && (ZONE_SKIN_IDS as string[]).includes(v);

/** La Eléctrica es de todos; las demás, si las compraste. */
export function zoneSkinOwned(s: PlayerState, id: ZoneSkinId): boolean {
  return id === 'electric' || owns(s, `zone:${id}`);
}

/** Estilo de Zona en uso (el elegido si sigue siendo tuyo; si no, la Eléctrica). */
export function zoneSkinOf(s: PlayerState): ZoneSkinDef {
  const id = s.equipped.zone;
  return ZONE_SKINS[id && isZoneSkin(id) && zoneSkinOwned(s, id) ? id : 'electric'];
}

export function equipZoneSkin(s: PlayerState, id: ZoneSkinId): { ok: true; state: PlayerState } | { ok: false; error: 'not_found' | 'not_owned' } {
  if (!isZoneSkin(id)) return { ok: false, error: 'not_found' };
  if (!zoneSkinOwned(s, id)) return { ok: false, error: 'not_owned' };
  const n = clonePlayer(s);
  if (id === 'electric') delete n.equipped.zone;
  else n.equipped.zone = id;
  return { ok: true, state: n };
}
