import Phaser from 'phaser';
import { FONT } from './theme';
import { WHEEL, type WheelSlot } from '../domain/wheelConfig';

/**
 * Arte de las ruletas (dibujado por código, sin imágenes): colores por sector, iconos de premio
 * y la cara de la ruleta (grande en la pantalla de giro, pequeña en el menú).
 */
export const NAVY = 0x0b1733;
export const GOLD = 0xffc42e;

/** Ángulo (rad) por sector y del centro del sector i con la ruleta sin girar (0 = arriba). */
export const SECTOR = (Math.PI * 2) / WHEEL.slots.length;
export const sectorCenter = (i: number) => -Math.PI / 2 + i * SECTOR;

/** Colores del sector según tipo de premio y rareza. */
export function slotColors(s: WheelSlot): { fill: number; light: number; dark: number } {
  if (s.prize.kind === 'cosmetic') return { fill: 0x7b2cff, light: 0xb27bff, dark: 0x4a12b0 };
  if (s.prize.kind === 'epic') return { fill: 0xff3da8, light: 0xff8fcf, dark: 0xb3126a };
  if (s.prize.kind === 'xp') return s.rarity === 'rare' ? { fill: 0x2a46ff, light: 0x6f86ff, dark: 0x16239e } : { fill: 0x2f8bff, light: 0x7cc0ff, dark: 0x1653b8 };
  if (s.rarity === 'rare') return { fill: 0xff8a1e, light: 0xffc06a, dark: 0xc4560a };
  return { fill: 0xffc42e, light: 0xffe27a, dark: 0xd98a00 };
}

export const isSpecial = (s: WheelSlot) => s.rarity === 'special' || s.rarity === 'epic';

// ---------------------------------------------------------------- iconos (centrados en 0,0)

export function drawCoinIcon(g: Phaser.GameObjects.Graphics, r: number, x = 0, y = 0) {
  g.fillStyle(0x0a1638, 1).fillCircle(x, y, r + 2.5);
  g.fillStyle(0xd99400, 1).fillCircle(x, y + 1.5, r);
  g.fillStyle(GOLD, 1).fillCircle(x, y, r);
  g.lineStyle(Math.max(1.5, r * 0.14), 0xfff1b8, 0.9).strokeCircle(x, y, r * 0.68);
  const k = r / 14;
  g.fillStyle(0xd99400, 1).fillPoints(
    [{ x: x - 6 * k, y: y + 4 * k }, { x: x - 7 * k, y: y - 4 * k }, { x: x - 3 * k, y }, { x, y: y - 6 * k }, { x: x + 3 * k, y }, { x: x + 7 * k, y: y - 4 * k }, { x: x + 6 * k, y: y + 4 * k }],
    true,
  );
  g.fillStyle(0xffffff, 0.55).fillEllipse(x - r * 0.35, y - r * 0.42, r * 0.7, r * 0.32);
}

function starPts(x: number, y: number, r: number, inner = 0.48, n = 5, rot = -Math.PI / 2) {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i * Math.PI) / n;
    const rr = i % 2 ? r * inner : r;
    pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr });
  }
  return pts;
}

export function drawXpIcon(g: Phaser.GameObjects.Graphics, r: number, x = 0, y = 0) {
  g.fillStyle(0x0a1638, 1).fillPoints(starPts(x, y, r + 3.5, 0.52), true);
  g.fillStyle(0x1aa0ff, 1).fillPoints(starPts(x, y + 1.5, r, 0.5), true);
  g.fillStyle(0x7fe3ff, 1).fillPoints(starPts(x, y, r, 0.5), true);
  g.fillStyle(0xffffff, 0.6).fillPoints(starPts(x - r * 0.12, y - r * 0.15, r * 0.4, 0.5), true);
}

/** Cofre (premio épico). */
export function drawChestIcon(g: Phaser.GameObjects.Graphics, r: number, x = 0, y = 0) {
  const w = r * 2;
  const h = r * 1.5;
  g.fillStyle(0x0a1638, 1).fillRoundedRect(x - w / 2 - 3, y - h / 2 - 3, w + 6, h + 6, r * 0.3);
  g.fillStyle(0x9a4a12, 1).fillRoundedRect(x - w / 2, y - h / 2, w, h, r * 0.25);
  g.fillStyle(0xc96a1e, 1).fillRoundedRect(x - w / 2, y - h / 2, w, h * 0.42, { tl: r * 0.25, tr: r * 0.25, bl: 0, br: 0 });
  g.fillStyle(GOLD, 1).fillRect(x - w / 2, y - h * 0.08, w, h * 0.14);
  g.fillStyle(GOLD, 1).fillRect(x - r * 0.16, y - h / 2, r * 0.32, h);
  g.fillStyle(0xfff1b8, 1).fillRoundedRect(x - r * 0.22, y - h * 0.12, r * 0.44, r * 0.42, 3);
  g.fillStyle(0x0a1638, 1).fillCircle(x, y + r * 0.05, r * 0.07);
}

/** Regalo misterioso (premio especial cosmético). */
export function drawGiftIcon(g: Phaser.GameObjects.Graphics, r: number, x = 0, y = 0) {
  const w = r * 1.9;
  const h = r * 1.55;
  const top = y - h / 2 + r * 0.25;
  g.fillStyle(0x0a1638, 1).fillRoundedRect(x - w / 2 - 3, top - 3, w + 6, h + 6, r * 0.22);
  g.fillStyle(0xff4fa0, 1).fillRoundedRect(x - w / 2, top, w, h, r * 0.18);
  g.fillStyle(0xff8fcf, 1).fillRect(x - w / 2, top, w, h * 0.3);
  g.fillStyle(GOLD, 1).fillRect(x - r * 0.17, top, r * 0.34, h);
  g.fillStyle(GOLD, 1).fillRect(x - w / 2, top + h * 0.22, w, r * 0.22);
  // lazo
  g.fillStyle(0x0a1638, 1).fillEllipse(x - r * 0.42, top - r * 0.12, r * 0.86, r * 0.6).fillEllipse(x + r * 0.42, top - r * 0.12, r * 0.86, r * 0.6);
  g.fillStyle(GOLD, 1).fillEllipse(x - r * 0.42, top - r * 0.12, r * 0.7, r * 0.46).fillEllipse(x + r * 0.42, top - r * 0.12, r * 0.7, r * 0.46);
  g.fillStyle(0xfff1b8, 1).fillCircle(x, top - r * 0.05, r * 0.2);
}

export function drawSlotIcon(g: Phaser.GameObjects.Graphics, s: WheelSlot, r: number, x = 0, y = 0) {
  const k = s.prize.kind;
  if (k === 'coins') drawCoinIcon(g, r, x, y);
  else if (k === 'xp') drawXpIcon(g, r * 1.12, x, y);
  else if (k === 'epic') drawChestIcon(g, r, x, y);
  else drawGiftIcon(g, r, x, y);
}

// ---------------------------------------------------------------- cara de la ruleta

/**
 * Dibuja los 10 sectores en `g` (centrados en 0,0, radio r) con la ruleta sin girar.
 * `detail`: bordes y separadores finos (grande) o simplificado (miniatura).
 */
export function drawWheelFace(g: Phaser.GameObjects.Graphics, r: number, detail = true) {
  WHEEL.slots.forEach((s, i) => {
    const c = slotColors(s);
    const a0 = sectorCenter(i) - SECTOR / 2;
    const a1 = a0 + SECTOR;
    g.fillStyle(c.fill, 1).slice(0, 0, r, a0, a1, false).fillPath();
    // banda exterior más clara (volumen) y centro algo más oscuro
    g.fillStyle(c.light, 0.55).slice(0, 0, r, a0, a1, false).fillPath();
    g.fillStyle(c.fill, 1).slice(0, 0, r * 0.86, a0, a1, false).fillPath();
    g.fillStyle(c.dark, 0.45).slice(0, 0, r * 0.34, a0, a1, false).fillPath();
  });
  // separadores
  g.lineStyle(detail ? 4 : 2, 0xffffff, detail ? 0.9 : 0.8);
  WHEEL.slots.forEach((_, i) => {
    const a = sectorCenter(i) - SECTOR / 2;
    g.lineBetween(Math.cos(a) * r * 0.2, Math.sin(a) * r * 0.2, Math.cos(a) * r, Math.sin(a) * r);
  });
  if (detail) {
    g.lineStyle(2, NAVY, 0.35);
    WHEEL.slots.forEach((_, i) => {
      const a = sectorCenter(i) - SECTOR / 2 + 0.012;
      g.lineBetween(Math.cos(a) * r * 0.2, Math.sin(a) * r * 0.2, Math.cos(a) * r, Math.sin(a) * r);
    });
  }
}

/** Contenido (icono + texto) de cada sector, orientado hacia fuera. Para la ruleta grande. */
export function addSectorContent(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, r: number) {
  WHEEL.slots.forEach((s, i) => {
    const a = sectorCenter(i);
    const c = scene.add.container(0, 0).setRotation(a + Math.PI / 2);
    // texto por fuera (donde el sector es más ancho) e icono hacia el centro
    const special = s.prize.kind === 'cosmetic' || s.prize.kind === 'epic';
    const label = scene.add
      .text(0, -r * 0.8, s.label, {
        fontFamily: FONT,
        fontSize: `${Math.round(r * (special ? 0.075 : 0.105))}px`,
        color: special ? '#fff1b8' : '#ffffff',
        stroke: '#0a1638',
        strokeThickness: Math.max(4, Math.round(r * 0.022)),
      })
      .setOrigin(0.5);
    // ancho disponible: cuerda del sector a ese radio, con margen
    const maxW = 2 * r * 0.8 * Math.sin(SECTOR / 2) * 0.82;
    if (label.width > maxW) label.setScale(maxW / label.width);
    c.add(label);
    if (s.prize.kind === 'xp') {
      c.add(scene.add.text(0, -r * 0.7, 'EXP', { fontFamily: FONT, fontSize: `${Math.round(r * 0.055)}px`, color: '#cfe9ff', stroke: '#0a1638', strokeThickness: 3 }).setOrigin(0.5));
    }
    const g = scene.add.graphics();
    drawSlotIcon(g, s, r * 0.105, 0, -r * 0.52);
    c.add(g);
    parent.add(c);
  });
}
