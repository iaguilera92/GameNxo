import type { StyleId } from '../domain/player';

/**
 * Cómo se VE cada estilo comprado (Tienda / Personaje) en el partido:
 *   trail    color de la estela de TUS golpes normales (los globos, dejadas y el SMASH siguen con su color)
 *   ring     destello de color en tu raqueta al golpear
 *   sparkle  chispas doradas en la estela (solo Oro)
 * `color` / `dark` = muestra en los menús.
 */
export interface StyleLook {
  color: number;
  dark: number;
  trail: number;
  sparkle: boolean;
  /** qué cambia en el partido (texto corto para la tienda) */
  perk: string;
}

export const STYLE_LOOK: Record<StyleId, StyleLook> = {
  classic: { color: 0x3a8bff, dark: 0x1a4fb0, trail: 0xffffff, sparkle: false, perk: 'Estela blanca' },
  red: { color: 0xff4f5e, dark: 0xb3202f, trail: 0xff5a6a, sparkle: false, perk: 'Estela roja' },
  green: { color: 0x62d935, dark: 0x2f8f14, trail: 0x7dff5a, sparkle: false, perk: 'Estela verde' },
  gold: { color: 0xffc42e, dark: 0xc98600, trail: 0xffd23f, sparkle: true, perk: 'Estela dorada con chispas' },
};

export function styleLook(id: StyleId | string | undefined): StyleLook {
  return STYLE_LOOK[(id as StyleId) ?? 'classic'] ?? STYLE_LOOK.classic;
}
