import Phaser from 'phaser';
import { VIEW, project } from '../view/projection';

/**
 * EFECTOS VISUALES de los DEFENSIVOS (portal del DESTELLO y del DASH, polvo, despegue y aterrizaje del SUPERSALTO, humo de la SOMBRA, caída de la
 * VOLTERETA). Los usan el partido (`MatchScene`: usuario y rival online) y la demostración del selector de PERSONALIZAR (`fx/powerDemo.ts`), así que
 * lo que se ve en el selector es exactamente lo del partido. Solo dibujan: la sacudida de cámara, la vibración, el sonido y el agachado
 * del personaje los pone quien los llama.
 *
 * `st` es la escena (o un escenario con `add` y `tweens`): los objetos que crean se destruyen solos al terminar su animación.
 * Las posiciones son coordenadas de CANCHA (se proyectan aquí) salvo donde dice "pantalla".
 */
export type FxStage = Pick<Phaser.Scene, 'add' | 'tweens'>;

const rand = Phaser.Math.FloatBetween;

/** Portal: anillo en el suelo que se abre y chispas que suben (DASH de teletransporte y DESTELLO). */
export function portal(st: FxStage, x: number, y: number, col = 0x9b5cff, light = 0xe6d2ff) {
  const p = project(x, y);
  const k = p.s * VIEW.CHAR_K;
  const ring = st.add.ellipse(p.sx, p.sy, 120 * k, 40 * k, col, 0.55).setStrokeStyle(5, light).setDepth(p.sy - 1);
  st.tweens.add({ targets: ring, scaleX: 1.8, scaleY: 1.8, alpha: 0, duration: 380, onComplete: () => ring.destroy() });
  for (let i = 0; i < 12; i++) {
    const s = st.add
      .circle(p.sx + rand(-40, 40) * k, p.sy - rand(0, 140) * k, rand(3, 7) * k, Phaser.Utils.Array.GetRandom([col, light, 0xffffff]))
      .setDepth(p.sy + 5)
      .setBlendMode(Phaser.BlendModes.ADD);
    st.tweens.add({ targets: s, y: s.y - rand(30, 80) * k, alpha: 0, duration: rand(250, 450), onComplete: () => s.destroy() });
  }
}

/** Polvo en los pies. */
export function dust(st: FxStage, x: number, y: number) {
  const p = project(x, y);
  for (let i = 0; i < 6; i++) {
    const d = st.add.ellipse(p.sx + rand(-30, 30) * p.s, p.sy + rand(-4, 4), rand(14, 24) * p.s, rand(8, 12) * p.s, 0xe8e2d0, 0.7).setDepth(p.sy + 1);
    st.tweens.add({ targets: d, x: d.x + rand(-40, 40) * p.s, y: d.y - rand(6, 20), scale: 1.8, alpha: 0, duration: rand(300, 480), onComplete: () => d.destroy() });
  }
}

/** SUPERSALTO (despegue): anillo de impulso, destello y columna de luz. */
export function jumpTakeoff(st: FxStage, x: number, y: number) {
  const p = project(x, y);
  const k = p.s * VIEW.CHAR_K;
  const ring = st.add.ellipse(p.sx, p.sy, 80 * k, 26 * k, 0xff9a3d, 0.3).setStrokeStyle(5 * k, 0xffe0b0, 0.95).setDepth(p.sy - 0.5).setBlendMode(Phaser.BlendModes.ADD);
  st.tweens.add({ targets: ring, scaleX: 2.8, scaleY: 2.8, alpha: 0, duration: 300, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
  const col = st.add.rectangle(p.sx, p.sy - 60 * k, 26 * k, 120 * k, 0xffd7a0, 0.5).setDepth(p.sy + 1).setBlendMode(Phaser.BlendModes.ADD);
  st.tweens.add({ targets: col, scaleX: 0.2, scaleY: 1.6, y: col.y - 40 * k, alpha: 0, duration: 260, ease: 'Quad.easeOut', onComplete: () => col.destroy() });
}

/** SUPERSALTO (aterrizaje): dos ondas de choque, polvo, grietas y trozos de cancha. */
export function jumpLand(st: FxStage, x: number, y: number) {
  const p = project(x, y);
  const k = p.s * VIEW.CHAR_K;
  for (const [d, col] of [[0, 0xffffff], [80, 0xff9a3d]] as const) {
    const ring = st.add.ellipse(p.sx, p.sy, 90 * k, 30 * k).setStrokeStyle(6 * k, col, 0.95).setDepth(p.sy - 0.5).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    st.tweens.add({ targets: ring, scale: 3.2, alpha: { from: 0.95, to: 0 }, delay: d, duration: 420, ease: 'Cubic.easeOut', onStart: () => ring.setAlpha(0.95), onComplete: () => ring.destroy() });
  }
  dust(st, x, y);
  jumpCrack(st, p.sx, p.sy, k);
}

/** Grietas en el suelo que se abren desde el punto de caída, destello naranja y trozos de cancha (pantalla: sx, sy; k = escala del personaje). */
export function jumpCrack(st: FxStage, sx: number, sy: number, k: number) {
  const ADD = Phaser.BlendModes.ADD;
  const flash = st.add.ellipse(sx, sy, 70 * k, 24 * k, 0xffd7a0, 0.9).setDepth(sy + 2).setBlendMode(ADD);
  st.tweens.add({ targets: flash, scaleX: 3, scaleY: 2.4, alpha: 0, duration: 200, ease: 'Quad.easeOut', onComplete: () => flash.destroy() });
  const g = st.add.graphics().setDepth(sy - 1);
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand(-0.2, 0.2);
    const len = rand(70, 130) * k;
    let px = sx;
    let py = sy;
    g.lineStyle(Math.max(2, 4 * k), 0x2a1608, 0.85);
    g.beginPath();
    g.moveTo(px, py);
    for (let s = 1; s <= 4; s++) {
      const d = (len * s) / 4;
      const j = rand(-10, 10) * k;
      px = sx + (Math.cos(a) * d - Math.sin(a) * j);
      py = sy + (Math.sin(a) * d + Math.cos(a) * j) * 0.34; // aplastado: suelo en perspectiva
      g.lineTo(px, py);
    }
    g.strokePath();
    g.lineStyle(Math.max(1, 1.6 * k), 0xff9a3d, 0.9); // brillo naranja dentro de la grieta
    g.beginPath();
    g.moveTo(sx, sy);
    g.lineTo(px, py);
    g.strokePath();
  }
  st.tweens.add({ targets: g, alpha: 0, delay: 450, duration: 450, onComplete: () => g.destroy() });
  // trozos de cancha: suben y caen
  for (let i = 0; i < 9; i++) {
    const a = rand(0, Math.PI * 2);
    const d = rand(30, 90) * k;
    const rock = st.add.rectangle(sx, sy, rand(5, 10) * k, rand(4, 8) * k, Phaser.Utils.Array.GetRandom([0x6b4a2a, 0x8a6338, 0xb58a52])).setDepth(sy + 3).setAngle(rand(0, 360));
    const top = sy - rand(40, 90) * k;
    const x1 = sx + Math.cos(a) * d;
    st.tweens.add({
      targets: rock,
      x: x1,
      y: top,
      angle: rock.angle + rand(-200, 200),
      duration: 180,
      ease: 'Quad.easeOut',
      onComplete: () => st.tweens.add({ targets: rock, y: sy + Math.sin(a) * d * 0.25, alpha: 0, duration: 230, ease: 'Quad.easeIn', onComplete: () => rock.destroy() }),
    });
  }
}

/** SOMBRA (cambio de lugar): bocanada de humo negro con jirones morados que suben. `big` = donde apareces. */
export function shadowSmoke(st: FxStage, x: number, y: number, big: boolean) {
  const p = project(x, y);
  const k = p.s * VIEW.CHAR_K * (big ? 1.25 : 0.9);
  for (let i = 0; i < 9; i++) {
    const dark = st.add.circle(p.sx + rand(-26, 26) * k, p.sy - rand(0, 100) * k, rand(16, 28) * k, 0x0c0614, 0.6).setDepth(p.sy + 4);
    st.tweens.add({ targets: dark, x: dark.x + rand(-40, 40) * k, y: dark.y - rand(20, 70) * k, scale: rand(1.8, 2.6), alpha: 0, duration: rand(350, 600), ease: 'Cubic.easeOut', onComplete: () => dark.destroy() });
  }
  for (let i = 0; i < 8; i++) {
    const wisp = st.add.circle(p.sx + rand(-30, 30) * k, p.sy - rand(0, 110) * k, rand(4, 9) * k, Phaser.Utils.Array.GetRandom([0x9b4dff, 0xd0a8ff, 0x7a2fd6]), 0.8).setDepth(p.sy + 5).setBlendMode(Phaser.BlendModes.ADD);
    st.tweens.add({ targets: wisp, y: wisp.y - rand(50, 120) * k, alpha: 0, duration: rand(400, 700), ease: 'Quad.easeOut', onComplete: () => wisp.destroy() });
  }
}

/** SOMBRA: jirón de humo negro que deja el clon al correr (a lo sumo uno cada 45 ms). `now` = reloj de la escena; `at` = último instante en que soltó uno. */
export function shadowTrailPuff(st: FxStage, now: number, ch: Phaser.GameObjects.Container, at: { t: number }) {
  if (now - at.t < 45) return;
  at.t = now;
  const k = ch.scaleX;
  const dark = st.add.circle(ch.x + rand(-10, 10) * k, ch.y - rand(10, 70) * k, rand(10, 18) * k, 0x0c0614, 0.5).setDepth(ch.depth - 0.4);
  st.tweens.add({ targets: dark, y: dark.y - rand(10, 30) * k, scale: 1.9, alpha: 0, duration: 380, ease: 'Quad.easeOut', onComplete: () => dark.destroy() });
  const wisp = st.add.circle(ch.x + rand(-12, 12) * k, ch.y - rand(10, 80) * k, rand(2.5, 5) * k, 0xb57aff, 0.85).setDepth(ch.depth + 0.4).setBlendMode(Phaser.BlendModes.ADD);
  st.tweens.add({ targets: wisp, y: wisp.y - rand(30, 70) * k, alpha: 0, duration: 420, onComplete: () => wisp.destroy() });
}

/** VOLTERETA (caída): ondita blanca y polvo. */
export function flipLand(st: FxStage, x: number, y: number) {
  const p = project(x, y);
  const k = p.s * VIEW.CHAR_K;
  const ring = st.add.ellipse(p.sx, p.sy, 80 * k, 26 * k).setStrokeStyle(5 * k, 0xffffff, 0.95).setDepth(p.sy - 0.5).setBlendMode(Phaser.BlendModes.ADD);
  st.tweens.add({ targets: ring, scale: 2.6, alpha: 0, duration: 360, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
  dust(st, x, y);
}
