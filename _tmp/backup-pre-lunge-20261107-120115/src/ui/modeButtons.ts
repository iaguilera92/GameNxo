import Phaser from 'phaser';
import { FONT } from './theme';
import { roundedPoly } from './shapes';
import { refitWhenFontsReady } from './fitText';

/**
 * Botones de modo de juego (JUGAR / 2v2…): forma inclinada del botón JUGAR original,
 * contorno marino, sombra azul, degradado escalonado y brillo sutil. Dibujados por código.
 */

interface BodyPal {
  top: number;
  mid: number;
  bottom: number;
  shadow: number;
  shadowA: number;
  glossA: number;
}

/** Paralelogramo inclinado (la parte de arriba se corre a la derecha) con esquinas suaves. */
function modeShape(w: number, h: number, grow = 0) {
  const k = h * 0.22;
  const hw = w / 2 + grow;
  const hh = h / 2 + grow;
  return roundedPoly([[-hw + k, -hh], [hw + k * 0.15, -hh], [hw - k, hh], [-hw - k * 0.15, hh]], 12 + grow);
}

/**
 * Franja horizontal de y0 a y1 DENTRO de la forma: sus lados siguen los lados inclinados del botón (misma
 * inclinación), metidos `inset` px. Antes cada capa era una forma más baja con MENOS inclinación y sus
 * esquinas asomaban por los lados del botón (el fondo claro del texto se salía).
 */
function modeBand(w: number, h: number, y0: number, y1: number, inset: number, r: number) {
  const k = h * 0.22;
  const hw = w / 2;
  const hh = h / 2;
  const t = (y: number) => (y + hh) / (2 * hh);
  const xl = (y: number) => (-hw + k) * (1 - t(y)) + (-hw - k * 0.15) * t(y) + inset;
  const xr = (y: number) => (hw + k * 0.15) * (1 - t(y)) + (hw - k) * t(y) - inset;
  return roundedPoly([[xl(y0), y0], [xr(y0), y0], [xr(y1), y1], [xl(y1), y1]], r);
}

function modeBody(scene: Phaser.Scene, w: number, h: number, pal: BodyPal) {
  const g = scene.add.graphics();
  const off = (pts: Phaser.Math.Vector2[], dx: number, dy: number) => pts.map((p) => ({ x: p.x + dx, y: p.y + dy }));
  g.fillStyle(pal.shadow, pal.shadowA).fillPoints(off(modeShape(w, h, 4), 6, 9), true);
  g.fillStyle(0x0a1638, 1).fillPoints(modeShape(w, h, 5), true);
  g.fillStyle(pal.bottom, 1).fillPoints(modeShape(w, h), true);
  // capas del degradado (mismas alturas que antes), siempre dentro del contorno
  g.fillStyle(pal.mid, 1).fillPoints(modeBand(w, h, -h * 0.44, h * 0.34, 5, 9), true);
  g.fillStyle(pal.top, 1).fillPoints(modeBand(w, h, -h * 0.42, -h * 0.02, 8, 8), true);
  g.fillStyle(0xffffff, pal.glossA).fillPoints(modeBand(w, h, -h * 0.39, -h * 0.3, Math.max(14, w * 0.05), 4), true);
  return g;
}

const PALETTES = {
  yellow: { body: { top: 0xffe55a, mid: 0xffcc1f, bottom: 0xf29a0c, shadow: 0x1f6bff, shadowA: 0.95, glossA: 0.35 }, text: '#0a1638', stroke: 0 },
  red: { body: { top: 0xff8a94, mid: 0xff4f5e, bottom: 0xc42536, shadow: 0x1f6bff, shadowA: 0.95, glossA: 0.3 }, text: '#ffffff', stroke: 6 },
  blue: { body: { top: 0x6fb2ff, mid: 0x2f7bff, bottom: 0x153f9e, shadow: 0x0a1638, shadowA: 0.9, glossA: 0.3 }, text: '#ffffff', stroke: 6 },
  grey: { body: { top: 0x3c465e, mid: 0x2e374c, bottom: 0x232a3b, shadow: 0x1f6bff, shadowA: 0.35, glossA: 0.08 }, text: '#8d99b5', stroke: 0 },
};
export type ArcadePalette = keyof typeof PALETTES;

/** Botón principal amarillo con texto + chevron, latido suave y rebote al pulsar. */
export function playButton(scene: Phaser.Scene, x: number, y: number, w: number, h: number, onClick: () => void, label = 'JUGAR') {
  return arcadeButton(scene, x, y, w, h, label, onClick, { palette: 'yellow', chevron: true, pulse: true });
}

/** Botón arcade con la forma común (amarillo o rojo), opcionalmente con chevron y latido. */
export function arcadeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
  opts: { palette?: ArcadePalette; chevron?: boolean; pulse?: boolean; disabled?: boolean } = {},
) {
  const { palette = 'yellow', chevron = false, pulse = false, disabled = false } = opts;
  const pal = PALETTES[palette];
  const holder = scene.add.container(x, y);
  const inner = scene.add.container(0, 0);
  holder.add(inner);
  inner.add(modeBody(scene, w, h, pal.body));
  const txt = scene.add
    .text(chevron ? -h * 0.12 : 0, 0, label, {
      fontFamily: FONT,
      fontSize: `${Math.round(h * (chevron ? 0.56 : 0.46))}px`,
      color: pal.text,
      stroke: '#0a1638',
      strokeThickness: pal.stroke,
    })
    .setOrigin(0.5);
  // el texto nunca se sale del botón (margen por la forma inclinada y el chevron); se reajusta al cargar la fuente
  const maxW = w * (chevron ? 0.6 : 0.72) - h * 0.2;
  const maxH = h * 0.72;
  refitWhenFontsReady(txt, () => txt.setScale(Math.min(1, maxW / Math.max(1, txt.width), maxH / Math.max(1, txt.height))));
  inner.add(txt);
  if (chevron) {
    const ch = scene.add.graphics({ x: w / 2 - h * 0.48, y: 0 });
    ch.lineStyle(Math.round(h * 0.09), 0x0a1638, 1).beginPath().moveTo(-h * 0.09, -h * 0.16).lineTo(h * 0.08, 0).lineTo(-h * 0.09, h * 0.16).strokePath();
    inner.add(ch);
  }

  holder.setSize(w, h);
  holder.setData('label', txt);
  if (disabled) return holder; // sin interacción
  holder.setInteractive({ useHandCursor: true });
  if (pulse) scene.tweens.add({ targets: holder, scale: 1.04, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

  let pressed = false;
  const release = (fire: boolean) => {
    if (!pressed) return;
    pressed = false;
    scene.tweens.killTweensOf(inner);
    scene.tweens.add({ targets: inner, scale: 1, duration: 260, ease: 'Back.easeOut', easeParams: [3], onComplete: () => { if (fire) onClick(); } });
  };
  holder.on('pointerdown', () => {
    pressed = true;
    scene.tweens.killTweensOf(inner);
    scene.tweens.add({ targets: inner, scale: 0.9, duration: 70, ease: 'Quad.easeOut' });
  });
  holder.on('pointerup', () => release(true));
  holder.on('pointerout', () => release(false));
  return holder;
}

/** Modo futuro: misma forma en gris oscuro, candado + texto, sin interacción. */
export function lockedModeButton(scene: Phaser.Scene, x: number, y: number, w: number, h: number, label: string) {
  const c = scene.add.container(x, y);
  c.add(modeBody(scene, w, h, { top: 0x3c465e, mid: 0x2e374c, bottom: 0x232a3b, shadow: 0x1f6bff, shadowA: 0.35, glossA: 0.08 }));
  const txt = scene.add.text(0, 0, label, { fontFamily: FONT, fontSize: `${Math.round(h * 0.4)}px`, color: '#8d99b5' }).setOrigin(0, 0.5);
  const lw = h * 0.26;
  const gap = h * 0.08;
  const lk = scene.add.graphics({ x: 0, y: h * 0.02 });
  // candado + texto centrados y dentro del botón (se recalcula al cargar la fuente)
  const layout = () => {
    const maxTxt = Math.max(10, w * 0.78 - h * 0.25 - lw - gap);
    txt.setScale(Math.min(1, maxTxt / Math.max(1, txt.width)));
    const lx = -(lw + gap + txt.displayWidth) / 2 + lw / 2 - h * 0.03;
    lk.setX(lx);
    txt.setX(lx + lw / 2 + gap);
  };
  refitWhenFontsReady(txt, layout);
  lk.lineStyle(h * 0.05, 0x8d99b5, 1).beginPath().arc(0, -lw * 0.18, lw * 0.3, Math.PI, 0).strokePath();
  lk.fillStyle(0x8d99b5, 1).fillRoundedRect(-lw / 2, -lw * 0.18, lw, lw * 0.75, lw * 0.14);
  lk.fillStyle(0x232a3b, 1).fillCircle(0, lw * 0.12, lw * 0.09).fillRect(-lw * 0.035, lw * 0.12, lw * 0.07, lw * 0.2);
  c.add([lk, txt]);
  return c;
}
