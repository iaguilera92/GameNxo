import Phaser from 'phaser';
import { C } from './theme';

/**
 * EMOTES del partido (estilo Brawl Stars): un botón de charla abre 3 caritas; al elegir una sale un globo con
 * la carita sobre la cabeza del jugador. Después hay una espera de 10 s (el botón se apaga con la cuenta atrás).
 * Todo se dibuja por código (sin imágenes). El botón y el panel son de interfaz (scrollFactor 0); el globo vive en
 * el mundo y sigue la cabeza del jugador.
 */
export const EMOTE_COOLDOWN_MS = 10000;
const BUBBLE_MS = 2200;
const PANEL_AUTOCLOSE_MS = 4000;

export type EmoteKind = 'happy' | 'cool' | 'wow';
export const EMOTES: EmoteKind[] = ['happy', 'cool', 'wow'];

/** Carita redonda centrada en (0,0) de radio r. */
function drawFace(g: Phaser.GameObjects.Graphics, kind: EmoteKind, r: number) {
  const o = Math.max(2, r * 0.1);
  g.fillStyle(C.outline).fillCircle(0, 0, r + o);
  g.fillStyle(C.yellowDark).fillCircle(0, r * 0.06, r);
  g.fillStyle(C.yellow).fillCircle(0, 0, r * 0.94);
  g.fillStyle(0xffffff, 0.35).fillEllipse(-r * 0.22, -r * 0.62, r * 0.9, r * 0.32);
  const ink = C.outline;
  if (kind === 'happy') {
    // ojos cerrados sonrientes + boca grande
    g.lineStyle(r * 0.14, ink).beginPath().arc(-r * 0.36, -r * 0.18, r * 0.17, Math.PI, 0, false).strokePath();
    g.lineStyle(r * 0.14, ink).beginPath().arc(r * 0.36, -r * 0.18, r * 0.17, Math.PI, 0, false).strokePath();
    g.fillStyle(ink).fillPoints(arcPoints(0, r * 0.12, r * 0.52, 0, Math.PI), true);
    g.fillStyle(0xff6b7a).fillEllipse(0, r * 0.45, r * 0.5, r * 0.2);
  } else if (kind === 'cool') {
    // gafas oscuras + media sonrisa
    g.fillStyle(ink).fillRoundedRect(-r * 0.7, -r * 0.34, r * 0.6, r * 0.38, r * 0.1);
    g.fillStyle(ink).fillRoundedRect(r * 0.1, -r * 0.34, r * 0.6, r * 0.38, r * 0.1);
    g.fillStyle(ink).fillRect(-r * 0.12, -r * 0.28, r * 0.24, r * 0.08);
    g.fillStyle(0xffffff, 0.55).fillRect(-r * 0.58, -r * 0.28, r * 0.16, r * 0.07);
    g.fillStyle(0xffffff, 0.55).fillRect(r * 0.22, -r * 0.28, r * 0.16, r * 0.07);
    g.lineStyle(r * 0.13, ink).beginPath().arc(0, r * 0.12, r * 0.44, 0.2, Math.PI - 0.55, false).strokePath();
  } else {
    // asombro: ojos redondos y boca en "o"
    for (const sx of [-1, 1]) {
      g.fillStyle(0xffffff).fillCircle(sx * r * 0.36, -r * 0.2, r * 0.22);
      g.lineStyle(r * 0.07, ink).strokeCircle(sx * r * 0.36, -r * 0.2, r * 0.22);
      g.fillStyle(ink).fillCircle(sx * r * 0.36, -r * 0.18, r * 0.09);
    }
    g.fillStyle(ink).fillEllipse(0, r * 0.45, r * 0.34, r * 0.44);
    g.fillStyle(0xff6b7a).fillEllipse(0, r * 0.52, r * 0.2, r * 0.2);
    g.lineStyle(r * 0.1, ink).lineBetween(-r * 0.58, -r * 0.55, -r * 0.2, -r * 0.62);
    g.lineStyle(r * 0.1, ink).lineBetween(r * 0.2, -r * 0.62, r * 0.58, -r * 0.55);
  }
}

function arcPoints(cx: number, cy: number, rad: number, a0: number, a1: number) {
  const pts: Phaser.Math.Vector2[] = [];
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push(new Phaser.Math.Vector2(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad));
  }
  return pts;
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

  /** `head`: posición actual (mundo) sobre la que sale el globo. */
  constructor(private scene: Phaser.Scene, private head: () => { x: number; y: number }, depth = 5600) {
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
    EMOTES.forEach((kind, i) => {
      const o = scene.add.container(-(i + 1) * 76, 0);
      const bg = scene.add.graphics();
      bg.fillStyle(C.outline, 0.85).fillCircle(0, 3, 33);
      const face = scene.add.graphics();
      drawFace(face, kind, 25);
      o.add([bg, face]);
      o.setSize(66, 66);
      o.setInteractive({ useHandCursor: true });
      o.on('pointerdown', () => this.send(kind));
      if (o.input) o.input.enabled = false; // cerrado: no recoge toques
      this.options.push(o);
      this.panel.add(o);
    });

    scene.events.on(Phaser.Scenes.Events.UPDATE, this.update, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  setPosition(x: number, y: number) {
    this.button.setPosition(x, y);
    this.panel.setPosition(x, y);
  }

  setVisible(on: boolean) {
    this.button.setVisible(on);
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
    const W = 78, H = 70;
    g.fillStyle(C.outline).fillRoundedRect(-W / 2 - 4, -H - 4, W + 8, H + 8, 20);
    g.fillStyle(C.outline).fillTriangle(-14, -2, 14, -2, 0, 18);
    g.fillStyle(0xffffff).fillRoundedRect(-W / 2, -H, W, H, 17);
    g.fillStyle(0xffffff).fillTriangle(-10, -4, 10, -4, 0, 12);
    const face = this.scene.add.graphics().setPosition(0, -H / 2);
    drawFace(face, kind, 25);
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
