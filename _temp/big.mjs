import fs from 'fs'; import path from 'path';
const dim = (b) => { const t = b.toString('ascii', 12, 16);
  if (t === 'VP8X') return [1 + b[24] + 256 * b[25] + 65536 * b[26], 1 + b[27] + 256 * b[28] + 65536 * b[29]];
  if (t === 'VP8 ') return [(b[26] + 256 * b[27]) & 0x3fff, (b[28] + 256 * b[29]) & 0x3fff];
  if (t === 'VP8L') { const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1]; } return [0, 0]; };
const rows = [];
const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name);
  if (f.isDirectory()) { if (f.name !== 'characters' && f.name !== 'personajes') walk(p); }
  else if (f.name.endsWith('.webp')) { const [w, h] = dim(fs.readFileSync(p)); if (w > 1100 || h > 1100) rows.push({ p: p.replace(/\\/g, '/').replace('frontend/public/', ''), w, h, kb: Math.round(fs.statSync(p).size / 1024) }); } } };
walk('frontend/public');
rows.sort((a, b) => b.w * b.h - a.w * a.h);
for (const r of rows) console.log(`${r.p}\t${r.w}x${r.h}\t${r.kb}KB\t${Math.round(r.w * r.h * 4 / 1048576)}MB`);
fs.writeFileSync('_temp/big-images.json', JSON.stringify(rows, null, 1));
