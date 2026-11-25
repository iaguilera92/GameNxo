import fs from 'fs';
const f='frontend/src/scenes/MatchScene.ts';let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');
const o="    this.bot.depthBoost = serving || l2 ? 6000 : 0;";
if(s.split(o).length!==2) throw 'nf';
s=s.replace(o,"    // (25-11-2026, usuario) nivel 2: el rival queda OSCURECIDO (opaco); en el nivel 1 se ve cuando sacas\n    this.bot.depthBoost = serving && this.guide === 'first' ? 6000 : 0;");
fs.writeFileSync(f,s);console.log('ok');
