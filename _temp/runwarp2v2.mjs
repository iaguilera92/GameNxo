import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
execFileSync('node', ['warp-gradas.mjs', 'respaldo_oficial/ambientes/ambiente-1-2v2-1254-v2.png', '_warp2v2.png', readFileSync('sides-2v2.json', 'utf8').replace(/^\uFEFF/, '')], { stdio: 'inherit' });
execFileSync('node', ['screensim.mjs', '_warp2v2.png', '405', '0.7', '[]', '_sim2v2g.png'], { stdio: 'inherit' });
