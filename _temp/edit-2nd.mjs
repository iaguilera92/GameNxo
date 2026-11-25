import fs from 'fs';
const f='frontend/src/scenes/MatchScene.ts';let s=fs.readFileSync(f,'utf8');
const o="this.secondTag.setPosition(W / 2, 150); // bajo el marcador";
if(s.split(o).length!==2)throw 'nf';
s=s.replace(o,"this.secondTag.setPosition(W / 2, 178); // (25-11-2026, usuario: antes 150, pegado al marcador) bajo el marcador");
fs.writeFileSync(f,s);console.log('ok');
