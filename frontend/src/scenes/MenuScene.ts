import Phaser from 'phaser';
import { C, FONT, restartOnResize, textStyle } from '../ui/theme';
import { Character, playerLook } from '../objects/Character';
import { getProfile, levelProgress } from '../logic/Profile';
import { addPortrait } from '../characters/portrait';
import { applyCharColor } from '../fx/CharColorFx';
import type { SkinId } from '../characters/skins';
import { roundedPoly } from '../ui/shapes';
import { RankBadge, preloadRankBadges } from '../ui/RankBadge';
import { rankDef } from '../domain/ranks';
import { showRankList } from '../ui/RankListDialog';
import { arcadeButton, modeBand, modeShape } from '../ui/modeButtons';
import { chestStatus } from '../domain/chest';
import { gameClock } from '../domain/timeSource';
import { isDevMode } from '../domain/devMode';
import { maybeShowTutorial } from '../ui/TutorialDialog';
import { fitText } from '../ui/fitText';
import { myLeague, myPosition, rankedState, rankedView, riskModeStatus, riskUsedThisWeek, syncRanked, syncRiskMode, activateRiskMode, devActivateRisk, type RiskActivateError } from '../logic/Ranked';
import { formatRiskLeft } from '../domain/riskMode';
import { dailyLoginButton } from '../ui/DailyLoginButton';
import { friendsButton } from '../ui/FriendsButton';
import { globalRankingButton } from '../ui/GlobalRanking';
import { rank2v2 } from '../domain/league2v2';
import { doublesPlayButton, openDoublesDialog } from '../ui/PlayEntry2v2';
import { openFriendsDialog } from '../ui/FriendsDialog';
import { COINS_2V2 } from '../domain/coins2v2';
import { navLigaLabel } from '../ui/navLabel';
import { drawProfileFrame, openProfileDialog } from '../ui/ProfileDialog';
import { equippedFrame } from '../domain/profileFrames';
import { chestButton } from '../ui/ChestButton';
import { loadBet, rankedPlayButton } from '../ui/PlayEntry';
import { matchStakes } from '../domain/rankedConfig';
import { serverUrl } from '../net/config';
import { MAX_LEVEL } from '../config';
import { getPlayer, onPlayerChange } from '../domain/playerStore';
import { DailyWheels } from '../ui/DailyWheels';
import { showSettings } from '../ui/SettingsDialog';
import { BP_TIERS, bpClaimable, bpLevel, syncSeason } from '../domain/battlePass';
import { bpSeasonInfo } from '../domain/battlePassConfig';
import { totalPlayed } from '../logic/Stats';
import type { PlayerState } from '../domain/player';
import { openWheel, whenWheelReady } from './WheelScene';
import { uiSound } from '../fx/uiSound';
import { sfx } from '../fx/sfx';
import { masteryLevel, masteryProgress, passiveOf } from '../domain/characterPassives';
import { drawPassiveIcon } from '../ui/passiveInfo';
import { startIntroMusic } from '../fx/introMusic';
import { grantTestSpin, markWheelPresented, syncWheels, wheelToPresent } from '../logic/Wheels';

/** ancho máximo del número en los contadores (entre el icono y el botón +) */
/** ancho de los contadores de monedas / dinero y del texto de su cifra */
const COUNTER_W = 172;
const COUNTER_TEXT_W = 92;
/**
 * alto de la card del perfil (y de la fila de arriba: perfil · monedas · dinero · ajustes). 16-11-2026: 96 → 118 para separar 3 contadores;
 * 21-11-2026: las monedas de la LIGA bajan a la fila del PASE y el perfil queda del mismo alto que el botón de ajustes (100)
 */
const PROFILE_H = 100;
/** fin del widget del PASE (y 58 + perfil + 12 + 76): nada de los botones laterales sube más */
const PASS_BOTTOM = 58 + PROFILE_H + 12 + 76;
/** alto de cada contador: la columna de 2 (MONEDAS · DINERO) cabe en el alto de la card del perfil, con aire entre ellos */
const COUNTER_H = 40;
const COUNTER_GAP = 10;
const COUNTER_TOP = (PROFILE_H - COUNTER_H * 2 - COUNTER_GAP) / 2;
const COUNTER_STEP = COUNTER_H + COUNTER_GAP;


/**
 * Menú principal (vertical) estilo app de juego:
 *   barra de perfil (avatar + nivel + XP) · monedas/gemas · ajustes
 *   personaje grande al centro
 *   accesos laterales (Personaje, Tienda)
 *   botón JUGAR
 *   barra inferior (Ranking · Inicio · Eventos)
 * Monedas, gemas, tienda, ranking y eventos son visuales por ahora (sin lógica).
 */
/** Alto visible del personaje del menú (px) y desplazamiento a la derecha del centro. */
const HERO_H = 760;
const HERO_SHIFT_X = 112;
const BG_ZOOM = 1.12;

/**
 * Barra inferior en imagen (public/assets/nav-bar.webp). `box` = contenido visible en píxeles
 * de la imagen (sin el margen transparente); `split` = límites entre las 3 pestañas (0..1).
 * Si la imagen no existe se dibuja la barra vectorial de antes.
 */
/** MODO RIESGO x2: pulsación más corta que esto = toque (abre la explicación); mantener RISK_HOLD_MS = activarlo */
const RISK_TAP_MS = 280;
const RISK_HOLD_MS = 3000;
const RISK_MSG: Record<RiskActivateError, string> = {
  offline: 'Necesitas conexión para activar el MODO RIESGO',
  not_monday: 'El MODO RIESGO solo se activa los lunes',
  already_used: 'Ya usaste el MODO RIESGO esta semana',
  active: 'El MODO RIESGO ya está activo',
  unknown: 'No se pudo activar el MODO RIESGO',
};
const NAV = {
  key: 'nav-home',
  file: 'assets/barra-inicio.webp',
  w: 2172,
  h: 724,
  box: { x0: 46, y0: 170, x1: 2124, y1: 540 },
  split: [0.33, 0.67] as [number, number],
  side: 6, // margen lateral en pantalla
  bottom: 26, // margen inferior en pantalla
};

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  preload() {
    if (!this.textures.exists('menu-bg')) this.load.image('menu-bg', 'assets/menu-bg.webp');
    if (!this.textures.exists('daily-coins-art')) this.load.image('daily-coins-art', 'assets/monedas.webp');
    if (!this.textures.exists('daily-cash-art')) this.load.image('daily-cash-art', 'assets/billetes.webp');
    // icono del contador de DINERO (16-11-2026, usuario): el fardo chico (sin fondo; original magenta en dinero-virtual-2.webp)
    if (!this.textures.exists('cash-pack')) this.load.image('cash-pack', 'assets/dinero-fardo-chico.webp');
    if (!this.textures.exists('daily-title-art')) this.load.image('daily-title-art', 'assets/premio-diario.webp');
    if (!this.textures.exists(NAV.key)) this.load.image(NAV.key, NAV.file);
    if (!this.textures.exists('battle-pass-insignia')) this.load.image('battle-pass-insignia', 'assets/insignia-pase-batalla.webp'); // escudo del nivel del PASE (el mismo de su pantalla)
    if (!this.textures.exists('menu-liga')) this.load.image('menu-liga', 'assets/liga.webp'); // trofeo de la card de LIGA
    if (!this.textures.exists('coin-2v2')) this.load.image('coin-2v2', 'assets/moneda-2v2.webp'); // MONEDA 2V2 (morada); si el archivo no está, se dibuja una
    preloadRankBadges(this.load, [myLeague()]);
  }

  /** EXP ganada en la partida que acaba de terminar (MatchEndScene): se anima al volver; 0 = nada pendiente */
  private xpGain = 0;
  /** MAESTRÍA ganada en la partida (MatchEndScene): la 3.ª oleada de la presentación va al personaje; null = ninguna */
  private masteryGain: { skin: string; before: number; after: number } | null = null;
  /** el personaje grande del menú (retrato o Character) y su caja en pantalla: destino de la maestría */
  private hero: { obj: Phaser.GameObjects.Image | Phaser.GameObjects.Container; rect: { x: number; y: number; w: number; h: number } } | null = null;
  /** animaciones de las barras (nivel y pase) que esperan a la ruleta / al "+N EXP" */
  private xpAnims: (() => void)[] = [];
  /** posición de las cards (para el texto "+N EXP") */
  private xpAt: { x: number; y: number; rect: { x: number; y: number; w: number; h: number }; obj?: Phaser.GameObjects.Container; kind: 'level' | 'pass' }[] = [];
  /**
   * (21-11-2026) PREMIO DE LA RULETA (registry menu.wheelGain, lo apunta WheelScene al cobrar): monedas y EXP que se ven llegar a las cards al volver al
   * menú. Mientras la ruleta está abierta (registry wheel.open) los contadores NO se actualizan solos: coinRefresh, profileRefresh y passRefresh los
   * ponen al día cuando el premio llega.
   */
  private wheelGain: { coins: number; xp: number } | null = null;
  private coinRect: { x: number; y: number; w: number; h: number } | null = null;
  private coinRefresh: (() => void) | null = null;
  private coinObj: Phaser.GameObjects.Container | null = null;
  /** monedas de una ruleta ya cobrada que esperan a verse llegar a su card */
  private pendingCoins = 0;
  /** monedas ganadas en la partida que aún no se vieron llegar al monedero (playMatchCoins) */
  private matchCoins = 0;
  /** pone el monedero de arriba en un valor al instante (cada moneda que llega suma su parte) */
  private coinSet: ((v: number) => void) | null = null;
  /** monedas de la LIGA (apuesta Ranked ganada) que la card de la liga aún no muestra: bajan al llegar cada moneda */
  private leagueHold = 0;
  /** qué liga muestra la card de la fila del PASE: la de siempre ('1v1') o la LIGA 2V2 (se alterna al tocarla) */
  private leagueMode: '1v1' | '2v2' = '1v1';
  /** pasa el contador de MONEDAS del menú a las MONEDAS 2V2 (true) o a las de la cuenta (false); lo crea coinCounter */
  private coinModeFn: ((m2: boolean) => void) | null = null;
  private leagueObj: Phaser.GameObjects.Container | null = null;
  private leagueRect: { x: number; y: number; w: number; h: number } | null = null;
  private leagueRepaint: (() => void) | null = null;
  private profileRefresh: (() => void) | null = null;
  private passRefresh: (() => void) | null = null;
  private wheelOpenNow() {
    return !!this.registry.get('wheel.open');
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    restartOnResize(this);
    startIntroMusic(this); // música del menú (fx/introMusic.ts): sigue sonando en Personalizar, Tienda, Pase y Ranked
    this.xpGain = (this.registry.get('menu.xpGain') as number | undefined) ?? 0;
    this.registry.remove('menu.xpGain');
    this.masteryGain = (this.registry.get('menu.masteryGain') as MenuScene['masteryGain'] | undefined) ?? null;
    this.registry.remove('menu.masteryGain');
    // premio de una ruleta cobrada ANTES de abrir este menú (viene del final de la partida): la EXP se suma a la presentación de la EXP y las monedas llegan a su card
    const wg = this.registry.get('menu.wheelGain') as { coins: number; xp: number } | undefined;
    this.registry.remove('menu.wheelGain');
    this.wheelGain = wg && (wg.coins > 0 || wg.xp > 0) && !this.wheelOpenNow() ? wg : null;
    this.xpGain += this.wheelGain?.xp ?? 0;
    this.xpAnims = [];
    this.xpAt = [];
    this.pendingCoins = this.wheelGain?.coins ?? 0;
    // (18-11-2026, usuario) monedas que entraron con la(s) partida(s) (MatchEndScene): vuelan al monedero ANTES de la EXP
    this.matchCoins = Math.max(0, (this.registry.get('menu.coinGain') as number | undefined) ?? 0);
    this.registry.remove('menu.coinGain');
    this.coinSet = null;
    // lo que de eso sumó a la LIGA: la card de la liga lo espera (solo si hay monedas que animar)
    this.leagueHold = this.matchCoins > 0 ? Math.max(0, (this.registry.get('menu.leagueGain') as number | undefined) ?? 0) : 0;
    this.registry.remove('menu.leagueGain');
    this.leagueObj = this.leagueRect = this.leagueRepaint = null;
    this.leagueMode = '1v1'; // la card vuelve a tu LIGA al entrar al menú (las monedas de la liga que bajan al terminar un partido van a ella)
    this.coinRect = this.coinRefresh = this.profileRefresh = this.passRefresh = null;
    // la ruleta se cierra con el menú ya abierto: el premio (monedas, EXP) se ve pasar a las cards
    const onWheelClosed = () => this.time.delayedCall(120, () => this.wheelClosed());
    this.game.events.on('wheel-closed', onWheelClosed);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off('wheel-closed', onWheelClosed));
    // SONIDO: clic en cualquier botón del menú (JUGAR suma además su sonido propio al soltar)
    const onTapSfx = () => uiSound(this, 'tap');
    this.input.on(Phaser.Input.Events.GAMEOBJECT_DOWN, onTapSfx);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.off(Phaser.Input.Events.GAMEOBJECT_DOWN, onTapSfx));
    this.cameras.main.fadeIn(250, 0, 0, 0);

    const p = getProfile();
    this.drawBg(W, H);

    const go = (key: string) => {
      this.cameras.main.fadeOut(200, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(key));
    };

    // Anclas fijas (funciona en pantallas muy altas como iPhone 16 Pro Max):
    const navH = this.textures.exists(NAV.key) ? this.navImageHeight(W) : 112; // barra inferior
    const navTop = H - navH;
    // (15-11-2026) JUGAR, ruletas y cofre más abajo, cerca de la barra (antes −130). Va relativo al borde de la barra, así
    // que en cualquier pantalla queda el mismo hueco (~34 px bajo JUGAR, contando su sombra) y nunca la toca.
    const playY = navTop - 96; // botón JUGAR sobre la barra
    const feetY = playY - 175;  // pies del personaje sobre JUGAR

    // --- personaje (pies anclados; se apoya sobre un disco de luz)
    // desplazado a la derecha para no chocar con los botones PERSONAJE y TIENDA
    const px = W / 2 + HERO_SHIFT_X;
    this.add.ellipse(px, feetY, 460, 90, 0x0a1a3a, 0.5);
    // retrato estático si la skin lo tiene; si no, el personaje animado de siempre
    // pantallas bajas (Safari de iPhone con sus barras): el retrato se achica para no meterse bajo el PASE;
    // en pantallas altas (APK) el mínimo no aplica y queda como siempre
    const portrait = addPortrait(this, p.skin as SkinId, px, feetY + 8, Math.min(HERO_H, feetY + 8 - 170));
    if (portrait) {
      applyCharColor(portrait, p.color, p.skin); // tu ESTILO DE COLOR (PERSONALIZACIÓN)
      const b = portrait.getBounds();
      this.hero = { obj: portrait, rect: { x: b.x, y: b.y, w: b.width, h: b.height } };
    } else {
      const hero = new Character(this, px - 10, feetY, playerLook(p.skin), 'front').setScale(4.8);
      this.hero = { obj: hero, rect: { x: px - 10 - 60 * 4.8, y: feetY - 180 * 4.8, w: 120 * 4.8, h: 180 * 4.8 } };
      applyCharColor(hero, p.color, p.skin);
      this.time.addEvent({ delay: 2800, loop: true, callback: () => hero.swing() });
    }

    this.profileBar(W, p);    // botones laterales a media altura, sin chocar con el personaje
    // nunca encima del widget del PASE (termina en PASS_BOTTOM): si no, en pantallas bajas/anchas lo tapan
    // tope de DIARIO/AMIGOS (sobre el panel de ruletas): en pantallas bajas PERSONAJE y TIENDA suben lo justo
    // para que DIARIO no se monte sobre TIENDA (en pantallas altas este tope no aplica)
    // (16-11-2026) bajo DIARIO va la card GLOBAL (mismo tamaño): una fila más (84 + 12) que también se descuenta
    const globalRow = 84 + 12;
    const dailyMaxY = playY - 124 - 52 - 30 - 84 / 2 - globalRow;
    const sideY = Math.max(PASS_BOTTOM + 16 + 68, Math.min(H * 0.4, feetY - 300, dailyMaxY - 84 / 2 - 30 - 136 / 2 - 166));
    this.sideButton(128, sideY + 2, 'PERSONAJE', 'user', false, () => go('Customize')); // (21-11-2026, usuario) 2 px más abajo, más cerca de TIENDA
    this.sideButton(128, sideY + 166, 'TIENDA', 'shop', false, () => go('Shop'));
    // premio diario: bajo TIENDA, mitad de su ancho (214/2); se marca en dorado pero NUNCA se abre solo
    // (sin pisar el panel de ruletas en pantallas bajas)
    const dailyH = 84;
    const dailyGap = 10; // hueco entre DIARIO y AMIGOS
    const dailyW = (214 - dailyGap) / 2; // entre los dos ocupan lo mismo que TIENDA
    // misma separación que PERSONAJE–TIENDA (166 entre centros con 136 de alto = 30 de hueco)
    const gapSide = 166 - 136;
    const dailyY = Math.min(sideY + 166 + 136 / 2 + gapSide + dailyH / 2, dailyMaxY);
    // alineado a la izquierda con TIENDA (su borde izquierdo está en 128 − 214/2)
    dailyLoginButton(this, 128 - 214 / 2 + dailyW / 2, dailyY, (m) => this.toast(m), dailyW, dailyH);
    // AMIGOS: a su derecha, mismo diseño pero bloqueado (la sección aún no existe)
    friendsButton(this, 128 - 214 / 2 + dailyW + dailyGap + dailyW / 2, dailyY, (m) => this.toast(m), dailyW, dailyH);
    // RANKING GLOBAL (saldo de monedas, sin bots): card bajo DIARIO, mismo tamaño (16-11-2026). Desde el menú y no desde LIGA,
    // para no confundirlo con el ranking semanal de la liga
    globalRankingButton(this, 128 - 214 / 2 + dailyW / 2, dailyY + globalRow, dailyW, dailyH);

    // --- JUGAR
    // JUGAR = partida Ranked en tu liga con la apuesta elegida (monto tocable + info). Sin monedas: amistosa gratis
    this.playRow(W, playY, (bet) => {
      uiSound(this, 'play'); // arranque del partido: golpe + whoosh + acorde
      // datos del flujo BOT de siempre: Ranked con la apuesta elegida, o AMISTOSO sin monedas
      const botFlow = bet ? { ranked: { bet }, from: 'Menu' } : { unranked: true, from: 'Menu' };
      // con servidor multijugador configurado: primero se busca un rival real 5 s (LanSearch); sin rival, el BOT
      const lan = serverUrl() !== null;
      this.cameras.main.fadeOut(200, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => (lan ? this.scene.start('LanSearch', { fallback: botFlow }) : this.scene.start('Matchmaking', botFlow)));
    }, () => {
      uiSound(this, 'play');
      this.cameras.main.fadeOut(200, 0, 0, 0);
      // con servidor: primero se busca un COMPAÑERO humano (2 humanos contra 2 bots); sin él, 2v2 contra bots como siempre
      const fb = { unranked: false, from: 'Menu', mode: '2v2' };
      this.cameras.main.once('camerafadeoutcomplete', () => (serverUrl() !== null ? this.scene.start('LanSearch', { mode: '2v2', fallback: fb }) : this.scene.start('Matchmaking', fb)));
    });

    // --- ruletas diarias (encima de JUGAR). Una ruleta recién ganada se abre sola UNA vez.
    const wheelOpened = this.dailyWheels(W, playY);
    // EXP de la partida: "+N EXP" y las barras de nivel y del pase se llenan; con ruleta, DESPUÉS de cerrarla
    // TUTORIAL por nivel (domain/tutorial.ts; solo con el modo desarrollo apagado): DESPUÉS de la ruleta y de la presentación de la EXP
    // (que dura ~6 s), para que el aviso de un nivel recién alcanzado no se pise con ellas
    const tutorial = (delay: number) => this.time.delayedCall(delay, () => maybeShowTutorial(this));
    // (18-11-2026, usuario) PRIMERO las monedas de la partida vuelan al monedero (≤ 1,5 s) y LUEGO la EXP
    if (this.matchCoins > 0) {
      const coinsFirst = (then: () => void) => this.playMatchCoins(this.matchCoins, then);
      const xpAfter = this.xpGain > 0 ? () => (this.playXpGain(), tutorial(6500)) : () => tutorial(500);
      if (wheelOpened) this.time.delayedCall(700, () => whenWheelReady(this, (w) => w.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.time.delayedCall(250, () => coinsFirst(xpAfter)))));
      else this.time.delayedCall(450, () => coinsFirst(xpAfter));
    } else if (this.xpGain > 0) {
      const play = () => {
        this.playXpGain();
        tutorial(6500);
      };
      if (wheelOpened) this.time.delayedCall(700, () => whenWheelReady(this, (w) => w.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.time.delayedCall(250, play))));
      else this.time.delayedCall(550, play);
    } else if (wheelOpened) this.time.delayedCall(700, () => whenWheelReady(this, (w) => w.events.once(Phaser.Scenes.Events.SHUTDOWN, () => tutorial(500))));
    else tutorial(1600); // tras el fundido y la cascada de ruletas

    // monedas de una ruleta cobrada al final de la partida: llegan a su card tras la presentación de la EXP (o enseguida si no hay)
    if (this.pendingCoins > 0 && !wheelOpened) this.time.delayedCall((this.xpGain > 0 ? 550 + 6200 : 900) + (this.matchCoins > 0 ? 1500 : 0), () => {
      const c = this.pendingCoins;
      this.pendingCoins = 0;
      if (c > 0) this.playCoinGain(c);
    });

    if (this.textures.exists(NAV.key)) this.navImage(W, H);
    else this.bottomBar(W, navTop, navH);
    this.riskCard(W, playY);
  }

  /** zonas de los botones JUGAR y 2v2 (playRow): el MODO RIESGO los hace brillar mientras corre */
  private modeRects: { x: number; y: number; w: number; h: number }[] = [];

  /**
   * (18-11-2026, usuario) MODO RIESGO x2 en el menú: card del MISMO tamaño y forma que la del COFRE, en su sitio (sobre RULETAS DIARIAS,
   * borde derecho); si hay cofre, el sitio es suyo y esta card va a su izquierda. Sale siempre salvo si ya se usó esta semana (vuelve el
   * lunes). Etiqueta: "10 MIN" (lo que dura) o la cuenta atrás. TOCARLA abre la explicación; MANTENERLA 3 s lo activa. Mientras corre,
   * JUGAR y 2v2 brillan en rojo/dorado con "x2".
   */
  private riskCard(W: number, playY: number) {
    const w = 150;
    const h = 104;
    const gap = 12;
    const xChest = W - 26 - w / 2;
    const y = playY - 54 - 18 - 52 - 104 - 30; // misma fila que el cofre (dailyWheels)
    const c = this.add.container(xChest, y).setDepth(50).setVisible(false);
    const off = (pts: Phaser.Math.Vector2[], dx: number, dy: number) => pts.map((p) => ({ x: p.x + dx, y: p.y + dy }));
    const g = this.add.graphics();
    const x2 = this.add.text(0, -4, 'x2', { fontFamily: FONT, fontSize: '50px', color: '#ffffff', stroke: '#4a0d00', strokeThickness: 7 }).setOrigin(0.5);
    const name = this.add.text(0, 32, 'RIESGO', { fontFamily: FONT, fontSize: '17px', color: '#ffd23f', stroke: '#2a0a00', strokeThickness: 4 }).setOrigin(0.5).setLetterSpacing(2);
    // ACTIVO: capa naranja brillante con destello que la recorre y borde dorado que late (encima del fondo, debajo del texto)
    const hot = this.add.container(0, 0).setVisible(false);
    const hotG = this.add.graphics();
    hotG.fillStyle(0xff7a00, 1).fillPoints(modeShape(w, h), true);
    hotG.fillStyle(0xffb13b, 1).fillPoints(modeBand(w, h, -h * 0.44, -h * 0.02, 6, 9), true);
    hotG.fillStyle(0xffffff, 0.3).fillPoints(modeBand(w, h, -h * 0.4, -h * 0.28, 12, 4), true);
    const hotMask = this.make.graphics({}, false);
    const hotShine = this.add.rectangle(-w, 0, h * 0.45, h * 1.8, 0xffffff, 0.55).setAngle(20).setBlendMode(Phaser.BlendModes.ADD);
    const hotEdge = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    hotEdge.lineStyle(9, 0xffd23f, 0.55).strokePoints(modeShape(w, h), true, true);
    hotEdge.lineStyle(4, 0xfff3a0, 1).strokePoints(modeShape(w, h), true, true);
    hot.add([hotG, hotShine, hotEdge]);
    const hotTws = [
      this.tweens.add({ targets: hotShine, x: { from: -w * 0.75, to: w * 0.75 }, duration: 900, repeat: -1, repeatDelay: 500, ease: 'Sine.easeInOut', paused: true }),
      this.tweens.add({ targets: hotEdge, alpha: { from: 1, to: 0.35 }, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', paused: true }),
    ];
    const ring = this.add.graphics();
    const tag = this.add.graphics();
    // (18-11-2026, usuario) la etiqueta va centrada (la forma inclinada la hacía verse algo a la izquierda con 0: +8)
    const TAG_X = 8;
    const tagText = this.add.text(TAG_X, -h / 2 - 2, '', { fontFamily: FONT, fontSize: '17px', color: '#ffd23f' }).setOrigin(0.5).setLetterSpacing(1);
    c.add([g, hot, x2, name, ring, tag, tagText]);
    c.setSize(w, h).setInteractive({ useHandCursor: true });
    // el borde se llena desde arriba, justo a la derecha de la etiqueta "10 MIN" (mide ~90 de ancho)
    this.holdPress(c, ring, modeShape(w, h), 0xffd23f, () => this.riskInfo(), () => this.tryActivateRisk(() => paint()), TAG_X + 46, () => riskModeStatus().phase !== 'active');
    const glow = this.riskGlow();
    let shown = '';
    const paint = () => {
      if (!c.active) return;
      const rs = riskModeStatus();
      const active = rs.phase === 'active';
      glow(active);
      const on = active || !riskUsedThisWeek();
      c.setVisible(on);
      if (!on) return;
      // con cofre, su sitio es del cofre: esta card a su izquierda
      c.x = chestStatus(getPlayer() as never, gameClock.now()).kind !== 'none' ? xChest - w - gap : xChest;
      // la máscara del destello sigue a la card (posición en pantalla)
      hotMask.clear().fillStyle(0xffffff).fillPoints(modeShape(w, h).map((p) => ({ x: p.x + c.x, y: p.y + c.y })), true);
      const live = rs.phase !== 'closed';
      tagText.setText(active ? formatRiskLeft(rs.msLeft) : '10 MIN');
      const key = `${live}|${active}|${Math.ceil(tagText.width)}`;
      if (key === shown) return;
      shown = key;
      const col = live ? 0xd8361e : 0x6a4a56;
      g.clear();
      g.fillStyle(active ? 0xffb13b : col, 0.5).fillPoints(off(modeShape(w, h, 4), 6, 9), true);
      g.fillStyle(0x0a1638, 1).fillPoints(modeShape(w, h, 5), true);
      g.fillStyle(live ? 0x3a0d06 : 0x1c1622, 0.97).fillPoints(modeShape(w, h), true);
      g.fillStyle(col, 0.3).fillPoints(modeBand(w, h, -h * 0.44, -h * 0.02, 6, 9), true);
      g.lineStyle(2.5, live ? 0xffd23f : 0x9a7f8a, 0.95).strokePoints(modeShape(w, h), true, true);
      hot.setVisible(active);
      for (const t of hotTws) {
        if (active) t.resume();
        else t.pause();
      }
      x2.setAlpha(live ? 1 : 0.55).setStroke(active ? '#7a2a00' : '#4a0d00', 7);
      name.setColor(active ? '#ffffff' : live ? '#ffd23f' : '#b8a2ac').setStroke(active ? '#7a2a00' : '#2a0a00', 4);
      const tw = Math.max(80, tagText.width + 30);
      tag.clear();
      tag.fillStyle(active ? 0x7a2a00 : 0x0a1638, 1).fillRoundedRect(TAG_X - tw / 2, -h / 2 - 17, tw, 30, 15);
      tag.lineStyle(2, active ? 0xfff3a0 : live ? 0xffd23f : 0x9a7f8a, 1).strokeRoundedRect(TAG_X - tw / 2, -h / 2 - 17, tw, 30, 15);
      tagText.setColor(active ? '#ffffff' : live ? '#ffd23f' : '#b8a2ac');
      if (live) pulse.resume();
      else {
        pulse.pause();
        x2.setScale(1);
      }
    };
    hotShine.setMask(hotMask.createGeometryMask());
    const pulse = this.tweens.add({ targets: x2, scale: { from: 1, to: 1.12 }, duration: 560, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    paint();
    this.time.addEvent({ delay: 250, loop: true, callback: paint }); // cuenta atrás (9:59 → 0:00), fin del evento y cofre abierto
    const offP = onPlayerChange(() => paint());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => offP());
    void syncRiskMode(); // el servidor manda: si cambia la activación, onPlayerChange repinta
  }

  /**
   * Pulsación con dos usos: TOQUE corto → `onTap`; MANTENER `RISK_HOLD_MS` → `onDone` (un anillo se va llenando alrededor de `ring`).
   * Soltar antes de completarlo (tras el toque corto) no hace nada.
   */
  private holdPress(
    target: Phaser.GameObjects.Container,
    ring: Phaser.GameObjects.Graphics,
    r: number | { x: number; y: number }[],
    color: number,
    onTap: () => void,
    onDone: () => void,
    startX = 0,
    canHold: () => boolean = () => true,
  ) {
    let t0 = -1;
    // `r` número = anillo circular (botón del diálogo); lista de puntos = se llena el BORDE de esa forma (card del menú), empezando en el
    // borde de ARRIBA en x = `startX` (justo a la derecha de la etiqueta "10 MIN") y avanzando hacia la derecha
    const poly = Array.isArray(r) ? this.borderFrom(r, startX) : null;
    const lens = poly ? poly.map((p, i) => Phaser.Math.Distance.BetweenPoints(p, poly[(i + 1) % poly.length])) : [];
    const perim = lens.reduce((a, b) => a + b, 0);
    const draw = (f: number) => {
      ring.clear();
      if (f <= 0) return;
      const k = Math.min(1, f);
      if (!poly) {
        ring.lineStyle(9, 0x0a1638, 0.85).strokeCircle(0, 0, r as number);
        ring.lineStyle(6, color, 1).beginPath().arc(0, 0, r as number, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2).strokePath();
        return;
      }
      ring.lineStyle(6, color, 1).beginPath().moveTo(poly[0].x, poly[0].y);
      let left = k * perim;
      for (let i = 0; i < poly.length && left > 0; i++) {
        const a = poly[i];
        const b = poly[(i + 1) % poly.length];
        const t = Math.min(1, left / lens[i]);
        ring.lineTo(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
        left -= lens[i];
      }
      ring.strokePath();
    };
    const tick = () => {
      if (t0 < 0 || !target.active) return;
      const held = this.time.now - t0;
      if (held < RISK_TAP_MS || !canHold()) return; // aún puede ser un toque (o no se puede mantener: ya activo)
      const f = (held - RISK_TAP_MS) / (RISK_HOLD_MS - RISK_TAP_MS);
      if (f >= 1) {
        t0 = -1;
        draw(0);
        target.setScale(1);
        onDone();
        return;
      }
      draw(f);
      target.setScale(1 - 0.06 * f);
    };
    this.events.on(Phaser.Scenes.Events.UPDATE, tick);
    target.once(Phaser.GameObjects.Events.DESTROY, () => this.events.off(Phaser.Scenes.Events.UPDATE, tick));
    target.on('pointerdown', () => (t0 = this.time.now));
    const stop = (tap: boolean) => {
      if (t0 < 0) return;
      const held = this.time.now - t0;
      t0 = -1;
      draw(0);
      this.tweens.add({ targets: target, scale: 1, duration: 160, ease: 'Back.easeOut' });
      if (tap && held < RISK_TAP_MS) onTap();
    };
    target.on('pointerup', () => stop(true));
    target.on('pointerout', () => stop(false));
  }

  /**
   * Contorno (cerrado) reordenado para empezar en el borde de arriba en x = `sx` y recorrerse hacia la derecha (sentido horario en pantalla).
   */
  private borderFrom(pts: { x: number; y: number }[], sx: number): { x: number; y: number }[] {
    const n = pts.length;
    // sentido horario en pantalla (y hacia abajo): área con signo positiva
    let area = 0;
    for (let i = 0; i < n; i++) area += pts[i].x * pts[(i + 1) % n].y - pts[(i + 1) % n].x * pts[i].y;
    const p = area >= 0 ? pts : [...pts].reverse();
    // arista de arriba que cruza x = sx (la de menor y)
    let best = -1;
    let by = Infinity;
    for (let i = 0; i < n; i++) {
      const a = p[i];
      const b = p[(i + 1) % n];
      if (b.x <= a.x || sx < a.x || sx > b.x) continue; // de arriba y hacia la derecha
      const y = a.y + ((b.y - a.y) * (sx - a.x)) / (b.x - a.x);
      if (y < by) {
        by = y;
        best = i;
      }
    }
    if (best < 0) return p;
    const out = [{ x: sx, y: by }];
    for (let k = 1; k <= n; k++) out.push(p[(best + k) % n]);
    return out;
  }

  /** Pide activar el MODO RIESGO (servidor). Hoy no es lunes / ya usado / sin conexión: aviso. `onOk` si se activó. */
  private tryActivateRisk(onOk?: () => void) {
    const rs = riskModeStatus();
    if (rs.phase === 'active') return this.toast(RISK_MSG.active);
    const done = (msg: string) => {
      onOk?.();
      sfx(this, 'power-up');
      this.cameras.main.flash(260, 255, 140, 30);
      this.toast(msg);
    };
    // MODO DESARROLLO: fuera del lunes (o ya usado / sin servidor) se puede PROBAR: 10 min locales, solo visual (no dobla apuestas)
    const devTest = () => {
      devActivateRisk();
      done('(PRUEBA) MODO RIESGO x2: 10 minutos, solo visual');
    };
    if (rs.phase === 'closed') {
      if (isDevMode()) return devTest();
      return this.toast(riskUsedThisWeek() ? RISK_MSG.already_used : RISK_MSG.not_monday);
    }
    void activateRiskMode().then((r) => {
      if (!this.sys.isActive()) return;
      if (!r.ok) return isDevMode() ? devTest() : this.toast(RISK_MSG[r.error]);
      done('¡MODO RIESGO x2 activado por 10 minutos!');
    });
  }

  /**
   * Brillo de JUGAR y 2v2 mientras corre el MODO RIESGO: capa roja/dorada sobre cada botón (sin tapar sus toques), un destello que la
   * recorre y la marca "x2" en la esquina. Devuelve la función que la enciende / apaga.
   */
  private riskGlow(): (on: boolean) => void {
    this.riskGlowOn = false;
    this.buildRiskGlow();
    return (on: boolean) => {
      if (on === this.riskGlowOn) return;
      this.riskGlowOn = on;
      this.applyRiskGlow();
    };
  }

  /** (19-11-2026) capas del brillo del MODO RIESGO (una por botón de modeRects) y si está encendido; se rearman con la fila JUGAR / 2v2 */
  private riskGlowParts: { c: Phaser.GameObjects.Container; tws: Phaser.Tweens.Tween[] }[] = [];
  private riskGlowOn = false;
  private riskGlowBuilt = false;

  private rebuildRiskGlow() {
    if (!this.riskGlowBuilt) return; // aún no existe (la crea la card del MODO RIESGO)
    this.buildRiskGlow();
    this.applyRiskGlow();
  }

  private applyRiskGlow() {
    for (const p of this.riskGlowParts) {
      p.c.setVisible(this.riskGlowOn);
      for (const t of p.tws) {
        if (this.riskGlowOn) t.resume();
        else t.pause();
      }
    }
  }

  private buildRiskGlow() {
    for (const p of this.riskGlowParts) {
      for (const t of p.tws) t.remove();
      if (p.c.active) p.c.destroy();
    }
    this.riskGlowBuilt = true;
    this.riskGlowParts = this.modeRects.map((r) => {
      // (18-11-2026, usuario) encima de la card de RULETAS (profundidad 50): la marca "x2" de la esquina asoma sobre ella
      const c = this.add.container(r.x, r.y).setDepth(55).setVisible(false);
      const g = this.add.graphics();
      g.fillStyle(0xff3b1e, 0.42).fillPoints(modeShape(r.w, r.h), true);
      g.lineStyle(4, 0xffd23f, 1).strokePoints(modeShape(r.w, r.h), true, true);
      g.setBlendMode(Phaser.BlendModes.ADD);
      // destello que recorre el botón (recortado a su forma)
      const maskG = this.make.graphics({ x: r.x, y: r.y }, false);
      maskG.fillStyle(0xffffff).fillPoints(modeShape(r.w, r.h), true);
      const shine = this.add.rectangle(-r.w, 0, r.h * 0.5, r.h * 1.6, 0xffffff, 0.5).setAngle(20).setBlendMode(Phaser.BlendModes.ADD);
      shine.setMask(maskG.createGeometryMask());
      const sweep = this.tweens.add({ targets: shine, x: { from: -r.w * 0.7, to: r.w * 0.7 }, duration: 1100, repeat: -1, repeatDelay: 700, ease: 'Sine.easeInOut', paused: true });
      const badge = this.add.container(r.w / 2 - 22, -r.h / 2 + 4);
      const bg = this.add.graphics();
      bg.fillStyle(0x0a1638, 1).fillCircle(0, 0, 21);
      bg.fillStyle(0xd8361e, 1).fillCircle(0, 0, 18);
      bg.lineStyle(2.5, 0xffd23f, 1).strokeCircle(0, 0, 18);
      badge.add([bg, this.add.text(0, 0, 'x2', { fontFamily: FONT, fontSize: '19px', color: '#ffffff', stroke: '#4a0d00', strokeThickness: 4 }).setOrigin(0.5)]);
      c.add([g, shine, badge]);
      const beat = this.tweens.add({ targets: g, alpha: { from: 1, to: 0.55 }, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', paused: true });
      const bBeat = this.tweens.add({ targets: badge, scale: { from: 1, to: 1.15 }, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', paused: true });
      return { c, tws: [sweep, beat, bBeat] };
    });
  }

  /**
   * Ventana del MODO RIESGO (toque en su card): para qué sirve y un botón grande circular; MANTENERLO 3 s lo activa (JUGAR y 2v2 brillan)
   * y la ventana se cierra. Se cierra tocando fuera o con la X.
   */
  private riskInfo() {
    const W = this.scale.width;
    const H = this.scale.height;
    const root = this.add.container(0, 0).setDepth(8500);
    const dim = this.add.rectangle(0, 0, W, H, 0x000000, 0.7).setOrigin(0).setInteractive();
    const pw = Math.min(540, W - 48);
    const ph = 720;
    const p = this.add.container(W / 2, H / 2);
    const panel = this.add.graphics();
    panel.fillStyle(0xd8361e, 0.35).fillRoundedRect(-pw / 2 + 6, -ph / 2 + 9, pw, ph, 26);
    panel.fillStyle(0x0a1638, 1).fillRoundedRect(-pw / 2 - 4, -ph / 2 - 4, pw + 8, ph + 8, 28);
    panel.fillStyle(0x1a0c18, 1).fillRoundedRect(-pw / 2, -ph / 2, pw, ph, 26);
    panel.fillStyle(0xd8361e, 0.25).fillRoundedRect(-pw / 2 + 6, -ph / 2 + 6, pw - 12, 96, { tl: 22, tr: 22, bl: 8, br: 8 });
    panel.lineStyle(3, 0xffd23f, 1).strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, 26);
    p.add(panel);
    p.add(this.add.text(0, -ph / 2 + 52, 'MODO RIESGO x2', { fontFamily: FONT, fontSize: '38px', color: '#ffd23f', stroke: '#2a0a00', strokeThickness: 7 }).setOrigin(0.5).setLetterSpacing(1));
    const rs = riskModeStatus();
    p.add(
      this.add
        .text(0, -ph / 2 + 112, 'Durante 10 minutos tus partidas de LIGA valen el DOBLE.', { fontFamily: FONT, fontSize: '21px', color: '#ffffff', align: 'center', wordWrap: { width: pw - 64 } })
        .setOrigin(0.5, 0),
    );
    // (18-11-2026, usuario) con TU apuesta: lo que arriesgas ahora y lo que arriesgarías activándolo (entrada y premio de tu liga, sin x2)
    const st = matchStakes(rankedState().league, loadBet());
    const n = (v: number) => v.toLocaleString('es-CL');
    const bx = pw - 56;
    const boxY = -ph / 2 + 176;
    const box = this.add.graphics();
    box.fillStyle(0x0a1638, 0.9).fillRoundedRect(-bx / 2, boxY, bx, 128, 16);
    box.lineStyle(2, 0x2c3d66, 1).strokeRoundedRect(-bx / 2, boxY, bx, 128, 16);
    box.fillStyle(0xd8361e, 0.3).fillRoundedRect(-bx / 2 + 6, boxY + 66, bx - 12, 56, 12);
    box.lineStyle(2, 0xffd23f, 1).strokeRoundedRect(-bx / 2 + 6, boxY + 66, bx - 12, 56, 12);
    p.add(box);
    const row = (y: number, head: string, txt: string, col: string, size: number) => {
      p.add(this.add.text(-bx / 2 + 22, y, head, { fontFamily: FONT, fontSize: '17px', color: '#9fb3d9' }).setOrigin(0, 0.5).setLetterSpacing(1));
      const t = this.add.text(bx / 2 - 20, y, txt, { fontFamily: FONT, fontSize: `${size}px`, color: col, stroke: '#0a1638', strokeThickness: 4 }).setOrigin(1, 0.5);
      if (t.width > bx - 130) t.setScale((bx - 130) / t.width);
      p.add(t);
    };
    row(boxY + 33, 'AHORA', `apuestas ${n(st.entry)} · ganas ${n(st.prize)}`, '#ffffff', 21);
    row(boxY + 94, 'CON x2', `arriesgas ${n(st.entry * 2)} · ganas ${n(st.prize * 2)}`, '#ffd23f', 23);
    p.add(
      this.add
        .text(0, boxY + 146, 'Si pierdes, pierdes el doble. Solo los lunes, una vez por semana; el tiempo corre aunque cierres el juego.', {
          fontFamily: FONT,
          fontSize: '17px',
          color: '#c9b8c0',
          align: 'center',
          wordWrap: { width: pw - 64 },
        })
        .setOrigin(0.5, 0),
    );
    // botón circular grande: mantener 3 s
    const by = ph / 2 - 190;
    const R = 96; // (18-11-2026, usuario) círculo más grande (antes 78)
    const live = rs.phase === 'available';
    // (18-11-2026, usuario) ya ACTIVO: el círculo se ve como la card del menú activa (naranja brillante, borde dorado que late, destello)
    // y muestra el tiempo que queda; no se puede volver a activar
    const active = rs.phase === 'active';
    const btn = this.add.container(0, by);
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.4).fillCircle(4, 8, R);
    bg.fillStyle(active ? 0xffb13b : 0x0a1638, active ? 0.5 : 1).fillCircle(0, 0, R + 10);
    bg.fillStyle(0x0a1638, 1).fillCircle(0, 0, R + 6);
    bg.fillStyle(active ? 0xff7a00 : live ? 0xd8361e : 0x5a3a46, 1).fillCircle(0, 0, R);
    if (active) bg.fillStyle(0xffb13b, 1).fillCircle(0, -R * 0.12, R * 0.82);
    bg.fillStyle(0xffffff, active ? 0.3 : live ? 0.22 : 0.08).fillEllipse(0, -R * 0.45, R * 1.3, R * 0.6);
    bg.lineStyle(3, active ? 0xfff3a0 : live ? 0xffd23f : 0x9a7f8a, 1).strokeCircle(0, 0, R);
    const bt = this.add.text(0, -8, 'x2', { fontFamily: FONT, fontSize: '72px', color: '#ffffff', stroke: active ? '#7a2a00' : '#4a0d00', strokeThickness: 9 }).setOrigin(0.5);
    const bs = this.add
      .text(0, 46, active ? formatRiskLeft(rs.msLeft) : 'MANTÉN 3 s', { fontFamily: FONT, fontSize: active ? '24px' : '18px', color: active ? '#ffffff' : '#ffd23f', stroke: active ? '#7a2a00' : '#2a0a00', strokeThickness: 4 })
      .setOrigin(0.5)
      .setLetterSpacing(1);
    const ring = this.add.graphics();
    btn.add([bg, bt, bs, ring]);
    if (active) {
      // borde dorado que late y destello que cruza el círculo
      const edge = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
      edge.lineStyle(10, 0xffd23f, 0.55).strokeCircle(0, 0, R);
      edge.lineStyle(4, 0xfff3a0, 1).strokeCircle(0, 0, R);
      const mask = this.make.graphics({}, false);
      const shine = this.add.rectangle(-R * 2, 0, R * 0.45, R * 2.4, 0xffffff, 0.5).setAngle(20).setBlendMode(Phaser.BlendModes.ADD);
      btn.addAt(shine, 1);
      btn.add(edge);
      this.tweens.add({ targets: edge, alpha: { from: 1, to: 0.35 }, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: shine, x: { from: -R * 1.2, to: R * 1.2 }, duration: 900, repeat: -1, repeatDelay: 500, ease: 'Sine.easeInOut' });
      // la máscara (en pantalla) sigue al círculo mientras el panel entra con su escala
      const fitMask = () => {
        if (!btn.active) return;
        const m = btn.getWorldTransformMatrix();
        mask.clear().fillStyle(0xffffff).fillCircle(m.tx, m.ty, R * m.scaleX);
      };
      shine.setMask(mask.createGeometryMask());
      fitMask();
      // cuenta atrás en vivo
      const tick = this.time.addEvent({
        delay: 250,
        loop: true,
        callback: () => {
          if (!btn.active) return void tick.remove();
          fitMask();
          const now = riskModeStatus();
          bs.setText(now.phase === 'active' ? formatRiskLeft(now.msLeft) : '0:00');
        },
      });
    }
    btn.setSize(R * 2, R * 2).setInteractive({ useHandCursor: true });
    p.add(btn);
    if (live || active) this.tweens.add({ targets: bt, scale: { from: 1, to: 1.1 }, duration: 560, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const status = active ? 'ACTIVO: tus partidas de LIGA valen x2' : rs.phase === 'available' ? 'Disponible HOY' : riskUsedThisWeek() ? 'Ya lo usaste esta semana' : 'Disponible el lunes';
    p.add(this.add.text(0, by + R + 34, status, { fontFamily: FONT, fontSize: '19px', color: active ? '#ffb13b' : live ? '#7dffa8' : '#b8a2ac' }).setOrigin(0.5));
    const close = () => {
      if (!root.active) return;
      this.tweens.add({ targets: root, alpha: 0, duration: 160, onComplete: () => root.destroy() });
    };
    const x = this.add.text(pw / 2 - 30, -ph / 2 + 30, '✕', { fontFamily: FONT, fontSize: '30px', color: '#ffffff' }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    x.on('pointerup', close);
    p.add(x);
    dim.on('pointerup', close);
    // ya ACTIVO: el botón solo muestra el tiempo (no se puede volver a activar)
    if (active) btn.on('pointerup', () => this.toast(RISK_MSG.active));
    else this.holdPress(btn, ring, R + 10, 0xffd23f, () => this.toast('Mantén presionado 3 segundos'), () => this.tryActivateRisk(close));
    root.add([dim, p]);
    root.setAlpha(0);
    p.setScale(0.85);
    this.tweens.add({ targets: root, alpha: 1, duration: 180 });
    this.tweens.add({ targets: p, scale: 1, duration: 260, ease: 'Back.easeOut' });
  }

  // ---------------------------------------------------------------- barra inferior (imagen)
  /** Alto que ocupa la barra-imagen (contenido visible + margen inferior) para un ancho W. */
  private navImageHeight(W: number) {
    const { x0, y0, x1, y1 } = NAV.box;
    return ((W - NAV.side * 2) / (x1 - x0)) * (y1 - y0) + NAV.bottom;
  }

  /**
   * Barra LIGA · INICIO · EVENTOS como imagen: ocupa todo el ancho (responsivo, se escala
   * con el ancho de la pantalla) y se apoya abajo. Cada tercio tiene su zona táctil.
   */
  private navImage(W: number, H: number) {
    const { x0, y0, x1, y1 } = NAV.box;
    const s = (W - NAV.side * 2) / (x1 - x0);
    const bottom = H - NAV.bottom;
    const top = bottom - (y1 - y0) * s;
    // origen = esquina inferior izquierda del contenido visible (la imagen trae margen transparente)
    this.add.image(NAV.side, bottom, NAV.key).setOrigin(x0 / NAV.w, y1 / NAV.h).setScale(s).setDepth(100);
    // pestaña LIGA (antes "RANKING" dentro de la imagen)
    navLigaLabel(this, (ox, oy) => ({ x: NAV.side + (ox - x0) * s, y: bottom + (oy - y1) * s }), s, false, 447);

    const zone = (from: number, to: number, onClick: () => void) => {
      const zx = NAV.side + (W - NAV.side * 2) * from;
      const zw = (W - NAV.side * 2) * (to - from);
      const hit = this.add.rectangle(zx + zw / 2, (top + bottom) / 2, zw, bottom - top + 16, 0x000000, 0.001).setDepth(102);
      hit.setInteractive({ useHandCursor: true }).on('pointerdown', onClick);
    };
    zone(0, NAV.split[0], () => this.openRanked());
    zone(NAV.split[0], NAV.split[1], () => undefined); // INICIO (activa)
    zone(NAV.split[1], 1, () => this.toast('Eventos: próximamente'));
  }

  // ---------------------------------------------------------------- Ranked
  /** RANKING: abre el modo Ranked (desde nivel RANK_UNLOCK_LEVEL); antes, la lista informativa de ligas. */
  private openRanked() {
    syncRanked();
    const p = getProfile();
    if (!rankedState().unlocked) {
      showRankList(this, { current: myLeague(), level: p.level });
      return;
    }
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Ranked'));
  }

  // ---------------------------------------------------------------- ruletas diarias
  /** "+N EXP" sobre las cards de arriba y animación de sus barras (EXP de la partida recién terminada). */
  private playXpGain() {
    if (!this.sys.isActive()) return;
    // PRESENTACIÓN de la EXP ganada (el sonido recolectar-exp trae 3 "pings"): la pantalla se oscurece, las cards de NIVEL y
    // PASE quedan encendidas encima, el total ganado se ve grande en el centro y sale en 3 oleadas de orbes hacia las dos
    // cards; el total va bajando a medida que sale (se ve que "se suma") y cada llegada hace latir la card, suelta un
    // "+n" y la barra sube. Ajustar WAVE_MS si los pings del audio no caen justo en cada llegada.
    const W = this.scale.width;
    const H = this.scale.height;
    // (21-11-2026) con MAESTRÍA ganada: 2 oleadas de EXP (barras de nivel y pase) y la 3.ª es la maestría, que vuela al personaje y lo
    // ilumina como una subida de nivel. Los 3 sonidos siguen igual (uno por oleada)
    const mastery = this.masteryGain && this.hero && passiveOf(this.masteryGain.skin) ? this.masteryGain : null;
    // (18-11-2026, usuario) la EXP sale en 2 oleadas (200 → queda 100 → sale el resto, sin mostrar "+0") y, si la hay, la maestría.
    // 3 sonidos en total: al aparecer el total, en la 1.ª oleada y en la maestría (sin maestría: en la 2.ª oleada)
    const XP_WAVES = 2;
    const WAVES_ALL = mastery ? 3 : 2;
    const WAVE_MS = 650; // entre oleadas
    const MASTERY_AFTER_MS = 300; // la maestría, tras la última oleada de EXP
    const FLY_MS = 520; // vuelo de cada EXP
    const PER_WAVE = 5; // orbes por tarjeta y oleada
    const src = { x: W / 2, y: H * 0.46 };
    // (21-11-2026) en NIVEL MÁXIMO la cuenta ya no gana EXP: solo la recibe el pase
    const cards = this.xpAt.filter((c) => c.kind === 'pass' || getPlayer().level < MAX_LEVEL);
    const gain = this.xpGain;
    const share = (w: number) => (w < XP_WAVES - 1 ? Math.floor(gain / XP_WAVES) : gain - Math.floor(gain / XP_WAVES) * (XP_WAVES - 1));
    // (14-11-2026) el sonido suena UNA VEZ POR OLEADA (3 veces), cuando cada oleada sale hacia las cards (ver el bucle)

    // pantalla oscura; las cards de nivel y pase suben por encima para que resalten
    const dim = this.add.rectangle(0, 0, W, H, 0x02060f, 0).setOrigin(0).setDepth(190);
    this.tweens.add({ targets: dim, fillAlpha: 0.6, duration: 280 });
    const lifted: { obj?: { depth: number; setDepth: (d: number) => unknown }; prev: number }[] = cards.map((c) => {
      const prev = c.obj?.depth ?? 0;
      c.obj?.setDepth(195);
      return { obj: c.obj, prev };
    });
    // con maestría, el personaje también queda encendido sobre el oscurecido
    if (mastery && this.hero) {
      const o = this.hero.obj;
      lifted.push({ obj: o, prev: o.depth });
      o.setDepth(195);
    }

    // total ganado, grande y con aura; baja con cada oleada
    const glow = this.add.circle(src.x, src.y, 150, 0x7ff0ff, 0.22).setBlendMode(Phaser.BlendModes.ADD).setDepth(200).setScale(0.2);
    this.tweens.add({ targets: glow, scale: 1, duration: 420, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: glow, alpha: { from: 0.22, to: 0.1 }, duration: 600, yoyo: true, repeat: -1 });
    const label = this.add.text(src.x, src.y - 62, 'EXP GANADA', { fontFamily: FONT, fontSize: '26px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 6 }).setOrigin(0.5).setDepth(201).setLetterSpacing(3).setAlpha(0);
    const total = this.add.text(src.x, src.y, `+${gain}`, { fontFamily: FONT, fontSize: '96px', color: '#7ff0ff', stroke: '#0a1638', strokeThickness: 12 }).setOrigin(0.5).setDepth(201).setScale(0.3);
    this.tweens.add({ targets: label, alpha: 1, duration: 250 });
    this.tweens.add({ targets: total, scale: 1, duration: 420, ease: 'Back.easeOut' });
    sfx(this, 'recolectar-exp'); // 1.er sonido: aparece el total
    // anillos que salen del total al aparecer
    for (let k = 0; k < 2; k++) {
      const ring = this.add.circle(src.x, src.y, 60, 0x7ff0ff, 0).setStrokeStyle(6, 0x7ff0ff, 0.9).setDepth(200).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: ring, scale: 4, alpha: 0, duration: 700, delay: k * 220, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    }

    let remaining = gain;
    const arrivalsTotal = XP_WAVES * cards.length + (mastery ? 1 : 0);
    let arrivals = 0;
    for (let w = 0; w < WAVES_ALL; w++) {
      // las oleadas empiezan cuando el total ya se leyó. (18-11-2026, usuario: "la maestría tarda en salir") la MAESTRÍA sale justo cuando se va
      // lo último de la EXP (300 ms después de esa oleada), no una oleada entera más tarde: los 3 tiempos quedan seguidos y parejos
      const t0 = mastery && w >= XP_WAVES ? 650 + (XP_WAVES - 1) * WAVE_MS + MASTERY_AFTER_MS : 650 + w * WAVE_MS;
      if (mastery && w >= XP_WAVES) {
        // 3.ª oleada: la MAESTRÍA va al personaje
        this.time.delayedCall(t0, () => {
          if (!this.sys.isActive()) return;
          sfx(this, 'recolectar-exp');
          this.masteryWave(mastery, src, total, label, glow, () => {
            arrivals++;
            if (arrivals === arrivalsTotal) this.time.delayedCall(250, () => finish());
          });
        });
        continue;
      }
      const part = share(w);
      // sale la parte de esta oleada: el total baja
      this.time.delayedCall(t0, () => {
        if (!this.sys.isActive()) return;
        // sonido: 1.ª oleada siempre; la 2.ª solo sin maestría (con maestría, el 3.º sonido es el de la maestría)
        if (w === 0 || !mastery) sfx(this, 'recolectar-exp');
        remaining = Math.max(0, remaining - part);
        if (remaining > 0) {
          total.setText(`+${remaining}`);
          this.tweens.add({ targets: total, scale: { from: 1.18, to: 1 }, duration: 260, ease: 'Back.easeOut' });
        } else {
          // sale lo último: el total se va (sin "+0"); la maestría lo vuelve a encender con su "+1"
          this.tweens.add({ targets: total, scale: 0.3, alpha: 0, duration: 220, ease: 'Quad.easeIn' });
        }
      });
      cards.forEach((p) => {
        const r = p.rect;
        for (let o = 0; o < PER_WAVE; o++) {
          this.time.delayedCall(t0 + o * 55, () => {
            if (!this.sys.isActive()) return;
            const orb = this.add.container(src.x + Phaser.Math.Between(-50, 50), src.y + Phaser.Math.Between(-20, 20)).setDepth(202);
            const g = this.add.graphics();
            g.fillStyle(0x7ff0ff, 0.3).fillCircle(0, 0, 30);
            g.fillStyle(0x0a1638, 1).fillCircle(0, 0, 19);
            g.fillStyle(0x1f7bff, 1).fillCircle(0, 0, 16.5);
            g.fillStyle(0x7ff0ff, 1).fillCircle(0, -3, 10);
            const tx = this.add.text(0, 0, 'EXP', { fontFamily: FONT, fontSize: '12px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 3 }).setOrigin(0.5);
            orb.add([g, tx]).setScale(0.4);
            const sx = orb.x;
            const sy = orb.y;
            // destino: la barra de la card (con un poco de dispersión)
            const dx = p.x + Phaser.Math.Between(-18, 18);
            const dy = p.y + Phaser.Math.Between(-6, 6);
            const arc = Phaser.Math.Between(60, 140);
            const side = (dx < src.x ? -1 : 1) * Phaser.Math.Between(20, 50);
            const k = { v: 0 };
            this.tweens.add({ targets: orb, scale: 1.2, duration: 150 });
            this.tweens.add({
              targets: k,
              v: 1,
              duration: FLY_MS,
              ease: 'Sine.easeIn',
              onUpdate: () => {
                orb.setPosition(sx + (dx - sx) * k.v + Math.sin(k.v * Math.PI) * side, sy + (dy - sy) * k.v - Math.sin(k.v * Math.PI) * arc);
                // estela corta detrás del orbe
                if (Math.random() < 0.5) {
                  const tr = this.add.circle(orb.x, orb.y, 6, 0x7ff0ff, 0.6).setDepth(201).setBlendMode(Phaser.BlendModes.ADD);
                  this.tweens.add({ targets: tr, alpha: 0, scale: 0.2, duration: 260, onComplete: () => tr.destroy() });
                }
              },
              onComplete: () => {
                orb.destroy();
                const spark = this.add.circle(dx, dy, 8, 0xffffff, 0.9).setDepth(203).setBlendMode(Phaser.BlendModes.ADD);
                this.tweens.add({ targets: spark, scale: 3.4, alpha: 0, duration: 300, onComplete: () => spark.destroy() });
                // al cerrar la última orbe de cada oleada: la card late y suelta lo que recibió
                if (o === PER_WAVE - 1) {
                  const flash = this.add.graphics().setDepth(196).setBlendMode(Phaser.BlendModes.ADD);
                  flash.fillStyle(0x7ff0ff, 0.45).fillRoundedRect(r.x, r.y, r.w, r.h, 18);
                  this.tweens.add({ targets: flash, alpha: 0, duration: 420, onComplete: () => flash.destroy() });
                  const ring = this.add.graphics().setDepth(196).setBlendMode(Phaser.BlendModes.ADD);
                  ring.lineStyle(5, 0x7ff0ff, 0.95).strokeRoundedRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4, 20);
                  this.tweens.add({ targets: ring, alpha: 0, duration: 520, onComplete: () => ring.destroy() });
                  const add = this.add.text(dx, p.y - 8, `+${part}`, { fontFamily: FONT, fontSize: '34px', color: '#7ff0ff', stroke: '#0a1638', strokeThickness: 7 }).setOrigin(0.5).setDepth(204).setScale(0.4);
                  this.tweens.add({ targets: add, scale: 1, duration: 220, ease: 'Back.easeOut' });
                  this.tweens.add({ targets: add, y: p.y - 46, alpha: 0, delay: 380, duration: 520, onComplete: () => add.destroy() });
                  arrivals++;
                  // última llegada: el resumen "+N EXP" queda sobre cada card un momento y todo se apaga
                  if (arrivals === arrivalsTotal) this.time.delayedCall(250, () => finish());
                }
              },
            });
          });
        }
      });
    }
    // fin: se va el total, la pantalla se aclara y las cards vuelven a su sitio
    const finish = () => {
      if (!this.sys.isActive()) return;
      this.tweens.add({ targets: [total, label, glow], alpha: 0, duration: 350, onComplete: () => [total, label, glow].forEach((o) => o.destroy()) });
      cards.forEach((p) => {
        const sum = this.add.text(p.x, p.y, `+${gain} EXP`, { fontFamily: FONT, fontSize: '30px', color: '#7ff0ff', stroke: '#0a1638', strokeThickness: 7 }).setOrigin(0.5).setDepth(204).setScale(0.4);
        this.tweens.add({ targets: sum, scale: 1, duration: 300, ease: 'Back.easeOut' });
        this.tweens.add({ targets: sum, y: p.y - 28, alpha: 0, delay: 1400, duration: 450, onComplete: () => sum.destroy() });
      });
      this.tweens.add({ targets: dim, fillAlpha: 0, delay: 1100, duration: 500, onComplete: () => {
        dim.destroy();
        lifted.forEach((l) => l.obj?.setDepth(l.prev));
      } });
    };
    // las barras empiezan a llenarse con la primera llegada y siguen mientras entran las oleadas
    const anims = this.xpAnims;
    this.xpAnims = [];
    anims.forEach((f, i) => this.time.delayedCall(650 + FLY_MS + PER_WAVE * 55 + i * 120, f));
  }


  /**
   * (21-11-2026) La RULETA se cerró con el menú ya abierto: lo que ganó se ve pasar a sus cards. EXP → barras del pase y de la cuenta (no la de
   * la cuenta si está en nivel máximo, mismo recorrido que la EXP de una partida: playXpGain); monedas → card de monedas (playCoinGain).
   * Cualquier otro premio (dinero, cosmético, cofre) no cambia nada aquí.
   */
  private wheelClosed() {
    if (!this.sys.isActive() || this.wheelOpenNow()) return;
    const g = this.registry.get('menu.wheelGain') as { coins: number; xp: number } | undefined;
    this.registry.remove('menu.wheelGain');
    const coins = (g?.coins ?? 0) + this.pendingCoins;
    this.pendingCoins = 0;
    const xp = g?.xp ?? 0;
    // nada que mostrar con orbes: los contadores se ponen al día sin más (por si el premio fue otro)
    if (xp <= 0) {
      this.profileRefresh?.();
      this.passRefresh?.();
    }
    let wait = 250;
    if (xp > 0) {
      this.xpGain = xp;
      this.xpAnims = [];
      if (getPlayer().level < MAX_LEVEL && this.profileRefresh) this.xpAnims.push(this.profileRefresh);
      if (this.passRefresh) this.xpAnims.push(this.passRefresh);
      this.time.delayedCall(wait, () => this.playXpGain());
      wait += 6200; // lo que dura la presentación de la EXP
    }
    if (coins > 0) this.time.delayedCall(wait, () => this.playCoinGain(coins));
    else this.coinRefresh?.();
  }

  /**
   * (18-11-2026, usuario) Monedas ganadas en la partida (apuesta, partida y misiones): el total sale en el centro y varias monedas
   * (más cuanto más ganaste) vuelan al MONEDERO de arriba; cada una suma su parte al saldo. Dura ≤ 1,5 s y luego `then` (la EXP).
   */
  private playMatchCoins(amount: number, then: () => void) {
    this.matchCoins = 0;
    const card = this.coinObj;
    const rect = this.coinRect;
    const set = this.coinSet;
    if (!this.sys.isActive() || !card || !rect || !set || amount <= 0) {
      this.coinRefresh?.();
      then();
      return;
    }
    const TOTAL_MS = 1500;
    const FLY = 560;
    const N = Phaser.Math.Clamp(Math.round(4 + amount / 15), 4, 16);
    const gap = Math.min(50, 560 / N);
    const W = this.scale.width;
    const src = { x: W / 2, y: this.scale.height * 0.46 };
    const base = getPlayer().coins - amount - this.pendingCoins; // lo que muestra el monedero antes de que lleguen
    set(base);
    const prevDepth = card.depth;
    card.setDepth(195);
    const glow = this.add.circle(src.x, src.y, 110, 0xffd23f, 0.22).setBlendMode(Phaser.BlendModes.ADD).setDepth(200).setScale(0.2);
    const total = this.add.text(src.x, src.y, `+${amount.toLocaleString('es-CL')}`, { fontFamily: FONT, fontSize: '72px', color: '#ffd23f', stroke: '#0a1638', strokeThickness: 10 }).setOrigin(0.5).setDepth(201).setScale(0.3);
    // (18-11-2026, usuario) la cifra lleva al lado el icono de MONEDAS (monedas.webp), el par centrado; las monedas salen del icono
    const ICON = 92;
    const icon = this.textures.exists('daily-coins-art') ? this.add.image(0, src.y, 'daily-coins-art').setDepth(201) : null;
    fitText(total, W - 60 - (icon ? ICON + 12 : 0));
    const ts = total.scale;
    if (icon) {
      const is = Math.min(ICON / icon.width, ICON / icon.height);
      const pairW = total.width * ts + 12 + ICON;
      total.setX(src.x - pairW / 2 + (total.width * ts) / 2);
      icon.setX(src.x + pairW / 2 - ICON / 2).setScale(is * 0.3);
      this.tweens.add({ targets: icon, scale: is, duration: 300, delay: 60, ease: 'Back.easeOut' });
    }
    total.setScale(ts * 0.3);
    this.tweens.add({ targets: glow, scale: 1, duration: 300, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: total, scale: ts, duration: 260, ease: 'Back.easeOut' });
    sfx(this, 'recolectar-monedas');
    const dx = rect.x + rect.w * 0.3;
    const dy = rect.y + rect.h / 2;
    let arrived = 0;
    for (let o = 0; o < N; o++) {
      this.time.delayedCall(180 + o * gap, () => {
        if (!this.sys.isActive()) return;
        const coin = this.textures.exists('coin-1') ? this.add.image(0, 0, 'coin-1').setDisplaySize(34, 34) : this.add.circle(0, 0, 15, 0xffd23f).setStrokeStyle(3, 0x7a4a00);
        const orb = this.add.container((icon ? icon.x : src.x) + Phaser.Math.Between(-36, 36), src.y + Phaser.Math.Between(-16, 16), [coin]).setDepth(202).setScale(0.5);
        const sx = orb.x;
        const sy = orb.y;
        const arc = Phaser.Math.Between(50, 120);
        const side = (dx < src.x ? -1 : 1) * Phaser.Math.Between(20, 60);
        const k = { v: 0 };
        this.tweens.add({ targets: orb, scale: 1, duration: 140 });
        this.tweens.add({
          targets: k,
          v: 1,
          duration: FLY,
          ease: 'Sine.easeIn',
          onUpdate: () => {
            orb.setPosition(sx + (dx - sx) * k.v + Math.sin(k.v * Math.PI) * side, sy + (dy - sy) * k.v - Math.sin(k.v * Math.PI) * arc);
            orb.setAngle(k.v * 360);
          },
          onComplete: () => {
            orb.destroy();
            arrived++;
            set(base + Math.round((amount * arrived) / N));
            const spark = this.add.circle(dx, dy, 7, 0xffffff, 0.9).setDepth(203).setBlendMode(Phaser.BlendModes.ADD);
            this.tweens.add({ targets: spark, scale: 3, alpha: 0, duration: 260, onComplete: () => spark.destroy() });
            this.tweens.add({ targets: card, scale: { from: 1.08, to: 1 }, duration: 140 });
            if (arrived === N) {
              const flash = this.add.graphics().setDepth(196).setBlendMode(Phaser.BlendModes.ADD);
              flash.fillStyle(0xffd23f, 0.45).fillRoundedRect(rect.x, rect.y, rect.w, rect.h, rect.h / 2);
              this.tweens.add({ targets: flash, alpha: 0, duration: 420, onComplete: () => flash.destroy() });
              const outs = [total, glow, ...(icon ? [icon] : [])];
              this.tweens.add({ targets: outs, alpha: 0, duration: 200, onComplete: () => outs.forEach((x) => x.destroy()) });
            }
          },
        });
      });
    }
    // (18-11-2026, usuario) lo que también sumó a la LIGA (apuesta Ranked ganada): otras monedas, a la vez, vuelan a su card
    const lg = this.leagueHold;
    const lc = this.leagueObj;
    const lr = this.leagueRect;
    const NL = Math.min(10, N);
    let lArrived = 0;
    if (lg > 0 && lc && lr && this.leagueRepaint) {
      const lPrev = lc.depth;
      lc.setDepth(195);
      const ldx = lr.x + lr.w * 0.55;
      const ldy = lr.y + lr.h * 0.7;
      for (let o = 0; o < NL; o++) {
        this.time.delayedCall(180 + gap / 2 + o * Math.min(55, 560 / NL), () => {
          if (!this.sys.isActive()) return;
          const coin = this.textures.exists('coin-1') ? this.add.image(0, 0, 'coin-1').setDisplaySize(30, 30) : this.add.circle(0, 0, 13, 0xffd23f).setStrokeStyle(3, 0x7a4a00);
          const orb = this.add.container(src.x + Phaser.Math.Between(-50, 50), src.y + Phaser.Math.Between(-16, 16), [coin]).setDepth(202).setScale(0.5);
          const sx = orb.x;
          const sy = orb.y;
          const arc = Phaser.Math.Between(50, 120);
          const side = (ldx < src.x ? -1 : 1) * Phaser.Math.Between(20, 60);
          const k = { v: 0 };
          this.tweens.add({ targets: orb, scale: 1, duration: 140 });
          this.tweens.add({
            targets: k,
            v: 1,
            duration: FLY,
            ease: 'Sine.easeIn',
            onUpdate: () => {
              orb.setPosition(sx + (ldx - sx) * k.v + Math.sin(k.v * Math.PI) * side, sy + (ldy - sy) * k.v - Math.sin(k.v * Math.PI) * arc);
              orb.setAngle(-k.v * 360);
            },
            onComplete: () => {
              orb.destroy();
              lArrived++;
              this.leagueHold = lg - Math.round((lg * lArrived) / NL);
              this.leagueRepaint?.();
              const spark = this.add.circle(ldx, ldy, 7, 0xffffff, 0.9).setDepth(203).setBlendMode(Phaser.BlendModes.ADD);
              this.tweens.add({ targets: spark, scale: 3, alpha: 0, duration: 260, onComplete: () => spark.destroy() });
              if (lArrived === NL) {
                const flash = this.add.graphics().setDepth(196).setBlendMode(Phaser.BlendModes.ADD);
                flash.fillStyle(0xffc24a, 0.4).fillRoundedRect(lr.x, lr.y, lr.w, lr.h, 20);
                this.tweens.add({ targets: flash, alpha: 0, duration: 420, onComplete: () => flash.destroy() });
                const add = this.add.text(ldx, lr.y - 6, `+${lg.toLocaleString('es-CL')}`, { fontFamily: FONT, fontSize: '28px', color: '#ffc24a', stroke: '#0a1638', strokeThickness: 6 }).setOrigin(0.5).setDepth(204).setScale(0.4);
                this.tweens.add({ targets: add, scale: 1, duration: 200, ease: 'Back.easeOut' });
                this.tweens.add({ targets: add, y: lr.y - 36, alpha: 0, delay: 500, duration: 450, onComplete: () => add.destroy() });
              }
            },
          });
        });
      }
      this.time.delayedCall(TOTAL_MS, () => lc.active && lc.setDepth(lPrev));
    }
    // fin fijo a los 1,5 s (aunque alguna moneda se atrase): la EXP no espera más
    this.time.delayedCall(TOTAL_MS, () => {
      if (!this.sys.isActive()) return;
      card.setDepth(prevDepth);
      if (arrived < N) set(base + amount);
      if (this.leagueHold > 0) {
        this.leagueHold = 0;
        this.leagueRepaint?.();
      }
      this.time.delayedCall(600, () => this.coinSet && (this.coinObj?.getData('text') as Phaser.GameObjects.Text | undefined)?.setColor('#ffffff'));
      then();
    });
  }

  /** (21-11-2026) Las MONEDAS que dio la ruleta salen del centro y llegan a la card de monedas, que sube su saldo con un destello. */
  private playCoinGain(amount: number) {
    const card = this.coinObj;
    const rect = this.coinRect;
    if (!this.sys.isActive() || !card || !rect || this.wheelOpenNow()) {
      this.coinRefresh?.();
      return;
    }
    const W = this.scale.width;
    const H = this.scale.height;
    const src = { x: W / 2, y: H * 0.46 };
    const dim = this.add.rectangle(0, 0, W, H, 0x02060f, 0).setOrigin(0).setDepth(190);
    this.tweens.add({ targets: dim, fillAlpha: 0.6, duration: 280 });
    const prevDepth = card.depth;
    card.setDepth(195);
    const glow = this.add.circle(src.x, src.y, 150, 0xffd23f, 0.22).setBlendMode(Phaser.BlendModes.ADD).setDepth(200).setScale(0.2);
    this.tweens.add({ targets: glow, scale: 1, duration: 420, ease: 'Cubic.easeOut' });
    const label = this.add.text(src.x, src.y - 62, 'MONEDAS GANADAS', { fontFamily: FONT, fontSize: '26px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 6 }).setOrigin(0.5).setDepth(201).setLetterSpacing(3).setAlpha(0);
    const total = this.add.text(src.x, src.y, `+${amount.toLocaleString('es-CL')}`, { fontFamily: FONT, fontSize: '96px', color: '#ffd23f', stroke: '#0a1638', strokeThickness: 12 }).setOrigin(0.5).setDepth(201).setScale(0.3);
    // (18-11-2026, usuario) la cifra lleva al lado el icono de MONEDAS (monedas.webp); el par queda centrado
    const ICON = 104;
    const hasIcon = this.textures.exists('daily-coins-art');
    fitText(total, W - 60 - (hasIcon ? ICON + 14 : 0));
    const fs = total.scale;
    total.setScale(0.3);
    const icon = hasIcon ? this.add.image(0, src.y, 'daily-coins-art').setDepth(201) : null;
    if (icon) {
      icon.setScale(Math.min(ICON / icon.width, ICON / icon.height));
      const pairW = total.width * fs + 14 + ICON;
      total.setX(src.x - pairW / 2 + (total.width * fs) / 2);
      icon.setX(src.x + pairW / 2 - ICON / 2);
      const is = icon.scale;
      icon.setScale(is * 0.3);
      this.tweens.add({ targets: icon, scale: is, duration: 420, delay: 80, ease: 'Back.easeOut' });
    }
    this.tweens.add({ targets: label, alpha: 1, duration: 250 });
    this.tweens.add({ targets: total, scale: fs, duration: 420, ease: 'Back.easeOut' });
    sfx(this, 'recolectar-monedas');
    const dx = rect.x + rect.w * 0.3;
    const dy = rect.y + rect.h / 2;
    const N = 10;
    let arrived = 0;
    for (let o = 0; o < N; o++) {
      this.time.delayedCall(700 + o * 70, () => {
        if (!this.sys.isActive()) return;
        const coin = this.textures.exists('coin-1') ? this.add.image(0, 0, 'coin-1').setDisplaySize(38, 38) : this.add.circle(0, 0, 17, 0xffd23f).setStrokeStyle(3, 0x7a4a00);
        // las monedas salen del icono de monedas (si lo hay) y van al monedero
        const ox = icon ? icon.x : src.x;
        const orb = this.add.container(ox + Phaser.Math.Between(-40, 40), src.y + Phaser.Math.Between(-20, 20), [coin]).setDepth(202).setScale(0.4);
        const sx = orb.x;
        const sy = orb.y;
        const arc = Phaser.Math.Between(60, 140);
        const side = (dx < src.x ? -1 : 1) * Phaser.Math.Between(20, 60);
        const k = { v: 0 };
        this.tweens.add({ targets: orb, scale: 1.1, duration: 150 });
        this.tweens.add({
          targets: k,
          v: 1,
          duration: 560,
          ease: 'Sine.easeIn',
          onUpdate: () => orb.setPosition(sx + (dx - sx) * k.v + Math.sin(k.v * Math.PI) * side, sy + (dy - sy) * k.v - Math.sin(k.v * Math.PI) * arc),
          onComplete: () => {
            orb.destroy();
            const spark = this.add.circle(dx, dy, 8, 0xffffff, 0.9).setDepth(203).setBlendMode(Phaser.BlendModes.ADD);
            this.tweens.add({ targets: spark, scale: 3.2, alpha: 0, duration: 300, onComplete: () => spark.destroy() });
            this.tweens.add({ targets: card, scale: { from: 1.08, to: 1 }, duration: 160 });
            if (++arrived === N) {
              // llegó la última: el saldo sube con la card encendida y se apaga todo
              this.coinRefresh?.();
              const flash = this.add.graphics().setDepth(196).setBlendMode(Phaser.BlendModes.ADD);
              flash.fillStyle(0xffd23f, 0.45).fillRoundedRect(rect.x, rect.y, rect.w, rect.h, rect.h / 2);
              this.tweens.add({ targets: flash, alpha: 0, duration: 520, onComplete: () => flash.destroy() });
              const add = this.add.text(dx + 30, rect.y - 6, `+${amount.toLocaleString('es-CL')}`, { fontFamily: FONT, fontSize: '34px', color: '#ffd23f', stroke: '#0a1638', strokeThickness: 7 }).setOrigin(0.5).setDepth(204).setScale(0.4);
              this.tweens.add({ targets: add, scale: 1, duration: 220, ease: 'Back.easeOut' });
              this.tweens.add({ targets: add, y: rect.y - 44, alpha: 0, delay: 600, duration: 520, onComplete: () => add.destroy() });
              const outs = [total, label, glow, ...(icon ? [icon] : [])];
              this.tweens.add({ targets: outs, alpha: 0, duration: 350, onComplete: () => outs.forEach((x) => x.destroy()) });
              this.tweens.add({
                targets: dim,
                fillAlpha: 0,
                delay: 700,
                duration: 450,
                onComplete: () => {
                  dim.destroy();
                  card.setDepth(prevDepth);
                },
              });
            }
          },
        });
      });
    }
    // los orbes arrancan cuando el total ya se leyó: se va bajando el número a medida que salen
    this.time.delayedCall(700, () => this.tweens.add({ targets: total, scale: { from: 1.15, to: 1 }, duration: 300, ease: 'Back.easeOut' }));
  }

  /**
   * 3.ª oleada de la presentación con MAESTRÍA ganada: el total del centro pasa a "+1 MAESTRÍA" (color de la pasiva del personaje), salen
   * orbes con el icono de la pasiva hacia el personaje y, al llegar, el personaje se ilumina como una subida de nivel. `done` al terminar.
   */
  private masteryWave(
    m: { skin: string; before: number; after: number },
    src: { x: number; y: number },
    total: Phaser.GameObjects.Text,
    label: Phaser.GameObjects.Text,
    glow: Phaser.GameObjects.Arc,
    done: () => void,
  ) {
    const def = passiveOf(m.skin);
    const hero = this.hero;
    if (!def || !hero) return done();
    const css = '#' + def.color.toString(16).padStart(6, '0');
    // el centro cambia: de la EXP a la maestría
    label.setText('MAESTRÍA');
    // (16-11-2026, usuario) el texto de la maestría en BLANCO brillante (resplandor del color de la pasiva)
    total.setText('+1').setColor('#ffffff').setShadow(0, 0, css, 14, true, true);
    glow.setFillStyle(def.color, 0.22);
    this.tweens.killTweensOf(total);
    total.setAlpha(1);
    this.tweens.add({ targets: total, scale: { from: 1.3, to: 1 }, duration: 300, ease: 'Back.easeOut' });
    const r = hero.rect;
    const dst = { x: r.x + r.w / 2, y: r.y + r.h * 0.42 };
    const N = 5;
    const FLY = 560;
    for (let o = 0; o < N; o++) {
      this.time.delayedCall(o * 60, () => {
        if (!this.sys.isActive()) return;
        const orb = this.add.container(src.x + Phaser.Math.Between(-50, 50), src.y + Phaser.Math.Between(-20, 20)).setDepth(202);
        const g = this.add.graphics();
        g.fillStyle(def.color, 0.3).fillCircle(0, 0, 30);
        g.fillStyle(0x0a1638, 1).fillCircle(0, 0, 19);
        orb.add(g);
        const ic = this.add.graphics();
        drawPassiveIcon(ic, def.id, 13, def.color);
        orb.add(ic);
        orb.setScale(0.4);
        const sx = orb.x;
        const sy = orb.y;
        const dx = dst.x + Phaser.Math.Between(-40, 40);
        const dy = dst.y + Phaser.Math.Between(-60, 60);
        const arc = Phaser.Math.Between(80, 160);
        const side = (o % 2 ? -1 : 1) * Phaser.Math.Between(40, 90);
        const k = { v: 0 };
        this.tweens.add({ targets: orb, scale: 1.2, duration: 150 });
        this.tweens.add({
          targets: k,
          v: 1,
          duration: FLY,
          ease: 'Sine.easeIn',
          onUpdate: () => {
            orb.setPosition(sx + (dx - sx) * k.v + Math.sin(k.v * Math.PI) * side, sy + (dy - sy) * k.v - Math.sin(k.v * Math.PI) * arc);
            if (Math.random() < 0.5) {
              const tr = this.add.circle(orb.x, orb.y, 6, def.color, 0.6).setDepth(201).setBlendMode(Phaser.BlendModes.ADD);
              this.tweens.add({ targets: tr, alpha: 0, scale: 0.2, duration: 260, onComplete: () => tr.destroy() });
            }
          },
          onComplete: () => {
            orb.destroy();
            const spark = this.add.circle(dx, dy, 8, 0xffffff, 0.9).setDepth(203).setBlendMode(Phaser.BlendModes.ADD);
            this.tweens.add({ targets: spark, scale: 3.4, alpha: 0, duration: 300, onComplete: () => spark.destroy() });
            if (o === N - 1) {
              this.heroLevelUp(m, def.color, def.name);
              done();
            }
          },
        });
      });
    }
  }

  /** El personaje se ilumina como una SUBIDA DE NIVEL (destello de su silueta, halo, anillo, chispas) y sale el texto de la maestría. */
  private heroLevelUp(m: { skin: string; before: number; after: number }, color: number, passiveName: string) {
    const hero = this.hero;
    if (!hero || !this.sys.isActive()) return;
    const r = hero.rect;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h * 0.5;
    const D = 205;
    sfx(this, 'power-up'); // MAESTRÍA ganada (también si sube su nivel)
    const up = masteryLevel(m.after) > masteryLevel(m.before);
    const Y = up ? 0xffe14d : color;
    // silueta encendida: copia del retrato pintada de blanco (tinte, sin preFX) que destella y se apaga
    if (hero.obj instanceof Phaser.GameObjects.Image) {
      const src = hero.obj;
      const lit = this.add.image(src.x, src.y, src.texture.key).setOrigin(src.originX, src.originY).setScale(src.scaleX, src.scaleY).setFlipX(src.flipX).setDepth(196).setTintFill(0xffffff).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
      this.tweens.add({ targets: lit, alpha: { from: 0.85, to: 0 }, duration: 260, yoyo: false, repeat: 2, onComplete: () => lit.destroy() });
      const base = { sx: src.scaleX, sy: src.scaleY };
      this.tweens.add({ targets: src, scaleX: base.sx * 1.05, scaleY: base.sy * 1.05, duration: 160, yoyo: true, ease: 'Quad.easeOut' });
    }
    // halo y anillo del color (dorado si sube de nivel)
    const halo = this.add.ellipse(cx, cy, r.w * 1.1, r.h * 1.05, Y, 0.35).setBlendMode(Phaser.BlendModes.ADD).setDepth(194).setScale(0.6);
    this.tweens.add({ targets: halo, scale: 1.15, alpha: 0, duration: 900, ease: 'Cubic.easeOut', onComplete: () => halo.destroy() });
    const ring = this.add.ellipse(cx, r.y + r.h * 0.97, r.w * 0.7, 60, Y, 0).setStrokeStyle(6, Y, 0.95).setBlendMode(Phaser.BlendModes.ADD).setDepth(196);
    this.tweens.add({ targets: ring, scale: 2, alpha: 0, duration: 760, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    // chispas que suben por el cuerpo
    for (let i = 0; i < 18; i++) {
      const px = r.x + r.w * (0.2 + Math.random() * 0.6);
      const py = r.y + r.h * (0.35 + Math.random() * 0.6);
      const st = this.add.star(px, py, 4, 3, 9, i % 2 ? Y : 0xffffff).setDepth(D + 2).setBlendMode(Phaser.BlendModes.ADD).setScale(0.4);
      this.tweens.add({ targets: st, y: py - Phaser.Math.Between(60, 160), x: px + Phaser.Math.Between(-20, 20), scale: 1.1, alpha: 0, angle: 160, duration: Phaser.Math.Between(600, 1000), delay: Phaser.Math.Between(0, 260), ease: 'Cubic.easeOut', onComplete: () => st.destroy() });
    }
    // texto sobre el personaje: "+1 MAESTRÍA" o, si sube, "¡AGILIDAD NIVEL n!"
    const css = '#' + Y.toString(16).padStart(6, '0');
    const t = this.add
      .text(cx, r.y + r.h * 0.12, up ? `¡${passiveName} NIVEL ${masteryLevel(m.after)}!` : '+1 MAESTRÍA', { fontFamily: FONT, fontSize: '34px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 8 })
      .setShadow(0, 0, css, 16, true, true) // (16-11-2026, usuario) blanco brillante
      .setOrigin(0.5)
      .setDepth(D + 3);
    fitText(t, this.scale.width - 40);
    const s1 = t.scale;
    t.setScale(s1 * 0.3);
    this.tweens.add({ targets: t, scale: s1, duration: 380, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, y: t.y - 30, delay: 1500, duration: 450, onComplete: () => t.destroy() });
    if (up) sfx(this, 'equipar');
    // (18-11-2026, usuario) la barra va SOBRE la cabeza del personaje (antes le tapaba la cara), sin meterse bajo el PASE
    this.masteryBar(m, color, passiveName, cx, Math.max(PASS_BOTTOM + 30, r.y - 70), D + 3); // (18-11-2026) más arriba: seguía sobre la cabeza
  }

  /**
   * (18-11-2026, usuario) Barra de MAESTRÍA bajo el texto: se llena de lo que tenía a lo que tiene ahora. Si sube de nivel se llena
   * entera, destella dorada y vuelve a empezar con el nivel nuevo. Muestra "PASIVA NV n" y "puntos / necesarios".
   */
  private masteryBar(m: { before: number; after: number }, color: number, passiveName: string, cx: number, y: number, depth: number) {
    const w = Math.min(340, this.scale.width - 80);
    const h = 34; // (18-11-2026, usuario) más alta (antes 24)
    const p0 = masteryProgress(m.before);
    const p1 = masteryProgress(m.after);
    const box = this.add.container(cx, y).setDepth(depth).setAlpha(0);
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.45).fillRoundedRect(-w / 2 + 3, 4, w, h, h / 2);
    bg.fillStyle(0x0a1638, 1).fillRoundedRect(-w / 2 - 4, -4, w + 8, h + 8, (h + 8) / 2);
    bg.fillStyle(0x1b2a4e, 1).fillRoundedRect(-w / 2, 0, w, h, h / 2);
    const fill = this.add.graphics();
    const shine = this.add.graphics();
    shine.fillStyle(0xffffff, 0.18).fillRoundedRect(-w / 2 + 4, 3, w - 8, h * 0.38, { tl: 9, tr: 9, bl: 3, br: 3 });
    const name = this.add.text(-w / 2 + 4, -20, '', { fontFamily: FONT, fontSize: '20px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 5 }).setOrigin(0, 0.5);
    const nums = this.add.text(0, h / 2, '', { fontFamily: FONT, fontSize: '21px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 4 }).setOrigin(0.5);
    box.add([bg, fill, shine, name, nums]);
    const paint = (frac: number, col: number) => {
      fill.clear();
      const fw = Math.max(0, Math.min(1, frac)) * w;
      if (fw < 2) return;
      fill.fillStyle(col, 1).fillRoundedRect(-w / 2, 0, Math.max(fw, h), h, h / 2);
    };
    const label = (p: ReturnType<typeof masteryProgress>, into: number) => {
      name.setText(`${passiveName.toUpperCase()}  NV ${p.level}`);
      nums.setText(p.max ? 'MÁX' : `${Math.round(into)} / ${p.need}`);
    };
    label(p0, p0.into);
    paint(p0.frac, color);
    this.tweens.add({ targets: box, alpha: 1, duration: 220 });
    const grow = (p: ReturnType<typeof masteryProgress>, fromInto: number, toInto: number, delay: number, onDone?: () => void) => {
      const k = { v: fromInto };
      this.tweens.add({
        targets: k,
        v: toInto,
        delay,
        duration: 650,
        ease: 'Cubic.easeOut',
        onUpdate: () => {
          label(p, k.v);
          paint(p.need > 0 ? k.v / p.need : 1, color);
        },
        onComplete: onDone,
      });
    };
    if (p1.level > p0.level) {
      // sube de nivel: se llena entera, destello dorado y empieza el nivel nuevo
      grow(p0, p0.into, p0.need, 250, () => {
        if (!box.scene) return;
        paint(1, 0xffe14d);
        const fl = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
        fl.fillStyle(0xffffff, 0.8).fillRoundedRect(-w / 2, 0, w, h, h / 2);
        box.add(fl);
        this.tweens.add({ targets: fl, alpha: 0, duration: 380, onComplete: () => fl.destroy() });
        this.tweens.add({ targets: box, scale: { from: 1.08, to: 1 }, duration: 300, ease: 'Back.easeOut' });
        label(p1, 0);
        if (p1.max) return paint(1, 0xffe14d);
        this.time.delayedCall(380, () => box.scene && (paint(0, color), grow(p1, 0, p1.into, 0)));
      });
    } else grow(p1, p0.into, p1.into, 250);
    this.tweens.add({ targets: box, alpha: 0, delay: 2600, duration: 450, onComplete: () => box.destroy() });
  }

  /** Devuelve true si se abrió sola una ruleta recién ganada. */
  private dailyWheels(W: number, playY: number): boolean {
    syncWheels();
    // mismo ancho que la fila JUGAR + 2v2 (márgenes 26) y su misma forma inclinada
    const w = W - 52;
    // primera vez en el menú (viene del CARGANDO): la cascada de ruletas espera al fundido; después, sin espera
    const fromLoading = !this.registry.get('menu.entered');
    this.registry.set('menu.entered', true);
    // COFRE EVOLUTIVO (15-11-2026): card pequeña con la forma de RULETAS DIARIAS, justo encima a la derecha (ui/ChestButton.ts)
    // solo si hay cofre (ganado en la ruleta); borde derecho alineado con el de la card de ruletas
    const cw = 150;
    const makeChest = () => chestButton(this, W - 26 - cw / 2, playY - 54 - 18 - 52 - 104 - 30, (m) => this.toast(m), cw, 104);
    let chestCard = makeChest();
    // recién ganado en la ruleta (se abre encima del menú): la card aparece sin reiniciar el menú
    const offChest = onPlayerChange((s) => {
      if (s.chest && !chestCard?.active) chestCard = makeChest();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => offChest());
    new DailyWheels(this, W / 2, playY - 54 - 18 - 52, w, {
      onOpen: (i) => openWheel(this, i),
      onToast: (m) => this.toast(m),
      fromLoading,
      onTest: () => {
        const i = grantTestSpin();
        if (i >= 0) openWheel(this, i, { bonus: true, test: true });
      },
    });
    const auto = wheelToPresent();
    if (auto >= 0) {
      markWheelPresented(auto); // antes de abrir: no se repite aunque se cierre o se reinicie el menú
      this.time.delayedCall(650, () => openWheel(this, auto));
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- fila JUGAR + 2v2
  /**
   * Fila de modos: JUGAR (≈70 %, amarillo, principal) y 2v2 (≈30 %, gris, bloqueado).
   * Ambos comparten la misma forma inclinada del botón JUGAR original, dibujada por código.
   */
  private playRow(W: number, y: number, onPlay: (bet: number | null) => void, onDoubles: () => void) {
    this.playRowArgs = { W, y, onPlay, onDoubles };
    this.layoutPlayRow();
  }

  /** datos de la fila JUGAR / 2v2 (para rearmarla al cambiar la liga elegida en la card) y sus objetos */
  private playRowArgs: { W: number; y: number; onPlay: (bet: number | null) => void; onDoubles: () => void } | null = null;
  private playRowObjs: Phaser.GameObjects.GameObject[] = [];

  /**
   * (19-11-2026, usuario) La fila depende de la LIGA elegida en la card de la derecha del PASE (`leagueMode`):
   *  - LIGA (1v1, al entrar al menú): JUGAR GRANDE a la izquierda con la apuesta (moneda, x1) y la (i), como siempre; "2v2" chico a la derecha, solo el texto.
   *  - LIGA 2V2: "1v1" chico a la izquierda, solo el texto (sin moneda ni x1); 2v2 GRANDE a la derecha con su apuesta en monedas 2v2.
   * Tocar el botón chico elige esa liga (como tocar la card): el botón crece con su apuesta y desde ahí se juega.
   */
  private layoutPlayRow() {
    const a = this.playRowArgs;
    if (!a) return;
    for (const o of this.playRowObjs) if (o.active) o.destroy();
    const before = new Set(this.children.list);
    const { W, y, onPlay } = a;
    const margin = 26;
    const gap = 14;
    const h = 108;
    const avail = W - margin * 2 - gap;
    const two = this.leagueMode === '2v2';
    const lw = Math.round(avail * (two ? 0.3 : 0.7)); // izquierda: 1v1 (grande en LIGA, chico en LIGA 2V2)
    const rw = avail - lw; // derecha: 2v2
    const lx = margin + lw / 2;
    const rx = margin + lw + gap + rw / 2;
    this.modeRects = [
      { x: lx, y, w: lw, h },
      { x: rx, y, w: rw, h },
    ];
    const dev = isDevMode();
    if (two) {
      // 1v1 chico: solo el texto; elige la LIGA de siempre
      arcadeButton(this, lx, y, lw, h, '1v1', () => this.setLeagueMode('1v1'), { palette: 'yellow' });
      // 2v2 grande: con la apuesta en MONEDAS 2V2 (x1 / x2); tocarlo abre el diálogo INVITAR AMIGO / JUGAR
      this.doublesBtn = doublesPlayButton(this, rx, y, rw, h, () => this.openDoublesMenu(), !dev);
    } else {
      // JUGAR grande: la partida de Liga con su apuesta (monto tocable + info). Modo desarrollo apagado: sin entrada
      if (dev) rankedPlayButton(this, lx, y, lw, h, onPlay);
      else arcadeButton(this, lx, y, lw, h, 'JUGAR', () => onPlay(null), { palette: 'yellow' });
      // 2v2 chico: solo el texto; elige la LIGA 2V2
      // (21-11-2026, usuario) un solo toque: cambia a la LIGA 2V2 (el botón se agranda) Y abre ya el diálogo (antes hacían falta dos toques)
      arcadeButton(this, rx, y, rw, h, '2v2', () => {
        this.setLeagueMode('2v2');
        this.openDoublesMenu();
      }, { palette: 'purple' });
    }
    this.playRowObjs = this.children.list.filter((o) => !before.has(o));
    this.rebuildRiskGlow(); // el brillo del MODO RIESGO sigue a los botones nuevos
  }

  /** el botón 2v2 grande de la fila (en LIGA 2V2): su píldora de apuesta se repinta cuando la apuesta cambia desde el diálogo */
  private doublesBtn: Phaser.GameObjects.Container | null = null;

  /** Diálogo del 2v2 (INVITAR AMIGO / JUGAR 2V2 con la apuesta en monedas 2v2). Lo abren el botón 2v2 grande y, de un solo toque, el 2v2 chico. */
  private openDoublesMenu() {
    const a = this.playRowArgs;
    if (!a) return;
    openDoublesDialog(this, {
      plain: !isDevMode(),
      onPlay: a.onDoubles,
      onInvite: () => openFriendsDialog(this, (m) => this.toast(m)),
      onChange: () => (this.doublesBtn?.getData('redraw') as (() => void) | undefined)?.(),
    });
  }

  /** (19-11-2026) Elige la liga de la card (LIGA / LIGA 2V2): repinta la card, el contador de monedas de arriba y la fila JUGAR / 2v2. */
  private setLeagueMode(m: '1v1' | '2v2') {
    if (this.leagueMode === m) return;
    this.leagueMode = m;
    this.leagueRepaint?.();
    this.coinModeFn?.(m === '2v2'); // el contador de monedas de arriba pasa a las MONEDAS 2V2 (y vuelve)
    this.layoutPlayRow();
  }

  // ---------------------------------------------------------------- fondo
  private drawBg(W: number, H: number) {
    // un poco más grande y anclado abajo: sube la cancha para que el personaje pise el suelo
    const bg = this.add.image(W / 2, H, 'menu-bg').setOrigin(0.5, 1);
    const s = Math.max(W / bg.width, H / bg.height) * BG_ZOOM;
    bg.setScale(s).setScrollFactor(0);
    // oscurecido sutil para que resalte la UI
    this.add.rectangle(0, 0, W, H, 0x04122e, 0.25).setOrigin(0);
  }

  // ---------------------------------------------------------------- barra de perfil
  private profileBar(W: number, p: ReturnType<typeof getProfile>) {
    const y = 58;
    // monedas doradas + dinero (billetes). Decorativos.
    // ajustes (engranaje) a la derecha del todo, alineado con los dos contadores
    const gs = 100; // lado del botón (16-11-2026: 86 → 100, a la altura de la columna de contadores)
    const gx = W - 22 - gs / 2;
    const gy = y + PROFILE_H / 2; // centro vertical de la columna de contadores (alto del perfil)
    // el perfil ocupa el espacio libre hasta los contadores (132 = ancho de un contador)
    const countersLeft = gx - gs / 2 - 10 - COUNTER_W;
    this.profileCard(24, y, Math.min(440, countersLeft - 24 - 14), p);
    // justo bajo el perfil y con su mismo ancho
    const passY = y + PROFILE_H + 12;
    this.passWidget(24, passY, Math.min(380, Math.min(440, countersLeft - 24 - 14)));
    // MONEDAS DE LA LIGA (neto de la semana): en la fila del PASE, a la derecha, del borde de los contadores al del botón de ajustes
    // (21-11-2026; antes eran la 1.ª fila de la columna de contadores)
    this.leagueCoins(countersLeft, gx + gs / 2, passY, 76);
    // columna de 2 filas en el alto de la card del perfil: monedas de la cuenta · dinero virtual. A su derecha, ajustes.
    this.coinCounter(gx - gs / 2 - 10, y + COUNTER_TOP);
    // dinero (billetes): saldo real, en vivo; al tocarlo lleva a la Tienda
    const cash = this.counter(gx - gs / 2 - 10, y + COUNTER_TOP + COUNTER_STEP, 'cash', getPlayer().gems.toLocaleString('es-CL'));
    const cashTxt = cash.getData('text') as Phaser.GameObjects.Text;
    const offCash = onPlayerChange((s) => {
      cashTxt.setText(s.gems.toLocaleString('es-CL'));
      fitText(cashTxt, COUNTER_TEXT_W);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => offCash());
    cash.setSize(COUNTER_W, COUNTER_H).setInteractive(new Phaser.Geom.Rectangle(0, 0, COUNTER_W, COUNTER_H), Phaser.Geom.Rectangle.Contains);
    cash.on('pointerup', () => this.scene.start('Shop'));
    this.gearButton(gx, gy, gs, () => showSettings(this));
  }

  /** PASE DE BATALLA terminado (fin de mes): bloqueado con candado hasta que llegue otro. */
  private passWidgetLocked(x: number, y: number, w: number) {
    const h = 76;
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.35).fillRoundedRect(3, 6, w, h, 20);
    g.fillStyle(0x3a4256, 1).fillRoundedRect(0, 0, w, h, 20);
    g.fillStyle(0x4c556c, 1).fillRoundedRect(0, 0, w, h * 0.55, { tl: 20, tr: 20, bl: 8, br: 8 });
    g.lineStyle(3, 0x1c2232, 1).strokeRoundedRect(0, 0, w, h, 20);
    // candado
    const lx = 10 + 43;
    g.fillStyle(0x1c2232, 1).fillCircle(lx, h / 2, 29);
    g.lineStyle(4, 0xc8d2ea, 1).beginPath().arc(lx, h / 2 - 6, 9, Math.PI, 0).strokePath();
    g.lineBetween(lx - 9, h / 2 - 6, lx - 9, h / 2).lineBetween(lx + 9, h / 2 - 6, lx + 9, h / 2);
    g.fillStyle(0xc8d2ea, 1).fillRoundedRect(lx - 13, h / 2, 26, 18, 5);
    c.add(g);
    const tx = lx + 43 + 10;
    const tw = w - tx - 16;
    const title = this.add.text(tx, 14, 'PASE DE BATALLA', { fontFamily: FONT, fontSize: '23px', color: '#c8d2ea', stroke: '#1c2232', strokeThickness: 5 }).setOrigin(0, 0);
    fitText(title, tw);
    c.add(title);
    const sub = this.add.text(tx, 46, 'TERMINADO · PRÓXIMO PASE PRONTO', { fontFamily: FONT, fontSize: '14px', color: '#9aa6c2' }).setOrigin(0, 0).setLetterSpacing(1);
    fitText(sub, tw);
    c.add(sub);
    const hit = this.add.rectangle(0, 0, w, h, 0x000000, 0.001).setOrigin(0).setInteractive({ useHandCursor: true });
    c.add(hit);
    hit.on('pointerup', () => this.toast('El Pase de Batalla terminó. Pronto llega uno nuevo'));
  }

  /** Acceso al PASE DE BATALLA: nivel del pase, barra de progreso y aviso de premios por reclamar. */
  private passWidget(x: number, y: number, w: number) {
    if (bpSeasonInfo().over) return this.passWidgetLocked(x, y, w);
    const s = syncSeason(getPlayer() as PlayerState);
    const { level } = bpLevel(s.bp.xp);
    // (16-11-2026) la bienvenida (fila XP) no cuenta hasta jugar la primera partida (BattlePassScene la bloquea)
    const welcomeLocked = !(totalPlayed() > 0 || s.bp.xp > 0);
    const ready = bpClaimable(s) - (welcomeLocked ? (s.bp.welcomeFreeClaimed ? 0 : 1) + (s.bp.premium && !s.bp.welcomePremClaimed ? 1 : 0) : 0);
    const h = 76;
    const c = this.add.container(x, y);
    // (21-11-2026, usuario) sin el halo dorado que latía alrededor del botón
    const g = this.add.graphics();
    // cuerpo DORADO brillante (capas: base ámbar, mitad alta oro, reflejo claro) + doble borde
    g.fillStyle(0x000000, 0.35).fillRoundedRect(3, 6, w, h, 20);
    g.fillStyle(0xe58a00, 1).fillRoundedRect(0, 0, w, h, 20);
    g.fillStyle(0xffc42e, 1).fillRoundedRect(0, 0, w, h * 0.62, { tl: 20, tr: 20, bl: 8, br: 8 });
    g.fillStyle(0xffe680, 1).fillRoundedRect(4, 3, w - 8, h * 0.3, { tl: 17, tr: 17, bl: 6, br: 6 });
    g.fillStyle(0xffffff, 0.45).fillRoundedRect(14, 5, w - 28, 6, 3);
    g.lineStyle(3, 0x7a4a00, 1).strokeRoundedRect(0, 0, w, h, 20);
    g.lineStyle(2, 0xfff1b8, 0.9).strokeRoundedRect(3, 3, w - 6, h - 6, 17);
    // insignia (corona + nivel del pase): disco azul noche con corona dorada
    const bx0 = 10 + 43;
    c.add(g);
    // (21-11-2026, usuario) la insignia del nivel es el MISMO escudo dorado con corona de la pantalla del PASE (assets/insignia-pase-batalla.webp),
    // con "NIV" y el nivel encima, como allí
    const BH = 68;
    if (this.textures.exists('battle-pass-insignia')) c.add(this.add.image(bx0, h / 2 + 1, 'battle-pass-insignia').setDisplaySize((BH * 240) / 287, BH));
    c.add(this.add.text(bx0, h / 2 - 5, 'NIV', { fontFamily: FONT, fontSize: '9px', color: '#0a1638', stroke: '#fff0a8', strokeThickness: 2 }).setOrigin(0.5));
    const lvNum = this.add.text(bx0, h / 2 + 9, String(level), { fontFamily: FONT, fontSize: '21px', color: '#0a1638', stroke: '#fff0a8', strokeThickness: 3 }).setOrigin(0.5);
    c.add(lvNum);
    // chevron que empuja hacia la derecha
    const chev = this.add.graphics({ x: w - 22, y: h / 2 });
    chev.lineStyle(5, 0x5a3200, 1).beginPath().moveTo(-5, -10).lineTo(5, 0).lineTo(-5, 10).strokePath();
    c.add(chev);
    this.tweens.add({ targets: chev, x: w - 16, duration: 420, yoyo: true, repeat: -1, repeatDelay: 500, ease: 'Sine.easeInOut' });
    // textos + barra alineados con los del perfil
    const tx = bx0 + 43 + 10;
    const tw = w - tx - 40;
    const title = this.add.text(tx, 12, 'PASE DE BATALLA', { fontFamily: FONT, fontSize: '23px', color: '#ffffff', stroke: '#7a4a00', strokeThickness: 5 }).setOrigin(0, 0);
    fitText(title, tw);
    c.add(title);
    const sub = this.add.text(tx, 40, '', { fontFamily: FONT, fontSize: '14px', color: '#5a3200' }).setOrigin(0, 0).setLetterSpacing(1);
    c.add(sub);
    const by = 58;
    const bar = this.add.graphics();
    c.add(bar);
    // dibuja nivel, texto y barra para una EXP del pase dada (se anima al volver de una partida)
    let shownBpLevel = -1; // nivel del pase a la vista: si sube durante la animación, efecto de SUBIDA DE NIVEL
    const drawBp = (xp: number) => {
      const b = bpLevel(xp);
      const dn = b.level >= BP_TIERS;
      if (shownBpLevel >= 0 && b.level > shownBpLevel) {
        this.levelUpFx({ x, y, w, h }, 20, `PASE NIVEL ${b.level}`);
        this.tweens.add({ targets: lvNum, scale: { from: 1.8, to: 1 }, duration: 480, ease: 'Back.easeOut' });
      }
      shownBpLevel = b.level;
      lvNum.setText(String(b.level));
      sub.setText(dn ? 'COMPLETADO' : `NIVEL ${b.level + 1} DE ${BP_TIERS}`);
      bar.clear();
      bar.fillStyle(0x5a3200, 1).fillRoundedRect(tx, by, tw, 10, 5).lineStyle(1, 0x7a4a00, 1).strokeRoundedRect(tx, by, tw, 10, 5);
      const fw = Math.max(10, tw * (dn ? 1 : b.progress));
      bar.fillStyle(0xffffff, 1).fillRoundedRect(tx, by, fw, 10, 5);
      bar.fillStyle(0xfff1b8, 1).fillRoundedRect(tx, by + 5, fw, 5, { tl: 0, tr: 0, bl: 5, br: 5 });
    };
    // EXP del pase: desde lo último que se mostró (sobrevive a cambiar de escena), como la barra de nivel
    const BP_KEY = 'bp.xpShown';
    const bpNow = s.bp.xp;
    const bpPrev = this.registry.get(BP_KEY) as number | undefined;
    this.registry.set(BP_KEY, bpNow);
    if (bpPrev !== undefined && bpPrev < bpNow) {
      drawBp(bpPrev);
      const run = () => {
        const o = { v: bpPrev };
        this.tweens.add({ targets: o, v: bpNow, duration: 900, ease: 'Cubic.easeOut', onUpdate: () => drawBp(o.v), onComplete: () => drawBp(bpNow) });
      };
      if (this.xpGain > 0) this.xpAnims.push(run);
      else this.time.delayedCall(400, run);
    } else drawBp(bpNow);
    // (21-11-2026) la EXP de una ruleta llega a la barra del pase (la llama wheelClosed al llegar los orbes)
    let bpShown = bpNow;
    this.passRefresh = () => {
      const to = syncSeason(getPlayer() as PlayerState).bp.xp;
      if (to <= bpShown) return;
      const o = { v: bpShown };
      bpShown = to;
      this.registry.set(BP_KEY, to);
      this.tweens.add({ targets: o, v: to, duration: 900, ease: 'Cubic.easeOut', onUpdate: () => drawBp(o.v), onComplete: () => drawBp(to) });
    };
    this.xpAt.push({ x: x + tx + tw * 0.62, y: y + 30, rect: { x, y, w, h }, obj: c, kind: 'pass' }); // "+N EXP" sobre la barra del pase
    // brillo que cruza el cuadro (recortado a su forma)
    const shine = this.add.graphics();
    shine.fillStyle(0xffffff, 0.5).fillPoints([{ x: 0, y: 0 }, { x: 34, y: 0 }, { x: 10, y: h }, { x: -24, y: h }], true);
    shine.fillStyle(0xffffff, 0.25).fillPoints([{ x: 44, y: 0 }, { x: 56, y: 0 }, { x: 32, y: h }, { x: 20, y: h }], true);
    shine.setBlendMode(Phaser.BlendModes.ADD).setX(-90);
    const maskG = this.make.graphics({}, false);
    maskG.fillStyle(0xffffff).fillRoundedRect(x, y, w, h, 20);
    shine.setMask(maskG.createGeometryMask());
    c.add(shine);
    this.tweens.add({ targets: shine, x: w + 60, duration: 1100, repeat: -1, repeatDelay: 1500, ease: 'Sine.easeInOut' });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => maskG.destroy());
    // destellos (estrellitas que aparecen y desaparecen)
    const star = (sx: number, sy: number, r: number, delay: number) => {
      const st = this.add.graphics({ x: sx, y: sy });
      st.fillStyle(0xffffff, 1).fillPoints([{ x: 0, y: -r }, { x: r * 0.25, y: -r * 0.25 }, { x: r, y: 0 }, { x: r * 0.25, y: r * 0.25 }, { x: 0, y: r }, { x: -r * 0.25, y: r * 0.25 }, { x: -r, y: 0 }, { x: -r * 0.25, y: -r * 0.25 }], true);
      st.setBlendMode(Phaser.BlendModes.ADD).setScale(0);
      c.add(st);
      this.tweens.add({ targets: st, scale: 1, angle: 90, duration: 380, yoyo: true, repeat: -1, repeatDelay: 1700, delay, ease: 'Sine.easeInOut' });
    };
    star(w * 0.62, 12, 9, 0);
    star(bx0 + 22, h / 2 - 22, 7, 700);
    star(w - 48, h - 16, 8, 1300);
    if (ready > 0) {
      const badge = this.add.container(w - 10, 8);
      const bg = this.add.graphics();
      bg.fillStyle(0x0a1638, 1).fillCircle(0, 0, 15).fillStyle(0xff3b4f, 1).fillCircle(0, 0, 12);
      badge.add([bg, this.add.text(0, 0, String(Math.min(99, ready)), { fontFamily: FONT, fontSize: '14px', color: '#ffffff' }).setOrigin(0.5)]);
      c.add(badge);
      this.tweens.add({ targets: badge, scale: 1.2, duration: 380, yoyo: true, repeat: -1 });
    }
    // zona táctil = TODO el cuadro (un rectángulo hijo con origen arriba-izquierda: el área de un Container
    // se mide desde su centro y dejaba fuera parte del cuadro)
    const hit = this.add.rectangle(0, 0, w, h, 0x000000, 0.001).setOrigin(0).setInteractive({ useHandCursor: true });
    c.add(hit);
    hit.on('pointerup', () => {
      this.tweens.add({ targets: c, scale: { from: 0.96, to: 1 }, duration: 160 });
      this.cameras.main.fadeOut(200, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('BattlePass'));
    });
  }

  /**
   * Cuadro de perfil: [insignia de rango] [nombre · nivel · barra XP].
   * Datos reales del perfil; la barra se anima cuando la XP sube (también en vivo).
   */
  private profileCard(x: number, y: number, maxW: number, p: ReturnType<typeof getProfile>) {
    const ch = PROFILE_H;
    const dy = (ch - 96) / 2; // el contenido se diseñó para 96 de alto: se centra
    const cw = Math.min(maxW, 380); // compacto
    const card = this.add.container(x, y);

    // fondo (mismo lenguaje que el botón de ajustes y las tarjetas laterales)
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.35).fillRoundedRect(3, 5, cw, ch, 20);
    g.fillStyle(0x0b1733, 0.94).fillRoundedRect(0, 0, cw, ch, 20);
    g.fillStyle(0x1b2d5c, 0.5).fillRoundedRect(3, 3, cw - 6, ch * 0.45, { tl: 17, tr: 17, bl: 0, br: 0 });
    card.add(g);
    // MARCO del perfil (16-11-2026): el borde es el marco elegido (de una liga alcanzada; ui/ProfileDialog.ts). Se repinta al cambiarlo
    const frameG = this.add.graphics();
    const paintFrame = () => {
      frameG.clear();
      drawProfileFrame(frameG, cw, ch, 20, equippedFrame(getPlayer() as PlayerState));
    };
    paintFrame();
    card.add(frameG);
    const offFrame = onPlayerChange(() => frameG.active && paintFrame());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => offFrame());
    // tocar la card (fuera de la insignia, que abre la lista de rangos) abre el PERFIL: datos de la cuenta y marcos
    const cardHit = this.add.rectangle(0, 0, cw, ch, 0x000000, 0.001).setOrigin(0).setInteractive({ useHandCursor: true });
    cardHit.on('pointerup', () => {
      this.tweens.add({ targets: card, scale: { from: 0.97, to: 1 }, duration: 180, ease: 'Back.easeOut' });
      openProfileDialog(this, (m) => this.toast(m));
    });
    card.add(cardHit);

    // insignia de rango a la izquierda (en lugar del avatar)
    const badgeH = 86;
    const badgeX = 10 + badgeH / 2;
    const rank = myLeague();
    const position = myPosition();
    card.add(
      new RankBadge(this, badgeX, ch / 2, {
        rank,
        level: p.level,
        size: badgeH,
        position,
        // tocar la insignia abre la lista de rangos (informativa si aún no se desbloqueó Ranked)
        openWhenLocked: true,
        onOpen: () => showRankList(this, { current: rank, level: p.level, position }),
      }),
    );

    // textos + barra a la derecha de la insignia
    const tx = badgeX + badgeH / 2 + 10;
    const tw = cw - 18 - tx;
    const name = this.add.text(tx, 12 + dy, p.name, textStyle(26)).setOrigin(0, 0);
    fitText(name, tw);
    card.add(name);
    const lvl = this.add.text(tx, 45 + dy, `Nivel ${p.level}`, textStyle(17, '#9fc0ff')).setOrigin(0, 0);
    card.add(lvl);
    this.xpAt.push({ x: x + tx + tw * 0.62, y: y + 52 + dy, rect: { x, y, w: cw, h: ch }, obj: card, kind: 'level' }); // "+N EXP" sobre la barra de nivel

    const by = 72 + dy;
    const bh = 12;
    const bar = this.add.graphics();
    card.add(bar);
    const drawXp = (prog: number) => {
      const fw = Math.max(bh, tw * Phaser.Math.Clamp(prog, 0, 1));
      bar.clear();
      bar.fillStyle(0x05112c, 1).fillRoundedRect(tx, by, tw, bh, bh / 2);
      bar.lineStyle(1, 0x2a4a8a, 1).strokeRoundedRect(tx, by, tw, bh, bh / 2);
      if (prog <= 0) return;
      bar.fillStyle(0x1f7bff, 1).fillRoundedRect(tx, by, fw, bh, bh / 2);
      bar.fillStyle(0x5fd0ff, 1).fillRoundedRect(tx, by, fw, bh * 0.5, { tl: bh / 2, tr: bh / 2, bl: 0, br: 0 });
      bar.fillStyle(0xffffff, 0.6).fillRoundedRect(tx + 4, by + 2, Math.max(0, fw - 8), 2, 1);
    };

    // animación suave desde lo último que se mostró (sobrevive a cambiar de escena)
    const KEY = 'profile.xpShown';
    const shown = { v: 0 };
    let current = { level: p.level, prog: levelProgress(p) };
    const prev = this.registry.get(KEY) as { level: number; prog: number } | undefined;
    const animateTo = (from: { level: number; prog: number }, to: { level: number; prog: number }) => {
      this.tweens.killTweensOf(shown);
      const steps: { to: number; reset?: boolean }[] =
        to.level > from.level ? [{ to: 1 }, { to: to.prog, reset: true }] : [{ to: to.prog }];
      shown.v = from.prog;
      drawXp(shown.v);
      const run = (i: number) => {
        const s = steps[i];
        if (!s) return;
        if (s.reset) {
          // la barra se llenó: SUBIDA DE NIVEL (el número cambia ahora, con el efecto amarillo)
          shown.v = 0;
          lvl.setText(`Nivel ${to.level}`);
          sfx(this, 'power-up'); // sube el nivel de la cuenta
          this.levelUpFx({ x, y, w: cw, h: ch }, 20, `NIVEL ${to.level}`);
          this.tweens.add({ targets: lvl, scale: { from: 1.6, to: 1 }, duration: 480, ease: 'Back.easeOut' });
        }
        this.tweens.add({
          targets: shown,
          v: s.to,
          duration: 700,
          ease: 'Cubic.easeOut',
          onUpdate: () => drawXp(shown.v),
          onComplete: () => run(i + 1),
        });
      };
      run(0);
      this.registry.set(KEY, to);
    };
    if (prev && (prev.level < current.level || (prev.level === current.level && prev.prog < current.prog))) {
      if (this.xpGain > 0) {
        // EXP de la partida: se ve como estaba y se llena cuando toca (tras la ruleta)
        drawXp(prev.prog);
        lvl.setText(`Nivel ${prev.level}`);
        const to = current;
        // el número de nivel cambia cuando la barra se llena (animateTo), con el efecto de subida
        this.xpAnims.push(() => animateTo(prev, to));
      } else animateTo(prev, current);
    } else {
      drawXp(current.prog);
      this.registry.set(KEY, current);
    }

    // actualización en vivo si el perfil cambia mientras el menú está abierto
    const apply = (s: PlayerState) => {
      const next = { level: s.level, prog: levelProgress(s) };
      if (next.level <= current.level) lvl.setText(`Nivel ${s.level}`); // si sube, lo cambia animateTo al llenarse la barra
      name.setText(s.name);
      fitText(name, tw);
      animateTo(current, next);
      current = next;
    };
    this.profileRefresh = () => apply(getPlayer() as PlayerState);
    // con la ruleta abierta la barra espera: se llena cuando la EXP llega a la card (profileRefresh)
    const off = onPlayerChange((s) => {
      if (this.wheelOpenNow()) return;
      apply(s as PlayerState);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => off());
  }

  /**
   * SUBIDA DE NIVEL en una card del menú (perfil o pase): el mismo efecto de "equipar" de PERSONALIZAR (destello, borde que late,
   * anillo que se expande y chispas) pero AMARILLO, y el texto `label` que salta sobre la card. `r` = rectángulo en pantalla.
   */
  private levelUpFx(r: { x: number; y: number; w: number; h: number }, rad: number, label: string) {
    if (!this.sys.isActive()) return;
    const Y = 0xffe14d;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const D = 205; // sobre la presentación de la EXP
    const flash = this.add.graphics().setDepth(D).setBlendMode(Phaser.BlendModes.ADD);
    flash.fillStyle(0xfff3a0, 0.65).fillRoundedRect(r.x, r.y, r.w, r.h, rad);
    this.tweens.add({ targets: flash, alpha: 0, duration: 560, ease: 'Cubic.easeOut', onComplete: () => flash.destroy() });
    const edge = this.add.graphics().setDepth(D + 1).setBlendMode(Phaser.BlendModes.ADD);
    edge.lineStyle(12, Y, 0.4).strokeRoundedRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4, rad + 2);
    edge.lineStyle(4, 0xfffbd0, 1).strokeRoundedRect(r.x, r.y, r.w, r.h, rad);
    this.tweens.add({ targets: edge, alpha: { from: 1, to: 0.25 }, duration: 260, yoyo: true, repeat: 2, onComplete: () => this.tweens.add({ targets: edge, alpha: 0, duration: 420, onComplete: () => edge.destroy() }) });
    const ring = this.add.graphics({ x: cx, y: cy }).setDepth(D - 1).setBlendMode(Phaser.BlendModes.ADD);
    ring.lineStyle(5, Y, 0.95).strokeRoundedRect(-r.w / 2, -r.h / 2, r.w, r.h, rad);
    this.tweens.add({ targets: ring, scale: 1.25, alpha: 0, duration: 680, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    for (let i = 0; i < 16; i++) {
      const px = r.x + Math.random() * r.w;
      const py = Math.random() < 0.5 ? r.y : r.y + r.h;
      const star = this.add.star(px, py, 4, 2, 7, i % 2 ? Y : 0xffffff).setDepth(D + 2).setBlendMode(Phaser.BlendModes.ADD).setScale(0.4);
      this.tweens.add({ targets: star, y: py + (py === r.y ? -1 : 1) * Phaser.Math.Between(14, 40), x: px + Phaser.Math.Between(-18, 18), scale: 1.1, alpha: 0, angle: 140, duration: Phaser.Math.Between(500, 850), delay: Phaser.Math.Between(0, 240), ease: 'Cubic.easeOut', onComplete: () => star.destroy() });
    }
    // "¡NIVEL N!" salta sobre la card y se desvanece
    const t = this.add.text(cx, cy, `¡${label}!`, { fontFamily: FONT, fontSize: '30px', color: '#ffe14d', stroke: '#5a3a00', strokeThickness: 7 }).setOrigin(0.5).setDepth(D + 3).setScale(0.3);
    this.tweens.add({ targets: t, scale: 1, y: cy - 8, duration: 380, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, y: cy - 34, delay: 1100, duration: 420, onComplete: () => t.destroy() });
  }

  /** Botón de ajustes: cuadrado redondeado con borde neón y engranaje relleno. */
  private gearButton(x: number, y: number, size: number, onClick: () => void) {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    const h = size / 2;
    // (21-11-2026) sin borde (ni el neón exterior): solo el cuadro oscuro con su brillo arriba
    g.fillStyle(0x000000, 0.35).fillRoundedRect(-h + 3, -h + 5, size, size, 20);
    g.fillStyle(0x0b1733, 0.94).fillRoundedRect(-h, -h, size, size, 20);
    g.fillStyle(0x1b2d5c, 0.55).fillRoundedRect(-h + 3, -h + 3, size - 6, size * 0.45, { tl: 17, tr: 17, bl: 0, br: 0 });
    c.add(g);

    // engranaje: 8 dientes trapezoidales + agujero central
    const teeth = 8;
    const rOut = 27;
    const rIn = 20;
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2;
      const step = (Math.PI * 2) / teeth;
      for (const [da, r] of [[-0.5, rIn], [-0.28, rOut], [0.28, rOut], [0.5, rIn]] as [number, number][])
        pts.push({ x: Math.cos(a + da * step) * r, y: Math.sin(a + da * step) * r });
    }
    const gear = this.add.graphics();
    gear.fillStyle(0x000000, 0.3).fillPoints(pts.map((p) => ({ x: p.x + 1.5, y: p.y + 2.5 })), true);
    gear.fillStyle(0xdbe5ff).fillPoints(pts, true);
    gear.fillStyle(0x0b1733).fillCircle(0, 0, 9);
    c.add(gear);

    c.setSize(size, size).setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => {
      this.tweens.add({ targets: c, scale: { from: 0.9, to: 1 }, duration: 200, ease: 'Back.easeOut' });
      this.tweens.add({ targets: gear, angle: gear.angle + 45, duration: 300, ease: 'Back.easeOut' });
      onClick();
    });
  }

  /**
   * Contador de MONEDAS con el saldo real. Al volver de un partido cuenta desde lo último que se
   * mostró hasta el saldo nuevo (con un pequeño salto); también se actualiza en vivo.
   */
  private coinCounter(right: number, y: number) {
    const KEY = 'profile.coinsShown';
    const fmt = (n: number) => Math.round(n).toLocaleString('es-CL');
    const now = getPlayer().coins;
    // (21-11-2026) premio de la ruleta cobrado antes de abrir el menú: el contador espera a que lleguen las monedas (playCoinGain)
    const holdC = (this.wheelGain?.coins ?? 0) + this.matchCoins;
    // con monedas de la partida, el monedero arranca SIN ellas: suben al llegar cada moneda (playMatchCoins)
    const prev = this.matchCoins > 0 ? now - holdC : (this.registry.get(KEY) as number | undefined) ?? (holdC > 0 ? now - holdC : undefined);
    const c = this.counter(right, y, 'coin', fmt(prev ?? now));
    this.coinObj = c;
    const txt = c.getData('text') as Phaser.GameObjects.Text;
    const shown = { v: prev ?? now };
    // (21-11-2026, usuario) con la LIGA 2V2 a la vista el contador muestra las MONEDAS 2V2 (otra moneda, otro color): el saldo de la cuenta sigue su
    // curso por debajo (shown.v) y se vuelve a ver al volver a tu liga
    const nrm = c.getData('coinNormal') as Phaser.GameObjects.Image | undefined;
    this.coinModeFn = (m2: boolean) => {
      (c.getData('frame2') as Phaser.GameObjects.Graphics | undefined)?.setVisible(m2);
      nrm?.setVisible(!m2);
      (c.getData('coin2v2') as Phaser.GameObjects.Components.Visible | undefined)?.setVisible(m2);
      (c.getData('coin2Text') as Phaser.GameObjects.Text | undefined)?.setVisible(m2);
      this.tweens.killTweensOf(shown);
      txt.setText(fmt(m2 ? Math.max(0, Math.floor(getPlayer().coins2v2 ?? 0)) : shown.v)).setColor(m2 ? '#e6d2ff' : '#ffe28a');
      fitText(txt, COUNTER_TEXT_W);
      this.tweens.add({ targets: txt, scale: { from: txt.scale * 1.2, to: txt.scale }, duration: 240, ease: 'Back.easeOut' });
    };
    const animateTo = (to: number) => {
      this.registry.set(KEY, to);
      this.tweens.killTweensOf(shown);
      if (this.leagueMode === '2v2') {
        shown.v = to;
        return;
      }
      if (to === shown.v) return;
      const up = to > shown.v;
      this.tweens.add({
        targets: shown,
        v: to,
        delay: 350,
        duration: 900,
        ease: 'Cubic.easeOut',
        onUpdate: () => {
          txt.setText(fmt(shown.v));
          fitText(txt, COUNTER_TEXT_W);
        },
        onComplete: () => {
          if (up) this.tweens.add({ targets: txt, scale: { from: txt.scale * 1.25, to: txt.scale }, duration: 320, ease: 'Back.easeOut' });
        },
      });
      if (up) txt.setColor('#ffe27a');
      this.time.delayedCall(1500, () => txt.setColor(this.leagueMode === '2v2' ? '#e6d2ff' : '#ffffff'));
    };
    if (holdC <= 0) animateTo(now);
    this.coinRect = { x: right - COUNTER_W, y, w: COUNTER_W, h: COUNTER_H };
    this.coinRefresh = () => animateTo(getPlayer().coins);
    this.coinSet = (v: number) => {
      this.tweens.killTweensOf(shown);
      shown.v = v;
      this.registry.set(KEY, v);
      if (this.leagueMode === '2v2') return; // viendo las monedas 2v2: el saldo de la cuenta no se dibuja
      txt.setText(fmt(v)).setColor('#ffe27a');
      fitText(txt, COUNTER_TEXT_W);
    };
    // con la ruleta abierta no se actualiza solo: lo hace coinRefresh cuando las monedas llegan a la card
    const off = onPlayerChange((s) => {
      if (this.wheelOpenNow()) return;
      animateTo(s.coins);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => off());
  }

  /**
   * MONEDAS GANADAS EN LA LIGA esta semana (neto del Ranking Liga, docs/RANKED-V2.md): card de la fila del PASE, a su
   * derecha (21-11-2026), `h` de alto. Fondo del color de la liga con brillo (más importante que los contadores de la cuenta). Tocarla abre LIGA.
   */
  private leagueCoins(left: number, right: number, y: number, h: number) {
    const w = right - left;
    const R = 20; // mismas esquinas que el PASE
    const c = this.add.container(left, y);
    const paint = () => {
      c.removeAll(true);
      const r = rankedView(); // al día (cierre de semana incluido)
      // (21-11-2026, usuario) tocar la card ALTERNA entre la LIGA de siempre y la LIGA 2V2 (monedas 2v2 y rango 2v2); antes abría el TOP 100
      const m2 = this.leagueMode === '2v2';
      const accent = m2 ? 0xb06bff : 0x3a7bff;
      const total2 = Math.max(0, Math.floor(getPlayer().coins2v2 ?? 0));
      const rk2 = rank2v2(total2);
      // (21-11-2026, 3.er diseño, referencia del usuario) card azul del menú con trofeo dorado a la izquierda, "LIGA <NOMBRE> · SEMANAL" en
      // dorado y UNA barra con las monedas que llevas esta semana en la liga. La barra se llena hacia la meta de ascenso (15.000 de 30.000 =
      // mitad) SIN escribir la meta, para no llenar la card de datos. Liga máxima o meta cumplida: llena.
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.35).fillRoundedRect(3, 6, w, h, R);
      g.lineStyle(8, accent, 0.2).strokeRoundedRect(0, 0, w, h, R);
      g.fillStyle(0x0b1733, 0.96).fillRoundedRect(0, 0, w, h, R);
      g.fillStyle(m2 ? 0x2a1d5c : 0x1b2d5c, 0.55).fillRoundedRect(3, 3, w - 6, h * 0.45, { tl: R - 3, tr: R - 3, bl: 0, br: 0 });
      g.lineStyle(3, accent, 1).strokeRoundedRect(0, 0, w, h, R);
      // dos puntos arriba a la derecha: indican que la card cambia al tocarla (el encendido es la liga que se ve)
      for (let i = 0; i < 2; i++) g.fillStyle(i === (m2 ? 1 : 0) ? 0xffc24a : 0x4a5f93, 1).fillCircle(w - 30 + i * 13, 17, 4);
      c.add(g);
      // trofeo (assets/liga.webp); si no cargó, solo el hueco
      const tcx = 14 + 26;
      if (this.textures.exists('menu-liga')) {
        const tro = this.add.image(tcx, h / 2 + 1, 'menu-liga');
        tro.setScale(Math.min(58 / tro.width, (h - 12) / tro.height));
        c.add(tro);
      }
      const tx = tcx + 26 + 12;
      const tw = w - tx - 14;
      const lbl = this.add.text(tx, 11, m2 ? 'LIGA 2V2 · SEMANAL' : `LIGA ${rankDef(r.league).name.toUpperCase()} · SEMANAL`, { fontFamily: FONT, fontSize: '15px', color: '#ffc24a', stroke: '#2a1600', strokeThickness: 3 }).setOrigin(0, 0).setLetterSpacing(1);
      fitText(lbl, tw - 30, 0.6); // (deja sitio a los dos puntos de la derecha)
      c.add(lbl);
      // la barra: lo que llevas, hacia la meta (sin mostrarla)
      const bh = 24;
      const by = h - 14 - bh;
      const net = Math.max(0, r.weekNet - this.leagueHold); // (monedas de la liga aún en vuelo: playMatchCoins)
      // LIGA 2V2: la barra va del rango 2v2 actual al siguiente (monedas 2v2 acumuladas); rango máximo: llena
      const prog = m2 ? (rk2.next ? Math.max(0, Math.min(1, (total2 - rk2.from) / (rk2.next.from - rk2.from))) : 1) : r.target == null || r.promoting ? 1 : Math.max(0, Math.min(1, net / r.target));
      const full = m2 ? !rk2.next : r.promoting;
      const bar = this.add.graphics();
      bar.fillStyle(0x05112c, 1).fillRoundedRect(tx, by, tw, bh, bh / 2);
      if (prog > 0) {
        const fw = Math.max(bh, tw * prog);
        bar.fillStyle(full ? 0x2fbf6a : m2 ? 0x7a3dff : 0x1f6bff, 1).fillRoundedRect(tx, by, fw, bh, bh / 2);
        bar.fillStyle(full ? 0x7ff0a8 : m2 ? 0xb98aff : 0x5fa8ff, 1).fillRoundedRect(tx, by, fw, bh * 0.5, { tl: bh / 2, tr: bh / 2, bl: 0, br: 0 });
        bar.fillStyle(0xffffff, 0.35).fillRoundedRect(tx + 6, by + 3, Math.max(0, fw - 12), 3, 1.5);
      }
      bar.lineStyle(2, m2 ? 0x4a2a8a : 0x2a4a8a, 1).strokeRoundedRect(tx, by, tw, bh, bh / 2);
      c.add(bar);
      // las monedas que llevas, dentro de la barra (2v2: tus monedas 2v2)
      const shown = m2 ? total2 : net;
      const val = this.add.text(tx + tw / 2, by + bh / 2 + 1, shown.toLocaleString('es-CL'), { ...textStyle(17), color: shown < 0 ? '#ffb0a8' : '#ffffff' }).setOrigin(0.5);
      fitText(val, tw - 16);
      c.add(val);
    };
    paint();
    this.leagueObj = c;
    this.leagueRect = { x: left, y, w, h };
    this.leagueRepaint = () => c.active && paint();
    // (21-11-2026) zona táctil sobre TODA la card: el contenedor tiene su centro en la esquina de arriba-izquierda de la card, así que su zona táctil
    // (Rectangle(0, 0, w, h) en coordenadas de su caja centrada) solo cubría el cuarto de arriba-izquierda: tocarla en el resto no hacía nada
    const hit = this.add.zone(left + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => hit.destroy());
    // (21-11-2026, usuario) tocarla ya NO abre el TOP 100: la card cambia entre tu LIGA y la LIGA 2V2 (cómo vas en el 2v2). El TOP 100 sigue en LIGA
    hit.on('pointerup', () => {
      this.setLeagueMode(this.leagueMode === '1v1' ? '2v2' : '1v1'); // (19-11-2026) también cambia los botones JUGAR / 2v2
      this.tweens.killTweensOf(c);
      this.tweens.add({ targets: c, scale: { from: 0.96, to: 1 }, duration: 200, ease: 'Back.easeOut' });
    });
    const off = onPlayerChange(() => c.active && paint());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => off());
  }

  /** Contador de recurso, alineado a la derecha (x = borde derecho). */
  private counter(right: number, y: number, kind: 'coin' | 'cash', value: string) {
    const w = COUNTER_W;
    const h = COUNTER_H;
    const k = h / 42; // los iconos y textos se dibujaron para 42 de alto
    const c = this.add.container(right - w, y);
    const g = this.add.graphics();
    // más visible: fondo más opaco, brillo arriba y borde del color de la moneda (dorado / verde)
    const accent = kind === 'coin' ? 0xffc42e : 0x3fae5a;
    g.fillStyle(0x000000, 0.35).fillRoundedRect(2, 4, w, h, h / 2);
    g.fillStyle(0x0a1838, 0.96).fillRoundedRect(0, 0, w, h, h / 2);
    g.fillStyle(0xffffff, 0.08).fillRoundedRect(8, 3, w - 16, h * 0.35, h * 0.17);
    g.lineStyle(2.5, accent, 1).strokeRoundedRect(0, 0, w, h, h / 2);
    // icono
    // (17-11-2026) moneda: imagen moneda-1.webp (la dibujada solo si falta la textura)
    if (kind === 'coin' && !this.textures.exists('coin-1')) {
      g.fillStyle(C.outline).fillCircle(h / 2, h / 2, 15 * k);
      g.fillStyle(C.yellow).fillCircle(h / 2, h / 2, 11 * k);
      g.fillStyle(C.yellowDark).fillRect(h / 2 - 2 * k, h / 2 - 6 * k, 4 * k, 12 * k);
    } else if (kind === 'cash' && !this.textures.exists('cash-pack')) {
      // billete dibujado (si no cargó la imagen)
      g.fillStyle(C.outline).fillRoundedRect(h / 2 - 15 * k, h / 2 - 9 * k, 30 * k, 18 * k, 4 * k);
      g.fillStyle(0x3fae5a).fillRoundedRect(h / 2 - 13 * k, h / 2 - 7 * k, 26 * k, 14 * k, 3 * k);
      g.fillStyle(0xcdeccf).fillCircle(h / 2, h / 2, 4 * k);
    }
    c.add(g);
    // (17-11-2026) moneda: imagen moneda-1.webp
    if (kind === 'coin' && this.textures.exists('coin-1')) {
      const ci = this.add.image(h / 2, h / 2, 'coin-1').setDisplaySize(32 * k, 32 * k);
      c.add(ci);
      c.setData('coinNormal', ci);
    }
    // (21-11-2026, usuario) MONEDAS 2V2: otra moneda (morada) y borde morado, ocultos hasta que la card de la LIGA muestre la LIGA 2V2 (ver leagueCoins / coinMode)
    if (kind === 'coin') {
      const frame2 = this.add.graphics().setVisible(false);
      frame2.lineStyle(2.5, 0xb06bff, 1).strokeRoundedRect(0, 0, w, h, h / 2);
      c.add(frame2);
      let coin2: Phaser.GameObjects.GameObject;
      if (this.textures.exists('coin-2v2')) coin2 = this.add.image(h / 2, h / 2, 'coin-2v2').setDisplaySize(32 * k, 32 * k);
      else {
        // sin su imagen (public/assets/moneda-2v2.webp): moneda morada dibujada con un 2 en el centro
        const dg = this.add.graphics({ x: h / 2, y: h / 2 });
        dg.fillStyle(0x1d0a3d, 1).fillCircle(0, 0, 15 * k).fillStyle(0x6b2fe0, 1).fillCircle(0, 0, 12.5 * k).fillStyle(0xa77bff, 1).fillCircle(-1.5 * k, -2 * k, 8 * k).fillStyle(0x6b2fe0, 1).fillCircle(0, 0, 7 * k);
        coin2 = dg;
        c.add(dg);
        const two = this.add.text(h / 2, h / 2 + 1, '2', { fontFamily: FONT, fontSize: `${Math.round(13 * k)}px`, color: '#ffffff' }).setOrigin(0.5).setVisible(false);
        c.add(two);
        c.setData('coin2Text', two);
      }
      (coin2 as unknown as Phaser.GameObjects.Components.Visible).setVisible(false);
      if (!c.list.includes(coin2)) c.add(coin2);
      c.setData('frame2', frame2);
      c.setData('coin2v2', coin2);
    }
    // (16-11-2026, usuario) el DINERO con el fardo chico; algo más chico y corrido a la derecha para no tocar el borde redondeado
    if (kind === 'cash' && this.textures.exists('cash-pack')) c.add(this.add.image(h / 2 + 3 * k, h / 2, 'cash-pack').setDisplaySize(32 * k, 32 * k));
    // (16-11-2026, usuario) cantidad alineada a la DERECHA, pegada al botón (i) / (+)
    const txtRight = w - h / 2 + 2 - 14 * Math.max(0.8, k) - 8;
    const txt = this.add.text(txtRight, h / 2, value, { ...textStyle(Math.round(23 * k)), color: kind === 'coin' ? '#ffe28a' : '#c9f5d2' }).setOrigin(1, 0.5);
    fitText(txt, COUNTER_TEXT_W);
    c.add(txt);
    c.setData('text', txt);
    c.setData('icon', g);
    // (i): qué es, para qué sirve y cómo conseguirla (antes, un "+" sin función)
    const info = this.add.container(w - h / 2 + 2, h / 2).setScale(Math.max(0.8, k));
    const ig = this.add.graphics();
    ig.fillStyle(0x0a1638, 1).fillCircle(0, 0, 14);
    ig.fillStyle(accent, 1).fillCircle(0, 0, 12);
    // dinero: "+" (lleva a comprar más a la Tienda); monedas: "i" (ventana de cómo conseguirlas y para qué sirven)
    info.add([ig, this.add.text(0, kind === 'cash' ? 0 : 1, kind === 'cash' ? '+' : 'i', { fontFamily: FONT, fontSize: kind === 'cash' ? '24px' : '18px', color: kind === 'cash' ? '#ffffff' : '#0a1638' }).setOrigin(0.5)]);
    info.setSize(40, 42).setInteractive({ useHandCursor: true }); // zona táctil generosa aunque el contador sea bajo
    // el + del DINERO lleva a la Tienda y esta baja sola hasta la sección DINERO; la (i) de las monedas abre su información
    info.on('pointerup', () => (kind === 'cash' ? this.scene.start('Shop', { scrollTo: 'cash' }) : this.currencyInfo(kind === 'coin' && this.leagueMode === '2v2' ? 'coin2v2' : kind)));
    c.add(info);
    return c;
  }

  /** Ventana de información de la moneda: para qué sirve y cómo se consigue. */
  private currencyInfo(kind: 'coin' | 'cash' | 'coin2v2') {
    const two = kind === 'coin2v2'; // (21-11-2026) las MONEDAS 2V2 (moneda morada del ranking 2v2)
    const coin = kind === 'coin' || two;
    const W = this.scale.width;
    const H = this.scale.height;
    const objs: Phaser.GameObjects.GameObject[] = [];
    const close = () => objs.forEach((o) => o.destroy());
    const shade = this.add.rectangle(0, 0, W, H, 0x02060f, 0.72).setOrigin(0).setDepth(8000).setInteractive();
    shade.on('pointerup', close);
    objs.push(shade);
    const pw = Math.min(600, W - 40);
    const ph = 470;
    const accent = two ? 0xb06bff : coin ? 0xffc42e : 0x3fae5a;
    const p = this.add.container(W / 2, H / 2).setDepth(8001);
    objs.push(p);
    p.add(this.add.rectangle(0, 0, pw, ph, 0, 0.001).setInteractive());
    const g = this.add.graphics();
    g.lineStyle(10, accent, 0.22).strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, 24);
    g.fillStyle(0x0b1733, 0.98).fillRoundedRect(-pw / 2, -ph / 2, pw, ph, 24);
    g.lineStyle(3, accent, 1).strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, 24);
    // icono grande
    g.fillStyle(0x0a1638, 1).fillCircle(0, -ph / 2 + 64, 36);
    g.fillStyle(accent, 1).fillCircle(0, -ph / 2 + 64, 32);
    // (17-11-2026) moneda: imagen moneda-1.webp (la dibujada solo si falta la textura)
    const coinKey = two ? 'coin-2v2' : 'coin-1';
    const coinImg = coin && this.textures.exists(coinKey);
    if (coin) {
      // con la imagen, se agrega justo después del fondo (abajo)
      if (!coinImg) {
        g.fillStyle(two ? 0x4b1fa8 : 0xd99400, 1).fillCircle(0, -ph / 2 + 64, 22);
        g.fillStyle(two ? 0x8a4bff : 0xffd23f, 1).fillCircle(0, -ph / 2 + 62, 20);
      }
    } else {
      g.fillStyle(0x0a1638, 1).fillRoundedRect(-22, -ph / 2 + 50, 44, 28, 5);
      g.fillStyle(0x2f8f48, 1).fillRoundedRect(-19, -ph / 2 + 53, 38, 22, 4);
      g.fillStyle(0xcdeccf, 1).fillCircle(0, -ph / 2 + 64, 6);
    }
    p.add(g);
    if (coinImg) p.add(this.add.image(0, -ph / 2 + 64, coinKey).setDisplaySize(44, 44));
    p.add(this.add.text(0, -ph / 2 + 126, two ? 'MONEDAS 2V2' : coin ? 'MONEDAS' : 'DINERO', { fontFamily: FONT, fontSize: '34px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 6 }).setOrigin(0.5).setLetterSpacing(3));
    const section = (y: number, title: string, body: string) => {
      p.add(this.add.text(-pw / 2 + 34, y, title, { fontFamily: FONT, fontSize: '18px', color: coin ? '#ffd23f' : '#9fe8a0' }).setOrigin(0, 0.5).setLetterSpacing(1));
      p.add(this.add.text(-pw / 2 + 34, y + 16, body, { fontFamily: FONT, fontSize: '17px', color: '#dbe5ff', wordWrap: { width: pw - 68 }, lineSpacing: 2 }).setOrigin(0, 0));
    };
    if (two) {
      section(-ph / 2 + 172, 'PARA QUÉ SIRVEN', 'Son tu contador del RANKING 2V2: deciden tu rango en la LIGA 2V2 (de Bronce a Challenger). No se usan en la Tienda ni en la Liga normal.');
      section(-ph / 2 + 290, 'CÓMO CONSEGUIRLAS', `Ganando partidas 2v2: +${COINS_2V2.win}. Perder resta ${COINS_2V2.loss} y rendirte ${COINS_2V2.surrender}. Nunca bajan de 0.`);
    } else if (coin) {
      section(-ph / 2 + 172, 'PARA QUÉ SIRVEN', 'Son tu oro competitivo: pagan la entrada de las partidas de Liga y deciden tu puesto en el RANKING GLOBAL. No se usan en la Tienda.');
      section(-ph / 2 + 290, 'CÓMO CONSEGUIRLAS', 'Ganando partidas de Liga, en las ruletas diarias, el premio diario, el pase de batalla y la recompensa semanal de tu liga.');
    } else {
      section(-ph / 2 + 172, 'PARA QUÉ SIRVE', 'Es la moneda de la Tienda: compra estilos y el Pase Premium.');
      section(-ph / 2 + 290, 'CÓMO CONSEGUIRLO', 'En el pase de batalla (también el gratis), el premio diario y la recompensa semanal de tu liga (desde Plata).');
    }
    p.add(arcadeButton(this, 0, ph / 2 - 52, 240, 66, 'ENTENDIDO', close, { palette: coin ? 'yellow' : 'blue' }));
    p.setScale(0.85).setAlpha(0);
    this.tweens.add({ targets: p, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
  }

  // ---------------------------------------------------------------- botones laterales
  /**
   * Tarjeta lateral (PERSONAJE / TIENDA): paralelogramo con esquinas redondeadas, borde neón,
   * icono grande y texto. `locked` = apagada (sección sin construir) con pestaña de candado.
   */
  private sideButton(x: number, y: number, label: string, icon: 'user' | 'shop', locked: boolean, onClick: () => void) {
    const c = this.add.container(x, y);
    const w = 214;
    const h = 136;
    const k = 14; // inclinación (la parte de arriba se corre a la derecha)
    const shape = roundedPoly([[-w / 2 + k, -h / 2], [w / 2, -h / 2], [w / 2 - k, h / 2], [-w / 2, h / 2]], 16);
    const pal = locked
      ? { fill: 0x0a1226, top: 0x141f3a, line: 0x2c3d66, lineA: 0.8, icon: 0x8391b3, text: '#9aa6c4', glow: 0 }
      : { fill: 0x0b1733, top: 0x1b2d5c, line: 0x3a7bff, lineA: 1, icon: 0xdbe5ff, text: '#ffffff', glow: 0.22 };

    const g = this.add.graphics();
    // sombra
    g.fillStyle(0x000000, 0.35).fillPoints(shape.map((p) => ({ x: p.x + 4, y: p.y + 7 })), true);
    // halo neón (solo activa)
    if (pal.glow) g.lineStyle(10, pal.line, pal.glow).strokePoints(shape, true, true);
    // cuerpo + brillo superior (degradado vertical aproximado con la misma forma encogida)
    g.fillStyle(pal.fill, locked ? 0.9 : 0.94).fillPoints(shape, true);
    g.fillStyle(pal.top, 0.55).fillPoints(shape.filter((p) => p.y < 0).map((p) => ({ x: p.x * 0.97, y: p.y * 0.96 })), true);
    // borde
    g.lineStyle(3, pal.line, pal.lineA).strokePoints(shape, true, true);
    // filo de luz arriba
    g.lineStyle(2, 0xffffff, locked ? 0.08 : 0.22).lineBetween(-w / 2 + k + 18, -h / 2 + 4, w / 2 - 18, -h / 2 + 4);
    c.add(g);

    // icono
    const ig = this.add.graphics({ x: 0, y: -22 });
    ig.fillStyle(pal.icon);
    if (icon === 'user') {
      ig.fillCircle(0, -10, 16);
      ig.fillRoundedRect(-26, 8, 52, 28, { tl: 22, tr: 22, bl: 6, br: 6 });
    } else {
      ig.lineStyle(5, pal.icon);
      ig.beginPath().moveTo(-34, -20).lineTo(-24, -20).lineTo(-16, 14).lineTo(22, 14).strokePath(); // asa + base
      ig.fillPoints([{ x: -22, y: -12 }, { x: 30, y: -12 }, { x: 24, y: 8 }, { x: -17, y: 8 }], true); // cesta
      ig.fillStyle(pal.fill);
      for (let i = 0; i < 3; i++) ig.fillRect(-12 + i * 13, -8, 6, 12); // rejilla
      ig.fillStyle(pal.icon).fillCircle(-10, 24, 5.5).fillCircle(18, 24, 5.5); // ruedas
    }
    c.add(ig);

    c.add(this.add.text(locked ? 0 : -14, locked ? 26 : 34, label, { ...textStyle(24, pal.text), strokeThickness: 0 }).setOrigin(0.5));
    if (locked) {
      c.add(this.add.text(0, 52, 'PRÓXIMAMENTE', { ...textStyle(15, '#7d8bb0'), strokeThickness: 0 }).setOrigin(0.5));
      // pestaña con candado en la esquina superior derecha
      const tab = this.add.graphics({ x: w / 2 - 34, y: -h / 2 + 4 });
      tab.fillStyle(0x16223f, 1).fillPoints(roundedPoly([[-26, -14], [32, -14], [26, 26], [-32, 26]], 9), true);
      tab.lineStyle(2, 0x2c3d66, 1).strokePoints(roundedPoly([[-26, -14], [32, -14], [26, 26], [-32, 26]], 9), true, true);
      tab.lineStyle(4, 0xb7c2de).beginPath().arc(0, 2, 7, Math.PI, 0).strokePath(); // arco del candado
      tab.fillStyle(0xb7c2de).fillRoundedRect(-11, 2, 22, 17, 4);
      tab.fillStyle(0x16223f).fillCircle(0, 9, 3).fillRect(-1.5, 9, 3, 6);
      c.add(tab);
    } else {
      // chevron ›
      const ch = this.add.graphics({ x: w / 2 - 30, y: 34 });
      ch.lineStyle(5, 0xffffff).beginPath().moveTo(-5, -9).lineTo(4, 0).lineTo(-5, 9).strokePath();
      c.add(ch);
    }

    c.setSize(w, h).setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => {
      this.tweens.add({ targets: c, scale: { from: 0.94, to: 1 }, duration: 200, ease: 'Back.easeOut' });
      onClick();
    });
  }

  // ---------------------------------------------------------------- barra inferior
  private bottomBar(W: number, top: number, h: number) {
    // panel oscuro con borde superior cyan
    const bar = this.add.graphics();
    bar.fillStyle(0x030c22, 0.96).fillRect(0, top, W, h);
    bar.fillStyle(0x3a8bff, 0.9).fillRect(0, top, W, 3);
    const cy = top + h / 2 - 6;

    const tab = (label: string, x: number, icon: 'rank' | 'home' | 'event', active: boolean, onClick: () => void) => {
      // resalte de la pestaña activa
      if (active) {
        const hl = this.add.graphics();
        hl.fillStyle(0x1b5fc2, 0.5).fillRoundedRect(x - 58, top + 8, 116, h - 16, 16);
        hl.fillStyle(0x3a8bff, 1).fillRoundedRect(x - 30, top, 60, 4, 2); // indicador superior
      }
      const col = active ? 0xffffff : 0x7f93bf;
      const ig = this.add.graphics({ x, y: cy - 2 });
      ig.fillStyle(col);
      if (icon === 'home') ig.fillTriangle(-16, 4, 16, 4, 0, -16).fillRect(-11, 2, 22, 13);
      else if (icon === 'rank') {
        // podio
        ig.fillRect(-16, 0, 10, 12).fillRect(-5, -8, 10, 20).fillRect(6, -4, 10, 16);
      } else {
        // calendario
        ig.fillRoundedRect(-15, -12, 30, 26, 4);
        ig.fillStyle(0x030c22).fillRect(-11, -4, 22, 2);
        ig.fillStyle(col).fillRect(-11, -14, 4, 6).fillRect(7, -14, 4, 6);
      }
      this.add.text(x, cy + 30, label, { fontFamily: FONT, fontSize: '17px', color: active ? '#ffffff' : '#7f93bf' }).setOrigin(0.5);
      const hit = this.add.rectangle(x, top + h / 2, W / 3 - 6, h, 0x000000, 0.001).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        this.tweens.add({ targets: ig, scale: { from: 0.85, to: 1 }, duration: 180, ease: 'Back.easeOut' });
        onClick();
      });
    };

    tab('RANKING', W * 0.2, 'rank', false, () => this.openRanked());
    tab('INICIO', W * 0.5, 'home', true, () => undefined);
    tab('EVENTOS', W * 0.8, 'event', false, () => this.toast('Eventos: próximamente'));
  }

  // ---------------------------------------------------------------- aviso temporal
  private toast(msg: string) {
    const W = this.scale.width;
    const H = this.scale.height;
    const t = this.add.text(W / 2, H * 0.68, msg, textStyle(26, '#ffffff')).setOrigin(0.5).setDepth(9000).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, y: t.y - 20, duration: 200 });
    this.tweens.add({ targets: t, alpha: 0, delay: 1100, duration: 300, onComplete: () => t.destroy() });
  }
}
