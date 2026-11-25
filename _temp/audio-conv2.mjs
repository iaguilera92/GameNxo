import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
// (25-11-2026) audio a AAC (.m4a) desde los ORIGINALES de _temp/respaldo_oficial/audio: música 64 kbps, efectos 96 kbps, 44,1 kHz
const FF = process.env.FFMPEG;
const dir = 'frontend/public/mp3', bak = '_temp/respaldo_oficial/audio';
mkdirSync(dir, { recursive: true });
for (const f of readdirSync(dir)) if (/\.(mp3|wav|m4a)$/.test(f)) rmSync(`${dir}/${f}`);
let after = 0, n = 0;
for (const f of readdirSync(bak)) {
  const base = f.replace(/\.[^.]+$/, '');
  const music = /^(soundtrack-|intro-)/.test(base);
  const out = `${dir}/${base}.m4a`;
  const r = spawnSync(FF, ['-v', 'error', '-y', '-i', `${bak}/${f}`, '-vn', '-c:a', 'aac', '-b:a', music ? '64k' : '96k', '-ar', '44100', '-movflags', '+faststart', out], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(f + ': ' + r.stderr);
  after += statSync(out).size; n++;
}
console.log(`${n} archivos, ${(after / 1048576).toFixed(1)} MB`);
