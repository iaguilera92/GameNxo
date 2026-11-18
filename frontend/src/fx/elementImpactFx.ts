import Phaser from 'phaser';
import { ballArtOf, ballDims, type InfernoElement } from './InfernoFx';

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
export function zap(g: Phaser.GameObjects.Graphics, x0: number, y0: number, x1: number, y1: number, jag: number, w: number, branches = 0, alpha = 1) {
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
export function flicker(scene: Phaser.Scene, g: Phaser.GameObjects.Graphics, ms: number, every: number, draw: (p: number) => void) {
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
  const art = ballArtOf(el); // (17-11-2026) undefined en ULTRA EFECTO (sin hoja)
  if (!art || !scene.textures.exists(art.key)) return;
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
 * HIELO caparazón de cristales · FUEGO brasas y resplandor · SOMBRA hilos oscuros · LUZ halo y anillos · TULIPÁN pétalos (17-11-2026).
 * `at` devuelve null si el personaje ya no está.
 */
/** Elementos de la ULTI con efecto que se queda sobre el aturdido (rayo y viento desde siempre; el resto, 17-11-2026). */
const STUN_BODY = new Set<string>(['lightning', 'wind', 'ice', 'fire', 'shadow', 'light', 'tulip']);

export function ultiStunFx(scene: Phaser.Scene, el: InfernoElement, at: () => FxAnchor | null, ms: number) {
  if (!STUN_BODY.has(el)) return;
  const g = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  const t0 = scene.time.now;
  let next = 0;
  const leaves = Array.from({ length: 5 }, () => ({ a: Math.random() * Math.PI * 2, h: FB(0.1, 0.9), col: pick(LEAF) }));
  // (17-11-2026) piezas fijas del efecto sobre el cuerpo de HIELO / FUEGO / SOMBRA / LUZ / TULIPÁN (se sortean una vez; cada fotograma solo se mueven)
  const bits = Array.from({ length: 10 }, (_, i) => ({ u: Math.random(), x: FB(-0.38, 0.38), ph: Math.random() * 6.28, sp: FB(0.35, 0.75), sz: FB(0.8, 1.5), i }));
  const crystals = Array.from({ length: 8 }, (_, i) => ({ x: (i / 7 - 0.5) * 0.8 + FB(-0.05, 0.05), h: FB(0.08, 0.92), L: FB(0.16, 0.3), tilt: FB(-0.6, 0.6) + (i % 2 ? 0.5 : -0.5), col: pick([ICE.white, ICE.pale, ICE.mid]) }));
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
    } else if (el !== 'wind') {
      g.clear();
      const T = (now - t0) / 1000;
      const grow = Math.min(1, p * 5); // lo que brota (cristales, brillo) tarda ~1/5 del aturdido en salir
      const bodyX = a.x;
      if (el === 'ice') {
        // CAPARAZÓN DE HIELO: cristales que brotan del cuerpo, niebla fría a los pies y copos que bajan
        g.fillStyle(ICE.mid, 0.16 * fade).fillEllipse(bodyX, a.y - H * 0.05, H * 0.9, H * 0.16);
        for (const c of crystals) {
          const cx = bodyX + c.x * H;
          const cy = a.y - c.h * H;
          const L = c.L * H * grow;
          const w = L * 0.3;
          const ang = -Math.PI / 2 + c.tilt + (c.x < 0 ? -0.5 : 0.5);
          const tx = cx + Math.cos(ang) * L;
          const ty = cy + Math.sin(ang) * L;
          const nx = -Math.sin(ang) * w;
          const ny = Math.cos(ang) * w;
          g.fillStyle(c.col, 0.7 * fade).fillPoints([{ x: cx + nx, y: cy + ny }, { x: tx, y: ty }, { x: cx - nx, y: cy - ny }, { x: cx - Math.cos(ang) * w, y: cy - Math.sin(ang) * w }], true);
          g.lineStyle(Math.max(1, H * 0.008), ICE.white, 0.85 * fade).lineBetween(cx, cy, tx, ty);
        }
        for (const b of bits) {
          const v = (T * b.sp * 0.5 + b.u) % 1;
          const fx = bodyX + (b.x + Math.sin(T * 2 + b.ph) * 0.06) * H;
          const fy = a.y - H * (1.05 - v * 1.0);
          g.fillStyle(ICE.white, (0.35 + 0.5 * Math.abs(Math.sin(T * 6 + b.ph))) * fade).fillCircle(fx, fy, Math.max(1.2, H * 0.012 * b.sz));
        }
      } else if (el === 'fire') {
        // BRASAS: llama que lame el cuerpo y brasas que suben, con un resplandor naranja que parpadea
        g.fillStyle(0xff6a12, (0.13 + 0.07 * Math.sin(T * 22)) * fade).fillEllipse(bodyX, a.y - H * 0.5, H * 0.7, H * 1.05);
        for (const b of bits) {
          const v = (T * b.sp + b.u) % 1;
          const fx = bodyX + (b.x + Math.sin(T * 5 + b.ph) * 0.07) * H;
          const fy = a.y - H * (0.05 + v * 1.0);
          const col = v < 0.4 ? 0xfff1a0 : v < 0.75 ? 0xffa21a : 0xff4a12;
          g.fillStyle(col, (1 - v) * 0.95 * fade).fillCircle(fx, fy, Math.max(1.5, H * 0.02 * b.sz * (1 - v * 0.5)));
        }
      } else if (el === 'shadow') {
        // SOMBRA: hilos de oscuridad que se enroscan hacia arriba y motas moradas
        for (let i = 0; i < 4; i++) {
          const x0 = bodyX + (i - 1.5) * H * 0.2;
          g.lineStyle(Math.max(2, H * 0.03), i % 2 ? 0x7a2fd6 : 0x9b4dff, 0.55 * fade).beginPath();
          for (let j = 0; j <= 10; j++) {
            const u = j / 10;
            const px = x0 + Math.sin(T * 3 + i * 1.7 + u * 6) * H * 0.07 * (0.4 + u);
            const py = a.y - u * H * (0.8 + 0.15 * Math.sin(T * 2 + i));
            if (j === 0) g.moveTo(px, py);
            else g.lineTo(px, py);
          }
          g.strokePath();
        }
        for (const b of bits) {
          const v = (T * b.sp * 0.7 + b.u) % 1;
          g.fillStyle(pick([0xd1a8ff, 0x9b4dff]), (1 - v) * 0.85 * fade).fillCircle(bodyX + (b.x + Math.sin(T * 3 + b.ph) * 0.06) * H, a.y - H * v * 1.05, Math.max(1.3, H * 0.014 * b.sz));
        }
      } else if (el === 'light') {
        // LUZ: halo dorado que respira, dos anillos de luz que suben por el cuerpo y motas que flotan
        g.fillStyle(0xffe9a0, (0.14 + 0.06 * Math.sin(T * 7)) * fade).fillEllipse(bodyX, a.y - H * 0.5, H * 0.75, H * 1.1);
        for (let i = 0; i < 2; i++) {
          const v = (T * 0.9 + i * 0.5) % 1;
          g.lineStyle(Math.max(1.5, H * 0.02), 0xfff1b8, (1 - v) * 0.8 * fade).strokeEllipse(bodyX, a.y - v * H, H * (0.55 + 0.1 * v), H * 0.13);
        }
        for (const b of bits) {
          const v = (T * b.sp * 0.6 + b.u) % 1;
          g.fillStyle(pick([0xffffff, 0xfff1b8]), (1 - v) * fade).fillCircle(bodyX + (b.x + Math.sin(T * 2.5 + b.ph) * 0.05) * H, a.y - H * v * 1.05, Math.max(1.3, H * 0.014 * b.sz));
        }
      } else {
        // TULIPÁN: pétalos que giran alrededor y caen despacio
        for (const b of bits) {
          const v = (T * b.sp * 0.5 + b.u) % 1;
          const th = T * 2.2 + b.ph;
          const px = bodyX + Math.cos(th) * H * (0.28 + 0.1 * b.sz);
          const py = a.y - H * (1.05 - v * 1.0) + Math.sin(th) * H * 0.05;
          g.fillStyle(pick([0xff6fae, 0xffb3d6, 0xffe6f2]), 0.9 * fade).fillEllipse(px, py, H * 0.06 * b.sz, H * 0.032 * b.sz);
        }
      }
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
 * Cuerpo CARGADO de electricidad durante el desplazamiento de la ULTI de rayo (21-11-2026, pedido del usuario: sin el círculo de antes). Brilla EL
 * PERSONAJE: una copia de su dibujo (mismo fotograma, tamaño y volteo) pintada de luz amarilla-blanca encima y otra azul un poco más grande detrás
 * (contorno eléctrico), las dos parpadeando, y rayos que le recorren el cuerpo ~16 veces por segundo. Sin preFX (no se puede en los sprites dentro de
 * un Container): solo tinte relleno y mezcla aditiva. `ch` = el personaje; `space` = contenedor donde se dibuja (la demostración de PERSONALIZAR,
 * con su propia escala); sin `ch`, solo los rayos. Dura `ms`.
 */
/**
 * `neon` = azul neón (DEFENSIVO RELÁMPAGO) en vez del azul y amarillo de la ULTI. 'light' (18-11-2026, usuario: ULTI de LUZ) = el personaje TODO
 * BLANCO con un halo blanco y partículas blancas que suben, SIN rayos ni electricidad. 'shadow' (18-11-2026, usuario: ULTI de SOMBRA) = lo mismo en
 * OSCURIDAD: el personaje negro con un halo morado y sombras que salen irradiando del cuerpo.
 */
export function lightningBodyFx(scene: Phaser.Scene, at: () => FxAnchor | null, ms: number, ch?: Phaser.GameObjects.Container, space?: Phaser.GameObjects.Container, neon: boolean | 'light' | 'shadow' = false) {
  const dark = neon === 'shadow';
  /** LUZ o SOMBRA: cuerpo relleno (blanco / negro), sin rayos */
  const light = neon === 'light' || dark;
  // la oscuridad no se puede pintar con mezcla aditiva: va normal
  const front = scene.add.graphics().setBlendMode(dark ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.ADD);
  const lit: Phaser.GameObjects.Image[] = [];
  const rim: Phaser.GameObjects.Image[] = [];
  // reloj REAL: la cinemática de la ULTI pausa el del partido (scene.time) y esto tiene que animarse durante ella
  const t0 = performance.now();
  let next = 0;
  let fl = 1;
  const end = () => {
    scene.events.off('update', tick);
    if (front.active) front.destroy();
    for (const o of [...lit, ...rim]) if (o.active) o.destroy();
  };
  /** copia `o` en la imagen `img` (posición, escala, giro y volteo pasados al espacio de dibujo) */
  const copy = (img: Phaser.GameObjects.Image, o: BodyPart, grow: number) => {
    let m = o.getWorldTransformMatrix();
    if (space) {
      // (Phaser 3.90: multiply devuelve el array; se usa la matriz invertida, que es la que queda multiplicada)
      const inv = space.getWorldTransformMatrix().invert();
      inv.multiply(m);
      m = inv;
    }
    const sy = Math.hypot(m.c, m.d);
    const rot = Math.atan2(-m.c, m.d);
    const cos = Math.cos(rot);
    const sx = Math.abs(cos) > 1e-3 ? m.a / cos : m.b / Math.sin(rot);
    img.setTexture(o.texture.key, o.frame.name).setOrigin(o.originX, o.originY).setPosition(m.tx, m.ty).setScale(Math.abs(sx) * grow, sy * grow).setRotation(rot).setFlipX(o.flipX !== sx < 0);
  };
  const tick = () => {
    const now = performance.now();
    const p = (now - t0) / ms;
    const a = at();
    if (p >= 1 || !a || !front.active) return end();
    const fade = p > 0.85 ? (1 - p) / 0.15 : Math.min(1, p * 6);
    // el personaje encendido (cada fotograma, para que siga su animación)
    if (ch?.active) {
      const parts = bodyParts(ch);
      parts.forEach((o, i) => {
        const r = (rim[i] ??= scene.add.image(0, 0, o.texture.key).setTintFill(dark ? 0x7a2fd0 : light ? 0xfff8dc : neon ? 0x1f7bff : 0x5aa8ff).setBlendMode(Phaser.BlendModes.ADD));
        // LUZ / SOMBRA: la copia va SIN mezcla aditiva (relleno opaco): el personaje se ve todo blanco / todo negro
        const l = (lit[i] ??= scene.add.image(0, 0, o.texture.key).setTintFill(dark ? 0x0a0612 : light ? 0xffffff : neon ? 0x7fe8ff : 0xfff6b0).setBlendMode(light ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.ADD));
        copy(r, o, light ? 1.1 : 1.07);
        copy(l, o, 1);
        r.setVisible(true).setAlpha((light ? 0.6 : neon ? 0.8 : 0.55) * fade * (light ? 1 : fl)).setDepth(ch.depth - 0.4);
        l.setVisible(true).setAlpha((light ? 0.95 : neon ? 0.65 : 0.5) * fade * (light ? 1 : fl)).setDepth(ch.depth + 0.3);
      });
      for (let i = parts.length; i < lit.length; i++) {
        lit[i].setVisible(false);
        rim[i]?.setVisible(false);
      }
    }
    if (now < next) return;
    next = now + 60;
    fl = 0.7 + Math.random() * 0.3;
    const H = Math.max(30, a.y - a.headY);
    front.clear().setDepth(a.y + 6);
    if (dark) {
      // SOMBRA: jirones oscuros que salen IRRADIANDO del cuerpo (del centro hacia fuera, más lejos cuanto más avanza)
      const cy = a.y - H * 0.5;
      for (let i = 0; i < 12; i++) {
        const ang = Math.random() * Math.PI * 2;
        const d = H * FB(0.25, 0.75) * (0.7 + p * 0.6);
        const x = a.x + Math.cos(ang) * d * 0.8;
        const y = cy + Math.sin(ang) * d;
        front.fillStyle(i % 3 ? 0x140a22 : 0x4b1f86, 0.75 * fade).fillEllipse(x, y, FB(5, 11) * (H / 90), FB(3, 6) * (H / 90));
      }
      return;
    }
    if (light) {
      // LUZ: motas blancas alrededor del cuerpo, más arriba cuanto más avanza (suben)
      for (let i = 0; i < 14; i++) {
        const h = (Math.random() + p * 0.6) % 1;
        front.fillStyle(i % 3 ? 0xffffff : 0xfff6c8, fade * (1 - h * 0.5)).fillCircle(a.x + FB(-0.42, 0.42) * H, a.y - h * H * 1.15, FB(1.4, 3.4));
      }
      return;
    }
    // rayos por el cuerpo y saliendo de él
    for (let i = 0; i < 6; i++) {
      const y0 = a.y - H * FB(0.05, 0.98);
      const x0 = a.x + FB(-0.25, 0.25) * H;
      const ang = Math.random() * Math.PI * 2;
      const L = H * FB(0.35, 0.75);
      zap(front, x0, y0, x0 + Math.cos(ang) * L, y0 + Math.sin(ang) * L * 0.75, H * 0.07, Math.max(1.4, H * 0.018), 1, fade);
    }
    for (let i = 0; i < 6; i++) front.fillStyle(pick(ELEC.spark), fade).fillCircle(a.x + FB(-0.45, 0.45) * H, a.y - Math.random() * H, FB(1.5, 3.5));
  };
  scene.events.on('update', tick);
  scene.events.once('shutdown', end);
}

type BodyPart = Phaser.GameObjects.GameObject & {
  visible: boolean;
  texture: Phaser.Textures.Texture;
  frame: Phaser.Textures.Frame;
  originX: number;
  originY: number;
  flipX: boolean;
  getWorldTransformMatrix(): Phaser.GameObjects.Components.TransformMatrix;
};
/** Imágenes y sprites visibles del personaje (recursivo), como DashFx. */
function bodyParts(root: Phaser.GameObjects.GameObject): BodyPart[] {
  const out: BodyPart[] = [];
  const walk = (o: Phaser.GameObjects.GameObject) => {
    const d = o as BodyPart & { list?: Phaser.GameObjects.GameObject[] };
    if (d.visible === false) return;
    if (Array.isArray(d.list)) d.list.forEach(walk);
    else if (d.texture && d.frame && typeof d.getWorldTransformMatrix === 'function' && d.texture.key !== '__DEFAULT' && d.texture.key !== '__MISSING') out.push(d);
  };
  walk(root);
  return out;
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
    // (21-11-2026) sin el fogonazo redondo ni el aro del suelo (tapaban al personaje): en la salida y la llegada, rayitos que saltan del cuerpo;
    // el brillo es el del propio personaje (lightningBodyFx)
    for (const [x, y, d] of [
      [ax, ya, 0],
      [bx, yb, 0.18],
    ] as const) {
      const q = Math.min(1, Math.max(0, (p - d) / (1 - d)));
      if (q <= 0 || q >= 1) continue;
      for (let i = 0; i < 4; i++) {
        const ang = FB(0, Math.PI * 2);
        const L = headUp * FB(0.35, 0.6) * (0.6 + q);
        zap(fx, x, y, x + Math.cos(ang) * L, y + Math.sin(ang) * L * 0.75, 8 * s, 2.2 * s, 1, 1 - q);
      }
    }
    // chispas que salen de la llegada
    const q2 = Math.min(1, Math.max(0, (p - 0.18) / 0.82));
    if (q2 > 0) for (const sp of sparks) fx.fillStyle(sp.c, 1 - q2).fillCircle(bx + Math.cos(sp.a) * sp.d * q2, yb + Math.sin(sp.a) * sp.d * q2 * 0.7, 3 * s * (1 - q2 * 0.6));
  };
  step();
  scene.events.on('update', step);
  scene.events.once('shutdown', () => scene.events.off('update', step));
}

/**
 * (18-11-2026, usuario) Salto de LUZ de la ULTI de LUZ (como lightningDashFlash pero sin electricidad ni trueno): una estela de luz blanca une la
 * salida con la llegada y se apaga, con un estallido de partículas blancas en los dos extremos. (ax, ay) / (bx, by) = pies, `k` = escala.
 */
export function lightDashFlash(scene: Phaser.Scene, ax: number, ay: number, bx: number, by: number, k: number, headUp: number) {
  dashTrail(scene, ax, ay, bx, by, k, headUp, false);
}

/** (18-11-2026, usuario) Salto de SOMBRA de la ULTI de SOMBRA: el de LUZ en oscuridad (estela negra y morada, jirones oscuros en los extremos). */
export function shadowDashFlash(scene: Phaser.Scene, ax: number, ay: number, bx: number, by: number, k: number, headUp: number) {
  dashTrail(scene, ax, ay, bx, by, k, headUp, true);
}

function dashTrail(scene: Phaser.Scene, ax: number, ay: number, bx: number, by: number, k: number, headUp: number, dark: boolean) {
  const s = Math.max(0.7, k);
  if (dark) scene.cameras.main.flash(70, 40, 10, 70);
  else scene.cameras.main.flash(70, 255, 255, 245);
  const C = dark ? { halo: 0x4b1f86, core: 0x0a0612, bit: [0x140a22, 0x4b1f86] } : { halo: 0xfff6c8, core: 0xffffff, bit: [0xffffff, 0xffffff] };
  const ya = ay - headUp * 0.5;
  const yb = by - headUp * 0.5;
  const fx = scene.add.graphics().setDepth(Math.max(ay, by) + 8).setBlendMode(dark ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.ADD);
  const bits = Array.from({ length: 22 }, (_, i) => ({ end: i % 2, a: FB(0, Math.PI * 2), d: FB(40, 110) * s, r: FB(1.8, 3.6) * s }));
  const MS = 360;
  // reloj REAL: la cinemática de la ULTI pausa scene.time y los tweens
  const t0 = performance.now();
  const step = () => {
    const p = (performance.now() - t0) / MS;
    if (p >= 1 || !fx.active) {
      scene.events.off('update', step);
      if (fx.active) fx.destroy();
      return;
    }
    fx.clear();
    // estela: halo ancho y núcleo fino, que se adelgaza y se apaga
    const w = 1 - p;
    fx.lineStyle(26 * s * w, C.halo, (dark ? 0.5 : 0.35) * w).lineBetween(ax, ya, bx, yb);
    fx.lineStyle(9 * s * w, C.core, 0.9 * w).lineBetween(ax, ya, bx, yb);
    for (const [i, b] of bits.entries()) {
      const [x, y] = b.end ? [bx, yb] : [ax, ya];
      const q = b.end ? Math.min(1, Math.max(0, (p - 0.12) / 0.88)) : p;
      if (q <= 0) continue;
      fx.fillStyle(C.bit[i % 2], 1 - q).fillCircle(x + Math.cos(b.a) * b.d * q, y + Math.sin(b.a) * b.d * q * 0.7 - headUp * 0.25 * q, b.r * (1 - q * 0.5));
    }
  };
  step();
  scene.events.on('update', step);
  scene.events.once('shutdown', () => scene.events.off('update', step));
}

// ---------------------------------------------------------------- HIELO (ESPECIAL)
const ICE = { white: 0xffffff, pale: 0xd8f6ff, mid: 0x8fdcff, deep: 0x4aa8ff } as const;

/**
 * (14-11-2026) ESPECIAL de HIELO alcanza a un personaje: CRISTALES de hielo que brotan del golpe (picos que crecen y se
 * quiebran), escarcha que se abre en el suelo, esquirlas disparadas, bruma fría y copos que caen despacio.
 */
export function iceBlast(scene: Phaser.Scene, x: number, y: number, s0: number, D: number) {
  const s = s0 * 1.2;
  const ADD = Phaser.BlendModes.ADD;
  const flash = softGlow(scene, x, y, ICE.white, 140 * s, 140 * s, D + 3);
  scene.tweens.add({ targets: flash, scale: flash.scale * 1.6, alpha: 0, duration: 110, ease: 'Quad.easeOut', onComplete: kill(flash) });
  // bruma fría
  const mist = softGlow(scene, x, y, ICE.mid, 170 * s, 140 * s, D);
  scene.tweens.add({ targets: mist, scale: mist.scale * 2.2, alpha: 0, duration: 620, ease: 'Cubic.easeOut', onComplete: kill(mist) });
  // CRISTALES: picos alargados que brotan hacia fuera, se quedan un instante y se quiebran
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + FB(-0.2, 0.2);
    const L = FB(85, 135) * s;
    const w = FB(18, 28) * s;
    const g = scene.add.graphics({ x, y }).setDepth(D + 2).setRotation(a);
    g.fillStyle(pick([ICE.pale, ICE.mid, ICE.white]), 0.92).fillPoints([{ x: 0, y: -w / 2 }, { x: L, y: 0 }, { x: 0, y: w / 2 }, { x: -w * 0.4, y: 0 }], true);
    g.fillStyle(ICE.white, 0.85).fillPoints([{ x: 0, y: -w * 0.18 }, { x: L * 0.85, y: 0 }, { x: 0, y: w * 0.05 }], true); // brillo del filo
    g.lineStyle(1.5 * s, ICE.deep, 0.9).strokePoints([{ x: 0, y: -w / 2 }, { x: L, y: 0 }, { x: 0, y: w / 2 }], false);
    g.setScale(0.1, 0.4);
    scene.tweens.add({ targets: g, scaleX: 1, scaleY: 1, duration: 110, ease: 'Back.easeOut' });
    scene.tweens.add({ targets: g, alpha: 0, scaleX: 1.15, delay: 260 + i * 8, duration: 160, ease: 'Quad.easeIn', onComplete: kill(g) });
  }
  // escarcha en anillo (dos aros que se abren)
  for (let i = 0; i < 2; i++) {
    const ring = scene.add.ellipse(x, y, 50 * s, 42 * s).setStrokeStyle(5 * s, i ? ICE.mid : ICE.pale, 1).setDepth(D).setBlendMode(ADD);
    scene.tweens.add({ targets: ring, scale: 4.4, alpha: 0, delay: i * 80, duration: 380, ease: 'Cubic.easeOut', onComplete: kill(ring) });
  }
  // esquirlas que salen disparadas al quebrarse los cristales
  scene.time.delayedCall(250, () => {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = FB(80, 170) * s;
      const L = FB(6, 11) * s;
      const sh = scene.add.graphics({ x, y }).setDepth(D + 2).setRotation(a);
      sh.fillStyle(pick([ICE.white, ICE.pale, ICE.mid]), 1).fillPoints([{ x: L, y: 0 }, { x: 0, y: -L * 0.35 }, { x: -L * 0.6, y: 0 }, { x: 0, y: L * 0.35 }], true);
      scene.tweens.add({ targets: sh, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.75 + 30 * s, rotation: a + FB(-6, 6), alpha: 0, duration: IB(380, 560), ease: 'Cubic.easeOut', onComplete: kill(sh) });
    }
  });
  // copos de nieve que caen despacio
  for (let i = 0; i < 8; i++) {
    const r = FB(4, 7) * s;
    const f = scene.add.graphics({ x: x + FB(-70, 70) * s, y: y + FB(-60, 10) * s }).setDepth(D + 1).setBlendMode(ADD).setAlpha(0);
    f.lineStyle(1.6 * s, ICE.white, 1);
    for (let k = 0; k < 3; k++) {
      const a = (k * Math.PI) / 3;
      f.lineBetween(-Math.cos(a) * r, -Math.sin(a) * r, Math.cos(a) * r, Math.sin(a) * r);
    }
    scene.tweens.add({ targets: f, alpha: { from: 1, to: 0 }, y: f.y + FB(40, 80) * s, x: f.x + FB(-20, 20) * s, angle: FB(-180, 180), delay: IB(150, 350), duration: IB(700, 1000), ease: 'Sine.easeIn', onComplete: kill(f) });
  }
  burstSparks(scene, x, y, s, [ICE.white, ICE.pale, ICE.mid], 10, D);
}

// ---------------------------------------------------------------- COMETA (ESPECIAL ÉPICO)
const COMET = { deep: 0x1f3fd6, blue: 0x4f8dff, pale: 0x9cc4ff, star: 0xeaf4ff, white: 0xffffff } as const;

/** Estrella de 5 puntas centrada en (0, 0) en un Graphics. */
function star5(g: Phaser.GameObjects.Graphics, r: number, col: number, a = 1) {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < 10; i++) {
    const ang = (i * Math.PI) / 5 - Math.PI / 2;
    const rr = i % 2 ? r * 0.42 : r;
    pts.push({ x: Math.cos(ang) * rr, y: Math.sin(ang) * rr });
  }
  g.fillStyle(col, a).fillPoints(pts, true);
}

/**
 * (17-11-2026) ESPECIAL COMETA alcanza a un personaje: DESTELLO blanco-azul que deslumbra (con destello de pantalla), el meteorito revienta en una
 * llamarada azul (lenguas de fuego azul hacia fuera), onda de choque doble, ROCAS que salen despedidas y una lluvia de ESTRELLAS de 5 puntas que
 * giran y caen. Es épica: algo más grande que los de rareza especial. El cráter con estrellas lo deja smashAftermath (ImpactFx).
 */
export function cometBlast(scene: Phaser.Scene, x: number, y: number, s0: number, D: number) {
  const s = s0 * 1.25;
  const ADD = Phaser.BlendModes.ADD;
  scene.cameras.main.flash(110, 170, 205, 255);
  // destello
  const flash = softGlow(scene, x, y, COMET.white, 210 * s, 210 * s, D + 3);
  scene.tweens.add({ targets: flash, scale: flash.scale * 1.8, alpha: 0, duration: 130, ease: 'Quad.easeOut', onComplete: kill(flash) });
  const core = softGlow(scene, x, y, COMET.pale, 140 * s, 140 * s, D + 2);
  scene.tweens.add({ targets: core, scale: core.scale * 2.6, alpha: 0, duration: 360, ease: 'Cubic.easeOut', onComplete: kill(core) });
  // llamarada azul: lenguas de fuego hacia fuera (una sola capa de Graphics que se abre)
  const flames = scene.add.graphics({ x, y }).setDepth(D + 1).setBlendMode(ADD);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + FB(-0.15, 0.15);
    const L = FB(70, 120) * s;
    const w = FB(12, 18) * s;
    const ca = Math.cos(a);
    const sa = Math.sin(a) * 0.85;
    flames.fillStyle(pick([COMET.deep, COMET.blue, COMET.pale]), 0.85).fillTriangle(-sa * w, ca * w, sa * w, -ca * w, ca * L, sa * L);
  }
  flames.setScale(0.3);
  scene.tweens.add({ targets: flames, scale: 1.15, duration: 170, ease: 'Cubic.easeOut' });
  scene.tweens.add({ targets: flames, alpha: 0, delay: 140, duration: 260, onComplete: kill(flames) });
  // onda de choque doble
  for (let i = 0; i < 2; i++) {
    const ring = scene.add.ellipse(x, y, 50 * s, 42 * s).setStrokeStyle((6 - i * 2) * s, i ? COMET.blue : COMET.star, 1).setDepth(D).setBlendMode(ADD);
    scene.tweens.add({ targets: ring, scale: 4.8 + i * 1.2, alpha: 0, delay: i * 90, duration: 420, ease: 'Cubic.easeOut', onComplete: kill(ring) });
  }
  // rocas del meteorito que salen despedidas y caen
  for (let i = 0; i < 7; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = FB(70, 150) * s;
    const rock = scene.add.circle(x, y, FB(4, 7) * s, pick([0x141a33, 0x283258, 0x1a2a66]), 1).setStrokeStyle(1.5 * s, COMET.blue, 0.9).setDepth(D + 2);
    scene.tweens.add({ targets: rock, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.7 + 40 * s, alpha: 0, duration: IB(450, 650), ease: 'Quad.easeOut', onComplete: kill(rock) });
  }
  // lluvia de estrellas
  for (let i = 0; i < 14; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = FB(60, 170) * s;
    const st = scene.add.graphics({ x, y }).setDepth(D + 2).setBlendMode(ADD);
    star5(st, FB(5, 9) * s, pick([COMET.white, COMET.star, COMET.pale]));
    scene.tweens.add({ targets: st, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.7 + 30 * s, angle: FB(-360, 360), scale: 0.3, alpha: 0, delay: IB(0, 80), duration: IB(500, 800), ease: 'Cubic.easeOut', onComplete: kill(st) });
  }
  // (18-11-2026, usuario) EFECTO EXTRA de lo ÉPICO: tras el estallido, un COMETA sale disparado del impacto hacia el CIELO
  scene.time.delayedCall(120, () => cometToSky(scene, x, y, s0, D));
}

/**
 * (18-11-2026, usuario) Remate visual del ESPECIAL ÉPICO COMETA: al impactar, la MISMA energía de la pelota (el meteorito de
 * smashElementFx.drawMeteor: halo, cola de fuego azul en 4 capas y la roca con grietas) pero al DOBLE de tamaño sale disparada del rival
 * hacia el CIELO, rápido (~0,45 s), dejando estrellas; arriba, un destello en estrella y se va. El partido sigue normal.
 */
function cometToSky(scene: Phaser.Scene, x: number, y: number, s0: number, D: number) {
  if (!scene.sys.isActive()) return;
  const k = 1.6 * s0; // el doble de la pelota en vuelo (≈ 0,8 · escala)
  const s = s0 * 1.1;
  const ADD = Phaser.BlendModes.ADD;
  const v = scene.cameras.main.worldView;
  const ty = v.y - 140 * k; // hasta salir por arriba (con su cola)
  const tx = x + (Math.random() - 0.5) * 80 * k; // casi recto hacia arriba
  const dark = scene.add.graphics().setDepth(D + 3.9);
  const g = scene.add.graphics().setDepth(D + 4).setBlendMode(ADD);
  const st = { u: 0 };
  let lastStar = 0;
  let t = 0;
  scene.tweens.add({
    targets: st,
    u: 1,
    duration: 450,
    ease: 'Quad.easeIn',
    onUpdate: () => {
      t += 1 / 60;
      const u = st.u;
      const hx = x + (tx - x) * u;
      const hy = y + (ty - y) * u;
      // la cola apunta hacia atrás (hacia el impacto)
      const bx = x - hx;
      const by = y - hy;
      const bl = Math.hypot(bx, by) || 1;
      const ca = bl > 1 ? bx / bl : 0;
      const sa = bl > 1 ? by / bl : 1;
      g.clear();
      dark.clear();
      const pulse = 1 + Math.sin(t * 16) * 0.07;
      g.fillStyle(0x2f6bff, 0.22).fillCircle(hx, hy, 30 * k * pulse);
      g.fillStyle(0x9cc4ff, 0.3).fillCircle(hx, hy, 19 * k * pulse);
      // cola: 4 capas como la de la pelota, más larga cuanto más rápido sube
      const stretch = 1 + u * 0.8;
      for (const [li, len0, w0, col, a] of [
        [0, 120, 20, 0x1f3fd6, 0.42],
        [1, 95, 15, 0x4f8dff, 0.55],
        [2, 66, 10, 0x9cc4ff, 0.7],
        [3, 38, 6, 0xffffff, 0.85],
      ] as const) {
        const len = Math.min(bl + 30 * k, len0 * k * stretch);
        const w = w0 * k;
        const wob = Math.sin(t * 13 + li * 0.8) * w * 0.35;
        const pts: { x: number; y: number }[] = [];
        const pt = (q: number, side: number) => {
          const ww = w * (1 - q) ** 0.7 * side + wob * q;
          return { x: hx + ca * len * q - sa * ww, y: hy + sa * len * q + ca * ww };
        };
        for (let i = 0; i <= 6; i++) pts.push(pt(i / 6, 1));
        for (let i = 6; i >= 0; i--) pts.push(pt(i / 6, -1));
        g.fillStyle(col, a).fillPoints(pts, true);
      }
      // cabeza: la roca oscura con grietas azules y brillo blanco por delante
      const r = 11 * k;
      dark.fillStyle(0x141a33, 0.95).fillCircle(hx, hy, r);
      dark.fillStyle(0x283258, 1).fillCircle(hx - ca * r * 0.25, hy - sa * r * 0.25, r * 0.7);
      g.lineStyle(1.6 * k, 0x6fa4ff, 0.95);
      for (let i = 0; i < 3; i++) {
        const a0 = t * 3 + (i * Math.PI * 2) / 3;
        g.lineBetween(hx + Math.cos(a0) * r * 0.15, hy + Math.sin(a0) * r * 0.15, hx + Math.cos(a0 + 0.4) * r * 0.85, hy + Math.sin(a0 + 0.4) * r * 0.85);
      }
      g.fillStyle(0xffffff, 0.85).fillCircle(hx - ca * r * 0.55, hy - sa * r * 0.55, r * 0.42);
      g.lineStyle(2 * k, 0xcfe2ff, 0.9).strokeCircle(hx, hy, r * 1.05);
      // estrellas que se quedan titilando por el camino
      if (scene.time.now - lastStar > 40) {
        lastStar = scene.time.now;
        const sg = scene.add.graphics({ x: hx + FB(-20, 20) * s, y: hy + FB(10, 60) * s }).setDepth(D + 3).setBlendMode(ADD);
        star5(sg, FB(3, 6) * s, pick([COMET.white, COMET.star, COMET.pale]));
        scene.tweens.add({ targets: sg, alpha: 0, scale: 0.3, angle: FB(-120, 120), duration: IB(400, 700), onComplete: kill(sg) });
      }
    },
    onComplete: () => {
      g.destroy();
      dark.destroy();
      // destello en el cielo al irse
      const tw = scene.add.graphics({ x: tx, y: v.y + 30 }).setDepth(D + 4).setBlendMode(ADD).setScale(0.2);
      star5(tw, 18 * s, COMET.white);
      scene.tweens.add({ targets: tw, scale: 1.4, angle: 90, alpha: 0, duration: 380, ease: 'Cubic.easeOut', onComplete: kill(tw) });
    },
  });
}

/**
 * (17-11-2026) CRÁTER del COMETA en el suelo (lo llama smashAftermath): hueco oscuro con borde azul brillante que se enfría, grietas que salen de él y
 * ESTRELLAS que titilan dentro y alrededor antes de apagarse. `T` alarga los tiempos. ~16 objetos.
 */
export function cometCrater(scene: Phaser.Scene, x: number, gy: number, s: number, T = 1) {
  const ADD = Phaser.BlendModes.ADD;
  const pit = scene.add.ellipse(x, gy, 150 * s, 46 * s, 0x070a18, 0.7).setDepth(gy - 2).setScale(0.3);
  const rim = scene.add.ellipse(x, gy, 150 * s, 46 * s).setStrokeStyle(4 * s, COMET.blue, 0.95).setDepth(gy - 1.8).setBlendMode(ADD).setScale(0.3);
  scene.tweens.add({ targets: [pit, rim], scale: 1, duration: 150, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: rim, alpha: 0.35, delay: 200, duration: 500 * T, ease: 'Sine.easeOut' }); // el borde se enfría
  scene.tweens.add({ targets: [pit, rim], alpha: 0, delay: 1000 * T, duration: 700 * T, onComplete: () => { pit.destroy(); rim.destroy(); } });
  // grietas brillantes
  const cracks = scene.add.graphics({ x, y: gy }).setDepth(gy - 1.5).setBlendMode(ADD);
  cracks.lineStyle(Math.max(1.5, 2 * s), COMET.pale, 0.9);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + FB(-0.25, 0.25);
    const L = FB(55, 95) * s;
    cracks.beginPath().moveTo(Math.cos(a) * 60 * s * 0.5, Math.sin(a) * 18 * s * 0.5).lineTo(Math.cos(a) * L * 0.75, Math.sin(a) * L * 0.25 + FB(-3, 3)).lineTo(Math.cos(a) * L, Math.sin(a) * L * 0.32).strokePath();
  }
  scene.tweens.add({ targets: cracks, alpha: 0, delay: 700 * T, duration: 700 * T, onComplete: kill(cracks) });
  // estrellas que titilan en el cráter
  for (let i = 0; i < 8; i++) {
    const st = scene.add.graphics({ x: x + FB(-70, 70) * s, y: gy + FB(-16, 12) * s }).setDepth(gy - 1).setBlendMode(ADD).setAlpha(0).setScale(0.4);
    star5(st, FB(4, 7) * s, pick([COMET.white, COMET.star, COMET.pale]));
    scene.tweens.add({ targets: st, alpha: 1, scale: 1, angle: FB(-90, 90), delay: IB(80, 400), duration: 220, yoyo: true, hold: IB(150, 400) * T, repeat: 1, onComplete: kill(st) });
  }
}

// ---------------------------------------------------------------- DRAGÓN (ESPECIAL LEGENDARIO)
const DRAGON = { dark: 0x5a0606, red: 0xd6201e, orange: 0xff7a1a, gold: 0xffd23f, pale: 0xfff1b8 } as const;

/**
 * (18-11-2026) ESPECIAL DRAGÓN alcanza a un personaje: RUGIDO de fuego. Destello rojo-dorado de pantalla y sacudida, LLAMARADA en abanico (lenguas
 * de fuego rojas, naranjas y doradas que se abren hacia fuera), dos ondas de choque, ESCAMAS rojas que salen despedidas girando y brasas que
 * suben. Legendaria: el más grande de los ESPECIALES. La quemadura del suelo la deja smashAftermath (dragonScorch).
 */
export function dragonBlast(scene: Phaser.Scene, x: number, y: number, s0: number, D: number) {
  const s = s0 * 1.3;
  const ADD = Phaser.BlendModes.ADD;
  scene.cameras.main.flash(140, 255, 140, 60);
  const flash = softGlow(scene, x, y, DRAGON.pale, 230 * s, 230 * s, D + 3);
  scene.tweens.add({ targets: flash, scale: flash.scale * 1.9, alpha: 0, duration: 140, ease: 'Quad.easeOut', onComplete: kill(flash) });
  const core = softGlow(scene, x, y, DRAGON.orange, 160 * s, 160 * s, D + 2);
  scene.tweens.add({ targets: core, scale: core.scale * 2.8, alpha: 0, duration: 420, ease: 'Cubic.easeOut', onComplete: kill(core) });
  // llamarada: dos capas de lenguas de fuego que se abren (la de fuera roja, la de dentro dorada)
  for (const [n, len, wid, cols, dl] of [
    [14, [90, 150], [16, 24], [DRAGON.red, DRAGON.orange], 0],
    [10, [55, 95], [10, 15], [DRAGON.gold, DRAGON.pale], 50],
  ] as const) {
    const flames = scene.add.graphics({ x, y }).setDepth(D + 1).setBlendMode(ADD);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + FB(-0.15, 0.15);
      const L = FB(len[0], len[1]) * s;
      const w = FB(wid[0], wid[1]) * s;
      const ca = Math.cos(a);
      const sa = Math.sin(a) * 0.8;
      flames.fillStyle(pick([...cols]), 0.85).fillTriangle(-sa * w, ca * w, sa * w, -ca * w, ca * L, sa * L);
    }
    flames.setScale(0.25);
    scene.tweens.add({ targets: flames, scale: 1.2, delay: dl, duration: 200, ease: 'Cubic.easeOut' });
    scene.tweens.add({ targets: flames, alpha: 0, delay: dl + 170, duration: 300, onComplete: kill(flames) });
  }
  // ondas de choque
  for (let i = 0; i < 2; i++) {
    const ring = scene.add.ellipse(x, y, 54 * s, 44 * s).setStrokeStyle((7 - i * 2) * s, i ? DRAGON.red : DRAGON.gold, 1).setDepth(D).setBlendMode(ADD);
    scene.tweens.add({ targets: ring, scale: 5 + i * 1.3, alpha: 0, delay: i * 90, duration: 460, ease: 'Cubic.easeOut', onComplete: kill(ring) });
  }
  // escamas que salen despedidas girando
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = FB(80, 170) * s;
    const sc = scene.add.graphics({ x, y }).setDepth(D + 2);
    const r = FB(5, 8) * s;
    sc.fillStyle(DRAGON.dark, 1).fillTriangle(-r, 0, r, 0, 0, r * 1.5);
    sc.fillStyle(pick([DRAGON.red, DRAGON.orange]), 1).fillTriangle(-r * 0.7, r * 0.15, r * 0.7, r * 0.15, 0, r * 1.2);
    scene.tweens.add({ targets: sc, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.7 + 40 * s, angle: FB(-540, 540), alpha: 0, duration: IB(500, 750), ease: 'Quad.easeOut', onComplete: kill(sc) });
  }
  // brasas que suben
  for (let i = 0; i < 12; i++) {
    const e = scene.add.circle(x + FB(-50, 50) * s, y + FB(-20, 30) * s, FB(2.5, 5) * s, pick([DRAGON.gold, DRAGON.orange, DRAGON.pale]), 1).setDepth(D + 2).setBlendMode(ADD);
    scene.tweens.add({ targets: e, y: e.y - FB(80, 170) * s, x: e.x + FB(-40, 40) * s, alpha: 0, delay: IB(40, 200), duration: IB(600, 1000), ease: 'Quad.easeOut', onComplete: kill(e) });
  }
}

/**
 * (18-11-2026) Quemadura del DRAGÓN en el suelo (lo llama smashAftermath): mancha negra con borde al rojo que se enfría y LENGUAS DE FUEGO que
 * arden un rato encima, con humo. `T` alarga los tiempos. ~16 objetos.
 */
export function dragonScorch(scene: Phaser.Scene, x: number, gy: number, s: number, T = 1) {
  const ADD = Phaser.BlendModes.ADD;
  const burn = scene.add.ellipse(x, gy, 170 * s, 50 * s, 0x120404, 0.7).setDepth(gy - 2).setScale(0.3);
  const rim = scene.add.ellipse(x, gy, 170 * s, 50 * s).setStrokeStyle(4 * s, DRAGON.orange, 0.95).setDepth(gy - 1.8).setBlendMode(ADD).setScale(0.3);
  scene.tweens.add({ targets: [burn, rim], scale: 1, duration: 160, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: rim, alpha: 0.3, delay: 250, duration: 700 * T, ease: 'Sine.easeOut' });
  scene.tweens.add({ targets: [burn, rim], alpha: 0, delay: 1300 * T, duration: 700 * T, onComplete: () => { burn.destroy(); rim.destroy(); } });
  // lenguas de fuego que arden y se apagan
  for (let i = 0; i < 7; i++) {
    const fx = x + FB(-65, 65) * s;
    const fy = gy + FB(-12, 10) * s;
    const fl = scene.add.graphics({ x: fx, y: fy }).setDepth(gy + 0.5).setBlendMode(ADD).setScale(1, 0.2);
    const h = FB(30, 55) * s;
    const w = FB(8, 13) * s;
    fl.fillStyle(DRAGON.red, 0.75).fillTriangle(-w, 0, w, 0, 0, -h);
    fl.fillStyle(DRAGON.orange, 0.85).fillTriangle(-w * 0.65, 0, w * 0.65, 0, 0, -h * 0.75);
    fl.fillStyle(DRAGON.pale, 0.9).fillTriangle(-w * 0.3, 0, w * 0.3, 0, 0, -h * 0.4);
    scene.tweens.add({ targets: fl, scaleY: { from: 0.2, to: 1 }, delay: IB(60, 260), duration: 180, ease: 'Back.easeOut' });
    scene.tweens.add({ targets: fl, scaleX: 0.85, scaleY: 1.12, duration: IB(110, 170), yoyo: true, repeat: Math.round(5 * T), delay: 300 });
    scene.tweens.add({ targets: fl, alpha: 0, scaleY: 0.3, delay: IB(900, 1300) * T, duration: 400, onComplete: kill(fl) });
  }
  // humo que sube
  for (let i = 0; i < 5; i++) {
    const sm = scene.add.circle(x + FB(-50, 50) * s, gy - 10 * s, FB(10, 16) * s, pick([0x2a2226, 0x3c3236]), 0.5).setDepth(gy + 1);
    scene.tweens.add({ targets: sm, y: sm.y - FB(70, 130) * s, scale: 2, alpha: 0, delay: IB(300, 800) * T, duration: IB(900, 1300), ease: 'Sine.easeOut', onComplete: kill(sm) });
  }
}

// ---------------------------------------------------------------- SOMBRA (ESPECIAL)
/**
 * (14-11-2026) ESPECIAL de SOMBRA alcanza a un personaje: una esfera NEGRA se abre de golpe y se traga la luz, tentáculos de
 * sombra que salen disparados, aro morado y humo negro que se disipa.
 */
export function shadowBlast(scene: Phaser.Scene, x: number, y: number, s0: number, D: number) {
  const s = s0 * 1.2;
  const ADD = Phaser.BlendModes.ADD;
  const flash = softGlow(scene, x, y, 0xd0a8ff, 130 * s, 130 * s, D + 3);
  scene.tweens.add({ targets: flash, scale: flash.scale * 1.5, alpha: 0, duration: 100, ease: 'Quad.easeOut', onComplete: kill(flash) });
  // esfera negra que se abre y se cierra (implosión)
  const orb = scene.add.circle(x, y, 30 * s, 0x0a0410, 0.92).setDepth(D + 1).setScale(0.3);
  const rim = scene.add.circle(x, y, 30 * s, 0x000000, 0).setStrokeStyle(4 * s, 0x9b4dff, 1).setDepth(D + 2).setBlendMode(ADD).setScale(0.3);
  scene.tweens.add({ targets: [orb, rim], scale: 1.6, duration: 160, ease: 'Cubic.easeOut' });
  scene.tweens.add({ targets: [orb, rim], scale: 0.1, alpha: 0, delay: 260, duration: 200, ease: 'Back.easeIn', onComplete: () => { orb.destroy(); rim.destroy(); } });
  // tentáculos de sombra
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + FB(-0.2, 0.2);
    const L = FB(70, 130) * s;
    const g = scene.add.graphics({ x, y }).setDepth(D + 1).setRotation(a);
    const pts: { x: number; y: number }[] = [];
    for (let j = 0; j <= 8; j++) {
      const u = j / 8;
      pts.push({ x: u * L, y: Math.sin(u * 6 + i) * 8 * s * u });
    }
    g.lineStyle(7 * s, 0x0a0410, 0.85).strokePoints(pts, false);
    g.lineStyle(2 * s, 0xb57aff, 0.9).strokePoints(pts, false);
    g.setScale(0.15, 1);
    scene.tweens.add({ targets: g, scaleX: 1, duration: 140, ease: 'Cubic.easeOut' });
    scene.tweens.add({ targets: g, alpha: 0, delay: 200, duration: 220, onComplete: kill(g) });
  }
  // aro morado
  for (let i = 0; i < 2; i++) {
    const ring = scene.add.ellipse(x, y, 50 * s, 42 * s).setStrokeStyle(5 * s, i ? 0x7a2fd6 : 0xd0a8ff, 1).setDepth(D).setBlendMode(ADD);
    scene.tweens.add({ targets: ring, scale: 4.2, alpha: 0, delay: i * 80, duration: 380, ease: 'Cubic.easeOut', onComplete: kill(ring) });
  }
  // humo negro que se disipa
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = FB(20, 50) * s;
    const p = scene.add.circle(x, y, FB(14, 24) * s, pick([0x0a0410, 0x1a0630, 0x2c1640]), 0.8).setDepth(D);
    scene.tweens.add({ targets: p, x: x + Math.cos(a) * r * 2, y: y + Math.sin(a) * r * 1.5 - 20 * s, scale: 2.2, alpha: 0, delay: 120, duration: IB(500, 750), ease: 'Cubic.easeOut', onComplete: kill(p) });
  }
  burstSparks(scene, x, y, s, [0xffffff, 0xd0a8ff, 0x9b4dff], 10, D);
}

// ---------------------------------------------------------------- LUZ (ESPECIAL)
/**
 * (12-11-2026) ESPECIAL de LUZ alcanza a un personaje (antes ESTRELLA): un fogonazo blanco que deslumbra, haces de luz que
 * salen disparados en todas direcciones, una columna de luz que sube, dos aros dorados y motas de luz que flotan hacia arriba.
 * Sin estrellas.
 */
export function lightBlast(scene: Phaser.Scene, x: number, y: number, s0: number, D: number) {
  const s = s0 * 1.2;
  const ADD = Phaser.BlendModes.ADD;
  // fogonazo: blanco enorme y muy breve + núcleo que se abre
  const flash = softGlow(scene, x, y, 0xffffff, 200 * s, 200 * s, D + 3);
  scene.tweens.add({ targets: flash, scale: flash.scale * 1.8, alpha: 0, duration: 140, ease: 'Quad.easeOut', onComplete: kill(flash) });
  const core = softGlow(scene, x, y, 0xfff0b0, 120 * s, 120 * s, D + 2);
  scene.tweens.add({ targets: core, scale: core.scale * 2.6, alpha: 0, duration: 340, ease: 'Cubic.easeOut', onComplete: kill(core) });
  // haces de luz: triángulos finos que se estiran desde el centro
  const beams = scene.add.graphics({ x, y }).setDepth(D + 1).setBlendMode(ADD);
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + FB(-0.1, 0.1);
    const L = (i % 2 ? FB(90, 130) : FB(140, 190)) * s;
    const w = i % 2 ? 0.07 : 0.05;
    beams.fillStyle(i % 2 ? 0xfff0b0 : 0xffffff, 0.9).fillTriangle(0, 0, Math.cos(a - w) * L, Math.sin(a - w) * L * 0.85, Math.cos(a + w) * L, Math.sin(a + w) * L * 0.85);
  }
  beams.setScale(0.35);
  scene.tweens.add({ targets: beams, scale: 1.15, duration: 160, ease: 'Cubic.easeOut' });
  scene.tweens.add({ targets: beams, alpha: 0, delay: 120, duration: 260, onComplete: kill(beams) });
  // columna de luz que sube
  const col = scene.add.rectangle(x, y - 60 * s, 34 * s, 150 * s, 0xfffbe0, 0.7).setDepth(D).setBlendMode(ADD);
  scene.tweens.add({ targets: col, scaleX: 0.15, scaleY: 1.9, y: y - 140 * s, alpha: 0, duration: 380, ease: 'Quad.easeOut', onComplete: kill(col) });
  // dos aros dorados
  for (let i = 0; i < 2; i++) {
    const ring = scene.add.ellipse(x, y, 50 * s, 42 * s).setStrokeStyle((5 - i * 2) * s, i ? 0xffffff : 0xfff0b0, 1).setDepth(D).setBlendMode(ADD);
    scene.tweens.add({ targets: ring, scale: 4.4 + i * 1.4, alpha: 0, delay: i * 80, duration: 380, ease: 'Cubic.easeOut', onComplete: kill(ring) });
  }
  // motas de luz: salen y flotan hacia arriba apagándose
  for (let i = 0; i < 18; i++) {
    const a = FB(0, Math.PI * 2);
    const d = FB(40, 130) * s;
    const m = scene.add.circle(x, y, FB(3, 6) * s, pick([0xffffff, 0xfffbe0, 0xfff0b0, 0xcfe9ff]), 1).setDepth(D + 2).setBlendMode(ADD);
    const tx = x + Math.cos(a) * d;
    const ty = y + Math.sin(a) * d * 0.8;
    scene.tweens.add({ targets: m, x: tx, y: ty, duration: 240, ease: 'Cubic.easeOut' });
    scene.tweens.add({ targets: m, y: ty - FB(40, 90) * s, alpha: 0, scale: 0.3, delay: 240, duration: IB(450, 750), ease: 'Sine.easeOut', onComplete: kill(m) });
  }
}

/**
 * (18-11-2026) DEFENSIVO RELÁMPAGO: el rastro que queda en el SUELO entre el punto de salida y el de llegada (pies, en pantalla): un rayo
 * rasante con ramas que parpadea y se apaga, manchas chamuscadas con grietas que brillan a lo largo del camino y chispas que saltan.
 * Va por debajo de los personajes. `k` = escala de la perspectiva.
 */
export function lightningFloorTrail(scene: Phaser.Scene, ax: number, ay: number, bx: number, by: number, k: number) {
  const s = Math.max(0.7, k);
  const D = Math.min(ay, by) - 2;
  const ADD = Phaser.BlendModes.ADD;
  // el rayo rasante (dos pasadas: una gruesa con ramas y otra fina)
  const g = scene.add.graphics().setDepth(D).setBlendMode(ADD);
  flicker(scene, g, 700, 50, (p) => {
    const fade = p < 0.45 ? 1 : (1 - p) / 0.55;
    zap(g, ax, ay, bx, by, 15 * s, 4.2 * s, 4, fade);
    zap(g, ax, ay, bx, by, 9 * s, 2 * s, 0, fade * 0.8);
  });
  // manchas y grietas a lo largo del camino
  const n = Math.max(3, Math.min(7, Math.round(Math.hypot(bx - ax, by - ay) / (70 * s))));
  const cracks = scene.add.graphics().setDepth(D - 0.5).setBlendMode(ADD);
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const x = ax + (bx - ax) * f + FB(-10, 10) * s;
    const y = ay + (by - ay) * f;
    const scorch = scene.add.ellipse(x, y, FB(40, 70) * s, FB(11, 17) * s, 0x0a0f1c, 0.55).setDepth(D - 1).setScale(0.4);
    scene.tweens.add({ targets: scorch, scale: 1, duration: 110, ease: 'Cubic.easeOut' });
    scene.tweens.add({ targets: scorch, alpha: 0, delay: 800, duration: 700, ease: 'Quad.easeIn', onComplete: kill(scorch) });
    for (let c = 0; c < 3; c++) {
      const a = FB(0, Math.PI * 2);
      const L = FB(18, 36) * s;
      zap(cracks, x, y, x + Math.cos(a) * L, y + Math.sin(a) * L * 0.3, 5 * s, 1.3 * s, 0, 0.85);
    }
    // chispas que saltan de cada mancha
    for (let j = 0; j < 2; j++) {
      const sp = scene.add.rectangle(x, y, FB(4, 8) * s, 1.6 * s, pick(ELEC.spark), 1).setDepth(D + 1).setBlendMode(ADD);
      const dx = FB(-1, 1) * FB(20, 60) * s;
      const up = FB(18, 45) * s;
      const t = { p: 0 };
      scene.tweens.add({
        targets: t,
        p: 1,
        delay: Math.round(f * 120),
        duration: IB(300, 480),
        onUpdate: () => {
          const px = x + dx * t.p;
          const py = y - up * 4 * t.p * (1 - t.p);
          sp.setRotation(Math.atan2(py - sp.y, px - sp.x)).setPosition(px, py).setAlpha(1 - t.p * 0.8);
        },
        onComplete: kill(sp),
      });
    }
  }
  scene.tweens.add({ targets: cracks, alpha: { from: 1, to: 0.35 }, duration: 90, yoyo: true, repeat: 3 });
  scene.tweens.add({ targets: cracks, alpha: 0, delay: 800, duration: 600, onComplete: kill(cracks) });
}
