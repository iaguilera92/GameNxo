import Phaser from 'phaser';
import { FONT, restartOnResize, textStyle } from '../ui/theme';
import { UI, flatButton, stadiumBg } from '../ui/ui';
import { playerLook, rivalLook } from '../objects/Character';
import { rivalFor } from '../characters/catalog';
import { rivalLevelFor } from '../ai/BotProfile';
import { getProfile } from '../logic/Profile';
import type { SkinId } from '../characters/skins';
import { totalWins } from '../logic/Stats';
import { playMatchMusic, prepareMatchMusic, stopMatchMusic } from '../fx/matchMusic';
import { showVersus as showVersusScreen } from '../ui/VersusScreen';
import { enterRanked, newMatchId, rankedView } from '../logic/Ranked';
import { LEAGUE_ORDER } from '../domain/rankedConfig';
import { preloadRankBadges } from '../ui/RankBadge';
import { rankedSearchPanel } from '../ui/searchPanel';
import { searchSpinner } from '../ui/searchSpinner';
import { startIntroMusic, stopIntroMusic } from '../fx/introMusic';
import { MAX_LEVEL } from '../config';

const BOT_NAMES = ['RoboAce', 'BotNadal', 'TopSpin-3000', 'NetBot', 'Volea.exe'];

/** "Buscando partida..." (presentación competitiva) y pantalla VS antes del partido. */
export class MatchmakingScene extends Phaser.Scene {
  /** partida Ranked: apuesta elegida (la entrada se paga al empezar el partido, no al buscar) */
  private rankedBet: number | null = null;

  constructor() {
    super('Matchmaking');
  }

  /** escena desde la que se pidió la partida (CANCELAR / error vuelven ahí) */
  private from = 'Menu';

  /** AMISTOSO: sin monedas para la entrada; rival de Ranked igual, sin apuesta (EXP y ruleta sí) */
  private unranked = false;

  /** viene de una búsqueda ONLINE que ya se agotó (LanSearchScene): pasa directo a la pantalla VS, sin buscar otra vez */
  private skipSearch = false;

  init(data?: { ranked?: { bet: number }; unranked?: boolean; from?: string; skipSearch?: boolean }) {
    this.skipSearch = !!data?.skipSearch;
    this.rankedBet = data?.ranked?.bet ?? null;
    this.unranked = !this.rankedBet && !!data?.unranked;
    this.from = data?.from ?? 'Menu';
  }

  /** se va al partido (la música del VS sigue); si no, al salir se para */
  private toMatch = false;
  /** ambiente del próximo partido (elegido al empezar la búsqueda para cargar ya su música) */
  private ambiente = '';

  /** Vuelve a donde se pidió la partida (Menú o Ranked). */
  private back(toast?: string) {
    this.scene.start(this.from, toast ? { toast } : undefined);
  }

  preload() {
    if (!this.textures.exists('menu-bg')) this.load.image('menu-bg', 'assets/menu-bg.webp');
    if (this.rankedBet || this.unranked) preloadRankBadges(this.load, [rankedView().league]);
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    restartOnResize(this);
    startIntroMusic(this); // la música del menú SIGUE durante la búsqueda (se corta al salir el VS); si no sonaba, arranca
    this.cameras.main.fadeIn(200, 0, 0, 0);
    stadiumBg(this, 0.55);
    // ambiente del próximo partido elegido ya: su música se carga mientras se busca y suena desde el VS
    this.toMatch = false;
    this.ambiente = prepareMatchMusic(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (!this.toMatch) stopMatchMusic(this); // vuelta atrás / sin monedas: la música no sigue sonando
    });

    // tras agotarse la búsqueda online y elegir JUGAR VS BOT: directo al VS (sin la pantalla de búsqueda otra vez)
    if (this.skipSearch) {
      const rk0 = !!this.rankedBet || this.unranked;
      this.showVersus(rk0 ? this.rankedRivalName() : Phaser.Utils.Array.GetRandom(BOT_NAMES));
      return;
    }

    const searching = this.add.container(W / 2, H * 0.44);

    // anillo de escaneo con la pelota en el centro (ui/searchSpinner.ts; el mismo que la búsqueda online)
    searchSpinner(this, searching, W, H);

    // Ranked: contador arriba del título y sin subtítulo (la liga ya se ve arriba)
    const rk = !!this.rankedBet || this.unranked;
    const label = this.add
      .text(0, rk ? 196 : 150, rk ? 'BUSCANDO RIVAL' : 'BUSCANDO PARTIDA', { fontFamily: FONT, fontSize: '40px', color: UI.text })
      .setOrigin(0.5)
      .setLetterSpacing(2);
    const sub = this.add
      .text(0, 196, 'Conectando con un rival…', textStyle(22, UI.textDim))
      .setOrigin(0.5);
    if (rk) sub.setVisible(false);
    const timer = this.add.text(0, rk ? 148 : 244, '0:00', { fontFamily: FONT, fontSize: '30px', color: '#37e0ff' }).setOrigin(0.5);
    searching.add([label, sub, timer]);
    this.tweens.add({ targets: sub, alpha: { from: 0.4, to: 1 }, duration: 900, yoyo: true, repeat: -1 });

    let secs = 0;
    const clock = this.time.addEvent({ delay: 1000, loop: true, callback: () => timer.setText(`0:${String(++secs).padStart(2, '0')}`) });

    const cancel = flatButton(this, W / 2, H * 0.84, 240, 72, 'CANCELAR', () => this.back(), { fontSize: 28 });

    // --- lógica de búsqueda (sin cambios en tiempos/estados; se pausa mientras se lee la info Ranked)
    const wait = Phaser.Math.Between(1800, 3000);
    const ranked = rk ? rankedSearchPanel(this, { bet: this.rankedBet, unranked: this.unranked }, () => { found.paused = true; clock.paused = true; }, () => { found.paused = false; clock.paused = false; }) : null;
    const found = this.time.delayedCall(wait, () => {
      clock.remove();
      cancel.destroy();
      if (ranked) this.tweens.add({ targets: ranked, alpha: 0, duration: 220, onComplete: () => ranked.forEach((o) => o.destroy()) });
      this.tweens.add({ targets: searching, alpha: 0, scale: 0.85, duration: 220, onComplete: () => searching.destroy() });
      this.showVersus(rk ? this.rankedRivalName() : Phaser.Utils.Array.GetRandom(BOT_NAMES));
    });
  }

  // ---------------------------------------------------------------- VS
  /** Presentación VS (diseño en ui/VersusScreen.ts) y paso al partido. */
  private showVersus(botName: string) {
    stopIntroMusic(this, 400); // sale el VS: la música de la búsqueda se apaga de a poco
    const p = getProfile();
    // nivel REAL del rival: cerca del tuyo; define su dificultad (src/ai/BotProfile.ts). En Ranked sube con la liga.
    const tier = this.rankedBet || this.unranked ? LEAGUE_ORDER.indexOf(rankedView().league) : 0;
    const rivalLevel = Math.min(MAX_LEVEL, rivalLevelFor(p.level) + tier * 2);
    showVersusScreen(
      this,
      { name: p.name, level: p.level, look: playerLook(p.skin), portraitSkin: p.skin as SkinId, wins: totalWins(), color: p.color }, // tu color; el rival, el suyo de siempre
      {
        name: botName,
        level: rivalLevel,
        look: rivalLook(p.skin),
        portraitSkin: rivalFor(p.skin),
      },
    );
    // 1 s después del sonido del VS entra la música de la cancha (sigue sonando en el partido)
    this.time.delayedCall(1000, () => playMatchMusic(this, this.ambiente));

    // transición al partido
    this.time.delayedCall(2700, () => {
      this.cameras.main.fadeOut(250, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        // Ranked: la entrada se paga justo al empezar (cancelar la búsqueda no cobra nada)
        if (this.rankedBet) {
          const res = enterRanked(newMatchId(), this.rankedBet);
          if (!res.ok) return this.back(res.error === 'not_enough_coins' ? 'No te alcanzan las monedas' : 'No se pudo entrar a Ranked');
        }
        this.toMatch = true;
        this.scene.start('Match', { botName, rivalLevel, ambiente: this.ambiente });
      });
    });
  }

  /** Rival Ranked: un participante (simulado) de tu tabla con una posición cercana a la tuya. */
  private rankedRivalName() {
    const v = rankedView();
    const near = v.board.filter((e) => e.bot && Math.abs(e.position - (v.position ?? 50)) <= 8);
    return (Phaser.Utils.Array.GetRandom(near.length ? near : v.board.filter((e) => e.bot)) as { name: string } | undefined)?.name ?? 'Rival';
  }
}
