import Phaser from 'phaser';
import { Button } from '../ui/Button';
import { C, drawBackground, restartOnResize, textStyle } from '../ui/theme';
import { Character, PLAYER_LOOK } from '../objects/Character';
import { MAX_LEVEL } from '../config';
import { getProfile } from '../logic/Profile';
import { ABILITIES, AbilityDef, SHOP_PREVIEW } from '../logic/Abilities';
import { LevelBadge } from '../ui/LevelBadge';
import { drawAbilityIcon, drawDisc } from '../ui/icons';

/**
 * Personalizar (versión simple): personaje, estilo, nivel y habilidades equipadas.
 * Las habilidades bloqueadas anuncian la futura tienda.
 */
export class CustomizeScene extends Phaser.Scene {
  constructor() {
    super('Customize');
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    restartOnResize(this);
    this.cameras.main.fadeIn(200, 0, 0, 0);
    drawBackground(this, false);
    const p = getProfile();
    const top = Math.max(0, (H - 1280) / 2); // centra el contenido en pantallas altas

    this.add.text(W / 2, top + 64, 'PERSONALIZAR', textStyle(58, '#ffd23f')).setOrigin(0.5);

    // --- Tarjeta del personaje
    const cy = top + 130;
    this.panel(W / 2, cy, W - 60, 380, C.blue, C.blueDark);
    const ped = this.add.graphics();
    ped.fillStyle(C.outline).fillEllipse(W / 2 - 160, cy + 332, 210, 60);
    ped.fillStyle(C.green).fillEllipse(W / 2 - 160, cy + 327, 196, 46);
    const hero = new Character(this, W / 2 - 165, cy + 332, PLAYER_LOOK, 'front').setScale(2);
    this.time.addEvent({ delay: 2200, loop: true, callback: () => hero.swing() });

    const ix = W / 2 + 10;
    this.add.text(ix, cy + 50, p.name, textStyle(40)).setOrigin(0, 0.5);
    new LevelBadge(this, ix + 30, cy + 112, 210).set(p.level, p.xp);
    this.add.text(ix, cy + 156, `Nivel 1 a ${MAX_LEVEL}`, textStyle(20, '#cfe0ff')).setOrigin(0, 0.5);

    // Estilo
    this.add.text(ix, cy + 202, 'ESTILO', textStyle(24, '#ffe9a8')).setOrigin(0, 0.5);
    this.add.text(ix, cy + 238, p.style, textStyle(30)).setOrigin(0, 0.5);
    const swatches = [PLAYER_LOOK.shirt, C.red, C.green, C.yellow];
    swatches.forEach((col, i) => {
      const sx = ix + 22 + i * 56;
      const sy = cy + 292;
      const g = this.add.graphics({ x: sx, y: sy });
      g.fillStyle(C.outline).fillRoundedRect(-22, -22, 44, 44, 10);
      g.fillStyle(col).fillRoundedRect(-17, -17, 34, 34, 8);
      if (i === 0) g.lineStyle(4, 0xffffff).strokeRoundedRect(-26, -26, 52, 52, 12);
      else {
        g.fillStyle(0x000000, 0.45).fillRoundedRect(-17, -17, 34, 34, 8);
        drawAbilityIcon(g, 'lock', 14);
      }
    });
    this.add.text(ix, cy + 340, 'Más estilos próximamente', textStyle(18, '#cfe0ff')).setOrigin(0, 0.5);

    // --- Habilidades equipadas
    const ay = cy + 420;
    this.add.text(W / 2, ay, 'HABILIDADES', textStyle(36, '#ffd23f')).setOrigin(0.5);
    p.abilities.forEach((id, i) => this.abilityCard(W / 2, ay + 85 + i * 138, W - 60, ABILITIES[id], i + 1));

    // --- Tienda (próximamente)
    const sy = ay + 330;
    this.add.text(W / 2, sy, 'TIENDA · PRÓXIMAMENTE', textStyle(28, '#ffe9a8')).setOrigin(0.5);
    const n = SHOP_PREVIEW.length;
    SHOP_PREVIEW.forEach((id, i) => {
      const a = ABILITIES[id];
      const x = W / 2 + (i - (n - 1) / 2) * 180;
      const g = this.add.graphics({ x, y: sy + 78 });
      drawDisc(g, 40, a.color, a.colorDark);
      drawAbilityIcon(g, a.icon, 40);
      this.add.text(x, sy + 136, a.name, textStyle(22)).setOrigin(0.5);
      // precio con moneda
      const coin = this.add.graphics({ x: x - 34, y: sy + 164 });
      coin.fillStyle(C.outline).fillCircle(0, 0, 11);
      coin.fillStyle(C.yellow).fillCircle(0, 0, 8);
      coin.fillStyle(C.yellowDark).fillRect(-1.5, -4, 3, 8);
      this.add.text(x - 18, sy + 164, String(a.price), textStyle(18, '#ffd23f')).setOrigin(0, 0.5);
    });
    this.add.text(W / 2, sy + 200, 'Podrás comprar habilidades nuevas y equiparlas', textStyle(18, '#cfe0ff')).setOrigin(0.5);

    // --- Botones
    const by = Math.max(sy + 285, H - 90);
    new Button(this, W * 0.27, by, 240, 84, 'Volver', C.grey, C.greyDark, () => this.scene.start('Menu'), 34);
    new Button(this, W * 0.72, by, 300, 96, 'JUGAR', C.yellow, C.yellowDark, () => this.scene.start('Matchmaking'), 48).pulse();
  }

  private panel(x: number, y: number, w: number, h: number, color: number, dark: number) {
    const g = this.add.graphics();
    g.fillStyle(C.outline).fillRoundedRect(x - w / 2 - 6, y - 6, w + 12, h + 18, 30);
    g.fillStyle(dark).fillRoundedRect(x - w / 2, y + 6, w, h, 24);
    g.fillStyle(color).fillRoundedRect(x - w / 2, y, w, h, 24);
    g.fillStyle(0xffffff, 0.18).fillRoundedRect(x - w / 2 + 14, y + 10, w - 28, 40, 16);
    return g;
  }

  private abilityCard(x: number, y: number, w: number, a: AbilityDef, slot: number) {
    const h = 120;
    const g = this.add.graphics();
    g.fillStyle(C.outline).fillRoundedRect(x - w / 2 - 5, y - h / 2 - 5, w + 10, h + 14, 24);
    g.fillStyle(0x2a1f4d).fillRoundedRect(x - w / 2, y - h / 2 + 4, w, h, 20);
    g.fillStyle(0x3a2d66).fillRoundedRect(x - w / 2, y - h / 2, w, h, 20);
    const icon = this.add.graphics({ x: x - w / 2 + 72, y });
    drawDisc(icon, 42, a.color, a.colorDark);
    drawAbilityIcon(icon, a.icon, 42);
    const tx = x - w / 2 + 138;
    this.add.text(tx, y - 32, `${slot}. ${a.name.toUpperCase()}`, textStyle(30)).setOrigin(0, 0.5);
    this.add.text(x + w / 2 - 20, y - 32, `Recarga ${a.cooldown}s`, textStyle(20, '#ffe9a8')).setOrigin(1, 0.5);
    this.add
      .text(tx, y + 18, a.desc, { ...textStyle(19, '#e6e0ff'), align: 'left', wordWrap: { width: w - 160 }, strokeThickness: 4 })
      .setOrigin(0, 0.5);
  }
}
