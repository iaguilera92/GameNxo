import fs from 'fs';
function apply(f, ed){let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');for(const [o,n] of ed){const i=s.indexOf(o);if(i<0||s.indexOf(o,i+1)>=0)throw new Error(f+' nf '+o.slice(0,60));s=s.slice(0,i)+n+s.slice(i+o.length);}fs.writeFileSync(f,s);}
apply('frontend/src/scenes/MenuScene.ts',[
["      const b = portrait.getBounds();\n      this.hero = { obj: portrait, rect: { x: b.x, y: b.y, w: b.width, h: b.height } };",
 "      const b = portrait.getBounds();\n      this.hero = { obj: portrait, rect: { x: b.x, y: b.y, w: b.width, h: b.height } };\n      // (28-11-2026, usuario) como en PERSONALIZAR: tocarlo o arrastrarlo lo gira hacia el otro lado (el cuerpo no se mueve de sitio)\n      makeHeroTurnable(this, portrait, px, -portrait.displayHeight * 0.16);"],
["import { getProfile, levelProgress } from '../logic/Profile';", "import { getProfile, levelProgress } from '../logic/Profile';\nimport { makeHeroTurnable } from '../ui/heroTurn';"],
]);
console.log('ok');
