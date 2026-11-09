import Phaser from 'phaser';
import { FONT, restartOnResize } from '../ui/theme';
import { stadiumBg } from '../ui/ui';
import { arcadeButton } from '../ui/modeButtons';
import { fitText } from '../ui/fitText';
import { RankBadge, preloadRankBadges } from '../ui/RankBadge';
import { drawChestIcon, drawCoinIcon } from '../ui/wheelArt';
import { drawCashIcon } from './BattlePassScene';
import { LEAGUE_STYLE, fmtCoins, fmtLeft } from '../ui/leagueStyle';
import { RANKS, type RankId, rankDef } from '../domain/ranks';
import { RANKED } from '../domain/rankedConfig';
import type { BoardEntry } from '../domain/rankedBots';
import type { WeeklyReward } from '../domain/rankedState';
import { onPlayerChange } from '../domain/playerStore';
import { claimWeekly, leagueLeaders, markRankedSeen, pendingWeekly, rankedState, rankedView, syncRanked } from '../logic/Ranked';

const NAVY = 0x0b1733;
const NEON = 0x3a7bff;
const GOLD = 0xffc42e;

/**
 * Pantalla principal de RANKED: liga y emblema, saldo y progreso al ascenso, posición, partidas de la
 * semana (x/3), récord, racha, tiempo restante, recompensa estimada, JUGAR (normal / apuesta x2) y la
 * tabla Top 100. Al entrar muestra (una vez) el ascenso, el descenso mensual y las recompensas semanales.
 */
export class RankedScene extends Phaser.Scene {
  private overlay: Phaser.GameObjects.GameObject[] = [];
  private toastMsg?: string;

  constructor() {
    super('Ranked');
  }

  init(data?: { toast?: string }) {
    this.toastMsg = data?.toast;
  }

  preload() {
    if (!this.textures.exists('menu-bg')) this.load.image('menu-bg', 'assets/menu-bg.png');
    preloadRankBadges(this.load); // todas: tabla de líderes y lista de ligas
  }

  create() {
    restartOnResize(this);
    this.cameras.main.fadeIn(200, 0, 0, 0);
    syncRanked();
    this.overlay = [];
    this.build();
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
    stadiumBg(this, 0.62);
    // pantallas más altas que 1280: el espacio extra se reparte entre los bloques (JUGAR queda abajo)
    const ex = Phaser.Math.Clamp(H - 1280, 0, 360);
    const e1 = ex * 0.12;
    const e2 = ex * 0.25;
    const e3 = ex * 0.42;
    // resplandor del color de la liga detrás del emblema

    // ---- cabecera
    const headY = 60;
    this.backButton(50, headY);
    const title = this.add.text(W / 2, headY, 'RANKED', { fontFamily: FONT, fontSize: '44px', color: '#ffffff' }).setOrigin(0.5).setLetterSpacing(4);
    title.setShadow(0, 4, '#0a1638', 0, true, true);
    this.coinPill(W - 24, headY, v.coins);

    // ---- emblema + liga
    new RankBadge(this, W / 2, 222 + e1, { rank: v.league, level: 99, size: 168, position: v.league === 'challenger' ? (v.position ?? undefined) : undefined, onOpen: () => this.leagueList() });
    this.add.text(W / 2, 320 + e1, rankDef(v.league).name.toUpperCase(), { fontFamily: FONT, fontSize: '34px', color: st.css, stroke: '#0a1638', strokeThickness: 6 }).setOrigin(0.5).setLetterSpacing(3);
    this.add.text(W / 2, 350 + e1, `LA SEMANA TERMINA EL DOMINGO · QUEDAN ${fmtLeft(v.msLeft)}`, { fontFamily: FONT, fontSize: '16px', color: '#9fb4e0' }).setOrigin(0.5).setLetterSpacing(1);

    // ---- LO IMPORTANTE: el oro (monedas) que llevamos, en grande
    const gy = 428 + e1;
    const goldTxt = this.add.text(0, gy, fmtCoins(v.coins), { fontFamily: FONT, fontSize: '58px', color: '#ffd23f', stroke: '#0a1638', strokeThickness: 8 }).setOrigin(0, 0.5);
    const coinR = 22;
    const total = coinR * 2 + 12 + goldTxt.width;
    const gx0 = W / 2 - total / 2;
    const coinG = this.add.graphics({ x: gx0 + coinR, y: gy });
    drawCoinIcon(coinG, coinR);
    goldTxt.setX(gx0 + coinR * 2 + 12);
    this.add.text(W / 2, gy - 41, 'TU ORO', { fontFamily: FONT, fontSize: '15px', color: '#c9b98a' }).setOrigin(0.5).setLetterSpacing(3);

    // ---- progreso al ascenso
    const bw = Math.min(600, W - 60);
    const by = 484 + e1;
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
    const sy = 586 + e2;
    const tw = (Math.min(640, W - 40) - 3 * 10) / 4;
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
      const th = 118;
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
    const ry = 718 + e2;
    const rw = Math.min(640, W - 40);
    const rh = 92;
    const rx0 = W / 2 - rw / 2;
    const elig = v.estimate.eligible;
    const rg = this.add.graphics();
    rg.fillStyle(0x000000, 0.35).fillRoundedRect(rx0 + 3, ry - rh / 2 + 6, rw, rh, 20);
    rg.fillStyle(0x1d1708, 0.96).fillRoundedRect(rx0, ry - rh / 2, rw, rh, 20);
    rg.fillStyle(0x3a2d0c, 0.6).fillRoundedRect(rx0 + 3, ry - rh / 2 + 3, rw - 6, rh * 0.42, { tl: 17, tr: 17, bl: 0, br: 0 });
    rg.lineStyle(3, elig ? GOLD : 0x8a7130, 1).strokeRoundedRect(rx0, ry - rh / 2, rw, rh, 20);
    // cofre en un círculo dorado
    const cx0 = rx0 + 52;
    rg.fillStyle(0x0a1638, 1).fillCircle(cx0, ry, 34);
    rg.fillStyle(elig ? GOLD : 0x8a7130, 1).fillCircle(cx0, ry, 31);
    rg.fillStyle(0x2a1d05, 1).fillCircle(cx0, ry, 27);
    // el cofre se dibuja centrado en su propio origen (así el balanceo gira sobre el centro del círculo)
    const chest = this.add.graphics({ x: cx0, y: ry });
    drawChestIcon(chest, 17, 0, 1);
    if (elig) this.tweens.add({ targets: chest, angle: { from: -4, to: 4 }, duration: 180, yoyo: true, repeat: -1, repeatDelay: 1800 });
    const tx = cx0 + 46;
    this.add.text(tx, ry - 20, 'RECOMPENSA SEMANAL', { fontFamily: FONT, fontSize: '17px', color: '#ffd23f' }).setOrigin(0, 0.5).setLetterSpacing(1);
    const left = v.minMatches - v.weekMatches;
    const estSub = elig ? `Si la semana terminara ahora${v.estimate.label ? ` · ${v.estimate.label}` : ''}` : `Juega ${left} partida${left === 1 ? '' : 's'} más · se cobra el domingo`;
    const est = this.add.text(tx, ry + 6, estSub, { fontFamily: FONT, fontSize: '14px', color: '#c9b98a' }).setOrigin(0, 0.5);
    fitText(est, rw - (tx - rx0) - 150);
    // progreso de partidas de la semana (mini barra)
    const pbw = 150;
    const pg = this.add.graphics();
    pg.fillStyle(0x0a1638, 1).fillRoundedRect(tx, ry + 24, pbw, 8, 4);
    pg.fillStyle(elig ? GOLD : 0x62d935, 1).fillRoundedRect(tx, ry + 24, Math.max(8, pbw * Math.min(1, v.weekMatches / v.minMatches)), 8, 4);
    this.rewardAmounts(rx0 + rw - 18, ry, v.estimate.coins, v.estimate.cash, !elig);

    // ---- podio (Top 3 de la liga) + tabla completa
    const py = 790 + e3;
    this.add.text(W / 2, py, 'PODIO DE LA LIGA', { fontFamily: FONT, fontSize: '16px', color: '#9fb4e0' }).setOrigin(0.5).setLetterSpacing(2);
    const pod = this.add.container(W / 2, py + 40);
    v.board.slice(0, 3).forEach((e, i) => pod.add(this.boardRow(e, i * 56, Math.min(640, W - 40), 50)));
    const tbY = py + 40 + 3 * 56 + 6;
    arcadeButton(this, W / 2, tbY, Math.min(420, W - 80), 62, 'VER TOP 100', () => this.leaderboard(), { palette: 'blue' });

    // ---- JUGAR (normal / apuesta x2), anclado abajo
    const cardH = 190;
    const cy = Math.max(tbY + 50 + cardH / 2, H - 30 - cardH / 2);
    const cw = (Math.min(660, W - 40) - 16) / 2;
    v.stakes.forEach((sk, i) => {
      const x = W / 2 + (i === 0 ? -1 : 1) * (cw / 2 + 8);
      this.playCard(x, cy, cw, cardH, sk.bet, sk.entry, sk.prize, sk.affordable);
    });
  }

  private playCard(x: number, y: number, w: number, h: number, bet: number, entry: number, prize: number, affordable: boolean) {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    const col = bet > 1 ? 0xff4f5e : GOLD;
    g.fillStyle(0x000000, 0.35).fillRoundedRect(-w / 2 + 3, -h / 2 + 6, w, h, 20);
    g.lineStyle(10, col, affordable ? 0.22 : 0).strokeRoundedRect(-w / 2, -h / 2, w, h, 20);
    g.fillStyle(NAVY, 0.96).fillRoundedRect(-w / 2, -h / 2, w, h, 20);
    g.lineStyle(3, affordable ? col : 0x3a4a6a, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 20);
    c.add(g);
    c.add(this.add.text(0, -h / 2 + 28, bet > 1 ? `APUESTA x${bet}` : 'NORMAL', { fontFamily: FONT, fontSize: '24px', color: bet > 1 ? '#ff9aa3' : '#ffd23f' }).setOrigin(0.5).setLetterSpacing(2));
    const row = (yy: number, lab: string, val: string, color: string) => {
      c.add(this.add.text(-w / 2 + 18, yy, lab, { fontFamily: FONT, fontSize: '15px', color: '#7f93bf' }).setOrigin(0, 0.5));
      const ic = this.add.graphics({ x: w / 2 - 22, y: yy });
      drawCoinIcon(ic, 10);
      c.add(ic);
      c.add(this.add.text(w / 2 - 38, yy, val, { fontFamily: FONT, fontSize: '22px', color }).setOrigin(1, 0.5));
    };
    row(-h / 2 + 66, 'ENTRADA', fmtCoins(entry), '#ffffff');
    row(-h / 2 + 96, 'PREMIO', fmtCoins(prize), '#9fe8a0');
    const btn = arcadeButton(this, 0, h / 2 - 40, w - 30, 58, affordable ? 'JUGAR' : 'SIN MONEDAS', () => {
      if (!affordable) return this.toast(`Necesitas ${fmtCoins(entry)} monedas: consíguelas en ruletas, premio diario y pase`);
      this.cameras.main.fadeOut(200, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Matchmaking', { ranked: { bet }, from: 'Ranked' }));
    }, { palette: affordable ? (bet > 1 ? 'red' : 'yellow') : 'grey' });
    c.add(btn);
  }

  private rewardAmounts(right: number, y: number, coins: number, cash: number, dim: boolean) {
    let x = right;
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

  private boardRow(e: BoardEntry, y: number, w: number, h: number, pinned = false) {
    const c = this.add.container(0, y);
    const me = e.id === 'me';
    const medal = e.position === 1 ? GOLD : e.position <= 10 ? 0xc0c8d8 : e.position <= 50 ? 0xd88a4a : 0;
    const g = this.add.graphics();
    g.fillStyle(me ? 0x3a2a08 : e.position % 2 ? 0x14224a : 0x101c3e, pinned ? 1 : 0.95).fillRoundedRect(-w / 2, -h / 2, w, h, 12);
    if (me) g.lineStyle(3, GOLD, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
    else if (e.position === 1) g.lineStyle(2, GOLD, 0.8).strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
    c.add(g);
    // posición (medalla para los tramos con premio)
    const px = -w / 2 + 34;
    if (medal) {
      const mg = this.add.graphics({ x: px, y: 0 });
      mg.fillStyle(0x0a1638, 1).fillCircle(0, 0, 19);
      mg.fillStyle(medal, 1).fillCircle(0, 0, 16);
      c.add(mg);
    }
    c.add(this.add.text(px, 0, `${e.position}`, { fontFamily: FONT, fontSize: e.position >= 100 ? '15px' : '19px', color: medal ? '#0a1638' : '#9fb4e0' }).setOrigin(0.5));
    // avatar
    const ax = px + 46;
    const av = this.add.graphics({ x: ax, y: 0 });
    av.fillStyle(0x0a1638, 1).fillCircle(0, 0, 20);
    av.fillStyle(e.avatar.color, 1).fillCircle(0, 0, 17);
    av.fillStyle(0x0a1638, 0.85).fillCircle(0, -4, 6.5);
    av.fillRoundedRect(-10, 4, 20, 9, { tl: 8, tr: 8, bl: 2, br: 2 });
    c.add(av);
    // nombre y nivel
    const nm = this.add.text(ax + 30, -9, me ? `${e.name} (TÚ)` : e.name, { fontFamily: FONT, fontSize: '20px', color: me ? '#ffd23f' : '#ffffff' }).setOrigin(0, 0.5);
    fitText(nm, w * 0.42);
    c.add(nm);
    c.add(this.add.text(ax + 30, 13, `NV ${e.level} · ${e.wins}V ${e.losses}D`, { fontFamily: FONT, fontSize: '13px', color: '#7f93bf' }).setOrigin(0, 0.5));
    // monedas
    const ct = this.add.text(w / 2 - 14, 0, fmtCoins(e.coins), { fontFamily: FONT, fontSize: '21px', color: '#ffd23f' }).setOrigin(1, 0.5);
    c.add(ct);
    const ci = this.add.graphics({ x: w / 2 - 28 - ct.width, y: 0 });
    drawCoinIcon(ci, 10);
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
      this.confetti(objs, [GOLD, st.color, 0xffffff]);
    } else {
      const t = this.add.text(0, -ph / 2 + 428, `Necesitabas ${RANKED.minMatchesForReward} partidas completadas (jugaste ${w.matches}).\nSigues en tu liga: ¡esta semana sí!`, { fontFamily: FONT, fontSize: '19px', color: '#9fb4e0', align: 'center', wordWrap: { width: pw - 70 } }).setOrigin(0.5);
      p.add(t);
    }
    p.add(arcadeButton(this, 0, ph / 2 - 62, 300, 80, w.eligible ? 'RECLAMAR' : 'ENTENDIDO', () => {
      const res = claimWeekly(w.week);
      this.closeOverlay();
      if (res.ok && res.given) this.toast(`+${fmtCoins(w.coins)} monedas${w.cash ? ` · +${w.cash} dinero` : ''}`);
      this.time.delayedCall(300, () => this.presentQueue());
    }, { palette: 'yellow' }));
  }

  // ================================================================ utilidades
  private openOverlay(alpha = 0.75) {
    this.closeOverlay();
    const W = this.scale.width;
    const H = this.scale.height;
    const shade = this.add.rectangle(0, 0, W, H, 0x02060f, alpha).setOrigin(0).setDepth(8000).setInteractive();
    this.overlay = [shade];
    return this.overlay;
  }

  private closeOverlay() {
    if (!this.overlay.length) return;
    this.overlay.forEach((o) => o.destroy());
    this.overlay = [];
    this.events.emit('overlay-closed');
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
