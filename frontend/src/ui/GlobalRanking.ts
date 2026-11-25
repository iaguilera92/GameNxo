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
function openGlobalRankingPlain(scene: Phaser.Scene) {
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

// ============================================================================================================================
// (21-11-2026, mockup del usuario en _temp/ranking/ranking-mockup.png) RANKING GLOBAL CON IMÁGENES (assets/ranking/): título, marco
// (9-slice: se estira a lo alto sin deformar las esquinas), placa "TU PUESTO" y un fondo de fila por tipo (oro/plata/bronce/normal/TÚ).
// Las imágenes van sueltas con margen transparente (sin rayas al escalar). Los textos y cifras se escriben encima. Medidas en px de cada
// imagen. Si falta alguna imagen, se abre el diálogo dibujado de antes (openGlobalRankingPlain).
// ============================================================================================================================

const RK_ART = {
  title: { key: 'rk-title', file: 'assets/ranking/ranking-global-titulo.webp' },
  frame: { key: 'rk-frame', file: 'assets/ranking/marco-ranking.webp' },
  plate: { key: 'rk-plate', file: 'assets/ranking/placa-puesto.webp' },
  gold: { key: 'rk-row-gold', file: 'assets/ranking/fila-oro.webp' },
  silver: { key: 'rk-row-silver', file: 'assets/ranking/fila-plata.webp' },
  bronze: { key: 'rk-row-bronze', file: 'assets/ranking/fila-bronce.webp' },
  normal: { key: 'rk-row-normal', file: 'assets/ranking/fila-normal.webp' },
  me: { key: 'rk-row-me', file: 'assets/ranking/fila-tu.webp' },
} as const;

/** Fondo de fila: dónde empieza el archivo en la hoja original (ox, oy), el CUERPO de la fila, el centro de la medalla (si tiene) y el recuadro de la moneda. Todo en px de la hoja (ranking-filas.png). */
type RowArt = { key: string; ox: number; oy: number; body: readonly [number, number, number, number]; medal: readonly [number, number] | null; box: readonly [number, number, number, number] };
const ROW_ART: Record<'gold' | 'silver' | 'bronze' | 'normal' | 'me', RowArt> = {
  gold: { key: RK_ART.gold.key, ox: 26, oy: 143, body: [35, 175, 990, 305], medal: [137, 240], box: [740, 200, 970, 282] },
  silver: { key: RK_ART.silver.key, ox: 26, oy: 419, body: [35, 428, 990, 558], medal: [137, 490], box: [740, 452, 970, 535] },
  bronze: { key: RK_ART.bronze.key, ox: 26, oy: 653, body: [35, 662, 990, 797], medal: [137, 728], box: [740, 688, 970, 770] },
  normal: { key: RK_ART.normal.key, ox: 25, oy: 915, body: [33, 922, 990, 1045], medal: null, box: [738, 945, 972, 1028] },
  me: { key: RK_ART.me.key, ox: 10, oy: 1153, body: [20, 1168, 1005, 1313], medal: null, box: [738, 1200, 962, 1283] },
};
/** Alto de fila (pantalla) para un ancho de fila `rw`: el del cuerpo de la fila normal. */
const rowHFor = (rw: number) => ((ROW_ART.normal.body[3] - ROW_ART.normal.body[1]) * rw) / (ROW_ART.normal.body[2] - ROW_ART.normal.body[0]);

/** Fila del ranking con su imagen de fondo, centrada en (0,0) (ancho `rw`). */
function globalRowArt(scene: Phaser.Scene, e: BoardEntry, rw: number) {
  const c = scene.add.container(0, 0);
  const me = e.id === 'me';
  const A = me ? ROW_ART.me : e.position === 1 ? ROW_ART.gold : e.position === 2 ? ROW_ART.silver : e.position === 3 ? ROW_ART.bronze : ROW_ART.normal;
  const [bx0, by0, bx1, by1] = A.body;
  const s = rw / (bx1 - bx0);
  const bcy = (by0 + by1) / 2;
  const X = (px: number) => -rw / 2 + (px - bx0) * s;
  const Y = (py: number) => (py - bcy) * s;
  const src = scene.textures.get(A.key).getSourceImage() as { width: number; height: number };
  c.add(scene.add.image(X(A.ox), Y(A.oy), A.key).setOrigin(0, 0).setDisplaySize(src.width * s, src.height * s));
  const bh = (by1 - by0) * s;
  // puesto: en la medalla (top 3) o en la columna del número
  const medalCol = ['#fff4b0', '#ffffff', '#ffd9b0'][e.position - 1] ?? '#ffffff';
  const px = A.medal ? X(A.medal[0]) : X(115);
  const py = A.medal ? Y(A.medal[1]) + 2 : 0;
  const pos = scene.add.text(px, py, `${e.position}`, { fontFamily: FONT, fontSize: A.medal ? '30px' : e.position >= 100 ? '20px' : '24px', color: A.medal ? medalCol : me ? '#ffffff' : '#c9d6f5', stroke: '#0a1638', strokeThickness: 5 }).setOrigin(0.5);
  fitText(pos, 110 * s);
  // avatar dibujado (círculo del color del jugador con silueta)
  const ax = X(250);
  const r = bh * 0.3;
  const g = scene.add.graphics();
  g.fillStyle(0x0a1638, 1).fillCircle(ax, 0, r + 4);
  g.fillStyle(me ? GOLD : 0x2a4a8a, 1).fillCircle(ax, 0, r + 2);
  g.fillStyle(e.avatar.color, 1).fillCircle(ax, 0, r - 1);
  g.fillStyle(0x0a1638, 0.85).fillCircle(ax, -r * 0.2, r * 0.32).fillRoundedRect(ax - r * 0.5, r * 0.18, r, r * 0.45, { tl: r * 0.4, tr: r * 0.4, bl: 2, br: 2 });
  // nombre y nivel (hasta antes del recuadro de la moneda)
  const nx = X(320);
  const maxW = X(A.box[0]) - nx - 10;
  const nm = scene.add.text(nx, -bh * 0.17, me ? `${e.name} (TÚ)` : e.name, { fontFamily: FONT, fontSize: '23px', color: me ? '#ffe066' : '#ffffff', stroke: '#0a1638', strokeThickness: 4 }).setOrigin(0, 0.5);
  fitText(nm, maxW);
  const lv = scene.add.text(nx, bh * 0.23, `NV ${e.level} · ${fmtCoins(e.wins)} VICTORIAS`, { fontFamily: FONT, fontSize: '14px', color: '#dbe5ff', stroke: '#0a1638', strokeThickness: 3 }).setOrigin(0, 0.5);
  fitText(lv, maxW);
  // monedas centradas en el recuadro oscuro
  const boxCx = X((A.box[0] + A.box[2]) / 2);
  const boxW = (A.box[2] - A.box[0]) * s;
  const boxCy = Y((A.box[1] + A.box[3]) / 2);
  const ct = scene.add.text(0, boxCy, fmtCoins(e.coins), { fontFamily: FONT, fontSize: '25px', color: '#ffd23f', stroke: '#2a1500', strokeThickness: 4 }).setOrigin(0, 0.5);
  fitText(ct, boxW - 44, 0.6);
  const grp = 24 + 6 + ct.displayWidth;
  const ci = coinIcon(scene, boxCx - grp / 2 + 12, boxCy, 12); // (17-11-2026) moneda: imagen moneda-1.webp
  ct.setX(boxCx - grp / 2 + 30);
  c.add([g, pos, nm, lv, ci, ct]);
  return c;
}

/**
 * Ventana del RANKING GLOBAL (encima de todo; se cierra con CERRAR o tocando fuera). Top 100 por saldo de monedas, con bots
 * para que no se vea vacía (16-11-2026) y los jugadores reales SIEMPRE visibles: la lista se desplaza (arrastrar o rueda), abre
 * centrada en ti y tu fila queda fija abajo. (21-11-2026) Con las imágenes de assets/ranking/; las carga la primera vez que se abre.
 */
export function openGlobalRanking(scene: Phaser.Scene) {
  const missing = Object.values(RK_ART).filter((a) => !scene.textures.exists(a.key));
  if (!missing.length) return openGlobalRankingArt(scene);
  missing.forEach((a) => scene.load.image(a.key, a.file));
  scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
    if (!scene.sys.isActive()) return;
    if (Object.values(RK_ART).every((a) => scene.textures.exists(a.key))) openGlobalRankingArt(scene);
    else openGlobalRankingPlain(scene);
  });
  scene.load.start();
  return null;
}

function openGlobalRankingArt(scene: Phaser.Scene) {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const v = rankedView();
  const board = v.globalBoard;
  const meEntry = board.find((e) => e.id === 'me');
  const root = scene.add.container(0, 0).setDepth(9000);
  const dim = scene.add.rectangle(0, 0, W, H, 0x000000, 0.78).setOrigin(0).setInteractive();
  root.add(dim);

  // título (recorte de su dibujo: x 45..1727, y 104..782 de 1774x887): sobresale por arriba del marco
  const TB = [45, 104, 1727, 782] as const;
  const pw = Math.min(660, W - 28);
  const titleW = pw * 0.94;
  const ts = titleW / (TB[2] - TB[0]);
  const titleH = (TB[3] - TB[1]) * ts;
  const titleOver = titleH * 0.55; // cuánto del título queda por encima del marco
  const fh = Math.min(1180, H - 30 - titleOver);
  const T = (H - fh - titleOver) / 2 + titleOver; // borde de arriba del marco
  const B = T + fh;
  const L = W / 2 - pw / 2;
  // marco 9-slice (archivo 968x1164): esquinas/bordes de 70 px a los lados, 150 arriba y 90 abajo, escalados a `k`
  const k = pw / 968;
  const frame = scene.add.nineslice(W / 2, T + fh / 2, RK_ART.frame.key, undefined, 968, fh / k, 70, 70, 150, 90).setScale(k);
  const block = scene.add.zone(W / 2, (T + B) / 2, pw, fh).setInteractive(); // tocar el panel no cierra
  root.add([frame, block]);
  // zona interior (oscura) del marco: x 36..931, y 147.. y hasta 84 px del borde de abajo (px del archivo)
  const inL = L + 36 * k;
  const inR = L + 931 * k;
  const inT = T + 147 * k;
  const inB = B - 84 * k;
  const titleTop = T - titleOver;
  // (25-11-2026) TB y ts en px del original (1774): la escala se corrige si el archivo está achicado
  const tk = 1774 / (scene.textures.get(RK_ART.title.key).getSourceImage() as { width: number }).width;
  const titleImg = scene.add.image(W / 2 - titleW / 2 - TB[0] * ts, titleTop - TB[1] * ts, RK_ART.title.key).setOrigin(0, 0).setScale(ts * tk);
  root.add(titleImg);
  // subtítulo y placa TU PUESTO, bajo el título
  const subY = titleTop + titleH + 14;
  const sub = scene.add.text(W / 2, subY, 'Las monedas de cada jugador · nunca se reinicia', { fontFamily: FONT, fontSize: '17px', color: '#dbe5ff', stroke: '#0a1638', strokeThickness: 3 }).setOrigin(0.5);
  fitText(sub, pw - 80);
  const plateW = Math.min(400, pw * 0.62);
  const plSrc = scene.textures.get(RK_ART.plate.key).getSourceImage() as { width: number; height: number };
  const plateH = (plateW * plSrc.height) / plSrc.width;
  const plateY = subY + 16 + plateH / 2;
  const plate = scene.add.image(W / 2, plateY, RK_ART.plate.key).setDisplaySize(plateW, plateH);
  const mine = scene.add.text(W / 2, plateY, meEntry ? `TU PUESTO: #${meEntry.position}` : 'SIN PUESTO', { fontFamily: FONT, fontSize: '22px', color: '#ffe066', stroke: '#2a1500', strokeThickness: 4 }).setOrigin(0.5).setLetterSpacing(1);
  fitText(mine, plateW * 0.78);
  root.add([sub, plate, mine]);

  // lista con desplazamiento (máscara) y tu fila fija abajo, dentro de la zona interior
  const rw = inR - inL - 24;
  const rowH = rowHFor(rw);
  const step = rowH + 8;
  const btnH = 64;
  const btnY = inB - 16 - btnH / 2;
  // (21-11-2026, usuario) el TOP 3 siempre a la vista: fijo arriba; la lista que se desplaza empieza en el 4.º. Tu fila fija abajo
  // solo si no estás en el top 3 (si lo estás, ya se ve arriba)
  const top3 = board.slice(0, 3);
  const rest = board.slice(3);
  const pinMe = !!meEntry && meEntry.position > 3;
  const pinnedY = pinMe ? btnY - btnH / 2 - 16 - rowH / 2 : btnY;
  const top3Top = Math.max(inT + 8, plateY + plateH / 2 + 14);
  top3.forEach((e, i) => {
    const row = globalRowArt(scene, e, rw);
    row.setPosition(W / 2, top3Top + i * step + step / 2);
    root.add(row);
  });
  const sepTop = scene.add.graphics();
  sepTop.fillStyle(GOLD, 0.45).fillRect(W / 2 - rw / 2, top3Top + top3.length * step + 3, rw, 2);
  root.add(sepTop);
  const listTop = top3Top + top3.length * step + 10;
  const listBottom = pinMe ? pinnedY - rowH / 2 - 16 : btnY - btnH / 2 - 16;
  const list = scene.add.container(W / 2, listTop);
  rest.forEach((e, i) => {
    const row = globalRowArt(scene, e, rw);
    row.setPosition(0, i * step + step / 2);
    list.add(row);
  });
  const maskG = scene.make.graphics({}, false);
  maskG.fillRect(inL, listTop, inR - inL, listBottom - listTop);
  list.setMask(maskG.createGeometryMask());
  root.add(list);
  const maxScroll = Math.max(0, rest.length * step - (listBottom - listTop));
  let scroll = 0;
  const setScroll = (sv: number) => {
    scroll = Phaser.Math.Clamp(sv, 0, maxScroll);
    list.y = listTop - scroll;
  };
  if (pinMe && meEntry) setScroll(rest.indexOf(meEntry) * step - (listBottom - listTop) / 2 + step / 2);
  const zone = scene.add.zone(W / 2, (listTop + listBottom) / 2, inR - inL, listBottom - listTop).setInteractive();
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
  if (pinMe && meEntry) {
    const sep = scene.add.graphics();
    sep.fillStyle(GOLD, 0.45).fillRect(W / 2 - rw / 2, listBottom + 8, rw, 2);
    const pinned = globalRowArt(scene, meEntry, rw);
    pinned.setPosition(W / 2, pinnedY);
    root.add([sep, pinned]);
  }

  const close = () => {
    scene.input.off('pointermove', move);
    scene.input.off('pointerup', up);
    maskG.destroy();
    root.destroy();
  };
  root.add(arcadeButton(scene, W / 2, btnY, Math.min(320, pw - 80), btnH, 'CERRAR', close, { palette: 'yellow' }));
  dim.once('pointerup', close);
  root.setAlpha(0);
  scene.tweens.add({ targets: root, alpha: 1, duration: 180 });
  return root;
}