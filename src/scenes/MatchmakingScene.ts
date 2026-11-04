import Phaser from 'phaser';
import { Button } from '../ui/Button';
import { C, drawBackground, restartOnResize, textStyle } from '../ui/theme';
import { BOT_LOOK, Character, PLAYER_LOOK } from '../objects/Character';

const BOT_NAMES = ['RoboAce', 'BotNadal', 'TopSpin-3000', 'NetBot', 'Volea.exe'];

/** "Buscando partida..." simulado y presentación VS contra el bot. */
export class MatchmakingScene extends Phaser.Scene {
  constructor() {
    super('Matchmaking');
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    restartOnResize(this);
    this.cameras.main.fadeIn(200, 0, 0, 0);
    drawBackground(this, true);

    const searching = this.add.container(W / 2, H / 2);
    // pelota girando
    const spinner = this.add.graphics();
    spinner.fillStyle(C.outline).fillCircle(0, 0, 54);
    spinner.fillStyle(0xd7f53a).fillCircle(0, 0, 46);
    spinner.lineStyle(7, 0xffffff).beginPath().arc(-48, 0, 36, -1, 1).strokePath();
    spinner.beginPath().arc(48, 0, 36, Math.PI - 1, Math.PI + 1).strokePath();
    spinner.y = -60;
    searching.add(spinner);
    this.tweens.add({ targets: spinner, angle: 360, duration: 900, repeat: -1 });
    this.tweens.add({ targets: spinner, y: -80, duration: 300, yoyo: true, repeat: -1, ease: 'Quad.easeOut' });

    const label = this.add.text(0, 50, 'Buscando partida...', textStyle(46)).setOrigin(0.5);
    const timer = this.add.text(0, 105, '0:00', textStyle(28, '#cfe0ff')).setOrigin(0.5);
    searching.add([label, timer]);
    let secs = 0;
    const clock = this.time.addEvent({ delay: 1000, loop: true, callback: () => timer.setText(`0:${String(++secs).padStart(2, '0')}`) });

    const cancel = new Button(this, W / 2, H * 0.86, 240, 70, 'Cancelar', C.red, C.redDark, () => this.scene.start('Menu'), 32);

    const wait = Phaser.Math.Between(1800, 3000);
    this.time.delayedCall(wait, () => {
      // detener el contador antes de destruir su texto (si no, setText sobre un texto destruido rompe el bucle)
      clock.remove();
      cancel.destroy();
      this.tweens.add({ targets: searching, alpha: 0, scale: 0.6, duration: 200, onComplete: () => searching.destroy() });
      this.showVersus(W, H, Phaser.Utils.Array.GetRandom(BOT_NAMES));
    });
  }

  private showVersus(W: number, H: number, botName: string) {
    const found = this.add.text(W / 2, H * 0.08, '¡Rival encontrado!', textStyle(48, '#ffd23f')).setOrigin(0.5).setScale(0);
    this.tweens.add({ targets: found, scale: 1, duration: 400, ease: 'Back.easeOut' });

    const card = (y: number, name: string, color: number, dark: number, fromX: number, isBot: boolean) => {
      const c = this.add.container(fromX, y);
      const g = this.add.graphics();
      g.fillStyle(C.outline).fillRoundedRect(-150, -180, 300, 340, 28);
      g.fillStyle(dark).fillRoundedRect(-142, -172, 284, 324, 22);
      g.fillStyle(color).fillRoundedRect(-142, -172, 284, 250, 22);
      g.fillStyle(0xffffff, 0.25).fillRoundedRect(-130, -164, 260, 50, 16);
      c.add(g);
      const ch = new Character(this, 0, 60, isBot ? BOT_LOOK : PLAYER_LOOK, 'front');
      ch.setScale(1.6);
      if (isBot) ch.facing = -1;
      c.add(ch);
      c.add(this.add.text(0, 115, name, textStyle(34)).setOrigin(0.5));
      this.tweens.add({ targets: c, x: W / 2, duration: 450, ease: 'Back.easeOut' });
    };
    card(H * 0.33, botName, C.red, C.redDark, W + 300, true);
    card(H * 0.75, 'TÚ', C.blue, C.blueDark, -300, false);

    const vs = this.add.text(W / 2, H * 0.54, 'VS', textStyle(110, '#ffd23f')).setOrigin(0.5).setScale(3).setAlpha(0);
    this.tweens.add({ targets: vs, scale: 1, alpha: 1, duration: 350, delay: 350, ease: 'Back.easeOut' });

    this.time.delayedCall(2000, () => {
      this.cameras.main.fadeOut(250, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Match', { botName }));
    });
  }
}
