import { spawnSync } from 'node:child_process';
import { readdirSync, mkdirSync, renameSync } from 'node:fs';
const dir = 'frontend/public/assets/emotes';
mkdirSync('_temp/respaldo_oficial/emotes', { recursive: true });
for (const f of readdirSync(dir).filter((n) => n.endsWith('.png'))) {
  const r = spawnSync('node', ['frontend/tools/convert-image.mjs', `${dir}/${f}`, `${dir}/${f.replace(/\.png$/, '.webp')}`, '0.9'], { encoding: 'utf8' });
  console.log(r.stdout.trim(), r.stderr.trim());
  if (r.status !== 0) throw new Error('fallo ' + f);
  renameSync(`${dir}/${f}`, `_temp/respaldo_oficial/emotes/${f}`);
}
console.log('ok');
