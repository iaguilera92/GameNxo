import Phaser from 'phaser';
import { installTapSound } from '../fx/uiSound';
import { FONT, restartOnResize } from '../ui/theme';
import { stadiumBg } from '../ui/ui';
import { arcadeButton } from '../ui/modeButtons';
import { RankBadge, preloadRankBadges } from '../ui/RankBadge';
import { fmtCoins } from '../ui/leagueStyle';
import { rankDef } from '../domain/ranks';
import { getPlayer } from '../domain/playerStore';
import { gameClock } from '../domain/timeSource';
import { ME_2V2, board2v2, rank2v2, type Entry2v2 } from '../domain/league2v2';
import { serverUrl } from '../net/config';

const NAVY = 0x0b1733;
const PURPLE = 0x7f4bff;
/** filas de la tabla visibles (el TOP); si no estás entre ellas, tu fila va al final */
const TOP_ROWS = 10;

/**
 * LIGA 2v2 (19-11-2026): ranking del 2v2 por MONEDAS 2v2 (domain/league2v2.ts). Rango 2v2 (insignia), tu total con la barra hasta el
 * siguiente rango, el TOP de la tabla (jugadores simulados hasta que haya cuentas en el servidor) con tu fila y el botón JUGAR 2v2.
 * Se abre desde LIGA (botón "LIGA 2v2") y vuelve a LIGA.
 */
export class Liga2v2Scene extends Phaser.Scene {
  constructor() {
    super('Liga2v2');
  }

  preload() {
    preloadRankBadges(this.load);
    if (!this.textures.exists('liga-2v2-title')) this.load.image('liga-2v2-title', 'assets/liga-2v2-titulo.webp');
  }

  create() {
    restartOnResize(this);
    installTapSound(this);
    this.cameras.main.fadeIn(200, 0, 0, 0);
    const W = this.scale.width;
    const H = this.scale.height;
    stadiumBg(this, 0.62);
    const s = getPlayer();
    const total = Math.max(0, s.coins2v2 ?? 0);
    const rk = rank2v2(total);
    const board = board2v2(s, gameClock.now());
    const me = board.find((e) => e.id === ME_2V2)!;

    // ---- cabecera: volver + título en imagen
    const headY = 60;
    this.backButton(50, headY);
    if (this.textures.exists('liga-2v2-title')) {
      const tw = Math.min(300, Math.max(170, W - 220));
      this.add.image(W / 2, headY - 1, 'liga-2v2-title').setDisplaySize(tw, tw / 3);
    } else this.add.text(W / 2, headY + 2, 'LIGA 2v2', { fontFamily: FONT, fontSize: '48px', color: '#ffd23f', stroke: '#0a1638', strokeThickness: 9 }).setOrigin(0.5);

    // ---- rango 2v2 + total
    const ex = Phaser.Math.Clamp(H - 1280, 0, 300);
    let y = 190 + ex * 0.1;
    new RankBadge(this, W / 2, y, { rank: rk.id, level: 99, size: 150, position: rk.id === 'challenger' ? me.position : undefined });
    y += 98;
    this.add.text(W / 2, y, `RANGO 2v2 · ${rankDef(rk.id).name.toUpperCase()}`, { fontFamily: FONT, fontSize: '22px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 5 }).setOrigin(0.5).setLetterSpacing(1);
    y += 46;
    this.coin2v2(W / 2 - 74, y, 22);
    this.add.text(W / 2 - 44, y, fmtCoins(total), { fontFamily: FONT, fontSize: '44px', color: '#ffd23f', stroke: '#0a1638', strokeThickness: 8 }).setOrigin(0, 0.5);
    y += 40;
    // barra hasta el siguiente rango
    const bw = Math.min(520, W - 80);
    const bh = 26;
    const g = this.add.graphics();
    g.fillStyle(NAVY, 0.95).fillRoundedRect(W / 2 - bw / 2 - 4, y - 4, bw + 8, bh + 8, (bh + 8) / 2);
    g.fillStyle(0x1b2a4e, 1).fillRoundedRect(W / 2 - bw / 2, y, bw, bh, bh / 2);
    const frac = rk.next ? Phaser.Math.Clamp((total - rk.from) / (rk.next.from - rk.from), 0, 1) : 1;
    if (frac > 0.02) g.fillStyle(PURPLE, 1).fillRoundedRect(W / 2 - bw / 2, y, Math.max(bh, bw * frac), bh, bh / 2);
    g.fillStyle(0xffffff, 0.16).fillRoundedRect(W / 2 - bw / 2 + 5, y + 3, bw - 10, bh * 0.36, 6);
    const nextTxt = rk.next ? `${fmtCoins(rk.next.from - total)} para ${rankDef(rk.next.id).name.toUpperCase()}` : 'RANGO MÁXIMO';
    this.add.text(W / 2, y + bh / 2, nextTxt, { fontFamily: FONT, fontSize: '16px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 4 }).setOrigin(0.5);
    y += bh + 16;
    this.add
      .text(W / 2, y, 'Ganar +30 · Perder −15 · Rendirse −30', { fontFamily: FONT, fontSize: '15px', color: '#b9a8ff' })
      .setOrigin(0.5)
      .setLetterSpacing(1);
    y += 34;

    // ---- tabla
    const playH = 120;
    const tableBottom = H - playH - 20;
    const tw = Math.min(620, W - 36);
    const rowsShown = board.slice(0, TOP_ROWS);
    const extraMe = me.position > TOP_ROWS;
    const rowH = Math.max(40, Math.min(56, (tableBottom - y - 54 - (extraMe ? 18 : 0)) / (TOP_ROWS + (extraMe ? 1 : 0))));
    const tg = this.add.graphics();
    const th = 46 + rowH * (rowsShown.length + (extraMe ? 1 : 0)) + (extraMe ? 18 : 0) + 10;
    tg.fillStyle(0x000000, 0.4).fillRoundedRect(W / 2 - tw / 2 + 4, y + 6, tw, th, 20);
    tg.fillStyle(NAVY, 0.96).fillRoundedRect(W / 2 - tw / 2, y, tw, th, 20);
    tg.lineStyle(3, PURPLE, 1).strokeRoundedRect(W / 2 - tw / 2, y, tw, th, 20);
    this.add.text(W / 2 - tw / 2 + 22, y + 24, `TOP ${TOP_ROWS}`, { fontFamily: FONT, fontSize: '20px', color: '#ffd23f' }).setOrigin(0, 0.5).setLetterSpacing(2);
    this.add.text(W / 2 + tw / 2 - 22, y + 24, 'MONEDAS 2v2', { fontFamily: FONT, fontSize: '15px', color: '#b9a8ff' }).setOrigin(1, 0.5).setLetterSpacing(1);
    let ry = y + 46;
    for (const e of rowsShown) {
      this.row(W / 2, ry, tw - 20, rowH, e);
      ry += rowH;
    }
    if (extraMe) {
      this.add.text(W / 2, ry + 6, '· · ·', { fontFamily: FONT, fontSize: '18px', color: '#7f93bf' }).setOrigin(0.5);
      ry += 18;
      this.row(W / 2, ry, tw - 20, rowH, me);
    }
    this.add.text(W / 2, Math.min(tableBottom - 6, y + th + 16), 'Jugadores de práctica hasta que llegue el ranking online', { fontFamily: FONT, fontSize: '13px', color: '#8a9cc4' }).setOrigin(0.5);

    // ---- JUGAR 2v2 (igual que el botón 2v2 del menú)
    arcadeButton(this, W / 2, H - playH / 2 - 14, Math.min(420, W - 80), 96, 'JUGAR 2v2', () => this.play2v2(), { palette: 'green' });
  }

  /** Fila de la tabla: posición, avatar, nombre y total (la tuya resaltada). */
  private row(cx: number, y: number, w: number, h: number, e: Entry2v2) {
    const mine = !e.bot;
    const g = this.add.graphics();
    if (mine) {
      g.fillStyle(PURPLE, 0.32).fillRoundedRect(cx - w / 2, y + 2, w, h - 4, 12);
      g.lineStyle(2, 0xffd23f, 1).strokeRoundedRect(cx - w / 2, y + 2, w, h - 4, 12);
    } else if (e.position % 2 === 0) g.fillStyle(0xffffff, 0.04).fillRoundedRect(cx - w / 2, y + 2, w, h - 4, 12);
    const top3 = [0xffd23f, 0xd9e2f2, 0xd88a4a][e.position - 1];
    const x0 = cx - w / 2;
    const fs = Math.round(Math.min(22, h * 0.44));
    this.add.text(x0 + 30, y + h / 2, String(e.position), { fontFamily: FONT, fontSize: `${fs}px`, color: top3 ? '#' + top3.toString(16).padStart(6, '0') : '#cfe0ff' }).setOrigin(0.5);
    g.fillStyle(0x0a1638, 1).fillCircle(x0 + 72, y + h / 2, h * 0.34);
    g.fillStyle(e.avatar.color, 1).fillCircle(x0 + 72, y + h / 2, h * 0.28);
    this.add.text(x0 + 72, y + h / 2, e.avatar.skin === 'mai' ? 'M' : 'N', { fontFamily: FONT, fontSize: `${Math.round(h * 0.3)}px`, color: '#0a1638' }).setOrigin(0.5);
    const name = this.add.text(x0 + 104, y + h / 2, mine ? `${e.name} (TÚ)` : e.name, { fontFamily: FONT, fontSize: `${fs}px`, color: mine ? '#ffd23f' : '#ffffff' }).setOrigin(0, 0.5);
    if (name.width > w * 0.5) name.setScale((w * 0.5) / name.width);
    this.add.text(cx + w / 2 - 50, y + h / 2, fmtCoins(e.total), { fontFamily: FONT, fontSize: `${fs}px`, color: '#ffd23f' }).setOrigin(1, 0.5);
    this.coin2v2(cx + w / 2 - 26, y + h / 2, Math.min(13, h * 0.26));
  }

  /** Moneda 2v2 dibujada (disco morado con borde dorado y "2v2"), como en la pantalla de resultados. */
  private coin2v2(x: number, y: number, r: number) {
    const g = this.add.graphics();
    g.fillStyle(0x2a1458, 1).fillCircle(x, y, r + 3);
    g.fillStyle(PURPLE, 1).fillCircle(x, y, r);
    g.fillStyle(0xffffff, 0.25).fillEllipse(x, y - r * 0.4, r * 1.4, r * 0.5);
    g.lineStyle(Math.max(2, r * 0.15), 0xffd23f, 1).strokeCircle(x, y, r);
    if (r >= 14) this.add.text(x, y + 1, '2v2', { fontFamily: FONT, fontSize: `${Math.round(r * 0.75)}px`, color: '#ffffff', stroke: '#2a1458', strokeThickness: 3 }).setOrigin(0.5);
  }

  private backButton(x: number, y: number) {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(NAVY, 0.94).fillRoundedRect(-30, -30, 60, 60, 16);
    g.lineStyle(3, PURPLE, 1).strokeRoundedRect(-30, -30, 60, 60, 16);
    g.lineStyle(6, 0xffffff, 1).beginPath().moveTo(6, -13).lineTo(-8, 0).lineTo(6, 13).strokePath();
    c.add(g);
    c.setSize(64, 64).setInteractive({ useHandCursor: true });
    c.on('pointerup', () => this.go('Ranked'));
  }

  private play2v2() {
    const fb = { unranked: false, from: 'Menu', mode: '2v2' };
    this.cameras.main.fadeOut(180, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => (serverUrl() !== null ? this.scene.start('LanSearch', { mode: '2v2', fallback: fb }) : this.scene.start('Matchmaking', fb)));
  }

  private go(key: string) {
    this.cameras.main.fadeOut(180, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(key));
  }
}
