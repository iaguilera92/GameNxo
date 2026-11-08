import Phaser from 'phaser';

/**
 * Cámara de INTERFAZ separada de la del mundo.
 *
 * Phaser aplica el zoom de la cámara también a los objetos fijos en pantalla (scrollFactor 0), así que
 * un zoom al partido movería marcador, joystick y botones. Con esta cámara extra:
 *   - la cámara principal dibuja solo el mundo (cancha, personajes, pelota, efectos);
 *   - la cámara de interfaz dibuja solo lo fijo en pantalla (HUD, botones, diálogos, avisos), sin zoom.
 * La clasificación se repite antes de cada render, así que vale para objetos creados en cualquier momento
 * (popups, diálogos, banners…). Regla única: scrollFactorX === 0 → interfaz.
 */
export function setupUiCamera(scene: Phaser.Scene) {
  const main = scene.cameras.main;
  const ui = scene.cameras.add(0, 0, scene.scale.width, scene.scale.height, false, 'ui');
  ui.transparent = true;

  const classify = () => {
    for (const obj of scene.children.list) {
      const o = obj as Phaser.GameObjects.GameObject & { scrollFactorX?: number };
      o.cameraFilter = o.scrollFactorX === 0 ? main.id : ui.id;
    }
  };
  classify();
  scene.events.on(Phaser.Scenes.Events.PRE_RENDER, classify);

  const onResize = (size: Phaser.Structs.Size) => ui.setSize(size.width, size.height);
  scene.scale.on(Phaser.Scale.Events.RESIZE, onResize);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.PRE_RENDER, classify);
    scene.scale.off(Phaser.Scale.Events.RESIZE, onResize);
  });
  return ui;
}
