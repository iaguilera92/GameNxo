import type { CineProfile } from './SmashCinematic';
import { SMASH_CINE } from './SmashCinematic';
import type { SmashPower } from '../domain/smashPowers';
import { itemRarity } from '../domain/shopCatalog';
import { INFERNO_LOOK } from './InfernoFx';

/**
 * Aspecto del SMASH (el ESPECIAL) según su poder (domain/smashPowers.ts). El fuego conserva los valores de siempre:
 * las constantes que antes estaban fijas en Ball / SmokeTrail / HyperAura / ImpactFx / MatchScene viven aquí por poder.
 *
 *   ball    pelota prendida: color del núcleo, de la estela y de las llamas; `rise` > 0 sube (fuego), < 0 cae (escarcha);
 *           `shards` = cristales en vez de círculos
 *   smoke   humo / bruma que deja en el aire: colores y opacidad del normal y del potenciado ("strong") y de sus chispas
 *   aura    aura que rodea al jugador al armarlo: cuerpo, destellos y núcleo
 *   blast   explosión al alcanzar al rival
 *   ring    anillo del botón SMASH armado
 */
export interface SmashLook {
  ball: { core: number; trail: number; flames: number[]; rise: number; shards: boolean };
  smoke: { normal: { colors: number[]; alpha: number }; strong: { colors: number[]; alpha: number }; sparks: number[]; additive: boolean };
  aura: { col: number; hot: number; core: number };
  blast: { flash: number; core: number; ring: number; lines: [number, number]; sparks: number[]; shards?: number[] };
  ring: number;
  /** aspecto de la cinemática (los poderes que no existen en la ULTI; si no, se usa INFERNO_LOOK[el].cine) */
  cine?: Pick<CineProfile, 'colors' | 'aura' | 'rayStyle' | 'flashTint'>;
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
    // (12-11-2026) impacto de FUEGO: naranja y amarillo (antes blanco y dorado) + las llamas de infernoBlast en ImpactFx
    blast: { flash: 0xfff6c8, core: 0xffb44a, ring: 0xff7a1a, lines: [0xffd23f, 0xff7a1a], sparks: [0xfff1b8, 0xffb020, 0xff5a12] },
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
  wind: {
    // torbellino: ráfagas verdes claras que flotan un poco (no suben como el fuego ni caen como la escarcha)
    ball: { core: 0xd8ffe6, trail: 0x5fd68a, flames: [0xffffff, 0xc8ffd8, 0x7ff0a8, 0x2fbf6a], rise: 0.35, shards: false },
    smoke: {
      // (14-11-2026) poco humo: el viento se reconoce por su torbellino y ráfagas (fx/smashElementFx.ts)
      normal: { colors: [0xe0ffe9, 0xb4f5c8, 0x86e3a6], alpha: 0.18 },
      strong: { colors: [0xf0fff4, 0xc8ffd8, 0x8ff0b0, 0x3fd68a], alpha: 0.24 },
      sparks: [0xffffff, 0xb8ff9a, 0x5fd16f],
      additive: false,
    },
    aura: { col: 0x1f9f5a, hot: 0x8ff0b0, core: 0xf0fff0 },
    blast: { flash: 0xf0fff0, core: 0xd0ffe0, ring: 0x8ff0b0, lines: [0xffffff, 0x5fd68a], sparks: [0xffffff, 0xb8ff9a, 0x3fd68a] },
    ring: 0x5fd68a,
  },
  lightning: {
    // electricidad: chispas en estrella (shards) amarillas y azules que saltan sin subir; bruma azul pálida
    ball: { core: 0xfffbe0, trail: 0xffe14a, flames: [0xffffff, 0xfff36b, 0x7fc8ff, 0x2f6bff], rise: 0, shards: true },
    smoke: {
      // (14-11-2026) casi sin bruma: el rayo se reconoce por sus descargas (fx/smashElementFx.ts)
      normal: { colors: [0xdfe9ff, 0xaec8ff, 0x7fa6ff], alpha: 0.15 },
      strong: { colors: [0xf4f8ff, 0xc8dcff, 0x8fb4ff, 0x3a7bff], alpha: 0.2 },
      sparks: [0xffffff, 0xfff36b, 0x5aa8ff],
      additive: false,
    },
    aura: { col: 0x2f6bff, hot: 0xfff36b, core: 0xfffbe0 },
    blast: {
      flash: 0xfffbe0,
      core: 0xfff8c2,
      ring: 0xfff36b,
      lines: [0xffffff, 0x7fc8ff],
      sparks: [0xffffff, 0xfff36b, 0x5aa8ff],
      shards: [0xffffff, 0xfff36b, 0x9fd0ff, 0x3a7bff],
    },
    ring: 0xffe14a,
  },
  // (14-11-2026) SOMBRA: esfera oscura con llamas moradas que suben y humo negro denso
  shadow: {
    ball: { core: 0x2a0a4a, trail: 0x7a2fd6, flames: [0x1a0630, 0x4a1a8a, 0x9b4dff, 0xd0a8ff], rise: 0.7, shards: false },
    smoke: {
      normal: { colors: [0x120818, 0x1e0f2a, 0x2c1640], alpha: 0.82 },
      strong: { colors: [0x08040c, 0x140a1e, 0x22123a, 0x3a1a5e], alpha: 0.88 },
      sparks: [0xd0a8ff, 0x9b4dff, 0xffffff],
      additive: false,
    },
    aura: { col: 0x4a1a8a, hot: 0x9b4dff, core: 0xe8d8ff },
    blast: { flash: 0xe8d8ff, core: 0x9b4dff, ring: 0x7a2fd6, lines: [0xd0a8ff, 0x4a1a8a], sparks: [0xffffff, 0xd0a8ff, 0x9b4dff] },
    ring: 0x9b4dff,
    cine: {
      colors: { core: 0xe8d8ff, gold: 0x9b4dff, hot: 0x2a0a4a, cyan: 0x7a2fd6 },
      aura: [
        [1.3, 0x1a0630, 0.3],
        [1.08, 0x4a1a8a, 0.28],
        [0.86, 0x9b4dff, 0.22],
      ],
      flashTint: 0xd0a8ff,
    },
  },
  // (12-11-2026) LUZ (antes ESTRELLA): esfera de luz blanca con halo dorado; deja motas de luz y casi no echa humo
  light: {
    ball: { core: 0xffffff, trail: 0xfff0b0, flames: [0xffffff, 0xfffbe0, 0xfff1a0, 0xcfe9ff], rise: 0.1, shards: false },
    smoke: {
      normal: { colors: [0xfff6d8, 0xffe6a0, 0xffd27a], alpha: 0.15 },
      strong: { colors: [0xfffbe8, 0xfff0b8, 0xffdc8a, 0xffc0e0], alpha: 0.2 },
      sparks: [0xffffff, 0xfff1a0, 0xffd23f],
      additive: false,
    },
    aura: { col: 0xffb020, hot: 0xfff1a0, core: 0xffffff },
    blast: { flash: 0xffffff, core: 0xfff6c8, ring: 0xffd23f, lines: [0xffffff, 0xffd23f], sparks: [0xffffff, 0xfff1a0, 0xffd23f], shards: [0xffffff, 0xfff1a0, 0xffd23f, 0xff9ad8] },
    ring: 0xffc83a,
    cine: {
      colors: { core: 0xffffff, gold: 0xffd23f, hot: 0xffb020, cyan: 0xfff1a0 },
      aura: [
        [1.3, 0xffb020, 0.22],
        [1.08, 0xffd23f, 0.24],
        [0.86, 0xfff6c8, 0.24],
      ],
      flashTint: 0xfffbe0,
    },
  },
  // (17-11-2026) COMETA (ÉPICA): meteorito con cola de fuego azul y estrellas (la forma la dibuja fx/smashElementFx.ts drawMeteor)
  comet: {
    ball: { core: 0xeaf4ff, trail: 0x4f8dff, flames: [0xffffff, 0x9cc4ff, 0x4f8dff, 0x1f3fd6], rise: 0.25, shards: false },
    smoke: {
      // estela de polvo estelar azul oscuro, más densa que la del rayo (se ve la cola)
      normal: { colors: [0x1a2a66, 0x2f4fb0, 0x5f86e8], alpha: 0.45 },
      strong: { colors: [0x101a4a, 0x22388f, 0x3f66d6, 0x8fb4ff], alpha: 0.55 },
      sparks: [0xffffff, 0xcfe2ff, 0x6fa4ff],
      additive: false,
    },
    aura: { col: 0x1f3fd6, hot: 0x6fa4ff, core: 0xeaf4ff },
    blast: { flash: 0xeaf4ff, core: 0x9cc4ff, ring: 0x4f8dff, lines: [0xffffff, 0x4f8dff], sparks: [0xffffff, 0xcfe2ff, 0x4f8dff] },
    ring: 0x4f8dff,
    cine: {
      colors: { core: 0xffffff, gold: 0x6fa4ff, hot: 0x1f3fd6, cyan: 0xcfe2ff },
      aura: [
        [1.3, 0x101a4a, 0.3],
        [1.08, 0x2f4fb0, 0.28],
        [0.86, 0x9cc4ff, 0.24],
      ],
      flashTint: 0xcfe2ff,
    },
  },
};

const CINES: Partial<Record<SmashPower, CineProfile>> = {};
/** Perfil de la cinemática del SMASH para un poder: el del fuego de siempre, o los tiempos de siempre con el aspecto del poder. */
export function smashCine(el: SmashPower): CineProfile {
  let p = CINES[el];
  if (!p) {
    // los poderes que no existen en la ULTI (sombra, luz, cometa) traen su propio cine en SMASH_LOOK
    const own = el === 'fire' ? undefined : (SMASH_LOOK[el].cine ?? INFERNO_LOOK[el as Exclude<SmashPower, 'shadow' | 'light' | 'comet'>].cine);
    // (17-11-2026, usuario) las PARTÍCULAS que caen hacia el punto de concentración solo en lo ÉPICO y LEGENDARIO; el resto (fuego gratis y los de
    // rareza especial) conserva solo las tiras de energía (rayos)
    const r = itemRarity(`smash:${el}`);
    const particles = r === 'epica' || r === 'legendaria' ? SMASH_CINE.particles : 0;
    p = { ...SMASH_CINE, ...own, particles };
    CINES[el] = p;
  }
  return p;
}
