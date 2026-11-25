import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
// (25-11-2026) grupo A: imágenes que el juego ajusta por proporción, a 2 veces su mayor tamaño en pantalla (lienzo 720 x 1280)
const A = {
  'assets/liga/pestanas-liga.webp': 1000, 'assets/liga/pestanas-liga-2v2.webp': 1000, 'assets/liga/escenario-liga.webp': 887,
  'assets/liga/panel-recompensa.webp': 1000, 'assets/liga/botones-liga.webp': 1000, 'assets/liga/titulo-lideres.webp': 1000, 'assets/liga/btn-top100.webp': 1000,
  'assets/liga/card-0.webp': 319, 'assets/liga/card-1.webp': 318, 'assets/liga/card-2.webp': 320,
  'assets/liga/podio-0.webp': 271, 'assets/liga/podio-1.webp': 322, 'assets/liga/podio-2.webp': 271,
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

