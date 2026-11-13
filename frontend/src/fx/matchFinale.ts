import Phaser from 'phaser';
import { FONT } from '../ui/theme';
import { VIEW } from '../view/projection';

/**
 * FINAL DEL PARTIDO con espectáculo (~3,2 s, fijo en pantalla), justo después del último punto y antes de la pantalla
 * de resultados:
 *   0,00 s  destello blanco, golpe de cámara y, una tras otra, JUEGO · SET · ¡PARTIDO! (cada una entra con golpe y sonido;
 *           las dos primeras se van al llegar la siguiente y ¡PARTIDO! se queda sobre el marcador)
 *   1,20 s  MARCADOR FINAL al centro: tus juegos y los del rival; la cifra del ganador sube (1 → 2) con salto y brillo,
 *           corona sobre el ganador
 *   1,90 s  sello grande ¡PARTIDO GANADO! (dorado, confeti y fanfarria) o PARTIDO PERDIDO (rojo,
 *           pantalla oscura, ceniza que cae y notas que bajan). La pantalla de resultados (VICTORIA / DERROTA) no cambia.
 * Devuelve la duración (ms) para lanzar después el final de siempre (playMatchEnd). Solo visual.
 */
export interface MatchFinaleOpts {
  win: boolean;
  playerName: string;
  rivalName: string;
  /** juegos finales [tú, rival] */
  games: [number, number];
}

/** separación entre las palabras JUEGO · SET · ¡PARTIDO! (ms) */
const WORD_GAP_MS = 430;
/** retraso de todo lo que viene después de las tres palabras (marcador, cifra, corona y sello) */
const SEQ_MS = 900;

export const MATCH_FINALE_MS = 3200 + SEQ_MS;

const GOLD = 0xffd23f;
const RED = 0xff4f5e;
const BLUE = 0x2f7bff;

export function playMatchFinale(scene: Phaser.Scene, o: MatchFinaleOpts): number {
  const W = scene.scale.width;
  const H = Math.min(scene.scale.height, VIEW.H);
  const cx = W / 2;
  const cy = H * 0.4;
  const D = 6400;
  const objs: Phaser.GameObjects.GameObject[] = [];
  const add = <T extends Phaser.GameObjects.GameObject>(g: T): T => {
    (g as unknown as Phaser.GameObjects.Components.ScrollFactor).setScrollFactor?.(0);
    objs.push(g);
    return g;
  };
  const txt = (x: number, y: number, s: string, size: number, color: string, stroke = '#1a1033') =>
    add(scene.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, stroke, strokeThickness: Math.max(4, Math.round(size * 0.16)) }).setOrigin(0.5).setDepth(D + 5));

  // 0 — destello, golpe de cámara y oscurecer
  const flash = add(scene.add.rectangle(0, 0, W, scene.scale.height, 0xffffff, 0.85).setOrigin(0).setDepth(D + 9));
  scene.tweens.add({ targets: flash, alpha: 0, duration: 260, ease: 'Quad.easeOut' });
  scene.cameras.main.shake(260, o.win ? 0.012 : 0.008);
  const dim = add(scene.add.rectangle(0, 0, W, scene.scale.height, o.win ? 0x050b1e : 0x12040a, 0).setOrigin(0).setDepth(D));
  scene.tweens.add({ targets: dim, fillAlpha: o.win ? 0.55 : 0.7, duration: 420 });
  // 0 → 0,9 — "JUEGO", luego "SET" y por último "¡PARTIDO!": cada palabra entra con golpe y sonido; las dos primeras se
  // van cuando llega la siguiente y "¡PARTIDO!" se queda sobre el marcador
  const wordY = cy - 175;
  const words: { text: string; size: number; color: string; stroke: string }[] = [
    { text: 'JUEGO', size: 84, color: '#ffffff', stroke: '#0a1638' },
    { text: 'SET', size: 84, color: '#ffffff', stroke: '#0a1638' },
    { text: '¡PARTIDO!', size: 76, color: o.win ? '#ffd23f' : '#ff9aa3', stroke: o.win ? '#5a3a00' : '#2a0610' },
  ];
  words.forEach((w, i) => {
    const at = i * WORD_GAP_MS;
    const last = i === words.length - 1;
    const t = txt(cx, wordY, w.text, Math.min(w.size, Math.floor((W - 60) / (w.text.length * 0.6))), w.color, w.stroke);
    t.setLetterSpacing(4).setAlpha(0).setScale(2.4);
    scene.tweens.add({
      targets: t,
      alpha: 1,
      scale: 1,
      delay: at,
      duration: 260,
      ease: 'Back.easeOut',
      onStart: () => {
        scene.cameras.main.shake(110, last ? 0.009 : 0.006);
        wordHit(scene, i);
      },
    });
    if (last) scene.tweens.add({ targets: t, scale: 1.05, delay: at + 420, duration: 480, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    else scene.tweens.add({ targets: t, alpha: 0, scale: 1.18, delay: at + WORD_GAP_MS - 90, duration: 110, ease: 'Quad.easeIn' });
  });

  // marcador final (tras las tres palabras)
  const panel = add(scene.add.container(cx, cy - 40).setDepth(D + 3).setAlpha(0).setScale(0.7));
  const pw = Math.min(520, W - 40);
  const rowH = 62;
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.45).fillRoundedRect(-pw / 2 + 4, -rowH + 6, pw, rowH * 2 + 8, 18);
  g.fillStyle(0x0b1733, 0.96).fillRoundedRect(-pw / 2, -rowH, pw, rowH * 2 + 4, 18);
  g.lineStyle(3, 0x3a7bff, 1).strokeRoundedRect(-pw / 2, -rowH, pw, rowH * 2 + 4, 18);
  panel.add(g);
  const rows: { name: string; games: number; color: number; winner: boolean }[] = [
    { name: o.playerName || 'TÚ', games: o.games[0], color: BLUE, winner: o.win },
    { name: o.rivalName || 'RIVAL', games: o.games[1], color: RED, winner: !o.win },
  ];
  const numbers: Phaser.GameObjects.Text[] = [];
  rows.forEach((r, i) => {
    const y = -rowH / 2 + i * (rowH + 4);
    const hl = scene.add.graphics();
    if (r.winner) hl.fillStyle(GOLD, 0.22).fillRoundedRect(-pw / 2 + 6, y - rowH / 2 + 5, pw - 12, rowH - 6, 12);
    hl.fillStyle(r.color, 1).fillRoundedRect(-pw / 2 + 14, y - 18, 10, 36, 4);
    panel.add(hl);
    const name = scene.add.text(-pw / 2 + 40, y, r.name.toUpperCase(), { fontFamily: FONT, fontSize: '30px', color: r.winner ? '#ffe680' : '#cfd8ee', stroke: '#0a1638', strokeThickness: 5 }).setOrigin(0, 0.5);
    panel.add(name);
    // cifra: el ganador empieza con un juego menos y sube con salto
    const box = scene.add.graphics();
    box.fillStyle(r.winner ? 0x3a2a00 : 0x16264d, 1).fillRoundedRect(pw / 2 - 86, y - 25, 64, 50, 10);
    box.lineStyle(3, r.winner ? GOLD : 0x4a5f99, 1).strokeRoundedRect(pw / 2 - 86, y - 25, 64, 50, 10);
    panel.add(box);
    const n = scene.add.text(pw / 2 - 54, y + 1, String(r.winner ? Math.max(0, r.games - 1) : r.games), { fontFamily: FONT, fontSize: '40px', color: r.winner ? '#ffd23f' : '#ffffff', stroke: '#0a1638', strokeThickness: 6 }).setOrigin(0.5);
    panel.add(n);
    numbers.push(n);
    if (r.winner) {
      // corona sobre el nombre del ganador
      const crown = scene.add.graphics({ x: -pw / 2 + 40 + Math.min(name.width, pw - 200) + 26, y: y - 4 });
      crown.fillStyle(GOLD, 1).fillPoints(
        [
          new Phaser.Geom.Point(-16, 10),
          new Phaser.Geom.Point(-18, -8),
          new Phaser.Geom.Point(-8, 2),
          new Phaser.Geom.Point(0, -12),
          new Phaser.Geom.Point(8, 2),
          new Phaser.Geom.Point(18, -8),
          new Phaser.Geom.Point(16, 10),
        ],
        true,
      );
      crown.lineStyle(2, 0x7a5200, 1).strokePoints(
        [
          new Phaser.Geom.Point(-16, 10),
          new Phaser.Geom.Point(-18, -8),
          new Phaser.Geom.Point(-8, 2),
          new Phaser.Geom.Point(0, -12),
          new Phaser.Geom.Point(8, 2),
          new Phaser.Geom.Point(18, -8),
          new Phaser.Geom.Point(16, 10),
        ],
        true,
      );
      crown.setScale(0).setAngle(-20);
      panel.add(crown);
      scene.tweens.add({ targets: crown, scale: 1, angle: 0, delay: 900 + SEQ_MS, duration: 380, ease: 'Back.easeOut' });
    }
  });
  scene.tweens.add({ targets: panel, alpha: 1, scale: 1, delay: 300 + SEQ_MS, duration: 320, ease: 'Back.easeOut' });
  // la cifra del ganador sube (salto, brillo y "tic")
  const wi = o.win ? 0 : 1;
  scene.time.delayedCall(700 + SEQ_MS, () => {
    const n = numbers[wi];
    if (!n.active) return;
    n.setText(String(rows[wi].games));
    scene.tweens.add({ targets: n, scale: { from: 1.9, to: 1 }, duration: 380, ease: 'Back.easeOut' });
    const ring = add(scene.add.circle(cx + pw / 2 - 54, cy - 40 - rowH / 2 + wi * (rowH + 4), 20, GOLD, 0).setStrokeStyle(4, GOLD).setDepth(D + 4));
    scene.tweens.add({ targets: ring, scale: 3, alpha: 0, duration: 420, ease: 'Cubic.easeOut' });
    tick(scene);
  });

  // 1,0 — sello gigante
  const sealY = cy + 120;
  // (sin rayos detrás del sello: decisión del usuario, 12-11-2026)
  // (la pantalla de resultados ya dice VICTORIA / DERROTA: aquí se anuncia el fin del partido)
  const seal = txt(cx, sealY, o.win ? '¡PARTIDO GANADO!' : 'PARTIDO PERDIDO', Math.min(68, Math.floor((W - 40) / 9.5)), o.win ? '#ffd23f' : '#ff6b78', o.win ? '#5a3a00' : '#2a0610');
  seal.setLetterSpacing(3).setAlpha(0).setScale(3);
  scene.tweens.add({
    targets: seal,
    alpha: 1,
    scale: 1,
    delay: 1000 + SEQ_MS,
    duration: 360,
    ease: 'Back.easeOut',
    onStart: () => {
      scene.cameras.main.shake(220, o.win ? 0.014 : 0.01);
      if (o.win) {
        confetti(scene, cx, sealY, D + 6, objs);
        fanfare(scene);
      } else {
        ash(scene, W, H, D + 2, objs);
        sadTones(scene);
      }
    },
  });
  // brillo que recorre el sello (victoria) o latido apagado (derrota)
  scene.tweens.add({ targets: seal, scale: o.win ? 1.06 : 0.97, delay: 1400 + SEQ_MS, duration: 520, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' });

  // fuera: todo se desvanece antes de la pantalla de resultados
  scene.time.delayedCall(MATCH_FINALE_MS - 320, () => {
    for (const ob of objs) if (ob.active) scene.tweens.add({ targets: ob, alpha: 0, duration: 300 });
  });
  scene.time.delayedCall(MATCH_FINALE_MS + 50, () => objs.forEach((ob) => ob.active && ob.destroy()));
  return MATCH_FINALE_MS;
}

/** Confeti dorado, azul, rojo y blanco que estalla desde el sello y cae girando. */
function confetti(scene: Phaser.Scene, x: number, y: number, depth: number, objs: Phaser.GameObjects.GameObject[]) {
  const cols = [0xffd23f, 0x2f7bff, 0xff4f5e, 0xffffff, 0x3ccf5a];
  for (let i = 0; i < 70; i++) {
    const p = scene.add.rectangle(x, y, Phaser.Math.Between(6, 11), Phaser.Math.Between(10, 16), Phaser.Utils.Array.GetRandom(cols), 1).setScrollFactor(0).setDepth(depth);
    objs.push(p);
    const a = Phaser.Math.FloatBetween(-Math.PI, 0);
    const v = Phaser.Math.FloatBetween(160, 420);
    const dx = Math.cos(a) * v;
    const up = Math.sin(a) * v;
    const t = { k: 0 };
    const life = Phaser.Math.Between(1500, 2300);
    scene.tweens.add({
      targets: t,
      k: 1,
      duration: life,
      onUpdate: () => {
        const s = (t.k * life) / 1000;
        p.setPosition(x + dx * s, y + up * s + 520 * s * s);
        p.setAngle(t.k * 720 * (i % 2 ? 1 : -1));
        p.scaleX = Math.cos(t.k * 18 + i);
        p.setAlpha(1 - Math.max(0, t.k - 0.75) * 4);
      },
      onComplete: () => p.destroy(),
    });
  }
}

/** Derrota: ceniza gris que cae despacio por toda la pantalla. */
function ash(scene: Phaser.Scene, W: number, H: number, depth: number, objs: Phaser.GameObjects.GameObject[]) {
  for (let i = 0; i < 26; i++) {
    const p = scene.add.circle(Phaser.Math.Between(0, W), Phaser.Math.Between(-40, H * 0.4), Phaser.Math.FloatBetween(2, 4.5), 0x8a8f9e, 0.7).setScrollFactor(0).setDepth(depth);
    objs.push(p);
    scene.tweens.add({ targets: p, y: p.y + Phaser.Math.Between(260, 520), x: p.x + Phaser.Math.Between(-40, 40), alpha: 0, duration: Phaser.Math.Between(1600, 2400), ease: 'Sine.easeIn', onComplete: () => p.destroy() });
  }
}

function ctxOf(scene: Phaser.Scene): AudioContext | null {
  const ctx = (scene.sound as Phaser.Sound.WebAudioSoundManager)?.context as AudioContext | undefined;
  return ctx && ctx.state === 'running' ? ctx : null;
}

function note(ctx: AudioContext, f: number, at: number, dur: number, type: OscillatorType, vol: number) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(ctx.destination);
  o.start(at);
  o.stop(at + dur + 0.02);
}

/** Golpe de cada palabra (JUEGO · SET · ¡PARTIDO!): sube de tono con cada una. */
function wordHit(scene: Phaser.Scene, step: number) {
  const ctx = ctxOf(scene);
  if (!ctx) return;
  const f = [392, 523, 784][step] ?? 784;
  note(ctx, f, ctx.currentTime, 0.16, 'square', 0.09);
  if (step === 2) note(ctx, f * 2, ctx.currentTime, 0.3, 'triangle', 0.07);
}

/** "Tic" del marcador al subir la cifra. */
function tick(scene: Phaser.Scene) {
  const ctx = ctxOf(scene);
  if (!ctx) return;
  note(ctx, 1320, ctx.currentTime, 0.12, 'square', 0.08);
}

/** Fanfarria corta de victoria (arpegio que sube y acorde final). */
function fanfare(scene: Phaser.Scene) {
  const ctx = ctxOf(scene);
  if (!ctx) return;
  const t = ctx.currentTime;
  [523, 659, 784].forEach((f, i) => note(ctx, f, t + i * 0.11, 0.18, 'square', 0.09));
  [1047, 1319, 1568].forEach((f) => note(ctx, f, t + 0.36, 0.7, 'triangle', 0.1));
}

/** Notas que bajan (derrota). */
function sadTones(scene: Phaser.Scene) {
  const ctx = ctxOf(scene);
  if (!ctx) return;
  const t = ctx.currentTime;
  [392, 349, 311, 262].forEach((f, i) => note(ctx, f, t + i * 0.22, 0.4, 'triangle', 0.09));
}
