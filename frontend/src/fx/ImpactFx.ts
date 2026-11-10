import Phaser from 'phaser';
import { POWER_IMPACT, type PowerKind } from '../logic/PowerImpact';
import { BALL_ART, type InfernoElement } from './InfernoFx';

/**
 * Colores de las explosiones del INFERNO según el poder elegido (fuego, hielo, viento, rayo: domain/infernoPowers.ts).
 * Las mismas formas (lenguas, bocanadas, fragmentos) teñidas con los colores de cada poder.
 */
const BLAST: Record<InfernoElement, { flash: number; tongues: number[]; puffs: number[]; wave: number; frags: number[]; ground: number; groundFlash: number }> = {
  fire: { flash: 0xfff6c8, tongues: [0xff2a0a, 0xff6a12, 0xffa21a, 0xffd23a], puffs: [0xff3a0a, 0xff7a1a, 0xffb02a], wave: 0xffa21a, frags: [0xfff2a0, 0xffa31a, 0xff3d1a], ground: 0xff7a1a, groundFlash: 0xfff1a0 },
  ice: { flash: 0xeafcff, tongues: [0x2f8cff, 0x4aa8ff, 0x8fdcff, 0xd8f6ff], puffs: [0x2f8cff, 0x6fc4ff, 0xbff0ff], wave: 0x8fdcff, frags: [0xffffff, 0xbff0ff, 0x4aa8ff], ground: 0x6fc4ff, groundFlash: 0xeafcff },
  wind: { flash: 0xf0fff0, tongues: [0x2fbf6a, 0x5fd68a, 0x9cf0b0, 0xe0ffe8], puffs: [0x3fd68a, 0x8ff0b0, 0xd0ffe0], wave: 0x8ff0b0, frags: [0xffffff, 0xb8ff9a, 0x5fd16f], ground: 0x6fe0a0, groundFlash: 0xf0fff0 },
  lightning: { flash: 0xfffbe0, tongues: [0x2f6bff, 0x5aa8ff, 0xfff36b, 0xffffff], puffs: [0x2f6bff, 0x6fb4ff, 0xbfe0ff], wave: 0xfff36b, frags: [0xffffff, 0xfff36b, 0x5aa8ff], ground: 0x5aa8ff, groundFlash: 0xfffbe0 },
};

/**
 * Explosión al impactar SMASH / INFERNO DRIVE contra el rival (solo visual, procedural y breve).
 *   SMASH    energía blanca y dorada + líneas de impacto radiales
 *   INFERNO  fuego naranja, rojo y amarillo (o hielo azul, `el`) + núcleo luminoso + onda expansiva
 * Ambas: destello blanco inicial muy breve, expansión rápida, chispas/fragmentos y sacudida moderada.
 * Pocos objetos de vida corta (≈ 30) que se destruyen solos.
 */
export function powerImpactFx(scene: Phaser.Scene, kind: PowerKind, x: number, y: number, k: number, el: InfernoElement = 'fire') {
  const D = 3800; // por encima de personajes y pelota
  const s = Math.max(0.7, k);
  const ADD = Phaser.BlendModes.ADD;
  const fade = (o: Phaser.GameObjects.GameObject & { setScale(v: number): unknown }, props: Phaser.Types.Tweens.TweenBuilderConfig | object, ms: number, delay = 0) =>
    scene.tweens.add({ targets: o, ...props, delay, duration: ms, onComplete: () => o.destroy() });

  if (kind === 'smash') {
    // destello blanco inicial (muy breve)
    const flash = scene.add.circle(x, y, 46 * s, 0xffffff, 0.95).setDepth(D + 2).setBlendMode(ADD);
    fade(flash, { scale: 2.2, alpha: 0, ease: 'Quad.easeOut' }, 110);
    // núcleo de energía blanca/dorada que se expande
    const core = scene.add.circle(x, y, 30 * s, 0xfff4c2, 0.9).setDepth(D + 1).setBlendMode(ADD);
    fade(core, { scale: 3.4, alpha: 0, ease: 'Cubic.easeOut' }, 300);
    const ring = scene.add.circle(x, y, 26 * s, 0xffffff, 0).setStrokeStyle(6, 0xffd23f, 1).setDepth(D + 1).setBlendMode(ADD);
    fade(ring, { scale: 5, alpha: 0, ease: 'Cubic.easeOut' }, 360);
    // líneas de impacto radiales (manga)
    const lines = scene.add.graphics({ x, y }).setDepth(D).setBlendMode(ADD);
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.12, 0.12);
      const r0 = 34 * s;
      const r1 = Phaser.Math.FloatBetween(110, 170) * s;
      lines.lineStyle(i % 2 ? 6 : 3, i % 3 ? 0xffffff : 0xffd23f, 0.95).lineBetween(Math.cos(a) * r0, Math.sin(a) * r0 * 0.8, Math.cos(a) * r1, Math.sin(a) * r1 * 0.8);
    }
    lines.setScale(0.6);
    fade(lines, { scale: 1.25, alpha: 0, ease: 'Quad.easeOut' }, 280);
    sparks(scene, x, y, s, [0xffffff, 0xfff1b8, 0xffd23f], 14, D);
  } else {
    infernoBlast(scene, x, y, s, D, el);
  }

  const sh = POWER_IMPACT.shake[kind];
  scene.cameras.main.shake(sh.ms, sh.intensity);
}

/**
 * Explosión de fuego de INFERNO DRIVE (descarga violenta, no un disco plano):
 *   0–60 ms     destello blanco-amarillo intenso en el contacto
 *   60–180 ms   estallido de llamas irregulares (naranja, rojo, amarillo) que se abre rápido + la propia
 *               bola de fuego animada que revienta + onda expansiva
 *   180–350 ms  fragmentos de fuego y chispas que se dispersan y se apagan
 * Usa las texturas de fuego ya creadas (resplandor, lengua de fuego y la hoja de la bola); si no están,
 * círculos de respaldo.
 */
function infernoBlast(scene: Phaser.Scene, x: number, y: number, s0: number, D: number, el: InfernoElement) {
  const s = s0 * 1.45; // grande: se lee bien aunque el rival esté al fondo de la cancha
  const ADD = Phaser.BlendModes.ADD;
  const has = (k: string) => scene.textures.exists(k);
  const kill = (o: Phaser.GameObjects.GameObject) => () => o.destroy();
  const C = BLAST[el];
  // 0–60: destello blanco-amarillo (blanco-azulado con hielo)
  const flash = has('fx-inferno-glow')
    ? scene.add.image(x, y, 'fx-inferno-glow').setTint(C.flash).setDisplaySize(150 * s, 150 * s)
    : scene.add.circle(x, y, 70 * s, C.flash, 1);
  flash.setDepth(D + 3).setBlendMode(ADD);
  scene.tweens.add({ targets: flash, scale: flash.scale * 1.6, alpha: 0, duration: 60, ease: 'Quad.easeOut', onComplete: kill(flash) });

  // 60–180: la bola (de fuego o de hielo) revienta (frame animado agrandándose) + llamas irregulares hacia fuera
  const art = has(BALL_ART[el].key) ? BALL_ART[el] : BALL_ART.fire;
  if (has(art.key)) {
    const ball = scene.add.sprite(x, y, art.key, 0).setDisplaySize(90 * s, 90 * s).setDepth(D + 1).setBlendMode(ADD);
    if (scene.anims.exists(art.anim)) ball.play(art.anim);
    scene.tweens.add({ targets: ball, scale: ball.scale * 3.2, alpha: 0, delay: 20, duration: 240, ease: 'Cubic.easeOut', onComplete: kill(ball) });
  }
  const tongues = has('fx-inferno-tongue');
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.18, 0.18);
    const len = Phaser.Math.FloatBetween(90, 160) * s;
    const col = Phaser.Utils.Array.GetRandom(C.tongues);
    const f = tongues
      ? scene.add.image(x, y, 'fx-inferno-tongue').setOrigin(0.5, 0.95).setRotation(a + Math.PI / 2).setTint(col).setDisplaySize(36 * s, 30 * s)
      : scene.add.circle(x, y, 12 * s, col, 1);
    f.setDepth(D + 2).setBlendMode(ADD).setAlpha(0);
    const sy = (f.scaleY * len) / (30 * s);
    scene.tweens.add({ targets: f, alpha: { from: 1, to: 1 }, scaleY: sy, delay: 50, duration: 120, ease: 'Cubic.easeOut' });
    scene.tweens.add({ targets: f, alpha: 0, x: x + Math.cos(a) * len * 0.35, y: y + Math.sin(a) * len * 0.3, delay: 170, duration: 180, ease: 'Quad.easeIn', onComplete: kill(f) });
  }
  // nube de fuego irregular (varias bocanadas que se abren a la vez)
  for (let i = 0; i < 7; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Phaser.Math.FloatBetween(10, 34) * s;
    const p = has('fx-inferno-glow')
      ? scene.add.image(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.8, 'fx-inferno-glow').setTint(Phaser.Utils.Array.GetRandom(C.puffs)).setDisplaySize(70 * s, 70 * s)
      : scene.add.circle(x, y, 30 * s, C.puffs[1], 0.9);
    p.setDepth(D + 1).setBlendMode(ADD).setAlpha(0);
    scene.tweens.add({ targets: p, alpha: { from: 0.95, to: 0 }, scale: p.scale * Phaser.Math.FloatBetween(2.2, 3.2), x: x + Math.cos(a) * r * 3, y: y + Math.sin(a) * r * 2.4, delay: 55, duration: 260, ease: 'Cubic.easeOut', onComplete: kill(p) });
  }
  // onda expansiva
  const wave = scene.add.circle(x, y, 26 * s, 0xffffff, 0).setStrokeStyle(7, C.wave, 1).setDepth(D).setBlendMode(ADD);
  scene.tweens.add({ targets: wave, scale: 6.5, alpha: 0, delay: 60, duration: 300, ease: 'Cubic.easeOut', onComplete: kill(wave) });

  // 180–350: fragmentos de fuego y chispas
  for (let i = 0; i < 16; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = Phaser.Math.FloatBetween(110, 220) * s;
    const frag = scene.add.star(x, y, Phaser.Math.Between(3, 5), 2 * s, Phaser.Math.FloatBetween(5, 9) * s, Phaser.Utils.Array.GetRandom(C.frags)).setDepth(D + 2).setBlendMode(ADD).setAlpha(0);
    scene.tweens.add({ targets: frag, alpha: { from: 1, to: 0 }, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.7, angle: 300, scale: 0.3, delay: Phaser.Math.Between(120, 180), duration: Phaser.Math.Between(170, 230), ease: 'Cubic.easeOut', onComplete: kill(frag) });
  }
}

/**
 * INFERNO DRIVE: explosión de fuego en el PRIMER bote (punto exacto del suelo). Solo visual, ~400 ms:
 *   contacto     destello naranja/amarillo intenso
 *   enseguida    llamas irregulares que se abren a ras de suelo (aplastadas por la perspectiva)
 *   a los lados  chispas ardientes
 *   suelo        resplandor cálido que se apaga
 * Sin círculos planos ni anillos: todo con texturas de fuego suaves (las de InfernoFx) y lenguas de fuego.
 */
export function infernoGroundFx(scene: Phaser.Scene, x: number, y: number, k: number, el: InfernoElement = 'fire') {
  const C = BLAST[el]; // con hielo: escarcha azul en vez de fuego, mismas formas
  const s = Math.max(0.7, k) * 1.2;
  const ADD = Phaser.BlendModes.ADD;
  const glowTex = scene.textures.exists('fx-inferno-glow') ? 'fx-inferno-glow' : null;
  const tongueTex = scene.textures.exists('fx-inferno-tongue') ? 'fx-inferno-tongue' : null;
  const D = y + 3; // a la profundidad del bote: los personajes por delante siguen por delante
  const kill = (o: Phaser.GameObjects.GameObject) => () => o.destroy();
  const soft = (col: number, w: number, h: number, depth: number) =>
    (glowTex ? scene.add.image(x, y, glowTex).setTint(col).setDisplaySize(w, h) : scene.add.ellipse(x, y, w * 0.6, h * 0.6, col, 0.8)).setDepth(depth).setBlendMode(ADD);

  // resplandor cálido en el suelo (aplastado, sin borde)
  const warm = soft(C.ground, 260 * s, 80 * s, D - 1);
  warm.setAlpha(0.9);
  scene.tweens.add({ targets: warm, alpha: 0, scaleX: warm.scaleX * 1.35, duration: 440, ease: 'Quad.easeOut', onComplete: kill(warm) });
  // destello del contacto
  const flash = soft(C.groundFlash, 120 * s, 70 * s, D + 2);
  scene.tweens.add({ targets: flash, alpha: 0, scaleX: flash.scaleX * 1.8, scaleY: flash.scaleY * 1.4, duration: 90, ease: 'Quad.easeOut', onComplete: kill(flash) });

  // llamas irregulares que se abren horizontalmente sobre la cancha
  const n = 11;
  for (let i = 0; i < n; i++) {
    const a = Math.PI + (i / (n - 1)) * Math.PI + Phaser.Math.FloatBetween(-0.12, 0.12); // hacia arriba y a los lados
    const spread = Phaser.Math.FloatBetween(50, 110) * s;
    const col = Phaser.Utils.Array.GetRandom(C.tongues);
    const f = tongueTex
      ? scene.add.image(x, y, tongueTex).setOrigin(0.5, 0.95).setTint(col).setRotation(Math.cos(a) * 1.1).setDisplaySize(26 * s, Phaser.Math.FloatBetween(50, 95) * s)
      : scene.add.ellipse(x, y, 16 * s, 40 * s, col, 1);
    f.setDepth(D + 1).setBlendMode(ADD).setScale(f.scaleX * 0.4, f.scaleY * 0.3);
    const tx = x + Math.cos(a) * spread;
    scene.tweens.add({ targets: f, x: tx, scaleX: f.scaleX * 2.4, scaleY: f.scaleY * 3.2, duration: 150, ease: 'Cubic.easeOut' });
    scene.tweens.add({ targets: f, alpha: 0, y: y - Phaser.Math.FloatBetween(12, 30) * s, delay: 140, duration: Phaser.Math.Between(200, 280), ease: 'Quad.easeIn', onComplete: kill(f) });
  }
  // bocanadas de fuego a ras de suelo
  for (let i = 0; i < 6; i++) {
    const dir = i % 2 ? 1 : -1;
    const p = soft(Phaser.Utils.Array.GetRandom(C.puffs), 70 * s, 40 * s, D + 0.5);
    p.setAlpha(0.95);
    scene.tweens.add({ targets: p, x: x + dir * Phaser.Math.FloatBetween(40, 120) * s, y: y - Phaser.Math.FloatBetween(0, 14) * s, scaleX: p.scaleX * 1.8, alpha: 0, duration: Phaser.Math.Between(300, 420), ease: 'Cubic.easeOut', onComplete: kill(p) });
  }
  // chispas ardientes hacia los lados
  for (let i = 0; i < 12; i++) {
    const dir = i % 2 ? 1 : -1;
    const sp = scene.add.star(x, y - 6 * s, 4, 1.5 * s, 4.5 * s, Phaser.Utils.Array.GetRandom(C.frags)).setDepth(D + 2).setBlendMode(ADD);
    scene.tweens.add({
      targets: sp,
      x: x + dir * Phaser.Math.FloatBetween(70, 170) * s,
      y: y - Phaser.Math.FloatBetween(10, 60) * s,
      angle: 260,
      alpha: 0,
      scale: 0.3,
      duration: Phaser.Math.Between(280, 420),
      ease: 'Cubic.easeOut',
      onComplete: kill(sp),
    });
  }
}

/** Chispas y fragmentos luminosos que salen y desaparecen. */
function sparks(scene: Phaser.Scene, x: number, y: number, s: number, cols: number[], n: number, depth: number) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = Phaser.Math.FloatBetween(90, 190) * s;
    const p = scene.add.star(x, y, 4, 2, 6 * s, Phaser.Utils.Array.GetRandom(cols)).setDepth(depth + 1).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: p, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.7, angle: 280, alpha: 0, scale: 0.3, duration: Phaser.Math.Between(320, 520), ease: 'Cubic.easeOut', onComplete: () => p.destroy() });
  }
}
