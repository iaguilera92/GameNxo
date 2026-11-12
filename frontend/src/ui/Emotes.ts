import Phaser from 'phaser';
import { C } from './theme';
import { EMOTES, type EmoteKind } from '../domain/emotes';

/**
 * EMOTES del partido (estilo Brawl Stars): un botón de charla abre 3 caritas; al elegir una sale un globo con
 * la carita sobre la cabeza del jugador. Después hay una espera de 10 s (el botón se apaga con la cuenta atrás).
 * Los rostros usan los stickers de Nxo. El botón y el panel son de interfaz (scrollFactor 0); el globo vive en
 * el mundo y sigue la cabeza del jugador.
 */
export const EMOTE_COOLDOWN_MS = 10000;
const BUBBLE_MS = 2200;
const PANEL_AUTOCLOSE_MS = 4000;

export type { EmoteKind } from '../domain/emotes';
export { EMOTES } from '../domain/emotes';

/** Textura de cada emote: miniaturas de 160 px (tools/build-emote-thumbs.mjs; fuentes en personajes/Nxo/emojis/). */
export const EMOTE_TEXTURE: Record<EmoteKind, string> = {
  happy: 'emote-risa',
  cool: 'emote-pensando',
  wow: 'emote-enojado',
};

/** Encola las miniaturas de los emotes que falten (partido, Pase de Batalla). */
export function queueEmoteArt(load: Phaser.Loader.LoaderPlugin) {
  for (const key of Object.values(EMOTE_TEXTURE)) if (!load.scene.textures.exists(key)) load.image(key, `assets/emotes/${key}.png`);
}

export class Emotes {
  /** botón de charla (posicionar con setPosition) */
  readonly button: Phaser.GameObjects.Container;
  private readonly panel: Phaser.GameObjects.Container;
  private readonly options: Phaser.GameObjects.Container[] = [];
  private readonly cdShade: Phaser.GameObjects.Graphics;
  private readonly cdText: Phaser.GameObjects.Text;
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
    this.button.add([g, this.cdShade, this.cdText]);
    this.button.setSize(R * 2 + 16, R * 2 + 16);
    this.button.setInteractive({ useHandCursor: true });
    this.button.on('pointerdown', () => this.toggle());

    // panel con las 3 caritas, desplegado hacia la izquierda del botón
    this.panel = scene.add.container(0, 0).setScrollFactor(0).setDepth(depth + 1).setVisible(false);
    kinds.forEach((kind, i) => {
      const o = scene.add.container(-(i + 1) * 76, 0);
      const bg = scene.add.graphics();
      bg.fillStyle(C.outline, 0.85).fillCircle(0, 3, 33);
      const face = scene.add.image(0, 0, EMOTE_TEXTURE[kind]).setDisplaySize(54, 54);
      o.add([bg, face]);
      o.setSize(66, 66);
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

  setPosition(x: number, y: number) {
    this.button.setPosition(x, y);
    this.panel.setPosition(x, y);
  }

  setVisible(on: boolean) {
    this.button.setVisible(on && !this.none);
    if (!on) this.close();
  }

  /** ¿se puede mandar un emote ahora mismo? */
  get ready() {
    return performance.now() >= this.readyAt;
  }

  private toggle() {
    this.scene.tweens.add({ targets: this.button, scale: { from: 0.88, to: 1 }, duration: 220, ease: 'Back.easeOut' });
    if (this.open) return this.close();
    if (!this.ready) return;
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
  showRemote(kind: string, head: () => { x: number; y: number }) {
    if (!(EMOTES as string[]).includes(kind)) return; // llega por red: solo las 3 caritas conocidas
    this.remote?.c.destroy();
    const c = this.makeBubble(kind as EmoteKind);
    this.remote = { c, until: performance.now() + BUBBLE_MS, head };
    const h = head();
    c.setPosition(h.x, h.y - 14).setScale(0.2);
    this.scene.tweens.add({ targets: c, scale: 1, duration: 260, ease: 'Back.easeOut' });
  }

  private showBubble(kind: EmoteKind) {
    this.bubble?.destroy();
    const c = this.makeBubble(kind);
    this.bubble = c;
    this.bubbleUntil = performance.now() + BUBBLE_MS;
    this.place();
    c.setScale(0.2);
    this.scene.tweens.add({ targets: c, scale: 1, duration: 260, ease: 'Back.easeOut' });
  }

  /** Globo con la carita (sin posicionar). */
  private makeBubble(kind: EmoteKind) {
    const c = this.scene.add.container(0, 0).setDepth(4100);
    const g = this.scene.add.graphics();
    // (11-11-2026) 1,5× más grande: en el partido apenas se veía
    const W = 116, H = 104;
    g.fillStyle(C.outline).fillRoundedRect(-W / 2 - 5, -H - 5, W + 10, H + 10, 28);
    g.fillStyle(C.outline).fillTriangle(-20, -2, 20, -2, 0, 26);
    g.fillStyle(0xffffff).fillRoundedRect(-W / 2, -H, W, H, 24);
    g.fillStyle(0xffffff).fillTriangle(-14, -5, 14, -5, 0, 18);
    const face = this.scene.add.image(0, -H / 2, EMOTE_TEXTURE[kind]).setDisplaySize(88, 88);
    c.add([g, face]);
    return c;
  }

  private place() {
    if (!this.bubble) return;
    const h = this.head();
    this.bubble.setPosition(h.x, h.y - 14);
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
        r.c.setPosition(h.x, h.y - 14);
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
