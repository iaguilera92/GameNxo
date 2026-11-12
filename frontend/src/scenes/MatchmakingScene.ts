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
import { rankDef } from '../domain/ranks';
import { LEAGUE_ORDER } from '../domain/rankedConfig';
import { RankBadge, preloadRankBadges } from '../ui/RankBadge';
import { LEAGUE_STYLE, fmtCoins } from '../ui/leagueStyle';
import { infoIcon } from '../ui/PlayEntry';
import { drawCoinIcon } from '../ui/wheelArt';
import { searchSpinner } from '../ui/searchSpinner';
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

  init(data?: { ranked?: { bet: number }; unranked?: boolean; from?: string }) {
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
    this.cameras.main.fadeIn(200, 0, 0, 0);
    stadiumBg(this, 0.55);
    // ambiente del próximo partido elegido ya: su música se carga mientras se busca y suena desde el VS
    this.toMatch = false;
    this.ambiente = prepareMatchMusic(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (!this.toMatch) stopMatchMusic(this); // vuelta atrás / sin monedas: la música no sigue sonando
    });

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
    const ranked = rk ? this.rankedPanel(W, H, () => { found.paused = true; clock.paused = true; }, () => { found.paused = false; clock.paused = false; }) : null;
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

  /**
   * Ranked: liga arriba (emblema + nombre) y, bajo el contador, la apuesta ("🪙 500 x1" + info),
   * lo que se gana si se gana y lo que se descuenta al empezar.
   */
  private rankedPanel(W: number, H: number, onInfoOpen: () => void, onInfoClose: () => void): Phaser.GameObjects.GameObject[] {
    const v = rankedView();
    const bet = this.rankedBet ?? 1;
    const st = v.stakes.find((s) => s.bet === bet) ?? v.stakes[0];
    const ls = LEAGUE_STYLE[v.league];
    const objs: Phaser.GameObjects.GameObject[] = [];
    // liga
    const topY = Math.max(110, H * 0.44 - 92 - 150);
    objs.push(new RankBadge(this, W / 2, topY, { rank: v.league, level: 99, size: 120 }));
    objs.push(this.add.text(W / 2, topY + 78, `LIGA ${rankDef(v.league).name.toUpperCase()}`, { fontFamily: FONT, fontSize: '26px', color: ls.css, stroke: '#0a1638', strokeThickness: 6 }).setOrigin(0.5).setLetterSpacing(2));
    const py = H * 0.44 + 262;
    if (this.unranked) return [...objs, ...this.unrankedPanel(W, py, onInfoOpen, onInfoClose)];
    // apuesta: cinta "ESTAMOS APOSTANDO", píldora + (i) y dos casillas INVERTIDO / SI GANAS
    const pw = Math.min(620, W - 40);
    const ph = 168;
    const col = bet > 1 ? 0xff4f5e : 0xffc42e;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.35).fillRoundedRect(W / 2 - pw / 2 + 3, py + 6, pw, ph, 22);
    g.lineStyle(10, col, 0.18).strokeRoundedRect(W / 2 - pw / 2, py, pw, ph, 22);
    g.fillStyle(0x0b1733, 0.95).fillRoundedRect(W / 2 - pw / 2, py, pw, ph, 22);
    g.fillStyle(0x1b2d5c, 0.5).fillRoundedRect(W / 2 - pw / 2 + 3, py + 3, pw - 6, ph * 0.4, { tl: 19, tr: 19, bl: 0, br: 0 });
    g.lineStyle(3, col, 1).strokeRoundedRect(W / 2 - pw / 2, py, pw, ph, 22);
    // cinta
    const rw = 270;
    g.fillStyle(0x7a4a00, 1).fillRoundedRect(W / 2 - rw / 2, py - 18, rw, 36, 18);
    g.fillStyle(bet > 1 ? 0xff4f5e : 0xffc42e, 1).fillRoundedRect(W / 2 - rw / 2 + 2, py - 16, rw - 4, 32, 16);
    g.fillStyle(0xffffff, 0.35).fillRoundedRect(W / 2 - rw / 2 + 12, py - 13, rw - 24, 8, 4);
    objs.push(g);
    objs.push(this.add.text(W / 2, py, bet > 1 ? 'ESTAMOS APOSTANDO x2' : 'ESTAMOS APOSTANDO', { fontFamily: FONT, fontSize: '18px', color: bet > 1 ? '#ffffff' : '#3a2200' }).setOrigin(0.5).setLetterSpacing(2));
    // (el monto ya se ve en INVERTIDO: sin píldora repetida; la info va junto a la cinta)
    objs.push(infoIcon(this, W / 2 + rw / 2 + 24, py, 15, undefined, { onOpen: onInfoOpen, onClose: onInfoClose }));
    // casillas (más grandes y notorias; el PREMIO late para llamar la atención)
    const bw = (pw - 44) / 2;
    const bh = 112;
    const by = py + 34 + bh / 2;
    const box = (cx: number, lab: string, val: string, fill: number, line: number, color: string, glow: boolean) => {
      if (glow) {
        // halo que late detrás del premio
        const halo = this.add.graphics();
        halo.lineStyle(12, line, 0.35).strokeRoundedRect(cx - bw / 2, by - bh / 2, bw, bh, 18);
        objs.push(halo);
        this.tweens.add({ targets: halo, alpha: { from: 1, to: 0.25 }, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
      const bg = this.add.graphics();
      bg.fillStyle(0x000000, 0.3).fillRoundedRect(cx - bw / 2 + 3, by - bh / 2 + 5, bw, bh, 18);
      bg.fillStyle(fill, 1).fillRoundedRect(cx - bw / 2, by - bh / 2, bw, bh, 18);
      bg.fillStyle(0xffffff, 0.1).fillRoundedRect(cx - bw / 2 + 6, by - bh / 2 + 4, bw - 12, bh * 0.36, { tl: 14, tr: 14, bl: 6, br: 6 });
      bg.lineStyle(4, line, 1).strokeRoundedRect(cx - bw / 2, by - bh / 2, bw, bh, 18);
      objs.push(bg);
      objs.push(this.add.text(cx, by - bh / 2 + 22, lab, { fontFamily: FONT, fontSize: '21px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 4 }).setOrigin(0.5).setLetterSpacing(1));
      const t = this.add.text(0, by + 16, val, { fontFamily: FONT, fontSize: '42px', color, stroke: '#0a1638', strokeThickness: 6 }).setOrigin(0, 0.5);
      const iconR = 18;
      const total = t.width + 10 + iconR * 2;
      // que la cifra no se salga de la casilla
      if (total > bw - 16) t.setScale((bw - 16 - 10 - iconR * 2) / t.width);
      const tw = t.displayWidth + 10 + iconR * 2;
      t.setX(cx - tw / 2);
      const ic = this.add.graphics({ x: cx - tw / 2 + t.displayWidth + 10 + iconR, y: by + 16 });
      drawCoinIcon(ic, iconR);
      objs.push(t, ic);
    };
    box(W / 2 - bw / 2 - 8, 'Invertido:', `−${fmtCoins(st.entry)}`, 0x5a1424, 0xff5a6a, '#ffb0b8', false);
    box(W / 2 + bw / 2 + 8, 'Premio:', `+${fmtCoins(st.prize)}`, 0x17803a, 0x7dff9a, '#ffffff', true);
    return objs;
  }

  /** AMISTOSO: cinta gris, aviso de que no hay apuesta y lo que sí se gana (EXP y ruleta). */
  private unrankedPanel(W: number, py: number, onInfoOpen: () => void, onInfoClose: () => void): Phaser.GameObjects.GameObject[] {
    const objs: Phaser.GameObjects.GameObject[] = [];
    const pw = Math.min(580, W - 50);
    const ph = 190;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.35).fillRoundedRect(W / 2 - pw / 2 + 3, py + 6, pw, ph, 22);
    g.fillStyle(0x0b1733, 0.95).fillRoundedRect(W / 2 - pw / 2, py, pw, ph, 22);
    g.lineStyle(3, 0x8d99b5, 1).strokeRoundedRect(W / 2 - pw / 2, py, pw, ph, 22);
    const rw = 200;
    g.fillStyle(0x232a3b, 1).fillRoundedRect(W / 2 - rw / 2, py - 18, rw, 36, 18);
    g.fillStyle(0x8d99b5, 1).fillRoundedRect(W / 2 - rw / 2 + 2, py - 16, rw - 4, 32, 16);
    objs.push(g);
    objs.push(this.add.text(W / 2, py, 'AMISTOSO', { fontFamily: FONT, fontSize: '18px', color: '#1a2033' }).setOrigin(0.5).setLetterSpacing(2));
    const t = this.add.text(W / 2, py + 50, 'Juegas sin apostar: no ganas monedas de apuesta', { fontFamily: FONT, fontSize: '18px', color: '#cfd8ee' }).setOrigin(0.5);
    objs.push(t);
    objs.push(infoIcon(this, W / 2 + t.width / 2 + 24, py + 50, 14, undefined, { onOpen: onInfoOpen, onClose: onInfoClose, unranked: true }));
    const bw = (pw - 48) / 2;
    const by = py + 128;
    const box = (cx: number, lab: string, val: string) => {
      const bg = this.add.graphics();
      bg.fillStyle(0x0f2a1c, 1).fillRoundedRect(cx - bw / 2, by - 34, bw, 68, 16);
      bg.lineStyle(2, 0x2a7a46, 1).strokeRoundedRect(cx - bw / 2, by - 34, bw, 68, 16);
      objs.push(bg);
      objs.push(this.add.text(cx, by - 18, lab, { fontFamily: FONT, fontSize: '15px', color: '#9fb4e0' }).setOrigin(0.5).setLetterSpacing(2));
      objs.push(this.add.text(cx, by + 10, val, { fontFamily: FONT, fontSize: '26px', color: '#7dff9a', stroke: '#0a1638', strokeThickness: 4 }).setOrigin(0.5));
    };
    box(W / 2 - bw / 2 - 8, 'GANAS', 'EXP ✓');
    box(W / 2 + bw / 2 + 8, 'Y TAMBIÉN', 'RULETA ✓');
    return objs;
  }

  /** Rival Ranked: un participante (simulado) de tu tabla con una posición cercana a la tuya. */
  private rankedRivalName() {
    const v = rankedView();
    const near = v.board.filter((e) => e.bot && Math.abs(e.position - (v.position ?? 50)) <= 8);
    return (Phaser.Utils.Array.GetRandom(near.length ? near : v.board.filter((e) => e.bot)) as { name: string } | undefined)?.name ?? 'Rival';
  }
}
