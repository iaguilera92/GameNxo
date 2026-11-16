import Phaser from 'phaser';
import { FONT } from './theme';
import { fitText } from './fitText';
import { RankBadge } from './RankBadge';
import { drawCoinIcon } from './wheelArt';
import { LEAGUE_STYLE, fmtLeft, fmtNet } from './leagueStyle';
import { rankDef } from '../domain/ranks';
import { RANKED } from '../domain/rankedConfig';
import type { BoardEntry } from '../domain/rankedBots';
import { leagueLeaders, rankedView } from '../logic/Ranked';

const NAVY = 0x0b1733;
const GOLD = 0xffc42e;

/**
 * TOP 100 del RANKING LIGA (neto de la semana, con bots): la ventana que se abre con "VER TOP 100" en LIGA y, desde el 21-11-2026, también
 * tocando la card de monedas de liga del MENÚ PRINCIPAL. Antes vivía dentro de RankedScene.leaderboard; ahora es de las dos escenas.
 *
 * `dim`: false si la escena ya puso su propio oscurecido (LIGA usa su overlay). `onClose`: al tocar ✕ o fuera del panel. La ventana se borra
 * sola al cerrarse (o al destruir el contenedor devuelto) y suelta sus listeners y su máscara.
 */
export function openLeagueRanking(scene: Phaser.Scene, opts: { onClose?: () => void; dim?: boolean } = {}) {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const v = rankedView();
  const board = v.board;
  const myPos = board.find((e) => e.id === 'me')?.position ?? null;
  const st = LEAGUE_STYLE[v.league];
  const root = scene.add.container(0, 0).setDepth(8000).setScrollFactor(0);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    if (opts.onClose) opts.onClose();
    if (root.active) root.destroy();
  };
  if (opts.dim !== false) {
    const shade = scene.add.rectangle(0, 0, W, H, 0x02060f, 0.75).setOrigin(0).setInteractive();
    shade.once('pointerup', close);
    root.add(shade);
  }
  const pw = Math.min(680, W - 24);
  const top = 96;
  const bottom = H - 30;
  const ph = bottom - top;
  const p = scene.add.container(W / 2, top);
  root.add(p);
  p.add(scene.add.rectangle(0, ph / 2, pw, ph, 0, 0.001).setInteractive());
  const g = scene.add.graphics();
  g.fillStyle(NAVY, 0.98).fillRoundedRect(-pw / 2, 0, pw, ph, 24);
  g.lineStyle(3, st.color, 1).strokeRoundedRect(-pw / 2, 0, pw, ph, 24);
  p.add(g);
  p.add(scene.add.text(0, 36, `TOP ${RANKED.tableSize} · LIGA ${rankDef(v.league).name.toUpperCase()}`, { fontFamily: FONT, fontSize: '30px', color: st.css, stroke: '#0a1638', strokeThickness: 5 }).setOrigin(0.5).setLetterSpacing(2));
  p.add(scene.add.text(0, 68, `Neto de la semana · cierra en ${fmtLeft(v.msLeft)} · premios Top 1, 2-3, 4-10 y 11-50`, { fontFamily: FONT, fontSize: '14px', color: '#9fb4e0' }).setOrigin(0.5));

  // mejores de cada liga
  const leaders = leagueLeaders();
  const lw = (pw - 30) / leaders.length;
  leaders.forEach((l, i) => {
    const x = -pw / 2 + 15 + lw * (i + 0.5);
    p.add(new RankBadge(scene, x, 112, { rank: l.league, level: 99, size: 40 }));
    const nm = scene.add.text(x, 142, l.top.id === 'me' ? 'TÚ' : l.top.name, { fontFamily: FONT, fontSize: '12px', color: l.top.id === 'me' ? '#ffd23f' : '#dbe5ff' }).setOrigin(0.5);
    fitText(nm, lw - 6);
    p.add(nm);
  });
  p.add(scene.add.text(0, 162, 'MEJOR JUGADOR DE CADA LIGA', { fontFamily: FONT, fontSize: '11px', color: '#7f93bf' }).setOrigin(0.5).setLetterSpacing(1));

  // lista con desplazamiento
  const listTop = 180;
  const listBottom = ph - 92;
  const rowH = 58;
  const list = scene.add.container(0, listTop);
  p.add(list);
  const maskG = scene.make.graphics({}, false);
  maskG.fillRect(W / 2 - pw / 2, top + listTop, pw, listBottom - listTop);
  list.setMask(maskG.createGeometryMask());
  board.forEach((e, i) => list.add(boardRow(scene, e, i * rowH + rowH / 2, pw - 24, rowH - 6)));
  const maxScroll = Math.max(0, board.length * rowH - (listBottom - listTop));
  let scroll = 0;
  const setScroll = (s: number) => {
    scroll = Phaser.Math.Clamp(s, 0, maxScroll);
    list.y = listTop - scroll;
  };
  // abre centrado en el jugador
  if (myPos) setScroll((myPos - 1) * rowH - (listBottom - listTop) / 2 + rowH / 2);
  const zone = scene.add.zone(W / 2, top + (listTop + listBottom) / 2, pw, listBottom - listTop).setInteractive();
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

  // fila fija del jugador
  const me = board.find((e) => e.id === 'me');
  if (me) p.add(boardRow(scene, me, listBottom + 6 + rowH / 2, pw - 24, rowH - 4, true));
  // cerrar
  const x = scene.add.text(pw / 2 - 30, 34, '✕', { fontFamily: FONT, fontSize: '30px', color: '#9fb4e0' }).setOrigin(0.5).setInteractive({ useHandCursor: true });
  x.on('pointerup', close);
  p.add(x);
  root.once(Phaser.GameObjects.Events.DESTROY, () => {
    closed = true;
    scene.input.off('pointermove', move);
    scene.input.off('pointerup', up);
    maskG.destroy();
  });
  root.setAlpha(0);
  scene.tweens.add({ targets: root, alpha: 1, duration: 180 });
  return root;
}

/** Fila de la tabla del Ranking Liga (neto con signo). */
function boardRow(scene: Phaser.Scene, e: BoardEntry, y: number, w: number, h: number, pinned = false) {
  const c = scene.add.container(0, y);
  const me = e.id === 'me';
  const medal = e.position === 1 ? GOLD : e.position <= 10 ? 0xc0c8d8 : e.position <= 50 ? 0xd88a4a : 0;
  const g = scene.add.graphics();
  g.fillStyle(me ? 0x3a2a08 : e.position % 2 ? 0x14224a : 0x101c3e, pinned ? 1 : 0.95).fillRoundedRect(-w / 2, -h / 2, w, h, 12);
  if (me) g.lineStyle(3, GOLD, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
  else if (e.position === 1) g.lineStyle(2, GOLD, 0.8).strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
  c.add(g);
  // posición (medalla para los tramos con premio)
  const px = -w / 2 + 34;
  if (medal) {
    const mg = scene.add.graphics({ x: px, y: 0 });
    mg.fillStyle(0x0a1638, 1).fillCircle(0, 0, 19);
    mg.fillStyle(medal, 1).fillCircle(0, 0, 16);
    c.add(mg);
  }
  c.add(scene.add.text(px, 0, `${e.position}`, { fontFamily: FONT, fontSize: e.position >= 100 ? '15px' : '19px', color: medal ? '#0a1638' : '#9fb4e0' }).setOrigin(0.5));
  // avatar
  const ax = px + 46;
  const av = scene.add.graphics({ x: ax, y: 0 });
  av.fillStyle(0x0a1638, 1).fillCircle(0, 0, 20);
  av.fillStyle(e.avatar.color, 1).fillCircle(0, 0, 17);
  av.fillStyle(0x0a1638, 0.85).fillCircle(0, -4, 6.5);
  av.fillRoundedRect(-10, 4, 20, 9, { tl: 8, tr: 8, bl: 2, br: 2 });
  c.add(av);
  // nombre y nivel
  const nameX = ax + 30;
  const nm = scene.add.text(nameX, -9, me ? `${e.name} (TÚ)` : e.name, { fontFamily: FONT, fontSize: '20px', color: me ? '#ffd23f' : '#ffffff' }).setOrigin(0, 0.5);
  fitText(nm, w * 0.42);
  c.add(nm);
  c.add(scene.add.text(nameX, 13, `NV ${e.level} · ${e.wins}V ${e.losses}D`, { fontFamily: FONT, fontSize: '13px', color: '#9fb4e0' }).setOrigin(0, 0.5));
  // monedas
  const ct = scene.add.text(w / 2 - 14, 0, fmtNet(e.coins), { fontFamily: FONT, fontSize: '21px', color: e.coins < 0 ? '#ff8174' : '#ffd23f' }).setOrigin(1, 0.5);
  c.add(ct);
  const ci = scene.add.graphics({ x: w / 2 - 18 - ct.width - 10, y: 0 });
  drawCoinIcon(ci, 10);
  c.add(ci);
  return c;
}
