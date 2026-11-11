import Phaser from 'phaser';

/**
 * RED DE TENIS del partido (solo visual + sonido; la física de la red sigue en objects/Ball.stepBall).
 *
 *   malla    rombos finos y semitransparentes (se ve la pelota y el rival detrás)
 *   cinta    blanca con volumen (borde oscuro + brillo); cae un poco hacia el centro como una red real: en el centro
 *            mide NET_HEIGHT (la altura de la física) y sube hacia los postes
 *   correa   tira blanca vertical en el centro que la sujeta
 *   postes   con tapa, y sombra de toda la red en el suelo
 *   reacción la pelota que pega en la red la hace ondular y sacudirse (hit); la que roza la cinta la hace vibrar (brush)
 *   sonido   sintetizado (sin archivos): golpe sordo en la malla, "tic" seco al rozar la cinta. Respeta el ajuste de sonido.
 *
 * Coordenadas de cancha (x = profundidad, y = lateral, z = altura); `project` las pasa a pantalla.
 * Lo fijo (sombra, postes) se pinta una vez; malla y cinta se redibujan solo mientras se mueven.
 */
export type Projector = (x: number, y: number, z?: number) => { x: number; y: number };

const LOOK = {
  /** tamaño del rombo (unidades de cancha) */
  cell: 13,
  /** cuánto más alta es la cinta en los postes que en el centro (fracción de NET_HEIGHT) */
  sag: 0.12,
  meshCol: 0xe6eaf7,
  meshAlpha: 0.42,
  fill: 0x1b2036,
  fillAlpha: 0.22,
  tape: 0xffffff,
  tapeShade: 0xc7cde0,
  outline: 0x101426,
  // postes AZULES (antes gris claro): cuerpo, sombra lateral y tapa
  post: 0x5aa8ff,
  postDark: 0x1d5fd0,
};

/** ondulación tras un golpe en la malla */
const HIT = { amp: 26, sigma: 70, sigmaZ: 22, freq: 17, decay: 0.22, ms: 900 };
/** vibración de la cinta al rozarla */
const BRUSH = { amp: 2.6, freq: 46, k: 0.09, decay: 0.12, ms: 520 };

interface Hit {
  y: number;
  z: number;
  dir: number;
  power: number;
  t0: number;
}

export class NetView {
  private readonly g: Phaser.GameObjects.Graphics;
  private hits: Hit[] = [];
  private brushes: { y: number; t0: number; power: number }[] = [];
  private dirty = true;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly P: Projector,
    private readonly netX: number,
    private readonly y0: number,
    private readonly y1: number,
    private readonly H: number,
    depth: number,
  ) {
    this.bakeStatic(depth);
    this.g = scene.add.graphics().setDepth(depth);
    this.draw(0);
  }

  /** altura de la cinta en el lateral y (más baja en el centro, como una red real) */
  private top(y: number) {
    const u = (y - this.y0) / (this.y1 - this.y0); // 0..1
    const e = Math.abs(u - 0.5) * 2; // 0 centro, 1 postes
    return this.H * (1 + LOOK.sag * e * e);
  }

  /** sombra en el suelo y postes con tapa: una sola vez (renderTexture) */
  private bakeStatic(depth: number) {
    const { P, netX, y0, y1, H } = this;
    const g = this.scene.make.graphics({}, false);
    // sombra: franja oscura aplastada detrás de la red
    const sh = [P(netX + 2, y0, 0), P(netX + 2, y1, 0), P(netX + 12, y1, 0), P(netX + 12, y0, 0)];
    g.fillStyle(0x000000, 0.22).fillPoints(sh, true);
    g.fillStyle(0x000000, 0.18).fillRect(Math.min(sh[0].x, sh[1].x), sh[0].y - 2, Math.abs(sh[1].x - sh[0].x), 5);
    // postes: cuerpo con sombra lateral y tapa redonda
    const postTop = H * (1 + LOOK.sag) + 5;
    for (const y of [y0, y1]) {
      const b = P(netX, y, 0);
      const t = P(netX, y, postTop);
      g.lineStyle(11, LOOK.outline).lineBetween(t.x, t.y, b.x, b.y);
      g.lineStyle(7, LOOK.postDark).lineBetween(t.x, t.y, b.x, b.y);
      g.lineStyle(3.5, LOOK.post).lineBetween(t.x - 1.2, t.y, b.x - 1.2, b.y);
      g.fillStyle(LOOK.outline).fillCircle(t.x, t.y, 7);
      g.fillStyle(LOOK.post).fillCircle(t.x, t.y, 5);
      g.fillStyle(0xffffff, 0.8).fillCircle(t.x - 1.5, t.y - 1.5, 1.8);
      // pie del poste
      g.fillStyle(0x000000, 0.25).fillEllipse(b.x + 3, b.y + 2, 18, 6);
    }
    const a = P(netX, y0, 0);
    const c = P(netX, y1, postTop);
    const minX = Math.floor(Math.min(a.x, c.x) - 30);
    const minY = Math.floor(c.y - 30);
    const w = Math.ceil(Math.abs(c.x - a.x) + 60);
    const h = Math.ceil(a.y - c.y + 60);
    this.scene.add.renderTexture(minX, minY, w, h).setOrigin(0).setDepth(depth - 0.01).draw(g, -minX, -minY);
    g.destroy();
  }

  /** La pelota pegó en la malla (lateral y, altura z; vx = su velocidad en profundidad antes del choque). */
  hit(y: number, z: number, vx: number) {
    const power = Phaser.Math.Clamp(Math.abs(vx) / 900, 0.35, 1.3);
    this.hits.push({ y, z: Phaser.Math.Clamp(z, 4, this.H), dir: Math.sign(vx) || 1, power, t0: this.scene.time.now });
    if (this.hits.length > 3) this.hits.shift();
    this.dirty = true;
    netSound.thump(this.scene, power);
  }

  /** La pelota rozó la cinta por encima (let / casi red). */
  brush(y: number, speed: number) {
    const power = Phaser.Math.Clamp(speed / 900, 0.4, 1.2);
    this.brushes.push({ y, t0: this.scene.time.now, power });
    if (this.brushes.length > 3) this.brushes.shift();
    this.dirty = true;
    netSound.tick(this.scene, power);
  }

  /** Cada frame: solo redibuja si hay algo moviéndose. */
  update() {
    const now = this.scene.time.now;
    this.hits = this.hits.filter((h) => now - h.t0 < HIT.ms);
    this.brushes = this.brushes.filter((b) => now - b.t0 < BRUSH.ms);
    const moving = this.hits.length > 0 || this.brushes.length > 0;
    if (!moving && !this.dirty) return;
    this.dirty = moving; // un último dibujo en reposo al acabar
    this.draw(now);
  }

  /** desplazamiento en profundidad (x) de un punto de la malla por los golpes */
  private bulge(y: number, z: number, now: number) {
    let d = 0;
    for (const h of this.hits) {
      const t = (now - h.t0) / 1000;
      const env = Math.exp(-t / HIT.decay);
      const fall = Math.exp(-((y - h.y) ** 2) / (2 * HIT.sigma ** 2)) * Math.exp(-((z - h.z) ** 2) / (2 * HIT.sigmaZ ** 2) * 0.5);
      // primer empujón en el sentido de la pelota y luego oscila
      d += h.dir * HIT.amp * h.power * fall * env * Math.cos(HIT.freq * t);
    }
    return d;
  }

  /** desplazamiento vertical de la cinta (vibración al rozar; los golpes la sacuden un poco) */
  private tapeWobble(y: number, now: number) {
    let dz = 0;
    for (const b of this.brushes) {
      const t = (now - b.t0) / 1000;
      dz += BRUSH.amp * b.power * Math.exp(-t / BRUSH.decay) * Math.sin(BRUSH.freq * t - Math.abs(y - b.y) * BRUSH.k) * Math.exp(-Math.abs(y - b.y) / 260);
    }
    for (const h of this.hits) {
      const t = (now - h.t0) / 1000;
      dz -= 2.2 * h.power * Math.exp(-t / HIT.decay) * Math.abs(Math.sin(HIT.freq * t)) * Math.exp(-((y - h.y) ** 2) / (2 * (HIT.sigma * 1.6) ** 2));
    }
    return dz;
  }

  private pt(y: number, z: number, now: number) {
    return this.P(this.netX + this.bulge(y, z, now), y, z);
  }

  private draw(now: number) {
    const g = this.g;
    const { y0, y1 } = this;
    g.clear();
    const steps = 48;
    const tapeZ = (y: number) => this.top(y) + this.tapeWobble(y, now);

    // fondo de la malla (muy translúcido): da cuerpo sin tapar
    const poly: { x: number; y: number }[] = [];
    for (let i = 0; i <= steps; i++) {
      const y = y0 + ((y1 - y0) * i) / steps;
      poly.push(this.pt(y, tapeZ(y) - 1, now));
    }
    for (let i = steps; i >= 0; i--) {
      const y = y0 + ((y1 - y0) * i) / steps;
      poly.push(this.pt(y, 0, now));
    }
    g.fillStyle(LOOK.fill, LOOK.fillAlpha).fillPoints(poly, true);

    // rombos: dos familias de diagonales (z = ±(y - c)), recortadas entre el suelo y la cinta
    g.lineStyle(1.2, LOOK.meshCol, LOOK.meshAlpha);
    const cell = LOOK.cell;
    const span = y1 - y0;
    const maxZ = this.H * (1 + LOOK.sag);
    for (const sgn of [1, -1]) {
      for (let c = -maxZ; c <= span + maxZ; c += cell) {
        let prev: { x: number; y: number } | null = null;
        for (let z = 0; z <= maxZ + 0.01; z += cell / 2) {
          const y = y0 + (sgn > 0 ? c + z : c + maxZ - z);
          if (y < y0 || y > y1 || z > tapeZ(y) - 1.5) {
            prev = null;
            continue;
          }
          const p = this.pt(y, z, now);
          if (prev) g.lineBetween(prev.x, prev.y, p.x, p.y);
          prev = p;
        }
      }
    }
    // borde inferior de la malla (cuerda) y franja más oscura bajo la cinta
    g.lineStyle(2, LOOK.meshCol, 0.55);
    this.polyline(g, (y) => this.pt(y, 1.5, now), steps);
    g.lineStyle(6, LOOK.fill, 0.5);
    this.polyline(g, (y) => this.pt(y, tapeZ(y) - 4, now), steps);

    // correa central
    const yc = (y0 + y1) / 2;
    const cTop = this.pt(yc, tapeZ(yc), now);
    const cBot = this.pt(yc, 0, now);
    g.lineStyle(7, LOOK.outline, 0.85).lineBetween(cTop.x, cTop.y, cBot.x, cBot.y);
    g.lineStyle(4, LOOK.tape).lineBetween(cTop.x, cTop.y, cBot.x, cBot.y);

    // cinta: contorno, cuerpo blanco y brillo superior
    g.lineStyle(10, LOOK.outline, 0.95);
    this.polyline(g, (y) => this.pt(y, tapeZ(y), now), steps);
    g.lineStyle(6.5, LOOK.tapeShade);
    this.polyline(g, (y) => this.pt(y, tapeZ(y), now), steps);
    g.lineStyle(3.5, LOOK.tape);
    this.polyline(g, (y) => {
      const p = this.pt(y, tapeZ(y), now);
      return { x: p.x, y: p.y - 1.2 };
    }, steps);
  }

  private polyline(g: Phaser.GameObjects.Graphics, at: (y: number) => { x: number; y: number }, steps: number) {
    g.beginPath();
    for (let i = 0; i <= steps; i++) {
      const p = at(this.y0 + ((this.y1 - this.y0) * i) / steps);
      if (i === 0) g.moveTo(p.x, p.y);
      else g.lineTo(p.x, p.y);
    }
    g.strokePath();
  }

  destroy() {
    this.g.destroy();
  }
}

// ---------------------------------------------------------------- sonido (sintetizado)
function audio(scene: Phaser.Scene): AudioContext | null {
  if (scene.sound.mute) return null;
  const ctx = (scene.sound as unknown as { context?: AudioContext }).context;
  if (!ctx || ctx.state !== 'running') return null;
  return ctx;
}

function noiseBurst(ctx: AudioContext, at: number, dur: number, freq: number, q: number, vol: number) {
  const len = Math.ceil(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(at);
  src.stop(at + dur + 0.02);
}

export const netSound = {
  /** golpe sordo contra la malla (más fuerte cuanto más rápida venía la pelota) */
  thump(scene: Phaser.Scene, power = 1) {
    const ctx = audio(scene);
    if (!ctx) return;
    const at = ctx.currentTime;
    const vol = 0.22 * Math.min(1.2, power);
    noiseBurst(ctx, at, 0.16, 520, 0.9, vol);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, at);
    o.frequency.exponentialRampToValueAtTime(70, at + 0.16);
    g.gain.setValueAtTime(vol * 0.9, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
    o.connect(g).connect(ctx.destination);
    o.start(at);
    o.stop(at + 0.2);
  },
  /** "tic" seco al rozar la cinta */
  tick(scene: Phaser.Scene, power = 1) {
    const ctx = audio(scene);
    if (!ctx) return;
    noiseBurst(ctx, ctx.currentTime, 0.07, 2600, 3, 0.16 * Math.min(1.2, power));
  },
};
