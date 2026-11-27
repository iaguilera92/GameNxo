import Phaser from 'phaser';
import { C } from './theme';
import { JOY, joyResponse } from '../logic/PlayerMotion';

function devFlag(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Joystick virtual flotante estilo Brawl Stars:
 * aparece donde se toca en la mitad izquierda y vuelve a su sitio al soltar.
 */
export class Joystick {
  readonly value = new Phaser.Math.Vector2(0, 0);
  private base: Phaser.GameObjects.Container;
  private knob: Phaser.GameObjects.Container;
  private pointerId: number | null = null;
  private home = new Phaser.Math.Vector2();
  private readonly radius = 80;
  enabled = true;
  /** respuesta nueva del joystick (JOY.enabled y sin localStorage 'dev.joyCurve' = '0') */
  private readonly curve = JOY.enabled && devFlag('dev.joyCurve') !== '0';

  /** (27-11-2026) oculto (p. ej. el zoom del tutorial al rival aturdido) */
  setHidden(on: boolean) {
    this.base.setVisible(!on);
    this.knob.setVisible(!on);
  }

  constructor(private scene: Phaser.Scene) {
    this.base = scene.add.container(0, 0).setScrollFactor(0).setDepth(5000);
    const g = scene.add.graphics();
    g.fillStyle(C.outline, 0.45).fillCircle(0, 0, this.radius + 14);
    // (21-11-2026, usuario) la base (aro y relleno) en AZUL en vez de blanco
    g.lineStyle(6, 0x3a8dff, 0.75).strokeCircle(0, 0, this.radius + 6);
    g.fillStyle(0x2f7bff, 0.14).fillCircle(0, 0, this.radius);
    this.base.add(g);

    this.knob = scene.add.container(0, 0).setScrollFactor(0).setDepth(5001);
    const k = scene.add.graphics();
    // (21-11-2026, usuario) perilla AZUL como el botón btn-dash: aro biselado (claro arriba, oscuro abajo) con un disco central azul.
    // Sin degradados nativos en los círculos: se apilan círculos desplazados (la luz viene de arriba).
    k.fillStyle(0x000000, 0.4).fillCircle(0, 5, 44); // sombra
    k.fillStyle(0x123a7e).fillCircle(0, 0, 44); // borde inferior oscuro del aro (azul noche)
    k.fillStyle(0x2f6bdf).fillCircle(0, -1, 43);
    k.fillStyle(0x4f93ff).fillCircle(0, -2.2, 41.5);
    k.fillStyle(0x8fc4ff).fillCircle(0, -3.4, 39.5); // brillo del aro (arriba)
    k.fillStyle(0x1f55b8).fillCircle(0, 1, 29.5); // canal que separa el aro del disco
    k.lineStyle(1.5, 0x0d2f6e, 0.9).strokeCircle(0, 1, 29.5);
    k.fillStyle(0x2f7bff).fillCircle(0, 0.5, 28); // disco central azul: más oscuro abajo...
    k.fillStyle(0x6fb2ff).fillCircle(0, -1.2, 26.5); // ...y claro arriba
    k.fillStyle(0xaed6ff, 0.9).fillEllipse(-2, -7, 36, 24); // luz suave del disco
    k.fillStyle(0xffffff, 0.6).fillEllipse(-12, -26, 22, 7); // destello del aro
    this.knob.add(k);

    this.layout();
    this.setIdleLook();

    scene.input.on('pointerdown', this.onDown, this);
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.input.on('pointerupoutside', this.onUp, this);
    scene.events.once('shutdown', () => {
      scene.input.off('pointerdown', this.onDown, this);
      scene.input.off('pointermove', this.onMove, this);
      scene.input.off('pointerup', this.onUp, this);
      scene.input.off('pointerupoutside', this.onUp, this);
    });
  }

  layout() {
    const H = this.scene.scale.height;
    this.home.set(150, H - 190);
    if (this.pointerId === null) {
      this.base.setPosition(this.home.x, this.home.y);
      this.knob.setPosition(this.home.x, this.home.y);
    }
  }

  // opacidad baja para no tapar la cancha
  private setIdleLook() {
    this.base.setAlpha(0.28 * this.dim);
    this.knob.setAlpha(0.38 * this.dim);
  }

  /** (21-11-2026, usuario) atenúa más el joystick mientras dura la ULTI (1 = normal, p. ej. 0.35 = más opaco). */
  private dim = 1;
  /** (25-11-2026) primer partido del tutorial: UNA pulsación del joystick (la base late y la palanca se mueve hacia `dir`: -1 izq., 1 der.) */
  pulse(dir: -1 | 1 | 'up' | 'down') {
    if (this.pointerId !== null) return;
    const s = this.scene;
    // (25-11-2026, usuario) más visible: el aro crece más y la perilla llega casi al borde
    s.tweens.add({ targets: this.base, scale: { from: 1, to: 1.25 }, duration: 240, yoyo: true, hold: 200, ease: 'Quad.easeOut' });
    const to = dir === 'up' ? { y: this.home.y - this.radius * 0.9 } : dir === 'down' ? { y: this.home.y + this.radius * 0.9 } : { x: this.home.x + dir * this.radius * 0.9 }; // (25-11-2026, usuario) también hacia arriba
    s.tweens.add({ targets: this.knob, ...to, duration: 300, yoyo: true, hold: 300, ease: 'Quad.easeInOut', onComplete: () => this.pointerId === null && this.knob.setPosition(this.home.x, this.home.y) });
  }

  /**
   * (25-11-2026, usuario) tutorial nivel 2: joystick BLOQUEADO en GRIS con candado, como los botones bloqueados (ESPECIAL /
   * SAQUE DIRECTO); tocarlo hace temblar el candado
   */
  private locked = false;
  private lockIcon?: Phaser.GameObjects.Container;
  setLocked(on: boolean) {
    if (on === this.locked) return;
    this.locked = on;
    if (on) {
      this.release();
      if (!this.lockIcon) {
        const c = this.scene.add.container(0, 0).setScrollFactor(0).setDepth(5620);
        const g = this.scene.add.graphics();
        g.fillStyle(0x4b5262, 0.86).fillCircle(0, 0, this.radius + 14);
        g.lineStyle(5, 0x8a93a6, 0.9).strokeCircle(0, 0, this.radius + 14);
        // candado (gris claro, con la cerradura del gris del fondo)
        g.lineStyle(8, 0xc8d2ea, 1).beginPath().arc(0, -10, 18, Math.PI, 0, false).strokePath();
        g.fillStyle(0xc8d2ea, 1).fillRoundedRect(-28, -10, 56, 44, 8);
        g.fillStyle(0x4b5262, 1).fillCircle(0, 8, 7).fillRect(-3, 8, 6, 14);
        c.add(g);
        this.lockIcon = c;
      }
      this.lockIcon.setPosition(this.home.x, this.home.y).setVisible(true).setScale(0.5).setAlpha(0);
      this.scene.tweens.add({ targets: this.lockIcon, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
    } else if (this.lockIcon) {
      const ic = this.lockIcon;
      this.scene.tweens.add({ targets: ic, scale: 0.5, alpha: 0, duration: 180, onComplete: () => ic.setVisible(false) });
    }
  }

  /** (25-11-2026) primer partido del tutorial: el joystick, por encima del oscurecido de la guía y más visible */
  setSpotlight(on: boolean) {
    this.base.setDepth(on ? 5610 : 5000);
    this.knob.setDepth(on ? 5611 : 5001);
    this.setDim(on ? 2 : 1);
  }
  setDim(k: number) {
    this.dim = k;
    this.base.setAlpha((this.pointerId === null ? 0.28 : 0.55) * k);
    this.knob.setAlpha((this.pointerId === null ? 0.38 : 0.75) * k);
  }

  private onDown(p: Phaser.Input.Pointer) {
    if (!this.enabled || this.pointerId !== null) return;
    if (this.locked) {
      const ic = this.lockIcon;
      if (ic && p.x < this.scene.scale.width / 2) this.scene.tweens.add({ targets: ic, x: { from: this.home.x - 8, to: this.home.x }, duration: 260, ease: 'Elastic.easeOut' });
      return;
    }
    // zona del joystick: mitad izquierda, parte inferior de la pantalla (vertical)
    if (p.x > this.scene.scale.width * 0.55 || p.y < this.scene.scale.height * 0.4) return;
    this.pointerId = p.id;
    this.base.setPosition(p.x, p.y).setAlpha(0.55);
    this.knob.setPosition(p.x, p.y).setAlpha(0.75);
    this.scene.tweens.add({ targets: this.base, scale: { from: 0.8, to: 1 }, duration: 160, ease: 'Back.easeOut' });
    this.value.set(0, 0);
  }

  private onMove(p: Phaser.Input.Pointer) {
    if (p.id !== this.pointerId) return;
    const dx = p.x - this.base.x;
    const dy = p.y - this.base.y;
    const len = Math.hypot(dx, dy);
    const cl = Math.min(len, this.radius);
    const nx = len > 0 ? dx / len : 0;
    const ny = len > 0 ? dy / len : 0;
    this.knob.setPosition(this.base.x + nx * cl, this.base.y + ny * cl);
    const mag = cl / this.radius;
    // respuesta (src/logic/PlayerMotion.ts): zona muerta reescalada (sin salto al 12 %), curva suave
    // para los ajustes finos y velocidad máxima desde el 85 %. La dirección no se toca.
    const out = this.curve ? joyResponse(mag) : mag < 0.12 ? 0 : mag;
    if (out <= 0) this.value.set(0, 0);
    else this.value.set(nx * out, ny * out);
  }

  private onUp(p: Phaser.Input.Pointer) {
    if (p.id !== this.pointerId) return;
    this.pointerId = null;
    this.value.set(0, 0);
    this.scene.tweens.add({ targets: [this.base, this.knob], x: this.home.x, y: this.home.y, duration: 150, ease: 'Quad.easeOut' });
    this.setIdleLook();
  }

  release() {
    this.pointerId = null;
    this.value.set(0, 0);
    this.layout();
    this.setIdleLook();
  }
}
