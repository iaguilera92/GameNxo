import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
// [ruta en public, ancho, fuente opcional]
const A = [
  ['assets/ranking/ranking-global-titulo.webp', 887],
  ['assets/personalizar-estilos.webp', 400], ['assets/personalizar-cargando.webp', 400], ['assets/personalizar-efecto.webp', 400], ['assets/personalizar-mascotas.webp', 400],
  ['assets/ui/marcador-principal.webp', 1000],
  ['assets/oferta-emotes.webp', 1000],
  ['assets/btn-dash.webp', 320, 'frontend/art/botones/btn-dash.webp'], ['assets/btn-smash.webp', 320, 'frontend/art/botones/btn-smash.webp'],
];
let before = 0, after = 0;
for (const [rel, w, src0] of A) {
  const pub = `frontend/public/${rel}`;
  let src = src0;
  if (!src) { src = `_temp/respaldo_oficial/ui-grandes/${rel}`; mkdirSync(dirname(src), { recursive: true }); if (!existsSync(src)) copyFileSync(pub, src); }
  before += statSync(src).size;
  const r = spawnSync(process.execPath, ['frontend/tools/convert-image.mjs', src, pub, '0.9', String(w)], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(rel + ': ' + r.stderr);
  after += statSync(pub).size;
  console.log(r.stdout.trim());
}
console.log(`disco: ${(before / 1048576).toFixed(1)} MB -> ${(after / 1048576).toFixed(1)} MB`);
