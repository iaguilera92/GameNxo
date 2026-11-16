import type { StyleId } from '../domain/player';
import type { TrailFx } from '../fx/ballTrailFx';

/**
 * Cómo se VE cada efecto de pelota (Tienda / Personalizar) en el partido:
 *   trail    color de la estela de TUS golpes normales (los globos, dejadas y el SMASH siguen con su color)
 *   ring     destello de color en tu raqueta al golpear
 *   sparkle  chispas doradas en la estela (solo Oro)
 *   fx       forma del efecto (fx/ballTrailFx.ts): cinta normal, arcoíris, brasas, copos, pétalos, corazones, destellos, neón, humo
 * `color` / `dark` = muestra en los menús.
 * `classic` es POR DEFECTO: no deja estela (Ball.render), el jugador no ve ningún efecto.
 */
export interface StyleLook {
  color: number;
  dark: number;
  trail: number;
  sparkle: boolean;
  fx: TrailFx;
  /** qué cambia en el partido (texto corto para la tienda) */
  perk: string;
}

export const STYLE_LOOK: Record<StyleId, StyleLook> = {
  classic: { color: 0x3a8bff, dark: 0x1a4fb0, trail: 0xffffff, sparkle: false, fx: 'plain', perk: 'Sin estela' },
  red: { color: 0xff4f5e, dark: 0xb3202f, trail: 0xff5a6a, sparkle: false, fx: 'plain', perk: 'Estela roja' },
  pink: { color: 0xff6fae, dark: 0xc23a7d, trail: 0xff8fc4, sparkle: false, fx: 'plain', perk: 'Estela rosada' },
  green: { color: 0x62d935, dark: 0x2f8f14, trail: 0x7dff5a, sparkle: false, fx: 'plain', perk: 'Estela verde' },
  gold: { color: 0xffc42e, dark: 0xc98600, trail: 0xffd23f, sparkle: true, fx: 'plain', perk: 'Estela dorada con chispas' },
  rainbow: { color: 0xff5ab0, dark: 0x7a2fd6, trail: 0xff5ab0, sparkle: false, fx: 'rainbow', perk: 'Cambia de color en el recorrido' },
  ember: { color: 0xff7a1e, dark: 0xb23a08, trail: 0xff8a2a, sparkle: false, fx: 'ember', perk: 'Brasas que suben' },
  frost: { color: 0x8fdcff, dark: 0x2f78c8, trail: 0xcfefff, sparkle: false, fx: 'frost', perk: 'Copos que caen' },
  tulip: { color: 0xff8fc4, dark: 0xc23a7d, trail: 0xff9fcf, sparkle: false, fx: 'petals', perk: 'Pétalos que flotan' },
  hearts: { color: 0xff4f7a, dark: 0xb3202f, trail: 0xff6f9a, sparkle: false, fx: 'hearts', perk: 'Corazones que flotan' },
  stars: { color: 0xffd23f, dark: 0xc98600, trail: 0xffe27a, sparkle: false, fx: 'stars', perk: 'Destellos que parpadean' },
  neon: { color: 0x2ff3ff, dark: 0x0a7f9a, trail: 0x2ff3ff, sparkle: false, fx: 'neon', perk: 'Doble línea de neón' },
  smoke: { color: 0x9aa0aa, dark: 0x4a4f58, trail: 0x9aa0aa, sparkle: false, fx: 'smoke', perk: 'Humo que se disipa' },
};

export function styleLook(id: StyleId | string | undefined): StyleLook {
  return STYLE_LOOK[(id as StyleId) ?? 'classic'] ?? STYLE_LOOK.classic;
}
