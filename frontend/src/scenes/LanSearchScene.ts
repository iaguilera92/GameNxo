import Phaser from 'phaser';
import { FONT, restartOnResize } from '../ui/theme';
import { searchSpinner } from '../ui/searchSpinner';
import { UI, flatButton, stadiumBg } from '../ui/ui';
import { showConfirm } from '../ui/ConfirmDialog';
import { totalWins } from '../logic/Stats';
import { playMatchMusic, prepareMatchMusic, stopMatchMusic } from '../fx/matchMusic';
import { showVersus as showVersusScreen } from '../ui/VersusScreen';
import { lookForSkin, playerLook } from '../objects/Character';
import type { SkinId } from '../characters/skins';
import { getProfile } from '../logic/Profile';
import { charColorOf } from '../domain/charColors';
import { connect } from '../net/NetClient';
import { MatchNet } from '../net/MatchNet';
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
}

export class LanSearchScene extends Phaser.Scene {
  private fallback: Record<string, unknown> = {};
  private done = false;
  private cleanup: (() => void)[] = [];

  constructor() {
    super('LanSearch');
  }

  init(data: LanSearchData) {
    this.fallback = data?.fallback ?? {};
    this.done = false;
    this.matched = false;
    this.cleanup = [];
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    restartOnResize(this);
    this.cameras.main.fadeIn(200, 0, 0, 0);
    stadiumBg(this, 0.55);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup.forEach((f) => f()));
    // ambiente del próximo partido elegido ya: su música se carga mientras se busca y suena desde el VS
    this.toMatch = false;
    this.ambiente = prepareMatchMusic(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (!this.toMatch) stopMatchMusic(this); // búsqueda cancelada / sin rival: la música no sigue sonando
    });

    // mismo aspecto que la búsqueda contra el BOT (MatchmakingScene): anillo con la pelota, reloj encima del título
    const c = this.add.container(W / 2, H * 0.44);
    searchSpinner(this, c, W, H);
    const title = this.add.text(0, 196, 'BUSCANDO RIVAL', { fontFamily: FONT, fontSize: '40px', color: UI.text }).setOrigin(0.5).setLetterSpacing(2);
    const count = this.add.text(0, 148, '0:00', { fontFamily: FONT, fontSize: '30px', color: '#37e0ff' }).setOrigin(0.5);
    c.add([title, count]);
    const cancel = flatButton(this, W / 2, H * 0.84, 240, 72, 'CANCELAR', () => this.cancelSearch(), { fontSize: 28 });

    connect()
      .then((tr) => {
        if (this.done || !this.scene.isActive()) return;
        const onSearching = (m: SearchingMsg) => {
          title.setText('BUSCANDO RIVAL 1/2'); // jugadores en la sala
          // cuenta atrás visual; el tiempo real lo controla el servidor (mm:timeout)
          const end = this.time.now + m.timeoutMs;
          const tick = () => count.setText(`0:${String(Math.max(0, Math.ceil((end - this.time.now) / 1000))).padStart(2, '0')}`);
          tick();
          this.time.addEvent({ delay: 100, repeat: Math.ceil(m.timeoutMs / 100), callback: tick });
        };
        const onMatched = (m: MatchedMsg) => {
          if (this.done) return;
          this.done = true;
          cancel.destroy();
          this.tweens.add({ targets: c, alpha: 0, scale: 0.85, duration: 220 });
          this.versus(new MatchNet(tr, m.roomId, m.role, m.opponent, m.gamesToWin));
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
        tr.emit(EV.FIND, { profile: { name: p.name, level: p.level, skin: p.skin, zoneStats: p.zoneStats, charge: p.charge, color: p.color } });
        this.cleanup.push(() => {
          // salir de la escena sin emparejar = cancelar la búsqueda (no queda sala fantasma)
          if (!this.matched) tr.emit(EV.CANCEL);
        });
      })
      .catch(() => this.noRival('Servidor no disponible'));
  }

  private matched = false;
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
    showConfirm(this, {
      title: 'SIN RIVAL',
      message: why,
      detail: '¿Quieres jugar contra el BOT?',
      confirmLabel: 'JUGAR VS BOT',
      cancelLabel: 'MENÚ',
      onConfirm: () => this.scene.start('Matchmaking', this.fallback),
      onCancel: () => this.scene.start('Menu'),
    });
  }

  /** Emparejados: pantalla VS y partido en red. */
  private versus(net: MatchNet) {
    this.matched = true;
    const p = getProfile();
    const opp = net.opponent;
    showVersusScreen(
      this,
      { name: p.name, level: p.level, look: playerLook(p.skin), portraitSkin: p.skin as SkinId, wins: totalWins(), color: p.color },
      // el rival con SU personaje (opponent.skin); si no se conoce, el respaldo de siempre
      { name: opp.name, level: opp.level, look: lookForSkin(opp.skin, 'front', p.skin), portraitSkin: opp.skin as SkinId, color: charColorOf(opp.color) },
    );
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
        message: e.kind === 'disconnect' ? 'Se perdió la conexión con el servidor' : 'El rival abandonó antes de empezar',
        detail: '¿Buscar otra partida?',
        confirmLabel: 'BUSCAR',
        cancelLabel: 'MENÚ',
        onConfirm: () => this.scene.restart({ fallback: this.fallback }),
        onCancel: () => this.scene.start('Menu'),
        depth: 9000,
      });
    });
    this.cleanup.push(() => {
      offEnd();
    });
    toMatch = this.time.delayedCall(2700, () => {
      goingToMatch = true;
      offEnd();
      this.cameras.main.fadeOut(250, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.toMatch = true;
        this.scene.start('Match', { botName: opp.name, rivalLevel: opp.level, net, ambiente: this.ambiente });
      });
    });
  }
}
