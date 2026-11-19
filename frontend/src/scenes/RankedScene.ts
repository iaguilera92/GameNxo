import { installTapSound } from '../fx/uiSound';
import Phaser from 'phaser';
import { FONT, restartOnResize } from '../ui/theme';
import { stadiumBg } from '../ui/ui';
import { arcadeButton } from '../ui/modeButtons';
import { fitText } from '../ui/fitText';
import { RankBadge, preloadRankBadges } from '../ui/RankBadge';
import { coinIcon, drawChestIcon, drawGiftIcon } from '../ui/wheelArt';
import { drawCashIcon } from './BattlePassScene';
import { LEAGUE_STYLE, fmtCoins, fmtLeft, fmtNet } from '../ui/leagueStyle';
import { navLigaLabel } from '../ui/navLabel';
import { openLeagueRanking } from '../ui/LeagueRanking';
import { RANKS, type RankId, rankDef } from '../domain/ranks';
import { RANKED, positionPrize } from '../domain/rankedConfig';
import type { BoardEntry } from '../domain/rankedBots';
import type { RankedView } from '../domain/ranked';
import type { WeeklyReward } from '../domain/rankedState';
import { onPlayerChange } from '../domain/playerStore';
import { type RiskActivateError, activateRiskMode, claimWeekly, markRankedSeen, pendingWeekly, rankedState, rankedView, riskModeStatus, syncRanked, syncRiskMode } from '../logic/Ranked';
import { formatRiskLeft } from '../domain/riskMode';
import { showConfirm } from '../ui/ConfirmDialog';

const RISK_ERRORS: Record<RiskActivateError, string> = {
  offline: 'Necesitas conexión para activar el MODO RIESGO',
  not_monday: 'El MODO RIESGO solo se activa los lunes',
  already_used: 'Ya usaste el MODO RIESGO esta semana',
  active: 'El MODO RIESGO ya está activo',
  unknown: 'No se pudo activar el MODO RIESGO',
};

const NAVY = 0x0b1733;
const NEON = 0x3a7bff;
const GOLD = 0xffc42e;
const NAV = {
  key: 'nav-ranking',
  file: 'assets/barra-ranking.webp',
  w: 2172,
  h: 724,
  box: { x0: 46, y0: 170, x1: 2124, y1: 540 },
  split: [0.33, 0.67] as [number, number],
  side: 6,
  bottom: 26,
};

/**
 * Pantalla principal de RANKED (v2, docs/RANKED-V2.md): liga y emblema, NETO de la semana y avance a la meta semanal,
 * posición (y posición de premio), victorias de la semana (x/3), récord, racha, tiempo restante, recompensa estimada y las
 * tabla RANKING LIGA (neto semanal, con bots). El título de la pantalla es LIGA (16-11-2026, pedido del usuario).
 * El RANKING GLOBAL (saldo) NO está aquí: se abre desde el menú principal (ui/GlobalRanking.ts) para no confundirlos.
 * Al entrar muestra (una vez) el ascenso y las recompensas semanales. El saldo global va en la píldora de arriba.
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
    preloadRankBadges(this.load); // todas: tabla de líderes y lista de ligas
    if (!this.textures.exists('liga-title')) this.load.image('liga-title', 'assets/liga-titulo.webp'); // (18-11-2026) título LIGA en imagen
  }

  create() {
    restartOnResize(this);
    installTapSound(this); // clic de interfaz en cada botón / diálogo
    this.cameras.main.fadeIn(200, 0, 0, 0);
    syncRanked();
    void syncRiskMode(); // MODO RIESGO x2: el servidor manda (hora y activación); si cambia algo, onPlayerChange redibuja
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
    // resplandor del color de la liga detrás del emblema

    // ---- cabecera
    const headY = 60;
    const headerStart = this.children.list.length;
    this.backButton(50, headY);
    // título LIGA (antes la imagen "RANKED"; 16-11-2026: los títulos de Ranked pasan a LIGA)
    // (18-11-2026) título en imagen (mismo estilo que TIENDA: liga-titulo.webp, 3:1); sin ella, el texto de antes
    if (this.textures.exists('liga-title')) {
      const titleW = Math.min(250, Math.max(150, W - 250));
      this.add.image(W / 2, headY - 1, 'liga-title').setDisplaySize(titleW, titleW / 3);
    } else this.add.text(W / 2, headY + 2, 'LIGA', { fontFamily: FONT, fontSize: '54px', color: '#ffd23f', stroke: '#0a1638', strokeThickness: 10 }).setOrigin(0.5).setLetterSpacing(6).setShadow(0, 5, '#000000', 6, true, true);
    this.coinPill(W - 24, headY, v.coins); // monedas de la cuenta (arriba a la derecha)
    const headerObjects = this.children.list.slice(headerStart);
    this.add.container(0, 0, headerObjects).setScrollFactor(0);
    const contentStart = this.children.list.length;

    // ---- emblema + liga
    // (21-11-2026) el emblema un poco más arriba (antes 182): más aire con las marcas de la barra
    new RankBadge(this, W / 2, 168 + e1, { rank: v.league, level: 99, size: 168, position: v.league === 'challenger' ? (v.position ?? undefined) : undefined, onOpen: () => this.leagueList() });
    // ---- PROGRESO DE LIGA (21-11-2026, referencia del usuario): una barra alta bajo el emblema. Sobre ella, con una línea punteada, dónde vas
    // (las monedas que llevas esta semana en la liga) y al final la META. Sin el "NETO DE LA SEMANA", el número grande ni la barra fina de antes
    const bw = Math.min(600, W - 60);
    const bx = W / 2 - bw / 2;
    const bh = 40;
    const barY = 340 + e1; // centro de la barra
    {
      const top = barY - bh / 2;
      const prog = v.target == null || v.promoting ? 1 : Phaser.Math.Clamp(v.progress, 0, 1);
      const fillCol = v.promoting ? 0x3ad65a : st.color;
      const fillHi = v.promoting ? 0x8cf59a : st.light;
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.35).fillRoundedRect(bx + 2, top + 5, bw, bh, 12);
      g.fillStyle(0x0d1650, 1).fillRoundedRect(bx, top, bw, bh, 12);
      const fw = prog > 0 ? Math.max(24, bw * prog) : 0;
      if (fw > 0) {
        g.fillStyle(fillCol, 1).fillRoundedRect(bx + 3, top + 3, fw - 6, bh - 6, 9);
        g.fillStyle(fillHi, 0.55).fillRoundedRect(bx + 6, top + 5, Math.max(0, fw - 12), (bh - 6) * 0.32, 6);
      }
      g.lineStyle(3, 0xe8eeff, 1).strokeRoundedRect(bx, top, bw, bh, 12);
      // franjas diagonales en lo lleno (recortadas a su forma)
      if (fw > 0) {
        const stripes = this.add.graphics();
        stripes.fillStyle(0xffffff, 0.16);
        for (let x = -bh; x < fw + bh; x += 22) stripes.fillPoints([{ x: bx + x, y: top + bh }, { x: bx + x + 11, y: top + bh }, { x: bx + x + 11 + bh, y: top }, { x: bx + x + bh, y: top }], true);
        const mg = this.make.graphics({}, false);
        mg.fillStyle(0xffffff).fillRoundedRect(bx + 3, top + 3, fw - 6, bh - 6, 9);
        stripes.setMask(mg.createGeometryMask());
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => mg.destroy());
      }
      // marcas arriba: línea punteada que baja hasta la barra y el número encima
      const lblY = top - 26;
      const mark = (x: number, text: string, color: string, align: number) => {
        const d = this.add.graphics();
        d.lineStyle(3, 0xffffff, 0.9);
        for (let yy = lblY + 12; yy < top + bh - 4; yy += 9) d.lineBetween(x, yy, x, Math.min(yy + 5, top + bh - 4));
        const tx = this.add.text(x, lblY, text, { fontFamily: FONT, fontSize: '24px', color, stroke: '#0a1638', strokeThickness: 5 }).setOrigin(align, 1);
        return tx;
      };
      const net = v.weekNet;
      const curX = bx + Phaser.Math.Clamp(bw * prog, 0, bw);
      // la meta al final (en la liga máxima no hay meta)
      const goal = v.target == null ? null : mark(bx + bw - 3, fmtCoins(v.target), '#ffffff', 1);
      // dónde vas: centrado en su línea, sin salirse de la barra ni pisar la meta (si no cabe, la meta cede)
      // con la moneda a la derecha del número; el conjunto va centrado en su línea
      const cur = mark(curX, fmtCoins(net), net < 0 ? '#ff8174' : '#ffd23f', 0);
      const cr = 11;
      const gw = cur.width + 6 + cr * 2;
      const gx = Phaser.Math.Clamp(curX - gw / 2, bx, bx + bw - gw);
      cur.setX(gx);
      coinIcon(this, gx + cur.width + 6 + cr, lblY - cur.height / 2 + 1, cr); // (17-11-2026) moneda: imagen moneda-1.webp
      if (goal && gx + gw > goal.x - goal.width - 10) goal.setVisible(false);
    }

    // FIN DE TEMPORADA: debajo de la barra (cápsula oscura con borde del color de la liga, reloj y el tiempo destacado)
    const by = 404 + e1; // centro de la cápsula (las placas de abajo se colocan desde aquí)
    {
      const cy = by;
      const ph = 34;
      const lbl = this.add.text(0, cy, 'FIN DE TEMPORADA', { fontFamily: FONT, fontSize: '13px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 3 }).setOrigin(0, 0.5).setLetterSpacing(1.5);
      const val = this.add.text(0, cy, fmtLeft(v.msLeft), { fontFamily: FONT, fontSize: '19px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 4 }).setOrigin(0, 0.5).setLetterSpacing(0.5);
      const seg = ph; // segmento cuadrado del reloj
      const pw = seg + 12 + lbl.width + 10 + 2 + 10 + val.width + 16;
      const x0 = W / 2 - pw / 2;
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.35).fillRoundedRect(x0 + 2, cy - ph / 2 + 4, pw, ph, ph / 2);
      // (21-11-2026) toda la cápsula con fondo del color de la liga (antes oscura con solo el segmento del reloj de color); el reloj, un tono más oscuro
      g.fillStyle(st.color, 1).fillRoundedRect(x0, cy - ph / 2, pw, ph, ph / 2);
      g.fillStyle(0xffffff, 0.22).fillRoundedRect(x0 + 8, cy - ph / 2 + 3, pw - 16, ph * 0.3, ph * 0.15);
      // (21-11-2026) el reloj sobre el MISMO fondo que el resto de la cápsula (sin tramo más oscuro)
      g.lineStyle(2, st.light, 1).strokeRoundedRect(x0, cy - ph / 2, pw, ph, ph / 2);
      const cx = x0 + seg / 2 + 1;
      g.lineStyle(2.4, 0xffffff, 1).strokeCircle(cx, cy, 8).lineBetween(cx, cy, cx, cy - 5).lineBetween(cx, cy, cx + 4, cy + 1);
      lbl.setX(x0 + seg + 12);
      const sx = lbl.x + lbl.width + 10;
      g.fillStyle(st.dark, 0.7).fillRect(sx, cy - 9, 2, 18);
      val.setX(sx + 2 + 10);
      this.children.bringToTop(lbl);
      this.children.bringToTop(val);
    }
    // ---- estadísticas: 3 placas (POSICIÓN · RÉCORD · RACHA). La de SEMANA se quitó: su avance ya está en la
    // recompensa semanal de abajo (13-11-2026). Formato propio: placa inclinada con medallón del icono sobre el borde
    // superior, cifra grande, etiqueta y una píldora con el detalle.
    // (11-11-2026) separación uniforme entre bloques: GAP desde la barra de progreso, los cuadros, la recompensa semanal,
    // el panel de líderes y los paneles de abajo (antes, posiciones fijas sueltas con huecos distintos)
    const GAP = 22;
    // (13-11-2026) MISMA separación (GAP) entre todas las secciones: barra → placas (contando el medallón que sobresale
    // 21 px), placas → recompensa semanal → líderes → paneles de abajo. El alto extra de pantallas altas queda al final.
    const sy = by + 17 + GAP + 21 + 54 - 6;
    const TGAP = 16;
    const tw = (Math.min(640, W - 60) - 2 * TGAP) / 3;
    const topPos = v.position != null && v.position <= 10;
    // tramo de premio (posición de premio: solo entre reales con servidor, D7)
    const prizeLbl = positionPrize(v.prizePosition)?.label ?? null;
    const prizeSub = prizeLbl ? (v.prizePosition !== v.position ? `PREMIO #${v.prizePosition} · ${prizeLbl}` : prizeLbl) : `DE ${v.board.length}`;
    const tiles: { label: string; value: string; sub: string; accent: number; icon: StatIcon; hot: boolean }[] = [
      { label: 'POSICIÓN', value: v.position ? `#${v.position}` : '—', sub: prizeSub, accent: topPos ? GOLD : 0x3a7bff, icon: 'trophy', hot: topPos },
      { label: 'SEMANA', value: `${v.weekWins}-${v.weekLosses}`, sub: `${pct(v.weekWins, v.weekLosses)} VICT.`, accent: 0x37e0ff, icon: 'chart', hot: false },
      { label: 'RACHA', value: `${v.season.streak}`, sub: `MEJOR ${v.total.bestStreak}`, accent: 0xff8a3d, icon: 'flame', hot: v.season.streak >= 3 },
    ];
    tiles.forEach((t, i) => {
      const x = W / 2 + (i - 1) * (tw + TGAP);
      const th = 108;
      const top = sy - th / 2 + 6;
      const k = 10; // inclinación de los lados
      const L = x - tw / 2;
      const R = x + tw / 2;
      const shape = (g: number) => [
        { x: L + k - g, y: top - g },
        { x: R + g, y: top - g },
        { x: R - k + g, y: top + th + g },
        { x: L - g, y: top + th + g },
      ];
      const tg = this.add.graphics();
      tg.fillStyle(0x000000, 0.4).fillPoints(shape(0).map((p) => ({ x: p.x + 3, y: p.y + 6 })), true);
      tg.fillStyle(0x0a1638, 1).fillPoints(shape(3), true);
      // cuerpo: oscuro arriba y teñido del color abajo (degradado en dos capas)
      tg.fillStyle(0x0d1a3a, 1).fillPoints(shape(0), true);
      const mid = top + th * 0.55;
      tg.fillStyle(t.accent, 0.2).fillPoints([{ x: L + k * (1 - (mid - top) / th), y: mid }, { x: R - k * ((mid - top) / th), y: mid }, { x: R - k, y: top + th }, { x: L, y: top + th }], true);
      // franja de color abajo y brillo arriba
      tg.fillStyle(t.accent, 1).fillPoints([{ x: L + 1.2, y: top + th - 6 }, { x: R - k + 1.2, y: top + th - 6 }, { x: R - k, y: top + th }, { x: L, y: top + th }], true);
      tg.fillStyle(0xffffff, 0.08).fillPoints([{ x: L + k, y: top }, { x: R, y: top }, { x: R - 2, y: top + 14 }, { x: L + k - 2, y: top + 14 }], true);
      tg.lineStyle(2, t.accent, t.hot ? 1 : 0.6).strokePoints(shape(0), true, true);
      if (t.hot) {
        // destacado (top 10, racha ≥ 3): halo dorado que respira
        const halo = this.add.graphics();
        halo.lineStyle(8, GOLD, 0.35).strokePoints(shape(2), true, true);
        this.tweens.add({ targets: halo, alpha: { from: 1, to: 0.35 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
      // medallón del icono montado sobre el borde superior
      const ic = this.add.graphics({ x, y: top });
      ic.fillStyle(0x0a1638, 1).fillCircle(0, 0, 21);
      ic.fillStyle(t.accent, 1).fillCircle(0, 0, 17);
      ic.fillStyle(0xffffff, 0.25).fillCircle(-5, -6, 6);
      drawStatIcon(ic, t.icon);
      const vt = this.add.text(x, top + 44, t.value, { fontFamily: FONT, fontSize: '34px', color: t.hot ? '#ffd23f' : '#ffffff', stroke: '#0a1638', strokeThickness: 5 }).setOrigin(0.5);
      fitText(vt, tw - 22);
      this.add.text(x, top + 70, t.label, { fontFamily: FONT, fontSize: '12px', color: '#9fb4e0' }).setOrigin(0.5).setLetterSpacing(2);
      // detalle en una píldora
      const stt = this.add.text(x, top + 88, t.sub, { fontFamily: FONT, fontSize: '12px', color: t.hot ? '#1a1200' : '#ffffff' }).setOrigin(0.5);
      fitText(stt, tw - 34);
      const pw = Math.min(tw - 24, stt.displayWidth + 18);
      const pill = this.add.graphics();
      pill.fillStyle(t.hot ? GOLD : t.accent, t.hot ? 1 : 0.35).fillRoundedRect(x - pw / 2, top + 80, pw, 17, 8.5);
      this.children.bringToTop(stt);
    });

    // ---- recompensa semanal estimada (13-11-2026, rediseño): cinta de título arriba, cofre en medallón con rayos de luz,
    // progreso con un punto por partida y el premio en fichas que se ajustan a su contenido (antes el cuadro tenía un ancho
    // fijo y la moneda o el rayo se salían)
    const rh = 132;
    const ry = sy + 60 + GAP + rh / 2; // las placas terminan en sy + 60
    const rw = Math.min(640, W - 60);
    const rx0 = W / 2 - rw / 2;
    const rTop = ry - rh / 2;
    const elig = v.estimate.eligible;
    const goldLine = elig ? GOLD : 0x8a7130;
    const rg = this.add.graphics();
    rg.fillStyle(0x000000, 0.35).fillRoundedRect(rx0 + 3, rTop + 6, rw, rh, 20);
    rg.fillStyle(0x1d1708, 0.97).fillRoundedRect(rx0, rTop, rw, rh, 20);
    // cinta de título (franja dorada arriba)
    const ribbonH = 32;
    rg.fillStyle(elig ? 0xb37400 : 0x5a4512, 1).fillRoundedRect(rx0, rTop, rw, ribbonH, { tl: 20, tr: 20, bl: 0, br: 0 });
    rg.fillStyle(0xffd23f, elig ? 0.35 : 0.15).fillRoundedRect(rx0 + 4, rTop + 3, rw - 8, ribbonH * 0.45, { tl: 17, tr: 17, bl: 4, br: 4 });
    rg.lineStyle(3, goldLine, 1).strokeRoundedRect(rx0, rTop, rw, rh, 20);
    rg.lineStyle(2, goldLine, 0.8).lineBetween(rx0 + 2, rTop + ribbonH, rx0 + rw - 2, rTop + ribbonH);
    const weeklyTitle = this.add.text(rx0 + 18, rTop + ribbonH / 2, `RECOMPENSA SEMANAL · ${rankDef(v.league).name.toUpperCase()}`, { fontFamily: FONT, fontSize: '16px', color: '#ffffff', stroke: '#4a2c00', strokeThickness: 4 }).setOrigin(0, 0.5).setLetterSpacing(1);
    const stTxt = this.add.text(rx0 + rw - 16, rTop + ribbonH / 2, elig ? '¡LISTA!' : 'EN CURSO', { fontFamily: FONT, fontSize: '14px', color: elig ? '#fff4b0' : '#d9c48a' }).setOrigin(1, 0.5).setLetterSpacing(1);
    fitText(weeklyTitle, rw - 40 - stTxt.width);

    // cuerpo: cofre (izquierda) · texto y progreso (centro) · premio (derecha)
    const bodyY = rTop + ribbonH + (rh - ribbonH) / 2;
    const cx0 = rx0 + 50;
    if (elig) {
      // rayos de luz girando detrás del cofre
      const rays = this.add.graphics({ x: cx0, y: bodyY });
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        rays.fillStyle(GOLD, 0.22).fillTriangle(0, 0, Math.cos(a - 0.16) * 46, Math.sin(a - 0.16) * 46, Math.cos(a + 0.16) * 46, Math.sin(a + 0.16) * 46);
      }
      this.tweens.add({ targets: rays, angle: 360, duration: 9000, repeat: -1 });
    }
    const med = this.add.graphics({ x: cx0, y: bodyY });
    med.fillStyle(0x07152f, 1).fillCircle(0, 0, 33);
    med.fillStyle(elig ? 0x5a3a00 : 0x2c2410, 1).fillCircle(0, 0, 30);
    med.lineStyle(2.5, goldLine, 1).strokeCircle(0, 0, 30);
    const chest = this.add.graphics({ x: cx0, y: bodyY + 2 });
    drawChestIcon(chest, 24, 0, 0);
    if (!elig) chest.setAlpha(0.75);
    if (elig) this.tweens.add({ targets: chest, angle: { from: -3, to: 3 }, duration: 220, yoyo: true, repeat: -1, repeatDelay: 1800 });

    // premio: fichas [icono + cifra] medidas antes de dibujar; el cuadro se ajusta a ellas (nada se sale)
    const items: { kind: 'coin' | 'cash' | 'rays'; text: string; color: string }[] = [{ kind: 'coin', text: fmtCoins(v.estimate.coins), color: '#ffd23f' }];
    if (v.estimate.cash > 0) items.push({ kind: 'cash', text: `${v.estimate.cash}`, color: '#9fe8a0' });
    if (v.estimate.rays > 0) items.push({ kind: 'rays', text: `+${v.estimate.rays}`, color: '#66e8ff' });
    const maxPrizeW = rw * 0.46;
    let fs = 22;
    const chipOf = (it: (typeof items)[number], size: number) => {
      const tt = this.add.text(0, 0, it.text, { fontFamily: FONT, fontSize: `${size}px`, color: elig ? it.color : '#a99a6c' }).setOrigin(0, 0.5);
      return { it, tt, w: 10 + 22 + 6 + tt.width + 10 };
    };
    let chips = items.map((it) => chipOf(it, fs));
    const totalW = () => chips.reduce((s, c) => s + c.w, 0) + (chips.length - 1) * 6 + 12;
    while (totalW() > maxPrizeW && fs > 15) {
      chips.forEach((c) => c.tt.destroy());
      fs -= 1;
      chips = items.map((it) => chipOf(it, fs));
    }
    const prizeW = totalW();
    const prizeX = rx0 + rw - 12 - prizeW;
    const prizeH = 50;
    rg.fillStyle(0x080f27, 0.95).fillRoundedRect(prizeX, bodyY - prizeH / 2, prizeW, prizeH, 16);
    rg.lineStyle(2, goldLine, 0.9).strokeRoundedRect(prizeX, bodyY - prizeH / 2, prizeW, prizeH, 16);
    this.add.text(prizeX + prizeW / 2, bodyY - prizeH / 2 - 9, 'PREMIO ESTIMADO', { fontFamily: FONT, fontSize: '11px', color: '#c9b98a' }).setOrigin(0.5).setLetterSpacing(1);
    let cxp = prizeX + 6;
    for (const c of chips) {
      rg.fillStyle(elig ? 0x2a1c00 : 0x1e1a10, 1).fillRoundedRect(cxp, bodyY - 17, c.w, 34, 12);
      // (17-11-2026) moneda: imagen moneda-1.webp
      let ic: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;
      if (c.it.kind === 'coin') ic = coinIcon(this, cxp + 10 + 11, bodyY, 11);
      else {
        const icg = this.add.graphics({ x: cxp + 10 + 11, y: bodyY });
        if (c.it.kind === 'cash') drawCashIcon(icg, 0.55);
        else icg.fillStyle(0x46dfff, 1).fillPoints([{ x: 2, y: -11 }, { x: 10, y: -11 }, { x: 5, y: -2 }, { x: 11, y: -2 }, { x: -1, y: 12 }, { x: 3, y: 2 }, { x: -3, y: 2 }], true);
        ic = icg;
      }
      if (!elig) ic.setAlpha(0.55);
      c.tt.setPosition(cxp + 10 + 22 + 6, bodyY);
      this.children.bringToTop(c.tt);
      cxp += c.w + 6;
    }

    // texto y progreso: un punto por partida, unidos por una línea; los completados con ✓
    const tx = cx0 + 46;
    const textW = Math.max(80, prizeX - tx - 14);
    const left = v.minWins - v.weekWins;
    const estSub = elig ? `¡Meta cumplida! Se cobra el domingo${v.estimate.label ? ` · ${v.estimate.label}` : ''}` : `Gana ${left} partida${left === 1 ? '' : 's'} más y se cobra el domingo`;
    const est = this.add.text(tx, bodyY - 18, estSub, { fontFamily: FONT, fontSize: '14px', color: '#f2e7c1' }).setOrigin(0, 0.5);
    fitText(est, textW);
    const segments = Math.max(1, v.minWins);
    const dotR = 11;
    const pgY = bodyY + 18;
    const span = Math.max(0, Math.min(textW - 70, (segments - 1) * 40));
    const step = segments > 1 ? span / (segments - 1) : 0;
    const pg = this.add.graphics();
    pg.lineStyle(4, 0x39404c, 1).lineBetween(tx + dotR, pgY, tx + dotR + span, pgY);
    const done = Math.min(v.weekWins, segments);
    if (done > 1) pg.lineStyle(4, 0x52e432, 1).lineBetween(tx + dotR, pgY, tx + dotR + step * (done - 1), pgY);
    for (let i = 0; i < segments; i++) {
      const dx = tx + dotR + i * step;
      const ok = i < v.weekWins;
      pg.fillStyle(0x07152f, 1).fillCircle(dx, pgY, dotR + 2);
      pg.fillStyle(ok ? 0x52e432 : 0x39404c, 1).fillCircle(dx, pgY, dotR);
      if (ok) pg.lineStyle(3, 0xffffff, 1).beginPath().moveTo(dx - 5, pgY).lineTo(dx - 1, pgY + 4).lineTo(dx + 5, pgY - 4).strokePath();
      else this.add.text(dx, pgY, `${i + 1}`, { fontFamily: FONT, fontSize: '12px', color: '#9aa3b3' }).setOrigin(0.5);
    }
    this.add.text(tx + dotR * 2 + span + 8, pgY, `${Math.min(v.weekWins, v.minWins)}/${v.minWins}`, { fontFamily: FONT, fontSize: '14px', color: '#ffffff' }).setOrigin(0, 0.5);

    // ---- líderes de la liga: podio, puestos siguientes y tabla completa
    // panel: la etiqueta del título va montada sobre su borde de arriba (centro en `panelTop`)
    const TAG_H = 34;
    // ---- MODO RIESGO x2 (evento de los lunes, domain/riskMode.ts): tarjeta entre la recompensa semanal y los líderes
    const riskH = this.riskCard(W / 2, ry + rh / 2 + GAP, rw);
    const panelTop = ry + rh / 2 + GAP + riskH + GAP + TAG_H / 2;
    const podiumW = Math.min(660, W - 40);
    const podiumPanel = this.add.graphics();
    // LÍDERES (13-11-2026, estilo de la referencia): top 3 en cards pegadas (el 1.º al centro y más alto), insignia
    // cuadrada con el número, y debajo filas del 4.º, 5.º y la tuya (seleccionada)
    const colGap = 6;
    const colW = (podiumW - 36 - colGap * 2) / 3;
    const podCardH = 148;
    const podiumTop = panelTop + TAG_H / 2 + 18;
    const podiumBottom = podiumTop + podCardH + 22;
    const rowH3 = 50;
    const rowGap3 = 8;
    const rowsTop = podiumBottom + 14;
    const top100Y = rowsTop + 3 * rowH3 + 2 * rowGap3 + 18 + 23;
    const leadersH = top100Y + 23 + 16 - panelTop;
    podiumPanel.fillStyle(0x061433, 0.94).fillRoundedRect(W / 2 - podiumW / 2, panelTop, podiumW, leadersH, 24);
    podiumPanel.lineStyle(10, NEON, 0.16).strokeRoundedRect(W / 2 - podiumW / 2, panelTop, podiumW, leadersH, 24);
    podiumPanel.lineStyle(3, 0x1754ad, 0.98).strokeRoundedRect(W / 2 - podiumW / 2, panelTop, podiumW, leadersH, 24);
    // etiqueta del título AJUSTADA al texto (antes casi todo el ancho de la pantalla): trofeo + "LÍDERES DE LA LIGA"
    const classificationTitle = this.add.text(0, panelTop, 'LÍDERES DE LA LIGA', { fontFamily: FONT, fontSize: '17px', color: '#ffffff' }).setOrigin(0, 0.5).setLetterSpacing(0.3);
    const tagW = Math.min(W - 56, 22 + 10 + classificationTitle.width + 36);
    const tagX = W / 2 - tagW / 2;
    const weeklyTag = this.add.graphics();
    weeklyTag.fillStyle(0x061b42, 1).fillRoundedRect(tagX, panelTop - TAG_H / 2, tagW, TAG_H, TAG_H / 2);
    weeklyTag.lineStyle(2, NEON, 1).strokeRoundedRect(tagX, panelTop - TAG_H / 2, tagW, TAG_H, TAG_H / 2);
    const trophy = this.add.graphics({ x: tagX + 18 + 11, y: panelTop });
    trophy.fillStyle(GOLD, 1);
    drawStatIcon(trophy, 'trophy');
    classificationTitle.setX(tagX + 18 + 22 + 10);
    // el texto se midió antes de dibujar la etiqueta: se pasa al frente (luego todo va a un contenedor, donde manda el orden)
    this.children.bringToTop(classificationTitle);
    const topThree = v.board.slice(0, 3);
    const medalColors = [GOLD, 0xc0c8d8, 0xd88a4a];
    const slotOf = [1, 0, 2]; // columna de cada puesto: 1.º al centro, 2.º a la izquierda, 3.º a la derecha
    // avatar dibujado (círculo del color del jugador con silueta), con aro del color indicado
    const drawAvatar = (x: number, y: number, r: number, e: BoardEntry, ring: number) => {
      const av = this.add.graphics({ x, y });
      av.fillStyle(0x07152f, 1).fillCircle(0, 0, r + 4);
      av.fillStyle(ring, 1).fillCircle(0, 0, r + 2);
      av.fillStyle(e.avatar.color, 1).fillCircle(0, 0, r - 1);
      av.fillStyle(0x0a1638, 0.85).fillCircle(0, -r * 0.2, r * 0.32);
      av.fillRoundedRect(-r * 0.5, r * 0.18, r, r * 0.45, { tl: r * 0.4, tr: r * 0.4, bl: 2, br: 2 });
      return av;
    };
    // insignia cuadrada con el número (estilo de la referencia)
    const numBadge = (x: number, y: number, s: number, n: number, fill: number, txt = '#07152f') => {
      const b = this.add.graphics();
      b.fillStyle(0x07152f, 1).fillRoundedRect(x - s / 2 - 2, y - s / 2 - 2, s + 4, s + 4, 7);
      b.fillStyle(fill, 1).fillRoundedRect(x - s / 2, y - s / 2, s, s, 6);
      b.fillStyle(0xffffff, 0.3).fillRoundedRect(x - s / 2 + 3, y - s / 2 + 3, s - 6, s * 0.3, 4);
      this.add.text(x, y + 1, `${n}`, { fontFamily: FONT, fontSize: `${Math.round(s * 0.62)}px`, color: txt }).setOrigin(0.5);
    };
    // TOP 3: tres cards pegadas; la del 1.º más alta (sobresale hacia arriba), las tres con la base alineada
    topThree.forEach((entry, i) => {
      const slot = slotOf[i];
      const x = W / 2 + (slot - 1) * (colW + colGap);
      const ch = i === 0 ? podCardH + 22 : podCardH;
      const top = podiumBottom - ch;
      const me = entry.id === 'me';
      const color = medalColors[i];
      const cg = this.add.graphics();
      cg.fillStyle(0x000000, 0.3).fillRoundedRect(x - colW / 2 + 2, top + 4, colW, ch, 14);
      cg.fillStyle(i === 0 ? 0x162a5c : 0x10224b, 1).fillRoundedRect(x - colW / 2, top, colW, ch, 14);
      cg.fillStyle(color, 0.1).fillRoundedRect(x - colW / 2, top, colW, ch * 0.45, { tl: 14, tr: 14, bl: 0, br: 0 });
      cg.lineStyle(me ? 3 : 2, me ? GOLD : i === 0 ? GOLD : 0x2a4a8a, me || i === 0 ? 1 : 0.9).strokeRoundedRect(x - colW / 2, top, colW, ch, 14);
      numBadge(x, top + 26, i === 0 ? 34 : 28, i + 1, color);
      const r = i === 0 ? 26 : 22;
      const ay = top + (i === 0 ? 80 : 70);
      if (i === 0) {
        // AURA del líder: rayos dorados girando detrás del avatar + destellos
        const rays = this.add.graphics({ x, y: ay }).setBlendMode(Phaser.BlendModes.ADD);
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2;
          const len = k % 2 ? 44 : 54;
          rays.fillStyle(GOLD, k % 2 ? 0.16 : 0.28).fillTriangle(0, 0, Math.cos(a - 0.1) * len, Math.sin(a - 0.1) * len, Math.cos(a + 0.1) * len, Math.sin(a + 0.1) * len);
        }
        this.tweens.add({ targets: rays, angle: 360, duration: 12000, repeat: -1 });
        this.tweens.add({ targets: rays, alpha: { from: 1, to: 0.55 }, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
      drawAvatar(x, ay, r, entry, color);
      const nm = this.add.text(x, podiumBottom - 40, me ? 'TÚ' : entry.name, { fontFamily: FONT, fontSize: i === 0 ? '18px' : '16px', color: me ? '#ffd23f' : '#ffffff' }).setOrigin(0.5);
      fitText(nm, colW - 12);
      const coins = this.add.text(0, podiumBottom - 18, fmtNet(entry.coins), { fontFamily: FONT, fontSize: i === 0 ? '20px' : '17px', color: '#ffd23f' }).setOrigin(0, 0.5);
      const coinsW = coins.width + 24;
      coinIcon(this, x - coinsW / 2 + 9, podiumBottom - 18, 8); // (17-11-2026) moneda: imagen moneda-1.webp
      coins.setX(x - coinsW / 2 + 22);
    });
    // FILAS: 4.º, 5.º y la tuya (seleccionada). Si estás en el top 5, la 6.ª; si estás en el top 3, tu card ya se resalta
    const meEntry = v.board.find((e) => e.id === 'me');
    const rowsList: BoardEntry[] = [v.board[3], v.board[4]].filter((e): e is BoardEntry => !!e);
    if (meEntry && meEntry.position > 5) rowsList.push(meEntry);
    else if (v.board[5]) rowsList.push(v.board[5]);
    const rw3 = colW * 3 + colGap * 2;
    rowsList.forEach((entry, k) => {
      const yy = rowsTop + k * (rowH3 + rowGap3) + rowH3 / 2;
      const me = entry.id === 'me';
      const L = W / 2 - rw3 / 2;
      const rgx = this.add.graphics();
      if (me) {
        // SELECCIONADA: halo dorado que respira
        const halo = this.add.graphics();
        halo.lineStyle(8, GOLD, 0.3).strokeRoundedRect(L - 2, yy - rowH3 / 2 - 2, rw3 + 4, rowH3 + 4, 14);
        this.tweens.add({ targets: halo, alpha: { from: 1, to: 0.35 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
      rgx.fillStyle(me ? 0x3a2a08 : 0x10224b, 1).fillRoundedRect(L, yy - rowH3 / 2, rw3, rowH3, 12);
      rgx.lineStyle(me ? 2.5 : 1.5, me ? GOLD : 0x2a4a8a, 1).strokeRoundedRect(L, yy - rowH3 / 2, rw3, rowH3, 12);
      const bs = rowH3 - 12;
      numBadge(L + 8 + bs / 2, yy, bs, entry.position, me ? GOLD : NEON, me ? '#07152f' : '#ffffff');
      drawAvatar(L + 8 + bs + 12 + 17, yy, 15, entry, me ? GOLD : 0x2a4a8a);
      const nx = L + 8 + bs + 12 + 34 + 12;
      const nm = this.add.text(nx, yy, me ? `${entry.name} (TÚ)` : entry.name, { fontFamily: FONT, fontSize: '17px', color: me ? '#ffd23f' : '#ffffff' }).setOrigin(0, 0.5);
      fitText(nm, rw3 * 0.5);
      const ct = this.add.text(L + rw3 - 14, yy, fmtNet(entry.coins), { fontFamily: FONT, fontSize: '19px', color: '#ffd23f' }).setOrigin(1, 0.5);
      coinIcon(this, L + rw3 - 14 - ct.width - 13, yy, 9); // (17-11-2026) moneda: imagen moneda-1.webp
    });
    arcadeButton(this, W / 2, top100Y, Math.min(480, W - 80), 46, 'VER TOP 100', () => this.leaderboard(), { palette: 'blue' });

    // ---- paneles inferiores: historial y premios por posición
    const panelsTop = panelTop + leadersH + GAP;
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

  /**
   * MODO RIESGO x2: nombre, estado (disponible · cuenta regresiva · terminado · solo lunes) y botón ACTIVAR.
   * El tiempo se calcula con la hora de activación del servidor: cerrar la pantalla o el juego no lo pausa.
   * Devuelve el alto de la tarjeta.
   */
  private riskCard(cx: number, top: number, w: number): number {
    const rs = riskModeStatus();
    const h = 92;
    const x0 = cx - w / 2;
    const cy = top + h / 2;
    const active = rs.phase === 'active';
    const avail = rs.phase === 'available';
    const line = active ? 0xff5a2e : avail ? 0xffa42e : 0x5a3a2a;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.35).fillRoundedRect(x0 + 3, top + 6, w, h, 20);
    g.fillStyle(active ? 0x3a0d06 : 0x1f0f0a, 0.97).fillRoundedRect(x0, top, w, h, 20);
    g.fillStyle(0xff7a2e, active ? 0.22 : 0.08).fillRoundedRect(x0 + 4, top + 4, w - 8, h * 0.4, 16);
    g.lineStyle(3, line, 1).strokeRoundedRect(x0, top, w, h, 20);
    if (active) {
      const halo = this.add.graphics();
      halo.lineStyle(8, 0xff5a2e, 0.35).strokeRoundedRect(x0 - 2, top - 2, w + 4, h + 4, 22);
      this.tweens.add({ targets: halo, alpha: { from: 1, to: 0.3 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    // medallón x2
    const mx = x0 + 48;
    const med = this.add.graphics({ x: mx, y: cy });
    med.fillStyle(0x07152f, 1).fillCircle(0, 0, 32);
    med.fillStyle(active || avail ? 0xd8361e : 0x4a2a20, 1).fillCircle(0, 0, 29);
    med.fillStyle(0xffffff, 0.22).fillCircle(-8, -9, 10);
    med.lineStyle(2.5, active || avail ? 0xffd23f : 0x8a6a50, 1).strokeCircle(0, 0, 29);
    const x2 = this.add.text(mx, cy + 1, 'x2', { fontFamily: FONT, fontSize: '30px', color: active || avail ? '#ffffff' : '#b7a090', stroke: '#4a0d00', strokeThickness: 5 }).setOrigin(0.5);
    if (active) this.tweens.add({ targets: [med, x2], scale: { from: 1, to: 1.08 }, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // textos
    const tx = mx + 46;
    const btnW = 150;
    const textW = w - (tx - x0) - (avail ? btnW + 26 : 18);
    const title = this.add.text(tx, cy - 20, 'MODO RIESGO x2', { fontFamily: FONT, fontSize: '22px', color: active ? '#ffb347' : '#ffd23f', stroke: '#2a0a00', strokeThickness: 5 }).setOrigin(0, 0.5).setLetterSpacing(1);
    fitText(title, textW);
    const sub =
      active ? 'APUESTAS RANKED x2 · QUEDAN' : avail ? '¡DISPONIBLE HOY! Apuestas Ranked x2 por 10 min' : rs.phase === 'used' ? 'TERMINADO · vuelve el próximo lunes' : 'Solo los LUNES · una vez por semana';
    const st = this.add.text(tx, cy + 14, sub, { fontFamily: FONT, fontSize: '15px', color: active ? '#ffffff' : avail ? '#ffe0b0' : '#b7a090' }).setOrigin(0, 0.5);
    fitText(st, active ? textW - 90 : textW);
    if (active) {
      // cuenta regresiva (cada segundo, con la hora real: al volver muestra lo que de verdad queda)
      const clock = this.add.text(tx + st.displayWidth + 10, cy + 14, formatRiskLeft(rs.msLeft), { fontFamily: FONT, fontSize: '24px', color: '#ffd23f', stroke: '#2a0a00', strokeThickness: 5 }).setOrigin(0, 0.5);
      const ev = this.time.addEvent({
        delay: 1000,
        loop: true,
        callback: () => {
          if (!clock.active) return void ev.remove();
          const now = riskModeStatus();
          if (now.phase !== 'active') {
            ev.remove();
            if (this.overlay.length === 0) this.rebuild(); // se apagó solo
            return;
          }
          clock.setText(formatRiskLeft(now.msLeft));
        },
      });
    }
    if (avail) {
      arcadeButton(this, x0 + w - 14 - btnW / 2, cy, btnW, 52, 'ACTIVAR', () => this.confirmRisk(), { palette: 'red', pulse: true });
    }
    return h;
  }

  /** Confirmación (una sola vez por semana) y activación en el servidor. */
  private confirmRisk() {
    if (this.overlay.length) return;
    const objs = showConfirm(this, {
      title: 'MODO RIESGO x2',
      message: 'Durante 10 minutos tus apuestas Ranked descuentan y pagan el DOBLE.',
      detail: 'El tiempo corre aunque salgas del juego. Solo una vez por semana.',
      confirmLabel: 'ACTIVAR',
      cancelLabel: 'AHORA NO',
      onConfirm: () => {
        close();
        void activateRiskMode().then((r) => {
          if (!this.scene.isActive()) return;
          this.rebuild();
          if (r.ok) this.toast('¡MODO RIESGO x2 ACTIVO!');
          else this.toast(RISK_ERRORS[r.error]);
        });
      },
      onCancel: () => close(),
    });
    const close = () => {
      objs.forEach((o) => o.destroy());
      this.overlay = [];
    };
    this.overlay = objs;
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
      this.add.text(x, y + 103, 'Juega partidas de Liga para ver tus resultados', { fontFamily: FONT, fontSize: '14px', color: '#9fb4e0', align: 'center', wordWrap: { width: w - 32 } }).setOrigin(0.5);
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
      // 4 tramos (v2): filas más bajas para que quepan sobre el botón
      const rowY = y + 60 + i * 24;
      const row = this.add.graphics();
      row.fillStyle(0x191405, 0.98).fillRoundedRect(left + 12, rowY - 11, w - 24, 22, 11);
      row.lineStyle(1.5, 0x927322, 0.95).strokeRoundedRect(left + 12, rowY - 11, w - 24, 22, 11);
      row.fillStyle(i === 0 ? 0xa96800 : 0x4b4635, 1).fillRoundedRect(left + 16, rowY - 9, 80, 18, 9);
      const lb = this.add.text(left + 56, rowY, prize.label, { fontFamily: FONT, fontSize: '12px', color: '#ffffff' }).setOrigin(0.5);
      fitText(lb, 74);
      const cash = prize.cash > 0 ? ` · ${prize.cash} dinero` : '';
      const value = this.add.text(left + 104, rowY, `+${fmtCoins(prize.coins)}${cash}`, { fontFamily: FONT, fontSize: '13px', color: '#ffe15b' }).setOrigin(0, 0.5);
      fitText(value, w - 124);
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
    p.add(this.add.text(0, 42, 'HISTORIAL DE LIGA', { fontFamily: FONT, fontSize: '30px', color: '#ffffff' }).setOrigin(0.5).setLetterSpacing(1));
    p.add(this.add.text(0, 75, 'Tus últimas partidas completadas', { fontFamily: FONT, fontSize: '15px', color: '#9fb4e0' }).setOrigin(0.5));
    const entries = v.history.slice(0, 12);
    if (!entries.length) {
      p.add(this.add.text(0, 150, 'Aún no tienes partidas de Liga registradas.', { fontFamily: FONT, fontSize: '18px', color: '#dbe5ff', align: 'center', wordWrap: { width: pw - 50 } }).setOrigin(0.5));
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
    const ph = 540;
    const p = this.add.container(W / 2, (H - ph) / 2).setDepth(8001);
    objs.push(p);
    p.add(this.add.rectangle(0, ph / 2, pw, ph, 0, 0.001).setInteractive());
    const g = this.add.graphics();
    g.fillStyle(0x211704, 0.99).fillRoundedRect(-pw / 2, 0, pw, ph, 24);
    g.lineStyle(3, GOLD, 1).strokeRoundedRect(-pw / 2, 0, pw, ph, 24);
    p.add(g);
    p.add(this.add.text(0, 42, 'PREMIOS EXTRA DE LA SEMANA', { fontFamily: FONT, fontSize: '27px', color: '#ffe15b' }).setOrigin(0.5));
    p.add(this.add.text(0, 78, 'Se suman a la recompensa de tu liga al cerrar la semana. Los bots no reciben premios.', { fontFamily: FONT, fontSize: '15px', color: '#f1dfab', align: 'center', wordWrap: { width: pw - 60 } }).setOrigin(0.5));
    RANKED.positionPrizes.forEach((prize, i) => {
      const y = 142 + i * 70;
      const row = this.add.graphics();
      row.fillStyle(0x191405, 1).fillRoundedRect(-pw / 2 + 24, y - 26, pw - 48, 56, 16);
      row.lineStyle(2, i === 0 ? GOLD : 0x8d773b, 1).strokeRoundedRect(-pw / 2 + 24, y - 26, pw - 48, 56, 16);
      p.add(row);
      p.add(this.add.text(-pw / 2 + 48, y + 1, prize.label, { fontFamily: FONT, fontSize: '20px', color: i === 0 ? '#ffd23f' : '#ffffff' }).setOrigin(0, 0.5));
      p.add(this.add.text(pw / 2 - 48, y + 1, `${fmtCoins(prize.coins)} monedas${prize.cash ? ` · ${prize.cash} dinero` : ''}`, { fontFamily: FONT, fontSize: '17px', color: '#ffe15b' }).setOrigin(1, 0.5));
    });
    p.add(this.add.text(0, 142 + RANKED.positionPrizes.length * 70 - 10, `Gana ${RANKED.minWinsForReward} partidas de Liga en la semana para optar a estos premios.`, { fontFamily: FONT, fontSize: '15px', color: '#f1dfab', align: 'center', wordWrap: { width: pw - 60 } }).setOrigin(0.5));
    p.add(arcadeButton(this, 0, ph - 42, Math.min(300, pw - 60), 54, 'CERRAR', () => this.closeOverlay(), { palette: 'yellow' }));
  }

  // ================================================================ tabla Top 100
  /**
   * Tabla Top 100 del RANKING LIGA (neto de la semana, con bots). El Global se abre desde el menú. La ventana es ui/LeagueRanking.ts (la misma
   * que abre la card de liga del MENÚ); aquí va sobre el overlay de la pantalla (que resetea el desplazamiento y rehace la pantalla al cerrar).
   */
  private leaderboard() {
    const objs = this.openOverlay();
    objs.push(openLeagueRanking(this, { dim: false, onClose: () => this.closeOverlay() }));
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
      p.add(this.add.text(-pw / 2 + 112, y + 6, eco.target != null ? `Meta semanal ${fmtCoins(eco.target)} monedas netas` : 'Liga máxima', { fontFamily: FONT, fontSize: '15px', color: '#9fb4e0' }).setOrigin(0, 0.5));
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
    const sumTxt = this.add.text(0, -ph / 2 + 346, `POSICIÓN ${w.position ? `#${w.position}` : '—'}${w.positionLabel ? ` · ${w.positionLabel}` : ''} · ${w.wins} VICTORIAS · NETO ${fmtNet(w.net)}`, { fontFamily: FONT, fontSize: '18px', color: '#dbe5ff' }).setOrigin(0.5);
    fitText(sumTxt, pw - 40);
    p.add(sumTxt);
    if (w.promotedTo) p.add(this.add.text(0, -ph / 2 + 112, `¡LLEGASTE A LA META! SUBES A ${rankDef(w.promotedTo).name.toUpperCase()}`, { fontFamily: FONT, fontSize: '17px', color: '#62ef89' }).setOrigin(0.5));
    if (w.eligible) {
      const rg = this.add.graphics();
      rg.fillStyle(0x1a1306, 1).fillRoundedRect(-pw / 2 + 40, -ph / 2 + 380, pw - 80, 96, 18);
      rg.lineStyle(3, GOLD, 1).strokeRoundedRect(-pw / 2 + 40, -ph / 2 + 380, pw - 80, 96, 18);
      p.add(rg);
      p.add(coinIcon(this, -110, -ph / 2 + 428, 20)); // (17-11-2026) moneda: imagen moneda-1.webp
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
      const t = this.add.text(0, -ph / 2 + 428, `Necesitabas ${RANKED.minWinsForReward} victorias (ganaste ${w.wins}).\nSigues en tu liga: ¡esta semana sí!`, { fontFamily: FONT, fontSize: '19px', color: '#9fb4e0', align: 'center', wordWrap: { width: pw - 70 } }).setOrigin(0.5);
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
    // pestaña LIGA (antes "RANKING" dentro de la imagen; activa en esta pantalla)
    navLigaLabel(this, (ox, oy) => ({ x: NAV.side + (ox - x0) * scale, y: bottom + (oy - y1) * scale }), scale, true, 441).setScrollFactor(0);

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
    coinIcon(this, right - w + 22, y, 14); // (17-11-2026) moneda: imagen moneda-1.webp
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
