import Phaser from 'phaser';
import { Button } from '../ui/Button';
import { C, drawBackground, restartOnResize, textStyle } from '../ui/theme';
import { Character, playerLook, rivalLook } from '../objects/Character';
import { XP_LOSS, XP_WIN } from '../config';
import { addXp, getProfile } from '../logic/Profile';
import { LevelBadge } from '../ui/LevelBadge';

export interface ResultData {
  win: boolean;
  playerGames: number;
  botGames: number;
  botName: string;
  surrendered?: boolean;
}

export class ResultScene extends Phaser.Scene {
  private data0!: ResultData;
  private xpGiven = false;

  constructor() {
    super('Result');
  }

  init(data: ResultData) {
    // si la escena se reinicia por resize no volvemos a dar XP
    if (this.data0 !== data) this.xpGiven = false;
    this.data0 = data;
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    const { win, playerGames, botGames, botName } = this.data0;
    restartOnResize(this);
    this.cameras.main.fadeIn(250, 0, 0, 0);
    drawBackground(this, win);
    if (!win) this.add.rectangle(0, 0, W, H, 0x000000, 0.35).setOrigin(0);

    const title = this.add
      .text(W / 2, H * 0.1, win ? '¡VICTORIA!' : 'DERROTA', textStyle(96, win ? '#ffd23f' : '#ff7a85'))
      .setOrigin(0.5)
      .setScale(0);
    this.tweens.add({ targets: title, scale: 1, duration: 650, ease: 'Back.easeOut', easeParams: [2.5] });
    if (win) this.tweens.add({ targets: title, angle: { from: -3, to: 3 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    if (this.data0.surrendered) this.add.text(W / 2, H * 0.1 + 62, 'Te rendiste', textStyle(28, '#e6e0ff')).setOrigin(0.5);

    // Marcador final
    const py = H * 0.19;
    const panel = this.add.graphics();
    panel.fillStyle(C.outline).fillRoundedRect(W / 2 - 220, py, 440, 120, 24);
    panel.fillStyle(0x2a1f4d).fillRoundedRect(W / 2 - 212, py + 8, 424, 104, 18);
    this.add.text(W / 2 - 110, py + 34, 'TÚ', textStyle(28, '#8fd0ff')).setOrigin(0.5);
    this.add.text(W / 2 + 110, py + 34, botName, textStyle(26, '#ff9aa3')).setOrigin(0.5);
    this.add.text(W / 2, py + 80, `${playerGames}  -  ${botGames}`, textStyle(48)).setOrigin(0.5);

    // Personajes: el ganador salta, el perdedor cabizbajo
    const cy = H * 0.52;
    const me = new Character(this, W * 0.32, cy, playerLook(getProfile().skin), 'front').setScale(2.1);
    const rival = new Character(this, W * 0.74, cy - 10, rivalLook(getProfile().skin), 'front').setScale(1.5);
    rival.facing = -1;
    const [winner, loser] = win ? [me, rival] : [rival, me];
    this.tweens.add({ targets: winner, y: winner.y - 50, duration: 350, yoyo: true, repeat: -1, ease: 'Quad.easeOut' });
    this.time.addEvent({ delay: 700, loop: true, callback: () => winner.swing(true) });
    loser.rig.angle = 8 * loser.facing;
    loser.racketArm.angle = 80;

    // XP y nivel
    const reward = win ? XP_WIN : XP_LOSS;
    let res = null;
    if (!this.xpGiven) {
      res = addXp(reward);
      this.xpGiven = true;
    }
    const by = H * 0.62;
    this.add.text(W / 2, by, `+${reward} XP`, textStyle(44, '#8fd0ff')).setOrigin(0.5);
    const badge = new LevelBadge(this, W / 2 - 130, by + 64, 240);
    if (res) {
      badge.set(res.before.level, res.before.xp);
      this.time.delayedCall(500, () => badge.set(res.after.level, res.after.xp));
      if (res.levelsUp > 0) {
        const t = this.add.text(W / 2, by + 118, `¡SUBISTE A NIVEL ${res.after.level}!`, textStyle(36, '#ffd23f')).setOrigin(0.5).setScale(0);
        this.tweens.add({ targets: t, scale: 1, delay: 600, duration: 450, ease: 'Back.easeOut' });
      }
    } else {
      const p = getProfile();
      badge.set(p.level, p.xp);
    }

    new Button(this, W / 2, H * 0.8, 380, 104, 'Revancha', C.green, C.greenDark, () => {
      this.scene.start('Match', { botName });
    }, 48).pulse();
    new Button(this, W / 2, H * 0.91, 260, 80, 'Menú', C.blue, C.blueDark, () => this.scene.start('Menu'), 36);

    if (win) this.confetti(W, H);
  }

  private confetti(W: number, H: number) {
    const colors = [C.yellow, C.red, C.blue, C.green, C.purple, 0xffffff];
    for (let i = 0; i < 70; i++) {
      const r = this.add
        .rectangle(Phaser.Math.Between(0, W), Phaser.Math.Between(-H, -20), Phaser.Math.Between(8, 16), Phaser.Math.Between(12, 22), Phaser.Utils.Array.GetRandom(colors))
        .setStrokeStyle(2, C.outline);
      this.tweens.add({
        targets: r,
        y: H + 40,
        x: r.x + Phaser.Math.Between(-120, 120),
        angle: Phaser.Math.Between(-540, 540),
        duration: Phaser.Math.Between(2500, 5000),
        delay: Phaser.Math.Between(0, 2500),
        repeat: -1,
      });
    }
  }
}
