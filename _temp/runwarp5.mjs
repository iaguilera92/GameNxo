import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
execFileSync('node', ['warp-gradas.mjs', 'respaldo_oficial/ambientes/ambiente-1-1254-v5.png', '_warp5.png', readFileSync('sides-v5.json', 'utf8')], { stdio: 'inherit' });
execFileSync('node', ['screensim.mjs', '_warp5.png', '350', '0.7', '[]', '_sim9.png'], { stdio: 'inherit' });
