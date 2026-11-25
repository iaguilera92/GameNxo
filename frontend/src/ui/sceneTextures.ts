import Phaser from 'phaser';

/**
 * (25-11-2026, usuario) Imágenes PROPIAS de una pantalla (Liga, Tienda, Pase, Personalizar): las que carga SU preload (no las que ya
 * estaban) se liberan al salir de la pantalla. Antes quedaban en memoria hasta cerrar la app y se iban acumulando al recorrer el juego.
 *
 * Se queda siempre lo compartido, que otras pantallas usan sin cargarlo ellas mismas (si una pantalla nueva lo necesita, que lo pida en su
 * preload): personajes (los maneja NxoActor), emblemas de liga, monedas y dinero, retratos y emotes. Una hoja animada que se libera se
 * lleva también sus animaciones (las vuelve a crear quien la usa, que siempre mira `anims.exists`).
 *
 * Llamar al EMPEZAR el preload de la escena.
 */
const SHARED_URL = [
  'assets/characters/', // personajes: NxoActor.queueNxoSpriteLoads / releaseCharacterSprites
  'assets/emotes/',
  'assets/bronce', 'assets/plata', 'assets/oro', 'assets/platino', 'assets/diamante', 'assets/challenger', // emblemas de liga (RankBadge)
  'assets/moneda', 'assets/dinero', 'assets/monedas', 'assets/billetes',
  'assets/ui/btn-', // botones del partido (queueButtonArt)
  'personajes/', 'assets/retratos', 'portrait',
];
const isShared = (url: string) => SHARED_URL.some((p) => url.includes(p));

export function releaseSceneTexturesOnExit(scene: Phaser.Scene) {
  const own = new Set<string>();
  const onLoad = (file: Phaser.Loader.File) => {
    if ((file.type === 'image' || file.type === 'spritesheet') && typeof file.url === 'string' && !isShared(file.url)) own.add(file.key);
  };
  scene.load.on(Phaser.Loader.Events.FILE_LOAD, onLoad);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.load.off(Phaser.Loader.Events.FILE_LOAD, onLoad);
    if (!own.size) return;
    // animaciones hechas con esas texturas (p. ej. aros de carga y bolas de la ULTI de la vista previa)
    for (const k of own) for (const a of scene.anims.getAnimsFromTexture(k)) scene.anims.remove(a);
    for (const k of own) if (scene.textures.exists(k)) scene.textures.remove(k);
  });
}
