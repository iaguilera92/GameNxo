import Phaser from 'phaser';
import { FONT } from './theme';

/**
 * Texto "LIGA" de la barra inferior (16-11-2026: antes la imagen decía "RANKING"). Las imágenes barra-inicio.webp y
 * barra-ranking.webp ya no traen esa palabra (se borró); aquí se escribe encima, en el sitio y con el estilo de las otras
 * etiquetas de la barra. `place(ox, oy)` convierte un punto de la imagen original (2172×724) a la pantalla.
 * `active`: la pestaña es la abierta (blanco puro, como INICIO en el menú).
 */
export function navLigaLabel(scene: Phaser.Scene, place: (ox: number, oy: number) => { x: number; y: number }, scale: number, active: boolean, oy: number) {
  const p = place(414, oy);
  return scene.add
    .text(p.x, p.y, 'LIGA', { fontFamily: FONT, fontSize: `${Math.round(84 * scale)}px`, color: active ? '#ffffff' : '#dfe3f6', stroke: '#0a1430', strokeThickness: Math.max(2, 9 * scale) })
    .setOrigin(0.5)
    .setShadow(0, 4 * scale, '#000000', 4 * scale, true, true)
    .setDepth(101);
}
