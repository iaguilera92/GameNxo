import Phaser from 'phaser';
import type { InfernoElement } from './InfernoFx';

/** Colores del choque de una pelota con poder según su elemento (destello y onda). */
const POWER_WALL: Record<InfernoElement, { hot: number; ring: number }> = {
  fire: { hot: 0xffb347, ring: 0xff7a1e },
  ice: { hot: 0xbff0ff, ring: 0x4aa8ff },
  wind: { hot: 0xd8ffe0, ring: 0x3fd68a },
  lightning: { hot: 0xfff36b, ring: 0x3a7bff },
  tulip: { hot: 0xffd0e6, ring: 0xff6fae },
};

/**
 * Impacto de la pelota contra la pared del fondo (todo por código, sin sprites):
 *  - muro acolchado: destello, onda, chispas, marca en la pared que se desvanece, golpe seco y temblor leve;
 *  - valla de malla: ondas finas y vibración metálica (más suave);
 *  - pelota de fuego (SMASH / INFERNO): tonos naranjas, más chispas y algo más de temblor.
 * Cada objeto se destruye al acabar su animación; `count` dice cuántos quedan vivos.
 */
export class WallFx {
  private live = new Set<Phaser.GameObjects.GameObject>();
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  get count() {
    return this.live.size;
  }

  /**
   * (x, y) de pantalla del contacto; k = escala de perspectiva en la pared; depth = por delante de la pared.
   * `el`: poder de la bola del INFERNO que choca (colores de hielo, viento o rayo); el SMASH es siempre fuego.
   */
  impact(kind: 'pad' | 'fence', x: number, y: number, k: number, depth: number, power: boolean, el: InfernoElement = 'fire') {
    const sc = this.scene;
    const hot = power ? POWER_WALL[el].hot : 0xffffff;
    const ring = power ? POWER_WALL[el].ring : kind === 'pad' ? 0xffe066 : 0xbfe8ff;
    if (kind === 'pad') {
      // marca del golpe en la pared (se queda un momento)
      const mark = sc.add.ellipse(x, y + 2 * k, 30 * k, 22 * k, 0x0a1638, 0.45).setDepth(1.5); // marca (sombra) pegada a la pared: SIEMPRE detrás de los personajes y la pelota
      this.fade(mark, { alpha: 0 }, 300, 900);
      const flash = sc.add.circle(x, y, 14 * k, hot, 0.95).setDepth(depth + 1).setBlendMode(Phaser.BlendModes.ADD);
      this.fade(flash, { scale: power ? 2.6 : 1.9, alpha: 0 }, 180);
      const r = sc.add.circle(x, y, 12 * k, ring, 0).setStrokeStyle((power ? 6 : 4) * k, ring).setDepth(depth + 1).setBlendMode(Phaser.BlendModes.ADD);
      this.fade(r, { scale: power ? 4.2 : 3.2, alpha: 0 }, power ? 340 : 260);
      const n = power ? 12 : 8;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
        const d = (power ? 70 : 46) * k * (0.6 + Math.random() * 0.6);
        const p = sc.add.circle(x, y, (power ? 4 : 3) * k, i % 2 ? ring : hot, 1).setDepth(depth + 1).setBlendMode(Phaser.BlendModes.ADD);
        this.fade(p, { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.7, scale: 0.2, alpha: 0 }, 240 + Math.random() * 120);
      }
      sc.cameras.main.shake(power ? 140 : 90, power ? 0.009 : 0.004);
    } else {
      // valla: la malla vibra (ondas finas) y unas chispas pequeñas
      for (const [size, delay] of [[2.4, 0], [3.6, 70]] as const) {
        const e = sc.add.ellipse(x, y, 26 * k, 18 * k, ring, 0).setStrokeStyle(2 * k, ring, 0.9).setDepth(depth + 1);
        this.fade(e, { scale: size, alpha: 0 }, 300, delay);
      }
      for (let i = 0; i < 5; i++) {
        const p = sc.add.circle(x, y, 2.5 * k, hot, 1).setDepth(depth + 1);
        this.fade(p, { x: x + (Math.random() - 0.5) * 50 * k, y: y + Math.random() * 30 * k, alpha: 0 }, 260);
      }
      sc.cameras.main.shake(60, 0.002);
    }
    wallSound(sc, kind, power);
  }

  clear() {
    for (const o of [...this.live]) {
      this.scene.tweens.killTweensOf(o);
      this.kill(o);
    }
  }

  private fade(o: Phaser.GameObjects.GameObject, props: object, duration: number, delay = 0) {
    this.live.add(o);
    this.scene.tweens.add({ targets: o, ...props, duration, delay, ease: 'Quad.easeOut', onComplete: () => this.kill(o) });
  }

  private kill(o: Phaser.GameObjects.GameObject) {
    if (!this.live.delete(o)) return;
    o.destroy();
  }
}

/** Golpe seco (muro) o vibración metálica (valla), sintetizados (el juego no tiene archivos de sonido). */
function wallSound(scene: Phaser.Scene, kind: 'pad' | 'fence', power: boolean) {
  const ctx = (scene.sound as Phaser.Sound.WebAudioSoundManager)?.context as AudioContext | undefined;
  if (!ctx || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.value = kind === 'pad' ? 0.32 : 0.18;
  out.connect(ctx.destination);
  const len = Math.floor(ctx.sampleRate * (kind === 'pad' ? 0.09 : 0.16));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, kind === 'pad' ? 4 : 2);
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = kind === 'pad' ? 'lowpass' : 'bandpass';
  f.frequency.value = kind === 'pad' ? 700 : 3200;
  noise.connect(f).connect(out);
  noise.start(now);
  if (kind === 'pad') {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(power ? 120 : 150, now);
    o.frequency.exponentialRampToValueAtTime(60, now + 0.14);
    g.gain.setValueAtTime(0.9, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    o.connect(g).connect(out);
    o.start(now);
    o.stop(now + 0.17);
  }
}
