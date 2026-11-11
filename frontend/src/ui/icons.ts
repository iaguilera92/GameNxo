import Phaser from 'phaser';
import { C } from './theme';
import type { AbilityIcon } from '../logic/Abilities';

const pts = (a: number[]) => {
  const out: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < a.length; i += 2) out.push(new Phaser.Math.Vector2(a[i], a[i + 1]));
  return out;
};

/** Disco con relieve (base de los iconos de habilidad). */
export function drawDisc(g: Phaser.GameObjects.Graphics, R: number, color: number, dark: number) {
  g.fillStyle(C.outline).fillCircle(0, 4, R + 8);
  g.fillStyle(dark).fillCircle(0, 6, R);
  g.fillStyle(color).fillCircle(0, 0, R - 2);
  g.fillStyle(0xffffff, 0.3).fillEllipse(-R * 0.15, -R * 0.45, R * 1.2, R * 0.55);
}

/**
 * Icono del poder DESTELLO (domain/defensivePowers.ts), centrado en (0,0) con radio R: tres haces de luz que
 * convergen en una chispa de cuatro puntas (el teletransporte a la pelota).
 */
export function drawBlinkIcon(g: Phaser.GameObjects.Graphics, R: number) {
  const lines: [number, number, number][] = [[-0.68, -0.34, 0.1], [-0.82, 0, 0.14], [-0.68, 0.34, 0.1]];
  for (const [x0, y, wk] of lines) {
    g.lineStyle(R * wk + 6, C.outline).lineBetween(R * x0, R * y, R * 0.1, R * y * 0.35);
    g.lineStyle(R * wk, 0xffffff).lineBetween(R * x0, R * y, R * 0.1, R * y * 0.35);
  }
  const cx = R * 0.38;
  const star = [0, -0.62, 0.14, -0.14, 0.62, 0, 0.14, 0.14, 0, 0.62, -0.14, 0.14, -0.62, 0, -0.14, -0.14].map((v) => v * R * 0.8);
  g.fillStyle(C.outline).fillPoints(pts(star.map((v, i) => (i % 2 ? v * 1.2 : v * 1.2 + cx))), true);
  g.fillStyle(0xfff36b).fillPoints(pts(star.map((v, i) => (i % 2 ? v : v + cx))), true);
  g.fillStyle(0xffffff).fillCircle(cx, 0, R * 0.12);
}

/** Dibuja el icono de una habilidad centrado en (0,0) con radio de referencia R. */
export function drawAbilityIcon(g: Phaser.GameObjects.Graphics, icon: AbilityIcon, R: number) {
  if (icon === 'dash') {
    // silueta que se desvanece + portal
    g.lineStyle(8, C.outline).strokeEllipse(R * 0.18, R * 0.42, R * 1.0, R * 0.36);
    g.lineStyle(4, 0xe6d2ff).strokeEllipse(R * 0.18, R * 0.42, R * 1.0, R * 0.36);
    const s = R / 50;
    const bolt = [-6, -34, 16, -34, 4, -8, 20, -8, -12, 34, -2, 4, -18, 4].map((v) => v * s * 0.85);
    g.fillStyle(C.outline).fillPoints(pts(bolt.map((v, i) => v * 1.2 + (i % 2 ? 1 : 0))), true);
    g.fillStyle(0xfff36b).fillPoints(pts(bolt), true);
    for (let i = 0; i < 3; i++) g.fillStyle(0xffffff, 0.7 - i * 0.2).fillCircle(-R * 0.55 - i * R * 0.13, -R * 0.2 + i * R * 0.18, R * 0.07);
  } else if (icon === 'smash') {
    // llama
    const flame = [0, -0.85, 0.35, -0.35, 0.55, 0.15, 0.4, 0.6, 0, 0.8, -0.4, 0.6, -0.55, 0.15, -0.3, -0.25, -0.15, 0.05].map((v) => v * R * 0.8);
    g.fillStyle(C.outline).fillPoints(pts(flame.map((v) => v * 1.18)), true);
    g.fillStyle(0xff6a1e).fillPoints(pts(flame), true);
    g.fillStyle(0xffd23f).fillPoints(pts(flame.map((v, i) => v * 0.55 + (i % 2 ? R * 0.2 : 0))), true);
    g.fillStyle(C.outline).fillCircle(0, R * 0.42, R * 0.24);
    g.fillStyle(0xd7f53a).fillCircle(0, R * 0.42, R * 0.18);
  } else if (icon === 'serveSpin') {
    // pelota con flecha curva (saque con efecto)
    const cx = -R * 0.05;
    const cy = R * 0.05;
    const r = R * 0.62;
    const a0 = Math.PI * 1.05;
    const a1 = Math.PI * 1.8;
    g.lineStyle(R * 0.14 + 6, C.outline).beginPath().arc(cx, cy, r, a0, a1).strokePath();
    g.lineStyle(R * 0.14, 0xffffff).beginPath().arc(cx, cy, r, a0, a1).strokePath();
    // punta de flecha tangente al final del arco
    const ex = cx + Math.cos(a1) * r;
    const ey = cy + Math.sin(a1) * r;
    const dx = -Math.sin(a1);
    const dy = Math.cos(a1);
    const tip = (L: number, W: number) => [
      new Phaser.Math.Vector2(ex + dx * L, ey + dy * L),
      new Phaser.Math.Vector2(ex - dy * W, ey + dx * W),
      new Phaser.Math.Vector2(ex + dy * W, ey - dx * W),
    ];
    g.fillStyle(C.outline).fillPoints(tip(R * 0.42, R * 0.3), true);
    g.fillStyle(0xffffff).fillPoints(tip(R * 0.3, R * 0.2), true);
    g.fillStyle(C.outline).fillCircle(-R * 0.08, R * 0.16, R * 0.36);
    g.fillStyle(0xd7f53a).fillCircle(-R * 0.08, R * 0.16, R * 0.29);
    g.lineStyle(3, 0xffffff, 0.9).beginPath().arc(-R * 0.37, R * 0.16, R * 0.27, -0.9, 0.9).strokePath();
  } else if (icon === 'serveRacket') {
    // raqueta inclinada con la pelota (saque normal)
    const rot = (x: number, y: number) => {
      const a = -0.7;
      return new Phaser.Math.Vector2(x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a));
    };
    // mango
    const h0 = rot(0, R * 0.12);
    const h1 = rot(0, R * 0.78);
    g.lineStyle(R * 0.2 + 6, C.outline).lineBetween(h0.x, h0.y, h1.x, h1.y);
    g.lineStyle(R * 0.2, 0x7a3b12).lineBetween(h0.x, h0.y, h1.x, h1.y);
    // marco y cuerdas
    const pts2: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const p = rot(Math.cos(a) * R * 0.38, -R * 0.2 + Math.sin(a) * R * 0.5);
      pts2.push(p);
    }
    g.fillStyle(C.outline).fillPoints(pts2.map((p) => new Phaser.Math.Vector2(p.x * 1.12, p.y * 1.12 - R * 0.02)), true);
    g.fillStyle(0xffffff).fillPoints(pts2.map((p) => new Phaser.Math.Vector2(p.x * 1.0, p.y * 1.0)), true);
    g.fillStyle(0xfff0c2).fillPoints(pts2.map((p) => new Phaser.Math.Vector2(p.x * 0.82, p.y * 0.82)), true);
    g.lineStyle(2, 0xc9a45a, 0.9);
    for (let k = -2; k <= 2; k++) {
      const a = rot(k * R * 0.11, -R * 0.62);
      const b = rot(k * R * 0.11, R * 0.2);
      g.lineBetween(a.x, a.y, b.x, b.y);
      const c1 = rot(-R * 0.3, -R * 0.2 + k * R * 0.14);
      const c2 = rot(R * 0.3, -R * 0.2 + k * R * 0.14);
      g.lineBetween(c1.x, c1.y, c2.x, c2.y);
    }
    // pelota
    g.fillStyle(C.outline).fillCircle(R * 0.5, R * 0.46, R * 0.25);
    g.fillStyle(0xd7f53a).fillCircle(R * 0.5, R * 0.46, R * 0.19);
    g.fillStyle(0xffffff, 0.7).fillCircle(R * 0.44, R * 0.4, R * 0.05);
  } else if (icon === 'servePower') {
    // pelota con líneas de velocidad (saque fuerte)
    for (let i = 0; i < 3; i++) {
      const y = -R * 0.28 + i * R * 0.28;
      const x0 = -R * (0.8 - (i === 1 ? 0.1 : 0));
      g.lineStyle(R * 0.11 + 6, C.outline).lineBetween(x0, y, -R * 0.15, y);
      g.lineStyle(R * 0.11, 0xffffff).lineBetween(x0, y, -R * 0.15, y);
    }
    g.fillStyle(C.outline).fillCircle(R * 0.24, 0, R * 0.42);
    g.fillStyle(0xd7f53a).fillCircle(R * 0.24, 0, R * 0.34);
    g.lineStyle(3, 0xffffff, 0.9).beginPath().arc(R * 0.56, 0, R * 0.3, Math.PI - 0.9, Math.PI + 0.9).strokePath();
    g.fillStyle(0xffffff, 0.6).fillCircle(R * 0.12, -R * 0.14, R * 0.1);
  } else {
    // candado
    g.lineStyle(R * 0.16 + 4, C.outline).beginPath().arc(0, -R * 0.12, R * 0.3, Math.PI, 0).strokePath();
    g.lineStyle(R * 0.16, 0xd8dbe6).beginPath().arc(0, -R * 0.12, R * 0.3, Math.PI, 0).strokePath();
    g.fillStyle(C.outline).fillRoundedRect(-R * 0.5, -R * 0.15, R, R * 0.75, R * 0.15);
    g.fillStyle(0xffcc2e).fillRoundedRect(-R * 0.42, -R * 0.08, R * 0.84, R * 0.6, R * 0.12);
    g.fillStyle(C.outline).fillCircle(0, R * 0.18, R * 0.1);
  }
}

