import fs from 'fs';
const files = ['frontend/src/scenes/ShopScene.ts','frontend/src/scenes/CustomizeScene.ts','frontend/src/fx/introMusic.ts','frontend/src/scenes/BootScene.ts','frontend/src/scenes/MatchScene.ts','frontend/src/fx/matchMusic.ts','frontend/src/fx/sfx.ts'];
let n = 0;
for (const f of files) {
  let s = fs.readFileSync(f, 'utf8');
  const b = s;
  s = s.replace(/(['`]mp3\/[\w${}.-]+?)\.(mp3|wav)(['`])/g, (_, a, _e, q) => { n++; return `${a}.m4a${q}`; });
  if (s !== b) fs.writeFileSync(f, s);
}
console.log('cambios', n);
