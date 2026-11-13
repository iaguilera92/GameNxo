import { installTapSound } from '../fx/uiSound';
import Phaser from 'phaser';
import { FONT, restartOnResize, textStyle } from '../ui/theme';
import { stadiumBg } from '../ui/ui';
import { fitText } from '../ui/fitText';
import { commit, getPlayer, onPlayerChange } from '../domain/playerStore';
import { bpSeasonInfo } from '../domain/battlePassConfig';
import { BP_SEASON, BP_TIERS, type BpReward, type BpTrack, bpBonusSpinIndex, bpBuyPremium, bpCanClaim, bpClaim, bpClaimBonus, bpClaimWelcome, bpLevel, syncSeason } from '../domain/battlePass';
import type { PlayerState } from '../domain/player';
import { type ChargeFxId, chargeFxDef } from '../domain/chargeFx';
import type { EmoteKind } from '../domain/emotes';
import { EMOTE_TEXTURE, queueEmoteArt } from '../ui/Emotes';
import { styleLook } from '../ui/styleLook';
import { CHAR_COLOR_LIST } from '../domain/charColors';

/**
 * PASE DE BATALLA a pantalla completa (estilo Clash Royale): cabecera con el nivel y el escudo del Premium, y debajo la
 * lista de niveles en dos franjas a todo el ancho, GRATIS (azul, izquierda) y PREMIUM (dorada, derecha), con el número
 * de nivel en un rombo entre las dos. Arrastrar desplaza la lista. Reclamar se valida y guarda en domain/battlePass (una
 * sola vez por premio).
 *
 * Rendimiento: solo existen las filas que se ven (más una de margen). Al desplazar, la lista solo se mueve; las filas que
 * entran se crean y las que salen se destruyen junto con sus animaciones. El estado del jugador se calcula una vez por
 * cambio (no en cada movimiento del dedo).
 */
const NAVY = 0x0b1733;
const NEON = 0x3a7bff;
const GOLD = 0xffc42e;
/** alto de una fila de nivel; la del último nivel (el personaje nuevo) mide el doble */
const ROW_H = 200;
/** alto de la fila del bonus final (ruleta) */
const BONUS_H = 140;
/** alto de la cabecera (la lista empieza aquí; el escudo del Premium se monta un poco sobre ella) */
const HEAD_H = 280;
/** filas: 0 = regalo de bienvenida, 1..BP_TIERS = niveles, BP_TIERS + 1 = bonus */
const LAST_ROW = BP_TIERS + 1;

const STYLE_SWATCH: Record<string, number> = {
  'style:red': 0xff4f5e,
  'style:green': 0x62d935,
  'style:gold': 0xffc42e,
  'style:classic': 0x3a8bff,
  // estilos de color del personaje (Claude, domain/charColors.ts): muestra del color de su ropa
  ...Object.fromEntries(CHAR_COLOR_LIST.map((c) => [`color:${c.id}`, c.color])),
};

/** Una fila creada: su contenedor y las animaciones que hay que parar al quitarla. */
type RowView = { c: Phaser.GameObjects.Container; tweens: Phaser.Tweens.Tween[] };

export class BattlePassScene extends Phaser.Scene {
  private list!: Phaser.GameObjects.Container;
  private top!: Phaser.GameObjects.Container;
  private listTop = 0;
  private listH = 0;
  private scrollMin = 0;
  private dragging = false;
  private dragFrom = 0;
  private dragOffset = 0;
  private moved = 0;
  private listOffset = 0;
  private bottomIndicator?: Phaser.GameObjects.Text;
  private bottomArrowGraphics?: Phaser.GameObjects.Graphics;
  /** filas creadas (solo las visibles) */
  private rows = new Map<number, RowView>();
  /** animaciones de la fila que se está creando (las recoge `loop`) */
  private building: Phaser.Tweens.Tween[] | null = null;
  /** estado del pase calculado una vez por cambio */
  private st!: { s: PlayerState; level: number; progress: number };
  /** ancho de la franja GRATIS (la PREMIUM ocupa el resto) */
  private leftW = 0;

  constructor() {
    super('BattlePass');
  }

  preload() {
    if (!this.textures.exists('menu-bg')) this.load.image('menu-bg', 'assets/menu-bg.webp');
    if (!this.textures.exists('battle-pass-title')) this.load.image('battle-pass-title', 'assets/titulo-pase-batalla.webp');
    if (!this.textures.exists('battle-pass-insignia')) this.load.image('battle-pass-insignia', 'assets/insignia-pase-batalla.webp');
    // retrato de Mai: ya lo carga BootScene (characters/portrait.ts); solo se descarga si falta (1,3 MB)
    if (!this.textures.exists('portrait-mai')) this.load.image('portrait-mai', 'assets/characters/mai_portrait.webp');
    queueEmoteArt(this.load); // premios: emotes (miniaturas de ~32 KB)
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    // Pase terminado: bloqueado hasta que llegue otro (el menú lo muestra con candado)
    if (bpSeasonInfo().over) {
      this.scene.start('Menu');
      return;
    }
    restartOnResize(this);
    installTapSound(this); // clic de interfaz en cada botón / diálogo
    this.cameras.main.fadeIn(200, 0, 0, 0);
    stadiumBg(this, 0.6);
    // temporada al día (si cambió, el pase empieza de cero)
    commit((s) => ({ ok: true as const, state: syncSeason(s) }));
    this.rows.clear();
    this.leftW = Math.round(W * 0.46); // GRATIS 46 % · PREMIUM 54 %

    // lista: de la cabecera al borde de abajo, recortada
    this.listTop = HEAD_H;
    this.listH = H - this.listTop;
    this.list = this.add.container(0, this.listTop);
    const maskG = this.make.graphics({}, false);
    maskG.fillStyle(0xffffff).fillRect(0, this.listTop, W, this.listH);
    this.list.setMask(maskG.createGeometryMask());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => maskG.destroy());

    // cabecera (encima de la lista: el escudo del Premium se monta sobre las primeras filas)
    this.top = this.add.container(0, 0).setDepth(100);
    this.backButton(54, 64, () => {
      this.cameras.main.fadeOut(180, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Menu'));
    });
    this.refreshState();
    this.buildTop();
    this.setupScroll();
    this.addBottomButton();
    // al abrir: la lista empieza en tu nivel actual
    this.listOffset = Phaser.Math.Clamp(this.rowTop(Math.max(0, this.st.level - 1)), 0, -this.scrollMin);
    this.ensureRows();
    this.refreshBottomControl();

    const off = onPlayerChange(() => {
      this.refreshState();
      this.buildTop();
      this.rebuildRows();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      off();
      this.clearRows();
    });
  }

  /** Estado del pase y límites del desplazamiento (una vez por cambio). */
  private refreshState() {
    const s = syncSeason(getPlayer() as PlayerState);
    const { level, progress } = bpLevel(s.bp.xp);
    this.st = { s, level, progress };
    this.scrollMin = Math.min(0, this.listH - this.rowTop(LAST_ROW) - BONUS_H - 90);
  }

  // ================================================================ cabecera
  private buildTop() {
    const W = this.scale.width;
    this.top.removeAll(true);
    const { s } = this.st;
    const { level, into, progress } = bpLevel(s.bp.xp);
    const done = level >= BP_TIERS;

    // fondo de la cabecera con borde inferior almenado (como la muralla de Clash Royale)
    const bg = this.add.graphics();
    bg.fillStyle(0x0d2a66, 1).fillRect(0, 0, W, HEAD_H);
    bg.fillStyle(0x163f8f, 1).fillRect(0, 0, W, HEAD_H * 0.55);
    bg.fillStyle(0x0a1f4d, 1).fillRect(0, HEAD_H - 14, W, 14);
    for (let x = 0; x < W; x += 36) bg.fillStyle(0x0d2a66, 1).fillRect(x + 4, HEAD_H - 14, 22, 8);
    this.top.add(bg);
    const titleW = Math.min(420, W - 170);
    if (this.textures.exists('battle-pass-title')) this.top.add(this.add.image(W / 2, 62, 'battle-pass-title').setDisplaySize(titleW, titleW / 3));

    // progreso (izquierda): insignia con el nivel + barra de EXP
    const shieldW = Math.min(300, W * 0.42);
    const px = 24;
    const pw = W - shieldW - 60 - px;
    const py = 176;
    if (this.textures.exists('battle-pass-insignia')) this.top.add(this.add.image(px + 40, py + 20, 'battle-pass-insignia').setDisplaySize(80, 96));
    this.top.add(this.add.text(px + 40, py + 14, 'NIV', { fontFamily: FONT, fontSize: '12px', color: '#0a1638', stroke: '#fff0a8', strokeThickness: 2 }).setOrigin(0.5));
    this.top.add(this.add.text(px + 40, py + 34, String(level), { fontFamily: FONT, fontSize: '28px', color: '#0a1638', stroke: '#fff0a8', strokeThickness: 3 }).setOrigin(0.5));
    const bx = px + 90;
    const bw = Math.max(80, pw - 90);
    const lvl = this.add.text(bx + bw / 2, py - 6, done ? '¡PASE COMPLETADO!' : `NIVEL ${level + 1} DE ${BP_TIERS}`, { fontFamily: FONT, fontSize: '20px', color: '#ffffff', stroke: '#061431', strokeThickness: 4 }).setOrigin(0.5);
    fitText(lvl, bw);
    this.top.add(lvl);
    const g = this.add.graphics();
    g.fillStyle(0x05112c, 1).fillRoundedRect(bx, py + 14, bw, 26, 13).lineStyle(2, 0x2a4a8a, 1).strokeRoundedRect(bx, py + 14, bw, 26, 13);
    const fw = Math.max(26, bw * (done ? 1 : progress));
    g.fillStyle(0xf2a51f, 1).fillRoundedRect(bx, py + 14, fw, 26, 13);
    g.fillStyle(0xffd86a, 1).fillRoundedRect(bx, py + 14, fw, 12, { tl: 13, tr: 13, bl: 0, br: 0 });
    this.top.add(g);
    this.top.add(this.add.text(bx + bw / 2, py + 27, done ? 'COMPLETO' : `${into} / ${BP_SEASON.xpPerTier}`, { fontFamily: FONT, fontSize: '17px', color: '#ffffff', stroke: '#3a2400', strokeThickness: 4 }).setOrigin(0.5));
    // fecha de término (fin de mes) y días que quedan
    const se = bpSeasonInfo();
    const ends = this.add.text(bx + bw / 2, py + 62, se.daysLeft <= 1 ? '¡ÚLTIMO DÍA!' : `QUEDAN ${se.daysLeft} DÍAS`, { fontFamily: FONT, fontSize: '21px', color: se.daysLeft <= 3 ? '#ffb0b8' : '#ffe9a8', stroke: '#061431', strokeThickness: 4 }).setOrigin(0.5);
    fitText(ends, bw);
    this.top.add(ends);

    // escudo del PREMIUM (derecha): baja sobre la lista, con la corona arriba
    const sx = W - 24 - shieldW / 2;
    const sTop = 110;
    const sBot = HEAD_H + 46;
    const sh = this.add.graphics();
    const shield = (inset: number) => [
      { x: sx - shieldW / 2 + inset, y: sTop + inset },
      { x: sx + shieldW / 2 - inset, y: sTop + inset },
      { x: sx + shieldW / 2 - inset, y: sBot - 50 },
      { x: sx, y: sBot - inset },
      { x: sx - shieldW / 2 + inset, y: sBot - 50 },
    ];
    sh.fillStyle(0x000000, 0.35).fillPoints(shield(0).map((p) => ({ x: p.x + 3, y: p.y + 6 })), true);
    sh.fillStyle(0x8a5a00, 1).fillPoints(shield(0), true);
    sh.fillStyle(0xf2b52a, 1).fillPoints(shield(5), true);
    sh.fillStyle(0xffd86a, 1).fillRect(sx - shieldW / 2 + 5, sTop + 5, shieldW - 10, 34);
    this.top.add(sh);
    this.top.add(this.add.text(sx, sTop + 42, 'PASE PREMIUM', { fontFamily: FONT, fontSize: '24px', color: '#ffffff', stroke: '#5a3200', strokeThickness: 6 }).setOrigin(0.5));
    if (s.bp.premium) {
      this.top.add(this.add.text(sx, sTop + 88, '¡ACTIVO!', { fontFamily: FONT, fontSize: '28px', color: '#9fe8a0', stroke: '#0a3a18', strokeThickness: 6 }).setOrigin(0.5));
    } else {
      this.top.add(this.priceButton(sx, sTop + 96, Math.min(220, shieldW - 50), 62, BP_SEASON.premiumRealPrice, () => this.buyPremium()));
    }
  }

  // ================================================================ filas (solo las visibles)
  /** y (dentro de la lista) donde empieza cada fila: todas miden ROW_H salvo la del último nivel (el doble). */
  private rowTop(row: number) {
    return row * ROW_H + (row > BP_TIERS ? ROW_H : 0);
  }

  private rowHeight(row: number) {
    return row === BP_TIERS ? ROW_H * 2 : row === LAST_ROW ? BONUS_H : ROW_H;
  }

  /** Crea las filas que entran en pantalla (con una fila de margen) y destruye las que salen. La lista solo se mueve. */
  private ensureRows() {
    const from = this.listOffset - ROW_H;
    const to = this.listOffset + this.listH + ROW_H;
    for (let row = 0; row <= LAST_ROW; row++) {
      const y0 = this.rowTop(row);
      const inView = y0 + this.rowHeight(row) > from && y0 < to;
      const have = this.rows.get(row);
      if (inView && !have) this.rows.set(row, this.buildRow(row));
      else if (!inView && have) this.dropRow(row);
    }
    this.list.y = this.listTop - this.listOffset;
  }

  private dropRow(row: number) {
    const r = this.rows.get(row);
    if (!r) return;
    for (const t of r.tweens) t.remove();
    r.c.destroy(true);
    this.rows.delete(row);
  }

  private clearRows() {
    for (const row of [...this.rows.keys()]) this.dropRow(row);
  }

  /** Tras reclamar / comprar: se rehacen solo las filas visibles. */
  private rebuildRows() {
    this.clearRows();
    this.listOffset = Phaser.Math.Clamp(this.listOffset, 0, -this.scrollMin);
    this.ensureRows();
  }

  /** Animación en bucle de la fila que se está creando (se para al quitar la fila). */
  private loop(cfg: Phaser.Types.Tweens.TweenBuilderConfig) {
    const t = this.tweens.add(cfg);
    this.building?.push(t);
    return t;
  }

  private buildRow(row: number): RowView {
    const W = this.scale.width;
    const tweens: Phaser.Tweens.Tween[] = [];
    this.building = tweens;
    const h = this.rowHeight(row);
    const c = this.add.container(0, this.rowTop(row));
    this.list.add(c);
    const { s, level } = this.st;
    const L = this.leftW;

    if (row === LAST_ROW) {
      c.add(this.bonusCard(W / 2, h / 2, W - 48, h - 24, s, level));
      this.building = null;
      return { c, tweens };
    }

    // franjas de fondo: más vivas en los niveles alcanzados
    const reached = row === 0 || level >= row;
    const bg = this.add.graphics();
    // columna GRATIS: azul pizarra apagado (no compite con la premium), con un leve degradado
    const [fT, fB] = reached ? [0x3f5f8f, 0x2c4670] : [0x283a5c, 0x1c2a45];
    bg.fillGradientStyle(fT, fT, fB, fB, 1).fillRect(0, 0, L, h);
    // columna PREMIUM: esmeralda en degradado (claro arriba, profundo abajo) y brillante
    const [pT, pB] = reached ? [0x3fe0a0, 0x0c8a57] : [0x1d8f63, 0x0a4f36];
    bg.fillGradientStyle(pT, pT, pB, pB, 1).fillRect(L, 0, W - L, h);
    bg.fillStyle(0xffffff, reached ? 0.08 : 0.04).fillRect(0, 0, L, h * 0.3);
    bg.fillStyle(0xffffff, reached ? 0.16 : 0.07).fillRect(L, 0, W - L, h * 0.32);
    // franjas de brillo en diagonal sobre la esmeralda
    bg.fillStyle(0xffffff, reached ? 0.1 : 0.05);
    for (const fx of [0.3, 0.72]) {
      const sx0 = L + (W - L) * fx;
      bg.fillPoints([{ x: sx0, y: 0 }, { x: sx0 + 36, y: 0 }, { x: sx0 - 30, y: h }, { x: sx0 - 66, y: h }], true);
    }
    bg.fillStyle(0x16233d, 1).fillRect(0, h - 4, L, 4);
    bg.fillStyle(0x05432b, 1).fillRect(L, h - 4, W - L, 4);
    bg.fillStyle(0x06173d, 0.5).fillRect(L - 2, 0, 4, h);
    c.add(bg);
    // destello que titila en la esmeralda (solo en las filas visibles: se para al salir)
    if (reached) {
      const st = this.add.star(L + (W - L) * (0.15 + ((row * 37) % 70) / 100), h * 0.2, 4, 3, 9, 0xffffff).setBlendMode(Phaser.BlendModes.ADD);
      c.add(st);
      this.loop({ targets: st, alpha: { from: 0.1, to: 1 }, scale: { from: 0.5, to: 1.2 }, angle: 45, duration: 900, delay: (row * 230) % 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    // premios: GRATIS a la izquierda, PREMIUM a la derecha (el rombo del nivel va en la unión)
    this.rewardCell(c, row, 'free', 0, L, h);
    this.rewardCell(c, row, 'prem', L, W - L, h);

    // rombo con el número de nivel
    const node = this.add.graphics({ x: L, y: h / 2 });
    const d = 30;
    node.fillStyle(0x3a2400, 1).fillPoints([{ x: 0, y: -d - 4 }, { x: d + 4, y: 0 }, { x: 0, y: d + 4 }, { x: -d - 4, y: 0 }], true);
    node.fillStyle(reached ? GOLD : 0x7a86a6, 1).fillPoints([{ x: 0, y: -d }, { x: d, y: 0 }, { x: 0, y: d }, { x: -d, y: 0 }], true);
    node.fillStyle(0xffffff, 0.3).fillPoints([{ x: 0, y: -d }, { x: d, y: 0 }, { x: 0, y: 0 }, { x: -d, y: 0 }], true);
    c.add(node);
    c.add(this.add.text(L, h / 2, row === 0 ? 'XP' : String(row), { fontFamily: FONT, fontSize: row === 0 ? '16px' : '24px', color: reached ? '#3a2400' : '#1c2440' }).setOrigin(0.5));

    this.building = null;
    return { c, tweens };
  }

  /** Celda de un premio: icono grande centrado, nombre debajo y su estado (reclamar / reclamado / bloqueado). */
  private rewardCell(c: Phaser.GameObjects.Container, row: number, track: BpTrack, x: number, w: number, h: number) {
    const { s } = this.st;
    const welcome = row === 0;
    const reward = welcome ? BP_SEASON.welcome[track] : BP_SEASON.tiers[row - 1][track];
    const err = welcome
      ? (track === 'prem' && !s.bp.premium ? 'not_premium' : (track === 'free' ? s.bp.welcomeFreeClaimed : s.bp.welcomePremClaimed) ? 'already_claimed' : null)
      : bpCanClaim(s, track, row);
    const claimed = err === 'already_claimed';
    const ready = err === null;
    const prem = track === 'prem';
    const needPrem = prem && !s.bp.premium;
    // el regalo, centrado en la celda (el rombo del nivel ocupa ~34 px del borde de la unión)
    const cx = prem ? x + 34 + (w - 34) / 2 : x + (w - 34) / 2;
    const cy = h / 2;

    if (row === BP_TIERS && reward.kind === 'character' && this.textures.exists('portrait-mai')) this.characterCell(c, cx, cy, w - 50, h, prem, reward);
    else {
      const iy = cy - 22;
      if (ready) {
        // listo para reclamar: halo que late detrás del icono
        const glow = this.add.circle(cx, iy, 54, 0xffffff, 0.35).setBlendMode(Phaser.BlendModes.ADD);
        c.add(glow);
        this.loop({ targets: glow, scale: { from: 0.85, to: 1.15 }, alpha: { from: 0.5, to: 0.15 }, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
      const ic = this.add.graphics({ x: cx, y: iy }).setScale(1.6);
      this.drawReward(ic, reward);
      c.add(ic);
      if (reward.kind === 'item' && reward.item.startsWith('emote:')) {
        const key = EMOTE_TEXTURE[reward.item.split(':')[1] as EmoteKind];
        if (key && this.textures.exists(key)) c.add(this.add.image(cx, iy, key).setDisplaySize(76, 76));
      }
      if (reward.kind === 'character' && this.textures.exists('portrait-mai')) c.add(this.add.image(cx, iy, 'portrait-mai').setDisplaySize(68, 88));
      const label = rewardLabel(reward);
      const t = this.add.text(cx, cy + 46, label.top, { fontFamily: FONT, fontSize: '26px', color: '#ffffff', stroke: prem ? '#04392a' : '#06122e', strokeThickness: 5 }).setOrigin(0.5);
      fitText(t, w - 50);
      c.add(t);
      c.add(this.add.text(cx, cy + 72, label.sub, { fontFamily: FONT, fontSize: '13px', color: prem ? '#d4ffea' : '#d1e3ff' }).setOrigin(0.5).setLetterSpacing(1));
    }

    if (claimed) {
      c.add(this.add.rectangle(x + w / 2, h / 2, w, h, 0x02060f, 0.45));
      const ok = this.add.graphics({ x: cx + 52, y: cy - 58 });
      ok.fillStyle(0x07152f, 1).fillCircle(0, 0, 20).fillStyle(0x35c85a, 1).fillCircle(0, 0, 16);
      ok.lineStyle(4, 0xffffff, 1).beginPath().moveTo(-7, 0).lineTo(-2, 6).lineTo(8, -6).strokePath();
      c.add(ok);
      return;
    }
    if (needPrem) {
      // pestaña con candado arriba de la celda (como el Pass Royale)
      const tab = this.add.graphics({ x: cx, y: 0 });
      tab.fillStyle(0x05432b, 1).fillRoundedRect(-36, -2, 72, 34, { tl: 0, tr: 0, bl: 12, br: 12 });
      tab.fillStyle(0x6fe8b4, 1).fillRoundedRect(-32, -2, 64, 30, { tl: 0, tr: 0, bl: 10, br: 10 });
      tab.lineStyle(3, 0x05432b, 1).beginPath().arc(0, 10, 6, Math.PI, 0).strokePath();
      tab.fillStyle(0x05432b, 1).fillRoundedRect(-8, 10, 16, 12, 3);
      c.add(tab);
    }
    if (!ready) {
      if (err !== 'not_premium') c.add(this.add.rectangle(x + w / 2, h / 2, w, h, 0x02060f, 0.28));
      return;
    }
    // listo: "¡RECLAMAR!" y toda la celda es táctil
    const pill = this.add.container(cx, cy - 78);
    const pg = this.add.graphics();
    pg.fillStyle(0x0a3a18, 1).fillRoundedRect(-62, -15, 124, 30, 15);
    pg.fillStyle(0x35c85a, 1).fillRoundedRect(-59, -13, 118, 26, 13);
    pill.add([pg, this.add.text(0, 0, '¡RECLAMAR!', { fontFamily: FONT, fontSize: '15px', color: '#ffffff', stroke: '#0a3a18', strokeThickness: 4 }).setOrigin(0.5)]);
    c.add(pill);
    this.loop({ targets: pill, scale: { from: 1, to: 1.08 }, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const hit = this.add.zone(x + w / 2, h / 2, w, h).setInteractive({ useHandCursor: true });
    hit.on('pointerup', (p: Phaser.Input.Pointer) => {
      // la máscara no recorta los toques: solo dentro de la zona visible de la lista
      if (this.moved > 12 || p.y < this.listTop) return;
      if (welcome) this.claimWelcome(track, cx, c.y + cy + this.list.y);
      else this.claim(track, row, cx, c.y + cy + this.list.y);
    });
    c.add(hit);
  }

  /**
   * Celda del último nivel (el personaje nuevo): el personaje a casi todo el alto, con rayos de luz y un resplandor
   * detrás, destellos que titilan, su nombre debajo y una etiqueta (GRATIS / ESTILO ORO). (cx, cy) = centro de la celda.
   */
  private characterCell(c: Phaser.GameObjects.Container, cx: number, cy: number, w: number, h: number, prem: boolean, reward: Extract<BpReward, { kind: 'character' }>) {
    const accent = prem ? 0xfff1b8 : 0x8fd8ff;
    const box = { x0: 118, y0: 4, x1: 1070, y1: 1356 }; // caja visible de mai_portrait.png (1130 × 1392), como en characters/portrait.ts
    const vh = h * 0.66;
    const vw = ((box.x1 - box.x0) / (box.y1 - box.y0)) * vh;
    const feetY = cy + h * 0.24;

    const cell = this.add.container(cx, cy);
    c.add(cell);
    const rays = this.add.graphics();
    this.sunburst(rays, 0, -h * 0.12, w, h - 8, accent, 0.14);
    cell.add(rays);
    const glow = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    for (const [k, a] of [[1.5, 0.08], [1.2, 0.1], [0.9, 0.12]] as const) glow.fillStyle(accent, a).fillEllipse(0, -h * 0.1, vw * k, vh * 0.95 * (k / 1.5 + 0.3));
    cell.add(glow);
    this.loop({ targets: glow, alpha: { from: 0.55, to: 1 }, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    cell.add(this.add.ellipse(0, feetY - cy + 2, vw * 0.9, 14, 0x000000, 0.35));
    const img = this.add.image(0, feetY - cy, 'portrait-mai');
    img.setOrigin(((box.x0 + box.x1) / 2) / img.width, box.y1 / img.height);
    img.setScale(vh / (box.y1 - box.y0));
    cell.add(img);

    const spark: [number, number, number][] = [[-0.4, -0.36, 8], [0.36, -0.4, 6], [0.42, -0.06, 7], [-0.44, 0.06, 5], [0.3, 0.22, 5]];
    spark.forEach(([fx, fy, r], i) => {
      const st = this.add.star(w * fx, h * fy, 4, r * 0.35, r, 0xffffff).setBlendMode(Phaser.BlendModes.ADD);
      cell.add(st);
      this.loop({ targets: st, alpha: { from: 0.1, to: 1 }, scale: { from: 0.5, to: 1.15 }, angle: 45, duration: 700 + i * 140, delay: i * 190, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });

    const name = this.add.text(0, h * 0.31, reward.name.split(' · ')[0].toUpperCase(), { fontFamily: FONT, fontSize: '40px', color: '#ffffff', stroke: prem ? '#04392a' : '#06122e', strokeThickness: 7 }).setOrigin(0.5);
    fitText(name, w - 20);
    cell.add(name);
    const tagY = h * 0.42;
    const tagW = Math.min(w - 20, 170);
    const tag = this.add.graphics();
    tag.fillStyle(0x06122e, 1).fillRoundedRect(-tagW / 2 - 2, tagY - 16, tagW + 4, 32, 16);
    tag.fillStyle(prem ? GOLD : 0x2f8bff, 1).fillRoundedRect(-tagW / 2, tagY - 14, tagW, 28, 14);
    cell.add(tag);
    const tagText = this.add.text(0, tagY, reward.style ? '★ ESTILO ORO' : 'PERSONAJE NUEVO', { fontFamily: FONT, fontSize: '15px', color: prem ? '#3b2600' : '#ffffff' }).setOrigin(0.5);
    fitText(tagText, tagW - 12);
    cell.add(tagText);
  }

  /** Rayos de luz (cuñas alternas) desde (cx, cy), recortados al rectángulo de la tarjeta (centrada en 0,0, con 4 px de margen). */
  private sunburst(g: Phaser.GameObjects.Graphics, cx: number, cy: number, w: number, h: number, color: number, alpha: number) {
    const R = w / 2 - 4;
    const L = -R;
    const B = h / 2 - 4;
    const T = -B;
    const TAU = Math.PI * 2;
    const norm = (a: number) => ((a % TAU) + TAU) % TAU;
    const hit = (a: number) => {
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      let t = Infinity;
      if (dx > 1e-6) t = Math.min(t, (R - cx) / dx);
      else if (dx < -1e-6) t = Math.min(t, (L - cx) / dx);
      if (dy > 1e-6) t = Math.min(t, (B - cy) / dy);
      else if (dy < -1e-6) t = Math.min(t, (T - cy) / dy);
      return { x: cx + dx * t, y: cy + dy * t };
    };
    const corners = [[R, B], [L, B], [L, T], [R, T]].map(([x, y]) => ({ x, y, a: norm(Math.atan2(y - cy, x - cx)) }));
    const n = 12;
    g.fillStyle(color, alpha);
    for (let i = 0; i < n; i++) {
      const a0 = norm((i / n) * TAU + 0.12);
      const span = (TAU / n) * 0.5;
      const pts = [{ x: cx, y: cy }, hit(a0)];
      // esquinas dentro de la cuña, en orden de ángulo
      corners
        .filter((k) => norm(k.a - a0) < span)
        .sort((p, q) => norm(p.a - a0) - norm(q.a - a0))
        .forEach((k) => pts.push({ x: k.x, y: k.y }));
      pts.push(hit(a0 + span));
      g.fillPoints(pts, true);
    }
  }

  /** Bonus final (ruleta) a todo el ancho; (x, y) = centro. */
  private bonusCard(x: number, y: number, w: number, h: number, s: PlayerState, level: number) {
    const card = this.add.container(x, y);
    const spinIndex = bpBonusSpinIndex(s);
    const pending = spinIndex >= 0 && !s.wheel.bonusSpins[spinIndex]?.claimed;
    const unlocked = level >= BP_TIERS;
    const ready = unlocked && (!s.bp.bonusClaimed || pending);
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.42).fillRoundedRect(-w / 2 + 3, -h / 2 + 5, w, h, 18);
    bg.fillStyle(0x20183d, 0.98).fillRoundedRect(-w / 2, -h / 2, w, h, 18);
    bg.fillStyle(0xffffff, 0.07).fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h * 0.42, { tl: 15, tr: 15, bl: 5, br: 5 });
    bg.lineStyle(ready ? 6 : 4, ready ? GOLD : 0x80682e, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 18);
    card.add(bg);

    const wheel = this.add.graphics({ x: -w / 2 + 60, y: 0 });
    const colors = [GOLD, 0xff6d4a, 0x5fd0ff, 0x9b72ff, 0x68d966, 0xff80b8];
    const radius = 34;
    for (let i = 0; i < 6; i++) {
      const a0 = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const a1 = ((i + 1) / 6) * Math.PI * 2 - Math.PI / 2;
      const points = [{ x: 0, y: 0 }];
      for (let j = 0; j <= 5; j++) {
        const a = a0 + ((a1 - a0) * j) / 5;
        points.push({ x: Math.cos(a) * radius, y: Math.sin(a) * radius });
      }
      wheel.fillStyle(colors[i], 1).fillPoints(points, true);
    }
    wheel.lineStyle(3, 0xffffff, 1).strokeCircle(0, 0, radius);
    wheel.fillStyle(0xffffff, 1).fillTriangle(-5, -radius - 2, 5, -radius - 2, 0, -radius + 8);
    card.add(wheel);

    card.add(this.add.text(-w / 2 + 112, -18, pending ? '¡RULETA DISPONIBLE!' : 'BONUS FINAL', {
      fontFamily: FONT, fontSize: '26px', color: ready ? '#ffd23f' : '#ffffff', fontStyle: 'bold',
    }).setOrigin(0, 0.5));
    const sub = pending ? 'Toca aquí para girar' : s.bp.bonusClaimed ? 'BONUS RECLAMADO' : '1 GIRO DE RULETA · COMPARTIDO';
    card.add(this.add.text(-w / 2 + 113, 19, sub, { fontFamily: FONT, fontSize: '15px', color: '#c4d2f0' }).setOrigin(0, 0.5).setLetterSpacing(1));

    if (s.bp.bonusClaimed && !pending) {
      const ok = this.add.graphics({ x: w / 2 - 30, y: 0 });
      ok.fillStyle(0x07152f, 1).fillCircle(0, 0, 20).fillStyle(0x35c85a, 1).fillCircle(0, 0, 16);
      ok.lineStyle(4, 0xffffff, 1).beginPath().moveTo(-7, 0).lineTo(-2, 6).lineTo(8, -6).strokePath();
      card.add(ok);
    } else {
      card.setSize(w, h).setInteractive({ useHandCursor: true });
      card.on('pointerup', (p: Phaser.Input.Pointer) => {
        if (this.moved > 12 || p.y < this.listTop) return;
        this.openBonusWheel();
      });
    }
    if (!unlocked && !s.bp.bonusClaimed) card.add(this.add.rectangle(0, 0, w, h, 0x02060f, 0.5));
    return card;
  }

  private openBonusWheel() {
    const s = getPlayer() as PlayerState;
    let index = bpBonusSpinIndex(s);
    if (!s.bp.bonusClaimed) {
      const res = commit((state) => bpClaimBonus(state));
      if (!res.ok) return this.toast('Completa el pase para desbloquear el bonus');
      index = res.bonusIndex;
      this.cameras.main.fadeOut(160, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Wheel', { index, bonus: true }));
      return;
    }
    if (index >= 0 && !s.wheel.bonusSpins[index]?.claimed) {
      this.cameras.main.fadeOut(160, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Wheel', { index, bonus: true }));
    }
  }

  private drawReward(g: Phaser.GameObjects.Graphics, r: BpReward) {
    if (r.kind === 'cash') drawCashIcon(g, 1.3);
    else if (r.kind === 'rays') {
      // Rayo de la ZONA: rayo amarillo sobre un disco
      g.fillStyle(0x07152f, 1).fillCircle(0, 0, 28);
      g.lineStyle(3, 0xffd23f, 1).strokeCircle(0, 0, 26);
      const bolt = [{ x: 4, y: -20 }, { x: -11, y: 3 }, { x: -1, y: 3 }, { x: -5, y: 20 }, { x: 11, y: -4 }, { x: 1, y: -4 }];
      g.fillStyle(0x0a1638, 1).fillPoints(bolt.map((p) => ({ x: p.x + 2, y: p.y + 2 })), true);
      g.fillStyle(0xffe14a, 1).fillPoints(bolt, true);
    } else if (r.kind === 'character') {
      const accent = r.style ? GOLD : NEON;
      g.fillStyle(0x07152f, 1).fillCircle(0, 0, 29);
      g.lineStyle(3, accent, 1).strokeCircle(0, 0, 27);
      g.fillStyle(accent, 0.25).fillCircle(0, 0, 23);
    } else if (r.item.startsWith('emote:')) {
      // emote: disco claro detrás de la carita (la imagen la pone rewardCell)
      g.fillStyle(0x07152f, 1).fillCircle(0, 0, 29);
      g.fillStyle(0xffffff, 0.9).fillCircle(0, 0, 26);
    } else if (r.item.startsWith('charge:')) {
      // cargando golpe: aro del suelo con el color del efecto
      const col = chargeFxDef(r.item.split(':')[1] as ChargeFxId).color;
      g.fillStyle(0x0a1638, 1).fillRoundedRect(-24, -24, 48, 48, 12);
      g.lineStyle(7, col, 0.35).strokeEllipse(0, 6, 40, 16);
      g.lineStyle(3, col, 1).strokeEllipse(0, 6, 36, 13);
      g.fillStyle(0xffffff, 0.9).fillCircle(0, -8, 5);
    } else if (r.item.startsWith('style:')) {
      // efecto pelota: la pelota con su estela del color del estilo
      const trail = styleLook(r.item.split(':')[1]).trail;
      g.fillStyle(0x0a1638, 1).fillRoundedRect(-24, -24, 48, 48, 12);
      for (let i = 0; i < 4; i++) g.fillStyle(trail, 0.25 + i * 0.18).fillCircle(-15 + i * 6, 9 - i * 4, 3 + i);
      g.fillStyle(0x0a1638, 1).fillCircle(9, -7, 10);
      g.fillStyle(0xd7f53a, 1).fillCircle(9, -7, 8);
      g.fillStyle(0xffffff, 0.7).fillCircle(6, -10, 2.5);
    } else {
      const col = STYLE_SWATCH[r.item] ?? 0x8a93a6;
      g.fillStyle(0x0a1638, 1).fillRoundedRect(-24, -24, 48, 48, 12);
      g.fillStyle(col, 1).fillRoundedRect(-20, -20, 40, 40, 10);
      g.fillStyle(0xffffff, 0.3).fillRoundedRect(-15, -16, 30, 8, 4);
    }
  }

  // ================================================================ acciones
  private claim(track: BpTrack, tier: number, x: number, y: number) {
    const res = commit((s) => bpClaim(s, track, tier));
    if (!res.ok) return this.toast(res.error === 'not_premium' ? 'Necesitas el Pase Premium' : 'Aún no disponible');
    this.burst(x, y, track === 'prem' ? GOLD : 0x8fd0ff);
    this.toast(`¡${rewardLabel(res.given).top}!`);
  }

  private claimWelcome(track: BpTrack, x: number, y: number) {
    const res = commit((s) => bpClaimWelcome(s, track));
    if (!res.ok) return this.toast(res.error === 'not_premium' ? 'Necesitas el Pase Premium' : 'Regalo ya reclamado');
    this.burst(x, y, track === 'prem' ? GOLD : 0x8fd0ff);
    this.toast(`¡${rewardLabel(res.given).top} ${rewardLabel(res.given).sub}!`);
  }

  private buyPremium() {
    const res = commit((s) => bpBuyPremium(s));
    if (!res.ok) {
      const cash = getPlayer().gems;
      if (res.error === 'real_money') return this.toast(`Pase Premium ${BP_SEASON.premiumRealPrice} · pago con dinero real: próximamente`);
      return this.toast(res.error === 'not_enough_cash' ? `Te faltan ${BP_SEASON.premiumCash - cash} de dinero: consíguelo en el camino gratis del pase` : 'Ya tienes el Pase Premium');
    }
    this.burst(this.scale.width - 170, 200, GOLD);
    this.toast('¡PASE PREMIUM ACTIVADO!');
  }

  // ================================================================ desplazamiento
  private setupScroll() {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.y < this.listTop) return;
      if (p.x > this.scale.width - 100 && p.y > this.scale.height - 110) return;
      this.tweens.killTweensOf(this.scrollMotion);
      this.dragging = true;
      this.dragFrom = p.y;
      this.dragOffset = this.listOffset;
      this.moved = 0;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.dragging || !p.isDown) return;
      const dy = p.y - this.dragFrom;
      this.moved = Math.max(this.moved, Math.abs(dy));
      this.updateListScroll(this.dragOffset - dy);
    });
    this.input.on('pointerup', () => {
      this.dragging = false;
      this.time.delayedCall(0, () => (this.moved = 0));
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      this.updateListScroll(this.listOffset + dy);
    });
  }

  private scrollMotion = { offset: 0 };

  private updateListScroll(offset: number) {
    this.listOffset = Phaser.Math.Clamp(offset, 0, -this.scrollMin);
    this.ensureRows();
    this.refreshBottomControl();
  }

  private refreshBottomControl() {
    const maxOffset = -this.scrollMin;
    const atBonus = maxOffset > 0 && this.listOffset >= maxOffset - 12;
    if (this.bottomIndicator) {
      const row = Math.min(BP_TIERS, Math.max(1, Math.floor(this.listOffset / ROW_H) + 1));
      this.bottomIndicator.setText(atBonus ? 'BONUS' : `NIVEL ${row}`).setVisible(this.listOffset >= ROW_H / 2);
    }
    if (this.bottomArrowGraphics) {
      const g = this.bottomArrowGraphics;
      g.clear();
      g.fillStyle(0x07152f, 0.96).fillCircle(0, 0, 30);
      g.lineStyle(3, GOLD, 1).strokeCircle(0, 0, 30);
      g.lineStyle(6, 0xffffff, 1).beginPath();
      if (atBonus) g.moveTo(-10, 5).lineTo(0, -6).lineTo(10, 5).strokePath();
      else g.moveTo(-10, -5).lineTo(0, 6).lineTo(10, -5).strokePath();
    }
  }

  private addBottomButton() {
    const x = this.scale.width - 48;
    const y = this.scale.height - 54;
    const button = this.add.container(x, y).setDepth(200);
    const g = this.add.graphics();
    button.add(g);
    this.bottomArrowGraphics = g;
    button.setSize(64, 64).setInteractive({ useHandCursor: true });
    this.bottomIndicator = this.add.text(x, y - 44, '', { fontFamily: FONT, fontSize: '14px', color: '#ffffff', backgroundColor: '#07152f', padding: { x: 9, y: 5 } })
      .setOrigin(0.5)
      .setDepth(201)
      .setVisible(false);
    button.on('pointerdown', () => {
      this.tweens.killTweensOf(this.scrollMotion);
      this.scrollMotion.offset = this.listOffset;
      const atBonus = this.listOffset >= -this.scrollMin - 12;
      this.tweens.add({
        targets: this.scrollMotion,
        offset: atBonus ? 0 : -this.scrollMin,
        duration: 650,
        ease: 'Cubic.easeInOut',
        onUpdate: () => this.updateListScroll(this.scrollMotion.offset),
      });
    });
  }

  // ================================================================ piezas
  /**
   * Botón verde de precio al estilo Clash Royale ("¡Mejorar!"): rectángulo redondeado verde brillante con borde oscuro,
   * canto inferior más oscuro (relieve), brillo arriba y el texto blanco con contorno. Se hunde al pulsarlo.
   */
  private priceButton(x: number, y: number, w: number, h: number, label: string, onClick: () => void) {
    const c = this.add.container(x, y);
    const face = this.add.container(0, 0);
    const r = 14;
    const g = this.add.graphics();
    g.fillStyle(0x0b3d12, 1).fillRoundedRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 9, r + 3); // borde oscuro
    g.fillStyle(0x1f8a2c, 1).fillRoundedRect(-w / 2, -h / 2 + 4, w, h, r); // canto inferior (relieve)
    g.fillStyle(0x43c83c, 1).fillRoundedRect(-w / 2, -h / 2, w, h, r);
    g.fillStyle(0x6fe05a, 1).fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h * 0.48, { tl: r - 2, tr: r - 2, bl: 6, br: 6 });
    g.fillStyle(0xffffff, 0.35).fillRoundedRect(-w / 2 + 10, -h / 2 + 6, w - 20, 7, 4); // brillo
    face.add(g);
    const t = this.add.text(0, 1, label, { fontFamily: FONT, fontSize: `${Math.round(h * 0.42)}px`, color: '#ffffff', stroke: '#0b3d12', strokeThickness: 6 }).setOrigin(0.5);
    t.setShadow(0, 3, '#0b3d12', 0, true, false);
    fitText(t, w - 20);
    face.add(t);
    c.add(face);
    c.setSize(w, h + 6).setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => face.setY(3));
    c.on('pointerout', () => face.setY(0));
    c.on('pointerup', () => {
      face.setY(0);
      onClick();
    });
    return c;
  }

  private burst(x: number, y: number, col: number) {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const st = this.add.star(x, y, 5, 4, 10, Phaser.Utils.Array.GetRandom([col, 0xffffff])).setDepth(9000).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: st, x: x + Math.cos(a) * 120, y: y + Math.sin(a) * 90, angle: 240, alpha: 0, duration: 600, ease: 'Cubic.easeOut', onComplete: () => st.destroy() });
    }
  }

  private backButton(x: number, y: number, onClick: () => void) {
    const c = this.add.container(x, y);
    const s = 64;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.35).fillRoundedRect(-s / 2 + 3, -s / 2 + 5, s, s, 18);
    g.fillStyle(NAVY, 0.94).fillRoundedRect(-s / 2, -s / 2, s, s, 18);
    g.lineStyle(3, NEON, 1).strokeRoundedRect(-s / 2, -s / 2, s, s, 18);
    g.lineStyle(6, 0xffffff, 1).beginPath().moveTo(6, -13).lineTo(-8, 0).lineTo(6, 13).strokePath();
    c.add(g);
    c.setSize(s, s).setInteractive({ useHandCursor: true }).setDepth(150);
    c.on('pointerdown', () => {
      this.tweens.add({ targets: c, scale: { from: 0.88, to: 1 }, duration: 180, ease: 'Back.easeOut' });
      onClick();
    });
  }

  private toast(msg: string) {
    const W = this.scale.width;
    const H = this.scale.height;
    const t = this.add.text(W / 2, H * 0.5, msg, { ...textStyle(24), align: 'center', wordWrap: { width: W - 80 } }).setOrigin(0.5).setDepth(9000).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, y: t.y - 20, duration: 200 });
    this.tweens.add({ targets: t, alpha: 0, delay: 1500, duration: 300, onComplete: () => t.destroy() });
  }
}

/** Billetes (dinero), mismo dibujo que el contador del menú, a escala `k`. */
export function drawCashIcon(g: Phaser.GameObjects.Graphics, k = 1, x = 0, y = 0) {
  const b = (dx: number, dy: number, col: number) => {
    g.fillStyle(0x1a1033, 1).fillRoundedRect(x + dx - 16 * k, y + dy - 10 * k, 32 * k, 20 * k, 4 * k);
    g.fillStyle(col, 1).fillRoundedRect(x + dx - 14 * k, y + dy - 8 * k, 28 * k, 16 * k, 3 * k);
    g.fillStyle(0xcdeccf, 1).fillCircle(x + dx, y + dy, 4.5 * k);
    g.lineStyle(1.5 * k, 0x2b7a40, 1).strokeRoundedRect(x + dx - 11 * k, y + dy - 5 * k, 22 * k, 10 * k, 2 * k);
  };
  b(-3 * k, -5 * k, 0x2f8f48); // billete de atrás
  b(3 * k, 4 * k, 0x3fae5a);
}

/** Textos del premio. */
function rewardLabel(r: BpReward): { top: string; sub: string } {
  if (r.kind === 'cash') return { top: String(r.amount), sub: 'DINERO' };
  if (r.kind === 'rays') return { top: `${r.amount} ${r.amount === 1 ? 'RAYO' : 'RAYOS'}`, sub: 'PARA LA ZONA' };
  if (r.kind === 'character') return { top: r.name.toUpperCase(), sub: r.style ? 'PERSONAJE · ESTILO ORO' : 'PERSONAJE NUEVO' };
  const sub = r.item.startsWith('emote:') ? 'EMOTE' : r.item.startsWith('charge:') ? 'CARGANDO GOLPE' : r.item.startsWith('style:') ? 'EFECTO PELOTA' : r.item.startsWith('color:') ? 'COLOR DE ROPA' : 'ESTILO';
  return { top: r.name.replace('Estilo ', '').toUpperCase(), sub };
}
