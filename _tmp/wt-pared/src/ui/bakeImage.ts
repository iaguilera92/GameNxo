import Phaser from 'phaser';

/**
 * Reduce una textura grande al alto `px` (por mitades: calidad tipo mipmap) y la registra como
 * `<key>@<px>`. Las imágenes de 1000+ px mostradas a ~90 px se ven dentadas sin esto.
 * Devuelve la clave reducida, o null si la original no está cargada.
 */
export function bakeImage(scene: Phaser.Scene, key: string, px: number): string | null {
  const tm = scene.textures;
  const out = `${key}@${px}`;
  if (tm.exists(out)) return out;
  if (!tm.exists(key)) return null;
  const src = tm.get(key).getSourceImage() as HTMLImageElement;
  const th = Math.min(px, src.height);
  const tw = Math.max(1, Math.round((src.width * th) / src.height));
  let cur: HTMLImageElement | HTMLCanvasElement = src;
  let w = src.width;
  let h = src.height;
  while (w / 2 >= tw && h / 2 >= th) {
    const c = document.createElement('canvas');
    c.width = Math.round(w / 2);
    c.height = Math.round(h / 2);
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(cur, 0, 0, c.width, c.height);
    cur = c;
    w = c.width;
    h = c.height;
  }
  const canvas = document.createElement('canvas');
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(cur, 0, 0, tw, th);
  tm.addCanvas(out, canvas);
  return out;
}
