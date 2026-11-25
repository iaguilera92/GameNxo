import fs from 'fs';
const f='frontend/src/scenes/MatchScene.ts';let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');
const a=s.indexOf('  /** (24-11-2026, usuario) NIVEL 2 (DEFENSIVO) con el entrenador');
const b=s.indexOf('  // ---------------------------------------------------------------- EJERCICIOS de los niveles 3 y 4');
if(a<0||b<0||b<a) throw 'nf';
s=s.slice(0,a)+'  // (25-11-2026, usuario) NIVEL 2: ya sin pausas del entrenador; la pelota se congela y pulsas DEFENSIVO (tickGuide / activateDash)\n\n'+s.slice(b);
fs.writeFileSync(f,s);console.log('ok');
