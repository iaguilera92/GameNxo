import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
execFileSync('node', ['warp-gradas.mjs', 'respaldo_oficial/ambientes/ambiente-1-1254-v4-muro.png', '_warp4.png', readFileSync('sides-v4.json', 'utf8')], { stdio: 'inherit' });
execFileSync('node', ['screensim.mjs', '_warp4.png', '350', '0.7', '[]', '_sim6.png'], { stdio: 'inherit' });
