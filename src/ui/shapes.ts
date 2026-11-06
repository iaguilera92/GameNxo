import Phaser from 'phaser';

/** Polígono con esquinas redondeadas (curva cuadrática en cada vértice), listo para fill/strokePoints. */
export function roundedPoly(pts: [number, number][], r: number, steps = 6): Phaser.Math.Vector2[] {
  const out: Phaser.Math.Vector2[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const [px, py] = pts[i];
    const [ax, ay] = pts[(i - 1 + n) % n];
    const [bx, by] = pts[(i + 1) % n];
    const la = Math.hypot(ax - px, ay - py);
    const lb = Math.hypot(bx - px, by - py);
    const ra = Math.min(r, la / 2);
    const rb = Math.min(r, lb / 2);
    const s = { x: px + ((ax - px) / la) * ra, y: py + ((ay - py) / la) * ra };
    const e = { x: px + ((bx - px) / lb) * rb, y: py + ((by - py) / lb) * rb };
    for (let t = 0; t <= steps; t++) {
      const u = t / steps;
      const x = (1 - u) * (1 - u) * s.x + 2 * (1 - u) * u * px + u * u * e.x;
      const y = (1 - u) * (1 - u) * s.y + 2 * (1 - u) * u * py + u * u * e.y;
      out.push(new Phaser.Math.Vector2(x, y));
    }
  }
  return out;
}
