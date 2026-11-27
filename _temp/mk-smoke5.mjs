import fs from 'fs';
let s = fs.readFileSync('_temp/smoke2.mjs', 'utf8');
s = s.replace("const logs = [];", "const logs = []; let urls = [];").replace("if (d.method === 'Runtime.exceptionThrown')", "if (d.method === 'Network.requestWillBeSent') urls.push(d.params.request.url);\n  if (d.method === 'Runtime.exceptionThrown')").replace("await send('Runtime.enable');", "await send('Runtime.enable'); await send('Network.enable');");
s = s.replace("await sleep(15000);", "await sleep(6000);\nawait ev(\"localStorage.setItem('gamenxo.devMode','1'); location.reload(); 1\");\nawait sleep(15000);");
const i = s.indexOf("console.log('inicio"), j = s.indexOf('console.log(logs.slice');
const body = `
await ev("window.__lt = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push(Math.round(e.duration)); }).observe({ entryTypes: ['longtask'] }); 1");
await go('Customize', {}, 6000);
const measure = async (label, before) => {
  urls = [];
  await ev("window.__lt = []; 1");
  const ms = await ev(\`new Promise(async (res) => { \${before} const sc = window.__game.scene.getScene('Customize'); const t0 = performance.now(); sc.events.once('create', () => res(Math.round(performance.now() - t0))); sc.scene.restart(); })\`);
  await sleep(1500);
  const lt = await ev("JSON.stringify(window.__lt)");
  const dirs = {}; for (const u of urls) { const m = u.match(/assets\\/(?:characters\\/)?([^/]+)/); const k = m ? m[1] : 'otro'; dirs[k] = (dirs[k] ?? 0) + 1; }
  console.log(label, 'ms hasta create:', ms, '| pedidos:', urls.length, JSON.stringify(dirs), '| tareas largas (ms):', lt);
};
await measure('reinicio sin cambiar', '');
await measure('cambio a MAT       ', "const P = await import('/src/logic/Profile.ts'); P.setSkin('mat');");
await measure('cambio a NXO       ', "const P = await import('/src/logic/Profile.ts'); P.setSkin('nxo');");
`;
fs.writeFileSync('_temp/smoke5.mjs', s.slice(0, i) + body + s.slice(j));
