import fs from 'fs';
let s = fs.readFileSync('_temp/shot-zona.mjs', 'utf8');
s = s.replace("await go('Customize', {}, 6000);", `await ev("(() => { const k='gamenxo.player.dev'; const p = JSON.parse(localStorage.getItem(k) || '{}'); p.zone = p.zone || {}; p.zone.rays = 5; localStorage.setItem(k, JSON.stringify(p)); location.reload(); return 1; })()");
await sleep(15000);
await go('Customize', {}, 6000);`).replace("'_temp/para-chatgpt/personalizar-' + n", "'_temp/para-chatgpt/personalizar-rayos-' + n");
fs.writeFileSync('_temp/shot-zona2.mjs', s);
