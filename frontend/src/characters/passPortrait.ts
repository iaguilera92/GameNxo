import type Phaser from 'phaser';
import { BP_SEASON } from '../domain/battlePassConfig';

/**
 * Retratos de personajes usados en la Tienda y el Pase. Mai es jugable; Jun es premio del Pase y Net, Mat, Isa y Rin son personajes nuevos de la Tienda.
 * Jun, Net, Mat, Isa y Rin aún no son jugables: sus retratos se procesan desde personajes/<Nombre>/pj-*.png para quitar el verde de croma; no están en SkinId ni en
 * characters/portrait.ts (esas listas son de los personajes que se pueden elegir).
 *
 * `box` es la caja visible de la imagen (sin el margen transparente), en píxeles originales.
 */
export interface PassPortrait {
  key: string;
  file: string;
  w: number;
  h: number;
  box: { x0: number; y0: number; x1: number; y1: number };
}

export const PASS_PORTRAITS: Record<string, PassPortrait> = {
  mai: { key: 'portrait-mai', file: 'assets/characters/mai_portrait.webp', w: 1122, h: 1402, box: { x0: 110, y0: 7, x1: 1078, y1: 1374 } },
  jun: { key: 'portrait-jun', file: 'assets/characters/jun_portrait.webp', w: 1122, h: 1402, box: { x0: 155, y0: 16, x1: 1075, y1: 1384 } },
};

/**
 * Personajes que aún NO son jugables y tampoco son premio del Pase: solo se ven (bloqueados) en CAMBIAR PERSONAJE. Sus retratos de
 * personajes/<Nombre>/pj-*.png se empaquetan como WebP sin el verde croma (la fuente PNG no llega al APK). No entran en `queuePassPortraits`: se cargan
 * al abrir ese diálogo.
 */
export const SOON_PORTRAITS: Record<string, PassPortrait> = {
  flo: { key: 'portrait-flo', file: 'assets/characters/flo_portrait.webp', w: 1122, h: 1402, box: { x0: 185, y0: 6, x1: 1004, y1: 1388 } },
  zac: { key: 'portrait-zac', file: 'assets/characters/zac_portrait.webp', w: 1024, h: 1536, box: { x0: 108, y0: 35, x1: 976, y1: 1500 } },
  net: { key: 'portrait-net', file: 'assets/characters/net_portrait.webp', w: 1024, h: 1536, box: { x0: 79, y0: 89, x1: 1002, y1: 1515 } },
  mat: { key: 'portrait-mat', file: 'assets/characters/mat_portrait.webp', w: 1024, h: 1536, box: { x0: 129, y0: 65, x1: 972, y1: 1475 } },
  isa: { key: 'portrait-isa', file: 'assets/characters/isa_portrait.webp', w: 1122, h: 1402, box: { x0: 131, y0: 10, x1: 1040, y1: 1382 } },
  rin: { key: 'portrait-rin', file: 'assets/characters/rin_portrait.webp', w: 1122, h: 1402, box: { x0: 77, y0: 0, x1: 1043, y1: 1388 } },
};

/** retrato de un personaje del Pase o aún no jugable (undefined = no tiene) */
export function rosterPortrait(skin: string): PassPortrait | undefined {
  return PASS_PORTRAITS[skin] ?? SOON_PORTRAITS[skin];
}

/** el personaje del último nivel del Pase de esta temporada (el de BP_SEASON; sin personaje, Mai) */
export function passHeroSkin(): string {
  const last = BP_SEASON.tiers[BP_SEASON.tiers.length - 1].free;
  return last.kind === 'character' ? last.skin : 'mai';
}

/** retrato de un personaje del Pase (undefined = no tiene) */
export function passPortrait(skin: string): PassPortrait | undefined {
  return PASS_PORTRAITS[skin];
}

/** encola la carga de todos los retratos del Pase que aún no estén (las escenas del Pase y de la Tienda) */
export function queuePassPortraits(scene: Phaser.Scene) {
  for (const p of Object.values(PASS_PORTRAITS)) if (!scene.textures.exists(p.key)) scene.load.image(p.key, p.file);
}
