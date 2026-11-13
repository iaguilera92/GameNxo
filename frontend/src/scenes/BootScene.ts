import Phaser from 'phaser';
import { queueUiSounds } from '../fx/uiSound';
import { queueSfx } from '../fx/sfx';
import { FONT } from '../ui/theme';
import { UI } from '../ui/ui';
import { bakeSkins, queueSkinLoads } from '../characters/skins';
import { queuePortraitLoads } from '../characters/portrait';
import { queueNxoSpriteLoads, registerNxoAnims } from '../objects/NxoActor';
import { preloadRankBadges } from '../ui/RankBadge';
import { queueAmbienteLoad } from '../view/CourtView';
import { bootRanked, myLeague } from '../logic/Ranked';



/**
 * Pantalla de carga: parte en NEGRO mientras se descargan los recursos y luego aparece
 * escalonado (fondo → logo → barra). La barra termina en una línea vertical de neón.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    // negro desde el primer fotograma (el color del juego en main.ts es azul)
    this.cameras.main.setBackgroundColor('#000000');
    // imágenes de personajes (si existen); si faltan, se usan los personajes vectoriales
    queueSkinLoads(this.load);
    queueSfx(this.load); // sonidos de juego en archivo (fx/sfx.ts)
    queueUiSounds(this.load); // sonidos de interfaz en mp3 (solo los de UI_SOUND_FILES; el resto se sintetiza)
    queuePortraitLoads(this.load);
    queueNxoSpriteLoads(this.load); // animaciones de NXO en el partido (si falta algo, se usa el dibujo de siempre)
    this.load.image('nxo-logo', 'assets/nxo-logo.webp');
    this.load.image('loading-bg', 'assets/loading-bg.webp');
    // recursos del menú: así el menú aparece al instante detrás del cargando
    this.load.image('menu-bg', 'assets/menu-bg.webp');
    this.load.image('btn-jugar', 'assets/btn-jugar.webp');
    this.load.image('nav-bar', 'assets/nav-bar.webp');
    this.load.audio('vs', 'mp3/vs.mp3'); // sonido de la pantalla VS (la cache de audio es global)
    queueAmbienteLoad(this.load); // ambiente del partido (estadio)
    bootRanked(); // partida Ranked a medias = abandono; cierre de semana / mes
    preloadRankBadges(this.load, [myLeague()]); // solo la del rango actual
  }

  create() {
    bakeSkins(this);
    registerNxoAnims(this);
    const W = this.scale.width;
    const H = this.scale.height;
    const cam = this.cameras.main;
    cam.setBackgroundColor('#000000');
    // 1) el fondo sale del negro
    cam.fadeIn(700, 0, 0, 0);

    if (this.textures.exists('loading-bg')) {
      const bg = this.add.image(W / 2, H / 2, 'loading-bg');
      bg.setScale(Math.max(W / bg.width, H / bg.height));
    }

    // 2) logo Nxo Games
    const logo = this.add.image(W / 2, H * 0.4, 'nxo-logo').setOrigin(0.5);
    const logoScale = Math.min(W * 0.72, 620) / logo.width;
    logo.setScale(logoScale * 0.92).setAlpha(0);
    this.tweens.add({ targets: logo, alpha: 1, scale: logoScale, delay: 450, duration: 600, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: logo, scale: logoScale * 1.03, delay: 1050, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // 3) "CARGANDO…" + barra
    const label = this.add
      .text(W / 2, H * 0.68, 'CARGANDO', { fontFamily: FONT, fontSize: '26px', color: '#dff2ff' })
      .setOrigin(0.5)
      .setLetterSpacing(6);
    let dots = 0;
    this.time.addEvent({ delay: 350, loop: true, callback: () => { dots = (dots + 1) % 4; label.setText('CARGANDO' + '.'.repeat(dots)); } });

    const bw = Math.min(440, W * 0.66);
    const bh = 26;
    const bx = W / 2 - bw / 2;
    const by = H * 0.73;
    const r = bh / 2;
    // riel oscuro con borde cyan
    const rail = this.add.graphics();
    rail.fillStyle(0x071326, 1).fillRoundedRect(bx - 3, by - 3, bw + 6, bh + 6, r + 3);
    rail.lineStyle(2, UI.cyan, 0.7).strokeRoundedRect(bx - 3, by - 3, bw + 6, bh + 6, r + 3);

    const bar = this.add.graphics();
    // punta: línea vertical de neón (núcleo blanco + halo cyan aditivo)
    const tip = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    const pct = this.add.text(W / 2, by + bh + 26, '0%', { fontFamily: FONT, fontSize: '22px', color: '#dff2ff' }).setOrigin(0.5);
    const state = { p: 0 };
    const drawBar = () => {
      const fw = Math.max(bh, bw * state.p);
      bar.clear();
      // relleno degradado azul→cyan
      bar.fillStyle(0x1b6ff0, 1).fillRoundedRect(bx, by, fw, bh, r);
      bar.fillStyle(UI.cyan, 1).fillRoundedRect(bx, by, fw, bh * 0.5, r);
      bar.fillStyle(0xffffff, 0.85).fillRoundedRect(bx + 4, by + 3, Math.max(0, fw - 8), 4, 2); // brillo superior
      // línea de neón en el borde del relleno (dentro de la barra, sobresale arriba y abajo)
      const x = Math.min(bx + fw - 3, bx + bw - 3);
      tip.clear();
      tip.fillStyle(UI.cyan, 0.14).fillRoundedRect(x - 9, by - 14, 18, bh + 28, 9);
      tip.fillStyle(UI.cyan, 0.3).fillRoundedRect(x - 5, by - 11, 10, bh + 22, 5);
      tip.fillStyle(UI.cyan, 0.75).fillRoundedRect(x - 2.5, by - 9, 5, bh + 18, 2.5);
      tip.fillStyle(0xffffff, 1).fillRoundedRect(x - 1, by - 7, 2, bh + 14, 1);
      pct.setText(`${Math.round(state.p * 100)}%`);
    };
    drawBar();

    const loadUi = [label, rail, bar, tip, pct];
    loadUi.forEach((o) => o.setAlpha(0));
    this.tweens.add({ targets: loadUi, alpha: 1, delay: 850, duration: 400, ease: 'Quad.easeOut' });
    // parpadeo sutil del neón
    this.tweens.add({ targets: tip, alpha: { from: 1, to: 0.7 }, delay: 1250, duration: 110, yoyo: true, repeat: -1, repeatDelay: 900, ease: 'Stepped' });

    const fontReady = document.fonts ? document.fonts.load(`40px "Lilita One"`).catch(() => undefined) : Promise.resolve();
    this.tweens.add({
      targets: state,
      p: 1,
      delay: 1000,
      duration: 1900,
      ease: 'Cubic.easeInOut',
      onUpdate: drawBar,
      onComplete: () => {
        fontReady.then(() => this.crossfadeToMenu());
      },
    });
  }

  /**
   * Transición sin negro: el menú arranca DEBAJO del cargando y el cargando se vuelve
   * transparente hasta desaparecer.
   */
  private crossfadeToMenu() {
    const cam = this.cameras.main;
    const menu = this.scene.get('Menu');
    menu.events.once(Phaser.Scenes.Events.CREATE, () => {      // el menú hace su propio fadeIn desde negro: se espera a que termine (queda oculto bajo el cargando)
      this.time.delayedCall(300, () => {
        cam.setBackgroundColor('rgba(0,0,0,0)');
        this.tweens.add({
          targets: cam,
          alpha: 0,
          duration: 650,
          ease: 'Quad.easeInOut',
          onComplete: () => this.scene.stop(),
        });
      });
    });
    this.scene.launch('Menu');
    this.scene.bringToTop(); // el cargando sigue encima mientras se desvanece
  }
}
