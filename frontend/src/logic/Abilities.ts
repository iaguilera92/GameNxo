import { DASH_COOLDOWN, SMASH_COOLDOWN } from '../config';
import { C } from '../ui/theme';

export type AbilityId = 'dash' | 'smash' | 'wall' | 'curve' | 'freeze';
export type AbilityIcon = 'dash' | 'smash' | 'lock' | 'serveSpin' | 'servePower' | 'serveRacket';

export interface AbilityDef {
  id: AbilityId;
  name: string;
  desc: string;
  cooldown: number;
  icon: AbilityIcon;
  color: number;
  colorDark: number;
  /** Disponible ya (true) o futura compra en la tienda (false). */
  owned: boolean;
  price?: number;
}

/**
 * Catálogo de habilidades. Solo `dash` y `smash` están implementadas.
 * Las demás aparecen bloqueadas en Personalizar ("Tienda: próximamente").
 */
export const ABILITIES: Record<AbilityId, AbilityDef> = {
  dash: {
    id: 'dash',
    name: 'Dash',
    desc: 'Sprint explosivo hasta donde llegará la pelota.',
    cooldown: DASH_COOLDOWN,
    icon: 'dash',
    color: C.purple,
    colorDark: C.purpleDark,
    owned: true,
  },
  smash: {
    id: 'smash',
    name: 'Smash',
    desc: 'Bola de fuego. Si el rival la toca, sale despedido y queda aturdido 1 s.',
    cooldown: SMASH_COOLDOWN,
    icon: 'smash',
    color: C.red,
    colorDark: C.redDark,
    owned: true,
  },
  wall: { id: 'wall', name: 'Muro', desc: 'Próximamente', cooldown: 20, icon: 'lock', color: C.grey, colorDark: C.greyDark, owned: false, price: 500 },
  curve: { id: 'curve', name: 'Efecto', desc: 'Próximamente', cooldown: 15, icon: 'lock', color: C.grey, colorDark: C.greyDark, owned: false, price: 750 },
  freeze: { id: 'freeze', name: 'Hielo', desc: 'Próximamente', cooldown: 25, icon: 'lock', color: C.grey, colorDark: C.greyDark, owned: false, price: 1000 },
};

export const SHOP_PREVIEW: AbilityId[] = ['wall', 'curve', 'freeze'];

