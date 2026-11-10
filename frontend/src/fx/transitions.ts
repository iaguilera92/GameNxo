import Phaser from 'phaser';

/**
 * Transición NEGRA entre pantallas. Casi todas las escenas ya se desvanecen a negro antes de cambiar; las que no
 * (p. ej. el contador de gemas → Tienda, revancha, resultados) hacían un corte seco. Aquí se intercepta
 * `scene.start()`: si la escena que cambia no se está desvaneciendo ya, se desvanece a negro ~180 ms y luego cambia.
 * La pantalla nueva entra con su propio fadeIn desde negro. Las escenas que ya hacen su fadeOut no se tocan.
 */
const FADE_MS = 180;
const pending = new WeakSet<Phaser.Scenes.ScenePlugin>();

export function installBlackTransitions() {
  type StartFn = (key?: string | Phaser.Scene, data?: object) => Phaser.Scenes.ScenePlugin;
  const proto = Phaser.Scenes.ScenePlugin.prototype as unknown as { start: StartFn; __nxoFade?: boolean };
  if (proto.__nxoFade) return;
  proto.__nxoFade = true;
  const orig = proto.start;
  proto.start = function (this: Phaser.Scenes.ScenePlugin, key?: string | Phaser.Scene, data?: object) {
    const sys = this.systems;
    const cam = sys?.cameras?.main;
    const fx = cam?.fadeEffect;
    // escena sin cámara/no activa, o que ya se desvanece a negro (lo hizo ella): cambio inmediato, como antes
    if (!cam || !sys.isActive() || (fx && fx.direction && (fx.isRunning || fx.isComplete))) return orig.call(this, key, data);
    if (pending.has(this)) return this; // otro toque mientras se desvanece: ya hay un cambio en marcha
    pending.add(this);
    cam.fadeOut(FADE_MS, 0, 0, 0);
    // reloj real (no el de la escena): el cambio ocurre aunque la escena esté pausada
    setTimeout(() => {
      pending.delete(this);
      if (sys.isActive()) orig.call(this, key, data); // si la escena ya se cerró por otro camino, no se arranca nada
    }, FADE_MS + 20);
    return this;
  } as StartFn;
}