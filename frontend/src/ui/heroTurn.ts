import Phaser from 'phaser';

/**
 * (28-11-2026, usuario) GIRO 2D del retrato del personaje (como en PERSONALIZAR): solo 2 vistas, la misma imagen espejada.
 *  - ARRASTRAR hacia un lado: el personaje sigue un poco el dedo, se inclina y mira hacia ese lado
 *  - al soltar vuelve a su sitio con un rebote y se queda mirando hacia donde lo llevaste
 *  - un toque sin arrastrar: cambia de lado (con un saltito)
 * `baseX` = x de la imagen mirando a la derecha; `flipShift` = cuánto se corre al espejarse para que el CUERPO quede en el mismo sitio
 * (el retrato lleva la raqueta a un lado). No toca la `y` (deja vivo un vaivén de arriba / abajo si lo hay).
 */
export function makeHeroTurnable(scene: Phaser.Scene, hero: Phaser.GameObjects.Image, baseX: number, flipShift: number) {
  let facingLeft = false;
  let down = false;
  let moved = false;
  let startX = 0;
  let back: Phaser.Tweens.Tween | null = null;
  const homeX = () => baseX + (facingLeft ? flipShift : 0);
  const face = (left: boolean) => {
    facingLeft = left;
    hero.setFlipX(left);
  };
  hero.setInteractive({ useHandCursor: true });
  hero.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
    down = true;
    moved = false;
    startX = ptr.x;
    back?.stop();
  });
  const onMove = (ptr: Phaser.Input.Pointer) => {
    if (!down) return;
    const dx = ptr.x - startX;
    if (Math.abs(dx) > 10) moved = true;
    if (!moved) return;
    if (dx < 0 !== facingLeft) face(dx < 0);
    hero.x = homeX() + Phaser.Math.Clamp(dx, -60, 60) * 0.5;
    hero.setAngle(Phaser.Math.Clamp(dx, -60, 60) * 0.12);
  };
  const onUp = () => {
    if (!down) return;
    down = false;
    if (!moved) {
      face(!facingLeft);
      hero.x = homeX() + (facingLeft ? 18 : -18);
    }
    back = scene.tweens.add({ targets: hero, x: homeX(), angle: 0, duration: 260, ease: 'Back.easeOut' });
  };
  scene.input.on('pointermove', onMove);
  scene.input.on('pointerup', onUp);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.input.off('pointermove', onMove);
    scene.input.off('pointerup', onUp);
  });
}
