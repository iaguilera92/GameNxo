import Phaser from 'phaser';
import { FONT } from '../ui/theme';
import { COINS_LOSS, COINS_SURRENDER, COINS_WIN, XP_LOSS, XP_WIN, xpToNext, MAX_LEVEL } from '../config';
import { addCoins, addXp, getProfile } from '../logic/Profile';
import { applyCharColor } from '../fx/CharColorFx';
import { arcadeButton } from '../ui/modeButtons';
import { fitText } from '../ui/fitText';
import type { RankId } from '../domain/ranks';
import { resetMatchEnd } from '../fx/matchEnd';
import { markWheelPresented, recordMatchWin, wheelToPresent, wheelStatuses } from '../logic/Wheels';
import { openWheel, whenWheelReady } from './WheelScene';
import { drawWheelFace, drawXpIcon } from '../ui/wheelArt';
import { WHEEL } from '../domain/wheelConfig';
import { getPlayer } from '../domain/playerStore';
import { myLeague, myPosition, rankedState, settleCurrentRanked } from '../logic/Ranked';
import { matchStakes } from '../domain/rankedConfig';
import { isDevMode } from '../domain/devMode';
import { recordWin } from '../logic/Stats';
import { showInterstitial } from '../ads/ads';
import type { EndClip } from '../objects/NxoActor';

type DuelClips = { idle: EndClip; victory: EndClip; defeat: EndClip };
/** Lo que muestran los dos cuadros del duelo: entrada de cada uno, bolsa y cambio neto. `demo` = solo visual (sin monedas). */
type Duel = { entry: number; pot: number; delta: number; demo: boolean };

/** Id único de partida (ruletas: cada partida se cuenta una sola vez). */
function newMatchId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  const a = new Uint32Array(4);
  c?.getRandomValues?.(a);
  return `m-${Date.now().toString(36)}-${[...a].map((x) => x.toString(36)).join('')}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Overlay de fin de partido. Se lanza ENCIMA de la escena del partido (que sigue visible detrás,
 * con la cámara alejada y los personajes celebrando / decepcionados). No tiene fondo propio.
 *
 * Contenido: anuncio VICTORIA/DERROTA + ganador · marcador final real · XP (con conteo y barra)
 * · ranking (solo si llega `ranked`, p. ej. partida clasificatoria desbloqueada) · CONTINUAR / REVANCHA.
 */
export interface MatchEndData {
  /** pose final de cada lado (textura + frame), para el duelo Ranked */
  poses?: { me?: { key: string; frame: number }; rival?: { key: string; frame: number } };
  /** clips DE FRENTE de cada lado (reposo en bucle; luego victoria o derrota) con su ancla y alto de pie (NxoActor.endClips) */
  clips?: { me?: DuelClips; rival?: DuelClips };
  win: boolean;
  surrendered?: boolean;
  playerName: string;
  rivalName: string;
  /** juegos ganados (formato actual: mejor de GAMES_TO_WIN*2-1 juegos) */
  playerGames: number;
  rivalGames: number;
  /** para REVANCHA (misma lógica que antes: reiniciar el partido con el mismo rival) */
  botName: string;
  /** nivel del rival: la revancha es contra el mismo rival (misma dificultad) */
  rivalLevel?: number;
  /** partido en red (multijugador 1v1): REVANCHA vuelve a buscar rival */
  lan?: boolean;
    /** clave de la escena del partido (la rellena playMatchEnd) */
  matchKey?: string;
  /**
   * SOLO partidas Ranked. Lo rellena esta escena al liquidar la partida pendiente (logic/Ranked.ts):
   * el partido (MatchScene) no necesita saber nada de Ranked. `delta` = monedas netas (premio − entrada).
   */
  ranked?: { delta: number; rank: RankId; level: number; position?: number; promotedTo?: RankId; bet?: number; entry?: number; pot?: number };
}

const NAVY = 0x0b1733;
const NEON = 0x3a7bff;
const GOLD = 0xffc42e;
/** alto de los 3 cuadros de recompensa (monedas · EXP · ruleta) */
const CARD_H = 196;
/** alto extra del panel con el duelo de apuestas Ranked */
const RANKED_H = 286;
/** alto de los cuadros de los personajes del duelo */
const DUEL_BOX_H = 224;
/** cuadro del duelo cuando se decide: ganador en verde (ganó monedas), perdedor en rojo suave */
const DUEL_WIN = { fill: 0x0f3a24, line: 0x3fd46a, text: '#9fe8a0' };
const DUEL_LOSE = { fill: 0x3a1620, line: 0xd9707a, text: '#ffb3ba' };

/** Moneda dibujada (sin imagen): disco dorado con canto, brillo y una corona. */
function drawCoin(g: Phaser.GameObjects.Graphics, r: number) {
  g.fillStyle(0x0a1638, 1).fillCircle(0, 0, r + 2.5);
  g.fillStyle(0xd99400, 1).fillCircle(0, 1.5, r);
  g.fillStyle(GOLD, 1).fillCircle(0, 0, r);
  g.lineStyle(Math.max(1.5, r * 0.14), 0xfff1b8, 0.9).strokeCircle(0, 0, r * 0.68);
  const k = r / 14;
  g.fillStyle(0xd99400, 1).fillPoints(
    [{ x: -6 * k, y: 4 * k }, { x: -7 * k, y: -4 * k }, { x: -3 * k, y: 0 }, { x: 0, y: -6 * k }, { x: 3 * k, y: 0 }, { x: 7 * k, y: -4 * k }, { x: 6 * k, y: 4 * k }],
    true,
  );
  g.fillStyle(0xffffff, 0.55).fillEllipse(-r * 0.35, -r * 0.42, r * 0.7, r * 0.32);
}

/**
 * Poses de la tarjeta de resultado de MAI de frente, cortadas de su hoja nueva (tools/build-end-poses.mjs): la hoja de
 * frente que usa el partido es la antigua, sin derrota y con la raqueta en la otra mano.
 */
const MAI_END = { dir: 'assets/characters/mai-front-end', cell: { w: 192, h: 128 }, clips: { idle: { fps: 9, loop: true }, victory: { fps: 10, loop: false }, defeat: { fps: 10, loop: false } } } as const;
const maiEndKey = (c: keyof typeof MAI_END.clips) => `mai-front-end-${c}`;

/** Clips de la tarjeta: los del personaje, salvo MAI de frente, que usa sus poses nuevas (si cargaron). */
function endPosesFor(scene: Phaser.Scene, clips?: DuelClips): DuelClips | undefined {
  if (!clips || !clips.idle.key.startsWith('mai-front')) return clips;
  const k = (c: keyof typeof MAI_END.clips): EndClip | null => {
    const key = maiEndKey(c);
    return scene.textures.exists(key) && scene.anims.exists(key) ? { key, last: 7, origin: { x: 0.5, y: 1 }, standHeight: MAI_END.cell.h } : null;
  };
  const idle = k('idle');
  if (!idle) return clips;
  return { idle, victory: k('victory') ?? idle, defeat: k('defeat') ?? idle };
}

/**
 * Derrota que se QUEDA abajo: algunas hojas (NXO de frente) bajan y luego vuelven a la pose de pie, así que su último
 * frame no parece una derrota. Se mide el alto de la silueta de cada frame y, si el más bajo no es el último, se crea
 * (una vez) la animación `<key>-hold` del frame 0 al más bajo, para terminar ahí. Devuelve la clave a reproducir.
 */
function defeatHoldKey(scene: Phaser.Scene, key: string): string {
  const hold = `${key}-hold`;
  if (scene.anims.exists(hold)) return hold;
  const anim = scene.anims.get(key);
  if (!anim) return key;
  const frames = anim.frames;
  let low = frames.length - 1;
  try {
    const cv = document.createElement('canvas');
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    if (!ctx) return key;
    let best = Infinity;
    frames.forEach((af, i) => {
      const fr = af.frame;
      const src = fr.source.image as CanvasImageSource;
      cv.width = fr.cutWidth;
      cv.height = fr.cutHeight;
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.drawImage(src, fr.cutX, fr.cutY, fr.cutWidth, fr.cutHeight, 0, 0, fr.cutWidth, fr.cutHeight);
      const px = ctx.getImageData(0, 0, cv.width, cv.height).data;
      let top = cv.height, bot = -1;
      for (let y = 0; y < cv.height; y++)
        for (let x = 0; x < cv.width; x++)
          if (px[(y * cv.width + x) * 4 + 3] > 60) {
            if (y < top) top = y;
            bot = y;
          }
      const h = bot - top;
      if (bot >= 0 && h < best - 1) {
        best = h;
        low = i;
      }
    });
  } catch {
    return key;
  }
  if (low >= frames.length - 1) return key;
  scene.anims.create({
    key: hold,
    frames: frames.slice(0, low + 1).map((f) => ({ key: f.textureKey, frame: f.textureFrame })),
    frameRate: anim.frameRate,
    repeat: 0,
  });
  return hold;
}

/** Silueta del primer frame de una textura: centro x, pies (fila más baja con píxeles) y alto, en px del frame. */
type Sil = { cx: number; bottom: number; h: number; w: number; fw: number; fh: number };
const SIL = new Map<string, Sil | null>();
function silhouette(scene: Phaser.Scene, key: string) {
  if (SIL.has(key)) return SIL.get(key)!;
  let res: Sil | null = null;
  try {
    const fr = scene.textures.getFrame(key, 0);
    const src = fr?.source.image as CanvasImageSource | undefined;
    if (fr && src) {
      const cv = document.createElement('canvas');
      cv.width = fr.cutWidth;
      cv.height = fr.cutHeight;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(src, fr.cutX, fr.cutY, fr.cutWidth, fr.cutHeight, 0, 0, fr.cutWidth, fr.cutHeight);
        const px = ctx.getImageData(0, 0, cv.width, cv.height).data;
        let x0 = cv.width, x1 = -1, y0 = cv.height, y1 = -1;
        for (let y = 0; y < cv.height; y++) {
          for (let x = 0; x < cv.width; x++) {
            if (px[(y * cv.width + x) * 4 + 3] > 60) {
              if (x < x0) x0 = x;
              if (x > x1) x1 = x;
              if (y < y0) y0 = y;
              if (y > y1) y1 = y;
            }
          }
        }
        if (x1 >= 0) res = { cx: (x0 + x1 + 1) / 2, bottom: y1 + 1, h: y1 + 1 - y0, w: x1 + 1 - x0, fw: fr.cutWidth, fh: fr.cutHeight };
      }
    }
  } catch {
    res = null;
  }
  SIL.set(key, res);
  return res;
}

export class MatchEndScene extends Phaser.Scene {
  static readonly KEY = 'MatchEnd';
  private d!: MatchEndData;

  constructor() {
    super(MatchEndScene.KEY);
  }

  preload() {
    for (const c of Object.keys(MAI_END.clips) as (keyof typeof MAI_END.clips)[]) {
      const key = maiEndKey(c);
      if (!this.textures.exists(key)) this.load.spritesheet(key, `${MAI_END.dir}/${c}.png`, { frameWidth: MAI_END.cell.w, frameHeight: MAI_END.cell.h });
    }
  }

  /** Animaciones de las poses de MAI (globales; una vez). */
  private ensureMaiEndAnims() {
    for (const [c, info] of Object.entries(MAI_END.clips) as [keyof typeof MAI_END.clips, { fps: number; loop: boolean }][]) {
      const key = maiEndKey(c);
      if (!this.textures.exists(key) || this.anims.exists(key)) continue;
      this.anims.create({ key, frames: this.anims.generateFrameNumbers(key, { start: 0, end: 7 }), frameRate: info.fps, repeat: info.loop ? -1 : 0 });
    }
  }

  init(data: MatchEndData) {
    this.d = data;
  }

  create() {
    this.ensureMaiEndAnims();
    const W = this.scale.width;
    const H = this.scale.height;
    const d = this.d;
    const win = d.win;

    // Ranked: liquida UNA vez la partida con entrada pagada (victoria / derrota / rendición)
    const rstore = d as MatchEndData & { _rankedDone?: boolean };
    if (!rstore._rankedDone) {
      rstore._rankedDone = true;
      const pend = rankedState().pending;
      const st = settleCurrentRanked(d.surrendered ? 'surrender' : win ? 'win' : 'loss');
      if (st && !st.duplicate && pend)
        d.ranked = { delta: st.delta, rank: st.league, level: getPlayer().level, position: myPosition(), promotedTo: st.promotedTo ?? undefined, bet: pend.bet, entry: pend.entry, pot: pend.prize };
    }

    // ruletas diarias: cada partida COMPLETADA (ganada o perdida; no rendición) cuenta UNA vez (id único guardado)
    const wstore = d as MatchEndData & { _matchId?: string; _wheel?: number | null };
    if (!d.surrendered && !wstore._matchId) {
      wstore._matchId = newMatchId();
      wstore._wheel = recordMatchWin(wstore._matchId); // índice de la ruleta desbloqueada (o null)
      if (win) recordWin(wstore._matchId); // victorias totales (se muestran en la pantalla VS)
    }

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
    const panelH = 108 + 16 + CARD_H + 22 + (this.duel() ? RANKED_H : 0);
    const panelTop = btnY - btnH / 2 - 14 - panelH;
    this.resultPanel(W, panelTop, panelH);
    this.buttons(W, btnY, btnH);
    if (win) this.confetti(W, H);
    if (win) this.time.delayedCall(900, () => { void showInterstitial('match_victory'); });
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
    if (d.surrendered) {
      const tag = this.add.graphics();
      tag.fillStyle(0xc42536, 1).fillRoundedRect(-50, scoreY + 26, 100, 24, 12);
      c.add(tag);
      c.add(this.add.text(0, scoreY + 38, 'RENDICIÓN', { fontFamily: FONT, fontSize: '13px', color: '#ffffff' }).setOrigin(0.5).setLetterSpacing(1));
    }

    // separador
    const sepY = 108;
    const sep = this.add.graphics();
    sep.lineStyle(2, 0x2c4a8a, 0.9).lineBetween(-w / 2 + 24, sepY, w / 2 - 24, sepY);
    c.add(sep);

    // --- recompensas (se aplican UNA vez por partida; las reglas de siempre)
    //   XP: victoria XP_WIN, derrota/rendición XP_LOSS · monedas: COINS_WIN / COINS_LOSS / COINS_SURRENDER
    const store = d as MatchEndData & { _xp?: ReturnType<typeof addXp>; _coins?: ReturnType<typeof addCoins> };
    const gained = d.win ? XP_WIN : XP_LOSS;
    if (!store._xp) store._xp = addXp(gained);
    if (!store._coins) store._coins = addCoins(d.surrendered ? COINS_SURRENDER : d.win ? COINS_WIN : COINS_LOSS);
    this.rewardCards(c, W, top, w, sepY + 16);

    // --- duelo de apuestas: Ranked (con la apuesta real) o, en desarrollo, el partido online (de prueba)
    const duel = this.duel();
    if (duel) this.rankedDuel(c, w, sepY + 16 + CARD_H + 20, duel);
    if (d.ranked?.promotedTo) this.levelUp(W / 2, top - 26, 0, '¡ASCENSO DE LIGA!');

    // entrada: sube desde abajo junto con los botones
    c.setAlpha(0).setY(top + 60);
    this.tweens.add({ targets: c, alpha: 1, y: top, duration: 460, delay: 350, ease: 'Cubic.easeOut' });
  }


  /**
   * Tres cuadros de recompensa (estilo fin de partida de juegos de cartas): MONEDAS · EXP · RULETA.
   * Entran uno a uno con rebote y sus cifras cuentan hacia arriba. Los valores ya están aplicados
   * (una vez por partida); aquí solo se muestran.
   */
  private rewardCards(c: Phaser.GameObjects.Container, W: number, top: number, w: number, y0: number) {
    const d = this.d as MatchEndData & { _xp?: ReturnType<typeof addXp>; _coins?: ReturnType<typeof addCoins>; _wheel?: number | null };
    const xp = d._xp!;
    const coins = d._coins!;
    const gap = 12;
    const cw = (w - 40 - gap * 2) / 3;
    const xs = [-cw - gap, 0, cw + gap];
    const base = 750; // empieza cuando el panel ya subió
    const step = 380;

    // --- 1) MONEDAS
    const m = this.card(c, xs[0], y0, cw, 'MONEDAS', GOLD, 0x3a2a08);
    drawCoin(m.icon, 30);
    m.value.setText('+0').setColor('#ffd23f');
    m.sub.setText(`TOTAL ${coins.before.toLocaleString('es-CL')}`);
    this.pop(m.cont, base, () => {
      if (coins.gained <= 0) return m.value.setColor('#7f93bf');
      const cc = { v: 0 };
      this.tweens.add({
        targets: cc,
        v: coins.gained,
        duration: 800,
        ease: 'Cubic.easeOut',
        onUpdate: () => {
          const v = Math.round(cc.v);
          m.value.setText(`+${v}`);
          m.sub.setText(`TOTAL ${(coins.before + v).toLocaleString('es-CL')}`);
          fitText(m.sub, cw - 16);
        },
        onComplete: () => this.tweens.add({ targets: m.icon, scale: { from: 1.3, to: 1 }, duration: 300, ease: 'Back.easeOut' }),
      });
      this.coinShower(c, xs[0], y0 + 70, xs[0], y0 + 40, Math.min(7, 2 + Math.round(coins.gained / 10)));
    });

    // --- 2) EXP (+ barra de nivel; sube de nivel si corresponde)
    const e = this.card(c, xs[1], y0, cw, 'EXP', 0x5fd0ff, 0x0a2a4a);
    drawXpIcon(e.icon, 32);
    e.value.setText('+0').setColor('#8fd0ff');
    e.sub.setText(`NIVEL ${xp.before.level}`);
    const bw = cw - 30;
    const bh = 10;
    const bx = -bw / 2;
    // cifra un poco más arriba; debajo la barra de nivel y el nivel
    e.value.setY(126);
    const by = CARD_H - 46;
    const track = this.add.graphics();
    track.fillStyle(0x05112c, 1).fillRoundedRect(bx, by, bw, bh, bh / 2);
    track.lineStyle(1, 0x2a4a8a, 1).strokeRoundedRect(bx, by, bw, bh, bh / 2);
    const bar = this.add.graphics();
    e.cont.add([track, bar]);
    e.sub.setY(CARD_H - 20);
    const drawBar = (p: number) => {
      bar.clear();
      if (p <= 0) return;
      const fw = Math.max(bh, bw * Math.min(1, p));
      bar.fillStyle(0x1f7bff, 1).fillRoundedRect(bx, by, fw, bh, bh / 2);
      bar.fillStyle(0x5fd0ff, 1).fillRoundedRect(bx, by, fw, bh * 0.5, { tl: bh / 2, tr: bh / 2, bl: 0, br: 0 });
    };
    const prog = (lv: number, v: number) => (lv >= MAX_LEVEL ? 1 : v / xpToNext(lv));
    drawBar(prog(xp.before.level, xp.before.xp));
    this.pop(e.cont, base + step, () => {
      const cnt = { v: 0 };
      this.tweens.add({ targets: cnt, v: xp.gained, duration: 800, ease: 'Cubic.easeOut', onUpdate: () => e.value.setText(`+${Math.round(cnt.v)}`) });
      const p = { v: prog(xp.before.level, xp.before.xp) };
      const steps: { to: number; reset?: boolean; level?: number }[] =
        xp.levelsUp > 0 ? [{ to: 1 }, { to: prog(xp.after.level, xp.after.xp), reset: true, level: xp.after.level }] : [{ to: prog(xp.after.level, xp.after.xp) }];
      const run = (i: number) => {
        const s = steps[i];
        if (!s) return;
        if (s.reset) {
          p.v = 0;
          e.sub.setText(`¡NIVEL ${s.level}!`).setColor('#ffd23f');
          this.levelUp(W / 2, top - 26, s.level!);
        }
        this.tweens.add({ targets: p, v: s.to, duration: 650, ease: 'Cubic.easeOut', onUpdate: () => drawBar(p.v), onComplete: () => run(i + 1) });
      };
      run(0);
    });

    // --- 3) RULETA (se desbloqueó una con esta partida, o no)
    const unlocked = d._wheel !== undefined && d._wheel !== null;
    const r = this.card(c, xs[2], y0, cw, 'RULETA', unlocked ? 0xb27bff : 0x55607a, unlocked ? 0x2a1250 : 0x141c33);
    const wheel = this.add.container(0, r.icon.y);
    const rim = this.add.graphics();
    rim.fillStyle(0x0a1638, 1).fillCircle(0, 0, 36);
    rim.fillStyle(unlocked ? GOLD : 0x55607a, 1).fillCircle(0, 0, 33);
    const face = this.add.graphics();
    drawWheelFace(face, 30, false);
    const hub = this.add.graphics();
    hub.fillStyle(0x0a1638, 1).fillCircle(0, 0, 7).fillStyle(GOLD, 1).fillCircle(0, 0, 4.5);
    const ptr = this.add.graphics();
    ptr.fillStyle(0x0a1638, 1).fillTriangle(-7, -42, 7, -42, 0, -29);
    ptr.fillStyle(0xff3b4f, 1).fillTriangle(-4.5, -40, 4.5, -40, 0, -32);
    wheel.add([rim, face, hub, ptr]);
    r.cont.add(wheel);
    const done = wheelStatuses().filter((s) => s !== 'locked').length;
    if (unlocked) {
      r.value.setText('¡NUEVA!').setColor('#ffd23f');
      r.sub.setText(`${(d._wheel ?? 0) + 1}/${WHEEL.perDay} HOY`);
    } else {
      wheel.setAlpha(0.45);
      r.value.setText(d.surrendered ? 'SIN RULETA' : 'MÁXIMO').setColor('#9aa6c4');
      r.sub.setText(d.surrendered ? 'POR RENDIRTE' : `${done}/${WHEEL.perDay} HOY`);
    }
    fitText(r.value, cw - 16);
    this.pop(r.cont, base + step * 2, () => {
      if (!unlocked) return;
      // aparece girando con brillo (se abrirá sola al volver al menú)
      this.tweens.add({ targets: face, angle: 720, duration: 1400, ease: 'Cubic.easeOut' });
      const glow = this.add.circle(0, wheel.y, 44, GOLD, 0.5).setBlendMode(Phaser.BlendModes.ADD);
      r.cont.addAt(glow, 1);
      this.tweens.add({ targets: glow, scale: 1.35, alpha: 0.1, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });
  }

  /** Un cuadro de recompensa: fondo, etiqueta arriba, icono al medio, cifra y subtítulo abajo. */
  private card(parent: Phaser.GameObjects.Container, x: number, y: number, w: number, label: string, accent: number, tint: number) {
    const cont = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.35).fillRoundedRect(-w / 2 + 3, 5, w, CARD_H, 18);
    g.fillStyle(0x0a1638, 1).fillRoundedRect(-w / 2 - 3, -3, w + 6, CARD_H + 6, 20);
    g.fillStyle(tint, 1).fillRoundedRect(-w / 2, 0, w, CARD_H, 18);
    g.fillStyle(0xffffff, 0.06).fillRoundedRect(-w / 2 + 4, 4, w - 8, CARD_H * 0.42, { tl: 15, tr: 15, bl: 6, br: 6 });
    g.lineStyle(3, accent, 1).strokeRoundedRect(-w / 2, 0, w, CARD_H, 18);
    // etiqueta en una franja
    g.fillStyle(accent, 1).fillRoundedRect(-w / 2 + 10, 10, w - 20, 26, 13);
    cont.add(g);
    cont.add(this.add.text(0, 23, label, { fontFamily: FONT, fontSize: '16px', color: '#0a1638' }).setOrigin(0.5).setLetterSpacing(1));
    const icon = this.add.graphics({ x: 0, y: 84 });
    const value = this.add.text(0, 140, '', { fontFamily: FONT, fontSize: '30px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 6 }).setOrigin(0.5);
    const sub = this.add.text(0, CARD_H - 22, '', { fontFamily: FONT, fontSize: '14px', color: '#c9d6f2' }).setOrigin(0.5).setLetterSpacing(1);
    cont.add([icon, value, sub]);
    parent.add(cont);
    cont.setScale(0).setAlpha(0);
    return { cont, icon, value, sub };
  }

  /** Entrada de un cuadro con rebote; `then` al terminar (para empezar a contar). */
  private pop(o: Phaser.GameObjects.Container, delay: number, then?: () => void) {
    this.tweens.add({
      targets: o,
      scale: 1,
      alpha: 1,
      delay,
      duration: 360,
      ease: 'Back.easeOut',
      easeParams: [2.2],
      onComplete: () => then?.(),
    });
  }

  /** Monedas que saltan del contador ganado al total (dentro del panel). */
  private coinShower(c: Phaser.GameObjects.Container, x0: number, y0: number, x1: number, y1: number, n: number) {
    for (let i = 0; i < n; i++) {
      const g = this.add.graphics({ x: x0, y: y0 });
      drawCoin(g, 9);
      g.setScale(0.6).setAlpha(0);
      c.add(g);
      const peak = Math.min(y0, y1) - Phaser.Math.Between(40, 80);
      const dur = 520;
      const delay = i * 70;
      this.tweens.add({ targets: g, alpha: 1, scale: 1, duration: 120, delay });
      this.tweens.add({ targets: g, x: x1, duration: dur, delay, ease: 'Sine.easeInOut' });
      this.tweens.add({
        targets: g,
        y: peak,
        duration: dur / 2,
        delay,
        ease: 'Quad.easeOut',
        yoyo: true,
        onComplete: () => g.destroy(),
      });
    }
  }

  /**
   * Qué duelo se muestra (null = ninguno):
   *  - Ranked: la apuesta real que se liquidó (d.ranked).
   *  - MODO DESARROLLO + partido online (d.lan): online aún no se apuesta nada, pero los cuadros se ven para probarlos,
   *    con la entrada x1 de tu liga. Es SOLO visual: no se cobra ni se paga ninguna moneda.
   */
  private duel(): Duel | null {
    const d = this.d;
    const r = d.ranked;
    if (r) {
      const entry = r.entry ?? Math.abs(r.delta);
      return { entry, pot: r.pot ?? entry * 2, delta: r.delta, demo: false };
    }
    if (d.lan && isDevMode()) {
      const { entry, prize } = matchStakes(myLeague(), 1);
      return { entry, pot: prize, delta: d.win ? prize - entry : -entry, demo: true };
    }
    return null;
  }

  /**
   * Duelo de apuestas: dos cuadros (TÚ · RIVAL) con lo apostado por cada uno. Las monedas del que
   * perdió vuelan al cuadro del que ganó: el ganador sube a la bolsa completa y el perdedor queda en 0.
   */
  private rankedDuel(c: Phaser.GameObjects.Container, w: number, y0: number, r: Duel) {
    const d = this.d;
    const entry = r.entry;
    const pot = r.pot;
    const rivalStake = pot - entry;
    const won = r.delta > 0;
    // cabecera: resultado de la apuesta (rendirse = perderla); la de prueba lo dice
    const hy = y0 + 18;
    const headText = `${won ? 'Has ganado la apuesta' : 'Has perdido la apuesta'}${r.demo ? ' (PRUEBA, sin monedas)' : ''}:`;
    const head = this.add
      .text(0, hy, headText, { fontFamily: FONT, fontSize: '22px', color: won ? '#ffd23f' : '#ff9aa3', stroke: '#0a1638', strokeThickness: 5 })
      .setOrigin(0.5)
      .setLetterSpacing(1);
    fitText(head, w - 48);
    c.add(head);
    // cuadros (más grandes; sin nombre: el personaje ya dice quién es)
    const bh = DUEL_BOX_H;
    const by = y0 + 40 + bh / 2;
    const bw = (w - 40 - 44) / 2;
    const lx = -w / 2 + 20 + bw / 2;
    const rx = w / 2 - 20 - bw / 2;
    // cada cuadro, 2 columnas: IZQUIERDA el personaje (centrado, de pie sobre el borde de abajo) y DERECHA la moneda
    // arriba con la cifra debajo
    const colL = -bw / 4;
    const colR = bw / 4;
    /** alto del cuerpo (silueta medida) de los dos personajes: el MISMO para los dos */
    const bodyPx = bh * 0.74;
    /** ancho máximo del dibujo: su columna (media tarjeta) con un margen pequeño; la raqueta no se sale del borde */
    const maxW = bw / 2 - 6;
    const feetY = bh / 2 - 10;
    const sprites: { me?: Phaser.GameObjects.Sprite; rival?: Phaser.GameObjects.Sprite } = {};
    // ancla y escala por la SILUETA real del primer frame (pies y alto dibujados), no por el ancla de la hoja: así ningún
    // personaje queda hundido ni más grande que el otro aunque sus hojas tengan celdas y márgenes distintos
    /** fondo + borde del cuadro (sin separador entre sus dos columnas) */
    const paintBox = (g: Phaser.GameObjects.Graphics, fill: number, line: number, lw: number) => {
      g.clear();
      g.fillStyle(fill, 1).fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 16);
      g.fillStyle(0xffffff, 0.04).fillRoundedRect(-bw / 2 + 3, -bh / 2 + 3, bw - 6, bh * 0.4, { tl: 13, tr: 13, bl: 4, br: 4 });
      g.lineStyle(lw, line, 1).strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 16);
    };
    const place = (sp: Phaser.GameObjects.Sprite, key: string) => {
      const b = silhouette(this, key);
      if (!b) return;
      // el MISMO alto para los dos personajes, salvo que su silueta (con la raqueta) no quepa a lo ancho en su columna
      const s = Math.min(bodyPx / b.h, maxW / (b.w * 1.12));
      // centrado en alto dentro del cuadro (si el ancho lo achica, no queda pegado al borde de abajo)
      sp.setOrigin(b.cx / b.fw, b.bottom / b.fh).setScale(s).setY(Math.min(feetY, (b.h * s) / 2 + 6));
    };
    const box = (x: number, color: number, amount: number, clips?: DuelClips, pose?: { key: string; frame: number }) => {
      const useClip = !!clips && this.textures.exists(clips.idle.key) && this.anims.exists(clips.idle.key);
      const hasPose = !useClip && !!pose && this.textures.exists(pose.key);
      const useDefault = !useClip && !hasPose && this.textures.exists('portrait-nxo');
      const bc = this.add.container(x, by);
      const g = this.add.graphics();
      paintBox(g, 0x0a1638, color, 3);
      bc.add(g);
      let sp: Phaser.GameObjects.Sprite | undefined;
      if (useClip && clips) {
        // de frente, parado y animado (reposo en bucle); al decidirse la apuesta, victoria o derrota
        sp = this.add.sprite(colL, feetY, clips.idle.key, 0);
        place(sp, clips.idle.key);
        sp.play(clips.idle.key);
        bc.add(sp);
      } else if (pose && hasPose) {
        const fr = this.textures.getFrame(pose.key, pose.frame);
        const ch = this.add.image(colL, feetY, pose.key, pose.frame).setOrigin(0.5, 0.94);
        ch.setScale(Math.min(1.1, (bh - 30) / (fr.height * 0.94)));
        bc.add(ch);
      } else if (useDefault) {
        // Retrato frontal de NXO como respaldo para animaciones ausentes o skins sin hoja de poses finales.
        bc.add(this.add.image(colL, feetY, 'portrait-nxo').setOrigin(0.5, 1).setDisplaySize(84, 108));
      }
      const coin = this.add.graphics({ x: colR, y: -24 });
      drawCoin(coin, 24);
      const val = this.add.text(colR, 30, amount.toLocaleString('es-CL'), { fontFamily: FONT, fontSize: '32px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 5 }).setOrigin(0.5);
      bc.add([coin, val]);
      const center = () => fitText(val, bw / 2 - 16);
      center();
      c.add(bc);
      return { bc, g, val, center, coin, sp };
    };
    // MAI de frente: sus 3 poses salen de su hoja nueva (tools/build-end-poses.mjs; la del partido no trae derrota)
    const clipsMe = endPosesFor(this, d.clips?.me);
    const clipsRv = endPosesFor(this, d.clips?.rival);
    const me = box(lx, 0x3a7bff, entry, clipsMe, d.poses?.me);
    const rv = box(rx, 0xff4f5e, rivalStake, clipsRv, d.poses?.rival);
    sprites.me = me.sp;
    // tu ESTILO DE COLOR también en la tarjeta del resultado (el rival, con sus colores de siempre)
    if (me.sp) applyCharColor(me.sp, getProfile().color, getProfile().skin);
    sprites.rival = rv.sp;
    // al decidirse la apuesta: el ganador celebra y el otro hace su derrota (se quedan en la última pose)
    const finalPose = (sp: Phaser.GameObjects.Sprite | undefined, clips: DuelClips | undefined, victory: boolean) => {
      if (!sp || !clips) return;
      const clip = victory ? clips.victory : clips.defeat;
      if (!this.anims.exists(clip.key)) return;
      place(sp, clip.key);
      if (clip.key === clips.idle.key) return void sp.play({ key: clip.key, repeat: -1 });
      // la derrota termina en su pose más baja (la de NXO vuelve a ponerse de pie al final de la hoja)
      sp.play({ key: victory ? clip.key : defeatHoldKey(this, clip.key), repeat: 0 });
    };
    // centro: VS, luego flecha hacia el ganador
    const vs = this.add.text(0, by, 'VS', { fontFamily: FONT, fontSize: '22px', color: '#7f93bf' }).setOrigin(0.5);
    c.add(vs);
    // animación: tras las tarjetas de recompensa
    const start = 750 + 380 * 3;
    this.time.delayedCall(start, () => {
      // victoria / derrota según el PARTIDO (con rendición, gana el rival)
      // con los MISMOS clips de la tarjeta (MAI de frente usa sus poses nuevas: con los del partido salía con la raqueta
      // en la otra mano, otro color y más grande que el cuadro)
      finalPose(sprites.me, clipsMe, d.win);
      finalPose(sprites.rival, clipsRv, !d.win);
      const from = won ? rv : me;
      const to = won ? me : rv;
      const moved = won ? rivalStake : entry;
      vs.setText(won ? '◀' : '▶').setColor(won ? '#9fe8a0' : '#ff9aa3').setFontSize(30);
      this.tweens.add({ targets: vs, scale: { from: 1.5, to: 1 }, duration: 300, ease: 'Back.easeOut' });
      // monedas que vuelan de un cuadro al otro (en arco)
      const n = 7;
      for (let i = 0; i < n; i++) {
        const cg = this.add.graphics();
        drawCoin(cg, 11);
        cg.setPosition(from.bc.x + colR, by);
        c.add(cg);
        const t = { k: 0 };
        this.tweens.add({
          targets: t,
          k: 1,
          duration: 520,
          delay: i * 70,
          ease: 'Sine.easeInOut',
          onUpdate: () => cg.setPosition(from.bc.x + colR + (to.bc.x - from.bc.x) * t.k, by - Math.sin(t.k * Math.PI) * 46),
          onComplete: () => {
            cg.destroy();
            this.tweens.add({ targets: to.coin, scale: { from: 1.35, to: 1 }, duration: 160 });
          },
        });
      }
      // cifras: el ganador cuenta hacia arriba, el perdedor hasta 0
      const a0 = won ? entry : rivalStake;
      const cnt = { v: 0 };
      this.tweens.add({
        targets: cnt,
        v: moved,
        duration: 520 + n * 70,
        ease: 'Cubic.easeOut',
        onUpdate: () => {
          const v = Math.round(cnt.v);
          to.val.setText((a0 + v).toLocaleString('es-CL'));
          from.val.setText(Math.max(0, moved - v).toLocaleString('es-CL'));
          to.center();
          from.center();
        },
        onComplete: () => {
          // ganador en VERDE (ganó las monedas) y perdedor en ROJO suave
          paintBox(to.g, DUEL_WIN.fill, DUEL_WIN.line, 4);
          to.val.setColor(DUEL_WIN.text);
          paintBox(from.g, DUEL_LOSE.fill, DUEL_LOSE.line, 3);
          from.val.setColor(DUEL_LOSE.text);
          this.tweens.add({ targets: to.bc, scale: { from: 1.08, to: 1 }, duration: 300, ease: 'Back.easeOut' });
          const gain = this.add
            .text(me.bc.x + colR, by - 66, won ? `+${moved.toLocaleString('es-CL')}` : `−${entry.toLocaleString('es-CL')}`, { fontFamily: FONT, fontSize: '24px', color: won ? '#9fe8a0' : '#ff9aa3', stroke: '#0a1638', strokeThickness: 5 })
            .setOrigin(0.5);
          c.add(gain);
          this.tweens.add({ targets: gain, y: gain.y - 26, alpha: { from: 1, to: 0 }, duration: 1400, delay: 400 });
        },
      });
    });
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

    // un solo cambio de pantalla por overlay (un doble toque no abre dos ruletas ni arranca dos veces)
    let leaving = false;
    const cont = arcadeButton(this, x0, y, bw, bh, 'CONTINUAR', () => {
      if (leaving) return;
      leaving = true;
      resetMatchEnd(this.scene.get(matchKey));
      this.scene.stop(matchKey);
      // Si la partida desbloqueó una ruleta, mostrarla antes de entrar al menú.
      const wheelIndex = wheelToPresent();
      if (wheelIndex >= 0) {
        markWheelPresented(wheelIndex);
        openWheel(this, wheelIndex);
        // la ruleta puede quedar en cola de Phaser hasta el siguiente fotograma (openWheel devuelve null): se espera a que
        // exista antes de escuchar su cierre. Antes se usaba directamente y daba "Cannot read properties of null
        // (reading 'events')": la app quedaba pegada en el resultado.
        let went = false;
        const toMenu = () => {
          if (went || !this.scene.isActive()) return;
          went = true;
          // sin `this.scene.stop()` antes: `start` ya cierra esta escena, y fx/transitions.ts espera el fundido
          // y no arranca nada si la escena ya se cerró (el menú no llegaba nunca y la app quedaba pegada)
          this.scene.start('Menu');
        };
        whenWheelReady(this, (w) => w.events.once(Phaser.Scenes.Events.SHUTDOWN, toMenu));
        // seguridad: si la ruleta no llegara a abrirse, no quedarse en esta pantalla
        this.time.delayedCall(2500, () => {
          if (!this.scene.get('Wheel')?.sys.isActive()) toMenu();
        });
        return;
      }
      this.scene.start('Menu');
    }, { palette: 'yellow' });
    // REVANCHA: misma lógica que ya existía (reiniciar el partido con el mismo rival).
    // En Ranked se vuelve a buscar partida con la misma apuesta (la entrada se paga de nuevo al empezar).
    const again = arcadeButton(this, x1, y, bw, bh, d.ranked ? 'OTRA RANKED' : d.lan ? 'OTRA PARTIDA' : 'REVANCHA', () => {
      if (leaving) return;
      leaving = true;
      resetMatchEnd(this.scene.get(matchKey));
      if (d.ranked) {
        this.scene.stop(matchKey);
        this.scene.start('Matchmaking', { ranked: { bet: d.ranked.bet ?? 1 } });
        return;
      }
      if (d.lan) {
        // red: nueva búsqueda de rival (sin rival, se ofrece el BOT como siempre)
        this.scene.stop(matchKey);
        this.scene.start('LanSearch', { fallback: { unranked: true, from: 'Menu' } });
        return;
      }
      this.scene.start(matchKey, { botName: d.botName, rivalLevel: d.rivalLevel });
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
