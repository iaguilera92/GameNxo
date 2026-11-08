import Phaser from 'phaser';
import {
  ALLEY,
  COURT,
  DASH_COOLDOWN,
  GAMES_TO_WIN,
  HIT_MAX_Z,
  HIT_RANGE,
  KNOCKBACK_DIST,
  LUNGE_MAX_Z,
  LUNGE_RANGE,
  LUNGE_RECOVER,
  NET_HEIGHT,
  NET_X,
  GRAVITY,
  PLAYER_SPEED,
  SERVE,
  SERVE_SPEED,
  SHOT_SPEED,
  SIDE_MARGIN,
  SMASH_COOLDOWN,
  SMASH_SPEED_MULT,
} from '../config';
import { Ball, type BallState, type ShotKind, aimShot, isInCourt, stepBall } from '../objects/Ball';
import { Character, PLAYER_LOOK, playerLook, rivalLook } from '../objects/Character';
import type { BotAI } from '../logic/BotAI';
import { BotBrain } from '../ai/BotBrain';
import { profileForMatch, rivalLevelFor } from '../ai/BotProfile';
import { type ServeKind, ServeController } from '../logic/ServeController';
import { type BotServePlan, ServeAI } from '../logic/ServeAI';
import { NEON, ServeButton } from '../ui/ServeButton';
import { ChargeMeter } from '../ui/ChargeMeter';
import { BUTTON_ART, queueButtonArt } from '../ui/buttonArt';
import { ChargeAura, TIER_TRAIL, playImpact } from '../fx/shotFx';
import { getProfile } from '../logic/Profile';
import { HyperAura } from '../objects/HyperAura';
import { Score } from '../logic/Score';
import { ABILITIES } from '../logic/Abilities';
import { Joystick } from '../ui/Joystick';
import { ScoreBoard } from '../ui/ScoreBoard';
import { showConfirm } from '../ui/ConfirmDialog';
import { AbilityButton } from '../ui/AbilityButton';
import { C, textStyle } from '../ui/theme';
import { VIEW, project } from '../view/projection';
import { drawCourtView } from '../view/CourtView';
import { LOB_SMASH, LobTracker } from '../logic/LobSmash';
import { LobMarker, superSmashFx } from '../fx/LobMarker';
import { SmokeTrail } from '../fx/SmokeTrail';
import { SmashCinematic, smashCineEnabled, spritesIn } from '../fx/SmashCinematic';
import { INFERNO, INFERNO_CINE, InfernoDrive, planInfernoContact } from '../logic/InfernoDrive';
import { GhostTrail, InfernoFire, infernoImpactFx, infernoShake, infernoSound, queueInfernoArt } from '../fx/InfernoFx';
import { POWER_IMPACT, type PowerKind, knockbackX, stunSeconds } from '../logic/PowerImpact';
import { infernoGroundFx, powerImpactFx } from '../fx/ImpactFx';
import { playMatchEnd } from '../fx/matchEnd';
import { playMatchIntro } from '../fx/matchIntro';
import { ServeTurnTag } from '../ui/ServeTurnTag';
import { setupUiCamera } from '../view/uiCamera';
import { TIMING, TimingTracker, type ShotClass, type TimingResult, applyError, evaluateCharge, timedSpeed, timingMods } from '../logic/PerfectTiming';
import { perfectSound, playTimingFx, vibrate } from '../fx/timingFx';
import { MOTION, type MotionEvent, createMotion, stepMotion, stopMotion } from '../logic/PlayerMotion';
import { DASH, type DashRun, createRun, guaranteeStep, planSprint, sampleTrajectory, shouldCancelRun, stepRun } from '../logic/DashSprint';
import { DashFx } from '../fx/dashFx';
import { WALL, type WallGeom, wallFromArt, wallHit, wallOutcome } from '../logic/BackWall';
import { WallFx } from '../fx/wallFx';

type Who = 'player' | 'bot';

/** Bandera de desarrollo en localStorage ('1' = activa), como dev.botDebug. */
function devFlagOn(key: string) {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}
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

/** Solo animación: altura de pelota desde la que el golpe del jugador se muestra como remate. */
const OVERHEAD_Z = 116;
/**
 * Salto del saque: `racketTop` = altura de la raqueta en el fotograma de contacto del saque, en unidades
 * del personaje (medido: borde superior del sprite ≈ 193); `max` = salto máximo.
 */
const SERVE_JUMP = { racketTop: 185, max: 190, hangMs: 70, fallMs: 300 };
/** Solo animación: distancia (suelo) a la que el jugador se pone en guardia esperando la pelota. */
const READY_DIST = 200;
/** DASH: tiempos del teletransporte (s). El rápido se usa cuando la pelota llega muy justa. */
const DASH_WARP = { out: 0.11, delay: 0.04, in: 0.18, fastOut: 0.05, fastIn: 0.07 };

export class MatchScene extends Phaser.Scene {
  private botName = 'Bot';
  /** nivel del rival → su perfil de dificultad (src/ai/BotProfile.ts) */
  private rivalLevel = 1;
  private player!: Actor;
  private bot!: Actor;
  private ball!: Ball;
  /** cerebro del rival (src/ai/BotBrain.ts): movimiento + plan de golpe */
  private brain!: BotBrain;
  /** reacción y predicción del rival (lo reutiliza el cerebro) */
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
  /** globo en vuelo: caída prevista y reglas del SMASH potenciado (src/logic/LobSmash.ts) */
  private lob = new LobTracker();
  private lobMarker!: LobMarker;
  /** el SMASH se armó dentro de la ventana del globo (si al golpear se cumple todo, sale potenciado) */
  private superArmed = false;
  /** humo del SMASH en vuelo; `superFlight` = el SMASH en vuelo es el potenciado (humo fuerte) */
  private smoke!: SmokeTrail;
  /** "TU SAQUE" / "SACA <RIVAL>" sobre la cabeza de quien saca */
  private serveTag!: ServeTurnTag;
  /** el lanzamiento actual empezó con el botón verde (puede salir saque DIRECTO) */
  private serveDirect = false;
  /** 0..1: cuánto zoom de remate hay (jugador dentro del círculo del globo) */
  private lobZoomK = 0;
  /** DASH en curso: el jugador espera en el punto y la devolución se fuerza en `t` s si hace falta */
  private dashHit: { t: number; elapsed: number; x: number; y: number; sprint?: true } | null = null;
  /** DASH sprint en curso (src/logic/DashSprint.ts): mueve al jugador en arranque / sprint / frenada */
  private dashRun: DashRun | null = null;
  private dashFx!: DashFx;
  /** pared del fondo del rival tal como está dibujada (src/logic/BackWall.ts); la calcula drawCourt */
  private backWall: WallGeom | null = null;
  private wallFx!: WallFx;
  // Perfect Timing (src/logic/PerfectTiming.ts): reloj de simulación (s, avanza con el dt de la física)
  private timing = new TimingTracker();
  private simClock = 0;
  /** performance.now() al terminar el último update (para pasar los toques al reloj de simulación) */
  private simRealAt = 0;
  /** instante (reloj de simulación) del subpaso de física en curso: es el instante real del contacto */
  private contactClock = 0;
  /** instante en que la carga en curso llegó al 100 % (null = aún no) */
  private chargeFullAt: number | null = null;
  private chargeAt = 0;
  /** velocidad del jugador con inercia ligera (src/logic/PlayerMotion.ts) */
  private motion = createMotion();
  /** viñeta de la toma especial del remate (fija en pantalla, bajo el HUD) */
  private lobVignette!: Phaser.GameObjects.Graphics;
  private superFlight = false;
  /** cinemática de 1 s del SMASH especial (fx/SmashCinematic.ts): mientras está activa el partido no avanza */
  private cine!: SmashCinematic;
  /** INFERNO DRIVE (logic/InfernoDrive.ts): carga por puntos ganados; usa el botón SMASH cuando está cargada */
  private inferno = new InfernoDrive();
  private ghosts!: GhostTrail;
  private fire!: InfernoFire;
  /** playerHit en curso es el de INFERNO DRIVE (lo pone la cinemática justo antes de golpear) */
  private infernoPending = false;
  /** la pelota en vuelo es un INFERNO DRIVE (fuego en espiral) */
  private infernoFlight = false;
  /** salto del saque en curso (solo visual: desplaza el `rig` del personaje) */
  private serveJumpState?: { a: Actor; t: number; up: number; rise: number };
  /** el INFERNO en vuelo ya hizo su explosión de suelo (o impactó al rival antes) */
  private infernoBounced = true;
  /** saque en curso (la pelota aún no ha botado en el cuadro de saque) */
  private serving = false;
  /** faltas del saque actual (2 = doble falta) */
  private faults = 0;
  private serveBox = { x0: 0, x1: 0, y0: 0, y1: 0 };
  private serveHint?: Phaser.GameObjects.Graphics;
  // saque manual: estado, IA del rival y controles propios (sustituyen a DASH/SMASH mientras se saca)
  private serveCtl = new ServeController();
  private serveAI = new ServeAI();
  private botPlan!: BotServePlan;
  private botServeY = 0;
  /** tramo permitido (y) de la línea de fondo para colocarse al sacar: la mitad del lado de servicio */
  private serveZone: [number, number] = [0, 0];
  private serveLet = false;
  /** golpe con la pelota muy baja: va a la red y el punto se pierde (no es una simple falta) */
  private serveNetLoss = false;
  /** segundos que le quedan al jugador para sacar (0 = sin cuenta) */
  private serveClock = 0;
  private serveClockText!: Phaser.GameObjects.Text;
  private serveNormalBtn!: ServeButton;
  private serveSpinBtn!: ServeButton;
  private serveAim!: Phaser.GameObjects.Graphics;
  private secondTag!: Phaser.GameObjects.Text;
  private aura!: HyperAura;
  // tiro cargado (tocar la mitad derecha de la pantalla)
  private charging = false;
  /** 0..1 */
  private charge = 0;
  private chargeFull = false;
  private ringGold = false;
  private chargeRing!: Phaser.GameObjects.Ellipse;
  /** indicador semicircular único de potencia + dirección (ui/ChargeMeter) y brillo del personaje */
  private chargeMeter!: ChargeMeter;
  private chargeAura!: ChargeAura;
  private dizzy!: Phaser.GameObjects.Container;

  // HUD
  private hud!: Phaser.GameObjects.Container;
  /** marcador visual (ui/ScoreBoard): solo dibuja, los datos salen de this.score */
  private board!: ScoreBoard;

  constructor() {
    super('Match');
  }

  preload() {
    queueButtonArt(this.load); // imágenes de DASH, SMASH y los dos saques (si faltan, se dibujan como antes)
    queueInfernoArt(this.load); // bola de fuego animada de INFERNO DRIVE (si falta, se dibuja por código)
  }

  init(data: { botName?: string; rivalLevel?: number }) {
    this.botName = data?.botName ?? 'Bot';
    // nivel del rival (lo elige el matchmaking y se mantiene en la revancha); sin él, uno cercano al tuyo
    this.rivalLevel = data?.rivalLevel ?? rivalLevelFor(getProfile().level);
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
    this.paused = false;
    this.dialog = [];

    this.cameras.main.fadeIn(250, 0, 0, 0);
    // HUD/botones en su propia cámara: el zoom del partido no los mueve (view/uiCamera.ts)
    setupUiCamera(this);
    this.lobZoomK = 0;
    this.lobVignette = this.makeVignette();
    this.dashHit = null;
    this.timing.clear();
    stopMotion(this.motion);
    this.dashRun = null;
    this.dashFx = new DashFx(this, DASH);
    this.wallFx = new WallFx(this);
    this.simClock = 0;
    this.simRealAt = performance.now();
    this.contactClock = 0;
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
    this.player = mk(playerLook(getProfile().skin), 'back', COURT.left - 40, 1);
    this.bot = mk(rivalLook(getProfile().skin), 'front', COURT.right + 40, -1);
    this.aura = new HyperAura(this, this.player.ch);
    this.chargeRing = this.add
      .ellipse(0, 0, 120, 40, 0x6ec1ff, 0.25)
      .setStrokeStyle(5, 0xd6f0ff, 0.9)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
    this.chargeMeter = new ChargeMeter(this);
    this.chargeAura = new ChargeAura(this);
    this.dizzy = this.makeDizzy();
    this.ball = new Ball(this);
    this.brain = new BotBrain({ xMin: B_X[0], xMax: B_X[1], yMin: Y_MIN, yMax: Y_MAX }, profileForMatch(this.rivalLevel));
    this.ai = this.brain.ai;
    this.score = new Score();

    this.createHud();
    this.joy = new Joystick(this);
    const d = ABILITIES.dash;
    const s = ABILITIES.smash;
    this.dashBtn = new AbilityButton(this, 0, 0, 54, DASH_COOLDOWN, d.color, d.colorDark, d.icon, 'DASH', () => this.activateDash());
    this.smashBtn = new AbilityButton(this, 0, 0, 64, SMASH_COOLDOWN, s.color, s.colorDark, s.icon, 'SMASH', () => (this.smashBtn.inferno ? this.armInferno() : this.activateSmash()));
    this.dashBtn.setArt(BUTTON_ART.dash.key);
    this.smashBtn.setArt(BUTTON_ART.smash.key);
    this.surrenderBtn = this.makeSurrenderIcon();

    // controles de saque: raqueta dorada = normal, pelota girando violeta = con efecto
    this.serveCtl = new ServeController();
    this.serveAI = new ServeAI();
    this.serveLet = false;
    this.serveNormalBtn = new ServeButton(this, 0, 0, 64, 'serveRacket', 0xffb020, 0xc46a00, () => this.onServeButton('normal'));
    this.serveSpinBtn = new ServeButton(this, 0, 0, 58, 'serveSpin', 0x8a6bff, 0x4a35b8, () => this.onServeButton('spin'));
    this.serveNormalBtn.setArt(BUTTON_ART.serve.key);
    this.serveSpinBtn.setArt(BUTTON_ART.spin.key);
    this.serveNormalBtn.show(false);
    this.serveSpinBtn.show(false);
    this.serveAim = this.add.graphics().setDepth(0.8).setVisible(false);
    // globo: indicador de caída sobre el suelo + estado del SMASH potenciado
    this.lob = new LobTracker();
    this.lobMarker = new LobMarker(this);
    this.superArmed = false;
    this.smoke = new SmokeTrail(this);
    this.cine = new SmashCinematic(this);
    // INFERNO DRIVE: la carga empieza en 0 en cada partido
    this.inferno = new InfernoDrive();
    this.ghosts = new GhostTrail(this);
    this.fire = new InfernoFire(this);
    this.infernoPending = false;
    this.infernoFlight = false;
    this.smashBtn.setMeter(0, INFERNO.pointsToCharge);
    this.serveTag = new ServeTurnTag(this, this.botName);
    this.superFlight = false;
    this.secondTag = this.add.text(0, 0, '2º SAQUE', textStyle(20, '#ffd23f')).setOrigin(0.5).setScrollFactor(0).setDepth(5500).setVisible(false);
    this.serveClockText = this.add.text(0, 0, '', textStyle(40, '#ffd23f')).setOrigin(0.5).setScrollFactor(0).setDepth(5500).setVisible(false);
    this.serveClock = 0;
    this.serveNetLoss = false;

    const kb = this.input.keyboard;
    if (kb) {
      this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,Q,E,J,K') as Record<string, Phaser.Input.Keyboard.Key>;
      // al sacar, E/K = saque normal y Q/J = saque con efecto; el resto del tiempo, SMASH y DASH
      kb.on('keydown-Q', () => (this.serveUiOn() ? this.serveSpinBtn.press() : this.dashBtn.tryActivate()));
      kb.on('keydown-J', () => (this.serveUiOn() ? this.serveSpinBtn.press() : this.dashBtn.tryActivate()));
      kb.on('keydown-E', () => (this.serveUiOn() ? this.serveNormalBtn.press() : this.smashBtn.tryActivate()));
      kb.on('keydown-K', () => (this.serveUiOn() ? this.serveNormalBtn.press() : this.smashBtn.tryActivate()));
      kb.on('keydown-SPACE', (e?: KeyboardEvent) => this.toggleCharge(e?.timeStamp));
      kb.on('keydown-L', (e?: KeyboardEvent) => this.toggleCharge(e?.timeStamp));
    }
    // Toque en la mitad derecha = tiro cargado. Prioridad baja: si el toque cae sobre
    // un botón (SMASH, DASH, rendirse...) gana el botón y aquí no se hace nada.
    const onTap = (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length > 0) return;
      if (p.x < this.scale.width * 0.55) return; // la izquierda es del joystick
      // al sacar, la mitad derecha = saque normal (1er toque lanza la pelota, 2º golpea)
      if (this.serveUiOn()) {
        this.onServeButton('normal', true);
        return;
      }
      this.toggleCharge(p.event?.timeStamp);
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
    // botones correctos desde el principio: si saca el jugador, solo los de saque (no DASH/SMASH)
    this.setServeUi(this.server === 'player');
    // presentación (≤ 2 s): mapa de lejos que se acerca, oscurecido, "INICIO" (fx/matchIntro.ts)
    playMatchIntro(this, () => this.startPoint());
  }

  /** Viñeta (bordes oscuros que se desvanecen hacia el centro) para la toma especial del remate. */
  private makeVignette() {
    const g = this.add.graphics().setScrollFactor(0).setDepth(4900).setVisible(false).setAlpha(0);
    const draw = () => {
      const W = this.scale.width;
      const H = this.scale.height;
      const c = 0x02060f;
      const bh = H * 0.24;
      const bw = W * 0.2;
      g.clear();
      g.fillGradientStyle(c, c, c, c, 1, 1, 0, 0).fillRect(0, 0, W, bh);
      g.fillGradientStyle(c, c, c, c, 0, 0, 1, 1).fillRect(0, H - bh, W, bh);
      g.fillGradientStyle(c, c, c, c, 1, 0, 1, 0).fillRect(0, 0, bw, H);
      g.fillGradientStyle(c, c, c, c, 0, 1, 0, 1).fillRect(W - bw, 0, bw, H);
    };
    draw();
    this.scale.on('resize', draw);
    this.events.once('shutdown', () => this.scale.off('resize', draw));
    return g;
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
    this.serveNormalBtn.setPosition(W - 110, H - 225);
    this.serveSpinBtn.setPosition(W - 250, H - 115);
    this.serveClockText.setPosition(W / 2, 200);
    this.secondTag.setPosition(W / 2, 144); // bajo el marcador (ScoreBoard mide ~120 px con la píldora JUEGO)
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
    if (this.paused || this.phase === 'over' || this.cine.active) return;
    this.paused = true;
    this.time.paused = true;
    this.joy.release();
    this.joy.enabled = false;

    // diálogo (diseño en ui/ConfirmDialog.ts): RENDIRSE se habilita tras 6 s de cuenta atrás
    this.dialog = showConfirm(this, {
      title: '¿RENDIRSE?',
      message: '¿Seguro que quieres rendirte?',
      detail: 'El partido contará como derrota',
      confirmLabel: 'RENDIRSE',
      cancelLabel: 'SEGUIR',
      onConfirm: () => this.surrender(),
      onCancel: () => this.closeSurrender(),
      lockSeconds: 6,
      depth: 8000,
    });
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
    const WALL_Z = 70; // altura de los muros/valla

    // --- fondo: cielo urbano (atardecer suave) + asfalto
    g.fillGradientStyle(0x3a4a7a, 0x3a4a7a, 0x5a6aa0, 0x5a6aa0, 1);
    g.fillRect(-1500, -1000, VIEW.W + 3000, VIEW.H + 1200);

    // --- skyline: siluetas de edificios detrás del muro del fondo
    const backWall = this.P(ax1, LAT_C, WALL_Z).y;
    const sky = [0x272c4a, 0x2f355a, 0x242843];
    let bx = -400;
    let i = 0;
    while (bx < VIEW.W + 400) {
      const bw2 = 80 + ((i * 53) % 90);
      const bh2 = 120 + ((i * 97) % 260);
      g.fillStyle(sky[i % sky.length]).fillRect(bx, backWall - bh2, bw2, bh2);
      // ventanas iluminadas
      g.fillStyle(0xffd97a, 0.5);
      for (let wy = backWall - bh2 + 16; wy < backWall - 14; wy += 24)
        for (let wx = bx + 10; wx < bx + bw2 - 10; wx += 20) if ((wx * 7 + wy * 3) % 5 < 2) g.fillRect(wx, wy, 8, 12);
      bx += bw2 + 14;
      i++;
    }

    // --- muro de ladrillo del fondo con graffiti
    const wallTop = backWall;
    const wallBot = this.P(ax1, LAT_C, 0).y;
    g.fillStyle(0x6b7a9a).fillRect(-1500, wallTop, VIEW.W + 3000, wallBot - wallTop);
    g.fillStyle(0x5a6788).fillRect(-1500, wallTop, VIEW.W + 3000, 8);
    g.lineStyle(2, 0x4a5572, 0.6);
    const brickH = 22;
    for (let r = 0, y = wallTop + brickH; y < wallBot; r++, y += brickH) {
      g.lineBetween(-1500, y, VIEW.W + 1500, y);
      for (let x = -1500 + (r % 2) * 40; x < VIEW.W + 1500; x += 80) g.lineBetween(x, y - brickH, x, y);
    }
    // graffiti azul/amarillo con corona (identidad del juego)
    const gcx = VIEW.W / 2;
    const gcy = (wallTop + wallBot) / 2;
    g.fillStyle(0x1b5fc2, 0.9).fillEllipse(gcx, gcy, 360, 150);
    g.fillStyle(0x3aa6ff, 0.9).fillEllipse(gcx, gcy - 6, 330, 128);
    for (let k = -1; k <= 1; k++) {
      g.fillStyle(C.yellow).fillTriangle(gcx + k * 60 - 26, gcy - 10, gcx + k * 60 + 26, gcy - 10, gcx + k * 60, gcy - 56);
    }
    g.fillStyle(C.yellow).fillRect(gcx - 86, gcy - 10, 172, 26);

    // --- asfalto exterior de la cancha (gris urbano con textura)
    g.fillStyle(0x4b5168);
    this.quad(g, ax0 - 400, ay0, ax1, ay1);
    g.fillStyle(0x454b60, 0.6);
    for (let x = ax0 - 380; x < ax1; x += 150) this.quad(g, x, ay0, x + 4, ay1);

    // --- valla metálica (malla) en los lados y el fondo: postes + alambrado translúcido
    const mesh = (pts: Phaser.Math.Vector2[]) => {
      // sombra de la malla
      g.fillStyle(0x20263d, 0.28).fillPoints(pts, true);
      g.lineStyle(2, 0xaab2cc, 0.33);
      const [tl, bl, br, tr] = pts;
      const STEP = 0.07;
      for (let t = 0; t <= 1.001; t += STEP) {
        g.lineBetween(tl.x + (tr.x - tl.x) * t, tl.y + (tr.y - tl.y) * t, bl.x + (br.x - bl.x) * t, bl.y + (br.y - bl.y) * t);
        g.lineBetween(tl.x + (bl.x - tl.x) * t, tl.y + (bl.y - tl.y) * t, tr.x + (br.x - tr.x) * t, tr.y + (br.y - tr.y) * t);
      }
      g.lineStyle(5, C.outline).strokePoints(pts, true);
    };
    const post = (x: number, y: number) => {
      const b = this.P(x, y, 0);
      const t = this.P(x, y, WALL_Z);
      g.lineStyle(10, C.outline).lineBetween(b.x, b.y, t.x, t.y);
      g.lineStyle(5, 0x9aa4bf).lineBetween(b.x, b.y, t.x, t.y);
      g.fillStyle(0xcfd6e6).fillCircle(t.x, t.y - 2, 5);
    };
    // fondo
    mesh([this.P(ax1, ay0, WALL_Z), this.P(ax1, ay0, 0), this.P(ax1, ay1, 0), this.P(ax1, ay1, WALL_Z)]);
    // laterales
    for (const wallY of [ay0, ay1]) {
      mesh([this.P(ax0 - 300, wallY, WALL_Z), this.P(ax0 - 300, wallY, 0), this.P(ax1, wallY, 0), this.P(ax1, wallY, WALL_Z)]);
      for (let x = ax0 - 200; x <= ax1; x += 240) post(x, wallY);
    }
    for (let y = ay0; y <= ay1; y += 220) post(ax1, y);

    // --- pista: borde grueso, superficie urbana azul/amarillo que combina con los personajes
    g.lineStyle(10, C.outline, 1);
    const dT = COURT.top - ALLEY;
    const dB = COURT.bottom + ALLEY;
    g.strokePoints([this.P(COURT.left - 6, dT - 6), this.P(COURT.left - 6, dB + 6), this.P(COURT.right + 6, dB + 6), this.P(COURT.right + 6, dT - 6)], true);
    // pasillos (dobles) en un azul más apagado; zona de individuales más viva
    g.fillStyle(0x2456a8);
    this.quad(g, COURT.left, dT, COURT.right + 1, dB);
    const bands = 10;
    for (let b = 0; b < bands; b++) {
      const x0 = COURT.left + ((COURT.right - COURT.left) * b) / bands;
      const x1 = COURT.left + ((COURT.right - COURT.left) * (b + 1)) / bands;
      const t = b / (bands - 1);
      const col = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(0x3f8be8),
        Phaser.Display.Color.ValueToColor(0x2a63c0),
        1,
        t,
      );
      g.fillStyle(Phaser.Display.Color.GetColor(col.r, col.g, col.b));
      this.quad(g, x0, COURT.top, x1 + 1, COURT.bottom);
    }
    // corona central tenue en el suelo (marca de la casa)
    const mc = this.P(NET_X, LAT_C);
    g.fillStyle(C.yellow, 0.1);
    for (let k = -1; k <= 1; k++) g.fillTriangle(mc.x + k * 34 - 16, mc.y, mc.x + k * 34 + 16, mc.y, mc.x + k * 34, mc.y - 30);

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

    // ambiente-1 + cancha nueva (view/CourtView.ts); si falta la imagen, se usa este dibujo de siempre
    const drawn = drawCourtView(this);
    // pared del fondo donde se ve: la del estadio (muro + valla) o, en el dibujo de siempre, la valla de x = ax1 (z 70)
    this.backWall = drawn ? wallFromArt(project, LAT_C, drawn.wallAtY, drawn.padPx, drawn.fencePx, VIEW.Z_K) : { x: ax1, padZ: WALL_Z, fenceZ: WALL_Z };
    if (!drawn) {
      const BX = -1000;
      const BY = 0;
      const baked = this.add.renderTexture(BX, BY, 2720, 1800).setOrigin(0).setDepth(-10);
      baked.draw(g, -BX, -BY);
    }
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
    // marcador nuevo (diseño en ui/ScoreBoard.ts); misma posición/profundidad que el anterior
    this.board = new ScoreBoard(this, { player: 'TÚ', rival: this.botName, gamesToWin: GAMES_TO_WIN });
    this.hud = this.board.setDepth(5500);
  }

  private updateHud() {
    this.board.setScore({
      labels: this.score.labels(),
      games: this.score.games,
      gameIndex: this.score.gameIndex,
      server: this.score.server,
    });
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
    if (this.paused || this.cine.active) return false;
    if (this.phase !== 'rally' || this.lastHitter !== 'bot' || this.player.vanished) {
      this.popText(this.headPos(this.player).x, this.headPos(this.player).y, 'Espera la pelota', '#cfe0ff', 24);
      return false;
    }
    // DASH avanzado: sprint visible hacia la pelota (dev.dashSprint = '0' → el teletransporte de siempre, abajo)
    if (this.dashSprintOn()) return this.startDashSprint();
    // DASH = devolución ASEGURADA: se busca un punto de golpeo antes del 2º bote (también si la pelota
    // aún no ha pasado la red). Con tiempo, teletransporte normal; si va justo, uno rápido.
    const normal = this.dashPlan(DASH_WARP.out + DASH_WARP.delay + DASH_WARP.in + 0.02);
    const plan = normal ?? this.dashPlan(DASH_WARP.fastOut + DASH_WARP.fastIn + 0.02);
    if (!plan) {
      const h = this.headPos(this.player);
      this.popText(h.x, h.y, '¡Muy tarde!', '#cfe0ff', 24);
      return false;
    }
    const fast = !normal;
    const tx = clamp(plan.x - 18, P_X[0], P_X[1]);
    const ty = clamp(plan.y, Y_MIN, Y_MAX);

    const pl = this.player;
    this.stopCharge();
    pl.vanished = true;
    this.dashHit = { t: plan.t, elapsed: 0, x: tx, y: ty };
    this.portalFx(pl.x, pl.y);
    this.tweens.add({
      targets: pl,
      warp: 0,
      duration: (fast ? DASH_WARP.fastOut : DASH_WARP.out) * 1000,
      ease: 'Quad.easeIn',
      onComplete: () => {
        pl.x = tx;
        pl.y = ty;
        this.portalFx(tx, ty);
        this.tweens.add({
          targets: pl,
          warp: 1,
          duration: (fast ? DASH_WARP.fastIn : DASH_WARP.in) * 1000,
          delay: fast ? 0 : DASH_WARP.delay * 1000,
          ease: 'Back.easeOut',
          onComplete: () => (pl.vanished = false),
        });
      },
    });
    return true;
  }

  /**
   * Punto donde el DASH devuelve la pelota: el primero a partir de `minT` s en el campo del jugador,
   * alcanzable (dentro de su zona y a altura de golpe) y ANTES del 2º bote. Prefiere tras el 1er bote;
   * si no hay, volea. null = imposible (va a la red o bota dos veces antes).
   */
  private dashPlan(minT: number): { x: number; y: number; t: number } | null {
    const s = { ...this.ball.s };
    let bounces = this.bounces;
    let volley: { x: number; y: number; t: number } | null = null;
    const dt = 1 / 120;
    for (let t = 0; t < 4; t += dt) {
      const ev = stepBall(s, dt);
      if (ev === 'net') return null;
      if (ev === 'bounce' && s.x < NET_X && ++bounces >= 2) break;
      if (t < minT || s.x > NET_X - 30) continue;
      const reachable = s.x >= P_X[0] - 20 && s.x <= P_X[1] + 30 && s.y >= Y_MIN - 30 && s.y <= Y_MAX + 30 && s.z < HIT_MAX_Z * 0.85;
      if (!reachable) continue;
      if (bounces >= 1 && s.z < HIT_MAX_Z * 0.7) return { x: s.x, y: s.y, t };
      if (!volley) volley = { x: s.x, y: s.y, t };
    }
    return volley;
  }

  /**
   * Tras un DASH el jugador se queda en el punto y la devolución está garantizada: si al llegar el
   * momento previsto la pelota aún no se ha golpeado (por el alcance justo, el teletransporte…), se golpea igual.
   */
  private updateDashHit(dt: number) {
    const d = this.dashHit;
    if (!d) return;
    if (d.sprint) {
      // DASH sprint: garantía mientras siga a ≤ DASH.leash del punto de llegada; golpe forzado una sola vez
      const s = this.ball.s;
      const pl = this.player;
      const r = guaranteeStep(d, dt, {
        rally: this.phase === 'rally',
        playerHit: this.lastHitter === 'player',
        running: this.dashRun !== null,
        px: pl.x,
        py: pl.y,
        ballOk: s.x < NET_X && s.vx < 0 && this.bounces < 2,
      });
      if (r === 'drop') this.dashHit = null;
      else if (r === 'force') {
        this.dashHit = null;
        // NOTA para Claude (NOTAS-CLAUDE.txt): con el SMASH armado este golpe forzado sale sin su cinemática
        // (pasaba igual con el DASH de teletransporte). No se toca aquí.
        this.playerHit(true);
      }
      return;
    }
    if (this.phase !== 'rally' || this.lastHitter === 'player') {
      this.dashHit = null;
      return;
    }
    d.elapsed += dt;
    const s = this.ball.s;
    if (d.elapsed >= d.t + 0.02 && s.x < NET_X && s.vx < 0 && this.bounces < 2) {
      this.dashHit = null;
      this.player.vanished = false;
      this.player.warp = 1;
      this.playerHit(true);
    }
  }

  /** ¿DASH como sprint? (DASH.enabled y sin localStorage 'dev.dashSprint' = '0') */
  private dashSprintOn() {
    if (!DASH.enabled) return false;
    try {
      return localStorage.getItem('dev.dashSprint') !== '0';
    } catch {
      return true;
    }
  }

  /**
   * DASH avanzado: sprint visible (2,5× la velocidad normal, hasta 3,5× solo si hace falta) al punto donde la
   * devolución está asegurada. Mismo alcance y reglas que el DASH de siempre (sampleTrajectory = dashPlan).
   */
  private startDashSprint(): boolean {
    const pl = this.player;
    if (this.dashRun) return false;
    const bounds = { xMin: P_X[0], xMax: P_X[1], yMin: Y_MIN, yMax: Y_MAX };
    const box = { xMin: P_X[0] - 20, xMax: P_X[1] + 30, yMin: Y_MIN - 30, yMax: Y_MAX + 30 };
    const smp = sampleTrajectory(this.ball.s, this.bounces, stepBall, NET_X, HIT_MAX_Z, box);
    const plan = smp ? planSprint(smp, { x: pl.x, y: pl.y }, PLAYER_SPEED, bounds) : null;
    if (!plan) {
      const h = this.headPos(pl);
      this.popText(h.x, h.y, '¡Muy tarde!', '#cfe0ff', 24);
      return false;
    }
    this.stopCharge();
    stopMotion(this.motion);
    this.dashRun = createRun({ x: pl.x, y: pl.y }, plan, PLAYER_SPEED);
    this.dashHit = { t: plan.t, elapsed: 0, x: plan.x, y: plan.y, sprint: true };
    pl.ch.setSprint(true, this.dashRun.dirX);
    const p = project(pl.x, pl.y);
    this.dashFx.burst(p.sx, p.sy, p.s * VIEW.CHAR_K, pl.ch.depth);
    return true;
  }

  /**
   * Cada fotograma (antes del movimiento normal): mueve al jugador por el sprint. Se cancela si ya hubo golpe
   * (normal, SMASH o INFERNO DRIVE: estos tienen prioridad), si hay cinemática especial o si acaba el peloteo.
   */
  private updateDashSprint(dt: number) {
    const r = this.dashRun;
    if (!r) return;
    const pl = this.player;
    if (shouldCancelRun({ rally: this.phase === 'rally', playerHit: this.lastHitter === 'player', specialActive: this.cine.active || this.inferno.executing })) {
      this.dashRun = null;
      pl.ch.setSprint(false, r.dirX, false); // si ya hay un golpe en marcha, el golpe manda
      return;
    }
    const st = stepRun(r, dt);
    pl.x = st.pos.x;
    pl.y = st.pos.y;
    if (st.ghosts.length) {
      this.renderActors(); // la sombra copia la pose en la posición real de este instante
      for (const i of st.ghosts) this.dashFx.ghost(pl.ch, i, pl.ch.depth);
    }
    if (st.entered === 'land') pl.ch.setSprint(false, r.dirX, true);
    if (st.phase === 'done') {
      this.dashRun = null;
      pl.ch.setSprint(false, r.dirX, false); // por si no hubo frenada (recorrido nulo)
      stopMotion(this.motion); // libre, con la inercia normal desde 0
    }
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
    if (this.paused || this.cine.active ||this.phase === 'over' || this.phase === 'intro' || this.smashArmed) return false;
    this.smashArmed = true;
    // armado dentro de la ventana del globo: candidato a SMASH potenciado (antes de abrirse = demasiado pronto)
    this.superArmed = this.lob.windowOpenFor('player', this.player.x, this.player.y);
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

  /**
   * Cinemática del SMASH especial. Solo se llama desde checkHits con el contacto YA confirmado
   * (inReach) y el SMASH armado. Reserva el golpe: el jugador queda en la pose de preparación del
   * remate especial, todo se congela 1 s y al terminar se ejecuta playerHit() exactamente una vez,
   * con la pelota en el mismo sitio (dirección, potencia y Perfect Timing salen igual que sin pausa:
   * el reloj de simulación y el contacto no avanzan durante la cinemática).
   */
  // ---------------------------------------------------------------- INFERNO DRIVE
  /** Punto ganado: +1 de carga; al completarla el botón SMASH pasa a INFERNO DRIVE. */
  private onInfernoPoint() {
    const nowReady = this.inferno.onPointWon();
    this.smashBtn.setMeter(this.inferno.charge, INFERNO.pointsToCharge);
    if (nowReady) {
      this.smashBtn.setInferno(true);
      this.smashBtn.pulseMeter();
    }
  }

  /** Botón en modo INFERNO: arma la técnica (no consume la carga). */
  private armInferno(): boolean {
    if (this.paused || this.cine.busy || this.phase !== 'rally' || this.smashArmed || this.player.vanished) return false;
    if (!this.inferno.arm()) return false;
    this.smashBtn.setArmed(true);
    const h = this.headPos(this.player);
    this.popText(h.x, h.y, '¡INFERNO!', '#ff8a3a', 34);
    return true;
  }

  /** Valida el contacto con el alcance especial (+25 %) y, si es viable, lanza la cinemática. */
  private tryInferno(): boolean {
    if (this.cine.active || this.phase !== 'rally') return false;
    const pl = this.player;
    if (pl.vanished || pl.stun > 0) return false;
    const c = planInfernoContact({
      px: pl.x,
      py: pl.y,
      dir: pl.dir,
      ball: this.ball.s,
      hitRange: HIT_RANGE,
      maxZ: HIT_MAX_Z,
      bounds: { xMin: P_X[0], xMax: P_X[1], yMin: Y_MIN, yMax: Y_MAX },
    });
    if (!c) return false; // aún (o nunca) alcanzable: no se activa ni se consume
    this.startInferno(c);
    return true;
  }

  /**
   * Cinemática de 2 s: 0–1000 concentración (todo congelado) · 1000–1650 desplazamiento con 4 sombras
   * hasta la posición de contacto validada · 1650 golpe (una vez) y el partido sigue · hasta 2000 la luz vuelve.
   */
  private startInferno(c: { x: number; y: number }) {
    const pl = this.player;
    const s = this.ball.s;
    this.inferno.begin();
    this.stopCharge();
    // cargando: pose de espera con la raqueta atrás (la de "guardia" de siempre), congelada; el golpe
    // de máxima potencia arranca desde ahí al llegar a la pelota
    pl.ch.setCharging(true);
    const sprites = spritesIn(pl.ch);
    const from = { x: pl.x, y: pl.y };
    const D = INFERNO.dash;
    let dashSound = false;
    infernoSound.charge(this);
    this.aura.setRingHidden(true); // sin anillos alrededor de los pies durante la cinemática
    this.cine.start({
      profile: INFERNO_CINE,
      freeze: [...sprites, ...spritesIn(this.bot.ch)],
      executor: sprites,
      leadMs: 0, // la pose de espera no avanza: el golpe empieza al llegar
      focus: () => {
        const p = project(pl.x, pl.y);
        const h = this.headPos(pl);
        const b = project(s.x, s.y, s.z);
        return { x: p.sx, y: (h.y + p.sy) / 2, hh: (p.sy - h.y) / 2, racketX: h.x + (b.sx - h.x) * 0.5, racketY: h.y + (b.sy - h.y) * 0.5, s: p.s, depth: pl.ch.depth };
      },
      onCancel: () => {
        pl.ch.setCharging(false);
        this.ghosts.clear();
        this.aura.setRingHidden(false);
        this.inferno.abort();
      },
      onFrame: (e) => {
        if (e < D.fromMs) return;
        this.inferno.phase = 'GHOST_DASH';
        if (!dashSound) {
          dashSound = true;
          infernoSound.dash(this);
          this.ghosts.begin(D.toMs - D.fromMs - 120);
        }
        // muy rápido pero visible, a velocidad constante (sombras repartidas por el camino) y sin
        // teletransporte; llega un poco antes del impacto
        const u = Math.min(1, (e - D.fromMs) / (D.toMs - D.fromMs - 120));
        const p = u;
        pl.x = from.x + (c.x - from.x) * p;
        pl.y = from.y + (c.y - from.y) * p;
        this.renderActors();
        // 4 sombras en posiciones anteriores reales (solo mientras se desplaza; luego se quedan y se desvanecen)
        if (u < 1) this.ghosts.record(sprites[0], pl.ch.depth);
        else this.ghosts.end();
      },
      onHit: () => this.infernoImpact(c),
    });
  }

  /** Impacto de INFERNO DRIVE: golpe único, consumo de la carga y efectos. */
  private infernoImpact(c: { x: number; y: number }) {
    const pl = this.player;
    pl.x = c.x;
    pl.y = c.y;
    pl.ch.setCharging(false); // suelta la pose de espera: el golpe sigue desde la raqueta atrás
    this.ghosts.end();
    this.aura.setRingHidden(false);
    if (this.phase !== 'rally' || this.lastHitter === 'player') {
      this.inferno.abort();
      return;
    }
    this.inferno.phase = 'SPECIAL_IMPACT';
    this.infernoPending = true;
    try {
      this.playerHit();
    } finally {
      this.infernoPending = false;
    }
    this.inferno.consume();
    this.infernoFlight = true;
    this.smashBtn.setArmed(false);
    this.smashBtn.setInferno(false);
    this.smashBtn.setMeter(0, INFERNO.pointsToCharge);
    const s = this.ball.s;
    const b = project(s.x, s.y, s.z);
    infernoImpactFx(this, b.sx, b.sy, b.s);
    infernoShake(this);
    infernoSound.impact(this);
    this.ball.quietFx = true; // la pelota es ahora la esfera de fuego (sin estela propia)
    this.infernoBounced = false; // su primer bote tendrá explosión de fuego
  }

  /** SMASH / INFERNO: ¿remate por arriba (con salto)? SOLO si la pelota llega en globo; si no, golpe fuerte. */
  private powerOverhead(s: BallState) {
    return this.ball.shotKind === 'lob' || this.lob.qualifies('player', this.player.x, this.player.y, s);
  }

  private startSmashCine(): boolean {
    if (!smashCineEnabled() || this.cine.active || this.phase !== 'rally') return false;
    const pl = this.player;
    // misma llamada que hará playerHit con el SMASH: arranca el clip en su preparación y se congela ahí;
    // al reanudar, la segunda llamada no reinicia el clip (ya está golpeando) → sin saltos visuales
    this.stopCharge(); // antes de la pose (al soltar la carga el personaje no debe cambiar de animación)
    const overhead = this.powerOverhead(this.ball.s);
    const lead = pl.ch.swing(true, overhead, overhead);
    this.aura.setRingHidden(true); // sin anillos alrededor de los pies durante la cinemática
    this.cine.start({
      onCancel: () => this.aura.setRingHidden(false),
      freeze: [...spritesIn(pl.ch), ...spritesIn(this.bot.ch)],
      executor: spritesIn(pl.ch),
      leadMs: Math.min(lead, 150),
      focus: () => {
        const p = project(pl.x, pl.y);
        const h = this.headPos(pl);
        // la raqueta va al encuentro de la pelota: punto entre la cabeza y la pelota
        const b = project(this.ball.s.x, this.ball.s.y, this.ball.s.z);
        return { x: p.sx, y: (h.y + p.sy) / 2, hh: (p.sy - h.y) / 2, racketX: h.x + (b.sx - h.x) * 0.5, racketY: h.y + (b.sy - h.y) * 0.5, s: p.s, depth: pl.ch.depth };
      },
      onHit: () => {
        this.aura.setRingHidden(false);
        // golpe pendiente: se consume una vez (playerHit desarma el SMASH)
        if (this.phase === 'rally' && this.smashArmed && this.lastHitter !== 'player') this.playerHit();
      },
    });
    return true;
  }

  /**
   * IMPACTO DIRECTO: el rival alcanza una pelota de SMASH o INFERNO DRIVE (contacto real, el mismo de
   * siempre). Devuelve flojo, sale despedido y queda aturdido (logic/PowerImpact.ts); explosión según
   * el ataque (fx/ImpactFx.ts). Puntuación y física de los tiros: como antes.
   */
  private fireImpact() {
    const s = this.ball.s;
    const b = this.bot;
    const kind: PowerKind = this.infernoFlight ? 'inferno' : 'smash';
    // impacto contra el rival ANTES de botar: este es su efecto (no habrá explosión de suelo)
    this.infernoFlight = false;
    this.infernoBounced = true;
    // explosión: SMASH centrada en el rival (media altura); INFERNO en el punto de contacto de la bola de fuego
    const feet = project(b.x, b.y);
    const head = this.headPos(b);
    const at = kind === 'inferno' ? project(s.x, s.y, s.z) : { sx: feet.sx, sy: (feet.sy + head.y) / 2 };
    powerImpactFx(this, kind, at.sx, at.sy, feet.s);
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

    // retroceso rápido que frena progresivamente (sin salir de su zona) + aturdimiento
    b.stun = stunSeconds();
    const kb = POWER_IMPACT.knockback;
    this.tweens.killTweensOf(b);
    this.tweens.add({ targets: b, x: knockbackX(b.x, B_X[1], KNOCKBACK_DIST), duration: kb.ms, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: b.ch.rig, angle: { from: -POWER_IMPACT.recoilDeg * b.ch.facing, to: 0 }, duration: POWER_IMPACT.stunMs, ease: 'Elastic.easeOut' });
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
    this.player.ch.resetPose();
    this.bot.ch.facing = -1;
    this.bot.ch.resetPose();
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
    // el rival sortea su modo (NORMAL / CONCENTRADO / COMPETITIVO) al empezar cada punto
    if (!secondServe) this.brain.onPointStart(this.score.points, this.score.games);
    this.serving = false;
    this.lastHitter = null;
    this.bounces = 0;
    this.ball.setPower(false);
    this.ball.setIgnited(this.smashArmed);
    // INFERNO DRIVE: se puede volver a usar; lo que quedó armado sin ejecutarse se desarma (no se consume)
    if (this.inferno.armed) this.smashBtn.setArmed(false);
    this.inferno.onPointStart();
    this.infernoFlight = false;
    this.ball.clearTrail();
    this.serveLet = false;
    this.serveNetLoss = false;
    this.serveCtl.reset();
    this.serveDirect = false;
    this.placeForServe();
    this.phase = 'serve';
    this.serveClock = this.server === 'player' ? SERVE.timeLimit : 0; // 5 s para sacar (solo el jugador)
    this.serveClockText.setVisible(false);
    this.computeServeBox();
    this.showServeHint();
    // zona de colocación: la mitad de la línea de fondo del lado desde el que se saca
    const srvA = this.srvActor();
    this.serveZone = srvA.y > LAT_C ? [LAT_C + 10, COURT.bottom] : [COURT.top, LAT_C - 10];
    if (this.server === 'player') this.joy.release();
    else {
      // el rival decide ya su saque (tipo, destino y momento) y se coloca antes de lanzar
      this.botPlan = this.serveAI.plan(this.faults, this.ai.d);
      this.brain.serveWait = this.botPlan.wait;
      this.botServeY = clamp(LAT_C + Math.sign(srvA.y - LAT_C) * rand(40, 150), this.serveZone[0], this.serveZone[1]);
    }
    this.setServeUi(this.server === 'player');
    this.secondTag.setVisible(this.faults > 0);
    const st = this.score.status();
    if (secondServe) this.banner('2º saque', '#ffd23f', 54, 500);
    else if (st) this.banner(st, '#ffd23f', 54, 600);
    else if (this.score.points[0] + this.score.points[1] === 0)
      this.banner(this.server === 'player' ? '¡Tu saque!' : `Saca ${this.botName}`, '#ffffff', 48, 500);
  }

  // ---------------------------------------------------------------- saque manual
  private srvActor() {
    return this.server === 'player' ? this.player : this.bot;
  }

  /** ¿Se muestran los botones de saque? (turno de saque del jugador, hasta que golpea) */
  private serveUiOn() {
    return this.serveNormalBtn?.visible === true;
  }

  /** Cambia entre los botones de saque y DASH/SMASH. */
  private setServeUi(on: boolean) {
    this.serveNormalBtn.show(on);
    this.serveSpinBtn.show(on);
    this.dashBtn.setVisible(!on);
    this.smashBtn.setVisible(!on);
    this.dashBtn.enabled = !on;
    this.smashBtn.enabled = !on;
  }

  /**
   * Pulsación de saque del jugador: 1ª lanza la pelota, 2ª (mismo tipo) golpea.
   * `fromTap` = toque en la mitad derecha de la pantalla (saque normal). Con el botón verde el saque
   * normal puede salir DIRECTO si se golpea en el punto máximo.
   */
  private onServeButton(kind: ServeKind, fromTap = false) {
    if (this.paused || this.server !== 'player') return;
    const ctl = this.serveCtl;
    if (ctl.state === 'POSITIONING' && this.phase === 'serve') {
      this.serveDirect = kind === 'normal' && !fromTap;
      this.beginToss(kind);
    }
    else if (ctl.state === 'AIMING' && ctl.kind === kind && this.phase === 'toss') this.beginSwing();
  }

  /** Lanza la pelota en vertical y empieza la animación de saque (queda a la espera con el brazo arriba). */
  private beginToss(kind: ServeKind) {
    if (!this.serveCtl.startToss(kind)) return;
    this.phase = 'toss';
    this.ball.s.vz = SERVE.tossVz;
    this.srvActor().ch.serve();
    if (this.server === 'player') {
      const [mine, other] = kind === 'normal' ? [this.serveNormalBtn, this.serveSpinBtn] : [this.serveSpinBtn, this.serveNormalBtn];
      mine.setChosen(true);
      other.setLocked(true); // no se puede cambiar de tipo de saque a mitad del lanzamiento
    }
  }

  /** Segunda pulsación: la raqueta viaja hasta la pelota; el contacto llega con el retardo de la animación. */
  private beginSwing() {
    const srv = this.srvActor();
    if (!this.serveCtl.pressHit(srv.ch.serveContactDelay())) return;
    srv.ch.serveRelease();
    this.serveJump(srv, srv.ch.serveContactDelay());
    this.serveNormalBtn.setCue(false);
    this.serveSpinBtn.setCue(false);
  }

  /**
   * Salto del saque (solo visual): si en el instante del contacto la pelota va a estar más alta que la
   * raqueta del personaje de pie, salta lo justo para que la raqueta llegue a la pelota y vuelve al suelo.
   * No cambia el momento del contacto, la calidad del saque ni la física.
   */
  private serveJump(a: Actor, contactS: number) {
    const s = this.ball.s;
    const t = Math.max(0, contactS);
    const zc = s.z + s.vz * t - 0.5 * GRAVITY * t * t; // altura prevista de la pelota en el contacto
    const ch = a.ch;
    const k = Math.abs(ch.scaleY) || 1;
    const above = (project(a.x, a.y).sy - project(s.x, s.y, zc).sy) / k; // pelota sobre los pies, en unidades del personaje
    const up = Math.min(SERVE_JUMP.max, above - SERVE_JUMP.racketTop);
    if (up <= 4) return;
    // avanza con el mismo reloj que el saque (update): la cima coincide con el contacto aunque bajen los FPS
    this.serveJumpState = { a, t: 0, up, rise: Math.max(0.08, t) };
  }

  /** Avanza el salto del saque (subida hasta el contacto, breve pausa arriba y caída). */
  private tickServeJump(dt: number) {
    const j = this.serveJumpState;
    if (!j) return;
    j.t += dt;
    const hang = SERVE_JUMP.hangMs / 1000;
    const fall = SERVE_JUMP.fallMs / 1000;
    let y = 0;
    if (j.t < j.rise) {
      const q = j.t / j.rise;
      y = -j.up * (1 - (1 - q) * (1 - q));
    } else if (j.t < j.rise + hang) y = -j.up;
    else if (j.t < j.rise + hang + fall) {
      const q = (j.t - j.rise - hang) / fall;
      y = -j.up * (1 - q * q);
    } else this.serveJumpState = undefined;
    j.a.ch.rig.y = y;
  }

  /** Destino (en el cuadro de saque) para un punto de apuntado y un error de ejecución. */
  private serveSpot(who: Who, kind: ServeKind, aimT: number, errLat = 0, errDepth = 0) {
    const b = this.serveBox;
    const inset = 14;
    const f = clamp((kind === 'spin' ? SERVE.depth.spin : SERVE.depth.normal) + errDepth, 0.12, 1.4);
    const tx = who === 'player' ? b.x0 + (b.x1 - b.x0) * f : b.x1 - (b.x1 - b.x0) * f;
    const ty = b.y0 + inset + (b.y1 - b.y0 - inset * 2) * clamp(aimT + errLat, -0.6, 1.6);
    return { tx, ty };
  }

  /** Apuntado del jugador: izquierda / centro / derecha del cuadro según el joystick. */
  private playerAimT() {
    const d = this.shotDir();
    const x = Math.abs(d.x) < 0.2 ? 0 : clamp(d.x, -1, 1);
    return 0.5 + 0.45 * x;
  }

  /** Contacto de la raqueta con la pelota: calidad según el momento y salida de la pelota con la física normal. */
  private executeServe() {
    const who = this.server;
    const srv = this.srvActor();
    const s = this.ball.s;
    const ctl = this.serveCtl;
    const kind = ctl.kind ?? 'normal';
    const quality = ctl.evaluate(s.z, s.vz);
    srv.ch.swing(); // asegura que la animación termina el golpe
    this.hideServeHint();
    this.serveAim.setVisible(false);
    this.setServeUi(false); // se restauran DASH y SMASH...
    this.lockAbilities(); // ...pero bloqueados un momento para no pulsarlos por error
    this.serveClock = 0;
    this.serveClockText.setVisible(false);
    this.serveNetLoss = false;
    if (quality === 'miss') {
      // golpe en vacío: la pelota sigue cayendo y será falta al botar
      const p = project(s.x, s.y, s.z);
      this.popText(p.sx, p.sy - 30, '¡Al aire!', '#ffd23f', 30);
      return;
    }

    const second = this.faults > 0 ? 1 : 0;
    if (quality === 'low') {
      // la pelota está demasiado baja: sale casi plana contra la red y el punto se pierde
      const tn = 0.55;
      s.vx = (NET_X - s.x) / tn;
      s.vz = (12 - s.z + 0.5 * GRAVITY * tn * tn) / tn; // llega a la red a ~12 de altura (la red mide NET_HEIGHT)
      s.vy = (LAT_C - s.y) / (tn * 1.6);
      s.ay = undefined;
      this.ball.setKind('normal');
      this.lastHitter = who;
      this.bounces = 0;
      this.serving = true;
      this.serveNetLoss = true;
      this.phase = 'rally';
      if (who === 'player') this.ai.onPlayerHit(false);
      else this.ai.onBotHit();
      this.hitFx(s.x, s.y, s.z, false, 0.1);
      return;
    }
    const g = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2; // ~ N(0,1)
    const [eLat, eDep] = SERVE.error[quality];
    const aimT = who === 'player' ? this.playerAimT() : this.botPlan.aimT;
    // saque DIRECTO: botón verde + golpe en el punto máximo
    const direct = who === 'player' && kind === 'normal' && this.serveDirect && quality === 'perfect';
    this.serveDirect = false;
    const extraDepth = direct ? SERVE.direct.depth - SERVE.depth.normal : 0;
    const { tx, ty } = this.serveSpot(who, kind, aimT, g() * eLat, g() * eDep + extraDepth);
    const speed = SERVE_SPEED * SERVE.speed[quality][second] * (kind === 'spin' ? SERVE.spinSpeedMult : 1) * (direct ? SERVE.direct.speedMult : 1);
    const margin = direct ? SERVE.direct.margin : quality === 'perfect' ? 22 : quality === 'normal' ? rand(8, 20) : rand(-4, 10);

    aimShot(s, tx, ty, speed, margin);
    if (kind === 'spin') {
      // curva hacia el lado al que se apunta: se apunta antes para que la pelota bote donde se eligió.
      // El tiempo de vuelo cambia al desplazar el punto de apuntado, así que se itera hasta que converge.
      const ay = SERVE.spinAy * (aimT > 0.55 ? 1 : aimT < 0.45 ? -1 : Math.random() < 0.5 ? 1 : -1);
      let aimY = ty;
      for (let i = 0; i < 4; i++) {
        const T = (tx - s.x) / s.vx;
        aimY = ty - 0.5 * ay * T * T;
        aimShot(s, tx, aimY, speed, margin);
      }
      s.ay = ay;
    }
    // golpe defectuoso: la pelota sale más baja y puede ir a la red (falta), rozar la cinta (let) o quedarse corta
    if (Math.random() < SERVE.flawChance[quality]) s.vz -= rand(SERVE.flawDrop[0], SERVE.flawDrop[1]);
    this.ball.setKind(kind === 'spin' ? 'side' : 'normal', quality === 'perfect');
    this.lastHitter = who;
    this.bounces = 0;
    this.serving = true;
    this.serveLet = false;
    this.phase = 'rally';
    if (who === 'player') this.ai.onPlayerHit(quality === 'perfect');
    else this.ai.onBotHit();
    // potencia real del saque (la velocidad que lleva) para el efecto de impacto
    const mult = SERVE.speed[quality][second] * (kind === 'spin' ? SERVE.spinSpeedMult : 1);
    this.hitFx(s.x, s.y, s.z, false, clamp((mult - 0.8) / 0.6, 0, 1));
    if (quality === 'perfect') this.perfectFx(s.x, s.y, s.z, direct);
    // Perfect Timing en el saque: el saque YA tiene su ventana perfecta y su bonus (SERVE.speed); aquí solo
    // se suma el feedback común (sonido + vibración), sin más potencia (evita acumular bonificaciones)
    if (quality === 'perfect' && who === 'player' && this.timingOn()) {
      vibrate(TIMING.fx.vibrateMs);
      if (TIMING.fx.sound) perfectSound(this);
    }
    if (who === 'player' && devFlagOn('dev.timingDebug')) console.info(`[timing] saque ${kind} calidad=${quality} vel=${speed.toFixed(0)} z=${s.z.toFixed(0)}`);
  }

  /** Efecto del saque perfecto: anillo azul neón y texto (dorado y más fuerte si es DIRECTO). */
  private perfectFx(bx: number, by: number, bz: number, direct = false) {
    if (direct) {
      const p = project(bx, by, bz);
      for (const [col, size, delay] of [[0xffd23f, 4.6, 0], [NEON, 5.6, 60]] as const) {
        const r = this.add.circle(p.sx, p.sy, 16, col, 0).setStrokeStyle(7, col).setDepth(3500).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: r, scale: size, alpha: 0, delay, duration: 420, onComplete: () => r.destroy() });
      }
      this.ball.setImpactTrail(1, 0xffd23f);
      this.cameras.main.flash(110, 255, 220, 120);
      this.cameras.main.shake(120, 0.006);
      this.popText(p.sx, p.sy - 50, '¡SAQUE DIRECTO!', '#ffd23f', 38);
      return;
    }
    const p = project(bx, by, bz);
    const ring = this.add.circle(p.sx, p.sy, 16, NEON, 0).setStrokeStyle(7, NEON).setDepth(3500).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: ring, scale: 4.2, alpha: 0, duration: 420, onComplete: () => ring.destroy() });
    if (this.server !== 'player') return; // el rival solo muestra el anillo
    this.cameras.main.flash(100, 120, 230, 255);
    this.popText(p.sx, p.sy - 50, '¡SAQUE PERFECTO!', '#7ff0ff', 38);
  }

  /** DASH y SMASH visibles pero bloqueados un momento tras sacar (evita pulsarlos sin querer). */
  private lockAbilities() {
    this.dashBtn.setEnabled(false);
    this.smashBtn.setEnabled(false);
    this.time.delayedCall(SERVE.abilityLock * 1000, () => {
      if (this.serveUiOn()) return; // ya se está sacando otra vez: los controla setServeUi
      this.dashBtn.setEnabled(true);
      this.smashBtn.setEnabled(true);
    });
  }

  /** El jugador tiene SERVE.timeLimit segundos para sacar; los últimos 3 se muestran. Al agotarse: falta. */
  private tickServeClock(dt: number) {
    const st = this.serveCtl.state;
    const counting = this.serveClock > 0 && this.server === 'player' && (this.phase === 'serve' || this.phase === 'toss') && st !== 'SWING' && st !== 'SERVE_RESULT';
    if (!counting) {
      this.serveClockText.setVisible(false);
      return;
    }
    this.serveClock -= dt;
    if (this.serveClock <= 0) {
      this.serveClock = 0;
      this.serveClockText.setVisible(false);
      const h = this.headPos(this.player);
      this.popText(h.x, h.y - 30, '¡TIEMPO!', '#ff7a85', 34);
      this.tossFault();
      return;
    }
    if (this.serveClock <= 3) {
      const n = Math.ceil(this.serveClock);
      this.serveClockText.setVisible(true).setText(String(n)).setColor(n <= 1 ? '#ff7a85' : '#ffd23f');
    }
  }

  /** La pelota lanzada baja sin que se golpee: el servidor la atrapa y puede lanzarla de nuevo (sin falta). */
  private catchBall() {
    this.serveCtl.reset();
    this.phase = 'serve';
    this.srvActor().ch.resetPose();
    this.serveAim.setVisible(false);
    if (this.server === 'player') this.setServeUi(true);
    else {
      this.botPlan = this.serveAI.plan(this.faults, this.ai.d);
      this.brain.serveWait = 0.5;
    }
    this.holdBall();
  }

  /** Falta de saque sin golpe válido: la pelota cae sin golpearse (golpe en vacío) o se acabó el tiempo. */
  private tossFault() {
    this.setServeUi(false);
    this.hideServeHint();
    this.serveAim.setVisible(false);
    this.serveCtl.state = 'SERVE_RESULT';
    this.serving = true;
    this.lastHitter = this.server;
    this.phase = 'rally';
    this.serviceFault();
  }

  /** Let: la pelota rozó la cinta de la red y cayó en el cuadro. Se repite el saque sin falta. */
  private serveLetCall() {
    this.serveLet = false;
    this.phase = 'pointover';
    const g = project(this.ball.s.x, this.ball.s.y, 0);
    this.popText(g.sx, g.sy - 40, 'LET', '#ffd23f', 40);
    this.time.delayedCall(1000, () => this.startPoint(this.faults > 0));
  }

  /** Indicador discreto del destino mientras se apunta (solo el jugador). */
  private renderServeAim() {
    const g = this.serveAim;
    const ctl = this.serveCtl;
    const on = this.server === 'player' && this.phase === 'toss' && (ctl.state === 'TOSS' || ctl.state === 'AIMING');
    g.clear();
    g.setVisible(on);
    if (!on || !ctl.kind) return;
    const { tx, ty } = this.serveSpot('player', ctl.kind, this.playerAimT());
    const p = project(tx, ty);
    g.lineStyle(4 * p.s, 0xffffff, 0.9).strokeEllipse(p.sx, p.sy, 54 * p.s, 24 * p.s);
    g.fillStyle(0xffd23f, 0.9).fillEllipse(p.sx, p.sy, 16 * p.s, 7 * p.s);
  }

  /** ¿Pared del fondo activa? (WALL.enabled y sin localStorage 'dev.backWall' = '0') */
  private backWallOn() {
    if (!WALL.enabled) return false;
    try {
      return localStorage.getItem('dev.backWall') !== '0';
    } catch {
      return true;
    }
  }

  /**
   * Pared del fondo del rival: si la pelota la alcanza en este subpaso, rebota con su impacto. Si el punto
   * seguía vivo, lo termina (tras botar bien → punto de quien golpeó; sin botar → fuera; saque → falta).
   */
  private checkBackWall(prevX: number) {
    const w = this.backWall;
    if (!w || !this.backWallOn()) return;
    const s = this.ball.s;
    const kind = wallHit(prevX, s, w);
    if (!kind) return;
    const p = project(s.x, s.y, s.z);
    const ground = project(s.x, s.y, 0);
    this.wallFx.impact(kind, p.sx, p.sy, p.s, ground.sy + 3, this.ball.power);
    const out = wallOutcome({ rally: this.phase === 'rally', hitter: this.lastHitter, serving: this.serving, bounces: this.bounces });
    if (out.kind === 'fault') this.serviceFault();
    else if (out.kind === 'point' && this.lastHitter) {
      const hitter = this.lastHitter;
      const receiver: Who = hitter === 'player' ? 'bot' : 'player';
      if (out.winner === 'receiver') this.pointTo(receiver, '¡FUERA!', '#ff7a85');
      else this.pointTo(hitter, hitter === 'player' ? '¡PUNTO!' : 'Punto rival', hitter === 'player' ? '#8fd0ff' : '#ff9aa3');
    }
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
    if (w === 'player') this.onInfernoPoint();
    const g = project(this.ball.s.x, this.ball.s.y, 0);
    this.popText(g.sx, g.sy - 40, reason, color, 34);
    this.updateHud();

    if (res.matchWinner !== null) {
      const win = res.matchWinner === 0;
      (win ? this.player : this.bot).ch.victory();
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
    // final cinematográfico sobre el mismo mapa (fx/matchEnd.ts + scenes/MatchEndScene.ts)
    playMatchEnd(this, {
      winner: (win ? this.player : this.bot).ch,
      loser: (win ? this.bot : this.player).ch,
      data: {
        win,
        surrendered,
        playerName: getProfile().name,
        rivalName: this.botName,
        playerGames: this.score.games[0],
        rivalGames: this.score.games[1],
        botName: this.botName,
        rivalLevel: this.rivalLevel,
      },
    });
  }

  // ---------------------------------------------------------------- tiro cargado
  private canCharge() {
    if (this.player.vanished) return false;
    if (this.phase === 'rally') return true;
    // mientras saca el rival también se puede preparar el resto
    return (this.phase === 'serve' || this.phase === 'toss') && this.server === 'bot';
  }

  /** 1er toque: empieza a cargar (quieto). 2º toque: cancela y vuelve a moverse. */
  private toggleCharge(eventMs?: number) {
    if (this.paused || this.cine.active) return;
    // DASH sprint en curso: no se carga (frenaría en seco), pero el gesto cuenta para Perfect Timing
    if (this.dashRun) {
      if (this.phase === 'rally') this.timing.registerTap(this.tapClock(eventMs));
      return;
    }
    if (this.charging) {
      this.stopCharge();
      this.timing.clear(); // cancelar la carga no cuenta como golpe
      return;
    }
    if (!this.canCharge()) return;
    // Perfect Timing: el toque que empieza la carga es el "swing" del jugador
    if (this.phase === 'rally') this.timing.registerTap(this.tapClock(eventMs));
    this.chargeFullAt = null;
    this.charging = true;
    this.charge = 0;
    this.chargeFull = false;
    this.ringGold = false;
    this.player.ch.setCharging(true);
    this.chargeRing.setVisible(true);
    this.chargeMeter.begin();
  }

  /**
   * Instante de un toque en el reloj de simulación. Los eventos llegan entre fotogramas: se suma el
   * tiempo real transcurrido desde el último update (con el mismo tope que el dt de la física).
   * Usa el timeStamp del evento si es fiable (mismo origen que performance.now()).
   */
  private tapClock(eventMs?: number) {
    const now = performance.now();
    const at = eventMs !== undefined && eventMs > 0 && Math.abs(now - eventMs) < 1000 ? eventMs : now;
    return this.simClock + clamp((at - this.simRealAt) / 1000, 0, 0.05);
  }

  /** ¿Inercia del jugador activa? (MOTION.enabled y sin 'dev.playerInertia' = '0') */
  private inertiaOn() {
    if (!MOTION.enabled) return false;
    try {
      return localStorage.getItem('dev.playerInertia') !== '0';
    } catch {
      return true;
    }
  }

  /** ¿Perfect Timing activo? (TIMING.enabled y sin 'dev.perfectTiming' = '0') */
  private timingOn() {
    if (!TIMING.enabled) return false;
    try {
      return localStorage.getItem('dev.perfectTiming') !== '0';
    } catch {
      return true;
    }
  }

  /** Termina la carga: oculta el indicador (con desvanecido suave) y apaga el brillo del personaje. */
  private stopCharge(soft = true) {
    if (!this.charging) return;
    this.charging = false;
    this.charge = 0;
    this.chargeFull = false;
    this.player.ch.setCharging(false);
    this.chargeRing.setVisible(false);
    this.chargeMeter.end(soft);
    this.chargeAura.hide();
  }

  private updateCharge(dt: number) {
    if (!this.charging) return;
    const prev = this.charge;
    this.charge = Math.min(1, this.charge + dt / 1.1);
    this.chargeFull = this.charge >= 1;
    // instante exacto (reloj de simulación) en que el medidor llega al 100 %: para la CARGA PERFECTA
    if (prev < 1 && this.chargeFull) this.chargeFullAt = this.simClock + (1 - prev) * 1.1;
    this.chargeAt = this.simClock + dt; // instante al que corresponde `charge`
  }

  /** Instante de llenado del medidor: el real si ya se llenó, o el previsto si le falta poco. */
  private chargeFillTime(): number {
    return this.chargeFullAt ?? this.chargeAt + (1 - this.charge) * 1.1;
  }


  private renderCharge() {
    if (!this.charging) return;
    const dt = this.game.loop.delta / 1000;
    const p = project(this.player.x, this.player.y);
    const k = p.s * VIEW.CHAR_K;
    const pulse = 0.5 + 0.5 * Math.sin(this.time.now / (this.chargeFull ? 70 : 140));
    // aro en el suelo: azul y, al máximo, dorado
    if (this.chargeFull !== this.ringGold) {
      this.ringGold = this.chargeFull;
      this.chargeRing.setFillStyle(this.ringGold ? 0xffc72e : 0x6ec1ff, 0.25).setStrokeStyle(5, this.ringGold ? 0xfff2a8 : 0xd6f0ff, 0.9);
    }
    this.chargeRing
      .setPosition(p.sx, p.sy)
      .setScale(p.s * (0.55 + 0.55 * this.charge + pulse * 0.06))
      .setAlpha(0.45 + pulse * 0.4)
      .setDepth(p.sy - 0.8);
    // indicador único sobre la cabeza: potencia + dirección real
    const h = this.headPos(this.player);
    this.chargeMeter.setValue(this.charge);
    this.chargeMeter.setShot(this.shotFromJoystick());
    this.chargeMeter.place(h.x, h.y - 10, Phaser.Math.Clamp(p.s / 1.45, 0.8, 1));
    this.chargeMeter.tick(dt);
    // brillo alrededor del personaje y su raqueta
    this.chargeAura.update(dt, p.sx, p.sy, k, this.player.ch.facing, this.charge, p.sy);
  }
  // ---------------------------------------------------------------- golpes
  private handleBounce() {
    const s = this.ball.s;
    this.bounceFx(s.x, s.y);
    // INFERNO DRIVE: explosión de fuego en el punto exacto de su PRIMER bote (una sola vez; solo visual)
    if (this.infernoFlight && !this.infernoBounced) {
      this.infernoBounced = true;
      const g = project(s.x, s.y, 0);
      infernoGroundFx(this, g.sx, g.sy, g.s);
    }
    if (!this.lastHitter) return;
    if (this.serving) {
      if (this.inServiceBox(s.x, s.y)) {
        this.serving = false;
        this.bounces = 1;
        this.serveCtl.startRally();
        if (this.serveLet) this.serveLetCall();
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
    this.timing.clear(); // la estirada no se evalúa con Perfect Timing
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
      // INFERNO DRIVE armada: contacto viable con el desplazamiento especial → cinemática de 2 s
      if (this.inferno.armed && this.tryInferno()) return;
      if (this.inReach(this.player)) {
        // SMASH de habilidad con contacto confirmado: 1 s de cinemática y luego el golpe (una vez)
        if (!(this.smashArmed && this.startSmashCine())) this.playerHit();
      }
      else if (this.shouldLunge()) this.playerLunge();
    } else if (this.lastHitter !== 'bot' && s.x > NET_X && s.vx > 0 && this.bot.stun <= 0 && this.inReach(this.bot)) {
      if (this.ball.power) this.fireImpact();
      else this.botHit();
    }
  }

  /** `forced`: devolución garantizada del DASH (sin toque del jugador: no se evalúa el timing). */
  private playerHit(forced = false) {
    const s = this.ball.s;
    // INFERNO DRIVE usa el golpe de máxima potencia (como el SMASH) con su propio multiplicador
    const inferno = this.infernoPending;
    const power = this.smashArmed || inferno;
    // el SMASH tiene prioridad sobre el tiro cargado
    const charged = this.charging && !power;
    const c = this.charge;
    // Perfect Timing: el toque (inicio de carga) frente al instante real de este contacto. Se consume siempre.
    let chargeTimed = false; // PERFECTO por carga llena justo al golpear (cuenta como golpe máximo)
    let timed: TimingResult | null = forced || !this.timingOn() ? null : this.timing.evaluate(this.contactClock);
    // carga larga (el toque quedó fuera de la ventana del swing): se evalúa si el medidor llegó al 100 % justo al golpear
    if (timed && charged && (timed.grade === 'none' || timed.grade === 'off')) {
      const ch = evaluateCharge(this.chargeFillTime(), this.contactClock);
      if (ch.grade !== 'none') {
        timed = ch;
        chargeTimed = true;
      }
    }
    this.timing.clear();
    this.chargeFullAt = null;
    const volley = this.bounces === 0; // golpe antes de que bote = volea
    // SMASH potenciado: armado en la ventana del globo y, AHORA, dentro del círculo, bajando y a altura de remate
    const lobOk = this.lob.qualifies('player', this.player.x, this.player.y, s);
    const superHit = power && this.superArmed && lobOk;
    // REMATE: globo recibido dentro del círculo sin SMASH → golpe fuerte y directo automático
    const remate = !power && lobOk;
    this.superArmed = false;
    this.stopCharge();
    if (power) {
      this.smashArmed = false;
      this.smashBtn.setArmed(false);
      this.aura.stop();
    }
    // remate (animación 'smash', con salto en el SMASH): solo con el remate del globo o una pelota alta / que
    // llega en globo; el SMASH contra una pelota normal usa el golpe fuerte (derecha / revés potente)
    // ms hasta que la raqueta llega visualmente a la pelota (el golpe físico es AHORA; solo el destello espera)
    const overhead = remate || (power ? this.powerOverhead(s) : s.z > OVERHEAD_Z);
    const fxDelay = this.player.ch.swing(power || charged || remate, overhead, power && overhead);

    const depth = (a: number, b: number) => NET_X + (COURT.right - NET_X) * rand(a, b);
    const lat = (k: number) => LAT_C + clamp(k, -1, 1) * (HALF_W - 30);
    let tx: number;
    let ty: number;
    let speed = SHOT_SPEED;
    let margin = 18;
    let kind: ShotKind = 'normal';
    let dead = false;
    /** parte de `speed` que aporta la carga (0 sin cargar): TEMPRANO solo penaliza esto (Perfect Timing) */
    let chargePart = 0;

    if (power) {
      tx = depth(0.72, 0.9);
      ty = this.bot.y > LAT_C ? COURT.top + rand(25, 60) : COURT.bottom - rand(25, 60);
      if (inferno) {
        // INFERNO DRIVE respeta la dirección elegida con el joystick (si no hay, lejos del rival)
        const d = this.shotDir();
        if (Math.abs(d.x) > 0.3) ty = LAT_C + Math.sign(d.x) * rand(0.7, 0.92) * (HALF_W - 30);
      }
      // multiplicadores una sola vez (el potenciado del globo solo existe armando el SMASH normal)
      speed = SHOT_SPEED * SMASH_SPEED_MULT * (inferno ? INFERNO.speedMult : superHit ? LOB_SMASH.powerMult : 1);
      margin = 6;
    } else if (remate) {
      // fuerte, plano y profundo; el joystick elige el lado (si no, lejos del rival)
      const d = this.shotDir();
      tx = depth(0.7, 0.9);
      ty = Math.abs(d.x) > 0.3 ? lat(Math.sign(d.x) * rand(0.7, 0.95)) : this.bot.y > LAT_C ? COURT.top + rand(30, 70) : COURT.bottom - rand(30, 70);
      speed = SHOT_SPEED * LOB_SMASH.remateMult;
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
        chargePart = SHOT_SPEED * 0.35 * c;
        margin = 6;
        kind = Math.abs(d.x) > 0.3 ? 'side' : 'normal';
      } else if (shot === 'drop') {
        // cortita muerta: casi no bota
        tx = depth(0.08, 0.2);
        ty = lat(d.x * 0.6 + rand(-0.2, 0.2));
        speed = SHOT_SPEED * (0.85 + 0.15 * c);
        chargePart = SHOT_SPEED * 0.15 * c;
        margin = 5;
        dead = true;
        kind = 'drop';
      } else if (shot === 'lob') {
        // arriba: drive potente y profundo
        tx = depth(0.8, 0.95);
        ty = lat(d.x * 0.5 + rand(-0.3, 0.3));
        speed = SHOT_SPEED * (1.45 + 0.4 * c);
        chargePart = SHOT_SPEED * 0.4 * c;
        margin = 8;
      } else if (shot === 'left' || shot === 'right') {
        tx = depth(0.55, 0.85);
        ty = lat((shot === 'left' ? -1 : 1) * rand(0.85, 1));
        speed = SHOT_SPEED * (1.3 + 0.3 * c);
        chargePart = SHOT_SPEED * 0.3 * c;
        margin = 10;
        kind = 'side';
      } else {
        tx = depth(0.65, 0.9);
        ty = lat(rand(-0.4, 0.4));
        speed = SHOT_SPEED * (1.25 + 0.3 * c);
        chargePart = SHOT_SPEED * 0.3 * c;
        margin = 12;
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
          kind = 'drop';
          break;
        case 'lob': // arriba: globo alto y profundo
          tx = depth(0.82, 0.94);
          ty = lat(d.x * 0.6 + rand(-0.2, 0.2));
          speed = SHOT_SPEED * 0.85;
          margin = 75;
          kind = 'lob';
          break;
        case 'left': // izquierda de la pantalla = y menor
          tx = depth(0.6, 0.88);
          ty = lat(-rand(0.75, 1));
          kind = 'side';
          break;
        case 'right':
          tx = depth(0.6, 0.88);
          ty = lat(rand(0.75, 1));
          kind = 'side';
          break;
        default: // neutro: golpe normal
          tx = depth(0.55, 0.88);
          ty = lat(rand(-0.35, 0.35));
      }
    }
    if (timed && timed.grade !== 'none') {
      ({ tx, ty, speed, margin } = this.applyTiming(timed, power ? 'ability' : remate ? 'remate' : chargeTimed || (charged && c >= 0.995) ? 'max' : 'normal', kind, tx, ty, speed, margin, chargePart));
    }
    s.z = Math.max(s.z, 22);
    aimShot(s, tx, ty, speed, margin);
    if (dead) {
      s.damp = 0.22;
      s.fric = 0.5;
    }
    this.ball.setPower(power);
    this.ball.setKind(kind, charged || remate);
    if (timed && timed.grade !== 'none') {
      const grade = timed.grade;
      const contact = project(s.x, s.y, s.z);
      this.time.delayedCall(fxDelay, () => playTimingFx(this, grade, this.headPos(this.player), { x: contact.sx, y: contact.sy }));
    }
    this.lastHitter = 'player';
    this.bounces = 0;
    this.ai.onPlayerHit(power || remate);
    this.hitFxAt(fxDelay, s.x, s.y, s.z, power, charged ? c : remate ? 1 : 0.15);
    if (remate) {
      this.time.delayedCall(fxDelay, () => {
        this.ball.setImpactTrail(0.9, 0xffffff);
        this.cameras.main.shake(110, 0.007);
      });
    }
    this.superFlight = superHit;
    if (superHit) {
      // efectos propios del potenciado (además del fuego del SMASH), en el instante del impacto visual
      const p = project(s.x, s.y, s.z);
      this.time.delayedCall(fxDelay, () => {
        superSmashFx(this, p.sx, p.sy);
        this.ball.setImpactTrail(1, 0xffd23f);
      });
    }
  }

  /**
   * Aplica Perfect Timing al golpe ya decidido (no cambia el tipo de golpe ni el destino elegido):
   * velocidad × calidad (con tope y antiacumulación), red más justa en el PERFECTO y error en el bote
   * si fue TEMPRANO / TARDE. Ver TIMING en src/logic/PerfectTiming.ts.
   */
  private applyTiming(t: TimingResult, cls: ShotClass, kind: ShotKind, tx: number, ty: number, speed: number, margin: number, chargePart = 0) {
    const mods = timingMods(t.grade, cls, kind, t.deltaMs);
    const base = { tx, ty, speed, margin };
    speed = timedSpeed(speed, mods, SHOT_SPEED, cls, chargePart);
    margin = Math.max(4, margin * mods.marginMult);
    if (mods.errLat > 0 || mods.errDep > 0) {
      const g = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2; // ~ N(0,1)
      // acotado y dentro de la pista: el mal timing coloca peor (más corta / menos ángulo), no regala el punto
      ({ tx, ty } = applyError(tx, ty, mods, { netX: NET_X, right: COURT.right, top: COURT.top, bottom: COURT.bottom, halfW: HALF_W }, g));
    }
    if (devFlagOn('dev.timingDebug')) {
      const sb = this.ball.s;
      console.info(
        `[timing] ${t.grade} Δ=${t.deltaMs.toFixed(0)}ms clase=${cls} tipo=${kind} vel ${base.speed.toFixed(0)}→${speed.toFixed(0)} ` +
          `margen ${base.margin.toFixed(0)}→${margin.toFixed(0)} bote (${base.tx.toFixed(0)},${base.ty.toFixed(0)})→(${tx.toFixed(0)},${ty.toFixed(0)}) ` +
          `contacto z=${sb.z.toFixed(0)} dist=${this.reachDist(this.player, sb).toFixed(0)}`,
      );
    }
    return { tx, ty, speed, margin };
  }

  private botHit() {
    const s = this.ball.s;
    const fxDelay = this.bot.ch.swing();
    // a dónde y cómo devuelve: lo decide el cerebro; la física del golpe se aplica aquí como siempre
    const shot = this.brain.planShot(s, { playerX: this.player.x, playerY: this.player.y, botX: this.bot.x, botY: this.bot.y });
    s.z = Math.max(s.z, 22);
    aimShot(s, shot.tx, shot.ty, shot.speed, shot.margin);
    this.ball.setPower(false);
    this.ball.setKind(shot.kind);
    this.lastHitter = 'bot';
    this.bounces = 0;
    this.brain.onShot(shot); // se recoloca según su golpe (recuperación táctica)
    this.hitFxAt(fxDelay, s.x, s.y, s.z, false);
  }

  /**
   * Efecto de golpe sincronizado con el frame de impacto de la raqueta. La física ya se aplicó;
   * el destello, las partículas y la estela salen cuando la raqueta "toca" la pelota (en el punto de contacto).
   */
  private hitFxAt(delayMs: number, bx: number, by: number, bz: number, power: boolean, level = 0.15) {
    if (delayMs <= 0) this.hitFx(bx, by, bz, power, level);
    else this.time.delayedCall(delayMs, () => this.hitFx(bx, by, bz, power, level));
  }

  // ---------------------------------------------------------------- efectos
  /**
   * Efecto del golpe sobre la pelota. `level` es la potencia real (0..1) y elige el tramo
   * (suave / medio / fuerte / máximo) del destello, las ondas y la estela. Con SMASH sale el fuego de siempre.
   */
  private hitFx(bx: number, by: number, bz: number, power: boolean, level = 0.15) {
    const p = project(bx, by, bz);
    const x = p.sx;
    const y = p.sy;
    if (power) {
      const ring = this.add.circle(x, y, 14, 0xffffff, 0).setStrokeStyle(8, 0xff8a1e).setDepth(3500);
      this.tweens.add({ targets: ring, scale: 4, alpha: 0, duration: 380, onComplete: () => ring.destroy() });
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = rand(30, 90);
        const st = this.add.star(x, y, 4, 3, 8, 0xffd23f).setDepth(3500);
        this.tweens.add({ targets: st, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, alpha: 0, angle: 180, duration: 320, onComplete: () => st.destroy() });
      }
      this.cameras.main.shake(160, 0.012);
      this.cameras.main.flash(120, 255, 200, 120);
      return;
    }
    const tier = playImpact(this, x, y, level);
    this.ball.setImpactTrail(TIER_TRAIL[tier].boost, TIER_TRAIL[tier].color);
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
    // cinemática del SMASH: el partido queda congelado (física, jugadores, IA, relojes); solo se animan sus efectos
    if (this.cine.active) {
      this.cine.update();
      return;
    }
    const dt = Math.min(deltaMs / 1000, 0.05);
    this.dashBtn.update(dt);
    this.smashBtn.update(dt);

    // --- jugador
    const pl = this.player;
    this.updateDashSprint(dt); // DASH sprint: el recorrido mueve al jugador (arranque / sprint / frenada)
    const frozen =
      this.charging ||
      pl.stun > 0 ||
      pl.vanished ||
      (this.dashHit !== null && !this.dashHit.sprint) || // DASH de teletransporte: se queda en el punto hasta devolver
      this.dashRun !== null || // DASH sprint: mientras corre lo mueve el sprint; al llegar queda libre
      this.phase === 'over' ||
      this.phase === 'intro' ||
      (this.server === 'player' && this.phase === 'toss') ||
      (this.server === 'player' && this.phase === 'serve' && this.serveCtl.state !== 'POSITIONING');
    // al sacar (antes de lanzar) solo hay desplazamiento lateral dentro de la mitad de la línea de fondo
    const positioning = this.server === 'player' && this.phase === 'serve' && this.serveCtl.state === 'POSITIONING';
    if (pl.stun > 0) pl.stun -= dt;
    const raw = this.inputVector();
    const v = frozen ? new Phaser.Math.Vector2() : positioning ? new Phaser.Math.Vector2(raw.x, 0) : raw;
    // la dirección para apuntar se lee aunque el jugador esté quieto cargando
    if (raw.lengthSq() > 0.09) {
      this.lastDir.copy(raw);
      this.lastDirAt = this.time.now;
    }
    this.updateCharge(dt);
    // velocidad en pantalla (px/s): con inercia ligera (src/logic/PlayerMotion.ts) o instantánea (la de siempre)
    const maxSp = PLAYER_SPEED * (positioning ? SERVE.positionSpeed : 1);
    const inertia = this.inertiaOn();
    let motionEvt: MotionEvent = null;
    if (!inertia || frozen) stopMotion(this.motion); // congelado (carga, DASH, saque…): se para en seco, como antes
    else motionEvt = stepMotion(this.motion, v.x * maxSp, v.y * maxSp, maxSp, dt);
    const mvx = inertia ? this.motion.vx : v.x * maxSp;
    const mvy = inertia ? this.motion.vy : v.y * maxSp;
    // desplazamiento del paso: con inercia, el exacto del modelo (igual a cualquier FPS); sin ella, v·dt de siempre
    const ddx = inertia ? this.motion.dx : mvx * dt;
    const ddy = inertia ? this.motion.dy : mvy * dt;
    // pantalla -> cancha: arriba = hacia la red (+x), derecha = +y. Contra un borde, esa velocidad se anula.
    if (positioning) {
      const ny = pl.y + ddx;
      pl.y = clamp(ny, this.serveZone[0], this.serveZone[1]);
      if (pl.y !== ny) this.motion.vx = 0;
    } else {
      const nx = pl.x - ddy;
      const ny = pl.y + ddx;
      pl.x = clamp(nx, P_X[0], P_X[1]);
      pl.y = clamp(ny, Y_MIN, Y_MAX);
      if (pl.x !== nx) this.motion.vy = 0;
      if (pl.y !== ny) this.motion.vx = 0;
    }
    if (inertia) {
      const k = Math.hypot(mvx, mvy) / PLAYER_SPEED;
      pl.ch.setMoving(k > MOTION.moveMin, mvx, k); // ritmo de carrera = velocidad real
      if (motionEvt === 'skid') pl.ch.skid();
      else if (motionEvt === 'turn') pl.ch.brakeTurn(Math.sign(v.x));
    } else pl.ch.setMoving(v.lengthSq() > 0.01, v.x); // v.x: lado al que corre en pantalla (voltea la carrera)
    this.updateFacing(pl);
    // guardia con la raqueta atrás cuando la pelota viene hacia el jugador y ya está cerca
    const sb = this.ball.s;
    pl.ch.setReady(
      this.phase === 'rally' && this.lastHitter !== 'player' && sb.x < NET_X && sb.vx < 0 && !pl.vanished && sb.z < HIT_MAX_Z * 1.6 && this.reachDist(pl, sb) < READY_DIST,
    );

    // --- bot
    const bt = this.bot;
    // movimiento del rival: lo decide el cerebro (src/ai/BotBrain.ts); aquí solo se aplica
    const mv = this.brain.tick(bt, {
      dt,
      phase: this.phase,
      botServes: this.server === 'bot',
      servePositioning: this.serveCtl.state === 'POSITIONING',
      serveY: this.botServeY,
      ball: this.ball.s,
    });
    bt.ch.setMoving(mv.moving, mv.dirX);
    if (mv.readyToToss) this.beginToss(this.botPlan.kind);
    this.updateFacing(bt);

    // --- tiempo para sacar (solo el jugador): si se agota, falta
    this.tickServeClock(dt);

    // --- pelota
    if (this.phase === 'serve' || this.phase === 'intro') {
      this.holdBall();
      this.ball.s.z = 62 + Math.sin(this.time.now / 150) * 4;
    } else if (this.phase === 'toss') {
      const srv = this.srvActor();
      const s = this.ball.s;
      const ctl = this.serveCtl;
      s.x = srv.x + srv.dir * 10;
      s.y = srv.y + srv.ch.facing * 28;
      const ev = stepBall(s, dt);
      if (ev === 'bounce') this.tossFault(); // golpe en vacío: la pelota cayó al suelo
      else if (ctl.state === 'AIMING' && s.vz < 0 && s.z <= SERVE.catchZ) this.catchBall(); // no la golpeó: la atrapa y reintenta
      else {
        const tev = ctl.tick(dt);
        if (this.server === 'bot' && ctl.state === 'AIMING' && ctl.t >= this.botPlan.pressAt) this.beginSwing();
        // el botón elegido se ilumina en azul neón mientras dura la ventana de saque perfecto
        if (this.server === 'player' && ctl.kind) (ctl.kind === 'normal' ? this.serveNormalBtn : this.serveSpinBtn).setCue(ctl.windowOpen());
        if (tev === 'contact') this.executeServe();
      }
    } else if (this.phase === 'rally' || this.phase === 'pointover') {
      const sub = 3;
      for (let i = 0; i < sub; i++) {
        const px = this.ball.s.x;
        const ev = stepBall(this.ball.s, dt / sub);
        this.contactClock = this.simClock + ((i + 1) * dt) / sub; // instante del contacto si golpea en este subpaso
        // saque que roza la cinta de la red por encima: si cae en el cuadro es let
        if (this.serving && this.phase === 'rally' && (px - NET_X) * (this.ball.s.x - NET_X) < 0 && this.ball.s.z >= NET_HEIGHT && this.ball.s.z <= NET_HEIGHT + SERVE.letBand) this.serveLet = true;
        if (this.phase !== 'rally') {
          this.checkBackWall(px); // punto ya decidido: la pelota también rebota en la pared (sin puntuar)
          continue;
        }
        if (ev === 'net' && this.serving && this.serveNetLoss) {
          this.serveNetLoss = false;
          this.serving = false;
          this.pointTo(this.lastHitter === 'player' ? 'bot' : 'player', '¡RED!', '#ff7a85');
        } else if (ev === 'net' && this.serving) this.serviceFault();
        else if (ev === 'net' && this.lastHitter) {
          const rec: Who = this.lastHitter === 'player' ? 'bot' : 'player';
          this.pointTo(rec, '¡RED!', '#ff7a85');
        } else if (ev === 'bounce') this.handleBounce();
        if (this.phase === 'rally') this.checkHits();
        this.checkBackWall(px); // después de los golpes: si el rival llegaba, ya devolvió
        if (this.cine.active) break; // contacto reservado: la pelota no avanza más
      }
      this.updateDashHit(dt);
    }

    // globo: caída prevista, círculo en el suelo y aviso del SMASH potenciado (solo presentación + reglas)
    const lob = this.lob.update(dt, this.ball.s, this.lastHitter, this.ball.shotKind, this.phase, this.bounces);
    const insideLob = lob.receiver === 'player' && this.lob.contains(pl.x, pl.y);
    const canSuper = this.lob.windowOpenFor('player', pl.x, pl.y);
    if (!lob.active) this.superArmed = false;
    // el botón SMASH brilla en dorado cuando pulsarlo AHORA daría un remate potenciado (o ya se armó así)
    this.smashBtn.setHint((canSuper && this.smashBtn.ready && !this.smashArmed) || (this.superArmed && canSuper));
    this.lobMarker.render(dt, lob, insideLob, canSuper);

    this.ball.render(dt);
    // humo del SMASH en vuelo (fuerte si es el potenciado)
    if (!this.ball.power) this.superFlight = false;
    // (el INFERNO DRIVE no echa humo: su rastro es de fuego)
    this.smoke.update(dt, this.ball.s, this.ball.power && !this.infernoFlight, this.superFlight, this.ball.sprite.visible);
    // INFERNO DRIVE: pelota envuelta en llamas mientras dure su trayectoria
    if (!this.ball.power) this.infernoFlight = false;
    this.ball.quietFx = this.infernoFlight;
    this.fire.update(this.ball.s, this.infernoFlight, this.ball.sprite.visible);
    this.tickServeJump(dt); // salto del saque (visual)
    this.renderActors();
    this.renderServeAim();
    // turno de saque: aparece al terminar la presentación (INICIO) y se oculta al lanzar la pelota
    const waitingServe = this.phase === 'serve' && !this.serving;
    const srvHead = this.headPos(this.srvActor());
    this.serveTag.update(dt, waitingServe ? this.server : null, srvHead.x, srvHead.y);

    // cámara: sigue un poco al jugador en lateral (tipo Mario Tennis)
    const cam = this.cameras.main;
    const pp = project(pl.x, pl.y);
    const target = this.baseScrollX + (pp.sx - VIEW.W / 2) * VIEW.FOLLOW;
    cam.scrollX += (target - cam.scrollX) * Math.min(1, dt * 5);

    // globo hacia el jugador y él dentro del círculo: zoom suave hacia él (el HUD va en otra cámara y no se mueve).
    // Al golpear (el globo deja de estar activo) o al salir del círculo, vuelve al encuadre normal.
    // Solo cuando recibe el JUGADOR: si el globo es para el rival no hay zoom.
    if (this.phase !== 'intro' && this.phase !== 'over') {
      const want = lob.active && lob.receiver === 'player' && insideLob ? 1 : 0;
      const rate = want > this.lobZoomK ? LOB_SMASH.zoomIn : LOB_SMASH.zoomOut;
      this.lobZoomK += (want - this.lobZoomK) * Math.min(1, dt * rate);
      if (this.lobZoomK < 0.002) this.lobZoomK = 0;
      const k = this.lobZoomK;
      // toma especial: más cerca, encuadre bajo (los pies al centro: red y rival "por encima"),
      // leve inclinación tipo cine y viñeta. Todo escala con k y vuelve a cero al golpear / salir.
      const ease = k * k * (3 - 2 * k);
      cam.setZoom(1 + (LOB_SMASH.zoom - 1) * ease);
      cam.scrollY = (pp.sy - LOB_SMASH.focusLift - this.scale.height / 2) * ease;
      cam.scrollX += (pp.sx - VIEW.W / 2) * (1 - VIEW.FOLLOW) * 0.5 * ease * Math.min(1, dt * 5);
      cam.setRotation(LOB_SMASH.tilt * ease * (this.player.ch.facing >= 0 ? -1 : 1));
      this.lobVignette.setAlpha(LOB_SMASH.vignette * ease).setVisible(ease > 0.01);
    }
    // reloj de simulación de Perfect Timing (mismo dt que la física)
    this.simClock += dt;
    this.simRealAt = performance.now();
  }
}









