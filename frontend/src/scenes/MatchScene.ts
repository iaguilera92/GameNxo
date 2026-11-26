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
  SMASH_REACH,
  NET_HEIGHT,
  NET_BALL_CLEARANCE,
  netTapeHeight,
  RALLY_LIMIT,
  NET_OVERHANG,
  NET_X,
  GRAVITY,
  PLAYER_SPEED,
  SERVE,
  SERVE_KMH,
  SERVE_SPEED,
  SHOT_SPEED,
  SIDE_MARGIN,
  SMASH_COOLDOWN,
  SMASH_SPEED_MULT,
  MAX_LEVEL,
} from '../config';
import { Ball, type BallState, type NetCrossing, type ShotKind, aimDipShot, aimNetFault, aimOutFault, aimShot, isInCourt, stepBall } from '../objects/Ball';
import { Character, PLAYER_LOOK, lookForSkin, playerLook, rivalLook } from '../objects/Character';
import { type DoublesSkins, doublesSkinsFor, tutorialRivalFor } from '../characters/catalog';
import type { BotAI } from '../logic/BotAI';
import { BotBrain } from '../ai/BotBrain';
import { botNamesFor, hostServesGame } from '../net/doubles';
import { tapHint } from '../ui/guideFocus';
import { coverY, homeY as doublesHomeY, smoothToward } from '../ai/doublesPositioning';
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
import { ScoreBoard, queueScoreboardArt } from '../ui/ScoreBoard';
import { showConfirm } from '../ui/ConfirmDialog';
import { AbilityButton } from '../ui/AbilityButton';
import { Emotes, queueEmoteArt } from '../ui/Emotes';
import { ownedEmotes } from '../domain/emotes';
import { getPlayer } from '../domain/playerStore';
import type { PlayerState } from '../domain/player';
import { C, FONT, textStyle } from '../ui/theme';
import { COURT_SHIFT, VIEW, project } from '../view/projection';
import { drawCourtView, queueAmbiente, resolveAmbiente, footerColor, footerDark, SHARED_FOOTER } from '../view/CourtView';
import { stopIntroMusic } from '../fx/introMusic';
import { playMatchMusic, playResultMusic, stopMatchMusic, takePickedAmbiente } from '../fx/matchMusic';
import { LOB_SMASH, LobTracker, REMATE } from '../logic/LobSmash';
import { LobMarker, superSmashFx } from '../fx/LobMarker';
import { SmokeTrail } from '../fx/SmokeTrail';
import { DropZeroFx, SmashElementFx, dropZeroBounceFx } from '../fx/smashElementFx';
import { SMASH_CINE, SmashCinematic, type CineFocus, smashCineEnabled, spritesIn } from '../fx/SmashCinematic';
import { SMASH_LOOK, smashCine } from '../fx/smashFx';
import { type SmashPower, isSmashPower } from '../domain/smashPowers';
import { elementTexture } from '../ui/AbilityButton';
import { INFERNO, INFERNO_CINE, InfernoDrive, planInfernoContact } from '../logic/InfernoDrive';
import { GhostTrail, INFERNO_LOOK, InfernoFire, infernoCine, infernoElementFor, infernoImpactFx, infernoShake, infernoSound, playUltiFile, queueInfernoArt, hitLookOf, type FxElement, type InfernoElement } from '../fx/InfernoFx';
import { isInfernoPower, isLegendaryInferno } from '../domain/infernoPowers';
import { HURRICANE, HURRICANE_MATCH_CINE, attackerLiftAt, planHurricane } from '../logic/EnergyRally';
import { ENERGY_CINE, ENERGY_MATCH_CINE, ENERGY_MATCH_K, ENERGY_RALLY, attackerAt, mirrorP, planEnergyRally, shotAt, shotBallAt, victimAt, type EnergyRallyPlan, type P2, type P3, type RallyShot } from '../logic/EnergyRally';
import { EnergyCineFx } from '../fx/energyBallCine';
import { EnergyImpactFx } from '../fx/energyBallFx';
import { MAX_PUSH, POWER_IMPACT, type PowerKind, RACKET_LOSS, knockbackX, stunMsFor, stunSeconds } from '../logic/PowerImpact';
import { ensureLooseRacket, queueNxoSpriteLoads, registerNxoAnims, sheetsOf } from '../objects/NxoActor';
import { type BotKit, botKitFor, randomBotKit, randomDoublesKits } from '../ai/botKit';
import { ZONE_SKINS, type ZoneSkinDef, isZoneSkin, zoneSkinOf } from '../domain/zoneSkins';
import { NetView } from '../fx/NetView';
import { applyCharColor, devCharColor } from '../fx/CharColorFx';
import { charColorOf } from '../domain/charColors';
import { type UnlockKey, isUnlocked, unlockLabel } from '../domain/unlocks';
import { queueAmbientBird, spawnAmbientBird } from '../fx/AmbientBird';
/**
 * Devolución PERFECT del ESPECIAL rival (MatchScene.smashPerfectReturn): el toque debe caer a ±windowS del bote de la bola
 * en tu lado y el contacto, como mucho afterBounceS después del bote.
 */
const SMASH_PERFECT = { windowS: 0.12, afterBounceS: 0.45 };
/** (18-11-2026) el REMATE del bot empieza su golpe este tiempo (s de juego) antes del contacto: la raqueta llega justo cuando sale la pelota */
const BOT_REMATE_LEAD_S = 0.13;
/** (20-11-2026, usuario) el rival (bot u online) salta más alto en su remate del globo que REMATE.jump */
const RIVAL_REMATE_JUMP_K = 1.35;
/** (20-11-2026, usuario) el que lanza el ESPECIAL se queda este tiempo en el frame del golpe (usuario, bot y rival online) */
const SPECIAL_IMPACT_HOLD_MS = 800;
/** (21-11-2026, usuario) el ESPECIAL se queda en el ÚLTIMO cuadro del golpe potenciado (cuadro 8 = índice 7), no en el del impacto */
const SPECIAL_HOLD_FRAME = 7;
/** (18-11-2026, usuario) en ZONA se RESISTE el ESPECIAL: aturdido solo este tiempo (ms) */
const RESIST_STUN_MS = 1000;
/** (18-11-2026, usuario: "el bot con el DASH no alcanza mi ESPECIAL") alcance del rival (× HIT_RANGE) en la pelota para la que usó su DEFENSIVO */
const BOT_DASH_REACH = 1.35;
/** (23-11-2026) DASH del ALIADO bot del 2v2: los mismos números que el del rival (BotBrain DASH_AI): falta de tiempo, duración, velocidad y frenada */
const ALLY_DASH = { needS: 0.62, time: 0.34, mult: 2.4, landDist: 30 };
import { infernoGroundFx, powerImpactFx } from '../fx/ImpactFx';
import { lightDashFlash, shadowDashFlash, lightningBodyFx, lightningDashFlash, lightningFloorTrail, ultiStunFx, windBlast } from '../fx/elementImpactFx';
import { HURRICANE_COL, TORNADO_ART, TornadoFx, TornadoSprite, WindSphereFx, sphereBreakFx, wallKnockFx, windShotFx } from '../fx/hurricaneFx';
import { playMatchEnd } from '../fx/matchEnd';
import { INTRO, playMatchIntro } from '../fx/matchIntro';
import { ServeTurnTag, queueServeTagArt } from '../ui/ServeTurnTag';
import { setupUiCamera } from '../view/uiCamera';
import { queueParkWalkers, queueWalkers, startParkWalkers, startWalkers, startSnowFall } from '../fx/parkWalkers';
import { startAmbientLights } from '../fx/ambientLights';
import { queueSpectators, startSpectators } from '../fx/spectators';
import { createMissionTracker, missionDef, missionHit, missionPoint, missionPointStart, missionReward, type MissionId, type MissionShot } from '../domain/matchMissions';
import { isDevMode } from '../domain/devMode';
import { botForcedOutChance, isTutorialMatch } from '../domain/tutorialMatch';
import { MatchCoach } from '../tutorial/MatchCoach';
import { TUTORIAL_REQUIRED_LEVELS, tutorialMissionsFor } from '../domain/tutorialMissions';
import type { GuidedMatch } from '../domain/tutorial';
import { queueMissionAlertArt, showMissionAlert } from '../fx/missionAlert';
import { queueGazeArt, showInfernoGaze } from '../fx/infernoGaze';
import { ZONE, ZoneTracker, type Side as ZoneSide } from '../logic/Zone';
import { ZoneFx, zoneEyes } from '../fx/ZoneFx';
import { drawWarningIcon } from '../ui/icons';
import type { MatchNet } from '../net/MatchNet';
import type { ActionMsg, HitMsg, PointMsg, ScoreMsg, StateMsg } from '../net/protocol';
import { mirrorX, mirrorY } from '../net/mirror';
import { RemoteInterp } from '../net/interp';
import { MatchDiag, netLogOn } from '../net/matchDiag';
import { skyTwinkleSound, uiSound } from '../fx/uiSound';
import { POINT_SPLASH_MS, isMatchPoint, showPointSplash } from '../fx/pointSplash';
import { createServeCountdown, showServeSpeedNotice, showSideNotice, type ServeCountdown } from '../fx/sideNotice';
import { TIMING, TimingTracker, type ShotClass, type TimingResult, applyError, evaluateCharge, nextStreak, timedSpeed, timingMods } from '../logic/PerfectTiming';
import { TimingRing, perfectSound, playStreakFx, playTimingFx, vibrate } from '../fx/timingFx';
import { playMatchFinale } from '../fx/matchFinale';
import { getSettings } from '../logic/Settings';
import { MOTION, type MotionEvent, createMotion, runAnimRate, stepMotion, stopMotion } from '../logic/PlayerMotion';
import { DASH, type DashRun, createRun, guaranteeStep, planSprint, sampleTrajectory, shouldCancelRun, stepRun } from '../logic/DashSprint';
import { DashFx } from '../fx/dashFx';
import { IceTrail, iceSprayFx } from '../fx/iceTrailFx';
import { SLOWMO_CINE } from '../fx/slowmoCine';
import { BLINK, DASH_WARP, FLIP, JUMP, LIGHTNING, SLOWMO, SHADOW, SKATE, flipPose, skateEase, skateLean } from '../logic/DefensiveMoves';
import * as defFx from '../fx/defensiveFx';
import { placeActor } from '../fx/actorPose';
import { StunFog } from '../fx/stunFog';
import { SFX_SEEK, dashSfx, sfx } from '../fx/sfx';
import { WALL, type WallGeom, wallFromArt, wallHit, wallOutcome } from '../logic/BackWall';
import { type ZoneStatLevels, emptyZoneStats, zoneStatPercent } from '../domain/zoneProgress';
import { WallFx } from '../fx/wallFx';
import { addRiskBadge } from '../ui/riskBadge';
import { NET_DUEL, NO_TAP, botTapMs, cleanPlan, defaultAimSide, diffLabel, duelHitSide, duelLungeHit, duelSchedule, duelWinner, lobFlightS, lobTarget, mirrorSide, rollPlan, roundFromWire, roundWinner, roundWire, isDecisive, msTier, shouldStartDuel, sideFromJoystick, tapDiffMs, tapInWindow, tapIsEarly, type RoundPlan, type RoundWho } from '../logic/NetDuel';
import { DUEL_CINE, createDuelGaze, createDuelScore, createDuelPressure, createDuelVignette, showDuelDecisive, showDuelLag, type DuelGaze, type DuelPressure, type DuelScore, type DuelVignette } from '../fx/NetDuelFx';

type Who = 'player' | 'bot';

/** (17-11-2026) ULTI LEGENDARIA BOLA DE ENERGÍA en curso (logic/EnergyRally.ts, fx/energyBallCine.ts). Nace en legendCharge y muere en legendEnd. */
interface LegendRun {
  /** quién la lanza en ESTE teléfono: 'player' (yo) o 'bot' (el rival en red) */
  att: Who;
  /** (17-11-2026) qué ULTI LEGENDARIA: 'energy' (BOLA DE ENERGÍA) o 'hurricane' (HURACÁN) */
  power: 'energy' | 'hurricane';
  /** HURACÁN: el tornado ya empezó */
  hTornado?: boolean;
  /** (18-11-2026) HURACÁN: carrera a la T (0 no, 1 corriendo, 2 llegó), la esfera ya se desarmó, la hoja del tornado ya se precargó */
  hMove?: number;
  /** (21-11-2026) HURACÁN: instante (t del guion) de la última sombra de la carrera a la T y cuántas van */
  hGhostT?: number;
  hGhosts?: number;
  hBroke?: boolean;
  hWarm?: boolean;
  plan: EnergyRallyPlan;
  /** el guion está en las coordenadas del otro teléfono (soy la víctima): se espeja */
  mirror: boolean;
  /** 'charge' = carga de 6 s (SmashCinematic activa) · 'rally' = peloteo automático (tickLegend) */
  stage: 'charge' | 'rally';
  /** ms del peloteo (con el tiempo de los fotogramas: se para con la pausa) */
  t: number;
  /** por tiro del guion: 1 = golpe empezado, 2 = contacto, 4 = estirada del rival */
  done: Uint8Array;
  /** salió la BOLA DE ENERGÍA final */
  finalFired: boolean;
  /** la ZONA / el aura ya estaban encendidas (no se apagan al terminar) */
  zoneWas: boolean;
  auraWas: boolean;
  lastAt: number;
  /** puntos de trabajo (sin crear objetos por fotograma) */
  pb: P3;
  pa: P2;
  pv: P2;
  /** sitio de peloteo del que la lanza, posición inicial del rival y su sitio de peloteo (en ESTE teléfono) */
  to: P2;
  v0: P2;
  vTo: P2;
}

/** (17-11-2026) qué ULTI LEGENDARIA es `p` (lo que no sea HURACÁN, la BOLA DE ENERGÍA de siempre: así un aviso viejo sin `power` sigue igual). */
function legendPowerOf(p: unknown): LegendRun['power'] {
  return p === 'hurricane' ? 'hurricane' : 'energy';
}
/** Guion de la ULTI LEGENDARIA (los dos teléfonos lo calculan igual con los mismos datos). */
function legendPlan(power: LegendRun['power'], a: P2, v: P2, seed: number): EnergyRallyPlan {
  return power === 'hurricane' ? planHurricane(a, v, seed) : planEnergyRally(a, v, seed);
}
/** colores de la carga del HURACÁN (fx/energyBallCine.ts setPalette): oro, crema y blanco */
/** (21-11-2026) carrera a la T del HURACÁN: color dorado de las sombras / estela y cada cuántos ms sale una sombra */
const HURRICANE_RUN_TINT = 0xffd84a;
const HURRICANE_RUN_GHOST_MS = 70;
const HURRICANE_COL_CHARGE = { core: HURRICANE_COL.core, light: HURRICANE_COL.light, cyan: HURRICANE_COL.gold, deep: HURRICANE_COL.deep };

/** Bandera de desarrollo apagada a propósito (localStorage = '0'); sin definir cuenta como encendida. */
function devFlagOff(key: string) {
  try {
    return localStorage.getItem(key) === '0';
  } catch {
    return false;
  }
}

/** Bandera de desarrollo en localStorage ('1' = activa), como dev.botDebug. */
function devFlagOn(key: string) {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}
type Phase = 'intro' | 'serve' | 'toss' | 'rally' | 'pointover' | 'over';

/** DUELO RED en curso (logic/NetDuel.ts, fx/NetDuelFx.ts). Nace en duelStart y muere en duelEnd / duelAbort. */
interface DuelRound extends RoundPlan {
  /** golpes automáticos ya dados */
  hits: number;
  ringOn: boolean;
  closed: boolean;
  resolved: boolean;
  /** error en ms del toque de cada uno respecto al cierre del aro (null = no tocó); el del rival (red) llega en 'duel-tap' */
  tap: number | null;
  rival: number | null;
  /** toque demasiado PRONTO (fallo: ¡PRONTO!, cuenta como sin toque) de cada uno */
  early: boolean;
  rivalEarly: boolean;
  /** el número de ms de cada uno ya salió sobre su personaje */
  shownP: boolean;
  shownB: boolean;
  /** DESTELLO del ganador de la ronda anterior: índice de su primer golpe de este peloteo (-1 = aún ninguno) y de quién es */
  boostHit: number;
  boostWho: Who | null;
  /** AUTO: ms (respecto al cierre) en que toca el piloto automático */
  autoAt: number | null;
  winner: RoundWho | null;
}
interface DuelState {
  /** intro = inicio congelado · rounds = las 3 rondas · wait = (red) espera el ganador del juez · aim = el ganador elige el lado · hit = sale el globo */
  stage: 'intro' | 'rounds' | 'wait' | 'aim' | 'hit';
  /** quién iba a recibir la pelota (gana los empates del duelo) */
  receiver: Who;
  /** este teléfono decide los resultados (modo bot: siempre; en red: el que recibe la pelota) */
  judge: boolean;
  /** performance.now() al empezar el inicio y al empezar las rondas; último fotograma (para la cámara) */
  t0: number;
  tR0: number;
  lastAt: number;
  /** golpes del peloteo de cada ronda (2-3) y cuántos golpes llevan las rondas anteriores */
  plan: number[];
  gBase: number[];
  rounds: DuelRound[];
  winner: Who | null;
  /** ganador que llegó del juez (red) antes de tiempo */
  pending: Who | null;
  waitUntil: number;
  /** performance.now() al empezar la elección del lado */
  aimAt: number;
  /** pelota al empezar y su estado al empezar el duelo (se restaura si se cancela) */
  ballFrom: { x: number; y: number; z: number };
  saved: BallState;
  /** lado del globo en las coordenadas de ESTE teléfono: -1 = y menor, 1 = y mayor */
  side: -1 | 1 | null;
  gaze: DuelGaze;
  vignette: DuelVignette;
  ring: Phaser.GameObjects.Graphics;
  score: DuelScore;
  aimG: Phaser.GameObjects.Graphics | null;
  /** borde rojo que late (PRESIÓN) y el lateral de cada personaje al empezar (a él vuelven al cerrarse cada aro) */
  press: DuelPressure;
  y0: { player: number; bot: number };
  /** rondas decididas (sube el zoom y el latido) */
  done: number;
  /** RONDA DECISIVA (1-1 antes de la tercera): su viñeta oscura y cuándo empezó */
  decisive: boolean;
  vig2: DuelVignette | null;
  decAt: number;
}

/** Personaje en coordenadas lógicas de cancha (x = profundidad, y = lateral). */
interface Actor {
  ch: Character;
  /** (25-11-2026) profundidad extra (placeActor): tu personaje sobre el oscurecido de la guía del nivel 1 */
  depthBoost?: number;
  x: number;
  y: number;
  /** +1 jugador (mira hacia x creciente), -1 bot */
  dir: number;
  stun: number;
  /** hasta este instante (time.now) su 'stun' es solo un empujón leve (golpe cargado al máximo): sin estrellas */
  softUntil?: number;
  /** 1 = normal; 0 = desaparecido (teleport) */
  warp: number;
  vanished: boolean;
  /** altura extra del dibujo (SUPERSALTO), en unidades z; la sombra/profundidad siguen en el suelo */
  lift?: number;
  /** raqueta en el suelo tras recibir la ULTI (RACKET_LOSS): sin ella no golpea ni usa habilidades */
  racket?: { x: number; y: number; img: Phaser.GameObjects.Image; mark: Phaser.GameObjects.Ellipse; shadow: Phaser.GameObjects.Ellipse; landed: boolean } | null;
  /** salió volando al cielo (ESPECIAL recibido sin raqueta): renderActors no lo coloca hasta el punto siguiente */
  launched?: boolean;
  /** VOLTERETA / PATINAJE: giro del dibujo en rad (sobre su centro) y agachado al caer (0..1); renderActors los aplica */
  spin?: number;
  spinWas?: boolean;
  /** la sombra del personaje está fuera de su sitio (salto / giro): renderActors la devuelve a los pies al aterrizar */
  shadowMoved?: boolean;
  squat?: number;
  /** polvo de la carrera (runDust): última posición y hora medidas, distancia recorrida desde la última nube y hora de la última */
  dust?: { x: number; y: number; at: number; acc: number; last: number };
}

const LAT_C = (COURT.top + COURT.bottom) / 2;
/**
 * Ancho de JUEGO de la cancha (19-11-2026): en 1v1 la de individuales; en 2v2 la de DOBLES (con los pasillos, ALLEY). Lo fija setLane al empezar
 * cada partido (una sola MatchScene a la vez). HALF_W = mitad del ancho donde se apuntan los tiros; Y_MIN / Y_MAX = hasta dónde se mueven los
 * personajes. El cuadro de saque NO cambia: en dobles el saque va al cuadro de individuales (regla real; el pasillo cuenta tras el resto).
 */
let HALF_W = (COURT.bottom - COURT.top) / 2;
let Y_MIN = COURT.top - SIDE_MARGIN;
let Y_MAX = COURT.bottom + SIDE_MARGIN;
function setLane(wide: boolean) {
  const m = wide ? ALLEY : 0;
  HALF_W = (COURT.bottom - COURT.top) / 2 + m;
  Y_MIN = COURT.top - m - SIDE_MARGIN;
  Y_MAX = COURT.bottom + m + SIDE_MARGIN;
}
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
/** distancia mínima (en x de cancha) entre los pies del rival y la pared del fondo dibujada */
const RIVAL_WALL_GAP = 30;
/** 2v2: distancia a la red del jugador que sube a volear (aliado y rival) */
const DOUBLES_NET_GAP = 120;

const rand = Phaser.Math.FloatBetween;
const clamp = Phaser.Math.Clamp;

/** Solo animación: altura de pelota desde la que el golpe del jugador se muestra como remate. */
const OVERHEAD_Z = 116;
/** volumen del "cargando" del rival (el tuyo suena a 0,7): más bajo = más lejos */
const RIVAL_CHARGE_VOL = 0.3;
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
/** el saque solo puede alargar su vuelo este factor para pasar la red (antes, sin tope: a veces salía un globo gigante) */
const SERVE_MAX_STRETCH = 1.35;
/** entrada al partido: fracción del camino (desde su sitio hasta el borde) desde la que entra caminando */
const ENTRANCE_FROM = 0.6;
/** altura máxima (z) del saque del RIVAL: por encima se ve como un globo */
const BOT_SERVE_MAX_APEX = 280;
/** centro del marcador de 3 pelotas del Duelo Red (¡ÚLTIMA RONDA! sale justo encima) */
const DUEL_SCORE_Y = 180;
/** joystick arriba / abajo mantenido más que esto (ms) sin cargar = venía corriendo: el golpe sale normal, no globo / cortita */
const SHOT_HOLD_MS = 450;
/** (25-11-2026, usuario) nivel 2, P1: duración de la pausa en lo más alto del saque (explica las 6 zonas) */
const L2_AIM_PAUSE_MS = 1000;
/** tras el reloj, la pelota sigue quieta arriba hasta que pulses; pasado esto, el saque directo sale solo */
const L2_AIM_AUTO_MS = 15000;
/** (25-11-2026, usuario) textos de los puntos guiados (globo, cortita, remate, ESPECIAL del rival) */
const SP_TEXT = {
  serve: 'TE TOCA SACAR',
  // (25-11-2026, usuario) GLOBO: la pelota bota en la T y se para (pulsando): vas a ella; al llegar, joystick arriba
  lobGo: 'MUEVE EL JOYSTICK HACIA LA PELOTA',
  lob: 'JOYSTICK ARRIBA PARA EL GLOBO',
  drop: 'JOYSTICK ABAJO PARA LA CORTITA', // (25-11-2026, usuario) nivel 3, P1: mismo flujo que el globo
  // (25-11-2026, usuario) nivel 3, P3: saca el rival y lo respondes (luego su ESPECIAL)
  returnServe: 'RESPONDE EL SAQUE',
  special: '¡ESPECIAL! NO SE PUEDE DEVOLVER',
  defensive: 'USA EL DEFENSIVO', // (26-11-2026, usuario) nivel 3, P4
};
/** (26-11-2026, usuario) nivel 5 guiado */
const G5_TEXT = {
  drop: 'JOYSTICK ABAJO: DROP SHOT 0',
  circle: 'CAMINA AL CÍRCULO',
  tap: 'TOCA PARA REMATAR',
  rivalDrop: 'EL RIVAL HIZO\nDROP SHOT 0',
};
/** (26-11-2026, usuario) nivel 4 guiado */
const G4_TEXT = {
  special: 'USA EL ESPECIAL',
  charge: 'TOCA A LA DERECHA PARA CARGAR',
  charging: 'CARGANDO AL MÁXIMO',
  aim: 'JOYSTICK A IZQUIERDA O DERECHA', // (26-11-2026, usuario)
  lob: 'JOYSTICK ARRIBA: GLOBO CARGADO',
};
/** (25-11-2026, usuario) nivel 3, P2 REMATE: la pelota del rival se para en el aire cerca de tu red al bajar a esta altura */
const SP_REMATE_Z = 220;
/** (25-11-2026, usuario) globo: al llegar a la pelota, reloj de 1,5 s (el joystick muestra ARRIBA); luego la espera del joystick (y sale solo) */
const SP_LOB_CLOCK_MS = 1500;
const SP_LOB_AUTO_MS = 10000;
/** (25-11-2026, usuario) nivel 2: pelota congelada esperando el DEFENSIVO; pasado esto, lo usa solo */
const L2_DEF_AUTO_MS = 15000;
/** (25-11-2026, usuario) nivel del tutorial en que se enseña el DUELO EN LA RED (docs/TUTORIAL-PLAN.md); antes no sale */
const TUTORIAL_DUEL_LEVEL = 11;
/** (26-11-2026, usuario) pasiva RESISTENCIA: el DEFENSIVO se recarga antes (s) y los aturdimientos duran menos */
const RESIST_PASSIVE = { dashFaster: 0.5, stunK: 0.75 };
/** (26-11-2026, usuario) CARGANDO GOLPE (derecha, izquierda y globo al máximo) usable en el partido desde este nivel */
const CHARGE_PLAY_LEVEL = 4;
/** (26-11-2026, usuario) el DROP SHOT 0 se enseña en el nivel 5: el rival bot del tutorial lo usa recién desde el siguiente */
const BOT_DROP0_LEVEL = 6;
/** (26-11-2026, usuario) el REMATE del globo (con círculo) se enseña en el nivel 7: el rival bot lo usa desde el siguiente */
const BOT_REMATE_LEVEL = 8;
/** (25-11-2026, usuario) nivel 1: la pelota se queda pegada al subir esto tras el bote (sigue dentro del cuadro) */
const GUIDE_HOLD_Z = 34; // (25-11-2026, usuario) 16 se pegaba justo en el bote: que avance un poco más
/** GLOBO DISPARADO (globo cargado al máximo): velocidad (× SHOT_SPEED), margen sobre la red (bajo = tenso) y cuánto se aleja la cámara */
/** tope de alargue del globo del bot para pasar la red (aimShot maxStretch) */
const BOT_LOB_MAX_STRETCH = 1.3;
/** golpes del bot que no son globo: altura máxima (z) y cuánto puede subir su velocidad para no pasarla */
const BOT_FLAT = { apex: 150, maxSpeed: 1.3 };
const MAX_LOB = { speed: 1.35, margin: 100, zoomOut: 0.3 };
/**
 * Golpe SIN pedir globo (joystick neutro, de lado o cargado normal) con el rival SUBIDO a la red (a menos de `botNear` de ella): la
 * pelota no puede salir en arco alto (pasaría por encima de su alcance y no la alcanzaría). Si el arco supera `apex`, se sube la
 * velocidad (`step` cada vez) hasta aplanarlo. Solo el globo pedido con el joystick arriba (o la cargada al máximo) va alto.
 */
const DIRECT = { botNear: 230, apex: 100, step: 1.12, tries: 7 };
/** (red) el rival se desliza hasta el punto de su golpe en este tiempo (ms) en vez de saltar */
const NET_SNAP_MS = 110;
/** (21-11-2026) al empezar cada punto, el rival se desliza hasta su sitio de saque en este tiempo (antes saltaba de golpe) */
const NET_POINT_SLIDE_MS = 320;
/** (21-11-2026) salto de la interpolación del rival en UN cuadro (px) a partir del cual se desliza (el DASH a 30 fps da ~50-68) */
const NET_JUMP_MIN = 75;
/** (21-11-2026) tiempo de ese deslizamiento (ms) */
const NET_JUMP_SLIDE_MS = 160;
/** (21-11-2026) máximo que la pelota de un golpe rival se adelanta DE GOLPE al llegar (s); el resto se recupera acelerándola */
const NET_BALL_JUMP = 0.07;
/** (21-11-2026, usuario) opacidad de los controles del jugador (joystick, botones) mientras dura la ULTI; 1 = normal */
const ULTI_HUD_DIM = 0.35;
const SERVE_JUMP = { max: 235, hangMs: 70, fallMs: 300, maxShift: 45 };
/** Solo animación: distancia (suelo) a la que el jugador se pone en guardia esperando la pelota. */
const READY_DIST = 200;
/** INFERNO DRIVE: el fotograma de preparación 9 aparece justo antes del golpe (no mueve la cinemática). */
const INFERNO_PRE_MS = 45;
/** (21-11-2026) cuerpo de un personaje para la regla del saque al cuerpo (checkServeBodyTouch): radio en el suelo y alto (unidades de cancha) */
const SERVE_BODY = { r: 24, z: 95 };
export class MatchScene extends Phaser.Scene {
  private guide?: GuidedMatch;
  private guideMove = 0;
  private guideReadyAt = 0;
  /** (25-11-2026) nivel 2: el tiro del bot botó en tu lado; la pausa del DEFENSIVO sale cuando la pelota se levanta */
  private level2PauseArmed = false;
  /** (25-11-2026, usuario) nivel 2: pelota congelada en el aire (posición y velocidad guardadas) hasta que pulses DEFENSIVO */
  private l2Freeze: { x: number; y: number; z: number; vx: number; vy: number; vz: number } | null = null;
  /** nivel 2: tu personaje quieto (sin joystick) desde el saque hasta usar el DEFENSIVO */
  private l2Lock = false;
  /** nivel 2: ya devolviste con el DEFENSIVO; el bot no se mueve hasta el final del punto (es tuyo) */
  private l2Won = false;
  /** nivel 2, P1: ya usaste el DEFENSIVO (la misión salta al ganar el punto) */
  private l2DefUsed = false;
  /** nivel 2: ya pulsaste DEFENSIVO; corres hasta la pelota (que sigue quieta) */
  private l2Running = false;
  /** cuándo se congeló la pelota del DEFENSIVO (a los L2_DEF_AUTO_MS lo usa solo) */
  private l2FreezeAt = 0;
  /** (25-11-2026, usuario) nivel 2, P2: serve = saca el bot; held = su saque quieto en lo alto del bote hasta que le pegas; fly = tu devolución va al bot; fed = el bot te tiró fuerte al otro lado */
  private l2Stage: 'serve' | 'held' | 'fly' | 'fed' = 'serve';
  private l2Hold: { x: number; y: number; z: number } | null = null;
  private l2ServeAt = 0;
  /** (25-11-2026, usuario) nivel 2, P1: con la pelota en lo más alto del saque, pausa (tú y la pelota) para explicar las 6 zonas del cuadro */
  /** on = el reloj (1 s, botones bloqueados); wait = pelota quieta arriba hasta que pulses (10 s y sale solo); done = sigue el saque */
  private l2AimPause: 'none' | 'on' | 'wait' | 'done' = 'none';
  private l2AimUntil = 0;
  private l2AimPose: { sp: Phaser.GameObjects.Sprite; key: string; frame: string | number }[] = [];
  private l2AimClock?: Phaser.GameObjects.Graphics;

  /**
   * (26-11-2026, usuario) el MISMO reloj del nivel 1 (pausa del saque) en todo el tutorial: disco oscuro, aro claro, arco amarillo que se
   * llena en `ms` y manecillas; bajo el texto de la instrucción
   */
  private guideClock(ms: number): Phaser.GameObjects.Container {
    const cx = this.scale.width / 2;
    const cy = this.scale.height * 0.46 + 120;
    const r = 34;
    const c = this.add.container(0, 0).setScrollFactor(0).setDepth(6075);
    const g = this.add.graphics();
    c.add(g);
    const st = { k: 0 };
    const draw = () => {
      g.clear();
      g.fillStyle(0x0a1638, 0.85).fillCircle(cx, cy, r + 6);
      g.lineStyle(4, 0xffffff, 0.35).strokeCircle(cx, cy, r);
      g.lineStyle(8, 0xffd23f, 1).beginPath().arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * st.k, false).strokePath();
      const a = -Math.PI / 2 + Math.PI * 2 * st.k;
      g.lineStyle(4, 0xffffff, 1).lineBetween(cx, cy, cx + Math.cos(a) * (r - 12), cy + Math.sin(a) * (r - 12));
      g.lineStyle(4, 0xffffff, 1).lineBetween(cx, cy, cx, cy - (r - 18));
      g.fillStyle(0xffffff, 1).fillCircle(cx, cy, 4);
    };
    draw();
    this.tweens.add({ targets: st, k: 1, duration: ms, onUpdate: draw });
    return c;
  }

  /** (25-11-2026, usuario) nivel 2, P1: pausa en lo más alto del saque: tú y la pelota congelados, reloj de 1 s con barra circular */
  private l2AimStart(srv: Actor) {
    this.l2AimPause = 'on';
    this.l2AimUntil = this.time.now + L2_AIM_PAUSE_MS;
    this.l2AimPose = spritesIn(srv.ch).map((sp) => ({ sp, key: sp.texture.key, frame: sp.frame.name }));
    for (const p of this.l2AimPose) p.sp.anims?.pause();
    this.l2AimClock?.destroy();
    this.l2AimClock = this.add.graphics().setScrollFactor(0).setDepth(6075);
  }
  /** cada fotograma de la pausa: la pose no se mueve (si algo la cambió, vuelve), el reloj se llena y, pasado el tiempo, espera tu toque */
  private l2AimTick() {
    for (const p of this.l2AimPose) {
      if (!p.sp.active) continue;
      if (p.sp.anims?.isPlaying && !p.sp.anims.isPaused) p.sp.anims.pause();
      if (p.sp.texture.key !== p.key || p.sp.frame.name !== p.frame) p.sp.setTexture(p.key, p.frame);
    }
    const now = this.time.now;
    if (this.l2AimPause === 'on') {
      const k = clamp(1 - (this.l2AimUntil - now) / L2_AIM_PAUSE_MS, 0, 1);
      const g = this.l2AimClock;
      if (g) {
        const cx = this.scale.width / 2, cy = this.scale.height * 0.46 + 120, r = 34; // debajo del texto
        g.clear();
        g.fillStyle(0x0a1638, 0.85).fillCircle(cx, cy, r + 6);
        g.lineStyle(4, 0xffffff, 0.35).strokeCircle(cx, cy, r);
        g.lineStyle(8, 0xffd23f, 1).beginPath().arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k, false).strokePath();
        // manecillas
        const a = -Math.PI / 2 + Math.PI * 2 * k;
        g.lineStyle(4, 0xffffff, 1).lineBetween(cx, cy, cx + Math.cos(a) * (r - 12), cy + Math.sin(a) * (r - 12));
        g.lineStyle(4, 0xffffff, 1).lineBetween(cx, cy, cx, cy - (r - 18));
        g.fillStyle(0xffffff, 1).fillCircle(cx, cy, 4);
      }
      if (now >= this.l2AimUntil) {
        this.l2AimPause = 'wait';
        this.l2AimUntil = now + L2_AIM_AUTO_MS;
        this.l2AimClock?.destroy();
        this.l2AimClock = undefined;
        this.guideNotice = ''; // el mismo texto, pero ahora con la mano en el botón
      }
    } else if (this.l2AimPause === 'wait' && now >= this.l2AimUntil) {
      // (25-11-2026, usuario) 10 s sin pegarle: el saque directo sale solo
      this.l2AimRelease();
      this.beginSwing();
    }
  }
  private l2AimRelease() {
    if (this.l2AimPause !== 'on' && this.l2AimPause !== 'wait') return;
    this.l2AimPause = 'done';
    for (const p of this.l2AimPose) if (p.sp.active && p.sp.anims?.isPaused) p.sp.anims.resume();
    this.l2AimPose = [];
    this.l2AimClock?.destroy();
    this.l2AimClock = undefined;
  }
  /**
   * (25-11-2026, usuario) peloteo guiado del nivel 1 (guideMove 3): k = golpe (0 el saque del bot a tu derecha; 1 arriba a la izquierda;
   * 2 arriba a la derecha; 3 todo el rectángulo de abajo). serve/feed = la pelota viene a ti; fly = la tuya va al bot; wait = el bot la
   * tiene hasta que llegas al cuadro; done = tu último golpe: bota dos veces en su campo y el punto es tuyo.
   */
  private guideRally: { k: number; st: 'serve' | 'held' | 'feed' | 'fly' | 'wait' | 'done'; hold?: { x: number; y: number; z: number }; bounced?: boolean } = { k: 0, st: 'serve' };
  /** (25-11-2026, usuario) cuadro de cada golpe del peloteo guiado: 1 = el de atrás a la IZQUIERDA (el contrario al primero), 2 = todo el de delante (ARRIBA) */
  private guideRallyZone(k: number) {
    return k <= 1 ? this.guideZoneRect(0, -1) : this.guideZoneRect(4);
  }
  /** (25-11-2026, usuario) peloteo guiado del nivel 1 en curso (tras el saque): el bot no se mueve, solo hace lo que manda el guion */
  private guideBotFrozen() {
    const st = this.guideRally.st;
    return this.guide === 'first' && this.score.played === 0 && this.guideMove === 3 && st !== 'serve';
  }
  private guidePracticeStep = 0;
  /** (26-11-2026) nivel 1: el sprite del rival en pausa al empezar */
  private botPoseHeld = false;
  /** (25-11-2026, usuario) nivel 1: pose del bot congelada mientras su saque está pausado */
  private guideBotPose: { sp: Phaser.GameObjects.Sprite; key: string; frame: string | number }[] = [];
  private guideText?: Phaser.GameObjects.Text;
  private guideZone?: Phaser.GameObjects.Graphics;
  /** (25-11-2026, usuario) nivel 1: todo se oscurece menos tu personaje, el cuadro al que vas, la pelota y el joystick */
  private guideDim?: Phaser.GameObjects.Graphics;
  private guideZonePts: { x: number; y: number }[] = [];
  private guideHand?: Phaser.GameObjects.Container;
  /** (25-11-2026, usuario) nivel 1, primer saque: dónde tocar la pantalla */
  private guideTapBox?: Phaser.GameObjects.Graphics;
  private guideNotice = '';
  private serveControlsOn = false;
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
  /** (26-11-2026, usuario) DUELO EN LA RED: RENDIRSE, EMOTES y AUTO se ocultan y luego vuelven como estaban */
  private duelHidden: { surrender: boolean; emotes: boolean; auto: boolean } | null = null;
  private duelHideButtons(hide: boolean) {
    const em = this.emotes?.button;
    if (hide) {
      if (this.duelHidden) return;
      this.duelHidden = { surrender: this.surrenderBtn.visible, emotes: !!em?.visible, auto: !!this.autoBtn?.visible };
      this.surrenderBtn.setVisible(false);
      em?.setVisible(false);
      this.autoBtn?.setVisible(false);
      return;
    }
    const h = this.duelHidden;
    if (!h) return;
    this.duelHidden = null;
    this.surrenderBtn.setVisible(h.surrender);
    em?.setVisible(h.emotes);
    this.autoBtn?.setVisible(h.auto);
  }
  /** emotes del jugador (ui/Emotes.ts): 3 caritas, una cada 10 s */
  private emotes!: Emotes;
  private sideScoreMarker?: Phaser.GameObjects.Container;
  private sideScoreMarkerTimer?: Phaser.Time.TimerEvent;
  private dialog: Phaser.GameObjects.GameObject[] = [];
  private paused = false;
  /** (24-11-2026, usuario) partido del TUTORIAL (contra el bot, modo desarrollo apagado, cuenta bajo el nivel 20): sin rendirse ni AUTO, un nivel por partido */
  private tutorial = false;
  /** (24-11-2026) entrenador del tutorial: pausas con explicación, demostraciones y el turno de 10 s (tutorial/MatchCoach.ts) */
  coach!: MatchCoach;
  /** (24-11-2026) misiones del tutorial de este nivel (domain/tutorialMissions.ts); null = las normales */
  private tutMissions: MissionId[] | null = null;
  /** (24-11-2026) sin todas las misiones no se sube (niveles con ejercicio guiado, domain/tutorialMissions.ts) */
  private tutMissionsRequired = false;
  /** puntos ganados en el partido (misión "Gana 3 puntos") */
  private tutPointsWon = 0;
  /** (24-11-2026) EJERCICIO del nivel 3 (direcciones) o 4 (ESPECIAL) en el primer punto; null = sin ejercicio */
  private lesson: 3 | 4 | null = null;
  private lessonStep = 0;
  /** paso del ejercicio cuya pausa ya salió (no se repite al volver a lanzar la pelota) */
  private lessonAsked = -1;
  /** dirección de golpe que usa el AUTO mientras el juego muestra el ejercicio (null = la suya) */
  private lessonAim: Phaser.Math.Vector2 | null = null;
  private baseScrollX = 0;
  /** última dirección del joystick (para elegir el tipo de golpe) */
  private lastDir = new Phaser.Math.Vector2();
  private lastDirAt = -1e9;
  /** dirección vertical del joystick (-1 arriba, 1 abajo, 0 nada / lado) y desde cuándo se mantiene */
  private vertDir = 0;
  private vertSince = 0;
  private keys?: Record<string, Phaser.Input.Keyboard.Key>;

  private phase: Phase = 'intro';
  private server: Who = 'player';
  /** ZONA (logic/Zone.ts): remontada; aura + rayo en los ojos y mejoras durante 2 puntos */
  private zone = new ZoneTracker();
  private zoneLevels: Record<ZoneSide, ZoneStatLevels> = { player: emptyZoneStats(), bot: emptyZoneStats() };
  /** PASIVA del personaje del usuario (domain/characterPassives.ts, docs/MAESTRIAS.md): 0 … 0,10 según su maestría. Solo la del usuario: el bot no tiene y el rival online aplica la suya en su teléfono */
  private passiveAgility = 0;
  private passivePrecision = 0;
  /** FUERZA (pasiva de Jun): velocidad extra de tus golpes (no globos ni dejadas) */
  private passiveStrength = 0;
  /** (25-11-2026, usuario) EFECTO de Mat: más curva en tu saque con efecto */
  private passiveSpin = 0;
  /** (26-11-2026, usuario) pasiva RESISTENCIA (Jun, Flo) */
  private passiveResistOn = false;
  /** hasta cuándo se ve la franja de la mirada del INFERNO (para no repetirla) */
  private zoneFx: Partial<Record<ZoneSide, ZoneFx>> = {};
  /** ESTILO DE ZONA de cada lado (domain/zoneSkins.ts) */
  private zoneLook: Record<ZoneSide, ZoneSkinDef> = { player: ZONE_SKINS.electric, bot: ZONE_SKINS.electric };
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
    this.recordHit(v);
  }
  private recordHit(v: Who | null, defensive = false) {
    if (v === 'player' && defensive) this.tutMission('tDef'); // (24-11-2026) misión del tutorial
    // (24-11-2026, usuario) NIVEL 2: paso 0 = el juego te muestra el DEFENSIVO; paso 1 = lo usas tú (o, pasados 10 s, lo hace solo)
    if (v === 'player' && defensive && this.practicingReturns()) {
      // (25-11-2026, usuario) nivel 2: una sola vez, la haces tú; la devolución va lejos del bot y el punto es tuyo
      this.guidePracticeStep = 2;
      this.l2Lock = false;
      this.l2Won = true;
      // (25-11-2026, usuario) la misión del DEFENSIVO se cumple al GANAR el punto (pointTo, antes del marcador), no al usarlo
      this.l2DefUsed = true;
      this.time.delayedCall(0, () => {
        if (!this.l2Won || this.phase !== 'rally') return;
        aimShot(this.ball.s, COURT.right - 70, this.bot.y < LAT_C ? COURT.bottom - 45 : COURT.top + 45, 700, 20);
      });
    }
    if (defensive && this.net && !this.netApplying) this.netHit.defensive = true;
    if (v && this._lastHitter && this.phase === 'rally' && !this.serving && !this.rallyForcedShot && (this.rallyRemaining === 0 || this.tutNetGuard(v)) && (!this.net || !this.netApplying || this.net.role === 'host')) {
      const s = this.ball.s;
      const dir = v === 'player' ? 1 : -1;
      const preferOut = defensive || this.ball.power || Math.abs(s.x - NET_X) <= NET_X - NET_ZONE_X;
      const out = preferOut && aimOutFault(s, dir, this.doubles);
      if (!out) aimNetFault(s, dir);
      this.dropZeroBack = null;
      this.rallyForcedShot = out ? 'out' : 'net';
      this.rallyFaultTut = this.rallyRemaining !== 0; // (tutorial, subiste a la red: no fue por TIEMPO)
    }
    if (this.rallyForcedShot === 'out') this.rallyOutMarkPending = true;
    // golpes del punto (saque = 1, resto = 2…): las habilidades se bloquean hasta que el resto ya salió (serveLock)
    this.shotsThisPoint = v === null ? 0 : this.shotsThisPoint + 1;
    this._lastHitter = v;
    // 2v2: quién del equipo pegó (el más cercano a la pelota) para acreditarle el punto en la pantalla de victoria
    if (this.doubles) {
      if (v === null) this.lastActorBySide = {};
      else {
        const team = v === 'player' ? [this.player, this.ally] : this.rivalActors;
        let best: Actor | null = null;
        let bd = Infinity;
        for (const a of team) {
          if (!a) continue;
          const d = (a.x - this.ball.s.x) ** 2 + (a.y - this.ball.s.y) ** 2;
          if (d < bd) { bd = d; best = a; }
        }
        if (best) this.lastActorBySide[v] = best;
      }
    }
    // MISIONES POR PARTIDA (domain/matchMissions.ts): cada golpe del punto; el del jugador lleva su etiqueta (ESPECIAL / GLOBO máximo)
    if (v === null) missionPointStart(this.missions);
    if (v === null) this.epicPoint = false;
    else missionHit(this.missions, v === 'player' ? 'player' : 'rival', v === 'player' ? this.missionShot : null);
    if (v === 'player') this.missionShot = null;
    if (v === 'player' && this.net && !this.netApplying) this.netHitPending = true;
    // 2v2 (19-11-2026): el equipo que RECIBE ya devolvió el saque: desde aquí el punto es libre para los cuatro
    if (v && this.serveReceiver && v !== this.server) this.serveReceiver = null;
    if (v === 'player' && this.doubles) this.pickRival(); // 2v2: la pelota va hacia el rival más cercano a donde cae
  }

  // ---------------------------------------------------------------- 2v2 (offline: tú + aliado BOT contra 2 rivales BOT)
  /**
   * (21-11-2026) MODO 2v2 (primera versión, solo contra BOTS): tú + 1 aliado BOT contra 2 rivales BOT. `this.player` sigue siendo tú y `this.bot` es el
   * RIVAL ACTIVO (el que está recibiendo la pelota: lo elige `pickRival` cada vez que tu equipo golpea, según dónde cae); el otro rival y el aliado se
   * mueven con un seguimiento sencillo (`doublesTick`). El aliado devuelve las pelotas que tú no alcanzas (`allyHit`). `lastHitter` sigue siendo del EQUIPO
   * ('player' = el tuyo, 'bot' = el rival), así que puntos, saque y marcador no cambian. Sin ranked ni red por ahora.
   */
  private doubles = false;
  private ally: Actor | null = null;
  private rivalActors: Actor[] = [];
  private rivalBrains: BotBrain[] = [];
  private allyName = 'Aliado';
  private rival2Name = 'Rival 2';
  /** (25-11-2026, usuario) 2v2 contra bots: personajes del compañero y de los dos rivales (los elige la búsqueda: doublesSkinsFor) */
  private duo: DoublesSkins | null = null;
  /** (25-11-2026) rival del 1v1 elegido por la búsqueda (modo desarrollo: al azar); null = rivalFor */
  private rivalPick: string | null = null;
  /**
   * (21-11-2026) 2v2 ONLINE: 2 humanos del MISMO equipo (host = quien simula a los 2 bots y juzga todos los puntos; invitado) contra 2 bots.
   * `ally` = el otro humano (actor REMOTO mientras `allyRemote`; si se va, lo juega el bot de siempre y al volver recupera el control).
   * En el invitado los 2 rivales también son remotos (`net2Bots`). Nada se espeja: los dos ven su campo abajo.
   */
  private get net2() {
    return !!this.net && this.net.mode === '2v2';
  }
  private get net2host() {
    return this.net2 && this.net!.role === 'host';
  }
  /** este teléfono simula a los bots rivales (contra bot, o host del 2v2 online) */
  private get simBots() {
    return !this.net || this.net2host;
  }
  /** el RIVAL HUMANO del 1v1 online (null en el 2v2: allí el compañero es del mismo equipo) */
  private get vsOpp() {
    return this.net && this.net.mode !== '2v2' ? this.net.opponent : null;
  }
  /** este teléfono saca con su personaje cuando le toca al equipo humano (en el 2v2 online, el humano que salga al azar en ese juego: net2IServe) */
  private get meServes() {
    return this.server === 'player' && (!this.net2 || this.net2IServe) && !this.allyServes;
  }
  /**
   * (19-11-2026, usuario) 2v2 CONTRA BOTS: el saque del equipo humano se ALTERNA por juego entre tú y el aliado bot (como los dos rivales:
   * un juego de saque cada uno). Saca solo, con el plan del rival (ServeAI). En el 2v2 online lo decide el azar entre los dos humanos (net2IServe).
   */
  private get allyServes() {
    return this.doubles && !this.net && !!this.ally && this.server === 'player' && Math.floor(this.score.gameIndex / 2) % 2 === 1;
  }
  /** cuándo lanza el aliado su saque (time.now, ms) */
  private allyTossAt = 0;
  /** 2v2 online: resultado del azar de quién saca, por número de juego (los dos teléfonos lo calculan igual) */
  private net2ServeCache = { game: -1, host: true };
  /**
   * 2v2 online: ¿saca el host cuando le toca al equipo humano? Al azar por juego (`hostServesGame`). Si el compañero está desconectado, saca siempre el
   * host (el bot aliado no saca). Al volver, se rejuega el punto con el azar de siempre.
   */
  private net2ServerIsHost(): boolean {
    if (this.net2host && !this.allyRemote) return true;
    const g = this.score.gameIndex;
    if (this.net2ServeCache.game !== g) this.net2ServeCache = { game: g, host: hostServesGame(this.net!.roomId, g) };
    return this.net2ServeCache.host;
  }
  /** 2v2 online: ¿el humano que saca en este juego soy yo? */
  private get net2IServe(): boolean {
    return this.net2host === this.net2ServerIsHost();
  }
  private allyRemote = false;
  /** estados remotos por actor: 0 = el otro humano, 1 y 2 = los bots del host (solo el invitado los recibe) */
  private net2Rem: { interp: RemoteInterp; last: StateMsg | null }[] = [];
  /** envío de los estados de los bots (host) */
  private net2BotSend: { at: number; x: number; y: number; moving: boolean }[] = [];
  /** a quién pertenece el golpe propio pendiente (0 = yo; 1 y 2 = un bot del host) */
  private netHitA = 0;
  /** host: hora (performance.now) de su último golpe enviado; si el compañero golpea a la vez, gana el del host */
  private net2HostHitAt = 0;
  /** cerebro del ALIADO (elige sus golpes con el mismo BotBrain, con las coordenadas espejadas) */
  private allyBrain: BotBrain | null = null;
  /** el equipo rival ya usó un ESPECIAL / ULTI en este punto: el compañero no lanza otro (coordinación) */
  private rivalSpecialUsed = false;
  /**
   * (23-11-2026, usuario) 2v2 CONTRA BOTS: cada bot con SU kit (ESPECIAL, ULTI y DEFENSIVO distintos, al azar, sin legendarios: ai/botKit.ts
   * randomDoublesKits). `rivalKits[i]` es el del rival i (`botKit` pasa a ser el del rival activo: useRivalKit); `allyKit`, el del aliado.
   * En red, vacío / el de siempre (allí los bots del host llevan el kit de su personaje).
   */
  private rivalKits: BotKit[] = [];
  private allyKit: BotKit = botKitFor('nxo');
  /** 2v2 contra bots (sin red): los tres bots usan sus habilidades en cuanto pueden */
  private get doublesOffline() {
    return this.doubles && !this.net;
  }
  /** el equipo rival ya lanzó un ESPECIAL / ULTI en este punto y su compañero no puede lanzar otro. Solo en el 2v2 online: contra bots no hay límite */
  private get rivalSpecialLimit() {
    return this.doubles && !!this.net && this.rivalSpecialUsed;
  }
  /** DEFENSIVO del ALIADO bot en curso (sprint del DASH) y si lo usó para la pelota que viene (más alcance, como el rival: BOT_DASH_REACH) */
  private allyDash: { t: number; ghosts: number } | null = null;
  private allyDashBall = false;
  /** pelota (golpe del punto) para la que el aliado ya decidió si usa su DEFENSIVO */
  private allyDefKey = '';
  /** contra bots, el kit del rival activo pasa a ser el del rival i */
  private useRivalKit(i: number) {
    if (this.rivalKits[i]) this.botKit = this.rivalKits[i];
  }
  /** MISIONES POR PARTIDA (1v1; docs/MISIONES.md): estado de la partida y etiqueta del golpe del jugador en curso */
  private missions = createMissionTracker();
  private missionShot: MissionShot = null;

  /** todos los personajes en cancha (1v1: tú y el rival; 2v2: los cuatro) */
  private everyone(): Actor[] {
    return this.doubles && this.ally ? [this.player, this.ally, ...this.rivalActors] : [this.player, this.bot];
  }

  /** el rival que NO está activo (null en 1v1) */
  private otherRival(): Actor | null {
    return this.doubles ? (this.rivalActors.find((a) => a !== this.bot) ?? null) : null;
  }

  /** Dónde va a botar la pelota (y lateral) en el campo rival; null si no hay bote previsto. */
  private predictLanding(): { x: number; y: number } | null {
    const s = { ...this.ball.s };
    for (let i = 0; i < 240; i++) {
      const ev = stepBall(s, 1 / 60);
      if (ev === 'net') return null;
      if (ev === 'bounce' && s.x > NET_X) return { x: s.x, y: s.y };
    }
    return null;
  }

  /** Elige cuál de los 2 rivales recibe: el más cercano (en lateral) a donde cae la pelota. Cambia `bot`, `brain` y `ai` al elegido. */
  private pickRival() {
    if (this.rivalActors.length < 2) return;
    // 2v2: el SAQUE solo lo devuelve el rival del cuadro cruzado (el otro no va a la pelota)
    if (this.serveReceiver && this.rivalActors.includes(this.serveReceiver)) {
      const i = this.rivalActors.indexOf(this.serveReceiver);
      this.bot = this.rivalActors[i];
      this.brain = this.rivalBrains[i];
      this.ai = this.brain.ai;
      this.useRivalKit(i);
      return;
    }
    const land = this.predictLanding();
    const y = land ? land.y : this.ball.s.y;
    let best = 0;
    for (let i = 1; i < 2; i++) if (Math.abs(this.rivalActors[i].y - y) < Math.abs(this.rivalActors[best].y - y) - 8) best = i;
    const a = this.rivalActors[best];
    if (a === this.bot) return;
    this.bot = a;
    this.brain = this.rivalBrains[best];
    this.ai = this.brain.ai;
    this.useRivalKit(best);
  }

  /** Mueve hacia un punto (sin cerebro) y pone la animación de carrera. Devuelve si se está moviendo. */
  private followTo(a: Actor, tx: number, ty: number, dt: number, speed: number, xr: [number, number]) {
    const dx = tx - a.x;
    const dy = ty - a.y;
    const d = Math.hypot(dx, dy);
    const step = Math.min(d, speed * dt);
    if (d > 3) {
      a.x = clamp(a.x + (dx / d) * step, xr[0], xr[1]);
      a.y = clamp(a.y + (dy / d) * step, Y_MIN, Y_MAX);
    }
    const moving = d > 6 && a.stun <= 0 && !a.vanished;
    a.ch.setMoving(moving, dy);
    return moving;
  }

  /** (23-11-2026) 2v2: sitio de cobertura suavizado y lado (histéresis) del aliado y del rival que no recibe (ai/doublesPositioning.ts) */
  private allyCover = { y: NaN, side: 0 as -1 | 0 | 1 };
  private rivalCover = { y: NaN, side: 0 as -1 | 0 | 1, who: null as Actor | null };
  /** lateral de referencia de la pelota para colocarse: dónde va a caer (en cualquier campo) o, sin bote previsto, dónde está */
  private doublesBallRef(): number {
    const s = this.ball.s;
    if (this.phase !== 'rally') return LAT_C + (s.y - LAT_C) * 0.5;
    const land = s.vx < 0 ? this.landingMine() : this.predictLanding();
    return land ? land.y : s.y;
  }
  /** lateral donde cubre `self`, compañero de `mate` (suavizado: no copia al instante cada paso del otro) */
  private doublesCover(cov: { y: number; side: -1 | 0 | 1 }, self: Actor, mate: Actor, ref: number, dt: number) {
    const c = coverY(mate.y, ref, { top: LAT_C - HALF_W, bottom: LAT_C + HALF_W }, cov.side);
    cov.side = c.side;
    cov.y = Number.isFinite(cov.y) ? smoothToward(cov.y, c.y, dt) : self.y;
    return clamp(cov.y, Y_MIN + 40, Y_MAX - 40);
  }

  /**
   * 2v2: cada fotograma mueve al aliado y al rival que no recibe (el activo lo mueve su cerebro, como siempre). FORMACIÓN "uno arriba, uno atrás":
   * si el que recibe / el jugador está atrás, su compañero sube a la red; si está en la red, el compañero cubre el fondo.
   * (23-11-2026, usuario) EN LATERAL ya no se pone en el espejo del otro (si ibas pegado a un lado, el aliado se iba pegado al otro y nadie
   * cubría el medio; al medio, los dos quedaban encimados): la pareja se corre junta hacia la pelota y cada uno cubre su mitad (coverY).
   * El rival que acaba de golpear vuelve al centro de SU mitad, no al medio de la cancha (homeY).
   */
  private doublesTick(dt: number) {
    const ally = this.ally;
    if (!ally) return;
    const s = this.ball.s;
    const live = (this.phase === 'rally' || this.phase === 'serve' || this.phase === 'toss') && !this.entering;
    const calm = live && this.phase !== 'pointover';
    const ref = calm ? this.doublesBallRef() : LAT_C;
    // --- aliado: va a la pelota si le cae más cerca que a ti; si no, cubre su mitad (en la red si tú estás atrás)
    const allyNet = this.player.x < NET_X - 250;
    let ax = allyNet ? NET_X - DOUBLES_NET_GAP : COURT.left + 60;
    if (!calm) this.allyCover.y = NaN; // al volver a jugar, empieza desde donde está
    let ay = calm ? this.doublesCover(this.allyCover, ally, this.player, ref, dt) : ally.y;
    const incoming = this.phase === 'rally' && this.lastHitter !== 'player' && s.vx < 0 && s.x < NET_X + 60;
    let chase = false;
    if (incoming) {
      const land = this.landingMine();
      // resto del saque: va siempre si recibe él y nunca si recibes tú (19-11-2026, dobles reales)
      const mine = this.serveReceiver === ally ? true : this.serveReceiver === this.player ? false : null;
      if (land && (mine ?? Math.abs(land.y - ally.y) < Math.abs(land.y - this.player.y) - 10)) {
        ax = clamp(land.x - 12, P_X[0], P_X[1]);
        ay = clamp(land.y, Y_MIN, Y_MAX);
        chase = true;
      }
    }
    // (19-11-2026, usuario) el ALIADO bot que SACA no se mueve de su sitio de saque mientras se prepara / lanza (antes seguía en espejo al
    // jugador y se le veía subir o bajar de su fila)
    const allyServing = this.allyServes && (this.phase === 'serve' || this.phase === 'toss');
    if (!this.allyRemote) {
      // (23-11-2026, usuario) ESTADOS del aliado bot: el aturdido corre aquí (antes no bajaba nunca), sus recargas también, y sin raqueta
      // (ULTI recibida) va a buscarla en vez de cubrir
      if (ally.stun > 0) ally.stun -= dt;
      if (this.phase !== 'intro' && this.phase !== 'over') this.allyBrain?.tickCooldowns(dt);
      if (ally.racket && calm) {
        ax = ally.racket.x;
        ay = ally.racket.y;
      } else if (chase) this.allyDefensiveCheck(ax, ay);
    }
    const allyBusy = ally.stun > 0 || ally.vanished || !!ally.launched; // aturdido, en pleno DESTELLO o volando ¡A LAS ESTRELLAS!: no se mueve
    if (this.allyRemote) {
      /* el compañero humano lo mueve su teléfono (net2Tick) */
    } else if (this.netBotFly?.actor === ally) {
      this.netBotFlyTick(dt); // su SOMBRA / SUPERSALTO / VOLTERETA / PATINAJE: su recorrido manda
    } else if (allyServing || (allyBusy && !this.entering)) {
      ally.ch.setMoving(false, 0);
    } else if (this.entering) {
      /* (19-11-2026, usuario) ENTRADA: la caminata la lleva entranceWalk (antes aquí se le paraba en cada fotograma y no caminaba) */
    } else if (calm) this.allyMove(ax, ay, dt);
    else ally.ch.setMoving(false, 0);
    this.updateFacing(ally);
    // --- el rival que NO recibe: sube a la red si el que recibe está atrás; si no, cubre el fondo. Su cerebro lleva su sitio de espera (homeX) para volear
    const other = this.otherRival();
    if (other) {
      const idx = this.rivalActors.indexOf(other);
      const otherNet = this.bot.x > NET_X + 250;
      if (this.rivalCover.who !== other || !calm) this.rivalCover = { y: NaN, side: 0, who: other }; // cambió quién cubre: empieza donde está
      const oy = calm ? this.doublesCover(this.rivalCover, other, this.bot, ref, dt) : other.y;
      const ob = this.rivalBrains[idx];
      ob.ai.homeX = otherNet ? NET_X + DOUBLES_NET_GAP : null;
      // tras golpear, cada rival vuelve al centro de SU mitad (BotBrain.onShot usa ai.home), no al medio de la cancha
      const lane = { top: LAT_C - HALF_W, bottom: LAT_C + HALF_W };
      this.brain.ai.homeY = doublesHomeY(this.bot.y, other.y, lane);
      ob.ai.homeY = doublesHomeY(other.y, this.bot.y, lane);
      // (23-11-2026, usuario) ESTADOS del rival que no recibe: su aturdido y sus recargas siguen corriendo (antes solo corrían con la pelota
      // para él: BotBrain.tick) y, sin raqueta, va a buscarla
      if (other.stun > 0) other.stun -= dt;
      if (this.phase !== 'intro' && this.phase !== 'over') ob.tickCooldowns(dt);
      const busy = other.stun > 0 || other.vanished || !!other.launched;
      if (this.entering) {
        /* ENTRADA: camina con entranceWalk (no se le para) */
      } else if (this.netBotFly?.actor === other) {
        /* (19-11-2026) en pleno DEFENSIVO (SOMBRA / SUPERSALTO…): su recorrido manda (netBotFlyTick) */
        this.netBotFlyTick(dt);
      } else if (busy) other.ch.setMoving(false, 0);
      else if (calm && other.racket) this.followTo(other, other.racket.x, other.racket.y, dt, this.rivalBrains[idx].ai.speed, [B_X[0], B_X[1]]);
      else if (calm) this.followTo(other, otherNet ? NET_X + DOUBLES_NET_GAP : COURT.right + 40, oy, dt, PLAYER_SPEED * 0.8, [B_X[0], B_X[1]]);
      else other.ch.setMoving(false, 0);
      this.updateFacing(other);
    }
  }
  /** Mueve al aliado bot hacia (tx, ty): a su paso de siempre o, con su DASH en curso, al sprint (con sus 3 sombras, como el del rival). */
  private allyMove(tx: number, ty: number, dt: number) {
    const a = this.ally!;
    const d = this.allyDash;
    if (!d) {
      this.followTo(a, tx, ty, dt, PLAYER_SPEED * 0.85, [P_X[0], P_X[1]]);
      return;
    }
    d.t += dt;
    this.followTo(a, tx, ty, dt, PLAYER_SPEED * 0.85 * ALLY_DASH.mult, [P_X[0], P_X[1]]);
    if (d.ghosts < 3 && d.t >= 0.09 * (d.ghosts + 1)) {
      this.renderActorPose(a);
      this.dashFx.ghost(a.ch, d.ghosts, a.ch.depth);
      d.ghosts++;
    }
    const near = Math.hypot(tx - a.x, ty - a.y) <= ALLY_DASH.landDist;
    if (d.t >= ALLY_DASH.time || near) {
      this.allyDash = null;
      a.ch.setSprint(false, ty - a.y, near); // llegó: frenada de la hoja; cortado lejos: sigue corriendo
    }
  }

  /**
   * (23-11-2026, usuario) DEFENSIVO del ALIADO bot: una vez por pelota, si va a por ella y a su paso no llega a tiempo (misma regla que el
   * rival: BotBrain DASH_AI.needS) y su DEFENSIVO está listo, lo usa. Nunca en el saque y su resto, sin raqueta, aturdido ni desaparecido.
   */
  private allyDefensiveCheck(tx: number, ty: number) {
    const a = this.ally!;
    const brain = this.allyBrain;
    const key = `${this.score.played}-${this.shotsThisPoint}`;
    if (this.allyDefKey === key) return;
    this.allyDefKey = key;
    this.allyDashBall = false; // pelota nueva: el DEFENSIVO de la anterior ya no cuenta
    if (!brain || !this.doublesOffline || this.serveLock || a.racket || a.stun > 0 || a.vanished || this.netBotFly || this.allyDash || !brain.dashReady) return;
    if (Math.hypot(tx - a.x, ty - a.y) / (PLAYER_SPEED * 0.85) <= ALLY_DASH.needS) return; // llega a su paso
    brain.useDash();
    this.allyDashBall = true;
    this.allyDefensive({ x: tx, y: ty });
  }

  /** El aliado lanza SU DEFENSIVO (allyKit) hacia `to`: DASH (sprint), DESTELLO o SOMBRA / SUPERSALTO / VOLTERETA / PATINAJE (los del rival bot). */
  private allyDefensive(to: { x: number; y: number }) {
    const a = this.ally!;
    const kind = this.allyKit.defensive;
    if (kind === 'blink') return this.botBlink(a, to, P_X);
    if (kind === 'shadow' || kind === 'jump' || kind === 'flip' || kind === 'skate') return this.botFly(kind, a, to, P_X);
    a.ch.setSprint(true, to.y - a.y);
    const h = this.headPos(a);
    this.popText(h.x, h.y - 10, 'DEFENSIVO', '#8fd0ff', 26);
    this.dustFx(a.x, a.y);
    const p = project(a.x, a.y);
    this.dashFx.burst(p.sx, p.sy, p.s * VIEW.CHAR_K, a.ch.depth);
    sfx(this, dashSfx(this.allyKit.smash));
    this.allyDash = { t: 0, ghosts: 0 };
  }

  /** dónde cae la pelota que viene hacia MI campo (primer bote antes de la red o su paso) */
  private landingMine(): { x: number; y: number } | null {
    const s = { ...this.ball.s };
    for (let i = 0; i < 240; i++) {
      const ev = stepBall(s, 1 / 60);
      if (ev === 'net') return null;
      if (ev === 'bounce' && s.x < NET_X) return { x: s.x + 18, y: s.y };
      if (s.x < COURT.left - 80) return { x: s.x, y: s.y };
    }
    return { x: s.x, y: s.y };
  }

  /** ¿El aliado devuelve esta pelota? (tú tienes prioridad: si tú llegas, golpeas tú) */
  private allyCanHit(s: BallState) {
    const a = this.ally;
    if (!this.doubles || !a || this.allyRemote || a.stun > 0 || a.vanished || a.racket) return false;
    // resto del SAQUE: solo el del cuadro cruzado (si eres tú, el aliado no la toca; si es él, la devuelve aunque tú estés cerca)
    if (this.serveReceiver === this.player) return false;
    // (23-11-2026) con su DEFENSIVO usado para esta pelota llega un poco más lejos (como el rival bot: BOT_DASH_REACH)
    const reach = this.inReach(a, s) || (this.allyDashBall && this.inReach(a, s, HIT_RANGE * BOT_DASH_REACH));
    if (this.serveReceiver === a) return reach;
    return reach && !this.inReach(this.player, s);
  }

  /**
   * 2v2 (19-11-2026, dobles reales): quien puede devolver el SAQUE en curso. Solo el del equipo que recibe que está en el lado del cuadro
   * cruzado; se fija al colocarse para sacar (placeForServe) y se borra cuando ese equipo devuelve (lastHitter). null = 1v1 o punto libre.
   */
  private serveReceiver: Actor | null = null;
  /** ¿`a` NO puede golpear ahora porque el saque es del otro jugador de su equipo? (no la alcanza; no es falta) */
  private serveBlocked(a: Actor) {
    return !!this.serveReceiver && this.serveReceiver !== a && (a === this.player || a === this.ally) === (this.serveReceiver === this.player || this.serveReceiver === this.ally);
  }

  /**
   * El aliado devuelve con el MISMO cerebro de los bots (BotBrain.planShot) pero en coordenadas espejadas: la pelota y los rivales se ven "como si el
   * aliado fuera el rival de arriba". El plan (tx, ty) se desespeja. Elige profundo, cruzado, dejada…; sin ESPECIAL ni ULTI (por ahora).
   */
  private allyHit() {
    const a = this.ally!;
    const s = this.ball.s;
    const brain = this.allyBrain;
    a.ch.facing = s.y > a.y ? 1 : -1;
    // (23-11-2026, usuario) contra bots el aliado usa su ULTI y su ESPECIAL en cuanto puede (sus recargas: BotBrain.eager), con las reglas de
    // siempre: nunca en el saque y su resto, ni en plena cinemática, ni ULTI contra ULTI (ultiBlocked)
    const abilities = this.doublesOffline && !!brain && !this.serveLock && !this.cineLock && this.phase === 'rally';
    if (abilities && this.allyUlti(s)) return;
    if (brain) {
      const m = { ...s, x: mirrorX(s.x), vx: -s.vx };
      const power = abilities && brain.smashReady;
      const shot = brain.planShot(m, { playerX: mirrorX(this.bot.x), playerY: this.bot.y, botX: mirrorX(a.x), botY: a.y }, false, !power, power);
      // ESPECIAL del aliado: la misma cinemática que el tuyo y el del rival (partido congelado, foco en él); el golpe sale al terminar
      if (shot.power && smashCineEnabled()) {
        const lead = a.ch.swing(true, false, false, false, true); // pose de carga (frame 4)
        this.cine.start({
          profile: smashCine(this.allyKit.smash),
          freeze: this.freezeSprites(),
          executor: spritesIn(a.ch),
          leadMs: Math.min(lead, 150),
          focus: () => this.cineFocus(a),
          onHit: () => {
            if (this.phase === 'rally' && this.lastHitter !== 'player') this.applyAllyShot(shot, false);
          },
        });
        return;
      }
      this.applyAllyShot(shot, false);
      return;
    }
    // sin cerebro (no debería pasar): un golpe normal al campo rival
    const ty = LAT_C + clamp((this.bot.y > LAT_C ? -1 : 1) * rand(0.25, 0.85), -1, 1) * (HALF_W - 28);
    // tx en coordenadas espejadas, como las del cerebro (applyAllyShot lo pasa al campo rival)
    this.applyAllyShot({ tx: NET_X - (NET_X - COURT.left) * rand(0.55, 0.9), ty, speed: SHOT_SPEED * rand(0.88, 1.0), kind: 'normal', margin: 18, intent: 'normal', quality: 1 }, false);
  }

  /**
   * Aplica el golpe del ALIADO ya decidido (`shot` en coordenadas espejadas de BotBrain.planShot). Con `power`: su ESPECIAL (bola de su
   * poder); con `ulti`: su ULTI (esfera de su poder, como la del rival: applyBotShot). Para el rival es un golpe de tu equipo ('player'):
   * su ESPECIAL / ULTI le revienta igual que el tuyo (fireImpact) y sin raqueta lo manda ¡A LAS ESTRELLAS!
   */
  private applyAllyShot(shot: ReturnType<BotBrain['planShot']>, ulti: boolean) {
    const a = this.ally!;
    const s = this.ball.s;
    if (this.netBotFly?.actor === a) this.netEndBotFly(true); // golpea: su SOMBRA / SUPERSALTO / VOLTERETA / PATINAJE termina ya en el punto
    const power = !!shot.power;
    const el = this.allyKit.inferno;
    const volley = this.bounces === 0 && a.x >= NET_ZONE_X;
    const ultiOver = ulti && s.z > OVERHEAD_Z;
    const fxDelay = power ? a.ch.swing(true, ultiOver, ultiOver) : a.ch.swing(false, false, false, volley);
    if (power && !ulti) a.ch.holdFollowThrough(SPECIAL_HOLD_FRAME, SPECIAL_IMPACT_HOLD_MS);
    s.z = Math.max(s.z, 22);
    const tx = mirrorX(shot.tx);
    const ty = shot.ty;
    aimShot(s, tx, ty, shot.speed, shot.margin, shot.kind === 'lob' || !power ? BOT_LOB_MAX_STRETCH : Infinity);
    if (shot.kind !== 'lob' && !power) {
      const apex = () => s.z + (s.vz > 0 ? (s.vz * s.vz) / (2 * (s.g ?? GRAVITY)) : 0);
      for (let sp = shot.speed; apex() > BOT_FLAT.apex && sp < shot.speed * BOT_FLAT.maxSpeed; ) {
        sp = Math.min(shot.speed * BOT_FLAT.maxSpeed, sp * 1.06);
        aimShot(s, tx, ty, sp, shot.margin, BOT_LOB_MAX_STRETCH);
      }
    }
    if (power && !ulti) this.setSmashFlight(this.allyKit.smash);
    this.ball.setPower(power);
    this.ball.setKind(shot.kind);
    const wasApplying = this.netApplying;
    this.netApplying = true; // el golpe del BOT aliado no se envía como golpe mío
    this.recordHit('player', this.allyDashBall);
    this.netApplying = wasApplying;
    this.bounces = 0;
    this.allyDashBall = false;
    this.ai.onPlayerHit(power);
    this.hitFxAt(fxDelay, s.x, s.y, s.z, power, 0.15, ulti, ulti ? el : power ? this.allyKit.smash : undefined);
    const h = this.headPos(a);
    if (ulti) {
      // ULTI: esfera de su poder en vuelo, explosión, sacudida y sonido (los mismos que la del rival y la tuya)
      this.infernoFlight = true;
      this.infernoBounced = false;
      this.infernoEl = el;
      this.fire.setElement(el);
      const b = project(s.x, s.y, s.z);
      infernoImpactFx(this, b.sx, b.sy, b.s, el);
      infernoShake(this);
      infernoSound.impact(this, el);
      this.ball.quietFx = true;
    } else if (power) this.popText(h.x, h.y - 10, 'ESPECIAL', '#8fd0ff', 28);
  }

  /**
   * ULTI del ALIADO bot (contra bots): con su carga completa (3 puntos de tu equipo) hace la cinemática del INFERNO de su poder (mirada,
   * energía, desplazamiento con sombras) y luego el golpe. Mismas reglas que la del rival (botUlti): sin ULTI contra ULTI. true = la lanzó.
   */
  private allyUlti(s: BallState): boolean {
    const a = this.ally!;
    const brain = this.allyBrain;
    if (!brain || this.ultiBlocked('player') || this.ultiOwner === 'player' || this.inferno.armed) return false; // la tuya (o la del rival) en juego: espera
    const m = { ...s, x: mirrorX(s.x), vx: -s.vx };
    const ctx = { playerX: mirrorX(this.bot.x), playerY: this.bot.y, botX: mirrorX(a.x), botY: a.y };
    if (!brain.wantsUlti(m, ctx)) return false;
    this.ultiStart('player', this.bot);
    const el: InfernoElement = this.allyKit.inferno;
    const from = { x: a.x, y: a.y };
    const k = brain.ultiMoveToBall;
    const to = { x: clamp(from.x + (s.x - from.x) * k, P_X[0], P_X[1]), y: clamp(from.y + (s.y - from.y) * k, Y_MIN, Y_MAX) };
    if (!a.ch.infernoHold()) a.ch.setCharging(true);
    const sprites = spritesIn(a.ch);
    const dashSt = { sound: false };
    infernoSound.charge(this);
    showInfernoGaze(this, INFERNO_CINE.hitAtMs - GAZE_END_BEFORE_HIT_MS, this.gazeY(), this.skinOf(a), el);
    this.ghosts.setLook(INFERNO_LOOK[el].ghostTint, INFERNO_LOOK[el].ghostRamp);
    this.cine.start({
      profile: infernoCine(el),
      freeze: this.freezeSprites(),
      executor: sprites,
      leadMs: 0,
      focus: () => this.cineFocus(a),
      onCancel: () => {
        a.ch.infernoRelease();
        a.ch.setCharging(false);
        this.ghosts.clear();
      },
      onFrame: (e) => {
        if (e >= INFERNO_CINE.hitAtMs - INFERNO_PRE_MS) a.ch.infernoPre();
        if (e < INFERNO.dash.fromMs) return;
        this.infernoDashStep(e, a, from, to, sprites, dashSt, el);
      },
      onHit: () => {
        a.x = to.x;
        a.y = to.y;
        a.ch.setCharging(false); // suelta la pose de espera: el golpe sigue desde la raqueta atrás
        this.ghosts.end();
        if (this.phase === 'rally' && this.lastHitter !== 'player' && a.stun <= 0) {
          const m2 = { ...this.ball.s, x: mirrorX(this.ball.s.x), vx: -this.ball.s.vx };
          this.applyAllyShot(brain.planShot(m2, { playerX: mirrorX(this.bot.x), playerY: this.bot.y, botX: mirrorX(a.x), botY: a.y }, true), true);
        } else a.ch.infernoRelease();
      },
    });
    return true;
  }

  /**
   * IMPACTO al ALIADO bot (contra bots): alcanza el ESPECIAL o la ULTI del rival. Como el tuyo (playerImpact): devolución floja (globo al
   * campo rival), retroceso y aturdido; la ULTI además le hace volar la raqueta y tiene que ir a buscarla (doublesTick). Sin niebla ni vibración
   * (eso es solo del usuario).
   */
  private allyImpact() {
    const s = this.ball.s;
    const a = this.ally!;
    if (this.netBotFly?.actor === a) this.netEndBotFly(true);
    const kind: PowerKind = this.infernoFlight ? 'inferno' : 'smash';
    const stunMs = stunMsFor(kind);
    const feet = project(a.x, a.y);
    const head = this.headPos(a);
    const at = kind === 'inferno' ? project(s.x, s.y, s.z) : { sx: feet.sx, sy: (feet.sy + head.y) / 2 };
    this.stunFog.keepNew(new Set(this.children.list), 900);
    powerImpactFx(this, kind, at.sx, at.sy, feet.s, kind === 'inferno' ? this.infernoEl : this.smashFlightEl, kind === 'inferno' ? feet.sy : undefined);
    // la bola de la ULTI se acaba en el impacto (como en fireImpact)
    this.infernoFlight = false;
    this.infernoBounced = true;
    this.ball.quietFx = false;
    this.fire.clear();
    this.allyDash = null;
    // devolución débil: GLOBO al centro del campo rival (genera su círculo del SMASH)
    const tx = NET_X + (COURT.right - NET_X) * rand(0.45, 0.7);
    const ty = LAT_C + rand(-0.5, 0.5) * HALF_W;
    s.z = Math.max(s.z, 22);
    this.smashableLob(s, tx, ty);
    this.ball.setPower(false);
    this.ball.setKind('lob');
    const wasApplying = this.netApplying;
    this.netApplying = true;
    this.lastHitter = 'player';
    this.netApplying = wasApplying;
    this.bounces = 0;
    this.allyDashBall = false;
    this.ai.onPlayerHit(false);
    a.stun = stunSeconds(kind);
    this.tweens.killTweensOf(a);
    this.tweens.add({ targets: a, x: clamp(a.x - KNOCKBACK_DIST, P_X[0], P_X[1]), duration: POWER_IMPACT.knockback.ms, ease: 'Cubic.easeOut' });
    if (!a.ch.impactStun(kind, stunMs, kind !== 'inferno')) {
      a.ch.swing();
      this.tweens.add({ targets: a.ch.rig, angle: { from: -POWER_IMPACT.recoilDeg * a.ch.facing, to: 0 }, duration: stunMs, ease: 'Elastic.easeOut' });
    }
    this.popText(head.x, head.y - 10, '¡ATURDIDO!', '#ff9aa3', 30);
    if (kind === 'inferno') {
      this.ultiStunOn(a, stunMs);
      this.loseRacket(a);
    }
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
  /** (red) colocado para el saque del punto en curso (y desde cuándo, performance.now) */
  private netPlaced = false;
  private netPlacedAt = 0;
  /** (red) desfase del dibujo del rival respecto al punto de su golpe, que se apaga en NET_SNAP_MS */
  private netSnap: { x: number; y: number; at: number; ms?: number } | null = null;
  /** (red) segundos de atraso de la pelota del golpe rival que aún faltan por recuperar (se recuperan acelerándola un poco) */
  private netBallCatch = 0;
  /** (red) acaba de enviar "se detuvo": se repite pronto por si se pierde */
  private netStopRepeat = false;
  /** (red) filtro por número de punto desactivado (tras una reconexión el conteo puede no cuadrar) */
  private netPtOff = false;
  /** número de punto de los estados propios: 2·puntos jugados + 1 si ya está colocado para el saque */
  private get netPt() {
    return this.score.played * 2 + (this.netPlaced ? 1 : 0);
  }
  /** último estado enviado al rival (para no repetirlo mientras el jugador está quieto) */
  private netLastState: { x: number; y: number; moving: boolean; dirX: number; facing: number; charging: boolean; stunned: boolean; pt: number } | null = null;
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
  /** (19-11-2026) `actor` = el que lo lanzó: en el 2v2 el rival activo (`this.bot`) cambia durante el punto y el recorrido movía al OTRO rival */
  private netBotFly: { kind: 'shadow' | 'jump' | 'flip' | 'skate'; from: { x: number; y: number }; to: { x: number; y: number }; t: number; dur: number; ghosts: number; puff: { t: number }; clone?: Character; mid?: boolean; trail?: IceTrail; actor?: Actor } | null = null;
  /** lanzamiento del rival que llegó antes de que aquí empezara el punto */
  private netPendingToss: string | null = null;
  /** datos REALES del golpe propio que se enviarán en game:hit (los rellenan playerHit / executeServe / playerLunge / playerImpact) */
  private netHit: Partial<Pick<HitMsg, 'charged' | 'overhead' | 'volley' | 'serveSpin' | 'lunge' | 'impact' | 'special' | 'shock' | 'defensive'>> = {};
  /** cinemática del rival en curso (SMASH / INFERNO vista desde este teléfono): su golpe llegará al terminar */
  private netRemoteCine = false;
  /** DUELO EN LA RED en curso (logic/NetDuel.ts) · ya hubo uno en este punto · quién defiende el globo final (el bot lo intenta con estirada) */
  private duel: DuelState | null = null;
  private duelUsed = false;
  /**
   * (18-11-2026, usuario) PUNTO ÉPICO del jugador: en este punto devolvió una ULTI o un ESPECIAL del rival o usó su DASH (defensivo).
   * Si gana el punto celebra de rodillas (`point-cheer`, NxoActor.pointEnd).
   */
  private epicPoint = false;
  private duelDefend: Who | null = null;
  /** el bot decidió (una vez por globo) si se tira a por el globo del duelo */
  private duelLungeRoll: boolean | null = null;
  /** cámara del DUELO RED: cuánto se ha acercado a la red (0..1; baja sola al salir el globo) y a qué punto de pantalla */
  /** hasta este instante (performance.now) el GLOBO DISPARADO del duelo no se puede alcanzar (pasa justo sobre el que defiende, pegado a la red) */
  private duelLobUntil = 0;
  private duelCamK = 0;
  /** cuánto se acerca la cámara ahora (NET_DUEL.camZoom + camPress por ronda; suavizado) y cuánto está escondido el marcador (0 = visible, 1 = oculto) */
  private duelZoomAmt = 0;
  private duelHudK = 0;
  /** (prueba del bot en la red) el bot se queda pegado a la red solo cuando ya pasó el saque y su resto */
  private netTestOn = false;
  private duelCamMid = { sx: 360, sy: 640 };
  /** hubo una cinemática (al salir, el rival se ancla donde quedó) */
  private netCineSeen = false;
  /** (log) el segundo de fluidez en curso tuvo una cinemática: no se registra */
  private fluSkip = false;
  /** avisos del rival que llegaron durante su cinemática: se aplican, en orden, cuando termina */
  private netDeferred: Array<() => void> = [];
  /** aura del SMASH armado del rival (solo en red) */
  private botAura: HyperAura | null = null;
  private bounces = 0;
  private smashArmed = false;
  /** globo en vuelo: caída prevista y reglas del SMASH potenciado (src/logic/LobSmash.ts) */
  private lob = new LobTracker();
  /** REMATE del globo en curso: cámara lenta, apuntado a 4 cuadros y aro que se cierra (REMATE en logic/LobSmash.ts) */
  private remateCine: { t: number; T: number; x0: number; y0: number; ox: number; oy: number; aim: { col: -1 | 1; row: 'short' | 'deep' }; g: Phaser.GameObjects.Graphics; ring: Phaser.GameObjects.Graphics; label?: Phaser.GameObjects.Text } | null = null;
  /** golpe del remate ya decidido (lo usa playerHit): destino, velocidad y si fue SMASH! */
  private remateShot: { tx: number; ty: number; speed: number; perfect: boolean } | null = null;
  /** cámara lenta del partido (1 = normal) */
  private slowMo = 1;
  /** remate fallado (golpe al aire) en este globo: no vuelve a empezar hasta otro globo */
  private remateWhiffed = false;
  /** s que quedan de la recuperación tras el golpe al aire (sin moverse ni golpear) */
  private remateRecover = 0;
  /** golpe al aire (MUY PRONTO): sin golpear la pelota hasta que bote; hay que ir a buscarla */
  private remateWhiffBlock = false;
  /** REMATE del BOT en curso: cuándo golpea (fracción del cierre: 1 = SMASH!) y a qué cuadro de tu campo */
  private botRemate: { t: number; T: number; hitAt: number; col: -1 | 1; row: 'short' | 'deep'; label?: Phaser.GameObjects.Text; swung?: boolean } | null = null;
  /** texto REMATE del rival en red (se quita cuando golpea) */
  private netRemateLabel: Phaser.GameObjects.Text | null = null;
  /** si el BOT intenta rematar el globo en curso (se decide una vez por globo; null = aún no) */
  private botRemateRoll: boolean | null = null;
  /** juego (score.gameIndex) en que el BOT ya hizo su REMATE: como mucho uno por juego (16-11-2026, "que no lo haga a cada rato") */
  private botRemateGame = -1;
  /** 2v2: puntos ganados por cada jugador (al ?ltimo que pegó del equipo que gan? el punto) */
  private pointStats = { me: 0, ally: 0, r1: 0, r2: 0 };
  private lastActorBySide: { player?: Actor; bot?: Actor } = {};
  private lobMarker!: LobMarker;
  /** el SMASH se armó dentro de la ventana del globo (si al golpear se cumple todo, sale potenciado) */
  private superArmed = false;
  /** humo del SMASH en vuelo; `superFlight` = el SMASH en vuelo es el potenciado (humo fuerte) */
  private smoke!: SmokeTrail;
  /** forma propia del ESPECIAL de hielo / viento / rayo en vuelo (copo, torbellino, descargas) */
  private elementFx!: SmashElementFx;
  /** DROP SHOT 0 en vuelo: aire de ventilador que irradia de la pelota */
  private dropZeroFx!: DropZeroFx;
  /** "TU SAQUE" / "SACA <RIVAL>" sobre la cabeza de quien saca */
  private serveTag!: ServeTurnTag;
  /** el lanzamiento actual empezó con el botón verde (puede salir saque DIRECTO) */
  private serveDirect = false;
  /** 0..1: cuánto zoom de remate hay (jugador dentro del círculo del globo) */
  private lobZoomK = 0;
  /** GLOBO DISPARADO en vuelo (globo cargado al máximo): quién lo tiró; la cámara se aleja mientras vuela (maxLobK 0..1) */
  private maxLob: { hitter: Who } | null = null;
  /** el GLOBO DISPARADO del duelo (más alto): la cámara se aleja más que con el de siempre */
  private maxLobWide = false;
  /** el próximo golpe es el GLOBO DISPARADO normal: se le da efecto (curva) hacia su esquina al calcular la trayectoria */
  private lobCurve = false;
  private maxLobK = 0;
  /** DASH en curso: el jugador espera en el punto y la devolución se fuerza en `t` s si hace falta */
  private dashHit: { t: number; elapsed: number; x: number; y: number; sprint?: true; blink?: true; swung?: boolean; slowmo?: { side: number; started: boolean; rate: number } } | null = null;
  /** TIEMPO LENTO (DEFENSIVO LEGENDARIO): cuánto se acercó la cámara (0..1) y si se mantiene (cinemática en curso) o se suelta sola */
  private slowCam = 0;
  private slowCamHold = false;
  /** TIEMPO LENTO: acercamiento extra (0..1) hasta el golpe, tras el primer zoom */
  private slowCamX = 0;
  /** DASH sprint en curso (src/logic/DashSprint.ts): mueve al jugador en arranque / sprint / frenada */
  private dashRun: DashRun | null = null;
  private dashFx!: DashFx;
  /** (21-11-2026, usuario) efecto de VELOCIDAD de la carrera a la T del HURACÁN: sombras, destello y estela en dorado (fx/dashFx.ts) */
  private hurDash!: DashFx;
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
  /** poder del SMASH de la pelota que vuela ahora (la tuya, la del BOT según su kit o la del rival en red) */
  private smashFlightEl: SmashPower = 'fire';
  /** en red: poder del último SMASH del rival (llega en 'smash-armed' / 'smash-cine') */
  private netRivalSmashEl: SmashPower = 'fire';
  /** red de tenis dibujada (fx/NetView.ts): ondula y suena cuando la pelota pega o roza la cinta */
  private netView!: NetView;
  private readonly netCrossing: NetCrossing = { y: 0 };
  /** modo BOT: defensivo, especial, ulti y carga según su personaje (ai/botKit.ts: Mai = destello/hielo/tulipán, Nxo = dash/fuego) */
  private botKit: BotKit = botKitFor('nxo');
  /**
   * EMOTE del bot (16-11-2026): si va perdiendo por 4 puntos (puntos ganados en el partido) pone la carita ENOJADA, como mucho
   * 1 o 2 veces por partida (se sortea). `nextGap` = diferencia que dispara la siguiente (la segunda, 3 puntos más abajo).
   */
  private botEmotes = { left: 0, won: [0, 0] as [number, number], nextGap: 4, run: 0, tut3: false };
  /** playerHit en curso es el de INFERNO DRIVE (lo pone la cinemática justo antes de golpear) */
  private infernoPending = false;
  /** la pelota en vuelo es un INFERNO DRIVE (fuego en espiral) */
  private infernoFlight = false;
  /**
   * (21-11-2026, usuario) NO HAY ULTI CONTRA ULTI: la que se lanza primero queda "en juego" (`ultiOwner`) y la ULTI del otro lado queda
   * BLOQUEADA hasta que el golpe llega (`ultiLanded`) y quien lo recibió recupera su raqueta y deja el aturdido (`ultiVictim`). Se reinicia
   * en cada punto. Ver ultiStart / ultiBlocked / ultiTick.
   */
  private ultiOwner: Who | null = null;
  private ultiVictim: Actor | null = null;
  private ultiLanded = false;
  /** última vez (time.now) que la ULTI en juego estaba en cinemática o en vuelo (si no llega a golpear, se libera sola) */
  private ultiSeenAt = 0;
  /** (17-11-2026) ULTI LEGENDARIA (BOLA DE ENERGÍA) en curso: el partido está congelado (cineLock) */
  private legend: LegendRun | null = null;
  private energyCine!: EnergyCineFx;
  /** (17-11-2026) impacto final DESTRUCTIVO de la BOLA DE ENERGÍA (pool, fx/energyBallFx.ts) */
  private energyImpact!: EnergyImpactFx;
  /** (17-11-2026) ULTI LEGENDARIA HURACÁN: el tornado y la esfera amarilla del que la lanza (fx/hurricaneFx.ts) */
  private tornado!: TornadoFx;
  /** (18-11-2026) el tornado en imagen de la ULTI HURACÁN (hoja de ChatGPT); se crea la primera vez */
  private tornadoImg?: TornadoSprite;
  /** (18-11-2026) los botones de habilidades están apagados por el aturdimiento del jugador */
  private stunLockOn = false;
  private windSphere!: WindSphereFx;
  /** la penumbra del peloteo se está yendo (tras el impacto) */
  private legendFade = false;
  /** (17-11-2026) la BOLA DE ENERGÍA está creciendo en la raqueta (antes del golpe final) */
  private legendGrow = false;
  /** red (víctima): hasta aquí se ignora el golpe de la ULTI del rival que llegue tarde (ya se vio en la cinemática) */
  private legendDropHitUntil = 0;
  /** red (el que la lanza): cuándo se vio aquí el impacto final (el 'stunned' del rival no lo repite) */
  private legendStunShownAt = 0;
  /** red (el que la lanza): golpe / aturdido / raqueta del rival que llegan durante la cinemática: se aplican al terminar */
  private legendTodo: Array<() => void> = [];
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
  /** cuenta atrás del saque en el aviso lateral (fx/sideNotice.ts) */
  private serveCountdown!: ServeCountdown;
  private rallyCountdown!: ServeCountdown;
  private rallyDanger?: Phaser.GameObjects.Image;
  private rallyElapsed = 0;
  private rallyRemaining: number | null = null;
  private rallyForcedShot: HitMsg['rallyFault'];
  /** (25-11-2026, usuario) el fallo forzado es del tutorial (subiste a la red, tutNetGuard), no del reloj del peloteo: sin "TIEMPO" */
  private rallyFaultTut = false;
  private rallyOutMarkPending = false;
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
  /** CARGANDO GOLPE elegido (sprites) ya a la vista: el primer ~1 s se ve la carga CLÁSICA y luego cambia a la elegida */
  private chargeSpriteOn = false;
  private rivalSpriteOn = false;
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
  /** "cargando" del rival (más bajo que el tuyo) */
  private rivalChargeSnd: Phaser.Sound.BaseSound | null = null;
  private ambienteKey = '';
  /** (21-11-2026, usuario) imagen del ambiente en el mundo (centro y tamaño): la pantalla de resultados aleja la cámara hasta verla entera */
  ambienteFrame: { cx: number; cy: number; w: number; h: number; key?: string } | null = null;
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
  /** quién recibirá un golpe cargado al máximo (empujón leve al devolverlo). Se fija al golpear y se gasta al recibirlo; el fin del punto lo borra */
  private maxPushOn: Who | null = null;

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
    // (25-11-2026, usuario) SOLO los personajes de este partido: tú (espaldas y frente, el frente en el resultado), el rival de frente, el
    // rival online y, en el 2v2, tu compañero de espaldas (el 2.º rival es tu personaje de frente). Al volver al menú se liberan.
    const me = getProfile().skin;
    const ally = this.net2 ? this.net?.opponent.skin : this.duo?.ally ?? this.rivalSkin();
    queueNxoSpriteLoads(this.load, sheetsOf([[me, 'back'], [me, 'front'], [this.rivalSkin(), 'front'], [this.vsOpp?.skin, 'front'], ...(this.doubles ? [[ally, 'back'], [this.rival2Skin(), 'front']] as [string | undefined, 'back' | 'front'][] : [])]));
    queueEmoteArt(this.load); // miniaturas de 160 px (antes las fuentes de ~1,1 MB cada una)
    // (25-11-2026, usuario) nivel 1: "¡GENIAL!" al tocar cada cuadro (original en _temp/respaldo_oficial/ui/genial.png)
    if (this.doubles) queueParkWalkers(this.load); // (19-11-2026) paseantes del mapa del 2v2 (PARQUE)
    // (25-11-2026, usuario) SOLO el ambiente de este partido (antes los 5 desde el arranque) y sus figuras
    const amb = resolveAmbiente(this, this.ambienteHint, this.doubles)?.key ?? null;
    if (amb) this.ambienteHint = amb;
    queueAmbiente(this.load, amb);
    if (!this.doubles && amb === 'ambiente-1') queueSpectators(this.load, 'ambiente-1'); // (21-11-2026, usuario) espectadores en las gradas del barrio
    if (!this.doubles && amb === 'ambiente-2') queueSpectators(this.load, 'ambiente-2'); // (22-11-2026, usuario) espectadores y perrito en las gradas de la arcilla
    if (!this.doubles && amb === 'ambiente-3') queueWalkers(this.load, 'ambiente-3'); // (23-11-2026, usuario) autos de la CIUDAD (el 1v1)
    if (!this.doubles && amb === 'ambiente-4') queueWalkers(this.load, 'ambiente-4'); // (21-11-2026, usuario) figuras de la NIEVE (el 1v1)
    this.load.audio('marcador', 'mp3/marcador.m4a'); // suena completo cada vez que sale el marcador
    // los soundtracks NO se cargan aquí: se pide solo el del ambiente elegido (create) y se libera al salir
    this.load.audio('cargando', 'mp3/cargando.m4a'); // sonido de carga (tiro cargado e INFERNO)
    this.load.audio('inferno-hit', 'mp3/inferno.m4a'); // sonido del golpe INFERNO (sustituye al de golpe normal)
    this.load.audio('golpe-fuerte', 'mp3/golpe-fuerte.m4a'); // sonido de TODO golpe de raqueta a la pelota
    queueButtonArt(this.load); // imágenes de DASH, SMASH y los dos saques (si faltan, se dibujan como antes)
    queueMissionAlertArt(this.load); // placa de la alerta de LOGRO (fx/missionAlert.ts)
    queueScoreboardArt(this.load); // imagen del marcador (ui/ScoreBoard.ts; si falta, se dibuja por código)
    if (!this.textures.exists('ui-trofeo')) this.load.image('ui-trofeo', 'assets/ui/trofeo.webp'); // TROFEO junto al nombre del ganador en el marcador final (fx/matchFinale.ts; si falta, la corona)
    if (!this.textures.exists('ui-victoria')) this.load.image('ui-victoria', 'assets/ui/victoria.webp'); // imagen de la pantalla de VICTORIA (scenes/MatchEndScene.ts; si falta, la corona dibujada)
    queueServeTagArt(this.load); // globo SERVICIO sobre quien saca (ui/ServeTurnTag.ts; si falta, se dibuja por código)
    queueInfernoArt(this.load); // bola de fuego animada de INFERNO DRIVE (si falta, se dibuja por código)
    queueAmbientBird(this.load); // paloma del ambiente (fx/AmbientBird.ts)
    queueGazeArt(this.load, getProfile().skin); // INFERNO: franja con los ojos del personaje durante la concentración
    // en red también la del rival: su INFERNO se ve aquí con SUS ojos
    queueGazeArt(this.load, this.rivalSkin()); // en red o contra el bot: la del personaje que se ve al frente
    if (this.net) queueGazeArt(this.load, this.net.opponent.skin); // (19-11-2026) el otro humano (rival del 1v1 / compañero del 2v2)
    if (this.duo) for (const s of [this.duo.ally, this.duo.rival2]) queueGazeArt(this.load, s); // (25-11-2026) 2v2: compañero y 2.º rival
    // efecto de CARGA (aro del suelo): el mío y, en red, el del rival
    // KIT del bot: variado en cada partida (ai/botKit.ts randomBotKit: croma, especial, ulti, defensivo y carga; sin épicos ni legendarios)
    // (25-11-2026, usuario) en el TUTORIAL (bajo el nivel 20) el bot lleva lo DEFAULT: DASH, ESPECIAL y ULTI default, carga y colores de siempre
    this.botKit = this.net || this.tutorial ? botKitFor(this.rivalSkin()) : randomBotKit(this.rivalSkin());
    this.rivalKits = [];
    if (this.doubles && !this.net) {
      // (23-11-2026, usuario) 2v2 contra bots: rival 1 (su personaje), rival 2 (el tuyo, de frente) y aliado (el del rival 1, de espaldas),
      // cada uno con poderes distintos entre ellos y de los tuyos. Carga y croma de los dos rivales: los del rival 1 (hay un solo efecto de carga rival)
      const pf = getProfile();
      const [k1, k2, ka] = randomDoublesKits([this.rivalSkin(), this.rival2Skin(), this.duo?.ally ?? this.rivalSkin()], { smash: pf.smash, inferno: pf.inferno, defensive: pf.defensive });
      this.rivalKits = [k1, { ...k2, charge: k1.charge, color: k1.color }];
      this.allyKit = ka;
      this.botKit = k1;
      if (this.tutorial) {
        // tutorial: los tres bots del 2v2 con lo DEFAULT
        this.rivalKits = [botKitFor(this.rivalSkin()), botKitFor(this.rival2Skin())];
        this.allyKit = botKitFor(this.duo?.ally ?? this.rivalSkin());
        this.botKit = this.rivalKits[0];
      }
    }
    this.botEmotes = { left: 0, won: [0, 0], nextGap: 4, run: 0, tut3: Math.random() < 2 / 3 }; // (26-11-2026, usuario) tutorial: el emote de los 3 puntos en 2 de cada 3 partidas
    queueChargeFxArt(this.load, [getProfile().charge, this.vsOpp ? chargeFxOf(this.vsOpp.charge, this.vsOpp.skin) : this.botKit.charge]);
  }

  init(data: { botName?: string; rivalLevel?: number; net?: MatchNet; ambiente?: string; mode?: '2v2'; allyName?: string; rival2Name?: string; duo?: DoublesSkins; rivalSkin?: string; cover?: string; guide?: GuidedMatch }) {
    this.guide = !isDevMode() && !data?.net && !data?.mode ? data?.guide : undefined;
    this.tutorial = isTutorialMatch(getPlayer().level, isDevMode(), !!data?.net);
    {
      const lv = getPlayer().level;
      this.lesson = this.tutorial && !data?.mode && !this.guide && (lv === 3 || lv === 4) ? lv : null;
      // las misiones del nivel solo en el partido que trae su ejercicio (si no, no se podrían cumplir y no se subiría): nivel 1 = el primer
      // partido guiado, nivel 2 = el del DEFENSIVO, niveles 3 y 4 = su ejercicio
      const withLesson = (lv === 1 && this.guide === 'first') || (lv === 2 && this.guide === 'spin') || (lv === 3 && this.guide === 'l3') || (lv === 4 && this.guide === 'l4') || (lv === 5 && this.guide === 'l5') || !!this.lesson;
      const required = TUTORIAL_REQUIRED_LEVELS.has(lv);
      this.tutMissions = this.tutorial && (!required || withLesson) ? (tutorialMissionsFor(lv) as MissionId[] | null) : null;
      this.tutMissionsRequired = this.tutorial && required && withLesson;
      this.tutPointsWon = 0;
      this.lessonStep = 0;
      this.lessonAsked = -1;
      this.lessonAim = null;
    }
    this.guideMove = 0;
    this.guideReadyAt = 0;
    this.level2PauseArmed = false;
    this.l2Freeze = null;
    this.l2Lock = false;
    this.l2Won = false;
    this.l2DefUsed = false;
    this.l2Running = false;
    this.guideRally = { k: 0, st: 'serve' };
    this.guidePracticeStep = 0;
    this.winGoalShown = false;
    this.guideNotice = '';
    this.guideText = undefined;
    this.guideZone = undefined;
    this.guideDim = undefined;
    this.guideZonePts = [];
    this.guideHand = undefined;
    this.guideTapBox = undefined;
    this.guideBotPose = [];
    this.serveControlsOn = false;
    this.finaleBall = null; // (la escena se reutiliza entre partidos)
    this.coverKey = data?.cover ?? null; // (19-11-2026) pantalla VS que tapa el partido hasta la salida (red)
    // (21-11-2026) 2v2 contra bots (sin red): tú + aliado BOT contra dos rivales BOT
    const n2 = data?.net?.mode === '2v2';
    this.doubles = data?.mode === '2v2' || n2;
    setLane(this.doubles); // (19-11-2026) 2v2: cancha de DOBLES (pasillos incluidos)
    this.allyName = data?.allyName ?? 'Aliado';
    this.rival2Name = data?.rival2Name ?? 'Rival 2';
    // 2v2 contra bots: los personajes de la búsqueda (si no llegan, p. ej. desde otra pantalla, se sortean aquí)
    this.duo = this.doubles && !n2 ? data?.duo ?? doublesSkinsFor(getProfile().skin) : null;
    // (25-11-2026, usuario) 1v1 contra el bot con el modo desarrollo: el rival elegido al azar en la búsqueda
    this.rivalPick = !this.doubles && !data?.net ? data?.rivalSkin ?? null : null;
    if (n2) {
      // 2v2 online: el compañero es el otro humano; los 2 rivales son bots con nombres que salen de la sala (iguales en los dos teléfonos)
      const [b1, b2] = botNamesFor(data!.net!.roomId);
      this.allyName = data!.net!.opponent.name;
      data!.botName = b1;
      this.rival2Name = b2;
      data!.rivalLevel = Math.round((getProfile().level + data!.net!.opponent.level) / 2);
    }
    this.ally = null;
    this.rivalActors = [];
    this.rivalBrains = [];
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
    registerNxoAnims(this); // (25-11-2026) animaciones de los personajes recién cargados (preload)
    // estado (la escena se reutiliza en revanchas)
    // (21-11-2026, usuario) el ambiente se resuelve YA (antes de crear nada) para que la cancha, la red y los personajes nazcan con su desplazamiento (COURT_SHIFT)
    const amb0 = resolveAmbiente(this, this.ambienteHint, this.doubles);
    if (amb0) this.ambienteHint = amb0.key;
    COURT_SHIFT.y = amb0?.courtDY ?? 0;
    this.events.once('shutdown', () => (COURT_SHIFT.y = 0));
    this.phase = 'intro';
    this.warmUpShaders(); // (21-11-2026) compila ya los efectos que se compilaban al primer uso (tirones de ~90 ms en el log online)
    this.missions = createMissionTracker(); // misiones de cero en cada partida
    this.missionShot = null;
    this.lastHitter = null;
    this.bounces = 0;
    this.smashArmed = false;
    this.netRivalArmed = false;
    this.smashGlow = { player: null, bot: null, mate: null };
    this.net2MateArmed = false; // (la escena se reutiliza: sin halos de una partida anterior)
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
    this.hurDash = new DashFx(this, { ...DASH, ghostTint: HURRICANE_RUN_TINT });
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
    // contra el bot: su CROMA del kit de esta partida (ai/botKit.ts)
    const rivalColor = this.vsOpp ? charColorOf(this.vsOpp.color) : (this.botKit.color ?? 'classic');
    if (rivalColor !== 'classic') applyCharColor(this.bot.ch, rivalColor, this.vsOpp?.skin ?? this.rivalSkin());
    // (la raqueta que sale volando con la ULTI usa el mismo estilo: loseRacket)
    this.colorStyle = { player: { id: charColor, skin: getProfile().skin }, bot: { id: rivalColor, skin: this.vsOpp?.skin ?? this.rivalSkin() } };
    // aura de la ZONA con los colores de tu ESTILO DE ZONA (domain/zoneSkins.ts); se crea ya con ellos (encenderla no rehace emisores)
    const myZone = zoneSkinOf(getPlayer() as PlayerState);
    this.aura = new HyperAura(this, this.player.ch, myZone.aura, myZone.auraPal);
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
    this.rivalChargeSnd?.destroy(); // (la escena se reutiliza: sin el sonido de una partida anterior)
    this.rivalChargeSnd = null;
    // efectos de CARGA con sprites: el mío (Personalización; por defecto el de mi personaje) y el del rival en red
    const myFx = getProfile().charge;
    this.chargeKind = chargeFxReady(this, myFx) ? myFx : 'classic';
    this.chargeSprite = new ChargeSpriteFx(this);
    if (isSpriteCharge(this.chargeKind)) this.chargeSprite.use(this.chargeKind);
    // (el kit del bot se eligió en preload: randomBotKit)
    const rivalFx = this.vsOpp ? chargeFxOf(this.vsOpp.charge, this.vsOpp.skin) : this.botKit.charge;
    this.rivalChargeKind = chargeFxReady(this, rivalFx) ? rivalFx : 'classic';
    this.rivalChargeSprite = new ChargeSpriteFx(this);
    if (isSpriteCharge(this.rivalChargeKind)) this.rivalChargeSprite.use(this.rivalChargeKind);
    this.dizzy = this.makeDizzy();
    this.dizzyP = this.makeDizzy();
    this.ball = new Ball(this);
    this.ballHidden = false; // la escena se reutiliza: la pelota nueva parte visible
    this.brain = new BotBrain({ xMin: B_X[0], xMax: B_X[1], yMin: Y_MIN, yMax: Y_MAX, wide: this.doubles }, profileForMatch(this.rivalLevel));
    this.ai = this.brain.ai;
    // (21-11-2026) 2v2: el aliado (el otro personaje, de espaldas) y el 2.º rival (de frente), cada uno con su dibujo y su cerebro
    if (this.doubles) {
      const mySkin = getProfile().skin;
      const otherSkin = this.net2 ? this.net!.opponent.skin : this.duo?.ally ?? this.rivalSkin();
      this.ally = mk(playerLook(otherSkin), 'back', COURT.left - 40, 1);
      this.allyRemote = this.net2;
      this.net2Rem = [0, 1, 2].map(() => ({ interp: new RemoteInterp(100), last: null }));
      this.net2BotSend = [1, 2].map(() => ({ at: 0, x: 0, y: 0, moving: false }));
      const r2 = mk(lookForSkin(this.rival2Skin(), 'front', mySkin), 'front', COURT.right + 40, -1);
      this.rivalActors = [this.bot, r2];
      this.rivalBrains = [this.brain, new BotBrain({ xMin: B_X[0], xMax: B_X[1], yMin: Y_MIN, yMax: Y_MAX, wide: this.doubles }, profileForMatch(this.rivalLevel))];
      this.ally.y = LAT_C - 70;
      r2.y = LAT_C + 70;
      this.allyBrain = new BotBrain({ xMin: P_X[0], xMax: P_X[1], yMin: Y_MIN, yMax: Y_MAX, wide: true }, profileForMatch(Math.max(1, getProfile().level)));
      // (23-11-2026, usuario) contra bots, los tres bots usan sus habilidades en cuanto pueden (BotBrain.eager: recargas del jugador)
      if (!this.net) for (const b of [...this.rivalBrains, this.allyBrain]) b.eager = true;
    }
    this.score = new Score(!isDevMode() && !this.net && !this.doubles && getPlayer().level <= 15);
    this.score.freeFrom = this.guidePracticeCount(); // (26-11-2026, usuario) el 2-2 de saques empieza tras los puntos guiados
    // (25-11-2026, usuario) quién saca el 1.er punto guiado, ya para la entrada caminando: nivel 1 = el bot (tú entras desde la izquierda hasta la
    // parte izquierda de la cancha, donde recibes); nivel 2 = tú. startPoint lo vuelve a fijar en cada punto
    if (this.guide === 'first') this.score.fixedServer = 1;
    else if (this.guide === 'spin') this.score.fixedServer = 0;
    this.zone = new ZoneTracker();
    this.zoneLevels = {
      player: { ...getProfile().zoneStats },
      bot: { ...(this.vsOpp?.zoneStats ?? emptyZoneStats()) },
    };
    // PASIVA del personaje elegido (AGILIDAD de Nxo, PRECISIÓN de Mai): velocidad y alcance, o menos desvío en golpes y saque
    const passive = getProfile().passive;
    this.passiveAgility = passive.id === 'agility' ? passive.value : 0;
    this.passivePrecision = passive.id === 'precision' ? passive.value : 0;
    this.passiveStrength = passive.id === 'strength' ? passive.value : 0;
    this.passiveSpin = passive.id === 'spin' ? passive.value : 0;
    // (26-11-2026, usuario) RESISTENCIA: el DEFENSIVO se recarga 0,5 s antes y los aturdimientos que recibes duran menos (x0,75: 2 s -> 1,5 s)
    this.passiveResistOn = passive.id === 'resistance';
    this.zoneFx = { player: new ZoneFx(this), bot: new ZoneFx(this) };
    // ESTILO DE ZONA (Tienda, domain/zoneSkins.ts): el tuyo; el bot y el rival online, la Eléctrica de siempre
    // el rival online, con SU estilo de Zona (llega en opponent.zone; uno desconocido = Eléctrica)
    const rz = this.vsOpp?.zone;
    this.zoneLook = { player: zoneSkinOf(getPlayer() as PlayerState), bot: rz && isZoneSkin(rz) ? ZONE_SKINS[rz] : ZONE_SKINS.electric };
    this.zoneFx.bot!.setLook(this.zoneLook.bot);
    this.zoneFx.player!.setLook(this.zoneLook.player);
    // en red: el host saca los juegos pares; el invitado ve al host como 'bot' (saca los impares desde su lado)
    if (this.net && !this.net2) this.score.serverOffset = this.net.servesFirst ? 0 : 1; // 2v2 online: el equipo humano saca los juegos pares en los dos teléfonos

    this.createHud();
    this.joy = new Joystick(this);
    const d = ABILITIES.dash;
    const s = ABILITIES.smash;
    this.dashBtn = new AbilityButton(this, 0, 0, 54, Math.max(1, DASH_COOLDOWN - (this.passiveResistOn ? RESIST_PASSIVE.dashFaster : 0)), d.color, d.colorDark, d.icon, 'DEFENSIVO', () => this.activateDash());
    this.smashBtn = new AbilityButton(this, 0, 0, 64, SMASH_COOLDOWN, s.color, s.colorDark, s.icon, 'ESPECIAL', () => (this.smashBtn.inferno ? this.armInferno() : this.activateSmash()));
    // solo DEFENSIVO / ESPECIAL (sin el nombre del poder); en nivel máximo, sin textos
    if (getProfile().level >= MAX_LEVEL) {
      this.dashBtn.hideTexts();
      this.smashBtn.hideTexts();
    }
    // (21-11-2026, usuario) el botón DEFENSIVO lleva SIEMPRE su arte (el corredor), sea cual sea el poder equipado (antes cambiaba al icono de la SOMBRA,
    // el DESTELLO…). El poder equipado sigue siendo el que se activa.
    this.dashBtn.setArt(BUTTON_ART.dash.key);
    this.smashEl = getProfile().smash;
    this.smashFlightEl = 'fire';
    this.netRivalSmashEl = 'fire';
    // botón SMASH con el arte y el aro del poder elegido (el fuego conserva el de siempre)
    this.smashBtn.setArt(elementTexture(this, BUTTON_ART.smash.key, this.smashEl) ?? BUTTON_ART.smash.key);
    this.smashBtn.setArmedColor(SMASH_LOOK[this.smashEl].ring);
    this.surrenderBtn = this.makeSurrenderIcon();
    this.autoPlay = false;
    this.autoBtn = this.makeAutoButton().setVisible(!this.guide && !this.tutorial);
    // (24-11-2026, usuario) en el tutorial no hay rendirse (ni AUTO): se juega hasta el final; si se cierra la app, se juega de nuevo
    if (this.tutorial) this.surrenderBtn.setVisible(false);
    this.coach?.destroy();
    this.coach = new MatchCoach({
      scene: this,
      setPaused: (on) => {
        this.paused = on;
        this.time.paused = on;
        this.joy.release();
        this.joy.enabled = !on;
      },
      setAuto: (on) => {
        this.autoPlay = on;
        if (!on) stopMotion(this.motion);
      },
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.coach.destroy());
    this.stunFog = new StunFog(this, () => this.player.ch); // niebla del aturdido (solo el jugador la ve; su personaje queda nítido)
    // (16-11-2026, usuario) botones de PRUEBA de la ULTI y del DUELO RED OCULTOS (queda solo AUTO); para volver a usarlos, quitar el setVisible(false)
    this.testBtn = this.makeTestButton().setVisible(false); // PRUEBA: ULTI + ESPECIAL → ¡A LAS ESTRELLAS! (solo contra el bot)
    this.skyMeBtn = this.makeSkyMeButton(); // (21-11-2026) PRUEBA: ¡A LAS ESTRELLAS! que te llega a TI (ULTI + ESPECIAL del rival)
    this.skyMeBtn.setVisible(false); // (25-11-2026, usuario) quitada de todas las partidas (tambien desarrollo)
    this.duelTestBtn = this.makeDuelTestButton().setVisible(false); // PRUEBA: entrar al DUELO RED (solo contra el bot)
    // solo los emotes desbloqueados (premios del Pase de Batalla); sin ninguno no hay botón
    this.emotes = new Emotes(this, () => this.headPos(this.player), ownedEmotes(getPlayer().owned));
    this.emotes.setSkins(getProfile().skin, this.vsOpp?.skin ?? this.rivalSkin()); // (18-11-2026) caritas de MAI si juega con ella
    // en red: tus emotes también los ve el rival; el aura del SMASH armado del rival; sin restos de una partida anterior
    this.netHit = {};
    this.netLastState = null;
    this.netInterp.clear(); // sin estados del rival de una partida anterior
    this.netPlaced = false;
    this.netPlacedAt = 0;
    this.netPtOff = false;
    this.netStopRepeat = false;
    this.netSnap = null;
    this.netRtt = 0;
    this.netPingAt = 0;
    this.netLastMsgAt = performance.now();
    this.netWeak = null;
    this.netBotLockUntil = 0;
    this.netRemoteCine = false;
    this.duel = null;
    this.duelUsed = false;
    this.duelDefend = null;
    this.duelLungeRoll = null;
    this.netDeferred = [];
    this.slowCam = 0;
    this.slowCamX = 0;
    this.slowCamHold = false;
    this.slowmoActive = false;
    this.netCineSeen = false;
    this.fluSkip = false;
    // aura de llamas del rival: en estado ZONA (zoneRender), también contra el BOT
    this.botAura = new HyperAura(this, this.bot.ch, this.zoneLook.bot.aura, this.zoneLook.bot.auraPal);
    if (this.net) {
      this.emotes.onSend = (k) => this.net?.sendAction('emote', { kind: k });
    }

    // controles de saque: raqueta dorada = normal, pelota girando violeta = con efecto
    this.serveCtl = new ServeController();
    this.serveAI = new ServeAI();
    this.serveLet = false;
    // (21-11-2026, usuario) tamaños como las habilidades: saque DIRECTO como el ESPECIAL (un poco más grande), saque de EFECTO como el DEFENSIVO
    this.serveNormalBtn = new ServeButton(this, 0, 0, 70, 'serveRacket', 0xffb020, 0xc46a00, () => this.onServeButton('normal'));
    this.serveSpinBtn = new ServeButton(this, 0, 0, 56, 'serveSpin', 0x8a6bff, 0x4a35b8, () => this.onServeButton('spin'));
    this.serveNormalBtn.setArt(BUTTON_ART.serve.key);
    this.serveSpinBtn.setArt(BUTTON_ART.spin.key);
    this.serveNormalBtn.show(false);
    this.serveSpinBtn.show(false);
    this.serveAim = this.add.graphics().setDepth(0.8).setVisible(false);
    // globo: indicador de caída sobre el suelo + estado del SMASH potenciado
    this.lob = new LobTracker();
    this.lobMarker = new LobMarker(this);
    this.superArmed = false;
    this.pointStats = { me: 0, ally: 0, r1: 0, r2: 0 };
    this.lastActorBySide = {};
    this.botRemateGame = -1; // la escena se reutiliza: el remate del bot vuelve a estar disponible (desde el 2.º juego)
    this.smoke = new SmokeTrail(this);
    this.elementFx = new SmashElementFx(this);
    this.dropZeroFx = new DropZeroFx(this);
    this.cine = new SmashCinematic(this);
    // INFERNO DRIVE: la carga empieza en 0 en cada partido
    this.inferno = new InfernoDrive();
    this.ghosts = new GhostTrail(this);
    this.fire = new InfernoFire(this);
    this.energyCine = new EnergyCineFx(this); // (17-11-2026) ULTI LEGENDARIA
    this.energyImpact = new EnergyImpactFx(this);
    this.tornado = new TornadoFx(this);
    this.tornadoImg = undefined; // la escena se reutiliza: la imagen del tornado de la partida anterior ya está destruida (no se ve); se crea de nuevo al usarla
    this.windSphere = new WindSphereFx(this);
    this.legend = null;
    this.legendFade = false;
    this.legendTodo = [];
    this.legendDropHitUntil = 0;
    this.legendStunShownAt = 0;
    this.infernoEl = 'fire';
    this.netRivalInferno = null;
    this.infernoPending = false;
    this.infernoFlight = false;
    this.ultiOwner = null;
    this.ultiVictim = null;
    this.ultiLanded = false;
    // anillo de carga de la ULTI: solo si ya la tienes (nivel; domain/unlocks.ts)
    if (this.unlocked('ulti')) this.smashBtn.setMeter(0, INFERNO.pointsToCharge);
    // ZONA bloqueada por nivel: tú nunca entras; en red, el rival según SU nivel (los dos teléfonos deciden igual)
    this.zone.locked.player = !this.unlocked('zone');
    this.zone.locked.bot = !!this.vsOpp && !isUnlocked('zone', this.vsOpp.level);
    this.serveTag = new ServeTurnTag(this, this.botName);
    this.superFlight = false;
    this.secondTag = this.add.text(0, 0, '2º SAQUE', textStyle(20, '#ffd23f')).setOrigin(0.5).setScrollFactor(0).setDepth(5500).setVisible(false);
    this.serveClockText = this.add.text(0, 0, '', textStyle(40, '#ffd23f')).setOrigin(0.5).setScrollFactor(0).setDepth(5500).setVisible(false);
    this.serveCountdown = createServeCountdown(this);
    this.rallyCountdown = createServeCountdown(this, (n) => {
      const label = n === 0 ? 'DESCONCENTRACIÓN' : n <= RALLY_LIMIT.dangerAt ? 'ÚLTIMOS SEGUNDOS' : 'CIERRE DEL PUNTO';
      return `00:${String(n).padStart(2, '0')} · ${label}`;
    });
    this.rallyOutMarkPending = false;
    this.rallyDanger = undefined;
    this.resetRallyClock();
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
    stopIntroMusic(this); // (por si se entra al partido sin pasar por la búsqueda)
    playMatchMusic(this, this.ambienteKey, this.net?.roomId); // (26-11-2026) online: la misma canción en todos los teléfonos
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
    this.setServeUi(this.meServes);
    // presentación (≤ 2 s): mapa de lejos que se acerca, oscurecido, "INICIO" (fx/matchIntro.ts)
    if (this.net) this.netSetup();
    else {
      this.entranceWalk(); // entrada: los dos llegan caminando a su sitio mientras la cámara se acerca
      playMatchIntro(this, footerColor(this.ambienteKey), () => {
        this.startPoint();
        this.launchBird();
      });
    }
  }

  /** entrada al empezar el partido en curso (los personajes caminan hacia su sitio) */
  private entering = false;
  /** pelota oculta durante la presentación del partido (nadie la tiene hasta tener el control) */
  private ballHidden = false;
  /** pelota oculta tras ¡A LAS ESTRELLAS! hasta el punto siguiente */
  private skyBallHidden = false;

  /**
   * ENTRADA: al empezar el partido los dos llegan CAMINANDO a su posición de saque mientras la cámara se acerca (intro):
   * el rival entra desde la izquierda de la pantalla y tú desde la derecha. En red, el rival real hace su propia entrada
   * (llega por sus estados); aquí solo se le pone el clip de caminar.
   */
  private entranceWalk() {
    const delay = INTRO.holdMs;
    const ms = INTRO.zoomMs;
    this.entering = true;
    this.time.delayedCall(delay + ms + 60, () => {
      this.entering = false;
      // (red) termina la entrada: el rival real sigue desde su sitio de saque, donde la dejó la caminata local
      if (this.net) this.netAnchor(this.bot.x, this.bot.y);
    });
    const walk = (a: Actor, dir: 1 | -1) => {
      const ty = a.y;
      // desde el borde de su lado (dentro de los límites laterales: el movimiento del jugador no lo recorta)
      // (14-11-2026) no desde el borde: desde el 60 % del camino, a ritmo CONSTANTE. Con la caminata lenta de entrada
      // (walk-intro) avanzaba demasiado rápido para lo que pisan los pies; el tiempo de la entrada no cambia
      const edge = dir > 0 ? Y_MIN : Y_MAX; // dir +1 = entra hacia la derecha (viene de la izquierda)
      a.y = ty + (edge - ty) * ENTRANCE_FROM;
      this.time.delayedCall(delay, () => {
        if (!this.sys.isActive() || !a.ch?.active) return;
        a.ch.walkFor(ms + 200);
        a.ch.setMoving(true, dir, 0.5);
        this.tweens.add({
          targets: a,
          y: ty,
          duration: ms,
          ease: 'Linear',
          // al llegar: directo al reposo (con ritmo explícito no hace la frenada de carrera)
          onComplete: () => a.ch.setMoving(false, 0, 0),
        });
      });
    };
    // (25-11-2026, usuario) nivel 1 (guía 'first'): tu personaje entra desde la IZQUIERDA (empieza a la izquierda y va a la derecha)
    walk(this.player, this.guide === 'first' ? 1 : -1);
    // en red también se camina AQUÍ: los dos teléfonos empiezan la entrada en momentos algo distintos y sus estados
    // hacían saltar al rival entre el borde y su saque. Durante la entrada no se usan sus estados (onState / netBotTick)
    walk(this.bot, 1);
    // (19-11-2026, usuario) 2v2: cada pareja entra por los DOS lados: tu compañero desde la IZQUIERDA (tú desde la derecha) y el 2.º rival
    // desde la DERECHA (el 1.º desde la izquierda). En el 2v2 online cada teléfono se ve a sí mismo entrando por la derecha
    if (this.doubles && this.ally) {
      walk(this.ally, 1);
      const o2 = this.otherRival();
      if (o2) walk(o2, -1);
    }
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
  /** color de la franja de detrás de los controles: azul de siempre, o el pie del ambiente oscurecido si tiene uno propio */
  private ctrlCol() {
    const f = footerColor(this.ambienteKey);
    return f === SHARED_FOOTER ? 0x07152f : footerDark(f, 0.45);
  }
  private layout() {
    const W = this.scale.width;
    const H = this.scale.height;
    if (!this.controlsBackdrop) this.controlsBackdrop = this.add.graphics().setScrollFactor(0).setDepth(4900);
    const footerH = Math.min(360, H * 0.3);
    this.controlsBackdrop.clear();
    this.controlsBackdrop
      // (22-11-2026, usuario) del color del pie del ambiente, oscurecido (en el 2v2, verde como el pasto; en los demás, el azul de siempre)
      .fillGradientStyle(this.ctrlCol(), this.ctrlCol(), this.ctrlCol(), this.ctrlCol(), 0, 0, 0.84, 0.84)
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
    this.testBtn.setPosition(W - 46, 374); // PRUEBA, bajo AUTO
    this.skyMeBtn.setPosition(W - 46, 374); // PRUEBA ¡A LAS ESTRELLAS! recibido, bajo AUTO (el de arriba está oculto)
    this.duelTestBtn.setPosition(W - 46, 440); // PRUEBA DUELO RED, bajo el de la ULTI
    this.serveNormalBtn.setPosition(W - 110, H - 225);
    this.serveSpinBtn.setPosition(W - 250, H - 115);
    this.serveClockText.setPosition(W / 2, 200);
    this.secondTag.setPosition(W / 2, 178); // (25-11-2026, usuario: antes 150, pegado al marcador) bajo el marcador (ScoreBoard con su imagen mide ~132 px con la píldora JUEGO)
  }

  // ---------------------------------------------------------------- PRUEBA (botón bajo AUTO, solo contra el bot)
  /**
   * Botón de PRUEBA (matraz, bajo AUTO): simula "ULTI + ESPECIAL" para ver ¡A LAS ESTRELLAS! sin tener que lograrlo
   * jugando. No aparece en partidos online.
   */
  private makeTestButton() {
    const R = 26;
    const c = this.add.container(0, 0).setScrollFactor(0).setDepth(5600);
    const g = this.add.graphics();
    g.fillStyle(C.outline).fillCircle(0, 4, R + 6);
    g.fillStyle(0x6a2a9a).fillCircle(0, 5, R);
    g.fillStyle(0x9b5cff).fillCircle(0, 0, R - 2);
    g.fillStyle(0xffffff, 0.25).fillEllipse(-4, -11, 30, 10);
    // matraz de laboratorio (icono de "prueba")
    g.fillStyle(0xffffff, 1).fillRect(-4, -14, 8, 9);
    g.fillStyle(0xffffff, 1).fillTriangle(-4, -6, 4, -6, 13, 12).fillTriangle(-4, -6, -13, 12, 13, 12);
    g.fillStyle(0x46e8a0, 1).fillTriangle(-9, 5, 9, 5, 12, 11).fillTriangle(-9, 5, -12, 11, 12, 11);
    g.lineStyle(2, C.outline, 1).strokeRect(-4, -14, 8, 9);
    c.add(g);
    c.setSize(R * 2 + 14, R * 2 + 14).setInteractive({ useHandCursor: true });
    c.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e?.stopPropagation?.();
      this.tweens.add({ targets: c, scale: { from: 0.88, to: 1 }, duration: 200, ease: 'Back.easeOut' });
      this.devSkyTest();
    });
    if (this.net) c.setVisible(false); // en red rompería la sincronía con el otro teléfono
    return c;
  }

  /** Botón de PRUEBA del DUELO RED (bajo el de la ULTI): pone a los dos en la red y arranca el duelo. Solo contra el bot. */
  private makeDuelTestButton() {
    const R = 26;
    const c = this.add.container(0, 0).setScrollFactor(0).setDepth(5600);
    const g = this.add.graphics();
    g.fillStyle(C.outline).fillCircle(0, 4, R + 6);
    g.fillStyle(0x0f5a8a).fillCircle(0, 5, R);
    g.fillStyle(0x2fa8ff).fillCircle(0, 0, R - 2);
    g.fillStyle(0xffffff, 0.25).fillEllipse(-4, -11, 30, 10);
    // red de tenis (icono): poste + malla
    g.fillStyle(0xffffff, 1).fillRect(-14, -9, 3, 20).fillRect(11, -9, 3, 20).fillRect(-14, -10, 28, 3);
    g.lineStyle(1.5, 0xffffff, 0.9);
    for (let k = -8; k <= 8; k += 4) g.lineBetween(k, -7, k, 9);
    for (let k = -4; k <= 8; k += 4) g.lineBetween(-11, k, 11, k);
    c.add(g);
    c.setSize(R * 2 + 14, R * 2 + 14).setInteractive({ useHandCursor: true });
    c.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e?.stopPropagation?.();
      this.tweens.add({ targets: c, scale: { from: 0.88, to: 1 }, duration: 200, ease: 'Back.easeOut' });
      this.devDuelTest();
    });
    if (this.net) c.setVisible(false);
    return c;
  }

  /** PRUEBA del DUELO RED: punto en juego, los dos junto a la red y una volea del rival llegando a ti → duelo. */
  private devDuelTest() {
    if (this.net || this.phase === 'over' || this.phase === 'intro' || this.cineLock || this.duel) return;
    const pl = this.player;
    const bt = this.bot;
    this.endRemate();
    this.phase = 'rally';
    this.serving = false;
    this.serveCtl.state = 'SERVE_RESULT';
    this.serveClock = 0;
    this.serveCountdown.hide();
    this.board?.setInfo(null);
    this.setServeUi(false);
    this.duelUsed = false;
    pl.x = NET_X - 70;
    bt.x = NET_X + 70;
    bt.y = pl.y;
    if (pl.racket) this.clearRacket(pl);
    if (bt.racket) this.clearRacket(bt);
    pl.stun = 0;
    bt.stun = 0;
    // volea del rival llegando a tu raqueta
    const s = this.ball.s;
    s.x = pl.x + 40;
    s.y = pl.y;
    s.z = 50;
    s.vx = -300;
    s.vy = 0;
    s.vz = 0;
    this.lastHitter = 'bot';
    this.bounces = 0;
    this.ball.setPower(false);
    this.ball.setKind('normal');
    this.renderActors();
    this.duelStart('player');
  }

  /**
   * PRUEBA de ¡A LAS ESTRELLAS!: 1) el rival recibe tu ULTI (impacto, aturdido sin raqueta, raqueta al suelo);
   * 2) ~1,3 s después le mandas tu ESPECIAL directo → sale volando al cielo y es tu punto.
   */
  private devSkyTest() {
    if (this.net || this.phase === 'over' || this.phase === 'intro' || this.cineLock || this.duel) return;
    const bt = this.bot;
    const pl = this.player;
    // punto en juego (aunque estuviera en el saque)
    this.endRemate();
    this.phase = 'rally';
    this.serving = false;
    this.serveCtl.state = 'SERVE_RESULT';
    this.serveClock = 0;
    this.serveCountdown.hide();
    this.board?.setInfo(null);
    this.setServeUi(false);
    // 1) ULTI recibida por el rival
    const feet = project(bt.x, bt.y);
    powerImpactFx(this, 'inferno', feet.sx, feet.sy - 40 * feet.s, feet.s, this.infernoEl);
    bt.stun = 2.6; // quieto hasta que llegue el ESPECIAL
    bt.ch.impactStun('inferno', 2600, false);
    this.ultiStunOn(bt, 2600);
    this.loseRacket(bt);
    const h = this.headPos(bt);
    this.popText(h.x, h.y - 10, 'PRUEBA: ULTI', '#c9a4ff', 26);
    // 2) tu ESPECIAL directo al rival
    this.time.delayedCall(1300, () => {
      if (this.phase !== 'rally' || !bt.racket || bt.launched) return;
      const s = this.ball.s;
      s.x = pl.x + 20;
      s.y = pl.y;
      s.z = 60;
      this.lastHitter = 'player';
      this.bounces = 0;
      this.infernoFlight = false;
      this.setSmashFlight(this.smashEl);
      this.ball.setPower(true);
      this.ball.setKind('normal', true);
      aimShot(s, bt.x + 40, bt.y, SHOT_SPEED * 1.6, 20);
      pl.ch.swing(true);
      const hp = this.headPos(pl);
      this.popText(hp.x, hp.y - 10, 'PRUEBA: ESPECIAL', '#c9a4ff', 26);
    });
  }

  /**
   * (21-11-2026, usuario) Botón de PRUEBA bajo AUTO (estrella roja): ¡A LAS ESTRELLAS! RECIBIDO: el rival te manda su ULTI y luego su ESPECIAL,
   * para ver cómo se ve cuando le llega al JUGADOR. Solo contra el bot (en red rompería la sincronía).
   */
  private makeSkyMeButton() {
    const R = 26;
    const c = this.add.container(0, 0).setScrollFactor(0).setDepth(5600);
    const g = this.add.graphics();
    g.fillStyle(C.outline).fillCircle(0, 4, R + 6);
    g.fillStyle(0x8a1f2a).fillCircle(0, 5, R);
    g.fillStyle(0xff4f5e).fillCircle(0, 0, R - 2);
    g.fillStyle(0xffffff, 0.25).fillEllipse(-4, -11, 30, 10);
    // estrella (icono de ¡A LAS ESTRELLAS!)
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? 6 : 14;
      pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r + 1 });
    }
    g.fillStyle(0xffffff, 1).fillPoints(pts, true);
    g.lineStyle(2, C.outline, 1).strokePoints(pts, true);
    c.add(g);
    c.setSize(R * 2 + 14, R * 2 + 14).setInteractive({ useHandCursor: true });
    c.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e?.stopPropagation?.();
      this.tweens.add({ targets: c, scale: { from: 0.88, to: 1 }, duration: 200, ease: 'Back.easeOut' });
      this.devSkyMeTest();
    });
    if (this.net) c.setVisible(false);
    return c;
  }

  /** PRUEBA: 1) TÚ recibes la ULTI del rival (impacto, aturdido sin raqueta); 2) ~1,3 s después su ESPECIAL directo a ti → ¡A LAS ESTRELLAS! */
  private devSkyMeTest() {
    if (this.net || this.phase === 'over' || this.phase === 'intro' || this.cineLock || this.duel) return;
    const bt = this.bot;
    const pl = this.player;
    this.endRemate();
    this.phase = 'rally';
    this.serving = false;
    this.serveCtl.state = 'SERVE_RESULT';
    this.serveClock = 0;
    this.serveCountdown.hide();
    this.board?.setInfo(null);
    this.setServeUi(false);
    // 1) ULTI recibida por TI
    const feet = project(pl.x, pl.y);
    powerImpactFx(this, 'inferno', feet.sx, feet.sy - 40 * feet.s, feet.s, this.infernoEl);
    pl.stun = 2.6; // quieto hasta que llegue su ESPECIAL
    pl.ch.impactStun('inferno', 2600, false);
    this.ultiStunOn(pl, 2600);
    this.loseRacket(pl);
    const h = this.headPos(pl);
    this.popText(h.x, h.y - 10, 'PRUEBA: ULTI DEL RIVAL', '#ff9aa4', 24);
    // 2) su ESPECIAL directo a ti (al llegarte sin raqueta, sales volando)
    this.time.delayedCall(1300, () => {
      if (this.phase !== 'rally' || !pl.racket || pl.launched) return;
      const s = this.ball.s;
      s.x = bt.x - 20;
      s.y = bt.y;
      s.z = 60;
      this.lastHitter = 'bot';
      this.bounces = 0;
      this.infernoFlight = false;
      this.setSmashFlight(this.botKit.smash);
      this.ball.setPower(true);
      this.ball.setKind('normal', true);
      aimShot(s, pl.x, pl.y, SHOT_SPEED * 1.6, 20);
      bt.ch.swing(true);
      const hb = this.headPos(bt);
      this.popText(hb.x, hb.y - 10, 'PRUEBA: ESPECIAL DEL RIVAL', '#ff9aa4', 24);
    });
  }

  /** AUTO encendido: el jugador se mueve, saca y usa habilidades solo (para probar el online sin otra persona) */
  private autoPlay = false;
  private autoBtn!: Phaser.GameObjects.Container;
  private testBtn!: Phaser.GameObjects.Container;
  private skyMeBtn!: Phaser.GameObjects.Container;
  private stunFog!: StunFog;
  private duelTestBtn!: Phaser.GameObjects.Container;
  /** dirección de golpe del AUTO (se renueva cada ~0,9 s) y distancia a su punto de golpeo */
  private autoAim = new Phaser.Math.Vector2();
  private autoAimAt = 0;
  private autoGap = 0;
  private autoServeT = 0;
  /** saque automático de una vez (nivel 2, P1, segundo saque sin sacar a tiempo): golpea en lo alto del lanzamiento */
  private serveAutoOnce = false;
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
    // (21-11-2026, usuario) OPACO en reposo (como EMOTES y RENDIRSE: no estorba la vista) y del todo visible al pulsarlo; con AUTO encendido queda algo más
    // visible (0,7) para que se vea que está activo
    const rest = () => (this.autoPlay ? 0.7 : 0.4);
    g.setAlpha(rest());
    txt.setAlpha(rest());
    c.setSize(R * 2 + 16, R * 2 + 16).setInteractive({ useHandCursor: true });
    c.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e?.stopPropagation?.();
      this.autoPlay = !this.autoPlay;
      this.autoServeT = 0;
      if (!this.autoPlay) stopMotion(this.motion);
      draw();
      this.tweens.killTweensOf([g, txt]);
      g.setAlpha(1);
      txt.setAlpha(1);
      this.tweens.add({ targets: [g, txt], alpha: rest(), delay: 1600, duration: 400 });
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
    // al sacar se queda un momento quieto en su sitio (como una persona): si salía corriendo al instante, el otro teléfono
    // aún lo tenía en la posición de saque y se veía un salto
    if (this.phase === 'serve' && this.meServes && this.serveCtl.state === 'POSITIONING' && this.autoServeT < 0.6) return new Phaser.Math.Vector2();
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
    if (!this.autoPlay || this.paused || this.cineLock) return;
    const now = this.time.now;
    if (this.lessonAim) this.autoAim.copy(this.lessonAim); // (24-11-2026) el ejercicio pide esa dirección
    else if (now > this.autoAimAt) {
      const r = Math.random();
      this.autoAim.set(r < 0.5 ? 0 : r < 0.7 ? -1 : r < 0.9 ? 1 : 0, r >= 0.9 ? (r < 0.95 ? -1 : 1) : 0);
      this.autoAimAt = now + 900;
    }
    // saque: se coloca un instante, lanza y golpea en lo alto
    if (this.meServes && this.phase === 'serve' && this.serveCtl.state === 'POSITIONING') {
      this.autoServeT += dt;
      if (this.autoServeT > 0.8) {
        this.autoServeT = 0;
        this.onServeButton('normal', true);
      }
    } else if (this.meServes && this.phase === 'toss' && this.serveCtl.state === 'AIMING' && this.ball.s.vz <= 0) {
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
    // (21-11-2026, usuario) con la imagen del botón (BUTTON_ART.surrender): OPACO en reposo (no estorba la vista) y se aclara del todo al pulsarlo
    // (el diálogo de RENDIRSE se abre; el botón vuelve a su opacidad al rato). Sin la imagen, el dibujo de siempre.
    let art: Phaser.GameObjects.Image | null = null;
    if (this.textures.exists(BUTTON_ART.surrender.key)) {
      g.destroy();
      art = this.add.image(0, 0, BUTTON_ART.surrender.key).setDisplaySize(R * 2 + 12, R * 2 + 12).setAlpha(0.4);
      c.add(art);
    } else c.add(g);
    c.setSize(R * 2 + 16, R * 2 + 16);
    c.setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => {
      this.tweens.add({ targets: c, scale: { from: 0.85, to: 1 }, duration: 250, ease: 'Back.easeOut' });
      if (art) {
        this.tweens.killTweensOf(art);
        art.setAlpha(1);
        this.tweens.add({ targets: art, alpha: 0.4, delay: 1600, duration: 400 });
      }
      this.openSurrender();
    });
    return c;
  }

  private openSurrender() {
    if (this.tutorial || this.paused || this.phase === 'over' || this.cineLock) return;
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
    const drawn = drawCourtView(this, this.ambienteHint, this.doubles); // (19-11-2026) el 2v2 usa su mapa propio (PARQUE)
    // pared del fondo donde se ve: la del estadio (muro + valla) o, en el dibujo de siempre, la valla de x = ax1 (z 70)
    this.ambienteKey = drawn?.key ?? '';
    this.ambienteFrame = drawn ? { cx: drawn.img.left + drawn.img.w / 2, cy: drawn.img.top + drawn.img.h / 2, w: drawn.img.w, h: drawn.img.h, key: drawn.key } : null;
    if (drawn?.key === 'ambiente-1-2v2') startParkWalkers(this, drawn.img); // (19-11-2026, usuario) gente paseando por el camino del fondo
    this.spectatorsCheer = drawn ? startSpectators(this, drawn.key, drawn.img) : null; // (21-11-2026, usuario) espectadores sentados (ambiente-1 y 2)
    if (drawn) startAmbientLights(this, drawn.key, drawn.img); // (21-11-2026, usuario) farol que parpadea (ambiente-1)
    if (drawn?.key === 'ambiente-3') startWalkers(this, 'ambiente-3', drawn.img); // (23-11-2026, usuario) autos por la calle de la izquierda
    if (drawn?.key === 'ambiente-4') {
      startWalkers(this, 'ambiente-4', drawn.img); // (21-11-2026, usuario) gente por la nieve de atrás y esquiador por la ladera
      startSnowFall(this, drawn.img); // nieve cayendo suave, por detrás de la cancha
    }
    this.backWall = drawn ? wallFromArt(project, LAT_C, drawn.wallAtY, drawn.padPx, drawn.fencePx, VIEW.Z_K) : { x: ax1, padZ: WALL_Z, fenceZ: WALL_Z };
    if (!drawn) {
      const BX = -1000;
      const BY = -700; // (14-11-2026) incluye el cielo de arriba: al alejar la cámara (globo) no queda franja negra
      const baked = this.add.renderTexture(BX, BY, 2720, 2500).setOrigin(0).setDepth(-10);
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
    this.birdPerch = null;
    if (drawn) {
      // La paloma se posa en el borde superior del muro sólido (no en la parte alta de la valla).
      // `perchPx` toma `wallTopY` para ambiente-1; la altura del sprite se ajusta en AmbientBird.ts para respetar la perspectiva.
      const wallTop = drawn.wallAtY - drawn.perchPx; // (21-11-2026) borde de arriba donde se posa (por ambiente: perchTopY)
      const farL = this.P(COURT.right, dT).x;
      const farR = this.P(COURT.right, dB).x;
      this.birdPerch = {
        left: { x: Math.max(70, Math.min(farL, farR) - 120), y: wallTop },
        right: { x: Math.min(VIEW.W - 70, Math.max(farL, farR) + 120), y: wallTop },
      };
    }
  }

  /** dónde puede posarse la paloma del ambiente (null = sin ambiente o ya lanzada) */
  private birdPerch: Parameters<typeof spawnAmbientBird>[1] | null = null;
  /** Vida del ambiente, una vez por partido al acabar la intro: la PALOMA (el avión se quitó el 12-11-2026). */
  private launchBird() {
    const bird = this.birdPerch;
    this.birdPerch = null;
    if (bird) spawnAmbientBird(this, bird);
  }

  // ---------------------------------------------------------------- HUD
  private createHud() {
    // marcador nuevo (diseño en ui/ScoreBoard.ts); misma posición/profundidad que el anterior
    this.board = new ScoreBoard(this, { player: this.doubles ? 'TÚ / ' + this.allyName : 'TÚ', rival: this.doubles ? this.botName + ' / ' + this.rival2Name : this.botName, gamesToWin: GAMES_TO_WIN });
    this.hud = this.board.setDepth(5500);
    addRiskBadge(this, this.board); // MODO RIESGO x2: marca "x2 RIESGO" si la partida Ranked en curso va con el evento
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
      shortMatch: this.score.shortMatch,
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

  /**
   * (14-11-2026) Dónde sale la precisión (ms) de un toque del Duelo Red: la del RIVAL sobre su cabeza y la TUYA bajo tus pies
   * (popText sube 50 px: se arranca más abajo para que no tape tu personaje).
   */
  private duelMsPos(who: Who) {
    if (who === 'bot') {
      const h = this.headPos(this.bot);
      return { x: h.x, y: h.y - 20 };
    }
    const p = project(this.player.x, this.player.y);
    return { x: p.sx, y: p.sy + 78 };
  }

  private headPos(a: Actor) {
    const p = project(a.x, a.y);
    return { x: p.sx, y: p.sy - 150 * p.s * VIEW.CHAR_K };
  }

  /**
   * (18-11-2026, usuario: "SMASH sale encima del personaje") Punto SOBRE la cabeza contando el SALTO (lift) y la raqueta levantada del remate:
   * el texto del SMASH! queda arriba del personaje, no sobre su cuerpo.
   */
  private aboveHeadPos(a: Actor) {
    const p = project(a.x, a.y, a.lift ?? 0);
    return { x: p.sx, y: p.sy - 150 * p.s * VIEW.CHAR_K - 70 * p.s * VIEW.CHAR_K };
  }

  // ---------------------------------------------------------------- habilidades
  /** DASH: desaparece y reaparece donde llegará la pelota. */
  private activateDash(): boolean {
    if (this.l2Freeze) return this.l2Dash();
    if (this.g4Point() !== null || this.g5Point() !== null) return false; // (26-11-2026) niveles 4 y 5 guiados: sin DEFENSIVO
    if (this.spKind()) return this.spKind() === 'defspecial' && this.spSt === 'defwait' ? this.spDefDash() : false; // (26-11-2026, usuario) puntos guiados: sin DEFENSIVO, salvo el del nivel 3, P4
    if (this.paused || this.cineLock || this.duel || !this.unlocked('defensive')) return false;
    if (this.player.racket) return this.noRacketHint();
    if (this.serveLock) return this.serveLockHint();
    if (this.phase !== 'rally' || this.lastHitter !== 'bot' || this.player.vanished) {
      this.popText(this.headPos(this.player).x, this.headPos(this.player).y, 'Espera la pelota', '#cfe0ff', 24);
      return false;
    }
    // poder DESTELLO del defensivo (tienda): teletransporte + revés
    if (getProfile().defensive === 'blink') return this.startBlink();
    // RELÁMPAGO (épico): azul neón, rayo hasta la pelota con rastro de rayos en el suelo + revés
    if (getProfile().defensive === 'lightning') return this.startLightning();
    // TIEMPO LENTO (legendario): corres en cámara lenta y, al llegar, cinemática de 2 s con la cámara cerca y una estirada
    if (getProfile().defensive === 'slowmo') {
      // 2v2 online: frenar el mundo en UN teléfono descuadraría a los bots del host y a tu compañero (el 1v1 lo tolera: el juez es quien lo usa)
      if (this.net2) {
        const hd = this.headPos(this.player);
        this.popText(hd.x, hd.y, 'TIEMPO LENTO: aún no en 2v2 online', '#cfe0ff', 22);
        return false;
      }
      return this.startSlowmo();
    }
    // SOMBRA (clon que corre y cambio de lugar) y SUPERSALTO (salto hasta el punto)
    if (getProfile().defensive === 'shadow') return this.startShadow();
    if (getProfile().defensive === 'jump') return this.startJump();
    // VOLTERETA (dos volteretas en arco, revés al caer) y PATINAJE (patinas dejando un camino de hielo)
    if (getProfile().defensive === 'flip') return this.startFlip();
    if (getProfile().defensive === 'skate') return this.startSkate();
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
  private shadowRun: { ch: Character; from: { x: number; y: number }; to: { x: number; y: number }; t: number; dur: number; ghosts: number; puff: { t: number } } | null = null;

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
    this.shadowRun = { ch: clone, from: { x: pl.x, y: pl.y }, to: { x: tx, y: ty }, t: 0, dur, ghosts: 0, puff: { t: 0 } };
    pl.vanished = true; // te quedas quieto (y sin golpe normal) hasta el cambio
    pl.ch.setMoving(false, 0);
    this.dashHit = { t: plan.t, elapsed: 0, x: tx, y: ty };
    const p = project(pl.x, pl.y);
    this.dashFx.burst(p.sx, p.sy, p.s * VIEW.CHAR_K, pl.ch.depth);
    sfx(this, 'dash-shadow');
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
    this.shadowTrailPuff(r.ch, r.puff);
    if (k < 1) return;
    // CAMBIO DE LUGAR: humo morado donde estabas, apareces en el punto y el clon se deshace
    const pl = this.player;
    this.portalFx(pl.x, pl.y, 0x5a32b8, 0xd4bfff);
    this.shadowSmokeFx(pl.x, pl.y, false);
    pl.x = r.to.x;
    pl.y = r.to.y;
    pl.vanished = false;
    pl.warp = 1;
    this.portalFx(pl.x, pl.y, 0x9a6bff, 0xffffff);
    this.shadowSmokeFx(pl.x, pl.y, true);
    this.cameras.main.shake(90, 0.004);
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
    this.jumpTakeoffFx(pl.x, pl.y);
    this.takeoffSquash(pl);
    sfx(this, 'dash-jump');
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
          this.renderActorPose(pl);
          this.dashFx.ghost(pl.ch, st.ghosts++, pl.ch.depth);
        }
      },
      onComplete: () => {
        pl.lift = 0;
        if (!pl.vanished) return;
        pl.x = tx;
        pl.y = ty;
        pl.vanished = false;
        this.jumpLandFx(tx, ty, true, pl);
      },
    });
    return true;
  }

  /**
   * SUPERSALTO / VOLTERETA (despegue): se agacha un instante y se estira al salir, como un salto de verdad (antes el dibujo subía rígido,
   * en la misma pose). Dura menos que el vuelo más corto (0,42 s), así que no se pisa con el agachado del aterrizaje. Usuario y rival online.
   */
  private takeoffSquash(a: Actor) {
    a.squat = 0.9;
    this.tweens.add({ targets: a, squat: -0.55, duration: 110, ease: 'Quad.easeOut', onComplete: () => this.tweens.add({ targets: a, squat: 0, duration: 220, ease: 'Sine.easeInOut' }) });
  }

  /** SUPERSALTO (aterrizaje): se agacha al caer y se levanta. */
  private landSquash(a: Actor) {
    this.tweens.killTweensOf(a); // sin restos del estirado del despegue
    a.squat = 1;
    this.tweens.add({ targets: a, squat: 0, duration: 280, ease: 'Quad.easeOut' });
  }
  /** Aterrizaje del SUPERSALTO: onda de choque doble en el suelo, polvo, temblor corto y vibración. */
  private jumpLandFx(x: number, y: number, mine = true, a?: Actor) {
    defFx.jumpLand(this, x, y);
    if (a) this.landSquash(a);
    this.cameras.main.shake(170, mine ? 0.011 : 0.007);
    if (mine) navigator.vibrate?.([30, 20, 50]);
  }


  /** SUPERSALTO (despegue): anillo de impulso, destello y polvo que sale disparado hacia los lados. Compartido: usuario y rival online. */
  private jumpTakeoffFx(x: number, y: number) {
    defFx.jumpTakeoff(this, x, y);
  }

  /**
   * SOMBRA (cambio de lugar): bocanada de humo negro que se abre donde estabas / donde apareces, con jirones morados que suben.
   * Va junto al portalFx del cambio, igual para usuario y rival online.
   */
  private shadowSmokeFx(x: number, y: number, big: boolean) {
    defFx.shadowSmoke(this, x, y, big);
  }

  /** SOMBRA: jirón de humo negro que deja el clon al correr (a lo sumo uno cada 45 ms). `at` = último instante en que soltó uno. */
  private shadowTrailPuff(ch: Character, at: { t: number }) {
    defFx.shadowTrailPuff(this, this.time.now, ch, at);
  }

  /** caminos de hielo vivos (PATINAJE): se quitan al empezar el punto siguiente */
  private iceTrails = new Set<IceTrail>();

  private newIceTrail() {
    const t = new IceTrail(this);
    this.iceTrails.add(t);
    t.onGone = () => this.iceTrails.delete(t);
    return t;
  }

  /**
   * VOLTERETA: llegas a la pelota dando dos volteretas laterales en arco (con un toque de suelo y polvo entre las dos), caes
   * agachado y devuelves con un REVÉS. Como el SUPERSALTO, no golpeas en el aire: la devolución queda asegurada (dashHit, con el
   * revés anticipado del DESTELLO). Los números están en logic/DefensiveMoves.ts.
   */
  private startFlip(): boolean {
    const pl = this.player;
    const plan = this.dashPlan(FLIP.airMin + FLIP.lead);
    if (!plan) {
      const h = this.headPos(pl);
      this.popText(h.x, h.y, '¡Muy tarde!', '#cfe0ff', 24);
      return false;
    }
    const tx = clamp(plan.x - 18, P_X[0], P_X[1]);
    const ty = clamp(plan.y, Y_MIN, Y_MAX);
    const dur = clamp(plan.t - FLIP.lead, FLIP.airMin, FLIP.airMax);
    this.stopCharge();
    stopMotion(this.motion);
    const from = { x: pl.x, y: pl.y };
    const to = { x: tx, y: ty };
    pl.vanished = true; // en el aire: sin moverse ni golpe normal
    pl.ch.setMoving(false, 0);
    this.dashHit = { t: plan.t, elapsed: 0, x: tx, y: ty, blink: true }; // devuelve con un revés al caer
    this.dustFx(pl.x, pl.y);
    this.takeoffSquash(pl);
    sfx(this, 'dash-jump');
    const h0 = this.headPos(pl);
    this.popText(h0.x, h0.y - 10, 'DEFENSIVO', '#c9a4ff', 26);
    navigator.vibrate?.(25);
    this.net?.sendAction('defensive', { kind: 'flip', x: from.x, y: from.y, tx, ty, ms: dur * 1000 });
    const st = { k: 0, ghosts: 0, mid: false };
    this.tweens.add({
      targets: st,
      k: 1,
      duration: dur * 1000,
      ease: 'Linear',
      onUpdate: () => {
        if (!pl.vanished) return; // el punto terminó o se canceló
        const po = flipPose(from, to, st.k);
        pl.x = po.x;
        pl.y = po.y;
        pl.lift = po.lift;
        pl.spin = po.spin;
        if (!st.mid && st.k >= 0.5) {
          st.mid = true; // toque de suelo entre las dos volteretas
          this.dustFx(po.x, po.y);
          sfx(this, 'dash-jump', 0.6);
        }
        if (st.ghosts < 3 && st.k >= (st.ghosts + 1) / 4) {
          this.renderActorPose(pl);
          this.dashFx.ghost(pl.ch, st.ghosts++, pl.ch.depth);
        }
      },
      onComplete: () => {
        pl.lift = 0;
        pl.spin = undefined;
        if (!pl.vanished) return;
        pl.x = tx;
        pl.y = ty;
        pl.vanished = false;
        this.flipLandFx(pl, tx, ty);
      },
    });
    return true;
  }

  /** Caída de la VOLTERETA: polvo, ondita blanca y se agacha un instante (squat). `mine` = la tuya (con vibración). */
  private flipLandFx(a: Actor, x: number, y: number, mine = true) {
    defFx.flipLand(this, x, y);
    a.squat = 1;
    this.tweens.add({ targets: a, squat: 0, duration: 280, ease: 'Quad.easeOut' });
    this.cameras.main.shake(100, mine ? 0.005 : 0.003);
    if (mine) navigator.vibrate?.([20, 15, 35]);
  }

  /**
   * PATINAJE: patinas en línea hasta donde llegará la pelota (sale rápido y se desliza al frenar, con el cuerpo inclinado) y
   * dejas un CAMINO DE HIELO que se derrite. Devolución asegurada como el DASH (dashHit). Números en logic/DefensiveMoves.ts.
   */
  private startSkate(): boolean {
    const pl = this.player;
    const plan = this.dashPlan(SKATE.minT + SKATE.lead);
    if (!plan) {
      const h = this.headPos(pl);
      this.popText(h.x, h.y, '¡Muy tarde!', '#cfe0ff', 24);
      return false;
    }
    const tx = clamp(plan.x - 18, P_X[0], P_X[1]);
    const ty = clamp(plan.y, Y_MIN, Y_MAX);
    const dur = clamp(plan.t - SKATE.lead, SKATE.minT, SKATE.maxT);
    this.stopCharge();
    stopMotion(this.motion);
    const from = { x: pl.x, y: pl.y };
    const to = { x: tx, y: ty };
    const dirX = Math.sign(ty - pl.y) || 1; // lado de pantalla hacia el que patina
    pl.vanished = true; // sin moverse ni golpe normal hasta llegar
    pl.ch.setMoving(false, 0);
    pl.ch.setSprint(true, dirX);
    this.dashHit = { t: plan.t, elapsed: 0, x: tx, y: ty };
    const trail = this.newIceTrail();
    trail.add(from.x, from.y);
    const p = project(from.x, from.y);
    this.dashFx.burst(p.sx, p.sy, p.s * VIEW.CHAR_K, pl.ch.depth);
    sfx(this, 'dash-destello', 0.7);
    const h0 = this.headPos(pl);
    this.popText(h0.x, h0.y - 10, 'DEFENSIVO', '#c9a4ff', 26);
    navigator.vibrate?.(20);
    this.net?.sendAction('defensive', { kind: 'skate', x: from.x, y: from.y, tx, ty, ms: dur * 1000 });
    const st = { k: 0, ghosts: 0 };
    this.tweens.add({
      targets: st,
      k: 1,
      duration: dur * 1000,
      ease: 'Linear',
      onUpdate: () => {
        if (!pl.vanished) return trail.finish(); // el punto terminó o se canceló
        const e = skateEase(st.k);
        pl.x = from.x + (tx - from.x) * e;
        pl.y = from.y + (ty - from.y) * e;
        pl.spin = skateLean(from, to, st.k);
        trail.add(pl.x, pl.y);
        if (st.ghosts < 2 && st.k >= (st.ghosts + 1) / 3) {
          this.renderActorPose(pl);
          this.dashFx.ghost(pl.ch, st.ghosts++, pl.ch.depth);
        }
      },
      onComplete: () => {
        pl.spin = undefined;
        trail.finish();
        if (!pl.vanished) return;
        pl.x = tx;
        pl.y = ty;
        pl.vanished = false;
        pl.ch.setSprint(false, dirX, true); // frenada de la hoja, como el DASH
        iceSprayFx(this, tx, ty, dirX);
      },
    });
    return true;
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
    this.dashFx.burst(a.sx, a.sy, k, pl.ch.depth, 0x45d9ff);
    sfx(this, 'dash-destello');
    if (Math.hypot(tx - from.x, ty - from.y) > 40) {
      for (let i = 0; i < 3; i++) {
        const f = (i + 1) / 4;
        pl.x = from.x + (tx - from.x) * f;
        pl.y = from.y + (ty - from.y) * f;
        this.renderActorPose(pl); // la sombra copia la pose en esa posición
        this.dashFx.ghost(pl.ch, i, pl.ch.depth);
      }
      pl.x = from.x;
      pl.y = from.y;
      this.renderActorPose(pl);
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
   * RELÁMPAGO (DEFENSIVO ÉPICO, 18-11-2026): el personaje se vuelve azul neón un instante, se convierte en un rayo que cruza la cancha
   * (casi un teletransporte: rayo + rastro de rayos y marcas chamuscadas en el suelo) y aparece junto a la pelota para devolver de revés.
   * Mismos tiempos y garantía de devolución que el DESTELLO (dashHit con blink). En red: 'defensive' kind 'lightning' (netRemoteWarp).
   */
  private startLightning(): boolean {
    const pl = this.player;
    const normal = this.dashPlan(LIGHTNING.chg + LIGHTNING.out + LIGHTNING.in + LIGHTNING.swingLead + 0.02);
    const plan = normal ?? this.dashPlan(LIGHTNING.fastChg + LIGHTNING.fastOut + LIGHTNING.fastIn + 0.1);
    if (!plan) {
      const h = this.headPos(pl);
      this.popText(h.x, h.y, '¡Muy tarde!', '#cfe0ff', 24);
      return false;
    }
    const fast = !normal;
    const tx = clamp(plan.x - 18, P_X[0], P_X[1]);
    const ty = clamp(plan.y + LIGHTNING.side, Y_MIN, Y_MAX);
    const from = { x: pl.x, y: pl.y };
    const chg = (fast ? LIGHTNING.fastChg : LIGHTNING.chg) * 1000;
    const out = (fast ? LIGHTNING.fastOut : LIGHTNING.out) * 1000;
    const inn = (fast ? LIGHTNING.fastIn : LIGHTNING.in) * 1000;
    this.stopCharge();
    stopMotion(this.motion);
    pl.vanished = true; // quieto (y sin golpe normal) hasta que reaparece
    pl.ch.setMoving(false, 0);
    this.dashHit = { t: plan.t, elapsed: 0, x: tx, y: ty, blink: true };
    this.lightningWarp(pl, from, { x: tx, y: ty }, chg, out, inn);
    const h = this.headPos(pl);
    this.popText(h.x, h.y - 10, 'DEFENSIVO', '#c9a4ff', 26);
    // en red el rival ve lo mismo (netRemoteWarp): lo decide este teléfono, el otro solo lo muestra
    this.net?.sendAction('defensive', { kind: 'lightning', x: from.x, y: from.y, tx, ty, chg, out, in: inn, delay: 0 });
    return true;
  }

  /**
   * La coreografía del RELÁMPAGO sobre `a` (el jugador, el bot o el rival online): azul neón (`chg` ms) → rayo + rastro en el suelo y
   * desaparece (`out`) → aparece en `to` (`inn`). La misma en los tres casos; `a.vanished` lo pone quien la llama.
   */
  private lightningWarp(a: Actor, from: { x: number; y: number }, to: { x: number; y: number }, chg: number, out: number, inn: number) {
    const anchor = () => {
      const f = project(a.x, a.y);
      return { x: f.sx, y: f.sy, headY: this.headPos(a).y };
    };
    lightningBodyFx(this, anchor, chg + out + inn + 220, a.ch, undefined, true);
    sfx(this, 'dash-electirco-1', 0.8);
    this.tweens.add({
      targets: a,
      warp: 0,
      delay: chg,
      duration: out,
      ease: 'Quad.easeIn',
      onStart: () => {
        const pa = project(from.x, from.y);
        const pb = project(to.x, to.y);
        const head = pa.sy - this.headPos(a).y;
        lightningDashFlash(this, pa.sx, pa.sy, pb.sx, pb.sy, pa.s, head);
        lightningFloorTrail(this, pa.sx, pa.sy, pb.sx, pb.sy, pa.s * VIEW.CHAR_K);
      },
      onComplete: () => {
        a.x = to.x;
        a.y = to.y;
        this.tweens.add({ targets: a, warp: 1, duration: inn, ease: 'Back.easeOut', onComplete: () => (a.vanished = false) });
      },
    });
  }

  /**
   * TIEMPO LENTO (DEFENSIVO LEGENDARIO, 18-11-2026): el mundo va a cámara lenta (SLOWMO.k) mientras el personaje corre a la pelota; al llegar
   * empieza una cinemática de 2 s con el partido congelado: la cámara se acerca y se estira a por la pelota (clip dive a cámara lenta); al
   * final devuelve con un golpe cargado al máximo y la cámara vuelve sola. Garantía de devolución como el DASH. En red (lo decide este
   * teléfono): el rival ve la carrera (por los estados, también lenta), y al llegar recibe 'defensive' kind 'slowmo' (la cinemática, sin mover su cámara).
   */
  private startSlowmo(): boolean {
    const pl = this.player;
    const plan = this.dashPlan(SLOWMO.minT);
    if (!plan) {
      const h = this.headPos(pl);
      this.popText(h.x, h.y, '¡Muy tarde!', '#cfe0ff', 24);
      return false;
    }
    const side = plan.y > pl.y ? 1 : -1; // lado de la pantalla hacia el que se estira
    // la carrera termina un poco ANTES de la pelota (atrás y al costado): lo que falta lo avanza la estirada, en la cinemática (suspenso)
    const tx = clamp(plan.x - pl.dir * (15 + SLOWMO.ax), P_X[0], P_X[1]);
    const ty = clamp(plan.y - side * (LUNGE_ARM + SLOWMO.ay), Y_MIN, Y_MAX);
    const runT = Math.max(0.3, plan.t - SLOWMO.lead); // s de juego hasta empezar la cinemática
    this.stopCharge();
    stopMotion(this.motion);
    this.slowmoAbort(); // (por si quedaba algo de otro)
    this.slowmoActive = true;
    pl.vanished = true; // sin golpe normal mientras corre
    pl.ch.setMoving(false, 0);
    pl.ch.setSprint(true, Math.sign(ty - pl.y) || 1);
    // ritmo de las zancadas = lo que avanza de verdad en pantalla (en cámara lenta el mundo va a SLOWMO.k: sin esto corría mucho y avanzaba poco)
    const speedK = (Math.hypot(tx - pl.x, ty - pl.y) / runT) / PLAYER_SPEED;
    this.dashHit = { t: plan.t, elapsed: 0, x: tx, y: ty, slowmo: { side, started: false, rate: runAnimRate(speedK) / SLOWMO.k } };
    this.legendFade = false;
    this.setSlowMo(SLOWMO.k);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.setSlowMo(1));
    const p = project(pl.x, pl.y);
    this.dashFx.burst(p.sx, p.sy, p.s * VIEW.CHAR_K, pl.ch.depth, 0x9be7ff);
    sfx(this, 'dash-destello', 0.7);
    this.cameras.main.flash(120, 190, 230, 255);
    const h = this.headPos(pl);
    this.popText(h.x, h.y - 10, 'DEFENSIVO', '#c9a4ff', 26);
    this.tweens.add({ targets: pl, x: tx, y: ty, duration: runT * 1000, ease: 'Sine.easeInOut' }); // (los tweens van a cámara lenta: son segundos de juego)
    for (let i = 0; i < 3; i++) {
      this.time.delayedCall(runT * 1000 * ((i + 1) / 4), () => {
        if (!this.dashHit?.slowmo) return;
        this.renderActors();
        this.dashFx.ghost(pl.ch, i, pl.ch.depth);
      });
    }
    return true;
  }

  /** Cada fotograma de la carrera lenta: al llegar (SLOWMO.lead s antes del contacto) empieza la cinemática; si la pelota ya no va a por ti, se cancela. */
  private updateSlowmoHit(d: NonNullable<MatchScene['dashHit']>, dt: number) {
    const sm = d.slowmo;
    if (!sm || sm.started) return;
    const s = this.ball.s;
    if (this.phase !== 'rally' || this.lastHitter === 'player' || this.bounces >= 2 || s.vx > 0) {
      this.slowmoAbort();
      return;
    }
    const pl = this.player;
    // la penumbra (solo se ven los dos personajes y la pelota) y el ritmo de las zancadas, cada fotograma de la carrera
    this.energyCine.drawDark(SLOWMO.dark, Math.min(this.game.loop.delta / 1000, 0.05));
    for (const sp of spritesIn(pl.ch)) if (sp.anims) sp.anims.timeScale = sm.rate;
    d.elapsed += dt;
    if (d.elapsed < d.t - SLOWMO.lead) return;
    sm.started = true;
    this.tweens.killTweensOf(pl);
    this.setSlowMo(1);
    pl.vanished = false;
    pl.warp = 1;
    pl.ch.setSprint(false, 0);
    pl.ch.setMoving(false, 0);
    pl.ch.facing = sm.side;
    // donde acaba la estirada: junto a la pelota (que queda quieta durante la cinemática); ahora está atrás y al costado, y la AVANZA
    const from = { x: pl.x, y: pl.y };
    const to = { x: clamp(s.x - pl.dir * 15, P_X[0], P_X[1]), y: clamp(s.y - sm.side * LUNGE_ARM, Y_MIN, Y_MAX) };
    // la estirada empieza ya (se congela en su primer cuadro) y, al soltarse, dura justo SLOWMO.leadMs
    if (!pl.ch.lunge(sm.side)) pl.ch.swing();
    const sprites = spritesIn(pl.ch);
    for (const sp of sprites) if (sp.anims) sp.anims.timeScale = SLOWMO.spriteK;
    this.slowCamHold = true;
    this.slowCam = 0;
    this.slowCamX = 0;
    sfx(this, 'cargando', 0.6);
    this.net?.sendAction('defensive', { kind: 'slowmo', x: from.x, y: from.y, tx: to.x, ty: to.y, side: sm.side, ms: SLOWMO.hitMs });
    this.cine.start({
      profile: SLOWMO_CINE,
      freeze: [...sprites, ...spritesIn(this.bot.ch)],
      executor: sprites,
      leadMs: SLOWMO.leadMs,
      focus: () => this.cineFocus(pl),
      onFrame: (e) => {
        this.slowCam = clamp(e / SLOWMO.zoomInMs, 0, 1);
        this.slowCamX = clamp((e - SLOWMO.zoomInMs) / (SLOWMO.hitMs - SLOWMO.zoomInMs), 0, 1); // sigue acercándose hasta el golpe
        // la estirada AVANZA hacia la pelota (despacio: suspenso); llega justo al contacto
        const u = clamp(e / (SLOWMO.hitMs - 150), 0, 1);
        const m = u * u * (3 - 2 * u);
        pl.x = from.x + (to.x - from.x) * m;
        pl.y = from.y + (to.y - from.y) * m;
        this.renderActors();
        this.energyCine.drawDark(SLOWMO.dark, 0.016);
        this.slowmoCamera();
      },
      onHit: () => {
        this.slowCamHold = false;
        this.dashHit = null;
        this.slowmoActive = false;
        this.legendFade = true; // la penumbra se va sola (update)
        pl.x = to.x;
        pl.y = to.y;
        if (this.phase === 'rally' && this.lastHitter !== 'player' && s.x < NET_X) this.slowmoShot(sm.side);
        else this.slowmoAbort();
      },
      onCancel: () => this.slowmoAbort(),
    });
  }

  /** La cámara cercana de la cinemática de TIEMPO LENTO (el partido congelado no pasa por el código de cámara normal). */
  private slowmoCamera() {
    const cam = this.cameras.main;
    const pp = project(this.player.x, this.player.y);
    const se = this.slowCam * this.slowCam * (3 - 2 * this.slowCam);
    cam.setZoom(VIEW.CAM_ZOOM * (1 + (SLOWMO.zoom - 1) * se + (SLOWMO.zoomEnd - SLOWMO.zoom) * this.slowCamX * se));
    cam.scrollY = (pp.sy - SLOWMO.focusLift - this.scale.height / 2) * se;
    cam.scrollX += (this.baseScrollX + (pp.sx - VIEW.W / 2) * (VIEW.FOLLOW + (1 - VIEW.FOLLOW) * 0.5 * se) - cam.scrollX) * 0.2;
    this.lobVignette.setAlpha(LOB_SMASH.vignette * se).setVisible(se > 0.01);
  }
  /** El golpe de la estirada de TIEMPO LENTO: devolución cargada al máximo, rápida y al fondo. */
  private slowmoShot(side: number) {
    const pl = this.player;
    const s = this.ball.s;
    this.timing.clear();
    this.stopCharge();
    const tgx = NET_X + (COURT.right - NET_X) * rand(0.7, 0.9);
    const tgy = LAT_C + rand(-0.6, 0.6) * (HALF_W - 30);
    s.z = Math.max(s.z, 20);
    aimShot(s, tgx, tgy, SHOT_SPEED * 1.45, 10);
    this.ball.setPower(false);
    this.ball.setKind('normal');
    this.ball.setMaxCharge(true);
    if (this.net) this.netHit = { charged: true, overhead: false, volley: false, lunge: side }; // el rival repite la estirada
    this.recordHit('player', true);
    this.bounces = 0;
    this.ai.onPlayerHit(false);
    this.hitFx(s.x, s.y, s.z, true);
    pl.stun = LUNGE_RECOVER; // tirado y la recuperación de siempre
    this.dustFx(pl.x, pl.y);
    this.cameras.main.shake(220, 0.012);
    sfx(this, 'golpe-fuerte', 0.9);
    sfx(this, 'electricidad', 0.6);
  }

  /** Corta el TIEMPO LENTO en curso (punto terminado, cancelación): tiempo y cámara normales y el personaje en pie. */
  private slowmoAbort() {
    const pl = this.player;
    const was = !!this.dashHit?.slowmo;
    if (was) this.dashHit = null;
    this.slowCamHold = false;
    if (this.slowmoActive || was) {
      this.legendFade = true; // la penumbra se va sola (update)
      this.tweens.killTweensOf(pl);
      this.setSlowMo(1);
      pl.vanished = false;
      pl.warp = 1;
      pl.ch.setSprint(false, 0);
    }
    this.slowmoActive = false;
  }
  private slowmoActive = false;

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
    if (d.slowmo) {
      this.updateSlowmoHit(d, dt);
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

  /**
   * (25-11-2026, usuario) NIVEL 2: DEFENSIVO con la pelota QUIETA en el aire: corres (sprint del DASH) hasta ella y, al llegar, le pegas;
   * recién ahí la pelota se devuelve (recordHit la manda lejos del bot: punto tuyo).
   */
  private l2Dash(): boolean {
    const f = this.l2Freeze;
    if (!f || this.l2Running) return false;
    this.l2Running = true;
    const pl = this.player;
    const tx = clamp(f.x - 22, P_X[0], P_X[1]);
    const ty = clamp(f.y, Y_MIN, Y_MAX);
    const dirX = Math.sign(ty - pl.y) || 1;
    const dist = Math.hypot(tx - pl.x, ty - pl.y);
    this.stopCharge();
    stopMotion(this.motion);
    pl.ch.setSprint(true, dirX);
    const p = project(pl.x, pl.y);
    this.dashFx.burst(p.sx, p.sy, p.s * VIEW.CHAR_K, pl.ch.depth);
    sfx(this, dashSfx(this.smashEl));
    const h = this.headPos(pl);
    this.popText(h.x, h.y - 10, 'DEFENSIVO', '#c9a4ff', 26);
    this.tweens.add({
      targets: pl,
      x: tx,
      y: ty,
      duration: clamp((dist / (PLAYER_SPEED * 3)) * 1000, 250, 700),
      ease: 'Quad.easeOut',
      onComplete: () => {
        pl.ch.setSprint(false, dirX, true);
        if (!this.l2Freeze || this.phase !== 'rally') return;
        // la pelota retoma su vuelo justo en el golpe (el DEFENSIVO cuenta: dashHit)
        const s = this.ball.s;
        Object.assign(s, f);
        this.l2Freeze = null;
        this.l2Lock = false;
        this.bot.ch.releaseFollowThrough();
        pl.ch.facing = ty < pl.y ? -1 : 1;
        this.dashHit = { t: 0, elapsed: 0, x: tx, y: ty, sprint: true };
        this.playerHit(true);
        this.dashHit = null;
      },
    });
    return true;
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
    this.net?.sendAction('sprint-start', { dirX: this.dashRun.dirX, element: this.smashEl }); // element: su ESPECIAL equipado (el rival oye el DASH eléctrico con RAYO desde el primer dash)
    const p = project(pl.x, pl.y);
    this.dashFx.burst(p.sx, p.sy, p.s * VIEW.CHAR_K, pl.ch.depth);
    sfx(this, dashSfx(this.smashEl));
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
    if (shouldCancelRun({ rally: this.phase === 'rally', playerHit: this.lastHitter === 'player', specialActive: this.cineLock || this.inferno.executing })) {
      this.dashRun = null;
      pl.ch.setSprint(false, r.dirX, false); // si ya hay un golpe en marcha, el golpe manda
      this.net?.sendAction('sprint-end');
      return;
    }
    const st = stepRun(r, dt);
    pl.x = st.pos.x;
    pl.y = st.pos.y;
    if (st.ghosts.length) {
      this.renderActorPose(pl); // la sombra copia la pose en la posición real de este instante
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
    defFx.portal(this, x, y, col, light);
  }

  /** (red) el rival tiene su ESPECIAL armado: se le ve el mismo brillo leve */
  private netRivalArmed = false;
  /** brillo leve alrededor del personaje con el ESPECIAL armado (jugador / rival en red) */
  private smashGlow: Record<'player' | 'bot' | 'mate', Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse | null> = { player: null, bot: null, mate: null };
  /** (19-11-2026) 2v2 online: el COMPAÑERO tiene su ESPECIAL armado (su mismo brillo leve, con el color de su poder) */
  private net2MateArmed = false;
  private net2MateEl: SmashPower = 'fire';

  /**
   * ESPECIAL armado: brillo leve y suave del color del poder alrededor del personaje mientras dure el armado (sin preFX:
   * no se puede en los sprites dentro de un Container). Avisa de que el próximo golpe es el ESPECIAL.
   */
  private updateSmashGlow() {
    const sides: ['player' | 'bot' | 'mate', Actor, boolean, SmashPower][] = [
      ['player', this.player, this.smashArmed && this.phase !== 'over', this.smashEl],
      ['bot', this.bot, !!this.net && this.netRivalArmed && this.phase !== 'over', this.netRivalSmashEl],
    ];
    if (this.ally) sides.push(['mate', this.ally, this.net2 && this.allyRemote && this.net2MateArmed && this.phase !== 'over', this.net2MateEl]);
    for (const [k, a, on, el] of sides) {
      let g = this.smashGlow[k];
      if (!on || a.vanished) {
        if (g) {
          g.destroy();
          this.smashGlow[k] = null;
        }
        continue;
      }
      const feet = project(a.x, a.y);
      const head = this.headPos(a);
      const h = Math.max(20, feet.sy - head.y);
      if (!g) {
        const col = SMASH_LOOK[el].ring;
        g = this.textures.exists('fx-inferno-glow')
          ? this.add.image(0, 0, 'fx-inferno-glow').setTint(col)
          : this.add.ellipse(0, 0, 100, 100, col, 0.5);
        g.setBlendMode(Phaser.BlendModes.ADD);
        this.smashGlow[k] = g;
      }
      const pulse = 0.22 + 0.08 * Math.sin(this.time.now / 260);
      g.setPosition(feet.sx, feet.sy - h * 0.5)
        .setDisplaySize(h * 1.25, h * 1.5)
        .setAlpha(pulse)
        .setDepth(a.ch.depth - 0.5); // detrás del personaje: un halo, no lo tapa
    }
  }

  /** Fin del punto con el ESPECIAL armado sin usar: se desarma y el botón queda listo otra vez (hay que volver a pulsarlo). */
  private disarmUnusedSmash() {
    if (!this.smashArmed) return;
    this.smashArmed = false;
    this.superArmed = false;
    this.smashBtn.setArmed(false);
    this.smashBtn.resetCooldown();
    this.fadeOutSnd(this.smashSnd);
    this.smashSnd = null;
    this.net?.sendAction('smash-disarmed');
  }

  /** SMASH: la pelota se prende fuego; el siguiente golpe es una bola de fuego. */
  /**
   * 2v2 ONLINE: ESPECIAL y ULTIS normales congelan los 4 personajes en los dos teléfonos (net2ApplyAction, como el 1v1). La ULTI LEGENDARIA
   * (BOLA DE ENERGÍA, HURACÁN) aún no: su peloteo automático tiene al rival como víctima y no está adaptado a 2 rivales.
   */
  private net2NoCine(): boolean {
    // solo la ULTI LEGENDARIA (peloteo automático con semilla): el ESPECIAL y las ULTIS normales ya se sincronizan (net2ApplyAction)
    if (!this.net2 || !isLegendaryInferno(getProfile().inferno)) return false;
    const h = this.headPos(this.player);
    this.popText(h.x, h.y, 'ULTI LEGENDARIA: aún no en 2v2 online', '#cfe0ff', 22);
    return true;
  }

  private activateSmash(): boolean {
    if (this.g4Point() !== null) return this.g4Point() === 0 && this.g4St === 'wait' ? this.g4Special() : false; // (26-11-2026, usuario) nivel 4 guiado
    if (this.g5Point() !== null) return this.g5Point() === 3 && this.g5St === 'spwait' ? this.g5Special() : false;
    if (this.paused || this.cineLock || this.duel || this.phase === 'over' || this.phase === 'intro' || this.smashArmed || !this.unlocked('special')) return false;
    if (this.player.racket) return this.noRacketHint();
    if (this.serveLock) return this.serveLockHint();
    // REMATE en el aire contra un rival SIN RAQUETA (ULTI recibida): el ESPECIAL cancela el salto. Baja enseguida y el
    // golpe sale como ESPECIAL (no remate), la única forma de mandarlo ¡A LAS ESTRELLAS! con un globo en el círculo
    if (this.remateCine && this.bot.racket) this.cancelRemateForSmash();
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
    // la pelota NO cambia de color al pulsar: toma el color de tu poder recién cuando le pegas con el ESPECIAL
    // (playerHit: setSmashFlight + setPower). El aviso de "armado" es el botón y el sonido de carga.
    this.net?.sendAction('smash-armed', { element: this.smashEl }); // el rival sabe el color de tu poder
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

  /** Empieza una ULTI (la lanza `owner`): desde ya el otro lado no puede lanzar la suya (`victim` = quien la va a recibir). */
  private ultiStart(owner: Who, victim: Actor) {
    this.ultiOwner = owner;
    this.ultiVictim = victim;
    this.ultiLanded = false;
    this.ultiSeenAt = this.time.now;
  }

  /** El golpe de la ULTI llegó a `a` (aturdido + raqueta fuera): ahora hay que esperar a que recupere la raqueta. */
  private ultiHit(a: Actor) {
    if (!this.ultiOwner) return;
    this.ultiLanded = true;
    this.ultiVictim = a;
  }

  /** ¿El que recibió la ULTI ya recuperó la raqueta y dejó el aturdido? */
  private ultiRecovered(): boolean {
    const v = this.ultiVictim;
    return !v || (!v.racket && v.stun <= 0);
  }

  /** ¿La ULTI de `side` está bloqueada porque el otro lado lanzó la suya primero y su golpe aún no se resolvió? */
  private ultiBlocked(side: Who): boolean {
    const o = this.ultiOwner;
    if (!o || o === side) return false;
    if (this.ultiLanded && this.ultiRecovered()) {
      this.ultiOwner = null; // ya recuperó la raqueta: se vuelve a habilitar
      return false;
    }
    return true;
  }

  /** Cada fotograma: la ULTI en juego se libera sola si su golpe no llegó a nadie (fuera, rebote…) o ya se recuperó la raqueta. */
  private ultiTick() {
    if (!this.ultiOwner) {
      if (this.controlsDim !== 1) this.setControlsDim(1); // terminó la ULTI: los controles vuelven a su opacidad
      return;
    }
    if (this.cineLock || this.infernoFlight) this.ultiSeenAt = this.time.now;
    else if (this.ultiLanded) {
      if (this.ultiRecovered()) this.ultiOwner = null;
    } else if (this.time.now - this.ultiSeenAt > 1000) this.ultiOwner = null;
  }

  /**
   * Llegó la ULTI del rival (red) mientras tengo la mía: si la mía ya salió y está en vuelo, la suya no vale (salió primero la mía). Si las dos
   * salieron a la vez (se cruzaron por la red), gana la del ANFITRIÓN: el invitado cancela la suya (sigue armada y con su carga) y muestra la del
   * anfitrión; el anfitrión ignora la del invitado. true = se muestra la del rival.
   */
  private ultiAcceptRemote(): boolean {
    if (this.ultiOwner !== 'player') return true;
    if (this.net?.role === 'host' || !this.cineLock) return false;
    if (this.legend) this.legendCancel();
    else this.cine.cancel();
    this.ultiOwner = null;
    return true;
  }

  /** Botón en modo INFERNO: arma la técnica (no consume la carga). */
  private armInferno(): boolean {
    if (this.net2NoCine()) return false;
    if (this.ultiBlocked('player')) return false; // el rival lanzó su ULTI primero: la tuya espera a que recupere la raqueta el que la recibe
    if (this.paused || this.cine.busy || this.legend || this.duel || this.phase !== 'rally' || this.smashArmed || this.player.vanished || !this.unlocked('ulti')) return false;
    if (this.player.racket) return this.noRacketHint();
    if (this.serveLock) return this.serveLockHint();
    if (!this.inferno.arm()) return false;
    this.smashBtn.setArmed(true);
    // (21-11-2026, usuario) al armar la ULTI estando cargando, se quita YA el panel de carga (no debe ensuciar la pantalla ni la ULTI)
    if (this.charging) this.stopCharge(false);
    return true;
  }

  /** Valida el contacto con el alcance especial (+25 %) y, si es viable, lanza la cinemática. */
  private tryInferno(): boolean {
    if (this.cineLock || this.phase !== 'rally') return false;
    if (this.ultiBlocked('player')) return false; // sin ULTI contra ULTI (queda armada hasta que se libere)
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
    this.ultiStart('player', this.bot); // la tuya salió primero: la ULTI del rival queda bloqueada hasta que recupere la raqueta
    this.setControlsDim(ULTI_HUD_DIM); // (21-11-2026, usuario) controles más opacos mientras dura la ULTI
    // (17-11-2026) ULTI LEGENDARIA (BOLA DE ENERGÍA): su cinemática extra (carga de 6 s, peloteo automático y bola final)
    if (isLegendaryInferno(getProfile().inferno)) {
      this.startLegend(c);
      return;
    }
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
      freeze: this.doubles ? this.freezeSprites() : [...sprites, ...spritesIn(this.bot.ch)],
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
        this.infernoDashStep(e, pl, from, c, sprites, dashSt, el);
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
  private infernoDashStep(e: number, a: Actor, from: { x: number; y: number }, to: { x: number; y: number }, sprites: Phaser.GameObjects.Sprite[], st: { sound: boolean; flashed?: boolean }, el: InfernoElement = 'fire') {
    const D = INFERNO.dash;
    // RAYO: sin sombras. El cuerpo se carga de electricidad (brillante, con rayos) en su sitio y luego viaja como un
    // destello-rayo hasta la pelota; allí golpea con la pose de la ULTI de siempre
    // (18-11-2026, usuario) LUZ: igual que el RAYO (sin sombras, se teletransporta) pero todo blanco, con partículas blancas y sin electricidad
    // (18-11-2026, usuario) SOMBRA: lo mismo en oscuridad (cuerpo negro, sombras que irradian, estela oscura)
    if (el === 'lightning' || el === 'light' || el === 'shadow') {
      const light = el === 'light' || el === 'shadow';
      const anchor = () => {
        const f = project(a.x, a.y);
        return { x: f.sx, y: f.sy, headY: this.headPos(a).y };
      };
      if (!st.sound) {
        st.sound = true;
        infernoSound.dash(this);
        lightningBodyFx(this, anchor, D.toMs - D.fromMs + 450, a.ch, undefined, el === 'shadow' ? 'shadow' : light ? 'light' : false);
      }
      const u = Math.min(1, (e - D.fromMs) / (D.toMs - D.fromMs - 120));
      if (u < 0.5) {
        a.x = from.x;
        a.y = from.y;
      } else {
        if (!st.flashed) {
          st.flashed = true;
          const pa = project(from.x, from.y);
          const pb = project(to.x, to.y);
          const head = pa.sy - this.headPos(a).y;
          (el === 'shadow' ? shadowDashFlash : light ? lightDashFlash : lightningDashFlash)(this, pa.sx, pa.sy, pb.sx, pb.sy, pa.s, head);
        }
        a.x = to.x;
        a.y = to.y;
      }
      this.renderActors();
      return;
    }
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
    if (this.vsOpp) return lookForSkin(this.vsOpp.skin, 'front', getProfile().skin);
    if (this.duo) return lookForSkin(this.duo.rival1, 'front', getProfile().skin); // (25-11-2026) 2v2 contra bots
    if (this.rivalPick) return lookForSkin(this.rivalPick, 'front', getProfile().skin);
    // En el tutorial 1v1, la cancha usa la misma rotación que la pantalla VS.
    if (this.tutorial && !this.doubles) return lookForSkin(tutorialRivalFor(getProfile().skin, getPlayer().level), 'front', getProfile().skin);
    return rivalLook(getProfile().skin);
  }

  /** (25-11-2026) personaje del 2.º rival del 2v2: el de la búsqueda (contra bots) o el tuyo de frente (online, como antes) */
  private rival2Skin(): string {
    return this.duo?.rival2 ?? getProfile().skin;
  }

  /** id del personaje rival (nxo, mai…) según rivalLk */
  private rivalSkin(): string {
    const id = this.rivalLk().id;
    return id && id !== 'rival' ? id : 'nxo';
  }

  /**
   * (19-11-2026, usuario) PERSONAJE de cada actor, para su MIRADA (ULTI), sus OJOS (ZONA) y sus EMOTES. En el 2v2 los rivales no son el
   * mismo personaje: el 1.º es rivalSkin() y el 2.º es TU personaje de frente (MatchScene.create), y el aliado es el otro humano (online) o
   * rivalSkin() (contra bots). Antes todo "rival" usaba rivalSkin() y el 2.º salía con los ojos y las caritas del 1.º.
   */
  private skinOf(a: Actor): string {
    if (a === this.player) return getProfile().skin;
    if (this.doubles && a === this.ally) return this.net2 ? this.net!.opponent.skin : this.duo?.ally ?? this.rivalSkin();
    if (this.doubles && this.rivalActors.indexOf(a) === 1) return this.rival2Skin();
    return this.rivalSkin();
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
    infernoSound.impact(this, this.infernoEl);
    this.ball.quietFx = true; // la pelota es ahora la esfera de fuego (sin estela propia)
    this.infernoBounced = false; // su primer bote tendrá explosión de fuego
  }

  // ================================================================ ULTI LEGENDARIA: BOLA DE ENERGÍA (17-11-2026)
  // Guion: logic/EnergyRally.ts · dibujo: fx/energyBallCine.ts y fx/energyBallFx.ts. Encima de la ULTI de siempre:
  //   carga de 1,8 s (ENERGY_MATCH_CINE, la de 6 s de ENERGY_CINE acortada: el motor de la cinemática con la pantalla más negra) con la ZONA del que la lanza y un aura
  //   más fuerte → peloteo automático fondo a fondo (pelota del golpe cargado al máximo) con 3 estiradas del rival, que queda
  //   tendido → la BOLA DE ENERGÍA gigante le pega → lo de siempre de la ULTI (aturdido + raqueta fuera; fireImpact /
  //   playerImpact). SOLO VISUAL: el partido queda congelado mientras dura (como en la cinemática) y no cambia puntos ni
  //   estadísticas. El bot no la usa (ai/botKit.ts).
  // Red: 'inferno-cine' lleva power = 'energy', bx/by (el rival según el que la lanza) y seed: el otro teléfono calcula el MISMO
  //   guion (espejado) y lo ve desde su lado; allí la víctima es su jugador (de espaldas). Al terminar, el teléfono de la víctima
  //   aplica el impacto (playerImpact → 'stunned' + devolución floja); el golpe de la ULTI que llegó durante su cinemática se
  //   descarta (ya se vio). En el del que la lanza, el impacto se ve al terminar y el 'stunned' del rival ya no lo repite.

  /** Partido congelado por una cinemática: la de golpe (fx/SmashCinematic.ts) o el peloteo de la ULTI LEGENDARIA. */
  private get cineLock(): boolean {
    return this.cine.active || this.legend !== null;
  }

  /** ULTI LEGENDARIA propia (este teléfono la lanza): guion con semilla y la carga de 6 s. `c` = contacto validado de la ULTI. */
  private startLegend(c: { x: number; y: number }) {
    const pl = this.player;
    this.inferno.begin();
    this.stopCharge();
    // la semilla viaja como número de 'inferno-cine' (el servidor recorta los números a ±1e5)
    const seed = Math.floor(Math.random() * 99991);
    const bot = { x: this.bot.x, y: this.bot.y };
    const from = { x: pl.x, y: pl.y };
    // (17-11-2026, usuario) el que la lanza se ACERCA a la pelota como en las demás ULTIS (desplazamiento al contacto c) y desde ahí
    // pelotea; el rival se queda en su sitio (su fila)
    const power = legendPowerOf(getProfile().inferno);
    const plan = legendPlan(power, { x: c.x, y: c.y }, bot, seed);
    this.legendCharge('player', from, plan, false, power);
    this.net?.sendAction('inferno-cine', { x: from.x, y: from.y, tx: c.x, ty: c.y, ms: ENERGY_MATCH_CINE.hitAtMs, power, bx: bot.x, by: bot.y, seed });
  }

  /** ULTI LEGENDARIA del rival (red): el mismo guion, espejado, visto desde aquí (mi jugador es la víctima, de espaldas). */
  private netRemoteLegend(d: ActionMsg['data']) {
    if (this.cine.active || this.legend || this.duel || this.phase !== 'rally') return;
    const from = this.netBotPos(d?.x, d?.y);
    const tx = Number(d?.tx);
    const ty = Number(d?.ty);
    const bx = Number(d?.bx);
    const by = Number(d?.by);
    const seed = Number(d?.seed);
    if (!from || ![tx, ty, bx, by, seed].every(Number.isFinite)) {
      this.netRemoteInfernoCine(d); // sin los datos del guion: la cinemática de la ULTI de siempre
      return;
    }
    // tx, ty = su contacto de la ULTI (en SUS coordenadas, las canónicas del guion): el mismo plan que calculó él
    const power = legendPowerOf(d?.power);
    const plan = legendPlan(power, { x: tx, y: ty }, { x: bx, y: by }, seed);
    this.netBotSnap(from);
    this.netDeferred = [];
    this.netRemoteCine = true; // su golpe (la ULTI) llega durante la cinemática: se descarta al terminar (ya se vio)
    // mi jugador queda donde lo veía el rival (los dos teléfonos ven el mismo peloteo)
    const pl = this.player;
    const vp = mirrorP({ x: bx, y: by }, { x: 0, y: 0 });
    this.stopCharge();
    stopMotion(this.motion);
    pl.x = vp.x;
    pl.y = vp.y;
    pl.ch.setMoving(false, 0);
    this.renderActors();
    this.legendCharge('bot', from, plan, true, power);
  }

  /** Punto del guion (canónico: el del teléfono que lanza) en ESTE teléfono. */
  private legendLocal<T extends { x: number; y: number }>(run: LegendRun, p: T, out: T): T {
    if (run.mirror) return mirrorP(p, out);
    out.x = p.x;
    out.y = p.y;
    return out;
  }

  /** Carga de 6 s (los dos teléfonos): mirada, ZONA + aura fuerte, la carga propia y el desplazamiento al sitio de peloteo. */
  private legendCharge(att: Who, from: { x: number; y: number }, plan: EnergyRallyPlan, mirror: boolean, power: LegendRun['power'] = 'energy') {
    const A = att === 'player' ? this.player : this.bot;
    const V = att === 'player' ? this.bot : this.player;
    const run: LegendRun = {
      att,
      power,
      plan,
      mirror,
      stage: 'charge',
      t: 0,
      done: new Uint8Array(plan.shots.length),
      finalFired: false,
      zoneWas: false,
      auraWas: false,
      lastAt: performance.now(),
      pb: { x: 0, y: 0, z: 0 },
      pa: { x: 0, y: 0 },
      pv: { x: 0, y: 0 },
      to: { x: 0, y: 0 },
      v0: { x: V.x, y: V.y },
      vTo: { x: 0, y: 0 },
    };
    this.legendLocal(run, plan.att, run.to);
    this.legendLocal(run, plan.vic, run.vTo);
    const to = run.to;
    this.legend = run;
    this.legendTodo = [];
    if (!A.ch.infernoHold()) A.ch.setCharging(true);
    const sprites = spritesIn(A.ch);
    const D = INFERNO.dash;
    const dashSt = { sound: false };
    infernoSound.charge(this);
    // (17-11-2026, usuario) la mirada dura LO MISMO que en las otras ULTIS (antes, casi toda la carga de 6 s)
    showInfernoGaze(this, INFERNO_CINE.hitAtMs - GAZE_END_BEFORE_HIT_MS, this.gazeY(), this.skinOf(att === 'player' ? this.player : this.bot), power);
    this.ghosts.setLook(INFERNO_LOOK[power].ghostTint, INFERNO_LOOK[power].ghostRamp);
    this.legendZoneOn(run);
    this.energyCine.setPalette(power === 'hurricane' ? HURRICANE_COL_CHARGE : undefined); // HURACÁN: la misma carga en oro y viento
    this.energyCine.start();
    this.cine.start({
      profile: power === 'hurricane' ? HURRICANE_MATCH_CINE : ENERGY_MATCH_CINE, // (17-11-2026) 1,8 s (antes 6 s)
      freeze: this.doubles ? this.freezeSprites() : [...sprites, ...spritesIn(V.ch)], // 2v2: los cuatro (como las demás cinemáticas)
      executor: sprites,
      leadMs: 0,
      focus: () => this.cineFocus(A),
      onCancel: () => {
        A.ch.infernoRelease();
        A.ch.setCharging(false);
        this.ghosts.clear();
        this.legendEnd(true);
      },
      onFrame: (e) => {
        this.legendChargeFrame(run, A, e);
        if (e >= ENERGY_MATCH_CINE.hitAtMs - INFERNO_PRE_MS) A.ch.infernoPre();
        // el desplazamiento fantasma de la ULTI al final de la carga: el MISMO acercamiento a la pelota que las demás ULTIS (hasta el contacto).
        // El rival se queda en su sitio (solo se corre lo justo si el guion acotó su posición, pegado a una banda)
        const de = e - ENERGY_RALLY.dashShiftMs;
        if (de >= D.fromMs) {
          const u = Math.min(1, (de - D.fromMs) / (D.toMs - D.fromMs));
          V.x = run.v0.x + (run.vTo.x - run.v0.x) * u;
          V.y = run.v0.y + (run.vTo.y - run.v0.y) * u;
          this.infernoDashStep(de, A, from, to, sprites, dashSt, power);
        }
      },
      onHit: () => this.legendRallyStart(run),
    });
  }

  /** Un fotograma de la carga: la carga propia de la ULTI LEGENDARIA y la ZONA del que la lanza. */
  private legendChargeFrame(run: LegendRun, A: Actor, e: number) {
    const now = performance.now();
    const dt = Math.min(0.05, (now - run.lastAt) / 1000);
    run.lastAt = now;
    const f = this.cineFocus(A);
    const feet = project(A.x, A.y);
    // la línea de tiempo del dibujo es la de 6 s (ENERGY_CINE): se le pasa el tiempo reescalado
    this.energyCine.drawCharge(e / ENERGY_MATCH_K, { x: f.x, y: f.y, racketX: f.racketX, racketY: f.racketY, s: f.s, hh: f.hh, depth: f.depth, feetY: feet.sy });
    this.legendZoneFrame(run, dt);
  }

  /** Enciende la ZONA del que la lanza (su ESTILO DE ZONA: rayo de los ojos + aura) con el aura más fuerte. */
  private legendZoneOn(run: LegendRun) {
    const side: ZoneSide = run.att;
    const fx = this.zoneFx[side];
    run.zoneWas = !!fx?.active;
    if (fx && !fx.active) fx.start();
    const aura = side === 'player' ? this.aura : this.botAura;
    run.auraWas = !!aura?.active;
    if (aura && !aura.active) aura.start(this.zoneLook[side].aura, true); // también la ELÉCTRICA (que no trae aura): la LEGENDARIA sí la enciende
    aura?.setBoost(1.9);
  }

  /** Aura y rayo de los ojos del que la lanza durante la cinemática (el update normal no corre). */
  private legendZoneFrame(run: LegendRun, dt: number) {
    const side: ZoneSide = run.att;
    const a = side === 'player' ? this.player : this.bot;
    const aura = side === 'player' ? this.aura : this.botAura;
    aura?.update(dt);
    const fx = this.zoneFx[side];
    if (!fx?.active) return;
    const p = project(a.x, a.y);
    const look = side === 'player' ? a.ch.facing : -a.ch.facing;
    const k = p.s * VIEW.CHAR_K;
    const eyes = side === 'player' ? zoneEyes(getProfile().skin, 'back') : zoneEyes(this.skinOf(this.bot), 'front');
    fx.update(dt, this.headPos(a), { x: p.sx, y: p.sy }, k, a.ch.depth, look >= 0 ? 1 : -1, side === 'player', eyes, k * 1.1);
  }

  /** Apaga la ZONA de la cinemática (si no estaba ya en ZONA de verdad). */
  private legendZoneOff(run: LegendRun) {
    const side: ZoneSide = run.att;
    const aura = side === 'player' ? this.aura : this.botAura;
    aura?.setBoost(1);
    const inZone = this.zone.active(side);
    if (aura?.active && !run.auraWas && !inZone) aura.stop();
    const fx = this.zoneFx[side];
    if (fx?.active && !run.zoneWas && !inZone) fx.stop();
  }

  /** Fin de la carga: empieza el peloteo automático (el partido sigue congelado: lo mueve tickLegend). */
  private legendRallyStart(run: LegendRun) {
    if (this.legend !== run) return;
    const A = run.att === 'player' ? this.player : this.bot;
    A.x = run.to.x;
    A.y = run.to.y;
    A.ch.setCharging(false);
    this.ghosts.end();
    if (this.phase !== 'rally') {
      this.legendEnd(true);
      return;
    }
    run.stage = 'rally';
    run.t = 0;
    this.energyCine.hideCharge();
    this.energyCine.setDark(ENERGY_CINE.darken);
    // la pelota del peloteo: la del golpe cargado al máximo (brillo y rayos, sin estela)
    this.fire.clear();
    this.infernoFlight = false;
    this.ball.quietFx = false;
    this.ball.setPower(false);
    this.ball.setKind('normal');
    this.ball.setMaxCharge(true);
    this.netCineSeen = true;
  }

  /** Cada fotograma del peloteo (partido congelado). `deltaMs` = tiempo del fotograma (se para con la pausa). */
  private tickLegend(deltaMs: number) {
    const run = this.legend!;
    if (run.stage !== 'rally') return;
    if (this.phase === 'over') {
      this.legendEnd(true);
      return;
    }
    const dtMs = Math.min(deltaMs, 50);
    run.t += dtMs;
    const t = run.t;
    if (run.plan.kind === 'hurricane') {
      this.tickHurricane(run, t, dtMs);
      return;
    }
    const plan = run.plan;
    const R = ENERGY_RALLY;
    const A = run.att === 'player' ? this.player : this.bot;
    const V = run.att === 'player' ? this.bot : this.player;
    // posiciones del guion
    this.legendLocal(run, attackerAt(plan, t, run.pa), run.pa);
    A.x = run.pa.x;
    A.y = run.pa.y;
    this.legendLocal(run, victimAt(plan, t, run.pv), run.pv);
    V.x = run.pv.x;
    V.y = run.pv.y;
    // golpes, estiradas y contactos (cada uno una vez: bits de run.done)
    for (let i = 0; i < plan.shots.length; i++) {
      if (this.legend !== run) return; // el golpe final pudo cerrarla
      const sh = plan.shots[i];
      const d = run.done[i];
      if (sh.by === 'att' && !(d & 1) && t >= sh.t0 - R.swingLeadMs) {
        run.done[i] |= 1;
        if (sh.final) this.legendFinalSwing(run, sh);
        else {
          A.ch.setCharging(false);
          // (21-11-2026, usuario) BOLA DE ENERGÍA: el SEGUNDO golpe del que la lanza es de REVÉS (los demás, de derecha). El lado lo da `facing` (+1 derecha, -1 revés);
          // el golpe lo lee al arrancar, así que se vuelve a la derecha enseguida. Igual para ti y para el rival online (el rival se ve de frente en su clip de revés)
          const back = plan.shots.slice(0, i).filter((q) => q.by === 'att' && !q.final).length === 1;
          if (back) {
            A.ch.facing = -1;
            A.ch.swing(true, false, false, false);
            this.time.delayedCall(300, () => (A.ch.facing = 1));
          } else A.ch.swing(true, false, false, false);
        }
      }
      if (!(d & 2) && t >= sh.t0) {
        run.done[i] |= 2;
        if (sh.final) this.legendFinalLaunch(run, sh);
        else {
          shotBallAt(sh, sh.t0, run.pb);
          this.legendLocal(run, run.pb, run.pb);
          this.legendHitFx(run.pb.x, run.pb.y, run.pb.z);
        }
      }
      // estirada del rival (la última lo deja tendido): lado de la pantalla hacia el que va la pelota
      if (sh.side && !(d & 4) && t >= sh.t1 - R.diveLeadMs) {
        run.done[i] |= 4;
        this.legendLocal(run, sh.to, run.pb);
        const side = run.pb.y > V.y ? 1 : -1;
        V.ch.facing = side;
        if (!V.ch.lunge(side, !!sh.lie)) this.legendLeanFallback(V, side, !!sh.lie);
      }
    }
    if (this.legend !== run) return;
    // la pelota
    const sh = shotAt(plan, t);
    shotBallAt(sh, t, run.pb);
    this.legendLocal(run, run.pb, run.pb);
    const s = this.ball.s;
    const fl = Math.max(1, sh.t1 - sh.t0) / 1000;
    const m = run.mirror ? -1 : 1;
    s.vx = (m * (sh.to.x - sh.from.x)) / fl;
    s.vy = (m * (sh.to.y - sh.from.y)) / fl;
    s.vz = 0;
    s.x = run.pb.x;
    s.y = run.pb.y;
    s.z = run.pb.z;
    this.ball.render(dtMs / 1000);
    this.fire.update(s, run.finalFired, true);
    this.renderActors();
    this.legendZoneFrame(run, dtMs / 1000);
    // (17-11-2026) antes del golpe final la BOLA DE ENERGÍA CRECE en la raqueta (ENERGY_RALLY.growMs; la pelota espera ahí)
    const fin = plan.shots[plan.shots.length - 1];
    const g0 = fin.t0 - R.growMs;
    if (!run.finalFired && t >= g0 && t < fin.t0) {
      // (17-11-2026, usuario) el golpe final usa el swing de la ULTI (hoja ulti-1, inferno-swing), no el golpe potenciado:
      // al empezar a crecer la bola, el atacante vuelve a la pose de espera de la ULTI; su swing (legendFinalSwing) sale de ella
      if (!this.legendGrow) {
        A.ch.setCharging(false);
        A.ch.infernoHold();
      }
      if (t >= fin.t0 - INFERNO_PRE_MS) A.ch.infernoPre();
      this.legendGrow = true;
      // (17-11-2026, usuario) sin esfera en el personaje: partículas hacia él y rayos que le salen (energyBallCine.drawGrow); la bola
      // sale chica y crece durante su vuelo (finalMs) hasta su tamaño máximo
      const af = this.cineFocus(A);
      const afeet = project(A.x, A.y);
      this.energyCine.drawGrow(dtMs / 1000, (t - g0) / R.growMs, { x: af.x, y: af.y, racketX: af.racketX, racketY: af.racketY, s: af.s, hh: af.hh, depth: af.depth, feetY: afeet.sy });
      this.fire.energyGrowSec = R.finalMs / 1000;
    } else if (this.legendGrow) {
      this.legendGrow = false;
      this.energyCine.hideCharge(); // sale volando: la dibuja InfernoFire
    }
    this.energyCine.drawDark(t >= plan.endMs - 250 ? 0.12 : 0.38, dtMs / 1000);
    if (t >= plan.endMs) this.legendFinish(run);
  }

  /**
   * (17-11-2026) Cada fotograma del guion del HURACÁN (logic/EnergyRally.ts planHurricane), partido congelado:
   *   shot 0  golpe cargado al máximo con VIENTO (windShotFx) → el rival sale despedido contra el fondo y queda tendido (knock)
   *   shot 1  el GLOBITO vuelve y se queda alto sobre el que la lanza
   *   lift    el TORNADO lo sube hasta la pelota; arriba sale envuelto en la ESFERA AMARILLA
   *   final   SMASH al rival tendido → legendFinish (el impacto de siempre de la ULTI)
   * Los tres casos del partido: usuario (att = player), rival online (att = bot, espejado) y el bot no la usa (sin legendarias).
   */
  private tickHurricane(run: LegendRun, t: number, dtMs: number) {
    const plan = run.plan;
    const R = ENERGY_RALLY;
    const A = run.att === 'player' ? this.player : this.bot;
    const V = run.att === 'player' ? this.bot : this.player;
    const dt = dtMs / 1000;
    // posiciones: el que la lanza en su sitio (y en el aire con el tornado); el rival, despedido hacia el fondo
    this.legendLocal(run, attackerAt(plan, t, run.pa), run.pa);
    A.x = run.pa.x;
    A.y = run.pa.y;
    A.lift = attackerLiftAt(plan, t);
    this.legendLocal(run, victimAt(plan, t, run.pv), run.pv);
    V.x = run.pv.x;
    V.y = run.pv.y;
    const [s0, s1, fin] = plan.shots;
    const K = plan.knock!;
    const L = plan.lift!;
    // 1) golpe de viento (golpe cargado al máximo)
    if (!(run.done[0] & 1) && t >= s0.t0 - R.swingLeadMs) {
      run.done[0] |= 1;
      A.ch.setCharging(false);
      A.ch.swing(true, false, false, false);
    }
    if (!(run.done[0] & 2) && t >= s0.t0) {
      run.done[0] |= 2;
      // (21-11-2026, usuario) este 1.er golpe tras la carga es MAS POTENTE: efecto al doble de tamano, sonido de inferno.mp3, mas sacudida y destello
      const FH = HURRICANE.firstHit;
      shotBallAt(s0, s0.t0, run.pb);
      this.legendLocal(run, run.pb, run.pb);
      this.legendHitFx(run.pb.x, run.pb.y, run.pb.z, FH.k, FH.sound, FH.volume);
      const a = project(run.pb.x, run.pb.y, run.pb.z);
      this.legendLocal(run, s0.to, run.pv);
      const b = project(run.pv.x, run.pv.y, s0.to.z);
      windShotFx(this, a.sx, a.sy, a.s * FH.k, b.sx - a.sx, b.sy - a.sy);
      this.cameras.main.shake(FH.shakeMs, FH.shake); // (sin flash de cámara completo: tapaba el golpe)
      // (19-11-2026, usuario) la pelota vuela como BOLA DE ENERGÍA del huracán, algo más grande que la del smash (se dibuja abajo, con la pelota)
      this.fire.setElement('hurricane');
      this.fire.hurricaneScale = FH.ball;
      this.fire.hurricaneSpin = -1; // (20-11-2026) gira al revés que en el smash final
      this.legendLocal(run, victimAt(plan, t, run.pv), run.pv); // (pv vuelve a ser la posición del rival)
    }
    // 2) el rival recibe el viento: sale despedido y cae (la estirada que se queda tendida, hacia el centro)
    if (!(run.done[0] & 4) && t >= K.t0) {
      run.done[0] |= 4;
      const hp = project(V.x, V.y, 52);
      windBlast(this, hp.sx, hp.sy, Math.max(0.7, hp.s) * 0.9 * HURRICANE.firstHit.blast, 3800);
      // (19-11-2026, usuario) la bola de energía EXPLOTA en el rival: impacto del huracán (brillo, aros y ráfagas) y sacudida fuerte
      const FH = HURRICANE.firstHit;
      infernoImpactFx(this, hp.sx, hp.sy, Math.max(0.7, hp.s) * FH.impactK, 'hurricane');
      this.cameras.main.shake(FH.impactShakeMs, FH.impactShake);
      this.fire.hurricaneScale = 1.25;
    this.fire.hurricaneSpin = 1; // el smash final vuelve a su tamaño
      this.legendLocal(run, { x: plan.vic.x, y: plan.vic.y + K.side * 10 }, run.pv);
      const side = run.pv.y > V.y ? 1 : -1;
      V.ch.facing = side;
      if (!V.ch.lunge(side, true)) this.legendLeanFallback(V, side, true);
    }
    if (!(run.done[1] & 4) && t >= K.t1) {
      run.done[1] |= 4;
      const fp = project(V.x, V.y);
      wallKnockFx(this, fp.sx, fp.sy, fp.s);
      this.cameras.main.shake(260, 0.016); // (18-11-2026, usuario) sin golpe-fuerte: en el HURACÁN suena solo en el 1.er golpe
    }
    // 3) el globito sale del rival (rebote): sin golpe, solo la pelota
    if (!(run.done[1] & 2) && t >= s1.t0) {
      run.done[1] |= 2;
      this.ball.setMaxCharge(false);
      this.ball.setKind('lob');
    }
    // (18-11-2026, usuario) 3b) tras su golpe corre a detrás de la T (plan.move): carrera mientras dura
    const M = plan.move;
    if (M && !run.hMove && t >= M.t0) {
      run.hMove = 1;
      A.ch.setMoving(true, run.mirror ? -1 : 1, 1); // a toda velocidad
      // (21-11-2026, usuario) corre CON VELOCIDAD a la T: destello y anillos en los pies, estela de haces hacia la T y sombras doradas por el camino
      const p0 = project(A.x, A.y);
      const k0 = p0.s * VIEW.CHAR_K;
      const dest: P2 = { x: 0, y: 0 };
      this.legendLocal(run, M.to, dest);
      const p1 = project(dest.x, dest.y);
      this.hurDash.burst(p0.sx, p0.sy, k0, A.ch.depth, HURRICANE_RUN_TINT);
      this.hurDash.streak(p0.sx, p0.sy - 70 * k0, p1.sx, p1.sy - 70 * k0, k0, A.ch.depth, HURRICANE_RUN_TINT);
      run.hGhostT = t;
      run.hGhosts = 0;
    }
    if (M && run.hMove === 1 && t - (run.hGhostT ?? t) >= HURRICANE_RUN_GHOST_MS) {
      run.hGhostT = t;
      this.hurDash.ghost(A.ch, (run.hGhosts = (run.hGhosts ?? 0) + 1) % 3, A.ch.depth);
    }
    if (M && run.hMove === 1 && t >= M.t1) {
      run.hMove = 2;
      A.ch.setMoving(false, 0);
    }
    // 4) TORNADO (hoja de 8 cuadros, como en la demostración): sale al saltar desde la T, lo cubre completo; desde el cuadro 5 es el CÍRCULO
    // AMARILLO; al terminar el tornado el círculo se desarma y se le ve con la pose del smash (hoverMs) hasta el golpe
    this.tornadoImg ??= new TornadoSprite(this);
    if (!run.hWarm) {
      run.hWarm = true;
      this.tornadoImg.warm(-500, -500, 0); // se sube a la GPU ahora (no al saltar)
    }
    const HU = HURRICANE;
    const af = this.cineFocus(A);
    const feet = project(A.x, A.y);
    const j = t - L.t0;
    const coverAt = HU.tornadoMs * (4 / TORNADO_ART.frames);
    if (j >= 0 && j < HU.tornadoMs) {
      if (!run.hTornado) {
        run.hTornado = true;
        // (18-11-2026, usuario) salta con el clip del SMASH (se congela con los pies atrás hasta el golpe) y SIN el sonido de cargando
        A.ch.setMoving(false, 0);
        A.ch.setCharging(false);
        if (!A.ch.remateJump()) A.ch.setCharging(true);
        this.energyCine.hideCharge();
        this.tornadoSndStart(); // empieza el tornado (el que la lanza: tú, o el rival online en tu pantalla); termina con el golpe final
      }
      const top = project(A.x, A.y, HU.liftZ + 170).sy;
      if (this.tornadoImg.ok) this.tornadoImg.draw((j / HU.tornadoMs) * TORNADO_ART.frames, feet.sx, feet.sy, top, A.ch.depth + 0.6);
      else this.tornado.draw(dt, j / HU.tornadoMs, feet.sx, feet.sy, top, feet.s * VIEW.CHAR_K, A.ch.depth);
      // dentro del tornado ya no se le ve; desde el cuadro 5 es la esfera
      A.ch.setAlpha(j >= coverAt - 120 ? 0 : 1);
    } else if (run.hTornado) {
      this.tornado.hide();
      this.tornadoImg.hide();
    }
    // cineFocus ignora la altura del salto: se sube la esfera lo mismo que se elevó el cuerpo
    const liftPx = feet.sy - project(A.x, A.y, A.lift ?? 0).sy;
    const sx = af.x;
    const sy = af.y - liftPx - (af.hh ?? 60) * 0.3;
    const sr = (af.hh ?? 60) * 1.5;
    const sphereA = j < coverAt || j >= HU.tornadoMs ? 0 : Math.min(1, (j - coverAt) / 80);
    if (j >= HU.tornadoMs && run.hTornado && !run.hBroke) {
      run.hBroke = true;
      sphereBreakFx(this, sx, sy, sr, A.ch.depth);
      A.ch.setAlpha(1);
    }
    // (18-11-2026, usuario) círculo amarillo limpio que envuelve todo el cuerpo (con la raqueta arriba): más grande y algo más arriba
    this.windSphere.draw(dt, sx, sy, sr, A.ch.depth, sphereA, sphereA);
    // 5) SMASH final (el golpe REAL de la ULTI): la pelota espera arriba hasta el contacto
    if (!(run.done[2] & 1) && t >= fin.t0 - R.swingLeadMs) {
      run.done[2] |= 1;
      A.ch.setCharging(false);
      this.ball.setKind('lob'); // el golpe sale como REMATE por arriba (powerOverhead)
      this.legendFinalSwing(run, fin);
      if (this.legend !== run) return;
    }
    if (!(run.done[2] & 2) && t >= fin.t0) {
      run.done[2] |= 2;
      this.legendFinalLaunch(run, fin);
    }
    // la pelota
    const sh = shotAt(plan, t);
    shotBallAt(sh, t, run.pb);
    this.legendLocal(run, run.pb, run.pb);
    const s = this.ball.s;
    const fl = Math.max(1, sh.t1 - sh.t0) / 1000;
    const m = run.mirror ? -1 : 1;
    const waiting = t >= s1.t1 && t < fin.t0; // arriba esperando el smash: quieta (flota un poco)
    s.vx = waiting ? 0 : (m * (sh.to.x - sh.from.x)) / fl;
    s.vy = waiting ? 0 : (m * (sh.to.y - sh.from.y)) / fl;
    s.vz = 0;
    s.x = run.pb.x;
    s.y = run.pb.y;
    s.z = run.pb.z + (waiting ? 3 * Math.sin(t / 90) : 0);
    this.ball.render(dt);
    // la bola de energía se ve en el vuelo del 1.er golpe (hasta que llega al rival) y en el smash final
    this.fire.update(s, run.finalFired || (t >= s0.t0 && t < K.t0), true);
    this.renderActors();
    this.legendZoneFrame(run, dt);
    this.energyCine.drawDark(t >= plan.endMs - 250 ? 0.12 : 0.38, dt);
    if (t >= plan.endMs) this.legendFinish(run);
  }

  /**
   * Estirada del peloteo para un personaje SIN hoja de estiradas (hoy, MAI de frente: sus hojas nuevas están pendientes): el golpe de siempre
   * y el cuerpo que se tira hacia el lado de la pelota (como playerLunge sin hoja). En la última (lie) se queda caído hasta el golpe final.
   */
  private legendLeanFallback(a: Actor, side: number, lie: boolean) {
    a.ch.swing();
    const rig = a.ch.rig;
    this.tweens.killTweensOf(rig);
    if (lie) {
      this.tweens.add({ targets: rig, angle: 72 * side, duration: 160, ease: 'Quad.easeOut' });
      return;
    }
    this.tweens.chain({
      targets: rig,
      tweens: [
        { angle: 42 * side, duration: 140, ease: 'Quad.easeOut' },
        { angle: 42 * side, duration: 120 },
        { angle: -8 * side, duration: 200, ease: 'Sine.easeInOut' },
        { angle: 0, duration: 160, ease: 'Sine.easeOut' },
      ],
    });
  }

  /** Golpe del peloteo (los dos): el del golpe cargado al máximo (destello fuerte, choque eléctrico y sonido). */
  private legendHitFx(x: number, y: number, z: number, k = 1, snd?: string, vol = 1) {
    this.hitFx(x, y, z, false, 1, !!snd); // con `snd` propio, sin el golpe-fuerte de siempre
    const p = project(x, y, z);
    shockFx(this, p.sx, p.sy, p.s * k);
    if (snd) sfx(this, snd, vol);
    else sfx(this, 'electricidad', 0.6);
    this.maxContactFlash(p.sx, p.sy, p.s * k);
  }

  /** Empieza el golpe final (antes del contacto: la raqueta llega a su frame). La pelota espera en la raqueta. */
  private legendFinalSwing(run: LegendRun, sh: RallyShot) {
    shotBallAt(sh, sh.t0, run.pb);
    this.legendLocal(run, run.pb, run.pb);
    const s = this.ball.s;
    s.x = run.pb.x;
    s.y = run.pb.y;
    s.z = run.pb.z;
    this.ball.setMaxCharge(false);
    if (run.att === 'player') {
      // el golpe REAL de la ULTI (consume la carga; golpe y efectos de siempre con la bola de energía); su vuelo lo lleva el guion
      const pl = this.player;
      this.infernoImpact({ x: pl.x, y: pl.y });
      if (this.rallyForcedShot) {
        run.finalFired = true;
        this.legendEnd(true);
        return;
      }
      if (!this.infernoFlight) {
        this.legendEnd(true); // no pudo golpear (el punto cambió): se cancela sin más
        return;
      }
      run.finalFired = true;
      // (21-11-2026, usuario) HURACÁN: tras el golpe se queda en el aire con la pose del golpe (frame 7) hasta caer (legendEnd lo suelta)
      if (run.power === 'hurricane') pl.ch.holdFollowThrough(HURRICANE.finishFrame);
      // (21-11-2026, usuario) BOLA DE ENERGÍA: se queda con el frame 9 del swing de la ULTI (raqueta del último golpe) 1 s y luego siguen sus sprites
      else pl.ch.holdFollowThrough(ENERGY_RALLY.finishFrame, ENERGY_RALLY.finishHoldMs);
    } else {
      // el rival (red): su golpe de la ULTI, como lo ve aquí netApplyHit (su golpe real se descarta al terminar)
      const bt = this.bot;
      bt.ch.setCharging(false);
      // HURACÁN: el smash por arriba (remate con salto), como en su teléfono
      if (run.power === 'hurricane') {
        bt.ch.swing(true, true, true, false);
        bt.ch.holdFollowThrough(HURRICANE.finishFrame);
      } else {
        // (19-11-2026, usuario) el golpe final usa el SWING DE LA ULTI (hoja ulti-1, clip inferno-swing), como en su teléfono: swing() solo lo
        // elige si viene de la pose de espera de la ULTI, así que se asegura aquí (si algo la soltó durante la carga, salía el golpe cargado)
        bt.ch.infernoHold();
        bt.ch.infernoPre();
        bt.ch.swing(true, false, false, false);
        bt.ch.holdFollowThrough(ENERGY_RALLY.finishFrame, ENERGY_RALLY.finishHoldMs); // el rival online: la misma pose 1 s
      }
    }
  }

  /** Sale la BOLA DE ENERGÍA (contacto del golpe final). */
  private legendFinalLaunch(run: LegendRun, sh: RallyShot) {
    this.tornadoSndStop(true); // HURACÁN: el sonido del tornado termina con el golpe final (usuario y rival online)
    if (run.att === 'player') return; // aquí ya lo hizo infernoImpact (efectos del golpe incluidos)
    shotBallAt(sh, sh.t0, run.pb);
    this.legendLocal(run, run.pb, run.pb);
    if (this.rallyRemaining === 0 && this.net?.role === 'host') {
      this.legendEnd(true);
      Object.assign(this.ball.s, { x: run.pb.x, y: run.pb.y, z: run.pb.z });
      this.ball.setPower(false);
      this.ball.setKind('normal');
      this.recordHit('bot', true);
      this.bounces = 0;
      return;
    }
    const el = run.power;
    this.infernoEl = el;
    this.fire.setElement(el);
    this.ball.setPower(true);
    this.ball.quietFx = true;
    const b = project(run.pb.x, run.pb.y, run.pb.z);
    this.hitFx(run.pb.x, run.pb.y, run.pb.z, true, 0.15, true, el);
    infernoImpactFx(this, b.sx, b.sy, b.s, el);
    infernoShake(this);
    infernoSound.impact(this, el);
    run.finalFired = true;
  }

  /** Llegó la BOLA DE ENERGÍA al rival tendido: el impacto de siempre de la ULTI y el partido sigue. */
  private legendFinish(run: LegendRun) {
    const s = this.ball.s;
    this.legendLocal(run, run.plan.hit, run.pb);
    s.x = run.pb.x;
    s.y = run.pb.y;
    s.z = run.plan.hit.z;
    // (17-11-2026) llegada DESTRUCTIVA (EnergyImpactFx: estrella, columna, ondas y grietas en el suelo, esquirlas, brasas y trozos de
    // cancha) + destello y sacudida fuertes, además del impacto de siempre de la ULTI. Sin hit-stop: el partido/red siguen su reloj
    const hp = project(run.pb.x, run.pb.y, run.plan.hit.z);
    if (run.power === 'hurricane') {
      // HURACÁN: el rival tendido recibe el smash: golpe contra el suelo con viento y destello amarillo (más el impacto de la ULTI de siempre)
      const fp = project(run.pb.x, run.pb.y);
      wallKnockFx(this, fp.sx, fp.sy, fp.s * 1.3);
      this.cameras.main.flash(110, 255, 246, 200);
    } else {
      this.energyImpact.play(hp.sx, hp.sy, project(run.pb.x, run.pb.y).sy, hp.s);
      this.cameras.main.flash(220, 240, 253, 255);
    }
    this.cameras.main.shake(420, 0.024);
    this.legendEnd(false);
    if (run.att === 'player') {
      if (!this.net) {
        this.fireImpact(); // aturdido + raqueta fuera + devolución floja (lo de siempre de la ULTI)
        return;
      }
      // red: el impacto lo aplica el teléfono del rival (al terminar su cinemática); aquí se ve ya
      this.netBotStunned(stunMsFor('inferno'), 'inferno');
      this.legendStunShownAt = performance.now();
      this.ball.setPower(false);
      s.vx = 0;
      s.vy = 0;
      s.vz = 0;
      const todo = this.legendTodo;
      this.legendTodo = [];
      for (const f of todo) f();
      return;
    }
    // soy la víctima: el golpe de la ULTI que llegó durante la cinemática ya se vio (se descarta) y recibo el impacto
    this.netEndRemoteCine(true);
    this.legendDropHitUntil = performance.now() + 2500;
    this.lastHitter = 'bot';
    this.infernoFlight = true;
    this.infernoEl = run.power;
    this.ball.setPower(true);
    this.playerImpact();
  }

  /** Cierra la cinemática LEGENDARIA. `cancel` = cortada (punto repetido, fin de partido…): sin impacto. */
  private legendEnd(cancel: boolean) {
    const run = this.legend;
    if (!run) return;
    this.legend = null;
    this.legendGrow = false;
    this.tornadoSndStop(false); // por si se cortó antes del golpe final (punto repetido, fin de partido…)
    this.energyCine.hideCharge();
    this.legendFade = true; // la penumbra se va sola (update)
    this.legendZoneOff(run);
    this.netCineSeen = true;
    // HURACÁN: fuera el tornado y la esfera; el que la lanza vuelve al suelo
    this.tornado.hide();
    this.tornadoImg?.hide();
    this.fire.hurricaneScale = 1.25;
    this.fire.hurricaneSpin = 1; // (19-11-2026) por si se cortó en el vuelo del 1.er golpe (bola más grande)
    this.windSphere.hide();
    this.energyCine.setPalette();
    {
      const A = run.att === 'player' ? this.player : this.bot;
      A.ch.setAlpha(1); // (18-11-2026) por si se cortó dentro del tornado / convertido en la esfera
      // (21-11-2026) HURACÁN: cayó al suelo (o se cortó): suelta la pose del golpe y sigue con sus sprites. BOLA DE ENERGÍA: su pose dura 1 s
      // (la suelta sola) y solo se corta aquí si la cinemática se cancela
      if (run.power === 'hurricane' || cancel) A.ch.releaseFollowThrough();
      if (run.hMove === 1) A.ch.setMoving(false, 0);
      if (A.lift) {
        this.tweens.killTweensOf(A);
        this.tweens.add({ targets: A, lift: 0, duration: 200, ease: 'Quad.easeIn' });
      }
    }
    {
      // sin hoja de estiradas (legendLeanFallback) quedó caído de lado: se endereza
      const rig = (run.att === 'player' ? this.bot : this.player).ch.rig;
      if (Math.abs(rig.angle) > 40) {
        this.tweens.killTweensOf(rig);
        this.tweens.add({ targets: rig, angle: 0, duration: 260, ease: 'Back.easeOut' });
      }
    }
    if (!cancel) return;
    this.energyCine.hide();
    this.legendFade = false;
    const V = run.att === 'player' ? this.bot : this.player;
    if (run.stage === 'rally') {
      V.ch.resetPose(); // por si quedó tendido
      this.ball.setMaxCharge(false);
      if (!run.finalFired) {
        this.fire.clear();
        this.ball.quietFx = false;
      }
    }
    if (run.att === 'player' && !run.finalFired) this.inferno.abort();
    if (run.att === 'bot') this.netEndRemoteCine(true);
    const todo = this.legendTodo;
    this.legendTodo = [];
    for (const f of todo) f();
  }

  /** Corta la cinemática LEGENDARIA si hay una (punto repetido, duelo, fin). */
  private legendCancel() {
    const run = this.legend;
    if (!run) return;
    if (run.stage === 'charge' && this.cine.active) this.cine.cancel(); // su onCancel la cierra
    else this.legendEnd(true);
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
    this.elementFx.setElement(el);
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
    if (!smashCineEnabled() || this.cineLock || this.phase !== 'rally') return false;
    const pl = this.player;
    // misma llamada que hará playerHit con el SMASH: arranca el clip en su preparación y se congela ahí;
    // al reanudar, la segunda llamada no reinicia el clip (ya está golpeando) → sin saltos visuales
    this.stopCharge(); // antes de la pose (al soltar la carga el personaje no debe cambiar de animación)
    // ESPECIAL: siempre el golpe FUERTE de derecha / revés (sin el sprite de remate con salto; decisión del usuario)
    const overhead = false;
    // congelado en la pose de carga (frame 4 de las filas 3-4 de la hoja 2) también si venía corriendo
    const lead = pl.ch.swing(true, overhead, overhead, false, true);
    this.cine.start({
      profile: smashCine(this.smashEl), // fuego = el de siempre; hielo / viento / rayo = mismos tiempos con su aura, rayos y destello
      freeze: this.doubles ? this.freezeSprites() : [...spritesIn(pl.ch), ...spritesIn(this.bot.ch)],
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
  /** `resist` (18-11-2026): el rival en ZONA resiste el ESPECIAL: "¡RESISTE!" y aturdido solo RESIST_STUN_MS. */
  private fireImpact(resist = false) {
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
    // (19-11-2026, usuario) el IMPACTO del golpe recibido se ve NÍTIDO sobre la niebla del aturdido (antes quedaba difuminado):
    // todo lo que se cree en los próximos 0,9 s (explosión, chispas, destellos con retraso) va a la cámara nítida
    this.stunFog.keepNew(new Set(this.children.list), 900);
    powerImpactFx(this, kind, at.sx, at.sy, feet.s, kind === 'inferno' ? this.infernoEl : this.smashFlightEl, kind === 'inferno' ? feet.sy : undefined); // ULTI: el suelo real bajo sus pies (la huella del impacto)
    // (19-11-2026, usuario) la bola de la ULTI se acaba en el impacto (como en fireImpact): si no, la devolución floja salía hacia el otro
    // teléfono marcada como ULTI (`inferno` en el golpe) y quien devolvía ese globo quedaba TAMBIÉN aturdido y sin raqueta
    this.infernoFlight = false;
    this.ball.quietFx = false;
    this.fire.clear();
    b.ch.swing();
    // devolución débil: GLOBO de verdad al centro (genera el círculo del SMASH para quien lanzó el poder)
    const tx = NET_X - (NET_X - COURT.left) * rand(0.45, 0.7);
    const ty = LAT_C + rand(-0.5, 0.5) * HALF_W;
    s.z = Math.max(s.z, 22);
    this.smashableLob(s, tx, ty);
    this.ball.setPower(false);
    this.ball.setKind('lob');
    this.lastHitter = 'bot';
    this.bounces = 0;
    this.ai.onBotHit();

    // retroceso rápido que frena progresivamente (sin salir de su zona) + aturdimiento
    const stunMs = resist ? RESIST_STUN_MS : stunMsFor(kind); // SMASH 0,65 s · ULTI 1,5 s · resiste en ZONA 1 s
    b.stun = resist ? RESIST_STUN_MS / 1000 : stunSeconds(kind);
    if (kind === 'smash' && !(this.lesson === 4 && this.lessonStep === 0)) this.tutMission('t04Stun'); // (24-11-2026) nivel 4 (la demostración no cuenta)
    const kb = POWER_IMPACT.knockback;
    this.tweens.killTweensOf(b);
    this.tweens.add({ targets: b, x: knockbackX(b.x, B_X[1], KNOCKBACK_DIST), duration: kb.ms, ease: 'Cubic.easeOut' });
    // con hoja (NXO de espaldas): aturdido / impacto del INFERNO dibujados; si no, el giro de siempre
    if (!b.ch.impactStun(kind === 'inferno' ? 'inferno' : 'smash', stunMs, kind !== 'inferno')) {
      this.tweens.add({ targets: b.ch.rig, angle: { from: -POWER_IMPACT.recoilDeg * b.ch.facing, to: 0 }, duration: stunMs, ease: 'Elastic.easeOut' });
    }
    const h = this.headPos(b);
    this.popText(h.x, h.y - 10, resist ? '¡RESISTE!' : '¡ATURDIDO!', resist ? '#9ff0ff' : '#ffd23f', 30);
    // 2v2 online (host): el compañero ve el aturdido del bot y su devolución floja llega como golpe del bot (sin animación de golpe)
    const tag = this.net2host ? this.net2Tag(b) : null;
    if (tag?.a) {
      this.net?.sendAction('stunned', { ...tag, ms: stunMs, kind, ...(resist ? { resist: true } : {}) });
      this.netHit = { charged: false, overhead: false, volley: false, impact: true };
      this.netHitPending = true;
      this.netHitA = tag.a;
    }
    if (kind === 'inferno') {
      this.ultiStunOn(b, stunMs);
      this.loseRacket(b); // la ULTI le hace volar la raqueta
    }
  }

  /**
   * ¡A LAS ESTRELLAS! (13-11-2026): un personaje SIN RAQUETA (ULTI recibida) al que le llega un ESPECIAL sale volando
   * fuera de la cancha hacia el cielo: sube girando y achicándose (se aleja) hasta convertirse en un destello. Es PUNTO
   * seguro para el que lanzó el ESPECIAL. `remote` = el rival online lo avisó ('sky-launch'): aquí solo se ve (el punto
   * llega por la red).
   */
  private skyLaunch(a: Actor, remote = false) {
    if (a.launched || this.phase !== 'rally') return;
    const isPlayer = a === this.player;
    a.launched = true;
    a.stun = 99;
    if (isPlayer) stopMotion(this.motion);
    this.tweens.killTweensOf(a);
    const skyTag = this.net2Tag(a); // mi jugador, o (2v2 online, host) un bot: el otro teléfono lo ve salir volando
    if (this.net && skyTag) this.net.sendAction('sky-launch', skyTag);
    // explosión del ESPECIAL en el cuerpo y golpe de cámara
    const feet = project(a.x, a.y);
    const head = this.headPos(a);
    const mid = (feet.sy + head.y) / 2;
    // las estrellas del aturdido no se quedan donde estaba: ya salió volando (y sin niebla de aturdido si es el jugador)
    this.dizzy.setVisible(false);
    this.dizzyP.setVisible(false);
    this.playerDizzy = false;
    if (isPlayer) this.stunFog.clear();
    // MÁS IMPACTO al llegarle la pelota: dos explosiones (la segunda, más grande), onda eléctrica, destello blanco de pantalla y
    // una sacudida mucho más fuerte
    powerImpactFx(this, 'smash', feet.sx, mid, feet.s * 1.25, this.smashFlightEl);
    this.time.delayedCall(80, () => powerImpactFx(this, 'smash', feet.sx, mid, feet.s * 1.9, this.smashFlightEl));
    shockFx(this, feet.sx, mid, feet.s * 1.5);
    sfx(this, 'electricidad', 0.9);
    const flash = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0xffffff, 0.8).setOrigin(0).setScrollFactor(0).setDepth(6000).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: flash, alpha: 0, duration: 420, ease: 'Cubic.easeOut', onComplete: () => flash.destroy() });
    this.cameras.main.shake(480, 0.045);
    if (isPlayer) navigator.vibrate?.([100, 40, 220, 40, 120]);
    this.fire.clear();
    this.ball.setPower(false);
    this.skyBallHidden = true; // la pelota "se va" con él (se oculta hasta el punto siguiente)
    // vuelo: sube hacia el cielo y hacia un costado, girando y achicándose (renderActors no lo toca mientras vuela)
    // sprite del pelotazo recibido (ULTI completa, fila 2, frames 3→5) congelado mientras vuela; sin esa hoja, el aturdido
    if (!a.ch.launchPose()) a.ch.impactStun('smash', 1500, false);
    // el que hizo el punto celebra (pose de victoria) y el marcador de arriba se oculta durante el vuelo
    (isPlayer || a === this.ally ? this.bot : this.player).ch.victory(); // celebra el equipo contrario al que salió volando
    this.hud.setVisible(false);
    const ch = a.ch;
    const cam = this.cameras.main;
    const side = feet.sx < cam.worldView.centerX ? -1 : 1;
    const tx = Phaser.Math.Clamp(feet.sx + side * cam.worldView.width * 0.28, cam.worldView.x + 60, cam.worldView.right - 60);
    const ty = cam.worldView.y + 70;
    const s0 = ch.scaleX;
    const s0y = ch.scaleY;
    const FLY = 1900; // ms de vuelo (tras el golpe)
    const SPIN = 1080; // grados por segundo: gira a VELOCIDAD CONSTANTE y no para hasta desaparecer
    const HIT_MS = 130; // el golpe lo congela un instante (impacto) antes de salir disparado
    ch.setDepth(5200);
    ch.shadow.setVisible(false); // la sombra del suelo no vuela con él (se restaura en el punto siguiente)
    this.skyImpactFx(feet.sx, mid, feet.s * VIEW.CHAR_K);
    // golpe: el cuerpo se comprime un instante en el impacto
    this.tweens.add({ targets: ch, scaleX: s0 * 1.16, scaleY: s0y * 0.84, duration: HIT_MS / 2, yoyo: true, ease: 'Quad.easeOut' });
    // vuelo: el CENTRO del cuerpo recorre la trayectoria (sube y se aleja hacia un costado) y el personaje gira sobre su centro,
    // no sobre los pies. Una sola animación lineal en el tiempo: el giro no frena ni se acelera; solo la trayectoria y el tamaño se suavizan.
    const midOff = mid - feet.sy; // del suelo al centro del cuerpo (negativo: está arriba), en px de pantalla
    const c0 = { x: feet.sx, y: mid };
    const fly = ch as unknown as { skyU: number };
    fly.skyU = 0;
    let glowAt = 0;
    if (isPlayer) {
      // (21-11-2026, usuario) a TI te lanza HACIA LA PANTALLA: sales disparado girando hacia la cámara, te haces GIGANTE y pasas de largo
      // (no choca contra la pantalla: la atraviesa y desaparece). Al rival se le sigue viendo irse al cielo.
      const FLY_ME = 1150;
      const tgx = cam.worldView.centerX + side * cam.worldView.width * 0.05;
      const tgy = cam.worldView.centerY - cam.worldView.height * 0.08;
      ch.setDepth(6500); // por encima del marcador y los botones: viene "hacia ti"
      this.tweens.add({
        targets: ch,
        skyU: 1,
        delay: HIT_MS,
        duration: FLY_ME,
        ease: 'Linear',
        onUpdate: () => {
          const u = fly.skyU;
          const e = u * u * (3 - 2 * u); // hacia el centro de la pantalla
          const px = c0.x + (tgx - c0.x) * e;
          const py = c0.y + (tgy - c0.y) * e;
          const k = 1 + 13 * Math.pow(u, 2.6); // se acerca: crece cada vez más rápido (perspectiva)
          const ang = side * 900 * ((u * FLY_ME) / 1000);
          const rad = (ang * Math.PI) / 180;
          const m = midOff * k;
          ch.setScale(s0 * k, s0y * k).setAngle(ang).setPosition(px + m * Math.sin(rad), py - m * Math.cos(rad));
          // al final ya "pasó" la pantalla: se desvanece mientras sigue creciendo
          ch.setAlpha(u < 0.78 ? 1 : Math.max(0, 1 - (u - 0.78) / 0.22));
          if (u < 0.85 && this.time.now - glowAt > 45) {
            glowAt = this.time.now;
            const gl = this.add.circle(px, py, 24 * Math.min(k, 6), Phaser.Utils.Array.GetRandom([0xfff1b8, 0xffffff, 0xffd23f]), 0.35).setDepth(6490).setBlendMode(Phaser.BlendModes.ADD);
            this.tweens.add({ targets: gl, scale: 1.8, alpha: 0, duration: 300, ease: 'Quad.easeOut', onComplete: () => gl.destroy() });
          }
        },
        onComplete: () => {
          ch.setAlpha(0);
          // pasó de largo: ráfaga de aire y un destello suave de toda la pantalla
          const W2 = this.scale.width;
          const H2 = this.scale.height;
          const wash = this.add.rectangle(0, 0, W2, H2, 0xffffff, 0.55).setOrigin(0).setScrollFactor(0).setDepth(6600).setBlendMode(Phaser.BlendModes.ADD);
          this.tweens.add({ targets: wash, alpha: 0, duration: 380, ease: 'Cubic.easeOut', onComplete: () => wash.destroy() });
          this.cameras.main.shake(260, 0.02);
        },
      });
      if (!remote) this.pointTo('bot', '¡BUEN PUNTO!', '#ffd23f');
      return;
    }
    this.tweens.add({
      targets: ch,
      skyU: 1,
      delay: HIT_MS,
      duration: FLY,
      ease: 'Linear',
      onUpdate: () => {
        const u = fly.skyU;
        const px = c0.x + (tx - c0.x) * Math.sin((u * Math.PI) / 2); // sube y se va hacia un lado, frenando al alejarse
        const py = c0.y + (ty - c0.y) * (1 - Math.pow(1 - u, 3));
        const k = 1 - 0.96 * u * u; // se achica: se aleja hacia el cielo
        const ang = side * SPIN * ((u * FLY) / 1000);
        const rad = (ang * Math.PI) / 180;
        const m = midOff * k; // centro del cuerpo respecto a los pies, ya achicado
        ch.setScale(s0 * k, s0y * k).setAngle(ang).setPosition(px + m * Math.sin(rad), py - m * Math.cos(rad));
        // estela de brillo detrás de él (más pequeña cuanto más lejos)
        if (u < 0.93 && this.time.now - glowAt > 45) {
          glowAt = this.time.now;
          const gl = this.add.circle(px, py, Math.max(4, 30 * k), Phaser.Utils.Array.GetRandom([0xfff1b8, 0xffffff, 0xffd23f]), 0.55).setDepth(5190).setBlendMode(Phaser.BlendModes.ADD);
          this.tweens.add({ targets: gl, scale: 0.2, alpha: 0, duration: 340, ease: 'Quad.easeOut', onComplete: () => gl.destroy() });
        }
      },
    });
    this.tweens.add({
      targets: ch,
      alpha: 0,
      delay: HIT_MS + FLY - 160,
      duration: 160,
      onComplete: () => {
        // se convierte en un DESTELLO en el cielo: estrella blanca que crece, gira y se apaga, con un "ting"
        const star = this.add.star(tx, ty, 4, 4, 26, 0xffffff).setDepth(5300).setBlendMode(Phaser.BlendModes.ADD).setScale(0.2);
        const glow = this.add.circle(tx, ty, 18, 0xfff1b8, 0.6).setDepth(5299).setBlendMode(Phaser.BlendModes.ADD).setScale(0.3);
        this.tweens.add({ targets: star, scale: 1.4, angle: 90, duration: 260, yoyo: true, hold: 120, ease: 'Back.easeOut', onComplete: () => star.destroy() });
        this.tweens.add({ targets: glow, scale: 2.2, alpha: 0, duration: 640, ease: 'Cubic.easeOut', onComplete: () => glow.destroy() });
        skyTwinkleSound(this);
      },
    });
    // (14-11-2026) sin texto sobre el personaje al golpearlo: solo el vuelo y el destello
    // PUNTO seguro para el que lanzó el ESPECIAL (en red lo decide el teléfono del que sale volando)
    // (23-11-2026) el punto es del equipo contrario al que salió volando (el aliado es de tu equipo: punto rival)
    if (!remote) this.pointTo(isPlayer || a === this.ally ? 'bot' : 'player', '¡BUEN PUNTO!', '#ffd23f');
  }

  /**
   * ¡A LAS ESTRELLAS! (golpe): estrella blanca grande, anillo y rayas de velocidad que salen disparadas del cuerpo en el instante
   * del impacto. `k` = escala del personaje en pantalla. Igual para el usuario, el bot y el rival online (cuelga de skyLaunch).
   */
  private skyImpactFx(x: number, y: number, k: number) {
    const ADD = Phaser.BlendModes.ADD;
    const star = this.add.star(x, y, 8, 10 * k, 90 * k, 0xffffff, 0.95).setDepth(5250).setBlendMode(ADD).setScale(0.3);
    this.tweens.add({ targets: star, scale: 1.5, angle: 45, alpha: 0, duration: 340, ease: 'Cubic.easeOut', onComplete: () => star.destroy() });
    const ring = this.add.circle(x, y, 20 * k, 0xffffff, 0).setStrokeStyle(8 * k, 0xfff1b8, 1).setDepth(5250).setBlendMode(ADD);
    this.tweens.add({ targets: ring, scale: 7, alpha: 0, duration: 420, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    const g = this.add.graphics({ x, y }).setDepth(5251).setBlendMode(ADD);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + rand(-0.15, 0.15);
      const r0 = rand(30, 50) * k;
      const r1 = rand(110, 190) * k;
      g.lineStyle(rand(3, 6) * k, i % 2 ? 0xffffff : 0xffd23f, 0.95).lineBetween(Math.cos(a) * r0, Math.sin(a) * r0, Math.cos(a) * r1, Math.sin(a) * r1);
    }
    this.tweens.add({ targets: g, scale: 1.7, alpha: 0, duration: 300, ease: 'Cubic.easeOut', onComplete: () => g.destroy() });
  }

  /** ULTI de RAYO / VIENTO: el aturdido lleva encima su efecto (electrocutado / remolino) mientras dura. */
  private ultiStunOn(a: Actor, ms: number) {
    this.ultiHit(a); // el golpe de la ULTI llegó: la del otro lado se habilita cuando `a` recupere la raqueta
    ultiStunFx(this, this.infernoEl, () => {
      if (a.vanished || a.launched) return null; // ya salió volando: su efecto de aturdido se va con él
      const f = project(a.x, a.y);
      return { x: f.sx, y: f.sy, headY: this.headPos(a).y };
    }, ms);
  }

  /**
   * IMPACTO DIRECTO al jugador: alcanzas la bola de fuego del SMASH rival. Igual que fireImpact pero al
   * revés: devolución floja (globo al centro de su campo), retroceso y aturdido. Sin puntuación especial.
   */
  /** `resist` (18-11-2026): en ZONA resistes el ESPECIAL: "¡RESISTE!" y aturdido solo RESIST_STUN_MS. */
  private playerImpact(resist = false, defensive = false) {
    const s = this.ball.s;
    const pl = this.player;
    // ULTI del rival (esfera de fuego): su impacto propio, en el punto de contacto; si no, el del SMASH de siempre
    const kind: PowerKind = this.infernoFlight ? 'inferno' : 'smash';
    const stunMs = (resist ? RESIST_STUN_MS : stunMsFor(kind)) * (this.passiveResistOn ? RESIST_PASSIVE.stunK : 1); // (26-11-2026) RESISTENCIA: x0,75. // SMASH 0,65 s · ULTI 1,5 s · resiste en ZONA 1 s
    // el rival ve el aturdido (misma duración) y la devolución floja llega sin animación de golpe
    if (this.net) {
      this.net.sendAction('stunned', { ms: stunMs, kind, ...(resist ? { resist: true } : {}) }); // `resist`: lo resistió en ZONA. `kind` (smash | inferno): el rival no lo adivina, así usa los sprites de la ULTI aunque su bola ya se apagara
      this.netHit = { charged: false, overhead: false, volley: false, impact: true };
    }
    this.stopCharge();
    this.timing.clear();
    this.infernoBounced = true; // el impacto directo ya es su efecto: no habrá explosión de suelo
    const feet = project(pl.x, pl.y);
    const head = this.headPos(pl);
    const at = kind === 'inferno' ? project(s.x, s.y, s.z) : { sx: feet.sx, sy: (feet.sy + head.y) / 2 };
    powerImpactFx(this, kind, at.sx, at.sy, feet.s, kind === 'inferno' ? this.infernoEl : this.smashFlightEl, kind === 'inferno' ? feet.sy : undefined); // ULTI: el suelo real bajo sus pies (la huella del impacto)
    // devolución débil: GLOBO de verdad al centro del campo rival (genera su círculo del SMASH)
    const tx = NET_X + (COURT.right - NET_X) * rand(0.45, 0.7);
    const ty = LAT_C + rand(-0.5, 0.5) * HALF_W;
    s.z = Math.max(s.z, 22);
    this.smashableLob(s, tx, ty);
    this.ball.setPower(false);
    this.ball.setKind('lob');
    this.recordHit('player', defensive || !!this.dashHit || !!this.dashRun);
    this.bounces = 0;
    this.ai.onPlayerHit(false);

    // retroceso hacia su fondo + aturdido (bloquea el movimiento con pl.stun)
    pl.stun = stunMs / 1000; // (26-11-2026) el mismo de arriba (con la pasiva RESISTENCIA, más corto)
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
    this.stunFog.start(stunMs); // pierde visión mientras dura el aturdido (todo difuso menos su personaje)
    if (kind === 'inferno') {
      this.ultiStunOn(pl, stunMs);
      this.loseRacket(pl); // la ULTI te hace volar la raqueta: hay que ir a buscarla
    }
    // (14-11-2026) se ve NÍTIDO sobre la niebla del aturdido (la niebla difumina todo lo demás), más grande
    const stunTxt = this.popText(head.x, head.y - 10, resist ? '¡RESISTE!' : '¡ATURDIDO!', resist ? '#9ff0ff' : '#ff9aa3', 38);
    this.stunFog.keepSharp(stunTxt);
    // se queda más que un texto normal (1,5 s) para que se lea
    this.tweens.killTweensOf(stunTxt);
    this.tweens.add({ targets: stunTxt, scale: 1, y: head.y - 60, duration: 350, ease: 'Back.easeOut' });
    this.tweens.add({ targets: stunTxt, alpha: 0, delay: 1500, duration: 300, onComplete: () => stunTxt.destroy() });
  }

  /**
   * EMPUJÓN LEVE (MAX_PUSH) al que devuelve un golpe cargado al máximo: retrocede un poco hacia su fondo y se queda un instante
   * sin moverse, con polvo y un golpecito de cámara. Sin estrellas ni cambio de animación (sigue su golpe). Lo aplica el
   * teléfono de quien lo recibe: si es el usuario, avisa al rival ('bump') y su posición llega con el estado; el bot local
   * lo aplica aquí mismo; el rival online solo lo muestra (netRemoteBump).
   */
  private maxPush(a: Actor) {
    if (a.vanished || a.racket || this.phase !== 'rally') return;
    const isPlayer = a === this.player;
    a.stun = Math.max(a.stun, MAX_PUSH.stunS);
    a.softUntil = this.time.now + MAX_PUSH.stunS * 1000;
    if (isPlayer) stopMotion(this.motion);
    const to = isPlayer ? clamp(a.x - MAX_PUSH.dist, P_X[0], P_X[1]) : knockbackX(a.x, B_X[1], MAX_PUSH.dist);
    this.tweens.add({ targets: a, x: to, duration: MAX_PUSH.ms, ease: 'Cubic.easeOut' });
    this.dustFx(a.x, a.y);
    this.cameras.main.shake(MAX_PUSH.shake.ms, MAX_PUSH.shake.intensity);
    if (isPlayer) {
      navigator.vibrate?.(30);
      this.net?.sendAction('bump', { ms: Math.round(MAX_PUSH.stunS * 1000) });
    }
  }

  /** El rival (online) recibió mi golpe cargado al máximo y retrocede un poco: aquí solo se ve su polvo y la sacudida (la posición llega con su estado). */
  private netRemoteBump() {
    if (this.phase !== 'rally') return;
    this.dustFx(this.bot.x, this.bot.y);
    this.cameras.main.shake(MAX_PUSH.shake.ms, MAX_PUSH.shake.intensity);
  }

  // ================================================================ DUELO RED ("subir a la red")
  // Reglas y números: src/logic/NetDuel.ts (NET_DUEL). Efectos: src/fx/NetDuelFx.ts. Docs: docs/MULTIJUGADOR.md.
  //   1) INICIO (cinemática sin efectos: partido congelado, las dos miradas, "DUELO RED", la cámara se acerca a la red y se bloquean
  //      DEFENSIVO y ESPECIAL) → 2) 3 RONDAS (peloteo automático de 2-3 golpes + el aro que se cierra; cada uno toca el botón de golpe,
  //      medido en ms) → 3) gana el que gane más rondas (empate: el que recibía) → 4) GLOBO DISPARADO a la esquina, con un tiempo de
  //      vuelo ajustado al rival. Dura < NET_DUEL.maxMs (8 s) y SIEMPRE termina en ese globo; luego el punto sigue normal.
  // Online: decide el teléfono que RECIBE la pelota (juez). 'duel-start' (con el plan de golpes), 'duel-tap' (error en ms de cada toque,
  // medido contra el aro de SU teléfono), 'duel-round' (resultado de cada ronda), 'duel-result' (ganador) y 'duel-aim' (lado del globo);
  // el globo lo manda el ganador como game:hit (shock + lob) y el otro teléfono lo ve como cualquier golpe.

  /** ¿Empieza un duelo en este fotograma? Con la pelota yendo hacia uno de los dos y el que la recibe en la red. */
  private duelCheck() {
    if (this.doubles) return; // el DUELO RED es del 1v1
    if (this.tutorial && getPlayer().level < TUTORIAL_DUEL_LEVEL) return; // (25-11-2026, usuario) tutorial: el DUELO RED se enseña en el nivel 11; antes no sale
    if (this.duel || this.duelUsed || this.phase !== 'rally' || this.paused || devFlagOn('dev.netDuelOff')) return;
    const s = this.ball.s;
    let receiver: Who | null = null;
    if (this.lastHitter === 'bot' && s.x < NET_X && s.vx < 0) receiver = 'player';
    else if (this.lastHitter === 'player' && s.x > NET_X && s.vx > 0) receiver = 'bot';
    if (!receiver) return;
    // en red lo decide el teléfono que recibe la pelota: si la recibe el rival, aquí llegará 'duel-start'
    if (this.net && receiver === 'bot') return;
    const pl = this.player;
    const bt = this.bot;
    const rx = receiver === 'player' ? pl : bt;
    const busy =
      this.cine.busy ||
      this.legend !== null ||
      this.remateCine !== null ||
      this.botRemate !== null ||
      this.netRemateOn ||
      this.netRemoteCine ||
      this.dashRun !== null ||
      this.dashHit !== null ||
      this.lungeAt > 0 ||
      this.infernoPending ||
      this.inferno.armed ||
      this.inferno.executing ||
      this.smashArmed ||
      (!!this.net && this.netRivalArmed) ||
      this.shadowRun !== null ||
      this.remateRecover > 0 ||
      this.entering ||
      this.netBotDash !== null ||
      performance.now() < this.netBotLockUntil;
    if (
      !shouldStartDuel({
        rally: true,
        serveLock: this.serveLock,
        used: this.duelUsed,
        busy,
        incapacitated: !!pl.racket || !!bt.racket || pl.stun > 0 || bt.stun > 0 || pl.vanished || bt.vanished,
        powerOrLob: this.ball.power || this.infernoFlight || this.ball.shotKind === 'lob',
        playerNetDist: NET_X - pl.x,
        botNetDist: bt.x - NET_X,
        halfLen: NET_X - COURT.left,
        receiver,
        ballDist: s.z < HIT_MAX_Z * 1.2 ? this.reachDist(rx, s) : 1e9,
        hitRange: HIT_RANGE,
        shots: this.shotsThisPoint,
      })
    )
      return;
    this.duelStart(receiver);
  }

  /** Punto medio (en pantalla) entre los dos personajes: hacia ahí se acerca la cámara. */
  private duelMid() {
    const a = project(this.player.x, this.player.y);
    const b = project(this.bot.x, this.bot.y);
    return { sx: (a.sx + b.sx) / 2, sy: (a.sy + b.sy) / 2 };
  }

  /** Empieza el duelo. `remote` = lo que llegó en 'duel-start' (red: este teléfono no es el juez): posición del rival y plan de golpes. */
  private duelStart(receiver: Who, remote?: { pos: { x: number; y: number }; plan: number[] }) {
    if (this.duel || this.cineLock) return;
    this.duelUsed = true;
    const pl = this.player;
    const bt = this.bot;
    this.stopCharge();
    this.timing.clear(); // el toque del duelo no cuenta como golpe con Perfect Timing
    stopMotion(this.motion);
    pl.ch.setMoving(false, 0);
    bt.ch.setMoving(false, 0);
    bt.ch.setCharging(false);
    this.rivalChargeT = 0;
    this.rivalChargeFx(0);
    this.rivalChargeSprite.hide();
    if (remote) this.netBotSnap(remote.pos);
    // nadie corre a la red para el duelo: solo sale si los DOS ya estaban cerca de ella (shouldStartDuel); aquí se quedan donde están
    this.renderActors();
    const online = !!this.net;
    const plan = remote ? cleanPlan(remote.plan) : rollPlan(Math.random);
    const now = performance.now();
    const sch = duelSchedule(plan).rounds;
    const gBase: number[] = [];
    let g = 0;
    for (const n of plan) {
      gBase.push(g);
      g += n;
    }
    const d: DuelState = {
      stage: 'intro',
      receiver,
      judge: !online || receiver === 'player',
      t0: now,
      tR0: 0,
      lastAt: now,
      plan,
      gBase,
      rounds: sch.map((r) => ({ ...r, hits: 0, early: false, rivalEarly: false, shownP: false, shownB: false, boostHit: -1, boostWho: null, ringOn: false, closed: false, resolved: false, tap: null, rival: null, autoAt: null, winner: null })),
      winner: null,
      pending: null,
      waitUntil: 0,
      aimAt: 0,
      ballFrom: { x: this.ball.s.x, y: this.ball.s.y, z: this.ball.s.z },
      saved: { ...this.ball.s },
      side: null,
      gaze: createDuelGaze(this, { centerY: this.scale.height / 2 - 50, mySkin: getProfile().skin, rivalSkin: this.rivalSkin() }),
      vignette: createDuelVignette(this),
      ring: this.add.graphics().setDepth(4000),
      score: createDuelScore(this, DUEL_SCORE_Y),
      aimG: null,
      press: createDuelPressure(this),
      y0: { player: pl.y, bot: bt.y },
      done: 0,
      decisive: false,
      vig2: null,
      decAt: 0,
    };
    this.duel = d;
    this.duelHideButtons(true); // (26-11-2026, usuario) sin RENDIRSE, EMOTES ni AUTO durante el duelo
    this.duelZoomAmt = NET_DUEL.camZoom;
    this.duelCamMid = this.duelMid();
    this.syncAbilityLock(); // DEFENSIVO y ESPECIAL se ven bloqueados hasta que sale el globo
    // online: aviso informativo si el ping está alto (la precisión se mide en cada teléfono contra su propio aro: no cambia el resultado)
    if (this.net && this.netRtt > NET_DUEL.lagWarnMs) showDuelLag(this, 252);
    const rx = receiver === 'player' ? pl : bt;
    this.cine.start({
      profile: DUEL_CINE,
      freeze: [...spritesIn(pl.ch), ...spritesIn(bt.ch)],
      executor: [],
      leadMs: 0,
      focus: () => this.cineFocus(rx),
      onFrame: () => this.duelIntroFrame(),
      onHit: () => this.duelIntroEnd(),
      onCancel: () => this.duelAbort('cancel'),
    });
    if (online && d.judge) this.net?.sendAction('duel-start', { x: pl.x, y: pl.y, a: plan[0], b: plan[1], c: plan[2] });
  }

  /** El marcador principal se esconde al empezar el duelo (más presión: solo quedan las 3 pelotas) y vuelve despacio al terminar. */
  private duelHudSync(dtS: number) {
    const want = this.duel ? 1 : 0;
    if (this.duelHudK === want) return;
    const dt = Math.max(0, Math.min(dtS, 0.05));
    this.duelHudK += (want - this.duelHudK) * Math.min(1, dt * (want ? NET_DUEL.hudOut : NET_DUEL.hudBack));
    if (Math.abs(this.duelHudK - want) < 0.01) this.duelHudK = want;
    this.hud.setAlpha(1 - this.duelHudK);
  }

  /** Cada fotograma del inicio (congelado): miradas, viñeta y cámara. */
  private duelIntroFrame() {
    const d = this.duel;
    if (!d || d.stage !== 'intro') return;
    const now = performance.now();
    const ms = now - d.t0;
    d.gaze.update(ms, NET_DUEL.introMs);
    d.vignette.update(ms, NET_DUEL.introMs);
    d.press.update(ms, 0);
    this.duelHudSync((now - d.lastAt) / 1000);
    this.duelCamera((now - d.lastAt) / 1000);
    d.lastAt = now;
  }

  /** Fin del inicio: empiezan las 3 rondas (la cinemática suelta el partido, que sigue parado: lo mueve tickDuel). */
  private duelIntroEnd() {
    const d = this.duel;
    if (!d) return;
    d.gaze.destroy();
    d.vignette.destroy();
    d.stage = 'rounds';
    d.tR0 = performance.now();
    d.lastAt = d.tR0;
    this.netCineSeen = true;
    const s = this.ball.s;
    d.ballFrom = { x: s.x, y: s.y, z: s.z };
    s.vx = s.vy = s.vz = 0; // la pelota la mueve el duelo (si se cancela, duelEnd restaura la suya)
    d.score.active(0);
  }

  /** Cámara: se acerca a la red (entre los dos) y se queda así mientras dura el duelo; al salir el globo la suelta el update normal. */
  private duelCamera(dtS: number) {
    const cam = this.cameras.main;
    const dt = Math.max(0, Math.min(dtS, 0.05));
    this.duelCamK += (1 - this.duelCamK) * Math.min(1, dt * NET_DUEL.camRate);
    const k = this.duelCamK;
    const e = k * k * (3 - 2 * k);
    const mid = this.duelCamMid;
    const wantZ = NET_DUEL.camZoom + NET_DUEL.camPress * (this.duel?.done ?? 0); // PRESIÓN: cada ronda, un poco más cerca
    this.duelZoomAmt += (wantZ - this.duelZoomAmt) * Math.min(1, dt * 3);
    cam.setZoom(VIEW.CAM_ZOOM * (1 + this.duelZoomAmt * e));
    cam.scrollY = (mid.sy - NET_DUEL.camLift - this.scale.height / 2) * e;
    const target = this.baseScrollX + (mid.sx - VIEW.W / 2) * (VIEW.FOLLOW + (1 - VIEW.FOLLOW) * 0.5 * e);
    cam.scrollX += (target - cam.scrollX) * Math.min(1, dt * 8);
  }

  /** Quién da el golpe `g` del peloteo (alternan, empieza el que recibía) y de qué lado (derecha / izquierda, cada vez el otro). */
  private duelHitInfo(d: DuelState, round: number, j: number): { who: Who; side: -1 | 1; lunge: boolean } {
    const g = d.gBase[round] + j;
    const other: Who = d.receiver === 'player' ? 'bot' : 'player';
    return { who: g % 2 === 0 ? d.receiver : other, side: duelHitSide(g), lunge: duelLungeHit(round, j) };
  }

  /** Punto de contacto de la raqueta: a cada lado de la red (SHOW), más lejos y más bajo en la estirada. */
  private duelContact(w: Who, side: -1 | 1, lunge = false) {
    const a = w === 'player' ? this.player : this.bot;
    return { x: a.x + a.dir * 15, y: LAT_C + side * NET_DUEL.showSpread * (lunge ? NET_DUEL.lungeReach : 1), z: lunge ? 28 : 52 };
  }

  /** Dónde sostiene la pelota el ganador mientras elige el lado y desde dónde sale el globo: delante de su cuerpo. */
  private duelHold(w: Who) {
    const a = w === 'player' ? this.player : this.bot;
    return { x: a.x + a.dir * 15, y: a.y + 14, z: 52 };
  }

  /** Dónde se detiene la pelota para el aro: sobre la red, entre los dos (donde empezaron). */
  private duelRingPos() {
    const d = this.duel;
    const y = d ? (d.y0.player + d.y0.bot) / 2 : (this.player.y + this.bot.y) / 2;
    return { x: NET_X, y, z: netTapeHeight(y) + NET_BALL_CLEARANCE + 4 };
  }

  /** Dónde se coloca el que pega para llegar al contacto (la estirada lo deja más atrás de la pelota). */
  private duelStandY(contactY: number, side: -1 | 1, lunge: boolean) {
    return clamp(contactY - side * (lunge ? 55 : 14), Y_MIN, Y_MAX);
  }

  /** SHOW: cada uno se desliza de lado a lado hacia su siguiente golpe y, al cerrarse el aro, vuelve a su sitio. */
  private duelMoveActors(d: DuelState, round: number, dtS: number, now: number) {
    const rr = d.rounds[round];
    for (const who of ['player', 'bot'] as const) {
      const a = who === 'player' ? this.player : this.bot;
      let ty = d.y0[who];
      for (let k = rr.hits; k < rr.hitAt.length; k++) {
        const h = this.duelHitInfo(d, round, k);
        if (h.who !== who) continue;
        ty = this.duelStandY(this.duelContact(who, h.side, h.lunge).y, h.side, h.lunge);
        break;
      }
      const dy = ty - a.y;
      a.y += clamp(dy * Math.min(1, dtS * 12), -700 * dtS, 700 * dtS);
      const moving = Math.abs(dy) > 12;
      a.ch.setMoving(moving, Math.sign(dy), moving ? 0.9 : 0);
    }
  }


  /** Cada fotograma tras el inicio: peloteo automático, aro, toques, resultado de cada ronda, ganador y globo. */
  private tickDuel(deltaMs: number) {
    const d = this.duel;
    if (!d) return;
    this.flu.lastFrame = 0; // (log de fluidez) la pausa del duelo no cuenta como tirón
    this.netCineSeen = true;
    if (this.net) {
      this.diagStateAt = performance.now();
      this.flu.lastIn = 0;
      this.fluSkip = true;
    }
    // durante la elección del lado el GANADOR muestra su carga al máximo (aura / efecto elegido); si no, nada de carga a medias
    if (d.stage !== 'aim') {
      this.chargeSprite.hide();
      this.rivalChargeSprite.hide();
    }
    const dt = Math.min(deltaMs, 50);
    const now = performance.now();
    d.press.update(now - d.t0, d.done);
    d.vig2?.update(now - d.decAt, 1e9);
    this.duelHudSync((now - d.lastAt) / 1000);
    this.duelCamera((now - d.lastAt) / 1000);
    d.lastAt = now;
    this.syncAbilityLock();
    // tope: el duelo NUNCA pasa de maxMs; si algo se atrasa (red), se corta aquí y sale el globo
    if (now - d.t0 > NET_DUEL.maxMs && d.stage !== 'hit') this.duelForceHit(now);
    if (d.stage === 'rounds') this.duelRounds(now, d, dt / 1000);
    else if (d.stage === 'wait') this.duelWait(now, d);
    else if (d.stage === 'aim') this.duelAim(now, d);
    else if (d.stage === 'hit') {
      // el ganador local (o el bot) golpea ya; si gana el rival en red, su golpe llega por game:hit (netApplyHit cierra el duelo)
      if (d.winner === 'player' || !this.net || now >= d.waitUntil) this.duelFinish();
    }
    if (!this.duel) return; // (duelFinish lo cerró)
    this.renderActors();
    this.ball.render(dt / 1000);
    this.netView.update();
  }

  /** Las 3 rondas seguidas desde `tR0`: golpes, aro, toques tardíos y resultados. */
  private duelRounds(now: number, d: DuelState, dtS: number) {
    const e = now - d.tR0;
    const last = d.rounds[d.rounds.length - 1];
    let cur = 0;
    for (let i = 0; i < d.rounds.length; i++) {
      const rr = d.rounds[i];
      if (e < rr.start) break;
      cur = i;
      while (rr.hits < rr.hitAt.length && e >= rr.hitAt[rr.hits]) {
        this.duelAutoHit(d, i);
        if (this.duel !== d) return;
      }
      if (!rr.ringOn && e >= rr.ringStart) this.duelRingOn(d, i);
      if (rr.ringOn && !rr.closed && e >= rr.close) this.duelRingClose(d, i);
      // piloto automático (AUTO): toca cuando le toca
      if (rr.autoAt !== null && rr.tap === null && !rr.early && e >= rr.close + rr.autoAt && e <= rr.close + NET_DUEL.lateMs) this.duelTap();
      // el bot "toca": su número sale sobre él en su instante (online sale al llegar su 'duel-tap')
      if (!this.net && rr.ringOn && rr.rival !== null && !rr.shownB && e >= rr.close + rr.rival) this.duelShowMs('bot', rr.rival, i);
      if (rr.closed && !rr.resolved) this.duelMaybeResolve(d, i, now);
    }
    const rr = d.rounds[cur];
    this.duelMoveActors(d, cur, dtS, now);
    // pelota: viaja entre los golpes y, en el aro, queda sobre la red dando botecitos
    const s = this.ball.s;
    const ringPos = this.duelRingPos();
    if (e < rr.ringStart) {
      const prev = cur === 0 ? d.ballFrom : ringPos;
      const pts = [prev, ...rr.hitAt.map((_, k) => {
        const h = this.duelHitInfo(d, cur, k);
        return this.duelContact(h.who, h.side, h.lunge);
      }), ringPos];
      const times = [rr.start, ...rr.hitAt, rr.ringStart];
      let j = 0;
      while (j < times.length - 2 && e >= times[j + 1]) j++;
      const u0 = clamp((e - times[j]) / Math.max(1, times[j + 1] - times[j]), 0, 1);
      // DESTELLO del ganador: tras su golpe fuerte la pelota sale más rápida (solo visual) y deja estela de su color
      const fast = rr.boostHit >= 0 && j - 1 === rr.boostHit;
      const u = fast ? 1 - Math.pow(1 - u0, NET_DUEL.boostCurve) : u0;
      const a = pts[j];
      const b = pts[j + 1];
      s.x = a.x + (b.x - a.x) * u;
      s.y = a.y + (b.y - a.y) * u;
      let arc = 26;
      if ((a.x - NET_X) * (b.x - NET_X) < 0) {
        const cross = (NET_X - a.x) / (b.x - a.x);
        const y = a.y + (b.y - a.y) * cross;
        const z = a.z + (b.z - a.z) * cross;
        arc = Math.max(arc, (netTapeHeight(y) + NET_BALL_CLEARANCE + 4 - z) / Math.sin(Math.PI * cross));
      }
      s.z = a.z + (b.z - a.z) * u + arc * Math.sin(Math.PI * u);
      if (fast && u0 > 0 && u0 < 1) this.duelTrail(s, rr.boostWho === 'player' ? 0x3a7bff : 0xff4f5e);
      d.ring.clear();
    } else {
      s.x = ringPos.x;
      s.y = ringPos.y;
      s.z = ringPos.z; // (14-11-2026) quieta en la red y girando (Ball.spinExtra) mientras el aro se cierra
      if (!rr.closed) this.drawDuelRing(d.ring, (e - rr.ringStart) / rr.ringMs, rr.tap === null ? null : 1 + rr.tap / rr.ringMs, rr.ringMs, d.decisive && cur === d.rounds.length - 1);
      else d.ring.clear();
    }
    if (e >= last.close && d.rounds.every((r) => r.resolved)) this.duelAllRounds(now, d);
  }

  /** Golpe automático del peloteo: gesto de volea, impacto y su sonido corto (sin física: la pelota la mueve duelRounds). */
  private duelAutoHit(d: DuelState, i: number) {
    const rr = d.rounds[i];
    const j = rr.hits;
    const h = this.duelHitInfo(d, i, j);
    rr.hits++;
    const a = h.who === 'player' ? this.player : this.bot;
    a.ch.setMoving(false, 0);
    a.ch.facing = (h.who === 'player' ? 1 : -1) * h.side; // derecha / izquierda alternando (lado de la pantalla)
    // (17-11-2026, usuario) que se vean REVESES y ESTIRADAS: del lado de la derecha, la volea; del revés, el golpe de revés (la volea es un
    // solo clip y antes todo se veía igual); en los golpes de estirada (duelLungeHit), el sprite de la estirada (sin hoja, el golpe de siempre)
    if (!(h.lunge && a.ch.lunge(a.ch.facing))) a.ch.swing(false, false, false, a.ch.facing > 0);
    if (h.lunge) this.dustFx(a.x, a.y);
    const c = this.duelContact(h.who, h.side, h.lunge);
    if (this.rallyRemaining === 0 && (!this.net || this.net.role === 'host')) {
      this.duelEnd(false);
      Object.assign(this.ball.s, c);
      this.ball.setPower(false);
      this.ball.setKind('normal');
      this.ball.setMaxCharge(false);
      if (h.who === 'player' && this.net) this.netHit = { volley: !h.lunge, lunge: h.lunge ? a.ch.facing : undefined };
      this.recordHit(h.who, true);
      this.bounces = 0;
      this.hitFx(c.x, c.y, c.z, false, 0.2);
      return;
    }
    // DESTELLO: el primer golpe del GANADOR de la ronda anterior (si ya se decidió y no fue empate) es más fuerte
    const prev = i > 0 ? d.rounds[i - 1].winner : null;
    if (prev && prev !== 'tie' && rr.boostHit < 0 && h.who === prev) {
      rr.boostHit = j;
      rr.boostWho = prev;
      this.hitFx(c.x, c.y, c.z, false, 0.2, true);
      sfx(this, 'golpe-fuerte', NET_DUEL.boostVol); // un poco más alto que los demás
      const col = prev === 'player' ? 0x3a7bff : 0xff4f5e;
      const bp = project(c.x, c.y, c.z);
      const f = this.add.circle(bp.sx, bp.sy, 20 * bp.s, col, 0.9).setDepth(4001).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: f, scale: 2.8, alpha: 0, duration: 260, onComplete: () => f.destroy() });
    } else this.hitFx(c.x, c.y, c.z, false, 0.2); // con el sonido de TODO golpe de raqueta: golpe-fuerte
  }

  /** Estela de color de la pelota del golpe destacado (un punto que se desvanece en cada fotograma). */
  private duelTrail(s: BallState, color: number) {
    const bp = project(s.x, s.y, s.z);
    const g = this.add.circle(bp.sx, bp.sy, 9 * bp.s, color, 0.75).setDepth(3990).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: g, alpha: 0, scale: 0.3, duration: NET_DUEL.boostTrailMs, onComplete: () => g.destroy() });
  }

  /** La pelota salta en la red y se transforma en el aro (cámara lenta): el bot sortea ya su toque. */
  private duelRingOn(d: DuelState, i: number) {
    const rr = d.rounds[i];
    rr.ringOn = true;
    d.score.active(i);
    this.setSlowMo(0.45);
    // mientras se cierra el aro: los dos personajes CONGELADOS y la pelota quieta girando en el sitio
    // (18-11-2026, usuario) el que venía de una ESTIRADA queda en el cuadro del contacto (lanzado con la raqueta), no tirado en el suelo
    for (const a of [this.player, this.bot]) a.ch.holdDiveReach();
    for (const sp of [...spritesIn(this.player.ch), ...spritesIn(this.bot.ch)]) sp.anims?.pause();
    this.ball.spinExtra = 22;
    if (!this.net) rr.rival = botTapMs(this.ai.d, Math.random, rr.ringMs);
    if (this.autoPlay) rr.autoAt = botTapMs(0.7, Math.random, rr.ringMs);
  }

  /** El aro se cierra: "tic" y de vuelta a la velocidad normal. */
  private duelRingClose(d: DuelState, i: number) {
    d.rounds[i].closed = true;
    this.setSlowMo(1);
    for (const sp of [...spritesIn(this.player.ch), ...spritesIn(this.bot.ch)]) sp.anims?.resume();
    this.ball.spinExtra = 0;
    uiSound(this, 'duel-tick');
    this.cameras.main.shake(130, 0.004); // el golpe seco del cierre
    const bp = project(this.ball.s.x, this.ball.s.y, this.ball.s.z);
    const f = this.add.circle(bp.sx, bp.sy, 16 * bp.s, 0xffd23f, 0.85).setDepth(4001).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: f, scale: 3.2, alpha: 0, duration: 260, onComplete: () => f.destroy() });
  }

  /** Aro que se cierra sobre la pelota; el toque propio queda marcado (verde = en el cierre, rojo = lejos). */
  private drawDuelRing(g: Phaser.GameObjects.Graphics, p: number, tapP: number | null, ringMs: number, gold = false) {
    const s = this.ball.s;
    const bp = project(s.x, s.y, s.z);
    const rb = 18 * bp.s;
    const R0 = 130 * bp.s;
    const near = p >= 0.9;
    g.clear();
    // RONDA DECISIVA: el aro es DORADO (más grueso, con halo) todo el recorrido
    g.lineStyle(Math.max(2, 3 * bp.s), gold ? 0xffd23f : 0xffffff, gold ? 0.8 : 0.45).strokeCircle(bp.sx, bp.sy, rb);
    const rr = rb + (R0 - rb) * (1 - Math.min(1, p));
    if (gold) g.lineStyle(Math.max(8, 16 * bp.s), 0xffb300, 0.28).strokeCircle(bp.sx, bp.sy, rr);
    g.lineStyle(Math.max(3, (near || gold ? 8 : 5) * bp.s), gold ? (near ? 0xfff2a8 : 0xffd23f) : near ? 0xffd23f : 0xffffff, 1).strokeCircle(bp.sx, bp.sy, rr);
    if (near) g.fillStyle(0xffd23f, gold ? 0.35 : 0.22).fillCircle(bp.sx, bp.sy, rb * 1.4);
    if (tapP !== null) g.lineStyle(Math.max(3, 4 * bp.s), Math.abs(tapP - 1) * ringMs <= NET_DUEL.msOk ? 0x6dff9a : 0xff6b78, 0.95).strokeCircle(bp.sx, bp.sy, rb + (R0 - rb) * (1 - clamp(tapP, 0, 1)));
  }

  /** Toque del botón de golpe (lo llama toggleCharge): se mide en ms contra el cierre del aro con performance.now(). */
  private duelTap() {
    const d = this.duel;
    if (!d || d.stage !== 'rounds') return;
    const e = performance.now() - d.tR0;
    // la ronda cuyo aro está cerrándose (o se cerró hace menos de lateMs)
    const i = d.rounds.findIndex((r) => e >= r.ringStart && e <= r.close + NET_DUEL.lateMs);
    if (i < 0) return;
    const rr = d.rounds[i];
    if (rr.tap !== null || rr.early || rr.resolved) return;
    const diff = Math.round(tapDiffMs(e, rr.close));
    this.net?.sendAction('duel-tap', { r: i, ms: diff });
    if (tapIsEarly(diff, rr.ringMs)) {
      // demasiado PRONTO: fallo (cuenta como sin toque), el marcador tiembla
      rr.early = true;
      rr.shownP = true;
      d.score.shake(i);
      navigator.vibrate?.([10, 30, 10]);
      const hp = this.headPos(this.player);
      this.popText(hp.x, hp.y - 20, '¡PRONTO!', '#ff6b78', 40);
      return;
    }
    rr.tap = diff;
    navigator.vibrate?.(Math.abs(diff) <= NET_DUEL.msGood ? 20 : [10, 30, 10]);
    this.duelShowMs('player', diff, i);
  }

  /** Número grande con los ms de un toque sobre su personaje, con el color de su precisión (verde / amarillo / rojo); +/− = después / antes del cierre. */
  private duelShowMs(who: Who, ms: number, round: number) {
    const rr = this.duel?.rounds[round];
    if (!rr || rr.resolved || (who === 'player' ? rr.shownP : rr.shownB)) return;
    if (who === 'player') rr.shownP = true;
    else rr.shownB = true;
    const tier = msTier(ms);
    const col = tier === 'good' ? '#7dff9a' : tier === 'ok' ? '#ffd23f' : '#ff6b78';
    const h = this.duelMsPos(who);
    this.popText(h.x, h.y, diffLabel(ms), col, 44);
  }

  /** ¿Ya se puede decidir la ronda `i`? Pasada la ventana de toques (y, en red, el juez espera el valor del rival). */
  private duelMaybeResolve(d: DuelState, i: number, now: number) {
    const rr = d.rounds[i];
    const atClose = d.tR0 + rr.close;
    if (this.net && !d.judge) {
      // el juez avisa el resultado ('duel-round'); si no llega, la ronda se da por empatada y manda su resultado final
      if (now >= atClose + NET_DUEL.lateMs + NET_DUEL.netWaitMs) this.duelApplyRound(d, i, 'tie', rr.tap, null);
      return;
    }
    if (now < atClose + NET_DUEL.lateMs + (this.net ? NET_DUEL.graceMs : 0)) return;
    const w = roundWinner(rr.tap, rr.rival);
    this.duelApplyRound(d, i, w, rr.tap, rr.rival);
    if (this.net) this.net.sendAction('duel-round', { r: i, w: roundWire(w), p: rr.tap ?? NO_TAP, b: rr.rival ?? NO_TAP });
  }

  /** Resultado de la ronda: su pelota en el marcador, el error en ms sobre cada personaje y el sonido. `mine` / `rival` = errores en ms. */
  private duelApplyRound(d: DuelState, i: number, w: RoundWho, mine: number | null, rival: number | null) {
    const rr = d.rounds[i];
    if (!rr || rr.resolved) return;
    rr.resolved = true;
    rr.winner = w;
    d.score.set(i, w);
    d.done = Math.max(d.done, i + 1); // PRESIÓN: más zoom y latido más rápido
    // lo que aún no salió sobre cada personaje: su número (llegó tarde, p. ej. por la red) o ¡SIN TOQUE!
    for (const who of ['player', 'bot'] as const) {
      const ms = who === 'player' ? mine : rival;
      if (who === 'player' ? rr.shownP : rr.shownB) continue;
      if (who === 'player') rr.shownP = true;
      else rr.shownB = true;
      const tier = ms === null ? 'bad' : msTier(ms);
      const h = this.duelMsPos(who);
      this.popText(h.x, h.y, ms === null ? '¡SIN TOQUE!' : diffLabel(ms), tier === 'good' ? '#7dff9a' : tier === 'ok' ? '#ffd23f' : '#ff6b78', ms === null ? 36 : 44);
    }
    // RONDA DECISIVA: van 1-1 antes de la tercera
    if (i === 1 && !d.decisive && isDecisive(d.rounds.map((r) => r.winner))) {
      d.decisive = true;
      d.decAt = performance.now();
      d.vig2 = createDuelVignette(this, NET_DUEL.vignetteDecisive);
      showDuelDecisive(this, DUEL_SCORE_Y);
    }
    if (w === 'player') uiSound(this, 'duel-win');
    // REACCIÓN EXPRESS de los dos (celebra el ganador de la ronda, se lamenta el otro); el siguiente golpe la corta
    if (w === 'player' || w === 'bot') {
      (w === 'player' ? this.player : this.bot).ch.quickReact(true);
      (w === 'player' ? this.bot : this.player).ch.quickReact(false);
    }
    if (i + 1 < d.rounds.length) d.score.active(i + 1);
  }

  /** Las 3 rondas ya están decididas: gana el que tenga más (empate: el que recibía). El juez avisa; el otro espera su aviso. */
  private duelAllRounds(now: number, d: DuelState) {
    d.stage = 'wait';
    d.ring.clear();
    this.setSlowMo(1);
    d.waitUntil = now + (this.net && !d.judge ? NET_DUEL.netWaitMs : 0);
    if (d.judge) this.duelDecide(duelWinner(d.rounds.map((r) => r.winner ?? 'tie'), d.receiver));
  }

  /** (no-juez) espera el 'duel-result' del juez; si no llega a tiempo, usa su propia cuenta de rondas. */
  private duelWait(now: number, d: DuelState) {
    if (d.pending) this.duelDecide(d.pending);
    else if (now >= d.waitUntil) this.duelDecide(duelWinner(d.rounds.map((r) => r.winner ?? 'tie'), d.receiver));
  }

  /** Ya hay ganador del duelo: avisos y empieza la elección del lado del globo. */
  private duelDecide(winner: Who) {
    const d = this.duel;
    if (!d || d.winner) return;
    d.winner = winner;
    if (winner === 'player') this.tutMission('tDuel'); // (24-11-2026) misión del tutorial
    if (this.net && d.judge) this.net.sendAction('duel-result', { w: winner === 'player' ? 1 : 0 });
    d.stage = 'aim';
    d.aimAt = performance.now();
    const s = this.ball.s;
    d.ballFrom = { x: s.x, y: s.y, z: s.z };
    this.duelAimStart(d);
  }

  /** Empieza la elección del lado: el ganador tiene NET_DUEL.aimMs; sin elección va al lado contrario de donde está el rival. */
  private duelAimStart(d: DuelState) {
    const w = d.winner as Who;
    const a = w === 'player' ? this.player : this.bot;
    a.ch.setCharging(true); // pose de preparación mientras elige
    if (w !== 'player' && !this.net) d.side = Math.random() < 0.75 ? defaultAimSide(this.player.y, LAT_C) : Math.random() < 0.5 ? -1 : 1;
  }

  /** El ganador sostiene la pelota y elige el lado con el joystick durante aimMs. */
  private duelAim(now: number, d: DuelState) {
    const w = d.winner as Who;
    const s = this.ball.s;
    const c = this.duelHold(w);
    s.x = c.x;
    s.y = c.y;
    s.z = c.z + 4 * Math.sin((now - d.aimAt) / 90);
    this.duelChargeFx(w, this.game.loop.delta / 1000);
    if (w === 'player') {
      const sd = sideFromJoystick(this.inputVector().x);
      if (sd !== null && sd !== d.side) {
        d.side = sd;
        this.net?.sendAction('duel-aim', { side: sd });
      }
    }
    this.drawDuelAim(d);
    if (now - d.aimAt >= NET_DUEL.aimMs) {
      d.stage = 'hit';
      d.waitUntil = now + NET_DUEL.hitWaitMs;
    }
  }

  /** ANIMACIÓN DE CARGA AL MÁXIMO del ganador mientras elige el lado: el efecto de carga elegido (o el aura clásica con chispas). */
  private duelChargeFx(w: Who, dtS: number) {
    if (w === 'player') {
      const p = project(this.player.x, this.player.y);
      if (isSpriteCharge(this.chargeKind)) {
        this.chargeSprite.setCharge(1);
        this.chargeSprite.render(dtS, p.sx, p.sy, p.s, p.sy);
      } else {
        const k = p.s * VIEW.CHAR_K;
        this.chargeAura.update(dtS, p.sx, p.sy, k, this.player.ch.facing, 1, p.sy);
        this.chargeSparks.update(dtS, p.sx, p.sy, k);
      }
    } else {
      this.rivalChargeT = 1.2; // el rival, igual (su carga se ve en rivalChargeFx)
      this.rivalChargeFx(dtS);
    }
  }

  /** Los dos lados del fondo del rival con el elegido resaltado (como el apuntado del REMATE). */
  private drawDuelAim(d: DuelState) {
    const w = d.winner as Who;
    const loser = w === 'player' ? this.bot : this.player;
    const g = d.aimG ?? (d.aimG = this.add.graphics().setDepth(0.8));
    g.clear();
    // (17-11-2026, usuario) MISTERIO: el que perdió el duelo NO ve qué lado eligió el ganador (bot o rival online). Ve los dos lados iguales,
    // latiendo a la vez, hasta que sale el globo. Solo el ganador ve su lado resaltado.
    const mine = w === 'player';
    const chosen = mine ? (d.side ?? defaultAimSide(loser.y, LAT_C)) : 0;
    const beat = mine ? 1 : 0.55 + 0.45 * Math.sin(performance.now() / 140);
    const half = w === 'player' ? COURT.right - NET_X : NET_X - COURT.left;
    const x0 = w === 'player' ? NET_X + half * 0.55 : COURT.left;
    const x1 = w === 'player' ? COURT.right : NET_X - half * 0.55;
    for (const sd of [-1, 1] as const) {
      const [y0, y1] = sd < 0 ? [COURT.top, LAT_C] : [LAT_C, COURT.bottom];
      const pts = [this.P(x0, y0), this.P(x0, y1), this.P(x1, y1), this.P(x1, y0)];
      if (!mine) {
        // los dos lados iguales: no se sabe adónde irá
        g.fillStyle(0xffffff, 0.1 * beat).fillPoints(pts, true);
        g.lineStyle(3, 0xffffff, 0.35 + 0.35 * beat).strokePoints(pts, true);
        continue;
      }
      const on = sd === chosen;
      if (on) g.fillStyle(0xffd23f, 0.35).fillPoints(pts, true);
      g.lineStyle(on ? 4 : 2, on ? 0xffd23f : 0xffffff, on ? 0.95 : 0.4).strokePoints(pts, true);
    }
  }

  /** Tope de tiempo: se salta lo que falte y sale el globo con el ganador que ya se sepa (o por las rondas decididas). */
  private duelForceHit(now: number) {
    const d = this.duel;
    if (!d) return;
    d.winner ??= d.pending ?? duelWinner(d.rounds.map((r) => r.winner ?? 'tie'), d.receiver);
    d.stage = 'hit';
    d.waitUntil = now + NET_DUEL.hitWaitMs;
    d.ring.clear();
    this.setSlowMo(1);
    if (this.net && d.judge) this.net.sendAction('duel-result', { w: d.winner === 'player' ? 1 : 0 });
  }

  /** El golpe final lo da el ganador (este teléfono o el bot): cierra el duelo y manda el GLOBO DISPARADO. */
  private duelFinish() {
    const d = this.duel;
    if (!d) return;
    const w = (d.winner ?? d.receiver) as Who;
    const loser = w === 'player' ? this.bot : this.player;
    const side = d.side ?? defaultAimSide(loser.y, LAT_C);
    this.duelEnd(false);
    this.duelLaunchLob(w, side);
  }

  /** Trayectoria con el tiempo de vuelo `T0` exacto hasta (tx, ty) (si no pasa la red con margen, se alarga como aimShot). */
  private duelTimedShot(s: BallState, tx: number, ty: number, T0: number) {
    const dx = tx - s.x;
    const dy = ty - s.y;
    let T = T0;
    for (let i = 0; i < 25; i++) {
      const vx = dx / T;
      const vz = (0.5 * GRAVITY * T * T - s.z) / T;
      const tn = (NET_X - s.x) / vx;
      const zn = s.z + vz * tn - 0.5 * GRAVITY * tn * tn;
      if (tn <= 0 || tn >= T || zn > netTapeHeight(s.y + dy * (tn / T)) + NET_BALL_CLEARANCE + NET_DUEL.lob.margin) break;
      T *= 1.08;
    }
    s.damp = undefined;
    s.fric = undefined;
    s.ay = undefined;
    s.g = undefined;
    s.vx = dx / T;
    s.vy = dy / T;
    s.vz = (0.5 * GRAVITY * T * T - s.z) / T;
    this.curveLob(s, tx, ty, T);
    this.highLob(s, T);
  }

  /**
   * (18-11-2026, usuario) Devolución en GLOBO DE VERDAD tras recibir un ESPECIAL / ULTI: alto y lento (apex ~440, vuelo ~2 s), así
   * LobTracker lo detecta (apex ≥ minApexZ, vuelo ≥ minFlight) y sale el círculo del SMASH / REMATE para el que lo lanzó: esa es la
   * ventaja. Antes (aimShot a 0,55 con margen 70) salía un globito bajo que no generaba el círculo.
   */
  private smashableLob(s: BallState, tx: number, ty: number) {
    const apex = 440;
    const z0 = Math.max(0, s.z);
    const vz = Math.sqrt(2 * GRAVITY * Math.max(1, apex - z0));
    const T = (vz + Math.sqrt(vz * vz + 2 * GRAVITY * z0)) / GRAVITY;
    aimShot(s, tx, ty, SHOT_SPEED, 70); // limpia el bote / efectos del golpe anterior
    s.vx = (tx - s.x) / T;
    s.vy = (ty - s.y) / T;
    s.vz = vz;
  }

  /**
   * GLOBO DISPARADO ALTO: sube NET_DUEL.lobApex sobre el punto de golpe y cae en el MISMO tiempo `T` que tardaría con la gravedad
   * normal, con una gravedad propia de ese vuelo (BallState.g; vuelve a la normal al botar). Así es mucho más alto pero igual de rápido.
   */
  private highLob(s: BallState, T: number) {
    if (!(T > 0.2)) return;
    const h = NET_DUEL.lobApex;
    const z0 = Math.max(0, s.z);
    const b = z0 + 2 * h;
    const g = (b + Math.sqrt(b * b - z0 * z0)) / ((T * T) / 2); // (g·T/2 − z0/T)² = 2·g·h
    s.g = g;
    s.vz = (0.5 * g * T * T - s.z) / T;
  }

  /** Aplana un golpe que saldría en arco alto (ver DIRECT): más velocidad hasta que el punto más alto baje del tope. */
  private flattenShot(s: BallState, tx: number, ty: number, speed: number, margin: number) {
    const apex = () => s.z + (s.vz > 0 ? (s.vz * s.vz) / (2 * GRAVITY) : 0);
    let sp = speed;
    let best = apex();
    for (let i = 0; i < DIRECT.tries && best > DIRECT.apex; i++) {
      aimShot(s, tx, ty, sp * DIRECT.step, margin);
      const a = apex();
      if (a >= best - 0.5) {
        aimShot(s, tx, ty, sp, margin); // ya no baja (la red lo obliga a subir): se deja el anterior
        break;
      }
      sp *= DIRECT.step;
      best = a;
    }
  }

  /**
   * EFECTO del GLOBO DISPARADO: la pelota sale casi recta y se abre hacia su esquina (aceleración lateral `ay`, la del saque con
   * efecto: curva en el aire y 'patada' al botar). Aterriza exactamente en (tx, ty). `T` = tiempo de vuelo (si no, sale de vx).
   */
  private curveLob(s: BallState, tx: number, ty: number, T = (tx - s.x) / s.vx) {
    if (!(T > 0.2)) return;
    const dy = ty - s.y;
    const k = NET_DUEL.lobCurve;
    s.vy = (dy * k) / T;
    s.ay = (2 * dy * (1 - k)) / (T * T);
  }

  /**
   * GLOBO DISPARADO del ganador a la esquina del fondo de `side` (física normal desde aquí): el de siempre (brillo y rayos del
   * máximo, estela amarilla, la cámara se aleja con maxLob), pero con el TIEMPO DE VUELO ajustado al rival: lo que tarda en
   * correr hasta la esquina sin contar su estirada. Corriendo llega justo (normalmente estirándose); con DEFENSIVO llega bien.
   */
  private duelLaunchLob(w: Who, side: -1 | 1) {
    const a = w === 'player' ? this.player : this.bot;
    const loser = w === 'player' ? this.bot : this.player;
    const s = this.ball.s;
    const c = this.duelHold(w);
    const tg = lobTarget(w, side, COURT, LAT_C, HALF_W);
    s.x = c.x;
    s.y = c.y;
    s.z = c.z;
    s.vx = s.vy = s.vz = 0;
    const speed = loser === this.bot ? this.ai.speed : PLAYER_SPEED;
    const T = lobFlightS(Math.hypot(tg.x - loser.x, tg.y - loser.y), speed, LUNGE_RANGE);
    this.duelTimedShot(s, tg.x, tg.y, T);
    this.ball.setPower(false);
    this.ball.setIgnited(false);
    this.ball.setKind('lob');
    this.ball.setMaxCharge(true); // brillo, rayos y estela amarilla del GLOBO DISPARADO (después de setKind)
    this.maxLob = { hitter: w }; // la cámara pasa del zoom de la red al alejamiento del globo
    this.maxLobWide = true;
    a.ch.setCharging(false);
    const fx = a.ch.swing(true, false, false, false);
    this.bounces = 0;
    if (w === 'player') {
      if (this.net) this.netHit = { charged: true, overhead: false, volley: false, shock: true }; // el rival ve el mismo GLOBO DISPARADO
      this.recordHit('player', true);
      this.ai.onPlayerHit(false);
    } else {
      this.recordHit('bot', true);
      this.ai.onBotHit();
    }
    this.hitFxAt(fx, s.x, s.y, s.z, false, 1);
    if (this.rallyForcedShot) {
      this.netFlushHit();
      return;
    }
    const pc = project(s.x, s.y, s.z);
    this.time.delayedCall(fx, () => {
      shockFx(this, pc.sx, pc.sy, pc.s);
      sfx(this, 'electricidad', 0.8);
      this.maxContactFlash(pc.sx, pc.sy, pc.s);
    });
    const h = this.headPos(a);
    this.popText(h.x, h.y - 10, '¡GLOBO!', '#ffe680', 34);
    this.duelDefend = loser === this.bot ? 'bot' : 'player';
    this.duelLungeRoll = null;
    this.duelLobUntil = performance.now() + NET_DUEL.lobGraceMs;
    this.netFlushHit();
  }

  /** Quita todo lo del duelo. `restore` = devolver la pelota como estaba (cancelado sin golpe final). */
  private duelEnd(restore: boolean) {
    const d = this.duel;
    if (!d) return;
    this.duel = null;
    this.duelHideButtons(false);
    // por si se cortó con el aro abierto: los personajes vuelven a animarse y la pelota deja de girar sola
    for (const sp of [...spritesIn(this.player.ch), ...spritesIn(this.bot.ch)]) if (sp.anims?.isPaused) sp.anims.resume();
    this.ball.spinExtra = 0;
    d.gaze.destroy();
    d.vignette.destroy();
    d.vig2?.destroy();
    d.press.destroy(!this.cine.active);
    d.ring.destroy();
    d.aimG?.destroy();
    d.score.destroy();
    this.setSlowMo(1);
    this.player.ch.setCharging(false);
    this.bot.ch.setCharging(false);
    this.chargeSprite.hide(); // la carga al máximo del ganador se apaga con el golpe
    this.chargeAura.hide();
    this.chargeSparks.hide();
    this.rivalChargeT = 0;
    this.rivalChargeFx(0);
    this.rivalChargeSprite.hide();
    this.syncAbilityLock(); // los botones vuelven a estar disponibles
    if (restore) Object.assign(this.ball.s, d.saved);
    this.netCineSeen = true; // el rival sigue desde donde quedó (no salta al último estado que llegó)
  }

  /** Cancela el duelo (punto decidido, reconexión, golpe del rival, fin del partido): el partido sigue normal. */
  private duelAbort(_reason: string) {
    if (!this.duel) return;
    this.duelEnd(_reason !== 'hit' && _reason !== 'point' && _reason !== 'end');
    if (this.cine.active) this.cine.cancel();
  }

  // ---- red
  /** El juez (el que recibe la pelota) empezó el duelo: aquí se ve el mismo inicio y el mismo peloteo (su plan de golpes). */
  private netRemoteDuelStart(d: ActionMsg['data']) {
    if (this.duel || this.cineLock || this.phase !== 'rally') return;
    const pos = this.netBotPos(d?.x, d?.y);
    if (!pos) return;
    this.duelUsed = true;
    this.duelStart('bot', { pos, plan: [Number(d?.a), Number(d?.b), Number(d?.c)] });
  }

  /** Toque del rival: su error en ms contra el cierre de SU aro, en la ronda `r`. Los dos teléfonos ven su número (o ¡PRONTO!); solo el juez lo guarda para decidir. */
  private netRemoteDuelTap(r: number, ms: number) {
    const d = this.duel;
    if (!d) return;
    const rr = d.rounds[r];
    if (!rr || rr.resolved || !Number.isFinite(ms) || !tapInWindow(ms, rr.ringMs) || rr.rivalEarly || rr.shownB) return;
    const diff = Math.round(ms);
    if (tapIsEarly(diff, rr.ringMs)) {
      // demasiado PRONTO: fallo del rival (sin toque), tiembla su pelota del marcador
      rr.rivalEarly = true;
      rr.shownB = true;
      d.score.shake(r);
      const hb = this.headPos(this.bot);
      this.popText(hb.x, hb.y - 20, '¡PRONTO!', '#ff6b78', 40);
      return;
    }
    if (d.judge && rr.rival === null) rr.rival = diff;
    this.duelShowMs('bot', diff, r);
  }

  /** (no-juez) resultado de una ronda del juez: 'w' 1 = ganó SU jugador (aquí, el rival), 2 = ganó el otro, 0 = empate; p / b = errores de cada uno. */
  private netRemoteDuelRound(data: ActionMsg['data']) {
    const d = this.duel;
    if (!d || d.judge) return;
    const r = Number(data?.r);
    const rr = Number.isInteger(r) ? d.rounds[r] : undefined;
    if (!rr || rr.resolved) return;
    const p = Number(data?.p);
    const b = Number(data?.b);
    // lo del emisor se invierte: su jugador es mi rival
    this.duelApplyRound(d, r, roundFromWire(Number(data?.w)), b === NO_TAP || !Number.isFinite(b) ? null : b, p === NO_TAP || !Number.isFinite(p) ? null : p);
  }

  /** Ganador del duelo según el juez: 1 = ganó SU jugador (para este teléfono, el rival). */
  private netRemoteDuelResult(w: number) {
    const d = this.duel;
    if (!d || d.judge) return;
    d.pending = w === 1 ? 'bot' : 'player';
    if (d.stage === 'wait') this.duelDecide(d.pending);
  }

  /** Lado que eligió el ganador remoto (sus coordenadas → las de aquí). */
  private netRemoteDuelAim(side: number) {
    const d = this.duel;
    if (!d || d.winner !== 'bot' || !Number.isFinite(side) || side === 0) return;
    d.side = mirrorSide(side);
  }

  /**
   * ESTIRADA del BOT al globo del duelo: solo defendiendo el globo final, si la pelota no entra en su alcance normal pero sí en el
   * ampliado. Lo intenta con probabilidad según su nivel (una vez por globo). Devuelve true si se tira (el golpe sale al contacto).
   */
  private botDuelLunge(s: BallState): boolean {
    const bt = this.bot;
    if (!this.inReach(bt, s, LUNGE_RANGE, LUNGE_MAX_Z)) return false;
    if (this.duelLungeRoll === null) this.duelLungeRoll = Math.random() < NET_DUEL.botLunge.base + NET_DUEL.botLunge.k * this.ai.d;
    if (!this.duelLungeRoll) return false;
    // contacto previsto: la pelota dentro de LUNGE_CONTACT_S
    const p = { ...s };
    let bounces = this.bounces;
    for (let t = 0; t < LUNGE_CONTACT_S; t += 1 / 120) {
      const ev = stepBall(p, 1 / 120);
      if (ev === 'net' || (ev === 'bounce' && ++bounces >= 2)) return false;
    }
    this.duelDefend = null;
    this.duelLungeRoll = null;
    const side = p.y > bt.y ? 1 : -1;
    bt.ch.facing = side;
    if (!bt.ch.lunge(side)) bt.ch.swing();
    bt.stun = LUNGE_RECOVER + LUNGE_CONTACT_S;
    const ms = Math.max(60, LUNGE_CONTACT_S * 1000);
    this.tweens.add({ targets: bt, x: clamp(p.x - bt.dir * 15, B_X[0], B_X[1]), y: clamp(p.y - side * Math.min(LUNGE_ARM, Math.abs(p.y - bt.y)), Y_MIN, Y_MAX), duration: ms, ease: 'Quad.easeOut' });
    this.dustFx(bt.x, bt.y);
    this.time.delayedCall(ms, () => {
      if (this.phase !== 'rally' || this.lastHitter !== 'player') return;
      const b = this.ball.s;
      b.z = Math.max(b.z, 18);
      aimShot(b, NET_X - (NET_X - COURT.left) * rand(0.6, 0.85), LAT_C + rand(-0.45, 0.45) * (HALF_W - 30), SHOT_SPEED * 0.72, 80);
      this.ball.setPower(false);
      this.ball.setKind('lob');
      this.lastHitter = 'bot';
      this.bounces = 0;
      this.ai.onBotHit();
      this.hitFx(b.x, b.y, b.z, false);
    });
    return true;
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
    this.serveReceiver = null; // 2v2: se vuelve a fijar abajo con la formación de este saque
    this.duelUsed = false; // un duelo como máximo por punto
    this.duelDefend = null;
    this.duelLungeRoll = null;
    // (red) ya colocado para el saque de este punto: desde aquí se descartan los estados del rival de un punto anterior
    this.netPlaced = true;
    this.netPlacedAt = performance.now();
    this.endRemate();
    this.remateWhiffed = false;
    this.remateRecover = 0;
    this.remateWhiffBlock = false;
    this.endBotRemate();
    this.botRemateRoll = null;
    this.netRemoteRemate(false);
    this.server = this.score.server === 0 ? 'player' : 'bot';
    const side = (this.score.points[0] + this.score.points[1]) % 2 === 0 ? 1 : -1;
    this.endShadowRun(); // un clon de SOMBRA a medio camino no pasa al punto siguiente
    for (const t of [...this.iceTrails]) t.destroy(); // el camino de hielo del PATINAJE tampoco
    for (const a of [this.player, this.bot]) {
      this.clearRacket(a); // la raqueta perdida vuelve a la mano en el punto siguiente
      this.skyBallHidden = false;
      this.stunFog.clear(); // punto nuevo: sin niebla del aturdido
      this.hud.setVisible(true); // vuelve el marcador (se ocultó en ¡A LAS ESTRELLAS!)
      if (a.launched) {
        // volvió de las estrellas: se restaura el dibujo
        a.launched = false;
        this.tweens.killTweensOf(a.ch);
        a.ch.setAngle(0).setAlpha(1);
        a.ch.shadow.setVisible(true); // su sombra del suelo no voló con él
      }
      a.ch.releaseRemate(); // pose de remate sin golpe (punto terminado a mitad): vuelve a animarse
      this.diagCause = 'saque'; // (log) el salto a la posición de saque es normal
      a.stun = 0;
      a.warp = 1;
      a.vanished = false;
      a.lift = 0;
      a.spin = undefined;
      a.squat = undefined;
      this.tweens.killTweensOf(a);
    }
    this.netEndBotFly(false); // SOMBRA / SUPERSALTO del rival cortados por el fin del punto
    // (21-11-2026, log de la partida online) dónde se VEÍA al rival antes de colocarlo para el saque: desde ahí se desliza (ver abajo)
    const prevBot = { x: this.bot.x, y: this.bot.y };
    this.netBallCatch = 0;
    this.ball.setMaxCharge(false); // el brillo y los rayos del golpe cargado al máximo no pasan al punto siguiente
    if (this.server === 'player') {
      this.setActor(this.player, COURT.left - 40, LAT_C + side * 70);
      this.setActor(this.bot, COURT.right + 45, LAT_C - side * 40);
    } else {
      this.setActor(this.bot, COURT.right + 40, LAT_C - side * 70);
      this.setActor(this.player, COURT.left - 45, LAT_C + side * 40);
    }
    // (25-11-2026, usuario) nivel 1, primer punto: empiezas a la IZQUIERDA (vas primero a la derecha); el bot, a la izquierda, saca en
    // diagonal a tu cuadro de la DERECHA (computeServeBox usa su posición)
    // (25-11-2026, usuario) nivel 2, primer punto: el bot espera tu saque ADELANTADO, junto a su cuadro de saque (donde cae), y desde ahí
    // te tira esquinado al otro lado (feedPracticeReturn): no llegas sin el DEFENSIVO
    if (this.guide === 'spin' && this.score.played === 0 && this.server === 'player') {
      const sl = (COURT.right - NET_X) * 0.538;
      const boxY = this.player.y > LAT_C ? (COURT.top + LAT_C) / 2 : (LAT_C + COURT.bottom) / 2;
      this.setActor(this.bot, NET_X + sl + 45, boxY); // (25-11-2026, usuario) cerca, pero FUERA del cuadro de saque (antes sl * 0.9, dentro)
    }
    if (this.guide === 'first' && this.score.played === 0 && this.server === 'bot') {
      this.setActor(this.bot, COURT.right + 40, LAT_C - 70);
      this.setActor(this.player, COURT.left - 45, LAT_C - 110);
    }
    // (26-11-2026, usuario) nivel 4, P2 (CARGANDO): esperas el saque un poco más ADELANTE (más arriba en pantalla)
    if (this.guide === 'l4' && this.score.played === 1 && this.server === 'bot') this.setActor(this.player, this.player.x + 60, this.player.y);
    this.player.ch.facing = 1;
    this.player.ch.resetPose();
    this.bot.ch.facing = -1;
    this.bot.ch.resetPose();
    if (this.doubles && this.ally) {
      // 2v2: cada pareja en su fondo, uno a cada lado; el aliado y el 2.º rival se reinician como los demás
      const other = this.otherRival();
      for (const a of [this.ally, other!]) {
        if (!a) continue;
        if (a.launched) {
          // volvió de las estrellas (¡A LAS ESTRELLAS! también alcanza al compañero y al otro rival)
          a.launched = false;
          this.tweens.killTweensOf(a.ch);
          a.ch.setAngle(0).setAlpha(1);
          a.ch.shadow.setVisible(true);
        }
        this.clearRacket(a);
        a.stun = 0;
        a.warp = 1;
        a.vanished = false;
        a.lift = 0;
        a.spin = undefined; // (23-11-2026) VOLTERETA / PATINAJE del aliado cortados por el fin del punto
        this.tweens.killTweensOf(a);
        a.ch.releaseRemate();
        a.ch.resetPose();
      }
      // (19-11-2026, dobles reales) en los DOS equipos el compañero espera en la red, en el lado contrario: el del que saca y el del que recibe.
      // El que recibe se queda al fondo en el lado del cuadro CRUZADO (sitio A del equipo humano; `this.bot` en el rival)
      this.setActor(this.ally, NET_X - DOUBLES_NET_GAP, clamp(2 * LAT_C - this.player.y, Y_MIN + 40, Y_MAX - 40));
      if (other) this.setActor(other, NET_X + DOUBLES_NET_GAP, clamp(2 * LAT_C - this.bot.y, Y_MIN + 40, Y_MAX - 40));
      this.ally.ch.facing = 1;
      if (other) other.ch.facing = -1;
      // RECIBE el equipo humano: cada uno tiene su lado FIJO (el jugador / host, el de y > centro; el aliado / invitado, el otro). Si el cuadro
      // cruzado de este punto es del aliado, él va al fondo (sitio A) y tú a la red (sitio B). En red lo resuelve hostInA (más abajo)
      const humansRecvA = this.player.y > LAT_C; // sitio A (el del receptor) en el lado de y > centro
      // (también) juego de saque del ALIADO contra bots: él va al sitio de saque (A, al fondo) y tú a la red
      if (!this.net2 && ((this.server === 'bot' && !humansRecvA) || this.allyServes)) {
        const px = this.player.x;
        const py = this.player.y;
        this.setActor(this.player, this.ally.x, this.ally.y);
        this.setActor(this.ally, px, py);
      }
      // 2v2 online: el plano del punto tiene dos sitios (A = el de `player` en el 2v2 contra bots: al fondo si saca el equipo, y B = el del aliado: en la red).
      // Saca el humano al azar (net2ServerIsHost): ocupa A; si recibe el equipo, ocupa A (el receptor) el dueño de ese lado: el host si A está en
      // y > centro, si no el invitado. Cada teléfono se dibuja como `player`.
      if (this.net2) {
        const hostInA = this.server === 'bot' ? humansRecvA : this.net2ServerIsHost();
        if (this.net2host ? !hostInA : hostInA) {
          const px = this.player.x;
          const py = this.player.y;
          this.setActor(this.player, this.ally.x, this.ally.y);
          this.setActor(this.ally, px, py);
        }
      }
      if (this.net2) {
        this.net2Anchor(0, this.ally.x, this.ally.y);
        if (!this.net2host) {
          this.net2Anchor(1, this.rivalActors[0].x, this.rivalActors[0].y);
          this.net2Anchor(2, this.rivalActors[1].x, this.rivalActors[1].y);
        }
      }
      // quién devuelve el SAQUE: el del equipo que recibe que quedó al fondo, en el lado del cuadro cruzado (el rival: `this.bot`, ver startPoint)
      this.serveReceiver = this.server === 'bot' ? (this.player.x <= this.ally.x ? this.player : this.ally) : this.bot;
      // (19-11-2026) LOG 2v2 online: quién saca y quién recibe en este teléfono (los dos deben coincidir)
      if (this.net2) this.diag?.log('serve2', { srv: this.server, iServe: this.net2IServe, srvActor: this.diag2Who(this.srvActor()), recv: this.diag2Who(this.serveReceiver), game: this.score.gameIndex, faults: this.faults, score: this.diag2Score() });
    }
    // PRUEBAS del DUELO EN LA RED: en el PRIMER juego (0-0 en juegos) el bot, tras devolver, se queda pegado a la red.
    // Se apaga con localStorage 'dev.botNet' = '0' (y no existe en red: el rival es el otro teléfono). Quitar al terminar las pruebas.
    const netTest = !this.net && !this.doubles && !this.tutorial && this.score.games[0] + this.score.games[1] === 0 && !devFlagOff('dev.botNet'); // (26-11-2026, usuario) no en el tutorial: ahí el bot varía sus tiros
    this.netTestOn = netTest;
    this.ai.homeX = null; // pegado a la red solo después del saque y su resto (update lo pone: serveLock)
    this.brain.netPractice = netTest; // y en ese juego solo peloteo suave a la red (BotBrain.netPractice)
    this.ai.reset(this.bot.x, this.bot.y);
    if (this.doubles) {
      const o2 = this.otherRival();
      const ob = o2 ? this.rivalBrains[this.rivalActors.indexOf(o2)] : null;
      if (o2 && ob) ob.ai.reset(o2.x, o2.y);
    }
    // en red: el suavizado del rival arranca desde su posición de saque (si no, volvía a sus últimas posiciones del
    // punto anterior y saltaba de vuelta al empezar el punto)
    if (this.net2 && this.ally) {
      // el invitado ve a su compañero (el host) como lly: sus posiciones de saque son las del host con los papeles cambiados
      // (los papeles de player / aliado ya se colocaron arriba, una sola vez: antes se intercambiaban dos veces y se anulaban)
      for (let k = 0; k < 3; k++) {
        const a = this.net2Actor(k);
        if (a) this.net2Anchor(k, a.x, a.y);
      }
    } else if (this.net) {
      this.netAnchor(this.bot.x, this.bot.y);
      this.diagCause = 'saque';
      // (21-11-2026, log online: saltos de 80-290 px en CADA punto) el rival ya no aparece de golpe en su sitio de saque: el dibujo se
      // desliza desde donde se le veía (NET_POINT_SLIDE_MS); la posición real ya es la del saque (solo cambia lo que se ve)
      const ox = prevBot.x - this.bot.x;
      const oy = prevBot.y - this.bot.y;
      const d = Math.hypot(ox, oy);
      this.netSnap = d > 6 && d < 520 ? { x: ox, y: oy, at: performance.now(), ms: NET_POINT_SLIDE_MS } : null;
    }
    this.holdBall();
  }

  /**
   * (21-11-2026, log online: tirones de ~90 ms en los DOS teléfonos a la vez, a mitad del partido) Precalienta los efectos que la GPU
   * compila la PRIMERA vez que se usan: el desenfoque de la cámara del aturdido (fx/stunFog.ts: postFX blur) y la matriz de color del
   * INFERNO (fx/InfernoFx.ts: preFX colorMatrix). Se encienden ~2 fotogramas al crear el partido, casi invisibles (en red, bajo la pantalla
   * VS; contra el bot, durante la presentación) y se quitan; así el shader ya está compilado cuando aparecen de verdad.
   */
  private warmUpShaders() {
    if (this.renderer.type !== Phaser.WEBGL) return;
    const cam = this.cameras.main;
    const blur = cam.postFX?.addBlur(0, 0.01, 0.01, 0);
    const probe = this.add.rectangle(4, 4, 8, 8, 0xffffff, 0.01).setScrollFactor(0).setDepth(-1000);
    const dot = this.textures.exists('__WHITE') ? this.add.image(4, 4, '__WHITE').setAlpha(0.01).setScrollFactor(0).setDepth(-1000) : null;
    dot?.preFX?.addColorMatrix();
    this.time.delayedCall(80, () => {
      if (blur) cam.postFX?.remove(blur);
      dot?.destroy();
      probe.destroy();
    });
  }

  private setActor(a: Actor, x: number, y: number) {
    a.x = x;
    a.y = y;
  }

  private holdBall() {
    const srv = this.srvActor();
    const s = this.ball.s;
    s.x = srv.x + srv.dir * 10;
    // NET de frente lanza con la mano libre a la derecha de la pantalla en ambos saques.
    const tossSide = srv.dir < 0 && srv.ch.skinId === 'net' ? 1 : srv.ch.facing;
    s.y = srv.y + tossSide * 28;
    s.z = 62;
    s.vx = s.vy = s.vz = 0;
    s.g = undefined;
  }

  /** Cuadro de saque diagonal que corresponde al sacador actual. */
  private computeServeBox() {
    const srv = this.srvActor();
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
    this.updateHud(); // (20-11-2026) respaldo: el marcador de arriba se actualiza con el splash; aquí queda seguro al día
    // en red, un saque / lanzamiento del rival puede adelantar el punto: la llamada retrasada ya no hace nada
    if (this.net && this.phase !== 'pointover' && this.phase !== 'intro') return;
    this.resetRallyClock();
    if (!secondServe) this.guidePracticeStep = 0;
    this.l2Freeze = null;
    this.l2Won = false;
    this.l2DefUsed = false;
    this.l2Running = false;
    this.l2Lock = false; // (25-11-2026) nivel 2: quieto solo tras tu devolución (el bot te tira al otro lado)
    this.l2Stage = 'serve';
    this.l2Hold = null;
    this.l2ServeAt = this.time.now + 1400;
    this.l2AimRelease();
    this.l2AimPause = 'none';
    this.spSt = 'serve';
    this.spBotPin = null;
    this.spLate = false;
    this.spDefVel = null;
    this.spDefRunning = false;
    this.g4Reset();
    this.g5Reset();
    this.spClock?.destroy();
    this.spClock = undefined;
    this.spHold = null;
    this.spPin = null;
    // (25-11-2026, usuario) puntos guiados: nivel 1 = saca el bot el 1.º y tú los otros 2; nivel 2 = sacas tú los 2. Después, el turno normal
    // por los puntos que cuentan (empiezas tú: 1 tú, 2 el bot, 2 tú)
    // (25-11-2026, usuario) nivel 3: sacas tú en P1 (cortita) y P2 (remate); en P3 saca el rival (lo respondes y luego su ESPECIAL)
    this.score.fixedServer = this.guide === 'first' && this.score.played < 3 ? (this.score.played === 0 ? 1 : 0) : this.guide === 'spin' && this.score.played < 3 ? 0 : this.guide === 'l3' && this.score.played < 4 ? (this.score.played === 2 ? 1 : 0) : this.guide === 'l4' && this.score.played < 3 ? (this.score.played === 0 ? 0 : 1) : this.guide === 'l5' && this.score.played < 4 ? (this.score.played < 2 ? 0 : 1) : null;
    this.level2PauseArmed = false;
    this.netNextSecond = false;
    this.rallyOutMarkPending = false;
    this.stopCharge();
    if (!secondServe) this.faults = 0;
    // el rival sortea su modo (NORMAL / CONCENTRADO / COMPETITIVO) al empezar cada punto
    if (!secondServe) this.brain.onPointStart(this.score.points, this.score.games);
    this.tutorialGuardPoint();
    // 2v2: el que saca y el que recibe primero es siempre el rival 1 (el activo vuelve a ser él); el 2.º rival también sortea su ánimo
    if (this.doubles && this.rivalActors.length === 2) {
      // saque alternado entre los dos rivales (cada juego que sacan, uno distinto). (19-11-2026, dobles reales) recibiendo, el del lado del
      // cuadro cruzado: cada rival tiene su lado FIJO (el 1.º, el de y < centro: puntos pares; el 2.º, el otro: puntos impares)
      const even = (this.score.points[0] + this.score.points[1]) % 2 === 0; // mismo lado que placeForServe (`side`)
      const idx = this.score.server === 1 ? Math.floor(this.score.gameIndex / 2) % 2 : even ? 0 : 1;
      this.bot = this.rivalActors[idx];
      this.brain = this.rivalBrains[idx];
      this.ai = this.brain.ai;
      this.useRivalKit(idx);
      if (!secondServe) this.rivalBrains[1 - idx].onPointStart(this.score.points, this.score.games);
      this.rivalSpecialUsed = false;
      this.allyDash = null;
      this.allyDashBall = false;
    }
    this.bot.ch.setSprint(false); // DASH del rival cortado por el fin del punto
    this.serving = false;
    this.lungeAt = 0;
    this.lastHitter = null;
    this.bounces = 0;
    this.ball.setPower(false);
    this.ball.setElement(this.smashEl);
    this.ball.setIgnited(false); // con el ESPECIAL armado la pelota sigue normal hasta tu golpe
    // INFERNO DRIVE: se puede volver a usar; lo que quedó armado sin ejecutarse se desarma (no se consume)
    if (this.inferno.armed) this.smashBtn.setArmed(false);
    this.inferno.onPointStart();
    this.infernoFlight = false;
    this.ultiOwner = null; // punto nuevo: las dos ULTIS vuelven a estar libres
    this.setControlsDim(1);
    this.ultiVictim = null;
    this.ultiLanded = false;
    this.ball.clearTrail();
    this.serveLet = false;
    this.serveNetLoss = false;
    this.serveCtl.reset();
    this.serveDirect = false;
    this.placeForServe();
    this.phase = 'serve';
    this.serveClock = this.meServes ? SERVE.timeLimit : 0; // 5 s para sacar (solo el jugador)
    this.serveClockText.setVisible(false);
    this.board?.setInfo(null);
    this.computeServeBox();
    // (25-11-2026, usuario) el cuadro de saque resaltado solo cuando sacas tú (ya no se marca dónde sacará el rival)
    if (this.meServes) this.showServeHint();
    else this.hideServeHint();
    // zona de colocación: la mitad de la línea de fondo del lado desde el que se saca
    const srvA = this.srvActor();
    this.serveZone = srvA.y > LAT_C ? [LAT_C + 10, COURT.bottom] : [COURT.top, LAT_C - 10];
    if (this.meServes) this.joy.release();
    else if (this.allyServes) {
      // el aliado bot saca solo, con el plan del rival (tipo, destino y momento del golpe)
      this.botPlan = this.serveAI.plan(this.faults, this.allyBrain?.ai.d ?? this.ai.d);
      this.allyTossAt = this.time.now + this.botPlan.wait * 1000;
    } else if (this.simBots && this.server === 'bot') {
      // el rival decide ya su saque (tipo, destino y momento) y se coloca antes de lanzar
      this.botPlan = this.planBotServe();
      this.brain.serveWait = this.botPlan.wait;
      this.botServeY = clamp(LAT_C + Math.sign(srvA.y - LAT_C) * rand(40, 150), this.serveZone[0], this.serveZone[1]);
    }
    this.setServeUi(this.meServes);
    if (this.tutorial && this.score.shortMatch && !secondServe && !this.winGoalShown && this.score.played === this.guidePracticeCount()) {
      this.winGoalShown = true;
      this.showWinGoal();
    }
    this.secondTag.setVisible(this.faults > 0);
    // menos textos: el turno lo indica la etiqueta SERVICIO sobre quien saca y el marcador ya mostró Iguales/Ventaja
    if (secondServe) showSideNotice(this, '2º servicio', 0xff9a1f, 1100); // aviso lateral (estilo único de avisos)
    // en red: lanzamiento del rival que llegó antes
    if (this.net && this.netPendingToss && this.netRemoteServes()) {
      const k = this.netPendingToss as ServeKind;
      this.netPendingToss = null;
      this.beginToss(k);
    }
  }

  // ---------------------------------------------------------------- saque manual
  private srvActor() {
    // 2v2 online: saca el humano que salió al azar (el otro, visto como compañero); contra bots, el aliado en sus juegos de saque (allyServes)
    if (this.server === 'player') return (this.net2 && !this.net2IServe) || this.allyServes ? (this.ally ?? this.player) : this.player;
    return this.bot;
  }

  /** ¿Se muestran los botones de saque? (turno de saque del jugador, hasta que golpea) */
  private serveUiOn() {
    return this.serveControlsOn;
  }

  /** Cambia entre los botones de saque y DASH/SMASH. */
  private setServeUi(on: boolean) {
    this.serveControlsOn = on;
    const lesson = this.guideServeLesson();
    this.serveNormalBtn.show(on && lesson !== 'tap' && lesson !== 'spin');
    // EFECTO PELOTA (saque con efecto) bloqueado por nivel: su botón no sale
    this.serveSpinBtn.show(on && (lesson === 'spin' || this.unlocked('spin')));
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
      // (25-11-2026, usuario) "NIVEL n" en el centro del botón (ya no debajo)
      btn.setSubLabel('');
      btn.setLockText(unlockLabel(key));
    }
  }

  /**
   * Pulsación de saque del jugador: 1ª lanza la pelota, 2ª (mismo tipo) golpea.
   * `fromTap` = toque en la mitad derecha de la pantalla (saque normal). Con el botón verde el saque
   * normal puede salir DIRECTO si se golpea en el punto máximo.
   */
  private onServeButton(kind: ServeKind, fromTap = false) {
    if (this.paused || this.server !== 'player' || !this.meServes || this.l2AimPause === 'on') return;
    // (25-11-2026, usuario) nivel 2, P1: tras lanzar, el golpe no se puede dar hasta que pase la pausa del reloj (si no, el 2.º toque rápido sacaba antes)
    if (this.aimPausePoint() && this.phase === 'toss' && this.l2AimPause === 'none') return;
    if (this.l2AimPause === 'wait') { // (25-11-2026, usuario) tras el reloj: P2 tocando la pantalla, P3 con el botón de SAQUE DIRECTO
      const ls = this.guideServeLesson();
      if ((ls === 'tap' && !fromTap) || (ls === 'direct' && fromTap)) return;
      this.l2AimRelease();
      if (this.phase === 'toss' && this.serveCtl.state === 'AIMING') this.beginSwing();
      return;
    }
    const lesson = this.guideServeLesson();
    if ((lesson === 'tap' && (!fromTap || kind !== 'normal')) || (lesson === 'direct' && (fromTap || kind !== 'normal')) || (lesson === 'spin' && kind !== 'spin')) return;
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
    if (this.meServes) this.net?.sendAction('toss', { kind });
    if (this.meServes) {
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
    const zc = s.z + s.vz * t - 0.5 * (s.g ?? GRAVITY) * t * t; // altura prevista de la pelota en el contacto
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

  /** (25-11-2026, usuario) desvío dentro de la zona del saque: 0 con la pasiva de PRECISIÓN; si no, al azar dentro de la zona, nunca en el centro */
  private serveZoneOffset(): { lat: number; dep: number } {
    if (this.passivePrecision > 0) return { lat: 0, dep: 0 };
    const b = this.serveBox;
    const h = b.y1 - b.y0;
    const halfCol = h / 6 / (h - 28); // media columna en unidades de aimT
    const halfRow = 0.22; // media fila (cada fila es la mitad del cuadro: 0,25), sin pisar las líneas
    const pick = () => (Math.random() < 0.5 ? -1 : 1) * rand(0.35, 0.8);
    return { lat: pick() * halfCol, dep: pick() * halfRow };
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
    const guided = (who === 'player' && !!this.guideServeLesson()) || (who === 'bot' && this.doingGuidePoint());
    const quality = guided ? 'perfect' : ctl.evaluate(s.z, s.vz);
    srv.ch.swing(); // asegura que la animación termina el golpe
    if (this.net && who === 'player') this.netHit = { charged: false, overhead: false, volley: false, serveSpin: kind === 'spin' };
    if (who === 'player' && kind === 'spin') this.tutMission('tSpinServe'); // (24-11-2026) misión del tutorial
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
      showSideNotice(this, 'Al aire', 0xff9a1f, 1100);
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
    const [eLat0, eDep0] = SERVE.error[quality];
    const pcut = who === 'player' ? 1 - this.passivePrecision : 1; // PRECISIÓN (pasiva de Mai): el saque se desvía menos
    const eLat = eLat0 * pcut;
    const eDep = eDep0 * pcut;
    const pAim = who === 'player' && !this.allyServes ? this.playerServeAim(kind) : null; // el aliado bot apunta con su plan (botPlan.aimT)
    const aimT = pAim ? pAim.aimT : this.botPlan.aimT;
    // saque DIRECTO: botón verde + golpe en el punto máximo
    const direct = who === 'player' && kind === 'normal' && this.serveDirect && quality === 'perfect';
    // botón verde sin dar en el aro: algo de directo (menos que el DIRECTO)
    const semiDirect = who === 'player' && kind === 'normal' && this.serveDirect && quality === 'normal';
    // toque (sin botón) en el aro: fuerte, sin directo ni efecto, un poco alto
    const tapPerfect = who === 'player' && kind === 'normal' && !this.serveDirect && quality === 'perfect';
    const bigSpin = kind === 'spin' && quality === 'perfect';
    this.serveDirect = false;
    // el DIRECTO es más rápido y plano; el destino es el centro de la zona elegida (sin ir más al fondo)
    const extraDepth = direct && !pAim ? SERVE.direct.depth - SERVE.depth.normal : 0;
    // (25-11-2026, usuario) el saque del jugador cae en la ZONA apuntada: con la pasiva de PRECISIÓN, en su centro; sin ella, en otro punto
    // de la zona al azar (nunca el centro). Solo el saque no perfecto suma además el error de siempre
    const zo = pAim ? this.serveZoneOffset() : null;
    const errL = zo ? zo.lat + (quality === 'perfect' ? 0 : g() * eLat) : g() * eLat;
    const errD = zo ? zo.dep + (quality === 'perfect' ? 0 : g() * eDep) : g() * eDep + extraDepth;
    let { tx, ty } = this.serveSpot(who, kind, aimT, errL, errD, pAim?.depthF);
    if (guided && !pAim) {
      tx = (this.serveBox.x0 + this.serveBox.x1) / 2;
      ty = (this.serveBox.y0 + this.serveBox.y1) / 2;
      if (who === 'bot' && this.guide === 'l4') ty = clamp(s.y + (this.player.y - s.y) * (tx - s.x) / (this.player.x - s.x), this.serveBox.y0 + 12, this.serveBox.y1 - 12); // (26-11-2026) hacia ti
      if (who === 'bot' && (this.guide === 'first' || this.guide === 'spin')) ty = clamp(s.y + (this.guideTargetY(this.serveBox.y0 < LAT_C ? -1 : 1) - s.y) * (tx - s.x) / (this.player.x - s.x), this.serveBox.y0 + 12, this.serveBox.y1 - 12);
    }
    let speed =
      SERVE_SPEED * SERVE.speed[quality][second] * (kind === 'spin' ? SERVE.spinSpeedMult : 1) * (direct ? SERVE.direct.speedMult : semiDirect ? SERVE.directPartial.speedMult : 1);
    const margin = direct
      ? SERVE.direct.margin
      : semiDirect
        ? SERVE.directPartial.margin
        : tapPerfect
          ? SERVE.tapPerfect.margin
          : kind === 'spin' && quality !== 'weak'
            ? SERVE.spinMargin
            : quality === 'perfect'
              ? 22
              : quality === 'normal'
                ? rand(8, 20)
                : rand(-4, 10);
    // (14-11-2026) el saque del RIVAL no sale en globo: los lentos (flojo / segundo saque) subían hasta ~340 de altura contra ~230 del perfecto. Se sube su velocidad hasta
    // que la altura máxima baje del tope. (El saque del jugador no cambia: un saque flojo suyo sigue siendo un castigo.)
    if (who === 'bot') speed = this.noLobServeSpeed(s, tx, ty, speed, margin);

    // el SAQUE nunca sale en globo: el vuelo solo puede alargarse un poco para pasar la red (si no, red / falta)
    aimShot(s, tx, ty, speed, margin, guided ? Infinity : SERVE_MAX_STRETCH);
    // (25-11-2026, usuario) saque a la FILA DE ABAJO (cerca de la red): un saque normal tendría que ir en globo para pasar la red
    // (vuelo 1,2-1,4 s, altura ~300); sale como los demás (~0,9 s) con CAÍDA tras la red
    if (pAim?.zone.row === 'short' && kind === 'normal') aimDipShot(s, tx, ty, Math.max(0.9, Math.hypot(tx - s.x, ty - s.y) / speed), Math.min(margin, 8));
    // (18-11-2026) el saque por toque en el aro ya NO se aplana: sale fuerte y un poco alto (SERVE.tapPerfect); el aplanado es del botón verde
    if (kind === 'spin') {
      // curva hacia el lado al que se apunta: se apunta antes para que la pelota bote donde se eligió.
      // El tiempo de vuelo cambia al desplazar el punto de apuntado, así que se itera hasta que converge.
      // en el aro: efecto GRANDE (más curva y más patada al botar)
      // (25-11-2026, usuario) curva suave hacia el lado del que saca (la pelota se ondula hacia ese lado)
      const ay = (bigSpin ? SERVE.spinBigAy : SERVE.spinAy) * (Math.sign(srv.y - LAT_C) || 1) * (who === 'player' ? 1 + this.passiveSpin : 1); // EFECTO de Mat
      let aimY = ty;
      for (let i = 0; i < 4; i++) {
        const T = (tx - s.x) / s.vx;
        aimY = ty - 0.5 * ay * T * T;
        aimShot(s, tx, aimY, speed, margin, guided ? Infinity : SERVE_MAX_STRETCH);
      }
      s.ay = ay;
    }
    // golpe defectuoso: la pelota sale más baja y puede ir a la red (falta), rozar la cinta (let) o quedarse corta
    if (!guided && Math.random() < SERVE.flawChance[quality]) s.vz -= rand(SERVE.flawDrop[0], SERVE.flawDrop[1]);
    this.ball.setKind(kind === 'spin' ? 'side' : 'normal', quality === 'perfect', who === 'player' ? this.trailLook : undefined);
    this.lastHitter = who;
    if (who === 'bot' && this.net2host) {
      this.netHitPending = true; // el saque de un bot del host: el invitado lo ve (golpe  = el bot)
      this.netHitA = this.rivalActors.indexOf(this.bot) + 1;
    }
    this.bounces = 0;
    this.serving = true;
    this.serveLet = false;
    this.phase = 'rally';
    if (who === 'player') this.ai.onPlayerHit(quality === 'perfect');
    else this.ai.onBotHit();
    // potencia real del saque (la velocidad que lleva) para el efecto de impacto
    const mult = SERVE.speed[quality][second] * (kind === 'spin' ? SERVE.spinSpeedMult : 1);
    this.hitFx(s.x, s.y, s.z, false, clamp((mult - 0.8) / 0.6, 0, 1), false, undefined, 'ball-saque-1');
    if (quality === 'perfect') this.perfectFx(s.x, s.y, s.z, direct, bigSpin);
    // Perfect Timing en el saque: el saque YA tiene su ventana perfecta y su bonus (SERVE.speed); aquí solo
    // se suma el feedback común (sonido + vibración), sin más potencia (evita acumular bonificaciones)
    if (quality === 'perfect' && who === 'player' && this.timingOn()) {
      vibrate(TIMING.fx.vibrateMs);
      if (TIMING.fx.sound) perfectSound(this);
    }
    if (who === 'player' && devFlagOn('dev.timingDebug')) console.info(`[timing] saque ${kind} calidad=${quality} vel=${speed.toFixed(0)} z=${s.z.toFixed(0)}`);
    this.announceServeSpeed(); // el que saca (tú, el aliado o el bot) y el que recibe ven la velocidad
  }

  /**
   * (21-11-2026, usuario) Aviso lateral con la VELOCIDAD DEL SAQUE ("SAQUE 182 KM/H", número y borde amarillo / verde / rojo según sea leve / bueno /
   * fuerte; config.ts SERVE_KMH). Sale al golpear el saque, en los tres casos: el tuyo y el del bot (executeServe) y el del rival online (se mide la
   * pelota que llega en su golpe, igual en los dos teléfonos). No sale en los saques que no pasan (al aire, a la red).
   */
  private announceServeSpeed() {
    const s = this.ball.s;
    const kmh = Math.round(Math.hypot(s.vx, s.vy) * SERVE_KMH.perUnit);
    const C = SERVE_KMH.colors;
    const color = kmh >= SERVE_KMH.strong ? C.strong : kmh >= SERVE_KMH.good ? C.good : C.light;
    // un momento después del golpe: la cuenta atrás del saque se está yendo del mismo sitio
    this.time.delayedCall(SERVE_KMH.delayMs, () => this.sys.isActive() && this.phase !== 'over' && showServeSpeedNotice(this, kmh, color, SERVE_KMH.holdMs));
  }

  /** Velocidad mínima del saque del rival para que su vuelo no suba más que BOT_SERVE_MAX_APEX (sin globos). */
  private noLobServeSpeed(s: BallState, tx: number, ty: number, speed: number, margin: number): number {
    // (15-11-2026) TOPE: antes la velocidad podía subir hasta 2,26 veces (14 pasos de ×1,06) cuando el golpe salía bajo (saque flojo o muy pronto):
    // un saque "flojo" salía más rápido que uno perfecto del jugador. Ahora no pasa del 25 % sobre el suyo ni de 1,25 × SERVE_SPEED, y nunca
    // por debajo de su velocidad normal. Si con ese tope aún sube un poco más, se acepta un vuelo algo alto antes que un cañonazo.
    const cap = Math.max(speed, Math.min(speed * 1.25, SERVE_SPEED * 1.25));
    let sp = speed;
    for (let i = 0; i < 14; i++) {
      const t = { ...s };
      aimShot(t, tx, ty, sp, margin, SERVE_MAX_STRETCH);
      const apex = t.z + (t.vz > 0 ? (t.vz * t.vz) / (2 * GRAVITY) : 0);
      if (apex <= BOT_SERVE_MAX_APEX || sp >= cap) break;
      sp = Math.min(cap, sp * 1.06);
    }
    return sp;
  }

  /** Efecto del saque perfecto: anillo azul neón y texto (dorado y más fuerte si es DIRECTO). */
  private perfectFx(bx: number, by: number, bz: number, direct = false, bigSpin = false) {
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
    this.popText(p.sx, p.sy - 50, bigSpin ? '¡SUPER EFECTO!' : '¡SAQUE PERFECTO!', '#7ff0ff', 38);
  }

  /** DASH y SMASH visibles pero bloqueados un momento tras sacar (evita pulsarlos sin querer). */
  private lockAbilities() {
    this.dashBtn.setEnabled(false);
    this.smashBtn.setEnabled(false);
    this.time.delayedCall(SERVE.abilityLock * 1000, () => {
      if (this.serveUiOn()) return; // ya se está sacando otra vez: los controla setServeUi
      this.dashBtn.setEnabled(this.unlocked('defensive') && (!this.spKind() || this.spDefWait()) && this.g4Point() === null);
      this.smashBtn.setEnabled(this.unlocked('special'));
    });
  }

  /** El jugador tiene SERVE.timeLimit segundos para sacar; los últimos 3 se muestran. Al agotarse: falta. */
  private tickServeClock(dt: number) {
    const st = this.serveCtl.state;
    if (this.serveAutoOnce) {
      if (this.phase !== 'toss' && this.phase !== 'serve') this.serveAutoOnce = false;
      else if (this.phase === 'toss' && st === 'AIMING' && this.ball.s.vz <= 0) {
        this.serveAutoOnce = false;
        this.onServeButton(this.serveCtl.kind ?? 'normal');
      }
    }
    // (18-11-2026, usuario) con la pelota ya lanzada ('toss') el reloj se PAUSA: lanzar en el último segundo ya no da falta por
    // tiempo con la pelota en el aire; si la atrapas (catchBall → 'serve') sigue contando desde donde iba
    const counting = !this.guideServeLesson() && this.serveClock > 0 && this.meServes && this.phase === 'serve' && st !== 'SWING' && st !== 'SERVE_RESULT';
    if (!counting) {
      this.serveClockText.setVisible(false);
      this.board?.setInfo(null);
      this.serveCountdown.hide();
      return;
    }
    this.serveClock -= dt;
    if (this.serveClock <= 0) {
      this.serveClock = 0;
      this.serveClockText.setVisible(false);
      this.board?.setInfo(null);
      this.serveCountdown.final('TIEMPO'); // en el mismo aviso lateral de la cuenta atrás (antes, cartel al centro)
      if (this.net2 && !this.net2host) this.net?.sendAction('serve-timeout'); // 2v2 online: el host juzga la falta (aquí no se lanzó nada que él vea)
      // (25-11-2026, usuario) nivel 2, P1, SEGUNDO saque: sin falta por tiempo; saca solo (lanza y golpea en lo alto)
      // (25-11-2026, usuario) también en los puntos guiados donde sacas tú (globo del nivel 2; cortita y remate del nivel 3): no descoordina el tutorial
      if (this.faults > 0 && ((this.guide === 'spin' && this.score.played === 0) || (!!this.spKind() && this.meServes))) {
        this.serveAutoOnce = true;
        this.onServeButton('normal', true);
        return;
      }
      this.tossFault();
      return;
    }
    // cuenta atrás del saque (5..1): solo en el aviso lateral. (21-11-2026, usuario) la píldora bajo el marcador queda SOLO con "JUEGO N":
    // ya no dice "SACA EN n" (ni otros datos)
    const n = Math.ceil(this.serveClock);
    if (n <= 5) {
      this.serveCountdown.show(n); // aviso lateral (donde sale DOBLE FALTA): 5-4 naranja, 3-2 rojo, 1 todo rojo
    }
  }

  /** La pelota lanzada baja sin que se golpee: el servidor la atrapa y puede lanzarla de nuevo (sin falta). */
  private catchBall() {
    // en red, el lanzamiento del rival lo resuelve su teléfono (llega 'catch')
    if (this.net && this.netRemoteServes() && !this.netApplying) return;
    if (this.net && this.meServes) this.net.sendAction('catch');
    this.serveCtl.reset();
    this.phase = 'serve';
    this.srvActor().ch.resetPose();
    this.serveAim.setVisible(false);
    if (this.meServes) this.setServeUi(true);
    else if (this.simBots && this.server === 'bot') {
      this.botPlan = this.planBotServe();
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
    this.netForceAuthority = this.meServes;
    this.serviceFault();
    this.netForceAuthority = false;
  }

  /** Let: la pelota rozó la cinta de la red y cayó en el cuadro. Se repite el saque sin falta. */
  private serveLetCall() {
    if (this.netGate('let')) return;
    this.serveLet = false;
    this.netNextSecond = this.faults > 0;
    this.phase = 'pointover';
    showSideNotice(this, 'Let', 0xff9a1f, 1000);
    this.time.delayedCall(1000, () => this.startPoint(this.faults > 0));
  }

  /**
   * Destino mientras se apunta (solo el jugador que saca): el cuadro de saque dividido en sus 6 zonas, la elegida
   * resaltada, y el punto de bote.
   */
  private renderServeAim() {
    const g = this.serveAim;
    const ctl = this.serveCtl;
    const on = this.meServes && this.phase === 'toss' && (ctl.state === 'TOSS' || ctl.state === 'AIMING');
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

  /**
   * Fin del partido con un DROP SHOT 0: la pelota sigue moviéndose (con la fase ya en 'over') hasta dar 2 botes en la cancha de `side` (o
   * 2,5 s como máximo) y entonces sale el final (`done`). null = nada pendiente.
   */
  private finaleBall: { side: Who; bounces: number; t: number; done: () => void } | null = null;

  /** Avanza la pelota del DROP SHOT 0 que dio el partido y lanza el final al segundo bote en la cancha de quien lo tiró. */
  private stepFinaleBall(dt: number) {
    const f = this.finaleBall;
    if (!f) return;
    f.t += dt;
    const sub = 3;
    for (let i = 0; i < sub; i++) {
      const px = this.ball.s.x;
      const vz0 = this.ball.s.vz;
      const ev = stepBall(this.ball.s, dt / sub);
      this.checkBackWall(px);
      if (ev !== 'bounce' || vz0 > -80) continue; // un bote de verdad (rodando no cuenta)
      this.bounceFx(this.ball.s.x, this.ball.s.y);
      const home = f.side === 'player' ? this.ball.s.x < NET_X : this.ball.s.x > NET_X;
      if (home) f.bounces++;
    }
    if (f.bounces >= 2 || f.t >= 2.5) {
      this.finaleBall = null;
      this.time.delayedCall(f.bounces >= 2 ? 250 : 0, f.done);
    }
  }

  /** DROP SHOT 0 que ya botó y vuelve hacia quien lo tiró (null = ninguno). Lo puede devolver el rival hasta que pase la red. */
  private dropZeroBack: Who | null = null;

  /**
   * (15-11-2026) DROP SHOT 0 de vuelta: si el rival lo devolvió (cambió quien golpeó) ya no cuenta; si la pelota volvió a pasar
   * la red hacia el lado de quien lo tiró sin que el rival la tocara, es su punto.
   */
  private checkDropZeroBack() {
    const w = this.dropZeroBack;
    if (!w) return;
    if (this.lastHitter !== w) {
      this.dropZeroBack = null;
      return;
    }
    const x = this.ball.s.x;
    const home = w === 'player' ? x < NET_X : x > NET_X;
    if (!home) return;
    this.dropZeroBack = null;
    this.ball.setMaxCharge(false); // (15-11-2026) vuelve a su cancha: ya es punto, la pelota pierde el resplandor y los rayos del máximo
    this.pointTo(w, '¡DROP SHOT 0!', w === 'player' ? '#bfffe0' : '#ff9aa3');
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
    // (18-11-2026) la bola de la ULTI o del ESPECIAL choca con la pared: ball-impacto-pared (antes ball-ulti-pared, solo ULTI)
    if (this.infernoFlight || wasPower) sfx(this, 'ball-impacto-pared');
    const wallEl: FxElement = this.infernoFlight ? this.infernoEl : this.smashFlightEl; // colores del poder de la bola (INFERNO o SMASH)
    // INFERNO DRIVE: al chocar con la pared se apaga la bola de fuego (vuelve la pelota normal)
    if (this.infernoFlight) {
      this.infernoFlight = false;
      this.infernoBounced = true;
      this.ball.setPower(false);
      this.ball.quietFx = false;
      this.fire.clear();
    }
    // (15-11-2026) ESPECIAL (cualquier poder: fuego, hielo, viento, rayo, sombra, luz): al chocar con la pared se le quita el
    // aspecto del poder y vuelve como pelota normal (antes rebotaba con la bola, la estela y el efecto del elemento)
    if (wasPower) {
      this.ball.setPower(false);
      this.ball.setIgnited(false);
      this.ball.setKind('normal');
      this.superFlight = false;
      this.smoke.clear();
      this.elementFx.clear();
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
    if (this.faults + 1 >= 2 && this.net && !this.netApplying && !(this.net2host || this.netForceAuthority || this.lastHitter === 'bot')) return; // (2v2 online: el host juzga todo, también el saque del invitado)
    this.serving = false;
    // (25-11-2026, usuario) nivel 2, P2 (lección del SAQUE CON EFECTO): fallar no suma falta ni da el punto; se repite el saque
    if (this.guide === 'spin' && this.score.played === 1) {
      this.phase = 'pointover';
      const h0 = this.headPos(this.srvActor());
      this.popText(h0.x, h0.y - 10, 'OTRA VEZ', '#ffc42e', 36);
      this.time.delayedCall(1100, () => this.startPoint(false));
      return;
    }
    this.faults++;
    const receiver: Who = this.lastHitter === 'player' ? 'bot' : 'player';
    if (this.faults >= 2) {
      this.pointTo(receiver, 'DOBLE FALTA', '#ff7a85');
      return;
    }
    this.phase = 'pointover';
    this.netNextSecond = true;
    // FALTA sobre quien sacó (como el ¡PERFECTO!), no en un cartel al centro
    const srv = this.srvActor(); // quien sacó (2v2 online: puede ser el compañero)
    const h = this.headPos(srv);
    this.popText(h.x, h.y - 10, 'FALTA', '#ffc42e', 36);
    this.time.delayedCall(1100, () => this.startPoint(true));
  }
  /**
   * (26-11-2026, usuario) EMOTES del rival bot (con SU cara): 2 puntos seguidos suyos = se ríe; pierde un juego = enojado o llorando.
   * Tutorial (partido corto): al llegar tú a 3 puntos, enojado o llorando, solo en 2 de cada 3 partidas (`tut3`).
   */
  private botEmoteOnPoint(w: Who, botLostGame = false) {
    const e = this.botEmotes;
    e.won[w === 'player' ? 0 : 1]++;
    e.run = w === 'bot' ? e.run + 1 : 0;
    let kind: 'happy' | 'wow' | 'cry' | null = null;
    if (w === 'bot' && e.run === 2) kind = 'happy';
    else if (w === 'player' && botLostGame && !this.score.shortMatch) kind = Math.random() < 0.5 ? 'wow' : 'cry';
    else if (w === 'player' && this.score.shortMatch && this.tutorial && e.tut3 && this.score.points[0] === 3) {
      e.tut3 = false;
      kind = Math.random() < 0.5 ? 'wow' : 'cry';
    }
    if (!kind) return;
    const k = kind;
    // un instante después del punto, como una reacción
    this.time.delayedCall(Phaser.Math.Between(500, 1100), () => {
      if (this.sys.isActive()) this.emotes.showRemote(k, () => this.headPos(this.bot), this.skinOf(this.bot));
    });
  }


  /**
   * (24-11-2026, usuario) Tutorial que se gana siempre (hasta el nivel 9, domain/tutorialMatch.ts): en los puntos libres el bot tira fuera más
   * cuanto mejor va (empatados la mitad, ganando siempre). No toca los puntos guiados (el guion manda).
   */
  private tutorialGuardPoint() {
    const lv = getPlayer().level;
    const on = this.tutorial && !this.doingGuidePoint();
    const chance = on ? botForcedOutChance(lv, this.score.points[0], this.score.points[1]) : 0;
    for (const b of this.doubles ? this.rivalBrains : [this.brain]) b.forceOut = chance;
  }

  /** (22-11-2026, usuario) los espectadores que aplauden (ambiente-2) lo hacen solo al ganarse un punto */
  private spectatorsCheer: (() => void) | null = null;
  private pointTo(w: Who, reason: string, color: string) {
    if (this.phase !== 'rally') return;
    if (this.netGate('point', w, reason, color)) return;
    if (this.practicingReturns()) {
      // (25-11-2026, usuario) DOBLE FALTA en la práctica: no hay pelota que devolver (antes el bot "respondía" el saque fallado y
      // quedaban dos pelotas): se repite el saque desde el primero
      if (reason === 'DOBLE FALTA') {
        this.phase = 'pointover';
        this.faults = 0;
        this.time.delayedCall(1100, () => this.startPoint(false));
        return;
      }
      this.feedPracticeReturn();
      return;
    }
    if (this.spRetry(w)) return;
    if (this.g4Retry(w)) return;
    if (this.g5Retry()) return; // (26-11-2026, usuario) nivel 5 guiado sin terminar // (26-11-2026, usuario) nivel 4 guiado sin terminar: OTRA VEZ // (25-11-2026, usuario) punto guiado sin terminar: el bot la tira otra vez
    if (this.lessonPractice()) {
      this.feedLessonBall(); // (24-11-2026) ejercicio del nivel 3 / 4: la pelota vuelve hasta terminarlo
      return;
    }
    // (25-11-2026, usuario) el tutorial ya no repite el punto: si pierdes el partido, se repite el nivel (sin EXP ni premios: MatchEndScene)
    this.coach.cancel(); // (24-11-2026) el punto terminó: el turno del ejercicio en curso se cancela
    if (this.guide === 'first' && this.score.played === 2 && w === 'player') this.guideMission('guideDirectServe');
    // (25-11-2026, usuario) nivel 2, P1: la alerta "Usar defensivo" al ganar el punto, antes del marcador
    if (this.guide === 'spin' && this.score.played === 0 && w === 'player' && this.l2DefUsed) this.tutMission('t02Def', 'Usar defensivo');
    // (log) solo el punto que se aplica de verdad (antes se anotaba también el que decide el otro teléfono)
    this.diag?.log('point', { w, reason, score: `${this.score.points.join('-')} / ${this.score.games.join('-')}` });
    // MISIONES POR PARTIDA: antes de limpiar el estado del punto (duelo, rival volando, cadena ESPECIAL → GLOBO).
    // (23-11-2026, usuario) también en el 2v2, las mismas (allí no hay DUELO RED; ¡A LAS ESTRELLAS! vale con cualquiera de los dos rivales)
    if (this.guide !== 'first' && !this.tutMissions) {
      const rivalLaunched = this.doubles ? this.rivalActors.some((a) => !!a.launched) : !!this.bot.launched;
      const fresh = missionPoint(this.missions, { winner: w === 'player' ? 'player' : 'rival', reason, rivalLaunched, duel: this.duelUsed });
      fresh.forEach((id, i) => this.time.delayedCall(350 + i * 120, () => this.sys.isActive() && this.phase !== 'over' && showMissionAlert(this, missionDef(id).title, missionReward(missionDef(id), this.doubles)))); // 2v2: lo que paga en monedas 2v2
    }
    if (this.doubles) {
      const who = this.lastActorBySide[w];
      if (who === this.player) this.pointStats.me++;
      else if (who && who === this.ally) {
        this.pointStats.ally++;
        if (w === 'player') this.tutMission('tTeamPoint'); // (24-11-2026) misión del tutorial
      }
      else if (who && who === this.rivalActors[0]) this.pointStats.r1++;
      else if (who && who === this.rivalActors[1]) this.pointStats.r2++;
    }
    if (w === 'player' && ++this.tutPointsWon >= 3) this.tutMission('tPoints3'); // (24-11-2026) misiones del tutorial
    if (w === 'player' && reason === '¡DROP SHOT 0!') this.tutMission('tDrop0');
    this.duelAbort('point'); // punto decidido (también el que llega por red): el duelo en curso se cancela
    this.phase = 'pointover';
    this.resetRallyClock();
    this.spectatorsCheer?.(); // (22-11-2026, usuario) aplauden en cada punto, gane quien gane (tambien el que llega por red)
    this.slowmoAbort(); // TIEMPO LENTO a medias: tiempo, cámara y personaje normales
    this.dropZeroBack = null;
    this.maxPushOn = null;
    this.stopCharge();
    this.disarmUnusedSmash(); // ESPECIAL armado que no se usó en el punto: se desarma y queda listo otra vez
    this.netRivalArmed = false; // (red) el del rival también
    this.net2MateArmed = false; // (2v2 online) y el del compañero
    // marcador antes del punto (el centro muestra el cambio: 30 → 40)
    const prevLabels = this.score.labels();
    const prevGames: [string, string] = [String(this.score.games[0]), String(this.score.games[1])];
    // (25-11-2026, usuario) los puntos guiados también CUENTAN (antes no sumaban: Score.pointTo practice)
    const res = this.score.pointTo(w === 'player' ? 0 : 1);
    if (!this.net) this.botEmoteOnPoint(w, res.gameWinner === 0);
    this.netPlaced = false; // (red) los estados que mande desde ahora son del punto siguiente, aún sin colocarse
    // ZONA: el punto jugado consume un turno de Zona; quien va perdiendo por 2 con 2+ puntos ganados (o va 0-40) puede entrar
    const zr = this.zone.onPoint(w, res.gameWinner !== null);
    for (const sd of zr.ended) this.zoneFx[sd]?.stop();
    if (zr.entered) this.zoneStart(zr.entered);
    if (w === 'player') this.onInfernoPoint();
    else for (const b of this.doubles ? this.rivalBrains : [this.brain]) b.onPointWon(); // la ULTI del rival se carga igual: 3 puntos ganados (en 2v2 la carga es de los dos)
    if (w === 'player' && this.doublesOffline) this.allyBrain?.onPointWon(); // (23-11-2026) la ULTI del ALIADO bot: 3 puntos ganados por tu equipo
    // el motivo (FUERA, RED, DOBLE FALTA…) va dentro del marcador central, no flotando junto al jugador
    const why = reason === '¡PUNTO!' || reason === 'Punto rival' ? null : reason.replace(/[¡!]/g, '');
    void color;
    // (20-11-2026, usuario) el marcador de arriba cambia A LA VEZ que la cifra del marcador del centro (onChange del splash);
    // al terminar el partido no hay splash: se actualiza ya
    if (res.matchWinner !== null) this.updateHud();

    if (res.matchWinner !== null) {
      const win = res.matchWinner === 0;
      if (win) this.tutMission('tWin'); // (24-11-2026) misión del tutorial "Gana el partido"
      // (18-11-2026, usuario) victoria AJUSTADA (el perdedor ganó algún juego, p. ej. 2-1): celebra de rodillas, "¡VAMOS!"
      // (19-11-2026, usuario) en el 2v2, los CUATRO: celebra la pareja ganadora y la otra hace su derrota
      const close = this.score.shortMatch ? Math.min(...this.score.points) >= 3 : Math.min(this.score.games[0], this.score.games[1]) > 0;
      const tm = this.teams();
      for (const a of win ? tm.mine : tm.rivals) a.ch.victory(close);
      for (const a of win ? tm.rivals : tm.mine) a.ch.defeat();
      this.phase = 'over'; // ya terminó: el fin oficial del servidor (red) no vuelve a lanzar endMatch a mitad del final
      // FIN DEL PARTIDO con espectáculo (fx/matchFinale.ts): marcador final, sello, confeti / ceniza y sonido; luego la
      // pantalla de resultados de siempre
      const finale = () => {
        if (!this.sys.isActive()) return;
        this.diag?.log('end-pose', { at: 'finale', win, me: this.diagActor(this.player), rival: this.diagActor(this.bot) });
        playResultMusic(this, win); // el soundtrack del partido se corta ya: suena el de victoria / derrota
        this.hideMatchUi(); // (14-11-2026) solo el final: fuera marcador, joystick, botones, rendirse y emojis
        // (21-11-2026, usuario) JUEGO, SET Y PARTIDO: la cámara deja de seguir al jugador y se asienta al centro del ambiente
        this.cameras.main.pan(VIEW.W / 2, this.cameras.main.height / 2, 700, 'Sine.easeInOut', true);
        const ms = playMatchFinale(this, { win, playerName: this.doubles ? `${getProfile().name} / ${this.allyName}` : getProfile().name, rivalName: this.doubles ? `${this.botName} / ${this.rival2Name}` : this.botName, games: this.score.shortMatch ? [...this.score.points] : [...this.score.games] });
        this.time.delayedCall(ms + 150, () => this.endMatch(win));
      };
      // (21-11-2026) DROP SHOT 0 que da el partido: el punto se cuenta al cruzar la red de vuelta, pero el final espera a que la pelota bote en
      // la cancha de quien lo tiró y dé otro bote (se ve que volvió). Mientras, la pelota sigue (finaleBall en update). Usuario, bot y online
      // (el teléfono que recibe el punto también lo ve con el mismo motivo).
      if (reason === '¡DROP SHOT 0!') {
        this.finaleBall = { side: w, bounces: 0, t: 0, done: finale };
        return;
      }
      finale();
      return;
    }
    // reacción al punto (hojas nuevas de NXO; no-op para el resto)
    // (18-11-2026, usuario: "no usa el sprite de ganar / perder punto") la carrera (inercia, IA) o la carga la cortaban al instante:
    // se paran antes y durante 'pointover' no se mueven (ver `frozen` y el bot en update)
    for (const a of this.everyone()) {
      a.ch.setMoving(false, 0);
      a.ch.setCharging(false);
      a.ch.setReady(false);
    }
    stopMotion(this.motion);
    this.player.ch.pointEnd(w === 'player', w === 'player' && this.epicPoint);
    this.bot.ch.pointEnd(w === 'bot');
    if (this.doubles && this.ally) {
      this.ally.ch.pointEnd(w === 'player');
      this.otherRival()?.ch.pointEnd(w === 'bot');
    }
    // marcador en mitad de la pantalla (~2 s): puntos, o JUEGOS cuando se gana un juego; aviso de punto de partido
    // (21-11-2026, usuario) 2v2: salen los 4 nombres, cada pareja con ' / ' entre los dos (antes solo el tuyo y el del rival 1)
    const names = this.doubles ? { playerName: `${getProfile().name} / ${this.allyName}`, rivalName: `${this.botName} / ${this.rival2Name}`, winner: w } : { playerName: getProfile().name, rivalName: this.botName, winner: w };
    const mp = this.score.shortMatch ? this.score.points.some((p) => p === 3) : isMatchPoint(this.score.points, this.score.games);
    if (res.gameWinner !== null) {
      const g2 = this.score.games;
      this.time.delayedCall(250, () =>
        showPointSplash(this, { ...names, labels: [String(g2[0]), String(g2[1])], prevLabels: prevGames, title: 'JUEGOS', status: null, matchPoint: false, onChange: () => this.updateHud() }),
      );
      if (mp) this.time.delayedCall(450, () => showSideNotice(this, 'Punto de partido', 0xff3b4e, 1800));
      this.time.delayedCall(250 + POINT_SPLASH_MS + 100, () => this.startPoint());
      return;
    }
    const status = [why, this.score.status()].filter(Boolean).join(' · ') || null;
    this.time.delayedCall(250, () => showPointSplash(this, { ...names, labels: this.score.labels(), prevLabels, status: null, matchPoint: false, onChange: () => this.updateHud() }));
    // qué pasó (DOBLE FALTA, FUERA, IGUALES…) y PUNTO DE PARTIDO: avisos que entran desde la izquierda
    if (status) this.time.delayedCall(450, () => showSideNotice(this, status, 0xffd23f, 1600));
    if (mp) this.time.delayedCall(650, () => showSideNotice(this, 'Punto de partido', 0xff3b4e, 1600));
    this.time.delayedCall(250 + POINT_SPLASH_MS + 100, () => this.startPoint());
  }

  /**
   * (14-11-2026) JUEGO, SET Y PARTIDO: se apaga (fundido) TODA la interfaz fija en pantalla (scrollFactor 0: marcador,
   * joystick, botones de golpe / habilidades / saque, rendirse, emojis, avisos y botones de prueba) y deja de responder.
   * Lo que crea el final después (fx/matchFinale.ts) no se toca.
   */
  private hideMatchUi() {
    this.joy.release();
    this.joy.enabled = false;
    this.emotes.setVisible(false);
    for (const o of [...this.children.list]) {
      const sf = o as unknown as { scrollFactorX?: number; visible?: boolean; alpha?: number };
      if (sf.scrollFactorX !== 0 || !sf.visible) continue;
      o.disableInteractive?.();
      if (o instanceof Phaser.GameObjects.Container) o.each((c: Phaser.GameObjects.GameObject) => c.disableInteractive?.());
      this.tweens.add({ targets: o, alpha: 0, duration: 250, onComplete: () => (o as unknown as Phaser.GameObjects.Components.Visible).setVisible?.(false) });
    }
  }

/** (19-11-2026) las dos parejas (1v1: tú y el rival; 2v2: tú + tu compañero y los 2 rivales) para las poses del final */
  private teams(): { mine: Actor[]; rivals: Actor[] } {
    const mine = this.doubles && this.ally ? [this.player, this.ally] : [this.player];
    const rivals = this.doubles && this.rivalActors.length ? [...this.rivalActors] : [this.bot];
    return { mine, rivals };
  }

  /** `rivalLeft` (19-11-2026): el RIVAL humano se rindió o se fue (1v1 online): EXP 95 si ganaste al menos un juego, si no 0 */
  private endMatch(win: boolean, surrendered = false, rivalLeft = false) {
    this.duelAbort('end');
    this.phase = 'over';
    this.resetRallyClock();
    playResultMusic(this, win); // (rendición / fin del servidor: aquí; tras el final con espectáculo ya suena y no se reinicia)
    // poses finales aseguradas: si algo cortó la celebración / derrota (p. ej. un estado del rival en red), se vuelven a
    // poner antes de la pantalla de resultados (que usa esas mismas poses en sus cuadros)
    // (19-11-2026, usuario) en el 2v2, los CUATRO (cada pareja con su pose)
    const tm = this.teams();
    if (!surrendered) {
      for (const a of win ? tm.mine : tm.rivals) if (a.ch.debugInfo()?.state !== 'victory') a.ch.victory();
      for (const a of win ? tm.rivals : tm.mine) if (a.ch.debugInfo()?.state !== 'victory') a.ch.defeat(); // (defeat usa el mismo estado 'victory')
    }
    this.diag?.log('end-pose', { at: 'result', win, me: this.diagActor(this.player), rival: this.diagActor(this.bot) });
    this.diag?.flush();
    // final cinematográfico sobre el mismo mapa (fx/matchEnd.ts + scenes/MatchEndScene.ts)
    playMatchEnd(this, {
      winner: (win ? this.player : this.bot).ch,
      loser: (win ? this.bot : this.player).ch,
      ...(this.doubles ? { mate: this.ally?.ch, rival2: this.otherRival()?.ch } : {}),
      data: {
        win,
        surrendered,
        ...(rivalLeft ? { rivalLeft: true } : {}),
        playerName: this.doubles ? `${getProfile().name} / ${this.allyName}` : getProfile().name,
        rivalName: this.doubles ? `${this.botName} / ${this.rival2Name}` : this.botName,
        playerGames: this.score.shortMatch ? this.score.points[0] : this.score.games[0],
        rivalGames: this.score.shortMatch ? this.score.points[1] : this.score.games[1],
        guide: this.guide,
        ...(this.tutorial ? { tutorial: true } : {}), // (24-11-2026) un nivel por partido (MatchEndScene)
        ...(this.tutMissions ? { missionList: [...this.tutMissions], ...(this.tutMissionsRequired ? { missionsRequired: true } : {}) } : {}), // (24-11-2026) misiones del tutorial de este nivel
        botName: this.botName,
        rivalLevel: this.rivalLevel,
        rivalSkin: this.rivalPick ?? undefined, // (25-11-2026) la revancha, con el mismo rival
        ...(this.doubles ? { doubles: { allyName: this.allyName, rival2Name: this.rival2Name, duo: this.duo ?? undefined }, pointStats: this.bot === this.rivalActors[1] ? { ...this.pointStats, r1: this.pointStats.r2, r2: this.pointStats.r1 } : { ...this.pointStats } } : {}),
        lan: !!this.net,
        // MISIONES POR PARTIDA cumplidas (MatchEndScene las paga en ADICIONALES); en 2v2 no hay
        missions: [...this.missions.done], // (23-11-2026, usuario) también en el 2v2: sección ADICIONALES al final del resultado
      },
    });
  }

  /** Aviso al pulsar una habilidad durante el saque o su resto. Devuelve false (no se usó). */
  /** Sin raqueta (ULTI recibida): ni habilidades ni golpes hasta recogerla. */
  private noRacketHint(): false {
    const h = this.headPos(this.player);
    // (21-11-2026, usuario) solo "RAQUETA" con el icono de advertencia (antes "¡Recoge tu raqueta!")
    const t = this.add.text(0, 0, 'RAQUETA', textStyle(26, '#ffd23f')).setOrigin(0, 0.5);
    const left = -(36 + t.width) / 2; // icono (36 px) + texto, centrados en el aviso
    t.setX(left + 36);
    const ig = this.add.graphics({ x: left + 17, y: 1 });
    drawWarningIcon(ig, 15, 0xffd23f);
    const c = this.add.container(h.x, h.y, [ig, t]).setDepth(4000).setScale(0.3);
    this.tweens.add({ targets: c, scale: 1, y: h.y - 50, duration: 350, ease: 'Back.easeOut' });
    this.tweens.add({ targets: c, alpha: 0, delay: 650, duration: 250, onComplete: () => c.destroy() });
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
    // sin raqueta tampoco hay habilidades; ni durante el DUELO RED (hasta que sale el globo)
    // (18-11-2026, usuario) ni ATURDIDO: los botones se apagan mientras dura el aturdimiento y vuelven al terminar
    // (25-11-2026, usuario) en los puntos guiados (globo, cortita, remate...) tampoco: se ven en gris
    const lock = this.serveLock || !!this.player.racket || !!this.duel || this.player.stun > 0 || (!!this.spKind() && !this.spDefWait()) || this.g4LockAbilities() || (this.g5Point() !== null && !(this.g5Point() === 3 && this.g5St === 'spwait'));
    // (26-11-2026, usuario) nivel 4, P1: el ESPECIAL se ve ENCENDIDO al pedirlo (aunque sea el resto del saque); DEFENSIVO apagado en los 3 guiados
    const g4Spec = (this.g4Point() === 0 && this.g4St === 'wait') || (this.g5Point() === 3 && this.g5St === 'spwait');
    const want = (btn: AbilityButton, key: UnlockKey, extraLock = false, force = false) => {
      const on = force || (!lock && !extraLock && this.unlocked(key));
      if (btn.enabled !== on) btn.setEnabled(on);
    };
    want(this.dashBtn, 'defensive', this.g4Point() !== null);
    // en modo ULTI el botón del ESPECIAL usa el desbloqueo de la ULTI; y (21-11-2026, usuario) sin ULTI contra ULTI: si el rival lanzó la suya
    // primero, la tuya queda apagada hasta que el que recibe su golpe recupere la raqueta
    want(this.smashBtn, this.smashBtn.inferno ? 'ulti' : 'special', this.smashBtn.inferno && this.ultiBlocked('player'), g4Spec);
  }

  /** ¿La habilidad está desbloqueada para tu nivel? (domain/unlocks.ts; en modo desarrollo el perfil es nivel 20) */
  private unlocked(key: UnlockKey) {
    // (24-11-2026, usuario) partido en red antes del nivel 20 = con AMIGOS (el JUGAR del tutorial es contra el bot): todas las habilidades
    if (this.net && !isDevMode() && getPlayer().level < MAX_LEVEL) return true;
    // (26-11-2026, usuario) CARGANDO GOLPE en el partido desde el nivel 4 (se enseña en su partido guiado); los 3 puntos guiados lo
    // controlan aparte (g4ChargeOk). El DROP SHOT 0 (carga + joystick abajo) recién desde el nivel 5 (chargeDropOk)
    if (key === 'charge' && getPlayer().level >= CHARGE_PLAY_LEVEL && this.g4Point() === null) return true;
    return isUnlocked(key, getPlayer().level);
  }

  /** (26-11-2026, usuario) DROP SHOT 0 del jugador (carga + abajo): en el tutorial se enseña en el nivel 5 */
  private chargeDropOk() {
    return !this.tutorial || getPlayer().level >= CHARGE_PLAY_LEVEL + 1;
  }
  private botAbilityUnlocked(key: 'defensive' | 'special' | 'ulti') {
    if (isDevMode() || this.net) return true;
    if (this.guide && key !== 'defensive') return false;
    return this.unlocked(key);
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
    // DUELO EN LA RED: durante el cara a cara el toque es el del duelo; en el resto del duelo no se hace nada
    if (this.duel) {
      if (!this.paused) this.duelTap();
      return;
    }
    if (this.g4Point() !== null && (!this.g4ChargeOk() || this.charging)) return;
    if (this.g5Point() !== null && (this.g5St !== 'charge' || this.charging)) return; // (26-11-2026, usuario) nivel 5: cargar solo cuando se pide // (26-11-2026, usuario) nivel 4: cargar solo cuando se pide (y sin cancelarla)
    // (25-11-2026, usuario) nivel 2, P3 GLOBO: mientras se explica o se espera el joystick, los toques no hacen nada
    if (((this.spSt === 'approach' || this.spSt === 'hold' || this.spSt === 'defwait' || this.spSt === 'approach2') && !!this.spKind()) || this.spSpecialLock()) return; // (y nivel 3: CORTITA y REMATE)
    // REMATE en curso: el toque es el golpe
    if (this.remateCine && !this.paused) {
      this.remateHit();
      return;
    }
    if (this.paused || this.cineLock) return;
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
    if (!this.unlocked('charge') && !this.practiceChargeLimit() && !this.g4ChargeOk()) return;
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
    // primero la carga CLÁSICA (aro + brillo); la elegida entra a ~1 s (renderCharge)
    this.chargeSpriteOn = false;
    this.chargeRing.setVisible(true);
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
   * (contacto − TIMING.idealLeadMs). Al tocar (empezar a cargar) desaparece.
   */
  private updateTimingRing() {
    const pl = this.player;
    const b = this.ball;
    const show =
      getSettings().timingGuide &&
      this.phase === 'rally' &&
      !this.serving &&
      !this.charging &&
      !this.cineLock &&
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

  /** Sonido del tornado de la ULTI HURACÁN (tornado-1): arranca con el tornado y se corta en el golpe final o al cerrar la cinemática. */
  private tornadoSnd: Phaser.Sound.BaseSound | null = null;
  private tornadoSndStart() {
    this.tornadoSndStop(false);
    if (!this.cache.audio.exists('tornado-1')) return;
    this.tornadoSnd = this.sound.add('tornado-1', { volume: 0.8 });
    this.tornadoSnd.play();
  }
  private tornadoSndStop(fade: boolean) {
    const s = this.tornadoSnd;
    this.tornadoSnd = null;
    if (!s) return;
    // el cierre de 120 ms va en tiempo real (la cinemática pausa los tweens de la escena)
    if (fade) {
      const t0 = performance.now();
      const step = () => {
        const k = (performance.now() - t0) / 120;
        if (k >= 1 || !this.sys.isActive()) {
          s.stop();
          s.destroy();
          return;
        }
        (s as Phaser.Sound.WebAudioSound).volume = 0.8 * (1 - k);
        setTimeout(step, 16);
      };
      step();
    } else {
      s.stop();
      s.destroy();
    }
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

  /** (21-11-2026, usuario) atenúa los controles del jugador (joystick, DASH/ESPECIAL, saques, emotes, rendirse, AUTO) mientras dura la ULTI. */
  private controlsDim = 1;
  private setControlsDim(k: number) {
    this.controlsDim = k;
    this.joy?.setDim(k);
    for (const b of [this.dashBtn, this.smashBtn, this.serveNormalBtn, this.serveSpinBtn, this.surrenderBtn, this.autoBtn] as unknown as ({ setAlpha(a: number): unknown } | undefined)[]) b?.setAlpha(k);
    this.emotes?.setAlpha(k);
  }

  private updateCharge(dt: number) {
    if (!this.charging) return;
    const prev = this.charge;
    this.charge = Math.min(this.practiceChargeLimit() || 1, this.charge + dt / 1.1);
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
    // ~1 s cargando con la CLÁSICA (la de todos) y luego la ELEGIDA (si tiene una con sprites): se apaga la clásica
    if (this.charging && !this.chargeSpriteOn && isSpriteCharge(this.chargeKind) && this.charge >= 0.9) {
      this.chargeSpriteOn = true;
      this.chargeRing.setVisible(false);
      this.chargeAura.hide();
      this.chargeSparks.hide();
    }
    const sprite = isSpriteCharge(this.chargeKind) && this.chargeSpriteOn;
    // (26-11-2026, usuario) con el oscurecido del tutorial, la carga (aro / sprites y medidor) también se ve, como tu personaje
    const boost = this.player.depthBoost ?? 0;
    this.chargeMeter.setDepth(boost ? 6080 : 4400);
    // efecto con sprites: también se dibuja al soltar (se disipa con sus últimos frames)
    if (sprite) {
      if (this.charging) this.chargeSprite.setCharge(this.charge);
      this.chargeSprite.render(dt, p.sx, p.sy, p.s, p.sy + boost);
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
        .setDepth(p.sy - 0.8 + boost);
    }
    // indicador único sobre la cabeza: potencia + dirección real
    const h = this.headPos(this.player);
    this.chargeMeter.setValue(this.charge);
    // flecha del golpe; cortita / globo en diagonal = flecha inclinada hacia ese lado
    this.chargeMeter.setShot(this.shotFromJoystick(), this.shotSide());
    // (20-11-2026, usuario) más arriba: chocaba con el sprite (la raqueta levantada de la carga); centrado en el personaje
    const mk = Phaser.Math.Clamp(p.s / 1.45, 0.8, 1);
    this.chargeMeter.place(p.sx, h.y - 10 - 38 * mk, mk);
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
    // DROP SHOT 0: este bote es el que la devuelve (Ball.stepBall)
    const dropZero = !!s.backBounced;
    s.backBounced = undefined;
    this.bounceFx(s.x, s.y);
    if (dropZero) {
      const g = project(s.x, s.y, 0);
      dropZeroBounceFx(this, g.sx, g.sy, g.s);
    }
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
        if (this.g4Point() === 0 && this.server === 'player') this.g4St = 'fly'; // (26-11-2026, usuario) nivel 4, P1
        else if (this.g5Point() !== null && this.server === 'player') this.g5St = 'fly'; // (26-11-2026, usuario) nivel 5
        else if (this.spKind() && this.server === 'player') this.spSt = 'fly'; // (25-11-2026, usuario) punto guiado: tu saque va al bot (tickScripted)
        else if (this.practicingReturns() && this.server === 'player') {
          // (25-11-2026, usuario) nivel 2, P1: tu saque va al bot (tickGuide 'fly') y te tira fuerte al otro lado (quieto: solo queda el DEFENSIVO)
          if (this.guide === 'spin') { this.l2Stage = 'fly'; this.l2Lock = true; }
          else this.feedPracticeReturn();
        }
        else if (this.lessonPractice()) this.feedLessonBall();
        else if (this.serveLet) this.serveLetCall();
      } else {
        this.outMark(s.x, s.y);
        this.serviceFault();
      }
      return;
    }
    // (25-11-2026, usuario) nivel 2: el tiro esquinado del bot bota en tu lado y el tiempo se para (pausa del DEFENSIVO)
    // (se arma en el bote y se para cuando la pelota ya se levanta: tickGuide)
    if (this.guide === 'spin' && this.practicingReturns() && this.l2Stage === 'fed' && this.lastHitter === 'bot' && s.x < NET_X && this.bounces === 0) this.level2PauseArmed = true;
    if (this.guide === 'first' && this.score.played === 0) {
      const r = this.guideRally;
      // tu golpe va derecho a la raqueta del bot (tickGuide la detiene en lo alto de su bote, delante de él): su bote no cuenta
      if (this.guideMove === 3 && r.st === 'fly') {
        if (s.x > NET_X) r.bounced = true;
        return;
      }
      if (this.guideMove === 3 && r.st === 'wait') return;
      // no le pegaste (dio 2 botes en tu lado): el bot la tira otra vez al mismo sitio
      if (this.guideMove === 3 && (r.st === 'serve' || r.st === 'feed') && this.bounces > 0) {
        this.guideFeed(this.guideRallyZone(Math.max(1, r.k)));
        r.st = 'feed';
        return;
      }
    }
    if (this.guide === 'first' && this.score.played === 2 && this.lastHitter === 'player' && this.bounces > 0) {
      this.guideDirectReturn();
      return;
    }
    const hitter = this.lastHitter;
    const receiver: Who = hitter === 'player' ? 'bot' : 'player';
    if (this.bounces === 0) {
      const onReceiverSide = hitter === 'player' ? s.x > NET_X : s.x < NET_X;
      if (!isInCourt(s.x, s.y, this.doubles) || !onReceiverSide) {
        this.outMark(s.x, s.y);
        this.pointTo(receiver, this.rallyForcedShot === 'out' && !this.rallyFaultTut ? '¡TIEMPO · FUERA!' : '¡FUERA!', '#ff7a85');
      } else if (dropZero) {
        // DROP SHOT 0 que bota bien en su campo: vuelve hacia la cancha de quien lo tiró. (15-11-2026) El punto NO es aquí:
        // se termina la animación y el rival aún puede devolverla hasta que vuelva a pasar la red (checkDropZeroBack)
        this.bounces = 1;
        this.dropZeroBack = hitter;
      } else {
        this.bounces = 1;
      }
    } else {
      this.pointTo(hitter, hitter === 'player' ? '¡PUNTO!' : 'Punto rival', hitter === 'player' ? '#8fd0ff' : '#ff9aa3');
    }
  }

  /**
   * (25-11-2026, usuario) PRECISIÓN del golpe: dentro del alcance, el golpe no sale apenas la pelota entra al radio (se veía pegarle a la
   * pelota lejos de su sprite) sino cuando ya está muy cerca de la raqueta o en su punto MÁS CERCANO (el siguiente paso se alejaría).
   */
  private atContact(a: Actor, s: BallState) {
    const d0 = this.reachDist(a, s);
    if (d0 <= HIT_RANGE * 0.45) return true;
    const dt = 1 / 60;
    const d1 = this.reachDist(a, { ...s, x: s.x + s.vx * dt, y: s.y + s.vy * dt });
    return d1 >= d0 - 0.01;
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
    const pk = a === this.player ? 1 + this.passiveAgility : 1; // AGILIDAD (pasiva de Nxo): más alcance de raqueta, siempre
    return this.reachDist(a, s) < range * zk * pk && s.z < maxZ * (zk > 1 ? 1.1 : 1);
  }

  /** Cuánto se recorta el desvío de TUS golpes (0 … 1): la ZONA (atributo precisión, mientras dura) y la PASIVA PRECISIÓN de Mai (siempre) se combinan. */
  private precisionCut() {
    const zonePart = this.zone.active('player') ? zoneStatPercent(this.zoneLevels.player.precision) : 0;
    return 1 - (1 - zonePart) * (1 - this.passivePrecision);
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
    this.tutMission('tDive'); // (24-11-2026) misión del tutorial: estirada
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
    defFx.dust(this, x, y);
  }

  private checkHits() {
    if (this.rallyForcedShot) return;
    const s = this.ball.s;
    // el SAQUE no se golpea hasta que bota; si antes toca a alguien del equipo que recibe, el punto es del que saca
    if (this.serving) {
      this.checkServeBodyTouch();
      return;
    }
    if (this.guide === 'first' && this.score.played <= 2 && this.guideHits()) return;
    if (this.g4Point() !== null && this.g4BlockHits()) return; // (26-11-2026, usuario) nivel 4 guiado
    if (this.g5Point() !== null && this.g5BlockHits(s)) return; // (26-11-2026, usuario) nivel 5 guiado
    if (this.spKind() && this.spBlockHits(s)) return; // (25-11-2026, usuario) puntos guiados: globo, cortita, remate, ESPECIAL del rival
    // (25-11-2026, usuario) nivel 2, P2: el saque del bot quieto en el aire; al llegar le pegas y va al bot
    if (this.guide === 'spin' && this.practicingReturns() && this.l2Stage === 'held') {
      if (this.inReach(this.player, s, HIT_RANGE, HIT_MAX_Z * 1.3)) { // (25-11-2026, usuario) antes 1,7: golpeaba muy antes de llegar
        this.l2Hold = null;
        this.playerHit();
        aimShot(s, this.bot.x - 200, this.bot.y, 620, 24);
        this.l2Stage = 'fly';
        this.l2Lock = true; // te quedas quieto: el bot te tirará al otro lado
      }
      return;
    }
    if (this.practicingReturns()) {
      const limit = this.practiceChargeLimit();
      const aim = this.shotFromJoystick();
      const directionReady = this.score.played === 1 || (this.guidePracticeStep === 0 ? aim === 'lob' : aim === 'left' || aim === 'right');
      if (limit && this.charging && this.charge >= limit && directionReady && s.vx < 0 && this.inReach(this.player, s)) this.playerHit();
      return;
    }
    if (performance.now() < this.duelLobUntil) return; // globo del duelo recién salido: aún sobre la red, nadie lo alcanza
    // REMATE del BOT: el golpe lo da tickBotRemate
    if (this.botRemate) return;
    if (this.canBotStartRemate(s)) {
      this.startBotRemate();
      return;
    }
    if (this.lastHitter !== 'player' && s.x < NET_X && s.vx < 0) {
      // (23-11-2026, usuario) 2v2: el aliado bot SIN RAQUETA al que le llega el ESPECIAL rival: ¡A LAS ESTRELLAS! (como tú)
      const al = this.ally;
      if (this.doublesOffline && al && al.racket && !al.launched && this.ball.power && !this.infernoFlight && this.lastHitter === 'bot' && !this.serveBlocked(al) && this.inReach(al) && !this.inReach(this.player)) {
        this.skyLaunch(al);
        return;
      }
      // 2v2: el aliado devuelve la pelota que tú no alcanzas. (23-11-2026) Contra bots también el ESPECIAL / ULTI rival: le revienta igual que
      // a ti (aturdido + devolución floja; la ULTI además le hace volar la raqueta: allyImpact)
      if (this.doubles && (!this.ball.power || this.doublesOffline) && !this.lungeAt && this.allyCanHit(s)) {
        if (this.ball.power && this.lastHitter === 'bot') this.allyImpact();
        else this.allyHit();
        return;
      }
      // 2v2: el resto del saque es de tu compañero (bot o humano): tú no la alcanzas
      if (this.serveBlocked(this.player)) return;
      // sin raqueta (ULTI recibida) no se devuelve nada: la pelota pasa... salvo el ESPECIAL del rival: ¡A LAS ESTRELLAS!
      if (this.player.racket) {
        if (this.ball.power && !this.infernoFlight && this.lastHitter === 'bot' && this.inReach(this.player)) this.skyLaunch(this.player);
        return;
      }
      // REMATE del globo: el golpe lo da el toque o el aro (tickRemate); tras un golpe al aire, un instante sin golpear
      if (this.remateCine || this.remateRecover > 0) return;
      // golpe al aire (MUY PRONTO): no se le pega de inmediato; tras el bote sí (hay que ir a buscarla)
      if (this.remateWhiffBlock) {
        if (this.bounces === 0) return;
        this.remateWhiffBlock = false;
      }
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
      // (18-11-2026, usuario) en ZONA lo RESISTES: "¡RESISTE!" y aturdido solo 1 s (la devolución PERFECT sigue valiendo)
      if (this.ball.power && this.lastHitter === 'bot' && !this.inferno.armed && this.zone.active('player')) {
        if (this.inReach(this.player)) {
          if (this.smashPerfectReturn()) this.playerHit();
          else this.playerImpact(true);
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
      // ESPECIAL armado: un poco más de alcance para la pelota que viene cerca (SMASH_REACH)
      const reach = this.smashArmed && !this.serveLock ? HIT_RANGE * SMASH_REACH : HIT_RANGE;
      if (this.inReach(this.player, s, reach)) {
        if (!this.atContact(this.player, s)) return; // (25-11-2026, usuario) espera a tener la pelota JUNTO a la raqueta
        // SMASH de habilidad con contacto confirmado: 1 s de cinemática y luego el golpe (una vez)
        if (!(this.smashArmed && !this.serveLock && this.startSmashCine())) this.playerHit();
      }
      else {
        const c = this.lungeContact();
        if (c) this.playerLunge(c);
      }
    } else if (this.simBots && this.lastHitter !== 'bot' && s.x > NET_X && s.vx > 0 && this.bot.racket && this.ball.power && !this.infernoFlight && this.inReach(this.bot)) {
      this.skyLaunch(this.bot); // el bot sin raqueta recibe tu ESPECIAL: ¡A LAS ESTRELLAS!
    } else if (this.simBots && this.lastHitter !== 'bot' && s.x > NET_X && s.vx > 0 && this.bot.stun <= 0 && !this.bot.racket && !(this.guide === 'spin' && this.score.played === 1)) {
      // (25-11-2026, usuario) nivel 2, P2: el SAQUE CON EFECTO no se devuelve (punto tuyo)
      // (18-11-2026, usuario) con su DEFENSIVO usado para esta pelota llega un poco más lejos (como tu DASH, devolución más segura)
      // (25-11-2026, usuario) nivel 2, P3: el bot SIEMPRE devuelve tu saque (alcance amplio): es la MISMA pelota, no una nueva
      const near = this.inReach(this.bot) || (this.brain.dashBall && this.inReach(this.bot, s, HIT_RANGE * BOT_DASH_REACH)) || (this.spLobPlays() && this.inReach(this.bot, s, HIT_RANGE * 2.4));
      // ESPECIAL del BOT: con él listo (y decidido para esta pelota) llega un poco más lejos, y ese golpe es su ESPECIAL
      const smashReach = !near && !this.ball.power && !this.serveLock && this.botSmashRoll() && this.inReach(this.bot, s, HIT_RANGE * SMASH_REACH);
      // GLOBO del duelo: el bot se tira a por él (estirada) si no llega con el alcance normal
      if (!near && !smashReach && this.duelDefend === 'bot' && this.ball.shotKind === 'lob' && this.botDuelLunge(s)) return;
      if ((near || smashReach) && !this.atContact(this.bot, s)) return; // (25-11-2026, usuario) igual el rival: la pelota junto a su raqueta
      // (26-11-2026, usuario) con el DEFENSIVO usado para esta pelota, la devuelve SIEMPRE: si se le iba a pasar (ya a su altura, de lado
      // o un poco alta), llega a ella (se coloca junto a la pelota) y golpea
      if (!near && !smashReach && this.brain.dashBall && s.vx > 0 && s.z < HIT_MAX_Z * 1.8 && s.x >= this.bot.x - 12) {
        this.bot.x = clamp(s.x + 14, B_X[0], B_X[1]);
        this.bot.y = clamp(s.y + (s.y > this.bot.y ? -28 : 28), Y_MIN, Y_MAX);
        if (this.ball.power && (this.infernoFlight || !this.zone.active('bot'))) this.fireImpact();
        else this.botHit();
        return;
      }
      if (near || smashReach) {
        // en ZONA el rival RESISTE el ESPECIAL (18-11-2026, usuario: "¡RESISTE!" y aturdido solo 1 s); la ULTI aturde siempre
        if (this.ball.power && (this.infernoFlight || !this.zone.active('bot'))) this.fireImpact();
        else if (this.ball.power && !this.infernoFlight) this.fireImpact(true);
        else if (smashReach) this.botHit(false, 'fire', true);
        else if (!this.botUlti(s)) this.botHit();
      }
    }
  }

  /**
   * (21-11-2026, usuario) REGLA DEL SAQUE: nadie lo devuelve antes del bote (checkHits ya no deja golpear mientras serving) y, si la pelota
   * del saque TOCA el cuerpo de alguien del equipo que recibe antes de botar (en 2v2 suele ser el que está en la red), el punto es del que saca.
   * Usuario, rival bot y rival online. En red lo decide netGate dentro de pointTo: en 1v1, el teléfono del que recibe; en 2v2, el host.
   */
  private checkServeBodyTouch() {
    const s = this.ball.s;
    const server = this.lastHitter;
    if (!server || this.phase !== 'rally' || this.bounces > 0) return;
    if (server === 'player' ? s.x <= NET_X : s.x >= NET_X) return; // aún no pasó al lado del que recibe
    if (s.z > SERVE_BODY.z) return;
    const team = server === 'player' ? (this.doubles ? this.rivalActors : [this.bot]) : this.doubles && this.ally ? [this.player, this.ally] : [this.player];
    for (const a of team) {
      if (a.vanished) continue;
      if (Math.hypot(s.x - a.x, (s.y - a.y) * 1.25) > SERVE_BODY.r) continue;
      this.pointTo(server, '¡SAQUE AL CUERPO!', server === 'player' ? '#8fd0ff' : '#ff9aa3');
      return;
    }
  }

  /**
   * ULTI del rival (BOT): con la carga completa y buen contacto, en vez del golpe normal hace la cinemática del
   * INFERNO (mirada, energía, desplazamiento con sombras) y luego el golpe con la esfera de fuego. true = la lanzó
   * (el golpe lo da la cinemática al terminar).
   */
  private botUlti(s: BallState): boolean {
    if (!this.botAbilityUnlocked('ulti')) return false;
    if (this.cineLock || this.phase !== 'rally' || this.serveLock) return false; // sin ULTI en el resto del saque
    if (this.ultiBlocked('bot')) return false; // sin ULTI contra ULTI: tu ULTI salió primero y el rival espera a recuperar la raqueta
    const bt = this.bot;
    const ctx = { playerX: this.player.x, playerY: this.player.y, botX: bt.x, botY: bt.y };
    if (this.rivalSpecialLimit) return false; // 2v2 online: el compañero ya lanzó un especial en este punto (contra bots no hay límite)
    if (!this.brain.wantsUlti(s, ctx)) return false;
    if (this.doubles) this.rivalSpecialUsed = true;
    this.ultiStart('bot', this.player);
    // su carga visible (botChargeTick) se apaga ya: la escena se congela durante la cinemática
    this.rivalChargeT = 0;
    this.rivalChargeFx(0);
    this.rivalChargeSprite.hide();
    const skin = this.skinOf(bt); // (19-11-2026) el personaje de ESTE rival (en el 2v2 los dos rivales son distintos)
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
    // 2v2 online (host): el compañero ve la misma cinemática del bot (mismo guion; la posición final va en `tx` / `ty`)
    if (this.net2host) this.net?.sendAction('inferno-cine', { a: this.rivalActors.indexOf(bt) + 1, x: from.x, y: from.y, tx: to.x, ty: to.y, ms: INFERNO_CINE.hitAtMs, power: el });
    this.cine.start({
      profile: infernoCine(el),
      freeze: this.doubles ? this.freezeSprites() : [...sprites, ...spritesIn(this.player.ch)],
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
        this.infernoDashStep(e, bt, from, to, sprites, dashSt, el);
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
    if (this.serveBlocked(this.player)) return; // 2v2: el resto del saque es de tu compañero (estirada / DASH / remate tampoco)
    this.missionShot = null; // (MISIONES) la etiqueta es solo de este golpe
    // golpe forzado del DASH (DEFENSIVO) contra el SMASH o la ULTI rival: también te revienta (la ULTI, aun en ZONA)
    if (this.ball.power && this.lastHitter === 'bot' && !this.infernoPending && (this.infernoFlight || !this.zone.active('player'))) {
      this.playerImpact(false, forced);
      return;
    }
    // PUNTO ÉPICO: devolución del DASH (defensivo) o de un ESPECIAL / ULTI del rival
    if (forced || (this.ball.power && this.lastHitter === 'bot')) this.epicPoint = true;
    const s = this.ball.s;
    // el golpe que devuelvo venía cargado al máximo: empujón leve al final (más abajo)
    const pushed = this.maxPushOn === 'player';
    this.maxPushOn = null;
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
    const chargedDrop = charged && this.shotFromJoystick() === 'drop' && this.chargeDropOk();
    // cargando + joystick ARRIBA = GLOBO cargado: lo que pidió el jugador manda sobre el remate automático (antes, en la red o dentro
    // del círculo de un globo, el remate lo anulaba y salía un golpe directo aunque estuviera al máximo)
    const chargedLob = charged && this.shotFromJoystick() === 'lob';
    // REMATE: globo recibido dentro del círculo sin SMASH (o pelota alta en la red) → golpe fuerte y directo automático
    const remate = (!power && (lobOk || netSmash) && !chargedDrop && !chargedLob) || !!this.remateShot;
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
    // ESPECIAL: golpe fuerte de derecha / revés, nunca el remate con salto (la ULTI conserva su regla)
    const overhead = remate || (power ? (inferno ? this.powerOverhead(s) : false) : s.z > OVERHEAD_Z);
    const fxDelay = this.player.ch.swing(power || charged || remate, overhead, (power && overhead) || (remate && lobRemate), netVolley && !overhead);
    if (power && !inferno) this.player.ch.holdFollowThrough(SPECIAL_HOLD_FRAME, SPECIAL_IMPACT_HOLD_MS); // (21-11-2026, usuario) ESPECIAL: 0,8 s en el cuadro 8 (final del golpe)
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
    /** DROP SHOT 0: cortita cargada al máximo con efecto hacia atrás */
    let dropZero = false;
    /** parte de `speed` que aporta la carga (0 sin cargar): TEMPRANO solo penaliza esto (Perfect Timing) */
    let chargePart = 0;

    if (power) {
      tx = depth(0.72, 0.9);
      // ESPECIAL y ULTI (14-11-2026): sin joystick, al MEDIO; derecha / izquierda, a ese lado (antes el ESPECIAL iba
      // siempre a la esquina contraria al rival)
      {
        // solo el joystick de AHORA: la cinemática congela el reloj del juego y la "última dirección reciente" de antes
        // (venía corriendo) seguía contando, por eso la ULTI salía a un lado sin tocar el joystick
        const d = this.autoPlay ? this.autoAim : this.inputVector();
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
      // (26-11-2026, usuario) la CORTITA cargada (joystick abajo) recién desde el nivel 5: antes sale un cargado normal
      const shot0 = this.shotFromJoystick();
      const shot = shot0 === 'drop' && !this.chargeDropOk() ? 'normal' : shot0;
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
        const full = c >= 0.995 && this.guide !== 'spin' && this.chargeDropOk(); // (26-11-2026, usuario) DROP SHOT 0 desde el nivel 5
        const short = 1 - c; // 0 al máximo
        tx = full ? depth(0.08, 0.2) : depth(0.12 + 0.1 * short, 0.24 + 0.1 * short);
        ty = lat(this.diagLat(d));
        speed = SHOT_SPEED * (0.85 + 0.15 * c);
        chargePart = SHOT_SPEED * 0.15 * c;
        margin = full ? 5 : 8;
        dead = true;
        deadHard = full; // solo al máximo casi no levanta al botar
        kind = 'drop';
        // (14-11-2026) AL MÁXIMO es el DROP SHOT 0: efecto hacia atrás (al botar en su campo vuelve a tu cancha y es tu
        // punto; el rival solo lo salva tocándola ANTES del bote). Lleva el efecto de ventilador (DropZeroFx).
        dropZero = full;
        // aviso sobre el jugador: es un golpe que suele dar punto (se ve en el instante del golpe)
        this.time.delayedCall(fxDelay, () => {
          const h = this.headPos(this.player);
          this.popText(h.x, h.y - 10, full ? '¡DROP SHOT 0!' : 'CORTITA', full ? '#bfffe0' : '#9dffb0', full ? 34 : 30);
        });
      } else if (shot === 'lob' && c >= 0.995) {
        // GLOBO DISPARADO (13-11-2026): cargado al MÁXIMO sale rápido y tenso a una de las dos ESQUINAS del fondo rival:
        // la que marque el joystick (izquierda / derecha); sin lado, la contraria a donde está el rival. La cámara se
        // aleja mientras vuela (maxLob) y la pelota lleva el brillo y los rayos del máximo con su estela amarilla
        const side = d.x < -0.2 ? -1 : d.x > 0.2 ? 1 : this.bot.y > LAT_C ? -1 : 1;
        tx = depth(0.93, 0.965);
        ty = lat(side * rand(0.88, 0.95));
        speed = SHOT_SPEED * MAX_LOB.speed;
        chargePart = SHOT_SPEED * 0.2;
        margin = MAX_LOB.margin;
        kind = 'lob';
        this.maxLob = { hitter: 'player' };
        this.maxLobWide = false;
        this.lobCurve = true;
        this.missionShot = 'maxLob'; // MISIONES: ESPECIAL + GLOBO MÁXIMO
      this.tutMission('tChargedLob'); // (24-11-2026) tutorial
        const h = this.headPos(this.player);
        this.popText(h.x, h.y - 10, '¡GLOBO!', '#ffe680', 30);
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
      ({ tx, ty, speed, margin } = this.applyTiming(timed, power ? 'ability' : remate ? 'remate' : chargeTimed || (charged && c >= 0.995) ? 'max' : 'normal', kind, tx, ty, speed, margin, chargePart, this.precisionCut()));
    }
    s.z = Math.max(s.z, 22);
    // FUERZA (pasiva de Jun): golpes más rápidos, siempre (no globos ni dejadas); se suma aparte de la ZONA
    if (this.passiveStrength > 0 && kind !== 'lob' && kind !== 'drop') speed *= 1 + this.passiveStrength;
    // ZONA: golpes más fuertes (no globos ni dejadas)
    if (this.zone.active('player') && kind !== 'lob' && kind !== 'drop') speed *= ZONE.shotMult * this.zoneStatMultiplier('player', 'strength');
    if (this.zone.active('bot')) speed *= 1 - zoneStatPercent(this.zoneLevels.bot.resistance);
    aimShot(s, tx, ty, speed, margin);
    if (kind !== 'lob' && kind !== 'drop' && !power && !remate && this.bot.x < NET_X + DIRECT.botNear) this.flattenShot(s, tx, ty, speed, margin);
    // (25-11-2026, usuario) EFECTO (pasiva de Mat e Isa): tu golpe también curva hacia su lado (bota en el mismo punto)
    if (this.passiveSpin > 0 && !this.lobCurve && kind !== 'lob' && kind !== 'drop' && !power && !remate && s.vx > 0) {
      const T = (tx - s.x) / s.vx;
      if (T > 0.2) {
        const ay = 1200 * this.passiveSpin * (Math.sign(ty - s.y) || 1); // nivel 10 (+10 %) = 120
        s.vy = (ty - s.y - 0.5 * ay * T * T) / T;
        s.ay = ay;
      }
    }
    if (this.lobCurve) {
      this.lobCurve = false;
      this.curveLob(s, tx, ty);
      this.highLob(s, (tx - s.x) / s.vx); // sube el TRIPLE de alto en el mismo tiempo de vuelo
    }
    if (dead) {
      // (18-11-2026, usuario) la cortita cargada SIN llegar al máximo botaba casi nada: algo más de bote (0,22 → 0,36; normal 0,62)
      s.damp = deadHard ? 0.12 : 0.36;
      s.fric = deadHard ? 0.4 : 0.6;
    }
    if (dropZero) s.back = 1; // DROP SHOT 0: vuelve hacia ti al botar (Ball.stepBall)
    // SMASH (no INFERNO): la pelota, su humo, el golpe y el impacto son los de tu poder
    if (power && !inferno) this.setSmashFlight(this.smashEl);
    this.ball.setPower(power);
    // ESPECIAL armado que no salió en este golpe (resto del saque): la pelota que va al rival no va encendida
    if (!power && this.smashArmed) this.ball.setIgnited(false);
    this.ball.setKind(kind, charged || remate, this.trailLook);
    // cargado al máximo: pelota brillante con rayos y sin estela (objects/Ball.setMaxCharge)
    this.ball.setMaxCharge(charged && !power && c >= 0.995);
    // cargado al máximo (no cortita, globo ni remate): el rival que lo reciba retrocede un poco. En red lo decide SU teléfono
    if (!this.net && charged && !power && !remate && c >= 0.995 && kind !== 'drop' && kind !== 'lob') this.maxPushOn = 'bot';
    if (pushed && !remate) this.maxPush(this.player);
    // CORTITA cargada: solo su aviso "CORTITA" (es peligrosa y tiene que leerse); sin BIEN / PERFECTO encima
    if (timed && timed.grade !== 'none' && !(charged && kind === 'drop')) {
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
      if (timed.grade !== 'none' && timed.grade !== 'off' && !(charged && kind === 'drop')) this.net?.sendAction('timing', { grade: timed.grade, streak: n, ms: fxDelay });
    }
    if (power && !inferno) this.missionShot = 'special'; // MISIONES: tu ESPECIAL (la ULTI no cuenta); el GLOBO máximo se marca en su rama
    // (24-11-2026) misiones del tutorial (domain/tutorialMissions.ts)
    if (power && !inferno) this.tutMission('tSpecial');
    if (inferno) this.tutMission('tUlti');
    if (remate) this.tutMission('tRemate');
    if (charged && !power && c >= 0.5) this.tutMission('tCharge');
    if (timed?.grade === 'good' || timed?.grade === 'perfect') this.tutMission('tGood');
    if (timed?.grade === 'perfect') this.tutMission('tPerfect');
    if (timed && this.perfectStreak >= 2) this.tutMission('tStreak2');
    const practiceLimit = this.practiceChargeLimit();
    if (practiceLimit && charged && c >= practiceLimit) this.guidePracticeStep++;
    this.lessonPlayerHit(!!power && !inferno); // (24-11-2026) ejercicio de los niveles 3 y 4
    this.recordHit('player', forced || !!this.dashHit || !!this.dashRun);
    this.bounces = 0;
    this.ai.onPlayerHit(power || remate);
    this.hitFxAt(fxDelay, s.x, s.y, s.z, power, charged ? c : remate ? 1 : 0.15, this.infernoPending, this.infernoPending ? getProfile().inferno : power ? this.smashEl : undefined, remate && lobRemate && !power ? 'ball-saque-2' : undefined); // REMATE del globo (salto en el círculo): ball-saque-2
    if (charged && !power && c >= 0.995) {
      const pc = project(s.x, s.y, s.z);
      this.time.delayedCall(fxDelay, () => {
        shockFx(this, pc.sx, pc.sy, pc.s);
        sfx(this, 'electricidad', 0.8); // choque eléctrico del golpe cargado al 100 %
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
      const [rx, ry, rz] = [s.x, s.y, s.z];
      this.time.delayedCall(fxDelay, () => {
        this.ball.setImpactTrail(0.9, 0xffffff);
        this.cameras.main.shake(rs?.perfect ? 260 : lobRemate ? 190 : 110, rs?.perfect ? 0.02 : lobRemate ? 0.013 : 0.007);
        if (rs?.perfect) {
          // SMASH!: el destello del remate potenciado y estela dorada
          const pp = project(s.x, s.y, s.z);
          superSmashFx(this, pp.sx, pp.sy);
          this.ball.setImpactTrail(1, 0xffd23f);
        }
        // (20-11-2026, usuario) remate normal o flojo (sin SMASH! ni globo): impacto de golpe contra la pelota
        if (!rs?.perfect && !power) this.smashHitImpact(rx, ry, rz);
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
   * (20-11-2026, usuario) Impacto del REMATE normal (no SMASH!): destello blanco, anillo que se abre y rayos cortos desde la pelota.
   */
  private smashHitImpact(x: number, y: number, z: number) {
    const p = project(x, y, z);
    const s = p.s;
    const flash = this.add.circle(p.sx, p.sy, 22 * s, 0xffffff, 0.95).setDepth(3500).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: flash, scale: 2.2, alpha: 0, duration: 180, ease: 'Cubic.easeOut', onComplete: () => flash.destroy() });
    const ring = this.add.circle(p.sx, p.sy, 14 * s, 0xffffff, 0).setStrokeStyle(5 * s, 0xfff2c0, 0.95).setDepth(3500).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: ring, scale: 3.6, alpha: 0, duration: 300, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    const g = this.add.graphics().setDepth(3500).setBlendMode(Phaser.BlendModes.ADD);
    const rays = Array.from({ length: 8 }, (_, i) => ({ a: (i / 8) * Math.PI * 2 + rand(-0.2, 0.2), l: rand(26, 40) * s }));
    const st = { k: 0 };
    this.tweens.add({
      targets: st,
      k: 1,
      duration: 220,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        g.clear();
        for (const r of rays) {
          const r0 = 12 * s + r.l * st.k * 0.6;
          const r1 = 12 * s + r.l * (0.4 + st.k);
          g.lineStyle(3.5 * s * (1 - st.k) + 0.5, 0xffffff, 1 - st.k);
          g.lineBetween(p.sx + Math.cos(r.a) * r0, p.sy + Math.sin(r.a) * r0, p.sx + Math.cos(r.a) * r1, p.sy + Math.sin(r.a) * r1);
        }
      },
      onComplete: () => g.destroy(),
    });
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
  /** ¿El BOT usará su ESPECIAL con la pelota que viene? Se decide UNA vez por pelota (con su probabilidad de siempre). */
  private botSmashRoll(): boolean {
    if (!this.botAbilityUnlocked('special')) return false;
    const key = `${this.score.gameIndex}-${this.score.points.join('-')}-${this.shotsThisPoint}`;
    if (this.botRollKey !== key) {
      this.botRollKey = key;
      this.botRollWant = this.brain.smashReady && Math.random() < this.brain.smashChance;
    }
    return this.botRollWant;
  }
  private botRollKey = '';
  private botRollWant = false;

  /** `forcePower` = llegó con el alcance extra del ESPECIAL: este golpe es su ESPECIAL. */
  private botHit(ulti = false, el: InfernoElement = 'fire', forcePower = false) {
    if (this.duelDefend === 'bot') this.duelDefend = null; // llegó al globo del duelo con su alcance normal
    if (!this.net) this.netEndBotFly(true); // golpea: su SOMBRA / SUPERSALTO / VOLTERETA / PATINAJE (botFly) termina ya en el punto
    const s = this.ball.s;
    // a dónde y cómo devuelve: lo decide el cerebro; la física del golpe se aplica aquí como siempre
    // sin ESPECIAL en el resto del saque (serveLock: este golpe sería el 2º del punto)
    let shot = this.brain.planShot(s, { playerX: this.player.x, playerY: this.player.y, botX: this.bot.x, botY: this.bot.y }, ulti,
      !this.spForceSpecial && (this.serveLock || !this.botAbilityUnlocked('special') || (this.rivalSpecialLimit && !ulti)), forcePower || this.spForceSpecial, this.guide !== 'spin' && !(this.tutorial && getPlayer().level < BOT_DROP0_LEVEL)); // (26-11-2026, usuario) el rival sin DROP SHOT 0 hasta después de enseñarlo
    // (25-11-2026, usuario) nivel 3, P3: el ESPECIAL del rival SIEMPRE (el cerebro lo negaba sin la habilidad cargada o con mal contacto)
    if (this.spForceSpecial && !shot.power) {
      shot = {
        ...shot,
        tx: NET_X - (NET_X - COURT.left) * rand(0.7, 0.85),
        ty: this.player.y > LAT_C ? COURT.top + rand(25, 60) : COURT.bottom - rand(25, 60), // lejos de ti
        speed: SHOT_SPEED * SMASH_SPEED_MULT,
        kind: 'normal',
        margin: 6,
        intent: 'deep',
        power: true,
      };
    }
    if (this.doubles && shot.power) this.rivalSpecialUsed = true;
    // ESPECIAL del BOT: la misma cinemática que el tuyo (pantalla oscura y foco en él, partido congelado); el golpe sale
    // al terminar, una sola vez. Su clip arranca ya en la preparación (la segunda llamada a swing no lo reinicia).
    // (19-11-2026) también en el ANFITRIÓN del 2v2 online: avisa al invitado ('smash-cine' con el actor) y los dos teléfonos la ven a la vez
    if (shot.power && !ulti && (!this.net || this.net2host) && smashCineEnabled() && !this.cineLock && this.phase === 'rally') {
      const over = false; // ESPECIAL del BOT: golpe fuerte de derecha / revés, como el tuyo
      const lead = this.bot.ch.swing(true, over, over, false, true); // pose de carga (frame 4), como el tuyo
      if (this.net2host) {
        const tag = this.net2Tag(this.bot);
        if (tag) this.net?.sendAction('smash-cine', { x: this.bot.x, y: this.bot.y, overhead: false, ms: SMASH_CINE.hitAtMs, element: this.botKit.smash, ...tag });
      }
      this.cine.start({
        profile: smashCine(this.botKit.smash),
        freeze: this.doubles ? this.freezeSprites() : [...spritesIn(this.bot.ch), ...spritesIn(this.player.ch)],
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
    // (25-11-2026, usuario) nivel 2, P3: devuelve tu saque con un golpe NORMAL hacia ti (sin globo, cortita ni poder) y luego sube a la red
    const lobFeed = this.spLobPlays();
    if (lobFeed) {
      // (25-11-2026, usuario) el tiro bota en la T de TU lado (centro de la línea de saque)
      const tT = NET_X - (NET_X - COURT.left) * 0.538;
      const fk = this.spKind();
      // (25-11-2026, usuario) nivel 3, P2 REMATE: globo CORTO hacia tu red (se parará en el aire cerca de ella)
      if (fk === 'remate') shot = { ...shot, power: false, kind: 'normal', intent: 'normal', tx: NET_X - 110, /* (26-11-2026, usuario) NO globo: sin el círculo del remate; pelota algo alta para el smash en la red */ ty: clamp(this.player.y, COURT.top + 60, COURT.bottom - 60), speed: 430, margin: 110 };
      else shot = { ...shot, power: false, kind: 'normal', intent: 'normal', tx: tT, ty: LAT_C, speed: SHOT_SPEED * 1.1, margin: 14 };
      this.spSt = 'fed'; // (25-11-2026, usuario) te mueves libre hasta que la pelota se para
      this.spLate = false;
      // y él va a su sitio antes de que se pare la pelota (globo: SUBE a su T; cortita: se queda ATRÁS)
      const spot = this.spBotSpot(fk === 'drop' || fk === 'remate' ? fk : 'lob');
      this.time.delayedCall(150, () => {
        this.tweens.killTweensOf(this.bot);
        this.tweens.add({ targets: this.bot, x: spot.x, y: spot.y, duration: 550, ease: 'Sine.easeOut' });
      });
    }
    const power = !!shot.power;
    // lo que devuelve venía cargado al máximo (lo tiraste tú): retrocede un poco; el bot no carga, así que no empuja a nadie
    const pushed = this.maxPushOn === 'bot';
    this.maxPushOn = null;
    if (pushed && !power) this.maxPush(this.bot);
    // SMASH del rival: golpe fuerte (remate si la pelota viene alta) y bola de fuego
    // ESPECIAL del rival: golpe fuerte de derecha / revés (sin el remate con salto), igual que el tuyo
    // (la ULTI del rival conserva el remate por arriba si la pelota viene alta)
    const ultiOver = ulti && this.ball.s.z > OVERHEAD_Z;
    const fxDelay = power ? this.bot.ch.swing(true, ultiOver, ultiOver) : this.bot.ch.swing();
    if (power && !ulti) this.bot.ch.holdFollowThrough(SPECIAL_HOLD_FRAME, SPECIAL_IMPACT_HOLD_MS); // (21-11-2026, usuario) ESPECIAL del rival: 0,8 s en el cuadro 8
    s.z = Math.max(s.z, 22);
    let shotSpeed = shot.speed * (this.zone.active('bot') && shot.kind !== 'lob' && shot.kind !== 'drop' ? ZONE.shotMult * this.zoneStatMultiplier('bot', 'strength') : 1);
    if (this.zone.active('player')) shotSpeed *= 1 - zoneStatPercent(this.zoneLevels.player.resistance);
    // (14-11-2026) el globo no se alarga sin tope para pasar la red: cerca de ella salía un globo gigante (~2,5 s)
    aimShot(s, shot.tx, shot.ty, shotSpeed, shot.margin, shot.kind === 'lob' ? BOT_LOB_MAX_STRETCH : Infinity);
    // (15-11-2026) golpes del bot que NO son globo: sin arcos altos (desde el fondo salían pelotas de ~240 de alto que se iban
    // por arriba de la pantalla y parecían globos). Se aplanan como los tuyos (DIRECT.apex), con más velocidad.
    if (shot.kind !== 'lob' && !power) {
      const apex = () => s.z + (s.vz > 0 ? (s.vz * s.vz) / (2 * (s.g ?? GRAVITY)) : 0);
      aimShot(s, shot.tx, shot.ty, shotSpeed, shot.margin, BOT_LOB_MAX_STRETCH);
      // un poco más rápido hasta que la altura máxima baje del tope (como mucho BOT_FLAT.maxSpeed: no lo vuelve imposible)
      for (let sp = shotSpeed; apex() > BOT_FLAT.apex && sp < shotSpeed * BOT_FLAT.maxSpeed; ) {
        sp = Math.min(shotSpeed * BOT_FLAT.maxSpeed, sp * 1.06);
        aimShot(s, shot.tx, shot.ty, sp, shot.margin, BOT_LOB_MAX_STRETCH);
      }
    }
    if (shot.dropZero && !power) {
      // DROP SHOT 0 del rival: efecto hacia atrás (Ball.stepBall) y bote muerto; aviso sobre él
      s.damp = 0.12;
      s.fric = 0.4;
      s.back = 1;
      this.time.delayedCall(fxDelay, () => {
        const hb = this.headPos(this.bot);
        this.popText(hb.x, hb.y - 10, '¡DROP SHOT 0!', '#ffb3c0', 34);
      });
    }
    if (power && !ulti) this.setSmashFlight(this.botKit.smash); // ESPECIAL del BOT según su personaje (Mai = hielo, Nxo = fuego)
    this.ball.setPower(power);
    this.ball.setKind(shot.kind);
    this.recordHit('bot', this.brain.dashBall);
    this.bounces = 0;
    if (this.net2host) {
      this.netHit = { overhead: ultiOver, special: ultiOver, defensive: this.brain.dashBall };
      this.netHitPending = true;
      this.netHitA = this.rivalActors.indexOf(this.bot) + 1;
    }
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
      infernoSound.impact(this, this.infernoEl);
      this.ball.quietFx = true;
      // (sin texto: la ULTI ya se anuncia con la mirada)
    } else if (power) this.popText(h.x, h.y - 10, 'ESPECIAL', '#ffb347', 28);
  }

  /**
   * Efecto de golpe sincronizado con el frame de impacto de la raqueta. La física ya se aplicó;
   * el destello, las partículas y la estela salen cuando la raqueta "toca" la pelota (en el punto de contacto).
   */
  private hitFxAt(delayMs: number, bx: number, by: number, bz: number, power: boolean, level = 0.15, silent = false, el?: FxElement, snd?: string) {
    this.ball.holdVisual(delayMs, bx, by, bz);
    if (delayMs <= 0) this.hitFx(bx, by, bz, power, level, silent, el, snd);
    else this.time.delayedCall(delayMs, () => this.hitFx(bx, by, bz, power, level, silent, el, snd));
  }

  // ---------------------------------------------------------------- efectos
  /**
   * Efecto del golpe sobre la pelota. `level` es la potencia real (0..1) y elige el tramo
   * (suave / medio / fuerte / máximo) del destello, las ondas y la estela. Con SMASH sale el fuego de siempre; con
   * INFERNO (`el`), el anillo, las chispas y el destello van con los colores de su poder (INFERNO_LOOK).
   */
  private hitFx(bx: number, by: number, bz: number, power: boolean, level = 0.15, silent = false, el?: FxElement, snd?: string) {
    // (20-11-2026, usuario) golpe del ESPECIAL DRAGÓN (legendaria): ulti-fuego recortado como en la ULTI (usuario, bot y rival online)
    if (!silent && !snd && power && el === 'dragon' && playUltiFile(this, 'ulti-fuego')) silent = true;
    if (!silent) {
      // (18-11-2026, usuario) golpe del ESPECIAL de SOMBRA o de LUZ: especial-sombra-luz (la ULTI llega silenciosa: no entra aquí)
      const own = snd ?? (power && (el === 'shadow' || el === 'light') ? 'especial-sombra-luz' : undefined);
      const key = own && this.cache.audio.exists(own) ? own : 'golpe-fuerte'; // sin el archivo propio, el de siempre
      if (this.cache.audio.exists(key)) this.sound.play(key, { volume: power ? 1 : 0.75, seek: SFX_SEEK[key] ?? 0 }); // sin el silencio inicial del archivo
    }
    const p = project(bx, by, bz);
    const x = p.sx;
    const y = p.sy;
    if (power) {
      const C = hitLookOf(el);
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
    if (this.l2Lock || this.spSpecialLock()) return new Phaser.Math.Vector2(0, 0); // (25-11-2026) nivel 2: quieto hasta el DEFENSIVO; nivel 3, P3: quieto ante el ESPECIAL
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
    if (Math.abs(d.y) >= Math.abs(d.x)) {
      // (14-11-2026) venir CORRIENDO hacia la red (o hacia atrás) con el joystick mantenido no es pedir un globo / cortita:
      // si arriba / abajo lleva más de SHOT_HOLD_MS apretado sin cargar, el golpe sale normal. El globo y la cortita se
      // piden con un toque al golpear (o apuntando mientras se carga)
      if (!this.autoPlay && !this.charging && this.vertDir !== 0 && this.time.now - this.vertSince > SHOT_HOLD_MS) return 'normal';
      return d.y > 0 ? 'drop' : 'lob';
    }
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
  /** (23-11-2026) `bt` / `target` / `xr`: también lo usa el ALIADO bot del 2v2 (su zona es P_X) */
  private botBlink(bt: Actor = this.bot, target: { x: number; y: number } = this.ai.target, xr: number[] = B_X) {
    const from = { x: bt.x, y: bt.y };
    const tx = clamp(target.x, xr[0], xr[1]);
    const ty = clamp(target.y, Y_MIN, Y_MAX);
    const a = project(from.x, from.y);
    const b = project(tx, ty);
    const k = a.s * VIEW.CHAR_K;
    this.dashFx.burst(a.sx, a.sy, k, bt.ch.depth, 0x45d9ff);
    sfx(this, 'dash-destello');
    if (Math.hypot(tx - from.x, ty - from.y) > 40) {
      for (let i = 0; i < 3; i++) {
        const f = (i + 1) / 4;
        bt.x = from.x + (tx - from.x) * f;
        bt.y = from.y + (ty - from.y) * f;
        this.renderActorPose(bt); // la sombra copia la pose en esa posición
        this.dashFx.ghost(bt.ch, i, bt.ch.depth);
      }
      bt.x = from.x;
      bt.y = from.y;
      this.renderActorPose(bt);
    }
    this.dashFx.streak(a.sx, a.sy - 70 * k, b.sx, b.sy - 70 * k, k, bt.ch.depth);
    this.portalFx(from.x, from.y, 0x45d9ff, 0xd9f7ff);
    const h = this.headPos(bt);
    this.popText(h.x, h.y - 10, 'DEFENSIVO', '#c9a4ff', 26); // el rival: solo el tipo de habilidad
    // (20-11-2026) 2v2 online (host): el invitado ve el DESTELLO de este bot (antes solo lo veía aparecer en otro sitio)
    this.sendBotDefensive(bt, { kind: 'blink', x: from.x, y: from.y, tx, ty, out: BLINK.fastOut * 1000, in: BLINK.fastIn * 1000, delay: 0 });
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
   * SOMBRA / SUPERSALTO / VOLTERETA / PATINAJE del BOT (kit variado, ai/botKit.ts): en vez del sprint del DASH va al punto
   * que predijo su IA con el mismo recorrido y efectos que se ven del rival online (netBotFly / netBotFlyTick / netEndBotFly).
   * La duración sale de la distancia, dentro del rango de cada poder (logic/DefensiveMoves.ts), y es corta para llegar a tiempo.
   */
  /** (23-11-2026) `bt` / `target` / `xr`: también lo usa el ALIADO bot del 2v2 (su zona es P_X y su clon de SOMBRA va de espaldas) */
  private botFly(kind: 'shadow' | 'jump' | 'flip' | 'skate', bt: Actor = this.bot, target: { x: number; y: number } = this.ai.target, xr: number[] = B_X) {
    const from = { x: bt.x, y: bt.y };
    const to = { x: clamp(target.x, xr[0], xr[1]), y: clamp(target.y, Y_MIN, Y_MAX) };
    const range = kind === 'shadow' ? [SHADOW.runMin, SHADOW.runMax] : kind === 'jump' ? [JUMP.airMin, JUMP.airMax] : kind === 'flip' ? [FLIP.airMin, FLIP.airMax] : [SKATE.minT, SKATE.maxT];
    const dur = clamp(Math.hypot(to.x - from.x, to.y - from.y) / 1100, range[0], range[0] + (range[1] - range[0]) * 0.4);
    this.netEndBotFly(false);
    bt.ch.setMoving(false, 0);
    bt.ch.setCharging(false);
    const fly: NonNullable<MatchScene['netBotFly']> = { kind, from, to, t: 0, dur, ghosts: 0, puff: { t: 0 }, actor: bt };
    const h = this.headPos(bt);
    const p = project(bt.x, bt.y);
    if (kind === 'shadow') {
      const clone = bt === this.ally ? new Character(this, 0, 0, playerLook(this.skinOf(bt)), 'back') : new Character(this, 0, 0, this.rivalLk(), 'front');
      for (const sp of spritesIn(clone)) sp.setTint(SHADOW.tint);
      clone.setAlpha(SHADOW.alpha);
      clone.setSprint(true, to.y - from.y);
      fly.clone = clone;
      this.dashFx.burst(p.sx, p.sy, p.s * VIEW.CHAR_K, bt.ch.depth);
      sfx(this, 'dash-shadow');
    } else if (kind === 'skate') {
      bt.ch.setSprint(true, Math.sign(to.y - from.y) || 1);
      fly.trail = this.newIceTrail();
      fly.trail.add(from.x, from.y);
      this.dashFx.burst(p.sx, p.sy, p.s * VIEW.CHAR_K, bt.ch.depth);
      sfx(this, 'dash-destello', 0.7);
    } else {
      this.dustFx(bt.x, bt.y);
      this.takeoffSquash(bt);
      if (kind === 'jump') this.jumpTakeoffFx(bt.x, bt.y);
      sfx(this, 'dash-jump');
    }
    this.popText(h.x, h.y - 10, 'DEFENSIVO', '#c9a4ff', 26); // el rival: solo el tipo de habilidad
    this.sendBotDefensive(bt, { kind, x: from.x, y: from.y, tx: to.x, ty: to.y, ms: dur * 1000 }); // (20-11-2026) 2v2 online: el invitado lo ve
    this.netBotFly = fly;
    this.netBotFlyTick(0);
  }

  /**
   * (20-11-2026, log AWS) 2v2 ONLINE, host: avisa al invitado del DEFENSIVO de uno de sus bots (con `a` = el bot), con los mismos datos que
   * manda un humano; el invitado lo muestra con net2Defensive / net2Dash (su recorrido llega por los estados). En el 1v1 o contra bots, nada.
   */
  private sendBotDefensive(bt: Actor, d: Record<string, string | number>, kind: 'defensive' | 'sprint-start' | 'sprint-end' = 'defensive') {
    if (!this.net2host) return;
    const tag = this.net2Tag(bt);
    if (!tag?.a) return;
    this.net?.sendAction(kind, { ...d, ...tag } as ActionMsg['data']);
  }

  /**
   * CARGA del BOT (solo visual): quieto esperando una pelota tuya que ya viene hacia su lado, muestra la pose y el
   * efecto de carga de su personaje (Mai = tulipán, Nxo = fuego), igual que se ve al rival en red. No cambia su golpe.
   */
  private botChargeTick(dt: number, moving: boolean) {
    const bt = this.bot;
    const s = this.ball.s;
    // sin carga durante su DASH (sprint y frenada): la pose de carga cortaba la animación
    // (25-11-2026, usuario) nivel 1: mientras retiene la pelota esperando a que llegues al cuadro, sigue en la pose de carga
    const guideWait = this.guideBotFrozen() && this.guideRally.st === 'wait';
    const on = guideWait || (this.phase === 'rally' && this.lastHitter === 'player' && s.vx > 0 && s.x > NET_X - 80 && !moving && bt.stun <= 0 && !bt.vanished && !bt.ch.dashing);
    if (on) this.rivalChargeT += dt;
    else this.rivalChargeT = 0;
    bt.ch.setCharging(on);
    this.rivalChargeFx(dt);
  }

  /**
   * POLVO DE LA CARRERA (12-11-2026): una nube pequeña en los pies cada ~55 unidades recorridas a paso de carrera, empujada hacia
   * atrás. Se mide con la posición dibujada de cada actor, así vale igual para el usuario, el bot y el rival online (interpolado), y
   * también en el DASH. No suelta nada si está en el aire, desaparecido, girando (VOLTERETA / PATINAJE) o si la posición saltó
   * (teletransportes y sombras que recolocan al actor).
   */
  private runDust(a: Actor, p: { sx: number; sy: number; s: number }) {
    const now = this.time.now;
    const d = a.dust ?? (a.dust = { x: a.x, y: a.y, at: now, acc: 0, last: 0 });
    const dt = (now - d.at) / 1000;
    const dx = a.x - d.x;
    const dy = a.y - d.y;
    const dist = Math.hypot(dx, dy);
    d.x = a.x;
    d.y = a.y;
    if (dt <= 0) return; // varias llamadas en el mismo fotograma: sin avance medido
    d.at = now;
    const speed = dist / dt;
    if (dt > 0.2 || dist > 60 || a.vanished || a.lift || a.spin || a.warp < 1 || a.launched || this.phase !== 'rally') {
      d.acc = 0;
      return;
    }
    if (speed < 140) {
      d.acc = 0;
      return;
    }
    d.acc += dist;
    if (d.acc < 55 || now - d.last < 90) return;
    d.acc = 0;
    d.last = now;
    const k = p.s * VIEW.CHAR_K;
    const back = dy === 0 ? 0 : -Math.sign(dy); // hacia atrás respecto al lado en que corre (y = lateral)
    for (let i = 0; i < 2; i++) {
      const puff = this.add
        .ellipse(p.sx + back * rand(6, 22) * k + rand(-6, 6) * k, p.sy + rand(-3, 3), rand(10, 18) * k, rand(5, 9) * k, 0xe8e2d0, 0.55)
        .setDepth(p.sy - 0.2);
      this.tweens.add({ targets: puff, x: puff.x + back * rand(18, 40) * k, y: puff.y - rand(6, 16) * k, scale: rand(1.8, 2.6), alpha: 0, duration: rand(260, 420), ease: 'Quad.easeOut', onComplete: () => puff.destroy() });
    }
  }

  private renderActorPose(a: Actor) {
    // (18-11-2026, usuario: "a veces el rival se sube a la pared") el fondo del rival (B_X) podía quedar DETRÁS de la pared dibujada del
    // estadio: nadie pasa de la pared (menos un margen para los pies)
    const wallX = this.backWall ? Math.min(B_X[1], this.backWall.x - RIVAL_WALL_GAP) : B_X[1];
    if (a.x > wallX) a.x = wallX;
    const boost = (a === this.player ? this.aura.active : a === this.bot && !!this.botAura?.active) ? 1.1 + Math.sin(this.time.now / 70) * 0.015 : 1;
    return placeActor(a.ch, a, boost);
  }

  private renderActors() {
    for (const a of this.everyone()) {
      if (a.launched) continue; // ¡A LAS ESTRELLAS!: su vuelo lo mueven sus tweens
      this.runDust(a, this.renderActorPose(a));
    }
    this.aura.update(this.game.loop.delta / 1000);
    this.botAura?.update(this.game.loop.delta / 1000);
    this.renderCharge();
    {
      // niebla del aturdido centrada en el cuerpo del jugador
      const pf = project(this.player.x, this.player.y);
      this.stunFog.update(this.game.loop.delta / 1000, pf.sx, (pf.sy + this.headPos(this.player).y) / 2);
    }
    const h = this.headPos(this.bot);
    // sin estrellas de la escena si el aturdido ya las trae dibujadas (ULTI completa) ni al recoger la raqueta
    this.dizzy.setVisible(this.bot.stun > 0 && !this.bot.launched && !this.bot.ch.stunStarsDrawn && !this.bot.ch.pickingUp && !(this.bot.softUntil && this.time.now < this.bot.softUntil)).setPosition(h.x, h.y);
    const hp = this.headPos(this.player);
    // solo el aturdido del SMASH (la estirada también usa stun, sin estrellas)
    this.dizzyP.setVisible(this.player.stun > 0 && !this.player.launched && this.playerDizzy).setPosition(hp.x, hp.y);
    if (this.player.stun <= 0) this.playerDizzy = false;
  }

  private resetRallyClock() {
    this.rallyElapsed = 0;
    this.rallyRemaining = null;
    this.rallyForcedShot = undefined;
    this.rallyFaultTut = false;
    this.rallyCountdown?.hide();
    this.rallyDanger?.setVisible(false);
  }

  private guideServeLesson(): 'tap' | 'direct' | 'spin' | undefined {
    // (24-11-2026, usuario) el saque con efecto ya no se enseña en el nivel 2 (pasa al 15)
    if (this.guide === 'first' && this.score.played === 1) return 'tap';
    if (this.guide === 'first' && this.score.played === 2) return 'direct';
    // (25-11-2026, usuario) NIVEL 2: P1 saque directo (el bot no la devuelve), P2 sacas y DEFENSIVO, P3 saque con efecto (el bot responde)
    // (25-11-2026, usuario) NIVEL 2 ahora: P1 sacas como quieras y DEFENSIVO; P2 saque con efecto
    if (this.guide === 'spin' && this.score.played === 1) return 'spin';
  }

  /** (25-11-2026, usuario) pausa en lo más alto del saque directo (las 6 zonas): ahora en el NIVEL 1, P3 (antes nivel 2, P1) */
  private aimPausePoint() {
    return this.guide === 'first' && (this.score.played === 1 || this.score.played === 2); // (25-11-2026, usuario) saque normal (P2) y directo (P3)
  }

  /** (25-11-2026, usuario) puntos guiados del partido (sí suman al marcador; GANA 4 PUNTOS sale al terminar): nivel 1 = 3 (joystick, saque tocando, saque directo); nivel 2 = 3 (saque directo, DEFENSIVO, saque con efecto) */
  private guidePracticeCount() {
    return this.guide === 'first' ? 3 : this.guide === 'spin' ? 3 : this.guide === 'l3' ? 4 : this.guide === 'l4' ? 3 : this.guide === 'l5' ? 4 : 0;
  }

  /** (25-11-2026, usuario) tutorial: al empezar los puntos que cuentan, "GANA 4 PUNTOS" grande (si no ganas, se repite el nivel sin EXP ni premios) */
  private winGoalShown = false;
  private showWinGoal() {
    // (25-11-2026, usuario) los que FALTAN (los guiados ya suman): con 3-0, GANA 1 PUNTO
    const left = Math.max(1, 4 - this.score.points[0]);
    const t = this.add.text(this.scale.width / 2, this.scale.height * 0.3, left === 1 ? 'GANA 1 PUNTO' : `GANA ${left} PUNTOS!`, { ...textStyle(46, '#ffd23f'), stroke: '#2a1600', strokeThickness: 8 })
      .setOrigin(0.5).setScrollFactor(0).setDepth(6080).setScale(0.3);
    this.tweens.add({ targets: t, scale: 1, duration: 300, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, y: t.y - 30, delay: 1900, duration: 400, onComplete: () => t.destroy() });
  }

  /**
   * (25-11-2026, usuario) tutorial antes del DUELO RED (nivel 11): si subes a la RED, el rival NO te gana el peloteo (antes: voleas
   * infinitas, sobre todo con los dos en la red): su golpe se va fuera / a la red y no se devuelve. Ni en los golpes guiados ni con su ESPECIAL.
   */
  private tutNetGuard(v: Who) {
    return (
      v === 'bot' && this.tutorial && !this.doubles && getPlayer().level < TUTORIAL_DUEL_LEVEL &&
      this.player.x >= NET_ZONE_X && !this.ball.power && !this.spKind() && !this.doingGuidePoint()
    );
  }

  private doingGuidePoint() {
    if (this.guide === 'l4') return this.score.played < 3; // (26-11-2026, usuario) nivel 4 guiado
    return this.guide === 'first' ? this.score.played < 3 : this.guide === 'spin' ? this.practicingReturns() : this.lessonPractice();
  }

  private practicingReturns() {
    // (24-11-2026, usuario) NIVEL 2: solo el DEFENSIVO, en el primer punto (antes saque con efecto y carga, que pasan al 15 y al 12)
    // (25-11-2026, usuario) ahora en el 2.º punto (el 1.º es el saque directo)
    return this.guide === 'spin' && this.score.played === 0 && this.guidePracticeStep < 2;
  }

  private practiceChargeLimit() {
    if (this.guide === 'spin') return 0; // (24-11-2026) nivel 2: solo DEFENSIVO
    if (!this.practicingReturns()) return 0;
    if (this.score.played === 2) return 1;
    return this.guidePracticeStep === 1 ? 0.5 : 0;
  }

  // ---------------------------------------------------------------- PUNTOS GUIADOS (25-11-2026, usuario)
  /** nivel 2 P3 = globo (el bot sube a la red); nivel 3: P1 cortita (el bot se queda atrás), P2 remate en la red, P3 ESPECIAL del rival (no se devuelve) */
  private spKind(): 'lob' | 'drop' | 'remate' | 'special' | 'defspecial' | null {
    if (this.guide === 'spin' && this.score.played === 2) return 'lob';
    // (26-11-2026, usuario) P4: el rival tira otra vez su ESPECIAL y lo respondes con el DEFENSIVO (quedas aturdido); luego haces el punto
    if (this.guide === 'l3') return (['drop', 'remate', 'special', 'defspecial'] as const)[this.score.played] ?? null;
    return null;
  }
  private spSt: 'serve' | 'fly' | 'fed' | 'approach' | 'hold' | 'done' | 'defwait' | 'stun' | 'fed2' | 'approach2' = 'serve';
  /** (26-11-2026, usuario) nivel 3, P4: esperando que uses el DEFENSIVO contra el ESPECIAL parado */
  private spDefWait() {
    return this.spKind() === 'defspecial' && this.spSt === 'defwait';
  }
  /** (26-11-2026, usuario) nivel 3, P4: velocidad del ESPECIAL congelado (sigue igual al usar el DEFENSIVO) y si ya corres a él */
  private spDefVel: { vx: number; vy: number; vz: number } | null = null;
  private spDefRunning = false;
  /** (26-11-2026, usuario) tu pelota botó 2 veces antes de que el bot llegara: el punto sigue y él va a por ella */
  private spLate = false;
  /** (26-11-2026, usuario) globo: el rival clavado en su T hasta el final del punto */
  private spBotPin: { x: number; y: number } | null = null;
  private spPulseAt = 0;
  /** reloj de 1,5 s al llegar a la pelota del globo (el joystick muestra ARRIBA; luego se puede) */
  private spClock?: Phaser.GameObjects.Container;
  private spHold: { x: number; y: number; z: number } | null = null;
  private spHoldAt = 0;
  /** tu personaje quieto mientras viene la pelota del globo / la cortita */
  private spPin: { x: number; y: number } | null = null;
  private spForceSpecial = false;

  /**
   * (25-11-2026, usuario) niveles guiados (nivel 2, P1 y P3): el bot va a donde irá TU pelota (se pone a su lado y detrás de ella, como
   * corriendo a buscarla) para devolver la MISMA pelota. true = ya le llegó (golpea ahora).
   */
  private steerBotToBall() {
    const bt = this.bot;
    const s = this.ball.s;
    // (25-11-2026, usuario) sin saltos raros: se queda a su profundidad y va en línea recta (a su velocidad) al lado por donde le
    // llegará TU pelota tras su bote; ese punto se calcula una vez por golpe (simulando la pelota)
    if (!this.botRunTo || this.botRunTo.vx !== s.vx) this.botRunTo = { ...this.predictBotMeet(), vx: s.vx, at: this.time.now };
    const dt = this.game.loop.delta / 1000;
    const dx = this.botRunTo.x - bt.x;
    const dy = this.botRunTo.y - bt.y;
    const d = Math.hypot(dx, dy);
    // llega ANTES que la pelota: al menos a su velocidad, o más rápido si hace falta
    const left = Math.max(0.12, this.botRunTo.t - (this.time.now - this.botRunTo.at) / 1000 - 0.08);
    const step = Math.min(d, Math.max(this.ai.speed * 1.4, d / left) * dt);
    if (d > 0.5) {
      bt.x += (dx / d) * step;
      bt.y += (dy / d) * step;
    }
    // corre de verdad (animación): el movimiento del bot lo toma de aquí mientras el guion lo lleva (update)
    this.botRun = { on: d > 2, dirX: Math.sign(dy) };
    // golpea con la pelota A SU LADO (no a dos metros): junto a su raqueta y en lo más cerca; si ya se le pasa, golpea igual
    if (this.serving) return false;
    // (26-11-2026, usuario) tu pelota ya botó 2 veces en su campo (saque directo muy rápido): igual va a ELLA y la devuelve (nunca otra de la nada)
    if (this.spLate) return this.reachDist(bt, s) <= HIT_RANGE;
    return s.vx > 0 && s.z <= HIT_MAX_Z * 1.4 && ((this.reachDist(bt, s) <= HIT_RANGE * 0.6 && this.atContact(bt, s)) || s.x >= bt.x + 20);
  }
  /** a dónde va el bot por la pelota en curso, en cuánto llega la pelota (s) y el vx con que se calculó (otro golpe = otro cálculo) */
  private botRunTo: { x: number; y: number; t: number; vx: number; at: number } | null = null;
  /**
   * Dónde estará tu pelota cuando, ya botada, llegue a la profundidad del bot (simulación con la física real). (25-11-2026, usuario) si la
   * pelota es CORTA (no llegaría a su profundidad antes del 2.º bote), el bot SUBE a buscarla: el punto es donde, tras el bote, baja a
   * altura de golpe (antes se quedaba atrás, no llegaba y salía otra pelota de la nada).
   */
  private predictBotMeet() {
    const bt = this.bot;
    const p: BallState = { ...this.ball.s };
    let bounced = !this.serving && this.bounces > 0;
    let last = { x: p.x, y: p.y };
    let t = 0;
    for (let i = 0; i < 480; i++) {
      if (stepBall(p, 1 / 120) === 'bounce') bounced = true;
      t += 1 / 120;
      last = { x: p.x, y: p.y };
      if (bounced && (p.x >= bt.x - 45 || (p.vz < 0 && p.z <= HIT_MAX_Z))) break;
    }
    return { x: clamp(last.x + 30, NET_X + 70, COURT.right + 160), y: clamp(last.y, COURT.top - 30, COURT.bottom + 30), t };
  }
  /** (25-11-2026, usuario) en las pausas del tutorial también se para el AMBIENTE (espectadores, paseantes, autos, farol) */
  private ambientPaused = false;
  private setAmbientPaused(on: boolean) {
    if (!on && !this.ambientPaused) return;
    this.ambientPaused = on;
    for (const o of this.children.list) {
      const d = (o as unknown as { depth: number }).depth;
      if (!(d > -20 && d < -19) && d !== -15) continue; // -15: el PÁJARO (fx/AmbientBird.ts)
      const sp = o as Phaser.GameObjects.Sprite;
      if (on) {
        if (sp.anims?.isPlaying) sp.anims.pause();
        for (const t of this.tweens.getTweensOf(o)) if (!t.isPaused()) t.pause();
      } else {
        if (sp.anims?.isPaused) sp.anims.resume();
        for (const t of this.tweens.getTweensOf(o)) if (t.isPaused()) t.resume();
      }
    }
  }

  /** el bot llevado por el guion (steerBotToBall): corre con su animación; se apaga solo cada fotograma */
  private botRun = { on: false, dirX: 0 };

  /** (25-11-2026, usuario) nivel 2, P3: tu saque va al bot y él juega como siempre (se mueve y golpea); su golpe se corrige en applyBotShot */
  private spLobPlays() {
    const k = this.spKind();
    return (k === 'lob' || k === 'drop' || k === 'remate') && this.spSt === 'fly'; // (25-11-2026, usuario) nivel 3: CORTITA y REMATE igual que el globo
  }
  /**
   * (25-11-2026, usuario) nivel 3, P3: lanzado el ESPECIAL del rival, tu personaje QUIETO (joystick bloqueado, sin toques; el DEFENSIVO ya está
   * apagado en los puntos guiados): no lo respondes y ves cómo funciona
   */
  private spSpecialLock() {
    return this.spKind() === 'special' && this.spSt === 'fed' && this.phase === 'rally';
  }
  /** (25-11-2026, usuario) nivel 3, P3: mientras saca el rival y hasta tu resto, él juega normal (se coloca y saca) */
  private spBotFree() {
    return this.spKind() === 'special' && this.spSt === 'serve';
  }
  /** saque del rival; (25-11-2026, usuario) nivel 3, P3: normal y limpio (le pega en lo más alto del lanzamiento) para que lo respondas */
  private planBotServe() {
    const plan = this.serveAI.plan(this.faults, this.ai.d);
    if (this.guide !== 'l3' || this.score.played !== 2) return plan;
    return { ...plan, kind: 'normal' as const, pressAt: Math.max(0, SERVE.tossVz / GRAVITY - this.bot.ch.serveContactDelay()) };
  }
  /** (25-11-2026, usuario) dónde espera el rival tu golpe guiado: globo = sube a SU T (le pasa por encima); cortita / remate = ATRÁS, en su fondo */
  private spBotSpot(k: 'lob' | 'drop' | 'remate') {
    return { x: k === 'lob' ? NET_X + (COURT.right - NET_X) * 0.538 : COURT.right + 30, y: LAT_C };
  }

  /** el bot devuelve (desde donde está) según el punto guiado */
  private spBotShot() {
    const k = this.spKind();
    if (!k) return;
    const s = this.ball.s;
    const p = this.player;
    const bt = this.bot;
    this.serving = false;
    this.serveCtl.startRally();
    this.bounces = 0;
    this.remateWhiffed = false;
    s.x = Math.max(NET_X + 90, bt.x - 15);
    s.y = bt.y;
    s.z = 45;
    s.ay = 0;
    this.spSt = 'fed';
    if (k === 'lob' || k === 'drop') {
      // (25-11-2026, usuario) como en el flujo normal: golpe NORMAL que bota en la T de tu lado; te mueves hasta que se para
      bt.ch.swing();
      aimShot(s, NET_X - (NET_X - COURT.left) * 0.538, LAT_C, SHOT_SPEED * 1.1, 14);
      this.ball.setKind('normal');
      this.ball.setPower(false);
      this.ball.setMaxCharge(false);
      this.lastHitter = 'bot';
      this.shotsThisPoint = Math.max(2, this.shotsThisPoint);
      const spot = this.spBotSpot(k);
      this.tweens.killTweensOf(bt);
      this.tweens.add({ targets: bt, x: spot.x, y: spot.y, duration: 550, delay: 150, ease: 'Sine.easeOut' });
    } else if (k === 'remate') {
      // (25-11-2026, usuario) globo corto hacia tu red: se para en el aire cerca de ella; vas y el REMATE sale solo
      this.applyBotShot({ tx: NET_X - 110, ty: clamp(p.y, COURT.top + 60, COURT.bottom - 60), speed: 430, kind: 'normal', margin: 110, intent: 'normal', quality: 1 }, false, 'fire'); // (26-11-2026, usuario) sin círculo
      this.lastHitter = 'bot';
      const spot = this.spBotSpot('remate');
      this.tweens.killTweensOf(bt);
      this.tweens.add({ targets: bt, x: spot.x, y: spot.y, duration: 550, delay: 150, ease: 'Sine.easeOut' });
    } else {
      // su ESPECIAL: no se puede devolver
      this.spForceSpecial = true;
      this.botHit(false, 'fire', true);
      this.spForceSpecial = false;
    }
  }

  /** tu golpe del globo / la cortita: sale siempre bien (dentro y con su efecto) */
  private spPlayerShot() {
    const k = this.spKind();
    const s = this.ball.s;
    const h = this.spHold;
    if (h) Object.assign(s, h);
    this.spHold = null;
    this.spPin = null;
    this.player.ch.setCharging(false); // suelta la pose de carga: el golpe sigue desde la raqueta atrás
    this.spClock?.destroy();
    this.spClock = undefined;
    this.playerHit();
    const ty = clamp(this.bot.y, COURT.top + 60, COURT.bottom - 60);
    if (k === 'lob') {
      // (25-11-2026, usuario) globo más ALTO (~320 de altura, ~1,6 s; antes ~200): pasa el mínimo del globo (LOB_SMASH) y la cámara se aleja
      aimShot(s, COURT.right - 80, ty, 400, 20);
      this.ball.setKind('lob');
      this.tutMission('t02Lob');
      // (26-11-2026, usuario) el rival se QUEDA en su T: no llega al globo y pierde el punto
      this.tweens.killTweensOf(this.bot);
      this.spBotPin = this.spBotSpot('lob');
    } else {
      aimShot(s, NET_X + 70, ty, 300, 16);
      s.damp = 0.3;
      this.ball.setKind('drop');
      this.tutMission('t03Drop');
      // (25-11-2026, usuario) como el SMASH del remate: el nombre del golpe sobre tu personaje
      const h = this.aboveHeadPos(this.player);
      this.time.delayedCall(150, () => this.popText(h.x, h.y, 'DROP SHOT!', '#ffffff', 34) /* (25-11-2026, usuario) blanco, como la estela de la cortita */);
    }
    this.lastHitter = 'player';
    this.spSt = 'done';
  }

  /**
   * (25-11-2026, usuario) nivel 3, P2: llegaste a la pelota parada en el aire cerca de la red: SMASH NORMAL solo (golpe por arriba,
   * sin la pose de carga ni el golpe potenciado / SMASH perfecto del remate con cámara lenta: no le pega tan fuerte)
   */
  private spSmash() {
    if (this.spKind() !== 'remate' || this.spSt !== 'hold' || !this.spHold) return;
    const s = this.ball.s;
    Object.assign(s, this.spHold);
    this.spHold = null;
    this.spPin = null;
    // al cuadro de saque del rival, lejos de él (está atrás)
    const t = this.remateTarget({ col: this.bot.y > LAT_C ? -1 : 1, row: 'short' });
    const fx = this.player.ch.swing(false, true); // golpe por ARRIBA normal (sin carga)
    aimShot(s, t.x, t.y, SHOT_SPEED * 1.15, 8);
    this.ball.setPower(false);
    this.ball.setMaxCharge(false);
    this.ball.setKind('normal', false, this.trailLook);
    this.recordHit('player');
    this.bounces = 0;
    this.ai.onPlayerHit(false);
    this.hitFxAt(fx, s.x, s.y, s.z, false, 0.15);
    const h = this.aboveHeadPos(this.player);
    this.time.delayedCall(fx, () => this.popText(h.x, h.y, 'SMASH!', '#ffd23f', 34));
    this.tutMission('tRemate');
    this.lastHitter = 'player';
    this.spSt = 'done';
  }

  /** golpes durante el punto guiado: true = nadie golpea ahora (lo hace el guion) */
  private spBlockHits(_s: BallState) {
    const k = this.spKind();
    if (this.spLobPlays()) return false; // (25-11-2026, usuario) nivel 2, P3: el bot devuelve tu saque jugando normal
    // (25-11-2026, usuario) nivel 3, P3: el saque del rival lo respondes NORMAL (luego su ESPECIAL lo lleva el guion)
    if (k === 'special' && this.spSt === 'serve') return this.lastHitter === 'player';
    return true; // globo / cortita / remate: se para delante de ti y el golpe lo da el guion (tickScripted); ESPECIAL: no se devuelve
  }

  /**
   * (26-11-2026, usuario) NIVEL 3, P4: el ESPECIAL del rival bota en tu lado y, al subir, se PARA (tú y el tiempo); reloj y USA EL
   * DEFENSIVO. Con el DEFENSIVO llegas a ella pero te ATURDE (devolución floja); el rival te la devuelve, se para tras su bote y vas a
   * hacer el punto. Devuelve el texto.
   */
  private tickDefSpecial(): string {
    const s = this.ball.s;
    const now = this.time.now;
    if (this.spPin) {
      this.player.x = this.spPin.x;
      this.player.y = this.spPin.y;
    }
    if (this.spBotPin && this.spSt === 'done') {
      this.bot.x = this.spBotPin.x;
      this.bot.y = this.spBotPin.y;
    }
    if (this.spSt === 'fed' && this.lastHitter === 'bot' && s.x < NET_X && this.bounces > 0 && (s.vz <= 0 || s.z >= 25)) {
      this.spSt = 'defwait';
      this.spHold = { x: s.x, y: s.y, z: s.z };
      this.spDefVel = { vx: s.vx, vy: s.vy, vz: s.vz };
      this.spHoldAt = now;
      this.spPin = { x: this.player.x, y: this.player.y };
      this.spClock?.destroy();
      this.spClock = this.guideClock(SP_LOB_CLOCK_MS);
    }
    if (this.spSt === 'defwait' && this.spHold) {
      Object.assign(s, this.spHold);
      s.vx = s.vy = s.vz = 0;
      this.bot.ch.freezePose();
      if (!this.spDefRunning) this.player.ch.freezePose(); // (26-11-2026, usuario) tu sprite también quieto en la pausa
      const waited = now - this.spHoldAt;
      if (waited >= SP_LOB_CLOCK_MS && this.spClock) {
        this.spClock.destroy();
        this.spClock = undefined;
      }
      if (!this.spDefRunning && waited >= SP_LOB_CLOCK_MS + L2_DEF_AUTO_MS) this.spDefDash(); // 15 s sin pulsarlo: lo usa solo
      return this.spDefRunning ? '' : SP_TEXT.defensive;
    }
    // la devolución del rival: tras su bote en tu lado, al bajar, se PARA; vas a ella (cuando se te pase el aturdido) y haces el punto
    if (this.spSt === 'fed2' && this.lastHitter === 'bot' && s.x < NET_X && this.bounces > 0 && s.vz <= 0) {
      this.spSt = 'approach2';
      this.spHold = { x: s.x, y: s.y, z: s.z };
    }
    if (this.spSt === 'approach2' && this.spHold) {
      Object.assign(s, this.spHold);
      s.vx = s.vy = s.vz = 0;
      this.bot.ch.freezePose();
      if (this.player.stun > 0) return '';
      if (this.inReach(this.player, s, HIT_RANGE * 1.1, Infinity)) {
        this.spHold = null;
        this.playerHit();
        aimShot(s, COURT.right - 90, this.bot.y > LAT_C ? COURT.top + 60 : COURT.bottom - 60, SHOT_SPEED * 1.1, 18);
        this.ball.setKind('normal');
        this.lastHitter = 'player';
        this.spSt = 'done';
        this.spBotPin = { x: this.bot.x, y: this.bot.y };
        return '';
      }
      return SP_TEXT.lobGo;
    }
    return '';
  }

  /** (26-11-2026, usuario) nivel 3, P4: el DEFENSIVO contra el ESPECIAL parado: corres a él y te aturde (devolución floja al rival) */
  private spDefDash(): boolean {
    const f = this.spHold;
    const v = this.spDefVel;
    if (this.spSt !== 'defwait' || !f || !v || this.spDefRunning) return false;
    if (this.time.now - this.spHoldAt < SP_LOB_CLOCK_MS) return false; // primero el reloj (la instrucción)
    this.spDefRunning = true;
    this.spPin = null;
    this.spClock?.destroy();
    this.spClock = undefined;
    const pl = this.player;
    const tx = clamp(f.x - 22, P_X[0], P_X[1]);
    const ty = clamp(f.y, Y_MIN, Y_MAX);
    const dirX = Math.sign(ty - pl.y) || 1;
    const dist = Math.hypot(tx - pl.x, ty - pl.y);
    this.stopCharge();
    stopMotion(this.motion);
    for (const sp of spritesIn(pl.ch)) if (sp.anims?.isPaused) sp.anims.resume(); // sale de la pausa
    pl.ch.setSprint(true, dirX);
    const p = project(pl.x, pl.y);
    this.dashFx.burst(p.sx, p.sy, p.s * VIEW.CHAR_K, pl.ch.depth);
    sfx(this, dashSfx(this.smashEl));
    const h = this.headPos(pl);
    this.popText(h.x, h.y - 10, 'DEFENSIVO', '#c9a4ff', 26);
    this.tweens.add({
      targets: pl,
      x: tx,
      y: ty,
      duration: clamp((dist / (PLAYER_SPEED * 3)) * 1000, 250, 700),
      ease: 'Quad.easeOut',
      onComplete: () => {
        pl.ch.setSprint(false, dirX, true);
        if (this.spSt !== 'defwait' || this.phase !== 'rally') return;
        const s = this.ball.s;
        Object.assign(s, f, v);
        this.spHold = null;
        this.spDefRunning = false;
        this.spSt = 'stun';
        pl.ch.facing = ty < pl.y ? -1 : 1;
        this.playerImpact(false, true); // el ESPECIAL te ATURDE: devolución floja al rival
        // (26-11-2026, usuario) aviso en pantalla 2,5 s
        const W = this.scale.width;
        const msg = this.add.text(W / 2, this.scale.height * 0.3, 'AL RECIBIR UN ESPECIAL\nTE ATURDES', { ...textStyle(40, '#ffd23f'), stroke: '#2a1600', strokeThickness: 8, align: 'center' }).setOrigin(0.5).setScrollFactor(0).setDepth(6080).setScale(0.4);
        this.tweens.add({ targets: msg, scale: 1, duration: 300, ease: 'Back.easeOut' });
        this.tweens.add({ targets: msg, alpha: 0, delay: 2500, duration: 300, onComplete: () => msg.destroy() });
      },
    });
    return true;
  }

  // ---------------------------------------------------------------- NIVEL 5 GUIADO (26-11-2026, usuario)
  /**
   * P1 = DROP SHOT 0: sacas; el rival devuelve al medio; la pelota se para junto a ti: CARGA al máximo y JOYSTICK ABAJO (no la alcanza).
   * P2 = SMASH con el CÍRCULO: sacas; el rival no llega bien, se estira y te tira un globo: aparece el círculo; 2 s de pausa con reloj
   * (CAMINA AL CÍRCULO); vas a él y rematas (TOCA PARA REMATAR): misión SMASH CARGADO.
   */
  private g5St: 'serve' | 'ret' | 'fly' | 'fed' | 'charge' | 'drop' | 'circle' | 'go' | 'spwait' | 'spcine' | 'spfly' | 'done' = 'serve';
  private g5Hold: { x: number; y: number; z: number } | null = null;
  private g5Vel: { vx: number; vy: number; vz: number } | null = null;
  private g5Pin: { x: number; y: number } | null = null;
  private g5At = 0;
  private g5Pulse = 0;
  private g5Clock?: Phaser.GameObjects.Container;

  private g5Point(): 0 | 1 | 2 | 3 | null {
    if (this.guide !== 'l5' || this.score.played > 3) return null;
    return this.score.played as 0 | 1 | 2 | 3;
  }
  private g5Reset() {
    this.g5St = (this.g5Point() ?? 0) >= 2 ? 'ret' : 'serve'; // P3 y P4: saca el rival
    this.g5At = this.time.now;
    this.g5Hold = null;
    this.g5Vel = null;
    this.g5Pin = null;
    this.g5Clock?.destroy();
    this.g5Clock = undefined;
  }
  private g5BlockHits(s: BallState) {
    // P2 / P4: solo el REMATE (desde que el globo vuela hacia ti)
    if (this.g5St === 'go') return !(this.remateCine || this.canStartRemate(s));
    // P3 / P4: tu RESTO del saque del rival
    if (this.g5St === 'ret') return this.lastHitter === 'player';
    // P4: tu ESPECIAL le llega al rival: lo aturde (fireImpact) y te devuelve un globo flojo (sale el círculo)
    if (this.g5St === 'spfly') return false;
    return true;
  }
  /** (26-11-2026, usuario) nivel 5, P4: pulsaste ESPECIAL con la pelota parada: su golpe (cinemática) va al rival */
  private g5Special(): boolean {
    if (this.g5Point() !== 3 || this.g5St !== 'spwait' || !this.g5Hold) return false;
    if (this.time.now - this.g5At < SP_LOB_CLOCK_MS) return false;
    this.g5Clock?.destroy();
    this.g5Clock = undefined;
    this.player.ch.setCharging(false);
    for (const sp of spritesIn(this.player.ch)) if (sp.anims?.isPaused) sp.anims.resume();
    this.smashArmed = true;
    this.smashBtn.setArmed(true);
    this.smashSnd?.destroy();
    this.smashSnd = null;
    if (this.cache.audio.exists('cargando')) {
      this.smashSnd = this.sound.add('cargando', { volume: 0.7 });
      this.smashSnd.play();
    }
    this.g5St = 'spcine';
    Object.assign(this.ball.s, this.g5Hold);
    if (!this.startSmashCine()) this.playerHit();
    return true;
  }
  private g5Freeze() {
    const s = this.ball.s;
    if (!this.g5Hold) return;
    Object.assign(s, this.g5Hold);
    s.vx = s.vy = s.vz = 0;
    this.bot.ch.freezePose();
  }

  private tickG5(): string {
    const pt = this.g5Point();
    if (pt === null) return '';
    const s = this.ball.s;
    const pl = this.player;
    const now = this.time.now;
    if (this.g5Pin) {
      pl.x = this.g5Pin.x;
      pl.y = this.g5Pin.y;
    }
    if (this.meServes && (this.phase === 'serve' || this.phase === 'toss')) return SP_TEXT.serve;
    if (this.g5St === 'ret') {
      // P3 / P4: saca el rival (limpio, en lo más alto) y lo respondes
      if (this.server === 'bot' && this.phase === 'serve' && this.serveCtl.state === 'POSITIONING' && now - this.g5At >= 1400) {
        this.botPlan.pressAt = Math.max(0, SERVE.tossVz / GRAVITY - this.bot.ch.serveContactDelay());
        this.beginToss('normal');
      }
      if (this.phase === 'rally' && !this.serving && this.lastHitter === 'player') this.g5St = 'fly';
      else return SP_TEXT.returnServe;
    }
    if (this.phase !== 'rally') return '';
    // el rival va a TU pelota y la devuelve
    if (this.g5St === 'fly' && this.lastHitter === 'player' && this.steerBotToBall()) {
      this.g4Unfreeze();
      if (pt === 2) {
        // P3: su DROP SHOT 0 (no lo alcanzas: pierdes el punto)
        const away = pl.y > LAT_C ? -1 : 1;
        this.applyBotShot({ tx: NET_X - (NET_X - COURT.left) * 0.14, ty: LAT_C + away * 90, speed: SHOT_SPEED * 0.9, kind: 'drop', margin: 5, intent: 'drop', quality: 1, dropZero: true }, false, 'fire');
        this.lastHitter = 'bot';
        this.spLate = false;
        this.g5St = 'done';
        const W = this.scale.width;
        const msg = this.add.text(W / 2, this.scale.height * 0.3, G5_TEXT.rivalDrop, { ...textStyle(38, '#ffd23f'), stroke: '#2a1600', strokeThickness: 8, align: 'center' }).setOrigin(0.5).setScrollFactor(0).setDepth(6080).setScale(0.4);
        this.tweens.add({ targets: msg, scale: 1, duration: 300, ease: 'Back.easeOut' });
        this.tweens.add({ targets: msg, alpha: 0, delay: 2500, duration: 300, onComplete: () => msg.destroy() });
        return '';
      }
      if (pt === 0 || pt === 3) {
        // P1: al MEDIO de tu campo, a ti
        this.applyBotShot({ tx: clamp(pl.x + 30, COURT.left + 18, NET_X - 55), ty: clamp(pl.y, COURT.top + 40, COURT.bottom - 40), speed: SHOT_SPEED * 0.9, kind: 'normal', margin: 16, intent: 'normal', quality: 1 }, false, 'fire');
      } else {
        // P2: no llega bien: se ESTIRA y te tira un GLOBO (sale el círculo)
        const side = s.y > this.bot.y ? 1 : -1;
        if (!this.bot.ch.lunge(side)) this.bot.ch.swing();
        this.dustFx(this.bot.x, this.bot.y);
        this.applyBotShot({ tx: NET_X - (NET_X - COURT.left) * 0.42, ty: LAT_C, speed: SHOT_SPEED * 0.72, kind: 'lob', margin: 90, intent: 'lob', quality: 1 }, false, 'fire');
      }
      this.lastHitter = 'bot';
      this.spLate = false;
      this.g5St = 'fed';
    }
    // ---------------- P4: ESPECIAL (aturde al rival) y luego el SMASH del círculo
    if (pt === 3) {
      if (this.g5St === 'fed' && this.lastHitter === 'bot' && s.x < NET_X && this.bounces > 0 && (this.inReach(pl, s, HIT_RANGE * 0.7) || s.x <= pl.x + 22)) {
        this.g5St = 'spwait';
        this.g5Hold = { x: s.x, y: s.y, z: Math.max(30, s.z) };
        this.g5Pin = { x: pl.x, y: pl.y };
        this.g5At = now;
        this.smashBtn.reduceCooldown(999);
        this.g5Clock?.destroy();
        this.g5Clock = this.guideClock(SP_LOB_CLOCK_MS);
      }
      if (this.g5St === 'spwait') {
        this.g5Freeze();
        pl.ch.setCharging(true);
        if (now - this.g5At > 300) pl.ch.freezePose();
        if (now - this.g5At >= SP_LOB_CLOCK_MS + L2_DEF_AUTO_MS) this.g5Special(); // 15 s: sale solo
        return G4_TEXT.special;
      }
      if (this.g5St === 'spcine') {
        if (this.lastHitter === 'player') {
          // tu ESPECIAL va DERECHO al rival (lo aturde al tocarlo)
          aimShot(s, this.bot.x - 10, this.bot.y, SHOT_SPEED * 1.4, 10);
          this.g5Hold = null;
          this.g5Pin = null;
          this.g5St = 'spfly';
          this.tutMission('tSpecial');
        } else this.g5Freeze();
        return '';
      }
      if (this.g5St === 'spfly' && this.lastHitter === 'bot') this.g5St = 'fed'; // aturdido: te devolvió el globo flojo
    }
    // ---------------- P1: DROP SHOT 0
    if (pt === 0) {
      if (this.g5St === 'fed' && this.lastHitter === 'bot' && s.x < NET_X && this.bounces > 0 && (this.inReach(pl, s, HIT_RANGE * 0.7) || s.x <= pl.x + 22)) {
        this.g5St = 'charge';
        this.g5Hold = { x: s.x, y: s.y, z: Math.max(30, s.z) };
        this.g5Pin = { x: pl.x, y: pl.y };
      }
      if (this.g5St === 'charge') {
        this.g5Freeze();
        if (this.chargeFull) {
          this.g5St = 'drop';
          this.g5At = now;
          this.g5Pulse = 0;
        } else return this.charging ? G4_TEXT.charging : G4_TEXT.charge;
      }
      if (this.g5St === 'drop') {
        this.g5Freeze();
        if (now - this.g5Pulse > 1100) {
          this.g5Pulse = now;
          this.joy.pulse('down');
        }
        const v = this.inputVector();
        if (v.y > 0.5 || now - this.g5At > L2_DEF_AUTO_MS) {
          Object.assign(s, this.g5Hold);
          this.g5Hold = null;
          this.g5Pin = null;
          if (v.y <= 0.5) {
            // pasado el tiempo: abajo de todos modos (la última dirección del joystick)
            this.lastDir.set(0, 1);
            this.lastDirAt = this.time.now;
          }
          this.playerHit(); // cargado al MÁXIMO + abajo = DROP SHOT 0
          this.lastHitter = 'player';
          this.g5St = 'done';
          return '';
        }
        return G5_TEXT.drop;
      }
      return '';
    }
    // ---------------- P2 (y P4 tras el ESPECIAL): SMASH con el CÍRCULO
    if (pt === 2) return '';
    if (this.g5St === 'fed' && this.lastHitter === 'bot' && this.lob.state.active && this.lob.state.receiver === 'player') {
      // salió el círculo: pausa de 2 s con el reloj
      this.g5St = 'circle';
      this.g5Hold = { x: s.x, y: s.y, z: s.z };
      this.g5Vel = { vx: s.vx, vy: s.vy, vz: s.vz };
      this.g5Pin = { x: pl.x, y: pl.y };
      this.g5At = now;
      this.g5Clock?.destroy();
      this.g5Clock = this.guideClock(2000);
    }
    if (this.g5St === 'circle') {
      this.g5Freeze();
      if (now - this.g5At >= 2000) {
        Object.assign(s, this.g5Hold, this.g5Vel);
        this.g5Hold = null;
        this.g5Pin = null;
        this.g5Clock?.destroy();
        this.g5Clock = undefined;
        this.g4Unfreeze();
        this.g5St = 'go';
      }
      return G5_TEXT.circle;
    }
    if (this.g5St === 'go') {
      if (this.lastHitter === 'player') {
        this.g5St = 'done';
        if (pt === 1) this.tutMission('t05Smash');
        const h = this.aboveHeadPos(pl);
        this.time.delayedCall(200, () => this.popText(h.x, h.y, '¡SMASH CARGADO!', '#ffd23f', 34));
        return '';
      }
      return this.remateCine ? G5_TEXT.tap : G5_TEXT.circle;
    }
    return '';
  }

  /** punto del nivel 5 que termina antes de tiempo: no cuenta (OTRA VEZ) o sigue (el rival va a tu pelota) */
  private g5Retry() {
    const pt = this.g5Point();
    if (pt === null || this.g5St === 'done') return false;
    if (this.g5St === 'fly') {
      this.spLate = true;
      return true;
    }
    if (this.g5St === 'spfly') return true; // el ESPECIAL sigue su camino al rival
    this.phase = 'pointover';
    this.faults = 0;
    const h0 = this.headPos(this.player);
    this.popText(h0.x, h0.y - 10, 'OTRA VEZ', '#ffc42e', 36);
    this.time.delayedCall(1100, () => this.startPoint(false));
    return true;
  }

  // ---------------------------------------------------------------- NIVEL 4 GUIADO (26-11-2026, usuario)
  /**
   * P1 = ESPECIAL: sacas, el rival devuelve a tu T, la pelota se para; vas a ella, reloj y USA EL ESPECIAL (punto tuyo).
   * P2 = CARGANDO: saca el rival; antes de su lanzamiento, TOCA A LA DERECHA PARA CARGAR (cuadro azul) hasta el máximo; su saque se
   * para delante de ti y apuntas a un lado (punto tuyo).
   * P3 = GLOBO CARGADO: respondes su saque; el rival va a su T y tu pelota se para junto a él: CARGA otra vez; te la devuelve, se para
   * y JOYSTICK ARRIBA = globo cargado (punto tuyo).
   */
  private g4St: 'serve' | 'fly' | 'fed' | 'approach' | 'wait' | 'cine' | 'pre' | 'charging' | 'tossed' | 'aim' | 'ret' | 'fly3' | 'charge3' | 'fed3' | 'lob3' | 'done' = 'serve';
  private g4Hold: { x: number; y: number; z: number } | null = null;
  private g4At = 0;
  private g4Pin: { x: number; y: number } | null = null;
  private g4Clock?: Phaser.GameObjects.Container;
  private g4Pulse = 0;
  /** (26-11-2026) nivel 4, P2: los botones de habilidad se ocultaron (se muestran otra vez al terminar) */
  private g4HidBtns = false;

  /** punto guiado del nivel 4 en curso (0, 1, 2) o null */
  private g4Point(): 0 | 1 | 2 | null {
    if (this.guide !== 'l4' || this.score.played > 2) return null;
    return this.score.played as 0 | 1 | 2;
  }
  private g4Reset() {
    this.g4St = this.g4Point() === 0 ? 'serve' : this.g4Point() === 1 ? 'pre' : 'ret';
    this.g4Hold = null;
    this.g4Pin = null;
    this.g4At = this.time.now;
    if (this.g4Point() === 0) this.smashBtn.reduceCooldown(999); // P1: el ESPECIAL listo
    this.g4Clock?.destroy();
    this.g4Clock = undefined;
  }
  private g4ClockStart() {
    this.g4At = this.time.now;
    this.g4Clock?.destroy();
    this.g4Clock = this.guideClock(SP_LOB_CLOCK_MS);
  }
  private g4ClockDone() {
    const done = this.time.now - this.g4At >= SP_LOB_CLOCK_MS;
    if (done && this.g4Clock) {
      this.g4Clock.destroy();
      this.g4Clock = undefined;
    }
    return done;
  }
  /** golpes: en los puntos guiados del nivel 4 los da el guion (salvo tu resto del saque en el P3) */
  private g4BlockHits() {
    if (this.g4Point() === 2 && this.g4St === 'ret') return this.lastHitter === 'player';
    return true;
  }
  /** botones de habilidad apagados, salvo el ESPECIAL cuando se pide (P1) */
  private g4LockAbilities() {
    return this.g4Point() !== null && !(this.g4Point() === 0 && this.g4St === 'wait');
  }
  /** la carga se permite en el nivel 4 solo cuando el guion la pide */
  private g4ChargeOk() {
    return (this.g4Point() === 1 && this.g4St === 'pre') || (this.g4Point() === 2 && this.g4St === 'charge3');
  }
  /** P1: pulsaste ESPECIAL (o pasaron 15 s): se arma y sale su golpe sobre la pelota parada */
  private g4Special(): boolean {
    if (this.g4Point() !== 0 || this.g4St !== 'wait' || !this.g4Hold) return false;
    if (!this.g4ClockDone()) return false;
    this.g4Clock?.destroy();
    this.g4Clock = undefined;
    this.player.ch.setCharging(false); // suelta la pose de carga: el golpe sigue desde ahí
    for (const sp of spritesIn(this.player.ch)) if (sp.anims?.isPaused) sp.anims.resume();
    // armado directo (sin las reglas del saque y su resto): sale su golpe ya
    this.smashArmed = true;
    this.smashBtn.setArmed(true);
    // (26-11-2026, usuario) los mismos sonidos que al armar el ESPECIAL (activateSmash): el de CARGANDO hasta el golpe
    this.smashSnd?.destroy();
    this.smashSnd = null;
    if (this.cache.audio.exists('cargando')) {
      this.smashSnd = this.sound.add('cargando', { volume: 0.7 });
      this.smashSnd.play();
    }
    this.g4St = 'cine';
    Object.assign(this.ball.s, this.g4Hold);
    if (!this.startSmashCine()) this.playerHit();
    return true;
  }
  /** el rival devuelve (desde donde está la pelota) hacia `tx, ty` con un golpe normal */
  private g4BotShot(tx: number, ty: number, speed: number) {
    this.g4Unfreeze();
    this.applyBotShot({ tx, ty, speed, kind: 'normal', margin: 16, intent: 'normal', quality: 1 }, false, 'fire');
    this.lastHitter = 'bot';
    this.spLate = false;
  }
  /** el rival vuelve a moverse (su pose estaba congelada) */
  private g4Unfreeze() {
    for (const sp of spritesIn(this.bot.ch)) if (sp.anims?.isPaused) sp.anims.resume();
  }
  /** congela la pelota en `g4Hold` cada fotograma (y al rival en su pose) */
  private g4Freeze() {
    const s = this.ball.s;
    if (!this.g4Hold) return;
    Object.assign(s, this.g4Hold);
    s.vx = s.vy = s.vz = 0;
    this.bot.ch.freezePose();
  }
  /** la pelota del rival, ya botada en tu lado, llega a ti: true = se para aquí */
  private g4Arrived() {
    const s = this.ball.s;
    // (26-11-2026, usuario) se para MÁS CERCA de ti (antes a 1,3 veces el alcance: quedaba muy atrás)
    return this.lastHitter === 'bot' && s.x < NET_X && this.bounces > 0 && (this.inReach(this.player, s, HIT_RANGE * 0.7) || s.x <= this.player.x + 22);
  }
  /** congela la pelota JUNTO a tu raqueta (si pasó un poco de lado, se acerca a ti) */
  private g4HoldAtPlayer() {
    const s = this.ball.s;
    const near = this.inReach(this.player, s, HIT_RANGE * 0.7);
    this.g4Hold = { x: near ? s.x : this.player.x + 26, y: near ? s.y : this.player.y + (s.y > this.player.y ? 24 : -24), z: Math.max(30, s.z) };
  }

  /** cada fotograma del nivel 4 guiado: devuelve el texto */
  private tickG4(): string {
    const pt = this.g4Point();
    if (pt === null) return '';
    const s = this.ball.s;
    const now = this.time.now;
    const pl = this.player;
    if (this.g4Pin) {
      pl.x = this.g4Pin.x;
      pl.y = this.g4Pin.y;
    }
    // ---------------- P1: ESPECIAL
    if (pt === 0) {
      if (this.meServes && (this.phase === 'serve' || this.phase === 'toss')) return SP_TEXT.serve;
      if (this.phase !== 'rally') return '';
      const chase = this.lastHitter === 'player' && this.g4St === 'fly';
      if (chase && this.steerBotToBall()) {
        this.g4BotShot(NET_X - (NET_X - COURT.left) * 0.538, LAT_C, SHOT_SPEED); // a tu T
        this.g4St = 'fed';
      }
      // (26-11-2026, usuario) se para un poco DESPUÉS de la T (antes, en lo alto del bote: muy atrás)
      const tT = NET_X - (NET_X - COURT.left) * 0.538;
      if (this.g4St === 'fed' && this.lastHitter === 'bot' && s.x < NET_X && this.bounces > 0 && (s.x <= tT - 45 || s.vz <= 0)) {
        this.g4St = 'approach';
        this.g4Hold = { x: s.x, y: s.y, z: s.z };
      }
      if (this.g4St === 'approach') {
        this.g4Freeze();
        if (this.inReach(pl, s)) {
          this.g4St = 'wait';
          this.g4Pin = { x: pl.x, y: pl.y };
          this.g4ClockStart();
        } else return SP_TEXT.lobGo;
      }
      if (this.g4St === 'wait') {
        this.g4Freeze();
        // (26-11-2026, usuario) quieto en la pose de CARGAR golpe (sin temblar) hasta pulsar ESPECIAL
        pl.ch.setCharging(true);
        if (now - this.g4At > 300) pl.ch.freezePose();
        if (this.g4ClockDone() && now - this.g4At >= SP_LOB_CLOCK_MS + L2_DEF_AUTO_MS) this.g4Special(); // 15 s: sale solo
        return G4_TEXT.special;
      }
      if (this.g4St === 'cine') {
        if (this.lastHitter === 'player') {
          this.g4St = 'done';
          this.tutMission('tSpecial');
          this.g4Pin = null;
          this.g4Hold = null;
        } else this.g4Freeze();
      }
      return '';
    }
    // ---------------- P2: CARGANDO
    if (pt === 1) {
      if (this.g4St === 'pre' || this.g4St === 'charging') {
        // el rival espera con la pelota en la mano (su saque no empieza hasta que la carga está llena)
        this.bot.ch.freezePose();
        if (this.charging && this.g4St === 'pre') this.g4St = 'charging';
        if (this.g4St === 'charging' && !this.charging) this.g4St = 'pre'; // la soltaste: otra vez
        if (this.g4St === 'charging' && this.chargeFull) {
          this.g4St = 'tossed';
          this.botPlan.pressAt = Math.max(0, SERVE.tossVz / GRAVITY - this.bot.ch.serveContactDelay());
          this.time.delayedCall(350, () => {
            if (this.g4Point() !== 1 || this.phase !== 'serve' || this.serveCtl.state !== 'POSITIONING') return;
            this.g4Unfreeze();
            this.beginToss('normal');
          });
          return '';
        }
        return this.g4St === 'charging' ? G4_TEXT.charging : G4_TEXT.charge;
      }
      if (this.g4St === 'tossed' && this.phase === 'rally' && !this.serving && this.g4Arrived()) {
        this.g4St = 'aim';
        this.g4HoldAtPlayer();
        this.g4At = now;
        this.g4Pulse = 0;
      }
      if (this.g4St === 'aim') {
        this.g4Freeze();
        const v = this.inputVector();
        if (now - this.g4Pulse > 1100) {
          this.g4Pulse = now;
          this.joy.pulse(Math.floor(now / 1100) % 2 ? 1 : -1);
        }
        const side = Math.abs(v.x) > 0.5 ? Math.sign(v.x) : now - this.g4At > L2_DEF_AUTO_MS ? 1 : 0;
        if (side) {
          Object.assign(s, this.g4Hold);
          this.g4Hold = null;
          this.playerHit();
          // a la esquina de ese lado (en pantalla derecha = +y), fuerte y dentro
          aimShot(s, COURT.right - 70, side > 0 ? COURT.bottom - 45 : COURT.top + 45, SHOT_SPEED * 1.35, 10);
          this.tutMission('tCharge');
          this.lastHitter = 'player';
          this.g4St = 'done';
          return '';
        }
        return G4_TEXT.aim;
      }
      return '';
    }
    // ---------------- P3: GLOBO CARGADO
    if (this.g4St === 'ret') {
      // saca el rival (limpio, en lo más alto del lanzamiento)
      if (this.server === 'bot' && this.phase === 'serve' && this.serveCtl.state === 'POSITIONING' && now - this.g4At >= 1400) {
        this.botPlan.pressAt = Math.max(0, SERVE.tossVz / GRAVITY - this.bot.ch.serveContactDelay());
        this.beginToss('normal');
      }
      if (this.phase === 'rally' && !this.serving && this.lastHitter === 'player') {
        this.g4St = 'fly3';
        // el rival se va a SU T
        const t = this.spBotSpot('lob');
        // (26-11-2026, usuario) tu resto va SIEMPRE a su T (el rival no tiene que ir a buscarla)
        aimShot(s, t.x, t.y, SHOT_SPEED, 16);
        this.tweens.killTweensOf(this.bot);
        this.tweens.add({ targets: this.bot, x: t.x, y: t.y, duration: 500, ease: 'Sine.easeOut' });
      } else return SP_TEXT.returnServe;
    }
    if (this.phase !== 'rally') return '';
    if (this.g4St === 'fly3' && this.lastHitter === 'player' && s.x > NET_X && s.x >= this.bot.x - 140) {
      // tu pelota llega al rival: se PARA junto a él; carga otra vez
      this.g4St = 'charge3';
      this.g4At = now;
      this.g4Hold = { x: s.x, y: s.y, z: Math.max(30, s.z) };
      this.tweens.killTweensOf(this.bot);
      this.tweens.add({ targets: this.bot, y: clamp(s.y, Y_MIN, Y_MAX), duration: 250 });
      this.g4Pin = { x: pl.x, y: pl.y };
    }
    if (this.g4St === 'charge3') {
      if (this.g4Hold) {
        Object.assign(s, this.g4Hold);
        s.vx = s.vy = s.vz = 0;
      }
      // (26-11-2026, usuario) el rival, junto a tu pelota, quieto en su pose de CARGAR golpe (congelada) hasta devolverla
      this.bot.ch.setCharging(true);
      if (now - this.g4At > 300) this.bot.ch.freezePose();
      if (this.chargeFull) {
        Object.assign(s, this.g4Hold);
        this.g4Hold = null;
        this.bot.ch.setCharging(false);
        this.g4Unfreeze();
        this.bot.ch.swing();
        // (26-11-2026, usuario) DIRECTA a ti (más plana y justo a tus pies)
        this.g4BotShot(clamp(pl.x + 25, COURT.left + 18, NET_X - 55), clamp(pl.y, COURT.top + 30, COURT.bottom - 30), SHOT_SPEED * 0.95);
        this.g4St = 'fed3';
        return '';
      }
      return this.charging ? G4_TEXT.charging : G4_TEXT.charge;
    }
    if (this.g4St === 'fed3' && this.g4Arrived()) {
      this.g4St = 'lob3';
      this.g4HoldAtPlayer();
      this.g4At = now;
      this.g4Pulse = 0;
    }
    if (this.g4St === 'lob3') {
      this.g4Freeze();
      if (now - this.g4Pulse > 1100) {
        this.g4Pulse = now;
        this.joy.pulse('up');
      }
      const v = this.inputVector();
      if (v.y < -0.5 || now - this.g4At > L2_DEF_AUTO_MS) {
        Object.assign(s, this.g4Hold);
        this.g4Hold = null;
        this.g4Pin = null;
        this.playerHit();
        // GLOBO DISPARADO: alto y al fondo, por encima del rival en su T
        aimShot(s, COURT.right - 70, this.bot.y > LAT_C ? COURT.top + 70 : COURT.bottom - 70, 430, 30);
        this.ball.setKind('lob');
        this.tutMission('tChargedLob');
        this.lastHitter = 'player';
        this.g4St = 'done';
        // (26-11-2026, usuario) el rival se QUEDA en su T (no va a buscarla): el globo le pasa por encima y pierde el punto
        this.tweens.killTweensOf(this.bot);
        this.g4Unfreeze();
        return '';
      }
      return G4_TEXT.lob;
    }
    return '';
  }

  /** punto del nivel 4 que termina antes de tiempo: no cuenta (se repite) o sigue (la pelota la va a buscar el rival) */
  private g4Retry(w: Who) {
    const pt = this.g4Point();
    if (pt === null || this.g4St === 'done') return false;
    if (pt === 0 && this.g4St === 'fly') {
      this.spLate = true; // tu saque botó 2 veces antes de que llegara: el punto sigue y él va a ella
      return true;
    }
    void w;
    this.phase = 'pointover';
    this.faults = 0;
    const h0 = this.headPos(this.player);
    this.popText(h0.x, h0.y - 10, 'OTRA VEZ', '#ffc42e', 36);
    this.time.delayedCall(1100, () => this.startPoint(false));
    return true;
  }

  /** punto que termina antes de tiempo: el bot vuelve a tirarla (true = no cuenta) */
  private spRetry(w: Who) {
    const k = this.spKind();
    if (!k) return false;
    // tu saque botó dos veces antes de llegar al bot: igual te la devuelve. (25-11-2026, usuario) nivel 3, P3: tu RESTO no (nada de otra
    // pelota de la nada): el bot va siempre a ella (predictBotMeet); si fallaste (red / fuera), el punto es del rival
    if (this.spSt === 'fly' && k !== 'special') {
      // (26-11-2026, usuario) antes salía otra pelota desde el bot (de la nada): ahora el punto sigue y el bot va a TU pelota
      this.spLate = true;
      return true;
    }
    // (26-11-2026, usuario) nivel 3, P3: el punto termina antes del ESPECIAL (no respondiste el saque, tu resto se fue, falta…): NO cuenta,
    // se repite el punto hasta ver el ESPECIAL del rival
    // (26-11-2026, usuario) nivel 3, P4: tu devolución floja botó 2 veces antes de que llegara el rival: el punto sigue y él va a ella
    if (k === 'defspecial' && this.spSt === 'stun') {
      this.spLate = true;
      return true;
    }
    if ((k === 'special' && (this.spSt === 'serve' || this.spSt === 'fly')) || (k === 'defspecial' && this.spSt !== 'done')) {
      this.phase = 'pointover';
      this.faults = 0;
      const h0 = this.headPos(this.player);
      this.popText(h0.x, h0.y - 10, 'OTRA VEZ', '#ffc42e', 36);
      this.time.delayedCall(1100, () => this.startPoint(false));
      return true;
    }
    if (k === 'special' || w !== 'bot') return false;
    if (this.spSt !== 'fed' && this.spSt !== 'hold' && this.spSt !== 'approach') return false;
    this.spHold = null;
    this.spBotShot();
    return true;
  }

  /** cada fotograma del punto guiado: devuelve el texto */
  private tickScripted(): string {
    const k = this.spKind();
    if (!k) return '';
    const s = this.ball.s;
    if (this.meServes && (this.phase === 'serve' || this.phase === 'toss')) return SP_TEXT.serve;
    if (k === 'special' && !this.meServes && (this.phase === 'serve' || this.phase === 'toss')) return SP_TEXT.returnServe; // (25-11-2026, usuario) nivel 3, P3
    if (this.phase !== 'rally') return '';
    // (25-11-2026, usuario) nivel 3, P3: hasta que respondes el saque del rival, juego normal; respondido, él va a tu pelota y tira su ESPECIAL
    if (k === 'special' && this.spSt === 'serve') {
      if (this.lastHitter === 'player' && !this.serving) this.spSt = 'fly';
      else return SP_TEXT.returnServe;
    }
    const lobDrop = k === 'lob' || k === 'drop'; // (25-11-2026, usuario) la CORTITA (nivel 3, P1) sigue el mismo flujo que el GLOBO
    // (25-11-2026, usuario) todos los puntos guiados: el bot va a TU pelota y la devuelve cuando le llega: la MISMA pelota, nunca una nueva
    const chase = this.phase === 'rally' && this.lastHitter === 'player' && (this.spSt === 'serve' || this.spSt === 'fly' || this.spSt === 'stun');
    if (chase && this.steerBotToBall()) {
      if (this.spSt === 'fly') {
        if (k === 'special' || k === 'defspecial') {
          // nivel 3, P3: su ESPECIAL (no se devuelve); P4: otra vez, y lo respondes con el DEFENSIVO
          this.spForceSpecial = true;
          this.botHit(false, 'fire', true);
          this.spForceSpecial = false;
          this.spSt = 'fed';
        } else this.botHit();
      } else if (this.spSt === 'stun' && k === 'defspecial') {
        // (26-11-2026, usuario) P4: tu devolución floja (aturdido) le llega: te la devuelve suave a tu campo
        this.applyBotShot({ tx: NET_X - (NET_X - COURT.left) * 0.5, ty: LAT_C + (this.player.y > LAT_C ? -1 : 1) * 70, speed: SHOT_SPEED * 0.9, kind: 'normal', margin: 24, intent: 'normal', quality: 1 }, false, 'fire');
        this.lastHitter = 'bot';
        this.spLate = false;
        this.spSt = 'fed2';
      }
    }
    if (k === 'defspecial') return this.tickDefSpecial();
    if (this.spPin) {
      this.player.x = this.spPin.x;
      this.player.y = this.spPin.y;
    }
    if (this.spBotPin && this.spSt === 'done') {
      this.bot.x = this.spBotPin.x;
      this.bot.y = this.spBotPin.y;
    }
    // (25-11-2026, usuario) GLOBO, 1) la pelota bota en la T y, al subir, se PARA (pulsando); vuelve tu control para ir a ella
    if (this.spSt === 'fed' && lobDrop && this.lastHitter === 'bot' && s.x < NET_X && this.bounces > 0 && s.vz > 0 && s.z >= 20) {
      this.spSt = 'approach';
      this.spHold = { x: s.x, y: s.y, z: s.z };
      this.spPin = null;
      // el rival ya en su sitio (globo: su T; cortita: atrás; si aún iba, llega de una vez) y quieto durante la pausa
      this.tweens.killTweensOf(this.bot);
      Object.assign(this.bot, this.spBotSpot(k));
    }
    // (25-11-2026, usuario) REMATE (nivel 3, P2): el globo corto del rival se PARA en el aire cerca de tu red (al bajar); vas a él
    if (this.spSt === 'fed' && k === 'remate' && this.lastHitter === 'bot' && s.x < NET_X && ((s.vz < 0 && s.z <= SP_REMATE_Z) || this.bounces > 0)) {
      this.spSt = 'approach';
      this.spHold = { x: s.x, y: s.y, z: s.z }; // (26-11-2026, usuario) la MISMA posicion en que venia (sin salto)
      this.spPin = null;
      this.tweens.killTweensOf(this.bot);
      Object.assign(this.bot, this.spBotSpot('remate'));
    }
    if (this.spSt === 'approach' && this.spHold && k === 'remate') {
      Object.assign(s, this.spHold);
      s.vx = s.vy = s.vz = 0;
      this.bot.ch.freezePose();
      // al llegar debajo (sin mirar la altura): REMATA solo con un smash normal (sin pose de carga ni salto del remate potenciado)
      if (this.inReach(this.player, s, HIT_RANGE * 1.25, Infinity)) {
        this.spSt = 'hold';
        this.spHoldAt = this.time.now;
        this.spPin = { x: this.player.x, y: this.player.y };
        this.time.delayedCall(150, () => this.spSmash());
      } else return SP_TEXT.lobGo;
    }
    if (this.spSt === 'approach' && this.spHold) {
      Object.assign(s, this.spHold);
      s.vx = s.vy = s.vz = 0;
      this.bot.ch.freezePose(); // (25-11-2026, usuario) el rival también en pausa (su sprite quieto)
      // 2) al llegar a ella (tu rango de golpe): te quedas y OBLIGADO el joystick arriba (cortita: abajo); a los 10 s sale solo
      if (this.inReach(this.player, s)) {
        this.spSt = 'hold';
        this.spHoldAt = this.time.now;
        this.spPin = { x: this.player.x, y: this.player.y };
        this.player.ch.setCharging(true); // pose de CARGA (antes del impacto); se congela sin temblar (abajo)
        // (25-11-2026, usuario) reloj de 1,5 s mostrando el joystick ARRIBA (cortita: ABAJO); recién después se puede golpear
        this.spClock?.destroy();
        this.spClock = this.guideClock(SP_LOB_CLOCK_MS);
        this.spPulseAt = 0;
      } else return SP_TEXT.lobGo;
    }
    if (this.spSt === 'hold' && this.spHold) {
      Object.assign(s, this.spHold);
      s.vx = s.vy = s.vz = 0;
      if (k === 'remate') this.bot.ch.freezePose(); // (el salto del remate: el golpe sale solo, spSmash)
      const v = this.inputVector(); // joystick o teclado (W = arriba, S = abajo)
      if (lobDrop) {
        // (25-11-2026, usuario) en la pelota: tu personaje QUIETO en su pose de CARGA (sin temblar) hasta el golpe, y el rival en pausa
        this.player.ch.setCharging(true);
        if (this.time.now - this.spHoldAt > 300) this.player.ch.freezePose();
        this.bot.ch.freezePose();
        // el joystick indica ARRIBA (cortita: ABAJO) una y otra vez (que se note)
        if (this.time.now - this.spPulseAt > 1100) {
          this.spPulseAt = this.time.now;
          this.joy.pulse(k === 'drop' ? 'down' : 'up');
        }
        const waited = this.time.now - this.spHoldAt;
        if (waited >= SP_LOB_CLOCK_MS && this.spClock) {
          this.spClock.destroy();
          this.spClock = undefined;
        }
        const pushed = k === 'drop' ? v.y > 0.5 : v.y < -0.5;
        if ((waited >= SP_LOB_CLOCK_MS && pushed) || waited >= SP_LOB_CLOCK_MS + SP_LOB_AUTO_MS) this.spPlayerShot();
        else return k === 'drop' ? SP_TEXT.drop : SP_TEXT.lob;
      }
    }
    if (this.spSt === 'fed' && this.lastHitter === 'player') this.spSt = 'done';
    if (this.spSt === 'fed' && k === 'special' && this.ball.power) return SP_TEXT.special;
    return '';
  }

  /** `atBall`: el bot ya llegó a tu pelota (steerBotToBall): la devuelve desde donde está, sin sacarla de su raqueta */
  private feedPracticeReturn(atBall = false) {
    this.serving = false;
    this.serveCtl.startRally();
    this.bounces = 0;
    const p = this.player;
    const s = this.ball.s;
    const defensive = !this.practiceChargeLimit();
    if (this.guide === 'spin' && this.l2Freeze) return; // ya hay un tiro esperando el DEFENSIVO
    if (this.guide === 'spin') this.l2Stage = 'fed';
    // (25-11-2026, usuario) DEFENSIVO: golpe FUERTE y plano a la esquina contraria a la tuya (bota cerca de la línea lateral)
    const x = defensive ? COURT.left + 120 : clamp(p.x + 55, COURT.left + 18, NET_X - 55);
    // (nivel 2: siempre a tu IZQUIERDA, la mitad de arriba de la pantalla)
    // (25-11-2026, usuario) nivel 2: al lado CONTRARIO al tuyo
    const y = defensive ? (p.y < LAT_C ? COURT.bottom - 25 : COURT.top + 25) : clamp(p.y, COURT.top + 6, COURT.bottom - 6);
    if (!atBall) {
      s.x = Math.max(NET_X + 90, this.bot.x - 15);
      s.y = this.bot.y;
      s.z = 45;
    } else s.z = Math.max(s.z, 30);
    this.bot.ch.swing(defensive);
    if (defensive) aimShot(s, x, y, 720, 14, 1.2);
    else aimShot(s, x, y, 380, 30);
    if (!defensive) s.damp = 0.3;
    this.ball.setKind('normal');
    this.ball.setMaxCharge(false);
    this.lastHitter = 'bot';
    this.shotsThisPoint = Math.max(2, this.shotsThisPoint);
    // (25-11-2026, usuario) nivel 2: la pausa del entrenador sale cuando la pelota BOTA en tu lado (handleBounce), no al tirarla
  }

  // (25-11-2026, usuario) NIVEL 2: ya sin pausas del entrenador; la pelota se congela y pulsas DEFENSIVO (tickGuide / activateDash)

  // ---------------------------------------------------------------- EJERCICIOS de los niveles 3 y 4 (24-11-2026, usuario)
  /** pasos del ejercicio: nivel 3 = izquierda, derecha, cortita; nivel 4 = te lo muestra el juego, lo haces tú */
  private lessonSteps() {
    return this.lesson === 3 ? 3 : this.lesson === 4 ? 2 : 0;
  }
  /** ¿Se está haciendo el ejercicio? (primer punto, hasta terminar sus pasos) */
  private lessonPractice() {
    return !!this.lesson && this.score.played === 0 && this.lessonStep < this.lessonSteps();
  }
  /** El bot lanza una pelota cómoda hacia ti y sale la explicación del paso (una vez por paso). */
  private feedLessonBall() {
    this.serving = false;
    this.serveCtl.startRally();
    this.bounces = 0;
    const p = this.player;
    const s = this.ball.s;
    s.x = Math.max(NET_X + 90, this.bot.x - 15);
    s.y = this.bot.y;
    s.z = 45;
    this.bot.ch.swing();
    aimShot(s, clamp(p.x + 55, COURT.left + 18, NET_X - 55), clamp(p.y, COURT.top + 40, COURT.bottom - 40), 360, 30);
    this.ball.setKind('normal');
    this.ball.setPower(false);
    this.ball.setMaxCharge(false);
    this.lastHitter = 'bot';
    this.shotsThisPoint = Math.max(2, this.shotsThisPoint);
    this.lessonOnFeed();
  }
  private lessonOnFeed() {
    const step = this.lessonStep;
    if (this.lessonAsked === step) return;
    this.lessonAsked = step;
    const texts = this.lesson === 3
      ? ['Al golpear, el joystick decide hacia dónde va. Mueve el joystick a la IZQUIERDA y golpea.', 'Ahora a la DERECHA.', 'Joystick ABAJO al golpear: una cortita junto a la red.']
      : ['Pulsa ESPECIAL para armar tu golpe: sale como una bola de poder y, si el rival la toca, queda aturdido. Mira.', 'Ahora tú: pulsa ESPECIAL y golpea.'];
    const begin = () => {
      if (this.lesson === 4 && step === 0) return this.lessonAuto(step); // la demostración
      this.coach.attempt(() => this.lessonStep > step, () => this.lessonAuto(step));
    };
    this.coach.pause(texts[step] ?? '', begin);
  }
  /** El juego hace el paso por ti: AUTO con la dirección del paso (nivel 3) o arma el ESPECIAL y golpea (nivel 4). */
  private lessonAuto(step: number) {
    if (this.lesson === 3) {
      this.lessonAim = [new Phaser.Math.Vector2(-1, 0), new Phaser.Math.Vector2(1, 0), new Phaser.Math.Vector2(0, 1)][step] ?? null;
    } else if (this.lesson === 4) {
      this.smashBtn.reduceCooldown(999);
      // si aún no se puede armar (saque, sin pelota), lo vuelve a intentar enseguida
      if (!this.smashArmed && !this.activateSmash()) {
        this.coach.attempt(() => this.lessonStep > step, () => this.lessonAuto(step), undefined, 300);
        return;
      }
    }
    this.coach.demo(true);
  }
  /** Cada golpe tuyo durante el ejercicio. */
  private lessonPlayerHit(power: boolean) {
    if (!this.lessonPractice()) return;
    const step = this.lessonStep;
    let ok = false;
    if (this.lesson === 3) {
      const want = (['left', 'right', 'drop'] as const)[step];
      ok = this.shotFromJoystick() === want;
      if (ok) this.tutMission((['t03Left', 't03Right', 't03Drop'] as const)[step]);
    } else if (this.lesson === 4) {
      ok = power;
      if (ok && step === 1) this.tutMission('t04Arm');
      if (ok) this.smashBtn.reduceCooldown(999); // listo para el paso siguiente
    }
    if (!ok) return;
    this.lessonStep++;
    this.lessonAim = null;
    this.coach.demo(false);
    if (this.lessonPractice()) this.lessonOnFeed(); // el siguiente paso, ya
  }

  /** (25-11-2026, usuario) centro (a lo ancho) de la mitad izquierda (-1) o derecha (1) de tu cancha */
  private guideTargetY(side: number) {
    return LAT_C + side * (LAT_C - COURT.top) / 2;
  }

  /** tu línea de saque (el fondo de los cuadros de saque, como computeServeBox) */
  private guideServiceLine() {
    return NET_X - (NET_X - COURT.left) * 0.538;
  }

  /**
   * (25-11-2026, usuario) cuadros del primer partido, en tu lado: 0 = el rectángulo de abajo (de la línea de fondo a la de saque), mitad izquierda;
   * 1 = cuadro de saque de arriba a la izquierda; 2 = arriba a la derecha; 3 = todo el rectángulo de abajo. `side` cambia el lado de 0 (1 = derecha).
   */
  private guideZoneRect(i: number, side?: -1 | 1) {
    const sv = this.guideServiceLine();
    const half = (s: number) => (s < 0 ? { y0: COURT.top, y1: LAT_C, side: -1 } : { y0: LAT_C, y1: COURT.bottom, side: 1 });
    if (i === 0) return { x0: COURT.left, x1: sv, ...half(side ?? -1) }; // (25-11-2026, usuario) solo el de abajo: de la línea de fondo a la de saque
    if (i === 1) return { x0: sv, x1: NET_X, ...half(-1) };
    if (i === 2) return { x0: sv, x1: NET_X, ...half(1) };
    if (i === 4) return { x0: sv, x1: NET_X, y0: COURT.top, y1: COURT.bottom, side: 0 }; // (25-11-2026, usuario) todo el de delante (de la línea de saque a la red)
    return { x0: COURT.left, x1: sv, y0: COURT.top, y1: COURT.bottom, side: 0 };
  }

  /** ¿Tu personaje está dentro del cuadro? (en los de abajo vale estar detrás de la línea de fondo) */
  private inGuideZone(r: ReturnType<MatchScene['guideZoneRect']>) {
    const p = this.player;
    const xOk = r.x0 === COURT.left ? p.x <= r.x1 - 12 : p.x >= r.x0 + 15;
    const yOk = r.side < 0 ? p.y <= LAT_C - 10 : r.side > 0 ? p.y >= LAT_C + 10 : true; // (25-11-2026, usuario) margen más chico: dentro del cuadro ya vale
    return xOk && yOk;
  }

  /** (25-11-2026, usuario) un check verde (sin texto) con efecto de logro en el cuadro que acabas de tocar */
  private guideCheck(r: ReturnType<MatchScene['guideZoneRect']>) {
    sfx(this, 'equipar');
    const c = project((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2);
    const x = c.sx;
    const y = c.sy - 40;
    // (25-11-2026, usuario) por DETRÁS de tu personaje (antes 6066, encima)
    const D = this.player.ch.depth - 4;
    // aro que se expande
    const ring = this.add.graphics().setDepth(D).setPosition(x, y);
    ring.lineStyle(6, 0x7dffb0, 1).strokeCircle(0, 0, 40);
    ring.setScale(0.6);
    this.tweens.add({ targets: ring, scale: 2.2, alpha: 0, duration: 520, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
    // destellos que salen hacia fuera
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const st = this.add.star(x, y, 4, 4, 10, 0xfff3bb).setDepth(D);
      this.tweens.add({ targets: st, x: x + Math.cos(a) * 85, y: y + Math.sin(a) * 85, angle: 180, alpha: 0, scale: 0.4, duration: 600, ease: 'Quad.easeOut', onComplete: () => st.destroy() });
    }
    // el check: entra con rebote, late mientras se ve y se va subiendo
    const g = this.add.container(x, y).setDepth(D + 1);
    const glow = this.add.graphics();
    glow.fillStyle(0x7dffb0, 0.35).fillCircle(0, 0, 50);
    const ic = this.add.graphics();
    ic.fillStyle(0x000000, 0.35).fillCircle(2, 4, 38);
    ic.fillStyle(0x2ecc71, 1).fillCircle(0, 0, 38);
    ic.lineStyle(5, 0xffffff, 1).strokeCircle(0, 0, 38);
    ic.lineStyle(10, 0xffffff, 1).beginPath().moveTo(-17, 1).lineTo(-5, 15).lineTo(19, -13).strokePath();
    g.add([glow, ic]);
    g.setScale(0.2);
    this.tweens.add({ targets: g, scale: 1, duration: 280, ease: 'Back.easeOut' });
    this.tweens.add({ targets: glow, scale: 1.25, alpha: 0.4, duration: 300, delay: 280, yoyo: true, repeat: 1 });
    this.tweens.add({ targets: g, alpha: 0, y: y - 30, delay: 1000, duration: 350, onComplete: () => g.destroy() });
    this.guideCheckObjs = [ring, g];
  }
  /** (25-11-2026, usuario) pelota quieta del tutorial: aros que laten a su alrededor (para que se vea a dónde ir) */
  private ballPulse?: Phaser.GameObjects.Graphics;
  private ballPulseAt = 0;
  private tickBallPulse(on: boolean) {
    if (!on) {
      this.ballPulse?.setVisible(false);
      this.ballPulseAt = 0;
      return;
    }
    if (!this.ballPulseAt) this.ballPulseAt = this.time.now;
    this.ballPulse ??= this.add.graphics();
    const s = this.ball.s;
    const b = project(s.x, s.y, s.z);
    const t = ((this.time.now - this.ballPulseAt) % 900) / 900; // un latido cada 0,9 s
    const g = this.ballPulse.setVisible(true).clear().setDepth(6000 + b.sy + 5);
    const r0 = 14 * b.s;
    g.lineStyle(5 * b.s, 0xffd23f, 1 - t).strokeCircle(b.sx, b.sy, r0 + 34 * b.s * t);
    g.lineStyle(3 * b.s, 0xffffff, 0.8 * (1 - t)).strokeCircle(b.sx, b.sy, r0 + 18 * b.s * t);
  }

  /** (25-11-2026, usuario) el check y su aro, siempre por DETRÁS de tu personaje (su profundidad cambia con el oscurecido) */
  private guideCheckObjs: Phaser.GameObjects.GameObject[] = [];
  private keepCheckBehind() {
    if (!this.guideCheckObjs.length) return;
    this.guideCheckObjs = this.guideCheckObjs.filter((o) => o.active);
    const D = this.player.ch.depth - 4;
    for (const o of this.guideCheckObjs) (o as Phaser.GameObjects.Container).setDepth(D + (o instanceof Phaser.GameObjects.Container ? 1 : 0));
  }

  /** (24-11-2026) misión del tutorial: solo cuenta si es de las de este nivel (domain/tutorialMissions.ts) */
  /** `alertTitle`: texto de la alerta si no es el título de la misión */
  private tutMission(id: MissionId, alertTitle?: string) {
    if (this.tutMissions?.includes(id)) this.guideMission(id, alertTitle);
  }

  private guideMission(id: MissionId, alertTitle?: string) {
    if (this.missions.done.includes(id)) return;
    if (this.tutMissions && !this.tutMissions.includes(id)) return;
    this.missions.done.push(id);
    const mission = missionDef(id);
    showMissionAlert(this, alertTitle ?? mission.title, missionReward(mission));
  }

  private guideFeed(r: ReturnType<MatchScene['guideZoneRect']>) {
    const s = this.ball.s;
    s.x = this.bot.x - 15;
    s.y = this.bot.y;
    s.z = 48;
    this.bot.ch.swing();
    this.bot.ch.holdFollowThrough(4); // (25-11-2026, usuario) queda en la pose del impacto hasta que le pegues (tiempo pausado)
    // el bote, dentro del cuadro y justo delante de ti: la pelota sigue hacia ti
    const p = this.player;
    const bx = clamp(p.x + 80, r.x0 + 20, r.x1 - 15);
    const by = clamp(p.y, r.y0 + 15, r.y1 - 15);
    aimShot(s, bx, by, 610, 24);
    this.lastHitter = 'bot';
    this.ball.setKind('normal');
    this.bounces = 0;
  }

  private guideHits() {
    const s = this.ball.s;
    if (this.score.played === 0) {
      const r = this.guideRally;
      // el saque quieto tras su bote (held) o la que te tira el bot (feed): le pegas al llegar a ella
      if (this.guideMove === 3 && (r.st === 'held' || (r.st === 'feed' && s.vx < 0 && this.bounces > 0))
        && this.inReach(this.player, s, HIT_RANGE * (r.st === 'held' ? 1 : 1.3), HIT_MAX_Z * 1.3)) { // (25-11-2026, usuario) antes 1,7: golpeaba muy antes de llegar
        if (r.st === 'held') this.guideMission('guideJoystick'); // (25-11-2026, usuario) fuiste a la pelota con el joystick
        this.bot.ch.releaseFollowThrough(); // se acaba la pausa: el bot vuelve a moverse
        for (const q of this.guideBotPose) if (q.sp.active && q.sp.anims?.isPaused) q.sp.anims.resume();
        this.guideBotPose = [];
        this.playerHit();
        // a la raqueta del bot (bota delante de él); el último, lejos de él: punto tuyo
        if (r.k >= 2) aimShot(s, COURT.right - 150, this.bot.y > LAT_C ? COURT.top + 60 : COURT.bottom - 60, 660, 24);
        else aimShot(s, this.bot.x - 200, this.bot.y, 660, 24);
        if (r.k >= 2) {
          // golpe desde el rectángulo de abajo: bota dos veces en su campo, punto tuyo (y el bot hace su pose de punto perdido)
          r.st = 'done';
          this.guideMission('guideJoystickUpDown');
        } else {
          r.k++;
          r.st = 'fly';
          r.bounced = false;
        }
      }
      return true;
    }
    if (this.score.played === 2 && this.lastHitter === 'player' && this.bounces > 0 && s.vx > 0 && this.inReach(this.bot, s, HIT_RANGE * 1.6)) this.guideDirectReturn();
    return true;
  }

  private guideDirectReturn() {
    const s = this.ball.s;
    if (!this.inReach(this.bot, s, HIT_RANGE * 1.6)) this.setActor(this.bot, s.x + 22, s.y);
    this.bot.ch.facing = s.y >= this.bot.y ? -1 : 1;
    this.bot.ch.swing();
    s.z = Math.max(22, s.z);
    aimShot(s, COURT.left + 120, COURT.bottom + 18, 680, 20);
    this.lastHitter = 'bot';
    this.bounces = 0;
    this.hitFx(s.x, s.y, s.z, false);
  }

  private tickGuide() {
    if (!this.guide) return;
    this.keepCheckBehind();
    this.joy.setLocked((this.guide === 'spin' && this.l2Lock) || this.spSpecialLock());
    // (26-11-2026, usuario) nivel 4, P2: sin DEFENSIVO ni ESPECIAL a la vista (solo se ve cómo funciona el CARGANDO)
    if (this.g4Point() === 1) {
      this.dashBtn.setVisible(false);
      this.smashBtn.setVisible(false);
      this.g4HidBtns = true;
    } else if (this.g4HidBtns && !this.serveUiOn()) {
      this.g4HidBtns = false;
      this.dashBtn.setVisible(true);
      this.smashBtn.setVisible(true);
    }
    // (25-11-2026, usuario) nivel 1, P2/P3: al lanzar la pelota desaparece el botón de SAQUE DIRECTO (pantalla limpia para leer); después del reloj se golpea tocando
    if (this.aimPausePoint() && this.phase === 'toss') {
      // P3 (saque directo): tras el reloj el botón vuelve (se golpea con él)
      const want = this.l2AimPause === 'wait' && this.guideServeLesson() === 'direct';
      if (this.serveNormalBtn.visible !== want) this.serveNormalBtn.setVisible(want);
      // (25-11-2026, usuario) la mano también se va al lanzar; vuelve con el botón / el cuadro tras el reloj
      if (this.l2AimPause !== 'wait' && this.guideHand) {
        this.guideHand.destroy();
        this.guideHand = undefined;
      }
    } // (25-11-2026, usuario) nivel 2: se ve que el joystick está bloqueado
    let text = '';
    let zone: ReturnType<MatchScene['guideZoneRect']> | null = null;
    // (26-11-2026, usuario) nivel 1, al empezar (pausa del joystick, antes de su saque): el sprite del rival QUIETO (sin animarse)
    const holdBot = this.guide === 'first' && this.score.played === 0 && this.guideMove < 3 && !this.entering && this.phase !== 'intro';
    if (holdBot) {
      for (const sp of spritesIn(this.bot.ch)) if (sp.anims?.isPlaying && !sp.anims.isPaused) sp.anims.pause();
      this.botPoseHeld = true;
    } else if (this.botPoseHeld) {
      this.botPoseHeld = false;
      for (const sp of spritesIn(this.bot.ch)) if (sp.anims?.isPaused) sp.anims.resume();
    }
    if (this.guide === 'first' && this.score.played === 0 && (this.phase === 'serve' || this.phase === 'toss' || this.phase === 'rally')) {
      // (25-11-2026, usuario) 1) izquierda (check) 2) derecha (misión) 3) el bot saca a tu derecha y le pegas 4) te la tira arriba a la
      // izquierda, 5) arriba a la derecha y 6) a todo el rectángulo de abajo (misión). Ese último golpe es punto tuyo.
      const step = this.guideMove;
      const r = this.guideRally;
      const p = this.player;
      // (25-11-2026, usuario) empiezas a la izquierda: 1) a la DERECHA (check) 2) el bot saca a tu IZQUIERDA y vas allí (check + misión)
      if (step <= 1) {
        zone = this.guideZoneRect(0, 1);
        text = 'MUEVE EL JOYSTICK A LA DERECHA';
        p.y = clamp(p.y, COURT.top + 24, COURT.bottom - 24);
        p.x = clamp(p.x, COURT.left - 68, zone.x1 - 14);
        if (this.inGuideZone(zone)) {
          this.guideCheck(zone);
          this.guideReadyAt = this.time.now + 900;
          this.guideMove = 2;
        }
      } else if (step === 2) {
        if (this.time.now >= this.guideReadyAt) {
          this.guideMove = 3;
          this.guideRally = { k: 0, st: 'serve' };
          // (25-11-2026, usuario) el bot le pega en lo MÁS ALTO del lanzamiento (contacto = cuando la pelota deja de subir)
          this.botPlan.pressAt = Math.max(0, SERVE.tossVz / GRAVITY - this.bot.ch.serveContactDelay());
          this.beginToss('normal');
        }
      } else if (r.k === 0) {
        // (25-11-2026, usuario) el saque del bot: tras su bote la pelota se QUEDA QUIETA (en lo alto del bote) hasta que llegues a ella
        const s = this.ball.s;
        // (25-11-2026, usuario) se queda pegada JUSTO tras el bote (sube un poco, sin avanzar mucho: sigue en el cuadro)
        // (25-11-2026, usuario) avanza tras el bote hasta CASI el final del cuadro de saque (la línea de saque) y ahí se pega
        if (r.st === 'serve' && !this.serving && this.bounces > 0 && (s.x <= this.guideServiceLine() - 60 || (s.vz <= 0 && s.z <= GUIDE_HOLD_Z))) { // (25-11-2026, usuario) avanza un poco más (pasa la línea de saque): no choca con el texto
          r.st = 'held';
          r.hold = { x: s.x, y: s.y, z: Math.max(GUIDE_HOLD_Z, s.z) };
          // (25-11-2026, usuario) tiempo pausado tras SU SAQUE: el bot se queda quieto en la pose que tenga en ese momento (no la del golpe)
          this.guideBotPose = spritesIn(this.bot.ch).map((sp) => ({ sp, key: sp.texture.key, frame: sp.frame.name }));
          for (const q of this.guideBotPose) q.sp.anims?.pause();
        }
        if (r.st === 'held') {
          for (const q of this.guideBotPose) {
            if (!q.sp.active) continue;
            if (q.sp.anims?.isPlaying && !q.sp.anims.isPaused) q.sp.anims.pause();
            if (q.sp.texture.key !== q.key || q.sp.frame.name !== q.frame) q.sp.setTexture(q.key, q.frame);
          }
        }
        if (r.st === 'held' && r.hold) {
          s.x = r.hold.x;
          s.y = r.hold.y;
          s.z = r.hold.z;
          s.vx = s.vy = s.vz = 0;
          text = 'MUEVE EL JOYSTICK HACIA LA PELOTA';
        }
      } else if (r.k >= 1 && r.st !== 'done') {
        zone = this.guideRallyZone(r.k);
        // (25-11-2026, usuario) primero solo izquierda/derecha (arriba/abajo, más adelante)
        text = r.k <= 1 ? 'MUEVE EL JOYSTICK A LA IZQUIERDA' : 'MUEVE EL JOYSTICK HACIA ARRIBA';
        const s = this.ball.s;
        // (25-11-2026, usuario) la que te tira el bot se QUEDA QUIETA en el cuadro (en lo alto de su bote) hasta que le pegues, como el saque
        if (r.st === 'feed' && this.bounces > 0 && s.x < NET_X && (s.x <= zone.x0 + (zone.x1 - zone.x0) * 0.2 || s.vz <= 0)) {
          r.st = 'held';
          r.hold = { x: s.x, y: s.y, z: Math.max(GUIDE_HOLD_Z, s.z) };
        }
        if (r.st === 'held' && r.hold) {
          s.x = r.hold.x;
          s.y = r.hold.y;
          s.z = r.hold.z;
          s.vx = s.vy = s.vz = 0;
          text = 'MUEVE EL JOYSTICK HACIA LA PELOTA';
        }
        // (25-11-2026, usuario) la pelota llega a la raqueta del bot: él se queda QUIETO en la pose del golpe y la pelota, quieta, hasta que
        // llegues al cuadro; entonces le pega
        // (se para en lo alto del bote en su campo, o antes de tocarle: si llegara a su cuerpo, contaría como punto)
        if (r.st === 'fly' && ((r.bounced && s.vz <= 0) || s.x >= this.bot.x - 90)) {
          r.st = 'wait';
          r.hold = { x: s.x, y: s.y, z: Math.max(20, s.z) };
          // (25-11-2026, usuario) mientras espera: la pose de CARGANDO el golpe; el impacto, cuando llegas al cuadro (guideFeed)
          this.bot.ch.facing = -1;
          this.bot.ch.setCharging(true);
        }
        if (r.st === 'wait') {
          const h = r.hold ?? { x: this.bot.x - 30, y: this.bot.y, z: 40 };
          s.x = h.x;
          s.y = h.y;
          s.z = h.z;
          s.vx = s.vy = s.vz = 0;
          if (this.inGuideZone(zone)) {
            this.bot.ch.setCharging(false);
            this.guideCheck(zone);
            this.guideFeed(zone);
            r.st = 'feed';
          }
        }
      }
    } else if (this.g4Point() !== null) {
      text = this.tickG4();
    } else if (this.g5Point() !== null) {
      text = this.tickG5();
    } else if (this.spKind()) {
      text = this.tickScripted();
    } else if (this.guide === 'spin' && this.practicingReturns()) {
      // (25-11-2026, usuario) nivel 2: primero SACAS (con su instrucción); el DEFENSIVO lo explica la pausa del entrenador
      // (25-11-2026, usuario) P2: saca el bot; su saque se queda quieto en lo alto del bote hasta que le pegas; tu devolución va al bot y él te
      // tira FUERTE al lado contrario (quieto: solo queda el DEFENSIVO)
      const bs0 = this.ball.s;
      if (this.meServes && (this.phase === 'serve' || this.phase === 'toss')) text = 'TE TOCA SACAR'; // (25-11-2026, usuario) P1: saque normal o directo
      if (this.l2Stage === 'serve' && this.server === 'bot' && this.phase === 'serve' && this.serveCtl.state === 'POSITIONING' && this.time.now >= this.l2ServeAt) this.beginToss('normal');
      if (this.l2Stage === 'serve' && this.phase === 'rally' && !this.serving && this.bounces > 0 && this.lastHitter === 'bot' && bs0.vz <= 0) {
        this.l2Stage = 'held';
        this.l2Hold = { x: bs0.x, y: bs0.y, z: Math.max(25, bs0.z) };
      }
      if (this.l2Stage === 'held' && this.l2Hold) {
        Object.assign(bs0, this.l2Hold);
        bs0.vx = bs0.vy = bs0.vz = 0;
        text = 'MUEVE EL JOYSTICK HACIA LA PELOTA';
      }
      // (25-11-2026, usuario) P1: el bot va a tu pelota y la devuelve cuando le llega (la misma, sin sacarla de su raqueta)
      if (this.l2Stage === 'fly' && this.phase === 'rally' && this.steerBotToBall()) {
        this.l2Stage = 'fed';
        this.feedPracticeReturn(true);
      }
      // el tiro del bot ya botó en tu lado: al levantarse un poco, se para el tiempo (pelota en el aire, el bot en su golpe)
      const bs = this.ball.s;
      if (this.level2PauseArmed && (bs.vz <= 0 || bs.z >= 25)) {
        this.level2PauseArmed = false;
        this.l2Freeze = { x: bs.x, y: bs.y, z: bs.z, vx: bs.vx, vy: bs.vy, vz: bs.vz };
        this.l2FreezeAt = this.time.now;
        this.bot.ch.facing = -1;
        this.bot.ch.swing(true);
        this.bot.ch.holdFollowThrough(4);
      }
      if (this.l2Freeze) {
        const f = this.l2Freeze;
        bs.x = f.x;
        bs.y = f.y;
        bs.z = f.z;
        bs.vx = bs.vy = bs.vz = 0;
        text = this.l2Running ? '' : 'USA EL DEFENSIVO';
        if (!this.l2Running && this.time.now - this.l2FreezeAt >= L2_DEF_AUTO_MS) this.l2Dash(); // (25-11-2026, usuario) 15 s sin pulsarlo: lo usa solo
      }
    } else if (this.practicingReturns() && this.phase === 'rally' && !this.serving) {
      if (this.score.played === 1) {
        text = this.guidePracticeStep === 0 ? 'PULSA DEFENSIVO PARA LLEGAR A LA PELOTA' : 'TOCA EL LADO DERECHO PARA CARGAR AL 50 %';
      } else {
        text = !this.charging ? 'TOCA EL LADO DERECHO PARA CARGAR AL 100 %'
          : this.guidePracticeStep === 0 ? 'JOYSTICK ARRIBA PARA EL GLOBO MÁXIMO' : 'JOYSTICK A UN LADO PARA EL TIRO MÁXIMO';
      }
    } else if (this.meServes && (this.phase === 'serve' || this.phase === 'toss')) {
      const lesson = this.guideServeLesson();
      const second = this.phase === 'toss';
      if (this.l2AimPause === 'on' || this.l2AimPause === 'wait') text = 'APUNTA CON EL JOYSTICK A CUALQUIERA DE LAS 6 ZONAS';
      else if (lesson === 'tap') text = second ? 'TOCA A LA DERECHA OTRA VEZ PARA GOLPEAR' : 'TOCA EL LADO DERECHO PARA SACAR';
      else if (lesson === 'direct') text = 'USA SAQUE DIRECTO'; // (25-11-2026, usuario) corto
      else if (lesson === 'spin') text = 'USA SAQUE CON EFECTO'; // (25-11-2026, usuario) corto; la mano sigue en el botón morado
    }
    this.tickBallPulse(text === 'MUEVE EL JOYSTICK HACIA LA PELOTA');
    this.dashBtn.setHint(!!this.l2Freeze || this.spDefWait());
    this.dashBtn.setDepth(this.l2Freeze || this.spDefWait() ? 5610 : 5000);
    this.smashBtn.setDepth((this.g4Point() === 0 && this.g4St === 'wait') || (this.g5Point() === 3 && this.g5St === 'spwait') ? 5610 : 5000); // (26-11-2026) nivel 4, P1: ESPECIAL sobre el oscuro // nivel 2: por encima del oscurecido mientras esperas pulsarlo
    this.tickGuideDim(text);
    // (25-11-2026, usuario) pausas del tutorial: el ambiente también se detiene
    // (26-11-2026, usuario) en TODA pausa del tutorial (con el oscurecido) el ambiente también se para: paseantes, espectadores, pájaro…
    const g4Pause = this.g4Point() !== null && ['pre', 'approach', 'wait', 'cine', 'aim', 'charge3', 'lob3'].includes(this.g4St);
    this.setAmbientPaused((this.guide === 'spin' && !!this.l2Freeze) || (!!this.spKind() && (this.spSt === 'approach' || this.spSt === 'hold' || this.spSt === 'defwait' || this.spSt === 'approach2')) || g4Pause || this.l2AimPause === 'on' || this.l2AimPause === 'wait' || (!!this.guide && !!this.guideDim?.visible));
    // (25-11-2026, usuario) el marcador se ve siempre, salvo con el oscurecido de una instrucción
    const hudA = this.guideDim?.visible ? 0.3 : 1;
    if (this.hud.alpha !== hudA) this.hud.setAlpha(hudA);
    if (text === this.guideNotice) return;
    this.guideNotice = text;
    this.guideText ??= this.add.text(this.scale.width / 2, 320, '', { ...textStyle(27, '#fff3bb'), align: 'center', wordWrap: { width: this.scale.width - 56 } }).setOrigin(0.5).setScrollFactor(0).setDepth(6070);
    this.guideText.setText(text).setVisible(!!text);
    // (25-11-2026, usuario) MUEVE EL JOYSTICK A LA DERECHA: el joystick hace UNA pulsación hacia la derecha (un poco después de salir el texto, para que se vea)
    if (text === SP_TEXT.lob || text === SP_TEXT.drop) {
      const dir = text === SP_TEXT.drop ? 'down' : 'up';
      this.time.delayedCall(450, () => this.guideNotice === text && this.joy.pulse(dir));
    }
    if (this.guide === 'first' && (text === 'MUEVE EL JOYSTICK A LA DERECHA' || text === 'MUEVE EL JOYSTICK A LA IZQUIERDA' || text === 'MUEVE EL JOYSTICK HACIA ARRIBA')) {
      const dir: -1 | 1 | 'up' = text.endsWith('DERECHA') ? 1 : text.endsWith('ARRIBA') ? 'up' : -1;
      this.time.delayedCall(450, () => this.guideNotice === text && this.joy.pulse(dir));
    }
    // nivel 1: el aviso, grande y a media pantalla (sobre el oscurecido); los demás, arriba como siempre
    // (25-11-2026, usuario) nivel 1, saque del bot: "HACIA LA PELOTA" más arriba (no tapa la pelota)
    const upper = this.guide === 'first' && this.score.played === 0 && this.guideRally.k === 0 && text === 'MUEVE EL JOYSTICK HACIA LA PELOTA';
    if (this.guide) this.guideText.setPosition(this.scale.width / 2, this.scale.height * (upper ? 0.34 : 0.46)).setFontSize(36);
    else this.guideText.setPosition(this.scale.width / 2, 320).setFontSize(27);
    this.guideZone?.clear();
    this.guideZonePts = [];
    // nivel 1, saque tocando: la mano toca el lado derecho de la pantalla
    this.guideHand?.destroy();
    this.guideHand = undefined;
    if (text === G4_TEXT.special) this.guideHand = tapHint(this, this.smashBtn.x, this.smashBtn.y, 6060); // (26-11-2026) nivel 4
    else if (text === G4_TEXT.charge) this.guideHand = tapHint(this, this.scale.width * 0.72, this.scale.height * 0.62, 6060);
    else if (this.guide === 'spin' && this.l2Freeze && text) this.guideHand = tapHint(this, this.dashBtn.x, this.dashBtn.y, 6060); // la mano, en el botón DEFENSIVO
    // (25-11-2026, usuario) nivel 2, P1 (TE TOCA SACAR): sin mano al sacar (solo la del DEFENSIVO, más adelante)
    else if (text && this.meServes && !(this.guide === 'spin' && this.score.played === 0) && this.l2AimPause !== 'on' && (this.phase === 'serve' || this.phase === 'toss')) {
      const ls = this.guideServeLesson();
      // (25-11-2026, usuario) nivel 1, P2/P3 con la pelota en el aire: sin mano hasta que pase el reloj; luego, tocar a la derecha
      if (this.aimPausePoint() && this.phase === 'toss') {
        if (this.l2AimPause === 'wait') this.guideHand = ls === 'direct' ? tapHint(this, this.serveNormalBtn.x, this.serveNormalBtn.y, 6060) : tapHint(this, this.scale.width * 0.72, this.scale.height * 0.62, 6060);
      } else if ((this.guide === 'first' && ls === 'tap') || (this.guide === 'spin' && this.practicingReturns()) || !!this.spKind()) this.guideHand = tapHint(this, this.scale.width * 0.72, this.scale.height * 0.62, 6060);
      // (25-11-2026, usuario) saque directo / con efecto: la mano en el botón que hay que pulsar
      else if (ls === 'direct') this.guideHand = tapHint(this, this.serveNormalBtn.x, this.serveNormalBtn.y, 6060);
      else if (ls === 'spin') this.guideHand = tapHint(this, this.serveSpinBtn.x, this.serveSpinBtn.y, 6060);
    }
    // (25-11-2026, usuario) nivel 1, tu PRIMER saque: un cuadro azul con borde en la PANTALLA, donde está la mano (dónde tocar)
    this.guideTapBox?.clear();
    if (text === G4_TEXT.charge || (text && this.guide === 'first' && this.meServes && this.guideServeLesson() === 'tap' && (this.phase === 'serve' || (this.phase === 'toss' && this.l2AimPause === 'wait')))) { // (25-11-2026, usuario) al lanzar desaparece; vuelve con la mano tras el reloj
      // (25-11-2026, usuario) toda la zona que de verdad se puede tocar (de 0,55 W a la derecha), de la red hacia abajo
      const W = this.scale.width, H = this.scale.height;
      const cam = this.cameras.main;
      const netY = clamp((project(NET_X, LAT_C).sy - cam.worldView.y) * cam.zoom, 40, H * 0.6);
      const x0 = W * 0.55 + 6, x1 = W - 10, y0 = netY, y1 = H - 10;
      this.guideTapBox ??= this.add.graphics().setScrollFactor(0).setDepth(6055);
      this.guideTapBox.fillStyle(0x3aa0ff, 0.22).fillRoundedRect(x0, y0, x1 - x0, y1 - y0, 22);
      this.guideTapBox.lineStyle(5, 0x3aa0ff, 1).strokeRoundedRect(x0, y0, x1 - x0, y1 - y0, 22);
    }
    if (zone) {
      // dentro de la cancha, de línea a línea (un poco hacia adentro para no tapar las líneas)
      const a = project(zone.x0 + 4, zone.y0 + 4);
      const b = project(zone.x0 + 4, zone.y1 - 4);
      const c = project(zone.x1 - 4, zone.y1 - 4);
      const d = project(zone.x1 - 4, zone.y0 + 4);
      this.guideZone ??= this.add.graphics().setDepth(1.5);
      this.guideZone.fillStyle(0xffd23f, 0.25).lineStyle(4, 0xffd23f, 0.9).fillPoints([a,b,c,d].map(({ sx, sy }) => ({ x: sx, y: sy })), true).strokePoints([a,b,c,d].map(({ sx, sy }) => ({ x: sx, y: sy })), true);
      this.guideZonePts = [a, b, c, d].map(({ sx, sy }) => ({ x: sx, y: sy }));
    }
  }

  /**
   * (25-11-2026, usuario) NIVEL 1 (guía 'first'), con un aviso en pantalla: todo se oscurece menos tu personaje, el cuadro al que tienes que ir,
   * la pelota y el joystick (y el botón de saque en la lección del saque directo). Solo el usuario: el rival bot queda oscurecido.
   */
  private tickGuideDim(text: string) {
    // (25-11-2026, usuario) siempre que se enseña algo: oscuro salvo tu personaje, el rival y la pelota (nivel 2: el saque y la pausa del DEFENSIVO)
    // (25-11-2026, usuario) nivel 2: oscuro en los 3 saques guiados (directo, el del DEFENSIVO, con efecto) y en la pelota quieta del DEFENSIVO
    const l2 = this.guide === 'spin' && (!!this.l2Freeze || (this.l2Stage === 'held' && this.practicingReturns()) || (this.meServes && this.score.played <= 2 && (this.phase === 'serve' || this.phase === 'toss')));
    const sp = !!this.spKind() && !!text && (this.spSt === 'hold' || this.spSt === 'approach' || this.spSt === 'defwait' || this.spSt === 'approach2' || (this.spSt === 'serve' && this.meServes)); // (25-11-2026, usuario) puntos guiados: al sacar y en la pelota quieta (también mientras vas a ella)
    const g4 = (this.g4Point() !== null || (this.g5Point() !== null && this.g5St !== 'go' && this.g5St !== 'circle' && this.g5St !== 'ret')) && !!text && text !== SP_TEXT.returnServe; // (26-11-2026, usuario) niveles 4 y 5
    const on = (this.guide === 'first' && !!text) || l2 || sp || g4;
    if (!on) {
      if (this.guideDim?.visible) {
        this.guideDim.setVisible(false);
        this.joy.setSpotlight(false);
        this.serveNormalBtn.setDepth(5000);
        this.serveSpinBtn.setDepth(5000);
        this.serveTag.setFront(false);
        this.player.depthBoost = 0;
        this.bot.depthBoost = 0;
        this.ball.depthBoost = 0;
      }
      return;
    }
    // por encima del marcador (5500); encima del oscurecido: joystick, botón de saque, aviso de quién saca y tu personaje
    this.guideDim ??= this.add.graphics().setDepth(5600);
    if (!this.guideDim.visible) this.guideDim.setVisible(true);
    // (25-11-2026, usuario) nivel 2, el reloj de la pausa del saque (1 s): oscuro TODO menos el texto y el reloj; luego el oscurecido normal
    if (this.l2AimPause === 'on') {
      this.joy.setSpotlight(false);
      this.serveNormalBtn.setDepth(this.guideServeLesson() === 'direct' ? 5610 : 5000); // (25-11-2026, usuario) se ve en GRIS (bloqueado) sobre el oscuro
      this.serveSpinBtn.setDepth(5000);
      this.serveTag.setFront(false);
      this.player.depthBoost = 0;
      this.ball.depthBoost = 0;
      this.bot.depthBoost = 0;
      const v0 = this.cameras.main.worldView;
      this.guideDim.clear().fillStyle(0x02060f, 0.6).fillRect(v0.x - 4, v0.y - 4, v0.width + 8, v0.height + 8);
      return;
    }
    this.joy.setSpotlight(true);
    this.serveNormalBtn.setDepth(this.guideServeLesson() === 'direct' && this.meServes ? 5610 : 5000);
    this.serveSpinBtn.setDepth(this.guideServeLesson() === 'spin' && this.meServes ? 5610 : 5000);
    this.serveTag.setFront(true);
    // tu personaje (solo sus sprites, sin recuadro) por encima del oscurecido
    this.player.depthBoost = 6000;
    this.ball.depthBoost = 6000; // la pelota también se ve (solo su dibujo)
    // (25-11-2026, usuario) cuando SACAS: sin oscurecer el cuadro donde va el saque; el rival se ve al sacar y en la pausa del nivel 2
    const serving = this.server === 'player' && (this.phase === 'serve' || this.phase === 'toss');
    // (25-11-2026, usuario) nivel 2: el rival queda OSCURECIDO (opaco); en el nivel 1 se ve cuando sacas
    this.bot.depthBoost = serving && this.guide === 'first' ? 6000 : 0;
    // (25-11-2026) sin máscara: el oscurecido se dibuja en 4 piezas ALREDEDOR del cuadro al que tienes que ir (en coordenadas del mundo,
    // las mismas del cuadro): arriba, abajo y los dos costados en diagonal. Sin cuadro, la pantalla entera.
    const v = this.cameras.main.worldView;
    const X0 = v.x - 4, X1 = v.right + 4, Y0 = v.y - 4, Y1 = v.bottom + 4;
    const g = this.guideDim.clear().fillStyle(0x02060f, 0.6);
    const sb = this.serveBox;
    const z = serving
      ? [project(sb.x0, sb.y0), project(sb.x0, sb.y1), project(sb.x1, sb.y1), project(sb.x1, sb.y0)].map(({ sx, sy }) => ({ x: sx, y: sy }))
      : this.guideZonePts;
    if (z.length !== 4) {
      g.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
      return;
    }
    // a, b = borde de cerca (abajo); c, d = borde del fondo (arriba)
    const [a, b, c, d] = z;
    const nl = a.x <= b.x ? a : b, nr = a.x <= b.x ? b : a;
    const fl = d.x <= c.x ? d : c, fr = d.x <= c.x ? c : d;
    const yT = Math.min(fl.y, fr.y), yB = Math.max(nl.y, nr.y);
    g.fillRect(X0, Y0, X1 - X0, yT - Y0);
    g.fillRect(X0, yB, X1 - X0, Y1 - yB);
    g.fillPoints([{ x: X0, y: yT }, fl, nl, { x: X0, y: yB }], true);
    g.fillPoints([fr, { x: X1, y: yT }, { x: X1, y: yB }, nr], true);
  }

  private tickRallyClock(dt: number) {
    if (this.phase !== 'rally' || this.serving || this.doingGuidePoint()) {
      if (this.rallyElapsed || this.rallyRemaining !== null) this.resetRallyClock();
      return;
    }
    if (this.rallyRemaining === null) {
      if (this.net?.role === 'guest') return;
      this.rallyElapsed += dt;
      if (this.rallyElapsed < RALLY_LIMIT.warnAfter) return;
      this.rallyRemaining = Math.max(0, RALLY_LIMIT.warnAfter + RALLY_LIMIT.countdown - this.rallyElapsed);
      this.net?.sendAction('rally-clock', { pt: this.netPt });
    } else {
      this.rallyRemaining = Math.max(0, this.rallyRemaining - dt);
    }
    this.rallyCountdown.show(Math.ceil(this.rallyRemaining));
    if (this.rallyRemaining > RALLY_LIMIT.dangerAt) return;
    this.drawRallyDanger(1 - this.rallyRemaining / RALLY_LIMIT.dangerAt);
  }

  private drawRallyDanger(intensity: number) {
    if (!this.rallyDanger) {
      const key = 'rally-danger-vignette';
      const size = 128;
      if (!this.textures.exists(key)) {
        const tex = this.textures.createCanvas(key, size, size);
        if (!tex) return;
        const ctx = tex.getContext();
        const light = ctx.createRadialGradient(64, 64, 21, 64, 64, 72);
        light.addColorStop(0, 'rgba(255,255,255,0)');
        light.addColorStop(0.4, 'rgba(255,255,255,0.07)');
        light.addColorStop(1, 'rgba(255,255,255,1)');
        ctx.fillStyle = light;
        ctx.fillRect(0, 0, size, size);
        tex.refresh();
      }
      this.rallyDanger = this.add.image(0, 0, key).setOrigin(0).setScrollFactor(0).setDepth(4900);
    }
    const color = Phaser.Display.Color.GetColor(255, Math.round(100 - 88 * intensity), 24);
    this.rallyDanger.setDisplaySize(this.scale.width, this.scale.height).setVisible(true).setTint(color).setAlpha(0.42 + intensity * 0.48);
  }

  update(_t: number, deltaMs: number) {
    if (this.net2 && this.diag) this.diag2Frame();
    this.netFlushHit(); // golpe propio de un temporizador (cinemáticas): se envía cuanto antes
    if (this.paused) return;
    this.coach.tick(deltaMs); // (24-11-2026) turno del ejercicio del tutorial (10 s)
    this.tickRallyClock(deltaMs / 1000);
    this.ultiTick(); // ULTI en juego (sin ULTI contra ULTI): se libera cuando su golpe se resolvió
    // cinemática del SMASH: el partido queda congelado (física, jugadores, IA, relojes); solo se animan sus efectos
    if (this.cine.active) {
      this.flu.lastFrame = 0; // (log de fluidez) la congelación de la cinemática no cuenta como tirón
      this.netCineSeen = true;
      if (this.net) {
        // (log) durante la cinemática no se envían ni reciben estados: no es un corte de red ni una caída de fps
        this.diagStateAt = performance.now();
        this.flu.lastIn = 0;
        this.fluSkip = true;
      }
      this.chargeSprite.hide(); // el efecto de carga no se queda congelado a medias
      this.rivalChargeSprite.hide();
      this.cine.update();
      return;
    }
    // (17-11-2026) ULTI LEGENDARIA: peloteo automático con el partido congelado
    if (this.legend) {
      this.flu.lastFrame = 0;
      if (this.net) {
        this.diagStateAt = performance.now();
        this.flu.lastIn = 0;
        this.fluSkip = true;
      }
      this.tickLegend(deltaMs);
      return;
    }
    if (this.legendFade) this.legendFade = this.energyCine.drawDark(0, Math.min(deltaMs / 1000, 0.05));
    // DUELO EN LA RED: tras el cara a cara el partido sigue parado (voleas, elección del lado, globo final)
    if (this.duel) {
      this.tickDuel(deltaMs);
      return;
    }
    const dt = Math.min(deltaMs / 1000, 0.05) * this.slowMo; // cámara lenta del REMATE
    if (this.netCineSeen) {
      // salió de una cinemática: el rival sigue desde donde quedó en ella (no salta al último estado que llegó)
      this.netCineSeen = false;
      if (this.net && !this.net2 && performance.now() >= this.netBotLockUntil) this.netAnchor(this.bot.x, this.bot.y);
      // 2v2 online: los actores remotos siguen desde donde quedaron en la cinemática (no saltan al último estado que llegó)
      else if (this.net2) for (let k = 0; k < 3; k++) {
        const ra = this.net2Actor(k);
        if (ra) this.net2Anchor(k, ra.x, ra.y);
      }
    }
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
      (this.spSt === 'hold' && !!this.spKind()) || // (25-11-2026, usuario) en la pelota del globo / la cortita: quieto en su pose de carga
      (this.g4Point() === 0 && (this.g4St === 'wait' || this.g4St === 'cine')) ||
      (this.g4Point() === 1 && this.g4St === 'pre') ||
      (this.g5Point() !== null && (this.g5St === 'charge' || this.g5St === 'drop' || this.g5St === 'circle' || this.g5St === 'spwait' || this.g5St === 'spcine')) || // (26-11-2026) nivel 5: quieto en las pausas
      (this.spKind() === 'defspecial' && (this.spSt === 'fed' || (this.spSt === 'defwait' && !this.spDefRunning))) || // (26-11-2026, usuario) desde su ESPECIAL hasta el DEFENSIVO: quieto // (26-11-2026, usuario) nivel 3, P4: quieto hasta el DEFENSIVO // (26-11-2026, usuario) nivel 4, P2: quieto hasta tocar a la derecha para cargar // (26-11-2026, usuario) nivel 4, P1: quieto en pose de carga hasta el ESPECIAL
      this.remateRecover > 0 || // cae tras el golpe al aire del remate
      pl.stun > 0 ||
      pl.vanished ||
      (this.dashHit !== null && !this.dashHit.sprint) || // DASH de teletransporte: se queda en el punto hasta devolver
      this.dashRun !== null || // DASH sprint: mientras corre lo mueve el sprint; al llegar queda libre
      this.phase === 'over' ||
      this.phase === 'pointover' || // (18-11-2026) quieto: su reacción al punto (ganado / perdido) no se corta
      this.phase === 'intro' ||
      (this.meServes && this.phase === 'toss') ||
      (this.meServes && this.phase === 'serve' && this.serveCtl.state !== 'POSITIONING');
    // al sacar (antes de lanzar) solo hay desplazamiento lateral dentro de la mitad de la línea de fondo
    const positioning = this.meServes && this.phase === 'serve' && this.serveCtl.state === 'POSITIONING';
    if (pl.stun > 0) pl.stun -= dt;
    // (18-11-2026) aturdido: habilidades apagadas hasta que termine (solo al entrar / salir del aturdimiento: no pisa otros bloqueos)
    if (pl.stun > 0 !== this.stunLockOn) {
      this.stunLockOn = pl.stun > 0;
      this.syncAbilityLock();
    }
    if (this.remateRecover > 0) this.remateRecover -= dt;
    const raw = this.inputVector();
    const v = frozen ? new Phaser.Math.Vector2() : positioning ? new Phaser.Math.Vector2(raw.x, 0) : raw;
    // la dirección para apuntar se lee aunque el jugador esté quieto cargando
    if (raw.lengthSq() > 0.09) {
      this.lastDir.copy(raw);
      this.lastDirAt = this.time.now;
    }
    // desde cuándo se mantiene el joystick arriba / abajo (para no confundir CORRER hacia la red con pedir un GLOBO).
    // Cargando, el joystick es solo para apuntar: cuenta como recién movido
    const vdir = raw.lengthSq() > 0.09 && Math.abs(raw.y) >= Math.abs(raw.x) ? Math.sign(raw.y) : 0;
    // venía CORRIENDO hacia la red (o atrás) con el joystick vertical mantenido y lo suelta: eso no es pedir un globo / cortita,
    // así que su última dirección no cuenta para el golpe (antes, soltar justo antes de pegar daba un semi globo)
    if (vdir !== this.vertDir && this.vertDir !== 0 && !this.charging && this.time.now - this.vertSince > SHOT_HOLD_MS) this.lastDirAt = -1e9;
    if (vdir !== this.vertDir || this.charging) {
      this.vertDir = vdir;
      this.vertSince = this.time.now;
    }
    this.updateCharge(dt);
    // velocidad en pantalla (px/s): con inercia ligera (src/logic/PlayerMotion.ts) o instantánea (la de siempre)
    const maxSp = PLAYER_SPEED * (1 + this.passiveAgility) * (positioning ? SERVE.positionSpeed : 1) * (this.zone.active('player') ? ZONE.speedMult * this.zoneStatMultiplier('player', 'speed') : 1);
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
    if (this.entering) {
      // entrada al empezar el partido: la animación (caminar) la lleva entranceWalk
    } else if (inertia) {
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
    if (this.net2) {
      this.net2Tick(dt); // el compañero (y, en el invitado, los 2 bots) llegan por red
      this.netPingTick();
      if (this.net2host) this.net2SendBots();
      this.diag2Tick(dt); // (19-11-2026) LOG del 2v2 online (LOG-PARTIDO en el servidor)
    }
    if (this.net && !this.net2) {
      this.netBotTick(dt);
      this.netSignalTick();
      this.netPingTick();
      this.diagTick(dt);
    }
    else if (this.net2 && !this.net2host) {
      // invitado del 2v2: los bots los simula el host
    }
    else if (this.netBotFly && (this.netBotFly.actor ?? bt) === bt && this.netBotFlyTick(dt)) {
      // SOMBRA / SUPERSALTO / VOLTERETA / PATINAJE del BOT en curso (botFly): su recorrido manda sobre la posición
      this.rivalChargeT = 0;
      bt.ch.setCharging(false);
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
    // entrada al empezar el partido: el rival llega caminando (entranceWalk), sin el cerebro
    // REMATE planeado: va a pararse en el círculo del globo (botRemateSteer)
    const steer = !this.entering && !rem && !fetch ? this.botRemateSteer(dt) : null;
    // (18-11-2026) tras el punto ('pointover') el rival se queda quieto: su reacción (ganado / perdido) no se corta con la carrera
    const mv = this.entering || (this.phase === 'pointover' && !fetch) || this.guideBotFrozen() || (this.guide === 'spin' && (this.score.played === 0 || this.practicingReturns() || this.l2Won)) || (!!this.spKind() && !this.spBotFree()) || this.g4Point() !== null || this.g5Point() !== null ? { moving: this.botRun.on, dirX: this.botRun.dirX, sprint: null, readyToToss: false } : rem ?? fetch ?? steer ?? this.brain.tick(bt, {
      dt,
      phase: this.phase,
      botServes: this.server === 'bot',
      servePositioning: this.serveCtl.state === 'POSITIONING',
      serveY: this.botServeY,
      ball: this.ball.s,
      noAbilities: this.serveLock || !!bt.racket || !this.botAbilityUnlocked('defensive') || this.practicingReturns() || this.lessonPractice(),
    });
    this.ai.speed = aiSpeed;
    // DASH del rival: sprint hacia el punto previsto (la animación de siempre del sprint)
    // (Mai: DESTELLO = teletransporte al punto previsto, con la estela del destello del jugador)
    if (mv.sprint === 'start') {
      const dk = this.botKit.defensive;
      if (dk === 'blink') this.botBlink();
      // (16-11-2026) el bot también sabe los otros defensivos: el mismo recorrido que se ve del rival online (netBotFly)
      else if (dk === 'shadow' || dk === 'jump' || dk === 'flip' || dk === 'skate') this.botFly(dk);
      else {
        bt.ch.setSprint(true, this.ai.target.y - bt.y);
        const h = this.headPos(bt);
        this.popText(h.x, h.y - 10, 'DEFENSIVO', '#c9a4ff', 26);
        this.dustFx(bt.x, bt.y);
        // destello de arranque y sombras al correr: los mismos efectos que tu DASH
        const p = project(bt.x, bt.y);
        this.dashFx.burst(p.sx, p.sy, p.s * VIEW.CHAR_K, bt.ch.depth);
        sfx(this, dashSfx(this.botKit.smash));
        this.botDashFx = { t: 0, ghosts: 0 };
        this.sendBotDefensive(bt, { dirX: Math.sign(this.ai.target.y - bt.y), element: this.botKit.smash }, 'sprint-start'); // 2v2 online: el invitado lo ve
      }
    } else if (mv.sprint === 'end' && this.botKit.defensive === 'dash') {
      // llegó al punto: frenada de la hoja, como tu DASH; cortado lejos del punto: sigue corriendo
      bt.ch.setSprint(false, mv.dirX, !!mv.landed);
      this.botDashFx = null;
      this.sendBotDefensive(bt, {}, 'sprint-end');
    }
    if (this.botDashFx) {
      const d = this.botDashFx;
      d.t += dt;
      if (d.ghosts < 3 && d.t >= 0.09 * (d.ghosts + 1)) {
        this.renderActorPose(bt);
        this.dashFx.ghost(bt.ch, d.ghosts, bt.ch.depth);
        d.ghosts++;
      }
      if (d.ghosts >= 3 || d.t > 1.4) this.botDashFx = null;
    }
    if (!this.entering) bt.ch.setMoving(mv.moving && !bt.vanished, mv.dirX);
    this.botRun.on = false; // (lo vuelve a encender steerBotToBall mientras el guion lo lleve)
    if (this.lastHitter !== 'player') this.botRunTo = null; // ya golpeó (o no hay tu pelota en juego): el próximo cálculo es nuevo
    if (mv.readyToToss && !(this.guide === 'first' && this.score.played === 0)) this.beginToss(this.botPlan.kind);
    this.updateFacing(bt);
    this.botChargeTick(dt, mv.moving);
    }

    if (this.doubles && this.simBots) this.doublesTick(dt); // 2v2: aliado y rival que no recibe
    this.racketPickup();

    // --- tiempo para sacar (solo el jugador): si se agota, falta
    this.tickGuide();
    this.tickServeClock(dt);

    // --- pelota
    // sacador quieto antes de lanzar: bota la pelota (hojas nuevas de NXO); moviéndose no
    const srvA = this.srvActor();
    // al empezar el partido (presentación + entrada caminando) nadie tiene la pelota ni la bota: aparece al tener
    // el control del personaje
    const intro = this.phase === 'intro' || this.entering;
    // y antes de lanzar para sacar la pelota tampoco se dibuja (se veía flotando): aparece al presionar para lanzar (fase 'toss').
    // Vale para el usuario, el bot y el rival online (su 'toss' pasa por beginToss); si se atrapa o falla el lanzamiento, vuelve a ocultarse.
    const hideBall = intro || this.phase === 'serve' || this.skyBallHidden; // (¡A LAS ESTRELLAS!: la pelota se fue con él)
    if (hideBall !== this.ballHidden) {
      this.ballHidden = hideBall;
      this.ball.setVisible(!hideBall);
    }
    // en red nadie bota la pelota antes de sacar (pedido del usuario 13-11-2026): reposo normal con la pelota en la mano
    // (14-11-2026) nadie bota la pelota antes de sacar (ni contra el bot): reposo normal; caminar sigue igual
    const still = false;
    pl.ch.setServeIdle(srvA === pl && still);
    bt.ch.setServeIdle(srvA === bt && still);
    if (this.phase === 'serve' || this.phase === 'intro') {
      this.holdBall();
      const bz = this.phase === 'serve' ? srvA.ch.serveBounceBall() : null;
      // la pelota del juego rebota sincronizada con la mano del clip (en la mano izquierda, al otro lado de la raqueta)
      if (bz !== null) {
        // altura y lado de la mano del clip de bote (NxoActor.serveBounceBall)
        this.ball.s.z = bz.z;
        // dy ya viene con el signo de la pantalla (negativo = izquierda de la imagen), igual para el usuario y el rival
        this.ball.s.y = srvA.y + bz.dy;
      } else this.ball.s.z = 62 + Math.sin(this.time.now / 150) * 4;
    } else if (this.phase === 'toss') {
      const srv = this.srvActor();
      const s = this.ball.s;
      const ctl = this.serveCtl;
      s.x = srv.x + srv.dir * 10;
      // la pelota sube RECTA desde la mano (sin moverse de lado) y vuelve a bajar por el mismo sitio; el sacador se ajusta
      // un poco hacia ella al golpear (serveJump), no la pelota hacia la raqueta
      s.y = srv.y + this.tossFromDy;
      // (25-11-2026, usuario) nivel 2, P1: en lo más alto del saque, pausa (tú y la pelota) para leer que puedes apuntar a 6 zonas; luego sigue
      if (this.aimPausePoint() && this.meServes && this.l2AimPause === 'none' && s.vz <= 0) this.l2AimStart(srv);
      if (this.l2AimPause === 'on' || this.l2AimPause === 'wait') this.l2AimTick();
      const aimFrozen = this.l2AimPause === 'on' || this.l2AimPause === 'wait';
      const ev = aimFrozen ? null : stepBall(s, dt); // en la pausa: pelota (y tiempo del saque) quietos
      if (aimFrozen) { /* pausa del nivel 2 */ }
      else if (ev === 'bounce') this.tossFault(); // golpe en vacío: la pelota cayó al suelo
      else if (ctl.state === 'AIMING' && s.vz < 0 && s.z <= SERVE.catchZ) this.catchBall(); // no la golpeó: la atrapa y reintenta
      else {
        const tev = ctl.tick(dt);
        if (((this.simBots && this.server === 'bot') || this.allyServes) && ctl.state === 'AIMING' && ctl.t >= this.botPlan.pressAt) this.beginSwing();
        // el botón elegido se ilumina en azul neón mientras dura la ventana de saque perfecto
        if (this.meServes && ctl.kind) (ctl.kind === 'normal' ? this.serveNormalBtn : this.serveSpinBtn).setCue(ctl.windowOpen());
        if (tev === 'contact') this.executeServe();
      }
    } else if (this.phase === 'over' && this.finaleBall) {
      this.stepFinaleBall(dt);
    } else if (this.phase === 'over') {
      // (18-11-2026, usuario) fin del partido: la pelota sigue botando (y rebotando en la pared, sin puntuar) hasta pararse;
      // antes se congelaba donde estaba y a veces quedaba pegada a la pared. Los personajes siguen en su victoria / derrota
      for (let i = 0; i < 3; i++) {
        const px = this.ball.s.x;
        stepBall(this.ball.s, dt / 3);
        this.checkBackWall(px);
      }
    } else if (this.phase === 'rally' || this.phase === 'pointover') {
      const sub = 3;
      // (21-11-2026, log online) golpe del rival que llegó tarde: la pelota recupera el atraso que falta corriendo un poco más rápido unos
      // fotogramas (máx. +60 %), con la física normal (botes y red incluidos), en vez de saltar de golpe hasta 250 ms hacia adelante
      let ballDt = dt;
      if (this.netBallCatch > 0 && this.lastHitter === 'bot') {
        const extra = Math.min(this.netBallCatch, dt * 0.6);
        this.netBallCatch -= extra;
        ballDt += extra;
      } else this.netBallCatch = 0;
      for (let i = 0; i < sub; i++) {
        const px = this.ball.s.x;
        const pvx = this.ball.s.vx;
        const crossing = this.netCrossing;
        const ev = stepBall(this.ball.s, ballDt / sub, crossing);
        // red visual: pega en la malla (ondula + golpe sordo) o roza la cinta por encima (vibra + "tic")
        if (ev === 'net') this.netView.hit(this.ball.s.y, this.ball.s.z, pvx);
        else if (crossing.clearance !== undefined && crossing.clearance <= SERVE.letBand) {
          this.netView.brush(crossing.y, Math.hypot(this.ball.s.vx, this.ball.s.vy));
          if (this.serving && this.phase === 'rally' && !this.doingGuidePoint()) this.serveLet = true;
        }
        this.contactClock = this.simClock + ((i + 1) * dt) / sub; // instante del contacto si golpea en este subpaso
        if (ev === 'bounce' && this.rallyOutMarkPending) {
          this.rallyOutMarkPending = false;
          // En online el punto oficial puede llegar antes que el bote local.
          if (this.phase === 'pointover') this.outMark(this.ball.s.x, this.ball.s.y);
        }
        if (this.phase !== 'rally') {
          this.checkBackWall(px); // punto ya decidido: la pelota también rebota en la pared (sin puntuar)
          continue;
        }
        // (18-11-2026, usuario) saque golpeado bajo (va a la red): antes era PUNTO directo aunque fuera el 1.er servicio (parecía
        // doble falta al sacar apurado en los últimos segundos). Ahora es FALTA como cualquier saque a la red: queda el 2.º servicio
        if (ev === 'net' && this.serving) {
          if (this.serveNetLoss) this.serveNetLoss = false;
          this.serviceFault();
        }
        else if (ev === 'net' && this.dropZeroBack && this.lastHitter === this.dropZeroBack) {
          // el DROP SHOT 0 de vuelta pega en la red: igual es punto de quien lo tiró (el rival no la devolvió)
          const w = this.dropZeroBack;
          this.dropZeroBack = null;
          this.ball.setMaxCharge(false); // sin el brillo del máximo al ganar el punto
          this.pointTo(w, '¡DROP SHOT 0!', w === 'player' ? '#bfffe0' : '#ff9aa3');
        } else if (ev === 'net' && this.lastHitter) {
          const rec: Who = this.lastHitter === 'player' ? 'bot' : 'player';
          this.pointTo(rec, this.rallyForcedShot && !this.rallyFaultTut ? '¡TIEMPO · RED!' : '¡RED!', '#ff7a85');
        } else if (ev === 'bounce') this.handleBounce();
        if (this.phase === 'rally') this.checkHits();
        if (this.phase === 'rally') this.checkDropZeroBack();
        this.checkBackWall(px); // después de los golpes: si el rival llegaba, ya devolvió
        if (this.cineLock) break; // contacto reservado: la pelota no avanza más
      }
      this.updateDashHit(dt);
    }

    this.ai.homeX = this.doubles ? (this.bot.x < NET_X + 220 ? NET_X + DOUBLES_NET_GAP : null) : this.netTestOn && !this.serveLock ? NET_X + 70 : null; // (prueba) el bot sube a la red solo tras el saque y su resto
    if (!this.rallyForcedShot && !this.doingGuidePoint()) this.duelCheck(); // DUELO EN LA RED: los dos pegados a la red y la pelota a punto de llegar
    if (this.duel) { this.renderActors(); return; }
    // globo: caída prevista, círculo en el suelo y aviso del SMASH potenciado (solo presentación + reglas)
    // (26-11-2026, usuario) tus globos en el tutorial (antes de que el rival sepa rematar) no tienen CÍRCULO del smash ni el rival va a él
    const noCircle = this.lastHitter === 'player' && this.tutorial && getPlayer().level < BOT_REMATE_LEVEL;
    const lob = this.lob.update(dt, this.ball.s, this.lastHitter, noCircle ? 'normal' : this.ball.shotKind, this.phase, this.bounces);
    if (!lob.active) this.remateWhiffed = false; // otro globo: el remate vuelve a estar disponible
    const insideLob = lob.receiver === 'player' && this.lob.contains(pl.x, pl.y);
    const canSuper = this.lob.windowOpenFor('player', pl.x, pl.y);
    if (!lob.active) this.superArmed = false;
    // el botón SMASH brilla en dorado cuando pulsarlo AHORA daría un remate potenciado (o ya se armó así)
    this.smashBtn.setHint((canSuper && this.smashBtn.ready && !this.smashArmed) || (this.superArmed && canSuper));
    // en el REMATE (tuyo o del rival en red) ya se está en el aire: fuera el círculo del suelo
    // (21-11-2026, usuario) el círculo reacciona (giro + se agranda) cuando entra quien recibe: tú, el rival bot o el rival online (su posición real / interpolada)
    const insideRival = lob.receiver === 'bot' && this.lob.contains(this.bot.x, this.bot.y);
    this.lobMarker.render(dt, this.remateCine || this.netRemateOn || this.botRemate ? { ...lob, active: false } : lob, insideLob || insideRival, canSuper);

    this.ball.render(dt);
    // humo del SMASH en vuelo (fuerte si es el potenciado)
    if (!this.ball.power) this.superFlight = false;
    // (el INFERNO DRIVE no echa humo: su rastro es de fuego)
    this.smoke.update(dt, this.ball.s, this.ball.power && !this.infernoFlight, this.superFlight, this.ball.sprite.visible);
    this.elementFx.update(dt, this.ball.s, this.ball.power && !this.infernoFlight, this.superFlight, this.ball.sprite.visible);
    this.dropZeroFx.update(dt, this.ball.s, !!this.ball.s.back, this.ball.sprite.visible);
    // INFERNO DRIVE: pelota envuelta en llamas mientras dure su trayectoria
    if (!this.ball.power) this.infernoFlight = false;
    this.ball.quietFx = this.infernoFlight;
    this.fire.update(this.ball.s, this.infernoFlight, this.ball.sprite.visible);
    this.tickRemate(dt); // REMATE del globo: salto, apuntado, aro
    this.autoTick(dt); // AUTO: saque y habilidades del piloto automático
    this.tickBotRemate(dt); // REMATE del BOT
    this.tickServeJump(dt); // salto del saque (visual)
    this.renderActors();
    this.updateSmashGlow();
    this.updateTimingRing();
    this.renderServeAim();
    this.zoneRender(dt);
    // turno de saque: aparece al terminar la presentación (INICIO) y se oculta al lanzar la pelota
    const waitingServe = this.phase === 'serve' && !this.serving;
    const srvHead = this.headPos(this.srvActor());
    this.serveTag.update(dt, waitingServe ? this.server : null, srvHead.x, srvHead.y);
    // 2v2 contra bots: el aliado lanza su saque cuando termina su espera (allyServes)
    if (waitingServe && this.allyServes && !this.paused && !this.entering && this.serveCtl.state === 'POSITIONING' && this.time.now >= this.allyTossAt) this.beginToss(this.botPlan.kind);

    // cámara: sigue un poco al jugador en lateral (tipo Mario Tennis)
    const cam = this.cameras.main;
    const pp = project(pl.x, pl.y);
    const target = this.baseScrollX + (pp.sx - VIEW.W / 2) * VIEW.FOLLOW;
    // Durante la intro mantener la cámara centrada: al seguir lateralmente al jugador se descubre el relleno oscuro del costado,
    // especialmente en 2v2. El seguimiento empieza al terminar el acercamiento y comenzar el punto.
    if (this.phase !== 'over' && this.phase !== 'intro') cam.scrollX += (target - cam.scrollX) * Math.min(1, dt * 5); // terminado el partido la cámara queda al centro (finale)

    // globo hacia el jugador y él dentro del círculo: zoom suave hacia él (el HUD va en otra cámara y no se mueve).
    // Al golpear (el globo deja de estar activo) o al salir del círculo, vuelve al encuadre normal.
    // Solo cuando recibe el JUGADOR: si el globo es para el rival no hay zoom.
    if (this.phase !== 'intro' && this.phase !== 'over') {
      const want = lob.active && lob.receiver === 'player' && insideLob ? 1 : 0;
      const rate = want > this.lobZoomK ? LOB_SMASH.zoomIn : LOB_SMASH.zoomOut;
      this.lobZoomK += (want - this.lobZoomK) * Math.min(1, dt * rate);
      if (this.lobZoomK < 0.002) this.lobZoomK = 0;
      const k = this.lobZoomK;
      // toma especial: más cerca, encuadre bajo (los pies al centro: red y rival "por encima") y viñeta, sin girar la
      // cámara (12-11-2026). Todo escala con k y vuelve a cero al golpear / salir.
      const ease = k * k * (3 - 2 * k);
      // GLOBO DISPARADO en vuelo: la cámara se aleja un poco para ver la trayectoria (vuelve al botar / devolverse)
      const ml = this.maxLob;
      if (ml && (this.lastHitter !== ml.hitter || this.bounces > 0 || this.phase !== 'rally')) this.maxLob = null;
      const wantOut = this.maxLob ? 1 : 0;
      this.maxLobK += (wantOut - this.maxLobK) * Math.min(1, dt * (wantOut ? 3.5 : 2.5));
      if (this.maxLobK < 0.002) {
        this.maxLobK = 0;
        this.maxLobWide = false;
      }
      const out = this.maxLobK * this.maxLobK * (3 - 2 * this.maxLobK);
      // DUELO RED: la cámara que se acercó a la red se suelta sola (y se funde con el alejamiento del GLOBO DISPARADO)
      this.duelHudSync(dt);
      if (!this.duel) {
        this.duelCamK += (0 - this.duelCamK) * Math.min(1, dt * NET_DUEL.camRelease);
        if (this.duelCamK < 0.002) this.duelCamK = 0;
      }
      const dk = this.duelCamK;
      const de = dk * dk * (3 - 2 * dk);
      // TIEMPO LENTO: la cámara cercana se suelta sola (medio segundo) al terminar la cinemática
      if (!this.slowCamHold && this.slowCam > 0) this.slowCam = Math.max(0, this.slowCam - dt * 2.2);
      const se = this.slowCam * this.slowCam * (3 - 2 * this.slowCam);
      cam.setZoom(VIEW.CAM_ZOOM * (1 + (LOB_SMASH.zoom - 1) * ease) * (1 - (this.maxLobWide ? NET_DUEL.lobZoomOut : MAX_LOB.zoomOut) * out) * (1 + this.duelZoomAmt * de) * (1 + (SLOWMO.zoom - 1) * se + (SLOWMO.zoomEnd - SLOWMO.zoom) * this.slowCamX * se));
      cam.scrollY = (pp.sy - LOB_SMASH.focusLift - this.scale.height / 2) * ease + (this.duelCamMid.sy - NET_DUEL.camLift - this.scale.height / 2) * de + (pp.sy - SLOWMO.focusLift - this.scale.height / 2) * se;
      cam.scrollX += (pp.sx - VIEW.W / 2) * (1 - VIEW.FOLLOW) * 0.5 * (ease + se) * Math.min(1, dt * 5);
      this.lobVignette.setAlpha(LOB_SMASH.vignette * Math.max(ease, se)).setVisible(Math.max(ease, se) > 0.01);
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
      !this.cineLock
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
    const gv = s.g ?? GRAVITY;
    const T = clamp((s.vz + Math.sqrt(s.vz * s.vz + 2 * gv * dz)) / gv, 0.12, 0.8);
    // en red el rival ve la misma cámara lenta (acción 'remate-start'), sin acercamiento de cámara
    const slow = clamp(T / REMATE.realS, REMATE.minSlow, 1);
    this.setSlowMo(slow);
    // la velocidad de las animaciones es global (todas las escenas): si se sale del partido a mitad, se restaura
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.setSlowMo(1));
    this.remateCine = {
      t: 0,
      T,
      // punto del salto (cae aquí) y deriva acumulada con el joystick
      x0: this.player.x,
      y0: this.player.y,
      ox: 0,
      oy: 0,
      aim: { col: this.bot.y > LAT_C ? -1 : 1, row: 'deep' },
      g: this.add.graphics().setDepth(0.8),
      ring: this.add.graphics().setDepth(4000),
    };
    this.net?.sendAction('remate-start', { slow, t: T });
    this.player.ch.remateHold(); // raqueta arriba, congelada hasta el golpe (sin texto "REMATE" sobre ti desde el 12-11-2026)
    navigator.vibrate?.(30);
  }

  /**
   * El ESPECIAL corta el REMATE (solo con el rival sin raqueta): fin de la cámara lenta y del aro, baja del salto rápido
   * y vuelve a moverse; este globo ya no vuelve a empezar remate. El golpe lo da el ESPECIAL cuando la pelota llegue.
   */
  private cancelRemateForSmash() {
    this.endRemate();
    this.remateWhiffed = true; // no vuelve a saltar con este globo
    this.net?.sendAction('remate-end', { grade: 'cancel' }); // el rival sale de su cámara lenta (sin '¡MUY PRONTO!': no es golpe al aire)
    const pl = this.player;
    pl.ch.releaseRemate();
    this.tweens.killTweensOf(pl);
    this.tweens.add({ targets: pl, lift: 0, duration: 160, ease: 'Quad.easeIn' });
    const h = this.headPos(pl);
    this.popText(h.x, h.y - 10, '¡ESPECIAL!', '#ffd23f', 30);
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
    pl.lift = REMATE.jump * Math.sin((Math.min(1, p) * Math.PI) / 2);
    // salta en el sitio y cae donde saltó (antes se iba hacia la pelota y aterrizaba en otro lado): solo una deriva
    // mínima hacia donde apunta el joystick (en pantalla, derecha = +y y arriba = +x de la cancha)
    const d = this.inputVector();
    const D = REMATE.drift;
    r.ox -= d.y * D.speed * dt;
    r.oy += d.x * D.speed * dt;
    const m = Math.hypot(r.ox, r.oy);
    if (m > D.max) {
      r.ox *= D.max / m;
      r.oy *= D.max / m;
    }
    pl.x = clamp(r.x0 + r.ox, P_X[0], P_X[1]);
    pl.y = clamp(r.y0 + r.oy, Y_MIN, Y_MAX);
    // apuntado (se queda con la última dirección): lado con izquierda / derecha, fondo con arriba, saque con abajo
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
      this.remateWhiffBlock = true; // no se le pega hasta que bote: hay que ir a buscarla
      // (sin red) la pelota pasa de largo y cae algo más atrás, dentro de la cancha. En red la pelota es del rival
      // (su teléfono la simula): no se toca
      if (!this.net) {
        const s = this.ball.s;
        const gv = s.g ?? GRAVITY;
        const tg = (s.vz + Math.sqrt(s.vz * s.vz + 2 * gv * Math.max(0, s.z))) / gv;
        if (tg > 0.05) {
          const land = s.x + s.vx * tg;
          const back = Math.max(COURT.left + 15, land - REMATE.whiffBack);
          s.vx += (back - land) / tg;
        }
      }
      this.player.ch.swing(true, true, true);
      this.tweens.add({ targets: this.player, lift: 0, duration: 260, ease: 'Quad.easeIn' });
      const h = this.headPos(this.player);
      this.popText(h.x, h.y - 20, '¡MUY PRONTO!', '#ff9aa3', 32);
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
      const h = this.aboveHeadPos(this.player);
      this.popText(h.x, h.y, 'SMASH!', '#ffd23f', 44);
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
  /** (26-11-2026, usuario) tutorial: el rival no hace el REMATE con salto (el del círculo) hasta después de enseñarlo (nivel 7) */
  private tutLowLevel() {
    return this.tutorial && getPlayer().level < BOT_REMATE_LEVEL;
  }
  private canBotStartRemate(s: BallState) {
    const st = this.lob.state;
    if (!st.active || st.receiver !== 'bot') {
      this.botRemateRoll = null;
      return false;
    }
    const bt = this.bot;
    if (this.tutLowLevel()) return false; // (26-11-2026, usuario) niveles bajos del tutorial: el rival no remata con el salto alto
    if (this.net || !st.inCourt || this.ball.power || s.vz >= 0 || s.z > REMATE.startZ || s.z <= REMATE.contactZ) return false;
    if (bt.stun > 0 || bt.vanished || bt.racket) return false;
    if (Math.hypot(bt.x - st.x, (bt.y - st.y) * 1.25) > LOB_SMASH.radius * 1.8) return false;
    if (this.botRemateRoll === null) this.botRemateRoll = this.rollBotRemate();
    return this.botRemateRoll;
  }

  /**
   * (16-11-2026, pedido del usuario) ¿El BOT intenta el REMATE de este globo? Solo desde el SEGUNDO juego del partido, como mucho
   * UNO por juego y no siempre (50 % … 80 % según su nivel), para que no lo haga a cada rato.
   */
  private rollBotRemate() {
    // (20-11-2026, usuario: "el bot no hace smash en el círculo") desde el PRIMER juego y más seguido (antes desde el 2.º, 50-80 %)
    return !this.net && this.botRemateGame !== this.score.gameIndex && Math.random() < 0.75 + 0.2 * this.ai.d;
  }

  /**
   * Si decidió rematar el globo que le llega, el BOT va a pararse en el círculo (donde cae) en vez de a donde lo mandaría el
   * cerebro; ahí canBotStartRemate lo hace saltar solo, como al jugador. Devuelve el movimiento que reemplaza al del cerebro.
   */
  private botRemateSteer(dt: number): ReturnType<BotBrain['tick']> | null {
    const st = this.lob.state;
    if (this.net || this.botRemate || !st.active || st.receiver !== 'bot' || !st.inCourt || this.phase !== 'rally') return null;
    if (this.botRemateRoll === null) this.botRemateRoll = this.rollBotRemate();
    if (!this.botRemateRoll) return null;
    const bt = this.bot;
    if (bt.stun > 0 || bt.vanished || bt.racket) return null;
    const tx = clamp(st.x + 10, B_X[0], B_X[1]);
    const ty = clamp(st.y, Y_MIN, Y_MAX);
    const dx = tx - bt.x;
    const dy = ty - bt.y;
    const d = Math.hypot(dx, dy);
    if (d < 6) return { moving: false, dirX: 0, sprint: null, readyToToss: false };
    const step = Math.min(d, this.ai.speed * 1.15 * dt);
    bt.x += (dx / d) * step;
    bt.y += (dy / d) * step;
    return { moving: true, dirX: Math.sign(dy) || 1, sprint: null, readyToToss: false };
  }

  /** El BOT salta con la raqueta arriba y el partido va en cámara lenta mientras "piensa" a dónde rematar. */
  private startBotRemate() {
    const s = this.ball.s;
    const dz = Math.max(0, s.z - REMATE.contactZ);
    const gv = s.g ?? GRAVITY;
    const T = clamp((s.vz + Math.sqrt(s.vz * s.vz + 2 * gv * dz)) / gv, 0.12, 0.8);
    // cuándo golpea (fracción del cierre del aro): más nivel = más SMASH! (justo al cerrarse)
    const d = this.ai.d;
    const roll = Math.random();
    const hitAt = roll < 0.25 + 0.5 * d ? 1 : roll < 0.6 + 0.3 * d ? rand(0.78, 0.88) : rand(1.12, 1.25);
    // a dónde: lejos de ti (lado contrario) y casi siempre al fondo
    const col: -1 | 1 = this.player.y > LAT_C ? -1 : 1;
    const row: 'short' | 'deep' = Math.random() < 0.7 ? 'deep' : 'short';
    this.botRemate = { t: 0, T, hitAt, col, row };
    this.botRemateGame = this.score.gameIndex; // uno por juego
    this.setSlowMo(clamp(T / REMATE.realS, REMATE.minSlow, 1));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.setSlowMo(1));
    // (20-11-2026, usuario: "el smash del rival no hace bien las animaciones") salto con sus frames (se agacha y sube) y se queda en el aire
    // con la raqueta arriba hasta el golpe (antes saltaba ya congelado en esa pose)
    if (!this.bot.ch.remateJump()) this.bot.ch.remateHold();
    // (18-11-2026, usuario) sin texto "REMATE" sobre el rival (solo cuenta el SMASH!); los bordes se oscurecen para intimidar
    this.rivalSmashDim(true);
  }

  /** (18-11-2026, usuario) REMATE del rival: viñeta oscura suave en los bordes de la pantalla mientras salta (intimida). */
  private smashDim: Phaser.GameObjects.Image | null = null;
  private rivalSmashDim(on: boolean) {
    if (on && !this.textures.exists('fx-vignette')) {
      const S = 256;
      const tex = this.textures.createCanvas('fx-vignette', S, S);
      if (tex) {
        const ctx = tex.getContext();
        const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.22, S / 2, S / 2, S * 0.62);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(0.55, 'rgba(0,0,0,0.35)');
        g.addColorStop(1, 'rgba(0,0,0,1)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, S, S);
        tex.refresh();
      }
    }
    if (on && !this.smashDim && this.textures.exists('fx-vignette')) {
      const W = this.scale.width;
      const H = this.scale.height;
      this.smashDim = this.add.image(W / 2, H / 2, 'fx-vignette').setScrollFactor(0).setDisplaySize(W * 1.25, H * 1.25).setDepth(3450).setAlpha(0);
    }
    const v = this.smashDim;
    if (!v) return;
    this.tweens.killTweensOf(v);
    // la cámara lenta del remate frena los tweens: la duración se compensa para que tarde lo mismo en tiempo real
    const k = Math.max(0.05, this.tweens.timeScale);
    this.tweens.add({ targets: v, alpha: on ? 0.55 : 0, duration: (on ? 220 : 350) * (on ? k : 1), ease: 'Sine.easeOut' });
  }

  /** Movimiento del BOT durante su remate: salta y se coloca bajo la pelota (con la forma del movimiento del cerebro). */
  private botRemateMove(dt: number): ReturnType<BotBrain['tick']> {
    const r = this.botRemate!;
    const bt = this.bot;
    // salta en el sitio y cae donde saltó (como el jugador; antes se iba hacia la pelota)
    bt.lift = REMATE.jump * RIVAL_REMATE_JUMP_K * Math.sin((Math.min(1, r.t / r.T) * Math.PI) / 2);
    return { moving: false, dirX: 0, sprint: null, readyToToss: false };
  }

  private tickBotRemate(dt: number) {
    const r = this.botRemate;
    if (!r) return;
    r.t += dt;
    // (18-11-2026, usuario: "dice SMASH pero no hizo la animación de pegarle") el golpe EMPIEZA antes del contacto (la raqueta llega justo
    // cuando sale la pelota), como el del jugador; antes empezaba en el mismo instante en que la pelota ya se iba
    if (!r.swung && r.t >= r.hitAt * r.T - BOT_REMATE_LEAD_S) {
      r.swung = true;
      this.bot.ch.swing(true, true, true); // remate con salto (smash-power), desde la pose congelada
    }
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
    // (18-11-2026) el golpe ya empezó en tickBotRemate: la raqueta llega ahora (sin él, el de siempre)
    const fxDelay = r.swung ? 0 : this.bot.ch.swing(true, true, true);
    s.z = Math.max(s.z, 22);
    let speed = SHOT_SPEED * REMATE.speed[grade];
    if (this.zone.active('bot')) speed *= ZONE.shotMult * this.zoneStatMultiplier('bot', 'strength');
    if (this.zone.active('player')) speed *= 1 - zoneStatPercent(this.zoneLevels.player.resistance);
    aimShot(s, tx, ty, speed, REMATE.margin);
    this.ball.setPower(false);
    this.ball.setKind('normal', true);
    this.lastHitter = 'bot';
    this.bounces = 0;
    this.ai.onBotHit();
    this.hitFxAt(fxDelay, s.x, s.y, s.z, false, 1, false, undefined, 'ball-saque-2'); // REMATE del bot
    this.tweens.add({ targets: this.bot, lift: 0, duration: 320, ease: 'Quad.easeIn' });
    const p = project(s.x, s.y, s.z);
    const [ix, iy, iz] = [s.x, s.y, s.z];
    this.time.delayedCall(fxDelay, () => {
      this.cameras.main.shake(grade === 'perfect' ? 240 : 150, grade === 'perfect' ? 0.017 : 0.01);
      // (18-11-2026, usuario: "¿el smash del círculo tiene impacto?") la misma onda expansiva y destello que el tuyo y el del rival online
      for (const [d, col] of [[0, 0xffffff], [90, 0xffd23f]] as const) {
        const ring = this.add.ellipse(p.sx, p.sy, 40 * p.s, 26 * p.s).setStrokeStyle(7 * p.s, col, 0.95).setDepth(3500).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
        this.tweens.add({ targets: ring, scale: 7, alpha: { from: 0.95, to: 0 }, duration: 480, delay: d, ease: 'Cubic.easeOut', onStart: () => ring.setAlpha(0.95), onComplete: () => ring.destroy() });
      }
      const flash = this.add.circle(p.sx, p.sy, 34 * p.s, 0xffffff, 0.85).setDepth(3500).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: flash, scale: 2.4, alpha: 0, duration: 220, ease: 'Cubic.easeOut', onComplete: () => flash.destroy() });
      if (grade === 'perfect') {
        superSmashFx(this, p.sx, p.sy);
        this.ball.setImpactTrail(1, 0xffd23f);
      } else {
        this.ball.setImpactTrail(0.9, 0xffffff);
        this.smashHitImpact(ix, iy, iz); // (20-11-2026, usuario) remate flojo: impacto contra la pelota
      }
    });
    if (grade === 'perfect') {
      const h = this.aboveHeadPos(this.bot);
      this.popText(h.x, h.y, 'SMASH!', '#ff9aa3', 44);
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
    this.rivalSmashDim(false);
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
    a.ch.setNoRacket(true); // reposo y carrera sin raqueta (si la hoja los trae) hasta recogerla

    const R = RACKET_LOSS;
    let pos = at;
    if (!pos) {
      const half = a === this.player || a === this.ally ? P_X : B_X; // (23-11-2026) la del aliado cae en su campo, no en el rival
      const room = (sd: number) => (sd > 0 ? COURT.bottom - 12 - a.y : a.y - COURT.top - 12);
      let side = Math.random() < 0.5 ? -1 : 1;
      if (room(side) < R.side[0]) side = -side; // pegado a una banda: cae hacia el otro lado
      pos = {
        x: clamp(a.x + rand(-R.depth, R.depth), half[0], half[1]),
        y: clamp(a.y + side * rand(R.side[0], R.side[1]), COURT.top + 12, COURT.bottom - 12),
      };
    }
    const to = pos;
    const racketTexture = ensureLooseRacket(this, a.ch.skinId);
    const head = this.headPos(a);
    const feet = project(a.x, a.y);
    const p = project(to.x, to.y);
    const charH = Math.max(40, feet.sy - head.y);
    const hPx = charH * R.sizeK;
    // lado de la pantalla al que sale volando (izquierda / derecha de quien la pierde)
    const dir = p.sx >= feet.sx ? 1 : -1;
    const col = a === this.player ? 0xffd23f : 0xff6b78;
    const mark = this.add.ellipse(p.sx, p.sy, hPx * 1.3, hPx * 0.45).setStrokeStyle(3, col, 0.9).setFillStyle(col, 0.15).setDepth(p.sy - 0.5).setAlpha(0);
    // sale de la mano, a media altura y ya hacia su lado, cuando el clip deja la mano vacía (launchMs)
    const x0 = feet.sx + dir * charH * 0.22;
    const y0 = feet.sy - charH * 0.62;
    const x1 = p.sx;
    const y1 = p.sy - hPx * 0.18;
    const peak = charH * R.arcK;
    const img = this.add.image(x0, y0, racketTexture).setDepth(Math.max(feet.sy, p.sy) + 0.5).setAlpha(0).setAngle(-dir * 30);
    // mismo ESTILO DE COLOR que el personaje (una raqueta morada no sale volando roja)
    const style = this.colorStyle[a === this.player ? 'player' : 'bot'];
    const tint = (o: Phaser.GameObjects.Image) => {
      if (style.id !== 'classic') applyCharColor(o, style.id, style.skin);
      return o;
    };
    tint(img);
    img.setScale(hPx / img.height);
    // sombra en el suelo bajo la raqueta: deja leer hacia dónde cae
    const shadow = this.add.ellipse(feet.sx, feet.sy, hPx * 0.8, hPx * 0.22, 0x000000, 0.3).setDepth(Math.min(feet.sy, p.sy) - 0.6).setAlpha(0);
    const rec = { x: to.x, y: to.y, img, mark, shadow, landed: false };
    a.racket = rec;
    if (a !== this.player && a !== this.ally) this.tutMission('tRacket'); // (24-11-2026) misión del tutorial
    // (19-11-2026, usuario) la raqueta del JUGADOR aturdido se ve NÍTIDA sobre la niebla: se ve dónde cayó
    const sharp = a === this.player ? (o: Phaser.GameObjects.GameObject) => this.stunFog.keepSharp(o) : null;
    sharp?.(img);
    sharp?.(mark);
    sharp?.(shadow);
    const alive = () => a.racket === rec;
    // 2 vueltas girando hacia su lado y queda tumbada
    const a0 = -dir * 30;
    const a1 = dir * (720 + 100);
    const t = { k: 0 };
    let trailAt = 0;
    this.tweens.add({
      targets: t,
      k: 1,
      delay: a.ch.racketReleaseMs ?? R.launchMs,
      duration: R.flyMs,
      ease: 'Linear',
      onStart: () => {
        img.setAlpha(1);
        shadow.setAlpha(1);
      },
      onUpdate: () => {
        if (!alive()) return; // recogida o quitada en pleno vuelo (fin del punto)
        const k = t.k;
        // tiro parabólico: avanza de lado y sube / baja
        img.setPosition(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k - 4 * peak * k * (1 - k));
        img.setAngle(a0 + (a1 - a0) * Phaser.Math.Easing.Quadratic.Out(k));
        const lift = Math.sin(k * Math.PI);
        shadow.setPosition(feet.sx + (p.sx - feet.sx) * k, feet.sy + (p.sy - feet.sy) * k).setScale(1 - 0.45 * lift).setAlpha(0.6 + 0.4 * (1 - lift));
        // estela: copias que se apagan
        if (this.time.now - trailAt > 35 && k < 0.95) {
          trailAt = this.time.now;
          const g = tint(this.add.image(img.x, img.y, racketTexture).setScale(img.scaleX).setAngle(img.angle).setAlpha(0.35).setDepth(img.depth - 0.1));
          sharp?.(g);
          this.tweens.add({ targets: g, alpha: 0, scale: img.scaleX * 0.8, duration: 220, onComplete: () => g.destroy() });
        }
      },
      onComplete: () => {
        if (!alive()) return;
        shadow.destroy();
        this.dustFx(to.x, to.y);
        // bote al tocar el suelo y queda quieta
        this.tweens.add({ targets: img, y: y1 - hPx * 0.35, angle: a1 + dir * 25, duration: 110, ease: 'Quad.easeOut', yoyo: true });
        this.time.delayedCall(230, () => {
          if (!alive()) return;
          rec.landed = true;
          mark.setAlpha(1);
          this.tweens.add({ targets: mark, scale: { from: 0.85, to: 1.15 }, alpha: { from: 1, to: 0.5 }, duration: 500, yoyo: true, repeat: -1 });
          // aviso en el lateral izquierdo, en rojo (como PUNTO DE PARTIDO), no sobre la cabeza
          if (a === this.player) showSideNotice(this, 'Raqueta', 0xff3b4e, 1800, 'warning'); // (21-11-2026, usuario) antes "¡Ve por tu raqueta!"
        });
      },
    });
    const tag = this.net2Tag(a); // mi jugador, o (2v2 online, host) un bot
    if (tag) this.net?.sendAction('racket', { lost: true, x: to.x, y: to.y, ...tag });
  }

  /** Quita la raqueta del suelo (sin aviso). */
  /** estilo de color de cada lado (para la raqueta que sale volando) */
  private colorStyle: Record<'player' | 'bot', { id: string; skin: string }> = { player: { id: 'classic', skin: 'nxo' }, bot: { id: 'classic', skin: 'nxo' } };

  /** raquetas del suelo que se están recogiendo (clip pickup): se quitan al agarrarlas, al cortarse o al acabar el punto */
  private pickingRackets = new Set<Phaser.GameObjects.Image>();

  private clearRacket(a: Actor) {
    a.ch.setNoRacket(false); // vuelve a la mano sin animación (fin del punto / colocarse para sacar)
    // raqueta del suelo que se estaba recogiendo (clip pickup) y cuyo agarre no llegó (un golpe lo cortó): se quita
    for (const img of this.pickingRackets) if (img.active) img.destroy();
    this.pickingRackets.clear();
    const r = a.racket;
    if (!r) return;
    a.racket = null;
    this.tweens.killTweensOf(r.img);
    this.tweens.killTweensOf(r.mark);
    r.img.destroy();
    r.mark.destroy();
    r.shadow.destroy();
  }

  /** La recoge: vuelve a golpear y a tener habilidades. La raqueta salta del suelo a su mano. */
  private recoverRacket(a: Actor) {
    const r = a.racket;
    if (!r) return;
    a.racket = null;
    this.tweens.killTweensOf(r.img);
    this.tweens.killTweensOf(r.mark);
    r.mark.destroy();
    r.shadow.destroy();
    const h = this.headPos(a);
    const feet = project(a.x, a.y);
    const img = r.img;
    // Con hoja de la ULTI completa: se agacha y la recoge (clip pickup). La del suelo se quita en el cuadro
    // donde el clip empieza a dibujarla. Mientras dura, se queda quieto. El rival en red solo lo muestra: su
    // posición llega de su teléfono.
    const vanish = () => {
      this.pickingRackets.delete(img);
      if (!img.active) return;
      this.tweens.killTweensOf(img);
      img.destroy();
    };
    const pickMs = a.ch.pickupRacket(vanish);
    if (pickMs > 0) {
      sfx(this, 'recoger-raqueta'); // al empezar a agacharse (usuario, bot y rival online: todos pasan por aquí)
      // si algo corta la recogida antes del agarre (otro golpe, aturdido), la del suelo no se queda para siempre
      this.pickingRackets.add(img);
      this.time.delayedCall(pickMs + 250, () => {
        vanish();
        a.ch.setNoRacket(false); // recogida cortada: ya la tiene (MatchScene le devolvió los golpes); sin pose "sin raqueta"
      });
      if (!(a === this.bot && this.net && !this.net2host)) a.stun = Math.max(a.stun, pickMs / 1000);
      if (a === this.player) stopMotion(this.motion);
    }
    // mano de la raqueta: a la derecha de la pantalla de espaldas (jugador), a la izquierda de frente (rival)
    const hand = (a === this.player || a === this.ally ? 1 : -1) * (feet.sy - h.y) * 0.22; // el aliado también va de espaldas
    if (pickMs <= 0 && img.active) this.tweens.add({
      targets: img,
      x: feet.sx + hand,
      y: feet.sy - (feet.sy - h.y) * 0.55,
      angle: Math.round(img.angle / 360) * 360,
      scale: img.scaleX * 0.7,
      alpha: 0,
      duration: 180,
      ease: 'Quad.easeIn',
      onComplete: () => img.destroy(),
    });
    this.popText(h.x, h.y - 10, '¡RAQUETA!', a === this.player ? '#7ff0ff' : '#ff9aa3', 26);
    if (a === this.player) navigator.vibrate?.(30);
    const tag = this.net2Tag(a);
    if (tag) this.net?.sendAction('racket', { lost: false, ...tag });
  }

  /** flecha a los pies del jugador que apunta a su raqueta en el suelo */
  private racketArrow: Phaser.GameObjects.Graphics | null = null;

  /** Cada fotograma: quien pasa por encima de su raqueta (ya sin aturdido) la recupera. El rival en red avisa él. */
  private racketPickup() {
    // (23-11-2026) los cuatro del 2v2 (antes solo tú y el rival activo: el aliado bot y el otro rival se quedaban sin raqueta todo el punto)
    for (const a of this.everyone()) {
      const r = a.racket;
      if (a === this.ally && this.allyRemote) continue; // el compañero humano recoge la suya en su teléfono
      const rival = a !== this.player && a !== this.ally;
      if (!r || a.stun > 0 || a.vanished || (rival && this.net && !this.net2host)) continue; // (el rival online recoge la suya y lo avisa; en el 2v2 los bots del host los simula el host)
      if (Math.hypot(a.x - r.x, a.y - r.y) <= RACKET_LOSS.pickR) this.recoverRacket(a);
    }
    this.drawRacketArrow();
  }

  /** Sin raqueta (ya en el suelo): flecha que late a los pies del jugador y apunta hacia ella. */
  private drawRacketArrow() {
    const pl = this.player;
    const r = pl.racket;
    const show = !!r && r.landed && !pl.vanished && this.phase !== 'over' && Math.hypot(pl.x - r.x, pl.y - r.y) > RACKET_LOSS.pickR * 1.4;
    if (!show) {
      this.racketArrow?.setVisible(false);
      return;
    }
    if (!this.racketArrow) this.racketArrow = this.add.graphics();
    const g = this.racketArrow;
    const feet = project(pl.x, pl.y);
    const p = project(r.x, r.y);
    const ang = Math.atan2(p.sy - feet.sy, p.sx - feet.sx);
    const k = feet.s * VIEW.CHAR_K;
    const beat = Math.sin(this.time.now / 110);
    const d = (78 + beat * 10) * k;
    const s = 28 * k;
    const cx = feet.sx + Math.cos(ang) * d;
    const cy = feet.sy - 6 * k + Math.sin(ang) * d * 0.6;
    const pt = (fx: number, fy: number) => ({ x: cx + Math.cos(ang) * fx - Math.sin(ang) * fy, y: cy + Math.sin(ang) * fx + Math.cos(ang) * fy });
    const tip = pt(s, 0);
    const l = pt(-s * 0.7, -s * 0.8);
    const rr = pt(-s * 0.7, s * 0.8);
    g.clear().setVisible(true).setDepth(feet.sy + 1);
    g.fillStyle(0xffd23f, 0.75 + 0.25 * beat).lineStyle(3, 0x0a1638, 0.9);
    g.fillTriangle(tip.x, tip.y, l.x, l.y, rr.x, rr.y).strokeTriangle(tip.x, tip.y, l.x, l.y, rr.x, rr.y);
  }

  /** El BOT sin raqueta corre hacia ella (a su velocidad); devuelve el movimiento con la forma del del cerebro. */
  private botFetchRacket(dt: number): ReturnType<BotBrain['tick']> {
    const bt = this.bot;
    const r = bt.racket!;
    // (14-11-2026) con tu ESPECIAL armado o ya en vuelo hacia él, el bot SIN RAQUETA no va por ella: se queda / corre hacia
    // la pelota (para que se vea ¡A LAS ESTRELLAS!)
    const s = this.ball.s;
    const especialFlying = this.ball.power && !this.infernoFlight && this.lastHitter === 'player' && s.vx > 0;
    if (especialFlying || this.smashArmed) {
      if (!especialFlying) return { moving: false, dirX: 0, sprint: null, readyToToss: false };
      const tx = clamp(Math.max(s.x, NET_X + 40), B_X[0], B_X[1]);
      const ty = clamp(s.y, Y_MIN, Y_MAX);
      const ex = tx - bt.x;
      const ey = ty - bt.y;
      const de = Math.hypot(ex, ey);
      const st = Math.min(de, this.ai.speed * 1.15 * dt);
      if (de > 0.5) {
        bt.x += (ex / de) * st;
        bt.y += (ey / de) * st;
      }
      return { moving: de > 0.5, dirX: Math.sign(ey), sprint: null, readyToToss: false };
    }
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
    // destello del color de su ESTILO DE ZONA (azul eléctrico por defecto)
    const W = this.scale.width;
    const H = this.scale.height;
    const fl = this.add.rectangle(0, 0, W, H, this.zoneLook[side].flash, 0.3).setOrigin(0).setScrollFactor(0).setDepth(6000).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: fl, alpha: 0, duration: 500, onComplete: () => fl.destroy() });
    if (side === 'player') navigator.vibrate?.(80);
    if (side === 'player') this.tutMission('tZone'); // (24-11-2026) misión del tutorial
  }

  /** Dibuja el aura y el rayo de quien esté en Zona (cada fotograma). */
  private zoneRender(dt: number) {
    for (const side of ['player', 'bot'] as ZoneSide[]) {
      // aura de llamas (HyperAura) mientras dure la ZONA de ese lado; en azul eléctrico como la Zona
      const aura = side === 'player' ? this.aura : this.botAura;
      const inZone = this.zone.active(side);
      // la Zona por defecto no lleva aura (solo el rayo de los ojos): el aura es de los estilos de Zona de la Tienda
      if (aura && inZone && !aura.active && !this.zoneLook[side].noAura) aura.start(this.zoneLook[side].aura);
      else if (aura && !inZone && aura.active) aura.stop();
      const fx = this.zoneFx[side];
      if (!fx?.active) continue;
      const a = side === 'player' ? this.player : this.bot;
      const p = project(a.x, a.y);
      const look = side === 'player' ? a.ch.facing : -a.ch.facing;
      // el jugador está de espaldas: su rayo de los ojos va detrás del sprite. Los ojos, a la altura de cada personaje y vista (ZONE_EYES),
      // con el mismo crecimiento que le da renderActors con el aura encendida
      const k = p.s * VIEW.CHAR_K;
      const boost = aura?.active ? 1.1 + Math.sin(this.time.now / 70) * 0.015 : 1;
      const eyes = side === 'player' ? zoneEyes(getProfile().skin, 'back') : zoneEyes(this.skinOf(this.bot), 'front');
      fx.update(dt, this.headPos(a), { x: p.sx, y: p.sy }, k, a.ch.depth, look >= 0 ? 1 : -1, side === 'player', eyes, k * boost);
    }
  }

  // ================================================================ partido en red (multijugador 1v1)
  // Autoridad por posesión (docs/MULTIJUGADOR.md): cada teléfono ejecuta este mismo motor con su jugador
  // abajo; el rival es el "bot" sin IA. Los golpes propios se envían (la pelota resultante) y los del rival
  // se aplican como un golpe del bot. La pelota tiene UN juez: quien la recibe decide punto / falta / let.

  /**
   * (19-11-2026, usuario) Escena que TAPA el partido mientras se espera la salida del servidor (la pantalla VS de LanSearchScene, abierta
   * encima): se quita con un fundido al empezar la presentación, o si el partido no llega a empezar. null = nada que quitar.
   */
  private coverKey: string | null = null;
  private releaseCover(fadeMs = 280) {
    const key = this.coverKey;
    if (!key) return;
    this.coverKey = null;
    const sc = this.scene.get(key);
    if (!sc || !sc.sys.isActive()) return;
    if (fadeMs <= 0) return void this.scene.stop(key);
    sc.cameras.main.fadeOut(fadeMs, 0, 0, 0);
    sc.cameras.main.once('camerafadeoutcomplete', () => this.scene.stop(key));
  }

  /** Conecta la sesión: callbacks del rival y empieza la presentación cuando los dos están listos. */
  private netSetup() {
    const net = this.net!;
    if (!this.net2) this.botName = net.opponent.name;
    let introStarted = false;
    let aborted = false;
    // si el partido se cierra antes de la salida, la pantalla VS de encima se va con él
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.releaseCover(0));
    const intro = () => {
      if (introStarted || aborted || !this.scene.isActive()) return;
      introStarted = true;
      this.releaseCover(); // (19-11-2026, usuario) la pantalla VS se queda hasta AQUÍ: los dos listos, empieza la presentación
      this.entranceWalk(); // entrada: los dos llegan caminando a su sitio mientras la cámara se acerca
      playMatchIntro(this, footerColor(this.ambienteKey), () => {
        this.startPoint();
        this.launchBird();
      });
    };
    /** El partido no llegó a empezar (abandono, desconexión o sin salida a tiempo): aviso y vuelta al menú, sin resultado. */
    const abortPreStart = (msg: string) => {
      if (introStarted || aborted) return;
      aborted = true;
      this.releaseCover(); // se ve el aviso del partido (y luego el menú)
      this.phase = 'over';
      this.banner(msg, '#ffd23f', 50, 1400);
      this.time.delayedCall(1800, () => this.scene.start('Menu'));
    };
    // LOG de diagnóstico al servidor (logs/matches): eventos, golpes / avisos y anomalías de sprites
    this.diag = netLogOn() ? new MatchDiag((e) => net.sendLog(e)) : null;
    this.diagReset();
    if (this.diag) {
      const d = this.diag;
      if (this.net2) {
        const resetFrame = () => { this.diag2.lastFrame = 0; };
        resetFrame();
        this.diag2.frameContext = '';
        this.diag2.resumeUntil = 0;
        document.addEventListener('visibilitychange', resetFrame);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => document.removeEventListener('visibilitychange', resetFrame));
      }
      net.trace = (dir, type, kind, extra) => d.log(dir, { type, kind, phase: this.phase, ...extra });
      d.log('session', { role: net.role, mode: net.mode, room: net.roomId, me: getProfile().name, skin: getProfile().skin, rival: net.opponent.name, rivalSkin: net.opponent.skin, ua: navigator.userAgent.slice(0, 80) });
    }
    net.attach({
      onStart: intro,
      onState: (st) => {
        if (this.net2) return this.net2OnState(st);
        this.netLastMsgAt = performance.now();
        const nowIn = performance.now();
        // estado de un punto ANTERIOR (el rival aún no termina el suyo y sigue corriendo por la cancha): ya lo colocamos en
        // su saque, así que se descarta (antes saltaba atrás y se lo veía volver corriendo). Ventana de seguridad: 2,5 s.
        // (también durante la entrada caminando: el rival camina aquí, de forma local)
        if (this.entering || (!this.netPtOff && st.pt !== undefined && this.netPlaced && st.pt < this.netPt && nowIn - this.netPlacedAt < 2500)) {
          this.diagStateAt = nowIn;
          return;
        }
        this.netRemote = st;
        if (this.flu.lastIn) this.flu.gapMax = Math.max(this.flu.gapMax, nowIn - this.flu.lastIn);
        this.flu.lastIn = nowIn;
        this.flu.inN++;
        this.diagStateAt = nowIn;
        this.netInterp.push(st.t, performance.now(), st);
      },
      onHit: (h) => {
        this.netLastMsgAt = performance.now();
        if (this.net2) return this.net2ApplyHit(h, performance.now());
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
        if (this.net2) {
          // 2v2: se fue el ANFITRIÓN (él simula a los bots): el partido no puede seguir
          this.banner('EL ANFITRIÓN SE FUE', '#ffd23f', 52, 1200);
          this.time.delayedCall(1500, () => this.phase !== 'over' && this.endMatch(false, true));
          return;
        }
        this.banner(o.reason === 'abandon' ? 'EL RIVAL SE RINDIÓ' : 'RIVAL DESCONECTADO', '#ffd23f', 52, 1200);
        this.time.delayedCall(1500, () => this.phase !== 'over' && this.endMatch(true, false, true));
      },
      // RECONEXIÓN: pausa con aviso mientras uno de los dos vuelve; al volver se rejuega el punto en curso
      onReconnecting: () => this.netHold('RECONECTANDO…'),
      onReconnected: (sc) => this.netResume(sc),
      onOpponentAway: () => this.netHold(this.net2 ? 'ANFITRIÓN RECONECTANDO…' : 'RIVAL RECONECTANDO…'),
      onMateAway: (gone) => this.net2MateAway(gone),
      onMateBack: (sc) => this.net2MateBack(sc),
      onPromoted: (sc) => this.net2Promoted(sc),
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
    // 2v2 online: el HOST es el juez único de todos los puntos (simula a los bots); el invitado solo los recibe
    if (this.net2) {
      if (!this.net2host) return true;
      this.net.sendPoint(kind, w === 'player', reason, color, [this.score.games[0], this.score.games[1]]);
      return false;
    }
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
    const hA = this.netHitA;
    this.netHitA = 0;
    if (this.net2host) this.net2HostHitAt = performance.now();
    const hActor = hA > 0 ? (this.rivalActors[hA - 1] ?? this.player) : this.player;
    this.net.sendHit({
      ...(hA > 0 ? { a: hA } : {}),
      // 2v2: el poder de la bola de un ESPECIAL / ULTI viaja con el golpe (el otro teléfono no sabe el de los bots ni el del compañero)
      ...(this.net2 && this.ball.power ? { el: this.infernoFlight ? this.infernoEl : this.smashFlightEl } : {}),
      t: performance.now(), // hora del golpe en su reloj real (el mismo de game:state): el rival mide cuánto tardó
      kind: this.serving ? 'serve' : 'hit',
      ball: { x: s.x, y: s.y, z: s.z, vx: s.vx, vy: s.vy, vz: s.vz, damp: s.damp, fric: s.fric, ay: s.ay, g: s.g, ...(s.back ? { back: s.back } : {}) },
      x: hActor.x,
      y: hActor.y,
      shotKind: this.ball.shotKind,
      power: this.ball.power,
      inferno: this.infernoFlight,
      charged: i.charged ?? false,
      overhead: i.overhead ?? s.z > OVERHEAD_Z,
      volley: i.volley ?? false,
      ...(i.serveSpin ? { serveSpin: true } : {}),
      ...(i.special !== undefined ? { special: i.special } : {}),
      ...(i.shock ? { shock: true } : {}),
      ...(i.lunge ? { lunge: i.lunge } : {}),
      ...(i.impact ? { impact: true } : {}),
      ...(i.defensive ? { defensive: true } : {}),
      ...(this.rallyForcedShot ? { rallyFault: this.rallyForcedShot } : {}),
    });
  }

  /** Estado propio para el rival (~20 Hz). */
  private netSendState() {
    if (!this.net) return;
    const now = this.time.now;
    const pl = this.player;
    const l = this.netLastState;
    // arranca a moverse estando quieto: se envía YA (sin esperar los 50 ms), así el rival no lo ve arrancar tarde
    const starts = !!l && !l.moving && Math.hypot(pl.x - this.netPrev.x, pl.y - this.netPrev.y) > 0.6;
    if (now - this.netStateAt < (starts ? 16 : 50)) return;
    const dx = pl.y - this.netPrev.y; // en pantalla, derecha = +y de la cancha
    const moving = Math.hypot(pl.x - this.netPrev.x, dx) > 0.6;
    const dirX = Math.abs(dx) > 0.3 ? Math.sign(dx) : 0;
    const st = { x: pl.x, y: pl.y, moving, dirX, facing: pl.ch.facing, charging: this.charging, stunned: pl.stun > 0, pt: this.netPt };
    // quieto y sin cambios: solo un latido cada 250 ms (en vez de 20 mensajes por segundo). Un punto nuevo se envía al tiro.
    const same = !!l && l.x === st.x && l.y === st.y && l.moving === st.moving && l.dirX === st.dirX && l.facing === st.facing && l.charging === st.charging && l.stunned === st.stunned && l.pt === st.pt;
    // recién detenido: el estado de "quieto" se repite a los 100 ms (va sin garantía de entrega; si se pierde, el rival
    // se quedaba corriendo en el sitio hasta el latido siguiente)
    if (same && now - this.netStateAt < (this.netStopRepeat ? 100 : 250)) return;
    this.netStopRepeat = !!l && l.moving && !st.moving;
    this.netStateAt = now;
    this.netPrev = { x: pl.x, y: pl.y };
    this.netLastState = st;
    this.net.sendState({ t: performance.now(), ...st }); // reloj real: el del juego se frena en cámara lenta / pausa
    this.flu.outN++;
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
    // (y la entrada caminando al empezar el partido, que se hace aquí de forma local)
    if (performance.now() < this.netBotLockUntil || this.entering) {
      this.rivalChargeT = 0;
      this.rivalChargeFx(dt);
      return;
    }
    // posición interpolada entre sus estados reales (net/interp.ts); sin estados aún, la última conocida
    const smp = this.netInterp.sample(performance.now());
    this.fluStarved = !!smp?.starved;
    const r = smp?.snap ?? this.netRemote;
    if (smp) {
      // (21-11-2026, log online) red de seguridad: un salto de la interpolación en un solo cuadro (empujón del ULTI / SMASH,
      // fin de un bloqueo, hueco de estados) se desliza NET_JUMP_SLIDE_MS en vez de verse como teletransporte (107-160 px)
      const jx = bt.x - smp.x;
      const jy = bt.y - smp.y;
      const jd = Math.hypot(jx, jy);
      if (!this.netSnap && !bt.vanished && jd > NET_JUMP_MIN && jd < 300) {
        this.netSnap = { x: jx, y: jy, at: performance.now(), ms: NET_JUMP_SLIDE_MS };
      }
      bt.x = smp.x;
      bt.y = smp.y;
      // tras un golpe del rival: el desfase con el punto del contacto se va apagando (deslizamiento, sin salto)
      const sn = this.netSnap;
      if (sn) {
        const k = 1 - (performance.now() - sn.at) / (sn.ms ?? NET_SNAP_MS);
        if (k <= 0) this.netSnap = null;
        else {
          const e = k * k; // sale rápido y frena al llegar
          bt.x += sn.x * e;
          bt.y += sn.y * e;
        }
      }
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
    if (r && this.phase === 'over') {
      // fin del partido: su celebración / derrota no se toca (ni carrera ni carga)
      this.rivalChargeT = 0;
      this.rivalChargeFx(dt);
      return;
    }
    if (r && this.phase === 'pointover') {
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
      // sin estados nuevos hace rato (se perdió el de "se detuvo"): deja de correr en vez de correr en el sitio
      // (21-11-2026, log online: al empezar el punto el rival se deslizaba 100-150 px en reposo, "patinando") mientras dura el
      // deslizamiento hasta su sitio de saque, corre hacia allí
      const sl = this.netSnap;
      const sliding = !!sl && sl.ms === NET_POINT_SLIDE_MS && Math.hypot(sl.x, sl.y) > 40;
      const moving = sliding || (smp ? !smp.stale && (r.moving || smp.speed > PLAYER_SPEED * MOTION.moveMin) : r.moving);
      // ya no remata y se mueve: si su pose de remate quedó sin golpe (no llegó o fue al aire), se suelta para correr
      if (moving) bt.ch.releaseRemate();
      const dirX = sliding ? Math.sign(-sl!.x) || r.dirX : r.dirX;
      bt.ch.setMoving(moving, dirX, sliding ? 1 : moving && speedK !== undefined ? Math.max(speedK, MOTION.moveMin) : speedK);
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
    const host = this.net.role === 'host' || this.net2; // 2v2: el marcador oficial es del equipo humano (host)
    this.score.points = host ? [sc.points.host, sc.points.guest] : [sc.points.guest, sc.points.host];
    this.score.games = host ? [sc.games.host, sc.games.guest] : [sc.games.guest, sc.games.host];
    this.updateHud();
    this.netInterp.clear();
    for (const r of this.net2Rem) r.interp.clear();
    this.netPtOff = true; // el marcador oficial puede no cuadrar con los puntos jugados de cada teléfono: sin filtro por punto
    this.netLastMsgAt = performance.now();
    this.netPendingToss = null;
    this.faults = 0;
    this.duelAbort('resume'); // un duelo a medias tampoco
    this.legendCancel(); // (17-11-2026) la ULTI LEGENDARIA a medias tampoco
    if (this.cine.active) this.cine.cancel(); // una cinemática a medias no sigue en el punto repetido
    showSideNotice(this, 'Se repite el punto', 0xff9a1f, 1300);
    this.phase = 'pointover';
    this.startPoint();
  }

  /** último mensaje del rival (performance.now): sin mensajes > NET_WEAK_MS = señal débil */
  private netLastMsgAt = 0;
  /** icono de señal débil sobre el rival (null = no se muestra) */
  private netWeak: Phaser.GameObjects.Container | null = null;

  /** ¿Señal débil? Más de 1 s sin ningún mensaje del rival (su estado llega al menos cada 250 ms aunque esté quieto). */
  private netSignalWeak() {
    if (this.phase === 'over' || this.phase === 'intro' || this.netRemoteCine || this.cineLock || this.paused) return false;
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
    // hora acotada a 0..99 999 ms: el servidor recorta los números de los avisos a ±100 000 (con performance.now()
    // entero llegaba recortada y la ida y vuelta salía absurda: rtt = 0 en el log)
    this.net?.sendAction('ping', { t: now % 100_000 });
  }

  private netOnPong(t: number) {
    let rtt = (performance.now() % 100_000) - t;
    if (rtt < 0) rtt += 100_000; // dio la vuelta al tope entre el ping y el pong
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
  /** acumulados del segundo en curso para el resumen de FLUIDEZ ('flu') */
  private flu = { at: 0, frames: 0, maxF: 0, jank: 0, lastFrame: 0, inN: 0, gapMax: 0, lastIn: 0, outN: 0, starve: 0, lagSum: 0, lagMax: 0, bufSum: 0 };
  /** el suavizado se quedó sin estado nuevo en este fotograma (lo marca netBotTick) */
  private fluStarved = false;
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

  /** FLUIDEZ: acumula cada fotograma y escribe un resumen 'flu' por segundo (solo en juego: saque y peloteo). */
  private fluTick(now: number, d: MatchDiag) {
    const f = this.flu;
    if (f.lastFrame) {
      const ft = now - f.lastFrame;
      f.maxF = Math.max(f.maxF, ft);
      if (ft > 50) f.jank++;
    }
    f.lastFrame = now;
    f.frames++;
    // "hambre" solo cuenta si el rival se está moviendo (quieto manda su estado cada 250 ms: es normal)
    if (this.fluStarved && this.netRemote?.moving) f.starve++;
    const r = this.netRemote;
    const lag = r ? Math.hypot(r.x - this.bot.x, r.y - this.bot.y) : 0;
    f.lagSum += lag;
    f.lagMax = Math.max(f.lagMax, lag);
    f.bufSum += this.netInterp.size;
    if (!f.at) f.at = now + 1000;
    if (now < f.at) return;
    const playing = this.phase === 'rally' || this.phase === 'serve' || this.phase === 'toss';
    const skip = this.fluSkip; // segundo con cinemática: fps y cortes falsos
    this.fluSkip = false;
    if (playing && f.frames > 0 && !skip) {
      const secs = Math.max(0.2, (now - (f.at - 1000)) / 1000);
      d.log('flu', {
        fps: f.frames / secs,
        maxF: f.maxF,
        jank: f.jank || undefined,
        in: f.inN,
        gap: Math.round(f.gapMax),
        out: f.outN,
        starve: Math.round((f.starve / f.frames) * 100),
        lag: Math.round(f.lagSum / f.frames),
        lagMax: Math.round(f.lagMax),
        buf: Math.round((f.bufSum / f.frames) * 10) / 10,
        rtt: Math.round(this.netRtt),
        phase: this.phase,
      });
    }
    this.flu = { at: now + 1000, frames: 0, maxF: 0, jank: 0, lastFrame: now, inN: 0, gapMax: 0, lastIn: f.lastIn, outN: 0, starve: 0, lagSum: 0, lagMax: 0, bufSum: 0 };
  }

  private diagReset() {
    this.flu = { at: 0, frames: 0, maxF: 0, jank: 0, lastFrame: 0, inN: 0, gapMax: 0, lastIn: 0, outN: 0, starve: 0, lagSum: 0, lagMax: 0, bufSum: 0 };
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
    this.fluTick(now, d);
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

  // ---------------------------------------------------------------- LOG 2v2 ONLINE (19-11-2026, diagnóstico en el servidor)
  /*
   * Mismo canal que el log del 1v1 (game:log → backend/logs/matches y LOG-PARTIDO.txt), con eventos propios del 2v2:
   *  - flu2       cada 1 s en juego: fps, cuadro más largo, tirones; estados recibidos por actor (in = compañero/bot1/bot2),
   *               mayor hueco entre llegadas (gap) y distancia media / máxima entre lo dibujado y el último estado (lag / lagMax)
   *  - mv2        cada 200 ms en juego: posición y animación de los 4 (me, mate, r1, r2) y la pelota
   *  - snap2      cada 1 s: fase, quién saca, receptor, marcador, cinemática, pelota con velocidad, compañero remoto o bot
   *  - serve2     al colocar cada saque: quién saca y quién recibe (los dos teléfonos deben coincidir)
   *  - tp2        un actor salta > 60 en un fotograma · no-state2: > 800 ms sin estados de un actor remoto
   *  - stuck2     un actor > 3 s en un estado ocupado
   *  - hit2-drop  el host descartó un golpe del invitado (golpes casi a la vez) · cine-yield: el invitado cedió su cinemática
   *  - mate-away / mate-back / promoted: el compañero se fue / volvió / este teléfono pasó a anfitrión
   * Los golpes y avisos enviados y recibidos (send / recv) llevan `a` (0 = compañero, 1 y 2 = bots del host).
   */
  private diag2 = {
    frameContext: '',
    resumeUntil: 0,
    mvAt: 0,
    snapAt: 0,
    fluAt: 0,
    frames: 0,
    maxF: 0,
    jank: 0,
    lastFrame: 0,
    inN: [0, 0, 0],
    lastIn: [0, 0, 0],
    gapMax: [0, 0, 0],
    lagSum: [0, 0, 0],
    lagMax: [0, 0, 0],
    noState: [false, false, false],
    prev: new Map<Actor, { x: number; y: number }>(),
    stuck: new Map<Actor, { state: string; t: number; logged: boolean }>(),
  };

  /** nombre corto de un actor del 2v2 para el log */
  private diag2Who(a: Actor | null | undefined): string {
    if (!a) return '-';
    if (a === this.player) return 'me';
    if (a === this.ally) return 'mate';
    const i = this.rivalActors.indexOf(a);
    return i >= 0 ? `r${i + 1}` : '?';
  }

  private diag2Score() {
    return `${this.score.points.join('-')} / ${this.score.games.join('-')}`;
  }

  /** llegó un estado del actor remoto k (net2OnState) */
  private diag2In(k: number) {
    if (!this.diag) return;
    const g = this.diag2;
    const now = performance.now();
    if (g.lastIn[k]) g.gapMax[k] = Math.max(g.gapMax[k], now - g.lastIn[k]);
    g.lastIn[k] = now;
    g.inN[k]++;
    g.noState[k] = false;
  }

  /** Tiempo real entre fotogramas, incluso cuando la cinemática pausa la simulación. */
  private diag2Frame() {
    const d = this.diag!;
    const g = this.diag2;
    if (document.hidden) {
      g.lastFrame = 0;
      return;
    }
    const now = performance.now();
    const frameMs = g.lastFrame ? now - g.lastFrame : 0;
    g.lastFrame = now;
    const cinematic = this.cine.active || this.netRemoteCine || !!this.legend || !!this.duel;
    const wasCinematic = g.frameContext === 'cine-local' || g.frameContext === 'cine-remote';
    if (wasCinematic && !cinematic) g.resumeUntil = now + 1000;
    const context = cinematic ? (this.netRemoteCine ? 'cine-remote' : 'cine-local') : now < g.resumeUntil ? 'resume' : 'play';
    const previous = g.frameContext;
    g.frameContext = context;
    if (context !== previous && (cinematic || context === 'resume')) {
      d.log('frame-context2', { context, previous, phase: this.phase, utcMs: Date.now() });
    }
    if (frameMs > 50 && !this.paused && this.phase !== 'over') {
      const age = (k: number) => g.lastIn[k] ? now - g.lastIn[k] : undefined;
      d.log('jank2', {
        frameMs, context, previous, phase: this.phase, utcMs: Date.now(),
        rtt: this.netRtt, mateAge: age(0), bot1Age: this.net2host ? undefined : age(1), bot2Age: this.net2host ? undefined : age(2),
        tail: !cinematic && this.cine.busy, deferredHits: this.netDeferred.length,
        point: this.diag2Score(),
      });
    }
    if (!cinematic && !this.paused) {
      g.maxF = Math.max(g.maxF, frameMs);
      if (frameMs > 50) g.jank++;
    }
    d.tick(now);
  }

  /** cada fotograma en el 2v2 online (host e invitado) */
  private diag2Tick(dt: number) {
    const d = this.diag;
    if (!d || !this.ally) return;
    const now = performance.now();
    const g = this.diag2;
    const playing = this.phase === 'rally' || this.phase === 'serve' || this.phase === 'toss';
    // actores que llegan por red en este teléfono: el compañero (si está conectado) y, en el invitado, los 2 bots
    const keys = this.net2host ? (this.allyRemote ? [0] : []) : [0, 1, 2];
    const all = this.everyone();

    g.frames++;
    for (const k of keys) {
      const a = this.net2Actor(k);
      const r = this.net2Rem[k]?.last;
      if (!a || !r) continue;
      const lag = Math.hypot(r.x - a.x, r.y - a.y);
      g.lagSum[k] += lag;
      g.lagMax[k] = Math.max(g.lagMax[k], lag);
    }
    if (!g.fluAt) g.fluAt = now + 1000;
    if (now >= g.fluAt) {
      if (playing && !this.cine.active && g.frames > 0) {
        const secs = Math.max(0.2, (now - (g.fluAt - 1000)) / 1000);
        d.log('flu2', {
          fps: g.frames / secs,
          maxF: g.maxF,
          jank: g.jank || undefined,
          in: keys.map((k) => g.inN[k]).join('/') || '-',
          gap: keys.map((k) => Math.round(g.gapMax[k])).join('/') || '-',
          lag: keys.map((k) => Math.round(g.lagSum[k] / g.frames)).join('/') || '-',
          lagMax: keys.map((k) => Math.round(g.lagMax[k])).join('/') || '-',
          rtt: Math.round(this.netRtt),
          phase: this.phase,
        });
      }
      g.fluAt = now + 1000;
      g.frames = 0;
      g.maxF = 0;
      g.jank = 0;
      g.inN = [0, 0, 0];
      g.gapMax = [0, 0, 0];
      g.lagSum = [0, 0, 0];
      g.lagMax = [0, 0, 0];
    }

    // MOVIMIENTO de los 4 cada 200 ms
    const b = this.ball.s;
    if (playing && now >= g.mvAt) {
      g.mvAt = now + 200;
      const pos = (a: Actor | undefined) => {
        if (!a) return '-';
        const i = a.ch.debugInfo();
        return `${Math.round(a.x)},${Math.round(a.y)}${i ? ` ${i.state}/${i.anim}#${i.frame}${i.paused ? 'P' : ''}` : ''}`;
      };
      d.log('mv2', { me: pos(this.player), mate: pos(this.ally), r1: pos(this.rivalActors[0]), r2: pos(this.rivalActors[1]), ball: `${Math.round(b.x)},${Math.round(b.y)},${Math.round(b.z)}`, hitter: this.lastHitter ?? '-' });
    }

    // FOTO cada 1 s
    if (now >= g.snapAt) {
      g.snapAt = now + 1000;
      d.log('snap2', {
        role: this.net?.role,
        phase: this.phase,
        srv: this.server,
        iServe: this.net2IServe,
        recv: this.diag2Who(this.serveReceiver),
        mateRemote: this.allyRemote,
        score: this.diag2Score(),
        ball: `${Math.round(b.x)},${Math.round(b.y)},${Math.round(b.z)} v${Math.round(b.vx)},${Math.round(b.vy)},${Math.round(b.vz)}`,
        hitter: this.lastHitter ?? '-',
        cine: this.cine.active,
        remoteCine: !!this.netRemoteCine,
        legend: !!this.legend,
        rtt: Math.round(this.netRtt),
      });
    }

    // sin estados de un actor remoto
    for (const k of keys) {
      if (!g.lastIn[k]) g.lastIn[k] = now;
      if (playing && now - g.lastIn[k] > 800 && !g.noState[k]) {
        g.noState[k] = true;
        d.log('no-state2', { who: this.diag2Who(this.net2Actor(k)), age: Math.round(now - g.lastIn[k]), phase: this.phase });
      }
    }

    // saltos de posición y estados ocupados que no terminan, de los 4
    const busy = ['serve', 'remate', 'swing', 'dive', 'stun', 'emote', 'sprint', 'inferno', 'turn', 'land'];
    for (const a of all) {
      const p = g.prev.get(a);
      if (p) {
        const moved = Math.hypot(a.x - p.x, a.y - p.y);
        if (moved > 60 && this.phase === 'rally') d.log('tp2', { who: this.diag2Who(a), dist: moved, from: `${Math.round(p.x)},${Math.round(p.y)}`, to: `${Math.round(a.x)},${Math.round(a.y)}`, phase: this.phase });
        p.x = a.x;
        p.y = a.y;
      } else g.prev.set(a, { x: a.x, y: a.y });
      const st = a.ch.debugInfo()?.state ?? '';
      let k = g.stuck.get(a);
      if (!k) g.stuck.set(a, (k = { state: st, t: 0, logged: false }));
      if (st !== k.state) {
        k.state = st;
        k.t = 0;
        k.logged = false;
      } else if (busy.includes(st)) {
        k.t += dt;
        if (k.t > 3 && !k.logged) {
          k.logged = true;
          d.log('stuck2', { who: this.diag2Who(a), state: st, secs: k.t, phase: this.phase, actor: this.diagActor(a) });
        }
      }
    }
    d.tick(now);
  }

  // ---------------------------------------------------------------- 2v2 ONLINE (2 humanos del mismo equipo vs 2 bots del host)
  /** el actor de la pareja remota: 0 = el otro humano; 1 y 2 = los bots rivales (el host los simula) */
  private net2Actor(k: number): Actor | null {
    return k === 0 ? this.ally : (this.rivalActors[k - 1] ?? null);
  }

  /** índice de un actor para los avisos del 2v2: 0 = el otro humano, 1 y 2 = los bots del host; -1 si no es de la pareja */
  private net2Index(a: Actor): number {
    if (a === this.ally) return 0;
    const i = this.rivalActors.indexOf(a);
    return i >= 0 ? i + 1 : -1;
  }

  /**
   * ¿Este teléfono avisa de lo que le pasa a `a` (aturdido, raqueta, estrellas)? Devuelve el dato `a` que lleva el aviso
   * (vacío = es mi jugador) o null si no lo anuncia este teléfono (1v1 contra bot, el aliado remoto, los bots vistos desde el invitado).
   */
  private net2Tag(a: Actor): { a?: number } | null {
    if (!this.net) return null;
    if (a === this.player) return {};
    if (this.net2host) {
      const i = this.rivalActors.indexOf(a);
      if (i >= 0) return { a: i + 1 };
    }
    return null;
  }

  /** ejecuta `fn` con `a` como el rival activo (las funciones remotas del 1v1 trabajan sobre `this.bot`) */
  private asBot<T>(a: Actor, fn: () => T): T {
    const prev = this.bot;
    this.bot = a;
    try {
      return fn();
    } finally {
      this.bot = prev;
    }
  }

  /** sprites de todos los personajes en cancha (los que se congelan en una cinemática) */
  private freezeSprites() {
    return this.everyone().flatMap((a) => spritesIn(a.ch));
  }

  /**
   * 2v2 ONLINE: avisos de habilidades del compañero (data.a = 0) o de un bot del host (data.a = 1 / 2). Las cinemáticas
   * congelan este teléfono el mismo tiempo (como en el 1v1); aturdido, raqueta y estrellas se ven igual que allí.
   */
  private net2ApplyAction(m: ActionMsg) {
    // el compañero (que saca) se quedó sin tiempo para sacar: falta, y la juzgo yo (host) como si fuera mía
    if (m.kind === 'serve-timeout') {
      if (this.net2host && this.server === 'player' && !this.net2IServe && (this.phase === 'serve' || this.phase === 'toss')) this.tossFault();
      return;
    }
    const k = Number(m.data?.a) || 0;
    const actor = this.net2Actor(k);
    if (!actor || this.phase === 'over') return;
    if (m.kind === 'smash-armed') {
      if (isSmashPower(m.data?.element)) this.netRivalSmashEl = m.data.element;
      // (19-11-2026) el compañero armó su ESPECIAL: su brillo leve, con el color de su poder (updateSmashGlow)
      if (actor === this.ally) {
        this.net2MateArmed = true;
        this.net2MateEl = isSmashPower(m.data?.element) ? m.data.element : 'fire';
      }
    } else if (m.kind === 'smash-disarmed') {
      if (actor === this.ally) this.net2MateArmed = false;
    } else if (m.kind === 'emote') {
      // emote del compañero: su globo, con SU cara
      this.emotes.showRemote(String(m.data?.kind ?? ''), () => this.headPos(actor), this.skinOf(actor)); // con SU cara
    } else if (m.kind === 'lunge') {
      this.net2Lunge(actor, m.data);
    } else if (m.kind === 'sprint-start' || m.kind === 'sprint-end') {
      this.net2Dash(actor, k, m.kind === 'sprint-start', m.data);
    } else if (m.kind === 'defensive') {
      this.net2Defensive(actor, m.data);
    } else if (m.kind === 'remate-start' || m.kind === 'remate-end') {
      this.net2Remate(actor, m.kind === 'remate-start', m.data);
    } else if (m.kind === 'smash-cine') {
      if (actor === this.ally) this.net2MateArmed = false;
      this.net2YieldCine();
      this.asBot(actor, () => this.netRemoteSmashCine(m.data));
    } else if (m.kind === 'inferno-cine') {
      const power = m.data?.power;
      if (isInfernoPower(power)) {
        if (isLegendaryInferno(power)) return; // la ULTI LEGENDARIA aún no está en el 2v2 online
        this.netRivalInferno = power;
      }
      this.net2YieldCine();
      // sin ULTI contra ULTI: la del compañero bloquea a los bots y la de un bot, a los humanos
      if (actor === this.ally) this.ultiStart('player', this.bot);
      else this.ultiStart('bot', this.player);
      this.asBot(actor, () => this.netRemoteInfernoCine(m.data));
    } else if (m.kind === 'stunned') {
      this.asBot(actor, () => this.netBotStunned(Number(m.data?.ms), m.data?.kind, m.data?.resist === true));
    } else if (m.kind === 'racket') {
      this.asBot(actor, () => this.netRemoteRacket(m.data));
    } else if (m.kind === 'sky-launch') {
      this.skyLaunch(actor, true);
      // el compañero salió volando: el punto es del rival y lo decide el host (el invitado no juzga)
      if (this.net2host && actor === this.ally) this.pointTo('bot', '¡BUEN PUNTO!', '#ffd23f');
    }
  }

  /*
   * (19-11-2026) 2v2 ONLINE: ACCIONES del compañero vistas en este teléfono. En el 2v2 NADA se espeja y su posición ya llega por sus
   * estados (net2Tick, suavizada): aquí solo se pone su ANIMACIÓN y los EFECTOS de la acción (como los ve él), sin mover su personaje.
   * TIEMPO LENTO sigue bloqueado en el 2v2 online.
   */
  /** ESTIRADA: el clip de la estirada hacia su lado (sin espejo) y el polvo */
  private net2Lunge(a: Actor, d: ActionMsg['data']) {
    if (this.phase !== 'rally') return;
    const side = Math.sign(Number(d?.side) || 1) || 1;
    a.ch.facing = side;
    if (!a.ch.lunge(side)) a.ch.swing();
    this.dustFx(a.x, a.y);
  }

  /** DEFENSIVO de carrera (DASH): sprint con el destello y el sonido de su poder, con el mismo retraso que su posición */
  private net2Dash(a: Actor, k: number, on: boolean, d: ActionMsg['data']) {
    const delay = this.net2Rem[k]?.interp.delayMs ?? 0;
    const el: SmashPower = isSmashPower(d?.element) ? d.element : 'fire';
    const dirX = Number(d?.dirX) || 0;
    this.time.delayedCall(delay, () => {
      if (!a.ch.active) return;
      if (!on) return void a.ch.setSprint(false, 0, true);
      if (this.phase !== 'rally') return;
      a.ch.setSprint(true, dirX);
      const p = project(a.x, a.y);
      this.dashFx.burst(p.sx, p.sy, p.s * VIEW.CHAR_K, a.ch.depth);
      sfx(this, dashSfx(el));
      // burst ya incluye polvo de arranque.
      const h = this.headPos(a);
      this.popText(h.x, h.y - 10, 'DEFENSIVO', '#c9a4ff', 26);
    });
  }

  /**
   * Los otros DEFENSIVOS (DESTELLO, teletransporte, RELÁMPAGO, SOMBRA, SUPERSALTO, VOLTERETA, PATINAJE): sus efectos de salida y de llegada, a sus
   * tiempos. Su recorrido lo dibujan sus estados (llega a donde llegó él).
   */
  private net2Defensive(a: Actor, d: ActionMsg['data']) {
    if (!d || this.phase === 'over' || d.kind === 'slowmo') return;
    const from = this.netBotPos(d.x, d.y);
    const to = this.netBotPos(d.tx, d.ty);
    if (!from || !to) return;
    const h = this.headPos(a);
    this.popText(h.x, h.y - 10, 'DEFENSIVO', '#c9a4ff', 26);
    const pf = project(from.x, from.y);
    const pt = project(to.x, to.y);
    const k = pf.s * VIEW.CHAR_K;
    if (d.kind === 'blink' || d.kind === 'warp' || d.kind === 'lightning') {
      // portal / destello en la salida; en la llegada, otro portal cuando reaparece
      const blink = d.kind === 'blink';
      const light = d.kind === 'lightning';
      const col = blink ? 0x45d9ff : light ? 0x4aa8ff : undefined;
      const glow = blink ? 0xd9f7ff : light ? 0xcfe8ff : undefined;
      const out = clamp(Number(d.out) || 120, 20, 600) + (light ? clamp(Number(d.chg) || 160, 30, 600) : 0);
      const inn = clamp(Number(d.in) || 120, 30, 600);
      if (blink || light) {
        this.dashFx.burst(pf.sx, pf.sy, k, a.ch.depth, col);
        this.dashFx.streak(pf.sx, pf.sy - 70 * k, pt.sx, pt.sy - 70 * k, k, a.ch.depth);
        sfx(this, 'dash-destello');
      }
      this.portalFx(from.x, from.y, col, glow);
      this.tweens.killTweensOf(a);
      this.tweens.add({
        targets: a,
        warp: 0,
        duration: out,
        ease: 'Quad.easeIn',
        onComplete: () => {
          this.portalFx(to.x, to.y, col, glow);
          this.tweens.add({ targets: a, warp: 1, duration: inn, ease: 'Back.easeOut' });
        },
      });
      return;
    }
    if (d.kind === 'shadow' || d.kind === 'skate') {
      this.dashFx.burst(pf.sx, pf.sy, k, a.ch.depth);
      sfx(this, d.kind === 'shadow' ? 'dash-shadow' : 'dash-destello', d.kind === 'shadow' ? 1 : 0.7);
      a.ch.setSprint(true, Math.sign(to.y - from.y) || 1);
      this.time.delayedCall(clamp(Number(d.ms) || 300, 150, 1000), () => a.ch.active && a.ch.setSprint(false, 0, true));
      return;
    }
    if (d.kind === 'jump' || d.kind === 'flip') {
      // SUPERSALTO / VOLTERETA: despegue con polvo y el salto (altura) durante su vuelo
      this.dustFx(a.x, a.y);
      this.takeoffSquash(a);
      if (d.kind === 'jump') this.jumpTakeoffFx(a.x, a.y);
      sfx(this, 'dash-jump');
      const ms = clamp(Number(d.ms) || 300, 150, 1000);
      this.tweens.add({ targets: a, lift: 70, duration: ms / 2, yoyo: true, ease: 'Sine.easeOut', onComplete: () => (a.lift = 0) });
    }
  }

  /** REMATE del globo del compañero: raqueta arriba y su salto hasta el contacto; al terminar, vuelve al suelo (sin cámara lenta aquí) */
  private net2Remate(a: Actor, on: boolean, d: ActionMsg['data']) {
    if (on) {
      if (this.phase !== 'rally') return;
      const T = clamp(Number(d?.t) || 0.4, 0.12, 0.8);
      a.ch.remateHold();
      this.tweens.add({ targets: a, lift: REMATE.jump, duration: T * 1000, ease: 'Sine.easeOut' });
      return;
    }
    a.ch.releaseRemate();
    this.tweens.add({ targets: a, lift: 0, duration: 220, ease: 'Quad.easeIn' });
  }

  /**
   * (19-11-2026) CARRERA de cinemáticas en el 2v2 online: los dos teléfonos lanzaron su ESPECIAL / ULTI sobre la misma pelota antes de recibir la
   * del otro. Gana la del ANFITRIÓN (como los golpes casi a la vez): el invitado CANCELA la suya (su golpe no sale; el ESPECIAL sigue armado y la
   * ULTI se aborta como al cancelarla) y muestra la remota. El anfitrión ignora la del invitado (cineLock en netRemote*), así los dos ven lo mismo.
   */
  private net2YieldCine() {
    if (this.net2host || !this.cine.active || this.netRemoteCine || this.legend) return;
    this.diag?.log('cine-yield', { phase: this.phase });
    this.cine.cancel();
  }

  /** estado remoto (del otro humano o de un bot) → su cola de suavizado */
  private net2OnState(st: StateMsg) {
    const k = st.a ?? 0;
    const r = this.net2Rem[k];
    if (!r || this.entering) return;
    this.netLastMsgAt = performance.now();
    this.diag2In(k);
    r.last = st;
    r.interp.push(st.t, performance.now(), st);
  }

  /** pone a un actor remoto exactamente en (x, y) (sin suavizado desde donde estaba) */
  private net2Anchor(k: number, x: number, y: number) {
    const r = this.net2Rem[k];
    if (r) r.interp.reset(performance.now(), { x, y, moving: false, dirX: 0, facing: r.last?.facing ?? (k === 0 ? 1 : -1), charging: false, stunned: false });
  }

  /** cada fotograma: mueve y anima a los actores remotos (el compañero; en el invitado, también los 2 bots) con la posición suavizada */
  private net2Tick(dt: number) {
    const keys = this.net2host ? (this.allyRemote ? [0] : []) : [0, 1, 2];
    const now = performance.now();
    for (const k of keys) {
      const a = this.net2Actor(k);
      const r = this.net2Rem[k];
      if (!a || !r || this.entering) continue;
      if (a.stun > 0) a.stun -= dt;
      if (this.phase === 'over' || this.phase === 'pointover' || this.paused) {
        a.ch.setMoving(false, 0);
        a.ch.setCharging(false);
        continue;
      }
      const smp = r.interp.sample(now);
      if (smp) {
        a.x = smp.x;
        a.y = smp.y;
      }
      const st = smp?.snap ?? r.last;
      if (!st) continue;
      const moving = smp ? !smp.stale && (st.moving || smp.speed > PLAYER_SPEED * MOTION.moveMin) : st.moving;
      const speedK = smp ? smp.speed / PLAYER_SPEED : undefined;
      a.ch.setMoving(moving, st.dirX, moving && speedK !== undefined ? Math.max(speedK, MOTION.moveMin) : speedK);
      a.ch.setCharging(st.charging && !moving);
      a.ch.facing = st.facing;
    }
  }

  /** host: manda a su compañero el estado de los 2 bots (~20 Hz; quietos, un latido cada 250 ms) */
  private net2SendBots() {
    if (!this.net || !this.net2host || this.rivalActors.length < 2) return;
    const now = this.time.now;
    for (let i = 0; i < 2; i++) {
      const a = this.rivalActors[i];
      const s = this.net2BotSend[i];
      const dist = Math.hypot(a.x - s.x, a.y - s.y);
      const moving = dist > 0.6;
      if (now - s.at < (moving ? 50 : 250)) continue;
      const dx = a.y - s.y;
      s.at = now;
      s.x = a.x;
      s.y = a.y;
      s.moving = moving;
      this.net.sendState({ t: performance.now(), x: a.x, y: a.y, moving, dirX: Math.abs(dx) > 0.3 ? Math.sign(dx) : 0, facing: a.ch.facing, charging: false, stunned: a.stun > 0, a: i + 1 });
    }
  }

  /** golpe remoto del 2v2: del otro humano (sin `a`) o de un bot del host (`a` = 1 / 2). La pelota llega ya sin espejar. */
  private net2ApplyHit(h: HitMsg, recvAt?: number, heldSec = 0) {
    if (this.phase === 'over' || !this.ally) return;
    if (h.impact) h = { ...h, power: false, inferno: false }; // (19-11-2026) la devolución floja de un impacto nunca es bola de poder
    const isBot = h.a === 1 || h.a === 2;
    const actor = isBot ? this.rivalActors[(h.a as number) - 1] : this.ally;
    if (!actor) return;
    // golpes simultáneos: el host manda. Si ya golpeó hace poco, el golpe del invitado se descarta (él recibirá el del host)
    if (this.net2host && !isBot && performance.now() - this.net2HostHitAt < 250) {
      this.diag?.log('hit2-drop', { kind: h.kind, since: performance.now() - this.net2HostHitAt, phase: this.phase });
      return;
    }
    // el que golpea está en su cinemática (aquí congelada el mismo tiempo): su golpe se aplica al terminar, una sola vez
    if (this.netRemoteCine) {
      // al aplicarlo, la pelota avanza lo que estuvo retenido (la del que golpeó ya va por delante) más lo que tardó en llegar
      const got = performance.now();
      const at = recvAt ?? got;
      this.netDeferred.push(() => this.net2ApplyHit(h, at, heldSec + (performance.now() - got) / 1000));
      return;
    }
    this.netEarlyStart();
    this.netApplying = true;
    actor.x = h.x;
    actor.y = h.y;
    this.net2Anchor(isBot ? (h.a as number) : 0, h.x, h.y);
    if (isBot) {
      this.bot = actor;
      const idx = (h.a as number) - 1;
      this.brain = this.rivalBrains[idx];
      this.ai = this.brain.ai;
    }
    const s = this.ball.s;
    s.x = h.ball.x;
    s.y = h.ball.y;
    s.z = h.ball.z;
    s.vx = h.ball.vx;
    s.vy = h.ball.vy;
    s.vz = h.ball.vz;
    s.damp = h.ball.damp;
    s.fric = h.ball.fric;
    s.g = h.ball.g;
    s.back = h.ball.back;
    s.backBounced = undefined;
    s.ay = h.ball.ay;
    if (recvAt !== undefined && !(h.kind === 'hit' && this.net2host && this.rallyRemaining === 0)) {
      this.netAdvanceBall(Math.min(0.6, this.netHitDelay(h, recvAt) + heldSec));
    }
    // ESPECIAL / ULTI: la bola con el poder de quien la lanzó (viene en el golpe; sin él, el último que armó el compañero / el kit del bot)
    const elSmash = isSmashPower(h.el) ? h.el : isBot ? this.botKit.smash : this.netRivalSmashEl;
    const elUlti: InfernoElement = isInfernoPower(h.el) ? h.el : isBot ? this.botKit.inferno : infernoElementFor(this.net!.opponent.skin, this.netRivalInferno);
    if (h.power && !h.inferno) this.setSmashFlight(elSmash);
    this.ball.setPower(h.power || h.inferno);
    this.ball.setKind(h.shotKind as ShotKind, h.charged);
    this.ball.setMaxCharge(!!h.shock && !h.power && !h.inferno);
    if (h.rallyFault) this.rallyForcedShot = h.rallyFault;
    this.recordHit(isBot ? 'bot' : 'player', h.defensive);
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
      fx = actor.ch.swing();
      this.announceServeSpeed(); // 2v2 online: el saque de un bot del host o del compañero, visto aquí
    } else if (h.impact) {
      this.serving = false;
      fx = -1;
    } else {
      this.serving = false;
      if (h.lunge) {
        const side = Math.sign(h.lunge);
        actor.ch.facing = side;
        fx = actor.ch.lunge(side) ? 0 : actor.ch.swing();
      } else {
        fx = actor.ch.swing(h.power || h.charged, h.overhead, h.special ?? (h.power && h.overhead), h.volley);
        if (h.power && !h.inferno) actor.ch.holdFollowThrough(SPECIAL_HOLD_FRAME, SPECIAL_IMPACT_HOLD_MS);
      }
    }
    const fxEl = h.inferno ? elUlti : h.power ? elSmash : undefined;
    if (fx >= 0) this.hitFxAt(fx, h.ball.x, h.ball.y, h.ball.z, h.power || h.inferno, 0.15, !!h.inferno, fxEl, h.kind === 'serve' ? 'ball-saque-1' : undefined);
    if (h.inferno) {
      // ULTI: esfera de fuego en vuelo, explosión, sacudida y sonido (los mismos que ve quien la lanza)
      this.infernoFlight = true;
      this.infernoBounced = false;
      this.ball.quietFx = true;
      this.infernoEl = elUlti;
      this.fire.setElement(elUlti);
      const b = project(s.x, s.y, s.z);
      infernoImpactFx(this, b.sx, b.sy, b.s, elUlti);
      infernoShake(this);
      infernoSound.impact(this, elUlti);
    }
    this.netApplying = false;
  }

  /** el compañero se cortó o se rindió: un BOT juega por él; si fue un corte, al volver recupera su personaje */
  private net2MateAway(gone: boolean) {
    if (!this.net2host) return;
    const mateWasServing = this.server === 'player' && !this.net2IServe; // (antes de cambiar allyRemote: net2ServerIsHost lo mira)
    this.diag?.log('mate-away', { gone, mateWasServing, phase: this.phase, score: this.diag2Score() });
    this.allyRemote = false;
    if (this.ally) {
      this.ally.ch.setMoving(false, 0);
      this.ally.ch.setCharging(false);
    }
    showSideNotice(this, gone ? 'Tu compañero se rindió · juega un BOT' : 'Compañero desconectado · juega un BOT', 0xff9a1f, 1800);
    // si le tocaba sacar a él y aún no sacó, saca el host (el bot aliado no saca): se vuelve a colocar el punto
    if (mateWasServing && (this.phase === 'serve' || this.phase === 'toss')) {
      this.serveCtl.reset();
      this.phase = 'pointover';
      this.startPoint(this.faults > 0);
    }
  }

  /**
   * (19-11-2026, usuario) 2v2 ONLINE: se fue el ANFITRIÓN y este teléfono PASA A SER el anfitrión (el servidor ya lo cambió: MatchNet.role).
   * Desde aquí simula a los 2 bots y juzga los puntos (net2host / simBots miran el rol); el personaje del que se fue lo juega el bot aliado
   * (allyRemote = false) y se REJUEGA el punto en curso desde el marcador oficial (netResume), así nada queda a medias.
   */
  private net2Promoted(sc: ScoreMsg) {
    if (!this.net2 || this.phase === 'over') return;
    this.diag?.log('promoted', { role: this.net?.role, phase: this.phase, score: this.diag2Score(), official: `${sc.points.host}-${sc.points.guest} / ${sc.games.host}-${sc.games.guest}` });
    this.allyRemote = false;
    if (this.ally) {
      this.ally.ch.setMoving(false, 0);
      this.ally.ch.setCharging(false);
    }
    // los bots dejan de llegar por la red: sus colas de suavizado se vacían y sus cerebros empiezan desde su sitio actual
    for (const r of this.net2Rem) r.interp.clear();
    this.rivalActors.forEach((a, i) => this.rivalBrains[i]?.ai.reset(a.x, a.y));
    this.banner('EL ANFITRIÓN SE FUE', '#ffd23f', 44, 1100);
    this.time.delayedCall(900, () => this.sys.isActive() && showSideNotice(this, 'Sigues tú · tu compañero lo juega un BOT', 0xff9a1f, 2000));
    this.netResume(sc);
  }

  private net2MateBack(sc?: ScoreMsg) {
    if (!this.net2host || !this.ally) return;
    this.diag?.log('mate-back', { phase: this.phase, score: this.diag2Score() });
    this.allyRemote = true;
    this.net2Anchor(0, this.ally.x, this.ally.y);
    showSideNotice(this, 'Tu compañero volvió', 0x5dff8a, 1500);
    if (sc) this.netResume(sc); // los dos rejuegan el punto desde el marcador oficial, como en el 1v1
  }
  /** ¿El que saca ahora lo hace desde OTRO teléfono? (1v1: el rival; 2v2 online: el compañero humano cuando le toca; los bots los simula el host) */
  private netRemoteServes() {
    return this.net2 ? this.server === 'player' && !this.net2IServe : this.server === 'bot';
  }

  /** El rival está AHORA en (x, y): la interpolación se muestra desde ahí (golpe, teletransporte, cinemática). */
  private netAnchor(x: number, y: number) {
    this.diagCause = 'anchor';
    const r = this.netRemote;
    this.netInterp.reset(performance.now(), { x, y, moving: false, dirX: 0, facing: r?.facing ?? -1, charging: false, stunned: r?.stunned ?? false });
  }

  /** Carga del rival vista desde aquí: aro en el suelo, brillo del cuerpo y la raqueta y, al máximo, chispas (como las suyas). */
  private rivalChargeFx(dt: number) {
    // sonido de "cargando" del rival (bot y online): el mismo del tuyo pero más bajo, como si sonara más lejos
    if (this.rivalChargeT > 0 && !this.rivalChargeSnd && this.cache.audio.exists('cargando')) {
      this.rivalChargeSnd = this.sound.add('cargando', { volume: RIVAL_CHARGE_VOL });
      this.rivalChargeSnd.play();
    } else if (this.rivalChargeT <= 0 && this.rivalChargeSnd) {
      this.fadeOutSnd(this.rivalChargeSnd);
      this.rivalChargeSnd = null;
    }
    const bt = this.bot;
    // efecto con sprites (su carga elegida o la de su personaje): como el tuyo, ~1 s de carga CLÁSICA y luego la elegida;
    // al soltar, la elegida se disipa (si llegó a verse)
    if (isSpriteCharge(this.rivalChargeKind)) {
      if (this.rivalChargeT >= 1) this.rivalSpriteOn = true;
      else if (this.rivalChargeT > 0) this.rivalSpriteOn = false;
    } else this.rivalSpriteOn = false;
    if (!this.rivalSpriteOn && isSpriteCharge(this.rivalChargeKind)) this.rivalChargeSprite.hide(); // mientras va la clásica
    if (this.rivalSpriteOn) {
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
    if (h.rallyFault && this.legend?.att === 'bot') this.legendCancel();
    // (17-11-2026) ULTI LEGENDARIA propia en curso: su devolución (el impacto) se aplica al terminar la cinemática
    if (this.legend && this.legend.att === 'player') {
      this.legendTodo.push(() => this.netApplyHit(h));
      return;
    }
    // (17-11-2026) su golpe de la ULTI LEGENDARIA llegó tarde: ya se vio (y se aplicó el impacto) en la cinemática
    if (h.inferno && !h.rallyFault && performance.now() < this.legendDropHitUntil) return;
    this.duelAbort('hit'); // el golpe del ganador del duelo (o cualquier golpe del rival) cierra el duelo y se aplica normal
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
    // golpe: sigue desde el punto del contacto, pero el dibujo se DESLIZA hasta ahí (NET_SNAP_MS) en vez de saltar: aquí
    // el rival va ~100-150 ms por detrás y el salto se notaba (65-120 px)
    const offX = bt.x - h.x;
    const offY = bt.y - h.y;
    this.netSnap = Math.hypot(offX, offY) < 220 ? { x: offX, y: offY, at: performance.now() } : null;
    bt.x = h.x;
    bt.y = h.y;
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
    s.g = h.ball.g; // gravedad propia del globo disparado
    s.back = h.ball.back; // DROP SHOT 0 del rival
    s.backBounced = undefined;
    s.ay = h.ball.ay; // curva del saque con efecto (ya espejada por MatchNet)
    // la pelota llega con el retraso de la red: se avanza lo que tardó el mensaje (sin pasar su bote ni la red)
    if (recvAt !== undefined && !(h.kind === 'hit' && this.net?.role === 'host' && this.rallyRemaining === 0)) {
      const adv = this.netHitDelay(h, recvAt);
      // (21-11-2026, log online: adelantos de hasta 178 ms = la pelota saltaba un trecho) se adelanta de golpe solo hasta NET_BALL_JUMP;
      // el resto lo recupera el rally corriendo un poco más rápido (netBallCatch)
      const now0 = Math.min(adv, NET_BALL_JUMP);
      this.netAdvanceBall(now0);
      this.netBallCatch = adv - now0;
      this.diag?.log('hit-apply', { kind: h.kind, adv: adv * 1000, rtt: this.netRtt, off: this.netInterp.minOffset ?? -1, t: h.t, bx: h.x, by: h.y, from: this.diagBotPos() });
    }
    this.diagCause = 'hit';
    // bola de fuego (SMASH / INFERNO del rival): al alcanzarla, el impacto de siempre (aturdido + devolución floja)
    // (19-11-2026) la devolución floja de un impacto (`impact`) nunca es una bola de poder, aunque llegue marcada
    if (h.impact) {
      h = { ...h, power: false, inferno: false };
    }
    if (h.power && !h.inferno) this.setSmashFlight(this.netRivalSmashEl); // su SMASH, con el poder que armó
    this.ball.setPower(h.power || h.inferno);
    if (h.power) this.netRivalArmed = false; // su ESPECIAL ya salió
    this.ball.setKind(h.shotKind as ShotKind, h.charged);
    this.ball.setMaxCharge(!!h.shock && !h.power && !h.inferno); // su golpe cargado al máximo se ve igual aquí
    if (h.shock && !h.power && !h.inferno && h.shotKind === 'lob') {
      this.maxLob = { hitter: 'bot' }; // su GLOBO DISPARADO: la cámara se aleja igual
      this.maxLobWide = Math.abs(h.x - NET_X) < NET_DUEL.netGap + 40; // el del duelo sale desde la red
    }
    // GLOBO DISPARADO del duelo (sale desde la red): sobre el que defiende, pegado a la red, pasa por su alcance; no se alcanza hasta que pasa
    if (h.shock && h.shotKind === 'lob' && Math.abs(h.x - NET_X) < NET_DUEL.netGap + 40) this.duelLobUntil = performance.now() + NET_DUEL.lobGraceMs;
    // si me lo manda así (ni cortita, globo, estirada ni respuesta a la ULTI), al devolverlo retrocedo un poco: lo aplico yo y lo aviso
    this.maxPushOn = h.kind === 'hit' && !!h.shock && !h.power && !h.inferno && !h.impact && !h.lunge && h.shotKind !== 'drop' && h.shotKind !== 'lob' ? 'player' : null;
    if (h.rallyFault) this.rallyForcedShot = h.rallyFault;
    this.recordHit('bot', h.defensive);
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
      this.announceServeSpeed(); // 1v1 online: el saque del rival, visto aquí (la pelota ya trae su velocidad)
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
      if (h.power && !h.inferno && !h.impact) bt.ch.holdFollowThrough(SPECIAL_HOLD_FRAME, SPECIAL_IMPACT_HOLD_MS); // (20-11-2026, usuario) ESPECIAL del rival online
    }
    // sonido propio: saque y remate del globo; el resto, golpe-fuerte
    const netSnd = h.kind === 'serve' ? 'ball-saque-1' : h.special && h.overhead && !h.power && !h.inferno ? 'ball-saque-2' : undefined;
    const { x: contactX, y: contactY, z: contactZ } = h.ball;
    if (fx >= 0) this.hitFxAt(fx, contactX, contactY, contactZ, h.power || h.inferno, 0.15, !!h.inferno, h.inferno ? infernoElementFor(this.vsOpp?.skin, this.netRivalInferno) : h.power ? this.netRivalSmashEl : undefined, netSnd);
    // (20-11-2026, usuario) remate normal del rival (sin globo ni poder): el mismo impacto que ve él
    if (fx >= 0 && h.overhead && h.charged && !h.power && !h.inferno && !h.special && !this.netRemateGrade) {
      this.time.delayedCall(fx, () => this.smashHitImpact(contactX, contactY, contactZ));
    }
    // REMATE del globo del rival: la misma onda, sacudida y, si fue justo al cierre del aro, SMASH! dorado
    const rg = this.netRemateGrade;
    this.netRemateGrade = null;
    if (fx >= 0 && rg) {
      const pr = project(contactX, contactY, contactZ);
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
          const hd = this.aboveHeadPos(bt);
          this.popText(hd.x, hd.y, 'SMASH!', '#ffd23f', 44);
        } else this.smashHitImpact(contactX, contactY, contactZ); // remate flojo: impacto contra la pelota

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
        sfx(this, 'electricidad', 0.8); // choque eléctrico del golpe cargado al 100 %
        this.maxContactFlash(pc.sx, pc.sy, pc.s);
      });
    }
    if (h.inferno) {
      // INFERNO DRIVE: esfera de fuego en vuelo, explosión, sacudida y sonido, como en el teléfono del rival
      this.infernoFlight = true;
      this.infernoBounced = false;
      this.ball.quietFx = true;
      // la bola del rival es la de SU poder (llega con 'inferno-cine'); si no llegó, la de su personaje (Mai = hielo)
      this.infernoEl = infernoElementFor(this.vsOpp?.skin, this.netRivalInferno);
      this.fire.setElement(this.infernoEl);
      const b = project(s.x, s.y, s.z);
      infernoImpactFx(this, b.sx, b.sy, b.s, this.infernoEl);
      infernoShake(this);
      infernoSound.impact(this, this.infernoEl);
    }
    if (h.power || h.inferno) {
    }
    this.netApplying = false;
  }

  private netApplyAction(a: ActionMsg) {
    if (a.kind === 'rally-clock') {
      if (this.net?.role === 'guest' && this.phase === 'rally' && (this.netPtOff || a.data?.pt === this.netPt) && this.rallyRemaining === null) {
        this.rallyRemaining = Math.max(0, RALLY_LIMIT.countdown - this.netRtt / 2000);
      }
      return;
    }
    const bt = this.bot;
    // (17-11-2026) ULTI LEGENDARIA propia en curso: su aturdido y su raqueta se ven al terminar la cinemática
    if (this.legend && this.legend.att === 'player' && (a.kind === 'stunned' || a.kind === 'racket')) {
      this.legendTodo.push(() => this.netApplyAction(a));
      return;
    }
    // 2v2 online: el ritmo de la red y el saque del host siguen su camino de siempre; las habilidades del compañero y de los bots, por net2ApplyAction
    // (las demás acciones del compañero —defensivos, estirada, remate…— aún no se muestran)
    if (this.net2 && a.kind !== 'toss' && a.kind !== 'ping' && a.kind !== 'pong' && a.kind !== 'catch' && a.kind !== 'serve-swing') {
      this.net2ApplyAction(a);
      return;
    }
    if (a.kind === 'toss') {
      const kind = (a.data?.kind as ServeKind) ?? 'normal';
      this.netEarlyStart();
      if (!this.netRemoteServes()) return;
      if (this.phase === 'serve') this.beginToss(kind);
      else this.netPendingToss = kind;
    } else if (a.kind === 'lunge') this.netRemoteLunge(a.data);
    else if (a.kind === 'timing') this.netRemoteTiming(a.data);
    else if (a.kind === 'ping') this.net?.sendAction('pong', { t: Number(a.data?.t) || 0 });
    else if (a.kind === 'pong') this.netOnPong(Number(a.data?.t));
    else if (a.kind === 'serve-swing') {
      // golpe del saque del rival: del lanzamiento al clip del golpe y su salto (como en su teléfono)
      if (this.netRemoteServes() && this.phase === 'toss') {
        const sa = this.srvActor();
        sa.ch.serveRelease();
        this.serveJump(sa, sa.ch.serveContactDelay());
      }
    } else if (a.kind === 'catch') {
      if (this.netRemoteServes() && this.phase === 'toss') {
        this.netApplying = true;
        this.catchBall();
        this.netApplying = false;
      }
    } else if (a.kind === 'sprint-start') {
      // DASH del rival: carrera de sprint + el mismo destello y sombras que ve quien lo hace (DashFx).
      // Su posición se dibuja netInterp.delayMs en el pasado: el sprint arranca cuando aquí empieza a correr (antes
      // corría en el sitio y la frenada caía con el cuerpo aún lanzado).
      const dirX = -(Number(a.data?.dirX) || 0);
      if (isSmashPower(a.data?.element)) this.netRivalSmashEl = a.data.element; // su poder equipado, antes de que arme el primer ESPECIAL
      const hitter = this.lastHitter;
      this.time.delayedCall(this.netInterp.delayMs, () => {
        if (this.phase !== 'rally' || this.lastHitter !== hitter) return; // ya golpeó o acabó el punto: el golpe manda
        bt.ch.setSprint(true, dirX);
        const p = project(bt.x, bt.y);
        this.dashFx.burst(p.sx, p.sy, p.s * VIEW.CHAR_K, bt.ch.depth);
        sfx(this, dashSfx(this.netRivalSmashEl));
        this.dustFx(bt.x, bt.y);
        const h = this.headPos(bt);
        this.popText(h.x, h.y - 10, 'DEFENSIVO', '#c9a4ff', 26);
        this.netBotDash = { t: 0, ghosts: 0 };
      });
    } else if (a.kind === 'sprint-end') {
      // frenada, como en su teléfono, con el mismo retraso que su posición
      this.time.delayedCall(this.netInterp.delayMs, () => {
        bt.ch.setSprint(false, 0, true);
        this.netBotDash = null;
      });
    }
    else if (a.kind === 'defensive') this.netRemoteDefensive(a.data);
    else if (a.kind === 'racket') this.netRemoteRacket(a.data);
    else if (a.kind === 'remate-start') this.netRemoteRemate(true, a.data);
    else if (a.kind === 'remate-end') this.netRemoteRemate(false, a.data);
    else if (a.kind === 'stunned') this.netBotStunned(Number(a.data?.ms), a.data?.kind, a.data?.resist === true);
    else if (a.kind === 'sky-launch') this.skyLaunch(this.bot, true); // el rival salió volando con mi ESPECIAL
    else if (a.kind === 'bump') this.netRemoteBump();
    else if (a.kind === 'duel-start') this.netRemoteDuelStart(a.data);
    else if (a.kind === 'duel-tap') this.netRemoteDuelTap(Number(a.data?.r), Number(a.data?.ms));
    else if (a.kind === 'duel-round') this.netRemoteDuelRound(a.data);
    else if (a.kind === 'duel-result') this.netRemoteDuelResult(Number(a.data?.w));
    else if (a.kind === 'duel-aim') this.netRemoteDuelAim(Number(a.data?.side));
    else if (a.kind === 'emote') this.emotes.showRemote(String(a.data?.kind ?? ''), () => this.headPos(this.bot));
    else if (a.kind === 'smash-armed') {
      // el rival armó su SMASH: aura con el color de SU poder (sin dato, fuego)
      this.netRivalSmashEl = isSmashPower(a.data?.element) ? a.data.element : 'fire';
      this.netRivalArmed = true; // su brillo leve de "ESPECIAL armado", igual que en su teléfono
    }
    else if (a.kind === 'smash-disarmed') this.netRivalArmed = false; else if (a.kind === 'smash-cine') this.netRemoteSmashCine(a.data);
    else if (a.kind === 'inferno-cine') {
      if (!this.ultiAcceptRemote()) return; // sin ULTI contra ULTI: la mía salió primero (o gana el anfitrión si se cruzaron)
      this.ultiStart('bot', this.player); // la suya salió primero: mi ULTI queda bloqueada hasta que recupere la raqueta el que la recibe
      // poder de su INFERNO (antes de la cinemática: aunque aquí no se pueda mostrar, su bola debe ser la suya)
      const power = a.data?.power;
      this.netRivalInferno = isInfernoPower(power) ? power : null;
      // (17-11-2026) su ULTI LEGENDARIA: la cinemática extra (mismo guion, espejado)
      if (isInfernoPower(power) && isLegendaryInferno(power)) this.netRemoteLegend(a.data);
      else this.netRemoteInfernoCine(a.data);
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
    if (d?.kind === 'slowmo') {
      // TIEMPO LENTO del rival: él corre en cámara lenta (llega por sus estados) y al llegar empieza su cinemática: aquí se congela el
      // partido el mismo tiempo, él se estira en cámara lenta y su golpe (game:hit) se aplica al terminar. Sin mover nuestra cámara.
      if (!smashCineEnabled() || this.cineLock || this.phase === 'over') return;
      const pos = this.netBotPos(d.x, d.y);
      if (!pos) return;
      const bt = this.bot;
      const side = -Math.sign(Number(d.side) || 1); // su derecha es nuestra izquierda
      const to = this.netBotPos(d.tx, d.ty) ?? pos;
      this.netBotSnap(pos);
      this.netDeferred = [];
      this.netRemoteCine = true;
      this.legendFade = false;
      bt.ch.facing = side;
      if (!bt.ch.lunge(side)) bt.ch.swing();
      const sprites = spritesIn(bt.ch);
      for (const sp of sprites) if (sp.anims) sp.anims.timeScale = SLOWMO.spriteK;
      sfx(this, 'cargando', 0.6);
      this.cine.start({
        profile: SLOWMO_CINE,
        onCancel: () => {
          this.legendFade = true;
          this.netEndRemoteCine(true);
        },
        freeze: [...spritesIn(this.player.ch), ...sprites],
        executor: sprites,
        leadMs: SLOWMO.leadMs,
        focus: () => this.cineFocus(bt),
        onFrame: (e) => {
          // se ve lo mismo que en su teléfono, salvo la cámara: penumbra y la estirada que avanza hacia la pelota
          const u = clamp(e / (SLOWMO.hitMs - 150), 0, 1);
          const m = u * u * (3 - 2 * u);
          bt.x = pos.x + (to.x - pos.x) * m;
          bt.y = pos.y + (to.y - pos.y) * m;
          this.renderActors();
          this.energyCine.drawDark(SLOWMO.dark, 0.016);
        },
        onHit: () => {
          this.netLungeAt = performance.now(); // ya se estiró: su golpe no repite la estirada
          this.legendFade = true;
          bt.x = to.x;
          bt.y = to.y;
          this.netEndRemoteCine();
        },
      });
      return;
    }
    if (d?.kind === 'lightning') {
      // RELÁMPAGO del rival: azul neón, rayo y rastro en el suelo hasta el punto, y reaparece (lightningWarp, la misma coreografía)
      const from = this.netBotPos(d.x, d.y);
      const to = this.netBotPos(d.tx, d.ty);
      if (!from || !to || this.phase === 'over') return;
      const bt = this.bot;
      const chg = clamp(Number(d.chg) || 160, 30, 600);
      const out = clamp(Number(d.out) || 40, 20, 600);
      const inn = clamp(Number(d.in) || 100, 30, 600);
      this.netEndBotFly(false);
      this.tweens.killTweensOf(bt);
      bt.x = from.x;
      bt.y = from.y;
      bt.ch.setMoving(false, 0);
      bt.ch.setCharging(false);
      this.netBotLockUntil = performance.now() + chg + out + inn + 60;
      const h = this.headPos(bt);
      this.popText(h.x, h.y - 10, 'DEFENSIVO', '#c9a4ff', 26);
      this.lightningWarp(bt, from, to, chg, out, inn);
      // al llegar, su posición de red se ancla ahí (como netRemoteWarp)
      this.time.delayedCall(chg + out, () => {
        this.netAnchor(to.x, to.y);
        if (this.netRemote) this.netRemote = { ...this.netRemote, x: to.x, y: to.y, moving: false };
      });
      return;
    }
    const kind = d?.kind === 'shadow' || d?.kind === 'jump' || d?.kind === 'flip' || d?.kind === 'skate' ? d.kind : null;
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
    const fly: NonNullable<MatchScene['netBotFly']> = { kind, from, to, t: 0, dur, ghosts: 0, puff: { t: 0 }, actor: bt };
    const h = this.headPos(bt);
    if (kind === 'shadow') {
      const clone = new Character(this, 0, 0, this.rivalLk(), 'front');
      for (const sp of spritesIn(clone)) sp.setTint(SHADOW.tint);
      clone.setAlpha(SHADOW.alpha);
      clone.setSprint(true, to.y - from.y);
      fly.clone = clone;
      const p = project(bt.x, bt.y);
      this.dashFx.burst(p.sx, p.sy, p.s * VIEW.CHAR_K, bt.ch.depth);
      sfx(this, 'dash-shadow');
      this.popText(h.x, h.y - 10, 'DEFENSIVO', '#c9a4ff', 26);
    } else if (kind === 'skate') {
      // PATINAJE del rival: patina hasta el punto dejando su camino de hielo
      bt.ch.setSprint(true, Math.sign(to.y - from.y) || 1);
      fly.trail = this.newIceTrail();
      fly.trail.add(from.x, from.y);
      const p = project(bt.x, bt.y);
      this.dashFx.burst(p.sx, p.sy, p.s * VIEW.CHAR_K, bt.ch.depth);
      sfx(this, 'dash-destello', 0.7);
      this.popText(h.x, h.y - 10, 'DEFENSIVO', '#c9a4ff', 26);
    } else {
      // SUPERSALTO / VOLTERETA del rival: despegue con polvo
      this.dustFx(bt.x, bt.y);
      this.takeoffSquash(bt);
      if (kind === 'jump') this.jumpTakeoffFx(bt.x, bt.y);
      sfx(this, 'dash-jump');
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
      this.dashFx.burst(a.sx, a.sy, k, bt.ch.depth, 0x45d9ff);
      sfx(this, 'dash-destello');
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
    const bt = f.actor ?? this.bot; // el que lanzó el defensivo (no el rival activo de ahora)
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
      this.shadowTrailPuff(f.clone, f.puff);
    } else if (f.kind === 'flip') {
      const po = flipPose(f.from, f.to, k);
      bt.x = po.x;
      bt.y = po.y;
      bt.lift = po.lift;
      bt.spin = po.spin;
      if (!f.mid && k >= 0.5) {
        f.mid = true;
        this.dustFx(po.x, po.y);
      }
      if (f.ghosts < 3 && k >= (f.ghosts + 1) / 4) {
        this.renderActorPose(bt);
        this.dashFx.ghost(bt.ch, f.ghosts++, bt.ch.depth);
      }
    } else if (f.kind === 'skate') {
      const e = skateEase(k);
      bt.x = f.from.x + (f.to.x - f.from.x) * e;
      bt.y = f.from.y + (f.to.y - f.from.y) * e;
      bt.spin = skateLean(f.from, f.to, k);
      f.trail?.add(bt.x, bt.y);
      if (f.ghosts < 2 && k >= (f.ghosts + 1) / 3) {
        this.renderActorPose(bt);
        this.dashFx.ghost(bt.ch, f.ghosts++, bt.ch.depth);
      }
    } else {
      bt.x = x;
      bt.y = y;
      bt.lift = 4 * JUMP.height * k * (1 - k);
      if (f.ghosts < 3 && k >= (f.ghosts + 1) / 4) {
        this.renderActorPose(bt);
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
    const bt = f.actor ?? this.bot; // el que lanzó el defensivo
    bt.lift = 0;
    bt.spin = undefined;
    f.trail?.finish(); // el camino de hielo se derrite aunque el vuelo se corte
    if (f.kind === 'skate') bt.ch.setSprint(false, Math.sign(f.to.y - f.from.y) || 1, arrived);
    if (f.clone) {
      const c = f.clone;
      this.tweens.add({ targets: c, alpha: 0, duration: 160, onComplete: () => c.destroy() });
    }
    if (!arrived) return;
    if (f.kind === 'shadow') {
      this.portalFx(f.from.x, f.from.y, 0x5a32b8, 0xd4bfff);
      this.portalFx(f.to.x, f.to.y, 0x9a6bff, 0xffffff);
      this.shadowSmokeFx(f.from.x, f.from.y, false);
      this.shadowSmokeFx(f.to.x, f.to.y, true);
    } else if (f.kind === 'flip') this.flipLandFx(bt, f.to.x, f.to.y, false);
    else if (f.kind === 'skate') iceSprayFx(this, f.to.x, f.to.y, Math.sign(f.to.y - f.from.y) || 1);
    else this.jumpLandFx(f.to.x, f.to.y, false, bt);
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
    // 2v2 online: nada se espeja (el compañero y los bots del host usan las coordenadas de la cancha tal cual)
    if (this.net2) return { x: clamp(nx, Math.min(P_X[0], B_X[0]), Math.max(P_X[1], B_X[1])), y: clamp(ny, Y_MIN, Y_MAX) };
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

  /**
   * Fija la posición remota de `a` (el rival del 1v1 o, en el 2v2 online, el compañero o un bot del host) en (x, y): la interpolación
   * sigue desde ahí. `still` = además lo deja sin movimiento ni carga (antes de una cinemática).
   */
  private netPlaceRemote(a: Actor, x: number, y: number, still = false) {
    if (this.net2) {
      const k = this.net2Index(a);
      if (k >= 0) this.net2Anchor(k, x, y);
      return;
    }
    if (this.netRemote) this.netRemote = { ...this.netRemote, x, y, moving: false, ...(still ? { charging: false } : {}) };
    this.netAnchor(x, y);
  }

  /** Deja al rival parado en `pos` (sin movimiento ni carga viejos) antes de su cinemática. */
  private netBotSnap(pos: { x: number; y: number }) {
    const bt = this.bot;
    bt.x = pos.x;
    bt.y = pos.y;
    this.netPlaceRemote(bt, pos.x, pos.y, true);
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
    if (!smashCineEnabled() || this.cineLock || this.phase === 'over') return;
    const pos = this.netBotPos(d?.x, d?.y);
    if (!pos) return;
    const bt = this.bot;
    this.netBotSnap(pos);
    this.netDeferred = [];
    this.netRemoteCine = true;
    const overhead = d?.overhead === true;
    const lead = bt.ch.swing(true, overhead, overhead, false, true); // pose de carga (frame 4), como en su teléfono
    if (isSmashPower(d?.element)) this.netRivalSmashEl = d.element; // el poder de su SMASH (ya llegó con 'smash-armed'; por si no)
    this.cine.start({
      profile: smashCine(this.netRivalSmashEl),
      onCancel: () => this.netEndRemoteCine(true),
      freeze: this.net2 ? this.freezeSprites() : [...spritesIn(this.player.ch), ...spritesIn(bt.ch)],
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
    if (this.cineLock || this.phase === 'over') return;
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
    const el = infernoElementFor(this.vsOpp?.skin, this.netRivalInferno);
    // la franja con SUS ojos, igual que la ve él (necesita su imagen cargada: preload)
    const gazeSkin = this.skinOf(bt); // 2v2: el compañero y cada bot con SUS ojos
    showInfernoGaze(this, INFERNO_CINE.hitAtMs - GAZE_END_BEFORE_HIT_MS, this.gazeY(), gazeSkin, el);
    this.ghosts.setLook(INFERNO_LOOK[el].ghostTint, INFERNO_LOOK[el].ghostRamp);
    this.cine.start({
      profile: infernoCine(el),
      freeze: this.net2 ? this.freezeSprites() : [...sprites, ...spritesIn(this.player.ch)],
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
        this.infernoDashStep(e, bt, from, to, sprites, dashSt, el);
      },
      onHit: () => {
        bt.x = to.x;
        bt.y = to.y;
        if (this.net2) this.netPlaceRemote(bt, to.x, to.y);
        else {
          if (this.netRemote) this.netRemote = { ...this.netRemote, x: to.x, y: to.y };
          this.netAnchor(to.x, to.y);
        }
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
  private netBotStunned(ms: number, sent?: unknown, resist = false) {
    const b = this.bot;
    const s = this.ball.s;
    // el tipo lo manda quien recibe el golpe; si no llega (versión vieja), el de la bola en vuelo aquí
    const kind: PowerKind = sent === 'inferno' || sent === 'smash' ? sent : this.infernoFlight ? 'inferno' : 'smash';
    const dur = clamp(Number.isFinite(ms) ? ms : stunMsFor(kind), 200, 2000);
    // (17-11-2026) ULTI LEGENDARIA: el impacto ya se vio aquí al terminar la cinemática; su aviso solo ajusta la duración
    if (kind === 'inferno' && this.legendStunShownAt && performance.now() - this.legendStunShownAt < 4000) {
      this.legendStunShownAt = 0;
      b.stun = dur / 1000;
      return;
    }
    // la bola de fuego desaparece en el impacto (como fireImpact)
    this.infernoFlight = false;
    this.infernoBounced = true;
    this.ball.quietFx = false;
    this.fire.clear();
    const feet = project(b.x, b.y);
    const head = this.headPos(b);
    const at = kind === 'inferno' ? project(s.x, s.y, s.z) : { sx: feet.sx, sy: (feet.sy + head.y) / 2 };
    powerImpactFx(this, kind, at.sx, at.sy, feet.s, kind === 'inferno' ? this.infernoEl : this.smashFlightEl, kind === 'inferno' ? feet.sy : undefined); // ULTI: el suelo real bajo sus pies (la huella del impacto)
    b.stun = dur / 1000; // estrellas de aturdido (renderActors) y fin sincronizado (netBotTick)
    if (kind === 'inferno') this.ultiStunOn(b, dur);
    // con la ULTI su raqueta la dibuja la acción 'racket' (cae en la cancha), no el clip
    if (!b.ch.impactStun(kind, dur, kind !== 'inferno')) {
      this.tweens.add({ targets: b.ch.rig, angle: { from: -POWER_IMPACT.recoilDeg * b.ch.facing, to: 0 }, duration: dur, ease: 'Elastic.easeOut' });
    }
    this.popText(head.x, head.y - 10, resist ? '¡RESISTE!' : '¡ATURDIDO!', resist ? '#9ff0ff' : '#ffd23f', 30); // (18-11-2026) en ZONA: ¡RESISTE!
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
      this.tweens.add({ targets: bt, lift: REMATE.jump * RIVAL_REMATE_JUMP_K, duration: T * 1000, ease: 'Sine.easeOut' });
      // (20-11-2026, usuario) el rival SALTA mostrando los frames del salto y se queda en el aire con la raqueta arriba hasta el golpe
      if (!bt.ch.remateJump()) bt.ch.remateHold();
      // (18-11-2026, usuario) sin texto "REMATE"; bordes oscuros mientras salta
      this.rivalSmashDim(true);
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
      this.popText(h.x, h.y - 20, '¡MUY PRONTO!', '#ff9aa3', 32);
    }
    if (this.netRemateLabel?.active) {
      this.tweens.killTweensOf(this.netRemateLabel);
      this.netRemateLabel.destroy();
    }
    this.netRemateLabel = null;
    this.setSlowMo(1);
    this.rivalSmashDim(false);
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











