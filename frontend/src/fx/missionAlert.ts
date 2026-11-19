import Phaser from 'phaser';
import { FONT } from '../ui/theme';
import { sfx } from './sfx';

/**
 * Alerta de LOGRO de las MISIONES POR PARTIDA (domain/matchMissions.ts, docs/MISIONES.md): el arte `marcador-misiones`
 * (medalla con estrella a la izquierda, moneda-pelota arriba a la derecha y un casillero para el premio) con "¡LOGRO!"
 * y el nombre de la misión en el centro y "+N" dentro del casillero. Centrada entre el joystick (x 150) y los botones de
 * habilidades (MatchScene.layout) y un poco más arriba que ellos, en su propio hueco: no tapa ni toca los botones.
 * Varias a la vez van en fila (una detrás de otra). Fija en pantalla (scrollFactor 0). Solo la ve el usuario local en 1v1.
 */
const ALERT = {
  /** centro: px sobre el borde de abajo (ESPECIAL en H-225 con radio ~64 → su borde de arriba en H-289) */
  lift: 350,
  /** ancho en pantalla; el alto sale de la proporción de la imagen (MARKER_ART.w × MARKER_ART.h). (19-11-2026, usuario) más grande: 330 → 420 */
  w: 420,
  holdMs: 2100,
  gapMs: 250,
};

/**
 * Imagen de la placa (public/assets/ui/marcador-misiones.webp, 660 × 163, recortada al borde del arte). Las zonas están en
 * coordenadas de la imagen a 2128 × 524 (el tamaño del PNG original ya recortado): `text` = zona libre para el texto
 * (x0..x1), `prize` = centro y tamaño del casillero del premio, `midY` = línea central de la placa.
 */
export const MARKER_ART = {
  key: 'ui-marcador-misiones',
  file: 'assets/ui/marcador-misiones.webp',
  w: 2128,
  h: 524,
  midY: 262,
  text: { x0: 468, x1: 1658 },
  // (19-11-2026, usuario) "+N" en medio del casillero: medido sobre la imagen (casillero x 517..633, y 72..127 a 660 × 163; la moneda
  // tapa su parte de arriba hasta y ≈ 95), así que el texto va al centro de la parte LIBRE (y ≈ 111) y no al del casillero entero
  prize: { cx: 1854, cy: 358, w: 360, h: 100 },
} as const;

/** Llamar desde un `preload()` del partido: encola la imagen de la placa. */
export function queueMissionAlertArt(load: Phaser.Loader.LoaderPlugin) {
  if (!load.textureManager.exists(MARKER_ART.key)) load.image(MARKER_ART.key, MARKER_ART.file);
}

const queue = new WeakMap<Phaser.Scene, { busy: boolean; items: { title: string; coins: number }[] }>();

export function showMissionAlert(scene: Phaser.Scene, title: string, coins: number) {
  let q = queue.get(scene);
  if (!q) {
    q = { busy: false, items: [] };
    queue.set(scene, q);
    // la escena se reutiliza entre partidos: al cerrarse, la cola se vacía
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => queue.delete(scene));
  }
  q.items.push({ title, coins });
  if (!q.busy) next(scene, q);
}

function next(scene: Phaser.Scene, q: { busy: boolean; items: { title: string; coins: number }[] }) {
  const it = q.items.shift();
  if (!it || !scene.sys.isActive()) {
    q.busy = false;
    return;
  }
  q.busy = true;
  const c = draw(scene, it.title, it.coins);
  scene.tweens.add({
    targets: c,
    alpha: 0,
    y: c.y - 24,
    delay: ALERT.holdMs,
    duration: 260,
    ease: 'Cubic.easeIn',
    onComplete: () => {
      c.destroy();
      scene.time.delayedCall(ALERT.gapMs, () => next(scene, q));
    },
  });
}

function draw(scene: Phaser.Scene, title: string, coins: number) {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const w = Math.min(ALERT.w, W - 60);
  const A = MARKER_ART;
  const k = w / A.w; // px de pantalla por px de la imagen
  const h = A.h * k; // alto en pantalla (la imagen es más alargada que la placa de antes: 330 × 81 con el ancho de siempre)
  const GOLD = 0xffc42e;
  const r = h / 2; // la placa es una píldora
  const c = scene.add.container(W / 2, H - ALERT.lift).setScrollFactor(0).setDepth(6062);
  // de un punto de la imagen (x, y) al centro de la placa
  const lx = (x: number) => (x - A.w / 2) * k;
  const ly = (y: number) => (y - A.midY) * k;

  // halo dorado que late + la imagen (la medalla con estrella y la moneda ya vienen en el arte)
  const halo = scene.add.graphics();
  halo.lineStyle(12, GOLD, 0.22).strokeRoundedRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4, r + 2);
  let plate: Phaser.GameObjects.GameObject;
  if (scene.textures.exists(A.key)) plate = scene.add.image(0, 0, A.key).setDisplaySize(w, h);
  else plate = scene.add.graphics().fillStyle(0x0b1733, 0.97).fillRoundedRect(-w / 2, -h / 2, w, h, r).lineStyle(3, GOLD, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, r); // sin la imagen cargada

  // textos en la zona libre: ¡LOGRO! (dorado, chico) y la misión (blanca), centrados; los nombres largos se achican
  const tx = lx((A.text.x0 + A.text.x1) / 2);
  const maxName = (A.text.x1 - A.text.x0) * k;
  const S = w / 330; // los textos crecen con la placa (medidas pensadas para 330 de ancho)
  const head = scene.add.text(tx, -14 * S, '¡LOGRO!', { fontFamily: FONT, fontSize: `${Math.round(16 * S)}px`, color: '#ffd23f', stroke: '#0a1638', strokeThickness: 4 }).setOrigin(0.5).setLetterSpacing(2);
  const name = scene.add.text(tx, 11 * S, title.toUpperCase(), { fontFamily: FONT, fontSize: `${Math.round(17 * S)}px`, color: '#ffffff', stroke: '#0a1638', strokeThickness: 4 }).setOrigin(0.5);
  if (name.width > maxName) name.setScale(maxName / name.width);
  // premio: "+N" dorado y grande, centrado en el casillero
  const P = A.prize;
  const val = scene.add.text(lx(P.cx), ly(P.cy), `+${coins}`, { fontFamily: FONT, fontSize: `${Math.round(19 * S)}px`, color: '#ffd23f', stroke: '#0a1638', strokeThickness: 4 }).setOrigin(0.5);
  // cabe en el casillero (ancho y alto libres); centrado por su caja real (no por la línea base de la fuente)
  const fit = () => {
    val.setScale(1);
    val.setScale(Math.min(1, (P.w * k) / Math.max(1, val.width), (P.h * k * 1.25) / Math.max(1, val.height)));
  };
  fit();

  // destello del borde al entrar (como las cards del resultado; sin máscaras: la placa va en la cámara de interfaz)
  const flash = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
  flash.lineStyle(5, 0xffffff, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, r);

  c.add([halo, plate, head, name, val, flash]);

  // entrada: rebote + destello del borde + halo que late
  c.setScale(0.5).setAlpha(0);
  scene.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 360, ease: 'Back.easeOut', easeParams: [2.2] });
  scene.tweens.add({ targets: flash, alpha: { from: 1, to: 0 }, duration: 520, delay: 300, ease: 'Quad.easeOut' });
  scene.tweens.add({ targets: halo, alpha: { from: 1, to: 0.4 }, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  sfx(scene, 'power-up', 0.8);
  return c;
}
