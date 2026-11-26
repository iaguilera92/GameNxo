import Phaser from 'phaser';

/**
 * (26-11-2026, usuario) RAYOS de luz que se DIFUMINAN al alejarse del centro (en vez de triángulos sólidos): cada rayo se dibuja en `steps`
 * tramos que se ensanchan y pierden opacidad hacia afuera. Para el "ventilador" detrás de iconos y premios.
 */
export function drawFadingRays(g: Phaser.GameObjects.Graphics, count: number, len: number, color: number, alpha = 0.22, halfAngle = 0.14, steps = 9) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    for (let k = 0; k < steps; k++) {
      const r0 = (len * k) / steps;
      const r1 = (len * (k + 1)) / steps;
      const f = 1 - k / steps; // más lejos, más transparente
      g.fillStyle(color, alpha * f * f);
      g.fillPoints([
        { x: Math.cos(a - halfAngle) * r0, y: Math.sin(a - halfAngle) * r0 },
        { x: Math.cos(a - halfAngle) * r1, y: Math.sin(a - halfAngle) * r1 },
        { x: Math.cos(a + halfAngle) * r1, y: Math.sin(a + halfAngle) * r1 },
        { x: Math.cos(a + halfAngle) * r0, y: Math.sin(a + halfAngle) * r0 },
      ], true);
    }
  }
}
