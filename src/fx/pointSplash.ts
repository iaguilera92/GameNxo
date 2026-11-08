import Phaser from 'phaser';
import { FONT } from '../ui/theme';
import { VIEW } from '../view/projection';
import { GAMES_TO_WIN, GOLDEN_POINT } from '../config';

/**
 * Marcador del punto en mitad de la pantalla (~2 s): dos franjas inclinadas entran desde los lados
 * (jugador por la izquierda en azul, rival por la derecha en rojo), se cruzan en una diagonal con un
 * rayo de energía, muestran el marcador del juego (15 / 30 / 40 / AD) y salen. La franja de quien ganó
 * el punto brilla y su cifra salta. Fijo en pantalla (cámara de interfaz: scrollFactor 0).
 */
export interface PointSplashOpts {
  playerName: string;
  rivalName: string;
  /** etiquetas tras el punto: [jugador, rival] */
  labels: [string, string];
  /** quién ganó el punto */
  winner: 'player' | 'bot';
  /** texto extra opcional (Iguales, Ventaja, Juego para…) */
  status?: string | null;
  /** título pequeño sobre las franjas (p. ej. "JUEGOS" cuando se muestra el marcador de juegos) */
  title?: string;
  /** aviso grande de punto de partido */
  matchPoint?: boolean;
}

/**
 * ¿El siguiente punto de `s` gana el juego? (mismas reglas que logic/Score.ts: 40 con ventaja de puntos,
 * ventaja, o punto de oro en iguales).
 */
function nextWinsGame(points: [number, number], s: 0 | 1) {
  const a = points[s];
  const b = points[1 - s];
  if (a >= 3 && b >= 3) return a > b || (GOLDEN_POINT && a === b);
  return a === 3;
}

/** ¿Hay punto de partido para alguno de los dos con este marcador? */
export function isMatchPoint(points: [number, number], games: [number, number]) {
  return ([0, 1] as const).some((s) => games[s] >= GAMES_TO_WIN - 1 && nextWinsGame(points, s));
}

export const POINT_SPLASH_MS = 2000;

const BAND_H = 96;
const SLANT = 46;
const COLORS = {
  player: { fill: 0x2f7bff, dark: 0x0f2a6e, light: 0x8fc0ff },
  bot: { fill: 0xff4f5e, dark: 0x6e1020, light: 0xffb0b8 },
};

export function showPointSplash(scene: Phaser.Scene, o: PointSplashOpts) {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const cy = Math.min(H, VIEW.H) * 0.42;
  const cx = W / 2;
  const root = scene.add.container(0, 0).setScrollFactor(0).setDepth(6100);

  const band = (side: 'player' | 'bot') => {
    const left = side === 'player';
    const col = COLORS[side];
    const won = o.winner === side;
    const y = cy + (left ? -BAND_H / 2 - 4 : BAND_H / 2 + 4);
    const c = scene.add.container(left ? -W : W, 0);
    const g = scene.add.graphics();
    // franja: del borde de la pantalla hasta la diagonal central
    const top = y - BAND_H / 2;
    const bot = y + BAND_H / 2;
    const pts = left
      ? [{ x: -20, y: top }, { x: cx + SLANT, y: top }, { x: cx - SLANT, y: bot }, { x: -20, y: bot }]
      : [{ x: cx + SLANT + 10, y: top }, { x: W + 20, y: top }, { x: W + 20, y: bot }, { x: cx - SLANT + 10, y: bot }];
    g.fillStyle(0x000000, 0.35).fillPoints(pts.map((p) => ({ x: p.x + 4, y: p.y + 6 })), true);
    g.fillStyle(won ? col.fill : col.dark, 1).fillPoints(pts, true);
    // brillo superior y filo claro
    const k = 0.42;
    const mid = pts.map((p, i) => ({ x: i < 2 ? p.x : p.x + (pts[i === 2 ? 1 : 0].x - p.x) * (1 - k), y: i < 2 ? p.y : top + BAND_H * k }));
    g.fillStyle(0xffffff, won ? 0.18 : 0.08).fillPoints(mid, true);
    g.lineStyle(3, won ? 0xffffff : col.light, won ? 0.9 : 0.4).strokePoints(pts, true, true);
    // tramado de rayas diagonales (textura deportiva)
    g.lineStyle(2, 0xffffff, 0.06);
    for (let x = left ? 0 : cx; x < (left ? cx : W); x += 18) g.lineBetween(x, bot, x + 30, top);
    c.add(g);
    // nombre (pestaña sobre la franja, hacia fuera del centro)
    const nameX = left ? cx - SLANT - 150 : cx + SLANT + 150;
    const tag = scene.add.text(nameX, top - 4, o[left ? 'playerName' : 'rivalName'].toUpperCase(), { fontFamily: FONT, fontSize: '24px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 6 }).setOrigin(left ? 1 : 0, 1);
    if (tag.width > W / 2 - 120) tag.setScale((W / 2 - 120) / tag.width);
    c.add(tag);
    // cifra cerca de la diagonal
    const num = scene.add
      .text(left ? cx - SLANT - 26 : cx + SLANT + 30, y + 2, o.labels[left ? 0 : 1], { fontFamily: FONT, fontSize: '76px', color: won ? '#ffffff' : '#c9d4ee', stroke: '#0a1638', strokeThickness: 8 })
      .setOrigin(left ? 1 : 0, 0.5);
    c.add(num);
    root.add(c);
    return { c, num, won, y };
  };

  const a = band('player');
  const b = band('bot');

  // rayo de energía en la diagonal central
  const bolt = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
  const drawBolt = () => {
    bolt.clear();
    const y0 = cy - BAND_H - 40;
    const y1 = cy + BAND_H + 40;
    const steps = 9;
    const pts: Phaser.Types.Math.Vector2Like[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = cx + SLANT * 2.2 * (0.5 - t) + 5 + (i > 0 && i < steps ? Phaser.Math.Between(-9, 9) : 0);
      pts.push({ x, y: y0 + (y1 - y0) * t });
    }
    bolt.lineStyle(14, 0xb58cff, 0.35).strokePoints(pts);
    bolt.lineStyle(6, 0xd9c4ff, 0.8).strokePoints(pts);
    bolt.lineStyle(2, 0xffffff, 1).strokePoints(pts);
  };
  drawBolt();
  root.add(bolt);
  const flicker = scene.time.addEvent({ delay: 60, loop: true, callback: drawBolt });

  // título (JUEGOS) y texto de estado (Iguales / Ventaja / Juego para…)
  const extras: Phaser.GameObjects.GameObject[] = [];
  if (o.title) {
    const t = scene.add.text(cx, cy - BAND_H - 46, o.title, { fontFamily: FONT, fontSize: '24px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 6 }).setOrigin(0.5).setLetterSpacing(4).setAlpha(0);
    root.add(t);
    extras.push(t);
  }
  if (o.status) {
    const st = scene.add.text(cx, cy + BAND_H + 38, o.status.toUpperCase(), { fontFamily: FONT, fontSize: '26px', color: '#ffd23f', stroke: '#0a1638', strokeThickness: 6 }).setOrigin(0.5).setAlpha(0);
    root.add(st);
    extras.push(st);
  }
  // PUNTO DE PARTIDO: placa roja con borde dorado que late
  if (o.matchPoint) {
    const mp = scene.add.container(cx, cy + BAND_H + (o.status ? 96 : 50)).setAlpha(0);
    const lbl = scene.add.text(0, 0, '¡PUNTO DE PARTIDO!', { fontFamily: FONT, fontSize: '34px', color: '#ffffff', stroke: '#5a0010', strokeThickness: 6 }).setOrigin(0.5).setLetterSpacing(2);
    const pw = lbl.width + 48;
    const pg = scene.add.graphics();
    pg.fillStyle(0x000000, 0.35).fillRoundedRect(-pw / 2 + 3, -27, pw, 56, 28);
    pg.fillStyle(0xd81e3a, 1).fillRoundedRect(-pw / 2, -30, pw, 56, 28);
    pg.fillStyle(0xffffff, 0.2).fillRoundedRect(-pw / 2 + 10, -26, pw - 20, 14, 7);
    pg.lineStyle(3, 0xffd23f, 1).strokeRoundedRect(-pw / 2, -30, pw, 56, 28);
    mp.add([pg, lbl]);
    root.add(mp);
    extras.push(mp);
    scene.tweens.add({ targets: mp, scale: { from: 0.6, to: 1 }, duration: 320, delay: 380, ease: 'Back.easeOut' });
    scene.tweens.add({ targets: lbl, scale: 1.08, duration: 260, yoyo: true, repeat: 3, delay: 700 });
  }

  // entrada → espera → salida
  const IN = 280;
  const OUT = 240;
  scene.tweens.add({ targets: a.c, x: 0, duration: IN, ease: 'Cubic.easeOut' });
  scene.tweens.add({ targets: b.c, x: 0, duration: IN, delay: 60, ease: 'Cubic.easeOut' });
  scene.tweens.add({ targets: bolt, alpha: 1, duration: 120, delay: IN - 40 });
  if (extras.length) scene.tweens.add({ targets: extras, alpha: 1, duration: 200, delay: IN + 80 });
  // la cifra de quien ganó el punto salta
  const w = a.won ? a : b;
  scene.tweens.add({ targets: w.num, scale: { from: 1.5, to: 1 }, duration: 380, delay: IN + 40, ease: 'Back.easeOut' });
  const spark = scene.add.circle(w.num.x + (a.won ? -w.num.width / 2 : w.num.width / 2), w.y, 30, 0xffffff, 0).setBlendMode(Phaser.BlendModes.ADD);
  w.c.add(spark);
  scene.tweens.add({ targets: spark, fillAlpha: { from: 0.7, to: 0 }, scale: { from: 0.6, to: 3 }, duration: 450, delay: IN + 40 });

  const outAt = POINT_SPLASH_MS - OUT - 60;
  scene.time.delayedCall(outAt, () => {
    flicker.remove();
    scene.tweens.add({ targets: bolt, alpha: 0, duration: 120 });
    if (extras.length) scene.tweens.add({ targets: extras, alpha: 0, duration: 150 });
    scene.tweens.add({ targets: a.c, x: -W, duration: OUT, ease: 'Cubic.easeIn' });
    scene.tweens.add({ targets: b.c, x: W, duration: OUT, ease: 'Cubic.easeIn', onComplete: () => root.destroy() });
  });
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => flicker.remove());
  return root;
}
