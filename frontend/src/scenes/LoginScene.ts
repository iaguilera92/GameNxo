import Phaser from 'phaser';
import { FONT } from '../ui/theme';
import { arcadeButton } from '../ui/modeButtons';
import { startIntroMusic } from '../fx/introMusic';
import { uiSound } from '../fx/uiSound';
import { authButtons } from '../ui/authButtons';
import { PROVIDER_NAME } from '../domain/account';

/**
 * (27-11-2026, usuario) INICIAR SESIÓN: la primera pantalla de una cuenta nueva (antes de "¿Cómo te llamas?"). Cuatro botones:
 * FACEBOOK, GOOGLE, uno partido en dos (APPLE | GOOGLE PLAY) e INVITADO. Hoy solo funciona INVITADO (sigue a la pantalla de inicio y
 * al tutorial, como siempre); los demás avisan "Pronto": falta el servidor de cuentas (docs/BASE-DE-DATOS.md, sin decidir el servicio).
 * No guarda nada: sale mientras la cuenta no haya terminado la pantalla de inicio (needsOnboarding).
 */
export class LoginScene extends Phaser.Scene {
  constructor() {
    super('Login');
  }

  preload() {
    if (!this.textures.exists('menu-bg')) this.load.image('menu-bg', 'assets/menu-bg.webp');
    if (!this.textures.exists('nxo-logo')) this.load.image('nxo-logo', 'assets/nxo-logo.webp');
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    startIntroMusic(this);
    if (this.textures.exists('menu-bg')) {
      const bg = this.add.image(W / 2, H, 'menu-bg').setOrigin(0.5, 1);
      bg.setScale(Math.max(W / bg.width, H / bg.height));
    }
    this.add.rectangle(0, 0, W, H, 0x04122e, 0.72).setOrigin(0);
    this.cameras.main.fadeIn(300, 0, 0, 0);

    // logo y título
    let y = H * 0.17;
    if (this.textures.exists('nxo-logo')) {
      const logo = this.add.image(W / 2, y, 'nxo-logo');
      logo.setScale(Math.min(W * 0.7, 520) / logo.width);
      y += (logo.displayHeight / 2) + 40;
    } else y += 60;
    this.add.text(W / 2, y + 20, 'INICIAR SESIÓN', { fontFamily: FONT, fontSize: '44px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 8 }).setOrigin(0.5).setLetterSpacing(2);
    this.add.text(W / 2, y + 70, 'Guarda tu progreso y juega en cualquier teléfono', { fontFamily: FONT, fontSize: '20px', color: '#9fb4e0' }).setOrigin(0.5);

    // botones
    const bw = Math.min(520, W - 80);
    const bh = 84;
    const gap = 22;
    let by = Math.max(y + 170, H * 0.46);
    by = authButtons(this, null, W / 2, by - bh / 2, bw, (p) => this.toast(`${PROVIDER_NAME[p]}: muy pronto`), bh, gap) + gap + 18 + bh / 2;
    // INVITADO: entra como siempre (nombre y personaje, después el tutorial)
    this.add.existing(arcadeButton(this, W / 2, by + 10, bw, 92, 'JUGAR COMO INVITADO', () => this.guest(), { palette: 'yellow', noShadow: true }));
    this.add.text(W / 2, by + 78, 'Podrás vincular tu cuenta más tarde en AJUSTES', { fontFamily: FONT, fontSize: '17px', color: '#8ea8da' }).setOrigin(0.5);
  }

  private guest() {
    uiSound(this, 'play');
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Onboarding'));
  }

  private toast(msg: string) {
    const t = this.add.text(this.scale.width / 2, this.scale.height - 120, msg, { fontFamily: FONT, fontSize: '24px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 6 }).setOrigin(0.5).setDepth(50);
    this.tweens.add({ targets: t, alpha: 0, delay: 1300, duration: 400, onComplete: () => t.destroy() });
  }
}
