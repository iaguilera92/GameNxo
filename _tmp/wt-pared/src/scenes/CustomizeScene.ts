import Phaser from 'phaser';
import { FONT, restartOnResize, textStyle } from '../ui/theme';
import { stadiumBg } from '../ui/ui';
import { Character, playerLook } from '../objects/Character';
import { MAX_LEVEL } from '../config';
import { getProfile, levelProgress, setSkin } from '../logic/Profile';
import { CATALOG, skinById } from '../characters/catalog';
import { addPortrait } from '../characters/portrait';
import type { SkinId } from '../characters/skins';
import { ABILITIES, type AbilityDef, type AbilityId } from '../logic/Abilities';
import { bakeImage } from '../ui/bakeImage';
import { drawAbilityIcon, drawDisc } from '../ui/icons';
import { roundedPoly } from '../ui/shapes';
import { playButton } from '../ui/modeButtons';
import { commit, getPlayer } from '../domain/playerStore';
import { equipStyle } from '../domain/operations';
import { type StyleId, itemId, owns } from '../domain/player';
import { shopItem } from '../domain/shopCatalog';

/** Estilos (colores) que se muestran. Datos de tienda (precio/nivel) en domain/shopCatalog. */
const STYLES: { id: StyleId; name: string; color: number; dark: number }[] = [
  { id: 'classic', name: 'CLÁSICO', color: 0x3a8bff, dark: 0x1a4fb0 },
  { id: 'red', name: 'ROJO', color: 0xff4f5e, dark: 0xb3202f },
  { id: 'green', name: 'VERDE', color: 0x62d935, dark: 0x2f8f14 },
  { id: 'gold', name: 'ORO', color: 0xffc42e, dark: 0xc98600 },
];

/** Arte de los botones de habilidad. `box` = círculo visible en px de la imagen (sin margen transparente). */
const ABILITY_ART: Partial<Record<AbilityId, { key: string; file: string; w: number; h: number; box: { x0: number; y0: number; x1: number; y1: number } }>> = {
  dash: { key: 'btn-dash', file: 'assets/btn-dash.png', w: 1312, h: 1199, box: { x0: 144, y0: 99, x1: 1146, y1: 1122 } },
  smash: { key: 'btn-smash', file: 'assets/btn-smash.png', w: 1312, h: 1199, box: { x0: 153, y0: 105, x1: 1134, y1: 1116 } },
};

const NAVY = 0x0b1733;
const NEON = 0x3a7bff;

/**
 * Pantalla PERSONAJE (vertical): vitrina del personaje, nivel + XP, estilos y habilidades.
 * Mientras no haya base de datos el personaje es siempre Nxo (logic/Profile FORCED_SKIN).
 */
export class CustomizeScene extends Phaser.Scene {
  constructor() {
    super('Customize');
  }

  preload() {
    if (!this.textures.exists('menu-bg')) this.load.image('menu-bg', 'assets/menu-bg.png');
    for (const art of Object.values(ABILITY_ART)) if (art && !this.textures.exists(art.key)) this.load.image(art.key, art.file);
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    restartOnResize(this);
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
    const title = this.add.text(W / 2, headY, 'PERSONALIZACIÓN', { fontFamily: FONT, fontSize: '42px', color: '#ffffff' }).setOrigin(0.5).setLetterSpacing(2);
    // que no choque con el botón volver (borde derecho del botón ≈ 86 px)
    const maxTitleW = W - 2 * 100;
    if (title.width > maxTitleW) title.setScale(maxTitleW / title.width);

    // reparto vertical (de arriba abajo, medidas fijas); la vitrina usa lo que sobra
    const TOP = 110;
    const L = { gapHero: 22, level: 96, gapA: 40, titleToRow: 34, styles: 118, gapB: 44, titleToCard: 34, ability: 104, abilityGap: 14, gapC: 30, play: 104, bottom: 34 };
    const below =
      L.gapHero + L.level + L.gapA + L.titleToRow + L.styles + L.gapB + L.titleToCard + L.ability * 2 + L.abilityGap + L.gapC + L.play + L.bottom;
    const free = H - TOP - below;
    const heroH = Phaser.Math.Clamp(free, 300, 560);
    const extra = Math.max(0, free - heroH); // pantallas muy altas: aire repartido arriba y antes de JUGAR

    // ---------------------------------------------------------------- vitrina
    const feetY = TOP + extra * 0.5 + heroH;
    this.showcase(W, TOP, feetY, heroH, p.skin as SkinId);

    // ---------------------------------------------------------------- nivel + XP
    let y = feetY + L.gapHero;
    this.levelCard(W, y, p.level, levelProgress(p));
    y += L.level + L.gapA;

    // ---------------------------------------------------------------- estilos
    this.sectionTitle(W, y, 'ESTILO');
    this.styleRow(W, y + L.titleToRow);
    y += L.titleToRow + L.styles + L.gapB;

    // ---------------------------------------------------------------- habilidades
    this.sectionTitle(W, y, 'HABILIDADES');
    p.abilities.forEach((id, i) => this.abilityCard(W, y + L.titleToCard + i * (L.ability + L.abilityGap), ABILITIES[id], i + 1));
    y += L.titleToCard + L.ability * 2 + L.abilityGap + L.gapC + extra * 0.5;

    // ---------------------------------------------------------------- JUGAR
    const playH = L.play;
    const playY = y + playH / 2;
    playButton(this, W / 2, playY, Math.min(520, W - 120), playH, () => {
      this.cameras.main.fadeOut(180, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Matchmaking'));
    });
  }

  // ================================================================ piezas

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
  private showcase(W: number, top: number, feetY: number, heroH: number, skin: SkinId) {
    const cx = W / 2;
    // haz de luz detrás
    const beam = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    beam.fillStyle(NEON, 0.1).fillTriangle(cx - 60, top, cx + 60, top, cx + 230, feetY);
    beam.fillTriangle(cx - 60, top, cx - 230, feetY, cx + 230, feetY);
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
  }

  /**
   * TEMPORAL: interruptor HOMBRE | MUJER para probar ambos personajes mientras no haya cuentas.
   * Guarda la skin en el perfil (se usa en menú, VS y partido). Quitar cuando exista selección real.
   */
  private sexToggle(right: number, cy: number, skin: SkinId) {
    const opts = CATALOG.map((s) => ({ id: s.id, label: s.sex === 'f' ? 'MUJER' : 'HOMBRE' }));
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
      this.add.text(sx + segW / 2, cy, o.label, { fontFamily: FONT, fontSize: '19px', color: active ? '#ffffff' : '#7f93bf' }).setOrigin(0.5);
      const hit = this.add.rectangle(sx + segW / 2, cy, segW, h, 0x000000, 0.001).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        if (active) return;
        setSkin(o.id);
        this.scene.restart();
      });
    });
  }

  /** Nivel actual + barra de XP (sin números). */
  private levelCard(W: number, y: number, level: number, prog: number) {
    const x = 30;
    const w = W - 60;
    const h = 96;
    this.card(x, y, w, h);
    // medalla de nivel
    const mx = x + 58;
    const my = y + h / 2;
    const m = this.add.graphics();
    m.fillStyle(0x0a1638, 1).fillCircle(mx, my, 38);
    m.fillStyle(NEON, 1).fillCircle(mx, my, 34);
    m.fillStyle(0x6fb2ff, 1).fillCircle(mx, my - 6, 26);
    m.fillStyle(0x1f5fd6, 1).fillCircle(mx, my + 2, 26);
    this.add.text(mx, my, String(level), { fontFamily: FONT, fontSize: '34px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 5 }).setOrigin(0.5);

    const tx = mx + 56;
    const bw = x + w - 24 - tx;
    this.add.text(tx, y + 22, level >= MAX_LEVEL ? 'NIVEL MÁXIMO' : `NIVEL ${level}`, textStyle(24)).setOrigin(0, 0);
    this.add.text(x + w - 24, y + 26, `MÁX. ${MAX_LEVEL}`, textStyle(16, '#7f93bf')).setOrigin(1, 0);
    const by = y + 60;
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

  /** Fila de estilos: el equipado resaltado, los no comprados con candado y nivel requerido. */
  private styleRow(W: number, top: number) {
    const s = getPlayer();
    const n = STYLES.length;
    const gap = 14;
    const cw = (W - 60 - gap * (n - 1)) / n;
    const ch = 118;
    STYLES.forEach((st, i) => {
      const x = 30 + i * (cw + gap);
      const has = owns(s, itemId.style(st.id));
      const equipped = s.equipped.style === st.id;
      const c = this.add.container(0, 0);
      c.add(this.card(x, top, cw, ch, { line: equipped ? 0xffffff : has ? NEON : 0x2c3d66, glow: equipped ? 0.3 : 0, r: 16 }));
      // muestra de color
      const sw = this.add.graphics();
      const sx = x + cw / 2;
      const sy = top + 46;
      sw.fillStyle(0x0a1638, 1).fillRoundedRect(sx - 30, sy - 30, 60, 60, 14);
      sw.fillStyle(st.dark, 1).fillRoundedRect(sx - 26, sy - 26, 52, 52, 12);
      sw.fillStyle(st.color, 1).fillRoundedRect(sx - 26, sy - 26, 52, 40, 12);
      sw.fillStyle(0xffffff, 0.3).fillRoundedRect(sx - 20, sy - 22, 40, 8, 4);
      c.add(sw);
      if (!has) {
        sw.setAlpha(0.45);
        const lk = this.add.graphics({ x: sx, y: sy });
        lk.lineStyle(4, 0xdbe5ff).beginPath().arc(0, -4, 9, Math.PI, 0).strokePath();
        lk.fillStyle(0xdbe5ff).fillRoundedRect(-13, -4, 26, 20, 5);
        lk.fillStyle(0x0a1638).fillCircle(0, 5, 3);
        c.add(lk);
      }
      const item = shopItem(itemId.style(st.id));
      const sub = equipped ? 'EN USO' : has ? 'USAR' : `NV ${item?.minLevel ?? 1}`;
      c.add(this.add.text(sx, top + 92, st.name, { fontFamily: FONT, fontSize: '18px', color: has ? '#ffffff' : '#8d99b5' }).setOrigin(0.5));
      c.add(this.add.text(sx, top + 110, sub, { fontFamily: FONT, fontSize: '13px', color: equipped ? '#9fe8a0' : '#7f93bf' }).setOrigin(0.5));

      const hit = this.add.rectangle(x + cw / 2, top + ch / 2, cw, ch, 0x000000, 0.001).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        this.tweens.add({ targets: c, scale: { from: 0.97, to: 1 }, duration: 160 });
        if (equipped) return;
        if (has) {
          commit((st0) => equipStyle(st0, st.id));
          this.scene.restart();
        } else this.toast(`Desbloquea ${st.name.toLowerCase()} en la Tienda (próximamente)`);
      });
    });
  }

  /** Tarjeta de habilidad equipada: icono, nombre, recarga y descripción. */
  private abilityCard(W: number, y: number, a: AbilityDef, slot: number) {
    const x = 30;
    const w = W - 60;
    const h = 104;
    this.card(x, y, w, h, { line: a.color, glow: 0.2, r: 18 });
    // número de ranura
    const sb = this.add.graphics();
    sb.fillStyle(a.color, 1).fillRoundedRect(x + 14, y - 12, 34, 26, 8);
    this.add.text(x + 31, y + 1, String(slot), { fontFamily: FONT, fontSize: '18px', color: '#ffffff' }).setOrigin(0.5);
    // botón de la habilidad: imagen (assets/btn-<id>.png) si existe; si no, el icono dibujado
    const art = ABILITY_ART[a.id];
    const baked = art ? bakeImage(this, art.key, 150) : null;
    if (art && baked) {
      const img = this.add.image(x + 66, y + h / 2, baked);
      const { x0, y0, x1, y1 } = art.box;
      img.setOrigin((x0 + x1) / 2 / art.w, (y0 + y1) / 2 / art.h); // centro del círculo, no de la imagen
      img.setScale(84 / (((y1 - y0) / art.h) * img.height)); // el círculo visible mide ~84 px
    } else {
      const icon = this.add.graphics({ x: x + 66, y: y + h / 2 });
      drawDisc(icon, 36, a.color, a.colorDark);
      drawAbilityIcon(icon, a.icon, 36);
    }
    const tx = x + 120;
    this.add.text(tx, y + 18, a.name.toUpperCase(), textStyle(26)).setOrigin(0, 0);
    // recarga como píldora
    const cd = `${a.cooldown}s`;
    const pill = this.add.text(x + w - 22, y + 24, cd, { fontFamily: FONT, fontSize: '17px', color: '#ffe9a8' }).setOrigin(1, 0);
    const pg = this.add.graphics();
    pg.fillStyle(0x0a1638, 1).fillRoundedRect(pill.x - pill.width - 30, y + 18, pill.width + 42, 30, 15);
    pg.lineStyle(2, 0xffc42e, 0.8).strokeRoundedRect(pill.x - pill.width - 30, y + 18, pill.width + 42, 30, 15);
    // reloj
    pg.lineStyle(2, 0xffe9a8, 1).strokeCircle(pill.x - pill.width - 14, y + 33, 7);
    pg.lineBetween(pill.x - pill.width - 14, y + 33, pill.x - pill.width - 14, y + 28).lineBetween(pill.x - pill.width - 14, y + 33, pill.x - pill.width - 10, y + 33);
    pill.setDepth(1);
    this.add
      .text(tx, y + 54, a.desc, { fontFamily: FONT, fontSize: '17px', color: '#b9cbef', wordWrap: { width: w - 140 } })
      .setOrigin(0, 0)
      .setLineSpacing(-2);
  }

  private toast(msg: string) {
    const W = this.scale.width;
    const H = this.scale.height;
    const t = this.add.text(W / 2, H * 0.5, msg, { ...textStyle(22), align: 'center', wordWrap: { width: W - 80 } }).setOrigin(0.5).setDepth(9000).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, y: t.y - 20, duration: 200 });
    this.tweens.add({ targets: t, alpha: 0, delay: 1400, duration: 300, onComplete: () => t.destroy() });
  }
}
