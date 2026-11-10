import Phaser from 'phaser';
import { FONT, restartOnResize, textStyle } from '../ui/theme';
import { UI, flatButton, stadiumBg } from '../ui/ui';
import { playerLook, rivalLook } from '../objects/Character';
import { rivalFor } from '../characters/catalog';
import { rivalLevelFor } from '../ai/BotProfile';
import { getProfile } from '../logic/Profile';
import type { SkinId } from '../characters/skins';
import { showVersus as showVersusScreen } from '../ui/VersusScreen';
import { enterRanked, newMatchId, rankedView } from '../logic/Ranked';
import { rankDef } from '../domain/ranks';
import { LEAGUE_ORDER } from '../domain/rankedConfig';
import { RankBadge, preloadRankBadges } from '../ui/RankBadge';
import { LEAGUE_STYLE, fmtCoins } from '../ui/leagueStyle';
import { infoIcon } from '../ui/PlayEntry';
import { drawCoinIcon } from '../ui/wheelArt';

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

    const searching = this.add.container(W / 2, H * 0.44);

    // --- anillo de escaneo (dos arcos girando en sentidos opuestos)
    const ringR = 92;
    const ring = this.add.graphics();
    const drawRing = (g: Phaser.GameObjects.Graphics, r: number, col: number, from: number, len: number, lw: number) => {
      g.lineStyle(lw, col, 1).beginPath().arc(0, 0, r, from, from + len).strokePath();
    };
    searching.add(ring);
    // pulso luminoso de fondo
    const pulse = this.add.circle(0, 0, ringR, UI.electric, 0.12);
    searching.add(pulse);
    this.tweens.add({ targets: pulse, scale: 1.4, alpha: 0, duration: 1400, repeat: -1, ease: 'Quad.easeOut' });

    // pelota de tenis como detalle central
    const ball = this.add.graphics();
    ball.fillStyle(0x0a1838).fillCircle(0, 0, 30);
    ball.fillStyle(0xd7f53a).fillCircle(0, 0, 26);
    ball.lineStyle(3, 0xffffff, 0.85).beginPath().arc(-26, 0, 20, -0.9, 0.9).strokePath();
    ball.beginPath().arc(26, 0, 20, Math.PI - 0.9, Math.PI + 0.9).strokePath();
    // la pelota va dentro de un "soporte": el giro continuo es de la pelota y el movimiento del soporte
    const ballHolder = this.add.container(0, 0, [ball]);
    searching.add(ballHolder);
    this.tweens.add({ targets: ball, angle: 360, duration: 3000, repeat: -1 });
    this.ballToy(ballHolder, W, H);

    let t = 0;
    this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        t += 0.05;
        ring.clear();
        drawRing(ring, ringR, UI.cyan, t, 2.2, 4);
        drawRing(ring, ringR - 14, UI.electric, -t * 1.3, 1.6, 3);
      },
    });

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

  /**
   * Juguete para la espera: tocar la pantalla lanza la pelota del centro a un punto al azar
   * (con giro y rebote) y al rato vuelve sola al centro. No afecta a la búsqueda.
   */
  private ballToy(holder: Phaser.GameObjects.Container, W: number, H: number) {
    let back: Phaser.Time.TimerEvent | undefined;
    const onTap = (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length > 0 || !holder.active) return; // el toque es de un botón (CANCELAR)
      this.tweens.killTweensOf(holder);
      back?.remove();
      // destino aleatorio dentro de la pantalla (coordenadas locales: el centro de búsqueda está en H*0.44)
      const ang = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const dist = Phaser.Math.Between(110, Math.min(W * 0.4, 280));
      const tx = Phaser.Math.Clamp(Math.cos(ang) * dist, -W / 2 + 50, W / 2 - 50);
      const ty = Phaser.Math.Clamp(Math.sin(ang) * dist, -H * 0.44 + 80, H * 0.3);
      // estela: destello en el punto de salida
      const puff = this.add.circle(holder.parentContainer.x + holder.x, holder.parentContainer.y + holder.y, 30, 0xd7f53a, 0.5);
      this.tweens.add({ targets: puff, scale: 2.2, alpha: 0, duration: 380, onComplete: () => puff.destroy() });
      this.tweens.add({ targets: holder, x: tx, y: ty, duration: 420, ease: 'Cubic.easeOut' });
      this.tweens.add({ targets: holder, angle: holder.angle + Phaser.Math.RND.pick([-1, 1]) * 540, duration: 520, ease: 'Cubic.easeOut' });
      this.tweens.add({ targets: holder, scaleX: { from: 1.3, to: 1 }, scaleY: { from: 0.75, to: 1 }, duration: 460, ease: 'Back.easeOut' });
      back = this.time.delayedCall(1300, () => {
        if (!holder.active) return;
        this.tweens.add({ targets: holder, x: 0, y: 0, angle: 0, duration: 600, ease: 'Back.easeOut' });
      });
    };
    this.input.on('pointerdown', onTap);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.off('pointerdown', onTap));
  }

  // ---------------------------------------------------------------- VS
  /** Presentación VS (diseño en ui/VersusScreen.ts) y paso al partido. */
  private showVersus(botName: string) {
    const p = getProfile();
    // nivel REAL del rival: cerca del tuyo; define su dificultad (src/ai/BotProfile.ts). En Ranked sube con la liga.
    const tier = this.rankedBet || this.unranked ? LEAGUE_ORDER.indexOf(rankedView().league) : 0;
    const rivalLevel = Math.min(30, rivalLevelFor(p.level) + tier * 2);
    showVersusScreen(
      this,
      { name: p.name, level: p.level, look: playerLook(p.skin), portraitSkin: p.skin as SkinId },
      {
        name: botName,
        level: rivalLevel,
        look: rivalLook(p.skin),
        portraitSkin: rivalFor(p.skin),
      },
    );

    // transición al partido
    this.time.delayedCall(2700, () => {
      this.cameras.main.fadeOut(250, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        // Ranked: la entrada se paga justo al empezar (cancelar la búsqueda no cobra nada)
        if (this.rankedBet) {
          const res = enterRanked(newMatchId(), this.rankedBet);
          if (!res.ok) return this.back(res.error === 'not_enough_coins' ? 'No te alcanzan las monedas' : 'No se pudo entrar a Ranked');
        }
        this.scene.start('Match', { botName, rivalLevel });
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
    const pw = Math.min(580, W - 50);
    const ph = 120;
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
    // casillas
    const bw = (pw - 48) / 2;
    const by = py + 62;
    const box = (cx: number, lab: string, val: string, fill: number, line: number, color: string) => {
      const bg = this.add.graphics();
      bg.fillStyle(fill, 1).fillRoundedRect(cx - bw / 2, by - 34, bw, 68, 16);
      bg.lineStyle(3, line, 1).strokeRoundedRect(cx - bw / 2, by - 34, bw, 68, 16);
      bg.fillStyle(0xffffff, 0.1).fillRoundedRect(cx - bw / 2 + 6, by - 31, bw - 12, 18, 9);
      objs.push(bg);
      objs.push(this.add.text(cx, by - 18, lab, { fontFamily: FONT, fontSize: '16px', color: '#ffffff' }).setOrigin(0.5).setLetterSpacing(1));
      const t = this.add.text(0, by + 10, val, { fontFamily: FONT, fontSize: '30px', color, stroke: '#0a1638', strokeThickness: 5 }).setOrigin(0, 0.5);
      const total = t.width + 8 + 26;
      t.setX(cx - total / 2);
      const ic = this.add.graphics({ x: cx - total / 2 + t.width + 8 + 13, y: by + 10 });
      drawCoinIcon(ic, 13);
      objs.push(t, ic);
    };
    box(W / 2 - bw / 2 - 8, 'Invertido:', `−${fmtCoins(st.entry)}`, 0x5a1424, 0xff5a6a, '#ffb0b8');
    box(W / 2 + bw / 2 + 8, 'Si ganas:', `+${fmtCoins(st.prize)}`, 0x17803a, 0x7dff9a, '#ffffff');
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
