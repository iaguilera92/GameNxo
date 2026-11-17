import Phaser from 'phaser';

/**
 * Pinta UNA vez un dibujo estático (fondos de tarjeta, botones) en una textura y devuelve una imagen.
 *
 * Un `Graphics` de Phaser vuelve a recorrer todos sus comandos (cada rectángulo redondeado = decenas de puntos) en CADA
 * fotograma que se ve. Una tarjeta de la Tienda tiene ~20 y un botón ~6: con varias a la vez en pantalla, el móvil se pega.
 * Como imagen cuesta un solo quad. La textura queda en el gestor de texturas: la misma tarjeta (mismo `key`) no se vuelve a pintar.
 *
 * `bounds` está en las coordenadas del dibujo (x0, y0 = esquina de arriba a la izquierda, con margen para sombras y brillos).
 * La imagen devuelta ya está en (x0, y0) con origen 0: quien la usa la suma a su posición real.
 * `q` = píxeles de textura por unidad del juego (2 en botones chicos, 1,5 en tarjetas grandes: menos memoria de GPU).
 */
export function bakeGraphics(
  scene: Phaser.Scene,
  key: string,
  bounds: { x0: number; y0: number; w: number; h: number },
  q: number,
  draw: (g: Phaser.GameObjects.Graphics) => void,
): Phaser.GameObjects.Image {
  const cw = Math.max(1, Math.ceil(bounds.w * q));
  const ch = Math.max(1, Math.ceil(bounds.h * q));
  if (!scene.textures.exists(key)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.scaleCanvas(q, q);
    g.translateCanvas(-bounds.x0, -bounds.y0);
    draw(g);
    g.generateTexture(key, cw, ch);
    g.destroy();
  }
  return scene.add.image(bounds.x0, bounds.y0, key).setOrigin(0).setDisplaySize(cw / q, ch / q);
}

/** Quita las texturas cuyo nombre empieza por `prefix` (al salir de una escena que las pintó, para no dejar memoria de GPU ocupada). */
export function dropBaked(scene: Phaser.Scene, prefix: string) {
  for (const k of scene.textures.getTextureKeys()) if (k.startsWith(prefix)) scene.textures.remove(k);
}
