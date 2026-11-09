import Phaser from 'phaser';
import { FONT, restartOnResize, textStyle } from '../ui/theme';
import { stadiumBg } from '../ui/ui';
import { arcadeButton } from '../ui/modeButtons';
import { drawCoinIcon } from '../ui/wheelArt';
import { fitText } from '../ui/fitText';
import { commit, getPlayer, onPlayerChange } from '../domain/playerStore';
import { BP_SEASON, BP_TIERS, type BpReward, type BpTrack, bpBuyPremium, bpCanClaim, bpClaim, bpLevel, syncSeason } from '../domain/battlePass';
import type { PlayerState } from '../domain/player';

/**
 * PASE DE BATALLA: niveles que se llenan con la EXP ganada; cada nivel tiene premio GRATIS
 * (izquierda) y PREMIUM (derecha). Lista vertical desplazable (arrastrar). Reclamar se valida y
 * guarda en domain/battlePass (una sola vez por premio).
 */
const NAVY = 0x0b1733;
const NEON = 0x3a7bff;
const GOLD = 0xffc42e;
const ROW_H = 132;

const STYLE_SWATCH: Record<string, number> = { 'style:red': 0xff4f5e, 'style:green': 0x62d935, 'style:gold': 0xffc42e, 'style:classic': 0x3a8bff };

export class BattlePassScene extends Phaser.Scene {
  private list!: Phaser.GameObjects.Container;
  private top!: Phaser.GameObjects.Container;
  private listTop = 0;
  private listH = 0;
  private scrollMin = 0;
  private dragging = false;
  private dragFrom = 0;
  private listFrom = 0;
  private moved = 0;

  constructor() {
    super('BattlePass');
  }

  preload() {
    if (!this.textures.exists('menu-bg')) this.load.image('menu-bg', 'assets/menu-bg.png');
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
    this.backButton(54, 64, () => {
      this.cameras.main.fadeOut(180, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Menu'));
    });
    const title = this.add.text(W / 2 + 20, 52, 'PASE DE BATALLA', { fontFamily: FONT, fontSize: '40px', color: '#ffffff' }).setOrigin(0.5).setLetterSpacing(2);
    fitText(title, W - 200);
    this.add.text(W / 2 + 20, 90, BP_SEASON.name, { fontFamily: FONT, fontSize: '18px', color: '#ffd23f' }).setOrigin(0.5).setLetterSpacing(3);

    this.top = this.add.container(0, 0);
    this.listTop = 384;
    this.listH = H - this.listTop - 20;
    this.list = this.add.container(0, this.listTop);
    const maskG = this.make.graphics({}, false);
    maskG.fillStyle(0xffffff).fillRect(0, this.listTop, W, this.listH);
    this.list.setMask(maskG.createGeometryMask());
    this.buildTop();
    this.buildList(true);
    this.setupScroll();
    const off = onPlayerChange(() => {
      this.buildTop();
      this.buildList(false);
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
    const y = 124;
    const h = 110;
    this.top.add(this.card(x, y, w, h, NEON));
    const badge = this.add.graphics({ x: x + 62, y: y + h / 2 });
    badge.fillStyle(0x0a1638, 1).fillCircle(0, 0, 42);
    badge.fillStyle(GOLD, 1).fillCircle(0, 0, 37);
    badge.fillStyle(0xfff1b8, 0.5).fillEllipse(-9, -14, 34, 12);
    this.top.add(badge);
    this.top.add(this.add.text(x + 62, y + h / 2 - 9, 'NV', { fontFamily: FONT, fontSize: '14px', color: '#0a1638' }).setOrigin(0.5));
    this.top.add(this.add.text(x + 62, y + h / 2 + 10, String(level), { fontFamily: FONT, fontSize: '30px', color: '#0a1638' }).setOrigin(0.5));
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
    this.top.add(
      this.add.text(bx, by + 34, done ? 'Has llegado al último nivel' : `${into} / ${BP_SEASON.xpPerTier} EXP · gana EXP jugando partidas`, { fontFamily: FONT, fontSize: '15px', color: '#9fb4e0' }).setOrigin(0, 0.5),
    );

    // premium
    const py = y + h + 14;
    const ph = 92;
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
    const cy = this.listTop - 22;
    const cardW = (W - 48 - 96) / 2;
    const pill = (px: number, label: string, line: number, fill: number, col: string, crown: boolean) => {
      const pw = Math.min(cardW, 230);
      const g = this.add.graphics();
      g.fillStyle(fill, 1).fillRoundedRect(px - pw / 2, cy - 16, pw, 32, 16);
      g.lineStyle(3, line, 1).strokeRoundedRect(px - pw / 2, cy - 16, pw, 32, 16);
      this.top.add(g);
      if (crown) {
        const c = this.add.graphics({ x: px - pw / 2 + 26, y: cy });
        c.fillStyle(GOLD, 1).fillPoints([{ x: -10, y: 7 }, { x: -11, y: -6 }, { x: -5, y: 0 }, { x: 0, y: -9 }, { x: 5, y: 0 }, { x: 11, y: -6 }, { x: 10, y: 7 }], true);
        this.top.add(c);
      }
      this.top.add(this.add.text(px + (crown ? 8 : 0), cy, label, { fontFamily: FONT, fontSize: '18px', color: col }).setOrigin(0.5).setLetterSpacing(2));
    };
    pill(24 + cardW / 2, 'GRATIS', NEON, 0x10224a, '#cfe0ff', false);
    pill(W - 24 - cardW / 2, s.bp.premium ? 'PREMIUM · ACTIVO' : 'PREMIUM', GOLD, 0x3a2b08, '#ffd23f', true);
  }

  // ================================================================ lista de niveles
  private buildList(scrollToCurrent: boolean) {
    const W = this.scale.width;
    const keepY = this.list.y;
    this.list.removeAll(true);
    const s = syncSeason(getPlayer() as PlayerState);
    const { level, progress } = bpLevel(s.bp.xp);
    const cx = W / 2;
    const cardW = (W - 48 - 96) / 2;

    // camino central: base + parte completada
    const total = BP_TIERS * ROW_H;
    const path = this.add.graphics();
    path.fillStyle(0x0a1638, 1).fillRoundedRect(cx - 9, ROW_H / 2, 18, total - ROW_H, 9);
    path.fillStyle(0x223156, 1).fillRoundedRect(cx - 6, ROW_H / 2, 12, total - ROW_H, 6);
    const doneH = Math.max(0, Math.min(total - ROW_H, (level - 1 + (level < BP_TIERS ? progress : 0)) * ROW_H));
    if (level > 0) path.fillStyle(0x5fd0ff, 1).fillRoundedRect(cx - 6, ROW_H / 2, 12, doneH, 6);
    this.list.add(path);

    for (let t = 1; t <= BP_TIERS; t++) {
      const y = (t - 1) * ROW_H + ROW_H / 2;
      const reached = level >= t;
      // nivel en el camino
      const node = this.add.graphics({ x: cx, y });
      node.fillStyle(0x0a1638, 1).fillCircle(0, 0, 26);
      node.fillStyle(reached ? 0x2f8bff : 0x2a3556, 1).fillCircle(0, 0, 22);
      this.list.add(node);
      this.list.add(this.add.text(cx, y, String(t), { fontFamily: FONT, fontSize: '22px', color: reached ? '#ffffff' : '#7f93bf' }).setOrigin(0.5));
      this.rewardCard(24 + cardW / 2, y, cardW, 'free', t, s);
      this.rewardCard(W - 24 - cardW / 2, y, cardW, 'prem', t, s);
    }

    this.scrollMin = Math.min(0, this.listH - total - 10);
    if (scrollToCurrent) {
      const target = -((Math.max(1, level) - 1) * ROW_H) + this.listH * 0.3;
      this.list.y = this.listTop + Phaser.Math.Clamp(target, this.scrollMin, 0);
    } else this.list.y = keepY;
  }

  private rewardCard(x: number, y: number, w: number, track: BpTrack, tier: number, s: PlayerState) {
    const reward = BP_SEASON.tiers[tier - 1][track];
    const err = bpCanClaim(s, track, tier);
    const claimed = err === 'already_claimed';
    const ready = err === null;
    const prem = track === 'prem';
    const h = ROW_H - 18;
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    const accent = prem ? GOLD : NEON;
    g.fillStyle(0x000000, 0.35).fillRoundedRect(-w / 2 + 3, -h / 2 + 5, w, h, 16);
    if (ready) g.lineStyle(10, accent, 0.35).strokeRoundedRect(-w / 2, -h / 2, w, h, 16);
    g.fillStyle(prem ? 0x241c08 : NAVY, 0.95).fillRoundedRect(-w / 2, -h / 2, w, h, 16);
    g.fillStyle(0xffffff, 0.05).fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h * 0.4, { tl: 13, tr: 13, bl: 4, br: 4 });
    g.lineStyle(prem ? 4 : 3, ready ? accent : prem ? 0xc9962a : 0x2c3d66, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 16);
    if (prem) g.fillStyle(GOLD, 0.12).fillRoundedRect(-w / 2 + 3, h / 2 - 30, w - 6, 27, { tl: 4, tr: 4, bl: 13, br: 13 });
    c.add(g);
    // etiqueta de camino (se ve de un vistazo qué es gratis y qué es premium)
    const tagBg = this.add.graphics();
    tagBg.fillStyle(prem ? GOLD : 0x2a5fd0, 1).fillRoundedRect(-w / 2 + 12, -h / 2 - 9, 74, 18, 9);
    c.add(tagBg);
    c.add(this.add.text(-w / 2 + 49, -h / 2, prem ? 'PREMIUM' : 'GRATIS', { fontFamily: FONT, fontSize: '11px', color: prem ? '#2a2108' : '#ffffff' }).setOrigin(0.5).setLetterSpacing(1));
    const needPrem = prem && !s.bp.premium;

    // icono + texto del premio
    const ic = this.add.graphics({ x: -w / 2 + 44, y: 0 });
    this.drawReward(ic, reward);
    c.add(ic);
    const label = rewardLabel(reward);
    const t = this.add.text(-w / 2 + 82, -10, label.top, { fontFamily: FONT, fontSize: '24px', color: prem ? '#ffd23f' : '#ffffff' }).setOrigin(0, 0.5);
    fitText(t, w - 96);
    c.add(t);
    c.add(this.add.text(-w / 2 + 83, 18, label.sub, { fontFamily: FONT, fontSize: '13px', color: '#9fb4e0' }).setOrigin(0, 0.5).setLetterSpacing(1));

    if (claimed) {
      c.add(this.add.rectangle(0, 0, w, h, 0x02060f, 0.5));
      const ok = this.add.graphics({ x: w / 2 - 26, y: -h / 2 + 24 });
      ok.fillStyle(0x0a1638, 1).fillCircle(0, 0, 15).fillStyle(0x3ccf5a, 1).fillCircle(0, 0, 12);
      ok.lineStyle(3.5, 0xffffff, 1).beginPath().moveTo(-6, 0).lineTo(-1, 5).lineTo(7, -5).strokePath();
      c.add(ok);
    } else if (!ready) {
      c.add(this.add.rectangle(0, 0, w, h, 0x02060f, err === 'not_premium' ? 0.25 : 0.42));
      const lk = this.add.graphics({ x: w / 2 - 26, y: -h / 2 + 24 });
      const lc = err === 'not_premium' ? GOLD : 0xc8d2ea;
      lk.lineStyle(3, lc, 1).beginPath().arc(0, -3, 6, Math.PI, 0).strokePath();
      lk.fillStyle(lc, 1).fillRoundedRect(-8, -3, 16, 12, 3);
      c.add(lk);
      if (needPrem) c.add(this.add.text(w / 2 - 12, h / 2 - 16, 'SOLO PREMIUM', { fontFamily: FONT, fontSize: '13px', color: '#ffd23f' }).setOrigin(1, 0.5).setLetterSpacing(1));
    } else {
      // listo: pulso + RECLAMAR (se reclama al soltar sin haber arrastrado la lista)
      const tag = this.add.text(w / 2 - 12, h / 2 - 16, 'RECLAMAR', { fontFamily: FONT, fontSize: '14px', color: prem ? '#ffd23f' : '#8fd0ff' }).setOrigin(1, 0.5).setLetterSpacing(1);
      c.add(tag);
      this.tweens.add({ targets: tag, alpha: 0.35, duration: 450, yoyo: true, repeat: -1 });
      c.setSize(w, h).setInteractive({ useHandCursor: true });
      c.on('pointerup', (p: Phaser.Input.Pointer) => {
        // la máscara no recorta los toques: solo dentro de la zona visible de la lista
        if (this.moved > 12 || p.y < this.listTop || p.y > this.listTop + this.listH) return;
        this.claim(track, tier, c);
      });
    }
    this.list.add(c);
  }

  private drawReward(g: Phaser.GameObjects.Graphics, r: BpReward) {
    if (r.kind === 'coins') drawCoinIcon(g, 22);
    else if (r.kind === 'cash') drawCashIcon(g, 1.3);
    else {
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

  private buyPremium() {
    const res = commit((s) => bpBuyPremium(s));
    if (!res.ok) {
      const cash = getPlayer().gems;
      if (res.error === 'real_money') return this.toast(`Pase Premium ${BP_SEASON.premiumRealPrice} · pago con dinero real: próximamente`);
      return this.toast(res.error === 'not_enough_cash' ? `Te faltan ${BP_SEASON.premiumCash - cash} de dinero: consíguelo en el camino gratis del pase` : 'Ya tienes el Pase Premium');
    }
    this.burst(this.scale.width / 2, 300, GOLD);
    this.toast('¡PASE PREMIUM ACTIVADO!');
  }

  // ================================================================ desplazamiento
  private setupScroll() {
    const W = this.scale.width;
    const zone = this.add.zone(0, this.listTop, W, this.listH).setOrigin(0).setInteractive();
    zone.setDepth(-1);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.y < this.listTop || p.y > this.listTop + this.listH) return;
      this.dragging = true;
      this.dragFrom = p.y;
      this.listFrom = this.list.y;
      this.moved = 0;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.dragging || !p.isDown) return;
      const dy = p.y - this.dragFrom;
      this.moved = Math.max(this.moved, Math.abs(dy));
      this.list.y = this.listTop + Phaser.Math.Clamp(this.listFrom - this.listTop + dy, this.scrollMin, 0);
    });
    this.input.on('pointerup', () => {
      this.dragging = false;
      this.time.delayedCall(0, () => (this.moved = 0));
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      this.list.y = this.listTop + Phaser.Math.Clamp(this.list.y - this.listTop - dy, this.scrollMin, 0);
    });
  }

  // ================================================================ piezas
  private card(x: number, y: number, w: number, h: number, line: number, fill = NAVY) {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.35).fillRoundedRect(x + 3, y + 5, w, h, 20);
    g.fillStyle(fill, 0.94).fillRoundedRect(x, y, w, h, 20);
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
  if (r.kind === 'coins') return { top: r.amount.toLocaleString('es-CL'), sub: 'MONEDAS' };
  if (r.kind === 'cash') return { top: String(r.amount), sub: 'DINERO' };
  return { top: r.name.replace('Estilo ', '').toUpperCase(), sub: 'ESTILO' };
}
