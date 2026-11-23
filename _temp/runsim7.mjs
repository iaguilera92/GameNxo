import { execFileSync } from 'node:child_process';
execFileSync('node', ['screensim.mjs', '_warp4.png', '350', '0.7', JSON.stringify([[367,367,60],[318,334,58],[1218,414,63],[1240,350,58]]), '_sim7.png'], { stdio: 'inherit' });
