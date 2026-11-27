import Phaser from 'phaser';
import { FONT } from './theme';
import { roundedPoly } from './shapes';
import { Character, type CharacterLook } from '../objects/Character';
import { addPortrait } from '../characters/portrait';
import { applyCharColor } from '../fx/CharColorFx';
import type { SkinId } from '../characters/skins';
import type { FrameId } from '../domain/profileFrames';
import { FRAME_IDS } from '../domain/profileFrames';
import { LEAGUE_STYLE } from './leagueStyle';
import INTRO_2V2 from './intro-2v2.json';
import INTRO_2 from './intro-2.json';

/**
 * Pantalla VS (vertical, estilo juego de pelea): pantalla partida en diagonal, RIVAL arriba en rojo
 * y TÚ abajo en azul (18-11-2026, como empieza el partido), personajes grandes, placas de nombre/nivel y un VS dorado con impacto.
 * Solo presentación: la escena que la llama decide cuándo pasar al partido.
 */
export interface VersusSide {
  name: string;
  level: number;
  look: CharacterLook;
  /** skin para usar su retrato estático si existe (solo el jugador) */
  portraitSkin?: SkinId;
  /** (26-11-2026, usuario) sin la píldora del NIVEL (el rival bot en el tutorial) */
  hideLevel?: boolean;
  /** (26-11-2026, usuario) RACHA actual (solo el jugador): fuego con el número, junto al nivel */
  streak?: number;
  /** victorias totales: se muestran bajo la placa con un trofeo. 0 o sin dato = no se muestra nada */
  wins?: number;
  /** ESTILO DE COLOR del personaje (solo el jugador; fx/CharColorFx.ts) */
  color?: string;
  /** MARCO del perfil (domain/profileFrames.ts): borde de la placa con el color de esa liga. Sin marco = azul / rojo */
  frame?: FrameId | null;
}

/** Borde de la placa con el MARCO de una liga (mismo estilo que el de la card del perfil: ui/ProfileDialog.drawProfileFrame). */
function drawPlateFrame(g: Phaser.GameObjects.Graphics, shape: { x: number; y: number }[], frame: FrameId) {
  const st = LEAGUE_STYLE[frame];
  const tier = FRAME_IDS.indexOf(frame);
  g.lineStyle(14 + tier * 1.5, st.color, 0.25).strokePoints(shape, true, true); // brillo
  g.lineStyle(8, st.dark, 1).strokePoints(shape, true, true);
  g.lineStyle(5, st.color, 1).strokePoints(shape, true, true);
  g.lineStyle(1.8, st.light, 0.95).strokePoints(shape.map((p) => ({ x: p.x * 0.965, y: p.y * 0.9 })), true, true);
  // remaches (gemas desde Oro) en las 4 esquinas de la placa
  const xs = shape.map((p) => p.x);
  const ys = shape.map((p) => p.y);
  const corners = [
    shape.reduce((a, p) => (p.x + p.y < a.x + a.y ? p : a)),
    shape.reduce((a, p) => (p.x - p.y > a.x - a.y ? p : a)),
    shape.reduce((a, p) => (p.y - p.x > a.y - a.x ? p : a)),
    shape.reduce((a, p) => (p.x + p.y > a.x + a.y ? p : a)),
  ];
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const gem = tier >= 2;
  for (const c of corners) {
    const x = c.x + (cx - c.x) * 0.06;
    const y = c.y + (cy - c.y) * 0.14;
    g.fillStyle(st.dark, 1).fillCircle(x, y, gem ? 7 : 5.5);
    g.fillStyle(gem ? st.light : st.color, 1).fillCircle(x, y, gem ? 5 : 3.8);
    if (gem) g.fillStyle(0xffffff, 0.9).fillCircle(x - 1.4, y - 1.4, 1.5);
  }
}

const BLUE = { main: 0x2f7bff, deep: 0x0b2a78, glow: 0x6fb2ff, text: '#9fd0ff' };
const RED = { main: 0xff3b4e, deep: 0x6e0c1c, glow: 0xff8a96, text: '#ffb3ba' };

/**
 * (19-11-2026, usuario) ENTRADA DEL 2v2: hoja de cada personaje caminando hacia la cámara en contraluz (tools/build-intro-2v2.mjs →
 * assets/characters/intro-2v2/<id>.webp). Llamar en el preload de la escena que mostrará la VS del 2v2.
 */
const introKey = (id: string) => `vs-intro-2v2-${id}`;
/** `gesture`: lado de SU hoja hacia el que hace el gesto ('right' = NXO levanta el puño a la derecha); sin él, al centro */
type IntroMeta = { file: string; cell: { w: number; h: number }; frames: number; feetPad: number; gesture?: 'left' | 'right' };
const INTRO = INTRO_2V2 as Record<string, IntroMeta>;
/**
 * (19-11-2026, usuario) INTRO 2: primer plano de cada personaje mirando a la cámara con su raqueta y su aura (hoja pj-<id>-intro-2.png →
 * assets/characters/intro-2/<id>.webp). Solo en la VS del 2v2: cada personaje que la tenga sale AL AZAR con la intro 1 (caminando) o con esta.
 */
const INTRO2 = INTRO_2 as Record<string, IntroMeta>;
/** (21-11-2026, usuario) cuánto SUBE cada personaje en el cuadro de la intro 2 (fracción del alto del cuadro; sin dato = centrado) */
/** (20-11-2026, usuario) personajes MUJER: en la intro 2 salen primero (desde lo oscuro) */
const INTRO2_FEMALE = new Set<string>(['mai']);
const INTRO2_ZOOM: Record<string, number> = { mai: 1.12, nxo: 1.12 }; // (21-11-2026, usuario) NXO también más cerca; // (21-11-2026, usuario) Mai un poco más cerca
const INTRO2_HOLD_MS: Record<string, number> = { mai: 200 }; // Mai se queda 0,2 s más en su último cuadro nítido
const INTRO2_LIFT: Record<string, number> = { nxo: 0.26 }; // (0,07 → 0,11 → 0,15: "un poco más arriba", usuario)
/** cuánto BAJA el aura respecto al personaje en la intro 2 (fracción del alto del cuadro): MAI */
const INTRO2_SMOKE: Record<string, number> = { nxo: 18, mai: 28 }; // nubes de humo del aura
const INTRO2_SMOKE_A: Record<string, number> = { nxo: 0.22, mai: 0.28 }; // su opacidad máxima
const INTRO2_AURA_DY: Record<string, number> = { mai: 0.05 };
const intro2Key = (id: string) => `vs-intro2-${id}`;
export function queueVersusDuoArt(load: Phaser.Loader.LoaderPlugin) {
  for (const [id, m] of Object.entries(INTRO)) {
    if (!load.textureManager.exists(introKey(id))) load.spritesheet(introKey(id), m.file, { frameWidth: m.cell.w, frameHeight: m.cell.h });
  }
  for (const [id, m] of Object.entries(INTRO2)) {
    if (!load.textureManager.exists(intro2Key(id))) load.spritesheet(intro2Key(id), m.file, { frameWidth: m.cell.w, frameHeight: m.cell.h });
  }
}

/** 2v2: los dos de tu equipo (tú y tu compañero, mitad de abajo) y los dos RIVALES (bots u online, mitad de arriba) para la VS */
export interface VersusDuo {
  mySkin: string;
  mateSkin: string;
  /** (19-11-2026) personajes de los 2 rivales: [el 1.º (izquierda), el 2.º (derecha)] */
  rivals?: [string, string];
  /** (19-11-2026, usuario) una card por persona (nombre y nivel): tú, tu compañero y los 2 rivales (jugadores o bots) */
  cards?: { me: VersusSide; mate: VersusSide; rival1: VersusSide; rival2: VersusSide };
}

export function showVersus(scene: Phaser.Scene, player: VersusSide, rival: VersusSide, duo?: VersusDuo) {
  const W = scene.scale.width;
  const H = scene.scale.height;
  // línea diagonal que parte la pantalla (sube hacia la derecha)
  const yL = H * 0.56;
  const yR = H * 0.44;
  const midY = (yL + yR) / 2;

  // ---------------------------------------------------------------- mitades de color
  const half = (top: boolean) => {
    // (18-11-2026, usuario) RIVAL arriba (rojo) y TÚ abajo (azul), como empieza el partido
    const pal = top ? RED : BLUE;
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
    if (side.color && side.color !== 'classic') applyCharColor(obj, side.color, side.portraitSkin ?? 'nxo');
    // el rival (abajo a la derecha) mira hacia la izquierda, hacia el jugador
    if (!top && obj instanceof Character) obj.facing = -1;
    if (!top && portrait) portrait.setFlipX(true);
    scene.tweens.add({ targets: obj, x, delay: 140, duration: 520, ease: 'Back.easeOut', easeParams: [1.2] });
    // respiración
    scene.tweens.add({ targets: obj, y: obj.y - 6, delay: 700, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    if (obj instanceof Character) scene.time.delayedCall(800, () => obj.swing());
  };
  // (19-11-2026, usuario) 2v2: cada mitad con su PAREJA en su ENTRADA (cancha, sol detrás y los dos caminando hacia la cámara): abajo tu equipo
  // (tú a la derecha) y arriba los dos rivales (bots u online). Sin las hojas de alguno, esa mitad muestra el personaje de siempre
  const has = (id?: string) => !!id && scene.textures.exists(introKey(id));
  const duoOn = !!duo && has(duo.mySkin) && has(duo.mateSkin);
  const rivalsOn = !!duo?.rivals && has(duo.rivals[0]) && has(duo.rivals[1]);
  // (19-11-2026, usuario) una pareja con la INTRO 1 (caminando) y la otra con la INTRO 2 (uno y luego el otro), al azar; la 2 solo si los dos
  // de esa pareja la tienen
  const has2 = (id?: string) => !!id && !!INTRO2[id] && scene.textures.exists(intro2Key(id));
  const top2ok = rivalsOn && has2(duo!.rivals![0]) && has2(duo!.rivals![1]);
  const bot2ok = duoOn && has2(duo!.mySkin) && has2(duo!.mateSkin);
  const twoTop = top2ok && (!bot2ok || Math.random() < 0.5);
  const twoBot = bot2ok && !twoTop;
  if (rivalsOn) duoScene(scene, { left: duo!.rivals![0], right: duo!.rivals![1] }, true, W, H, yL, yR, twoTop);
  else fighter(rival, true);
  if (duoOn) duoScene(scene, { right: duo!.mySkin, left: duo!.mateSkin }, false, W, H, yL, yR, twoBot);
  else fighter(player, false);

  // ---------------------------------------------------------------- placas de nombre
  /**
   * Placa de nombre. `slot` (2v2 con las parejas, 19-11-2026): card CHICA en su sitio, con su etiqueta (TÚ / COMPAÑERO / RIVAL). Sin él, la de
   * siempre (grande, arriba a la derecha el rival y abajo a la izquierda tú).
   */
  const plate = (side: VersusSide, top: boolean, slot?: { x: number; tag: string; dy?: number }) => {
    const me = !top; // tú abajo
    const pal = me ? BLUE : RED;
    const pw = slot ? Math.min(250, (W - 56) / 2) : Math.min(330, W * 0.46);
    const ph = slot ? DUO_PLATE_H : 132;
    const sc = ph / 132; // todo lo de dentro se achica con la card
    const x = slot ? slot.x : top ? W - pw / 2 - 20 : pw / 2 + 20;
    const y = slot ? (top ? DUO_PLATE_H / 2 + 22 : H - DUO_PLATE_H / 2 - 22) + (slot.dy ?? 0) : top ? H * 0.2 : H * 0.72;
    const c = scene.add.container(top ? W + pw : -pw, y).setDepth(8);
    const k = 18 * sc;
    const shape = roundedPoly([[-pw / 2 + k, -ph / 2], [pw / 2, -ph / 2], [pw / 2 - k, ph / 2], [-pw / 2, ph / 2]], 14);
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.4).fillPoints(shape.map((p) => ({ x: p.x + 4, y: p.y + 7 })), true);
    if (side.frame) {
      // MARCO del perfil elegido (16-11-2026): la placa lleva el borde de esa liga
      g.fillStyle(0x0a1430, 0.95).fillPoints(shape, true);
      drawPlateFrame(g, shape, side.frame);
    } else {
      g.lineStyle(10, pal.main, 0.22).strokePoints(shape, true, true);
      g.fillStyle(0x0a1430, 0.95).fillPoints(shape, true);
      g.lineStyle(3, pal.main, 1).strokePoints(shape, true, true);
    }
    c.add(g);
    // etiqueta TÚ / RIVAL (o COMPAÑERO en el 2v2)
    const label = slot?.tag ?? (me ? 'TÚ' : 'RIVAL');
    const tagT = scene.add.text(0, -ph / 2, label, { fontFamily: FONT, fontSize: `${Math.round(22 * sc)}px`, color: '#ffffff' }).setOrigin(0.5).setLetterSpacing(2);
    const tw = Math.max(104 * sc, tagT.width + 34 * sc);
    const th = 16 * sc;
    const tag = scene.add.graphics();
    const tagPts = roundedPoly([[-tw / 2 + 8 * sc, -th], [tw / 2, -th], [tw / 2 - 8 * sc, th], [-tw / 2, th]], 7 * sc);
    tag.fillStyle(pal.main, 1).fillPoints(tagPts, true);
    tag.setPosition(-pw / 2 + tw / 2 + 18 * sc, -ph / 2);
    tagT.setX(-pw / 2 + tw / 2 + 18 * sc);
    c.add([tag, tagT]);
    // nombre (se reduce si es largo)
    const name = scene.add
      .text(0, (side.hideLevel ? 8 : -10) * sc, side.name.toUpperCase(), // (26-11-2026, usuario) sin el NIVEL (tutorial): el nombre, centrado en la placa
 { fontFamily: FONT, fontSize: `${Math.round(40 * sc)}px`, color: '#ffffff', stroke: '#050b1c', strokeThickness: Math.max(3, Math.round(6 * sc)) })
      .setOrigin(0.5);
    if (name.width > pw - 40 * sc) name.setScale((pw - 40 * sc) / name.width);
    c.add(name);
    // nivel
    if (!side.hideLevel) {
      const lv = scene.add.graphics();
      lv.fillStyle(pal.deep, 1).fillRoundedRect(-62 * sc, 22 * sc, 124 * sc, 32 * sc, 16 * sc);
      lv.lineStyle(2, pal.main, 1).strokeRoundedRect(-62 * sc, 22 * sc, 124 * sc, 32 * sc, 16 * sc);
      c.add(lv);
      c.add(scene.add.text(0, 38 * sc, `NIVEL ${side.level}`, { fontFamily: FONT, fontSize: `${Math.round(20 * sc)}px`, color: pal.text }).setOrigin(0.5).setLetterSpacing(1));
    }
    if (side.streak && side.streak > 0 && !slot) { // (26-11-2026, usuario) sin racha (0): no sale
      // (26-11-2026, usuario) RACHA actual: fuego con el contador dentro, en la fila del nivel
      const fx0 = 62 * sc + 30 * sc;
      const fy = 34 * sc;
      const f = scene.add.graphics({ x: fx0, y: fy });
      const k = sc;
      const flame = (col: number, s2: number) => f.fillStyle(col, 1).fillPoints([
        { x: 0, y: -30 * k * s2 }, { x: 10 * k * s2, y: -14 * k * s2 }, { x: 18 * k * s2, y: -2 * k * s2 }, { x: 17 * k * s2, y: 10 * k * s2 },
        { x: 9 * k * s2, y: 18 * k * s2 }, { x: 0, y: 20 * k * s2 }, { x: -9 * k * s2, y: 18 * k * s2 }, { x: -17 * k * s2, y: 10 * k * s2 },
        { x: -18 * k * s2, y: -2 * k * s2 }, { x: -12 * k * s2, y: -12 * k * s2 }, { x: -6 * k * s2, y: -6 * k * s2 },
      ], true);
      flame(0x7a1a00, 1.12);
      flame(0xff5a1f, 1);
      flame(0xffb12e, 0.72);
      c.add(f);
      const st = scene.add.text(fx0, fy + 6 * sc, `${side.streak}`, { fontFamily: FONT, fontSize: `${Math.round(19 * sc)}px`, color: '#ffffff', stroke: '#5a1200', strokeThickness: Math.max(2, Math.round(4 * sc)) }).setOrigin(0.5);
      c.add(st);
      scene.tweens.add({ targets: f, scaleX: { from: 1, to: 1.06 }, scaleY: { from: 1, to: 1.1 }, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      // (26-11-2026, usuario) chispas de fuego que suben desde la llama
      const spark = () => {
        if (!c.active) return;
        const col = Phaser.Utils.Array.GetRandom([0xffd23f, 0xff8a2a, 0xff5a1f, 0xfff1b8]) as number;
        const p = scene.add.circle(fx0 + Phaser.Math.Between(-10, 10) * sc, fy - 6 * sc, Phaser.Math.FloatBetween(2, 4.5) * sc, col).setBlendMode(Phaser.BlendModes.ADD);
        c.add(p);
        scene.tweens.add({ targets: p, y: p.y - Phaser.Math.Between(26, 52) * sc, x: p.x + Phaser.Math.Between(-12, 12) * sc, alpha: 0, scale: 0.3, duration: Phaser.Math.Between(500, 900), ease: 'Sine.easeOut', onComplete: () => p.destroy() });
      };
      const ev = scene.time.addEvent({ delay: 90, loop: true, callback: spark });
      c.once(Phaser.GameObjects.Events.DESTROY, () => ev.remove());
    }
    scene.tweens.add({ targets: c, x, delay: 260, duration: 460, ease: 'Back.easeOut' });
    if (side.wins && side.wins > 0 && !slot) winsBadge(scene, c, ph, side.wins); // (cards chicas del 2v2: sin insignia)
  };
  // (19-11-2026, usuario) 2v2 con las parejas: DOS cards por mitad, una por persona, cada una sobre su personaje (izquierda / derecha);
  // si no hay datos de las 4 personas, la placa de siempre con los dos nombres juntos
  const cardW = Math.min(250, (W - 56) / 2);
  const cx0 = W / 2 - cardW / 2 - 8;
  const cx1 = W / 2 + cardW / 2 + 8;
  const cards = duo?.cards;
  if (rivalsOn && cards) {
    plate(cards.rival1, true, { x: cx0, tag: 'RIVAL', dy: twoTop ? DUO_CARD_SHIFT : 0 });
    plate(cards.rival2, true, { x: cx1, tag: 'RIVAL', dy: twoTop ? DUO_CARD_SHIFT : 0 });
  } else plate(rival, true);
  if (duoOn && cards) {
    plate(cards.mate, false, { x: cx0, tag: 'COMPAÑERO', dy: twoBot ? -DUO_CARD_SHIFT : 0 });
    plate(cards.me, false, { x: cx1, tag: 'TÚ', dy: twoBot ? -DUO_CARD_SHIFT : 0 });
  } else plate(player, false);

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

/** alto de la placa del nombre (también la usa la entrada del 2v2 para dejarle sitio abajo) */
const DUO_CARD_SHIFT = 16; // (21-11-2026, usuario) con la INTRO 2 las cards se acercan al centro: las de abajo suben y las de arriba bajan (px)
const DUO_PLATE_H = 100; // (19-11-2026, usuario) cards del 2v2 más chicas (dos por mitad)

/** (19-11-2026, usuario) color del AURA de cada personaje en la INTRO 2 (fondo oscuro): NXO roja, Mai rosada */
const INTRO_AURA: Record<string, number> = { nxo: 0xff2a1a, mai: 0xff4fb0 };
/** (21-11-2026) color de la PUNTA de las llamas del aura (más claro): NXO naranja, Mai rosa claro */
const INTRO_AURA_TIP: Record<string, number> = { nxo: 0xff9a3c, mai: 0xffb3dd };

/** (21-11-2026) franja vertical de degradado de un color (opaca arriba, transparente abajo): los huecos sobre y bajo el cuadro de la INTRO 2. Una textura por color. */
function glowStrip(scene: Phaser.Scene, color: number) {
  const key = `vs-glow-${color.toString(16)}`;
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, 4, 256);
  const ctx = tex?.getContext();
  if (!tex || !ctx) return key;
  const rgb = `${(color >> 16) & 255},${(color >> 8) & 255},${color & 255}`;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, `rgba(${rgb},0.6)`);
  g.addColorStop(0.45, `rgba(${rgb},0.22)`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  tex.refresh();
  return key;
}

/** textura del SOL de la entrada del 2v2 (degradado radial cálido) */
function ensureSun(scene: Phaser.Scene) {
  const key = 'vs-duo-sun';
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, 256, 256);
  const ctx = tex?.getContext();
  if (!tex || !ctx) return key;
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,240,1)');
  g.addColorStop(0.18, 'rgba(255,240,170,0.95)');
  g.addColorStop(0.45, 'rgba(255,190,80,0.5)');
  g.addColorStop(1, 'rgba(255,140,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  tex.refresh();
  return key;
}

/**
 * (19-11-2026, usuario) Una mitad de la VS del 2v2 con su PAREJA: una CANCHA de tenis en perspectiva, un SOL que brilla detrás (enciende muy
 * fuerte y baja lento) y los DOS en el medio, cerca pero sin tocarse, caminando hacia la cámara en contraluz y en cámara lenta (hoja
 * intro-2v2 de cada personaje: NXO levanta el puño, Mai se sube la muñequera); el último cuadro se queda. Todo recortado a su mitad.
 *  - abajo (`top` = false): tu equipo; TÚ a la DERECHA (llegas desde la derecha) y tu compañero a la IZQUIERDA. Tu placa va abajo al centro.
 *  - arriba (`top` = true): los RIVALES (bots u online); el 1.º a la IZQUIERDA y el 2.º a la DERECHA, como entran al partido. Su placa va arriba al centro.
 * `right` / `left` = personaje (skin) de cada lado.
 */
function duoScene(scene: Phaser.Scene, pair: { right: string; left: string }, top: boolean, W: number, H: number, yL: number, yR: number, mode2 = false) {
  const poly = top
    ? [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: yR }, { x: 0, y: yL }]
    : [{ x: 0, y: yL }, { x: W, y: yR }, { x: W, y: H }, { x: 0, y: H }];
  const maskG = scene.make.graphics({}, false);
  maskG.fillStyle(0xffffff).fillPoints(poly, true);
  const mask = maskG.createGeometryMask();
  const bg = scene.add.container(0, 0).setDepth(3).setAlpha(0);
  bg.setMask(mask);
  bg.once(Phaser.GameObjects.Events.DESTROY, () => maskG.destroy());
  const midY = (yL + yR) / 2;
  // personajes: abajo, sobre su placa (abajo al centro); arriba, bajo su placa (arriba al centro) y con los pies cerca de la diagonal
  const feetY = top ? midY - 46 : H - DUO_PLATE_H - 34;
  const height = top ? Math.min(feetY - (22 + DUO_PLATE_H + 18), H * 0.3) : Math.min(feetY - (yL + 24), H * 0.34);
  // (19-11-2026, usuario) el suelo empieza un poco detrás de los pies en las DOS mitades (antes abajo el horizonte quedaba muy arriba y
  // parecían flotar sin piso): igual que en la de los rivales
  const horizon = feetY - height * 0.22;
  const skyTop = top ? 0 : yR - 20;
  const floorEnd = top ? yL + 10 : H; // la cancha llega hasta el borde de la mitad
  // cielo cálido detrás (atardecer) y CANCHA en perspectiva
  const g = scene.add.graphics();
  g.fillGradientStyle(0x1b2f6b, 0x1b2f6b, 0xff9a3c, 0xff9a3c, 1).fillRect(0, skyTop, W, horizon - skyTop);
  // (19-11-2026, usuario) PISO PLANO: el suelo de la cancha sin perspectiva (sin laterales ni pasillos), solo una T en el medio: la línea de
  // saque de lado a lado y la central bajando desde su centro. Más claro cerca (la luz del sol de atrás)
  g.fillGradientStyle(0x2459b8, 0x2459b8, 0x4a97f0, 0x4a97f0, 1).fillRect(0, horizon, W, floorEnd - horizon);
  const tY = horizon + (floorEnd - horizon) * 0.18;
  g.lineStyle(5, 0xffffff, 0.85);
  g.lineBetween(0, tY, W, tY);
  g.lineBetween(W / 2, tY, W / 2, floorEnd);
  // el suelo se OSCURECE al alejarse del sol (la luz del medio): hacia los costados y hacia la cámara
  const fh = floorEnd - horizon;
  const shade = scene.add.graphics();
  shade.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.62, 0, 0.62, 0).fillRect(0, horizon, W / 2, fh);
  shade.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0.62, 0, 0.62).fillRect(W / 2, horizon, W / 2, fh);
  shade.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.45, 0.45).fillRect(0, horizon, W, fh);
  bg.add([g, shade]);
  // SOL detrás de los dos: halo grande que late y rayos que giran despacio
  const sunY = feetY - height * 0.62;
  const sunKey = ensureSun(scene);
  const rays = scene.add.graphics({ x: W / 2, y: sunY }).setBlendMode(Phaser.BlendModes.ADD);
  for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * Math.PI * 2;
    const L = W * (i % 2 ? 0.55 : 0.8);
    rays.fillStyle(0xfff0b0, i % 2 ? 0.1 : 0.18).fillTriangle(0, 0, Math.cos(ang - 0.07) * L, Math.sin(ang - 0.07) * L, Math.cos(ang + 0.07) * L, Math.sin(ang + 0.07) * L);
  }
  const sun = scene.add.image(W / 2, sunY, sunKey).setBlendMode(Phaser.BlendModes.ADD);
  const sunCore = scene.add.image(W / 2, sunY, sunKey).setBlendMode(Phaser.BlendModes.ADD);
  bg.add([rays, sun, sunCore]);
  scene.tweens.add({ targets: rays, angle: 360, duration: 26000, repeat: -1 });
  // (como la referencia) al empezar la luz de atrás ENCIENDE MUY FUERTE (un resplandor que llena la mitad) y baja LENTO hasta quedar como un
  // sol detrás de ellos; luego late apenas
  const bloom = scene.add.image(W / 2, sunY, sunKey).setDisplaySize(W * 2.2, W * 2.2).setBlendMode(Phaser.BlendModes.ADD);
  bg.add(bloom);
  const sunBig = height * 1.5;
  const coreBig = height * 0.7;
  sun.setDisplaySize(sunBig * 1.9, sunBig * 1.9);
  sunCore.setDisplaySize(coreBig * 2.4, coreBig * 2.4);
  scene.tweens.add({ targets: bloom, alpha: { from: 1, to: 0.22 }, delay: 150, duration: 2400, ease: 'Sine.easeOut' });
  scene.tweens.add({ targets: sun, displayWidth: sunBig, displayHeight: sunBig, delay: 150, duration: 2400, ease: 'Sine.easeOut' });
  scene.tweens.add({ targets: sunCore, displayWidth: coreBig, displayHeight: coreBig, delay: 150, duration: 2400, ease: 'Sine.easeOut',
    onComplete: () => scene.tweens.add({ targets: [sun, sunCore], alpha: { from: 1, to: 0.8 }, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }) });
  scene.tweens.add({ targets: rays, alpha: { from: 1, to: 0.55 }, delay: 150, duration: 2400, ease: 'Sine.easeOut' });
  // velo cálido sobre la cancha cerca del sol (luz de contraluz en el suelo)
  const floorGlow = scene.add.image(W / 2, feetY, sunKey).setDisplaySize(W * 1.1, height * 0.5).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.55);
  bg.add(floorGlow);
  scene.tweens.add({ targets: bg, alpha: 1, delay: 120, duration: 320 });

  // (19-11-2026, usuario) INTRO 2 de esta mitad (la elige showVersus: una pareja sale con la intro 1 y la otra con la 2): UNO y luego el OTRO,
  // en orden al azar, GRANDES en el centro de su mitad (sin tocar las cards); entre los dos la imagen se APAGA y se vuelve a ENCENDER. Cada uno
  // muestra sus 8 cuadros (≈ 1,15 s) y los dos caben en la VS (≈ 2,7 s); el segundo se queda en su último cuadro NÍTIDO (el 8 es el difuso)
  if (mode2) {
    // (19-11-2026, usuario) la intro 2 va en OSCURO: sin el cielo, la cancha ni el sol (esa luz es de la intro 1)
    for (const o of [g, shade, rays, sun, sunCore, bloom, floorGlow]) o.setVisible(false);
    const dark = scene.add.graphics();
    dark.fillStyle(0x05060c, 1).fillRect(0, top ? 0 : yR - 20, W, top ? yL + 10 : H - yR + 20);
    bg.add(dark);
    // CUADRO NEGRO de lado a lado (todo el ancho de la VS), entre las cards y la diagonal, con un filo arriba y abajo: ahí salen los dos
    // (19-11-2026, usuario) el cuadro es MÁS BAJO que el espacio libre (72 %, centrado) y los personajes MÁS GRANDES que él: el cuadro les
    // corta parte de arriba y de abajo
    const freeTop = top ? 22 + DUO_PLATE_H + 14 + DUO_CARD_SHIFT : Math.max(yL, yR) + 18;
    const freeBot = top ? Math.min(yL, yR) - 18 : H - DUO_PLATE_H - 36 - DUO_CARD_SHIFT;
    const freeH = freeBot - freeTop;
    // (21-11-2026, usuario) cuadro un poco más pequeño (64 % del espacio libre, antes 72 %) y personajes más grandes: el cuadro les corta más alto
    // (21-11-2026, usuario) los cuadros del RIVAL (mitad de ARRIBA) un poco más abajo: todo el cuadro baja 7 % del espacio libre
    const sd = top ? 0.07 : 0;
    const areaTop = freeTop + freeH * (0.18 + sd);
    const areaBot = freeBot - freeH * (0.18 - sd);
    const boxH = areaBot - areaTop;
    const cy = (areaTop + areaBot) / 2;
    // (21-11-2026, usuario) los huecos sobre y bajo el cuadro (hasta las cards y la diagonal) eran negro puro: degradado del color del equipo (azul tú, rojo rival)
    // que nace en el borde del cuadro y se apaga hacia afuera
    const glowKey = glowStrip(scene, top ? 0xff4f5e : 0x2f7bff);
    const glowUp = scene.add.image(0, freeTop, glowKey).setOrigin(0).setDisplaySize(W, Math.max(1, areaTop - freeTop)).setFlipY(true);
    const glowDn = scene.add.image(0, areaBot, glowKey).setOrigin(0).setDisplaySize(W, Math.max(1, freeBot - areaBot));
    bg.add([glowUp, glowDn]);
    const box = scene.add.graphics();
    box.fillStyle(0x000000, 1).fillRect(0, areaTop, W, boxH);
    box.lineStyle(3, 0x2c3350, 1).lineBetween(0, areaTop, W, areaTop).lineBetween(0, areaBot, W, areaBot);
    box.lineStyle(1, 0x5a6690, 0.6).lineBetween(0, areaTop + 4, W, areaTop + 4).lineBetween(0, areaBot - 4, W, areaBot - 4);
    bg.add(box);
    // recorte al cuadro: el aura y el personaje no se salen de él
    const boxMaskG = scene.make.graphics({}, false);
    boxMaskG.fillStyle(0xffffff).fillRect(0, areaTop, W, boxH);
    const boxMask = boxMaskG.createGeometryMask();
    bg.once(Phaser.GameObjects.Events.DESTROY, () => boxMaskG.destroy());
    // (20-11-2026, usuario) si en la pareja hay una MUJER (Mai), sale PRIMERO; si no (o si son dos), el orden es al azar
    const fem = (id: string) => INTRO2_FEMALE.has(id);
    const ids = fem(pair.left) !== fem(pair.right) ? (fem(pair.left) ? [pair.left, pair.right] : [pair.right, pair.left]) : Math.random() < 0.5 ? [pair.left, pair.right] : [pair.right, pair.left];
    const fps = 10; // (20-11-2026, usuario) más rápido (antes 7): no se alcanzaban a ver; el tiempo que sobra va a las transiciones
    /** `entry`: 'dark' = aparece EN SU SITIO saliendo de lo OSCURO (negro → su color); 'top' = entra RÁPIDO desde arriba */
    const one = (id: string, at: number, last: boolean, entry: 'dark' | 'top') => {
      const m2 = INTRO2[id];
      const key2 = intro2Key(id);
      const s2 = Math.min((freeH * 1.15) / m2.cell.h, (W * 1.0) / m2.cell.w) * (INTRO2_ZOOM[id] ?? 1); // (21-11-2026) más grande (antes 1,0 y 0,95): se ve recortado arriba y abajo
      const anim2 = `${key2}-solo`;
      if (!scene.anims.exists(anim2)) scene.anims.create({ key: anim2, frames: scene.anims.generateFrameNumbers(key2, { start: 0, end: m2.frames - 1 }).map((fr, i) => (i === m2.frames - 2 && INTRO2_HOLD_MS[id] ? { ...fr, duration: INTRO2_HOLD_MS[id] } : fr)) as Phaser.Types.Animations.AnimationFrame[], frameRate: fps, repeat: 0 });
      // (19-11-2026, usuario) ENTRA desde ARRIBA y SALE por ABAJO del cuadro, BORROSO en la transición: el cuadro 1 y el 8 de su hoja ya son
      // difusos y además deja una ESTELA de movimiento (copias suyas detrás) mientras se desliza
      const slideMs = entry === 'dark' ? 0 : 180; // desde arriba, rápido
      const darkMs = 520; // desde lo oscuro
      const exitMs = 300; // salida por abajo
      const animAt = entry === 'dark' ? 120 : slideMs; // cuándo empieza su animación (desde lo oscuro, casi enseguida)
      const offY = boxH * 0.7;
      // (21-11-2026, usuario) NXO un poco más arriba en el cuadro (INTRO2_LIFT: fracción del alto del cuadro); el resto, centrado
      const cyc = cy - boxH * (INTRO2_LIFT[id] ?? 0);
      const auraDy = boxH * (INTRO2_AURA_DY[id] ?? 0);
      const spr = scene.add.sprite(W / 2, entry === 'dark' ? cyc : cyc - offY, key2, 0).setOrigin(0.5).setScale(s2 * 0.96).setDepth(5).setAlpha(0).setMask(boxMask);
      const trail = [0.45, 0.25, 0.12].map((a) => ({ a, sp: scene.add.sprite(W / 2, cy, key2, 0).setOrigin(0.5).setDepth(4.9).setAlpha(0).setMask(boxMask) }));
      let lastY = spr.y;
      // AURA de su color ALREDEDOR del personaje (NXO roja, Mai rosada; el resto, dorada): copias de su silueta pintadas de ese color, un poco más
      // grandes y detrás de él, que siguen su cuadro, su tamaño y su brillo (sin preFX/postFX en el sprite), más un brillo suave de fondo
      const auraCol = INTRO_AURA[id] ?? 0xffc42e;
      const glow = scene.add.image(W / 2, cy, sunKey).setTint(auraCol).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(m2.cell.h * s2 * 1.6, m2.cell.h * s2 * 1.6).setAlpha(0).setDepth(4.7).setMask(boxMask);
      // (21-11-2026, usuario) AURA COMO FUEGO, no como ondas: 3 copias de la silueta ALARGADAS HACIA ARRIBA que parpadean (alfa, ancho y largo con ruido, como llamas)
      // —la de más afuera, con la punta clara— y, encima, brasas / lenguas de luz que SUBEN desde el cuerpo y se apagan
      const auraTip = INTRO_AURA_TIP[id] ?? 0xfff1b8;
      const rims = [
        { kx: 1.03, ky: 1.07, dy: -0.01, a: 0.32, col: auraCol, ph: 0 },
        { kx: 1.06, ky: 1.15, dy: -0.03, a: 0.22, col: auraCol, ph: 2.1 },
        { kx: 1.09, ky: 1.26, dy: -0.055, a: 0.14, col: auraTip, ph: 4.2 },
      ].map((r) => ({ ...r, sp: scene.add.sprite(W / 2, cy, key2, 0).setOrigin(0.5).setTintFill(r.col).setBlendMode(Phaser.BlendModes.ADD).setDepth(4.8).setAlpha(0).setMask(boxMask) }));
      interface Ember { sp: Phaser.GameObjects.Image; x: number; y: number; vy: number; life: number; age: number; size: number; seed: number }
      const embers: Ember[] = Array.from({ length: 28 }, (_, i) => ({
        sp: scene.add.image(W / 2, cy, sunKey).setTint(i % 3 ? auraCol : auraTip).setBlendMode(Phaser.BlendModes.ADD).setDepth(4.75).setAlpha(0).setMask(boxMask),
        x: 0,
        y: 0,
        vy: 0,
        life: 1,
        age: Math.random() * 1.4, // arrancan escalonadas
        size: 0,
        seed: Math.random() * 6.28,
      }));
      const spawn = (e: Ember) => {
        const dw = spr.displayWidth;
        const dh = spr.displayHeight;
        e.x = (Math.random() - 0.5) * dw * 0.85;
        e.y = dh * (-0.05 + Math.random() * 0.4); // desde la mitad del cuerpo hacia abajo
        e.vy = -(0.12 + Math.random() * 0.22) * dh; // px/s: suben (más rápido cuanto más grande el cuadro)
        e.life = 0.7 + Math.random() * 0.9;
        e.age = 0;
        e.size = dh * (0.1 + Math.random() * 0.16);
        e.seed = Math.random() * 6.28;
      };
      for (const e of embers) {
        spawn(e);
        e.age = Math.random() * e.life;
      }
      // (21-11-2026, usuario) AURA COMO HUMO: nubes grandes y suaves de su color que suben despacio, crecen y se disipan, repartidas por TODO el ancho del cuadro (Mai, más humo)
      interface Puff { sp: Phaser.GameObjects.Image; x: number; y: number; vy: number; vx: number; life: number; age: number; size: number }
      const puffs: Puff[] = Array.from({ length: INTRO2_SMOKE[id] ?? 18 }, (_, i) => ({
        sp: scene.add.image(W / 2, cy, sunKey).setTint(i % 4 ? auraCol : auraTip).setBlendMode(Phaser.BlendModes.ADD).setDepth(4.6).setAlpha(0).setMask(boxMask),
        x: 0, y: 0, vy: 0, vx: 0, life: 1, age: 0, size: 0,
      }));
      const spawnPuff = (p: Puff) => {
        p.x = (Math.random() - 0.5) * W * 1.05; // todo el ancho del cuadro
        p.y = boxH * (0.1 + Math.random() * 0.45); // desde la mitad hacia abajo; sube
        p.vy = -boxH * (0.1 + Math.random() * 0.14);
        p.vx = (Math.random() - 0.5) * W * 0.05;
        p.life = 1.5 + Math.random() * 1.2;
        p.age = 0;
        p.size = boxH * (0.55 + Math.random() * 0.5);
      };
      for (const p of puffs) {
        spawnPuff(p);
        p.age = Math.random() * p.life;
      }
      let pulse = 1;
      const pulseTw = scene.tweens.addCounter({ from: 1, to: 0.7, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', onUpdate: (tw) => (pulse = tw.getValue() ?? 1) });
      const sync = (_t: number, dtMs: number) => {
        if (!spr.active) return;
        const fr = spr.frame.name;
        const ay = spr.y + auraDy; // (21-11-2026) el aura de Mai un poco más abajo que ella
        const dh = spr.displayHeight;
        // llamas: cada copia parpadea (ruido de dos senos), se mece de lado y "respira" en largo
        for (const r of rims) {
          const fl = 0.6 + 0.4 * Math.sin(_t * 0.011 + r.ph) * Math.sin(_t * 0.0067 + r.ph * 1.7);
          const sway = Math.sin(_t * 0.004 + r.ph) * spr.displayWidth * 0.012;
          r.sp.setFrame(fr).setPosition(spr.x + sway, ay + dh * r.dy).setScale(spr.scaleX * r.kx, spr.scaleY * r.ky * (1 + 0.035 * Math.sin(_t * 0.013 + r.ph))).setAlpha(spr.alpha * r.a * (0.55 + 0.45 * fl) * pulse);
        }
        glow.setPosition(spr.x, ay).setAlpha(spr.alpha * 0.4 * pulse);
        const dtp = Math.min(dtMs, 50) / 1000;
        for (const p of puffs) {
          p.age += dtp;
          if (p.age >= p.life) spawnPuff(p);
          const q = p.age / p.life;
          p.x += p.vx * dtp;
          p.y += p.vy * dtp;
          const sz = p.size * (0.7 + 0.8 * q); // crece al subir
          p.sp.setPosition(W / 2 + p.x, cy + auraDy + p.y).setDisplaySize(sz, sz * 0.8).setAlpha(spr.alpha * (INTRO2_SMOKE_A[id] ?? 0.2) * Math.sin(Math.PI * q) * pulse);
        }
        // brasas / lenguas de luz que suben y se apagan
        const dts = Math.min(dtMs, 50) / 1000;
        for (const e of embers) {
          e.age += dts;
          if (e.age >= e.life) spawn(e);
          const q = e.age / e.life;
          e.y += e.vy * dts;
          const px = spr.x + e.x + Math.sin(e.age * 4 + e.seed) * dh * 0.03;
          const sz = e.size * (1 - 0.55 * q);
          e.sp.setPosition(px, ay + e.y).setDisplaySize(sz, sz * 1.5).setAlpha(spr.alpha * 0.75 * Math.pow(Math.sin(Math.PI * q), 0.8) * pulse);
        }
        // estela: copias detrás en la dirección del movimiento, más fuertes cuanto más rápido va
        const vy = (spr.y - lastY) / Math.max(1, dtMs); // px por ms
        lastY = spr.y;
        const k = Math.min(1, Math.abs(vy) / 1.2);
        trail.forEach((t, i) => t.sp.setFrame(fr).setScale(spr.scaleX).setPosition(spr.x, spr.y - vy * 22 * (i + 1)).setAlpha(spr.alpha * t.a * k));
      };
      scene.events.on(Phaser.Scenes.Events.UPDATE, sync);
      const cleanup = () => {
        scene.events.off(Phaser.Scenes.Events.UPDATE, sync);
        pulseTw.remove();
        for (const r of rims) r.sp.destroy();
        for (const e of embers) e.sp.destroy();
        for (const p of puffs) p.sp.destroy();
        for (const t of trail) t.sp.destroy();
        glow.destroy();
      };
      spr.once(Phaser.GameObjects.Events.DESTROY, cleanup);
      if (entry === 'dark') {
        // (20-11-2026, usuario) aparece en su sitio SALIENDO DE LO OSCURO: del negro a sus colores, a la vez que se enciende
        spr.setTint(0x000000);
        scene.tweens.add({ targets: spr, alpha: 1, delay: at, duration: darkMs, ease: 'Sine.easeOut' });
        scene.tweens.addCounter({
          from: 0, to: 255, delay: at, duration: darkMs, ease: 'Sine.easeIn',
          onUpdate: (tw) => { if (spr.active) { const v = Math.round(tw.getValue() ?? 255); spr.setTint(Phaser.Display.Color.GetColor(v, v, v)); } },
          onComplete: () => spr.active && spr.clearTint(),
        });
        scene.tweens.add({ targets: spr, scaleX: s2, scaleY: s2, delay: at, duration: darkMs, ease: 'Sine.easeOut' });
      } else {
        // entra RÁPIDO desde arriba (con su cuadro 1, borroso) y se ENCIENDE; al llegar empieza su animación
        scene.tweens.add({ targets: spr, y: cyc, alpha: 1, delay: at, duration: slideMs, ease: 'Cubic.easeOut' });
        // (21-11-2026, usuario) el "acercamiento" (0,96 → 1) solo ocurre al ENTRAR; durante los cuadros queda QUIETA
        scene.tweens.add({ targets: spr, scaleX: s2, scaleY: s2, delay: at, duration: slideMs, ease: 'Sine.easeOut' });
      }
      scene.time.delayedCall(at + animAt, () => spr.active && spr.play(anim2));
      // sale por abajo cuando llega a su cuadro 8 (borroso) y se APAGA
      const exitAt = animAt + ((m2.frames - 1) / fps) * 1000 + (INTRO2_HOLD_MS[id] ?? 0);
      if (!last) {
        scene.tweens.add({ targets: spr, y: cyc + offY, alpha: 0, delay: at + exitAt, duration: exitMs, ease: 'Cubic.easeIn', onComplete: () => spr.destroy() });
      } else {
        // el último se queda en su cuadro 7 (nítido), no en el 8 (difuso)
        scene.time.delayedCall(at + animAt + ((m2.frames - 2) / fps) * 1000 + (INTRO2_HOLD_MS[id] ?? 0) + 30, () => {
          if (!spr.active) return;
          spr.anims.stop();
          spr.setFrame(m2.frames - 2);
        });
      }
      return exitAt;
    };
    const t0 = top ? 150 : 200;
    // el primero sale de lo OSCURO en su sitio; el segundo entra rápido desde arriba justo cuando el primero sale por abajo
    const firstExit = one(ids[0], t0, false, 'dark');
    one(ids[1], t0 + firstExit + 60, true, 'top');
    return;
  }
  // los DOS, cerca sin tocarse; cada uno con SU hoja (la de su personaje); el gesto mira hacia el compañero
  const sideOf = (id: string, dx: number, flip: boolean, delay: number) => {
    const m = INTRO[id];
    const key = introKey(id);
    const s = height / (m.cell.h - m.feetPad * 2);
    const animKey = `${key}-walk`;
    if (!scene.anims.exists(animKey)) scene.anims.create({ key: animKey, frames: scene.anims.generateFrameNumbers(key, { start: 0, end: m.frames - 1 }), frameRate: 3, repeat: 0 }); // CÁMARA LENTA: los 8 cuadros en ~2,7 s
    // llega desde su lado de la pantalla (no tan de lejos), en cámara lenta, mientras camina hacia la cámara
    const fromX = W / 2 + dx + Math.sign(dx) * W * 0.22; // (19-11-2026, usuario) un poco más lejos que 0,14 (antes 0,32)
    const spr = scene.add
      .sprite(fromX, feetY + m.feetPad * s, key, 0)
      .setOrigin(0.5, 1)
      .setScale(s * 0.9)
      .setFlipX(flip)
      .setDepth(5)
      .setAlpha(0);
    // aparece desde la luz: se acerca un poco (crece) mientras camina; el último cuadro se queda
    scene.tweens.add({ targets: spr, alpha: 1, delay, duration: 700, ease: 'Sine.easeOut' });
    scene.tweens.add({ targets: spr, scaleX: s, scaleY: s, delay, duration: 2800, ease: 'Sine.easeOut' });
    scene.tweens.add({ targets: spr, x: W / 2 + dx, delay, duration: 2800, ease: 'Sine.easeOut' });
    scene.time.delayedCall(delay, () => spr.active && spr.play(animKey));
    // sombra LARGA hacia la cámara (la luz está detrás), dentro de su mitad. (19-11-2026, usuario) SIEMPRE con el personaje: aparece con él y
    // lo SIGUE mientras llega a su sitio (antes salía recién al llegar)
    const sw = height * 0.2;
    const len = floorEnd - feetY + 40;
    const lean = dx * 0.5; // se abren hacia los lados, alejándose del sol
    const sh = scene.add.graphics({ x: fromX, y: 0 }).setAlpha(0);
    sh.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.55, 0.55, 0, 0).fillPoints([
      { x: -sw / 2, y: feetY }, { x: sw / 2, y: feetY }, { x: lean + sw * 0.8, y: feetY + len }, { x: lean - sw * 0.8, y: feetY + len },
    ], true);
    sh.fillStyle(0x000000, 0.45).fillEllipse(0, feetY, height * 0.36, height * 0.06);
    bg.add(sh);
    scene.tweens.add({ targets: sh, alpha: 1, delay, duration: 700, ease: 'Sine.easeOut' });
    scene.tweens.add({ targets: sh, x: W / 2 + dx, delay, duration: 2800, ease: 'Sine.easeOut' });
  };
  // separación: medio cuerpo de cada uno más un hueco (no se tocan)
  const wR = (INTRO[pair.right]?.cell.w ?? 200) * (height / 440);
  const wL = (INTRO[pair.left]?.cell.w ?? 200) * (height / 440);
  const gap = Math.max(wR, wL) * 0.42;
  // el gesto de cada hoja (`gesture`) mira al compañero: si hace el gesto hacia la DERECHA y está a la derecha, se voltea (y al revés)
  const flipFor = (id: string, right: boolean) => (INTRO[id]?.gesture === 'right' && right) || (INTRO[id]?.gesture === 'left' && !right);
  const d0 = top ? 160 : 220;
  sideOf(pair.right, gap, flipFor(pair.right, true), top ? d0 + 100 : d0);
  sideOf(pair.left, -gap, flipFor(pair.left, false), top ? d0 : d0 + 100);
}

/**
 * Insignia dorada de victorias bajo la placa del nombre: trofeo + número que cuenta hacia arriba + "VICTORIAS".
 * Entra con un pequeño golpe al terminar de llegar la placa y luego brilla con un destello que la recorre.
 */
function winsBadge(scene: Phaser.Scene, plate: Phaser.GameObjects.Container, ph: number, wins: number) {
  const label = wins === 1 ? 'VICTORIA' : 'VICTORIAS';
  const b = scene.add.container(0, ph / 2 + 48).setScale(0); // (12-11-2026: más abajo, separada de la placa del nombre)
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
