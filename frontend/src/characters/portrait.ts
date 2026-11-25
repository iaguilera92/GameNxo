import Phaser from 'phaser';
import type { SkinId } from './skins';
import { ISA_PORTRAIT, JUN_PORTRAIT, MAT_PORTRAIT } from './passPortrait';

/**
 * Retratos estáticos de los personajes (menú, PERSONAJE y VS). Si una skin no tiene retrato,
 * `addPortrait` devuelve undefined y la escena usa el `Character` animado de siempre.
 *
 * `box` es la caja visible de la imagen (sin el margen transparente), en píxeles originales.
 */
interface PortraitDef {
  key: string;
  file: string;
  w: number;
  h: number;
  box: { x0: number; y0: number; x1: number; y1: number };
}

const PORTRAITS: Partial<Record<SkinId, PortraitDef>> = {
  mat: MAT_PORTRAIT,
  isa: ISA_PORTRAIT,
  jun: JUN_PORTRAIT,
  nxo: {
    key: 'portrait-nxo',
    file: 'personajes/Nxo/pj-nxo.webp',
    w: 1024, // (20-11-2026) retrato nuevo: nuca más corta y cuerdas rectas (verde croma quitado, también dentro de la raqueta)
    h: 1535,
    box: { x0: 136, y0: 11, x1: 992, y1: 1396 },
  },
  mai: {
    key: 'portrait-mai',
    file: 'assets/characters/mai_portrait.webp',
    w: 1122, // (21-11-2026) retrato nuevo (pj-mai.png sin el verde croma, con la hoja verde de la flor conservada)
    h: 1402,
    box: { x0: 110, y0: 7, x1: 1078, y1: 1374 },
  },
};

/** Encola la carga de los retratos (se llama desde la escena de arranque). */
export function queuePortraitLoads(load: Phaser.Loader.LoaderPlugin) {
  for (const p of Object.values(PORTRAITS)) if (p) load.image(p.key, p.file);
}

/**
 * Pone el retrato con los pies (centro de la base visible) en (x, feetY) y `height` px de alto
 * visible. Devuelve undefined si la skin no tiene retrato o la imagen no cargó.
 */
export function addPortrait(scene: Phaser.Scene, skin: SkinId, x: number, feetY: number, height: number) {
  const p = PORTRAITS[skin];
  if (!p || !scene.textures.exists(p.key)) return undefined;
  const { x0, y0, x1, y1 } = p.box;
  const img = scene.add.image(x, feetY, p.key);
  img.setOrigin((x0 + x1) / 2 / p.w, y1 / p.h);
  img.setScale(height / (y1 - y0));
  return img;
}
