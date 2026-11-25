import fs from 'fs';
function apply(f, ed){let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');for(const [o,n] of ed){const i=s.indexOf(o);if(i<0||s.indexOf(o,i+1)>=0)throw new Error(f+' nf '+o.slice(0,60));s=s.slice(0,i)+n+s.slice(i+o.length);}fs.writeFileSync(f,s);}
apply('frontend/src/scenes/MatchmakingScene.ts',[
["    this.ambiente = prepareMatchMusic(this, this.doubles);\n", "    this.ambiente = prepareMatchMusic(this, this.doubles);\n    // (25-11-2026) y su imagen, mientras se busca (el partido ya la encuentra cargada)\n    queueAmbiente(this.load, this.ambiente);\n    if (!this.load.isLoading()) this.load.start();\n"],
["import { getProfile } from '../logic/Profile';", "import { getProfile } from '../logic/Profile';\nimport { queueAmbiente } from '../view/CourtView';"],
]);
apply('frontend/src/scenes/MenuScene.ts',[
["    if (!busy) releaseCharacterSprites(this, sheetsOf([[getProfile().skin, 'back'], [getProfile().skin, 'front']]));",
 "    if (!busy) {\n      releaseCharacterSprites(this, sheetsOf([[getProfile().skin, 'back'], [getProfile().skin, 'front']]));\n      releaseAmbientes(this); // (25-11-2026) el fondo de cancha del partido que terminó\n    }"],
["import { queueNxoSpriteLoads, registerNxoAnims, releaseCharacterSprites, sheetsOf } from '../objects/NxoActor';", "import { queueNxoSpriteLoads, registerNxoAnims, releaseCharacterSprites, sheetsOf } from '../objects/NxoActor';\nimport { releaseAmbientes } from '../view/CourtView';"],
]);
console.log('ok');
