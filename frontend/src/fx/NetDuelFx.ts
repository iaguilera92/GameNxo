import Phaser from 'phaser';
import { GAZE_ARTS } from './infernoGaze';
import { NET_DUEL } from '../logic/NetDuel';
import type { CineProfile } from './SmashCinematic';

/**
 * Efectos del DUELO RED (logic/NetDuel.ts): las dos MIRADAS del inicio, la viñeta de los lados y el MARCADOR de las 3 rondas.
 *
 * Las miradas son las franjas de ojos de la ULTI (fx/infernoGaze.ts, public/personajes/<Personaje>/pj-<id>-mirada.webp) pero
 * LIMPIAS: sin resplandor de elemento, rayo en los ojos, chispas ni líneas de velocidad. Cada una ocupa ≈ 1/3 del ancho de la
 * pantalla, a la derecha y a la altura de la red, una sobre otra y "mirándose": el jugador (abajo) mira a la derecha (como
 * dibujada) y el rival (arriba) a la izquierda (espejada).
 *
 * Durante el inicio la escena está congelada (tweens y temporizadores en pausa): todo se anima desde `update(ms)` con el
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

export function createDuelVignette(scene: Phaser.Scene, strength: number = NET_DUEL.vignette): DuelVignette {
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
      g.setAlpha(strength * Math.max(0, Math.min(1, k)));
    },
    destroy() {
      if (g.active) g.destroy();
    },
  };
}

/**
 * Perfil "vacío" de la cinemática (fx/SmashCinematic.ts) que usa el INICIO del duelo solo como CONGELADOR: pausa tweens,
 * temporizadores y animaciones y llama a `onFrame` cada fotograma, pero sin oscurecer ni dibujar energía (todo en 0).
 * Dura NET_DUEL.introMs.
 */
export const DUEL_CINE: CineProfile = {
  durationMs: NET_DUEL.introMs,
  hitAtMs: NET_DUEL.introMs,
  activateMs: 1,
  focusMs: 2,
  peakMs: 3,
  raysUntilMs: 0,
  releaseFromMs: NET_DUEL.introMs,
  flashAtMs: 1e9,
  flashMs: 0,
  darken: 0,
  rays: 0,
  particles: 0,
  glow: 0,
  pulseEveryMs: 110,
  colors: { core: 0xffffff, gold: 0xffffff, hot: 0xffffff, cyan: 0xffffff },
};

/**
 * MARCADOR DEL DUELO: 3 pelotas de tenis arriba al centro (una por ronda), grises al empezar. Al decidirse una ronda su pelota
 * se pinta: azul = ganaste tú, rojo = ganó el rival, gris oscuro con borde = empate. La ronda en curso late.
 * Fijo en pantalla (scrollFactor 0 → cámara de interfaz).
 */
export type DuelRoundColor = 'player' | 'bot' | 'tie';
export interface DuelScore {
  /** resalta la ronda `i` (la que está en juego) */
  active(i: number): void;
  /** pinta la pelota de la ronda `i` con su resultado (con rebote) */
  set(i: number, who: DuelRoundColor): void;
  /** la pelota de la ronda `i` tiembla un instante (toque fallado) */
  shake(i: number): void;
  destroy(): void;
}

export function createDuelScore(scene: Phaser.Scene, y: number): DuelScore {
  const W = scene.scale.width;
  const R = 25;
  const gap = 24;
  const n = NET_DUEL.rounds;
  const x0 = W / 2 - ((n - 1) * (2 * R + gap)) / 2;
  const panel = scene.add.graphics().setScrollFactor(0).setDepth(7600);
  const pw = n * 2 * R + (n - 1) * gap + 34;
  panel.fillStyle(0x000000, 0.45).fillRoundedRect(W / 2 - pw / 2 + 2, y - R - 10, pw, 2 * R + 20, 18);
  panel.fillStyle(0x0b1733, 0.92).fillRoundedRect(W / 2 - pw / 2, y - R - 12, pw, 2 * R + 20, 18);
  panel.lineStyle(3, 0xffd23f, 1).strokeRoundedRect(W / 2 - pw / 2, y - R - 12, pw, 2 * R + 20, 18);
  const balls: Phaser.GameObjects.Container[] = [];
  const bodies: Phaser.GameObjects.Arc[] = [];
  for (let i = 0; i < n; i++) {
    const body = scene.add.circle(0, 0, R, 0x6b7280, 1).setStrokeStyle(3, 0x1a2238, 1);
    // costuras de la pelota (dos arcos blancos)
    const seams = scene.add.graphics();
    seams.lineStyle(3, 0xffffff, 0.75);
    seams.beginPath().arc(-R * 1.15, 0, R * 0.95, -0.7, 0.7).strokePath();
    seams.beginPath().arc(R * 1.15, 0, R * 0.95, Math.PI - 0.7, Math.PI + 0.7).strokePath();
    const c = scene.add.container(x0 + i * (2 * R + gap), y, [body, seams]).setScrollFactor(0).setDepth(7601);
    balls.push(c);
    bodies.push(body);
  }
  let act = -1;
  let pulse: Phaser.Tweens.Tween | null = null;
  return {
    active(i: number) {
      if (i === act || !balls[i]?.active) return;
      pulse?.remove();
      balls.forEach((b) => b.setScale(1));
      act = i;
      pulse = scene.tweens.add({ targets: balls[i], scale: { from: 1, to: 1.18 }, duration: 260, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    },
    set(i: number, who: DuelRoundColor) {
      const b = bodies[i];
      if (!b?.active) return;
      const col = who === 'player' ? 0x2f7bff : who === 'bot' ? 0xff4f5e : 0x3a3f4d;
      b.setFillStyle(col, 1);
      b.setStrokeStyle(3, who === 'tie' ? 0xcfd6e6 : 0xffffff, 1);
      if (act === i) {
        pulse?.remove();
        pulse = null;
      }
      balls[i].setScale(1);
      scene.tweens.add({ targets: balls[i], scale: { from: 1.5, to: 1 }, duration: 320, ease: 'Back.easeOut' });
    },
    shake(i: number) {
      const b = balls[i];
      if (!b?.active) return;
      const x = b.x;
      scene.tweens.add({ targets: b, x: { from: x - 7, to: x + 7 }, duration: 45, yoyo: true, repeat: 3, ease: 'Sine.easeInOut', onComplete: () => { if (b.active) b.setX(x); } });
    },
    destroy() {
      pulse?.remove();
      if (panel.active) panel.destroy();
      for (const b of balls) if (b.active) b.destroy();
    },
  };
}

/**
 * CUADRO DE RESULTADO: caja negra con el borde del color que sale arriba al centro (bajo el marcador de pelotas) y dice quién
 * ganó la ronda (o el duelo). Entra con rebote, se queda `ms` y se va. Fijo en pantalla (scrollFactor 0 → cámara de interfaz).
 */
export function showDuelBox(scene: Phaser.Scene, o: { title: string; sub?: string; color: number; ms?: number; y?: number; big?: boolean }) {
  const W = scene.scale.width;
  const ms = o.ms ?? NET_DUEL.boxMs;
  const big = !!o.big;
  const t = scene.add.text(0, o.sub ? -12 : 0, o.title.toUpperCase(), { fontFamily: '"Lilita One", "Arial Black", sans-serif', fontSize: `${big ? 44 : 32}px`, color: '#ffffff', stroke: '#0a1638', strokeThickness: 6 }).setOrigin(0.5).setLetterSpacing(2);
  const sub = o.sub ? scene.add.text(0, big ? 28 : 24, o.sub, { fontFamily: '"Lilita One", "Arial Black", sans-serif', fontSize: '24px', color: '#ffd23f', stroke: '#0a1638', strokeThickness: 5 }).setOrigin(0.5) : null;
  const maxW = W - 40;
  const w = Math.min(maxW, Math.max(t.width, sub?.width ?? 0) + 70);
  if (t.width + 70 > maxW) t.setScale((maxW - 70) / t.width);
  const h = o.sub ? (big ? 112 : 96) : 70;
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.4).fillRoundedRect(-w / 2 + 4, -h / 2 + 6, w, h, 20);
  g.fillStyle(0x050b1c, 0.94).fillRoundedRect(-w / 2, -h / 2, w, h, 20);
  g.lineStyle(5, o.color, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 20);
  const c = scene.add.container(W / 2, o.y ?? 270, sub ? [g, t, sub] : [g, t]).setScrollFactor(0).setDepth(7700).setScale(0.2).setAlpha(0);
  scene.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 200, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: c, scale: 0.85, alpha: 0, delay: ms, duration: 220, ease: 'Cubic.easeIn', onComplete: () => c.destroy() });
  return c;
}

/**
 * PRESIÓN: borde rojo oscuro alrededor de toda la pantalla que late como un corazón; cada ronda que pasa es más fuerte y más rápido.
 * `update(ms, done)` con el tiempo real (la escena puede estar congelada). `destroy()` lo quita (con fundido si hay tweens).
 */
export interface DuelPressure {
  update(ms: number, done: number): void;
  destroy(fade: boolean): void;
}

export function createDuelPressure(scene: Phaser.Scene): DuelPressure {
  const g = scene.add.graphics().setScrollFactor(0).setDepth(4840).setAlpha(0);
  const W = scene.scale.width;
  const H = scene.scale.height;
  const c = 0x7a0010;
  const b = Math.min(W, H) * 0.2;
  g.fillGradientStyle(c, c, c, c, 1, 1, 0, 0).fillRect(0, 0, W, b);
  g.fillGradientStyle(c, c, c, c, 0, 0, 1, 1).fillRect(0, H - b, W, b);
  g.fillGradientStyle(c, c, c, c, 1, 0, 1, 0).fillRect(0, 0, b, H);
  g.fillGradientStyle(c, c, c, c, 0, 1, 0, 1).fillRect(W - b, 0, b, H);
  return {
    update(ms: number, done: number) {
      if (!g.active) return;
      const period = 760 - 150 * done; // el latido se acelera con cada ronda
      const ph = (ms % period) / period;
      const beat = Math.pow(Math.max(0, Math.sin(ph * Math.PI * 2)), 3); // golpe seco y reposo
      g.setAlpha(Math.min(1, ms / 500) * (0.28 + 0.14 * done + 0.38 * beat));
    },
    destroy(fade: boolean) {
      if (!g.active) return;
      if (fade) scene.tweens.add({ targets: g, alpha: 0, duration: 450, onComplete: () => g.destroy() });
      else g.destroy();
    },
  };
}

/**
 * "¡RONDA DECISIVA!": texto grande al centro (entra con escala y se va solo a los `ms`). Va 1-1 antes de la tercera ronda.
 * Fijo en pantalla (scrollFactor 0 → cámara de interfaz).
 */
export function showDuelDecisive(scene: Phaser.Scene, ms: number = NET_DUEL.decisiveMs) {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const t = scene.add.text(W / 2, H * 0.4, '¡RONDA DECISIVA!', { fontFamily: '"Lilita One", "Arial Black", sans-serif', fontSize: '64px', color: '#ffd23f', stroke: '#2a0a00', strokeThickness: 10 }).setOrigin(0.5).setScrollFactor(0).setDepth(7800).setScale(0.2).setAlpha(0);
  if (t.width > W - 30) t.setFontSize(Math.floor(64 * (W - 30) / t.width));
  scene.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: t, scale: 1.12, duration: 160, yoyo: true, repeat: 1, delay: 260, ease: 'Sine.easeInOut' });
  scene.tweens.add({ targets: t, alpha: 0, y: H * 0.37, delay: Math.max(300, ms - 220), duration: 220, ease: 'Cubic.easeIn', onComplete: () => t.destroy() });
  return t;
}

/**
 * Aviso pequeño "DUELO CON RETRASO" (solo online, ping alto) bajo el marcador de 3 pelotas, en el estilo del aviso lateral:
 * fondo negro y borde naranja. Solo informativo.
 */
export function showDuelLag(scene: Phaser.Scene, y: number, ms: number = NET_DUEL.lagNoticeMs) {
  const W = scene.scale.width;
  const t = scene.add.text(0, 0, 'DUELO CON RETRASO', { fontFamily: '"Lilita One", "Arial Black", sans-serif', fontSize: '20px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 4 }).setOrigin(0.5).setLetterSpacing(2);
  const w = t.width + 44;
  const h = 38;
  const s = 10;
  const g = scene.add.graphics();
  const pts = [{ x: -w / 2, y: -h / 2 }, { x: w / 2, y: -h / 2 }, { x: w / 2 - s, y: h / 2 }, { x: -w / 2 + s, y: h / 2 }];
  g.fillStyle(0x000000, 0.95).fillPoints(pts, true);
  g.lineStyle(3, 0xff9a1f, 1).strokePoints(pts, true);
  const c = scene.add.container(W / 2, y, [g, t]).setScrollFactor(0).setDepth(7650).setAlpha(0);
  scene.tweens.add({ targets: c, alpha: 1, duration: 200 });
  scene.tweens.add({ targets: c, alpha: 0, delay: ms, duration: 250, onComplete: () => c.destroy() });
  return c;
}
