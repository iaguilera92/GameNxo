import Phaser from 'phaser';

/**
 * INFERNO DRIVE · "mirada": entra de lado a lado una franja con
 * los OJOS del personaje (public/personajes/Nxo/pj-nxo-mirada.png), estilo corte de anime: entra apenas empieza
 * el INFERNO, dura ~2 s con resplandor de fuego en los bordes y un rayo saliendo de los ojos (tipo "zona"). Fijo en pantalla (cámara de interfaz).
 * Si la imagen no está cargada no muestra nada.
 */
/** franja visible (una sola a la vez) */
let current: Phaser.GameObjects.Container | null = null;

export const GAZE_ART = { key: 'nxo-gaze', file: 'personajes/Nxo/pj-nxo-mirada.png' };

export function queueGazeArt(load: Phaser.Loader.LoaderPlugin) {
  if (!load.textureManager.exists(GAZE_ART.key)) load.image(GAZE_ART.key, GAZE_ART.file);
}

/** Muestra la franja de la mirada. `holdMs` = cuánto tiempo queda visible (sale antes del desplazamiento). */
export function showInfernoGaze(scene: Phaser.Scene, holdMs = 700) {
  if (!scene.textures.exists(GAZE_ART.key)) return;
  // una sola a la vez: pulsar varias veces no la duplica
  if (current?.active) return;
  const W = scene.scale.width;
  const H = scene.scale.height;
  const src = scene.textures.get(GAZE_ART.key).getSourceImage() as HTMLImageElement;
  const bh = Math.round(W * (src.height / src.width)); // ocupa TODO el ancho
  const cy = Math.round(H * 0.34);
  const root = scene.add.container(0, cy).setScrollFactor(0).setDepth(7600);
  current = root;

  // franja: marco negro con filos de fuego arriba y abajo
  const frame = scene.add.graphics();
  frame.fillStyle(0x000000, 0.92).fillRect(0, -bh / 2 - 14, W, bh + 28);
  frame.fillStyle(0xff5a1a, 1).fillRect(0, -bh / 2 - 14, W, 4).fillRect(0, bh / 2 + 10, W, 4);
  frame.fillStyle(0xffd27a, 1).fillRect(0, -bh / 2 - 10, W, 2).fillRect(0, bh / 2 + 8, W, 2);
  const img = scene.add.image(W / 2, 0, GAZE_ART.key).setDisplaySize(W, bh);
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
    lines.lineStyle(Phaser.Math.Between(1, 3), i % 3 ? 0xffffff : 0xffa020, 0.35).lineBetween(x, y, x + len, y);
  }
  lines.setMask(maskG.createGeometryMask());
  root.add([frame, img, lines]);

  // resplandor en los bordes de arriba y abajo (fuego que late)
  const glow = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  root.add(glow);
  // rayo de los ojos (estilo "zona"): estelas eléctricas que salen de cada ojo hacia atrás
  const bolt = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  root.add(bolt);
  /** ojos en la imagen (fracción del ancho / alto de pj-nxo-mirada.png) */
  const EYES = [
    { fx: 0.505, fy: 0.58 },
    { fx: 0.682, fy: 0.705 },
  ];
  let t = 0;
  const draw = () => {
    t += 1;
    const g = glow.clear();
    const a = 0.55 + Math.sin(t * 0.35) * 0.25;
    for (const [y0, dir] of [[-bh / 2, -1], [bh / 2, 1]] as const) {
      // resplandor hacia FUERA de la franja (más intenso pegado al borde)
      for (let i = 0; i < 8; i++) {
        const k = i / 8;
        g.fillStyle(i < 2 ? 0xffe6a0 : 0xff6a1a, a * (1 - k) * 0.95).fillRect(0, y0 + dir * (i * 5) - (dir < 0 ? 5 : 0), W, 5);
      }
      // chispas a lo largo del borde
      for (let i = 0; i < 6; i++) {
        const x = (t * 13 + i * (W / 6)) % W;
        g.fillStyle(0xfff1b8, a).fillCircle(x, y0 + dir * 2, 2.5);
      }
    }
    const b = bolt.clear();
    const ix = img.x - W / 2;
    for (const e of EYES) {
      const ex = ix + e.fx * W;
      const ey = (e.fy - 0.5) * bh;
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
  const anim = scene.time.addEvent({ delay: 33, loop: true, callback: draw });
  bolt.setMask(maskG.createGeometryMask());

  // entrada desde la izquierda (muy rápida), avance leve y salida hacia la derecha
  const IN = 120;
  root.setX(-W);
  scene.tweens.add({ targets: root, x: 0, duration: IN, ease: 'Cubic.easeOut' });
  scene.tweens.add({ targets: img, x: W / 2 + 22, duration: holdMs, ease: 'Linear' });
  scene.tweens.add({ targets: lines, x: -140, duration: holdMs, ease: 'Linear' });
  // destello en los ojos al llegar
  const flash = scene.add.rectangle(W / 2, 0, W, bh, 0xffffff, 0.55).setBlendMode(Phaser.BlendModes.ADD);
  root.add(flash);
  flash.setMask(maskG.createGeometryMask());
  scene.tweens.add({ targets: flash, alpha: 0, duration: 260, delay: IN - 20 });
  scene.time.delayedCall(IN + holdMs, () => {
    scene.tweens.add({
      targets: root,
      x: W,
      alpha: 0.2,
      duration: 140,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        anim.remove();
        root.destroy();
        maskG.destroy();
      },
    });
  });
  // la máscara sigue a la franja mientras entra / sale
  const follow = () => {
    if (!root.active) return scene.events.off(Phaser.Scenes.Events.UPDATE, follow);
    maskG.x = root.x;
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, follow);
}
