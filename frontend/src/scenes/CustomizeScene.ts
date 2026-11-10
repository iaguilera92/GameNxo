import Phaser from 'phaser';
import { FONT, restartOnResize, textStyle } from '../ui/theme';
import { stadiumBg } from '../ui/ui';
import { Character, playerLook } from '../objects/Character';
import { MAX_LEVEL } from '../config';
import { getProfile, levelProgress, setInferno, setSkin } from '../logic/Profile';
import { CATALOG, skinById } from '../characters/catalog';
import { addPortrait } from '../characters/portrait';
import type { SkinId } from '../characters/skins';
import { ABILITIES, type AbilityDef, type AbilityId } from '../logic/Abilities';
import { bakeImage } from '../ui/bakeImage';
import { drawAbilityIcon, drawDisc } from '../ui/icons';
import { roundedPoly } from '../ui/shapes';
import { playButton } from '../ui/modeButtons';
import { hyperTexture } from '../ui/AbilityButton';
import { BUTTON_ART } from '../ui/buttonArt';
import { commit, getPlayer } from '../domain/playerStore';
import { upgradeZoneStat } from '../domain/operations';
import { ZONE_STAT_KEYS, ZONE_STAT_MAX, type ZoneStatKey } from '../domain/zoneProgress';
import { INFERNO_POWERS, infernoPowerDef, type InfernoPower } from '../domain/infernoPowers';
import { BALL_ART, ensureBallAnims, queueInfernoArt } from '../fx/InfernoFx';

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
  // saque con efecto (botón morado del saque): la pelota curva hacia el lado que apuntas
  spin: {
    name: 'Efecto pelota',
    desc: 'Saque con efecto: la pelota curva hacia el lado que apuntas.',
    color: 0x8a6bff,
    colorDark: 0x4a35b8,
    art: BUTTON_ART.spin.key,
    draw: (g, R) => drawAbilityIcon(g, 'serveSpin', R),
  },
  // golpe cargado: se mantiene para cargar (arco azul que pasa a dorado); con el joystick sale cortita, globo o cruzado
  charge: {
    name: 'Cargando golpe',
    desc: 'Mantén para cargar más fuerza. Con el joystick: cortita, globo o cruzado.',
    color: 0x2f9bff,
    colorDark: 0x1a5fb4,
    draw: (g, R) => {
      // arco semicircular segmentado (como el medidor del partido): azul y los últimos tramos en dorado
      const n = 7;
      for (let i = 0; i < n; i++) {
        const a0 = Math.PI + (i / n) * Math.PI + 0.06;
        const a1 = Math.PI + ((i + 1) / n) * Math.PI - 0.06;
        g.lineStyle(R * 0.2, i >= n - 2 ? 0xffc72e : 0xffffff, 1).beginPath().arc(0, R * 0.32, R * 0.68, a0, a1).strokePath();
      }
      // pelota en el centro del arco, con su destello
      g.fillStyle(0x0a1638).fillCircle(0, R * 0.32, R * 0.3);
      g.fillStyle(0xd7f53a).fillCircle(0, R * 0.32, R * 0.23);
      g.lineStyle(2, 0xffffff, 0.9).beginPath().arc(-R * 0.06, R * 0.32, R * 0.16, -0.9, 0.9).strokePath();
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
    for (const art of Object.values(ABILITY_ART)) if (art && !this.textures.exists(art.key)) this.load.image(art.key, art.file);
    queueInfernoArt(this.load); // bolas de los poderes del INFERNO (vista previa del selector)
    if (!this.textures.exists(BUTTON_ART.spin.key)) this.load.image(BUTTON_ART.spin.key, BUTTON_ART.spin.file); // icono de EFECTO PELOTA
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
    const title = this.add.text(W / 2, headY, 'PERSONALIZACIÓN', { fontFamily: FONT, fontSize: '42px', color: '#ffffff' }).setOrigin(0.5).setLetterSpacing(2);
    // que no choque con el botón volver (borde derecho del botón ≈ 86 px)
    const maxTitleW = W - 2 * 100;
    if (title.width > maxTitleW) title.setScale(maxTitleW / title.width);

    // reparto vertical (de arriba abajo, medidas fijas); la vitrina usa lo que sobra
    const TOP = 110;
    // cuadrícula de 3 filas × 2 columnas, todas con la misma separación (GRID_GAP): fila 1 EFECTO PELOTA | CARGANDO GOLPE,
    // fila 2 las dos habilidades equipadas (DASH | SMASH), fila 3 INFERNO | ZONA
    const L = { gapHero: 22, level: 96, gapA: 26, titleToCard: 28, ability: 104, abilityGap: GRID_GAP, gapFeatures: GRID_GAP, features: 190, gapC: 22, play: 96, bottom: 28 };
    const below =
      L.gapHero + L.level + L.gapA + L.titleToCard + L.ability * 2 + L.abilityGap + L.gapFeatures + L.features + L.gapC + L.play + L.bottom;
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

    // ---------------------------------------------------------------- habilidades
    this.sectionTitle(W, y, 'HABILIDADES');
    const row1 = y + L.titleToCard;
    const row2 = row1 + L.ability + L.abilityGap;
    this.passiveCard(W, row1, L.ability, 0, PASSIVES.spin);
    this.passiveCard(W, row1, L.ability, 1, PASSIVES.charge);
    p.abilities.forEach((id, i) => this.abilityCard(W, row2, L.ability, i as 0 | 1, ABILITIES[id], i + 1));
    y += L.titleToCard + L.ability * 2 + L.abilityGap + L.gapFeatures;
    this.featureCards(W, y, L.features);
    y += L.features + L.gapC + extra * 0.5;

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

  /** Dos paneles debajo de las habilidades: INFERNO (poder elegido + selector) y ZONA (atributos). */
  private featureCards(W: number, top: number, h: number) {
    const left = gridCol(W, 0);
    const right = gridCol(W, 1);
    const w = left.w;
    this.infernoCard(left.x, top, w, h);
    const item = { x: right.x, title: 'ZONA', subtitle: 'ESTADO DE REMONTADA', color: 0x45d9ff };
    {
      this.card(item.x, top, w, h, { line: item.color, glow: 0.24, r: 16 });
      const icon = this.add.graphics({ x: item.x + 34, y: top + 35 });
      icon.lineStyle(4, item.color, 0.5).strokeCircle(0, 0, 24);
      icon.lineStyle(4, item.color, 0.9).strokeCircle(0, 0, 16);
      icon.fillStyle(0xffffff, 1).fillCircle(0, 0, 7);
      const tx = item.x + 66;
      const tw = w - 76;
      const title = this.add.text(tx, top + 18, item.title, { fontFamily: FONT, fontSize: '20px', color: '#75e7ff', stroke: '#061431', strokeThickness: 3 }).setOrigin(0, 0);
      title.setScale(Math.min(1, tw / title.width));
      const subtitle = this.add.text(tx, top + 43, item.subtitle, { fontFamily: FONT, fontSize: '12px', color: '#d4e5ff', letterSpacing: 0.5 }).setOrigin(0, 0);
      subtitle.setScale(Math.min(1, tw / subtitle.width));
      {
        const zone = getPlayer().zone;
        this.add.text(item.x + w / 2, top + 65, `RAYOS ${zone.rays}  ·  1 RAYO = +1%`, { fontFamily: FONT, fontSize: '11px', color: '#91eaff' }).setOrigin(0.5);
        const labels: Record<ZoneStatKey, string> = { strength: 'FUERZA', speed: 'VELOCIDAD', precision: 'PRECISIÓN', agility: 'AGILIDAD', resistance: 'RESISTENCIA' };
        ZONE_STAT_KEYS.forEach((key, index) => {
          const level = zone.stats[key];
          const cy = top + 86 + index * 19;
          this.add.text(item.x + 12, cy, labels[key], { fontFamily: FONT, fontSize: '11px', color: '#e5f8ff' }).setOrigin(0, 0.5);
          const bx = item.x + 98;
          const bw = Math.max(38, w - 168);
          const bar = this.add.graphics();
          bar.fillStyle(0x04132e, 1).fillRoundedRect(bx, cy - 4, bw, 8, 4);
          bar.lineStyle(1, 0x3472a2, 0.8).strokeRoundedRect(bx, cy - 4, bw, 8, 4);
          if (level > 0) {
            const fw = bw * level / ZONE_STAT_MAX;
            bar.fillStyle(item.color, 1).fillRoundedRect(bx, cy - 4, fw, 8, 4);
            bar.fillStyle(0xffffff, 0.45).fillRoundedRect(bx + 2, cy - 3, Math.max(0, fw - 4), 2, 1);
          }
          this.add.text(bx + bw + 5, cy, `${level}/20`, { fontFamily: FONT, fontSize: '10px', color: '#b9d9f2' }).setOrigin(0, 0.5);
          const plusX = item.x + w - 18;
          const enabled = level < ZONE_STAT_MAX && zone.rays > 0;
          const plus = this.add.graphics({ x: plusX, y: cy }).setAlpha(enabled ? 1 : 0.42);
          plus.fillStyle(enabled ? item.color : 0x54637d, 1).fillCircle(0, 0, 9);
          plus.lineStyle(2, 0xffffff, 0.95).lineBetween(-4, 0, 4, 0).lineBetween(0, -4, 0, 4);
          const hit = this.add.zone(plusX, cy, 28, 20).setInteractive({ useHandCursor: true });
          hit.on('pointerup', () => {
            const result = commit((state) => upgradeZoneStat(state, key));
            if (!result.ok) return this.toast(result.error === 'not_enough_rays' ? 'Gana Rayos en las recompensas semanales de Ranked' : 'Este atributo ya llegó al 20%');
            this.scene.restart();
          });
        });
      }
    }
  }

  /**
   * INFERNO: el poder elegido (bola animada, nombre y descripción) y debajo el selector con los cuatro poderes
   * (domain/infernoPowers.ts). Tocar uno lo equipa al momento y la tarjeta se redibuja (sin reiniciar la escena).
   */
  private infernoCard(x: number, top: number, w: number, h: number) {
    this.infernoBox?.destroy();
    const box = this.add.container(0, 0);
    this.infernoBox = box;
    const power = getProfile().inferno;
    const def = infernoPowerDef(power);
    box.add(this.card(x, top, w, h, { line: def.color, glow: 0.24, r: 16 }));
    box.add(this.purpleRacketIcon(x + 34, top + 35, 52));
    const tx = x + 66;
    const tw = w - 76;
    const title = this.add.text(tx, top + 18, 'INFERNO', { fontFamily: FONT, fontSize: '20px', color: def.css, stroke: '#061431', strokeThickness: 3 }).setOrigin(0, 0);
    title.setScale(Math.min(1, tw / title.width));
    const name = this.add.text(tx, top + 43, def.ball, { fontFamily: FONT, fontSize: '14px', color: '#ffffff' }).setOrigin(0, 0).setLetterSpacing(1);
    name.setScale(Math.min(1, tw / name.width));
    const desc = this.add.text(x + w / 2, top + 70, def.desc, { fontFamily: FONT, fontSize: '13px', color: '#c3d4f2', align: 'center', wordWrap: { width: w - 24 } }).setOrigin(0.5, 0);
    box.add([title, name, desc]);

    // selector: los cuatro poderes en fila; el elegido con aro de su color, animado y con su nombre resaltado
    const slotW = (w - 16) / INFERNO_POWERS.length;
    const cy = top + 126;
    INFERNO_POWERS.forEach((p, i) => {
      const cx = x + 8 + slotW * (i + 0.5);
      const on = p.id === power;
      const ring = this.add.graphics();
      if (on) ring.lineStyle(8, p.color, 0.25).strokeCircle(cx, cy, 27);
      ring.fillStyle(0x05112c, 0.9).fillCircle(cx, cy, 25);
      ring.lineStyle(on ? 3 : 2, on ? p.color : 0x2a4a8a, 1).strokeCircle(cx, cy, 25);
      const ball = this.ballIcon(p.id, cx, cy, 46, on).setAlpha(on ? 1 : 0.55);
      const label = this.add.text(cx, cy + 33, p.name, { fontFamily: FONT, fontSize: '11px', color: on ? p.css : '#8ea3ce' }).setOrigin(0.5, 0);
      if (label.width > slotW - 4) label.setScale((slotW - 4) / label.width);
      const hit = this.add.zone(cx, cy + 8, slotW, 72).setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => {
        if (on) return;
        setInferno(p.id);
        // se redibuja en el siguiente fotograma (no se destruye la zona tocada dentro de su propio evento)
        this.time.delayedCall(0, () => this.infernoCard(x, top, w, h));
      });
      box.add([ring, ball, label, hit]);
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
    const art = BALL_ART[power];
    if (this.textures.exists(art.key)) {
      const s = this.add.sprite(x, y, art.key, 0).setDisplaySize(size, size);
      if (animate && this.anims.exists(art.anim)) s.play(art.anim);
      return s;
    }
    return this.add.circle(x, y, size * 0.3, infernoPowerDef(power).color, 1);
  }

  /**
   * Tarjeta de media pantalla de la cuadrícula: caja, icono a la izquierda y nombre + descripción a su derecha.
   * `rightPad` = espacio libre a la derecha del nombre (p. ej. la píldora de recarga). Devuelve el origen del texto.
   */
  private gridCard(x: number, y: number, w: number, h: number, color: number, name: string, desc: string, rightPad = 0) {
    this.card(x, y, w, h, { line: color, glow: 0.2, r: 18 });
    const tx = x + 92;
    const title = this.add.text(tx, y + 13, name.toUpperCase(), textStyle(22)).setOrigin(0, 0);
    const maxTitleW = w - 92 - 14 - rightPad;
    if (title.width > maxTitleW) title.setScale(maxTitleW / title.width); // nombres largos ("CARGANDO GOLPE") se encogen
    this.add
      .text(tx, y + 44, desc, { fontFamily: FONT, fontSize: '13px', color: '#b9cbef', wordWrap: { width: w - 92 - 14 } })
      .setOrigin(0, 0)
      .setLineSpacing(-2);
    return tx;
  }

  /** Tarjeta de habilidad equipada: número de ranura, icono, nombre, recarga y descripción. */
  private abilityCard(W: number, y: number, h: number, col: 0 | 1, a: AbilityDef, slot: number) {
    const { x, w } = gridCol(W, col);
    // recarga como píldora (arriba a la derecha); el nombre se encoge para no tocarla
    const cd = `${a.cooldown}s`;
    this.gridCard(x, y, w, h, a.color, a.name, a.desc, 78);
    // número de ranura
    const sb = this.add.graphics();
    sb.fillStyle(a.color, 1).fillRoundedRect(x + 14, y - 12, 34, 26, 8);
    this.add.text(x + 31, y + 1, String(slot), { fontFamily: FONT, fontSize: '18px', color: '#ffffff' }).setOrigin(0.5);
    // botón de la habilidad: imagen (assets/btn-<id>.png) si existe; si no, el icono dibujado
    const art = ABILITY_ART[a.id];
    const baked = art ? bakeImage(this, art.key, 150) : null;
    if (art && baked) {
      const img = this.add.image(x + 48, y + h / 2, baked);
      const { x0, y0, x1, y1 } = art.box;
      img.setOrigin((x0 + x1) / 2 / art.w, (y0 + y1) / 2 / art.h); // centro del círculo, no de la imagen
      img.setScale(64 / (((y1 - y0) / art.h) * img.height)); // el círculo visible mide ~64 px
    } else {
      const icon = this.add.graphics({ x: x + 48, y: y + h / 2 });
      drawDisc(icon, 28, a.color, a.colorDark);
      drawAbilityIcon(icon, a.icon, 28);
    }
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

  /**
   * Tarjeta de una habilidad pasiva del personaje (sin recarga ni ranura): EFECTO PELOTA y CARGANDO GOLPE.
   * Su icono es el del botón del partido (saque con efecto) o un disco con el arco de carga.
   */
  private passiveCard(W: number, y: number, h: number, col: 0 | 1, def: PassiveDef) {
    const { x, w } = gridCol(W, col);
    this.gridCard(x, y, w, h, def.color, def.name, def.desc);
    const cx = x + 48;
    const cy = y + h / 2;
    const art = def.art ? this.textures.exists(def.art) : false;
    if (def.art && art) {
      this.add.image(cx, cy, def.art).setDisplaySize(64, 64);
      return;
    }
    const icon = this.add.graphics({ x: cx, y: cy });
    drawDisc(icon, 28, def.color, def.colorDark);
    def.draw?.(icon, 28);
  }

  private toast(msg: string) {
    const W = this.scale.width;
    const H = this.scale.height;
    const t = this.add.text(W / 2, H * 0.5, msg, { ...textStyle(22), align: 'center', wordWrap: { width: W - 80 } }).setOrigin(0.5).setDepth(9000).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, y: t.y - 20, duration: 200 });
    this.tweens.add({ targets: t, alpha: 0, delay: 1400, duration: 300, onComplete: () => t.destroy() });
  }
}
