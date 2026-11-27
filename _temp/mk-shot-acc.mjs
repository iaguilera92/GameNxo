import fs from 'fs';
let s = fs.readFileSync('_temp/shot-login.mjs', 'utf8');
const i = s.indexOf('await send(\'Emulation.setDeviceMetricsOverride\''), j = s.indexOf('console.log(logs.slice');
const body = `await send('Emulation.setDeviceMetricsOverride', { width: 720, height: 1280, deviceScaleFactor: 1, mobile: true });
const shot = async (n) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync('_temp/para-chatgpt/' + n + '.png', Buffer.from(r.result.data, 'base64')); };
const waitMenu = async () => { for (let k = 0; k < 40; k++) { if (await ev("!!(window.__game && window.__game.scene.getScene('Menu')?.sys.isActive())")) break; await sleep(1000); } await sleep(2500); };
const openSettings = "(async () => { const m = await import('/src/ui/SettingsDialog.ts'); m.showSettings(window.__game.scene.getScene('Menu')); return 1; })()";
await ev("localStorage.clear(); localStorage.setItem('gamenxo.devMode','1'); location.reload(); 1");
await waitMenu();
await ev(openSettings); await sleep(800); await shot('ajustes-invitado');
// tocar VINCULAR CUENTA: buscar la zona del renglon (texto)
await ev("(() => { const sc = window.__game.scene.getScene('Menu'); const t = sc.children.list.flatMap(o => o.list ?? [o]).find(o => o.text === 'VINCULAR CUENTA'); const z = t.parentContainer.list.find(o => o.type === 'Zone' && Math.abs(o.y - t.y) < 2); z.emit('pointerup'); return 1; })()");
await sleep(800); await shot('ajustes-vincular');
await ev("(() => { const k = 'gamenxo.player.dev'; const p = JSON.parse(localStorage.getItem(k)); p.account = { provider: 'google', uid: 'abc123', email: 'jugador@gmail.com' }; localStorage.setItem(k, JSON.stringify(p)); location.reload(); return 1; })()");
await waitMenu();
await ev(openSettings); await sleep(800); await shot('ajustes-cuenta');
`;
fs.writeFileSync('_temp/shot-acc.mjs', s.slice(0, i) + body + s.slice(j));
