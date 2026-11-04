import Phaser from 'phaser';
import { CHARACTER_SKINS } from '../config';

/**
 * Sistema de "skins" con imágenes para los personajes.
 *
 * Archivos: public/assets/characters/<id>_<vista>_<pieza>.png
 *   id     player | rival
 *   vista  front | back
 *   pieza  body (cuerpo SIN el brazo de la raqueta) | arm (brazo + raqueta)
 *          (las referencias completas están en art/reference/ y no se empaquetan)
 *
 * El personaje vectorial actual sigue siendo el respaldo: cada vista (frente/espalda) usa
 * imágenes solo si tiene sus DOS piezas (cuerpo + brazo); si falta alguna, esa vista se dibuja
 * como siempre. Las animaciones no cambian: el cuerpo va dentro de `torso` y el brazo dentro
 * de `racketArm`, que siguen moviéndose con los mismos tweens. Solo se escala de forma uniforme.
 */

export type SkinId = 'player' | 'rival';
export type SkinView = 'front' | 'back';
export type SkinPart = 'body' | 'arm';

/** Calibración de una pieza, en píxeles de la imagen original (recortada). */
export interface PartMeta {
  /** punto de anclaje: pies (body) u hombro (arm) */
  ox?: number;
  oy?: number;
  /** unidades locales del personaje por píxel de imagen */
  scale?: number;
  /** ángulo (grados) con que viene dibujado el brazo respecto a la horizontal */
  angle?: number;
}
interface ViewMeta {
  body?: PartMeta;
  arm?: PartMeta;
  /** hombro en unidades locales desde los pies (donde pivota el brazo) */
  shoulder?: { x: number; y: number };
}

/** Alto del personaje en unidades locales (el vectorial mide lo mismo: misma escala en juego). */
export const CHAR_UNITS_H = 150;
/** Escala máxima a la que se muestra un personaje (menú principal). Define la resolución horneada. */
const MAX_DISPLAY_SCALE = 2.6;
/** Margen transparente que dejan las imágenes recortadas. */
const PAD = 8;

/** Calibración conocida. Lo que falte se calcula con valores por defecto razonables. */
const META: Partial<Record<SkinId, Partial<Record<SkinView, ViewMeta>>>> = {
  player: {
    back: {
      body: { ox: 262.5, oy: 998, scale: CHAR_UNITS_H / 991 },
      arm: { ox: 95, oy: 498, scale: 0.058, angle: -16.8 },
      shoulder: { x: 16.4, y: -68.6 },
    },
  },
};

/** Set completo esperado (para el informe en consola). */
export const REQUIRED: [SkinId, SkinView, SkinPart][] = [
  ['player', 'back', 'body'],
  ['player', 'back', 'arm'],
  ['player', 'front', 'body'],
  ['player', 'front', 'arm'],
  ['rival', 'front', 'body'],
  ['rival', 'front', 'arm'],
];


const rawKey = (id: SkinId, view: SkinView, part: SkinPart) => `skin-raw-${id}-${view}-${part}`;
const bakedKey = (id: SkinId, view: SkinView, part: SkinPart) => `skin-${id}-${view}-${part}`;

/** Ruta relativa (base './' de Vite: funciona en web y en la app Android). */
const fileUrl = (id: SkinId, view: SkinView, part: SkinPart) => `assets/characters/${id}_${view}_${part}.png`;

/** Factor de reducción aplicado al hornear cada textura (para corregir la calibración). */
const bakedFactor = new Map<string, number>();

/** Modo efectivo: config + parámetro de URL `?skins=off|auto` (para comparar). */
export function skinMode(): 'off' | 'auto' {
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('skins') : null;
  if (q === 'off' || q === 'auto') return q;
  return CHARACTER_SKINS;
}

/** Llamar desde un `preload()`: encola todas las piezas posibles; las que no existan se ignoran. */
export function queueSkinLoads(load: Phaser.Loader.LoaderPlugin) {
  if (skinMode() === 'off') return;
  for (const id of ['player', 'rival'] as SkinId[])
    for (const view of ['front', 'back'] as SkinView[])
      for (const part of ['body', 'arm'] as SkinPart[])
        if (!load.textureManager.exists(bakedKey(id, view, part))) load.image(rawKey(id, view, part), fileUrl(id, view, part));
  // una pieza que falta (404) no rompe nada: Phaser la descarta y esa vista usa el personaje vectorial
}

/**
 * Llamar tras la carga: reduce cada imagen a la resolución que realmente se va a mostrar
 * (mejor calidad al escalar y mucha menos memoria de GPU) y libera la original.
 */
export function bakeSkins(scene: Phaser.Scene) {
  const tm = scene.textures;
  for (const id of ['player', 'rival'] as SkinId[])
    for (const view of ['front', 'back'] as SkinView[])
      for (const part of ['body', 'arm'] as SkinPart[]) {
        const rk = rawKey(id, view, part);
        const bk = bakedKey(id, view, part);
        if (!tm.exists(rk) || tm.exists(bk)) continue;
        const src = tm.get(rk).getSourceImage() as HTMLImageElement;
        const m = partMeta(id, view, part, src.width, src.height);
        const factor = Math.min(1, (m.scale ?? 1) * MAX_DISPLAY_SCALE * 1.3);
        const canvas = downscale(src, Math.max(1, Math.round(src.width * factor)), Math.max(1, Math.round(src.height * factor)));
        tm.addCanvas(bk, canvas);
        bakedFactor.set(bk, canvas.width / src.width);
        tm.remove(rk);
      }
  report(scene);
}

/** Reducción por mitades (calidad similar a mipmaps). */
function downscale(src: HTMLImageElement | HTMLCanvasElement, tw: number, th: number): HTMLCanvasElement {
  let cur: HTMLImageElement | HTMLCanvasElement = src;
  let w = src.width;
  let h = src.height;
  while (w / 2 >= tw && h / 2 >= th) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w / 2));
    c.height = Math.max(1, Math.round(h / 2));
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(cur, 0, 0, c.width, c.height);
    cur = c;
    w = c.width;
    h = c.height;
  }
  const out = document.createElement('canvas');
  out.width = tw;
  out.height = th;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(cur, 0, 0, tw, th);
  return out;
}

/** Calibración de una pieza, completando con valores por defecto. */
function partMeta(id: SkinId, view: SkinView, part: 'body' | 'arm', w: number, h: number): Required<PartMeta> {
  const m = META[id]?.[view]?.[part] ?? {};
  if (part === 'body')
    return { ox: m.ox ?? w / 2, oy: m.oy ?? h - PAD, scale: m.scale ?? CHAR_UNITS_H / Math.max(1, h - PAD * 2), angle: 0 };
  // brazo: hombro en el borde izquierdo, centrado; largo total ≈ 70 unidades
  return { ox: m.ox ?? PAD, oy: m.oy ?? h / 2, scale: m.scale ?? 70 / Math.max(1, w - PAD * 2), angle: m.angle ?? 0 };
}

function has(scene: Phaser.Scene, id: SkinId, view: SkinView, part: SkinPart) {
  return scene.textures.exists(bakedKey(id, view, part));
}


export interface SkinParts {
  body: { key: string; ox: number; oy: number; scale: number };
  arm: { key: string; ox: number; oy: number; scale: number; angle: number };
  shoulder: { x: number; y: number };
}

/** Piezas listas para usar en un personaje, o null para usar el personaje vectorial. */
export function getSkin(scene: Phaser.Scene, id: SkinId | undefined, view: SkinView): SkinParts | null {
  if (!id || skinMode() === 'off') return null;
  if (!has(scene, id, view, 'body') || !has(scene, id, view, 'arm')) return null;
  const build = (part: 'body' | 'arm') => {
    const key = bakedKey(id, view, part);
    const f = bakedFactor.get(key) ?? 1;
    const src = scene.textures.get(key).getSourceImage() as HTMLCanvasElement;
    // la calibración está en píxeles originales: se pasa a la textura reducida
    const m = partMeta(id, view, part, src.width / f, src.height / f);
    return { key, ox: m.ox * f, oy: m.oy * f, scale: m.scale / f, angle: m.angle };
  };
  return { body: build('body'), arm: build('arm'), shoulder: META[id]?.[view]?.shoulder ?? { x: 22, y: -64 } };
}

let reported = false;
function report(scene: Phaser.Scene) {
  if (reported) return;
  reported = true;
  if (skinMode() === 'off') {
    console.info('[skins] desactivadas (personajes vectoriales)');
    return;
  }
  const missing = REQUIRED.filter(([id, view, part]) => !has(scene, id, view, part)).map((r) => r.join('_') + '.png');
  const views = (['player', 'rival'] as SkinId[]).flatMap((id) =>
    (['front', 'back'] as SkinView[]).map((v) => `/${v}: ${has(scene, id, v, 'body') && has(scene, id, v, 'arm') ? 'IMÁGENES' : 'vectorial'}`),
  );
  console.info('[skins]', views.join(' | '));
  if (missing.length) console.info('[skins] faltan:', missing);
}



