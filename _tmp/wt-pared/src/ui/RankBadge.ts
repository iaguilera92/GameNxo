import Phaser from 'phaser';
import { RANKS, type RankId, formatRankPosition, isRankUnlocked, rankDef } from '../domain/ranks';
import { FONT } from './theme';

/**
 * Insignia de rango competitivo reutilizable.
 * - Bloqueada (nivel < 30): gris/desaturada y tachada con una diagonal discreta
 *   (sin interacción, salvo `openWhenLocked`).
 * - Desbloqueada: a color; si recibe `onOpen`, se puede tocar (detalle del ranking).
 * Las imágenes grandes se reducen ("hornean") una vez al tamaño de uso, en color y en gris.
 */
export interface RankBadgeOpts {
  rank: RankId;
  level: number;
  /** alto visible en px */
  size: number;
  /** fuerza el estado; por defecto se deduce del nivel */
  locked?: boolean;
  /** al tocarla (por defecto solo desbloqueada) */
  onOpen?: () => void;
  /** permite tocarla también bloqueada (p. ej. para ver la lista informativa de rangos) */
  openWhenLocked?: boolean;
  /** posición global (solo Challenger, 1..999); se escribe en el hueco de la insignia */
  position?: number;
}

const srcKey = (id: RankId) => `rank-${id}`;
const bakedKey = (id: RankId, grey: boolean, px: number) => `rank-${id}-${grey ? 'g' : 'c'}-${px}`;

/**
 * Encola insignias (llamar en un preload). Sin `ids` carga todas (~1,2 MB c/u):
 * en el menú basta con el rango del jugador.
 */
export function preloadRankBadges(load: Phaser.Loader.LoaderPlugin, ids?: RankId[]) {
  for (const r of RANKS)
    if (r.image && (!ids || ids.includes(r.id)) && !load.textureManager.exists(srcKey(r.id))) load.image(srcKey(r.id), r.image);
}

export class RankBadge extends Phaser.GameObjects.Container {
  readonly locked: boolean;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: RankBadgeOpts) {
    super(scene, x, y);
    scene.add.existing(this);
    const locked = opts.locked ?? !isRankUnlocked(opts.level);
    this.locked = locked;
    const size = opts.size;

    const key = bake(scene, opts.rank, locked, Math.round(size * 1.5));
    if (key) {
      const img = scene.add.image(0, 0, key);
      img.setScale(size / img.height);
      if (locked) img.setAlpha(0.8);
      this.add(img);
      // posición Challenger dentro del recuadro de la imagen
      const def = rankDef(opts.rank);
      const slot = def.numberSlot;
      const pos = formatRankPosition(opts.position, def.topOnly); // Challenger: 1..500
      if (slot && pos) {
        const dw = img.displayWidth;
        const dh = img.displayHeight;
        const t = scene.add
          .text((slot.cx - 0.5) * dw, (slot.cy - 0.5) * dh, pos, {
            fontFamily: FONT,
            fontSize: `${Math.round(slot.h * dh * 0.8)}px`,
            color: '#ffe27a',
            stroke: '#2a0f4a',
            strokeThickness: Math.max(2, Math.round(slot.h * dh * 0.12)),
          })
          .setOrigin(0.5)
          .setResolution(3); // nítido aunque la insignia sea pequeña
        const maxW = slot.w * dw * 0.92;
        if (t.width > maxW) t.setScale(maxW / t.width);
        if (locked) t.setAlpha(0.6).setTint(0xb0b8cc);
        this.add(t);
      }
    } else {
      // rango sin arte todavía: silueta neutra de escudo (sin inventar diseño)
      const g = scene.add.graphics();
      const s = size / 2;
      g.fillStyle(0x1a2645, 1).fillPoints([{ x: -s * 0.8, y: -s * 0.8 }, { x: s * 0.8, y: -s * 0.8 }, { x: s * 0.8, y: 0 }, { x: 0, y: s }, { x: -s * 0.8, y: 0 }], true);
      this.add(g);
    }

    if (locked) {
      // tachado diagonal discreto (sombra oscura + línea clara)
      const s = size * 0.42;
      const line = scene.add.graphics();
      line.lineStyle(Math.max(4, size * 0.07), 0x05112c, 0.55).lineBetween(s, -s, -s, s);
      line.lineStyle(Math.max(2, size * 0.035), 0xd6deef, 0.85).lineBetween(s, -s, -s, s);
      this.add(line);
    }
    if (opts.onOpen && (!locked || opts.openWhenLocked)) {
      this.setSize(size, size).setInteractive({ useHandCursor: true });
      this.on('pointerdown', () => {
        scene.tweens.add({ targets: this, scale: { from: 0.88, to: 1 }, duration: 200, ease: 'Back.easeOut' });
        opts.onOpen?.();
      });
    }
  }
}

/** Reduce la imagen al alto `px` (por mitades, buena calidad) y opcionalmente la desatura. */
function bake(scene: Phaser.Scene, id: RankId, grey: boolean, px: number): string | null {
  const tm = scene.textures;
  const out = bakedKey(id, grey, px);
  if (tm.exists(out)) return out;
  if (!tm.exists(srcKey(id))) return null;
  const src = tm.get(srcKey(id)).getSourceImage() as HTMLImageElement;
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
  if (grey) {
    const data = ctx.getImageData(0, 0, tw, th);
    const d = data.data;
    for (let i = 0; i < d.length; i += 4) {
      // gris apagado con un toque frío para combinar con el azul de la UI
      const l = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) * 0.72 + 30;
      d[i] = l;
      d[i + 1] = l + 4;
      d[i + 2] = l + 14;
    }
    ctx.putImageData(data, 0, 0);
  }
  tm.addCanvas(out, canvas);
  return out;
}
