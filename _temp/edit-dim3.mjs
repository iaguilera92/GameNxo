import fs from 'fs';
const f='frontend/src/scenes/MatchScene.ts';let s=fs.readFileSync(f,'utf8');
const o="0 = rectángulo de abajo (de la línea de fondo a la de saque), mitad izquierda;";
if(s.split(o).length!==2)throw 'nf';
s=s.replace(o,"0 = el rectángulo largo (de la línea de fondo a la red), mitad izquierda;");
fs.writeFileSync(f,s);console.log('ok');
