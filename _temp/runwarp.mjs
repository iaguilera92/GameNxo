import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
execFileSync('node', ['warp-gradas.mjs', 'respaldo_oficial/ambientes/ambiente-1-1254-v3.png', '_warp1.png', readFileSync('sides.json', 'utf8')], { stdio: 'inherit' });
