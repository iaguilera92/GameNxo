import Phaser from 'phaser';
import { UI } from './ui';
import { BALL_FELT_KEY, BALL_SHADE_KEY, makeBallArt } from '../objects/Ball';

/**
 * Centro de las pantallas "Buscando rival" (contra el BOT: MatchmakingScene; online: LanSearchScene): anillo de escaneo
 * (dos arcos girando en sentidos opuestos), pulso de fondo y la pelota del partido botando en el centro. Tocar la pantalla
 * lanza la pelota (juguete para la espera). Se añade a `parent`, que debe estar en (W/2, H*0.44).
 */
export function searchSpinner(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, W: number, H: number) {
  // --- anillo de escaneo (dos arcos girando en sentidos opuestos)
  const ringR = 92;
  const ring = scene.add.graphics();
  const drawRing = (g: Phaser.GameObjects.Graphics, r: number, col: number, from: number, len: number, lw: number) => {
    g.lineStyle(lw, col, 1).beginPath().arc(0, 0, r, from, from + len).strokePath();
  };
  parent.add(ring);
  // pulso luminoso de fondo
  const pulse = scene.add.circle(0, 0, ringR, UI.electric, 0.12);
  parent.add(pulse);
  scene.tweens.add({ targets: pulse, scale: 1.4, alpha: 0, duration: 1400, repeat: -1, ease: 'Quad.easeOut' });

  // pelota de tenis como detalle central: el mismo arte que la del partido (objects/Ball.makeBallArt): fieltro con
  // costuras que gira, volumen fijo encima, contorno y un halo suave
  makeBallArt(scene);
  const BR = 34;
  const halo = scene.add.circle(0, 0, BR + 10, 0xd7f53a, 0.18).setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({ targets: halo, scale: { from: 0.95, to: 1.15 }, alpha: { from: 0.28, to: 0.08 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  const outline = scene.add.circle(0, 0, BR + 4, 0x0a1838);
  const ball = scene.add.image(0, 0, BALL_FELT_KEY).setDisplaySize(BR * 2, BR * 2);
  const shade = scene.add.image(0, 0, BALL_SHADE_KEY).setDisplaySize(BR * 2, BR * 2);
  // la pelota va dentro de un "soporte": el giro continuo es del fieltro y el movimiento del soporte
  const ballHolder = scene.add.container(0, 0, [halo, outline, ball, shade]);
  parent.add(ballHolder);
  scene.tweens.add({ targets: ball, angle: 360, duration: 2400, repeat: -1 });
  // botecito suave: sube y baja
  scene.tweens.add({ targets: [outline, ball, shade], y: -10, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeOut' });
  ballToy(scene, ballHolder, W, H);

  let t = 0;
  scene.time.addEvent({
    delay: 16,
    loop: true,
    callback: () => {
      t += 0.05;
      ring.clear();
      drawRing(ring, ringR, UI.cyan, t, 2.2, 4);
      drawRing(ring, ringR - 14, UI.electric, -t * 1.3, 1.6, 3);
    },
  });
}

/**
 * Juguete para la espera: tocar la pantalla lanza la pelota del centro a un punto al azar
 * (con giro y rebote) y al rato vuelve sola al centro. No afecta a la búsqueda.
 */
function ballToy(scene: Phaser.Scene, holder: Phaser.GameObjects.Container, W: number, H: number) {
  let back: Phaser.Time.TimerEvent | undefined;
  const onTap = (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
    if (over.length > 0 || !holder.active) return; // el toque es de un botón (CANCELAR)
    scene.tweens.killTweensOf(holder);
    back?.remove();
    // destino aleatorio dentro de la pantalla (coordenadas locales: el centro de búsqueda está en H*0.44)
    const ang = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const dist = Phaser.Math.Between(110, Math.min(W * 0.4, 280));
    const tx = Phaser.Math.Clamp(Math.cos(ang) * dist, -W / 2 + 50, W / 2 - 50);
    const ty = Phaser.Math.Clamp(Math.sin(ang) * dist, -H * 0.44 + 80, H * 0.3);
    // estela: destello en el punto de salida
    const puff = scene.add.circle(holder.parentContainer.x + holder.x, holder.parentContainer.y + holder.y, 30, 0xd7f53a, 0.5);
    scene.tweens.add({ targets: puff, scale: 2.2, alpha: 0, duration: 380, onComplete: () => puff.destroy() });
    scene.tweens.add({ targets: holder, x: tx, y: ty, duration: 420, ease: 'Cubic.easeOut' });
    scene.tweens.add({ targets: holder, angle: holder.angle + Phaser.Math.RND.pick([-1, 1]) * 540, duration: 520, ease: 'Cubic.easeOut' });
    scene.tweens.add({ targets: holder, scaleX: { from: 1.3, to: 1 }, scaleY: { from: 0.75, to: 1 }, duration: 460, ease: 'Back.easeOut' });
    back = scene.time.delayedCall(1300, () => {
      if (!holder.active) return;
      scene.tweens.add({ targets: holder, x: 0, y: 0, angle: 0, duration: 600, ease: 'Back.easeOut' });
    });
  };
  scene.input.on('pointerdown', onTap);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.input.off('pointerdown', onTap));
}
