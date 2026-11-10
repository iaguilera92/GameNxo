import Phaser from 'phaser';
import { FONT, restartOnResize, textStyle } from '../ui/theme';
import { stadiumBg } from '../ui/ui';
import { arcadeButton } from '../ui/modeButtons';
import { drawCoinIcon } from '../ui/wheelArt';
import { commit, getPlayer, onPlayerChange } from '../domain/playerStore';
import { buyCoinsWithCash, equipStyle, purchase } from '../domain/operations';
import { BP_SEASON, syncSeason } from '../domain/battlePass';
import type { PlayerState } from '../domain/player';
import { drawCashIcon } from './BattlePassScene';
import { type ItemId, type StyleId, owns } from '../domain/player';
import { CASH_OFFERS, SHOP_ITEMS, type ShopItem } from '../domain/shopCatalog';
import { fitText } from '../ui/fitText';
import { styleLook } from '../ui/styleLook';

/**
 * TIENDA: se gastan las monedas ganadas en partidas y en la Ruleta diaria.
 * Usa el catálogo y las operaciones que ya existían (domain/shopCatalog + domain/operations.purchase):
 * precio, nivel mínimo, disponibilidad y "ya lo tienes" los valida la operación, no la pantalla.
 *   ESTILOS      se compran y se equipan aquí (también en PERSONAJE)
 *   COSMÉTICOS      catálogo visual; el Premium no procesa pagos sin una integración
 */
const NAVY = 0x0b1733;
const NEON = 0x3a7bff;
const GOLD = 0xffc42e;


const ERRORS: Record<string, string> = {
  not_enough_coins: 'No te alcanzan las monedas',
  not_enough_cash: 'No te alcanza el dinero',
  level_too_low: 'Necesitas más nivel',
  already_owned: 'Ya lo tienes',
  not_available: 'Próximamente',
  not_found: 'Artículo no disponible',
};

export class ShopScene extends Phaser.Scene {
  private body!: Phaser.GameObjects.Container;
  private coinText!: Phaser.GameObjects.Text;
  private cashText!: Phaser.GameObjects.Text;
  private modal: Phaser.GameObjects.GameObject[] = [];
  private selectedCategory = 0;

  constructor() {
    super('Shop');
  }

  preload() {
    if (!this.textures.exists('menu-bg')) this.load.image('menu-bg', 'assets/menu-bg.png');
    if (!this.textures.exists('shop-title')) this.load.image('shop-title', 'assets/tienda-titulo.png');
  }

  create() {
    const W = this.scale.width;
    restartOnResize(this);
    this.cameras.main.fadeIn(200, 0, 0, 0);
    stadiumBg(this, 0.55);
    this.modal = [];

    // ---------------------------------------------------------------- cabecera
    const headY = 64;
    this.backButton(54, headY, () => {
      this.cameras.main.fadeOut(180, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Menu'));
    });
    const titleW = Math.min(250, Math.max(150, W - 250));
    const titleX = W / 2 - Math.min(35, W * 0.08);
    this.add.image(titleX, headY - 3, 'shop-title').setDisplaySize(titleW, titleW / 3);
    this.coinPill(W - 26, headY);

    this.body = this.add.container(0, 0);
    this.build();
    const off = onPlayerChange(() => this.refreshCoins());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => off());
  }

  // ================================================================ contenido
  private build() {
    const W = this.scale.width;
    this.body.removeAll(true);
    let y = 150;

    // destacado: de dónde salen las monedas
    const tip = this.add.text(W / 2, y, 'Precios de muestra · compras aún no habilitadas', { fontFamily: FONT, fontSize: '19px', color: '#9fb4e0' }).setOrigin(0.5);
    fitText(tip, W - 60);
    this.body.add(tip);
    y += 44;

    // ---------------------------------------------------------------- estilos
    this.sectionTitle(W, y, 'ESTILOS');
    y += 26;
    const hint = this.add.text(W / 2, y, 'Pintan la estela de tus golpes en el partido', { fontFamily: FONT, fontSize: '16px', color: '#7f93bf' }).setOrigin(0.5);
    fitText(hint, W - 60);
    this.body.add(hint);
    y += 30;
    const styles = SHOP_ITEMS.filter((i) => i.kind === 'style');
    const gap = 14;
    const cw = (W - 60 - gap * (styles.length - 1)) / styles.length;
    const ch = 270;
    styles.forEach((it, i) => this.styleCard(30 + i * (cw + gap), y, cw, ch, it));
    y += ch + 52;

    // ---------------------------------------------------------------- catálogo cosmético
    this.sectionTitle(W, y, 'COSMÉTICOS');
    y += 32;
    const categories = ['DEFENSA', 'ATAQUE', 'CARGA', 'PELOTA', 'ZONA'];
    const tabGap = 5;
    const tabW = (W - 60 - tabGap * (categories.length - 1)) / categories.length;
    categories.forEach((label, i) => {
      const tab = this.add.container(30 + i * (tabW + tabGap) + tabW / 2, y);
      const active = i === this.selectedCategory;
      const bg = this.add.graphics();
      bg.fillStyle(active ? 0x0758c9 : NAVY, 0.98).fillRoundedRect(-tabW / 2, -19, tabW, 38, 12);
      bg.lineStyle(2, active ? 0x43dfff : 0x38558d).strokeRoundedRect(-tabW / 2, -19, tabW, 38, 12);
      const text = this.add.text(0, 0, label, { fontFamily: FONT, fontSize: '13px', color: active ? '#ffffff' : '#9fb4e0' }).setOrigin(0.5);
      fitText(text, tabW - 8);
      tab.add([bg, text]);
      tab.setSize(tabW, 40).setInteractive({ useHandCursor: true });
      tab.on('pointerup', () => {
        this.selectedCategory = i;
        this.build();
      });
      this.body.add(tab);
    });
    y += 28;
    const products = COSMETIC_PRODUCTS[this.selectedCategory];
    const productGap = 8;
    const productW = (W - 60 - productGap * 2) / 3;
    products.forEach((product, i) => this.cosmeticCard(30 + i * (productW + productGap), y, productW, 172, product));
    y += 204;

    // ---------------------------------------------------------------- con dinero (billetes)
    this.sectionTitle(W, y, 'CON DINERO');
    y += 34;
    const oh = 104;
    const pack = CASH_OFFERS.coinPack;
    this.cashOffer(30, y, W - 60, oh, {
      title: `${pack.coins} MONEDAS`,
      sub: pack.name,
      icon: (g) => {
        drawCoinIcon(g, 20, -8, 6);
        drawCoinIcon(g, 20, 10, -6);
      },
      price: pack.cash,
      onBuy: () => {
        const res = commit((s) => buyCoinsWithCash(s, pack.cash, pack.coins));
        if (!res.ok) return this.toast(`Te faltan ${pack.cash - getPlayer().gems} de dinero`);
        this.celebrate();
        this.build();
      },
    });
    y += oh + 52;

    // ---------------------------------------------------------------- pase premium (solo dinero real)
    this.sectionTitle(W, y, 'PASE PREMIUM');
    y += 34;
    const premium = syncSeason(getPlayer() as PlayerState).bp.premium;
    this.realOffer(30, y, W - 60, oh, premium);
  }

  /** Ficha de catálogo. El producto se anuncia aquí; su efecto se habilitará al integrar su cosmético. */
  private cosmeticCard(x: number, y: number, w: number, h: number, product: CosmeticProduct) {
    const rarityColor = product.rarity === 'NORMAL' ? 0x4b8dff : product.rarity === 'ESPECIAL' ? 0x25d5e8 : GOLD;
    const c = this.add.container(0, 0);
    c.add(this.card(x, y, w, h, { line: rarityColor, glow: product.rarity === 'ÉPICA' ? 0.3 : 0.12, r: 16 }));
    const icon = this.add.graphics({ x: x + w / 2, y: y + 40 });
    icon.fillStyle(rarityColor, 0.22).fillCircle(0, 0, 24);
    icon.lineStyle(3, rarityColor).strokeCircle(0, 0, 19);
    if (product.category === 'PELOTA') {
      icon.fillStyle(0xd7f53a).fillCircle(0, 0, 10);
      icon.lineStyle(1.5, 0xffffff, 0.9).beginPath().arc(0, 0, 7, -1.1, 1.1).strokePath();
    } else if (product.category === 'ZONA') {
      icon.lineStyle(3, rarityColor, 0.95).strokeEllipse(-14, -6, 24, 10).strokeEllipse(0, 5, 24, 10);
    } else if (product.category === 'CARGA') {
      icon.fillStyle(rarityColor).fillPoints([{ x: 4, y: -15 }, { x: -8, y: 2 }, { x: 0, y: 2 }, { x: -3, y: 15 }, { x: 10, y: -4 }, { x: 3, y: -4 }], true);
    } else if (product.category === 'DEFENSA') {
      icon.lineStyle(4, rarityColor).beginPath().moveTo(-12, -12).lineTo(0, -18).lineTo(12, -12).lineTo(10, 6).lineTo(0, 15).lineTo(-10, 6).closePath().strokePath();
    } else {
      icon.fillStyle(rarityColor).fillPoints([{ x: -13, y: -11 }, { x: 0, y: -17 }, { x: 13, y: -11 }, { x: 8, y: 2 }, { x: 0, y: 14 }, { x: -8, y: 2 }], true);
    }
    c.add(icon);
    const rarity = this.add.text(x + w / 2, y + 76, product.rarity, { fontFamily: FONT, fontSize: '12px', color: product.rarity === 'ÉPICA' ? '#ffd23f' : '#c8dcff' }).setOrigin(0.5);
    fitText(rarity, w - 8);
    c.add(rarity);
    const title = this.add.text(x + w / 2, y + 97, product.name, { fontFamily: FONT, fontSize: '15px', color: '#ffffff', align: 'center', wordWrap: { width: w - 12 } }).setOrigin(0.5);
    fitText(title, w - 12);
    c.add(title);
    const price = product.rarity === 'ÉPICA' ? String(product.price) : `${Number(product.price).toLocaleString('es-CL')} dinero`;
    const status = this.add.text(x + w / 2, y + h - 43, 'PRÓXIMAMENTE', { fontFamily: FONT, fontSize: '10px', color: '#91a8d5' }).setOrigin(0.5);
    fitText(status, w - 8);
    c.add(status);
    const priceText = this.add.text(x + w / 2, y + h - 22, price, { fontFamily: FONT, fontSize: '14px', color: product.rarity === 'ÉPICA' ? '#ffd23f' : '#ffe69a' }).setOrigin(0.5);
    fitText(priceText, w - 8);
    c.add(priceText);
    this.body.add(c);
  }

  /** Pase Premium: se muestra sin ofrecer cobros hasta que exista integración de pagos. */
  private realOffer(x: number, y: number, w: number, h: number, active: boolean) {
    const c = this.add.container(0, 0);
    this.body.add(c);
    c.add(this.card(x, y, w, h, { line: GOLD, glow: active ? 0 : 0.3 }));
    const ic = this.add.graphics({ x: x + 58, y: y + h / 2 });
    ic.fillStyle(0x0a1638, 1).fillCircle(0, 0, 34);
    ic.fillStyle(GOLD, 1).fillCircle(0, 0, 30);
    ic.fillStyle(0x0a1638, 1).fillPoints([{ x: -18, y: 10 }, { x: -20, y: -10 }, { x: -9, y: -1 }, { x: 0, y: -15 }, { x: 9, y: -1 }, { x: 20, y: -10 }, { x: 18, y: 10 }], true);
    c.add(ic);
    c.add(this.add.text(x + 112, y + h / 2 - 16, 'PASE PREMIUM', { fontFamily: FONT, fontSize: '26px', color: '#ffd23f' }).setOrigin(0, 0.5));
    const sub = this.add.text(x + 113, y + h / 2 + 18, `${BP_SEASON.name} · premios dorados`, { fontFamily: FONT, fontSize: '15px', color: '#c9b98a' }).setOrigin(0, 0.5);
    fitText(sub, w - 300);
    c.add(sub);
    const bx = x + w - 92;
    if (active) {
      c.add(this.pill(bx, y + h / 2, 150, 'ACTIVO', 0x1f6b35, '#9fe8a0'));
      return;
    }
    const price = this.add.container(bx, y + h / 2);
    const priceBg = this.add.graphics();
    priceBg.fillStyle(0x0a1638).fillRoundedRect(-78, -27, 156, 54, 16);
    priceBg.fillStyle(0xf29a0c).fillRoundedRect(-74, -23, 148, 46, 14);
    priceBg.fillStyle(0xffcc1f).fillRoundedRect(-74, -23, 148, 26, { tl: 14, tr: 14, bl: 6, br: 6 });
    price.add([priceBg, this.add.text(0, 0, BP_SEASON.premiumRealPrice, { fontFamily: FONT, fontSize: '21px', color: '#0a1638' }).setOrigin(0.5)]);
    c.add(price);
  }

  /** Tarjeta de estilo: muestra de color, nombre y botón (precio / nivel / USAR / EN USO). */
  private styleCard(x: number, y: number, w: number, h: number, it: ShopItem) {
    const s = getPlayer();
    const id = it.id.split(':')[1] as StyleId;
    const has = owns(s, it.id);
    const equipped = s.equipped.style === id;
    const lowLevel = s.level < it.minLevel;
    const c = this.add.container(0, 0);
    this.body.add(c);
    c.add(this.card(x, y, w, h, { line: equipped ? 0xffffff : has ? NEON : it.id === 'style:gold' ? GOLD : 0x2c3d66, glow: equipped || it.id === 'style:gold' ? 0.3 : 0 }));

    // vista previa: la pelota con la estela de ese estilo, en movimiento (así se verán tus golpes)
    const sx = x + w / 2;
    const sy = y + 88;
    this.trailPreview(c, sx, sy, Math.min(w - 28, 150), id);

    c.add(this.add.text(sx, y + 166, it.name.toUpperCase(), { fontFamily: FONT, fontSize: '24px', color: '#ffffff' }).setOrigin(0.5));
    const perk = this.add.text(sx, y + 194, has ? 'COMPRADO' : lowLevel ? `NIVEL ${it.minLevel}` : styleLook(id).perk.toUpperCase(), { fontFamily: FONT, fontSize: '14px', color: has ? '#9fe8a0' : lowLevel ? '#ff9aa3' : '#9fb4e0', align: 'center', wordWrap: { width: w - 16 } }).setOrigin(0.5).setLetterSpacing(1);
    c.add(perk);

    // botón inferior
    const by = y + h - 36;
    const bw = w - 24;
    if (equipped) {
      c.add(this.pill(sx, by, bw, 'EN USO', 0x1f6b35, '#9fe8a0'));
    } else if (has) {
      const b = arcadeButton(this, sx, by, bw, 48, 'USAR', () => {
        commit((st) => equipStyle(st, id));
        this.toast(`Estilo ${it.name} equipado`);
        this.build();
      }, { palette: 'blue' });
      c.add(b);
    } else {
      const btn = this.priceButton(sx, by, bw, it.price, lowLevel || s.gems < it.price, () => this.confirmBuy(it));
      c.add(btn);
    }
  }

  /** Pelota que cruza la tarjeta dejando la estela del estilo (chispas en Oro). Se repite sola. */
  private trailPreview(c: Phaser.GameObjects.Container, cx: number, cy: number, span: number, id: StyleId) {
    const look = styleLook(id);
    // trayectoria tenue de fondo (la tarjeta nunca queda vacía)
    const ghost = this.add.graphics();
    ghost.lineStyle(4, look.trail, 0.18).beginPath();
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const px = cx - span / 2 + span * t;
      const py = cy + 26 - Math.sin(t * Math.PI) * 52;
      if (i === 0) ghost.moveTo(px, py);
      else ghost.lineTo(px, py);
    }
    ghost.strokePath();
    c.add(ghost);
    const g = this.add.graphics();
    const ball = this.add.container(0, 0);
    ball.add([this.add.circle(0, 0, 12, 0x0a1638), this.add.circle(0, 0, 9, 0xd7f53a), this.add.circle(-3, -3, 3, 0xffffff, 0.75)]);
    c.add([g, ball]);
    const st = { t: 0 };
    const pos = (t: number) => ({ x: cx - span / 2 + span * t, y: cy + 26 - Math.sin(t * Math.PI) * 52 });
    const draw = () => {
      g.clear();
      const n = 14;
      for (let i = 1; i <= n; i++) {
        const a = pos(Math.max(0, st.t - (i / n) * 0.45));
        const b = pos(Math.max(0, st.t - ((i - 1) / n) * 0.45));
        const k = 1 - i / n;
        g.lineStyle(3 + k * 14, look.trail, k * 0.75).lineBetween(a.x, a.y, b.x, b.y);
      }
      const p = pos(st.t);
      ball.setPosition(p.x, p.y);
      if (look.sparkle && Math.random() < 0.5 && st.t > 0.05) {
        const s = this.add.star(p.x + Phaser.Math.Between(-6, 6), p.y + Phaser.Math.Between(-6, 6), 4, 2, 6, 0xfff1b8).setBlendMode(Phaser.BlendModes.ADD);
        c.add(s);
        this.tweens.add({ targets: s, alpha: 0, scale: 0.2, angle: 160, y: s.y + 10, duration: 380, onComplete: () => s.destroy() });
      }
    };
    this.tweens.add({ targets: st, t: 1, duration: 1100, delay: Phaser.Math.Between(0, 500), repeat: -1, repeatDelay: 450, ease: 'Sine.easeInOut', onUpdate: draw });
    draw();
  }

  // ================================================================ compra
  private confirmBuy(it: ShopItem) {
    const s = getPlayer();
    if (s.level < it.minLevel) return this.toast(`Necesitas nivel ${it.minLevel}`);
    if (s.gems < it.price) return this.toast(`Te faltan ${(it.price - s.gems).toLocaleString('es-CL')} de dinero`);
    const W = this.scale.width;
    const H = this.scale.height;
    const close = () => {
      this.modal.forEach((o) => o.destroy());
      this.modal = [];
    };
    const shade = this.add.rectangle(0, 0, W, H, 0x02060f, 0.72).setOrigin(0).setDepth(8000).setInteractive();
    shade.on('pointerdown', close);
    const pw = Math.min(560, W - 60);
    const ph = 330;
    const panel = this.add.container(W / 2, H / 2).setDepth(8001);
    panel.add(this.add.rectangle(0, 0, pw, ph, 0x000000, 0.001).setInteractive());
    panel.add(this.card(-pw / 2, -ph / 2, pw, ph, { line: GOLD, glow: 0.3, r: 24 }));
    panel.add(this.add.text(0, -ph / 2 + 50, '¿COMPRAR?', { fontFamily: FONT, fontSize: '38px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 6 }).setOrigin(0.5).setLetterSpacing(2));
    panel.add(this.add.text(0, -ph / 2 + 104, `${it.kind === 'style' ? 'Estilo' : 'Habilidad'} ${it.name}`, { fontFamily: FONT, fontSize: '26px', color: '#dbe5ff' }).setOrigin(0.5));
    // precio y saldo después
    const coin = this.add.graphics({ x: -46, y: -ph / 2 + 158 });
    drawCashIcon(coin, 1);
    panel.add(coin);
    panel.add(this.add.text(-22, -ph / 2 + 158, it.price.toLocaleString('es-CL'), { fontFamily: FONT, fontSize: '32px', color: '#ffd23f', stroke: '#0a1638', strokeThickness: 6 }).setOrigin(0, 0.5));
    panel.add(this.add.text(0, -ph / 2 + 196, `Te quedarán ${(s.gems - it.price).toLocaleString('es-CL')} de dinero`, { fontFamily: FONT, fontSize: '17px', color: '#7f93bf' }).setOrigin(0.5));
    const bw = (pw - 70) / 2;
    const by = ph / 2 - 62;
    panel.add(arcadeButton(this, -bw / 2 - 10, by, bw, 76, 'CANCELAR', close, { palette: 'blue' }));
    panel.add(arcadeButton(this, bw / 2 + 10, by, bw, 76, 'COMPRAR', () => {
      close();
      this.buy(it.id);
    }, { palette: 'yellow' }));
    panel.setScale(0.85).setAlpha(0);
    this.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
    this.modal = [shade, panel];
  }

  private buy(id: ItemId) {
    const res = commit((s) => purchase(s, id));
    if (!res.ok) return this.toast(ERRORS[res.error] ?? 'No se pudo comprar');
    this.celebrate();
    this.build();
  }

  private celebrate() {
    const W = this.scale.width;
    const H = this.scale.height;
    const t = this.add.text(W / 2, H * 0.42, '¡COMPRADO!', { fontFamily: FONT, fontSize: '56px', color: '#ffd23f', stroke: '#0a1638', strokeThickness: 10 }).setOrigin(0.5).setDepth(9000).setScale(0);
    this.tweens.add({ targets: t, scale: 1, duration: 360, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, y: t.y - 40, delay: 1000, duration: 400, onComplete: () => t.destroy() });
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const st = this.add.star(W / 2, H * 0.42, 5, 5, 12, Phaser.Utils.Array.GetRandom([GOLD, 0xffffff, 0x6fd0ff])).setDepth(8999).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: st, x: W / 2 + Math.cos(a) * 220, y: H * 0.42 + Math.sin(a) * 160, angle: 300, alpha: 0, duration: 700, ease: 'Cubic.easeOut', onComplete: () => st.destroy() });
    }
  }

  // ================================================================ piezas
  /** Saldos en la cabecera: monedas (derecha) y dinero / billetes (a su izquierda). */
  private coinPill(right: number, y: number) {
    const c = this.add.container(0, y);
    const bg = this.add.graphics();
    const coin = this.add.graphics();
    drawCoinIcon(coin, 15);
    const cash = this.add.graphics();
    drawCashIcon(cash, 0.85);
    this.coinText = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '24px', color: '#ffffff' }).setOrigin(1, 0.5);
    this.cashText = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '24px', color: '#ffffff' }).setOrigin(1, 0.5);
    c.add([bg, coin, cash, this.coinText, this.cashText]);
    const pill = (r: number, w: number, line: number) => {
      bg.fillStyle(0x000000, 0.35).fillRoundedRect(r - w + 3, -22 + 4, w, 44, 22);
      bg.fillStyle(0x0a1638, 0.95).fillRoundedRect(r - w, -22, w, 44, 22).lineStyle(2.5, line, 1).strokeRoundedRect(r - w, -22, w, 44, 22);
    };
    const layout = () => {
      bg.clear();
      const w1 = this.coinText.width + 62;
      pill(right, w1, 0x8a6a1c);
      coin.setPosition(right - w1 + 22, 0);
      this.coinText.setX(right - 14);
      const r2 = right - w1 - 10;
      const w2 = this.cashText.width + 66;
      pill(r2, w2, 0x2b7a40);
      cash.setPosition(r2 - w2 + 26, 0);
      this.cashText.setX(r2 - 14);
    };
    this.data.set('coinLayout', layout);
    this.refreshCoins();
  }

  private refreshCoins() {
    if (!this.coinText?.active) return;
    const s = getPlayer();
    this.coinText.setText(s.coins.toLocaleString('es-CL'));
    this.cashText.setText(s.gems.toLocaleString('es-CL'));
    (this.data.get('coinLayout') as () => void)?.();
  }

  /** Oferta pagada con DINERO: icono, nombre, detalle y botón de precio en billetes (o estado). */
  private cashOffer(x: number, y: number, w: number, h: number, o: { title: string; sub: string; icon: (g: Phaser.GameObjects.Graphics) => void; price: number; done?: string; onBuy: () => void }) {
    const c = this.add.container(0, 0);
    this.body.add(c);
    c.add(this.card(x, y, w, h, { line: 0x3fae5a, glow: o.done ? 0 : 0.25 }));
    const ic = this.add.graphics({ x: x + 58, y: y + h / 2 });
    o.icon(ic);
    c.add(ic);
    c.add(this.add.text(x + 112, y + h / 2 - 16, o.title, { fontFamily: FONT, fontSize: '26px', color: '#ffffff' }).setOrigin(0, 0.5));
    const sub = this.add.text(x + 113, y + h / 2 + 18, o.sub, { fontFamily: FONT, fontSize: '15px', color: '#9fb4e0' }).setOrigin(0, 0.5);
    fitText(sub, w - 300);
    c.add(sub);
    const bx = x + w - 92;
    if (o.done) c.add(this.pill(bx, y + h / 2, 150, o.done, 0x1f6b35, '#9fe8a0'));
    else {
      const cc = this.add.container(bx, y + h / 2);
      const g = this.add.graphics();
      const bw = 150;
      const bh = 50;
      const dim = getPlayer().gems < o.price;
      g.fillStyle(0x0a1638, 1).fillRoundedRect(-bw / 2 - 3, -bh / 2 - 3, bw + 6, bh + 6, 16);
      g.fillStyle(dim ? 0x2c4a33 : 0x2f8f48, 1).fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 14);
      g.fillStyle(dim ? 0x355a3e : 0x4fc46c, 1).fillRoundedRect(-bw / 2, -bh / 2, bw, bh * 0.6, { tl: 14, tr: 14, bl: 6, br: 6 });
      const icon = this.add.graphics();
      drawCashIcon(icon, 0.75);
      const t = this.add.text(0, 0, String(o.price), { fontFamily: FONT, fontSize: '24px', color: dim ? '#a8c9b0' : '#ffffff', stroke: '#0a1638', strokeThickness: 4 }).setOrigin(0, 0.5);
      const total = 34 + t.width;
      icon.setPosition(-total / 2 + 14, 0);
      t.setX(-total / 2 + 34);
      cc.add([g, icon, t]);
      cc.setSize(bw, bh + 10).setInteractive({ useHandCursor: true });
      cc.on('pointerup', () => {
        this.tweens.add({ targets: cc, scale: { from: 0.9, to: 1 }, duration: 200, ease: 'Back.easeOut' });
        o.onBuy();
      });
      c.add(cc);
    }
  }

  private priceButton(x: number, y: number, w: number, price: number, dim: boolean, onClick: () => void) {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    const h = 48;
    g.fillStyle(0x0a1638, 1).fillRoundedRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6, 16);
    g.fillStyle(dim ? 0x5a4a20 : 0xf29a0c, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 14);
    g.fillStyle(dim ? 0x6e5c2a : 0xffcc1f, 1).fillRoundedRect(-w / 2, -h / 2, w, h * 0.62, { tl: 14, tr: 14, bl: 6, br: 6 });
    g.fillStyle(0xffffff, dim ? 0.08 : 0.3).fillRoundedRect(-w / 2 + 8, -h / 2 + 4, w - 16, 8, 4);
    const icon = this.add.graphics({ x: -26, y: 0 });
    drawCashIcon(icon, 0.7); // la Tienda cobra DINERO
    const t = this.add.text(-8, 0, price.toLocaleString('es-CL'), { fontFamily: FONT, fontSize: '24px', color: dim ? '#c9b98a' : '#0a1638' }).setOrigin(0, 0.5);
    // centra icono + cifra
    const total = 30 + t.width;
    icon.setX(-total / 2 + 12);
    t.setX(-total / 2 + 30);
    c.add([g, icon, t]);
    c.setSize(w, h + 10).setInteractive({ useHandCursor: true });
    c.on('pointerup', () => {
      this.tweens.add({ targets: c, scale: { from: 0.9, to: 1 }, duration: 200, ease: 'Back.easeOut' });
      onClick();
    });
    return c;
  }

  private pill(x: number, y: number, w: number, label: string, color: number, textColor: string) {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(0x0a1638, 1).fillRoundedRect(-w / 2 - 3, -24 - 3, w + 6, 54, 16);
    g.fillStyle(color, 1).fillRoundedRect(-w / 2, -24, w, 48, 14);
    c.add(g);
    const t = this.add.text(0, 0, label, { fontFamily: FONT, fontSize: '19px', color: textColor }).setOrigin(0.5).setLetterSpacing(1);
    fitText(t, w - 16);
    c.add(t);
    return c;
  }

  /** Panel con el lenguaje del menú (igual que PERSONAJE). */
  private card(x: number, y: number, w: number, h: number, opts: { line?: number; glow?: number; r?: number } = {}) {
    const { line = NEON, glow = 0.18, r = 20 } = opts;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.35).fillRoundedRect(x + 3, y + 5, w, h, r);
    if (glow) g.lineStyle(8, line, glow).strokeRoundedRect(x, y, w, h, r);
    g.fillStyle(NAVY, 0.94).fillRoundedRect(x, y, w, h, r);
    g.fillStyle(0x1b2d5c, 0.45).fillRoundedRect(x + 3, y + 3, w - 6, Math.min(h * 0.45, 40), { tl: r - 3, tr: r - 3, bl: 0, br: 0 });
    g.lineStyle(3, line, 1).strokeRoundedRect(x, y, w, h, r);
    return g;
  }

  private sectionTitle(W: number, y: number, label: string) {
    const t = this.add.text(W / 2, y, label, { fontFamily: FONT, fontSize: '28px', color: '#ffffff' }).setOrigin(0.5).setLetterSpacing(3);
    const g = this.add.graphics();
    const half = t.width / 2 + 18;
    g.lineStyle(2, NEON, 0.7).lineBetween(40, y, W / 2 - half, y).lineBetween(W / 2 + half, y, W - 40, y);
    this.body.add([g, t]);
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
    c.setSize(s, s).setInteractive({ useHandCursor: true });
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

// ---------------------------------------------------------------- catálogo visual del módulo de tienda
type CosmeticCategory = 'DEFENSA' | 'ATAQUE' | 'CARGA' | 'PELOTA' | 'ZONA';
interface CosmeticProduct {
  category: CosmeticCategory;
  rarity: 'NORMAL' | 'ESPECIAL' | 'ÉPICA';
  name: string;
  price: number | string;
}
const product = (category: CosmeticCategory, normal: string, special: string, epic: string): CosmeticProduct[] => [
  { category, rarity: 'NORMAL', name: normal, price: 1500 },
  { category, rarity: 'ESPECIAL', name: special, price: 5000 },
  { category, rarity: 'ÉPICA', name: epic, price: '$1.490 CLP' },
];
const COSMETIC_PRODUCTS: CosmeticProduct[][] = [
  product('DEFENSA', 'Escudo azul', 'Barrera neón', 'Guardián estelar'),
  product('ATAQUE', 'Golpe rojo', 'Impacto eléctrico', 'Estallido infernal'),
  product('CARGA', 'Carga celeste', 'Pulso brillante', 'Energía cósmica'),
  product('PELOTA', 'Estela verde', 'Chispas azules', 'Cometa dorado'),
  product('ZONA', 'Círculo clásico', 'Cancha luminosa', 'Zona galáctica'),
];
