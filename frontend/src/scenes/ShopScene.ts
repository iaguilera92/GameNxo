import { isDevMode } from '../domain/devMode';
import { releaseSceneTexturesOnExit } from '../ui/sceneTextures';
import { installTapSound } from '../fx/uiSound';
import Phaser from 'phaser';
import { FONT, restartOnResize, textStyle } from '../ui/theme';
import { UI, stadiumBg } from '../ui/ui';
import { arcadeButton } from '../ui/modeButtons';
import { commit, getPlayer, onPlayerChange } from '../domain/playerStore';
import { REROLL_PRICE, canReroll, offersChangeIn, purchaseOffered, rerollShop, rerolledThisWeek, shopOffers } from '../domain/shopRotation';
import { type SmashPower, smashOwned, smashPowerDef } from '../domain/smashPowers';
import { BUTTON_ART, queueButtonArt } from '../ui/buttonArt';
import { elementTexture } from '../ui/AbilityButton';
import { type DefensivePower, defensiveOwned, defensivePowerDef } from '../domain/defensivePowers';
import { drawDefensiveIcon, drawDisc } from '../ui/icons';
import { BP_SEASON, syncSeason } from '../domain/battlePass';
import { bpSeasonInfo } from '../domain/battlePassConfig';
import { passHeroSkin, passPortrait, queuePassPortraits, rosterPortrait, SOON_PORTRAITS } from '../characters/passPortrait';
import type { PlayerState } from '../domain/player';
import { drawCashIcon } from './BattlePassScene';
import { type ItemId, type ItemKind, type StyleId, owns } from '../domain/player';
import { drawRarityFrame } from '../ui/rarity';
import { bakeGraphics, dropBaked } from '../ui/bakeGraphics';
import { CASH_PACKS, LEGENDARY_EMOTE_CLP, SHOP_ITEMS, clpLabel, type CashPack, type ItemRarity, type ShopItem } from '../domain/shopCatalog';
import { openShopPreview } from '../ui/ShopPreviewDialog';
import { createZoneDemo } from '../fx/zoneDemo';
import { ZONE_SKINS, type ZoneSkinId, zoneSkinOwned } from '../domain/zoneSkins';
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
import { coin2v2Image, coinIcon, drawGiftIcon } from '../ui/wheelArt';
import { EMOTE_ANIM, EMOTE_TEXTURE, ensureEmoteAnims, queueEmoteArt } from '../ui/Emotes';
import { LEGENDARY_EMOTES, type EmoteKind } from '../domain/emotes';
import { shopBlurb } from '../domain/shopBlurbs';

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
const HEADER_H = 106; // (21-11-2026, usuario) antes 112: el contenido sube y queda mas junto al titulo
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
    text: `El DEFENSIVO te ayuda a llegar a pelotas lejanas y se recarga cada ${DASH_COOLDOWN} segundos.\n\nCada poder cambia lo que hace: el DASH (gratis) es un sprint hasta la pelota, el DESTELLO te teletransporta, la SOMBRA cambia tu lugar con un clon, el SUPERSALTO salta hasta ella, la VOLTERETA llega con dos volteretas, el PATINAJE patina dejando un camino de hielo, el RELÁMPAGO (épico) te vuelve un rayo azul neón que deja rayos en el suelo y el TIEMPO LENTO (legendario) frena el tiempo mientras corres y te estira hacia la pelota con la cámara cerca. Todos devuelven asegurado y se recargan igual.\n\nLa Tienda muestra 3 a la vez y cambia la selección cada 12 horas.`,
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
  already_rerolled: 'Ya cambiaste esta sección esta semana (se reinicia el lunes)',
  nothing_to_change: 'Por ahora no hay más ofertas para mostrar aquí',
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
    releaseSceneTexturesOnExit(this); // (25-11-2026) sus imágenes propias se liberan al salir (ui/sceneTextures.ts)
    if (!this.textures.exists('menu-bg')) this.load.image('menu-bg', 'assets/menu-bg.webp');
    if (!this.textures.exists('shop-title')) this.load.image('shop-title', 'assets/tienda-titulo.webp');
    if (!this.textures.exists('cash-1')) this.load.image('cash-1', 'assets/dinero-virtual-1.webp'); // icono de DINERO (16-11-2026)
    if (!this.textures.exists('icon-zona')) this.load.image('icon-zona', 'assets/icon-zona.webp'); // cards de ZONA (recoloreada por estilo)
    if (!this.textures.exists('cash-pack')) this.load.image('cash-pack', 'assets/dinero-fardo-chico.webp'); // precios de más de 1
    // (21-11-2026, usuario) imagen de cada card de DINERO desde la 3.ª: 3.ª = virtual-2, 4.ª y 5.ª = virtual-3, 6.ª = virtual-5
    for (const n of [2, 3, 5]) if (!this.textures.exists(`cash-${n}`)) this.load.image(`cash-${n}`, `assets/dinero-virtual-${n}.webp`);
    // retrato de Mai (premio mayor del Pase, en OFERTAS): ya lo carga BootScene; solo se descarga si falta
    if (!this.textures.exists('oferta-emotes')) this.load.image('oferta-emotes', 'assets/oferta-emotes.webp'); // fondo de la oferta de EMOTES LEGENDARIOS
    queueEmoteArt(this.load); // emotes legendarios animados de esa oferta
    queuePassPortraits(this); // retrato del personaje del Pase (tarjeta del Pase)
    if (!this.textures.exists('shop-pj-card')) this.load.image('shop-pj-card', 'assets/tienda-pj.webp'); // (21-11-2026) marco de las tarjetas de PERSONAJES
    for (const p of Object.values(SOON_PORTRAITS)) if (!this.textures.exists(p.key)) this.load.image(p.key, p.file); // retratos de personajes aún no jugables
    queueInfernoArt(this.load); // bolas de los poderes (vista previa)
    queueChargeFxArt(this.load, ['fire', 'energy', 'hielo', 'light', 'wild', 'glitch', 'tulip', 'shadow', 'luz', 'time']); // aros de carga (vista previa)
    queueButtonArt(this.load); // botón SMASH (vista previa de sus poderes)
    // sonidos del partido que usan las demostraciones EN ACCIÓN (fx/powerDemo.ts): carga, golpe y golpe de la ULTI
    for (const [k, file] of [['cargando', 'mp3/cargando.m4a'], ['inferno-hit', 'mp3/inferno.m4a'], ['golpe-fuerte', 'mp3/golpe-fuerte.m4a']] as const) if (!this.cache.audio.exists(k)) this.load.audio(k, file);
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
    let y = 120; // (21-11-2026, usuario) antes 150: el Pase (y todo lo de abajo) sube, mas junto al titulo
    // cada título lleva su línea; los de estilos y poderes, además, un (i) que abre su explicación (INFO)
    const titleGap = 34; // del título a sus tarjetas (21-11-2026, usuario: antes 44, menos aire bajo el título)

    const ch = 300;
    // ---------------------------------------------------------------- ofertas: el Pase de Batalla, primero y en grande
    // (una sola tarjeta del alto y el ancho de la fila de EFECTO PELOTA)
    // (con el Pase terminado no hay oferta: la sección no sale)
    if (!bpSeasonInfo().over) {
      // (21-11-2026, usuario) sin título OFERTAS: la tarjeta del Pase sube a su lugar
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

    // ---------------------------------------------------------------- personajes (21-11-2026, usuario)
    // los que se pueden comprar, sin el del Pase y sin los que ya tienes (con MODO DESARROLLO sí salen los tuyos, nunca el del Pase)
    const heroes = this.shopCharacters(now);
    if (heroes.length) {
      this.sectionTitle(W, y, 'NUEVOS PERSONAJES', undefined, { kind: 'skin', now: now });
      y += titleGap;
      // tarjetas altas (marco tienda-pj: 961x1451), de a 2 como mucho, centradas
      const hw = Math.min(330, (W - 60 - gap) / 2);
      const hh = (hw * 1451) / 961;
      const hx0 = 30 + (W - 60 - (heroes.length * hw + (heroes.length - 1) * gap)) / 2;
      heroes.forEach((it, i) => {
        this.characterCard(hx0 + i * (hw + gap), y, hw, hh, it);
        this.reg(y, hh);
      });
      y += hh + 52;
    }
    // (21-11-2026, usuario) oferta de EMOTES LEGENDARIOS: arte de fondo y, a la derecha, los emotes que van cambiando
    ensureEmoteAnims(this);
    this.sectionTitle(W, y, 'EMOTES LEGENDARIOS');
    y += titleGap;
    this.emoteOffer(30, y, W - 60, ch);
    this.reg(y, ch);
    y += ch + 52;
    // ---------------------------------------------------------------- cargando golpe (aro al cargar)
    this.sectionTitle(W, y, 'CARGANDO GOLPE', INFO.charge, { kind: 'charge', now });
    y += titleGap;
    const charges = shopOffers('charge', now, getPlayer());
    const cc = cols3(charges.length);
    charges.forEach((it, i) => {
      this.chargeCard(cc.x(i), y, cc.w, ch, it);
      this.reg(y, ch);
    });
    y += ch + 52;

    // ---------------------------------------------------------------- poderes de la ULTI (antes INFERNO)
    this.sectionTitle(W, y, 'PODERES ULTI', INFO.ulti, { kind: 'inferno', now });
    y += titleGap;
    const powers = shopOffers('inferno', now, getPlayer());
    const pc = cols3(powers.length);
    powers.forEach((it, i) => {
      this.powerCard(pc.x(i), y, pc.w, ch, it);
      this.reg(y, ch);
    });
    y += ch + 52;

    // ---------------------------------------------------------------- poderes del ESPECIAL y del DEFENSIVO
    this.sectionTitle(W, y, 'PODERES ESPECIALES', INFO.special, { kind: 'smash', now });
    y += titleGap;
    // 3 a la vez (el FUEGO es gratis y no entra en la rotación: se elige en PERSONALIZAR)
    const smashItems = shopOffers('smash', now, getPlayer());
    const sc = cols3(smashItems.length);
    const smashH = 270;
    smashItems.forEach((it, i) => {
      this.smashCard(sc.x(i), y, sc.w, smashH, it.id.split(':')[1] as SmashPower, it);
      this.reg(y, smashH);
    });
    y += smashH + 52;
    this.sectionTitle(W, y, 'PODERES DEFENSIVOS', INFO.defensive, { kind: 'defensive', now });
    y += titleGap;
    const defs = shopOffers('defensive', now, getPlayer());
    const dc = cols3(defs.length);
    const dh = 270;
    defs.forEach((it, i) => {
      this.defensiveCard(dc.x(i), y, dc.w, dh, it);
      this.reg(y, dh);
    });
    y += dh + 52;
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

    // ---------------------------------------------------------------- ESTILOS DE ZONA (16-11-2026): Eléctrica (de todos), Fuego (épica), Sombra (legendaria)
    // (21-11-2026, usuario) 2 cards que cambian cada SEMANA (domingo), con su contador (domain/shopRotation.ts)
    this.sectionTitle(W, y, 'ZONA', INFO.zone, { kind: 'zone', now });
    y += titleGap;
    const zoneItems = shopOffers('zone', now, getPlayer());
    // (21-11-2026, usuario) las 2 cards ocupan TODO el ancho (el mismo que 3 cards de DEFENSIVO), no 2 tercios centrados
    const zn = Math.max(1, zoneItems.length);
    const zw = (W - 60 - gap * (zn - 1)) / zn;
    const zc = { w: zw, x: (i: number) => 30 + i * (zw + gap) };
    const zh = 270;
    zoneItems.forEach((zit, i) => {
      this.zoneCard(zc.x(i), y, zc.w, zh, zit.id.split(':')[1] as ZoneSkinId, zit);
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
    const packH = Math.round(packW * 1.1); // (21-11-2026, usuario) antes 0.92: más alto de la parte morada para que la imagen no choque con la cantidad (la blanca sigue en 30 %)
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
    return (['skin', 'charge', 'inferno', 'smash', 'defensive', 'zone'] as ItemKind[]).map((k) => shopOffers(k, now, getPlayer()).map((i) => i.id).join(',')).join('|');
  }

  /** ancho de la píldora del contador de ofertas (a la derecha del título de las categorías que rotan) */
  private static readonly ROT_PILL_W = 168;

  /**
   * (18-11-2026, usuario) Contador de las ofertas que rotan: píldora roja con reloj y "04:12:09", a la DERECHA en la misma
   * fila del título (antes "NUEVOS EN …" chico bajo el título: no se veía). Late suave para que se note que se acaban.
   */
  private rotationPill(W: number, y: number, kind: ItemKind, ms: number) {
    const pw = ShopScene.ROT_PILL_W;
    const ph = 38;
    const cx = W - 30 - pw / 2;
    const c = this.add.container(cx, y);
    const glow = this.add.graphics();
    glow.lineStyle(8, 0xff4a3a, 0.3).strokeRoundedRect(-pw / 2 - 2, -ph / 2 - 2, pw + 4, ph + 4, ph / 2 + 2);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.35).fillRoundedRect(-pw / 2 + 2, -ph / 2 + 4, pw, ph, ph / 2);
    g.fillStyle(0x0a1638, 1).fillRoundedRect(-pw / 2 - 3, -ph / 2 - 3, pw + 6, ph + 6, ph / 2 + 3);
    g.fillStyle(0xc4192e, 1).fillRoundedRect(-pw / 2, -ph / 2, pw, ph, ph / 2);
    g.fillStyle(0xffffff, 0.18).fillRoundedRect(-pw / 2 + 8, -ph / 2 + 3, pw - 16, ph * 0.38, ph / 4);
    g.lineStyle(2, 0xff8a7a, 1).strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, ph / 2);
    // reloj
    const ix = -pw / 2 + 22;
    const clock = this.add.graphics({ x: ix, y: 0 });
    clock.fillStyle(0xffffff, 1).fillCircle(0, 0, 11);
    clock.fillStyle(0xc4192e, 1).fillCircle(0, 0, 8);
    clock.lineStyle(2.5, 0xffffff, 1).lineBetween(0, 0, 0, -6).lineBetween(0, 0, 4.5, 2);
    const t = this.add.text(ix + 18, 1, '', { fontFamily: FONT, fontSize: '22px', color: '#ffffff', stroke: '#5a0812', strokeThickness: 4 }).setOrigin(0, 0.5).setLetterSpacing(1);
    c.add([glow, g, clock, t]);
    this.body.add(c);
    this.tweens.add({ targets: glow, alpha: { from: 1, to: 0.25 }, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: clock, scale: { from: 1, to: 1.15 }, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.rotLabels.push({ t, kind });
    this.setRotationText(t, ms);
    // (21-11-2026, usuario) tocar el reloj: CAMBIAR las ofertas de esta categoría pagando dinero (una vez por semana)
    c.setSize(pw, ph).setInteractive({ useHandCursor: true });
    c.on('pointerup', this.tap(() => this.rerollDialog(kind)));
  }

  private setRotationText(t: Phaser.GameObjects.Text, ms: number) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const two = (n: number) => String(n).padStart(2, '0');
    t.setText(`${two(Math.floor(s / 3600))}:${two(Math.floor((s % 3600) / 60))}:${two(s % 60)}`);
    // última hora: en amarillo (se acaban ya)
    t.setColor(s < 3600 ? '#ffe14d' : '#ffffff');
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
    // (21-11-2026, usuario) fondo VERDE con degradado completo, sin bordes; el premio es sorpresa (no se dice cuántas monedas)
    const GIFT = 0x35c85a;
    const gk = `gift-grad-${Math.round(w)}x${Math.round(h)}`;
    if (!this.textures.exists(gk)) {
      const tex = this.textures.createCanvas(gk, Math.round(w), Math.round(h));
      if (tex) {
        const ctx = tex.getContext();
        const bw = Math.round(w);
        const bh = Math.round(h);
        const r = 20;
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.arcTo(bw, 0, bw, bh, r);
        ctx.arcTo(bw, bh, 0, bh, r);
        ctx.arcTo(0, bh, 0, 0, r);
        ctx.arcTo(0, 0, bw, 0, r);
        ctx.closePath();
        const lin = ctx.createLinearGradient(0, 0, bw * 0.3, bh);
        lin.addColorStop(0, '#6fe88a');
        lin.addColorStop(0.5, '#2fae4f');
        lin.addColorStop(1, '#0f5a2a');
        ctx.fillStyle = lin;
        ctx.fill();
        tex.refresh();
      }
    }
    c.add(this.add.image(x + w / 2, y + h / 2, gk).setDisplaySize(w, h));
    const cx = x + w / 2;
    const ic = this.add.graphics({ x: cx, y: y + h * 0.55 }).setScale(1.25);
    drawGiftIcon(ic, 40);
    c.add(ic);
    if (st.available) this.tweens.add({ targets: ic, angle: { from: -6, to: 6 }, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
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
      const dim = this.add.graphics();
      dim.fillStyle(0x02060f, 0.35).fillRoundedRect(x, y, w, h, 20);
      c.add(dim);
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
    const { amount, kind } = res;
    const W = this.scale.width;
    const H = this.scale.height;
    const two = kind === 'coins2v2';
    const t = this.add.text(W / 2, H * 0.45, '+' + amount + (two ? ' MONEDAS 2V2' : ' MONEDAS'), textStyle(44, two ? '#d2b0ff' : '#ffd23f')).setOrigin(0.5).setDepth(9000).setScale(0.4);
    this.tweens.add({ targets: t, scale: 1, duration: 320, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, y: t.y - 40, delay: 1100, duration: 300, onComplete: () => t.destroy() });
    // las monedas salen del premio y se van al monedero (arriba a la derecha); el MEN? las hace llegar a su contador (menu.wheelGain)
    const mk = two ? coin2v2Image : coinIcon;
    const tx = W - 70;
    const ty = 56;
    for (let i = 0; i < 14; i++) {
      const sx = W / 2 + Phaser.Math.Between(-60, 60);
      const sy = H * 0.45 + 40 + Phaser.Math.Between(-20, 20);
      const g = mk(this, sx, sy, 12).setDepth(8999).setVisible(false);
      const arc = Phaser.Math.Between(40, 110);
      const k = { v: 0 };
      this.tweens.add({
        targets: k,
        v: 1,
        delay: 500 + i * 70,
        duration: 750,
        ease: 'Sine.easeInOut',
        onStart: () => g.setVisible(true),
        onUpdate: () => g.setPosition(sx + (tx - sx) * k.v, sy + (ty - sy) * k.v - Math.sin(k.v * Math.PI) * arc),
        onComplete: () => g.destroy(),
      });
    }
    const cur = (this.registry.get('menu.wheelGain') as { coins: number; xp: number; coins2v2?: number } | undefined) ?? { coins: 0, xp: 0 };
    this.registry.set('menu.wheelGain', { coins: cur.coins + (two ? 0 : amount), xp: cur.xp, coins2v2: (cur.coins2v2 ?? 0) + (two ? amount : 0) });
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

    // premio mayor: el personaje del último nivel del Pase (JUN desde el 21-11-2026; antes MAI) a la izquierda, de pie sobre el borde de abajo, con resplandor detrás
    const heroSkin = passHeroSkin();
    const hero = passPortrait(heroSkin) ?? passPortrait('mai')!;
    const box = hero.box; // caja visible de su retrato (characters/passPortrait.ts), la misma de BattlePassScene
    const vh = h - 22;
    const vw = ((box.x1 - box.x0) / (box.y1 - box.y0)) * vh;
    const px = x + 16 + vw / 2;
    const glow = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    glow.fillStyle(0xfff1b8, 0.3).fillEllipse(px, y + h * 0.5, vw * 1.25, vh * 0.95);
    c.add(glow);
    this.tweens.add({ targets: glow, alpha: { from: 0.5, to: 1 }, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    if (this.textures.exists(hero.key)) {
      const img = this.add.image(px, y + h - 6, hero.key);
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
    const who = this.add.text(tx, y + 160, `NUEVO PERSONAJE: ${heroSkin.toUpperCase()}`, { fontFamily: FONT, fontSize: '22px', color: '#ffffff', stroke: dark, strokeThickness: 6 }).setOrigin(0.5);
    fitText(who, colW);
    c.add([title, season, prize, who]);
    const by = y + h - 62;
    if (active && !isDevMode()) c.add(this.pill(tx, by, 170, 'ACTIVO', 0x1f6b35, '#9fe8a0')); // (21-11-2026, usuario) en MODO DESARROLLO se ve el precio del Pase aunque esté activo
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

  /**
   * OFERTA DE EMOTES LEGENDARIOS: el arte oferta-emotes de fondo (recortado a la tarjeta) y, a la derecha, un panel
   * translúcido con el emote legendario animado, su nombre y su precio en dinero real; cambia solo cada pocos segundos.
   */
  private emoteOffer(x: number, y: number, w: number, h: number) {
    const c = this.add.container(0, 0);
    this.body.add(c);
    const pad = 8;
    const iw = w - pad * 2;
    const ih = h - pad * 2;
    const sh = this.add.graphics();
    sh.fillStyle(0x000000, 0.35).fillRoundedRect(x + 3, y + 6, w, h, 14);
    sh.fillStyle(0x8a5a00, 1).fillRoundedRect(x, y, w, h, 14);
    c.add(sh);
    if (this.textures.exists('oferta-emotes')) {
      // recorte "cover" centrado: la imagen llena la tarjeta sin deformarse
      const tex = this.textures.get('oferta-emotes').getSourceImage() as { width: number; height: number };
      const k = Math.max(iw / tex.width, ih / tex.height);
      const cw = iw / k;
      const chh = ih / k;
      const cx = (tex.width - cw) / 2;
      const cy = (tex.height - chh) / 2;
      const img = this.add.image(x + pad - cx * k, y + pad - cy * k, 'oferta-emotes').setOrigin(0, 0).setScale(k).setCrop(cx, cy, cw, chh);
      c.add(img);
    }
    // marco dorado (su borde grueso tapa las esquinas del recorte)
    const fr = this.add.graphics();
    fr.lineStyle(8, 0xffc42e, 1).strokeRoundedRect(x + 4, y + 4, w - 8, h - 8, 6);
    fr.lineStyle(3, 0xfff1b8, 1).strokeRoundedRect(x, y, w, h, 14);
    c.add(fr);

    // panel derecho translúcido
    const pw = Math.min(250, w * 0.36);
    const pxl = x + w - pad - 10 - pw;
    const pt = y + pad + 10;
    const ph = h - pad * 2 - 20;
    const px = pxl + pw / 2;
    const pg = this.add.graphics();
    pg.fillStyle(0x0a1638, 0.62).fillRoundedRect(pxl, pt, pw, ph, 14);
    pg.lineStyle(2, 0xffffff, 0.35).strokeRoundedRect(pxl, pt, pw, ph, 14);
    c.add(pg);
    // lo que cambia (emote, nombre y precio) va en su propio contenedor: sale deslizándose y entra el siguiente
    const slide = this.add.container(0, 0);
    c.add(slide);
    const boxS = Math.min(144, pw - 70);
    const by0 = pt + 18 + boxS / 2;
    const glow = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    glow.fillStyle(0xffd23f, 0.3).fillCircle(px, by0, boxS * 0.75);
    slide.add(glow);
    this.tweens.add({ targets: glow, alpha: { from: 0.4, to: 1 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const bg = this.add.graphics();
    bg.fillStyle(0x1a1030, 0.9).fillRoundedRect(px - boxS / 2, by0 - boxS / 2, boxS, boxS, 18);
    bg.lineStyle(5, 0xffc42e, 1).strokeRoundedRect(px - boxS / 2, by0 - boxS / 2, boxS, boxS, 18);
    slide.add(bg);
    const first = LEGENDARY_EMOTES[0];
    const sp = this.add.sprite(px, by0, EMOTE_TEXTURE[first], EMOTE_ANIM[first]?.still).setDisplaySize(boxS - 12, boxS - 12);
    slide.add(sp);
    // nombre en una barra dorada
    const ny = by0 + boxS / 2 + 28;
    const nb = this.add.graphics();
    nb.fillStyle(0x8a5a00, 1).fillRoundedRect(pxl + 20, ny - 20, pw - 40, 40, 12);
    nb.fillStyle(0xffc42e, 1).fillRoundedRect(pxl + 23, ny - 17, pw - 46, 34, 10);
    nb.fillStyle(0xffe27a, 1).fillRoundedRect(pxl + 23, ny - 17, pw - 46, 15, { tl: 10, tr: 10, bl: 3, br: 3 });
    slide.add(nb);
    const nameT = this.add.text(px, ny, '', { fontFamily: FONT, fontSize: '24px', color: '#ffffff', stroke: '#5a3200', strokeThickness: 5 }).setOrigin(0.5);
    const priceT = this.add.text(px, pt + ph - 26, '', { fontFamily: FONT, fontSize: '28px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 5 }).setOrigin(0.5);
    slide.add([nameT, priceT]);
    // puntos: cuál de los emotes se ve
    const dots = this.add.graphics();
    c.add(dots);

    const NAMES: Partial<Record<EmoteKind, string>> = { shades: 'LENTES', treasure: 'TESORO' };
    let idx = 0;
    const N = LEGENDARY_EMOTES.length;
    const show = (i: number) => {
      idx = ((i % N) + N) % N;
      const k = LEGENDARY_EMOTES[idx];
      const key = EMOTE_TEXTURE[k];
      nameT.setText(NAMES[k] ?? k.toUpperCase());
      fitText(nameT, pw - 56);
      priceT.setText(clpLabel(LEGENDARY_EMOTE_CLP));
      if (this.anims.exists(`${key}-intro`)) {
        sp.setTexture(key).play(`${key}-intro`);
        sp.once('animationcomplete', () => {
          if (sp.active && this.anims.exists(`${key}-loop`) && sp.texture.key === key) sp.play(`${key}-loop`);
        });
      } else sp.setTexture(key, EMOTE_ANIM[k]?.still);
      sp.setDisplaySize(boxS - 12, boxS - 12);
      dots.clear();
      LEGENDARY_EMOTES.forEach((_, j) => {
        dots.fillStyle(j === idx ? 0xffc42e : 0xffffff, j === idx ? 1 : 0.4).fillCircle(px + (j - (LEGENDARY_EMOTES.length - 1) / 2) * 16, pt + ph - 6, 4);
      });
    };
    show(0);
    // cambio con deslizamiento: dir 1 = el actual se va a la derecha y el nuevo entra por la izquierda; -1, al revés
    let busy = false;
    const go = (step: number, dir: 1 | -1) => {
      if (busy || N < 2) return;
      busy = true;
      const off = pw * 0.7;
      this.tweens.add({
        targets: slide,
        x: dir * off,
        alpha: 0,
        duration: 220,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          show(idx + step);
          slide.x = -dir * off;
          this.tweens.add({ targets: slide, x: 0, alpha: 1, duration: 280, ease: 'Cubic.easeOut', onComplete: () => (busy = false) });
        },
      });
    };
    // el cambio de emote: cada 5 s (solo si la tarjeta est? a la vista)
    const timer = this.time.addEvent({ delay: 5000, loop: true, callback: () => { if (c.visible) go(1, 1); } });
    c.once(Phaser.GameObjects.Events.DESTROY, () => timer.remove());

    // toda la tarjeta: el pago con dinero real llega con la pasarela
    const hit = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
    // deslizar la tarjeta a los lados cambia de emote (derecha = siguiente, entra por la izquierda; izquierda = volver)
    const onTap = this.tap(() => {
      const k = LEGENDARY_EMOTES[idx];
      this.toast(owns(getPlayer(), `emote:${k}` as ItemId) ? 'Ya tienes este emote' : 'El pago con dinero real (CLP) llega pronto');
    });
    hit.on('pointerup', (p: Phaser.Input.Pointer) => {
      const dx = p.upX - p.downX;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(p.upY - p.downY)) {
        go(dx > 0 ? 1 : -1, dx > 0 ? 1 : -1);
        timer.elapsed = 0; // el reloj de los 5 s vuelve a empezar
        return;
      }
      onTap();
    });
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
      c.add(this.viewButton(sx, by, bw, () => this.openPreview(it), has));
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
    const legend = it.rarity === 'legendaria'; // (21-11-2026, usuario) la card de una ULTI LEGENDARIA es DORADA y brillante (no morada)
    this.ultiCardBg(c, x, y, w, h, legend);
    const sx = x + w / 2;
    // su bola animada (y su rastro detrás, si lo trae: tulipán)
    c.add(addBallPreview(this, sx, y + 78, power, w - 12, 112, true, def.color));
    c.add(this.add.text(sx, y + 150, def.name, { fontFamily: FONT, fontSize: '24px', color: def.css, stroke: '#1a0640', strokeThickness: 5 }).setOrigin(0.5));
    const desc = this.add.text(sx, y + 178, has ? 'COMPRADO' : shopBlurb('inferno', power, def.desc), { fontFamily: FONT, fontSize: '13px', color: has ? '#9fe8a0' : legend ? '#fff3cf' : '#e2d3ff', align: 'center', wordWrap: { width: w - 16 } }).setOrigin(0.5, 0);
    c.add(desc);
    const by = y + h - 64;
    const bw = w - 24;
    // (21-11-2026) el botón de abajo es VER (EN ACCIÓN): dentro se compra o se usa. Lo legendario que no tienes: botones de siempre
    // (17-11-2026) excepción: la ULTI LEGENDARIA BOLA DE ENERGÍA SÍ se VE (su demostración con las 4 máquinas, fx/powerDemo.ts)
    const canView = has || it.rarity !== 'legendaria' || LEGEND_VIEWABLE.has(it.id);
    if (!has) c.add(canView ? [] : this.clpTag(sx, y + h - 22, bw, it.clp));
    if (canView) c.add(this.viewButton(sx, by, bw, () => this.openPreview(it), has));
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
    c.add(this.add.text(sx, y + 154, has ? (it ? 'COMPRADO' : 'INCLUIDO') : shopBlurb('smash', id, def.desc), { fontFamily: FONT, fontSize: '13px', color: has ? '#9fe8a0' : '#9fb4e0', align: 'center', wordWrap: { width: w - 16 } }).setOrigin(0.5, 0));
    const by = y + h - 64;
    const bw = w - 24;
    // (21-11-2026) el botón de abajo es VER (EN ACCIÓN): dentro se compra o se usa. Lo legendario que no tienes: botones de siempre
    const canView = has || (!!it && it.rarity !== 'legendaria');
    if (!has && it) c.add(canView ? [] : this.clpTag(sx, y + h - 22, bw, it.clp));
    if (canView) c.add(this.viewButton(sx, by, bw, () => this.openPreviewOf('smash', id, it), has));
    else if (it) c.add(this.priceButton(sx, by, bw, it.price, s.level < it.minLevel || s.gems < it.price, this.tap(() => this.confirmBuy(it))));
  }

  /**
   * Tarjeta de un ESTILO DE ZONA (domain/zoneSkins.ts): un rostro con su aura y el rayo de los ojos, nombre y botón. La Eléctrica es de todos (USAR /
   * EN USO); la de FUEGO (épica) se VE en acción y se compra dentro; la SOMBRA (legendaria) no se muestra: precio en CLP / USAR / EN USO.
   */
  /**
   * (18-11-2026) icon-zona (silueta negra con el rayo MORADO en los ojos) recoloreado para un estilo: los píxeles de color (el rayo y su
   * brillo) pasan al color del estilo (su `col`, con el núcleo hacia `hot`), con la misma luz; la silueta negra y el blanco no cambian. Se
   * genera una vez por estilo (textura `icon-zona-<id>`). null si la imagen no cargó.
   */
  private zoneIconTex(zid: ZoneSkinId): string | null {
    if (!this.textures.exists('icon-zona')) return null;
    const key = `icon-zona-${zid}`;
    if (this.textures.exists(key)) return key;
    const src = this.textures.get('icon-zona').getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const cw = src.width;
    const ch = src.height;
    const ct = this.textures.createCanvas(key, cw, ch);
    if (!ct) return 'icon-zona';
    const ctx = ct.getContext();
    ctx.drawImage(src, 0, 0);
    const def = ZONE_SKINS[zid];
    // la Sombra ya es morada: la imagen tal cual
    if (zid !== 'shadow') {
      const id = ctx.getImageData(0, 0, cw, ch);
      const d = id.data;
      const c1 = [(def.col >> 16) & 255, (def.col >> 8) & 255, def.col & 255];
      const c2 = [(def.hot >> 16) & 255, (def.hot >> 8) & 255, def.hot & 255];
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] === 0) continue;
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const mx = Math.max(r, g, b);
        const mn = Math.min(r, g, b);
        if (mx < 40 || mx - mn < 40) continue; // negro / gris / blanco: igual
        const L = mx / 255;
        const wht = mn / mx; // núcleo blanquecino → hacia `hot`
        for (let k = 0; k < 3; k++) d[i + k] = Math.round((c1[k] + (c2[k] - c1[k]) * wht) * L);
      }
      ctx.putImageData(id, 0, 0);
    }
    ct.refresh();
    return key;
  }

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
    // (18-11-2026, usuario) la cabeza es la imagen de la ZONA de PERSONALIZAR (icon-zona) con el rayo de los ojos del color de este estilo
    const tex = this.zoneIconTex(zid);
    if (tex) {
      c.add(ic);
      const img = this.add.image(sx, y + 70, tex);
      c.add(img.setScale(Math.min(112 / img.width, 112 / img.height)));
    } else {
      ic.fillStyle(0x0a1638, 1).fillCircle(0, 4, 26);
      ic.fillStyle(0x16244a, 1).fillCircle(0, 4, 22);
      ic.lineStyle(9, def.col, 0.45).lineBetween(-8, 0, -46, -10);
      ic.lineStyle(3.5, def.hot, 1).lineBetween(-8, 0, -46, -10);
      ic.fillStyle(def.hot, 1).fillCircle(-8, 0, 4.5).fillCircle(8, 0, 4.5);
      c.add(ic);
    }
    c.add(this.add.text(sx, y + 140, def.name.toUpperCase(), { fontFamily: FONT, fontSize: '24px', color: '#' + def.hot.toString(16).padStart(6, '0') }).setOrigin(0.5));
    c.add(this.add.text(sx, y + 164, has ? (it ? 'COMPRADO' : 'INCLUIDO') : shopBlurb('zone', zid, def.desc), { fontFamily: FONT, fontSize: '13px', color: has ? '#9fe8a0' : '#9fb4e0', align: 'center', wordWrap: { width: w - 16 } }).setOrigin(0.5, 0));
    const by = y + h - 64;
    const bw = w - 24;
    // (21-11-2026) lo que ya es tuyo también se VE (dentro se usa): sin botón USAR en la tarjeta
    const canView = has || (!!it && it.rarity !== 'legendaria');
    if (!has && it) c.add(canView ? [] : this.clpTag(sx, y + h - 22, bw, it.clp));
    if (canView) c.add(this.viewButton(sx, by, bw, () => this.openPreviewOf('zone', zid, it), has));
    else if (it) c.add(arcadeButton(this, sx, by, bw, 48, clpLabel(it.clp), this.tap(() => this.toast(s.level < it.minLevel ? `Necesitas nivel ${it.minLevel}` : 'El pago con dinero real (CLP) llega pronto')), { palette: 'green', disabled: s.level < it.minLevel }));
  }

  /** Personajes que la Tienda ofrece ahora (2 cada 24 h): nunca el del Pase; los que ya tienes solo con MODO DESARROLLO. */
  private shopCharacters(now: number): ShopItem[] {
    const s = getPlayer();
    const pass = passHeroSkin();
    return shopOffers('skin', now, s).filter((i) => i.id !== `skin:${pass}` && (isDevMode() || !s.owned.includes(i.id)));
  }
  /**
   * Tarjeta de un personaje con el marco tienda-pj (amarillo arriba con el nombre, azul con el retrato, verde abajo con los precios: dinero virtual a la
   * izquierda, CLP a la derecha). Si ya es tuyo: COMPRADO (con MODO DESARROLLO se ven los dos precios igual).
   */
  private characterCard(x: number, y: number, w: number, h: number, it: ShopItem) {
    const s = getPlayer();
    const skin = it.id.split(':')[1];
    const has = s.owned.includes(it.id);
    const k = w / 961; // px del arte -> pantalla
    const c = this.add.container(0, 0);
    this.body.add(c);
    const cx = x + w / 2;
    if (this.textures.exists('shop-pj-card')) c.add(this.add.image(x, y, 'shop-pj-card').setOrigin(0, 0).setDisplaySize(w, h));
    else c.add(this.card(x, y, w, h, { line: 0x2c3d66, glow: 0.1 }));
    // nombre en la franja amarilla
    const nm = this.add.text(cx, y + 200 * k, it.name.toUpperCase(), { fontFamily: FONT, fontSize: '40px', color: '#ffffff', stroke: '#6a3a00', strokeThickness: 7 }).setOrigin(0.5).setLetterSpacing(2);
    fitText(nm, w * 0.72);
    c.add(nm);
    // retrato en el fondo azul (por su caja visible), con zoom: sube un poco sobre la franja amarilla y se CORTA donde empieza el verde (no lo toca)
    const p = rosterPortrait(skin);
    if (p && this.textures.exists(p.key)) {
      const sc = (900 * k) / (p.box.y1 - p.box.y0);
      const pcx = (p.box.x0 + p.box.x1) / 2;
      const boxTop = y + 330 * k; // arriba de la caja visible: asoma sobre el amarillo
      const iy = boxTop + (p.h / 2 - p.box.y0) * sc; // centro de la imagen entera
      const ix = cx + (p.w / 2 - pcx) * sc;
      const img = this.add.image(ix, iy, p.key).setScale(sc);
      const cutRow = p.h / 2 + (y + 1190 * k - iy) / sc; // fila de la imagen que cae en el borde de abajo del azul
      img.setCrop(0, 0, p.w, Math.min(p.h, cutRow));
      c.add(img);
    }    // franja verde: precios
    const gy = y + 1322 * k;
    if (has && !isDevMode()) {
      c.add(this.add.text(cx, gy, 'COMPRADO', { fontFamily: FONT, fontSize: '26px', color: '#ffffff', stroke: '#0a5a2a', strokeThickness: 5 }).setOrigin(0.5));
      return;
    }
    const halfW = w * 0.44;
    const lx = x + w * 0.27;
    const rxp = x + w * 0.73;
    const cant = s.level < it.minLevel || s.gems < it.price;
    const virt = this.add.container(lx, gy);
    virt.add(this.cashIcon(-halfW / 2 + 14, 0, 34, it.price));
    const vt = this.add.text(-halfW / 2 + 36, 0, it.price.toLocaleString('es-CL'), { fontFamily: FONT, fontSize: '26px', color: cant ? '#c9ffe0' : '#ffffff', stroke: '#0a5a2a', strokeThickness: 5 }).setOrigin(0, 0.5);
    fitText(vt, halfW - 44);
    virt.add(vt);
    virt.setSize(halfW, 56).setInteractive({ useHandCursor: true });
    virt.on('pointerup', this.tap(() => (has ? this.toast('Modo desarrollo: ya lo tienes (solo se muestra el precio)') : this.confirmBuy(it))));
    const clp = this.add.text(rxp, gy, clpLabel(it.clp), { fontFamily: FONT, fontSize: '22px', color: '#000000', stroke: '#8dffb0', strokeThickness: 5 }).setOrigin(0.5);
    fitText(clp, halfW - 8);
    clp.setInteractive({ useHandCursor: true }).on('pointerup', this.tap(() => this.toast('El pago con dinero real (CLP) llega pronto')));
    const div = this.add.graphics();
    div.lineStyle(3, 0x0a5a2a, 0.55).lineBetween(cx, gy - 22 * 1, cx, gy + 22);
    c.add([virt, clp, div]);
  }  /** Tarjeta de un poder del DEFENSIVO: su icono, nombre, descripción y botón (precio / USAR / EN USO). */
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
    c.add(this.add.text(sx, y + 154, has ? 'COMPRADO' : shopBlurb('defensive', id, def.desc), { fontFamily: FONT, fontSize: '13px', color: has ? '#9fe8a0' : '#9fb4e0', align: 'center', wordWrap: { width: w - 16 } }).setOrigin(0.5, 0));
    const by = y + h - 64;
    const bw = w - 24;
    // (16-11-2026) el botón de abajo es VER (EN ACCIÓN): dentro se compra o se usa. Lo legendario: botones de siempre
    // (21-11-2026) lo que ya es tuyo también se VE (dentro se usa): sin botón USAR en la tarjeta
    const canView = has || it.rarity !== 'legendaria';
    if (!has) c.add(canView ? [] : this.clpTag(sx, y + h - 22, bw, it.clp));
    if (canView) c.add(this.viewButton(sx, by, bw, () => this.openPreview(it), has));
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
    c.add(this.add.text(sx, y + 190, has && !bought ? 'DE TU PERSONAJE' : has ? 'COMPRADO' : shopBlurb('charge', id, def.desc), { fontFamily: FONT, fontSize: '13px', color: has ? '#9fe8a0' : '#9fb4e0', align: 'center', wordWrap: { width: w - 16 } }).setOrigin(0.5, 0));
    const by = y + h - 64;
    const bw = w - 24;
    // (21-11-2026) el botón de abajo es VER (EN ACCIÓN): dentro se compra o se usa. Lo legendario que no tienes: botones de siempre
    const canView = has || it.rarity !== 'legendaria';
    if (!has) c.add(canView ? [] : this.clpTag(sx, y + h - 22, bw, it.clp));
    if (canView) c.add(this.viewButton(sx, by, bw, () => this.openPreview(it), has));
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
   * Paquete de DINERO virtual que se compra con CLP (pendiente de la pasarela de pago). (21-11-2026, usuario) Al estilo de la tienda de gemas de
   * Brawl Stars: arriba (70 %) un fondo morado degradado con el montón de billetes (más grande en cada paquete, `i` = 0 el más chico), la cantidad
   * y, si tiene, la etiqueta POPULAR / MEJOR VALOR en la esquina; abajo (30 %) la parte blanca con el precio en CLP en una píldora negra.
   */
  private cashPackCard(x: number, y: number, w: number, h: number, p: CashPack, i: number) {
    const c = this.add.container(0, 0);
    this.body.add(c);
    const r = 14;
    const barH = Math.round(h * 0.3); // parte blanca: 30 % del alto
    const topH = h - barH;
    const lerp = (a: number, b: number, t: number) => Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.IntegerToColor(a), Phaser.Display.Color.IntegerToColor(b), 100, Math.round(t * 100));
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.35).fillRoundedRect(x + 3, y + 5, w, h, r);
    g.fillStyle(0x0a1638, 1).fillRoundedRect(x - 3, y - 3, w + 6, h + 6, r + 2);
    g.fillStyle(0xffffff, 1).fillRoundedRect(x, y, w, h, r);
    // morado degradado: franjas de arriba (claro) a abajo (oscuro); las esquinas de arriba, redondeadas con el primer color
    const c0 = 0xb55cff;
    const c1 = 0x5a1fb0;
    g.fillStyle(c0, 1).fillRoundedRect(x, y, w, r * 2, { tl: r, tr: r, bl: 0, br: 0 });
    const steps = 28;
    const y0 = y + r;
    const sh = (topH - r) / steps;
    for (let s = 0; s < steps; s++) {
      const cc = lerp(c0, c1, s / (steps - 1));
      g.fillStyle(Phaser.Display.Color.GetColor(cc.r, cc.g, cc.b), 1).fillRect(x, y0 + s * sh, w, Math.ceil(sh) + 1);
    }
    // brillo suave arriba
    g.fillStyle(0xffffff, 0.14).fillRoundedRect(x + 5, y + 5, w - 10, topH * 0.28, { tl: r - 3, tr: r - 3, bl: 8, br: 8 });
    c.add(g);
    // montón de billetes: más billetes y más grande en cada paquete (pirámide, de abajo hacia arriba), sobre la mitad de arriba
    const layers = [[1], [2], [2, 1], [3, 2], [4, 3], [4, 3, 2]][Math.min(i, 5)];
    const k = (1 + Math.min(i, 5) * 0.12) * Math.min(1, topH / 130);
    const midX = x + w / 2;
    const baseY = y + topH * 0.62;
    const pile = this.add.container(0, 0);
    const packImg = i === 2 ? 'cash-2' : i === 5 ? 'cash-5' : i >= 3 ? 'cash-3' : null; // la 1.ª y la 2.ª, la pirámide de billetes
    if (packImg && this.textures.exists(packImg)) {
      // (21-11-2026, usuario) imagen propia sobre la cantidad
      const src = this.textures.get(packImg).getSourceImage() as { width: number; height: number };
      const iw = Math.min(w * 0.86, topH * 0.6 * (src.width / src.height));
      pile.add(this.add.image(midX, y + topH * 0.4, packImg).setDisplaySize(iw, iw * (src.height / src.width)));
    } else if (i < 2 && this.textures.exists('cash-pack')) {
      // (21-11-2026, usuario) 1.ª card: un fardo chico (dinero-fardo-chico); 2.ª: dos
      const n = i + 1;
      const fs = Math.min(topH * 0.5, w * (n === 1 ? 0.5 : 0.42));
      for (let j = 0; j < n; j++) pile.add(this.add.image(midX + (j - (n - 1) / 2) * fs * 0.85, y + topH * 0.4 + (j % 2) * 5, 'cash-pack').setDisplaySize(fs, fs));
    } else {
      layers.forEach((n, row) => {
        for (let j = 0; j < n; j++) pile.add(this.cashIcon(midX + (j - (n - 1) / 2) * 26 * k, baseY - row * 15 * k + (j % 2) * 3, 40 * k));
      });
    }
    c.add(pile);
    // cantidad, centrada abajo de la parte morada
    const amount = this.add.text(x + w / 2, y + topH - 8, p.cash.toLocaleString('es-CL'), { fontFamily: FONT, fontSize: '28px', color: '#ffffff', stroke: '#2a0a5a', strokeThickness: 6 }).setOrigin(0.5, 1);
    fitText(amount, w - 16);
    c.add(amount);
    // precio: píldora negra en la parte blanca
    const pw = w - 22;
    const ph = Math.min(barH - 14, 44);
    const py = y + topH + barH / 2;
    const pill = this.add.graphics();
    pill.fillStyle(0x000000, 1).fillRoundedRect(x + (w - pw) / 2, py - ph / 2, pw, ph, ph / 2);
    c.add(pill);
    const price = this.add.text(x + w / 2, py, clpLabel(p.clp), { fontFamily: FONT, fontSize: '20px', color: '#ffffff' }).setOrigin(0.5);
    fitText(price, pw - 16);
    c.add(price);
    // etiqueta POPULAR / MEJOR VALOR: pastilla naranja en la esquina de arriba a la izquierda
    if (p.tag) {
      const rt = this.add.text(x + 14, y + 14, p.tag === 'best' ? 'MEJOR VALOR' : 'POPULAR', { fontFamily: FONT, fontSize: '13px', color: '#ffffff', stroke: '#7a2a00', strokeThickness: 3 }).setOrigin(0, 0.5).setLetterSpacing(1);
      fitText(rt, w - 36);
      const rb = this.add.graphics();
      const tw = rt.displayWidth + 16;
      rb.fillStyle(0x7a2a00, 1).fillRoundedRect(x + 6, y + 3, tw, 24, 12);
      rb.fillStyle(0xff8a1f, 1).fillRoundedRect(x + 8, y + 5, tw - 4, 20, 10);
      c.add(rb);
      rt.setX(x + 14);
      c.add(rt);
    }
    const hit = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
    hit.on('pointerup', this.tap(() => this.toast('El pago con dinero real (CLP) llega pronto')));
    c.add(hit);
  }  /** Pelota que cruza la tarjeta dejando la estela del efecto (fx/ballTrailFx.ts: cinta, partículas y chispas del Oro). Se repite sola. */
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
  private viewButton(x: number, y: number, w: number, onClick: () => void, _owned = false) {
    // (21-11-2026) sin el triángulo de "play": solo el texto VER
    // (22-11-2026, usuario) TODOS dicen COMPRAR (también en lo que ya tienes: dentro se usa). owned queda por si se vuelve a distinguir
    return arcadeButton(this, x, y, w, 48, 'COMPRAR', this.tap(onClick), { palette: 'blue' });
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
      showPrices: isDevMode() && !!it, // (21-11-2026, usuario) en modo desarrollo se ven los precios (virtual y CLP) aunque ya sea tuyo
      price: !it || it.realMoneyOnly || !it.available ? null : it.price,
      priceDim: !it || s.level < it.minLevel || s.gems < it.price,
      clp: it?.clp ?? 0,
      onBuyCash: () => it && (p.owned ? this.toast('Modo desarrollo: ya lo tienes (solo se muestra el precio)') : this.confirmBuy(it)),
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
    const cardTweens = new Set(this.cardTweens);
    const paused: Phaser.Tweens.Tween[] = [];
    for (const tw of this.tweens.getTweens()) {
      if (tw.isPaused()) continue;
      if (cardTweens.has(tw) || tw.targets.some((t) => mine.has(t))) {
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
  /** nombre de cada categoría para el aviso del cambio de ofertas */
  private static readonly KIND_LABEL: Partial<Record<ItemKind, string>> = { skin: 'Nuevos personajes', charge: 'Cargando golpe', inferno: 'Poderes ULTI', smash: 'Poderes especiales', defensive: 'Poderes defensivos', zone: 'Zona' };
  /**
   * (21-11-2026, usuario) CAMBIAR las ofertas de una categoría (se toca su reloj): REROLL_PRICE de dinero virtual, una vez por semana y por
   * categoría (se reinicia el lunes); trae otros ítems. Si no hay más que mostrar o ya se usó esta semana, solo avisa (no cobra).
   */
  private rerollDialog(kind: ItemKind) {
    const s = getPlayer();
    const now = Date.now();
    if (!canReroll(kind)) return this.toast(ERRORS.nothing_to_change);
    if (rerolledThisWeek(s, kind, now)) return this.toast(ERRORS.already_rerolled);
    if (s.gems < REROLL_PRICE) return this.toast(`Te faltan ${(REROLL_PRICE - s.gems).toLocaleString('es-CL')} de dinero`);
    const W = this.scale.width;
    const H = this.scale.height;
    const close = () => {
      this.modal.forEach((o) => o.destroy());
      this.modal = [];
    };
    const shade = this.add.rectangle(0, 0, W, H, 0x02060f, 0.72).setOrigin(0).setDepth(8000).setInteractive();
    shade.on('pointerdown', close);
    const pw = Math.min(560, W - 60);
    const ph = 400;
    const panel = this.add.container(W / 2, H / 2).setDepth(8001);
    panel.add(this.add.rectangle(0, 0, pw, ph, 0x000000, 0.001).setInteractive());
    panel.add(this.card(-pw / 2, -ph / 2, pw, ph, { line: GOLD, glow: 0.3, r: 24 }));
    panel.add(this.add.text(0, -ph / 2 + 50, '¿CAMBIAR OFERTAS?', { fontFamily: FONT, fontSize: '34px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 6 }).setOrigin(0.5).setLetterSpacing(1));
    panel.add(this.add.text(0, -ph / 2 + 98, ShopScene.KIND_LABEL[kind] ?? '', { fontFamily: FONT, fontSize: '24px', color: '#dbe5ff' }).setOrigin(0.5));
    panel.add(this.add.text(0, -ph / 2 + 142, 'Salen otros ítems. Una vez por semana\npor sección (se reinicia el lunes).', { fontFamily: FONT, fontSize: '17px', color: '#9fb4e0', align: 'center' }).setOrigin(0.5));
    panel.add(this.cashIcon(-46, -ph / 2 + 206, 40, REROLL_PRICE));
    panel.add(this.add.text(-22, -ph / 2 + 206, REROLL_PRICE.toLocaleString('es-CL'), { fontFamily: FONT, fontSize: '32px', color: '#ffd23f', stroke: '#0a1638', strokeThickness: 6 }).setOrigin(0, 0.5));
    panel.add(this.add.text(0, -ph / 2 + 244, `Te quedarán ${(s.gems - REROLL_PRICE).toLocaleString('es-CL')} de dinero`, { fontFamily: FONT, fontSize: '17px', color: '#7f93bf' }).setOrigin(0.5));
    const bw = (pw - 70) / 2;
    const by = ph / 2 - 62;
    panel.add(arcadeButton(this, -bw / 2 - 10, by, bw, 76, 'CANCELAR', close, { palette: 'blue' }));
    panel.add(arcadeButton(this, bw / 2 + 10, by, bw, 76, 'CAMBIAR', () => {
      close();
      const res = commit((st) => rerollShop(st, kind, Date.now()));
      if (!res.ok) return this.toast(ERRORS[res.error] ?? 'No se pudo cambiar');
      this.celebrate();
      this.build();
    }, { palette: 'yellow' }));
    panel.setScale(0.85).setAlpha(0);
    this.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
    this.modal = [shade, panel];
  }  private confirmBuy(it: ShopItem) {
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
    panel.add(this.add.text(0, -ph / 2 + 104, `${it.kind === 'style' ? 'Estilo' : it.kind === 'inferno' ? 'Poder ULTI' : it.kind === 'charge' ? 'Cargando golpe' : it.kind === 'defensive' ? 'Poder defensivo' : it.kind === 'smash' ? 'SMASH' : it.kind === 'skin' ? 'Personaje' : 'Habilidad'} ${it.name}`, { fontFamily: FONT, fontSize: '26px', color: '#dbe5ff' }).setOrigin(0.5));
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
  private ultiCardBg(c: Phaser.GameObjects.Container, x: number, y: number, w: number, h: number, legend = false) {
    const r = 20;
    const cw = Math.round(w);
    const key = `shop-ulti-bg-${legend ? 'g' : 'p'}-${cw}x${h}`;
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
        // (21-11-2026, usuario) LEGENDARIA: dorada (mismos tonos que el botón dorado de la ULTI legendaria) en vez del morado
        lin.addColorStop(0, legend ? '#ffe27a' : ULTI_TOP);
        lin.addColorStop(0.5, legend ? '#d99400' : ULTI_MID);
        lin.addColorStop(1, legend ? '#6a3d00' : ULTI_BOT);
        ctx.fillStyle = lin;
        ctx.fill();
        ctx.save();
        path();
        ctx.clip();
        // halo claro tras la bola
        const rad = ctx.createRadialGradient(cw / 2, 78, 4, cw / 2, 78, Math.max(cw, 150) * 0.75);
        rad.addColorStop(0, legend ? 'rgba(255,244,196,0.7)' : 'rgba(214,170,255,0.55)');
        rad.addColorStop(1, legend ? 'rgba(255,244,196,0)' : 'rgba(214,170,255,0)');
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

    // LEGENDARIA: aro dorado brillante alrededor de la card
    if (legend) c.add(this.add.graphics().lineStyle(3, 0xffe27a, 1).strokeRoundedRect(x, y, w, h, r));
    // destello diagonal que cruza la tarjeta (recortado al contorno redondeado)
    const shape = roundedPoly(x, y, w, h, r);
    const shine = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    c.add(shine);
    const st = { t: 0 };
    // LEGENDARIA: destello más ancho, más fuerte y más seguido ("shiny")
    const band = legend ? 52 : 34;
    const slant = h * 0.45;
    const tw = this.tweens.add({
      targets: st,
      t: { from: 0, to: 1 },
      duration: legend ? 900 : 1100,
      delay: Phaser.Math.Between(300, legend ? 900 : 1800),
      repeat: -1,
      repeatDelay: legend ? 1100 : 2600,
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
        if (pts.length >= 3) shine.fillStyle(0xffffff, legend ? 0.42 : 0.2).fillPoints(pts, true);
      },
    });
    this.cardTweens.push(tw);
    // chispas que titilan sobre la tarjeta (la legendaria, más y doradas)
    for (let i = 0; i < (legend ? 6 : 3); i++) {
      const sp = this.add
        .star(x + Phaser.Math.Between(16, Math.max(17, w - 16)), y + Phaser.Math.Between(16, legend ? Math.max(40, h - 70) : 130), 4, legend ? 2 : 1.5, legend ? 8 : 6, legend ? 0xfff3b0 : 0xf3e6ff, 1)
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
  /** `rot`: categoría que rota → contador de las ofertas a la derecha, en la misma fila (si no hay otros que mostrar, no sale). */
  private sectionTitle(W: number, y: number, label: string, info?: Info, rot?: { kind: ItemKind; now: number }) {
    const ms = rot ? offersChangeIn(rot.kind, rot.now) : null;
    // con contador, el título se centra en lo que queda a la izquierda de la píldora
    const x1 = ms !== null ? W - 30 - ShopScene.ROT_PILL_W - 14 : W - 40;
    const t = this.add.text(W / 2, y, label, { fontFamily: FONT, fontSize: '28px', color: '#ffffff' }).setOrigin(0.5).setLetterSpacing(3);
    const iconGap = 12;
    const iconD = 32;
    const extra = info ? iconGap + iconD : 0;
    // título largo + contador: se encoge para no tocar la píldora
    const room = x1 - 40 - extra - 24;
    if (t.width > room) t.setScale(room / t.width);
    // texto + icono centrados juntos; con contador a la derecha, el t?tulo parte a la IZQUIERDA (21-11-2026, usuario)
    const left = ms !== null ? 40 : (40 + x1) / 2 - (t.displayWidth + extra) / 2;
    t.setX(left + t.displayWidth / 2);
    const right = left + t.displayWidth + extra;
    const g = this.add.graphics();
    g.lineStyle(2, NEON, 0.7);
    if (left - 18 > 40) g.lineBetween(40, y, left - 18, y);
    if (x1 > right + 18) g.lineBetween(right + 18, y, x1, y);
    this.body.add([g, t]);
    if (info) this.body.add(this.infoButton(left + t.displayWidth + iconGap + iconD / 2, y, info));
    if (rot && ms !== null) this.rotationPill(W, y, rot.kind, ms);
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
