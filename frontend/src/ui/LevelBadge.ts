import Phaser from 'phaser';
import { MAX_LEVEL, xpToNext } from '../config';
import { levelProgress } from '../logic/Profile';
import { C, textStyle } from './theme';

/** Insignia de nivel (estrella con número) + barra de XP. */
export class LevelBadge extends Phaser.GameObjects.Container {
  private bar: Phaser.GameObjects.Graphics;
  private lvlText: Phaser.GameObjects.Text;
  private xpText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, private readonly barW = 220) {
    super(scene, x, y);
    // barra (detrás de la insignia)
    const frame = scene.add.graphics();
    frame.fillStyle(C.outline).fillRoundedRect(10, -16, barW + 10, 32, 14);
    frame.fillStyle(0x2a1f4d).fillRoundedRect(14, -12, barW + 2, 24, 11);
    this.add(frame);
    this.bar = scene.add.graphics();
    this.add(this.bar);
    this.xpText = scene.add.text(20 + barW / 2, 0, '', textStyle(16)).setOrigin(0.5);
    this.add(this.xpText);

    // insignia
    const star = scene.add.graphics();
    const p: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 ? 19 : 32;
      p.push(new Phaser.Math.Vector2(Math.cos(a) * r, Math.sin(a) * r));
    }
    star.fillStyle(C.outline).fillCircle(0, 2, 30);
    star.fillStyle(C.purpleDark).fillCircle(0, 2, 25);
    star.fillStyle(C.purple).fillCircle(0, 0, 24);
    star.fillStyle(0xffffff, 0.3).fillEllipse(-4, -10, 26, 10);
    this.add(star);
    this.lvlText = scene.add.text(0, 0, '', textStyle(24)).setOrigin(0.5);
    this.add(this.lvlText);

    scene.add.existing(this);
  }

  set(level: number, xp: number) {
    const W = this.barW;
    const k = levelProgress({ level, xp });
    this.bar.clear();
    if (k > 0) {
      const w = Math.max(22, W * k);
      this.bar.fillStyle(C.blueDark).fillRoundedRect(14, -12, w, 24, 11);
      this.bar.fillStyle(C.blue).fillRoundedRect(14, -12, w, 18, 11);
      this.bar.fillStyle(0xffffff, 0.35).fillRoundedRect(22, -9, w - 16, 5, 3);
    }
    this.lvlText.setText(String(level));
    this.xpText.setText(level >= MAX_LEVEL ? 'NIVEL MÁX.' : `${xp} / ${xpToNext(level)} XP`);
    return this;
  }
}
