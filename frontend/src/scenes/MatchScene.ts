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
  LUNGE_CONTACT_S,
  LUNGE_ARM,
  NET_HEIGHT,
  NET_OVERHANG,
  NET_X,
  GRAVITY,
  PLAYER_SPEED,
  SERVE,
  SERVE_SPEED,
  SHOT_SPEED,
  SIDE_MARGIN,
  SMASH_COOLDOWN,
  SMASH_SPEED_MULT,
  MAX_LEVEL,
} from '../config';
import { Ball, type BallState, type ShotKind, aimShot, isInCourt, stepBall } from '../objects/Ball';
import { Character, PLAYER_LOOK, lookForSkin, playerLook, rivalLook } from '../objects/Character';
import type { BotAI } from '../logic/BotAI';
import { BotBrain } from '../ai/BotBrain';
import { profileForMatch, rivalLevelFor } from '../ai/BotProfile';
import { type ServeKind, ServeController } from '../logic/ServeController';
import { type BotServePlan, ServeAI } from '../logic/ServeAI';
import { NEON, ServeButton } from '../ui/ServeButton';
import { ChargeMeter } from '../ui/ChargeMeter';
import { BUTTON_ART, queueButtonArt } from '../ui/buttonArt';
import { ChargeAura, ChargeSparks, TIER_TRAIL, playImpact, shockFx } from '../fx/shotFx';
import { getProfile } from '../logic/Profile';
import { type ChargeFxId, chargeFxOf } from '../domain/chargeFx';
import { ChargeSpriteFx, chargeFxReady, isSpriteCharge, queueChargeFxArt } from '../fx/chargeFx';
import { styleLook } from '../ui/styleLook';
import { HyperAura } from '../objects/HyperAura';
import { Score } from '../logic/Score';
import { ABILITIES } from '../logic/Abilities';
import { Joystick } from '../ui/Joystick';
import { ScoreBoard } from '../ui/ScoreBoard';
import { showConfirm } from '../ui/ConfirmDialog';
import { AbilityButton } from '../ui/AbilityButton';
import { Emotes, queueEmoteArt } from '../ui/Emotes';
import { ownedEmotes } from '../domain/emotes';
import { getPlayer } from '../domain/playerStore';
import { C, FONT, textStyle } from '../ui/theme';
import { VIEW, project } from '../view/projection';
import { drawCourtView } from '../view/CourtView';
import { playMatchMusic, stopMatchMusic, takePickedAmbiente } from '../fx/matchMusic';
import { LOB_SMASH, LobTracker, REMATE } from '../logic/LobSmash';
import { LobMarker, superSmashFx } from '../fx/LobMarker';
import { SmokeTrail } from '../fx/SmokeTrail';
import { SMASH_CINE, SmashCinematic, type CineFocus, smashCineEnabled, spritesIn } from '../fx/SmashCinematic';
import { SMASH_LOOK, smashCine } from '../fx/smashFx';
import { type SmashPower, isSmashPower } from '../domain/smashPowers';
import { elementTexture } from '../ui/AbilityButton';
import { INFERNO, INFERNO_CINE, InfernoDrive, planInfernoContact } from '../logic/InfernoDrive';
import { GhostTrail, INFERNO_LOOK, InfernoFire, infernoCine, infernoElementFor, infernoImpactFx, infernoShake, infernoSound, queueInfernoArt, type InfernoElement } from '../fx/InfernoFx';
import { isInfernoPower } from '../domain/infernoPowers';
import { POWER_IMPACT, type PowerKind, RACKET_LOSS, knockbackX, stunMsFor, stunSeconds } from '../logic/PowerImpact';
import { LOOSE_RACKET, ensureLooseRacket } from '../objects/NxoActor';
import { type BotKit, botKitFor } from '../ai/botKit';
import { NetView } from '../fx/NetView';
import { applyCharColor, devCharColor } from '../fx/CharColorFx';
import { charColorOf } from '../domain/charColors';
import { type UnlockKey, isUnlocked, unlockLabel } from '../domain/unlocks';
import { queueAmbientBird, spawnAmbientBird } from '../fx/AmbientBird';
import { queueAmbientPlane, spawnAmbientPlane } from '../fx/AmbientPlane';
/** paloma y avión del ambiente: el segundo sale este tiempo después del primero (orden al azar) */
const AMBIENT_GAP_MS = 30_000;
/**
 * Devolución PERFECT del ESPECIAL rival (MatchScene.smashPerfectReturn): el toque debe caer a ±windowS del bote de la bola
 * en tu lado y el contacto, como mucho afterBounceS después del bote.
 */
const SMASH_PERFECT = { windowS: 0.12, afterBounceS: 0.45 };
import { infernoGroundFx, powerImpactFx } from '../fx/ImpactFx';
import { ultiStunFx } from '../fx/elementImpactFx';
import { playMatchEnd } from '../fx/matchEnd';
import { playMatchIntro } from '../fx/matchIntro';
import { ServeTurnTag } from '../ui/ServeTurnTag';
import { setupUiCamera } from '../view/uiCamera';
import { showCallout } from '../fx/callout';
import { queueGazeArt, showInfernoGaze } from '../fx/infernoGaze';
import { ZONE, ZoneTracker, type Side as ZoneSide } from '../logic/Zone';
import { ZoneFx } from '../fx/ZoneFx';
import type { MatchNet } from '../net/MatchNet';
import type { ActionMsg, HitMsg, PointMsg, ScoreMsg, StateMsg } from '../net/protocol';
import { mirrorX, mirrorY } from '../net/mirror';
import { RemoteInterp } from '../net/interp';
import { MatchDiag, netLogOn } from '../net/matchDiag';
import { POINT_SPLASH_MS, isMatchPoint, showPointSplash } from '../fx/pointSplash';
import { showSideNotice } from '../fx/sideNotice';
import { TIMING, TimingTracker, type ShotClass, type TimingResult, applyError, evaluateCharge, nextStreak, timedSpeed, timingMods } from '../logic/PerfectTiming';
import { TimingRing, perfectSound, playStreakFx, playTimingFx, vibrate } from '../fx/timingFx';
import { playMatchFinale } from '../fx/matchFinale';
import { getSettings } from '../logic/Settings';
import { MOTION, type MotionEvent, createMotion, stepMotion, stopMotion } from '../logic/PlayerMotion';
import { DASH, type DashRun, createRun, guaranteeStep, planSprint, sampleTrajectory, shouldCancelRun, stepRun } from '../logic/DashSprint';
import { DashFx } from '../fx/dashFx';
import { WALL, type WallGeom, wallFromArt, wallHit, wallOutcome } from '../logic/BackWall';
import { type ZoneStatLevels, newZoneProgress, zoneStatPercent } from '../domain/zoneProgress';
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
  /** altura extra del dibujo (SUPERSALTO), en unidades z; la sombra/profundidad siguen en el suelo */
  lift?: number;
  /** raqueta en el suelo tras recibir la ULTI (RACKET_LOSS): sin ella no golpea ni usa habilidades */
  racket?: { x: number; y: number; img: Phaser.GameObjects.Image; mark: Phaser.GameObjects.Ellipse } | null;
}

/**
 * Nuevos DEFENSIVOS (11-11-2026), como el DASH: te dejan en el punto de la pelota y la devolución está asegurada.
 *   SOMBRA      un clon de sombra corre hasta el punto (runS) y cambias tu lugar con él
 *   SUPERSALTO  salto en parábola hasta el punto (airS, `height` en z) y aterrizaje con onda de choque
 */
const SHADOW = { runMin: 0.22, runMax: 0.5, tint: 0x5a32b8, alpha: 0.82 };
const JUMP = { airMin: 0.42, airMax: 0.72, height: 120 };

const LAT_C = (COURT.top + COURT.bottom) / 2;
const HALF_W = (COURT.bottom - COURT.top) / 2;
const Y_MIN = COURT.top - SIDE_MARGIN;
const Y_MAX = COURT.bottom + SIDE_MARGIN;
const P_X = [COURT.left - 70, NET_X - 45];
/**
 * DEFENSIVO (DASH / DESTELLO): cuánto POR DETRÁS de la zona del jugador (P_X[0]) puede estar la pelota y aún devolverla.
 * Antes 20: si la pelota ya te había pasado, "¡Muy tarde!". Ahora vale hasta el 2º bote (en tu lado no hay pared).
 * Contra el ESPECIAL o la ULTI el golpe forzado te aturde igual (playerHit).
 */
const DASH_BACK_REACH = 150;
/** joystick: con la cortita / el globo, |x| a partir de esto cuenta como DIAGONAL (bote hacia ese lado) */
const DIAG_X = 0.35;
const B_X = [NET_X + 45, COURT.right + 130];

const rand = Phaser.Math.FloatBetween;
const clamp = Phaser.Math.Clamp;

/** Solo animación: altura de pelota desde la que el golpe del jugador se muestra como remate. */
const OVERHEAD_Z = 116;
/** En la red (jugador por delante de esta x) y pelota sin botar: remate si viene al menos a esta altura; si no, volea. */
const NET_ZONE_X = NET_X - 170;
/** partido en red: espera máxima a la salida del servidor (game:start) antes de cancelar */
const NET_START_WAIT_MS = 15000;
/** INFERNO: duración total de la franja con la mirada (entrada + visible + salida), en ms */
/** la franja de la mirada arranca con la cinemática y se va este tiempo antes del golpe (para ver la pelota) */
const GAZE_END_BEFORE_HIT_MS = 500;
const NET_SMASH_Z = 78;
/**
 * Salto del saque: `max` = salto máximo (unidades del personaje). La altura a la que hay que llevar la raqueta es el
 * CENTRO DEL CORDAJE en el frame de impacto de cada hoja (Character.serveRacket, medido en las tiras), no el borde del
 * sprite: así la pelota toca la raqueta y no queda por encima. 235 llega hasta la pelota del punto más alto del lanzamiento.
 */
const SERVE_JUMP = { max: 235, hangMs: 70, fallMs: 300, maxShift: 45 };
/** Solo animación: distancia (suelo) a la que el jugador se pone en guardia esperando la pelota. */
const READY_DIST = 200;
/** DASH: tiempos del teletransporte (s). El rápido se usa cuando la pelota llega muy justa. */
const DASH_WARP = { out: 0.11, delay: 0.04, in: 0.18, fastOut: 0.05, fastIn: 0.07 };
/** INFERNO DRIVE: el fotograma de preparación 9 aparece justo antes del golpe (no mueve la cinemática). */
const INFERNO_PRE_MS = 45;
/**
 * DESTELLO (poder del DEFENSIVO, domain/defensivePowers.ts): teletransporte a la pelota con estela de movimiento rápido
 * y revés. Tiempos (s) de desaparecer / aparecer (los "fast" son para cuando la pelota va justa), `side` = cuánto a la
 * derecha de la pelota aparece (así la pelota queda a su izquierda y el revés es natural) y `swingLead` = cuánto antes
 * del contacto arranca el revés para que la raqueta llegue a la pelota justo cuando entra.
 */
const BLINK = { out: 0.05, in: 0.1, fastOut: 0.03, fastIn: 0.05, side: 36, swingLead: 0.15 };

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
  /** emotes del jugador (ui/Emotes.ts): 3 caritas, una cada 10 s */
  private emotes!: Emotes;
  private sideScoreMarker?: Phaser.GameObjects.Container;
  private sideScoreMarkerTimer?: Phaser.Time.TimerEvent;
  private dialog: Phaser.GameObjects.GameObject[] = [];
  private paused = false;
  private baseScrollX = 0;
  /** última dirección del joystick (para elegir el tipo de golpe) */
  private lastDir = new Phaser.Math.Vector2();
  private lastDirAt = -1e9;
  private keys?: Record<string, Phaser.Input.Keyboard.Key>;

  private phase: Phase = 'intro';
  private server: Who = 'player';
  /** ZONA (logic/Zone.ts): remontada; aura + rayo en los ojos y mejoras durante 2 puntos */
  private zone = new ZoneTracker();
  private zoneLevels: Record<ZoneSide, ZoneStatLevels> = { player: newZoneProgress().stats, bot: newZoneProgress().stats };
  /** hasta cuándo se ve la franja de la mirada del INFERNO (para no repetirla) */
  private zoneFx: Partial<Record<ZoneSide, ZoneFx>> = {};
  private _lastHitter: Who | null = null;
  /** golpes dados en el punto en curso (lo lleva el setter de lastHitter) */
  private shotsThisPoint = 0;
  /** sonido de "cargando" del ESPECIAL armado (se apaga al golpear) */
  private smashSnd: Phaser.Sound.BaseSound | null = null;

  /**
   * Sin habilidades (DEFENSIVO, ESPECIAL, ULTI) durante el saque y su resto: desde que se prepara el saque hasta que el que
   * lo recibe lo devuelve (2º golpe del punto). Vale sacando y recibiendo.
   */
  private get serveLock() {
    return this.phase === 'serve' || this.phase === 'toss' || this.serving || (this.phase === 'rally' && this.shotsThisPoint < 2);
  }
  /** último en golpear. En partido en red, al pasar a 'player' (golpe / saque propio) se envía la pelota al rival. */
  private get lastHitter(): Who | null {
    return this._lastHitter;
  }
  private set lastHitter(v: Who | null) {
    // golpes del punto (saque = 1, resto = 2…): las habilidades se bloquean hasta que el resto ya salió (serveLock)
    this.shotsThisPoint = v === null ? 0 : this.shotsThisPoint + 1;
    this._lastHitter = v;
    if (v === 'player' && this.net && !this.netApplying) this.netHitPending = true;
  }
  // ---- partido en red (null = modo BOT de siempre; ver sección "partido en red")
  private net: MatchNet | null = null;
  /** aplicando un mensaje del rival: no se reenvía ni se juzga otra vez */
  private netApplying = false;
  /** golpe propio pendiente de enviar (se envía con la pelota ya calculada) */
  private netHitPending = false;
  /** este cliente decide el resultado aunque la última pelota sea suya (falta de lanzamiento / tiempo de saque) */
  private netForceAuthority = false;
  /** el próximo saque es segundo saque (para adelantar el punto si el rival ya sacó) */
  private netNextSecond = false;
  private netStateAt = 0;
  /** último estado enviado al rival (para no repetirlo mientras el jugador está quieto) */
  private netLastState: { x: number; y: number; moving: boolean; dirX: number; facing: number; charging: boolean; stunned: boolean } | null = null;
  private netPrev = { x: 0, y: 0 };
  /** último estado del rival (ya espejado) */
  private netRemote: StateMsg | null = null;
  /** posición del rival interpolada entre sus estados reales (~100 ms en el pasado; net/interp.ts) */
  private netInterp = new RemoteInterp(100);
  /** hasta cuándo (performance.now) su posición la manda una animación propia (estirada, DESTELLO, teletransporte) */
  private netBotLockUntil = 0;
  /** DASH del rival en curso (para sus sombras) */
  private netBotDash: { t: number; ghosts: number } | null = null;
  /** DASH del BOT en curso: sus 3 sombras mientras corre (los mismos efectos que el tuyo) */
  private botDashFx: { t: number; ghosts: number } | null = null;
  /** SOMBRA / SUPERSALTO del rival en curso (aviso 'defensive'): manda sobre su posición hasta terminar */
  private netBotFly: { kind: 'shadow' | 'jump'; from: { x: number; y: number }; to: { x: number; y: number }; t: number; dur: number; ghosts: number; clone?: Character } | null = null;
  /** lanzamiento del rival que llegó antes de que aquí empezara el punto */
  private netPendingToss: string | null = null;
  /** datos REALES del golpe propio que se enviarán en game:hit (los rellenan playerHit / executeServe / playerLunge / playerImpact) */
  private netHit: Partial<Pick<HitMsg, 'charged' | 'overhead' | 'volley' | 'serveSpin' | 'lunge' | 'impact' | 'special' | 'shock'>> = {};
  /** cinemática del rival en curso (SMASH / INFERNO vista desde este teléfono): su golpe llegará al terminar */
  private netRemoteCine = false;
  /** avisos del rival que llegaron durante su cinemática: se aplican, en orden, cuando termina */
  private netDeferred: Array<() => void> = [];
  /** aura del SMASH armado del rival (solo en red) */
  private botAura: HyperAura | null = null;
  private bounces = 0;
  private smashArmed = false;
  /** globo en vuelo: caída prevista y reglas del SMASH potenciado (src/logic/LobSmash.ts) */
  private lob = new LobTracker();
  /** REMATE del globo en curso: cámara lenta, apuntado a 4 cuadros y aro que se cierra (REMATE en logic/LobSmash.ts) */
  private remateCine: { t: number; T: number; aim: { col: -1 | 1; row: 'short' | 'deep' }; g: Phaser.GameObjects.Graphics; ring: Phaser.GameObjects.Graphics; label?: Phaser.GameObjects.Text } | null = null;
  /** golpe del remate ya decidido (lo usa playerHit): destino, velocidad y si fue SMASH! */
  private remateShot: { tx: number; ty: number; speed: number; perfect: boolean } | null = null;
  /** cámara lenta del partido (1 = normal) */
  private slowMo = 1;
  /** remate fallado (golpe al aire) en este globo: no vuelve a empezar hasta otro globo */
  private remateWhiffed = false;
  /** s que quedan de la recuperación tras el golpe al aire (sin moverse ni golpear) */
  private remateRecover = 0;
  /** REMATE del BOT en curso: cuándo golpea (fracción del cierre: 1 = SMASH!) y a qué cuadro de tu campo */
  private botRemate: { t: number; T: number; hitAt: number; col: -1 | 1; row: 'short' | 'deep'; label?: Phaser.GameObjects.Text } | null = null;
  /** texto REMATE del rival en red (se quita cuando golpea) */
  private netRemateLabel: Phaser.GameObjects.Text | null = null;
  /** si el BOT intenta rematar el globo en curso (se decide una vez por globo; null = aún no) */
  private botRemateRoll: boolean | null = null;
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
  private dashHit: { t: number; elapsed: number; x: number; y: number; sprint?: true; blink?: true; swung?: boolean } | null = null;
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
  /** elemento de la bola del INFERNO en vuelo (fx/InfernoFx): el poder de quien lo lanzó (fuego, hielo, viento, rayo) */
  private infernoEl: InfernoElement = 'fire';
  /** en red: poder del último INFERNO del rival (llega en 'inferno-cine'); null = no llegó (se usa el de su personaje) */
  private netRivalInferno: InfernoElement | null = null;
  /** poder del SMASH (ESPECIAL) elegido en Personalización: aspecto de la pelota, aura, cinemática e impacto */
  private smashEl: SmashPower = 'fire';
  /** poder del SMASH de la pelota que vuela ahora (la tuya, la del BOT = fuego o la del rival en red) */
  private smashFlightEl: SmashPower = 'fire';
  /** en red: poder del último SMASH del rival (llega en 'smash-armed' / 'smash-cine') */
  private netRivalSmashEl: SmashPower = 'fire';
  /** red de tenis dibujada (fx/NetView.ts): ondula y suena cuando la pelota pega o roza la cinta */
  private netView!: NetView;
  /** modo BOT: defensivo, especial, ulti y carga según su personaje (ai/botKit.ts: Mai = destello/hielo/tulipán, Nxo = dash/fuego) */
  private botKit: BotKit = botKitFor('nxo');
  /** playerHit en curso es el de INFERNO DRIVE (lo pone la cinemática justo antes de golpear) */
  private infernoPending = false;
  /** la pelota en vuelo es un INFERNO DRIVE (fuego en espiral) */
  private infernoFlight = false;
  /** salto del saque en curso (solo visual: desplaza el `rig` del personaje) */
  private serveJumpState?: { a: Actor; t: number; up: number; rise: number; dx: number };
  /** desplazamiento lateral (mundo) de la pelota respecto al sacador al lanzarla */
  private tossFromDy = 0;
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
  private chargeSparks!: ChargeSparks;
  /** Perfect Timing: aro guía sobre la pelota y racha de PERFECTO seguidos */
  private timingRing!: TimingRing;
  private perfectStreak = 0;
  /** chispas del rival en red cuando lleva la carga al máximo (1,1 s cargando) */
  private rivalSparks!: ChargeSparks;
  /** brillo y aro en el suelo del rival mientras carga el golpe (en red; los mismos que ve él) */
  private rivalAura!: ChargeAura;
  private rivalRing!: Phaser.GameObjects.Ellipse;
  private rivalRingGold = false;
  private rivalChargeT = 0;
  /** efecto de CARGA propio y del rival (domain/chargeFx.ts): 'classic' = el aro por código; el resto, sprites (fx/chargeFx.ts) */
  private chargeKind: ChargeFxId = 'classic';
  private chargeSprite!: ChargeSpriteFx;
  private rivalChargeKind: ChargeFxId = 'classic';
  private rivalChargeSprite!: ChargeSpriteFx;
  private chargeSnd: Phaser.Sound.BaseSound | null = null;
  private ambienteKey = '';
  private ambienteHint: string | null = null;
  private dizzy!: Phaser.GameObjects.Container;
  /** estrellas del jugador aturdido por el SMASH rival */
  private dizzyP!: Phaser.GameObjects.Container;
  /** estilo equipado (Tienda / Personaje): color de la estela de tus golpes */
  private get look() {
    return styleLook(getProfile().style);
  }
  /** estela de TUS golpes normales: solo con un estilo comprado; el clásico no deja estela (Ball.update) */
  private get trailLook() {
    return getProfile().style === 'classic' ? undefined : this.look;
  }
  private playerDizzy = false;

  // HUD
  private hud!: Phaser.GameObjects.Container;
  /** degradado común tras los controles inferiores para unificar el cierre de los distintos ambientes */
  private controlsBackdrop?: Phaser.GameObjects.Graphics;
  /** marcador visual (ui/ScoreBoard): solo dibuja, los datos salen de this.score */
  private board!: ScoreBoard;

  constructor() {
    super('Match');
  }

  preload() {
    queueEmoteArt(this.load); // miniaturas de 160 px (antes las fuentes de ~1,1 MB cada una)
    this.load.audio('marcador', 'mp3/marcador.mp3'); // suena completo cada vez que sale el marcador
    // los soundtracks NO se cargan aquí: se pide solo el del ambiente elegido (create) y se libera al salir
    this.load.audio('cargando', 'mp3/cargando.mp3'); // sonido de carga (tiro cargado e INFERNO)
    this.load.audio('inferno-hit', 'mp3/inferno.mp3'); // sonido del golpe INFERNO (sustituye al de golpe normal)
    this.load.audio('golpe-fuerte', 'mp3/golpe-fuerte.mp3'); // sonido de TODO golpe de raqueta a la pelota
    queueButtonArt(this.load); // imágenes de DASH, SMASH y los dos saques (si faltan, se dibujan como antes)
    queueInfernoArt(this.load); // bola de fuego animada de INFERNO DRIVE (si falta, se dibuja por código)
    queueAmbientBird(this.load); // paloma del ambiente (fx/AmbientBird.ts)
    queueAmbientPlane(this.load); // avión del ambiente (fx/AmbientPlane.ts)
    queueGazeArt(this.load, getProfile().skin); // INFERNO: franja con los ojos del personaje durante la concentración
    // en red también la del rival: su INFERNO se ve aquí con SUS ojos
    queueGazeArt(this.load, this.rivalSkin()); // en red o contra el bot: la del personaje que se ve al frente
    // efecto de CARGA (aro del suelo): el mío y, en red, el del rival
    queueChargeFxArt(this.load, [getProfile().charge, this.net ? chargeFxOf(this.net.opponent.charge, this.net.opponent.skin) : botKitFor(this.rivalSkin()).charge]);
  }

  init(data: { botName?: string; rivalLevel?: number; net?: MatchNet; ambiente?: string }) {
    this.botName = data?.botName ?? 'Bot';
    // ambiente elegido en la búsqueda (su música ya suena desde el VS); revancha = sin dato = se sortea
    const picked = takePickedAmbiente();
    this.ambienteHint = data?.ambiente ?? picked;
    // partido en red (multijugador 1v1): sin `net` todo funciona exactamente como contra el BOT
    this.net = data?.net ?? null;
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
    this.perfectStreak = 0;
    this.timingRing = new TimingRing(this);
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
    // en red el rival se ve con SU personaje (el que llega en opponent.skin; respaldo: rivalLook); contra el BOT, como siempre
    this.bot = mk(this.rivalLk(), 'front', COURT.right + 40, -1);
    // ESTILO DE COLOR del personaje (fx/CharColorFx.ts): el elegido en PERSONALIZACIÓN ('dev.charColor' lo fuerza)
    const charColor = devCharColor() ?? getProfile().color;
    if (charColor !== 'classic') applyCharColor(this.player.ch, charColor, getProfile().skin);
    // en red, el rival con SU estilo de color (llega en opponent.color; uno desconocido se ignora)
    const rivalColor = this.net ? charColorOf(this.net.opponent.color) : 'classic';
    if (rivalColor !== 'classic') applyCharColor(this.bot.ch, rivalColor, this.net?.opponent.skin ?? 'nxo');
    this.aura = new HyperAura(this, this.player.ch, 'ice');
    this.chargeRing = this.add
      .ellipse(0, 0, 120, 40, 0x6ec1ff, 0.25)
      .setStrokeStyle(5, 0xd6f0ff, 0.9)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
    this.chargeMeter = new ChargeMeter(this);
    this.chargeAura = new ChargeAura(this);
    this.chargeSparks = new ChargeSparks(this);
    this.rivalSparks = new ChargeSparks(this);
    this.rivalAura = new ChargeAura(this);
    this.rivalRing = this.add
      .ellipse(0, 0, 120, 40, 0x6ec1ff, 0.25)
      .setStrokeStyle(5, 0xd6f0ff, 0.9)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
    this.rivalRingGold = false;
    this.rivalChargeT = 0;
    // efectos de CARGA con sprites: el mío (Personalización; por defecto el de mi personaje) y el del rival en red
    const myFx = getProfile().charge;
    this.chargeKind = chargeFxReady(this, myFx) ? myFx : 'classic';
    this.chargeSprite = new ChargeSpriteFx(this);
    if (isSpriteCharge(this.chargeKind)) this.chargeSprite.use(this.chargeKind);
    this.botKit = botKitFor(this.rivalSkin());
    const rivalFx = this.net ? chargeFxOf(this.net.opponent.charge, this.net.opponent.skin) : this.botKit.charge;
    this.rivalChargeKind = chargeFxReady(this, rivalFx) ? rivalFx : 'classic';
    this.rivalChargeSprite = new ChargeSpriteFx(this);
    if (isSpriteCharge(this.rivalChargeKind)) this.rivalChargeSprite.use(this.rivalChargeKind);
    this.dizzy = this.makeDizzy();
    this.dizzyP = this.makeDizzy();
    this.ball = new Ball(this);
    this.brain = new BotBrain({ xMin: B_X[0], xMax: B_X[1], yMin: Y_MIN, yMax: Y_MAX }, profileForMatch(this.rivalLevel));
    this.ai = this.brain.ai;
    this.score = new Score();
    this.zone = new ZoneTracker();
    this.zoneLevels = {
      player: { ...getProfile().zoneStats },
      bot: { ...(this.net?.opponent.zoneStats ?? newZoneProgress().stats) },
    };
    this.zoneFx = { player: new ZoneFx(this), bot: new ZoneFx(this) };
    // en red: el host saca los juegos pares; el invitado ve al host como 'bot' (saca los impares desde su lado)
    if (this.net) this.score.serverOffset = this.net.servesFirst ? 0 : 1;

    this.createHud();
    this.joy = new Joystick(this);
    const d = ABILITIES.dash;
    const s = ABILITIES.smash;
    this.dashBtn = new AbilityButton(this, 0, 0, 54, DASH_COOLDOWN, d.color, d.colorDark, d.icon, 'DEFENSIVO', () => this.activateDash());
    this.smashBtn = new AbilityButton(this, 0, 0, 64, SMASH_COOLDOWN, s.color, s.colorDark, s.icon, 'ESPECIAL', () => (this.smashBtn.inferno ? this.armInferno() : this.activateSmash()));
    // solo DEFENSIVO / ESPECIAL (sin el nombre del poder); en nivel máximo, sin textos
    if (getProfile().level >= MAX_LEVEL) {
      this.dashBtn.hideTexts();
      this.smashBtn.hideTexts();
    }
    this.dashBtn.setArt(BUTTON_ART.dash.key);
    this.smashEl = getProfile().smash;
    this.smashFlightEl = 'fire';
    this.netRivalSmashEl = 'fire';
    // botón SMASH con el arte y el aro del poder elegido (el fuego conserva el de siempre)
    this.smashBtn.setArt(elementTexture(this, BUTTON_ART.smash.key, this.smashEl) ?? BUTTON_ART.smash.key);
    this.smashBtn.setArmedColor(SMASH_LOOK[this.smashEl].ring);
    this.surrenderBtn = this.makeSurrenderIcon();
    this.autoPlay = false;
    this.autoBtn = this.makeAutoButton();
    // solo los emotes desbloqueados (premios del Pase de Batalla); sin ninguno no hay botón
    this.emotes = new Emotes(this, () => this.headPos(this.player), ownedEmotes(getPlayer().owned));
    // en red: tus emotes también los ve el rival; el aura del SMASH armado del rival; sin restos de una partida anterior
    this.netHit = {};
    this.netLastState = null;
    this.netInterp.clear(); // sin estados del rival de una partida anterior
    this.netRtt = 0;
    this.netPingAt = 0;
    this.netLastMsgAt = performance.now();
    this.netWeak = null;
    this.netBotLockUntil = 0;
    this.netRemoteCine = false;
    this.netDeferred = [];
    // aura de llamas del rival: en estado ZONA (zoneRender), también contra el BOT
    this.botAura = new HyperAura(this, this.bot.ch, 'ice');
    if (this.net) {
      this.emotes.onSend = (k) => this.net?.sendAction('emote', { kind: k });
    }

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
    this.infernoEl = 'fire';
    this.netRivalInferno = null;
    this.infernoPending = false;
    this.infernoFlight = false;
    // anillo de carga de la ULTI: solo si ya la tienes (nivel; domain/unlocks.ts)
    if (this.unlocked('ulti')) this.smashBtn.setMeter(0, INFERNO.pointsToCharge);
    // ZONA bloqueada por nivel: tú nunca entras; en red, el rival según SU nivel (los dos teléfonos deciden igual)
    this.zone.locked.player = !this.unlocked('zone');
    this.zone.locked.bot = !!this.net && !isUnlocked('zone', this.net.opponent.level);
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
    // soundtrack del ambiente (fx/matchMusic.ts): si ya suena desde el VS sigue sin cortarse; si no (revancha), arranca.
    // Suena en bucle también bajo la pantalla de resultados y se libera al salir del partido.
    playMatchMusic(this, this.ambienteKey);
    this.events.once('shutdown', () => {
      stopMatchMusic(this);
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
    if (this.net) this.netSetup();
    else
      playMatchIntro(this, () => {
        this.startPoint();
        this.launchBird();
      });
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
    if (!this.controlsBackdrop) this.controlsBackdrop = this.add.graphics().setScrollFactor(0).setDepth(4900);
    const footerH = Math.min(360, H * 0.3);
    this.controlsBackdrop.clear();
    this.controlsBackdrop
      .fillGradientStyle(0x07152f, 0x07152f, 0x07152f, 0x07152f, 0, 0, 0.84, 0.84)
      .fillRect(0, H - footerH, W, footerH);
    // el mundo mide VIEW.W x VIEW.H: se centra en horizontal y el espacio extra queda abajo (controles)
    this.baseScrollX = (VIEW.W - W) / 2;
    this.cameras.main.setScroll(this.baseScrollX, 0).setZoom(VIEW.CAM_ZOOM);
    this.hud.setPosition(W / 2, 12);
    this.joy.layout();
    this.smashBtn.setPosition(W - 110, H - 225);
    this.dashBtn.setPosition(W - 250, H - 115);
    this.surrenderBtn.setPosition(W - 46, 150);
    this.emotes.setPosition(W - 46, 226);
    this.autoBtn.setPosition(W - 46, 302); // AUTO, bajo el botón de emojis
    this.serveNormalBtn.setPosition(W - 110, H - 225);
    this.serveSpinBtn.setPosition(W - 250, H - 115);
    this.serveClockText.setPosition(W / 2, 200);
    this.secondTag.setPosition(W / 2, 144); // bajo el marcador (ScoreBoard mide ~120 px con la píldora JUEGO)
  }

  // ---------------------------------------------------------------- AUTO (piloto automático para pruebas)
  /** AUTO encendido: el jugador se mueve, saca y usa habilidades solo (para probar el online sin otra persona) */
  private autoPlay = false;
  private autoBtn!: Phaser.GameObjects.Container;
  /** dirección de golpe del AUTO (se renueva cada ~0,9 s) y distancia a su punto de golpeo */
  private autoAim = new Phaser.Math.Vector2();
  private autoAimAt = 0;
  private autoGap = 0;
  private autoServeT = 0;
  /** s hasta el punto de golpeo previsto (−1 = no hay) y si cargará el golpe de esta pelota */
  private autoContactT = -1;
  private autoChargeWant = false;
  /** ya decidió habilidades para la pelota actual del rival (una vez por pelota) */
  private autoAbilFor = false;

  /** Botón redondo AUTO (bajo los emojis): verde = encendido. */
  private makeAutoButton() {
    const R = 30;
    const c = this.add.container(0, 0).setScrollFactor(0).setDepth(5600);
    const g = this.add.graphics();
    const txt = this.add.text(0, 1, 'AUTO', { fontFamily: '"Lilita One", "Arial Black", sans-serif', fontSize: '17px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 4 }).setOrigin(0.5);
    const draw = () => {
      g.clear();
      g.fillStyle(C.outline).fillCircle(0, 4, R + 6);
      g.fillStyle(this.autoPlay ? 0x1f8a3a : 0x2a3a66).fillCircle(0, 5, R);
      g.fillStyle(this.autoPlay ? 0x3ccf5a : 0x4a5f99).fillCircle(0, 0, R - 2);
      g.fillStyle(0xffffff, 0.25).fillEllipse(-4, -13, 34, 12);
    };
    draw();
    c.add([g, txt]);
    c.setSize(R * 2 + 16, R * 2 + 16).setInteractive({ useHandCursor: true });
    c.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e?.stopPropagation?.();
      this.autoPlay = !this.autoPlay;
      this.autoServeT = 0;
      if (!this.autoPlay) stopMotion(this.motion);
      draw();
      this.tweens.add({ targets: c, scale: { from: 0.88, to: 1 }, duration: 200, ease: 'Back.easeOut' });
      const h = this.headPos(this.player);
      this.popText(h.x, h.y - 10, this.autoPlay ? 'AUTO ON' : 'AUTO OFF', this.autoPlay ? '#9dffb0' : '#cfe0ff', 24);
    });
    return c;
  }

  /**
   * Movimiento del AUTO (en ejes del joystick): con la pelota viniendo, va al punto donde podrá golpearla (tras el bote,
   * a altura cómoda; con la misma física stepBall); si no, vuelve al centro cerca del fondo.
   */
  private autoMoveVector(): Phaser.Math.Vector2 {
    const pl = this.player;
    const b = this.ball.s;
    let tx = P_X[0] + (P_X[1] - P_X[0]) * 0.15;
    let ty = LAT_C;
    if (this.phase === 'rally' && this.lastHitter !== 'player' && b.vx < 0) {
      const s = { ...b };
      let bounces = this.bounces;
      const dt = 1 / 60;
      let pick: { x: number; y: number } | null = null;
      this.autoContactT = -1;
      for (let t = 0; t < 2.5; t += dt) {
        const ev = stepBall(s, dt);
        if (ev === 'net') break;
        if (ev === 'bounce' && ++bounces >= 2) break;
        if (s.x < NET_X - 30 && s.z < HIT_MAX_Z * 0.8 && (bounces >= 1 || s.z > 40)) {
          pick = { x: s.x, y: s.y };
          this.autoContactT = t;
          if (bounces >= 1 && s.vz < 0) break; // ya botó y baja: buen punto de golpeo
        }
      }
      if (pick) {
        tx = clamp(pick.x - 15, P_X[0], P_X[1]);
        ty = clamp(pick.y, Y_MIN, Y_MAX);
      }
    }
    // cancha -> joystick: derecha = +y, arriba = hacia la red (+x)
    const vx = ty - pl.y;
    const vy = -(tx - pl.x);
    const len = Math.hypot(vx, vy);
    this.autoGap = len;
    if (len < 6) return new Phaser.Math.Vector2();
    const k = Math.min(1, len / 50) / len;
    return new Phaser.Math.Vector2(vx * k, vy * k);
  }

  /** Cada fotograma del AUTO: dirección de golpe, saque y habilidades. */
  private autoTick(dt: number) {
    if (!this.autoPlay || this.paused || this.cine.active) return;
    const now = this.time.now;
    if (now > this.autoAimAt) {
      const r = Math.random();
      this.autoAim.set(r < 0.5 ? 0 : r < 0.7 ? -1 : r < 0.9 ? 1 : 0, r >= 0.9 ? (r < 0.95 ? -1 : 1) : 0);
      this.autoAimAt = now + 900;
    }
    // saque: se coloca un instante, lanza y golpea en lo alto
    if (this.server === 'player' && this.phase === 'serve' && this.serveCtl.state === 'POSITIONING') {
      this.autoServeT += dt;
      if (this.autoServeT > 0.8) {
        this.autoServeT = 0;
        this.onServeButton('normal', true);
      }
    } else if (this.server === 'player' && this.phase === 'toss' && this.serveCtl.state === 'AIMING' && this.ball.s.vz <= 0) {
      this.onServeButton(this.serveCtl.kind ?? 'normal');
    } else this.autoServeT = 0;
    // habilidades: una decisión por cada pelota del rival (ESPECIAL / ULTI a veces; DEFENSIVO si no llega)
    const fresh = this.lastHitter === 'bot' && !this.autoAbilFor;
    this.autoAbilFor = this.lastHitter === 'bot';
    if (fresh) this.autoChargeWant = Math.random() < 0.55; // cargar este golpe (más de la mitad de las veces)
    if (fresh && this.phase === 'rally' && !this.serveLock) {
      // ULTI cargada: la arma SIEMPRE (prueba su cinemática, la raqueta perdida y el aturdido del rival);
      // si no, ESPECIAL a veces
      if (this.smashBtn.inferno && this.smashBtn.ready && !this.inferno.armed) this.smashBtn.tryActivate();
      else if (!this.smashBtn.inferno && this.smashBtn.ready && !this.smashArmed && Math.random() < 0.35) this.smashBtn.tryActivate();
    }
    // golpe cargado: ya colocado y con la pelota a ~0,2–1,4 s, empieza a cargar (sale al contacto, como el tuyo)
    if (
      this.autoChargeWant &&
      !this.charging &&
      this.phase === 'rally' &&
      this.lastHitter === 'bot' &&
      !this.smashArmed &&
      !this.inferno.armed &&
      this.autoGap < 14 &&
      this.autoContactT >= 0.2 &&
      this.autoContactT <= 1.4 &&
      this.unlocked('charge')
    ) {
      this.autoChargeWant = false;
      this.toggleCharge();
    }
    if (this.phase === 'rally' && this.lastHitter === 'bot' && !this.serveLock && this.autoGap > 150 && this.dashBtn.ready && !this.dashRun && !this.dashHit) {
      this.dashBtn.tryActivate();
    }
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
    if (!this.net) {
      this.paused = true;
      this.time.paused = true;
    }
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
    this.net?.leave(); // el rival gana por abandono
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
    const drawn = drawCourtView(this, this.ambienteHint);
    // pared del fondo donde se ve: la del estadio (muro + valla) o, en el dibujo de siempre, la valla de x = ax1 (z 70)
    this.ambienteKey = drawn?.key ?? '';
    this.backWall = drawn ? wallFromArt(project, LAT_C, drawn.wallAtY, drawn.padPx, drawn.fencePx, VIEW.Z_K) : { x: ax1, padZ: WALL_Z, fenceZ: WALL_Z };
    if (!drawn) {
      const BX = -1000;
      const BY = 0;
      const baked = this.add.renderTexture(BX, BY, 2720, 1800).setOrigin(0).setDepth(-10);
      baked.draw(g, -BX, -BY);
    }
    g.destroy();

    // red: malla en rombos, cinta con caída al centro, correa, postes y sombra; ondula al recibir la pelota
    // (fx/NetView.ts; la física de la red no cambia: Ball.stepBall)
    // la red sobresale NET_OVERHANG por fuera de los dobles (postes azules); el choque de la pelota usa el mismo ancho
    this.netView = new NetView(this, (x, y, z = 0) => this.P(x, y, z), NET_X, dT - NET_OVERHANG, dB + NET_OVERHANG, NET_HEIGHT, this.P(NET_X, LAT_C).y);

    // PALOMA del ambiente (fx/AmbientBird.ts): una vez al empezar, posada ~5 s sobre el muro del fondo en una orilla
    // (lado al azar), lejos de la cancha; luego se va volando. Solo decoración.
    // Se lanza al terminar la intro (launchBird), para que se vea.
    // AVIÓN (fx/AmbientPlane.ts): cruza el cielo por encima de la valla del fondo.
    this.birdPerch = null;
    this.planeY = null;
    if (drawn) {
      const wallTop = drawn.wallAtY - drawn.padPx;
      const farL = this.P(COURT.right, dT).x;
      const farR = this.P(COURT.right, dB).x;
      this.birdPerch = {
        left: { x: Math.max(70, Math.min(farL, farR) - 120), y: wallTop },
        right: { x: Math.min(VIEW.W - 70, Math.max(farL, farR) + 120), y: wallTop },
      };
      this.planeY = drawn.wallAtY - drawn.fencePx - 110;
    }
  }

  /** dónde puede posarse la paloma del ambiente (null = sin ambiente o ya lanzada) */
  private birdPerch: Parameters<typeof spawnAmbientBird>[1] | null = null;
  /** altura del cruce del avión del ambiente (null = sin ambiente o ya lanzado) */
  private planeY: number | null = null;
  /**
   * Vida del ambiente, una vez por partido al acabar la intro: la PALOMA y el AVIÓN en orden al azar; el primero sale
   * ya y el segundo AMBIENT_GAP_MS después (si el partido sigue).
   */
  private launchBird() {
    const bird = this.birdPerch;
    const planeY = this.planeY;
    this.birdPerch = null;
    this.planeY = null;
    const spawnBird = () => bird && spawnAmbientBird(this, bird);
    // bordes de lo que ve la cámara (zoom < 1: algo más que VIEW.W)
    const spawnPlane = () => planeY !== null && spawnAmbientPlane(this, planeY, this.cameras.main.worldView.x, this.cameras.main.worldView.right);
    const [first, second] = Math.random() < 0.5 ? [spawnBird, spawnPlane] : [spawnPlane, spawnBird];
    first();
    this.time.delayedCall(AMBIENT_GAP_MS, () => {
      if (this.phase !== 'over') second();
    });
  }

  // ---------------------------------------------------------------- HUD
  private createHud() {
    // marcador nuevo (diseño en ui/ScoreBoard.ts); misma posición/profundidad que el anterior
    this.board = new ScoreBoard(this, { player: 'TÚ', rival: this.botName, gamesToWin: GAMES_TO_WIN });
    this.hud = this.board.setDepth(5500);
    // avisos breves junto al borde opuesto a Rendirse/Emojis, centrados entre ambos controles
    this.data.set('scoreInfo', (t: string, c: string, ms: number) => this.flashSideScoreMarker(t, c, ms));
  }

  /** Aviso temporal (FALTA, TIEMPO, LET…) en la misma altura que el grupo de controles derecho. */
  private flashSideScoreMarker(text: string, color: string, ms: number) {
    this.sideScoreMarkerTimer?.remove();
    this.sideScoreMarker?.destroy();

    const W = this.scale.width;
    const label = this.add.text(0, 0, text.toUpperCase(), {
      fontFamily: FONT,
      fontSize: '22px',
      color: '#ffffff',
      stroke: '#0a1638',
      strokeThickness: 5,
    }).setOrigin(0.5).setLetterSpacing(1);
    const maxLabelW = Math.min(230, W * 0.4);
    if (label.width > maxLabelW) label.setScale(maxLabelW / label.width);
    const w = label.width + 32;
    const h = 48;
    const marker = this.add.container(10 + w / 2, 188).setScrollFactor(0).setDepth(5700).setAlpha(0).setScale(0.86);
    const plate = this.add.graphics();
    plate.fillStyle(0x000000, 0.35).fillRoundedRect(-w / 2 + 3, -h / 2 + 5, w, h, h / 2);
    plate.fillStyle(0x0b1733, 0.96).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    plate.fillStyle(0xffffff, 0.08).fillRoundedRect(-w / 2 + 7, -h / 2 + 4, w - 14, h * 0.34, h * 0.17);
    plate.lineStyle(3, parseInt(color.replace('#', ''), 16) || 0xffc42e, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    marker.add([plate, label]);
    this.sideScoreMarker = marker;
    this.tweens.add({ targets: marker, alpha: 1, scale: 1, duration: 180, ease: 'Back.easeOut' });
    this.sideScoreMarkerTimer = this.time.delayedCall(ms, () => {
      if (!marker.active) return;
      this.tweens.add({ targets: marker, alpha: 0, x: marker.x - 12, duration: 180, onComplete: () => marker.destroy() });
    });
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
    return t;
  }

  private headPos(a: Actor) {
    const p = project(a.x, a.y);
    return { x: p.sx, y: p.sy - 150 * p.s * VIEW.CHAR_K };
  }

  // ---------------------------------------------------------------- habilidades
  /** DASH: desaparece y reaparece donde llegará la pelota. */
  private activateDash(): boolean {
    if (this.paused || this.cine.active || !this.unlocked('defensive')) return false;
    if (this.player.racket) return this.noRacketHint();
    if (this.serveLock) return this.serveLockHint();
    if (this.phase !== 'rally' || this.lastHitter !== 'bot' || this.player.vanished) {
      this.popText(this.headPos(this.player).x, this.headPos(this.player).y, 'Espera la pelota', '#cfe0ff', 24);
      return false;
    }
    // poder DESTELLO del defensivo (tienda): teletransporte + revés
    if (getProfile().defensive === 'blink') return this.startBlink();
    // SOMBRA (clon que corre y cambio de lugar) y SUPERSALTO (salto hasta el punto)
    if (getProfile().defensive === 'shadow') return this.startShadow();
    if (getProfile().defensive === 'jump') return this.startJump();
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
    const h0 = this.headPos(pl);
    this.popText(h0.x, h0.y - 10, 'DEFENSIVO', '#c9a4ff', 26);
    pl.vanished = true;
    this.dashHit = { t: plan.t, elapsed: 0, x: tx, y: ty };
    this.portalFx(pl.x, pl.y);
    // en red el rival ve los mismos portales y la reaparición (netRemoteWarp)
    this.net?.sendAction('defensive', {
      kind: 'warp',
      x: pl.x,
      y: pl.y,
      tx,
      ty,
      out: (fast ? DASH_WARP.fastOut : DASH_WARP.out) * 1000,
      in: (fast ? DASH_WARP.fastIn : DASH_WARP.in) * 1000,
      delay: fast ? 0 : DASH_WARP.delay * 1000,
    });
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

  /** clon de SOMBRA en marcha (del punto de salida al de golpeo) */
  private shadowRun: { ch: Character; from: { x: number; y: number }; to: { x: number; y: number }; t: number; dur: number; ghosts: number } | null = null;

  /**
   * SOMBRA: un clon oscuro de tu personaje sale corriendo hasta donde llegará la pelota; tú te quedas quieto. Al llegar
   * cambias tu lugar con él (te apareces allí y el clon se deshace) y devuelves: golpe asegurado como el DASH (dashHit).
   */
  private startShadow(): boolean {
    const pl = this.player;
    const plan = this.dashPlan(SHADOW.runMin + 0.08);
    if (!plan) {
      const h = this.headPos(pl);
      this.popText(h.x, h.y, '¡Muy tarde!', '#cfe0ff', 24);
      return false;
    }
    const tx = clamp(plan.x - 18, P_X[0], P_X[1]);
    const ty = clamp(plan.y, Y_MIN, Y_MAX);
    const dur = clamp(plan.t - 0.08, SHADOW.runMin, SHADOW.runMax);
    this.stopCharge();
    stopMotion(this.motion);
    this.endShadowRun();
    // el clon: tu mismo personaje, teñido de sombra morada y algo transparente, corriendo
    const clone = new Character(this, 0, 0, playerLook(getProfile().skin), 'back');
    for (const sp of spritesIn(clone)) sp.setTint(SHADOW.tint);
    clone.setAlpha(SHADOW.alpha);
    clone.setSprint(true, ty - pl.y);
    this.shadowRun = { ch: clone, from: { x: pl.x, y: pl.y }, to: { x: tx, y: ty }, t: 0, dur, ghosts: 0 };
    pl.vanished = true; // te quedas quieto (y sin golpe normal) hasta el cambio
    pl.ch.setMoving(false, 0);
    this.dashHit = { t: plan.t, elapsed: 0, x: tx, y: ty };
    const p = project(pl.x, pl.y);
    this.dashFx.burst(p.sx, p.sy, p.s * VIEW.CHAR_K, pl.ch.depth);
    const h = this.headPos(pl);
    this.popText(h.x, h.y - 10, 'DEFENSIVO', '#c9a4ff', 26);
    // el rival ve el mismo clon corriendo y el cambio de lugar (netRemoteDefensive)
    this.net?.sendAction('defensive', { kind: 'shadow', x: pl.x, y: pl.y, tx, ty, ms: dur * 1000 });
    this.updateShadowRun(0);
    return true;
  }

  /** Mueve el clon de SOMBRA; al llegar al punto, cambio de lugar (tú apareces allí). */
  private updateShadowRun(dt: number) {
    const r = this.shadowRun;
    if (!r) return;
    if (this.phase !== 'rally' || this.lastHitter === 'player') return this.endShadowRun();
    r.t += dt;
    const k = Math.min(1, r.t / r.dur);
    const x = r.from.x + (r.to.x - r.from.x) * k;
    const y = r.from.y + (r.to.y - r.from.y) * k;
    const p = project(x, y);
    r.ch.setPosition(p.sx, p.sy).setScale(p.s * VIEW.CHAR_K).setDepth(p.sy);
    // estela de sombras detrás del clon
    if (r.ghosts < 3 && r.t >= (r.dur / 4) * (r.ghosts + 1)) this.dashFx.ghost(r.ch, r.ghosts++, r.ch.depth);
    if (k < 1) return;
    // CAMBIO DE LUGAR: humo morado donde estabas, apareces en el punto y el clon se deshace
    const pl = this.player;
    this.portalFx(pl.x, pl.y, 0x5a32b8, 0xd4bfff);
    pl.x = r.to.x;
    pl.y = r.to.y;
    pl.vanished = false;
    pl.warp = 1;
    this.portalFx(pl.x, pl.y, 0x9a6bff, 0xffffff);
    this.endShadowRun();
  }

  /** Quita el clon de SOMBRA (con un humito) y te devuelve el control si seguías esperando el cambio. */
  private endShadowRun() {
    const r = this.shadowRun;
    if (!r) return;
    this.shadowRun = null;
    this.tweens.add({ targets: r.ch, alpha: 0, duration: 160, onComplete: () => r.ch.destroy() });
    if (this.player.vanished && !this.dashHit) this.player.vanished = false;
  }

  /**
   * SUPERSALTO: salto en parábola hasta donde llegará la pelota (te ves en el aire, con sombras de estela) y caída con
   * onda de choque y polvo. Durante el vuelo no golpeas; al caer, devolución asegurada como el DASH (dashHit).
   */
  private startJump(): boolean {
    const pl = this.player;
    const plan = this.dashPlan(JUMP.airMin + 0.06);
    if (!plan) {
      const h = this.headPos(pl);
      this.popText(h.x, h.y, '¡Muy tarde!', '#cfe0ff', 24);
      return false;
    }
    const tx = clamp(plan.x - 18, P_X[0], P_X[1]);
    const ty = clamp(plan.y, Y_MIN, Y_MAX);
    const dur = clamp(plan.t - 0.06, JUMP.airMin, JUMP.airMax);
    this.stopCharge();
    stopMotion(this.motion);
    const from = { x: pl.x, y: pl.y };
    pl.vanished = true; // en el aire: sin moverse ni golpe normal
    pl.ch.setMoving(false, 0);
    this.dashHit = { t: plan.t, elapsed: 0, x: tx, y: ty };
    // despegue: polvo e impulso
    this.dustFx(pl.x, pl.y);
    const h0 = this.headPos(pl);
    this.popText(h0.x, h0.y - 10, 'DEFENSIVO', '#c9a4ff', 26);
    navigator.vibrate?.(25);
    // el rival ve el mismo salto en parábola y la caída (netRemoteDefensive)
    this.net?.sendAction('defensive', { kind: 'jump', x: from.x, y: from.y, tx, ty, ms: dur * 1000 });
    const st = { k: 0, ghosts: 0 };
    this.tweens.add({
      targets: st,
      k: 1,
      duration: dur * 1000,
      ease: 'Linear',
      onUpdate: () => {
        if (!pl.vanished) return; // el punto terminó o se canceló
        pl.x = from.x + (tx - from.x) * st.k;
        pl.y = from.y + (ty - from.y) * st.k;
        pl.lift = 4 * JUMP.height * st.k * (1 - st.k);
        if (st.ghosts < 3 && st.k >= (st.ghosts + 1) / 4) {
          this.renderActors();
          this.dashFx.ghost(pl.ch, st.ghosts++, pl.ch.depth);
        }
      },
      onComplete: () => {
        pl.lift = 0;
        if (!pl.vanished) return;
        pl.x = tx;
        pl.y = ty;
        pl.vanished = false;
        this.jumpLandFx(tx, ty);
      },
    });
    return true;
  }

  /** Aterrizaje del SUPERSALTO: onda de choque doble en el suelo, polvo, temblor corto y vibración. */
  private jumpLandFx(x: number, y: number, mine = true) {
    const p = project(x, y);
    const k = p.s * VIEW.CHAR_K;
    for (const [d, col] of [[0, 0xffffff], [80, 0xff9a3d]] as const) {
      const ring = this.add.ellipse(p.sx, p.sy, 90 * k, 30 * k).setStrokeStyle(6 * k, col, 0.95).setDepth(p.sy - 0.5).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
      this.tweens.add({ targets: ring, scale: 3.2, alpha: { from: 0.95, to: 0 }, delay: d, duration: 420, ease: 'Cubic.easeOut', onStart: () => ring.setAlpha(0.95), onComplete: () => ring.destroy() });
    }
    this.dustFx(x, y);
    this.cameras.main.shake(130, mine ? 0.007 : 0.004);
    if (mine) navigator.vibrate?.([30, 20, 50]);
  }

  /**
   * DESTELLO: el jugador desaparece dejando una estela de movimiento rápido (haces de luz y sombras por el camino),
   * reaparece donde la pelota va a pasar, con ella a su izquierda, y devuelve con un REVÉS (sprite de revés). La
   * devolución está asegurada igual que con el DASH (updateDashHit).
   */
  private startBlink(): boolean {
    const pl = this.player;
    const normal = this.dashPlan(BLINK.out + BLINK.in + BLINK.swingLead + 0.02);
    const plan = normal ?? this.dashPlan(BLINK.fastOut + BLINK.fastIn + 0.1);
    if (!plan) {
      const h = this.headPos(pl);
      this.popText(h.x, h.y, '¡Muy tarde!', '#cfe0ff', 24);
      return false;
    }
    const fast = !normal;
    const tx = clamp(plan.x - 18, P_X[0], P_X[1]);
    const ty = clamp(plan.y + BLINK.side, Y_MIN, Y_MAX);
    const from = { x: pl.x, y: pl.y };
    this.stopCharge();
    pl.vanished = true;
    this.dashHit = { t: plan.t, elapsed: 0, x: tx, y: ty, blink: true };

    // estela: haces de luz de donde estaba a donde aparece + sombras del personaje por el camino
    const a = project(from.x, from.y);
    const b = project(tx, ty);
    const k = a.s * VIEW.CHAR_K;
    this.dashFx.burst(a.sx, a.sy, k, pl.ch.depth);
    if (Math.hypot(tx - from.x, ty - from.y) > 40) {
      for (let i = 0; i < 3; i++) {
        const f = (i + 1) / 4;
        pl.x = from.x + (tx - from.x) * f;
        pl.y = from.y + (ty - from.y) * f;
        this.renderActors(); // la sombra copia la pose en esa posición
        this.dashFx.ghost(pl.ch, i, pl.ch.depth);
      }
      pl.x = from.x;
      pl.y = from.y;
      this.renderActors();
    }
    this.dashFx.streak(a.sx, a.sy - 70 * k, b.sx, b.sy - 70 * k, k, pl.ch.depth);
    this.portalFx(from.x, from.y, 0x45d9ff, 0xd9f7ff);
    const h = this.headPos(pl);
    this.popText(h.x, h.y - 10, 'DEFENSIVO', '#c9a4ff', 26);
    // en red el rival ve la misma estela, portales y reaparición (netRemoteWarp)
    this.net?.sendAction('defensive', { kind: 'blink', x: from.x, y: from.y, tx, ty, out: (fast ? BLINK.fastOut : BLINK.out) * 1000, in: (fast ? BLINK.fastIn : BLINK.in) * 1000, delay: 0 });

    this.tweens.add({
      targets: pl,
      warp: 0,
      duration: (fast ? BLINK.fastOut : BLINK.out) * 1000,
      ease: 'Quad.easeIn',
      onComplete: () => {
        pl.x = tx;
        pl.y = ty;
        this.portalFx(tx, ty, 0x45d9ff, 0xd9f7ff);
        this.tweens.add({
          targets: pl,
          warp: 1,
          duration: (fast ? BLINK.fastIn : BLINK.in) * 1000,
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
      const reachable = s.x >= P_X[0] - DASH_BACK_REACH && s.x <= P_X[1] + 30 && s.y >= Y_MIN - 30 && s.y <= Y_MAX + 30 && s.z < HIT_MAX_Z * 0.85;
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
        this.forcedHit();
      }
      return;
    }
    if (this.phase !== 'rally' || this.lastHitter === 'player') {
      this.dashHit = null;
      return;
    }
    d.elapsed += dt;
    const s = this.ball.s;
    // DESTELLO: el revés arranca un poco antes del contacto (cuando ya reapareció) para que el impacto del sprite
    // coincida con la llegada de la pelota
    if (d.blink && !d.swung && !this.player.vanished && d.elapsed >= d.t - BLINK.swingLead && s.x < NET_X && s.vx < 0) {
      d.swung = true;
      this.player.ch.facing = -1; // revés
      this.player.ch.swing(false, false, false, false);
    }
    if (d.elapsed >= d.t + 0.02 && s.x < NET_X && s.vx < 0 && this.bounces < 2) {
      this.dashHit = null;
      this.player.vanished = false;
      this.player.warp = 1;
      if (d.blink) this.player.ch.facing = -1;
      this.forcedHit();
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
    const box = { xMin: P_X[0] - DASH_BACK_REACH, xMax: P_X[1] + 30, yMin: Y_MIN - 30, yMax: Y_MAX + 30 };
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
    this.net?.sendAction('sprint-start', { dirX: this.dashRun.dirX });
    const p = project(pl.x, pl.y);
    this.dashFx.burst(p.sx, p.sy, p.s * VIEW.CHAR_K, pl.ch.depth);
    const h = this.headPos(pl);
    this.popText(h.x, h.y - 10, 'DEFENSIVO', '#c9a4ff', 26);
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
      this.net?.sendAction('sprint-end');
      return;
    }
    const st = stepRun(r, dt);
    pl.x = st.pos.x;
    pl.y = st.pos.y;
    if (st.ghosts.length) {
      this.renderActors(); // la sombra copia la pose en la posición real de este instante
      for (const i of st.ghosts) this.dashFx.ghost(pl.ch, i, pl.ch.depth);
    }
    if (st.entered === 'land') {
      pl.ch.setSprint(false, r.dirX, true);
      this.net?.sendAction('sprint-end');
    }
    if (st.phase === 'done') {
      this.dashRun = null;
      pl.ch.setSprint(false, r.dirX, false); // por si no hubo frenada (recorrido nulo)
      this.net?.sendAction('sprint-end'); // repetido no afecta (el rival ya no está en sprint)
      stopMotion(this.motion); // libre, con la inercia normal desde 0
    }
  }

  private portalFx(x: number, y: number, col = 0x9b5cff, light = 0xe6d2ff) {
    const p = project(x, y);
    const k = p.s * VIEW.CHAR_K;
    const ring = this.add.ellipse(p.sx, p.sy, 120 * k, 40 * k, col, 0.55).setStrokeStyle(5, light).setDepth(p.sy - 1);
    this.tweens.add({ targets: ring, scaleX: 1.8, scaleY: 1.8, alpha: 0, duration: 380, onComplete: () => ring.destroy() });
    for (let i = 0; i < 12; i++) {
      const s = this.add
        .circle(p.sx + rand(-40, 40) * k, p.sy - rand(0, 140) * k, rand(3, 7) * k, Phaser.Utils.Array.GetRandom([col, light, 0xffffff]))
        .setDepth(p.sy + 5)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: s, y: s.y - rand(30, 80) * k, alpha: 0, duration: rand(250, 450), onComplete: () => s.destroy() });
    }
  }

  /**
   * Confirmación del ESPECIAL armado: suelta UNA onda de luz alrededor del cuerpo.
   */
  private powerPulse(a: Actor) {
    // SIN preFX: Phaser no lo soporta en objetos dentro de un Container (el personaje lo es). En el APK el personaje
    // desaparecía y quedaban cuadros rotos al armar el ESPECIAL. Solo la onda de luz.
    // una sola pulsación de luz alrededor del cuerpo
    const feet = project(a.x, a.y);
    const head = this.headPos(a);
    const cy = (feet.sy + head.y) / 2;
    const k = feet.s * VIEW.CHAR_K;
    const ring = this.add.ellipse(feet.sx, cy, 120 * k, 170 * k, 0xffffff, 0.45).setDepth(a.ch.depth + 0.5).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: ring, scale: { from: 0.7, to: 1.6 }, alpha: { from: 0.7, to: 0 }, duration: 600, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
  }

  /** SMASH: la pelota se prende fuego; el siguiente golpe es una bola de fuego. */
  private activateSmash(): boolean {
    if (this.paused || this.cine.active ||this.phase === 'over' || this.phase === 'intro' || this.smashArmed || !this.unlocked('special')) return false;
    if (this.player.racket) return this.noRacketHint();
    if (this.serveLock) return this.serveLockHint();
    this.smashArmed = true;
    // sonido de CARGANDO, el mismo del golpe cargado (se apaga al golpear)
    this.smashSnd?.destroy();
    this.smashSnd = null;
    if (this.cache.audio.exists('cargando')) {
      this.smashSnd = this.sound.add('cargando', { volume: 0.7 });
      this.smashSnd.play();
    }
    // armado dentro de la ventana del globo: candidato a SMASH potenciado (antes de abrirse = demasiado pronto)
    this.superArmed = this.lob.windowOpenFor('player', this.player.x, this.player.y);
    this.smashBtn.setArmed(true);
    if (!this.ball.power) this.ball.setElement(this.smashEl); // con una bola de fuego rival en vuelo no se le cambia el aspecto
    this.ball.setIgnited(true);
    // confirmación: el personaje se aclara y late UNA vez (~1 s); el aura de llamas queda para la ZONA (zoneRender)
    this.powerPulse(this.player);
    this.net?.sendAction('smash-armed', { element: this.smashEl }); // el rival ve el mismo pulso (y el color de tu poder)
    // llamarada en la pelota
    const air = project(this.ball.s.x, this.ball.s.y, this.ball.s.z);
    const burst = this.add.circle(air.sx, air.sy, 16, SMASH_LOOK[this.smashEl].burst, 0.8).setDepth(4000).setBlendMode(Phaser.BlendModes.ADD);
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
    if (!this.unlocked('ulti')) return; // ULTI bloqueada por nivel: no se carga
    const nowReady = this.inferno.onPointWon();
    this.smashBtn.setMeter(this.inferno.charge, INFERNO.pointsToCharge);
    if (nowReady) {
      this.smashBtn.setInferno(true);
      this.smashBtn.pulseMeter();
    }
  }

  /** Botón en modo INFERNO: arma la técnica (no consume la carga). */
  private armInferno(): boolean {
    if (this.paused || this.cine.busy || this.phase !== 'rally' || this.smashArmed || this.player.vanished || !this.unlocked('ulti')) return false;
    if (this.player.racket) return this.noRacketHint();
    if (this.serveLock) return this.serveLockHint();
    if (!this.inferno.arm()) return false;
    this.smashBtn.setArmed(true);
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
    this.inferno.begin();
    this.stopCharge();
    // cargando: pose de espera con la raqueta atrás (la de "guardia" de siempre), congelada; el golpe
    // de máxima potencia arranca desde ahí al llegar a la pelota
    // NXO con la hoja del INFERNO: su pose de espera propia (frame 8); si no hay hoja, la guardia de siempre
    if (!pl.ch.infernoHold()) pl.ch.setCharging(true);
    const sprites = spritesIn(pl.ch);
    const from = { x: pl.x, y: pl.y };
    const D = INFERNO.dash;
    const dashSt = { sound: false };
    infernoSound.charge(this);
    // aspecto del poder elegido (fuego, hielo…): franja de la mirada, energía de la carga, sombras y golpe
    const el = getProfile().inferno;
    // franja con la mirada del personaje (NXO, MAI) apenas empieza el INFERNO (toda la cinemática, ~2 s)
    showInfernoGaze(this, INFERNO_CINE.hitAtMs - GAZE_END_BEFORE_HIT_MS, this.gazeY(), getProfile().skin, el);
    this.ghosts.setLook(INFERNO_LOOK[el].ghostTint, INFERNO_LOOK[el].ghostRamp);
    this.cine.start({
      profile: infernoCine(el),
      freeze: [...sprites, ...spritesIn(this.bot.ch)],
      executor: sprites,
      leadMs: 0, // la pose de espera no avanza: el golpe empieza al llegar
      focus: () => this.cineFocus(pl),
      onCancel: () => {
        pl.ch.infernoRelease();
        pl.ch.setCharging(false);
        this.ghosts.clear();
        this.inferno.abort();
      },
      onFrame: (e) => {
        if (e >= INFERNO_CINE.hitAtMs - INFERNO_PRE_MS) pl.ch.infernoPre();
        if (e < D.fromMs) return;
        this.inferno.phase = 'GHOST_DASH';
        this.infernoDashStep(e, pl, from, c, sprites, dashSt);
      },
      onHit: () => this.infernoImpact(c),
    });
    // en red: el rival ve la misma cinemática (desde dónde sale, a dónde llega y cuánto dura la parte congelada)
    // `power`: poder del INFERNO elegido, para que el rival vea la misma bola (el servidor reenvía `data` tal cual)
    this.net?.sendAction('inferno-cine', { x: from.x, y: from.y, tx: c.x, ty: c.y, ms: INFERNO_CINE.hitAtMs, power: getProfile().inferno });
  }

  /**
   * Desplazamiento fantasma del INFERNO DRIVE (compartido por la cinemática propia y por la del rival en red):
   * muy rápido pero visible, a velocidad constante (sombras repartidas por el camino) y sin teletransporte;
   * llega un poco antes del impacto. `st.sound`: el sonido y el inicio de las sombras salen una sola vez.
   */
  private infernoDashStep(e: number, a: Actor, from: { x: number; y: number }, to: { x: number; y: number }, sprites: Phaser.GameObjects.Sprite[], st: { sound: boolean }) {
    const D = INFERNO.dash;
    if (!st.sound) {
      st.sound = true;
      infernoSound.dash(this);
      this.ghosts.begin(D.toMs - D.fromMs - 120);
    }
    const u = Math.min(1, (e - D.fromMs) / (D.toMs - D.fromMs - 120));
    a.x = from.x + (to.x - from.x) * u;
    a.y = from.y + (to.y - from.y) * u;
    this.renderActors();
    // 4 sombras en posiciones anteriores reales (solo mientras se desplaza; luego se quedan y se desvanecen)
    if (u < 1) this.ghosts.record(sprites[0], a.ch.depth);
    else this.ghosts.end();
  }

  /**
   * Look del rival (el personaje que se ve al frente): en red el de SU personaje (opponent.skin; respaldo: rivalLook),
   * contra el BOT el otro personaje del catálogo. Sprite y mirada del INFERNO salen de aquí para que coincidan siempre.
   */
  private rivalLk() {
    return this.net ? lookForSkin(this.net.opponent.skin, 'front', getProfile().skin) : rivalLook(getProfile().skin);
  }

  /** id del personaje rival (nxo, mai…) según rivalLk */
  private rivalSkin(): string {
    const id = this.rivalLk().id;
    return id && id !== 'rival' ? id : 'nxo';
  }

  /** y de pantalla (cámara de interfaz) donde queda la franja de la mirada del INFERNO: a la altura de la red */
  private gazeY(): number {
    const cam = this.cameras.main;
    const mid = this.scale.height / 2;
    const wy = project(NET_X, LAT_C, NET_HEIGHT / 2).sy;
    return (wy - cam.scrollY - mid) * cam.zoom + mid;
  }
  /** Punto de concentración de una cinemática (SMASH / INFERNO) sobre el actor que la ejecuta. */
  private cineFocus(a: Actor): CineFocus {
    const s = this.ball.s;
    const p = project(a.x, a.y);
    const h = this.headPos(a);
    // la raqueta va al encuentro de la pelota: punto entre la cabeza y la pelota
    const b = project(s.x, s.y, s.z);
    return { x: p.sx, y: (h.y + p.sy) / 2, hh: (p.sy - h.y) / 2, racketX: h.x + (b.sx - h.x) * 0.5, racketY: h.y + (b.sy - h.y) * 0.5, s: p.s, depth: a.ch.depth };
  }

  /** Impacto de INFERNO DRIVE: golpe único, consumo de la carga y efectos. */
  private infernoImpact(c: { x: number; y: number }) {
    const pl = this.player;
    pl.x = c.x;
    pl.y = c.y;
    pl.ch.setCharging(false); // suelta la pose de espera: el golpe sigue desde la raqueta atrás
    this.ghosts.end();
    if (this.phase !== 'rally' || this.lastHitter === 'player') {
      pl.ch.infernoRelease();
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
    // la bola es la del poder elegido en PERSONALIZACIÓN (sin elegir: la del personaje, Mai = hielo)
    this.infernoEl = getProfile().inferno;
    this.fire.setElement(this.infernoEl);
    infernoImpactFx(this, b.sx, b.sy, b.s, this.infernoEl);
    infernoShake(this);
    infernoSound.impact(this);
    this.ball.quietFx = true; // la pelota es ahora la esfera de fuego (sin estela propia)
    this.infernoBounced = false; // su primer bote tendrá explosión de fuego
  }

  /** SMASH / INFERNO: ¿remate por arriba (con salto)? SOLO si la pelota llega en globo; si no, golpe fuerte. */
  private powerOverhead(s: BallState) {
    return this.ball.shotKind === 'lob' || this.lob.qualifies('player', this.player.x, this.player.y, s);
  }

  /** La pelota que va a volar es un SMASH de este poder: su aspecto (pelota, humo) y el de su impacto (fuego / hielo). */
  private setSmashFlight(el: SmashPower) {
    this.smashFlightEl = el;
    this.ball.setElement(el);
    this.smoke.setElement(el);
  }

  /**
   * Golpe FORZADO del DEFENSIVO (DASH, DESTELLO, SOMBRA, SUPERSALTO: devolución asegurada). Con el ESPECIAL armado sale
   * con su cinemática de 1 s, igual que un golpe normal (antes se lo saltaba: pendiente de NOTAS-CLAUDE). La cinemática no
   * exige alcance y su onHit llama a playerHit una sola vez. Contra un tiro de poder rival, playerHit aplica el aturdido.
   */
  private forcedHit() {
    const rivalPower = this.ball.power && this.lastHitter === 'bot';
    if (!rivalPower && this.smashArmed && !this.serveLock && this.startSmashCine()) return;
    this.playerHit(true);
  }

  private startSmashCine(): boolean {
    if (!smashCineEnabled() || this.cine.active || this.phase !== 'rally') return false;
    const pl = this.player;
    // misma llamada que hará playerHit con el SMASH: arranca el clip en su preparación y se congela ahí;
    // al reanudar, la segunda llamada no reinicia el clip (ya está golpeando) → sin saltos visuales
    this.stopCharge(); // antes de la pose (al soltar la carga el personaje no debe cambiar de animación)
    const overhead = this.powerOverhead(this.ball.s);
    const lead = pl.ch.swing(true, overhead, overhead);
    this.cine.start({
      profile: smashCine(this.smashEl), // fuego = el de siempre; hielo / viento / rayo = mismos tiempos con su aura, rayos y destello
      freeze: [...spritesIn(pl.ch), ...spritesIn(this.bot.ch)],
      executor: spritesIn(pl.ch),
      leadMs: Math.min(lead, 150),
      focus: () => this.cineFocus(pl),
      onHit: () => {
        // golpe pendiente: se consume una vez (playerHit desarma el SMASH)
        if (this.phase === 'rally' && this.smashArmed && this.lastHitter !== 'player') this.playerHit();
      },
    });
    // en red: el rival ve la misma cinemática (posición del que remata, si salta y cuánto dura la parte congelada)
    this.net?.sendAction('smash-cine', { x: pl.x, y: pl.y, overhead, ms: SMASH_CINE.hitAtMs, element: this.smashEl });
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
    this.ball.quietFx = false;
    this.fire.clear(); // la bola de fuego desaparece en el impacto: sigue la pelota normal
    // explosión: SMASH centrada en el rival (media altura); INFERNO en el punto de contacto de la bola de fuego
    const feet = project(b.x, b.y);
    const head = this.headPos(b);
    const at = kind === 'inferno' ? project(s.x, s.y, s.z) : { sx: feet.sx, sy: (feet.sy + head.y) / 2 };
    powerImpactFx(this, kind, at.sx, at.sy, feet.s, kind === 'inferno' ? this.infernoEl : this.smashFlightEl);
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
    const stunMs = stunMsFor(kind); // SMASH 0,65 s · ULTI 1,5 s
    b.stun = stunSeconds(kind);
    const kb = POWER_IMPACT.knockback;
    this.tweens.killTweensOf(b);
    this.tweens.add({ targets: b, x: knockbackX(b.x, B_X[1], KNOCKBACK_DIST), duration: kb.ms, ease: 'Cubic.easeOut' });
    // con hoja (NXO de espaldas): aturdido / impacto del INFERNO dibujados; si no, el giro de siempre
    if (!b.ch.impactStun(kind === 'inferno' ? 'inferno' : 'smash', stunMs, kind !== 'inferno')) {
      this.tweens.add({ targets: b.ch.rig, angle: { from: -POWER_IMPACT.recoilDeg * b.ch.facing, to: 0 }, duration: stunMs, ease: 'Elastic.easeOut' });
    }
    const h = this.headPos(b);
    this.popText(h.x, h.y - 10, '¡ATURDIDO!', '#ffd23f', 30);
    if (kind === 'inferno') {
      this.ultiStunOn(b, stunMs);
      this.loseRacket(b); // la ULTI le hace volar la raqueta
    }
  }

  /** ULTI de RAYO / VIENTO: el aturdido lleva encima su efecto (electrocutado / remolino) mientras dura. */
  private ultiStunOn(a: Actor, ms: number) {
    ultiStunFx(this, this.infernoEl, () => {
      if (a.vanished) return null;
      const f = project(a.x, a.y);
      return { x: f.sx, y: f.sy, headY: this.headPos(a).y };
    }, ms);
  }

  /**
   * IMPACTO DIRECTO al jugador: alcanzas la bola de fuego del SMASH rival. Igual que fireImpact pero al
   * revés: devolución floja (globo al centro de su campo), retroceso y aturdido. Sin puntuación especial.
   */
  private playerImpact() {
    const s = this.ball.s;
    const pl = this.player;
    // ULTI del rival (esfera de fuego): su impacto propio, en el punto de contacto; si no, el del SMASH de siempre
    const kind: PowerKind = this.infernoFlight ? 'inferno' : 'smash';
    const stunMs = stunMsFor(kind); // SMASH 0,65 s · ULTI 1,5 s
    // el rival ve el aturdido (misma duración) y la devolución floja llega sin animación de golpe
    if (this.net) {
      this.net.sendAction('stunned', { ms: stunMs });
      this.netHit = { charged: false, overhead: false, volley: false, impact: true };
    }
    this.stopCharge();
    this.timing.clear();
    this.infernoBounced = true; // el impacto directo ya es su efecto: no habrá explosión de suelo
    const feet = project(pl.x, pl.y);
    const head = this.headPos(pl);
    const at = kind === 'inferno' ? project(s.x, s.y, s.z) : { sx: feet.sx, sy: (feet.sy + head.y) / 2 };
    powerImpactFx(this, kind, at.sx, at.sy, feet.s, kind === 'inferno' ? this.infernoEl : this.smashFlightEl);
    // devolución débil (globo al centro del campo rival)
    const tx = NET_X + (COURT.right - NET_X) * rand(0.3, 0.6);
    const ty = LAT_C + rand(-0.5, 0.5) * HALF_W;
    s.z = Math.max(s.z, 22);
    aimShot(s, tx, ty, SHOT_SPEED * 0.55, 70);
    this.ball.setPower(false);
    this.ball.setKind('lob');
    this.lastHitter = 'player';
    this.bounces = 0;
    this.ai.onPlayerHit(false);

    // retroceso hacia su fondo + aturdido (bloquea el movimiento con pl.stun)
    pl.stun = stunSeconds(kind);
    this.playerDizzy = false;
    stopMotion(this.motion);
    const kb = POWER_IMPACT.knockback;
    this.tweens.killTweensOf(pl);
    this.tweens.add({ targets: pl, x: clamp(pl.x - KNOCKBACK_DIST, P_X[0], P_X[1]), duration: kb.ms, ease: 'Cubic.easeOut' });
    if (!pl.ch.impactStun(kind, stunMs, kind !== 'inferno')) {
      // sin hoja: giro de siempre y las estrellas del juego (con hoja, el aturdido ya trae sus estrellas y humo dibujados)
      this.playerDizzy = true;
      pl.ch.swing();
      this.tweens.add({ targets: pl.ch.rig, angle: { from: -POWER_IMPACT.recoilDeg * pl.ch.facing, to: 0 }, duration: stunMs, ease: 'Elastic.easeOut' });
    }
    navigator.vibrate?.(kind === 'inferno' ? [60, 40, 140] : [40, 30, 80]);
    if (kind === 'inferno') {
      this.ultiStunOn(pl, stunMs);
      this.loseRacket(pl); // la ULTI te hace volar la raqueta: hay que ir a buscarla
    }
    this.popText(head.x, head.y - 10, '¡ATURDIDO!', '#ff9aa3', 30);
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
    this.endRemate();
    this.remateWhiffed = false;
    this.remateRecover = 0;
    this.endBotRemate();
    this.botRemateRoll = null;
    this.netRemoteRemate(false);
    this.server = this.score.server === 0 ? 'player' : 'bot';
    const side = (this.score.points[0] + this.score.points[1]) % 2 === 0 ? 1 : -1;
    this.endShadowRun(); // un clon de SOMBRA a medio camino no pasa al punto siguiente
    for (const a of [this.player, this.bot]) {
      this.clearRacket(a); // la raqueta perdida vuelve a la mano en el punto siguiente
      a.ch.releaseRemate(); // pose de remate sin golpe (punto terminado a mitad): vuelve a animarse
      this.diagCause = 'saque'; // (log) el salto a la posición de saque es normal
      a.stun = 0;
      a.warp = 1;
      a.vanished = false;
      a.lift = 0;
      this.tweens.killTweensOf(a);
    }
    this.netEndBotFly(false); // SOMBRA / SUPERSALTO del rival cortados por el fin del punto
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
    // en red, un saque / lanzamiento del rival puede adelantar el punto: la llamada retrasada ya no hace nada
    if (this.net && this.phase !== 'pointover' && this.phase !== 'intro') return;
    this.netNextSecond = false;
    this.stopCharge();
    if (!secondServe) this.faults = 0;
    // el rival sortea su modo (NORMAL / CONCENTRADO / COMPETITIVO) al empezar cada punto
    if (!secondServe) this.brain.onPointStart(this.score.points, this.score.games);
    this.bot.ch.setSprint(false); // DASH del rival cortado por el fin del punto
    this.serving = false;
    this.lungeAt = 0;
    this.lastHitter = null;
    this.bounces = 0;
    this.ball.setPower(false);
    this.ball.setElement(this.smashEl); // si el SMASH sigue armado, la pelota prendida es la de tu poder
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
    this.board?.setInfo(null);
    this.computeServeBox();
    this.showServeHint();
    // zona de colocación: la mitad de la línea de fondo del lado desde el que se saca
    const srvA = this.srvActor();
    this.serveZone = srvA.y > LAT_C ? [LAT_C + 10, COURT.bottom] : [COURT.top, LAT_C - 10];
    if (this.server === 'player') this.joy.release();
    else if (!this.net) {
      // el rival decide ya su saque (tipo, destino y momento) y se coloca antes de lanzar
      this.botPlan = this.serveAI.plan(this.faults, this.ai.d);
      this.brain.serveWait = this.botPlan.wait;
      this.botServeY = clamp(LAT_C + Math.sign(srvA.y - LAT_C) * rand(40, 150), this.serveZone[0], this.serveZone[1]);
    }
    this.setServeUi(this.server === 'player');
    this.secondTag.setVisible(this.faults > 0);
    // menos textos: el turno lo indica la etiqueta SERVICIO sobre quien saca y el marcador ya mostró Iguales/Ventaja
    if (secondServe) showCallout(this, '2º servicio', 0xffc42e, 700);
    // en red: lanzamiento del rival que llegó antes
    if (this.net && this.netPendingToss && this.server === 'bot') {
      const k = this.netPendingToss as ServeKind;
      this.netPendingToss = null;
      this.beginToss(k);
    }
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
    // EFECTO PELOTA (saque con efecto) bloqueado por nivel: su botón no sale
    this.serveSpinBtn.show(on && this.unlocked('spin'));
    this.dashBtn.setVisible(!on);
    this.smashBtn.setVisible(!on);
    this.dashBtn.enabled = !on && this.unlocked('defensive');
    this.smashBtn.enabled = !on && this.unlocked('special');
    this.paintLocks();
  }

  /** DEFENSIVO / ESPECIAL bloqueados por nivel: botón apagado con candado y "NIVEL n" debajo (domain/unlocks.ts). */
  private paintLocks() {
    for (const [btn, key] of [[this.dashBtn, 'defensive'], [this.smashBtn, 'special']] as const) {
      const locked = !this.unlocked(key);
      if (!locked) continue;
      btn.setEnabled(false);
      btn.setSubLabel(unlockLabel(key));
    }
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
    this.tossFromDy = this.ball.s.y - this.srvActor().y; // de dónde sale la pelota (la mano / posición de espera)
    this.ball.s.vz = SERVE.tossVz;
    this.srvActor().ch.serve(kind === 'normal' ? 'normal' : 'spin');
    if (this.server === 'player') this.net?.sendAction('toss', { kind });
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
    // en red el rival ve el golpe del saque a la vez (clip del golpe y salto), no al llegar la pelota
    if (srv === this.player) this.net?.sendAction('serve-swing');
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
    const rk = ch.serveRacket();
    const up = Math.max(0, Math.min(SERVE_JUMP.max, above - rk.z)); // el cordaje (no el borde del sprite) debe llegar a la pelota
    // lateral: la pelota sube recta, así que es el sacador quien se corre un poco para que el cordaje quede bajo ella
    const ballSx = project(s.x, s.y, zc).sx;
    const dx = Phaser.Math.Clamp((ballSx - ch.x) / k - rk.dx, -SERVE_JUMP.maxShift, SERVE_JUMP.maxShift);
    if (up <= 4 && Math.abs(dx) < 3) return;
    // avanza con el mismo reloj que el saque (update): la cima coincide con el contacto aunque bajen los FPS
    this.serveJumpState = { a, t: 0, up, rise: Math.max(0.08, t), dx };
  }

  /** Avanza el salto del saque (subida hasta el contacto, breve pausa arriba y caída). */
  private tickServeJump(dt: number) {
    const j = this.serveJumpState;
    if (!j) return;
    j.t += dt;
    const hang = SERVE_JUMP.hangMs / 1000;
    const fall = SERVE_JUMP.fallMs / 1000;
    let f = 0; // 0 = de pie, 1 = en el contacto (salto y ajuste lateral van juntos)
    if (j.t < j.rise) {
      const q = j.t / j.rise;
      f = 1 - (1 - q) * (1 - q);
    } else if (j.t < j.rise + hang) f = 1;
    else if (j.t < j.rise + hang + fall) {
      const q = (j.t - j.rise - hang) / fall;
      f = 1 - q * q;
    } else this.serveJumpState = undefined;
    j.a.ch.rig.y = -j.up * f;
    j.a.ch.rig.x = j.dx * f;
  }

  /**
   * Destino (en el cuadro de saque) para un punto de apuntado y un error de ejecución. `depthF` = profundidad elegida
   * (0 = red, 1 = línea de saque); por defecto la del tipo de saque.
   */
  private serveSpot(who: Who, kind: ServeKind, aimT: number, errLat = 0, errDepth = 0, depthF = kind === 'spin' ? SERVE.depth.spin : SERVE.depth.normal) {
    const b = this.serveBox;
    const inset = 14;
    const f = clamp(depthF + errDepth, 0.12, 1.4);
    const tx = who === 'player' ? b.x0 + (b.x1 - b.x0) * f : b.x1 - (b.x1 - b.x0) * f;
    const ty = b.y0 + inset + (b.y1 - b.y0 - inset * 2) * clamp(aimT + errLat, -0.6, 1.6);
    return { tx, ty };
  }

  /**
   * Zona del saque del jugador (1 de 6) según el joystick mientras la pelota está en el aire: columna -1 izquierda /
   * 0 centro / 1 derecha (|x| ≥ DIAG_X); fila 'short' (abajo, cerca de la red) con el joystick abajo, si no 'deep'
   * (arriba, junto a la línea de saque). Sin joystick: centro arriba.
   */
  private playerServeZone(): { col: -1 | 0 | 1; row: 'deep' | 'short' } {
    const d = this.shotDir();
    return { col: this.shotSide(d), row: d.y >= DIAG_X ? 'short' : 'deep' };
  }

  /** Apuntado del jugador: punto lateral (aimT) y profundidad de su zona. */
  private playerServeAim(_kind: ServeKind) {
    const z = this.playerServeZone();
    // centro de la columna (1/6, 1/2 o 5/6 del ancho) pasado al apuntado de serveSpot, que deja un margen de 14 a cada lado
    const b = this.serveBox;
    const h = b.y1 - b.y0;
    const inset = 14;
    return {
      aimT: ((h * (z.col + 1.5)) / 3 - inset) / (h - inset * 2),
      depthF: z.row === 'short' ? SERVE.zones.short : SERVE.zones.deep,
      zone: z,
    };
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
    if (this.net && who === 'player') this.netHit = { charged: false, overhead: false, volley: false, serveSpin: kind === 'spin' };
    this.hideServeHint();
    this.serveAim.setVisible(false);
    this.setServeUi(false); // se restauran DASH y SMASH...
    this.lockAbilities(); // ...pero bloqueados un momento para no pulsarlos por error
    this.serveClock = 0;
    this.serveClockText.setVisible(false);
    this.board?.setInfo(null);
    this.serveNetLoss = false;
    if (quality === 'miss') {
      // golpe en vacío: la pelota sigue cayendo y será falta al botar
      showCallout(this, 'Al aire', 0xffc42e);
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
    const pAim = who === 'player' ? this.playerServeAim(kind) : null;
    const aimT = pAim ? pAim.aimT : this.botPlan.aimT;
    // saque DIRECTO: botón verde + golpe en el punto máximo
    const direct = who === 'player' && kind === 'normal' && this.serveDirect && quality === 'perfect';
    this.serveDirect = false;
    // el DIRECTO es más rápido y plano; el destino es el centro de la zona elegida (sin ir más al fondo)
    const extraDepth = direct && !pAim ? SERVE.direct.depth - SERVE.depth.normal : 0;
    const { tx, ty } = this.serveSpot(who, kind, aimT, g() * eLat, g() * eDep + extraDepth, pAim?.depthF);
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
    this.ball.setKind(kind === 'spin' ? 'side' : 'normal', quality === 'perfect', who === 'player' ? this.trailLook : undefined);
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
      this.dashBtn.setEnabled(this.unlocked('defensive'));
      this.smashBtn.setEnabled(this.unlocked('special'));
    });
  }

  /** El jugador tiene SERVE.timeLimit segundos para sacar; los últimos 3 se muestran. Al agotarse: falta. */
  private tickServeClock(dt: number) {
    const st = this.serveCtl.state;
    const counting = this.serveClock > 0 && this.server === 'player' && (this.phase === 'serve' || this.phase === 'toss') && st !== 'SWING' && st !== 'SERVE_RESULT';
    if (!counting) {
      this.serveClockText.setVisible(false);
    this.board?.setInfo(null);
      return;
    }
    this.serveClock -= dt;
    if (this.serveClock <= 0) {
      this.serveClock = 0;
      this.serveClockText.setVisible(false);
    this.board?.setInfo(null);
      showCallout(this, 'Tiempo', 0xff5a6a);
      this.tossFault();
      return;
    }
    if (this.serveClock <= 3) {
      const n = Math.ceil(this.serveClock);
      // cuenta atrás del saque en la píldora bajo el marcador (antes, un número flotando en pantalla)
      this.board.setInfo(`SACA EN ${n}`, n <= 1 ? '#ff7a85' : '#ffd23f');
    }
  }

  /** La pelota lanzada baja sin que se golpee: el servidor la atrapa y puede lanzarla de nuevo (sin falta). */
  private catchBall() {
    // en red, el lanzamiento del rival lo resuelve su teléfono (llega 'catch')
    if (this.net && this.server === 'bot' && !this.netApplying) return;
    if (this.net && this.server === 'player') this.net.sendAction('catch');
    this.serveCtl.reset();
    this.phase = 'serve';
    this.srvActor().ch.resetPose();
    this.serveAim.setVisible(false);
    if (this.server === 'player') this.setServeUi(true);
    else if (!this.net) {
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
    // NO se usa el setter: en red marcaría un golpe pendiente y se enviaría al rival un HIT FANTASMA (la pelota ni se
    // golpeó). El rival lo aplicaría como un saque real y juzgaría esa pelota, sumando puntos extra. La falta se avisa
    // sola (netGate → 'fault' / 'point') desde serviceFault.
    this._lastHitter = this.server;
    this.phase = 'rally';
    this.netForceAuthority = this.server === 'player';
    this.serviceFault();
    this.netForceAuthority = false;
  }

  /** Let: la pelota rozó la cinta de la red y cayó en el cuadro. Se repite el saque sin falta. */
  private serveLetCall() {
    if (this.netGate('let')) return;
    this.serveLet = false;
    this.netNextSecond = this.faults > 0;
    this.phase = 'pointover';
    showCallout(this, 'Let', 0xffc42e);
    this.time.delayedCall(1000, () => this.startPoint(this.faults > 0));
  }

  /**
   * Destino mientras se apunta (solo el jugador que saca): el cuadro de saque dividido en sus 6 zonas, la elegida
   * resaltada, y el punto de bote.
   */
  private renderServeAim() {
    const g = this.serveAim;
    const ctl = this.serveCtl;
    const on = this.server === 'player' && this.phase === 'toss' && (ctl.state === 'TOSS' || ctl.state === 'AIMING');
    g.clear();
    g.setVisible(on);
    if (!on || !ctl.kind) return;
    const aim = this.playerServeAim(ctl.kind);
    const b = this.serveBox;
    // el cuadro del jugador va de la red (x0) a la línea de saque (x1); columnas en y (izquierda = y0)
    const xm = (b.x0 + b.x1) / 2;
    const y3 = (b.y1 - b.y0) / 3;
    const cx0 = aim.zone.row === 'short' ? b.x0 : xm;
    const cy0 = b.y0 + y3 * (aim.zone.col + 1);
    g.fillStyle(0xffd23f, 0.35).fillPoints([this.P(cx0, cy0), this.P(cx0, cy0 + y3), this.P(cx0 + (xm - b.x0), cy0 + y3), this.P(cx0 + (xm - b.x0), cy0)], true);
    g.lineStyle(2, 0xffffff, 0.45);
    g.lineBetween(this.P(xm, b.y0).x, this.P(xm, b.y0).y, this.P(xm, b.y1).x, this.P(xm, b.y1).y);
    for (const yy of [b.y0 + y3, b.y0 + y3 * 2]) g.lineBetween(this.P(b.x0, yy).x, this.P(b.x0, yy).y, this.P(b.x1, yy).x, this.P(b.x1, yy).y);
    // (sin el aro del punto de bote: basta el cuadro resaltado)
  }

  /** ¿Pared del fondo activa? (WALL.enabled y sin localStorage 'dev.backWall' = '0') */
  private backWallOn() {
    if (!WALL.enabled) return false; // también en red: rebote y efectos; el resultado del punto lo decide la autoridad de la red
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
    const wasPower = this.ball.power;
    const wallEl: InfernoElement = this.infernoFlight ? this.infernoEl : this.smashFlightEl; // colores del poder de la bola (INFERNO o SMASH)
    // INFERNO DRIVE: al chocar con la pared se apaga la bola de fuego (vuelve la pelota normal)
    if (this.infernoFlight) {
      this.infernoFlight = false;
      this.infernoBounced = true;
      this.ball.setPower(false);
      this.ball.quietFx = false;
      this.fire.clear();
    }
    this.wallFx.impact(kind, p.sx, p.sy, p.s, ground.sy + 3, wasPower, wallEl);
    // en red solo se ve el rebote: los puntos llegan por los mensajes de la red (pointTo / bote), no por la pared
    if (this.net) return;
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
    // en red: la doble falta se avisa solo como PUNTO (lo envía pointTo); la primera, como falta
    if (this.faults + 1 < 2 && this.netGate('fault')) return;
    if (this.faults + 1 >= 2 && this.net && !this.netApplying && !(this.netForceAuthority || this.lastHitter === 'bot')) return;
    this.serving = false;
    this.faults++;
    const receiver: Who = this.lastHitter === 'player' ? 'bot' : 'player';
    if (this.faults >= 2) {
      this.pointTo(receiver, 'DOBLE FALTA', '#ff7a85');
      return;
    }
    this.phase = 'pointover';
    this.netNextSecond = true;
    showCallout(this, 'Falta', 0xffc42e);
    this.time.delayedCall(1100, () => this.startPoint(true));
  }
  private pointTo(w: Who, reason: string, color: string) {
    this.diag?.log('point', { w, reason, score: `${this.score.points.join('-')} / ${this.score.games.join('-')}`, phase: this.phase });
    if (this.phase !== 'rally') return;
    if (this.netGate('point', w, reason, color)) return;
    this.phase = 'pointover';
    this.stopCharge();
    // marcador antes del punto (el centro muestra el cambio: 30 → 40)
    const prevLabels = this.score.labels();
    const prevGames: [string, string] = [String(this.score.games[0]), String(this.score.games[1])];
    const res = this.score.pointTo(w === 'player' ? 0 : 1);
    // ZONA: el punto jugado consume un turno de Zona; quien va perdiendo por 2 con 2+ puntos ganados (o va 0-40) puede entrar
    const zr = this.zone.onPoint(w, res.gameWinner !== null);
    for (const sd of zr.ended) this.zoneFx[sd]?.stop();
    if (zr.entered) this.zoneStart(zr.entered);
    if (w === 'player') this.onInfernoPoint();
    else this.brain.onPointWon(); // la ULTI del rival se carga igual: 3 puntos ganados
    // el motivo (FUERA, RED, DOBLE FALTA…) va dentro del marcador central, no flotando junto al jugador
    const why = reason === '¡PUNTO!' || reason === 'Punto rival' ? null : reason.replace(/[¡!]/g, '');
    void color;
    this.updateHud();

    if (res.matchWinner !== null) {
      const win = res.matchWinner === 0;
      (win ? this.player : this.bot).ch.victory();
      (win ? this.bot : this.player).ch.defeat();
      // FIN DEL PARTIDO con espectáculo (fx/matchFinale.ts): marcador final, sello, confeti / ceniza y sonido; luego la
      // pantalla de resultados de siempre
      this.phase = 'over'; // ya terminó: el fin oficial del servidor (red) no vuelve a lanzar endMatch a mitad del final
      const ms = playMatchFinale(this, { win, playerName: getProfile().name, rivalName: this.botName, games: [this.score.games[0], this.score.games[1]] });
      this.time.delayedCall(ms + 150, () => this.endMatch(win));
      return;
    }
    // reacción al punto (hojas nuevas de NXO; no-op para el resto)
    this.player.ch.pointEnd(w === 'player');
    this.bot.ch.pointEnd(w === 'bot');
    // marcador en mitad de la pantalla (~2 s): puntos, o JUEGOS cuando se gana un juego; aviso de punto de partido
    const names = { playerName: getProfile().name, rivalName: this.botName, winner: w };
    const mp = isMatchPoint(this.score.points, this.score.games);
    if (res.gameWinner !== null) {
      const g2 = this.score.games;
      this.time.delayedCall(250, () =>
        showPointSplash(this, { ...names, labels: [String(g2[0]), String(g2[1])], prevLabels: prevGames, title: 'JUEGOS', status: null, matchPoint: false }),
      );
      if (mp) this.time.delayedCall(450, () => showSideNotice(this, 'Punto de partido', 0xff3b4e, 1800));
      this.time.delayedCall(250 + POINT_SPLASH_MS + 100, () => this.startPoint());
      return;
    }
    const status = [why, this.score.status()].filter(Boolean).join(' · ') || null;
    this.time.delayedCall(250, () => showPointSplash(this, { ...names, labels: this.score.labels(), prevLabels, status: null, matchPoint: false }));
    // qué pasó (DOBLE FALTA, FUERA, IGUALES…) y PUNTO DE PARTIDO: avisos que entran desde la izquierda
    if (status) this.time.delayedCall(450, () => showSideNotice(this, status, 0xffd23f, 1600));
    if (mp) this.time.delayedCall(650, () => showSideNotice(this, 'Punto de partido', 0xff3b4e, 1600));
    this.time.delayedCall(250 + POINT_SPLASH_MS + 100, () => this.startPoint());
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
        lan: !!this.net,
      },
    });
  }

  /** Aviso al pulsar una habilidad durante el saque o su resto. Devuelve false (no se usó). */
  /** Sin raqueta (ULTI recibida): ni habilidades ni golpes hasta recogerla. */
  private noRacketHint(): false {
    const h = this.headPos(this.player);
    this.popText(h.x, h.y, '¡Recoge tu raqueta!', '#ffd23f', 22);
    return false;
  }

  private serveLockHint(): false {
    const h = this.headPos(this.player);
    this.popText(h.x, h.y, 'Después del resto', '#cfe0ff', 22);
    return false;
  }

  /**
   * Botones DEFENSIVO / ESPECIAL apagados mientras dura el saque y su resto (serveLock) o si aún no se desbloquean por
   * nivel. Solo cambia algo cuando el estado cambia. Durante el saque propio los botones ni se ven (setServeUi).
   */
  private syncAbilityLock() {
    if (this.serveUiOn()) return;
    const lock = this.serveLock || !!this.player.racket; // sin raqueta tampoco hay habilidades
    const want = (btn: AbilityButton, key: UnlockKey) => {
      const on = !lock && this.unlocked(key);
      if (btn.enabled !== on) btn.setEnabled(on);
    };
    want(this.dashBtn, 'defensive');
    // en modo ULTI el botón del ESPECIAL usa el desbloqueo de la ULTI
    want(this.smashBtn, this.smashBtn.inferno ? 'ulti' : 'special');
  }

  /** ¿La habilidad está desbloqueada para tu nivel? (domain/unlocks.ts; en modo desarrollo el perfil es nivel 20) */
  private unlocked(key: UnlockKey) {
    return isUnlocked(key, getProfile().level);
  }

  // ---------------------------------------------------------------- tiro cargado
  private canCharge() {
    if (this.player.vanished || this.player.racket) return false;
    if (this.phase === 'rally') return true;
    // mientras saca el rival también se puede preparar el resto
    return (this.phase === 'serve' || this.phase === 'toss') && this.server === 'bot';
  }

  /** 1er toque: empieza a cargar (quieto). 2º toque: cancela y vuelve a moverse. */
  private toggleCharge(eventMs?: number) {
    // REMATE en curso: el toque es el golpe
    if (this.remateCine && !this.paused) {
      this.remateHit();
      return;
    }
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
    // CARGANDO GOLPE bloqueado por nivel (domain/unlocks.ts): el toque cuenta para el timing, pero no carga
    if (!this.unlocked('charge')) return;
    this.chargeFullAt = null;
    this.charging = true;
    this.charge = 0;
    this.chargeSnd?.destroy();
    this.chargeSnd = null;
    if (this.cache.audio.exists('cargando')) {
      this.chargeSnd = this.sound.add('cargando', { volume: 0.7 });
      this.chargeSnd.play();
    }
    this.chargeFull = false;
    this.ringGold = false;
    this.player.ch.setCharging(true);
    this.chargeRing.setVisible(!isSpriteCharge(this.chargeKind));
    this.chargeSprite.setCharge(0);
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

  /**
   * ANILLO GUÍA del Perfect Timing: con la pelota viniendo hacia ti y sin haber tocado aún, predice cuándo entrará en
   * tu alcance (quieto donde estás) y cierra un aro sobre la pelota que encaja en el instante ideal del toque
   * (contacto − TIMING.idealLeadMs). Al tocar (empezar a cargar) desaparece. Se apaga en AJUSTES > GUÍA DE TIMING.
   */
  private updateTimingRing() {
    const pl = this.player;
    const b = this.ball;
    const show =
      getSettings().timingGuide &&
      this.phase === 'rally' &&
      !this.serving &&
      !this.charging &&
      !this.cine.active &&
      !b.power &&
      this.lastHitter !== 'player' &&
      b.s.vx < 0 &&
      !pl.vanished &&
      pl.stun <= 0 &&
      b.sprite.visible &&
      this.timingOn();
    if (!show) return this.timingRing.hide();
    // contacto previsto (mismo recorrido que la física; el jugador quieto donde está)
    const s = { ...b.s };
    let bounces = this.bounces;
    const dt = 1 / 120;
    const lead = TIMING.idealLeadMs / 1000;
    let contactT = -1;
    if (this.inReach(pl, s)) contactT = 0;
    else
      for (let t = dt; t <= TIMING.ring.showS + lead + 0.05; t += dt) {
        const ev = stepBall(s, dt);
        if (ev === 'net' || (ev === 'bounce' && ++bounces >= 2)) break;
        if (this.inReach(pl, s)) {
          contactT = t;
          break;
        }
      }
    const left = contactT - lead;
    if (contactT < 0 || left > TIMING.ring.showS || left < -0.15) return this.timingRing.hide();
    const p = project(b.s.x, b.s.y, b.s.z);
    this.timingRing.show(b.sprite.x, b.sprite.y, p.s, left);
  }

  /** Baja el volumen en 120 ms y para el sonido (sin corte seco). */
  private fadeOutSnd(snd: Phaser.Sound.BaseSound | null) {
    if (!snd) return;
    this.tweens.add({ targets: snd, volume: 0, duration: 120, onComplete: () => { snd.stop(); snd.destroy(); } });
  }

  /** Termina la carga: oculta el indicador (con desvanecido suave) y apaga el brillo del personaje. */
  private stopCharge(soft = true) {
    if (!this.charging) return;
    this.charging = false;
    this.charge = 0;
    this.chargeFull = false;
    this.fadeOutSnd(this.chargeSnd);
    this.chargeSnd = null;
    this.player.ch.setCharging(false);
    this.chargeRing.setVisible(false);
    this.chargeSprite.setCharge(null); // se disipa con sus últimos frames
    this.chargeMeter.end(soft);
    this.chargeAura.hide();
    this.chargeSparks.hide();
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
    const dt = this.game.loop.delta / 1000;
    const p = project(this.player.x, this.player.y);
    const sprite = isSpriteCharge(this.chargeKind);
    // efecto con sprites: también se dibuja al soltar (se disipa con sus últimos frames)
    if (sprite) {
      if (this.charging) this.chargeSprite.setCharge(this.charge);
      this.chargeSprite.render(dt, p.sx, p.sy, p.s, p.sy);
    }
    if (!this.charging) return;
    const k = p.s * VIEW.CHAR_K;
    const pulse = 0.5 + 0.5 * Math.sin(this.time.now / (this.chargeFull ? 70 : 140));
    // aro en el suelo (clásico): azul y, al máximo, dorado
    if (!sprite) {
      if (this.chargeFull !== this.ringGold) {
        this.ringGold = this.chargeFull;
        this.chargeRing.setFillStyle(this.ringGold ? 0xffc72e : 0x6ec1ff, 0.25).setStrokeStyle(5, this.ringGold ? 0xfff2a8 : 0xd6f0ff, 0.9);
      }
      this.chargeRing
        .setPosition(p.sx, p.sy)
        .setScale(p.s * (0.55 + 0.55 * this.charge + pulse * 0.06))
        .setAlpha(0.45 + pulse * 0.4)
        .setDepth(p.sy - 0.8);
    }
    // indicador único sobre la cabeza: potencia + dirección real
    const h = this.headPos(this.player);
    this.chargeMeter.setValue(this.charge);
    // flecha del golpe; cortita / globo en diagonal = flecha inclinada hacia ese lado
    this.chargeMeter.setShot(this.shotFromJoystick(), this.shotSide());
    this.chargeMeter.place(h.x, h.y - 10, Phaser.Math.Clamp(p.s / 1.45, 0.8, 1));
    this.chargeMeter.tick(dt);
    // brillo alrededor del personaje y su raqueta (clásico)
    if (sprite) return;
    this.chargeAura.update(dt, p.sx, p.sy, k, this.player.ch.facing, this.charge, p.sy);
    if (this.chargeFull) this.chargeSparks.update(dt, p.sx, p.sy, k);
    else this.chargeSparks.hide();
  }
  // ---------------------------------------------------------------- golpes
  private handleBounce() {
    const s = this.ball.s;
    this.bounceFx(s.x, s.y);
    // ESPECIAL del rival que bota en tu lado: instante del bote para la devolución PERFECT (smashPerfectReturn)
    if (this.ball.power && !this.infernoFlight && this.lastHitter === 'bot' && s.x < NET_X) this.smashBounceAt = this.contactClock;
    // INFERNO DRIVE: explosión de fuego en el punto exacto de su PRIMER bote (una sola vez; solo visual)
    if (this.infernoFlight && !this.infernoBounced) {
      this.infernoBounced = true;
      const g = project(s.x, s.y, 0);
      infernoGroundFx(this, g.sx, g.sy, g.s, this.infernoEl);
      // en tu lado de la cancha: el golpe de la ULTI se siente también en el teléfono
      if (s.x < NET_X) navigator.vibrate?.([50, 30, 90]);
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
    // ZONA: más alcance (más ágil)
    const side: ZoneSide = a === this.player ? 'player' : 'bot';
    const zk = this.zone.active(side) ? ZONE.reachMult * this.zoneStatMultiplier(side, 'agility') : 1;
    return this.reachDist(a, s) < range * zk && s.z < maxZ * (zk > 1 ? 1.1 : 1);
  }

  private zoneStatMultiplier(side: ZoneSide, stat: keyof ZoneStatLevels) {
    return 1 + zoneStatPercent(this.zoneLevels[side][stat]);
  }

  /** Estirada en curso: momento (time.now, ms) del contacto; 0 = ninguna. Hasta entonces la pelota sigue su vuelo. */
  private lungeAt = 0;

  /**
   * Estirada: solo si está cargando y la pelota pasa por el alcance ampliado pero NO va a entrar en el alcance
   * normal (el jugador está quieto, así que se puede predecir). Busca el punto más cercano de la trayectoria y
   * arranca la estirada LUNGE_CONTACT_S antes, para que el frame de contacto del clip coincida con la pelota.
   * Devuelve ese contacto (tiempo y posición) o null.
   */
  private lungeContact(): { t: number; x: number; y: number; z: number } | null {
    const pl = this.player;
    const s0 = this.ball.s;
    if (!this.charging || pl.vanished || pl.stun > 0) return null;
    const s = { ...s0 };
    let bounces = this.bounces;
    const dt = 1 / 120;
    let best: { t: number; x: number; y: number; z: number; d: number } | null = null;
    if (this.inReach(pl, s0, LUNGE_RANGE, LUNGE_MAX_Z)) best = { t: 0, x: s0.x, y: s0.y, z: s0.z, d: this.reachDist(pl, s0) };
    for (let t = dt; t < 1.2; t += dt) {
      const ev = stepBall(s, dt);
      if (ev === 'net' || s.x >= NET_X) break;
      if (ev === 'bounce' && ++bounces >= 2) break;
      // llegará al alcance normal: golpe cargado de siempre, no hace falta estirarse
      if (this.inReach(pl, s)) return null;
      if (this.inReach(pl, s, LUNGE_RANGE, LUNGE_MAX_Z)) {
        const d = this.reachDist(pl, s);
        if (!best || d < best.d - 0.5) best = { t, x: s.x, y: s.y, z: s.z, d };
      }
    }
    // el punto más cercano aún está lejos en el tiempo: esperar
    if (!best || best.t > LUNGE_CONTACT_S + 1e-6) return null;
    return best;
  }

  /**
   * El jugador se lanza a por la pelota y devuelve SIEMPRE un globo, casi cayéndose. Se desplaza para que la
   * raqueta tendida llegue al punto de contacto justo en el frame del contacto; el golpe sale en ese momento
   * (lungeShot), no al empezar a tirarse.
   */
  private playerLunge(c: { t: number; x: number; y: number; z: number }) {
    const pl = this.player;
    this.stopCharge();
    this.timing.clear(); // la estirada no se evalúa con Perfect Timing
    const side = c.y > pl.y ? 1 : -1; // lado de la pantalla hacia el que se tira
    pl.ch.facing = side;
    // hojas nuevas de NXO: estirada + recuperación dibujadas; si no, golpe y cuerpo inclinado de siempre
    const dived = pl.ch.lunge(side);
    if (!dived) pl.ch.swing();
    if (this.net) this.netHit = { charged: false, overhead: false, volley: false, lunge: side }; // el rival repite la estirada

    // el cuerpo va a por la pelota en profundidad; de lado solo lo que no cubre el brazo tendido del clip
    const arm = dived ? LUNGE_ARM : HIT_RANGE / 1.25 * 0.6;
    const gapY = Math.abs(c.y - pl.y);
    const tx = clamp(c.x - pl.dir * 15, P_X[0], P_X[1]);
    const ty = clamp(c.y - side * Math.min(arm, gapY), Y_MIN, Y_MAX);
    const ms = Math.max(60, c.t * 1000);
    this.tweens.add({ targets: pl, x: tx, y: ty, duration: ms, ease: 'Quad.easeOut' });
    // en red el rival ve la estirada AL EMPEZAR (no 0,2 s tarde con el golpe): lado y punto de llegada
    this.net?.sendAction('lunge', { side, x: pl.x, y: pl.y, tx, ty, ms });
    // inclinación de "casi me caigo" y recuperación tambaleante
    const rig = pl.ch.rig;
    this.tweens.killTweensOf(rig);
    if (!dived) this.tweens.chain({
      targets: rig,
      tweens: [
        { angle: 38 * side, duration: 120, ease: 'Quad.easeOut' },
        { angle: 38 * side, duration: 220 },
        { angle: 0, duration: 520, ease: 'Elastic.easeOut', easeParams: [1.2, 0.45] },
      ],
    });
    pl.stun = LUNGE_RECOVER + c.t; // tirado hasta el contacto y luego la recuperación de siempre
    this.dustFx(pl.x, pl.y);
    this.time.delayedCall(ms, () => this.dustFx(tx, ty)); // cae al suelo en el contacto
    this.lungeAt = this.time.now + c.t * 1000;
    if (c.t < 1 / 60) this.lungeShot(); // ya está en el punto más cercano: golpe en este frame
  }

  /** Contacto de la estirada (en el frame del clip en que la raqueta llega a la pelota): devolución en globo. */
  private lungeShot() {
    this.lungeAt = 0;
    const s = this.ball.s;
    // devolución: globo alto y profundo
    const tgx = NET_X + (COURT.right - NET_X) * rand(0.6, 0.85);
    const tgy = LAT_C + rand(-0.45, 0.45) * (HALF_W - 30);
    s.z = Math.max(s.z, 18);
    aimShot(s, tgx, tgy, SHOT_SPEED * 0.72, 80);
    this.ball.setPower(false);
    // ESPECIAL armado: la estirada NO lo gasta (se pagó su recarga al armarlo) y sigue armado para tu próximo golpe, pero
    // este globo no es un tiro de poder: se apaga el fuego de la pelota y vuelve a encenderse cuando el rival la devuelve
    // (botHit / netApplyHit). Antes la pelota seguía encendida como si fuera un SMASH.
    if (this.smashArmed) this.ball.setIgnited(false);
    this.ball.setKind('lob');
    this.lastHitter = 'player';
    this.bounces = 0;
    this.ai.onPlayerHit(false);
    this.hitFx(s.x, s.y, s.z, false);
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
    // REMATE del BOT: el golpe lo da tickBotRemate
    if (this.botRemate) return;
    if (this.canBotStartRemate(s)) {
      this.startBotRemate();
      return;
    }
    if (this.lastHitter !== 'player' && s.x < NET_X && s.vx < 0) {
      // sin raqueta (ULTI recibida) no se devuelve nada: la pelota pasa
      if (this.player.racket) return;
      // REMATE del globo: el golpe lo da el toque o el aro (tickRemate); tras un golpe al aire, un instante sin golpear
      if (this.remateCine || this.remateRecover > 0) return;
      if (this.canStartRemate(s)) {
        this.startRemate();
        return;
      }
      // ULTI del rival: si la tocas te aturde SIEMPRE (aunque estés en ZONA o tengas tu ULTI armada)
      if (this.ball.power && this.lastHitter === 'bot' && this.infernoFlight) {
        if (this.inReach(this.player)) this.playerImpact();
        return;
      }
      // ESPECIAL (SMASH) del rival: si la alcanzas te revienta (aturdido + devolución floja), salvo que toques JUSTO
      // cuando bota en tu lado: devolución PERFECT (smashPerfectReturn). En ZONA la resistes (golpe normal).
      if (this.ball.power && this.lastHitter === 'bot' && !this.inferno.armed && !this.zone.active('player')) {
        if (this.inReach(this.player)) {
          if (this.smashPerfectReturn()) this.playerHit();
          else this.playerImpact();
        }
        return;
      }
      // INFERNO DRIVE armada: contacto viable con el desplazamiento especial → cinemática de 2 s
      // (durante el saque y su resto no salen: quedan armados para el siguiente golpe)
      // estirada en curso: el golpe sale en el frame del contacto
      if (this.lungeAt) {
        if (this.time.now >= this.lungeAt) this.lungeShot();
        return;
      }
      if (this.inferno.armed && !this.serveLock && this.tryInferno()) return;
      if (this.inReach(this.player)) {
        // SMASH de habilidad con contacto confirmado: 1 s de cinemática y luego el golpe (una vez)
        if (!(this.smashArmed && !this.serveLock && this.startSmashCine())) this.playerHit();
      }
      else {
        const c = this.lungeContact();
        if (c) this.playerLunge(c);
      }
    } else if (!this.net && this.lastHitter !== 'bot' && s.x > NET_X && s.vx > 0 && this.bot.stun <= 0 && !this.bot.racket && this.inReach(this.bot)) {
      // en ZONA el rival resiste el ESPECIAL, pero la ULTI aturde siempre
      if (this.ball.power && (this.infernoFlight || !this.zone.active('bot'))) this.fireImpact();
      else if (!this.botUlti(s)) this.botHit();
    }
  }

  /**
   * ULTI del rival (BOT): con la carga completa y buen contacto, en vez del golpe normal hace la cinemática del
   * INFERNO (mirada, energía, desplazamiento con sombras) y luego el golpe con la esfera de fuego. true = la lanzó
   * (el golpe lo da la cinemática al terminar).
   */
  private botUlti(s: BallState): boolean {
    if (this.cine.active || this.phase !== 'rally' || this.serveLock) return false; // sin ULTI en el resto del saque
    const bt = this.bot;
    const ctx = { playerX: this.player.x, playerY: this.player.y, botX: bt.x, botY: bt.y };
    if (!this.brain.wantsUlti(s, ctx)) return false;
    // su carga visible (botChargeTick) se apaga ya: la escena se congela durante la cinemática
    this.rivalChargeT = 0;
    this.rivalChargeFx(0);
    this.rivalChargeSprite.hide();
    const skin = this.rivalSkin(); // el personaje que se ve al frente
    const el: InfernoElement = this.botKit.inferno; // su kit (ai/botKit.ts): Mai = hielo, Nxo = fuego
    const from = { x: bt.x, y: bt.y };
    // se acerca a la pelota durante el desplazamiento (como el jugador), sin salir de su zona
    const k = this.brain.ultiMoveToBall;
    const to = { x: clamp(from.x + (s.x - from.x) * k, B_X[0], B_X[1]), y: clamp(from.y + (s.y - from.y) * k, Y_MIN, Y_MAX) };
    if (!bt.ch.infernoHold()) bt.ch.setCharging(true);
    const sprites = spritesIn(bt.ch);
    const D = INFERNO.dash;
    const dashSt = { sound: false };
    infernoSound.charge(this);
    showInfernoGaze(this, INFERNO_CINE.hitAtMs - GAZE_END_BEFORE_HIT_MS, this.gazeY(), skin, el);
    this.ghosts.setLook(INFERNO_LOOK[el].ghostTint, INFERNO_LOOK[el].ghostRamp);
    this.cine.start({
      profile: infernoCine(el),
      freeze: [...sprites, ...spritesIn(this.player.ch)],
      executor: sprites,
      leadMs: 0,
      focus: () => this.cineFocus(bt),
      onCancel: () => {
        bt.ch.infernoRelease();
        bt.ch.setCharging(false);
        this.ghosts.clear();
      },
      onFrame: (e) => {
        if (e >= INFERNO_CINE.hitAtMs - INFERNO_PRE_MS) bt.ch.infernoPre();
        if (e < D.fromMs) return;
        this.infernoDashStep(e, bt, from, to, sprites, dashSt);
      },
      onHit: () => {
        bt.x = to.x;
        bt.y = to.y;
        bt.ch.setCharging(false); // suelta la pose de espera: el golpe sigue desde la raqueta atrás
        this.ghosts.end();
        if (this.phase === 'rally' && this.lastHitter !== 'bot' && bt.stun <= 0) this.botHit(true, el);
        else bt.ch.infernoRelease();
      },
    });
    return true;
  }

  /**
   * GOLPE CARGADO AL MÁXIMO: destello corto en el contacto de la raqueta con la pelota (estrella blanca de 4 puntas que
   * gira y se apaga + núcleo brillante). ~180 ms; se suma a la onda expansiva de siempre (shockFx).
   */
  private maxContactFlash(x: number, y: number, k: number) {
    const s = Math.max(0.7, k);
    const ADD = Phaser.BlendModes.ADD;
    const core = this.add.circle(x, y, 16 * s, 0xffffff, 1).setDepth(3600).setBlendMode(ADD);
    this.tweens.add({ targets: core, scale: { from: 0.6, to: 2.2 }, alpha: { from: 1, to: 0 }, duration: 160, ease: 'Quad.easeOut', onComplete: () => core.destroy() });
    const halo = this.add.circle(x, y, 26 * s, 0xfff3a0, 0.55).setDepth(3599).setBlendMode(ADD);
    this.tweens.add({ targets: halo, scale: { from: 0.8, to: 2.6 }, alpha: { from: 0.6, to: 0 }, duration: 220, ease: 'Cubic.easeOut', onComplete: () => halo.destroy() });
    for (const [rot, len] of [[0, 1], [Math.PI / 4, 0.55]] as const) {
      const st = this.add.star(x, y, 4, 3 * s, 46 * s * len, 0xffffff, 1).setDepth(3601).setBlendMode(ADD).setRotation(rot);
      this.tweens.add({ targets: st, scale: { from: 0.4, to: 1.15 }, angle: st.angle + 35, alpha: { from: 1, to: 0 }, duration: 190, ease: 'Cubic.easeOut', onComplete: () => st.destroy() });
    }
  }

  /** instante (reloj de simulación) del último bote de un ESPECIAL rival en tu lado */
  private smashBounceAt: number | null = null;

  /**
   * Devolución PERFECT del ESPECIAL (SMASH) rival: tu toque cae justo en el bote de la bola de fuego en tu lado
   * (±SMASH_PERFECT.windowS) y la golpeas enseguida después del bote. Entonces NO te aturde: la bola se apaga y sale tu
   * golpe normal (con su Perfect Timing). Solo el ESPECIAL: la ULTI aturde siempre, y el DEFENSIVO (golpe forzado del
   * DASH) no cuenta. true = la bola ya es una pelota normal y hay que llamar a playerHit().
   */
  private smashPerfectReturn(): boolean {
    const at = this.smashBounceAt;
    const tap = this.timing.lastTap;
    if (this.infernoFlight || !this.ball.power || this.bounces !== 1 || at === null || tap === null) return false;
    if (this.contactClock - at > SMASH_PERFECT.afterBounceS) return false; // la golpeas ya lejos del bote
    if (Math.abs(tap - at) > SMASH_PERFECT.windowS) return false;
    this.smashBounceAt = null;
    // la bola de fuego se apaga: sigue la pelota normal (sus llamas y su humo desaparecen)
    this.ball.setPower(false);
    this.ball.quietFx = false;
    this.fire.clear();
    const head = this.headPos(this.player);
    const p = project(this.ball.s.x, this.ball.s.y, this.ball.s.z);
    playTimingFx(this, 'perfect', head, { x: p.sx, y: p.sy });
    this.popText(head.x, head.y - 46, '¡DEVUELTA!', '#7ff0ff', 30);
    return true;
  }

  /** `forced`: devolución garantizada del DASH (sin toque del jugador: no se evalúa el timing). */
  private playerHit(forced = false) {
    // golpe forzado del DASH (DEFENSIVO) contra el SMASH o la ULTI rival: también te revienta (la ULTI, aun en ZONA)
    if (this.ball.power && this.lastHitter === 'bot' && !this.infernoPending && (this.infernoFlight || !this.zone.active('player'))) {
      this.playerImpact();
      return;
    }
    const s = this.ball.s;
    // INFERNO DRIVE usa el golpe de máxima potencia (como el SMASH) con su propio multiplicador
    const inferno = this.infernoPending;
    // ESPECIAL armado: no sale en el resto del saque (serveLock); queda armado para el siguiente golpe
    const power = (this.smashArmed && !this.serveLock) || inferno;
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
    // en la red sin botar: pelota alta = REMATE automático; si no, VOLEA (animación y tiro de volea)
    const atNet = volley && this.player.x >= NET_ZONE_X;
    const netSmash = !power && atNet && s.z >= NET_SMASH_Z;
    const netVolley = !power && atNet && !netSmash;
    // cargando + joystick abajo = CORTITA cargada: la elección del jugador manda sobre el remate automático
    // (antes, dentro del círculo del globo el remate la anulaba y la pelota salía fuerte al fondo)
    const chargedDrop = charged && this.shotFromJoystick() === 'drop';
    // REMATE: globo recibido dentro del círculo sin SMASH (o pelota alta en la red) → golpe fuerte y directo automático
    const remate = (!power && (lobOk || netSmash) && !chargedDrop) || !!this.remateShot;
    /** remate del globo (con salto): el automático de siempre o el del REMATE con cámara lenta */
    const lobRemate = lobOk || !!this.remateShot;
    const rs = this.remateShot;
    this.superArmed = false;
    this.stopCharge();
    if (power) {
      if (this.smashArmed) this.net?.sendAction('smash-disarmed'); // el rival deja de ver tu aura
      this.smashArmed = false;
      this.smashBtn.setArmed(false);
      // (el aura de llamas ya no se enciende al armar el SMASH: es de la ZONA)
      this.fadeOutSnd(this.smashSnd); // el sonido de cargando del ESPECIAL termina con el golpe
      this.smashSnd = null;
    }
    // remate (animación 'smash', con salto en el SMASH): solo con el remate del globo o una pelota alta / que
    // llega en globo; el SMASH contra una pelota normal usa el golpe fuerte (derecha / revés potente)
    // ms hasta que la raqueta llega visualmente a la pelota (el golpe físico es AHORA; solo el destello espera)
    const overhead = remate || (power ? this.powerOverhead(s) : s.z > OVERHEAD_Z);
    const fxDelay = this.player.ch.swing(power || charged || remate, overhead, (power && overhead) || (remate && lobRemate), netVolley && !overhead);
    // en red: los datos REALES de este golpe (el rival repite exactamente la misma animación); `charged` = carga o remate
    if (this.net) this.netHit = { charged: charged || remate, overhead, volley: netVolley && !overhead, special: (power && overhead) || (remate && lobRemate), shock: charged && !power && c >= 0.995 };

    const depth = (a: number, b: number) => NET_X + (COURT.right - NET_X) * rand(a, b);
    const lat = (k: number) => LAT_C + clamp(k, -1, 1) * (HALF_W - 30);
    let tx: number;
    let ty: number;
    let speed = SHOT_SPEED;
    let margin = 18;
    let kind: ShotKind = 'normal';
    let dead = false;
    /** cortita CARGADA: bote aún más bajo que la dejada normal */
    let deadHard = false;
    /** parte de `speed` que aporta la carga (0 sin cargar): TEMPRANO solo penaliza esto (Perfect Timing) */
    let chargePart = 0;

    if (power) {
      tx = depth(0.72, 0.9);
      ty = this.bot.y > LAT_C ? COURT.top + rand(25, 60) : COURT.bottom - rand(25, 60);
      if (inferno) {
        // ULTI (INFERNO DRIVE): sin joystick, al MEDIO; derecha / izquierda, a ese lado
        const d = this.shotDir();
        ty = Math.abs(d.x) > 0.3 ? LAT_C + Math.sign(d.x) * rand(0.7, 0.92) * (HALF_W - 30) : LAT_C + rand(-0.08, 0.08) * HALF_W;
      }
      // multiplicadores una sola vez (el potenciado del globo solo existe armando el SMASH normal)
      speed = SHOT_SPEED * SMASH_SPEED_MULT * (inferno ? INFERNO.speedMult : superHit ? LOB_SMASH.powerMult : 1);
      margin = 6;
    } else if (remate && rs) {
      // REMATE con cámara lenta: al cuadro elegido; SMASH! = más fuerte
      tx = rs.tx;
      ty = rs.ty;
      speed = rs.speed;
      margin = REMATE.margin;
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
      // abajo = cortita y arriba = globo SIEMPRE (también de volea); la volea plana solo sin esas direcciones
      if (volley && shot !== 'drop' && shot !== 'lob') {
        // volea rápida y plana
        tx = depth(0.55, 0.8);
        ty = lat(d.x * 0.9 + rand(-0.15, 0.15));
        speed = SHOT_SPEED * (1.4 + 0.35 * c);
        chargePart = SHOT_SPEED * 0.35 * c;
        margin = 6;
        kind = Math.abs(d.x) > 0.3 ? 'side' : 'normal';
      } else if (shot === 'drop') {
        // cortita cargada (en diagonal, a ese lado). Solo AL MÁXIMO es la muerta (pegada a la red y casi sin bote); con
        // menos carga cae algo más lejos y bota como una dejada normal (antes, a media carga ni botaba)
        const full = c >= 0.995;
        const short = 1 - c; // 0 al máximo
        tx = full ? depth(0.08, 0.2) : depth(0.12 + 0.1 * short, 0.24 + 0.1 * short);
        ty = lat(this.diagLat(d));
        speed = SHOT_SPEED * (0.85 + 0.15 * c);
        chargePart = SHOT_SPEED * 0.15 * c;
        margin = full ? 5 : 8;
        dead = true;
        deadHard = full; // solo al máximo casi no levanta al botar
        kind = 'drop';
        // aviso sobre el jugador: es un golpe que suele dar punto (se ve en el instante del golpe)
        this.time.delayedCall(fxDelay, () => {
          const h = this.headPos(this.player);
          this.popText(h.x, h.y - 10, 'CORTITA', '#9dffb0', 30);
        });
      } else if (shot === 'lob') {
        // arriba: GLOBO cargado, alto y muy profundo (más carga = más alto y más al fondo)
        tx = depth(0.86 + 0.06 * c, 0.95 + 0.03 * c);
        ty = lat(this.diagLat(d));
        speed = SHOT_SPEED * (0.9 + 0.15 * c);
        chargePart = SHOT_SPEED * 0.15 * c;
        margin = 80 + 30 * c;
        kind = 'lob';
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
      // volea en la red (sin cargar): plana y rápida al lado que marque el joystick (abajo = dejada, arriba = globo)
      const netShot = netVolley && (shot === 'normal' || shot === 'left' || shot === 'right');
      if (netShot) {
        tx = depth(0.5, 0.8);
        ty = lat(shot === 'left' ? -rand(0.7, 0.95) : shot === 'right' ? rand(0.7, 0.95) : d.x * 0.8 + rand(-0.25, 0.25));
        speed = SHOT_SPEED * 1.25;
        margin = 6;
        kind = shot === 'normal' ? 'normal' : 'side';
      } else switch (shot) {
        case 'drop': // abajo: pelota corta, junto a la red (abajo + lado = cortita a ese lado)
          tx = depth(0.1, 0.25);
          ty = lat(this.diagLat(d));
          speed = SHOT_SPEED * 0.8;
          margin = 8;
          kind = 'drop';
          break;
        case 'lob': // arriba: globo alto y profundo (arriba + lado = globo a ese lado)
          tx = depth(0.82, 0.94);
          ty = lat(this.diagLat(d));
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
      ({ tx, ty, speed, margin } = this.applyTiming(timed, power ? 'ability' : remate ? 'remate' : chargeTimed || (charged && c >= 0.995) ? 'max' : 'normal', kind, tx, ty, speed, margin, chargePart, this.zone.active('player') ? zoneStatPercent(this.zoneLevels.player.precision) : 0));
    }
    s.z = Math.max(s.z, 22);
    // ZONA: golpes más fuertes (no globos ni dejadas)
    if (this.zone.active('player') && kind !== 'lob' && kind !== 'drop') speed *= ZONE.shotMult * this.zoneStatMultiplier('player', 'strength');
    if (this.zone.active('bot')) speed *= 1 - zoneStatPercent(this.zoneLevels.bot.resistance);
    aimShot(s, tx, ty, speed, margin);
    if (dead) {
      s.damp = deadHard ? 0.12 : 0.22;
      s.fric = deadHard ? 0.4 : 0.5;
    }
    // SMASH (no INFERNO): la pelota, su humo, el golpe y el impacto son los de tu poder
    if (power && !inferno) this.setSmashFlight(this.smashEl);
    this.ball.setPower(power);
    // ESPECIAL armado que no salió en este golpe (resto del saque): la pelota que va al rival no va encendida
    if (!power && this.smashArmed) this.ball.setIgnited(false);
    this.ball.setKind(kind, charged || remate, this.trailLook);
    // cargado al máximo: pelota brillante con rayos y sin estela (objects/Ball.setMaxCharge)
    this.ball.setMaxCharge(charged && !power && c >= 0.995);
    if (timed && timed.grade !== 'none') {
      const grade = timed.grade;
      const contact = project(s.x, s.y, s.z);
      this.time.delayedCall(fxDelay, () => playTimingFx(this, grade, this.headPos(this.player), { x: contact.sx, y: contact.sy }));
    }
    // RACHA de PERFECTO (golpes con toque evaluado; el golpe forzado del DEFENSIVO no la toca)
    if (timed) {
      this.perfectStreak = nextStreak(this.perfectStreak, timed.grade);
      const n = this.perfectStreak;
      if (n >= TIMING.streak.from) {
        this.smashBtn.reduceCooldown(TIMING.streak.cdS);
        this.dashBtn.reduceCooldown(TIMING.streak.cdS);
        this.time.delayedCall(fxDelay, () => playStreakFx(this, n, this.headPos(this.player)));
      }
      // en red el rival ve tu nota (¡PERFECTO! / BIEN / PRONTO / TARDE) y tu racha sobre tu personaje
      if (timed.grade !== 'none' && timed.grade !== 'off') this.net?.sendAction('timing', { grade: timed.grade, streak: n, ms: fxDelay });
    }
    this.lastHitter = 'player';
    this.bounces = 0;
    this.ai.onPlayerHit(power || remate);
    this.hitFxAt(fxDelay, s.x, s.y, s.z, power, charged ? c : remate ? 1 : 0.15, this.infernoPending, this.infernoPending ? getProfile().inferno : power ? this.smashEl : undefined);
    if (charged && !power && c >= 0.995) {
      const pc = project(s.x, s.y, s.z);
      this.time.delayedCall(fxDelay, () => {
        shockFx(this, pc.sx, pc.sy, pc.s);
        this.maxContactFlash(pc.sx, pc.sy, pc.s);
      });
    }
    // estilo equipado: destello de su color en la raqueta (el clásico no añade nada)
    const look = this.look;
    if (!power && getProfile().style !== 'classic') {
      const p0 = project(s.x, s.y, s.z);
      this.time.delayedCall(fxDelay, () => {
        const ring = this.add.circle(p0.sx, p0.sy, 10 * p0.s, look.trail, 0).setStrokeStyle(5 * p0.s, look.trail, 0.9).setDepth(3499).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: ring, scale: 3.2, alpha: 0, duration: 300, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
      });
    }
    if (remate) {
      this.time.delayedCall(fxDelay, () => {
        this.ball.setImpactTrail(0.9, 0xffffff);
        this.cameras.main.shake(rs?.perfect ? 260 : lobRemate ? 190 : 110, rs?.perfect ? 0.02 : lobRemate ? 0.013 : 0.007);
        if (rs?.perfect) {
          // SMASH!: el destello del remate potenciado y estela dorada
          const pp = project(s.x, s.y, s.z);
          superSmashFx(this, pp.sx, pp.sy);
          this.ball.setImpactTrail(1, 0xffd23f);
        }
        if (lobRemate) {
          // onda expansiva del remate: dos anillos aplastados (perspectiva) que se abren desde el impacto
          const p1 = project(s.x, s.y, s.z);
          for (const [d, col] of [[0, 0xffffff], [90, 0xffd23f]] as const) {
            const ring = this.add.ellipse(p1.sx, p1.sy, 40 * p1.s, 26 * p1.s).setStrokeStyle(7 * p1.s, col, 0.95).setDepth(3500).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
            this.tweens.add({ targets: ring, scale: 7, alpha: { from: 0.95, to: 0 }, duration: 480, delay: d, ease: 'Cubic.easeOut', onStart: () => ring.setAlpha(0.95), onComplete: () => ring.destroy() });
          }
          const flash = this.add.circle(p1.sx, p1.sy, 34 * p1.s, 0xffffff, 0.85).setDepth(3500).setBlendMode(Phaser.BlendModes.ADD);
          this.tweens.add({ targets: flash, scale: 2.4, alpha: 0, duration: 220, ease: 'Cubic.easeOut', onComplete: () => flash.destroy() });
        }
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
  private applyTiming(t: TimingResult, cls: ShotClass, kind: ShotKind, tx: number, ty: number, speed: number, margin: number, chargePart = 0, zonePrecision = 0) {
    const mods = timingMods(t.grade, cls, kind, t.deltaMs);
    mods.errLat *= 1 - zonePrecision;
    mods.errDep *= 1 - zonePrecision;
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

  /** `ulti` = golpe de la ULTI del rival (tras su cinemática); `el` = su poder (la bola y los efectos). */
  private botHit(ulti = false, el: InfernoElement = 'fire') {
    const s = this.ball.s;
    // a dónde y cómo devuelve: lo decide el cerebro; la física del golpe se aplica aquí como siempre
    // sin ESPECIAL en el resto del saque (serveLock: este golpe sería el 2º del punto)
    const shot = this.brain.planShot(s, { playerX: this.player.x, playerY: this.player.y, botX: this.bot.x, botY: this.bot.y }, ulti, this.serveLock);
    // ESPECIAL del BOT: la misma cinemática que el tuyo (pantalla oscura y foco en él, partido congelado); el golpe sale
    // al terminar, una sola vez. Su clip arranca ya en la preparación (la segunda llamada a swing no lo reinicia).
    if (shot.power && !ulti && !this.net && smashCineEnabled() && !this.cine.active && this.phase === 'rally') {
      const over = s.z > OVERHEAD_Z;
      const lead = this.bot.ch.swing(true, over, over);
      this.cine.start({
        profile: smashCine(this.botKit.smash),
        freeze: [...spritesIn(this.bot.ch), ...spritesIn(this.player.ch)],
        executor: spritesIn(this.bot.ch),
        leadMs: Math.min(lead, 150),
        focus: () => this.cineFocus(this.bot),
        onHit: () => {
          if (this.phase === 'rally' && this.lastHitter !== 'bot') this.applyBotShot(shot, ulti, el);
        },
      });
      return;
    }
    this.applyBotShot(shot, ulti, el);
  }

  /** Aplica el golpe del BOT ya decidido (física, poder, efectos y textos). */
  private applyBotShot(shot: ReturnType<BotBrain['planShot']>, ulti: boolean, el: InfernoElement) {
    const s = this.ball.s;
    const power = !!shot.power;
    // SMASH del rival: golpe fuerte (remate si la pelota viene alta) y bola de fuego
    const botOver = s.z > OVERHEAD_Z;
    const fxDelay = power ? this.bot.ch.swing(true, botOver, botOver) : this.bot.ch.swing(); // SMASH del rival por arriba = remate con salto, igual que el tuyo
    s.z = Math.max(s.z, 22);
    let shotSpeed = shot.speed * (this.zone.active('bot') && shot.kind !== 'lob' && shot.kind !== 'drop' ? ZONE.shotMult * this.zoneStatMultiplier('bot', 'strength') : 1);
    if (this.zone.active('player')) shotSpeed *= 1 - zoneStatPercent(this.zoneLevels.player.resistance);
    aimShot(s, shot.tx, shot.ty, shotSpeed, shot.margin);
    if (power && !ulti) this.setSmashFlight(this.botKit.smash); // ESPECIAL del BOT según su personaje (Mai = hielo, Nxo = fuego)
    this.ball.setPower(power);
    if (!power && this.smashArmed) this.ball.setIgnited(true); // tu ESPECIAL sigue armado (p. ej. tras una estirada)
    this.ball.setKind(shot.kind);
    this.lastHitter = 'bot';
    this.bounces = 0;
    this.brain.onShot(shot); // se recoloca según su golpe (recuperación táctica)
    this.hitFxAt(fxDelay, s.x, s.y, s.z, power, 0.15, ulti, ulti ? el : power ? this.botKit.smash : undefined);
    const h = this.headPos(this.bot);
    if (ulti) {
      // ULTI: esfera de fuego en vuelo, explosión, sacudida y sonido (los mismos que cuando la lanza el jugador)
      this.infernoFlight = true;
      this.infernoBounced = false;
      this.infernoEl = el;
      this.fire.setElement(el);
      const b = project(s.x, s.y, s.z);
      infernoImpactFx(this, b.sx, b.sy, b.s, el);
      infernoShake(this);
      infernoSound.impact(this);
      this.ball.quietFx = true;
      // (sin texto: la ULTI ya se anuncia con la mirada)
    } else if (power) this.popText(h.x, h.y - 10, 'ESPECIAL', '#ffb347', 28);
  }

  /**
   * Efecto de golpe sincronizado con el frame de impacto de la raqueta. La física ya se aplicó;
   * el destello, las partículas y la estela salen cuando la raqueta "toca" la pelota (en el punto de contacto).
   */
  private hitFxAt(delayMs: number, bx: number, by: number, bz: number, power: boolean, level = 0.15, silent = false, el?: InfernoElement) {
    this.ball.holdVisual(delayMs); // la pelota se ve en el contacto hasta que la raqueta llega a su frame de impacto
    if (delayMs <= 0) this.hitFx(bx, by, bz, power, level, silent, el);
    else this.time.delayedCall(delayMs, () => this.hitFx(bx, by, bz, power, level, silent, el));
  }

  // ---------------------------------------------------------------- efectos
  /**
   * Efecto del golpe sobre la pelota. `level` es la potencia real (0..1) y elige el tramo
   * (suave / medio / fuerte / máximo) del destello, las ondas y la estela. Con SMASH sale el fuego de siempre; con
   * INFERNO (`el`), el anillo, las chispas y el destello van con los colores de su poder (INFERNO_LOOK).
   */
  private hitFx(bx: number, by: number, bz: number, power: boolean, level = 0.15, silent = false, el?: InfernoElement) {
    if (!silent && this.cache.audio.exists('golpe-fuerte')) this.sound.play('golpe-fuerte', { volume: power ? 1 : 0.75 });
    const p = project(bx, by, bz);
    const x = p.sx;
    const y = p.sy;
    if (power) {
      const C = INFERNO_LOOK[el ?? 'fire'].hit;
      const ring = this.add.circle(x, y, 14, 0xffffff, 0).setStrokeStyle(8, C.ring).setDepth(3500);
      this.tweens.add({ targets: ring, scale: 4, alpha: 0, duration: 380, onComplete: () => ring.destroy() });
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = rand(30, 90);
        const st = this.add.star(x, y, 4, 3, 8, C.star).setDepth(3500);
        this.tweens.add({ targets: st, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, alpha: 0, angle: 180, duration: 320, onComplete: () => st.destroy() });
      }
      this.cameras.main.shake(160, 0.012);
      this.cameras.main.flash(120, C.flash[0], C.flash[1], C.flash[2]);
      return;
    }
    const tier = playImpact(this, x, y, level);
    this.ball.setImpactTrail(TIER_TRAIL[tier].boost, TIER_TRAIL[tier].color);
  }
  private bounceFx(x: number, y: number) {
    const p = project(x, y);
    // marca del bote en el suelo: sombra oscura del tamaño de la pelota que se queda donde tocó y se va ~1 s
    // después de que la pelota se levanta (dibujada bajo los personajes y la pelota, sobre la cancha)
    const mark = this.add.ellipse(p.sx, p.sy, 22 * p.s, 9 * p.s, 0x000000, 0.42).setDepth(1);
    this.tweens.add({ targets: mark, alpha: 0, scaleX: 1.15, delay: 1000, duration: 350, ease: 'Quad.easeIn', onComplete: () => mark.destroy() });
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
    if (this.autoPlay) return this.autoMoveVector();
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
    if (this.autoPlay) return this.autoAim.clone(); // AUTO: dirección de golpe propia (no la de su movimiento)
    const v = this.inputVector();
    if (v.lengthSq() > 0.09) return v;
    if (this.time.now - this.lastDirAt < 250) return this.lastDir.clone();
    return new Phaser.Math.Vector2();
  }

  /**
   * Lado de una CORTITA o un GLOBO en DIAGONAL: joystick abajo/arriba + a un lado (|x| ≥ DIAG_X) = -1 izquierda / +1
   * derecha; recto = 0.
   */
  private shotSide(d = this.shotDir()): -1 | 0 | 1 {
    return Math.abs(d.x) >= DIAG_X ? (d.x < 0 ? -1 : 1) : 0;
  }

  /** Lateral (-1..1) del bote de una cortita / globo: en diagonal, claramente a ese lado; recto, cerca del centro. */
  private diagLat(d: Phaser.Math.Vector2): number {
    const side = this.shotSide(d);
    return side !== 0 ? side * rand(0.65, 0.92) : d.x * 0.6 + rand(-0.2, 0.2);
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

  /**
   * DESTELLO del BOT (kit de Mai, ai/botKit.ts): en vez del sprint del DASH desaparece con la estela del destello y
   * reaparece en el punto que predijo su IA. Breve (BLINK.fast*) porque mientras no se ve no puede golpear (inReach).
   */
  private botBlink() {
    const bt = this.bot;
    const from = { x: bt.x, y: bt.y };
    const tx = clamp(this.ai.target.x, B_X[0], B_X[1]);
    const ty = clamp(this.ai.target.y, Y_MIN, Y_MAX);
    const a = project(from.x, from.y);
    const b = project(tx, ty);
    const k = a.s * VIEW.CHAR_K;
    this.dashFx.burst(a.sx, a.sy, k, bt.ch.depth);
    if (Math.hypot(tx - from.x, ty - from.y) > 40) {
      for (let i = 0; i < 3; i++) {
        const f = (i + 1) / 4;
        bt.x = from.x + (tx - from.x) * f;
        bt.y = from.y + (ty - from.y) * f;
        this.renderActors(); // la sombra copia la pose en esa posición
        this.dashFx.ghost(bt.ch, i, bt.ch.depth);
      }
      bt.x = from.x;
      bt.y = from.y;
      this.renderActors();
    }
    this.dashFx.streak(a.sx, a.sy - 70 * k, b.sx, b.sy - 70 * k, k, bt.ch.depth);
    this.portalFx(from.x, from.y, 0x45d9ff, 0xd9f7ff);
    const h = this.headPos(bt);
    this.popText(h.x, h.y - 10, 'DEFENSIVO', '#c9a4ff', 26); // el rival: solo el tipo de habilidad
    bt.vanished = true;
    this.tweens.add({
      targets: bt,
      warp: 0,
      duration: BLINK.fastOut * 1000,
      ease: 'Quad.easeIn',
      onComplete: () => {
        bt.x = tx;
        bt.y = ty;
        this.portalFx(tx, ty, 0x45d9ff, 0xd9f7ff);
        this.tweens.add({ targets: bt, warp: 1, duration: BLINK.fastIn * 1000, ease: 'Back.easeOut', onComplete: () => (bt.vanished = false) });
      },
    });
  }

  /**
   * CARGA del BOT (solo visual): quieto esperando una pelota tuya que ya viene hacia su lado, muestra la pose y el
   * efecto de carga de su personaje (Mai = tulipán, Nxo = fuego), igual que se ve al rival en red. No cambia su golpe.
   */
  private botChargeTick(dt: number, moving: boolean) {
    const bt = this.bot;
    const s = this.ball.s;
    const on = this.phase === 'rally' && this.lastHitter === 'player' && s.vx > 0 && s.x > NET_X - 80 && !moving && bt.stun <= 0 && !bt.vanished;
    if (on) this.rivalChargeT += dt;
    else this.rivalChargeT = 0;
    bt.ch.setCharging(on);
    this.rivalChargeFx(dt);
  }

  private renderActors() {
    for (const a of [this.player, this.bot]) {
      const p = project(a.x, a.y);
      // con hipercarga el jugador crece un poco (como en Brawl Stars)
      const boost = (a === this.player ? this.aura.active : !!this.botAura?.active) ? 1.1 + Math.sin(this.time.now / 70) * 0.015 : 1;
      const k = p.s * VIEW.CHAR_K * boost;
      // SUPERSALTO: el dibujo sube (lift en z) pero la profundidad sigue la del suelo
      const sy = a.lift ? project(a.x, a.y, a.lift).sy : p.sy;
      a.ch.setPosition(p.sx, sy).setScale(k * a.warp, k * (1 + (1 - a.warp) * 0.8)).setDepth(p.sy);
      a.ch.setAlpha(0.25 + 0.75 * a.warp);
    }
    this.aura.update(this.game.loop.delta / 1000);
    this.botAura?.update(this.game.loop.delta / 1000);
    this.renderCharge();
    const h = this.headPos(this.bot);
    this.dizzy.setVisible(this.bot.stun > 0).setPosition(h.x, h.y);
    const hp = this.headPos(this.player);
    // solo el aturdido del SMASH (la estirada también usa stun, sin estrellas)
    this.dizzyP.setVisible(this.player.stun > 0 && this.playerDizzy).setPosition(hp.x, hp.y);
    if (this.player.stun <= 0) this.playerDizzy = false;
  }

  update(_t: number, deltaMs: number) {
    this.netFlushHit(); // golpe propio de un temporizador (cinemáticas): se envía cuanto antes
    if (this.paused) return;
    // cinemática del SMASH: el partido queda congelado (física, jugadores, IA, relojes); solo se animan sus efectos
    if (this.cine.active) {
      this.chargeSprite.hide(); // el efecto de carga no se queda congelado a medias
      this.rivalChargeSprite.hide();
      this.cine.update();
      return;
    }
    const dt = Math.min(deltaMs / 1000, 0.05) * this.slowMo; // cámara lenta del REMATE
    this.netView.update(); // la red solo se redibuja mientras ondula / vibra
    this.syncAbilityLock(); // sin habilidades durante el saque y su resto
    this.dashBtn.update(dt);
    this.smashBtn.update(dt);

    // --- jugador
    const pl = this.player;
    this.updateDashSprint(dt); // DASH sprint: el recorrido mueve al jugador (arranque / sprint / frenada)
    this.updateShadowRun(dt); // SOMBRA: el clon corre al punto y al llegar cambias tu lugar con él
    const frozen =
      this.charging ||
      this.remateCine !== null || // REMATE: lo coloca bajo la pelota tickRemate
      this.remateRecover > 0 || // cae tras el golpe al aire del remate
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
    if (this.remateRecover > 0) this.remateRecover -= dt;
    const raw = this.inputVector();
    const v = frozen ? new Phaser.Math.Vector2() : positioning ? new Phaser.Math.Vector2(raw.x, 0) : raw;
    // la dirección para apuntar se lee aunque el jugador esté quieto cargando
    if (raw.lengthSq() > 0.09) {
      this.lastDir.copy(raw);
      this.lastDirAt = this.time.now;
    }
    this.updateCharge(dt);
    // velocidad en pantalla (px/s): con inercia ligera (src/logic/PlayerMotion.ts) o instantánea (la de siempre)
    const maxSp = PLAYER_SPEED * (positioning ? SERVE.positionSpeed : 1) * (this.zone.active('player') ? ZONE.speedMult * this.zoneStatMultiplier('player', 'speed') : 1);
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
    // en red el rival es el otro jugador: se mueve con su estado (sin IA)
    if (this.net) {
      this.netBotTick(dt);
      this.netSignalTick();
      this.netPingTick();
      this.diagTick(dt);
    }
    else {
    // movimiento del rival: lo decide el cerebro (src/ai/BotBrain.ts); aquí solo se aplica
    // ZONA del rival: más rápido mientras dure (se restaura tras el paso)
    const aiSpeed = this.ai.speed;
    if (this.zone.active('bot')) this.ai.speed = aiSpeed * ZONE.speedMult * this.zoneStatMultiplier('bot', 'speed');
    // sin raqueta (ULTI recibida): pasado el aturdido corre a buscarla en vez de ir a por la pelota
    const fetch = bt.racket && bt.stun <= 0 && !bt.vanished ? this.botFetchRacket(dt) : null;
    // REMATE del BOT: salta y se coloca bajo la pelota (sin el cerebro)
    const rem = this.botRemate ? this.botRemateMove(dt) : null;
    const mv = rem ?? fetch ?? this.brain.tick(bt, {
      dt,
      phase: this.phase,
      botServes: this.server === 'bot',
      servePositioning: this.serveCtl.state === 'POSITIONING',
      serveY: this.botServeY,
      ball: this.ball.s,
      noAbilities: this.serveLock || !!bt.racket, // sin DASH durante el saque y su resto (igual que tú), ni sin raqueta
    });
    this.ai.speed = aiSpeed;
    // DASH del rival: sprint hacia el punto previsto (la animación de siempre del sprint)
    // (Mai: DESTELLO = teletransporte al punto previsto, con la estela del destello del jugador)
    if (mv.sprint === 'start') {
      if (this.botKit.defensive === 'blink') this.botBlink();
      else {
        bt.ch.setSprint(true, this.ai.target.y - bt.y);
        const h = this.headPos(bt);
        this.popText(h.x, h.y - 10, 'DEFENSIVO', '#c9a4ff', 26);
        this.dustFx(bt.x, bt.y);
        // destello de arranque y sombras al correr: los mismos efectos que tu DASH
        const p = project(bt.x, bt.y);
        this.dashFx.burst(p.sx, p.sy, p.s * VIEW.CHAR_K, bt.ch.depth);
        this.botDashFx = { t: 0, ghosts: 0 };
      }
    } else if (mv.sprint === 'end' && this.botKit.defensive !== 'blink') {
      bt.ch.setSprint(false, mv.dirX);
      this.botDashFx = null;
    }
    if (this.botDashFx) {
      const d = this.botDashFx;
      d.t += dt;
      if (d.ghosts < 3 && d.t >= 0.09 * (d.ghosts + 1)) {
        this.renderActors();
        this.dashFx.ghost(bt.ch, d.ghosts, bt.ch.depth);
        d.ghosts++;
      }
      if (d.ghosts >= 3 || d.t > 1.4) this.botDashFx = null;
    }
    bt.ch.setMoving(mv.moving && !bt.vanished, mv.dirX);
    if (mv.readyToToss) this.beginToss(this.botPlan.kind);
    this.updateFacing(bt);
    this.botChargeTick(dt, mv.moving);
    }

    this.racketPickup();

    // --- tiempo para sacar (solo el jugador): si se agota, falta
    this.tickServeClock(dt);

    // --- pelota
    // sacador quieto antes de lanzar: bota la pelota (hojas nuevas de NXO); moviéndose no
    const srvA = this.srvActor();
    const still = this.phase === 'serve' && this.serveCtl.state === 'POSITIONING' && (srvA !== pl || this.inputVector().lengthSq() < 0.01);
    pl.ch.setServeIdle(srvA === pl && still);
    bt.ch.setServeIdle(srvA === bt && still);
    if (this.phase === 'serve' || this.phase === 'intro') {
      this.holdBall();
      const bz = this.phase === 'serve' ? srvA.ch.serveBounceBall() : null;
      // la pelota del juego rebota sincronizada con la mano del clip (en la mano izquierda, al otro lado de la raqueta)
      if (bz !== null) {
        // altura y lado de la mano del clip de bote (NxoActor.serveBounceBall)
        this.ball.s.z = bz.z;
        this.ball.s.y = srvA === this.player ? srvA.y + bz.dy : srvA.y - bz.dy;
      } else this.ball.s.z = 62 + Math.sin(this.time.now / 150) * 4;
    } else if (this.phase === 'toss') {
      const srv = this.srvActor();
      const s = this.ball.s;
      const ctl = this.serveCtl;
      s.x = srv.x + srv.dir * 10;
      // la pelota sube RECTA desde la mano (sin moverse de lado) y vuelve a bajar por el mismo sitio; el sacador se ajusta
      // un poco hacia ella al golpear (serveJump), no la pelota hacia la raqueta
      s.y = srv.y + this.tossFromDy;
      const ev = stepBall(s, dt);
      if (ev === 'bounce') this.tossFault(); // golpe en vacío: la pelota cayó al suelo
      else if (ctl.state === 'AIMING' && s.vz < 0 && s.z <= SERVE.catchZ) this.catchBall(); // no la golpeó: la atrapa y reintenta
      else {
        const tev = ctl.tick(dt);
        if (!this.net && this.server === 'bot' && ctl.state === 'AIMING' && ctl.t >= this.botPlan.pressAt) this.beginSwing();
        // el botón elegido se ilumina en azul neón mientras dura la ventana de saque perfecto
        if (this.server === 'player' && ctl.kind) (ctl.kind === 'normal' ? this.serveNormalBtn : this.serveSpinBtn).setCue(ctl.windowOpen());
        if (tev === 'contact') this.executeServe();
      }
    } else if (this.phase === 'rally' || this.phase === 'pointover') {
      const sub = 3;
      for (let i = 0; i < sub; i++) {
        const px = this.ball.s.x;
        const pvx = this.ball.s.vx;
        const ev = stepBall(this.ball.s, dt / sub);
        // red visual: pega en la malla (ondula + golpe sordo) o roza la cinta por encima (vibra + "tic")
        if (ev === 'net') this.netView.hit(this.ball.s.y, this.ball.s.z, pvx);
        else if ((px - NET_X) * (this.ball.s.x - NET_X) < 0 && this.ball.s.z >= NET_HEIGHT && this.ball.s.z <= NET_HEIGHT + SERVE.letBand) {
          this.netView.brush(this.ball.s.y, Math.hypot(this.ball.s.vx, this.ball.s.vy));
        }
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
    if (!lob.active) this.remateWhiffed = false; // otro globo: el remate vuelve a estar disponible
    const insideLob = lob.receiver === 'player' && this.lob.contains(pl.x, pl.y);
    const canSuper = this.lob.windowOpenFor('player', pl.x, pl.y);
    if (!lob.active) this.superArmed = false;
    // el botón SMASH brilla en dorado cuando pulsarlo AHORA daría un remate potenciado (o ya se armó así)
    this.smashBtn.setHint((canSuper && this.smashBtn.ready && !this.smashArmed) || (this.superArmed && canSuper));
    // en el REMATE (tuyo o del rival en red) ya se está en el aire: fuera el círculo del suelo
    this.lobMarker.render(dt, this.remateCine || this.netRemateOn || this.botRemate ? { ...lob, active: false } : lob, insideLob, canSuper);

    this.ball.render(dt);
    // humo del SMASH en vuelo (fuerte si es el potenciado)
    if (!this.ball.power) this.superFlight = false;
    // (el INFERNO DRIVE no echa humo: su rastro es de fuego)
    this.smoke.update(dt, this.ball.s, this.ball.power && !this.infernoFlight, this.superFlight, this.ball.sprite.visible);
    // INFERNO DRIVE: pelota envuelta en llamas mientras dure su trayectoria
    if (!this.ball.power) this.infernoFlight = false;
    this.ball.quietFx = this.infernoFlight;
    this.fire.update(this.ball.s, this.infernoFlight, this.ball.sprite.visible);
    this.tickRemate(dt); // REMATE del globo: salto, apuntado, aro
    this.autoTick(dt); // AUTO: saque y habilidades del piloto automático
    this.tickBotRemate(dt); // REMATE del BOT
    this.tickServeJump(dt); // salto del saque (visual)
    this.renderActors();
    this.updateTimingRing();
    this.renderServeAim();
    this.zoneRender(dt);
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
      cam.setZoom(VIEW.CAM_ZOOM * (1 + (LOB_SMASH.zoom - 1) * ease));
      cam.scrollY = (pp.sy - LOB_SMASH.focusLift - this.scale.height / 2) * ease;
      cam.scrollX += (pp.sx - VIEW.W / 2) * (1 - VIEW.FOLLOW) * 0.5 * ease * Math.min(1, dt * 5);
      cam.setRotation(LOB_SMASH.tilt * ease * (this.player.ch.facing >= 0 ? -1 : 1));
      this.lobVignette.setAlpha(LOB_SMASH.vignette * ease).setVisible(ease > 0.01);
    }
    // reloj de simulación de Perfect Timing (mismo dt que la física)
    this.simClock += dt;
    this.simRealAt = performance.now();
    this.netFlushHit();
    this.netSendState();
  }

  // ================================================================ REMATE del globo (cámara lenta + apuntado + aro)
  /**
   * ¿Empieza el REMATE? Globo del rival que cae dentro de la cancha, tú dentro de su círculo, la pelota ya bajando y a
   * la altura de inicio (REMATE.startZ). No con el ESPECIAL / la ULTI armados (esos tienen su propio remate).
   */
  private canStartRemate(s: BallState) {
    const st = this.lob.state;
    const pl = this.player;
    return (
      !this.ball.power &&
      !this.smashArmed &&
      !this.inferno.armed &&
      st.active &&
      st.receiver === 'player' &&
      st.inCourt &&
      this.lob.contains(pl.x, pl.y) &&
      !this.remateWhiffed &&
      s.vz < 0 &&
      s.z <= REMATE.startZ &&
      s.z > REMATE.contactZ &&
      pl.stun <= 0 &&
      !pl.vanished &&
      !this.dashRun &&
      !this.cine.active
    );
  }

  /**
   * Empieza el REMATE: el personaje salta, el partido va en cámara lenta y un aro se cierra sobre la pelota hasta la
   * altura de contacto. Con el joystick se elige uno de los 4 cuadros del rival (izquierda / derecha × cuadro de saque /
   * fondo). Tocar golpea: justo al cerrarse el aro = SMASH! (más fuerte); si no, va donde apuntaste. Si no tocas, golpea
   * solo al pasarse el aro.
   */
  private startRemate() {
    const s = this.ball.s;
    this.stopCharge();
    // tiempo de juego hasta que la pelota baja a la altura de contacto: z + vz·t − g·t²/2 = contactZ
    const dz = Math.max(0, s.z - REMATE.contactZ);
    const T = clamp((s.vz + Math.sqrt(s.vz * s.vz + 2 * GRAVITY * dz)) / GRAVITY, 0.12, 0.8);
    // en red el rival ve la misma cámara lenta (acción 'remate-start'), sin acercamiento de cámara
    const slow = clamp(T / REMATE.realS, REMATE.minSlow, 1);
    this.setSlowMo(slow);
    // la velocidad de las animaciones es global (todas las escenas): si se sale del partido a mitad, se restaura
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.setSlowMo(1));
    this.remateCine = {
      t: 0,
      T,
      aim: { col: this.bot.y > LAT_C ? -1 : 1, row: 'deep' },
      g: this.add.graphics().setDepth(0.8),
      ring: this.add.graphics().setDepth(4000),
    };
    this.net?.sendAction('remate-start', { slow, t: T });
    this.player.ch.remateHold(); // raqueta arriba, congelada hasta el golpe
    const h = this.headPos(this.player);
    // (en cámara lenta su animación también va lenta: se quita al golpear para no taparse con SMASH!)
    this.remateCine.label = this.popText(h.x, h.y - 10, 'REMATE', '#ffd23f', 30);
    navigator.vibrate?.(30);
  }

  /** Cámara lenta del partido (física, animaciones, tweens y temporizadores). 1 = normal. */
  private setSlowMo(k: number) {
    this.slowMo = k;
    this.tweens.timeScale = k;
    this.anims.globalTimeScale = k;
    this.time.timeScale = k;
  }

  /** Cada fotograma del REMATE: salto, colocarse bajo la pelota, apuntado, aro y golpe automático si se pasa. */
  private tickRemate(dt: number) {
    const r = this.remateCine;
    if (!r) return;
    r.t += dt;
    const p = r.t / r.T;
    const pl = this.player;
    const s = this.ball.s;
    pl.lift = REMATE.jump * Math.sin((Math.min(1, p) * Math.PI) / 2);
    const k = Math.min(1, dt * 10);
    pl.x += (clamp(s.x - 16, P_X[0], P_X[1]) - pl.x) * k;
    pl.y += (clamp(s.y, Y_MIN, Y_MAX) - pl.y) * k;
    // apuntado (se queda con la última dirección): lado con izquierda / derecha, fondo con arriba, saque con abajo
    const d = this.inputVector();
    if (Math.abs(d.x) > 0.3) r.aim.col = d.x < 0 ? -1 : 1;
    if (Math.abs(d.y) > 0.35) r.aim.row = d.y > 0 ? 'short' : 'deep';
    this.drawRemateAim(r);
    this.drawRemateRing(r.ring, p);
    if (p >= 1 + REMATE.lateMax) this.remateHit();
  }

  /** Centro del cuadro elegido en el campo rival. */
  private remateTarget(aim: { col: -1 | 1; row: 'short' | 'deep' }) {
    const sl = (COURT.right - NET_X) * 0.538; // fondo de los cuadros de saque (como computeServeBox)
    const x = aim.row === 'short' ? NET_X + sl / 2 : NET_X + sl + (COURT.right - NET_X - sl) / 2;
    const y = aim.col < 0 ? (COURT.top + LAT_C) / 2 : (LAT_C + COURT.bottom) / 2;
    return { x, y };
  }

  /** Los 4 cuadros del rival (los de saque y los del fondo) con el elegido resaltado y su punto de bote. */
  private drawRemateAim(r: NonNullable<typeof this.remateCine>) {
    const g = r.g.clear();
    const sl = (COURT.right - NET_X) * 0.538;
    const xs = { short: [NET_X, NET_X + sl], deep: [NET_X + sl, COURT.right] } as const;
    const ys = { [-1]: [COURT.top, LAT_C], [1]: [LAT_C, COURT.bottom] } as Record<-1 | 1, [number, number]>;
    const quad = (row: 'short' | 'deep', col: -1 | 1) => {
      const [x0, x1] = xs[row];
      const [y0, y1] = ys[col];
      return [this.P(x0, y0), this.P(x0, y1), this.P(x1, y1), this.P(x1, y0)];
    };
    for (const row of ['short', 'deep'] as const) {
      for (const col of [-1, 1] as const) {
        const on = row === r.aim.row && col === r.aim.col;
        const pts = quad(row, col);
        if (on) g.fillStyle(0xffd23f, 0.35).fillPoints(pts, true);
        g.lineStyle(on ? 4 : 2, on ? 0xffd23f : 0xffffff, on ? 0.95 : 0.4).strokePoints(pts, true);
      }
    }
    // (sin el aro del punto de bote: basta el cuadro resaltado, como en el saque)
  }

  /** Aro que se cierra sobre la pelota (p = 1: cerrado, el momento del SMASH!); pasado, se encoge y se apaga. */
  private drawRemateRing(g: Phaser.GameObjects.Graphics, p: number) {
    const s = this.ball.s;
    const bp = project(s.x, s.y, s.z);
    const rb = 18 * bp.s;
    const R0 = 130 * bp.s;
    const perfect = Math.abs(p - 1) <= REMATE.perfect;
    const late = p > 1 + REMATE.perfect;
    const rad = p <= 1 ? rb + (R0 - rb) * (1 - p) : rb * Math.max(0, 1 - (p - 1) / REMATE.lateMax);
    g.clear();
    g.lineStyle(Math.max(2, 3 * bp.s), 0xffffff, 0.45).strokeCircle(bp.sx, bp.sy, rb);
    g.lineStyle(Math.max(3, (perfect ? 8 : 5) * bp.s), perfect ? 0xffd23f : late ? 0xff7a85 : 0xffffff, late ? 0.6 : 1).strokeCircle(bp.sx, bp.sy, rad);
    if (perfect) g.fillStyle(0xffd23f, 0.25).fillCircle(bp.sx, bp.sy, rb * 1.4);
  }

  /** Golpe del REMATE (toque o automático): SMASH! si el aro está cerrado, si no al cuadro elegido. */
  private remateHit() {
    const r = this.remateCine;
    if (!r) return;
    const p = r.t / r.T;
    const grade: 'perfect' | 'early' | 'late' = Math.abs(p - 1) <= REMATE.perfect ? 'perfect' : p < 1 ? 'early' : 'late';
    const target = this.remateTarget(r.aim);
    this.endRemate();
    // antes del golpe: el rival vuelve a velocidad normal y luego recibe el golpe (con la nota, para el SMASH! / ¡AL AIRE!)
    this.net?.sendAction('remate-end', { grade: p < REMATE.whiff ? 'whiff' : grade });
    if (p < REMATE.whiff) {
      // demasiado pronto: golpe AL AIRE. Hace el gesto pero no le pega; la pelota sigue en juego a velocidad normal y
      // el jugador cae y se recupera un instante (poco margen para responderla)
      this.remateWhiffed = true;
      this.remateRecover = REMATE.whiffRecover;
      this.player.ch.swing(true, true, true);
      this.tweens.add({ targets: this.player, lift: 0, duration: 260, ease: 'Quad.easeIn' });
      const h = this.headPos(this.player);
      this.popText(h.x, h.y - 20, '¡AL AIRE!', '#ff9aa3', 32);
      return;
    }
    // fuera del punto exacto: cuanto más lejos del cierre, más suave (hasta un 25 % menos que su velocidad base)
    const miss = Math.max(0, Math.abs(p - 1) - REMATE.perfect);
    const soften = grade === 'perfect' ? 1 : clamp(1 - miss * 0.8, 0.75, 1);
    // dónde se ve la pelota al golpear (para el aro que se abre)
    const b0 = project(this.ball.s.x, this.ball.s.y, this.ball.s.z);
    this.remateShot = { tx: target.x, ty: target.y, speed: SHOT_SPEED * REMATE.speed[grade] * soften, perfect: grade === 'perfect' };
    this.playerHit(true);
    this.remateShot = null;
    this.tweens.add({ targets: this.player, lift: 0, duration: 320, ease: 'Quad.easeIn' });
    if (grade === 'perfect') {
      const h = this.headPos(this.player);
      this.popText(h.x, h.y - 30, 'SMASH!', '#ffd23f', 44);
      navigator.vibrate?.([30, 30, 80]);
    } else {
      // no acertó el cierre: el aro se abre y se apaga (no hubo SMASH!)
      const open = this.add.circle(b0.sx, b0.sy, 26 * b0.s, 0x000000, 0).setStrokeStyle(Math.max(3, 5 * b0.s), p < 1 ? 0xffffff : 0xff7a85, 0.9).setDepth(4000);
      this.tweens.add({ targets: open, scale: 2.6, alpha: 0, duration: 380, ease: 'Cubic.easeOut', onComplete: () => open.destroy() });
    }
  }

  /** Termina la cámara lenta y quita el apuntado y el aro (golpe, fin del punto). */
  private endRemate() {
    const r = this.remateCine;
    if (!r) return;
    this.remateCine = null;
    r.g.destroy();
    r.ring.destroy();
    if (r.label?.active) {
      this.tweens.killTweensOf(r.label);
      r.label.destroy();
    }
    this.setSlowMo(1);
  }

  // ---------------------------------------------------------------- REMATE del BOT (sin red)
  /**
   * ¿El BOT empieza su REMATE? Tu globo cae dentro de su campo, él está cerca de donde cae (el bot se coloca para
   * interceptar: tolerancia mayor que el círculo), la pelota baja y está a la altura de inicio. Si lo intenta se decide
   * una vez por globo según su nivel (55 % … 100 %).
   */
  private canBotStartRemate(s: BallState) {
    const st = this.lob.state;
    if (!st.active || st.receiver !== 'bot') {
      this.botRemateRoll = null;
      return false;
    }
    const bt = this.bot;
    if (this.net || !st.inCourt || this.ball.power || s.vz >= 0 || s.z > REMATE.startZ || s.z <= REMATE.contactZ) return false;
    if (bt.stun > 0 || bt.vanished || bt.racket) return false;
    if (Math.hypot(bt.x - st.x, (bt.y - st.y) * 1.25) > LOB_SMASH.radius * 1.8) return false;
    if (this.botRemateRoll === null) this.botRemateRoll = Math.random() < 0.55 + 0.45 * this.ai.d;
    return this.botRemateRoll;
  }

  /** El BOT salta con la raqueta arriba y el partido va en cámara lenta mientras "piensa" a dónde rematar. */
  private startBotRemate() {
    const s = this.ball.s;
    const dz = Math.max(0, s.z - REMATE.contactZ);
    const T = clamp((s.vz + Math.sqrt(s.vz * s.vz + 2 * GRAVITY * dz)) / GRAVITY, 0.12, 0.8);
    // cuándo golpea (fracción del cierre del aro): más nivel = más SMASH! (justo al cerrarse)
    const d = this.ai.d;
    const roll = Math.random();
    const hitAt = roll < 0.25 + 0.5 * d ? 1 : roll < 0.6 + 0.3 * d ? rand(0.78, 0.88) : rand(1.12, 1.25);
    // a dónde: lejos de ti (lado contrario) y casi siempre al fondo
    const col: -1 | 1 = this.player.y > LAT_C ? -1 : 1;
    const row: 'short' | 'deep' = Math.random() < 0.7 ? 'deep' : 'short';
    this.botRemate = { t: 0, T, hitAt, col, row };
    this.setSlowMo(clamp(T / REMATE.realS, REMATE.minSlow, 1));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.setSlowMo(1));
    this.bot.ch.remateHold();
    const h = this.headPos(this.bot);
    this.botRemate.label = this.popText(h.x, h.y - 10, 'REMATE', '#ffd23f', 30);
  }

  /** Movimiento del BOT durante su remate: salta y se coloca bajo la pelota (con la forma del movimiento del cerebro). */
  private botRemateMove(dt: number): ReturnType<BotBrain['tick']> {
    const r = this.botRemate!;
    const bt = this.bot;
    const s = this.ball.s;
    bt.lift = REMATE.jump * Math.sin((Math.min(1, r.t / r.T) * Math.PI) / 2);
    const k = Math.min(1, dt * 10);
    bt.x += (clamp(s.x + 16, B_X[0], B_X[1]) - bt.x) * k;
    bt.y += (clamp(s.y, Y_MIN, Y_MAX) - bt.y) * k;
    return { moving: false, dirX: 0, sprint: null, readyToToss: false };
  }

  private tickBotRemate(dt: number) {
    const r = this.botRemate;
    if (!r) return;
    r.t += dt;
    if (r.t / r.T >= r.hitAt) this.botRemateHit();
  }

  /** Golpe del remate del BOT al cuadro elegido de tu campo: SMASH! si fue justo al cierre (más fuerte). */
  private botRemateHit() {
    const r = this.botRemate;
    if (!r) return;
    this.endBotRemate();
    const s = this.ball.s;
    const grade: 'perfect' | 'early' | 'late' = r.hitAt === 1 ? 'perfect' : r.hitAt < 1 ? 'early' : 'late';
    // cuadros de tu campo: los de saque junto a la red y los del fondo (espejo de remateTarget)
    const sl = (NET_X - COURT.left) * 0.538;
    const tx = r.row === 'short' ? NET_X - sl / 2 : NET_X - sl - (NET_X - sl - COURT.left) / 2;
    const ty = r.col < 0 ? (COURT.top + LAT_C) / 2 : (LAT_C + COURT.bottom) / 2;
    const fxDelay = this.bot.ch.swing(true, true, true); // remate con salto (smash-power), desde la pose congelada
    s.z = Math.max(s.z, 22);
    let speed = SHOT_SPEED * REMATE.speed[grade];
    if (this.zone.active('bot')) speed *= ZONE.shotMult * this.zoneStatMultiplier('bot', 'strength');
    if (this.zone.active('player')) speed *= 1 - zoneStatPercent(this.zoneLevels.player.resistance);
    aimShot(s, tx, ty, speed, REMATE.margin);
    this.ball.setPower(false);
    if (this.smashArmed) this.ball.setIgnited(true); // tu ESPECIAL sigue armado
    this.ball.setKind('normal', true);
    this.lastHitter = 'bot';
    this.bounces = 0;
    this.ai.onBotHit();
    this.hitFxAt(fxDelay, s.x, s.y, s.z, false, 1);
    this.tweens.add({ targets: this.bot, lift: 0, duration: 320, ease: 'Quad.easeIn' });
    const p = project(s.x, s.y, s.z);
    this.time.delayedCall(fxDelay, () => {
      this.cameras.main.shake(grade === 'perfect' ? 240 : 150, grade === 'perfect' ? 0.017 : 0.01);
      if (grade === 'perfect') {
        superSmashFx(this, p.sx, p.sy);
        this.ball.setImpactTrail(1, 0xffd23f);
      } else this.ball.setImpactTrail(0.9, 0xffffff);
    });
    if (grade === 'perfect') {
      const h = this.headPos(this.bot);
      this.popText(h.x, h.y - 30, 'SMASH!', '#ff9aa3', 44);
    }
  }

  private endBotRemate() {
    const r = this.botRemate;
    if (!r) return;
    this.botRemate = null;
    if (r.label?.active) {
      this.tweens.killTweensOf(r.label);
      r.label.destroy();
    }
    this.setSlowMo(1);
  }

  // ================================================================ RAQUETA PERDIDA (ULTI recibida)
  /**
   * La ULTI recibida hace volar la raqueta: cae a la izquierda o a la derecha de quien la recibe (dentro de su campo) y
   * queda en el suelo, marcada con un aro. Sin ella no se devuelve ninguna pelota ni se usan habilidades; se recupera
   * pasando por encima (RACKET_LOSS.pickR) y vuelve sola al empezar el punto siguiente. `at` = dónde cae (red: lo
   * decide el teléfono del que la pierde).
   */
  private loseRacket(a: Actor, at?: { x: number; y: number }) {
    this.clearRacket(a);
    const R = RACKET_LOSS;
    let pos = at;
    if (!pos) {
      const half = a === this.player ? P_X : B_X;
      const room = (sd: number) => (sd > 0 ? COURT.bottom - 12 - a.y : a.y - COURT.top - 12);
      let side = Math.random() < 0.5 ? -1 : 1;
      if (room(side) < R.side[0]) side = -side; // pegado a una banda: cae hacia el otro lado
      pos = {
        x: clamp(a.x + rand(-R.depth, R.depth), half[0], half[1]),
        y: clamp(a.y + side * rand(R.side[0], R.side[1]), COURT.top + 12, COURT.bottom - 12),
      };
    }
    const to = pos;
    ensureLooseRacket(this);
    const from = this.headPos(a);
    const feet = project(a.x, a.y);
    const p = project(to.x, to.y);
    const hPx = Math.max(24, (feet.sy - from.y) * 0.42); // ~42 % del alto del personaje
    const col = a === this.player ? 0xffd23f : 0xff6b78;
    const mark = this.add.ellipse(p.sx, p.sy, hPx * 1.3, hPx * 0.45).setStrokeStyle(3, col, 0.9).setFillStyle(col, 0.15).setDepth(p.sy - 0.5).setAlpha(0);
    const img = this.add.image(from.x, from.y, LOOSE_RACKET).setDepth(p.sy + 0.5);
    img.setScale(hPx / img.height);
    // vuelo en arco girando y queda tumbada en el suelo
    const t = { k: 0 };
    const x0 = from.x;
    const y0 = from.y;
    const y1 = p.sy - hPx * 0.2;
    this.tweens.add({
      targets: t,
      k: 1,
      duration: R.flyMs,
      ease: 'Sine.easeOut',
      onUpdate: () => img.setPosition(x0 + (p.sx - x0) * t.k, y0 + (y1 - y0) * t.k - Math.sin(t.k * Math.PI) * hPx * 1.6),
    });
    this.tweens.add({ targets: img, angle: (to.y > a.y ? 1 : -1) * (720 + 80), duration: R.flyMs, ease: 'Quad.easeOut' });
    this.time.delayedCall(R.flyMs, () => {
      if (!mark.active) return;
      mark.setAlpha(1);
      this.tweens.add({ targets: mark, scale: { from: 0.85, to: 1.15 }, alpha: { from: 1, to: 0.5 }, duration: 500, yoyo: true, repeat: -1 });
      this.dustFx(to.x, to.y);
    });
    a.racket = { x: to.x, y: to.y, img, mark };
    if (a === this.player) this.net?.sendAction('racket', { lost: true, x: to.x, y: to.y });
  }

  /** Quita la raqueta del suelo (sin aviso). */
  private clearRacket(a: Actor) {
    const r = a.racket;
    if (!r) return;
    a.racket = null;
    this.tweens.killTweensOf(r.img);
    this.tweens.killTweensOf(r.mark);
    r.img.destroy();
    r.mark.destroy();
  }

  /** La recoge: vuelve a golpear y a tener habilidades. */
  private recoverRacket(a: Actor) {
    if (!a.racket) return;
    this.clearRacket(a);
    const h = this.headPos(a);
    this.popText(h.x, h.y - 10, '¡RAQUETA!', a === this.player ? '#7ff0ff' : '#ff9aa3', 26);
    if (a === this.player) {
      navigator.vibrate?.(30);
      this.net?.sendAction('racket', { lost: false });
    }
  }

  /** Cada fotograma: quien pasa por encima de su raqueta (ya sin aturdido) la recupera. El rival en red avisa él. */
  private racketPickup() {
    for (const a of [this.player, this.bot]) {
      const r = a.racket;
      if (!r || a.stun > 0 || a.vanished || (a === this.bot && this.net)) continue;
      if (Math.hypot(a.x - r.x, a.y - r.y) <= RACKET_LOSS.pickR) this.recoverRacket(a);
    }
  }

  /** El BOT sin raqueta corre hacia ella (a su velocidad); devuelve el movimiento con la forma del del cerebro. */
  private botFetchRacket(dt: number): ReturnType<BotBrain['tick']> {
    const bt = this.bot;
    const r = bt.racket!;
    const dx = r.x - bt.x;
    const dy = r.y - bt.y;
    const d = Math.hypot(dx, dy);
    const step = Math.min(d, this.ai.speed * dt);
    if (d > 0.5) {
      bt.x += (dx / d) * step;
      bt.y += (dy / d) * step;
    }
    return { moving: d > 0.5, dirX: Math.sign(dy), sprint: null, readyToToss: false };
  }

  // ================================================================ ZONA (remontada)
  /** Entra en Zona: aura + rayo en los ojos durante 2 puntos (logic/Zone.ts). */
  private zoneStart(side: ZoneSide) {
    this.zoneFx[side]?.start();
    // destello azul eléctrico
    const W = this.scale.width;
    const H = this.scale.height;
    const fl = this.add.rectangle(0, 0, W, H, 0x5fd4ff, 0.3).setOrigin(0).setScrollFactor(0).setDepth(6000).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: fl, alpha: 0, duration: 500, onComplete: () => fl.destroy() });
    if (side === 'player') navigator.vibrate?.(80);
  }

  /** Dibuja el aura y el rayo de quien esté en Zona (cada fotograma). */
  private zoneRender(dt: number) {
    for (const side of ['player', 'bot'] as ZoneSide[]) {
      // aura de llamas (HyperAura) mientras dure la ZONA de ese lado; en azul eléctrico como la Zona
      const aura = side === 'player' ? this.aura : this.botAura;
      const inZone = this.zone.active(side);
      if (aura && inZone && !aura.active) aura.start('ice');
      else if (aura && !inZone && aura.active) aura.stop();
      const fx = this.zoneFx[side];
      if (!fx?.active) continue;
      const a = side === 'player' ? this.player : this.bot;
      const p = project(a.x, a.y);
      const look = side === 'player' ? a.ch.facing : -a.ch.facing;
      fx.update(dt, this.headPos(a), { x: p.sx, y: p.sy }, p.s * VIEW.CHAR_K, a.ch.depth, look >= 0 ? 1 : -1);
    }
  }

  // ================================================================ partido en red (multijugador 1v1)
  // Autoridad por posesión (docs/MULTIJUGADOR.md): cada teléfono ejecuta este mismo motor con su jugador
  // abajo; el rival es el "bot" sin IA. Los golpes propios se envían (la pelota resultante) y los del rival
  // se aplican como un golpe del bot. La pelota tiene UN juez: quien la recibe decide punto / falta / let.

  /** Conecta la sesión: callbacks del rival y empieza la presentación cuando los dos están listos. */
  private netSetup() {
    const net = this.net!;
    this.botName = net.opponent.name;
    let introStarted = false;
    let aborted = false;
    const intro = () => {
      if (introStarted || aborted || !this.scene.isActive()) return;
      introStarted = true;
      playMatchIntro(this, () => {
        this.startPoint();
        this.launchBird();
      });
    };
    /** El partido no llegó a empezar (abandono, desconexión o sin salida a tiempo): aviso y vuelta al menú, sin resultado. */
    const abortPreStart = (msg: string) => {
      if (introStarted || aborted) return;
      aborted = true;
      this.phase = 'over';
      this.banner(msg, '#ffd23f', 50, 1400);
      this.time.delayedCall(1800, () => this.scene.start('Menu'));
    };
    // LOG de diagnóstico al servidor (logs/matches): eventos, golpes / avisos y anomalías de sprites
    this.diag = netLogOn() ? new MatchDiag((e) => net.sendLog(e)) : null;
    this.diagReset();
    if (this.diag) {
      const d = this.diag;
      net.trace = (dir, type, kind, extra) => d.log(dir, { type, kind, phase: this.phase, ...extra });
      d.log('session', { role: net.role, me: getProfile().name, skin: getProfile().skin, rival: net.opponent.name, rivalSkin: net.opponent.skin, ua: navigator.userAgent.slice(0, 80) });
    }
    net.attach({
      onStart: intro,
      onState: (st) => {
        this.netLastMsgAt = performance.now();
        this.netRemote = st;
        this.diagStateAt = performance.now();
        this.netInterp.push(st.t, performance.now(), st);
      },
      onHit: (h) => {
        this.netLastMsgAt = performance.now();
        this.netApplyHit(h, performance.now());
      },
      onAction: (a) => {
        this.netLastMsgAt = performance.now();
        this.netApplyAction(a);
      },
      onPoint: (pm, forMe) => {
        this.netLastMsgAt = performance.now();
        this.netApplyPoint(pm, forMe);
      },
      onScore: () => undefined, // el marcador local ya aplica los mismos puntos; el oficial valida el final
      onOver: (_o, iWon) => {
        if (!introStarted) return abortPreStart('PARTIDO CANCELADO');
        // fin oficial del servidor: si aquí no terminó (mensaje perdido), se termina con su resultado
        if (this.phase !== 'over') this.time.delayedCall(2600, () => this.phase !== 'over' && this.endMatch(iWon));
      },
      onOpponentLeft: (o) => {
        this.netHoldEnd();
        if (!introStarted) return abortPreStart('EL RIVAL ABANDONÓ');
        if (this.phase === 'over') return;
        this.banner(o.reason === 'abandon' ? 'EL RIVAL SE RINDIÓ' : 'RIVAL DESCONECTADO', '#ffd23f', 52, 1200);
        this.time.delayedCall(1500, () => this.phase !== 'over' && this.endMatch(true));
      },
      // RECONEXIÓN: pausa con aviso mientras uno de los dos vuelve; al volver se rejuega el punto en curso
      onReconnecting: () => this.netHold('RECONECTANDO…'),
      onReconnected: (sc) => this.netResume(sc),
      onOpponentAway: () => this.netHold('RIVAL RECONECTANDO…'),
      onOpponentBack: (sc) => this.netResume(sc),
      onDisconnect: () => {
        this.netHoldEnd();
        if (!introStarted) return abortPreStart('SIN CONEXIÓN');
        if (this.phase === 'over') return;
        this.banner('SIN CONEXIÓN', '#ff7a85', 56, 1200);
        this.time.delayedCall(1500, () => this.phase !== 'over' && this.endMatch(false));
      },
    });
    // tiempo máximo de espera de la salida (el servidor la da al estar los dos o a los 12 s)
    this.time.delayedCall(NET_START_WAIT_MS, () => {
      if (introStarted || aborted) return;
      net.leave();
      abortPreStart('NO SE PUDO INICIAR');
    });
    // fin de la escena = fin de la sesión de red (quita todas las escuchas)
    this.events.once('shutdown', () => {
      this.diag?.log('end', { phase: this.phase });
      this.diag?.flush();
      net.trace = null;
      net.dispose();
    });
  }

  /**
   * ¿Este teléfono NO decide este resultado? (lo decide el juez y llegará por red). Si lo decide, lo envía.
   * Juez: de la pelota del rival, este teléfono; de la propia, el rival. Faltas de lanzamiento: quien saca.
   */
  private netGate(kind: PointMsg['kind'], w?: Who, reason = '', color = ''): boolean {
    if (!this.net || this.netApplying) return false;
    const authority = this.netForceAuthority || this.lastHitter === 'bot';
    if (!authority) return true;
    this.net.sendPoint(kind, w === 'player', reason, color, [this.score.games[0], this.score.games[1]]);
    return false;
  }

  /** Envía el golpe / saque propio con la pelota ya calculada. */
  private netFlushHit() {
    if (!this.net || !this.netHitPending) return;
    this.netHitPending = false;
    const s = this.ball.s;
    // datos reales que guardó el golpe (playerHit / executeServe / playerLunge / playerImpact); sin ellos, los de siempre
    const i = this.netHit;
    this.netHit = {};
    this.net.sendHit({
      t: performance.now(), // hora del golpe en su reloj real (el mismo de game:state): el rival mide cuánto tardó
      kind: this.serving ? 'serve' : 'hit',
      ball: { x: s.x, y: s.y, z: s.z, vx: s.vx, vy: s.vy, vz: s.vz, damp: s.damp, fric: s.fric, ay: s.ay },
      x: this.player.x,
      y: this.player.y,
      shotKind: this.ball.shotKind,
      power: this.ball.power,
      inferno: this.infernoFlight,
      charged: i.charged ?? false,
      overhead: i.overhead ?? s.z > OVERHEAD_Z,
      volley: i.volley ?? false,
      ...(i.serveSpin ? { serveSpin: true } : {}),
      ...(i.special ? { special: true } : {}),
      ...(i.shock ? { shock: true } : {}),
      ...(i.lunge ? { lunge: i.lunge } : {}),
      ...(i.impact ? { impact: true } : {}),
    });
  }

  /** Estado propio para el rival (~20 Hz). */
  private netSendState() {
    if (!this.net) return;
    const now = this.time.now;
    if (now - this.netStateAt < 50) return;
    const pl = this.player;
    const dx = pl.y - this.netPrev.y; // en pantalla, derecha = +y de la cancha
    const moving = Math.hypot(pl.x - this.netPrev.x, dx) > 0.6;
    const dirX = Math.abs(dx) > 0.3 ? Math.sign(dx) : 0;
    const st = { x: pl.x, y: pl.y, moving, dirX, facing: pl.ch.facing, charging: this.charging, stunned: pl.stun > 0 };
    // quieto y sin cambios: solo un latido cada 250 ms (en vez de 20 mensajes por segundo)
    const l = this.netLastState;
    const same = !!l && l.x === st.x && l.y === st.y && l.moving === st.moving && l.dirX === st.dirX && l.facing === st.facing && l.charging === st.charging && l.stunned === st.stunned;
    if (same && now - this.netStateAt < 250) return;
    this.netStateAt = now;
    this.netPrev = { x: pl.x, y: pl.y };
    this.netLastState = st;
    this.net.sendState({ t: performance.now(), ...st }); // reloj real: el del juego se frena en cámara lenta / pausa
  }

  /** El rival se mueve hacia su último estado conocido (suavizado). */
  private netBotTick(dt: number) {
    const bt = this.bot;
    // DASH del rival en curso: sus 3 sombras mientras corre; por seguridad se corta solo si no llega el fin
    const d = this.netBotDash;
    if (d) {
      d.t += dt;
      if (d.ghosts < 3 && d.t >= 0.09 * (d.ghosts + 1)) {
        this.renderActors();
        this.dashFx.ghost(bt.ch, d.ghosts, bt.ch.depth);
        d.ghosts++;
      }
      if (d.t > 1.4) {
        bt.ch.setSprint(false);
        this.netBotDash = null;
      }
    }
    if (bt.stun > 0) bt.stun -= dt; // aturdido por una bola de fuego (aviso 'stunned'): las estrellas duran lo mismo que en su teléfono
    // SOMBRA / SUPERSALTO del rival: manda sobre su posición mientras dura
    if (this.netBotFlyTick(dt)) {
      this.rivalChargeT = 0;
      this.rivalChargeFx(dt);
      return;
    }
    // estirada / DESTELLO / teletransporte del rival en curso: su animación manda sobre la posición
    if (performance.now() < this.netBotLockUntil) {
      this.rivalChargeT = 0;
      this.rivalChargeFx(dt);
      return;
    }
    // posición interpolada entre sus estados reales (net/interp.ts); sin estados aún, la última conocida
    const smp = this.netInterp.sample(performance.now());
    const r = smp?.snap ?? this.netRemote;
    if (smp) {
      bt.x = smp.x;
      bt.y = smp.y;
    } else if (this.netRemote) {
      const k = Math.min(1, dt * 14);
      bt.x += (this.netRemote.x - bt.x) * k;
      bt.y += (this.netRemote.y - bt.y) * k;
    }
    // REMATE del rival: se coloca bajo la pelota con la raqueta arriba (pose remateHold) y el aro se cierra sobre la pelota
    if (this.netRemateOn) {
      this.netRemateT += dt;
      if (this.netRemateRing) this.drawRemateRing(this.netRemateRing, this.netRemateT / this.netRemateDur);
      this.rivalChargeT = 0;
      this.rivalChargeFx(dt);
      return; // sin setMoving / setCharging: romperían la pose de remate (su teléfono lo mueve hacia la pelota)
    }
    // fin del punto / partido: su reacción (celebra / se lamenta, victoria / derrota) no se corta con la carrera
    // (la interpolación aún lo mueve unos ms y eso la cancelaba: se veía otra animación)
    if (r && (this.phase === 'pointover' || this.phase === 'over')) {
      // deja de correr (si no, se queda la carrera congelada); su reacción (estado ocupado) no se corta con esto
      bt.ch.setMoving(false, 0);
      bt.ch.setCharging(false);
      this.rivalChargeT = 0;
      this.rivalChargeFx(dt);
      return;
    }
    if (r) {
      // carrera al ritmo de su velocidad real (como la tuya: PlayerMotion.runAnimRate)
      const speedK = smp ? smp.speed / PLAYER_SPEED : undefined;
      const moving = smp ? r.moving || smp.speed > PLAYER_SPEED * MOTION.moveMin : r.moving;
      // ya no remata y se mueve: si su pose de remate quedó sin golpe (no llegó o fue al aire), se suelta para correr
      if (moving) bt.ch.releaseRemate();
      bt.ch.setMoving(moving, r.dirX, moving && speedK !== undefined ? Math.max(speedK, MOTION.moveMin) : speedK);
      bt.ch.setCharging(r.charging && !moving);
      if (r.charging && !moving) this.rivalChargeT += dt;
      else this.rivalChargeT = 0;
    } else this.rivalChargeT = 0;
    this.rivalChargeFx(dt);
    this.updateFacing(bt);
  }

  /**
   * Nota del golpe del rival (aviso 'timing'): su ¡PERFECTO! / BIEN / PRONTO / TARDE y su RACHA ×N sobre su personaje,
   * en el instante de su contacto. Solo se ve y se oye: sin vibración ni temblor (eso es para quien golpea).
   */
  private netRemoteTiming(d: ActionMsg['data']) {
    const g = d?.grade;
    if (g !== 'perfect' && g !== 'good' && g !== 'early' && g !== 'late') return;
    const n = Math.floor(Number(d?.streak) || 0);
    const at = clamp(Number(d?.ms) || 0, 0, 400);
    this.time.delayedCall(at, () => {
      const head = this.headPos(this.bot);
      const b = project(this.ball.s.x, this.ball.s.y, this.ball.s.z);
      playTimingFx(this, g, head, { x: b.sx, y: b.sy }, true);
      if (g === 'perfect' && n >= TIMING.streak.from) playStreakFx(this, n, head);
    });
  }

  /** aviso RECONECTANDO… en pantalla (partido en pausa) */
  private netHoldUi: Phaser.GameObjects.Container | null = null;

  /**
   * RECONEXIÓN: el partido se congela (física, relojes y controles) con un aviso en el centro mientras este teléfono
   * o el rival vuelve a conectarse. Lo termina netResume (volvió) o el fin del partido.
   */
  private netHold(text: string) {
    if (this.phase === 'over') return;
    this.stopCharge();
    this.joy.release();
    this.joy.enabled = false;
    this.paused = true;
    this.time.paused = true;
    if (this.netWeak) {
      this.netWeak.destroy();
      this.netWeak = null;
    }
    this.netHoldUi?.destroy();
    const W = this.scale.width;
    const H = this.scale.height;
    const c = this.add.container(W / 2, H * 0.42).setScrollFactor(0).setDepth(7900);
    const g = this.add.graphics();
    g.fillStyle(0x02060f, 0.82).fillRoundedRect(-230, -70, 460, 140, 22);
    g.lineStyle(3, 0xffc42e, 0.9).strokeRoundedRect(-230, -70, 460, 140, 22);
    const title = this.add.text(0, -18, text, { fontFamily: '"Lilita One", "Arial Black", sans-serif', fontSize: '34px', color: '#ffd23f', stroke: '#0a1638', strokeThickness: 6 }).setOrigin(0.5);
    const sub = this.add.text(0, 30, 'El partido sigue al volver la conexión', { fontFamily: '"Lilita One", "Arial Black", sans-serif', fontSize: '18px', color: '#cfe0ff' }).setOrigin(0.5);
    c.add([g, title, sub]);
    c.setScale(0.8).setAlpha(0);
    this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
    this.tweens.add({ targets: title, alpha: { from: 1, to: 0.45 }, duration: 600, yoyo: true, repeat: -1 });
    this.netHoldUi = c;
  }

  /** Quita el aviso y descongela (sin tocar el punto). */
  private netHoldEnd() {
    if (this.netHoldUi) {
      const c = this.netHoldUi;
      this.netHoldUi = null;
      this.tweens.killTweensOf(c);
      c.list.forEach((o) => this.tweens.killTweensOf(o));
      c.destroy();
    }
    if (this.paused && !this.dialog.length) {
      this.paused = false;
      this.time.paused = false;
      this.joy.enabled = true;
    }
  }

  /**
   * Volvió la conexión (de este teléfono o del rival): marcador OFICIAL del servidor y se REJUEGA el punto en curso
   * desde el saque (los dos teléfonos hacen lo mismo, así quedan iguales aunque se perdiera algún mensaje).
   */
  private netResume(sc: ScoreMsg) {
    this.netHoldEnd();
    if (this.phase === 'over' || !this.net) return;
    const host = this.net.role === 'host';
    this.score.points = host ? [sc.points.host, sc.points.guest] : [sc.points.guest, sc.points.host];
    this.score.games = host ? [sc.games.host, sc.games.guest] : [sc.games.guest, sc.games.host];
    this.updateHud();
    this.netInterp.clear();
    this.netLastMsgAt = performance.now();
    this.netPendingToss = null;
    this.faults = 0;
    if (this.cine.active) this.cine.cancel(); // una cinemática a medias no sigue en el punto repetido
    showCallout(this, 'SE REPITE EL PUNTO', 0xffc42e, 900);
    this.phase = 'pointover';
    this.startPoint();
  }

  /** último mensaje del rival (performance.now): sin mensajes > NET_WEAK_MS = señal débil */
  private netLastMsgAt = 0;
  /** icono de señal débil sobre el rival (null = no se muestra) */
  private netWeak: Phaser.GameObjects.Container | null = null;

  /** ¿Señal débil? Más de 1 s sin ningún mensaje del rival (su estado llega al menos cada 250 ms aunque esté quieto). */
  private netSignalWeak() {
    if (this.phase === 'over' || this.phase === 'intro' || this.netRemoteCine || this.cine.active || this.paused) return false;
    return performance.now() - this.netLastMsgAt > 1000;
  }

  /** Muestra / quita el icono de señal débil sobre el rival y lo deja quieto (sin correr en el sitio). */
  private netSignalTick() {
    const weak = this.netSignalWeak();
    if (weak) {
      this.bot.ch.setMoving(false, 0);
      this.bot.ch.setCharging(false);
      if (!this.netWeak) this.netWeak = this.makeWeakSignalIcon();
      const h = this.headPos(this.bot);
      this.netWeak.setPosition(h.x, h.y - 46);
    } else if (this.netWeak) {
      const w = this.netWeak;
      this.netWeak = null;
      this.tweens.killTweensOf(w);
      this.tweens.add({ targets: w, alpha: 0, scale: 0.6, duration: 180, onComplete: () => w.destroy() });
    }
  }

  /** Icono de señal débil: 4 barras (solo la primera encendida, en rojo) y "SEÑAL DÉBIL", latiendo. */
  private makeWeakSignalIcon() {
    const c = this.add.container(0, 0).setDepth(4500);
    const g = this.add.graphics();
    g.fillStyle(0x0a1638, 0.85).fillRoundedRect(-62, -24, 124, 46, 12);
    g.lineStyle(2, 0xff5a6a, 0.9).strokeRoundedRect(-62, -24, 124, 46, 12);
    for (let i = 0; i < 4; i++) {
      const h = 6 + i * 5;
      g.fillStyle(i === 0 ? 0xff5a6a : 0x4a5674, 1).fillRect(-50 + i * 8, 6 - h, 5, h);
    }
    const txt = this.add.text(14, -1, ['SEÑAL', 'DÉBIL'], { fontFamily: '"Lilita One", "Arial Black", sans-serif', fontSize: '14px', color: '#ffb3ba', align: 'center', lineSpacing: -4 }).setOrigin(0.5);
    c.add([g, txt]);
    c.setScale(0.6).setAlpha(0);
    this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({ targets: c, alpha: { from: 1, to: 0.55 }, duration: 500, yoyo: true, repeat: -1, delay: 220 });
    return c;
  }

  /** instante (performance.now) de la última estirada del rival que llegó con su aviso: su golpe no la repite */
  private netLungeAt = -1e9;

  /** ESTIRADA del rival al empezar (aviso 'lunge'): se tira hacia el mismo lado y llega al punto a la vez que él. */
  private netRemoteLunge(d: ActionMsg['data']) {
    const from = this.netBotPos(d?.x, d?.y);
    const to = this.netBotPos(d?.tx, d?.ty);
    const side = -Math.sign(Number(d?.side) || 1); // su derecha es nuestra izquierda
    if (!from || !to || this.phase !== 'rally') return;
    const bt = this.bot;
    const ms = clamp(Number(d?.ms) || 200, 60, 600);
    this.tweens.killTweensOf(bt);
    bt.x = from.x;
    bt.y = from.y;
    bt.ch.facing = side;
    if (!bt.ch.lunge(side)) bt.ch.swing();
    this.dustFx(bt.x, bt.y);
    this.netLungeAt = performance.now();
    this.netBotLockUntil = performance.now() + ms + 40;
    this.tweens.add({
      targets: bt,
      x: to.x,
      y: to.y,
      duration: ms,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.dustFx(to.x, to.y);
        this.netAnchor(to.x, to.y);
      },
    });
  }

  /** ida y vuelta medida con 'ping' / 'pong' (ms, suavizado; 0 = aún sin medir) */
  private netRtt = 0;
  private netPingAt = 0;

  /** Cada ~2 s: 'ping' con la hora local; el rival responde 'pong' con la misma hora y aquí sale la ida y vuelta. */
  private netPingTick() {
    const now = performance.now();
    if (now - this.netPingAt < 2000) return;
    this.netPingAt = now;
    this.net?.sendAction('ping', { t: now });
  }

  private netOnPong(t: number) {
    const rtt = performance.now() - t;
    if (!Number.isFinite(rtt) || rtt < 0 || rtt > 3000) return;
    this.netRtt = this.netRtt ? this.netRtt + (rtt - this.netRtt) * 0.3 : rtt;
  }

  /**
   * Cuánto tardó en llegar este golpe (s): lo que tardó por encima del mensaje más rápido (hora del golpe en su reloj
   * frente al desfase mínimo de sus estados) + el mínimo de la red (media ida y vuelta). Acotado a 0..0,25 s.
   */
  private netHitDelay(h: HitMsg, recvAt: number): number {
    const off = this.netInterp.minOffset;
    const half = this.netRtt ? Math.min(0.25, this.netRtt / 2000) : 0;
    if (typeof h.t !== 'number' || off === null) return half;
    const extra = recvAt - h.t - off;
    // hora absurda (recortada por un servidor antiguo, reloj raro): solo la media ida y vuelta
    if (!Number.isFinite(extra) || extra < -50 || extra > 1500) return half;
    const base = this.netRtt / 2;
    return clamp((extra + base) / 1000, 0, 0.25);
  }

  /**
   * Avanza la pelota recién recibida `sec` segundos con la misma física, pero se para ANTES de su primer bote o de la
   * red: esos eventos los decide el juego normal (punto, falta, bote del saque), aquí solo se recupera el tiempo perdido.
   */
  private netAdvanceBall(sec: number) {
    if (sec <= 0.005) return;
    const s = this.ball.s;
    const dt = 1 / 240;
    for (let t = 0; t + dt <= sec; t += dt) {
      const test = { ...s };
      const ev = stepBall(test, dt);
      if (ev) break;
      Object.assign(s, test);
    }
  }

  // ---------------------------------------------------------------- LOG de diagnóstico (red)
  private diag: MatchDiag | null = null;
  private diagSnapAt = 0;
  private diagMvAt = 0;
  private diagStateAt = 0;
  private diagPrev = { x: 0, y: 0 };
  private diagRunStill = 0;
  private diagRunLogged = false;
  private diagNoStateLogged = false;
  /** por qué se movió el rival de golpe en este fotograma (anchor, hit, warp…) */
  private diagCause = '';
  private diagStuck: Record<'player' | 'bot', { state: string; t: number; logged: boolean }> = {
    player: { state: '', t: 0, logged: false },
    bot: { state: '', t: 0, logged: false },
  };

  private diagReset() {
    this.diagSnapAt = 0;
    this.diagStateAt = performance.now();
    this.diagPrev = { x: this.bot?.x ?? 0, y: this.bot?.y ?? 0 };
    this.diagRunStill = 0;
    this.diagRunLogged = false;
    this.diagNoStateLogged = false;
    this.diagCause = '';
    this.diagStuck = { player: { state: '', t: 0, logged: false }, bot: { state: '', t: 0, logged: false } };
  }

  private diagBotPos() {
    return `${Math.round(this.bot.x)},${Math.round(this.bot.y)}`;
  }

  /** Foto de un personaje para el log: posición, estado del sprite, clip y frame. */
  private diagActor(a: Actor) {
    const d = a.ch.debugInfo();
    return `${Math.round(a.x)},${Math.round(a.y)} ${d ? `${d.state}/${d.anim}#${d.frame}${d.paused ? ' P' : ''}` : '-'}${a.stun > 0 ? ' stun' : ''}${a.vanished ? ' vanish' : ''}${a.lift ? ` lift${Math.round(a.lift)}` : ''}`;
  }

  /**
   * Cada fotograma en red: foto cada 1 s y detección de anomalías del rival (corre sin moverse, saltos de posición,
   * estados que no terminan, sin estados) y del jugador (estados que no terminan).
   */
  private diagTick(dt: number) {
    const d = this.diag;
    if (!d) return;
    const now = performance.now();
    const bt = this.bot;
    // MOVIMIENTO cada 100 ms (LOG-PARTIDO): dónde se dibuja cada uno, su animación y cuánto va el rival por detrás de su
    // último estado recibido (lag); con esto se ve de dónde sale cualquier salto
    if (now >= this.diagMvAt && (this.phase === 'rally' || this.phase === 'serve' || this.phase === 'toss')) {
      this.diagMvAt = now + 100;
      const r = this.netRemote;
      const ib = bt.ch.debugInfo();
      const ip = this.player.ch.debugInfo();
      const b = this.ball.s;
      d.log('mv', {
        me: `${Math.round(this.player.x)},${Math.round(this.player.y)}`,
        meA: ip ? `${ip.state}/${ip.anim}#${ip.frame}` : undefined,
        rv: `${Math.round(bt.x)},${Math.round(bt.y)}`,
        rvA: ib ? `${ib.state}/${ib.anim}#${ib.frame}${ib.paused ? 'P' : ''}` : undefined,
        rvNet: r ? `${Math.round(r.x)},${Math.round(r.y)}${r.moving ? ' mov' : ''}${r.charging ? ' carga' : ''}` : '-',
        lag: r ? Math.round(Math.hypot(r.x - bt.x, r.y - bt.y)) : undefined,
        age: Math.round(now - this.diagStateAt),
        ball: `${Math.round(b.x)},${Math.round(b.y)},${Math.round(b.z)}`,
        lock: this.netBotLockUntil > now ? 1 : undefined,
      });
    }
    if (now >= this.diagSnapAt) {
      this.diagSnapAt = now + 1000;
      const b = this.ball.s;
      d.log('snap', {
        phase: this.phase,
        srv: this.server,
        me: this.diagActor(this.player),
        rival: this.diagActor(bt),
        ball: `${Math.round(b.x)},${Math.round(b.y)},${Math.round(b.z)} v${Math.round(b.vx)},${Math.round(b.vy)},${Math.round(b.vz)}`,
        hitter: this.lastHitter ?? '-',
        rMoving: this.netRemote?.moving,
        stateAge: Math.round(now - this.diagStateAt),
        rtt: Math.round(this.netRtt),
        lock: this.netBotLockUntil > now,
        remate: this.netRemateOn,
        cine: this.cine.active,
      });
    }
    // sin estados del rival
    if (now - this.diagStateAt > 500 && this.phase !== 'over') {
      if (!this.diagNoStateLogged) d.log('no-state', { age: Math.round(now - this.diagStateAt), phase: this.phase, rival: this.diagActor(bt) });
      this.diagNoStateLogged = true;
    } else this.diagNoStateLogged = false;
    // salto de posición del rival en un fotograma
    const moved = Math.hypot(bt.x - this.diagPrev.x, bt.y - this.diagPrev.y);
    if (moved > 60) d.log('teleport', { dist: moved, from: `${Math.round(this.diagPrev.x)},${Math.round(this.diagPrev.y)}`, to: this.diagBotPos(), cause: this.diagCause || '?', phase: this.phase, rival: this.diagActor(bt) });
    this.diagPrev = { x: bt.x, y: bt.y };
    this.diagCause = '';
    // corre sin moverse (clip de carrera y < ~6 u/s durante > 300 ms)
    const info = bt.ch.debugInfo();
    const running = !!info && /run|walk|dash/.test(info.anim);
    if (running && moved < 0.1 * Math.max(dt * 60, 1)) {
      this.diagRunStill += dt;
      if (this.diagRunStill > 0.3 && !this.diagRunLogged) {
        this.diagRunLogged = true;
        d.log('run-in-place', { still: this.diagRunStill * 1000, phase: this.phase, rival: this.diagActor(bt), rMoving: this.netRemote?.moving, stateAge: Math.round(now - this.diagStateAt), lock: this.netBotLockUntil > now });
      }
    } else {
      this.diagRunStill = 0;
      this.diagRunLogged = false;
    }
    // estados ocupados que no terminan (> 3 s)
    const busy = ['serve', 'remate', 'swing', 'dive', 'stun', 'emote', 'sprint', 'inferno', 'turn', 'land'];
    for (const [who, a] of [['player', this.player], ['bot', bt]] as const) {
      const st = a.ch.debugInfo()?.state ?? '';
      const k = this.diagStuck[who];
      if (st !== k.state) {
        k.state = st;
        k.t = 0;
        k.logged = false;
      } else if (busy.includes(st)) {
        k.t += dt;
        if (k.t > 3 && !k.logged) {
          k.logged = true;
          d.log('stuck', { who, state: st, secs: k.t, phase: this.phase, actor: this.diagActor(a) });
        }
      }
    }
    d.tick(now);
  }

  /** El rival está AHORA en (x, y): la interpolación se muestra desde ahí (golpe, teletransporte, cinemática). */
  private netAnchor(x: number, y: number) {
    this.diagCause = 'anchor';
    const r = this.netRemote;
    this.netInterp.reset(performance.now(), { x, y, moving: false, dirX: 0, facing: r?.facing ?? -1, charging: false, stunned: r?.stunned ?? false });
  }

  /** Carga del rival vista desde aquí: aro en el suelo, brillo del cuerpo y la raqueta y, al máximo, chispas (como las suyas). */
  private rivalChargeFx(dt: number) {
    const bt = this.bot;
    // efecto con sprites (su carga elegida o la de su personaje): aro animado y, al soltar, se disipa
    if (isSpriteCharge(this.rivalChargeKind)) {
      this.rivalChargeSprite.setCharge(this.rivalChargeT > 0 ? Math.min(1, this.rivalChargeT / 1.1) : null);
      const pr = project(bt.x, bt.y);
      this.rivalChargeSprite.render(dt, pr.sx, pr.sy, pr.s, pr.sy);
      this.rivalAura.hide();
      this.rivalSparks.hide();
      this.rivalRing.setVisible(false);
      return;
    }
    if (this.rivalChargeT <= 0) {
      this.rivalAura.hide();
      this.rivalSparks.hide();
      this.rivalRing.setVisible(false);
      return;
    }
    const value = Math.min(1, this.rivalChargeT / 1.1);
    const full = value >= 1;
    const p = project(bt.x, bt.y);
    const k = p.s * VIEW.CHAR_K;
    const pulse = 0.5 + 0.5 * Math.sin(this.time.now / (full ? 70 : 140));
    if (full !== this.rivalRingGold) {
      this.rivalRingGold = full;
      this.rivalRing.setFillStyle(full ? 0xffc72e : 0x6ec1ff, 0.25).setStrokeStyle(5, full ? 0xfff2a8 : 0xd6f0ff, 0.9);
    }
    this.rivalRing
      .setVisible(true)
      .setPosition(p.sx, p.sy)
      .setScale(p.s * (0.55 + 0.55 * value + pulse * 0.06))
      .setAlpha(0.45 + pulse * 0.4)
      .setDepth(p.sy - 0.8);
    this.rivalAura.update(dt, p.sx, p.sy, k, bt.ch.facing, value, p.sy);
    if (full) this.rivalSparks.update(dt, p.sx, p.sy, k);
    else this.rivalSparks.hide();
  }

  /** El rival sacó o golpeó antes de que aquí empezara el punto (retardo): se empieza ya. */
  private netEarlyStart() {
    if (this.phase === 'pointover' || this.phase === 'intro') this.startPoint(this.netNextSecond);
  }

  /** Golpe / saque del rival: se aplica como un golpe del bot (pelota, animación y efectos de siempre). */
  /** `recvAt` = llegada (performance.now); sin él (golpe aplicado tras una cinemática) no se compensa el retraso. */
  private netApplyHit(h: HitMsg, recvAt?: number) {
    if (this.phase === 'over') return;
    this.netRemoteRemate(false); // por si no llegó 'remate-end': su golpe termina la cámara lenta
    this.netEndBotFly(true); // su golpe llegó: la SOMBRA / SUPERSALTO ya terminó en su teléfono
    // el rival está en su cinemática (aquí congelada el mismo tiempo): su golpe se aplica al terminar, una sola vez
    if (this.netRemoteCine) {
      this.netDeferred.push(() => this.netApplyHit(h));
      return;
    }
    this.netEarlyStart();
    this.netApplying = true;
    const bt = this.bot;
    bt.x = h.x;
    bt.y = h.y;
    // golpe: se muestra YA en el punto del contacto (la raqueta coincide con la pelota) y sigue desde ahí
    if (performance.now() >= this.netBotLockUntil) this.netAnchor(h.x, h.y);
    const s = this.ball.s;
    s.x = h.ball.x;
    s.y = h.ball.y;
    s.z = h.ball.z;
    s.vx = h.ball.vx;
    s.vy = h.ball.vy;
    s.vz = h.ball.vz;
    s.damp = h.ball.damp;
    s.fric = h.ball.fric;
    s.ay = h.ball.ay; // curva del saque con efecto (ya espejada por MatchNet)
    // la pelota llega con el retraso de la red: se avanza lo que tardó el mensaje (sin pasar su bote ni la red)
    if (recvAt !== undefined) {
      const adv = this.netHitDelay(h, recvAt);
      this.netAdvanceBall(adv);
      this.diag?.log('hit-apply', { kind: h.kind, adv: adv * 1000, rtt: this.netRtt, off: this.netInterp.minOffset ?? -1, t: h.t, bx: h.x, by: h.y, from: this.diagBotPos() });
    }
    this.diagCause = 'hit';
    // bola de fuego (SMASH / INFERNO del rival): al alcanzarla, el impacto de siempre (aturdido + devolución floja)
    if (h.power && !h.inferno) this.setSmashFlight(this.netRivalSmashEl); // su SMASH, con el poder que armó
    this.ball.setPower(h.power || h.inferno);
    if (!h.power && !h.inferno && this.smashArmed) this.ball.setIgnited(true); // tu ESPECIAL sigue armado
    this.ball.setKind(h.shotKind as ShotKind, h.charged);
    this.ball.setMaxCharge(!!h.shock && !h.power && !h.inferno); // su golpe cargado al máximo se ve igual aquí
    this.lastHitter = 'bot';
    this.bounces = 0;
    this.phase = 'rally';
    let fx: number;
    if (h.kind === 'serve') {
      this.serving = true;
      this.serveLet = false;
      this.serveNetLoss = false;
      this.serveCtl.state = 'SERVE_RESULT';
      this.hideServeHint();
      this.serveAim.setVisible(false);
      fx = bt.ch.swing();
    } else if (h.impact) {
      // devolución floja del impacto de fuego: el aturdido ('stunned') ya se está viendo; sin animación ni destello de golpe
      this.serving = false;
      fx = -1;
    } else if (h.lunge) {
      // estirada: lado espejado (su derecha es nuestra izquierda); sin hoja de estirada, el golpe de siempre
      this.serving = false;
      const side = -Math.sign(h.lunge);
      bt.ch.facing = side;
      // ya se tiró con su aviso 'lunge': no se repite la estirada (solo el efecto del contacto)
      if (performance.now() - this.netLungeAt < 900) fx = 0;
      else fx = bt.ch.lunge(side) ? 0 : bt.ch.swing();
    } else {
      // animación exacta: los mismos datos (cargado / remate / volea / smash) que usó el emisor
      this.serving = false;
      fx = bt.ch.swing(h.power || h.charged, h.overhead, h.special ?? (h.power && h.overhead), h.volley);
    }
    if (fx >= 0) this.hitFxAt(fx, s.x, s.y, s.z, h.power || h.inferno, 0.15, !!h.inferno, h.inferno ? infernoElementFor(this.net?.opponent.skin, this.netRivalInferno) : h.power ? this.netRivalSmashEl : undefined);
    // REMATE del globo del rival: la misma onda, sacudida y, si fue justo al cierre del aro, SMASH! dorado
    const rg = this.netRemateGrade;
    this.netRemateGrade = null;
    if (fx >= 0 && rg) {
      const pr = project(s.x, s.y, s.z);
      this.tweens.add({ targets: bt, lift: 0, duration: 320, ease: 'Quad.easeIn' });
      this.time.delayedCall(fx, () => {
        this.ball.setImpactTrail(rg === 'perfect' ? 1 : 0.9, rg === 'perfect' ? 0xffd23f : 0xffffff);
        this.cameras.main.shake(rg === 'perfect' ? 240 : 150, rg === 'perfect' ? 0.017 : 0.01);
        for (const [d, col] of [[0, 0xffffff], [90, 0xffd23f]] as const) {
          const ring = this.add.ellipse(pr.sx, pr.sy, 40 * pr.s, 26 * pr.s).setStrokeStyle(7 * pr.s, col, 0.95).setDepth(3500).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
          this.tweens.add({ targets: ring, scale: 7, alpha: { from: 0.95, to: 0 }, duration: 480, delay: d, ease: 'Cubic.easeOut', onStart: () => ring.setAlpha(0.95), onComplete: () => ring.destroy() });
        }
        if (rg === 'perfect') {
          superSmashFx(this, pr.sx, pr.sy);
          const hd = this.headPos(bt);
          this.popText(hd.x, hd.y - 30, 'SMASH!', '#ffd23f', 44);
        }
      });
    }
    // cortita cargada del rival: el mismo aviso que ve él sobre su personaje
    if (fx >= 0 && h.charged && h.shotKind === 'drop') {
      this.time.delayedCall(fx, () => {
        const hd = this.headPos(bt);
        this.popText(hd.x, hd.y - 10, 'CORTITA', '#ff9aa3', 30);
      });
    }
    if (fx >= 0 && h.shock) {
      const pc = project(s.x, s.y, s.z);
      this.time.delayedCall(fx, () => {
        shockFx(this, pc.sx, pc.sy, pc.s);
        this.maxContactFlash(pc.sx, pc.sy, pc.s);
      });
    }
    if (h.inferno) {
      // INFERNO DRIVE: esfera de fuego en vuelo, explosión, sacudida y sonido, como en el teléfono del rival
      this.infernoFlight = true;
      this.infernoBounced = false;
      this.ball.quietFx = true;
      // la bola del rival es la de SU poder (llega con 'inferno-cine'); si no llegó, la de su personaje (Mai = hielo)
      this.infernoEl = infernoElementFor(this.net?.opponent.skin, this.netRivalInferno);
      this.fire.setElement(this.infernoEl);
      const b = project(s.x, s.y, s.z);
      infernoImpactFx(this, b.sx, b.sy, b.s, this.infernoEl);
      infernoShake(this);
      infernoSound.impact(this);
    }
    if (h.power || h.inferno) {
    }
    this.netApplying = false;
  }

  private netApplyAction(a: ActionMsg) {
    const bt = this.bot;
    if (a.kind === 'toss') {
      const kind = (a.data?.kind as ServeKind) ?? 'normal';
      this.netEarlyStart();
      if (this.server !== 'bot') return;
      if (this.phase === 'serve') this.beginToss(kind);
      else this.netPendingToss = kind;
    } else if (a.kind === 'lunge') this.netRemoteLunge(a.data);
    else if (a.kind === 'timing') this.netRemoteTiming(a.data);
    else if (a.kind === 'ping') this.net?.sendAction('pong', { t: Number(a.data?.t) || 0 });
    else if (a.kind === 'pong') this.netOnPong(Number(a.data?.t));
    else if (a.kind === 'serve-swing') {
      // golpe del saque del rival: del lanzamiento al clip del golpe y su salto (como en su teléfono)
      if (this.server === 'bot' && this.phase === 'toss') {
        this.bot.ch.serveRelease();
        this.serveJump(this.bot, this.bot.ch.serveContactDelay());
      }
    } else if (a.kind === 'catch') {
      if (this.server === 'bot' && this.phase === 'toss') {
        this.netApplying = true;
        this.catchBall();
        this.netApplying = false;
      }
    } else if (a.kind === 'sprint-start') {
      // DASH del rival: carrera de sprint + el mismo destello y sombras que ve quien lo hace (DashFx)
      bt.ch.setSprint(true, -(Number(a.data?.dirX) || 0));
      const p = project(bt.x, bt.y);
      this.dashFx.burst(p.sx, p.sy, p.s * VIEW.CHAR_K, bt.ch.depth);
      this.dustFx(bt.x, bt.y);
      const h = this.headPos(bt);
      this.popText(h.x, h.y - 10, 'DEFENSIVO', '#c9a4ff', 26);
      this.netBotDash = { t: 0, ghosts: 0 };
    } else if (a.kind === 'sprint-end') {
      bt.ch.setSprint(false, 0, true); // frenada, como en su teléfono
      this.netBotDash = null;
    }
    else if (a.kind === 'defensive') this.netRemoteDefensive(a.data);
    else if (a.kind === 'racket') this.netRemoteRacket(a.data);
    else if (a.kind === 'remate-start') this.netRemoteRemate(true, a.data);
    else if (a.kind === 'remate-end') this.netRemoteRemate(false, a.data);
    else if (a.kind === 'stunned') this.netBotStunned(Number(a.data?.ms));
    else if (a.kind === 'emote') this.emotes.showRemote(String(a.data?.kind ?? ''), () => this.headPos(this.bot));
    else if (a.kind === 'smash-armed') {
      // el rival armó su SMASH: aura con el color de SU poder (sin dato, fuego)
      this.netRivalSmashEl = isSmashPower(a.data?.element) ? a.data.element : 'fire';
      this.powerPulse(this.bot); // el mismo pulso blanco que ve él (el aura de llamas es de la ZONA)
    }
    else if (a.kind === 'smash-disarmed') {
      // nada que apagar: el armado ya solo se marca con el pulso
    } else if (a.kind === 'smash-cine') this.netRemoteSmashCine(a.data);
    else if (a.kind === 'inferno-cine') {
      // poder de su INFERNO (antes de la cinemática: aunque aquí no se pueda mostrar, su bola debe ser la suya)
      const power = a.data?.power;
      this.netRivalInferno = isInfernoPower(power) ? power : null;
      this.netRemoteInfernoCine(a.data);
    }
  }

  /**
   * SOMBRA / SUPERSALTO del rival, visto desde aquí como en su teléfono: SOMBRA = su clon oscuro corre hasta el punto
   * y luego cambian de lugar; SUPERSALTO = salto en parábola con estela y caída con onda de choque.
   */
  private netRemoteDefensive(d: ActionMsg['data']) {
    if (d?.kind === 'blink' || d?.kind === 'warp') {
      this.netRemoteWarp(d);
      return;
    }
    const kind = d?.kind === 'shadow' || d?.kind === 'jump' ? d.kind : null;
    const from = this.netBotPos(d?.x, d?.y);
    const to = this.netBotPos(d?.tx, d?.ty);
    if (!kind || !from || !to || this.phase === 'over') return;
    this.netEndBotFly(false);
    const bt = this.bot;
    const dur = clamp(Number(d?.ms) / 1000 || 0.3, 0.15, 1);
    bt.x = from.x;
    bt.y = from.y;
    bt.ch.setMoving(false, 0);
    bt.ch.setCharging(false);
    const fly: NonNullable<MatchScene['netBotFly']> = { kind, from, to, t: 0, dur, ghosts: 0 };
    const h = this.headPos(bt);
    if (kind === 'shadow') {
      const clone = new Character(this, 0, 0, this.rivalLk(), 'front');
      for (const sp of spritesIn(clone)) sp.setTint(SHADOW.tint);
      clone.setAlpha(SHADOW.alpha);
      clone.setSprint(true, to.y - from.y);
      fly.clone = clone;
      const p = project(bt.x, bt.y);
      this.dashFx.burst(p.sx, p.sy, p.s * VIEW.CHAR_K, bt.ch.depth);
      this.popText(h.x, h.y - 10, 'DEFENSIVO', '#c9a4ff', 26);
    } else {
      this.dustFx(bt.x, bt.y);
      this.popText(h.x, h.y - 10, 'DEFENSIVO', '#c9a4ff', 26);
    }
    this.netBotFly = fly;
    this.netBotFlyTick(0);
  }

  /**
   * DESTELLO / DASH de teletransporte del rival (aviso 'defensive' kind blink | warp): desaparece en su sitio (portal; el
   * DESTELLO además deja estela y sombras por el camino) y reaparece en el punto con otro portal, a los mismos tiempos.
   */
  private netRemoteWarp(d: NonNullable<ActionMsg['data']>) {
    const from = this.netBotPos(d.x, d.y);
    const to = this.netBotPos(d.tx, d.ty);
    if (!from || !to || this.phase === 'over') return;
    const bt = this.bot;
    const blink = d.kind === 'blink';
    const out = clamp(Number(d.out) || 120, 40, 600);
    const inn = clamp(Number(d.in) || 120, 40, 600);
    const delay = clamp(Number(d.delay) || 0, 0, 600);
    const col = blink ? 0x45d9ff : undefined;
    const light = blink ? 0xd9f7ff : undefined;
    this.netEndBotFly(false);
    this.tweens.killTweensOf(bt);
    bt.x = from.x;
    bt.y = from.y;
    bt.ch.setMoving(false, 0);
    bt.ch.setCharging(false);
    this.netBotLockUntil = performance.now() + out + delay + inn + 60;
    if (blink) {
      const a = project(from.x, from.y);
      const b = project(to.x, to.y);
      const k = a.s * VIEW.CHAR_K;
      this.dashFx.burst(a.sx, a.sy, k, bt.ch.depth);
      if (Math.hypot(to.x - from.x, to.y - from.y) > 40) {
        for (let i = 0; i < 3; i++) {
          const f = (i + 1) / 4;
          bt.x = from.x + (to.x - from.x) * f;
          bt.y = from.y + (to.y - from.y) * f;
          this.renderActors();
          this.dashFx.ghost(bt.ch, i, bt.ch.depth);
        }
        bt.x = from.x;
        bt.y = from.y;
        this.renderActors();
      }
      this.dashFx.streak(a.sx, a.sy - 70 * k, b.sx, b.sy - 70 * k, k, bt.ch.depth);
      const h = this.headPos(bt);
      this.popText(h.x, h.y - 10, 'DEFENSIVO', '#c9a4ff', 26);
    }
    this.portalFx(from.x, from.y, col, light);
    this.tweens.add({
      targets: bt,
      warp: 0,
      duration: out,
      ease: 'Quad.easeIn',
      onComplete: () => {
        bt.x = to.x;
        bt.y = to.y;
        this.netAnchor(to.x, to.y);
        if (this.netRemote) this.netRemote = { ...this.netRemote, x: to.x, y: to.y, moving: false };
        this.portalFx(to.x, to.y, col, light);
        this.tweens.add({ targets: bt, warp: 1, duration: inn, delay, ease: 'Back.easeOut' });
      },
    });
  }

  /** Avanza la SOMBRA / SUPERSALTO del rival. true = sigue en curso (manda sobre su posición). */
  private netBotFlyTick(dt: number): boolean {
    const f = this.netBotFly;
    if (!f) return false;
    const bt = this.bot;
    f.t += dt;
    const k = Math.min(1, f.t / f.dur);
    const x = f.from.x + (f.to.x - f.from.x) * k;
    const y = f.from.y + (f.to.y - f.from.y) * k;
    if (f.kind === 'shadow' && f.clone) {
      bt.x = f.from.x;
      bt.y = f.from.y;
      const p = project(x, y);
      f.clone.setPosition(p.sx, p.sy).setScale(p.s * VIEW.CHAR_K).setDepth(p.sy);
      if (f.ghosts < 3 && f.t >= (f.dur / 4) * (f.ghosts + 1)) this.dashFx.ghost(f.clone, f.ghosts++, f.clone.depth);
    } else {
      bt.x = x;
      bt.y = y;
      bt.lift = 4 * JUMP.height * k * (1 - k);
      if (f.ghosts < 3 && k >= (f.ghosts + 1) / 4) {
        this.renderActors();
        this.dashFx.ghost(bt.ch, f.ghosts++, bt.ch.depth);
      }
    }
    if (k < 1) return true;
    this.netEndBotFly(true);
    return false;
  }

  /** Termina la SOMBRA / SUPERSALTO del rival: `arrived` = llegó al punto (cambio de lugar / caída con sus efectos). */
  private netEndBotFly(arrived: boolean) {
    const f = this.netBotFly;
    if (!f) return;
    this.netBotFly = null;
    const bt = this.bot;
    bt.lift = 0;
    if (f.clone) {
      const c = f.clone;
      this.tweens.add({ targets: c, alpha: 0, duration: 160, onComplete: () => c.destroy() });
    }
    if (!arrived) return;
    if (f.kind === 'shadow') {
      this.portalFx(f.from.x, f.from.y, 0x5a32b8, 0xd4bfff);
      this.portalFx(f.to.x, f.to.y, 0x9a6bff, 0xffffff);
    } else this.jumpLandFx(f.to.x, f.to.y, false);
    bt.x = f.to.x;
    bt.y = f.to.y;
    // su próximo estado ya viene desde el punto: sin deslizarse de vuelta mientras llega
    if (this.netRemote) this.netRemote = { ...this.netRemote, x: f.to.x, y: f.to.y, moving: false };
    this.netAnchor(f.to.x, f.to.y);
  }

  /** Posición del rival que llega en un aviso (coordenadas del emisor → espejadas y dentro de su zona). */
  private netBotPos(x: unknown, y: unknown): { x: number; y: number } | null {
    const nx = Number(x);
    const ny = Number(y);
    if (!Number.isFinite(nx) || !Number.isFinite(ny)) return null;
    return { x: clamp(mirrorX(nx), B_X[0], B_X[1]), y: clamp(mirrorY(ny), Y_MIN, Y_MAX) };
  }

  /**
   * Termina la cinemática del rival: vuelve el aura y se aplican, en orden, los avisos que llegaron durante
   * ella (su golpe incluido). `drop` = cancelada (cambio de escena): se descartan.
   */
  private netEndRemoteCine(drop = false) {
    this.netRemoteCine = false;
    const todo = this.netDeferred;
    this.netDeferred = [];
    if (!drop) for (const f of todo) f();
  }

  /** Deja al rival parado en `pos` (sin movimiento ni carga viejos) antes de su cinemática. */
  private netBotSnap(pos: { x: number; y: number }) {
    const bt = this.bot;
    bt.x = pos.x;
    bt.y = pos.y;
    if (this.netRemote) this.netRemote = { ...this.netRemote, x: pos.x, y: pos.y, moving: false, charging: false };
    this.netAnchor(pos.x, pos.y);
    bt.ch.setMoving(false, 0);
    bt.ch.setCharging(false);
    this.rivalChargeT = 0; // la escena se congela: su brillo de carga se apaga ya (netBotTick no corre durante la cinemática)
    this.rivalChargeFx(0);
    this.rivalChargeSprite.hide();
    this.renderActors(); // la escena queda congelada: se dibuja ya en su sitio
  }

  /**
   * SMASH del rival visto desde aquí: el partido se congela el mismo tiempo y el actor 'bot' hace la pose del
   * remate (con salto si es por arriba). Es la MISMA cinemática (fx/SmashCinematic.ts) enfocada en el rival.
   * El golpe real llega con game:hit: si llega durante la cinemática se aplica al terminar (una sola vez).
   */
  private netRemoteSmashCine(d: ActionMsg['data']) {
    if (!smashCineEnabled() || this.cine.active || this.phase === 'over') return;
    const pos = this.netBotPos(d?.x, d?.y);
    if (!pos) return;
    const bt = this.bot;
    this.netBotSnap(pos);
    this.netDeferred = [];
    this.netRemoteCine = true;
    const overhead = d?.overhead === true;
    const lead = bt.ch.swing(true, overhead, overhead);
    if (isSmashPower(d?.element)) this.netRivalSmashEl = d.element; // el poder de su SMASH (ya llegó con 'smash-armed'; por si no)
    this.cine.start({
      profile: smashCine(this.netRivalSmashEl),
      onCancel: () => this.netEndRemoteCine(true),
      freeze: [...spritesIn(this.player.ch), ...spritesIn(bt.ch)],
      executor: spritesIn(bt.ch),
      leadMs: Math.min(lead, 150),
      focus: () => this.cineFocus(bt),
      onHit: () => this.netEndRemoteCine(),
    });
  }

  /**
   * INFERNO DRIVE del rival visto desde aquí: concentración congelada, desplazamiento con sombras hasta el punto de
   * contacto y reanudación al golpear (misma cinemática y mismas sombras: fx/SmashCinematic.ts + fx/InfernoFx.ts).
   */
  private netRemoteInfernoCine(d: ActionMsg['data']) {
    if (this.cine.active || this.phase === 'over') return;
    const from = this.netBotPos(d?.x, d?.y);
    const to = this.netBotPos(d?.tx, d?.ty);
    if (!from || !to) return;
    const bt = this.bot;
    this.netBotSnap(from);
    this.netDeferred = [];
    this.netRemoteCine = true;
    // misma pose de espera que en su teléfono (hoja del INFERNO) o, sin ella, la guardia de siempre
    if (!bt.ch.infernoHold()) bt.ch.setCharging(true);
    const sprites = spritesIn(bt.ch);
    const D = INFERNO.dash;
    const dashSt = { sound: false };
    infernoSound.charge(this);
    // aspecto de SU poder (llega con 'inferno-cine'; si no, el de su personaje): mirada, energía de la carga y sombras
    const el = infernoElementFor(this.net?.opponent.skin, this.netRivalInferno);
    // la franja con SUS ojos, igual que la ve él (necesita su imagen cargada: preload)
    showInfernoGaze(this, INFERNO_CINE.hitAtMs - GAZE_END_BEFORE_HIT_MS, this.gazeY(), this.rivalSkin(), el);
    this.ghosts.setLook(INFERNO_LOOK[el].ghostTint, INFERNO_LOOK[el].ghostRamp);
    this.cine.start({
      profile: infernoCine(el),
      freeze: [...sprites, ...spritesIn(this.player.ch)],
      executor: sprites,
      leadMs: 0,
      focus: () => this.cineFocus(bt),
      onCancel: () => {
        bt.ch.infernoRelease();
        bt.ch.setCharging(false);
        this.ghosts.clear();
        this.netEndRemoteCine(true);
      },
      onFrame: (e) => {
        if (e >= INFERNO_CINE.hitAtMs - INFERNO_PRE_MS) bt.ch.infernoPre();
        if (e < D.fromMs) return;
        this.infernoDashStep(e, bt, from, to, sprites, dashSt);
      },
      onHit: () => {
        bt.x = to.x;
        bt.y = to.y;
        if (this.netRemote) this.netRemote = { ...this.netRemote, x: to.x, y: to.y };
        this.netAnchor(to.x, to.y);
        bt.ch.setCharging(false); // suelta la pose de espera: su golpe sigue desde la raqueta atrás
        this.ghosts.end();
        this.netEndRemoteCine();
      },
    });
  }

  /**
   * El rival quedó aturdido por una bola de fuego (la alcanzó en su teléfono): mismo impacto que en el modo BOT
   * (explosión, aturdido dibujado o giro, estrellas) durante los mismos ms. Su devolución llega luego con
   * game:hit (impact) y no vuelve a animar un golpe.
   */
  private netBotStunned(ms: number) {
    const b = this.bot;
    const s = this.ball.s;
    const kind: PowerKind = this.infernoFlight ? 'inferno' : 'smash';
    const dur = clamp(Number.isFinite(ms) ? ms : stunMsFor(kind), 200, 2000);
    // la bola de fuego desaparece en el impacto (como fireImpact)
    this.infernoFlight = false;
    this.infernoBounced = true;
    this.ball.quietFx = false;
    this.fire.clear();
    const feet = project(b.x, b.y);
    const head = this.headPos(b);
    const at = kind === 'inferno' ? project(s.x, s.y, s.z) : { sx: feet.sx, sy: (feet.sy + head.y) / 2 };
    powerImpactFx(this, kind, at.sx, at.sy, feet.s, kind === 'inferno' ? this.infernoEl : this.smashFlightEl);
    b.stun = dur / 1000; // estrellas de aturdido (renderActors) y fin sincronizado (netBotTick)
    if (kind === 'inferno') this.ultiStunOn(b, dur);
    // con la ULTI su raqueta la dibuja la acción 'racket' (cae en la cancha), no el clip
    if (!b.ch.impactStun(kind, dur, kind !== 'inferno')) {
      this.tweens.add({ targets: b.ch.rig, angle: { from: -POWER_IMPACT.recoilDeg * b.ch.facing, to: 0 }, duration: dur, ease: 'Elastic.easeOut' });
    }
    this.popText(head.x, head.y - 10, '¡ATURDIDO!', '#ffd23f', 30);
  }

  /** el rival está rematando un globo (red): cámara lenta aquí también */
  private netRemateOn = false;
  /** su aro que se cierra sobre la pelota (tiempo de juego transcurrido / hasta el contacto) */
  private netRemateRing: Phaser.GameObjects.Graphics | null = null;
  private netRemateT = 0;
  private netRemateDur = 0.4;
  /** cómo terminó su remate ('remate-end'): lo usa su golpe para los efectos (SMASH! si fue justo al cierre) */
  private netRemateGrade: 'perfect' | 'early' | 'late' | null = null;

  /**
   * REMATE del rival (red): la misma cámara lenta mientras apunta (sin acercar la cámara ni ver su apuntado) y su salto.
   * Termina con 'remate-end', con su golpe o al acabar el punto.
   */
  private netRemoteRemate(on: boolean, d?: ActionMsg['data']) {
    const bt = this.bot;
    if (on) {
      if (this.phase !== 'rally' || this.netRemateOn) return;
      const slow = clamp(Number(d?.slow) || 1, REMATE.minSlow, 1);
      const T = clamp(Number(d?.t) || 0.4, 0.12, 0.8);
      this.netRemateOn = true;
      this.netRemateT = 0;
      this.netRemateDur = T;
      this.netRemateGrade = null;
      this.netRemateRing?.destroy();
      this.netRemateRing = this.add.graphics().setDepth(4000);
      bt.ch.setMoving(false, 0);
      bt.ch.setCharging(false);
      this.setSlowMo(slow);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.setSlowMo(1));
      // salto hasta el contacto (en tiempo de juego: con la cámara lenta dura lo mismo que en su teléfono)
      this.tweens.add({ targets: bt, lift: REMATE.jump, duration: T * 1000, ease: 'Sine.easeOut' });
      bt.ch.remateHold(); // raqueta arriba, como en su teléfono
      const h = this.headPos(bt);
      this.netRemateLabel = this.popText(h.x, h.y - 10, 'REMATE', '#ffd23f', 30);
      return;
    }
    if (!this.netRemateOn) return;
    this.netRemateOn = false;
    const grade = d?.grade;
    this.netRemateGrade = grade === 'perfect' || grade === 'early' || grade === 'late' ? grade : null;
    this.netRemateRing?.destroy();
    this.netRemateRing = null;
    // golpe al aire (demasiado pronto): hace el gesto y no le pega, como en su teléfono
    if (grade === 'whiff') {
      bt.ch.swing(true, true, true);
      const h = this.headPos(bt);
      this.popText(h.x, h.y - 20, '¡AL AIRE!', '#ff9aa3', 32);
    }
    if (this.netRemateLabel?.active) {
      this.tweens.killTweensOf(this.netRemateLabel);
      this.netRemateLabel.destroy();
    }
    this.netRemateLabel = null;
    this.setSlowMo(1);
    this.tweens.add({ targets: bt, lift: 0, duration: 320, ease: 'Quad.easeIn' });
  }

  /** Raqueta del rival (red): la perdió (cae donde dice su teléfono) o la recogió. */
  private netRemoteRacket(d: ActionMsg['data']) {
    if (d?.lost === true) {
      const at = this.netBotPos(d.x, d.y);
      if (at) this.loseRacket(this.bot, at);
    } else if (this.bot.racket) this.recoverRacket(this.bot);
  }

  /** Punto / falta / let decidido por el juez (el rival). */
  private netApplyPoint(pm: PointMsg, forMe: boolean) {
    if (this.phase === 'over') return;
    this.netApplying = true;
    if (pm.kind === 'let') {
      this.phase = 'rally';
      this.serveLetCall();
    } else if (pm.kind === 'fault') {
      // falta del saque en curso (de quien saca en este juego)
      this.phase = 'rally';
      this.serving = true;
      this.lastHitter = this.server;
      this.serviceFault();
    } else {
      // textos desde este lado ('¡PUNTO!' del rival = 'Punto rival' aquí)
      let reason = pm.reason;
      let color = pm.color;
      if (reason === '¡PUNTO!' || reason === 'Punto rival') {
        reason = forMe ? '¡PUNTO!' : 'Punto rival';
        color = forMe ? '#8fd0ff' : '#ff9aa3';
      }
      // el juez manda: se aplica aunque aquí se esté mostrando el punto anterior
      if (this.phase !== 'rally') this.phase = 'rally';
      this.pointTo(forMe ? 'player' : 'bot', reason, color);
    }
    this.netApplying = false;
  }
}











