import Phaser from 'phaser';
import { CHARACTER_SKINS } from '../config';

/**
 * Sistema de "skins" con imágenes para los personajes.
 *
 * Archivos: public/assets/characters/<id>_<vista>_<pieza>.png
 *   id     player | rival
 *   vista  front | back
 *   pieza  body (cuerpo SIN el brazo de la raqueta) | arm (brazo + raqueta)
 *
 * El personaje vectorial actual sigue siendo el respaldo: cada vista (frente/espalda) usa
 * imágenes solo si tiene sus DOS piezas (cuerpo + brazo); si falta alguna, esa vista se dibuja
 * como siempre. Las animaciones no cambian: el cuerpo va dentro de `torso` y el brazo dentro
 * de `racketArm`, que siguen moviéndose con los mismos tweens. Solo se escala de forma uniforme.
 */

export type SkinId = 'player' | 'rival' | 'nxo' | 'mai';
/** Todas las skins conocidas (se intentan cargar; las que falten usan el vectorial). */
export const SKIN_IDS: SkinId[] = ['player', 'rival', 'nxo', 'mai'];
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

/**
 * Calibración por skin. El cuerpo (pies + altura) y el largo del brazo se miden solos desde
 * la imagen; aquí solo va lo que NO se puede deducir: dónde está el hombro y con qué ángulo
 * viene dibujado el brazo. Los valores por defecto (DEFAULT_RIG) sirven para la lámina 2×2
 * estándar, así que una skin nueva normalmente no necesita nada aquí.
 *
 * El hombro es el muñón de la manga del cuerpo (donde falta el brazo): en la vista de frente
 * queda a la IZQUIERDA de la pantalla y en la de espaldas a la DERECHA. El extremo redondeado
 * de la manga del brazo se apoya ahí y lo tapa en cualquier ángulo del golpe.
 */
const DEFAULT_RIG: Record<SkinView, { shoulder: { x: number; y: number }; armAngle: number }> = {
  front: { shoulder: { x: -21.2, y: -72.3 }, armAngle: -17 },
  back: { shoulder: { x: 20.1, y: -70.3 }, armAngle: -17 },
};
const META: Partial<Record<SkinId, Partial<Record<SkinView, ViewMeta>>>> = {
  // Personaje principal "nxo": el brazo-imagen tiene la manga abajo-izq y viene en reposo (ángulo 0).
  nxo: {
    front: { shoulder: { x: -23.3, y: -84.4 }, arm: { ox: 30, oy: 373 } },
    back: { shoulder: { x: 20.3, y: -78.5 }, arm: { ox: 44, oy: 388 } },
  },
  // en la espalda de "mai" el pelo tapa el hombro: el brazo se apoya sobre el borde del pelo
  mai: {
    front: { shoulder: { x: -22.6, y: -84 }, arm: { ox: 30, oy: 387 } },
    back: { shoulder: { x: 24.5, y: -83.3 }, arm: { ox: 40, oy: 391 } },
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

/**
 * Piezas de imagen que EXISTEN hoy en public/assets/characters/ (`<id>_<vista>_<pieza>.png`). Este sistema antiguo
 * (cuerpo + brazo) quedó reemplazado por las hojas de sprites (objects/NxoActor.ts) y sus imágenes ya no están: con la
 * lista vacía no se pide nada al arrancar (antes salían 8 "Failed to process file: image skin-raw-…" en la consola).
 * Si alguna vez se vuelve a usar una pieza, añadir aquí su nombre, p. ej. 'nxo_front_body'.
 */
const SKIN_FILES = new Set<string>([]);

/** Llamar desde un `preload()`: encola las piezas que existen (SKIN_FILES); el resto usa el personaje vectorial. */
export function queueSkinLoads(load: Phaser.Loader.LoaderPlugin) {
  if (skinMode() === 'off') return;
  for (const id of SKIN_IDS)
    for (const view of ['front', 'back'] as SkinView[])
      for (const part of ['body', 'arm'] as SkinPart[])
        if (SKIN_FILES.has(`${id}_${view}_${part}`) && !load.textureManager.exists(bakedKey(id, view, part))) load.image(rawKey(id, view, part), fileUrl(id, view, part));
}

/**
 * Llamar tras la carga: reduce cada imagen a la resolución que realmente se va a mostrar
 * (mejor calidad al escalar y mucha menos memoria de GPU) y libera la original.
 */
export function bakeSkins(scene: Phaser.Scene) {
  const tm = scene.textures;
  for (const id of SKIN_IDS)
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

/** Escala del cuerpo (unidades por píxel) de una vista, para que el brazo use la MISMA. */
function bodyScale(id: SkinId, view: SkinView, h: number) {
  return META[id]?.[view]?.body?.scale ?? CHAR_UNITS_H / Math.max(1, h - PAD * 2);
}

/**
 * Calibración de una pieza, completando con valores por defecto.
 * - cuerpo: ancla en los pies (centro-abajo), escala desde la altura.
 * - brazo: ancla en el HOMBRO (extremo redondeado de la manga, abajo-izquierda, donde se une
 *   al cuerpo), MISMA escala que el cuerpo, y ángulo 0 (el brazo ya viene en pose de reposo).
 *   `bodyH` es la altura del cuerpo de esa vista (para heredar su escala).
 */
function partMeta(id: SkinId, view: SkinView, part: 'body' | 'arm', w: number, h: number, bodyH = h): Required<PartMeta> {
  const m = META[id]?.[view]?.[part] ?? {};
  if (part === 'body')
    return { ox: m.ox ?? w / 2, oy: m.oy ?? h - PAD, scale: m.scale ?? CHAR_UNITS_H / Math.max(1, h - PAD * 2), angle: 0 };
  // centro del extremo de la manga, un poco hacia dentro: ≈8% desde la izquierda, ≈80% hacia abajo
  // (en la esquina, 3%/84%, el pivote quedaba fuera de la manga y el brazo giraba despegado)
  return {
    ox: m.ox ?? Math.round(w * 0.08),
    oy: m.oy ?? Math.round(h * 0.805),
    scale: m.scale ?? bodyScale(id, view, bodyH),
    angle: m.angle ?? 0,
  };
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
  // alto del cuerpo (px originales) para que el brazo herede su misma escala
  const bodyKey = bakedKey(id, view, 'body');
  const bf = bakedFactor.get(bodyKey) ?? 1;
  const bodyH = (scene.textures.get(bodyKey).getSourceImage() as HTMLCanvasElement).height / bf;
  const build = (part: 'body' | 'arm') => {
    const key = bakedKey(id, view, part);
    const f = bakedFactor.get(key) ?? 1;
    const src = scene.textures.get(key).getSourceImage() as HTMLCanvasElement;
    // la calibración está en píxeles originales: se pasa a la textura reducida
    const m = partMeta(id, view, part, src.width / f, src.height / f, bodyH);
    return { key, ox: m.ox * f, oy: m.oy * f, scale: m.scale / f, angle: m.angle };
  };
  return { body: build('body'), arm: build('arm'), shoulder: META[id]?.[view]?.shoulder ?? DEFAULT_RIG[view].shoulder };
}

let reported = false;
function report(scene: Phaser.Scene) {
  if (reported) return;
  reported = true;
  // sin piezas de skin (todo vectorial) no se informa nada: ensuciaba la consola en cada arranque
  if (skinMode() === 'off' || !SKIN_FILES.size) return;
  const missing = REQUIRED.filter(([id, view, part]) => !has(scene, id, view, part)).map((r) => r.join('_') + '.png');
  const views = SKIN_IDS.flatMap((id) =>
    (['front', 'back'] as SkinView[]).map((v) => `/${v}: ${has(scene, id, v, 'body') && has(scene, id, v, 'arm') ? 'IMÁGENES' : 'vectorial'}`),
  );
  console.info('[skins]', views.join(' | '));
  if (missing.length && SKIN_FILES.size) console.info('[skins] faltan:', missing);
}




