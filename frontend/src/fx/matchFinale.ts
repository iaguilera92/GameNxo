import Phaser from 'phaser';
import { FONT } from '../ui/theme';
import { VIEW } from '../view/projection';

/**
 * FINAL DEL PARTIDO (~3,2 s, fijo en pantalla), justo después del último punto y antes de la pantalla
 * de resultados:
 *   0,00 s  destello blanco y la pantalla se oscurece
 *   0,35 s  MARCADOR FINAL al centro: tus juegos y los del rival; la cifra del ganador sube (1 → 2) con salto y brillo,
 *           corona sobre el ganador
 *   1,00 s  textos de abajo, solo texto: ganas = "JUEGO, SET Y PARTIDO!" en una línea, de uno en uno (JUEGO, luego SET, luego
 *           Y PARTIDO!); pierdes = "PARTIDO PERDIDO". Sin confeti, ceniza ni fanfarria. La pantalla de resultados
 *           (VICTORIA / DERROTA) no cambia.
 * Devuelve la duración (ms) para lanzar después el final de siempre (playMatchEnd). Solo visual.
 */
export interface MatchFinaleOpts {
  win: boolean;
  playerName: string;
  rivalName: string;
  /** juegos finales [tú, rival] */
  games: [number, number];
}

/** separación entre las palabras JUEGO · SET · Y PARTIDO! (ms) */
const WORD_GAP_MS = 430;
/** instante (ms) en que empiezan los textos de abajo */
const TEXT_AT_MS = 1000;

export const MATCH_FINALE_MS = 3200;

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
  // 0,35 — marcador final
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
      scene.tweens.add({ targets: crown, scale: 1, angle: 0, delay: 900, duration: 380, ease: 'Back.easeOut' });
    }
  });
  scene.tweens.add({ targets: panel, alpha: 1, scale: 1, delay: 300, duration: 320, ease: 'Back.easeOut' });
  // la cifra del ganador sube (salto, brillo y "tic")
  const wi = o.win ? 0 : 1;
  scene.time.delayedCall(700, () => {
    const n = numbers[wi];
    if (!n.active) return;
    n.setText(String(rows[wi].games));
    scene.tweens.add({ targets: n, scale: { from: 1.9, to: 1 }, duration: 380, ease: 'Back.easeOut' });
    const ring = add(scene.add.circle(cx + pw / 2 - 54, cy - 40 - rowH / 2 + wi * (rowH + 4), 20, GOLD, 0).setStrokeStyle(4, GOLD).setDepth(D + 4));
    scene.tweens.add({ targets: ring, scale: 3, alpha: 0, duration: 420, ease: 'Cubic.easeOut' });
    tick(scene);
  });

  // 1,0 — textos de abajo (solo texto, sin confeti ni ceniza ni fanfarria)
  //  · ganas: "JUEGO, SET Y PARTIDO!" en UNA línea; aparecen de uno en uno: JUEGO, luego SET y luego Y PARTIDO!
  //  · pierdes: "PARTIDO PERDIDO"
  // (la pantalla de resultados ya dice VICTORIA / DERROTA)
  const textY = cy + 150;
  const size = 60;
  if (o.win) {
    const parts = ['JUEGO,', 'SET', 'Y PARTIDO!'];
    const gap = 22;
    const row = add(scene.add.container(cx, textY).setDepth(D + 5));
    const items = parts.map((s) => scene.add.text(0, 0, s, { fontFamily: FONT, fontSize: `${size}px`, color: '#ffd23f', stroke: '#5a3a00', strokeThickness: 9 }).setOrigin(0.5));
    const total = items.reduce((n, it) => n + it.width, 0) + gap * (parts.length - 1);
    let x = -total / 2;
    items.forEach((it) => {
      it.setX(x + it.width / 2).setAlpha(0).setScale(2.4);
      x += it.width + gap;
      row.add(it);
    });
    row.setScale(Math.min(1, (W - 30) / total)); // en pantallas angostas la línea entera se achica, sigue en una sola fila
    items.forEach((it, i) => {
      scene.tweens.add({
        targets: it,
        alpha: 1,
        scale: 1,
        delay: TEXT_AT_MS + i * WORD_GAP_MS,
        duration: 260,
        ease: 'Back.easeOut',
        onStart: () => {
          scene.cameras.main.shake(110, i === parts.length - 1 ? 0.009 : 0.006);
          wordHit(scene, i);
        },
      });
    });
  } else {
    const lost = txt(cx, textY, 'PARTIDO PERDIDO', Math.min(68, Math.floor((W - 40) / 9.5)), '#ff6b78', '#2a0610');
    lost.setLetterSpacing(3).setAlpha(0);
    scene.tweens.add({ targets: lost, alpha: 1, delay: TEXT_AT_MS, duration: 400, ease: 'Sine.easeOut' });
  }

  // fuera: todo se desvanece antes de la pantalla de resultados
  scene.time.delayedCall(MATCH_FINALE_MS - 320, () => {
    for (const ob of objs) if (ob.active) scene.tweens.add({ targets: ob, alpha: 0, duration: 300 });
  });
  scene.time.delayedCall(MATCH_FINALE_MS + 50, () => objs.forEach((ob) => ob.active && ob.destroy()));
  return MATCH_FINALE_MS;
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


