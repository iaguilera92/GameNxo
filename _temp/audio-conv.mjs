import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
const FF = process.env.FFMPEG;
const dir = 'frontend/public/mp3', bak = '_temp/respaldo_oficial/audio', tmp = '_temp/audio-out';
mkdirSync(bak, { recursive: true }); rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
let before = 0, after = 0;
for (const f of readdirSync(dir)) {
  if (!/\.(mp3|wav|m4a)$/.test(f)) continue;
  const base = f.replace(/\.[^.]+$/, '');
  if (!existsSync(`${bak}/${f}`)) copyFileSync(`${dir}/${f}`, `${bak}/${f}`); // original, una sola vez
  const music = /^(soundtrack-|intro-)/.test(base);
  const out = `${tmp}/${base}.m4a`;
  // música: AAC 64 kbps estéreo; efectos: AAC 96 kbps. 44,1 kHz. Desde el ORIGINAL respaldado.
  const r = spawnSync(FF, ['-v', 'error', '-y', '-i', `${bak}/${f}`, '-vn', '-c:a', 'aac', '-b:a', music ? '64k' : '96k', '-ar', '44100', '-movflags', '+faststart', out], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(f + ': ' + r.stderr);
  const a = statSync(`${bak}/${f}`).size, b = statSync(out).size;
  before += a; after += b;
  console.log(`${f.padEnd(32)} ${(a / 1024).toFixed(0).padStart(6)} KB -> ${(b / 1024).toFixed(0).padStart(5)} KB`);
}
// reemplazo: se borran los de public y se ponen los .m4a nuevos
for (const f of readdirSync(dir)) if (/\.(mp3|wav|m4a)$/.test(f)) rmSync(`${dir}/${f}`);
for (const f of readdirSync(tmp)) renameSync(`${tmp}/${f}`, `${dir}/${f}`);
console.log(`total ${(before / 1048576).toFixed(1)} MB -> ${(after / 1048576).toFixed(1)} MB`);
