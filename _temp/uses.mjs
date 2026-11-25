import fs from 'fs'; import path from 'path';
const rows = JSON.parse(fs.readFileSync('_temp/big-images.json', 'utf8'));
const files = [];
const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (f.name.endsWith('.ts')) files.push([p.replace(/\\/g, '/').replace('frontend/src/', ''), fs.readFileSync(p, 'utf8').split(/\r?\n/)]); } };
walk('frontend/src');
const out = [];
for (const r of rows) {
  if (/^ambiente|charge-|inferno-ball/.test(path.basename(r.p))) continue;
  const base = path.basename(r.p, '.webp');
  const keys = new Set();
  const refs = [];
  for (const [f, lines] of files) lines.forEach((l, i) => { if (l.includes(base + '.webp') || l.includes(`/${base}'`) || l.includes(`'${base}'`)) { refs.push(`${f}:${i + 1}`); const m = l.match(/['"]([\w-]+)['"]\s*,\s*[`'"][^`'"]*\.webp/); if (m) keys.add(m[1]); } });
  const uses = [];
  for (const k of keys) for (const [f, lines] of files) lines.forEach((l, i) => { if (l.includes(`'${k}'`) && /setDisplaySize|displayWidth|setScale|setSize|width|\bw\b/.test(l) && !/load\.image/.test(l)) uses.push(`${f}:${i + 1}: ${l.trim().slice(0, 140)}`); });
  out.push(`## ${r.p} ${r.w}x${r.h} keys=[${[...keys].join(',')}] refs=${refs.slice(0, 3).join(' ')}\n` + uses.slice(0, 3).map((u) => '   ' + u).join('\n'));
}
fs.writeFileSync('_temp/big-uses.txt', out.join('\n'));
console.log(out.length);
