import Phaser from 'phaser';
import { FONT } from './theme';
import { roundedPoly } from './shapes';
import { Character, type CharacterLook } from '../objects/Character';
import { addPortrait } from '../characters/portrait';
import type { SkinId } from '../characters/skins';

/**
 * Pantalla VS (vertical, estilo juego de pelea): pantalla partida en diagonal, TÚ arriba en azul
 * y RIVAL abajo en rojo, personajes grandes, placas de nombre/nivel y un VS dorado con impacto.
 * Solo presentación: la escena que la llama decide cuándo pasar al partido.
 */
export interface VersusSide {
  name: string;
  level: number;
  look: CharacterLook;
  /** skin para usar su retrato estático si existe (solo el jugador) */
  portraitSkin?: SkinId;
  /** victorias totales: se muestran bajo la placa con un trofeo. 0 o sin dato = no se muestra nada */
  wins?: number;
}

const BLUE = { main: 0x2f7bff, deep: 0x0b2a78, glow: 0x6fb2ff, text: '#9fd0ff' };
const RED = { main: 0xff3b4e, deep: 0x6e0c1c, glow: 0xff8a96, text: '#ffb3ba' };

export function showVersus(scene: Phaser.Scene, player: VersusSide, rival: VersusSide) {
  const W = scene.scale.width;
  const H = scene.scale.height;
  // línea diagonal que parte la pantalla (sube hacia la derecha)
  const yL = H * 0.56;
  const yR = H * 0.44;
  const midY = (yL + yR) / 2;

  // ---------------------------------------------------------------- mitades de color
  const half = (top: boolean) => {
    const pal = top ? BLUE : RED;
    const c = scene.add.container(top ? -W : W, 0).setDepth(2);
    const g = scene.add.graphics();
    const poly = top
      ? [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: yR }, { x: 0, y: yL }]
      : [{ x: 0, y: yL }, { x: W, y: yR }, { x: W, y: H }, { x: 0, y: H }];
    g.fillStyle(pal.deep, 0.88).fillPoints(poly, true);
    // degradado: banda más clara junto a la diagonal
    const band = top
      ? [{ x: 0, y: yL - H * 0.16 }, { x: W, y: yR - H * 0.16 }, { x: W, y: yR }, { x: 0, y: yL }]
      : [{ x: 0, y: yL }, { x: W, y: yR }, { x: W, y: yR + H * 0.16 }, { x: 0, y: yL + H * 0.16 }];
    g.fillStyle(pal.main, 0.28).fillPoints(band, true);
    c.add(g);

    // líneas de velocidad (se redibujan cada fotograma)
    const lines = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    c.add(lines);
    const streaks = Array.from({ length: 22 }, () => ({
      x: Math.random() * W,
      y: top ? Math.random() * (yR - 30) : yL + 30 + Math.random() * (H - yL - 30),
      len: 80 + Math.random() * 220,
      v: 900 + Math.random() * 900,
      a: 0.05 + Math.random() * 0.12,
    }));
    const dir = top ? 1 : -1;
    const ev = scene.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        lines.clear();
        for (const s of streaks) {
          s.x += (dir * s.v) / 60;
          if (dir > 0 && s.x - s.len > W) s.x = -10;
          if (dir < 0 && s.x + s.len < 0) s.x = W + 10;
          lines.lineStyle(3, pal.glow, s.a).lineBetween(s.x, s.y, s.x - dir * s.len, s.y);
        }
      },
    });
    c.once(Phaser.GameObjects.Events.DESTROY, () => ev.remove());
    scene.tweens.add({ targets: c, x: 0, duration: 380, ease: 'Cubic.easeOut' });
    return c;
  };
  half(true);
  half(false);

  // ---------------------------------------------------------------- personajes
  const fighter = (side: VersusSide, top: boolean) => {
    const x = top ? W * 0.33 : W * 0.67;
    const feetY = top ? yL - H * 0.04 : H - Math.max(24, H * 0.03);
    const height = Math.min(H * 0.4, 560);
    const fromX = top ? -W * 0.5 : W * 1.5;
    // sombra en el suelo
    const sh = scene.add.ellipse(x, feetY, height * 0.62, height * 0.1, 0x000000, 0.4).setDepth(4).setAlpha(0);
    scene.tweens.add({ targets: sh, alpha: 1, delay: 300, duration: 300 });
    const portrait = side.portraitSkin ? addPortrait(scene, side.portraitSkin, fromX, feetY + 6, height) : undefined;
    const obj: Phaser.GameObjects.Image | Character =
      portrait ?? new Character(scene, fromX, feetY, side.look, 'front').setScale(height / 150);
    obj.setDepth(5);
    // el rival (abajo a la derecha) mira hacia la izquierda, hacia el jugador
    if (!top && obj instanceof Character) obj.facing = -1;
    if (!top && portrait) portrait.setFlipX(true);
    scene.tweens.add({ targets: obj, x, delay: 140, duration: 520, ease: 'Back.easeOut', easeParams: [1.2] });
    // respiración
    scene.tweens.add({ targets: obj, y: obj.y - 6, delay: 700, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    if (obj instanceof Character) scene.time.delayedCall(800, () => obj.swing());
  };
  fighter(player, true);
  fighter(rival, false);

  // ---------------------------------------------------------------- placas de nombre
  const plate = (side: VersusSide, top: boolean) => {
    const pal = top ? BLUE : RED;
    const pw = Math.min(330, W * 0.46);
    const ph = 132;
    const x = top ? W - pw / 2 - 20 : pw / 2 + 20;
    const y = top ? H * 0.2 : H * 0.72;
    const c = scene.add.container(top ? W + pw : -pw, y).setDepth(8);
    const k = 18;
    const shape = roundedPoly([[-pw / 2 + k, -ph / 2], [pw / 2, -ph / 2], [pw / 2 - k, ph / 2], [-pw / 2, ph / 2]], 14);
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.4).fillPoints(shape.map((p) => ({ x: p.x + 4, y: p.y + 7 })), true);
    g.lineStyle(10, pal.main, 0.22).strokePoints(shape, true, true);
    g.fillStyle(0x0a1430, 0.95).fillPoints(shape, true);
    g.lineStyle(3, pal.main, 1).strokePoints(shape, true, true);
    c.add(g);
    // etiqueta TÚ / RIVAL
    const tw = 104;
    const tag = scene.add.graphics();
    const tagPts = roundedPoly([[-tw / 2 + 8, -16], [tw / 2, -16], [tw / 2 - 8, 16], [-tw / 2, 16]], 7);
    tag.fillStyle(pal.main, 1).fillPoints(tagPts, true);
    tag.setPosition(-pw / 2 + tw / 2 + 18, -ph / 2);
    c.add(tag);
    c.add(
      scene.add
        .text(-pw / 2 + tw / 2 + 18, -ph / 2, top ? 'TÚ' : 'RIVAL', { fontFamily: FONT, fontSize: '22px', color: '#ffffff' })
        .setOrigin(0.5)
        .setLetterSpacing(2),
    );
    // nombre (se reduce si es largo)
    const name = scene.add
      .text(0, -10, side.name.toUpperCase(), { fontFamily: FONT, fontSize: '40px', color: '#ffffff', stroke: '#050b1c', strokeThickness: 6 })
      .setOrigin(0.5);
    if (name.width > pw - 40) name.setScale((pw - 40) / name.width);
    c.add(name);
    // nivel
    const lv = scene.add.graphics();
    lv.fillStyle(pal.deep, 1).fillRoundedRect(-62, 22, 124, 32, 16);
    lv.lineStyle(2, pal.main, 1).strokeRoundedRect(-62, 22, 124, 32, 16);
    c.add(lv);
    c.add(scene.add.text(0, 38, `NIVEL ${side.level}`, { fontFamily: FONT, fontSize: '20px', color: pal.text }).setOrigin(0.5).setLetterSpacing(1));
    scene.tweens.add({ targets: c, x, delay: 260, duration: 460, ease: 'Back.easeOut' });
    if (side.wins && side.wins > 0) winsBadge(scene, c, ph, side.wins);
  };
  plate(player, true);
  plate(rival, false);

  // ---------------------------------------------------------------- corte diagonal + VS
  const slash = scene.add.graphics().setDepth(10).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
  slash.lineStyle(26, 0xffffff, 0.12).lineBetween(0, yL, W, yR);
  slash.lineStyle(12, 0xffe08a, 0.35).lineBetween(0, yL, W, yR);
  slash.lineStyle(4, 0xffffff, 1).lineBetween(0, yL, W, yR);

  // detrás del VS: disco oscuro con aro dorado (sin rayos giratorios) + ondas de choque al impactar
  const burst = scene.add.graphics({ x: W / 2, y: midY }).setDepth(11).setScale(0);
  burst.fillStyle(0x0a0f24, 0.85).fillCircle(0, 0, 118);
  burst.lineStyle(6, 0xffc42e, 1).strokeCircle(0, 0, 118);
  burst.lineStyle(2, 0xfff1b8, 0.8).strokeCircle(0, 0, 106);
  const ring = (delay: number) => {
    const r = scene.add.circle(W / 2, midY, 120, 0xffffff, 0).setStrokeStyle(8, 0xffe08a, 1).setDepth(11).setAlpha(0);
    scene.tweens.add({ targets: r, alpha: { from: 0.9, to: 0 }, scale: { from: 1, to: 2.6 }, delay, duration: 520, ease: 'Cubic.easeOut', onComplete: () => r.destroy() });
  };

  const vs = scene.add
    .text(W / 2, midY, 'VS', { fontFamily: FONT, fontSize: '170px', color: '#ffc42e', stroke: '#1a0f00', strokeThickness: 14 })
    .setOrigin(0.5)
    .setDepth(12)
    .setAngle(-8)
    .setScale(3.2)
    .setAlpha(0)
    .setShadow(0, 8, '#000000', 0, true, false);
  // degradado dorado en el texto
  const grad = vs.context.createLinearGradient(0, 0, 0, vs.height);
  grad.addColorStop(0.15, '#fff6c8');
  grad.addColorStop(0.5, '#ffc42e');
  grad.addColorStop(0.9, '#e07b00');
  vs.setFill(grad);

  const impactAt = 520;
  scene.tweens.add({ targets: slash, alpha: 1, delay: impactAt - 120, duration: 160 });
  scene.tweens.add({
    targets: vs,
    scale: 1,
    alpha: 1,
    delay: impactAt,
    duration: 260,
    ease: 'Back.easeOut',
    onComplete: () => {
      scene.cameras.main.shake(220, 0.012);
      const f = scene.add.rectangle(0, 0, W, H, 0xffffff, 0.45).setOrigin(0).setDepth(30);
      scene.tweens.add({ targets: f, alpha: 0, duration: 260, onComplete: () => f.destroy() });
      scene.tweens.add({ targets: vs, scale: 1.06, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    },
  });
  scene.tweens.add({ targets: burst, scale: 1, delay: impactAt + 60, duration: 300, ease: 'Back.easeOut' });
  ring(impactAt + 60);
  ring(impactAt + 200);

  // sonido de la presentación, completo, desde que empieza el VS
  if (scene.cache.audio.exists('vs')) scene.sound.play('vs', { volume: 0.9 });

  // destello de entrada
  const flash = scene.add.rectangle(0, 0, W, H, 0xffffff, 0).setOrigin(0).setDepth(50);
  scene.tweens.add({ targets: flash, alpha: { from: 0.55, to: 0 }, duration: 300 });
}

/**
 * Insignia dorada de victorias bajo la placa del nombre: trofeo + número que cuenta hacia arriba + "VICTORIAS".
 * Entra con un pequeño golpe al terminar de llegar la placa y luego brilla con un destello que la recorre.
 */
function winsBadge(scene: Phaser.Scene, plate: Phaser.GameObjects.Container, ph: number, wins: number) {
  const label = wins === 1 ? 'VICTORIA' : 'VICTORIAS';
  const b = scene.add.container(0, ph / 2 + 30).setScale(0);
  plate.add(b);
  const num = scene.add.text(0, 0, '0', { fontFamily: FONT, fontSize: '26px', color: '#3a2200' }).setOrigin(0, 0.5);
  const txt = scene.add.text(0, 1, label, { fontFamily: FONT, fontSize: '17px', color: '#5a3600' }).setOrigin(0, 0.5).setLetterSpacing(1);
  // ancho según el número final (para que la pastilla no cambie de tamaño mientras cuenta)
  num.setText(wins.toLocaleString('es-CL'));
  const iconW = 30;
  const gap = 8;
  const w = 26 + iconW + gap + num.width + 7 + txt.width + 24;
  const h = 40;
  num.setText('0');
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.35).fillRoundedRect(-w / 2 + 3, -h / 2 + 5, w, h, h / 2);
  g.fillStyle(0x7a4a00, 1).fillRoundedRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6, (h + 6) / 2);
  g.fillStyle(0xffc42e, 1).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  g.fillStyle(0xfff1b8, 0.55).fillRoundedRect(-w / 2 + 6, -h / 2 + 3, w - 12, h * 0.4, h * 0.2);
  b.add(g);
  // trofeo dibujado (copa, asas, pie)
  const x0 = -w / 2 + 26;
  const cup = scene.add.graphics({ x: x0 + iconW / 2 - 6, y: 0 });
  cup.lineStyle(3, 0x5a3600, 1);
  cup.beginPath().arc(-8, -5, 5, Math.PI * 0.5, Math.PI * 1.5).strokePath();
  cup.beginPath().arc(8, -5, 5, -Math.PI * 0.5, Math.PI * 0.5).strokePath();
  cup.fillStyle(0x5a3600, 1).fillRoundedRect(-8, -12, 16, 13, { tl: 2, tr: 2, bl: 7, br: 7 });
  cup.fillRect(-2, 1, 4, 5).fillRoundedRect(-7, 6, 14, 4, 2);
  cup.fillStyle(0xfff1b8, 0.9).fillRect(-5, -10, 3, 7);
  b.add(cup);
  num.setX(x0 + iconW + gap - 6);
  b.add(num);
  b.add(txt);
  const place = () => txt.setX(num.x + num.width + 7);
  place();
  // brillo que recorre la pastilla (enmascarado a su forma)
  const shine = scene.add.rectangle(-w / 2 - 30, 0, 18, h + 10, 0xffffff, 0.5).setAngle(18).setBlendMode(Phaser.BlendModes.ADD);
  const maskG = scene.make.graphics({}, false);
  b.add(shine);
  // la máscara sigue la posición en pantalla de la insignia
  const syncMask = () => {
    const m = b.getWorldTransformMatrix();
    maskG.clear().fillStyle(0xffffff).fillRoundedRect(m.tx - (w / 2) * m.scaleX, m.ty - (h / 2) * m.scaleY, w * m.scaleX, h * m.scaleY, (h / 2) * m.scaleY);
  };
  shine.setMask(maskG.createGeometryMask());
  scene.events.on(Phaser.Scenes.Events.UPDATE, syncMask);
  b.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.events.off(Phaser.Scenes.Events.UPDATE, syncMask);
    maskG.destroy();
  });

  // entrada: tras llegar la placa, golpe de escala y conteo
  const at = 760;
  scene.tweens.add({ targets: b, scale: 1, delay: at, duration: 340, ease: 'Back.easeOut', easeParams: [2] });
  const cnt = { v: 0 };
  scene.tweens.add({
    targets: cnt,
    v: wins,
    delay: at + 120,
    duration: Math.min(900, 300 + wins * 20),
    ease: 'Cubic.easeOut',
    onUpdate: () => {
      num.setText(Math.round(cnt.v).toLocaleString('es-CL'));
      place();
    },
    onComplete: () => {
      num.setText(wins.toLocaleString('es-CL'));
      place();
      scene.tweens.add({ targets: b, scale: { from: 1.12, to: 1 }, duration: 220, ease: 'Back.easeOut' });
    },
  });
  scene.tweens.add({ targets: shine, x: w / 2 + 30, delay: at + 600, duration: 700, repeat: -1, repeatDelay: 1100, ease: 'Sine.easeInOut' });
}
