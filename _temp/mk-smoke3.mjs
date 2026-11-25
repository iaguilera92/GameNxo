import fs from 'fs';
let s = fs.readFileSync('_temp/smoke2.mjs', 'utf8');
const i = s.indexOf("console.log('inicio"), j = s.indexOf('console.log(logs.slice');
if (i < 0 || j < 0) throw 'nf';
const body = `const who = \`(() => { const m = window.__game.scene.getScene('Match'); if (!m || !m.sys.isActive()) return 'sin partido'; const sk = (a) => a?.ch?.skinId; return JSON.stringify({ yo: sk(m.player), aliado: sk(m.ally), rival1: sk(m.rivalActors?.[0]), rival2: sk(m.rivalActors?.[1]), nombres: [m.allyName, m.botName, m.rival2Name] }); })()\`;
for (let n = 0; n < 3; n++) {
  await go('Menu', {}, 3000);
  await go('Matchmaking', { mode: '2v2', from: 'Menu' }, 12000);
  console.log('2v2 #' + (n + 1), await ev(who));
}
`;
fs.writeFileSync('_temp/smoke3.mjs', s.slice(0, i) + body + s.slice(j));
