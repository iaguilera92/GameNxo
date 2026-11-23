import Phaser from 'phaser';
import type { BallState } from '../objects/Ball';
import type { SmashPower } from '../domain/smashPowers';
import { project } from '../view/projection';

/**
 * (14-11-2026) FORMA PROPIA de cada ESPECIAL en vuelo (el fuego ya tiene sus llamas y su humo; los otros tres solo cambiaban
 * de color y no se reconocían):
 *   ice        copo de nieve de 6 brazos que gira alrededor de la pelota + caparazón de hielo; suelta ESQUIRLAS que caen
 *   wind       TORBELLINO: anillos en espiral que giran rápido alrededor de la pelota + RÁFAGAS (líneas curvas) detrás
 *   lightning  DESCARGAS: rayos quebrados que salen de la pelota y cambian cada pocos ms + arco eléctrico por la estela
 * Un solo Graphics redibujado cada fotograma (sin tweens ni objetos nuevos): barato en el móvil.
 */
interface Part {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  rot: number;
  vr: number;
  size: number;
  col: number;
}

const MAX_PARTS = 90;

/** Colores [externo, interno] del charco del suelo y de la cola de cometa de cada poder. */
const GLOW: Record<SmashPower, [number, number]> = {
  fire: [0xff5a12, 0xffd23a],
  ice: [0x4aa8ff, 0xeafcff],
  wind: [0x3fd68a, 0xf0fff4],
  lightning: [0x2f6bff, 0xfff36b],
  shadow: [0x9b4dff, 0xd0a8ff],
  light: [0xffd86a, 0xffffff],
  comet: [0x2f6bff, 0xcfe2ff], // (17-11-2026) COMETA
  dragon: [0xd6201e, 0xffd23f], // (18-11-2026) DRAGÓN
};

const R = Phaser.Math.FloatBetween;

/**
 * (18-11-2026, usuario) PELOTA DRAGÓN del ESPECIAL LEGENDARIO: cabeza de dragón de fuego vista desde arriba con el hocico HACIA ARRIBA
 * (tools/build-dragon-ball.mjs → public/assets/ball-dragon.webp, 8 frames en bucle). Se gira hacia donde vuela y lleva detrás el rastro de
 * fuego. `size` = alto en pantalla respecto a la escala de la pelota; `lead` = cuánto se adelanta la imagen para que la CABEZA quede en la pelota.
 */
export const DRAGON_BALL = { key: 'ball-dragon', file: 'assets/ball-dragon.webp', cell: 256, frames: 8, fps: 14, anim: 'ball-dragon-fly', size: 64, lead: 0.28 };

export class SmashElementFx {
  private g: Phaser.GameObjects.Graphics;
  private parts: Part[] = [];
  private el: SmashPower = 'fire';
  private t = 0;
  private emit = 0;
  /** rayos actuales (se renuevan cada BOLT_MS) */
  private bolts: { pts: { x: number; y: number }[]; w: number }[] = [];
  private boltT = 0;
  /** posiciones recientes en pantalla (arco eléctrico por la estela) */
  private hist: { x: number; y: number }[] = [];

  /** capa NORMAL (no aditiva) para lo oscuro de la SOMBRA (lo aditivo no puede oscurecer) */
  private dark: Phaser.GameObjects.Graphics;

  /** sprite de la PELOTA DRAGÓN (se crea al primer uso si su hoja cargó) */
  private dragonImg?: Phaser.GameObjects.Sprite;
  /** (20-11-2026, usuario) tamaño extra del sprite del dragón (la vista previa de PERSONALIZAR lo agranda; el partido usa 1) */
  dragonScale = 1;

  constructor(private scene: Phaser.Scene) {
    this.g = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this.dark = scene.add.graphics();
  }

  setElement(el: SmashPower) {
    // al cambiar de poder las partículas vivas (hasta ~0,9 s) eran del anterior y se dibujaban con la forma del nuevo
    if (el !== this.el) {
      this.parts.length = 0;
      this.bolts.length = 0;
    }
    this.el = el;
  }

  update(dt: number, ball: BallState, on: boolean, strong: boolean, visible = true) {
    dt = Math.min(dt, 0.05); // al volver de segundo plano un dt enorme haría girar sin fin los bucles de emisión
    const g = this.g;
    this.t += dt;
    const active = on && visible;
    if (!active && !this.parts.length && !this.hist.length && !this.bolts.length && !g.commandBuffer.length && !this.dark.commandBuffer.length && !this.dragonImg?.visible) return;
    g.clear();
    this.dark.clear();
    let k = 1;
    let bx = 0;
    let by = 0;
    let dx = 1;
    let dy = 0;
    if (active) {
      const air = project(ball.x, ball.y, ball.z);
      const back = project(ball.x - ball.vx * 0.03, ball.y - ball.vy * 0.03, Math.max(0, ball.z - ball.vz * 0.03));
      const ground = project(ball.x, ball.y, 0);
      k = air.s * 0.8 * (1 + Math.min(ball.z, 220) / 700);
      bx = air.sx;
      by = air.sy;
      const l = Math.hypot(bx - back.sx, by - back.sy) || 1;
      dx = (bx - back.sx) / l;
      dy = (by - back.sy) / l;
      g.setDepth(ground.sy + 3);
      this.hist.unshift({ x: bx, y: by });
      if (this.hist.length > 14) this.hist.length = 14;
      const S = strong ? 1.25 : 1;
      this.dark.setDepth(ground.sy + 2.9);
      this.drawGroundGlow(ground.sx, ground.sy, k * S, ball.z);
      if (this.el !== 'fire' && this.el !== 'dragon') this.drawComet(k * S);
      if (this.el === 'ice') this.drawIce(bx, by, k * S, dx, dy, dt);
      else if (this.el === 'wind') this.drawWind(bx, by, k * S, dx, dy, dt);
      else if (this.el === 'shadow') this.drawShadow(bx, by, k * S, dx, dy, dt);
      else if (this.el === 'light') this.drawLight(bx, by, k * S, dx, dy, dt);
      else if (this.el === 'fire') this.drawFire(bx, by, k * S, dx, dy, dt, strong);
      else if (this.el === 'comet') this.drawMeteor(bx, by, k * S, dx, dy, dt, strong);
      else if (this.el === 'dragon') {
        if (!this.drawDragonSprite(bx, by, k * S, dx, dy, dt, strong, ground.sy)) this.drawDragon(bx, by, k * S, dx, dy, dt, strong);
      } else this.drawLightning(bx, by, k * S, dt);
    } else {
      this.hist.length = 0;
      this.bolts.length = 0;
    }
    if (!(active && this.el === 'dragon')) this.dragonImg?.setVisible(false);
    // partículas sueltas (esquirlas / ráfagas / chispas)
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.age += dt;
      const f = p.age / p.life;
      if (f >= 1) {
        this.parts.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (this.el === 'ice') p.vy += 260 * dt;
      else if (this.el === 'light') p.vy -= 25 * dt; // las motas de luz flotan hacia arriba
      else if (this.el === 'fire') p.vy -= 70 * dt; // las brasas suben
      else if (this.el === 'shadow') p.vy -= 30 * dt; // el humo y las esquirlas suben un poco
      else if (this.el === 'comet') p.vy += 40 * dt; // las estrellas de la cola caen despacio
      else if (this.el === 'dragon') p.vy -= 60 * dt; // las brasas del dragón suben
      const a = 1 - f;
      this.drawPart(p, a);
    }
  }

  /**
   * (12-11-2026) Charco de luz del color del poder en el suelo bajo la pelota (más tenue y ancho cuanto más alta va): se ve
   * por dónde vuela y de qué poder es aunque la pelota sea pequeña. La SOMBRA lo hace oscuro con borde morado.
   */
  private drawGroundGlow(gx: number, gy: number, k: number, z: number) {
    const h = Math.min(1, Math.max(0, z) / 220);
    const w = (46 + h * 26) * k;
    const a = 0.34 * (1 - h * 0.55);
    const C = GLOW[this.el];
    if (this.el === 'shadow') {
      this.dark.fillStyle(0x08040c, 0.5 * (1 - h * 0.5)).fillEllipse(gx, gy, w * 1.1, w * 0.36);
      this.g.lineStyle(2 * k, C[0], 0.6 * (1 - h * 0.5)).strokeEllipse(gx, gy, w * 1.1, w * 0.36);
      return;
    }
    this.g.fillStyle(C[0], a * 0.7).fillEllipse(gx, gy, w * 1.25, w * 0.42);
    this.g.fillStyle(C[1], a).fillEllipse(gx, gy, w * 0.7, w * 0.24);
  }

  /** Cola de cometa: banda que se afina siguiendo las posiciones recientes de la pelota (da velocidad y color al vuelo). */
  private drawComet(k: number) {
    const pts = this.hist;
    if (pts.length < 4) return;
    const C = GLOW[this.el];
    const draw = (width: number, col: number, alpha: number, layer: Phaser.GameObjects.Graphics = this.g) => {
      const left: { x: number; y: number }[] = [];
      const right: { x: number; y: number }[] = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[Math.max(0, i - 1)];
        const b = pts[Math.min(pts.length - 1, i + 1)];
        let nx = -(b.y - a.y);
        let ny = b.x - a.x;
        const l = Math.hypot(nx, ny) || 1;
        nx /= l;
        ny /= l;
        const w = width * (1 - i / pts.length) ** 1.4;
        left.push({ x: pts[i].x + nx * w, y: pts[i].y + ny * w });
        right.push({ x: pts[i].x - nx * w, y: pts[i].y - ny * w });
      }
      layer.fillStyle(col, alpha).fillPoints([...left, ...right.reverse()], true);
    };
    if (this.el === 'shadow') draw(13 * k, 0x0c0614, 0.45, this.dark);
    draw(11 * k, C[0], 0.22);
    draw(5.5 * k, C[1], 0.5);
  }

  private add(p: Omit<Part, 'age'>) {
    if (this.parts.length >= MAX_PARTS) this.parts.shift();
    this.parts.push({ ...p, age: 0 });
  }

  private drawPart(p: Part, a: number) {
    const g = this.g;
    const c = Math.cos(p.rot);
    const s = Math.sin(p.rot);
    if (this.el === 'light') {
      // mota de luz: núcleo blanco con un halo suave que se agranda al apagarse
      g.fillStyle(p.col, 0.28 * a).fillCircle(p.x, p.y, p.size * (1.8 - a * 0.4));
      g.fillStyle(0xffffff, 0.9 * a).fillCircle(p.x, p.y, p.size * (0.4 + a * 0.4));
      return;
    }
    if (this.el === 'comet') {
      // (17-11-2026) estrella de 5 puntas que gira y se apaga, con un brillo suave detrás
      const R0 = p.size * (0.6 + a * 0.4);
      g.fillStyle(0x6fa4ff, 0.25 * a).fillCircle(p.x, p.y, R0 * 1.5);
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i < 10; i++) {
        const ang = p.rot + (i * Math.PI) / 5 - Math.PI / 2;
        const rr = i % 2 ? R0 * 0.42 : R0;
        pts.push({ x: p.x + Math.cos(ang) * rr, y: p.y + Math.sin(ang) * rr });
      }
      g.fillStyle(p.col, 0.95 * a).fillPoints(pts, true);
      return;
    }
    if (this.el === 'shadow') {
      // jirón de humo negro con borde morado
      this.dark.fillStyle(0x0c0614, 0.55 * a).fillCircle(p.x, p.y, p.size * (1.4 - a * 0.5));
      g.fillStyle(p.col, 0.35 * a).fillCircle(p.x, p.y, p.size * 0.5);
      return;
    }
    if (this.el === 'wind') {
      // ráfaga: trazo curvo que se estira
      const L = p.size * (1 + (1 - a) * 1.5);
      g.lineStyle(Math.max(1, p.size * 0.18) * a + 0.5, p.col, 0.75 * a);
      g.beginPath();
      for (let i = 0; i <= 6; i++) {
        const u = i / 6;
        const along = (u - 0.5) * L;
        const bend = Math.sin(u * Math.PI) * L * 0.18;
        g.lineTo(p.x + c * along - s * bend, p.y + s * along + c * bend);
      }
      g.strokePath();
    } else if (this.el === 'ice') {
      // esquirla: rombo alargado
      const L = p.size;
      const w = p.size * 0.32;
      g.fillStyle(p.col, 0.9 * a);
      g.fillPoints([
        { x: p.x + c * L, y: p.y + s * L },
        { x: p.x - s * w, y: p.y + c * w },
        { x: p.x - c * L * 0.6, y: p.y - s * L * 0.6 },
        { x: p.x + s * w, y: p.y - c * w },
      ], true);
    } else {
      g.fillStyle(p.col, a).fillCircle(p.x, p.y, p.size * (0.5 + a * 0.5));
    }
  }

  // ------------------------------------------------------------------ HIELO
  private drawIce(x: number, y: number, k: number, dx: number, dy: number, dt: number) {
    const g = this.g;
    const r = 21 * k;
    // caparazón de hielo (hexágono translúcido)
    const rot0 = this.t * 1.6;
    const hex = (rad: number) => Array.from({ length: 6 }, (_, i) => ({ x: x + Math.cos(rot0 + (i * Math.PI) / 3) * rad, y: y + Math.sin(rot0 + (i * Math.PI) / 3) * rad }));
    g.fillStyle(0x8fdcff, 0.22).fillPoints(hex(r * 0.95), true);
    g.lineStyle(2 * k, 0xeafcff, 0.85).strokePoints(hex(r * 0.95), true);
    // copo de nieve: 6 brazos con ramitas
    const arm = r * 1.55;
    g.lineStyle(2.4 * k, 0xffffff, 0.95);
    for (let i = 0; i < 6; i++) {
      const a = -rot0 * 0.7 + (i * Math.PI) / 3;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      g.lineBetween(x + ca * r * 0.55, y + sa * r * 0.55, x + ca * arm, y + sa * arm);
      for (const f of [0.75, 1.05]) {
        const px = x + ca * r * f * 1.2;
        const py = y + sa * r * f * 1.2;
        const b = r * 0.32;
        for (const sg of [-1, 1]) {
          const ba = a + sg * 0.75;
          g.lineBetween(px, py, px + Math.cos(ba) * b, py + Math.sin(ba) * b);
        }
      }
      g.fillStyle(0xbff0ff, 1).fillCircle(x + ca * arm, y + sa * arm, 2.2 * k);
    }
    // esquirlas que se desprenden hacia atrás y caen
    this.emit -= dt;
    while (this.emit <= 0) {
      this.emit += 0.03;
      const a = Math.atan2(-dy, -dx) + R(-0.9, 0.9);
      const sp = R(40, 120);
      this.add({ x: x + R(-6, 6) * k, y: y + R(-6, 6) * k, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: R(0.35, 0.6), rot: R(0, 6.28), vr: R(-8, 8), size: R(5, 9) * k, col: Phaser.Utils.Array.GetRandom([0xffffff, 0xd8f6ff, 0x8fdcff]) });
    }
  }

  // ------------------------------------------------------------------ VIENTO
  private drawWind(x: number, y: number, k: number, dx: number, dy: number, dt: number) {
    const g = this.g;
    // TORBELLINO: 3 anillos en espiral (elipses inclinadas según el vuelo) que giran rápido
    const ang = Math.atan2(dy, dx);
    const spin = this.t * 14;
    const cols = [0xffffff, 0xc8ffd8, 0x7ff0a8];
    for (let ring = 0; ring < 3; ring++) {
      const off = -ring * 9 * k; // anillos más atrás, más grandes
      const cx = x + dx * off;
      const cy = y + dy * off;
      const rx = (9 + ring * 4) * k;
      const ry = (20 + ring * 7) * k;
      const segs = 18;
      for (let i = 0; i < segs; i++) {
        const u0 = spin + ring * 2.1 + (i / segs) * Math.PI * 1.6;
        const u1 = spin + ring * 2.1 + ((i + 1) / segs) * Math.PI * 1.6;
        const p = (u: number) => {
          const ex = Math.cos(u) * rx;
          const ey = Math.sin(u) * ry;
          return { x: cx + ex * Math.cos(ang) - ey * Math.sin(ang), y: cy + ex * Math.sin(ang) + ey * Math.cos(ang) };
        };
        const a = p(u0);
        const b = p(u1);
        const f = i / segs; // la cola del arco se apaga
        g.lineStyle((3.4 - ring * 0.6) * k * (0.4 + f * 0.6), cols[ring], (0.95 - ring * 0.2) * f);
        g.lineBetween(a.x, a.y, b.x, b.y);
      }
    }
    // líneas de velocidad pegadas a la pelota
    g.lineStyle(2 * k, 0xffffff, 0.7);
    for (const o of [-1, 0, 1]) {
      const px = x - dy * o * 9 * k;
      const py = y + dx * o * 9 * k;
      const L = (o === 0 ? 46 : 30) * k;
      g.lineBetween(px - dx * 14 * k, py - dy * 14 * k, px - dx * L, py - dy * L);
    }
    // RÁFAGAS curvas que se quedan atrás
    this.emit -= dt;
    while (this.emit <= 0) {
      this.emit += 0.045;
      const side = Math.random() < 0.5 ? -1 : 1;
      this.add({ x: x - dx * 12 * k - dy * side * R(6, 18) * k, y: y - dy * 12 * k + dx * side * R(6, 18) * k, vx: -dx * R(20, 60) - dy * side * 30, vy: -dy * R(20, 60) + dx * side * 30, life: R(0.3, 0.5), rot: ang + side * 0.3, vr: side * R(2, 5), size: R(16, 26) * k, col: Phaser.Utils.Array.GetRandom([0xffffff, 0xc8ffd8, 0x8ff0b0]) });
    }
  }

  // ------------------------------------------------------------------ RAYO
  private drawLightning(x: number, y: number, k: number, dt: number) {
    const g = this.g;
    this.boltT -= dt;
    if (this.boltT <= 0 || !this.bolts.length) {
      this.boltT = 0.06;
      this.bolts = [];
      const n = Phaser.Math.Between(3, 5);
      for (let i = 0; i < n; i++) {
        const a = R(0, Math.PI * 2);
        const len = R(22, 40) * k;
        const pts = [{ x: 0, y: 0 }];
        const steps = 5;
        for (let s = 1; s <= steps; s++) {
          const d = (len * s) / steps;
          const j = (s < steps ? R(-7, 7) : 0) * k;
          pts.push({ x: Math.cos(a) * d - Math.sin(a) * j, y: Math.sin(a) * d + Math.cos(a) * j });
        }
        this.bolts.push({ pts, w: R(1.6, 2.8) });
      }
    }
    // halo eléctrico que parpadea
    const flick = 0.55 + Math.random() * 0.45;
    g.fillStyle(0x5aa8ff, 0.28 * flick).fillCircle(x, y, 20 * k);
    g.fillStyle(0xfff36b, 0.35 * flick).fillCircle(x, y, 12 * k);
    for (const b of this.bolts) {
      const pts = b.pts.map((p) => ({ x: x + p.x, y: y + p.y }));
      g.lineStyle(b.w * 3 * k, 0x5aa8ff, 0.45 * flick).strokePoints(pts, false);
      g.lineStyle(b.w * k, 0xffffff, flick).strokePoints(pts, false);
    }
    // arco eléctrico por la estela (zigzag que une las posiciones recientes)
    if (this.hist.length > 4) {
      const pts = this.hist.map((p, i) => (i === 0 ? p : { x: p.x + R(-6, 6) * k, y: p.y + R(-6, 6) * k }));
      g.lineStyle(5 * k, 0xfff36b, 0.35 * flick).strokePoints(pts, false);
      g.lineStyle(2 * k, 0xffffff, 0.85 * flick).strokePoints(pts, false);
    }
    // chispas que saltan
    this.emit -= dt;
    while (this.emit <= 0) {
      this.emit += 0.025;
      const a = R(0, Math.PI * 2);
      const sp = R(80, 200);
      this.add({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: R(0.15, 0.3), rot: 0, vr: 0, size: R(2, 3.5) * k, col: Phaser.Utils.Array.GetRandom([0xffffff, 0xfff36b, 0x9fd0ff]) });
    }
  }

  // ------------------------------------------------------------------ SOMBRA
  private drawShadow(x: number, y: number, k: number, dx: number, dy: number, dt: number) {
    const g = this.g;
    const d = this.dark;
    // halo oscuro que traga la luz alrededor de la pelota (late)
    const pulse = 1 + Math.sin(this.t * 9) * 0.08;
    d.fillStyle(0x08040c, 0.45).fillCircle(x, y, 24 * k * pulse);
    d.fillStyle(0x1a0630, 0.55).fillCircle(x, y, 16 * k * pulse);
    // borde de energía morada
    g.lineStyle(2.5 * k, 0x9b4dff, 0.85).strokeCircle(x, y, 17 * k * pulse);
    g.fillStyle(0x7a2fd6, 0.3).fillCircle(x, y, 11 * k);
    // TENTÁCULOS de sombra que se retuercen hacia atrás
    const back = Math.atan2(-dy, -dx);
    for (let i = 0; i < 5; i++) {
      const base = back + (i - 2) * 0.45;
      const pts: { x: number; y: number }[] = [];
      for (let j = 0; j <= 7; j++) {
        const u = j / 7;
        const r = (14 + u * 34) * k;
        const a = base + Math.sin(this.t * 7 + i * 1.7 + u * 4) * 0.35 * u;
        pts.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
      }
      d.lineStyle(5 * k, 0x0c0614, 0.6).strokePoints(pts, false);
      g.lineStyle(1.6 * k, 0xb57aff, 0.7).strokePoints(pts, false);
    }
    // humo negro que queda atrás y sube un poco
    this.emit -= dt;
    while (this.emit <= 0) {
      this.emit += 0.03;
      this.add({ x: x - dx * 10 * k + R(-6, 6) * k, y: y - dy * 10 * k + R(-6, 6) * k, vx: -dx * R(10, 40), vy: -dy * R(10, 40) - 10, life: R(0.4, 0.7), rot: 0, vr: 0, size: R(7, 12) * k, col: Phaser.Utils.Array.GetRandom([0x9b4dff, 0x7a2fd6, 0xd0a8ff]) });
    }
  }

  // ------------------------------------------------------------------ LUZ
  /**
   * (12-11-2026) Esfera de LUZ pura (antes ESTRELLA): núcleo blanco con halo dorado que late, HACES de luz largos que giran despacio,
   * un destello en cruz (lente) que cambia de largo, aros de luz que se abren y motas de luz que se quedan atrás flotando.
   * Sin estrellas. Todo aditivo en el mismo Graphics, sin tweens.
   */
  private drawLight(x: number, y: number, k: number, dx: number, dy: number, dt: number) {
    const g = this.g;
    const pulse = 1 + Math.sin(this.t * 10) * 0.07;
    // halo en capas: dorado grande, crema, blanco
    g.fillStyle(0xffe9a0, 0.14).fillCircle(x, y, 40 * k * pulse);
    g.fillStyle(0xfff0b0, 0.22).fillCircle(x, y, 26 * k * pulse);
    g.fillStyle(0xfffbe0, 0.4).fillCircle(x, y, 15 * k);
    g.fillStyle(0xffffff, 0.8).fillCircle(x, y, 8 * k);
    // haces de luz: triángulos finos que parten de la pelota y giran
    const beams = 8;
    for (let i = 0; i < beams; i++) {
      const a = this.t * 1.3 + (i / beams) * Math.PI * 2;
      const L = (i % 2 ? 46 : 70) * k * (0.85 + 0.15 * Math.sin(this.t * 7 + i * 1.3));
      const w = 0.085;
      g.fillStyle(i % 2 ? 0xfff0b0 : 0xffffff, i % 2 ? 0.35 : 0.5).fillTriangle(
        x, y,
        x + Math.cos(a - w) * L, y + Math.sin(a - w) * L,
        x + Math.cos(a + w) * L, y + Math.sin(a + w) * L,
      );
    }
    // destello en cruz (lente): horizontal más largo, vertical corto, parpadea
    const fl = 0.7 + 0.3 * Math.sin(this.t * 15);
    g.lineStyle(2.6 * k, 0xffffff, 0.85 * fl).lineBetween(x - 54 * k * fl, y, x + 54 * k * fl, y);
    g.lineStyle(2 * k, 0xffffff, 0.7 * fl).lineBetween(x, y - 34 * k * fl, x, y + 34 * k * fl);
    // aros de luz que se abren y se apagan (2, desfasados)
    for (let i = 0; i < 2; i++) {
      const u = (this.t * 1.8 + i * 0.5) % 1;
      g.lineStyle(2.2 * k * (1 - u) + 0.4, 0xfff6cc, 0.55 * (1 - u)).strokeCircle(x, y, (14 + u * 34) * k);
    }
    // motas de luz que se quedan atrás
    this.emit -= dt;
    while (this.emit <= 0) {
      this.emit += 0.04;
      this.add({ x: x - dx * 8 * k + R(-10, 10) * k, y: y - dy * 8 * k + R(-10, 10) * k, vx: -dx * R(10, 45) + R(-20, 20), vy: -dy * R(10, 45) + R(-25, 5), life: R(0.5, 0.9), rot: 0, vr: 0, size: R(2.5, 5) * k, col: Phaser.Utils.Array.GetRandom([0xffffff, 0xfffbe0, 0xfff0b0, 0xcfe9ff]) });
    }
  }

  // ------------------------------------------------------------------ FUEGO
  /**
   * (12-11-2026) Bola de fuego del ESPECIAL: lenguas de llama (rojo, naranja, amarillo) que se agitan detrás de la pelota,
   * resplandor cálido y brasas que suben. Más chica que el INFERNO (la ULTI sigue siendo la más espectacular); `strong` = remate
   * potenciado: lenguas más largas y más brasas. La pelota ya lleva sus llamas redondas (objects/Ball) y su humo (SmokeTrail).
   */
  private drawFire(x: number, y: number, k: number, dx: number, dy: number, dt: number, strong: boolean) {
    const g = this.g;
    // resplandor cálido que late
    const pulse = 1 + Math.sin(this.t * 18) * 0.08;
    g.fillStyle(0xff5a12, 0.22).fillCircle(x, y, 24 * k * pulse);
    g.fillStyle(0xffb020, 0.3).fillCircle(x, y, 15 * k * pulse);
    g.fillStyle(0xfff3b0, 0.35).fillCircle(x, y, 8 * k);
    // lenguas: capas de más larga/roja a más corta/amarilla, en abanico estrecho hacia atrás
    const back = Math.atan2(-dy, -dx);
    const layers = [
      { len: 62, w: 15, col: 0xff3a0a, a: 0.5 },
      { len: 48, w: 12, col: 0xff7a14, a: 0.6 },
      { len: 32, w: 8, col: 0xffd23a, a: 0.75 },
    ];
    const tongues = strong ? 5 : 3;
    for (let t = 0; t < tongues; t++) {
      const spread = (t - (tongues - 1) / 2) * 0.34;
      for (let li = 0; li < layers.length; li++) {
        const L = layers[li];
        const flick = 0.75 + 0.25 * Math.sin(this.t * 22 + t * 1.9 + li);
        const len = L.len * k * flick * (strong ? 1.25 : 1) * (t === (tongues - 1) / 2 ? 1 : 0.78);
        const a = back + spread + Math.sin(this.t * 12 + t * 2.3) * 0.18;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const w = L.w * k;
        const mid = len * 0.45;
        const wob = Math.sin(this.t * 16 + t + li * 0.7) * w * 0.5;
        // gota alargada: base ancha en la pelota, curva suave, punta fina
        g.fillStyle(L.col, L.a).fillPoints([
          { x: x - sa * w, y: y + ca * w },
          { x: x + ca * mid - sa * (w * 0.7 + wob), y: y + sa * mid + ca * (w * 0.7 + wob) },
          { x: x + ca * len + sa * wob * 0.6, y: y + sa * len - ca * wob * 0.6 },
          { x: x + ca * mid + sa * (w * 0.7 - wob), y: y + sa * mid - ca * (w * 0.7 - wob) },
          { x: x + sa * w, y: y - ca * w },
        ], true);
      }
    }
    // brasas que se desprenden y suben
    this.emit -= dt;
    while (this.emit <= 0) {
      this.emit += strong ? 0.02 : 0.04;
      this.add({ x: x - dx * 10 * k + R(-8, 8) * k, y: y - dy * 10 * k + R(-8, 8) * k, vx: -dx * R(20, 70) + R(-25, 25), vy: -dy * R(20, 70) - R(20, 60), life: R(0.35, 0.7), rot: 0, vr: 0, size: R(2.5, 5) * k, col: Phaser.Utils.Array.GetRandom([0xfff1a0, 0xffd23f, 0xffa21a, 0xff5a12]) });
    }
  }

  // ------------------------------------------------------------------ COMETA
  /**
   * (17-11-2026) COMETA (ESPECIAL ÉPICO): la pelota es la cabeza de un METEORITO (roca oscura con grietas al rojo azul y un halo blanco-azul que late)
   * y detrás lleva una COLA de fuego azul larga en capas (azul profundo, azul, celeste, blanco) que ondula, con ESTRELLAS de 5 puntas que se
   * desprenden y caen girando. Más grande y vistoso que los ESPECIALES de rareza especial. Todo en el mismo Graphics (sin tweens).
   */
  private drawMeteor(x: number, y: number, k: number, dx: number, dy: number, dt: number, strong: boolean) {
    const g = this.g;
    const back = Math.atan2(-dy, -dx);
    const ca = Math.cos(back);
    const sa = Math.sin(back);
    const pulse = 1 + Math.sin(this.t * 16) * 0.07;
    // halo de entrada en la atmósfera
    g.fillStyle(0x2f6bff, 0.22).fillCircle(x, y, 30 * k * pulse);
    g.fillStyle(0x9cc4ff, 0.3).fillCircle(x, y, 19 * k * pulse);
    // COLA: 4 capas de llama (de la más larga y oscura a la más corta y clara), en forma de gota alargada que ondula
    const layers = [
      { len: 120, w: 20, col: 0x1f3fd6, a: 0.42 },
      { len: 95, w: 15, col: 0x4f8dff, a: 0.55 },
      { len: 66, w: 10, col: 0x9cc4ff, a: 0.7 },
      { len: 38, w: 6, col: 0xffffff, a: 0.85 },
    ];
    for (let li = 0; li < layers.length; li++) {
      const L = layers[li];
      const len = L.len * k * (strong ? 1.2 : 1) * (0.9 + 0.1 * Math.sin(this.t * 20 + li));
      const w = L.w * k;
      const wob = Math.sin(this.t * 13 + li * 0.8) * w * 0.35;
      const pt = (u: number, side: number) => {
        // ancho que se afina hacia la punta; la línea central ondula un poco
        const ww = w * (1 - u) ** 0.7 * side + wob * u;
        return { x: x + ca * len * u - sa * ww, y: y + sa * len * u + ca * ww };
      };
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i <= 6; i++) pts.push(pt(i / 6, 1));
      for (let i = 6; i >= 0; i--) pts.push(pt(i / 6, -1));
      g.fillStyle(L.col, L.a).fillPoints(pts, true);
    }
    // CABEZA: roca oscura con grietas azules y brillo blanco por delante (de cara al avance)
    const r = 11 * k;
    this.dark.fillStyle(0x141a33, 0.95).fillCircle(x, y, r);
    this.dark.fillStyle(0x283258, 1).fillCircle(x - ca * r * 0.25, y - sa * r * 0.25, r * 0.7);
    const rot = this.t * 3;
    g.lineStyle(1.6 * k, 0x6fa4ff, 0.95);
    for (let i = 0; i < 3; i++) {
      const a = rot + (i * Math.PI * 2) / 3;
      g.lineBetween(x + Math.cos(a) * r * 0.15, y + Math.sin(a) * r * 0.15, x + Math.cos(a + 0.4) * r * 0.85, y + Math.sin(a + 0.4) * r * 0.85);
    }
    g.fillStyle(0xffffff, 0.85).fillCircle(x - ca * r * 0.55, y - sa * r * 0.55, r * 0.42);
    g.lineStyle(2 * k, 0xcfe2ff, 0.9).strokeCircle(x, y, r * 1.05);
    // ESTRELLAS que se desprenden de la cola y caen girando
    this.emit -= dt;
    while (this.emit <= 0) {
      this.emit += strong ? 0.028 : 0.04;
      const u = R(0.2, 0.9);
      const off = R(-12, 12) * k;
      this.add({ x: x + ca * 95 * k * u - sa * off, y: y + sa * 95 * k * u + ca * off, vx: ca * R(10, 40) + R(-20, 20), vy: sa * R(10, 40) + R(-10, 20), life: R(0.45, 0.8), rot: R(0, 6.28), vr: R(-6, 6), size: R(3.5, 6.5) * k, col: Phaser.Utils.Array.GetRandom([0xffffff, 0xeaf4ff, 0xcfe2ff, 0x9cc4ff]) });
    }
  }

  // ------------------------------------------------------------------ DRAGÓN
  /**
   * (18-11-2026) DRAGÓN (ESPECIAL LEGENDARIO): la pelota es la CABEZA de un dragón de fuego (hocico hacia donde vuela, cuernos dorados, ojo que
   * brilla, fauces con fuego) y detrás SERPENTEA su CUERPO (sigue las posiciones recientes de la pelota, ondulando) con escamas rojas, vientre
   * dorado y púas en el lomo; suelta brasas. Lo oscuro en la capa normal (`dark`) y el fuego en la aditiva. Mismo Graphics (sin tweens).
   */
  private drawDragon(x: number, y: number, k: number, dx: number, dy: number, dt: number, strong: boolean) {
    const g = this.g;
    const d = this.dark;
    const pts = this.hist;
    const t = this.t;
    // CUERPO: cinta que se afina hacia la cola, ondulando a los lados de la trayectoria
    if (pts.length >= 4) {
      const n = pts.length;
      const body: { x: number; y: number; nx: number; ny: number; w: number }[] = [];
      for (let i = 0; i < n; i++) {
        const a = pts[Math.max(0, i - 1)];
        const b = pts[Math.min(n - 1, i + 1)];
        let nx = -(b.y - a.y);
        let ny = b.x - a.x;
        const l = Math.hypot(nx, ny) || 1;
        nx /= l;
        ny /= l;
        const q = i / (n - 1);
        const wave = Math.sin(q * Math.PI * 2.4 - t * 14) * 9 * k * q;
        body.push({ x: pts[i].x + nx * wave, y: pts[i].y + ny * wave, nx, ny, w: (strong ? 12 : 10) * k * (1 - q) ** 0.8 + 1.5 * k });
      }
      const band = (scale: number, off = 0) => [
        ...body.map((p) => ({ x: p.x + p.nx * (p.w * scale + off * p.w), y: p.y + p.ny * (p.w * scale + off * p.w) })),
        ...body.map((p) => ({ x: p.x - p.nx * (p.w * scale - off * p.w), y: p.y - p.ny * (p.w * scale - off * p.w) })).reverse(),
      ];
      d.fillStyle(0x2a0404, 0.95).fillPoints(band(1.15), true);
      d.fillStyle(0xb3161a, 1).fillPoints(band(1), true);
      g.fillStyle(0xff7a1a, 0.55).fillPoints(band(0.5, -0.35), true);
      g.fillStyle(0xffd23f, 0.6).fillPoints(band(0.2, -0.55), true);
      // púas doradas en el lomo
      for (let i = 2; i < n - 1; i += 2) {
        const p = body[i];
        const tx = body[i + 1].x - body[i - 1].x;
        const ty = body[i + 1].y - body[i - 1].y;
        const tl = Math.hypot(tx, ty) || 1;
        const sp = p.w * 1.1 + 2 * k;
        const bx = p.x + p.nx * p.w;
        const by = p.y + p.ny * p.w;
        d.fillStyle(0xffc42e, 1).fillTriangle(bx - (tx / tl) * sp * 0.45, by - (ty / tl) * sp * 0.45, bx + (tx / tl) * sp * 0.45, by + (ty / tl) * sp * 0.45, bx + p.nx * sp, by + p.ny * sp);
      }
    }
    // CABEZA: hocico hacia donde vuela
    const hs = (strong ? 17 : 14) * k;
    const P = (fx: number, fy: number) => ({ x: x + dx * fx * hs - dy * fy * hs, y: y + dy * fx * hs + dx * fy * hs });
    const jaw = 0.25 + 0.15 * Math.sin(t * 18);
    g.fillStyle(0xff5a12, 0.3).fillCircle(x, y, hs * 1.7);
    d.fillStyle(0xffe08a, 1).fillPoints([P(-0.3, -0.35), P(-1.2, -0.95), P(-0.55, -0.15)], true); // cuernos
    d.fillStyle(0xffe08a, 1).fillPoints([P(-0.3, 0.35), P(-1.2, 0.95), P(-0.55, 0.15)], true);
    d.fillStyle(0x2a0404, 1).fillPoints([P(-0.7, -0.5), P(0.4, -0.45), P(1.35, -0.12 - jaw * 0.3), P(1.0, 0), P(-0.6, 0.1)], true);
    d.fillStyle(0xc81c1c, 1).fillPoints([P(-0.62, -0.42), P(0.38, -0.37), P(1.22, -0.12 - jaw * 0.3), P(0.9, -0.03), P(-0.52, 0.04)], true);
    d.fillStyle(0x2a0404, 1).fillPoints([P(-0.6, 0.12), P(0.8, 0.12 + jaw * 0.5), P(1.15, 0.25 + jaw * 0.7), P(0.3, 0.45), P(-0.65, 0.42)], true);
    d.fillStyle(0xa81616, 1).fillPoints([P(-0.52, 0.18), P(0.76, 0.16 + jaw * 0.5), P(1.05, 0.26 + jaw * 0.65), P(0.28, 0.38), P(-0.56, 0.36)], true);
    const eye = P(-0.05, -0.22);
    g.fillStyle(0xffd23f, 0.6).fillCircle(eye.x, eye.y, hs * 0.22);
    g.fillStyle(0xffffff, 1).fillCircle(eye.x, eye.y, hs * 0.1);
    // fuego en las fauces (la pelota brilla dentro)
    const m = P(1.05, 0.08 + jaw * 0.3);
    g.fillStyle(0xff7a1a, 0.7).fillCircle(m.x, m.y, hs * 0.38);
    g.fillStyle(0xfff1b8, 0.95).fillCircle(m.x, m.y, hs * 0.18);
    // brasas que se desprenden
    this.emit -= dt;
    while (this.emit <= 0) {
      this.emit += strong ? 0.025 : 0.04;
      const b = pts.length ? pts[Math.floor(R(0, Math.min(pts.length, 10)))] : { x, y };
      this.add({ x: b.x + R(-8, 8) * k, y: b.y + R(-8, 8) * k, vx: R(-25, 25), vy: -R(20, 60), life: R(0.4, 0.75), rot: 0, vr: 0, size: R(2.5, 5) * k, col: Phaser.Utils.Array.GetRandom([0xfff1a0, 0xffd23f, 0xff7a1a, 0xd6201e]) });
    }
  }

  /**
   * (18-11-2026, usuario) PELOTA DRAGÓN con su sprite (DRAGON_BALL): la cabeza girada hacia donde vuela y, detrás, el RASTRO DE FUEGO de la
   * pelota de fuego (lenguas, resplandor y brasas) más brasas doradas que quedan por el camino. false = la hoja no cargó (se dibuja por código).
   */
  private drawDragonSprite(x: number, y: number, k: number, dx: number, dy: number, dt: number, strong: boolean, groundY: number): boolean {
    const sc = this.scene;
    if (!sc.textures.exists(DRAGON_BALL.key)) return false;
    if (!sc.anims.exists(DRAGON_BALL.anim)) {
      sc.anims.create({ key: DRAGON_BALL.anim, frames: sc.anims.generateFrameNumbers(DRAGON_BALL.key, { start: 0, end: DRAGON_BALL.frames - 1 }), frameRate: DRAGON_BALL.fps, repeat: -1 });
    }
    if (!this.dragonImg || !this.dragonImg.active) {
      this.dragonImg = sc.add.sprite(0, 0, DRAGON_BALL.key, 0);
      this.dragonImg.play(DRAGON_BALL.anim);
    }
    // rastro: el fuego de la pelota de fuego (más largo) y brasas que se quedan atrás
    this.drawFire(x, y, k * 1.25, dx, dy, dt, true);
    this.emit -= dt;
    while (this.emit <= 0) {
      this.emit += strong ? 0.02 : 0.032;
      const b = this.hist.length ? this.hist[Math.floor(R(0, Math.min(this.hist.length, 12)))] : { x, y };
      this.add({ x: b.x + R(-10, 10) * k, y: b.y + R(-10, 10) * k, vx: R(-30, 30), vy: -R(20, 70), life: R(0.45, 0.85), rot: 0, vr: 0, size: R(3, 6) * k, col: Phaser.Utils.Array.GetRandom([0xfff1a0, 0xffd23f, 0xff7a1a, 0xd6201e]) });
    }
    // cabeza: el hocico (arriba en la imagen) apunta hacia donde vuela; se adelanta para que la cabeza quede sobre la pelota
    const img = this.dragonImg.setVisible(true);
    const hgt = DRAGON_BALL.size * k * this.dragonScale;
    img.setScale(hgt / DRAGON_BALL.cell);
    img.setRotation(Math.atan2(dy, dx) + Math.PI / 2);
    img.setPosition(x - dx * hgt * DRAGON_BALL.lead, y - dy * hgt * DRAGON_BALL.lead);
    img.setDepth(groundY + 3.2);
    return true;
  }

  clear() {
    this.dragonImg?.setVisible(false);
    this.dark.clear();
    this.parts.length = 0;
    this.hist.length = 0;
    this.bolts.length = 0;
    this.g.clear();
  }
}

/**
 * (14-11-2026) DROP SHOT 0 en vuelo: AIRE DE VENTILADOR que irradia de la pelota: aspas curvas que giran muy rápido
 * alrededor, aros de aire que se abren y líneas de aire que salen hacia fuera en todas direcciones.
 * (17-11-2026) Opciones (DropZeroOpts) para reutilizarlo en grande en la ULTI ULTRA EFECTO (fx/InfernoFx.ts); sin opciones
 * es exactamente el del DROP SHOT 0 de siempre.
 */
export interface DropZeroOpts {
  /** tamaño (radios de aros, aspas y líneas) respecto al del drop shot 0 */
  scale?: number;
  /** cantidad de aspas, aros y líneas de aire por segundo */
  blades?: number;
  rings?: number;
  streaksPerSec?: number;
  /** multiplica la opacidad (más brillante; tope 1) */
  bright?: number;
  /** cuánto se alejan las líneas de aire (1 = como el drop shot 0; menos en las vistas previas para no salirse de la tarjeta) */
  reach?: number;
}
export class DropZeroFx {
  private g: Phaser.GameObjects.Graphics;
  private t = 0;
  private streaks: { a: number; r: number; v: number; life: number; age: number }[] = [];
  private emit = 0;
  private readonly S: number;
  private readonly W: number;
  private readonly blades: number;
  private readonly rings: number;
  private readonly every: number;
  private readonly bright: number;
  private readonly reach: number;

  constructor(scene: Phaser.Scene, o: DropZeroOpts = {}) {
    this.g = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this.S = o.scale ?? 1;
    this.W = 1 + (this.S - 1) * 0.5; // grosor de los trazos: crece menos que el tamaño
    this.blades = o.blades ?? 4;
    this.rings = o.rings ?? 3;
    this.every = 1 / (o.streaksPerSec ?? 50);
    this.bright = o.bright ?? 1;
    this.reach = o.reach ?? 1;
  }

  /** El Graphics del efecto (para meterlo en un contenedor: vistas previas). */
  get gfx() {
    return this.g;
  }

  update(dt: number, ball: BallState, on: boolean, visible = true) {
    if (!on || !visible) return this.hide();
    const air = project(ball.x, ball.y, ball.z);
    const ground = project(ball.x, ball.y, 0);
    const k = air.s * 0.8 * (1 + Math.min(ball.z, 220) / 700);
    this.drawAt(dt, air.sx, air.sy, k, ground.sy + 3);
  }

  /** Borra el dibujo y las líneas de aire en curso. */
  hide() {
    if (this.g.commandBuffer.length) this.g.clear();
    this.streaks.length = 0;
  }

  /** Dibuja el efecto centrado en (x, y) de pantalla, con escala de pelota `k` y profundidad `depth`. */
  drawAt(dt: number, x: number, y: number, k: number, depth: number) {
    const g = this.g;
    g.clear();
    this.t += dt;
    const S = this.S;
    const W = this.W;
    const A = (a: number) => Math.min(1, a * this.bright);
    g.setDepth(depth);
    // aros de aire que se abren (desfasados)
    for (let i = 0; i < this.rings; i++) {
      const u = (this.t * 2.6 + i / this.rings) % 1;
      g.lineStyle(3 * W * k * (1 - u) + 0.5, 0xe0fff0, A(0.6 * (1 - u))).strokeCircle(x, y, (12 + u * 46) * S * k);
    }
    // ASPAS del ventilador: aspas curvas que giran muy rápido
    const spin = this.t * 22;
    const R0 = 9 * S * k;
    const R1 = 30 * S * k;
    for (let b = 0; b < this.blades; b++) {
      const a0 = spin + (b * Math.PI * 2) / this.blades;
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i <= 8; i++) {
        const u = i / 8;
        const r = R0 + (R1 - R0) * u;
        const a = a0 + u * 0.9; // curvada
        pts.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
      }
      for (let i = 8; i >= 0; i--) {
        const u = i / 8;
        const r = R0 + (R1 - R0) * u;
        const a = a0 + u * 0.9 + 0.45 * (1 - u * 0.6); // ancho del aspa
        pts.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
      }
      g.fillStyle(0xc8ffd8, A(0.32)).fillPoints(pts, true);
      g.lineStyle(2 * W * k, 0xffffff, A(0.8)).strokePoints(pts.slice(0, 9), false);
    }
    g.fillStyle(0xffffff, A(0.5)).fillCircle(x, y, 6 * W * k);
    // líneas de aire que IRRADIAN hacia fuera
    this.emit -= dt;
    while (this.emit <= 0) {
      this.emit += this.every;
      this.streaks.push({ a: R(0, Math.PI * 2), r: R(14, 22), v: R(110, 170) * this.reach, life: R(0.22, 0.34), age: 0 });
    }
    for (let i = this.streaks.length - 1; i >= 0; i--) {
      const st = this.streaks[i];
      st.age += dt;
      if (st.age >= st.life) {
        this.streaks.splice(i, 1);
        continue;
      }
      const f = st.age / st.life;
      const r0 = (st.r + st.v * st.age) * S * k;
      const r1 = r0 + 22 * S * k * (1 - f * 0.4);
      // (15-11-2026) líneas CURVAS en espiral que siguen girando con las aspas (antes rectas): el ángulo avanza con el radio
      // (curvatura) y con el tiempo (giro)
      const a0 = st.a + this.t * 5;
      const pts: { x: number; y: number }[] = [];
      for (let j = 0; j <= 6; j++) {
        const rr = r0 + ((r1 - r0) * j) / 6;
        const aa = a0 + (rr / (S * k)) * 0.045;
        pts.push({ x: x + Math.cos(aa) * rr, y: y + Math.sin(aa) * rr });
      }
      g.lineStyle(2.4 * W * k * (1 - f) + 0.6, 0xffffff, A(0.85 * (1 - f))).strokePoints(pts, false);
    }
  }

  destroy() {
    this.g.destroy();
  }
}

/** DROP SHOT 0 al botar: golpe de aire a ras de suelo (aro aplastado + rayos de aire) y la pelota sale hacia atrás. */
export function dropZeroBounceFx(scene: Phaser.Scene, x: number, y: number, k: number) {
  const s = Math.max(0.7, k);
  const ADD = Phaser.BlendModes.ADD;
  for (let i = 0; i < 2; i++) {
    const ring = scene.add.ellipse(x, y, 40 * s, 14 * s).setStrokeStyle(4 * s, i ? 0x8ff0b0 : 0xffffff, 1).setDepth(y + 4).setBlendMode(ADD);
    scene.tweens.add({ targets: ring, scale: 4, alpha: 0, delay: i * 70, duration: 380, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
  }
  const lines = scene.add.graphics({ x, y }).setDepth(y + 4).setBlendMode(ADD);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    lines.lineStyle(3 * s, 0xe0fff0, 0.9).lineBetween(Math.cos(a) * 14 * s, Math.sin(a) * 5 * s, Math.cos(a) * 60 * s, Math.sin(a) * 20 * s);
  }
  lines.setScale(0.5);
  scene.tweens.add({ targets: lines, scale: 1.4, alpha: 0, duration: 300, ease: 'Quad.easeOut', onComplete: () => lines.destroy() });
}
