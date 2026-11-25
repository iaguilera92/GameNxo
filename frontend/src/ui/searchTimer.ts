import Phaser from 'phaser';
import { FONT } from './theme';

/**
 * (21-11-2026, mockup del usuario en _temp/buscando/) CONTADOR de la búsqueda de rival: placa dorada (assets/buscando/contador.webp, 2000x667) y el tiempo escrito encima, al centro.
 * Sin la imagen, solo el texto celeste de siempre.
 */
const KEY = 'search-timer';
/** separación entre el borde del título y el centro de cada flecha » « (px) */
const GAP_CHEV = 62;
/** dibujo visible de la imagen y centro del hueco del tiempo (px de contador.webp) */
const ART = { x0: 19, y0: 95, x1: 1977, y1: 564, textX: 1000, textY: 338, imgW: 2000, imgH: 667 }; // (21-11-2026) placa sin cronómetro: el tiempo al centro

export function preloadSearchTimer(load: Phaser.Loader.LoaderPlugin) {
  if (!load.textureManager.exists(KEY)) load.image(KEY, 'assets/buscando/contador.webp');
}

/** Crea el contador centrado en (x, y) dentro de `parent`; devuelve el texto (para ir cambiándolo). `w` = ancho del dibujo. */
export function searchTimer(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number, w = 220): Phaser.GameObjects.Text {
  if (!scene.textures.exists(KEY)) {
    const t = scene.add.text(x, y, '0:00', { fontFamily: FONT, fontSize: '30px', color: '#37e0ff' }).setOrigin(0.5);
    parent.add(t);
    return t;
  }
  const s = w / (ART.x1 - ART.x0);
  const cx = (ART.x0 + ART.x1) / 2;
  const cy = (ART.y0 + ART.y1) / 2;
  // (25-11-2026) medidas en px del original (ART.imgW): la escala se corrige si el archivo está achicado
  const k = ART.imgW / (scene.textures.get(KEY).getSourceImage() as { width: number }).width;
  const img = scene.add.image(x - (cx - ART.imgW / 2) * s, y - (cy - ART.imgH / 2) * s, KEY).setScale(s * k);
  const t = scene.add
    .text(x + (ART.textX - cx) * s, y + (ART.textY - cy) * s, '0:00', { fontFamily: FONT, fontSize: '34px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 5 })
    .setOrigin(0.5)
    .setLetterSpacing(1);
  parent.add([img, t]);
  return t;
}

/**
 * (21-11-2026, usuario: que cuadre con la placa del contador) Título "BUSCANDO RIVAL" con el estilo del mockup: cursiva gruesa con borde
 * oscuro, todo en blanco (22-11-2026; antes la 1.ª palabra en blanco y el resto en DORADO (degradado con corte duro), flechas doradas » « a los lados y una línea de luz
 * dorada debajo. Sigue siendo el mismo Text (`label`), así que su texto puede cambiar (p. ej. "BUSCANDO RIVAL 1/2"): flechas, línea y
 * colores se reacomodan solos.
 */
export function styleSearchTitle(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, label: Phaser.GameObjects.Text) {
  label.setFontSize(36).setFontStyle('italic').setColor('#ffffff').setStroke('#0a1638', 8).setShadow(0, 4, '#000000', 6, true, true).setLetterSpacing(1.5);
  const deco = scene.add.graphics();
  const chevL = scene.add.text(0, label.y, '»', { fontFamily: FONT, fontSize: '38px', color: '#ffc42e', stroke: '#4a2a00', strokeThickness: 4 }).setOrigin(0.5);
  const chevR = scene.add.text(0, label.y, '«', { fontFamily: FONT, fontSize: '38px', color: '#ffc42e', stroke: '#4a2a00', strokeThickness: 4 }).setOrigin(0.5);
  parent.add([deco, chevL, chevR]);
  parent.bringToTop(label);
  let last = '';
  let baseL = 0;
  let baseR = 0;
  const refresh = () => {
    if (!label.active) return;
    const txt = label.text;
    const visible = label.visible && txt.length > 0;
    deco.setVisible(visible);
    chevL.setVisible(visible);
    chevR.setVisible(visible);
    // vaivén HACIA AFUERA calculado cada fotograma desde la posición base (un tween guardaba posiciones viejas si el título cambiaba de ancho)
    const wob = 4 * (1 + Math.sin(scene.time.now / 190));
    chevL.x = baseL - wob;
    chevR.x = baseR + wob;
    const key = `${txt}|${label.displayWidth.toFixed(1)}|${label.x.toFixed(1)}`;
    if (key === last) return;
    last = key;
    // (22-11-2026, usuario) todo el título en BLANCO (antes, de la 2.ª palabra en adelante iba en dorado)
    label.setColor('#ffffff');
    const half = label.displayWidth / 2;
    baseL = label.x - half - GAP_CHEV; // (21-11-2026, usuario) bien separadas: la cursiva sobresale del ancho medido
    baseR = label.x + half + GAP_CHEV;
    chevL.setPosition(baseL, label.y);
    chevR.setPosition(baseR, label.y);
    // línea de luz dorada bajo el título
    const lw = label.displayWidth + 120;
    const ly = label.y + label.displayHeight / 2 + 6;
    deco.clear();
    for (let i = 0; i < 6; i++) deco.fillStyle(0xffc42e, 0.05 + i * 0.03).fillRoundedRect(label.x - (lw * (1 - i * 0.13)) / 2, ly - (3 - i * 0.4), lw * (1 - i * 0.13), 2 * (3 - i * 0.4), 3);
    deco.fillStyle(0xffffff, 0.9).fillRoundedRect(label.x - lw * 0.18, ly - 1, lw * 0.36, 2, 1);
  };
  refresh();
  scene.events.on(Phaser.Scenes.Events.UPDATE, refresh);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, refresh));
}