import Phaser from 'phaser';
import { FONT, restartOnResize, textStyle } from '../ui/theme';
import { UI, flatButton, stadiumBg } from '../ui/ui';
import { playerLook, rivalLook } from '../objects/Character';
import { rivalFor } from '../characters/catalog';
import { getProfile } from '../logic/Profile';
import type { SkinId } from '../characters/skins';
import { showVersus as showVersusScreen } from '../ui/VersusScreen';

const BOT_NAMES = ['RoboAce', 'BotNadal', 'TopSpin-3000', 'NetBot', 'Volea.exe'];

/** "Buscando partida..." (presentación competitiva) y pantalla VS antes del partido. */
export class MatchmakingScene extends Phaser.Scene {
  constructor() {
    super('Matchmaking');
  }

  preload() {
    if (!this.textures.exists('menu-bg')) this.load.image('menu-bg', 'assets/menu-bg.png');
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    restartOnResize(this);
    this.cameras.main.fadeIn(200, 0, 0, 0);
    stadiumBg(this, 0.55);

    const searching = this.add.container(W / 2, H * 0.44);

    // --- anillo de escaneo (dos arcos girando en sentidos opuestos)
    const ringR = 92;
    const ring = this.add.graphics();
    const drawRing = (g: Phaser.GameObjects.Graphics, r: number, col: number, from: number, len: number, lw: number) => {
      g.lineStyle(lw, col, 1).beginPath().arc(0, 0, r, from, from + len).strokePath();
    };
    searching.add(ring);
    // pulso luminoso de fondo
    const pulse = this.add.circle(0, 0, ringR, UI.electric, 0.12);
    searching.add(pulse);
    this.tweens.add({ targets: pulse, scale: 1.4, alpha: 0, duration: 1400, repeat: -1, ease: 'Quad.easeOut' });

    // pelota de tenis como detalle central
    const ball = this.add.graphics();
    ball.fillStyle(0x0a1838).fillCircle(0, 0, 30);
    ball.fillStyle(0xd7f53a).fillCircle(0, 0, 26);
    ball.lineStyle(3, 0xffffff, 0.85).beginPath().arc(-26, 0, 20, -0.9, 0.9).strokePath();
    ball.beginPath().arc(26, 0, 20, Math.PI - 0.9, Math.PI + 0.9).strokePath();
    // la pelota va dentro de un "soporte": el giro continuo es de la pelota y el movimiento del soporte
    const ballHolder = this.add.container(0, 0, [ball]);
    searching.add(ballHolder);
    this.tweens.add({ targets: ball, angle: 360, duration: 3000, repeat: -1 });
    this.ballToy(ballHolder, W, H);

    let t = 0;
    this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        t += 0.05;
        ring.clear();
        drawRing(ring, ringR, UI.cyan, t, 2.2, 4);
        drawRing(ring, ringR - 14, UI.electric, -t * 1.3, 1.6, 3);
      },
    });

    const label = this.add
      .text(0, 150, 'BUSCANDO PARTIDA', { fontFamily: FONT, fontSize: '40px', color: UI.text })
      .setOrigin(0.5)
      .setLetterSpacing(2);
    const sub = this.add.text(0, 196, 'Conectando con un rival…', textStyle(22, UI.textDim)).setOrigin(0.5);
    const timer = this.add.text(0, 244, '0:00', { fontFamily: FONT, fontSize: '30px', color: '#37e0ff' }).setOrigin(0.5);
    searching.add([label, sub, timer]);
    this.tweens.add({ targets: sub, alpha: { from: 0.4, to: 1 }, duration: 900, yoyo: true, repeat: -1 });

    let secs = 0;
    const clock = this.time.addEvent({ delay: 1000, loop: true, callback: () => timer.setText(`0:${String(++secs).padStart(2, '0')}`) });

    const cancel = flatButton(this, W / 2, H * 0.84, 240, 72, 'CANCELAR', () => this.scene.start('Menu'), { fontSize: 28 });

    // --- lógica de búsqueda (sin cambios en tiempos/estados)
    const wait = Phaser.Math.Between(1800, 3000);
    this.time.delayedCall(wait, () => {
      clock.remove();
      cancel.destroy();
      this.tweens.add({ targets: searching, alpha: 0, scale: 0.85, duration: 220, onComplete: () => searching.destroy() });
      this.showVersus(Phaser.Utils.Array.GetRandom(BOT_NAMES));
    });
  }

  /**
   * Juguete para la espera: tocar la pantalla lanza la pelota del centro a un punto al azar
   * (con giro y rebote) y al rato vuelve sola al centro. No afecta a la búsqueda.
   */
  private ballToy(holder: Phaser.GameObjects.Container, W: number, H: number) {
    let back: Phaser.Time.TimerEvent | undefined;
    const onTap = (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length > 0 || !holder.active) return; // el toque es de un botón (CANCELAR)
      this.tweens.killTweensOf(holder);
      back?.remove();
      // destino aleatorio dentro de la pantalla (coordenadas locales: el centro de búsqueda está en H*0.44)
      const ang = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const dist = Phaser.Math.Between(110, Math.min(W * 0.4, 280));
      const tx = Phaser.Math.Clamp(Math.cos(ang) * dist, -W / 2 + 50, W / 2 - 50);
      const ty = Phaser.Math.Clamp(Math.sin(ang) * dist, -H * 0.44 + 80, H * 0.3);
      // estela: destello en el punto de salida
      const puff = this.add.circle(holder.parentContainer.x + holder.x, holder.parentContainer.y + holder.y, 30, 0xd7f53a, 0.5);
      this.tweens.add({ targets: puff, scale: 2.2, alpha: 0, duration: 380, onComplete: () => puff.destroy() });
      this.tweens.add({ targets: holder, x: tx, y: ty, duration: 420, ease: 'Cubic.easeOut' });
      this.tweens.add({ targets: holder, angle: holder.angle + Phaser.Math.RND.pick([-1, 1]) * 540, duration: 520, ease: 'Cubic.easeOut' });
      this.tweens.add({ targets: holder, scaleX: { from: 1.3, to: 1 }, scaleY: { from: 0.75, to: 1 }, duration: 460, ease: 'Back.easeOut' });
      back = this.time.delayedCall(1300, () => {
        if (!holder.active) return;
        this.tweens.add({ targets: holder, x: 0, y: 0, angle: 0, duration: 600, ease: 'Back.easeOut' });
      });
    };
    this.input.on('pointerdown', onTap);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.off('pointerdown', onTap));
  }

  // ---------------------------------------------------------------- VS
  /** Presentación VS (diseño en ui/VersusScreen.ts) y paso al partido. */
  private showVersus(botName: string) {
    const p = getProfile();
    showVersusScreen(
      this,
      { name: p.name, level: p.level, look: playerLook(p.skin), portraitSkin: p.skin as SkinId },
      {
        name: botName,
        level: Phaser.Math.Between(1, Math.max(1, p.level + 2)),
        look: rivalLook(p.skin),
        portraitSkin: rivalFor(p.skin),
      },
    );

    // transición al partido (lógica intacta)
    this.time.delayedCall(2700, () => {
      this.cameras.main.fadeOut(250, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Match', { botName }));
    });
  }
}