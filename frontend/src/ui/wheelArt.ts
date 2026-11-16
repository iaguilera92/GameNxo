import Phaser from 'phaser';
import { FONT } from './theme';
import { WHEEL, type WheelSlot } from '../domain/wheelConfig';
import { drawCashIcon } from '../scenes/BattlePassScene';

/**
 * Arte de las ruletas (dibujado por código, sin imágenes): colores por sector, iconos de premio
 * y la cara de la ruleta (grande en la pantalla de giro, pequeña en el menú).
 */
export const NAVY = 0x0b1733;
export const GOLD = 0xffc42e;

/** Ángulo (rad) por sector y del centro del sector i con la ruleta sin girar (0 = arriba). */
export const SECTOR = (Math.PI * 2) / WHEEL.slots.length;
export const sectorCenter = (i: number) => -Math.PI / 2 + i * SECTOR;

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
  else if (k === 'cash') drawCashIcon(g, (r / 22) * 0.95, x, y); // billetes: mismo dibujo que el contador del menú
  // (15-11-2026) el COFRE es del COFRE EVOLUTIVO; el premio ÉPICO pasa a una estrella dorada (para no confundirlos)
  else if (k === 'chest') drawChestIcon(g, r, x, y);
  else if (k === 'epic') drawEpicStarIcon(g, r, x, y);
  else drawGiftIcon(g, r, x, y);
}

/** Estrella dorada con borde (premio ÉPICO de la ruleta). */
export function drawEpicStarIcon(g: Phaser.GameObjects.Graphics, r: number, x = 0, y = 0) {
  const pts = (rr: number) => Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const q = i % 2 ? rr * 0.46 : rr;
    return { x: x + Math.cos(a) * q, y: y + Math.sin(a) * q };
  });
  g.fillStyle(0x0a1638, 1).fillPoints(pts(r * 1.25), true);
  g.fillStyle(0xffb020, 1).fillPoints(pts(r * 1.05), true);
  g.fillStyle(0xffe680, 1).fillPoints(pts(r * 0.72), true);
  g.fillStyle(0xffffff, 0.8).fillCircle(x - r * 0.18, y - r * 0.22, r * 0.14);
}

// ---------------------------------------------------------------- cara de la ruleta

/**
 * Colores de fondo de los sectores (en orden, sentido horario desde arriba). Los 8 del diseño de la
 * ruleta (marco metálico azul + neón) y 2 tonos más de la misma gama para los 10 premios.
 * El color es solo de fondo: la rareza se sigue marcando con el icono y el brillo de los especiales.
 */
export const SECTOR_PALETTE = [
  0x167dcc, // azul eléctrico
  0x7040c8, // violeta intenso
  0x12b8c5, // turquesa
  0x244a9b, // azul oscuro
  0xb43ba5, // magenta
  0x087ead, // cian profundo
  0x5835a5, // púrpura
  0x238fd6, // azul brillante
  0x8e3cc0, // violeta medio (extra)
  0x1fa7b8, // turquesa profundo (extra)
];

const SECTOR_PALETTE_GOLD = [0xd9a100, 0x9c5a0b, 0xf0bf2a, 0x7e4a08, 0xe08a12, 0xb67a00, 0xf7cf55, 0x8f520b, 0xe8a91f, 0xc47f10];
const SECTOR_PALETTE_EPIC = [0x7a2ff0, 0x42188f, 0xb43ee0, 0x2a1266, 0xd24ad0, 0x5b25c4, 0x9440d0, 0x35177d, 0xa24cf0, 0x6a2fb8];

/**
 * Aspecto de cada NIVEL de la ruleta (normal / dorada / épica, 15-11-2026): colores de los sectores, de las divisiones y del
 * resplandor, y el filtro de color del marco (ver `ensureTierTexture`). Es solo cosmético: el nivel lo decide domain/dailyWheel.
 */
export const TIER_LOOK = {
  normal: { palette: SECTOR_PALETTE, line: [0x5fe6ff, 0x7ff0ff, 0x9ff4ff], glow: 0xffd23f, text: '#ffd23f', title: '', metalHue: 0, sat: 1, val: 1 },
  gold: { palette: SECTOR_PALETTE_GOLD, line: [0xffe27a, 0xfff0a0, 0xfff8d0], glow: 0xffc42e, text: '#ffd23f', title: '¡RULETA DORADA!', metalHue: 43, sat: 1.05, val: 1.12 },
  epic: { palette: SECTOR_PALETTE_EPIC, line: [0xc68bff, 0xe0b0ff, 0xf3dcff], glow: 0xb878ff, text: '#d9a8ff', title: '¡RULETA ÉPICA!', metalHue: 278, sat: 1.05, val: 1.05 },
} as const;

/** Convierte (r,g,b 0-255) a HSV (h 0-360, s y v 0-1) y vuelve. */
function rgb2hsv(r: number, g: number, b: number): [number, number, number] {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, mx ? d / mx : 0, mx / 255];
}
function hsv2rgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/**
 * Textura del marco de la ruleta teñida para un nivel (filtro de color calculado una vez en un canvas, SIN preFX/postFX:
 * funciona igual en el APK). El metal azul y las luces cian pasan al tono del nivel; el aro naranja y el indicador, a un
 * dorado más vivo (dorada) o a un rosa magenta (épica). Devuelve la clave de la textura (la original si es 'normal').
 * Cada textura ocupa tamaño² × 4 bytes: la escena las quita al cerrarse.
 */
export function ensureTierTexture(scene: Phaser.Scene, srcKey: string, tier: 'normal' | 'gold' | 'epic'): string {
  if (tier === 'normal') return srcKey;
  const key = `${srcKey}-${tier}`;
  if (scene.textures.exists(key)) return key;
  const src = scene.textures.get(srcKey).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const w = src.width;
  const h = src.height;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return srcKey;
  const ctx = tex.getContext();
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const look = TIER_LOOK[tier];
  const ringHue = tier === 'gold' ? 48 : 308;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const [hh, ss, vv] = rgb2hsv(d[i], d[i + 1], d[i + 2]);
    if (ss < 0.12) continue; // blancos y grises (brillos) se quedan
    let nh: number;
    let ns = ss;
    let nv = vv;
    if (hh >= 150 && hh <= 335) {
      nh = look.metalHue + (hh - 215) * 0.22; // metal y luces: al tono del nivel (conserva algo de variación)
      ns = Math.min(1, ss * look.sat);
      nv = Math.min(1, vv * look.val);
    } else {
      nh = ringHue + (hh > 180 ? hh - 360 : hh - 35) * 0.2; // aro naranja e indicador
      ns = Math.min(1, ss * 0.95);
      nv = Math.min(1, vv * 1.08);
    }
    const [r, g, b] = hsv2rgb(((nh % 360) + 360) % 360, ns, nv);
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
  }
  ctx.putImageData(img, 0, 0);
  tex.refresh();
  return key;
}

const mix = (a: number, b: number, t: number) => {
  const c = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(a), Phaser.Display.Color.ValueToColor(b), 100, t * 100);
  return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
};

/**
 * Dibuja los 10 sectores en `g` (centrados en 0,0, radio r) con la ruleta sin girar: fondo de color con
 * degradado radial sutil, brillo interior y divisiones luminosas. Sin huecos ni zonas transparentes.
 * `detail`: divisiones con halo (grande) o simplificado (miniatura).
 */
export function drawWheelFace(g: Phaser.GameObjects.Graphics, r: number, detail = true, tier: 'normal' | 'gold' | 'epic' = 'normal') {
  const look = TIER_LOOK[tier];
  const palette = look.palette;
  // base continua: ningún hueco entre sectores
  g.fillStyle(tier === 'gold' ? 0x4a2c04 : tier === 'epic' ? 0x1c0b45 : 0x0b1f4a, 1).fillCircle(0, 0, r);
  WHEEL.slots.forEach((_, i) => {
    const col = palette[i % palette.length];
    const a0 = sectorCenter(i) - SECTOR / 2 - 0.004;
    const a1 = a0 + SECTOR + 0.008;
    // degradado radial: más oscuro al centro, más claro hacia el borde
    const steps = detail ? 7 : 3;
    for (let k = steps; k >= 1; k--) {
      const t = k / steps;
      g.fillStyle(mix(mix(col, 0x061230, 0.3), mix(col, 0xffffff, 0.08), t), 1).slice(0, 0, r * t, a0, a1, false).fillPath();
    }
    // brillo interior (fino, junto al borde)
    if (detail) g.lineStyle(3, mix(col, 0xffffff, 0.45), 0.55).beginPath().arc(0, 0, r * 0.93, a0 + 0.03, a1 - 0.03).strokePath();
  });
  // divisiones luminosas
  WHEEL.slots.forEach((_, i) => {
    const a = sectorCenter(i) - SECTOR / 2;
    const x0 = Math.cos(a) * r * 0.16;
    const y0 = Math.sin(a) * r * 0.16;
    const x1 = Math.cos(a) * r;
    const y1 = Math.sin(a) * r;
    if (detail) {
      g.lineStyle(9, look.line[0], 0.22).lineBetween(x0, y0, x1, y1);
      g.lineStyle(4, look.line[1], 0.75).lineBetween(x0, y0, x1, y1);
      g.lineStyle(1.5, 0xffffff, 0.95).lineBetween(x0, y0, x1, y1);
    } else g.lineStyle(2, look.line[2], 0.9).lineBetween(x0, y0, x1, y1);
  });
}

/** Contenido (icono + texto) de cada sector, orientado hacia fuera. Para la ruleta grande. */
export function addSectorContent(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, r: number) {
  WHEEL.slots.forEach((s, i) => {
    const a = sectorCenter(i);
    const c = scene.add.container(0, 0).setRotation(a + Math.PI / 2);
    // texto por fuera (donde el sector es más ancho) e icono hacia el centro
    const special = s.prize.kind === 'cosmetic' || s.prize.kind === 'epic' || s.prize.kind === 'chest';
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
    if (s.prize.kind === 'cash') {
      c.add(scene.add.text(0, -r * 0.7, 'DINERO', { fontFamily: FONT, fontSize: `px`, color: '#b8ffc8', stroke: '#0a1638', strokeThickness: 3 }).setOrigin(0.5));
    }
    if (s.prize.kind === 'xp') {
      c.add(scene.add.text(0, -r * 0.7, 'EXP', { fontFamily: FONT, fontSize: `${Math.round(r * 0.055)}px`, color: '#cfe9ff', stroke: '#0a1638', strokeThickness: 3 }).setOrigin(0.5));
    }
    const g = scene.add.graphics();
    drawSlotIcon(g, s, r * 0.105, 0, -r * 0.52);
    c.add(g);
    parent.add(c);
  });
}
