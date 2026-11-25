import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
// (25-11-2026) grupo A: imágenes que el juego ajusta por proporción, a 2 veces su mayor tamaño en pantalla (lienzo 720 x 1280)
const A = {
  'assets/tienda-titulo.webp': 720, 'assets/personalizar-titulo.webp': 720, 'assets/liga-titulo.webp': 720, 'assets/liga-2v2-titulo.webp': 720,
  'assets/premio-diario.webp': 900,
  'assets/bronce.webp': 656, 'assets/plata.webp': 656, 'assets/oro.webp': 656, 'assets/platino.webp': 656, 'assets/diamante.webp': 656,
  'assets/bronce-2v2.webp': 600, 'assets/plata-2v2.webp': 600, 'assets/oro-2v2.webp': 600, 'assets/platino-2v2.webp': 600, 'assets/diamante-2v2.webp': 600,
  'assets/challenger.webp': 600, 'assets/challenger-2v2.webp': 600,
  'assets/monedas.webp': 512, 'assets/billetes.webp': 768, 'assets/liga.webp': 256, 'assets/icon-zona.webp': 256,
  'assets/nxo-logo.webp': 1240, 'assets/tienda-pj.webp': 660,
};
let before = 0, after = 0;
for (const [rel, w] of Object.entries(A)) {
  const pub = `frontend/public/${rel}`, bak = `_temp/respaldo_oficial/ui-grandes/${rel}`;
  mkdirSync(dirname(bak), { recursive: true });
  if (!existsSync(bak)) copyFileSync(pub, bak); // el original, una sola vez
  before += statSync(bak).size;
  const r = spawnSync(process.execPath, ['frontend/tools/convert-image.mjs', bak, pub, '0.9', String(w)], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(rel + ': ' + r.stderr);
  after += statSync(pub).size;
  console.log(r.stdout.trim());
}
console.log(`disco: ${(before / 1048576).toFixed(1)} MB -> ${(after / 1048576).toFixed(1)} MB`);
