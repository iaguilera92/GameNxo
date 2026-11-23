import { execFileSync } from 'node:child_process';
execFileSync('node', ['screensim.mjs', '_warp5.png', '350', '0.7', JSON.stringify([[380,355,58],[337,393,62],[1156,360,58],[1199,393,62]]), '_sim10.png'], { stdio: 'inherit' });
