// Detalles VERDES dentro del personaje (las hojas de la flor de la gorra de MAI): el croma los vuelve transparentes y
// quedan agujeros en la gorra. Aquí se recuperan (color y alfa originales) las zonas verdosas que:
//   - no tocan el borde de la hoja (el fondo exterior siempre lo toca),
//   - a 3-4 px de su borde están rodeadas sobre todo por `ring` (el rosa de la gorra; los huecos de fondo entre brazo,
//     cuerpo y raqueta tienen piel, pelo o ropa alrededor),
//   - no son oscuras (los huecos del cuello de la raqueta vienen en verde oscuro) y casi no tienen píxeles del verde del fondo.
// Usado por build-nxo-v2.mjs y build-nxo-inferno.mjs (solo en las hojas de MAI).

/** rosa de la gorra y de los pétalos de MAI (el azul supera al verde: no confunde la piel) */
export const PINK = (r, g, b) => r > 150 && b > g && r - g > 50;

/**
 * `src` = píxeles originales (RGBA), `out` = los mismos tras el croma: se corrigen en el sitio. Devuelve las zonas recuperadas.
 */
export function keepEnclosedGreen(src, out, w, h, opts = {}) {
  const { ring = PINK, minRing = 0.6, minGreen = 120, maxBgFrac = 0.15, minPx = 12, maxPx = 600 } = opts;
  const bg = opts.bg ?? [src[0], src[1], src[2]]; // color del fondo: el de la esquina
  const greenish = (p) => src[p * 4 + 3] > 0 && src[p * 4 + 1] - Math.max(src[p * 4], src[p * 4 + 2]) > 12;
  const isBg = (p) => Math.abs(src[p * 4] - bg[0]) < 30 && Math.abs(src[p * 4 + 1] - bg[1]) < 22 && Math.abs(src[p * 4 + 2] - bg[2]) < 30;
  const seen = new Uint8Array(w * h);
  const dist = new Int8Array(w * h).fill(-1);
  const kept = [];
  for (let s = 0; s < w * h; s++) {
    if (seen[s] || !greenish(s)) continue;
    const R = [s];
    seen[s] = 1;
    let border = false;
    for (let k = 0; k < R.length; k++) {
      const p = R[k], x = p % w, y = (p / w) | 0;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) { border = true; continue; }
      for (const q of [p - 1, p + 1, p - w, p + w]) if (!seen[q] && greenish(q)) { seen[q] = 1; R.push(q); }
    }
    if (border || R.length < minPx || R.length > maxPx) continue;
    // no oscura y casi sin verde de fondo
    const gs = R.map((p) => src[p * 4 + 1]).sort((a, b) => a - b);
    if (gs[gs.length >> 1] < minGreen) continue;
    if (R.filter(isBg).length / R.length >= maxBgFrac) continue;
    // anillo a 3-4 px (más allá del contorno oscuro de la propia zona)
    const touched = [...R];
    for (const p of R) dist[p] = 0;
    let layer = R, n = 0, ok = 0;
    for (let d = 1; d <= 4; d++) {
      const next = [];
      for (const p of layer) {
        const x = p % w, y = (p / w) | 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const q = ny * w + nx;
            if (dist[q] >= 0) continue;
            dist[q] = d;
            touched.push(q);
            next.push(q);
            if (d >= 3 && !greenish(q)) { n++; if (ring(src[q * 4], src[q * 4 + 1], src[q * 4 + 2])) ok++; }
          }
      }
      layer = next;
    }
    for (const p of touched) dist[p] = -1;
    if (!n || ok / n < minRing) continue;
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (const p of R) {
      const o = p * 4, x = p % w, y = (p / w) | 0;
      out[o] = src[o]; out[o + 1] = src[o + 1]; out[o + 2] = src[o + 2]; out[o + 3] = src[o + 3];
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    kept.push({ n: R.length, x0, y0, x1, y1, ring: +(ok / n).toFixed(2) });
  }
  return kept;
}
