import Phaser from 'phaser';
import { C } from './theme';
import { BUTTON_ART } from './buttonArt';
import { EMOTES, type EmoteKind } from '../domain/emotes';

/**
 * EMOTES del partido (estilo Brawl Stars): un botón de charla abre 3 caritas; al elegir una sale un globo con
 * la carita sobre la cabeza del jugador. Después hay una espera de 10 s (el botón se apaga con la cuenta atrás).
 * Los rostros usan los stickers de Nxo. El botón y el panel son de interfaz (scrollFactor 0); el globo vive en
 * el mundo y sigue la cabeza del jugador.
 */
export const EMOTE_COOLDOWN_MS = 10000;
const BUBBLE_MS = 2200;
/** (17-11-2026, usuario) el globo del RIVAL va más arriba de su cabeza (antes 14 px: chocaba con ella; el rival está al fondo, más chico) */
const REMOTE_LIFT = 40;
/** (18-11-2026, usuario) el globo PROPIO va bien arriba de la cabeza (con 14 px quedaba encima del personaje, tapándolo) */
const SELF_LIFT = 80;
const PANEL_AUTOCLOSE_MS = 4000;

export type { EmoteKind } from '../domain/emotes';
export { EMOTES } from '../domain/emotes';

/** Textura de cada emote: miniaturas de 160 px (tools/build-emote-thumbs.mjs; fuentes en personajes/Nxo/emojis/). NXO = emote-nxo-<nombre>. */
export const EMOTE_TEXTURE: Record<EmoteKind, string> = {
  // (18-11-2026, usuario) nombres con el personaje (emote-nxo-…, emote-mai-…): habrá más personajes
  happy: 'emote-nxo-risa',
  cool: 'emote-nxo-pensando',
  wow: 'emote-nxo-enojado',
  cry: 'emote-nxo-llorando',
  shades: 'emote-nxo-legendario-lentes', // LEGENDARIOS animados (EMOTE_ANIM)
  treasure: 'emote-nxo-legendario-tesoro',
};

/**
 * (18-11-2026, usuario) Emotes LEGENDARIOS ANIMADOS: hoja de 8 frames (tools/build-anim-sheet.mjs; fuente en personajes/Nxo/emojis/animados/).
 * `intro` se ve una vez al salir el globo y `loop` se repite hasta que se va; el panel muestra `still`. El globo dura más y lleva borde dorado.
 */
export const EMOTE_ANIM: Partial<Record<EmoteKind, { cell: number; intro: number[]; loop: number[]; fps: number; still: number }>> = {
  shades: { cell: 192, intro: [0, 1, 2, 3, 3], loop: [4, 5, 6, 7], fps: 8, still: 3 },
  treasure: { cell: 192, intro: [0, 1, 2, 3, 3], loop: [4, 5, 6, 7], fps: 8, still: 3 },
};
const LEGEND_BUBBLE_MS = 3600;
const isAnim = (k: EmoteKind) => !!EMOTE_ANIM[k];

/** Crea (una vez) las animaciones de los emotes animados. */
export function ensureEmoteAnims(scene: Phaser.Scene) {
  for (const [kind, a] of Object.entries(EMOTE_ANIM)) {
    // la hoja de NXO y la de MAI (misma distribución de frames)
    for (const key of [EMOTE_TEXTURE[kind as EmoteKind], MAI_EMOTE_TEXTURE[kind as EmoteKind]]) {
      if (!a || !key || !scene.textures.exists(key)) continue;
      if (!scene.anims.exists(`${key}-intro`)) scene.anims.create({ key: `${key}-intro`, frames: scene.anims.generateFrameNumbers(key, { frames: a.intro }), frameRate: a.fps });
      if (!scene.anims.exists(`${key}-loop`)) scene.anims.create({ key: `${key}-loop`, frames: scene.anims.generateFrameNumbers(key, { frames: a.loop }), frameRate: a.fps, repeat: -1 });
    }
  }
}

/**
 * (18-11-2026, usuario) Caritas de MAI (tools/build-emote-thumbs.mjs; fuentes en personajes/Mai/emotes/): si juega con Mai, el globo lleva SU
 * cara; las que aún no existen usan la de NXO. Agregar aquí cada una cuando llegue.
 */
export const MAI_EMOTE_TEXTURE: Partial<Record<EmoteKind, string>> = {
  happy: 'emote-mai-risa',
  cool: 'emote-mai-pensando',
  wow: 'emote-mai-enojada',
  cry: 'emote-mai-llorando',
  // (18-11-2026, usuario) LEGENDARIO TESORO de MAI (levanta la moneda); LENTES aún no tiene versión de Mai (usa la de NXO)
  treasure: 'emote-mai-legendario-tesoro',
};

/** Textura del emote para un personaje (Mai: la suya si existe; si no, la de NXO). */
export function emoteTexture(scene: Phaser.Scene, kind: EmoteKind, skin = 'nxo'): string {
  const mai = skin.startsWith('mai') ? MAI_EMOTE_TEXTURE[kind] : undefined;
  return mai && scene.textures.exists(mai) ? mai : EMOTE_TEXTURE[kind];
}

/** Encola las miniaturas de los emotes que falten (partido, Pase de Batalla). */
export function queueEmoteArt(load: Phaser.Loader.LoaderPlugin) {
  for (const [kind, key] of Object.entries(EMOTE_TEXTURE)) {
    if (load.scene.textures.exists(key)) continue;
    const a = EMOTE_ANIM[kind as EmoteKind];
    if (a) load.spritesheet(key, `assets/emotes/${key}.webp`, { frameWidth: a.cell, frameHeight: a.cell });
    else load.image(key, `assets/emotes/${key}.webp`); // (25-11-2026) miniaturas en WebP
  }
  for (const [kind, key] of Object.entries(MAI_EMOTE_TEXTURE)) {
    if (!key || load.scene.textures.exists(key)) continue;
    const a = EMOTE_ANIM[kind as EmoteKind];
    if (a) load.spritesheet(key, `assets/emotes/${key}.webp`, { frameWidth: a.cell, frameHeight: a.cell });
    else load.image(key, `assets/emotes/${key}.webp`); // (25-11-2026) miniaturas en WebP
  }
}

/** Imagen fija de un emote (los animados, en su frame `still`): panel, Pase de Batalla. */
export function emoteStill(scene: Phaser.Scene, x: number, y: number, kind: EmoteKind, skin = 'nxo') {
  const a = EMOTE_ANIM[kind];
  return scene.add.image(x, y, emoteTexture(scene, kind, skin), a ? a.still : undefined);
}

export class Emotes {
  /** botón de charla (posicionar con setPosition) */
  readonly button: Phaser.GameObjects.Container;
  private readonly panel: Phaser.GameObjects.Container;
  private readonly options: Phaser.GameObjects.Container[] = [];
  private readonly cdShade: Phaser.GameObjects.Graphics;
  private readonly cdText: Phaser.GameObjects.Text;
  private btnArt?: Phaser.GameObjects.Image;
  private bubble?: Phaser.GameObjects.Container;
  private bubbleUntil = 0;
  /** globo del emote del rival (multijugador) */
  private remote?: { c: Phaser.GameObjects.Container; until: number; head: () => { x: number; y: number } };
  /** multijugador: se llama al enviar un emote propio (para avisar al rival) */
  onSend?: (kind: EmoteKind) => void;
  private readyAt = 0;
  private open = false;
  private closeTimer?: Phaser.Time.TimerEvent;
  private static readonly R = 30;
  /** (21-11-2026, usuario) con la imagen del botón (btn-emotes) se ve OPACO en reposo (no estorba la vista) y se aclara del todo al pulsarlo */
  private static readonly IDLE_ALPHA = 0.4;
  /** (21-11-2026, usuario) panel en CUADRÍCULA de 4 columnas × 2 filas (hasta 8 emotes) y más grande (antes una fila de 6 con caritas de 54 px): paso entre celdas, cara y zona táctil */
  private static readonly COLS = 4;
  private static readonly CELL = 88;
  private static readonly FACE = 68;
  /** personaje del jugador y del rival: el globo lleva la cara de cada uno (Mai / NXO); el panel, la del jugador */
  mySkin = 'nxo';
  rivalSkin = 'nxo';

  /** sin ningún emote desbloqueado no hay botón (los del rival se ven igual) */
  private readonly none: boolean;

  /**
   * `head`: posición actual (mundo) sobre la que sale el globo. `kinds`: los emotes que tiene el jugador (se ganan en el
   * Pase de Batalla); el panel solo muestra esos.
   */
  constructor(private scene: Phaser.Scene, private head: () => { x: number; y: number }, kinds: readonly EmoteKind[] = EMOTES, depth = 5600) {
    this.none = kinds.length === 0;
    const R = Emotes.R;
    this.button = scene.add.container(0, 0).setScrollFactor(0).setDepth(depth);
    const g = scene.add.graphics();
    g.fillStyle(C.outline).fillCircle(0, 4, R + 6);
    g.fillStyle(C.blueDark).fillCircle(0, 5, R);
    g.fillStyle(C.blue).fillCircle(0, 0, R - 2);
    g.fillStyle(0xffffff, 0.3).fillEllipse(-4, -13, 34, 12);
    // globo de charla con tres puntos
    g.fillStyle(C.outline).fillRoundedRect(-20, -17, 40, 29, 11);
    g.fillStyle(C.outline).fillTriangle(-12, 8, -2, 8, -14, 21);
    g.fillStyle(0xffffff).fillRoundedRect(-17, -14, 34, 23, 9);
    g.fillStyle(0xffffff).fillTriangle(-11, 6, -3, 6, -12, 17);
    g.fillStyle(C.blueDark);
    for (const x of [-8, 0, 8]) g.fillCircle(x, -2, 3);
    this.cdShade = scene.add.graphics();
    this.cdText = scene.add.text(0, 0, '', { fontFamily: '"Lilita One", "Arial Black", sans-serif', fontSize: '26px', color: '#ffffff', stroke: '#1a1033', strokeThickness: 5 }).setOrigin(0.5);
    // (21-11-2026, usuario) la imagen del botón (BUTTON_ART.emotes) en vez del dibujo; sin ella, el dibujo de siempre
    if (scene.textures.exists(BUTTON_ART.emotes.key)) {
      g.destroy();
      this.btnArt = scene.add.image(0, 0, BUTTON_ART.emotes.key).setDisplaySize(R * 2 + 12, R * 2 + 12).setAlpha(Emotes.IDLE_ALPHA);
      this.button.add([this.btnArt, this.cdShade, this.cdText]);
    } else this.button.add([g, this.cdShade, this.cdText]);
    this.button.setSize(R * 2 + 16, R * 2 + 16);
    this.button.setInteractive({ useHandCursor: true });
    this.button.on('pointerdown', () => this.toggle());

    // panel con las caritas en cuadrícula (4 por fila, hasta 2 filas): la 1.ª fila a la izquierda del botón y la 2.ª debajo
    this.panel = scene.add.container(0, 0).setScrollFactor(0).setDepth(depth + 1).setVisible(false);
    const CELL = Emotes.CELL;
    const FACE = Emotes.FACE;
    kinds.slice(0, Emotes.COLS * 2).forEach((kind, i) => {
      const o = scene.add.container(-((i % Emotes.COLS) + 1) * CELL, Math.floor(i / Emotes.COLS) * CELL);
      const bg = scene.add.graphics();
      bg.fillStyle(C.outline, 0.88).fillCircle(0, 3, 41);
      const face = emoteStill(scene, 0, 0, kind).setDisplaySize(FACE, FACE);
      if (isAnim(kind)) bg.lineStyle(3.5, 0xffd23f, 1).strokeCircle(0, 3, 41); // LEGENDARIO: aro dorado
      o.setData('face', face).setData('kind', kind);
      o.add([bg, face]);
      o.setSize(CELL - 4, CELL - 4);
      o.setInteractive({ useHandCursor: true });
      o.on('pointerdown', () => this.send(kind));
      if (o.input) o.input.enabled = false; // cerrado: no recoge toques
      this.options.push(o);
      this.panel.add(o);
    });

    if (this.none) this.button.setVisible(false);

    scene.events.on(Phaser.Scenes.Events.UPDATE, this.update, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  /** Personajes del jugador y del rival (18-11-2026): las caritas del panel y de los globos usan la cara de cada uno. */
  setSkins(me: string, rival: string) {
    this.mySkin = me;
    this.rivalSkin = rival;
    for (const o of this.options) {
      const face = o.getData('face') as Phaser.GameObjects.Image | undefined;
      if (face) face.setTexture(emoteTexture(this.scene, o.getData('kind') as EmoteKind, me), EMOTE_ANIM[o.getData('kind') as EmoteKind]?.still).setDisplaySize(Emotes.FACE, Emotes.FACE);
    }
  }

  setPosition(x: number, y: number) {
    this.button.setPosition(x, y);
    this.panel.setPosition(x, y);
  }

  /** (21-11-2026, usuario) atenúa el botón de emotes (mientras dura la ULTI); el panel abierto no se toca. */
  setAlpha(a: number) {
    this.button.setAlpha(a);
  }

  setVisible(on: boolean) {
    this.button.setVisible(on && !this.none);
    if (!on) this.close();
  }

  /** ¿se puede mandar un emote ahora mismo? */
  get ready() {
    return performance.now() >= this.readyAt;
  }

  /** aclara el botón (al pulsarlo) o lo devuelve a su opacidad de reposo */
  private light(on: boolean) {
    if (!this.btnArt) return;
    this.scene.tweens.killTweensOf(this.btnArt);
    this.scene.tweens.add({ targets: this.btnArt, alpha: on ? 1 : Emotes.IDLE_ALPHA, duration: on ? 120 : 350 });
  }

  private toggle() {
    this.scene.tweens.add({ targets: this.button, scale: { from: 0.88, to: 1 }, duration: 220, ease: 'Back.easeOut' });
    this.light(true);
    if (this.open) return this.close();
    if (!this.ready) {
      this.scene.time.delayedCall(900, () => !this.open && this.light(false)); // en espera: se aclara un momento y vuelve a su opacidad
      return;
    }
    this.open = true;
    this.panel.setVisible(true);
    this.options.forEach((o) => o.input && (o.input.enabled = true));
    this.options.forEach((o, i) => {
      o.setScale(0.2).setAlpha(0);
      this.scene.tweens.add({ targets: o, scale: 1, alpha: 1, delay: i * 45, duration: 220, ease: 'Back.easeOut' });
    });
    this.closeTimer?.remove();
    this.closeTimer = this.scene.time.delayedCall(PANEL_AUTOCLOSE_MS, () => this.close());
  }

  private close() {
    this.open = false;
    this.light(false);
    this.closeTimer?.remove();
    this.panel.setVisible(false);
    this.options.forEach((o) => o.input && (o.input.enabled = false));
  }

  /** Muestra el emote sobre el jugador e inicia la espera de 10 s. */
  send(kind: EmoteKind) {
    if (!this.ready) return;
    this.close();
    this.readyAt = performance.now() + EMOTE_COOLDOWN_MS;
    this.showBubble(kind);
    this.onSend?.(kind);
  }

  /**
   * Emote del RIVAL (multijugador): globo sobre SU cabeza, sin botón ni espera (la espera de 10 s es del emisor).
   * Un solo globo remoto a la vez: uno nuevo sustituye al anterior (no se acumulan aunque lleguen muchos).
   */
  showRemote(kind: string, head: () => { x: number; y: number }, skin = this.rivalSkin) {
    if (!(EMOTES as string[]).includes(kind)) return; // llega por red: solo las caritas conocidas
    this.remote?.c.destroy();
    const c = this.makeBubble(kind as EmoteKind, skin); // (19-11-2026) 2v2 online: el del COMPAÑERO, con su cara
    this.remote = { c, until: performance.now() + (isAnim(kind as EmoteKind) ? LEGEND_BUBBLE_MS : BUBBLE_MS), head };
    const h = head();
    c.setPosition(h.x, h.y - REMOTE_LIFT).setScale(0.2);
    this.scene.tweens.add({ targets: c, scale: 1, duration: 260, ease: 'Back.easeOut' });
  }

  private showBubble(kind: EmoteKind) {
    this.bubble?.destroy();
    const c = this.makeBubble(kind, this.mySkin);
    this.bubble = c;
    this.bubbleUntil = performance.now() + (isAnim(kind) ? LEGEND_BUBBLE_MS : BUBBLE_MS);
    this.place();
    c.setScale(0.2);
    this.scene.tweens.add({ targets: c, scale: 1, duration: 260, ease: 'Back.easeOut' });
  }

  /** Globo con la carita (sin posicionar). */
  private makeBubble(kind: EmoteKind, skin: string) {
    const c = this.scene.add.container(0, 0).setDepth(4100);
    const g = this.scene.add.graphics();
    // (11-11-2026) 1,5× más grande: en el partido apenas se veía
    const anim = isAnim(kind);
    // LEGENDARIO: globo algo más grande con borde DORADO
    const W = anim ? 132 : 116, H = anim ? 120 : 104;
    g.fillStyle(anim ? 0xffd23f : C.outline).fillRoundedRect(-W / 2 - 5, -H - 5, W + 10, H + 10, 28);
    g.fillStyle(anim ? 0xffd23f : C.outline).fillTriangle(-20, -2, 20, -2, 0, 26);
    g.fillStyle(0xffffff).fillRoundedRect(-W / 2, -H, W, H, 24);
    g.fillStyle(0xffffff).fillTriangle(-14, -5, 14, -5, 0, 18);
    if (!anim) {
      const face = this.scene.add.image(0, -H / 2, emoteTexture(this.scene, kind, skin)).setDisplaySize(88, 88);
      c.add([g, face]);
      return c;
    }
    // ANIMADO: la entrada una vez y luego la risa en bucle
    ensureEmoteAnims(this.scene);
    const key = emoteTexture(this.scene, kind, skin); // la hoja del personaje (MAI: la suya si existe)
    const spr = this.scene.add.sprite(0, -H / 2, key, 0).setDisplaySize(108, 108);
    c.add([g, spr]);
    if (this.scene.anims.exists(`${key}-intro`)) {
      spr.play(`${key}-intro`);
      spr.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => spr.active && spr.play(`${key}-loop`));
    }
    // destellos dorados alrededor del globo (sus tweens en bucle se quitan al irse el globo)
    c.once(Phaser.GameObjects.Events.DESTROY, () => c.list.forEach((o) => this.scene.tweens.killTweensOf(o)));
    for (let i = 0; i < 4; i++) {
      const st = this.scene.add.star(Phaser.Math.Between(-W / 2, W / 2), -H + Phaser.Math.Between(0, H), 4, 3, 9, 0xffd23f).setBlendMode(Phaser.BlendModes.ADD).setScale(0);
      c.add(st);
      this.scene.tweens.add({ targets: st, scale: { from: 0, to: 1.1 }, alpha: { from: 1, to: 0 }, angle: 90, delay: 200 + i * 260, duration: 600, repeat: -1, repeatDelay: 500 });
    }
    return c;
  }

  private place() {
    if (!this.bubble) return;
    const h = this.head();
    this.bubble.setPosition(h.x, h.y - SELF_LIFT);
  }

  private update() {
    const now = performance.now();
    // el globo sigue la cabeza y se desvanece al final
    if (this.bubble) {
      this.place();
      const left = this.bubbleUntil - now;
      if (left <= 0) {
        this.bubble.destroy();
        this.bubble = undefined;
      } else if (left < 300) this.bubble.setAlpha(left / 300);
    }
    // el globo del rival sigue SU cabeza y se desvanece igual
    if (this.remote) {
      const r = this.remote;
      const left = r.until - now;
      if (left <= 0) {
        r.c.destroy();
        this.remote = undefined;
      } else {
        const h = r.head();
        r.c.setPosition(h.x, h.y - REMOTE_LIFT);
        if (left < 300) r.c.setAlpha(left / 300);
      }
    }
    // cuenta atrás del botón: velo oscuro + segundos
    const wait = this.readyAt - now;
    this.cdShade.clear();
    if (wait > 0) {
      this.cdShade.fillStyle(C.outline, 0.62).fillCircle(0, 0, Emotes.R + 4);
      this.cdText.setText(String(Math.ceil(wait / 1000)));
    } else this.cdText.setText('');
  }

  destroy() {
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.update, this);
    this.closeTimer?.remove();
    this.bubble?.destroy();
    this.bubble = undefined;
    this.remote?.c.destroy();
    this.remote = undefined;
    this.button.destroy();
    this.panel.destroy();
  }
}
