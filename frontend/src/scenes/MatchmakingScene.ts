import Phaser from 'phaser';
import { getPlayer } from '../domain/playerStore';
import type { PlayerState } from '../domain/player';
import { equippedFrame } from '../domain/profileFrames';
import { FONT, restartOnResize, textStyle } from '../ui/theme';
import { UI, flatButton, stadiumBg } from '../ui/ui';
import { playerLook, rivalLook } from '../objects/Character';
import { rivalFor } from '../characters/catalog';
import { rivalLevelFor } from '../ai/BotProfile';
import { getProfile } from '../logic/Profile';
import type { SkinId } from '../characters/skins';
import { totalWins } from '../logic/Stats';
import { playMatchMusic, prepareMatchMusic, stopMatchMusic } from '../fx/matchMusic';
import { queueVersusDuoArt, showVersus as showVersusScreen } from '../ui/VersusScreen';
import { enterRanked, newMatchId, rankedView } from '../logic/Ranked';
import { LEAGUE_ORDER } from '../domain/rankedConfig';
import { preloadRankBadges } from '../ui/RankBadge';
import { doublesFill, rankedSearchPanel } from '../ui/searchPanel';
import { doublesSearchPanelNow, league2v2Id } from '../ui/PlayEntry2v2';
import { preloadSearchTimer, searchTimer, styleSearchTitle } from '../ui/searchTimer';
import { searchSpinner } from '../ui/searchSpinner';
import { startIntroMusic, stopIntroMusic } from '../fx/introMusic';
import { MAX_LEVEL } from '../config';
import type { GuidedMatch } from '../domain/tutorial';

const BOT_NAMES = ['RoboAce', 'BotNadal', 'TopSpin-3000', 'NetBot', 'Volea.exe'];
const PRACTICE_NAMES = ['Álex', 'Dani', 'Nico', 'Sam'];

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

  /** (21-11-2026) 2v2 contra bots: tú + 1 aliado BOT contra 2 rivales BOT (sin Ranked ni red) */
  private doubles = false;
  private allyName = 'Aliado';
  private rival2Name = 'Rival 2';
  private guide?: GuidedMatch;

  init(data?: { ranked?: { bet: number }; unranked?: boolean; from?: string; skipSearch?: boolean; mode?: '2v2'; guide?: GuidedMatch }) {
    this.guide = data?.guide;
    this.doubles = data?.mode === '2v2';
    {
      const names = Phaser.Utils.Array.Shuffle([...BOT_NAMES.filter((n) => n.length <= 9)]);
      this.allyName = names[0];
      this.rival2Name = names[1];
    }
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
    preloadSearchTimer(this.load);
    if (this.doubles) preloadRankBadges(this.load, [league2v2Id()], true); // (21-11-2026) emblema de tu LIGA 2V2 en la búsqueda
    if (this.doubles) queueVersusDuoArt(this.load); // (19-11-2026) entrada del equipo en la VS del 2v2
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
    this.ambiente = prepareMatchMusic(this, this.doubles);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (!this.toMatch) stopMatchMusic(this); // vuelta atrás / sin monedas: la música no sigue sonando
    });

    // tras agotarse la búsqueda online y elegir JUGAR VS BOT: directo al VS (sin la pantalla de búsqueda otra vez)
    if (this.skipSearch) {
      const rk0 = !!this.rankedBet || this.unranked;
      this.showVersus(rk0 ? this.rankedRivalName() : Phaser.Utils.Array.GetRandom(PRACTICE_NAMES));
      return;
    }

    const searching = this.add.container(W / 2, H * 0.44);

    // anillo de escaneo con la pelota en el centro (ui/searchSpinner.ts; el mismo que la búsqueda online)
    searchSpinner(this, searching, W, H);

    // Ranked: contador arriba del título y sin subtítulo (la liga ya se ve arriba)
    // (20-11-2026, usuario) el 2v2 se presenta como la búsqueda con apuesta (sus MONEDAS 2V2) y cuenta los jugadores n/4
    const rk = !!this.rankedBet || this.unranked || this.doubles;
    const label = this.add
      .text(0, rk ? 216 : 150, rk ? 'BUSCANDO RIVAL' : 'BUSCANDO PARTIDA', { fontFamily: FONT, fontSize: '40px', color: UI.text })
      .setOrigin(0.5)
      .setLetterSpacing(2);
    const sub = this.add
      .text(0, 196, 'Conectando con un rival…', textStyle(22, UI.textDim))
      .setOrigin(0.5);
    if (rk) sub.setVisible(false);
    // (21-11-2026) placa con cronómetro (assets/buscando/contador.webp) y el tiempo encima
    const timer = searchTimer(this, searching, 0, rk ? 142 : 244, 200);
    searching.add([label, sub]);
    styleSearchTitle(this, searching, label); // (21-11-2026) título con el estilo del mockup
    this.tweens.add({ targets: sub, alpha: { from: 0.4, to: 1 }, duration: 900, yoyo: true, repeat: -1 });

    let secs = 0;
    const clock = this.time.addEvent({ delay: 1000, loop: true, callback: () => timer.setText(`0:${String(++secs).padStart(2, '0')}`) });

    const cancel = flatButton(this, W / 2, H * 0.84, 300, 86, 'CANCELAR', () => this.back(), { fontSize: 34 }); // (21-11-2026, usuario) CANCELAR más grande

    // --- lógica de búsqueda (sin cambios en tiempos/estados; se pausa mientras se lee la info Ranked)
    const wait = Phaser.Math.Between(1800, 3000);
    const fill = this.doubles ? doublesFill(this, label, wait) : null;
    const ranked = this.doubles ? doublesSearchPanelNow(this) : rk ? rankedSearchPanel(this, { bet: this.rankedBet, unranked: this.unranked }, () => { found.paused = true; clock.paused = true; }, () => { found.paused = false; clock.paused = false; }) : null;
    const found = this.time.delayedCall(wait, () => {
      fill?.full(); // 2v2: el compañero bot completa la partida (4/4)
      clock.remove();
      cancel.destroy();
      if (ranked) this.tweens.add({ targets: ranked, alpha: 0, duration: 220, onComplete: () => ranked.forEach((o) => o.destroy()) });
      this.tweens.add({ targets: searching, alpha: 0, scale: 0.85, duration: 220, onComplete: () => searching.destroy() });
      this.showVersus(this.doubles ? this.rival1Name() : rk ? this.rankedRivalName() : Phaser.Utils.Array.GetRandom(BOT_NAMES));
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
      { name: this.doubles ? `${p.name} + ${this.allyName}` : p.name, level: p.level, look: playerLook(p.skin), portraitSkin: p.skin as SkinId, wins: totalWins(), color: p.color, frame: equippedFrame(getPlayer() as PlayerState) }, // tu color y tu MARCO; el rival, el suyo de siempre
      {
        name: botName,
        level: rivalLevel,
        look: rivalLook(p.skin),
        portraitSkin: rivalFor(p.skin),
        // el rival simulado también lleva victorias (proporcionales a su nivel), como un jugador real
        wins: Math.round(rivalLevel * Phaser.Math.FloatBetween(2, 5)),
        // en la Liga el rival simulado también luce un marco (de su liga o de una anterior; a veces ninguno), como un jugador real
        frame: tier >= 0 && (this.rankedBet || this.unranked) && Math.random() < 0.75 ? LEAGUE_ORDER[Phaser.Math.Between(0, tier)] : null,
      },
      // (19-11-2026) 2v2: abajo, tú y tu aliado (el otro personaje, como en el partido: rivalFor) en su entrada
      // arriba, los 2 rivales con los mismos personajes que en el partido (el 1.º: rivalFor; el 2.º: el tuyo)
      this.doubles
        ? {
            mySkin: p.skin,
            mateSkin: rivalFor(p.skin),
            rivals: [rivalFor(p.skin), p.skin],
            // (19-11-2026, usuario) una card por persona: tú, tu aliado y los 2 rivales (bots)
            cards: {
              me: { name: p.name, level: p.level, look: playerLook(p.skin) },
              mate: { name: this.allyName, level: p.level, look: rivalLook(p.skin) },
              rival1: { name: botName, level: rivalLevel, look: rivalLook(p.skin) },
              rival2: { name: this.rival2Name, level: rivalLevel, look: rivalLook(p.skin) },
            },
          }
        : undefined,
    );
    // 1 s después del sonido del VS entra la música de la cancha (sigue sonando en el partido)
    this.time.delayedCall(1000, () => playMatchMusic(this, this.ambiente));

    // transición al partido
    this.time.delayedCall(2700 + (this.doubles ? 200 : 0), () => {
      this.cameras.main.fadeOut(250, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        // Ranked: la entrada se paga justo al empezar (cancelar la búsqueda no cobra nada)
        if (this.rankedBet) {
          const res = enterRanked(newMatchId(), this.rankedBet);
          if (!res.ok) return this.back(res.error === 'not_enough_coins' ? 'No te alcanzan las monedas' : 'No se pudo entrar a la Liga');
        }
        this.toMatch = true;
        this.scene.start('Match', this.doubles ? { botName, rivalLevel, ambiente: this.ambiente, mode: '2v2', allyName: this.allyName, rival2Name: this.rival2Name } : { botName, rivalLevel, ambiente: this.ambiente, guide: this.guide });
      });
    });
  }

  /** 2v2: el nombre del rival 1 (distinto del aliado y del rival 2) */
  private rival1Name() {
    const rest = BOT_NAMES.filter((n) => n !== this.allyName && n !== this.rival2Name && n.length <= 9);
    return Phaser.Utils.Array.GetRandom(rest.length ? rest : BOT_NAMES) as string;
  }

  /** Rival Ranked: un participante (simulado) de tu tabla con una posición cercana a la tuya. */
  private rankedRivalName() {
    const v = rankedView();
    const near = v.board.filter((e) => e.bot && Math.abs(e.position - (v.position ?? 50)) <= 8);
    return (Phaser.Utils.Array.GetRandom(near.length ? near : v.board.filter((e) => e.bot)) as { name: string } | undefined)?.name ?? 'Rival';
  }
}
