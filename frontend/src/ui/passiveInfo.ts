import Phaser from 'phaser';
import { FONT } from './theme';
import { arcadeButton } from './modeButtons';
import { CATALOG } from '../characters/catalog';
import { MASTERY, type PassiveId, masteryLevel, passiveOf } from '../domain/characterPassives';

/**
 * Piezas visuales de la PASIVA de un personaje (docs/MAESTRIAS.md): el icono y el diálogo de información. Los usan PERSONALIZAR (barra de
 * maestría) y el Pase de Batalla (premio de personaje), así que el texto y el aspecto son los mismos en los dos sitios.
 */

/** Nombre visible de un personaje (el id si no está en el catálogo). */
export function skinName(skin: string): string {
  return CATALOG.find((c) => c.id === skin)?.name ?? skin.charAt(0).toUpperCase() + skin.slice(1); // (Jun aún no está en el catálogo)
}

/** Icono de la pasiva centrado en (0, 0) del Graphics, de radio `r`: AGILIDAD = flechas de velocidad, PRECISIÓN = mira, FUERZA = pesa. */
export function drawPassiveIcon(g: Phaser.GameObjects.Graphics, id: PassiveId, r: number, color: number) {
  if (id === 'agility') {
    g.lineStyle(Math.max(2.5, r * 0.28), color, 1);
    for (const dx of [-r * 0.5, r * 0.05, r * 0.6]) {
      g.beginPath().moveTo(dx - r * 0.3, -r * 0.55).lineTo(dx + r * 0.25, 0).lineTo(dx - r * 0.3, r * 0.55).strokePath();
    }
  } else if (id === 'strength') {
    // FUERZA: una pesa (barra con dos discos a cada lado)
    g.lineStyle(Math.max(2.5, r * 0.26), color, 1).lineBetween(-r * 0.7, 0, r * 0.7, 0);
    g.fillStyle(color, 1)
      .fillRoundedRect(-r * 1.02, -r * 0.62, r * 0.36, r * 1.24, r * 0.1)
      .fillRoundedRect(r * 0.66, -r * 0.62, r * 0.36, r * 1.24, r * 0.1)
      .fillRoundedRect(-r * 0.68, -r * 0.4, r * 0.22, r * 0.8, r * 0.08)
      .fillRoundedRect(r * 0.46, -r * 0.4, r * 0.22, r * 0.8, r * 0.08);
  } else if (id === 'resistance') {
    // RESISTENCIA: una batería que se recarga (con un rayo)
    g.lineStyle(Math.max(2.5, r * 0.2), color, 1).strokeRoundedRect(-r * 0.95, -r * 0.55, r * 1.7, r * 1.1, r * 0.15);
    g.fillStyle(color, 1).fillRect(r * 0.78, -r * 0.25, r * 0.22, r * 0.5);
    g.fillTriangle(r * 0.1, -r * 0.45, -r * 0.45, r * 0.08, -r * 0.05, r * 0.08).fillTriangle(-r * 0.15, r * 0.45, r * 0.4, -r * 0.08, 0, -r * 0.08);
  } else if (id === 'spin') {
    // EFECTO: una pelota con una curva que la rodea
    g.fillStyle(color, 1).fillCircle(r * 0.35, r * 0.1, r * 0.42);
    g.lineStyle(Math.max(2.5, r * 0.22), color, 1).beginPath().arc(0, 0, r * 0.95, Math.PI * 0.75, Math.PI * 1.95, false).strokePath();
    g.fillTriangle(r * 0.95, -r * 0.55, r * 1.05, r * 0.05, r * 0.55, -r * 0.15);
  } else {
    g.lineStyle(Math.max(2, r * 0.2), color, 1).strokeCircle(0, 0, r * 0.82);
    g.lineStyle(Math.max(2, r * 0.2), color, 1).strokeCircle(0, 0, r * 0.4);
    g.lineStyle(Math.max(2, r * 0.2), color, 1).lineBetween(-r * 1.05, 0, -r * 0.55, 0).lineBetween(r * 0.55, 0, r * 1.05, 0).lineBetween(0, -r * 1.05, 0, -r * 0.55).lineBetween(0, r * 0.55, 0, r * 1.05);
    g.fillStyle(color, 1).fillCircle(0, 0, r * 0.14);
  }
}

/** Texto de "cómo se sube" (el mismo en PERSONALIZAR y en el Pase). */
export function masteryHowTo(skin: string): string {
  return `Gana partidos con ${skinName(skin)}: cada victoria suma 1 maestría. Se suman desde el nivel ${MASTERY.unlockLevel} de tu cuenta. Cada nivel de maestría da un 1 % más, hasta un ${MASTERY.maxLevel} % en el nivel ${MASTERY.maxLevel}.`;
}

/**
 * Diálogo con el detalle de la pasiva de un personaje: qué mejora, cuánto vale cada nivel (1 a 10) y cómo se sube. Con `points` (las
 * maestrías del jugador con ese personaje) marca su nivel actual; sin él (Pase de Batalla: aún no es tuyo) solo explica. Se cierra con ENTENDIDO o tocando fuera.
 */
export function openPassiveDialog(scene: Phaser.Scene, skin: string, opts: { points?: number } = {}) {
  const def = passiveOf(skin);
  if (!def) return;
  const W = scene.scale.width;
  const H = scene.scale.height;
  const objs: Phaser.GameObjects.GameObject[] = [];
  const close = () => objs.forEach((o) => o.destroy());
  const shade = scene.add.rectangle(0, 0, W, H, 0x02060f, 0.75).setOrigin(0).setDepth(8000).setInteractive();
  shade.on('pointerup', close);
  objs.push(shade);
  const pw = Math.min(600, W - 60);
  const text = [def.short, '', def.detail, '', masteryHowTo(skin)].join('\n');
  const body = scene.add.text(0, 0, text, { fontFamily: FONT, fontSize: '19px', color: '#dbe5ff', align: 'center', lineSpacing: 4, wordWrap: { width: pw - 60 } }).setOrigin(0.5, 0);
  const chipsH = 74;
  const ph = 130 + body.height + chipsH + 110;
  const panel = scene.add.container(W / 2, H / 2).setDepth(8001);
  objs.push(panel);
  panel.add(scene.add.rectangle(0, 0, pw, ph, 0x000000, 0.001).setInteractive()); // tocar el panel no cierra
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.4).fillRoundedRect(-pw / 2 + 4, -ph / 2 + 8, pw, ph, 24);
  g.fillStyle(0x0b1a3d, 1).fillRoundedRect(-pw / 2, -ph / 2, pw, ph, 24);
  g.lineStyle(3, def.color, 1).strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, 24);
  panel.add(g);
  const ic = scene.add.graphics({ x: -pw / 2 + 56, y: -ph / 2 + 48 });
  ic.fillStyle(0x07152f, 1).fillCircle(0, 0, 28).lineStyle(3, def.color, 1).strokeCircle(0, 0, 28);
  drawPassiveIcon(ic, def.id, 16, def.color);
  panel.add(ic);
  panel.add(scene.add.text(0, -ph / 2 + 40, def.name, { fontFamily: FONT, fontSize: '34px', color: def.css, stroke: '#061431', strokeThickness: 6 }).setOrigin(0.5).setLetterSpacing(2));
  panel.add(scene.add.text(0, -ph / 2 + 72, `PASIVA DE ${skinName(skin).toUpperCase()}`, { fontFamily: FONT, fontSize: '15px', color: '#9fb4e0' }).setOrigin(0.5).setLetterSpacing(2));
  body.setPosition(0, -ph / 2 + 100);
  panel.add(body);

  // los 10 niveles: 1 % … 10 %; el del jugador (si se conoce) va resaltado y los que ya tiene, rellenos
  const cur = opts.points === undefined ? 0 : masteryLevel(opts.points);
  const gap = 6;
  const cw = (pw - 60 - gap * (MASTERY.maxLevel - 1)) / MASTERY.maxLevel;
  const cy = -ph / 2 + 100 + body.height + 28;
  const chips = scene.add.graphics();
  for (let i = 1; i <= MASTERY.maxLevel; i++) {
    const x = -pw / 2 + 30 + (i - 1) * (cw + gap);
    const have = i <= cur;
    chips.fillStyle(have ? def.color : 0x10224d, have ? 0.9 : 1).fillRoundedRect(x, cy, cw, 34, 8);
    chips.lineStyle(i === cur ? 3 : 1.5, i === cur ? 0xffd23f : 0x2c3d66, 1).strokeRoundedRect(x, cy, cw, 34, 8);
    panel.add(scene.add.text(x + cw / 2, cy + 17, `${i}%`, { fontFamily: FONT, fontSize: '14px', color: have ? '#06122e' : '#9fb4e0' }).setOrigin(0.5));
  }
  panel.add(chips);
  panel.add(scene.add.text(0, cy + 52, opts.points === undefined ? 'NIVELES DE MAESTRÍA' : `TU NIVEL: ${cur} · +${cur} %`, { fontFamily: FONT, fontSize: '14px', color: '#ffd23f' }).setOrigin(0.5).setLetterSpacing(1));
  panel.add(arcadeButton(scene, 0, ph / 2 - 58, Math.min(300, pw - 80), 74, 'ENTENDIDO', close, { palette: 'yellow' }));
  panel.setScale(0.85).setAlpha(0);
  scene.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
}
