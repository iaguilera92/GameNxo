import type Phaser from 'phaser';
import type { ItemRarity } from '../domain/shopCatalog';

/**
 * MARCO DE RAREZA (usuario, 14-11-2026): la rareza se ve con el marco (sin escribir "normal / especial / épica / legendaria").
 * Va en las tarjetas de la Tienda y en los huecos de los diálogos donde se equipa (Personalización). Solo Graphics estáticos (sin tweens:
 * la Tienda ya fue lenta).
 *
 * (16-11-2026, rediseño: "se ven feas las rarezas") Marco con relieve, como de juego móvil:
 *   - borde de 3 capas: sombra oscura por fuera, el color de la rareza y un filo claro por dentro, con brillo arriba;
 *   - `tint` (tarjetas de la Tienda): el fondo se tiñe del color de la rareza desde abajo (degradado) y lleva una franja de luz arriba;
 *   - una gema en el centro del borde de arriba (rombo del color de la rareza) que la identifica de un vistazo;
 *   - adornos que crecen con la rareza: especial = muescas en las esquinas de arriba; épica = gemas en las 4 esquinas;
 *     legendaria = gemas doradas grandes en las 4 esquinas, corona en la gema de arriba y doble brillo exterior.
 */
export const RARITY_STYLE: Record<ItemRarity, { main: number; light: number; dark: number; width: number; glow: number; inner: boolean; studs: boolean }> = {
  normal: { main: 0x9fb0cf, light: 0xe9f0fb, dark: 0x2a3550, width: 3.5, glow: 0, inner: true, studs: false },
  especial: { main: 0x2fd0ff, light: 0xd2f8ff, dark: 0x0a3e5c, width: 4.5, glow: 0.22, inner: true, studs: false },
  epica: { main: 0xb455ff, light: 0xecd2ff, dark: 0x3a1066, width: 5, glow: 0.32, inner: true, studs: true },
  legendaria: { main: 0xffc12e, light: 0xfff4c2, dark: 0x6a4300, width: 6, glow: 0.45, inner: true, studs: true },
};

const TIER: Record<ItemRarity, number> = { normal: 0, especial: 1, epica: 2, legendaria: 3 };

/** Rombo (gema) centrado en (cx, cy) de medio ancho `r`, con su brillo. */
function gem(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number, S: (typeof RARITY_STYLE)[ItemRarity]) {
  const pts = (k: number) => [
    { x: cx, y: cy - r * k },
    { x: cx + r * 0.8 * k, y: cy },
    { x: cx, y: cy + r * k },
    { x: cx - r * 0.8 * k, y: cy },
  ];
  g.fillStyle(S.dark, 1).fillPoints(pts(1.35), true);
  g.fillStyle(S.main, 1).fillPoints(pts(1), true);
  // faceta clara arriba a la izquierda y punto de brillo
  g.fillStyle(S.light, 0.9).fillPoints([{ x: cx, y: cy - r }, { x: cx, y: cy }, { x: cx - r * 0.8, y: cy }], true);
  g.fillStyle(0xffffff, 0.95).fillCircle(cx - r * 0.25, cy - r * 0.4, Math.max(1, r * 0.18));
}

/** Corona pequeña (legendaria) sobre (cx, cy). */
function crown(g: Phaser.GameObjects.Graphics, cx: number, cy: number, s: number, S: (typeof RARITY_STYLE)[ItemRarity]) {
  const p = [
    { x: cx - s, y: cy + s * 0.55 },
    { x: cx - s, y: cy - s * 0.35 },
    { x: cx - s * 0.5, y: cy + s * 0.1 },
    { x: cx, y: cy - s * 0.65 },
    { x: cx + s * 0.5, y: cy + s * 0.1 },
    { x: cx + s, y: cy - s * 0.35 },
    { x: cx + s, y: cy + s * 0.55 },
  ];
  g.fillStyle(S.dark, 1).fillPoints(p.map((q) => ({ x: q.x + (q.x - cx) * 0.18, y: q.y + (q.y - cy) * 0.18 })), true);
  g.fillStyle(S.main, 1).fillPoints(p, true);
  g.fillStyle(S.light, 1).fillCircle(cx, cy - s * 0.65, s * 0.18).fillCircle(cx - s, cy - s * 0.35, s * 0.15).fillCircle(cx + s, cy - s * 0.35, s * 0.15);
}

/**
 * Dibuja el marco de `rarity` sobre el rectángulo (x, y, w, h) de esquinas `r`. `tint` = además tiñe el fondo (tarjetas de la Tienda; va
 * debajo del contenido: dibujar en el Graphics del fondo).
 */
export function drawRarityFrame(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, r: number, rarity: ItemRarity, tint = false) {
  const S = RARITY_STYLE[rarity];
  const t = TIER[rarity];
  if (tint) {
    // degradado desde abajo: capas apiladas, cada una algo más baja y del color de la rareza
    const bands = 7;
    for (let i = 0; i < bands; i++) {
      const top = y + h * (0.3 + (0.7 * i) / bands);
      g.fillStyle(S.main, 0.035 + t * 0.01).fillRoundedRect(x + 2, top, w - 4, y + h - 2 - top, { tl: 0, tr: 0, bl: r - 2, br: r - 2 });
    }
    // franja de luz arriba (cristal)
    g.fillStyle(S.light, 0.07 + t * 0.02).fillRoundedRect(x + 4, y + 4, w - 8, Math.min(30, h * 0.16), { tl: r - 4, tr: r - 4, bl: 6, br: 6 });
  }
  // brillo exterior (doble en la legendaria)
  if (S.glow) {
    g.lineStyle(S.width + 8, S.main, S.glow * 0.6).strokeRoundedRect(x - 2, y - 2, w + 4, h + 4, r + 2);
    if (t === 3) g.lineStyle(S.width + 16, S.main, 0.12).strokeRoundedRect(x - 4, y - 4, w + 8, h + 8, r + 4);
  }
  // borde de 3 capas: sombra, color y filo claro
  g.lineStyle(S.width + 3, S.dark, 1).strokeRoundedRect(x, y, w, h, r);
  g.lineStyle(S.width, S.main, 1).strokeRoundedRect(x, y, w, h, r);
  const o = S.width / 2 + 1.5;
  if (S.inner) g.lineStyle(1.5, S.light, 0.85).strokeRoundedRect(x + o, y + o, w - o * 2, h - o * 2, Math.max(2, r - o));
  // brillo del borde de arriba
  g.lineStyle(Math.max(1.5, S.width * 0.45), 0xffffff, 0.35 + t * 0.08).lineBetween(x + r, y - S.width * 0.15, x + w - r, y - S.width * 0.15);

  const small = Math.min(w, h) < 120; // huecos de los diálogos: adornos más chicos
  // muescas (especial) / gemas (épica y legendaria) en las esquinas
  const co = Math.max(6, r * 0.42);
  if (t === 1) {
    for (const [cx, cy] of [[x + co, y + co], [x + w - co, y + co]] as const) {
      g.fillStyle(S.dark, 1).fillCircle(cx, cy, small ? 3.5 : 4.5);
      g.fillStyle(S.light, 1).fillCircle(cx, cy, small ? 2 : 2.6);
    }
  } else if (S.studs) {
    const gr = (small ? 4 : 5.5) + (t === 3 ? 1.5 : 0);
    for (const [cx, cy] of [[x + co, y + co], [x + w - co, y + co], [x + co, y + h - co], [x + w - co, y + h - co]] as const) gem(g, cx, cy, gr, S);
  }
  // gema central arriba (sello de la rareza); la legendaria lleva corona
  if (!small) {
    gem(g, x + w / 2, y, 7 + t * 1.2, S);
    if (t === 3) crown(g, x + w / 2, y - 17, 9, S);
  }
}
