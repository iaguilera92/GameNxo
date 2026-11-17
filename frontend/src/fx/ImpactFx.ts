import Phaser from 'phaser';
import { POWER_IMPACT, type PowerKind } from '../logic/PowerImpact';
import { BALL_ART, ballArtOf, ballDims, type FxElement, type InfernoElement } from './InfernoFx';
import { dropZeroBounceFx } from './smashElementFx';
import { barrageSlam } from './barrageFx';
import { SMASH_LOOK } from './smashFx';
import { smashPowerOf, type SmashPower } from '../domain/smashPowers';
import { sfx } from './sfx';
import { cometBlast, cometCrater, flicker, zap, iceBlast, lightningBlast, lightningGroundFx, shadowBlast, lightBlast, windBlast, windGroundFx } from './elementImpactFx';

const FB = Phaser.Math.FloatBetween;
const IB = Phaser.Math.Between;
const pick = <T>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];

/**
 * Colores de las explosiones del INFERNO según el poder elegido (fuego, hielo, viento, rayo: domain/infernoPowers.ts).
 * Las mismas formas (lenguas, bocanadas, fragmentos) teñidas con los colores de cada poder.
 */
const BLAST: Record<InfernoElement, { flash: number; tongues: number[]; puffs: number[]; wave: number; frags: number[]; ground: number; groundFlash: number }> = {
  fire: { flash: 0xfff6c8, tongues: [0xff2a0a, 0xff6a12, 0xffa21a, 0xffd23a], puffs: [0xff3a0a, 0xff7a1a, 0xffb02a], wave: 0xffa21a, frags: [0xfff2a0, 0xffa31a, 0xff3d1a], ground: 0xff7a1a, groundFlash: 0xfff1a0 },
  ice: { flash: 0xeafcff, tongues: [0x2f8cff, 0x4aa8ff, 0x8fdcff, 0xd8f6ff], puffs: [0x2f8cff, 0x6fc4ff, 0xbff0ff], wave: 0x8fdcff, frags: [0xffffff, 0xbff0ff, 0x4aa8ff], ground: 0x6fc4ff, groundFlash: 0xeafcff },
  wind: { flash: 0xf0fff0, tongues: [0x2fbf6a, 0x5fd68a, 0x9cf0b0, 0xe0ffe8], puffs: [0x3fd68a, 0x8ff0b0, 0xd0ffe0], wave: 0x8ff0b0, frags: [0xffffff, 0xb8ff9a, 0x5fd16f], ground: 0x6fe0a0, groundFlash: 0xf0fff0 },
  lightning: { flash: 0xfffbe0, tongues: [0x2f6bff, 0x5aa8ff, 0xfff36b, 0xffffff], puffs: [0x2f6bff, 0x6fb4ff, 0xbfe0ff], wave: 0xfff36b, frags: [0xffffff, 0xfff36b, 0x5aa8ff], ground: 0x5aa8ff, groundFlash: 0xfffbe0 },
  tulip: { flash: 0xfff0f7, tongues: [0xe0457f, 0xff6fae, 0xffb3d6, 0xffe6f2], puffs: [0xff6fae, 0xffa3cf, 0xffd8ea], wave: 0xffb3d6, frags: [0xffffff, 0xffb3d6, 0xff6fae], ground: 0xff8fc4, groundFlash: 0xfff0f7 },
  // (17-11-2026) SOMBRA: lenguas moradas que van de oscuro a lila (con luz aditiva lo negro no se vería)
  shadow: { flash: 0xe2c8ff, tongues: [0x4a1a9e, 0x7a2fd6, 0x9b4dff, 0xd1a8ff], puffs: [0x5a1fb8, 0x8a4de0, 0xb27dff], wave: 0xb27dff, frags: [0xffffff, 0xd1a8ff, 0x7a2fd6], ground: 0x7a2fd6, groundFlash: 0xe2c8ff },
  // (17-11-2026) LUZ: lenguas de oro pálido a blanco
  light: { flash: 0xffffff, tongues: [0xffc94a, 0xffd86b, 0xffe9a0, 0xfffbea], puffs: [0xffd86b, 0xffe9a0, 0xfff8dc], wave: 0xffe48a, frags: [0xffffff, 0xfff1b8, 0xffd86b], ground: 0xffd86b, groundFlash: 0xfffbea },
  // (17-11-2026) ULTRA EFECTO: aire blanco y menta
  ultra: { flash: 0xffffff, tongues: [0x5fe0b8, 0x9cf5d8, 0xc8ffd8, 0xffffff], puffs: [0x9cf5d8, 0xc8ffd8, 0xf4fffa], wave: 0xe0fff0, frags: [0xffffff, 0xe0fff0, 0x9cf5d8], ground: 0x9cf5d8, groundFlash: 0xf4fffa },
  // (17-11-2026) RÁFAGA: amarillo lima y dorado de pelota de tenis
  barrage: { flash: 0xfbffe0, tongues: [0xb8e020, 0xd8ff3a, 0xeaff8a, 0xffffff], puffs: [0xd8ff3a, 0xeaff8a, 0xf8ffd8], wave: 0xeaff8a, frags: [0xffffff, 0xeaff8a, 0xd8ff3a], ground: 0xd8ff3a, groundFlash: 0xfbffe0 },
  // (17-11-2026) BOLA DE ENERGÍA (LEGENDARIA): lenguas de azul intenso a blanco
  energy: { flash: 0xffffff, tongues: [0x1f8cff, 0x5fe8ff, 0xc8f8ff, 0xffffff], puffs: [0x5fe8ff, 0x9fefff, 0xe8fdff], wave: 0xc8f8ff, frags: [0xffffff, 0xc8f8ff, 0x5fe8ff], ground: 0x5fe8ff, groundFlash: 0xf0fdff },
};

/**
 * Explosión al impactar SMASH / INFERNO DRIVE contra el rival (solo visual, procedural y breve).
 *   SMASH    energía blanca y dorada + líneas de impacto radiales
 *   INFERNO  fuego naranja, rojo y amarillo (o hielo azul, `el`) + núcleo luminoso + onda expansiva
 * Ambas: destello blanco inicial muy breve, expansión rápida, chispas/fragmentos y sacudida moderada.
 * Objetos de vida corta que se destruyen solos (≈ 25 a 70 según el poder: el de FUEGO es el más pesado, el de RAYO el más ligero).
 */
export function powerImpactFx(scene: Phaser.Scene, kind: PowerKind, x: number, y: number, k: number, el: FxElement = 'fire', feetY?: number) {
  // ULTI de FUEGO que impacta a quien la recibe (el bot, tú o el rival online): su sonido propio
  // (el pelotazo le llega al personaje y la raqueta sale volando; el golpe de la bola suena aparte, en infernoSound.impact)
  if (kind === 'inferno') sfx(scene, el === 'fire' ? 'impacto-ulti-fuego' : el === 'lightning' ? 'impacto-ulti-rayo' : el === 'ice' ? 'impacto-ulti-hielo' : 'ball-recibir-ulti-ataque');
  // el personaje queda ATURDIDO (SMASH o ULTI): sonido de stun, un instante después del golpe para que no se pisen
  scene.time.delayedCall(180, () => sfx(scene, 'stun'));
  const D = 3800; // por encima de personajes y pelota
  const s = Math.max(0.7, k);
  const ADD = Phaser.BlendModes.ADD;
  const fade = (o: Phaser.GameObjects.GameObject & { setScale(v: number): unknown }, props: Phaser.Types.Tweens.TweenBuilderConfig | object, ms: number, delay = 0) =>
    scene.tweens.add({ targets: o, ...props, delay, duration: ms, onComplete: () => o.destroy() });

  // (14-11-2026) ESPECIAL de HIELO / VIENTO / RAYO: impacto PROPIO de su elemento (cristales que brotan y se quiebran /
  // torbellino con hojas / descarga eléctrica), más chico que el de la ULTI. El de fuego sigue con su estallido de siempre.
  const sp = kind === 'smash' ? smashPowerOf(el) : null;
  if (sp === 'ice') iceBlast(scene, x, y, s * 0.85, D);
  else if (sp === 'wind') windBlast(scene, x, y, s * 0.75, D);
  else if (sp === 'lightning') lightningBlast(scene, x, y, s * 0.75, D);
  else if (sp === 'shadow') shadowBlast(scene, x, y, s * 0.85, D);
  else if (sp === 'light') lightBlast(scene, x, y, s * 0.85, D);
  else if (sp === 'comet') cometBlast(scene, x, y, s * 0.95, D); // (17-11-2026) ÉPICA: algo más grande que los especiales (×0,85)
  else if (kind === 'smash') {
    // colores según el poder del SMASH (el: fuego = blanco y dorado de siempre; hielo = blanco azulado + cristales)
    const B = SMASH_LOOK[smashPowerOf(el)].blast;
    // destello blanco inicial (muy breve)
    const flash = scene.add.circle(x, y, 46 * s, B.flash, 0.95).setDepth(D + 2).setBlendMode(ADD);
    fade(flash, { scale: 2.2, alpha: 0, ease: 'Quad.easeOut' }, 110);
    // núcleo de energía blanca/dorada que se expande
    const core = scene.add.circle(x, y, 30 * s, B.core, 0.9).setDepth(D + 1).setBlendMode(ADD);
    fade(core, { scale: 3.4, alpha: 0, ease: 'Cubic.easeOut' }, 300);
    const ring = scene.add.circle(x, y, 26 * s, 0xffffff, 0).setStrokeStyle(6, B.ring, 1).setDepth(D + 1).setBlendMode(ADD);
    fade(ring, { scale: 5, alpha: 0, ease: 'Cubic.easeOut' }, 360);
    // líneas de impacto radiales (manga)
    const lines = scene.add.graphics({ x, y }).setDepth(D).setBlendMode(ADD);
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.12, 0.12);
      const r0 = 34 * s;
      const r1 = Phaser.Math.FloatBetween(110, 170) * s;
      lines.lineStyle(i % 2 ? 6 : 3, i % 3 ? B.lines[0] : B.lines[1], 0.95).lineBetween(Math.cos(a) * r0, Math.sin(a) * r0 * 0.8, Math.cos(a) * r1, Math.sin(a) * r1 * 0.8);
    }
    lines.setScale(0.6);
    fade(lines, { scale: 1.25, alpha: 0, ease: 'Quad.easeOut' }, 280);
    sparks(scene, x, y, s, B.sparks, 14, D);
    // fuego: estallido de llamas y brasas, a la mitad del tamaño del de la ULTI (la ULTI sigue siendo la más espectacular)
    if (sp === 'fire') infernoBlast(scene, x, y, s * 0.5, D, 'fire');
    // hielo: esquirlas de cristal que salen disparadas y se apagan
    if (B.shards) {
      for (let i = 0; i < 12; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = Phaser.Math.FloatBetween(70, 160) * s;
        const sh = scene.add.star(x, y, 4, 3 * s, Phaser.Math.FloatBetween(9, 16) * s, Phaser.Utils.Array.GetRandom(B.shards), 0.95).setDepth(D + 1).setBlendMode(ADD);
        scene.tweens.add({ targets: sh, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.8 + 18 * s, angle: Phaser.Math.Between(-220, 220), scale: 0.25, alpha: 0, duration: Phaser.Math.Between(300, 480), ease: 'Cubic.easeOut', onComplete: () => sh.destroy() });
      }
    }
  } else if (el === 'lightning') {
    lightningBlast(scene, x, y, s, D);
  } else if (el === 'wind') {
    windBlast(scene, x, y, s, D);
  } else if (el === 'ultra') {
    // (17-11-2026) ULTRA EFECTO: el estallido de la ULTI en blanco y menta + un ventilador de aire gigante que se abre girando
    infernoBlast(scene, x, y, s, D, 'ultra');
    fanBurst(scene, x, y, s * 1.4, D + 2);
  } else if (el === 'energy') {
    // (17-11-2026) BOLA DE ENERGÍA: el estallido de la ULTI en blanco y celeste, MÁS GRANDE, con la descarga eléctrica del rayo
    infernoBlast(scene, x, y, s * 1.35, D, 'energy');
    lightningBlast(scene, x, y, s, D + 1);
  } else if (el === 'barrage') {
    // (17-11-2026) RÁFAGA: las pelotas llegan una tras otra ("ta-ta-ta-ta") y, cuando llega la última, el estallido de la ULTI
    // en lima (más chico) mientras varias pelotas salen rebotando
    const last = barrageSlam(scene, x, y, s * 1.2, D + 2);
    scene.time.delayedCall(last, () => infernoBlast(scene, x, y, s * 0.75, D, 'barrage'));
  } else {
    ultiElementImpact(scene, el as InfernoElement, x, y, s, D);
  }

  // ESPECIAL: lo que queda en el suelo y en el cuerpo del golpeado después del estallido (cada poder el suyo)
  if (sp) smashAftermath(scene, sp, x, y, s, D, feetY);
  // (17-11-2026) ULTI: lo MISMO que deja el ESPECIAL de ese elemento, pero más grande y que dura más (la ULTI tiene que verse mejor)
  else if (kind === 'inferno' && ULTI_AFTER.has(el)) smashAftermath(scene, el, x, y, s * 1.25, D, feetY, true);

  const sh = POWER_IMPACT.shake[kind];
  scene.cameras.main.shake(sh.ms, sh.intensity);
}

/** Colores [principal, claro, destello de pantalla RGB o null] del golpe del ESPECIAL de cada poder. */
const AFTER: Record<SmashPower | 'tulip', { main: number; light: number; flash: [number, number, number] | null }> = {
  fire: { main: 0xff6a12, light: 0xffd23a, flash: [255, 170, 80] },
  ice: { main: 0x4aa8ff, light: 0xeafcff, flash: [190, 230, 255] },
  wind: { main: 0x3fd68a, light: 0xf0fff4, flash: [200, 255, 220] },
  lightning: { main: 0x2f6bff, light: 0xfff36b, flash: null }, // lightningBlast ya da su destello
  shadow: { main: 0x7a2fd6, light: 0xd0a8ff, flash: [150, 90, 230] },
  light: { main: 0xffd86a, light: 0xffffff, flash: [255, 250, 225] },
  tulip: { main: 0xff6fae, light: 0xffe6f2, flash: [255, 205, 228] }, // (17-11-2026) solo la ULTI de TULIPÁN
  comet: { main: 0x4f8dff, light: 0xcfe2ff, flash: null }, // (17-11-2026) COMETA: cometBlast ya da su destello
};

/** Elementos de la ULTI que dejan también la huella del ESPECIAL (suelo y cuerpo). Ultra efecto, ráfaga y energía tienen la suya propia. */
const ULTI_AFTER = new Set<string>(['fire', 'ice', 'wind', 'lightning', 'shadow', 'light', 'tulip']);

/**
 * (17-11-2026) Impacto de la ULTI de HIELO / SOMBRA / LUZ: el del ESPECIAL de ese elemento (cristales y copos / tentáculos de sombra /
 * haces de luz), MÁS GRANDE (×1,25 frente al ×0,85 del ESPECIAL), más el estallido de la propia bola en su color: se reconoce el elemento
 * y se nota que la ULTI es mucho más. Fuego y tulipán siguen con su estallido de llamas (el del fuego ya era el de la ULTI).
 */
function ultiElementImpact(scene: Phaser.Scene, el: InfernoElement, x: number, y: number, s: number, D: number) {
  if (el === 'ice') iceBlast(scene, x, y, s * 1.25, D);
  else if (el === 'shadow') shadowBlast(scene, x, y, s * 1.25, D);
  else if (el === 'light') lightBlast(scene, x, y, s * 1.25, D);
  else return infernoBlast(scene, x, y, s, D, el);
  scene.time.delayedCall(40, () => infernoBlast(scene, x, y, s * 0.6, D, el));
}

/**
 * (12-11-2026) REFUERZO del impacto del ESPECIAL (todos los poderes): destello de pantalla del color del poder, onda de choque
 * pegada al suelo bajo el golpeado, resplandor que se queda un momento sobre su cuerpo (se nota que está tocado) y una marca propia
 * en el suelo: quemadura (fuego), escarcha con grietas (hielo), remolino de polvo (viento), charco negro (sombra), mancha de
 * luz (luz), arcos a ras de suelo (rayo). Más chico que el de la ULTI. x, y = centro del cuerpo; el suelo se estima debajo.
 * Va dentro de powerImpactFx: lo ven igual el usuario, el bot y el rival online.
 */
function smashAftermath(scene: Phaser.Scene, sp: string, x: number, y: number, s: number, D: number, feetY?: number, big = false) {
  const C = AFTER[sp as keyof typeof AFTER] as (typeof AFTER)[keyof typeof AFTER] | undefined;
  if (!C) return;
  const ADD = Phaser.BlendModes.ADD;
  const gy = feetY ?? y + 52 * s; // pies (los de verdad si se pasan; si no, aproximados)
  const T = big ? 1.5 : 1; // la ULTI deja su huella más tiempo
  const kill = (o: Phaser.GameObjects.GameObject) => () => o.destroy();
  if (C.flash) scene.cameras.main.flash(90, C.flash[0], C.flash[1], C.flash[2]);
  // onda de choque pegada al suelo: dos aros aplastados que corren hacia fuera
  for (let i = 0; i < 2; i++) {
    const w = scene.add.ellipse(x, gy, 80 * s, 24 * s).setStrokeStyle((6 - i * 2) * s, i ? C.light : C.main, 0.95).setDepth(gy - 1).setBlendMode(ADD);
    scene.tweens.add({ targets: w, scaleX: 4.2 + i * 1.2, scaleY: 3.2 + i, alpha: 0, delay: i * 70, duration: 420, ease: 'Cubic.easeOut', onComplete: kill(w) });
  }
  // resplandor sobre el cuerpo: se queda ~0,7 s y se apaga (late una vez)
  const glow = scene.textures.exists('fx-inferno-glow')
    ? scene.add.image(x, y, 'fx-inferno-glow').setTint(C.main).setDisplaySize(130 * s, 170 * s)
    : scene.add.ellipse(x, y, 90 * s, 120 * s, C.main, 0.6);
  glow.setDepth(D - 1).setBlendMode(sp === 'shadow' ? Phaser.BlendModes.NORMAL : ADD).setAlpha(0.85);
  scene.tweens.add({ targets: glow, alpha: 0, scale: glow.scale * (big ? 1.6 : 1.35), delay: 120, duration: 650 * T, ease: 'Sine.easeOut', onComplete: kill(glow) });
  // ULTI: una tercera onda de choque, más tarde y más grande (eco del golpe)
  if (big) {
    const echo = scene.add.ellipse(x, gy, 80 * s, 24 * s).setStrokeStyle(4 * s, C.light, 0.85).setDepth(gy - 1).setBlendMode(ADD);
    scene.tweens.add({ targets: echo, scaleX: 7, scaleY: 4.6, alpha: 0, delay: 160, duration: 560, ease: 'Cubic.easeOut', onComplete: kill(echo) });
  }

  // marca propia en el suelo
  const mark = (w: number, h: number, col: number, a: number, hold: number, fade: number) => {
    const m = scene.add.ellipse(x, gy, w * s, h * s, col, a).setDepth(gy - 2).setScale(0.3);
    scene.tweens.add({ targets: m, scale: 1, duration: 140, ease: 'Cubic.easeOut' });
    scene.tweens.add({ targets: m, alpha: 0, delay: hold * T, duration: fade * T, onComplete: kill(m) });
    return m;
  };
  if (sp === 'fire') {
    mark(150, 44, 0x1a0a04, 0.55, 700, 600);
    for (let i = 0; i < 8; i++) {
      const e = scene.add.circle(x + FB(-30, 30) * s, gy + FB(-6, 6) * s, FB(2, 4) * s, pick([0xfff1a0, 0xffa21a, 0xff5a12]), 1).setDepth(D).setBlendMode(ADD);
      scene.tweens.add({ targets: e, y: e.y - FB(60, 140) * s, x: e.x + FB(-30, 30) * s, alpha: 0, duration: IB(500, 900), ease: 'Quad.easeOut', onComplete: kill(e) });
    }
  } else if (sp === 'ice') {
    mark(170, 50, 0xbfe9ff, 0.5, 900, 700);
    const g = scene.add.graphics({ x, y: gy }).setDepth(gy - 1.5);
    g.lineStyle(Math.max(1.5, 2.2 * s), 0xffffff, 0.9);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + FB(-0.2, 0.2);
      const L = FB(50, 90) * s;
      g.beginPath().moveTo(0, 0).lineTo(Math.cos(a) * L * 0.5, Math.sin(a) * L * 0.17 + FB(-3, 3)).lineTo(Math.cos(a) * L, Math.sin(a) * L * 0.34).strokePath();
    }
    scene.tweens.add({ targets: g, alpha: 0, delay: 800 * T, duration: 700 * T, onComplete: kill(g) });
  } else if (sp === 'wind') {
    mark(160, 44, 0xd8f0d8, 0.45, 450, 600); // (17-11-2026) antes 0,35 y 250 ms: casi no se veía
    for (let i = 0; i < 6; i++) {
      const dir = i % 2 ? 1 : -1;
      const l = scene.add.rectangle(x, y + FB(-40, 40) * s, FB(40, 80) * s, 2.4 * s, pick([0xffffff, 0xcfffdc, 0x9cf0b0]), 0.9).setDepth(D).setBlendMode(ADD);
      scene.tweens.add({ targets: l, x: x + dir * FB(110, 190) * s, alpha: 0, scaleX: 1.8, delay: IB(0, 80), duration: IB(260, 380), ease: 'Cubic.easeOut', onComplete: kill(l) });
    }
  } else if (sp === 'shadow') {
    const pool = mark(170, 52, 0x08040c, 0.6, 900, 700);
    pool.setStrokeStyle(3 * s, 0x9b4dff, 0.8);
    for (let i = 0; i < 6; i++) {
      const w = scene.add.circle(x + FB(-30, 30) * s, gy, FB(3, 6) * s, pick([0xb57aff, 0xd0a8ff]), 0.9).setDepth(D).setBlendMode(ADD);
      scene.tweens.add({ targets: w, y: w.y - FB(50, 120) * s, alpha: 0, duration: IB(500, 850), ease: 'Quad.easeOut', onComplete: kill(w) });
    }
  } else if (sp === 'tulip') {
    mark(170, 50, 0xffc2dd, 0.4, 500, 700);
    for (let i = 0; i < 9; i++) {
      const pt = scene.add.ellipse(x + FB(-35, 35) * s, gy, FB(7, 11) * s, FB(4, 6) * s, pick([0xff6fae, 0xffb3d6, 0xffe6f2]), 0.95).setDepth(D).setRotation(FB(-1, 1));
      scene.tweens.add({ targets: pt, y: pt.y - FB(60, 130) * s, x: pt.x + FB(-40, 40) * s, rotation: pt.rotation + FB(-3, 3), alpha: 0, duration: IB(600, 1000), ease: 'Quad.easeOut', onComplete: kill(pt) });
    }
  } else if (sp === 'comet') {
    cometCrater(scene, x, gy, s, T); // (17-11-2026) cráter con estrellas
  } else if (sp === 'light') {
    mark(170, 50, 0xfff0b0, 0.5, 550, 700).setBlendMode(ADD); // (17-11-2026) se queda un poco más (antes 300 ms)
  } else if (sp === 'lightning') {
    // (17-11-2026) marca chamuscada con grietas que brillan: la misma idea que la de la ULTI (lightningGroundFx) pero mucho más chica y corta
    mark(115, 33, 0x0a0f1c, 0.5, 450, 500);
    const cracks = scene.add.graphics().setDepth(gy - 1.5).setBlendMode(ADD);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + FB(-0.4, 0.4);
      const L = FB(28, 50) * s;
      zap(cracks, x, gy, x + Math.cos(a) * L, gy + Math.sin(a) * L * 0.3, 4 * s, 1.2 * s, 0, 0.8);
    }
    scene.tweens.add({ targets: cracks, alpha: 0, delay: 250 * T, duration: 500 * T, ease: 'Quad.easeIn', onComplete: kill(cracks) });
    const g = scene.add.graphics().setDepth(gy - 1).setBlendMode(ADD);
    flicker(scene, g, 380, 55, (p) => {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + FB(-0.3, 0.3);
        const L = FB(50, 100) * s * Math.min(1, p * 2.4 + 0.3);
        zap(g, x, gy, x + Math.cos(a) * L, gy + Math.sin(a) * L * 0.32, 8 * s, 2 * s, 0, 1 - p * 0.8);
      }
    });
  }
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
  // (17-11-2026) ULTRA EFECTO no tiene hoja: sin bola que revienta (su ventilador lo pone fanBurst)
  const own = ballArtOf(el);
  const art = !own ? undefined : has(own.key) ? own : BALL_ART.fire;
  if (art && has(art.key)) {
    const [bw, bh] = ballDims(art, 90 * s);
    const ball = scene.add.sprite(x, y, art.key, art.seq?.[0] ?? 0).setDisplaySize(bw, bh).setDepth(D + 1).setBlendMode(ADD);
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
 * INFERNO DRIVE: explosión de fuego en el PRIMER bote (punto exacto del suelo). Solo visual, ~400 ms
 * (+ sacudida fuerte, columna de fuego, onda a ras de suelo, marca quemada ~1,6 s, trozos de cancha y brasas):
 *   contacto     destello naranja/amarillo intenso
 *   enseguida    llamas irregulares que se abren a ras de suelo (aplastadas por la perspectiva)
 *   a los lados  chispas ardientes
 *   suelo        resplandor cálido que se apaga
 * Sin círculos planos ni anillos: todo con texturas de fuego suaves (las de InfernoFx) y lenguas de fuego.
 */
export function infernoGroundFx(scene: Phaser.Scene, x: number, y: number, k: number, el: InfernoElement = 'fire') {
  // RAYO y VIENTO tienen su propio impacto (descarga eléctrica / torbellino), no las llamas teñidas
  if (el === 'lightning') return lightningGroundFx(scene, x, y, k);
  if (el === 'wind') return windGroundFx(scene, x, y, k);
  // (17-11-2026) ULTRA EFECTO: el golpe de aire del DROP SHOT 0 en grande + ventilador que se abre, y debajo el impacto de
  // siempre en blanco y menta
  if (el === 'ultra') {
    dropZeroBounceFx(scene, x, y, Math.max(0.7, k) * 2.6);
    fanBurst(scene, x, y - 10 * Math.max(0.7, k), Math.max(0.7, k) * 1.3, y + 5, 0.4);
  }
  // (17-11-2026) RÁFAGA: las pelotas caen una tras otra sobre el bote (a ras de suelo) y rebotan; debajo, el impacto de
  // siempre en lima
  if (el === 'barrage') barrageSlam(scene, x, y - 8 * Math.max(0.7, k), Math.max(0.7, k) * 1.2, y + 6, 0.5);
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
  // --- impacto más pesado (11-11-2026): la ULTI "golpea" la cancha
  // sacudida fuerte y corta (más que el impacto contra el cuerpo: es el remate que cae)
  scene.cameras.main.shake(320, 0.018);
  // columna de fuego que sube del punto de impacto y se deshace
  const pillar = soft(C.tongues[1], 70 * s, 220 * s, D + 1.5);
  pillar.setOrigin(0.5, 0.9).setScale(pillar.scaleX * 0.5, pillar.scaleY * 0.15).setAlpha(1);
  scene.tweens.add({ targets: pillar, scaleY: pillar.scaleY * 6.5, scaleX: pillar.scaleX * 1.4, duration: 130, ease: 'Cubic.easeOut' });
  scene.tweens.add({ targets: pillar, alpha: 0, scaleX: pillar.scaleX * 0.4, delay: 130, duration: 260, ease: 'Quad.easeIn', onComplete: kill(pillar) });
  const core = soft(C.groundFlash, 60 * s, 160 * s, D + 2);
  core.setOrigin(0.5, 0.9).setScale(core.scaleX * 0.5, core.scaleY * 0.15);
  scene.tweens.add({ targets: core, scaleY: core.scaleY * 5, alpha: 0, duration: 200, ease: 'Cubic.easeOut', onComplete: kill(core) });
  // onda expansiva a ras de suelo (dos pulsos aplastados por la perspectiva, sin borde duro)
  for (let i = 0; i < 2; i++) {
    const wave = soft(i ? C.wave : C.groundFlash, 120 * s, 36 * s, D - 0.5);
    wave.setAlpha(0.85 - i * 0.25);
    scene.tweens.add({ targets: wave, scaleX: wave.scaleX * (4.2 + i), scaleY: wave.scaleY * (3.2 + i), alpha: 0, delay: 30 + i * 90, duration: 380, ease: 'Cubic.easeOut', onComplete: kill(wave) });
  }
  // marca quemada (o escarcha con hielo) que queda un momento en la cancha
  const scorch = scene.add.ellipse(x, y, 150 * s, 44 * s, el === 'fire' ? 0x1a0a04 : C.ground, el === 'fire' ? 0.55 : 0.35).setDepth(D - 2);
  scorch.setScale(0.4);
  scene.tweens.add({ targets: scorch, scale: 1, duration: 140, ease: 'Cubic.easeOut' });
  scene.tweens.add({ targets: scorch, alpha: 0, delay: 900, duration: 700, ease: 'Quad.easeIn', onComplete: kill(scorch) });
  const embers = soft(C.ground, 110 * s, 30 * s, D - 1.5);
  embers.setAlpha(0.7);
  scene.tweens.add({ targets: embers, alpha: { from: 0.7, to: 0.25 }, duration: 260, yoyo: true, repeat: 2, onComplete: kill(embers) });
  // trozos de cancha que saltan y caen (arco con gravedad simple)
  for (let i = 0; i < 10; i++) {
    const dir = Phaser.Math.FloatBetween(-1, 1);
    const chunk = scene.add.rectangle(x, y - 4 * s, Phaser.Math.FloatBetween(4, 8) * s, Phaser.Math.FloatBetween(3, 6) * s, Phaser.Utils.Array.GetRandom([0x2b4a7a, 0x3b5f96, C.frags[1]]), 1).setDepth(D + 1);
    const dx = dir * Phaser.Math.FloatBetween(40, 130) * s;
    const up = Phaser.Math.FloatBetween(40, 95) * s;
    const ms = Phaser.Math.Between(420, 620);
    const t = { p: 0 };
    scene.tweens.add({
      targets: t,
      p: 1,
      duration: ms,
      ease: 'Linear',
      onUpdate: () => {
        chunk.setPosition(x + dx * t.p, y - 4 * s - up * 4 * t.p * (1 - t.p));
        chunk.setAngle(t.p * 540 * Math.sign(dir || 1));
      },
      onComplete: () => scene.tweens.add({ targets: chunk, alpha: 0, duration: 160, onComplete: kill(chunk) }),
    });
  }
  // brasas que suben despacio después del golpe
  for (let i = 0; i < 8; i++) {
    const e = scene.add.star(x + Phaser.Math.FloatBetween(-50, 50) * s, y - 4 * s, 4, 1.2 * s, 3.5 * s, Phaser.Utils.Array.GetRandom(C.frags)).setDepth(D + 2).setBlendMode(ADD).setAlpha(0);
    scene.tweens.add({ targets: e, alpha: { from: 1, to: 0 }, y: e.y - Phaser.Math.FloatBetween(60, 130) * s, x: e.x + Phaser.Math.FloatBetween(-20, 20) * s, delay: Phaser.Math.Between(120, 380), duration: Phaser.Math.Between(600, 900), ease: 'Sine.easeOut', onComplete: kill(e) });
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

/**
 * (17-11-2026) ULTRA EFECTO: VENTILADOR de aire gigante (las aspas curvas y las líneas en espiral del DROP SHOT 0) que se abre
 * girando muy rápido y se desvanece. `flat` aplasta el dibujo en vertical (a ras de suelo).
 */
function fanBurst(scene: Phaser.Scene, x: number, y: number, s: number, D: number, flat = 1) {
  const ADD = Phaser.BlendModes.ADD;
  const g = scene.add.graphics({ x, y }).setDepth(D).setBlendMode(ADD);
  const R0 = 14 * s;
  const R1 = 70 * s;
  for (let b = 0; b < 6; b++) {
    const a0 = (b * Math.PI * 2) / 6;
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= 8; i++) {
      const u = i / 8;
      const r = R0 + (R1 - R0) * u;
      pts.push({ x: Math.cos(a0 + u * 0.9) * r, y: Math.sin(a0 + u * 0.9) * r });
    }
    for (let i = 8; i >= 0; i--) {
      const u = i / 8;
      const r = R0 + (R1 - R0) * u;
      const a = a0 + u * 0.9 + 0.45 * (1 - u * 0.6);
      pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }
    g.fillStyle(0xc8ffd8, 0.4).fillPoints(pts, true);
    g.lineStyle(3 * s, 0xffffff, 0.95).strokePoints(pts.slice(0, 9), false);
  }
  for (let i = 0; i < 20; i++) {
    const a0 = (i / 20) * Math.PI * 2;
    const r0 = FB(60, 90) * s;
    const pts: { x: number; y: number }[] = [];
    for (let j = 0; j <= 6; j++) {
      const r = r0 + j * 9 * s;
      pts.push({ x: Math.cos(a0 + j * 0.12) * r, y: Math.sin(a0 + j * 0.12) * r });
    }
    g.lineStyle(2.6 * s, i % 3 ? 0xffffff : 0x9cf5d8, 0.9).strokePoints(pts, false);
  }
  g.fillStyle(0xffffff, 0.7).fillCircle(0, 0, 12 * s);
  g.setScale(0.3, 0.3 * flat);
  scene.tweens.add({ targets: g, scaleX: 2.1, scaleY: 2.1 * flat, angle: 240, alpha: 0, duration: 520, ease: 'Cubic.easeOut', onComplete: () => g.destroy() });
  for (let i = 0; i < 3; i++) {
    const ring = scene.add.ellipse(x, y, 60 * s, 60 * s * flat).setStrokeStyle((6 - i * 1.5) * s, i % 2 ? 0x9cf5d8 : 0xffffff, 0.95).setDepth(D - 0.5).setBlendMode(ADD);
    scene.tweens.add({ targets: ring, scale: 4 + i * 1.2, alpha: 0, delay: i * 70, duration: 460, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
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
