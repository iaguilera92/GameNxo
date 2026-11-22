import Phaser from 'phaser';
/**
 * (21-11-2026, usuario) FAROL QUE FALLA: en la imagen del ambiente el farol está dibujado APAGADO y su luz la pone este código
 * (bombilla, halo y cono, en modo ADD). Siempre encendido, pero unas 4 veces por partido parpadea (2-3 cortes rápidos) y vuelve.
 * Solo decoración: cada teléfono lo dibuja por su cuenta (no toca el partido ni la red). Posiciones en px de la IMAGEN del ambiente
 * (1536 de ancho); `img` dice dónde se dibujó (CourtView.drawCourtView).
 */
interface Lamp {
  /** centro de la bombilla (cara de abajo de la cabeza del farol) */
  x: number;
  y: number;
  /** ancho de la cabeza del farol */
  w: number;
  /** hasta qué y llega el cono de luz y cuánto se abre a cada lado */
  coneY: number;
  coneW: number;
}
const LAMPS: Record<string, Lamp[]> = {
  // farol del centro, detrás del muro del fondo (cabeza medida sobre la imagen: x 747-790, cara de abajo en y ~162)
  'ambiente-1': [{ x: 767, y: 162, w: 40, coneY: 300, coneW: 80 }],
};
const WARM = 0xffc864;
/** parpadeos por partido y separación entre ellos (ms) */
const FLICKERS = 4;
const FIRST_MS: [number, number] = [15000, 35000];
const GAP_MS: [number, number] = [30000, 60000];

export function startAmbientLights(scene: Phaser.Scene, ambiente: string, img: { left: number; top: number; s: number }) {
  const lamps = LAMPS[ambiente];
  if (!lamps) return;
  for (const L of lamps) {
    const s = img.s;
    const g = scene.add.graphics({ x: img.left + L.x * s, y: img.top + L.y * s }).setDepth(-19.45).setBlendMode(Phaser.BlendModes.ADD);
    // cono hacia abajo (muy suave, en capas)
    for (let i = 0; i < 4; i++) {
      const k = 1 - i * 0.22;
      g.fillStyle(WARM, 0.05);
      g.fillPoints([new Phaser.Math.Vector2(-L.w * 0.4 * s, 0), new Phaser.Math.Vector2(L.w * 0.4 * s, 0), new Phaser.Math.Vector2(L.coneW * k * s, (L.coneY - L.y) * s), new Phaser.Math.Vector2(-L.coneW * k * s, (L.coneY - L.y) * s)], true);
    }
    // halo
    for (let i = 6; i >= 1; i--) {
      g.fillStyle(WARM, 0.05);
      g.fillCircle(0, 0, L.w * 0.32 * i * s);
    }
    // bombilla (cara de abajo de la cabeza)
    g.fillStyle(0xfff2c0, 0.95);
    g.fillEllipse(0, 0, L.w * 0.55 * s, L.w * 0.16 * s);
    // parpadeo: cortes rápidos y vuelve a encenderse
    const blink = () => {
      const steps = Phaser.Math.Between(2, 3);
      let t = 0;
      for (let i = 0; i < steps; i++) {
        const off = Phaser.Math.Between(60, 140) + (i === steps - 1 ? Phaser.Math.Between(150, 400) : 0);
        scene.time.delayedCall(t, () => g.active && g.setAlpha(Phaser.Math.FloatBetween(0, 0.15)));
        t += off;
        scene.time.delayedCall(t, () => g.active && g.setAlpha(1));
        t += Phaser.Math.Between(50, 120);
      }
    };
    let left = FLICKERS;
    const next = (ms: number) =>
      scene.time.delayedCall(ms, () => {
        if (!scene.sys.isActive() || !g.active) return;
        blink();
        if (--left > 0) next(Phaser.Math.Between(GAP_MS[0], GAP_MS[1]));
      });
    next(Phaser.Math.Between(FIRST_MS[0], FIRST_MS[1]));
  }
}
