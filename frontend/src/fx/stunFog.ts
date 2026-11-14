import Phaser from 'phaser';

/**
 * NIEBLA DEL ATURDIDO (14-11-2026): mientras el JUGADOR está aturdido (ESPECIAL / ULTI recibidos) pierde visión: todo se
 * ve difuso y velado, salvo un círculo claro alrededor de su personaje. Es leve: se sigue viendo algo de la cancha.
 * Solo en el teléfono del aturdido (el rival no la ve). Barata: una sola imagen con degradado radial (sin shaders, que
 * en la APK dan problemas), que sigue al personaje y late suave.
 */
const KEY = 'stun-fog';
const SIZE = 512;
/** radio claro (fracción del radio de la textura) y opacidad máxima del velo en los bordes */
const CLEAR = 0.14;
const MAX_ALPHA = 0.55;
/** DESENFOQUE real de la cámara del juego (WebGL; el marcador y los botones van en otra cámara y quedan nítidos) */
const BLUR_MAX = 2.4;
/** la niebla se desvanece durante el último tramo del aturdido (ms) */
const FADE_OUT_MS = 1000;

function ensureTexture(scene: Phaser.Scene) {
  if (scene.textures.exists(KEY)) return;
  const tex = scene.textures.createCanvas(KEY, SIZE, SIZE);
  const ctx = tex?.getContext();
  if (!tex || !ctx) return;
  const r = SIZE / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  // degradado suave y continuo (sin manchas): claro alrededor del personaje y velado hacia los bordes
  g.addColorStop(0, 'rgba(22, 28, 50, 0)');
  g.addColorStop(CLEAR, 'rgba(22, 28, 50, 0)');
  g.addColorStop(CLEAR + 0.1, 'rgba(24, 30, 54, 0.3)');
  g.addColorStop(0.4, 'rgba(26, 32, 58, 0.62)');
  g.addColorStop(0.7, 'rgba(28, 34, 62, 0.82)');
  g.addColorStop(1, 'rgba(30, 36, 64, 0.92)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SIZE, SIZE);
  tex.refresh();
}

export class StunFog {
  private img: Phaser.GameObjects.Image;
  private until = 0;
  private k = 0;
  private blur: Phaser.FX.Blur | null = null;
  /**
   * Cámara NÍTIDA solo para el personaje aturdido (sin desenfoque ni velo): la principal (desenfocada) deja de dibujarlo y
   * esta, encima de la principal y bajo la interfaz, lo dibuja como siempre. Las cámaras se reparten los objetos con
   * cameraFilter (view/uiCamera.ts lo recalcula antes de cada render; aquí se ajusta después).
   */
  private sharp: Phaser.Cameras.Scene2D.Camera | null = null;

  constructor(private scene: Phaser.Scene, private target: () => Phaser.GameObjects.GameObject) {
    ensureTexture(scene);
    // por encima de la cancha y los personajes, bajo la interfaz (botones y marcador van en profundidades ≥ 5000)
    this.img = scene.add.image(0, 0, KEY).setDepth(4600).setAlpha(0).setVisible(false);
    scene.events.on(Phaser.Scenes.Events.PRE_RENDER, this.filter, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.PRE_RENDER, this.filter, this));
  }

  /** Reparto de objetos entre cámaras mientras dura: el personaje solo en la nítida; el resto, nunca en la nítida. */
  private filter() {
    const sh = this.sharp;
    if (!sh) return;
    const main = this.scene.cameras.main;
    const t = this.target();
    for (const o of this.scene.children.list) {
      if (o === t) o.cameraFilter = (o.cameraFilter | main.id) & ~sh.id; // ni la principal ni la de interfaz: la nítida
      else o.cameraFilter |= sh.id;
    }
  }

  private addSharp() {
    const mgr = this.scene.cameras;
    const cam = mgr.add(0, 0, this.scene.scale.width, this.scene.scale.height, false, 'stun-sharp');
    cam.transparent = true;
    // justo encima de la principal (debajo de la interfaz)
    const list = mgr.cameras;
    list.splice(list.indexOf(cam), 1);
    list.splice(list.indexOf(mgr.main) + 1, 0, cam);
    this.sharp = cam;
  }

  private removeSharp() {
    if (!this.sharp) return;
    const t = this.target();
    t.cameraFilter &= ~this.scene.cameras.main.id; // vuelve a la principal (uiCamera lo reclasifica igual)
    this.scene.cameras.remove(this.sharp, true);
    this.sharp = null;
  }

  /** Empieza (o alarga) la niebla durante `ms`. */
  start(ms: number) {
    this.until = Math.max(this.until, this.scene.time.now + ms);
  }

  /** Quita la niebla ya (punto nuevo). */
  clear() {
    this.until = 0;
  }
  // (el desenfoque se quita solo cuando la niebla termina de apagarse: update)

  /** Cada fotograma: centrada en el personaje (`x`, `y` = pantalla), tamaño según la cámara, entra y sale suave. */
  update(dt: number, x: number, y: number) {
    const left = this.until - this.scene.time.now;
    const on = left > 0;
    // entra rápido; en el ÚLTIMO SEGUNDO del aturdido se va desvaneciendo (vuelve la visión de a poco)
    const want = on ? Math.min(1, left / FADE_OUT_MS) : 0;
    this.k += (want - this.k) * Math.min(1, dt * 8);
    const cam = this.scene.cameras.main;
    if (this.k < 0.01 && !on) {
      if (this.img.visible) this.img.setVisible(false);
      this.k = 0;
      if (this.blur) {
        cam.postFX?.remove(this.blur);
        this.blur = null;
      }
      this.removeSharp();
      return;
    }
    if (!this.sharp) this.addSharp();
    // la nítida sigue a la principal (mismo encuadre)
    this.sharp!.setScroll(cam.scrollX, cam.scrollY).setZoom(cam.zoom).setSize(cam.width, cam.height);
    // desenfoque de toda la cancha (solo WebGL); sube y baja con la niebla
    if (!this.blur && this.scene.renderer.type === Phaser.WEBGL && cam.postFX) this.blur = cam.postFX.addBlur(0, 2, 2, 0);
    if (this.blur) this.blur.strength = BLUR_MAX * this.k;
    // cubre toda la vista aunque el personaje esté en un borde
    const cover = Math.hypot(cam.worldView.width, cam.worldView.height) * 2.2;
    const pulse = 1 + Math.sin(this.scene.time.now / 380) * 0.04;
    this.img
      .setVisible(true)
      .setPosition(x, y)
      .setDisplaySize(cover * pulse, cover * pulse)
      .setAlpha(MAX_ALPHA * this.k);
  }

  destroy() {
    this.removeSharp();
    if (this.blur) this.scene.cameras.main.postFX?.remove(this.blur);
    this.blur = null;
    this.img.destroy();
  }
}
