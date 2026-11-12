import Phaser from 'phaser';
import { FONT } from './theme';
import { roundedPoly } from './shapes';
import { fitText } from './fitText';

/**
 * Marcador del partido (solo visual). No calcula nada: recibe el estado real con `setScore()`.
 *
 *   [ TÚ  ●○  🎾 ]  [ 15 - 30 ]  [ 🎾  ○○  RIVAL ]
 *                    ( JUEGO 1 )
 *
 * Origen del contenedor = centro superior (igual que el HUD actual: setPosition(W / 2, 12)).
 *
 * Integración en MatchScene (cuando se autorice):
 *   createHud():  this.board = new ScoreBoard(this, { player: 'TÚ', rival: this.botName, gamesToWin: GAMES_TO_WIN });
 *                 this.hud = this.board;            // mantiene setPosition/setDepth existentes
 *   updateHud():  this.board.setScore({ labels: this.score.labels(), games: this.score.games,
 *                                     gameIndex: this.score.gameIndex, server: this.score.server });
 */
export interface ScoreBoardConfig {
  player: string;
  rival: string;
  gamesToWin: number;
}

export interface ScoreBoardState {
  /** etiquetas de puntos ['15', '30'] / ['AD', '40'] */
  labels: [string, string];
  /** juegos ganados [jugador, rival] */
  games: [number, number];
  /** juegos jugados (0 = primer juego) */
  gameIndex: number;
  /** 0 = saca el jugador, 1 = saca el rival */
  server: 0 | 1;
}

const NAVY = 0x0b1733;
const OUTLINE = 0x0a1638;
const NEON = 0x3a7bff;
const GOLD = 0xffc42e;

const SIDE = [
  { main: 0x2f7bff, top: 0x5c9bff, dark: 0x153f9e }, // TÚ: azul eléctrico
  { main: 0xff4f5e, top: 0xff7f8a, dark: 0xa8202f }, // RIVAL: rojo coral
];

/** Medidas (px de juego, ancho base 720). */
const PW = 222; // ancho de cada panel lateral
const PH = 70; // alto de los paneles
const CW = 196; // ancho de la placa central
const CH = 88; // alto de la placa central

export class ScoreBoard extends Phaser.GameObjects.Container {
  private pts: Phaser.GameObjects.Text[] = [];
  private gameTxt!: Phaser.GameObjects.Text;
  private pips: Phaser.GameObjects.Graphics[][] = [[], []];
  private balls: Phaser.GameObjects.Container[] = [];
  private prevState?: ScoreBoardState;
  private readonly gamesToWin: number;
  /** texto normal de la píldora ("JUEGO N") */
  private gameLabel = 'JUEGO 1';
  /** información fija en la píldora (p. ej. cuenta atrás del saque); null = "JUEGO N" */
  private info: { text: string; color: string } | null = null;
  /** aviso breve en la píldora (FALTA, TIEMPO, LET…); tiene prioridad sobre `info` */
  private flash: { text: string; color: string } | null = null;
  private flashTimer?: Phaser.Time.TimerEvent;
  /** aviso de tiempo para sacar en la card del jugador */
  private alertG?: Phaser.GameObjects.Graphics;
  private alertShape: Phaser.Math.Vector2[] = [];
  private alertN: number | null = null;

  constructor(scene: Phaser.Scene, cfg: ScoreBoardConfig) {
    super(scene, 0, 0);
    scene.add.existing(this);
    this.setScrollFactor(0);
    this.gamesToWin = cfg.gamesToWin;

    this.sidePanel(0, cfg.player);
    this.sidePanel(1, cfg.rival);
    this.centerPlate();
    this.setScore({ labels: ['0', '0'], games: [0, 0], gameIndex: 0, server: 0 }, false);
  }

  /** Aplica el estado real del partido. `animate` = latido en lo que cambió. */
  setScore(s: ScoreBoardState, animate = true) {
    const prev = this.prevState;
    s.labels.forEach((l, i) => {
      const t = this.pts[i];
      t.setText(l);
      t.setScale(1);
      if (t.width > CW * 0.36) t.setScale((CW * 0.36) / t.width);
      if (animate && prev && prev.labels[i] !== l) {
        const base = t.scale;
        this.scene.tweens.add({ targets: t, scale: { from: base * 1.45, to: base }, duration: 320, ease: 'Back.easeOut' });
      }
    });
    this.gameLabel = `JUEGO ${Math.min(s.gameIndex + 1, this.gamesToWin * 2 - 1)}`;
    this.refreshLabel();
    for (let side = 0; side < 2; side++)
      this.pips[side].forEach((p, i) => {
        const won = i < s.games[side];
        this.drawPip(p, won);
        if (animate && prev && won && i >= prev.games[side])
          this.scene.tweens.add({ targets: p, scale: { from: 1.8, to: 1 }, duration: 380, ease: 'Back.easeOut' });
      });
    this.balls.forEach((b, i) => {
      const on = s.server === i;
      b.setVisible(on);
      if (on && animate && prev && prev.server !== s.server)
        this.scene.tweens.add({ targets: b, scale: { from: 0, to: 1 }, duration: 300, ease: 'Back.easeOut' });
    });
    this.prevState = { ...s, labels: [...s.labels] as [string, string], games: [...s.games] as [number, number] };
  }

  // ---------------------------------------------------------------- piezas

  private sidePanel(side: 0 | 1, name: string) {
    const pal = SIDE[side];
    const dir = side === 0 ? -1 : 1; // hacia fuera
    const inner = (CW / 2 - 10) * dir; // se mete un poco bajo la placa central
    const outer = (CW / 2 - 10 + PW) * dir;
    const top = (CH - PH) / 2;
    const k = 16 * dir; // inclinación del borde exterior
    const pts = (g: number): [number, number][] =>
      side === 0
        ? [[outer + k - g, top - g], [inner + g, top - g], [inner + g, top + PH + g], [outer - g, top + PH + g]]
        : [[inner - g, top - g], [outer + k + g, top - g], [outer + g, top + PH + g], [inner - g, top + PH + g]]; // espejo exacto del izquierdo
    const g = this.scene.add.graphics();
    const off = (p: Phaser.Math.Vector2[], dx: number, dy: number) => p.map((v) => ({ x: v.x + dx, y: v.y + dy }));
    g.fillStyle(0x000000, 0.35).fillPoints(off(roundedPoly(pts(0), 12), 3, 6), true);
    g.fillStyle(OUTLINE, 1).fillPoints(roundedPoly(pts(4), 14), true);
    g.fillStyle(pal.dark, 1).fillPoints(roundedPoly(pts(0), 12), true);
    // cuerpo + mitad superior más clara (bisel)
    const body = pts(0).map(([x, y]) => [x, Math.min(y, top + PH - 7)] as [number, number]);
    g.fillStyle(pal.main, 1).fillPoints(roundedPoly(body, 11), true);
    const hi = pts(0).map(([x, y]) => [x, Math.min(y, top + PH * 0.46)] as [number, number]);
    g.fillStyle(pal.top, 1).fillPoints(roundedPoly(hi, 10), true);
    g.fillStyle(0xffffff, 0.28).fillRoundedRect(Math.min(inner, outer) + 22, top + 5, PW - 44, 6, 3);
    this.add(g);
    // capa del aviso de tiempo de saque (solo la card del jugador): encima del panel y bajo nombre / puntos
    if (side === 0) {
      this.alertShape = roundedPoly(pts(0), 12);
      this.alertG = this.scene.add.graphics();
      this.add(this.alertG);
    }

    // nombre
    // hueco libre para el nombre: desde el borde de la placa central hasta antes de la pelota de saque
    const spanIn = CW / 2 + 8;
    const spanOut = Math.abs(outer) - 46;
    const cx = ((spanIn + spanOut) / 2) * dir;
    const t = this.scene.add
      .text(cx, top + 25, name.toUpperCase(), { fontFamily: FONT, fontSize: '26px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 5 })
      .setOrigin(0.5);
    // sin pisar la pelota de saque ni la placa central; si no cabe: achica un poco y termina en "..."
    fitText(t, spanOut - spanIn - 6, 0.78);
    this.add(t);

    // juegos ganados (puntos dorados discretos)
    const n = this.gamesToWin;
    for (let i = 0; i < n; i++) {
      const p = this.scene.add.graphics({ x: cx + (i - (n - 1) / 2) * 24, y: top + PH - 17 });
      this.add(p);
      this.pips[side].push(p);
    }

    // pelota de saque (en el extremo exterior)
    const ball = this.scene.add.container(outer - 30 * dir, top + 25);
    const bg = this.scene.add.graphics();
    bg.fillStyle(OUTLINE, 1).fillCircle(0, 0, 12);
    bg.fillStyle(0xd7f53a, 1).fillCircle(0, 0, 9);
    bg.lineStyle(2, 0xffffff, 0.9).beginPath().arc(-9, 0, 7, -0.9, 0.9).strokePath();
    bg.beginPath().arc(9, 0, 7, Math.PI - 0.9, Math.PI + 0.9).strokePath();
    ball.add(bg);
    this.add(ball);
    this.balls[side] = ball;
  }

  private centerPlate() {
    const g = this.scene.add.graphics();
    const x = -CW / 2;
    g.fillStyle(0x000000, 0.4).fillRoundedRect(x + 3, 6, CW, CH, 18);
    g.lineStyle(10, NEON, 0.22).strokeRoundedRect(x, 0, CW, CH, 18);
    g.fillStyle(OUTLINE, 1).fillRoundedRect(x - 4, -4, CW + 8, CH + 8, 21);
    g.fillStyle(NAVY, 1).fillRoundedRect(x, 0, CW, CH, 18);
    g.fillStyle(0x1b2d5c, 0.8).fillRoundedRect(x + 3, 3, CW - 6, CH * 0.42, { tl: 15, tr: 15, bl: 0, br: 0 });
    g.lineStyle(3, NEON, 1).strokeRoundedRect(x, 0, CW, CH, 18);
    g.lineStyle(1.5, GOLD, 0.55).strokeRoundedRect(x + 6, 6, CW - 12, CH - 12, 13);
    this.add(g);

    const style = { fontFamily: FONT, fontSize: '46px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 6 };
    this.pts[0] = this.scene.add.text(-CW * 0.24, CH / 2 - 4, '0', style).setOrigin(0.5);
    this.pts[1] = this.scene.add.text(CW * 0.24, CH / 2 - 4, '0', style).setOrigin(0.5);
    const dash = this.scene.add.text(0, CH / 2 - 6, '-', { ...style, color: '#ffc42e' }).setOrigin(0.5);
    this.add([this.pts[0], dash, this.pts[1]]);

    // píldora JUEGO N bajo la placa
    const pw = 118;
    const ph = 28;
    const py = CH + 2;
    const pill = this.scene.add.graphics();
    pill.fillStyle(OUTLINE, 1).fillRoundedRect(-pw / 2 - 3, py - ph / 2 - 3, pw + 6, ph + 6, (ph + 6) / 2);
    pill.fillStyle(NAVY, 1).fillRoundedRect(-pw / 2, py - ph / 2, pw, ph, ph / 2);
    pill.lineStyle(2, GOLD, 0.9).strokeRoundedRect(-pw / 2, py - ph / 2, pw, ph, ph / 2);
    this.gameTxt = this.scene.add.text(0, py, 'JUEGO 1', { fontFamily: FONT, fontSize: '16px', color: '#ffd76a' }).setOrigin(0.5).setLetterSpacing(1);
    this.add([pill, this.gameTxt]);
  }

  /**
   * Segundos que le quedan al jugador para sacar, en su card: 5-4 borde naranja, 3-2 borde rojo fuerte, 1 toda roja.
   * Late en cada cambio de número. null = sin aviso.
   */
  setServeAlert(n: number | null) {
    const g = this.alertG;
    if (!g || n === this.alertN) return;
    this.alertN = n;
    this.scene.tweens.killTweensOf(g);
    g.clear().setAlpha(1);
    if (n === null) return;
    const shape = this.alertShape;
    if (n <= 1) {
      g.fillStyle(0xe0182a, 0.92).fillPoints(shape, true);
      g.lineStyle(6, 0xff2a3a, 1).strokePoints(shape, true, true);
      g.lineStyle(2, 0xffffff, 0.75).strokePoints(shape, true, true);
    } else if (n <= 3) {
      g.lineStyle(12, 0xff1f2e, 0.3).strokePoints(shape, true, true);
      g.lineStyle(6, 0xff1f2e, 1).strokePoints(shape, true, true);
    } else {
      g.lineStyle(10, 0xff9a1f, 0.28).strokePoints(shape, true, true);
      g.lineStyle(5, 0xff9a1f, 1).strokePoints(shape, true, true);
    }
    this.scene.tweens.add({ targets: g, alpha: { from: 1, to: n <= 1 ? 0.75 : 0.55 }, duration: 250, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' });
  }

  /** Información fija en la píldora bajo el marcador (null = vuelve a "JUEGO N"). */
  setInfo(text: string | null, color = '#ffd76a') {
    const next = text ? { text, color } : null;
    if (next?.text === this.info?.text && next?.color === this.info?.color) return;
    this.info = next;
    this.refreshLabel();
  }

  /** Aviso breve en la píldora (FALTA, TIEMPO, LET…) con un latido; luego vuelve a lo anterior. */
  flashInfo(text: string, color = '#ffd76a', ms = 1100) {
    this.flash = { text: text.toUpperCase(), color };
    this.flashTimer?.remove();
    this.flashTimer = this.scene.time.delayedCall(ms, () => {
      this.flash = null;
      this.refreshLabel();
    });
    this.refreshLabel();
    this.scene.tweens.killTweensOf(this.gameTxt);
    const base = this.gameTxt.scale;
    this.scene.tweens.add({ targets: this.gameTxt, scale: { from: base * 1.35, to: base }, duration: 280, ease: 'Back.easeOut' });
  }

  private refreshLabel() {
    const cur = this.flash ?? this.info;
    this.gameTxt.setText(cur ? cur.text : this.gameLabel).setColor(cur ? cur.color : '#ffd76a').setScale(1);
    if (this.gameTxt.width > 108) this.gameTxt.setScale(108 / this.gameTxt.width);
  }

  private drawPip(g: Phaser.GameObjects.Graphics, won: boolean) {
    g.clear();
    g.fillStyle(OUTLINE, 1).fillCircle(0, 0, 8);
    if (won) {
      g.fillStyle(GOLD, 1).fillCircle(0, 0, 6);
      g.fillStyle(0xfff1b8, 1).fillCircle(-1.5, -1.5, 2.2);
    } else g.fillStyle(0x0a1638, 1).fillCircle(0, 0, 5).lineStyle(1.5, 0xffffff, 0.35).strokeCircle(0, 0, 5);
  }
}
