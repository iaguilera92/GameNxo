import fs from 'fs'; import path from 'path';
const src = [];
const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (/\.(ts|json|html|css)$/.test(f.name)) src.push(fs.readFileSync(p, 'utf8')); } };
walk('frontend/src'); src.push(fs.readFileSync('frontend/index.html', 'utf8'));
const all = src.join('\n');
const out = []; let tot = 0;
const walk2 = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk2(p); else if (/\.(webp|mp3|m4a|wav|png)$/.test(f.name)) {
  const base = f.name.replace(/\.[^.]+$/, '');
  const dir = path.basename(d);
  // referencia por nombre, o carpeta con nombres generados (characters/*, frames numerados)
  const ok = all.includes(base) || all.includes(base.replace(/-\d+$/, '')) || all.includes(base.replace(/_\d+$/, '')) || (p.includes('characters') && all.includes(dir));
  if (!ok) { const s = fs.statSync(p).size; tot += s; out.push(`${(s/1024).toFixed(0).padStart(6)} KB  ${p.replace(/\\/g,'/').replace('frontend/dist/','')}`); }
} } };
walk2('frontend/dist');
out.sort((a,b)=>parseInt(b)-parseInt(a));
console.log(out.join('\n')); console.log('posibles sin uso:', out.length, (tot/1048576).toFixed(1), 'MB');

