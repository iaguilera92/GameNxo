import Phaser from 'phaser';
import meta from './profile-frames.json';
import { FRAME_IDS, type FrameId } from '../domain/profileFrames';

/**
 * ARTE DE LOS MARCOS DEL PERFIL (21-11-2026, usuario): un WebP con transparencia por liga (public/assets/marcos/<liga>.webp),
 * cortado de la hoja public/personajes/Marcos/marcos-ranked.png con `node tools/build-profile-frames.mjs` (desde frontend/).
 * `profile-frames.json` (generado) trae el tamaño de cada uno y su CUERPO: el rectángulo que coincide con la card; las alas y la
 * corona (Diamante, Challenger) sobresalen. Los ids son los de las ligas y no cambian (docs/BASE-DE-DATOS.md).
 */
type FrameMeta = { w: number; h: number; body: { x: number; y: number; w: number; h: number } };
const META = meta as Record<string, FrameMeta>;

export const frameTexKey = (id: FrameId) => `marco-${id}`;

/** Encola las 6 imágenes de los marcos que falten (menú). */
export function queueProfileFrameArt(load: Phaser.Loader.LoaderPlugin) {
  for (const id of FRAME_IDS) if (!load.scene.textures.exists(frameTexKey(id))) load.image(frameTexKey(id), `assets/marcos/${id}.webp`);
}

/**
 * Imagen del marco para una card de w x h en (0,0): su cuerpo cubre exactamente la card. null si la imagen no cargó
 * (entonces se dibuja el marco de siempre, drawProfileFrame).
 */
export function addProfileFrameArt(scene: Phaser.Scene, w: number, h: number, id: FrameId): Phaser.GameObjects.Image | null {
  const m = META[id];
  if (!m || !scene.textures.exists(frameTexKey(id))) return null;
  const kx = w / m.body.w;
  const ky = h / m.body.h;
  return scene.add.image(-m.body.x * kx, -m.body.y * ky, frameTexKey(id)).setOrigin(0, 0).setDisplaySize(m.w * kx, m.h * ky);
}
