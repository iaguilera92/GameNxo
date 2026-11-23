import { execFileSync } from 'node:child_process';
execFileSync('node', ['screensim.mjs', '_warp4.png', '350', '0.7', JSON.stringify([[374,359,58],[337,404,62],[1162,359,58],[1199,404,62]]), '_sim8.png'], { stdio: 'inherit' });
