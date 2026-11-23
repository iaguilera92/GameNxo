import Phaser from 'phaser';
import meta1v1 from './profile-frames.json';
import meta2v2 from './profile-frames-2v2.json';
import { FRAME_IDS, type FrameId } from '../domain/profileFrames';

/**
 * ARTE DE LOS MARCOS DEL PERFIL (21-11-2026, usuario): un WebP con transparencia por liga, en DOS juegos: los de la liga normal
 * (public/assets/marcos/<liga>.webp, de la hoja marcos-ranked.png) y los de la LIGA 2v2 (public/assets/marcos2v2/<liga>.webp, de
 * marcos-ranked-2v2.png). Salen de art/marcos-perfil/ con `node tools/build-profile-frames.mjs` (y `SET=2v2` para los 2v2), que
 * también escribe los JSON con el tamaño de cada uno y su CUERPO: el rectángulo que coincide con la card; las alas y la corona
 * (Diamante, Challenger) sobresalen. Los ids son los de las ligas y no cambian (docs/BASE-DE-DATOS.md).
 */
export type FrameSet = '1v1' | '2v2';
type FrameMeta = { w: number; h: number; body: { x: number; y: number; w: number; h: number } };
const META: Record<FrameSet, Record<string, FrameMeta>> = { '1v1': meta1v1 as Record<string, FrameMeta>, '2v2': meta2v2 as Record<string, FrameMeta> };
const DIR: Record<FrameSet, string> = { '1v1': 'marcos', '2v2': 'marcos2v2' };

export const frameTexKey = (id: FrameId, set: FrameSet = '1v1') => (set === '2v2' ? `marco2v2-${id}` : `marco-${id}`);

/** Encola las imágenes de los marcos que falten (las 12: menú y diálogo del perfil). */
export function queueProfileFrameArt(load: Phaser.Loader.LoaderPlugin) {
  for (const set of ['1v1', '2v2'] as const) {
    for (const id of FRAME_IDS) if (!load.scene.textures.exists(frameTexKey(id, set))) load.image(frameTexKey(id, set), `assets/${DIR[set]}/${id}.webp`);
  }
}

/**
 * Imagen del marco para una card de w x h en (0,0): su cuerpo cubre exactamente la card. null si la imagen no cargó
 * (entonces se dibuja el marco de siempre, drawProfileFrame).
 */
export function addProfileFrameArt(scene: Phaser.Scene, w: number, h: number, id: FrameId, set: FrameSet = '1v1'): Phaser.GameObjects.Image | null {
  const m = META[set][id];
  if (!m || !scene.textures.exists(frameTexKey(id, set))) return null;
  const kx = w / m.body.w;
  const ky = h / m.body.h;
  return scene.add.image(-m.body.x * kx, -m.body.y * ky, frameTexKey(id, set)).setOrigin(0, 0).setDisplaySize(m.w * kx, m.h * ky);
}
