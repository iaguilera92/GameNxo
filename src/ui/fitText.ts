import Phaser from 'phaser';

/**
 * Ajusta un texto a `maxW` (px en pantalla): primero lo achica hasta `minScale` y, si aún
 * no cabe, lo corta y termina en "...". Nunca se sale del ancho dado.
 */
/**
 * Ejecuta `fit` ahora y otra vez cuando la fuente del juego termina de cargar: si el texto se midió
 * con la fuente de respaldo (más estrecha en algunos móviles) quedaría desajustado y se saldría.
 */
export function refitWhenFontsReady(t: Phaser.GameObjects.Text, fit: () => void) {
  fit();
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (!fonts?.ready) return;
  const again = () => {
    if (!t.active || !t.scene) return;
    t.updateText();
    fit();
  };
  fonts.ready.then(again).catch(() => undefined);
  fonts.load?.(`40px "Lilita One"`).then(again).catch(() => undefined);
}

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
