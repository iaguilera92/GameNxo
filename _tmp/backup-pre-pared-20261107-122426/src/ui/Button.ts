import Phaser from 'phaser';
import { C, textStyle } from './theme';

/** Botón con relieve, contorno grueso, brillo y animación de rebote al pulsar. */
export class Button extends Phaser.GameObjects.Container {
  private content: Phaser.GameObjects.Container;
  private pressed = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    fill: number,
    fillDark: number,
    onClick: () => void,
    fontSize = Math.round(h * 0.5),
  ) {
    super(scene, x, y);
    this.content = scene.add.container(0, 0);
    this.add(this.content);

    const r = Math.min(22, h / 2 - 2);
    const depth = Math.round(h * 0.12);
    const g = scene.add.graphics();
    // contorno (incluye la base del relieve)
    g.fillStyle(C.outline, 1);
    g.fillRoundedRect(-w / 2 - 6, -h / 2 - 6, w + 12, h + 12 + depth, r + 6);
    // relieve inferior
    g.fillStyle(fillDark, 1);
    g.fillRoundedRect(-w / 2, -h / 2 + depth, w, h, r);
    // cara superior
    g.fillStyle(fill, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, r);
    // brillo
    g.fillStyle(0xffffff, 0.35);
    g.fillRoundedRect(-w / 2 + 10, -h / 2 + 6, w - 20, h * 0.34, Math.min(r * 0.7, h * 0.17));
    this.content.add(g);

    const t = scene.add.text(0, -2, label, textStyle(fontSize)).setOrigin(0.5);
    this.content.add(t);

    this.setSize(w + 12, h + 12 + depth);
    this.setInteractive({ useHandCursor: true });

    this.on('pointerdown', () => {
      this.pressed = true;
      scene.tweens.killTweensOf(this.content);
      scene.tweens.add({ targets: this.content, scale: 0.88, duration: 70, ease: 'Quad.easeOut' });
    });
    const release = (fire: boolean) => {
      if (!this.pressed) return;
      this.pressed = false;
      scene.tweens.killTweensOf(this.content);
      scene.tweens.add({
        targets: this.content,
        scale: 1,
        duration: 260,
        ease: 'Back.easeOut',
        easeParams: [3],
        onComplete: () => {
          if (fire) onClick();
        },
      });
    };
    this.on('pointerup', () => release(true));
    this.on('pointerout', () => release(false));

    scene.add.existing(this);
  }

  /** Animación de "respiración" para llamar la atención. */
  pulse(): this {
    this.scene.tweens.add({ targets: this, scale: 1.06, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return this;
  }
}
