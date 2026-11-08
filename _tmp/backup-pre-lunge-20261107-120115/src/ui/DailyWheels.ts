import Phaser from 'phaser';
import { FONT } from './theme';
import { fitText } from './fitText';
import { GOLD, NAVY, drawWheelFace } from './wheelArt';
import { WHEEL } from '../domain/wheelConfig';
import type { WheelStatus } from '../domain/dailyWheel';
import { msToWheelReset, wheelStatuses } from '../logic/Wheels';
import { onPlayerChange } from '../domain/playerStore';

/**
 * Fila de 4 ruletas pequeñas del menú (encima de JUGAR).
 *   por ganar  a color con vaivén suave (se ve activa; al tocarla dice cuántas victorias faltan)
 *   disponible girando, aura dorada, rebote y "!" (toca para girar)
 *   cobrada    destello al cobrarla y queda deshabilitada (gris) en su sitio
 * Arriba: título, progreso del día y cuenta atrás al reinicio (23:59 Chile).
 */
export interface DailyWheelsOpts {
  /** tocar una ruleta disponible */
  onOpen: (index: number) => void;
  /** aviso breve (bloqueada / ya girada) */
  onToast: (msg: string) => void;
}

const MINI_R = 34;

export class DailyWheels extends Phaser.GameObjects.Container {
  private slots: Phaser.GameObjects.Container[] = [];
  private status: WheelStatus[] = [];
  private slotPos = new Map<number, number>();
  private info!: Phaser.GameObjects.Text;
  private timer!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, private pw: number, private opts: DailyWheelsOpts) {
    super(scene, x, y);
    scene.add.existing(this);
    this.setDepth(50);
    this.panel();
    this.refresh();
    const off = onPlayerChange(() => this.refresh());
    const tick = scene.time.addEvent({ delay: 1000, loop: true, callback: () => this.tickTimer() });
    this.once('destroy', () => {
      off();
      tick.remove();
    });
  }

  private panel() {
    const h = 104;
    const g = this.scene.add.graphics();
    g.fillStyle(0x000000, 0.3).fillRoundedRect(-this.pw / 2 + 4, -h / 2 + 6, this.pw, h, 22);
    g.fillStyle(0x0a1638, 0.82).fillRoundedRect(-this.pw / 2, -h / 2, this.pw, h, 22);
    g.lineStyle(2.5, 0x3a7bff, 0.9).strokeRoundedRect(-this.pw / 2, -h / 2, this.pw, h, 22);
    this.add(g);
    const ty = -h / 2 - 2;
    const tag = this.scene.add.graphics();
    tag.fillStyle(NAVY, 1).fillRoundedRect(-this.pw / 2 + 16, ty - 15, 196, 30, 15);
    tag.lineStyle(2, GOLD, 1).strokeRoundedRect(-this.pw / 2 + 16, ty - 15, 196, 30, 15);
    this.add(tag);
    this.add(this.scene.add.text(-this.pw / 2 + 114, ty, 'RULETAS DIARIAS', { fontFamily: FONT, fontSize: '17px', color: '#ffd23f' }).setOrigin(0.5).setLetterSpacing(1));
    this.info = this.scene.add.text(this.pw / 2 - 18, -h / 2 + 18, '', { fontFamily: FONT, fontSize: '16px', color: '#cfe0ff' }).setOrigin(1, 0.5);
    this.timer = this.scene.add.text(this.pw / 2 - 18, h / 2 - 16, '', { fontFamily: FONT, fontSize: '14px', color: '#7f93bf' }).setOrigin(1, 0.5);
    this.add([this.info, this.timer]);
  }

  /** Redibuja según el estado guardado (también al girar/cobrar). */
  refresh() {
    const st = wheelStatuses();
    if (this.status.length && st.join() === this.status.join()) return;
    const prev = this.status;
    const prevPos = this.slotPos;
    this.status = st;
    this.slots.forEach((s) => s.destroy());
    this.slots = [];
    this.slotPos = new Map();
    // siempre las 4 en su sitio; las ya cobradas quedan deshabilitadas (no se pierde el espacio)
    const area = this.pw - 190;
    const step = Math.min(96, area / WHEEL.perDay);
    const x0 = -this.pw / 2 + 26 + step / 2;
    st.forEach((s, i) => {
      const x = x0 + i * step;
      this.slotPos.set(i, x);
      this.slots.push(this.mini(x, 4, i, s));
    });
    // la recién cobrada se "abre" y se desvanece donde estaba
    st.forEach((s, i) => {
      if (s === 'done' && prev[i] && prev[i] !== 'done') this.vanish(prevPos.get(i) ?? 0);
    });
    const ready = st.filter((x) => x === 'ready' || x === 'spun').length;
    const left = st.filter((x) => x === 'locked').length;
    this.info.setText(ready ? `¡${ready} PARA GIRAR!` : left ? 'GANA Y GIRA' : '¡VUELVE MAÑANA!').setColor(ready ? '#ffd23f' : '#cfe0ff');
    fitText(this.info, 150);
    this.tickTimer();
  }

  /** Efecto de "abierta": destello y anillo que se expande en la posición de la ruleta cobrada. */
  private vanish(x: number) {
    const ring = this.scene.add.circle(x, 4, MINI_R + 4, 0xffffff, 0).setStrokeStyle(5, GOLD, 1).setBlendMode(Phaser.BlendModes.ADD);
    const core = this.scene.add.circle(x, 4, MINI_R, 0xfff1b8, 0.8).setBlendMode(Phaser.BlendModes.ADD);
    this.add([ring, core]);
    this.scene.tweens.add({ targets: ring, scale: 1.9, alpha: 0, duration: 520, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    this.scene.tweens.add({ targets: core, scale: 0.2, alpha: 0, duration: 420, ease: 'Back.easeIn', onComplete: () => core.destroy() });
  }

  private tickTimer() {
    const ms = msToWheelReset();
    const h = Math.floor(ms / 3600_000);
    const m = Math.floor((ms % 3600_000) / 60_000);
    const s = Math.floor((ms % 60_000) / 1000);
    this.timer.setText(`REINICIO EN ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    // ciclo nuevo mientras se mira el menú
    if (ms < 1500) this.scene.time.delayedCall(1600, () => this.refresh());
  }

  private mini(x: number, y: number, i: number, s: WheelStatus) {
    const c = this.scene.add.container(x, y);
    this.add(c);
    const ready = s === 'ready' || s === 'spun';
    if (ready) {
      const aura = this.scene.add.circle(0, 0, MINI_R + 10, GOLD, 0.35).setBlendMode(Phaser.BlendModes.ADD);
      c.add(aura);
      this.scene.tweens.add({ targets: aura, scale: 1.25, alpha: 0.05, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    const rim = this.scene.add.graphics();
    rim.fillStyle(NAVY, 1).fillCircle(0, 0, MINI_R + 5);
    rim.fillStyle(s === 'done' ? 0x55607a : GOLD, 1).fillCircle(0, 0, MINI_R + 2.5);
    c.add(rim);
    const face = this.scene.add.graphics();
    drawWheelFace(face, MINI_R, false);
    c.add(face);
    const hub = this.scene.add.graphics();
    hub.fillStyle(NAVY, 1).fillCircle(0, 0, 8);
    hub.fillStyle(GOLD, 1).fillCircle(0, 0, 5.5);
    c.add(hub);
    // indicador
    const ptr = this.scene.add.graphics();
    ptr.fillStyle(NAVY, 1).fillTriangle(-7, -MINI_R - 9, 7, -MINI_R - 9, 0, -MINI_R + 4);
    ptr.fillStyle(0xff3b4f, 1).fillTriangle(-4.5, -MINI_R - 7, 4.5, -MINI_R - 7, 0, -MINI_R + 1);
    c.add(ptr);

    if (s === 'done') {
      // ya cobrada: deshabilitada (gris y atenuada), sin animación
      c.add(this.scene.add.circle(0, 0, MINI_R + 3, 0x1a2238, 0.68));
      c.setAlpha(0.75);
    } else if (s === 'locked') {
      // por ganar: a color y "viva" (vaivén suave), sin candado; se gira al ganar una partida
      face.setAngle(i * 23);
      this.scene.tweens.add({ targets: face, angle: face.angle + 14, duration: 1400 + i * 160, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else if (ready) {
      this.scene.tweens.add({ targets: face, angle: 360, duration: 6000, repeat: -1 });
      this.scene.tweens.add({ targets: c, y: y - 5, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const badge = this.scene.add.container(MINI_R - 2, -MINI_R + 4);
      const bg = this.scene.add.graphics();
      bg.fillStyle(NAVY, 1).fillCircle(0, 0, 12.5);
      bg.fillStyle(0xff3b4f, 1).fillCircle(0, 0, 10);
      badge.add(bg);
      badge.add(this.scene.add.text(0, 0, '!', { fontFamily: FONT, fontSize: '16px', color: '#ffffff' }).setOrigin(0.5));
      c.add(badge);
      this.scene.tweens.add({ targets: badge, scale: 1.25, duration: 340, yoyo: true, repeat: -1 });
    }

    c.setSize(MINI_R * 2 + 16, MINI_R * 2 + 16).setInteractive({ useHandCursor: true });
    c.on('pointerup', () => {
      this.scene.tweens.add({ targets: c, scale: { from: 0.88, to: 1 }, duration: 220, ease: 'Back.easeOut' });
      if (ready) this.opts.onOpen(i);
      else if (s === 'done') this.opts.onToast('Ya giraste esta ruleta. ¡Vuelve mañana!');
      else {
        const need = i + 1 - this.status.filter((x) => x !== 'locked').length;
        this.opts.onToast(need === 1 ? '¡Gana 1 partida para girarla!' : `¡Gana ${need} partidas hoy para girarla!`);
      }
    });
    return c;
  }
}
