import Phaser from 'phaser';
import { Button } from '../ui/Button';
import { C, drawBackground, restartOnResize, textStyle } from '../ui/theme';
import { Character, PLAYER_LOOK } from '../objects/Character';
import { GAME_NAME } from '../config';
import { getProfile } from '../logic/Profile';
import { LevelBadge } from '../ui/LevelBadge';

/** Menú principal (vertical): nivel, personaje en idle, PERSONALIZAR y JUGAR. */
export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    restartOnResize(this);
    this.cameras.main.fadeIn(250, 0, 0, 0);
    drawBackground(this, true);

    const p = getProfile();
    new LevelBadge(this, 56, 62).set(p.level, p.xp);
    this.add.text(96, 98, p.name, textStyle(22)).setOrigin(0, 0.5);

    // Título
    const title = this.add.text(W / 2, H * 0.17, GAME_NAME, textStyle(96, '#ffd23f')).setOrigin(0.5).setScale(0);
    this.tweens.add({ targets: title, scale: 1, duration: 600, ease: 'Back.easeOut', easeParams: [2] });
    this.tweens.add({ targets: title, angle: { from: -2, to: 2 }, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.add.text(W / 2, H * 0.17 + 72, 'TENIS 1 vs 1', textStyle(30)).setOrigin(0.5);

    // Plataforma + personaje en idle
    const px = W / 2;
    const py = H * 0.6;
    const plat = this.add.graphics();
    plat.fillStyle(C.outline).fillEllipse(px, py + 10, 380, 104);
    plat.fillStyle(C.greenDark).fillEllipse(px, py + 5, 364, 90);
    plat.fillStyle(C.green).fillEllipse(px, py - 2, 364, 80);
    plat.lineStyle(5, 0xffffff, 0.8).strokeEllipse(px, py - 2, 280, 54);

    const hero = new Character(this, px - 20, py, PLAYER_LOOK, 'front').setScale(2.6);
    this.time.addEvent({ delay: 2600, loop: true, callback: () => hero.swing() });

    // Pelota rebotando junto al personaje
    const bx = px + 140;
    const ballShadow = this.add.ellipse(bx, py, 34, 12, 0x000000, 0.3);
    const ball = this.add.container(bx, py - 20);
    const bg = this.add.graphics();
    bg.fillStyle(C.outline).fillCircle(0, 0, 18);
    bg.fillStyle(0xd7f53a).fillCircle(0, 0, 14);
    bg.fillStyle(0xffffff, 0.6).fillCircle(-5, -5, 4);
    ball.add(bg);
    this.tweens.add({ targets: ball, y: py - 190, duration: 520, yoyo: true, repeat: -1, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: ballShadow, scaleX: 0.5, scaleY: 0.5, alpha: 0.12, duration: 520, yoyo: true, repeat: -1, ease: 'Quad.easeOut' });

    const go = (key: string) => {
      this.cameras.main.fadeOut(200, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(key));
    };

    new Button(this, W / 2, H * 0.72, 420, 92, 'PERSONALIZAR', C.purple, C.purpleDark, () => go('Customize'), 40);
    new Button(this, W / 2, H * 0.85, 460, 136, 'JUGAR', C.yellow, C.yellowDark, () => go('Matchmaking'), 72).pulse();
  }
}
