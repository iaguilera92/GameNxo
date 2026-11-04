import Phaser from 'phaser';
import {
  ALLEY,
  COURT,
  DASH_COOLDOWN,
  GAME_NAME,
  GAMES_TO_WIN,
  HIT_MAX_Z,
  HIT_RANGE,
  KNOCKBACK_DIST,
  LUNGE_MAX_Z,
  LUNGE_RANGE,
  LUNGE_RECOVER,
  NET_HEIGHT,
  NET_X,
  PLAYER_SPEED,
  SERVE_SPEED,
  SHOT_SPEED,
  SIDE_MARGIN,
  SMASH_COOLDOWN,
  SMASH_SPEED_MULT,
  STUN_DURATION,
} from '../config';
import { Ball, type BallState, type ShotKind, aimShot, isInCourt, predictIntercept, stepBall } from '../objects/Ball';
import { BOT_LOOK, Character, PLAYER_LOOK } from '../objects/Character';
import { BotAI } from '../logic/BotAI';
import { HyperAura } from '../objects/HyperAura';
import { Score } from '../logic/Score';
import { ABILITIES } from '../logic/Abilities';
import { Joystick } from '../ui/Joystick';
import { AbilityButton } from '../ui/AbilityButton';
import { Button } from '../ui/Button';
import { C, textStyle } from '../ui/theme';
import { VIEW, project } from '../view/projection';
import type { ResultData } from './ResultScene';

type Who = 'player' | 'bot';
type Phase = 'intro' | 'serve' | 'toss' | 'rally' | 'pointover' | 'over';

/** Personaje en coordenadas lógicas de cancha (x = profundidad, y = lateral). */
interface Actor {
  ch: Character;
  x: number;
  y: number;
  /** +1 jugador (mira hacia x creciente), -1 bot */
  dir: number;
  stun: number;
  /** 1 = normal; 0 = desaparecido (teleport) */
  warp: number;
  vanished: boolean;
}

const LAT_C = (COURT.top + COURT.bottom) / 2;
const HALF_W = (COURT.bottom - COURT.top) / 2;
const Y_MIN = COURT.top - SIDE_MARGIN;
const Y_MAX = COURT.bottom + SIDE_MARGIN;
const P_X = [COURT.left - 70, NET_X - 45];
const B_X = [NET_X + 45, COURT.right + 130];

const rand = Phaser.Math.FloatBetween;
const clamp = Phaser.Math.Clamp;

export class MatchScene extends Phaser.Scene {
  private botName = 'Bot';
  private player!: Actor;
  private bot!: Actor;
  private ball!: Ball;
  private ai!: BotAI;
  private score!: Score;
  private joy!: Joystick;
  private dashBtn!: AbilityButton;
  private smashBtn!: AbilityButton;
  private surrenderBtn!: Phaser.GameObjects.Container;
  private dialog: Phaser.GameObjects.GameObject[] = [];
  private paused = false;
  private baseScrollX = 0;
  /** última dirección del joystick (para elegir el tipo de golpe) */
  private lastDir = new Phaser.Math.Vector2();
  private lastDirAt = -1e9;
  private keys?: Record<string, Phaser.Input.Keyboard.Key>;

  private phase: Phase = 'intro';
  private server: Who = 'player';
  private lastHitter: Who | null = null;
  private bounces = 0;
  private smashArmed = false;
  /** saque en curso (la pelota aún no ha botado en el cuadro de saque) */
  private serving = false;
  /** faltas del saque actual (2 = doble falta) */
  private faults = 0;
  private serveBox = { x0: 0, x1: 0, y0: 0, y1: 0 };
  private serveHint?: Phaser.GameObjects.Graphics;
  private aura!: HyperAura;
  // tiro cargado (tocar la mitad derecha de la pantalla)
  private charging = false;
  /** 0..1 */
  private charge = 0;
  private chargeFull = false;
  private chargeRing!: Phaser.GameObjects.Ellipse;
  private chargeBar!: Phaser.GameObjects.Graphics;
  private chargeLabel!: Phaser.GameObjects.Text;
  private chargeLabelKey = '';
  private dizzy!: Phaser.GameObjects.Container;

  // HUD
  private hud!: Phaser.GameObjects.Container;
  private pointsText!: Phaser.GameObjects.Text;
  private gameText!: Phaser.GameObjects.Text;
  private pips: Phaser.GameObjects.Arc[][] = [[], []];
  private serveIcons: Phaser.GameObjects.Arc[] = [];

  constructor() {
    super('Match');
  }

  init(data: { botName?: string }) {
    this.botName = data?.botName ?? 'Bot';
  }

  create() {
    // estado (la escena se reutiliza en revanchas)
    this.phase = 'intro';
    this.lastHitter = null;
    this.bounces = 0;
    this.smashArmed = false;
    this.serving = false;
    this.faults = 0;
    this.serveHint = undefined;
    this.charging = false;
    this.charge = 0;
    this.chargeFull = false;
    this.chargeLabelKey = '';
    this.paused = false;
    this.dialog = [];
    this.pips = [[], []];
    this.serveIcons = [];

    this.cameras.main.fadeIn(250, 0, 0, 0);
    this.drawCourt();

    const mk = (look: typeof PLAYER_LOOK, view: 'front' | 'back', x: number, dir: number): Actor => ({
      ch: new Character(this, 0, 0, look, view),
      x,
      y: LAT_C,
      dir,
      stun: 0,
      warp: 1,
      vanished: false,
    });
    this.player = mk(PLAYER_LOOK, 'back', COURT.left - 40, 1);
    this.bot = mk(BOT_LOOK, 'front', COURT.right + 40, -1);
    this.aura = new HyperAura(this, this.player.ch);
    this.chargeRing = this.add
      .ellipse(0, 0, 120, 40, 0x6ec1ff, 0.25)
      .setStrokeStyle(5, 0xd6f0ff, 0.9)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
    this.chargeBar = this.add.graphics().setDepth(4400).setVisible(false);
    this.chargeLabel = this.add.text(0, 0, '', textStyle(20, '#d6f0ff')).setOrigin(0.5).setDepth(4401).setVisible(false);
    this.dizzy = this.makeDizzy();
    this.ball = new Ball(this);
    this.ai = new BotAI();
    this.score = new Score();

    this.createHud();
    this.joy = new Joystick(this);
    const d = ABILITIES.dash;
    const s = ABILITIES.smash;
    this.dashBtn = new AbilityButton(this, 0, 0, 54, DASH_COOLDOWN, d.color, d.colorDark, d.icon, 'DASH', () => this.activateDash());
    this.smashBtn = new AbilityButton(this, 0, 0, 64, SMASH_COOLDOWN, s.color, s.colorDark, s.icon, 'SMASH', () => this.activateSmash());
    this.surrenderBtn = this.makeSurrenderIcon();

    const kb = this.input.keyboard;
    if (kb) {
      this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,Q,E,J,K') as Record<string, Phaser.Input.Keyboard.Key>;
      kb.on('keydown-Q', () => this.dashBtn.tryActivate());
      kb.on('keydown-J', () => this.dashBtn.tryActivate());
      kb.on('keydown-E', () => this.smashBtn.tryActivate());
      kb.on('keydown-K', () => this.smashBtn.tryActivate());
      kb.on('keydown-SPACE', () => this.toggleCharge());
      kb.on('keydown-L', () => this.toggleCharge());
    }
    // Toque en la mitad derecha = tiro cargado. Prioridad baja: si el toque cae sobre
    // un botón (SMASH, DASH, rendirse...) gana el botón y aquí no se hace nada.
    const onTap = (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length > 0) return;
      if (p.x < this.scale.width * 0.55) return; // la izquierda es del joystick
      this.toggleCharge();
    };
    this.input.on('pointerdown', onTap);

    this.layout();
    const onResize = () => this.layout();
    this.scale.on('resize', onResize);
    this.events.once('shutdown', () => {
      this.scale.off('resize', onResize);
      this.input.off('pointerdown', onTap);
      this.input.keyboard?.removeAllListeners();
    });

    this.updateHud();
    this.placeForServe();
    this.renderActors();
    this.banner('¡A JUGAR!', '#ffd23f', 90, 1100);
    this.time.delayedCall(1200, () => this.startPoint());
  }

  // ---------------------------------------------------------------- layout
  private layout() {
    const W = this.scale.width;
    const H = this.scale.height;
    // el mundo mide VIEW.W x VIEW.H: se centra en horizontal y el espacio extra queda abajo (controles)
    this.baseScrollX = (VIEW.W - W) / 2;
    this.cameras.main.setScroll(this.baseScrollX, 0);
    this.hud.setPosition(W / 2, 12);
    this.joy.layout();
    this.smashBtn.setPosition(W - 110, H - 225);
    this.dashBtn.setPosition(W - 250, H - 115);
    this.surrenderBtn.setPosition(W - 46, 150);
  }

  // ---------------------------------------------------------------- rendirse
  /** Icono de bandera blanca (arriba a la derecha). */
  private makeSurrenderIcon() {
    const c = this.add.container(0, 0).setScrollFactor(0).setDepth(5600);
    const g = this.add.graphics();
    const R = 30;
    g.fillStyle(C.outline).fillCircle(0, 4, R + 6);
    g.fillStyle(C.greyDark).fillCircle(0, 5, R);
    g.fillStyle(C.grey).fillCircle(0, 0, R - 2);
    g.fillStyle(0xffffff, 0.3).fillEllipse(-4, -13, 34, 12);
    // mástil + bandera blanca
    g.fillStyle(C.outline).fillRoundedRect(-13, -19, 7, 40, 3);
    g.fillStyle(0xe8e8f0).fillRect(-11, -17, 3, 36);
    g.fillStyle(C.outline).fillPoints(
      [new Phaser.Math.Vector2(-9, -20), new Phaser.Math.Vector2(17, -14), new Phaser.Math.Vector2(13, -5), new Phaser.Math.Vector2(18, 4), new Phaser.Math.Vector2(-9, 2)],
      true,
    );
    g.fillStyle(0xffffff).fillPoints(
      [new Phaser.Math.Vector2(-7, -16), new Phaser.Math.Vector2(12, -12), new Phaser.Math.Vector2(9, -5), new Phaser.Math.Vector2(13, 1), new Phaser.Math.Vector2(-7, -1)],
      true,
    );
    c.add(g);
    c.setSize(R * 2 + 16, R * 2 + 16);
    c.setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => {
      this.tweens.add({ targets: c, scale: { from: 0.85, to: 1 }, duration: 250, ease: 'Back.easeOut' });
      this.openSurrender();
    });
    return c;
  }

  private openSurrender() {
    if (this.paused || this.phase === 'over') return;
    this.paused = true;
    this.time.paused = true;
    this.joy.release();
    this.joy.enabled = false;

    const W = this.scale.width;
    const H = this.scale.height;
    const cy = Math.min(H, VIEW.H) * 0.45;
    const shade = this.add.rectangle(0, 0, W, H, 0x000000, 0.6).setOrigin(0).setScrollFactor(0).setDepth(8000).setInteractive();
    const panel = this.add.container(W / 2, cy).setScrollFactor(0).setDepth(8001);
    const g = this.add.graphics();
    const pw = Math.min(600, W - 60);
    const ph = 330;
    g.fillStyle(C.outline).fillRoundedRect(-pw / 2 - 6, -ph / 2 - 6, pw + 12, ph + 20, 30);
    g.fillStyle(C.blueDark).fillRoundedRect(-pw / 2, -ph / 2 + 8, pw, ph, 24);
    g.fillStyle(C.blue).fillRoundedRect(-pw / 2, -ph / 2, pw, ph, 24);
    g.fillStyle(0xffffff, 0.22).fillRoundedRect(-pw / 2 + 14, -ph / 2 + 10, pw - 28, 44, 16);
    panel.add(g);
    panel.add(this.add.text(0, -88, '¿Seguro que quieres rendirte?', { ...textStyle(40), wordWrap: { width: pw - 60 } }).setOrigin(0.5));
    panel.add(this.add.text(0, -14, 'El partido contará como derrota', textStyle(22, '#e6f2ff')).setOrigin(0.5));
    panel.setScale(0.6);
    this.tweens.add({ targets: panel, scale: 1, duration: 260, ease: 'Back.easeOut' });

    const quit = new Button(this, W / 2 - 140, cy + 85, 230, 84, 'Rendirse', C.red, C.redDark, () => this.surrender(), 34);
    const keep = new Button(this, W / 2 + 140, cy + 85, 230, 84, 'Seguir', C.green, C.greenDark, () => this.closeSurrender(), 34);
    for (const b of [quit, keep]) b.setScrollFactor(0).setDepth(8002);
    this.dialog = [shade, panel, quit, keep];
  }

  private closeSurrender() {
    this.dialog.forEach((o) => o.destroy());
    this.dialog = [];
    this.paused = false;
    this.time.paused = false;
    this.joy.enabled = true;
  }

  private surrender() {
    this.closeSurrender();
    this.endMatch(false, true);
  }

  // ---------------------------------------------------------------- cancha
  private P(x: number, y: number, z = 0) {
    const p = project(x, y, z);
    return new Phaser.Math.Vector2(p.sx, p.sy);
  }

  private quad(g: Phaser.GameObjects.Graphics, x0: number, y0: number, x1: number, y1: number) {
    g.fillPoints([this.P(x0, y0), this.P(x0, y1), this.P(x1, y1), this.P(x1, y0)], true);
  }

  private drawCourt() {
    // Se dibuja en un Graphics temporal y se hornea en una RenderTexture (1 sola vez)
    const g = this.make.graphics({}, false);
    const ax0 = COURT.left - 150; // zona exterior de la pista
    const ax1 = COURT.right + 140;
    const ay0 = COURT.top - ALLEY - 85;
    const ay1 = COURT.bottom + ALLEY + 85;
    const WALL_Z = 46; // altura de las vallas
    const SHIRTS = [0xff4f5e, 0xffcc2e, 0x3aa6ff, 0x62d935, 0xffffff, 0x9b5cff, 0xff9a2e, 0x2fd6c8];
    const SKINS = [0xffcf9e, 0xe0a878, 0xb57a50, 0x8a5634];
    const pick = <T,>(arr: T[], seed: number) => arr[Math.abs(Math.floor(Math.sin(seed) * 10000)) % arr.length];

    // fondo general (suelo exterior)
    g.fillStyle(0x1d5e86).fillRect(-1500, -1000, VIEW.W + 3000, VIEW.H + 3000);

    // --- grada del fondo (en pantalla, detrás de la valla del fondo)
    const backWall = this.P(ax1, LAT_C, WALL_Z).y;
    const standTop = -60;
    g.fillGradientStyle(0x0f1d52, 0x0f1d52, 0x1f3a8f, 0x1f3a8f, 1);
    g.fillRect(-1500, standTop, VIEW.W + 3000, backWall - standTop);
    const rowH = 26;
    for (let row = 0, y = backWall - 12; y > standTop + 40; row++, y -= rowH) {
      g.fillStyle(0x000000, 0.18).fillRect(-1500, y + 6, VIEW.W + 3000, 6); // escalón
      for (let x = -400 + (row % 2) * 13; x < VIEW.W + 400; x += 26) {
        const seed = x * 3.1 + row * 17.3;
        g.fillStyle(pick(SHIRTS, seed), 0.95).fillRoundedRect(x - 10, y - 8, 20, 14, 6);
        g.fillStyle(pick(SKINS, seed + 1)).fillCircle(x, y - 13, 7);
      }
    }
    // techo con focos
    g.fillStyle(C.outline).fillRect(-1500, standTop - 400, VIEW.W + 3000, 520);
    g.fillStyle(0x24245a).fillRect(-1500, 96, VIEW.W + 3000, 22);
    for (let x = -300; x < VIEW.W + 300; x += 120) {
      g.fillStyle(0xfff7c2, 0.18).fillCircle(x, 108, 34);
      g.fillStyle(C.outline).fillCircle(x, 108, 13);
      g.fillStyle(0xfff7c2).fillCircle(x, 108, 9);
    }

    // --- gradas laterales en perspectiva (suben alejándose de la pista)
    for (const side of [-1, 1]) {
      const wallY = side < 0 ? ay0 : ay1;
      const far = wallY + side * 330;
      g.fillStyle(0x1a2f78);
      g.fillPoints([this.P(ax0 - 300, wallY, WALL_Z), this.P(ax1, wallY, WALL_Z), this.P(ax1, far, 260), this.P(ax0 - 300, far, 260)], true);
      // público: filas paralelas a la pista
      for (let r = 0; r < 9; r++) {
        const yy = wallY + side * (28 + r * 34);
        const zz = WALL_Z + 12 + r * 24;
        for (let x = ax0 - 280 + (r % 2) * 18; x < ax1 - 10; x += 36) {
          const seed = x * 1.7 + r * 31 + side * 7;
          const body = project(x, yy, zz);
          const head = project(x, yy, zz + 26);
          g.fillStyle(pick(SHIRTS, seed), 0.95).fillCircle(body.sx, body.sy, 9 * body.s);
          g.fillStyle(pick(SKINS, seed + 2)).fillCircle(head.sx, head.sy, 6.5 * head.s);
        }
      }
    }

    // --- suelo exterior de la pista
    g.fillStyle(0x2a66cc);
    this.quad(g, ax0 - 400, ay0, ax1, ay1);

    // --- vallas publicitarias (laterales y fondo)
    const panel = (pts: Phaser.Math.Vector2[], col: number) => {
      g.fillStyle(col).fillPoints(pts, true);
      g.lineStyle(4, C.outline).strokePoints(pts, true);
    };
    const AD = [C.red, C.yellow, C.purple, C.green];
    const step = 120;
    for (const wallY of [ay0, ay1]) {
      for (let x = ax0 - 400, i = 0; x < ax1; x += step, i++) {
        const x2 = Math.min(ax1, x + step);
        panel([this.P(x, wallY, 0), this.P(x2, wallY, 0), this.P(x2, wallY, WALL_Z), this.P(x, wallY, WALL_Z)], AD[i % AD.length]);
        const a = this.P(x + 14, wallY, WALL_Z * 0.62);
        const b = this.P(x2 - 14, wallY, WALL_Z * 0.62);
        g.lineStyle(Math.max(2, 6 * project(x, wallY).s), 0xffffff, 0.75).lineBetween(a.x, a.y, b.x, b.y);
      }
    }
    panel([this.P(ax1, ay0, 0), this.P(ax1, ay1, 0), this.P(ax1, ay1, WALL_Z), this.P(ax1, ay0, WALL_Z)], C.red);
    const bw = this.P(ax1, LAT_C, WALL_Z * 0.5);
    for (const off of [-1, 0, 1]) {
      const p = this.P(ax1, LAT_C + off * 170, WALL_Z * 0.5);
      this.add.text(p.x, bw.y, GAME_NAME, textStyle(18)).setOrigin(0.5).setDepth(0);
    }

    // --- pista: borde grueso, superficie con degradado suave (más clara cerca)
    g.lineStyle(10, C.outline, 1);
    const dT = COURT.top - ALLEY;
    const dB = COURT.bottom + ALLEY;
    g.strokePoints([this.P(COURT.left - 6, dT - 6), this.P(COURT.left - 6, dB + 6), this.P(COURT.right + 6, dB + 6), this.P(COURT.right + 6, dT - 6)], true);
    const bands = 10;
    for (let i = 0; i < bands; i++) {
      const x0 = COURT.left + ((COURT.right - COURT.left) * i) / bands;
      const x1 = COURT.left + ((COURT.right - COURT.left) * (i + 1)) / bands;
      const t = i / (bands - 1);
      const col = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(0x4a9cff),
        Phaser.Display.Color.ValueToColor(0x2f78dc),
        1,
        t,
      );
      g.fillStyle(Phaser.Display.Color.GetColor(col.r, col.g, col.b));
      this.quad(g, x0, dT, x1 + 1, dB);
    }

    // líneas
    g.lineStyle(5, 0xffffff, 1);
    const line = (x0: number, y0: number, x1: number, y1: number) => {
      const a = this.P(x0, y0);
      const b = this.P(x1, y1);
      g.lineBetween(a.x, a.y, b.x, b.y);
    };
    // laterales de dobles (exterior) e individuales (interior)
    line(COURT.left, dT, COURT.right, dT);
    line(COURT.left, dB, COURT.right, dB);
    line(COURT.left, COURT.top, COURT.right, COURT.top);
    line(COURT.left, COURT.bottom, COURT.right, COURT.bottom);
    // líneas de fondo (abarcan todo el ancho de dobles)
    line(COURT.left, dT, COURT.left, dB);
    line(COURT.right, dT, COURT.right, dB);
    const sl = (NET_X - COURT.left) * 0.538; // línea de saque (6.40 m de 11.885 m)
    line(NET_X - sl, COURT.top, NET_X - sl, COURT.bottom);
    line(NET_X + sl, COURT.top, NET_X + sl, COURT.bottom);
    line(NET_X - sl, LAT_C, NET_X + sl, LAT_C);
    line(COURT.left, LAT_C, COURT.left + 14, LAT_C);
    line(COURT.right - 14, LAT_C, COURT.right, LAT_C);

    const BX = -1000;
    const BY = 0;
    const baked = this.add.renderTexture(BX, BY, 2720, 1800).setOrigin(0).setDepth(-10);
    baked.draw(g, -BX, -BY);
    g.destroy();

    // red: banda vertical en perspectiva (profundidad = su línea en el suelo)
    const n0 = dT - 6;
    const n1 = dB + 6;
    const netDepth = this.P(NET_X, LAT_C).y;
    const n = this.make.graphics({}, false);
    const a0 = this.P(NET_X, n0, 0);
    const a1 = this.P(NET_X, n1, 0);
    const b0 = this.P(NET_X, n0, NET_HEIGHT);
    const b1 = this.P(NET_X, n1, NET_HEIGHT);
    n.fillStyle(0x000000, 0.2).fillRect(a0.x, a0.y, a1.x - a0.x, 10);
    n.fillStyle(0x2b2b40, 0.55).fillPoints([b0, b1, a1, a0], true);
    n.lineStyle(1.5, 0xd0d4ea, 0.55);
    for (let x = a0.x; x <= a1.x; x += 9) n.lineBetween(x, b0.y, x, a0.y);
    for (let y = b0.y; y <= a0.y; y += 8) n.lineBetween(a0.x, y, a1.x, y);
    n.lineStyle(9, C.outline).lineBetween(b0.x, b0.y, b1.x, b1.y);
    n.lineStyle(5, 0xffffff).lineBetween(b0.x, b0.y, b1.x, b1.y);
    for (const [top, bot] of [
      [b0, a0],
      [b1, a1],
    ]) {
      n.lineStyle(10, C.outline).lineBetween(top.x, top.y - 4, bot.x, bot.y);
      n.lineStyle(5, 0xe8e8f0).lineBetween(top.x, top.y - 4, bot.x, bot.y);
    }
    const nx = Math.floor(a0.x - 16);
    const ny = Math.floor(b0.y - 24);
    this.add
      .renderTexture(nx, ny, Math.ceil(a1.x - a0.x + 32), Math.ceil(a0.y - b0.y + 44))
      .setOrigin(0)
      .setDepth(netDepth)
      .draw(n, -nx, -ny);
    n.destroy();
  }

  // ---------------------------------------------------------------- HUD
  private createHud() {
    this.hud = this.add.container(0, 0).setScrollFactor(0).setDepth(5500);
    const w = 560;
    const h = 82;
    const g = this.add.graphics();
    g.fillStyle(C.outline).fillRoundedRect(-w / 2 - 6, -6, w + 12, h + 18, 22);
    g.fillStyle(0x2a1f4d).fillRoundedRect(-w / 2, 6, w, h, 18);
    g.fillStyle(0x3a2d66).fillRoundedRect(-w / 2, 0, w, h, 18);
    g.fillStyle(C.blueDark).fillRoundedRect(-w / 2 + 8, 8, 180, h - 16, 14);
    g.fillStyle(C.blue).fillRoundedRect(-w / 2 + 8, 8, 180, h - 22, 14);
    g.fillStyle(C.redDark).fillRoundedRect(w / 2 - 188, 8, 180, h - 16, 14);
    g.fillStyle(C.red).fillRoundedRect(w / 2 - 188, 8, 180, h - 22, 14);
    g.fillStyle(0xffffff, 0.25).fillRoundedRect(-w / 2 + 16, 12, 164, 14, 7).fillRoundedRect(w / 2 - 180, 12, 164, 14, 7);
    this.hud.add(g);

    this.hud.add(this.add.text(-w / 2 + 98, 28, 'TÚ', textStyle(28)).setOrigin(0.5));
    this.hud.add(this.add.text(w / 2 - 98, 28, this.botName, textStyle(this.botName.length > 8 ? 20 : 26)).setOrigin(0.5));

    for (let side = 0; side < 2; side++) {
      for (let i = 0; i < GAMES_TO_WIN; i++) {
        const x = side === 0 ? -w / 2 + 70 + i * 34 : w / 2 - 126 + i * 34;
        const o = this.add.circle(x, 60, 12, C.outline);
        const p = this.add.circle(x, 60, 8, 0x1a1033);
        this.hud.add([o, p]);
        this.pips[side].push(p);
      }
    }
    for (let side = 0; side < 2; side++) {
      const x = side === 0 ? -w / 2 + 26 : w / 2 - 26;
      const ic = this.add.circle(x, 28, 9, 0xd7f53a).setStrokeStyle(3, C.outline);
      this.hud.add(ic);
      this.serveIcons.push(ic);
    }

    this.pointsText = this.add.text(0, 36, '0 - 0', textStyle(44)).setOrigin(0.5);
    this.gameText = this.add.text(0, 76, 'JUEGO 1', textStyle(16, '#cfc4ff')).setOrigin(0.5);
    this.hud.add([this.pointsText, this.gameText]);
  }

  private updateHud() {
    const [a, b] = this.score.labels();
    this.pointsText.setText(`${a} - ${b}`);
    this.gameText.setText(`JUEGO ${Math.min(this.score.gameIndex + 1, GAMES_TO_WIN * 2 - 1)}`);
    for (let side = 0; side < 2; side++) {
      this.pips[side].forEach((p, i) => (p.fillColor = i < this.score.games[side] ? C.yellow : 0x1a1033));
    }
    const s = this.score.server;
    this.serveIcons[0].setVisible(s === 0);
    this.serveIcons[1].setVisible(s === 1);
    this.tweens.add({ targets: this.pointsText, scale: { from: 1.4, to: 1 }, duration: 300, ease: 'Back.easeOut' });
  }

  private banner(text: string, color = '#ffffff', size = 64, hold = 900) {
    const W = this.scale.width;
    const H = this.scale.height;
    const t = this.add
      .text(W / 2, Math.min(H, VIEW.H) * 0.44, text, { ...textStyle(size, color), wordWrap: { width: W - 60 } })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(6000)
      .setScale(0);
    this.tweens.chain({
      targets: t,
      tweens: [
        { scale: 1, duration: 300, ease: 'Back.easeOut', easeParams: [2.5] },
        { scale: 1, duration: hold },
        { alpha: 0, y: t.y - 40, duration: 250, ease: 'Quad.easeIn' },
      ],
      onComplete: () => t.destroy(),
    });
  }

  /** Texto emergente en coordenadas de pantalla del mundo. */
  private popText(x: number, y: number, text: string, color: string, size = 30) {
    const t = this.add.text(x, y, text, textStyle(size, color)).setOrigin(0.5).setDepth(4000).setScale(0.3);
    this.tweens.add({ targets: t, scale: 1, y: y - 50, duration: 350, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, delay: 650, duration: 250, onComplete: () => t.destroy() });
  }

  private headPos(a: Actor) {
    const p = project(a.x, a.y);
    return { x: p.sx, y: p.sy - 150 * p.s * VIEW.CHAR_K };
  }

  // ---------------------------------------------------------------- habilidades
  /** DASH: desaparece y reaparece donde llegará la pelota. */
  private activateDash(): boolean {
    if (this.paused) return false;
    if (this.phase !== 'rally' || this.lastHitter !== 'bot' || this.player.vanished) {
      this.popText(this.headPos(this.player).x, this.headPos(this.player).y, 'Espera la pelota', '#cfe0ff', 24);
      return false;
    }
    const pred = predictIntercept(this.ball.s, 'near', this.bounces >= 1, 0.22);
    if (!pred) return false;
    const tx = clamp(pred.x - 18, P_X[0], P_X[1]);
    const ty = clamp(pred.y, Y_MIN, Y_MAX);

    const pl = this.player;
    pl.vanished = true;
    this.portalFx(pl.x, pl.y);
    this.tweens.add({
      targets: pl,
      warp: 0,
      duration: 110,
      ease: 'Quad.easeIn',
      onComplete: () => {
        pl.x = tx;
        pl.y = ty;
        this.portalFx(tx, ty);
        this.tweens.add({
          targets: pl,
          warp: 1,
          duration: 180,
          delay: 40,
          ease: 'Back.easeOut',
          onComplete: () => (pl.vanished = false),
        });
      },
    });
    return true;
  }

  private portalFx(x: number, y: number) {
    const p = project(x, y);
    const k = p.s * VIEW.CHAR_K;
    const ring = this.add.ellipse(p.sx, p.sy, 120 * k, 40 * k, 0x9b5cff, 0.55).setStrokeStyle(5, 0xe6d2ff).setDepth(p.sy - 1);
    this.tweens.add({ targets: ring, scaleX: 1.8, scaleY: 1.8, alpha: 0, duration: 380, onComplete: () => ring.destroy() });
    for (let i = 0; i < 12; i++) {
      const s = this.add
        .circle(p.sx + rand(-40, 40) * k, p.sy - rand(0, 140) * k, rand(3, 7) * k, Phaser.Utils.Array.GetRandom([0x9b5cff, 0xe6d2ff, 0xffffff]))
        .setDepth(p.sy + 5)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: s, y: s.y - rand(30, 80) * k, alpha: 0, duration: rand(250, 450), onComplete: () => s.destroy() });
    }
  }

  /** SMASH: la pelota se prende fuego; el siguiente golpe es una bola de fuego. */
  private activateSmash(): boolean {
    if (this.paused || this.phase === 'over' || this.phase === 'intro' || this.smashArmed) return false;
    this.smashArmed = true;
    this.smashBtn.setArmed(true);
    this.ball.setIgnited(true);
    this.aura.start();
    const h = this.headPos(this.player);
    this.popText(h.x, h.y, '¡FUEGO!', '#ffb347', 34);
    // llamarada en la pelota
    const air = project(this.ball.s.x, this.ball.s.y, this.ball.s.z);
    const burst = this.add.circle(air.sx, air.sy, 16, 0xff8a1e, 0.8).setDepth(4000).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: burst, scale: 4, alpha: 0, duration: 350, onComplete: () => burst.destroy() });
    return true;
  }

  /** El rival toca la bola de fuego: devuelve flojo, sale despedido y queda aturdido. */
  private fireImpact() {
    const s = this.ball.s;
    const b = this.bot;
    b.ch.swing();
    // devolución débil (globo al centro)
    const tx = NET_X - (NET_X - COURT.left) * rand(0.3, 0.6);
    const ty = LAT_C + rand(-0.5, 0.5) * HALF_W;
    s.z = Math.max(s.z, 22);
    aimShot(s, tx, ty, SHOT_SPEED * 0.55, 70);
    this.ball.setPower(false);
    this.ball.setKind('lob');
    this.lastHitter = 'bot';
    this.bounces = 0;
    this.ai.onBotHit();

    // explosión
    const air = project(s.x, s.y, s.z);
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = rand(30, 110);
      const f = this.add
        .circle(air.sx, air.sy, rand(6, 14), Phaser.Utils.Array.GetRandom([0xfff36b, 0xffb020, 0xff6a1e]))
        .setDepth(4000)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: f, x: air.sx + Math.cos(a) * d, y: air.sy + Math.sin(a) * d * 0.6, alpha: 0, scale: 0.3, duration: 420, onComplete: () => f.destroy() });
    }
    this.cameras.main.shake(220, 0.014);

    // empuje hacia atrás + aturdimiento
    b.stun = STUN_DURATION;
    this.tweens.add({ targets: b, x: Math.min(B_X[1], b.x + KNOCKBACK_DIST), duration: 300, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: b.ch.rig, angle: { from: -25 * b.ch.facing, to: 0 }, duration: 600, ease: 'Elastic.easeOut' });
    const h = this.headPos(b);
    this.popText(h.x, h.y - 10, '¡ATURDIDO!', '#ffd23f', 30);
  }

  private makeDizzy() {
    const c = this.add.container(0, 0).setDepth(4500).setVisible(false);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      c.add(this.add.star(Math.cos(a) * 26, Math.sin(a) * 9, 5, 4, 10, 0xffd23f).setStrokeStyle(2, C.outline));
    }
    this.tweens.add({ targets: c, angle: 360, duration: 700, repeat: -1 });
    return c;
  }

  // ---------------------------------------------------------------- puntos
  private placeForServe() {
    this.server = this.score.server === 0 ? 'player' : 'bot';
    const side = (this.score.points[0] + this.score.points[1]) % 2 === 0 ? 1 : -1;
    for (const a of [this.player, this.bot]) {
      a.stun = 0;
      a.warp = 1;
      a.vanished = false;
      this.tweens.killTweensOf(a);
    }
    if (this.server === 'player') {
      this.setActor(this.player, COURT.left - 40, LAT_C + side * 70);
      this.setActor(this.bot, COURT.right + 45, LAT_C - side * 40);
    } else {
      this.setActor(this.bot, COURT.right + 40, LAT_C - side * 70);
      this.setActor(this.player, COURT.left - 45, LAT_C + side * 40);
    }
    this.player.ch.facing = 1;
    this.bot.ch.facing = -1;
    this.ai.reset(this.bot.x, this.bot.y);
    this.holdBall();
  }

  private setActor(a: Actor, x: number, y: number) {
    a.x = x;
    a.y = y;
  }

  private holdBall() {
    const srv = this.server === 'player' ? this.player : this.bot;
    const s = this.ball.s;
    s.x = srv.x + srv.dir * 10;
    s.y = srv.y + srv.ch.facing * 28;
    s.z = 62;
    s.vx = s.vy = s.vz = 0;
  }

  /** Cuadro de saque diagonal que corresponde al sacador actual. */
  private computeServeBox() {
    const srv = this.server === 'player' ? this.player : this.bot;
    const sl = (NET_X - COURT.left) * 0.538;
    const x0 = this.server === 'player' ? NET_X : NET_X - sl;
    const x1 = this.server === 'player' ? NET_X + sl : NET_X;
    const upper = srv.y > LAT_C; // sacando desde y>centro -> cuadro con y<centro
    this.serveBox = { x0, x1, y0: upper ? COURT.top : LAT_C, y1: upper ? LAT_C : COURT.bottom };
  }

  private showServeHint() {
    this.hideServeHint();
    const b = this.serveBox;
    const g = this.add.graphics().setDepth(0.5);
    g.fillStyle(0xffd23f, 0.3).fillPoints([this.P(b.x0, b.y0), this.P(b.x0, b.y1), this.P(b.x1, b.y1), this.P(b.x1, b.y0)], true);
    g.lineStyle(4, 0xffd23f, 0.9).strokePoints([this.P(b.x0, b.y0), this.P(b.x0, b.y1), this.P(b.x1, b.y1), this.P(b.x1, b.y0)], true);
    this.tweens.add({ targets: g, alpha: 0.35, duration: 380, yoyo: true, repeat: -1 });
    this.serveHint = g;
  }

  private hideServeHint() {
    if (!this.serveHint) return;
    this.tweens.killTweensOf(this.serveHint);
    this.serveHint.destroy();
    this.serveHint = undefined;
  }

  private inServiceBox(x: number, y: number) {
    const b = this.serveBox;
    const m = 6; // la bola que toca la línea es buena
    return x >= b.x0 - m && x <= b.x1 + m && y >= b.y0 - m && y <= b.y1 + m;
  }

  private startPoint(secondServe = false) {
    if (this.phase === 'over') return;
    this.stopCharge();
    if (!secondServe) this.faults = 0;
    this.serving = false;
    this.lastHitter = null;
    this.bounces = 0;
    this.ball.setPower(false);
    this.ball.setIgnited(this.smashArmed);
    this.ball.clearTrail();
    this.placeForServe();
    this.phase = 'serve';
    this.computeServeBox();
    this.showServeHint();
    if (this.server === 'player') this.joy.release();
    const st = this.score.status();
    if (secondServe) this.banner('2º saque', '#ffd23f', 54, 500);
    else if (st) this.banner(st, '#ffd23f', 54, 600);
    else if (this.score.points[0] + this.score.points[1] === 0)
      this.banner(this.server === 'player' ? '¡Tu saque!' : `Saca ${this.botName}`, '#ffffff', 48, 500);
    this.time.delayedCall(950, () => {
      if (this.phase !== 'serve') return;
      this.phase = 'toss';
      this.ball.s.vz = 430;
    });
  }

  private serveHit() {
    const who = this.server;
    const srv = who === 'player' ? this.player : this.bot;
    srv.ch.swing();
    this.hideServeHint();
    const s = this.ball.s;
    const b = this.serveBox;
    const first = this.faults === 0;

    // ¿falla este saque? (el primero es más rápido y más arriesgado)
    const faultChance = who === 'player' ? (first ? 0.22 : 0.05) : (first ? 0.3 * (1 - this.ai.d) + 0.12 : 0.05);
    const willFault = Math.random() < faultChance;

    // punto dentro del cuadro: el jugador puede orientarlo con el joystick
    const inset = 14;
    let t = rand(0.3, 0.7);
    if (who === 'player') {
      const dx = this.inputVector().x;
      if (Math.abs(dx) > 0.3) t = 0.5 + 0.42 * clamp(dx, -1, 1);
    }
    const inY = who === 'player' ? t : 1 - t;
    let tx = who === 'player' ? b.x0 + (b.x1 - b.x0) * rand(0.6, 0.92) : b.x1 - (b.x1 - b.x0) * rand(0.6, 0.92);
    let ty = b.y0 + inset + (b.y1 - b.y0 - inset * 2) * inY;
    if (willFault) {
      const dirX = who === 'player' ? 1 : -1;
      if (Math.random() < 0.6) tx += dirX * rand(25, 55); // larga
      else ty = b.y0 < LAT_C - 1 ? b.y1 + rand(20, 45) : b.y0 - rand(20, 45); // cruza la línea central
    }
    const speed = first ? SERVE_SPEED * 1.12 : SERVE_SPEED * 0.85;
    aimShot(s, tx, ty, speed);
    this.ball.setKind('normal');
    this.lastHitter = who;
    this.bounces = 0;
    this.serving = true;
    this.phase = 'rally';
    if (who === 'player') this.ai.onPlayerHit(false);
    else this.ai.onBotHit();
    this.hitFx(s.x, s.y, s.z, false);
  }

  /** Falta de saque: segundo saque, o doble falta = punto del rival. */
  private serviceFault() {
    if (this.phase !== 'rally' || !this.serving) return;
    this.serving = false;
    this.faults++;
    const receiver: Who = this.lastHitter === 'player' ? 'bot' : 'player';
    if (this.faults >= 2) {
      this.pointTo(receiver, 'DOBLE FALTA', '#ff7a85');
      return;
    }
    this.phase = 'pointover';
    const g = project(this.ball.s.x, this.ball.s.y, 0);
    this.popText(g.sx, g.sy - 40, '¡FALTA!', '#ffd23f', 40);
    this.time.delayedCall(1100, () => this.startPoint(true));
  }
  private pointTo(w: Who, reason: string, color: string) {
    if (this.phase !== 'rally') return;
    this.phase = 'pointover';
    this.stopCharge();
    const res = this.score.pointTo(w === 'player' ? 0 : 1);
    const g = project(this.ball.s.x, this.ball.s.y, 0);
    this.popText(g.sx, g.sy - 40, reason, color, 34);
    this.updateHud();

    if (res.matchWinner !== null) {
      const win = res.matchWinner === 0;
      this.time.delayedCall(500, () => this.banner(win ? '¡PARTIDO GANADO!' : 'PARTIDO PERDIDO', win ? '#ffd23f' : '#ff7a85', 68, 1300));
      this.time.delayedCall(2400, () => this.endMatch(win));
      return;
    }
    if (res.gameWinner !== null) {
      const youWon = res.gameWinner === 0;
      this.time.delayedCall(450, () => this.banner(youWon ? '¡JUEGO PARA TI!' : `JUEGO PARA ${this.botName.toUpperCase()}`, youWon ? '#8fd0ff' : '#ff9aa3', 58, 900));
      this.time.delayedCall(2100, () => this.startPoint());
      return;
    }
    this.time.delayedCall(1300, () => this.startPoint());
  }

  private endMatch(win: boolean, surrendered = false) {
    this.phase = 'over';
    const data: ResultData = { win, playerGames: this.score.games[0], botGames: this.score.games[1], botName: this.botName, surrendered };
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Result', data));
  }

  // ---------------------------------------------------------------- tiro cargado
  private canCharge() {
    if (this.player.vanished) return false;
    if (this.phase === 'rally') return true;
    // mientras saca el rival también se puede preparar el resto
    return (this.phase === 'serve' || this.phase === 'toss') && this.server === 'bot';
  }

  /** 1er toque: empieza a cargar (quieto). 2º toque: cancela y vuelve a moverse. */
  private toggleCharge() {
    if (this.paused) return;
    if (this.charging) {
      this.stopCharge();
      return;
    }
    if (!this.canCharge()) return;
    this.charging = true;
    this.charge = 0;
    this.chargeFull = false;
    this.player.ch.setCharging(true);
    this.chargeRing.setVisible(true);
    this.chargeBar.setVisible(true);
    this.chargeLabel.setVisible(true);
    this.chargeLabelKey = '';
  }

  private stopCharge() {
    if (!this.charging) return;
    this.charging = false;
    this.charge = 0;
    this.player.ch.setCharging(false);
    this.chargeRing.setVisible(false);
    this.chargeBar.setVisible(false).clear();
    this.chargeLabel.setVisible(false);
  }

  private updateCharge(dt: number) {
    if (!this.charging) return;
    this.charge = Math.min(1, this.charge + dt / 1.1);
    if (this.charge >= 1 && !this.chargeFull) {
      this.chargeFull = true;
      const h = this.headPos(this.player);
      this.popText(h.x, h.y - 30, '¡MÁX!', '#d6f0ff', 30);
      this.cameras.main.flash(80, 160, 210, 255);
    }
  }

  /** Nombre del tiro cargado que saldría con la dirección actual del joystick. */
  private chargedShotName() {
    switch (this.shotFromJoystick()) {
      case 'drop':
        return '▼ CORTITA';
      case 'lob':
        return '▲ POTENTE';
      case 'left':
        return '◀ CRUZADA';
      case 'right':
        return 'CRUZADA ▶';
      default:
        return 'CARGADO';
    }
  }

  private renderCharge() {
    if (!this.charging) return;
    const p = project(this.player.x, this.player.y);
    const pulse = 0.5 + 0.5 * Math.sin(this.time.now / (this.chargeFull ? 45 : 90));
    this.chargeRing
      .setPosition(p.sx, p.sy)
      .setScale(p.s * (0.55 + 0.55 * this.charge + pulse * 0.08))
      .setAlpha(0.5 + pulse * 0.5)
      .setDepth(p.sy - 0.8);
    // barra de carga sobre la cabeza
    const h = this.headPos(this.player);
    const bw = 84;
    const bh = 12;
    const x = h.x - bw / 2;
    const y = h.y - 34;
    const g = this.chargeBar.clear();
    g.fillStyle(C.outline, 0.85).fillRoundedRect(x - 4, y - 4, bw + 8, bh + 8, 8);
    const col = this.chargeFull ? (pulse > 0.5 ? 0xffffff : 0x9ad8ff) : 0x6ec1ff;
    g.fillStyle(col, 1).fillRoundedRect(x, y, Math.max(6, bw * this.charge), bh, 5);
    g.fillStyle(0xffffff, 0.35).fillRect(x + 3, y + 2, Math.max(0, bw * this.charge - 6), 3);
    const key = this.chargedShotName();
    if (key !== this.chargeLabelKey) {
      this.chargeLabelKey = key;
      this.chargeLabel.setText(key);
    }
    this.chargeLabel.setPosition(h.x, y - 16);
  }

  // ---------------------------------------------------------------- golpes
  private handleBounce() {
    const s = this.ball.s;
    this.bounceFx(s.x, s.y);
    if (!this.lastHitter) return;
    if (this.serving) {
      if (this.inServiceBox(s.x, s.y)) {
        this.serving = false;
        this.bounces = 1;
      } else {
        this.outMark(s.x, s.y);
        this.serviceFault();
      }
      return;
    }
    const hitter = this.lastHitter;
    const receiver: Who = hitter === 'player' ? 'bot' : 'player';
    if (this.bounces === 0) {
      const onReceiverSide = hitter === 'player' ? s.x > NET_X : s.x < NET_X;
      if (!isInCourt(s.x, s.y) || !onReceiverSide) {
        this.outMark(s.x, s.y);
        this.pointTo(receiver, '¡FUERA!', '#ff7a85');
      } else {
        this.bounces = 1;
      }
    } else {
      this.pointTo(hitter, hitter === 'player' ? '¡PUNTO!' : 'Punto rival', hitter === 'player' ? '#8fd0ff' : '#ff9aa3');
    }
  }

  /** Distancia (en el suelo) entre la pelota y la raqueta del personaje. */
  private reachDist(a: Actor, s: BallState) {
    const dx = s.x - (a.x + a.dir * 15);
    const dy = (s.y - a.y) * 1.25;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private inReach(a: Actor, s: BallState = this.ball.s, range = HIT_RANGE, maxZ = HIT_MAX_Z) {
    if (a.vanished) return false;
    return this.reachDist(a, s) < range && s.z < maxZ;
  }

  /**
   * Estirada: solo si está cargando y la pelota pasa por el alcance ampliado pero
   * NO va a entrar en el alcance normal (el jugador está quieto, así que se puede predecir).
   * Se dispara en el punto más cercano de la trayectoria.
   */
  private shouldLunge() {
    const pl = this.player;
    const s0 = this.ball.s;
    if (!this.charging || pl.vanished || pl.stun > 0) return false;
    if (!this.inReach(pl, s0, LUNGE_RANGE, LUNGE_MAX_Z)) return false;
    const d0 = this.reachDist(pl, s0);
    const s = { ...s0 };
    let bounces = this.bounces;
    const dt = 1 / 120;
    for (let t = 0; t < 1.2; t += dt) {
      const ev = stepBall(s, dt);
      if (ev === 'net' || s.x >= NET_X) break;
      if (ev === 'bounce' && ++bounces >= 2) break;
      // llegará al alcance normal: golpe cargado de siempre, no hace falta estirarse
      if (this.inReach(pl, s)) return false;
      // más adelante pasa aún más cerca (y alcanzable): esperar a ese momento
      if (this.reachDist(pl, s) < d0 - 1 && this.inReach(pl, s, LUNGE_RANGE, LUNGE_MAX_Z)) return false;
    }
    return true;
  }

  /** El jugador se lanza a por la pelota y devuelve SIEMPRE un globo, casi cayéndose. */
  private playerLunge() {
    const s = this.ball.s;
    const pl = this.player;
    this.stopCharge();
    const side = s.y > pl.y ? 1 : -1; // lado de la pantalla hacia el que se tira
    pl.ch.facing = side;
    pl.ch.swing();

    // se desplaza parte del hueco hacia la pelota
    const tx = clamp(pl.x + (s.x - 15 - pl.x) * 0.55, P_X[0], P_X[1]);
    const ty = clamp(pl.y + (s.y - pl.y) * 0.55, Y_MIN, Y_MAX);
    this.tweens.add({ targets: pl, x: tx, y: ty, duration: 140, ease: 'Quad.easeOut' });
    // inclinación de "casi me caigo" y recuperación tambaleante
    const rig = pl.ch.rig;
    this.tweens.killTweensOf(rig);
    this.tweens.chain({
      targets: rig,
      tweens: [
        { angle: 38 * side, duration: 120, ease: 'Quad.easeOut' },
        { angle: 38 * side, duration: 220 },
        { angle: 0, duration: 520, ease: 'Elastic.easeOut', easeParams: [1.2, 0.45] },
      ],
    });
    pl.stun = LUNGE_RECOVER;
    this.dustFx(pl.x, pl.y);

    // devolución: globo alto y profundo
    const tgx = NET_X + (COURT.right - NET_X) * rand(0.6, 0.85);
    const tgy = LAT_C + rand(-0.45, 0.45) * (HALF_W - 30);
    s.z = Math.max(s.z, 18);
    aimShot(s, tgx, tgy, SHOT_SPEED * 0.72, 80);
    this.ball.setPower(false);
    this.ball.setKind('lob');
    this.lastHitter = 'player';
    this.bounces = 0;
    this.ai.onPlayerHit(false);
    this.hitFx(s.x, s.y, s.z, false);
    const h = this.headPos(pl);
    this.popText(h.x, h.y, '¡ESTIRADA!', '#ffe066', 30);
  }

  /** Polvo en los pies (estirada). */
  private dustFx(x: number, y: number) {
    const p = project(x, y);
    for (let i = 0; i < 6; i++) {
      const d = this.add
        .ellipse(p.sx + rand(-30, 30) * p.s, p.sy + rand(-4, 4), rand(14, 24) * p.s, rand(8, 12) * p.s, 0xe8e2d0, 0.7)
        .setDepth(p.sy + 1);
      this.tweens.add({ targets: d, x: d.x + rand(-40, 40) * p.s, y: d.y - rand(6, 20), scale: 1.8, alpha: 0, duration: rand(300, 480), onComplete: () => d.destroy() });
    }
  }

  private checkHits() {
    const s = this.ball.s;
    if (this.serving) return;
    if (this.lastHitter !== 'player' && s.x < NET_X && s.vx < 0) {
      if (this.inReach(this.player)) this.playerHit();
      else if (this.shouldLunge()) this.playerLunge();
    } else if (this.lastHitter !== 'bot' && s.x > NET_X && s.vx > 0 && this.bot.stun <= 0 && this.inReach(this.bot)) {
      if (this.ball.power) this.fireImpact();
      else this.botHit();
    }
  }

  private playerHit() {
    const s = this.ball.s;
    const power = this.smashArmed;
    // el SMASH tiene prioridad sobre el tiro cargado
    const charged = this.charging && !power;
    const c = this.charge;
    const volley = this.bounces === 0; // golpe antes de que bote = volea
    this.stopCharge();
    if (power) {
      this.smashArmed = false;
      this.smashBtn.setArmed(false);
      this.aura.stop();
    }
    this.player.ch.swing(power || charged);

    const depth = (a: number, b: number) => NET_X + (COURT.right - NET_X) * rand(a, b);
    const lat = (k: number) => LAT_C + clamp(k, -1, 1) * (HALF_W - 30);
    let tx: number;
    let ty: number;
    let speed = SHOT_SPEED;
    let margin = 18;
    let label: string | null = null;
    let kind: ShotKind = 'normal';
    let dead = false;

    if (power) {
      tx = depth(0.72, 0.9);
      ty = this.bot.y > LAT_C ? COURT.top + rand(25, 60) : COURT.bottom - rand(25, 60);
      speed = SHOT_SPEED * SMASH_SPEED_MULT;
      margin = 6;
    } else if (charged) {
      // tiro cargado: más rápido cuanto más carga; el joystick decide el tipo
      const shot = this.shotFromJoystick();
      const d = this.shotDir();
      if (volley) {
        // volea rápida y plana
        tx = depth(0.55, 0.8);
        ty = lat(d.x * 0.9 + rand(-0.15, 0.15));
        speed = SHOT_SPEED * (1.4 + 0.35 * c);
        margin = 6;
        label = '¡VOLEA!';
        kind = Math.abs(d.x) > 0.3 ? 'side' : 'normal';
      } else if (shot === 'drop') {
        // cortita muerta: casi no bota
        tx = depth(0.08, 0.2);
        ty = lat(d.x * 0.6 + rand(-0.2, 0.2));
        speed = SHOT_SPEED * (0.85 + 0.15 * c);
        margin = 5;
        dead = true;
        label = '¡CORTITA!';
        kind = 'drop';
      } else if (shot === 'lob') {
        // arriba: drive potente y profundo
        tx = depth(0.8, 0.95);
        ty = lat(d.x * 0.5 + rand(-0.3, 0.3));
        speed = SHOT_SPEED * (1.45 + 0.4 * c);
        margin = 8;
        label = '¡POTENTE!';
      } else if (shot === 'left' || shot === 'right') {
        tx = depth(0.55, 0.85);
        ty = lat((shot === 'left' ? -1 : 1) * rand(0.85, 1));
        speed = SHOT_SPEED * (1.3 + 0.3 * c);
        margin = 10;
        label = '¡CRUZADA!';
        kind = 'side';
      } else {
        tx = depth(0.65, 0.9);
        ty = lat(rand(-0.4, 0.4));
        speed = SHOT_SPEED * (1.25 + 0.3 * c);
        margin = 12;
        label = '¡CARGADO!';
      }
    } else {
      // tipo de golpe según el joystick JUSTO al golpear (o su última dirección reciente)
      const shot = this.shotFromJoystick();
      const d = this.shotDir();
      switch (shot) {
        case 'drop': // abajo: pelota corta, junto a la red
          tx = depth(0.1, 0.25);
          ty = lat(d.x * 0.6 + rand(-0.2, 0.2));
          speed = SHOT_SPEED * 0.8;
          margin = 8;
          label = '¡Corta!';
          kind = 'drop';
          break;
        case 'lob': // arriba: globo alto y profundo
          tx = depth(0.82, 0.94);
          ty = lat(d.x * 0.6 + rand(-0.2, 0.2));
          speed = SHOT_SPEED * 0.85;
          margin = 75;
          label = '¡Globo!';
          kind = 'lob';
          break;
        case 'left': // izquierda de la pantalla = y menor
          tx = depth(0.6, 0.88);
          ty = lat(-rand(0.75, 1));
          label = '◀';
          kind = 'side';
          break;
        case 'right':
          tx = depth(0.6, 0.88);
          ty = lat(rand(0.75, 1));
          label = '▶';
          kind = 'side';
          break;
        default: // neutro: golpe normal
          tx = depth(0.55, 0.88);
          ty = lat(rand(-0.35, 0.35));
      }
    }
    s.z = Math.max(s.z, 22);
    aimShot(s, tx, ty, speed, margin);
    if (dead) {
      s.damp = 0.22;
      s.fric = 0.5;
    }
    if (label && label.startsWith('¡')) {
      const h = this.headPos(this.player);
      this.popText(h.x, h.y, label, charged ? '#9ad8ff' : '#ffffff', charged ? 32 : 28);
    }
    if (charged) {
      // destello azul del impacto cargado
      const ap = project(s.x, s.y, s.z);
      const fl = this.add.image(ap.sx, ap.sy, 'fx-glow').setTint(0x6ec1ff).setBlendMode(Phaser.BlendModes.ADD).setDepth(3600).setScale(0.6);
      this.tweens.add({ targets: fl, scale: 2.5 + 2 * c, alpha: 0, duration: 260, onComplete: () => fl.destroy() });
      this.cameras.main.shake(90, 0.004 + 0.006 * c);
    }
    this.ball.setPower(power);
    this.ball.setKind(kind, charged);
    this.lastHitter = 'player';
    this.bounces = 0;
    this.ai.onPlayerHit(power);
    this.hitFx(s.x, s.y, s.z, power);
  }

  private botHit() {
    const s = this.ball.s;
    const ai = this.ai;
    this.bot.ch.swing();
    let tx = NET_X - (NET_X - COURT.left) * rand(0.55, 0.9);
    const toward = this.player.y > LAT_C ? -1 : 1; // hacia el lado contrario al jugador
    let ty = LAT_C + clamp(toward * ai.aimSkill * rand(0.4, 1) + rand(-0.4, 0.4) * (1 - ai.aimSkill), -1, 1) * (HALF_W - 28);
    if (Math.random() < ai.outChance) {
      if (Math.random() < 0.5) tx = COURT.left - rand(15, 55);
      else ty = Math.random() < 0.5 ? COURT.top - rand(15, 45) : COURT.bottom + rand(15, 45);
    }
    s.z = Math.max(s.z, 22);
    const sideways = Math.abs(ty - s.y) > 120;
    const short = tx > NET_X - (NET_X - COURT.left) * 0.3;
    aimShot(s, tx, ty, SHOT_SPEED * (0.82 + 0.3 * ai.d));
    this.ball.setPower(false);
    this.ball.setKind(short ? 'drop' : sideways ? 'side' : 'normal');
    this.lastHitter = 'bot';
    this.bounces = 0;
    ai.onBotHit();
    this.hitFx(s.x, s.y, s.z, false);
  }

  // ---------------------------------------------------------------- efectos
  private hitFx(bx: number, by: number, bz: number, power: boolean) {
    const p = project(bx, by, bz);
    const x = p.sx;
    const y = p.sy;
    const ring = this.add.circle(x, y, 14, 0xffffff, 0).setStrokeStyle(power ? 8 : 5, power ? 0xff8a1e : 0xffffff).setDepth(3500);
    this.tweens.add({ targets: ring, scale: power ? 4 : 2.4, alpha: 0, duration: power ? 380 : 240, onComplete: () => ring.destroy() });
    for (let i = 0; i < (power ? 10 : 5); i++) {
      const a = Math.random() * Math.PI * 2;
      const d = rand(30, power ? 90 : 50);
      const st = this.add.star(x, y, 4, 3, 8, power ? 0xffd23f : 0xffffff).setDepth(3500);
      this.tweens.add({ targets: st, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, alpha: 0, angle: 180, duration: 320, onComplete: () => st.destroy() });
    }
    if (power) {
      this.cameras.main.shake(160, 0.012);
      this.cameras.main.flash(120, 255, 200, 120);
      this.popText(x, y - 40, '¡SMASH!', '#ffb347', 44);
    }
  }

  private bounceFx(x: number, y: number) {
    const p = project(x, y);
    const e = this.add.ellipse(p.sx, p.sy, 20 * p.s, 8 * p.s, 0xffffff, 0.5).setDepth(1);
    this.tweens.add({ targets: e, scaleX: 2.6, scaleY: 2.6, alpha: 0, duration: 300, onComplete: () => e.destroy() });
  }

  private outMark(x: number, y: number) {
    const p = project(x, y);
    const g = this.add.graphics({ x: p.sx, y: p.sy }).setDepth(1).setScale(p.s);
    g.lineStyle(7, C.outline).lineBetween(-12, -6, 12, 6).lineBetween(-12, 6, 12, -6);
    g.lineStyle(4, 0xff4f5e).lineBetween(-12, -6, 12, 6).lineBetween(-12, 6, 12, -6);
    this.tweens.add({ targets: g, alpha: 0, delay: 900, duration: 300, onComplete: () => g.destroy() });
  }

  // ---------------------------------------------------------------- update
  /** Vector de entrada en pantalla: x = derecha, y = abajo. */
  private inputVector(): Phaser.Math.Vector2 {
    const v = this.joy.value.clone();
    const k = this.keys;
    if (k && v.lengthSq() === 0) {
      v.x = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
      v.y = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
      if (v.lengthSq() > 1) v.normalize();
    }
    return v;
  }

  /** Dirección para el golpe: joystick actual, o la última en los últimos 250 ms. */
  private shotDir(): Phaser.Math.Vector2 {
    const v = this.inputVector();
    if (v.lengthSq() > 0.09) return v;
    if (this.time.now - this.lastDirAt < 250) return this.lastDir.clone();
    return new Phaser.Math.Vector2();
  }

  /** abajo = corta, arriba = globo, izquierda/derecha = a esa esquina, neutro = normal. */
  private shotFromJoystick(): 'drop' | 'lob' | 'left' | 'right' | 'normal' {
    const d = this.shotDir();
    if (d.lengthSq() < 0.09) return 'normal';
    if (Math.abs(d.y) >= Math.abs(d.x)) return d.y > 0 ? 'drop' : 'lob';
    return d.x < 0 ? 'left' : 'right';
  }

  /** Raqueta del lado de la pelota (derecha/revés) cuando viene hacia el personaje. */
  private updateFacing(a: Actor) {
    const s = this.ball.s;
    const coming = a.dir > 0 ? s.vx < 0 : s.vx > 0;
    if (this.phase === 'rally' && coming && Math.abs(s.y - a.y) > 14) a.ch.facing = s.y > a.y ? 1 : -1;
  }

  private renderActors() {
    for (const a of [this.player, this.bot]) {
      const p = project(a.x, a.y);
      // con hipercarga el jugador crece un poco (como en Brawl Stars)
      const boost = a === this.player && this.aura.active ? 1.1 + Math.sin(this.time.now / 70) * 0.015 : 1;
      const k = p.s * VIEW.CHAR_K * boost;
      a.ch.setPosition(p.sx, p.sy).setScale(k * a.warp, k * (1 + (1 - a.warp) * 0.8)).setDepth(p.sy);
      a.ch.setAlpha(0.25 + 0.75 * a.warp);
    }
    this.aura.update(this.game.loop.delta / 1000);
    this.renderCharge();
    const h = this.headPos(this.bot);
    this.dizzy.setVisible(this.bot.stun > 0).setPosition(h.x, h.y);
  }

  update(_t: number, deltaMs: number) {
    if (this.paused) return;
    const dt = Math.min(deltaMs / 1000, 0.05);
    this.dashBtn.update(dt);
    this.smashBtn.update(dt);

    // --- jugador
    const pl = this.player;
    const frozen =
      this.charging ||
      pl.stun > 0 ||
      pl.vanished ||
      this.phase === 'over' ||
      this.phase === 'intro' ||
      ((this.phase === 'serve' || this.phase === 'toss') && this.server === 'player');
    if (pl.stun > 0) pl.stun -= dt;
    const raw = this.inputVector();
    const v = frozen ? new Phaser.Math.Vector2() : raw;
    // la dirección para apuntar se lee aunque el jugador esté quieto cargando
    if (raw.lengthSq() > 0.09) {
      this.lastDir.copy(raw);
      this.lastDirAt = this.time.now;
    }
    this.updateCharge(dt);
    // pantalla -> cancha: arriba = hacia la red (+x), derecha = +y
    pl.x = clamp(pl.x - v.y * PLAYER_SPEED * dt, P_X[0], P_X[1]);
    pl.y = clamp(pl.y + v.x * PLAYER_SPEED * dt, Y_MIN, Y_MAX);
    pl.ch.setMoving(v.lengthSq() > 0.01);
    this.updateFacing(pl);

    // --- bot
    const bt = this.bot;
    if (bt.stun > 0) bt.stun -= dt;
    const botFrozen = bt.stun > 0 || this.phase === 'over' || this.phase === 'intro' || ((this.phase === 'serve' || this.phase === 'toss') && this.server === 'bot');
    if (this.phase === 'rally') this.ai.update(dt, this.ball.s);
    if (!botFrozen) {
      const dx = this.ai.target.x - bt.x;
      const dy = this.ai.target.y - bt.y;
      const dist = Math.hypot(dx, dy);
      const step = Math.min(dist, this.ai.speed * dt);
      if (dist > 4) {
        bt.x += (dx / dist) * step;
        bt.y += (dy / dist) * step;
      }
      bt.x = clamp(bt.x, B_X[0], B_X[1]);
      bt.y = clamp(bt.y, Y_MIN, Y_MAX);
      bt.ch.setMoving(dist > 6);
    } else bt.ch.setMoving(false);
    this.updateFacing(bt);

    // --- pelota
    if (this.phase === 'serve' || this.phase === 'intro') {
      this.holdBall();
      this.ball.s.z = 62 + Math.sin(this.time.now / 150) * 4;
    } else if (this.phase === 'toss') {
      const srv = this.server === 'player' ? this.player : this.bot;
      const s = this.ball.s;
      s.x = srv.x + srv.dir * 10;
      s.y = srv.y + srv.ch.facing * 28;
      stepBall(s, dt);
      if (s.vz < 0 && s.z < 150) this.serveHit();
    } else if (this.phase === 'rally' || this.phase === 'pointover') {
      const sub = 3;
      for (let i = 0; i < sub; i++) {
        const ev = stepBall(this.ball.s, dt / sub);
        if (this.phase !== 'rally') continue;
        if (ev === 'net' && this.serving) this.serviceFault();
        else if (ev === 'net' && this.lastHitter) {
          const rec: Who = this.lastHitter === 'player' ? 'bot' : 'player';
          this.pointTo(rec, '¡RED!', '#ff7a85');
        } else if (ev === 'bounce') this.handleBounce();
        if (this.phase === 'rally') this.checkHits();
      }
    }

    this.ball.render(dt);
    this.renderActors();

    // cámara: sigue un poco al jugador en lateral (tipo Mario Tennis)
    const cam = this.cameras.main;
    const pp = project(pl.x, pl.y);
    const target = this.baseScrollX + (pp.sx - VIEW.W / 2) * VIEW.FOLLOW;
    cam.scrollX += (target - cam.scrollX) * Math.min(1, dt * 5);
  }
}







