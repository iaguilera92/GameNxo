import { installTapSound } from '../fx/uiSound';
import Phaser from 'phaser';
import { FONT, restartOnResize, textStyle } from '../ui/theme';
import { UI, stadiumBg } from '../ui/ui';
import { arcadeButton } from '../ui/modeButtons';
import { commit, getPlayer, onPlayerChange } from '../domain/playerStore';
import { offersChangeIn, purchaseOffered, shopOffers } from '../domain/shopRotation';
import { type SmashPower, smashOwned, smashPowerDef } from '../domain/smashPowers';
import { BUTTON_ART, queueButtonArt } from '../ui/buttonArt';
import { elementTexture } from '../ui/AbilityButton';
import { type DefensivePower, defensiveOwned, defensivePowerDef } from '../domain/defensivePowers';
import { drawDefensiveIcon, drawDisc } from '../ui/icons';
import { BP_SEASON, syncSeason } from '../domain/battlePass';
import { bpSeasonInfo } from '../domain/battlePassConfig';
import type { PlayerState } from '../domain/player';
import { drawCashIcon } from './BattlePassScene';
import { type ItemId, type ItemKind, type StyleId, owns } from '../domain/player';
import { drawRarityFrame } from '../ui/rarity';
import { bakeGraphics, dropBaked } from '../ui/bakeGraphics';
import { CASH_PACKS, SHOP_ITEMS, clpLabel, type CashPack, type ItemRarity, type ShopItem } from '../domain/shopCatalog';
import { openShopPreview } from '../ui/ShopPreviewDialog';
import { createZoneDemo } from '../fx/zoneDemo';
import { ZONE_SKINS, ZONE_SKIN_IDS, type ZoneSkinId, zoneSkinOwned } from '../domain/zoneSkins';
import { createDefensiveDemo, createSpecialDemo, createStyleDemo } from '../fx/powerDemo';
import { addBallPreview, ensureBallAnims, queueInfernoArt } from '../fx/InfernoFx';
import { infernoPowerDef, type InfernoPower } from '../domain/infernoPowers';
import { type ChargeFxId, chargeFxDef, chargeFxOwned } from '../domain/chargeFx';
import { chargePreview, queueChargeFxArt } from '../fx/chargeFx';
import { fitText } from '../ui/fitText';
import { styleLook } from '../ui/styleLook';
import { createTrailPreview } from '../fx/ballTrailFx';
import { DASH_COOLDOWN, SMASH_COOLDOWN } from '../config';
import { INFERNO } from '../logic/InfernoDrive';
import { claimShopGift, shopGiftStatus } from '../logic/Ranked';
import { coinIcon, drawGiftIcon } from '../ui/wheelArt';

/**
 * TIENDA: todo se compra con DINERO (billetes); la cabecera solo muestra ese saldo.
 * Usa el catálogo y las operaciones que ya existían (domain/shopCatalog + domain/operations.purchase):
 * precio, nivel mínimo, disponibilidad y "ya lo tienes" los valida la operación, no la pantalla.
 * Secciones (cada una con su título y línea; las de estilos y poderes con un (i) que abre su explicación, INFO):
 *   EFECTO PELOTA · CARGANDO GOLPE   se compran y se equipan aquí (también en PERSONAJE)
 *   PODERES ULTI (tarjetas moradas con brillo) · PODERES ESPECIALES · PODERES DEFENSIVOS · DINERO · PASE PREMIUM
 *   Las monedas NO se compran: solo se ganan jugando. El DINERO (billetes) compra todo lo de la tienda.
 *   COSMÉTICOS      catálogo visual; el Premium no procesa pagos sin una integración
 */
const NAVY = 0x0b1733;
const NEON = 0x3a7bff;
const GOLD = 0xffc42e;
/** alto de la cabecera fija (volver, saldos): el contenido se desplaza por debajo */
const HEADER_H = 112;
/** prefijo de las texturas de fondos pintados una vez (tarjetas, botones): se quitan al salir de la Tienda */
const SHOP_BAKE = 'shop-bake-';
/** (17-11-2026) artículos LEGENDARIOS que SÍ tienen botón VER en la Tienda (los demás legendarios, no) */
const LEGEND_VIEWABLE: ReadonlySet<string> = new Set(['inferno:energy', 'inferno:hurricane', 'smash:dragon']); // (18-11-2026) DRAGÓN también se ve
/** Fondo de las tarjetas de PODERES ULTI: morado degradado con brillo, sin borde. */
const ULTI_TOP = '#8a4cf0';
const ULTI_MID = '#5a22b8';
const ULTI_BOT = '#2a0c63';

/** Explicación de cada sección (se abre con el icono (i) junto a su título). */
const INFO = {
  style: {
    title: 'EFECTO PELOTA',
    text: 'Cambia el color de la estela que deja la pelota en tus golpes normales y el destello de tu raqueta al golpear.\n\nEs solo visual: no cambia la velocidad ni la fuerza. Puedes equiparlo aquí o en PERSONAJE.\n\nDesliza hacia la derecha para ver todos.',
  },
  charge: {
    title: 'CARGANDO GOLPE',
    text: 'Es el aro que aparece bajo tus pies mientras cargas un golpe y que crece con tu potencia.\n\nEs solo visual. Nxo trae el de fuego y Mai el de tulipán.\n\nLa Tienda muestra 3 a la vez y cambia la selección cada 12 horas (si no hay otros, ves los que haya).',
  },
  ulti: {
    title: 'PODERES ULTI',
    text: `La ULTI se carga al ganar ${INFERNO.pointsToCharge} puntos. Al lanzarla, tu golpe sale como una bola de poder.\n\nCada poder cambia el elemento de esa bola y sus efectos. El de fuego es gratis.\n\nLa Tienda muestra 3 a la vez y cambia la selección cada 24 horas.`,
  },
  special: {
    title: 'PODERES ESPECIALES',
    text: `El ESPECIAL es tu remate (SMASH) y se recarga cada ${SMASH_COOLDOWN} segundos. Si el rival toca la pelota, sale despedido.\n\nCada poder cambia cómo se ve. El de fuego es gratis.\n\nLa Tienda muestra 3 a la vez y cambia la selección cada 12 horas.`,
  },
  defensive: {
    title: 'PODERES DEFENSIVOS',
    text: `El DEFENSIVO te ayuda a llegar a pelotas lejanas y se recarga cada ${DASH_COOLDOWN} segundos.\n\nCada poder cambia lo que hace: el DASH (gratis) es un sprint hasta la pelota, el DESTELLO te teletransporta, la SOMBRA cambia tu lugar con un clon, el SUPERSALTO salta hasta ella, la VOLTERETA llega con dos volteretas el PATINAJE patina dejando un camino de hielo y el RELÁMPAGO (épico) te vuelve un rayo azul neón que deja rayos en el suelo. Todos devuelven asegurado y se recargan igual.\n\nLa Tienda muestra 3 a la vez y cambia la selección cada 12 horas.`,
  },
  zone: {
    title: 'ZONA',
    text: 'La ZONA se activa sola cuando vas perdiendo: corres más y golpeas mejor por unos puntos.\n\nEl ESTILO DE ZONA solo cambia cómo se ve. La ELÉCTRICA (de todos) es solo el rayo de luz en los ojos; los estilos de la Tienda suman un AURA alrededor del personaje: FUEGO (épica) y SOMBRA (legendaria), con dinero real.',
  },
} as const;
type Info = (typeof INFO)[keyof typeof INFO];


const ERRORS: Record<string, string> = {
  not_enough_coins: 'No te alcanzan las monedas',
  not_enough_cash: 'No te alcanza el dinero',
  level_too_low: 'Necesitas más nivel',
  already_owned: 'Ya lo tienes',
  not_available: 'Próximamente',
  real_money_only: 'Solo con dinero real',
  not_found: 'Artículo no disponible',
  not_in_shop: 'Ya no está en la Tienda (cambió la selección)',
};

export class ShopScene extends Phaser.Scene {
  private body!: Phaser.GameObjects.Container;
  private cashText!: Phaser.GameObjects.Text;
  private modal: Phaser.GameObjects.GameObject[] = [];
  /** desplazamiento vertical del contenido (la tienda es más alta que la pantalla) */
  private scrollY = 0;
  /** tarjetas del contenido con su franja vertical: las que quedan fuera de pantalla se ocultan (no se dibujan ni redibujan sus efectos) */
  private cull: { c: Phaser.GameObjects.Container; y0: number; y1: number }[] = [];
  /** tweens de las tarjetas (objetivos que no son objetos de juego): se quitan al reconstruir para que no queden huérfanos */
  private cardTweens: Phaser.Tweens.Tween[] = [];
  private maxScroll = 0;
  /** posición (en el contenido) de la sección REGALO GRATIS: destino de la flecha GRATIS */
  private giftY = 0;
  private freeArrow?: Phaser.GameObjects.Container;
  private giftTimer?: Phaser.Time.TimerEvent;
  private rotTimer?: Phaser.Time.TimerEvent;
  private dragMoved = false;
  /** filas que se deslizan hacia los lados (EFECTO PELOTA): el contenedor con sus tarjetas, su franja vertical y cuánto puede correr a la izquierda */
  private strips: { c: Phaser.GameObjects.Container; y0: number; y1: number; max: number; bar: Phaser.GameObjects.Graphics }[] = [];
  /** dónde estaba la fila al reconstruir la Tienda (para que no salte al comprar) */
  private stripX = 0;
  /** cuenta atrás de las categorías que rotan y lo que mostraban al dibujarse (si cambia, se reconstruye) */
  private rotLabels: { t: Phaser.GameObjects.Text; kind: ItemKind }[] = [];
  private rotSig = '';

  constructor() {
    super('Shop');
  }

  preload() {
    if (!this.textures.exists('menu-bg')) this.load.image('menu-bg', 'assets/menu-bg.webp');
    if (!this.textures.exists('shop-title')) this.load.image('shop-title', 'assets/tienda-titulo.webp');
    if (!this.textures.exists('cash-1')) this.load.image('cash-1', 'assets/dinero-virtual-1.webp'); // icono de DINERO (16-11-2026)
    if (!this.textures.exists('cash-pack')) this.load.image('cash-pack', 'assets/dinero-fardo-chico.webp'); // precios de más de 1
    // retrato de Mai (premio mayor del Pase, en OFERTAS): ya lo carga BootScene; solo se descarga si falta
    if (!this.textures.exists('portrait-mai')) this.load.image('portrait-mai', 'assets/characters/mai_portrait.webp');
    queueInfernoArt(this.load); // bolas de los poderes (vista previa)
    queueChargeFxArt(this.load, ['fire', 'energy', 'tulip']); // aros de carga (vista previa)
    queueButtonArt(this.load); // botón SMASH (vista previa de sus poderes)
    // sonidos del partido que usan las demostraciones EN ACCIÓN (fx/powerDemo.ts): carga, golpe y golpe de la ULTI
    for (const [k, file] of [['cargando', 'mp3/cargando.mp3'], ['inferno-hit', 'mp3/inferno.mp3'], ['golpe-fuerte', 'mp3/golpe-fuerte.mp3']] as const) if (!this.cache.audio.exists(k)) this.load.audio(k, file);
  }

  /** al entrar: a qué sección baja sola ('cash' = DINERO; viene del + del menú) */
  private scrollTo: string | null = null;
  /** y de la sección DINERO dentro del contenido */
  private cashY = 0;

  init(data?: { scrollTo?: string }) {
    this.scrollTo = data?.scrollTo ?? null;
    this.scrollY = 0;
  }

  create() {
    const W = this.scale.width;
    restartOnResize(this);
    installTapSound(this); // clic de interfaz en cada botón / diálogo
    this.cameras.main.fadeIn(200, 0, 0, 0);
    stadiumBg(this, 0.55);
    this.modal = [];
    ensureBallAnims(this);

    // ---------------------------------------------------------------- cabecera
    // el contenido pasa por DEBAJO de la cabecera: una copia del fondo (recortada a la cabecera) lo tapa. Antes: máscara de geometría
    // sobre todo el contenedor (stencil en cada fotograma, caro en el móvil).
    this.headerCover(W);
    const n0 = this.children.length;
    const headY = 64;
    this.backButton(54, headY, () => {
      this.cameras.main.fadeOut(180, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Menu'));
    });
    // título centrado (ancho mínimo de pantalla 720: no choca con volver ni con el saldo)
    const titleW = Math.min(250, Math.max(150, W - 250));
    this.add.image(W / 2, headY - 3, 'shop-title').setDisplaySize(titleW, titleW / 3);
    this.cashPill(W - 26, headY);
    this.children.list.slice(n0).forEach((o) => (o as Phaser.GameObjects.GameObject & { setDepth(v: number): unknown }).setDepth(11)); // cabecera sobre la cubierta

    this.body = this.add.container(0, 0);
    this.stripX = 0;
    this.strips = [];
    this.build();
    // cuenta atrás de lo que rota y cambio de selección (3 a la vez; CARGANDO / ESPECIAL / DEFENSIVO cada 12 h, ULTI cada 24 h)
    this.rotTimer = this.time.addEvent({ delay: 1000, loop: true, callback: () => this.tickRotation() });
    this.setupScroll();
    this.makeFreeArrow();
    // viene del + del dinero: tras el fundido, el contenido baja con el scroll (animado) hasta la sección DINERO
    if (this.scrollTo === 'cash') {
      const target = Math.min(this.maxScroll, Math.max(0, this.cashY - HEADER_H - 24));
      this.time.delayedCall(450, () => {
        if (!this.sys.isActive()) return;
        const from = { v: 0 };
        this.tweens.add({ targets: from, v: target, duration: 1500, ease: 'Cubic.easeInOut', onUpdate: () => this.setScroll(from.v) });
      });
    }
    const off = onPlayerChange(() => this.refreshCash());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      off();
      dropBaked(this, SHOP_BAKE);
    });
  }

  // ================================================================ contenido
  private build() {
    const W = this.scale.width;
    // lo anterior se va entero: sus tweens también (los de objetos dentro de las tarjetas y los de objetos sueltos)
    this.cardTweens.forEach((t) => t.remove());
    this.cardTweens = [];
    if (this.strips.length) this.stripX = this.strips[0].c.x; // la fila de EFECTO PELOTA no salta al reconstruir (comprar, cambio de selección)
    const dead: Phaser.GameObjects.GameObject[] = [];
    const collect = (o: Phaser.GameObjects.GameObject) => {
      dead.push(o);
      (o as Phaser.GameObjects.Container).list?.forEach(collect);
    };
    this.body.list.forEach(collect);
    if (dead.length) this.tweens.killTweensOf(dead);
    this.body.removeAll(true);
    this.cull = [];
    this.body.y = 0;
    let y = 150;
    // cada título lleva su línea; los de estilos y poderes, además, un (i) que abre su explicación (INFO)
    const titleGap = 44; // del título a sus tarjetas

    const ch = 300;
    // ---------------------------------------------------------------- ofertas: el Pase de Batalla, primero y en grande
    // (una sola tarjeta del alto y el ancho de la fila de EFECTO PELOTA)
    // (con el Pase terminado no hay oferta: la sección no sale)
    if (!bpSeasonInfo().over) {
      this.sectionTitle(W, y, 'OFERTAS');
      y += titleGap;
      this.passOffer(30, y, W - 60, ch, syncSeason(getPlayer() as PlayerState).bp.premium);
      this.reg(y, ch);
      y += ch + 52;
    }

    // lo que rota (CARGANDO GOLPE, ESPECIAL, DEFENSIVO cada 12 h; ULTI cada 24 h): 3 a la vez, igual para todos (domain/shopRotation.ts)
    const now = Date.now();
    this.rotLabels = [];
    this.rotSig = this.rotationSignature(now);
    this.strips = [];
    const gap = 14;
    // 3 tarjetas por fila: si hay menos (no hay otros que mostrar), quedan centradas
    const cols3 = (n: number) => {
      const w = (W - 60 - gap * 2) / 3;
      const x0 = 30 + (W - 60 - (n * w + (n - 1) * gap)) / 2;
      return { w, x: (i: number) => x0 + i * (w + gap) };
    };

    // ---------------------------------------------------------------- efecto pelota (estela de los golpes)
    this.sectionTitle(W, y, 'EFECTO PELOTA', INFO.style);
    y += titleGap;
    // todos los efectos en UNA fila que se desliza hacia la derecha: 4 a la vista y el siguiente asoma por el borde
    const styles = SHOP_ITEMS.filter((i) => i.kind === 'style');
    const styleCols = 4;
    const cw = (W - 60 - gap * (styleCols - 1)) / styleCols;
    const strip = this.add.container(0, 0);
    this.body.add(strip);
    styles.forEach((it, i) => {
      this.styleCard(30 + i * (cw + gap), y, cw, ch, it);
      const card = this.body.list[this.body.length - 1]; // styleCard la añadió al contenido: pasa a la fila deslizable
      this.body.remove(card);
      strip.add(card);
    });
    const stripMax = Math.max(0, styles.length * (cw + gap) - gap - (W - 60));
    const stripBar = this.add.graphics();
    this.body.add(stripBar);
    strip.x = Phaser.Math.Clamp(this.stripX, -stripMax, 0);
    this.strips.push({ c: strip, y0: y, y1: y + ch, max: stripMax, bar: stripBar });
    this.cull.push({ c: strip, y0: y, y1: y + ch });
    this.drawStripBar(this.strips[0], W);
    y += ch + 52;

    // ---------------------------------------------------------------- cargando golpe (aro al cargar)
    this.sectionTitle(W, y, 'CARGANDO GOLPE', INFO.charge);
    this.rotationLabel(W, y, 'charge', now);
    y += titleGap;
    const charges = shopOffers('charge', now);
    const cc = cols3(charges.length);
    charges.forEach((it, i) => {
      this.chargeCard(cc.x(i), y, cc.w, ch, it);
      this.reg(y, ch);
    });
    y += ch + 52;

    // ---------------------------------------------------------------- poderes de la ULTI (antes INFERNO)
    this.sectionTitle(W, y, 'PODERES ULTI', INFO.ulti);
    this.rotationLabel(W, y, 'inferno', now);
    y += titleGap;
    const powers = shopOffers('inferno', now);
    const pc = cols3(powers.length);
    powers.forEach((it, i) => {
      this.powerCard(pc.x(i), y, pc.w, ch, it);
      this.reg(y, ch);
    });
    y += ch + 52;

    // ---------------------------------------------------------------- poderes del ESPECIAL y del DEFENSIVO
    this.sectionTitle(W, y, 'PODERES ESPECIALES', INFO.special);
    this.rotationLabel(W, y, 'smash', now);
    y += titleGap;
    // 3 a la vez (el FUEGO es gratis y no entra en la rotación: se elige en PERSONALIZAR)
    const smashItems = shopOffers('smash', now);
    const sc = cols3(smashItems.length);
    const smashH = 270;
    smashItems.forEach((it, i) => {
      this.smashCard(sc.x(i), y, sc.w, smashH, it.id.split(':')[1] as SmashPower, it);
      this.reg(y, smashH);
    });
    y += smashH + 52;
    this.sectionTitle(W, y, 'PODERES DEFENSIVOS', INFO.defensive);
    this.rotationLabel(W, y, 'defensive', now);
    y += titleGap;
    const defs = shopOffers('defensive', now);
    const dc = cols3(defs.length);
    const dh = 270;
    defs.forEach((it, i) => {
      this.defensiveCard(dc.x(i), y, dc.w, dh, it);
      this.reg(y, dh);
    });
    y += dh + 52;
    // ---------------------------------------------------------------- ESTILOS DE ZONA (16-11-2026): Eléctrica (de todos), Fuego (épica), Sombra (legendaria)
    this.sectionTitle(W, y, 'ZONA', INFO.zone);
    y += titleGap;
    const zc = cols3(ZONE_SKIN_IDS.length);
    const zh = 270;
    ZONE_SKIN_IDS.forEach((zid, i) => {
      this.zoneCard(zc.x(i), y, zc.w, zh, zid, SHOP_ITEMS.find((it) => it.id === `zone:${zid}`));
      this.reg(y, zh);
    });
    y += zh + 52;
    // ---------------------------------------------------------------- dinero (se compra con CLP)
    this.cashY = y;
    this.sectionTitle(W, y, 'DINERO');
    y += titleGap;
    // cuadrícula de 3 columnas (como la tienda de gemas de Brawl Stars)
    const packCols = 3;
    const packW = (W - 60 - gap * (packCols - 1)) / packCols;
    const packH = Math.round(packW * 0.92);
    CASH_PACKS.forEach((p, i) => {
      const py = y + Math.floor(i / packCols) * (packH + gap);
      this.cashPackCard(30 + (i % packCols) * (packW + gap), py, packW, packH, p, i);
      this.reg(py, packH);
    });
    y += Math.ceil(CASH_PACKS.length / packCols) * (packH + gap) - gap;
    y += 52;

    // ---------------------------------------------------------------- regalo gratis (al final; la flecha GRATIS lleva aquí)
    this.giftY = y - 30;
    this.sectionTitle(W, y, 'REGALO GRATIS');
    y += titleGap;
    const giftH = 190;
    this.giftCard(30, y, W - 60, giftH);
    this.reg(y, giftH);
    y += giftH;
    this.maxScroll = Math.max(0, y + 36 - this.scale.height);
    this.scrollY = Math.min(this.scrollY, this.maxScroll);
    this.body.y = -this.scrollY;
    this.cullCards();
  }

  /** Qué muestra ahora cada categoría que rota (para saber si hay que reconstruir la Tienda al cambiar). */
  private rotationSignature(now: number) {
    return (['charge', 'inferno', 'smash', 'defensive'] as ItemKind[]).map((k) => shopOffers(k, now).map((i) => i.id).join(',')).join('|');
  }

  /** "NUEVOS EN 04:12:09" bajo el título de una categoría que rota (si no hay otros que mostrar, no sale). */
  private rotationLabel(W: number, y: number, kind: ItemKind, now: number) {
    const ms = offersChangeIn(kind, now);
    if (ms === null) return;
    const t = this.add.text(W / 2, y + 27, '', { fontFamily: FONT, fontSize: '13px', color: '#9fb4e0' }).setOrigin(0.5).setLetterSpacing(1);
    this.body.add(t);
    this.rotLabels.push({ t, kind });
    this.setRotationText(t, ms);
  }

  private setRotationText(t: Phaser.GameObjects.Text, ms: number) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const two = (n: number) => String(n).padStart(2, '0');
    t.setText(`NUEVOS EN ${two(Math.floor(s / 3600))}:${two(Math.floor((s % 3600) / 60))}:${two(s % 60)}`);
  }

  /** Una vez por segundo: cuenta atrás de las categorías que rotan; si cambió la selección, se dibuja la nueva. */
  private tickRotation() {
    if (!this.sys.isActive()) return;
    const now = Date.now();
    if (this.rotationSignature(now) !== this.rotSig) {
      this.build();
      return;
    }
    for (const l of this.rotLabels) {
      const ms = offersChangeIn(l.kind, now);
      if (ms !== null) this.setRotationText(l.t, ms);
    }
  }

  /** Barrita bajo la fila deslizable: dónde está la parte que se ve (y que hay más a la derecha). */
  private drawStripBar(s: { c: Phaser.GameObjects.Container; y0: number; y1: number; max: number; bar: Phaser.GameObjects.Graphics }, W: number) {
    const g = s.bar.clear();
    if (s.max <= 0) return;
    const x0 = 30;
    const w = W - 60;
    const y = s.y1 + 18;
    const thumb = w * (w / (w + s.max));
    const tx = x0 + (w - thumb) * (-s.c.x / s.max);
    g.fillStyle(0xffffff, 0.12).fillRoundedRect(x0, y, w, 5, 2.5);
    g.fillStyle(0x6fb2ff, 0.9).fillRoundedRect(tx, y, thumb, 5, 2.5);
  }
  /** Apunta la última tarjeta creada en el contenido con su franja vertical (para ocultarla fuera de pantalla). */
  private reg(y0: number, h: number) {
    const c = this.body.list[this.body.length - 1];
    if (c instanceof Phaser.GameObjects.Container) this.cull.push({ c, y0, y1: y0 + h });
  }

  /** Oculta las tarjetas que quedan fuera de la pantalla (y por tanto sus efectos): solo se dibuja lo que se ve. */
  private cullCards() {
    const H = this.scale.height;
    const top = this.scrollY + HEADER_H - 40;
    const bottom = this.scrollY + H + 40;
    for (const e of this.cull) {
      const vis = e.y1 > top && e.y0 < bottom;
      if (e.c.visible !== vis) e.c.setVisible(vis);
    }
  }

  /** Envuelve un clic del contenido: se ignora si fue un arrastre (scroll), si el puntero está sobre la cabecera o hay un diálogo. */
  private tap<A extends unknown[]>(fn: (...a: A) => void) {
    return (...a: A) => {
      if (this.dragMoved || this.modal.length) return;
      if (this.input.activePointer.y < HEADER_H) return;
      fn(...a);
    };
  }

  /** Desplaza el contenido a `v` (acotado). */
  private setScroll(v: number) {
    this.scrollY = Phaser.Math.Clamp(v, 0, this.maxScroll);
    this.body.y = -this.scrollY;
    this.cullCards();
    // la flecha GRATIS se esconde al llegar abajo (ya se ve el regalo)
    if (this.freeArrow) this.freeArrow.setVisible(this.scrollY < Math.min(this.maxScroll, this.giftY - 200));
  }

  /**
   * REGALO GRATIS: una vez al día unas monedas gratis (5, a veces 10 o 15; domain/shopGift.ts). Disponible: botón
   * RECOGER que late. Ya recogido: cuenta atrás hasta el próximo (reinicio 23:59 hora de Chile).
   */
  private giftCard(x: number, y: number, w: number, h: number) {
    const st = shopGiftStatus();
    const c = this.add.container(0, 0);
    this.body.add(c);
    // como una celda del PASE DE BATALLA, sin brillo ni dorado: card verde, regalo al centro y toda la card es táctil
    const GIFT = 0x35c85a;
    c.add(this.card(x, y, w, h, { line: st.available ? GIFT : NEON, glow: st.available ? 0.3 : 0.18 }));
    if (st.available) {
      const tint = this.add.graphics();
      tint.fillStyle(GIFT, 0.14).fillRoundedRect(x, y, w, h, 20);
      c.add(tint);
    }
    const cx = x + w / 2;
    const ic = this.add.graphics({ x: cx, y: y + h * 0.47 }).setScale(1.25);
    drawGiftIcon(ic, 40);
    c.add(ic);
    if (st.available) this.tweens.add({ targets: ic, angle: { from: -6, to: 6 }, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // monedas que trae, bajo el regalo
    const sub = this.add.text(0, y + h - 30, '5 a 15 monedas gratis', { fontFamily: FONT, fontSize: '20px', color: '#ffe680' }).setOrigin(0, 0.5);
    const subW = 30 + sub.width;
    const coin = coinIcon(this, cx - subW / 2 + 12, y + h - 30, 12); // (17-11-2026) moneda: imagen moneda-1.webp
    sub.setX(cx - subW / 2 + 30);
    c.add([coin, sub]);
    this.giftTimer?.remove();
    this.giftTimer = undefined;
    if (st.available) {
      // "¡RECLAMAR!" arriba (como el pase) y la card entera recoge el regalo
      const pill = this.add.container(cx, y + 30);
      const pg = this.add.graphics();
      pg.fillStyle(0x0a3a18, 1).fillRoundedRect(-66, -16, 132, 32, 16);
      pg.fillStyle(GIFT, 1).fillRoundedRect(-63, -14, 126, 28, 14);
      pill.add([pg, this.add.text(0, 0, '¡RECLAMAR!', { fontFamily: FONT, fontSize: '17px', color: '#ffffff', stroke: '#0a3a18', strokeThickness: 4 }).setOrigin(0.5)]);
      c.add(pill);
      this.tweens.add({ targets: pill, scale: { from: 1, to: 1.08 }, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const hit = this.add.zone(cx, y + h / 2, w, h).setInteractive({ useHandCursor: true });
      hit.on('pointerup', this.tap(() => this.claimGift()));
      c.add(hit);
    } else {
      // ya recogido: atenuada y con la cuenta atrás arriba
      c.add(this.add.rectangle(cx, y + h / 2, w, h, 0x02060f, 0.35));
      const left = this.add.text(cx, y + 30, '', { fontFamily: FONT, fontSize: '20px', color: '#9fb2da' }).setOrigin(0.5);
      c.add(left);
      const paint = () => {
        const ms = shopGiftStatus().nextMs;
        if (ms <= 0) {
          this.build(); // ya hay regalo nuevo
          return;
        }
        const hh = Math.floor(ms / 3600_000);
        const mm = Math.floor((ms % 3600_000) / 60_000);
        if (left.active) left.setText('Recogido · el próximo en ' + hh + ' h ' + mm + ' min');
      };
      paint();
      this.giftTimer = this.time.addEvent({ delay: 30_000, loop: true, callback: paint });
    }
  }

  /** Recoge el regalo: monedas que saltan, "+N MONEDAS" y la tarjeta pasa a la cuenta atrás. */
  private claimGift() {
    const res = claimShopGift();
    if (!res.ok) return;
    const amount = (res as unknown as { amount: number }).amount;
    const W = this.scale.width;
    const H = this.scale.height;
    const t = this.add.text(W / 2, H * 0.45, '+' + amount + ' MONEDAS', textStyle(44, '#ffd23f')).setOrigin(0.5).setDepth(9000).setScale(0.4);
    this.tweens.add({ targets: t, scale: 1, duration: 320, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, y: t.y - 40, delay: 1100, duration: 300, onComplete: () => t.destroy() });
    for (let i = 0; i < 12; i++) {
      const g = coinIcon(this, W / 2, H * 0.45 + 40, 12).setDepth(8999); // (17-11-2026) moneda: imagen moneda-1.webp
      const a = Phaser.Math.FloatBetween(-Math.PI, 0);
      const d = Phaser.Math.FloatBetween(90, 220);
      this.tweens.add({ targets: g, x: W / 2 + Math.cos(a) * d, y: H * 0.45 + 40 + Math.sin(a) * d, alpha: 0, duration: Phaser.Math.Between(600, 900), ease: 'Cubic.easeOut', onComplete: () => g.destroy() });
    }
    this.celebrate();
    this.build();
    this.freeArrow?.destroy();
    this.makeFreeArrow();
  }

  /** Flecha GRATIS (fija, abajo a la derecha): baja deslizando hasta el REGALO GRATIS del final. */
  private makeFreeArrow() {
    const W = this.scale.width;
    const H = this.scale.height;
    const c = this.add.container(W - 92, H - 70).setDepth(5000);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.35).fillRoundedRect(-72 + 3, -30 + 5, 144, 60, 30);
    g.fillStyle(0x1f8a3a, 1).fillRoundedRect(-72, -30, 144, 60, 30);
    g.fillStyle(0x3ccf5a, 1).fillRoundedRect(-72, -32, 144, 56, 28);
    g.fillStyle(0xffffff, 0.25).fillRoundedRect(-62, -28, 124, 18, 9);
    g.lineStyle(5, 0xffffff, 1).beginPath().moveTo(40, -10).lineTo(50, 2).lineTo(60, -10).strokePath();
    c.add(g);
    c.add(this.add.text(-14, -4, 'GRATIS', { fontFamily: FONT, fontSize: '22px', color: '#ffffff', stroke: '#0a3a18', strokeThickness: 5 }).setOrigin(0.5));
    // punto rojo: hay regalo por recoger
    if (shopGiftStatus().available) c.add(this.add.circle(64, -28, 9, 0xff4f5e).setStrokeStyle(3, 0xffffff));
    c.setSize(150, 66).setInteractive({ useHandCursor: true });
    this.tweens.add({ targets: c, y: c.y - 8, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    c.on('pointerdown', () => {
      if (this.modal.length) return;
      const from = { v: this.scrollY };
      this.tweens.add({ targets: from, v: this.maxScroll, duration: 650, ease: 'Cubic.easeInOut', onUpdate: () => this.setScroll(from.v) });
    });
    this.freeArrow = c;
    this.setScroll(this.scrollY);
  }

  /** Arrastrar o usar la rueda desplaza el contenido; la cabecera (volver, saldos) queda fija. */
  private setupScroll() {
    let down = false;
    let startX = 0;
    let startY = 0;
    let startScroll = 0;
    /** fila deslizable bajo el dedo al empezar y su posición; el eje (horizontal / vertical) se decide al primer movimiento claro */
    let strip: (typeof this.strips)[number] | null = null;
    let startStripX = 0;
    let axis: 'h' | 'v' | null = null;
    const set = (v: number) => this.setScroll(v);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragMoved = false;
      down = p.y >= HEADER_H && !this.modal.length;
      startX = p.x;
      startY = p.y;
      startScroll = this.scrollY;
      axis = null;
      // ¿empezó sobre una fila que se desliza? (su franja está en el contenido: se pasa a pantalla con el scroll vertical)
      strip = down ? this.strips.find((s) => s.max > 0 && p.y >= s.y0 - this.scrollY && p.y <= s.y1 - this.scrollY) ?? null : null;
      startStripX = strip?.c.x ?? 0;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!down || !p.isDown) return;
      const dx = p.x - startX;
      const dy = p.y - startY;
      if (axis === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) axis = strip && Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      if (axis === 'h' && strip) {
        this.dragMoved = true;
        strip.c.x = Phaser.Math.Clamp(startStripX + dx, -strip.max, 0);
        this.drawStripBar(strip, this.scale.width);
      } else if (axis === 'v') {
        this.dragMoved = true;
        set(startScroll - dy);
      }
    });
    this.input.on('pointerup', () => (down = false));
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, dx: number, dy: number) => {
      if (this.modal.length) return;
      const s = this.strips.find((q) => q.max > 0 && p.y >= q.y0 - this.scrollY && p.y <= q.y1 - this.scrollY);
      if (s && Math.abs(dx) > Math.abs(dy)) {
        s.c.x = Phaser.Math.Clamp(s.c.x - dx, -s.max, 0); // rueda horizontal (ratón, trackpad) sobre la fila
        this.drawStripBar(s, this.scale.width);
      } else set(this.scrollY + dy);
    });
  }

  /** Copia del fondo del estadio (con su velo) solo en la franja de la cabecera, por encima del contenido que se desplaza. */
  private headerCover(W: number) {
    const H = this.scale.height;
    if (this.textures.exists('menu-bg')) {
      const bg = this.add.image(W / 2, H / 2, 'menu-bg').setScrollFactor(0).setDepth(10);
      const k = Math.max(W / bg.width, H / bg.height);
      bg.setScale(k);
      bg.setCrop(0, Math.max(0, (bg.height * k) / 2 / k - H / 2 / k), bg.width, HEADER_H / k);
    } else this.add.rectangle(0, 0, W, HEADER_H, UI.navy).setOrigin(0).setDepth(10);
    this.add.rectangle(0, 0, W, HEADER_H, UI.navy, 0.55).setOrigin(0).setDepth(10);
  }

  /**
   * OFERTAS: el Pase de Batalla en una tarjeta dorada brillante (borde que late, franjas de luz y destellos), con el premio
   * mayor (MAI, personaje nuevo) a la izquierda y el precio del Pase Premium (dinero real) a la derecha. Tocarla abre el
   * Pase. Con el Premium ya comprado, ACTIVO en vez del precio.
   */
  private passOffer(x: number, y: number, w: number, h: number, active: boolean) {
    const c = this.add.container(0, 0);
    this.body.add(c);
    const r = 22;
    // halo dorado que late alrededor
    const halo = this.add.graphics();
    halo.lineStyle(12, 0xffd23f, 0.35).strokeRoundedRect(x - 2, y - 2, w + 4, h + 4, r + 2);
    c.add(halo);
    this.tweens.add({ targets: halo, alpha: { from: 0.35, to: 1 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // cuerpo dorado por capas (oscuro abajo, claro arriba) y franjas de brillo en diagonal
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.35).fillRoundedRect(x + 3, y + 6, w, h, r);
    g.fillStyle(0x8a5a00, 1).fillRoundedRect(x, y, w, h, r);
    g.fillStyle(0xd99a12, 1).fillRoundedRect(x + 4, y + 4, w - 8, h - 8, r - 3);
    g.fillStyle(0xffc42e, 1).fillRoundedRect(x + 4, y + 4, w - 8, h * 0.62, { tl: r - 3, tr: r - 3, bl: 10, br: 10 });
    g.fillStyle(0xffe27a, 1).fillRoundedRect(x + 4, y + 4, w - 8, h * 0.26, { tl: r - 3, tr: r - 3, bl: 8, br: 8 });
    g.fillStyle(0xffffff, 0.12);
    for (const fx of [0.32, 0.5, 0.82]) {
      const sx = x + w * fx;
      g.fillPoints([{ x: sx, y: y + 4 }, { x: sx + 46, y: y + 4 }, { x: sx - 34, y: y + h - 4 }, { x: sx - 80, y: y + h - 4 }], true);
    }
    g.lineStyle(4, 0xfff1b8, 1).strokeRoundedRect(x, y, w, h, r);
    c.add(g);
    // brillo que recorre el borde: dos destellos opuestos que dan la vuelta a la tarjeta (con estela que se apaga)
    const edge = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    c.add(edge);
    const per = 2 * (w + h);
    /** punto del borde a la distancia `d` (desde la esquina superior izquierda, en sentido horario) */
    const at = (d: number) => {
      const t = ((d % per) + per) % per;
      if (t < w) return { px: x + t, py: y };
      if (t < w + h) return { px: x + w, py: y + (t - w) };
      if (t < 2 * w + h) return { px: x + w - (t - w - h), py: y + h };
      return { px: x, py: y + h - (t - 2 * w - h) };
    };
    const run = { d: 0 };
    const trail = 150;
    let lastEdge = 0;
    const edgeTw = this.tweens.add({
      targets: run,
      d: per,
      duration: 2600,
      repeat: -1,
      onUpdate: () => {
        if (!c.visible) return; // fuera de pantalla: no se redibuja
        if (this.time.now - lastEdge < 33) return; // 30 fps bastan para un destello (la mitad del trabajo)
        lastEdge = this.time.now;
        edge.clear();
        for (const off of [0, per / 2]) {
          for (let k = 0; k < 6; k++) {
            const a = at(run.d + off - (k * trail) / 6);
            const b = at(run.d + off - ((k + 1) * trail) / 6);
            const f = 1 - k / 6;
            edge.lineStyle(6 * f + 2, 0xffffff, 0.85 * f).lineBetween(a.px, a.py, b.px, b.py);
          }
          const head = at(run.d + off);
          edge.fillStyle(0xffffff, 1).fillCircle(head.px, head.py, 5);
        }
      },
    });
    this.cardTweens.push(edgeTw);
    c.once(Phaser.GameObjects.Events.DESTROY, () => edgeTw.remove());

    // premio mayor: MAI a la izquierda, de pie sobre el borde de abajo, con resplandor detrás
    const box = { x0: 118, y0: 4, x1: 1070, y1: 1356 }; // caja visible de mai_portrait.png (1130 × 1392), como en BattlePassScene
    const vh = h - 22;
    const vw = ((box.x1 - box.x0) / (box.y1 - box.y0)) * vh;
    const px = x + 16 + vw / 2;
    const glow = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    glow.fillStyle(0xfff1b8, 0.3).fillEllipse(px, y + h * 0.5, vw * 1.25, vh * 0.95);
    c.add(glow);
    this.tweens.add({ targets: glow, alpha: { from: 0.5, to: 1 }, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    if (this.textures.exists('portrait-mai')) {
      const img = this.add.image(px, y + h - 6, 'portrait-mai');
      img.setOrigin((box.x0 + box.x1) / 2 / img.width, box.y1 / img.height);
      img.setScale(vh / (box.y1 - box.y0));
      c.add(img);
    }

    // textos y precio, centrados en la columna derecha
    const tx = (px + vw / 2 + 10 + x + w - 16) / 2;
    const colW = x + w - 16 - (px + vw / 2 + 10);
    const dark = '#5a3200';
    const title = this.add.text(tx, y + 50, 'PASE DE BATALLA', { fontFamily: FONT, fontSize: '34px', color: '#ffffff', stroke: dark, strokeThickness: 7 }).setOrigin(0.5);
    fitText(title, colW);
    const season = this.add.text(tx, y + 88, BP_SEASON.name, { fontFamily: FONT, fontSize: '18px', color: dark }).setOrigin(0.5).setLetterSpacing(2);
    const prize = this.add.text(tx, y + 128, '¡CONSIGUE MÚLTIPLES RECOMPENSAS!', { fontFamily: FONT, fontSize: '16px', color: '#fff6d8', stroke: dark, strokeThickness: 4 }).setOrigin(0.5).setLetterSpacing(1);
    fitText(prize, colW);
    const who = this.add.text(tx, y + 160, 'NUEVO PERSONAJE: MAI', { fontFamily: FONT, fontSize: '22px', color: '#ffffff', stroke: dark, strokeThickness: 6 }).setOrigin(0.5);
    fitText(who, colW);
    c.add([title, season, prize, who]);
    const by = y + h - 62;
    if (active) c.add(this.pill(tx, by, 170, 'ACTIVO', 0x1f6b35, '#9fe8a0'));
    else {
      const price = this.add.container(tx, by);
      const pb = this.add.graphics();
      pb.fillStyle(0x0a1638).fillRoundedRect(-104, -31, 208, 62, 18);
      pb.fillStyle(0x2fae4f).fillRoundedRect(-100, -27, 200, 54, 16);
      pb.fillStyle(0x5fe07a).fillRoundedRect(-100, -27, 200, 28, { tl: 16, tr: 16, bl: 6, br: 6 });
      price.add([pb, this.add.text(0, 0, BP_SEASON.premiumRealPrice, { fontFamily: FONT, fontSize: '24px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 5 }).setOrigin(0.5)]);
      c.add(price);
      this.tweens.add({ targets: price, scale: { from: 1, to: 1.06 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    // destellos que titilan
    const spark: [number, number, number][] = [[0.06, 0.12, 9], [0.36, 0.2, 7], [0.95, 0.12, 8], [0.6, 0.86, 6], [0.97, 0.7, 7], [0.4, 0.62, 5]];
    spark.forEach(([fx, fy, sr], i) => {
      const st = this.add.star(x + w * fx, y + h * fy, 4, sr * 0.35, sr, 0xffffff).setBlendMode(Phaser.BlendModes.ADD);
      c.add(st);
      this.tweens.add({ targets: st, alpha: { from: 0.1, to: 1 }, scale: { from: 0.5, to: 1.2 }, angle: 45, duration: 700 + i * 130, delay: i * 170, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });

    // toda la tarjeta abre el Pase de Batalla
    const hit = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
    hit.on('pointerup', this.tap(() => {
      this.cameras.main.fadeOut(180, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('BattlePass'));
    }));
    c.add(hit);
  }

  /** Tarjeta de estilo: muestra de color, nombre y botón (precio / nivel / USAR / EN USO). */
  private styleCard(x: number, y: number, w: number, h: number, it: ShopItem) {
    const s = getPlayer();
    const id = it.id.split(':')[1] as StyleId;
    const has = owns(s, it.id);
        const lowLevel = s.level < it.minLevel;
    const c = this.add.container(0, 0);
    this.body.add(c);
    c.add(this.card(x, y, w, h, { line: has ? NEON : it.id === 'style:gold' ? GOLD : 0x2c3d66, glow: it.id === 'style:gold' ? 0.3 : 0, rarity: it.rarity }));

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
    // (16-11-2026) el botón de abajo es VER (EN ACCIÓN): dentro se compra (dinero virtual / real) o se usa. Lo legendario no se muestra: botones de siempre
    // (21-11-2026) lo que ya es tuyo también se VE (dentro se usa): ya no hay botón USAR en la tarjeta
    const canView = has || (it.rarity !== 'legendaria' && it.available);
    if (!has && it.available && !it.realMoneyOnly) c.add(canView ? [] : this.clpTag(sx, y + h - 22, bw, it.clp));
    if (canView) {
      c.add(this.viewButton(sx, by, bw, () => this.openPreview(it)));
    } else if (!has && !it.available) {
      // sin rareza decidida: se ve el efecto pero aún no se vende
      c.add(this.pill(sx, by, bw, 'PRÓXIMAMENTE', 0x24365f, '#9fb4e0'));
    } else if (!has && it.realMoneyOnly) {
      // ÉPICA / LEGENDARIA: solo con dinero real (el pago llega con la pasarela)
      c.add(arcadeButton(this, sx, by, bw, 48, clpLabel(it.clp), this.tap(() => this.toast(lowLevel ? `Necesitas nivel ${it.minLevel}` : 'El pago con dinero real (CLP) llega pronto')), { palette: 'green', disabled: lowLevel }));
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
        const c = this.add.container(0, 0);
    this.body.add(c);
    this.ultiCardBg(c, x, y, w, h);
    const sx = x + w / 2;
    // su bola animada (y su rastro detrás, si lo trae: tulipán)
    c.add(addBallPreview(this, sx, y + 78, power, w - 12, 112, true, def.color));
    c.add(this.add.text(sx, y + 150, def.name, { fontFamily: FONT, fontSize: '24px', color: def.css, stroke: '#1a0640', strokeThickness: 5 }).setOrigin(0.5));
    const desc = this.add.text(sx, y + 178, has ? 'COMPRADO' : def.desc, { fontFamily: FONT, fontSize: '13px', color: has ? '#9fe8a0' : '#e2d3ff', align: 'center', wordWrap: { width: w - 16 } }).setOrigin(0.5, 0);
    c.add(desc);
    const by = y + h - 64;
    const bw = w - 24;
    // (21-11-2026) el botón de abajo es VER (EN ACCIÓN): dentro se compra o se usa. Lo legendario que no tienes: botones de siempre
    // (17-11-2026) excepción: la ULTI LEGENDARIA BOLA DE ENERGÍA SÍ se VE (su demostración con las 4 máquinas, fx/powerDemo.ts)
    const canView = has || it.rarity !== 'legendaria' || LEGEND_VIEWABLE.has(it.id);
    if (!has) c.add(canView ? [] : this.clpTag(sx, y + h - 22, bw, it.clp));
    if (canView) c.add(this.viewButton(sx, by, bw, () => this.openPreview(it)));
    else if (it.realMoneyOnly) {
      c.add(arcadeButton(this, sx, by, bw, 48, clpLabel(it.clp), this.tap(() => this.toast(s.level < it.minLevel ? `Necesitas nivel ${it.minLevel}` : 'El pago con dinero real (CLP) llega pronto')), { palette: 'green', disabled: s.level < it.minLevel }));
    } else c.add(this.priceButton(sx, by, bw, it.price, s.level < it.minLevel || s.gems < it.price, this.tap(() => this.confirmBuy(it))));
  }

  /** Tarjeta de un poder del ESPECIAL (SMASH): su botón con el color del poder, nombre, descripción y botón (precio / USAR / EN USO). */
  private smashCard(x: number, y: number, w: number, h: number, id: SmashPower, it?: ShopItem) {
    const s = getPlayer();
    const def = smashPowerDef(id);
    const has = smashOwned(s.owned, id);
        const c = this.add.container(0, 0);
    this.body.add(c);
    c.add(this.card(x, y, w, h, { line: has ? def.color : 0x2c3d66, glow: has ? 0.3 : 0.1, rarity: it?.rarity }));
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
    // (21-11-2026) el botón de abajo es VER (EN ACCIÓN): dentro se compra o se usa. Lo legendario que no tienes: botones de siempre
    const canView = has || (!!it && it.rarity !== 'legendaria');
    if (!has && it) c.add(canView ? [] : this.clpTag(sx, y + h - 22, bw, it.clp));
    if (canView) c.add(this.viewButton(sx, by, bw, () => this.openPreviewOf('smash', id, it)));
    else if (it) c.add(this.priceButton(sx, by, bw, it.price, s.level < it.minLevel || s.gems < it.price, this.tap(() => this.confirmBuy(it))));
  }

  /**
   * Tarjeta de un ESTILO DE ZONA (domain/zoneSkins.ts): un rostro con su aura y el rayo de los ojos, nombre y botón. La Eléctrica es de todos (USAR /
   * EN USO); la de FUEGO (épica) se VE en acción y se compra dentro; la SOMBRA (legendaria) no se muestra: precio en CLP / USAR / EN USO.
   */
  private zoneCard(x: number, y: number, w: number, h: number, zid: ZoneSkinId, it?: ShopItem) {
    const s = getPlayer();
    const def = ZONE_SKINS[zid];
    const has = zoneSkinOwned(s, zid);
        const c = this.add.container(0, 0);
    this.body.add(c);
    c.add(this.card(x, y, w, h, { line: has ? def.col : 0x2c3d66, glow: has ? 0.3 : 0.1, rarity: it?.rarity }));
    const sx = x + w / 2;
    // dibujo: cabeza con el aura del color de la zona y el rayo de los ojos (la Sombra, con humo negro)
    const ic = this.add.graphics({ x: sx, y: y + 70 });
    if (def.smoke) for (let k = 0; k < 7; k++) ic.fillStyle(k % 2 ? 0x1a0c2e : 0x0a0612, 0.7).fillCircle(Math.cos(k * 0.9) * 30, Math.sin(k * 1.3) * 22 + 6, 14 + (k % 3) * 3);
    // el aura solo en los estilos que se venden (la Zona por defecto es solo el rayo de los ojos)
    if (!def.noAura) {
      ic.fillStyle(def.col, 0.18).fillCircle(0, 0, 48);
      ic.fillStyle(def.col, 0.3).fillCircle(0, 0, 38);
      for (let k = 0; k < 6; k++) {
        const a = -Math.PI / 2 + (k - 2.5) * 0.42;
        ic.lineStyle(4, k % 2 ? def.hot : def.col, 0.9).lineBetween(Math.cos(a) * 30, Math.sin(a) * 30, Math.cos(a) * 46, Math.sin(a) * 46);
      }
    }
    ic.fillStyle(0x0a1638, 1).fillCircle(0, 4, 26);
    ic.fillStyle(0x16244a, 1).fillCircle(0, 4, 22);
    ic.lineStyle(9, def.col, 0.45).lineBetween(-8, 0, -46, -10);
    ic.lineStyle(3.5, def.hot, 1).lineBetween(-8, 0, -46, -10);
    ic.fillStyle(def.hot, 1).fillCircle(-8, 0, 4.5).fillCircle(8, 0, 4.5);
    c.add(ic);
    c.add(this.add.text(sx, y + 140, def.name.toUpperCase(), { fontFamily: FONT, fontSize: '24px', color: '#' + def.hot.toString(16).padStart(6, '0') }).setOrigin(0.5));
    c.add(this.add.text(sx, y + 164, has ? (it ? 'COMPRADO' : 'INCLUIDO') : def.desc, { fontFamily: FONT, fontSize: '13px', color: has ? '#9fe8a0' : '#9fb4e0', align: 'center', wordWrap: { width: w - 16 } }).setOrigin(0.5, 0));
    const by = y + h - 64;
    const bw = w - 24;
    // (21-11-2026) lo que ya es tuyo también se VE (dentro se usa): sin botón USAR en la tarjeta
    const canView = has || (!!it && it.rarity !== 'legendaria');
    if (!has && it) c.add(canView ? [] : this.clpTag(sx, y + h - 22, bw, it.clp));
    if (canView) c.add(this.viewButton(sx, by, bw, () => this.openPreviewOf('zone', zid, it)));
    else if (it) c.add(arcadeButton(this, sx, by, bw, 48, clpLabel(it.clp), this.tap(() => this.toast(s.level < it.minLevel ? `Necesitas nivel ${it.minLevel}` : 'El pago con dinero real (CLP) llega pronto')), { palette: 'green', disabled: s.level < it.minLevel }));
  }

  /** Tarjeta de un poder del DEFENSIVO: su icono, nombre, descripción y botón (precio / USAR / EN USO). */
  private defensiveCard(x: number, y: number, w: number, h: number, it: ShopItem) {
    const s = getPlayer();
    const id = it.id.split(':')[1] as DefensivePower;
    const def = defensivePowerDef(id);
    const has = defensiveOwned(s.owned, id);
        const c = this.add.container(0, 0);
    this.body.add(c);
    c.add(this.card(x, y, w, h, { line: has ? def.color : 0x2c3d66, glow: has ? 0.3 : 0.1, rarity: it?.rarity }));
    const sx = x + w / 2;
    const ic = this.add.graphics({ x: sx, y: y + 66 });
    drawDisc(ic, 36, def.color, 0x1b3a6b);
    drawDefensiveIcon(ic, id, 36);
    c.add(ic);
    c.add(this.add.text(sx, y + 128, def.name, { fontFamily: FONT, fontSize: '24px', color: def.css }).setOrigin(0.5));
    c.add(this.add.text(sx, y + 154, has ? 'COMPRADO' : def.desc, { fontFamily: FONT, fontSize: '13px', color: has ? '#9fe8a0' : '#9fb4e0', align: 'center', wordWrap: { width: w - 16 } }).setOrigin(0.5, 0));
    const by = y + h - 64;
    const bw = w - 24;
    // (16-11-2026) el botón de abajo es VER (EN ACCIÓN): dentro se compra o se usa. Lo legendario: botones de siempre
    // (21-11-2026) lo que ya es tuyo también se VE (dentro se usa): sin botón USAR en la tarjeta
    const canView = has || it.rarity !== 'legendaria';
    if (!has) c.add(canView ? [] : this.clpTag(sx, y + h - 22, bw, it.clp));
    if (canView) c.add(this.viewButton(sx, by, bw, () => this.openPreview(it)));
    else c.add(this.priceButton(sx, by, bw, it.price, s.level < it.minLevel || s.gems < it.price, this.tap(() => this.confirmBuy(it))));
  }

  /** Tarjeta de un efecto de CARGA: el aro animado, nombre, descripción y botón (precio / USAR / EN USO / DE TU PERSONAJE). */
  private chargeCard(x: number, y: number, w: number, h: number, it: ShopItem) {
    const s = getPlayer();
    const id = it.id.split(':')[1] as ChargeFxId;
    const def = chargeFxDef(id);
    const skin = s.equipped.skin;
    const has = chargeFxOwned(s.owned, id, skin);
    const bought = s.owned.includes(it.id);
        const c = this.add.container(0, 0);
    this.body.add(c);
    c.add(this.card(x, y, w, h, { line: has ? def.color : 0x2c3d66, glow: has ? 0.3 : 0.1, rarity: it?.rarity }));
    const sx = x + w / 2;
    c.add(chargePreview(this, id, sx, y + 128, Math.min(w - 10, 170)));
    c.add(this.add.text(sx, y + 166, def.name, { fontFamily: FONT, fontSize: '24px', color: def.css }).setOrigin(0.5));
    c.add(this.add.text(sx, y + 190, has && !bought ? 'DE TU PERSONAJE' : has ? 'COMPRADO' : def.desc, { fontFamily: FONT, fontSize: '13px', color: has ? '#9fe8a0' : '#9fb4e0', align: 'center', wordWrap: { width: w - 16 } }).setOrigin(0.5, 0));
    const by = y + h - 64;
    const bw = w - 24;
    // (21-11-2026) el botón de abajo es VER (EN ACCIÓN): dentro se compra o se usa. Lo legendario que no tienes: botones de siempre
    const canView = has || it.rarity !== 'legendaria';
    if (!has) c.add(canView ? [] : this.clpTag(sx, y + h - 22, bw, it.clp));
    if (canView) c.add(this.viewButton(sx, by, bw, () => this.openPreview(it)));
    else if (it.realMoneyOnly) {
      c.add(arcadeButton(this, sx, by, bw, 48, clpLabel(it.clp), this.tap(() => this.toast('El pago con dinero real (CLP) llega pronto')), { palette: 'green' }));
    } else c.add(this.priceButton(sx, by, bw, it.price, s.level < it.minLevel || s.gems < it.price, this.tap(() => this.confirmBuy(it))));
  }

  /** Precio en dinero real (CLP) bajo el botón. Aún no hay pasarela de pago: avisa al tocarlo. */
  private clpTag(x: number, y: number, w: number, clp: number) {
    const c = this.add.container(x, y);
    const g = bakeGraphics(this, `${SHOP_BAKE}clp-${w.toFixed(1)}`, { x0: -w / 2 - 4, y0: -18, w: w + 8, h: 36 }, 2, (b) => {
      b.fillStyle(0x0a1638, 0.9).fillRoundedRect(-w / 2, -14, w, 28, 14);
      b.lineStyle(2, 0x3fae5a, 0.9).strokeRoundedRect(-w / 2, -14, w, 28, 14);
    });
    const t = this.add.text(0, 0, `o ${clpLabel(clp)}`, { fontFamily: FONT, fontSize: '14px', color: '#9fe8a0' }).setOrigin(0.5);
    fitText(t, w - 10);
    c.add([g, t]);
    c.setSize(w, 32).setInteractive({ useHandCursor: true });
    c.on('pointerup', this.tap(() => this.toast('El pago con dinero real (CLP) llega pronto')));
    return c;
  }

  /**
   * Paquete de DINERO virtual que se compra con CLP (pendiente de la pasarela de pago), al estilo de la tienda de gemas de
   * Brawl Stars: tarjeta verde con un montón de billetes que crece con el paquete (`i` = 0 el más chico), la cantidad
   * arriba a la derecha, el precio abajo y, si tiene, la cinta POPULAR / MEJOR VALOR.
   */
  private cashPackCard(x: number, y: number, w: number, h: number, p: CashPack, i: number) {
    const c = this.add.container(0, 0);
    this.body.add(c);
    const r = 14;
    const barH = Math.round(h * 0.22);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.35).fillRoundedRect(x + 3, y + 5, w, h, r);
    g.fillStyle(0x0a1638, 1).fillRoundedRect(x - 3, y - 3, w + 6, h + 6, r + 2);
    g.fillStyle(0x3fae2a, 1).fillRoundedRect(x, y, w, h, r);
    g.fillStyle(0x6ad13a, 1).fillRoundedRect(x, y, w, h - barH, { tl: r, tr: r, bl: 0, br: 0 });
    g.fillStyle(0x92e85e, 1).fillRoundedRect(x + 4, y + 4, w - 8, (h - barH) * 0.4, { tl: r - 3, tr: r - 3, bl: 6, br: 6 });
    // barra del precio
    g.fillStyle(0x26335e, 1).fillRoundedRect(x, y + h - barH, w, barH, { tl: 0, tr: 0, bl: r, br: r });
    g.fillStyle(0x34457a, 1).fillRect(x, y + h - barH, w, barH * 0.4);
    c.add(g);

    // montón de billetes: más billetes y más grande en cada paquete
    // filas de abajo hacia arriba (pirámide)
    const layers = [[1], [2], [2, 1], [3, 2], [4, 3], [4, 3, 2]][Math.min(i, 5)];
    const k = 1 + Math.min(i, 5) * 0.12;
    const midX = x + w * 0.44;
    const baseY = y + (h - barH) * 0.72;
    const pile = this.add.container(0, 0);
    layers.forEach((n, row) => {
      for (let j = 0; j < n; j++) pile.add(this.cashIcon(midX + (j - (n - 1) / 2) * 26 * k, baseY - row * 15 * k + (j % 2) * 3, 40 * k));
    });
    c.add(pile);

    // cantidad arriba a la derecha
    const amount = this.add.text(x + w - 10, y + 8, p.cash.toLocaleString('es-CL'), { fontFamily: FONT, fontSize: '30px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 6 }).setOrigin(1, 0);
    fitText(amount, w * 0.6);
    c.add(amount);
    // precio
    const price = this.add.text(x + w / 2, y + h - barH / 2, clpLabel(p.clp), { fontFamily: FONT, fontSize: '20px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 4 }).setOrigin(0.5);
    fitText(price, w - 14);
    c.add(price);
    // cinta POPULAR / MEJOR VALOR sobre la barra del precio
    if (p.tag) {
      const ry = y + h - barH - 13;
      const rb = this.add.graphics();
      rb.fillStyle(0x8a1020, 1).fillRect(x, ry - 12, w, 24);
      rb.fillStyle(0xe8323f, 1).fillRect(x, ry - 12, w, 20);
      c.add(rb);
      const rt = this.add.text(x + w / 2, ry - 2, p.tag === 'best' ? 'MEJOR VALOR' : 'POPULAR', { fontFamily: FONT, fontSize: '14px', color: '#ffffff', stroke: '#5a0a12', strokeThickness: 3 }).setOrigin(0.5).setLetterSpacing(1);
      fitText(rt, w - 10);
      c.add(rt);
    }
    const hit = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
    hit.on('pointerup', this.tap(() => this.toast('El pago con dinero real (CLP) llega pronto')));
    c.add(hit);
  }

  /** Pelota que cruza la tarjeta dejando la estela del efecto (fx/ballTrailFx.ts: cinta, partículas y chispas del Oro). Se repite sola. */
  private trailPreview(c: Phaser.GameObjects.Container, cx: number, cy: number, span: number, id: StyleId) {
    // solo se anima mientras se ve: la tarjeta visible, su fila visible y dentro de la pantalla a lo ancho (la fila se desliza)
    const onScreen = () => {
      if (!c.visible) return false;
      const par = c.parentContainer;
      if (par && !par.visible) return false;
      const wx = (par?.x ?? 0) + cx;
      return wx > -span && wx < this.scale.width + span;
    };
    const pv = createTrailPreview(this, cx, cy, span, styleLook(id), 1, onScreen, 33); // 30 fps: hay varias a la vez
    c.add(pv.objects);
    this.cardTweens.push(pv.tween);
    c.once(Phaser.GameObjects.Events.DESTROY, () => pv.tween.remove());
  }

  // ================================================================ ver en acción
  /** Botón VER (abajo de la tarjeta, en el sitio de USAR / precio): abre la pantalla EN ACCIÓN. */
  private viewButton(x: number, y: number, w: number, onClick: () => void) {
    // (21-11-2026) sin el triángulo de "play": solo el texto VER
    return arcadeButton(this, x, y, w, 48, 'VER', this.tap(onClick), { palette: 'blue' });
  }

  // (16-11-2026, usuario) sin precio bajo el botón VER: el precio se ve al entrar (VER EN ACCIÓN). Se quitó priceTag.

  /** (16-11-2026, usuario) icono de DINERO: la imagen del billete (assets/dinero-virtual-1.webp) de `size` px; si no cargó, el dibujo de siempre. */
  private cashIcon(x: number, y: number, size: number, amount = 1): Phaser.GameObjects.Image | Phaser.GameObjects.Graphics {
    // (usuario 16-11-2026) un PRECIO de más de 1 lleva el fardo chico (dinero-fardo-chico.webp, de dinero-virtual-2)
    const key = amount > 1 && this.textures.exists('cash-pack') ? 'cash-pack' : 'cash-1';
    if (this.textures.exists(key)) return this.add.image(x, y, key).setDisplaySize(size, size);
    const g = this.add.graphics({ x, y });
    drawCashIcon(g, size / 40);
    return g;
  }

  /**
   * VER EN ACCIÓN (16-11-2026): la pantalla "EN ACCIÓN" de PERSONALIZAR con el artículo de la Tienda (efecto de pelota o defensivo), sin lista ni
   * equipar: solo COMPRAR con dinero virtual o con dinero real. Lo legendario no tiene botón VER.
   */
  private openPreview(it: ShopItem) {
    this.openPreviewOf(it.kind, it.id.split(':')[1], it);
  }

  /**
   * EN ACCIÓN de cualquier artículo (21-11-2026: también ULTI, ESPECIAL y CARGANDO GOLPE, y lo que ya es tuyo). `it` falta en lo que viene de serie
   * (SMASH de fuego, Zona eléctrica): siempre es tuyo. Dentro: COMPRAR (virtual / real) si no lo tienes; si ya es tuyo, solo se ve (la Tienda no equipa: eso es en PERSONALIZAR).
   */
  private openPreviewOf(kind: ItemKind | 'zone', id: string, it?: ShopItem) {
    const s = getPlayer();
    const skin = s.equipped.skin;
    type P = { kindLabel: string; name: string; desc: string; color: number; demo: Parameters<typeof openShopPreview>[1]['demo']; owned: boolean };
    let p: P;
    if (kind === 'zone') {
      const zd = ZONE_SKINS[id as ZoneSkinId];
      p = { kindLabel: 'ZONA', name: it?.name ?? zd.name, desc: zd.desc, color: zd.col, demo: (pa, o, i) => createZoneDemo(this, pa, o, i, skin, zd), owned: zoneSkinOwned(s, zd.id) };
    } else if (kind === 'style') {
      const look = styleLook(id as StyleId);
      p = { kindLabel: 'EFECTO DE PELOTA', name: it?.name ?? id, desc: look.perk, color: look.color, demo: (pa, o, i) => createStyleDemo(this, pa, o, i, skin, look), owned: owns(s, `style:${id}` as ItemId) };
    } else if (kind === 'inferno') {
      const d = infernoPowerDef(id as InfernoPower);
      p = { kindLabel: 'ULTI', name: d.ball, desc: d.desc, color: d.color, demo: (pa, o, i) => createSpecialDemo(this, pa, o, i, skin, 'inferno', id), owned: owns(s, `inferno:${id}` as ItemId) };
    } else if (kind === 'smash') {
      const d = smashPowerDef(id as SmashPower);
      p = { kindLabel: 'ESPECIAL', name: d.name, desc: d.desc, color: d.color, demo: (pa, o, i) => createSpecialDemo(this, pa, o, i, skin, 'smash', id), owned: smashOwned(s.owned, id as SmashPower) };
    } else if (kind === 'charge') {
      const d = chargeFxDef(id as ChargeFxId);
      p = { kindLabel: 'CARGANDO GOLPE', name: d.name, desc: d.desc, color: d.color, demo: (pa, o, i) => createSpecialDemo(this, pa, o, i, skin, 'charge', id), owned: chargeFxOwned(s.owned, id as ChargeFxId, skin) };
    } else {
      const d = defensivePowerDef(id as DefensivePower);
      p = { kindLabel: 'DEFENSIVO', name: it?.name ?? d.name, desc: d.desc, color: d.color, demo: (pa, o, i) => createDefensiveDemo(this, pa, o, i, skin, id as DefensivePower), owned: defensiveOwned(s.owned, id as DefensivePower) };
    }
    const root = openShopPreview(this, {
      kindLabel: p.kindLabel,
      name: p.name,
      desc: p.desc,
      color: p.color,
      rarity: it?.rarity,
      demo: p.demo,
      owned: p.owned,
      price: !it || it.realMoneyOnly || !it.available ? null : it.price,
      priceDim: !it || s.level < it.minLevel || s.gems < it.price,
      clp: it?.clp ?? 0,
      onBuyCash: () => it && this.confirmBuy(it),
      onBuyReal: () => this.toast(it && s.level < it.minLevel ? `Necesitas nivel ${it.minLevel}` : 'El pago con dinero real (CLP) llega pronto'),
    });
    // (17-11-2026) mientras la demostración está abierta, la Tienda de atrás no se dibuja: la demostración usa los efectos del partido
    // (pelota, humo, sombras, cinemática) y, con ~40 tarjetas debajo, el móvil se pegaba. El velo oscuro apenas la dejaba ver.
    const resume = this.freezeShop();
    root.once(Phaser.GameObjects.Events.DESTROY, () => {
      resume();
      if (!this.sys.isActive() || !this.body.scene) return;
      this.body.setVisible(true);
      this.setScroll(this.scrollY); // devuelve la flecha GRATIS a su estado
    });
  }

  /**
   * Congela la Tienda mientras se ve una demostración (VER): no se dibuja y se PAUSAN todas sus animaciones (tweens de tarjetas, destellos,
   * estelas, brillos) y sus relojes (cuenta atrás, regalo), para que la demostración tenga todo el procesador. Los tweens de la demostración
   * no se tocan (se crean después). Devuelve la función que lo deja todo como estaba.
   */
  private freezeShop() {
    this.body.setVisible(false);
    this.freeArrow?.setVisible(false);
    // objetos de la Tienda (contenido y flecha) para reconocer sus tweens
    const mine = new Set<unknown>();
    const walk = (o: Phaser.GameObjects.GameObject) => {
      mine.add(o);
      (o as Phaser.GameObjects.Container).list?.forEach(walk);
    };
    walk(this.body);
    if (this.freeArrow) walk(this.freeArrow);
    const paused: Phaser.Tweens.Tween[] = [];
    for (const tw of this.tweens.getTweens()) {
      if (tw.isPaused()) continue;
      if (this.cardTweens.includes(tw) || tw.targets.some((t) => mine.has(t))) {
        tw.pause();
        paused.push(tw);
      }
    }
    const timers = [this.rotTimer, this.giftTimer].filter((t): t is Phaser.Time.TimerEvent => !!t && !t.paused);
    timers.forEach((t) => (t.paused = true));
    return () => {
      for (const tw of paused) if (!tw.isDestroyed()) tw.resume();
      for (const t of timers) t.paused = false;
    };
  }
  // ================================================================ compra
  private confirmBuy(it: ShopItem) {
    const s = getPlayer();
    if (it.realMoneyOnly) return this.toast('Solo con dinero real (CLP): llega pronto');
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
    const coin = this.cashIcon(-46, -ph / 2 + 158, 40, it.price);
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
    const res = commit((s) => purchaseOffered(s, id));
    if (!res.ok) {
      if (res.error === 'not_in_shop') this.build(); // la selección cambió mientras tanto: se dibuja la nueva
      return this.toast(ERRORS[res.error] ?? 'No se pudo comprar');
    }
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
  /** Saldo en la cabecera: solo el dinero (billetes), que es con lo que se compra en la Tienda. */
  private cashPill(right: number, y: number) {
    const c = this.add.container(0, y);
    const bg = this.add.graphics();
    const cash = this.cashIcon(0, 0, 34);
    this.cashText = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '24px', color: '#ffffff' }).setOrigin(1, 0.5);
    c.add([bg, cash, this.cashText]);
    const layout = () => {
      bg.clear();
      const w = this.cashText.width + 66;
      bg.fillStyle(0x000000, 0.35).fillRoundedRect(right - w + 3, -22 + 4, w, 44, 22);
      bg.fillStyle(0x0a1638, 0.95).fillRoundedRect(right - w, -22, w, 44, 22).lineStyle(2.5, 0x2b7a40, 1).strokeRoundedRect(right - w, -22, w, 44, 22);
      cash.setPosition(right - w + 26, 0);
      this.cashText.setX(right - 14);
    };
    this.data.set('cashLayout', layout);
    this.refreshCash();
  }

  private refreshCash() {
    if (!this.cashText?.active) return;
    this.cashText.setText(getPlayer().gems.toLocaleString('es-CL'));
    (this.data.get('cashLayout') as () => void)?.();
  }

  /** Icono (i) tocable: abre la explicación de la sección. */
  private infoButton(x: number, y: number, info: Info) {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.35).fillCircle(2, 3, 16);
    g.fillStyle(NEON, 1).fillCircle(0, 0, 16);
    g.lineStyle(2.5, 0xffffff, 0.9).strokeCircle(0, 0, 16);
    const t = this.add.text(0, 1, 'i', { fontFamily: FONT, fontSize: '22px', color: '#ffffff' }).setOrigin(0.5);
    c.add([g, t]);
    // zona táctil más grande que el dibujo (dedo)
    c.setSize(48, 48).setInteractive({ useHandCursor: true });
    c.on('pointerup', this.tap(() => {
      this.tweens.add({ targets: c, scale: { from: 0.85, to: 1 }, duration: 180, ease: 'Back.easeOut' });
      this.infoDialog(info);
    }));
    return c;
  }

  /** Diálogo con la explicación de una sección; se cierra con ENTENDIDO o tocando fuera. */
  private infoDialog(info: Info) {
    if (this.modal.length) return;
    const W = this.scale.width;
    const H = this.scale.height;
    const close = () => {
      this.modal.forEach((o) => o.destroy());
      this.modal = [];
    };
    const shade = this.add.rectangle(0, 0, W, H, 0x02060f, 0.72).setOrigin(0).setDepth(8000).setInteractive();
    shade.on('pointerdown', close);
    const pw = Math.min(600, W - 60);
    const body = this.add.text(0, 0, info.text, { fontFamily: FONT, fontSize: '21px', color: '#dbe5ff', align: 'center', lineSpacing: 6, wordWrap: { width: pw - 70 } }).setOrigin(0.5, 0);
    const ph = 104 + body.height + 128;
    const panel = this.add.container(W / 2, H / 2).setDepth(8001);
    panel.add(this.add.rectangle(0, 0, pw, ph, 0x000000, 0.001).setInteractive());
    panel.add(this.card(-pw / 2, -ph / 2, pw, ph, { line: NEON, glow: 0.3, r: 24 }));
    const title = this.add.text(0, -ph / 2 + 52, info.title, { fontFamily: FONT, fontSize: '32px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 6 }).setOrigin(0.5).setLetterSpacing(2);
    fitText(title, pw - 40);
    panel.add(title);
    body.setPosition(0, -ph / 2 + 100);
    panel.add(body);
    panel.add(arcadeButton(this, 0, ph / 2 - 62, Math.min(300, pw - 80), 76, 'ENTENDIDO', close, { palette: 'yellow' }));
    panel.setScale(0.85).setAlpha(0);
    this.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
    this.modal = [shade, panel];
  }

  /**
   * Fondo de tarjeta de PODER ULTI: degradado morado con brillo (sin borde). El degradado y el reflejo superior
   * se pintan una vez en un canvas (por tamaño); encima pasa cada tanto un destello diagonal recortado a la tarjeta.
   */
  private ultiCardBg(c: Phaser.GameObjects.Container, x: number, y: number, w: number, h: number) {
    const r = 20;
    const cw = Math.round(w);
    const key = `shop-ulti-bg-${cw}x${h}`;
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.35).fillRoundedRect(x + 3, y + 5, w, h, r);
    c.add(shadow);
    if (!this.textures.exists(key)) {
      const tex = this.textures.createCanvas(key, cw, h);
      if (tex) {
        const ctx = tex.getContext();
        const path = () => {
          ctx.beginPath();
          ctx.moveTo(r, 0);
          ctx.arcTo(cw, 0, cw, h, r);
          ctx.arcTo(cw, h, 0, h, r);
          ctx.arcTo(0, h, 0, 0, r);
          ctx.arcTo(0, 0, cw, 0, r);
          ctx.closePath();
        };
        path();
        const lin = ctx.createLinearGradient(0, 0, cw * 0.35, h);
        lin.addColorStop(0, ULTI_TOP);
        lin.addColorStop(0.5, ULTI_MID);
        lin.addColorStop(1, ULTI_BOT);
        ctx.fillStyle = lin;
        ctx.fill();
        ctx.save();
        path();
        ctx.clip();
        // halo claro tras la bola
        const rad = ctx.createRadialGradient(cw / 2, 78, 4, cw / 2, 78, Math.max(cw, 150) * 0.75);
        rad.addColorStop(0, 'rgba(214,170,255,0.55)');
        rad.addColorStop(1, 'rgba(214,170,255,0)');
        ctx.fillStyle = rad;
        ctx.fillRect(0, 0, cw, h);
        // reflejo superior (brillo "de vidrio")
        const gloss = ctx.createLinearGradient(0, 0, 0, h * 0.45);
        gloss.addColorStop(0, 'rgba(255,255,255,0.22)');
        gloss.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gloss;
        ctx.fillRect(0, 0, cw, h * 0.45);
        ctx.restore();
        tex.refresh();
      }
    }
    if (this.textures.exists(key)) c.add(this.add.image(x, y, key).setOrigin(0).setDisplaySize(w, h));
    else c.add(this.add.graphics().fillStyle(0x5a22b8, 1).fillRoundedRect(x, y, w, h, r));

    // destello diagonal que cruza la tarjeta (recortado al contorno redondeado)
    const shape = roundedPoly(x, y, w, h, r);
    const shine = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    c.add(shine);
    const st = { t: 0 };
    const band = 34;
    const slant = h * 0.45;
    const tw = this.tweens.add({
      targets: st,
      t: { from: 0, to: 1 },
      duration: 1100,
      delay: Phaser.Math.Between(300, 1800),
      repeat: -1,
      repeatDelay: 2600,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        if (!shine.active) {
          tw.remove();
          return;
        }
        if (!c.visible) return; // fuera de pantalla: no se redibuja
        shine.clear();
        const bx = x - band - slant + st.t * (w + band + slant * 2);
        const quad = [
          { x: bx, y: y + h },
          { x: bx + band, y: y + h },
          { x: bx + band + slant, y },
          { x: bx + slant, y },
        ];
        const pts = clipConvex(quad, shape);
        if (pts.length >= 3) shine.fillStyle(0xffffff, 0.2).fillPoints(pts, true);
      },
    });
    this.cardTweens.push(tw);
    // chispas que titilan sobre la tarjeta
    for (let i = 0; i < 3; i++) {
      const sp = this.add
        .star(x + Phaser.Math.Between(16, Math.max(17, w - 16)), y + Phaser.Math.Between(16, 130), 4, 1.5, 6, 0xf3e6ff, 1)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0);
      c.add(sp);
      this.tweens.add({ targets: sp, alpha: { from: 0, to: 0.9 }, angle: 90, duration: 700, delay: Phaser.Math.Between(0, 2400), yoyo: true, repeat: -1, repeatDelay: Phaser.Math.Between(900, 2200) });
    }
  }

  private priceButton(x: number, y: number, w: number, price: number, dim: boolean, onClick: () => void) {
    const c = this.add.container(x, y);
    const h = 48;
    const g = bakeGraphics(this, `${SHOP_BAKE}price-${w.toFixed(1)}-${dim ? 1 : 0}`, { x0: -w / 2 - 6, y0: -h / 2 - 6, w: w + 12, h: h + 12 }, 2, (b) => {
      b.fillStyle(0x0a1638, 1).fillRoundedRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6, 16);
      b.fillStyle(dim ? 0x5a4a20 : 0xf29a0c, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 14);
      b.fillStyle(dim ? 0x6e5c2a : 0xffcc1f, 1).fillRoundedRect(-w / 2, -h / 2, w, h * 0.62, { tl: 14, tr: 14, bl: 6, br: 6 });
      b.fillStyle(0xffffff, dim ? 0.08 : 0.3).fillRoundedRect(-w / 2 + 8, -h / 2 + 4, w - 16, 8, 4);
    });
    const icon = this.cashIcon(-26, 0, 30, price); // la Tienda cobra DINERO
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
    const g = bakeGraphics(this, `${SHOP_BAKE}pill-${w.toFixed(1)}-${color}`, { x0: -w / 2 - 6, y0: -30, w: w + 12, h: 66 }, 2, (b) => {
      b.fillStyle(0x0a1638, 1).fillRoundedRect(-w / 2 - 3, -24 - 3, w + 6, 54, 16);
      b.fillStyle(color, 1).fillRoundedRect(-w / 2, -24, w, 48, 14);
    });
    c.add(g);
    const t = this.add.text(0, 0, label, { fontFamily: FONT, fontSize: '19px', color: textColor }).setOrigin(0.5).setLetterSpacing(1);
    fitText(t, w - 16);
    c.add(t);
    return c;
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
  private card(x: number, y: number, w: number, h: number, opts: { line?: number; glow?: number; r?: number; rarity?: ItemRarity } = {}) {
    const { line = NEON, glow = 0.18, r = 20, rarity } = opts;
    // (17-11-2026) fondo ESTÁTICO: se pinta una vez en una textura (por tamaño y estilo) y se muestra como imagen. Como Graphics se
    // recorría entero en cada fotograma (≈20 rectángulos redondeados por tarjeta) y la Tienda se pegaba.
    const PAD = 36; // sombra, brillo exterior, gemas y corona asoman por fuera del rectángulo
    const key = `${SHOP_BAKE}card-${w.toFixed(1)}x${h.toFixed(1)}-${line}-${glow}-${r}-${rarity ?? ''}`;
    const img = bakeGraphics(this, key, { x0: -PAD, y0: -PAD, w: w + PAD * 2, h: h + PAD * 2 }, 1.5, (g) => {
      g.fillStyle(0x000000, 0.35).fillRoundedRect(3, 5, w, h, r);
      if (glow && !rarity) g.lineStyle(8, line, glow).strokeRoundedRect(0, 0, w, h, r);
      g.fillStyle(NAVY, 0.94).fillRoundedRect(0, 0, w, h, r);
      g.fillStyle(0x1b2d5c, 0.45).fillRoundedRect(3, 3, w - 6, Math.min(h * 0.45, 40), { tl: r - 3, tr: r - 3, bl: 0, br: 0 });
      if (rarity) {
        // (16-11-2026) con rareza, su marco (con relieve, fondo teñido y gemas) reemplaza al borde de la tarjeta; lo equipado, aro blanco por fuera
        drawRarityFrame(g, 0, 0, w, h, r, rarity, true);
        if (line === 0xffffff) g.lineStyle(3, 0xffffff, 0.95).strokeRoundedRect(-6, -6, w + 12, h + 12, r + 5);
      } else g.lineStyle(3, line, 1).strokeRoundedRect(0, 0, w, h, r);
    });
    return img.setPosition(x - PAD, y - PAD);
  }

  /** Título de sección con su línea a cada lado; con `info`, un (i) a la derecha del texto abre su explicación. */
  private sectionTitle(W: number, y: number, label: string, info?: Info) {
    const t = this.add.text(W / 2, y, label, { fontFamily: FONT, fontSize: '28px', color: '#ffffff' }).setOrigin(0.5).setLetterSpacing(3);
    const iconGap = 12;
    const iconD = 32;
    const extra = info ? iconGap + iconD : 0;
    // texto + icono centrados juntos
    const left = W / 2 - (t.width + extra) / 2;
    t.setX(left + t.width / 2);
    const right = left + t.width + extra;
    const g = this.add.graphics();
    g.lineStyle(2, NEON, 0.7).lineBetween(40, y, left - 18, y).lineBetween(right + 18, y, W - 40, y);
    this.body.add([g, t]);
    if (info) this.body.add(this.infoButton(left + t.width + iconGap + iconD / 2, y, info));
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

type Pt = { x: number; y: number };

/** Contorno de un rectángulo redondeado como polígono convexo (sentido horario en pantalla). */
function roundedPoly(x: number, y: number, w: number, h: number, r: number, seg = 5): Pt[] {
  const pts: Pt[] = [];
  const corner = (cx: number, cy: number, a0: number) => {
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (i / seg) * (Math.PI / 2);
      pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
  };
  corner(x + w - r, y + r, -Math.PI / 2); // arriba-derecha
  corner(x + w - r, y + h - r, 0); // abajo-derecha
  corner(x + r, y + h - r, Math.PI / 2); // abajo-izquierda
  corner(x + r, y + r, Math.PI); // arriba-izquierda
  return pts;
}

/** Recorta el polígono `subject` contra el polígono convexo `clip` (Sutherland–Hodgman). */
function clipConvex(subject: Pt[], clip: Pt[]): Pt[] {
  let out = subject;
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i];
    const b = clip[(i + 1) % clip.length];
    // dentro = a la derecha de a→b en coordenadas de pantalla (y hacia abajo, contorno horario)
    const side = (p: Pt) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    const cut = (p: Pt, q: Pt): Pt => {
      const sp = side(p);
      const t = sp / (sp - side(q));
      return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t };
    };
    const input = out;
    out = [];
    for (let j = 0; j < input.length; j++) {
      const p = input[j];
      const q = input[(j + 1) % input.length];
      const pin = side(p) >= 0;
      const qin = side(q) >= 0;
      if (pin) out.push(p);
      if (pin !== qin) out.push(cut(p, q));
    }
  }
  return out;
}
