import Phaser from 'phaser';
import { getPlayer } from '../domain/playerStore';
import type { PlayerState } from '../domain/player';
import { equippedFrame, isFrameId } from '../domain/profileFrames';
import { FONT, restartOnResize } from '../ui/theme';
import { searchSpinner } from '../ui/searchSpinner';
import { UI, flatButton, stadiumBg } from '../ui/ui';
import { showConfirm } from '../ui/ConfirmDialog';
import { totalWins } from '../logic/Stats';
import { playMatchMusic, prepareMatchMusic, setRoomMatchMusic, stopMatchMusic } from '../fx/matchMusic';
import { queueVersusDuoArt, showVersus as showVersusScreen } from '../ui/VersusScreen';
import { lookForSkin, playerLook } from '../objects/Character';
import type { SkinId } from '../characters/skins';
import { getProfile } from '../logic/Profile';
import { charColorOf } from '../domain/charColors';
import { connect } from '../net/NetClient';
import { riskPlayerId } from '../net/riskApi';
import { botNamesFor } from '../net/doubles';
import { rivalFor } from '../characters/catalog';
import { MatchNet } from '../net/MatchNet';
import { doublesFill, rankedSearchPanel } from '../ui/searchPanel';
import { doublesSearchPanelNow, league2v2Id } from '../ui/PlayEntry2v2';
import { preloadSearchTimer, searchTimer, styleSearchTitle } from '../ui/searchTimer';
import { startIntroMusic, stopIntroMusic } from '../fx/introMusic';
import { preloadRankBadges } from '../ui/RankBadge';
import { rankedView } from '../logic/Ranked';
import { EV, type ErrorMsg, type MatchedMsg, type SearchingMsg } from '../net/protocol';

/**
 * Búsqueda de rival en el servidor multijugador (LAN). La lanza JUGAR cuando hay un servidor configurado.
 *  - Pide partida (mm:find). El servidor empareja con quien esté esperando o crea una sala y cuenta 5 s.
 *  - Emparejados: pantalla VS y partido en red (MatchScene con `net`), sin confirmaciones.
 *  - Sin rival (el servidor avisa mm:timeout) o sin servidor: "¿Jugar contra el BOT?". SÍ = el flujo de
 *    siempre (escena Matchmaking con los mismos datos que habría recibido); NO = menú.
 */
export interface LanSearchData {
  /** datos con los que se abre el flujo BOT de siempre si no hay rival */
  fallback: Record<string, unknown>;
  /** (21-11-2026) '2v2': busca un COMPAÑERO (2 humanos del mismo equipo contra 2 bots); sin él se ofrece el 2v2 contra bots */
  mode?: '1v1' | '2v2';
  /** (27-11-2026) DUELO entre amigos: clave de la sala privada (solo entra el amigo) y su nombre; sin él no hay bot: vuelve al menú */
  duelKey?: string;
  duelName?: string;
}

export class LanSearchScene extends Phaser.Scene {
  private fallback: Record<string, unknown> = {};
  private mode: '1v1' | '2v2' = '1v1';
  private done = false;
  private cleanup: (() => void)[] = [];

  constructor() {
    super('LanSearch');
  }

  private duelKey: string | null = null;
  private duelName = '';

  init(data: LanSearchData) {
    this.fallback = data?.fallback ?? {};
    this.duelKey = typeof data?.duelKey === 'string' ? data.duelKey : null;
    this.duelName = data?.duelName ?? '';
    this.mode = data?.mode === '2v2' ? '2v2' : '1v1';
    this.done = false;
    this.matched = false;
    this.fill = null;
    this.cleanup = [];
  }

  preload() {
    // liga de la apuesta (la misma pantalla que la búsqueda contra el BOT)
    if (this.rk) preloadRankBadges(this.load, [rankedView().league]);
    preloadSearchTimer(this.load);
    if (this.mode === '2v2') preloadRankBadges(this.load, [league2v2Id()], true); // (21-11-2026) emblema de tu LIGA 2V2 en la búsqueda
    if (this.mode === '2v2') queueVersusDuoArt(this.load); // (19-11-2026) entrada del equipo en la VS del 2v2
  }

  private get bet(): number | null {
    return (this.fallback.ranked as { bet?: number } | undefined)?.bet ?? null;
  }

  /** ¿Ranked o AMISTOSO? (ambos muestran liga y apuesta, igual que la búsqueda contra el BOT) */
  private get rk() {
    return !!this.bet || !!this.fallback.unranked;
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    restartOnResize(this);
    startIntroMusic(this); // la música del menú SIGUE durante la búsqueda (se corta al salir el VS); si no sonaba, arranca
    this.cameras.main.fadeIn(200, 0, 0, 0);
    stadiumBg(this, 0.55);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup.forEach((f) => f()));
    // ambiente del próximo partido elegido ya: su música se carga mientras se busca y suena desde el VS
    this.toMatch = false;
    this.ambiente = prepareMatchMusic(this, this.mode === '2v2');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (!this.toMatch) stopMatchMusic(this); // búsqueda cancelada / sin rival: la música no sigue sonando
    });

    // mismo aspecto que la búsqueda contra el BOT (MatchmakingScene): anillo con la pelota, reloj encima del título
    const c = this.add.container(W / 2, H * 0.44);
    searchSpinner(this, c, W, H);
    const duo = this.mode === '2v2';
    const title = this.add.text(0, 216, duo ? 'BUSCANDO PARTIDA 1/4' : this.duelKey ? 'DUELO' : 'BUSCANDO RIVAL', { fontFamily: FONT, fontSize: '40px', color: UI.text }).setOrigin(0.5).setLetterSpacing(2);
    c.add(title);
    styleSearchTitle(this, c, title); // (21-11-2026) título con el estilo del mockup
    const count = searchTimer(this, c, 0, 142, 200); // (21-11-2026) placa con cronómetro (assets/buscando/contador.webp)
    this.title = title;
    // liga + lo invertido / premio (o AMISTOSO), como en la búsqueda contra el BOT
    // (20-11-2026, usuario) 2v2: la misma presentación con las MONEDAS 2V2 (lo invertido y el premio)
    const panel = duo ? doublesSearchPanelNow(this) : this.rk ? rankedSearchPanel(this, { bet: this.bet, unranked: !this.bet }, () => undefined, () => undefined) : [];
    const cancel = flatButton(this, W / 2, H * 0.84, 300, 86, 'CANCELAR', () => this.cancelSearch(), { fontSize: 34 }); // (21-11-2026, usuario) CANCELAR más grande

    connect()
      .then((tr) => {
        if (this.done || !this.scene.isActive()) return;
        const onSearching = (m: SearchingMsg) => {
          // 2v2: "BUSCANDO PARTIDA n/4", que se va llenando de bots mientras se espera al compañero (el servidor espera 10 s)
          if (duo) this.fill = doublesFill(this, title, m.timeoutMs);
          else title.setText(this.duelKey ? `ESPERANDO A ${this.duelName.toUpperCase()}` : 'BUSCANDO RIVAL 1/2'); // jugadores en la sala
          // cuenta atrás visual; el tiempo real lo controla el servidor (mm:timeout)
          const end = this.time.now + m.timeoutMs;
          const tick = () => count.setText(`0:${String(Math.max(0, Math.ceil((end - this.time.now) / 1000))).padStart(2, '0')}`);
          tick();
          this.time.addEvent({ delay: 100, repeat: Math.ceil(m.timeoutMs / 100), callback: tick });
        };
        const onMatched = (m: MatchedMsg) => {
          if (this.done) return;
          this.done = true;
          this.fill?.full(); // 2v2: llegó el compañero, 4/4
          cancel.destroy();
          if (panel.length) this.tweens.add({ targets: panel, alpha: 0, duration: 220, onComplete: () => panel.forEach((o) => o.destroy()) });
          this.tweens.add({ targets: c, alpha: 0, scale: 0.85, duration: 220 });
          this.versus(new MatchNet(tr, m.roomId, m.role, m.opponent, m.gamesToWin, m.token, m.mode ?? '1v1'));
        };
        const onTimeout = () => this.noRival('No se encontró rival');
        const onError = (e: ErrorMsg) => this.noRival(e.message);
        const onDisc = () => this.noRival('Se perdió la conexión con el servidor');
        tr.on(EV.SEARCHING, onSearching as (d: never) => void);
        tr.on(EV.MATCHED, onMatched as (d: never) => void);
        tr.on(EV.TIMEOUT, onTimeout as (d: never) => void);
        tr.on(EV.ERROR, onError as (d: never) => void);
        tr.on('disconnect', onDisc as (d: never) => void);
        this.cleanup.push(() => {
          tr.off(EV.SEARCHING, onSearching as (d: never) => void);
          tr.off(EV.MATCHED, onMatched as (d: never) => void);
          tr.off(EV.TIMEOUT, onTimeout as (d: never) => void);
          tr.off(EV.ERROR, onError as (d: never) => void);
          tr.off('disconnect', onDisc as (d: never) => void);
        });
        const p = getProfile();
        tr.emit(EV.FIND, { mode: this.mode, device: riskPlayerId(), ...(this.duelKey ? { key: this.duelKey } : {}), profile: { name: p.name, level: p.level, skin: p.skin, zoneStats: p.zoneStats, charge: p.charge, color: p.color, wins: totalWins(), frame: equippedFrame(getPlayer() as PlayerState) ?? undefined, zone: getPlayer().equipped.zone } });
        this.cleanup.push(() => {
          // salir de la escena sin emparejar = cancelar la búsqueda (no queda sala fantasma)
          if (!this.matched) tr.emit(EV.CANCEL);
        });
      })
      .catch(() => this.noRival('Servidor no disponible'));
  }

  private matched = false;
  /** 2v2: el contador n/4 de la búsqueda */
  private fill: ReturnType<typeof doublesFill> | null = null;
  private title: Phaser.GameObjects.Text | null = null;
  private toMatch = false;
  private ambiente = '';

  private cancelSearch() {
    if (this.done) return;
    this.done = true;
    this.scene.start('Menu'); // el SHUTDOWN envía mm:cancel
  }

  /** Sin rival: ofrecer el BOT de siempre o volver al menú. */
  private noRival(why: string) {
    if (this.done) return;
    this.done = true;
    // (27-11-2026) duelo: sin bot; avisa y vuelve al menú
    if (this.duelKey) {
      // (27-11-2026) duelo: sin bot; avisa un momento y vuelve al menú
      const msg = why === 'No se encontró rival' ? `${(this.duelName || 'Tu amigo').toUpperCase()} NO LLEGÓ` : why.toUpperCase();
      this.title?.setText(msg);
      if (this.title && this.title.width > this.scale.width - 40) this.title.setScale((this.scale.width - 40) / this.title.width);
      this.time.delayedCall(2200, () => this.scene.start('Menu'));
      return;
    }
    if (this.mode === '2v2') {
      // (20-11-2026, usuario) 2v2 sin compañero online: NO se pregunta; el lugar que falta se llena con un bot (4/4) y se juega contra bots
      // sin servidor (o error antes de buscar): un llenado corto con bots, para que igual se vea 1/4 → 4/4
      const quick = !this.fill && this.title ? 1500 : 0;
      if (quick && this.title) this.fill = doublesFill(this, this.title, quick);
      this.time.delayedCall(quick, () => this.fill?.full());
      this.time.delayedCall(quick + 450, () => this.scene.start('Matchmaking', { ...this.fallback, skipSearch: true }));
      return;
    }
    showConfirm(this, {
      title: 'SIN RIVAL',
      message: why,
      detail: '¿Quieres iniciar una partida?',
      confirmLabel: 'JUGAR',
      cancelLabel: 'MENÚ',
      onConfirm: () => this.scene.start('Matchmaking', { ...this.fallback, skipSearch: true }), // la búsqueda online ya esperó: directo al VS
      onCancel: () => this.scene.start('Menu'),
    });
  }

  /** Emparejados: pantalla VS y partido en red. */
  private versus(net: MatchNet) {
    stopIntroMusic(this, 400); // sale el VS: la música de la búsqueda se apaga de a poco
    this.matched = true;
    const p = getProfile();
    const opp = net.opponent;
    // 2v2: opponent es tu COMPAÑERO; enfrente van 2 bots (nombres iguales en los dos teléfonos)
    const [b1, b2] = botNamesFor(net.roomId);
    const duo = net.mode === '2v2';
    showVersusScreen(
      this,
      { name: duo ? p.name + ' / ' + opp.name : p.name, level: p.level, look: playerLook(p.skin), portraitSkin: p.skin as SkinId, wins: totalWins(), color: p.color, frame: equippedFrame(getPlayer() as PlayerState) },
      // el rival con SU personaje (opponent.skin); si no se conoce, el respaldo de siempre
      duo
        ? { name: b1 + ' / ' + b2, level: Math.round((p.level + opp.level) / 2), look: lookForSkin(p.skin, 'front', p.skin), portraitSkin: rivalFor(p.skin), wins: 0, frame: null }
        : { name: opp.name, level: opp.level, look: lookForSkin(opp.skin, 'front', p.skin), portraitSkin: opp.skin as SkinId, color: charColorOf(opp.color), wins: opp.wins, frame: isFrameId(opp.frame) ? opp.frame : null }, // sus victorias y su marco, si los mandó
      // (19-11-2026) 2v2: abajo, tú y tu compañero en su entrada; arriba, los 2 bots del host (los mismos personajes que en el partido)
      duo
        ? {
            mySkin: p.skin,
            mateSkin: opp.skin,
            rivals: [rivalFor(p.skin), p.skin],
            // (19-11-2026, usuario) una card por persona: tú, tu compañero y los 2 bots del host
            cards: {
              me: { name: p.name, level: p.level, look: playerLook(p.skin) },
              mate: { name: opp.name, level: opp.level, look: playerLook(opp.skin) },
              rival1: { name: b1, level: Math.round((p.level + opp.level) / 2), look: lookForSkin(p.skin, 'front', p.skin) },
              rival2: { name: b2, level: Math.round((p.level + opp.level) / 2), look: lookForSkin(p.skin, 'front', p.skin) },
            },
          }
        : undefined,
    );
    // misma cancha y misma música en los dos teléfonos: el ambiente sale del id de la sala (el sorteo de la búsqueda era de cada teléfono)
    this.ambiente = setRoomMatchMusic(this, net.roomId, net.mode === '2v2');
    // 1 s después del sonido del VS entra la música de la cancha (sigue sonando en el partido)
    const musicIn = this.time.delayedCall(1000, () => playMatchMusic(this, this.ambiente));
    // durante la pantalla VS el rival puede irse (o caerse la conexión): se avisa y NO se entra al partido
    let toMatch: Phaser.Time.TimerEvent | null = null;
    let goingToMatch = false;
    const offEnd = net.onEnd((e) => {
      if (goingToMatch) return; // ya en camino: lo resuelve la escena del partido (recibe el aviso guardado)
      toMatch?.remove();
      musicIn.remove();
      stopMatchMusic(this, false); // partida cancelada: se calla la música (se libera al salir de la escena)
      offEnd();
      net.dispose();
      showConfirm(this, {
        title: 'PARTIDA CANCELADA',
        message: e.kind === 'disconnect' ? 'Se perdió la conexión con el servidor' : net.mode === '2v2' ? 'Tu compañero abandonó antes de empezar' : 'El rival abandonó antes de empezar',
        detail: '¿Buscar otra partida?',
        confirmLabel: 'BUSCAR',
        cancelLabel: 'MENÚ',
        onConfirm: () => (this.duelKey ? this.scene.start('Menu') : this.scene.restart({ fallback: this.fallback, mode: this.mode })),
        onCancel: () => this.scene.start('Menu'),
        depth: 9000,
      });
    });
    this.cleanup.push(() => {
      offEnd();
    });
    toMatch = this.time.delayedCall(2700 + (net.mode === '2v2' ? 200 : 0), () => {
      goingToMatch = true;
      offEnd();
      this.toMatch = true;
      // (19-11-2026, usuario) el partido se abre DEBAJO y esta pantalla VS se queda ENCIMA hasta que el servidor da la salida (los dos
      // teléfonos listos): antes se entraba al partido y se veía la cancha con los personajes quietos ~2 s antes de empezar.
      // MatchScene (netSetup) cierra esta escena con un fundido al empezar la presentación (o si el partido no llega a empezar).
      this.scene.launch('Match', { botName: opp.name, rivalLevel: opp.level, net, ambiente: this.ambiente, cover: this.scene.key, ...(net.mode === '2v2' ? { mode: '2v2' as const } : {}) });
      this.scene.bringToTop();
    });
  }
}
