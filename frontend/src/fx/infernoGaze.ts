import Phaser from 'phaser';
import type { InfernoPower } from '../domain/infernoPowers';

/**
 * INFERNO DRIVE · "mirada": entra de lado a lado una franja con
 * los OJOS del personaje (public/personajes/<Personaje>/pj-<id>-mirada.webp), estilo corte de anime: entra apenas empieza
 * el INFERNO, dura ~2 s con resplandor en los bordes del color de su poder (fuego, hielo…) y un rayo saliendo de los ojos (tipo "zona"). Fijo en pantalla (cámara de interfaz).
 * Si el personaje no tiene mirada o la imagen no está cargada no muestra nada.
 */
/** franja visible (una sola a la vez) */
let current: Phaser.GameObjects.Container | null = null;

/**
 * Mirada de cada personaje. `eyeFy` = altura (fracción del alto de la imagen) que queda en el centro de la franja;
 * `eyes` = pupilas (fracción del ancho / alto de la imagen), de donde salen los rayos.
 */
type GazeArt = { key: string; file: string; eyeFy: number; eyes: { fx: number; fy: number }[] };
export const GAZE_ARTS: Record<string, GazeArt> = {
  nxo: {
    key: 'nxo-gaze',
    file: 'personajes/Nxo/pj-nxo-mirada.webp',
    eyeFy: 0.64,
    eyes: [
      { fx: 0.505, fy: 0.58 },
      { fx: 0.682, fy: 0.705 },
    ],
  },
  // mismos puntos que NXO respecto al brillo de cada pupila (sus ojos quedan algo más abajo, bajo la visera)
  mai: {
    key: 'mai-gaze',
    file: 'personajes/Mai/pj-mai-mirada.webp',
    eyeFy: 0.69,
    eyes: [
      { fx: 0.513, fy: 0.637 },
      { fx: 0.662, fy: 0.745 },
    ],
  },
};

/** Carga la mirada del personaje que juega (los que no tienen, nada). */
export function queueGazeArt(load: Phaser.Loader.LoaderPlugin, skin: string) {
  const art = GAZE_ARTS[skin];
  if (art && !load.textureManager.exists(art.key)) load.image(art.key, art.file);
}

/** Muestra la franja de la mirada. `holdMs` = cuánto tiempo queda visible (sale antes del desplazamiento). */
/** Altura de la franja respecto a la imagen completa (se recorta alrededor de los ojos; el ancho sigue siendo toda la pantalla). */
const BAND = 0.5;
/**
 * Colores de la franja según el poder del INFERNO: filos (`edge` fuera, `edgeIn` dentro), resplandor de los bordes
 * (`glowIn` pegado al filo, `glow` el resto), chispas y líneas de velocidad. Fuego = los de siempre.
 */
const GAZE_FX: Record<InfernoPower, { edge: number; edgeIn: number; glowIn: number; glow: number; spark: number; line: number }> = {
  fire: { edge: 0xff5a1a, edgeIn: 0xffd27a, glowIn: 0xffe6a0, glow: 0xff6a1a, spark: 0xfff1b8, line: 0xffa020 },
  ice: { edge: 0x3a9bff, edgeIn: 0xbff0ff, glowIn: 0xeafcff, glow: 0x3a9bff, spark: 0xffffff, line: 0x8fdcff },
  wind: { edge: 0x2fbf6a, edgeIn: 0xd0ffe0, glowIn: 0xf0fff0, glow: 0x3fd68a, spark: 0xeaffe0, line: 0x9cf06a },
  lightning: { edge: 0x2f6bff, edgeIn: 0xfff36b, glowIn: 0xfffbe0, glow: 0x3a7bff, spark: 0xfff36b, line: 0x7fc8ff },
  tulip: { edge: 0xe0457f, edgeIn: 0xffd0e6, glowIn: 0xfff0f7, glow: 0xff6fae, spark: 0xffffff, line: 0xffb3d6 },
};

/**
 * Muestra la franja de `skin`. `centerY` = y de pantalla donde queda centrada (por defecto, la red; ver MatchScene.gazeY).
 * `power` = poder del INFERNO (colores de los filos y del resplandor).
 */
export function showInfernoGaze(scene: Phaser.Scene, holdMs = 700, centerY?: number, skin = 'nxo', power: InfernoPower = 'fire') {
  const C = GAZE_FX[power];
  const art = GAZE_ARTS[skin];
  if (!art || !scene.textures.exists(art.key)) return;
  // una sola a la vez: pulsar varias veces no la duplica
  if (current?.active) return;
  const W = scene.scale.width;
  const H = scene.scale.height;
  const src = scene.textures.get(art.key).getSourceImage() as HTMLImageElement;
  const full = Math.round(W * (src.height / src.width)); // alto de la imagen a todo el ancho (sin deformarla)
  const bh = Math.round(full * BAND); // alto de la franja visible
  const cy = Math.round(centerY ?? H * 0.45);
  /** la imagen se desplaza para que los ojos queden en el centro de la franja */
  const iy = Math.round(-(art.eyeFy - 0.5) * full);
  const root = scene.add.container(0, cy).setScrollFactor(0).setDepth(7600);
  current = root;

  // franja: marco negro con filos del color del poder arriba y abajo
  const frame = scene.add.graphics();
  frame.fillStyle(0x000000, 0.92).fillRect(0, -bh / 2 - 14, W, bh + 28);
  frame.fillStyle(C.edge, 1).fillRect(0, -bh / 2 - 14, W, 4).fillRect(0, bh / 2 + 10, W, 4);
  frame.fillStyle(C.edgeIn, 1).fillRect(0, -bh / 2 - 10, W, 2).fillRect(0, bh / 2 + 8, W, 2);
  const img = scene.add.image(W / 2, iy, art.key).setDisplaySize(W, full);
  // máscara: la imagen solo se ve dentro de la franja
  const maskG = scene.make.graphics({}, false);
  maskG.fillRect(0, cy - bh / 2, W, bh);
  img.setMask(maskG.createGeometryMask());
  // líneas de velocidad sobre la imagen
  const lines = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  for (let i = 0; i < 14; i++) {
    const y = Phaser.Math.Between(-bh / 2 + 6, bh / 2 - 6);
    const len = Phaser.Math.Between(60, 200);
    const x = Phaser.Math.Between(0, W);
    lines.lineStyle(Phaser.Math.Between(1, 3), i % 3 ? 0xffffff : C.line, 0.35).lineBetween(x, y, x + len, y);
  }
  lines.setMask(maskG.createGeometryMask());
  root.add([frame, img, lines]);

  // resplandor en los bordes de arriba y abajo (fuego, hielo… que late)
  const glow = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  root.add(glow);
  // rayo de los ojos (estilo "zona"): estelas eléctricas que salen de cada ojo hacia atrás
  const bolt = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  root.add(bolt);
  /** ojos en la imagen (fracción del ancho / alto de su mirada) */
  const EYES = art.eyes;
  let t = 0;
  const draw = () => {
    t += 1;
    const g = glow.clear();
    const a = 0.55 + Math.sin(t * 0.35) * 0.25;
    for (const [y0, dir] of [[-bh / 2, -1], [bh / 2, 1]] as const) {
      // resplandor hacia FUERA de la franja (más intenso pegado al borde)
      for (let i = 0; i < 8; i++) {
        const k = i / 8;
        g.fillStyle(i < 2 ? C.glowIn : C.glow, a * (1 - k) * 0.95).fillRect(0, y0 + dir * (i * 5) - (dir < 0 ? 5 : 0), W, 5);
      }
      // chispas a lo largo del borde
      for (let i = 0; i < 6; i++) {
        const x = (t * 13 + i * (W / 6)) % W;
        g.fillStyle(C.spark, a).fillCircle(x, y0 + dir * 2, 2.5);
      }
    }
    const b = bolt.clear();
    const ix = img.x - W / 2;
    for (const e of EYES) {
      const ex = ix + e.fx * W;
      const ey = iy + (e.fy - 0.5) * full;
      // estela hacia la izquierda (como si la mirada dejara un rastro al moverse), con quiebres eléctricos
      const pts: { x: number; y: number }[] = [{ x: ex, y: ey }];
      for (let i = 1; i <= 9; i++) pts.push({ x: ex - i * 34, y: ey - i * 2 + Phaser.Math.Between(-7, 7) });
      for (let i = 0; i < pts.length - 1; i++) {
        const f = 1 - i / pts.length;
        // azul neón
        b.lineStyle(14 * f, 0x1ec8ff, 0.4 * f).lineBetween(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
        b.lineStyle(5 * f, 0xd6f7ff, 0.95 * f).lineBetween(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
      }
      b.fillStyle(0xffffff, 0.9).fillCircle(ex, ey, 7 + Math.sin(t * 0.8) * 2);
      b.fillStyle(0x1ec8ff, 0.55).fillCircle(ex, ey, 14 + Math.sin(t * 0.8) * 3);
    }
  };
  draw();
  bolt.setMask(maskG.createGeometryMask());

  // TIEMPO REAL (no el del partido): durante la cinemática la escena pausa tweens y temporizadores, y la franja se
  // quedaba "pegada". Aquí todo se anima con performance.now + requestAnimationFrame.
  const IN = 120;
  const OUT = 140;
  const hold = Math.max(60, holdMs - IN - OUT);
  const flash = scene.add.rectangle(W / 2, 0, W, bh, 0xffffff, 0.55).setBlendMode(Phaser.BlendModes.ADD);
  root.add(flash);
  flash.setMask(maskG.createGeometryMask());
  const easeOut = (u: number) => 1 - Math.pow(1 - u, 3);
  const easeIn = (u: number) => u * u * u;
  const t0 = performance.now();
  let lastDraw = 0;
  let raf = 0;
  const end = () => {
    cancelAnimationFrame(raf);
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, end);
    if (current === root) current = null;
    if (root.active) root.destroy();
    maskG.destroy();
  };
  const tick = (now: number) => {
    if (!root.active) return end();
    const e = now - t0;
    if (e < IN) root.setX(-W * (1 - easeOut(e / IN)));
    else if (e < IN + hold) root.setX(0);
    else {
      const u = Math.min(1, (e - IN - hold) / OUT);
      root.setX(W * easeIn(u)).setAlpha(1 - 0.8 * u);
      if (u >= 1) return end();
    }
    const k = Math.min(1, Math.max(0, (e - IN) / hold));
    img.x = W / 2 + 22 * k;
    lines.x = -140 * k;
    flash.setAlpha(0.55 * (1 - Math.min(1, Math.max(0, (e - (IN - 20)) / 260))));
    maskG.x = root.x;
    if (now - lastDraw >= 33) {
      lastDraw = now;
      draw();
    }
    raf = requestAnimationFrame(tick);
  };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, end);
  raf = requestAnimationFrame(tick);
}
