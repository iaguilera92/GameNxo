import Phaser from 'phaser';
import { ENERGY_CINE } from '../logic/EnergyRally';
import { ENERGY_COL, EnergyBallFx, ensureEnergyGlow } from './energyBallFx';

/**
 * (17-11-2026) CINEMÁTICA EXTRA de la ULTI LEGENDARIA BOLA DE ENERGÍA (lo que se dibuja; el guion está en logic/EnergyRally.ts y
 * la escena mueve personajes y pelota). Distinta de la carga normal de la ULTI:
 *   carga (6 s)   (17-11-2026, cambio) SIN esfera sobre la cabeza: los orbes de luz llegan en espiral desde los bordes y se METEN
 *                 EN EL CUERPO del personaje, que brilla cada vez más (cada orbe que entra lo hace latir); aros de energía giran
 *                 alrededor de su cuerpo, rayos saltan desde fuera hacia él y una onda recorre el suelo en cada latido.
 *   peloteo       la cancha sigue en penumbra (menos que en la carga) y se aclara al golpe final.
 *   golpe final   (17-11-2026) la ESFERA crece AHORA, en la raqueta (drawGrow: esfera + aros + rayos + orbes que entran en ella)
 *                 justo antes de salir disparada.
 * Todo se crea UNA vez (pool) y se anima con tiempo real (el partido está congelado).
 */
const ORBS = 18;
const GLOW = 'fx-energy-glow';

export interface EnergyFocus {
  /** centro del cuerpo, raqueta, escala de perspectiva, medio alto del cuerpo y profundidad del personaje (mundo) */
  x: number;
  y: number;
  racketX: number;
  racketY: number;
  s: number;
  hh?: number;
  depth: number;
  /** pies (para la onda del suelo) */
  feetY: number;
}


export class EnergyCineFx {
  private sphere: EnergyBallFx;
  private orbs: Phaser.GameObjects.Image[] = [];
  private orbA = new Float32Array(ORBS);
  private orbR = new Float32Array(ORBS);
  private orbV = new Float32Array(ORBS);
  private rings: Phaser.GameObjects.Graphics;
  private bolts: Phaser.GameObjects.Graphics;
  private dark: Phaser.GameObjects.Rectangle;
  /** brillo del cuerpo durante la carga (halo celeste + núcleo blanco) */
  private bodyHalo: Phaser.GameObjects.Image;
  private bodyCore: Phaser.GameObjects.Image;
  /** latido extra cuando un orbe entra en el cuerpo (decae solo) */
  private absorb = 0;
  private boltT = 0;
  private lastE = 0;
  private darkA = 0;
  private growing = false;
  private growT = 0;

  constructor(private scene: Phaser.Scene) {
    ensureEnergyGlow(scene);
    const ADD = Phaser.BlendModes.ADD;
    this.dark = scene.add.rectangle(0, 0, 10, 10, 0x02040c, 1).setOrigin(0.5).setDepth(0.95).setVisible(false);
    this.rings = scene.add.graphics().setBlendMode(ADD).setVisible(false);
    this.bolts = scene.add.graphics().setBlendMode(ADD).setVisible(false);
    this.bodyHalo = scene.add.image(0, 0, GLOW).setTint(ENERGY_COL.cyan).setBlendMode(ADD).setVisible(false);
    this.bodyCore = scene.add.image(0, 0, GLOW).setTint(ENERGY_COL.core).setBlendMode(ADD).setVisible(false);
    for (let i = 0; i < ORBS; i++) this.orbs.push(scene.add.image(0, 0, GLOW).setBlendMode(ADD).setVisible(false));
    this.sphere = new EnergyBallFx(scene);
    this.resetOrbs();
  }

  private resetOrbs() {
    for (let i = 0; i < ORBS; i++) {
      this.orbA[i] = (i / ORBS) * Math.PI * 2;
      this.orbR[i] = 1 + (i % 5) * 0.12; // radio relativo (1 = lejos)
      this.orbV[i] = 0;
    }
  }

  /** Empieza la carga (llamar una vez). */
  start() {
    this.lastE = 0;
    this.boltT = 0;
    this.absorb = 0;
    this.growing = false;
    this.resetOrbs();
  }

  /**
   * Orbes en espiral hacia (cx, cy) desde `far` px. `speed` = 0..1 (más rápido cuanto más carga). Devuelve cuántos entraron
   * este fotograma (cada uno hace latir lo que los recibe).
   */
  private stepOrbs(dt: number, cx: number, cy: number, far: number, speed: number, k: number, on: boolean): number {
    let hits = 0;
    for (let i = 0; i < ORBS; i++) {
      const o = this.orbs[i];
      if (!on) {
        o.setVisible(false);
        continue;
      }
      this.orbV[i] += dt * (0.5 + 1.6 * speed);
      this.orbR[i] -= this.orbV[i] * dt;
      this.orbA[i] += dt * (2.2 + 2.5 * speed) * (1.2 - Math.max(0, this.orbR[i]));
      if (this.orbR[i] <= 0.04) {
        hits++;
        this.orbR[i] = 1 + Math.random() * 0.3;
        this.orbV[i] = 0;
        this.orbA[i] = Math.random() * Math.PI * 2;
      }
      const r = this.orbR[i] * far;
      const size = (10 + 16 * (1 - this.orbR[i])) * (0.7 + 0.4 * k);
      o.setTint(i % 3 === 0 ? ENERGY_COL.core : i % 3 === 1 ? ENERGY_COL.cyan : ENERGY_COL.light)
        .setPosition(cx + Math.cos(this.orbA[i]) * r, cy + Math.sin(this.orbA[i]) * r * 0.8)
        .setDisplaySize(size, size)
        .setAlpha(Math.min(1, 0.3 + (1 - this.orbR[i])))
        .setDepth(3690)
        .setVisible(true);
    }
    return hits;
  }

  /** Cada fotograma de la carga: `e` = ms desde que empezó; `f` = el personaje que la lanza. */
  drawCharge(e: number, f: EnergyFocus) {
    const dt = Math.min(0.05, Math.max(0, (e - this.lastE) / 1000));
    this.lastE = e;
    const H = ENERGY_CINE.hitAtMs;
    const k = f.s;
    const hh = f.hh ?? 60 * k;
    const grow = Math.min(1, e / 4800);
    const end = e > H - 450 ? Math.max(0, (H - e) / 450) : 1;
    this.sphere.hide();

    // orbes: en espiral hacia el CUERPO (se meten en él)
    const v = this.scene.cameras.main.worldView;
    const far = Math.max(v.width, v.height) * 0.55;
    const hits = this.stepOrbs(dt, f.x, f.y, far, grow, k, e > 300 && e < H - 250);
    this.absorb = Math.min(1, this.absorb * Math.exp(-dt * 7) + hits * 0.35);

    // el cuerpo brilla cada vez más (y late con cada orbe que entra)
    const pulse = 1 + 0.06 * Math.sin(e / 70) + 0.18 * this.absorb;
    const on = e > 200;
    this.bodyHalo
      .setPosition(f.x, f.y)
      .setDisplaySize(hh * (1.7 + 1.5 * grow) * pulse, hh * (2.3 + 1.6 * grow) * pulse)
      .setAlpha((0.12 + 0.55 * grow + 0.25 * this.absorb) * end)
      .setDepth(f.depth + 0.45)
      .setVisible(on);
    this.bodyCore
      .setPosition(f.x, f.y - hh * 0.15)
      .setDisplaySize(hh * (0.6 + 1.0 * grow) * pulse, hh * (0.8 + 1.2 * grow) * pulse)
      .setAlpha((0.1 + 0.5 * grow + 0.3 * this.absorb) * end)
      .setDepth(f.depth + 0.46)
      .setVisible(on);

    // aros de energía que giran alrededor del cuerpo (inclinados) + onda en el suelo en cada latido
    const g = this.rings.clear().setDepth(f.depth + 0.5).setVisible(true);
    const ringsK = Math.min(1, e / 1200) * end;
    if (ringsK > 0) {
      for (let i = 0; i < 3; i++) {
        const rx = hh * (0.85 + 0.25 * i) * (1 + 0.04 * Math.sin(e / 90 + i));
        const ry = rx * 0.32;
        const a0 = e / (260 - i * 50) + i * 2.1;
        const cy = f.y + hh * (0.35 - 0.45 * i);
        g.lineStyle((5 - i) * k + 1, i === 1 ? ENERGY_COL.core : ENERGY_COL.cyan, 0.75 * ringsK);
        g.strokeEllipse(f.x, cy, rx * 2, ry * 2, 24);
        // destello que recorre cada aro
        g.fillStyle(ENERGY_COL.core, 0.95 * ringsK).fillCircle(f.x + Math.cos(a0) * rx, cy + Math.sin(a0) * ry, (4 + 2 * i) * k);
      }
      const beat = (e % 900) / 900;
      g.lineStyle(6 * k * (1 - beat) + 1, ENERGY_COL.cyan, 0.7 * (1 - beat) * ringsK);
      g.strokeEllipse(f.x, f.feetY, hh * (1 + 3.5 * beat) * 2, hh * (0.3 + 1.05 * beat) * 2);
    }

    // rayos desde fuera HACIA el cuerpo, a saltos
    this.boltT -= dt;
    this.bolts.setDepth(f.depth + 0.55).setVisible(e > 600 && e < H - 200);
    if (this.boltT <= 0 && e > 600) {
      this.boltT = 0.06 + Math.random() * 0.05;
      const n = 2 + Math.floor(grow * 3);
      this.drawInBolts(n, f.x, f.y, hh * 1.9, hh, k);
    }
  }

  /** `n` rayos en zigzag desde un círculo de radio `r0` alrededor de (cx, cy) hasta dentro (radio `rin`). */
  private drawInBolts(n: number, cx: number, cy: number, r0: number, rin: number, k: number) {
    const b = this.bolts.clear();
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sx = cx + Math.cos(a) * r0;
      const sy = cy + Math.sin(a) * r0 * 0.9;
      const tx = cx + (Math.random() - 0.5) * rin * 0.6;
      const ty = cy + (Math.random() - 0.5) * rin * 0.9;
      for (const [w, col, al] of [
        [6 * k + 1, ENERGY_COL.deep, 0.35],
        [2.6 * k + 1, ENERGY_COL.cyan, 0.9],
        [1.2 * k + 0.6, ENERGY_COL.core, 1],
      ] as const) {
        b.lineStyle(w, col, al).beginPath().moveTo(sx, sy);
        for (let j = 1; j <= 5; j++) {
          const q = j / 5;
          const o = j < 5 ? (Math.random() - 0.5) * 26 * k : 0;
          b.lineTo(sx + (tx - sx) * q + o, sy + (ty - sy) * q + o * 0.4);
        }
        b.strokePath();
      }
    }
  }

  /**
   * (17-11-2026) GOLPE FINAL: la BOLA DE ENERGÍA CRECE en la raqueta antes de salir. `u` = 0..1 del momento de crecer; (x, y) =
   * la raqueta / pelota en pantalla; `R` = radio con el que vuela (crece de casi nada, se pasa un poco y se asienta en R);
   * `k` = escala de perspectiva; `d` = profundidad. Esfera + aros que giran + rayos que entran + orbes que se meten en ella.
   */
  drawGrow(dt: number, u: number, f: EnergyFocus) {
    // (17-11-2026, usuario) SIN esfera en el personaje: como al empezar la carga, las partículas van HACIA su cuerpo y le SALEN
    // RAYOS del cuerpo hacia fuera; la bola sale después chica y crece en vuelo (InfernoFire.energyGrowSec)
    if (!this.growing) {
      this.growing = true;
      this.growT = 0;
      this.resetOrbs();
      for (let i = 0; i < ORBS; i++) this.orbR[i] = 0.5 + (i % 6) * 0.1;
    }
    this.growT += dt;
    const q = Math.max(0, Math.min(1, u));
    const k = f.s;
    const hh = f.hh ?? 60 * k;
    this.sphere.hide();
    // partículas en espiral hacia el cuerpo
    const v = this.scene.cameras.main.worldView;
    const hits = this.stepOrbs(dt, f.x, f.y, Math.max(v.width, v.height) * 0.45, 0.7 + 0.3 * q, k, q < 0.92);
    this.absorb = Math.min(1, this.absorb * Math.exp(-dt * 7) + hits * 0.35);
    // el cuerpo brilla fuerte y late
    const pulse = 1 + 0.08 * Math.sin(this.growT * 22) + 0.2 * this.absorb;
    this.bodyHalo
      .setPosition(f.x, f.y)
      .setDisplaySize(hh * 3.2 * pulse, hh * 3.9 * pulse)
      .setAlpha(0.6 + 0.3 * this.absorb)
      .setDepth(f.depth + 0.45)
      .setVisible(true);
    this.bodyCore
      .setPosition(f.x, f.y - hh * 0.15)
      .setDisplaySize(hh * 1.6 * pulse, hh * 2.0 * pulse)
      .setAlpha(0.6 + 0.3 * this.absorb)
      .setDepth(f.depth + 0.46)
      .setVisible(true);
    this.rings.clear().setVisible(false);
    // rayos que SALEN del cuerpo hacia fuera, a saltos
    this.boltT -= dt;
    this.bolts.setDepth(f.depth + 0.55).setVisible(true);
    if (this.boltT <= 0) {
      this.boltT = 0.05 + Math.random() * 0.04;
      this.drawOutBolts(3 + Math.floor(q * 3), f.x, f.y, hh * 0.35, hh * (1.6 + 0.8 * q), k);
    }
  }

  /** `n` rayos en zigzag desde cerca del centro (cx, cy) (radio `rin`) hacia fuera hasta el radio `r1`. */
  private drawOutBolts(n: number, cx: number, cy: number, rin: number, r1: number, k: number) {
    const b = this.bolts.clear();
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sx = cx + Math.cos(a) * rin;
      const sy = cy + Math.sin(a) * rin * 0.9;
      const tx = cx + Math.cos(a + (Math.random() - 0.5) * 0.5) * r1;
      const ty = cy + Math.sin(a + (Math.random() - 0.5) * 0.5) * r1 * 0.9;
      for (const [w, col, al] of [
        [6 * k + 1, ENERGY_COL.deep, 0.35],
        [2.6 * k + 1, ENERGY_COL.cyan, 0.9],
        [1.2 * k + 0.6, ENERGY_COL.core, 1],
      ] as const) {
        b.lineStyle(w, col, al).beginPath().moveTo(sx, sy);
        for (let j = 1; j <= 5; j++) {
          const qq = j / 5;
          const o = j < 5 ? (Math.random() - 0.5) * 26 * k : 0;
          b.lineTo(sx + (tx - sx) * qq + o, sy + (ty - sy) * qq + o * 0.4);
        }
        b.strokePath();
      }
    }
  }

  /**
   * Penumbra del peloteo: `a` = oscuridad (0..1) a la que tiende; se mueve suave hacia ella. Se llama cada fotograma del peloteo
   * (y tras él, con 0, hasta que se apaga: devuelve false cuando ya no se ve).
   */
  drawDark(a: number, dt: number): boolean {
    this.darkA += (a - this.darkA) * Math.min(1, dt * 6);
    if (a === 0 && this.darkA < 0.01) {
      this.darkA = 0;
      this.dark.setVisible(false);
      return false;
    }
    const v = this.scene.cameras.main.worldView;
    this.dark.setPosition(v.centerX, v.centerY).setSize(v.width * 2 + 400, v.height * 2 + 400).setAlpha(this.darkA).setVisible(true);
    return true;
  }

  /** La penumbra empieza donde la dejó la carga (sin salto). */
  setDark(a: number) {
    this.darkA = a;
  }

  /** Oculta la carga (brillo del cuerpo, orbes, aros, rayos) y la esfera que crece en el golpe final. */
  hideCharge() {
    this.growing = false;
    this.sphere.hide();
    this.bodyHalo.setVisible(false);
    this.bodyCore.setVisible(false);
    this.orbs.forEach((o) => o.setVisible(false));
    this.rings.clear().setVisible(false);
    this.bolts.clear().setVisible(false);
  }

  hide() {
    this.hideCharge();
    this.darkA = 0;
    this.dark.setVisible(false);
  }
}
