import type { CineProfile } from './SmashCinematic';
import { SMASH_CINE } from './SmashCinematic';
import type { SmashPower } from '../domain/smashPowers';
import { INFERNO_LOOK } from './InfernoFx';

/**
 * Aspecto del SMASH (el ESPECIAL) según su poder (domain/smashPowers.ts). El fuego conserva los valores de siempre:
 * las constantes que antes estaban fijas en Ball / SmokeTrail / HyperAura / ImpactFx / MatchScene viven aquí por poder.
 *
 *   ball    pelota prendida: color del núcleo, de la estela y de las llamas; `rise` > 0 sube (fuego), < 0 cae (escarcha);
 *           `shards` = cristales en vez de círculos
 *   smoke   humo / bruma que deja en el aire: colores y opacidad del normal y del potenciado ("strong") y de sus chispas
 *   aura    aura que rodea al jugador al armarlo: cuerpo, destellos y núcleo
 *   burst   destello al armar (sobre la pelota)
 *   blast   explosión al alcanzar al rival
 *   ring    anillo del botón SMASH armado
 */
export interface SmashLook {
  ball: { core: number; trail: number; flames: number[]; rise: number; shards: boolean };
  smoke: { normal: { colors: number[]; alpha: number }; strong: { colors: number[]; alpha: number }; sparks: number[]; additive: boolean };
  aura: { col: number; hot: number; core: number };
  burst: number;
  blast: { flash: number; core: number; ring: number; lines: [number, number]; sparks: number[]; shards?: number[] };
  ring: number;
}

export const SMASH_LOOK: Record<SmashPower, SmashLook> = {
  fire: {
    ball: { core: 0xff8a1e, trail: 0xff7a1e, flames: [0xfff36b, 0xffb020, 0xff6a1e, 0xff3b1e], rise: 1, shards: false },
    smoke: {
      normal: { colors: [0x3c3742, 0x55505c, 0x6d6874], alpha: 0.75 },
      strong: { colors: [0x1d1922, 0x2b2730, 0x3c3742, 0x4a4450], alpha: 0.82 },
      sparks: [0xffd23f, 0xffb020, 0xfff1b8],
      additive: false,
    },
    aura: { col: 0xb44bff, hot: 0xff6ae6, core: 0xffffff },
    burst: 0xff8a1e,
    blast: { flash: 0xffffff, core: 0xfff4c2, ring: 0xffd23f, lines: [0xffffff, 0xffd23f], sparks: [0xffffff, 0xfff1b8, 0xffd23f] },
    ring: 0xff9a2e,
  },
  ice: {
    ball: { core: 0xcff1ff, trail: 0x6fc4ff, flames: [0xffffff, 0xbff0ff, 0x6fc4ff, 0x2f8cff], rise: -0.35, shards: true },
    // bruma de escarcha: clara y azulada (la del fuego es humo oscuro); chispas de hielo en el potenciado
    smoke: {
      normal: { colors: [0xd8f4ff, 0xa6dcff, 0x7cc4ff], alpha: 0.6 },
      strong: { colors: [0xeafcff, 0xbff0ff, 0x8fdcff, 0x4aa8ff], alpha: 0.7 },
      sparks: [0xffffff, 0xbff0ff, 0x8fdcff],
      additive: false,
    },
    aura: { col: 0x2f8cff, hot: 0x8fdcff, core: 0xeafcff },
    burst: 0x6fc4ff,
    blast: {
      flash: 0xeafcff,
      core: 0xbff0ff,
      ring: 0x8fdcff,
      lines: [0xffffff, 0x8fdcff],
      sparks: [0xffffff, 0xbff0ff, 0x4aa8ff],
      shards: [0xffffff, 0xd8f6ff, 0x8fdcff, 0x4aa8ff],
    },
    ring: 0x6fc4ff,
  },
};

const CINES: Partial<Record<SmashPower, CineProfile>> = {};
/** Perfil de la cinemática del SMASH para un poder: el del fuego de siempre, o los tiempos de siempre con el aspecto del poder. */
export function smashCine(el: SmashPower): CineProfile {
  if (el === 'fire') return SMASH_CINE;
  let p = CINES[el];
  if (!p) {
    p = { ...SMASH_CINE, ...INFERNO_LOOK[el].cine };
    CINES[el] = p;
  }
  return p;
}
