import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
// (25-11-2026) grupo A: imágenes que el juego ajusta por proporción, a 2 veces su mayor tamaño en pantalla (lienzo 720 x 1280)
const A = {
  'assets/barra-inicio.webp': 1086, 'assets/menu/pase-batalla.webp': 1000, 'assets/menu/liga-card.webp': 887, 'assets/menu/liga-card-2v2.webp': 887,
  'assets/buscando/contador.webp': 600,
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

