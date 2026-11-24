// node grep.mjs "<regex>" archivo...  → líneas que coinciden (número: texto recortado)
import { readFileSync } from 'node:fs';
const [re, ...files] = process.argv.slice(2);
const rx = new RegExp(re);
for (const f of files) {
  const lines = readFileSync(f, 'utf8').split(/\r?\n/);
  lines.forEach((l, i) => {
    if (rx.test(l)) console.log(`${f.split('/').pop()}:${i + 1}: ${l.trim().slice(0, 180)}`);
  });
}
