import fs from 'fs';
let s = fs.readFileSync('_temp/smoke2.mjs', 'utf8');
s = s.replace("await sleep(15000);", "await sleep(6000);\nawait ev(\"localStorage.setItem('gamenxo.devMode','1'); location.reload(); 1\");\nawait sleep(15000);");
const i = s.indexOf("console.log('inicio"), j = s.indexOf('console.log(logs.slice');
const body = `const who = \`(() => { const m = window.__game.scene.getScene('Match'); if (!m || !m.sys.isActive()) return 'sin partido'; return JSON.stringify({ yo: m.player?.ch?.skinId, rival: m.bot?.ch?.skinId, nombre: m.botName }); })()\`;
for (let n = 0; n < 5; n++) {
  await go('Menu', {}, 3000);
  await go('Matchmaking', { unranked: true, from: 'Menu' }, 11000);
  console.log('1v1 #' + (n + 1), await ev(who));
}
`;
fs.writeFileSync('_temp/smoke4.mjs', s.slice(0, i) + body + s.slice(j));
