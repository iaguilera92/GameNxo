import Phaser from 'phaser';
import type { ChargeFxId } from '../domain/chargeFx';

/**
 * Efectos de CARGA con sprites (fuego, energía, tulipán): el aro del suelo que se ve bajo el jugador mientras mantiene
 * la carga de un golpe. Las hojas salen de tools/build-charge-fx.mjs (10 frames en 5 columnas x 2 filas: nace → crece →
 * máximo → se disipa); el aro de cada frame queda en el mismo sitio (ancla = pies del jugador).
 *
 *   carga 0..1   avanza por los frames 0..5 (el efecto crece con la potencia)
 *   carga 100 %  late entre los frames 5, 6, 5, 4 (el máximo)
 *   al soltar    se disipa con los frames 7..9 (o se apaga rápido si apenas había carga)
 * El clásico (aro y brillo por código) sigue en MatchScene / fx/shotFx.ts.
 */
export type SpriteChargeFx = Exclude<ChargeFxId, 'classic'>;

interface Art {
  key: string;
  file: string;
  /** celda de la hoja (px) */
  cw: number;
  ch: number;
  /** altura del ancla (centro del aro) dentro de la celda, 0..1 */
  anchorFy: number;
  /** ancho del aro respecto al ancho de la celda */
  ringFill: number;
  /** las llamas y la energía suman luz; los pétalos se pintan normales */
  additive: boolean;
}

/** valores que imprime tools/build-charge-fx.mjs */
export const CHARGE_ART: Record<SpriteChargeFx, Art> = {
  // fuego (11-11-2026): hoja nueva en .webp, como el tulipán
  fire: { key: 'charge-fire', file: 'assets/charge-fire.webp', cw: 256, ch: 236, anchorFy: 0.856, ringFill: 0.86, additive: true },
  energy: { key: 'charge-energy', file: 'assets/charge-energy.webp', cw: 256, ch: 230, anchorFy: 0.83, ringFill: 0.88, additive: true },
  // tulipán (11-11-2026): hoja nueva en .webp (la herramienta saca el .png y tools/convert-image.mjs lo pasa a webp)
  tulip: { key: 'charge-tulip', file: 'assets/charge-tulip.webp', cw: 256, ch: 256, anchorFy: 0.84, ringFill: 0.83, additive: false },
};

/** Ancho del aro en pantalla (px) a escala 1 de perspectiva: el del aro clásico (120 px) a carga máxima. */
const RING_W = 140;
const PEAK = [5, 6, 5, 4];
const OUT = [7, 8, 9];

export const isSpriteCharge = (id: ChargeFxId): id is SpriteChargeFx => id !== 'classic';

/** Carga las hojas de los efectos pedidos (solo los que se van a ver en el partido). */
export function queueChargeFxArt(load: Phaser.Loader.LoaderPlugin, ids: ChargeFxId[]) {
  for (const id of new Set(ids)) {
    if (!isSpriteCharge(id)) continue;
    const a = CHARGE_ART[id];
    if (!load.textureManager.exists(a.key)) load.spritesheet(a.key, a.file, { frameWidth: a.cw, frameHeight: a.ch });
  }
}

/** ¿Está cargada la hoja de este efecto? (si no, se usa el clásico) */
export const chargeFxReady = (scene: Phaser.Scene, id: ChargeFxId) => isSpriteCharge(id) && scene.textures.exists(CHARGE_ART[id].key);

/**
 * Vista previa de un efecto de carga (Personalización y Tienda) con el centro del aro en (x, y); `size` = ancho de la
 * celda. El clásico es el aro dibujado; los demás repiten sus frames de crecimiento y máximo (la animación se detiene
 * sola cuando se destruye el objeto).
 */
export function chargePreview(scene: Phaser.Scene, id: ChargeFxId, x: number, y: number, size: number): Phaser.GameObjects.GameObject {
  if (chargeFxReady(scene, id) && isSpriteCharge(id)) {
    const a = CHARGE_ART[id];
    const img = scene.add.image(x, y, a.key, 3).setOrigin(0.5, a.anchorFy).setScale(size / a.cw);
    if (a.additive) img.setBlendMode(Phaser.BlendModes.ADD);
    const seq = [2, 3, 4, 5, 6, 5, 4, 3];
    let i = 0;
    const ev = scene.time.addEvent({ delay: 110, loop: true, callback: () => img.active && img.setFrame(seq[i++ % seq.length]) });
    img.once(Phaser.GameObjects.Events.DESTROY, () => ev.remove(false));
    return img;
  }
  // clásico: el aro azul del juego
  const g = scene.add.graphics({ x, y });
  const w = size * 0.7;
  g.fillStyle(0x6ec1ff, 0.22).fillEllipse(0, 0, w, w * 0.34);
  g.lineStyle(5, 0xd6f0ff, 0.95).strokeEllipse(0, 0, w, w * 0.34);
  g.lineStyle(2, 0x6ec1ff, 0.6).strokeEllipse(0, 0, w * 1.12, w * 0.4);
  const tw = scene.tweens.add({ targets: g, alpha: { from: 0.65, to: 1 }, duration: 520, yoyo: true, repeat: -1 });
  g.once(Phaser.GameObjects.Events.DESTROY, () => tw.remove());
  return g;
}

export class ChargeSpriteFx {
  private img: Phaser.GameObjects.Image;
  private id: SpriteChargeFx | null = null;
  /** carga actual (0..1); null = no se está cargando */
  private value: number | null = null;
  private t = 0;
  /** disipándose: tiempo desde que se soltó (null = no) */
  private outT: number | null = null;

  constructor(scene: Phaser.Scene) {
    this.img = scene.add.image(0, 0, '__DEFAULT').setVisible(false);
  }

  /** Cambia el efecto (se reinicia). */
  use(id: SpriteChargeFx) {
    if (this.id === id) return;
    this.id = id;
    const a = CHARGE_ART[id];
    this.img.setTexture(a.key, 0).setOrigin(0.5, a.anchorFy).setBlendMode(a.additive ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
    this.reset();
  }

  /** Carga en curso (0..1) o `null` al soltar / cancelar. */
  setCharge(v: number | null) {
    if (v === null) {
      if (this.value !== null) {
        // se disipa solo si ya se veía algo; con muy poca carga se apaga de golpe
        if (this.value > 0.25) {
          this.outT = 0;
          this.value = null;
        } else this.reset();
      }
      return;
    }
    if (this.value === null) this.reset();
    this.value = v;
    this.outT = null;
  }

  private reset() {
    this.t = 0;
    this.outT = null;
    this.value = null;
    this.img.setVisible(false);
  }

  /** Se llama en cada fotograma. (x, y) = pies del jugador en pantalla; `s` = escala de perspectiva. */
  render(dt: number, x: number, y: number, s: number, depth: number) {
    const id = this.id;
    if (!id) return;
    this.t += dt;
    let frame: number;
    let alpha = 1;
    if (this.value !== null) {
      frame = this.value >= 1 ? PEAK[Math.floor(this.t * 12) % PEAK.length] : Math.min(5, Math.floor(this.value * 5.999));
    } else if (this.outT !== null) {
      this.outT += dt;
      const i = Math.floor(this.outT * 20);
      if (i >= OUT.length) {
        this.outT = null;
        this.img.setVisible(false);
        return;
      }
      frame = OUT[i];
      alpha = 1 - (i / OUT.length) * 0.4;
    } else {
      if (this.img.visible) this.img.setVisible(false);
      return;
    }
    const a = CHARGE_ART[id];
    const w = (RING_W * s) / a.ringFill;
    this.img
      .setVisible(true)
      .setFrame(frame)
      .setPosition(x, y)
      .setScale(w / a.cw)
      .setAlpha(alpha)
      .setDepth(depth - 0.8);
  }

  /** ¿Se está dibujando algo? */
  get active() {
    return this.img.visible;
  }

  hide() {
    this.reset();
  }

  destroy() {
    this.img.destroy();
  }
}
