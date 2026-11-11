import Phaser from 'phaser';
import { FONT, restartOnResize, textStyle } from '../ui/theme';
import { stadiumBg } from '../ui/ui';
import { arcadeButton } from '../ui/modeButtons';
import { drawCoinIcon } from '../ui/wheelArt';
import { commit, getPlayer, onPlayerChange } from '../domain/playerStore';
import { equipCharge, equipDefensive, equipInferno, equipSmash, equipStyle, purchase } from '../domain/operations';
import { type SmashPower, smashOwned, smashPowerDef, smashPowerOf } from '../domain/smashPowers';
import { BUTTON_ART, queueButtonArt } from '../ui/buttonArt';
import { elementTexture } from '../ui/AbilityButton';
import { type DefensivePower, defensiveOwned, defensivePowerDef, defensivePowerOf } from '../domain/defensivePowers';
import { drawBlinkIcon, drawDisc } from '../ui/icons';
import { BP_SEASON, syncSeason } from '../domain/battlePass';
import type { PlayerState } from '../domain/player';
import { drawCashIcon } from './BattlePassScene';
import { type ItemId, type StyleId, owns } from '../domain/player';
import { CASH_PACKS, SHOP_ITEMS, clpLabel, type CashPack, type ShopItem } from '../domain/shopCatalog';
import { BALL_ART, ensureBallAnims, queueInfernoArt } from '../fx/InfernoFx';
import { infernoPowerDef, type InfernoPower } from '../domain/infernoPowers';
import { type ChargeFxId, chargeFxDef, chargeFxOf, chargeFxOwned } from '../domain/chargeFx';
import { chargePreview, queueChargeFxArt } from '../fx/chargeFx';
import { fitText } from '../ui/fitText';
import { styleLook } from '../ui/styleLook';

/**
 * TIENDA: se gastan las monedas ganadas en partidas y en la Ruleta diaria.
 * Usa el catálogo y las operaciones que ya existían (domain/shopCatalog + domain/operations.purchase):
 * precio, nivel mínimo, disponibilidad y "ya lo tienes" los valida la operación, no la pantalla.
 *   ESTILOS      se compran y se equipan aquí (también en PERSONAJE): EFECTO PELOTA y CARGANDO GOLPE (aún sin estilos)
 *   PODERES      ULTI (hielo, viento, rayo); ESPECIALES y DEFENSIVOS aún sin poderes (tarjetas "próximamente")
 *   Las monedas NO se compran: solo se ganan jugando. El DINERO (billetes) compra todo lo de la tienda.
 *   COSMÉTICOS      catálogo visual; el Premium no procesa pagos sin una integración
 */
const NAVY = 0x0b1733;
const NEON = 0x3a7bff;
const GOLD = 0xffc42e;
/** alto de la cabecera fija (volver, saldos): el contenido se desplaza por debajo */
const HEADER_H = 112;


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
  /** desplazamiento vertical del contenido (la tienda es más alta que la pantalla) */
  private scrollY = 0;
  private maxScroll = 0;
  private dragMoved = false;

  constructor() {
    super('Shop');
  }

  preload() {
    if (!this.textures.exists('menu-bg')) this.load.image('menu-bg', 'assets/menu-bg.webp');
    if (!this.textures.exists('shop-title')) this.load.image('shop-title', 'assets/tienda-titulo.png');
    queueInfernoArt(this.load); // bolas de los poderes (vista previa)
    queueChargeFxArt(this.load, ['fire', 'energy', 'tulip']); // aros de carga (vista previa)
    queueButtonArt(this.load); // botón SMASH (vista previa de sus poderes)
  }

  create() {
    const W = this.scale.width;
    restartOnResize(this);
    this.cameras.main.fadeIn(200, 0, 0, 0);
    stadiumBg(this, 0.55);
    this.modal = [];
    ensureBallAnims(this);

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
    this.setupScroll();
    const off = onPlayerChange(() => this.refreshCoins());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => off());
  }

  // ================================================================ contenido
  private build() {
    const W = this.scale.width;
    this.body.removeAll(true);
    let y = 150;

    // destacado: de dónde salen las monedas
    const tip = this.add.text(W / 2, y, 'Paga con dinero del juego · el pago en CLP llega pronto', { fontFamily: FONT, fontSize: '19px', color: '#9fb4e0' }).setOrigin(0.5);
    fitText(tip, W - 60);
    this.body.add(tip);
    y += 44;

    // ---------------------------------------------------------------- estilos
    // Efecto pelota (estela de los golpes) y Cargando golpe: los dos estilos de PERSONALIZACIÓN
    this.sectionTitle(W, y, 'ESTILOS');
    y += 34;
    y = this.subTitle(W, y, 'EFECTO PELOTA', 'Pintan la estela de tus golpes en el partido');
    const styles = SHOP_ITEMS.filter((i) => i.kind === 'style');
    const gap = 14;
    const cw = (W - 60 - gap * (styles.length - 1)) / styles.length;
    const ch = 300;
    styles.forEach((it, i) => this.styleCard(30 + i * (cw + gap), y, cw, ch, it));
    y += ch + 36;
    y = this.subTitle(W, y, 'CARGANDO GOLPE', 'El aro bajo tus pies al cargar · Nxo trae fuego, Mai tulipán');
    const charges = SHOP_ITEMS.filter((i) => i.kind === 'charge');
    const cwid = (W - 60 - gap * (charges.length - 1)) / charges.length;
    charges.forEach((it, i) => this.chargeCard(30 + i * (cwid + gap), y, cwid, ch, it));
    y += ch + 52;

    // ---------------------------------------------------------------- poderes de la ULTI (antes INFERNO)
    this.sectionTitle(W, y, 'PODERES ULTI');
    y += 26;
    const hint2 = this.add.text(W / 2, y, 'La bola de tu Ulti · fuego es gratis', { fontFamily: FONT, fontSize: '16px', color: '#7f93bf' }).setOrigin(0.5);
    fitText(hint2, W - 60);
    this.body.add(hint2);
    y += 30;
    const powers = SHOP_ITEMS.filter((i) => i.kind === 'inferno');
    const pw = (W - 60 - gap * (powers.length - 1)) / powers.length;
    powers.forEach((it, i) => this.powerCard(30 + i * (pw + gap), y, pw, ch, it));
    y += ch + 52;

    // ---------------------------------------------------------------- poderes del ESPECIAL y del DEFENSIVO (aún sin poderes)
    this.sectionTitle(W, y, 'PODERES ESPECIALES');
    y += 26;
    y = this.hintLine(W, y, 'Cambian cómo se ve tu SMASH · el fuego es gratis');
    const smashW = (W - 60 - gap * 2) / 3;
    const smashH = 270;
    const smashIce = SHOP_ITEMS.find((i) => i.id === 'smash:ice');
    this.smashCard(30, y, smashW, smashH, 'fire');
    if (smashIce) this.smashCard(30 + smashW + gap, y, smashW, smashH, 'ice', smashIce);
    this.soonCard(30 + (smashW + gap) * 2, y, smashW, smashH); // el rayo llegará después
    y += smashH + 52;
    this.sectionTitle(W, y, 'PODERES DEFENSIVOS');
    y += 26;
    y = this.hintLine(W, y, 'Cambian lo que hace tu Defensivo · el DASH es gratis');
    const defs = SHOP_ITEMS.filter((i) => i.kind === 'defensive');
    const dw = (W - 60 - gap * 2) / 3;
    const dh = 270;
    for (let i = 0; i < 3; i++) {
      const dx = 30 + i * (dw + gap);
      if (defs[i]) this.defensiveCard(dx, y, dw, dh, defs[i]);
      else this.soonCard(dx, y, dw, dh);
    }
    y += dh + 52;
    const oh = 104;

    // ---------------------------------------------------------------- dinero (se compra con CLP)
    this.sectionTitle(W, y, 'DINERO');
    y += 26;
    const hint3 = this.add.text(W / 2, y, 'Para comprar todo lo de la tienda', { fontFamily: FONT, fontSize: '16px', color: '#7f93bf' }).setOrigin(0.5);
    fitText(hint3, W - 60);
    this.body.add(hint3);
    y += 26;
    const packW = (W - 60 - gap * (CASH_PACKS.length - 1)) / CASH_PACKS.length;
    CASH_PACKS.forEach((p, i) => this.cashPackCard(30 + i * (packW + gap), y, packW, 168, p));
    y += 168 + 52;

    // ---------------------------------------------------------------- pase premium (solo dinero real)
    this.sectionTitle(W, y, 'PASE PREMIUM');
    y += 34;
    const premium = syncSeason(getPlayer() as PlayerState).bp.premium;
    this.realOffer(30, y, W - 60, oh, premium);
    this.maxScroll = Math.max(0, y + oh + 36 - this.scale.height);
    this.scrollY = Math.min(this.scrollY, this.maxScroll);
    this.body.y = -this.scrollY;
  }

  /** Envuelve un clic del contenido: se ignora si fue un arrastre (scroll), si el puntero está sobre la cabecera o hay un diálogo. */
  private tap<A extends unknown[]>(fn: (...a: A) => void) {
    return (...a: A) => {
      if (this.dragMoved || this.modal.length) return;
      if (this.input.activePointer.y < HEADER_H) return;
      fn(...a);
    };
  }

  /** Arrastrar o usar la rueda desplaza el contenido; la cabecera (volver, saldos) queda fija. */
  private setupScroll() {
    const W = this.scale.width;
    const H = this.scale.height;
    const mg = this.make.graphics({}, false);
    mg.fillRect(0, HEADER_H, W, H - HEADER_H);
    this.body.setMask(mg.createGeometryMask());
    let down = false;
    let startY = 0;
    let startScroll = 0;
    const set = (v: number) => {
      this.scrollY = Phaser.Math.Clamp(v, 0, this.maxScroll);
      this.body.y = -this.scrollY;
    };
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragMoved = false;
      down = p.y >= HEADER_H && !this.modal.length;
      startY = p.y;
      startScroll = this.scrollY;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!down || !p.isDown) return;
      if (Math.abs(p.y - startY) > 10) this.dragMoved = true;
      if (this.dragMoved) set(startScroll - (p.y - startY));
    });
    this.input.on('pointerup', () => (down = false));
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => !this.modal.length && set(this.scrollY + dy));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => mg.destroy());
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

    // botón inferior (dinero del juego) y, debajo, el precio en dinero real
    const by = y + h - 64;
    const bw = w - 24;
    if (!has) c.add(this.clpTag(sx, y + h - 22, bw, it.clp));
    if (equipped) {
      c.add(this.pill(sx, by, bw, 'EN USO', 0x1f6b35, '#9fe8a0'));
    } else if (has) {
      const b = arcadeButton(this, sx, by, bw, 48, 'USAR', this.tap(() => {
        commit((st) => equipStyle(st, id));
        this.toast(`Estilo ${it.name} equipado`);
        this.build();
      }), { palette: 'blue' });
      c.add(b);
    } else {
      const btn = this.priceButton(sx, by, bw, it.price, lowLevel || s.gems < it.price, this.tap(() => this.confirmBuy(it)));
      c.add(btn);
    }
  }

  /** Tarjeta de un poder de la ULTI (INFERNO): su bola animada, nombre, descripción y botón (precio / USAR / EN USO). */
  private powerCard(x: number, y: number, w: number, h: number, it: ShopItem) {
    const s = getPlayer();
    const power = it.id.split(':')[1] as InfernoPower;
    const def = infernoPowerDef(power);
    const has = owns(s, it.id);
    const equipped = has && s.equipped.inferno === power;
    const c = this.add.container(0, 0);
    this.body.add(c);
    c.add(this.card(x, y, w, h, { line: equipped ? 0xffffff : has ? def.color : 0x2c3d66, glow: equipped || has ? 0.3 : 0.1 }));
    const sx = x + w / 2;
    const art = BALL_ART[power];
    if (this.textures.exists(art.key)) {
      const ball = this.add.sprite(sx, y + 78, art.key, 0).setDisplaySize(112, 112);
      if (this.anims.exists(art.anim)) ball.play(art.anim);
      c.add(ball);
    } else c.add(this.add.circle(sx, y + 78, 34, def.color, 1));
    c.add(this.add.text(sx, y + 150, def.name, { fontFamily: FONT, fontSize: '24px', color: def.css }).setOrigin(0.5));
    const desc = this.add.text(sx, y + 178, has ? 'COMPRADO' : def.desc, { fontFamily: FONT, fontSize: '13px', color: has ? '#9fe8a0' : '#9fb4e0', align: 'center', wordWrap: { width: w - 16 } }).setOrigin(0.5, 0);
    c.add(desc);
    const by = y + h - 64;
    const bw = w - 24;
    if (!has) c.add(this.clpTag(sx, y + h - 22, bw, it.clp));
    if (equipped) c.add(this.pill(sx, by, bw, 'EN USO', 0x1f6b35, '#9fe8a0'));
    else if (has) {
      c.add(
        arcadeButton(this, sx, by, bw, 48, 'USAR', this.tap(() => {
          commit((st) => equipInferno(st, power));
          this.toast(`${def.ball} equipada`);
          this.build();
        }), { palette: 'blue' }),
      );
    } else c.add(this.priceButton(sx, by, bw, it.price, s.level < it.minLevel || s.gems < it.price, this.tap(() => this.confirmBuy(it))));
  }

  /** Tarjeta de un poder del ESPECIAL (SMASH): su botón con el color del poder, nombre, descripción y botón (precio / USAR / EN USO). */
  private smashCard(x: number, y: number, w: number, h: number, id: SmashPower, it?: ShopItem) {
    const s = getPlayer();
    const def = smashPowerDef(id);
    const has = smashOwned(s.owned, id);
    const equipped = smashPowerOf(s.equipped.smash) === id;
    const c = this.add.container(0, 0);
    this.body.add(c);
    c.add(this.card(x, y, w, h, { line: equipped ? 0xffffff : has ? def.color : 0x2c3d66, glow: equipped || has ? 0.3 : 0.1 }));
    const sx = x + w / 2;
    const key = BUTTON_ART.smash.key;
    if (this.textures.exists(key)) c.add(this.add.image(sx, y + 66, elementTexture(this, key, id) ?? key).setDisplaySize(84, 84));
    else {
      const ic = this.add.graphics({ x: sx, y: y + 66 });
      drawDisc(ic, 38, def.color, 0x1b3a6b);
      c.add(ic);
    }
    c.add(this.add.text(sx, y + 128, def.name, { fontFamily: FONT, fontSize: '24px', color: def.css }).setOrigin(0.5));
    c.add(this.add.text(sx, y + 154, has ? (it ? 'COMPRADO' : 'INCLUIDO') : def.desc, { fontFamily: FONT, fontSize: '13px', color: has ? '#9fe8a0' : '#9fb4e0', align: 'center', wordWrap: { width: w - 16 } }).setOrigin(0.5, 0));
    const by = y + h - 64;
    const bw = w - 24;
    if (!has && it) c.add(this.clpTag(sx, y + h - 22, bw, it.clp));
    if (equipped) c.add(this.pill(sx, by, bw, 'EN USO', 0x1f6b35, '#9fe8a0'));
    else if (has) {
      c.add(
        arcadeButton(this, sx, by, bw, 48, 'USAR', this.tap(() => {
          commit((st) => equipSmash(st, id));
          this.toast(`SMASH ${def.name.toLowerCase()} equipado`);
          this.build();
        }), { palette: 'blue' }),
      );
    } else if (it) c.add(this.priceButton(sx, by, bw, it.price, s.level < it.minLevel || s.gems < it.price, this.tap(() => this.confirmBuy(it))));
  }

  /** Tarjeta de un poder del DEFENSIVO: su icono, nombre, descripción y botón (precio / USAR / EN USO). */
  private defensiveCard(x: number, y: number, w: number, h: number, it: ShopItem) {
    const s = getPlayer();
    const id = it.id.split(':')[1] as DefensivePower;
    const def = defensivePowerDef(id);
    const has = defensiveOwned(s.owned, id);
    const equipped = defensivePowerOf(s.equipped.defensive) === id;
    const c = this.add.container(0, 0);
    this.body.add(c);
    c.add(this.card(x, y, w, h, { line: equipped ? 0xffffff : has ? def.color : 0x2c3d66, glow: equipped || has ? 0.3 : 0.1 }));
    const sx = x + w / 2;
    const ic = this.add.graphics({ x: sx, y: y + 66 });
    drawDisc(ic, 36, def.color, 0x1b3a6b);
    drawBlinkIcon(ic, 36);
    c.add(ic);
    c.add(this.add.text(sx, y + 128, def.name, { fontFamily: FONT, fontSize: '24px', color: def.css }).setOrigin(0.5));
    c.add(this.add.text(sx, y + 154, has ? 'COMPRADO' : def.desc, { fontFamily: FONT, fontSize: '13px', color: has ? '#9fe8a0' : '#9fb4e0', align: 'center', wordWrap: { width: w - 16 } }).setOrigin(0.5, 0));
    const by = y + h - 64;
    const bw = w - 24;
    if (!has) c.add(this.clpTag(sx, y + h - 22, bw, it.clp));
    if (equipped) c.add(this.pill(sx, by, bw, 'EN USO', 0x1f6b35, '#9fe8a0'));
    else if (has) {
      c.add(
        arcadeButton(this, sx, by, bw, 48, 'USAR', this.tap(() => {
          commit((st) => equipDefensive(st, id));
          this.toast(`Defensivo ${def.name.toLowerCase()} equipado`);
          this.build();
        }), { palette: 'blue' }),
      );
    } else c.add(this.priceButton(sx, by, bw, it.price, s.level < it.minLevel || s.gems < it.price, this.tap(() => this.confirmBuy(it))));
  }

  /** Tarjeta de un efecto de CARGA: el aro animado, nombre, descripción y botón (precio / USAR / EN USO / DE TU PERSONAJE). */
  private chargeCard(x: number, y: number, w: number, h: number, it: ShopItem) {
    const s = getPlayer();
    const id = it.id.split(':')[1] as ChargeFxId;
    const def = chargeFxDef(id);
    const skin = s.equipped.skin;
    const has = chargeFxOwned(s.owned, id, skin);
    const bought = s.owned.includes(it.id);
    const equipped = chargeFxOf(s.equipped.charge, skin) === id;
    const c = this.add.container(0, 0);
    this.body.add(c);
    c.add(this.card(x, y, w, h, { line: equipped ? 0xffffff : has ? def.color : 0x2c3d66, glow: equipped || has ? 0.3 : 0.1 }));
    const sx = x + w / 2;
    c.add(chargePreview(this, id, sx, y + 128, Math.min(w - 10, 170)));
    c.add(this.add.text(sx, y + 166, def.name, { fontFamily: FONT, fontSize: '24px', color: def.css }).setOrigin(0.5));
    c.add(this.add.text(sx, y + 190, has && !bought ? 'DE TU PERSONAJE' : has ? 'COMPRADO' : def.desc, { fontFamily: FONT, fontSize: '13px', color: has ? '#9fe8a0' : '#9fb4e0', align: 'center', wordWrap: { width: w - 16 } }).setOrigin(0.5, 0));
    const by = y + h - 64;
    const bw = w - 24;
    if (!has) c.add(this.clpTag(sx, y + h - 22, bw, it.clp));
    if (equipped) c.add(this.pill(sx, by, bw, 'EN USO', 0x1f6b35, '#9fe8a0'));
    else if (has) {
      c.add(
        arcadeButton(this, sx, by, bw, 48, 'USAR', this.tap(() => {
          commit((st) => equipCharge(st, id));
          this.toast(`Cargando ${def.name.toLowerCase()} equipado`);
          this.build();
        }), { palette: 'blue' }),
      );
    } else c.add(this.priceButton(sx, by, bw, it.price, s.level < it.minLevel || s.gems < it.price, this.tap(() => this.confirmBuy(it))));
  }

  /** Precio en dinero real (CLP) bajo el botón. Aún no hay pasarela de pago: avisa al tocarlo. */
  private clpTag(x: number, y: number, w: number, clp: number) {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(0x0a1638, 0.9).fillRoundedRect(-w / 2, -14, w, 28, 14);
    g.lineStyle(2, 0x3fae5a, 0.9).strokeRoundedRect(-w / 2, -14, w, 28, 14);
    const t = this.add.text(0, 0, `o ${clpLabel(clp)}`, { fontFamily: FONT, fontSize: '14px', color: '#9fe8a0' }).setOrigin(0.5);
    fitText(t, w - 10);
    c.add([g, t]);
    c.setSize(w, 32).setInteractive({ useHandCursor: true });
    c.on('pointerup', this.tap(() => this.toast('El pago con dinero real (CLP) llega pronto')));
    return c;
  }

  /** Paquete de DINERO virtual que se compra con CLP (pendiente de la pasarela de pago). */
  private cashPackCard(x: number, y: number, w: number, h: number, p: CashPack) {
    const c = this.add.container(0, 0);
    this.body.add(c);
    c.add(this.card(x, y, w, h, { line: 0x3fae5a, glow: 0.18, r: 16 }));
    const ic = this.add.graphics({ x: x + w / 2, y: y + 38 });
    drawCashIcon(ic, 1.1);
    c.add(ic);
    c.add(this.add.text(x + w / 2, y + 80, `${p.cash}`, { fontFamily: FONT, fontSize: '30px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 5 }).setOrigin(0.5));
    const nm = this.add.text(x + w / 2, y + 108, p.name.toUpperCase(), { fontFamily: FONT, fontSize: '13px', color: '#9fb4e0' }).setOrigin(0.5);
    fitText(nm, w - 10);
    c.add(nm);
    c.add(this.clpTag(x + w / 2, y + h - 24, w - 20, p.clp));
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
    panel.add(this.add.text(0, -ph / 2 + 104, `${it.kind === 'style' ? 'Estilo' : it.kind === 'inferno' ? 'Poder ULTI' : it.kind === 'charge' ? 'Cargando golpe' : it.kind === 'defensive' ? 'Poder defensivo' : it.kind === 'smash' ? 'SMASH' : 'Habilidad'} ${it.name}`, { fontFamily: FONT, fontSize: '26px', color: '#dbe5ff' }).setOrigin(0.5));
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

  /** Línea de ayuda centrada bajo un título de sección. Devuelve la y siguiente. */
  private hintLine(W: number, y: number, label: string) {
    const t = this.add.text(W / 2, y, label, { fontFamily: FONT, fontSize: '16px', color: '#7f93bf' }).setOrigin(0.5);
    fitText(t, W - 60);
    this.body.add(t);
    return y + 30;
  }

  /** Subtítulo dentro de una sección (p. ej. ESTILOS › EFECTO PELOTA) con su ayuda. Devuelve la y siguiente. */
  private subTitle(W: number, y: number, label: string, hint: string) {
    const t = this.add.text(W / 2, y, label, { fontFamily: FONT, fontSize: '22px', color: '#dbe5ff' }).setOrigin(0.5).setLetterSpacing(2);
    fitText(t, W - 60);
    this.body.add(t);
    return this.hintLine(W, y + 26, hint) + 4;
  }

  /** Fila de `n` tarjetas bloqueadas (contenido que aún no existe). Devuelve la y siguiente, ya con el aire hasta la sección que sigue. */
  /* sin uso por ahora (todas las filas tienen contenido): se deja disponible */
  soonRow(W: number, y: number, n: number, gap: number) {
    const h = 170;
    const w = (W - 60 - gap * (n - 1)) / n;
    for (let i = 0; i < n; i++) this.soonCard(30 + i * (w + gap), y, w, h);
    return y + h + 52;
  }

  /** Tarjeta bloqueada "PRÓXIMAMENTE": candado y etiqueta, sin precio ni compra. */
  private soonCard(x: number, y: number, w: number, h: number) {
    const c = this.add.container(0, 0);
    this.body.add(c);
    c.add(this.card(x, y, w, h, { line: 0x2c3d66, glow: 0 }));
    const lk = this.add.graphics({ x: x + w / 2, y: y + h * 0.4 });
    lk.lineStyle(7, 0x5d73a6, 1).beginPath().arc(0, -8, 14, Math.PI, 0).strokePath();
    lk.lineBetween(-14, -8, -14, 2).lineBetween(14, -8, 14, 2);
    lk.fillStyle(0x5d73a6, 1).fillRoundedRect(-24, 0, 48, 36, 8);
    lk.fillStyle(NAVY, 1).fillCircle(0, 15, 5).fillRect(-2, 15, 4, 10);
    c.add(lk);
    const t = this.add.text(x + w / 2, y + h - 38, 'PRÓXIMAMENTE', { fontFamily: FONT, fontSize: '16px', color: '#7f93bf' }).setOrigin(0.5).setLetterSpacing(1);
    fitText(t, w - 16);
    c.add(t);
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
