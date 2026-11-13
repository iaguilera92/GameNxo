import Phaser from 'phaser';
import { GAZE_ARTS } from './infernoGaze';
import { NET_DUEL } from '../logic/NetDuel';
import type { CineProfile } from './SmashCinematic';

/**
 * Efectos del DUELO EN LA RED (logic/NetDuel.ts): las dos MIRADAS del cara a cara y la viñeta de los lados.
 *
 * Las miradas son las franjas de ojos de la ULTI (fx/infernoGaze.ts, public/personajes/<Personaje>/pj-<id>-mirada.webp) pero
 * LIMPIAS: sin resplandor de elemento, rayo en los ojos, chispas ni líneas de velocidad. Cada una ocupa ≈ 1/3 del ancho de la
 * pantalla, a la derecha y a la altura de la red, una sobre otra y "mirándose": el jugador (abajo) mira a la derecha (como
 * dibujada) y el rival (arriba) a la izquierda (espejada).
 *
 * Durante el cara a cara la escena está congelada (tweens y temporizadores en pausa): todo se anima desde `update(ms)` con el
 * tiempo REAL transcurrido, que llama la escena en cada fotograma. Fijo en pantalla (scrollFactor 0 → cámara de interfaz).
 */
export interface DuelGaze {
  /** `ms` desde el inicio del duelo y `endMs` = cuándo deben haberse ido (entran al empezar, salen al final) */
  update(ms: number, endMs: number): void;
  destroy(): void;
}

const MINE = 0x3a7bff;
const RIVAL = 0xff4f5e;
const easeOut = (u: number) => 1 - Math.pow(1 - u, 3);
const easeIn = (u: number) => u * u * u;

export function createDuelGaze(scene: Phaser.Scene, o: { centerY: number; mySkin: string; rivalSkin: string }): DuelGaze {
  const W = scene.scale.width;
  const pw = Math.round(W * NET_DUEL.gazeW);
  const gap = 8;
  const margin = 10;
  const plates: { c: Phaser.GameObjects.Container; delay: number; w: number }[] = [];

  /** una franja (null si el personaje no tiene mirada o su imagen no cargó) */
  const plate = (skin: string, color: number, flip: boolean, below: boolean, delay: number) => {
    const art = GAZE_ARTS[skin];
    if (!art || !scene.textures.exists(art.key)) return;
    const src = scene.textures.get(art.key).getSourceImage() as HTMLImageElement;
    const ph = Math.round(pw * (src.height / src.width));
    const y = below ? o.centerY + gap / 2 : o.centerY - gap / 2 - ph;
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.35).fillRect(5, 6, pw, ph); // sombra
    g.fillStyle(0x0a1638, 1).fillRect(0, 0, pw, ph);
    const img = scene.add.image(0, 0, art.key).setOrigin(0, 0).setDisplaySize(pw, ph).setFlipX(flip);
    const edge = scene.add.graphics();
    edge.lineStyle(5, 0x000000, 1).strokeRect(0, 0, pw, ph);
    edge.lineStyle(3, color, 1).strokeRect(2, 2, pw - 4, ph - 4);
    const c = scene.add.container(W + 10, y, [g, img, edge]).setScrollFactor(0).setDepth(7600);
    plates.push({ c, delay, w: pw });
  };
  plate(o.rivalSkin, RIVAL, true, false, 0); // el rival, arriba, mirando a la izquierda
  plate(o.mySkin, MINE, false, true, 70); // tú, abajo, mirando a la derecha

  const xIn = W - pw - margin;
  const xOut = W + 10;
  return {
    update(ms: number, endMs: number) {
      for (const p of plates) {
        if (!p.c.active) continue;
        const e = ms - p.delay;
        const tOut = endMs - NET_DUEL.gazeOutMs;
        let x: number;
        if (e <= 0) x = xOut;
        else if (e < NET_DUEL.gazeInMs) x = xOut + (xIn - xOut) * easeOut(e / NET_DUEL.gazeInMs);
        else if (ms < tOut) x = xIn;
        else x = xIn + (xOut - xIn) * easeIn(Math.min(1, (ms - tOut) / NET_DUEL.gazeOutMs));
        p.c.setX(x);
      }
    },
    destroy() {
      for (const p of plates) if (p.c.active) p.c.destroy();
      plates.length = 0;
    },
  };
}

/**
 * Viñeta SUAVE solo en los lados (el centro queda igual): bordes izquierdo y derecho que se oscurecen un poco mientras
 * dura el cara a cara. Entra y sale con `update(ms, endMs)` (tiempo real, como las miradas).
 */
export interface DuelVignette {
  update(ms: number, endMs: number): void;
  destroy(): void;
}

export function createDuelVignette(scene: Phaser.Scene): DuelVignette {
  const g = scene.add.graphics().setScrollFactor(0).setDepth(4850).setAlpha(0);
  const draw = () => {
    const W = scene.scale.width;
    const H = scene.scale.height;
    const c = 0x02060f;
    const bw = W * 0.24;
    g.clear();
    g.fillGradientStyle(c, c, c, c, 1, 0, 1, 0).fillRect(0, 0, bw, H);
    g.fillGradientStyle(c, c, c, c, 0, 1, 0, 1).fillRect(W - bw, 0, bw, H);
  };
  draw();
  const IN = 240;
  const OUT = 240;
  return {
    update(ms: number, endMs: number) {
      if (!g.active) return;
      const k = ms < IN ? ms / IN : ms > endMs - OUT ? Math.max(0, (endMs - ms) / OUT) : 1;
      g.setAlpha(NET_DUEL.vignette * Math.max(0, Math.min(1, k)));
    },
    destroy() {
      if (g.active) g.destroy();
    },
  };
}

/**
 * Perfil "vacío" de la cinemática (fx/SmashCinematic.ts) que usa el CARA A CARA solo como CONGELADOR: pausa tweens,
 * temporizadores y animaciones y llama a `onFrame` cada fotograma, pero sin oscurecer ni dibujar energía (todo en 0).
 * Dura el aro + el margen para recibir el toque del rival en red.
 */
export const DUEL_CINE: CineProfile = {
  durationMs: NET_DUEL.faceMs + NET_DUEL.graceMs,
  hitAtMs: NET_DUEL.faceMs + NET_DUEL.graceMs,
  activateMs: 1,
  focusMs: 2,
  peakMs: 3,
  raysUntilMs: 0,
  releaseFromMs: NET_DUEL.faceMs + NET_DUEL.graceMs,
  flashAtMs: 1e9,
  flashMs: 0,
  darken: 0,
  rays: 0,
  particles: 0,
  glow: 0,
  pulseEveryMs: 110,
  colors: { core: 0xffffff, gold: 0xffffff, hot: 0xffffff, cyan: 0xffffff },
};