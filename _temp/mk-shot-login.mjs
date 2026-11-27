import fs from 'fs';
let s = fs.readFileSync('_temp/smoke2.mjs', 'utf8');
const i = s.indexOf("await sleep(15000);"), j = s.indexOf('console.log(logs.slice');
const body = `await send('Emulation.setDeviceMetricsOverride', { width: 720, height: 1280, deviceScaleFactor: 1, mobile: true });
await ev("localStorage.clear(); location.reload(); 1");
for (let k = 0; k < 40; k++) { if (await ev("!!(window.__game && window.__game.scene.getScene('Login')?.sys.isActive())")) break; await sleep(1000); }
await sleep(2500);
const shot = async (n) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync('_temp/para-chatgpt/' + n + '.png', Buffer.from(r.result.data, 'base64')); };
console.log('escenas', await ev("JSON.stringify(window.__game.scene.getScenes(true).map(s => s.scene.key))"));
await shot('login');
await ev("(async () => { const m = await import('/src/ui/PasswordDialog.ts'); const d = await import('/src/domain/devMode.ts'); window.__ok = 0; m.askPassword(window.__game.scene.getScene('Login'), { title: 'MODO DESARROLLO', max: 6, check: d.checkDevPassword, onOk: () => (window.__ok = 1) }); return 1; })()");
await sleep(800);
await shot('login-password');
console.log('input', await ev("(() => { const el = document.querySelector('input'); el.value = '7'; el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); return 1; })()"), 'ok:', await ev('window.__ok'));
`;
fs.writeFileSync('_temp/shot-login.mjs', "import fs from 'fs';\n" + s.slice(0, i) + body + s.slice(j));
