import Phaser from 'phaser';
import { FONT, restartOnResize } from '../ui/theme';
import { stadiumBg } from '../ui/ui';
import { arcadeButton } from '../ui/modeButtons';
import { fitText } from '../ui/fitText';
import { RankBadge, preloadRankBadges } from '../ui/RankBadge';
import { drawChestIcon, drawCoinIcon, drawGiftIcon } from '../ui/wheelArt';
import { drawCashIcon } from './BattlePassScene';
import { LEAGUE_STYLE, fmtCoins, fmtLeft } from '../ui/leagueStyle';
import { RANKS, type RankId, rankDef } from '../domain/ranks';
import { RANKED } from '../domain/rankedConfig';
import type { BoardEntry } from '../domain/rankedBots';
import type { RankedView } from '../domain/ranked';
import type { WeeklyReward } from '../domain/rankedState';
import { onPlayerChange } from '../domain/playerStore';
import { claimWeekly, leagueLeaders, markRankedSeen, pendingWeekly, rankedState, rankedView, syncRanked } from '../logic/Ranked';

const NAVY = 0x0b1733;
const NEON = 0x3a7bff;
const GOLD = 0xffc42e;
const NAV = {
  key: 'nav-ranking',
  file: 'assets/barra-ranking.png',
  w: 2172,
  h: 724,
  box: { x0: 46, y0: 170, x1: 2124, y1: 540 },
  split: [0.33, 0.67] as [number, number],
  side: 6,
  bottom: 26,
};

/**
 * Pantalla principal de RANKED: liga y emblema, saldo y progreso al ascenso, posición, partidas de la
 * semana (x/3), récord, racha, tiempo restante, recompensa estimada y la
 * tabla Top 100. Al entrar muestra (una vez) el ascenso, el descenso mensual y las recompensas semanales.
 */
export class RankedScene extends Phaser.Scene {
  private overlay: Phaser.GameObjects.GameObject[] = [];
  private toastMsg?: string;
  private scrollY = 0;
  private maxScrollY = 0;
  private dragY: number | null = null;
  private dragScrollY = 0;
  private dragging = false;
  private overlayReturnScroll = 0;

  constructor() {
    super('Ranked');
  }

  init(data?: { toast?: string }) {
    this.toastMsg = data?.toast;
  }

  preload() {
    if (!this.textures.exists('menu-bg')) this.load.image('menu-bg', 'assets/menu-bg.webp');
    if (!this.textures.exists(NAV.key)) this.load.image(NAV.key, NAV.file);
    if (!this.textures.exists('ranked-title')) this.load.image('ranked-title', 'assets/ranked-titulo.png');
    preloadRankBadges(this.load); // todas: tabla de líderes y lista de ligas
  }

  create() {
    restartOnResize(this);
    this.cameras.main.fadeIn(200, 0, 0, 0);
    syncRanked();
    this.overlay = [];
    this.build();
    this.setupScroll();
    const off = onPlayerChange(() => this.time.delayedCall(0, () => this.overlay.length === 0 && this.scene.isActive() && this.rebuild()));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
    // contador de la temporada
    this.time.addEvent({ delay: 30_000, loop: true, callback: () => this.overlay.length === 0 && this.rebuild() });
    this.time.delayedCall(350, () => this.presentQueue());
    if (this.toastMsg) this.toast(this.toastMsg);
  }

  private rebuild() {
    this.children.list.filter((o) => !this.overlay.includes(o)).forEach((o) => o.destroy());
    this.build();
  }

  // ================================================================ hub
  private build() {
    const W = this.scale.width;
    const H = this.scale.height;
    const v = rankedView();
    const st = LEAGUE_STYLE[v.league];
    const bgStart = this.children.list.length;
    stadiumBg(this, 0.62);
    this.children.list.slice(bgStart).forEach((o) => (o as Phaser.GameObjects.GameObject & { setScrollFactor(x: number, y?: number): unknown }).setScrollFactor(0));
    // pantallas más altas que 1280: el espacio extra se reparte entre los bloques (JUGAR queda abajo)
    const ex = Phaser.Math.Clamp(H - 1280, 0, 360);
    const e1 = ex * 0.12;
    const e2 = ex * 0.25;
    // resplandor del color de la liga detrás del emblema

    // ---- cabecera
    const headY = 60;
    const headerStart = this.children.list.length;
    this.backButton(50, headY);
    // ranked-titulo.png incluye márgenes transparentes amplios: darle más ancho hace visible el arte
    // sin cambiar la proporción ni depender de una variante WebP inexistente.
    const titleW = Math.min(370, Math.max(220, W - 360));
    this.add.image(W / 2, headY + 3, 'ranked-title').setDisplaySize(titleW, titleW / 3);
    this.coinPill(W - 24, headY, v.coins);
    const headerObjects = this.children.list.slice(headerStart);
    this.add.container(0, 0, headerObjects).setScrollFactor(0);
    const contentStart = this.children.list.length;

    // ---- emblema + liga
    new RankBadge(this, W / 2, 182 + e1, { rank: v.league, level: 99, size: 168, position: v.league === 'challenger' ? (v.position ?? undefined) : undefined, onOpen: () => this.leagueList() });
    this.add.text(W / 2, 280 + e1, rankDef(v.league).name.toUpperCase(), { fontFamily: FONT, fontSize: '34px', color: st.css, stroke: '#0a1638', strokeThickness: 6 }).setOrigin(0.5).setLetterSpacing(3);
    this.add.text(W / 2, 310 + e1, `LA SEMANA TERMINA EL DOMINGO · QUEDAN ${fmtLeft(v.msLeft)}`, { fontFamily: FONT, fontSize: '16px', color: '#9fb4e0' }).setOrigin(0.5).setLetterSpacing(1);

    // ---- oro centrado y progreso debajo, como en el diseño anterior
    const gy = 388 + e1;
    const goldTxt = this.add.text(0, gy, fmtCoins(v.coins), { fontFamily: FONT, fontSize: '58px', color: '#ffd23f', stroke: '#0a1638', strokeThickness: 8 }).setOrigin(0, 0.5);
    const coinR = 22;
    const total = coinR * 2 + 12 + goldTxt.width;
    const gx0 = W / 2 - total / 2;
    const coinG = this.add.graphics({ x: gx0 + coinR, y: gy });
    drawCoinIcon(coinG, coinR);
    goldTxt.setX(gx0 + coinR * 2 + 12);
    this.add.text(W / 2, gy - 41, 'TU ORO', { fontFamily: FONT, fontSize: '15px', color: '#c9b98a' }).setOrigin(0.5).setLetterSpacing(3);

    const bw = Math.min(600, W - 60);
    const by = 444 + e1;
    const g = this.add.graphics();
    g.fillStyle(0x0a1638, 1).fillRoundedRect(W / 2 - bw / 2 - 4, by - 17, bw + 8, 34, 17);
    g.fillStyle(0x1a2a52, 1).fillRoundedRect(W / 2 - bw / 2, by - 13, bw, 26, 13);
    const fillW = Math.max(26, bw * v.progress);
    g.fillStyle(st.color, 1).fillRoundedRect(W / 2 - bw / 2, by - 13, fillW, 26, 13);
    g.fillStyle(0xffffff, 0.28).fillRoundedRect(W / 2 - bw / 2 + 6, by - 10, Math.max(0, fillW - 12), 7, 4);
    const progTxt = v.target == null ? 'LIGA MÁXIMA · DEFIENDE TU PUESTO' : `${Math.floor(v.progress * 100)}% · META ${fmtCoins(v.target)}`;
    this.add.text(W / 2, by, progTxt, { fontFamily: FONT, fontSize: '17px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 4 }).setOrigin(0.5);
    if (v.next && v.target != null) {
      const left = Math.max(0, v.target - v.coins);
      const nx = rankDef(v.next);
      this.add
        .text(W / 2, by + 34, left > 0 ? `FALTAN ${fmtCoins(left)} PARA ${nx.name.toUpperCase()}` : `¡JUEGA UNA PARTIDA PARA SUBIR A ${nx.name.toUpperCase()}!`, { fontFamily: FONT, fontSize: '17px', color: left > 0 ? '#9fb4e0' : '#ffd23f' })
        .setOrigin(0.5);
    }

    // ---- estadísticas: 4 cuadros con icono, cifra grande y etiqueta
    const sy = 546 + e2;
    const tw = (Math.min(640, W - 60) - 3 * 10) / 4;
    const topPos = v.position != null && v.position <= 10;
    const weekDone = v.weekMatches >= v.minMatches;
    const tiles: { label: string; value: string; sub: string; accent: number; icon: StatIcon; hot: boolean }[] = [
      { label: 'POSICIÓN', value: v.position ? `#${v.position}` : '—', sub: v.position && v.position <= 50 ? (v.position === 1 ? 'TOP 1' : v.position <= 10 ? 'TOP 10' : 'TOP 50') : `DE ${v.board.length}`, accent: topPos ? GOLD : 0x3a7bff, icon: 'trophy', hot: topPos },
      { label: 'SEMANA', value: `${Math.min(v.weekMatches, v.minMatches)}/${v.minMatches}`, sub: '', accent: weekDone ? GOLD : 0x62d935, icon: 'calendar', hot: weekDone },
      { label: 'RÉCORD', value: `${v.season.wins}-${v.season.losses}`, sub: `${pct(v.season.wins, v.season.losses)} VICT.`, accent: 0x37e0ff, icon: 'chart', hot: false },
      { label: 'RACHA', value: `${v.season.streak}`, sub: `MEJOR ${v.total.bestStreak}`, accent: 0xff8a3d, icon: 'flame', hot: v.season.streak >= 3 },
    ];
    tiles.forEach((t, i) => {
      const x = W / 2 + (i - 1.5) * (tw + 10);
      const th = 104;
      const top = sy - th / 2;
      const tg = this.add.graphics();
      tg.fillStyle(0x000000, 0.35).fillRoundedRect(x - tw / 2 + 2, top + 5, tw, th, 18);
      tg.fillStyle(NAVY, 0.96).fillRoundedRect(x - tw / 2, top, tw, th, 18);
      tg.fillStyle(t.accent, 0.22).fillRoundedRect(x - tw / 2, top, tw, 40, { tl: 18, tr: 18, bl: 0, br: 0 });
      tg.lineStyle(2.5, t.accent, t.hot ? 1 : 0.75).strokeRoundedRect(x - tw / 2, top, tw, th, 18);
      // icono en un círculo del color del cuadro
      const ic = this.add.graphics({ x, y: top + 22 });
      ic.fillStyle(0x0a1638, 1).fillCircle(0, 0, 17);
      ic.fillStyle(t.accent, 1).fillCircle(0, 0, 14);
      drawStatIcon(ic, t.icon);
      const vt = this.add.text(x, sy + 6, t.value, { fontFamily: FONT, fontSize: '30px', color: t.hot ? '#ffd23f' : '#ffffff', stroke: '#0a1638', strokeThickness: 4 }).setOrigin(0.5);
      fitText(vt, tw - 14);
      this.add.text(x, sy + 32, t.label, { fontFamily: FONT, fontSize: '12px', color: '#7f93bf' }).setOrigin(0.5).setLetterSpacing(1);
      if (t.icon === 'calendar') {
        // contador visual de partidas (puntos)
        for (let k = 0; k < v.minMatches; k++) {
          const dx = x + (k - (v.minMatches - 1) / 2) * 16;
          this.add.circle(dx, sy + 48, 5, k < v.weekMatches ? GOLD : 0x2c4a8a).setStrokeStyle(2, 0x0a1638);
        }
      } else {
        const stt = this.add.text(x, sy + 48, t.sub, { fontFamily: FONT, fontSize: '12px', color: t.hot ? '#ffd23f' : '#9fb4e0' }).setOrigin(0.5);
        fitText(stt, tw - 12);
      }
    });

    // ---- recompensa semanal estimada: cofre + texto + premio
    const ry = 668 + e2;
    const rw = Math.min(640, W - 60);
    const rh = 104;
    const rx0 = W / 2 - rw / 2;
    const elig = v.estimate.eligible;
    const rg = this.add.graphics();
    rg.fillStyle(0x000000, 0.35).fillRoundedRect(rx0 + 3, ry - rh / 2 + 6, rw, rh, 20);
    rg.fillStyle(0x1d1708, 0.96).fillRoundedRect(rx0, ry - rh / 2, rw, rh, 20);
    rg.fillStyle(0x3a2d0c, 0.6).fillRoundedRect(rx0 + 3, ry - rh / 2 + 3, rw - 6, rh * 0.42, { tl: 17, tr: 17, bl: 0, br: 0 });
    rg.lineStyle(3, elig ? GOLD : 0x8a7130, 1).strokeRoundedRect(rx0, ry - rh / 2, rw, rh, 20);
    // Cofre grande a la izquierda, sin medallón para acercarse a la referencia.
    const cx0 = rx0 + 52;
    const chest = this.add.graphics({ x: cx0, y: ry });
    drawChestIcon(chest, 27, 0, 0);
    if (elig) this.tweens.add({ targets: chest, angle: { from: -2, to: 2 }, duration: 220, yoyo: true, repeat: -1, repeatDelay: 1800 });

    const prizeW = v.estimate.cash > 0 ? 240 : 164;
    const prizeX = rx0 + rw - prizeW - 10;
    rg.fillStyle(0x080f27, 0.95).fillRoundedRect(prizeX, ry - 29, prizeW, 58, 18);
    rg.fillStyle(elig ? 0x815309 : 0x48350a, 1).fillRoundedRect(prizeX + 3, ry - 26, prizeW - 6, 52, 15);
    rg.fillStyle(0xffd232, elig ? 0.28 : 0.16).fillRoundedRect(prizeX + 7, ry - 22, prizeW - 14, 19, { tl: 12, tr: 12, bl: 4, br: 4 });
    rg.lineStyle(2.5, elig ? 0xffdf52 : 0xaa8425, 1).strokeRoundedRect(prizeX, ry - 29, prizeW, 58, 18);

    const tx = cx0 + 48;
    const textW = Math.max(80, prizeX - tx - 16);
    const weeklyTitle = this.add.text(tx, ry - 23, `RECOMPENSA SEMANAL (${rankDef(v.league).name.toUpperCase()})`, { fontFamily: FONT, fontSize: '17px', color: '#ffe24a' }).setOrigin(0, 0.5).setLetterSpacing(0.5);
    fitText(weeklyTitle, textW);
    const left = v.minMatches - v.weekMatches;
    const estSub = elig ? `¡Meta completada! · se cobra el domingo${v.estimate.label ? ` · ${v.estimate.label}` : ''}` : `Juega ${left} partida${left === 1 ? '' : 's'} más y se cobra el domingo`;
    const est = this.add.text(tx, ry - 1, estSub, { fontFamily: FONT, fontSize: '14px', color: '#f2e7c1' }).setOrigin(0, 0.5);
    fitText(est, textW);
    // Progreso segmentado: cada segmento representa una partida completada.
    const pbw = Math.min(164, textW - 55);
    const progressCount = `${Math.min(v.weekMatches, v.minMatches)}/${v.minMatches}`;
    const pgY = ry + 28;
    const segments = Math.max(1, v.minMatches);
    const segGap = 5;
    const segW = (pbw - segGap * (segments - 1)) / segments;
    const pg = this.add.graphics();
    for (let i = 0; i < segments; i++) {
      const sx = tx + i * (segW + segGap);
      pg.fillStyle(i < v.weekMatches ? 0x52e432 : 0x39404c, 1).fillRoundedRect(sx, pgY - 7, segW, 14, 7);
      if (i < v.weekMatches) pg.fillStyle(0xb6ff7a, 0.6).fillRoundedRect(sx + 3, pgY - 5, Math.max(0, segW - 6), 4, 2);
    }
    this.add.text(tx + pbw + 10, pgY, progressCount, { fontFamily: FONT, fontSize: '14px', color: '#ffffff' }).setOrigin(0, 0.5);
    this.rewardAmounts(rx0 + rw - 20, ry, v.estimate.coins, v.estimate.cash, v.estimate.rays, !elig);

    // ---- clasificación semanal: podio, puestos siguientes y tabla completa
    const py = 730 + e2;
    const podiumW = Math.min(660, W - 40);
    const podiumPanel = this.add.graphics();
    const leadersH = 302;
    podiumPanel.fillStyle(0x061433, 0.94).fillRoundedRect(W / 2 - podiumW / 2, py + 8, podiumW, leadersH, 24);
    podiumPanel.lineStyle(10, NEON, 0.16).strokeRoundedRect(W / 2 - podiumW / 2, py + 8, podiumW, leadersH, 24);
    podiumPanel.lineStyle(3, 0x1754ad, 0.98).strokeRoundedRect(W / 2 - podiumW / 2, py + 8, podiumW, leadersH, 24);
    const weeklyTag = this.add.graphics();
    const tagW = Math.min(500, W - 56);
    weeklyTag.fillStyle(0x061b42, 1).fillRoundedRect(W / 2 - tagW / 2, py + 8, tagW, 36, 18);
    weeklyTag.lineStyle(2, NEON, 1).strokeRoundedRect(W / 2 - tagW / 2, py + 8, tagW, 36, 18);
    const trophy = this.add.graphics({ x: W / 2 - Math.min(210, tagW * 0.42), y: py + 26 });
    trophy.fillStyle(GOLD, 1);
    drawStatIcon(trophy, 'trophy');
    const classificationTitle = this.add.text(W / 2 + 12, py + 26, 'CLASIFICACIÓN SEMANAL · LÍDERES DE LA LIGA', { fontFamily: FONT, fontSize: '17px', color: '#ffffff' }).setOrigin(0.5).setLetterSpacing(0.3);
    fitText(classificationTitle, tagW - 48);
    const topThree = v.board.slice(0, 3);
    const cardGap = 10;
    const cardW = (podiumW - 36 - cardGap * 2) / 3;
    const cardH = 126;
    const cardY = py + 116;
    const medalColors = [GOLD, 0xc0c8d8, 0xd88a4a];
    topThree.forEach((entry, i) => {
      const x = W / 2 - podiumW / 2 + 18 + cardW / 2 + i * (cardW + cardGap);
      const color = medalColors[i];
      const card = this.add.graphics();
      card.fillStyle(i === 0 ? 0x332500 : 0x0c2046, 0.98).fillRoundedRect(x - cardW / 2, cardY - cardH / 2, cardW, cardH, 18);
      card.lineStyle(3, color, 0.95).strokeRoundedRect(x - cardW / 2, cardY - cardH / 2, cardW, cardH, 18);
      card.fillStyle(color, 0.16).fillRoundedRect(x - cardW / 2 + 3, cardY - cardH / 2 + 3, cardW - 6, 35, { tl: 15, tr: 15, bl: 2, br: 2 });
      const medal = this.add.graphics({ x, y: cardY - cardH / 2 + 16 });
      medal.fillStyle(0x07152f, 1).fillCircle(0, 0, 22);
      medal.fillStyle(color, 1).fillCircle(0, 0, 18);
      this.add.text(x, cardY - cardH / 2 + 16, `${i + 1}`, { fontFamily: FONT, fontSize: '23px', color: '#07152f' }).setOrigin(0.5);
      const nm = this.add.text(x, cardY + 10, entry.name, { fontFamily: FONT, fontSize: '18px', color: '#ffffff' }).setOrigin(0.5);
      fitText(nm, cardW - 12);
      const coins = this.add.text(0, cardY + 42, fmtCoins(entry.coins), { fontFamily: FONT, fontSize: '18px', color: '#ffd23f' }).setOrigin(0, 0.5);
      const coinsW = coins.width + 28;
      const coin = this.add.graphics({ x: x - coinsW / 2 + 12, y: cardY + 42 });
      drawCoinIcon(coin, 10);
      coins.setX(x - coinsW / 2 + 27);
    });
    [3, 4].forEach((i) => {
      const entry = v.board[i];
      if (!entry) return;
      const row = this.add.text(W / 2, py + 197 + (i - 3) * 23, `${i + 1}°  ${entry.name}  ·  ${fmtCoins(entry.coins)}`, { fontFamily: FONT, fontSize: '17px', color: '#dceaff' }).setOrigin(0.5);
      fitText(row, podiumW - 48);
    });
    const top100Y = py + 264;
    arcadeButton(this, W / 2, top100Y, Math.min(480, W - 80), 46, 'VER TOP 100', () => this.leaderboard(), { palette: 'blue' });

    // ---- paneles inferiores: historial y premios por posición
    const panelsTop = py + 328;
    const panelGap = 16;
    const bottomPanelW = (podiumW - panelGap) / 2;
    const panelH = 210;
    const leftPanelX = W / 2 - bottomPanelW / 2 - panelGap / 2;
    const rightPanelX = W / 2 + bottomPanelW / 2 + panelGap / 2;
    this.historyCard(v, leftPanelX, panelsTop, bottomPanelW, panelH);
    this.extraRewardsCard(rightPanelX, panelsTop, bottomPanelW, panelH);

    const contentObjects = this.children.list.slice(contentStart);
    this.add.container(0, 0, contentObjects);
    const contentBottom = panelsTop + panelH;
    const navTop = H - this.navImageHeight(W);
    this.maxScrollY = Math.max(0, contentBottom - navTop + 16);
    this.scrollY = Phaser.Math.Clamp(this.scrollY, 0, this.maxScrollY);
    this.cameras.main.setBounds(0, 0, W, H + this.maxScrollY);
    this.cameras.main.setScroll(0, this.scrollY);
    this.navImage(W, H);
  }

  private setupScroll() {
    const wheel = (pointer: Phaser.Input.Pointer, _objects: Phaser.GameObjects.GameObject[], _dx: number, dy: number) => {
      if (!this.overlay.length && pointer.y < this.scale.height - this.navImageHeight(this.scale.width)) this.setScroll(this.scrollY + dy);
    };
    const down = (pointer: Phaser.Input.Pointer) => {
      if (this.overlay.length || pointer.y >= this.scale.height - this.navImageHeight(this.scale.width)) return;
      const hits = this.input.hitTestPointer(pointer);
      if (hits.some((o) => o.input?.enabled)) return;
      this.dragY = pointer.y;
      this.dragScrollY = this.scrollY;
      this.dragging = false;
    };
    const move = (pointer: Phaser.Input.Pointer) => {
      if (this.dragY == null || !pointer.isDown) return;
      const dy = this.dragY - pointer.y;
      if (!this.dragging && Math.abs(dy) < 6) return;
      this.dragging = true;
      this.setScroll(this.dragScrollY + dy);
    };
    const up = () => {
      this.dragY = null;
      this.dragging = false;
    };
    this.input.on('wheel', wheel);
    this.input.on('pointerdown', down);
    this.input.on('pointermove', move);
    this.input.on('pointerup', up);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('wheel', wheel);
      this.input.off('pointerdown', down);
      this.input.off('pointermove', move);
      this.input.off('pointerup', up);
    });
  }

  private setScroll(y: number) {
    this.scrollY = Phaser.Math.Clamp(y, 0, this.maxScrollY);
    this.cameras.main.setScroll(0, this.scrollY);
  }

  private rewardAmounts(right: number, y: number, coins: number, cash: number, rays: number, dim: boolean) {
    let x = right;
    if (rays > 0) {
      const label = this.add.text(x, y, `+${rays}`, { fontFamily: FONT, fontSize: '22px', color: dim ? '#7893a2' : '#66e8ff' }).setOrigin(1, 0.5);
      const icon = this.add.graphics({ x: x - label.width - 22, y });
      icon.fillStyle(dim ? 0x426274 : 0x46dfff, 1).fillPoints([{ x: 3, y: -13 }, { x: 14, y: -13 }, { x: 8, y: -2 }, { x: 15, y: -2 }, { x: 0, y: 14 }, { x: 5, y: 2 }, { x: -2, y: 2 }], true);
      if (dim) icon.setAlpha(0.5);
      x -= label.width + 44;
    }
    if (cash > 0) {
      const t = this.add.text(x, y, `${cash}`, { fontFamily: FONT, fontSize: '26px', color: dim ? '#6f8a76' : '#9fe8a0' }).setOrigin(1, 0.5);
      x -= t.width + 24;
      const ic = this.add.graphics({ x, y });
      drawCashIcon(ic, 0.7);
      if (dim) ic.setAlpha(0.5);
      x -= 30;
    }
    const t = this.add.text(x, y, fmtCoins(coins), { fontFamily: FONT, fontSize: '26px', color: dim ? '#8a7a4a' : '#ffd23f' }).setOrigin(1, 0.5);
    x -= t.width + 20;
    const ic = this.add.graphics({ x, y });
    drawCoinIcon(ic, 13);
    if (dim) ic.setAlpha(0.5);
  }

  private historyCard(v: RankedView, x: number, y: number, w: number, h: number) {
    const left = x - w / 2;
    const g = this.add.graphics();
    g.fillStyle(0x061433, 0.96).fillRoundedRect(left, y, w, h, 22);
    g.lineStyle(8, 0x19bdff, 0.14).strokeRoundedRect(left, y, w, h, 22);
    g.lineStyle(3, 0x168bff, 1).strokeRoundedRect(left, y, w, h, 22);
    const clock = this.add.graphics({ x: left + 30, y: y + 28 });
    clock.lineStyle(3, 0x45d9ff, 1).strokeCircle(0, 0, 13);
    clock.lineStyle(3, 0x45d9ff, 1).beginPath().moveTo(0, -8).lineTo(0, 0).lineTo(7, 4).strokePath();
    this.add.text(left + 54, y + 28, 'ÚLTIMAS PARTIDAS', { fontFamily: FONT, fontSize: '19px', color: '#ffffff' }).setOrigin(0, 0.5).setLetterSpacing(0.5);
    const recent = v.history.slice(0, 3);
    if (!recent.length) {
      this.add.text(x, y + 103, 'Juega partidas Ranked para ver tus resultados', { fontFamily: FONT, fontSize: '14px', color: '#9fb4e0', align: 'center', wordWrap: { width: w - 32 } }).setOrigin(0.5);
    } else {
      recent.forEach((match, i) => {
        const rowY = y + 60 + i * 33;
        const win = match.outcome === 'win';
        const row = this.add.graphics();
        row.fillStyle(0x081a3a, 0.98).fillRoundedRect(left + 12, rowY - 15, w - 24, 30, 13);
        row.lineStyle(1.5, win ? 0x168bff : 0x168bff, 0.65).strokeRoundedRect(left + 12, rowY - 15, w - 24, 30, 13);
        row.fillStyle(win ? 0x087d39 : 0x962b29, 1).fillRoundedRect(left + 18, rowY - 11, 94, 22, 11);
        this.add.text(left + 65, rowY, win ? 'VICTORIA' : 'DERROTA', { fontFamily: FONT, fontSize: '14px', color: '#ffffff' }).setOrigin(0.5);
        const delta = `${match.delta >= 0 ? '+' : '−'}${fmtCoins(Math.abs(match.delta))}`;
        this.add.text(left + w - 19, rowY, delta, { fontFamily: FONT, fontSize: '18px', color: win ? '#55ef81' : '#ff8174' }).setOrigin(1, 0.5);
      });
    }
    arcadeButton(this, x, y + h - 39, w - 40, 36, 'VER HISTORIAL', () => this.historyOverlay(), { palette: 'blue' });
  }

  private extraRewardsCard(x: number, y: number, w: number, h: number) {
    const left = x - w / 2;
    const g = this.add.graphics();
    g.fillStyle(0x211704, 0.97).fillRoundedRect(left, y, w, h, 22);
    g.lineStyle(8, GOLD, 0.14).strokeRoundedRect(left, y, w, h, 22);
    g.lineStyle(3, 0xf0b91f, 1).strokeRoundedRect(left, y, w, h, 22);
    const gift = this.add.graphics({ x: left + 30, y: y + 28 });
    drawGiftIcon(gift, 18);
    this.add.text(left + 56, y + 28, 'PREMIOS EXTRA', { fontFamily: FONT, fontSize: '20px', color: '#fff0a8' }).setOrigin(0, 0.5).setLetterSpacing(0.5);
    RANKED.positionPrizes.forEach((prize, i) => {
      const rowY = y + 64 + i * 28;
      const row = this.add.graphics();
      row.fillStyle(0x191405, 0.98).fillRoundedRect(left + 12, rowY - 13, w - 24, 26, 12);
      row.lineStyle(1.5, 0x927322, 0.95).strokeRoundedRect(left + 12, rowY - 13, w - 24, 26, 12);
      row.fillStyle(i === 0 ? 0xa96800 : 0x4b4635, 1).fillRoundedRect(left + 17, rowY - 10, 66, 20, 10);
      this.add.text(left + 50, rowY, prize.label, { fontFamily: FONT, fontSize: '13px', color: '#ffffff' }).setOrigin(0.5);
      const cash = prize.cash > 0 ? ` · ${prize.cash} dinero` : '';
      const value = this.add.text(left + 92, rowY, `+${fmtCoins(prize.coins)} monedas${cash}`, { fontFamily: FONT, fontSize: '13px', color: '#ffe15b' }).setOrigin(0, 0.5);
      fitText(value, w - 112);
    });
    arcadeButton(this, x, y + h - 39, w - 40, 36, 'VER PREMIOS', () => this.extraRewardsOverlay(), { palette: 'yellow' });
  }

  private historyOverlay() {
    const W = this.scale.width;
    const H = this.scale.height;
    const objs = this.openOverlay(0.82);
    const v = rankedView();
    const pw = Math.min(600, W - 36);
    const ph = Math.min(660, H - 80);
    const p = this.add.container(W / 2, (H - ph) / 2).setDepth(8001);
    objs.push(p);
    p.add(this.add.rectangle(0, ph / 2, pw, ph, 0, 0.001).setInteractive());
    const g = this.add.graphics();
    g.fillStyle(NAVY, 0.99).fillRoundedRect(-pw / 2, 0, pw, ph, 24);
    g.lineStyle(3, NEON, 1).strokeRoundedRect(-pw / 2, 0, pw, ph, 24);
    p.add(g);
    p.add(this.add.text(0, 42, 'HISTORIAL RANKED', { fontFamily: FONT, fontSize: '30px', color: '#ffffff' }).setOrigin(0.5).setLetterSpacing(1));
    p.add(this.add.text(0, 75, 'Tus últimas partidas completadas', { fontFamily: FONT, fontSize: '15px', color: '#9fb4e0' }).setOrigin(0.5));
    const entries = v.history.slice(0, 12);
    if (!entries.length) {
      p.add(this.add.text(0, 150, 'Aún no tienes partidas Ranked registradas.', { fontFamily: FONT, fontSize: '18px', color: '#dbe5ff', align: 'center', wordWrap: { width: pw - 50 } }).setOrigin(0.5));
    } else {
      const rowH = Math.min(42, (ph - 180) / entries.length);
      entries.forEach((match, i) => {
        const y = 112 + i * rowH;
        const rg = this.add.graphics();
        rg.fillStyle(0x10234b, 1).fillRoundedRect(-pw / 2 + 18, y, pw - 36, rowH - 5, 12);
        p.add(rg);
        p.add(this.add.text(-pw / 2 + 34, y + (rowH - 5) / 2, match.outcome === 'win' ? 'VICTORIA' : 'DERROTA', { fontFamily: FONT, fontSize: '16px', color: match.outcome === 'win' ? '#62ef89' : '#ff8174' }).setOrigin(0, 0.5));
        p.add(this.add.text(0, y + (rowH - 5) / 2, rankDef(match.league).name.toUpperCase(), { fontFamily: FONT, fontSize: '14px', color: '#9fb4e0' }).setOrigin(0.5));
        p.add(this.add.text(pw / 2 - 34, y + (rowH - 5) / 2, `${match.delta >= 0 ? '+' : '−'}${fmtCoins(Math.abs(match.delta))}`, { fontFamily: FONT, fontSize: '18px', color: match.delta >= 0 ? '#62ef89' : '#ff8174' }).setOrigin(1, 0.5));
      });
    }
    p.add(arcadeButton(this, 0, ph - 44, Math.min(300, pw - 60), 54, 'CERRAR', () => this.closeOverlay(), { palette: 'blue' }));
  }

  private extraRewardsOverlay() {
    const W = this.scale.width;
    const H = this.scale.height;
    const objs = this.openOverlay(0.82);
    const pw = Math.min(600, W - 36);
    const ph = 460;
    const p = this.add.container(W / 2, (H - ph) / 2).setDepth(8001);
    objs.push(p);
    p.add(this.add.rectangle(0, ph / 2, pw, ph, 0, 0.001).setInteractive());
    const g = this.add.graphics();
    g.fillStyle(0x211704, 0.99).fillRoundedRect(-pw / 2, 0, pw, ph, 24);
    g.lineStyle(3, GOLD, 1).strokeRoundedRect(-pw / 2, 0, pw, ph, 24);
    p.add(g);
    p.add(this.add.text(0, 42, 'PREMIOS EXTRA DE LA SEMANA', { fontFamily: FONT, fontSize: '27px', color: '#ffe15b' }).setOrigin(0.5));
    p.add(this.add.text(0, 78, 'Se suman a la recompensa de tu liga al cerrar la semana.', { fontFamily: FONT, fontSize: '15px', color: '#f1dfab', align: 'center', wordWrap: { width: pw - 60 } }).setOrigin(0.5));
    RANKED.positionPrizes.forEach((prize, i) => {
      const y = 142 + i * 76;
      const row = this.add.graphics();
      row.fillStyle(0x191405, 1).fillRoundedRect(-pw / 2 + 24, y - 26, pw - 48, 56, 16);
      row.lineStyle(2, i === 0 ? GOLD : 0x8d773b, 1).strokeRoundedRect(-pw / 2 + 24, y - 26, pw - 48, 56, 16);
      p.add(row);
      p.add(this.add.text(-pw / 2 + 48, y + 1, prize.label, { fontFamily: FONT, fontSize: '20px', color: i === 0 ? '#ffd23f' : '#ffffff' }).setOrigin(0, 0.5));
      p.add(this.add.text(pw / 2 - 48, y + 1, `${fmtCoins(prize.coins)} monedas${prize.cash ? ` · ${prize.cash} dinero` : ''}`, { fontFamily: FONT, fontSize: '17px', color: '#ffe15b' }).setOrigin(1, 0.5));
    });
    p.add(this.add.text(0, 375, `Completa ${RANKED.minMatchesForReward} partidas Ranked para optar a estos premios.`, { fontFamily: FONT, fontSize: '15px', color: '#f1dfab', align: 'center', wordWrap: { width: pw - 60 } }).setOrigin(0.5));
    p.add(arcadeButton(this, 0, ph - 42, Math.min(300, pw - 60), 54, 'CERRAR', () => this.closeOverlay(), { palette: 'yellow' }));
  }

  // ================================================================ tabla Top 100
  private leaderboard() {
    const W = this.scale.width;
    const H = this.scale.height;
    const v = rankedView();
    const st = LEAGUE_STYLE[v.league];
    const objs = this.openOverlay();
    const pw = Math.min(680, W - 24);
    const top = 96;
    const bottom = H - 30;
    const ph = bottom - top;
    const p = this.add.container(W / 2, top).setDepth(8001);
    objs.push(p);
    p.add(this.add.rectangle(0, ph / 2, pw, ph, 0, 0.001).setInteractive());
    const g = this.add.graphics();
    g.fillStyle(NAVY, 0.98).fillRoundedRect(-pw / 2, 0, pw, ph, 24);
    g.lineStyle(3, st.color, 1).strokeRoundedRect(-pw / 2, 0, pw, ph, 24);
    p.add(g);
    p.add(this.add.text(0, 36, `TOP ${RANKED.tableSize} · ${rankDef(v.league).name.toUpperCase()}`, { fontFamily: FONT, fontSize: '30px', color: st.css, stroke: '#0a1638', strokeThickness: 5 }).setOrigin(0.5).setLetterSpacing(2));
    p.add(this.add.text(0, 68, `Cierra en ${fmtLeft(v.msLeft)} · Top 1, Top 10 y Top 50 ganan premio extra`, { fontFamily: FONT, fontSize: '15px', color: '#9fb4e0' }).setOrigin(0.5));

    // mejores de cada liga
    const leaders = leagueLeaders();
    const lw = (pw - 30) / leaders.length;
    leaders.forEach((l, i) => {
      const x = -pw / 2 + 15 + lw * (i + 0.5);
      p.add(new RankBadge(this, x, 112, { rank: l.league, level: 99, size: 40 }));
      const nm = this.add.text(x, 142, l.top.id === 'me' ? 'TÚ' : l.top.name, { fontFamily: FONT, fontSize: '12px', color: l.top.id === 'me' ? '#ffd23f' : '#dbe5ff' }).setOrigin(0.5);
      fitText(nm, lw - 6);
      p.add(nm);
    });
    p.add(this.add.text(0, 162, 'MEJOR JUGADOR DE CADA LIGA', { fontFamily: FONT, fontSize: '11px', color: '#7f93bf' }).setOrigin(0.5).setLetterSpacing(1));

    // lista con desplazamiento
    const listTop = 180;
    const listBottom = ph - 92;
    const rowH = 58;
    const list = this.add.container(0, listTop);
    p.add(list);
    const maskG = this.make.graphics({}, false);
    maskG.fillRect(W / 2 - pw / 2, top + listTop, pw, listBottom - listTop);
    list.setMask(maskG.createGeometryMask());
    objs.push(maskG);
    v.board.forEach((e, i) => list.add(this.boardRow(e, i * rowH + rowH / 2, pw - 24, rowH - 6)));
    const maxScroll = Math.max(0, v.board.length * rowH - (listBottom - listTop));
    let scroll = 0;
    const setScroll = (s: number) => {
      scroll = Phaser.Math.Clamp(s, 0, maxScroll);
      list.y = listTop - scroll;
    };
    // abre centrado en el jugador
    if (v.position) setScroll((v.position - 1) * rowH - (listBottom - listTop) / 2 + rowH / 2);
    const zone = this.add.zone(W / 2, top + (listTop + listBottom) / 2, pw, listBottom - listTop).setInteractive().setDepth(8002);
    objs.push(zone);
    let dragY: number | null = null;
    let start = 0;
    zone.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      dragY = ptr.y;
      start = scroll;
    });
    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (dragY != null && ptr.isDown) setScroll(start - (ptr.y - dragY));
    });
    this.input.on('pointerup', () => (dragY = null));
    zone.on('wheel', (_p: unknown, _dx: number, dy: number) => setScroll(scroll + dy));

    // fila fija del jugador
    const me = v.board.find((e) => e.id === 'me');
    if (me) p.add(this.boardRow(me, listBottom + 6 + rowH / 2, pw - 24, rowH - 4, true));
    // cerrar
    const close = this.add.text(pw / 2 - 30, 34, '✕', { fontFamily: FONT, fontSize: '30px', color: '#9fb4e0' }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    close.on('pointerup', () => this.closeOverlay());
    p.add(close);
    this.events.once('overlay-closed', () => {
      this.input.off('pointermove');
      this.input.off('pointerup');
    });
  }

  private boardRow(e: BoardEntry, y: number, w: number, h: number, pinned = false, compact = false) {
    const c = this.add.container(0, y);
    const me = e.id === 'me';
    const medal = compact
      ? e.position === 1
        ? GOLD
        : e.position === 2
          ? 0xc0c8d8
          : e.position === 3
            ? 0xd88a4a
            : 0
      : e.position === 1
        ? GOLD
        : e.position <= 10
          ? 0xc0c8d8
          : e.position <= 50
            ? 0xd88a4a
            : 0;
    const g = this.add.graphics();
    g.fillStyle(me ? 0x3a2a08 : e.position % 2 ? 0x14224a : 0x101c3e, pinned ? 1 : 0.95).fillRoundedRect(-w / 2, -h / 2, w, h, 12);
    if (me) g.lineStyle(3, GOLD, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
    else if (e.position === 1) g.lineStyle(2, GOLD, 0.8).strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
    c.add(g);
    // posición (medalla para los tramos con premio)
    const px = -w / 2 + (compact ? 32 : 34);
    if (medal) {
      const mg = this.add.graphics({ x: px, y: 0 });
      mg.fillStyle(0x0a1638, 1).fillCircle(0, 0, compact ? 17 : 19);
      mg.fillStyle(medal, 1).fillCircle(0, 0, compact ? 14 : 16);
      c.add(mg);
    }
    c.add(this.add.text(px, 0, `${e.position}`, { fontFamily: FONT, fontSize: compact ? '17px' : e.position >= 100 ? '15px' : '19px', color: medal ? '#0a1638' : '#9fb4e0' }).setOrigin(0.5));
    // avatar
    const ax = px + (compact ? 43 : 46);
    const av = this.add.graphics({ x: ax, y: 0 });
    const avatarR = compact ? 17 : 20;
    av.fillStyle(0x0a1638, 1).fillCircle(0, 0, avatarR);
    av.fillStyle(e.avatar.color, 1).fillCircle(0, 0, avatarR - 3);
    av.fillStyle(0x0a1638, 0.85).fillCircle(0, -4, compact ? 5.5 : 6.5);
    av.fillRoundedRect(compact ? -8 : -10, 4, compact ? 16 : 20, compact ? 8 : 9, { tl: 8, tr: 8, bl: 2, br: 2 });
    c.add(av);
    // nombre y nivel
    const nameX = ax + (compact ? 25 : 30);
    const nm = this.add.text(nameX, compact ? -7 : -9, me ? `${e.name} (TÚ)` : e.name, { fontFamily: FONT, fontSize: compact ? '17px' : '20px', color: me ? '#ffd23f' : '#ffffff' }).setOrigin(0, 0.5);
    fitText(nm, w * 0.42);
    c.add(nm);
    c.add(this.add.text(nameX, compact ? 11 : 13, `NV ${e.level} · ${e.wins}V ${e.losses}D`, { fontFamily: FONT, fontSize: compact ? '11px' : '13px', color: '#9fb4e0' }).setOrigin(0, 0.5));
    // monedas
    const ct = this.add.text(w / 2 - 14, 0, fmtCoins(e.coins), { fontFamily: FONT, fontSize: compact ? '18px' : '21px', color: '#ffd23f' }).setOrigin(1, 0.5);
    c.add(ct);
    const coinSize = compact ? 9 : 10;
    const ci = this.add.graphics({ x: w / 2 - 18 - ct.width - coinSize, y: 0 });
    drawCoinIcon(ci, coinSize);
    c.add(ci);
    return c;
  }

  // ================================================================ lista de ligas
  private leagueList() {
    const W = this.scale.width;
    const objs = this.openOverlay();
    const v = rankedView();
    const pw = Math.min(620, W - 30);
    const ph = 6 * 104 + 120;
    const p = this.add.container(W / 2, this.scale.height / 2).setDepth(8001);
    objs.push(p);
    p.add(this.add.rectangle(0, 0, pw, ph, 0, 0.001).setInteractive());
    const g = this.add.graphics();
    g.fillStyle(NAVY, 0.98).fillRoundedRect(-pw / 2, -ph / 2, pw, ph, 24);
    g.lineStyle(3, NEON, 1).strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, 24);
    p.add(g);
    p.add(this.add.text(0, -ph / 2 + 40, 'LIGAS', { fontFamily: FONT, fontSize: '34px', color: '#ffffff' }).setOrigin(0.5).setLetterSpacing(3));
    RANKS.forEach((r, i) => {
      const y = -ph / 2 + 120 + i * 104;
      const eco = RANKED.leagues[r.id];
      const cur = r.id === v.league;
      const st = LEAGUE_STYLE[r.id];
      const rg = this.add.graphics();
      rg.fillStyle(cur ? 0x1d2d5c : 0x111c3c, 1).fillRoundedRect(-pw / 2 + 16, y - 46, pw - 32, 92, 14);
      rg.lineStyle(cur ? 3 : 2, cur ? st.color : 0x2c4a8a, 1).strokeRoundedRect(-pw / 2 + 16, y - 46, pw - 32, 92, 14);
      p.add(rg);
      p.add(new RankBadge(this, -pw / 2 + 64, y, { rank: r.id, level: 99, size: 76 }));
      p.add(this.add.text(-pw / 2 + 112, y - 20, r.name.toUpperCase() + (cur ? '  · TU LIGA' : ''), { fontFamily: FONT, fontSize: '22px', color: st.css }).setOrigin(0, 0.5));
      p.add(this.add.text(-pw / 2 + 112, y + 6, eco.target != null ? `Asciende con ${fmtCoins(eco.target)} monedas` : 'Liga máxima', { fontFamily: FONT, fontSize: '15px', color: '#9fb4e0' }).setOrigin(0, 0.5));
      p.add(this.add.text(-pw / 2 + 112, y + 28, `Entrada ${fmtCoins(eco.entry)} · Semanal ${fmtCoins(eco.weekly.coins)}${eco.weekly.cash ? ` + ${eco.weekly.cash} dinero` : ''}`, { fontFamily: FONT, fontSize: '14px', color: '#7f93bf' }).setOrigin(0, 0.5));
    });
    const close = this.add.text(pw / 2 - 30, -ph / 2 + 36, '✕', { fontFamily: FONT, fontSize: '30px', color: '#9fb4e0' }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    close.on('pointerup', () => this.closeOverlay());
    p.add(close);
  }

  // ================================================================ avisos al entrar (uno tras otro)
  private presentQueue() {
    if (!this.scene.isActive() || this.overlay.length) return;
    const r = rankedState();
    if (r.demotion) return this.showDemotion(r.demotion.from, r.demotion.to, r.demotion.coinsCut);
    if (r.seenLeague !== r.league) return this.showPromotion(r.seenLeague, r.league);
    const w = pendingWeekly()[0];
    if (w) return this.showWeekly(w);
  }

  /** Animación de ascenso de liga. */
  private showPromotion(from: RankId, to: RankId) {
    const W = this.scale.width;
    const H = this.scale.height;
    const objs = this.openOverlay(0.85);
    const st = LEAGUE_STYLE[to];
    const cx = W / 2;
    const cy = H * 0.42;
    const rays = this.add.graphics({ x: cx, y: cy }).setDepth(8001).setBlendMode(Phaser.BlendModes.ADD);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      rays.fillStyle(st.color, i % 2 ? 0.1 : 0.2).fillTriangle(0, 0, Math.cos(a) * 520, Math.sin(a) * 520, Math.cos(a + 0.16) * 520, Math.sin(a + 0.16) * 520);
    }
    this.tweens.add({ targets: rays, angle: 360, duration: 16000, repeat: -1 });
    objs.push(rays);
    const old = new RankBadge(this, cx, cy, { rank: from, level: 99, size: 180 }).setDepth(8002);
    objs.push(old);
    const nb = new RankBadge(this, cx, cy, { rank: to, level: 99, size: 260 }).setDepth(8003).setScale(0).setAlpha(0);
    objs.push(nb);
    const flash = this.add.circle(cx, cy, 80, 0xffffff, 0).setDepth(8004).setBlendMode(Phaser.BlendModes.ADD);
    objs.push(flash);
    this.tweens.add({ targets: old, scale: 0.6, alpha: 0, angle: -30, duration: 500, delay: 300, ease: 'Back.easeIn' });
    this.tweens.add({ targets: flash, fillAlpha: { from: 0.9, to: 0 }, scale: 6, duration: 700, delay: 760 });
    this.tweens.add({ targets: nb, scale: 1, alpha: 1, duration: 650, delay: 780, ease: 'Back.easeOut' });
    const t1 = this.add.text(cx, cy - 210, '¡ASCENSO!', { fontFamily: FONT, fontSize: '58px', color: '#ffd23f', stroke: '#0a1638', strokeThickness: 8 }).setOrigin(0.5).setDepth(8005).setScale(0);
    const t2 = this.add.text(cx, cy + 180, rankDef(to).name.toUpperCase(), { fontFamily: FONT, fontSize: '48px', color: st.css, stroke: '#0a1638', strokeThickness: 8 }).setOrigin(0.5).setDepth(8005).setAlpha(0).setLetterSpacing(4);
    objs.push(t1, t2);
    this.tweens.add({ targets: t1, scale: 1, duration: 420, delay: 1100, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t2, alpha: 1, y: cy + 166, duration: 420, delay: 1250 });
    this.confetti(objs, [st.color, st.light, GOLD, 0xffffff]);
    const btn = arcadeButton(this, cx, H - 120, 300, 80, 'GENIAL', () => {
      markRankedSeen();
      this.closeOverlay();
      this.time.delayedCall(200, () => this.presentQueue());
    }, { palette: 'yellow' }).setDepth(8006).setAlpha(0);
    objs.push(btn);
    this.tweens.add({ targets: btn, alpha: 1, duration: 300, delay: 1600 });
  }

  /** Aviso del reinicio mensual (descenso parcial). */
  private showDemotion(from: RankId, to: RankId, cut: number) {
    const W = this.scale.width;
    const H = this.scale.height;
    const objs = this.openOverlay(0.85);
    const cx = W / 2;
    const p = this.add.container(cx, H * 0.45).setDepth(8001);
    objs.push(p);
    const pw = Math.min(600, W - 40);
    const ph = 560;
    const g = this.add.graphics();
    g.fillStyle(NAVY, 0.98).fillRoundedRect(-pw / 2, -ph / 2, pw, ph, 24);
    g.lineStyle(3, NEON, 1).strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, 24);
    p.add(g);
    p.add(this.add.text(0, -ph / 2 + 46, 'NUEVO MES DE RANKING', { fontFamily: FONT, fontSize: '32px', color: '#ffffff' }).setOrigin(0.5).setLetterSpacing(2));
    p.add(new RankBadge(this, -120, -40, { rank: from, level: 99, size: 150 }).setAlpha(0.6));
    p.add(this.add.text(0, -40, '➜', { fontFamily: FONT, fontSize: '50px', color: '#9fb4e0' }).setOrigin(0.5));
    p.add(new RankBadge(this, 120, -40, { rank: to, level: 99, size: 150 }));
    p.add(this.add.text(0, 80, `Empiezas el mes en ${rankDef(to).name.toUpperCase()}`, { fontFamily: FONT, fontSize: '24px', color: LEAGUE_STYLE[to].css }).setOrigin(0.5));
    const msg = cut > 0 ? `Tu saldo se ajustó (−${fmtCoins(cut)}): con una partida vuelves a subir y empiezas a mitad de liga` : 'Conservas todas tus monedas';
    const mt = this.add.text(0, 130, msg, { fontFamily: FONT, fontSize: '18px', color: '#9fb4e0', align: 'center', wordWrap: { width: pw - 60 } }).setOrigin(0.5);
    p.add(mt);
    p.add(arcadeButton(this, 0, ph / 2 - 60, 280, 76, '¡A SUBIR!', () => {
      markRankedSeen();
      this.closeOverlay();
      this.time.delayedCall(200, () => this.presentQueue());
    }, { palette: 'yellow' }));
  }

  /** Pantalla de recompensas semanales (se cobra con el botón). */
  private showWeekly(w: WeeklyReward) {
    const W = this.scale.width;
    const H = this.scale.height;
    const objs = this.openOverlay(0.85);
    const st = LEAGUE_STYLE[w.league];
    const cx = W / 2;
    const p = this.add.container(cx, H * 0.45).setDepth(8001);
    objs.push(p);
    const pw = Math.min(620, W - 40);
    const ph = 640;
    const g = this.add.graphics();
    g.lineStyle(12, w.eligible ? GOLD : NEON, 0.25).strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, 26);
    g.fillStyle(NAVY, 0.98).fillRoundedRect(-pw / 2, -ph / 2, pw, ph, 26);
    g.lineStyle(3, w.eligible ? GOLD : NEON, 1).strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, 26);
    p.add(g);
    p.add(this.add.text(0, -ph / 2 + 46, 'FIN DE TEMPORADA', { fontFamily: FONT, fontSize: '36px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 6 }).setOrigin(0.5).setLetterSpacing(2));
    p.add(this.add.text(0, -ph / 2 + 84, `Semana del ${w.week.split('-').reverse().join('/')}`, { fontFamily: FONT, fontSize: '17px', color: '#9fb4e0' }).setOrigin(0.5));
    const badge = new RankBadge(this, 0, -ph / 2 + 200, { rank: w.league, level: 99, size: 170, position: w.league === 'challenger' ? (w.position ?? undefined) : undefined });
    p.add(badge);
    this.tweens.add({ targets: badge, scale: { from: 0.7, to: 1 }, duration: 500, ease: 'Back.easeOut' });
    p.add(this.add.text(0, -ph / 2 + 306, rankDef(w.league).name.toUpperCase(), { fontFamily: FONT, fontSize: '30px', color: st.css }).setOrigin(0.5).setLetterSpacing(3));
    p.add(this.add.text(0, -ph / 2 + 346, `POSICIÓN FINAL ${w.position ? `#${w.position}` : '—'}${w.positionLabel ? ` · ${w.positionLabel}` : ''} · ${w.matches} PARTIDAS`, { fontFamily: FONT, fontSize: '18px', color: '#dbe5ff' }).setOrigin(0.5));
    if (w.eligible) {
      const rg = this.add.graphics();
      rg.fillStyle(0x1a1306, 1).fillRoundedRect(-pw / 2 + 40, -ph / 2 + 380, pw - 80, 96, 18);
      rg.lineStyle(3, GOLD, 1).strokeRoundedRect(-pw / 2 + 40, -ph / 2 + 380, pw - 80, 96, 18);
      p.add(rg);
      const ci = this.add.graphics({ x: -110, y: -ph / 2 + 428 });
      drawCoinIcon(ci, 20);
      p.add(ci);
      p.add(this.add.text(-82, -ph / 2 + 428, fmtCoins(w.coins), { fontFamily: FONT, fontSize: '36px', color: '#ffd23f' }).setOrigin(0, 0.5));
      if (w.cash) {
        const cc = this.add.graphics({ x: 100, y: -ph / 2 + 428 });
        drawCashIcon(cc, 1);
        p.add(cc);
        p.add(this.add.text(126, -ph / 2 + 428, `${w.cash}`, { fontFamily: FONT, fontSize: '36px', color: '#9fe8a0' }).setOrigin(0, 0.5));
      }
      const rayY = -ph / 2 + 455;
      const rayIcon = this.add.graphics({ x: -44, y: rayY });
      rayIcon.fillStyle(0x47dfff, 1).fillPoints([{ x: 2, y: -11 }, { x: 12, y: -11 }, { x: 6, y: -1 }, { x: 13, y: -1 }, { x: -1, y: 12 }, { x: 4, y: 2 }, { x: -2, y: 2 }], true);
      p.add(rayIcon);
      p.add(this.add.text(-25, rayY, `+${w.rays} RAYO${w.rays === 1 ? '' : 'S'}`, { fontFamily: FONT, fontSize: '17px', color: '#79e8ff' }).setOrigin(0, 0.5));
      this.confetti(objs, [GOLD, st.color, 0xffffff]);
    } else {
      const t = this.add.text(0, -ph / 2 + 428, `Necesitabas ${RANKED.minMatchesForReward} partidas completadas (jugaste ${w.matches}).\nSigues en tu liga: ¡esta semana sí!`, { fontFamily: FONT, fontSize: '19px', color: '#9fb4e0', align: 'center', wordWrap: { width: pw - 70 } }).setOrigin(0.5);
      p.add(t);
    }
    p.add(arcadeButton(this, 0, ph / 2 - 62, 300, 80, w.eligible ? 'RECLAMAR' : 'ENTENDIDO', () => {
      const res = claimWeekly(w.week);
      this.closeOverlay();
      if (res.ok && res.given) this.toast(`+${fmtCoins(w.coins)} monedas${w.cash ? ` · +${w.cash} dinero` : ''}${w.rays ? ` · +${w.rays} Rayo` : ''}`);
      this.time.delayedCall(300, () => this.presentQueue());
    }, { palette: 'yellow' }));
  }

  // ================================================================ utilidades
  private openOverlay(alpha = 0.75) {
    this.closeOverlay();
    this.overlayReturnScroll = this.scrollY;
    this.scrollY = 0;
    this.cameras.main.setScroll(0, 0);
    const W = this.scale.width;
    const H = this.scale.height;
    const shade = this.add.rectangle(0, 0, W, H, 0x02060f, alpha).setOrigin(0).setDepth(8000).setScrollFactor(0).setInteractive();
    this.overlay = [shade];
    return this.overlay;
  }

  private closeOverlay() {
    if (!this.overlay.length) return;
    this.overlay.forEach((o) => o.destroy());
    this.overlay = [];
    this.events.emit('overlay-closed');
    this.scrollY = this.overlayReturnScroll;
    this.rebuild();
  }

  private confetti(objs: Phaser.GameObjects.GameObject[], colors: number[]) {
    const W = this.scale.width;
    const H = this.scale.height;
    for (let i = 0; i < 46; i++) {
      const r = this.add.rectangle(Phaser.Math.Between(0, W), Phaser.Math.Between(-H * 0.5, -20), Phaser.Math.Between(8, 14), Phaser.Math.Between(12, 20), Phaser.Utils.Array.GetRandom(colors)).setDepth(8007);
      objs.push(r);
      this.tweens.add({ targets: r, y: H + 40, x: r.x + Phaser.Math.Between(-120, 120), angle: Phaser.Math.Between(-540, 540), duration: Phaser.Math.Between(2400, 4200), delay: Phaser.Math.Between(0, 1000) });
    }
  }

  private backButton(x: number, y: number) {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(NAVY, 0.94).fillRoundedRect(-30, -30, 60, 60, 16);
    g.lineStyle(3, NEON, 1).strokeRoundedRect(-30, -30, 60, 60, 16);
    g.lineStyle(6, 0xffffff, 1).beginPath().moveTo(6, -13).lineTo(-8, 0).lineTo(6, 13).strokePath();
    c.add(g);
    c.setSize(64, 64).setInteractive({ useHandCursor: true });
    c.on('pointerup', () => {
      this.cameras.main.fadeOut(180, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Menu'));
    });
  }

  private navImageHeight(W: number) {
    const { x0, y0, x1, y1 } = NAV.box;
    const scale = (W - NAV.side * 2) / (x1 - x0);
    return (y1 - y0) * scale + NAV.bottom;
  }

  private navImage(W: number, H: number) {
    const { x0, y0, x1, y1 } = NAV.box;
    const scale = (W - NAV.side * 2) / (x1 - x0);
    const bottom = H - NAV.bottom;
    const top = bottom - (y1 - y0) * scale;
    this.add.image(NAV.side, bottom, NAV.key).setOrigin(x0 / NAV.w, y1 / NAV.h).setScale(scale).setDepth(100).setScrollFactor(0);

    const zone = (from: number, to: number, onClick: () => void) => {
      const zx = NAV.side + (W - NAV.side * 2) * from;
      const zw = (W - NAV.side * 2) * (to - from);
      const hit = this.add.rectangle(zx + zw / 2, (top + bottom) / 2, zw, bottom - top + 16, 0x000000, 0.001).setDepth(102).setScrollFactor(0);
      hit.setInteractive({ useHandCursor: true }).on('pointerdown', onClick);
    };
    zone(0, NAV.split[0], () => undefined); // Ranking ya está activa.
    zone(NAV.split[0], NAV.split[1], () => {
      this.cameras.main.fadeOut(180, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Menu'));
    });
    zone(NAV.split[1], 1, () => this.toast('Eventos: próximamente'));
  }

  private coinPill(right: number, y: number, coins: number) {
    const t = this.add.text(right - 14, y, fmtCoins(coins), { fontFamily: FONT, fontSize: '24px', color: '#ffffff' }).setOrigin(1, 0.5);
    const w = t.width + 60;
    const g = this.add.graphics();
    g.fillStyle(NAVY, 0.94).fillRoundedRect(right - w, y - 22, w, 44, 22);
    g.lineStyle(2, GOLD, 1).strokeRoundedRect(right - w, y - 22, w, 44, 22);
    const ic = this.add.graphics({ x: right - w + 22, y });
    drawCoinIcon(ic, 14);
    this.children.bringToTop(t);
  }

  private toast(msg: string) {
    const W = this.scale.width;
    const t = this.add.text(W / 2, this.scale.height * 0.62, msg, { fontFamily: FONT, fontSize: '24px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 6, align: 'center', wordWrap: { width: W - 60 } }).setOrigin(0.5).setDepth(9500).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, y: t.y - 20, duration: 200 });
    this.tweens.add({ targets: t, alpha: 0, delay: 1800, duration: 300, onComplete: () => t.destroy() });
  }
}

const pct = (w: number, l: number) => (w + l ? `${Math.round((w / (w + l)) * 100)}%` : '0%');

type StatIcon = 'trophy' | 'calendar' | 'chart' | 'flame';

/** Iconos blancos simples de los cuadros de estadísticas (centrados en 0,0, radio ~10). */
function drawStatIcon(g: Phaser.GameObjects.Graphics, icon: StatIcon) {
  g.fillStyle(0xffffff, 1);
  if (icon === 'trophy') {
    g.fillRoundedRect(-7, -8, 14, 9, { tl: 1, tr: 1, bl: 6, br: 6 });
    g.lineStyle(2, 0xffffff, 1).strokeCircle(-8, -4, 3).strokeCircle(8, -4, 3);
    g.fillRect(-1.5, 1, 3, 4).fillRoundedRect(-5, 5, 10, 3, 1);
  } else if (icon === 'calendar') {
    g.fillRoundedRect(-8, -6, 16, 14, 2);
    g.fillStyle(0x0a1638, 1).fillRect(-6, -1, 12, 7);
    g.fillStyle(0xffffff, 1).fillRect(-5, -9, 2, 5).fillRect(3, -9, 2, 5);
  } else if (icon === 'chart') {
    g.fillRect(-8, 2, 4, 6).fillRect(-2, -2, 4, 10).fillRect(4, -7, 4, 15);
  } else {
    g.fillPoints([{ x: 0, y: -10 }, { x: 6, y: -2 }, { x: 7, y: 4 }, { x: 0, y: 9 }, { x: -7, y: 4 }, { x: -5, y: -3 }, { x: -2, y: 0 }], true);
    g.fillStyle(0xffe066, 1).fillCircle(0, 4, 3);
  }
}
