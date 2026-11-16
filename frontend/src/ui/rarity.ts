import type Phaser from 'phaser';
import type { ItemRarity } from '../domain/shopCatalog';

/**
 * MARCO DE RAREZA (usuario, 14-11-2026): la rareza se ve solo con el marco (sin escribir "normal / especial / épica / legendaria").
 * Va en las tarjetas de la Tienda y en los huecos de los diálogos donde se equipa (Personalización). Solo Graphics estáticos (sin tweens:
 * la Tienda ya fue lenta). Cuanto más rara, más grueso, con brillo exterior y, la legendaria, con tachuelas en las esquinas.
 *   normal       plata        borde simple
 *   especial     cian         borde + línea interior clara + brillo suave
 *   épica        morado       borde grueso + línea interior + brillo
 *   legendaria   dorado       borde más grueso + línea interior + brillo fuerte + tachuelas
 */
export const RARITY_STYLE: Record<ItemRarity, { main: number; light: number; width: number; glow: number; inner: boolean; studs: boolean }> = {
  normal: { main: 0xaab8d4, light: 0xe3ebf7, width: 3, glow: 0, inner: false, studs: false },
  especial: { main: 0x35d6ff, light: 0xc9f6ff, width: 4, glow: 0.2, inner: true, studs: false },
  epica: { main: 0xb45cff, light: 0xe6c9ff, width: 5, glow: 0.32, inner: true, studs: false },
  legendaria: { main: 0xffc83a, light: 0xfff2b8, width: 6, glow: 0.5, inner: true, studs: true },
};

/** Dibuja el marco de `rarity` sobre el rectángulo (x, y, w, h) de esquinas `r`. */
export function drawRarityFrame(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, r: number, rarity: ItemRarity) {
  const S = RARITY_STYLE[rarity];
  if (S.glow) g.lineStyle(S.width + 6, S.main, S.glow).strokeRoundedRect(x - 1, y - 1, w + 2, h + 2, r + 1);
  g.lineStyle(S.width, S.main, 1).strokeRoundedRect(x, y, w, h, r);
  if (S.inner) {
    const o = S.width + 1;
    g.lineStyle(1.5, S.light, 0.9).strokeRoundedRect(x + o, y + o, w - o * 2, h - o * 2, Math.max(2, r - o));
  }
  if (S.studs) {
    const o = Math.min(10, Math.max(5, r * 0.45));
    for (const [cx, cy] of [[x + o, y + o], [x + w - o, y + o], [x + o, y + h - o], [x + w - o, y + h - o]] as const) {
      g.fillStyle(S.main, 1).fillCircle(cx, cy, 5).fillStyle(S.light, 1).fillCircle(cx, cy, 2.4);
    }
  }
}