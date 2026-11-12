import Phaser from 'phaser';
import { BALL_ART, ballDims, type InfernoElement } from './InfernoFx';

/**
 * Impactos PROPIOS de la ULTI de RAYO y de VIENTO (cada poder tiene sus efectos; fuego, hielo y tulipán usan las
 * llamas teñidas de ImpactFx). Solo visual + sonido sintetizado; objetos de vida corta que se destruyen solos.
 *   lightningGroundFx / windGroundFx   primer bote de la ULTI en la cancha
 *   lightningBlast / windBlast          la ULTI alcanza a un personaje
 *   ultiStunFx                           efecto que se queda sobre el aturdido (electrocutado / remolino)
 */
const FB = Phaser.Math.FloatBetween;
const IB = Phaser.Math.Between;
const pick = <T>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];
/** Colores de la descarga: halo azul, cuerpo celeste, núcleo blanco y chispas amarillas. */
const ELEC = { halo: 0x2f6bff, mid: 0x7fd4ff, core: 0xffffff, spark: [0xffffff, 0xfff36b, 0x9fe2ff] as const };
const LEAF = [0x5fd16f, 0x3fa85a, 0xb8ff9a, 0x8fdc6a] as const;
const GUST = [0xe0ffe8, 0x9cf0b0, 0xffffff] as const;
const kill = (o: Phaser.GameObjects.GameObject) => () => o.destroy();

/** Rayo en zigzag (con `branches` ramas cortas) sobre un Graphics: halo azul, cuerpo celeste y núcleo blanco. */
function zap(g: Phaser.GameObjects.Graphics, x0: number, y0: number, x1: number, y1: number, jag: number, w: number, branches = 0, alpha = 1) {
  const n = 7;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const pts: [number, number][] = [[x0, y0]];
  for (let i = 1; i < n; i++) {
    const o = (Math.random() - 0.5) * 2 * jag;
    pts.push([x0 + (dx * i) / n + nx * o, y0 + (dy * i) / n + ny * o]);
  }
  pts.push([x1, y1]);
  for (const [lw, col, a] of [
    [w * 3.2, ELEC.halo, 0.3],
    [w * 1.7, ELEC.mid, 0.8],
    [w, ELEC.core, 1],
  ] as const) {
    g.lineStyle(lw, col, a * alpha).beginPath().moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.strokePath();
  }
  for (let b = 0; b < branches; b++) {
    const [bx, by] = pts[IB(2, n - 2)];
    const a = Math.atan2(dy, dx) + FB(0.5, 1.1) * (Math.random() < 0.5 ? -1 : 1);
    const L = len * FB(0.12, 0.25);
    zap(g, bx, by, bx + Math.cos(a) * L, by + Math.sin(a) * L, jag * 0.5, w * 0.6, 0, alpha * 0.9);
  }
}

/** Redibuja `draw(p)` cada `every` ms durante `ms` (parpadeo eléctrico) y luego destruye el Graphics. */
function flicker(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics, ms: number, every: number, draw: (p: number) => void) {
  const t0 = scene.time.now;
  const step = () => {
    if (!g.active) return;
    const p = (scene.time.now - t0) / ms;
    if (p >= 1) {
      g.destroy();
      return;
    }
    g.clear();
    draw(p);
    scene.time.delayedCall(every, step);
  };
  step();
}

/** Brillo suave (textura del INFERNO si existe). */
function softGlow(scene: Phaser.Scene, x: number, y: number, col: number, w: number, h: number, depth: number) {
  const o = scene.textures.exists('fx-inferno-glow') ? scene.add.image(x, y, 'fx-inferno-glow').setTint(col).setDisplaySize(w, h) : scene.add.ellipse(x, y, w * 0.6, h * 0.6, col, 0.8);
  return o.setDepth(depth).setBlendMode(Phaser.BlendModes.ADD);
}

/** La propia bola (rayo / viento) revienta agrandándose. */
function ballBurst(scene: Phaser.Scene, x: number, y: number, s: number, D: number, el: InfernoElement) {
  const art = BALL_ART[el];
  if (!scene.textures.exists(art.key)) return;
  const [bw, bh] = ballDims(art, 90 * s);
  const ball = scene.add.sprite(x, y, art.key, art.seq?.[0] ?? 0).setDisplaySize(bw, bh).setDepth(D + 1).setBlendMode(Phaser.BlendModes.ADD);
  if (scene.anims.exists(art.anim)) ball.play(art.anim);
  scene.tweens.add({ targets: ball, scale: ball.scale * 3, alpha: 0, delay: 20, duration: 240, ease: 'Cubic.easeOut', onComplete: kill(ball) });
}

/** Chispas que salen y se apagan. */
function burstSparks(scene: Phaser.Scene, x: number, y: number, s: number, cols: readonly number[], n: number, depth: number) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = FB(90, 190) * s;
    const p = scene.add.star(x, y, 4, 2, 6 * s, pick(cols)).setDepth(depth + 1).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: p, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.7, angle: 280, alpha: 0, scale: 0.3, duration: IB(320, 520), ease: 'Cubic.easeOut', onComplete: kill(p) });
  }
}

// ---------------------------------------------------------------- sonido
function audioCtx(scene: Phaser.Scene): AudioContext | null {
  const ctx = (scene.sound as unknown as { context?: AudioContext }).context;
  if (!ctx || scene.sound.mute) return null;
  if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);
  return ctx;
}

/** Ruido filtrado con caída (chasquido eléctrico o ráfaga de viento). */
function noise(ctx: AudioContext, dur: number, type: BiquadFilterType, f0: number, f1: number, vol: number, at = 0) {
  const t = ctx.currentTime + at;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  f.Q.value = 1.2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(t);
  src.stop(t + dur);
}

/** Trueno corto: chasquido agudo + retumbo grave. */
function thunderSound(scene: Phaser.Scene) {
  const ctx = audioCtx(scene);
  if (!ctx) return;
  noise(ctx, 0.12, 'highpass', 3000, 1800, 0.35);
  noise(ctx, 0.08, 'highpass', 4000, 2500, 0.25, 0.07);
  noise(ctx, 0.7, 'lowpass', 400, 60, 0.45, 0.03);
}

/** Ráfaga de viento que sube y se va. */
function gustSound(scene: Phaser.Scene) {
  const ctx = audioCtx(scene);
  if (!ctx) return;
  noise(ctx, 0.65, 'bandpass', 500, 1800, 0.32);
  noise(ctx, 0.5, 'bandpass', 1200, 400, 0.18, 0.15);
}

// ---------------------------------------------------------------- RAYO
/**
 * ULTI de RAYO en el bote: un rayo cae del cielo al punto exacto, la cancha se electrifica (arcos que corren a ras
 * de suelo), destello azul-blanco, marca chamuscada con grietas brillantes y chispas que saltan. ~0,5 s (+ marca).
 */
export function lightningGroundFx(scene: Phaser.Scene, x: number, y: number, k: number) {
  const s = Math.max(0.7, k) * 1.2;
  const D = y + 3;
  thunderSound(scene);
  scene.cameras.main.flash(90, 170, 200, 255);
  scene.cameras.main.shake(320, 0.018);

  // rayo del cielo (por encima de todo) que parpadea y se apaga
  const sky = scene.add.graphics().setDepth(3900).setBlendMode(Phaser.BlendModes.ADD);
  const topX = x + FB(-70, 70) * s;
  const topY = y - 620 * s;
  flicker(scene, sky, 300, 55, (p) => zap(sky, topX, topY, x, y, 34 * s, 4.5 * s, 3, p < 0.6 ? 1 : (1 - p) / 0.4));

  // destello y resplandor en el suelo
  const flash = softGlow(scene, x, y, 0xffffff, 150 * s, 80 * s, D + 2);
  scene.tweens.add({ targets: flash, alpha: 0, scaleX: flash.scaleX * 2, scaleY: flash.scaleY * 1.5, duration: 160, ease: 'Quad.easeOut', onComplete: kill(flash) });
  const glow = softGlow(scene, x, y, ELEC.mid, 300 * s, 90 * s, D - 1).setAlpha(0.9);
  scene.tweens.add({ targets: glow, alpha: 0, scaleX: glow.scaleX * 1.4, duration: 520, ease: 'Quad.easeOut', onComplete: kill(glow) });
  // onda eléctrica a ras de suelo
  for (let i = 0; i < 2; i++) {
    const w = scene.add.ellipse(x, y, 90 * s, 28 * s).setStrokeStyle(4 * s, i ? ELEC.mid : ELEC.core, 1).setDepth(D - 0.5).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: w, scale: 4.2 + i, alpha: 0, delay: i * 80, duration: 380, ease: 'Cubic.easeOut', onComplete: kill(w) });
  }

  // arcos que corren por la cancha desde el impacto (crecen y chisporrotean)
  const arcs = scene.add.graphics().setDepth(D + 1).setBlendMode(Phaser.BlendModes.ADD);
  const dirs = Array.from({ length: 7 }, (_, i) => ({ a: (i / 7) * Math.PI * 2 + FB(-0.3, 0.3), L: FB(80, 170) * s }));
  flicker(scene, arcs, 520, 45, (p) => {
    const grow = Math.min(1, p * 2.2);
    for (const d of dirs) {
      if (Math.random() < 0.25) continue; // cortes: chisporroteo
      zap(arcs, x, y, x + Math.cos(d.a) * d.L * grow, y + Math.sin(d.a) * d.L * grow * 0.32, 9 * s, 2.2 * s, 1, 1 - p * 0.7);
    }
  });

  // marca chamuscada con grietas que brillan y se apagan
  const scorch = scene.add.ellipse(x, y, 150 * s, 44 * s, 0x0a0f1c, 0.55).setDepth(D - 2).setScale(0.4);
  scene.tweens.add({ targets: scorch, scale: 1, duration: 120, ease: 'Cubic.easeOut' });
  scene.tweens.add({ targets: scorch, alpha: 0, delay: 900, duration: 700, ease: 'Quad.easeIn', onComplete: kill(scorch) });
  const cracks = scene.add.graphics().setDepth(D - 1.5).setBlendMode(Phaser.BlendModes.ADD);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + FB(-0.4, 0.4);
    const L = FB(40, 75) * s;
    zap(cracks, x, y, x + Math.cos(a) * L, y + Math.sin(a) * L * 0.3, 6 * s, 1.4 * s, 0, 0.8);
  }
  scene.tweens.add({ targets: cracks, alpha: { from: 1, to: 0.35 }, duration: 90, yoyo: true, repeat: 3 });
  scene.tweens.add({ targets: cracks, alpha: 0, delay: 700, duration: 600, onComplete: kill(cracks) });

  // chispas que saltan y caen (trazos orientados según su vuelo)
  for (let i = 0; i < 16; i++) {
    const sp = scene.add.rectangle(x, y - 4 * s, FB(5, 10) * s, 1.8 * s, pick(ELEC.spark), 1).setDepth(D + 2).setBlendMode(Phaser.BlendModes.ADD);
    const dx = FB(-1, 1) * FB(50, 150) * s;
    const up = FB(40, 110) * s;
    const t = { p: 0 };
    scene.tweens.add({
      targets: t,
      p: 1,
      duration: IB(320, 520),
      onUpdate: () => {
        const px = x + dx * t.p;
        const py = y - 4 * s - up * 4 * t.p * (1 - t.p);
        sp.setRotation(Math.atan2(py - sp.y, px - sp.x)).setPosition(px, py).setAlpha(1 - t.p * 0.8);
      },
      onComplete: kill(sp),
    });
  }
}

/** ULTI de RAYO contra un personaje: descarga radial que parpadea, anillos eléctricos, destello y chispas. */
export function lightningBlast(scene: Phaser.Scene, x: number, y: number, s0: number, D: number) {
  const s = s0 * 1.35;
  thunderSound(scene);
  scene.cameras.main.flash(70, 170, 200, 255);
  const flash = softGlow(scene, x, y, 0xffffff, 150 * s, 150 * s, D + 3);
  scene.tweens.add({ targets: flash, scale: flash.scale * 1.7, alpha: 0, duration: 110, ease: 'Quad.easeOut', onComplete: kill(flash) });
  ballBurst(scene, x, y, s, D, 'lightning');
  const halo = softGlow(scene, x, y, ELEC.mid, 160 * s, 160 * s, D + 1);
  scene.tweens.add({ targets: halo, scale: halo.scale * 2.4, alpha: 0, duration: 340, ease: 'Cubic.easeOut', onComplete: kill(halo) });
  const g = scene.add.graphics().setDepth(D + 2).setBlendMode(Phaser.BlendModes.ADD);
  flicker(scene, g, 260, 50, (p) => {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.random() * 0.5;
      const L = FB(80, 170) * s * (0.6 + p * 0.6);
      zap(g, x, y, x + Math.cos(a) * L, y + Math.sin(a) * L * 0.8, 12 * s, 2.6 * s, 1, 1 - p * 0.6);
    }
  });
  for (let i = 0; i < 2; i++) {
    const ring = scene.add.ellipse(x, y, 50 * s, 42 * s).setStrokeStyle(5 * s, i ? ELEC.halo : ELEC.mid, 1).setDepth(D).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: ring, scale: 5, alpha: 0, delay: i * 70, duration: 340, ease: 'Cubic.easeOut', onComplete: kill(ring) });
  }
  burstSparks(scene, x, y, s, ELEC.spark, 16, D);
}

// ---------------------------------------------------------------- VIENTO
/** Brazo de remolino (arco) dentro de un contenedor aplastado: gira sobre el suelo sin deformarse al rotar. */
function swirlArc(scene: Phaser.Scene, c: Phaser.GameObjects.Container, r: number, w: number, col: number, a0: number) {
  const g = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  g.lineStyle(w, col, 0.9).beginPath().arc(0, 0, r, a0, a0 + FB(1.4, 2.2)).strokePath();
  c.add(g);
}

/** Hoja que sube en espiral alrededor de (x, y). */
function spiralLeaf(scene: Phaser.Scene, x: number, y: number, s: number, depth: number, rise: number, out: number, delay = 0) {
  const leaf = scene.add.ellipse(x, y, 12 * s, 5 * s, pick(LEAF), 1).setDepth(depth).setAlpha(0);
  const a0 = Math.random() * Math.PI * 2;
  const turns = FB(1.2, 2.2) * Math.PI * 2;
  const t = { p: 0 };
  scene.tweens.add({
    targets: t,
    p: 1,
    delay,
    duration: IB(650, 950),
    ease: 'Sine.easeOut',
    onUpdate: () => {
      const th = a0 + t.p * turns;
      const r = (14 + t.p * out) * s;
      leaf.setPosition(x + Math.cos(th) * r, y - t.p * rise * s + Math.sin(th) * r * 0.3);
      leaf.setRotation(th * 1.7).setAlpha(t.p < 0.1 ? t.p * 10 : 1 - Math.max(0, t.p - 0.6) / 0.4);
    },
    onComplete: kill(leaf),
  });
}

/**
 * ULTI de VIENTO en el bote: un torbellino se levanta del punto exacto (anillos que suben girando), remolino de aire a
 * ras de suelo, polvo que se abre, hojas que suben en espiral y ráfagas laterales. Sin fuego ni marca quemada.
 */
export function windGroundFx(scene: Phaser.Scene, x: number, y: number, k: number) {
  const s = Math.max(0.7, k) * 1.2;
  const D = y + 3;
  gustSound(scene);
  scene.cameras.main.shake(260, 0.012);

  // polvo / aire que se abre a ras de suelo
  const flash = softGlow(scene, x, y, 0xf0fff0, 140 * s, 60 * s, D + 2);
  scene.tweens.add({ targets: flash, alpha: 0, scaleX: flash.scaleX * 1.8, duration: 140, ease: 'Quad.easeOut', onComplete: kill(flash) });
  for (let i = 0; i < 2; i++) {
    const dust = softGlow(scene, x, y, i ? 0xd8e8c8 : 0xc8f0d0, 220 * s, 60 * s, D - 1).setAlpha(0.7);
    scene.tweens.add({ targets: dust, scaleX: dust.scaleX * (2.4 + i), scaleY: dust.scaleY * 1.6, alpha: 0, delay: i * 90, duration: 520, ease: 'Cubic.easeOut', onComplete: kill(dust) });
  }

  // remolino a ras de suelo (contenedor aplastado: los arcos giran sobre la cancha)
  const floor = scene.add.container(x, y).setDepth(D - 0.5);
  for (let i = 0; i < 5; i++) swirlArc(scene, floor, FB(40, 110) * s, FB(3, 6) * s, pick(GUST), Math.random() * Math.PI * 2);
  floor.setScale(0.4, 0.13);
  scene.tweens.add({ targets: floor, angle: 540, scaleX: 1.6, scaleY: 0.5, alpha: 0, duration: 620, ease: 'Cubic.easeOut', onComplete: kill(floor) });

  // torbellino: anillos que suben girando y se abren (embudo)
  for (let i = 0; i < 6; i++) {
    const ring = scene.add.container(x, y - i * 10 * s).setDepth(D + 1).setScale(1, 0.3).setAlpha(0);
    const r = (22 + i * 14) * s;
    swirlArc(scene, ring, r, (4 - i * 0.4) * s, pick(GUST), Math.random() * Math.PI * 2);
    swirlArc(scene, ring, r * 0.9, 2.5 * s, 0xffffff, Math.random() * Math.PI * 2);
    scene.tweens.add({
      targets: ring,
      alpha: { from: 0.95, to: 0 },
      y: y - (30 + i * 34) * s,
      angle: (i % 2 ? 1 : -1) * 600,
      scaleX: 1.25,
      scaleY: 0.38,
      delay: 30 + i * 35,
      duration: 620,
      ease: 'Sine.easeOut',
      onComplete: kill(ring),
    });
  }
  // columna de aire clara
  const col = softGlow(scene, x, y, 0xe0ffe8, 70 * s, 220 * s, D + 1.5).setOrigin(0.5, 0.9);
  col.setScale(col.scaleX * 0.6, col.scaleY * 0.2).setAlpha(0.8);
  scene.tweens.add({ targets: col, scaleY: col.scaleY * 5, scaleX: col.scaleX * 1.3, alpha: 0, duration: 520, ease: 'Cubic.easeOut', onComplete: kill(col) });

  // hojas en espiral
  for (let i = 0; i < 16; i++) spiralLeaf(scene, x, y, s, D + 2, FB(110, 220), FB(60, 140), IB(0, 140));

  // ráfagas laterales: trazos curvos que salen hacia los lados
  for (let i = 0; i < 6; i++) {
    const dir = i % 2 ? 1 : -1;
    const g = scene.add.graphics({ x, y: y - FB(4, 40) * s }).setDepth(D + 1).setBlendMode(Phaser.BlendModes.ADD);
    const L = FB(50, 90) * s;
    g.lineStyle(FB(2, 3.5) * s, pick(GUST), 0.85).beginPath().moveTo(0, 0);
    g.lineTo((dir * L) / 2, -6 * s).lineTo(dir * L, 0).strokePath();
    scene.tweens.add({ targets: g, x: x + dir * FB(90, 170) * s, alpha: 0, scaleX: 1.6, delay: IB(0, 120), duration: IB(320, 460), ease: 'Cubic.easeOut', onComplete: kill(g) });
  }
}

/** ULTI de VIENTO contra un personaje: remolino que se abre girando, hojas que salen disparadas y anillos de aire. */
export function windBlast(scene: Phaser.Scene, x: number, y: number, s0: number, D: number) {
  const s = s0 * 1.35;
  gustSound(scene);
  const flash = softGlow(scene, x, y, 0xf0fff0, 140 * s, 140 * s, D + 3);
  scene.tweens.add({ targets: flash, scale: flash.scale * 1.6, alpha: 0, duration: 100, ease: 'Quad.easeOut', onComplete: kill(flash) });
  ballBurst(scene, x, y, s, D, 'wind');
  const swirl = scene.add.container(x, y).setDepth(D + 2).setScale(0.4, 0.32);
  for (let i = 0; i < 6; i++) swirlArc(scene, swirl, FB(30, 80) * s, FB(3, 6) * s, pick(GUST), (i / 6) * Math.PI * 2);
  scene.tweens.add({ targets: swirl, angle: -480, scaleX: 1.8, scaleY: 1.4, alpha: 0, duration: 460, ease: 'Cubic.easeOut', onComplete: kill(swirl) });
  for (let i = 0; i < 2; i++) {
    const ring = scene.add.ellipse(x, y, 50 * s, 42 * s).setStrokeStyle(5 * s, i ? 0x9cf0b0 : 0xe0ffe8, 0.9).setDepth(D).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: ring, scale: 4.6, alpha: 0, delay: i * 80, duration: 360, ease: 'Cubic.easeOut', onComplete: kill(ring) });
  }
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = FB(90, 190) * s;
    const leaf = scene.add.ellipse(x, y, 13 * s, 5 * s, pick(LEAF), 1).setDepth(D + 2).setRotation(a);
    scene.tweens.add({ targets: leaf, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.7, rotation: a + FB(4, 8), alpha: 0, duration: IB(380, 560), ease: 'Cubic.easeOut', onComplete: kill(leaf) });
  }
}

// ---------------------------------------------------------------- sobre el aturdido
/** Posición del personaje para los efectos que lo siguen: pies (x, y) y cabeza (headY), en pantalla. */
export type FxAnchor = { x: number; y: number; headY: number };

/**
 * Efecto que se queda sobre el personaje aturdido por la ULTI, con el estilo de cada poder:
 *   RAYO    electrocutado: arcos eléctricos que le recorren el cuerpo y chispas que parpadean
 *   VIENTO  un remolino de aire y hojas gira a su alrededor
 * Fuego, hielo y tulipán no llevan (su aturdido ya es el dibujado). `at` devuelve null si el personaje ya no está.
 */
export function ultiStunFx(scene: Phaser.Scene, el: InfernoElement, at: () => FxAnchor | null, ms: number) {
  if (el !== 'lightning' && el !== 'wind') return;
  const g = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  const t0 = scene.time.now;
  let next = 0;
  const leaves = Array.from({ length: 5 }, () => ({ a: Math.random() * Math.PI * 2, h: FB(0.1, 0.9), col: pick(LEAF) }));
  const tick = () => {
    const now = scene.time.now;
    const p = (now - t0) / ms;
    const a = at();
    if (p >= 1 || !a || !g.active) {
      scene.events.off('update', tick);
      if (g.active) g.destroy();
      return;
    }
    const fade = p > 0.8 ? (1 - p) / 0.2 : 1;
    const H = Math.max(30, a.y - a.headY);
    g.setDepth(a.y + 5);
    if (el === 'lightning') {
      if (now < next) return; // parpadeo: ~14 veces por segundo
      next = now + 70;
      g.clear();
      const n = p < 0.3 ? 4 : 3;
      for (let i = 0; i < n; i++) {
        const cy = a.y - H * FB(0.1, 0.95);
        const x0 = a.x + FB(-0.25, 0.25) * H;
        const ang = Math.random() * Math.PI * 2;
        const L = H * FB(0.25, 0.5);
        zap(g, x0, cy, x0 + Math.cos(ang) * L, cy + Math.sin(ang) * L * 0.7, H * 0.05, Math.max(1.2, H * 0.014), 0, fade);
      }
      for (let i = 0; i < 4; i++) g.fillStyle(pick(ELEC.spark), 0.9 * fade).fillCircle(a.x + FB(-0.35, 0.35) * H, a.y - Math.random() * H, FB(1.5, 3));
    } else {
      g.clear();
      const spin = ((now - t0) / 1000) * 7;
      for (let i = 0; i < 3; i++) {
        const cy = a.y - H * (0.2 + i * 0.3);
        const rx = H * (0.38 + i * 0.06);
        const a0 = spin * (i % 2 ? -1 : 1) + i * 2;
        g.lineStyle(Math.max(1.5, H * 0.02), GUST[i % GUST.length], 0.75 * fade).beginPath();
        for (let j = 0; j <= 12; j++) {
          const th = a0 + (j / 12) * 2.4;
          const px = a.x + Math.cos(th) * rx;
          const py = cy + Math.sin(th) * rx * 0.28;
          if (j === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.strokePath();
      }
      for (const l of leaves) {
        const th = l.a + spin * 1.2;
        g.fillStyle(l.col, fade).fillEllipse(a.x + Math.cos(th) * H * 0.45, a.y - H * l.h + Math.sin(th) * H * 0.12, H * 0.09, H * 0.04);
      }
    }
  };
  scene.events.on('update', tick);
  scene.events.once('shutdown', () => scene.events.off('update', tick));
}

// ---------------------------------------------------------------- ULTI de RAYO: desplazamiento (en vez de las sombras)
/**
 * Cuerpo CARGADO de electricidad durante el desplazamiento de la ULTI de rayo: halo blanco-amarillo intenso detrás,
 * un velo brillante encima (el personaje se ve luminoso) y rayos que le recorren el cuerpo, ~16 veces por segundo.
 * Sin preFX (no se puede en los sprites dentro de un Container). Dura `ms`.
 */
export function lightningBodyFx(scene: Phaser.Scene, at: () => FxAnchor | null, ms: number) {
  const back = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  const front = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  // reloj REAL: la cinemática de la ULTI pausa el del partido (scene.time) y esto tiene que animarse durante ella
  const t0 = performance.now();
  let next = 0;
  const tick = () => {
    const now = performance.now();
    const p = (now - t0) / ms;
    const a = at();
    if (p >= 1 || !a || !back.active) {
      scene.events.off('update', tick);
      if (back.active) back.destroy();
      if (front.active) front.destroy();
      return;
    }
    if (now < next) return;
    next = now + 60;
    const fade = p > 0.85 ? (1 - p) / 0.15 : Math.min(1, p * 6);
    const H = Math.max(30, a.y - a.headY);
    const cy = a.y - H * 0.5;
    back.clear().setDepth(a.y - 0.5);
    front.clear().setDepth(a.y + 6);
    // halo detrás: blanco-amarillo potente que parpadea
    const fl = 0.75 + Math.random() * 0.25;
    back.fillStyle(0x5aa8ff, 0.28 * fade * fl).fillEllipse(a.x, cy, H * 1.5, H * 1.7);
    back.fillStyle(0xfff36b, 0.35 * fade * fl).fillEllipse(a.x, cy, H * 1.05, H * 1.3);
    back.fillStyle(0xffffff, 0.45 * fade * fl).fillEllipse(a.x, cy, H * 0.6, H * 0.95);
    // velo luminoso sobre el cuerpo: el personaje se ve brillante
    front.fillStyle(0xffffff, 0.22 * fade * fl).fillEllipse(a.x, cy, H * 0.55, H * 0.95);
    // rayos por el cuerpo y saliendo de él
    for (let i = 0; i < 5; i++) {
      const y0 = a.y - H * FB(0.05, 0.98);
      const x0 = a.x + FB(-0.25, 0.25) * H;
      const ang = Math.random() * Math.PI * 2;
      const L = H * FB(0.35, 0.75);
      zap(front, x0, y0, x0 + Math.cos(ang) * L, y0 + Math.sin(ang) * L * 0.75, H * 0.07, Math.max(1.4, H * 0.018), 1, fade);
    }
    for (let i = 0; i < 6; i++) front.fillStyle(pick(ELEC.spark), fade).fillCircle(a.x + FB(-0.45, 0.45) * H, a.y - Math.random() * H, FB(1.5, 3.5));
  };
  scene.events.on('update', tick);
  scene.events.once('shutdown', () => scene.events.off('update', tick));
}

/**
 * Salto-RAYO de la ULTI: un rayo gordo une el punto de salida con el de llegada (el personaje viaja como un destello),
 * con fogonazo blanco en los dos extremos y un trueno corto. (ax, ay) / (bx, by) = pies en pantalla, `k` = escala.
 */
export function lightningDashFlash(scene: Phaser.Scene, ax: number, ay: number, bx: number, by: number, k: number, headUp: number) {
  const s = Math.max(0.7, k);
  thunderSound(scene);
  scene.cameras.main.flash(70, 200, 220, 255);
  const ya = ay - headUp * 0.5;
  const yb = by - headUp * 0.5;
  const depth = Math.max(ay, by) + 8;
  // todo cuadro a cuadro con reloj REAL: durante la cinemática de la ULTI están en pausa scene.time y los tweens
  const bolt = scene.add.graphics().setDepth(depth).setBlendMode(Phaser.BlendModes.ADD);
  const fx = scene.add.graphics().setDepth(depth + 1).setBlendMode(Phaser.BlendModes.ADD);
  const sparks = Array.from({ length: 12 }, () => ({ a: FB(0, Math.PI * 2), d: FB(50, 120) * s, c: pick(ELEC.spark) }));
  const MS = 320;
  const t0 = performance.now();
  let nextBolt = 0;
  const step = () => {
    const now = performance.now();
    const p = (now - t0) / MS;
    if (p >= 1 || !bolt.active) {
      scene.events.off('update', step);
      if (bolt.active) bolt.destroy();
      if (fx.active) fx.destroy();
      return;
    }
    if (now >= nextBolt) {
      nextBolt = now + 45;
      bolt.clear();
      zap(bolt, ax, ya, bx, yb, 26 * s, 7 * s, 3, 1 - p * 0.8);
      zap(bolt, ax, ya, bx, yb, 16 * s, 3 * s, 0, 1 - p * 0.6);
    }
    fx.clear();
    // fogonazo en la salida y (un poco después) en la llegada, con su aro en el suelo
    for (const [x, y, d] of [
      [ax, ya, 0],
      [bx, yb, 0.18],
    ] as const) {
      const q = Math.min(1, Math.max(0, (p - d) / (1 - d)));
      if (q <= 0) continue;
      fx.fillStyle(0xffffff, 0.95 * (1 - q)).fillCircle(x, y, 26 * s * (0.6 + 2.2 * q));
      fx.lineStyle(3 * s, ELEC.mid, 1 - q).strokeEllipse(x, y + headUp * 0.5, 50 * s * (1 + 2.4 * q), 16 * s * (1 + 2.4 * q));
    }
    // chispas que salen de la llegada
    const q2 = Math.min(1, Math.max(0, (p - 0.18) / 0.82));
    if (q2 > 0) for (const sp of sparks) fx.fillStyle(sp.c, 1 - q2).fillCircle(bx + Math.cos(sp.a) * sp.d * q2, yb + Math.sin(sp.a) * sp.d * q2 * 0.7, 3 * s * (1 - q2 * 0.6));
  };
  step();
  scene.events.on('update', step);
  scene.events.once('shutdown', () => scene.events.off('update', step));
}
