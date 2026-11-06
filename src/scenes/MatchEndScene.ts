import Phaser from 'phaser';
import { FONT } from '../ui/theme';
import { GAMES_TO_WIN, XP_LOSS, XP_WIN, xpToNext, MAX_LEVEL } from '../config';
import { addXp, getProfile } from '../logic/Profile';
import { arcadeButton } from '../ui/modeButtons';
import { fitText } from '../ui/fitText';
import { RankBadge } from '../ui/RankBadge';
import type { RankId } from '../domain/ranks';
import { resetMatchEnd } from '../fx/matchEnd';

/**
 * Overlay de fin de partido. Se lanza ENCIMA de la escena del partido (que sigue visible detrás,
 * con la cámara alejada y los personajes celebrando / decepcionados). No tiene fondo propio.
 *
 * Contenido: anuncio VICTORIA/DERROTA + ganador · marcador final real · XP (con conteo y barra)
 * · ranking (solo si llega `ranked`, p. ej. partida clasificatoria desbloqueada) · CONTINUAR / REVANCHA.
 */
export interface MatchEndData {
  win: boolean;
  surrendered?: boolean;
  playerName: string;
  rivalName: string;
  /** juegos ganados (formato actual: mejor de GAMES_TO_WIN*2-1 juegos) */
  playerGames: number;
  rivalGames: number;
  /** para REVANCHA (misma lógica que antes: reiniciar el partido con el mismo rival) */
  botName: string;
  /** clave de la escena del partido (la rellena playMatchEnd) */
  matchKey?: string;
  /** SOLO partidas clasificatorias con el competitivo desbloqueado; si no llega, no se muestra ranking */
  ranked?: { delta: number; rank: RankId; level: number; position?: number; promotedTo?: RankId };
}

const NAVY = 0x0b1733;
const NEON = 0x3a7bff;
const GOLD = 0xffc42e;

export class MatchEndScene extends Phaser.Scene {
  static readonly KEY = 'MatchEnd';
  private d!: MatchEndData;

  constructor() {
    super(MatchEndScene.KEY);
  }

  init(data: MatchEndData) {
    this.d = data;
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    const d = this.d;
    const win = d.win;

    // oscurecido ligero (el partido sigue visible)
    const dim = this.add.rectangle(0, 0, W, H, 0x02060f, 0).setOrigin(0);
    this.tweens.add({ targets: dim, fillAlpha: win ? 0.28 : 0.38, duration: 500 });
    if (win) {
      const flash = this.add.rectangle(0, 0, W, H, 0xffd76a, 0.35).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: flash, alpha: 0, duration: 600, ease: 'Quad.easeOut', onComplete: () => flash.destroy() });
    }
    // bloquea toques al partido mientras se ve el resultado
    dim.setInteractive();

    // composición: anuncio arriba · cancha y personajes al medio · panel + botones abajo (un solo bloque)
    this.banner(W, win);
    const btnH = 84;
    const btnY = H - 26 - btnH / 2;
    const panelH = d.ranked ? 236 : 182;
    const panelTop = btnY - btnH / 2 - 14 - panelH;
    this.resultPanel(W, panelTop, panelH);
    this.buttons(W, btnY, btnH);
    if (win) this.confetti(W, H);
  }

  // ---------------------------------------------------------------- anuncio
  private banner(W: number, win: boolean) {
    const cx = W / 2;
    const y = 150;
    const c = this.add.container(cx, y);

    if (win) {
      // rayos dorados giratorios detrás
      const rays = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const a2 = a + Math.PI / 22;
        const r = i % 2 ? 190 : 250;
        rays.fillStyle(GOLD, i % 2 ? 0.12 : 0.2).fillTriangle(0, 0, Math.cos(a) * r, Math.sin(a) * r, Math.cos(a2) * r, Math.sin(a2) * r);
      }
      c.add(rays);
      this.tweens.add({ targets: rays, angle: 360, duration: 14000, repeat: -1 });
    }

    // insignia: corona (victoria) o trofeo apagado (derrota)
    const icon = this.add.graphics({ y: -92 });
    if (win) {
      icon.fillStyle(0x0a1638, 1).fillCircle(0, 0, 40);
      icon.fillStyle(GOLD, 1).fillCircle(0, 0, 35);
      icon.fillStyle(0xfff1b8, 0.6).fillEllipse(-8, -14, 30, 12);
      icon.fillStyle(0x0a1638, 1).fillPoints([{ x: -20, y: 10 }, { x: -22, y: -12 }, { x: -10, y: -2 }, { x: 0, y: -18 }, { x: 10, y: -2 }, { x: 22, y: -12 }, { x: 20, y: 10 }], true);
      icon.fillStyle(0xfff1b8, 1).fillPoints([{ x: -16, y: 6 }, { x: -17, y: -6 }, { x: -9, y: 1 }, { x: 0, y: -12 }, { x: 9, y: 1 }, { x: 17, y: -6 }, { x: 16, y: 6 }], true);
    } else {
      icon.fillStyle(0x0a1638, 1).fillCircle(0, 0, 40);
      icon.fillStyle(0x4a5a7e, 1).fillCircle(0, 0, 35);
      icon.fillStyle(0xb7c2de, 1).fillRoundedRect(-14, -16, 28, 18, { tl: 2, tr: 2, bl: 12, br: 12 });
      icon.fillRect(-3, 2, 6, 8).fillRoundedRect(-11, 10, 22, 6, 2);
    }
    c.add(icon);

    const title = this.add
      .text(0, 0, win ? 'VICTORIA' : 'DERROTA', {
        fontFamily: FONT,
        fontSize: '92px',
        color: '#ffffff',
        stroke: '#0a1638',
        strokeThickness: 12,
      })
      .setOrigin(0.5)
      .setLetterSpacing(4)
      .setShadow(0, 8, '#000000', 0, true, false);
    const grad = title.context.createLinearGradient(0, 0, 0, title.height);
    if (win) {
      grad.addColorStop(0.2, '#fff6c8');
      grad.addColorStop(0.55, '#ffc42e');
      grad.addColorStop(0.9, '#e07b00');
    } else {
      grad.addColorStop(0.2, '#e6edff');
      grad.addColorStop(0.6, '#9fb3d9');
      grad.addColorStop(0.95, '#5d6f96');
    }
    title.setFill(grad);
    if (title.width > W - 60) title.setScale((W - 60) / title.width);
    c.add(title);

    // ganador en una píldora
    const winnerName = win ? this.d.playerName : this.d.rivalName;
    const label = this.add.text(0, 76, winnerName.toUpperCase(), { fontFamily: FONT, fontSize: '26px', color: win ? '#0a1638' : '#ffffff' }).setOrigin(0.5);
    fitText(label, 300);
    const pw = Math.max(200, label.displayWidth + 90);
    const pill = this.add.graphics();
    pill.fillStyle(0x0a1638, 1).fillRoundedRect(-pw / 2 - 3, 76 - 22, pw + 6, 44, 22);
    pill.fillStyle(win ? GOLD : 0xff4f5e, 1).fillRoundedRect(-pw / 2, 76 - 19, pw, 38, 19);
    pill.fillStyle(0xffffff, 0.25).fillRoundedRect(-pw / 2 + 10, 76 - 16, pw - 20, 8, 4);
    // mini corona junto al nombre del ganador
    const mc = -pw / 2 + 24;
    pill.fillStyle(win ? 0x0a1638 : 0xffffff, 1).fillPoints([{ x: mc - 9, y: 82 }, { x: mc - 10, y: 70 }, { x: mc - 4, y: 76 }, { x: mc, y: 67 }, { x: mc + 4, y: 76 }, { x: mc + 10, y: 70 }, { x: mc + 9, y: 82 }], true);
    c.add([pill, label]);

    // entrada
    c.setScale(0.4).setAlpha(0);
    this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 520, ease: 'Back.easeOut', easeParams: [2] });
    if (win) this.tweens.add({ targets: title, scale: { from: title.scale, to: title.scale * 1.04 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 600 });
  }

  // ---------------------------------------------------------------- panel de resultado (marcador + XP + ranking)
  private resultPanel(W: number, top: number, h: number) {
    const d = this.d;
    const w = Math.min(600, W - 40);
    const c = this.add.container(W / 2, top);

    // fondo: navy translúcido, borde neón y filete dorado (mismo lenguaje que los diálogos)
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.4).fillRoundedRect(-w / 2 + 3, 6, w, h, 24);
    g.lineStyle(10, NEON, 0.2).strokeRoundedRect(-w / 2, 0, w, h, 24);
    g.fillStyle(NAVY, 0.9).fillRoundedRect(-w / 2, 0, w, h, 24);
    g.fillStyle(0x1b2d5c, 0.5).fillRoundedRect(-w / 2 + 3, 3, w - 6, 44, { tl: 21, tr: 21, bl: 0, br: 0 });
    g.lineStyle(3, NEON, 1).strokeRoundedRect(-w / 2, 0, w, h, 24);
    g.lineStyle(1.5, GOLD, 0.4).strokeRoundedRect(-w / 2 + 7, 7, w - 14, h - 14, 18);
    c.add(g);

    // --- marcador: [JUGADOR]  2 - 1  [RIVAL]
    const nameStyle = { fontFamily: FONT, fontSize: '22px', stroke: '#0a1638', strokeThickness: 4 };
    const scoreY = 52;
    const sc = this.add
      .text(0, scoreY, `${d.playerGames} - ${d.rivalGames}`, { fontFamily: FONT, fontSize: '54px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 7 })
      .setOrigin(0.5);
    const side = (w - sc.width) / 2 - 36;
    const left = this.add.text(-w / 2 + 24, scoreY, d.playerName.toUpperCase(), { ...nameStyle, color: '#8fd0ff' }).setOrigin(0, 0.5);
    const right = this.add.text(w / 2 - 24, scoreY, d.rivalName.toUpperCase(), { ...nameStyle, color: '#ff9aa3' }).setOrigin(1, 0.5);
    fitText(left, side);
    fitText(right, side);
    c.add([sc, left, right]);
    const fmt = this.add.text(0, scoreY + 38, `MEJOR DE ${GAMES_TO_WIN * 2 - 1} JUEGOS`, { fontFamily: FONT, fontSize: '13px', color: '#7f93bf' }).setOrigin(0.5).setLetterSpacing(1);
    c.add(fmt);
    if (d.surrendered) {
      fmt.setX(-58);
      const tag = this.add.graphics();
      tag.fillStyle(0xc42536, 1).fillRoundedRect(36, scoreY + 26, 100, 24, 12);
      c.add(tag);
      c.add(this.add.text(86, scoreY + 38, 'RENDICIÓN', { fontFamily: FONT, fontSize: '13px', color: '#ffffff' }).setOrigin(0.5).setLetterSpacing(1));
    }

    // separador
    const sepY = 108;
    const sep = this.add.graphics();
    sep.lineStyle(2, 0x2c4a8a, 0.9).lineBetween(-w / 2 + 24, sepY, w / 2 - 24, sepY);
    c.add(sep);

    // --- XP: misma regla que antes (victoria XP_WIN, derrota/rendición XP_LOSS). Se aplica UNA vez.
    const store = d as MatchEndData & { _xp?: ReturnType<typeof addXp> };
    const gained = d.win ? XP_WIN : XP_LOSS;
    if (!store._xp) store._xp = addXp(gained);
    const res = store._xp;
    const rowY = sepY + 26;
    const xpText = this.add.text(-w / 2 + 24, rowY, '+0 XP', { fontFamily: FONT, fontSize: '26px', color: '#8fd0ff', stroke: '#0a1638', strokeThickness: 5 }).setOrigin(0, 0.5);
    const lvlText = this.add.text(w / 2 - 24, rowY, `NIVEL ${res.before.level}`, { fontFamily: FONT, fontSize: '18px', color: '#ffffff' }).setOrigin(1, 0.5);
    c.add([xpText, lvlText]);
    const bx = -w / 2 + 24;
    const bw = w - 48;
    const by = rowY + 20;
    const bh = 14;
    const track = this.add.graphics();
    track.fillStyle(0x05112c, 1).fillRoundedRect(bx, by, bw, bh, bh / 2);
    track.lineStyle(1, 0x2a4a8a, 1).strokeRoundedRect(bx, by, bw, bh, bh / 2);
    const bar = this.add.graphics();
    c.add([track, bar]);
    const drawBar = (p: number) => {
      bar.clear();
      if (p <= 0) return;
      const fw = Math.max(bh, bw * Math.min(1, p));
      bar.fillStyle(0x1f7bff, 1).fillRoundedRect(bx, by, fw, bh, bh / 2);
      bar.fillStyle(0x5fd0ff, 1).fillRoundedRect(bx, by, fw, bh * 0.5, { tl: bh / 2, tr: bh / 2, bl: 0, br: 0 });
    };
    const prog = (lv: number, xp: number) => (lv >= MAX_LEVEL ? 1 : xp / xpToNext(lv));
    drawBar(prog(res.before.level, res.before.xp));

    // conteo de XP + barra (con subida de nivel si corresponde)
    const startAt = 900;
    const count = { v: 0 };
    this.tweens.add({ targets: count, v: gained, delay: startAt, duration: 900, ease: 'Cubic.easeOut', onUpdate: () => xpText.setText(`+${Math.round(count.v)} XP`) });
    const p = { v: prog(res.before.level, res.before.xp) };
    const steps: { to: number; reset?: boolean; level?: number }[] =
      res.levelsUp > 0 ? [{ to: 1 }, { to: prog(res.after.level, res.after.xp), reset: true, level: res.after.level }] : [{ to: prog(res.after.level, res.after.xp) }];
    const run = (i: number) => {
      const s = steps[i];
      if (!s) return;
      if (s.reset) {
        p.v = 0;
        lvlText.setText(`NIVEL ${s.level}`);
        this.levelUp(W / 2, top - 26, s.level!);
      }
      this.tweens.add({ targets: p, v: s.to, duration: 700, ease: 'Cubic.easeOut', onUpdate: () => drawBar(p.v), onComplete: () => run(i + 1) });
    };
    this.time.delayedCall(startAt, () => run(0));

    // --- ranking: solo si llega (clasificatoria con competitivo desbloqueado). No se inventan puntos.
    if (d.ranked) {
      const r = d.ranked;
      const ry = by + bh + 34;
      c.add(new RankBadge(this, -w / 2 + 52, ry, { rank: r.promotedTo ?? r.rank, level: r.level, size: 56, position: r.position }));
      const sign = r.delta >= 0 ? '+' : '';
      c.add(this.add.text(-w / 2 + 92, ry, `${sign}${r.delta} PUNTOS DE RANKING`, { fontFamily: FONT, fontSize: '19px', color: r.delta >= 0 ? '#9fe8a0' : '#ff9aa3' }).setOrigin(0, 0.5));
      if (r.promotedTo) this.levelUp(W / 2, top - 26, 0, '¡ASCENSO DE RANGO!');
    }

    // entrada: sube desde abajo junto con los botones
    c.setAlpha(0).setY(top + 60);
    this.tweens.add({ targets: c, alpha: 1, y: top, duration: 460, delay: 350, ease: 'Cubic.easeOut' });
  }


  /** Celebración breve: texto dorado con destello. */
  private levelUp(x: number, y: number, level: number, text?: string) {
    const t = this.add
      .text(x, y, text ?? `¡SUBISTE A NIVEL ${level}!`, { fontFamily: FONT, fontSize: '30px', color: '#ffd23f', stroke: '#0a1638', strokeThickness: 6 })
      .setOrigin(0.5)
      .setScale(0)
      .setDepth(10);
    const burst = this.add.circle(x, y, 40, GOLD, 0.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(9);
    this.tweens.add({ targets: burst, scale: 4, alpha: 0, duration: 600, onComplete: () => burst.destroy() });
    this.tweens.add({ targets: t, scale: 1, duration: 420, ease: 'Back.easeOut' });
  }

  // ---------------------------------------------------------------- botones
  private buttons(W: number, y: number, bh: number) {
    const d = this.d;
    const gap = 16;
    const bw = (Math.min(600, W - 40) - gap) / 2;
    const x0 = W / 2 - (bw + gap) / 2;
    const x1 = W / 2 + (bw + gap) / 2;
    const matchKey = d.matchKey ?? 'Match';

    const cont = arcadeButton(this, x0, y, bw, bh, 'CONTINUAR', () => {
      resetMatchEnd(this.scene.get(matchKey));
      this.scene.stop(matchKey);
      this.scene.start('Menu');
    }, { palette: 'yellow' });
    // REVANCHA: misma lógica que ya existía (reiniciar el partido con el mismo rival)
    const again = arcadeButton(this, x1, y, bw, bh, 'REVANCHA', () => {
      resetMatchEnd(this.scene.get(matchKey));
      this.scene.start(matchKey, { botName: d.botName });
    }, { palette: 'blue' });
    for (const [b, delay] of [[cont, 550], [again, 620]] as const) {
      b.setAlpha(0).setY(y + 40);
      this.tweens.add({ targets: b, alpha: 1, y, duration: 380, delay, ease: 'Back.easeOut' });
    }
  }

  // ---------------------------------------------------------------- confeti (solo victoria)
  private confetti(W: number, H: number) {
    const colors = [GOLD, 0xff4f5e, NEON, 0x62d935, 0xffffff];
    for (let i = 0; i < 40; i++) {
      const r = this.add.rectangle(Phaser.Math.Between(0, W), Phaser.Math.Between(-H * 0.6, -20), Phaser.Math.Between(8, 14), Phaser.Math.Between(12, 20), Phaser.Utils.Array.GetRandom(colors));
      this.tweens.add({
        targets: r,
        y: H + 40,
        x: r.x + Phaser.Math.Between(-120, 120),
        angle: Phaser.Math.Between(-540, 540),
        duration: Phaser.Math.Between(2600, 4600),
        delay: Phaser.Math.Between(0, 1200),
        onComplete: () => r.destroy(),
      });
    }
  }
}

/** Nombre del jugador para el overlay (perfil real). */
export function playerDisplayName() {
  return getProfile().name;
}
