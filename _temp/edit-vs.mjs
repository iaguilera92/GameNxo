import fs from 'fs';
function apply(f, ed){let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');for(const [o,n] of ed){const i=s.indexOf(o);if(i<0||s.indexOf(o,i+1)>=0)throw new Error(f+' nf '+o.slice(0,60));s=s.slice(0,i)+n+s.slice(i+o.length);}fs.writeFileSync(f,s);}
apply('frontend/src/scenes/MatchmakingScene.ts',[
["import { MAX_LEVEL } from '../config';","import { MAX_LEVEL } from '../config';\nimport { isDevMode } from '../domain/devMode';"],
["    const rivalLevel = Math.min(MAX_LEVEL, rivalLevelFor(p.level) + tier * 2);","    const rivalLevel = Math.min(MAX_LEVEL, rivalLevelFor(p.level) + tier * 2);\n    // (25-11-2026, usuario) en el tutorial (bajo el nivel 20) la VS no muestra las victorias de nadie\n    const tutorial = !isDevMode() && p.level < MAX_LEVEL;"],
["wins: totalWins(), color: p.color,","wins: tutorial ? undefined : totalWins(), color: p.color,"],
["        wins: Math.round(rivalLevel * Phaser.Math.FloatBetween(2, 5)),","        wins: tutorial ? undefined : Math.round(rivalLevel * Phaser.Math.FloatBetween(2, 5)),"],
]);
fs.writeFileSync('_temp/para-chatgpt/check-bien.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="-150 -170 300 300">
  <text x="0" y="-95" text-anchor="middle" font-family="Lilita One, Arial Black, sans-serif" font-size="52" fill="#7dffb0" stroke="#06331a" stroke-width="10" paint-order="stroke" stroke-linejoin="round">¡BIEN!</text>
  <circle cx="5" cy="10" r="85" fill="#000" fill-opacity="0.35"/>
  <circle cx="0" cy="0" r="85" fill="#2ecc71"/>
  <circle cx="0" cy="0" r="85" fill="none" stroke="#fff" stroke-width="10"/>
  <polyline points="-37,2 -10,32 42,-30" fill="none" stroke="#fff" stroke-width="22" stroke-linecap="butt" stroke-linejoin="miter"/>
</svg>`);
console.log('ok');
