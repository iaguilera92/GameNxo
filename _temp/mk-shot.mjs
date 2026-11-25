import fs from 'fs';
let s = fs.readFileSync('_temp/smoke2.mjs', 'utf8');
s = s.replace("await sleep(15000);", "await sleep(6000);\nawait ev(\"localStorage.setItem('gamenxo.devMode','1'); location.reload(); 1\");\nawait sleep(15000);");
const i = s.indexOf("console.log('inicio"), j = s.indexOf('console.log(logs.slice');
const body = `await go('Customize', {}, 6000);
await send('Emulation.setDeviceMetricsOverride', { width: 720, height: 1280, deviceScaleFactor: 1, mobile: true });
await sleep(1500);
for (const [n, t] of [['a', 0], ['b', 700]]) { await sleep(t); const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync('_temp/para-chatgpt/personalizar-' + n + '.png', Buffer.from(r.result.data, 'base64')); }
`;
fs.writeFileSync('_temp/shot-zona.mjs', "import fs from 'fs';\n" + s.slice(0, i) + body + s.slice(j));
