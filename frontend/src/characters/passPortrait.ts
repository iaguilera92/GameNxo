import type Phaser from 'phaser';
import { BP_SEASON } from '../domain/battlePassConfig';

/**
 * Retratos de los personajes que salen como premio del PASE DE BATALLA y en su tarjeta de la Tienda. Mai (jugable, retrato de assets/characters) y,
 * desde el 21-11-2026, JUN: AÚN NO ES JUGABLE (solo tiene este retrato, hecho de personajes/Jun/pj-jun.png sin el verde croma; sin hojas de movimientos),
 * así que no está en SkinId ni en characters/portrait.ts (esas listas son de los personajes que se pueden elegir).
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
  jun: { key: 'portrait-jun', file: 'assets/characters/jun_portrait.webp', w: 1122, h: 1402, box: { x0: 155, y0: 19, x1: 1076, y1: 1384 } },
};

/**
 * (21-11-2026) Personajes que aún NO son jugables y tampoco son premio del Pase: solo se ven (bloqueados) en CAMBIAR PERSONAJE. NET: retrato de
 * personajes/Net/pj-net.png sin el verde croma (croma de build-hd; la fuente PNG no llega al APK). No entran en `queuePassPortraits`: se cargan
 * al abrir ese diálogo.
 */
export const SOON_PORTRAITS: Record<string, PassPortrait> = {
  net: { key: 'portrait-net', file: 'assets/characters/net_portrait.webp', w: 1122, h: 1402, box: { x0: 153, y0: 16, x1: 1073, y1: 1385 } },
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
