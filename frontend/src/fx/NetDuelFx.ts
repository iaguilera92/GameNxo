import Phaser from 'phaser';
import { GAZE_ARTS } from './infernoGaze';
import { NET_DUEL } from '../logic/NetDuel';
import type { CineProfile } from './SmashCinematic';

/**
 * Efectos del DUELO RED (logic/NetDuel.ts): las dos MIRADAS del inicio, la viñeta de los lados y el MARCADOR de las 3 rondas.
 *
 * Las miradas son las franjas de ojos de la ULTI (fx/infernoGaze.ts, public/personajes/<Personaje>/pj-<id>-mirada.webp) pero
 * LIMPIAS: sin resplandor de elemento, rayo en los ojos, chispas ni líneas de velocidad. Cada una ocupa ≈ 1/3 del ancho de la
 * pantalla, a la altura de la red y en la MISMA fila, "mirándose": el jugador a la IZQUIERDA mira a la derecha (como
 * dibujada) y el rival a la DERECHA mira a la izquierda (espejada).
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
  const margin = 0; // (17-11-2026, usuario) pegadas al borde de la pantalla (antes 10 px)
  const plates: { c: Phaser.GameObjects.Container; delay: number; w: number; xIn: number; xOut: number }[] = [];

  /** una franja (null si el personaje no tiene mirada o su imagen no cargó) */
  const plate = (skin: string, color: number, flip: boolean, left: boolean, delay: number) => {
    const art = GAZE_ARTS[skin];
    if (!art || !scene.textures.exists(art.key)) return;
    const src = scene.textures.get(art.key).getSourceImage() as HTMLImageElement;
    const ph = Math.round(pw * (src.height / src.width));
    const y = o.centerY - ph / 2; // (14-11-2026) las dos en la MISMA fila (centradas en centerY)
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.35).fillRect(5, 6, pw, ph); // sombra
    g.fillStyle(0x0a1638, 1).fillRect(0, 0, pw, ph);
    const img = scene.add.image(0, 0, art.key).setOrigin(0, 0).setDisplaySize(pw, ph).setFlipX(flip);
    // (21-11-2026, usuario) pegadas a la pantalla como la alerta lateral: SIN borde del lado de la pantalla (la izquierda no lleva borde
    // izquierdo y la derecha no lleva el derecho); solo arriba, abajo y el lado de adentro. Las líneas siguen hasta el canto de la pantalla
    const edge = scene.add.graphics();
    const frame3 = (lw: number, col: number, inset: number) => {
      edge.lineStyle(lw, col, 1);
      const outer = left ? -2 : pw + 2; // canto de la pantalla (un poco fuera, para que no se vea el final de la línea)
      const inner = left ? pw - inset : inset; // lado de adentro
      edge.beginPath();
      edge.moveTo(outer, inset);
      edge.lineTo(inner, inset);
      edge.lineTo(inner, ph - inset);
      edge.lineTo(outer, ph - inset);
      edge.strokePath();
    };
    frame3(5, 0x000000, 0);
    frame3(3, color, 2);
    // la del rival entra por la DERECHA; la tuya por la IZQUIERDA (mirándose)
    const xIn = left ? margin : W - pw - margin;
    const xOut = left ? -pw - 10 : W + 10;
    const c = scene.add.container(xOut, y, [g, img, edge]).setScrollFactor(0).setDepth(7600);
    plates.push({ c, delay, w: pw, xIn, xOut });
  };
  plate(o.rivalSkin, RIVAL, true, false, 0); // el rival, a la derecha, mirando a la izquierda
  plate(o.mySkin, MINE, false, true, 70); // tú, a la izquierda, mirando a la derecha

  return {
    update(ms: number, endMs: number) {
      for (const p of plates) {
        if (!p.c.active) continue;
        const e = ms - p.delay;
        const tOut = endMs - NET_DUEL.gazeOutMs;
        const { xIn, xOut } = p;
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
  const R = 27;
  const gap = 22;
  const n = NET_DUEL.rounds;
  const x0 = W / 2 - ((n - 1) * (2 * R + gap)) / 2;
  // (14-11-2026) CUADRO más cuidado: sombra, fondo con reflejo arriba, borde dorado doble y BRILLO que recorre el borde
  // (como la oferta del Pase de Batalla en la Tienda)
  const pw = n * 2 * R + (n - 1) * gap + 40;
  const ph = 2 * R + 24;
  const px = W / 2 - pw / 2;
  const py = y - ph / 2;
  const rad = 20;
  const panel = scene.add.graphics().setScrollFactor(0).setDepth(7600);
  panel.fillStyle(0x000000, 0.45).fillRoundedRect(px + 3, py + 6, pw, ph, rad);
  panel.fillStyle(0x6b4a00, 1).fillRoundedRect(px - 3, py - 3, pw + 6, ph + 6, rad + 3); // aro exterior oscuro
  panel.fillStyle(0x0b1733, 0.96).fillRoundedRect(px, py, pw, ph, rad);
  panel.fillStyle(0x24407a, 0.55).fillRoundedRect(px + 4, py + 4, pw - 8, ph * 0.42, { tl: rad - 4, tr: rad - 4, bl: 6, br: 6 }); // reflejo de arriba
  panel.lineStyle(3, 0xffd23f, 1).strokeRoundedRect(px, py, pw, ph, rad);
  panel.lineStyle(1.5, 0xfff1b8, 0.55).strokeRoundedRect(px + 4, py + 4, pw - 8, ph - 8, rad - 4);
  const shine = scene.add.graphics().setScrollFactor(0).setDepth(7602).setBlendMode(Phaser.BlendModes.ADD);

  /** punto del borde redondeado a la distancia d (sentido horario desde arriba a la izquierda, tras la esquina) */
  const sw = pw - 2 * rad;
  const sh = ph - 2 * rad;
  const arc = (Math.PI / 2) * rad;
  const per = 2 * (sw + sh) + 4 * arc;
  const at = (d: number) => {
    let t = ((d % per) + per) % per;
    const corner = (cx: number, cy: number, a0: number, u: number) => ({ x: cx + Math.cos(a0 + (u / rad)) * rad, y: cy + Math.sin(a0 + (u / rad)) * rad });
    if (t < sw) return { x: px + rad + t, y: py };
    t -= sw;
    if (t < arc) return corner(px + pw - rad, py + rad, -Math.PI / 2, t);
    t -= arc;
    if (t < sh) return { x: px + pw, y: py + rad + t };
    t -= sh;
    if (t < arc) return corner(px + pw - rad, py + ph - rad, 0, t);
    t -= arc;
    if (t < sw) return { x: px + pw - rad - t, y: py + ph };
    t -= sw;
    if (t < arc) return corner(px + rad, py + ph - rad, Math.PI / 2, t);
    t -= arc;
    if (t < sh) return { x: px, y: py + ph - rad - t };
    t -= sh;
    return corner(px + rad, py + rad, Math.PI, t);
  };
  const t0 = performance.now();
  // tiempo REAL (el duelo congela tweens y temporizadores al empezar)
  const drawShine = () => {
    if (!shine.active) return;
    const d = ((performance.now() - t0) / 2600) * per;
    const trail = 90;
    shine.clear();
    for (const off of [0, per / 2]) {
      for (let k = 0; k < 10; k++) {
        const a = at(d + off - (k * trail) / 10);
        const b = at(d + off - ((k + 1) * trail) / 10);
        const f = 1 - k / 10;
        shine.lineStyle(4 * f + 1.5, 0xfff6c8, 0.9 * f).lineBetween(a.x, a.y, b.x, b.y);
      }
      const head = at(d + off);
      shine.fillStyle(0xffffff, 1).fillCircle(head.x, head.y, 3.5);
    }
  };
  scene.events.on(Phaser.Scenes.Events.PRE_RENDER, drawShine);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.PRE_RENDER, drawShine));

  /** pelota de tenis con volumen: sombra, color, sombreado abajo, brillo arriba y costuras */
  const paint = (g: Phaser.GameObjects.Graphics, who: DuelRoundColor | null) => {
    const col = who === 'player' ? 0x2f7bff : who === 'bot' ? 0xff3b4e : who === 'tie' ? 0x5b6272 : 0x3a4152;
    const dark = who === 'player' ? 0x1340a8 : who === 'bot' ? 0xa3101f : 0x262b37;
    const rim = who === null ? 0x6b7489 : 0xffffff;
    g.clear();
    g.fillStyle(0x000000, 0.35).fillEllipse(2, R * 0.92, R * 1.7, R * 0.45);
    g.fillStyle(dark, 1).fillCircle(0, 0, R);
    g.fillStyle(col, 1).fillCircle(-R * 0.08, -R * 0.1, R * 0.9);
    g.fillStyle(0xffffff, who === null ? 0.1 : 0.28).fillCircle(-R * 0.34, -R * 0.38, R * 0.36);
    g.fillStyle(0xffffff, who === null ? 0.15 : 0.75).fillCircle(-R * 0.42, -R * 0.46, R * 0.13);
    g.lineStyle(3, 0xffffff, who === null ? 0.3 : 0.85);
    g.beginPath().arc(-R * 1.15, 0, R * 0.95, -0.7, 0.7).strokePath();
    g.beginPath().arc(R * 1.15, 0, R * 0.95, Math.PI - 0.7, Math.PI + 0.7).strokePath();
    g.lineStyle(3, rim, who === null ? 0.7 : 1).strokeCircle(0, 0, R);
    if (who !== null) g.lineStyle(2, 0x000000, 0.35).strokeCircle(0, 0, R + 2.5);
  };
  const balls: Phaser.GameObjects.Container[] = [];
  const bodies: Phaser.GameObjects.Graphics[] = [];
  const halos: Phaser.GameObjects.Arc[] = [];
  for (let i = 0; i < n; i++) {
    const halo = scene.add.circle(0, 0, R + 7, 0xffd23f, 0).setStrokeStyle(4, 0xffd23f, 0.9).setVisible(false);
    const body = scene.add.graphics();
    paint(body, null);
    const c = scene.add.container(x0 + i * (2 * R + gap), y, [halo, body]).setScrollFactor(0).setDepth(7601);
    balls.push(c);
    bodies.push(body);
    halos.push(halo);
  }
  let act = -1;
  let pulse: Phaser.Tweens.Tween | null = null;
  return {
    active(i: number) {
      if (i === act || !balls[i]?.active) return;
      pulse?.remove();
      balls.forEach((b) => b.setScale(1));
      halos.forEach((h) => h.setVisible(false));
      act = i;
      halos[i].setVisible(true); // la ronda en juego lleva un aro dorado
      pulse = scene.tweens.add({ targets: balls[i], scale: { from: 1, to: 1.15 }, duration: 260, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    },
    set(i: number, who: DuelRoundColor) {
      const b = bodies[i];
      if (!b?.active) return;
      paint(b, who);
      halos[i].setVisible(false);
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
      scene.events.off(Phaser.Scenes.Events.PRE_RENDER, drawShine);
      if (panel.active) panel.destroy();
      if (shine.active) shine.destroy();
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
 * "¡ÚLTIMA RONDA!" (14-11-2026): justo ENCIMA del marcador de 3 pelotas (`scoreY` = su centro), no al medio de la pantalla:
 * ningún texto tapa a los personajes ni la pelota. Entra con escala y se va solo a los `ms`. Va 1-1 antes de la tercera.
 * Fijo en pantalla (scrollFactor 0 → cámara de interfaz).
 */
export function showDuelDecisive(scene: Phaser.Scene, scoreY: number, ms: number = NET_DUEL.decisiveMs) {
  const W = scene.scale.width;
  const y = scoreY - 27 - 12 - 28; // borde de arriba del marcador (radio 27 + 12) y medio texto
  const t = scene.add.text(W / 2, y, '¡ÚLTIMA RONDA!', { fontFamily: '"Lilita One", "Arial Black", sans-serif', fontSize: '40px', color: '#ffd23f', stroke: '#2a0a00', strokeThickness: 8 }).setOrigin(0.5).setScrollFactor(0).setDepth(7800).setScale(0.2).setAlpha(0);
  if (t.width > W - 30) t.setFontSize(Math.floor(40 * (W - 30) / t.width));
  scene.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: t, scale: 1.12, duration: 160, yoyo: true, repeat: 1, delay: 260, ease: 'Sine.easeInOut' });
  scene.tweens.add({ targets: t, alpha: 0, y: y - 12, delay: Math.max(300, ms - 220), duration: 220, ease: 'Cubic.easeIn', onComplete: () => t.destroy() });
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
