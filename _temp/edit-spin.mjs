import fs from 'fs';
const f='frontend/src/scenes/MatchScene.ts'.replace('MatchScene','MenuScene');
let s=fs.readFileSync(f,'utf8');
const o="spin: 'TOCA JUGAR PARA PRACTICAR EL DEFENSIVO'";
if(s.split(o).length!==2) throw 'nf';
s=s.replace(o,"spin: 'TOCA PARA JUGAR'");
fs.writeFileSync(f,s);console.log('ok');
