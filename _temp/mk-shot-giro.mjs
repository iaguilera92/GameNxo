import fs from 'fs';
let s = fs.readFileSync('_temp/shot-menu.mjs', 'utf8');
s = s.replace("await shot('menu-tutorial');", `await ev("localStorage.setItem('gamenxo.devMode','1'); location.reload(); 1");
await waitMenu(); await sleep(3000);
await shot('menu-giro-a');
await ev("(() => { const sc = window.__game.scene.getScene('Menu'); const h = sc.hero.obj; h.emit('pointerdown', { x: h.x }); sc.input.emit('pointerup'); return 1; })()");
await sleep(900);
await shot('menu-giro-b');`);
fs.writeFileSync('_temp/shot-giro.mjs', s);
