import Phaser from 'phaser';
import { C, FONT, drawBackground, textStyle } from '../ui/theme';
import { bakeSkins, queueSkinLoads } from '../characters/skins';

/** Pantalla de carga: logo placeholder + "Cargando" + barra de progreso animada. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    // imágenes de personajes (si existen); si faltan, se usan los personajes vectoriales
    queueSkinLoads(this.load);
  }

  create() {
    bakeSkins(this);
    const W = this.scale.width;
    const H = this.scale.height;
    drawBackground(this, true);

    // Logo placeholder: insignia con pelota de tenis
    const logo = this.add.container(W / 2, H * 0.36);
    const g = this.add.graphics();
    g.fillStyle(C.outline).fillRoundedRect(-150, -95, 300, 190, 36);
    g.fillStyle(C.yellowDark).fillRoundedRect(-142, -80, 284, 168, 30);
    g.fillStyle(C.yellow).fillRoundedRect(-142, -87, 284, 160, 30);
    g.fillStyle(0xffffff, 0.3).fillRoundedRect(-128, -78, 256, 40, 18);
    g.fillStyle(C.outline).fillCircle(-82, -6, 44);
    g.fillStyle(0xd7f53a).fillCircle(-82, -6, 38);
    g.lineStyle(5, 0xffffff).beginPath();
    g.arc(-122, -6, 30, -1.0, 1.0).strokePath();
    g.beginPath().arc(-42, -6, 30, Math.PI - 1.0, Math.PI + 1.0).strokePath();
    logo.add(g);
    logo.add(this.add.text(42, -24, 'GAME', textStyle(50)).setOrigin(0.5));
    logo.add(this.add.text(42, 26, 'NXO', textStyle(50, '#ffe9a8')).setOrigin(0.5));
    logo.setScale(0);
    this.tweens.add({ targets: logo, scale: 1, duration: 600, ease: 'Back.easeOut', easeParams: [2.5] });
    this.tweens.add({ targets: logo, angle: { from: -2, to: 2 }, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Texto "Cargando" con puntos animados
    const label = this.add.text(W / 2, H * 0.66, 'Cargando', textStyle(38)).setOrigin(0.5);
    let dots = 0;
    this.time.addEvent({
      delay: 300,
      loop: true,
      callback: () => {
        dots = (dots + 1) % 4;
        label.setText('Cargando' + '.'.repeat(dots));
      },
    });

    // Barra de progreso
    const bw = Math.min(560, W * 0.6);
    const bh = 36;
    const bx = W / 2 - bw / 2;
    const by = H * 0.75;
    const frame = this.add.graphics();
    frame.fillStyle(C.outline).fillRoundedRect(bx - 6, by - 6, bw + 12, bh + 12, 18);
    frame.fillStyle(0x2a1f4d).fillRoundedRect(bx, by, bw, bh, 14);
    const bar = this.add.graphics();
    const pct = this.add.text(W / 2, by + bh / 2, '0%', { fontFamily: FONT, fontSize: '22px', color: '#ffffff', stroke: '#1a1033', strokeThickness: 5 }).setOrigin(0.5);

    const state = { p: 0 };
    const drawBar = () => {
      bar.clear();
      const fw = Math.max(bh, bw * state.p);
      bar.fillStyle(C.greenDark).fillRoundedRect(bx, by, fw, bh, 14);
      bar.fillStyle(C.green).fillRoundedRect(bx, by, fw, bh - 8, 14);
      bar.fillStyle(0xffffff, 0.35).fillRoundedRect(bx + 8, by + 5, fw - 16, 8, 4);
      pct.setText(`${Math.round(state.p * 100)}%`);
    };
    drawBar();

    // Esperamos a la fuente y animamos la barra (no hay assets externos que cargar)
    const fontReady = document.fonts ? document.fonts.load(`40px "Lilita One"`).catch(() => undefined) : Promise.resolve();
    this.tweens.add({
      targets: state,
      p: 1,
      duration: 1800,
      ease: 'Cubic.easeInOut',
      onUpdate: drawBar,
      onComplete: () => {
        fontReady.then(() => {
          this.cameras.main.fadeOut(250, 0, 0, 0);
          this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Menu'));
        });
      },
    });
  }
}

