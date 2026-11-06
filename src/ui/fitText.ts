import Phaser from 'phaser';

/**
 * Ajusta un texto a `maxW` (px en pantalla): primero lo achica hasta `minScale` y, si aún
 * no cabe, lo corta y termina en "...". Nunca se sale del ancho dado.
 */
export function fitText(t: Phaser.GameObjects.Text, maxW: number, minScale = 0.75) {
  const full = t.text;
  t.setScale(1);
  if (t.width <= maxW) return;
  t.setScale(Math.max(minScale, maxW / t.width));
  if (t.displayWidth <= maxW) return;
  let txt = full;
  while (txt.length > 1 && t.displayWidth > maxW) {
    txt = txt.slice(0, -1);
    t.setText(txt.trimEnd() + '...');
  }
}
