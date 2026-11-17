import Phaser from 'phaser';
import { FONT } from './theme';
import { roundedPoly } from './shapes';
import { fitText } from './fitText';
import { arcadeButton } from './modeButtons';
import { coinIcon } from './wheelArt';
import { fmtCoins } from './leagueStyle';
import type { BoardEntry } from '../domain/rankedBots';
import { rankedView } from '../logic/Ranked';

const NAVY = 0x0b1733;
const GOLD = 0xffc42e;

/**
 * RANKING GLOBAL (Ranked v2, docs/RANKED-V2.md §6): saldo de monedas de cada jugador, permanente (nunca se reinicia). Con bots
 * para completar la tabla (16-11-2026) y los jugadores reales siempre visibles. Por decisión del usuario (16-11-2026) se abre desde el MENÚ PRINCIPAL y NO desde la pantalla de LIGA, para no
 * confundirlo con el ranking semanal de la liga.
 */

/** Botón GLOBAL del menú (misma forma que DIARIO / AMIGOS: paralelogramo inclinado, icono arriba y texto abajo). */
export function globalRankingButton(scene: Phaser.Scene, x: number, y: number, w = 76, h = 76) {
  const c = scene.add.container(x, y).setDepth(50);
  const k = 14 * (h / 136) + 4;
  const shape = roundedPoly([[-w / 2 + k, -h / 2], [w / 2, -h / 2], [w / 2 - k, h / 2], [-w / 2, h / 2]], 14);
  const line = 0x3a7bff;
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.35).fillPoints(shape.map((p) => ({ x: p.x + 4, y: p.y + 7 })), true);
  g.lineStyle(10, line, 0.22).strokePoints(shape, true, true);
  g.fillStyle(NAVY, 0.94).fillPoints(shape, true);
  g.fillStyle(0x1b2d5c, 0.55).fillPoints(shape.filter((p) => p.y < 0).map((p) => ({ x: p.x * 0.97, y: p.y * 0.96 })), true);
  g.lineStyle(3, line, 1).strokePoints(shape, true, true);
  g.lineStyle(2, 0xffffff, 0.22).lineBetween(-w / 2 + k + 12, -h / 2 + 4, w / 2 - 12, -h / 2 + 4);
  // icono: globo terráqueo (círculo con meridiano y paralelos)
  const s = Math.min(1, h / 84);
  const ic = scene.add.graphics({ y: -h * 0.14 });
  const R = 15 * s;
  ic.fillStyle(0x37e0ff, 1).fillCircle(0, 0, R);
  ic.lineStyle(2.2 * s, NAVY, 0.9).strokeCircle(0, 0, R);
  ic.strokeEllipse(0, 0, R * 1.0, R * 2);
  ic.lineBetween(-R, 0, R, 0);
  ic.lineBetween(-R * 0.86, -R * 0.5, R * 0.86, -R * 0.5).lineBetween(-R * 0.86, R * 0.5, R * 0.86, R * 0.5);
  const t = scene.add.text(0, h / 2 - 15, 'GLOBAL', { fontFamily: FONT, fontSize: '17px', color: '#ffffff' }).setOrigin(0.5);
  fitText(t, w - 14, 0.55);
  c.add([g, ic, t]);
  c.setSize(w, h).setInteractive({ useHandCursor: true });
  c.on('pointerup', () => {
    scene.tweens.add({ targets: c, scale: { from: 0.88, to: 1 }, duration: 220, ease: 'Back.easeOut' });
    openGlobalRanking(scene);
  });
  return c;
}

/** Fila de la tabla global, centrada en (0,0) dentro de un contenedor (ancho rw, alto rh). */
function globalRow(scene: Phaser.Scene, e: BoardEntry, rw: number, rh: number, pinned = false) {
  const c = scene.add.container(0, 0);
  const me = e.id === 'me';
  const g = scene.add.graphics();
  g.fillStyle(me ? 0x3a2a08 : e.position % 2 ? 0x14224a : 0x101c3e, pinned ? 1 : 0.96).fillRoundedRect(-rw / 2, -rh / 2, rw, rh, 12);
  if (me) g.lineStyle(3, GOLD, 1).strokeRoundedRect(-rw / 2, -rh / 2, rw, rh, 12);
  else if (e.position <= 3) g.lineStyle(2, MEDAL[e.position - 1], 0.7).strokeRoundedRect(-rw / 2, -rh / 2, rw, rh, 12);
  const px = -rw / 2 + 32;
  const medal = e.position <= 3 ? MEDAL[e.position - 1] : 0;
  if (medal) g.fillStyle(0x0a1638, 1).fillCircle(px, 0, 19).fillStyle(medal, 1).fillCircle(px, 0, 16);
  // avatar (círculo del color del jugador con silueta)
  const ax = px + 44;
  g.fillStyle(0x0a1638, 1).fillCircle(ax, 0, 19);
  g.fillStyle(e.avatar.color, 1).fillCircle(ax, 0, 16);
  g.fillStyle(0x0a1638, 0.85).fillCircle(ax, -4, 6).fillRoundedRect(ax - 9, 3, 18, 8, { tl: 8, tr: 8, bl: 2, br: 2 });
  c.add(g);
  const pos = scene.add.text(px, 0, `${e.position}`, { fontFamily: FONT, fontSize: e.position >= 100 ? '14px' : '18px', color: medal ? '#0a1638' : '#9fb4e0' }).setOrigin(0.5);
  const nm = scene.add.text(ax + 28, -9, me ? `${e.name} (TÚ)` : e.name, { fontFamily: FONT, fontSize: '19px', color: me ? '#ffd23f' : '#ffffff' }).setOrigin(0, 0.5);
  fitText(nm, rw * 0.42);
  const lv = scene.add.text(ax + 28, 13, `NV ${e.level} · ${fmtCoins(e.wins)} VICTORIAS`, { fontFamily: FONT, fontSize: '12px', color: '#9fb4e0' }).setOrigin(0, 0.5);
  fitText(lv, rw * 0.42);
  const ct = scene.add.text(rw / 2 - 16, 0, fmtCoins(e.coins), { fontFamily: FONT, fontSize: '21px', color: '#ffd23f' }).setOrigin(1, 0.5);
  const ci = coinIcon(scene, ct.x - ct.width - 16, 0, 10); // (17-11-2026) moneda: imagen moneda-1.webp
  c.add([pos, nm, lv, ct, ci]);
  return c;
}

const MEDAL = [GOLD, 0xc0c8d8, 0xd88a4a];

/**
 * Ventana del RANKING GLOBAL (encima de todo; se cierra con CERRAR o tocando fuera). Top 100 por saldo de monedas, con bots
 * para que no se vea vacía (16-11-2026) y los jugadores reales SIEMPRE visibles: la lista se desplaza (arrastrar o rueda), abre
 * centrada en ti y tu fila queda fija abajo.
 */
export function openGlobalRanking(scene: Phaser.Scene) {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const v = rankedView();
  const board = v.globalBoard;
  const meEntry = board.find((e) => e.id === 'me');
  const root = scene.add.container(0, 0).setDepth(9000);
  const dim = scene.add.rectangle(0, 0, W, H, 0x000000, 0.75).setOrigin(0).setInteractive();
  const pw = Math.min(660, W - 28);
  const ph = Math.min(1100, H - 100);
  const top = (H - ph) / 2;
  const panel = scene.add.graphics();
  panel.fillStyle(NAVY, 0.98).fillRoundedRect(W / 2 - pw / 2, top, pw, ph, 24);
  panel.fillStyle(0x2a1d04, 0.6).fillRoundedRect(W / 2 - pw / 2 + 4, top + 4, pw - 8, 128, { tl: 20, tr: 20, bl: 0, br: 0 });
  panel.lineStyle(10, GOLD, 0.15).strokeRoundedRect(W / 2 - pw / 2, top, pw, ph, 24);
  panel.lineStyle(3, GOLD, 1).strokeRoundedRect(W / 2 - pw / 2, top, pw, ph, 24);
  const block = scene.add.zone(W / 2, top + ph / 2, pw, ph).setInteractive(); // tocar el panel no cierra
  const title = scene.add.text(W / 2, top + 44, 'RANKING GLOBAL', { fontFamily: FONT, fontSize: '36px', color: '#ffd23f', stroke: '#0a1638', strokeThickness: 7 }).setOrigin(0.5).setLetterSpacing(2);
  const sub = scene.add.text(W / 2, top + 82, 'Las monedas de cada jugador · nunca se reinicia', { fontFamily: FONT, fontSize: '15px', color: '#9fb4e0' }).setOrigin(0.5);
  fitText(sub, pw - 40);
  const mine = scene.add.text(W / 2, top + 110, meEntry ? `TU PUESTO: #${meEntry.position}` : '', { fontFamily: FONT, fontSize: '18px', color: '#ffe680' }).setOrigin(0.5).setLetterSpacing(1);
  root.add([dim, panel, block, title, sub, mine]);

  // lista con desplazamiento (máscara) y tu fila fija abajo
  const rowH = 62;
  const rw = pw - 32;
  const listTop = top + 140;
  const listBottom = top + ph - 180;
  const list = scene.add.container(W / 2, listTop);
  board.forEach((e, i) => {
    const row = globalRow(scene, e, rw, rowH - 6);
    row.setPosition(0, i * rowH + rowH / 2);
    list.add(row);
  });
  const maskG = scene.make.graphics({}, false);
  maskG.fillRect(W / 2 - pw / 2, listTop, pw, listBottom - listTop);
  list.setMask(maskG.createGeometryMask());
  root.add(list);
  const maxScroll = Math.max(0, board.length * rowH - (listBottom - listTop));
  let scroll = 0;
  const setScroll = (sv: number) => {
    scroll = Phaser.Math.Clamp(sv, 0, maxScroll);
    list.y = listTop - scroll;
  };
  if (meEntry) setScroll(board.indexOf(meEntry) * rowH - (listBottom - listTop) / 2 + rowH / 2);
  const zone = scene.add.zone(W / 2, (listTop + listBottom) / 2, pw, listBottom - listTop).setInteractive();
  root.add(zone);
  let dragY: number | null = null;
  let start = 0;
  zone.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
    dragY = ptr.y;
    start = scroll;
  });
  const move = (ptr: Phaser.Input.Pointer) => {
    if (dragY != null && ptr.isDown) setScroll(start - (ptr.y - dragY));
  };
  const up = () => (dragY = null);
  scene.input.on('pointermove', move);
  scene.input.on('pointerup', up);
  zone.on('wheel', (_p: unknown, _dx: number, dy: number) => setScroll(scroll + dy));
  // separador y tu fila fija
  const sep = scene.add.graphics();
  sep.fillStyle(GOLD, 0.5).fillRect(W / 2 - rw / 2, listBottom + 8, rw, 2);
  root.add(sep);
  if (meEntry) {
    const pinned = globalRow(scene, meEntry, rw, rowH - 4, true);
    pinned.setPosition(W / 2, listBottom + 14 + rowH / 2);
    root.add(pinned);
  }

  const close = () => {
    scene.input.off('pointermove', move);
    scene.input.off('pointerup', up);
    maskG.destroy();
    root.destroy();
  };
  const btn = arcadeButton(scene, W / 2, top + ph - 56, Math.min(300, pw - 60), 64, 'CERRAR', close, { palette: 'yellow' });
  root.add(btn);
  dim.once('pointerup', close);
  root.setAlpha(0);
  scene.tweens.add({ targets: root, alpha: 1, duration: 180 });
  return root;
}
