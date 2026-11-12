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
   * `el`: poder de la bola que choca (ESPECIAL o ULTI): sus colores y su choque propio (elementHit).
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
      sc.cameras.main.shake(60, power ? 0.006 : 0.002);
    }
    // bola con poder: además de sus colores, el choque propio de su elemento (hielo, rayo, viento, tulipán)
    if (power) this.elementHit(el, x, y, k, depth);
    wallSound(sc, kind, power);
    if (power) elementSound(sc, el);
  }

  /**
   * Choque propio de cada poder contra la pared o la valla (ESPECIAL o ULTI):
   *   fuego    brasas que suben (además de las chispas naranjas de siempre)
   *   hielo    esquirlas de cristal que saltan + escarcha que queda pegada un momento
   *   rayo     descarga en zigzag que recorre la pared y parpadea
   *   viento   remolino que se abre + hojas y ráfagas a los lados
   *   tulipán  pétalos que caen
   */
  private elementHit(el: InfernoElement, x: number, y: number, k: number, depth: number) {
    const sc = this.scene;
    const ADD = Phaser.BlendModes.ADD;
    const R = (a: number, b: number) => a + Math.random() * (b - a);
    if (el === 'ice') {
      const frost = sc.add.ellipse(x, y, 60 * k, 40 * k, 0xbff0ff, 0.45).setDepth(1.6).setBlendMode(ADD);
      this.fade(frost, { alpha: 0, scale: 1.3 }, 700, 500);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + R(-0.2, 0.2);
        const d = R(40, 90) * k;
        const L = R(9, 16) * k;
        const W = R(3, 5) * k;
        const sh = sc.add.polygon(x, y, [W / 2, 0, W, L / 2, W / 2, L, 0, L / 2], i % 3 ? 0xbff0ff : 0xffffff, 1).setRotation(a + Math.PI / 2).setDepth(depth + 2).setBlendMode(ADD);
        this.fade(sh, { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.7 + 20 * k, rotation: sh.rotation + R(-1.5, 1.5), alpha: 0 }, R(320, 520));
      }
      const flake = sc.add.star(x, y, 6, 4 * k, 22 * k, 0xffffff, 0.9).setDepth(depth + 2).setBlendMode(ADD).setScale(0.3);
      this.fade(flake, { scale: 1.4, angle: 30, alpha: 0 }, 420);
    } else if (el === 'lightning') {
      const g = sc.add.graphics().setDepth(depth + 2).setBlendMode(ADD);
      this.live.add(g);
      const arcs = Array.from({ length: 6 }, (_, i) => ({ a: (i / 6) * Math.PI * 2 + R(-0.3, 0.3), L: R(50, 100) * k }));
      const draw = (alpha: number) => {
        g.clear();
        for (const c of arcs) {
          const ex = x + Math.cos(c.a) * c.L;
          const ey = y + Math.sin(c.a) * c.L * 0.6;
          for (const [w, col, al] of [
            [6, 0x3a7bff, 0.35],
            [3, 0x9fe2ff, 0.85],
            [1.5, 0xffffff, 1],
          ] as const) {
            g.lineStyle(w * k, col, al * alpha).beginPath().moveTo(x, y);
            for (let j = 1; j <= 4; j++) {
              const o = j < 4 ? R(-8, 8) * k : 0;
              g.lineTo(x + ((ex - x) * j) / 4 - Math.sin(c.a) * o, y + ((ey - y) * j) / 4 + Math.cos(c.a) * o);
            }
            g.strokePath();
          }
        }
      };
      draw(1);
      sc.time.delayedCall(60, () => g.active && draw(0.9));
      sc.time.delayedCall(130, () => g.active && draw(0.7));
      sc.time.delayedCall(210, () => g.active && draw(0.4));
      sc.time.delayedCall(280, () => this.kill(g));
      const flash = sc.add.circle(x, y, 30 * k, 0xfff36b, 0.7).setDepth(depth + 1).setBlendMode(ADD);
      this.fade(flash, { scale: 2.6, alpha: 0 }, 160);
    } else if (el === 'wind') {
      const swirl = sc.add.container(x, y).setDepth(depth + 2).setScale(0.4, 0.3);
      for (let i = 0; i < 4; i++) {
        const g = sc.add.graphics().setBlendMode(ADD);
        const a0 = (i / 4) * Math.PI * 2;
        g.lineStyle(R(3, 5) * k, i % 2 ? 0x9cf0b0 : 0xe0ffe8, 0.9).beginPath().arc(0, 0, R(26, 46) * k, a0, a0 + 1.8).strokePath();
        swirl.add(g);
      }
      this.fade(swirl, { angle: -420, scaleX: 1.6, scaleY: 1.1, alpha: 0 }, 460);
      for (let i = 0; i < 10; i++) {
        const a = R(0, Math.PI * 2);
        const d = R(50, 110) * k;
        const leaf = sc.add.ellipse(x, y, 11 * k, 5 * k, [0x5fd16f, 0x3fa85a, 0xb8ff9a][i % 3], 1).setRotation(a).setDepth(depth + 2);
        this.fade(leaf, { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.6 + 26 * k, rotation: a + R(4, 8), alpha: 0 }, R(420, 620));
      }
      for (const dir of [-1, 1]) {
        const g = sc.add.graphics({ x, y }).setDepth(depth + 1).setBlendMode(ADD);
        g.lineStyle(3 * k, 0xe0ffe8, 0.8).beginPath().moveTo(0, 0).lineTo(dir * 30 * k, -5 * k).lineTo(dir * 60 * k, 0).strokePath();
        this.fade(g, { x: x + dir * 90 * k, alpha: 0, scaleX: 1.5 }, 380);
      }
    } else if (el === 'tulip') {
      for (let i = 0; i < 12; i++) {
        const p = sc.add.ellipse(x + R(-20, 20) * k, y + R(-10, 10) * k, 10 * k, 6 * k, [0xff6fae, 0xffb3d6, 0xe0457f][i % 3], 1).setRotation(R(0, 3)).setDepth(depth + 2);
        this.fade(p, { x: p.x + R(-60, 60) * k, y: p.y + R(40, 90) * k, rotation: p.rotation + R(2, 5), alpha: 0 }, R(600, 900));
      }
    } else {
      // fuego: brasas que suben despacio
      for (let i = 0; i < 8; i++) {
        const e = sc.add.star(x + R(-24, 24) * k, y, 4, 1.2 * k, 3.5 * k, [0xffd23a, 0xff7a1a, 0xfff2a0][i % 3], 1).setDepth(depth + 2).setBlendMode(ADD);
        this.fade(e, { y: e.y - R(40, 90) * k, x: e.x + R(-14, 14) * k, alpha: 0 }, R(500, 800), R(40, 160));
      }
    }
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

/** Sonido propio del poder al chocar: chasquido eléctrico (rayo), tintineo (hielo) o ráfaga (viento). */
function elementSound(scene: Phaser.Scene, el: InfernoElement) {
  const ctx = (scene.sound as Phaser.Sound.WebAudioSoundManager)?.context as AudioContext | undefined;
  if (!ctx || ctx.state !== 'running' || (el !== 'lightning' && el !== 'ice' && el !== 'wind')) return;
  const now = ctx.currentTime;
  if (el === 'ice') {
    // tintineo de cristal: dos notas agudas cortas
    [2093, 2794].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const t0 = now + i * 0.05;
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
      o.connect(g).connect(ctx.destination);
      o.start(t0);
      o.stop(t0 + 0.27);
    });
    return;
  }
  // rayo: ruido agudo y seco · viento: ruido que barre de grave a agudo
  const dur = el === 'lightning' ? 0.14 : 0.45;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = el === 'lightning' ? 'highpass' : 'bandpass';
  f.frequency.setValueAtTime(el === 'lightning' ? 3000 : 500, now);
  f.frequency.exponentialRampToValueAtTime(el === 'lightning' ? 1800 : 1600, now + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(el === 'lightning' ? 0.25 : 0.2, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(now);
  src.stop(now + dur);
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
