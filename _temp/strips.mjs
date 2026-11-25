import fs from 'fs'; import path from 'path';
const dim = (b) => { const t = b.toString('ascii', 12, 16);
  if (t === 'VP8X') return [1 + b[24] + 256 * b[25] + 65536 * b[26], 1 + b[27] + 256 * b[28] + 65536 * b[29]];
  if (t === 'VP8 ') return [(b[26] + 256 * b[27]) & 0x3fff, (b[28] + 256 * b[29]) & 0x3fff];
  if (t === 'VP8L') { const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1]; } return [0, 0]; };
const root = 'frontend/public/assets/characters';
for (const d of fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory())) {
  let mem = 0, disk = 0, n = 0, maxW = 0, maxH = 0;
  for (const f of fs.readdirSync(path.join(root, d.name)).filter((f) => f.endsWith('.webp'))) {
    const b = fs.readFileSync(path.join(root, d.name, f)); const [w, h] = dim(b); mem += w * h * 4; disk += b.length; n++; maxW = Math.max(maxW, w); maxH = Math.max(maxH, h);
  }
  console.log(`${d.name.padEnd(22)} ${String(n).padStart(3)} tiras  disco ${(disk / 1048576).toFixed(1).padStart(4)} MB  memoria ${(mem / 1048576).toFixed(0).padStart(4)} MB  max ${maxW}x${maxH}`);
}
for (const j of ['nxo-move', 'nxo-front-move', 'mai-move', 'mai-front-move', 'mat-move', 'mat-front-move']) {
  const p = `frontend/src/characters/${j}.json`; if (!fs.existsSync(p)) { console.log(j, 'no existe'); continue; }
  const o = JSON.parse(fs.readFileSync(p, 'utf8'));
  console.log(j, 'standHeight', o.standHeight, 'cell', JSON.stringify(o.cell), 'idle cell', JSON.stringify(o.clips?.idle?.cell ?? o.anims?.idle?.cell ?? ''));
}
