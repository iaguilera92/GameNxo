import fs from 'fs';
let s = fs.readFileSync('_temp/shot-acc.mjs', 'utf8');
const i = s.indexOf("await ev(\"localStorage.clear(); localStorage.setItem('gamenxo.devMode','1')"), j = s.indexOf('console.log(logs.slice');
const body = `await ev("localStorage.clear(); location.reload(); 1");
for (let k = 0; k < 40; k++) { if (await ev("!!(window.__game && window.__game.scene.getScenes(true).length)")) break; await sleep(1000); }
await sleep(3000);
await ev("(async () => { const d = await import('/src/domain/devMode.ts'); d.startTutorialAt(3); location.reload(); return 1; })()");
await waitMenu();
await sleep(4000);
await shot('menu-tutorial');
`;
fs.writeFileSync('_temp/shot-menu.mjs', s.slice(0, i) + body + s.slice(j));
