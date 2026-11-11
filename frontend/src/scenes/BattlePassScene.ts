import Phaser from 'phaser';
import { FONT, restartOnResize, textStyle } from '../ui/theme';
import { stadiumBg } from '../ui/ui';
import { arcadeButton } from '../ui/modeButtons';
import { drawGiftIcon } from '../ui/wheelArt';
import { fitText } from '../ui/fitText';
import { commit, getPlayer, onPlayerChange } from '../domain/playerStore';
import { BP_SEASON, BP_TIERS, type BpReward, type BpTrack, bpBonusSpinIndex, bpBuyPremium, bpCanClaim, bpClaim, bpClaimBonus, bpClaimWelcome, bpLevel, syncSeason } from '../domain/battlePass';
import type { PlayerState } from '../domain/player';
import { type ChargeFxId, chargeFxDef } from '../domain/chargeFx';
import type { EmoteKind } from '../domain/emotes';
import { EMOTE_TEXTURE, queueEmoteArt } from '../ui/Emotes';
import { styleLook } from '../ui/styleLook';
import { CHAR_COLOR_LIST } from '../domain/charColors';

/**
 * PASE DE BATALLA: niveles que se llenan con la EXP ganada; cada nivel tiene premio GRATIS
 * (izquierda) y PREMIUM (derecha). Lista vertical desplazable (arrastrar). Reclamar se valida y
 * guarda en domain/battlePass (una sola vez por premio).
 */
const NAVY = 0x0b1733;
const NEON = 0x3a7bff;
const GOLD = 0xffc42e;
const ROW_H = 112;

const STYLE_SWATCH: Record<string, number> = {
  'style:red': 0xff4f5e,
  'style:green': 0x62d935,
  'style:gold': 0xffc42e,
  'style:classic': 0x3a8bff,
  // estilos de color del personaje (Claude, domain/charColors.ts): muestra del color de su ropa
  ...Object.fromEntries(CHAR_COLOR_LIST.map((c) => [`color:${c.id}`, c.color])),
};

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
  private firstRenderedTier = -1;
  private listOffset = 0;
  private bottomIndicator?: Phaser.GameObjects.Text;
  private bottomArrowGraphics?: Phaser.GameObjects.Graphics;

  constructor() {
    super('BattlePass');
  }

  preload() {
    if (!this.textures.exists('menu-bg')) this.load.image('menu-bg', 'assets/menu-bg.webp');
    if (!this.textures.exists('battle-pass-title')) this.load.image('battle-pass-title', 'assets/titulo-pase-batalla.png');
    if (!this.textures.exists('battle-pass-insignia')) this.load.image('battle-pass-insignia', 'assets/insignia-pase-batalla.png');
    // retrato de Mai: ya lo carga BootScene (characters/portrait.ts); solo se descarga si falta (1,3 MB)
    if (!this.textures.exists('portrait-mai')) this.load.image('portrait-mai', 'assets/characters/mai_portrait.png');
    queueEmoteArt(this.load); // premios: emotes (miniaturas de ~32 KB)
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    restartOnResize(this);
    this.cameras.main.fadeIn(200, 0, 0, 0);
    stadiumBg(this, 0.6);
    // temporada al día (si cambió, el pase empieza de cero)
    commit((s) => ({ ok: true as const, state: syncSeason(s) }));

    // cabecera
    this.backButton(54, 76, () => {
      this.cameras.main.fadeOut(180, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Menu'));
    });
    const passTitleW = Math.min(460, W - 160);
    this.add.image(W / 2 + 20, 68, 'battle-pass-title').setDisplaySize(passTitleW, passTitleW / 3);

    this.top = this.add.container(0, 0);
    this.listTop = 411;
    this.listH = H - this.listTop - 20;
    this.list = this.add.container(0, this.listTop);
    const maskG = this.make.graphics({}, false);
    maskG.fillStyle(0xffffff).fillRect(0, this.listTop, W, this.listH);
    this.list.setMask(maskG.createGeometryMask());
    this.buildTop();
    this.setupScroll();
    this.addBottomButton();
    // las ~25 tarjetas de la lista son lo más pesado: se dibujan en el siguiente cuadro, con la cabecera ya en pantalla
    let listReady = false;
    this.time.delayedCall(0, () => {
      listReady = true;
      this.buildList(true);
    });
    const off = onPlayerChange(() => {
      this.buildTop();
      if (listReady) this.buildList(false);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => off());
  }

  // ================================================================ cabecera de progreso
  private buildTop() {
    const W = this.scale.width;
    this.top.removeAll(true);
    const s = syncSeason(getPlayer() as PlayerState);
    const { level, into, progress } = bpLevel(s.bp.xp);
    const x = 24;
    const w = W - 48;

    // progreso
    const y = 136;
    const h = 110;
    this.top.add(this.card(x, y, w, h, NEON));
    this.top.add(this.add.image(x + 62, y + h / 2, 'battle-pass-insignia').setDisplaySize(100, 120));
    this.top.add(this.add.text(x + 62, y + h / 2 - 6, 'NIV', { fontFamily: FONT, fontSize: '14px', color: '#0a1638', stroke: '#fff0a8', strokeThickness: 2 }).setOrigin(0.5));
    this.top.add(this.add.text(x + 62, y + h / 2 + 20, String(level), { fontFamily: FONT, fontSize: '34px', color: '#0a1638', stroke: '#fff0a8', strokeThickness: 3 }).setOrigin(0.5));
    const done = level >= BP_TIERS;
    this.top.add(this.add.text(x + 122, y + 30, done ? '¡PASE COMPLETADO!' : `NIVEL ${level + 1} DE ${BP_TIERS}`, { fontFamily: FONT, fontSize: '24px', color: '#ffffff' }).setOrigin(0, 0.5));
    const bx = x + 122;
    const bw = w - 146;
    const by = y + 56;
    const g = this.add.graphics();
    g.fillStyle(0x05112c, 1).fillRoundedRect(bx, by, bw, 18, 9).lineStyle(1, 0x2a4a8a, 1).strokeRoundedRect(bx, by, bw, 18, 9);
    const fw = Math.max(18, bw * (done ? 1 : progress));
    g.fillStyle(0x1f7bff, 1).fillRoundedRect(bx, by, fw, 18, 9);
    g.fillStyle(0x5fd0ff, 1).fillRoundedRect(bx, by, fw, 9, { tl: 9, tr: 9, bl: 0, br: 0 });
    this.top.add(g);
    this.top.add(this.add.text(bx + bw - 8, by + 10, done ? 'COMPLETO' : `${into} / ${BP_SEASON.xpPerTier} EXP`, { fontFamily: FONT, fontSize: '16px', color: '#d9efff', stroke: '#071332', strokeThickness: 3 }).setOrigin(1, 0.5));
    this.top.add(this.add.text(bx, by + 34, done ? 'Has llegado al último nivel' : 'Gana EXP jugando partidas', { fontFamily: FONT, fontSize: '15px', color: '#c4d7f7' }).setOrigin(0, 0.5));

    // premium
    const py = y + h + 24;
    const ph = 82;
    this.top.add(this.card(x, py, w, ph, GOLD, 0x2a2108));
    const crown = this.add.graphics({ x: x + 50, y: py + ph / 2 });
    crown.fillStyle(0x0a1638, 1).fillPoints([{ x: -24, y: 14 }, { x: -27, y: -14 }, { x: -12, y: -2 }, { x: 0, y: -20 }, { x: 12, y: -2 }, { x: 27, y: -14 }, { x: 24, y: 14 }], true);
    crown.fillStyle(GOLD, 1).fillPoints([{ x: -20, y: 10 }, { x: -22, y: -8 }, { x: -11, y: 2 }, { x: 0, y: -14 }, { x: 11, y: 2 }, { x: 22, y: -8 }, { x: 20, y: 10 }], true);
    this.top.add(crown);
    this.top.add(this.add.text(x + 92, py + 30, 'PASE PREMIUM', { fontFamily: FONT, fontSize: '24px', color: '#ffd23f' }).setOrigin(0, 0.5));
    if (s.bp.premium) {
      this.top.add(this.add.text(x + 92, py + 62, 'Activo: reclama los premios dorados', { fontFamily: FONT, fontSize: '16px', color: '#9fe8a0' }).setOrigin(0, 0.5));
    } else {
      this.top.add(this.add.text(x + 92, py + 62, 'Desbloquea todos los premios dorados', { fontFamily: FONT, fontSize: '16px', color: '#e7cf8a' }).setOrigin(0, 0.5));
      const btn = arcadeButton(this, x + w - 96, py + ph / 2, 160, 60, BP_SEASON.premiumRealPrice, () => this.buyPremium(), { palette: 'yellow' });
      this.top.add(btn);
    }

    // títulos de columnas
    const cy = this.listTop - 20;
    const cardW = (W - 48 - 96) / 2;
    const pill = (px: number, label: string, line: number, fill: number, col: string, crown: boolean) => {
      const pw = Math.min(cardW, 250);
      const g = this.add.graphics();
      g.fillStyle(fill, 1).fillRoundedRect(px - pw / 2, cy - 16, pw, 32, 16);
      g.lineStyle(3, line, 1).strokeRoundedRect(px - pw / 2, cy - 16, pw, 32, 16);
      this.top.add(g);
      if (crown) {
        const c = this.add.graphics({ x: px - pw / 2 + 32, y: cy });
        c.fillStyle(GOLD, 1).fillPoints([{ x: -17, y: 10 }, { x: -18, y: -9 }, { x: -8, y: 1 }, { x: 0, y: -14 }, { x: 8, y: 1 }, { x: 18, y: -9 }, { x: 17, y: 10 }], true);
        this.top.add(c);
      } else {
        const gift = this.add.graphics();
        drawGiftIcon(gift, 14, px - pw / 2 + 32, cy + 2);
        this.top.add(gift);
      }
      this.top.add(this.add.text(px + 15, cy, label, { fontFamily: FONT, fontSize: '20px', color: col, stroke: '#061431', strokeThickness: 3 }).setOrigin(0.5).setLetterSpacing(2));
    };
    pill(24 + cardW / 2, 'GRATIS', NEON, 0x10224a, '#cfe0ff', false);
    pill(W - 24 - cardW / 2, s.bp.premium ? 'PREMIUM · ACTIVO' : 'PREMIUM', GOLD, 0x3a2b08, '#ffd23f', true);
  }

  // ================================================================ lista de niveles
  private buildList(scrollToCurrent: boolean) {
    const W = this.scale.width;
    const keepOffset = this.listOffset;
    const s = syncSeason(getPlayer() as PlayerState);
    const { level, progress } = bpLevel(s.bp.xp);
    const cardW = (W - 48 - 96) / 2;
    const cx = this.numberColumnX(W, cardW);
    const total = this.rowTop(BP_TIERS + 2);
    this.scrollMin = Math.min(0, this.listH - total - 10);
    if (scrollToCurrent) {
      this.listOffset = 0;
    } else this.listOffset = Phaser.Math.Clamp(keepOffset, 0, -this.scrollMin);
    this.firstRenderedTier = -1;
    this.renderVisibleRows(s, level, progress, cardW, cx);
  }

  /**
   * y (dentro de la lista) donde empieza cada fila. Todas miden ROW_H salvo la del ÚLTIMO nivel (el personaje nuevo),
   * que mide el doble para que luzca; la fila del bonus queda después.
   */
  private rowTop(row: number) {
    return row * ROW_H + (row > BP_TIERS ? ROW_H : 0);
  }

  private rowHeight(row: number) {
    return row === BP_TIERS ? ROW_H * 2 : ROW_H;
  }

  /** Mantiene solo las filas visibles y un pequeño margen, para reducir el trabajo gráfico en móvil. */
  private renderVisibleRows(s: PlayerState, level: number, progress: number, cardW: number, cx: number) {
    // Conserva un margen amplio: así no reconstruimos tarjetas cada vez que cruza una fila.
    const first = Math.max(0, Math.floor(this.listOffset / (ROW_H * 3)) * 3 - 2);
    if (first === this.firstRenderedTier) {
      this.list.y = this.listTop + this.rowTop(first) - this.listOffset;
      return;
    }
    this.firstRenderedTier = first;
    // los destellos animados de la tarjeta del personaje se recrean con ella: se quitan los anteriores
    for (const t of this.tallTweens) t.remove();
    this.tallTweens = [];
    this.list.removeAll(true);
    const last = Math.min(BP_TIERS + 2, first + Math.ceil(this.listH / ROW_H) + 4);
    const baseY = this.rowTop(first);
    const rangeH = this.rowTop(last) - baseY; // alto de las filas dibujadas
    const panels = this.add.graphics();
    const panelW = cardW + 30;
    const leftX = 24 + cardW / 2;
    const rightX = this.scale.width - 24 - cardW / 2;
    panels.fillStyle(0x061534, 0.82).fillRoundedRect(leftX - panelW / 2, 0, panelW, rangeH, 30);
    panels.lineStyle(3, 0x174c9b, 0.9).strokeRoundedRect(leftX - panelW / 2, 0, panelW, rangeH, 30);
    panels.fillStyle(0x251a06, 0.84).fillRoundedRect(rightX - panelW / 2, 0, panelW, rangeH, 30);
    panels.lineStyle(3, 0x806012, 0.9).strokeRoundedRect(rightX - panelW / 2, 0, panelW, rangeH, 30);
    this.list.add(panels);
    const path = this.add.graphics();
    path.fillStyle(0x0a1638, 1).fillRoundedRect(cx - 9, ROW_H / 2, 18, rangeH - ROW_H, 9);
    path.fillStyle(0x223156, 1).fillRoundedRect(cx - 6, ROW_H / 2, 12, rangeH - ROW_H, 6);
    // el relleno llega al centro del nodo del nivel; el último nivel está más abajo (su fila es el doble de alta)
    const v = level + progress;
    const doneAbs = v <= BP_TIERS - 1 ? v * ROW_H : (BP_TIERS - 1) * ROW_H + (v - (BP_TIERS - 1)) * ROW_H * 1.5;
    const doneY = doneAbs - baseY;
    if (level > first || progress > 0) path.fillStyle(0x5fd0ff, 1).fillRoundedRect(cx - 6, ROW_H / 2, 12, Phaser.Math.Clamp(doneY, 0, rangeH - ROW_H), 6);
    this.list.add(path);
    for (let row = first; row < last; row++) {
      const y = this.rowTop(row) + this.rowHeight(row) / 2 - baseY;
      if (row === 0) {
        const node = this.add.graphics({ x: cx, y });
        node.fillStyle(0x0a1638, 1).fillCircle(0, 0, 26);
        node.fillStyle(0x5fd0ff, 1).fillCircle(0, 0, 22);
        this.list.add(node);
        this.list.add(this.add.text(cx, y, 'XP', { fontFamily: FONT, fontSize: '15px', color: '#07152f', fontStyle: 'bold' }).setOrigin(0.5));
        this.rewardCard(24 + cardW / 2, y, cardW, 'free', 0, s);
        this.rewardCard(this.scale.width - 24 - cardW / 2, y, cardW, 'prem', 0, s);
        continue;
      }
      if (row === BP_TIERS + 1) {
        const node = this.add.graphics({ x: cx, y });
        node.fillStyle(0x0a1638, 1).fillCircle(0, 0, 28);
        node.fillStyle(GOLD, 1).fillCircle(0, 0, 23);
        this.list.add(node);
        this.list.add(this.add.text(cx, y, '★', { fontFamily: FONT, fontSize: '24px', color: '#0a1638' }).setOrigin(0.5));
        this.bonusCard(cx, y, this.scale.width - 48, s, level);
        continue;
      }
      const tier = row;
      const reached = level >= tier;
      const node = this.add.graphics({ x: cx, y });
      node.fillStyle(0x0a1638, 1).fillCircle(0, 0, 26);
      node.fillStyle(reached ? 0x2f8bff : 0x2a3556, 1).fillCircle(0, 0, 22);
      this.list.add(node);
      this.list.add(this.add.text(cx, y, String(tier), { fontFamily: FONT, fontSize: '22px', color: reached ? '#ffffff' : '#7f93bf' }).setOrigin(0.5));
      this.rewardCard(24 + cardW / 2, y, cardW, 'free', tier, s);
      this.rewardCard(this.scale.width - 24 - cardW / 2, y, cardW, 'prem', tier, s);
    }
    this.list.y = this.listTop + baseY - this.listOffset;
  }

  private rewardCard(x: number, y: number, w: number, track: BpTrack, tier: number, s: PlayerState) {
    const welcome = tier === 0;
    const reward = welcome ? BP_SEASON.welcome[track] : BP_SEASON.tiers[tier - 1][track];
    const err = welcome
      ? (track === 'prem' && !s.bp.premium ? 'not_premium' : (track === 'free' ? s.bp.welcomeFreeClaimed : s.bp.welcomePremClaimed) ? 'already_claimed' : null)
      : bpCanClaim(s, track, tier);
    const claimed = err === 'already_claimed';
    const ready = err === null;
    const prem = track === 'prem';
    // el último nivel (el personaje nuevo) ocupa el doble de alto
    const tall = !welcome && tier === BP_TIERS && reward.kind === 'character' && this.textures.exists('portrait-mai');
    const h = (tall ? ROW_H * 2 : ROW_H) - 10;
    const c = this.add.container(x, y);
    c.setScale(prem ? 1.02 : 0.94);
    const g = this.add.graphics();
    const accent = prem ? GOLD : NEON;
    g.fillStyle(0x000000, 0.35).fillRoundedRect(-w / 2 + 3, -h / 2 + 5, w, h, 16);
    if (ready) g.lineStyle(10, accent, 0.35).strokeRoundedRect(-w / 2, -h / 2, w, h, 16);
    if (prem) g.fillGradientStyle(0x674200, 0x3a2808, 0x2d2108, 0x171405, 1);
    else g.fillGradientStyle(0x164a9b, 0x0b2d68, 0x092453, 0x081735, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 16);
    g.fillStyle(0xffffff, 0.05).fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h * 0.4, { tl: 13, tr: 13, bl: 4, br: 4 });
    g.lineStyle(prem ? 4 : 3, ready ? accent : prem ? 0xc9962a : 0x2c3d66, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 16);
    if (prem) g.fillStyle(GOLD, 0.12).fillRoundedRect(-w / 2 + 3, h / 2 - 26, w - 6, 23, { tl: 4, tr: 4, bl: 13, br: 13 });
    c.add(g);
    const needPrem = prem && !s.bp.premium;

    if (tall && reward.kind === 'character') this.characterShowcase(c, w, h, prem, reward, ready ? accent : prem ? 0xc9962a : 0x2c3d66);
    else {
      // icono + texto del premio
      const ic = this.add.graphics({ x: -w / 2 + 44, y: 0 });
      this.drawReward(ic, reward);
      c.add(ic);
      if (reward.kind === 'item' && reward.item.startsWith('emote:')) {
        const key = EMOTE_TEXTURE[reward.item.split(':')[1] as EmoteKind];
        if (key && this.textures.exists(key)) c.add(this.add.image(-w / 2 + 44, 0, key).setDisplaySize(48, 48));
      }
      if (reward.kind === 'character' && this.textures.exists('portrait-mai')) {
        c.add(this.add.image(-w / 2 + 44, 0, 'portrait-mai').setDisplaySize(47, 62));
        if (reward.style) {
          const styleBadge = this.add.graphics({ x: -w / 2 + 63, y: -h / 2 + 14 });
          styleBadge.fillStyle(GOLD, 1).fillCircle(0, 0, 11).lineStyle(2, 0xffffff, 1).strokeCircle(0, 0, 11);
          c.add(styleBadge);
          c.add(this.add.text(-w / 2 + 63, -h / 2 + 14, '★', { fontFamily: FONT, fontSize: '13px', color: '#3b2600' }).setOrigin(0.5));
        }
      }
      const label = rewardLabel(reward);
      const t = this.add.text(-w / 2 + 78, -8, label.top, { fontFamily: FONT, fontSize: '26px', color: prem ? '#ffd23f' : '#ffffff', fontStyle: 'bold', stroke: '#06122e', strokeThickness: 3 }).setOrigin(0, 0.5);
      fitText(t, w - 115);
      c.add(t);
      c.add(this.add.text(-w / 2 + 80, 20, label.sub, { fontFamily: FONT, fontSize: '14px', color: '#d1e3ff', stroke: '#06122e', strokeThickness: 2 }).setOrigin(0, 0.5).setLetterSpacing(1));
    }

    if (claimed) {
      c.add(this.add.rectangle(0, 0, w, h, 0x02060f, 0.5));
      const ok = this.add.graphics({ x: w / 2 - 27, y: -h / 2 + 25 });
      ok.fillStyle(0x07152f, 1).fillCircle(0, 0, 19).fillStyle(0x35c85a, 1).fillCircle(0, 0, 15);
      ok.lineStyle(4, 0xffffff, 1).beginPath().moveTo(-7, 0).lineTo(-2, 6).lineTo(8, -6).strokePath();
      c.add(ok);
    } else if (!ready) {
      c.add(this.add.rectangle(0, 0, w, h, 0x02060f, err === 'not_premium' ? 0.25 : 0.42));
      const lk = this.add.graphics({ x: w / 2 - 26, y: -h / 2 + 24 });
      const lc = err === 'not_premium' ? GOLD : 0xc8d2ea;
      lk.lineStyle(3, lc, 1).beginPath().arc(0, -3, 6, Math.PI, 0).strokePath();
      lk.fillStyle(lc, 1).fillRoundedRect(-8, -3, 16, 12, 3);
      c.add(lk);
      if (needPrem) {
        const pill = this.add.graphics();
        pill.fillStyle(GOLD, 1).fillRoundedRect(w / 2 - 120, h / 2 - 27, 108, 19, 9);
        c.add(pill);
        c.add(this.add.text(w / 2 - 66, h / 2 - 17, 'SOLO PREMIUM', { fontFamily: FONT, fontSize: '11px', color: '#241700' }).setOrigin(0.5));
      }
    } else {
      // listo para reclamar: la tarjeta completa es táctil y no necesita una etiqueta adicional.
      c.setSize(w, h).setInteractive({ useHandCursor: true });
      c.on('pointerup', (p: Phaser.Input.Pointer) => {
        // la máscara no recorta los toques: solo dentro de la zona visible de la lista
        if (this.moved > 12 || p.y < this.listTop || p.y > this.listTop + this.listH) return;
        if (welcome) this.claimWelcome(track, c);
        else this.claim(track, tier, c);
      });
    }
    this.list.add(c);
  }

  /**
   * Contenido de la tarjeta grande del último nivel: el personaje nuevo a casi todo el alto de la tarjeta, con rayos de
   * luz y un resplandor detrás, destellos que titilan, su nombre grande y una etiqueta (GRATIS / ESTILO ORO).
   * (0,0) = centro de la tarjeta. `line` = color del borde (se vuelve a trazar encima de los rayos).
   */
  private characterShowcase(c: Phaser.GameObjects.Container, w: number, h: number, prem: boolean, reward: Extract<BpReward, { kind: 'character' }>, line: number) {
    const accent = prem ? GOLD : 0x6fc3ff;
    const box = { x0: 118, y0: 4, x1: 1070, y1: 1356 }; // caja visible de mai_portrait.png (1130 × 1392), como en characters/portrait.ts
    const vh = h - 24;
    const vw = ((box.x1 - box.x0) / (box.y1 - box.y0)) * vh;
    const feetY = h / 2 - 10;
    const px = -w / 2 + 10 + vw / 2;

    // rayos de luz que salen de detrás del personaje (recortados al interior de la tarjeta)
    const rays = this.add.graphics();
    this.sunburst(rays, px, -h * 0.06, w, h, prem ? 0xffd23f : 0x8fd8ff, 0.1);
    c.add(rays);
    // resplandor
    const glow = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    for (const [k, a] of [[1.5, 0.08], [1.2, 0.1], [0.9, 0.12]] as const) glow.fillStyle(accent, a).fillEllipse(px, -h * 0.04, vw * k, vh * 0.95 * (k / 1.5 + 0.3));
    c.add(glow);
    this.tallTweens.push(this.tweens.add({ targets: glow, alpha: { from: 0.55, to: 1 }, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
    // sombra en el suelo
    c.add(this.add.ellipse(px, feetY + 2, vw * 0.95, 14, 0x000000, 0.4));

    // personaje
    const img = this.add.image(px, feetY, 'portrait-mai');
    img.setOrigin(((box.x0 + box.x1) / 2) / img.width, box.y1 / img.height);
    img.setScale(vh / (box.y1 - box.y0));
    c.add(img);

    // destellos que titilan (en la columna del texto y alrededor del personaje)
    const spark: [number, number, number][] = [[0.1, -0.36, 7], [0.62, -0.42, 5], [0.9, -0.12, 6], [0.78, 0.3, 5], [0.04, 0.08, 4], [0.5, 0.44, 4]];
    spark.forEach(([fx, fy, r], i) => {
      const st = this.add.star(-w / 2 + w * fx, h * fy, 4, r * 0.35, r, prem ? 0xfff1b8 : 0xe6f8ff).setBlendMode(Phaser.BlendModes.ADD);
      c.add(st);
      this.tallTweens.push(this.tweens.add({ targets: st, alpha: { from: 0.1, to: 1 }, scale: { from: 0.5, to: 1.15 }, angle: 45, duration: 700 + i * 140, delay: i * 190, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
    });

    // texto: nombre grande + etiqueta
    const left = -w / 2 + 10 + vw + 6;
    const right = w / 2 - 12;
    const colW = right - left;
    const cx = (left + right) / 2;
    const name = this.add.text(cx, -h * 0.14, reward.name.split(' · ')[0].toUpperCase(), { fontFamily: FONT, fontSize: '48px', color: prem ? '#ffd23f' : '#ffffff', fontStyle: 'bold', stroke: '#06122e', strokeThickness: 5 }).setOrigin(0.5);
    fitText(name, colW);
    c.add(name);
    c.add(this.add.text(cx, -h * 0.14 + 36, 'PERSONAJE NUEVO', { fontFamily: FONT, fontSize: '13px', color: '#d1e3ff', stroke: '#06122e', strokeThickness: 2, align: 'center', wordWrap: { width: colW } }).setOrigin(0.5, 0).setLetterSpacing(1));
    const tagY = h * 0.26;
    const tagW = Math.min(colW, 118);
    const tag = this.add.graphics();
    tag.fillStyle(0x06122e, 1).fillRoundedRect(cx - tagW / 2 - 2, tagY - 15, tagW + 4, 30, 15);
    tag.fillStyle(prem ? GOLD : 0x2f8bff, 1).fillRoundedRect(cx - tagW / 2, tagY - 13, tagW, 26, 13);
    tag.fillStyle(0xffffff, 0.3).fillRoundedRect(cx - tagW / 2 + 6, tagY - 11, tagW - 12, 8, 4);
    c.add(tag);
    const tagText = this.add.text(cx, tagY, reward.style ? '★ ESTILO ORO' : 'GRATIS', { fontFamily: FONT, fontSize: '15px', color: prem ? '#3b2600' : '#ffffff' }).setOrigin(0.5);
    fitText(tagText, tagW - 10);
    c.add(tagText);

    // borde encima de los rayos
    const frame = this.add.graphics();
    frame.lineStyle(prem ? 4 : 3, line, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 16);
    c.add(frame);
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

  private bonusCard(x: number, y: number, w: number, s: PlayerState, level: number) {
    const h = ROW_H - 18;
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

    const wheel = this.add.graphics({ x: -w / 2 + 52, y: 0 });
    const colors = [GOLD, 0xff6d4a, 0x5fd0ff, 0x9b72ff, 0x68d966, 0xff80b8];
    const radius = 28;
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

    card.add(this.add.text(-w / 2 + 98, -18, pending ? '¡RULETA DISPONIBLE!' : 'BONUS FINAL', {
      fontFamily: FONT, fontSize: '24px', color: ready ? '#ffd23f' : '#ffffff', fontStyle: 'bold',
    }).setOrigin(0, 0.5));
    const sub = pending ? 'Toca aquí para girar' : s.bp.bonusClaimed ? 'BONUS RECLAMADO' : '1 GIRO DE RULETA · COMPARTIDO';
    card.add(this.add.text(-w / 2 + 99, 19, sub, { fontFamily: FONT, fontSize: '15px', color: '#c4d2f0' }).setOrigin(0, 0.5).setLetterSpacing(1));

    if (s.bp.bonusClaimed && !pending) {
      const ok = this.add.graphics({ x: w / 2 - 30, y: 0 });
      ok.fillStyle(0x07152f, 1).fillCircle(0, 0, 20).fillStyle(0x35c85a, 1).fillCircle(0, 0, 16);
      ok.lineStyle(4, 0xffffff, 1).beginPath().moveTo(-7, 0).lineTo(-2, 6).lineTo(8, -6).strokePath();
      card.add(ok);
    } else {
      card.setSize(w, h).setInteractive({ useHandCursor: true });
      card.on('pointerup', (p: Phaser.Input.Pointer) => {
        if (this.moved > 12 || p.y < this.listTop || p.y > this.listTop + this.listH) return;
        this.openBonusWheel();
      });
    }
    if (!unlocked && !s.bp.bonusClaimed) card.add(this.add.rectangle(0, 0, w, h, 0x02060f, 0.5));
    this.list.add(card);
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
      // emote: disco claro detrás de la carita (la imagen la pone rewardCard)
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
  private claim(track: BpTrack, tier: number, card: Phaser.GameObjects.Container) {
    const res = commit((s) => bpClaim(s, track, tier));
    if (!res.ok) return this.toast(res.error === 'not_premium' ? 'Necesitas el Pase Premium' : 'Aún no disponible');
    const r = res.given;
    const m = card.getWorldTransformMatrix();
    this.burst(m.tx, m.ty, track === 'prem' ? GOLD : 0x8fd0ff);
    this.toast(`¡${rewardLabel(r).top}!`);
  }

  private claimWelcome(track: BpTrack, card: Phaser.GameObjects.Container) {
    const res = commit((s) => bpClaimWelcome(s, track));
    if (!res.ok) return this.toast(res.error === 'not_premium' ? 'Necesitas el Pase Premium' : 'Regalo ya reclamado');
    const m = card.getWorldTransformMatrix();
    this.burst(m.tx, m.ty, track === 'prem' ? GOLD : 0x8fd0ff);
    this.toast(`¡${rewardLabel(res.given).top} ${rewardLabel(res.given).sub}!`);
  }

  private buyPremium() {
    const res = commit((s) => bpBuyPremium(s));
    if (!res.ok) {
      const cash = getPlayer().gems;
      if (res.error === 'real_money') return this.toast(`Pase Premium ${BP_SEASON.premiumRealPrice} · pago con dinero real: próximamente`);
      return this.toast(res.error === 'not_enough_cash' ? `Te faltan ${BP_SEASON.premiumCash - cash} de dinero: consíguelo en el camino gratis del pase` : 'Ya tienes el Pase Premium');
    }
    this.burst(this.scale.width / 2, 312, GOLD);
    this.toast('¡PASE PREMIUM ACTIVADO!');
  }

  // ================================================================ desplazamiento
  private setupScroll() {
    const W = this.scale.width;
    const zone = this.add.zone(0, this.listTop, W, this.listH).setOrigin(0).setInteractive();
    zone.setDepth(-1);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.y < this.listTop || p.y > this.listTop + this.listH) return;
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
  /** animaciones de la tarjeta grande del personaje (se quitan al volver a dibujar las filas) */
  private tallTweens: Phaser.Tweens.Tween[] = [];

  private updateListScroll(offset: number) {
    this.listOffset = Phaser.Math.Clamp(offset, 0, -this.scrollMin);
    const s = syncSeason(getPlayer() as PlayerState);
    const { level, progress } = bpLevel(s.bp.xp);
    const cardW = (this.scale.width - 48 - 96) / 2;
    this.renderVisibleRows(s, level, progress, cardW, this.numberColumnX(this.scale.width, cardW));
    this.refreshBottomControl();
  }

  private refreshBottomControl() {
    const maxOffset = -this.scrollMin;
    const atBonus = maxOffset > 0 && this.listOffset >= maxOffset - 12;
    if (this.bottomIndicator) {
      const row = Math.min(BP_TIERS, Math.max(1, Math.floor(this.listOffset / ROW_H)));
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

  private numberColumnX(width: number, cardW: number) {
    const freeRightEdge = width / 2 - 48 - cardW * 0.03;
    const premiumLeftEdge = width / 2 + 48 - cardW * 0.01;
    return (freeRightEdge + premiumLeftEdge) / 2;
  }

  private addBottomButton() {
    const x = this.scale.width - 48;
    const y = this.scale.height - 54;
    const button = this.add.container(x, y).setDepth(200);
    const g = this.add.graphics();
    g.fillStyle(0x07152f, 0.96).fillCircle(0, 0, 30);
    g.lineStyle(3, GOLD, 1).strokeCircle(0, 0, 30);
    g.lineStyle(6, 0xffffff, 1).beginPath().moveTo(-10, -5).lineTo(0, 6).lineTo(10, -5).strokePath();
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
  private card(x: number, y: number, w: number, h: number, line: number, fill = NAVY) {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.35).fillRoundedRect(x + 3, y + 5, w, h, 20);
    if (fill === 0x2a2108) g.fillGradientStyle(0x684200, 0x3e2907, 0x322205, 0x211805, 0.98);
    else g.fillGradientStyle(0x1258b8, 0x0d3d91, 0x0b2d6a, 0x081a3e, 0.97);
    g.fillRoundedRect(x, y, w, h, 20);
    g.fillStyle(0xffffff, 0.05).fillRoundedRect(x + 3, y + 3, w - 6, Math.min(h * 0.45, 40), { tl: 17, tr: 17, bl: 0, br: 0 });
    g.lineStyle(3, line, 1).strokeRoundedRect(x, y, w, h, 20);
    return g;
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
    c.setSize(s, s).setInteractive({ useHandCursor: true }).setDepth(50);
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
