import Phaser from 'phaser';
import { FONT, restartOnResize, textStyle } from '../ui/theme';
import { stadiumBg } from '../ui/ui';
import { Character, playerLook } from '../objects/Character';
import { MAX_LEVEL } from '../config';
import { getProfile, levelProgress, setCharColor, setCharge, setDefensive, setInferno, setSkin, setSmash } from '../logic/Profile';
import { CHAR_COLOR_LIST, type CharColorId, charColorInfo, charColorOf, charColorOwned } from '../domain/charColors';
import { applyCharColor } from '../fx/CharColorFx';
import { type UnlockKey, isUnlocked, unlockLabel } from '../domain/unlocks';
import { CATALOG, skinById } from '../characters/catalog';
import { addPortrait } from '../characters/portrait';
import type { SkinId } from '../characters/skins';
import { ABILITIES, type AbilityDef, type AbilityId } from '../logic/Abilities';
import { bakeImage } from '../ui/bakeImage';
import { drawAbilityIcon, drawDefensiveIcon, drawDisc } from '../ui/icons';
import { DEFENSIVE_POWERS, defensiveOwned, defensivePowerDef, defensivePowerOf } from '../domain/defensivePowers';
import { roundedPoly } from '../ui/shapes';
import { arcadeButton } from '../ui/modeButtons';
import { hyperTexture } from '../ui/AbilityButton';
import { commit, getPlayer } from '../domain/playerStore';
import { equipStyle, upgradeZoneStat } from '../domain/operations';
import type { StyleId } from '../domain/player';
import { STYLE_LOOK, styleLook } from '../ui/styleLook';
import { rankedState } from '../logic/Ranked';
import { LEAGUE_ORDER } from '../domain/rankedConfig';
import { ZONE_STAT_KEYS, ZONE_STAT_MAX, type ZoneStatKey } from '../domain/zoneProgress';
import { INFERNO_POWERS, infernoOwned, infernoPowerDef, type InfernoPower } from '../domain/infernoPowers';
import { addBallPreview, ensureBallAnims, queueInfernoArt } from '../fx/InfernoFx';
import { type PowerSlot, openPowerDialog } from '../ui/PowerDialog';
import { SMASH_POWERS, type SmashPower, smashOwned, smashPowerDef, smashPowerOf } from '../domain/smashPowers';
import { elementTexture } from '../ui/AbilityButton';
import { CHARGE_FX, type ChargeFxId, chargeFxOf, chargeFxOwned } from '../domain/chargeFx';
import { chargePreview, queueChargeFxArt } from '../fx/chargeFx';
import { INFERNO } from '../logic/InfernoDrive';
import { ZONE } from '../logic/Zone';

/** Arte de los botones de habilidad. `box` = círculo visible en px de la imagen (sin margen transparente). */
const ABILITY_ART: Partial<Record<AbilityId, { key: string; file: string; w: number; h: number; box: { x0: number; y0: number; x1: number; y1: number } }>> = {
  dash: { key: 'btn-dash', file: 'assets/btn-dash.png', w: 1312, h: 1199, box: { x0: 144, y0: 99, x1: 1146, y1: 1122 } },
  smash: { key: 'btn-smash', file: 'assets/btn-smash.png', w: 1312, h: 1199, box: { x0: 153, y0: 105, x1: 1134, y1: 1116 } },
};

const NAVY = 0x0b1733;
const NEON = 0x3a7bff;

/** Separación entre tarjetas (filas y columnas) de la cuadrícula de habilidades: la misma en todas. */
const GRID_GAP = 12;
/** Columna de la cuadrícula: izquierda (0) o derecha (1). Mismos márgenes que el resto de la pantalla (30 px). */
/** nombre de cada EFECTO PELOTA (estela; ui/styleLook.ts) */
const STYLE_NAME: Record<string, string> = { classic: 'CLÁSICO', red: 'ROJO', pink: 'ROSADO', green: 'VERDE', gold: 'ORO' };

/**
 * Frame 'trim' de una imagen: solo su contenido (sin el margen transparente). Se mide una vez y queda en la textura;
 * si no se puede medir, el frame completo.
 */
function trimFrame(scene: Phaser.Scene, key: string): string | undefined {
  const tex = scene.textures.get(key);
  if (tex.has('trim')) return 'trim';
  try {
    const src = tex.getSourceImage() as CanvasImageSource & { width: number; height: number };
    const cv = document.createElement('canvas');
    cv.width = src.width;
    cv.height = src.height;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    if (!ctx) return undefined;
    ctx.drawImage(src, 0, 0);
    const px = ctx.getImageData(0, 0, cv.width, cv.height).data;
    let x0 = cv.width, x1 = -1, y0 = cv.height, y1 = -1;
    for (let y = 0; y < cv.height; y++) {
      for (let x = 0; x < cv.width; x++) {
        if (px[(y * cv.width + x) * 4 + 3] > 40) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return undefined;
    tex.add('trim', 0, x0, y0, x1 + 1 - x0, y1 + 1 - y0);
    return 'trim';
  } catch {
    return undefined;
  }
}

const gridCol = (W: number, col: 0 | 1) => {
  const w = (W - 60 - GRID_GAP) / 2;
  return { x: 30 + col * (w + GRID_GAP), w };
};

/** Habilidad pasiva del personaje (se muestra sin recarga): lo que hace y su icono. */
interface PassiveDef {
  name: string;
  desc: string;
  color: number;
  colorDark: number;
  /** textura del botón del partido, si la hay (se carga en `preload`) */
  art?: string;
  /** icono dibujado (si no hay textura): centrado en (0,0) con radio R */
  draw?: (g: Phaser.GameObjects.Graphics, R: number) => void;
}

const PASSIVES: Record<'spin' | 'charge', PassiveDef> = {
  // saque con efecto: el icono es la pelota con el rastro (remolino) que deja al curvar; ya no usa el botón del saque
  spin: {
    name: 'Efecto pelota',
    desc: 'Saque con efecto: la pelota curva hacia el lado que apuntas.',
    color: 0x8a6bff,
    colorDark: 0x4a35b8,
    draw: (g, R) => {
      const bx = R * 0.22;
      const by = -R * 0.02;
      // rastro: tres arcos que giran alrededor de la pelota y se desvanecen hacia atrás
      for (let i = 0; i < 3; i++) {
        const r = R * (0.5 + i * 0.15);
        const a0 = Math.PI * (0.62 + i * 0.1);
        const a1 = Math.PI * (1.5 + i * 0.05);
        g.lineStyle(R * (0.15 - i * 0.03), 0xffffff, 0.95 - i * 0.28).beginPath().arc(bx, by, r, a0, a1).strokePath();
      }
      // pelota
      g.fillStyle(0x0a1638).fillCircle(bx, by, R * 0.4);
      g.fillStyle(0xd7f53a).fillCircle(bx, by, R * 0.33);
      g.lineStyle(R * 0.06, 0xffffff, 0.95).beginPath().arc(bx - R * 0.42, by, R * 0.34, -0.85, 0.85).strokePath();
      g.fillStyle(0xffffff, 0.7).fillCircle(bx + R * 0.1, by - R * 0.14, R * 0.07);
    },
  },
  // golpe cargado: se mantiene para cargar (arco azul que pasa a dorado); con el joystick sale cortita, globo o cruzado
  charge: {
    name: 'Cargando golpe',
    desc: 'Mantén para cargar más fuerza. Con el joystick: cortita, globo o cruzado.',
    color: 0x2f9bff,
    colorDark: 0x1a5fb4,
    draw: (g, R) => {
      // el aro CLÁSICO de la carga (el mismo de fx/chargeFx.chargePreview, en pequeño) con la pelota encima
      const w = R * 1.5;
      const cy = R * 0.3;
      g.fillStyle(0x6ec1ff, 0.32).fillEllipse(0, cy, w, w * 0.36);
      g.lineStyle(R * 0.13, 0xd6f0ff, 0.95).strokeEllipse(0, cy, w, w * 0.36);
      g.lineStyle(R * 0.06, 0x6ec1ff, 0.8).strokeEllipse(0, cy, w * 1.14, w * 0.43);
      // pelota sobre el aro
      g.fillStyle(0x0a1638).fillCircle(0, -R * 0.12, R * 0.32);
      g.fillStyle(0xd7f53a).fillCircle(0, -R * 0.12, R * 0.25);
      g.lineStyle(2, 0xffffff, 0.9).beginPath().arc(-R * 0.07, -R * 0.12, R * 0.17, -0.9, 0.9).strokePath();
    },
  },
};

/**
 * Pantalla PERSONAJE (vertical): vitrina del personaje, nivel + XP, habilidades, poder del Inferno (selector) y Zona.
 * Mientras no haya base de datos el personaje es siempre Nxo (logic/Profile FORCED_SKIN).
 */
export class CustomizeScene extends Phaser.Scene {
  /** tarjeta del INFERNO (se redibuja al elegir otro poder) */
  private infernoBox?: Phaser.GameObjects.Container;

  constructor() {
    super('Customize');
  }

  preload() {
    if (!this.textures.exists('menu-bg')) this.load.image('menu-bg', 'assets/menu-bg.webp');
    for (const k of ['estilos', 'efecto', 'cargando', 'mascotas']) if (!this.textures.exists(`personalizar-${k}`)) this.load.image(`personalizar-${k}`, `assets/personalizar-${k}.webp`);
    for (const art of Object.values(ABILITY_ART)) if (art && !this.textures.exists(art.key)) this.load.image(art.key, art.file);
    queueInfernoArt(this.load); // bolas de los poderes del INFERNO (vista previa del selector)
    queueChargeFxArt(this.load, ['fire', 'energy', 'tulip']); // aros de carga (vista previa del diálogo CARGANDO GOLPE)
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    restartOnResize(this);
    this.infernoBox = undefined; // la escena se reinicia (p. ej. al subir un atributo de Zona)
    ensureBallAnims(this);
    this.cameras.main.fadeIn(200, 0, 0, 0);
    stadiumBg(this, 0.55);
    const p = getProfile();

    const back = () => {
      this.cameras.main.fadeOut(180, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Menu'));
    };

    // ---------------------------------------------------------------- cabecera
    const headY = 64;
    this.backButton(54, headY, back);
    const title = this.add.text(W / 2, headY, 'PERSONALIZAR', { fontFamily: FONT, fontSize: '42px', color: '#ffffff' }).setOrigin(0.5).setLetterSpacing(2);
    // RAYOS acumulados (se gastan en los atributos de la ZONA), arriba a la derecha como los contadores del menú
    const raysW = this.raysPill(W - 22, headY);
    // que no choque con el botón volver (borde derecho ≈ 86 px) ni con el contador de rayos
    const maxTitleW = W - 2 * Math.max(100, raysW + 34);
    if (title.width > maxTitleW) title.setScale(maxTitleW / title.width);

    // reparto vertical (de arriba abajo, medidas fijas); la vitrina usa lo que sobra
    // la vitrina arranca pegada al título (el retrato empieza ~30 px más abajo por su margen); el alto que gana el
    // personaje al subir se reparte entre las tarjetas de habilidades (ver `abExtra`)
    const TOP = 80;
    // cuadrícula de 3 filas × 2 columnas, todas con la misma separación (GRID_GAP): fila 1 EFECTO PELOTA | CARGANDO GOLPE,
    // fila 2 las dos habilidades equipadas (DASH | SMASH), fila 3 INFERNO | ZONA
    // (11-11-2026) arriba una fila de 4 cosméticos (ESTILOS · EFECTO PELOTA · CARGANDO GOLPE · MASCOTAS) y debajo el título
    // HABILIDADES con DEFENSIVO | ESPECIAL y ULTI | ZONA
    const L = { gapHero: 14, level: 78, gapA: 22, cosmetic: 136, cosToTitle: 30, titleToCard: 28, ability: 104, abilityGap: GRID_GAP, gapFeatures: GRID_GAP, features: 270, gapC: 18, play: 92, bottom: 52 };
    // NIVEL MÁXIMO: sin tarjeta de nivel en la lista (sale como pastilla pequeña sobre el nombre, en la vitrina) y todo su
    // alto se reparte entre las dos filas de tarjetas de habilidades (el resto del reparto no cambia)
    const maxed = p.level >= MAX_LEVEL;
    if (maxed) {
      const freed = L.level + (L.gapA - 8);
      L.level = 0;
      L.gapA = 8;
      L.ability += Math.floor(freed / 2);
    }
    const below =
      L.gapHero + L.level + L.gapA + L.cosmetic + L.cosToTitle + L.titleToCard + L.ability + L.gapFeatures + L.features + L.gapC + L.play + L.bottom;
    const free = H - TOP - below;
    let heroH = Phaser.Math.Clamp(free, 240, 392);
    let spare = Math.max(0, free - heroH);
    // primero ganan alto las tarjetas (cosméticos y habilidades, hasta +40 px cada fila), luego el personaje, y lo que sobre
    // es aire
    const abExtra = Math.min(Math.floor(spare / 2), 40);
    L.ability += abExtra;
    L.cosmetic += abExtra;
    spare -= abExtra * 2;
    const grow = Math.min(560 - heroH, spare);
    heroH += grow;
    const extra = spare - grow; // pantallas muy altas: aire repartido arriba y antes de JUGAR

    // ---------------------------------------------------------------- vitrina
    const feetY = TOP + extra * 0.5 + heroH;
    // el personaje y su pedestal van SHOWCASE_LIFT px más arriba: la elipse del pedestal (70 px de alto, centrada en los
    // pies) ya no pisa la tarjeta de NIVEL; el personaje se achica un poco para no acercarse al título
    const SHOWCASE_LIFT = 38;
    this.showcase(W, TOP, feetY - SHOWCASE_LIFT, heroH - SHOWCASE_LIFT * 0.5, p.skin as SkinId, maxed);

    // ---------------------------------------------------------------- nivel + XP (en nivel máximo va en la vitrina)
    let y = feetY + L.gapHero;
    if (!maxed) this.levelCard(W, y, p.level, levelProgress(p));
    y += L.level + L.gapA;

    // ---------------------------------------------------------------- cosméticos (4 columnas)
    const rowC = y;
    this.cosmeticRow(W, rowC, L.cosmetic, p.skin as SkinId);

    // ---------------------------------------------------------------- habilidades
    y += L.cosmetic + L.cosToTitle;
    this.sectionTitle(W, y, 'HABILIDADES');
    const row2 = y + L.titleToCard;
    p.abilities.forEach((id, i) => this.abilityCard(W, row2, L.ability, i as 0 | 1, ABILITIES[id]));
    y += L.titleToCard + L.ability + L.gapFeatures;
    this.featureCards(W, y, L.features);
    // bloqueos por nivel (domain/unlocks.ts): DEFENSIVO 2 · ESPECIAL 4 · ULTI 6 · ESTILOS 8 · EFECTO PELOTA 10 · CARGANDO 12 · ZONA 15
    // (el saque con efecto sigue bloqueado hasta el 15 en el partido; ya no tiene tarjeta)
    {
      const c0 = gridCol(W, 0);
      const c1 = gridCol(W, 1);
      p.abilities.forEach((id, i) => {
        const c = i === 0 ? c0 : c1;
        this.lockCard(c.x, row2, c.w, L.ability, id === 'dash' ? 'defensive' : 'special');
      });
      this.lockCard(c0.x, y, c0.w, L.features, 'ulti');
      this.lockCard(c1.x, y, c1.w, L.features, 'zone');
    }
    y += L.features + L.gapC + extra * 0.5;

    // ---------------------------------------------------------------- JUGAR
    const playH = L.play;
    const playY = y + playH / 2;
    // sin latido (quieto), con la flecha de siempre
    arcadeButton(this, W / 2, playY, Math.min(520, W - 120), playH, 'JUGAR', () => {
      this.cameras.main.fadeOut(180, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Matchmaking'));
    }, { palette: 'yellow', chevron: true, pulse: false });
  }

  // ================================================================ piezas

  /**
   * Tarjeta de una habilidad aún BLOQUEADA por nivel (domain/unlocks.ts): velo oscuro, candado y "NIVEL n". Tocarla solo
   * avisa (no abre su diálogo). No hace nada si ya está desbloqueada.
   */
  private lockCard(x: number, y: number, w: number, h: number, key: UnlockKey, r = 18) {
    if (isUnlocked(key, getPlayer().level)) return;
    const g = this.add.graphics().setDepth(5);
    g.fillStyle(0x02060f, 0.72).fillRoundedRect(x, y, w, h, r);
    g.lineStyle(2, 0x3a4666, 1).strokeRoundedRect(x, y, w, h, r);
    const cx = x + w / 2;
    const cy = y + h / 2;
    const lk = this.add.graphics({ x: cx, y: cy - 12 }).setDepth(6);
    lk.lineStyle(4, 0xc8d2ea, 1).beginPath().arc(0, -6, 9, Math.PI, 0).strokePath();
    lk.lineBetween(-9, -6, -9, 1).lineBetween(9, -6, 9, 1);
    lk.fillStyle(0xc8d2ea, 1).fillRoundedRect(-13, 0, 26, 19, 5);
    lk.fillStyle(0x02060f, 1).fillCircle(0, 8, 3);
    // "DESBLOQUEA" + "NIVEL n" (dos líneas: cabe también en las tarjetas pequeñas de los cosméticos)
    const t = this.add
      .text(cx, cy + 30, `DESBLOQUEA
${unlockLabel(key)}`, { fontFamily: FONT, fontSize: '16px', color: '#ffd23f', stroke: '#0a1638', strokeThickness: 4, align: 'center' })
      .setOrigin(0.5)
      .setLineSpacing(-2)
      .setDepth(6);
    if (t.width > w - 10) t.setScale((w - 10) / t.width);
    const hit = this.add.zone(cx, cy, w, h).setInteractive({ useHandCursor: true }).setDepth(7);
    hit.on('pointerup', () => this.toast(`Se desbloquea en el ${unlockLabel(key)}`));
  }

  /** Panel con el lenguaje del menú: sombra, halo, cuerpo marino, brillo superior y borde neón. */
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

  private sectionTitle(W: number, y: number, label: string) {
    const t = this.add.text(W / 2, y, label, { fontFamily: FONT, fontSize: '28px', color: '#ffffff' }).setOrigin(0.5).setLetterSpacing(3);
    const g = this.add.graphics();
    const half = t.width / 2 + 18;
    g.lineStyle(2, NEON, 0.7).lineBetween(40, y, W / 2 - half, y).lineBetween(W / 2 + half, y, W - 40, y);
  }

  /** Personaje grande sobre un pedestal de luz, con su nombre. */
  private showcase(W: number, top: number, feetY: number, heroH: number, skin: SkinId, maxed = false) {
    const cx = W / 2;
    // haz de luz detrás
    const beam = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    const beamTop = top + 26; // debajo del título
    beam.fillStyle(NEON, 0.1).fillTriangle(cx - 60, beamTop, cx + 60, beamTop, cx + 230, feetY);
    beam.fillTriangle(cx - 60, beamTop, cx - 230, feetY, cx + 230, feetY);
    // pedestal: anillos neón
    const ped = this.add.graphics();
    ped.fillStyle(0x05112c, 0.75).fillEllipse(cx, feetY, 330, 70);
    ped.lineStyle(4, NEON, 0.9).strokeEllipse(cx, feetY, 330, 70);
    ped.lineStyle(2, 0x6fb2ff, 0.6).strokeEllipse(cx, feetY, 250, 50);
    const glow = this.add.ellipse(cx, feetY, 330, 70, NEON, 0.25).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: glow, alpha: { from: 0.15, to: 0.45 }, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // el retrato se centra por su caja (incluye la raqueta a la derecha): se corre para centrar el CUERPO
    const bodyShift = heroH * 0.08;
    const hero: Phaser.GameObjects.Image | Character =
      addPortrait(this, skin, cx + bodyShift, feetY + 6, heroH * 0.94) ??
      new Character(this, cx, feetY, playerLook(skin), 'front').setScale((heroH * 0.9) / 150);
    this.tweens.add({ targets: hero, y: hero.y - 6, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // ESTILO DE COLOR elegido (fx/CharColorFx.ts): la vitrina ya lo muestra
    applyCharColor(hero, getProfile().color, skin);

    // placa con el nombre del personaje (abajo a la izquierda de la vitrina)
    const name = skinById(skin).name.toUpperCase();
    const px = 40;
    const py = feetY - 70;
    const pw = 170;
    const ph = 58;
    const plate = this.add.graphics();
    const shape = roundedPoly([[px + 10, py], [px + pw, py], [px + pw - 10, py + ph], [px, py + ph]], 12);
    plate.fillStyle(NAVY, 0.92).fillPoints(shape, true);
    plate.lineStyle(3, NEON, 1).strokePoints(shape, true, true);
    this.add.text(px + pw / 2, py + ph / 2, name, { fontFamily: FONT, fontSize: '32px', color: '#ffffff' }).setOrigin(0.5).setLetterSpacing(2);

    // TEMPORAL (pruebas): selector Hombre/Mujer, a la derecha de la vitrina
    this.sexToggle(W - 40, py + ph / 2, skin);

    // NIVEL MÁXIMO: pastilla pequeña justo encima del nombre (la tarjeta de nivel ya no sale en la lista)
    if (maxed) this.maxLevelPill(px + 6, py - 8);
    // (el color del personaje se elige en la tarjeta ESTILOS, debajo)
  }

  /** Columna `i` (0..3) de la fila de 4 cosméticos. */
  private cosCol(W: number, i: number) {
    const gap = 10;
    const w = (W - 60 - gap * 3) / 4;
    return { x: 30 + i * (w + gap), w };
  }

  /**
   * Fila de 4 cosméticos: ESTILOS (color del personaje) · EFECTO PELOTA (estela) · CARGANDO GOLPE · MASCOTAS (bloqueada
   * hasta la LIGA ORO). Cada tarjeta es solo su imagen (public/assets/personalizar-*.webp, ya trae el título); tocarla
   * abre su selector.
   */
  private cosmeticRow(W: number, y: number, h: number, skin: SkinId) {
    // ESTILOS y EFECTO PELOTA (bloqueadas hasta su nivel, como las habilidades)
    const sc = this.cosCol(W, 0);
    // su dibujo es más alto y estrecho que el de las otras: se achica para que se vea del mismo tamaño
    this.miniCard(sc, y, h, 0xff8fc4, 'personalizar-estilos', () => this.openColorDialog(skin), 0.72);
    this.lockCard(sc.x, y, sc.w, h, 'styles', 16);
    const ec = this.cosCol(W, 1);
    this.miniCard(ec, y, h, styleLook((getPlayer().equipped.style ?? 'classic') as StyleId).color, 'personalizar-efecto', () => this.openStyleDialog());
    this.lockCard(ec.x, y, ec.w, h, 'trail', 16);
    // CARGANDO GOLPE (bloqueada hasta su nivel, como la habilidad)
    const cc = this.cosCol(W, 2);
    this.miniCard(cc, y, h, PASSIVES.charge.color, 'personalizar-cargando', () => this.openChargeDialog());
    this.lockCard(cc.x, y, cc.w, h, 'charge', 16);
    // MASCOTAS: aún no existen; se abrirán al llegar a la LIGA ORO
    const mc = this.cosCol(W, 3);
    this.miniCard(mc, y, h, 0xffc42e, 'personalizar-mascotas', () => this.toast('Mascotas: se desbloquean al llegar a la LIGA ORO'), 0.9);
    const goldReached = LEAGUE_ORDER.indexOf(rankedState().league) >= LEAGUE_ORDER.indexOf('gold');
    if (!goldReached) this.lockOverlay(mc.x, y, mc.w, h, 'LIGA ORO', 'Mascotas: se desbloquean al llegar a la LIGA ORO');
  }

  /** Tarjeta pequeña (1/4 de ancho): solo su imagen, centrada y ajustada al cuadro. */
  private miniCard(col: { x: number; w: number }, y: number, h: number, color: number, key: string, onTap: () => void, size = 1) {
    const { x, w } = col;
    this.card(x, y, w, h, { line: color, glow: 0.2, r: 16 });
    if (this.textures.exists(key)) {
      // sin el margen transparente de cada archivo (traen márgenes distintos): así las 4 se ven del mismo tamaño
      const img = this.add.image(x + w / 2, y + h / 2, key, trimFrame(this, key));
      img.setScale(Math.min((w - 6) / img.width, (h - 6) / img.height) * size);
    }
    const hit = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
    hit.on('pointerup', onTap);
  }

  /** Velo de bloqueo genérico (candado + texto dorado); tocar avisa con `msg`. */
  private lockOverlay(x: number, y: number, w: number, h: number, label: string, msg: string) {
    const g = this.add.graphics().setDepth(5);
    g.fillStyle(0x02060f, 0.72).fillRoundedRect(x, y, w, h, 16);
    const cx = x + w / 2;
    const cy = y + h / 2;
    const lk = this.add.graphics({ x: cx, y: cy - 12 }).setDepth(6);
    lk.lineStyle(4, 0xc8d2ea, 1).beginPath().arc(0, -6, 9, Math.PI, 0).strokePath();
    lk.lineBetween(-9, -6, -9, 1).lineBetween(9, -6, 9, 1);
    lk.fillStyle(0xc8d2ea, 1).fillRoundedRect(-13, 0, 26, 19, 5);
    const t = this.add.text(cx, cy + 26, label, { fontFamily: FONT, fontSize: '15px', color: '#ffd23f', stroke: '#0a1638', strokeThickness: 4 }).setOrigin(0.5).setDepth(6);
    if (t.width > w - 10) t.setScale((w - 10) / t.width);
    const hit = this.add.zone(cx, cy, w, h).setInteractive({ useHandCursor: true }).setDepth(7);
    hit.on('pointerup', () => this.toast(msg));
  }

  /** EFECTO PELOTA: estela de tus golpes (estilos de la Tienda y del Pase). */
  private openStyleDialog() {
    const p = getPlayer();
    const cur = (p.equipped.style ?? 'classic') as StyleId;
    const ids = Object.keys(STYLE_LOOK) as StyleId[];
    const preview = (x: number, y: number, size: number, id: StyleId) => {
      const g = this.add.graphics({ x, y });
      const r = size * 0.32;
      const lk = styleLook(id);
      for (let i = 0; i < 4; i++) g.lineStyle(r * (0.5 - i * 0.1), lk.trail, 0.95 - i * 0.22).lineBetween(-r * 2.2, r * (0.9 - i * 0.1), -r * 0.2, r * 0.1);
      g.fillStyle(0x0a1638).fillCircle(r * 0.3, 0, r * 1.05);
      g.fillStyle(0xd7f53a).fillCircle(r * 0.3, 0, r * 0.86);
      g.lineStyle(r * 0.14, 0xffffff, 0.95).beginPath().arc(r * 0.3 - r * 0.9, 0, r * 0.8, -0.85, 0.85).strokePath();
      if (lk.sparkle) for (let i = 0; i < 4; i++) g.fillStyle(0xfff6c8, 1).fillCircle(-r * (0.6 + i * 0.4), r * (0.2 * ((i % 2) * 2 - 1)), r * 0.12);
      return g;
    };
    const slots: PowerSlot[] = ids.map((id) => ({
      name: STYLE_NAME[id] ?? id.toUpperCase(),
      desc: STYLE_LOOK[id].perk,
      owned: id === 'classic' || p.owned.includes(`style:${id}` as never),
      equipped: id === cur,
      preview: (x, y, size) => preview(x, y, size, id),
      onEquip: () => commit((st) => equipStyle(st, id)),
    }));
    openPowerDialog(this, {
      title: 'EFECTO PELOTA',
      color: styleLook(cur).color,
      slots,
      onShop: () => {
        this.cameras.main.fadeOut(180, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Shop'));
      },
      onClose: ({ changed }) => {
        if (changed) this.scene.restart(); // al instante: la pantalla ya muestra lo que se equipó
      },
    });
  }

  /** "MÁX · 20" con medalla dorada: poco ancho, abajo-izquierda en (x, bottom). */
  private maxLevelPill(x: number, bottom: number) {
    const h = 30;
    const y = bottom - h;
    const t = this.add.text(0, 0, `NIVEL MÁX. ${MAX_LEVEL}`, { fontFamily: FONT, fontSize: '15px', color: '#ffd23f' }).setOrigin(0, 0.5).setLetterSpacing(1);
    const w = 34 + t.width + 14;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.35).fillRoundedRect(x + 2, y + 4, w, h, h / 2);
    g.fillStyle(NAVY, 0.94).fillRoundedRect(x, y, w, h, h / 2);
    g.lineStyle(2, 0xffc42e, 1).strokeRoundedRect(x, y, w, h, h / 2);
    // medalla dorada con corona
    const mx = x + 16;
    const my = y + h / 2;
    g.fillStyle(0xffc42e, 1).fillCircle(mx, my, 10);
    g.fillStyle(0x0a1638, 1).fillPoints([{ x: mx - 6, y: my + 4 }, { x: mx - 7, y: my - 3 }, { x: mx - 3, y: my }, { x: mx, y: my - 5 }, { x: mx + 3, y: my }, { x: mx + 7, y: my - 3 }, { x: mx + 6, y: my + 4 }], true);
    t.setPosition(x + 32, my).setDepth(1);
  }

  /** ESTILOS DE COLOR: televisión con el personaje pintado; los que faltan se ganan en el PASE DE BATALLA. */
  private openColorDialog(skin: SkinId) {
    const p = getPlayer();
    const cur = charColorOf(p.equipped.color);
    const portrait = (x: number, y: number, size: number, id: CharColorId) => {
      const img = addPortrait(this, skin, x, y + size * 0.5, size * 1.05);
      if (!img) return this.add.circle(x, y, size / 2, charColorInfo(id).color, 1);
      applyCharColor(img, id, skin);
      return img;
    };
    const slots: PowerSlot[] = CHAR_COLOR_LIST.map((d) => ({
      name: d.name,
      desc: d.desc,
      owned: charColorOwned(p.owned, d.id),
      equipped: d.id === cur,
      // solo el personaje, grande y centrado en la televisión (previewOnly: `size` = alto disponible)
      preview: (x, y, size) => portrait(x, y, size * 0.95, d.id),
      thumb: (x, y, size) => portrait(x, y, size, d.id),
      onEquip: () => setCharColor(d.id),
    }));
    openPowerDialog(this, {
      title: 'COLOR DEL PERSONAJE',
      color: 0xff8fc4,
      previewOnly: true,
      slots,
      shopLabel: 'IR AL PASE',
      lockedNote: 'Se gana en el PASE DE BATALLA.',
      onShop: () => {
        this.cameras.main.fadeOut(180, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('BattlePass'));
      },
      onClose: ({ changed }) => {
        if (changed) this.scene.restart(); // al instante: la pantalla ya muestra lo que se equipó
      },
    });
  }

  /**
   * TEMPORAL: interruptor HOMBRE | MUJER para probar ambos personajes mientras no haya cuentas.
   * Guarda la skin en el perfil (se usa en menú, VS y partido). Quitar cuando exista selección real.
   */
  private sexToggle(right: number, cy: number, skin: SkinId) {
    // un personaje solo se puede elegir si es tuyo (Mai es premio del Pase de Batalla): si no, candado y aviso
    const owned = getPlayer().owned;
    const opts = CATALOG.map((s) => ({ id: s.id, name: s.name, label: s.sex === 'f' ? 'MUJER' : 'HOMBRE', has: owned.includes(`skin:${s.id}` as never) }));
    const segW = 104;
    const h = 50;
    const w = segW * opts.length;
    const x0 = right - w;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.35).fillRoundedRect(x0 + 3, cy - h / 2 + 5, w, h, h / 2);
    g.fillStyle(NAVY, 0.94).fillRoundedRect(x0, cy - h / 2, w, h, h / 2);
    g.lineStyle(3, NEON, 1).strokeRoundedRect(x0, cy - h / 2, w, h, h / 2);
    opts.forEach((o, i) => {
      const sx = x0 + i * segW;
      const active = o.id === skin;
      if (active) {
        g.fillStyle(NEON, 1).fillRoundedRect(sx + 4, cy - h / 2 + 4, segW - 8, h - 8, (h - 8) / 2);
        g.fillStyle(0x6fb2ff, 0.5).fillRoundedRect(sx + 8, cy - h / 2 + 6, segW - 16, (h - 8) * 0.4, { tl: 14, tr: 14, bl: 0, br: 0 });
      }
      this.add.text(sx + segW / 2 + (o.has ? 0 : 9), cy, o.label, { fontFamily: FONT, fontSize: '19px', color: active ? '#ffffff' : o.has ? '#7f93bf' : '#56688f' }).setOrigin(0.5);
      if (!o.has) {
        // candado a la izquierda del texto
        const lk = this.add.graphics({ x: sx + 17, y: cy });
        lk.lineStyle(3, 0x8ea3ce, 1).beginPath().arc(0, -3, 5, Math.PI, 0).strokePath();
        lk.fillStyle(0x8ea3ce, 1).fillRoundedRect(-7, -3, 14, 11, 3);
      }
      const hit = this.add.rectangle(sx + segW / 2, cy, segW, h, 0x000000, 0.001).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        if (active) return;
        if (!o.has) return this.toast(`${o.name} se desbloquea en el Pase de Batalla`);
        setSkin(o.id);
        this.scene.restart();
      });
    });
  }

  /** Nivel actual + barra de XP (sin números). */
  private levelCard(W: number, y: number, level: number, prog: number) {
    const x = 30;
    const w = W - 60;
    const h = 78;
    this.card(x, y, w, h);
    // medalla de nivel
    const mx = x + 58;
    const my = y + h / 2;
    const m = this.add.graphics();
    m.fillStyle(0x0a1638, 1).fillCircle(mx, my, 31);
    m.fillStyle(NEON, 1).fillCircle(mx, my, 28);
    m.fillStyle(0x6fb2ff, 1).fillCircle(mx, my - 5, 21);
    m.fillStyle(0x1f5fd6, 1).fillCircle(mx, my + 2, 21);
    this.add.text(mx, my, String(level), { fontFamily: FONT, fontSize: '28px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 4 }).setOrigin(0.5);

    const tx = mx + 48;
    const bw = x + w - 24 - tx;
    this.add.text(tx, y + 14, level >= MAX_LEVEL ? 'NIVEL MÁXIMO' : `NIVEL ${level}`, textStyle(22)).setOrigin(0, 0);
    this.add.text(x + w - 24, y + 18, `MÁX. ${MAX_LEVEL}`, textStyle(16, '#7f93bf')).setOrigin(1, 0);
    const by = y + 49;
    const bh = 14;
    const g = this.add.graphics();
    g.fillStyle(0x05112c, 1).fillRoundedRect(tx, by, bw, bh, bh / 2);
    g.lineStyle(1, 0x2a4a8a, 1).strokeRoundedRect(tx, by, bw, bh, bh / 2);
    const fill = this.add.graphics();
    const state = { v: 0 };
    const draw = () => {
      fill.clear();
      if (state.v <= 0) return;
      const fw = Math.max(bh, bw * state.v);
      fill.fillStyle(0x1f7bff, 1).fillRoundedRect(tx, by, fw, bh, bh / 2);
      fill.fillStyle(0x5fd0ff, 1).fillRoundedRect(tx, by, fw, bh * 0.5, { tl: bh / 2, tr: bh / 2, bl: 0, br: 0 });
      fill.fillStyle(0xffffff, 0.6).fillRoundedRect(tx + 4, by + 2, Math.max(0, fw - 8), 2, 1);
    };
    this.tweens.add({ targets: state, v: Phaser.Math.Clamp(prog, 0, 1), delay: 250, duration: 700, ease: 'Cubic.easeOut', onUpdate: draw });
  }

  /**
   * Contador de RAYOS (zone.rays) con el borde derecho en `right`, como los contadores de monedas / dinero del menú: rayo
   * amarillo + cifra. Tocarlo explica de dónde salen y en qué se gastan. Devuelve su ancho.
   */
  private raysPill(right: number, cy: number) {
    const rays = getPlayer().zone.rays;
    const h = 44;
    const t = this.add.text(0, cy, rays.toLocaleString('es-CL'), { fontFamily: FONT, fontSize: '24px', color: '#ffffff' }).setOrigin(1, 0.5);
    const w = Math.max(96, t.width + 70);
    const x0 = right - w;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.35).fillRoundedRect(x0 + 3, cy - h / 2 + 4, w, h, h / 2);
    g.fillStyle(NAVY, 0.95).fillRoundedRect(x0, cy - h / 2, w, h, h / 2);
    g.lineStyle(2.5, 0x45d9ff, 1).strokeRoundedRect(x0, cy - h / 2, w, h, h / 2);
    // rayo (mismo dibujo que el premio de Rayos del Pase de Batalla)
    const ic = this.add.graphics({ x: x0 + 26, y: cy });
    const bolt = [{ x: 3, y: -15 }, { x: -8, y: 2 }, { x: -1, y: 2 }, { x: -4, y: 15 }, { x: 8, y: -3 }, { x: 1, y: -3 }];
    ic.fillStyle(0x0a1638, 1).fillPoints(bolt.map((p) => ({ x: p.x + 1.5, y: p.y + 1.5 })), true);
    ic.fillStyle(0xffe14a, 1).fillPoints(bolt, true);
    t.setX(right - 16).setDepth(1);
    const hit = this.add.zone(x0 + w / 2, cy, w, h + 10).setInteractive({ useHandCursor: true });
    hit.on('pointerup', () => this.toast('RAYOS: se ganan en Ranked y en el Pase de Batalla · 1 rayo = +1% a un atributo de la ZONA'));
    return w;
  }

  /** Dos paneles debajo de las habilidades: INFERNO (poder elegido + selector) y ZONA (atributos). */
  private featureCards(W: number, top: number, h: number) {
    const left = gridCol(W, 0);
    const right = gridCol(W, 1);
    const w = left.w;
    this.infernoCard(left.x, top, w, h);
    const item = { x: right.x, title: 'ZONA', color: 0x45d9ff };
    {
      this.card(item.x, top, w, h, { line: item.color, glow: 0.24, r: 16 });
      const icon = this.add.graphics({ x: item.x + 34, y: top + 35 });
      icon.lineStyle(4, item.color, 0.5).strokeCircle(0, 0, 24);
      icon.lineStyle(4, item.color, 0.9).strokeCircle(0, 0, 16);
      icon.fillStyle(0xffffff, 1).fillCircle(0, 0, 7);
      const tx = item.x + 66;
      const tw = w - 76;
      // solo el título: lo que es la Zona y cómo funcionan los Rayos va en el (i)
      const title = this.add.text(tx, top + 35, item.title, { fontFamily: FONT, fontSize: '24px', color: '#75e7ff', stroke: '#061431', strokeThickness: 3 }).setOrigin(0, 0.5);
      title.setScale(Math.min(1, (tw - 44) / title.width));
      this.infoButton(item.x + w - 26, top + 35, () => this.zoneInfoDialog());
      {
        const zone = getPlayer().zone;
        // Rayos sin gastar: aviso dorado que late para que se usen (sin Rayos no se muestra nada)
        if (zone.rays > 0) {
          const pill = this.add.container(item.x + w / 2, top + 78);
          const pw = Math.min(w - 24, 210);
          const pg = this.add.graphics();
          pg.fillStyle(0x3a2400, 1).fillRoundedRect(-pw / 2 - 2, -16, pw + 4, 32, 16);
          pg.fillStyle(0xffc42e, 1).fillRoundedRect(-pw / 2, -14, pw, 28, 14);
          pg.fillStyle(0xffffff, 0.3).fillRoundedRect(-pw / 2 + 6, -12, pw - 12, 9, 5);
          const bolt = [{ x: 3, y: -11 }, { x: -6, y: 1 }, { x: 0, y: 1 }, { x: -3, y: 11 }, { x: 7, y: -2 }, { x: 1, y: -2 }];
          pg.fillStyle(0x3a2400, 1).fillPoints(bolt.map((q) => ({ x: q.x - pw / 2 + 20, y: q.y })), true);
          const pt = this.add.text(10, 0, `${zone.rays} ${zone.rays === 1 ? 'RAYO' : 'RAYOS'} PARA USAR`, { fontFamily: FONT, fontSize: '14px', color: '#3a2400' }).setOrigin(0.5);
          if (pt.width > pw - 44) pt.setScale((pw - 44) / pt.width);
          pill.add([pg, pt]);
          this.tweens.add({ targets: pill, scale: { from: 1, to: 1.07 }, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        }
        const labels: Record<ZoneStatKey, string> = { strength: 'FUERZA', speed: 'VELOCIDAD', precision: 'PRECISIÓN', agility: 'AGILIDAD', resistance: 'RESISTENCIA' };
        ZONE_STAT_KEYS.forEach((key, index) => {
          const level = zone.stats[key];
          const cy = top + 112 + index * 34;
          // fila: nombre | barra | n/20 | botón +, con aire entre columnas
          const lab = this.add.text(item.x + 14, cy, labels[key], { fontFamily: FONT, fontSize: '12px', color: '#e5f8ff' }).setOrigin(0, 0.5);
          if (lab.width > 84) lab.setScale(84 / lab.width);
          const bx = item.x + 106;
          const bw = Math.max(38, w - 106 - 80);
          const bar = this.add.graphics();
          bar.fillStyle(0x04132e, 1).fillRoundedRect(bx, cy - 6, bw, 12, 6);
          bar.lineStyle(1, 0x3472a2, 0.8).strokeRoundedRect(bx, cy - 6, bw, 12, 6);
          if (level > 0) {
            const fw = Math.max(12, (bw * level) / ZONE_STAT_MAX);
            bar.fillStyle(item.color, 1).fillRoundedRect(bx, cy - 6, fw, 12, 6);
            bar.fillStyle(0xffffff, 0.45).fillRoundedRect(bx + 3, cy - 4, Math.max(0, fw - 6), 3, 1);
          }
          this.add.text(item.x + w - 44, cy, `${level}/20`, { fontFamily: FONT, fontSize: '11px', color: '#b9d9f2' }).setOrigin(1, 0.5);
          const plusX = item.x + w - 24;
          const enabled = level < ZONE_STAT_MAX && zone.rays > 0;
          const plus = this.add.graphics({ x: plusX, y: cy }).setAlpha(enabled ? 1 : 0.42);
          plus.fillStyle(enabled ? item.color : 0x54637d, 1).fillCircle(0, 0, 13);
          plus.lineStyle(3, 0xffffff, 0.95).lineBetween(-6, 0, 6, 0).lineBetween(0, -6, 0, 6);
          // con Rayos para gastar, los + laten (invitan a mejorar)
          if (enabled) this.tweens.add({ targets: plus, scale: { from: 1, to: 1.18 }, duration: 600, delay: index * 90, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
          const hit = this.add.zone(plusX, cy, 40, 32).setInteractive({ useHandCursor: true });
          hit.on('pointerup', () => {
            const result = commit((state) => upgradeZoneStat(state, key));
            if (!result.ok) return this.toast(result.error === 'not_enough_rays' ? 'Gana Rayos en las recompensas semanales de Ranked' : 'Este atributo ya llegó al 20%');
            this.scene.restart();
          });
        });
      }
    }
  }

  /** Botón (i) redondo que abre una explicación. */
  private infoButton(x: number, y: number, onTap: () => void) {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.3).fillCircle(1, 3, 15);
    g.fillStyle(0x10224d, 1).fillCircle(0, 0, 15);
    g.lineStyle(2, 0xffffff, 0.9).strokeCircle(0, 0, 15);
    c.add([g, this.add.text(0, 1, 'i', { fontFamily: FONT, fontSize: '20px', color: '#ffffff' }).setOrigin(0.5)]);
    c.setSize(46, 46).setInteractive({ useHandCursor: true });
    c.on('pointerup', () => {
      this.tweens.add({ targets: c, scale: { from: 0.85, to: 1 }, duration: 180, ease: 'Back.easeOut' });
      onTap();
    });
    return c;
  }

  /** ZONA (i): qué es la Zona (estado de remontada), cuándo se activa y cómo se usan los Rayos. */
  private zoneInfoDialog() {
    const W = this.scale.width;
    const H = this.scale.height;
    const objs: Phaser.GameObjects.GameObject[] = [];
    const close = () => objs.forEach((o) => o.destroy());
    const shade = this.add.rectangle(0, 0, W, H, 0x02060f, 0.75).setOrigin(0).setDepth(8000).setInteractive();
    shade.on('pointerup', close);
    objs.push(shade);
    const pw = Math.min(600, W - 60);
    const text = [
      'La ZONA es tu estado de REMONTADA.',
      '',
      `Se activa una vez por partido cuando vas perdiendo por ${ZONE.lead} puntos (con al menos ${ZONE.minPoints} ganados) o vas 0-40 en un juego. Dura ${ZONE.durationPoints} puntos.`,
      '',
      'En Zona eres más rápido, golpeas más fuerte, llegas más lejos y resistes el ESPECIAL rival.',
      '',
      'RAYOS: los ganas jugando (Pase de Batalla y recompensas semanales de Ranked). Cada Rayo sube un atributo un 1 % mientras estás en Zona, hasta un 20 %. ¡Úsalos con los botones +!',
    ].join('\n');
    const body = this.add.text(0, 0, text, { fontFamily: FONT, fontSize: '19px', color: '#dbe5ff', align: 'center', lineSpacing: 4, wordWrap: { width: pw - 60 } }).setOrigin(0.5, 0);
    const ph = 100 + body.height + 120;
    const panel = this.add.container(W / 2, H / 2).setDepth(8001);
    objs.push(panel);
    panel.add(this.add.rectangle(0, 0, pw, ph, 0x000000, 0.001).setInteractive()); // tocar el panel no cierra
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.4).fillRoundedRect(-pw / 2 + 4, -ph / 2 + 8, pw, ph, 24);
    g.fillStyle(0x0b1a3d, 1).fillRoundedRect(-pw / 2, -ph / 2, pw, ph, 24);
    g.lineStyle(3, 0x45d9ff, 1).strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, 24);
    panel.add(g);
    panel.add(this.add.text(0, -ph / 2 + 48, 'ZONA', { fontFamily: FONT, fontSize: '34px', color: '#75e7ff', stroke: '#061431', strokeThickness: 6 }).setOrigin(0.5).setLetterSpacing(2));
    body.setPosition(0, -ph / 2 + 90);
    panel.add(body);
    panel.add(arcadeButton(this, 0, ph / 2 - 58, Math.min(300, pw - 80), 74, 'ENTENDIDO', close, { palette: 'yellow' }));
    panel.setScale(0.85).setAlpha(0);
    this.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
  }

  /**
   * ULTI: tarjeta especial con el poder EQUIPADO (bola animada en grande, con rayos de luz girando detrás, resplandor y
   * destellos), su nombre y descripción. Tocarla abre el diálogo de PODERES (openUltiDialog): ahí caben todas las ULTIs
   * (domain/infernoPowers.ts), también las que vengan después.
   */
  private infernoCard(x: number, top: number, w: number, h: number) {
    this.infernoBox?.destroy();
    const box = this.add.container(0, 0);
    this.infernoBox = box;
    const power = getProfile().inferno;
    const def = infernoPowerDef(power);
    box.add(this.card(x, top, w, h, { line: def.color, glow: 0.32, r: 16 }));
    // fondo morado de la ULTI (más claro arriba)
    const bg = this.add.graphics();
    bg.fillStyle(0x2a0c63, 0.85).fillRoundedRect(x + 3, top + 3, w - 6, h - 6, 14);
    bg.fillStyle(0x5a22b8, 0.55).fillRoundedRect(x + 3, top + 3, w - 6, h * 0.5, { tl: 14, tr: 14, bl: 6, br: 6 });
    bg.lineStyle(3, def.color, 1).strokeRoundedRect(x, top, w, h, 16);
    box.add(bg);

    // la bola equipada en grande, envuelta en un aura de energía: halo suave fijo + chispas de su color que brotan
    // del borde y suben desvaneciéndose (emisor de partículas: sin crear objetos por fotograma)
    const bx = x + w / 2;
    const by = top + 124;
    if (!this.textures.exists('ulti-aura-dot')) {
      const S = 32;
      const tex = this.textures.createCanvas('ulti-aura-dot', S, S);
      if (tex) {
        const ctx = tex.getContext();
        const grd = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
        grd.addColorStop(0, 'rgba(255,255,255,1)');
        grd.addColorStop(0.4, 'rgba(255,255,255,0.6)');
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, S, S);
        tex.refresh();
      }
    }
    const halo = this.add.graphics({ x: bx, y: by }).setBlendMode(Phaser.BlendModes.ADD);
    for (const [r, a] of [[64, 0.08], [52, 0.12], [42, 0.16]] as const) halo.fillStyle(def.color, a).fillCircle(0, 0, r);
    box.add(halo);
    const edge = new Phaser.Geom.Circle(0, 0, 40);
    const aura = this.add.particles(bx, by, 'ulti-aura-dot', {
      lifespan: { min: 600, max: 1100 },
      speed: { min: 14, max: 40 },
      speedY: { min: -60, max: -25 },
      scale: { start: 0.55, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: [def.color, def.color, 0xffffff],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 45,
      emitZone: { type: 'edge', source: edge, quantity: 24 },
    });
    box.add(aura);
    box.add(this.ballIcon(power, bx, by, 92, true));
    const spark: [number, number, number][] = [[0.14, 0.32, 7], [0.86, 0.3, 6], [0.8, 0.62, 7], [0.18, 0.66, 5]];
    spark.forEach(([fx, fy, r], i) => {
      const st = this.add.star(x + w * fx, top + h * fy, 4, r * 0.35, r, 0xffffff).setBlendMode(Phaser.BlendModes.ADD);
      box.add(st);
      this.tweens.add({ targets: st, alpha: { from: 0.1, to: 1 }, scale: { from: 0.5, to: 1.2 }, angle: 45, duration: 700 + i * 150, delay: i * 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    });

    // cabecera: icono, ULTI y el nombre de la bola
    box.add(this.purpleRacketIcon(x + 34, top + 35, 52));
    const tx = x + 66;
    const tw = w - 76;
    const title = this.add.text(tx, top + 18, 'ULTI', { fontFamily: FONT, fontSize: '20px', color: def.css, stroke: '#061431', strokeThickness: 3 }).setOrigin(0, 0);
    title.setScale(Math.min(1, tw / title.width));
    const name = this.add.text(tx, top + 43, def.ball, { fontFamily: FONT, fontSize: '14px', color: '#ffffff' }).setOrigin(0, 0).setLetterSpacing(1);
    name.setScale(Math.min(1, tw / name.width));
    const desc = this.add.text(x + w / 2, top + 184, def.desc, { fontFamily: FONT, fontSize: '13px', color: '#e2d4ff', align: 'center', wordWrap: { width: w - 24 } }).setOrigin(0.5, 0);
    const rule = this.add
      .text(x + w / 2, top + h - 34, `Se activa tras ${INFERNO.pointsToCharge} golpes ganadores`, { fontFamily: FONT, fontSize: '12px', color: '#ffe9a8' })
      .setOrigin(0.5, 1);
    if (rule.width > w - 16) rule.setScale((w - 16) / rule.width);
    const more = this.add.text(x + w - 14, top + h - 12, `${def.name} · PODERES ›`, { fontFamily: FONT, fontSize: '12px', color: '#c9a4ff' }).setOrigin(1, 1);
    if (more.width > w - 20) more.setScale((w - 20) / more.width);
    box.add([title, name, desc, rule, more]);

    const hit = this.add.zone(x + w / 2, top + h / 2, w, h).setInteractive({ useHandCursor: true });
    hit.on('pointerup', () => this.openUltiDialog());
    box.add(hit);
  }

  /** ULTI › PODERES: televisión con el poder elegido y todos los de la ULTI (los que no se tienen, con candado). */
  private openUltiDialog() {
    const p = getPlayer();
    const cur = getProfile().inferno;
    const slots: PowerSlot[] = INFERNO_POWERS.map((d) => ({
      name: d.name,
      desc: `${d.ball}. ${d.desc}`,
      owned: infernoOwned(p.owned, d.id, p.equipped.skin),
      equipped: d.id === cur,
      preview: (ix, iy, size) => this.ballIcon(d.id, ix, iy, size, true),
      thumb: (ix, iy, size) => this.ballIcon(d.id, ix, iy, size, false),
      onEquip: () => setInferno(d.id),
    }));
    openPowerDialog(this, {
      title: 'PODERES · ULTI',
      color: infernoPowerDef(cur).color,
      slots,
      special: true,
      onShop: () => {
        this.cameras.main.fadeOut(180, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Shop'));
      },
      onClose: ({ changed }) => {
        if (changed) this.scene.restart(); // al instante: la tarjeta ya muestra la ULTI equipada
      },
    });
  }

  /**
   * Icono del INFERNO en su tarjeta: el botón del SMASH (raqueta golpeando la pelota) en MORADO, el mismo que toma
   * el botón en el partido al cargar el INFERNO. `size` = diámetro del círculo visible.
   */
  private purpleRacketIcon(x: number, y: number, size: number) {
    const art = ABILITY_ART.smash!;
    const baked = bakeImage(this, art.key, 150);
    const key = baked ? hyperTexture(this, baked) : null;
    if (!baked) return this.add.circle(x, y, size / 2, 0x9a45ff, 1);
    const img = this.add.image(x, y, key ?? baked);
    if (!key) img.setTint(0xb46bff, 0xe0b0ff, 0x6a1fe0, 0x9a45ff); // sin filtros de canvas: tinte morado
    const { x0, y0, x1, y1 } = art.box;
    img.setOrigin((x0 + x1) / 2 / art.w, (y0 + y1) / 2 / art.h); // centro del círculo, no de la imagen
    img.setScale(size / (((y1 - y0) / art.h) * img.height));
    return img;
  }

  /** Bola de un poder: su hoja de sprites (animada si `animate`) o, si no cargó, un círculo de su color. */
  private ballIcon(power: InfernoPower, x: number, y: number, size: number, animate: boolean) {
    // con su rastro detrás si lo trae (tulipán); las alargadas caben a lo ancho del aro
    return addBallPreview(this, x, y, power, size, size, animate, infernoPowerDef(power).color);
  }

  /**
   * Tarjeta de media pantalla de la cuadrícula: caja, icono a la izquierda y nombre + descripción a su derecha.
   * `rightPad` = espacio libre a la derecha del nombre (p. ej. la píldora de recarga). Devuelve el origen del texto.
   */
  private gridCard(x: number, y: number, w: number, h: number, color: number, name: string, desc: string, rightPad = 0) {
    this.card(x, y, w, h, { line: color, glow: 0.2, r: 18 });
    const tx = x + 92;
    const title = this.add.text(tx, 0, name.toUpperCase(), textStyle(22)).setOrigin(0, 0);
    const maxTitleW = w - 92 - 14 - rightPad;
    if (title.width > maxTitleW) title.setScale(maxTitleW / title.width); // nombres largos ("CARGANDO GOLPE") se encogen
    const d = this.add
      .text(tx, 0, desc, { fontFamily: FONT, fontSize: '13px', color: '#b9cbef', wordWrap: { width: w - 92 - 14 } })
      .setOrigin(0, 0)
      .setLineSpacing(-2);
    // título + descripción como un bloque centrado en vertical, a la altura del icono (que va al centro de la tarjeta);
    // sin salirse por arriba (píldora de recarga) ni por abajo ("PODERES ›" / "EFECTOS ›")
    const gap = 6;
    const blockH = title.displayHeight + gap + d.height;
    const top = Phaser.Math.Clamp(y + h / 2 - blockH / 2, y + 10, y + h - 22 - blockH);
    title.setY(top);
    d.setY(top + title.displayHeight + gap);
    return tx;
  }

  /** Tarjeta de habilidad equipada: icono, nombre, recarga y descripción. */
  private abilityCard(W: number, y: number, h: number, col: 0 | 1, a: AbilityDef) {
    const { x, w } = gridCol(W, col);
    // el PODER equipado de la habilidad (DEFENSIVO: dash / destello; ESPECIAL: fuego / hielo / viento / rayo): su
    // descripción, su icono y su nombre en la tarjeta, para ver lo que se equipó en el diálogo
    const eq = getPlayer().equipped;
    const defPower = a.id === 'dash' ? defensivePowerDef(defensivePowerOf(eq.defensive)) : null;
    const smashEl = a.id === 'smash' ? smashPowerOf(eq.smash) : 'fire';
    const power = defPower ?? (a.id === 'smash' ? smashPowerDef(smashEl) : null);
    // recarga como píldora (arriba a la derecha); el nombre se encoge para no tocarla
    const cd = `${a.cooldown}s`;
    // con el poder de siempre (dash / fuego) se deja la descripción de la habilidad (dice también la duración del aturdido)
    const isDefault = !power || power.id === 'dash' || power.id === 'fire';
    this.gridCard(x, y, w, h, a.color, a.name, isDefault ? a.desc : power.desc, 78);
    // botón de la habilidad: imagen (assets/btn-<id>.png) si existe; si no, el icono dibujado
    // el SMASH con el color de su poder; el DEFENSIVO con el icono de su poder (el DASH, la imagen de siempre)
    if (defPower && defPower.id !== 'dash') {
      const g = this.add.graphics({ x: x + 48, y: y + h / 2 });
      drawDisc(g, 32, defPower.color, 0x1b3a6b);
      drawDefensiveIcon(g, defPower.id, 32);
    } else this.abilityIcon(a, x + 48, y + h / 2, 64, smashEl);
    // tocar la tarjeta abre el diálogo con los poderes de la habilidad (televisión + 10 huecos)
    const open = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
    open.on('pointerup', () => {
      // el DEFENSIVO (dash) tiene varios poderes: DASH y DESTELLO (domain/defensivePowers.ts)
      if (a.id === 'dash') return this.openDefensiveDialog(a);
      // el ESPECIAL (smash) también: FUEGO, HIELO, VIENTO y RAYO (domain/smashPowers.ts)
      if (a.id === 'smash') return this.openSmashDialog(a);
      openPowerDialog(this, {
        title: `PODERES · ${a.name.toUpperCase()}`,
        color: a.color,
        // hoy este poder tiene uno solo (el actual); los otros 9 huecos salen bloqueados
        slots: [{ name: a.name, desc: a.desc, owned: true, equipped: true, preview: (ix, iy, size) => this.abilityIcon(a, ix, iy, size) }],
      });
    });
    // el poder en uso delante (como "FUEGO · EFECTOS ›" en CARGANDO GOLPE)
    this.add.text(x + w - 14, y + h - 12, power ? `${power.name} · PODERES ›` : 'PODERES ›', { fontFamily: FONT, fontSize: '12px', color: '#8fb4ff' }).setOrigin(1, 1);
    const pill = this.add.text(x + w - 18, y + 16, cd, { fontFamily: FONT, fontSize: '14px', color: '#ffe9a8' }).setOrigin(1, 0);
    const pg = this.add.graphics();
    const px0 = pill.x - pill.width - 28;
    pg.fillStyle(0x0a1638, 1).fillRoundedRect(px0, y + 11, pill.width + 38, 26, 13);
    pg.lineStyle(2, 0xffc42e, 0.8).strokeRoundedRect(px0, y + 11, pill.width + 38, 26, 13);
    // reloj
    const cx = px0 + 14;
    pg.lineStyle(2, 0xffe9a8, 1).strokeCircle(cx, y + 24, 6);
    pg.lineBetween(cx, y + 24, cx, y + 20).lineBetween(cx, y + 24, cx + 3, y + 24);
    pill.setDepth(1);
  }

  /** ESPECIAL › PODERES: televisión con el poder del SMASH elegido y los disponibles (FUEGO, HIELO). Equipar refresca la pantalla. */
  private openSmashDialog(a: AbilityDef) {
    const p = getPlayer();
    const cur = smashPowerOf(p.equipped.smash);
    const slots: PowerSlot[] = SMASH_POWERS.map((d) => ({
      name: d.name,
      desc: d.desc,
      owned: smashOwned(p.owned, d.id),
      equipped: d.id === cur,
      preview: (ix, iy, size) => this.abilityIcon(a, ix, iy, size, d.id),
      onEquip: () => setSmash(d.id),
    }));
    openPowerDialog(this, {
      title: `PODERES · ${a.name.toUpperCase()}`,
      color: a.color,
      slots,
      onShop: () => {
        this.cameras.main.fadeOut(180, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Shop'));
      },
      onClose: ({ changed }) => {
        if (changed) this.scene.restart(); // al instante: la pantalla ya muestra lo que se equipó
      },
    });
  }

  /** DEFENSIVO › PODERES: televisión con el poder elegido y los disponibles (DASH, DESTELLO). */
  private openDefensiveDialog(a: AbilityDef) {
    const p = getPlayer();
    const cur = defensivePowerOf(p.equipped.defensive);
    const slots: PowerSlot[] = DEFENSIVE_POWERS.map((d) => ({
      name: d.name,
      desc: d.desc,
      owned: defensiveOwned(p.owned, d.id),
      equipped: d.id === cur,
      preview:
        d.id === 'dash'
          ? (ix, iy, size) => this.abilityIcon(a, ix, iy, size)
          : (ix, iy, size) => {
              const g = this.add.graphics({ x: ix, y: iy });
              drawDisc(g, size / 2, d.color, 0x1b3a6b);
              drawDefensiveIcon(g, d.id, size / 2);
              return g;
            },
      onEquip: () => setDefensive(d.id),
    }));
    openPowerDialog(this, {
      title: `PODERES · ${a.name.toUpperCase()}`,
      color: a.color,
      slots,
      onShop: () => {
        this.cameras.main.fadeOut(180, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Shop'));
      },
      // (faltaba) al equipar otro poder, la pantalla se rehace al instante y la tarjeta DEFENSIVO lo muestra
      onClose: ({ changed }) => {
        if (changed) this.scene.restart();
      },
    });
  }

  /** Botón de la habilidad centrado en (x, y), de `size` px de diámetro: la imagen del botón (assets/btn-<id>.png) o un disco dibujado. */
  private abilityIcon(a: AbilityDef, x: number, y: number, size: number, el: SmashPower = 'fire'): Phaser.GameObjects.GameObject {
    const art = ABILITY_ART[a.id];
    const baked = art ? bakeImage(this, art.key, 150) : null;
    if (art && baked) {
      // SMASH con otro poder (hielo): la misma imagen con el tono girado
      const img = this.add.image(x, y, el !== 'fire' && a.id === 'smash' ? elementTexture(this, baked, el) ?? baked : baked);
      const { x0, y0, x1, y1 } = art.box;
      img.setOrigin((x0 + x1) / 2 / art.w, (y0 + y1) / 2 / art.h); // centro del círculo, no de la imagen
      img.setScale(size / (((y1 - y0) / art.h) * img.height));
      return img;
    }
    const icon = this.add.graphics({ x, y });
    drawDisc(icon, size / 2, a.color, a.colorDark);
    drawAbilityIcon(icon, a.icon, size / 2);
    return icon;
  }

  /** CARGANDO GOLPE: televisión con el efecto de carga elegido y los 4 disponibles (clásico, fuego, energía, tulipán). */
  private openChargeDialog() {
    const p = getPlayer();
    const skin = p.equipped.skin;
    const cur = chargeFxOf(p.equipped.charge, skin);
    const slots: PowerSlot[] = CHARGE_FX.map((d) => ({
      name: d.name,
      desc: d.desc,
      owned: chargeFxOwned(p.owned, d.id, skin),
      equipped: d.id === cur,
      preview: (x, y, size) => this.chargePreview(d.id, x, y, size),
      thumb: (x, y, size) => this.chargePreview(d.id, x, y + 18, size * 1.1),
      onEquip: () => setCharge(d.id),
    }));
    openPowerDialog(this, {
      title: 'EFECTOS · CARGANDO GOLPE',
      color: PASSIVES.charge.color,
      slots,
      layout: 'side',
      onShop: () => {
        this.cameras.main.fadeOut(180, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Shop'));
      },
      onClose: ({ changed }) => {
        if (changed) this.scene.restart(); // al instante: la pantalla ya muestra lo que se equipó
      },
    });
  }

  private chargePreview(id: ChargeFxId, x: number, y: number, size: number): Phaser.GameObjects.GameObject {
    return chargePreview(this, id, x, y, size);
  }

  private toast(msg: string) {
    const W = this.scale.width;
    const H = this.scale.height;
    const t = this.add.text(W / 2, H * 0.5, msg, { ...textStyle(22), align: 'center', wordWrap: { width: W - 80 } }).setOrigin(0.5).setDepth(9000).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, y: t.y - 20, duration: 200 });
    this.tweens.add({ targets: t, alpha: 0, delay: 1400, duration: 300, onComplete: () => t.destroy() });
  }
}
